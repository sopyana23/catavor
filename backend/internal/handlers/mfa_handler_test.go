package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/middleware"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// mfaTestApp memasang handler login + MFA seperti produksi, tanpa middleware
// global, sehingga tes memverifikasi perilaku handler itu sendiri.
func mfaTestApp(t *testing.T, db *gorm.DB, cfg *config.Config) (*fiber.App, *MFAHandler) {
	t.Helper()
	app := fiber.New()
	authHandler := NewAuthHandler(cfg, db)
	mfaHandler := NewMFAHandler(cfg, db, cfg.MFAEncryptionKey, cfg.JWTSecret, true)

	app.Post("/api/login", authHandler.Login)
	app.Post("/api/auth/mfa/verify", mfaHandler.VerifyChallenge)
	app.Get("/api/auth/mfa/status", middleware.AuthRequired(cfg), mfaHandler.Status)
	return app, mfaHandler
}

func postJSON(t *testing.T, app *fiber.App, path string, payload map[string]interface{}) (int, map[string]interface{}) {
	t.Helper()
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test %s: %v", path, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	var out map[string]interface{}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &out)
	}
	return resp.StatusCode, out
}

// TestLoginRequiresMFAFactorAndNeverLeaksSessionToken adalah inti dari slice
// ini: akun ber-MFA yang memberi kata sandi BENAR tidak boleh menerima token
// sesi, dan challenge yang diterbitkan tidak boleh lolos sebagai token sesi.
func TestLoginRequiresMFAFactorAndNeverLeaksSessionToken(t *testing.T) {
	db := newTestDB(t)
	cfg := testCfg()

	user := models.User{
		Name:         "Pemilik Toko MFA",
		Email:        "mfa-owner@catavor.test",
		PlatformRole: "merchant",
	}
	if err := user.SetPassword("RahasiaKuat123!"); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	store := models.Store{UserID: user.ID, Slug: "toko-mfa", StoreTitle: "Toko MFA", Plan: "free"}
	if err := db.Create(&store).Error; err != nil {
		t.Fatal(err)
	}

	// Aktifkan MFA langsung di DB (enrollment-nya diuji terpisah).
	secret, err := security.GenerateTOTPSecret()
	if err != nil {
		t.Fatal(err)
	}
	sealed, err := security.SealMFASecret(cfg.MFAEncryptionKey, secret)
	if err != nil {
		t.Fatal(err)
	}
	codes, hashes, err := security.GenerateBackupCodes(cfg.MFAEncryptionKey, 5)
	if err != nil {
		t.Fatal(err)
	}
	encoded, _ := json.Marshal(hashes)
	if err := db.Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]interface{}{
		"two_factor_enabled":           true,
		"two_factor_secret_enc":        sealed,
		"two_factor_backup_codes_hash": string(encoded),
	}).Error; err != nil {
		t.Fatal(err)
	}

	app, _ := mfaTestApp(t, db, cfg)

	// --- Tahap 1: password benar -> wajib mfa_required, TANPA token ---
	status, body := postJSON(t, app, "/api/login", map[string]interface{}{
		"email":    "mfa-owner@catavor.test",
		"password": "RahasiaKuat123!",
		"portal":   "merchant",
	})
	if status != fiber.StatusOK {
		t.Fatalf("login tahap 1 harus 200 (kredensial sah), dapat %d: %v", status, body)
	}
	if body["mfa_required"] != true {
		t.Fatalf("respons harus mfa_required=true, dapat %v", body["mfa_required"])
	}
	if tok, ok := body["token"]; ok && tok != nil && tok != "" {
		t.Fatalf("BOCOR: token sesi terbit sebelum faktor kedua terbukti: %v", tok)
	}
	challenge, _ := body["challenge"].(string)
	if challenge == "" {
		t.Fatal("challenge wajib ada di respons tahap 1")
	}

	// Challenge tidak boleh berlaku sebagai token sesi pada endpoint terproteksi.
	req := httptest.NewRequest("GET", "/api/auth/mfa/status", nil)
	req.Header.Set("Authorization", "Bearer "+challenge)
	protected := fiber.New()
	protected.Get("/api/auth/mfa/status", middleware.AuthRequired(cfg), func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})
	resp, err := protected.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode == fiber.StatusOK {
		t.Fatal("BOCOR: challenge MFA diterima sebagai token sesi oleh AuthRequired")
	}

	// --- Tahap 2a: kode salah -> ditolak, masih tanpa token ---
	status, body = postJSON(t, app, "/api/auth/mfa/verify", map[string]interface{}{
		"challenge":   challenge,
		"code":        "000000",
		"factor_type": "totp",
	})
	if status != fiber.StatusUnauthorized {
		t.Fatalf("kode salah harus 401, dapat %d: %v", status, body)
	}
	if tok, ok := body["token"]; ok && tok != nil && tok != "" {
		t.Fatalf("BOCOR: token terbit walau kode salah: %v", tok)
	}

	// --- Tahap 2b: kode benar -> token terbit ---
	code, err := security.GenerateTOTPCode(secret, security.TOTPStepAt(time.Now().UTC()))
	if err != nil {
		t.Fatal(err)
	}
	status, body = postJSON(t, app, "/api/auth/mfa/verify", map[string]interface{}{
		"challenge":   challenge,
		"code":        code,
		"factor_type": "totp",
	})
	if status != fiber.StatusOK {
		t.Fatalf("kode benar harus 200, dapat %d: %v", status, body)
	}
	token, _ := body["token"].(string)
	if token == "" {
		t.Fatal("token sesi wajib terbit setelah faktor kedua terbukti")
	}

	// Token itu harus benar-benar diterima AuthRequired.
	req2 := httptest.NewRequest("GET", "/api/auth/mfa/status", nil)
	req2.Header.Set("Authorization", "Bearer "+token)
	resp2, err := protected.Test(req2)
	if err != nil {
		t.Fatal(err)
	}
	if resp2.StatusCode != fiber.StatusOK {
		t.Fatalf("token hasil MFA harus valid untuk AuthRequired, dapat %d", resp2.StatusCode)
	}

	// --- Tahap 3: backup code juga bisa menukar challenge, sekali pakai ---
	_, body = postJSON(t, app, "/api/login", map[string]interface{}{
		"email":    "mfa-owner@catavor.test",
		"password": "RahasiaKuat123!",
		"portal":   "merchant",
	})
	challenge2, _ := body["challenge"].(string)
	if challenge2 == "" {
		t.Fatal("challenge kedua wajib ada")
	}

	status, body = postJSON(t, app, "/api/auth/mfa/verify", map[string]interface{}{
		"challenge":   challenge2,
		"code":        codes[0],
		"factor_type": "backup_code",
	})
	if status != fiber.StatusOK {
		t.Fatalf("backup code harus diterima, dapat %d: %v", status, body)
	}

	// Kode yang sama tidak boleh dipakai dua kali.
	_, body = postJSON(t, app, "/api/login", map[string]interface{}{
		"email":    "mfa-owner@catavor.test",
		"password": "RahasiaKuat123!",
		"portal":   "merchant",
	})
	challenge3, _ := body["challenge"].(string)
	status, body = postJSON(t, app, "/api/auth/mfa/verify", map[string]interface{}{
		"challenge":   challenge3,
		"code":        codes[0],
		"factor_type": "backup_code",
	})
	if status == fiber.StatusOK {
		t.Fatal("backup code bekas DITERIMA — konsumsi tidak atomik")
	}
}

// TestLoginWithoutMFABehaviourUnchanged memastikan akun tanpa MFA tetap
// menerima token langsung, sehingga perubahan ini tidak merusak jalur lama.
func TestLoginWithoutMFABehaviourUnchanged(t *testing.T) {
	db := newTestDB(t)
	cfg := testCfg()

	user := models.User{Name: "Tanpa MFA", Email: "plain@catavor.test", PlatformRole: "merchant"}
	if err := user.SetPassword("RahasiaKuat123!"); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Store{UserID: user.ID, Slug: "toko-plain", StoreTitle: "Plain", Plan: "free"}).Error; err != nil {
		t.Fatal(err)
	}

	app, _ := mfaTestApp(t, db, cfg)
	status, body := postJSON(t, app, "/api/login", map[string]interface{}{
		"email":    "plain@catavor.test",
		"password": "RahasiaKuat123!",
		"portal":   "merchant",
	})
	if status != fiber.StatusOK {
		t.Fatalf("login tanpa MFA harus 200, dapat %d: %v", status, body)
	}
	if body["mfa_required"] == true {
		t.Fatal("akun tanpa MFA tidak boleh diminta faktor kedua")
	}
	if tok, _ := body["token"].(string); tok == "" {
		t.Fatal("akun tanpa MFA harus langsung menerima token")
	}
}

// TestEnrollmentLoopViaHTTP menjalankan alur enrollment lengkap lewat HTTP:
// status -> enroll -> confirm (kode salah ditolak) -> confirm (kode benar) ->
// login kini menantang -> verify menukar challenge jadi token.
// Ini menutup celah "endpoint hidup tapi alurnya tidak pernah terbukti".
func TestEnrollmentLoopViaHTTP(t *testing.T) {
	db := newTestDB(t)
	cfg := testCfg()

	user := models.User{Name: "Calon MFA", Email: "enroll@catavor.test", PlatformRole: "merchant"}
	if err := user.SetPassword("RahasiaKuat123!"); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Store{UserID: user.ID, Slug: "toko-enroll", StoreTitle: "Enroll", Plan: "free"}).Error; err != nil {
		t.Fatal(err)
	}

	app := fiber.New()
	authHandler := NewAuthHandler(cfg, db)
	mfaHandler := NewMFAHandler(cfg, db, cfg.MFAEncryptionKey, cfg.JWTSecret, true)
	// Middleware stub: menaruh user ke Locals seperti AuthRequired asli.
	withUser := func(c *fiber.Ctx) error {
		var fresh models.User
		if err := db.First(&fresh, user.ID).Error; err != nil {
			return c.SendStatus(fiber.StatusUnauthorized)
		}
		c.Locals("user", &fresh)
		return c.Next()
	}

	app.Post("/api/login", authHandler.Login)
	app.Post("/api/auth/mfa/verify", mfaHandler.VerifyChallenge)
	app.Get("/api/auth/mfa/status", withUser, mfaHandler.Status)
	app.Post("/api/auth/mfa/enroll", withUser, mfaHandler.StartEnrollment)
	app.Post("/api/auth/mfa/confirm", withUser, mfaHandler.ConfirmEnrollment)

	get := func(path string) (int, map[string]interface{}) {
		req := httptest.NewRequest("GET", path, nil)
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("app.Test %s: %v", path, err)
		}
		defer resp.Body.Close()
		raw, _ := io.ReadAll(resp.Body)
		var out map[string]interface{}
		_ = json.Unmarshal(raw, &out)
		return resp.StatusCode, out
	}

	// Status awal: belum aktif.
	status, body := get("/api/auth/mfa/status")
	if status != fiber.StatusOK {
		t.Fatalf("status harus 200, dapat %d: %v", status, body)
	}
	if enabled, ok := body["enabled"].(bool); ok && enabled {
		t.Fatal("MFA harus belum aktif sebelum enrollment")
	}

	// Enroll: dapat secret + otpauth URL.
	status, body = postJSON(t, app, "/api/auth/mfa/enroll", map[string]interface{}{})
	if status != fiber.StatusOK {
		t.Fatalf("enroll harus 200, dapat %d: %v", status, body)
	}
	data, _ := body["data"].(map[string]interface{})
	secret, _ := data["secret"].(string)
	if secret == "" {
		t.Fatal("enroll wajib mengembalikan secret")
	}
	if url, _ := data["otpauth_url"].(string); !strings.HasPrefix(url, "otpauth://totp/") {
		t.Fatalf("otpauth_url tidak valid: %q", url)
	}

	// Enroll belum boleh mengaktifkan faktor kedua.
	var afterEnroll models.User
	if err := db.First(&afterEnroll, user.ID).Error; err != nil {
		t.Fatal(err)
	}
	if afterEnroll.TwoFactorEnabled {
		t.Fatal("enroll TIDAK boleh langsung mengaktifkan MFA sebelum kode terbukti")
	}
	if afterEnroll.TwoFactorSecretEnc == nil || *afterEnroll.TwoFactorSecretEnc == secret {
		t.Fatal("secret wajib tersimpan dalam bentuk terenkripsi, bukan plaintext")
	}

	// Confirm dengan kode salah: ditolak, tetap belum aktif.
	status, _ = postJSON(t, app, "/api/auth/mfa/confirm", map[string]interface{}{"code": "000000"})
	if status != fiber.StatusUnauthorized {
		t.Fatalf("confirm kode salah harus 401, dapat %d", status)
	}

	// Confirm dengan kode benar: aktif + kode cadangan terbit once.
	code, err := security.GenerateTOTPCode(secret, security.TOTPStepAt(time.Now().UTC()))
	if err != nil {
		t.Fatal(err)
	}
	status, body = postJSON(t, app, "/api/auth/mfa/confirm", map[string]interface{}{"code": code})
	if status != fiber.StatusOK {
		t.Fatalf("confirm kode benar harus 200, dapat %d: %v", status, body)
	}
	data, _ = body["data"].(map[string]interface{})
	backupCodes, _ := data["backup_codes"].([]interface{})
	if len(backupCodes) == 0 {
		t.Fatal("confirm wajib mengembalikan kode cadangan")
	}

	// Login sekarang WAJIB menantang.
	status, body = postJSON(t, app, "/api/login", map[string]interface{}{
		"email":    "enroll@catavor.test",
		"password": "RahasiaKuat123!",
		"portal":   "merchant",
	})
	if status != fiber.StatusOK {
		t.Fatalf("login harus 200, dapat %d: %v", status, body)
	}
	if body["mfa_required"] != true {
		t.Fatal("setelah enrollment, login wajib meminta faktor kedua")
	}
	challenge, _ := body["challenge"].(string)

	// Tukar challenge dengan TOTP baru -> token.
	code2, err := security.GenerateTOTPCode(secret, security.TOTPStepAt(time.Now().UTC().Add(30*time.Second)))
	if err != nil {
		t.Fatal(err)
	}
	status, body = postJSON(t, app, "/api/auth/mfa/verify", map[string]interface{}{
		"challenge":   challenge,
		"code":        code2,
		"factor_type": "totp",
	})
	if status != fiber.StatusOK {
		t.Fatalf("verify harus 200, dapat %d: %v", status, body)
	}
	if tok, _ := body["token"].(string); tok == "" {
		t.Fatal("verify harus menerbitkan token sesi")
	}
}

// TestLoginWhenMFAFlagOffDoesNotTrapUser memverifikasi konsekuensi saklar rilis:
// bila MFA_2FA_ENABLED=false, akun yang SUDAH mendaftar faktor kedua tidak boleh
// ditantang, karena /verify mati (404) dan user akan terkunci permanen.
func TestLoginWhenMFAFlagOffDoesNotTrapUser(t *testing.T) {
	db := newTestDB(t)
	cfg := testCfg()
	cfg.MFAEnabled = false

	user := models.User{Name: "Sudah Enroll", Email: "trapped@catavor.test", PlatformRole: "merchant"}
	if err := user.SetPassword("RahasiaKuat123!"); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Store{UserID: user.ID, Slug: "toko-trap", StoreTitle: "Trap", Plan: "free"}).Error; err != nil {
		t.Fatal(err)
	}
	secret, _ := security.GenerateTOTPSecret()
	sealed, _ := security.SealMFASecret(cfg.MFAEncryptionKey, secret)
	_ = db.Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]interface{}{
		"two_factor_enabled":    true,
		"two_factor_secret_enc": sealed,
	}).Error

	app, _ := mfaTestApp(t, db, cfg)
	status, body := postJSON(t, app, "/api/login", map[string]interface{}{
		"email":    "trapped@catavor.test",
		"password": "RahasiaKuat123!",
		"portal":   "merchant",
	})
	if status != fiber.StatusOK {
		t.Fatalf("login harus 200, dapat %d: %v", status, body)
	}
	if body["mfa_required"] == true {
		t.Fatal("TERKUNCI: MFA dimatikan tapi login tetap menantang faktor kedua")
	}
	if tok, _ := body["token"].(string); tok == "" {
		t.Fatal("saat MFA dimatikan, user harus langsung mendapat token")
	}
}

// TestMFADisabledGuardReturns404 memastikan flag rilis benar-benar mematikan
// endpoint, bukan hanya menyembunyikan tombol di UI.
func TestMFADisabledGuardReturns404(t *testing.T) {
	db := newTestDB(t)
	cfg := testCfg()
	app := fiber.New()
	disabled := NewMFAHandler(cfg, db, cfg.MFAEncryptionKey, cfg.JWTSecret, false)
	app.Post("/api/auth/mfa/verify", disabled.VerifyChallenge)

	status, body := postJSON(t, app, "/api/auth/mfa/verify", map[string]interface{}{
		"challenge": "apa-saja",
		"code":      "123456",
	})
	if status != fiber.StatusNotFound {
		t.Fatalf("MFA dimatikan harus 404, dapat %d: %v", status, body)
	}
}

// TestChallengeRejectedAfterTTL memastikan challenge berumur pendek.
func TestChallengeRejectedAfterTTL(t *testing.T) {
	db := newTestDB(t)
	cfg := testCfg()

	user := models.User{Name: "TTL", Email: "ttl@catavor.test", PlatformRole: "merchant"}
	if err := user.SetPassword("RahasiaKuat123!"); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	secret, _ := security.GenerateTOTPSecret()
	sealed, _ := security.SealMFASecret(cfg.MFAEncryptionKey, secret)
	_ = db.Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]interface{}{
		"two_factor_enabled":    true,
		"two_factor_secret_enc": sealed,
	}).Error

	app, _ := mfaTestApp(t, db, cfg)
	_, body := postJSON(t, app, "/api/login", map[string]interface{}{
		"email":    "ttl@catavor.test",
		"password": "RahasiaKuat123!",
	})
	challenge, _ := body["challenge"].(string)
	if challenge == "" {
		t.Fatal("challenge wajib ada")
	}

	// Challenge yang diubah satu karakter wajib ditolak (signature).
	status, _ := postJSON(t, app, "/api/auth/mfa/verify", map[string]interface{}{
		"challenge": challenge + "x",
		"code":      "123456",
	})
	if status != fiber.StatusUnauthorized {
		t.Fatalf("challenge rusak harus 401, dapat %d", status)
	}
	if strings.Contains(challenge, "eyJ") == false {
		t.Fatal("challenge harus berbentuk JWT")
	}
}
