package handlers

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupPolicyTestApp(t *testing.T) (*fiber.App, *gorm.DB, *SettingHandler) {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("failed to open sqlite: %v", err)
	}

	_ = db.AutoMigrate(
		&models.User{},
		&models.Setting{},
		&models.PolicyVersion{},
		&models.PolicyAuditLog{},
		&models.UserPolicyAgreement{},
	)

	h := NewSettingHandler(db)

	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
	})

	return app, db, h
}

func TestSettingHandler_PoliciesLazyHydrationAndAliases(t *testing.T) {
	app, _, h := setupPolicyTestApp(t)

	app.Get("/api/policies", h.GetPolicies)

	req := httptest.NewRequest("GET", "/api/policies", nil)
	resp, err := app.Test(req, 5000)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var res struct {
		Success bool                            `json:"success"`
		Data    map[string]models.PolicyVersion `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if !res.Success {
		t.Fatalf("expected success true")
	}

	// Verify all 6 pillars exist + acceptable_use alias
	expectedKeys := []string{"terms", "prohibited", "privacy", "moderation", "transactions", "subscription", "acceptable_use"}
	for _, k := range expectedKeys {
		p, exists := res.Data[k]
		if !exists {
			t.Errorf("expected policy key '%s' to exist in policies response", k)
			continue
		}
		if p.Title == "" {
			t.Errorf("expected non-empty title for '%s'", k)
		}
		if len(p.Content) == 0 {
			t.Errorf("expected non-empty markdown content for '%s'", k)
		}
		if len(p.Sections) == 0 {
			t.Errorf("expected non-empty structured sections for '%s'", k)
		}
	}
}

func TestSettingHandler_UpdatePolicyAndAuditLog(t *testing.T) {
	app, db, h := setupPolicyTestApp(t)

	adminUser := &models.User{
		ID:           99,
		Email:        "legal.admin@catavor.com",
		PlatformRole: "superadmin",
	}
	db.Create(adminUser)

	// Protected route with user injection
	app.Post("/api/admin/settings/policies", func(c *fiber.Ctx) error {
		c.Locals("user", adminUser)
		return h.UpdatePolicy(c)
	})

	secData := database.PolicySectionData{
		Category: "Ketentuan Khusus",
		Badge:    "Edisi Khusus",
		Summary:  "Ringkasan pembaruan klausul transaksi.",
		Articles: []database.PolicyArticle{
			{
				Number:  "Pasal 1",
				Heading: "Klausul Tambahan Kepatuhan",
				Content: "Seluruh pengelola wajib mematuhi aturan baru.",
				Highlights: []string{
					"Poin kepatuhan 1",
					"Poin kepatuhan 2",
				},
			},
		},
	}
	secBytes, _ := json.Marshal(secData)

	updatePayload := map[string]interface{}{
		"type":                "terms",
		"title":               "Syarat & Ketentuan Layanan Versi 2.5",
		"version":             "v2.5",
		"sections":            json.RawMessage(secBytes),
		"summary_of_changes":  "Penambahan klausul kepatuhan edisi 2.5",
		"change_type":         "minor",
		"requires_acceptance": true,
	}
	bodyBytes, _ := json.Marshal(updatePayload)

	req := httptest.NewRequest("POST", "/api/admin/settings/policies", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req, 5000)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	// Verify DB record
	var activeTerms models.PolicyVersion
	if err := db.Where("type = ? AND is_active = true", "terms").First(&activeTerms).Error; err != nil {
		t.Fatalf("failed to query active terms: %v", err)
	}
	if activeTerms.Version != "v2.5" {
		t.Errorf("expected version v2.5, got %s", activeTerms.Version)
	}
	// Verify auto-synthesized markdown content
	if len(activeTerms.Content) == 0 || !bytes.Contains([]byte(activeTerms.Content), []byte("Klausul Tambahan Kepatuhan")) {
		t.Errorf("expected auto-synthesized markdown content containing article heading, got: %s", activeTerms.Content)
	}

	// Verify SOC 2 audit log
	var auditLog models.PolicyAuditLog
	if err := db.Where("policy_type = ? AND action = ?", "terms", "update").Order("id desc").First(&auditLog).Error; err != nil {
		t.Fatalf("failed to query audit log: %v", err)
	}
	if auditLog.NewVersion != "v2.5" {
		t.Errorf("expected audit log new version v2.5, got %s", auditLog.NewVersion)
	}
	if auditLog.AdminEmail != "legal.admin@catavor.com" {
		t.Errorf("expected admin email legal.admin@catavor.com, got %s", auditLog.AdminEmail)
	}
}

func TestSettingHandler_ResetDefaultPolicies(t *testing.T) {
	app, db, h := setupPolicyTestApp(t)

	adminUser := &models.User{
		ID:           99,
		Email:        "superadmin@catavor.com",
		PlatformRole: "superadmin",
	}
	db.Create(adminUser)

	app.Post("/api/admin/settings/policies/reset-defaults", func(c *fiber.Ctx) error {
		c.Locals("user", adminUser)
		return h.ResetDefaultPolicies(c)
	})

	resetPayload := map[string]interface{}{
		"type": "all",
	}
	bodyBytes, _ := json.Marshal(resetPayload)

	req := httptest.NewRequest("POST", "/api/admin/settings/policies/reset-defaults", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req, 5000)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var auditCount int64
	db.Model(&models.PolicyAuditLog{}).Where("action = ?", "reset_defaults").Count(&auditCount)
	if auditCount == 0 {
		t.Errorf("expected audit log recorded for reset_defaults")
	}
}

func TestSettingHandler_PublicLegalSettingsFallbacks(t *testing.T) {
	app, _, h := setupPolicyTestApp(t)

	app.Get("/api/settings/public", h.PublicIndex)

	req := httptest.NewRequest("GET", "/api/settings/public", nil)
	resp, err := app.Test(req, 5000)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var res struct {
		Success bool              `json:"success"`
		Data    map[string]string `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if res.Data["legal_entity_name"] != "PT Catavor Media Digital" {
		t.Errorf("expected fallback legal_entity_name 'PT Catavor Media Digital', got '%s'", res.Data["legal_entity_name"])
	}
	if res.Data["legal_jurisdiction"] != "Hukum Republik Indonesia" {
		t.Errorf("expected fallback legal_jurisdiction 'Hukum Republik Indonesia', got '%s'", res.Data["legal_jurisdiction"])
	}
	if len(res.Data["legal_warning_banner"]) == 0 {
		t.Errorf("expected non-empty legal_warning_banner")
	}
}
