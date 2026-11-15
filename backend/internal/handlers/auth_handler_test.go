package handlers

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
)

// TestRegister_PreFlightPaymentProofValidation menguji jaminan R4-L2:
// Validasi payment_proof_url dilakukan SEBELUM token OTP dikonsumsi dan SEBELUM baris User baru disimpan ke DB.
// Bila bukti bayar tidak valid, request ditolak 400, user TIDAK terbentuk, dan token OTP tetap belum hangus.
func TestRegister_PreFlightPaymentProofValidation(t *testing.T) {
	db := newTestDB(t)
	cfg := testCfg()
	otpSvc := services.InitOTPService(db)

	authH := NewAuthHandler(cfg, db)

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Post("/register", authH.Register)

	const testEmail = "calon.merchant@catavor.test"
	const validToken = "vt_preflight_test_token_12345"

	// Buat token OTP yang sah di DB
	otpRecord := models.EmailVerificationOTP{
		Email:     testEmail,
		OTPHash:   "hash_preflight_123",
		Purpose:   "registration",
		Token:     validToken,
		ExpiresAt: time.Now().Add(15 * time.Minute),
		CreatedAt: time.Now(),
	}
	if err := db.Create(&otpRecord).Error; err != nil {
		t.Fatalf("Gagal insert OTP token: %v", err)
	}

	// Payload registrasi dengan payment_proof_url tidak sah (bukan data:image/)
	payload := map[string]interface{}{
		"name":               "Calon Merchant",
		"email":              testEmail,
		"password":           "KombinasiAman123!",
		"verification_token": validToken,
		"store_slug":         "toko-sukses-2026",
		"store_title":        "Toko Sukses 2026",
		"whatsapp_number":    "081234567890",
		"plan":               "pro",
		"payment_proof_url":  "private/stores/1/billing/fake.png", // Tidak sah untuk registrasi baru
	}
	payloadBytes, _ := json.Marshal(payload)

	req := httptest.NewRequest(fiber.MethodPost, "/register", bytes.NewReader(payloadBytes))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req, 5000)
	if err != nil {
		t.Fatalf("app.Test error: %v", err)
	}

	// 1. Status wajib 400 Bad Request
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("status registrasi bukti salah = %d, want 400", resp.StatusCode)
	}

	// 2. Database check: Tidak boleh ada user baru terbentuk (orphan user dicegah)
	var userCount int64
	if err := db.Model(&models.User{}).Where("email = ?", testEmail).Count(&userCount).Error; err != nil {
		t.Fatalf("Gagal query count user: %v", err)
	}
	if userCount != 0 {
		t.Fatalf("User terbentuk padahal validasi pre-flight gagal! count = %d, want 0", userCount)
	}

	// 3. OTP Token check: Token belum dikonsumsi (record masih ada di DB)
	var checkToken models.EmailVerificationOTP
	if err := db.Where("email = ? AND token = ?", testEmail, validToken).First(&checkToken).Error; err != nil {
		t.Fatalf("OTP record hilang (terkonsumsi lebih awal): %v", err)
	}

	// Pastikan otpSvc masih bisa memvalidasi token tersebut karena belum hangus
	if !otpSvc.ValidateAndConsumeToken(testEmail, validToken, "registration") {
		t.Fatalf("Token OTP seharusnya masih valid untuk dikonsumsi!")
	}
}
