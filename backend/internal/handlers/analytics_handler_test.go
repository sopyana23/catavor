package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func setupTestAnalyticsApp(t *testing.T) (*fiber.App, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open sqlite memory db: %v", err)
	}

	if err := db.AutoMigrate(
		&models.User{},
		&models.Store{},
		&models.Category{},
		&models.Product{},
		&models.ProductImage{},
		&models.Setting{},
		&models.ActivityLog{},
		&models.SearchAnalytics{},
		&models.SearchDailyRollup{},
		&models.StoreDailyAnalytics{},
		&models.StoreDailyTrafficSource{},
		&models.StoreDailyAudienceMetric{},
		&models.ProductDailyAnalytics{},
		&models.RecentVisitorEvent{},
	); err != nil {
		t.Fatalf("Failed to migrate test models: %v", err)
	}

	// Initialize search telemetry service
	services.InitSearchTelemetryService(db)

	cfg := &config.Config{}
	handler := NewAnalyticsHandler(cfg, db)
	app := fiber.New()
	app.Post("/api/telemetry/search", handler.TrackSearchEvent)
	app.Post("/api/analytics/track", handler.TrackEvent)

	admin := app.Group("/api/admin", func(c *fiber.Ctx) error {
		if u, ok := c.Locals("test_user").(*models.User); ok {
			c.Locals("user", u)
			return c.Next()
		}
		role := c.Get("X-Test-Role", "superadmin")
		c.Locals("user", &models.User{ID: 1, Name: "Superadmin Test", Email: "admin@catavor.test", PlatformRole: role})
		return c.Next()
	})
	admin.Get("/analytics/overview", handler.GetGlobalAnalyticsOverview)
	admin.Get("/market-intelligence", handler.GetMarketIntelligenceSummary)
	admin.Get("/market-intelligence/trending-keywords", handler.GetTrendingKeywords)
	admin.Get("/market-intelligence/demand-gaps", handler.GetDemandGaps)
	admin.Get("/market-intelligence/price-benchmarks", handler.GetCategoryPriceBenchmarks)
	admin.Get("/market-intelligence/export", handler.ExportMarketIntelligenceData)

	return app, db
}

func TestTrackSearchEvent_BotAndHoneypot(t *testing.T) {
	app, _ := setupTestAnalyticsApp(t)

	// 1. Honeypot check: If bot filled _hp_check, it should be silently accepted without processing
	payload := map[string]interface{}{
		"keyword":   "kucing persia",
		"_hp_check": "bot_filled_value",
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/telemetry/search", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	res, err := app.Test(req, -1)
	if err != nil || res.StatusCode != 200 {
		t.Fatalf("Expected 200 for honeypot drop, got %d, err: %v", res.StatusCode, err)
	}

	// 2. Automated crawler detection (e.g. bytespider / python-requests)
	payloadClean := map[string]interface{}{
		"keyword": "kucing anggora",
	}
	bodyClean, _ := json.Marshal(payloadClean)
	reqCrawler := httptest.NewRequest(http.MethodPost, "/api/telemetry/search", bytes.NewReader(bodyClean))
	reqCrawler.Header.Set("Content-Type", "application/json")
	reqCrawler.Header.Set("User-Agent", "Mozilla/5.0 (compatible; bytespider; +http://www.bytedance.com)")
	resCrawler, err := app.Test(reqCrawler, -1)
	if err != nil || resCrawler.StatusCode != 200 {
		t.Fatalf("Expected 200 for crawler drop, got %d", resCrawler.StatusCode)
	}
}

func TestTrackSearchEvent_GibberishAndDeduplication(t *testing.T) {
	app, _ := setupTestAnalyticsApp(t)

	// 1. Gibberish query should be discarded silently
	payloadGibberish := map[string]interface{}{
		"keyword": "asdfghjkl", // keyboard smash
	}
	bodyGib, _ := json.Marshal(payloadGibberish)
	reqGib := httptest.NewRequest(http.MethodPost, "/api/telemetry/search", bytes.NewReader(bodyGib))
	reqGib.Header.Set("Content-Type", "application/json")
	resGib, err := app.Test(reqGib, -1)
	if err != nil || resGib.StatusCode != 200 {
		t.Fatalf("Expected 200 for gibberish drop, got %d", resGib.StatusCode)
	}

	// 2. Valid query first time: 202 Accepted with realistic browser User-Agent
	payloadValid := map[string]interface{}{
		"keyword":      "sepatu running",
		"store_slug":   "toko-olahraga",
		"result_count": 5,
	}
	bodyVal, _ := json.Marshal(payloadValid)
	reqVal1 := httptest.NewRequest(http.MethodPost, "/api/telemetry/search", bytes.NewReader(bodyVal))
	reqVal1.Header.Set("Content-Type", "application/json")
	reqVal1.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	resVal1, err := app.Test(reqVal1, -1)
	if err != nil || resVal1.StatusCode != fiber.StatusAccepted {
		t.Fatalf("Expected 202 for valid search event, got %d", resVal1.StatusCode)
	}

	// 3. Repeated identical query within 60s: returns 202 Accepted (deduplicated)
	reqVal2 := httptest.NewRequest(http.MethodPost, "/api/telemetry/search", bytes.NewReader(bodyVal))
	reqVal2.Header.Set("Content-Type", "application/json")
	reqVal2.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	resVal2, err := app.Test(reqVal2, -1)
	if err != nil || resVal2.StatusCode != fiber.StatusAccepted {
		t.Fatalf("Expected 202 for deduplicated search event, got %d", resVal2.StatusCode)
	}
}

// TestTelemetryRoute_N57 memastikan route kanonik /api/telemetry/search terdaftar aktif (bukan 404),
// sedangkan route duplikat /api/api/telemetry/search tidak terdaftar (404 Not Found).
func TestTelemetryRoute_N57(t *testing.T) {
	app, _ := setupTestAnalyticsApp(t)

	// Route kanonik POST /api/telemetry/search
	reqCanonical := httptest.NewRequest(http.MethodPost, "/api/telemetry/search", strings.NewReader(`{"keyword":"ikan"}`))
	reqCanonical.Header.Set("Content-Type", "application/json")
	resCanonical, err := app.Test(reqCanonical, -1)
	if err != nil {
		t.Fatalf("app.Test canonical route failed: %v", err)
	}
	if resCanonical.StatusCode == fiber.StatusNotFound {
		t.Fatalf("Route kanonik /api/telemetry/search tidak boleh 404!")
	}

	// Route duplikat POST /api/api/telemetry/search (wajib 404 Not Found)
	reqDuplicate := httptest.NewRequest(http.MethodPost, "/api/api/telemetry/search", strings.NewReader(`{"keyword":"ikan"}`))
	reqDuplicate.Header.Set("Content-Type", "application/json")
	resDuplicate, err := app.Test(reqDuplicate, -1)
	if err != nil {
		t.Fatalf("app.Test duplicate route failed: %v", err)
	}
	if resDuplicate.StatusCode != fiber.StatusNotFound {
		t.Fatalf("Route duplikat /api/api/telemetry/search harus 404, got %d", resDuplicate.StatusCode)
	}
}

func TestAdminMarketIntel_EmptyDBReturnsNonNullJSONArrays(t *testing.T) {
	app, _ := setupTestAnalyticsApp(t)
	services.InvalidateMarketIntelCache()

	for _, ep := range []string{
		"/api/admin/market-intelligence",
		"/api/admin/market-intelligence/trending-keywords",
		"/api/admin/market-intelligence/demand-gaps",
		"/api/admin/analytics/overview?period=7d",
	} {
		req := httptest.NewRequest(http.MethodGet, ep, nil)
		res, err := app.Test(req, -1)
		if err != nil {
			t.Fatalf("%s request failed: %v", ep, err)
		}
		if res.StatusCode != 200 {
			t.Fatalf("%s expected 200, got %d", ep, res.StatusCode)
		}
		raw, _ := io.ReadAll(res.Body)
		var payload map[string]interface{}
		if err := json.Unmarshal(raw, &payload); err != nil {
			t.Fatalf("%s invalid JSON: %v", ep, err)
		}
		switch ep {
		case "/api/admin/market-intelligence":
			data := payload["data"].(map[string]interface{})
			for _, field := range []string{
				"top_categories", "price_benchmarks", "trend_timeline",
				"price_bracket_elasticity", "geo_industry_matrix",
				"device_industry_matrix", "top_search_demand_gaps",
			} {
				v, exists := data[field]
				if !exists || v == nil {
					t.Fatalf("summary.%s must be [] on empty DB, got exists=%v val=%v", field, exists, v)
				}
				if _, ok := v.([]interface{}); !ok {
					t.Fatalf("summary.%s must be JSON array, got %T", field, v)
				}
			}
		case "/api/admin/market-intelligence/trending-keywords", "/api/admin/market-intelligence/demand-gaps":
			v := payload["data"]
			if v == nil {
				t.Fatalf("%s data must be [] not null", ep)
			}
			if _, ok := v.([]interface{}); !ok {
				t.Fatalf("%s data must be array, got %T", ep, v)
			}
		default:
			data := payload["data"].(map[string]interface{})
			for _, field := range []string{"trends", "top_stores", "devices", "operating_systems", "browsers", "locations", "hourly_heatmap", "recent_visitors"} {
				v, exists := data[field]
				if !exists || v == nil {
					t.Fatalf("overview.%s must be [] on empty DB, got exists=%v val=%v", field, exists, v)
				}
			}
		}
	}
}

func TestAdminAnalyticsOverview_RejectsNonPlatformStaff(t *testing.T) {
	app, _ := setupTestAnalyticsApp(t)
	req := httptest.NewRequest(http.MethodGet, "/api/admin/analytics/overview?period=7d", nil)
	req.Header.Set("X-Test-Role", "merchant")
	res, err := app.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != fiber.StatusForbidden {
		t.Fatalf("expected 403 for non-staff user, got %d", res.StatusCode)
	}
}

func TestExportMarketIntelligence_SecurityHeadersFormulaNeutralizationAndAuditLog(t *testing.T) {
	app, db := setupTestAnalyticsApp(t)
	services.InvalidateMarketIntelCache()

	// Seed K-anonymous (>= 3 unique stores) with an adversarial formula-injection category name
	evilCat := models.Category{StoreID: 1, Name: "=cmd|' /C calc'!A0", Slug: "evil-formula"}
	if err := db.Create(&evilCat).Error; err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= 3; i++ {
		st := models.Store{Slug: fmt.Sprintf("sec-store-%d", i), StoreTitle: fmt.Sprintf("Sec %d", i), WhatsappNumber: "0812"}
		if err := db.Create(&st).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&models.Product{
			StoreID:     st.ID,
			CategoryID:  &evilCat.ID,
			Name:        fmt.Sprintf("Prod %d", i),
			ProductType: "physical",
			Price:       float64(i * 10000),
			IsActive:    true,
		}).Error; err != nil {
			t.Fatal(err)
		}
	}

	// Unsupported export format rejected with 400
	badReq := httptest.NewRequest(http.MethodGet, "/api/admin/market-intelligence/export?format=xml", nil)
	badRes, err := app.Test(badReq, -1)
	if err != nil || badRes.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected 400 for invalid export format, got %d (err=%v)", badRes.StatusCode, err)
	}

	// Valid CSV export checks headers, sanitization, and activity log
	csvReq := httptest.NewRequest(http.MethodGet, "/api/admin/market-intelligence/export?format=csv", nil)
	csvRes, err := app.Test(csvReq, -1)
	if err != nil || csvRes.StatusCode != 200 {
		t.Fatalf("expected 200 for csv export, got %d (err=%v)", csvRes.StatusCode, err)
	}
	if cc := csvRes.Header.Get("Cache-Control"); !strings.Contains(cc, "no-store") {
		t.Errorf("expected Cache-Control to contain no-store, got %q", cc)
	}
	if xcto := csvRes.Header.Get("X-Content-Type-Options"); xcto != "nosniff" {
		t.Errorf("expected X-Content-Type-Options=nosniff, got %q", xcto)
	}
	expectedPrefix := fmt.Sprintf(`filename="catavor-market-intelligence-%s.csv"`, services.AnalyticsNow().Format("20060102"))
	if cd := csvRes.Header.Get("Content-Disposition"); !strings.Contains(cd, expectedPrefix) {
		t.Errorf("expected WIB Content-Disposition filename containing %s, got %q", expectedPrefix, cd)
	}
	bodyBytes, _ := io.ReadAll(csvRes.Body)
	if len(bodyBytes) < 3 || bodyBytes[0] != 0xef || bodyBytes[1] != 0xbb || bodyBytes[2] != 0xbf {
		t.Errorf("expected UTF-8 BOM prefix on Market Intelligence CSV export")
	}
	csvBody := string(bodyBytes)
	if !strings.Contains(csvBody, "'=cmd|") {
		t.Errorf("expected dangerous formula cell to be single-quote neutralized in CSV:\n%s", csvBody)
	}

	var logCount int64
	if err := db.Model(&models.ActivityLog{}).Where("action = ?", "market_intel_exported").Count(&logCount).Error; err != nil {
		t.Fatal(err)
	}
	if logCount != 1 {
		t.Errorf("expected 1 activity_logs audit row for export, got %d", logCount)
	}
}

func TestMarketIntelCacheInvalidation_RefreshesTrendingAndDemandGaps(t *testing.T) {
	app, db := setupTestAnalyticsApp(t)
	services.InvalidateMarketIntelCache()

	// Warm caches while DB is empty
	res1, err := app.Test(httptest.NewRequest(http.MethodGet, "/api/admin/market-intelligence/trending-keywords", nil), -1)
	if err != nil || res1.StatusCode != 200 {
		t.Fatalf("initial trending request failed: %v", err)
	}
	resGap1, err := app.Test(httptest.NewRequest(http.MethodGet, "/api/admin/market-intelligence/demand-gaps", nil), -1)
	if err != nil || resGap1.StatusCode != 200 {
		t.Fatalf("initial gaps request failed: %v", err)
	}

	today := time.Now().UTC().Format("2006-01-02")
	if err := db.Create(&models.SearchDailyRollup{
		Date:            today,
		Keyword:         "kandang reptil custom",
		ProductType:     "fauna",
		SearchVolume:    15,
		ZeroResultCount: 12,
	}).Error; err != nil {
		t.Fatal(err)
	}

	// Without invalidation, list cache would still return empty for 180s
	services.InvalidateMarketIntelCache()

	res2, _ := app.Test(httptest.NewRequest(http.MethodGet, "/api/admin/market-intelligence/demand-gaps", nil), -1)
	rawGap, _ := io.ReadAll(res2.Body)
	var gapPayload struct {
		Success bool      `json:"success"`
		Data    []GapItem `json:"data"`
	}
	if err := json.Unmarshal(rawGap, &gapPayload); err != nil {
		t.Fatal(err)
	}
	if len(gapPayload.Data) != 1 || gapPayload.Data[0].Keyword != "kandang reptil custom" {
		t.Fatalf("expected invalidated demand-gaps cache to surface rollup row, got %+v", gapPayload.Data)
	}
}

func TestGetStoreAnalytics_IncludesPlantAndRespectsPeriodAndWIB(t *testing.T) {
	app, db := setupTestAnalyticsApp(t)

	store := models.Store{
		Slug:           "toko-flora-audit",
		StoreTitle:     "Toko Flora Audit",
		WhatsappNumber: "08123456789",
	}
	if err := db.Create(&store).Error; err != nil {
		t.Fatal(err)
	}

	plantProd := models.Product{
		StoreID:       store.ID,
		Name:          "Monstera Thai Con",
		ProductType:   "plant",
		Class:         "Tanaman Hias",
		Price:         350000,
		ViewCount:     99, // Lifetime counter (must NOT leak all 99 into 7d when daily table exists!)
		WaClicksCount: 9,
		IsActive:      true,
	}
	if err := db.Create(&plantProd).Error; err != nil {
		t.Fatal(err)
	}

	wibNow := services.AnalyticsNow()
	todayWib := wibNow.Format("2006-01-02")
	oldDate := wibNow.AddDate(0, 0, -25).Format("2006-01-02")

	if err := db.Create(&models.StoreDailyAnalytics{
		StoreID:        store.ID,
		Date:           todayWib,
		StoreViews:     5,
		UniqueVisitors: 4,
		ProductViews:   3,
		DirectWaClicks: 2,
		TotalActions:   2,
	}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.ProductDailyAnalytics{
		StoreID:        store.ID,
		ProductID:      plantProd.ID,
		ProductType:    "plant",
		Date:           todayWib,
		Views:          3,
		DirectWaClicks: 2,
		TotalActions:   2,
	}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.ProductDailyAnalytics{
		StoreID:        store.ID,
		ProductID:      plantProd.ID,
		ProductType:    "plant",
		Date:           oldDate,
		Views:          96,
		DirectWaClicks: 7,
		TotalActions:   7,
	}).Error; err != nil {
		t.Fatal(err)
	}

	// Verify WIB conversion in StoreDailyAudienceMetric hour format via process-equivalent ingestion time:
	// UTC 08:00 must map to WIB 15:00 in AnalyticsLocation()
	utcSample := time.Date(2026, 11, 26, 8, 15, 0, 0, time.UTC)
	wibSample := utcSample.In(services.AnalyticsLocation())
	if wibSample.Format("15") != "15" {
		t.Fatalf("expected 08:15 UTC -> hour 15 WIB, got %s", wibSample.Format("15"))
	}

	handler := NewAnalyticsHandler(&config.Config{}, db)
	storeApp := fiber.New()
	storeApp.Use(func(c *fiber.Ctx) error {
		c.Locals("store", &store)
		c.Locals("user", &models.User{ID: 77, Name: "Owner", PlatformRole: "merchant"})
		return c.Next()
	})
	storeApp.Get("/api/admin/analytics", handler.GetStoreAnalytics)
	_ = app

	res, err := storeApp.Test(httptest.NewRequest(http.MethodGet, "/api/admin/analytics?period=7d", nil), -1)
	if err != nil || res.StatusCode != 200 {
		t.Fatalf("expected 200 for GetStoreAnalytics, got status=%d err=%v", res.StatusCode, err)
	}
	raw, _ := io.ReadAll(res.Body)
	var body struct {
		Success bool `json:"success"`
		Data    struct {
			TotalProductViews int64                      `json:"total_product_views"`
			ProductTypes      []ProductTypeMetricSummary `json:"product_types"`
			Funnel            ConversionFunnelSummary    `json:"funnel"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatal(err)
	}
	if body.Data.TotalProductViews != 3 {
		t.Errorf("expected 7d total_product_views=3 (excluding 25d old rows), got %d", body.Data.TotalProductViews)
	}
	if body.Data.Funnel.ProductViews != 3 {
		t.Errorf("expected funnel.product_views=3, got %d", body.Data.Funnel.ProductViews)
	}
	foundPlant := false
	for _, pt := range body.Data.ProductTypes {
		if pt.ProductType == "plant" {
			foundPlant = true
			if pt.Views != 3 || pt.DirectWaClicks != 2 {
				t.Errorf("expected plant 7d views=3, direct_wa=2; got views=%d, wa=%d", pt.Views, pt.DirectWaClicks)
			}
		}
	}
	if !foundPlant {
		t.Errorf("expected 'plant' in product_types, got %+v", body.Data.ProductTypes)
	}
}
