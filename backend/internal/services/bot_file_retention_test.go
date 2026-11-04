package services

import (
	"context"
	"io"
	"strings"
	"sync"
	"testing"
	"time"

	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type mockRetentionStorage struct {
	mu          sync.Mutex
	deletedKeys []string
}

func (m *mockRetentionStorage) Upload(ctx context.Context, key string, r io.Reader, size int64, contentType string) (string, error) {
	return "http://mock/" + key, nil
}

func (m *mockRetentionStorage) Delete(ctx context.Context, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.deletedKeys = append(m.deletedKeys, key)
	return nil
}

func (m *mockRetentionStorage) DeletePrefix(ctx context.Context, prefix string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.deletedKeys = append(m.deletedKeys, prefix)
	return nil
}

func (m *mockRetentionStorage) Get(ctx context.Context, key string) (io.ReadCloser, string, int64, error) {
	return io.NopCloser(strings.NewReader("")), "application/octet-stream", 0, nil
}

func (m *mockRetentionStorage) GetURL(key string) string {
	return "http://mock/" + key
}

func (m *mockRetentionStorage) GetPresignedURL(ctx context.Context, key string, expiry time.Duration) (string, error) {
	return "http://mock/" + key, nil
}

func (m *mockRetentionStorage) GetDriverName() string {
	return "mock"
}

func newRetentionDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	if err := db.AutoMigrate(
		&models.User{},
		&models.Store{},
		&models.Product{},
		&models.ProductImage{},
		&models.ProductVariant{},
		&models.Category{},
		&models.SupportTicket{},
		&models.SupportMessage{},
		&models.SupportAttachment{},
		&models.Notification{},
		&models.NotificationRead{},
		&models.ActivityLog{},
		&models.AutomationLog{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)
	return db
}

func TestPurgeExpiredClosedTickets_TransactionAndDeferredFileDeletion(t *testing.T) {
	db := newRetentionDB(t)
	strg := &mockRetentionStorage{}

	user := models.User{ID: 1, Name: "Tester", Email: "test@example.com"}
	_ = db.Create(&user)

	now := time.Now().UTC()
	closed70DaysAgo := now.AddDate(0, 0, -70)

	ticket := models.SupportTicket{
		ID:           101,
		TicketNumber: "TCK-EXPIRED-001",
		UserID:       user.ID,
		Subject:      "Tiket Lama",
		Category:     "technical",
		Status:       "closed",
		ClosedAt:     &closed70DaysAgo,
		CreatedAt:    closed70DaysAgo.Add(-24 * time.Hour),
		UpdatedAt:    closed70DaysAgo,
	}
	if err := db.Create(&ticket).Error; err != nil {
		t.Fatalf("create ticket: %v", err)
	}

	msg := models.SupportMessage{
		ID:         201,
		TicketID:   ticket.ID,
		SenderID:   user.ID,
		SenderType: "user",
		Message:    "Ini lampiran bukti pembayaran",
		CreatedAt:  closed70DaysAgo,
	}
	if err := db.Create(&msg).Error; err != nil {
		t.Fatalf("create message: %v", err)
	}

	att := models.SupportAttachment{
		ID:         301,
		MessageID:  msg.ID,
		FileName:   "bukti.jpg",
		FileURL:    "/storage/support/bukti_101.jpg",
		StorageKey: "support/bukti_101.jpg",
		FileType:   "image/jpeg",
		FileSize:   1024,
	}
	if err := db.Create(&att).Error; err != nil {
		t.Fatalf("create attachment: %v", err)
	}

	stats, err := PurgeExpiredClosedTickets(db, strg)
	if err != nil {
		t.Fatalf("PurgeExpiredClosedTickets failed: %v", err)
	}

	if stats.PurgedTickets != 1 {
		t.Errorf("PurgedTickets = %d, want 1", stats.PurgedTickets)
	}
	if stats.PurgedFiles != 1 {
		t.Errorf("PurgedFiles = %d, want 1", stats.PurgedFiles)
	}

	// Verify database records purged
	var ticketCount int64
	db.Model(&models.SupportTicket{}).Where("id = ?", ticket.ID).Count(&ticketCount)
	if ticketCount != 0 {
		t.Errorf("ticket record count in DB = %d, want 0", ticketCount)
	}

	var attCount int64
	db.Model(&models.SupportAttachment{}).Where("id = ?", att.ID).Count(&attCount)
	if attCount != 0 {
		t.Errorf("attachment record count in DB = %d, want 0", attCount)
	}

	// Verify storage delete called
	strg.mu.Lock()
	defer strg.mu.Unlock()
	found := false
	for _, k := range strg.deletedKeys {
		if k == "support/bukti_101.jpg" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("storage deletedKeys %v does not contain 'support/bukti_101.jpg'", strg.deletedKeys)
	}
}

func TestPurgeUserTicketsAndAttachments_TransactionAndDeferredFileDeletion(t *testing.T) {
	db := newRetentionDB(t)
	strg := &mockRetentionStorage{}

	user := models.User{ID: 2, Name: "UserToErase", Email: "erase@example.com"}
	_ = db.Create(&user)

	ticket := models.SupportTicket{
		ID:           102,
		TicketNumber: "TCK-USER-ERASE",
		UserID:       user.ID,
		Subject:      "Akun Mau Dihapus",
		Category:     "account",
		Status:       "open",
	}
	_ = db.Create(&ticket)

	msg := models.SupportMessage{
		ID:         202,
		TicketID:   ticket.ID,
		SenderID:   user.ID,
		SenderType: "user",
		Message:    "Mohon hapus data saya",
	}
	_ = db.Create(&msg)

	att := models.SupportAttachment{
		ID:         302,
		MessageID:  msg.ID,
		FileName:   "ktp.jpg",
		StorageKey: "private/support/ktp_102.jpg",
		FileType:   "image/jpeg",
		FileSize:   2048,
	}
	_ = db.Create(&att)

	purgedTickets, purgedFiles, err := PurgeUserTicketsAndAttachments(db, strg, user.ID)
	if err != nil {
		t.Fatalf("PurgeUserTicketsAndAttachments failed: %v", err)
	}

	if purgedTickets != 1 {
		t.Errorf("purgedTickets = %d, want 1", purgedTickets)
	}
	if purgedFiles != 1 {
		t.Errorf("purgedFiles = %d, want 1", purgedFiles)
	}

	// Verify storage deletion
	strg.mu.Lock()
	defer strg.mu.Unlock()
	found := false
	for _, k := range strg.deletedKeys {
		if k == "private/support/ktp_102.jpg" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("storage deletedKeys %v does not contain 'private/support/ktp_102.jpg'", strg.deletedKeys)
	}
}

func TestStorageSweeper_AutomationTrackerAndHeartbeat(t *testing.T) {
	db := newRetentionDB(t)
	tracker := InitAutomationTracker(db, nil)

	store := models.Store{
		ID:         55,
		Slug:       "toko-uji-sweeper",
		StoreTitle: "Toko Uji Sweeper",
	}
	_ = db.Create(&store)

	totalAudited := RunStorageSweep(db)
	if totalAudited != 1 {
		t.Errorf("RunStorageSweep audited = %d, want 1", totalAudited)
	}

	// Verify worker heartbeat updated in tracker
	tracker.mu.RLock()
	worker, exists := tracker.workers["storage_sweeper"]
	tracker.mu.RUnlock()

	if !exists {
		t.Fatalf("worker 'storage_sweeper' not found in tracker")
	}
	if worker.Status != "running" {
		t.Errorf("worker.Status = %q, want 'running'", worker.Status)
	}
	if worker.TotalProcessed < 1 {
		t.Errorf("worker.TotalProcessed = %d, want >= 1", worker.TotalProcessed)
	}

	// Test manual trigger
	auditedManual, err := tracker.TriggerStorageSweeperManual(db)
	if err != nil {
		t.Fatalf("TriggerStorageSweeperManual failed: %v", err)
	}
	if auditedManual != 1 {
		t.Errorf("auditedManual = %d, want 1", auditedManual)
	}
}
