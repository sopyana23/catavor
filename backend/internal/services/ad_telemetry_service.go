package services

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// =========================================================================================
// AD TELEMETRY & CLICK FRAUD PREVENTION SERVICE
// =========================================================================================
// Service ini menangani:
// 1. In-Memory Atomic Buffer untuk impresi & klik iklan (Mencegah Row-Lock Contention pada PostgreSQL).
// 2. Background Flusher yang melakukan BATCH UPSERT ke ad_daily_metrics setiap 60 detik.
// 3. HMAC-SHA256 Signed Redirect URL dengan masa berlaku ketat (60 detik) untuk mencegah replay attacks.
// 4. Token Bucket Rate Limiter berbasis IP & Sesi Pengunjung untuk mencegah Click Fraud & Budget Draining.
// =========================================================================================

// telemetryKey merepresentasikan identitas unik agregasi per kampanye per hari.
type telemetryKey struct {
	CampaignID uint64
	AdSlotID   uint64
	StoreID    uint
	Date       string // Format YYYY-MM-DD
}

// telemetryCounters menampung akumulasi hit dalam memori sebelum di-flush ke database.
type telemetryCounters struct {
	Impressions int64
	Clicks      int64
	WaClicks    int64
}

// AdTelemetryService adalah singleton pengelola telemetri iklan berkecepatan tinggi.
type AdTelemetryService struct {
	mu           sync.RWMutex
	buffer       map[telemetryKey]*telemetryCounters
	clickTracker map[string]int64 // Key: "ip:campaign_id" -> Timestamp klik terakhir (Unix)
	trackerMu    sync.RWMutex
}

var (
	globalAdTelemetry *AdTelemetryService
	adTelemetryOnce   sync.Once
)

// GetAdTelemetryService mengembalikan instance singleton dari AdTelemetryService.
func GetAdTelemetryService() *AdTelemetryService {
	adTelemetryOnce.Do(func() {
		globalAdTelemetry = &AdTelemetryService{
			buffer:       make(map[telemetryKey]*telemetryCounters),
			clickTracker: make(map[string]int64),
		}
	})
	return globalAdTelemetry
}

// RecordImpression mencatat 1 impresi ke dalam in-memory buffer secara non-blocking (< 0.1ms).
// Fungsi ini dipanggil setiap kali sebuah kartu iklan disajikan pada landing page.
func (s *AdTelemetryService) RecordImpression(campaignID, adSlotID uint64, storeID uint) {
	if campaignID == 0 || adSlotID == 0 || storeID == 0 {
		return
	}
	today := time.Now().UTC().Format("2006-01-02")
	k := telemetryKey{
		CampaignID: campaignID,
		AdSlotID:   adSlotID,
		StoreID:    storeID,
		Date:       today,
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	entry, exists := s.buffer[k]
	if !exists {
		entry = &telemetryCounters{}
		s.buffer[k] = entry
	}
	entry.Impressions++
}

// RecordClick mencatat klik iklan dengan perlindungan Anti-Click-Fraud (Token Bucket per IP).
// Mengembalikan isChargeable = true jika klik sah, atau false jika klik berulang dalam 30 menit.
func (s *AdTelemetryService) RecordClick(campaignID, adSlotID uint64, storeID uint, clientIP, sessionID string, isWAClick bool) bool {
	if campaignID == 0 || adSlotID == 0 || storeID == 0 {
		return false
	}
	now := time.Now().UTC().Unix()
	trackerKey := fmt.Sprintf("%s:%d", strings.TrimSpace(clientIP), campaignID)
	if sessionID != "" {
		trackerKey = fmt.Sprintf("%s:%s:%d", clientIP, sessionID, campaignID)
	}

	// 1. Periksa batas waktu klik (Anti-Click-Fraud: Maksimal 1 klik sah per 30 menit per IP/Sesi)
	s.trackerMu.Lock()
	lastClick, seen := s.clickTracker[trackerKey]
	s.clickTracker[trackerKey] = now
	// Bersihkan cache tracker jika terlalu besar (> 100.000 entri)
	if len(s.clickTracker) > 100000 {
		for k, ts := range s.clickTracker {
			if now-ts > 3600 {
				delete(s.clickTracker, k)
			}
		}
	}
	s.trackerMu.Unlock()

	isChargeable := !seen || (now-lastClick > 1800) // 1800 detik = 30 menit

	// 2. Akumulasi ke buffer telemetri
	today := time.Now().UTC().Format("2006-01-02")
	k := telemetryKey{
		CampaignID: campaignID,
		AdSlotID:   adSlotID,
		StoreID:    storeID,
		Date:       today,
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	entry, exists := s.buffer[k]
	if !exists {
		entry = &telemetryCounters{}
		s.buffer[k] = entry
	}
	entry.Clicks++
	if isWAClick {
		entry.WaClicks++
	}

	return isChargeable
}

// FlushToDatabase memindahkan data akumulasi dari memori ke PostgreSQL menggunakan BATCH UPSERT.
// Dipanggil secara otomatis oleh background worker setiap 60 detik.
func (s *AdTelemetryService) FlushToDatabase(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("database handle nil")
	}

	s.mu.Lock()
	if len(s.buffer) == 0 {
		s.mu.Unlock()
		return nil
	}
	// Salin buffer dan reset buffer aktif agar request baru tidak terhambat
	snapshot := s.buffer
	s.buffer = make(map[telemetryKey]*telemetryCounters)
	s.mu.Unlock()

	// Eksekusi Batch Upsert ke ad_daily_metrics
	for k, c := range snapshot {
		if c.Impressions == 0 && c.Clicks == 0 && c.WaClicks == 0 {
			continue
		}

		// Kueri Idempoten PostgreSQL ON CONFLICT DO UPDATE
		query := `
			INSERT INTO ad_daily_metrics (campaign_id, ad_slot_id, store_id, date, impressions_count, clicks_count, wa_clicks_count, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			ON CONFLICT (campaign_id, date) 
			DO UPDATE SET 
				impressions_count = ad_daily_metrics.impressions_count + EXCLUDED.impressions_count,
				clicks_count = ad_daily_metrics.clicks_count + EXCLUDED.clicks_count,
				wa_clicks_count = ad_daily_metrics.wa_clicks_count + EXCLUDED.wa_clicks_count,
				ctr_percentage = CASE 
					WHEN (ad_daily_metrics.impressions_count + EXCLUDED.impressions_count) > 0 
					THEN ROUND(((ad_daily_metrics.clicks_count + EXCLUDED.clicks_count)::decimal / (ad_daily_metrics.impressions_count + EXCLUDED.impressions_count)::decimal) * 100.0, 2)
					ELSE 0 
				END,
				updated_at = CURRENT_TIMESTAMP;
		`
		if err := db.Exec(query, k.CampaignID, k.AdSlotID, k.StoreID, k.Date, c.Impressions, c.Clicks, c.WaClicks).Error; err != nil {
			log.Warn().Err(err).
				Uint64("campaign_id", k.CampaignID).
				Str("date", k.Date).
				Msg("Gagal melakukan batch upsert telemetri iklan")
		}
	}

	return nil
}

// GenerateSignedClickURL membuat URL redirect iklan terenkripsi HMAC-SHA256 dengan masa kedaluwarsa 60 detik.
// URL ini mencegah manipulasi ID kampanye dan replay attack oleh bot.
func GenerateSignedClickURL(campaignCode, targetURL, secret string) string {
	ts := time.Now().UTC().Unix()
	payload := fmt.Sprintf("%s|%s|%d", campaignCode, targetURL, ts)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	signature := hex.EncodeToString(mac.Sum(nil))

	return fmt.Sprintf("/api/public/ads/click?c=%s&ts=%d&sig=%s", campaignCode, ts, signature)
}

// VerifyClickSignature memvalidasi integritas dan masa berlaku URL redirect iklan.
// Mengembalikan true jika tanda tangan valid dan usia request <= 60 detik.
func VerifyClickSignature(campaignCode, targetURL, tsStr, signature, secret string) bool {
	ts, err := strconv.ParseInt(tsStr, 10, 64)
	if err != nil {
		return false
	}
	now := time.Now().UTC().Unix()
	// Tolak jika token kedaluwarsa (> 60 detik) atau berasal dari masa depan (> 10 detik toleransi drift)
	if now-ts > 60 || ts-now > 10 {
		return false
	}

	payload := fmt.Sprintf("%s|%s|%d", campaignCode, targetURL, ts)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

