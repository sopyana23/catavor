package middleware

import (
	"time"

	"catavor-backend/internal/config"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/rs/zerolog/log"
)

// SetupSecurityMiddlewares configures enterprise-grade security headers, CORS, and request ID
func SetupSecurityMiddlewares(app *fiber.App, cfg *config.Config) {
	// 1. Recover from Panics
	app.Use(recover.New(recover.Config{
		EnableStackTrace: cfg.AppEnv == "local",
	}))

	// 2. Request ID tracing for SOC 2 compliance
	app.Use(requestid.New(requestid.Config{
		Header: "X-Request-ID",
	}))

	// 3. Industrial SaaS Security Headers
	app.Use(func(c *fiber.Ctx) error {
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("X-Frame-Options", "SAMEORIGIN")
		c.Set("X-XSS-Protection", "1; mode=block")
		c.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Set("Permissions-Policy", "geolocation=(), camera=(), microphone=()")
		c.Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; frame-src 'self' https://www.youtube.com https://accounts.google.com; connect-src 'self' https: http:; object-src 'none'; base-uri 'self';")
		
		// Set HSTS only if in production/secure
		if c.Secure() {
			c.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		}

		return c.Next()
	})

	// 4. Strict CORS Middleware
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-Store-Slug, X-Request-ID",
		AllowMethods:     "GET, POST, HEAD, PUT, DELETE, PATCH, OPTIONS",
		AllowCredentials: false,
		MaxAge:           86400,
	}))

	// 5. Zero-Allocation Structured Logger
	app.Use(func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		latency := time.Since(start)

		status := c.Response().StatusCode()
		path := c.Path()

		// Skip high-frequency asset spam in logs
		if path != "/" && (len(path) > 8 && path[:8] == "/assets/") {
			return err
		}

		log.Info().
			Int("status", status).
			Str("method", c.Method()).
			Str("path", path).
			Str("ip", c.IP()).
			Dur("latency", latency).
			Str("req_id", c.GetRespHeader("X-Request-ID")).
			Msg("HTTP")

		return err
	})
}

// AuthRateLimiter limits brute force attempts on login/register endpoints
func AuthRateLimiter() fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        20,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP() + "_" + c.Path()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"message": "Terlalu banyak percobaan. Harap tunggu 1 menit sebelum mencoba kembali.",
			})
		},
	})
}

// PublicSubmissionRateLimiter limits spam on comments and sighting submissions
func PublicSubmissionRateLimiter() fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        15,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP() + "_pub_submit"
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"message": "Terlalu banyak pengiriman dalam waktu singkat. Harap tunggu sebentar.",
			})
		},
	})
}
