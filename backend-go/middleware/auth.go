package middleware

import (
	"errors"
	"strings"
	"time"

	"catavor-backend/config"
	"catavor-backend/database"
	"catavor-backend/models"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
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

// AuthRequired validates the JWT Bearer token
func AuthRequired(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"message": "Unauthenticated.",
			})
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"message": "Invalid authorization token format.",
			})
		}

		tokenString := parts[1]
		claims := &JWTClaims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			// Algorithm Pinning: Enforce HMAC SHA-256 strictly
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing algorithm")
			}
			return []byte(cfg.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"message": "Token tidak valid atau telah kedaluwarsa.",
			})
		}

		// Retrieve user and their store from DB to guarantee freshest state
		var user models.User
		if err := database.DB.Preload("Store").First(&user, claims.UserID).Error; err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"message": "Pengguna tidak ditemukan.",
			})
		}

		c.Locals("user", &user)
		c.Locals("user_id", user.ID)
		if user.Store != nil {
			c.Locals("store", user.Store)
			c.Locals("store_id", user.Store.ID)
			c.Locals("store_slug", user.Store.Slug)
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

		targetSlug := c.Get("X-Store-Slug")
		if targetSlug == "" {
			targetSlug = c.Params("slug")
		}

		if targetSlug != "" {
			if user.Store == nil || !strings.EqualFold(user.Store.Slug, targetSlug) {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"success": false,
					"message": "Akses Ditolak: Anda tidak memiliki otoritas atas toko ini.",
				})
			}
		}

		if user.Store == nil {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"message": "Toko Anda belum terdaftar.",
			})
		}

		return c.Next()
	}
}
