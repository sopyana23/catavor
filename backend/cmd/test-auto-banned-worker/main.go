package main

import (
	"context"
	"fmt"
	"io"
	"sync"
	"time"

	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/glebarez/sqlite"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// MockStorageService records file deletion calls for penetration & cleanup verification
type MockStorageService struct {
	mu          sync.Mutex
	DeletedKeys []string
}

func (m *MockStorageService) Upload(ctx context.Context, key string, r io.Reader, size int64, contentType string) (string, error) {
	return "http://mock/" + key, nil
}

func (m *MockStorageService) Delete(ctx context.Context, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.DeletedKeys = append(m.DeletedKeys, key)
	return nil
}

func (m *MockStorageService) GetURL(key string) string {
	return "http://mock/" + key
}

func (m *MockStorageService) GetDriverName() string {
	return "mock_storage"
}

type TestResult struct {
	VectorID string
	Name     string
	Passed   bool
	Duration time.Duration
	Notes    string
}

var allResults []TestResult

func recordResult(vectorID, name string, passed bool, d time.Duration, notes string) {
	status := "✅ PASS"
	if !passed {
		status = "❌ FAIL"
	}
	fmt.Printf("[%s] [%s] %s (%v)\n    ↳ Catatan: %s\n\n", status, vectorID, name, d.Round(time.Microsecond), notes)
	allResults = append(allResults, TestResult{
		VectorID: vectorID,
		Name:     name,
		Passed:   passed,
		Duration: d,
		Notes:    notes,
	})
}

func setupIsolatedTestDB() (*gorm.DB, error) {
	dbName := fmt.Sprintf("file:test_%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dbName), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	})
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxOpenConns(1) // SQLite serialization
	}

	err = db.AutoMigrate(
		&models.User{},
		&models.Store{},
		&models.SupportTicket{},
		&models.SupportMessage{},
		&models.Product{},
		&models.ProductImage{},
		&models.Notification{},
		&models.ActivityLog{},
	)
	if err != nil {
		return nil, err
	}

	return db, nil
}

func main() {
	zerolog.SetGlobalLevel(zerolog.Disabled)
	log.Logger = log.Output(io.Discard)

	fmt.Println("================================================================================")
	fmt.Println("  PENETRATION & INTEGRITY TEST SUITE: WORKER AUTO-BANNED BOT (MODERATION)")
	fmt.Println("================================================================================")

	// -------------------------------------------------------------------------
	// TEST 1: Baseline Inactive Grace Period Expired (> 30 days, no appeal)
	// -------------------------------------------------------------------------
	{
		start := time.Now()
		db, err := setupIsolatedTestDB()
		if err != nil {
			recordResult("VEC-01", "Inisialisasi DB Pengujian", false, time.Since(start), err.Error())
			return
		}
		mockStorage := &MockStorageService{}

		suspended35DaysAgo := time.Now().AddDate(0, 0, -35)
		user := models.User{
			Name:     "merchant_ghosting",
			Email:    "ghost@example.com",
		}
		db.Create(&user)

		store := models.Store{
			UserID:               user.ID,
			Slug:                 "toko-pelanggar-35hari",
			StoreTitle:           "Toko Pelanggar 35 Hari",
			DormancyStatus:       "suspended",
			SuspensionReason:     "moderation_violation",
			DormancySuspendedAt:  &suspended35DaysAgo,
			IsBlacklisted:        false,
		}
		db.Create(&store)

		// Execute worker
		services.RunModerationEscalationCycle(db, mockStorage)

		var updatedStore models.Store
		db.First(&updatedStore, store.ID)
		var updatedUser models.User
		db.First(&updatedUser, user.ID)

		var notifCount int64
		db.Model(&models.Notification{}).Where("target_id = ? AND category = 'KEAMANAN'", store.ID).Count(&notifCount)
		var auditCount int64
		db.Model(&models.ActivityLog{}).Where("store_id = ? AND action = 'moderation.auto_banned'", store.ID).Count(&auditCount)

		passed := updatedStore.DormancyStatus == "banned" &&
			updatedStore.IsBlacklisted == true &&
			updatedStore.DormancyBannedAt != nil &&
			updatedUser.IsBlacklisted == true &&
			notifCount > 0 &&
			auditCount > 0

		notes := fmt.Sprintf("Store Status: %s, User Blacklisted: %t, Notif: %d, Audit Log: %d",
			updatedStore.DormancyStatus, updatedUser.IsBlacklisted, notifCount, auditCount)
		recordResult("VEC-01", "Eskalasi Otomatis Toko Ghosting (>30 Hari Tanpa Banding)", passed, time.Since(start), notes)
	}

	// -------------------------------------------------------------------------
	// TEST 2: Active Appeal Protection (Grace Period Immunity)
	// -------------------------------------------------------------------------
	{
		start := time.Now()
		db, _ := setupIsolatedTestDB()
		mockStorage := &MockStorageService{}

		suspended40DaysAgo := time.Now().AddDate(0, 0, -40)
		user := models.User{
			Name:     "merchant_appealing",
			Email:    "appeal@example.com",
		}
		db.Create(&user)

		store := models.Store{
			UserID:               user.ID,
			Slug:                 "toko-sedang-banding",
			StoreTitle:           "Toko Sedang Banding",
			DormancyStatus:       "suspended",
			SuspensionReason:     "moderation_violation",
			DormancySuspendedAt:  &suspended40DaysAgo,
			IsBlacklisted:        false,
		}
		db.Create(&store)

		// Active appeal ticket (status: 'open')
		ticket := models.SupportTicket{
			UserID:   user.ID,
			StoreID:  &store.ID,
			Subject:  "Banding Penangguhan Toko Sedang Banding",
			Category: "catalog_help",
			Status:   "open",
			Priority: "high",
		}
		db.Create(&ticket)

		// Execute worker
		services.RunModerationEscalationCycle(db, mockStorage)

		var updatedStore models.Store
		db.First(&updatedStore, store.ID)
		var updatedUser models.User
		db.First(&updatedUser, user.ID)

		// Must remain suspended, NOT banned
		passed := updatedStore.DormancyStatus == "suspended" &&
			updatedStore.IsBlacklisted == false &&
			updatedUser.IsBlacklisted == false

		notes := fmt.Sprintf("Store Status: %s (Harus tetap 'suspended'), Blacklisted: %t",
			updatedStore.DormancyStatus, updatedStore.IsBlacklisted)
		recordResult("VEC-02", "Proteksi Banding Aktif (Kebal Auto-Ban Saat Tiket 'open')", passed, time.Since(start), notes)
	}

	// -------------------------------------------------------------------------
	// TEST 3: In-Progress Appeal Protection
	// -------------------------------------------------------------------------
	{
		start := time.Now()
		db, _ := setupIsolatedTestDB()
		mockStorage := &MockStorageService{}

		suspended45DaysAgo := time.Now().AddDate(0, 0, -45)
		user := models.User{
			Name:     "merchant_under_review",
			Email:    "review@example.com",
		}
		db.Create(&user)

		store := models.Store{
			UserID:               user.ID,
			Slug:                 "toko-investigasi-admin",
			StoreTitle:           "Toko Investigasi Admin",
			DormancyStatus:       "suspended",
			SuspensionReason:     "moderation_violation",
			DormancySuspendedAt:  &suspended45DaysAgo,
		}
		db.Create(&store)

		// Active appeal ticket (status: 'in_progress')
		ticket := models.SupportTicket{
			UserID:   user.ID,
			StoreID:  &store.ID,
			Subject:  "Investigasi Kasus Pelanggaran",
			Category: "catalog_help",
			Status:   "in_progress",
		}
		db.Create(&ticket)

		services.RunModerationEscalationCycle(db, mockStorage)

		var updatedStore models.Store
		db.First(&updatedStore, store.ID)

		passed := updatedStore.DormancyStatus == "suspended" && !updatedStore.IsBlacklisted
		notes := fmt.Sprintf("Store Status: %s, Tiket In Progress menjaga grace status.", updatedStore.DormancyStatus)
		recordResult("VEC-03", "Proteksi Banding Dalam Peninjauan ('in_progress')", passed, time.Since(start), notes)
	}

	// -------------------------------------------------------------------------
	// TEST 4: Rejected / Closed Appeal Escalation
	// -------------------------------------------------------------------------
	{
		start := time.Now()
		db, _ := setupIsolatedTestDB()
		mockStorage := &MockStorageService{}

		suspended32DaysAgo := time.Now().AddDate(0, 0, -32)
		user := models.User{
			Name:     "merchant_appeal_rejected",
			Email:    "rejected@example.com",
		}
		db.Create(&user)

		store := models.Store{
			UserID:               user.ID,
			Slug:                 "toko-banding-ditolak",
			StoreTitle:           "Toko Banding Ditolak",
			DormancyStatus:       "suspended",
			SuspensionReason:     "moderation_violation",
			DormancySuspendedAt:  &suspended32DaysAgo,
		}
		db.Create(&store)

		// Appeal ticket was resolved/closed (appeal rejected by admin)
		ticket := models.SupportTicket{
			UserID:   user.ID,
			StoreID:  &store.ID,
			Subject:  "Banding Ditolak",
			Category: "catalog_help",
			Status:   "closed",
		}
		db.Create(&ticket)

		services.RunModerationEscalationCycle(db, mockStorage)

		var updatedStore models.Store
		db.First(&updatedStore, store.ID)

		passed := updatedStore.DormancyStatus == "banned" && updatedStore.IsBlacklisted
		notes := fmt.Sprintf("Store Status: %s, Tiket 'closed' tidak melindungi dari eskalasi.", updatedStore.DormancyStatus)
		recordResult("VEC-04", "Eskalasi Toko Setelah Banding Selesai / Ditutup ('closed')", passed, time.Since(start), notes)
	}

	// -------------------------------------------------------------------------
	// TEST 5: Boundary Check / False Positive Immunity (< 30 days)
	// -------------------------------------------------------------------------
	{
		start := time.Now()
		db, _ := setupIsolatedTestDB()
		mockStorage := &MockStorageService{}

		suspended25DaysAgo := time.Now().AddDate(0, 0, -25)
		user := models.User{
			Name:     "merchant_day_25",
			Email:    "day25@example.com",
		}
		db.Create(&user)

		store := models.Store{
			UserID:               user.ID,
			Slug:                 "toko-baru-hari-25",
			StoreTitle:           "Toko Baru Hari 25",
			DormancyStatus:       "suspended",
			SuspensionReason:     "moderation_violation",
			DormancySuspendedAt:  &suspended25DaysAgo,
		}
		db.Create(&store)

		services.RunModerationEscalationCycle(db, mockStorage)

		var updatedStore models.Store
		db.First(&updatedStore, store.ID)

		passed := updatedStore.DormancyStatus == "suspended" && !updatedStore.IsBlacklisted
		notes := fmt.Sprintf("Store Status: %s (Harus tetap 'suspended', sisa 5 hari hak sanggah)", updatedStore.DormancyStatus)
		recordResult("VEC-05", "Uji Batas Hari (Hari ke-25 Tidak Boleh Ter-Banned)", passed, time.Since(start), notes)
	}

	// -------------------------------------------------------------------------
	// TEST 6: Non-Moderation Suspension Immunity (Billing/Inactivity)
	// -------------------------------------------------------------------------
	{
		start := time.Now()
		db, _ := setupIsolatedTestDB()
		mockStorage := &MockStorageService{}

		suspended60DaysAgo := time.Now().AddDate(0, 0, -60)
		user := models.User{
			Name:     "merchant_expired_plan",
			Email:    "expired@example.com",
		}
		db.Create(&user)

		store := models.Store{
			UserID:               user.ID,
			Slug:                 "toko-habis-langganan",
			StoreTitle:           "Toko Habis Langganan",
			DormancyStatus:       "suspended",
			SuspensionReason:     "plan_expired", // NOT moderation_violation
			DormancySuspendedAt:  &suspended60DaysAgo,
		}
		db.Create(&store)

		services.RunModerationEscalationCycle(db, mockStorage)

		var updatedStore models.Store
		db.First(&updatedStore, store.ID)

		// Must NOT be touched by moderation bot
		passed := updatedStore.DormancyStatus == "suspended" && !updatedStore.IsBlacklisted
		notes := fmt.Sprintf("Store Status: %s, Alasan: %s (Kebal dari Bot Moderasi)", updatedStore.DormancyStatus, updatedStore.SuspensionReason)
		recordResult("VEC-06", "Isolasi Domain Pelanggaran (Toko Non-Moderasi Kebal Auto-Ban)", passed, time.Since(start), notes)
	}

	// -------------------------------------------------------------------------
	// TEST 7: High Concurrency / Race Condition Simulation
	// -------------------------------------------------------------------------
	{
		start := time.Now()
		db, _ := setupIsolatedTestDB()
		mockStorage := &MockStorageService{}

		suspended35DaysAgo := time.Now().AddDate(0, 0, -35)
		user := models.User{
			Name:     "merchant_concurrent",
			Email:    "concurrent@example.com",
		}
		db.Create(&user)

		store := models.Store{
			UserID:               user.ID,
			Slug:                 "toko-uji-konkurensi",
			StoreTitle:           "Toko Uji Konkurensi",
			DormancyStatus:       "suspended",
			SuspensionReason:     "moderation_violation",
			DormancySuspendedAt:  &suspended35DaysAgo,
		}
		db.Create(&store)

		// Run 10 parallel worker goroutines simultaneously
		var wg sync.WaitGroup
		concurrentWorkers := 10
		for i := 0; i < concurrentWorkers; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				services.RunModerationEscalationCycle(db, mockStorage)
			}()
		}
		wg.Wait()

		var updatedStore models.Store
		db.First(&updatedStore, store.ID)

		var notifCount int64
		db.Model(&models.Notification{}).Where("target_id = ? AND category = 'KEAMANAN'", store.ID).Count(&notifCount)

		passed := updatedStore.DormancyStatus == "banned" && updatedStore.IsBlacklisted
		notes := fmt.Sprintf("10 worker paralel selesai tanpa deadlock. Final Status: %s, Notifikasi Terkirim: %d",
			updatedStore.DormancyStatus, notifCount)
		recordResult("VEC-07", "Stress & Concurrency Test (10 Worker Paralel Serentak)", passed, time.Since(start), notes)
	}

	// -------------------------------------------------------------------------
	// TEST 8: 90-Day Media Purge & Sybil Resistance Tombstone Retention
	// -------------------------------------------------------------------------
	{
		start := time.Now()
		db, _ := setupIsolatedTestDB()
		mockStorage := &MockStorageService{}

		banned100DaysAgo := time.Now().AddDate(0, 0, -100)
		user := models.User{
			Name:          "merchant_banned_100d",
			Email:         "banned100@example.com",
			IsBlacklisted: true,
		}
		db.Create(&user)

		store := models.Store{
			UserID:           user.ID,
			Slug:             "toko-banned-100-hari",
			StoreTitle:       "Toko Banned 100 Hari",
			DormancyStatus:   "banned",
			SuspensionReason: "moderation_violation",
			DormancyBannedAt: &banned100DaysAgo,
			IsBlacklisted:    true,
		}
		db.Create(&store)

		product := models.Product{
			StoreID: store.ID,
			Name:    "Produk Ilegal Telah Di-Ban",
		}
		db.Create(&product)

		imageKey := fmt.Sprintf("stores/%d/products/%d/sample_abuse.jpg", store.ID, product.ID)
		image := models.ProductImage{
			ProductID: product.ID,
			ImageURL:  "http://mock/" + imageKey,
		}
		db.Create(&image)

		// Execute worker
		services.RunModerationEscalationCycle(db, mockStorage)

		// Verify database records still exist (Sybil Resistance Tombstone)
		var checkStore models.Store
		errStore := db.First(&checkStore, store.ID).Error
		var checkUser models.User
		errUser := db.First(&checkUser, user.ID).Error

		// Verify image record was cleaned from product_images table and storage
		var remainingImages int64
		db.Model(&models.ProductImage{}).Where("product_id = ?", product.ID).Count(&remainingImages)

		storageCleaned := len(mockStorage.DeletedKeys) > 0
		tombstonePreserved := (errStore == nil) && (errUser == nil) && checkStore.IsBlacklisted && checkUser.IsBlacklisted

		passed := storageCleaned && tombstonePreserved && (remainingImages == 0)
		notes := fmt.Sprintf("Storage File Dihapus: %d file, Tombstone Toko & User Tetap Terpelihara: %t",
			len(mockStorage.DeletedKeys), tombstonePreserved)
		recordResult("VEC-08", "Pembersihan Media 90 Hari & Proteksi Tombstone Anti-Sybil", passed, time.Since(start), notes)
	}

	// -------------------------------------------------------------------------
	// Final Summary Report
	// -------------------------------------------------------------------------
	total := len(allResults)
	passedCount := 0
	for _, r := range allResults {
		if r.Passed {
			passedCount++
		}
	}

	fmt.Println("================================================================================")
	fmt.Printf("  RINGKASAN HASIL PENETRATION & INTEGRITY TEST: %d/%d LULUS (%.1f%%)\n",
		passedCount, total, float64(passedCount)/float64(total)*100)
	fmt.Println("================================================================================")
	if passedCount == total {
		fmt.Println("  KESIMPULAN: Seluruh aturan proteksi grace period, anti-DoS bagi pemohon banding,")
		fmt.Println("  dan eskalasi otomatis berjalan dengan integritas tinggi & tanpa kebocoran status.")
	} else {
		fmt.Printf("  PERINGATAN: Ditemukan %d skenario yang gagal memenuhi kriteria kepatuhan.\n", total-passedCount)
	}
	fmt.Println("================================================================================")
}
