package services

import (
	"archive/zip"
	"bytes"
	"io"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/models"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("failed to open in-memory sqlite db: %v", err)
	}

	err = db.AutoMigrate(
		&models.Store{},
		&models.Category{},
		&models.Product{},
		&models.StoreDailyAnalytics{},
		&models.ProductDailyAnalytics{},
		&models.StoreDailyTrafficSource{},
		&models.StoreDailyAudienceMetric{},
	)
	if err != nil {
		t.Fatalf("failed to migrate tables: %v", err)
	}

	return db
}

func TestSanitizeCSVField_Hardened(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"Normal Product", "Normal Product"},
		{"=cmd|' /C calc'!A0", "'=cmd|' /C calc'!A0"},
		{"+62812345678", "'+62812345678"},
		{"-25000", "'-25000"},
		{"@SUM(A1:A10)", "'@SUM(A1:A10)"},
		{"\t=1+1", "'=1+1"},
		{"\r=1+1", "'=1+1"},
		{"|test", "'|test"},
		{"", ""},
		{"   ", ""},
	}

	for _, c := range cases {
		got := SanitizeCSVField(c.input)
		if got != c.expected {
			t.Errorf("SanitizeCSVField(%q) = %q; want %q", c.input, got, c.expected)
		}
	}
}

func TestExportDailyMetricsCSV(t *testing.T) {
	db := setupTestDB(t)

	store := &models.Store{
		ID:         10,
		Slug:       "toko-flora",
		StoreTitle: "Toko Flora Cantik",
	}
	db.Create(store)

	today := time.Now().Format("2006-01-02")
	db.Create(&models.StoreDailyAnalytics{
		StoreID:           10,
		Date:              today,
		UniqueVisitors:    50,
		StoreViews:        120,
		ProductViews:      80,
		Bounces:           12,
		WaClicks:          15,
		DirectWaClicks:    15,
		MarketplaceClicks: 8,
		RekberClicks:      4,
		VideoViews:        6,
		TotalActions:      33,
	})

	var buf bytes.Buffer
	err := ExportDailyMetricsCSV(&buf, store, "30d", 30, false, db)
	if err != nil {
		t.Fatalf("ExportDailyMetricsCSV failed: %v", err)
	}

	out := buf.String()
	// 1. Must contain UTF-8 BOM
	if !strings.HasPrefix(out, "\xef\xbb\xbf") {
		t.Errorf("ExportDailyMetricsCSV missing UTF-8 BOM prefix")
	}

	// 2. Must contain headers
	if !strings.Contains(out, "Pengunjung Unik") || !strings.Contains(out, "Rasio Pantulan (%)") {
		t.Errorf("ExportDailyMetricsCSV headers missing modern metrics")
	}

	// 3. Must contain data row
	if !strings.Contains(out, today) || !strings.Contains(out, "50") || !strings.Contains(out, "120") {
		t.Errorf("ExportDailyMetricsCSV missing data values: %s", out)
	}
}

func TestExportProductsPerformanceCSV_WithFilter(t *testing.T) {
	db := setupTestDB(t)

	store := &models.Store{
		ID:   20,
		Slug: "toko-kuliner",
	}
	db.Create(store)

	cat := &models.Category{
		ID:      1,
		StoreID: 20,
		Name:    "Kue Basah",
	}
	db.Create(cat)

	catID := uint(1)
	p1 := &models.Product{
		StoreID:                20,
		CategoryID:             &catID,
		Name:                   "Lapis Legit Spesial",
		ProductType:            "food",
		Price:                  150000,
		ViewCount:              200,
		WaClicksCount:          20,
		MarketplaceClicksCount: 5,
		IsActive:               true,
	}
	p2 := &models.Product{
		StoreID:                20,
		Name:                   "Jasa Catering Harian",
		ProductType:            "service",
		Price:                  50000,
		ViewCount:              100,
		WaClicksCount:          10,
		IsActive:               true,
	}
	db.Create(p1)
	db.Create(p2)

	// Filter by food only
	var buf bytes.Buffer
	filter := ProductExportFilter{
		ProductType: "food",
		Search:      "",
		Sort:        "views",
	}
	err := ExportProductsPerformanceCSV(&buf, store, filter, db)
	if err != nil {
		t.Fatalf("ExportProductsPerformanceCSV failed: %v", err)
	}

	out := buf.String()
	if !strings.Contains(out, "Lapis Legit Spesial") {
		t.Errorf("Expected 'Lapis Legit Spesial' in output")
	}
	if strings.Contains(out, "Jasa Catering Harian") {
		t.Errorf("Expected 'Jasa Catering Harian' to be filtered out")
	}
}

func TestExportFullAnalyticsZip(t *testing.T) {
	db := setupTestDB(t)

	store := &models.Store{
		ID:         30,
		Slug:       "toko-serba-ada",
		StoreTitle: "Toko Serba Ada",
	}
	db.Create(store)

	today := time.Now().Format("2006-01-02")
	db.Create(&models.StoreDailyAnalytics{
		StoreID:        30,
		Date:           today,
		UniqueVisitors: 25,
		StoreViews:     60,
		TotalActions:   10,
	})

	db.Create(&models.StoreDailyTrafficSource{
		StoreID:        30,
		Date:           today,
		Source:         "instagram",
		Views:          40,
		UniqueVisitors: 15,
		TotalActions:   8,
	})

	db.Create(&models.StoreDailyAudienceMetric{
		StoreID:        30,
		Date:           today,
		DimensionType:  "city",
		DimensionValue: "Jakarta",
		Views:          50,
		UniqueVisitors: 20,
		TotalActions:   7,
	})

	db.Create(&models.StoreDailyAudienceMetric{
		StoreID:        30,
		Date:           today,
		DimensionType:  "hour",
		DimensionValue: "14",
		Views:          20,
	})

	var buf bytes.Buffer
	filter := ProductExportFilter{}
	err := ExportFullAnalyticsZip(&buf, store, "30d", 30, false, filter, db)
	if err != nil {
		t.Fatalf("ExportFullAnalyticsZip failed: %v", err)
	}

	// Verify ZIP archive contents
	zipReader, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatalf("Failed to read generated zip: %v", err)
	}

	expectedFiles := map[string]bool{
		"00_RINGKASAN_EKSEKUTIF.txt":              false,
		"01_tren_kunjungan_dan_konversi.csv":      false,
		"02_performa_katalog_item.csv":            false,
		"03_sumber_trafik_dan_rujukan.csv":        false,
		"04_demografi_dan_teknologi_audiens.csv":  false,
		"05_distribusi_jam_ramai_24_jam.csv":      false,
	}

	for _, f := range zipReader.File {
		if _, exists := expectedFiles[f.Name]; exists {
			expectedFiles[f.Name] = true
		}
	}

	for fname, found := range expectedFiles {
		if !found {
			t.Errorf("Missing expected file %q in generated zip archive", fname)
		}
	}
}

func TestExecuteAnalyticsExport_Dispatch(t *testing.T) {
	db := setupTestDB(t)
	store := &models.Store{ID: 40, Slug: "toko-dispatch"}
	db.Create(store)

	var buf bytes.Buffer
	fname, ctype, err := ExecuteAnalyticsExport(&buf, store, "daily", "7d", ProductExportFilter{}, db)
	if err != nil {
		t.Fatalf("ExecuteAnalyticsExport daily failed: %v", err)
	}
	if !strings.Contains(fname, "daily-7d") || ctype != "text/csv; charset=utf-8" {
		t.Errorf("Unexpected filename/content-type for daily: %s, %s", fname, ctype)
	}

	buf.Reset()
	fnameZip, ctypeZip, err := ExecuteAnalyticsExport(&buf, store, "package", "30d", ProductExportFilter{}, db)
	if err != nil {
		t.Fatalf("ExecuteAnalyticsExport package failed: %v", err)
	}
	if !strings.HasSuffix(fnameZip, ".zip") || ctypeZip != "application/zip" {
		t.Errorf("Unexpected filename/content-type for package: %s, %s", fnameZip, ctypeZip)
	}
}

func TestExportProductsPerformanceCSVWithPeriod_RespectsPeriodScope(t *testing.T) {
	db := setupTestDB(t)
	store := &models.Store{ID: 50, Slug: "toko-period-csv"}
	db.Create(store)

	prod := &models.Product{
		StoreID:       50,
		Name:          "Anthurium Delta",
		ProductType:   "plant",
		Price:         220000,
		ViewCount:     50,
		WaClicksCount: 5,
		IsActive:      true,
	}
	db.Create(prod)

	nowWib := AnalyticsNow()
	db.Create(&models.ProductDailyAnalytics{
		StoreID:        50,
		ProductID:      prod.ID,
		ProductType:    "plant",
		Date:           nowWib.Format("2006-01-02"),
		Views:          4,
		DirectWaClicks: 1,
		TotalActions:   1,
	})
	db.Create(&models.ProductDailyAnalytics{
		StoreID:        50,
		ProductID:      prod.ID,
		ProductType:    "plant",
		Date:           nowWib.AddDate(0, 0, -20).Format("2006-01-02"),
		Views:          46,
		DirectWaClicks: 4,
		TotalActions:   4,
	})

	var buf7d bytes.Buffer
	fname7d, _, err := ExecuteAnalyticsExport(&buf7d, store, "products", "7d", ProductExportFilter{}, db)
	if err != nil {
		t.Fatalf("ExecuteAnalyticsExport products 7d failed: %v", err)
	}
	if !strings.Contains(fname7d, "products-7d-") {
		t.Errorf("expected period token in products export filename, got %q", fname7d)
	}
	out7d := buf7d.String()
	if !strings.Contains(out7d, "Anthurium Delta,Tanaman & Flora") || !strings.Contains(out7d, ",4,1,0,0,0,1,25.00%") {
		t.Errorf("expected 7d scoped metrics (views=4, wa=1, ctr=25.00%%), got:\n%s", out7d)
	}

	var bufAll bytes.Buffer
	_, _, err = ExecuteAnalyticsExport(&bufAll, store, "products", "all", ProductExportFilter{}, db)
	if err != nil {
		t.Fatalf("ExecuteAnalyticsExport products all failed: %v", err)
	}
	if !strings.Contains(bufAll.String(), ",50,5,0,0,0,5,10.00%") {
		t.Errorf("expected all-time metrics (views=50, wa=5, ctr=10.00%%), got:\n%s", bufAll.String())
	}
}

func TestExportTrafficSourcesCSV_EmptyReturnsHeaderOnly(t *testing.T) {
	db := setupTestDB(t)
	store := &models.Store{ID: 60, Slug: "toko-kosong-trafik"}
	db.Create(store)

	var buf bytes.Buffer
	if err := ExportTrafficSourcesCSV(&buf, store, "7d", 7, false, db); err != nil {
		t.Fatalf("ExportTrafficSourcesCSV empty failed: %v", err)
	}
	out := buf.String()
	if !strings.HasPrefix(out, "\xef\xbb\xbf") {
		t.Errorf("expected UTF-8 BOM prefix on empty traffic CSV")
	}
	if strings.Contains(out, "Direct / Link Langsung") {
		t.Errorf("empty traffic CSV must not fabricate Direct / Link Langsung row, got:\n%s", out)
	}
	lines := strings.Split(strings.TrimSpace(out), "\n")
	if len(lines) != 1 {
		t.Errorf("expected header-only CSV (1 line), got %d lines:\n%s", len(lines), out)
	}
}

func TestExportFullAnalyticsZip_LegacyTotalActionsAndPeriodProductScope(t *testing.T) {
	db := setupTestDB(t)
	store := &models.Store{ID: 61, Slug: "toko-legacy-zip", StoreTitle: "Toko\nLegacy Audit"}
	db.Create(store)

	// Product has legacy all-time views=40, while store has period views without ProductDailyAnalytics rows.
	db.Create(&models.Product{
		StoreID:     61,
		Name:        "\t=cmd|' /C calc'!A0",
		ProductType: "physical",
		Price:       100000,
		ViewCount:   40,
		IsActive:    true,
	})

	today := AnalyticsNow().Format("2006-01-02")
	yesterday := AnalyticsNow().AddDate(0, 0, -1).Format("2006-01-02")
	db.Create(&models.StoreDailyAnalytics{
		StoreID:           61,
		Date:              today,
		StoreViews:        10,
		UniqueVisitors:    8,
		DirectWaClicks:    2,
		MarketplaceClicks: 1,
		RekberClicks:      1,
		TotalActions:      4,
	})
	db.Create(&models.StoreDailyAnalytics{
		StoreID:        61,
		Date:           yesterday,
		StoreViews:     5,
		UniqueVisitors: 4,
		DirectWaClicks: 2,
		TotalActions:   0, // legacy row with total_actions=0
	})

	var buf bytes.Buffer
	if _, _, err := ExecuteAnalyticsExport(&buf, store, "package", "7d", ProductExportFilter{}, db); err != nil {
		t.Fatalf("ExecuteAnalyticsExport package failed: %v", err)
	}

	zr, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatalf("zip.NewReader failed: %v", err)
	}
	files := map[string]string{}
	for _, f := range zr.File {
		rc, err := f.Open()
		if err != nil {
			t.Fatal(err)
		}
		raw, _ := io.ReadAll(rc)
		_ = rc.Close()
		files[f.Name] = string(raw)
	}

	summaryTxt := files["00_RINGKASAN_EKSEKUTIF.txt"]
	if !strings.Contains(summaryTxt, "Total Aksi Peminat     : 6 interaksi") {
		t.Errorf("expected summary TXT to include legacy action fallback total=6, got:\n%s", summaryTxt)
	}
	if !strings.Contains(summaryTxt, "Nama Toko         : Toko Legacy Audit") {
		t.Errorf("expected sanitized single-line StoreTitle in summary TXT, got:\n%s", summaryTxt)
	}
	prodCSV := files["02_performa_katalog_item.csv"]
	if !strings.Contains(prodCSV, "'=cmd|") {
		t.Errorf("expected tab+formula cell neutralized in product CSV, got:\n%s", prodCSV)
	}
	if strings.Contains(prodCSV, ",40,") {
		t.Errorf("period 7d product CSV must not leak all-time view_count=40 when store has period traffic, got:\n%s", prodCSV)
	}
}
