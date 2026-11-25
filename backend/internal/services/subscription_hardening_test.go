package services

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func newHardeningDB(t *testing.T) *gorm.DB {
	t.Helper()
	name := strings.NewReplacer("/", "_", " ", "_", "-", "_").Replace(t.Name())
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", name)
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger:  logger.Default.LogMode(logger.Silent),
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		t.Fatalf("buka sqlite hardening: %v", err)
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.Store{},
		&models.Product{},
		&models.ProductImage{},
		&models.SubscriptionPlan{},
		&models.Category{},
		&models.SubscriptionOrder{},
		&models.Setting{},
		&models.Coupon{},
		&models.CouponRedemption{},
		&models.ActivityLog{},
	); err != nil {
		t.Fatalf("migrasi hardening: %v", err)
	}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)

	plans := []models.SubscriptionPlan{
		{
			Code:              "free",
			Name:              "Free",
			MaxItems:          15,
			StorageLimitBytes: 100 << 20,
			PriceMonthly:      0,
			HasCustomDomain:   false,
			HasVerifiedBadge:  false,
			SortOrder:         1,
			IsActive:          true,
		},
		{
			Code:              "pro_starter",
			Name:              "Pro Starter",
			MaxItems:          150,
			StorageLimitBytes: 2 << 30,
			PriceMonthly:      30000,
			HasCustomDomain:   false,
			HasVerifiedBadge:  true,
			SortOrder:         2,
			IsActive:          true,
		},
		{
			Code:              "pro_business",
			Name:              "Pro Bisnis",
			MaxItems:          -1,
			StorageLimitBytes: 10 << 30,
			PriceMonthly:      129000,
			HasCustomDomain:   true,
			HasVerifiedBadge:  true,
			SortOrder:         3,
			IsActive:          true,
		},
	}
	for i := range plans {
		if err := db.Create(&plans[i]).Error; err != nil {
			t.Fatalf("seed plan %s: %v", plans[i].Code, err)
		}
	}
	_ = db.Create(&models.Setting{Key: "payment_system_mode", Value: "manual_qris"}).Error
	return db
}

func seedHardeningUserStore(t *testing.T, db *gorm.DB, slug, plan string, expiresAt *time.Time) (*models.User, *models.Store) {
	t.Helper()
	u := &models.User{
		Name:         "Owner " + slug,
		Email:        slug + "@test.local",
		Password:     "hashed-password",
		PlatformRole: "merchant",
	}
	if err := db.Create(u).Error; err != nil {
		t.Fatalf("seed user %s: %v", slug, err)
	}
	st := &models.Store{
		UserID:        u.ID,
		Slug:          slug,
		StoreTitle:    "Toko " + slug,
		Plan:          plan,
		PlanStatus:    "active",
		PaymentStatus: "paid",
		PlanExpiresAt: expiresAt,
	}
	if plan == "free" {
		st.PaymentStatus = "free_active"
	}
	if err := db.Create(st).Error; err != nil {
		t.Fatalf("seed store %s: %v", slug, err)
	}
	return u, st
}

func TestCreateSubscriptionOrder_BlocksFreeAndOutOfWindowDowngrade(t *testing.T) {
	db := newHardeningDB(t)
	now := time.Now().UTC()
	farExp := now.Add(20 * 24 * time.Hour)
	u, st := seedHardeningUserStore(t, db, "biz-early", "pro_business", &farExp)

	// 1. Order dengan plan_code == free wajib ditolak
	_, _, err := CreateSubscriptionOrder(db, st.ID, u.ID, CreateOrderRequest{
		PlanCode:          "free",
		PaymentMethod:     "qris",
		PaymentProofURL:   "data:image/png;base64,iVBORw0KGgo=",
		SenderAccountName: "Budi",
	})
	if err == nil || !strings.Contains(strings.ToLower(err.Error()), "jadwal penurunan paket") {
		t.Fatalf("order ke plan free seharusnya ditolak dengan arahan jadwal penurunan paket, dapat: %v", err)
	}

	// 2. Downgrade instan pro_business -> pro_starter di luar H-3 wajib ditolak
	_, _, err = CreateSubscriptionOrder(db, st.ID, u.ID, CreateOrderRequest{
		PlanCode:          "pro_starter",
		PaymentMethod:     "qris",
		PaymentProofURL:   "data:image/png;base64,iVBORw0KGgo=",
		SenderAccountName: "Budi",
	})
	if err == nil {
		t.Fatalf("downgrade instan di luar jendela H-3 seharusnya ditolak")
	}

	// 3. Jadwalkan downgrade & masuk jendela H-3 (sisa 2 hari) -> downgrade_renewal diizinkan
	if _, err := ScheduleStoreDowngrade(db, st.ID, "pro_starter"); err != nil {
		t.Fatalf("ScheduleStoreDowngrade gagal: %v", err)
	}
	nearExp := now.Add(48 * time.Hour)
	db.Model(st).Update("plan_expires_at", &nearExp)

	ord, _, err := CreateSubscriptionOrder(db, st.ID, u.ID, CreateOrderRequest{
		PlanCode:          "pro_starter",
		PaymentMethod:     "qris",
		PaymentProofURL:   "data:image/png;base64,iVBORw0KGgo=",
		SenderAccountName: "Budi",
	})
	if err != nil {
		t.Fatalf("downgrade_renewal dalam H-3 seharusnya berhasil, dapat: %v", err)
	}
	if ord.Type != "downgrade_renewal" {
		t.Fatalf("ord.Type = %q, want downgrade_renewal", ord.Type)
	}
}

func TestCreateSubscriptionOrder_MidCycleProrationCredit(t *testing.T) {
	db := newHardeningDB(t)
	now := time.Now().UTC()
	halfExp := now.Add(15 * 24 * time.Hour)
	u, st := seedHardeningUserStore(t, db, "starter-mid", "pro_starter", &halfExp)

	ord, _, err := CreateSubscriptionOrder(db, st.ID, u.ID, CreateOrderRequest{
		PlanCode:          "pro_business",
		PaymentMethod:     "qris",
		PaymentProofURL:   "data:image/png;base64,iVBORw0KGgo=",
		SenderAccountName: "Starter Owner",
	})
	if err != nil {
		t.Fatalf("upgrade mid-cycle gagal: %v", err)
	}
	if ord.ProrationCreditAmount < 14000 || ord.ProrationCreditAmount > 16000 {
		t.Fatalf("proration credit = %.0f, harap sekitar 15000", ord.ProrationCreditAmount)
	}
	wantFinal := 129000 - ord.ProrationCreditAmount
	if ord.FinalAmount != wantFinal {
		t.Fatalf("final_amount = %.0f, want %.0f", ord.FinalAmount, wantFinal)
	}
	if ord.Type != "upgrade" {
		t.Fatalf("type = %q, want upgrade", ord.Type)
	}
}

func TestCreateSubscriptionOrder_NoSilentCouponDropManualProofAndMaintenance(t *testing.T) {
	db := newHardeningDB(t)
	u, st := seedHardeningUserStore(t, db, "manual-strict", "free", nil)

	// Invalid coupon must fail (no silent drop)
	if _, _, err := CreateSubscriptionOrder(db, st.ID, u.ID, CreateOrderRequest{
		PlanCode:          "pro_starter",
		CouponCode:        "KUPONGAADA",
		PaymentMethod:     "qris",
		PaymentProofURL:   "data:image/png;base64,iVBORw0KGgo=",
		SenderAccountName: "Buyer",
	}); err == nil {
		t.Fatalf("kupon invalid seharusnya langsung ditolak, bukan silent drop")
	}

	// Paid manual order without proof & sender name must fail
	if _, _, err := CreateSubscriptionOrder(db, st.ID, u.ID, CreateOrderRequest{
		PlanCode:      "pro_starter",
		PaymentMethod: "qris",
	}); err == nil {
		t.Fatalf("order manual berbayar tanpa bukti dan nama pengirim wajib ditolak")
	}

	// Spoofing payment_mode=gateway_aulaa while server is manual_qris must be rejected
	if _, _, err := CreateSubscriptionOrder(db, st.ID, u.ID, CreateOrderRequest{
		PlanCode:          "pro_starter",
		PaymentMode:       "gateway_aulaa",
		PaymentMethod:     "qris",
		PaymentProofURL:   "data:image/png;base64,iVBORw0KGgo=",
		SenderAccountName: "Buyer",
	}); err == nil {
		t.Fatalf("percobaan switch mode ke gateway_aulaa saat server manual wajib ditolak")
	}

	// Maintenance blocks even 100%-free coupon
	if _, err := CreateCoupon(db, MasterCoupon{
		Code: "GRATIS100", Label: "Free", Type: "free", UsageLimit: 10, MaxUsesPerStore: 1, IsActive: true,
	}); err != nil {
		t.Fatalf("CreateCoupon gagal: %v", err)
	}
	db.Model(&models.Setting{}).Where("key = ?", "payment_system_mode").Update("value", "maintenance")
	if _, _, err := CreateSubscriptionOrder(db, st.ID, u.ID, CreateOrderRequest{
		PlanCode:   "pro_starter",
		CouponCode: "GRATIS100",
	}); err == nil || !strings.Contains(err.Error(), "PAYMENT_GATEWAY_MAINTENANCE") {
		t.Fatalf("mode maintenance harus memblokir order kupon 100%%, dapat: %v", err)
	}
}

func TestUpgradeStorePlan_DeactivatesDomainArchivesAndRestores(t *testing.T) {
	db := newHardeningDB(t)
	now := time.Now().UTC()
	exp := now.Add(5 * 24 * time.Hour)
	_, st := seedHardeningUserStore(t, db, "biz-domain", "pro_business", &exp)
	dom := "toko.kustom.id"
	db.Model(st).Updates(map[string]interface{}{
		"custom_domain":        &dom,
		"custom_domain_status": "active",
	})

	// Seed 20 products (over free limit 15)
	for i := 1; i <= 20; i++ {
		if err := db.Create(&models.Product{
			StoreID:  st.ID,
			Name:     fmt.Sprintf("Produk %02d", i),
			Price:    10000,
			IsActive: true,
		}).Error; err != nil {
			t.Fatalf("seed product %d: %v", i, err)
		}
	}

	// Downgrade ke pro_starter (HasCustomDomain == false) menonaktifkan custom domain
	if _, err := UpgradeStorePlan(db, st.ID, "pro_starter", 1); err != nil {
		t.Fatalf("downgrade ke pro_starter gagal: %v", err)
	}
	var afterStarter models.Store
	db.First(&afterStarter, st.ID)
	if afterStarter.CustomDomainStatus != "inactive_expired" {
		t.Fatalf("custom_domain_status setelah turun ke pro_starter = %q, want inactive_expired", afterStarter.CustomDomainStatus)
	}

	// Downgrade ke free (max 15) mengarsipkan 5 produk berlebih
	if _, err := UpgradeStorePlan(db, st.ID, "free", 1); err != nil {
		t.Fatalf("downgrade ke free gagal: %v", err)
	}
	var activeCnt, archivedCnt int64
	db.Model(&models.Product{}).Where("store_id = ? AND archived_at IS NULL", st.ID).Count(&activeCnt)
	db.Model(&models.Product{}).Where("store_id = ? AND archived_at IS NOT NULL", st.ID).Count(&archivedCnt)
	if activeCnt != 15 || archivedCnt != 5 {
		t.Fatalf("active=%d archived=%d, want 15 and 5", activeCnt, archivedCnt)
	}

	// Re-upgrade ke pro_starter (max 150) & bulk restore 5 produk terarsip
	if _, err := UpgradeStorePlan(db, st.ID, "pro_starter", 1); err != nil {
		t.Fatalf("re-upgrade gagal: %v", err)
	}
	restored, quota, err := RestoreArchivedProducts(db, st.ID)
	if err != nil {
		t.Fatalf("RestoreArchivedProducts gagal: %v", err)
	}
	if restored != 5 || quota.ActiveItemsCount != 20 {
		t.Fatalf("restored=%d active=%d, want 5 and 20", restored, quota.ActiveItemsCount)
	}
}

func TestOrderStateMachine_ApproveRejectResetExpireAndCouponQuota(t *testing.T) {
	db := newHardeningDB(t)
	u, st := seedHardeningUserStore(t, db, "quota-cycle", "free", nil)

	if _, err := CreateCoupon(db, MasterCoupon{
		Code: "HEMAT10", Label: "Potongan 10k", Type: "discount", Discount: 10000, UsageLimit: 5, MaxUsesPerStore: 1, IsActive: true,
	}); err != nil {
		t.Fatalf("CreateCoupon: %v", err)
	}

	// 1. Create order -> kuota terpakai 1 & status pending_verification (ada bukti)
	ord1, _, err := CreateSubscriptionOrder(db, st.ID, u.ID, CreateOrderRequest{
		PlanCode:          "pro_starter",
		CouponCode:        "HEMAT10",
		PaymentMethod:     "qris",
		PaymentProofURL:   "data:image/png;base64,iVBORw0KGgo=",
		SenderAccountName: "Tester",
	})
	if err != nil {
		t.Fatalf("CreateSubscriptionOrder: %v", err)
	}
	var cpn models.Coupon
	db.Where("code = ?", "HEMAT10").First(&cpn)
	if cpn.UsedCount != 1 {
		t.Fatalf("used_count setelah create order = %d, want 1", cpn.UsedCount)
	}

	// 2. Reject order -> kuota kembali 0 dan redemption released, sehingga toko boleh order ulang
	if _, err := RejectSubscriptionOrder(db, ord1.ID, 99, "Bukti buram"); err != nil {
		t.Fatalf("RejectSubscriptionOrder: %v", err)
	}
	db.Where("code = ?", "HEMAT10").First(&cpn)
	if cpn.UsedCount != 0 {
		t.Fatalf("used_count setelah reject = %d, want 0", cpn.UsedCount)
	}

	// 3. Approve rejected order harus ditolak dengan INVALID_ORDER_STATE
	if _, _, err := ApproveSubscriptionOrder(db, ord1.ID, 99); err == nil || !strings.Contains(err.Error(), "INVALID_ORDER_STATE") {
		t.Fatalf("approve order rejected harus gagal dengan INVALID_ORDER_STATE, dapat: %v", err)
	}

	// 4. Order ulang dengan kupon sama (karena sebelumnya released) + simulate expiry -> kuota dilepas lagi
	ord2, _, err := CreateSubscriptionOrder(db, st.ID, u.ID, CreateOrderRequest{
		PlanCode:          "pro_starter",
		CouponCode:        "HEMAT10",
		PaymentMethod:     "qris",
		PaymentProofURL:   "data:image/png;base64,iVBORw0KGgo=",
		SenderAccountName: "Tester",
	})
	if err != nil {
		t.Fatalf("order ulang setelah reject gagal: %v", err)
	}
	past := time.Now().UTC().Add(-10 * time.Minute)
	db.Model(&models.SubscriptionOrder{}).Where("id = ?", ord2.ID).Updates(map[string]interface{}{
		"payment_status": "pending",
		"expires_at":     &past,
	})
	if err := ProcessExpiredPendingOrders(db); err != nil {
		t.Fatalf("ProcessExpiredPendingOrders: %v", err)
	}
	db.Where("code = ?", "HEMAT10").First(&cpn)
	if cpn.UsedCount != 0 {
		t.Fatalf("used_count setelah expire = %d, want 0", cpn.UsedCount)
	}

	// 5. Approve order expired harus ditolak
	if _, _, err := ApproveSubscriptionOrder(db, ord2.ID, 99); err == nil || !strings.Contains(err.Error(), "INVALID_ORDER_STATE") {
		t.Fatalf("approve order expired harus gagal dengan INVALID_ORDER_STATE, dapat: %v", err)
	}

	// 6. Test max_uses_per_store across Store A and Store B + historical order reset reconciliation
	ordA, _, err := CreateSubscriptionOrder(db, st.ID, u.ID, CreateOrderRequest{
		PlanCode:          "pro_starter",
		CouponCode:        "HEMAT10",
		PaymentMethod:     "qris",
		PaymentProofURL:   "data:image/png;base64,iVBORw0KGgo=",
		SenderAccountName: "Tester",
	})
	if err != nil {
		t.Fatalf("ordA gagal: %v", err)
	}
	if _, _, err := ApproveSubscriptionOrder(db, ordA.ID, 99); err != nil {
		t.Fatalf("Approve ordA gagal: %v", err)
	}
	// Second use by same store exceeds MaxUsesPerStore=1
	if _, _, err := CreateSubscriptionOrder(db, st.ID, u.ID, CreateOrderRequest{
		PlanCode:          "pro_starter",
		CouponCode:        "HEMAT10",
		PaymentMethod:     "qris",
		PaymentProofURL:   "data:image/png;base64,iVBORw0KGgo=",
		SenderAccountName: "Tester",
	}); err == nil {
		t.Fatalf("toko sama tidak boleh melebihi max_uses_per_store=1")
	}
	// Store B succeeds
	uB, stB := seedHardeningUserStore(t, db, "quota-b", "free", nil)
	if _, _, err := CreateSubscriptionOrder(db, stB.ID, uB.ID, CreateOrderRequest{
		PlanCode:          "pro_starter",
		CouponCode:        "HEMAT10",
		PaymentMethod:     "qris",
		PaymentProofURL:   "data:image/png;base64,iVBORw0KGgo=",
		SenderAccountName: "Buyer B",
	}); err != nil {
		t.Fatalf("toko B seharusnya boleh memakai kupon HEMAT10, dapat: %v", err)
	}

	// Reset ordA back to pending_verification reverts st to free (no other active paid order)
	if _, err := ResetSubscriptionOrderToPending(db, ordA.ID, 99); err != nil {
		t.Fatalf("ResetSubscriptionOrderToPending gagal: %v", err)
	}
	var revertedStore models.Store
	db.First(&revertedStore, st.ID)
	if revertedStore.Plan != "free" {
		t.Fatalf("store plan setelah revert satu-satunya order paid = %q, want free", revertedStore.Plan)
	}
}

func TestCreateSubscriptionOrder_BlocksDuplicatePendingOrder(t *testing.T) {
	db := newHardeningDB(t)
	u, st := seedHardeningUserStore(t, db, "dup-pending", "free", nil)

	if _, err := CreateCoupon(db, MasterCoupon{
		Code: "HEMATDUP", Label: "Potongan 10k", Type: "discount", Discount: 10000, UsageLimit: 5, MaxUsesPerStore: 1, IsActive: true,
	}); err != nil {
		t.Fatalf("seed coupon: %v", err)
	}

	ord1, _, err := CreateSubscriptionOrder(db, st.ID, u.ID, CreateOrderRequest{
		PlanCode:          "pro_starter",
		CouponCode:        "HEMATDUP",
		PaymentMethod:     "qris",
		PaymentProofURL:   "data:image/png;base64,iVBORw0KGgo=",
		SenderAccountName: "Tester",
	})
	if err != nil {
		t.Fatalf("order pertama gagal: %v", err)
	}

	// Second concurrent/duplicate upgrade attempt while pending_verification exists MUST fail with PENDING_ORDER_EXISTS
	if _, _, err := CreateSubscriptionOrder(db, st.ID, u.ID, CreateOrderRequest{
		PlanCode:          "pro_business",
		PaymentMethod:     "qris",
		PaymentProofURL:   "data:image/png;base64,iVBORw0KGgo=",
		SenderAccountName: "Tester",
	}); err == nil || !strings.Contains(err.Error(), "PENDING_ORDER_EXISTS") {
		t.Fatalf("duplikat order harus ditolak PENDING_ORDER_EXISTS, dapat: %v", err)
	}

	var ordCount int64
	db.Model(&models.SubscriptionOrder{}).Where("store_id = ?", st.ID).Count(&ordCount)
	if ordCount != 1 {
		t.Fatalf("order count = %d, want 1", ordCount)
	}

	// Same store cannot cancel pending_verification order directly
	if _, _, err := CancelPendingSubscriptionOrder(db, st.ID, ord1.ID); err == nil || !strings.Contains(err.Error(), "CANNOT_CANCEL_VERIFYING") {
		t.Fatalf("cancel pending_verification harus ditolak CANNOT_CANCEL_VERIFYING, dapat: %v", err)
	}
}

func TestCancelPendingSubscriptionOrder_RulesAndIDOR(t *testing.T) {
	db := newHardeningDB(t)
	_ = db.Where("key = ?", "payment_system_mode").Delete(&models.Setting{}).Error
	if err := db.Create(&models.Setting{Key: "payment_system_mode", Value: "gateway_aulaa"}).Error; err != nil {
		t.Fatalf("seed mode: %v", err)
	}

	uA, stA := seedHardeningUserStore(t, db, "cancel-a", "free", nil)
	_, stB := seedHardeningUserStore(t, db, "cancel-b", "free", nil)

	if _, err := CreateCoupon(db, MasterCoupon{
		Code: "BATAL20", Label: "Potongan 20k", Type: "discount", Discount: 20000, UsageLimit: 5, MaxUsesPerStore: 1, IsActive: true,
	}); err != nil {
		t.Fatalf("seed coupon: %v", err)
	}

	ord, _, err := CreateSubscriptionOrder(db, stA.ID, uA.ID, CreateOrderRequest{
		PlanCode:      "pro_starter",
		CouponCode:    "BATAL20",
		PaymentMethod: "qris",
	})
	if err != nil {
		t.Fatalf("create pending gateway order: %v", err)
	}
	if ord.PaymentStatus != "pending" {
		t.Fatalf("status = %q, want pending", ord.PaymentStatus)
	}

	// Creating another order before cancel must fail
	if _, _, err := CreateSubscriptionOrder(db, stA.ID, uA.ID, CreateOrderRequest{
		PlanCode:      "pro_business",
		PaymentMethod: "qris",
	}); err == nil || !strings.Contains(err.Error(), "PENDING_ORDER_EXISTS") {
		t.Fatalf("harus ditolak sebelum cancel, dapat: %v", err)
	}

	// Cross-store IDOR cancel attempt must fail with ORDER_NOT_FOUND
	if _, _, err := CancelPendingSubscriptionOrder(db, stB.ID, ord.ID); err == nil || !strings.Contains(err.Error(), "ORDER_NOT_FOUND") {
		t.Fatalf("IDOR cancel harus ditolak ORDER_NOT_FOUND, dapat: %v", err)
	}

	// Owner cancels unpaid pending order -> succeeds, releases coupon, allows switching to pro_business
	cancelled, quota, err := CancelPendingSubscriptionOrder(db, stA.ID, ord.ID)
	if err != nil {
		t.Fatalf("owner cancel gagal: %v", err)
	}
	if cancelled.PaymentStatus != "cancelled" {
		t.Fatalf("cancelled status = %q, want cancelled", cancelled.PaymentStatus)
	}
	if quota == nil || quota.PendingOrder != nil {
		t.Fatalf("pending_order pada quota seharusnya nil setelah cancel")
	}

	ord2, _, err := CreateSubscriptionOrder(db, stA.ID, uA.ID, CreateOrderRequest{
		PlanCode:      "pro_business",
		CouponCode:    "BATAL20",
		PaymentMethod: "qris",
	})
	if err != nil {
		t.Fatalf("order baru setelah cancel & pelepasan kupon gagal: %v", err)
	}
	if ord2.PlanCode != "pro_business" {
		t.Fatalf("plan baru = %q, want pro_business", ord2.PlanCode)
	}
}
