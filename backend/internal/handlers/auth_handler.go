package handlers

import (
	"encoding/base64"
	"encoding/json"
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
	Name                 string `json:"name"`
	Email                string `json:"email"`
	Password             string `json:"password"`
	StoreSlug            string `json:"store_slug"`
	StoreName            string `json:"store_name"`
	StoreTitle           string `json:"store_title"`
	GoogleID             string `json:"google_id"`
	Avatar               string `json:"avatar"`
	Plan                 string `json:"plan"`
	PaymentStatus        string `json:"payment_status"`
	PaymentProofURL      string `json:"payment_proof_url"`
	WhatsappNumber       string `json:"whatsapp_number"`
	RegistrationTimezone string `json:"registration_timezone"`
	Timezone             string `json:"timezone"`
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
	if err := database.DB.Preload("Store").Where("LOWER(email) = ?", strings.ToLower(req.Email)).First(&user).Error; err != nil {
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

	token, err := middleware.GenerateToken(&user, user.Store, h.cfg)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal membuat sesi login.",
		})
	}

	var storeSlug, storeTitle, storePlan, paymentStatus string
	if user.Store != nil {
		storeSlug = user.Store.Slug
		storeTitle = user.Store.StoreTitle
		storePlan = user.Store.Plan
		paymentStatus = user.Store.PaymentStatus
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Login berhasil.",
		"token":   token,
		"user": fiber.Map{
			"id":                  user.ID,
			"name":                user.Name,
			"email":               user.Email,
			"is_password_changed": user.IsPasswordChanged,
			"store_slug":          storeSlug,
			"store_title":         storeTitle,
			"store_plan":          storePlan,
			"payment_status":      paymentStatus,
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
	if req.RegistrationTimezone == "" && req.Timezone != "" {
		req.RegistrationTimezone = req.Timezone
	}

	req.Name = security.SanitizePlainText(req.Name, 100)
	req.StoreTitle = security.SanitizePlainText(req.StoreTitle, 100)
	req.StoreSlug = security.SanitizeSlug(req.StoreSlug)
	req.WhatsappNumber = security.SanitizePhone(req.WhatsappNumber)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

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

	// Check email uniqueness
	var existingUser models.User
	if err := database.DB.Where("LOWER(email) = ?", req.Email).First(&existingUser).Error; err == nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Email sudah terdaftar. Silakan gunakan email lain atau login.",
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

	storeTitle := req.StoreTitle
	if storeTitle == "" {
		storeTitle = req.Name + " Store"
	}

	plan := strings.ToLower(strings.TrimSpace(req.Plan))
	if plan != "pro" {
		plan = "free"
	}

	paymentStatus := "free_active"
	if plan == "pro" {
		if req.PaymentStatus == "approved" || req.PaymentStatus == "paid" {
			paymentStatus = "paid"
		} else {
			paymentStatus = "pending_approval"
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
		UserID:                  newUser.ID,
		Slug:                    slug,
		StoreTitle:              storeTitle,
		StoreSlogan:             "Memudahkan pelanggan menjelajahi produk dan informasi bisnis.",
		WhatsappNumber:          req.WhatsappNumber,
		Plan:                    plan,
		PaymentStatus:           paymentStatus,
		StoreTheme:              "emerald",
		RegistrationTimezone:    tz,
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

	token, _ := middleware.GenerateToken(&newUser, &newStore, h.cfg)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Pendaftaran berhasil.",
		"token":   token,
		"user": fiber.Map{
			"id":                  newUser.ID,
			"name":                newUser.Name,
			"email":               newUser.Email,
			"is_password_changed": true,
			"store_slug":          newStore.Slug,
			"store_title":         newStore.StoreTitle,
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
	query := database.DB.Preload("Store").Where("LOWER(email) = ?", email)
	if googleID != "" {
		query = database.DB.Preload("Store").Where("LOWER(email) = ? OR google_id = ?", email, googleID)
	}

	err := query.First(&user).Error

	// CASE A: USER ALREADY EXISTS (LOGIN FLOW)
	if err == nil {
		if (user.GoogleID == nil || *user.GoogleID == "") && googleID != "" {
			user.GoogleID = &googleID
			database.DB.Save(&user)
		}

		token, err := middleware.GenerateToken(&user, user.Store, h.cfg)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal membuat sesi login.",
			})
		}

		var storeSlug, storeTitle, storePlan, paymentStatus string
		if user.Store != nil {
			storeSlug = user.Store.Slug
			storeTitle = user.Store.StoreTitle
			storePlan = user.Store.Plan
			paymentStatus = user.Store.PaymentStatus
		}

		return c.JSON(fiber.Map{
			"success":             true,
			"is_new_user":         false,
			"message":             "Login Google berhasil!",
			"token":               token,
			"is_password_changed": true,
			"user": fiber.Map{
				"id":                  user.ID,
				"name":                user.Name,
				"email":               user.Email,
				"avatar":              avatar,
				"store_slug":          storeSlug,
				"store_title":         storeTitle,
				"store_plan":          storePlan,
				"payment_status":      paymentStatus,
			},
		})
	}

	// CASE B: NEW USER (REGISTRATION FLOW)
	storeName := strings.TrimSpace(req.StoreName)
	storeSlug := cleanSlug(req.StoreSlug)
	plan := strings.ToLower(strings.TrimSpace(req.Plan))
	if plan != "pro" {
		plan = "free"
	}

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

	paymentStatus := "free_active"
	if plan == "pro" {
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
		PaymentStatus:           paymentStatus,
		StoreTheme:              "emerald",
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
