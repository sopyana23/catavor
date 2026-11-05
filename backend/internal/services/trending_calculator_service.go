package services

import (
	"fmt"
	"time"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// =========================================================================================
// TRENDING CALCULATOR SERVICE (ROLLING 7-DAY VELOCITY SCORE)
// =========================================================================================
// Service ini memecahkan masalah "The Rich Get Richer" (di mana produk lama yang sudah sepi
// mengunci posisi teratas beranda karena skor kumulatif seumur hidup).
//
// Cara Kerja:
// 1. Menghitung akumulasi interaksi pengunjung hanya dalam rentang 7 HARI TERAKHIR:
//    Score = (Views * 1) + (Direct WA Clicks * 5) + (Rekber Escrow Clicks * 10)
// 2. Memperbarui kolom materialized berindeks 'trending_score_7d' pada tabel products & stores.
// 3. Produk lama yang sepi interaksi 7 hari terakhir otomatis meluruh ke skor 0.
// 4. Produk baru yang viral 3 hari terakhir langsung melesat ke posisi teratas beranda.
// 5. Berjalan di latar belakang (Background Worker) setiap 2 jam.
// =========================================================================================

// CalculateRolling7DayTrendingScores mengeksekusi perhitungan skor kecepatan tren 7 hari
// untuk seluruh produk dan toko aktif di platform Catavor.
func CalculateRolling7DayTrendingScores(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("database handle nil")
	}

	start := time.Now()
	sevenDaysAgo := time.Now().UTC().AddDate(0, 0, -7).Format("2006-01-02")

	// 1. Perbarui Skor Tren 7 Hari Produk (products.trending_score_7d)
	// Menggunakan tabel harian eksisting: product_daily_analytics
	queryProducts := `
		WITH rolling_scores AS (
			SELECT 
				product_id,
				SUM(views * 1 + direct_wa_clicks * 5 + rekber_clicks * 10) AS score_7d
			FROM product_daily_analytics
			WHERE date >= ?
			GROUP BY product_id
		)
		UPDATE products p
		SET trending_score_7d = COALESCE(rs.score_7d, 0)
		FROM rolling_scores rs
		WHERE p.id = rs.product_id;
	`
	if err := db.Exec(queryProducts, sevenDaysAgo).Error; err != nil {
		log.Error().Err(err).Msg("Gagal memperbarui trending_score_7d pada tabel products")
		return err
	}

	// Nol-kan produk yang tidak memiliki aktivitas sama sekali dalam 7 hari terakhir
	resetInactiveProducts := `
		UPDATE products 
		SET trending_score_7d = 0 
		WHERE id NOT IN (
			SELECT DISTINCT product_id FROM product_daily_analytics WHERE date >= ?
		) AND trending_score_7d > 0;
	`
	_ = db.Exec(resetInactiveProducts, sevenDaysAgo)

	// 2. Perbarui Skor Tren 7 Hari Toko (stores.trending_score_7d)
	// Menggunakan tabel harian eksisting: store_daily_analytics
	queryStores := `
		WITH rolling_store_scores AS (
			SELECT 
				store_id,
				SUM(store_views * 1 + direct_wa_clicks * 5 + rekber_clicks * 10) AS score_7d
			FROM store_daily_analytics
			WHERE date >= ?
			GROUP BY store_id
		)
		UPDATE stores s
		SET trending_score_7d = COALESCE(rss.score_7d, 0)
		FROM rolling_store_scores rss
		WHERE s.id = rss.store_id;
	`
	if err := db.Exec(queryStores, sevenDaysAgo).Error; err != nil {
		log.Error().Err(err).Msg("Gagal memperbarui trending_score_7d pada tabel stores")
		return err
	}

	resetInactiveStores := `
		UPDATE stores 
		SET trending_score_7d = 0 
		WHERE id NOT IN (
			SELECT DISTINCT store_id FROM store_daily_analytics WHERE date >= ?
		) AND trending_score_7d > 0;
	`
	_ = db.Exec(resetInactiveStores, sevenDaysAgo)

	duration := time.Since(start)
	log.Info().
		Str("seven_days_ago", sevenDaysAgo).
		Dur("elapsed", duration).
		Msg("Siklus agregasi skor tren 7-hari (Rolling Velocity) selesai berhasil")

	return nil
}

// StartTrendingCalculatorWorker meluncurkan goroutine background yang secara periodik
// (default setiap 2 jam) memperbarui skor tren mingguan. Dilengkapi proteksi panic-recovery.
func StartTrendingCalculatorWorker(db *gorm.DB, interval time.Duration) {
	if interval <= 0 {
		interval = 2 * time.Hour
	}

	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Error().Interface("panic", r).Msg("Recovered from panic in Trending Calculator background worker")
			}
		}()

		// Tunggu 30 detik pada boot awal sebelum siklus pertama agar tidak memperlambat start server
		time.Sleep(30 * time.Second)
		_ = CalculateRolling7DayTrendingScores(db)

		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			_ = CalculateRolling7DayTrendingScores(db)
		}
	}()
}

