package handlers

import (
	"strconv"
	"strings"
	"testing"

	"catavor-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// merchantApp memasang ProductHandler dengan Locals yang biasanya diisi
// AuthRequired + StoreOwnerRequired: c.Locals("store") dan c.Locals("user").
func merchantApp(db *gorm.DB, st *models.Store, u *models.User) *fiber.App {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	ph := NewProductHandler(testCfg(), db)
	inject := func(c *fiber.Ctx) error {
		c.Locals("store", st)
		c.Locals("store_id", st.ID)
		c.Locals("user", u)
		c.Locals("user_id", u.ID)
		return c.Next()
	}
	app.Post("/products", inject, ph.Store)
	app.Put("/products/:id", inject, ph.Update)
	app.Delete("/products/:id", inject, ph.Destroy)
	return app
}

// merchantFixtures menyiapkan user + toko + paket free. Paket wajib ada karena
// ProductHandler.Store memanggil services.CanAddProduct -> GetStoreQuotaInfo.
func merchantFixtures(t *testing.T, db *gorm.DB) (*models.User, *models.Store) {
	t.Helper()
	plan := &models.SubscriptionPlan{
		Code:              "free",
		Name:              "Free",
		PriceMonthly:      0,
		PriceAnnual:       0,
		MaxItems:          -1,
		StorageLimitBytes: 0,
		IsActive:          true,
	}
	mustCreate(t, db, plan)

	u := &models.User{
		Name:     "Budi Pemilik",
		Email:    "budi@toko.test",
		Password: "x",
	}
	mustCreate(t, db, u)

	st := &models.Store{
		UserID:     u.ID,
		Slug:       "tokobudi",
		StoreTitle: "Toko Budi",
		Plan:       "free",
		PlanStatus: "active",
	}
	mustCreate(t, db, st)
	return u, st
}

// ---------------------------------------------------------------------------
// Product.Store — pembuatan produk oleh merchant
// ---------------------------------------------------------------------------

func TestProductStore_SQLite(t *testing.T) {
	t.Run("sukses_dengan_sanitasi_dan_kategori_otomatis", func(t *testing.T) {
		db := newTestDB(t)
		u, st := merchantFixtures(t, db)
		app := merchantApp(db, st, u)

		r := call(t, app, "POST", "/products", map[string]any{
			"name":         "  Kaos  Merah  ",
			"class":        "Pakaian & Busana",
			"price":        75000,
			"product_type": "physical",
			"description":  "<script>alert(1)</script>Bahan katun",
			"min_order":    0,
		})
		if r.Status != 201 {
			t.Fatalf("status = %d, want 201; body=%s", r.Status, r.Raw)
		}

		var p models.Product
		if err := db.Where("store_id = ?", st.ID).First(&p).Error; err != nil {
			t.Fatalf("produk tidak tersimpan: %v", err)
		}
		// SanitizePlainText memangkas spasi tepi (bukan menciutkan spasi ganda).
		if p.Name != "Kaos  Merah" {
			t.Errorf("nama = %q, want 'Kaos  Merah' (spasi tepi dibuang)", p.Name)
		}
		if p.MinOrder != 1 {
			t.Errorf("min_order = %d, want 1 (dipaksa minimal 1)", p.MinOrder)
		}
		if p.IsActive != true {
			t.Error("produk baru harus aktif")
		}
		if strings.Contains(p.Description, "<script>") {
			t.Errorf("deskripsi masih memuat script: %q", p.Description)
		}
		if p.CategoryID == nil {
			t.Fatal("category_id kosong: kategori otomatis dari class tidak dibuat")
		}
		var cat models.Category
		if err := db.First(&cat, *p.CategoryID).Error; err != nil {
			t.Fatalf("kategori tidak ada: %v", err)
		}
		if cat.Slug != "pakaian-busana" {
			t.Errorf("slug kategori = %q, want pakaian-busana", cat.Slug)
		}
	})

	t.Run("nama_kosong_422", func(t *testing.T) {
		db := newTestDB(t)
		u, st := merchantFixtures(t, db)
		r := call(t, merchantApp(db, st, u), "POST", "/products", map[string]any{
			"name": "   ", "price": 1000,
		})
		if r.Status != 422 {
			t.Fatalf("status = %d, want 422; body=%s", r.Status, r.Raw)
		}
	})

	t.Run("tipe_produk_tidak_dikenal_400", func(t *testing.T) {
		db := newTestDB(t)
		u, st := merchantFixtures(t, db)
		r := call(t, merchantApp(db, st, u), "POST", "/products", map[string]any{
			"name": "Barang", "product_type": "barang_ajaib",
		})
		if r.Status != 400 {
			t.Fatalf("status = %d, want 400; body=%s", r.Status, r.Raw)
		}
	})

	t.Run("galeri_lebih_dari_10_foto_400", func(t *testing.T) {
		db := newTestDB(t)
		u, st := merchantFixtures(t, db)
		imgs := make([]string, 11)
		for i := range imgs {
			imgs[i] = "https://cdn.test/img.jpg"
		}
		r := call(t, merchantApp(db, st, u), "POST", "/products", map[string]any{
			"name": "Produk Galeri", "gallery_images": imgs,
		})
		if r.Status != 400 {
			t.Fatalf("status = %d, want 400; body=%s", r.Status, r.Raw)
		}
	})

	t.Run("kuota_paket_habis_403", func(t *testing.T) {
		db := newTestDB(t)
		u, st := merchantFixtures(t, db)
		// Perketat kuota paket menjadi 1 item, lalu isi satu produk aktif.
		db.Model(&models.SubscriptionPlan{}).Where("code = ?", "free").Update("max_items", 1)
		mustCreate(t, db, &models.Product{StoreID: st.ID, Name: "Sudah Ada", IsActive: true, Price: 1})

		r := call(t, merchantApp(db, st, u), "POST", "/products", map[string]any{
			"name": "Produk Kelebihan",
		})
		if r.Status != 403 {
			t.Fatalf("status = %d, want 403 (kuota penuh); body=%s", r.Status, r.Raw)
		}
		if !strings.Contains(strings.ToLower(r.Raw), "batas") {
			t.Errorf("pesan kuota tidak informatif: %s", r.Raw)
		}
	})

	t.Run("tanpa_store_403", func(t *testing.T) {
		db := newTestDB(t)
		app := fiber.New(fiber.Config{DisableStartupMessage: true})
		ph := NewProductHandler(testCfg(), db)
		app.Post("/products", ph.Store)
		r := call(t, app, "POST", "/products", map[string]any{"name": "X"})
		if r.Status != 403 {
			t.Fatalf("status = %d, want 403", r.Status)
		}
	})
}

// ---------------------------------------------------------------------------
// Product.Update / Product.Destroy — termasuk isolasi lintas tenant (IDOR)
// ---------------------------------------------------------------------------

func TestProductUpdate_SQLite(t *testing.T) {
	t.Run("update_nama_dan_harga", func(t *testing.T) {
		db := newTestDB(t)
		u, st := merchantFixtures(t, db)
		p := &models.Product{StoreID: st.ID, Name: "Lama", Price: 1000, IsActive: true, ProductType: "physical"}
		mustCreate(t, db, p)

		r := call(t, merchantApp(db, st, u), "PUT", "/products/"+strconv.FormatUint(uint64(p.ID), 10), map[string]any{
			"name": "Baru", "price": 25000,
		})
		if r.Status != 200 {
			t.Fatalf("status = %d, want 200; body=%s", r.Status, r.Raw)
		}
		var got models.Product
		if err := db.First(&got, p.ID).Error; err != nil {
			t.Fatalf("reload: %v", err)
		}
		if got.Name != "Baru" {
			t.Errorf("nama = %q, want Baru", got.Name)
		}
		if got.Price != 25000 {
			t.Errorf("harga = %v, want 25000", got.Price)
		}
	})

	t.Run("produk_toko_lain_404", func(t *testing.T) {
		db := newTestDB(t)
		u, st := merchantFixtures(t, db)
		// Toko kedua milik user lain.
		other := &models.Store{UserID: u.ID + 1, Slug: "tokolain", StoreTitle: "Toko Lain", Plan: "free", PlanStatus: "active"}
		mustCreate(t, db, other)
		foreign := &models.Product{StoreID: other.ID, Name: "Milik Orang", Price: 1, IsActive: true, ProductType: "physical"}
		mustCreate(t, db, foreign)

		r := call(t, merchantApp(db, st, u), "PUT", "/products/"+strconv.FormatUint(uint64(foreign.ID), 10), map[string]any{
			"name": "Dibajak",
		})
		if r.Status != 404 {
			t.Fatalf("status = %d, want 404 (isolasi tenant); body=%s", r.Status, r.Raw)
		}
		var got models.Product
		db.First(&got, foreign.ID)
		if got.Name != "Milik Orang" {
			t.Errorf("produk tenant lain ikut berubah: %q", got.Name)
		}
	})

	t.Run("id_bukan_angka_404", func(t *testing.T) {
		db := newTestDB(t)
		u, st := merchantFixtures(t, db)
		r := call(t, merchantApp(db, st, u), "PUT", "/products/abc", map[string]any{"name": "X"})
		if r.Status != 404 {
			t.Fatalf("status = %d, want 404; body=%s", r.Status, r.Raw)
		}
	})

	t.Run("tipe_tidak_dikenal_400", func(t *testing.T) {
		db := newTestDB(t)
		u, st := merchantFixtures(t, db)
		p := &models.Product{StoreID: st.ID, Name: "P", IsActive: true, ProductType: "physical"}
		mustCreate(t, db, p)
		r := call(t, merchantApp(db, st, u), "PUT", "/products/"+strconv.FormatUint(uint64(p.ID), 10), map[string]any{
			"product_type": "makhluk_astral",
		})
		if r.Status != 400 {
			t.Fatalf("status = %d, want 400; body=%s", r.Status, r.Raw)
		}
	})
}

func TestProductDestroy_SQLite(t *testing.T) {
	t.Run("soft_delete", func(t *testing.T) {
		db := newTestDB(t)
		u, st := merchantFixtures(t, db)
		p := &models.Product{StoreID: st.ID, Name: "Akan Dihapus", IsActive: true, ProductType: "physical"}
		mustCreate(t, db, p)

		r := call(t, merchantApp(db, st, u), "DELETE", "/products/"+strconv.FormatUint(uint64(p.ID), 10), nil)
		if r.Status != 200 && r.Status != 204 {
			t.Fatalf("status = %d, want 200/204; body=%s", r.Status, r.Raw)
		}

		// Baris harus hilang dari query normal, tapi tetap ada via Unscoped.
		var count int64
		db.Model(&models.Product{}).Where("id = ?", p.ID).Count(&count)
		if count != 0 {
			t.Errorf("produk masih terlihat setelah delete (count=%d)", count)
		}
		db.Unscoped().Model(&models.Product{}).Where("id = ?", p.ID).Count(&count)
		if count != 1 {
			t.Errorf("baris tidak ada di Unscoped (soft delete gagal, count=%d)", count)
		}
	})

	t.Run("produk_toko_lain_404", func(t *testing.T) {
		db := newTestDB(t)
		u, st := merchantFixtures(t, db)
		other := &models.Store{UserID: u.ID + 1, Slug: "tokolain", StoreTitle: "Toko Lain", Plan: "free", PlanStatus: "active"}
		mustCreate(t, db, other)
		foreign := &models.Product{StoreID: other.ID, Name: "Milik Orang", IsActive: true, ProductType: "physical"}
		mustCreate(t, db, foreign)

		r := call(t, merchantApp(db, st, u), "DELETE", "/products/"+strconv.FormatUint(uint64(foreign.ID), 10), nil)
		if r.Status != 404 {
			t.Fatalf("status = %d, want 404 (isolasi tenant); body=%s", r.Status, r.Raw)
		}
		var count int64
		db.Model(&models.Product{}).Where("id = ?", foreign.ID).Count(&count)
		if count != 1 {
			t.Error("produk tenant lain terhapus")
		}
	})

	t.Run("batas_15_hapus_per_24_jam_429", func(t *testing.T) {
		db := newTestDB(t)
		u, st := merchantFixtures(t, db)
		// Sudah ada 15 produk terhapus dalam 24 jam terakhir.
		for i := 0; i < 15; i++ {
			p := &models.Product{StoreID: st.ID, Name: "Lama", IsActive: true, ProductType: "physical"}
			mustCreate(t, db, p)
			db.Delete(p)
		}
		target := &models.Product{StoreID: st.ID, Name: "Korban Berikutnya", IsActive: true, ProductType: "physical"}
		mustCreate(t, db, target)

		r := call(t, merchantApp(db, st, u), "DELETE", "/products/"+strconv.FormatUint(uint64(target.ID), 10), nil)
		if r.Status != 429 {
			t.Fatalf("status = %d, want 429 (rate limit hapus); body=%s", r.Status, r.Raw)
		}
		if !strings.Contains(r.Raw, "DELETION_LIMIT_EXCEEDED") {
			t.Errorf("kode error tidak ada: %s", r.Raw)
		}
	})
}

// PART4
