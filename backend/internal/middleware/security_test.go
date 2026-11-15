package middleware

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"catavor-backend/internal/config"
)

// newTestApp memasang seluruh rantai SetupSecurityMiddlewares pada app uji.
// TrustedProxies 0.0.0.0/0 dipakai agar header X-Forwarded-Proto bisa
// mensimulasikan koneksi HTTPS (perilaku yang sama dengan di belakang LB).
func newTestApp(t *testing.T, appEnv string, origins ...string) (*fiber.App, *config.Config) {
	t.Helper()
	cfg := &config.Config{
		AppEnv:                appEnv,
		AllowedOrigins:        origins,
		HSTSIncludeSubDomains: true,
	}
	app := fiber.New(fiber.Config{
		ProxyHeader:             fiber.HeaderXForwardedFor,
		EnableTrustedProxyCheck: true,
		TrustedProxies:          []string{"0.0.0.0/0"},
		DisableStartupMessage:   true,
	})
	SetupSecurityMiddlewares(app, cfg)

	ok := func(c *fiber.Ctx) error { return c.SendString("ok") }
	app.Get("/x", ok)
	app.Post("/x", ok)
	app.Get("/panic", func(c *fiber.Ctx) error { panic("uji panic") })
	return app, cfg
}

func doReq(t *testing.T, app *fiber.App, method, path, remoteAddr string, hdr map[string]string) *http.Response {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	if remoteAddr != "" {
		req.RemoteAddr = remoteAddr
	}
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	res, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	t.Cleanup(func() { _ = res.Body.Close() })
	return res
}

func doGet(t *testing.T, app *fiber.App, path string, hdr map[string]string) *http.Response {
	t.Helper()
	return doReq(t, app, http.MethodGet, path, "", hdr)
}

// rateLimitApp menyiapkan app dengan trusted proxy agar IP klien bisa
// disimulasikan lewat X-Forwarded-For. app.Test tidak memakai RemoteAddr dari
// httptest.Request (selalu 0.0.0.0), jadi jalur XFF inilah yang realistis —
// sama seperti server di belakang reverse proxy.
func rateLimitApp(t *testing.T, handler fiber.Handler, routes map[string]string) *fiber.App {
	t.Helper()
	app := fiber.New(fiber.Config{
		// Sama seperti cmd/server/main.go: IP klien diambil dari XFF hanya
		// bila peer-nya trusted proxy.
		ProxyHeader:             fiber.HeaderXForwardedFor,
		EnableTrustedProxyCheck: true,
		TrustedProxies:          []string{"0.0.0.0/0"},
		DisableStartupMessage:   true,
	})
	app.Use(handler)
	for path, method := range routes {
		p, m := path, method
		switch m {
		case http.MethodPost:
			app.Post(p, func(c *fiber.Ctx) error { return c.SendString("ok") })
		default:
			app.Get(p, func(c *fiber.Ctx) error { return c.SendString("ok") })
		}
	}
	return app
}

// hit mengirim satu permintaan atas nama IP tertentu (lewat X-Forwarded-For).
func hit(t *testing.T, app *fiber.App, method, path, clientIP string) *http.Response {
	t.Helper()
	return doReq(t, app, method, path, "", map[string]string{"X-Forwarded-For": clientIP})
}

func captureLogBuf(t *testing.T, fn func()) string {
	t.Helper()
	var buf bytes.Buffer
	old := log.Logger
	log.Logger = zerolog.New(&buf)
	defer func() { log.Logger = old }()
	fn()
	return buf.String()
}

// TestSecurityHeadersPresent: header pertahanan dasar harus ada di setiap
// respons, termasuk saat rute tidak ditemukan.
func TestSecurityHeadersPresent(t *testing.T) {
	app, _ := newTestApp(t, "local")

	want := map[string]string{
		"X-Content-Type-Options":     "nosniff",
		"X-Frame-Options":            "SAMEORIGIN",
		"X-XSS-Protection":           "1; mode=block",
		"Referrer-Policy":            "strict-origin-when-cross-origin",
		"Cross-Origin-Opener-Policy": "same-origin-allow-popups",
		"Permissions-Policy":         "geolocation=(), camera=(), microphone=()",
	}
	for _, path := range []string{"/x", "/tidak-ada"} {
		res := doGet(t, app, path, nil)
		for k, v := range want {
			if got := res.Header.Get(k); got != v {
				t.Errorf("%s: header %s = %q, harus %q", path, k, got, v)
			}
		}
		if res.Header.Get("Content-Security-Policy") == "" {
			t.Errorf("%s: CSP tidak diset", path)
		}
	}
}

// TestCSPBlocksInlineAndEval: jaminan M2 — script-src tanpa 'unsafe-inline'
// dan tanpa 'unsafe-eval'; object-src 'none'; base-uri 'self'.
func TestCSPBlocksInlineAndEval(t *testing.T) {
	// Pastikan tidak ada hash sisa test lain yang mengaburkan pemeriksaan.
	SetCSPDistDirs(t.TempDir())
	RefreshCSPHashes()

	app, _ := newTestApp(t, "local")
	res := doGet(t, app, "/x", nil)
	csp := res.Header.Get("Content-Security-Policy")
	if csp == "" {
		t.Fatal("CSP kosong")
	}

	scriptSrc := directive(csp, "script-src")
	if scriptSrc == "" {
		t.Fatalf("direktif script-src tidak ada: %q", csp)
	}
	if !strings.Contains(scriptSrc, "'self'") {
		t.Errorf("script-src tanpa 'self': %q", scriptSrc)
	}
	for _, bad := range []string{"unsafe-inline", "unsafe-eval"} {
		if strings.Contains(scriptSrc, bad) {
			t.Errorf("script-src memuat %q: %q", bad, scriptSrc)
		}
	}
	if got := directive(csp, "object-src"); !strings.Contains(got, "'none'") {
		t.Errorf("object-src bukan 'none': %q", got)
	}
	if got := directive(csp, "base-uri"); !strings.Contains(got, "'self'") {
		t.Errorf("base-uri bukan 'self': %q", got)
	}
	if got := directive(csp, "default-src"); !strings.Contains(got, "'self'") {
		t.Errorf("default-src bukan 'self': %q", got)
	}
}

// TestHSTSOnlyOverHTTPS: HSTS tidak boleh dikirim lewat HTTP biasa (akan
// mengunci browser ke https untuk domain yang belum siap).
func TestHSTSOnlyOverHTTPS(t *testing.T) {
	app, _ := newTestApp(t, "production", "https://app.catavor.id")

	plain := doGet(t, app, "/x", nil)
	if got := plain.Header.Get("Strict-Transport-Security"); got != "" {
		t.Errorf("HSTS terkirim lewat HTTP: %q", got)
	}

	secure := doGet(t, app, "/x", map[string]string{"X-Forwarded-Proto": "https"})
	got := secure.Header.Get("Strict-Transport-Security")
	if !strings.Contains(got, "max-age=31536000") || !strings.Contains(got, "includeSubDomains") {
		t.Errorf("HSTS tidak lengkap saat HTTPS: %q", got)
	}
}

// TestCORSAllowlist: origin di daftar diterima (dengan credentials), origin
// asing tidak mendapat header izin.
func TestCORSAllowlist(t *testing.T) {
	app, _ := newTestApp(t, "local")
	preflight := func(origin string) *http.Response {
		return doReq(t, app, http.MethodOptions, "/x", "", map[string]string{
			"Origin":                        origin,
			"Access-Control-Request-Method": "POST",
		})
	}

	allowed := preflight("http://localhost:5173")
	if got := allowed.Header.Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Errorf("origin sah tidak diizinkan: %q", got)
	}
	if got := allowed.Header.Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Errorf("Allow-Credentials = %q, harus true untuk origin eksplisit", got)
	}

	evil := preflight("https://evil.example")
	if got := evil.Header.Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("origin asing diizinkan: %q", got)
	}
}

// TestCORSExplicitOriginNonLocal: origin eksplisit di non-local tetap boleh
// membawa credentials.
func TestCORSExplicitOriginNonLocal(t *testing.T) {
	app, _ := newTestApp(t, "production", "https://app.catavor.id")
	res := doReq(t, app, http.MethodOptions, "/x", "", map[string]string{
		"Origin":                        "https://app.catavor.id",
		"Access-Control-Request-Method": "POST",
	})
	if got := res.Header.Get("Access-Control-Allow-Origin"); got != "https://app.catavor.id" {
		t.Errorf("Allow-Origin = %q", got)
	}
	if got := res.Header.Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Errorf("Allow-Credentials = %q, harus true", got)
	}
}

// TestCORSEmptyOriginsNonLocalDisablesCredentials: tanpa ALLOWED_ORIGINS di
// non-local, credentials dimatikan dan peringatan dicatat.
func TestCORSEmptyOriginsNonLocalDisablesCredentials(t *testing.T) {
	var app *fiber.App
	logs := captureLogBuf(t, func() {
		app, _ = newTestApp(t, "production")
	})
	if !strings.Contains(logs, "ALLOWED_ORIGINS kosong") {
		t.Errorf("peringatan ALLOWED_ORIGINS kosong tidak dicatat: %q", logs)
	}
	if !strings.Contains(logs, "AllowCredentials dinonaktifkan") {
		t.Errorf("log tidak menyatakan credentials dimatikan: %q", logs)
	}

	res := doReq(t, app, http.MethodOptions, "/x", "", map[string]string{
		"Origin":                        "http://localhost:5173",
		"Access-Control-Request-Method": "POST",
	})
	if got := res.Header.Get("Access-Control-Allow-Credentials"); got != "" {
		t.Errorf("Allow-Credentials masih aktif tanpa origin eksplisit: %q", got)
	}
}

// TestWildcardOriginRejectedInNonLocal: wildcard di non-local harus
// menghentikan proses (fail-closed), bukan lanjut dengan konfigurasi longgar.
// log.Fatal memanggil os.Exit, jadi diuji lewat subprocess.
func TestWildcardOriginRejectedInNonLocal(t *testing.T) {
	if os.Getenv("CATAVOR_WILDCARD_FATAL_HELPER") == "1" {
		cfg := &config.Config{AppEnv: "production", AllowedOrigins: []string{"*"}}
		SetupSecurityMiddlewares(fiber.New(), cfg)
		// Tidak boleh tercapai.
		os.Stdout.WriteString("LANJUT_TANPA_HENTI\n")
		os.Exit(0)
	}

	cmd := exec.Command(os.Args[0], "-test.run=^TestWildcardOriginRejectedInNonLocal$")
	cmd.Env = append(os.Environ(), "CATAVOR_WILDCARD_FATAL_HELPER=1")
	out, err := cmd.CombinedOutput()

	var exitErr *exec.ExitError
	if !errors.As(err, &exitErr) {
		t.Fatalf("proses anak tidak keluar dengan error (err=%v, out=%s)", err, out)
	}
	if code := exitErr.ExitCode(); code != 1 {
		t.Errorf("exit code = %d, harus 1", code)
	}
	if strings.Contains(string(out), "LANJUT_TANPA_HENTI") {
		t.Error("wildcard diterima; proses lanjut berjalan")
	}
	if !strings.Contains(string(out), "wildcard") {
		t.Errorf("pesan penolakan tidak muncul di output: %s", out)
	}
}

// TestRequestIDHeader: setiap respons punya X-Request-ID; nilai dari klien
// diteruskan (untuk korelasi log).
func TestRequestIDHeader(t *testing.T) {
	app, _ := newTestApp(t, "local")

	res := doGet(t, app, "/x", nil)
	if res.Header.Get("X-Request-ID") == "" {
		t.Error("X-Request-ID tidak diset")
	}

	const supplied = "trace-abc-123"
	res2 := doGet(t, app, "/x", map[string]string{"X-Request-ID": supplied})
	if got := res2.Header.Get("X-Request-ID"); got != supplied {
		t.Errorf("X-Request-ID = %q, harus meneruskan %q", got, supplied)
	}
}

// TestPanicRecoveredAs500: panic di handler tidak boleh mematikan server.
func TestPanicRecoveredAs500(t *testing.T) {
	app, _ := newTestApp(t, "production")
	res := doGet(t, app, "/panic", nil)
	if res.StatusCode != fiber.StatusInternalServerError {
		t.Errorf("status = %d, harus 500", res.StatusCode)
	}
}

// TestGlobalAPIRateLimiterBlocks: 300 permintaan per menit per IP, ke-301 kena
// 429 dengan pesan JSON standar.
func TestGlobalAPIRateLimiterBlocks(t *testing.T) {
	app := rateLimitApp(t, GlobalAPIRateLimiter(), map[string]string{"/api/x": http.MethodGet})
	const ip = "192.0.2.10"

	for i := 1; i <= 300; i++ {
		res := hit(t, app, http.MethodGet, "/api/x", ip)
		if res.StatusCode != 200 {
			t.Fatalf("permintaan ke-%d status %d, harus 200", i, res.StatusCode)
		}
	}

	res := hit(t, app, http.MethodGet, "/api/x", ip)
	if res.StatusCode != fiber.StatusTooManyRequests {
		t.Fatalf("permintaan ke-301 status %d, harus 429", res.StatusCode)
	}
	body, _ := io.ReadAll(res.Body)
	var payload struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("body 429 bukan JSON: %v (%s)", err, body)
	}
	if payload.Success {
		t.Error("success harus false pada 429")
	}
	if !strings.Contains(strings.ToLower(payload.Message), "terlalu banyak") {
		t.Errorf("pesan 429 tidak informatif: %q", payload.Message)
	}
}

// TestGlobalAPIRateLimiterExemptions: loopback (dev) dan endpoint SSE/ping
// tidak boleh kena limit.
func TestGlobalAPIRateLimiterExemptions(t *testing.T) {
	app := rateLimitApp(t, GlobalAPIRateLimiter(), map[string]string{
		"/api/x":                    http.MethodGet,
		"/api/notifications/stream": http.MethodGet,
		"/api/support/tickets-ping": http.MethodGet,
	})

	// Loopback dikecualikan.
	for i := 1; i <= 350; i++ {
		res := hit(t, app, http.MethodGet, "/api/x", "127.0.0.1")
		if res.StatusCode != 200 {
			t.Fatalf("loopback kena limit pada permintaan ke-%d: %d", i, res.StatusCode)
		}
	}

	// SSE & ping dikecualikan walau IP non-loopback.
	for i := 1; i <= 350; i++ {
		for _, path := range []string{"/api/notifications/stream", "/api/support/tickets-ping"} {
			res := hit(t, app, http.MethodGet, path, "192.0.2.20")
			if res.StatusCode != 200 {
				t.Fatalf("%s kena limit pada permintaan ke-%d: %d", path, i, res.StatusCode)
			}
		}
	}

	// KONTROL: IP non-loopback pada rute biasa tetap kena limit, supaya
	// pengecualian di atas tidak lolos hanya karena limiter tidak bekerja.
	res := hit(t, app, http.MethodGet, "/api/x", "192.0.2.21")
	if res.StatusCode != 200 {
		t.Fatalf("kontrol: permintaan pertama harus 200, dapat %d", res.StatusCode)
	}
	for i := 0; i < 300; i++ {
		hit(t, app, http.MethodGet, "/api/x", "192.0.2.21")
	}
	if res := hit(t, app, http.MethodGet, "/api/x", "192.0.2.21"); res.StatusCode != fiber.StatusTooManyRequests {
		t.Errorf("kontrol: limiter tidak memblokir IP biasa (%d)", res.StatusCode)
	}
}

// TestAuthRateLimiter: 20 percobaan per menit per IP+path.
func TestAuthRateLimiter(t *testing.T) {
	app := rateLimitApp(t, AuthRateLimiter(), map[string]string{"/api/auth/login": http.MethodPost})
	const ip = "192.0.2.30"

	for i := 1; i <= 20; i++ {
		res := hit(t, app, http.MethodPost, "/api/auth/login", ip)
		if res.StatusCode != 200 {
			t.Fatalf("percobaan ke-%d status %d, harus 200", i, res.StatusCode)
		}
	}
	res := hit(t, app, http.MethodPost, "/api/auth/login", ip)
	if res.StatusCode != fiber.StatusTooManyRequests {
		t.Fatalf("percobaan ke-21 status %d, harus 429", res.StatusCode)
	}

	// IP lain punya kuota sendiri.
	other := hit(t, app, http.MethodPost, "/api/auth/login", "192.0.2.31")
	if other.StatusCode != 200 {
		t.Errorf("IP lain ikut terblokir: %d", other.StatusCode)
	}
}

// TestAuthRateLimiter_PathNormalization_N62: varian path (trailing slash, case) berbagi bucket rate limiter yang sama.
func TestAuthRateLimiter_PathNormalization_N62(t *testing.T) {
	app := rateLimitApp(t, AuthRateLimiter(), map[string]string{
		"/api/auth/login":  http.MethodPost,
		"/api/auth/login/": http.MethodPost,
		"/API/AUTH/LOGIN":  http.MethodPost,
	})
	const ip = "192.0.2.77"

	// 10 hits ke /api/auth/login
	for i := 1; i <= 10; i++ {
		res := hit(t, app, http.MethodPost, "/api/auth/login", ip)
		if res.StatusCode != 200 {
			t.Fatalf("hit ke-%d status %d, harus 200", i, res.StatusCode)
		}
	}
	// 10 hits ke /api/auth/login/
	for i := 11; i <= 20; i++ {
		res := hit(t, app, http.MethodPost, "/api/auth/login/", ip)
		if res.StatusCode != 200 {
			t.Fatalf("hit ke-%d status %d, harus 200", i, res.StatusCode)
		}
	}

	// Percobaan ke-21 via /API/AUTH/LOGIN harus langsung 429 Too Many Requests karena berbagi bucket normalisasi
	res := hit(t, app, http.MethodPost, "/API/AUTH/LOGIN", ip)
	if res.StatusCode != fiber.StatusTooManyRequests {
		t.Fatalf("percobaan ke-21 varian path status %d, harus 429", res.StatusCode)
	}
}

// TestPublicSubmissionRateLimiter: 15 pengiriman per menit per IP.
func TestPublicSubmissionRateLimiter(t *testing.T) {
	app := rateLimitApp(t, PublicSubmissionRateLimiter(), map[string]string{"/api/public/comment": http.MethodPost})
	const ip = "192.0.2.40"

	for i := 1; i <= 15; i++ {
		res := hit(t, app, http.MethodPost, "/api/public/comment", ip)
		if res.StatusCode != 200 {
			t.Fatalf("kiriman ke-%d status %d, harus 200", i, res.StatusCode)
		}
	}
	res := hit(t, app, http.MethodPost, "/api/public/comment", ip)
	if res.StatusCode != fiber.StatusTooManyRequests {
		t.Fatalf("kiriman ke-16 status %d, harus 429", res.StatusCode)
	}
}

// TestTelemetryRateLimiter: 180 requests per menit, ke-181 mengembalikan 202 Accepted (silent drop).
func TestTelemetryRateLimiter(t *testing.T) {
	app := rateLimitApp(t, TelemetryRateLimiter(), map[string]string{"/api/telemetry/search": http.MethodPost})
	const ip = "192.0.2.45"

	for i := 1; i <= 180; i++ {
		res := hit(t, app, http.MethodPost, "/api/telemetry/search", ip)
		if res.StatusCode != 200 {
			t.Fatalf("kiriman telemetri ke-%d status %d, harus 200", i, res.StatusCode)
		}
	}
	res := hit(t, app, http.MethodPost, "/api/telemetry/search", ip)
	if res.StatusCode != fiber.StatusAccepted {
		t.Fatalf("kiriman telemetri ke-181 status %d, harus 202 (silent drop)", res.StatusCode)
	}
}

// TestCSPTightening_ProductionVsLocal: jaminan N-50 — perketat CSP tanpa wildcard di produksi,
// dan pastikan endpoint sah seperti api.qrserver.com, allowed origins, dan storage tercantum.
func TestCSPTightening_ProductionVsLocal(t *testing.T) {
	SetCSPDistDirs(t.TempDir())
	RefreshCSPHashes()

	// 1. Production Mode
	prodApp, prodCfg := newTestApp(t, "production", "https://catavor.id", "https://app.catavor.id")
	prodCfg.AppURL = "https://app.catavor.id"
	prodCfg.StoragePublicURL = "https://cdn.catavor.id/storage"

	resProd := doGet(t, prodApp, "/x", nil)
	cspProd := resProd.Header.Get("Content-Security-Policy")
	if cspProd == "" {
		t.Fatal("CSP produksi kosong")
	}

	imgProd := directive(cspProd, "img-src")
	if strings.Contains(imgProd, "http:") {
		t.Errorf("img-src produksi tidak boleh memuat 'http:': %q", imgProd)
	}
	if !strings.Contains(imgProd, "'self'") || !strings.Contains(imgProd, "data:") || !strings.Contains(imgProd, "https:") {
		t.Errorf("img-src produksi harus memuat 'self', data:, dan https:: %q", imgProd)
	}

	connectProd := directive(cspProd, "connect-src")
	if strings.Contains(connectProd, " http:") {
		t.Errorf("connect-src produksi tidak boleh memuat wildcard 'http:': %q", connectProd)
	}
	// Tidak boleh ada standalone wildcard https: (harus berupa origin spesifik)
	tokens := strings.Fields(connectProd)
	for _, tok := range tokens {
		if tok == "https:" || tok == "http:" {
			t.Errorf("connect-src produksi memuat token wildcard mentah %q: %q", tok, connectProd)
		}
	}
	if !strings.Contains(connectProd, "https://api.qrserver.com") {
		t.Errorf("connect-src produksi harus memuat https://api.qrserver.com untuk unduh QR: %q", connectProd)
	}
	if !strings.Contains(connectProd, "https://www.googleapis.com") {
		t.Errorf("connect-src produksi harus memuat https://www.googleapis.com untuk SSO: %q", connectProd)
	}
	if !strings.Contains(connectProd, "https://catavor.id") {
		t.Errorf("connect-src produksi harus memuat allowed origin https://catavor.id: %q", connectProd)
	}
	if !strings.Contains(connectProd, "https://cdn.catavor.id") {
		t.Errorf("connect-src produksi harus memuat origin storage https://cdn.catavor.id: %q", connectProd)
	}
	if strings.Contains(connectProd, "localhost") {
		t.Errorf("connect-src produksi tidak boleh memuat localhost: %q", connectProd)
	}

	// 2. Local Mode
	localApp, _ := newTestApp(t, "local", "http://localhost:8000")
	resLocal := doGet(t, localApp, "/x", nil)
	cspLocal := resLocal.Header.Get("Content-Security-Policy")

	imgLocal := directive(cspLocal, "img-src")
	if !strings.Contains(imgLocal, "http:") {
		t.Errorf("img-src lokal harus memuat http: untuk aset dev: %q", imgLocal)
	}

	connectLocal := directive(cspLocal, "connect-src")
	if !strings.Contains(connectLocal, "http://localhost:*") || !strings.Contains(connectLocal, "ws://localhost:*") {
		t.Errorf("connect-src lokal harus memuat loopback dev ports: %q", connectLocal)
	}
}

// TestHSTSOptions: jaminan N-51 — flag preload dan includeSubDomains dapat dikendalikan.
func TestHSTSOptions(t *testing.T) {
	// Kasus 1: includeSubDomains=true, preload=false (default aman)
	app1, cfg1 := newTestApp(t, "production", "https://app.catavor.id")
	cfg1.HSTSIncludeSubDomains = true
	cfg1.HSTSPreload = false
	res1 := doGet(t, app1, "/x", map[string]string{"X-Forwarded-Proto": "https"})
	hsts1 := res1.Header.Get("Strict-Transport-Security")
	if hsts1 != "max-age=31536000; includeSubDomains" {
		t.Errorf("HSTS kasus 1 tidak sesuai: got %q, want %q", hsts1, "max-age=31536000; includeSubDomains")
	}

	// Kasus 2: includeSubDomains=true, preload=true
	app2, cfg2 := newTestApp(t, "production", "https://app.catavor.id")
	cfg2.HSTSIncludeSubDomains = true
	cfg2.HSTSPreload = true
	res2 := doGet(t, app2, "/x", map[string]string{"X-Forwarded-Proto": "https"})
	hsts2 := res2.Header.Get("Strict-Transport-Security")
	if hsts2 != "max-age=31536000; includeSubDomains; preload" {
		t.Errorf("HSTS kasus 2 tidak sesuai: got %q, want %q", hsts2, "max-age=31536000; includeSubDomains; preload")
	}

	// Kasus 3: includeSubDomains=false, preload=true (preload wajib ditekan bila subdomains false)
	app3, cfg3 := newTestApp(t, "production", "https://app.catavor.id")
	cfg3.HSTSIncludeSubDomains = false
	cfg3.HSTSPreload = true
	res3 := doGet(t, app3, "/x", map[string]string{"X-Forwarded-Proto": "https"})
	hsts3 := res3.Header.Get("Strict-Transport-Security")
	if hsts3 != "max-age=31536000" {
		t.Errorf("HSTS kasus 3 tidak sesuai: got %q, want %q", hsts3, "max-age=31536000")
	}
}

// TestExtractCSPOrigin: validasi sanitasi origin dinamis CSP.
func TestExtractCSPOrigin(t *testing.T) {
	tests := []struct {
		raw       string
		allowHTTP bool
		want      string
	}{
		{"https://catavor.id", false, "https://catavor.id"},
		{"https://catavor.id:8443/path?query=1", false, "https://catavor.id:8443"},
		{"http://localhost:8000", false, ""},
		{"http://localhost:8000", true, "http://localhost:8000"},
		{"https://*.catavor.id", false, ""}, // wildcard ditolak oleh extractCSPOrigin
		{"", false, ""},
		{"   ", false, ""},
		{"https://catavor.id; script-src *", false, ""}, // injeksi CSP ditolak
		{"https://catavor.id/storage/", false, "https://catavor.id"},
	}

	for _, tt := range tests {
		got := extractCSPOrigin(tt.raw, tt.allowHTTP)
		if got != tt.want {
			t.Errorf("extractCSPOrigin(%q, %v) = %q, want %q", tt.raw, tt.allowHTTP, got, tt.want)
		}
	}
}


