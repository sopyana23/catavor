package middleware

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

type JWTClaims struct {
	UserID            uint   `json:"user_id"`
	Email             string `json:"email"`
	Name              string `json:"name"`
	StoreSlug         string `json:"store_slug"`
	StoreID           uint   `json:"store_id"`
	IsPasswordChanged bool   `json:"is_password_changed"`
	jwt.RegisteredClaims
}

// GenerateToken creates a cryptographically signed JWT token with algorithm pinning
func GenerateToken(user *models.User, store *models.Store, cfg *config.Config) (string, error) {
	var storeSlug string
	var storeID uint
	if store != nil {
		storeSlug = store.Slug
		storeID = store.ID
	}

	claims := JWTClaims{
		UserID:            user.ID,
		Email:             user.Email,
		Name:              user.Name,
		StoreSlug:         storeSlug,
		StoreID:           storeID,
		IsPasswordChanged: user.IsPasswordChanged,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(cfg.JWTExpirationHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "catavor-saas",
			Audience:  jwt.ClaimStrings{"catavor-web"},
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWTSecret))
}

// AuthRequired validates the JWT Bearer token (supports Authorization header and ?token= query param for SSE EventSource)
func AuthRequired(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var tokenString string
		authHeader := c.Get("Authorization")
		if authHeader != "" {
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

		// Fallback to query parameter (required for native browser EventSource / SSE)
		if tokenString == "" {
			tokenString = strings.TrimSpace(c.Query("token"))
		}

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
		isPlatformAdminUser := strings.EqualFold(user.PlatformRole, "superadmin") || 
			strings.EqualFold(user.PlatformRole, "support") || 
			strings.EqualFold(user.PlatformRole, "compliance") || 
			strings.EqualFold(user.PlatformRole, "finance") || 
			strings.EqualFold(user.PlatformRole, "admin") || 
			user.Email == "admin@catavor.com"

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
			} else if isPlatformAdminUser {
				// Fallback to default or first store for platform admins
				var defaultStore models.Store
				if err := database.DB.Where("LOWER(slug) = 'catavor'").First(&defaultStore).Error; err == nil {
					matchedStore = &defaultStore
				} else if err := database.DB.Order("id ASC").First(&defaultStore).Error; err == nil {
					matchedStore = &defaultStore
				}
			}
		}

		if matchedStore == nil {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
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
		isStaff := user != nil && (strings.EqualFold(user.PlatformRole, "superadmin") ||
			strings.EqualFold(user.PlatformRole, "support") ||
			strings.EqualFold(user.PlatformRole, "compliance") ||
			user.Email == "admin@catavor.com")

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
