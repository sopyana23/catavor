package handlers

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"catavor-backend/internal/models"
	"github.com/gofiber/fiber/v2"
)

// TestPortalLoginSeparation memverifikasi pemisahan pintu masuk autentikasi (Opsi 1 Stealth Mode):
// 1. Superadmin login melalui portal pengelola (portal: "admin") -> SUKSES 200 OK.
// 2. Superadmin login melalui portal merchant (portal: "merchant" / kosong) -> DITOLAK 401 Unauthorized (Stealth).
// 3. Merchant login melalui portal merchant (portal: "merchant" / kosong) -> SUKSES 200 OK.
// 4. Merchant login melalui portal pengelola (portal: "admin") -> DITOLAK 403 Forbidden (PORTAL_ACCESS_DENIED).
func TestPortalLoginSeparation(t *testing.T) {
	db := newTestDB(t)
	cfg := testCfg()

	// 1. Siapkan akun Superadmin & Merchant
	adminUser := models.User{
		Name:         "Super Admin Test",
		Email:        "superadmin@catavor.test",
		PlatformRole: "superadmin",
	}
	if err := adminUser.SetPassword("AdminSecret123!"); err != nil {
		t.Fatalf("SetPassword admin: %v", err)
	}
	if err := db.Create(&adminUser).Error; err != nil {
		t.Fatalf("Create adminUser: %v", err)
	}

	merchantUser := models.User{
		Name:         "Merchant Juragan Test",
		Email:        "juragan@catavor.test",
		PlatformRole: "merchant",
	}
	if err := merchantUser.SetPassword("MerchantSecret123!"); err != nil {
		t.Fatalf("SetPassword merchant: %v", err)
	}
	if err := db.Create(&merchantUser).Error; err != nil {
		t.Fatalf("Create merchantUser: %v", err)
	}

	merchantStore := models.Store{
		UserID:     merchantUser.ID,
		Slug:       "toko-juragan",
		StoreTitle: "Toko Juragan",
		Plan:       "free",
	}
	if err := db.Create(&merchantStore).Error; err != nil {
		t.Fatalf("Create merchantStore: %v", err)
	}

	// 2. Siapkan Fiber App dengan Handler Login
	app := fiber.New()
	authHandler := NewAuthHandler(cfg, db)
	app.Post("/api/login", authHandler.Login)

	// Kasus 1: Superadmin login di portal /admin (portal: "admin") -> Wajib 200 OK
	{
		body, _ := json.Marshal(map[string]interface{}{
			"email":    "superadmin@catavor.test",
			"password": "AdminSecret123!",
			"portal":   "admin",
		})
		req := httptest.NewRequest("POST", "/api/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("app.Test error: %v", err)
		}
		if resp.StatusCode != fiber.StatusOK {
			t.Errorf("Kasus 1: Superadmin login di /admin gagal, status: %d (ekspektasi 200)", resp.StatusCode)
		}
	}

	// Kasus 2: Superadmin login di portal merchant (portal: "merchant") -> Wajib 401 Unauthorized (Stealth Mode)
	{
		body, _ := json.Marshal(map[string]interface{}{
			"email":    "superadmin@catavor.test",
			"password": "AdminSecret123!",
			"portal":   "merchant",
		})
		req := httptest.NewRequest("POST", "/api/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("app.Test error: %v", err)
		}
		if resp.StatusCode != fiber.StatusUnauthorized {
			t.Errorf("Kasus 2: Superadmin di portal merchant seharusnya 401 (Stealth), dapat: %d", resp.StatusCode)
		}
		var resJson map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&resJson)
		if resJson["message"] != "Email atau kata sandi yang Anda masukkan salah." {
			t.Errorf("Kasus 2: Pesan error stealth tidak sesuai: %v", resJson["message"])
		}
	}

	// Kasus 3: Merchant login di portal merchant (portal: "merchant") -> Wajib 200 OK
	{
		body, _ := json.Marshal(map[string]interface{}{
			"email":    "juragan@catavor.test",
			"password": "MerchantSecret123!",
			"portal":   "merchant",
		})
		req := httptest.NewRequest("POST", "/api/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("app.Test error: %v", err)
		}
		if resp.StatusCode != fiber.StatusOK {
			t.Errorf("Kasus 3: Merchant login di portal merchant gagal, status: %d (ekspektasi 200)", resp.StatusCode)
		}
	}

	// Kasus 4: Merchant login di portal pengelola (portal: "admin") -> Wajib 403 Forbidden (PORTAL_ACCESS_DENIED)
	{
		body, _ := json.Marshal(map[string]interface{}{
			"email":    "juragan@catavor.test",
			"password": "MerchantSecret123!",
			"portal":   "admin",
		})
		req := httptest.NewRequest("POST", "/api/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("app.Test error: %v", err)
		}
		if resp.StatusCode != fiber.StatusForbidden {
			t.Errorf("Kasus 4: Merchant di portal /admin seharusnya 403 Forbidden, dapat: %d", resp.StatusCode)
		}
		var resJson map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&resJson)
		if resJson["code"] != "PORTAL_ACCESS_DENIED" {
			t.Errorf("Kasus 4: Code error tidak PORTAL_ACCESS_DENIED: %v", resJson["code"])
		}
	}
}
