package handlers

import (
	"net/http"
	"testing"

	"catavor-backend/internal/config"
	"github.com/gofiber/fiber/v2"
)

// Self-check M1: cookie sesi harus HttpOnly di semua environment, dan hanya
// memakai flag Secure saat environment produksi/staging (agar dev di
// http://localhost tetap bisa login).
func TestSessionCookieFlags(t *testing.T) {
	cases := []struct {
		env        string
		wantSecure bool
	}{
		{"development", false},
		{"local", false},
		{"staging", true},
		{"production", true},
		{"prod", true},
	}

	for _, tc := range cases {
		cfg := &config.Config{AppEnv: tc.env, JWTExpirationHours: 12}
		app := fiber.New()
		app.Get("/", func(c *fiber.Ctx) error {
			setSessionCookie(c, cfg, "token-uji")
			return c.SendString("ok")
		})

		req := newHTTPRequest(t, "/")
		resp, err := app.Test(req, -1)
		if err != nil {
			t.Fatalf("%s: %v", tc.env, err)
		}
		defer resp.Body.Close()

		cookie := resp.Header.Get("Set-Cookie")
		if cookie == "" {
			t.Fatalf("%s: Set-Cookie kosong", tc.env)
		}
		if !contains(cookie, "HttpOnly") {
			t.Fatalf("%s: HttpOnly wajib ada di semua env: %s", tc.env, cookie)
		}
		if !contains(cookie, "SameSite=Strict") {
			t.Fatalf("%s: SameSite=Strict wajib: %s", tc.env, cookie)
		}
		hasSecure := contains(cookie, "Secure")
		if hasSecure != tc.wantSecure {
			t.Fatalf("%s: Secure=%v, diharapkan %v: %s", tc.env, hasSecure, tc.wantSecure, cookie)
		}
	}
}

// Self-check: clearSessionCookie mengosongkan nilai dan memaksa kedaluwarsa.
func TestClearSessionCookie(t *testing.T) {
	cfg := &config.Config{AppEnv: "development", JWTExpirationHours: 12}
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {
		clearSessionCookie(c, cfg)
		return c.SendString("ok")
	})

	req := newHTTPRequest(t, "/")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	cookie := resp.Header.Get("Set-Cookie")
	if !contains(cookie, "catavor_session=;") {
		t.Fatalf("cookie harus dikosongkan: %s", cookie)
	}
	if !contains(cookie, "Max-Age=0") && !contains(cookie, "max-age=0") {
		t.Fatalf("cookie harus kedaluwarsa segera: %s", cookie)
	}
	if !contains(cookie, "HttpOnly") {
		t.Fatalf("cookie hapus tetap harus HttpOnly: %s", cookie)
	}
}

func contains(s, sub string) bool {
	// case-insensitive: Fiber menulis atribut cookie dengan huruf kecil ("secure")
	return len(sub) == 0 || indexOf(lower(s), lower(sub)) >= 0
}

func lower(s string) string {
	b := []byte(s)
	for i := range b {
		if b[i] >= 'A' && b[i] <= 'Z' {
			b[i] += 'a' - 'A'
		}
	}
	return string(b)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func newHTTPRequest(t *testing.T, path string) *http.Request {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, "http://localhost"+path, nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Host = "localhost"
	return req
}
