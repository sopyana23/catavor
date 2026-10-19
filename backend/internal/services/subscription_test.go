package services

import (
	"testing"

	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// newSvcDB menyiapkan GORM di atas SQLite in-memory dengan tabel yang dibutuhkan
// logika kuota/langganan. Dipakai agar aturan bisnis (kuota, anti-cheat
// moderasi) bisa diuji tanpa PostgreSQL.
func newSvcDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("buka sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.User{}, &models.Store{}, &models.Product{},
		&models.SubscriptionPlan{}, &models.Category{},
	); err != nil {
		t.Fatalf("migrasi: %v", err)
	}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)
	return db
}

func seedPlanStore(t *testing.T, db *gorm.DB, maxItems int) (*models.Store, *models.SubscriptionPlan) {
	t.Helper()
	plan := &models.SubscriptionPlan{
		Code: "free", Name: "Free", MaxItems: maxItems,
		StorageLimitBytes: 100 * 1024 * 1024,
	}
	if err := db.Create(plan).Error; err != nil {
		t.Fatalf("seed plan: %v", err)
	}
	u := &models.User{Name: "U", Email: "u@t.test", Password: "x"}
	if err := db.Create(u).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	st := &models.Store{UserID: u.ID, Slug: "toko", StoreTitle: "Toko", Plan: "free", PlanStatus: "active"}
	if err := db.Create(st).Error; err != nil {
		t.Fatalf("seed store: %v", err)
	}
	return st, plan
}

// ---------------------------------------------------------------------------
// CanEditOrReactivateProduct — gerbang anti-cheat & kepatuhan
// ---------------------------------------------------------------------------

func TestCanEditOrReactivateProduct(t *testing.T) {
	seedProduct := func(t *testing.T, db *gorm.DB, storeID uint, status string, active bool) *models.Product {
		t.Helper()
		p := &models.Product{
			StoreID: storeID, Name: "P", Price: 1000,
			IsActive: active, ProductType: "physical",
			ModerationStatus: status,
		}
		if err := db.Create(p).Error; err != nil {
			t.Fatalf("seed produk: %v", err)
		}
		// Product.IsActive bertag `default:true`, sehingga GORM mengabaikan nilai
		// false saat Create. Untuk membuat item arsip, status harus di-set
		// eksplisit setelah insert.
		if !active {
			if err := db.Model(&models.Product{}).Where("id = ?", p.ID).Update("is_active", false).Error; err != nil {
				t.Fatalf("arsipkan produk: %v", err)
			}
			p.IsActive = false
		}
		return p
	}

	cases := []struct {
		name       string
		status     string
		active     bool
		willActive bool
		wantOK     bool
	}{
		{"produk_normal_boleh_edit", "", true, true, true},
		{"banned_tidak_boleh", "banned", true, true, false},
		{"locked_tidak_boleh", "locked", true, false, false},
		{"in_review_tidak_boleh", "in_review", true, true, false},
		{"needs_fix_tidak_boleh_aktif", "needs_fix", false, true, false},
		{"needs_fix_boleh_edit_tanpa_aktif", "needs_fix", false, false, true},
		{"hidden_tidak_boleh_aktif", "hidden", false, true, false},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			db := newSvcDB(t)
			st, _ := seedPlanStore(t, db, -1)
			p := seedProduct(t, db, st.ID, c.status, c.active)

			ok, msg := CanEditOrReactivateProduct(db, st.ID, p.ID, c.willActive)
			if ok != c.wantOK {
				t.Fatalf("allowed = %v, want %v (msg=%q)", ok, c.wantOK, msg)
			}
			if !ok && msg == "" {
				t.Error("penolakan tanpa alasan ke pengguna")
			}
		})
	}

	t.Run("produk_tidak_ada", func(t *testing.T) {
		db := newSvcDB(t)
		st, _ := seedPlanStore(t, db, -1)
		if ok, _ := CanEditOrReactivateProduct(db, st.ID, 99999, true); ok {
			t.Error("produk tidak ada seharusnya ditolak")
		}
	})

	t.Run("reaktivasi_ditolak_saat_kuota_aktif_penuh", func(t *testing.T) {
		db := newSvcDB(t)
		st, _ := seedPlanStore(t, db, 2)
		// Dua produk aktif = kuota aktif penuh.
		seedProduct(t, db, st.ID, "", true)
		seedProduct(t, db, st.ID, "", true)
		archived := seedProduct(t, db, st.ID, "", false)

		ok, msg := CanEditOrReactivateProduct(db, st.ID, archived.ID, true)
		if ok {
			t.Fatal("reaktivasi seharusnya ditolak: kuota produk aktif sudah penuh")
		}
		if msg == "" {
			t.Error("pesan kuota kosong")
		}
	})

	t.Run("reaktivasi_boleh_saat_kuota_masih_ada", func(t *testing.T) {
		db := newSvcDB(t)
		st, _ := seedPlanStore(t, db, 5)
		seedProduct(t, db, st.ID, "", true)
		archived := seedProduct(t, db, st.ID, "", false)

		if ok, msg := CanEditOrReactivateProduct(db, st.ID, archived.ID, true); !ok {
			t.Fatalf("reaktivasi ditolak padahal kuota tersedia: %s", msg)
		}
	})
}

// ---------------------------------------------------------------------------
// CanAddProduct — kuota total item (aktif + arsip)
// ---------------------------------------------------------------------------

func TestCanAddProduct(t *testing.T) {
	t.Run("unlimited_selalu_boleh", func(t *testing.T) {
		db := newSvcDB(t)
		st, _ := seedPlanStore(t, db, -1)
		for i := 0; i < 5; i++ {
			if err := db.Create(&models.Product{StoreID: st.ID, Name: "P", IsActive: true, ProductType: "physical"}).Error; err != nil {
				t.Fatal(err)
			}
		}
		if ok, msg := CanAddProduct(db, st.ID); !ok {
			t.Fatalf("paket unlimited ditolak: %s", msg)
		}
	})

	t.Run("kuota_total_penuh_ditolak", func(t *testing.T) {
		db := newSvcDB(t)
		st, _ := seedPlanStore(t, db, 2)
		if err := db.Create(&models.Product{StoreID: st.ID, Name: "A", IsActive: true, ProductType: "physical"}).Error; err != nil {
			t.Fatal(err)
		}
		// Item arsip tetap dihitung sebagai pemakai kuota. IsActive=false harus
		// di-set via Update karena tag `default:true` menimpanya saat Create.
		archived := &models.Product{StoreID: st.ID, Name: "B", ProductType: "physical"}
		if err := db.Create(archived).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Model(&models.Product{}).Where("id = ?", archived.ID).Update("is_active", false).Error; err != nil {
			t.Fatal(err)
		}

		ok, msg := CanAddProduct(db, st.ID)
		if ok {
			t.Fatal("seharusnya ditolak: aktif(1) + arsip(1) = kuota 2")
		}
		if msg == "" {
			t.Error("pesan kuota kosong")
		}
	})

	t.Run("masih_ada_slot_boleh", func(t *testing.T) {
		db := newSvcDB(t)
		st, _ := seedPlanStore(t, db, 3)
		if err := db.Create(&models.Product{StoreID: st.ID, Name: "A", IsActive: true, ProductType: "physical"}).Error; err != nil {
			t.Fatal(err)
		}
		if ok, msg := CanAddProduct(db, st.ID); !ok {
			t.Fatalf("masih ada slot tapi ditolak: %s", msg)
		}
	})
}

// PART3

