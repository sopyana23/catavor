package handlers

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ---------------------------------------------------------------------------
// Harness: GORM di atas SQLite in-memory (driver pure-Go, sudah jadi dependency
// langsung) sehingga handler HTTP bisa diuji end-to-end tanpa PostgreSQL.
// ---------------------------------------------------------------------------

func testCfg() *config.Config {
	return &config.Config{
		Port:               "8000",
		AppEnv:             "local",
		AppURL:             "http://localhost:8000",
		JWTSecret:          "unit-test-secret-key-0123456789abcdef",
		JWTExpirationHours: 12,
		AllowedOrigins:     []string{"http://localhost:3000"},
	}
}

func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	name := strings.NewReplacer("/", "_", " ", "_", "-", "_").Replace(t.Name())
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", name)
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger:  logger.Default.LogMode(logger.Silent),
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		t.Fatalf("gorm.Open(sqlite): %v", err)
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.UserSession{},
		&models.Store{},
		&models.SubscriptionPlan{},
		&models.SubscriptionOrder{},
		&models.Category{},
		&models.Product{},
		&models.ProductImage{},
		&models.ProductVariant{},
		&models.ActivityLog{},
		&models.BlacklistedSlug{},
		&models.EmailVerificationOTP{},
		&models.Notification{},
		&models.NotificationRead{},
		&models.PlatformRole{},
		&models.PlatformPermission{},
		&models.PlatformRolePermission{},
	); err != nil {
		t.Fatalf("AutoMigrate(sqlite): %v", err)
	}
	// Handler memakai layanan global yang membaca database.DB.
	database.DB = db
	services.InitOTPService(db)
	t.Cleanup(func() { database.DB = nil })
	return db
}

func newTestApp(db *gorm.DB) *fiber.App {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	auth := NewAuthHandler(testCfg(), db)
	prod := NewProductHandler(testCfg(), db)
	store := NewStoreHandler(db, testCfg())

	app.Post("/api/auth/register", auth.Register)
	app.Post("/api/auth/login", auth.Login)
	app.Get("/api/products", prod.Index)
	app.Get("/api/u/:slug/products", prod.Index)
	app.Get("/api/products/:id", prod.Show)
	app.Get("/api/stores/check-slug/:slug", store.CheckSlug)
	app.Get("/api/stores/featured", store.FeaturedStores)
	return app
}

type apiResp struct {
	Status  int
	Body    map[string]any
	Raw     string
	Headers http.Header
}

func call(t *testing.T, app *fiber.App, method, target string, payload any) apiResp {
	t.Helper()
	var body io.Reader = bytes.NewReader(nil)
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal payload: %v", err)
		}
		body = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, target, body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test(%s %s): %v", method, target, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	out := map[string]any{}
	_ = json.Unmarshal(raw, &out)
	return apiResp{Status: resp.StatusCode, Body: out, Raw: string(raw), Headers: resp.Header}
}

func callRaw(t *testing.T, app *fiber.App, method, target, body string) apiResp {
	t.Helper()
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	out := map[string]any{}
	_ = json.Unmarshal(raw, &out)
	return apiResp{Status: resp.StatusCode, Body: out, Raw: string(raw), Headers: resp.Header}
}

// seedRegistrationToken membuat token verifikasi OTP yang sah tanpa mengirim email.
func seedRegistrationToken(t *testing.T, db *gorm.DB, email, token string) {
	t.Helper()
	sum := sha256.Sum256([]byte("123456"))
	rec := models.EmailVerificationOTP{
		Email:     strings.ToLower(strings.TrimSpace(email)),
		OTPHash:   hex.EncodeToString(sum[:]),
		Purpose:   "registration",
		Token:     token,
		ExpiresAt: time.Now().Add(10 * time.Minute),
	}
	if err := db.Create(&rec).Error; err != nil {
		t.Fatalf("seed token: %v", err)
	}
}

func mustCreate(t *testing.T, db *gorm.DB, v any) {
	t.Helper()
	if err := db.Create(v).Error; err != nil {
		t.Fatalf("create fixture %T: %v", v, err)
	}
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

func TestRegister_SQLite(t *testing.T) {
	validBody := func() map[string]any {
		return map[string]any{
			"name":               "Budi Santoso",
			"email":              "budi@example.com",
			"password":           "Rahasia123!",
			"verification_token": "vt_test_valid",
			"store_slug":         "tokobudi",
			"store_name":         "Toko Budi",
			"whatsapp_number":    "628123456789",
		}
	}

	t.Run("db_nil_503", func(t *testing.T) {
		app := newTestApp(nil)
		r := call(t, app, "POST", "/api/auth/register", validBody())
		if r.Status != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("body_invalid_400", func(t *testing.T) {
		db := newTestDB(t)
		app := newTestApp(db)
		r := callRaw(t, app, "POST", "/api/auth/register", `{"name":`)
		if r.Status != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("honeypot_422", func(t *testing.T) {
		db := newTestDB(t)
		app := newTestApp(db)
		b := validBody()
		b["website_hp"] = "http://spam.example"
		r := call(t, app, "POST", "/api/auth/register", b)
		if r.Status != http.StatusUnprocessableEntity {
			t.Fatalf("status = %d, want 422 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("field_wajib_kosong_422", func(t *testing.T) {
		db := newTestDB(t)
		app := newTestApp(db)
		r := call(t, app, "POST", "/api/auth/register", map[string]any{"name": "", "email": "", "store_slug": ""})
		if r.Status != http.StatusUnprocessableEntity {
			t.Fatalf("status = %d, want 422 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("email_tidak_valid_422", func(t *testing.T) {
		db := newTestDB(t)
		app := newTestApp(db)
		b := validBody()
		b["email"] = "bukan-email"
		r := call(t, app, "POST", "/api/auth/register", b)
		if r.Status != http.StatusUnprocessableEntity {
			t.Fatalf("status = %d, want 422 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("password_lemah_422", func(t *testing.T) {
		db := newTestDB(t)
		app := newTestApp(db)
		b := validBody()
		b["password"] = "abc"
		r := call(t, app, "POST", "/api/auth/register", b)
		if r.Status != http.StatusUnprocessableEntity {
			t.Fatalf("status = %d, want 422 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("slug_terlalu_pendek_422", func(t *testing.T) {
		db := newTestDB(t)
		app := newTestApp(db)
		b := validBody()
		b["store_slug"] = "ab"
		r := call(t, app, "POST", "/api/auth/register", b)
		if r.Status != http.StatusUnprocessableEntity {
			t.Fatalf("status = %d, want 422 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("slug_dicadangkan_422", func(t *testing.T) {
		db := newTestDB(t)
		app := newTestApp(db)
		b := validBody()
		b["store_slug"] = "admin"
		r := call(t, app, "POST", "/api/auth/register", b)
		if r.Status != http.StatusUnprocessableEntity {
			t.Fatalf("status = %d, want 422 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("email_blacklist_403", func(t *testing.T) {
		db := newTestDB(t)
		// Blacklist email bersifat DB-driven: user lama dengan is_blacklisted=true.
		seedRegistrationToken(t, db, "spammer@blacklist.test", "vt_test_valid")
		banned := models.User{Name: "Spammer", Email: "spammer@blacklist.test", IsBlacklisted: true}
		if err := banned.SetPassword("Rahasia123!"); err != nil {
			t.Fatalf("SetPassword: %v", err)
		}
		mustCreate(t, db, &banned)
		app := newTestApp(db)
		b := validBody()
		b["email"] = "spammer@blacklist.test"
		r := call(t, app, "POST", "/api/auth/register", b)
		if r.Status != http.StatusForbidden {
			t.Fatalf("status = %d, want 403 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("slug_di_tabel_blacklist_403", func(t *testing.T) {
		db := newTestDB(t)
		mustCreate(t, db, &models.BlacklistedSlug{Slug: "tokobudi", Reason: "uji"})
		app := newTestApp(db)
		r := call(t, app, "POST", "/api/auth/register", validBody())
		if r.Status != http.StatusForbidden {
			t.Fatalf("status = %d, want 403 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("slug_sudah_dipakai_422", func(t *testing.T) {
		db := newTestDB(t)
		u := models.User{Name: "Lain", Email: "lain@example.com"}
		if err := u.SetPassword("Rahasia123!"); err != nil {
			t.Fatalf("SetPassword: %v", err)
		}
		mustCreate(t, db, &u)
		mustCreate(t, db, &models.Store{UserID: u.ID, Slug: "tokobudi", StoreTitle: "Toko Lain"})
		app := newTestApp(db)
		r := call(t, app, "POST", "/api/auth/register", validBody())
		if r.Status != http.StatusUnprocessableEntity {
			t.Fatalf("status = %d, want 422 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("email_sudah_terdaftar_422", func(t *testing.T) {
		db := newTestDB(t)
		u := models.User{Name: "Budi", Email: "budi@example.com"}
		if err := u.SetPassword("Rahasia123!"); err != nil {
			t.Fatalf("SetPassword: %v", err)
		}
		mustCreate(t, db, &u)
		app := newTestApp(db)
		r := call(t, app, "POST", "/api/auth/register", validBody())
		if r.Status != http.StatusUnprocessableEntity {
			t.Fatalf("status = %d, want 422 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("token_verifikasi_kosong_422", func(t *testing.T) {
		db := newTestDB(t)
		app := newTestApp(db)
		b := validBody()
		delete(b, "verification_token")
		r := call(t, app, "POST", "/api/auth/register", b)
		if r.Status != http.StatusUnprocessableEntity {
			t.Fatalf("status = %d, want 422 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("token_verifikasi_palsu_422", func(t *testing.T) {
		db := newTestDB(t)
		app := newTestApp(db)
		b := validBody()
		b["verification_token"] = "vt_palsu"
		r := call(t, app, "POST", "/api/auth/register", b)
		if r.Status != http.StatusUnprocessableEntity {
			t.Fatalf("status = %d, want 422 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("sukses_paket_free", func(t *testing.T) {
		db := newTestDB(t)
		seedRegistrationToken(t, db, "budi@example.com", "vt_test_valid")
		app := newTestApp(db)
		r := call(t, app, "POST", "/api/auth/register", validBody())
		if r.Status != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", r.Status, r.Raw)
		}
		if r.Body["success"] != true {
			t.Fatalf("success = %v, want true", r.Body["success"])
		}
		token, _ := r.Body["token"].(string)
		if token == "" {
			t.Fatal("token kosong pada respons register")
		}
		if !strings.Contains(strings.ToLower(r.Headers.Get("Set-Cookie")), "httponly") {
			t.Errorf("cookie sesi harus HttpOnly, dapat %q", r.Headers.Get("Set-Cookie"))
		}
		var stores []models.Store
		db.Find(&stores)
		if len(stores) != 1 {
			t.Fatalf("jumlah store = %d, want 1", len(stores))
		}
		if stores[0].Slug != "tokobudi" {
			t.Errorf("slug = %q, want tokobudi", stores[0].Slug)
		}
		if stores[0].Plan != "free" || stores[0].PaymentStatus != "free_active" {
			t.Errorf("plan/payment = %q/%q, want free/free_active", stores[0].Plan, stores[0].PaymentStatus)
		}
		// Token OTP harus terkonsumsi (sekali pakai).
		var otp int64
		db.Model(&models.EmailVerificationOTP{}).Count(&otp)
		if otp != 0 {
			t.Errorf("token verifikasi belum terkonsumsi, sisa record = %d", otp)
		}
	})

	t.Run("sukses_paket_pro_kupon_100", func(t *testing.T) {
		db := newTestDB(t)
		seedRegistrationToken(t, db, "budi@example.com", "vt_test_valid")
		mustCreate(t, db, &models.SubscriptionPlan{
			Code: "pro_starter", Name: "Pro Starter", PriceMonthly: 49000, PriceAnnual: 490000,
		})
		app := newTestApp(db)
		b := validBody()
		b["plan"] = "pro"
		b["billing_cycle"] = "annual"
		b["coupon_code"] = "catavor100"
		r := call(t, app, "POST", "/api/auth/register", b)
		if r.Status != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", r.Status, r.Raw)
		}
		var store models.Store
		db.First(&store)
		if store.Plan != "pro_starter" {
			t.Errorf("plan = %q, want pro_starter", store.Plan)
		}
		if store.PaymentStatus != "paid" {
			t.Errorf("payment_status = %q, want paid", store.PaymentStatus)
		}
		if store.PlanExpiresAt == nil {
			t.Error("plan_expires_at harus terisi untuk paket berbayar aktif")
		}
		var orders []models.SubscriptionOrder
		db.Find(&orders)
		if len(orders) != 1 {
			t.Fatalf("jumlah order = %d, want 1", len(orders))
		}
		if orders[0].PaymentMethod != "coupon_free" || orders[0].FinalAmount != 0 {
			t.Errorf("order = %q/%.0f, want coupon_free/0", orders[0].PaymentMethod, orders[0].FinalAmount)
		}
	})

	t.Run("paket_pro_tanpa_kupon_pending", func(t *testing.T) {
		db := newTestDB(t)
		seedRegistrationToken(t, db, "budi@example.com", "vt_test_valid")
		mustCreate(t, db, &models.SubscriptionPlan{
			Code: "pro_starter", Name: "Pro Starter", PriceMonthly: 49000, PriceAnnual: 490000,
		})
		app := newTestApp(db)
		b := validBody()
		b["plan"] = "pro_starter"
		b["billing_cycle"] = "monthly"
		r := call(t, app, "POST", "/api/auth/register", b)
		if r.Status != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", r.Status, r.Raw)
		}
		var store models.Store
		db.First(&store)
		// Anti-exploit: paket berbayar tanpa pembayaran tetap free + pending.
		if store.Plan != "free" {
			t.Errorf("plan = %q, want free", store.Plan)
		}
		if store.PaymentStatus != "pending_verification" {
			t.Errorf("payment_status = %q, want pending_verification", store.PaymentStatus)
		}
		var order models.SubscriptionOrder
		db.First(&order)
		if order.PaymentStatus != "pending" || order.FinalAmount != 49000 {
			t.Errorf("order = %q/%.0f, want pending/49000", order.PaymentStatus, order.FinalAmount)
		}
	})

	t.Run("google_tanpa_token_verifikasi", func(t *testing.T) {
		db := newTestDB(t)
		app := newTestApp(db)
		b := validBody()
		delete(b, "verification_token")
		delete(b, "password")
		b["google_id"] = "google-uid-1"
		b["avatar"] = "https://img.example/a.png"
		r := call(t, app, "POST", "/api/auth/register", b)
		if r.Status != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", r.Status, r.Raw)
		}
		var u models.User
		db.First(&u)
		if u.GoogleID == nil || *u.GoogleID != "google-uid-1" {
			t.Errorf("google_id = %v, want google-uid-1", u.GoogleID)
		}
	})
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

func TestLogin_SQLite(t *testing.T) {
	seedUser := func(t *testing.T, db *gorm.DB, email, password string) models.User {
		t.Helper()
		u := models.User{Name: "Budi", Email: email}
		if err := u.SetPassword(password); err != nil {
			t.Fatalf("SetPassword: %v", err)
		}
		mustCreate(t, db, &u)
		return u
	}

	t.Run("db_nil_503", func(t *testing.T) {
		app := newTestApp(nil)
		r := call(t, app, "POST", "/api/auth/login", map[string]any{"email": "a@b.c", "password": "x"})
		if r.Status != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("body_invalid_400", func(t *testing.T) {
		db := newTestDB(t)
		app := newTestApp(db)
		r := callRaw(t, app, "POST", "/api/auth/login", `{"email":`)
		if r.Status != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("email_kosong_422", func(t *testing.T) {
		db := newTestDB(t)
		app := newTestApp(db)
		r := call(t, app, "POST", "/api/auth/login", map[string]any{"email": "", "password": ""})
		if r.Status != http.StatusUnprocessableEntity && r.Status != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400/422 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("user_tidak_dikenal_401", func(t *testing.T) {
		db := newTestDB(t)
		app := newTestApp(db)
		r := call(t, app, "POST", "/api/auth/login", map[string]any{"email": "nobody@example.com", "password": "Rahasia123!"})
		if r.Status != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("password_salah_401", func(t *testing.T) {
		db := newTestDB(t)
		seedUser(t, db, "budi@example.com", "Rahasia123!")
		app := newTestApp(db)
		r := call(t, app, "POST", "/api/auth/login", map[string]any{"email": "budi@example.com", "password": "SalahBanget1!"})
		if r.Status != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("sukses", func(t *testing.T) {
		db := newTestDB(t)
		u := seedUser(t, db, "budi@example.com", "Rahasia123!")
		mustCreate(t, db, &models.Store{UserID: u.ID, Slug: "tokobudi", StoreTitle: "Toko Budi", Plan: "free"})
		app := newTestApp(db)
		r := call(t, app, "POST", "/api/auth/login", map[string]any{"email": "budi@example.com", "password": "Rahasia123!"})
		if r.Status != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", r.Status, r.Raw)
		}
		if tok, _ := r.Body["token"].(string); tok == "" {
			t.Fatal("token kosong pada respons login")
		}
		if !strings.Contains(strings.ToLower(r.Headers.Get("Set-Cookie")), "httponly") {
			t.Errorf("cookie sesi harus HttpOnly, dapat %q", r.Headers.Get("Set-Cookie"))
		}
		user, _ := r.Body["user"].(map[string]any)
		if user == nil || user["email"] != "budi@example.com" {
			t.Errorf("payload user tidak sesuai: %v", r.Body["user"])
		}
		// Login harus meninggalkan jejak audit.
		var logs int64
		db.Model(&models.ActivityLog{}).Where("action = ?", "auth.login").Count(&logs)
		if logs == 0 {
			t.Error("activity log auth.login tidak tercatat")
		}
	})
}

// ---------------------------------------------------------------------------
// Product index / show
// ---------------------------------------------------------------------------

func productFixtures(t *testing.T, db *gorm.DB) models.Store {
	t.Helper()
	u := models.User{Name: "Budi", Email: "budi@example.com"}
	if err := u.SetPassword("Rahasia123!"); err != nil {
		t.Fatalf("SetPassword: %v", err)
	}
	mustCreate(t, db, &u)
	st := models.Store{UserID: u.ID, Slug: "tokobudi", StoreTitle: "Toko Budi", Plan: "free"}
	mustCreate(t, db, &st)
	mustCreate(t, db, &models.Product{
		StoreID: st.ID, Name: "Kaos Merah", Class: "Pakaian & Busana", ProductType: "physical",
		Price: 50000, IsActive: true,
	})
	mustCreate(t, db, &models.Product{
		StoreID: st.ID, Name: "Kaos Hitam", Class: "Pakaian & Busana", ProductType: "physical",
		Price: 60000, IsActive: true,
	})
	// IsActive punya tag `default:true`, sehingga GORM membuang nilai false saat
	// INSERT. Nonaktifkan lewat UPDATE eksplisit agar fixture mencerminkan DB nyata.
	nonaktif := models.Product{
		StoreID: st.ID, Name: "Produk Nonaktif", Class: "Pakaian & Busana", ProductType: "physical",
		Price: 70000,
	}
	mustCreate(t, db, &nonaktif)
	if err := db.Model(&nonaktif).Update("is_active", false).Error; err != nil {
		t.Fatalf("nonaktifkan produk: %v", err)
	}
	mustCreate(t, db, &models.Product{
		StoreID: st.ID, Name: "Produk Banned", Class: "Pakaian & Busana", ProductType: "physical",
		Price: 80000, IsActive: true, ModerationStatus: "banned",
	})
	return st
}

func TestProductIndex_SQLite(t *testing.T) {
	t.Run("db_nil_503", func(t *testing.T) {
		app := newTestApp(nil)
		r := call(t, app, "GET", "/api/products", nil)
		if r.Status != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("store_tidak_ada_404", func(t *testing.T) {
		db := newTestDB(t)
		app := newTestApp(db)
		r := call(t, app, "GET", "/api/u/tidakada/products", nil)
		if r.Status != http.StatusNotFound {
			t.Fatalf("status = %d, want 404 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("publik_hanya_aktif_dan_tidak_banned", func(t *testing.T) {
		db := newTestDB(t)
		productFixtures(t, db)
		app := newTestApp(db)
		r := call(t, app, "GET", "/api/u/tokobudi/products", nil)
		if r.Status != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", r.Status, r.Raw)
		}
		if strings.Contains(r.Raw, "Produk Nonaktif") || strings.Contains(r.Raw, "Produk Banned") {
			t.Errorf("katalog publik membocorkan produk nonaktif/banned: %s", r.Raw)
		}
		if !strings.Contains(r.Raw, "Kaos Merah") || !strings.Contains(r.Raw, "Kaos Hitam") {
			t.Errorf("produk aktif tidak muncul: %s", r.Raw)
		}
	})

	t.Run("status_all_diabaikan_di_katalog_publik", func(t *testing.T) {
		// status=all hanya berlaku untuk dashboard merchant (Locals "store").
		// Katalog publik harus tetap aktif-only walau query dimanipulasi.
		db := newTestDB(t)
		productFixtures(t, db)
		app := newTestApp(db)
		r := call(t, app, "GET", "/api/u/tokobudi/products?status=all", nil)
		if r.Status != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", r.Status, r.Raw)
		}
		if strings.Contains(r.Raw, "Produk Nonaktif") {
			t.Errorf("katalog publik membocorkan produk nonaktif via status=all: %s", r.Raw)
		}
		if strings.Contains(r.Raw, "Produk Banned") {
			t.Errorf("produk banned tidak boleh muncul walau status=all: %s", r.Raw)
		}
	})

	t.Run("merchant_view_status_all_menampilkan_nonaktif", func(t *testing.T) {
		db := newTestDB(t)
		st := productFixtures(t, db)
		prod := NewProductHandler(testCfg(), db)
		app := fiber.New(fiber.Config{DisableStartupMessage: true})
		app.Get("/merchant/products", func(c *fiber.Ctx) error {
			c.Locals("store", &st)
			return prod.Index(c)
		})
		r := call(t, app, "GET", "/merchant/products?status=all", nil)
		if r.Status != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", r.Status, r.Raw)
		}
		if !strings.Contains(r.Raw, "Produk Nonaktif") {
			t.Errorf("merchant view status=all harus menampilkan produk nonaktif: %s", r.Raw)
		}
		if strings.Contains(r.Raw, "Produk Banned") {
			t.Errorf("produk banned tidak boleh muncul di merchant view: %s", r.Raw)
		}
	})

	t.Run("merchant_view_status_archived", func(t *testing.T) {
		db := newTestDB(t)
		st := productFixtures(t, db)
		prod := NewProductHandler(testCfg(), db)
		app := fiber.New(fiber.Config{DisableStartupMessage: true})
		app.Get("/merchant/products", func(c *fiber.Ctx) error {
			c.Locals("store", &st)
			return prod.Index(c)
		})
		r := call(t, app, "GET", "/merchant/products?status=archived", nil)
		if r.Status != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", r.Status, r.Raw)
		}
		if !strings.Contains(r.Raw, "Produk Nonaktif") {
			t.Errorf("status=archived harus menampilkan produk nonaktif: %s", r.Raw)
		}
		if strings.Contains(r.Raw, "Kaos Merah") {
			t.Errorf("status=archived tidak boleh memuat produk aktif: %s", r.Raw)
		}
	})

	t.Run("search_dan_filter_class", func(t *testing.T) {
		db := newTestDB(t)
		productFixtures(t, db)
		app := newTestApp(db)
		r := call(t, app, "GET", "/api/u/tokobudi/products?search=merah", nil)
		if r.Status != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", r.Status, r.Raw)
		}
		if !strings.Contains(r.Raw, "Kaos Merah") || strings.Contains(r.Raw, "Kaos Hitam") {
			t.Errorf("filter search tidak bekerja: %s", r.Raw)
		}
	})

	t.Run("filter_class_tidak_cocok_kosong", func(t *testing.T) {
		db := newTestDB(t)
		productFixtures(t, db)
		app := newTestApp(db)
		r := call(t, app, "GET", "/api/u/tokobudi/products?class=Gadget%20%26%20Elektronik", nil)
		if r.Status != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", r.Status, r.Raw)
		}
		if strings.Contains(r.Raw, "Kaos Merah") {
			t.Errorf("filter class tidak menyaring: %s", r.Raw)
		}
	})
}

func TestProductShow_SQLite(t *testing.T) {
	t.Run("tidak_ditemukan_404", func(t *testing.T) {
		db := newTestDB(t)
		app := newTestApp(db)
		r := call(t, app, "GET", "/api/products/99999", nil)
		if r.Status != http.StatusNotFound {
			t.Fatalf("status = %d, want 404 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("aktif_200_dan_view_count_naik", func(t *testing.T) {
		db := newTestDB(t)
		st := productFixtures(t, db)
		app := newTestApp(db)
		var p models.Product
		db.Where("store_id = ? AND name = ?", st.ID, "Kaos Merah").First(&p)
		r := call(t, app, "GET", fmt.Sprintf("/api/products/%d", p.ID), nil)
		if r.Status != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", r.Status, r.Raw)
		}
		if r.Body["success"] != true {
			t.Errorf("success = %v, want true", r.Body["success"])
		}
		var after models.Product
		db.First(&after, p.ID)
		if after.ViewCount != p.ViewCount+1 {
			t.Errorf("view_count = %d, want %d", after.ViewCount, p.ViewCount+1)
		}
		// Store publik tidak boleh memuat kolom internal.
		storeView, _ := r.Body["store"].(map[string]any)
		if storeView != nil {
			for _, k := range []string{"is_blacklisted", "suspension_reason", "storage_used_bytes", "user_id"} {
				if _, ada := storeView[k]; ada {
					t.Errorf("field internal %q bocor di endpoint publik", k)
				}
			}
		}
	})

	t.Run("nonaktif_404_is_inactive", func(t *testing.T) {
		db := newTestDB(t)
		st := productFixtures(t, db)
		app := newTestApp(db)
		var p models.Product
		db.Where("store_id = ? AND name = ?", st.ID, "Produk Nonaktif").First(&p)
		r := call(t, app, "GET", fmt.Sprintf("/api/products/%d", p.ID), nil)
		if r.Status != http.StatusNotFound {
			t.Fatalf("status = %d, want 404 (%s)", r.Status, r.Raw)
		}
		if r.Body["is_inactive"] != true {
			t.Errorf("is_inactive = %v, want true (%s)", r.Body["is_inactive"], r.Raw)
		}
		var after models.Product
		db.First(&after, p.ID)
		if after.ViewCount != 0 {
			t.Errorf("view_count produk nonaktif berubah jadi %d", after.ViewCount)
		}
	})
}

// ---------------------------------------------------------------------------
// Store check-slug / featured
// ---------------------------------------------------------------------------

func TestStoreCheckSlug_SQLite(t *testing.T) {
	cases := []struct {
		name      string
		slug      string
		wantAvail bool
	}{
		{"terlalu_pendek", "ab", false},
		{"kata_kunci_sistem", "admin", false},
		{"nama_platform", "catavor", false},
		{"leetspeak_platform", "c4t4v0r", false},
		{"tersedia", "tokobudi", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			db := newTestDB(t)
			app := newTestApp(db)
			r := call(t, app, "GET", "/api/stores/check-slug/"+tc.slug, nil)
			if r.Status != http.StatusOK {
				t.Fatalf("status = %d, want 200 (%s)", r.Status, r.Raw)
			}
			got, _ := r.Body["available"].(bool)
			if got != tc.wantAvail {
				t.Errorf("available(%q) = %v, want %v (%s)", tc.slug, got, tc.wantAvail, r.Raw)
			}
		})
	}

	t.Run("slug_sudah_dipakai", func(t *testing.T) {
		db := newTestDB(t)
		u := models.User{Name: "Budi", Email: "budi@example.com"}
		if err := u.SetPassword("Rahasia123!"); err != nil {
			t.Fatalf("SetPassword: %v", err)
		}
		mustCreate(t, db, &u)
		mustCreate(t, db, &models.Store{UserID: u.ID, Slug: "tokobudi", StoreTitle: "Toko Budi"})
		app := newTestApp(db)
		r := call(t, app, "GET", "/api/stores/check-slug/tokobudi", nil)
		if got, _ := r.Body["available"].(bool); got {
			t.Errorf("slug terpakai dilaporkan tersedia: %s", r.Raw)
		}
	})

	t.Run("db_nil_503", func(t *testing.T) {
		app := newTestApp(nil)
		r := call(t, app, "GET", "/api/stores/check-slug/tokobudi", nil)
		if r.Status != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503 (%s)", r.Status, r.Raw)
		}
	})
}

func TestFeaturedStores_SQLite(t *testing.T) {
	t.Run("menyaring_toko_suspend_banned_blacklist", func(t *testing.T) {
		db := newTestDB(t)
		u := models.User{Name: "Budi", Email: "budi@example.com"}
		if err := u.SetPassword("Rahasia123!"); err != nil {
			t.Fatalf("SetPassword: %v", err)
		}
		mustCreate(t, db, &u)
		mustCreate(t, db, &models.Store{UserID: u.ID, Slug: "toko-aktif", StoreTitle: "Toko Aktif", DormancyStatus: "active"})
		mustCreate(t, db, &models.Store{UserID: u.ID, Slug: "toko-suspend", StoreTitle: "Toko Suspend", DormancyStatus: "suspended"})
		mustCreate(t, db, &models.Store{UserID: u.ID, Slug: "toko-banned", StoreTitle: "Toko Banned", DormancyStatus: "banned"})
		mustCreate(t, db, &models.Store{UserID: u.ID, Slug: "toko-purged", StoreTitle: "Toko Purged", DormancyStatus: "purged"})
		mustCreate(t, db, &models.Store{UserID: u.ID, Slug: "toko-blacklist", StoreTitle: "Toko Blacklist", IsBlacklisted: true})
		app := newTestApp(db)
		r := call(t, app, "GET", "/api/stores/featured", nil)
		if r.Status != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", r.Status, r.Raw)
		}
		for _, harus := range []string{"Toko Aktif"} {
			if !strings.Contains(r.Raw, harus) {
				t.Errorf("toko %q tidak muncul: %s", harus, r.Raw)
			}
		}
		for _, terlarang := range []string{"Toko Suspend", "Toko Banned", "Toko Purged", "Toko Blacklist"} {
			if strings.Contains(r.Raw, terlarang) {
				t.Errorf("toko %q seharusnya tersaring: %s", terlarang, r.Raw)
			}
		}
	})

	t.Run("db_nil_503", func(t *testing.T) {
		app := newTestApp(nil)
		r := call(t, app, "GET", "/api/stores/featured", nil)
		if r.Status != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503 (%s)", r.Status, r.Raw)
		}
	})

	t.Run("sorting_popularitas_dan_filter_tipe", func(t *testing.T) {
		db := newTestDB(t)
		u := models.User{Name: "Dewi", Email: "dewi@example.com"}
		_ = u.SetPassword("Rahasia123!")
		mustCreate(t, db, &u)

		mustCreate(t, db, &models.Store{
			UserID:             u.ID,
			Slug:               "toko-fauna-populer",
			StoreTitle:         "Toko Fauna Populer",
			DormancyStatus:     "active",
			ViewCount:          500,
			TotalActionsCount:  50,
			PrimaryProductType: "fauna",
			IsFeatured:         true,
		})
		mustCreate(t, db, &models.Store{
			UserID:             u.ID,
			Slug:               "toko-food-sedang",
			StoreTitle:         "Toko Food Sedang",
			DormancyStatus:     "active",
			ViewCount:          200,
			TotalActionsCount:  20,
			PrimaryProductType: "food",
		})
		mustCreate(t, db, &models.Store{
			UserID:             u.ID,
			Slug:               "toko-fauna-baru",
			StoreTitle:         "Toko Fauna Baru",
			DormancyStatus:     "active",
			ViewCount:          10,
			TotalActionsCount:  1,
			PrimaryProductType: "fauna",
		})

		app := newTestApp(db)

		// 1. Filter by product_type=fauna
		rFauna := call(t, app, "GET", "/api/stores/featured?product_type=fauna", nil)
		if rFauna.Status != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", rFauna.Status, rFauna.Raw)
		}
		if !strings.Contains(rFauna.Raw, "Toko Fauna Populer") || !strings.Contains(rFauna.Raw, "Toko Fauna Baru") {
			t.Errorf("toko fauna seharusnya muncul: %s", rFauna.Raw)
		}
		if strings.Contains(rFauna.Raw, "Toko Food Sedang") {
			t.Errorf("toko food tidak boleh muncul di filter fauna: %s", rFauna.Raw)
		}

		// 2. Default sort (popularitas): Toko Fauna Populer (500 views) harus mendahului Toko Fauna Baru (10 views)
		idxPopuler := strings.Index(rFauna.Raw, "Toko Fauna Populer")
		idxBaru := strings.Index(rFauna.Raw, "Toko Fauna Baru")
		if idxPopuler == -1 || idxBaru == -1 || idxPopuler > idxBaru {
			t.Errorf("urutan salah, harusnya toko populer (500 views) lebih dulu dari toko baru (10 views): %s", rFauna.Raw)
		}
	})
}

func TestProducts_PopularitySorting_SQLite(t *testing.T) {
	db := newTestDB(t)
	u := models.User{Name: "Siti", Email: "siti@example.com"}
	_ = u.SetPassword("Rahasia123!")
	mustCreate(t, db, &u)

	store := models.Store{UserID: u.ID, Slug: "store-test", StoreTitle: "Store Test", DormancyStatus: "active"}
	mustCreate(t, db, &store)

	mustCreate(t, db, &models.Product{
		StoreID:         store.ID,
		Name:            "Kucing Persia Populer",
		Class:           "Mamalia",
		Habitat:         "Darat",
		ProductType:     "fauna",
		Price:           1500000,
		IsActive:        true,
		ViewCount:       1000,
		WaClicksCount:   50,
		PopularityScore: 1150, // 1000 + 50*3
	})
	mustCreate(t, db, &models.Product{
		StoreID:         store.ID,
		Name:            "Kucing Kampung Biasa",
		Class:           "Mamalia",
		Habitat:         "Darat",
		ProductType:     "fauna",
		Price:           100000,
		IsActive:        true,
		ViewCount:       50,
		WaClicksCount:   2,
		PopularityScore: 56, // 50 + 2*3
	})
	mustCreate(t, db, &models.Product{
		StoreID:         store.ID,
		Name:            "Ikan Cupang Laris",
		Class:           "Pisces",
		Habitat:         "Air Tawar",
		ProductType:     "fauna",
		Price:           50000,
		IsActive:        true,
		ViewCount:       300,
		WaClicksCount:   200, // Highest orders
		PopularityScore: 900,
	})

	app := newTestApp(db)

	t.Run("sort_popular", func(t *testing.T) {
		r := call(t, app, "GET", "/api/products?sort=popular", nil)
		if r.Status != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", r.Status, r.Raw)
		}
		idxPersia := strings.Index(r.Raw, "Kucing Persia Populer")
		idxCupang := strings.Index(r.Raw, "Ikan Cupang Laris")
		idxKampung := strings.Index(r.Raw, "Kucing Kampung Biasa")

		if idxPersia > idxCupang || idxCupang > idxKampung {
			t.Errorf("urutan salah untuk sort=popular: %s", r.Raw)
		}
	})

	t.Run("sort_best_seller", func(t *testing.T) {
		r := call(t, app, "GET", "/api/products?sort=best_seller", nil)
		if r.Status != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", r.Status, r.Raw)
		}
		idxCupang := strings.Index(r.Raw, "Ikan Cupang Laris")
		idxPersia := strings.Index(r.Raw, "Kucing Persia Populer")

		if idxCupang > idxPersia {
			t.Errorf("Ikan Cupang (200 wa clicks) harus mendahului Kucing Persia (50 wa clicks): %s", r.Raw)
		}
	})

	t.Run("sort_most_viewed", func(t *testing.T) {
		r := call(t, app, "GET", "/api/products?sort=most_viewed", nil)
		if r.Status != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", r.Status, r.Raw)
		}
		idxPersia := strings.Index(r.Raw, "Kucing Persia Populer")
		idxCupang := strings.Index(r.Raw, "Ikan Cupang Laris")

		if idxPersia > idxCupang {
			t.Errorf("Kucing Persia (1000 views) harus mendahului Ikan Cupang (300 views): %s", r.Raw)
		}
	})
}
