package handlers

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/mfa"
	"catavor-backend/internal/middleware"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// newFullMFARoutingApp merakit rute autentikasi, MFA, profil, toko, SSE, dan
// admin persis dengan urutan middleware produksi di cmd/server/main.go:
//  1. Endpoint publik (/api/login, /api/auth/google, /api/auth/register, /api/auth/forgot-password-reset, /api/auth/mfa/verify)
//  2. Endpoint onboarding MFA (/api/auth/mfa/status|enroll|confirm) dengan AuthOrMFASetupRequired SEBELUM grup AuthRequired
//  3. Grup terproteksi AuthRequired (/api/auth/me, /api/auth/refresh, /api/profile, /api/auth/mfa/disable, /api/user/stores/switch, /api/notifications/*)
//  4. Grup admin dengan RequirePlatformStaff + RequireMFACompleted
func newFullMFARoutingApp(t *testing.T, db *gorm.DB, cfg *config.Config) (*fiber.App, *AuthHandler, *MFAHandler) {
	t.Helper()
	database.DB = db
	services.InitOTPService(db)
	services.InitRBACService(db)

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	authHandler := NewAuthHandler(cfg, db)
	mfaHandler := NewMFAHandler(cfg, db, cfg.MFAEncryptionKey, cfg.JWTSecret, cfg.MFAEnabled)
	storeHandler := NewStoreHandler(db, cfg)
	notifHandler := NewNotificationHandler(db)

	api := app.Group("/api")
	api.Post("/login", authHandler.Login)
	api.Post("/auth/google", authHandler.GoogleAuth)
	api.Post("/auth/register", authHandler.Register)
	api.Post("/auth/forgot-password-reset", authHandler.ForgotPasswordReset)
	api.Post("/auth/mfa/verify", mfaHandler.VerifyChallenge)
	api.Post("/logout", authHandler.Logout)

	// WAJIB sebelum api.Group("", AuthRequired) agar Fiber tidak mencegat dengan AuthRequired lebih dulu.
	mfaSetupAuth := middleware.AuthOrMFASetupRequired(cfg)
	api.Get("/auth/mfa/status", mfaSetupAuth, mfaHandler.Status)
	api.Post("/auth/mfa/enroll", mfaSetupAuth, mfaHandler.StartEnrollment)
	api.Post("/auth/mfa/confirm", mfaSetupAuth, mfaHandler.ConfirmEnrollment)

	authOnly := api.Group("", middleware.AuthRequired(cfg))
	authOnly.Post("/auth/mfa/disable", mfaHandler.Disable)
	authOnly.Get("/auth/me", authHandler.VerifyToken)
	authOnly.Post("/auth/refresh", authHandler.RefreshToken)
	authOnly.Put("/profile", authHandler.UpdateProfile)
	authOnly.Post("/profile/request-password-otp", authHandler.RequestProfilePasswordOTP)
	authOnly.Post("/user/stores/switch", storeHandler.SwitchStore)
	authOnly.Post("/notifications/stream-ticket", notifHandler.IssueStreamTicket)
	authOnly.Get("/notifications/probe", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"success": true, "sse": c.Locals("sse_ticket_auth") == true})
	})
	authOnly.Get("/merchant/ping", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"success": true, "scope": "merchant"})
	})

	adminApi := authOnly.Group("/admin", middleware.RequireAdmin(cfg), middleware.RequireMFACompleted(cfg))
	adminApi.Get("/ping", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"success": true, "scope": "admin"})
	})

	return app, authHandler, mfaHandler
}

func doJSONReq(
	t *testing.T,
	app *fiber.App,
	method, path string,
	bearer string,
	payload map[string]interface{},
) (int, map[string]interface{}, http.Header) {
	t.Helper()
	var bodyReader io.Reader
	if payload != nil {
		rawBody, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal %s: %v", path, err)
		}
		bodyReader = bytes.NewReader(rawBody)
	}
	req := httptest.NewRequest(method, path, bodyReader)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test %s %s: %v", method, path, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	out := map[string]interface{}{}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &out)
	}
	return resp.StatusCode, out, resp.Header
}

func assertNoSessionIssued(t *testing.T, db *gorm.DB, userID uint, body map[string]interface{}, headers http.Header, ctx string) {
	t.Helper()
	if tok, ok := body["token"]; ok && tok != nil && fmt.Sprint(tok) != "" {
		t.Fatalf("%s: BOCOR token sesi penuh sebelum verifikasi faktor kedua", ctx)
	}
	for _, sc := range headers.Values("Set-Cookie") {
		if strings.Contains(sc, middleware.SessionCookieName+"=") && !strings.Contains(sc, "Max-Age=0") {
			t.Fatalf("%s: BOCOR cookie %s sebelum verifikasi faktor kedua", ctx, middleware.SessionCookieName)
		}
	}
	if db != nil && userID > 0 {
		var activeCount int64
		if err := db.Model(&models.UserSession{}).
			Where("user_id = ? AND is_revoked = ?", userID, false).
			Count(&activeCount).Error; err == nil && activeCount > 0 {
			t.Fatalf("%s: BOCOR baris user_sessions aktif=%d sebelum verifikasi faktor kedua", ctx, activeCount)
		}
	}
}

func seedEnrolledMFAForUser(t *testing.T, db *gorm.DB, cfg *config.Config, userID uint, enforced bool) (string, []string) {
	t.Helper()
	secret, err := security.GenerateTOTPSecret()
	if err != nil {
		t.Fatalf("GenerateTOTPSecret: %v", err)
	}
	sealed, err := security.SealMFASecret(cfg.MFAEncryptionKey, secret)
	if err != nil {
		t.Fatalf("SealMFASecret: %v", err)
	}
	codes, hashes, err := security.GenerateBackupCodes(cfg.MFAEncryptionKey, 6)
	if err != nil {
		t.Fatalf("GenerateBackupCodes: %v", err)
	}
	encodedHashes, err := mfa.EncodeBackupCodeHashes(hashes)
	if err != nil {
		t.Fatalf("EncodeBackupCodeHashes: %v", err)
	}
	now := time.Now().UTC()
	if err := db.Model(&models.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"two_factor_enabled":           true,
		"two_factor_enforced":          enforced,
		"two_factor_secret_enc":        sealed,
		"two_factor_backup_codes_hash": encodedHashes,
		"two_factor_enrolled_at":       now,
		"two_factor_last_totp_step":    0,
	}).Error; err != nil {
		t.Fatalf("seedEnrolledMFAForUser: %v", err)
	}
	return secret, codes
}

// TestCanonicalStaffRolesMandatoryMFA_UnenrolledOnlyGetsSetupCapability memverifikasi
// seluruh 5 role staf kanonik (superadmin, support, compliance, finance, content):
//   - Tanpa MFA hanya memperoleh setup_token terbatas (tanpa token sesi, tanpa cookie, 0 user_sessions).
//   - setup_token ditolak pada seluruh endpoint admin, bisnis, refresh, profil, dan disable.
//   - setup_token dapat menyelesaikan status -> enroll -> confirm tepat satu kali, lalu hangus (401).
//   - Sesi hasil confirm memiliki mfa_verified=true dan diizinkan mengakses /api/admin/ping.
func TestCanonicalStaffRolesMandatoryMFA_UnenrolledOnlyGetsSetupCapability(t *testing.T) {
	db := newTestDB(t)
	cfg := testCfg()
	app, _, _ := newFullMFARoutingApp(t, db, cfg)

	var roles []string
	for r := range models.PlatformStaffRoles {
		roles = append(roles, r)
	}
	sort.Strings(roles)
	if len(roles) < 5 {
		t.Fatalf("daftar role staf kanonik kurang lengkap: %v", roles)
	}

	for idx, role := range roles {
		role := role
		t.Run(role, func(t *testing.T) {
			email := fmt.Sprintf("staff-%s-%d@catavor.test", role, idx)
			staff := models.User{
				Name:         "Staf " + role,
				Email:        email,
				PlatformRole: role,
				TokenVersion: 1,
			}
			if err := staff.SetPassword("StafKuat#2026!"); err != nil {
				t.Fatal(err)
			}
			if err := db.Create(&staff).Error; err != nil {
				t.Fatal(err)
			}

			// 1. Login tahap pertama hanya mengembalikan kapabilitas setup terbatas.
			status, body, hdr := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
				"email":    email,
				"password": "StafKuat#2026!",
				"portal":   "admin",
			})
			if status != fiber.StatusOK {
				t.Fatalf("login staf %s harus 200 setup-gate, dapat %d: %v", role, status, body)
			}
			if body["code"] != "MFA_SETUP_REQUIRED" || body["mfa_setup_required"] != true || body["requires_2fa_setup"] != true {
				t.Fatalf("flag setup wajib aktif untuk role %s, dapat code=%v", role, body["code"])
			}
			assertNoSessionIssued(t, db, staff.ID, body, hdr, "login staf belum enroll ("+role+")")

			setupTok, _ := body["setup_token"].(string)
			if setupTok == "" {
				t.Fatalf("setup_token wajib terbit untuk role %s", role)
			}

			// 2. setup_token DILARANG mengakses rute admin, merchant, me, refresh, profil, maupun disable.
			for _, denied := range []struct {
				method string
				path   string
			}{
				{"GET", "/api/admin/ping"},
				{"GET", "/api/merchant/ping"},
				{"GET", "/api/auth/me"},
				{"POST", "/api/auth/refresh"},
				{"PUT", "/api/profile"},
				{"POST", "/api/auth/mfa/disable"},
			} {
				st, _, _ := doJSONReq(t, app, denied.method, denied.path, setupTok, map[string]interface{}{})
				if st != fiber.StatusUnauthorized {
					t.Fatalf("setup_token pada %s %s harus 401, dapat %d", denied.method, denied.path, st)
				}
			}

			// 3. setup_token DIIZINKAN untuk onboarding MFA: status -> enroll -> confirm.
			stStatus, statusBody, _ := doJSONReq(t, app, "GET", "/api/auth/mfa/status", setupTok, nil)
			if stStatus != fiber.StatusOK {
				t.Fatalf("status dengan setup_token harus 200, dapat %d", stStatus)
			}
			dataMap, _ := statusBody["data"].(map[string]interface{})
			if dataMap["mandatory_for_role"] != true || dataMap["enforced"] != true {
				t.Fatalf("status harus melaporkan mandatory_for_role=true & enforced=true: %v", dataMap)
			}

			stEnroll, enrollBody, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/enroll", setupTok, map[string]interface{}{})
			if stEnroll != fiber.StatusOK {
				t.Fatalf("enroll dengan setup_token harus 200, dapat %d", stEnroll)
			}
			enrollData, _ := enrollBody["data"].(map[string]interface{})
			secret, _ := enrollData["secret"].(string)
			setupJTI, _ := enrollData["setup_jti"].(string)
			if secret == "" || setupJTI == "" || len(setupJTI) > 64 {
				t.Fatalf("metadata enroll tidak valid (len setup_jti=%d)", len(setupJTI))
			}

			code, err := security.GenerateTOTPCode(secret, security.TOTPStepAt(time.Now().UTC()))
			if err != nil {
				t.Fatal(err)
			}
			stConfirm, confirmBody, confirmHdr := doJSONReq(t, app, "POST", "/api/auth/mfa/confirm", setupTok, map[string]interface{}{
				"code":      code,
				"setup_jti": setupJTI,
			})
			if stConfirm != fiber.StatusOK {
				t.Fatalf("confirm dengan kode sah harus 200, dapat %d: %v", stConfirm, confirmBody)
			}
			verifiedTok, _ := confirmBody["token"].(string)
			if verifiedTok == "" {
				t.Fatal("confirm wajib menerbitkan token sesi terverifikasi")
			}
			hasCookie := false
			for _, sc := range confirmHdr.Values("Set-Cookie") {
				if strings.Contains(sc, middleware.SessionCookieName+"=") {
					hasCookie = true
				}
			}
			if !hasCookie {
				t.Fatal("confirm wajib menyetel cookie sesi setelah commit DB")
			}

			// 4. setup_token yang sudah dipakai confirm wajib hangus (sekali pakai).
			stReuse, reuseBody, _ := doJSONReq(t, app, "GET", "/api/auth/mfa/status", setupTok, nil)
			if stReuse != fiber.StatusUnauthorized || reuseBody["code"] != "MFA_SETUP_TOKEN_USED" {
				t.Fatalf("reuse setup_token harus 401 MFA_SETUP_TOKEN_USED, dapat %d (%v)", stReuse, reuseBody["code"])
			}

			// 5. Sesi terverifikasi hasil confirm dapat mengakses /api/admin/ping.
			stAdmin, _, _ := doJSONReq(t, app, "GET", "/api/admin/ping", verifiedTok, nil)
			if stAdmin != fiber.StatusOK {
				t.Fatalf("sesi staf terverifikasi harus 200 pada /api/admin/ping, dapat %d", stAdmin)
			}
		})
	}
}

// TestAllSessionIssuersEnforceSharedMFAPolicy memastikan SATU kebijakan MFA
// diterapkan konsisten di semua jalur penerbitan sesi:
// Google SSO, Register (akun Google eksisting), ForgotPasswordReset, Refresh,
// SwitchStore, dan SSE Stream Ticket.
func TestAllSessionIssuersEnforceSharedMFAPolicy(t *testing.T) {
	db := newTestDB(t)
	cfg := testCfg()
	app, authHandler, _ := newFullMFARoutingApp(t, db, cfg)

	// Stub verifikator Google agar tes deterministik dan offline.
	googleIdentities := map[string]struct {
		email string
		name  string
		sub   string
	}{}
	authHandler.googleVerifier = func(cred string, _ string) (string, string, string, string, error) {
		id, ok := googleIdentities[cred]
		if !ok {
			return "", "", "", "", fmt.Errorf("kredensial Google uji tidak dikenal")
		}
		return id.email, id.name, id.sub, "https://example.com/avatar.png", nil
	}

	now := time.Now().UTC()

	// --- A. Google SSO: staf tanpa MFA -> setup_token saja ---
	unenrolledGoogleID := "gid-staff-unenrolled"
	unenrolledStaff := models.User{
		Name:            "Support Google",
		Email:           "support-sso@catavor.test",
		PlatformRole:    "support",
		GoogleID:        &unenrolledGoogleID,
		EmailVerifiedAt: &now,
		TokenVersion:    1,
	}
	if err := db.Create(&unenrolledStaff).Error; err != nil {
		t.Fatal(err)
	}
	googleIdentities["cred-staff-unenrolled"] = struct{ email, name, sub string }{
		email: unenrolledStaff.Email, name: unenrolledStaff.Name, sub: unenrolledGoogleID,
	}

	st, body, hdr := doJSONReq(t, app, "POST", "/api/auth/google", "", map[string]interface{}{
		"credential": "cred-staff-unenrolled",
		"portal":     "admin",
	})
	if st != fiber.StatusOK || body["code"] != "MFA_SETUP_REQUIRED" {
		t.Fatalf("Google SSO staf tanpa MFA harus 200 MFA_SETUP_REQUIRED, dapat %d (%v)", st, body["code"])
	}
	assertNoSessionIssued(t, db, unenrolledStaff.ID, body, hdr, "Google SSO staf tanpa MFA")

	// --- B. Google SSO: staf dengan MFA -> challenge -> verify -> akses admin ---
	enrolledGoogleID := "gid-staff-enrolled"
	enrolledStaff := models.User{
		Name:            "Finance Google",
		Email:           "finance-sso@catavor.test",
		PlatformRole:    "finance",
		GoogleID:        &enrolledGoogleID,
		EmailVerifiedAt: &now,
		TokenVersion:    1,
	}
	if err := db.Create(&enrolledStaff).Error; err != nil {
		t.Fatal(err)
	}
	staffSecret, _ := seedEnrolledMFAForUser(t, db, cfg, enrolledStaff.ID, true)
	googleIdentities["cred-staff-enrolled"] = struct{ email, name, sub string }{
		email: enrolledStaff.Email, name: enrolledStaff.Name, sub: enrolledGoogleID,
	}

	// Portal salah (merchant) tetap ditolak 401.
	stWrongPortal, _, _ := doJSONReq(t, app, "POST", "/api/auth/google", "", map[string]interface{}{
		"credential": "cred-staff-enrolled",
		"portal":     "merchant",
	})
	if stWrongPortal != fiber.StatusUnauthorized {
		t.Fatalf("staf di portal merchant harus 401, dapat %d", stWrongPortal)
	}

	// Portal benar (admin) harus menantang MFA tanpa mengeluarkan token sesi.
	st, body, hdr = doJSONReq(t, app, "POST", "/api/auth/google", "", map[string]interface{}{
		"credential": "cred-staff-enrolled",
		"portal":     "admin",
	})
	if st != fiber.StatusOK || body["mfa_required"] != true {
		t.Fatalf("Google SSO staf ber-MFA harus mfa_required=true, dapat %d (%v)", st, body)
	}
	assertNoSessionIssued(t, db, enrolledStaff.ID, body, hdr, "Google SSO staf ber-MFA")
	staffChallenge, _ := body["challenge"].(string)

	totpCode, err := security.GenerateTOTPCode(staffSecret, security.TOTPStepAt(time.Now().UTC()))
	if err != nil {
		t.Fatal(err)
	}
	stVerify, verifyBody, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
		"challenge":   staffChallenge,
		"code":        totpCode,
		"factor_type": "totp",
	})
	if stVerify != fiber.StatusOK {
		t.Fatalf("verify challenge Google SSO staf harus 200, dapat %d: %v", stVerify, verifyBody)
	}
	staffSessionTok, _ := verifyBody["token"].(string)
	stAdmin, _, _ := doJSONReq(t, app, "GET", "/api/admin/ping", staffSessionTok, nil)
	if stAdmin != fiber.StatusOK {
		t.Fatalf("sesi staf dari Google SSO + MFA harus diterima /api/admin/ping, dapat %d", stAdmin)
	}

	// --- C. Google SSO: merchant ber-MFA vs merchant tanpa MFA ---
	merchGoogleID := "gid-merch-mfa"
	merchMFA := models.User{
		Name:              "Merchant MFA",
		Email:             "merch-sso-mfa@catavor.test",
		PlatformRole:      "merchant",
		GoogleID:          &merchGoogleID,
		EmailVerifiedAt:   &now,
		HasCustomPassword: true,
		TokenVersion:      1,
	}
	if err := merchMFA.SetPassword("MerchSandi#2026!"); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&merchMFA).Error; err != nil {
		t.Fatal(err)
	}
	storeA := models.Store{UserID: merchMFA.ID, Slug: "toko-sso-a", StoreTitle: "Toko SSO A", Plan: "free", PaymentStatus: "free_active"}
	storeB := models.Store{UserID: merchMFA.ID, Slug: "toko-sso-b", StoreTitle: "Toko SSO B", Plan: "free", PaymentStatus: "free_active"}
	if err := db.Create(&storeA).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&storeB).Error; err != nil {
		t.Fatal(err)
	}
	_, merchBackupCodes := seedEnrolledMFAForUser(t, db, cfg, merchMFA.ID, false)
	googleIdentities["cred-merch-mfa"] = struct{ email, name, sub string }{
		email: merchMFA.Email, name: merchMFA.Name, sub: merchGoogleID,
	}

	st, body, hdr = doJSONReq(t, app, "POST", "/api/auth/google", "", map[string]interface{}{
		"credential": "cred-merch-mfa",
		"portal":     "merchant",
	})
	if st != fiber.StatusOK || body["mfa_required"] != true {
		t.Fatalf("Google SSO merchant opt-in MFA harus menantang faktor kedua, dapat %d (%v)", st, body)
	}
	assertNoSessionIssued(t, db, merchMFA.ID, body, hdr, "Google SSO merchant ber-MFA")
	merchChallenge, _ := body["challenge"].(string)

	stVerify, verifyBody, _ = doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
		"challenge":   merchChallenge,
		"code":        merchBackupCodes[0],
		"factor_type": "backup_code",
	})
	if stVerify != fiber.StatusOK {
		t.Fatalf("verify backup_code merchant Google SSO harus 200, dapat %d", stVerify)
	}
	merchTok, _ := verifyBody["token"].(string)

	// --- D. Refresh, SwitchStore, dan SSE Ticket wajib mempertahankan mfa_verified=true ---
	stRefresh, refreshBody, _ := doJSONReq(t, app, "POST", "/api/auth/refresh", merchTok, nil)
	if stRefresh != fiber.StatusOK {
		t.Fatalf("refresh sesi MFA harus 200, dapat %d: %v", stRefresh, refreshBody)
	}
	refreshedTok, _ := refreshBody["token"].(string)
	if refreshedTok == "" {
		t.Fatal("refresh wajib mengembalikan token baru")
	}
	// Token lama sudah digantikan di user_sessions sehingga wajib ditolak.
	stOld, _, _ := doJSONReq(t, app, "GET", "/api/merchant/ping", merchTok, nil)
	if stOld != fiber.StatusUnauthorized {
		t.Fatalf("token pra-refresh harus 401 setelah rotasi JTI, dapat %d", stOld)
	}
	stNew, _, _ := doJSONReq(t, app, "GET", "/api/merchant/ping", refreshedTok, nil)
	if stNew != fiber.StatusOK {
		t.Fatalf("token hasil refresh harus 200 (mfa_verified terjaga), dapat %d", stNew)
	}

	stSwitch, switchBody, _ := doJSONReq(t, app, "POST", "/api/user/stores/switch", refreshedTok, map[string]interface{}{
		"slug": "toko-sso-b",
	})
	if stSwitch != fiber.StatusOK {
		t.Fatalf("switch store sesi MFA harus 200, dapat %d: %v", stSwitch, switchBody)
	}
	switchedTok, _ := switchBody["token"].(string)
	stAfterSwitch, _, _ := doJSONReq(t, app, "GET", "/api/merchant/ping", switchedTok, nil)
	if stAfterSwitch != fiber.StatusOK {
		t.Fatalf("token hasil switch store harus tetap mfa_verified=true (200), dapat %d", stAfterSwitch)
	}

	stTicket, ticketBody, _ := doJSONReq(t, app, "POST", "/api/notifications/stream-ticket", switchedTok, nil)
	if stTicket != fiber.StatusOK {
		t.Fatalf("stream-ticket harus 200, dapat %d", stTicket)
	}
	sseTicket, _ := ticketBody["ticket"].(string)
	stSSE, _, _ := doJSONReq(t, app, "GET", "/api/notifications/probe?ticket="+sseTicket, "", nil)
	if stSSE != fiber.StatusOK {
		t.Fatalf("tiket SSE dari sesi MFA harus lolos AuthRequired, dapat %d", stSSE)
	}

	// --- E. ForgotPasswordReset: mencabut sesi lama & tetap menantang MFA (tidak menerbitkan sesi langsung) ---
	otpCode := "654321"
	otpSum := sha256.Sum256([]byte(otpCode))
	if err := db.Create(&models.EmailVerificationOTP{
		Email:     strings.ToLower(merchMFA.Email),
		OTPHash:   hex.EncodeToString(otpSum[:]),
		Purpose:   "password_reset",
		ExpiresAt: time.Now().UTC().Add(5 * time.Minute),
	}).Error; err != nil {
		t.Fatalf("seed password_reset OTP: %v", err)
	}
	stReset, resetBody, resetHdr := doJSONReq(t, app, "POST", "/api/auth/forgot-password-reset", "", map[string]interface{}{
		"email":            merchMFA.Email,
		"otp":              otpCode,
		"new_password":     "SandiBaruAman#2026!",
		"confirm_password": "SandiBaruAman#2026!",
	})
	if stReset != fiber.StatusOK || resetBody["mfa_required"] != true {
		t.Fatalf("forgot-password-reset akun ber-MFA harus 200 mfa_required=true, dapat %d: %v", stReset, resetBody)
	}
	assertNoSessionIssued(t, db, merchMFA.ID, resetBody, resetHdr, "forgot-password-reset akun ber-MFA")

	// Sesi aktif sebelum reset wajib sudah dicabut.
	stRevokedAfterReset, _, _ := doJSONReq(t, app, "GET", "/api/merchant/ping", switchedTok, nil)
	if stRevokedAfterReset != fiber.StatusUnauthorized {
		t.Fatalf("sesi lama harus dicabut (401) setelah reset sandi, dapat %d", stRevokedAfterReset)
	}

	// --- F. Register oleh akun Google eksisting tanpa toko namun ber-MFA ---
	regGoogleID := "gid-reg-mfa"
	regUser := models.User{
		Name:            "Calon Toko Google MFA",
		Email:           "reg-google-mfa@catavor.test",
		PlatformRole:    "merchant",
		GoogleID:        &regGoogleID,
		EmailVerifiedAt: &now,
		TokenVersion:    1,
	}
	if err := db.Create(&regUser).Error; err != nil {
		t.Fatal(err)
	}
	seedEnrolledMFAForUser(t, db, cfg, regUser.ID, false)

	grtMFA, err := authHandler.IssueGoogleRegistrationToken(regUser.Email, regGoogleID)
	if err != nil {
		t.Fatalf("IssueGoogleRegistrationToken: %v", err)
	}
	stReg, regBody, regHdr := doJSONReq(t, app, "POST", "/api/auth/register", "", map[string]interface{}{
		"name":                      regUser.Name,
		"email":                     regUser.Email,
		"password":                  "DaftarToko#2026!",
		"store_name":                "Toko Registrasi MFA",
		"slug":                      "toko-reg-mfa",
		"google_id":                 regGoogleID,
		"google_registration_token": grtMFA,
	})
	if stReg != fiber.StatusOK || regBody["mfa_required"] != true {
		t.Fatalf("register toko oleh user ber-MFA harus 200 mfa_required=true, dapat %d (mfa_required=%v)", stReg, regBody["mfa_required"])
	}
	assertNoSessionIssued(t, db, regUser.ID, regBody, regHdr, "register akun Google ber-MFA")
}

// TestMFAFailClosedOnDisabledFlagMissingConfigAndSchemaFault membuktikan bahwa
// kegagalan feature flag, konfigurasi kunci kosong, atau kerusakan tabel MFA
// selalu fail-closed (503) tanpa membocorkan sesi staf atau akun ber-MFA.
func TestMFAFailClosedOnDisabledFlagMissingConfigAndSchemaFault(t *testing.T) {
	t.Run("flag_off_blocks_mandatory_staff_login_and_middleware", func(t *testing.T) {
		db := newTestDB(t)
		cfg := testCfg()
		cfg.MFAEnabled = false
		app, _, _ := newFullMFARoutingApp(t, db, cfg)

		staff := models.User{Name: "Admin Flag Off", Email: "flagoff-staff@catavor.test", PlatformRole: "superadmin", TokenVersion: 1}
		if err := staff.SetPassword("SandiKuat#2026!"); err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&staff).Error; err != nil {
			t.Fatal(err)
		}

		st, body, hdr := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
			"email":    staff.Email,
			"password": "SandiKuat#2026!",
			"portal":   "admin",
		})
		if st != fiber.StatusServiceUnavailable {
			t.Fatalf("staf wajib-MFA saat MFAEnabled=false harus 503 fail-closed, dapat %d", st)
		}
		assertNoSessionIssued(t, db, staff.ID, body, hdr, "login staf saat MFAEnabled=false")

		// Bahkan bila token sudah ada sebelumnya, AuthRequired wajib menolak 503.
		tok, jti, exp, err := middleware.GenerateTokenWithIDVerified(&staff, nil, cfg)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := services.CreateDurableUserSession(db, staff.ID, jti, exp, "127.0.0.1", "test"); err != nil {
			t.Fatal(err)
		}
		stMid, _, _ := doJSONReq(t, app, "GET", "/api/admin/ping", tok, nil)
		if stMid != fiber.StatusServiceUnavailable {
			t.Fatalf("AuthRequired untuk staf saat MFAEnabled=false harus 503, dapat %d", stMid)
		}
	})

	t.Run("missing_encryption_key_fails_closed", func(t *testing.T) {
		db := newTestDB(t)
		cfg := testCfg()
		seedCfg := testCfg()

		merch := models.User{Name: "Merchant Keyless", Email: "keyless-merch@catavor.test", PlatformRole: "merchant", TokenVersion: 1}
		if err := merch.SetPassword("SandiKuat#2026!"); err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&merch).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&models.Store{UserID: merch.ID, Slug: "toko-keyless", StoreTitle: "Keyless", Plan: "free"}).Error; err != nil {
			t.Fatal(err)
		}
		seedEnrolledMFAForUser(t, db, seedCfg, merch.ID, false)

		cfg.MFAEncryptionKey = ""
		app, _, _ := newFullMFARoutingApp(t, db, cfg)
		st, body, hdr := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
			"email":    merch.Email,
			"password": "SandiKuat#2026!",
			"portal":   "merchant",
		})
		if st != fiber.StatusServiceUnavailable {
			t.Fatalf("kunci enkripsi kosong bagi user ber-MFA harus 503, dapat %d", st)
		}
		assertNoSessionIssued(t, db, merch.ID, body, hdr, "login user ber-MFA tanpa kunci")
	})

	t.Run("missing_mfa_schema_table_fails_closed", func(t *testing.T) {
		db := newTestDB(t)
		cfg := testCfg()
		app, _, _ := newFullMFARoutingApp(t, db, cfg)

		staff := models.User{Name: "Staff Schema", Email: "schema-staff@catavor.test", PlatformRole: "compliance", TokenVersion: 1}
		if err := staff.SetPassword("SandiKuat#2026!"); err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&staff).Error; err != nil {
			t.Fatal(err)
		}

		// Hapus tabel lockout untuk mensimulasikan migrasi N-60 belum berjalan / DB rusak.
		if err := db.Migrator().DropTable(&models.MFAAccountLockout{}); err != nil {
			t.Fatal(err)
		}

		st, body, hdr := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
			"email":    staff.Email,
			"password": "SandiKuat#2026!",
			"portal":   "admin",
		})
		if st != fiber.StatusServiceUnavailable {
			t.Fatalf("kerusakan skema MFA harus 503 fail-closed, dapat %d", st)
		}
		assertNoSessionIssued(t, db, staff.ID, body, hdr, "login staf saat tabel lockout hilang")
	})
}

// TestChallengeReplayDuplicateJTIAndBruteForceLockout menguji:
//   - Challenge kedaluwarsa ditolak (401).
//   - Replay langkah waktu TOTP yang sama ditolak (401 MFA_CODE_REUSED).
//   - Penukaran serial JTI yang SAMA dua kali (meski memakai dua backup code valid berbeda)
//     ditolak pada percobaan kedua (401 MFA_CHALLENGE_USED) tanpa membakar backup code kedua.
//   - Retry jaringan identik bersifat idempotent, sedangkan 5 kode salah berbeda memicu 429 MFA_LOCKED.
func TestChallengeReplayDuplicateJTIAndBruteForceLockout(t *testing.T) {
	db := newTestDB(t)
	cfg := testCfg()
	app, _, _ := newFullMFARoutingApp(t, db, cfg)

	staff := models.User{Name: "Security Tester", Email: "replay-staff@catavor.test", PlatformRole: "superadmin", TokenVersion: 1}
	if err := staff.SetPassword("SandiKuat#2026!"); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&staff).Error; err != nil {
		t.Fatal(err)
	}
	secret, backupCodes := seedEnrolledMFAForUser(t, db, cfg, staff.ID, true)

	// 1. Challenge kedaluwarsa wajib ditolak 401.
	expiredChallenge, _, _, err := mfa.IssueChallengeWithVersion(cfg.JWTSecret, staff.ID, staff.TokenVersion, time.Now().UTC().Add(-10*time.Minute), "")
	if err != nil {
		t.Fatal(err)
	}
	validNowCode, _ := security.GenerateTOTPCode(secret, security.TOTPStepAt(time.Now().UTC()))
	stExp, _, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
		"challenge":   expiredChallenge,
		"code":        validNowCode,
		"factor_type": "totp",
	})
	if stExp != fiber.StatusUnauthorized {
		t.Fatalf("challenge kedaluwarsa harus 401, dapat %d", stExp)
	}

	// 2. Penukaran TOTP sah -> sukses, lalu replay kode pada step yang sama di challenge baru -> 401 MFA_CODE_REUSED.
	_, login1, _ := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
		"email": staff.Email, "password": "SandiKuat#2026!", "portal": "admin",
	})
	ch1, _ := login1["challenge"].(string)
	stOK, _, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
		"challenge": ch1, "code": validNowCode, "factor_type": "totp",
	})
	if stOK != fiber.StatusOK {
		t.Fatalf("verifikasi TOTP pertama harus 200, dapat %d", stOK)
	}

	_, login2, _ := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
		"email": staff.Email, "password": "SandiKuat#2026!", "portal": "admin",
	})
	ch2, _ := login2["challenge"].(string)
	stReplay, replayBody, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
		"challenge": ch2, "code": validNowCode, "factor_type": "totp",
	})
	if stReplay != fiber.StatusUnauthorized || replayBody["code"] != "MFA_CODE_REUSED" {
		t.Fatalf("replay TOTP pada step yang sama harus 401 MFA_CODE_REUSED, dapat %d (%v)", stReplay, replayBody["code"])
	}
	// Reset counter kegagalan dari uji replay sebelum menguji serial JTI & lockout terukur.
	db.Where("user_id = ?", staff.ID).Delete(&models.MFAAccountLockout{})
	db.Where("user_id = ?", staff.ID).Delete(&models.MFAChallengeFailure{})

	// 3. Penukaran serial challenge JTI yang sama dua kali (dengan 2 backup code valid berbeda!).
	_, login3, _ := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
		"email": staff.Email, "password": "SandiKuat#2026!", "portal": "admin",
	})
	ch3, _ := login3["challenge"].(string)

	stBC1, _, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
		"challenge": ch3, "code": backupCodes[0], "factor_type": "backup_code",
	})
	if stBC1 != fiber.StatusOK {
		t.Fatalf("penukaran pertama ch3 harus 200, dapat %d", stBC1)
	}

	var sessionsBeforeDup int64
	db.Model(&models.UserSession{}).Where("user_id = ? AND is_revoked = ?", staff.ID, false).Count(&sessionsBeforeDup)

	stDupJTI, dupBody, dupHdr := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
		"challenge": ch3, "code": backupCodes[1], "factor_type": "backup_code",
	})
	if stDupJTI != fiber.StatusUnauthorized || dupBody["code"] != "MFA_CHALLENGE_USED" {
		t.Fatalf("penukaran kedua pada JTI yang sama harus 401 MFA_CHALLENGE_USED, dapat %d (%v)", stDupJTI, dupBody["code"])
	}
	if tok, ok := dupBody["token"]; ok && tok != nil && fmt.Sprint(tok) != "" {
		t.Fatal("duplikat JTI tidak boleh mengeluarkan token")
	}
	if len(dupHdr.Values("Set-Cookie")) > 0 {
		t.Fatal("duplikat JTI tidak boleh menyetel cookie")
	}

	var sessionsAfterDup int64
	db.Model(&models.UserSession{}).Where("user_id = ? AND is_revoked = ?", staff.ID, false).Count(&sessionsAfterDup)
	if sessionsAfterDup != sessionsBeforeDup {
		t.Fatalf("duplikat JTI menambah sesi dari %d menjadi %d", sessionsBeforeDup, sessionsAfterDup)
	}

	// Pastikan backupCodes[1] TIDAK ikut terbakar saat JTI duplikat ditolak!
	_, login4, _ := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
		"email": staff.Email, "password": "SandiKuat#2026!", "portal": "admin",
	})
	ch4, _ := login4["challenge"].(string)
	stBC2, _, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
		"challenge": ch4, "code": backupCodes[1], "factor_type": "backup_code",
	})
	if stBC2 != fiber.StatusOK {
		t.Fatalf("backupCodes[1] seharusnya belum terpakai, namun gagal ditukarkan: %d", stBC2)
	}

	// 4. Brute-force lockout: retry identik dihitung 1x, 3 salah per JTI menghanguskan JTI, 5 salah mengunci akun (429).
	_, loginBF1, _ := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
		"email": staff.Email, "password": "SandiKuat#2026!", "portal": "admin",
	})
	chBF1, _ := loginBF1["challenge"].(string)

	// Kirim kode salah "111111" dua kali pada challenge yang sama -> idempotent (attempt = 1).
	for i := 0; i < 2; i++ {
		stWrong, _, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
			"challenge": chBF1, "code": "111111", "factor_type": "totp",
		})
		if stWrong != fiber.StatusUnauthorized {
			t.Fatalf("kode salah harus 401, dapat %d", stWrong)
		}
	}
	var lockAfterRetry models.MFAAccountLockout
	db.Where("user_id = ?", staff.ID).First(&lockAfterRetry)
	if lockAfterRetry.FailedAttempts != 1 {
		t.Fatalf("retry identik seharusnya dihitung 1 percobaan, tercatat %d", lockAfterRetry.FailedAttempts)
	}

	// Kirim 2 kode salah berbeda lagi pada chBF1 -> total di chBF1 = 3 (kuota JTI habis).
	for _, wrong := range []string{"222222", "333333"} {
		doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
			"challenge": chBF1, "code": wrong, "factor_type": "totp",
		})
	}
	// Percobaan ke-4 pada chBF1 langsung ditolak sebagai MFA_CHALLENGE_EXHAUSTED bahkan dengan backup code sah!
	stExh, exhBody, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
		"challenge": chBF1, "code": backupCodes[2], "factor_type": "backup_code",
	})
	if stExh != fiber.StatusUnauthorized || exhBody["code"] != "MFA_CHALLENGE_EXHAUSTED" {
		t.Fatalf("challenge dengan 3 gagal harus 401 MFA_CHALLENGE_EXHAUSTED, dapat %d (%v)", stExh, exhBody["code"])
	}

	// Minta challenge baru chBF2 lalu kirim kode salah ke-4 dan ke-5 -> ke-5 memicu 429 MFA_LOCKED!
	_, loginBF2, _ := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
		"email": staff.Email, "password": "SandiKuat#2026!", "portal": "admin",
	})
	chBF2, _ := loginBF2["challenge"].(string)

	st4, _, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
		"challenge": chBF2, "code": "444444", "factor_type": "totp",
	})
	if st4 != fiber.StatusUnauthorized {
		t.Fatalf("percobaan salah ke-4 harus 401, dapat %d", st4)
	}
	st5, body5, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
		"challenge": chBF2, "code": "555555", "factor_type": "totp",
	})
	if st5 != fiber.StatusTooManyRequests || body5["code"] != "MFA_LOCKED" {
		t.Fatalf("percobaan salah ke-5 harus 429 MFA_LOCKED, dapat %d (%v)", st5, body5["code"])
	}

	// Saat terkunci, baik /api/login maupun /api/auth/mfa/verify dengan kode SAH wajib ditolak 429!
	stLockedLogin, lockedLoginBody, _ := doJSONReq(t, app, "POST", "/api/login", "", map[string]interface{}{
		"email": staff.Email, "password": "SandiKuat#2026!", "portal": "admin",
	})
	if stLockedLogin != fiber.StatusTooManyRequests || lockedLoginBody["code"] != "MFA_LOCKED" {
		t.Fatalf("login saat terkunci harus 429 MFA_LOCKED, dapat %d (%v)", stLockedLogin, lockedLoginBody["code"])
	}

	stLockedVerify, _, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/verify", "", map[string]interface{}{
		"challenge": chBF2, "code": backupCodes[2], "factor_type": "backup_code",
	})
	if stLockedVerify != fiber.StatusTooManyRequests {
		t.Fatalf("verify kode sah saat terkunci tetap harus 429, dapat %d", stLockedVerify)
	}
}

// TestSensitiveMutationsReauthStepUpDisableAndSessionRevocation memverifikasi:
//   - Staf platform DILARANG menonaktifkan MFA (403 MFA_MANDATORY_FOR_STAFF).
//   - Perubahan sandi akun ber-MFA wajib re-auth segar + mfa_code (428 bila kosong) dan mencabut sesi lama.
//   - Disable MFA merchant opt-in wajib re-auth <= 10 menit (401 bila basi tanpa sandi), mencabut sesi lama,
//     dan mengizinkan pendaftaran ulang langsung tanpa terjebak step TOTP lama.
//   - RBAC CreateStaffUser & AssignStaffRole menyetel TwoFactorEnforced=true serta mencabut sesi lama.
func TestSensitiveMutationsReauthStepUpDisableAndSessionRevocation(t *testing.T) {
	db := newTestDB(t)
	cfg := testCfg()
	app, _, _ := newFullMFARoutingApp(t, db, cfg)

	// 1. Staf tidak boleh mematikan MFA meskipun sesi segar + password + TOTP benar.
	staff := models.User{
		Name:              "Superadmin",
		Email:             "sa-disable@catavor.test",
		PlatformRole:      "superadmin",
		HasCustomPassword: true,
		TokenVersion:      1,
	}
	if err := staff.SetPassword("AdminKuat#2026!"); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&staff).Error; err != nil {
		t.Fatal(err)
	}
	staffSecret, _ := seedEnrolledMFAForUser(t, db, cfg, staff.ID, true)
	staffTok, staffJTI, staffExp, err := middleware.GenerateTokenWithIDVerified(&staff, nil, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := services.CreateDurableUserSession(db, staff.ID, staffJTI, staffExp, "127.0.0.1", "test"); err != nil {
		t.Fatal(err)
	}
	staffCode, _ := security.GenerateTOTPCode(staffSecret, security.TOTPStepAt(time.Now().UTC()))
	stStaffDis, staffDisBody, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/disable", staffTok, map[string]interface{}{
		"code":             staffCode,
		"current_password": "AdminKuat#2026!",
	})
	if stStaffDis != fiber.StatusForbidden || staffDisBody["code"] != "MFA_MANDATORY_FOR_STAFF" {
		t.Fatalf("disable MFA oleh staf harus 403 MFA_MANDATORY_FOR_STAFF, dapat %d (%v)", stStaffDis, staffDisBody["code"])
	}

	// 2. Merchant opt-in: UpdateProfile (ganti sandi) & Disable MFA dengan sesi basi (> 10 menit).
	merch := models.User{
		Name:              "Merchant Sensitif",
		Email:             "merch-sec@catavor.test",
		PlatformRole:      "merchant",
		HasCustomPassword: true,
		TokenVersion:      1,
	}
	if err := merch.SetPassword("SandiAwal#2026!"); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&merch).Error; err != nil {
		t.Fatal(err)
	}
	store := models.Store{UserID: merch.ID, Slug: "toko-sec", StoreTitle: "Toko Sec", Plan: "free"}
	if err := db.Create(&store).Error; err != nil {
		t.Fatal(err)
	}
	merchSecret, merchBackups := seedEnrolledMFAForUser(t, db, cfg, merch.ID, false)

	staleAuthAt := time.Now().UTC().Add(-15 * time.Minute)
	staleTok, staleJTI, staleExp, err := middleware.GenerateTokenWithOptions(&merch, &store, cfg, middleware.TokenOptions{
		MFAVerified: true,
		AuthAt:      staleAuthAt,
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := services.CreateDurableUserSession(db, merch.ID, staleJTI, staleExp, "127.0.0.1", "browser-1"); err != nil {
		t.Fatal(err)
	}
	// Buat juga sesi kedua (perangkat lain) untuk memverifikasi pencabutan lintas perangkat.
	otherTok, otherJTI, otherExp, err := middleware.GenerateTokenWithIDVerified(&merch, &store, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := services.CreateDurableUserSession(db, merch.ID, otherJTI, otherExp, "127.0.0.2", "browser-2"); err != nil {
		t.Fatal(err)
	}

	// 2a. UpdateProfile ganti sandi tanpa mfa_code -> 428 MFA_STEP_UP_REQUIRED.
	stNoMFA, noMFABody, _ := doJSONReq(t, app, "PUT", "/api/profile", staleTok, map[string]interface{}{
		"current_password": "SandiAwal#2026!",
		"password":         "SandiKedua#2026!",
		"confirm_password": "SandiKedua#2026!",
	})
	if stNoMFA != fiber.StatusPreconditionRequired || noMFABody["code"] != "MFA_STEP_UP_REQUIRED" {
		t.Fatalf("ganti sandi tanpa mfa_code harus 428 MFA_STEP_UP_REQUIRED, dapat %d (%v)", stNoMFA, noMFABody["code"])
	}

	// 2b. UpdateProfile ganti sandi dengan current_password + backup code sah -> 200 & mencabut otherTok.
	stProfOK, profBody, _ := doJSONReq(t, app, "PUT", "/api/profile", staleTok, map[string]interface{}{
		"current_password": "SandiAwal#2026!",
		"password":         "SandiKedua#2026!",
		"confirm_password": "SandiKedua#2026!",
		"mfa_code":         merchBackups[0],
		"factor_type":      "backup_code",
	})
	if stProfOK != fiber.StatusOK {
		t.Fatalf("ganti sandi dengan mfa_code sah harus 200, dapat %d: %v", stProfOK, profBody)
	}
	afterPwdTok, _ := profBody["token"].(string)
	if afterPwdTok == "" {
		t.Fatal("UpdateProfile ganti sandi wajib mengembalikan token baru")
	}
	if stOther, _, _ := doJSONReq(t, app, "GET", "/api/merchant/ping", otherTok, nil); stOther != fiber.StatusUnauthorized {
		t.Fatalf("sesi perangkat lain harus dicabut (401) setelah ganti sandi, dapat %d", stOther)
	}

	// 3. Disable MFA: buat sesi basi baru untuk menguji penolakan REAUTH_REQUIRED bila tanpa password.
	var refreshedMerch models.User
	db.First(&refreshedMerch, merch.ID)
	staleTok2, staleJTI2, staleExp2, err := middleware.GenerateTokenWithOptions(&refreshedMerch, &store, cfg, middleware.TokenOptions{
		MFAVerified: true,
		AuthAt:      time.Now().UTC().Add(-20 * time.Minute),
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := services.CreateDurableUserSession(db, refreshedMerch.ID, staleJTI2, staleExp2, "127.0.0.1", "browser-3"); err != nil {
		t.Fatal(err)
	}

	totpNow, _ := security.GenerateTOTPCode(merchSecret, security.TOTPStepAt(time.Now().UTC()))
	stDisStale, disStaleBody, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/disable", staleTok2, map[string]interface{}{
		"code": totpNow,
	})
	if stDisStale != fiber.StatusUnauthorized || disStaleBody["code"] != "REAUTH_REQUIRED" {
		t.Fatalf("disable dengan sesi > 10m tanpa password harus 401 REAUTH_REQUIRED, dapat %d (%v)", stDisStale, disStaleBody["code"])
	}

	// Sekarang sertakan current_password + TOTP sah -> 200 OK & sesi lama (afterPwdTok & staleTok2) dicabut!
	stDisOK, disOKBody, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/disable", staleTok2, map[string]interface{}{
		"code":             totpNow,
		"current_password": "SandiKedua#2026!",
	})
	if stDisOK != fiber.StatusOK {
		t.Fatalf("disable dengan re-auth + TOTP sah harus 200, dapat %d: %v", stDisOK, disOKBody)
	}
	postDisableTok, _ := disOKBody["token"].(string)
	if stOld1, _, _ := doJSONReq(t, app, "GET", "/api/merchant/ping", afterPwdTok, nil); stOld1 != fiber.StatusUnauthorized {
		t.Fatalf("sesi pra-disable (afterPwdTok) harus 401, dapat %d", stOld1)
	}
	if stOld2, _, _ := doJSONReq(t, app, "GET", "/api/merchant/ping", staleTok2, nil); stOld2 != fiber.StatusUnauthorized {
		t.Fatalf("sesi pra-disable (staleTok2) harus 401, dapat %d", stOld2)
	}
	if stPost, _, _ := doJSONReq(t, app, "GET", "/api/merchant/ping", postDisableTok, nil); stPost != fiber.StatusOK {
		t.Fatalf("sesi baru pasca-disable harus valid (200), dapat %d", stPost)
	}

	// Pastikan merchant bisa langsung re-enroll pada jendela 30 detik yang sama dengan secret baru.
	stReEnroll, reEnrollBody, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/enroll", postDisableTok, map[string]interface{}{})
	if stReEnroll != fiber.StatusOK {
		t.Fatalf("re-enroll pasca-disable harus 200, dapat %d", stReEnroll)
	}
	reData, _ := reEnrollBody["data"].(map[string]interface{})
	newSecret, _ := reData["secret"].(string)
	newCode, _ := security.GenerateTOTPCode(newSecret, security.TOTPStepAt(time.Now().UTC()))
	stReConfirm, _, _ := doJSONReq(t, app, "POST", "/api/auth/mfa/confirm", postDisableTok, map[string]interface{}{
		"code": newCode,
	})
	if stReConfirm != fiber.StatusOK {
		t.Fatalf("re-confirm di jendela 30 detik yang sama harus 200, dapat %d", stReConfirm)
	}

	// 4. RBAC CreateStaffUser & AssignStaffRole: wajib TwoFactorEnforced=true & mencabut sesi.
	for _, slug := range []string{"support", "compliance"} {
		db.Create(&models.PlatformRole{Slug: slug, Name: strings.Title(slug), IsSystem: true})
	}
	createdStaff, err := services.GetRBACService().CreateStaffUser(services.CreateStaffParams{
		Name:     "Petugas Baru",
		Email:    "new-support@catavor.test",
		Password: "PetugasBaru#2026!",
		RoleSlug: "support",
		Actor:    &staff,
	})
	if err != nil {
		t.Fatalf("CreateStaffUser: %v", err)
	}
	if !createdStaff.TwoFactorEnforced {
		t.Fatal("CreateStaffUser wajib menyetel TwoFactorEnforced=true")
	}

	// Buat sesi aktif untuk createdStaff (misal setelah enroll), lalu ubah role-nya via AssignStaffRole -> sesi harus dicabut.
	seedEnrolledMFAForUser(t, db, cfg, createdStaff.ID, true)
	csTok, csJTI, csExp, _ := middleware.GenerateTokenWithIDVerified(createdStaff, nil, cfg)
	if _, err := services.CreateDurableUserSession(db, createdStaff.ID, csJTI, csExp, "127.0.0.1", "staff-ua"); err != nil {
		t.Fatal(err)
	}
	if err := services.GetRBACService().AssignStaffRole(createdStaff.Email, "compliance", &staff); err != nil {
		t.Fatalf("AssignStaffRole: %v", err)
	}
	if stAfterRole, _, _ := doJSONReq(t, app, "GET", "/api/admin/ping", csTok, nil); stAfterRole != fiber.StatusUnauthorized {
		t.Fatalf("sesi staf harus dicabut (401) saat role diubah oleh superadmin, dapat %d", stAfterRole)
	}
}
