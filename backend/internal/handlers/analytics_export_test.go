package handlers

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupAnalyticsExportTestApp(t *testing.T) (*fiber.App, *gorm.DB, *AnalyticsHandler) {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("failed to open sqlite: %v", err)
	}

	_ = db.AutoMigrate(
		&models.User{},
		&models.Store{},
		&models.Category{},
		&models.Product{},
		&models.ProductDailyAnalytics{},
		&models.StoreDailyAnalytics{},
		&models.StoreDailyTrafficSource{},
		&models.StoreDailyAudienceMetric{},
		&models.ActivityLog{},
	)

	cfg := &config.Config{
		AppEnv: "testing",
	}

	h := NewAnalyticsHandler(cfg, db)

	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
	})

	// Setup mock auth & store context injector middleware for testing
	app.Use(func(c *fiber.Ctx) error {
		storeID := c.Get("X-Test-Store-ID")
		if storeID != "" {
			var st models.Store
			if err := db.First(&st, "id = ?", storeID).Error; err == nil {
				c.Locals("store", &st)
			}
		}

		userRole := c.Get("X-Test-User-Role")
		if userRole != "" {
			u := &models.User{
				ID:           1,
				Name:         "Merchant Test",
				Email:        "merchant@test.com",
				PlatformRole: userRole,
			}
			c.Locals("user", u)
		}

		return c.Next()
	})

	app.Get("/api/admin/analytics/export", h.ExportStoreAnalytics)

	return app, db, h
}

func TestExportStoreAnalytics_SuspendedStoreBlocked(t *testing.T) {
	app, db, _ := setupAnalyticsExportTestApp(t)

	// Create suspended store
	st := &models.Store{
		ID:             99,
		Slug:           "toko-banned",
		DormancyStatus: "banned",
		IsBlacklisted:  true,
	}
	db.Create(st)

	req := httptest.NewRequest(http.MethodGet, "/api/admin/analytics/export?period=30d&type=daily", nil)
	req.Header.Set("X-Test-Store-ID", "99")
	req.Header.Set("X-Test-User-Role", "merchant")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test error: %v", err)
	}

	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("Expected status 403 Forbidden for banned store, got %d", resp.StatusCode)
	}

	bodyBytes, _ := io.ReadAll(resp.Body)
	var body map[string]interface{}
	_ = json.Unmarshal(bodyBytes, &body)
	if body["code"] != "STORE_SUSPENDED" {
		t.Errorf("Expected error code STORE_SUSPENDED, got %v", body["code"])
	}
}

func TestExportStoreAnalytics_DailyStreamingCSV(t *testing.T) {
	app, db, _ := setupAnalyticsExportTestApp(t)

	st := &models.Store{
		ID:         100,
		Slug:       "toko-aktif-daily",
		StoreTitle: "Toko Aktif Daily",
	}
	db.Create(st)

	today := time.Now().Format("2006-01-02")
	db.Create(&models.StoreDailyAnalytics{
		StoreID:           100,
		Date:              today,
		UniqueVisitors:    42,
		StoreViews:        150,
		ProductViews:      90,
		Bounces:           10,
		WaClicks:          25,
		DirectWaClicks:    25,
		MarketplaceClicks: 10,
		TotalActions:      35,
	})

	req := httptest.NewRequest(http.MethodGet, "/api/admin/analytics/export?period=7d&type=daily", nil)
	req.Header.Set("X-Test-Store-ID", "100")
	req.Header.Set("X-Test-User-Role", "merchant")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test error: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", resp.StatusCode)
	}

	ctype := resp.Header.Get("Content-Type")
	if !strings.Contains(ctype, "text/csv") {
		t.Errorf("Expected text/csv content type, got %s", ctype)
	}

	disposition := resp.Header.Get("Content-Disposition")
	if !strings.Contains(disposition, "attachment; filename=") || !strings.Contains(disposition, "daily") {
		t.Errorf("Unexpected Content-Disposition header: %s", disposition)
	}

	bodyBytes, _ := io.ReadAll(resp.Body)
	bodyStr := string(bodyBytes)

	// UTF-8 BOM
	if !strings.HasPrefix(bodyStr, "\xef\xbb\xbf") {
		t.Errorf("Expected UTF-8 BOM in daily CSV export")
	}

	// Modern columns
	if !strings.Contains(bodyStr, "Pengunjung Unik") || !strings.Contains(bodyStr, "Rasio Pantulan (%)") {
		t.Errorf("Daily CSV export missing modern columns: %s", bodyStr)
	}

	// Content data
	if !strings.Contains(bodyStr, today) || !strings.Contains(bodyStr, "42") || !strings.Contains(bodyStr, "150") {
		t.Errorf("Daily CSV export missing row data: %s", bodyStr)
	}
}

func TestExportStoreAnalytics_FullPackageZIP(t *testing.T) {
	app, db, _ := setupAnalyticsExportTestApp(t)

	st := &models.Store{
		ID:         200,
		Slug:       "toko-aktif-zip",
		StoreTitle: "Toko Aktif ZIP",
	}
	db.Create(st)

	today := time.Now().Format("2006-01-02")
	db.Create(&models.StoreDailyAnalytics{
		StoreID:        200,
		Date:           today,
		UniqueVisitors: 88,
		StoreViews:     200,
		TotalActions:   40,
	})

	req := httptest.NewRequest(http.MethodGet, "/api/admin/analytics/export?period=30d&type=package", nil)
	req.Header.Set("X-Test-Store-ID", "200")
	req.Header.Set("X-Test-User-Role", "merchant")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test error: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", resp.StatusCode)
	}

	ctype := resp.Header.Get("Content-Type")
	if ctype != "application/zip" {
		t.Errorf("Expected application/zip, got %s", ctype)
	}

	bodyBytes, _ := io.ReadAll(resp.Body)
	zipReader, err := zip.NewReader(bytes.NewReader(bodyBytes), int64(len(bodyBytes)))
	if err != nil {
		t.Fatalf("Failed to parse zip archive: %v", err)
	}

	expected := map[string]bool{
		"00_RINGKASAN_EKSEKUTIF.txt":             false,
		"01_tren_kunjungan_dan_konversi.csv":     false,
		"02_performa_katalog_item.csv":           false,
		"03_sumber_trafik_dan_rujukan.csv":       false,
		"04_demografi_dan_teknologi_audiens.csv": false,
		"05_distribusi_jam_ramai_24_jam.csv":     false,
	}
	for _, f := range zipReader.File {
		if _, ok := expected[f.Name]; ok {
			expected[f.Name] = true
		}
	}
	for name, seen := range expected {
		if !seen {
			t.Errorf("ZIP archive missing expected entry %q", name)
		}
	}
}
