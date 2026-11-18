package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/mfa"
	"catavor-backend/internal/middleware"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"
	"catavor-backend/internal/services"
	"catavor-backend/internal/storage"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

var validate = validator.New()

type LoginRequest struct {
	Email     string `json:"email" validate:"required,email,max=254"`
	Password  string `json:"password" validate:"required,max=72"`
	StoreSlug string `json:"store_slug"`
	Portal    string `json:"portal"`
}

type RegisterRequest struct {
	Name                    string  `json:"name"`
	Email                   string  `json:"email"`
	Password                string  `json:"password"`
	VerificationToken       string  `json:"verification_token"`
	GoogleRegistrationToken string  `json:"google_registration_token,omitempty"`
	Credential              string  `json:"credential,omitempty"`
	IDToken                 string  `json:"id_token,omitempty"`
	Token                   string  `json:"token,omitempty"`
	StoreSlug               string  `json:"store_slug"`
	Slug                    string  `json:"slug"`
	StoreName               string  `json:"store_name"`
	StoreTitle              string  `json:"store_title"`
	GoogleID                string  `json:"google_id"`
	Avatar                  string  `json:"avatar"`
	Plan                    string  `json:"plan"`
	BillingCycle            string  `json:"billing_cycle"`
	PaymentMethod           string  `json:"payment_method"`
	PaymentMode             string  `json:"payment_mode"`
	PaymentStatus           string  `json:"payment_status"`
	PaymentProofURL         string  `json:"payment_proof_url"`
	PaymentNote             string  `json:"payment_note"`
	SenderAccountName       string  `json:"sender_account_name"`
	SenderPhone             string  `json:"sender_phone"`
	CouponCode              string  `json:"coupon_code"`
	AmountPaid              float64 `json:"amount_paid"`
	WhatsappNumber          string  `json:"whatsapp_number"`
	RegistrationTimezone    string  `json:"registration_timezone"`
	Timezone                string  `json:"timezone"`
	WebsiteHP               string  `json:"website_hp,omitempty"` // Anti-bot honeypot field
}

type CheckEmailRequest struct {
	Email string `json:"email"`
}

type SendRegistrationOTPRequest struct {
	Email     string `json:"email"`
	Name      string `json:"name"`
	WebsiteHP string `json:"website_hp,omitempty"` // Anti-bot honeypot field
}

type VerifyRegistrationOTPRequest struct {
	Email string `json:"email"`
	OTP   string `json:"otp"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

type ForgotPasswordResetRequest struct {
	Email           string `json:"email"`
	OTP             string `json:"otp"`
	NewPassword     string `json:"new_password"`
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirm_password"`
	MFACode         string `json:"mfa_code,omitempty"`
	Code            string `json:"code,omitempty"`
	FactorType      string `json:"factor_type,omitempty"`
}

type GoogleAuthRequest struct {
	Email      string `json:"email"`
	Name       string `json:"name"`
	GoogleID   string `json:"google_id"`
	Avatar     string `json:"avatar"`
	Credential string `json:"credential"`
	IDToken    string `json:"id_token"`
	Token      string `json:"token"`
	Portal     string `json:"portal"`
	StoreName  string `json:"store_name"`
	StoreSlug  string `json:"store_slug"`
	Plan       string `json:"plan"`
	Timezone   string `json:"timezone"`
}

type UpdateProfileRequest struct {
	Name            string `json:"name"`
	Email           string `json:"email"`
	CurrentPassword string `json:"current_password"`
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirm_password"`
	OTP             string `json:"otp"`
	MFACode         string `json:"mfa_code"`
	Code            string `json:"code"`
	FactorType      string `json:"factor_type"`
}

type StoreSummary struct {
	ID               uint   `json:"id"`
	Slug             string `json:"slug"`
	StoreTitle       string `json:"store_title"`
	StoreSlogan      string `json:"store_slogan"`
	StoreTheme       string `json:"store_theme"`
	StoreLogoURL     string `json:"store_logo_url"`
	Plan             string `json:"plan"`
	PaymentStatus    string `json:"payment_status"`
	WhatsappNumber   string `json:"whatsapp_number"`
	ItemCount        int64  `json:"item_count"`
	DormancyStatus   string `json:"dormancy_status,omitempty"`
	SuspensionReason string `json:"suspension_reason,omitempty"`
	IsSuspended      bool   `json:"is_suspended"`
	IsBlacklisted    bool   `json:"is_blacklisted"`
}

// preloadUserStores memuat relasi Stores dengan urutan yang DETERMINISTIK.
//
// Tanpa ORDER BY, Postgres/GORM mengembalikan baris dalam urutan fisik yang
// tidak dijamin. Kode pemanggil memakai Stores[0] sebagai toko default saat
// login, sehingga urutan acak membuat pengguna dengan beberapa toko bisa
// mendarat di toko yang salah (pernah teramati: toko blacklisted jadi default).
//
// Urutan: toko non-suspended & non-blacklisted lebih dulu, lalu toko aktif,
// lalu id terkecil. Hasilnya stabil dan toko yang bisa dipakai selalu menang.
func preloadUserStores(q *gorm.DB) *gorm.DB {
	return q.Preload("Stores", func(db *gorm.DB) *gorm.DB {
		return db.Order("is_blacklisted ASC, is_suspended ASC, id ASC")
	})
}

// buildStoreSummaries menyusun ringkasan toko untuk respons autentikasi.
func buildStoreSummaries(db *gorm.DB, stores []models.Store, singleStore *models.Store, targetSlug string) ([]StoreSummary, StoreSummary) {
	var list []StoreSummary
	for _, s := range stores {
		if s.DormancyStatus == "banned" || s.IsBlacklisted {
			continue
		}
		theme := s.StoreTheme
		if theme == "" {
			theme = "navy"
		}
		var itemCount int64
		db.Model(&models.Product{}).Where("store_id = ?", s.ID).Count(&itemCount)

		list = append(list, StoreSummary{
			ID:               s.ID,
			Slug:             s.Slug,
			StoreTitle:       s.StoreTitle,
			StoreSlogan:      s.StoreSlogan,
			StoreTheme:       theme,
			StoreLogoURL:     s.StoreLogoURL,
			Plan:             s.Plan,
			PaymentStatus:    s.PaymentStatus,
			WhatsappNumber:   s.WhatsappNumber,
			ItemCount:        itemCount,
			DormancyStatus:   s.DormancyStatus,
			SuspensionReason: s.SuspensionReason,
			IsSuspended:      s.IsSuspended || s.DormancyStatus == "suspended",
			IsBlacklisted:    s.IsBlacklisted,
		})
	}
	if len(list) == 0 && singleStore != nil && singleStore.DormancyStatus != "banned" && !singleStore.IsBlacklisted {
		theme := singleStore.StoreTheme
		if theme == "" {
			theme = "navy"
		}
		var itemCount int64
		db.Model(&models.Product{}).Where("store_id = ?", singleStore.ID).Count(&itemCount)

		summary := StoreSummary{
			ID:               singleStore.ID,
			Slug:             singleStore.Slug,
			StoreTitle:       singleStore.StoreTitle,
			StoreSlogan:      singleStore.StoreSlogan,
			StoreTheme:       theme,
			StoreLogoURL:     singleStore.StoreLogoURL,
			Plan:             singleStore.Plan,
			PaymentStatus:    singleStore.PaymentStatus,
			WhatsappNumber:   singleStore.WhatsappNumber,
			ItemCount:        itemCount,
			DormancyStatus:   singleStore.DormancyStatus,
			SuspensionReason: singleStore.SuspensionReason,
			IsSuspended:      singleStore.IsSuspended || singleStore.DormancyStatus == "suspended",
			IsBlacklisted:    singleStore.IsBlacklisted,
		}
		list = append(list, summary)
		return list, summary
	}

	if len(list) > 0 {
		if targetSlug != "" {
			for _, item := range list {
				if strings.EqualFold(item.Slug, targetSlug) {
					return list, item
				}
			}
		}
		return list, list[0]
	}

	return list, StoreSummary{StoreTheme: "navy"}
}

type GoogleCredentialVerifier func(credentialStr string, expectedClientID string) (email, name, googleID, avatar string, err error)

type AuthHandler struct {
	cfg            *config.Config
	db             *gorm.DB
	storage        storage.StorageService
	googleVerifier GoogleCredentialVerifier
}

const googleRegCookieName = "catavor_google_reg"
const googleRegTokenTTL = 30 * time.Minute

// IssueGoogleRegistrationToken menerbitkan bukti HMAC-SHA256 berumur 30 menit bahwa
// GoogleAuth baru saja memverifikasi kepemilikan email + googleID secara kriptografis.
func (h *AuthHandler) IssueGoogleRegistrationToken(email, googleID string) (string, error) {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	cleanGID := strings.TrimSpace(googleID)
	secret := ""
	if h.cfg != nil {
		secret = strings.TrimSpace(h.cfg.JWTSecret)
	}
	if cleanEmail == "" || cleanGID == "" || secret == "" {
		return "", errors.New("google registration token: parameter tidak lengkap")
	}
	exp := time.Now().UTC().Add(googleRegTokenTTL).Unix()
	payload := fmt.Sprintf("%s|%s|%d", cleanEmail, cleanGID, exp)
	payloadB64 := base64.RawURLEncoding.EncodeToString([]byte(payload))
	mac := hmac.New(sha256.New, []byte("catavor-google-reg-v1|"+secret))
	mac.Write([]byte(payloadB64))
	sig := hex.EncodeToString(mac.Sum(nil))
	return "grt_" + payloadB64 + "." + sig, nil
}

func (h *AuthHandler) verifyGoogleRegistrationToken(rawToken, expectedEmail, expectedGoogleID string) (string, bool) {
	trimmed := strings.TrimSpace(rawToken)
	raw, ok := strings.CutPrefix(trimmed, "grt_")
	if !ok {
		return "", false
	}
	parts := strings.Split(raw, ".")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", false
	}
	secret := ""
	if h.cfg != nil {
		secret = strings.TrimSpace(h.cfg.JWTSecret)
	}
	if secret == "" {
		return "", false
	}
	mac := hmac.New(sha256.New, []byte("catavor-google-reg-v1|"+secret))
	mac.Write([]byte(parts[0]))
	expectedSig := hex.EncodeToString(mac.Sum(nil))
	if subtle.ConstantTimeCompare([]byte(strings.ToLower(parts[1])), []byte(expectedSig)) != 1 {
		return "", false
	}
	decoded, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", false
	}
	fields := strings.Split(string(decoded), "|")
	if len(fields) != 3 {
		return "", false
	}
	tokEmail, tokGID, expStr := fields[0], fields[1], fields[2]
	expUnix, err := strconv.ParseInt(expStr, 10, 64)
	if err != nil || time.Now().UTC().Unix() > expUnix {
		return "", false
	}
	if !strings.EqualFold(tokEmail, strings.TrimSpace(expectedEmail)) {
		return "", false
	}
	if strings.TrimSpace(expectedGoogleID) != "" && tokGID != strings.TrimSpace(expectedGoogleID) {
		return "", false
	}
	return tokGID, tokGID != ""
}

func setGoogleRegCookie(c *fiber.Ctx, cfg *config.Config, token string) {
	if token == "" {
		return
	}
	secure := c.Secure() || (cfg != nil && cfg.AppEnv != "local" && cfg.AppEnv != "development" && cfg.AppEnv != "")
	c.Cookie(&fiber.Cookie{
		Name:     googleRegCookieName,
		Value:    token,
		Path:     "/",
		HTTPOnly: true,
		Secure:   secure,
		SameSite: "Lax",
		Expires:  time.Now().UTC().Add(googleRegTokenTTL),
	})
}

func clearGoogleRegCookie(c *fiber.Ctx, cfg *config.Config) {
	secure := c.Secure() || (cfg != nil && cfg.AppEnv != "local" && cfg.AppEnv != "development" && cfg.AppEnv != "")
	c.Cookie(&fiber.Cookie{
		Name:     googleRegCookieName,
		Value:    "",
		Path:     "/",
		HTTPOnly: true,
		Secure:   secure,
		SameSite: "Lax",
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})
}

func NewAuthHandler(cfg *config.Config, db *gorm.DB, strg ...storage.StorageService) *AuthHandler {
	h := &AuthHandler{
		cfg:            cfg,
		db:             db,
		googleVerifier: verifyGoogleCredential,
	}
	if len(strg) > 0 {
		h.storage = strg[0]
	}
	return h
}

// evaluateMFASessionGate mengevaluasi satu kebijakan MFA berbasis role untuk
// seluruh jalur penerbitan sesi. Mengembalikan allowSession=true HANYA jika
// sesi penuh boleh diterbitkan langsung tanpa faktor kedua. Bila false, respons
// HTTP yang sesuai (challenge 200, wajib setup 403, lockout 429, atau fail-closed 503)
// sudah ditulis ke c tanpa pernah menerbitkan token sesi maupun cookie.
func (h *AuthHandler) evaluateMFASessionGate(
	c *fiber.Ctx,
	user *models.User,
	method string,
	targetSlug string,
	storeList []StoreSummary,
	activeStore StoreSummary,
) (bool, error) {
	now := time.Now().UTC()
	mfaEnabled := h.cfg != nil && h.cfg.MFAEnabled
	var keyMat, jwtSecret string
	if h.cfg != nil {
		keyMat = h.cfg.MFAEncryptionKey
		jwtSecret = h.cfg.JWTSecret
	}

	gate := mfa.EvaluateLoginGate(h.db, user, mfaEnabled, keyMat, jwtSecret, now, targetSlug)
	switch gate.Action {
	case mfa.GateAllowSession:
		return true, nil

	case mfa.GateRequireChallenge:
		logAuthEvent(h.db, c, "AUTH_MFA_CHALLENGE", "Kredensial tahap pertama valid, menunggu faktor kedua", user, map[string]interface{}{
			"jti":    gate.JTI,
			"method": method,
		})
		return false, c.JSON(fiber.Map{
			"success":                  true,
			"mfa_required":             true,
			"requires_2fa":             true,
			"message":                  "Masukkan kode 6 digit dari aplikasi authenticator Anda.",
			"challenge":                gate.Token,
			"challenge_expires_at":     gate.ExpiresAt,
			"factors":                  []string{mfa.FactorTOTP, mfa.FactorBackupCode},
			"is_password_changed":      user.IsPasswordChanged,
			"has_custom_password":      user.HasCustomPassword,
			"active_store":             activeStore,
			"stores_count":             len(storeList),
			"requires_store_selection": activeStore.ID == 0 && len(storeList) > 0,
		})

	case mfa.GateRequireSetup:
		logAuthEvent(h.db, c, "AUTH_MFA_SETUP_REQUIRED", "Login staf platform ditahan: wajib menyelesaikan pendaftaran MFA", user, map[string]interface{}{
			"jti":    gate.JTI,
			"method": method,
			"role":   user.PlatformRole,
		})
		// Kredensial tahap pertama valid, tetapi sesi penuh & cookie TIDAK diterbitkan.
		// Klien hanya memperoleh setup_token berumur pendek yang terbatas pada /api/auth/mfa/*.
		return false, c.Status(fiber.StatusOK).JSON(fiber.Map{
			"success":            true,
			"code":               "MFA_SETUP_REQUIRED",
			"mfa_setup_required": true,
			"requires_2fa_setup": true,
			"setup_token":        gate.Token,
			"setup_expires_at":   gate.ExpiresAt,
			"message":            "Seluruh staf pengelola platform wajib mengaktifkan verifikasi dua langkah (MFA) sebelum dapat mengakses sistem.",
		})

	case mfa.GateRejectLocked:
		logAuthEvent(h.db, c, "AUTH_MFA_LOCKED", "Autentikasi ditolak: faktor kedua sementara dikunci", user, map[string]interface{}{
			"method": method,
		})
		return false, c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
			"success": false,
			"code":    "MFA_LOCKED",
			"message": "Terlalu banyak percobaan faktor kedua yang salah. Akun sementara dikunci.",
		})

	default:
		log.Error().Err(gate.Err).Uint("user_id", user.ID).Str("method", method).Msg("mfa: gate fail-closed")
		return false, c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"code":    "MFA_SERVICE_UNAVAILABLE",
			"message": "Layanan verifikasi keamanan sedang tidak dapat memproses permintaan ini.",
		})
	}
}

// mintDurableSession membuat JWT sesi penuh dan menyimpannya ke tabel user_sessions
// secara sinkron sebelum token/cookie dikembalikan ke klien (fail-closed pada error DB).
func (h *AuthHandler) mintDurableSession(c *fiber.Ctx, user *models.User, store *models.Store, opts middleware.TokenOptions) (string, string, time.Time, error) {
	if h.db == nil || h.cfg == nil {
		return "", "", time.Time{}, services.ErrSessionStorageUnavailable
	}
	token, tokenID, expiresAt, err := middleware.GenerateTokenWithOptions(user, store, h.cfg, opts)
	if err != nil {
		return "", "", time.Time{}, err
	}
	if _, err := services.CreateDurableUserSession(h.db, user.ID, tokenID, expiresAt, c.IP(), c.Get("User-Agent")); err != nil {
		return "", "", time.Time{}, err
	}
	middleware.RegisterSessionFingerprint(tokenID, c.IP(), c.Get("User-Agent"))
	return token, tokenID, expiresAt, nil
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data login tidak valid.",
		})
	}

	if err := validate.Struct(req); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Email dan password wajib diisi.",
		})
	}

	cleanedEmail := strings.ToLower(strings.TrimSpace(req.Email))

	// Security Defense: Check if account is temporarily locked due to excessive failed attempts
	isLocked, remaining := database.IsAccountLoginLocked(cleanedEmail)
	if isLocked {
		mins := int(remaining.Minutes()) + 1
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
			"success": false,
			"code":    "ACCOUNT_LOCKED",
			"message": fmt.Sprintf("Akun Anda sementara dikunci karena terlalu banyak percobaan salah. Harap coba lagi dalam %d menit.", mins),
		})
	}

	var user models.User
	if err := preloadUserStores(h.db.Preload("Store")).Where("LOWER(email) = ?", cleanedEmail).First(&user).Error; err != nil {
		_, _ = database.RecordLoginFailure(cleanedEmail)
		// N-35: login gagal untuk email yang tidak terdaftar. Email TIDAK
		// dimasukkan sebagai aktor (tidak ada user), hanya ke Changes agar
		// pola enumerasi/brute force terlihat di audit log.
		logAuthEvent(h.db, c, "AUTH_LOGIN_FAILED", "Login gagal: email tidak terdaftar", nil, map[string]interface{}{
			"method": "password",
			"reason": "unknown_email",
			"email":  cleanedEmail,
		})
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Email atau kata sandi yang Anda masukkan salah.",
		})
	}

	if !user.CheckPassword(req.Password) {
		attempts, locked := database.RecordLoginFailure(cleanedEmail)
		logAuthEvent(h.db, c, "AUTH_LOGIN_FAILED", "Login gagal: kata sandi salah", &user, map[string]interface{}{
			"method":   "password",
			"reason":   "bad_password",
			"attempts": attempts,
			"locked":   locked,
		})
		if locked {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"code":    "ACCOUNT_LOCKED",
				"message": "Terlalu banyak percobaan kata sandi salah. Akun Anda sementara dikunci selama 15 menit demi keamanan.",
			})
		}
		remainingAttempts := 5 - attempts
		if remainingAttempts > 0 && remainingAttempts <= 2 {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"message": fmt.Sprintf("Email atau kata sandi yang Anda masukkan salah. Sisa kesempatan: %d kali sebelum akun dikunci sementara.", remainingAttempts),
			})
		}
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Email atau kata sandi yang Anda masukkan salah.",
		})
	}

	// Reset failed attempts counter on successful password verification
	database.ResetLoginFailures(cleanedEmail)

	isPlatformAdmin := strings.EqualFold(user.PlatformRole, "superadmin") ||
		user.IsPlatformStaff()

	// Enterprise Portal Separation & Stealth Defense (Opsi 1)
	requestedPortal := strings.ToLower(strings.TrimSpace(req.Portal))
	if requestedPortal == "" {
		requestedPortal = strings.ToLower(strings.TrimSpace(c.Get("X-Auth-Portal")))
	}

	if isPlatformAdmin {
		// Akun Staf Pengelola Platform WAJIB masuk melalui portal resmi /admin (portal: "admin")
		if requestedPortal != "admin" {
			logAuthEvent(h.db, c, "AUTH_LOGIN_PORTAL_MISMATCH", "Percobaan login akun staf pengelola melalui portal merchant ditolak (stealth)", &user, map[string]interface{}{
				"method": "password",
				"portal": requestedPortal,
				"reason": "admin_on_merchant_portal",
			})
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"message": "Email atau kata sandi yang Anda masukkan salah.",
			})
		}
	} else {
		// Akun Merchant biasa TIDAK DIIZINKAN masuk melalui konsol pengelola /admin (portal: "admin")
		if requestedPortal == "admin" {
			logAuthEvent(h.db, c, "AUTH_LOGIN_PORTAL_MISMATCH", "Percobaan login akun merchant melalui portal pengelola ditolak", &user, map[string]interface{}{
				"method": "password",
				"portal": requestedPortal,
				"reason": "merchant_on_admin_portal",
			})
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success":         false,
				"code":            "PORTAL_ACCESS_DENIED",
				"message":         "Akun Anda tidak memiliki hak akses ke konsol pengelola platform. Silakan masuk melalui portal merchant di /login.",
				"redirect_portal": "/login",
			})
		}
	}

	if !isPlatformAdmin && user.IsBlacklisted {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "USER_BLACKLISTED",
			"message": "Akun Anda telah dinonaktifkan secara permanen karena pelanggaran pedoman platform. Surat pemberitahuan resmi telah dikirimkan ke alamat email terdaftar Anda.",
		})
	}

	targetSlug := cleanSlug(req.StoreSlug)
	if targetSlug == "" {
		targetSlug = cleanSlug(c.Get("X-Store-Slug"))
	}
	storeList, activeStore := buildStoreSummaries(h.db, user.Stores, user.Store, targetSlug)

	if !isPlatformAdmin && len(storeList) == 0 && (len(user.Stores) > 0 || user.Store != nil) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "ALL_STORES_BANNED",
			"message": "Akun dan seluruh profil katalog Anda telah dinonaktifkan secara permanen oleh platform karena pelanggaran kepatuhan.",
		})
	}

	var primaryStore *models.Store
	if targetSlug != "" {
		for i := range user.Stores {
			if strings.EqualFold(user.Stores[i].Slug, targetSlug) {
				primaryStore = &user.Stores[i]
				break
			}
		}
		if primaryStore == nil && user.Store != nil && strings.EqualFold(user.Store.Slug, targetSlug) {
			primaryStore = user.Store
		}
	}
	if primaryStore == nil {
		if len(user.Stores) > 0 {
			primaryStore = &user.Stores[0]
		} else {
			primaryStore = user.Store
		}
	}

	allowSession, gateErr := h.evaluateMFASessionGate(c, &user, "password", targetSlug, storeList, activeStore)
	if !allowSession {
		return gateErr
	}

	token, _, _, err := h.mintDurableSession(c, &user, primaryStore, middleware.TokenOptions{
		MFAVerified: false,
	})
	if err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"code":    "SESSION_STORAGE_ERROR",
			"message": "Gagal menyimpan sesi login secara aman.",
		})
	}

	// Touch store activity upon admin login
	for _, st := range user.Stores {
		services.TouchStoreActivity(h.db, st.ID)
	}
	if user.Store != nil {
		services.TouchStoreActivity(h.db, user.Store.ID)
	}

	actorRole := user.PlatformStaffRoleLabel()
	var activeStoreID *uint
	if activeStore.ID > 0 {
		activeStoreID = &activeStore.ID
	}
	// Industry Standard Security: Detect logins from new or unrecognized devices / browsers
	var previousLoginCount int64
	h.db.Model(&models.ActivityLog{}).Where(
		"user_id = ? AND category = 'security' AND action = 'auth.login'",
		user.ID,
	).Count(&previousLoginCount)

	if previousLoginCount > 0 {
		var matchUA int64
		h.db.Model(&models.ActivityLog{}).Where(
			"user_id = ? AND category = 'security' AND action = 'auth.login' AND user_agent = ?",
			user.ID, c.Get("User-Agent"),
		).Count(&matchUA)

		if matchUA == 0 {
			// Unrecognized device / browser detected! Enqueue security alert email
			subj, body := services.BuildNewDeviceLoginSecurityEmail(user.Name, user.Email, c.Get("User-Agent"), c.IP())
			_, _ = services.EnqueueEmail(user.Email, user.Name, "Catavor Keamanan", subj, body, "security_alert", fmt.Sprintf("new_dev_%d_%d", user.ID, time.Now().Unix()))
		}
	}

	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		StoreID:     activeStoreID,
		UserID:      &user.ID,
		ActorRole:   actorRole,
		ActorName:   user.Name,
		ActorEmail:  user.Email,
		Action:      "auth.login",
		Category:    "security",
		EntityType:  "user",
		EntityID:    &user.ID,
		EntityTitle: user.Email,
		Description: fmt.Sprintf("Pengguna %s (%s) berhasil login ke sistem.", user.Name, user.Email),
		IPAddress:   c.IP(),
		UserAgent:   c.Get("User-Agent"),
	})

	// SECURITY (M1): JWT juga disimpan di cookie HttpOnly agar tidak bisa dicuri XSS.
	setSessionCookie(c, h.cfg, token)

	return c.JSON(fiber.Map{
		"success":                  true,
		"message":                  "Login berhasil.",
		"token":                    token,
		"is_password_changed":      user.IsPasswordChanged,
		"has_custom_password":      user.HasCustomPassword,
		"stores":                   storeList,
		"stores_count":             len(storeList),
		"requires_store_selection": activeStore.ID == 0 && len(storeList) > 0,
		"active_store":             activeStore,
		"user": fiber.Map{
			"id":                  user.ID,
			"name":                user.Name,
			"email":               user.Email,
			"platform_role":       user.PlatformRole,
			"is_superadmin":       user.IsSuperadmin(),
			"is_admin":            user.IsPlatformStaff(),
			"permissions":         services.GetRBACService().GetUserPermissions(&user),
			"is_password_changed": user.IsPasswordChanged,
			"has_custom_password": user.HasCustomPassword,
			"store_slug":          activeStore.Slug,
			"store_title":         activeStore.StoreTitle,
			"store_theme":         activeStore.StoreTheme,
			"store_plan":          activeStore.Plan,
			"payment_status":      activeStore.PaymentStatus,
			"dormancy_status":     activeStore.DormancyStatus,
			"suspension_reason":   activeStore.SuspensionReason,
			"is_blacklisted":      user.IsBlacklisted || activeStore.IsBlacklisted,
		},
	})
}

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data pendaftaran tidak valid.",
		})
	}

	// Security Defense: Anti-bot honeypot check
	if security.IsBotHoneypotTriggered(req.WebsiteHP) {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Permintaan pendaftaran ditolak oleh filter keamanan sistem.",
		})
	}

	if req.StoreTitle == "" && req.StoreName != "" {
		req.StoreTitle = req.StoreName
	}
	if req.StoreSlug == "" && req.Slug != "" {
		req.StoreSlug = req.Slug
	}
	if req.RegistrationTimezone == "" && req.Timezone != "" {
		req.RegistrationTimezone = req.Timezone
	}

	req.Name = security.SanitizePlainText(req.Name, 100)
	req.StoreTitle = security.SanitizePlainText(req.StoreTitle, 100)
	req.StoreSlug = security.SanitizeSlug(req.StoreSlug)
	req.WhatsappNumber = security.SanitizePhone(req.WhatsappNumber)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	if req.GoogleID != "" && req.Name == "" {
		if req.StoreTitle != "" {
			req.Name = req.StoreTitle
		} else {
			req.Name = "Pemilik Toko"
		}
	}

	if req.StoreSlug == "" && req.StoreTitle != "" {
		req.StoreSlug = cleanSlug(req.StoreTitle)
	}

	if req.Name == "" || req.StoreSlug == "" || req.Email == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Mohon lengkapi Nama, Email, dan Link Username Toko.",
		})
	}

	if !security.ValidateEmail(req.Email) {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Format email tidak valid.",
		})
	}

	// SECURITY: Klaim registrasi Google SSO WAJIB dibuktikan secara kriptografis melalui salah satu:
	// 1. Token registrasi Google bertanda tangan HMAC (google_registration_token / cookie catavor_google_reg),
	// 2. Kredensial Google langsung (credential / id_token / token) yang diverifikasi ke Google,
	// 3. Sesi login aktif yang valid (Authorization / cookie catavor_session) milik user Google dengan email yang sama.
	// Mengirim "google_id" mentah di body JSON tanpa bukti kriptografis DITOLAK 401 untuk mencegah
	// bypass kebijakan kata sandi, bypass verifikasi email OTP, dan pengambilalihan akun tanpa toko.
	claimedGoogle := strings.TrimSpace(req.GoogleID) != ""
	isGoogleAuth := false
	var existingUser models.User
	var targetUser models.User
	userFound := false

	if req.Email != "" {
		if err := h.db.Preload("Store").Where("LOWER(email) = ?", strings.ToLower(req.Email)).First(&existingUser).Error; err == nil {
			userFound = true
		}
	}

	// Bukti A: google_registration_token dari respons GoogleAuth atau cookie HttpOnly catavor_google_reg
	candidateGRT := strings.TrimSpace(req.GoogleRegistrationToken)
	if candidateGRT == "" && strings.HasPrefix(strings.TrimSpace(req.VerificationToken), "grt_") {
		candidateGRT = strings.TrimSpace(req.VerificationToken)
	}
	if candidateGRT == "" {
		candidateGRT = strings.TrimSpace(c.Cookies(googleRegCookieName))
	}
	if candidateGRT != "" {
		if verifiedGID, ok := h.verifyGoogleRegistrationToken(candidateGRT, req.Email, req.GoogleID); ok {
			isGoogleAuth = true
			req.GoogleID = verifiedGID
		}
	}

	// Bukti B: Kredensial OAuth/ID Token Google langsung pada body request
	if !isGoogleAuth {
		rawCred := strings.TrimSpace(req.Credential)
		if rawCred == "" {
			rawCred = strings.TrimSpace(req.IDToken)
		}
		if rawCred == "" {
			rawCred = strings.TrimSpace(req.Token)
		}
		if rawCred != "" && h.googleVerifier != nil {
			expectedClientID := ""
			if h.cfg != nil {
				expectedClientID = h.cfg.GoogleClientID
			}
			if gEmail, gName, gSub, gAvatar, gErr := h.googleVerifier(rawCred, expectedClientID); gErr == nil && strings.EqualFold(gEmail, req.Email) && gSub != "" {
				if req.GoogleID == "" || req.GoogleID == gSub {
					isGoogleAuth = true
					req.GoogleID = gSub
					if req.Name == "" && gName != "" {
						req.Name = security.SanitizePlainText(gName, 100)
					}
					if req.Avatar == "" && gAvatar != "" {
						req.Avatar = gAvatar
					}
				}
			}
		}
	}

	// Bukti C: Sesi aktif yang sudah terautentikasi milik akun Google yang sama
	if !isGoogleAuth {
		if claims := middleware.ExtractOptionalClaims(c, h.cfg); claims != nil && claims.UserID > 0 && claims.ID != "" && !database.IsTokenBlacklisted(claims.ID) {
			var activeSessCount int64
			if !h.db.Migrator().HasTable(&models.UserSession{}) {
				activeSessCount = 1
			} else {
				h.db.Model(&models.UserSession{}).
					Where("token_id = ? AND user_id = ? AND is_revoked = false AND expires_at > ?", claims.ID, claims.UserID, time.Now().UTC()).
					Count(&activeSessCount)
			}
			if activeSessCount > 0 {
				var sessionUser models.User
				if h.db.Preload("Store").First(&sessionUser, claims.UserID).Error == nil &&
					!sessionUser.IsBlacklisted &&
					sessionUser.TokenVersion == claims.TokenVersion &&
					strings.EqualFold(sessionUser.Email, req.Email) &&
					sessionUser.GoogleID != nil && *sessionUser.GoogleID != "" {
					if req.GoogleID == "" || req.GoogleID == *sessionUser.GoogleID {
						isGoogleAuth = true
						req.GoogleID = *sessionUser.GoogleID
						existingUser = sessionUser
						userFound = true
					}
				}
			}
		}
	}

	if claimedGoogle && !isGoogleAuth {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"code":    "GOOGLE_VERIFICATION_REQUIRED",
			"message": "Sesi verifikasi Google tidak valid atau telah kedaluwarsa. Silakan ulangi masuk dengan Google.",
		})
	}

	// Bypass password validation completely for Google SSO users
	if !isGoogleAuth {
		if err := security.ValidatePassword(req.Password); err != nil {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"success": false,
				"message": safeErrMsg(err, "Permintaan tidak dapat diproses."),
			})
		}
	}

	slug := req.StoreSlug
	if len(slug) < 3 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Nama pengguna / slug toko minimal 3 karakter huruf atau angka.",
		})
	}

	if IsReservedSlug(slug) {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": fmt.Sprintf("Nama pengguna / slug toko '%s' adalah kata kunci sistem yang dicadangkan dan tidak dapat digunakan sebagai nama toko.", slug),
		})
	}

	// Check if email or slug is blacklisted due to permanent moderation ban
	var blacklistedUserCount int64
	h.db.Model(&models.User{}).Where("LOWER(email) = ? AND is_blacklisted = true", req.Email).Count(&blacklistedUserCount)
	if blacklistedUserCount > 0 {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Pendaftaran ditolak: Alamat email ini telah ditangguhkan secara permanen karena pelanggaran pedoman platform Catavor.",
		})
	}

	var blacklistedStoreCount int64
	h.db.Model(&models.Store{}).Where("LOWER(slug) = ? AND (is_blacklisted = true OR dormancy_status = 'banned')", slug).Count(&blacklistedStoreCount)
	if blacklistedStoreCount > 0 {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Pendaftaran ditolak: Nama pengguna / slug toko ini telah dinonaktifkan secara permanen dan tidak dapat digunakan kembali.",
		})
	}

	var blacklistedSlugCount int64
	h.db.Model(&models.BlacklistedSlug{}).Where("LOWER(slug) = ?", slug).Count(&blacklistedSlugCount)
	if blacklistedSlugCount > 0 {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Pendaftaran ditolak: Nama pengguna / slug toko ini telah dinonaktifkan secara permanen oleh platform dan tidak dapat digunakan kembali.",
		})
	}

	// Check store slug uniqueness
	var existingStore models.Store
	if err := h.db.Where("LOWER(slug) = ?", slug).First(&existingStore).Error; err == nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Nama pengguna toko sudah terpakai. Silakan pilih nama lain.",
		})
	}

	// PRE-FLIGHT VALIDATION (R4-L2): Validasi paket, kupon, status maintenance,
	// dan bukti pembayaran SEBELUM mengonsumsi OTP token dan SEBELUM menyimpan User baru.
	rawPlan := strings.ToLower(strings.TrimSpace(req.Plan))
	requestedPlan := "free"
	if rawPlan == "pro" || rawPlan == "pro_starter" {
		requestedPlan = "pro_starter"
	} else if rawPlan == "pro_business" {
		requestedPlan = "pro_business"
	}

	// Strict platform policy: Only monthly billing cycle is supported (no annual)
	billingCycle := "monthly"
	durationMonths := 1

	now := time.Now().UTC()
	var origAmount float64
	var discountAmount float64
	var finalAmount float64
	cleanCoupon := strings.ToUpper(strings.TrimSpace(req.CouponCode))

	if requestedPlan != "free" {
		planInfo, _ := services.GetPlanByCode(h.db, requestedPlan)
		if planInfo != nil {
			origAmount = planInfo.PriceMonthly
		} else {
			// Fallbacks
			if requestedPlan == "pro_business" {
				origAmount = 129000
			} else {
				origAmount = 30000
			}
		}

		if cleanCoupon != "" {
			validCoupon, disc, fin, err := services.ValidateCoupon(h.db, cleanCoupon, requestedPlan, origAmount)
			if err == nil && validCoupon != nil {
				discountAmount = disc
				finalAmount = fin
			} else {
				// Kupon tidak valid atau kedaluwarsa, abaikan dan gunakan harga normal
				finalAmount = origAmount
				cleanCoupon = ""
			}
		} else {
			finalAmount = origAmount
		}
	}

	// Security Defense Against Free Upgrade Exploit:
	// A paid plan is only activated immediately if the final payable amount is 0 (100% coupon applied).
	// If finalAmount > 0, the store starts in Free tier with payment_status 'pending_verification'
	// until an administrator verifies the bank transfer.
	actualStorePlan := "free"
	paymentStatus := "free_active"
	var planExpiresAt *time.Time
	planStatus := "active"
	customDomainStatus := "none"

	if requestedPlan != "free" {
		if finalAmount == 0 {
			actualStorePlan = requestedPlan
			paymentStatus = "paid"
			exp := now.AddDate(0, durationMonths, 0)
			planExpiresAt = &exp
			if requestedPlan == "pro_business" {
				customDomainStatus = "active"
			}
		} else {
			actualStorePlan = "free"
			paymentStatus = "pending_verification"
		}
	}

	var paymentSystemMode = "gateway_aulaa"
	var modeSetting models.Setting
	if err := h.db.Where("key = ?", "payment_system_mode").First(&modeSetting).Error; err == nil && modeSetting.Value != "" {
		paymentSystemMode = strings.TrimSpace(strings.ToLower(modeSetting.Value))
	}
	if requestedPlan != "free" && finalAmount > 0 && paymentSystemMode == "maintenance" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"code":    "PAYMENT_GATEWAY_MAINTENANCE",
			"message": "Sistem pembayaran saat ini sedang dalam pemeliharaan. Pendaftaran paket berbayar sementara ditangguhkan.",
		})
	}

	var validatedProofURL string
	if strings.TrimSpace(req.PaymentProofURL) != "" {
		trimmedProof := strings.TrimSpace(req.PaymentProofURL)
		// SECURITY (R3-1 Anti-IDOR): Registrant does not have a store or storage session yet.
		// Payment proof MUST be an uploaded data URI image, never an existing internal storage key.
		if !strings.HasPrefix(strings.ToLower(trimmedProof), "data:image/") {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Bukti transfer pembayaran untuk pendaftaran akun baru wajib berupa gambar (data:image/...;base64,...), bukan kunci penyimpanan internal.",
			})
		}
		cleanedProof, proofErr := security.ValidatePaymentProofURL(trimmedProof)
		if proofErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Bukti transfer pembayaran tidak valid: " + proofErr.Error(),
			})
		}
		validatedProofURL = cleanedProof
	}

	if requestedPlan != "free" && finalAmount > 0 && paymentSystemMode == "manual_qris" {
		if validatedProofURL == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Bukti transfer pembayaran wajib diunggah sebelum menyelesaikan pendaftaran paket berbayar.",
			})
		}
	}

	createdNewUser := false

	// Check email uniqueness and role isolation (merchant vs pengelola)
	if userFound {
		if existingUser.IsPlatformStaff() {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"success": false,
				"message": "Alamat email ini sudah terdaftar dalam sistem. Silakan gunakan alamat email lain atau masuk ke akun yang sudah terdaftar.",
			})
		}
		if isGoogleAuth {
			if existingUser.Store != nil {
				return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
					"success": false,
					"message": "Alamat email ini sudah terdaftar dalam sistem. Silakan gunakan alamat email lain atau masuk ke akun yang sudah terdaftar.",
				})
			}
			// Tolak pengaitan Google ID baru ke akun yang sebelumnya sudah punya Google ID berbeda
			if existingUser.GoogleID != nil && *existingUser.GoogleID != "" && *existingUser.GoogleID != req.GoogleID {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"success": false,
					"code":    "GOOGLE_IDENTITY_MISMATCH",
					"message": "Identitas akun Google tidak cocok dengan akun terdaftar.",
				})
			}
			targetUser = existingUser
			if (targetUser.GoogleID == nil || *targetUser.GoogleID == "") && req.GoogleID != "" {
				targetUser.GoogleID = &req.GoogleID
				h.db.Save(&targetUser)
			}
		} else {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"success": false,
				"message": "Alamat email ini sudah terdaftar dalam sistem. Silakan gunakan alamat email lain atau masuk ke akun yang sudah terdaftar.",
			})
		}
	} else {
		nowUser := time.Now()
		// SECURITY (N-11): registrasi password manual wajib membawa verification_token yang sah.
		// Registrasi Google SSO dilewatkan karena email sudah terverifikasi di sisi Google.
		if !isGoogleAuth {
			if strings.TrimSpace(req.VerificationToken) == "" {
				return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
					"success": false,
					"message": "Verifikasi email wajib diselesaikan sebelum mendaftar.",
				})
			}
			if !services.GetOTPService().ValidateAndConsumeToken(req.Email, req.VerificationToken, "registration") {
				return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
					"success": false,
					"message": "Token verifikasi tidak valid atau sudah kedaluwarsa. Silakan minta kode baru.",
				})
			}
		}

		newUser := models.User{
			Name:              req.Name,
			Email:             req.Email,
			EmailVerifiedAt:   &nowUser,
			IsPasswordChanged: true,
		}
		if isGoogleAuth {
			googleID := req.GoogleID
			if googleID == "" {
				googleID = "G_" + uuid.New().String()[:12]
			}
			newUser.GoogleID = &googleID
			newUser.HasCustomPassword = false
			_ = newUser.SetPassword("G_SSO_" + googleID + "_" + uuid.New().String()[:8])
		} else {
			newUser.HasCustomPassword = true
			if err := newUser.SetPassword(req.Password); err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"success": false,
					"message": "Gagal memproses kata sandi.",
				})
			}
		}

		if err := h.db.Create(&newUser).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal mendaftarkan akun.",
			})
		}
		createdNewUser = true
		targetUser = newUser
	}

	storeTitle := req.StoreTitle
	if storeTitle == "" {
		storeTitle = req.Name + " Store"
	}

	tz := strings.TrimSpace(req.RegistrationTimezone)
	if tz == "" {
		tz = "Asia/Jakarta"
	}

	// Universal Default Master Data
	defaultClasses, _ := json.Marshal([]string{"Pakaian & Busana", "Aksesoris & Fashion", "Gadget & Elektronik", "Kebutuhan Rumah Tangga", "Kerajinan Tangan"})
	defaultHabitats, _ := json.Marshal([]string{"Item Baru (Ready Stock)", "Pre-Order (PO)", "Varian Koleksi Khusus"})
	defaultStatuses, _ := json.Marshal([]string{"Tersedia (Ready Stock)", "Habis (Sold Out)", "Stok Terbatas (Limited)"})
	defaultShipping, _ := json.Marshal([]string{"Bisa Kirim Seluruh Indonesia", "Jabodetabek Saja", "Ambil Sendiri di Toko"})

	newStore := models.Store{
		UserID:                  targetUser.ID,
		Slug:                    slug,
		StoreTitle:              storeTitle,
		StoreSlogan:             "Memudahkan pelanggan menjelajahi produk dan informasi bisnis.",
		WhatsappNumber:          req.WhatsappNumber,
		Plan:                    actualStorePlan,
		PlanStatus:              planStatus,
		PlanExpiresAt:           planExpiresAt,
		CustomDomainStatus:      customDomainStatus,
		PaymentStatus:           paymentStatus,
		StoreTheme:              "navy",
		RegistrationTimezone:    tz,
		EnableWADirect:          true,
		EnableWARekber:          true,
		MasterClasses:           datatypes.JSON(defaultClasses),
		MasterHabitats:          datatypes.JSON(defaultHabitats),
		MasterStatuses:          datatypes.JSON(defaultStatuses),
		MasterShippingCoverages: datatypes.JSON(defaultShipping),
	}

	if err := h.db.Create(&newStore).Error; err != nil {
		if createdNewUser {
			h.db.Unscoped().Delete(&models.User{}, targetUser.ID)
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal membuat profil toko.",
		})
	}

	// If paid plan, record initial SubscriptionOrder
	var paymentURL string
	var uniqueCode int
	if requestedPlan != "free" {
		payMethod := strings.ToLower(strings.TrimSpace(req.PaymentMethod))
		if payMethod == "" {
			payMethod = "bank"
		}
		if finalAmount == 0 {
			payMethod = "coupon_free"
		}

		orderPaymentStatus := "paid"
		var orderPaidAt *time.Time = &now
		var orderExpiresAt *time.Time

		if finalAmount > 0 {
			orderPaymentStatus = "pending"
			orderPaidAt = nil
			orderTTL := time.Now().UTC().Add(2 * time.Hour)
			orderExpiresAt = &orderTTL

			if paymentSystemMode == "manual_qris" && payMethod == "bank" {
				uniqueCode, finalAmount = services.AllocateUniqueNominal(h.db, finalAmount)
			}
		}

		orderNumber := fmt.Sprintf("INV-SUB-%s-%04d-%04d", time.Now().Format("20060102150405"), newStore.ID%10000, (time.Now().Nanosecond()/1000)%10000)
		senderName := strings.TrimSpace(req.SenderAccountName)
		if senderName == "" && paymentSystemMode == "manual_qris" {
			senderName = strings.TrimSpace(req.Name)
		}
		senderPhone := strings.TrimSpace(req.SenderPhone)
		if senderPhone == "" {
			senderPhone = strings.TrimSpace(req.WhatsappNumber)
		}
		orderNotes := strings.TrimSpace(req.PaymentNote)
		if orderNotes == "" {
			orderNotes = fmt.Sprintf("Pendaftaran awal toko %s (%s)", storeTitle, requestedPlan)
		}
		subOrder := models.SubscriptionOrder{
			StoreID:           newStore.ID,
			UserID:            targetUser.ID,
			OrderNumber:       orderNumber,
			Type:              "initial",
			PlanCode:          requestedPlan,
			BillingCycle:      billingCycle,
			DurationMonths:    durationMonths,
			OriginalAmount:    origAmount,
			DiscountAmount:    discountAmount,
			FinalAmount:       finalAmount,
			UniqueCode:        uniqueCode,
			CouponCode:        cleanCoupon,
			PaymentMethod:     payMethod,
			PaymentMode:       paymentSystemMode,
			SenderAccountName: senderName,
			SenderPhone:       senderPhone,
			PaymentProofURL:   validatedProofURL,
			PaymentStatus:     orderPaymentStatus,
			Notes:             orderNotes,
			PaidAt:            orderPaidAt,
			ExpiresAt:         orderExpiresAt,
		}

		if paymentSystemMode == "gateway_aulaa" && finalAmount > 0 {
			subOrder.PaymentMode = "gateway_aulaa"
			subOrder.GatewayProvider = "aulaa"
			aulaaCfg := services.GetAulaaConfig(h.db)
			if aulaaCfg.APIKey != "" && !strings.Contains(aulaaCfg.APIKey, "xxxxxxxx") {
				baseOrigin := ""
				if h.cfg != nil && strings.TrimSpace(h.cfg.AppURL) != "" {
					baseOrigin = strings.TrimRight(h.cfg.AppURL, "/")
				} else {
					baseOrigin = strings.TrimRight(c.BaseURL(), "/")
				}
				redirectURL := fmt.Sprintf("%s/%s/admin?payment=success&order_number=%s", baseOrigin, newStore.Slug, orderNumber)
				aulaaResp, aErr := services.CreateAulaaPayment(aulaaCfg, services.AulaaCreatePaymentRequest{
					OrderID:       orderNumber,
					Amount:        finalAmount,
					RedirectURL:   redirectURL,
					PaymentMethod: payMethod,
				})
				if aErr == nil && aulaaResp != nil && aulaaResp.PaymentLink != "" {
					subOrder.GatewayReference = aulaaResp.ID
					subOrder.GatewayPaymentLink = aulaaResp.PaymentLink
					rawB, _ := json.Marshal(aulaaResp)
					subOrder.GatewayRawResponse = datatypes.JSON(rawB)
					paymentURL = aulaaResp.PaymentLink
				} else if aErr != nil {
					log.Warn().Err(aErr).Str("order_number", orderNumber).Msg("Aulaa payment initiation failed; proceeding with pending order")
				}
			} else {
				log.Warn().Str("order_number", orderNumber).Msg("Aulaa API key not configured in platform settings; proceeding with pending gateway order")
			}
		}

		_ = h.db.Create(&subOrder).Error
		if cleanCoupon != "" && discountAmount > 0 {
			_ = services.IncrementCouponUsage(h.db, cleanCoupon)
		}
	}

	singleSummary := StoreSummary{
		ID:             newStore.ID,
		Slug:           newStore.Slug,
		StoreTitle:     newStore.StoreTitle,
		StoreSlogan:    newStore.StoreSlogan,
		StoreTheme:     newStore.StoreTheme,
		Plan:           newStore.Plan,
		PaymentStatus:  newStore.PaymentStatus,
		WhatsappNumber: newStore.WhatsappNumber,
	}

	clearGoogleRegCookie(c, h.cfg)
	allowRegSession, regGateErr := h.evaluateMFASessionGate(c, &targetUser, "register", newStore.Slug, []StoreSummary{singleSummary}, singleSummary)
	if !allowRegSession {
		return regGateErr
	}

	token, _, _, sessErr := h.mintDurableSession(c, &targetUser, &newStore, middleware.TokenOptions{
		MFAVerified: false,
	})
	if sessErr != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"code":    "SESSION_STORAGE_ERROR",
			"message": "Pendaftaran tersimpan, namun sesi login gagal dibuat. Silakan masuk melalui halaman login.",
		})
	}

	regMsg := "Pendaftaran akun dan toko berhasil!"
	if requestedPlan != "free" && finalAmount > 0 {
		regMsg = "Pendaftaran berhasil! Akun dan katalog Anda telah aktif. Bukti pembayaran paket Pro Anda sedang dalam antrean verifikasi tim kami."
	}

	setSessionCookie(c, h.cfg, token)

	return c.JSON(fiber.Map{
		"success":      true,
		"message":      regMsg,
		"token":        token,
		"payment_url":  paymentURL,
		"stores":       []StoreSummary{singleSummary},
		"active_store": singleSummary,
		"user": fiber.Map{
			"id":                  targetUser.ID,
			"name":                targetUser.Name,
			"email":               targetUser.Email,
			"is_password_changed": true,
			"store_slug":          newStore.Slug,
			"store_title":         newStore.StoreTitle,
			"store_theme":         newStore.StoreTheme,
			"store_plan":          newStore.Plan,
			"payment_status":      newStore.PaymentStatus,
		},
	})
}

func (h *AuthHandler) GoogleAuth(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	var req GoogleAuthRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	credentialStr := req.Credential
	if credentialStr == "" {
		credentialStr = req.IDToken
	}
	if credentialStr == "" {
		credentialStr = req.Token
	}

	if credentialStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Kredensial token resmi Google wajib disertakan.",
		})
	}

	// Cryptographically verify Google credential via official Google endpoints
	verifier := h.googleVerifier
	if verifier == nil {
		verifier = verifyGoogleCredential
	}
	var expectedGoogleClientID string
	if h.cfg != nil {
		expectedGoogleClientID = h.cfg.GoogleClientID
	}
	verifiedEmail, verifiedName, verifiedGoogleID, verifiedAvatar, err := verifier(credentialStr, expectedGoogleClientID)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Verifikasi otentikasi Google gagal.",
		})
	}

	email := verifiedEmail
	name := verifiedName
	if name == "" {
		name = strings.TrimSpace(req.Name)
	}
	googleID := verifiedGoogleID
	avatar := verifiedAvatar
	if avatar == "" {
		avatar = strings.TrimSpace(req.Avatar)
	}

	if email == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mendapatkan email dari otentikasi Google.",
		})
	}

	email = strings.ToLower(email)

	// Check if user already exists
	var user models.User
	query := preloadUserStores(h.db.Preload("Store")).Where("LOWER(email) = ?", email)
	if googleID != "" {
		query = preloadUserStores(h.db.Preload("Store")).Where("LOWER(email) = ? OR google_id = ?", email, googleID)
	}

	err = query.First(&user).Error

	// CASE A: USER ALREADY EXISTS (LOGIN FLOW)
	if err == nil {
		// N-14: akun yang emailnya belum diverifikasi tidak boleh diambil alih
		// lewat Google SSO. Penjagaan hanya berlaku bila akun ini BELUM pernah
		// ditautkan ke Google (google_id kosong). Akun yang sudah punya
		// google_id berarti pemiliknya dulu masuk lewat Google dan emailnya
		// memang terverifikasi di sisi Google — mengunci mereka akan
		// menutup akses pemilik sah (terbukti 5 akun seperti ini di data
		// produksi).
		belumTertautGoogle := user.GoogleID == nil || *user.GoogleID == ""
		if user.EmailVerifiedAt == nil && belumTertautGoogle {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"message": "Akun dengan email ini belum diverifikasi. Selesaikan verifikasi email terlebih dahulu, atau masuk menggunakan kata sandi.",
			})
		}

		if belumTertautGoogle && googleID != "" {
			user.GoogleID = &googleID
			h.db.Save(&user)
		}

		isPlatformAdmin := strings.EqualFold(user.PlatformRole, "superadmin") || user.IsPlatformStaff()
		requestedPortal := strings.ToLower(strings.TrimSpace(req.Portal))
		if requestedPortal == "" {
			requestedPortal = strings.ToLower(strings.TrimSpace(c.Get("X-Auth-Portal")))
		}
		if isPlatformAdmin {
			if requestedPortal != "admin" {
				logAuthEvent(h.db, c, "AUTH_LOGIN_PORTAL_MISMATCH", "Percobaan Google SSO akun staf pengelola melalui portal merchant ditolak (stealth)", &user, map[string]interface{}{
					"method": "google_sso",
					"portal": requestedPortal,
					"reason": "admin_on_merchant_portal",
				})
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"success": false,
					"message": "Autentikasi gagal. Akun tidak memiliki izin untuk masuk melalui portal ini.",
				})
			}
		} else {
			if requestedPortal == "admin" {
				logAuthEvent(h.db, c, "AUTH_LOGIN_PORTAL_MISMATCH", "Percobaan Google SSO akun merchant melalui portal pengelola ditolak", &user, map[string]interface{}{
					"method": "google_sso",
					"portal": requestedPortal,
					"reason": "merchant_on_admin_portal",
				})
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"success":         false,
					"code":            "PORTAL_ACCESS_DENIED",
					"message":         "Akun Anda tidak memiliki hak akses ke konsol pengelola platform. Silakan masuk melalui portal merchant di /login.",
					"redirect_portal": "/login",
				})
			}
			if user.IsBlacklisted {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"success": false,
					"code":    "USER_BLACKLISTED",
					"message": "Akun Anda telah dinonaktifkan secara permanen karena pelanggaran pedoman platform.",
				})
			}
		}

		targetSlug := cleanSlug(req.StoreSlug)
		if targetSlug == "" {
			targetSlug = cleanSlug(c.Get("X-Store-Slug"))
		}
		storeList, activeStore := buildStoreSummaries(h.db, user.Stores, user.Store, targetSlug)

		if !isPlatformAdmin && len(storeList) == 0 && (len(user.Stores) > 0 || user.Store != nil) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "ALL_STORES_BANNED",
				"message": "Akun dan seluruh profil katalog Anda telah dinonaktifkan secara permanen oleh platform karena pelanggaran kepatuhan.",
			})
		}

		var primaryStore *models.Store
		if targetSlug != "" {
			for i := range user.Stores {
				if strings.EqualFold(user.Stores[i].Slug, targetSlug) {
					primaryStore = &user.Stores[i]
					break
				}
			}
			if primaryStore == nil && user.Store != nil && strings.EqualFold(user.Store.Slug, targetSlug) {
				primaryStore = user.Store
			}
		}
		if primaryStore == nil {
			if len(user.Stores) > 0 {
				primaryStore = &user.Stores[0]
			} else {
				primaryStore = user.Store
			}
		}

		allowSession, gateErr := h.evaluateMFASessionGate(c, &user, "google_sso", targetSlug, storeList, activeStore)
		if !allowSession {
			return gateErr
		}

		token, _, _, err := h.mintDurableSession(c, &user, primaryStore, middleware.TokenOptions{
			MFAVerified: false,
		})
		if err != nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"success": false,
				"code":    "SESSION_STORAGE_ERROR",
				"message": "Gagal menyimpan sesi login secara aman.",
			})
		}

		// Touch store activity upon Google login
		for _, st := range user.Stores {
			services.TouchStoreActivity(h.db, st.ID)
		}
		if user.Store != nil {
			services.TouchStoreActivity(h.db, user.Store.ID)
		}

		// Industry Standard Security: Detect logins from new or unrecognized devices / browsers
		var previousLoginCount int64
		h.db.Model(&models.ActivityLog{}).Where(
			"user_id = ? AND category = 'security' AND action = 'auth.login'",
			user.ID,
		).Count(&previousLoginCount)

		if previousLoginCount > 0 {
			var matchUA int64
			h.db.Model(&models.ActivityLog{}).Where(
				"user_id = ? AND category = 'security' AND action = 'auth.login' AND user_agent = ?",
				user.ID, c.Get("User-Agent"),
			).Count(&matchUA)

			if matchUA == 0 {
				// Unrecognized device / browser detected! Enqueue security alert email
				subj, body := services.BuildNewDeviceLoginSecurityEmail(user.Name, user.Email, c.Get("User-Agent"), c.IP())
				_, _ = services.EnqueueEmail(user.Email, user.Name, "Catavor Keamanan", subj, body, "security_alert", fmt.Sprintf("new_dev_%d_%d", user.ID, time.Now().Unix()))
			}
		}

		var activeStoreID *uint
		if activeStore.ID > 0 {
			activeStoreID = &activeStore.ID
		}
		services.RecordActivity(services.RecordActivityParams{
			DB:          h.db,
			StoreID:     activeStoreID,
			UserID:      &user.ID,
			ActorRole:   "merchant",
			ActorName:   user.Name,
			ActorEmail:  user.Email,
			Action:      "auth.login",
			Category:    "security",
			EntityType:  "user",
			EntityID:    &user.ID,
			EntityTitle: user.Email,
			Description: fmt.Sprintf("Pengguna %s (%s) berhasil login via Google SSO.", user.Name, user.Email),
			IPAddress:   c.IP(),
			UserAgent:   c.Get("User-Agent"),
		})

		setSessionCookie(c, h.cfg, token)
		var existingGRT string
		if len(storeList) == 0 && user.GoogleID != nil && *user.GoogleID != "" {
			if tok, gErr := h.IssueGoogleRegistrationToken(user.Email, *user.GoogleID); gErr == nil {
				existingGRT = tok
				setGoogleRegCookie(c, h.cfg, tok)
			}
		}

		respMap := fiber.Map{
			"success":                  true,
			"is_new_user":              false,
			"message":                  "Login Google berhasil!",
			"token":                    token,
			"is_password_changed":      true,
			"has_custom_password":      user.HasCustomPassword,
			"stores":                   storeList,
			"stores_count":             len(storeList),
			"requires_store_selection": activeStore.ID == 0 && len(storeList) > 0,
			"active_store":             activeStore,
			"user": fiber.Map{
				"id":                  user.ID,
				"name":                user.Name,
				"email":               user.Email,
				"google_id":           user.GoogleID,
				"avatar":              avatar,
				"has_custom_password": user.HasCustomPassword,
				"store_slug":          activeStore.Slug,
				"store_title":         activeStore.StoreTitle,
				"store_theme":         activeStore.StoreTheme,
				"store_plan":          activeStore.Plan,
				"payment_status":      activeStore.PaymentStatus,
			},
		}
		if existingGRT != "" {
			respMap["google_registration_token"] = existingGRT
		}
		return c.JSON(respMap)
	}

	// CASE B: NEW USER (REGISTRATION FLOW)
	storeName := strings.TrimSpace(req.StoreName)
	storeSlug := cleanSlug(req.StoreSlug)

	if storeName == "" || storeSlug == "" {
		regToken, _ := h.IssueGoogleRegistrationToken(email, googleID)
		setGoogleRegCookie(c, h.cfg, regToken)
		return c.JSON(fiber.Map{
			"success":                   true,
			"is_new_user":               true,
			"requires_store_info":       true,
			"google_registration_token": regToken,
			"message":                   "Otentikasi Google berhasil! Silakan tentukan Nama Toko dan Link Username Anda.",
			"google_data": fiber.Map{
				"name":                      name,
				"email":                     email,
				"google_id":                 googleID,
				"avatar":                    avatar,
				"google_registration_token": regToken,
			},
		})
	}

	// Validate slug uniqueness
	var existingStore models.Store
	if err := h.db.Where("LOWER(slug) = ?", storeSlug).First(&existingStore).Error; err == nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Link username toko \"" + storeSlug + "\" sudah digunakan. Silakan pilih username lain.",
		})
	}

	// Create new User
	now := time.Now()
	userName := name
	if userName == "" {
		userName = "Pemilik Toko"
	}

	newUser := models.User{
		Name:              userName,
		Email:             email,
		GoogleID:          &googleID,
		EmailVerifiedAt:   &now,
		IsPasswordChanged: true,
		HasCustomPassword: false,
	}
	_ = newUser.SetPassword("G_SSO_" + googleID + "_" + uuid.New().String()[:8])

	if err := h.db.Create(&newUser).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mendaftarkan akun.",
		})
	}

	clientTimezone := strings.TrimSpace(req.Timezone)
	if clientTimezone == "" {
		clientTimezone = "Asia/Jakarta"
	}

	// N-13: paket berbayar TIDAK boleh aktif dari parameter request. Semua
	// registrasi lewat Google wajib mulai dari paket gratis; upgrade hanya
	// lewat alur berbayar (invoice + verifikasi admin) di Register().
	// Nilai `req.Plan` sengaja diabaikan di sini.
	_ = req.Plan

	plan := "free"
	var planExpiresAt *time.Time
	planStatus := "active"
	customDomainStatus := "none"
	paymentStatus := "free_active"

	// Universal Default Master Data
	defaultClasses, _ := json.Marshal([]string{"Pakaian & Busana", "Aksesoris & Fashion", "Gadget & Elektronik", "Kebutuhan Rumah Tangga", "Kerajinan Tangan"})
	defaultHabitats, _ := json.Marshal([]string{"Item Baru (Ready Stock)", "Pre-Order (PO)", "Varian Koleksi Khusus"})
	defaultStatuses, _ := json.Marshal([]string{"Tersedia (Ready Stock)", "Habis (Sold Out)", "Stok Terbatas (Limited)"})
	defaultShipping, _ := json.Marshal([]string{"Bisa Kirim Seluruh Indonesia", "Jabodetabek Saja", "Ambil Sendiri di Toko"})

	newStore := models.Store{
		UserID:                  newUser.ID,
		Slug:                    storeSlug,
		StoreTitle:              storeName,
		StoreSlogan:             "Memudahkan pelanggan menjelajahi produk dan informasi bisnis.",
		Plan:                    plan,
		PlanStatus:              planStatus,
		PlanExpiresAt:           planExpiresAt,
		CustomDomainStatus:      customDomainStatus,
		PaymentStatus:           paymentStatus,
		StoreTheme:              "navy",
		RegistrationTimezone:    clientTimezone,
		EnableWADirect:          true,
		EnableWARekber:          true,
		MasterClasses:           datatypes.JSON(defaultClasses),
		MasterHabitats:          datatypes.JSON(defaultHabitats),
		MasterStatuses:          datatypes.JSON(defaultStatuses),
		MasterShippingCoverages: datatypes.JSON(defaultShipping),
	}

	if err := h.db.Create(&newStore).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal membuat toko baru.",
		})
	}

	newSummary := StoreSummary{
		ID:            newStore.ID,
		Slug:          newStore.Slug,
		StoreTitle:    newStore.StoreTitle,
		StoreSlogan:   newStore.StoreSlogan,
		StoreTheme:    newStore.StoreTheme,
		Plan:          newStore.Plan,
		PaymentStatus: newStore.PaymentStatus,
	}
	allowNewGoogleSession, gGateErr := h.evaluateMFASessionGate(c, &newUser, "google_register", newStore.Slug, []StoreSummary{newSummary}, newSummary)
	if !allowNewGoogleSession {
		return gGateErr
	}

	token, _, _, gSessErr := h.mintDurableSession(c, &newUser, &newStore, middleware.TokenOptions{
		MFAVerified: false,
	})
	if gSessErr != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"code":    "SESSION_STORAGE_ERROR",
			"message": "Pendaftaran tersimpan, namun sesi login gagal dibuat. Silakan masuk melalui halaman login.",
		})
	}
	setSessionCookie(c, h.cfg, token)

	return c.JSON(fiber.Map{
		"success":             true,
		"is_new_user":         true,
		"message":             "Pendaftaran Google berhasil!",
		"token":               token,
		"is_password_changed": true,
		"has_custom_password": false,
		"user": fiber.Map{
			"id":                  newUser.ID,
			"name":                newUser.Name,
			"email":               newUser.Email,
			"avatar":              avatar,
			"has_custom_password": false,
			"store_slug":          newStore.Slug,
			"store_title":         newStore.StoreTitle,
			"store_theme":         newStore.StoreTheme,
			"store_plan":          newStore.Plan,
			"payment_status":      newStore.PaymentStatus,
		},
	})
}

// claimsEmailVerified menormalkan klaim `email_verified` dari Google.
// Google mengirim nilai ini sebagai bool (endpoint userinfo) maupun string
// "true"/"false" (sebagian respons tokeninfo), jadi keduanya harus diterima.
// Nilai yang tidak dikenali diperlakukan sebagai TIDAK terverifikasi
// (fail-closed).
func claimsEmailVerified(v any) bool {
	switch t := v.(type) {
	case bool:
		return t
	case string:
		return strings.EqualFold(strings.TrimSpace(t), "true")
	default:
		return false
	}
}

// verifyGoogleCredential cryptographically validates Google ID Token or Access Token via official Google endpoints
func verifyGoogleCredential(credentialStr string, expectedClientID string) (email, name, googleID, avatar string, err error) {
	credentialStr = strings.TrimSpace(credentialStr)
	if credentialStr == "" {
		return "", "", "", "", fmt.Errorf("kredensial Google kosong")
	}

	client := &http.Client{
		Timeout: 8 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	// 1. Validate ID Token using Google TokenInfo endpoint (verifies Google's RSA signature, issuer, audience, and expiry)
	tURL := "https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(credentialStr)
	resp, tErr := client.Get(tURL)
	if tErr == nil && resp.StatusCode == http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
		_ = resp.Body.Close()
		var gMap struct {
			Email         string `json:"email"`
			EmailVerified any    `json:"email_verified"`
			Name          string `json:"name"`
			Sub           string `json:"sub"`
			Picture       string `json:"picture"`
			Aud           string `json:"aud"`
			Iss           string `json:"iss"`
		}
		if err := json.Unmarshal(body, &gMap); err == nil && gMap.Email != "" && gMap.Sub != "" {
			if expectedClientID != "" && gMap.Aud != expectedClientID {
				return "", "", "", "", fmt.Errorf("token Google audience tidak cocok dengan konfigurasi aplikasi")
			}
			if gMap.Iss != "" && gMap.Iss != "https://accounts.google.com" && gMap.Iss != "accounts.google.com" {
				return "", "", "", "", fmt.Errorf("issuer token Google tidak valid")
			}
			if !claimsEmailVerified(gMap.EmailVerified) {
				return "", "", "", "", fmt.Errorf("email Google belum terverifikasi")
			}
			return strings.ToLower(strings.TrimSpace(gMap.Email)), gMap.Name, gMap.Sub, gMap.Picture, nil
		}
	} else if resp != nil {
		_ = resp.Body.Close()
	}

	// 2. Fallback: Validate OAuth2 Access Token — WAJIB periksa audience (aud/azp) lewat tokeninfo
	// terlebih dahulu bila GOOGLE_CLIENT_ID dikonfigurasi, agar access token dari aplikasi OAuth pihak ketiga
	// tidak dapat dipakai menembus autentikasi Catavor (RFC 9700 / Confused Deputy Prevention).
	if expectedClientID != "" {
		atURL := "https://oauth2.googleapis.com/tokeninfo?access_token=" + url.QueryEscape(credentialStr)
		atResp, atErr := client.Get(atURL)
		if atErr != nil || atResp == nil || atResp.StatusCode != http.StatusOK {
			if atResp != nil {
				_ = atResp.Body.Close()
			}
			return "", "", "", "", fmt.Errorf("access token Google tidak valid")
		}
		atBody, _ := io.ReadAll(io.LimitReader(atResp.Body, 64*1024))
		_ = atResp.Body.Close()
		var atInfo struct {
			Aud string `json:"aud"`
			Azp string `json:"azp"`
		}
		if json.Unmarshal(atBody, &atInfo) != nil || (atInfo.Aud != expectedClientID && atInfo.Azp != expectedClientID) {
			return "", "", "", "", fmt.Errorf("access token Google bukan diterbitkan untuk aplikasi ini")
		}
	}

	uReq, uErr := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v3/userinfo", nil)
	if uErr == nil {
		uReq.Header.Set("Authorization", "Bearer "+credentialStr)
		uResp, err := client.Do(uReq)
		if err == nil && uResp.StatusCode == http.StatusOK {
			uBody, _ := io.ReadAll(io.LimitReader(uResp.Body, 64*1024))
			_ = uResp.Body.Close()
			var uMap struct {
				Email         string `json:"email"`
				EmailVerified any    `json:"email_verified"`
				Name          string `json:"name"`
				Sub           string `json:"sub"`
				Picture       string `json:"picture"`
			}
			if err := json.Unmarshal(uBody, &uMap); err == nil && uMap.Email != "" && uMap.Sub != "" {
				if !claimsEmailVerified(uMap.EmailVerified) {
					return "", "", "", "", fmt.Errorf("email Google belum terverifikasi")
				}
				return strings.ToLower(strings.TrimSpace(uMap.Email)), uMap.Name, uMap.Sub, uMap.Picture, nil
			}
		} else if uResp != nil {
			_ = uResp.Body.Close()
		}
	}

	return "", "", "", "", fmt.Errorf("token otentikasi Google tidak valid atau telah kedaluwarsa")
}

// VerifyToken checks token validity, returns fresh user profile & store state
func (h *AuthHandler) VerifyToken(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"code":    "USER_NOT_FOUND",
			"message": "Pengguna tidak ditemukan.",
		})
	}

	isPlatformAdmin := strings.EqualFold(user.PlatformRole, "superadmin") ||
		user.IsPlatformStaff()

	if !isPlatformAdmin && user.IsBlacklisted {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "ACCOUNT_BANNED",
			"message": "Akun dan profil katalog Anda telah dinonaktifkan secara permanen karena pelanggaran pedoman platform. Sesi login telah dicabut.",
		})
	}

	targetSlug := c.Get("X-Store-Slug")
	if targetSlug == "" {
		if s, ok := c.Locals("store_slug").(string); ok && s != "" {
			targetSlug = s
		}
	}
	storeList, activeStore := buildStoreSummaries(h.db, user.Stores, user.Store, targetSlug)

	if !isPlatformAdmin && len(storeList) == 0 {
		var totalStoresCount int64
		h.db.Model(&models.Store{}).Where("user_id = ?", user.ID).Count(&totalStoresCount)
		if totalStoresCount > 0 {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "ACCOUNT_BANNED",
				"message": "Seluruh profil katalog Anda telah dinonaktifkan secara permanen oleh platform karena pelanggaran kepatuhan. Sesi login telah dicabut.",
			})
		}
	}

	return c.JSON(fiber.Map{
		"success":             true,
		"valid":               true,
		"message":             "Sesi token valid dan aktif.",
		"is_password_changed": user.IsPasswordChanged,
		"stores":              storeList,
		"active_store":        activeStore,
		"user": fiber.Map{
			"id":                  user.ID,
			"name":                user.Name,
			"email":               user.Email,
			"platform_role":       user.PlatformRole,
			"is_superadmin":       user.IsSuperadmin(),
			"is_admin":            user.IsPlatformStaff(),
			"permissions":         services.GetRBACService().GetUserPermissions(user),
			"is_password_changed": user.IsPasswordChanged,
			"has_custom_password": user.HasCustomPassword,
			"store_slug":          activeStore.Slug,
			"store_title":         activeStore.StoreTitle,
			"store_theme":         activeStore.StoreTheme,
			"store_plan":          activeStore.Plan,
			"payment_status":      activeStore.PaymentStatus,
		},
	})
}

// RefreshToken issues a renewed JWT token with extended expiration for an active session
func (h *AuthHandler) RefreshToken(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"code":    "USER_NOT_FOUND",
			"message": "Pengguna tidak ditemukan.",
		})
	}

	isPlatformAdmin := strings.EqualFold(user.PlatformRole, "superadmin") ||
		user.IsPlatformStaff()

	if !isPlatformAdmin && user.IsBlacklisted {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "ACCOUNT_BANNED",
			"message": "Akun dan profil katalog Anda telah dinonaktifkan secara permanen karena pelanggaran pedoman platform. Sesi login telah dicabut.",
		})
	}

	targetSlug := c.Get("X-Store-Slug")
	storeList, activeStore := buildStoreSummaries(h.db, user.Stores, user.Store, targetSlug)

	if !isPlatformAdmin && len(storeList) == 0 {
		var totalStoresCount int64
		h.db.Model(&models.Store{}).Where("user_id = ?", user.ID).Count(&totalStoresCount)
		if totalStoresCount > 0 {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "ACCOUNT_BANNED",
				"message": "Seluruh profil katalog Anda telah dinonaktifkan secara permanen oleh platform karena pelanggaran kepatuhan. Sesi login telah dicabut.",
			})
		}
	}

	var currentStore *models.Store
	if activeStore.ID > 0 {
		for i := range user.Stores {
			if user.Stores[i].ID == activeStore.ID {
				currentStore = &user.Stores[i]
				break
			}
		}
	}
	if currentStore == nil {
		currentStore = user.Store
	}

	claims, _ := c.Locals("claims").(*middleware.JWTClaims)
	if claims == nil || strings.TrimSpace(claims.ID) == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"code":    "INVALID_TOKEN",
			"message": "Sesi autentikasi tidak valid. Silakan login kembali.",
		})
	}
	if claims.IsAbsoluteExpired() {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"code":    "SESSION_ABSOLUTE_EXPIRED",
			"message": "Sesi telah mencapai batas maksimum (7 hari). Silakan login kembali.",
		})
	}
	if decision := middleware.MfaPolicyFor(user, claims, h.cfg); decision != nil {
		return c.Status(decision.Status).JSON(fiber.Map{
			"success": false,
			"code":    decision.RequireCode,
			"message": decision.Message,
		})
	}

	absExp := claims.GetAbsoluteExpiresAt()
	if absExp.IsZero() {
		absExp = time.Now().Add(7 * 24 * time.Hour)
	}

	newToken, newTokenID, newExpiresAt, err := middleware.GenerateTokenWithOptions(user, currentStore, h.cfg, middleware.TokenOptions{
		MFAVerified:       claims.MfaVerified,
		AuthAt:            claims.GetAuthTime(),
		AbsoluteExpiresAt: absExp,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperpanjang sesi token.",
		})
	}

	if rotErr := services.RotateUserSessionTokenStrict(h.db, user.ID, claims.ID, newTokenID, newExpiresAt, c.IP()); rotErr != nil {
		if errors.Is(rotErr, services.ErrSessionNotFound) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "SESSION_REVOKED",
				"message": "Sesi login telah dicabut. Silakan masuk kembali.",
			})
		}
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"code":    "SESSION_STORAGE_ERROR",
			"message": "Gagal menyimpan perpanjangan sesi.",
		})
	}

	ttl := 72 * time.Hour
	if claims.ExpiresAt != nil {
		if remaining := time.Until(claims.ExpiresAt.Time); remaining > 0 {
			ttl = remaining
		}
	}
	database.BlacklistTokenWithGracePeriod(claims.ID, 30*time.Second, ttl)
	middleware.RegisterSessionFingerprint(newTokenID, c.IP(), c.Get("User-Agent"))

	setSessionCookie(c, h.cfg, newToken)
	c.Set("X-Refreshed-Token", newToken)

	return c.JSON(fiber.Map{
		"success":             true,
		"message":             "Sesi login berhasil diperpanjang.",
		"token":               newToken,
		"is_password_changed": user.IsPasswordChanged,
		"stores":              storeList,
		"active_store":        activeStore,
		"user": fiber.Map{
			"id":                  user.ID,
			"name":                user.Name,
			"email":               user.Email,
			"platform_role":       user.PlatformRole,
			"is_superadmin":       user.IsSuperadmin(),
			"is_admin":            user.IsPlatformStaff(),
			"permissions":         services.GetRBACService().GetUserPermissions(user),
			"is_password_changed": user.IsPasswordChanged,
			"has_custom_password": user.HasCustomPassword,
			"store_slug":          activeStore.Slug,
			"store_title":         activeStore.StoreTitle,
			"store_theme":         activeStore.StoreTheme,
			"store_plan":          activeStore.Plan,
			"payment_status":      activeStore.PaymentStatus,
		},
	})
}

func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	// Revoke current JWT token via Blacklist (Redis & Memory) and Database
	if claims, ok := c.Locals("claims").(*middleware.JWTClaims); ok && claims != nil {
		if claims.ID != "" {
			ttl := 72 * time.Hour
			if claims.ExpiresAt != nil {
				remaining := time.Until(claims.ExpiresAt.Time)
				if remaining > 0 {
					ttl = remaining
				}
			}
			database.BlacklistToken(claims.ID, ttl)
			middleware.RevokeSessionFingerprint(claims.ID)
			_ = services.RevokeSessionByTokenID(h.db, claims.ID)
		}
	} else {
		// Fallback: extract optional claims if Locals not populated
		claims := middleware.ExtractOptionalClaims(c, h.cfg)
		if claims != nil && claims.ID != "" {
			ttl := 72 * time.Hour
			if claims.ExpiresAt != nil {
				remaining := time.Until(claims.ExpiresAt.Time)
				if remaining > 0 {
					ttl = remaining
				}
			}
			database.BlacklistToken(claims.ID, ttl)
			middleware.RevokeSessionFingerprint(claims.ID)
			_ = services.RevokeSessionByTokenID(h.db, claims.ID)
		}
	}

	// SECURITY (M1): hapus cookie sesi HttpOnly dan cookie registrasi Google saat logout.
	clearSessionCookie(c, h.cfg)
	clearGoogleRegCookie(c, h.cfg)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Logout berhasil. Sesi Anda telah ditutup dengan aman.",
	})
}

func (h *AuthHandler) UpdateProfile(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	var req UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	now := time.Now().UTC()
	claims, _ := c.Locals("claims").(*middleware.JWTClaims)

	if req.Name != "" {
		user.Name = security.SanitizePlainText(req.Name, 100)
	}

	originalEmail := user.Email
	emailChanging := false
	var pendingNewEmail string
	if req.Email != "" && strings.ToLower(strings.TrimSpace(req.Email)) != strings.ToLower(strings.TrimSpace(user.Email)) {
		reqEmail := strings.ToLower(strings.TrimSpace(req.Email))
		if !security.ValidateEmail(reqEmail) {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"success": false,
				"message": "Format email tidak valid.",
			})
		}
		var cnt int64
		h.db.Model(&models.User{}).Where("LOWER(email) = ? AND id != ?", reqEmail, user.ID).Count(&cnt)
		if cnt > 0 {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"success": false,
				"message": "Email sudah digunakan oleh pengguna lain.",
			})
		}
		pendingNewEmail = reqEmail
		emailChanging = true
	}

	// Tolak lebih awal sebelum mengonsumsi OTP sekali pakai apabila akun wajib/aktif MFA
	// belum menyertakan kode faktor kedua pada perubahan kredensial.
	if emailChanging || req.Password != "" {
		if mfa.RequiresMFA(user, h.cfg != nil && h.cfg.MFAEnabled) {
			if !user.TwoFactorEnabled {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"success": false,
					"code":    "MFA_SETUP_REQUIRED",
					"message": "Wajib mengaktifkan MFA sebelum mengubah kredensial akun.",
				})
			}
			if h.cfg == nil || !h.cfg.MFAEnabled || strings.TrimSpace(h.cfg.MFAEncryptionKey) == "" {
				return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
					"success": false,
					"code":    "MFA_SERVICE_UNAVAILABLE",
					"message": "Layanan MFA belum siap memproses perubahan kredensial.",
				})
			}
			earlyMFACode := strings.TrimSpace(req.MFACode)
			if earlyMFACode == "" {
				earlyMFACode = strings.TrimSpace(req.Code)
			}
			if earlyMFACode == "" {
				return c.Status(fiber.StatusPreconditionRequired).JSON(fiber.Map{
					"success": false,
					"code":    "MFA_STEP_UP_REQUIRED",
					"message": "Masukkan kode 6 digit authenticator atau kode cadangan untuk mengonfirmasi perubahan kredensial.",
				})
			}
		}
	}

	passwordWasChanged := false
	otpReauthed := false
	passwordReauthed := false
	if strings.TrimSpace(req.CurrentPassword) != "" && (user.HasCustomPassword || user.Password != "") {
		lockIdent := strings.ToLower(strings.TrimSpace(originalEmail))
		if locked, retryRem := database.IsAccountLoginLocked(lockIdent); locked {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"code":    "ACCOUNT_LOCKED",
				"message": fmt.Sprintf("Terlalu banyak percobaan kata sandi salah. Silakan tunggu %d detik sebelum mencoba kembali.", int(retryRem.Seconds())+1),
			})
		}
		if user.CheckPassword(req.CurrentPassword) {
			database.ResetLoginFailures(lockIdent)
			passwordReauthed = true
		} else {
			database.RecordLoginFailure(lockIdent)
		}
	}

	if req.Password != "" {
		if user.HasCustomPassword {
			if strings.TrimSpace(req.OTP) != "" {
				token, err := services.GetOTPService().VerifyOTP(originalEmail, strings.TrimSpace(req.OTP), "password_reset")
				if err != nil {
					return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
						"success": false,
						"message": safeErrMsg(err, "Permintaan tidak dapat diproses."),
					})
				}
				// SECURITY (N-11): token verifikasi wajib valid & terpakai.
				if !services.GetOTPService().ValidateAndConsumeToken(originalEmail, token, "password_reset") {
					return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
						"success": false,
						"message": "Token verifikasi tidak valid atau sudah kedaluwarsa. Silakan minta kode baru.",
					})
				}
				otpReauthed = true
			} else {
				if strings.TrimSpace(req.CurrentPassword) == "" {
					return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
						"success": false,
						"message": "Kata sandi saat ini wajib diisi untuk mengubah kata sandi akun.",
					})
				}
				if !passwordReauthed {
					return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
						"success": false,
						"message": "Kata sandi saat ini yang Anda masukkan salah.",
					})
				}
			}
		}

		if err := security.ValidatePassword(req.Password); err != nil {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"success": false,
				"message": safeErrMsg(err, "Permintaan tidak dapat diproses."),
			})
		}
		if req.ConfirmPassword != "" && req.Password != req.ConfirmPassword {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"success": false,
				"message": "Konfirmasi kata sandi tidak cocok.",
			})
		}

		if req.CurrentPassword != "" && strings.TrimSpace(req.CurrentPassword) == strings.TrimSpace(req.Password) {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"success": false,
				"message": "Kata sandi baru tidak boleh sama dengan kata sandi saat ini.",
			})
		}
		if (user.HasCustomPassword || user.Password != "") && user.CheckPassword(req.Password) {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"success": false,
				"message": "Kata sandi baru tidak boleh sama dengan kata sandi saat ini. Silakan gunakan kombinasi kata sandi yang berbeda.",
			})
		}

		if err := user.SetPassword(req.Password); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal mengenkripsi kata sandi.",
			})
		}
		user.HasCustomPassword = true
		user.IsPasswordChanged = true
		passwordWasChanged = true
	}

	credentialChanged := emailChanging || passwordWasChanged
	var newToken string

	if credentialChanged {
		sessionFresh := claims != nil && !claims.GetAuthTime().IsZero() && now.Sub(claims.GetAuthTime()) <= mfa.FreshReauthMaxAge
		if !sessionFresh && !passwordReauthed && !otpReauthed {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "REAUTH_REQUIRED",
				"message": "Perubahan email atau kata sandi memerlukan autentikasi segar (<= 10 menit) atau konfirmasi kata sandi saat ini.",
			})
		}
		if emailChanging {
			user.Email = pendingNewEmail
		}

		mfaActive := mfa.RequiresMFA(user, h.cfg != nil && h.cfg.MFAEnabled)
		if mfaActive && !user.TwoFactorEnabled {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "MFA_SETUP_REQUIRED",
				"message": "Wajib mengaktifkan MFA sebelum mengubah kredensial akun.",
			})
		}

		candidateTokenID := uuid.New().String()
		hours := 12
		if h.cfg != nil && h.cfg.JWTExpirationHours > 0 {
			hours = h.cfg.JWTExpirationHours
		}
		newExpiresAt := now.Add(time.Duration(hours) * time.Hour)
		absExp := now.Add(7 * 24 * time.Hour)
		if claims != nil && !claims.GetAbsoluteExpiresAt().IsZero() {
			absExp = claims.GetAbsoluteExpiresAt()
		}

		var revoked []string
		var evicted []string

		if mfaActive {
			if h.cfg == nil || !h.cfg.MFAEnabled || strings.TrimSpace(h.cfg.MFAEncryptionKey) == "" {
				return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
					"success": false,
					"code":    "MFA_SERVICE_UNAVAILABLE",
					"message": "Layanan MFA belum siap memproses perubahan kredensial.",
				})
			}
			mfaCode := strings.TrimSpace(req.MFACode)
			if mfaCode == "" {
				mfaCode = strings.TrimSpace(req.Code)
			}
			if mfaCode == "" {
				return c.Status(fiber.StatusPreconditionRequired).JSON(fiber.Map{
					"success": false,
					"code":    "MFA_STEP_UP_REQUIRED",
					"message": "Masukkan kode 6 digit authenticator atau kode cadangan untuk mengonfirmasi perubahan kredensial.",
				})
			}
			failCtx := "credchange-u"
			if claims != nil && claims.ID != "" {
				failCtx = "cred:" + claims.ID
			}
			_, stepErr := mfa.VerifyStepUpAndMutate(
				h.db,
				h.cfg.MFAEncryptionKey,
				user.ID,
				mfaCode,
				req.FactorType,
				failCtx,
				now,
				func(tx *gorm.DB, lockedUser *models.User, usedFactor string) error {
					user.TokenVersion = lockedUser.TokenVersion + 1
					user.TwoFactorLastTOTPStep = lockedUser.TwoFactorLastTOTPStep
					user.TwoFactorBackupCodesHash = lockedUser.TwoFactorBackupCodesHash
					if err := tx.Save(user).Error; err != nil {
						return err
					}
					var revErr error
					revoked, revErr = services.RevokeUserSessionsTx(tx, user.ID, "", now)
					if revErr != nil {
						return revErr
					}
					_, ev, sErr := services.CreateUserSessionTx(tx, user.ID, candidateTokenID, newExpiresAt, c.IP(), c.Get("User-Agent"), now)
					if sErr != nil {
						return sErr
					}
					evicted = ev
					return nil
				},
			)
			if stepErr != nil {
				switch {
				case errors.Is(stepErr, mfa.ErrFactorLocked):
					return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
						"success": false,
						"code":    "MFA_LOCKED",
						"message": "Terlalu banyak kode salah. Faktor kedua sementara dikunci.",
					})
				case errors.Is(stepErr, mfa.ErrReplay):
					return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
						"success": false,
						"code":    "MFA_CODE_REUSED",
						"message": "Kode ini sudah dipakai. Tunggu kode berikutnya.",
					})
				case errors.Is(stepErr, mfa.ErrFactorInvalid):
					return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
						"success": false,
						"code":    "MFA_CODE_INVALID",
						"message": "Kode verifikasi faktor kedua salah.",
					})
				default:
					return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
						"success": false,
						"code":    "MFA_STORAGE_ERROR",
						"message": "Gagal memperbarui kredensial akun.",
					})
				}
			}
		} else {
			user.TokenVersion++
			txErr := h.db.Transaction(func(tx *gorm.DB) error {
				if err := tx.Save(user).Error; err != nil {
					return err
				}
				var revErr error
				revoked, revErr = services.RevokeUserSessionsTx(tx, user.ID, "", now)
				if revErr != nil {
					return revErr
				}
				_, ev, sErr := services.CreateUserSessionTx(tx, user.ID, candidateTokenID, newExpiresAt, c.IP(), c.Get("User-Agent"), now)
				if sErr != nil {
					return sErr
				}
				evicted = ev
				return nil
			})
			if txErr != nil {
				log.Error().Err(txErr).Msg("UpdateProfile credential tx failed")
				return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
					"success": false,
					"message": "Gagal memperbarui kredensial profil.",
				})
			}
		}

		services.BlacklistTokenIDs(revoked, 72*time.Hour)
		services.BlacklistTokenIDs(evicted, 72*time.Hour)

		activeStore, _ := c.Locals("store").(*models.Store)
		if activeStore == nil {
			activeStore = user.Store
		}
		signedTok, _, _, signErr := middleware.GenerateTokenWithOptions(user, activeStore, h.cfg, middleware.TokenOptions{
			TokenID:           candidateTokenID,
			MFAVerified:       mfaActive || (claims != nil && claims.MfaVerified),
			AuthAt:            now,
			AbsoluteExpiresAt: absExp,
		})
		if signErr != nil {
			_ = services.RevokeSessionByTokenID(h.db, candidateTokenID)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal menerbitkan sesi baru setelah perubahan kredensial.",
			})
		}
		newToken = signedTok
		middleware.RegisterSessionFingerprint(candidateTokenID, c.IP(), c.Get("User-Agent"))
		setSessionCookie(c, h.cfg, newToken)
		c.Set("X-Refreshed-Token", newToken)
	} else {
		if err := h.db.Save(user).Error; err != nil {
			log.Error().Err(err).Msg("UpdateProfile DB.Save failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal memperbarui profil.",
			})
		}
	}

	actorRole := user.PlatformStaffRoleLabel()
	action := "auth.profile_updated"
	desc := fmt.Sprintf("Pengguna %s memperbarui data profil.", user.Name)
	if passwordWasChanged {
		action = "auth.password_changed"
		desc = fmt.Sprintf("Pengguna %s berhasil mengganti kata sandi akun.", user.Name)
	}

	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		UserID:      &user.ID,
		ActorRole:   actorRole,
		ActorName:   user.Name,
		ActorEmail:  user.Email,
		Action:      action,
		Category:    "security",
		EntityType:  "user",
		EntityID:    &user.ID,
		EntityTitle: user.Email,
		Description: desc,
		IPAddress:   c.IP(),
		UserAgent:   c.Get("User-Agent"),
	})

	if passwordWasChanged {
		subj, body := services.BuildPasswordChangedSecurityEmail(user.Name, user.Email, c.Get("User-Agent"), c.IP())
		_, _ = services.EnqueueEmail(user.Email, user.Name, "Catavor Keamanan", subj, body, "security_alert", fmt.Sprintf("pwd_change_%d_%d", user.ID, time.Now().Unix()))
	}

	resMap := fiber.Map{
		"success": true,
		"message": "Profil dan kata sandi berhasil diperbarui.",
		"user": fiber.Map{
			"id":                  user.ID,
			"name":                user.Name,
			"email":               user.Email,
			"is_password_changed": user.IsPasswordChanged,
			"has_custom_password": user.HasCustomPassword,
		},
	}
	if newToken != "" {
		resMap["token"] = newToken
	}

	return c.JSON(resMap)
}

// CheckEmail performs early email availability check for registration wizard.
// Returns neutral anti-enumeration response if email is already in use.
func (h *AuthHandler) CheckEmail(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	email := strings.ToLower(strings.TrimSpace(c.Query("email")))
	if email == "" {
		var req CheckEmailRequest
		if err := c.BodyParser(&req); err == nil && req.Email != "" {
			email = strings.ToLower(strings.TrimSpace(req.Email))
		}
	}

	if email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Alamat email wajib disertakan.",
		})
	}

	if !security.ValidateEmail(email) {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Format alamat email tidak valid.",
		})
	}

	var count int64
	h.db.Model(&models.User{}).Where("LOWER(email) = ?", email).Count(&count)

	if count > 0 {
		return c.JSON(fiber.Map{
			"success":   true,
			"available": false,
			"message":   "Alamat email ini sudah terdaftar dalam sistem. Silakan gunakan alamat email lain atau masuk ke akun yang sudah terdaftar.",
		})
	}

	return c.JSON(fiber.Map{
		"success":   true,
		"available": true,
		"message":   "Alamat email tersedia.",
	})
}

// SendRegistrationOTP issues a 6-digit email OTP for manual registration.
func (h *AuthHandler) SendRegistrationOTP(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	var req SendRegistrationOTPRequest
	if err := c.BodyParser(&req); err != nil {
		if uErr := json.Unmarshal(c.Body(), &req); uErr != nil {
			// SECURITY: jangan pernah echo err.Error() atau body request ke klien
			// (body bisa memuat kredensial). Detail hanya ke log server.
			log.Warn().
				Err(err).
				Str("parse_error", uErr.Error()).
				Str("path", c.Path()).
				Str("ip", c.IP()).
				Msg("SendRegistrationOTP: invalid request body")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Format data tidak valid.",
			})
		}
	}

	// Security Defense: Anti-bot honeypot check.
	// N-17: balasan honeypot juga harus memakai pesan seragam — pesan berbeda
	// akan berfungsi sebagai oracle status email bagi penyerang.
	if security.IsBotHoneypotTriggered(req.WebsiteHP) {
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Jika email tersebut dapat digunakan, kode OTP 6-digit telah dikirimkan ke kotak masuk Anda.",
		})
	}

	reqEmail := strings.TrimSpace(strings.ToLower(req.Email))
	if reqEmail == "" || !security.ValidateEmail(reqEmail) {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Format alamat email tidak valid.",
		})
	}

	// N-17: jangan bocorkan status pendaftaran.
	// Sebelumnya email terdaftar dibalas 422 "Email sudah terdaftar" sementara
	// email bebas dibalas 200 — perbedaan ini memungkinkan enumerasi akun.
	// Email blacklisted juga dibalas 403 eksplisit, membocorkan status penangguhan.
	// Sekarang ketiga kondisi memberi respons identik; hanya email yang benar-benar
	// menerima OTP yang tahu bedanya.
	responsSeragam := fiber.Map{
		"success": true,
		"message": "Jika email tersebut dapat digunakan, kode OTP 6-digit telah dikirimkan ke kotak masuk Anda.",
	}

	// Check if email is blacklisted
	var blacklistedCount int64
	h.db.Model(&models.User{}).Where("LOWER(email) = ? AND is_blacklisted = true", reqEmail).Count(&blacklistedCount)
	if blacklistedCount > 0 {
		log.Warn().Str("ip", c.IP()).Msg("SendRegistrationOTP: email blacklisted (respons disamarkan)")
		return c.JSON(responsSeragam)
	}

	// Check if email already registered
	var existingCount int64
	h.db.Model(&models.User{}).Where("LOWER(email) = ?", reqEmail).Count(&existingCount)
	if existingCount > 0 {
		log.Info().Str("ip", c.IP()).Msg("SendRegistrationOTP: email sudah terdaftar (respons disamarkan)")
		return c.JSON(responsSeragam)
	}

	_, err := services.GetOTPService().GenerateAndSendRegistrationOTP(reqEmail, req.Name)
	if err != nil {
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Permintaan tidak dapat diproses."),
		})
	}

	// Respons akhir WAJIB identik dengan responsSeragam di atas; kalau berbeda,
	// perbedaan itulah yang membocorkan status pendaftaran email.
	return c.JSON(responsSeragam)
}

// VerifyRegistrationOTP checks the OTP and generates a temporary verification token.
func (h *AuthHandler) VerifyRegistrationOTP(c *fiber.Ctx) error {
	var req VerifyRegistrationOTPRequest
	if err := c.BodyParser(&req); err != nil {
		if uErr := json.Unmarshal(c.Body(), &req); uErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Format data tidak valid.",
			})
		}
	}

	reqEmail := strings.TrimSpace(strings.ToLower(req.Email))
	token, err := services.GetOTPService().VerifyOTP(reqEmail, req.OTP, "registration")
	if err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Permintaan tidak dapat diproses."),
		})
	}

	return c.JSON(fiber.Map{
		"success":            true,
		"message":            "Email berhasil diverifikasi!",
		"verification_token": token,
	})
}

// ForgotPasswordRequest sends a password recovery OTP to the user's email.
func (h *AuthHandler) ForgotPasswordRequest(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	var req ForgotPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		if uErr := json.Unmarshal(c.Body(), &req); uErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Format data tidak valid.",
			})
		}
	}

	reqEmail := strings.TrimSpace(strings.ToLower(req.Email))
	if reqEmail == "" || !security.ValidateEmail(reqEmail) {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Format alamat email tidak valid.",
		})
	}

	const uniformRecoveryMsg = "Jika email terdaftar, instruksi pemulihan telah dikirimkan ke kotak masuk Anda."

	var user models.User
	if err := h.db.Where("LOWER(email) = ?", reqEmail).First(&user).Error; err != nil {
		// Return uniform message even if not found to prevent user enumeration (N-17)
		return c.JSON(fiber.Map{
			"success": true,
			"message": uniformRecoveryMsg,
		})
	}

	// N-17 + Staff Protection: akun blacklisted maupun staf pengelola platform tidak boleh
	// dibedakan dari email tak terdaftar dan staf platform tidak boleh di-reset via OTP publik 1FA.
	if user.IsBlacklisted || user.IsPlatformStaff() {
		log.Warn().Str("ip", c.IP()).Bool("staff", user.IsPlatformStaff()).Msg("ForgotPasswordRequest: ditahan & respons disamarkan")
		return c.JSON(fiber.Map{
			"success": true,
			"message": uniformRecoveryMsg,
		})
	}

	_, err := services.GetOTPService().GenerateAndSendPasswordResetOTP(user.Email, user.Name)
	if err != nil {
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Permintaan tidak dapat diproses."),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": uniformRecoveryMsg,
	})
}

// ForgotPasswordReset validates the recovery OTP and resets the user's password.
func (h *AuthHandler) ForgotPasswordReset(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	var req ForgotPasswordResetRequest
	if err := c.BodyParser(&req); err != nil {
		if uErr := json.Unmarshal(c.Body(), &req); uErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Format data tidak valid.",
			})
		}
	}

	reqEmail := strings.TrimSpace(strings.ToLower(req.Email))
	if req.NewPassword == "" && req.Password != "" {
		req.NewPassword = req.Password
	}
	if req.NewPassword == "" || req.ConfirmPassword == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Kata sandi baru dan konfirmasi kata sandi wajib diisi.",
		})
	}

	if req.NewPassword != req.ConfirmPassword {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Konfirmasi kata sandi tidak cocok.",
		})
	}

	if err := security.ValidatePassword(req.NewPassword); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Permintaan tidak dapat diproses."),
		})
	}

	token, err := services.GetOTPService().VerifyOTP(reqEmail, req.OTP, "password_reset")
	if err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Permintaan tidak dapat diproses."),
		})
	}

	// SECURITY (N-11): cek user SEBELUM token dikonsumsi, agar token tidak
	// hangus hanya karena email tidak terdaftar.
	var user models.User
	if err := h.db.Preload("Store").Where("LOWER(email) = ?", reqEmail).First(&user).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Pengguna tidak ditemukan.",
		})
	}

	// SECURITY: Akun staf platform & akun dengan TwoFactorEnforced tanpa MFA aktif TIDAK BOLEH
	// di-reset lewat alur OTP email publik (karena akan menerbitkan setup_token kepada pengambil alih email
	// atau menimpa kata sandi akun istimewa melalui 1FA). Pemulihan staf wajib melalui Superadmin.
	if user.IsPlatformStaff() || (user.TwoFactorEnforced && !user.TwoFactorEnabled) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "STAFF_RECOVERY_RESTRICTED",
			"message": "Pemulihan kata sandi untuk akun pengelola platform wajib melalui Superadmin.",
		})
	}

	// Consume verification token — SECURITY (N-11): wajib diperiksa hasilnya.
	if !services.GetOTPService().ValidateAndConsumeToken(reqEmail, token, "password_reset") {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Token verifikasi tidak valid atau sudah kedaluwarsa. Silakan minta kode baru.",
		})
	}

	// Industry Standard & NIST SP 800-63B / OWASP ASVS: Prevent password reuse against previous active password
	if user.Password != "" && user.CheckPassword(req.NewPassword) {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Kata sandi baru tidak boleh sama dengan kata sandi sebelumnya. Silakan buat kombinasi kata sandi yang baru.",
		})
	}

	if err := user.SetPassword(req.NewPassword); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengenkripsi kata sandi.",
		})
	}

	now := time.Now().UTC()
	user.EmailVerifiedAt = &now
	user.IsPasswordChanged = true
	user.HasCustomPassword = true
	user.TokenVersion++

	var revokedResetIDs []string
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&user).Error; err != nil {
			return err
		}
		var revErr error
		revokedResetIDs, revErr = services.RevokeUserSessionsTx(tx, user.ID, "", now)
		return revErr
	}); err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui kata sandi.",
		})
	}
	services.BlacklistTokenIDs(revokedResetIDs, 72*time.Hour)

	// Enqueue real-time transactional security alert email
	subj, body := services.BuildPasswordChangedSecurityEmail(user.Name, user.Email, c.Get("User-Agent"), c.IP())
	_, _ = services.EnqueueEmail(user.Email, user.Name, "Catavor Keamanan", subj, body, "security_alert", fmt.Sprintf("pwd_reset_%d_%d", user.ID, time.Now().Unix()))

	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		UserID:      &user.ID,
		ActorRole:   user.PlatformStaffRoleLabel(),
		ActorName:   user.Name,
		ActorEmail:  user.Email,
		Action:      "auth.password_reset_via_otp",
		Category:    "security",
		EntityType:  "user",
		EntityID:    &user.ID,
		EntityTitle: user.Email,
		Description: fmt.Sprintf("Kata sandi akun %s berhasil diatur ulang melalui verifikasi OTP email.", user.Email),
		IPAddress:   c.IP(),
		UserAgent:   c.Get("User-Agent"),
	})

	_ = preloadUserStores(h.db.Preload("Store")).First(&user, user.ID).Error
	storeList, activeStore := buildStoreSummaries(h.db, user.Stores, user.Store, "")

	// Reset kata sandi melalui OTP email TIDAK boleh menerbitkan sesi penuh
	// bagi staf platform maupun merchant yang telah mengaktifkan MFA.
	allowResetSession, resetGateErr := h.evaluateMFASessionGate(c, &user, "password_reset_otp", activeStore.Slug, storeList, activeStore)
	if !allowResetSession {
		return resetGateErr
	}

	var primaryStore *models.Store
	if len(user.Stores) > 0 {
		primaryStore = &user.Stores[0]
	} else {
		primaryStore = user.Store
	}

	newToken, _, _, sessErr := h.mintDurableSession(c, &user, primaryStore, middleware.TokenOptions{
		MFAVerified: false,
	})
	if sessErr != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"code":    "SESSION_STORAGE_ERROR",
			"message": "Kata sandi berhasil diperbarui, silakan masuk kembali melalui halaman login.",
		})
	}
	setSessionCookie(c, h.cfg, newToken)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Kata sandi Anda berhasil diperbarui.",
		"token":   newToken,
	})
}

// RequestProfilePasswordOTP sends a password recovery OTP strictly for the authenticated session user.
// SECURITY (N-17): tidak lagi menerima lookup email tanpa sesi agar tidak membocorkan status registrasi/ban akun.
func (h *AuthHandler) RequestProfilePasswordOTP(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil || user.ID == 0 || user.Email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi sesi diperlukan.",
		})
	}

	if user.IsBlacklisted {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akun Anda telah dinonaktifkan.",
		})
	}

	_, err := services.GetOTPService().GenerateAndSendPasswordResetOTP(user.Email, user.Name)
	if err != nil {
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Permintaan tidak dapat diproses."),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("Kode verifikasi telah dikirimkan ke %s.", user.Email),
	})
}

func cleanSlug(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	reg := regexp.MustCompile("[^a-z0-9-]+")
	s = reg.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	return s
}

type DeleteAccountRequest struct {
	ConfirmPhrase string `json:"confirm_phrase"`
	Confirmation  string `json:"confirmation,omitempty"`
	Password      string `json:"password"`
	MFACode       string `json:"mfa_code,omitempty"`
	Code          string `json:"code,omitempty"`
	FactorType    string `json:"factor_type,omitempty"`
}

// DeleteAccount handles permanent deletion of user account and all owned catalogs (Right to Erasure)
func (h *AuthHandler) DeleteAccount(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	if user.IsSuperadmin() {
		var superCount int64
		if err := h.db.Model(&models.User{}).Where("LOWER(TRIM(platform_role)) = ?", "superadmin").Count(&superCount).Error; err != nil || superCount <= 1 {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"message": "Akun Superadmin terakhir tidak dapat dihapus secara mandiri.",
			})
		}
	}

	var req DeleteAccountRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data konfirmasi tidak valid.",
		})
	}

	// 1. Validate confirmation phrase (support confirm_phrase with fallback to confirmation)
	phrase := strings.TrimSpace(req.ConfirmPhrase)
	if phrase == "" {
		phrase = strings.TrimSpace(req.Confirmation)
	}
	expectedPhrase := "HAPUS AKUN SAYA"
	if phrase != expectedPhrase && !strings.EqualFold(phrase, user.Email) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Frasa konfirmasi tidak sesuai. Silakan ketik 'HAPUS AKUN SAYA' untuk melanjutkan.",
		})
	}

	// 2. Validate password if user has password (guarded by brute-force lockout)
	if user.HasCustomPassword && user.Password != "" {
		lockIdent := strings.ToLower(strings.TrimSpace(user.Email))
		if locked, retryRem := database.IsAccountLoginLocked(lockIdent); locked {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"code":    "ACCOUNT_LOCKED",
				"message": fmt.Sprintf("Terlalu banyak percobaan kata sandi salah. Silakan tunggu %d detik sebelum mencoba kembali.", int(retryRem.Seconds())+1),
			})
		}
		if req.Password == "" || !user.CheckPassword(req.Password) {
			if req.Password != "" {
				database.RecordLoginFailure(lockIdent)
			}
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Kata sandi akun yang Anda masukkan salah.",
			})
		}
		database.ResetLoginFailures(lockIdent)
	}

	cfg := h.cfg
	if cfg == nil {
		cfg = config.LoadConfig()
	}

	// 2b. Enforce MFA step-up when MFA is active/required on the account
	now := time.Now().UTC()
	if mfa.RequiresMFA(user, cfg != nil && cfg.MFAEnabled) {
		if !user.TwoFactorEnabled {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "MFA_SETUP_REQUIRED",
				"message": "Wajib mengaktifkan MFA sebelum menghapus akun.",
			})
		}
		mfaCode := strings.TrimSpace(req.MFACode)
		if mfaCode == "" {
			mfaCode = strings.TrimSpace(req.Code)
		}
		if mfaCode == "" {
			return c.Status(fiber.StatusPreconditionRequired).JSON(fiber.Map{
				"success": false,
				"code":    "MFA_STEP_UP_REQUIRED",
				"message": "Masukkan kode 6 digit authenticator atau kode cadangan untuk mengonfirmasi penghapusan akun.",
			})
		}
		_, stepErr := mfa.VerifyStepUpAndMutate(
			h.db,
			cfg.MFAEncryptionKey,
			user.ID,
			mfaCode,
			req.FactorType,
			fmt.Sprintf("delacc-%d", user.ID),
			now,
			func(tx *gorm.DB, lockedUser *models.User, usedFactor string) error {
				return nil
			},
		)
		if stepErr != nil {
			switch {
			case errors.Is(stepErr, mfa.ErrFactorLocked):
				return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
					"success": false,
					"code":    "MFA_LOCKED",
					"message": "Terlalu banyak kode salah. Faktor kedua sementara dikunci.",
				})
			case errors.Is(stepErr, mfa.ErrReplay):
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"success": false,
					"code":    "MFA_CODE_REUSED",
					"message": "Kode faktor kedua sudah pernah digunakan. Tunggu kode berikutnya.",
				})
			default:
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"success": false,
					"code":    "MFA_CODE_INVALID",
					"message": "Kode verifikasi faktor kedua salah.",
				})
			}
		}
	}

	// 3. Clean up user's support tickets and physical media attachments under UU PDP / GDPR Right to Erasure
	_, _, _ = services.PurgeUserTicketsAndAttachments(h.db, h.storage, user.ID)

	// 4. Find all stores owned by user & collect active session IDs to blacklist post-commit
	var stores []models.Store
	h.db.Where("user_id = ?", user.ID).Find(&stores)
	var activeSess []models.UserSession
	h.db.Select("token_id").Where("user_id = ?", user.ID).Find(&activeSess)

	if txErr := h.db.Transaction(func(tx *gorm.DB) error {
		for _, s := range stores {
			productIDs := tx.Unscoped().Model(&models.Product{}).Select("id").Where("store_id = ?", s.ID)
			if err := tx.Unscoped().Where("product_id IN (?)", productIDs).Delete(&models.ProductVariant{}).Error; err != nil {
				return err
			}
			if err := tx.Unscoped().Where("product_id IN (?)", productIDs).Delete(&models.ProductImage{}).Error; err != nil {
				return err
			}
			for _, storeModel := range []interface{}{
				&models.Product{},
				&models.Category{},
				&models.Article{},
				&models.StoreDailyAnalytics{},
				&models.ProductDailyAnalytics{},
				&models.StoreDailyTrafficSource{},
				&models.NotificationRead{},
				&models.ActivityLog{},
			} {
				if err := tx.Unscoped().Where("store_id = ?", s.ID).Delete(storeModel).Error; err != nil {
					return err
				}
			}
			if err := tx.Unscoped().Delete(&s).Error; err != nil {
				return err
			}
		}

		// Delete MFA records BEFORE UserSession & User to satisfy PostgreSQL FK RESTRICT on mfa_auth_completions.session_id
		if tx.Migrator().HasTable(&models.MFAAuthCompletion{}) {
			sessIDs := tx.Unscoped().Model(&models.UserSession{}).Select("id").Where("user_id = ?", user.ID)
			if err := tx.Unscoped().Where("user_id = ? OR session_id IN (?)", user.ID, sessIDs).Delete(&models.MFAAuthCompletion{}).Error; err != nil {
				return err
			}
		}
		if tx.Migrator().HasTable(&models.MFAChallengeFailure{}) {
			if err := tx.Unscoped().Where("user_id = ?", user.ID).Delete(&models.MFAChallengeFailure{}).Error; err != nil {
				return err
			}
		}
		if tx.Migrator().HasTable(&models.MFAAccountLockout{}) {
			if err := tx.Unscoped().Where("user_id = ?", user.ID).Delete(&models.MFAAccountLockout{}).Error; err != nil {
				return err
			}
		}

		if err := tx.Unscoped().Where("user_id = ?", user.ID).Delete(&models.UserSession{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("user_id = ?", user.ID).Delete(&models.UserPolicyAgreement{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("user_id = ?", user.ID).Delete(&models.NotificationRead{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("user_id = ?", user.ID).Delete(&models.ActivityLog{}).Error; err != nil {
			return err
		}

		user.TokenVersion += 10
		if err := tx.Model(&models.User{}).Where("id = ?", user.ID).Update("token_version", user.TokenVersion).Error; err != nil {
			return err
		}

		return tx.Unscoped().Delete(&user).Error
	}); txErr != nil {
		log.Error().Err(txErr).Uint("user_id", user.ID).Msg("DeleteAccount: transaksi penghapusan akun gagal")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghapus data akun dari basis data.",
		})
	}

	// 5. Post-commit physical storage cleanup (Multi-Layer Rollback per AGENTS.md Rule 10)
	for _, s := range stores {
		if h.storage != nil {
			_ = h.storage.DeletePrefix(c.Context(), fmt.Sprintf("stores/%d/", s.ID))
			_ = h.storage.DeletePrefix(c.Context(), fmt.Sprintf("private/stores/%d/", s.ID))
		}
		if cfg != nil && cfg.StorageLocalRoot != "" {
			_ = os.RemoveAll(filepath.Join(cfg.StorageLocalRoot, "stores", fmt.Sprintf("%d", s.ID)))
			_ = os.RemoveAll(filepath.Join(cfg.StorageLocalRoot, fmt.Sprintf("%d", s.ID)))
		}
		if cfg != nil && cfg.StoragePrivateRoot != "" {
			_ = os.RemoveAll(filepath.Join(cfg.StoragePrivateRoot, "stores", fmt.Sprintf("%d", s.ID)))
		}
	}
	if h.storage != nil {
		_ = h.storage.DeletePrefix(c.Context(), fmt.Sprintf("private/billing/users/%d/", user.ID))
	}
	if cfg != nil && cfg.StoragePrivateRoot != "" {
		_ = os.RemoveAll(filepath.Join(cfg.StoragePrivateRoot, "billing", "users", fmt.Sprintf("%d", user.ID)))
	}

	// Blacklist all user session JTIs + clear browser cookies
	for _, s := range activeSess {
		if s.TokenID != "" {
			database.BlacklistToken(s.TokenID, 72*time.Hour)
			middleware.RevokeSessionFingerprint(s.TokenID)
		}
	}
	if claims, ok := c.Locals("claims").(*middleware.JWTClaims); ok && claims != nil && claims.ID != "" {
		database.BlacklistToken(claims.ID, 72*time.Hour)
		middleware.RevokeSessionFingerprint(claims.ID)
	}
	clearSessionCookie(c, cfg)
	clearGoogleRegCookie(c, cfg)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Akun Anda beserta seluruh profil katalog berhasil dihapus permanen.",
	})
}
