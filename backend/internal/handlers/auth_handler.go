package handlers

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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
	Email    string `json:"email" validate:"required,email,max=254"`
	Password string `json:"password" validate:"required,max=72"`
}

type RegisterRequest struct {
	Name                 string  `json:"name"`
	Email                string  `json:"email"`
	Password             string  `json:"password"`
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
	ID             uint   `json:"id"`
	Slug           string `json:"slug"`
	StoreTitle     string `json:"store_title"`
	StoreSlogan    string `json:"store_slogan"`
	StoreTheme     string `json:"store_theme"`
	StoreLogoURL   string `json:"store_logo_url"`
	Plan           string `json:"plan"`
	PaymentStatus  string `json:"payment_status"`
	WhatsappNumber string `json:"whatsapp_number"`
}

func buildStoreSummaries(stores []models.Store, singleStore *models.Store, targetSlug string) ([]StoreSummary, StoreSummary) {
	var list []StoreSummary
	for _, s := range stores {
		theme := s.StoreTheme
		if theme == "" {
			theme = "navy"
		}
		list = append(list, StoreSummary{
			ID:             s.ID,
			Slug:           s.Slug,
			StoreTitle:     s.StoreTitle,
			StoreSlogan:    s.StoreSlogan,
			StoreTheme:     theme,
			StoreLogoURL:   s.StoreLogoURL,
			Plan:           s.Plan,
			PaymentStatus:  s.PaymentStatus,
			WhatsappNumber: s.WhatsappNumber,
		})
	}
	if len(list) == 0 && singleStore != nil {
		theme := singleStore.StoreTheme
		if theme == "" {
			theme = "navy"
		}
		summary := StoreSummary{
			ID:             singleStore.ID,
			Slug:           singleStore.Slug,
			StoreTitle:     singleStore.StoreTitle,
			StoreSlogan:    singleStore.StoreSlogan,
			StoreTheme:     theme,
			StoreLogoURL:   singleStore.StoreLogoURL,
			Plan:           singleStore.Plan,
			PaymentStatus:  singleStore.PaymentStatus,
			WhatsappNumber: singleStore.WhatsappNumber,
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

	var user models.User
	if err := database.DB.Preload("Stores").Preload("Store").Where("LOWER(email) = ?", strings.ToLower(req.Email)).First(&user).Error; err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Email atau kata sandi yang Anda masukkan salah.",
		})
	}

	if !user.CheckPassword(req.Password) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Email atau kata sandi yang Anda masukkan salah.",
		})
	}

	storeList, activeStore := buildStoreSummaries(user.Stores, user.Store, "")

	var primaryStore *models.Store
	if len(user.Stores) > 0 {
		primaryStore = &user.Stores[0]
	} else {
		primaryStore = user.Store
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
		"success":      true,
		"message":      "Login berhasil.",
		"token":        token,
		"stores":       storeList,
		"active_store": activeStore,
		"user": fiber.Map{
			"id":                  user.ID,
			"name":                user.Name,
			"email":               user.Email,
			"is_password_changed": user.IsPasswordChanged,
			"store_slug":          activeStore.Slug,
			"store_title":         activeStore.StoreTitle,
			"store_theme":         activeStore.StoreTheme,
			"store_plan":          activeStore.Plan,
			"payment_status":      activeStore.PaymentStatus,
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

	reservedWords := []string{"admin", "api", "sanctum", "desktop", "mobile", "assets", "login", "register", "terms", "privacy", "acceptable-use", "settings"}
	for _, r := range reservedWords {
		if slug == r {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"success": false,
				"message": "Nama pengguna / slug toko ini telah digunakan oleh sistem.",
			})
		}
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
		newUser := models.User{
			Name:              req.Name,
			Email:             req.Email,
			IsPasswordChanged: true,
		}
		if req.GoogleID != "" {
			googleID := req.GoogleID
			newUser.GoogleID = &googleID
			now := time.Now()
			newUser.EmailVerifiedAt = &now
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
	plan := "free"
	if rawPlan == "pro" || rawPlan == "pro_starter" {
		plan = "pro_starter"
	} else if rawPlan == "pro_business" {
		plan = "pro_business"
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
	var planExpiresAt *time.Time
	planStatus := "active"
	customDomainStatus := "none"

	if plan != "free" {
		exp := now.AddDate(0, durationMonths, 0)
		planExpiresAt = &exp
		if plan == "pro_business" {
			customDomainStatus = "active"
		}
	}

	paymentStatus := "free_active"
	if plan != "free" {
		paymentStatus = "paid"
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
		Plan:                    plan,
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
	if plan != "free" {
		planInfo, _ := services.GetPlanByCode(database.DB, plan)
		var origAmount float64
		if planInfo != nil {
			if billingCycle == "annual" {
				origAmount = planInfo.PriceAnnual
			} else {
				origAmount = planInfo.PriceMonthly
			}
		}

		finalAmount := origAmount
		discountAmount := float64(0)
		cleanCoupon := strings.ToUpper(strings.TrimSpace(req.CouponCode))
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
		}

		payMethod := strings.ToLower(strings.TrimSpace(req.PaymentMethod))
		if payMethod == "" {
			payMethod = "bank"
		}
		if finalAmount == 0 {
			payMethod = "coupon_free"
		}

		orderNumber := fmt.Sprintf("INV-SUB-%s-%04d-%04d", time.Now().Format("20060102150405"), newStore.ID%10000, (time.Now().Nanosecond()/1000)%10000)
		subOrder := models.SubscriptionOrder{
			StoreID:         newStore.ID,
			UserID:          targetUser.ID,
			OrderNumber:     orderNumber,
			Type:            "initial",
			PlanCode:        plan,
			BillingCycle:    billingCycle,
			DurationMonths:  durationMonths,
			OriginalAmount:  origAmount,
			DiscountAmount:  discountAmount,
			FinalAmount:     finalAmount,
			CouponCode:      cleanCoupon,
			PaymentMethod:   payMethod,
			PaymentProofURL: req.PaymentProofURL,
			PaymentStatus:   "paid",
			PaidAt:          &now,
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

	return c.JSON(fiber.Map{
		"success":      true,
		"message":      "Pendaftaran berhasil.",
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

	email := strings.TrimSpace(req.Email)
	name := strings.TrimSpace(req.Name)
	googleID := strings.TrimSpace(req.GoogleID)
	avatar := strings.TrimSpace(req.Avatar)

	// Decode GSI JWT Credential if present
	credentialStr := req.Credential
	if credentialStr == "" {
		credentialStr = req.IDToken
	}
	if credentialStr == "" {
		credentialStr = req.Token
	}

	if credentialStr != "" && email == "" {
		decEmail, decName, decSub, decPic := decodeGoogleJWT(credentialStr)
		if decEmail != "" {
			email = decEmail
			if name == "" {
				name = decName
			}
			if googleID == "" {
				googleID = decSub
			}
			if avatar == "" {
				avatar = decPic
			}
		} else {
			// Fallback to Google TokenInfo API
			resp, err := http.Get("https://oauth2.googleapis.com/tokeninfo?id_token=" + credentialStr)
			if err == nil && resp.StatusCode == http.StatusOK {
				defer resp.Body.Close()
				body, _ := io.ReadAll(resp.Body)
				var gMap struct {
					Email   string `json:"email"`
					Name    string `json:"name"`
					Sub     string `json:"sub"`
					Picture string `json:"picture"`
				}
				if err := json.Unmarshal(body, &gMap); err == nil {
					email = gMap.Email
					name = gMap.Name
					googleID = gMap.Sub
					avatar = gMap.Picture
				}
			}
		}
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

	err := query.First(&user).Error

	// CASE A: USER ALREADY EXISTS (LOGIN FLOW)
	if err == nil {
		if (user.GoogleID == nil || *user.GoogleID == "") && googleID != "" {
			user.GoogleID = &googleID
			database.DB.Save(&user)
		}

		storeList, activeStore := buildStoreSummaries(user.Stores, user.Store, "")

		var primaryStore *models.Store
		if len(user.Stores) > 0 {
			primaryStore = &user.Stores[0]
		} else {
			primaryStore = user.Store
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
			"stores":              storeList,
			"active_store":        activeStore,
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

func decodeGoogleJWT(jwtStr string) (email, name, googleID, avatar string) {
	parts := strings.Split(jwtStr, ".")
	if len(parts) < 2 {
		return
	}
	p := parts[1]
	p = strings.ReplaceAll(p, "-", "+")
	p = strings.ReplaceAll(p, "_", "/")
	for len(p)%4 != 0 {
		p += "="
	}
	decoded, err := base64.StdEncoding.DecodeString(p)
	if err != nil {
		return
	}
	var gMap struct {
		Email   string `json:"email"`
		Name    string `json:"name"`
		Sub     string `json:"sub"`
		Picture string `json:"picture"`
	}
	if err := json.Unmarshal(decoded, &gMap); err == nil {
		email = gMap.Email
		name = gMap.Name
		googleID = gMap.Sub
		avatar = gMap.Picture
	}
	return
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

	targetSlug := c.Get("X-Store-Slug")
	if targetSlug == "" {
		if s, ok := c.Locals("store_slug").(string); ok && s != "" {
			targetSlug = s
		}
	}
	storeList, activeStore := buildStoreSummaries(user.Stores, user.Store, targetSlug)

	return c.JSON(fiber.Map{
		"success":      true,
		"valid":        true,
		"message":      "Sesi token valid dan aktif.",
		"stores":       storeList,
		"active_store": activeStore,
		"user": fiber.Map{
			"id":                  user.ID,
			"name":                user.Name,
			"email":               user.Email,
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

	targetSlug := c.Get("X-Store-Slug")
	storeList, activeStore := buildStoreSummaries(user.Stores, user.Store, targetSlug)

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
		"success":      true,
		"message":      "Sesi login berhasil diperpanjang.",
		"token":        newToken,
		"stores":       storeList,
		"active_store": activeStore,
		"user": fiber.Map{
			"id":                  user.ID,
			"name":                user.Name,
			"email":               user.Email,
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
	return c.JSON(fiber.Map{
		"success": true,
		"message": "Logout berhasil.",
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

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Profil dan kata sandi berhasil diperbarui.",
		"user": fiber.Map{
			"id":                  user.ID,
			"name":                user.Name,
			"email":               user.Email,
			"is_password_changed": user.IsPasswordChanged,
		},
	})
}

func cleanSlug(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	reg := regexp.MustCompile("[^a-z0-9-]+")
	s = reg.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	return s
}
