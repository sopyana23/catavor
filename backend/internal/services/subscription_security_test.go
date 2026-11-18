package services

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func openSubscriptionSecTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger:  logger.Default.LogMode(logger.Silent),
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.Store{},
		&models.SubscriptionPlan{},
		&models.SubscriptionOrder{},
		&models.Product{},
		&models.Setting{},
		&models.EmailJob{},
	); err != nil {
		t.Fatalf("automigrate: %v", err)
	}
	if err := SeedSubscriptionPlans(db); err != nil {
		t.Fatalf("seed plans: %v", err)
	}
	return db
}

func TestSEC01_PaymentBypassPreventedInScheduleDowngradeAndGraceExpiry(t *testing.T) {
	db := openSubscriptionSecTestDB(t)
	now := time.Now().UTC()

	user := models.User{Name: "Owner", Email: "owner@sec01.test", Password: "x", PlatformRole: "merchant"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	// 1. Toko pada paket FREE dilarang menjadwalkan ke paket berbayar maupun paket free.
	freeStore := models.Store{
		UserID:         user.ID,
		Slug:           "toko-free",
		StoreTitle:     "Toko Free",
		WhatsappNumber: "0811111111",
		Plan:           "free",
		PlanStatus:     "active",
	}
	if err := db.Create(&freeStore).Error; err != nil {
		t.Fatalf("create free store: %v", err)
	}
	if _, err := ScheduleStoreDowngrade(db, freeStore.ID, "pro_business"); err == nil {
		t.Fatal("SEC-01 regression: free store was allowed to schedule pro_business via ScheduleStoreDowngrade")
	}

	// 2. Toko pada paket pro_starter dilarang menjadwalkan "downgrade" ke pro_business (tier lebih tinggi).
	expFuture := now.Add(15 * 24 * time.Hour)
	starterStore := models.Store{
		UserID:         user.ID,
		Slug:           "toko-starter",
		StoreTitle:     "Toko Starter",
		WhatsappNumber: "0812222222",
		Plan:           "pro_starter",
		PlanStatus:     "active",
		PlanExpiresAt:  &expFuture,
	}
	if err := db.Create(&starterStore).Error; err != nil {
		t.Fatalf("create starter store: %v", err)
	}
	if _, err := ScheduleStoreDowngrade(db, starterStore.ID, "pro_business"); err == nil {
		t.Fatal("SEC-01 regression: pro_starter store was allowed to schedule upgrade to pro_business via ScheduleStoreDowngrade")
	}

	// 3. Toko pro_business BOLEH menjadwalkan target ke pro_starter untuk checkout H-3,
	// TETAPI bila masa aktif + grace period 7 hari habis TANPA pembayaran, WAJIB turun ke FREE (bukan pro_starter gratis seumur hidup!).
	expPast := now.Add(-10 * 24 * time.Hour)
	gracePast := now.Add(-2 * 24 * time.Hour)
	bizStore := models.Store{
		UserID:             user.ID,
		Slug:               "toko-biz",
		StoreTitle:         "Toko Biz",
		WhatsappNumber:     "0813333333",
		Plan:               "pro_business",
		PlanStatus:         "grace_period",
		PlanExpiresAt:      &expPast,
		GracePeriodUntil:   &gracePast,
		CustomDomainStatus: "active",
	}
	if err := db.Create(&bizStore).Error; err != nil {
		t.Fatalf("create biz store: %v", err)
	}
	if _, err := ScheduleStoreDowngrade(db, bizStore.ID, "pro_starter"); err != nil {
		t.Fatalf("valid downgrade pro_business -> pro_starter rejected: %v", err)
	}

	// Buat 20 produk aktif (kuota free = 15, sehingga 5 produk terlama wajib diarsipkan batch).
	for i := 1; i <= 20; i++ {
		p := models.Product{
			StoreID:     bizStore.ID,
			Name:        fmt.Sprintf("Produk %d", i),
			ProductType: "physical",
			Price:       10000,
			IsActive:    true,
			CreatedAt:   now.Add(time.Duration(i) * time.Minute),
		}
		if err := db.Create(&p).Error; err != nil {
			t.Fatalf("create product %d: %v", i, err)
		}
	}

	if err := ProcessSubscriptionLifecycle(db); err != nil {
		t.Fatalf("ProcessSubscriptionLifecycle: %v", err)
	}

	var reloaded models.Store
	if err := db.First(&reloaded, bizStore.ID).Error; err != nil {
		t.Fatalf("reload bizStore: %v", err)
	}
	if reloaded.Plan != "free" {
		t.Fatalf("SEC-01 CRITICAL regression: unpaid expired store transitioned to %q instead of 'free'", reloaded.Plan)
	}
	if reloaded.NextPlanCode != nil || reloaded.GracePeriodUntil != nil || reloaded.PlanExpiresAt != nil {
		t.Fatalf("expected lifecycle fields cleared after downgrade to free, got %+v", reloaded)
	}
	if reloaded.CustomDomainStatus != "inactive_expired" {
		t.Fatalf("expected custom domain disabled on downgrade to free, got %q", reloaded.CustomDomainStatus)
	}

	var activeCount int64
	db.Model(&models.Product{}).Where("store_id = ? AND is_active = ?", bizStore.ID, true).Count(&activeCount)
	if activeCount != 15 {
		t.Fatalf("expected batch archive to leave 15 active items, got %d", activeCount)
	}
}

func TestSEC04_LifecycleEmailPermanentDedupAndCancelNoop(t *testing.T) {
	db := openSubscriptionSecTestDB(t)
	now := time.Now().UTC()
	expH2 := now.Add(48 * time.Hour)

	user := models.User{Name: "Merchant", Email: "merchant@sec04.test", Password: "x", PlatformRole: "merchant"}
	db.Create(&user)
	store := models.Store{
		UserID:         user.ID,
		Slug:           "toko-h3",
		StoreTitle:     "Toko H3",
		WhatsappNumber: "0814444444",
		Plan:           "pro_starter",
		PlanStatus:     "active",
		PlanExpiresAt:  &expH2,
	}
	db.Create(&store)

	if err := ProcessSubscriptionLifecycle(db); err != nil {
		t.Fatalf("1st cycle: %v", err)
	}
	// Simulasikan email pertama sudah dibuat 2 jam lalu (> batas 10 menit lama) agar menguji dedup permanen!
	db.Model(&models.EmailJob{}).Where("category = ?", "subscription_renewal_reminder_h3").
		Update("created_at", now.Add(-2*time.Hour))

	for i := 0; i < 4; i++ {
		if err := ProcessSubscriptionLifecycle(db); err != nil {
			t.Fatalf("cycle %d: %v", i+2, err)
		}
	}

	var h3Count int64
	db.Model(&models.EmailJob{}).Where("category = ?", "subscription_renewal_reminder_h3").Count(&h3Count)
	if h3Count != 1 {
		t.Fatalf("SEC-04 regression: expected exactly 1 H-3 reminder email across hourly runs, got %d", h3Count)
	}

	// CancelStoreDowngrade saat NextPlanCode == nil TIDAK boleh membuat EmailJob apa pun.
	prevGlobal := globalEmailQueue
	globalEmailQueue = &EmailQueueService{db: db}
	defer func() { globalEmailQueue = prevGlobal }()

	for i := 0; i < 3; i++ {
		if _, err := CancelStoreDowngrade(db, store.ID); err != nil {
			t.Fatalf("CancelStoreDowngrade noop: %v", err)
		}
	}
	var cancelMailCount int64
	db.Model(&models.EmailJob{}).Where("category = ?", "subscription_downgrade_cancelled").Count(&cancelMailCount)
	if cancelMailCount != 0 {
		t.Fatalf("expected 0 cancel emails when NextPlanCode was already nil, got %d", cancelMailCount)
	}
}

func TestSEC09_RenewalWindowValidatedBeforeExternalGatewayCall(t *testing.T) {
	db := openSubscriptionSecTestDB(t)
	now := time.Now().UTC()
	expFar := now.Add(20 * 24 * time.Hour)

	var gatewayHits int32
	mockGateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&gatewayHits, 1)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"gw-1","payment_link":"https://pay.example/1"}`))
	}))
	defer mockGateway.Close()

	db.Create(&models.Setting{Key: "payment_system_mode", Value: "gateway_aulaa"})
	db.Create(&models.Setting{Key: "aulaa_base_url", Value: mockGateway.URL})
	db.Create(&models.Setting{Key: "aulaa_api_key", Value: "live_real_key_for_test_123456"})

	user := models.User{Name: "Early Renewer", Email: "early@sec09.test", Password: "x", PlatformRole: "merchant"}
	db.Create(&user)
	store := models.Store{
		UserID:         user.ID,
		Slug:           "toko-early",
		StoreTitle:     "Toko Early",
		WhatsappNumber: "0815555555",
		Plan:           "pro_starter",
		PlanStatus:     "active",
		PlanExpiresAt:  &expFar,
	}
	db.Create(&store)

	_, _, err := CreateSubscriptionOrder(db, store.ID, user.ID, CreateOrderRequest{
		PlanCode:      "pro_starter",
		PaymentMode:   "gateway_aulaa",
		PaymentMethod: "qris",
	})
	if err == nil || !strings.Contains(err.Error(), "H-3") {
		t.Fatalf("expected early renewal rejection mentioning H-3, got err=%v", err)
	}
	if got := atomic.LoadInt32(&gatewayHits); got != 0 {
		t.Fatalf("SEC-09 regression: external gateway was called %d times BEFORE H-3 validation rejected the order!", got)
	}
}
