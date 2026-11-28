package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupSafeDomainTestEnv(t *testing.T) (*gorm.DB, *fiber.App) {
	t.Helper()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("gagal membuka sqlite test db: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.SafeDomain{}, &models.ActivityLog{}); err != nil {
		t.Fatalf("gagal automigrate safe_domains test: %v", err)
	}

	admin := &models.User{
		Name:         "Admin SafeDomain",
		Email:        "safedomain-admin@catavor.test",
		PlatformRole: "superadmin",
	}
	if err := db.Create(admin).Error; err != nil {
		t.Fatalf("gagal membuat admin fixture: %v", err)
	}

	h := NewSafeDomainHandler(db)
	app := fiber.New()
	app.Get("/api/public/safe-domains", h.GetPublicSafeDomains)
	app.Use("/api/admin/safe-domains", func(c *fiber.Ctx) error {
		c.Locals("user", admin)
		return c.Next()
	})
	app.Get("/api/admin/safe-domains", h.GetAdminSafeDomains)
	app.Post("/api/admin/safe-domains", h.CreateSafeDomain)
	app.Put("/api/admin/safe-domains/:id", h.UpdateSafeDomain)
	app.Delete("/api/admin/safe-domains/:id", h.DeleteSafeDomain)
	app.Post("/api/admin/safe-domains/reset-defaults", h.ResetDefaultSafeDomains)

	return db, app
}

func TestSafeDomainHandler_ValidationIDNInactiveFlagAndConflict(t *testing.T) {
	db, app := setupSafeDomainTestEnv(t)

	invalidPayloads := []string{
		`{"domain":""}`,
		`{"domain":"javascript:alert(1)"}`,
		`{"domain":"data:text/html,hi"}`,
		`{"domain":"//evil.com"}`,
		`{"domain":"catavor.com@evil.com"}`,
		`{"domain":"*.evil.com"}`,
		`{"domain":"bad host.com"}`,
		`{"domain":"[::1]"}`,
		`{"domain":"localhost-only"}`,
		`{"domain":"example.123"}`,
	}
	for _, body := range invalidPayloads {
		req := httptest.NewRequest(http.MethodPost, "/api/admin/safe-domains", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req, 5000)
		if err != nil {
			t.Fatalf("request %s error: %v", body, err)
		}
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("payload %s -> status %d, want 400", body, resp.StatusCode)
		}
	}

	// Create domain with explicit is_active=false + scheme + www + query
	reqCreate := httptest.NewRequest(http.MethodPost, "/api/admin/safe-domains", bytes.NewBufferString(`{
		"domain":"https://WWW.Zoom.US:443/j/123?pwd=abc",
		"category":"Komunikasi",
		"description":"Meeting",
		"is_active":false
	}`))
	reqCreate.Header.Set("Content-Type", "application/json")
	respCreate, _ := app.Test(reqCreate, 5000)
	if respCreate.StatusCode != http.StatusCreated {
		t.Fatalf("create valid normalized domain -> %d, want 201", respCreate.StatusCode)
	}
	var createdWrap struct {
		Success bool              `json:"success"`
		Data    models.SafeDomain `json:"data"`
	}
	_ = json.NewDecoder(respCreate.Body).Decode(&createdWrap)
	if createdWrap.Data.Domain != "zoom.us" {
		t.Fatalf("normalized domain = %q, want zoom.us", createdWrap.Data.Domain)
	}
	if createdWrap.Data.IsActive {
		t.Fatalf("expected IsActive=false when explicitly passed")
	}

	// IDN domain converts cleanly to ASCII punycode
	reqIDN := httptest.NewRequest(http.MethodPost, "/api/admin/safe-domains", bytes.NewBufferString(`{
		"domain":"bücher.example",
		"category":"Mitra"
	}`))
	reqIDN.Header.Set("Content-Type", "application/json")
	respIDN, _ := app.Test(reqIDN, 5000)
	if respIDN.StatusCode != http.StatusCreated {
		t.Fatalf("create IDN domain -> %d, want 201", respIDN.StatusCode)
	}
	var idnWrap struct {
		Data models.SafeDomain `json:"data"`
	}
	_ = json.NewDecoder(respIDN.Body).Decode(&idnWrap)
	if idnWrap.Data.Domain != "xn--bcher-kva.example" {
		t.Fatalf("IDN domain = %q, want xn--bcher-kva.example", idnWrap.Data.Domain)
	}
	if !idnWrap.Data.IsActive {
		t.Fatalf("expected omitted is_active to default to true")
	}

	// Update conflict -> 409; empty domain -> 400
	reqEmptyUpd := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/admin/safe-domains/%d", idnWrap.Data.ID), bytes.NewBufferString(`{"domain":"  "}`))
	reqEmptyUpd.Header.Set("Content-Type", "application/json")
	if resp, _ := app.Test(reqEmptyUpd, 5000); resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("update empty domain -> %d, want 400", resp.StatusCode)
	}

	reqConflict := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/admin/safe-domains/%d", idnWrap.Data.ID), bytes.NewBufferString(`{"domain":"www.zoom.us"}`))
	reqConflict.Header.Set("Content-Type", "application/json")
	if resp, _ := app.Test(reqConflict, 5000); resp.StatusCode != http.StatusConflict {
		t.Fatalf("update duplicate domain -> %d, want 409", resp.StatusCode)
	}

	// Verify Public returns only active domains and Admin returns global stats
	respPub, _ := app.Test(httptest.NewRequest(http.MethodGet, "/api/public/safe-domains", nil), 5000)
	var pubWrap struct {
		Data []string `json:"data"`
	}
	_ = json.NewDecoder(respPub.Body).Decode(&pubWrap)
	if len(pubWrap.Data) != 1 || pubWrap.Data[0] != "xn--bcher-kva.example" {
		t.Fatalf("public safe-domains = %+v, want only active punycode domain", pubWrap.Data)
	}

	respAdmin, _ := app.Test(httptest.NewRequest(http.MethodGet, "/api/admin/safe-domains?q=%25_unused&limit=1", nil), 5000)
	var adminEscWrap struct {
		Data []models.SafeDomain `json:"data"`
	}
	_ = json.NewDecoder(respAdmin.Body).Decode(&adminEscWrap)
	if len(adminEscWrap.Data) != 0 {
		t.Fatalf("SQL LIKE wildcard was not escaped: matched %d rows for %%_unused", len(adminEscWrap.Data))
	}

	respStats, _ := app.Test(httptest.NewRequest(http.MethodGet, "/api/admin/safe-domains?page=1&limit=1", nil), 5000)
	var statsWrap struct {
		Stats struct {
			Total  int64 `json:"total"`
			Active int64 `json:"active"`
			System int64 `json:"system"`
			Custom int64 `json:"custom"`
		} `json:"stats"`
	}
	_ = json.NewDecoder(respStats.Body).Decode(&statsWrap)
	if statsWrap.Stats.Total != 2 || statsWrap.Stats.Active != 1 || statsWrap.Stats.Custom != 2 {
		t.Fatalf("unexpected global stats: %+v", statsWrap.Stats)
	}
	_ = db
}

func TestSafeDomainHandler_ProtectsSystemDomainDeletionAndResetDefaults(t *testing.T) {
	db, app := setupSafeDomainTestEnv(t)

	// Seed defaults via ResetDefaultSafeDomains
	respReset, _ := app.Test(httptest.NewRequest(http.MethodPost, "/api/admin/safe-domains/reset-defaults", nil), 5000)
	if respReset.StatusCode != http.StatusOK {
		t.Fatalf("reset-defaults status=%d, want 200", respReset.StatusCode)
	}

	var sysDom models.SafeDomain
	if err := db.Where("domain = ?", "catavor.com").First(&sysDom).Error; err != nil {
		t.Fatalf("catavor.com not seeded by reset-defaults: %v", err)
	}
	if !sysDom.IsSystem || !sysDom.IsActive {
		t.Fatalf("expected catavor.com IsSystem=true IsActive=true, got %+v", sysDom)
	}

	// Deleting system domain must be blocked with 403 Forbidden
	respDelSys, _ := app.Test(httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/admin/safe-domains/%d", sysDom.ID), nil), 5000)
	if respDelSys.StatusCode != http.StatusForbidden {
		t.Fatalf("delete system domain -> status %d, want 403", respDelSys.StatusCode)
	}

	// System domain still exists in DB
	var count int64
	db.Model(&models.SafeDomain{}).Where("id = ?", sysDom.ID).Count(&count)
	if count != 1 {
		t.Fatalf("system domain was deleted despite 403!")
	}
}
