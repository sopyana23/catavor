package services

import (
	"testing"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// sessionTestDB menyiapkan DB in-memory berisi tabel user_sessions.
func sessionTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("buka sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.UserSession{}); err != nil {
		t.Fatalf("migrasi: %v", err)
	}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)
	return db
}

// useGlobalDB memasang database.DB selama test lalu mengembalikannya.
func useGlobalDB(t *testing.T, db *gorm.DB) {
	t.Helper()
	prev := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = prev })
}

// Regresi: RecordUserSession dipanggil sebagai `go services.RecordUserSession(...)`
// dari beberapa jalur login. Sebelum diperbaiki, database.DB yang nil membuat
// gorm.Create men-dereference nil pointer di dalam goroutine — panic jenis ini
// tidak tercakup recover middleware Fiber sehingga mematikan seluruh proses.
// Gejalanya sempat muncul sebagai kegagalan intermiten `go test` (flake).
func TestRecordUserSession_TanpaDBTidakPanik(t *testing.T) {
	useGlobalDB(t, nil)

	done := make(chan struct{})
	go func() {
		defer close(done)
		RecordUserSession(1, "token-nil-db", time.Now().Add(time.Hour), "127.0.0.1", "UA")
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("RecordUserSession menggantung")
	}
}

func TestTouchUserSession_TanpaDBTidakPanik(t *testing.T) {
	useGlobalDB(t, nil)

	done := make(chan struct{})
	go func() {
		defer close(done)
		TouchUserSession("token-nil-db", "127.0.0.1")
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("TouchUserSession menggantung")
	}
}

func TestRecordUserSession_MenyimpanSesi(t *testing.T) {
	db := sessionTestDB(t)
	useGlobalDB(t, db)

	expires := time.Now().Add(24 * time.Hour).UTC().Truncate(time.Second)
	RecordUserSession(7, "token-simpan", expires, "10.1.2.3", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")

	var sess models.UserSession
	if err := db.Where("token_id = ?", "token-simpan").First(&sess).Error; err != nil {
		t.Fatalf("sesi tidak tersimpan: %v", err)
	}
	if sess.UserID != 7 {
		t.Errorf("user_id = %d, want 7", sess.UserID)
	}
	if sess.IPAddress != "10.1.2.3" {
		t.Errorf("ip = %q, want 10.1.2.3", sess.IPAddress)
	}
	if sess.IsRevoked {
		t.Error("sesi baru tidak boleh langsung revoked")
	}
	if sess.DeviceType == "" {
		t.Error("device_type harus terisi dari User-Agent")
	}
}

// Input tidak lengkap harus no-op, bukan menyimpan sesi setengah jadi.
func TestRecordUserSession_InputTidakLengkapDiabaikan(t *testing.T) {
	db := sessionTestDB(t)
	useGlobalDB(t, db)

	RecordUserSession(0, "token-x", time.Now().Add(time.Hour), "1.1.1.1", "UA")
	RecordUserSession(5, "", time.Now().Add(time.Hour), "1.1.1.1", "UA")

	var count int64
	db.Model(&models.UserSession{}).Count(&count)
	if count != 0 {
		t.Errorf("jumlah sesi = %d, want 0", count)
	}
}

func TestTouchUserSession_MemperbaruiSesiLama(t *testing.T) {
	db := sessionTestDB(t)
	useGlobalDB(t, db)

	old := time.Now().Add(-1 * time.Hour)
	sess := models.UserSession{
		UserID:       9,
		TokenID:      "token-touch",
		IPAddress:    "1.1.1.1",
		LastActiveAt: old,
		ExpiresAt:    time.Now().Add(time.Hour),
		IsRevoked:    false,
		CreatedAt:    old,
		UpdatedAt:    old,
	}
	if err := db.Create(&sess).Error; err != nil {
		t.Fatalf("seed sesi: %v", err)
	}

	TouchUserSession("token-touch", "9.9.9.9")

	var got models.UserSession
	if err := db.Where("token_id = ?", "token-touch").First(&got).Error; err != nil {
		t.Fatalf("baca sesi: %v", err)
	}
	if got.IPAddress != "9.9.9.9" {
		t.Errorf("ip = %q, want 9.9.9.9", got.IPAddress)
	}
	if !got.LastActiveAt.After(old) {
		t.Error("last_active_at harus bertambah")
	}
}

// Sesi yang baru saja aktif tidak perlu ditulis ulang (throttle 5 menit).
func TestTouchUserSession_Throttle(t *testing.T) {
	db := sessionTestDB(t)
	useGlobalDB(t, db)

	recent := time.Now().Add(-30 * time.Second)
	sess := models.UserSession{
		UserID:       10,
		TokenID:      "token-throttle",
		IPAddress:    "2.2.2.2",
		LastActiveAt: recent,
		ExpiresAt:    time.Now().Add(time.Hour),
		CreatedAt:    recent,
		UpdatedAt:    recent,
	}
	if err := db.Create(&sess).Error; err != nil {
		t.Fatalf("seed sesi: %v", err)
	}

	TouchUserSession("token-throttle", "8.8.8.8")

	var got models.UserSession
	db.Where("token_id = ?", "token-throttle").First(&got)
	if got.IPAddress != "2.2.2.2" {
		t.Errorf("ip = %q, want tetap 2.2.2.2 (throttled)", got.IPAddress)
	}
}
