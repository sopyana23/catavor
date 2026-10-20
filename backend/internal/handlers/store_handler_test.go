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
	for _, s := range []string{"", "   ", "	", "\n"} {
		if !IsReservedSlug(s) {
			t.Errorf("IsReservedSlug(%q) = false, want true (kosong ditolak)", s)
		}
	}
}

// TestIsReservedSlug_SetelahCleanSlug menguji rantai yang BENAR-BENAR dipakai
// handler: cleanSlug() dulu, baru IsReservedSlug(). Test di atas memanggil
// IsReservedSlug dengan slug mentah, sehingga tidak pernah menangkap kasus
// "@" yang sudah dinormalisasi menjadi "-" oleh cleanSlug.
//
// Regresi di sini berarti merchant bisa mendaftarkan slug yang terbaca sebagai
// merek platform di URL (impersonasi visual), mis. "c-tavor".
func TestIsReservedSlug_SetelahCleanSlug(t *testing.T) {
	reserved := []string{
		// pemisah disisipkan di tengah merek → vokal hilang setelah "-" dibuang
		"c@tavor", "cat@vor", "c@t@vor", "c@tav0r", "k@tavor", "cata@or",
		"c-tavor", "cat-vor", "c-t-vor", "c-a-t-a-v-o-r", "k@t@v0r",
		// bentuk yang sudah tertangkap sebelum perbaikan (jaga agar tetap tertangkap)
		"catavor", "c@t@v0r", "catav0r", "c4t4v0r", "mycatavor", "catavor-x",
		"cata_vor", "c.at.a.v.o.r",
	}
	for _, s := range reserved {
		got := IsReservedSlug(cleanSlug(s))
		if !got {
			t.Errorf("IsReservedSlug(cleanSlug(%q)) = false (clean=%q), want true", s, cleanSlug(s))
		}
	}

	// Penjaga false positive: kata sah yang kebetulan mirip huruf merek TIDAK
	// boleh ikut terblokir. Batas selisih 2 karakter di isBrandSubsequence
	// yang mencegahnya.
	allowed := []string{
		"cutover", "cavort", "captor", "castor", "creator", "carnivore",
		"toko-burung", "faunashop", "kandangku", "petlover", "birdhouse",
		"cakrawala", "catering", "katalog", "vitamin", "avocado",
	}
	for _, s := range allowed {
		if IsReservedSlug(cleanSlug(s)) {
			t.Errorf("IsReservedSlug(cleanSlug(%q)) = true (clean=%q), want false — false positive", s, cleanSlug(s))
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
	app.Get("/admin/stores", actor, h.AdminListStores)
	app.Get("/admin/stores/:id", actor, h.AdminGetStoreDetail)
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

// ---------------------------------------------------------------------------
// AdminListStores & AdminGetStoreDetail — audit kepatuhan isolasi status & paginasi
// ---------------------------------------------------------------------------

func TestAdminListStores_IsolationAndPagination_SQLite(t *testing.T) {
	db := newTestDB(t)
	app := storeApp(t, db)

	// Seed Users
	u1 := models.User{ID: 101, Name: "Owner Satu", Email: "owner1@example.com"}
	u2 := models.User{ID: 102, Name: "Owner Dua", Email: "owner2@example.com"}
	u3 := models.User{ID: 103, Name: "Pelanggar Toko", Email: "banned@example.com"}
	db.Create(&u1)
	db.Create(&u2)
	db.Create(&u3)

	// Seed Stores: 2 Active, 1 Suspended, 1 Banned
	s1 := models.Store{UserID: 101, Slug: "toko-aktif-satu", StoreTitle: "Toko Aktif Satu", Plan: "free", DormancyStatus: "active", IsSuspended: false, IsBlacklisted: false}
	s2 := models.Store{UserID: 102, Slug: "toko-aktif-dua", StoreTitle: "Toko Aktif Dua Pro", Plan: "pro_starter", DormancyStatus: "active", IsSuspended: false, IsBlacklisted: false}
	s3 := models.Store{UserID: 103, Slug: "toko-suspended", StoreTitle: "Toko Suspended", Plan: "free", DormancyStatus: "suspended", IsSuspended: true, SuspensionReason: "Pelanggaran konten satwa"}
	s4 := models.Store{UserID: 103, Slug: "toko-banned", StoreTitle: "Toko Banned", Plan: "free", DormancyStatus: "banned", IsBlacklisted: true, SuspensionReason: "Penipuan transaksi"}
	db.Create(&s1)
	db.Create(&s2)
	db.Create(&s3)
	db.Create(&s4)

	// Seed some products for s1
	p1 := models.Product{StoreID: s1.ID, Name: "Produk Unggulan Satu", Price: 50000}
	p2 := models.Product{StoreID: s1.ID, Name: "Produk Unggulan Dua", Price: 75000}
	db.Create(&p1)
	db.Create(&p2)

	t.Run("default_active_stores_only", func(t *testing.T) {
		code, resp := storeReq(t, app, "GET", "/admin/stores?status=active", "", map[string]string{"X-Test-Actor": "staff"})
		if code != 200 {
			t.Fatalf("status = %d, want 200 (resp: %v)", code, resp)
		}
		data, ok := resp["data"].([]any)
		if !ok || len(data) != 2 {
			t.Fatalf("expected 2 active stores, got %d (%v)", len(data), resp)
		}
		// Pastikan toko suspended/banned tidak masuk
		for _, item := range data {
			m := item.(map[string]any)
			slug := m["slug"].(string)
			if slug == "toko-suspended" || slug == "toko-banned" {
				t.Errorf("toko pelanggaran/banned %s bocor ke daftar aktif!", slug)
			}
		}
	})

	t.Run("isolated_banned_stores_only", func(t *testing.T) {
		code, resp := storeReq(t, app, "GET", "/admin/stores?status=banned", "", map[string]string{"X-Test-Actor": "staff"})
		if code != 200 {
			t.Fatalf("status = %d, want 200 (resp: %v)", code, resp)
		}
		data, ok := resp["data"].([]any)
		if !ok || len(data) != 2 {
			t.Fatalf("expected 2 banned/suspended stores, got %d (%v)", len(data), resp)
		}
		for _, item := range data {
			m := item.(map[string]any)
			slug := m["slug"].(string)
			if slug == "toko-aktif-satu" || slug == "toko-aktif-dua" {
				t.Errorf("toko aktif %s masuk ke daftar banned!", slug)
			}
		}
	})

	t.Run("server_side_search", func(t *testing.T) {
		code, resp := storeReq(t, app, "GET", "/admin/stores?status=active&q=Pro", "", map[string]string{"X-Test-Actor": "staff"})
		if code != 200 {
			t.Fatalf("status = %d, want 200", code)
		}
		data, ok := resp["data"].([]any)
		if !ok || len(data) != 1 {
			t.Fatalf("expected 1 search result, got %d", len(data))
		}
		m := data[0].(map[string]any)
		if m["slug"] != "toko-aktif-dua" {
			t.Errorf("slug = %v, want toko-aktif-dua", m["slug"])
		}
	})

	t.Run("server_side_plan_filter", func(t *testing.T) {
		code, resp := storeReq(t, app, "GET", "/admin/stores?status=active&plan=pro_starter", "", map[string]string{"X-Test-Actor": "staff"})
		if code != 200 {
			t.Fatalf("status = %d, want 200", code)
		}
		data, ok := resp["data"].([]any)
		if !ok || len(data) != 1 {
			t.Fatalf("expected 1 pro_starter store, got %d", len(data))
		}
	})

	t.Run("server_side_numbered_pagination", func(t *testing.T) {
		code, resp := storeReq(t, app, "GET", "/admin/stores?status=active&page=1&limit=1", "", map[string]string{"X-Test-Actor": "staff"})
		if code != 200 {
			t.Fatalf("status = %d, want 200", code)
		}
		data, ok := resp["data"].([]any)
		if !ok || len(data) != 1 {
			t.Fatalf("expected 1 store for page 1 limit 1, got %d", len(data))
		}
		pag, ok := resp["pagination"].(map[string]any)
		if !ok {
			t.Fatalf("missing pagination object: %v", resp)
		}
		if int(pag["total"].(float64)) != 2 {
			t.Errorf("total = %v, want 2", pag["total"])
		}
		if int(pag["total_pages"].(float64)) != 2 {
			t.Errorf("total_pages = %v, want 2", pag["total_pages"])
		}
	})

	t.Run("store_detail_inspection", func(t *testing.T) {
		code, resp := storeReq(t, app, "GET", "/admin/stores/"+itoa(s1.ID), "", map[string]string{"X-Test-Actor": "staff"})
		if code != 200 {
			t.Fatalf("status = %d, want 200 (resp: %v)", code, resp)
		}
		data, ok := resp["data"].(map[string]any)
		if !ok {
			t.Fatalf("expected data object, got %v", resp)
		}
		if data["slug"] != "toko-aktif-satu" {
			t.Errorf("slug = %v, want toko-aktif-satu", data["slug"])
		}
		if int(resp["products_count"].(float64)) != 2 {
			t.Errorf("products_count = %v, want 2", resp["products_count"])
		}
		topProducts, ok := resp["top_products"].([]any)
		if !ok || len(topProducts) != 2 {
			t.Errorf("expected 2 top products, got %d", len(topProducts))
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
