package services

import (
	"archive/zip"
	"encoding/csv"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/models"
	"gorm.io/gorm"
)

// ProductExportFilter contains filtering parameters for catalog performance export
type ProductExportFilter struct {
	ProductType string
	Search      string
	Sort        string
}

// formatProductType converts product type code to friendly Indonesian business label
func formatProductType(pType string) string {
	switch strings.ToLower(strings.TrimSpace(pType)) {
	case "service":
		return "Layanan / Jasa"
	case "digital":
		return "Produk Digital"
	case "food":
		return "Kuliner & FnB"
	case "property":
		return "Properti & Listing"
	case "fauna":
		return "Satwa & Fauna"
	case "plant":
		return "Tanaman & Flora"
	default:
		return "Produk Fisik"
	}
}

// escapeLikeQuery sanitizes SQL LIKE wildcards
func escapeLikeQuery(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, "%", `\%`)
	s = strings.ReplaceAll(s, "_", `\_`)
	return s
}

// parseExportPeriod parses period string into days and isAllTime flag
func parseExportPeriod(period string) (days int, isAllTime bool, label string) {
	p := strings.ToLower(strings.TrimSpace(period))
	switch p {
	case "7d":
		return 7, false, "7 Hari Terakhir"
	case "90d":
		return 90, false, "90 Hari Terakhir"
	case "all", "all-time", "alltime":
		return 0, true, "Sepanjang Waktu (Semua Riwayat)"
	default:
		return 30, false, "30 Hari Terakhir"
	}
}

// ExportDailyMetricsCSV exports complete daily trends including unique visitors and bounces
func ExportDailyMetricsCSV(w io.Writer, store *models.Store, period string, days int, isAllTime bool, db *gorm.DB) error {
	// 1. Mandatory UTF-8 BOM for Microsoft Excel Windows/Mac compatibility
	if _, err := w.Write([]byte("\xef\xbb\xbf")); err != nil {
		return err
	}

	csvWriter := csv.NewWriter(w)
	defer csvWriter.Flush()

	headers := []string{
		"Tanggal",
		"Pengunjung Unik",
		"Tayangan Toko",
		"Tayangan Detail Produk",
		"Kunjungan Memantul (Bounces)",
		"Rasio Pantulan (%)",
		"Klik WhatsApp Langsung",
		"Klik Marketplace",
		"Klik Rekber Syariah",
		"Tayangan Video Preview",
		"Total Aksi Peminat",
		"Rasio Konversi Toko (%)",
	}

	if err := csvWriter.Write(headers); err != nil {
		return err
	}

	query := db.Where("store_id = ?", store.ID)
	if !isAllTime && days > 0 {
		startDate := time.Now().AddDate(0, 0, -(days - 1)).Format("2006-01-02")
		query = query.Where("date >= ?", startDate)
	}

	var records []models.StoreDailyAnalytics
	if err := query.Order("date DESC").Find(&records).Error; err != nil {
		return fmt.Errorf("failed to fetch daily records: %w", err)
	}

	for _, r := range records {
		directWa := r.DirectWaClicks
		if directWa == 0 && r.WaClicks > 0 {
			directWa = r.WaClicks
		}
		act := r.TotalActions
		if act == 0 {
			act = directWa + r.MarketplaceClicks + r.RekberClicks + r.VideoViews
		}

		bounceRate := 0.0
		if r.StoreViews > 0 {
			bounceRate = (float64(r.Bounces) / float64(r.StoreViews)) * 100.0
			if bounceRate > 100.0 {
				bounceRate = 100.0
			}
		}

		cr := 0.0
		if r.StoreViews > 0 {
			cr = (float64(act) / float64(r.StoreViews)) * 100.0
			if cr > 100.0 {
				cr = 100.0
			}
		}

		row := []string{
			SanitizeCSVField(r.Date),
			strconv.Itoa(r.UniqueVisitors),
			strconv.Itoa(r.StoreViews),
			strconv.Itoa(r.ProductViews),
			strconv.Itoa(r.Bounces),
			fmt.Sprintf("%.2f%%", bounceRate),
			strconv.Itoa(directWa),
			strconv.Itoa(r.MarketplaceClicks),
			strconv.Itoa(r.RekberClicks),
			strconv.Itoa(r.VideoViews),
			strconv.Itoa(act),
			fmt.Sprintf("%.2f%%", cr),
		}

		if err := csvWriter.Write(row); err != nil {
			return err
		}
	}

	csvWriter.Flush()
	return csvWriter.Error()
}

// ExportProductsPerformanceCSV exports item-level catalog performance with chunked batching (O(1) memory)
func ExportProductsPerformanceCSV(w io.Writer, store *models.Store, filter ProductExportFilter, db *gorm.DB) error {
	if _, err := w.Write([]byte("\xef\xbb\xbf")); err != nil {
		return err
	}

	csvWriter := csv.NewWriter(w)
	defer csvWriter.Flush()

	headers := []string{
		"ID Item",
		"Nama Produk",
		"Tipe Katalog",
		"Kategori/Kelas",
		"Harga Pokok (Rp)",
		"Status Tayang",
		"Tayangan (Views)",
		"Klik WhatsApp",
		"Klik Marketplace",
		"Klik Rekber Syariah",
		"Tayangan Video",
		"Total Aksi Peminat",
		"Rasio Konversi CTR (%)",
	}

	if err := csvWriter.Write(headers); err != nil {
		return err
	}

	query := db.Model(&models.Product{}).
		Preload("Category").
		Where("store_id = ? AND is_active = ?", store.ID, true)

	pType := strings.ToLower(strings.TrimSpace(filter.ProductType))
	if pType != "" && pType != "all" {
		query = query.Where("COALESCE(NULLIF(product_type, ''), 'physical') = ?", pType)
	}

	search := strings.TrimSpace(filter.Search)
	if search != "" {
		escaped := escapeLikeQuery(strings.ToLower(search))
		searchLike := "%" + escaped + "%"
		query = query.Where("(LOWER(name) LIKE ? OR LOWER(class) LIKE ? OR LOWER(scientific_name) LIKE ?)", searchLike, searchLike, searchLike)
	}

	switch strings.ToLower(strings.TrimSpace(filter.Sort)) {
	case "price_desc":
		query = query.Order("price DESC, id DESC")
	case "price_asc":
		query = query.Order("price ASC, id DESC")
	case "actions":
		query = query.Order("(wa_clicks_count + marketplace_clicks_count + rekber_clicks_count + video_views_count) DESC, view_count DESC, id DESC")
	case "ctr":
		query = query.Order("CASE WHEN view_count > 0 THEN ((wa_clicks_count + marketplace_clicks_count + rekber_clicks_count + video_views_count)::float / view_count::float) ELSE 0 END DESC, id DESC")
	default: // "views"
		query = query.Order("view_count DESC, wa_clicks_count DESC, id DESC")
	}

	// Stream via FindInBatches (500 items per batch to keep memory constant O(1))
	var batch []models.Product
	err := query.FindInBatches(&batch, 500, func(tx *gorm.DB, batchIndex int) error {
		for _, p := range batch {
			totalAct := p.WaClicksCount + p.MarketplaceClicksCount + p.RekberClicksCount + p.VideoViewsCount
			ctr := 0.0
			if p.ViewCount > 0 {
				ctr = (float64(totalAct) / float64(p.ViewCount)) * 100.0
				if ctr > 100.0 {
					ctr = 100.0
				}
			}

			catName := p.GetEffectiveCategory()
			if catName == "" {
				catName = "Umum"
			}

			statusTayang := "Aktif"
			if !p.IsActive {
				statusTayang = "Nonaktif"
			}
			if p.ArchivedAt != nil {
				statusTayang = "Diarsipkan"
			}

			row := []string{
				strconv.FormatUint(uint64(p.ID), 10),
				SanitizeCSVField(p.Name),
				SanitizeCSVField(formatProductType(p.ProductType)),
				SanitizeCSVField(catName),
				fmt.Sprintf("%.0f", p.Price),
				SanitizeCSVField(statusTayang),
				strconv.FormatInt(p.ViewCount, 10),
				strconv.FormatInt(p.WaClicksCount, 10),
				strconv.FormatInt(p.MarketplaceClicksCount, 10),
				strconv.FormatInt(p.RekberClicksCount, 10),
				strconv.FormatInt(p.VideoViewsCount, 10),
				strconv.FormatInt(totalAct, 10),
				fmt.Sprintf("%.2f%%", ctr),
			}

			if err := csvWriter.Write(row); err != nil {
				return err
			}
		}
		csvWriter.Flush()
		return csvWriter.Error()
	}).Error

	if err != nil {
		return fmt.Errorf("failed to export products in batches: %w", err)
	}

	csvWriter.Flush()
	return csvWriter.Error()
}

// ExportTrafficSourcesCSV exports traffic attribution channels and conversions
func ExportTrafficSourcesCSV(w io.Writer, store *models.Store, period string, days int, isAllTime bool, db *gorm.DB) error {
	if _, err := w.Write([]byte("\xef\xbb\xbf")); err != nil {
		return err
	}

	csvWriter := csv.NewWriter(w)
	defer csvWriter.Flush()

	headers := []string{
		"Kode Kanal",
		"Nama Sumber Trafik",
		"Total Tayangan",
		"Pengunjung Unik",
		"Total Aksi Peminat",
		"Pangsa Trafik (%)",
		"Rasio Konversi (%)",
	}

	if err := csvWriter.Write(headers); err != nil {
		return err
	}

	query := db.Where("store_id = ?", store.ID)
	if !isAllTime && days > 0 {
		startDate := time.Now().AddDate(0, 0, -(days - 1)).Format("2006-01-02")
		query = query.Where("date >= ?", startDate)
	}

	var records []models.StoreDailyTrafficSource
	if err := query.Find(&records).Error; err != nil {
		return fmt.Errorf("failed to fetch traffic sources: %w", err)
	}

	sourceLabels := map[string]string{
		"instagram":   "Instagram",
		"tiktok":      "TikTok",
		"whatsapp":    "WhatsApp",
		"facebook":    "Facebook",
		"google":      "Google / Search",
		"marketplace": "Marketplace",
		"direct":      "Direct / Link Langsung",
		"other":       "Sumber Lainnya",
	}

	type srcAgg struct {
		code         string
		name         string
		views        int
		uniques      int
		totalActions int
	}

	aggMap := make(map[string]*srcAgg)
	totalViews := 0

	for _, r := range records {
		s := strings.ToLower(strings.TrimSpace(r.Source))
		if s == "" {
			s = "direct"
		}
		name, exists := sourceLabels[s]
		if !exists {
			name = strings.Title(s)
		}

		if _, found := aggMap[s]; !found {
			aggMap[s] = &srcAgg{
				code: s,
				name: name,
			}
		}
		aggMap[s].views += r.Views
		aggMap[s].uniques += r.UniqueVisitors
		aggMap[s].totalActions += r.TotalActions
		totalViews += r.Views
	}

	// Fallback if empty but store has views
	if len(aggMap) == 0 {
		aggMap["direct"] = &srcAgg{
			code: "direct",
			name: "Direct / Link Langsung",
		}
	}

	list := make([]*srcAgg, 0, len(aggMap))
	for _, itm := range aggMap {
		list = append(list, itm)
	}

	sort.Slice(list, func(i, j int) bool {
		if list[i].views != list[j].views {
			return list[i].views > list[j].views
		}
		return list[i].totalActions > list[j].totalActions
	})

	for _, item := range list {
		pct := 0.0
		if totalViews > 0 {
			pct = (float64(item.views) / float64(totalViews)) * 100.0
		}
		cr := 0.0
		if item.views > 0 {
			cr = (float64(item.totalActions) / float64(item.views)) * 100.0
			if cr > 100.0 {
				cr = 100.0
			}
		}

		row := []string{
			SanitizeCSVField(item.code),
			SanitizeCSVField(item.name),
			strconv.Itoa(item.views),
			strconv.Itoa(item.uniques),
			strconv.Itoa(item.totalActions),
			fmt.Sprintf("%.2f%%", pct),
			fmt.Sprintf("%.2f%%", cr),
		}

		if err := csvWriter.Write(row); err != nil {
			return err
		}
	}

	csvWriter.Flush()
	return csvWriter.Error()
}

// ExportAudienceDimensionsCSV exports multi-dimensional visitor segmentation
func ExportAudienceDimensionsCSV(w io.Writer, store *models.Store, period string, days int, isAllTime bool, db *gorm.DB) error {
	if _, err := w.Write([]byte("\xef\xbb\xbf")); err != nil {
		return err
	}

	csvWriter := csv.NewWriter(w)
	defer csvWriter.Flush()

	headers := []string{
		"Kategori Dimensi",
		"Nilai Dimensi",
		"Total Tayangan",
		"Pengunjung Unik",
		"Total Aksi Peminat",
		"Pangsa Audiens (%)",
		"Rasio Konversi (%)",
	}

	if err := csvWriter.Write(headers); err != nil {
		return err
	}

	type dimRow struct {
		DimensionType  string `gorm:"column:dimension_type"`
		DimensionValue string `gorm:"column:dimension_value"`
		Views          int    `gorm:"column:views"`
		UniqueVisitors int    `gorm:"column:unique_visitors"`
		TotalActions   int    `gorm:"column:total_actions"`
	}

	query := db.Model(&models.StoreDailyAudienceMetric{}).
		Select("dimension_type, dimension_value, SUM(views) as views, SUM(unique_visitors) as unique_visitors, SUM(total_actions) as total_actions").
		Where("store_id = ?", store.ID)

	if !isAllTime && days > 0 {
		startDate := time.Now().AddDate(0, 0, -(days - 1)).Format("2006-01-02")
		query = query.Where("date >= ?", startDate)
	}

	var rows []dimRow
	if err := query.Group("dimension_type, dimension_value").Order("dimension_type ASC, views DESC").Find(&rows).Error; err != nil {
		return fmt.Errorf("failed to fetch audience dimensions: %w", err)
	}

	// Calculate totals per dimension type for percentage calculation
	typeTotals := make(map[string]int)
	for _, r := range rows {
		typeTotals[r.DimensionType] += r.Views
	}

	dimTypeLabels := map[string]string{
		"device":   "Perangkat",
		"os":       "Sistem Operasi",
		"browser":  "Peramban Web",
		"city":     "Wilayah / Kota",
		"campaign": "Kampanye Pemasaran",
		"hour":     "Jam Sibuk",
	}

	for _, r := range rows {
		val := strings.TrimSpace(r.DimensionValue)
		if val == "" {
			continue
		}

		typeLabel := dimTypeLabels[r.DimensionType]
		if typeLabel == "" {
			typeLabel = strings.Title(r.DimensionType)
		}

		tot := typeTotals[r.DimensionType]
		pct := 0.0
		if tot > 0 {
			pct = (float64(r.Views) / float64(tot)) * 100.0
		}

		cr := 0.0
		if r.Views > 0 {
			cr = (float64(r.TotalActions) / float64(r.Views)) * 100.0
			if cr > 100.0 {
				cr = 100.0
			}
		}

		row := []string{
			SanitizeCSVField(typeLabel),
			SanitizeCSVField(val),
			strconv.Itoa(r.Views),
			strconv.Itoa(r.UniqueVisitors),
			strconv.Itoa(r.TotalActions),
			fmt.Sprintf("%.2f%%", pct),
			fmt.Sprintf("%.2f%%", cr),
		}

		if err := csvWriter.Write(row); err != nil {
			return err
		}
	}

	csvWriter.Flush()
	return csvWriter.Error()
}

// ExportHourlyHeatmapCSV exports 24-hour activity distribution
func ExportHourlyHeatmapCSV(w io.Writer, store *models.Store, period string, days int, isAllTime bool, db *gorm.DB) error {
	if _, err := w.Write([]byte("\xef\xbb\xbf")); err != nil {
		return err
	}

	csvWriter := csv.NewWriter(w)
	defer csvWriter.Flush()

	headers := []string{
		"Jam (Format 24 Jam)",
		"Total Kunjungan",
		"Pangsa Kunjungan (%)",
	}

	if err := csvWriter.Write(headers); err != nil {
		return err
	}

	type hourRow struct {
		DimensionValue string `gorm:"column:dimension_value"`
		Views          int    `gorm:"column:views"`
	}

	query := db.Model(&models.StoreDailyAudienceMetric{}).
		Select("dimension_value, SUM(views) as views").
		Where("store_id = ? AND dimension_type = 'hour'", store.ID)

	if !isAllTime && days > 0 {
		startDate := time.Now().AddDate(0, 0, -(days - 1)).Format("2006-01-02")
		query = query.Where("date >= ?", startDate)
	}

	var rows []hourRow
	_ = query.Group("dimension_value").Find(&rows).Error

	hourMap := make(map[string]int)
	totalHourlyViews := 0
	for _, r := range rows {
		hourMap[r.DimensionValue] = r.Views
		totalHourlyViews += r.Views
	}

	for h := 0; h < 24; h++ {
		hStr := fmt.Sprintf("%02d:00", h)
		key := fmt.Sprintf("%02d", h)
		v := hourMap[key]

		pct := 0.0
		if totalHourlyViews > 0 {
			pct = (float64(v) / float64(totalHourlyViews)) * 100.0
		}

		row := []string{
			SanitizeCSVField(hStr),
			strconv.Itoa(v),
			fmt.Sprintf("%.2f%%", pct),
		}

		if err := csvWriter.Write(row); err != nil {
			return err
		}
	}

	csvWriter.Flush()
	return csvWriter.Error()
}

// ExportFullAnalyticsZip packages all 5 modular CSV files and an executive summary text into a clean ZIP archive
func ExportFullAnalyticsZip(w io.Writer, store *models.Store, period string, days int, isAllTime bool, filter ProductExportFilter, db *gorm.DB) error {
	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()

	_, _, periodLabel := parseExportPeriod(period)

	// 1. Executive Summary Readme file
	metaWriter, err := zipWriter.Create("00_RINGKASAN_EKSEKUTIF.txt")
	if err == nil {
		storeTitle := store.StoreTitle
		if storeTitle == "" {
			storeTitle = store.Slug
		}

		// Calculate quick high-level summary
		var totalViews, totalActions, totalUniques int
		dailyQ := db.Model(&models.StoreDailyAnalytics{}).Where("store_id = ?", store.ID)
		if !isAllTime && days > 0 {
			startDate := time.Now().AddDate(0, 0, -(days - 1)).Format("2006-01-02")
			dailyQ = dailyQ.Where("date >= ?", startDate)
		}
		type sumRow struct {
			Views   int `gorm:"column:views"`
			Actions int `gorm:"column:actions"`
			Uniques int `gorm:"column:uniques"`
		}
		var sr sumRow
		_ = dailyQ.Select("COALESCE(SUM(store_views), 0) as views, COALESCE(SUM(total_actions), 0) as actions, COALESCE(SUM(unique_visitors), 0) as uniques").Scan(&sr).Error
		totalViews = sr.Views
		totalActions = sr.Actions
		totalUniques = sr.Uniques

		cr := 0.0
		if totalViews > 0 {
			cr = (float64(totalActions) / float64(totalViews)) * 100.0
			if cr > 100.0 {
				cr = 100.0
			}
		}

		summaryContent := fmt.Sprintf(`========================================================================
LAPORAN RESMI ANALITIKA & PERFORMA KATALOG CATAVOR
========================================================================
Nama Toko         : %s (Slug: %s)
Periode Laporan   : %s
Tanggal Cetak     : %s (WIB)
Status Profil     : Aktif

------------------------------------------------------------------------
RINGKASAN KUNJUNGAN & KONVERSI TOKO
------------------------------------------------------------------------
Total Kunjungan Toko   : %d tayangan
Total Pengunjung Unik  : %d pengunjung
Total Aksi Peminat     : %d interaksi (WhatsApp / Marketplace / Rekber)
Rata-Rata Rasio CTR    : %.2f%%

------------------------------------------------------------------------
DAFTAR BERKAS DATA CSV DALAM PAKET INI
------------------------------------------------------------------------
1. 01_tren_kunjungan_dan_konversi.csv
   -> Riwayat metrik harian, pengunjung unik, tayangan item, dan pantulan.
2. 02_performa_katalog_item.csv
   -> Rincian seluruh produk, tayangan, klik kontak, dan rasio konversi.
3. 03_sumber_trafik_dan_rujukan.csv
   -> Evaluasi kanal asal pengunjung (IG, TikTok, WA, Search, dll).
4. 04_demografi_dan_teknologi_audiens.csv
   -> Distribusi perangkat, sistem operasi, browser, kota, dan kampanye.
5. 05_distribusi_jam_ramai_24_jam.csv
   -> Peta waktu kunjungan 24 jam untuk perencanaan promosi terukur.

Semua berkas CSV menggunakan standar UTF-8 BOM dan RFC 4180 sehingga
100%% kompatibel saat dibuka langsung di Microsoft Excel, Google Sheets,
atau diproses otomatis menggunakan Python/Pandas dan tools BI.
========================================================================`,
			storeTitle,
			store.Slug,
			periodLabel,
			time.Now().Format("2006-01-02 15:04:05"),
			totalViews,
			totalUniques,
			totalActions,
			cr,
		)
		_, _ = metaWriter.Write([]byte(summaryContent))
	}

	// 2. Daily Metrics CSV
	f1, err := zipWriter.Create("01_tren_kunjungan_dan_konversi.csv")
	if err != nil {
		return err
	}
	if err := ExportDailyMetricsCSV(f1, store, period, days, isAllTime, db); err != nil {
		return err
	}

	// 3. Products Performance CSV
	f2, err := zipWriter.Create("02_performa_katalog_item.csv")
	if err != nil {
		return err
	}
	if err := ExportProductsPerformanceCSV(f2, store, filter, db); err != nil {
		return err
	}

	// 4. Traffic Sources CSV
	f3, err := zipWriter.Create("03_sumber_trafik_dan_rujukan.csv")
	if err != nil {
		return err
	}
	if err := ExportTrafficSourcesCSV(f3, store, period, days, isAllTime, db); err != nil {
		return err
	}

	// 5. Audience Dimensions CSV
	f4, err := zipWriter.Create("04_demografi_dan_teknologi_audiens.csv")
	if err != nil {
		return err
	}
	if err := ExportAudienceDimensionsCSV(f4, store, period, days, isAllTime, db); err != nil {
		return err
	}

	// 6. Hourly Heatmap CSV
	f5, err := zipWriter.Create("05_distribusi_jam_ramai_24_jam.csv")
	if err != nil {
		return err
	}
	if err := ExportHourlyHeatmapCSV(f5, store, period, days, isAllTime, db); err != nil {
		return err
	}

	return zipWriter.Close()
}

// GetAnalyticsExportMetadata determines the HTTP filename and Content-Type header
func GetAnalyticsExportMetadata(store *models.Store, reportType string, period string) (filename string, contentType string) {
	pClean := strings.ToLower(strings.TrimSpace(period))
	if pClean == "" {
		pClean = "30d"
	}
	dateStr := time.Now().Format("20060102")

	switch strings.ToLower(strings.TrimSpace(reportType)) {
	case "daily":
		return fmt.Sprintf("catavor-analytics-%s-daily-%s-%s.csv", store.Slug, pClean, dateStr), "text/csv; charset=utf-8"
	case "products":
		return fmt.Sprintf("catavor-analytics-%s-products-%s.csv", store.Slug, dateStr), "text/csv; charset=utf-8"
	case "traffic_sources", "sources":
		return fmt.Sprintf("catavor-analytics-%s-traffic-sources-%s-%s.csv", store.Slug, pClean, dateStr), "text/csv; charset=utf-8"
	case "audience", "dimensions":
		return fmt.Sprintf("catavor-analytics-%s-audience-%s-%s.csv", store.Slug, pClean, dateStr), "text/csv; charset=utf-8"
	case "hourly", "heatmap":
		return fmt.Sprintf("catavor-analytics-%s-hourly-traffic-%s-%s.csv", store.Slug, pClean, dateStr), "text/csv; charset=utf-8"
	case "package", "zip", "full", "all":
		fallthrough
	default:
		return fmt.Sprintf("catavor-analytics-%s-package-%s-%s.zip", store.Slug, pClean, dateStr), "application/zip"
	}
}

// ExecuteAnalyticsExport dispatches to the requested export generator
func ExecuteAnalyticsExport(w io.Writer, store *models.Store, reportType string, period string, filter ProductExportFilter, db *gorm.DB) (filename string, contentType string, err error) {
	days, isAllTime, _ := parseExportPeriod(period)
	pClean := strings.ToLower(strings.TrimSpace(period))
	if pClean == "" {
		pClean = "30d"
	}
	dateStr := time.Now().Format("20060102")

	switch strings.ToLower(strings.TrimSpace(reportType)) {
	case "daily":
		filename = fmt.Sprintf("catavor-analytics-%s-daily-%s-%s.csv", store.Slug, pClean, dateStr)
		contentType = "text/csv; charset=utf-8"
		err = ExportDailyMetricsCSV(w, store, period, days, isAllTime, db)

	case "products":
		filename = fmt.Sprintf("catavor-analytics-%s-products-%s.csv", store.Slug, dateStr)
		contentType = "text/csv; charset=utf-8"
		err = ExportProductsPerformanceCSV(w, store, filter, db)

	case "traffic_sources", "sources":
		filename = fmt.Sprintf("catavor-analytics-%s-traffic-sources-%s-%s.csv", store.Slug, pClean, dateStr)
		contentType = "text/csv; charset=utf-8"
		err = ExportTrafficSourcesCSV(w, store, period, days, isAllTime, db)

	case "audience", "dimensions":
		filename = fmt.Sprintf("catavor-analytics-%s-audience-%s-%s.csv", store.Slug, pClean, dateStr)
		contentType = "text/csv; charset=utf-8"
		err = ExportAudienceDimensionsCSV(w, store, period, days, isAllTime, db)

	case "hourly", "heatmap":
		filename = fmt.Sprintf("catavor-analytics-%s-hourly-traffic-%s-%s.csv", store.Slug, pClean, dateStr)
		contentType = "text/csv; charset=utf-8"
		err = ExportHourlyHeatmapCSV(w, store, period, days, isAllTime, db)

	case "package", "zip", "full", "all":
		fallthrough
	default:
		filename = fmt.Sprintf("catavor-analytics-%s-package-%s-%s.zip", store.Slug, pClean, dateStr)
		contentType = "application/zip"
		err = ExportFullAnalyticsZip(w, store, period, days, isAllTime, filter, db)
	}

	return filename, contentType, err
}
