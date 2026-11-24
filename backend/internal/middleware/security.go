package middleware

import (
	"fmt"
	"net/netip"
	"net/url"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/rs/zerolog/log"
)

// extractCSPOrigin membersihkan dan mengekstrak origin (scheme + host[:port]) yang valid untuk direktif CSP.
func extractCSPOrigin(raw string, allowHTTP bool) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || strings.ContainsAny(trimmed, "; \t\r\n") || strings.Contains(trimmed, "*") {
		return ""
	}
	u, err := url.Parse(trimmed)
	if err != nil || u.Host == "" {
		return ""
	}
	if u.Scheme == "https" || (allowHTTP && u.Scheme == "http") {
		return u.Scheme + "://" + u.Host
	}
	return ""
}

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
		c.Set("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
		c.Set("Permissions-Policy", "geolocation=(), camera=(), microphone=()")

		isLocal := cfg.AppEnv == "local" || cfg.AppEnv == "development" || cfg.AppEnv == ""

		imgSrc := "'self' data: blob: https:"
		connectSources := []string{
			"'self'",
			"https://api.qrserver.com",
			"https://www.googleapis.com",
			"https://accounts.google.com",
			"https://*.tiktok.com",
			"https://*.instagram.com",
			"https://*.google.com",
			"https://*.adtrafficquality.google",
			"https://*.googletrafficquality.google",
			"https://*.google-analytics.com",
			"https://*.analytics.google.com",
			"https://*.googletagmanager.com",
			"https://*.googlesyndication.com",
			"https://*.doubleclick.net",
		}

		seenOrigin := map[string]bool{}
		for _, s := range connectSources {
			seenOrigin[s] = true
		}
		addOrigin := func(raw string) {
			if orig := extractCSPOrigin(raw, isLocal); orig != "" && !seenOrigin[orig] {
				seenOrigin[orig] = true
				connectSources = append(connectSources, orig)
			}
		}

		addOrigin(cfg.AppURL)
		addOrigin(cfg.StoragePublicURL)
		for _, origin := range cfg.AllowedOrigins {
			addOrigin(origin)
		}

		if isLocal {
			imgSrc += " http:"
			for _, devSrc := range []string{
				"http://localhost:*",
				"http://127.0.0.1:*",
				"ws://localhost:*",
				"ws://127.0.0.1:*",
			} {
				if !seenOrigin[devSrc] {
					seenOrigin[devSrc] = true
					connectSources = append(connectSources, devSrc)
				}
			}
		}
		connectSrc := strings.Join(connectSources, " ")

		// SECURITY (M2, N-50): script-src TANPA 'unsafe-inline' dan 'unsafe-eval'.
		// - 'unsafe-eval' dibuang total: source tidak memakai eval()/new Function().
		// - 'unsafe-inline' diganti hash SHA-256 script inline (dihitung dari
		//   index.html saat runtime) sehingga hanya script yang kita tulis sendiri
		//   yang boleh jalan. Ini memutus eksekusi script yang disuntikkan penyerang.
		//
		// Catatan: style-src tetap 'unsafe-inline' karena React memakai style
		// inline (ribuan atribut style) yang tidak bisa di-hash. Risiko jauh lebih
		// rendah daripada script inline, dan bukan jalur eksekusi kode.
		scriptHashes := scriptSrcHashes()
		csp := "default-src 'self'; " +
			"script-src 'self' " + scriptHashes +
			"https://www.tiktok.com https://*.tiktok.com https://www.instagram.com https://*.instagram.com https://accounts.google.com https://*.google.com https://*.adtrafficquality.google https://*.googletagmanager.com https://*.googlesyndication.com https://*.googleadservices.com https://*.doubleclick.net https://*.google-analytics.com; " +
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
			"font-src 'self' https://fonts.gstatic.com data:; " +
			"img-src " + imgSrc + "; " +
			"frame-src 'self' https://www.youtube.com https://*.youtube.com https://www.youtube-nocookie.com https://*.youtube-nocookie.com https://www.tiktok.com https://*.tiktok.com https://www.instagram.com https://*.instagram.com https://accounts.google.com https://*.google.com https://*.doubleclick.net https://*.googlesyndication.com https://*.adtrafficquality.google https://*.googleadservices.com; " +
			"connect-src " + connectSrc + "; " +
			"frame-ancestors 'self'; form-action 'self'; object-src 'none'; base-uri 'self';"
		c.Set("Content-Security-Policy", csp)

		// Set HSTS only if in production/secure
		if c.Secure() {
			hstsVal := "max-age=31536000"
			if cfg.HSTSIncludeSubDomains {
				hstsVal += "; includeSubDomains"
				if cfg.HSTSPreload {
					hstsVal += "; preload"
				}
			}
			c.Set("Strict-Transport-Security", hstsVal)
		}

		return c.Next()
	})

	// 4. Strict CORS Middleware
	// configuredOrigins = yang benar-benar diisi operator (sebelum fallback),
	// supaya keputusan AllowCredentials di bawah menilai konfigurasi asli.
	// Versi sebelumnya membandingkan allowedOrigins setelah fallback, sehingga
	// cabang "kosong di non-local" tidak pernah tercapai (dead code).
	configuredOrigins := strings.Join(cfg.AllowedOrigins, ", ")
	allowedOrigins := configuredOrigins
	if allowedOrigins == "" {
		allowedOrigins = fmt.Sprintf("http://localhost:%s, http://127.0.0.1:%s, http://localhost:8000, http://127.0.0.1:8000, http://localhost:5173, http://localhost:3000, http://127.0.0.1:5173", cfg.Port, cfg.Port)
	} else if cfg.AppEnv == "local" {
		currentOrigin := fmt.Sprintf("http://localhost:%s, http://127.0.0.1:%s", cfg.Port, cfg.Port)
		if !strings.Contains(allowedOrigins, fmt.Sprintf(":%s", cfg.Port)) {
			allowedOrigins = currentOrigin + ", " + allowedOrigins
		}
	}

	// Daftar origin untuk pemeriksaan CSRF: hanya masukkan origin terkonfigurasi
	// di non-local agar localhost tidak ikut masuk daftar izin CSRF di produksi.
	csrfSource := allowedOrigins
	if cfg.AppEnv != "local" && cfg.AppEnv != "development" && cfg.AppEnv != "" {
		csrfSource = configuredOrigins
	}
	csrfOrigins := make([]string, 0, 8)
	for _, o := range strings.Split(csrfSource, ",") {
		if t := strings.TrimSpace(o); t != "" {
			csrfOrigins = append(csrfOrigins, t)
		}
	}

	// SECURITY (L3): AllowCredentials=true + origin wildcard = browser menolak,
	// tapi kalau lolos ke proxy bisa jadi celah. Di non-local, wildcard dilarang
	// keras dan AllowCredentials hanya aktif bila origin eksplisit (bukan "*").
	allowCredentials := true
	if cfg.AppEnv != "local" && strings.Contains(configuredOrigins, "*") {
		log.Fatal().
			Str("allowed_origins", configuredOrigins).
			Msg("ALLOWED_ORIGINS tidak boleh memakai wildcard ('*') di non-local saat AllowCredentials aktif. " +
				"Sebutkan origin secara eksplisit (mis. https://app.example.com).")
	}
	if cfg.AppEnv != "local" && configuredOrigins == "" {
		// Tidak ada origin eksplisit -> matikan credentials agar tidak ada
		// kombinasi berbahaya (cookie/Authorization lintas origin).
		allowCredentials = false
		log.Warn().Msg("ALLOWED_ORIGINS kosong di non-local: AllowCredentials dinonaktifkan.")
	}

	app.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-Store-Slug, X-Request-ID, Idempotency-Key",
		AllowMethods:     "GET, POST, HEAD, PUT, DELETE, PATCH, OPTIONS",
		AllowCredentials: allowCredentials,
		ExposeHeaders:    "X-Refreshed-Token",
		MaxAge:           86400,
	}))

	// SECURITY (M1/CSRF): lapisan kedua setelah SameSite=Strict — tolak
	// permintaan yang mengubah data bila Origin/Referer bukan origin kita.
	app.Use(CSRFProtection(csrfOrigins))

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

func isProductionRateLimitEnv() bool {
	if config.AppConfig == nil {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(config.AppConfig.AppEnv)) {
	case "production", "prod", "staging":
		return true
	default:
		return false
	}
}

func canonicalAuthLimitBucket(rawPath string) string {
	norm := strings.ToLower(strings.TrimRight(rawPath, "/"))
	switch norm {
	case "/api/login", "/api/auth/login":
		return "/api/auth/login"
	case "/api/register", "/api/auth/register":
		return "/api/auth/register"
	case "/api/send-register-otp", "/api/auth/send-registration-otp":
		return "/api/auth/send-registration-otp"
	case "/api/verify-register-otp", "/api/auth/verify-registration-otp":
		return "/api/auth/verify-registration-otp"
	case "/api/forgot-password", "/api/auth/forgot-password-request":
		return "/api/auth/forgot-password-request"
	case "/api/reset-password", "/api/auth/forgot-password-reset":
		return "/api/auth/forgot-password-reset"
	case "/api/check-email", "/api/auth/check-email":
		return "/api/auth/check-email"
	default:
		return norm
	}
}

func canonicalRateLimitIP(rawIP string) string {
	ip := strings.TrimSpace(rawIP)
	if idx := strings.Index(ip, ","); idx != -1 {
		ip = strings.TrimSpace(ip[:idx])
	}
	if addr, err := netip.ParseAddr(ip); err == nil {
		addr = addr.Unmap()
		if addr.Is6() {
			if pfx, pErr := addr.Prefix(64); pErr == nil {
				return pfx.Masked().Addr().String() + "/64"
			}
		}
		return addr.String()
	}
	return ip
}

// GlobalAPIRateLimiter provides Layer-7 DoS protection across public API routes
func GlobalAPIRateLimiter() fiber.Handler {
	return limiter.New(limiter.Config{
		Storage:    database.GetRateLimiterStorage(),
		Max:        300, // 300 requests per minute per IP for normal SPA usage
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return canonicalRateLimitIP(c.IP()) + "_global_api"
		},
		Next: func(c *fiber.Ctx) bool {
			ip := c.IP()
			// Exclude localhost / loopback ONLY outside production/staging
			if !isProductionRateLimitEnv() && (ip == "127.0.0.1" || ip == "::1" || ip == "" || ip == "localhost") {
				return true
			}
			path := c.Path()
			// Exclude real-time SSE stream & lightweight background ping from rate limiting
			if strings.Contains(path, "/notifications/stream") || strings.Contains(path, "/support/tickets-ping") {
				return true
			}
			return false
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"message": "Terlalu banyak permintaan ke server. Harap tunggu sebentar sebelum mencoba kembali.",
			})
		},
	})
}

// AuthRateLimiter limits brute force attempts on login/register endpoints
func AuthRateLimiter() fiber.Handler {
	return limiter.New(limiter.Config{
		Storage:    database.GetRateLimiterStorage(),
		Max:        20,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return canonicalRateLimitIP(c.IP()) + "_" + canonicalAuthLimitBucket(c.Path())
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
		Storage:    database.GetRateLimiterStorage(),
		Max:        15,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return canonicalRateLimitIP(c.IP()) + "_pub_submit"
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"message": "Terlalu banyak pengiriman dalam waktu singkat. Harap tunggu sebentar.",
			})
		},
	})
}

// TelemetryRateLimiter provides Layer-7 protection for high-frequency telemetry events
// (search telemetry & storefront action analytics) without interfering with transactional forms.
// Returns HTTP 202 Accepted on limit breach (silent drop) so client UX is never interrupted.
func TelemetryRateLimiter() fiber.Handler {
	return limiter.New(limiter.Config{
		Storage:    database.GetRateLimiterStorage(),
		Max:        180, // 180 requests per minute per IP for dynamic user browsing
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return canonicalRateLimitIP(c.IP()) + "_telemetry"
		},
		Next: func(c *fiber.Ctx) bool {
			ip := c.IP()
			// Exclude localhost / loopback ONLY outside production/staging
			return !isProductionRateLimitEnv() && (ip == "127.0.0.1" || ip == "::1" || ip == "" || ip == "localhost")
		},
		LimitReached: func(c *fiber.Ctx) error {
			// Graceful degradation: return 202 Accepted (silent drop) rather than 429 error
			return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
				"success": true,
				"message": "Telemetry accepted.",
			})
		},
	})
}

// ExportRateLimiter limits heavy data export operations (CSV/JSON/ZIP).
// SECURITY (SEC-06): Uses persistent Redis storage, IPv6 /64 canonicalization,
// composite user+IP keying, and enforces limits strictly in production/staging.
func ExportRateLimiter() fiber.Handler {
	return limiter.New(limiter.Config{
		Storage:    database.GetRateLimiterStorage(),
		Max:        10,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			ipKey := canonicalRateLimitIP(c.IP())
			if u, ok := c.Locals("user").(*models.User); ok && u != nil && u.ID > 0 {
				return fmt.Sprintf("export:u:%d:%s", u.ID, ipKey)
			}
			if uid, ok := c.Locals("user_id").(uint); ok && uid > 0 {
				return fmt.Sprintf("export:u:%d:%s", uid, ipKey)
			}
			return "export:ip:" + ipKey
		},
		Next: func(c *fiber.Ctx) bool {
			ip := c.IP()
			return !isProductionRateLimitEnv() && (ip == "127.0.0.1" || ip == "::1" || ip == "" || ip == "localhost")
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"code":    "RATE_LIMIT_EXCEEDED",
				"message": "Terlalu banyak permintaan unduhan ekspor data. Silakan tunggu 1 menit sebelum mencoba kembali.",
			})
		},
	})
}

// BroadcastRateLimiter membatasi pengiriman/penerbitan siaran broadcast admin agar terhindar dari spam & double-blast.
func BroadcastRateLimiter() fiber.Handler {
	return limiter.New(limiter.Config{
		Storage:    database.GetRateLimiterStorage(),
		Max:        20,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			ipKey := canonicalRateLimitIP(c.IP())
			if u, ok := c.Locals("user").(*models.User); ok && u != nil && u.ID > 0 {
				return fmt.Sprintf("broadcast:u:%d:%s", u.ID, ipKey)
			}
			if uid, ok := c.Locals("user_id").(uint); ok && uid > 0 {
				return fmt.Sprintf("broadcast:u:%d:%s", uid, ipKey)
			}
			return "broadcast:ip:" + ipKey
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"code":    "RATE_LIMIT_EXCEEDED",
				"error":   "Terlalu banyak pengiriman siaran dalam 1 menit. Harap tunggu sebentar sebelum mengirim ulang.",
			})
		},
	})
}

// IsOriginAllowed memeriksa apakah header Origin termasuk dalam daftar origin yang diizinkan aplikasi.
func IsOriginAllowed(origin string, cfg *config.Config) bool {
	trimmed := strings.TrimRight(strings.TrimSpace(origin), "/")
	if trimmed == "" {
		return false
	}

	candidates := make([]string, 0, 12)
	if cfg != nil {
		if orig := strings.TrimRight(strings.TrimSpace(cfg.AppURL), "/"); orig != "" {
			candidates = append(candidates, orig)
		}
		for _, raw := range cfg.AllowedOrigins {
			if o := strings.TrimRight(strings.TrimSpace(raw), "/"); o != "" {
				candidates = append(candidates, o)
			}
		}
		if cfg.AppEnv == "" || cfg.AppEnv == "local" || cfg.AppEnv == "development" {
			port := strings.TrimSpace(cfg.Port)
			if port == "" {
				port = "8000"
			}
			candidates = append(candidates,
				"http://localhost:"+port,
				"http://127.0.0.1:"+port,
				"http://localhost:8000",
				"http://127.0.0.1:8000",
				"http://localhost:8001",
				"http://127.0.0.1:8001",
				"http://localhost:5173",
				"http://localhost:3000",
				"http://127.0.0.1:5173",
			)
		}
	}

	for _, c := range candidates {
		if strings.EqualFold(trimmed, c) {
			return true
		}
	}
	return false
}


