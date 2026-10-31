package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

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
		&models.Store{},
		&models.Product{},
		&models.SearchAnalytics{},
		&models.StoreDailyAnalytics{},
		&models.StoreDailyTrafficSource{},
		&models.ProductDailyAnalytics{},
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
