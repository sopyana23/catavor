package middleware

import (
	"net/url"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

// SECURITY (M1/CSRF): lapisan kedua pertahanan CSRF.
//
// Sejak JWT disimpan di cookie (HttpOnly), browser mengirim kredensial secara
// otomatis pada setiap permintaan ke origin ini. Pertahanan utama adalah
// SameSite=Strict, tetapi itu bergantung pada:
//   - dukungan browser (browser sangat lama mengabaikannya)
//   - batas situs: subdomain yang disusupi tetap "same-site"
//   - proteksi terhadap metode "simple request" yang tak memicu preflight
//
// Karena itu ditambahkan pemeriksaan Origin/Referer untuk semua permintaan
// yang mengubah data (POST/PUT/PATCH/DELETE). Request lintas-situs dari situs
// lain akan membawa Origin yang tidak dikenal -> ditolak 403.
//
// Permintaan tanpa Origin DAN tanpa Referer tetap diizinkan: itu terjadi pada
// klien non-browser (curl, health probe, integrasi server-ke-server, sebagian
// aplikasi mobile) yang tidak bisa dipaksa oleh penyerang karena tidak membawa
// cookie korban. Browser modern SELALU mengirim Origin pada permintaan mutasi
// lintas-origin maupun same-origin (POST), sehingga jalur serangan tetap tertutup.

// CSRFProtection memvalidasi Origin/Referer pada metode yang mengubah state.
func CSRFProtection(allowedOrigins []string) fiber.Handler {
	// Normalisasi daftar origin yang diizinkan (tanpa trailing slash, lowercase).
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		o = strings.ToLower(strings.TrimSpace(o))
		o = strings.TrimSuffix(o, "/")
		if o != "" {
			allowed[o] = struct{}{}
		}
	}

	return func(c *fiber.Ctx) error {
		switch c.Method() {
		case fiber.MethodGet, fiber.MethodHead, fiber.MethodOptions:
			return c.Next()
		}

		origin := strings.ToLower(strings.TrimSpace(c.Get("Origin")))

		// Sandboxed iframe / lintas-origin redirect mengirim Origin: "null".
		// Tolak langsung tanpa pernah fallback ke Referer agar tidak bisa di-bypass.
		if origin == "null" {
			return rejectCSRF(c, "origin 'null' tidak diizinkan untuk permintaan yang mengubah data")
		}

		if origin == "" {
			// Fallback ke Referer hanya bila header Origin memang tidak dikirim sama sekali.
			if ref := c.Get("Referer"); ref != "" {
				if u, err := url.Parse(ref); err == nil && u.Scheme != "" && u.Host != "" {
					origin = strings.ToLower(u.Scheme + "://" + u.Host)
				}
			}
		}

		// Tidak ada Origin/Referer sama sekali: klien non-browser. Bila request
		// membawa cookie sesi, kita tetap tolak karena browser yang sah akan
		// mengirim Origin pada permintaan mutasi.
		if origin == "" {
			if c.Cookies(SessionCookieName) != "" {
				return rejectCSRF(c, "permintaan bermutasi dengan cookie sesi wajib menyertakan Origin/Referer")
			}
			return c.Next()
		}

		if _, ok := allowed[origin]; ok {
			return c.Next()
		}

		// Same-origin check: Origin wajib memiliki host[:port] yang persis sama dengan
		// Host permintaan, serta wajib ber-skema https bila permintaan tiba lewat TLS/HTTPS.
		host := strings.ToLower(strings.TrimSpace(string(c.Request().Host())))
		if host == "" {
			host = strings.ToLower(c.Hostname())
		}
		if u, err := url.Parse(origin); err == nil && strings.EqualFold(u.Host, host) {
			if !c.Secure() || strings.EqualFold(u.Scheme, "https") {
				return c.Next()
			}
		}

		log.Warn().
			Str("origin", origin).
			Str("host", host).
			Str("method", c.Method()).
			Str("path", c.Path()).
			Str("ip", c.IP()).
			Msg("CSRF DITOLAK: Origin tidak dikenal pada permintaan yang mengubah data")

		return rejectCSRF(c, "asal permintaan tidak diizinkan")
	}
}

func rejectCSRF(c *fiber.Ctx, reason string) error {
	return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
		"success": false,
		"code":    "CSRF_REJECTED",
		"message": "Permintaan ditolak karena asal tidak valid. Muat ulang halaman lalu coba lagi.",
		"detail":  reason,
	})
}
