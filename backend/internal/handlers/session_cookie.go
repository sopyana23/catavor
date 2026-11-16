package handlers

import (
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

// sessionCookieMaxAge didelegasikan ke layer middleware.
func sessionCookieMaxAge(cfg *config.Config) time.Duration {
	return middleware.SessionCookieMaxAge(cfg)
}

// isSecureEnv didelegasikan ke layer middleware.
func isSecureEnv(cfg *config.Config) bool {
	return middleware.IsSecureEnv(cfg)
}

// setSessionCookie menulis JWT ke cookie HttpOnly melalui layer middleware.
func setSessionCookie(c *fiber.Ctx, cfg *config.Config, token string) {
	middleware.SetSessionCookie(c, cfg, token)
}

// clearSessionCookie menghapus cookie sesi melalui layer middleware.
func clearSessionCookie(c *fiber.Ctx, cfg *config.Config) {
	middleware.ClearSessionCookie(c, cfg)
}
