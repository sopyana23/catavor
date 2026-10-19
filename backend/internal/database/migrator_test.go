package database

import (
	"os"
	"sync"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// migTestDB membuka koneksi ke database uji khusus migrasi.
// Dilewati bila CATAVOR_MIGTEST_DSN tidak diset, sehingga `go test ./...`
// biasa tidak menyentuh database apa pun.
func migTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("CATAVOR_MIGTEST_DSN")
	if dsn == "" {
		t.Skip("CATAVOR_MIGTEST_DSN tidak diset; uji migrasi dilewati")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("koneksi DB uji: %v", err)
	}
	return db
}

var migOnce sync.Once

// prepareEmptySchema mengosongkan schema public DAN menyiapkan tabel inti
// (stores, users, products) sekali per proses uji. Tabel inti dibutuhkan karena
// migrasi SQL berisi REFERENCES ke tabel yang dibentuk AutoMigrate — pada
// deployment nyata AutoMigrate berjalan lebih dulu (langkah 4 di InitDB).
func prepareEmptySchema(t *testing.T, db *gorm.DB) {
	t.Helper()
	migOnce.Do(func() {
		if err := db.Exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public;").Error; err != nil {
			t.Fatalf("reset schema: %v", err)
		}
		// Tabel minimum yang dirujuk migrasi. Strukturnya tidak perlu lengkap,
		// tetapi kolom yang dirujuk constraint WAJIB ada.
		//
		// JANGAN menambahkan tabel yang tidak lagi dibuat AutoMigrate.
		// Tabel `sightings` dulu ditambahkan di sini dan itu MENYEMBUNYIKAN bug
		// nyata: pada instalasi baru tabel itu tidak pernah ada, sehingga
		// migrasi N-45 gagal dan server tidak bisa boot sama sekali. Uji ini
		// harus mencerminkan apa yang benar-benar dibuat AutoMigrate.
		stmts := []string{
			`CREATE TABLE users (id BIGSERIAL PRIMARY KEY)`,
			`CREATE TABLE stores (id BIGSERIAL PRIMARY KEY, user_id BIGINT)`,
			`CREATE TABLE products (id BIGSERIAL PRIMARY KEY, store_id BIGINT)`,
			`CREATE TABLE support_tickets (id BIGSERIAL PRIMARY KEY, rated_agent_id BIGINT)`,
		}
		for _, s := range stmts {
			if err := db.Exec(s).Error; err != nil {
				t.Fatalf("tabel inti uji: %v", err)
			}
		}
	})
}

// TestRunMigrationsAppliesAll memastikan runner menerapkan seluruh berkas
// migrasi pada database kosong dan mencatatnya.
func TestRunMigrationsAppliesAll(t *testing.T) {
	db := migTestDB(t)
	prepareEmptySchema(t, db)

	files, err := loadMigrations()
	if err != nil {
		t.Fatalf("loadMigrations: %v", err)
	}
	if len(files) == 0 {
		t.Fatal("tidak ada migrasi yang tertanam; go:embed gagal")
	}

	if err := RunMigrations(db); err != nil {
		t.Fatalf("RunMigrations: %v", err)
	}

	var recorded int64
	if err := db.Model(&schemaMigration{}).Count(&recorded).Error; err != nil {
		t.Fatalf("hitung schema_migrations: %v", err)
	}
	if int(recorded) != len(files) {
		t.Errorf("tercatat %d migrasi, harus %d", recorded, len(files))
	}

	// Bukti nyata: kolom yang hanya dibuat migrasi N-26 harus ada.
	var exists bool
	err = db.Raw(`SELECT EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema='public' AND table_name='store_daily_traffic_sources')`).Scan(&exists).Error
	if err != nil {
		t.Fatalf("cek tabel: %v", err)
	}
	if !exists {
		t.Error("tabel store_daily_traffic_sources tidak terbentuk; migrasi tidak benar-benar dijalankan")
	}
}

// TestRunMigrationsIdempotent memastikan menjalankan ulang tidak menerapkan
// apa pun lagi dan tidak error.
func TestRunMigrationsIdempotent(t *testing.T) {
	db := migTestDB(t)

	var before int64
	db.Model(&schemaMigration{}).Count(&before)

	if err := RunMigrations(db); err != nil {
		t.Fatalf("RunMigrations kedua: %v", err)
	}

	var after int64
	db.Model(&schemaMigration{}).Count(&after)
	if after != before {
		t.Errorf("jumlah migrasi berubah %d -> %d; runner menerapkan ulang", before, after)
	}
}

// TestRunMigrationsDetectsChecksumDrift memastikan berkas yang diubah setelah
// diterapkan ditolak. Ini mencegah produksi dan repo menyimpang tanpa terlihat.
func TestRunMigrationsDetectsChecksumDrift(t *testing.T) {
	db := migTestDB(t)

	files, err := loadMigrations()
	if err != nil || len(files) == 0 {
		t.Fatalf("loadMigrations: %v", err)
	}
	target := files[0].version

	if err := db.Model(&schemaMigration{}).
		Where("version = ?", target).
		Update("checksum", "0000000000000000000000000000000000000000000000000000000000000000").Error; err != nil {
		t.Fatalf("rusak checksum: %v", err)
	}
	defer db.Model(&schemaMigration{}).
		Where("version = ?", target).
		Update("checksum", files[0].checksum)

	err = RunMigrations(db)
	if err == nil {
		t.Fatal("runner menerima migrasi yang checksum-nya berubah; harus menolak")
	}
}

// TestRunMigrationsBaselinesExistingSchema memastikan instalasi lama (skema
// sudah ada, schema_migrations belum) dibaseline tanpa menjalankan ulang DDL.
func TestRunMigrationsBaselinesExistingSchema(t *testing.T) {
	db := migTestDB(t)

	files, err := loadMigrations()
	if err != nil || len(files) == 0 {
		t.Fatalf("loadMigrations: %v", err)
	}

	// Simulasikan instalasi lama: catatan migrasi dihapus, skema tetap.
	if err := db.Migrator().DropTable(&schemaMigration{}); err != nil {
		t.Fatalf("drop schema_migrations: %v", err)
	}

	if err := RunMigrations(db); err != nil {
		t.Fatalf("RunMigrations pada instalasi lama: %v", err)
	}

	var recorded int64
	db.Model(&schemaMigration{}).Count(&recorded)
	if int(recorded) != len(files) {
		t.Errorf("baseline mencatat %d migrasi, harus %d", recorded, len(files))
	}
}
