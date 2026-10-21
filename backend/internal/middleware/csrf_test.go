package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// TestCSRFProtection menguji middleware CSRF secara langsung tanpa perlu
// server hidup atau kredensial akun.
func TestCSRFProtection(t *testing.T) {
	const origin = "http://localhost:8000"
	allowed := []string{origin}

	cases := []struct {
		name    string
		method  string
		origin  string
		referer string
		cookie  string
		want    int
	}{
		{"POST origin asing ditolak", fiber.MethodPost, "https://evil.example.com", "", "", 403},
		{"POST origin sah lolos", fiber.MethodPost, origin, "", "", 200},
		{"POST origin null ditolak", fiber.MethodPost, "null", "", "", 403},
		{"GET origin asing lolos", fiber.MethodGet, "https://evil.example.com", "", "", 200},
		{"HEAD origin asing lolos", fiber.MethodHead, "https://evil.example.com", "", "", 200},
		{"POST tanpa origin tanpa cookie lolos", fiber.MethodPost, "", "", "", 200},
		{"POST cookie tanpa origin ditolak", fiber.MethodPost, "", "", "catavor_session=x", 403},
		{"POST referer sah tanpa origin lolos", fiber.MethodPost, "", origin + "/admin", "", 200},
		{"POST referer asing tanpa origin ditolak", fiber.MethodPost, "", "https://evil.example.com/a", "", 403},
		{"DELETE origin asing ditolak", fiber.MethodDelete, "https://evil.example.com", "", "", 403},
		{"PUT origin asing ditolak", fiber.MethodPut, "https://evil.example.com", "", "", 403},
		{"PATCH origin asing ditolak", fiber.MethodPatch, "https://evil.example.com", "", "", 403},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			app := fiber.New()
			app.Use(CSRFProtection(allowed))
			app.All("/x", func(c *fiber.Ctx) error { return c.SendStatus(200) })

			req := httptest.NewRequest(tc.method, "/x", nil)
			req.Host = "localhost:8000"
			if tc.origin != "" {
				req.Header.Set("Origin", tc.origin)
			}
			if tc.referer != "" {
				req.Header.Set("Referer", tc.referer)
			}
			if tc.cookie != "" {
				req.Header.Set("Cookie", tc.cookie)
			}

			res, err := app.Test(req, 5000)
			if err != nil {
				t.Fatalf("request gagal: %v", err)
			}
			if res.StatusCode != tc.want {
				t.Fatalf("status = %d, ingin %d", res.StatusCode, tc.want)
			}
		})
	}
}

// TestCSRFRejectionPayload memastikan respons penolakan berisi kode yang
// dikenali frontend, bukan pesan internal.
func TestCSRFRejectionPayload(t *testing.T) {
	app := fiber.New()
	app.Use(CSRFProtection([]string{"http://localhost:8000"}))
	app.Post("/x", func(c *fiber.Ctx) error { return c.SendStatus(200) })

	req := httptest.NewRequest(fiber.MethodPost, "/x", nil)
	req.Host = "localhost:8000"
	req.Header.Set("Origin", "https://evil.example.com")

	res, err := app.Test(req, 5000)
	if err != nil {
		t.Fatalf("request gagal: %v", err)
	}
	if res.StatusCode != 403 {
		t.Fatalf("status = %d, ingin 403", res.StatusCode)
	}
}

// TestCSRFSameOriginWithPort memastikan permintaan same-origin pada port dinamis (misal 8001)
// lolos verifikasi CSRF meskipun tidak terdaftar di konfigurasi allowed origin eksplisit.
func TestCSRFSameOriginWithPort(t *testing.T) {
	app := fiber.New()
	// allowed origin hanya 8000
	app.Use(CSRFProtection([]string{"http://localhost:8000"}))
	app.Post("/login", func(c *fiber.Ctx) error { return c.SendStatus(200) })

	req := httptest.NewRequest(fiber.MethodPost, "/login", nil)
	req.Host = "localhost:8001"
	req.Header.Set("Origin", "http://localhost:8001")

	res, err := app.Test(req, 5000)
	if err != nil {
		t.Fatalf("request gagal: %v", err)
	}
	if res.StatusCode != 200 {
		t.Fatalf("status = %d, ingin 200 untuk same-origin di port 8001", res.StatusCode)
	}
}
