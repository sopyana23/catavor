package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func testCfg() *config.Config {
	return &config.Config{
		AppEnv:             "local",
		JWTSecret:          "middleware-test-secret-0123456789abcdef",
		JWTExpirationHours: 2,
	}
}

func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	name := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open("file:"+name+"?mode=memory&cache=shared"),
		&gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("buka sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.Store{}); err != nil {
		t.Fatalf("automigrate: %v", err)
	}
	prev := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = prev })
	return db
}

func newApp() *fiber.App {
	return fiber.New(fiber.Config{DisableStartupMessage: true})
}

func do(t *testing.T, app *fiber.App, setup func(req *http.Request)) (int, map[string]any) {
	t.Helper()
	return doPath(t, app, "/protected", setup)
}

func doPath(t *testing.T, app *fiber.App, path string, setup func(req *http.Request)) (int, map[string]any) {
	t.Helper()
	req := httptest.NewRequest("GET", path, nil)
	if setup != nil {
		setup(req)
	}
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()
	var body map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&body)
	return resp.StatusCode, body
}

func seedUser(t *testing.T, db *gorm.DB, mutate func(u *models.User)) *models.User {
	t.Helper()
	u := &models.User{
		Email:        "merchant@example.test",
		Name:         "Merchant",
		PlatformRole: "merchant",
		TokenVersion: 1,
	}
	if mutate != nil {
		mutate(u)
	}
	if err := db.Create(u).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return u
}

func TestGenerateTokenWithID(t *testing.T) {
	cfg := testCfg()
	user := &models.User{Email: "a@b.test", Name: "A", IsPasswordChanged: true}
	user.ID = 7

	t.Run("klaim_lengkap", func(t *testing.T) {
		store := &models.Store{Slug: "toko-a"}
		store.ID = 3

		token, jti, expiresAt, err := GenerateTokenWithID(user, store, cfg)
		if err != nil {
			t.Fatalf("GenerateTokenWithID: %v", err)
		}
		if token == "" || jti == "" {
			t.Fatal("token/jti kosong")
		}
		if d := time.Until(expiresAt); d < 90*time.Minute || d > 3*time.Hour {
			t.Errorf("expiry di luar perkiraan: %v", d)
		}

		claims := &JWTClaims{}
		parsed, err := jwt.ParseWithClaims(token, claims, func(*jwt.Token) (interface{}, error) {
			return []byte(cfg.JWTSecret), nil
		}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer(JWTIssuer), jwt.WithAudience(JWTAudience))
		if err != nil || !parsed.Valid {
			t.Fatalf("token tidak valid: %v", err)
		}
		if claims.UserID != 7 || claims.StoreSlug != "toko-a" || claims.StoreID != 3 {
			t.Errorf("klaim salah: %+v", claims)
		}
		if claims.TokenVersion != 1 {
			t.Errorf("token_version = %d, want 1 (default untuk user baru)", claims.TokenVersion)
		}
		if !claims.IsPasswordChanged {
			t.Error("is_password_changed tidak terbawa")
		}
		if claims.ID != jti {
			t.Error("jti pada klaim berbeda dengan yang dikembalikan")
		}
	})

	t.Run("tanpa_store", func(t *testing.T) {
		token, _, _, err := GenerateTokenWithID(user, nil, cfg)
		if err != nil {
			t.Fatalf("GenerateTokenWithID: %v", err)
		}
		claims := &JWTClaims{}
		if _, err := jwt.ParseWithClaims(token, claims, func(*jwt.Token) (interface{}, error) {
			return []byte(cfg.JWTSecret), nil
		}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer(JWTIssuer), jwt.WithAudience(JWTAudience)); err != nil {
			t.Fatalf("parse: %v", err)
		}
		if claims.StoreSlug != "" || claims.StoreID != 0 {
			t.Errorf("store seharusnya kosong: %+v", claims)
		}
	})

	t.Run("token_version_nol_jadi_satu", func(t *testing.T) {
		u := &models.User{Email: "z@b.test", TokenVersion: 0}
		u.ID = 9
		token, _, _, err := GenerateTokenWithID(u, nil, cfg)
		if err != nil {
			t.Fatalf("GenerateTokenWithID: %v", err)
		}
		claims := &JWTClaims{}
		_, _ = jwt.ParseWithClaims(token, claims, func(*jwt.Token) (interface{}, error) {
			return []byte(cfg.JWTSecret), nil
		}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer(JWTIssuer), jwt.WithAudience(JWTAudience))
		if claims.TokenVersion != 1 {
			t.Errorf("token_version = %d, want 1", claims.TokenVersion)
		}
	})
}

func TestGenerateToken(t *testing.T) {
	user := &models.User{Email: "a@b.test"}
	user.ID = 1
	token, err := GenerateToken(user, nil, testCfg())
	if err != nil || token == "" {
		t.Fatalf("GenerateToken: %v", err)
	}
}

func TestExtractOptionalClaims(t *testing.T) {
	cfg := testCfg()
	user := &models.User{Email: "a@b.test"}
	user.ID = 5
	token, _, _, err := GenerateTokenWithID(user, nil, cfg)
	if err != nil {
		t.Fatalf("generate: %v", err)
	}

	run := func(cfg *config.Config, header, query string) *JWTClaims {
		app := newApp()
		var got *JWTClaims
		app.Get("/x", func(c *fiber.Ctx) error {
			got = ExtractOptionalClaims(c, cfg)
			return c.SendStatus(200)
		})
		req := httptest.NewRequest("GET", "/x"+query, nil)
		if header != "" {
			req.Header.Set("Authorization", header)
		}
		if _, err := app.Test(req, -1); err != nil {
			t.Fatalf("app.Test: %v", err)
		}
		return got
	}

	t.Run("nil_config", func(t *testing.T) {
		if got := run(nil, "Bearer "+token, ""); got != nil {
			t.Error("harus nil saat config nil")
		}
	})
	t.Run("secret_kosong", func(t *testing.T) {
		if got := run(&config.Config{}, "Bearer "+token, ""); got != nil {
			t.Error("harus nil saat JWTSecret kosong")
		}
	})
	t.Run("tanpa_header", func(t *testing.T) {
		if got := run(cfg, "", ""); got != nil {
			t.Error("harus nil tanpa header")
		}
	})
	t.Run("format_salah", func(t *testing.T) {
		if got := run(cfg, "Token "+token, ""); got != nil {
			t.Error("harus nil untuk skema selain Bearer")
		}
	})
	t.Run("query_token_diabaikan", func(t *testing.T) {
		// SECURITY (N-02): ?token= tidak lagi diterima.
		if got := run(cfg, "", "?token="+token); got != nil {
			t.Error("?token= seharusnya diabaikan")
		}
	})
	t.Run("token_sah", func(t *testing.T) {
		got := run(cfg, "Bearer "+token, "")
		if got == nil || got.UserID != 5 {
			t.Errorf("klaim tidak terbaca: %+v", got)
		}
	})
	t.Run("secret_berbeda", func(t *testing.T) {
		other := testCfg()
		other.JWTSecret = "secret-yang-berbeda-0123456789abcdef"
		if got := run(other, "Bearer "+token, ""); got != nil {
			t.Error("token dengan secret lain harus ditolak")
		}
	})
}

func TestAuthRequired(t *testing.T) {
	cfg := testCfg()

	makeApp := func() *fiber.App {
		app := newApp()
		app.Get("/protected", AuthRequired(cfg), func(c *fiber.Ctx) error {
			return c.JSON(fiber.Map{
				"user_id":    c.Locals("user_id"),
				"store_slug": c.Locals("store_slug"),
			})
		})
		return app
	}

	t.Run("tanpa_kredensial_401", func(t *testing.T) {
		testDB(t)
		code, body := do(t, makeApp(), nil)
		if code != 401 || body["code"] != "UNAUTHENTICATED" {
			t.Errorf("got %d %v", code, body)
		}
	})

	t.Run("format_header_salah_401", func(t *testing.T) {
		testDB(t)
		code, body := do(t, makeApp(), func(r *http.Request) {
			r.Header.Set("Authorization", "Basic abc")
		})
		if code != 401 || body["code"] != "INVALID_TOKEN_FORMAT" {
			t.Errorf("got %d %v", code, body)
		}
	})

	t.Run("token_rusak_401", func(t *testing.T) {
		testDB(t)
		code, body := do(t, makeApp(), func(r *http.Request) {
			r.Header.Set("Authorization", "Bearer bukan.jwt.valid")
		})
		if code != 401 {
			t.Errorf("got %d %v", code, body)
		}
	})

	t.Run("query_token_diabaikan_401", func(t *testing.T) {
		db := testDB(t)
		u := seedUser(t, db, nil)
		token, _, _, _ := GenerateTokenWithID(u, nil, cfg)
		code, body := doPath(t, makeApp(), "/protected?token="+token, nil)
		if code != 401 || body["code"] != "UNAUTHENTICATED" {
			t.Errorf("?token= harus ditolak: got %d %v", code, body)
		}
	})

	t.Run("cookie_sah_200", func(t *testing.T) {
		db := testDB(t)
		u := seedUser(t, db, nil)
		st := &models.Store{Slug: "toko-budi", UserID: u.ID}
		if err := db.Create(st).Error; err != nil {
			t.Fatalf("seed store: %v", err)
		}
		token, _, _, _ := GenerateTokenWithID(u, st, cfg)
		code, body := do(t, makeApp(), func(r *http.Request) {
			r.AddCookie(&http.Cookie{Name: SessionCookieName, Value: token})
		})
		if code != 200 {
			t.Fatalf("got %d %v", code, body)
		}
		if body["store_slug"] != "toko-budi" {
			t.Errorf("store_slug = %v", body["store_slug"])
		}
	})

	t.Run("bearer_sah_200", func(t *testing.T) {
		db := testDB(t)
		u := seedUser(t, db, nil)
		token, _, _, _ := GenerateTokenWithID(u, nil, cfg)
		code, _ := do(t, makeApp(), func(r *http.Request) {
			r.Header.Set("Authorization", "Bearer "+token)
		})
		if code != 200 {
			t.Errorf("got %d", code)
		}
	})

	t.Run("akun_blacklist_403", func(t *testing.T) {
		db := testDB(t)
		u := seedUser(t, db, func(u *models.User) { u.IsBlacklisted = true })
		token, _, _, _ := GenerateTokenWithID(u, nil, cfg)
		code, body := do(t, makeApp(), func(r *http.Request) {
			r.Header.Set("Authorization", "Bearer "+token)
		})
		if code != 403 || body["code"] != "ACCOUNT_BANNED" {
			t.Errorf("got %d %v", code, body)
		}
	})

	t.Run("staf_platform_tetap_boleh_blacklist", func(t *testing.T) {
		db := testDB(t)
		u := seedUser(t, db, func(u *models.User) {
			u.IsBlacklisted = true
			u.PlatformRole = "superadmin"
		})
		token, _, _, _ := GenerateTokenWithID(u, nil, cfg)
		code, _ := do(t, makeApp(), func(r *http.Request) {
			r.Header.Set("Authorization", "Bearer "+token)
		})
		if code != 200 {
			t.Errorf("staf platform tidak boleh terkunci oleh flag blacklist: got %d", code)
		}
	})

	t.Run("token_version_usang_401", func(t *testing.T) {
		db := testDB(t)
		u := seedUser(t, db, nil)
		token, _, _, _ := GenerateTokenWithID(u, nil, cfg)
		// Sesi dicabut: password berubah menaikkan token_version.
		if err := db.Model(u).Update("token_version", u.TokenVersion+1).Error; err != nil {
			t.Fatalf("update: %v", err)
		}
		code, body := do(t, makeApp(), func(r *http.Request) {
			r.Header.Set("Authorization", "Bearer "+token)
		})
		if code != 401 || body["code"] != "PASSWORD_CHANGED" {
			t.Errorf("got %d %v", code, body)
		}
	})

	t.Run("user_dihapus_401", func(t *testing.T) {
		db := testDB(t)
		u := seedUser(t, db, nil)
		token, _, _, _ := GenerateTokenWithID(u, nil, cfg)
		if err := db.Unscoped().Delete(u).Error; err != nil {
			t.Fatalf("delete: %v", err)
		}
		code, body := do(t, makeApp(), func(r *http.Request) {
			r.Header.Set("Authorization", "Bearer "+token)
		})
		if code != 401 || body["code"] != "USER_NOT_FOUND" {
			t.Errorf("got %d %v", code, body)
		}
	})

	t.Run("tiket_sse_sah_200", func(t *testing.T) {
		db := testDB(t)
		u := seedUser(t, db, nil)
		ticket, _, err := security.IssueSSETicket(u.ID)
		if err != nil {
			t.Fatalf("issue ticket: %v", err)
		}
		app := newApp()
		app.Get("/protected", AuthRequired(cfg), func(c *fiber.Ctx) error {
			return c.SendStatus(200)
		})
		code, body := doPath(t, app, "/protected?ticket="+ticket, nil)
		if code != 200 {
			t.Errorf("got %d %v", code, body)
		}
	})

	t.Run("tiket_sse_replay_401", func(t *testing.T) {
		db := testDB(t)
		u := seedUser(t, db, nil)
		ticket, _, err := security.IssueSSETicket(u.ID)
		if err != nil {
			t.Fatalf("issue ticket: %v", err)
		}
		app := newApp()
		app.Get("/protected", AuthRequired(cfg), func(c *fiber.Ctx) error {
			return c.SendStatus(200)
		})
		if code, _ := doPath(t, app, "/protected?ticket="+ticket, nil); code != 200 {
			t.Fatalf("pemakaian pertama harus lolos, got %d", code)
		}
		code, body := doPath(t, app, "/protected?ticket="+ticket, nil)
		if code != 401 || body["code"] != "INVALID_TICKET" {
			t.Errorf("tiket sekali pakai: got %d %v", code, body)
		}
	})

	t.Run("tiket_sse_palsu_401", func(t *testing.T) {
		testDB(t)
		code, body := doPath(t, makeApp(), "/protected?ticket=palsu", nil)
		if code != 401 || body["code"] != "INVALID_TICKET" {
			t.Errorf("got %d %v", code, body)
		}
	})
}

func TestRequireAdmin(t *testing.T) {
	cfg := testCfg()
	build := func(role string) *fiber.App {
		app := newApp()
		app.Get("/admin", func(c *fiber.Ctx) error {
			c.Locals("user", &models.User{PlatformRole: role})
			return c.Next()
		}, RequireAdmin(cfg), func(c *fiber.Ctx) error { return c.SendStatus(200) })
		return app
	}

	cases := []struct {
		role string
		want int
	}{
		{"superadmin", 200},
		{"support", 200},
		{"compliance", 200},
		{"finance", 200},
		{"content", 200},
		// "admin" sengaja BUKAN staf platform: role itu tidak pernah ada di
		// platform_role, sehingga tidak boleh memberi akses (whitelist N-05).
		{"admin", 403},
		{"merchant", 403},
		{"", 403},
		{"admin-typo", 403},
	}
	for _, c := range cases {
		t.Run("role_"+c.role, func(t *testing.T) {
			code, _ := doPath(t, build(c.role), "/admin", nil)
			if code != c.want {
				t.Errorf("role %q: got %d want %d", c.role, code, c.want)
			}
		})
	}

	t.Run("tanpa_user_401", func(t *testing.T) {
		app := newApp()
		app.Get("/admin", RequireAdmin(cfg), func(c *fiber.Ctx) error { return c.SendStatus(200) })
		if code, _ := doPath(t, app, "/admin", nil); code != 401 {
			t.Errorf("got %d want 401", code)
		}
	})
}

func TestIsPlatformStaffRole(t *testing.T) {
	for _, role := range []string{"superadmin", "SUPERADMIN", "Finance", " content ", "Compliance"} {
		if !IsPlatformStaffRole(role) {
			t.Errorf("%q seharusnya staf platform", role)
		}
	}
	for _, role := range []string{"", "merchant", "admin", "admin-typo", "root"} {
		if IsPlatformStaffRole(role) {
			t.Errorf("%q tidak boleh dianggap staf platform", role)
		}
	}
}

func TestRequirePermission(t *testing.T) {
	cfg := testCfg()
	build := func(u *models.User) *fiber.App {
		app := newApp()
		app.Get("/p", func(c *fiber.Ctx) error {
			if u != nil {
				c.Locals("user", u)
			}
			return c.Next()
		}, RequirePermission(cfg, "products.read"), func(c *fiber.Ctx) error { return c.SendStatus(200) })
		return app
	}

	t.Run("superadmin_bypass", func(t *testing.T) {
		testDB(t)
		if code, _ := doPath(t, build(&models.User{PlatformRole: "superadmin"}), "/p", nil); code != 200 {
			t.Errorf("got %d want 200", code)
		}
	})

	t.Run("merchant_ditolak", func(t *testing.T) {
		testDB(t)
		code, body := doPath(t, build(&models.User{PlatformRole: "merchant", Email: "m@x.test"}), "/p", nil)
		if code != 403 || body["code"] != "FORBIDDEN_PERMISSION_REQUIRED" {
			t.Errorf("got %d %v", code, body)
		}
	})

	t.Run("tanpa_user_401", func(t *testing.T) {
		testDB(t)
		if code, _ := doPath(t, build(nil), "/p", nil); code != 401 {
			t.Errorf("got %d want 401", code)
		}
	})
}

func TestRequireAnyPermission(t *testing.T) {
	cfg := testCfg()
	app := newApp()
	app.Get("/p", func(c *fiber.Ctx) error {
		c.Locals("user", &models.User{PlatformRole: "merchant"})
		return c.Next()
	}, RequireAnyPermission(cfg, "a.b", "c.d"), func(c *fiber.Ctx) error { return c.SendStatus(200) })

	testDB(t)
	if code, _ := doPath(t, app, "/p", nil); code != 403 {
		t.Errorf("merchant tanpa izin: got %d want 403", code)
	}
}

func TestTenantResolver(t *testing.T) {
	app := newApp()
	app.Get("/s/:slug", TenantResolver(), func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"tenant": c.Locals("tenant_slug")})
	})

	t.Run("dari_param", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/s/TokoBudi", nil)
		resp, _ := app.Test(req, -1)
		var body map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&body)
		if body["tenant"] != "tokobudi" {
			t.Errorf("tenant = %v", body["tenant"])
		}
	})

	t.Run("header_menang", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/s/paramslug", nil)
		req.Header.Set("X-Store-Slug", "  HeaderSlug  ")
		resp, _ := app.Test(req, -1)
		var body map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&body)
		if body["tenant"] != "headerslug" {
			t.Errorf("tenant = %v", body["tenant"])
		}
	})

	t.Run("tanpa_slug", func(t *testing.T) {
		app2 := newApp()
		app2.Get("/x", TenantResolver(), func(c *fiber.Ctx) error {
			return c.JSON(fiber.Map{"tenant": c.Locals("tenant_slug")})
		})
		req := httptest.NewRequest("GET", "/x", nil)
		resp, _ := app2.Test(req, -1)
		var body map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&body)
		if body["tenant"] != nil {
			t.Errorf("tenant seharusnya nil, got %v", body["tenant"])
		}
	})
}

func TestSessionFingerprint(t *testing.T) {
	const jti = "jti-fingerprint-test"
	RegisterSessionFingerprint(jti, "0.0.0.0", "UA-A")

	app := newApp()
	var first, second bool
	app.Get("/f1", func(c *fiber.Ctx) error {
		first = CheckSessionFingerprint(c, jti, 1)
		return c.SendStatus(200)
	})
	app.Get("/f2", func(c *fiber.Ctx) error {
		second = CheckSessionFingerprint(c, jti, 1)
		return c.SendStatus(200)
	})

	req1 := httptest.NewRequest("GET", "/f1", nil)
	req1.Header.Set("User-Agent", "UA-A")
	if _, err := app.Test(req1, -1); err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if !first {
		t.Error("fingerprint sama seharusnya cocok")
	}

	req2 := httptest.NewRequest("GET", "/f2", nil)
	req2.Header.Set("User-Agent", "UA-B")
	if _, err := app.Test(req2, -1); err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if second {
		t.Error("fingerprint berbeda seharusnya tidak cocok (hanya WARN, bukan blokir)")
	}

	RevokeSessionFingerprint(jti)
	var afterRevoke bool
	app.Get("/f3", func(c *fiber.Ctx) error {
		afterRevoke = CheckSessionFingerprint(c, jti, 1)
		return c.SendStatus(200)
	})
	req3 := httptest.NewRequest("GET", "/f3", nil)
	if _, err := app.Test(req3, -1); err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	// Setelah revoke entri hilang; sesi tak dikenal dicatat ulang dan
	// dianggap cocok (jalur kompatibilitas sesi lama), bukan diblokir.
	if !afterRevoke {
		t.Error("sesi tak tercatat seharusnya dicatat ulang dan dianggap cocok")
	}
}
