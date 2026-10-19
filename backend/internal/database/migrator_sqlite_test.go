package database

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// Uji migrator memakai SQLite in-memory, bukan PostgreSQL: inti yang diuji
// adalah pembukuan version/checksum di schema_migrations (guard anti-drift),
// bukan dialek SQL-nya. Berkas migrasi produksi tetap diuji terpisah lewat
// migrator_test.go yang butuh CATAVOR_MIGTEST_DSN.

var migSQLiteSeq atomic.Int64

func migSQLiteDB(t *testing.T) *gorm.DB {
	t.Helper()
	name := "mig_sqlite_" + strings.ReplaceAll(t.Name(), "/", "_") + "_" + itoa(migSQLiteSeq.Add(1))
	db, err := gorm.Open(sqlite.Open("file:"+name+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("buka sqlite: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}

// captureLog mengganti logger global zerolog selama fn berjalan.
func captureLog(t *testing.T, fn func()) string {
	t.Helper()
	var buf bytes.Buffer
	old := log.Logger
	log.Logger = zerolog.New(&buf)
	defer func() { log.Logger = old }()
	fn()
	return buf.String()
}

func migFile(version, body string) migrationFile {
	sum := sha256.Sum256([]byte(body))
	return migrationFile{version: version, checksum: hex.EncodeToString(sum[:]), body: body}
}

// TestLoadMigrationsEmbedded memastikan berkas .sql benar-benar tertanam,
// terurut, dan checksum-nya adalah SHA-256 isi berkas (dasar guard anti-drift).
func TestLoadMigrationsEmbedded(t *testing.T) {
	files, err := loadMigrations()
	if err != nil {
		t.Fatalf("loadMigrations: %v", err)
	}
	if len(files) == 0 {
		t.Fatal("tidak ada migrasi tertanam; go:embed gagal")
	}
	for i, f := range files {
		if !strings.HasSuffix(f.version, ".sql") {
			t.Errorf("berkas non-sql ikut termuat: %s", f.version)
		}
		if strings.TrimSpace(f.body) == "" {
			t.Errorf("isi migrasi kosong: %s", f.version)
		}
		sum := sha256.Sum256([]byte(f.body))
		if want := hex.EncodeToString(sum[:]); f.checksum != want {
			t.Errorf("checksum %s salah: %s != %s", f.version, f.checksum, want)
		}
		if i > 0 && files[i-1].version >= f.version {
			t.Errorf("urutan migrasi tidak naik: %s sebelum %s", files[i-1].version, f.version)
		}
	}
}

// TestRunMigrationsAppliesOnEmptyDatabase: database baru (tanpa data user)
// harus MENJALANKAN migrasi, bukan membaseline.
func TestRunMigrationsAppliesOnEmptyDatabase(t *testing.T) {
	db := migSQLiteDB(t)
	if err := db.Exec(`CREATE TABLE users (id INTEGER PRIMARY KEY)`).Error; err != nil {
		t.Fatalf("siapkan tabel users: %v", err)
	}

	files := []migrationFile{
		migFile("001_a.sql", `CREATE TABLE t_one (id INTEGER PRIMARY KEY)`),
		migFile("002_b.sql", `CREATE TABLE t_two (id INTEGER PRIMARY KEY)`),
	}

	var err error
	logs := captureLog(t, func() { err = runMigrations(db, files) })
	if err != nil {
		t.Fatalf("runMigrations: %v", err)
	}
	if !strings.Contains(logs, "menerapkan seluruh migrasi") {
		t.Errorf("log tidak menandai database baru: %q", logs)
	}

	for _, tbl := range []string{"t_one", "t_two"} {
		if !db.Migrator().HasTable(tbl) {
			t.Errorf("tabel %s tidak terbentuk; migrasi tidak dijalankan", tbl)
		}
	}

	var recs []schemaMigration
	if err := db.Find(&recs).Error; err != nil {
		t.Fatalf("baca schema_migrations: %v", err)
	}
	if len(recs) != len(files) {
		t.Fatalf("tercatat %d migrasi, harus %d", len(recs), len(files))
	}
	for _, r := range recs {
		if r.AppliedAt.IsZero() {
			t.Errorf("AppliedAt kosong untuk %s", r.Version)
		}
		if r.Checksum == "" {
			t.Errorf("checksum tidak dicatat untuk %s", r.Version)
		}
	}
}

// TestRunMigrationsSkipsAlreadyApplied: menjalankan ulang TIDAK boleh
// mengeksekusi SQL lagi. Buktinya: CREATE TABLE yang sama akan error bila
// dijalankan dua kali, jadi "tidak error" = benar-benar dilewati.
func TestRunMigrationsSkipsAlreadyApplied(t *testing.T) {
	db := migSQLiteDB(t)
	files := []migrationFile{
		migFile("001_a.sql", `CREATE TABLE t_once (id INTEGER PRIMARY KEY)`),
	}

	if err := runMigrations(db, files); err != nil {
		t.Fatalf("run pertama: %v", err)
	}

	// KONTROL: SQL ini memang gagal bila dieksekusi ulang.
	if err := db.Exec(files[0].body).Error; err == nil {
		t.Fatal("kondisi uji tidak sah: CREATE TABLE ulang tidak error")
	}

	var err error
	logs := captureLog(t, func() { err = runMigrations(db, files) })
	if err != nil {
		t.Fatalf("run kedua harus melewati migrasi, dapat error: %v", err)
	}
	if !strings.Contains(logs, "tidak ada migrasi baru") {
		t.Errorf("log run kedua tidak menyatakan skema mutakhir: %q", logs)
	}
}

// TestRunMigrationsUsesEmbeddedFiles memastikan wrapper publik benar-benar
// memuat migrasi ter-embed (bukan no-op): bila semua versi ter-embed sudah
// tercatat, RunMigrations harus selesai tanpa drift dan tanpa error.
func TestRunMigrationsUsesEmbeddedFiles(t *testing.T) {
	files, err := loadMigrations()
	if err != nil {
		t.Fatalf("loadMigrations: %v", err)
	}
	db := migSQLiteDB(t)
	if err := db.AutoMigrate(&schemaMigration{}); err != nil {
		t.Fatalf("AutoMigrate: %v", err)
	}
	for _, f := range files {
		if err := db.Create(&schemaMigration{Version: f.version, Checksum: f.checksum}).Error; err != nil {
			t.Fatalf("catat %s: %v", f.version, err)
		}
	}

	if err := RunMigrations(db); err != nil {
		t.Fatalf("RunMigrations: %v", err)
	}
	var count int64
	if err := db.Model(&schemaMigration{}).Count(&count).Error; err != nil {
		t.Fatalf("hitung: %v", err)
	}
	if count != int64(len(files)) {
		t.Errorf("jumlah catatan = %d, harus %d", count, len(files))
	}
}

// TestRunMigrationsDetectsChecksumDrift: isi berkas yang sudah diterapkan
// berubah -> harus error, dan migrasi baru setelahnya TIDAK dijalankan.
func TestRunMigrationsDetectsChecksumDriftSQLite(t *testing.T) {
	db := migSQLiteDB(t)
	applied := migFile("001_a.sql", `CREATE TABLE t_drift (id INTEGER PRIMARY KEY)`)
	if err := runMigrations(db, []migrationFile{applied}); err != nil {
		t.Fatalf("run awal: %v", err)
	}

	tampered := migFile("001_a.sql", `CREATE TABLE t_drift (id INTEGER PRIMARY KEY, extra TEXT)`)
	next := migFile("002_b.sql", `CREATE TABLE t_after_drift (id INTEGER PRIMARY KEY)`)

	err := runMigrations(db, []migrationFile{tampered, next})
	if err == nil {
		t.Fatal("runner menerima migrasi yang isinya berubah; guard checksum tidak bekerja")
	}
	if !strings.Contains(err.Error(), "checksum") {
		t.Errorf("error tidak menyebut checksum: %v", err)
	}
	if db.Migrator().HasTable("t_after_drift") {
		t.Error("migrasi setelah drift tetap dijalankan; harus berhenti")
	}
	// Checksum tercatat tidak boleh ikut tertimpa.
	var rec schemaMigration
	if err := db.Where("version = ?", "001_a.sql").First(&rec).Error; err != nil {
		t.Fatalf("baca catatan: %v", err)
	}
	if rec.Checksum != applied.checksum {
		t.Errorf("checksum tercatat berubah: %s", rec.Checksum)
	}
}

// TestRunMigrationsBaselinesLegacyInstallation: instalasi lama (users sudah
// berisi data, schema_migrations belum ada) dicatat TANPA menjalankan DDL.
func TestRunMigrationsBaselinesLegacyInstallation(t *testing.T) {
	db := migSQLiteDB(t)
	if err := db.Exec(`CREATE TABLE users (id INTEGER PRIMARY KEY)`).Error; err != nil {
		t.Fatalf("buat users: %v", err)
	}
	if err := db.Exec(`INSERT INTO users (id) VALUES (1)`).Error; err != nil {
		t.Fatalf("isi users: %v", err)
	}

	files := []migrationFile{
		migFile("001_a.sql", `CREATE TABLE t_legacy (id INTEGER PRIMARY KEY)`),
		migFile("002_b.sql", `CREATE TABLE t_legacy2 (id INTEGER PRIMARY KEY)`),
	}

	var err error
	logs := captureLog(t, func() { err = runMigrations(db, files) })
	if err != nil {
		t.Fatalf("baseline: %v", err)
	}
	if !strings.Contains(logs, "instalasi lama") {
		t.Errorf("log tidak menandai instalasi lama: %q", logs)
	}

	var recorded int64
	db.Model(&schemaMigration{}).Count(&recorded)
	if int(recorded) != len(files) {
		t.Errorf("baseline mencatat %d, harus %d", recorded, len(files))
	}
	for _, tbl := range []string{"t_legacy", "t_legacy2"} {
		if db.Migrator().HasTable(tbl) {
			t.Errorf("tabel %s terbentuk; baseline seharusnya tidak menjalankan DDL", tbl)
		}
	}
}

// TestRunMigrationsRollsBackFailedMigration: satu berkas = satu transaksi.
// Berkas gagal tidak boleh meninggalkan tabel separuh atau catatan.
func TestRunMigrationsRollsBackFailedMigration(t *testing.T) {
	db := migSQLiteDB(t)
	files := []migrationFile{
		migFile("001_ok.sql", `CREATE TABLE t_ok (id INTEGER PRIMARY KEY)`),
		migFile("002_bad.sql", "CREATE TABLE t_bad (id INTEGER PRIMARY KEY);\nINSERT INTO tabel_yang_tidak_ada (id) VALUES (1);"),
		migFile("003_never.sql", `CREATE TABLE t_never (id INTEGER PRIMARY KEY)`),
	}

	err := runMigrations(db, files)
	if err == nil {
		t.Fatal("migrasi rusak diterima; harus error")
	}
	if !strings.Contains(err.Error(), "002_bad.sql") {
		t.Errorf("error tidak menyebut berkas bermasalah: %v", err)
	}

	if !db.Migrator().HasTable("t_ok") {
		t.Error("migrasi sebelumnya ikut dibatalkan; seharusnya tetap terterap")
	}
	if db.Migrator().HasTable("t_bad") {
		t.Error("tabel dari migrasi gagal masih ada; transaksi tidak rollback")
	}
	if db.Migrator().HasTable("t_never") {
		t.Error("migrasi setelah kegagalan tetap dijalankan")
	}

	var n int64
	db.Model(&schemaMigration{}).Where("version = ?", "002_bad.sql").Count(&n)
	if n != 0 {
		t.Error("migrasi gagal tercatat sebagai sudah diterapkan")
	}
	db.Model(&schemaMigration{}).Where("version = ?", "001_ok.sql").Count(&n)
	if n != 1 {
		t.Error("migrasi yang berhasil tidak tercatat")
	}
}

// TestRunMigrationsWarnsOnOrphanRecord: catatan yang berkasnya hilang dari
// binary bukan error, tetapi harus terlihat di log.
func TestRunMigrationsWarnsOnOrphanRecord(t *testing.T) {
	db := migSQLiteDB(t)
	if err := db.AutoMigrate(&schemaMigration{}); err != nil {
		t.Fatalf("siapkan tabel: %v", err)
	}
	if err := db.Create(&schemaMigration{
		Version:  "000_hilang.sql",
		Checksum: strings.Repeat("a", 64),
	}).Error; err != nil {
		t.Fatalf("sisip catatan yatim: %v", err)
	}

	files := []migrationFile{migFile("001_a.sql", `CREATE TABLE t_x (id INTEGER PRIMARY KEY)`)}

	var err error
	logs := captureLog(t, func() { err = runMigrations(db, files) })
	if err != nil {
		t.Fatalf("catatan yatim tidak boleh menggagalkan migrasi: %v", err)
	}
	if !strings.Contains(logs, "000_hilang.sql") || !strings.Contains(logs, "tidak ada di binary") {
		t.Errorf("catatan yatim tidak dilaporkan: %q", logs)
	}
	if !db.Migrator().HasTable("t_x") {
		t.Error("migrasi baru tidak dijalankan saat ada catatan yatim")
	}
}

// TestRunMigrationsNoFiles: daftar kosong = tidak ada yang dikerjakan.
func TestRunMigrationsNoFiles(t *testing.T) {
	db := migSQLiteDB(t)
	var err error
	logs := captureLog(t, func() { err = runMigrations(db, nil) })
	if err != nil {
		t.Fatalf("daftar kosong harus nil, dapat: %v", err)
	}
	if !strings.Contains(logs, "tidak ada berkas migrasi") {
		t.Errorf("log peringatan tidak muncul: %q", logs)
	}
}
