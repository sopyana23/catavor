package database

import (
	"bytes"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

type MigProbe struct {
	ID  uint `gorm:"primaryKey"`
	Val string
}

func (MigProbe) TableName() string { return "mig_probe" }

// TestMustAutoMigrateLogsFailure membuktikan mustAutoMigrate MENCATAT error.
// Kegagalan dipaksa nyata: koneksi DB ditutup sebelum migrasi, sehingga
// AutoMigrate pasti error (bukan mengandalkan bentrok tipe yang direkonsiliasi).
func TestMustAutoMigrateLogsFailure(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:migprobe1?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("buka sqlite: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("ambil sql.DB: %v", err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatalf("tutup koneksi: %v", err)
	}

	var buf bytes.Buffer
	old := log.Logger
	log.Logger = zerolog.New(&buf)
	defer func() { log.Logger = old }()

	// KONTROL POSITIF: pastikan AutoMigrate memang error pada kondisi ini.
	if directErr := db.AutoMigrate(&MigProbe{}); directErr == nil {
		t.Fatal("kondisi uji tidak menghasilkan error — uji tidak sah")
	}

	// Harus gagal DAN tercatat.
	mustAutoMigrate(db, "probe_group", &MigProbe{})

	out := buf.String()
	if !strings.Contains(out, "GAGAL") {
		t.Fatalf("kegagalan tidak tercatat. log=%q", out)
	}
	if !strings.Contains(out, "probe_group") {
		t.Errorf("nama group tidak ada di log: %q", out)
	}
	if !strings.Contains(out, "error") && !strings.Contains(out, `"level":"error"`) {
		t.Errorf("tidak ada level error di log: %q", out)
	}
	t.Logf("LOG TERBUKTI: %s", strings.TrimSpace(out))
}

// TestMustAutoMigrateSilentOnSuccess: migrasi sah TIDAK boleh menghasilkan log error.
func TestMustAutoMigrateSilentOnSuccess(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:migprobe2?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("buka sqlite: %v", err)
	}
	var buf bytes.Buffer
	old := log.Logger
	log.Logger = zerolog.New(&buf)
	defer func() { log.Logger = old }()

	mustAutoMigrate(db, "ok_group", &MigProbe{})

	if strings.Contains(buf.String(), "GAGAL") {
		t.Errorf("migrasi sah dilaporkan gagal: %q", buf.String())
	}
	// pastikan tabelnya benar-benar terbentuk
	if !db.Migrator().HasTable(&MigProbe{}) {
		t.Error("tabel tidak terbentuk")
	}
}
