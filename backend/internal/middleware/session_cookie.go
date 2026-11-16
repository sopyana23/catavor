package middleware

import (
	"time"

	"catavor-backend/internal/config"

	"github.com/gofiber/fiber/v2"
)

// SessionCookieMaxAge mengikuti masa hidup token yang diterbitkan.
func SessionCookieMaxAge(cfg *config.Config) time.Duration {
	hours := cfg.JWTExpirationHours
	if hours <= 0 || hours > 24 {
		hours = 12
	}
	return time.Duration(hours) * time.Hour
}

// IsSecureEnv: cookie Secure hanya saat HTTPS, supaya dev di http://localhost
// tetap bisa login (browser menolak cookie Secure pada http).
func IsSecureEnv(cfg *config.Config) bool {
	switch cfg.AppEnv {
	case "production", "prod", "staging":
		return true
	default:
		return false
	}
}

// SetSessionCookie menulis JWT ke cookie HttpOnly dengan SameSite=Strict (M1 / POLISH-R3-05).
func SetSessionCookie(c *fiber.Ctx, cfg *config.Config, token string) {
	if token == "" {
		return
	}
	c.Cookie(&fiber.Cookie{
		Name:     SessionCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int(SessionCookieMaxAge(cfg).Seconds()),
		Expires:  time.Now().Add(SessionCookieMaxAge(cfg)),
		HTTPOnly: true,
		Secure:   IsSecureEnv(cfg),
		SameSite: fiber.CookieSameSiteStrictMode,
	})
}

// ClearSessionCookie menghapus cookie saat logout / sesi dicabut.
func ClearSessionCookie(c *fiber.Ctx, cfg *config.Config) {
	c.Cookie(&fiber.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Expires:  time.Now().Add(-time.Hour),
		HTTPOnly: true,
		Secure:   IsSecureEnv(cfg),
		SameSite: fiber.CookieSameSiteStrictMode,
	})
}
