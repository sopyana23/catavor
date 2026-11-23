package services

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openMarketIntelTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Store{},
		&models.Category{},
		&models.Product{},
		&models.ProductImage{},
		&models.StoreDailyAnalytics{},
		&models.ProductDailyAnalytics{},
		&models.StoreDailyAudienceMetric{},
		&models.SearchAnalytics{},
		&models.SearchDailyRollup{},
		&models.RecentVisitorEvent{},
	); err != nil {
		t.Fatalf("failed to migrate test models: %v", err)
	}
	return db
}

func TestIsValidSearchKeyword_RejectsPIIAndAllowsProductSpecs(t *testing.T) {
	piiQueries := []string{
		"budi@gmail.com",
		"admin@catavor.co.id",
		"081234567890",
		"+62 812-3456-7890",
		"3201123456780001",
		"https://wa.me/628123456789",
		"www.tokoku.com/promo",
		"hubungi 08129998887",
	}
	for _, q := range piiQueries {
		if IsValidSearchKeyword(q) {
			t.Errorf("expected PII/URL keyword %q to be rejected", q)
		}
	}

	validQueries := []string{
		"kucing persia",
		"beras 10kg",
		"rumah 2026",
		"ram 16gb ddr4",
		"ac 1 pk",
		"tanah 100m2",
	}
	for _, q := range validQueries {
		if !IsValidSearchKeyword(q) {
			t.Errorf("expected valid catalog query %q to be accepted", q)
		}
	}
}

func TestGetMacroMarketSummary_EmptyDBNonNilSlicesAndKAnonymity(t *testing.T) {
	db := openMarketIntelTestDB(t)
	InvalidateMarketIntelCache()

	summary, err := GetMacroMarketSummary(db)
	if err != nil {
		t.Fatalf("GetMacroMarketSummary failed on empty DB: %v", err)
	}
	if summary.KAnonymityMinStores != KAnonymityMinStores {
		t.Fatalf("expected KAnonymityMinStores=%d, got %d", KAnonymityMinStores, summary.KAnonymityMinStores)
	}
	if summary.TopCategories == nil || summary.PriceBenchmarks == nil || summary.TrendTimeline == nil ||
		summary.PriceBracketElasticity == nil || summary.GeoIndustryMatrix == nil ||
		summary.DeviceIndustryMatrix == nil || summary.TopSearchDemandGaps == nil {
		t.Fatalf("expected zero nil slices in MacroMarketSummary, got nil slice(s)")
	}
}

func TestGetMacroMarketSummary_NoAvgPriceFanOutAndStrictKAnonymity(t *testing.T) {
	db := openMarketIntelTestDB(t)
	InvalidateMarketIntelCache()

	catIncluded := models.Category{StoreID: 1, Name: "Burung Kicau", Slug: "burung-kicau"}
	catSmall := models.Category{StoreID: 1, Name: "Kategori Dua Toko", Slug: "kategori-dua-toko"}
	if err := db.Create(&catIncluded).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&catSmall).Error; err != nil {
		t.Fatal(err)
	}

	prices := []float64{100000, 200000, 300000}
	today := time.Now().UTC()
	var prodAID uint
	for i := 0; i < 3; i++ {
		st := models.Store{Slug: fmt.Sprintf("bird-%d", i+1), StoreTitle: fmt.Sprintf("Bird %d", i+1), WhatsappNumber: "0812"}
		if err := db.Create(&st).Error; err != nil {
			t.Fatal(err)
		}
		p := models.Product{
			StoreID:     st.ID,
			CategoryID:  &catIncluded.ID,
			Name:        fmt.Sprintf("Kenari %d", i+1),
			ProductType: "fauna",
			Price:       prices[i],
			IsActive:    true,
		}
		if err := db.Create(&p).Error; err != nil {
			t.Fatal(err)
		}
		if i == 0 {
			prodAID = p.ID
		}
	}

	// Give Product A (100k) 5 daily analytics rows — must NOT weight AVG(p.price) 5x!
	for d := 0; d < 5; d++ {
		dt := today.AddDate(0, 0, -d).Format("2006-01-02")
		if err := db.Create(&models.ProductDailyAnalytics{ProductID: prodAID, Date: dt, Views: 10, TotalActions: 2}).Error; err != nil {
			t.Fatal(err)
		}
	}

	// Category with only 2 unique stores must be excluded by K-Anonymity (>= 3 stores)
	for i := 0; i < 2; i++ {
		st := models.Store{Slug: fmt.Sprintf("small-%d", i+1), StoreTitle: fmt.Sprintf("Small %d", i+1), WhatsappNumber: "0813"}
		if err := db.Create(&st).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&models.Product{
			StoreID:     st.ID,
			CategoryID:  &catSmall.ID,
			Name:        fmt.Sprintf("Item %d", i+1),
			ProductType: "physical",
			Price:       50000,
			IsActive:    true,
		}).Error; err != nil {
			t.Fatal(err)
		}
	}

	summary, err := GetMacroMarketSummary(db)
	if err != nil {
		t.Fatalf("GetMacroMarketSummary failed: %v", err)
	}
	if len(summary.TopCategories) != 1 {
		t.Fatalf("expected 1 K-anonymous top category, got %d (%+v)", len(summary.TopCategories), summary.TopCategories)
	}
	tc := summary.TopCategories[0]
	if tc.CategoryName != "Burung Kicau" {
		t.Fatalf("expected Burung Kicau, got %q", tc.CategoryName)
	}
	if tc.AveragePrice != 200000 {
		t.Fatalf("expected exact unbiased AveragePrice=200000, got %.0f", tc.AveragePrice)
	}
	if tc.UniqueStoreCount != 3 || tc.ProductCount != 3 {
		t.Fatalf("expected 3 stores & 3 products, got stores=%d products=%d", tc.UniqueStoreCount, tc.ProductCount)
	}
	if tc.TotalViews != 50 || tc.TotalActions != 10 {
		t.Fatalf("expected TotalViews=50 TotalActions=10, got views=%d actions=%d", tc.TotalViews, tc.TotalActions)
	}
	if len(summary.PriceBenchmarks) != 1 || summary.PriceBenchmarks[0].MedianPrice != 200000 {
		t.Fatalf("expected 1 PriceBenchmark with MedianPrice=200000, got %+v", summary.PriceBenchmarks)
	}
}

func TestSanitizeMarketCSVCell_NeutralizesOWASPFormulas(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"=cmd|' /C calc'!A0", "'=cmd|' /C calc'!A0"},
		{"+SUM(A1:A2)", "'+SUM(A1:A2)"},
		{"-1+1", "'-1+1"},
		{"@SUM(1,2)", "'@SUM(1,2)"},
		{"\t=HYPERLINK(\"http://evil\")", "'=HYPERLINK(\"http://evil\")"},
		{"\t+1+1\n=SUM(A1)", "'+1+1 =SUM(A1)"},
		{"Kucing Persia", "Kucing Persia"},
	}
	for _, tc := range cases {
		got := sanitizeMarketCSVCell(tc.in)
		if got != tc.want {
			t.Errorf("sanitizeMarketCSVCell(%q) = %q, want %q", tc.in, got, tc.want)
		}
		if strings.ContainsAny(got, "\r\n") {
			t.Errorf("sanitizeMarketCSVCell(%q) retained newline in %q", tc.in, got)
		}
	}
}

func TestGenerateMarketIntelligenceCSV_Benchmark(t *testing.T) {
	t.Setenv("JWT_SECRET", "12345678901234567890123456789012")
	cfg := config.LoadConfig()
	db, err := database.InitDB(cfg)
	if err != nil {
		t.Skip("Database not available in this test environment")
		return
	}

	start := time.Now()
	data, err := GenerateMarketIntelligenceCSV(db)
	elapsed := time.Since(start)

	if err != nil {
		t.Fatalf("GenerateMarketIntelligenceCSV failed: %v", err)
	}

	t.Logf("CSV Generated in %v (Bytes: %d)", elapsed, len(data))
}
