package handlers

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"catavor-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// IsReservedSlug — aturan penamaan platform ("catavor" = nama platform, bukan
// URL admin). Ini murni fungsi, jadi diuji tabel penuh tanpa DB. Regresi di
// sini berarti toko bisa menduduki slug brand/platform.
// ---------------------------------------------------------------------------

func TestIsReservedSlug(t *testing.T) {
	reserved := []string{
		// exact match dari daftar sistem
		"catavor", "admin", "platform", "system", "api", "login", "register",
		"dashboard", "support", "help", "bantuan", "terms", "privacy",
		"explore", "directory", "internal", "staff", "settings", "billing",
		"superadmin", "official", "catavor-official", "catavor-admin",
		// variasi merek / salah ketik
		"catafor", "katavor", "katafor", "catabor", "katabor",
		// leetspeak & pemisah
		"catav0r", "c4t4v0r", "c.at.a.v.o.r", "cata_vor", "cat avor", "cat/avor",
		"c@t@v0r",
		// prefix/suffix brand
		"catavor-official", "my-catavor", "catavorx", "xcatavor",
		"catavor.id", "catavorstore",
		// kapital & spasi tepi
		"  CATAVOR  ", "Admin",
	}
	for _, s := range reserved {
		if !IsReservedSlug(s) {
			t.Errorf("IsReservedSlug(%q) = false, want true", s)
		}
	}

	allowed := []string{
		"toko-burung", "faunashop", "kandangku", "petlover", "aquarium-nusantara",
		"xyz", "toko123", "birdhouse", "meong", "sultan-fauna",
	}
	for _, s := range allowed {
		if IsReservedSlug(s) {
			t.Errorf("IsReservedSlug(%q) = true, want false", s)
		}
	}

	// String kosong / spasi saja tidak boleh dianggap slug sah.
	for _, s := range []string{"", "   ", "\t", "\n"} {
		if !IsReservedSlug(s) {
			t.Errorf("IsReservedSlug(%q) = false, want true (kosong ditolak)", s)
		}
	}
}

// ---------------------------------------------------------------------------
// Harness: Fiber + Locals injection untuk handler toko.
// ---------------------------------------------------------------------------

// storeApp memasang handler toko. Locals("user")/Locals("store") diisi oleh
// middleware uji sesuai header, sehingga gerbang otorisasi di dalam handler
// benar-benar dieksekusi.
func storeApp(t *testing.T, db *gorm.DB) *fiber.App {
	t.Helper()
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	h := NewStoreHandler(db, testCfg())

	actor := func(c *fiber.Ctx) error {
		switch c.Get("X-Test-Actor") {
		case "owner":
			c.Locals("user", &models.User{ID: 10, Name: "Pemilik", Email: "owner@example.com", PlatformRole: "merchant"})
		case "other":
			c.Locals("user", &models.User{ID: 11, Name: "Orang Lain", Email: "other@example.com", PlatformRole: "merchant"})
		case "staff":
			c.Locals("user", &models.User{ID: 1, Name: "Staf", Email: "staff@example.com", PlatformRole: "support"})
		}
		// Locals("store") ditiru dari middleware store-scope: toko yang sedang aktif.
		if raw := c.Get("X-Test-Store-Slug"); raw != "" {
			var s models.Store
			if err := db.Where("LOWER(slug) = ?", strings.ToLower(raw)).First(&s).Error; err == nil {
				c.Locals("store", &s)
			}
		}
		return c.Next()
	}

	app.Get("/stores/:slug", h.ShowStore)
	app.Get("/stores/check-slug/:slug", h.CheckSlug)
	app.Put("/stores/profile", actor, h.UpdateStore)
	app.Delete("/stores/:id", actor, h.DeleteStore)
	return app
}

func storeReq(t *testing.T, app *fiber.App, method, target, body string, headers map[string]string) (int, map[string]any) {
	t.Helper()
	var rdr io.Reader
	if body != "" {
		rdr = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, target, rdr)
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("%s %s: %v", method, target, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	out := map[string]any{}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &out)
	}
	return resp.StatusCode, out
}

func seedStore(t *testing.T, db *gorm.DB, userID uint, slug, title string) models.Store {
	t.Helper()
	s := models.Store{
		UserID:     userID,
		Slug:       slug,
		StoreTitle: title,
	}
	if err := db.Create(&s).Error; err != nil {
		t.Fatalf("seed store %q: %v", slug, err)
	}
	return s
}

// ---------------------------------------------------------------------------
// ShowStore — katalog publik
// ---------------------------------------------------------------------------

func TestStoreShowStore_SQLite(t *testing.T) {
	t.Run("db_nil_503", func(t *testing.T) {
		app := storeApp(t, nil)
		code, _ := storeReq(t, app, "GET", "/stores/toko-burung", "", nil)
		if code != 503 {
			t.Fatalf("status = %d, want 503", code)
		}
	})

	db := newTestDB(t)
	app := storeApp(t, db)
	seedStore(t, db, 10, "toko-burung", "Toko Burung")

	t.Run("slug_tidak_ada_404", func(t *testing.T) {
		code, body := storeReq(t, app, "GET", "/stores/tidak-ada", "", nil)
		if code != 404 {
			t.Fatalf("status = %d, want 404 (body %v)", code, body)
		}
	})

	t.Run("toko_aktif_200", func(t *testing.T) {
		code, body := storeReq(t, app, "GET", "/stores/toko-burung", "", nil)
		if code != 200 {
			t.Fatalf("status = %d, want 200 (body %v)", code, body)
		}
		data, _ := body["data"].(map[string]any)
		if data == nil {
			t.Fatalf("data hilang: %v", body)
		}
		if got, _ := data["slug"].(string); got != "toko-burung" {
			t.Errorf("slug = %q, want toko-burung", got)
		}
	})

	t.Run("slug_kata_kunci_tetap_terbaca", func(t *testing.T) {
		// N-21: reserved slug hanya aturan penamaan, bukan syarat lookup.
		// Toko lama yang terlanjur memakai slug mengandung merek harus tetap
		// dapat dibaca publik, bukan 404.
		seedStore(t, db, 10, "catavor", "Toko Lama")
		code, body := storeReq(t, app, "GET", "/stores/catavor", "", nil)
		if code != 200 {
			t.Fatalf("status = %d, want 200 (body %v)", code, body)
		}
	})

	t.Run("blacklist_404", func(t *testing.T) {
		seedStore(t, db, 10, "toko-banned", "Toko Banned")
		if err := db.Create(&models.BlacklistedSlug{Slug: "toko-banned"}).Error; err != nil {
			t.Fatalf("seed blacklist: %v", err)
		}
		code, body := storeReq(t, app, "GET", "/stores/toko-banned", "", nil)
		if code != 404 {
			t.Fatalf("status = %d, want 404 (body %v)", code, body)
		}
		if c, _ := body["code"].(string); c != "STORE_BANNED" {
			t.Errorf("code = %q, want STORE_BANNED", c)
		}
	})

	t.Run("dormancy_banned_404", func(t *testing.T) {
		s := seedStore(t, db, 10, "toko-purged", "Toko Purged")
		db.Model(&models.Store{}).Where("id = ?", s.ID).Update("dormancy_status", "banned")
		code, _ := storeReq(t, app, "GET", "/stores/toko-purged", "", nil)
		if code != 404 {
			t.Fatalf("status = %d, want 404", code)
		}
	})

	t.Run("suspended_200_dengan_metadata", func(t *testing.T) {
		s := seedStore(t, db, 10, "toko-suspend", "Toko Suspend")
		db.Model(&models.Store{}).Where("id = ?", s.ID).
			Updates(map[string]any{"dormancy_status": "suspended", "is_suspended": true})
		code, body := storeReq(t, app, "GET", "/stores/toko-suspend", "", nil)
		if code != 200 {
			t.Fatalf("status = %d, want 200 (body %v)", code, body)
		}
		if susp, _ := body["is_suspended"].(bool); !susp {
			t.Errorf("is_suspended = false, want true (body %v)", body)
		}
		data, _ := body["data"].(map[string]any)
		if reason, _ := data["suspension_reason"].(string); reason == "" || reason == "none" {
			t.Errorf("suspension_reason = %q, want alasan yang dapat ditampilkan", reason)
		}
	})
}

// ---------------------------------------------------------------------------
// CheckSlug — gerbang penamaan
// ---------------------------------------------------------------------------

// Catatan: TestStoreCheckSlug_SQLite (harness bersama) menguji jalur dasar;
// di sini fokus pada aturan penamaan: reserved, leetspeak, blacklist, panjang.
func TestStoreCheckSlugRules_SQLite(t *testing.T) {
	db := newTestDB(t)
	app := storeApp(t, db)
	seedStore(t, db, 10, "sudah-dipakai", "Toko")

	cases := []struct {
		name        string
		slug        string
		wantStatus  int
		wantAvail   bool
		wantMessage string
	}{
		{"terlalu_pendek", "ab", 200, false, "minimal 3 karakter"},
		{"reserved", "catavor", 200, false, "dicadangkan"},
		{"leetspeak_reserved", "c4t4v0r", 200, false, "dicadangkan"},
		{"sudah_dipakai", "sudah-dipakai", 200, false, "sudah terpakai"},
		{"tersedia", "toko-baru", 200, true, "tersedia"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			code, body := storeReq(t, app, "GET", "/stores/check-slug/"+tc.slug, "", nil)
			if code != tc.wantStatus {
				t.Fatalf("status = %d, want %d (body %v)", code, tc.wantStatus, body)
			}
			if avail, _ := body["available"].(bool); avail != tc.wantAvail {
				t.Errorf("available = %v, want %v (body %v)", avail, tc.wantAvail, body)
			}
			msg, _ := body["message"].(string)
			if !strings.Contains(strings.ToLower(msg), strings.ToLower(tc.wantMessage)) {
				t.Errorf("message = %q, want mengandung %q", msg, tc.wantMessage)
			}
		})
	}

	t.Run("blacklist_ditolak", func(t *testing.T) {
		if err := db.Create(&models.BlacklistedSlug{Slug: "slug-terlarang"}).Error; err != nil {
			t.Fatalf("seed blacklist: %v", err)
		}
		code, body := storeReq(t, app, "GET", "/stores/check-slug/slug-terlarang", "", nil)
		if code != 200 {
			t.Fatalf("status = %d, want 200", code)
		}
		if avail, _ := body["available"].(bool); avail {
			t.Errorf("available = true untuk slug blacklist (body %v)", body)
		}
	})

	t.Run("db_nil_503", func(t *testing.T) {
		nilApp := storeApp(t, nil)
		code, _ := storeReq(t, nilApp, "GET", "/stores/check-slug/toko-baru", "", nil)
		if code != 503 {
			t.Fatalf("status = %d, want 503", code)
		}
	})
}

// ---------------------------------------------------------------------------
// UpdateStore — sanitasi input + penolakan slug + mass assignment
// ---------------------------------------------------------------------------

func TestStoreUpdateProfile_SQLite(t *testing.T) {
	db := newTestDB(t)
	app := storeApp(t, db)
	own := seedStore(t, db, 10, "toko-ku", "Toko Awal")
	seedStore(t, db, 11, "toko-lain", "Toko Lain")

	withStore := func(actor, slug string) map[string]string {
		return map[string]string{"X-Test-Actor": actor, "X-Test-Store-Slug": slug}
	}

	t.Run("payload_rusak_400", func(t *testing.T) {
		code, _ := storeReq(t, app, "PUT", "/stores/profile", "{bukan json", withStore("owner", "toko-ku"))
		if code != 400 {
			t.Fatalf("status = %d, want 400", code)
		}
	})

	t.Run("slug_reserved_422", func(t *testing.T) {
		for _, slug := range []string{"catavor", "admin", "c4t4v0r"} {
			code, body := storeReq(t, app, "PUT", "/stores/profile",
				`{"slug":"`+slug+`"}`, withStore("owner", "toko-ku"))
			if code != 422 {
				t.Errorf("slug %q: status = %d, want 422 (body %v)", slug, code, body)
			}
		}
	})

	t.Run("slug_terlalu_pendek_422", func(t *testing.T) {
		code, body := storeReq(t, app, "PUT", "/stores/profile", `{"slug":"ab"}`, withStore("owner", "toko-ku"))
		if code != 422 {
			t.Fatalf("status = %d, want 422 (body %v)", code, body)
		}
	})

	t.Run("slug_milik_toko_lain_422", func(t *testing.T) {
		code, body := storeReq(t, app, "PUT", "/stores/profile", `{"slug":"toko-lain"}`, withStore("owner", "toko-ku"))
		if code != 422 {
			t.Fatalf("status = %d, want 422 (body %v)", code, body)
		}
	})

	t.Run("slug_blacklist_422", func(t *testing.T) {
		if err := db.Create(&models.BlacklistedSlug{Slug: "slug-haram"}).Error; err != nil {
			t.Fatalf("seed blacklist: %v", err)
		}
		code, body := storeReq(t, app, "PUT", "/stores/profile", `{"slug":"slug-haram"}`, withStore("owner", "toko-ku"))
		if code != 422 {
			t.Fatalf("status = %d, want 422 (body %v)", code, body)
		}
	})

	t.Run("field_di_luar_whitelist_diabaikan", func(t *testing.T) {
		// Mass assignment: user_id, is_blacklisted, plan, is_suspended bukan
		// bagian dari payload profil dan tidak boleh ikut tersimpan.
		body := `{"user_id":999,"is_blacklisted":true,"is_suspended":true,` +
			`"plan":"enterprise","dormancy_status":"active","storage_used_bytes":0,` +
			`"store_title":"Judul Baru"}`
		code, resp := storeReq(t, app, "PUT", "/stores/profile", body, withStore("owner", "toko-ku"))
		if code != 200 {
			t.Fatalf("status = %d, want 200 (resp %v)", code, resp)
		}

		var got models.Store
		if err := db.First(&got, own.ID).Error; err != nil {
			t.Fatalf("reload store: %v", err)
		}
		if got.UserID != 10 {
			t.Errorf("user_id berubah jadi %d, want 10 (mass assignment bocor)", got.UserID)
		}
		if got.IsBlacklisted {
			t.Error("is_blacklisted terset true dari payload (mass assignment bocor)")
		}
		if got.IsSuspended {
			t.Error("is_suspended terset true dari payload (mass assignment bocor)")
		}
		if got.Plan != "free" {
			t.Errorf("plan berubah jadi %q, want free", got.Plan)
		}
		if got.StoreTitle != "Judul Baru" {
			t.Errorf("store_title = %q, want 'Judul Baru'", got.StoreTitle)
		}
	})

	t.Run("skrip_dinamis_disaring", func(t *testing.T) {
		body := `{"promo_banner":"<script>alert(1)</script>Promo","about_description":"<img src=x onerror=alert(1)>Halo"}`
		code, resp := storeReq(t, app, "PUT", "/stores/profile", body, withStore("owner", "toko-ku"))
		if code != 200 {
			t.Fatalf("status = %d, want 200 (resp %v)", code, resp)
		}
		var got models.Store
		if err := db.First(&got, own.ID).Error; err != nil {
			t.Fatalf("reload store: %v", err)
		}
		for field, val := range map[string]string{
			"promo_banner":      got.PromoBanner,
			"about_description": got.AboutDescription,
		} {
			low := strings.ToLower(val)
			if strings.Contains(low, "<script") || strings.Contains(low, "onerror=") {
				t.Errorf("%s masih memuat vektor XSS: %q", field, val)
			}
		}
	})

	t.Run("url_javascript_ditolak", func(t *testing.T) {
		body := `{"official_website":"javascript:alert(1)","store_logo_url":"javascript:alert(2)"}`
		code, resp := storeReq(t, app, "PUT", "/stores/profile", body, withStore("owner", "toko-ku"))
		if code != 200 {
			t.Fatalf("status = %d, want 200 (resp %v)", code, resp)
		}
		var got models.Store
		if err := db.First(&got, own.ID).Error; err != nil {
			t.Fatalf("reload store: %v", err)
		}
		if strings.HasPrefix(strings.ToLower(got.OfficialWebsite), "javascript:") {
			t.Errorf("official_website = %q, want disaring", got.OfficialWebsite)
		}
		if strings.HasPrefix(strings.ToLower(got.StoreLogoURL), "javascript:") {
			t.Errorf("store_logo_url = %q, want disaring", got.StoreLogoURL)
		}
	})

	t.Run("slug_baru_sah_tersimpan", func(t *testing.T) {
		code, resp := storeReq(t, app, "PUT", "/stores/profile", `{"slug":"toko-baru-ku"}`, withStore("owner", "toko-ku"))
		if code != 200 {
			t.Fatalf("status = %d, want 200 (resp %v)", code, resp)
		}
		var got models.Store
		if err := db.First(&got, own.ID).Error; err != nil {
			t.Fatalf("reload store: %v", err)
		}
		if got.Slug != "toko-baru-ku" {
			t.Errorf("slug = %q, want toko-baru-ku", got.Slug)
		}
	})
}

// ---------------------------------------------------------------------------
// DeleteStore — otorisasi kepemilikan sebelum transaksi destruktif
// ---------------------------------------------------------------------------

func TestStoreDelete_SQLite(t *testing.T) {
	t.Run("db_nil_503", func(t *testing.T) {
		app := storeApp(t, nil)
		code, _ := storeReq(t, app, "DELETE", "/stores/1", `{}`, map[string]string{"X-Test-Actor": "owner"})
		if code != 503 {
			t.Fatalf("status = %d, want 503", code)
		}
	})

	db := newTestDB(t)
	app := storeApp(t, db)
	own := seedStore(t, db, 10, "toko-hapus", "Toko Hapus")
	otherStore := seedStore(t, db, 99, "toko-orang-lain", "Toko Lain")

	t.Run("id_tidak_valid_400", func(t *testing.T) {
		for _, id := range []string{"abc", "0", "-5"} {
			code, _ := storeReq(t, app, "DELETE", "/stores/"+id, `{}`, map[string]string{"X-Test-Actor": "owner"})
			if code != 400 {
				t.Errorf("id %q: status = %d, want 400", id, code)
			}
		}
	})

	t.Run("tidak_ada_404", func(t *testing.T) {
		code, _ := storeReq(t, app, "DELETE", "/stores/99999", `{}`, map[string]string{"X-Test-Actor": "owner"})
		if code != 404 {
			t.Fatalf("status = %d, want 404", code)
		}
	})

	t.Run("bukan_pemilik_403", func(t *testing.T) {
		code, body := storeReq(t, app, "DELETE", "/stores/"+itoa(otherStore.ID),
			`{"confirm_slug":"toko-orang-lain"}`, map[string]string{"X-Test-Actor": "other"})
		if code != 403 {
			t.Fatalf("status = %d, want 403 (body %v)", code, body)
		}
		// Bukti: toko tidak boleh tersentuh.
		var count int64
		db.Model(&models.Store{}).Where("id = ?", otherStore.ID).Count(&count)
		if count != 1 {
			t.Fatalf("toko terhapus oleh non-pemilik (count=%d)", count)
		}
	})

	t.Run("tanpa_aktor_403", func(t *testing.T) {
		code, _ := storeReq(t, app, "DELETE", "/stores/"+itoa(otherStore.ID), `{}`, nil)
		if code != 401 {
			t.Fatalf("status = %d, want 401 (Locals user kosong harus ditolak, bukan panic)", code)
		}
	})

	t.Run("konfirmasi_slug_salah_400", func(t *testing.T) {
		code, body := storeReq(t, app, "DELETE", "/stores/"+itoa(own.ID),
			`{"confirm_slug":"slug-ngawur"}`, map[string]string{"X-Test-Actor": "owner"})
		if code != 400 {
			t.Fatalf("status = %d, want 400 (body %v)", code, body)
		}
		var count int64
		db.Model(&models.Store{}).Where("id = ?", own.ID).Count(&count)
		if count != 1 {
			t.Fatalf("toko terhapus walau konfirmasi salah (count=%d)", count)
		}
	})
}

func itoa(u uint) string {
	if u == 0 {
		return "0"
	}
	var b [20]byte
	i := len(b)
	for u > 0 {
		i--
		b[i] = byte('0' + u%10)
		u /= 10
	}
	return string(b[i:])
}
