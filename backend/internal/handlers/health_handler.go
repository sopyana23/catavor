package handlers

import (
	"context"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"

	"github.com/gofiber/fiber/v2"
)

// startedAt dipakai untuk melaporkan uptime pada liveness probe.
var startedAt = time.Now()

func timeoutContext(d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), d)
}

// Health probe untuk load balancer / orchestrator.
//
// /healthz = liveness: proses hidup. Sengaja TIDAK menyentuh DB — kalau DB mati
// sesaat, container tidak boleh di-restart (itu hanya memperparah).
// /readyz  = readiness: siap menerima trafik, yaitu DB benar-benar bisa di-query.
// Kalau DB down, LB harus berhenti mengirim trafik ke instance ini.
//
// Sengaja tanpa auth (probe tidak bisa login) dan tanpa detail internal
// (jangan bocorkan versi/DSN ke publik).

// LivenessHandler mengembalikan 200 selama proses berjalan.
func LivenessHandler(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"status": "ok",
		"uptime": time.Since(startedAt).Round(time.Second).String(),
	})
}

// ReadinessHandler memverifikasi dependensi kritis (database).
func ReadinessHandler(c *fiber.Ctx) error {
	ctx, cancel := timeoutContext(2 * time.Second)
	defer cancel()

	db := database.DB
	if db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"status": "not_ready",
			"reason": "database not initialized",
		})
	}

	sqlDB, err := db.DB()
	if err != nil || sqlDB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"status": "not_ready",
			"reason": "database handle unavailable",
		})
	}

	if err := sqlDB.PingContext(ctx); err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"status": "not_ready",
			"reason": "database unreachable",
		})
	}

	return c.JSON(fiber.Map{"status": "ready"})
}

// ConfigHandler mengembalikan info non-sensitif untuk verifikasi deploy.
// Hanya aktif bila diizinkan eksplisit (lihat route), karena menyebut
// environment bisa membantu penyerang memetakan target.
func ConfigHandler(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"environment":  cfg.AppEnv,
			"tls_enabled":  cfg.TLSCertFile != "" && cfg.TLSKeyFile != "",
			"body_limit_mb": 12,
		})
	}
}
