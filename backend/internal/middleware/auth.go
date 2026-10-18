package middleware

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type JWTClaims struct {
	UserID            uint   `json:"user_id"`
	Email             string `json:"email"`
	Name              string `json:"name"`
	StoreSlug         string `json:"store_slug"`
	StoreID           uint   `json:"store_id"`
	IsPasswordChanged bool   `json:"is_password_changed"`
	TokenVersion      int    `json:"token_version"`
	jwt.RegisteredClaims
}

// GenerateTokenWithID creates a cryptographically signed JWT token with algorithm pinning and returns token string, jti UUID, and expiresAt.
func GenerateTokenWithID(user *models.User, store *models.Store, cfg *config.Config) (string, string, time.Time, error) {
	var storeSlug string
	var storeID uint
	if store != nil {
		storeSlug = store.Slug
		storeID = store.ID
	}

	tokenVersion := user.TokenVersion
	if tokenVersion == 0 {
		tokenVersion = 1
	}

	tokenID := uuid.New().String()
	expiresAt := time.Now().Add(time.Duration(cfg.JWTExpirationHours) * time.Hour)

	claims := JWTClaims{
		UserID:            user.ID,
		Email:             user.Email,
		Name:              user.Name,
		StoreSlug:         storeSlug,
		StoreID:           storeID,
		IsPasswordChanged: user.IsPasswordChanged,
		TokenVersion:      tokenVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        tokenID,
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "catavor-saas",
			Audience:  jwt.ClaimStrings{"catavor-web"},
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		return "", "", time.Time{}, err
	}
	return signedToken, tokenID, expiresAt, nil
}

// GenerateToken creates a cryptographically signed JWT token with algorithm pinning (backwards compatible)
func GenerateToken(user *models.User, store *models.Store, cfg *config.Config) (string, error) {
	token, _, _, err := GenerateTokenWithID(user, store, cfg)
	return token, err
}

// ExtractOptionalClaims safely parses a Bearer token or token query without throwing HTTP 401.
// Returns nil if token is missing or invalid.
func ExtractOptionalClaims(c *fiber.Ctx, cfg *config.Config) *JWTClaims {
	if cfg == nil || cfg.JWTSecret == "" {
		return nil
	}
	var tokenString string
	authHeader := c.Get("Authorization")
	if authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
			tokenString = strings.TrimSpace(parts[1])
		}
	}
	if tokenString == "" {
		// SECURITY (N-02): ?token= TIDAK lagi diterima sebagai sumber auth.
		return nil
	}

	claims := &JWTClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing algorithm")
		}
		return []byte(cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return nil
	}
	return claims
}

// SECURITY (M1): nama cookie sesi. HttpOnly + Secure + SameSite=Strict,
// sehingga JavaScript tidak bisa membacanya — token tidak lagi rentan dicuri XSS.
const SessionCookieName = "catavor_session"

// AuthRequired validates the JWT Bearer token.
// Urutan sumber kredensial:
//  1. HttpOnly cookie (cara yang benar, kebal XSS)
//  2. Authorization: Bearer header (fallback kompatibilitas klien lama)
//  3. ?token= query param (hanya untuk EventSource/SSE yang tak bisa kirim header)
func AuthRequired(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var tokenString string

		// 1. Cookie HttpOnly — sumber utama.
		if cookieToken := strings.TrimSpace(c.Cookies(SessionCookieName)); cookieToken != "" {
			tokenString = cookieToken
		}

		authHeader := c.Get("Authorization")
		if tokenString == "" && authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
				tokenString = strings.TrimSpace(parts[1])
			} else {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"success": false,
					"code":    "INVALID_TOKEN_FORMAT",
					"message": "Invalid authorization token format.",
				})
			}
		}

		// SECURITY (M1/SSE): tiket sekali pakai untuk EventSource.
		// EventSource tak bisa mengirim header, jadi JWT dulu ditaruh di
		// ?token= — URL mudah bocor ke access log/Referer. Sekarang klien
		// menukar sesi dengan tiket berumur 30 detik lewat
		// POST /api/notifications/ticket, lalu memakai ?ticket=.
		//
		// PENTING: bila ada ?ticket=, tiket adalah SATU-SATUNYA kredensial yang
		// dihormati. Cookie sengaja tidak dipakai sebagai cadangan — kalau
		// dipakai, tiket yang sudah kedaluwarsa/di-replay tetap lolos karena
		// cookie sesi masih sah, sehingga jaminan "sekali pakai" jadi palsu.
		if ticket := strings.TrimSpace(c.Query("ticket")); ticket != "" {
			uid, ok := security.ConsumeSSETicket(ticket)
			if !ok {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"success": false,
					"code":    "INVALID_TICKET",
					"message": "Tiket stream tidak valid atau sudah kedaluwarsa.",
				})
			}

			// Tahap 2: bangun konteks user dari DB dengan aturan yang sama
			// seperti jalur JWT (akun bisa saja diblokir setelah tiket terbit).
			var user models.User
			if err := database.DB.Preload("Stores", func(db *gorm.DB) *gorm.DB {
				return db.Where("dormancy_status != 'banned' AND is_blacklisted = false")
			}).Preload("Store", func(db *gorm.DB) *gorm.DB {
				return db.Where("dormancy_status != 'banned' AND is_blacklisted = false")
			}).First(&user, uid).Error; err != nil {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"success": false,
					"code":    "USER_NOT_FOUND",
					"message": "Pengguna tidak ditemukan atau telah dinonaktifkan.",
				})
			}

			// SECURITY (N-05): whitelist terpusat, konsisten dengan RequireAdmin.
			// ARSITEKTUR: staf platform ditentukan oleh platform_role yang
			// ditetapkan dinamis (dapat dicabut & diaudit), bukan alamat email.
			isTicketAdmin := user.IsPlatformStaff()

			if !isTicketAdmin && user.IsBlacklisted {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"success": false,
					"code":    "ACCOUNT_BANNED",
					"message": "Akun Anda telah dinonaktifkan.",
				})
			}

			c.Locals("user", &user)
			c.Locals("user_id", user.ID)
			c.Locals("claims", &JWTClaims{UserID: user.ID})
			c.Locals("sse_ticket_auth", true)

			var activeStore *models.Store
			if requestedSlug := strings.TrimSpace(c.Query("slug")); requestedSlug != "" {
				for i := range user.Stores {
					if strings.EqualFold(user.Stores[i].Slug, requestedSlug) {
						activeStore = &user.Stores[i]
						break
					}
				}
			}
			if activeStore == nil && len(user.Stores) > 0 {
				activeStore = &user.Stores[0]
			}
			if activeStore == nil {
				activeStore = user.Store
			}
			if activeStore != nil {
				c.Locals("store", activeStore)
				c.Locals("store_id", activeStore.ID)
				c.Locals("store_slug", activeStore.Slug)
			}

			return c.Next()
		}

		// SECURITY (N-02): fallback ?token= DIHAPUS.
		// Token di URL bocor ke log reverse-proxy/CDN, header Referer, riwayat
		// browser, dan berbagi tautan. Auth hanya lewat cookie httpOnly,
		// header Authorization, atau tiket SSE sekali-pakai (?ticket= di atas).
		// Klien lama yang masih mengirim ?token= akan menerima 401 — disengaja.

		if tokenString == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "UNAUTHENTICATED",
				"message": "Unauthenticated.",
			})
		}

		claims := &JWTClaims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			// Algorithm Pinning: Enforce HMAC SHA-256 strictly
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing algorithm")
			}
			return []byte(cfg.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			errCode := "TOKEN_EXPIRED"
			errMsg := "Sesi login Anda telah berakhir. Silakan masuk kembali."
			if err != nil && strings.Contains(strings.ToLower(err.Error()), "malformed") {
				errCode = "INVALID_TOKEN"
				errMsg = "Token otentikasi tidak valid."
			}
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    errCode,
				"message": errMsg,
			})
		}

		// Security Check: Verify if token has been revoked via Logout or Blacklist
		if claims.ID != "" && database.IsTokenBlacklisted(claims.ID) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "SESSION_REVOKED",
				"message": "Sesi login telah dicabut atau Anda telah logout. Silakan masuk kembali.",
			})
		}

		// Retrieve user and their stores from DB to guarantee freshest state
		var user models.User
		if err := database.DB.Preload("Stores", func(db *gorm.DB) *gorm.DB {
			return db.Where("dormancy_status != 'banned' AND is_blacklisted = false")
		}).Preload("Store", func(db *gorm.DB) *gorm.DB {
			return db.Where("dormancy_status != 'banned' AND is_blacklisted = false")
		}).First(&user, claims.UserID).Error; err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "USER_NOT_FOUND",
				"message": "Pengguna tidak ditemukan atau telah dinonaktifkan.",
			})
		}

		// Security Check: Verify global token version (e.g. password reset or credential invalidation)
		// SECURITY (N-04): token yang diterbitkan server SELALU punya token_version >= 1
		// (lihat GenerateTokenWithID). Klaim yang hilang / 0 hanya mungkin berasal dari
		// token yang dipalsukan, jadi perlakukan sebagai tidak valid — jangan fail-open.
		if claims.TokenVersion <= 0 || claims.TokenVersion < user.TokenVersion {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "PASSWORD_CHANGED",
				"message": "Kata sandi atau hak akses akun Anda telah diperbarui. Silakan login kembali dengan kredensial terbaru.",
			})
		}

		// SECURITY (M1-mitigasi): deteksi token yang dipakai dari IP/UA berbeda
		// dari saat login. Tidak memblokir (mobile sering ganti jaringan), tetapi
		// dicatat sebagai WARN agar bisa ditindaklanjuti lewat monitoring.
		CheckSessionFingerprint(c, claims.ID, user.ID)

		// SECURITY (N-05): gunakan whitelist terpusat (satu sumber kebenaran).
		// Sebelumnya daftar ini hardcoded dan tidak konsisten dengan DB: memuat
		// "admin" (tidak pernah ada di platform_role) dan melewatkan finance/content.
		isPlatformAdmin := user.IsPlatformStaff()

		if !isPlatformAdmin && user.IsBlacklisted {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "ACCOUNT_BANNED",
				"message": "Akun dan profil katalog Anda telah dinonaktifkan secara permanen karena pelanggaran pedoman platform. Sesi login telah dicabut.",
			})
		}

		if !isPlatformAdmin && len(user.Stores) == 0 && user.Store == nil {
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

		c.Locals("user", &user)
		c.Locals("user_id", user.ID)
		c.Locals("claims", claims)

		// Determine initial store context
		var activeStore *models.Store
		if claims.StoreSlug != "" {
			for i := range user.Stores {
				if strings.EqualFold(user.Stores[i].Slug, claims.StoreSlug) {
					activeStore = &user.Stores[i]
					break
				}
			}
		}
		if activeStore == nil && len(user.Stores) > 0 {
			activeStore = &user.Stores[0]
		}
		if activeStore == nil {
			activeStore = user.Store
		}

		if activeStore != nil {
			c.Locals("store", activeStore)
			c.Locals("store_id", activeStore.ID)
			c.Locals("store_slug", activeStore.Slug)
		}

		return c.Next()
	}
}

// StoreOwnerRequired enforces strict multi-tenant boundary checks (Zero-Trust Anti-IDOR)
func StoreOwnerRequired() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user, ok := c.Locals("user").(*models.User)
		if !ok || user == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"message": "Unauthenticated.",
			})
		}

		targetSlug := strings.TrimSpace(c.Get("X-Store-Slug"))
		if targetSlug == "" {
			targetSlug = strings.TrimSpace(c.Params("slug"))
		}
		if targetSlug == "" {
			targetSlug = strings.TrimSpace(c.Query("slug"))
		}

		var matchedStore *models.Store
		isPlatformAdminUser := user.IsPlatformStaff()

		if targetSlug != "" {
			// Check against user's owned stores
			for i := range user.Stores {
				if strings.EqualFold(user.Stores[i].Slug, targetSlug) {
					matchedStore = &user.Stores[i]
					break
				}
			}

			// If not found in preloaded slice, query database directly
			if matchedStore == nil {
				var dbStore models.Store
				if err := database.DB.Where("LOWER(slug) = ? AND user_id = ?", strings.ToLower(targetSlug), user.ID).First(&dbStore).Error; err == nil {
					matchedStore = &dbStore
				}
			}

			// Platform Admins (Superadmin, Support, Staff) have authorized oversight over any store
			if matchedStore == nil && isPlatformAdminUser {
				var dbStore models.Store
				if err := database.DB.Where("LOWER(slug) = ?", strings.ToLower(targetSlug)).First(&dbStore).Error; err == nil {
					matchedStore = &dbStore
				}
			}

			if matchedStore == nil {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"success": false,
					"message": "Akses Ditolak: Anda tidak memiliki otoritas atas profil katalog ini.",
				})
			}

			if !isPlatformAdminUser && (matchedStore.DormancyStatus == "banned" || matchedStore.IsBlacklisted) {
				hasOtherActiveStores := false
				for _, s := range user.Stores {
					if s.ID != matchedStore.ID && s.DormancyStatus != "banned" && !s.IsBlacklisted {
						hasOtherActiveStores = true
						break
					}
				}
				if hasOtherActiveStores {
					return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
						"success":     false,
						"code":        "STORE_BANNED_SWITCH_REQUIRED",
						"message":     fmt.Sprintf("Profil katalog '%s' telah dinonaktifkan secara permanen. Anda dapat beralih ke profil katalog Anda yang lain.", matchedStore.StoreTitle),
						"banned_slug": matchedStore.Slug,
					})
				}
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"success": false,
					"code":    "STORE_BANNED",
					"message": "Profil katalog ini telah dinonaktifkan secara permanen oleh platform.",
				})
			}
		} else {
			// Fallback to active store in context or first store
			if store, ok := c.Locals("store").(*models.Store); ok && store != nil {
				matchedStore = store
			} else if len(user.Stores) > 0 {
				matchedStore = &user.Stores[0]
			} else if user.Store != nil {
				matchedStore = user.Store
			}
		}

		// ARSITEKTUR (pemisahan bidang otorisasi, OWASP Multi-Tenant):
		// Staf platform (superadmin/support/compliance/finance/content) BUKAN
		// anggota tenant. Jalur admin platform punya grup route sendiri
		// (adminApi) yang tidak memuat middleware ini, sehingga staf tidak
		// pernah sampai di sini. Rem di bawah adalah jaring pengaman bila ada
		// rute tenant yang keliru dipanggil staf: jangan mencarikan toko
		// pengganti (dulu: hardcode slug 'catavor' lalu sembarang toko id
		// terkecil — itu menyuntikkan tenant acak ke konteks request).
		// Staf tanpa toko cukup diloloskan tanpa konteks store; handler yang
		// memang butuh store_id tetap akan menolak sendiri.
		if matchedStore == nil {
			if IsPlatformStaffRole(user.PlatformRole) {
				return c.Next()
			}
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "STORE_NOT_REGISTERED",
				"message": "Toko Anda belum terdaftar.",
			})
		}

		// Set the active matched store in request context
		c.Locals("store", matchedStore)
		c.Locals("store_id", matchedStore.ID)
		c.Locals("store_slug", matchedStore.Slug)

		return c.Next()
	}
}

// OperationalStoreRequired blocks mutation actions if store is suspended or banned
func OperationalStoreRequired() fiber.Handler {
	return func(c *fiber.Ctx) error {
		path := strings.ToLower(c.Path())
		category := strings.ToLower(c.Query("category", c.FormValue("category", "")))
		// Always allow support tickets, appeals, support attachments, and notifications even if store is suspended
		if strings.Contains(path, "/support") || strings.Contains(path, "/notifications") ||
			(strings.Contains(path, "/storage/upload") && (category == "support" || category == "billing")) {
			return c.Next()
		}

		user, _ := c.Locals("user").(*models.User)
		isStaff := user.IsPlatformStaff()

		if isStaff {
			return c.Next()
		}

		store, ok := c.Locals("store").(*models.Store)
		if !ok || store == nil {
			return c.Next()
		}

		if store.DormancyStatus == "banned" || store.IsBlacklisted {
			hasOtherActiveStores := false
			if user != nil && len(user.Stores) > 0 {
				for _, s := range user.Stores {
					if s.ID != store.ID && s.DormancyStatus != "banned" && !s.IsBlacklisted {
						hasOtherActiveStores = true
						break
					}
				}
			}

			if hasOtherActiveStores {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"success":     false,
					"code":        "STORE_BANNED_SWITCH_REQUIRED",
					"message":     fmt.Sprintf("Profil katalog '%s' telah dinonaktifkan secara permanen. Anda dapat beralih ke profil katalog Anda yang lain.", store.StoreTitle),
					"banned_slug": store.Slug,
				})
			}

			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "STORE_BANNED",
				"message": "Operasional profil katalog ini telah ditangguhkan secara permanen (Banned) oleh Tim Kepatuhan. Perubahan data tidak diizinkan.",
			})
		}

		if store.DormancyStatus == "suspended" || store.IsSuspended {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "STORE_SUSPENDED",
				"message": "Operasional toko ini sedang dibekukan sementara oleh Tim Kepatuhan. Penambahan atau perubahan data katalog tidak diizinkan selama masa pembekuan. Silakan ajukan banding melalui Pusat Bantuan.",
			})
		}

		return c.Next()
	}
}
