package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

// ClientLogRequest — payload telemetri crash dari frontend.
// Field dibatasi keras: stack trace & pesan dipotong agar tidak bisa dipakai
// sebagai vektor log-flooding / penyimpanan liar.
type ClientLogRequest struct {
	Message   string   `json:"message"`
	Stack     string   `json:"stack"`
	Section   string   `json:"section"`
	Component string   `json:"component"`
	URL       string   `json:"url"`
	UserAgent string   `json:"user_agent"`
	Platform  string   `json:"platform"`
	Build     string   `json:"build"`
	Timestamp string   `json:"timestamp"`
	Tags      []string `json:"tags"`
}

const (
	maxClientLogMessage = 2000
	maxClientLogStack   = 8000
	maxClientLogField   = 300
)

func clipClientLog(s string, max int) string {
	s = strings.TrimSpace(s)
	if len(s) <= max {
		return s
	}
	return s[:max] + "…[dipotong]"
}

// LogClientError menerima crash report dari ErrorBoundary frontend.
// Sengaja TANPA auth: error bisa terjadi sebelum sesi terbentuk (login, landing).
// Perlindungan: PublicSubmissionRateLimiter di level route + ikut
// GlobalAPIRateLimiter milik grup /api + honeypot + clip panjang field.
func LogClientError(c *fiber.Ctx) error {
	var req ClientLogRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Payload telemetri tidak valid.",
		})
	}

	msg := clipClientLog(req.Message, maxClientLogMessage)
	if msg == "" && clipClientLog(req.Stack, maxClientLogStack) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Telemetri kosong.",
		})
	}

	// Honeypot: bot yang mengisi field tersembunyi dibalas OK tanpa dicatat.
	if strings.TrimSpace(c.Get("X-Hp-Check")) != "" {
		return c.JSON(fiber.Map{"success": true})
	}

	ev := log.Warn().
		Str("source", "client-crash").
		Str("section", clipClientLog(req.Section, maxClientLogField)).
		Str("platform", clipClientLog(req.Platform, 40)).
		Str("build", clipClientLog(req.Build, 80)).
		Str("page_url", clipClientLog(req.URL, maxClientLogField)).
		Str("client_ts", clipClientLog(req.Timestamp, 40)).
		Str("ip", c.IP()).
		Str("ua", clipClientLog(c.Get("User-Agent"), maxClientLogField)).
		// JANGAN pakai key "message": zerolog sudah memakainya untuk Msg()
		// sehingga JSON jadi duplikat key dan pesan crash hilang saat di-parse.
		Str("err_message", msg)

	if comp := clipClientLog(req.Component, maxClientLogField); comp != "" {
		ev = ev.Str("component", comp)
	}
	if tags := req.Tags; len(tags) > 0 {
		if len(tags) > 5 {
			tags = tags[:5]
		}
		ev = ev.Strs("tags", tags)
	}
	if stack := clipClientLog(req.Stack, maxClientLogStack); stack != "" {
		ev = ev.Str("stack", stack)
	}
	ev.Msg("Client runtime error")
	return c.JSON(fiber.Map{"success": true})
}
