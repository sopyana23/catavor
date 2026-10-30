package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/middleware"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"
	"catavor-backend/internal/services"

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
	Name                 string  `json:"name"`
	Email                string  `json:"email"`
	Password             string  `json:"password"`
	VerificationToken    string  `json:"verification_token"`
	StoreSlug            string  `json:"store_slug"`
	Slug                 string  `json:"slug"`
	StoreName            string  `json:"store_name"`
	StoreTitle           string  `json:"store_title"`
	GoogleID             string  `json:"google_id"`
	Avatar               string  `json:"avatar"`
	Plan                 string  `json:"plan"`
	BillingCycle         string  `json:"billing_cycle"`
	PaymentMethod        string  `json:"payment_method"`
	PaymentStatus        string  `json:"payment_status"`
	PaymentProofURL      string  `json:"payment_proof_url"`
	CouponCode           string  `json:"coupon_code"`
	AmountPaid           float64 `json:"amount_paid"`
	WhatsappNumber       string  `json:"whatsapp_number"`
	RegistrationTimezone string  `json:"registration_timezone"`
	Timezone             string  `json:"timezone"`
	WebsiteHP            string  `json:"website_hp,omitempty"` // Anti-bot honeypot field
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
}

type GoogleAuthRequest struct {
	Email      string `json:"email"`
	Name       string `json:"name"`
	GoogleID   string `json:"google_id"`
	Avatar     string `json:"avatar"`
	Credential string `json:"credential"`
	IDToken    string `json:"id_token"`
	Token      string `json:"token"`
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

type AuthHandler struct {
	cfg *config.Config
	db  *gorm.DB
}

func NewAuthHandler(cfg *config.Config, db *gorm.DB) *AuthHandler {
	return &AuthHandler{cfg: cfg, db: db}
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
			logAuthEvent(h.db, c, "AUTH_LOGIN_PORTAL_MISMATCH", "Percobaan login akun staf pengelola melalui portal merchant diarahkan ke konsol pengelola", &user, map[string]interface{}{
				"method": "password",
				"portal": requestedPortal,
				"reason": "admin_on_merchant_portal",
			})
			roleName := user.PlatformRole
			if roleName == "" {
				roleName = "Staf Pengelola"
			}
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success":         false,
				"code":            "STAFF_PORTAL_REQUIRED",
				"message":         fmt.Sprintf("Akun Anda terdaftar sebagai Pengelola Platform (%s). Silakan masuk melalui Konsol Pengelola di /admin.", strings.ToUpper(roleName)),
				"redirect_portal": "/admin",
				"platform_role":   user.PlatformRole,
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

	token, tokenID, expiresAt, err := middleware.GenerateTokenWithID(&user, primaryStore, h.cfg)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal membuat sesi login.",
		})
	}
	go services.RecordUserSession(user.ID, tokenID, expiresAt, c.IP(), c.Get("User-Agent"))
	// SECURITY (M1-mitigasi): rekam sidik jari sesi (hash IP+UA) untuk deteksi
	// penyalahgunaan token di kemudian hari.
	middleware.RegisterSessionFingerprint(tokenID, c.IP(), c.Get("User-Agent"))

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

	if req.GoogleID == "" {
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

	// Check email uniqueness
	var existingUser models.User
	var targetUser models.User
	if err := h.db.Preload("Store").Where("LOWER(email) = ?", req.Email).First(&existingUser).Error; err == nil {
		if req.GoogleID != "" {
			if existingUser.Store != nil {
				theme := existingUser.Store.StoreTheme
				if theme == "" {
					theme = "navy"
				}
				token, tokenID, expiresAt, _ := middleware.GenerateTokenWithID(&existingUser, existingUser.Store, h.cfg)
				go services.RecordUserSession(existingUser.ID, tokenID, expiresAt, c.IP(), c.Get("User-Agent"))
				setSessionCookie(c, h.cfg, token)
				return c.JSON(fiber.Map{
					"success": true,
					"message": "Akun Anda telah terdaftar sebelumnya. Selamat datang kembali!",
					"token":   token,
					"user": fiber.Map{
						"id":                  existingUser.ID,
						"name":                existingUser.Name,
						"email":               existingUser.Email,
						"is_password_changed": true,
						"store_slug":          existingUser.Store.Slug,
						"store_title":         existingUser.Store.StoreTitle,
						"store_theme":         theme,
						"store_plan":          existingUser.Store.Plan,
						"payment_status":      existingUser.Store.PaymentStatus,
					},
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
				"message": "Email sudah terdaftar. Silakan gunakan email lain atau login.",
			})
		}
	} else {
		now := time.Now()
		// SECURITY (N-11): registrasi wajib membawa verification_token yang sah.
		// Sebelumnya hasil ValidateAndConsumeToken diabaikan (`_ =`) dan token
		// kosong pun diloloskan, sehingga verifikasi email bisa dilewati total.
		if req.GoogleID == "" {
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
			EmailVerifiedAt:   &now,
			IsPasswordChanged: true,
		}
		if req.GoogleID != "" {
			googleID := req.GoogleID
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
		targetUser = newUser
	}

	storeTitle := req.StoreTitle
	if storeTitle == "" {
		storeTitle = req.Name + " Store"
	}

	rawPlan := strings.ToLower(strings.TrimSpace(req.Plan))
	requestedPlan := "free"
	if rawPlan == "pro" || rawPlan == "pro_starter" {
		requestedPlan = "pro_starter"
	} else if rawPlan == "pro_business" {
		requestedPlan = "pro_business"
	}

	billingCycle := strings.ToLower(strings.TrimSpace(req.BillingCycle))
	if billingCycle != "annual" {
		billingCycle = "monthly"
	}

	durationMonths := 1
	if billingCycle == "annual" {
		durationMonths = 12
	}

	now := time.Now().UTC()
	var origAmount float64
	var discountAmount float64
	var finalAmount float64
	cleanCoupon := strings.ToUpper(strings.TrimSpace(req.CouponCode))

	if requestedPlan != "free" {
		planInfo, _ := services.GetPlanByCode(h.db, requestedPlan)
		if planInfo != nil {
			if billingCycle == "annual" {
				origAmount = planInfo.PriceAnnual
			} else {
				origAmount = planInfo.PriceMonthly
			}
		}

		if cleanCoupon == "CATAVOR100" || cleanCoupon == "GRATISPRO" {
			discountAmount = origAmount
			finalAmount = 0
		} else if cleanCoupon == "DISKON10K" {
			discountAmount = 10000
			if discountAmount > origAmount {
				discountAmount = origAmount
			}
			finalAmount = origAmount - discountAmount
		} else if cleanCoupon == "DISKON50K" {
			discountAmount = 50000
			if discountAmount > origAmount {
				discountAmount = origAmount
			}
			finalAmount = origAmount - discountAmount
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
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal membuat profil toko.",
		})
	}

	// If paid plan, record initial SubscriptionOrder
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
		if finalAmount > 0 {
			orderPaymentStatus = "pending"
			orderPaidAt = nil
		}

		orderNumber := fmt.Sprintf("INV-SUB-%s-%04d-%04d", time.Now().Format("20060102150405"), newStore.ID%10000, (time.Now().Nanosecond()/1000)%10000)
		subOrder := models.SubscriptionOrder{
			StoreID:         newStore.ID,
			UserID:          targetUser.ID,
			OrderNumber:     orderNumber,
			Type:            "initial",
			PlanCode:        requestedPlan,
			BillingCycle:    billingCycle,
			DurationMonths:  durationMonths,
			OriginalAmount:  origAmount,
			DiscountAmount:  discountAmount,
			FinalAmount:     finalAmount,
			CouponCode:      cleanCoupon,
			PaymentMethod:   payMethod,
			PaymentProofURL: req.PaymentProofURL,
			PaymentStatus:   orderPaymentStatus,
			PaidAt:          orderPaidAt,
		}
		_ = h.db.Create(&subOrder).Error
	}

	token, tokenID, expiresAt, _ := middleware.GenerateTokenWithID(&targetUser, &newStore, h.cfg)
	go services.RecordUserSession(targetUser.ID, tokenID, expiresAt, c.IP(), c.Get("User-Agent"))

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

	regMsg := "Pendaftaran akun dan toko berhasil!"
	if requestedPlan != "free" && finalAmount > 0 {
		regMsg = "Pendaftaran berhasil! Akun dan katalog Anda telah aktif. Bukti pembayaran paket Pro Anda sedang dalam antrean verifikasi tim kami."
	}

	setSessionCookie(c, h.cfg, token)

	return c.JSON(fiber.Map{
		"success":      true,
		"message":      regMsg,
		"token":        token,
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
	verifiedEmail, verifiedName, verifiedGoogleID, verifiedAvatar, err := verifyGoogleCredential(credentialStr, h.cfg.GoogleClientID)
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
		if isPlatformAdmin {
			logAuthEvent(h.db, c, "AUTH_LOGIN_PORTAL_MISMATCH", "Percobaan Google SSO akun staf pengelola melalui portal merchant ditolak", &user, map[string]interface{}{
				"method": "google_sso",
				"reason": "admin_on_merchant_portal",
			})
			roleName := user.PlatformRole
			if roleName == "" {
				roleName = "Staf Pengelola"
			}
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success":         false,
				"code":            "STAFF_PORTAL_REQUIRED",
				"message":         fmt.Sprintf("Akun Anda terdaftar sebagai Pengelola Platform (%s). Silakan masuk melalui Konsol Pengelola di /admin.", strings.ToUpper(roleName)),
				"redirect_portal": "/admin",
				"platform_role":   user.PlatformRole,
			})
		}

		targetSlug := cleanSlug(req.StoreSlug)
		if targetSlug == "" {
			targetSlug = cleanSlug(c.Get("X-Store-Slug"))
		}
		storeList, activeStore := buildStoreSummaries(h.db, user.Stores, user.Store, targetSlug)

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

		token, tokenID, expiresAt, err := middleware.GenerateTokenWithID(&user, primaryStore, h.cfg)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal membuat sesi login.",
			})
		}
		go services.RecordUserSession(user.ID, tokenID, expiresAt, c.IP(), c.Get("User-Agent"))

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

		return c.JSON(fiber.Map{
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
				"avatar":              avatar,
				"has_custom_password": user.HasCustomPassword,
				"store_slug":          activeStore.Slug,
				"store_title":         activeStore.StoreTitle,
				"store_theme":         activeStore.StoreTheme,
				"store_plan":          activeStore.Plan,
				"payment_status":      activeStore.PaymentStatus,
			},
		})
	}

	// CASE B: NEW USER (REGISTRATION FLOW)
	storeName := strings.TrimSpace(req.StoreName)
	storeSlug := cleanSlug(req.StoreSlug)

	if storeName == "" || storeSlug == "" {
		return c.JSON(fiber.Map{
			"success":             true,
			"is_new_user":         true,
			"requires_store_info": true,
			"message":             "Otentikasi Google berhasil! Silakan tentukan Nama Toko dan Link Username Anda.",
			"google_data": fiber.Map{
				"name":      name,
				"email":     email,
				"google_id": googleID,
				"avatar":    avatar,
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

	token, tokenID, expiresAt, _ := middleware.GenerateTokenWithID(&newUser, &newStore, h.cfg)
	go services.RecordUserSession(newUser.ID, tokenID, expiresAt, c.IP(), c.Get("User-Agent"))

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

	client := &http.Client{Timeout: 8 * time.Second}

	// 1. Validate ID Token using Google TokenInfo endpoint (verifies Google's RSA signature and expiry)
	tURL := "https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(credentialStr)
	resp, tErr := client.Get(tURL)
	if tErr == nil && resp.StatusCode == http.StatusOK {
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		var gMap struct {
			Email         string `json:"email"`
			EmailVerified any    `json:"email_verified"`
			Name          string `json:"name"`
			Sub           string `json:"sub"`
			Picture       string `json:"picture"`
			Aud           string `json:"aud"`
		}
		if err := json.Unmarshal(body, &gMap); err == nil && gMap.Email != "" {
			if expectedClientID != "" && gMap.Aud != "" && gMap.Aud != expectedClientID {
				return "", "", "", "", fmt.Errorf("token Google audience tidak cocok dengan konfigurasi aplikasi")
			}
			// N-14: email dari Google wajib sudah terverifikasi. Tanpa cek ini,
			// alamat email yang belum diverifikasi Google bisa dipakai untuk
			// mengambil alih akun yang emailnya sama.
			if !claimsEmailVerified(gMap.EmailVerified) {
				return "", "", "", "", fmt.Errorf("email Google belum terverifikasi")
			}
			return strings.ToLower(strings.TrimSpace(gMap.Email)), gMap.Name, gMap.Sub, gMap.Picture, nil
		}
	}
	if resp != nil {
		_ = resp.Body.Close()
	}

	// 2. Fallback: Validate OAuth2 Access Token using Google UserInfo endpoint
	uReq, uErr := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v3/userinfo", nil)
	if uErr == nil {
		uReq.Header.Set("Authorization", "Bearer "+credentialStr)
		uResp, err := client.Do(uReq)
		if err == nil && uResp.StatusCode == http.StatusOK {
			defer uResp.Body.Close()
			uBody, _ := io.ReadAll(uResp.Body)
			var uMap struct {
				Email         string `json:"email"`
				EmailVerified any    `json:"email_verified"`
				Name          string `json:"name"`
				Sub           string `json:"sub"`
				Picture       string `json:"picture"`
			}
			if err := json.Unmarshal(uBody, &uMap); err == nil && uMap.Email != "" {
				// N-14: sama seperti jalur ID token, email wajib terverifikasi.
				if !claimsEmailVerified(uMap.EmailVerified) {
					return "", "", "", "", fmt.Errorf("email Google belum terverifikasi")
				}
				return strings.ToLower(strings.TrimSpace(uMap.Email)), uMap.Name, uMap.Sub, uMap.Picture, nil
			}
		}
		if uResp != nil {
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

	newToken, err := middleware.GenerateToken(user, currentStore, h.cfg)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperpanjang sesi token.",
		})
	}

	setSessionCookie(c, h.cfg, newToken)

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
	// Revoke current JWT token via Blacklist (Redis & Memory)
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
		}
	}

	// SECURITY (M1): hapus cookie sesi HttpOnly saat logout.
	clearSessionCookie(c, h.cfg)

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

	if req.Name != "" {
		user.Name = security.SanitizePlainText(req.Name, 100)
	}

	if req.Email != "" && strings.ToLower(req.Email) != strings.ToLower(user.Email) {
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
		user.Email = reqEmail
	}

	passwordWasChanged := false
	if req.Password != "" {
		if user.HasCustomPassword {
			if strings.TrimSpace(req.OTP) != "" {
				token, err := services.GetOTPService().VerifyOTP(user.Email, strings.TrimSpace(req.OTP), "password_reset")
				if err != nil {
					return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
						"success": false,
						"message": safeErrMsg(err, "Permintaan tidak dapat diproses."),
					})
				}
				// SECURITY (N-11): token verifikasi wajib valid & terpakai.
				if !services.GetOTPService().ValidateAndConsumeToken(user.Email, token, "password_reset") {
					return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
						"success": false,
						"message": "Token verifikasi tidak valid atau sudah kedaluwarsa. Silakan minta kode baru.",
					})
				}
			} else {
				if strings.TrimSpace(req.CurrentPassword) == "" {
					return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
						"success": false,
						"message": "Kata sandi saat ini wajib diisi untuk mengubah kata sandi akun.",
					})
				}
				if !user.CheckPassword(req.CurrentPassword) {
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

		// Industry Standard & NIST SP 800-63B / OWASP ASVS: Prevent password reuse against current active password
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
		user.TokenVersion++
		passwordWasChanged = true
	}

	if err := h.db.Save(user).Error; err != nil {
		log.Error().Err(err).Msg("UpdateProfile DB.Save failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui profil.",
		})
	}

	actorRole := user.PlatformStaffRoleLabel()
	action := "auth.profile_updated"
	desc := fmt.Sprintf("Pengguna %s memperbarui data profil.", user.Name)
	if req.Password != "" {
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
		// Enqueue real-time transactional security alert email
		subj, body := services.BuildPasswordChangedSecurityEmail(user.Name, user.Email, c.Get("User-Agent"), c.IP())
		_, _ = services.EnqueueEmail(user.Email, user.Name, "Catavor Keamanan", subj, body, "security_alert", fmt.Sprintf("pwd_change_%d_%d", user.ID, time.Now().Unix()))
	}

	var newToken string
	if req.Password != "" {
		activeStore, _ := c.Locals("store").(*models.Store)
		if activeStore == nil {
			activeStore = user.Store
		}
		newToken, _ = middleware.GenerateToken(user, activeStore, h.cfg)
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

	var user models.User
	if err := h.db.Where("LOWER(email) = ?", reqEmail).First(&user).Error; err != nil {
		// Return success message even if not found to prevent user enumeration
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Jika email terdaftar, instruksi pemulihan telah dikirimkan ke kotak masuk Anda.",
		})
	}

	// N-17: akun blacklisted tidak boleh dibedakan dari email tak terdaftar —
	// sebelumnya 403 "Akun ini telah dinonaktifkan" vs 200 membuat status
	// penangguhan sebuah akun dapat dipetakan dari luar.
	if user.IsBlacklisted {
		log.Warn().Str("ip", c.IP()).Msg("ForgotPasswordRequest: akun blacklisted (respons disamarkan)")
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Jika email terdaftar, instruksi pemulihan telah dikirimkan ke kotak masuk Anda.",
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
		"message": "Kode OTP pemulihan kata sandi telah dikirimkan ke email Anda.",
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

	now := time.Now()
	user.EmailVerifiedAt = &now
	user.IsPasswordChanged = true
	user.HasCustomPassword = true
	user.TokenVersion++

	if err := h.db.Save(&user).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui kata sandi.",
		})
	}

	// Enqueue real-time transactional security alert email
	subj, body := services.BuildPasswordChangedSecurityEmail(user.Name, user.Email, c.Get("User-Agent"), c.IP())
	_, _ = services.EnqueueEmail(user.Email, user.Name, "Catavor Keamanan", subj, body, "security_alert", fmt.Sprintf("pwd_reset_%d_%d", user.ID, time.Now().Unix()))

	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		UserID:      &user.ID,
		ActorRole:   "merchant",
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

	newToken, _ := middleware.GenerateToken(&user, user.Store, h.cfg)
	if newToken != "" {
		setSessionCookie(c, h.cfg, newToken)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Kata sandi Anda berhasil diperbarui.",
		"token":   newToken,
	})
}

// RequestProfilePasswordOTP sends a password recovery OTP for the authenticated user (or provided email).
func (h *AuthHandler) RequestProfilePasswordOTP(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	var user *models.User
	if u, ok := c.Locals("user").(*models.User); ok && u != nil {
		user = u
	} else {
		claims := middleware.ExtractOptionalClaims(c, h.cfg)
		if claims != nil && claims.UserID > 0 {
			var u models.User
			if err := h.db.First(&u, claims.UserID).Error; err == nil {
				user = &u
			}
		}
		if user == nil {
			var bodyReq struct {
				Email string `json:"email"`
			}
			if err := c.BodyParser(&bodyReq); err != nil || bodyReq.Email == "" {
				_ = json.Unmarshal(c.Body(), &bodyReq)
			}
			reqEmail := strings.TrimSpace(strings.ToLower(bodyReq.Email))
			if reqEmail != "" {
				var u models.User
				if err := h.db.Where("LOWER(email) = ?", reqEmail).First(&u).Error; err == nil {
					user = &u
				}
			}
		}
	}

	if user == nil || user.ID == 0 || user.Email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Sesi tidak valid atau pengguna tidak ditemukan.",
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

	// 2. Validate password if user has password
	if user.HasCustomPassword && user.Password != "" {
		if req.Password == "" || !user.CheckPassword(req.Password) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Kata sandi akun yang Anda masukkan salah.",
			})
		}
	}

	cfg := h.cfg
	if cfg == nil {
		cfg = config.LoadConfig()
	}

	// 3. Find all stores owned by user and hard-delete their media
	var stores []models.Store
	h.db.Where("user_id = ?", user.ID).Find(&stores)

	tx := h.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	for _, s := range stores {
		_ = tx.Where("store_id = ?", s.ID).Delete(&models.ProductVariant{}).Error
		_ = tx.Where("store_id = ?", s.ID).Delete(&models.ProductImage{}).Error
		_ = tx.Where("store_id = ?", s.ID).Delete(&models.Product{}).Error
		_ = tx.Where("store_id = ?", s.ID).Delete(&models.Category{}).Error
		_ = tx.Where("store_id = ?", s.ID).Delete(&models.Article{}).Error
		_ = tx.Where("store_id = ?", s.ID).Delete(&models.StoreDailyAnalytics{}).Error
		_ = tx.Where("store_id = ?", s.ID).Delete(&models.ProductDailyAnalytics{}).Error
		_ = tx.Where("store_id = ?", s.ID).Delete(&models.StoreDailyTrafficSource{}).Error
		_ = tx.Where("store_id = ?", s.ID).Delete(&models.NotificationRead{}).Error
		_ = tx.Where("store_id = ?", s.ID).Delete(&models.ActivityLog{}).Error
		_ = tx.Delete(&s).Error

		// Disk cleanup
		if cfg.StorageLocalRoot != "" {
			_ = os.RemoveAll(filepath.Join(cfg.StorageLocalRoot, "stores", fmt.Sprintf("%d", s.ID)))
			_ = os.RemoveAll(filepath.Join(cfg.StorageLocalRoot, fmt.Sprintf("%d", s.ID)))
		}
	}

	// Delete user sessions & agreements
	_ = tx.Where("user_id = ?", user.ID).Delete(&models.UserSession{}).Error
	_ = tx.Where("user_id = ?", user.ID).Delete(&models.UserPolicyAgreement{}).Error

	// Clean up user's support tickets and physical media attachments under UU PDP / GDPR Right to Erasure
	_, _, _ = services.PurgeUserTicketsAndAttachments(h.db, nil, user.ID)

	// Invalidate tokens in memory/Redis
	user.TokenVersion += 10
	_ = tx.Save(&user).Error

	// Delete user record
	if err := tx.Delete(&user).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghapus data akun dari basis data.",
		})
	}

	if err := tx.Commit().Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menyelesaikan transaksi penghapusan akun.",
		})
	}

	// Blacklist current token if present
	if claims, ok := c.Locals("claims").(*middleware.JWTClaims); ok && claims != nil && claims.ID != "" {
		database.BlacklistToken(claims.ID, 72*time.Hour)
		middleware.RevokeSessionFingerprint(claims.ID)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Akun Anda beserta seluruh profil katalog berhasil dihapus permanen.",
	})
}
