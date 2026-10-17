package handlers

import (
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

// SECURITY (M1): menaruh JWT di cookie HttpOnly, bukan hanya di localStorage.
//
// Kenapa: token di localStorage bisa dibaca JavaScript mana pun yang berjalan di
// origin ini — satu XSS (atau dependency yang disusupi) cukup untuk mencurinya.
// Cookie HttpOnly tidak terlihat oleh JS, sehingga pencurian lewat XSS tidak
// mungkin. SameSite=Strict menutup CSRF untuk permintaan lintas-situs.
//
// Header Authorization tetap diterima (middleware.AuthRequired) agar klien lama
// dan EventSource yang belum pindah tetap jalan — migrasi bisa bertahap.

// sessionCookieMaxAge mengikuti masa hidup token yang diterbitkan.
func sessionCookieMaxAge(cfg *config.Config) time.Duration {
	hours := cfg.JWTExpirationHours
	if hours <= 0 || hours > 24 {
		hours = 12
	}
	return time.Duration(hours) * time.Hour
}

// setSessionCookie menulis JWT ke cookie HttpOnly.
func setSessionCookie(c *fiber.Ctx, cfg *config.Config, token string) {
	if token == "" {
		return
	}
	c.Cookie(&fiber.Cookie{
		Name:     middleware.SessionCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int(sessionCookieMaxAge(cfg).Seconds()),
		Expires:  time.Now().Add(sessionCookieMaxAge(cfg)),
		HTTPOnly: true,
		Secure:   isSecureEnv(cfg),
		SameSite: fiber.CookieSameSiteStrictMode,
	})
}

// clearSessionCookie menghapus cookie saat logout / sesi dicabut.
func clearSessionCookie(c *fiber.Ctx, cfg *config.Config) {
	c.Cookie(&fiber.Cookie{
		Name:     middleware.SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Expires:  time.Now().Add(-time.Hour),
		HTTPOnly: true,
		Secure:   isSecureEnv(cfg),
		SameSite: fiber.CookieSameSiteStrictMode,
	})
}

// isSecureEnv: cookie Secure hanya saat HTTPS, supaya dev di http://localhost
// tetap bisa login (browser menolak cookie Secure pada http).
func isSecureEnv(cfg *config.Config) bool {
	switch cfg.AppEnv {
	case "production", "prod", "staging":
		return true
	default:
		return false
	}
}
