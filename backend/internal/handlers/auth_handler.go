package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
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
	"gorm.io/datatypes"
)

var validate = validator.New()

type LoginRequest struct {
	Email     string `json:"email" validate:"required,email,max=254"`
	Password  string `json:"password" validate:"required,max=72"`
	StoreSlug string `json:"store_slug"`
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
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirm_password"`
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

func buildStoreSummaries(stores []models.Store, singleStore *models.Store, targetSlug string) ([]StoreSummary, StoreSummary) {
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
		database.DB.Model(&models.Product{}).Where("store_id = ?", s.ID).Count(&itemCount)

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
		database.DB.Model(&models.Product{}).Where("store_id = ?", singleStore.ID).Count(&itemCount)

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
}

func NewAuthHandler(cfg *config.Config) *AuthHandler {
	return &AuthHandler{cfg: cfg}
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
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
	if err := database.DB.Preload("Stores").Preload("Store").Where("LOWER(email) = ?", cleanedEmail).First(&user).Error; err != nil {
		_, _ = database.RecordLoginFailure(cleanedEmail)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Email atau kata sandi yang Anda masukkan salah.",
		})
	}

	if !user.CheckPassword(req.Password) {
		attempts, locked := database.RecordLoginFailure(cleanedEmail)
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
		strings.EqualFold(user.PlatformRole, "support") ||
		strings.EqualFold(user.PlatformRole, "compliance") ||
		strings.EqualFold(user.PlatformRole, "admin") ||
		user.Email == "admin@catavor.com"

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
	storeList, activeStore := buildStoreSummaries(user.Stores, user.Store, targetSlug)

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

	token, err := middleware.GenerateToken(&user, primaryStore, h.cfg)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal membuat sesi login.",
		})
	}

	// Touch store activity upon admin login
	for _, st := range user.Stores {
		services.TouchStoreActivity(database.DB, st.ID)
	}
	if user.Store != nil {
		services.TouchStoreActivity(database.DB, user.Store.ID)
	}

	actorRole := "merchant"
	if user.Email == "admin@catavor.com" {
		actorRole = "superadmin"
	}
	var activeStoreID *uint
	if activeStore.ID > 0 {
		activeStoreID = &activeStore.ID
	}
	services.RecordActivity(services.RecordActivityParams{
		DB:          database.DB,
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

	return c.JSON(fiber.Map{
		"success":             true,
		"message":             "Login berhasil.",
		"token":               token,
		"is_password_changed": user.IsPasswordChanged,
		"stores":                   storeList,
		"stores_count":             len(storeList),
		"requires_store_selection": activeStore.ID == 0 && len(storeList) > 0,
		"active_store":             activeStore,
		"user": fiber.Map{
			"id":                  user.ID,
			"name":                user.Name,
			"email":               user.Email,
			"platform_role":       user.PlatformRole,
			"is_superadmin":       strings.EqualFold(user.PlatformRole, "superadmin") || user.Email == "admin@catavor.com",
			"is_admin":            (user.PlatformRole != "" && user.PlatformRole != "merchant") || user.Email == "admin@catavor.com",
			"permissions":         services.GetRBACService().GetUserPermissions(&user),
			"is_password_changed": user.IsPasswordChanged,
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
				"message": err.Error(),
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
	database.DB.Model(&models.User{}).Where("LOWER(email) = ? AND is_blacklisted = true", req.Email).Count(&blacklistedUserCount)
	if blacklistedUserCount > 0 {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Pendaftaran ditolak: Alamat email ini telah ditangguhkan secara permanen karena pelanggaran pedoman platform Catavor.",
		})
	}

	var blacklistedStoreCount int64
	database.DB.Model(&models.Store{}).Where("LOWER(slug) = ? AND (is_blacklisted = true OR dormancy_status = 'banned')", slug).Count(&blacklistedStoreCount)
	if blacklistedStoreCount > 0 {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Pendaftaran ditolak: Nama pengguna / slug toko ini telah dinonaktifkan secara permanen dan tidak dapat digunakan kembali.",
		})
	}

	var blacklistedSlugCount int64
	database.DB.Model(&models.BlacklistedSlug{}).Where("LOWER(slug) = ?", slug).Count(&blacklistedSlugCount)
	if blacklistedSlugCount > 0 {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Pendaftaran ditolak: Nama pengguna / slug toko ini telah dinonaktifkan secara permanen oleh platform dan tidak dapat digunakan kembali.",
		})
	}

	// Check store slug uniqueness
	var existingStore models.Store
	if err := database.DB.Where("LOWER(slug) = ?", slug).First(&existingStore).Error; err == nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Nama pengguna toko sudah terpakai. Silakan pilih nama lain.",
		})
	}

	// Check email uniqueness
	var existingUser models.User
	var targetUser models.User
	if err := database.DB.Preload("Store").Where("LOWER(email) = ?", req.Email).First(&existingUser).Error; err == nil {
		if req.GoogleID != "" {
			if existingUser.Store != nil {
				theme := existingUser.Store.StoreTheme
				if theme == "" {
					theme = "navy"
				}
				token, _ := middleware.GenerateToken(&existingUser, existingUser.Store, h.cfg)
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
				database.DB.Save(&targetUser)
			}
		} else {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"success": false,
				"message": "Email sudah terdaftar. Silakan gunakan email lain atau login.",
			})
		}
	} else {
		now := time.Now()
		if req.GoogleID == "" && req.VerificationToken != "" {
			_ = services.GetOTPService().ValidateAndConsumeToken(req.Email, req.VerificationToken, "registration")
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
			_ = newUser.SetPassword("G_SSO_" + googleID + "_" + uuid.New().String()[:8])
		} else {
			if err := newUser.SetPassword(req.Password); err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"success": false,
					"message": "Gagal memproses kata sandi.",
				})
			}
		}

		if err := database.DB.Create(&newUser).Error; err != nil {
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
		planInfo, _ := services.GetPlanByCode(database.DB, requestedPlan)
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

	if err := database.DB.Create(&newStore).Error; err != nil {
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
		_ = database.DB.Create(&subOrder).Error
	}

	token, _ := middleware.GenerateToken(&targetUser, &newStore, h.cfg)

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
			"message": "Verifikasi otentikasi Google gagal: " + err.Error(),
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
	query := database.DB.Preload("Stores").Preload("Store").Where("LOWER(email) = ?", email)
	if googleID != "" {
		query = database.DB.Preload("Stores").Preload("Store").Where("LOWER(email) = ? OR google_id = ?", email, googleID)
	}

	err = query.First(&user).Error

	// CASE A: USER ALREADY EXISTS (LOGIN FLOW)
	if err == nil {
		if (user.GoogleID == nil || *user.GoogleID == "") && googleID != "" {
			user.GoogleID = &googleID
			database.DB.Save(&user)
		}

		targetSlug := cleanSlug(req.StoreSlug)
		if targetSlug == "" {
			targetSlug = cleanSlug(c.Get("X-Store-Slug"))
		}
		storeList, activeStore := buildStoreSummaries(user.Stores, user.Store, targetSlug)

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

		token, err := middleware.GenerateToken(&user, primaryStore, h.cfg)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal membuat sesi login.",
			})
		}

		// Touch store activity upon Google login
		for _, st := range user.Stores {
			services.TouchStoreActivity(database.DB, st.ID)
		}
		if user.Store != nil {
			services.TouchStoreActivity(database.DB, user.Store.ID)
		}

		return c.JSON(fiber.Map{
			"success":             true,
			"is_new_user":         false,
			"message":             "Login Google berhasil!",
			"token":               token,
			"is_password_changed": true,
			"stores":                   storeList,
			"stores_count":             len(storeList),
			"requires_store_selection": activeStore.ID == 0 && len(storeList) > 0,
			"active_store":             activeStore,
			"user": fiber.Map{
				"id":                  user.ID,
				"name":                user.Name,
				"email":               user.Email,
				"avatar":              avatar,
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
	if err := database.DB.Where("LOWER(slug) = ?", storeSlug).First(&existingStore).Error; err == nil {
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
	}
	_ = newUser.SetPassword("G_SSO_" + googleID + "_" + uuid.New().String()[:8])

	if err := database.DB.Create(&newUser).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mendaftarkan akun.",
		})
	}

	clientTimezone := strings.TrimSpace(req.Timezone)
	if clientTimezone == "" {
		clientTimezone = "Asia/Jakarta"
	}

	rawPlan := strings.ToLower(strings.TrimSpace(req.Plan))
	plan := "free"
	if rawPlan == "pro" || rawPlan == "pro_starter" {
		plan = "pro_starter"
	} else if rawPlan == "pro_business" {
		plan = "pro_business"
	}

	utcNow := time.Now().UTC()
	var planExpiresAt *time.Time
	planStatus := "active"
	customDomainStatus := "none"

	if plan != "free" {
		exp := utcNow.AddDate(0, 1, 0)
		planExpiresAt = &exp
		if plan == "pro_business" {
			customDomainStatus = "active"
		}
	}

	paymentStatus := "free_active"
	if plan != "free" {
		paymentStatus = "paid"
	}

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

	if err := database.DB.Create(&newStore).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal membuat toko baru.",
		})
	}

	token, _ := middleware.GenerateToken(&newUser, &newStore, h.cfg)

	return c.JSON(fiber.Map{
		"success":             true,
		"is_new_user":         true,
		"message":             "Pendaftaran Google berhasil!",
		"token":               token,
		"is_password_changed": true,
		"user": fiber.Map{
			"id":                  newUser.ID,
			"name":                newUser.Name,
			"email":               newUser.Email,
			"avatar":              avatar,
			"store_slug":          newStore.Slug,
			"store_title":         newStore.StoreTitle,
			"store_theme":         newStore.StoreTheme,
			"store_plan":          newStore.Plan,
			"payment_status":      newStore.PaymentStatus,
		},
	})
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
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"code":    "USER_NOT_FOUND",
			"message": "Pengguna tidak ditemukan.",
		})
	}

	isPlatformAdmin := strings.EqualFold(user.PlatformRole, "superadmin") ||
		strings.EqualFold(user.PlatformRole, "support") ||
		strings.EqualFold(user.PlatformRole, "compliance") ||
		strings.EqualFold(user.PlatformRole, "admin") ||
		user.Email == "admin@catavor.com"

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
	storeList, activeStore := buildStoreSummaries(user.Stores, user.Store, targetSlug)

	if !isPlatformAdmin && len(storeList) == 0 {
		var totalStoresCount int64
		database.DB.Model(&models.Store{}).Where("user_id = ?", user.ID).Count(&totalStoresCount)
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
			"is_superadmin":       strings.EqualFold(user.PlatformRole, "superadmin") || user.Email == "admin@catavor.com",
			"is_admin":            (user.PlatformRole != "" && user.PlatformRole != "merchant") || user.Email == "admin@catavor.com",
			"permissions":         services.GetRBACService().GetUserPermissions(user),
			"is_password_changed": user.IsPasswordChanged,
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
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"code":    "USER_NOT_FOUND",
			"message": "Pengguna tidak ditemukan.",
		})
	}

	isPlatformAdmin := strings.EqualFold(user.PlatformRole, "superadmin") ||
		strings.EqualFold(user.PlatformRole, "support") ||
		strings.EqualFold(user.PlatformRole, "compliance") ||
		strings.EqualFold(user.PlatformRole, "admin") ||
		user.Email == "admin@catavor.com"

	if !isPlatformAdmin && user.IsBlacklisted {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "ACCOUNT_BANNED",
			"message": "Akun dan profil katalog Anda telah dinonaktifkan secara permanen karena pelanggaran pedoman platform. Sesi login telah dicabut.",
		})
	}

	targetSlug := c.Get("X-Store-Slug")
	storeList, activeStore := buildStoreSummaries(user.Stores, user.Store, targetSlug)

	if !isPlatformAdmin && len(storeList) == 0 {
		var totalStoresCount int64
		database.DB.Model(&models.Store{}).Where("user_id = ?", user.ID).Count(&totalStoresCount)
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
			"is_superadmin":       strings.EqualFold(user.PlatformRole, "superadmin") || user.Email == "admin@catavor.com",
			"is_admin":            (user.PlatformRole != "" && user.PlatformRole != "merchant") || user.Email == "admin@catavor.com",
			"permissions":         services.GetRBACService().GetUserPermissions(user),
			"is_password_changed": user.IsPasswordChanged,
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
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Logout berhasil. Sesi Anda telah ditutup dengan aman.",
	})
}

func (h *AuthHandler) UpdateProfile(c *fiber.Ctx) error {
	user := c.Locals("user").(*models.User)

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
		database.DB.Model(&models.User{}).Where("LOWER(email) = ? AND id != ?", reqEmail, user.ID).Count(&cnt)
		if cnt > 0 {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"success": false,
				"message": "Email sudah digunakan oleh pengguna lain.",
			})
		}
		user.Email = reqEmail
	}

	if req.Password != "" {
		if err := security.ValidatePassword(req.Password); err != nil {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"success": false,
				"message": err.Error(),
			})
		}
		if req.ConfirmPassword != "" && req.Password != req.ConfirmPassword {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"success": false,
				"message": "Konfirmasi kata sandi tidak cocok.",
			})
		}
		if err := user.SetPassword(req.Password); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal mengenkripsi kata sandi.",
			})
		}
		user.IsPasswordChanged = true
		user.TokenVersion++
	}

	if err := database.DB.Save(user).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui profil.",
		})
	}

	actorRole := "merchant"
	if user.Email == "admin@catavor.com" {
		actorRole = "superadmin"
	}
	action := "auth.profile_updated"
	desc := fmt.Sprintf("Pengguna %s memperbarui data profil.", user.Name)
	if req.Password != "" {
		action = "auth.password_changed"
		desc = fmt.Sprintf("Pengguna %s berhasil mengganti kata sandi akun.", user.Name)
	}

	services.RecordActivity(services.RecordActivityParams{
		DB:          database.DB,
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

	var newToken string
	if req.Password != "" {
		newToken, _ = middleware.GenerateToken(user, user.Store, h.cfg)
	}

	resMap := fiber.Map{
		"success": true,
		"message": "Profil dan kata sandi berhasil diperbarui.",
		"user": fiber.Map{
			"id":                  user.ID,
			"name":                user.Name,
			"email":               user.Email,
			"is_password_changed": user.IsPasswordChanged,
		},
	}
	if newToken != "" {
		resMap["token"] = newToken
	}

	return c.JSON(resMap)
}

// SendRegistrationOTP issues a 6-digit email OTP for manual registration.
func (h *AuthHandler) SendRegistrationOTP(c *fiber.Ctx) error {
	var req SendRegistrationOTPRequest
	if err := c.BodyParser(&req); err != nil {
		if uErr := json.Unmarshal(c.Body(), &req); uErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Format data tidak valid: " + err.Error() + " (body: " + string(c.Body()) + ")",
			})
		}
	}

	// Security Defense: Anti-bot honeypot check
	if security.IsBotHoneypotTriggered(req.WebsiteHP) {
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Kode OTP 6-digit telah dikirimkan ke kotak masuk email Anda.",
		})
	}

	reqEmail := strings.TrimSpace(strings.ToLower(req.Email))
	if reqEmail == "" || !security.ValidateEmail(reqEmail) {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Format alamat email tidak valid.",
		})
	}

	// Check if email is blacklisted
	var blacklistedCount int64
	database.DB.Model(&models.User{}).Where("LOWER(email) = ? AND is_blacklisted = true", reqEmail).Count(&blacklistedCount)
	if blacklistedCount > 0 {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Pendaftaran ditolak: Alamat email ini telah ditangguhkan secara permanen oleh platform.",
		})
	}

	// Check if email already registered
	var existingCount int64
	database.DB.Model(&models.User{}).Where("LOWER(email) = ?", reqEmail).Count(&existingCount)
	if existingCount > 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Email sudah terdaftar. Silakan login atau gunakan email lain.",
		})
	}

	_, err := services.GetOTPService().GenerateAndSendRegistrationOTP(reqEmail, req.Name)
	if err != nil {
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
			"success": false,
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Kode OTP 6-digit telah dikirimkan ke kotak masuk email Anda.",
	})
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
			"message": err.Error(),
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
	if err := database.DB.Where("LOWER(email) = ?", reqEmail).First(&user).Error; err != nil {
		// Return success message even if not found to prevent user enumeration
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Jika email terdaftar, instruksi pemulihan telah dikirimkan ke kotak masuk Anda.",
		})
	}

	if user.IsBlacklisted {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akun ini telah dinonaktifkan.",
		})
	}

	_, err := services.GetOTPService().GenerateAndSendPasswordResetOTP(user.Email, user.Name)
	if err != nil {
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
			"success": false,
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Kode OTP pemulihan kata sandi telah dikirimkan ke email Anda.",
	})
}

// ForgotPasswordReset validates the recovery OTP and resets the user's password.
func (h *AuthHandler) ForgotPasswordReset(c *fiber.Ctx) error {
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
			"message": err.Error(),
		})
	}

	token, err := services.GetOTPService().VerifyOTP(reqEmail, req.OTP, "password_reset")
	if err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": err.Error(),
		})
	}

	// Consume verification token
	_ = services.GetOTPService().ValidateAndConsumeToken(reqEmail, token, "password_reset")

	var user models.User
	if err := database.DB.Where("LOWER(email) = ?", reqEmail).First(&user).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Pengguna tidak ditemukan.",
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
	user.TokenVersion++

	if err := database.DB.Save(&user).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui kata sandi.",
		})
	}

	services.RecordActivity(services.RecordActivityParams{
		DB:          database.DB,
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

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Kata sandi Anda berhasil diperbarui. Silakan login dengan kata sandi baru Anda.",
	})
}

func cleanSlug(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	reg := regexp.MustCompile("[^a-z0-9-]+")
	s = reg.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	return s
}
