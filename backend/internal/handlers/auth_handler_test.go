package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/middleware"
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
	now := time.Now().UTC()
	otpRecord := models.EmailVerificationOTP{
		Email:     testEmail,
		OTPHash:   "hash_preflight_123",
		Purpose:   "registration",
		Token:     validToken,
		ExpiresAt: now.Add(15 * time.Minute),
		CreatedAt: now,
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

func TestCheckEmail_AntiEnumeration(t *testing.T) {
	db := newTestDB(t)
	cfg := testCfg()
	authH := NewAuthHandler(cfg, db)

	registered := models.User{Name: "Reg", Email: "terdaftar@catavor.test", Password: "hash"}
	mustCreate(t, db, &registered)
	blacklisted := models.User{Name: "Ban", Email: "banned@catavor.test", Password: "hash", IsBlacklisted: true}
	mustCreate(t, db, &blacklisted)

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Post("/api/auth/check-email", authH.CheckEmail)

	for _, em := range []string{"baru@catavor.test", "terdaftar@catavor.test", "banned@catavor.test"} {
		resp := call(t, app, http.MethodPost, "/api/auth/check-email", map[string]string{"email": em})
		if resp.Status != http.StatusOK {
			t.Fatalf("email %s status = %d, want 200", em, resp.Status)
		}
		if resp.Body["available"] != true {
			t.Fatalf("email %s available = %v, want neutral true", em, resp.Body["available"])
		}
	}

	bad := call(t, app, http.MethodPost, "/api/auth/check-email", map[string]string{"email": "bukan-email"})
	if bad.Status != http.StatusUnprocessableEntity {
		t.Fatalf("invalid email status = %d, want 422", bad.Status)
	}
}

func TestRegister_TxRollbackPreservesUserAndOTPToken(t *testing.T) {
	db := newTestDB(t)
	cfg := testCfg()
	_ = services.InitOTPService(db)
	authH := NewAuthHandler(cfg, db)

	mustCreate(t, db, &models.SubscriptionPlan{
		Code: "pro_starter", Name: "Pro Starter", PriceMonthly: 30000, IsActive: true,
	})

	const testEmail = "rollback.otp@catavor.test"
	const validToken = "vt_rollback_preserve_token"
	mustCreate(t, db, &models.EmailVerificationOTP{
		Email:     testEmail,
		OTPHash:   "hash_rb",
		Purpose:   "registration",
		Token:     validToken,
		ExpiresAt: time.Now().UTC().Add(15 * time.Minute),
		CreatedAt: time.Now().UTC(),
	})

	// Simulasi balapan kupon: ValidateCoupon di tx gagal karenaUsageCount sudah mencapai MaxUses
	// Catatan: ValidateCoupon non-tx juga akan menolak kupon UsageCount >= MaxUses di pre-flight;
	// uji penolakan konflik slug di dalam tx agar memastikan token + user rollback terjadi atomik.
	existingUser := models.User{Name: "Existing", Email: "owner.race@catavor.test", Password: "hash"}
	mustCreate(t, db, &existingUser)
	mustCreate(t, db, &models.Store{UserID: existingUser.ID, Slug: "toko-balap", StoreTitle: "Toko Balap", Plan: "free"})

	app := newTestApp(db)
	payload := map[string]interface{}{
		"name":               "Calon Merchant",
		"email":              testEmail,
		"password":           "KombinasiAman123!",
		"verification_token": validToken,
		"store_slug":         "toko-balap",
		"store_title":        "Toko Rollback",
		"whatsapp_number":    "081234567890",
		"plan":               "free",
	}
	r := call(t, app, http.MethodPost, "/api/auth/register", payload)
	if r.Status != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422 (%s)", r.Status, r.Raw)
	}

	var uCount int64
	db.Model(&models.User{}).Where("email = ?", testEmail).Count(&uCount)
	if uCount != 0 {
		t.Fatalf("orphan user count = %d, want 0", uCount)
	}

	// Token OTP masih ada (tidak hangus ketika slug ditolak)
	var tokCount int64
	db.Model(&models.EmailVerificationOTP{}).Where("email = ? AND token = ?", testEmail, validToken).Count(&tokCount)
	if tokCount != 1 {
		t.Fatalf("OTP token count = %d, want 1", tokCount)
	}
	_ = authH
}

func TestVerifyCoupon_RejectsFreeAndResolvesDynamicPlan(t *testing.T) {
	db := newTestDB(t)
	seedHardeningPlans(t, db)
	mustCreate(t, db, &models.SubscriptionPlan{
		Code: "pro_enterprise", Name: "Enterprise", PriceMonthly: 250000, MaxItems: -1, StorageLimitBytes: 50 << 30, IsActive: true,
	})
	mustCreate(t, db, &models.Coupon{
		Code: "HEMAT50", Label: "Potongan 50rb", Type: "discount", Discount: 50000, IsActive: true,
	})

	subH := NewSubscriptionHandler(db, testCfg())
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Post("/api/subscription/verify-coupon", subH.VerifyCoupon)

	freeResp := call(t, app, http.MethodPost, "/api/subscription/verify-coupon", map[string]string{
		"code": "HEMAT50",
		"plan": "free",
	})
	if freeResp.Status != http.StatusBadRequest {
		t.Fatalf("coupon on free status = %d, want 400 (%s)", freeResp.Status, freeResp.Raw)
	}

	dynResp := call(t, app, http.MethodPost, "/api/subscription/verify-coupon", map[string]string{
		"code": "HEMAT50",
		"plan": "pro_enterprise",
	})
	if dynResp.Status != http.StatusOK {
		t.Fatalf("coupon on dynamic plan status = %d, want 200 (%s)", dynResp.Status, dynResp.Raw)
	}
	couponObj, _ := dynResp.Body["coupon"].(map[string]any)
	if orig, _ := couponObj["original_price"].(float64); orig != 250000 {
		t.Fatalf("original_price = %.0f, want 250000 from DB plan", orig)
	}
	if fin, _ := couponObj["final_price"].(float64); fin != 200000 {
		t.Fatalf("final_price = %.0f, want 200000", fin)
	}
}

func TestRegister_GatewayAulaaFallbackSetsRequiresPaymentAction(t *testing.T) {
	db := newTestDB(t)
	seedHardeningPlans(t, db)
	seedRegistrationToken(t, db, "aulaa@catavor.test", "vt_aulaa_fb")
	mustCreate(t, db, &models.Setting{Key: "payment_system_mode", Value: "gateway_aulaa"})

	app := newTestApp(db)
	r := call(t, app, http.MethodPost, "/api/auth/register", map[string]interface{}{
		"name":               "Merchant Aulaa",
		"email":              "aulaa@catavor.test",
		"password":           "KombinasiAman123!",
		"verification_token": "vt_aulaa_fb",
		"store_slug":         "toko-aulaa-fb",
		"store_title":        "Toko Aulaa",
		"whatsapp_number":    "081234567890",
		"plan":               "pro_starter",
		"payment_method":     "qris",
	})
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d, want 200 (%s)", r.Status, r.Raw)
	}
	if r.Body["requires_payment_action"] != true {
		t.Fatalf("requires_payment_action = %v, want true when gateway fails to return payment_url", r.Body["requires_payment_action"])
	}
	if po, ok := r.Body["pending_order"].(map[string]any); !ok || po["order_number"] == "" {
		t.Fatalf("pending_order missing order_number: %v", r.Body["pending_order"])
	}
}

func TestSlugCheckRateLimiter_AndGoogleCaseBHardening(t *testing.T) {
	authSrc, err := bacaSumberHandler("auth_handler.go")
	if err != nil {
		t.Fatalf("read auth_handler.go: %v", err)
	}
	if !strings.Contains(authSrc, "models.BlacklistedSlug{}") {
		t.Error("GoogleAuth Case B / Register harus memeriksa models.BlacklistedSlug{}")
	}
	mainSrc, err := bacaSumberHandler("../../cmd/server/main.go")
	if err != nil {
		t.Fatalf("read main.go: %v", err)
	}
	if strings.Contains(mainSrc, `api.Get("/auth/check-email"`) || strings.Contains(mainSrc, `api.Get("/check-email"`) {
		t.Error("main.go tidak boleh mengekspos GET /check-email dengan PII query string")
	}
	if !strings.Contains(mainSrc, `middleware.SlugCheckRateLimiter()`) {
		t.Error("main.go wajib memasang SlugCheckRateLimiter pada check-slug")
	}
	_ = middleware.SlugCheckRateLimiter
}
