package services

import (
	"strconv"
	"testing"
	"time"

	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ---------------------------------------------------------------------------
// UpgradeStorePlan / ScheduleStoreDowngrade / CancelStoreDowngrade
//
// Ini jalur uang: setiap kesalahan di sini berarti merchant mendapat masa aktif
// yang salah, atau kehilangan sisa masa aktif yang sudah dibayar. Test memakai
// toleransi waktu, bukan perbandingan waktu persis, karena jam dinding bergerak
// selama test berjalan.
// ---------------------------------------------------------------------------

const timeTolerance = 2 * time.Minute

func newUpgradeDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("buka sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.User{}, &models.Store{}, &models.Product{}, &models.ProductImage{},
		&models.SubscriptionPlan{}, &models.Category{}, &models.SubscriptionOrder{},
	); err != nil {
		t.Fatalf("migrasi: %v", err)
	}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)

	plans := []models.SubscriptionPlan{
		{Code: "free", Name: "Free", MaxItems: 15, StorageLimitBytes: 100 << 20, HasCustomDomain: false, SortOrder: 1},
		{Code: "pro_starter", Name: "Pro Starter", MaxItems: 150, StorageLimitBytes: 2 << 30, HasCustomDomain: true, SortOrder: 2},
		{Code: "pro_business", Name: "Pro Business", MaxItems: -1, StorageLimitBytes: 10 << 30, HasCustomDomain: true, SortOrder: 3},
	}
	for i := range plans {
		plans[i].IsActive = true
		if err := db.Create(&plans[i]).Error; err != nil {
			t.Fatalf("seed plan %s: %v", plans[i].Code, err)
		}
	}
	return db
}

// seedStore membuat toko dengan status langganan yang bisa diatur.
func seedStore(t *testing.T, db *gorm.DB, plan string, expiresAt *time.Time) *models.Store {
	t.Helper()
	u := &models.User{Name: "U", Email: "u" + time.Now().Format("150405.000000") + "@t.test", Password: "x"}
	if err := db.Create(u).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	st := &models.Store{
		UserID:        u.ID,
		Slug:          "toko-" + time.Now().Format("150405.000000"),
		StoreTitle:    "Toko",
		Plan:          plan,
		PlanStatus:    "active",
		PlanExpiresAt: expiresAt,
	}
	if err := db.Create(st).Error; err != nil {
		t.Fatalf("seed store: %v", err)
	}
	return st
}

func reloadStore(t *testing.T, db *gorm.DB, id uint) models.Store {
	t.Helper()
	var st models.Store
	if err := db.First(&st, id).Error; err != nil {
		t.Fatalf("reload store: %v", err)
	}
	return st
}

func assertWithin(t *testing.T, got, want time.Time, label string) {
	t.Helper()
	diff := got.Sub(want)
	if diff < 0 {
		diff = -diff
	}
	if diff > timeTolerance {
		t.Errorf("%s = %s, want ~%s (selisih %s)", label, got.Format(time.RFC3339), want.Format(time.RFC3339), diff)
	}
}

// ---------------------------------------------------------------------------
// Upgrade
// ---------------------------------------------------------------------------

func TestUpgradeStorePlan_UpgradeFromFree(t *testing.T) {
	db := newUpgradeDB(t)
	st := seedStore(t, db, "free", nil)

	quota, err := UpgradeStorePlan(db, st.ID, "pro_starter", 1)
	if err != nil {
		t.Fatalf("UpgradeStorePlan: %v", err)
	}

	got := reloadStore(t, db, st.ID)
	if got.Plan != "pro_starter" {
		t.Errorf("plan = %q, want pro_starter", got.Plan)
	}
	if got.PlanStatus != "active" {
		t.Errorf("plan_status = %q, want active", got.PlanStatus)
	}
	if got.PlanExpiresAt == nil {
		t.Fatal("plan_expires_at nil setelah upgrade ke paket berbayar")
	}
	assertWithin(t, *got.PlanExpiresAt, time.Now().UTC().AddDate(0, 1, 0), "plan_expires_at")
	if got.GracePeriodUntil != nil {
		t.Error("grace_period_until tidak dibersihkan saat upgrade")
	}
	if got.NextPlanCode != nil {
		t.Errorf("next_plan_code = %q, want nil", *got.NextPlanCode)
	}
	if quota == nil {
		t.Fatal("quota nil padahal upgrade berhasil")
	}
	// Kuota harus mengikuti paket baru, bukan paket lama.
	if quota.MaxItems != 150 {
		t.Errorf("quota.MaxItems = %d, want 150 (kuota paket pro_starter)", quota.MaxItems)
	}
}

// Renewal: perpanjangan paket yang sama harus menambah dari tanggal kedaluwarsa
// yang masih berlaku, BUKAN dari hari ini — kalau tidak, sisa masa aktif hangus.
func TestUpgradeStorePlan_RenewalExtendsFromCurrentExpiry(t *testing.T) {
	db := newUpgradeDB(t)
	expiry := time.Now().UTC().AddDate(0, 0, 10)
	st := seedStore(t, db, "pro_starter", &expiry)

	if _, err := UpgradeStorePlan(db, st.ID, "pro_starter", 1); err != nil {
		t.Fatalf("UpgradeStorePlan renewal: %v", err)
	}

	got := reloadStore(t, db, st.ID)
	if got.PlanExpiresAt == nil {
		t.Fatal("plan_expires_at nil setelah renewal")
	}
	want := expiry.AddDate(0, 1, 0)
	assertWithin(t, *got.PlanExpiresAt, want, "plan_expires_at renewal")

	// Penjaga eksplisit: renewal tidak boleh memotong sisa masa aktif.
	if !got.PlanExpiresAt.After(expiry) {
		t.Errorf("renewal memotong masa aktif: expiry baru %s tidak setelah %s",
			got.PlanExpiresAt.Format(time.RFC3339), expiry.Format(time.RFC3339))
	}
}

// Paket yang sudah kedaluwarsa lalu diperpanjang: mulai dari sekarang, bukan
// menumpuk dari tanggal lampau.
func TestUpgradeStorePlan_RenewalAfterExpiryStartsFromNow(t *testing.T) {
	db := newUpgradeDB(t)
	past := time.Now().UTC().AddDate(0, 0, -40)
	st := seedStore(t, db, "pro_starter", &past)

	if _, err := UpgradeStorePlan(db, st.ID, "pro_starter", 1); err != nil {
		t.Fatalf("UpgradeStorePlan: %v", err)
	}

	got := reloadStore(t, db, st.ID)
	if got.PlanExpiresAt == nil {
		t.Fatal("plan_expires_at nil")
	}
	assertWithin(t, *got.PlanExpiresAt, time.Now().UTC().AddDate(0, 1, 0), "plan_expires_at")
	if !got.PlanExpiresAt.After(time.Now().UTC()) {
		t.Error("paket kedaluwarsa diperpanjang tapi tetap di masa lalu")
	}
}

// Ganti paket ke paket lain yang berbeda (bukan renewal): mulai dari sekarang.
func TestUpgradeStorePlan_PlanChangeStartsFromNow(t *testing.T) {
	db := newUpgradeDB(t)
	future := time.Now().UTC().AddDate(0, 3, 0)
	st := seedStore(t, db, "pro_starter", &future)

	if _, err := UpgradeStorePlan(db, st.ID, "pro_business", 1); err != nil {
		t.Fatalf("UpgradeStorePlan: %v", err)
	}

	got := reloadStore(t, db, st.ID)
	if got.Plan != "pro_business" {
		t.Errorf("plan = %q, want pro_business", got.Plan)
	}
	assertWithin(t, *got.PlanExpiresAt, time.Now().UTC().AddDate(0, 1, 0), "plan_expires_at")
}

func TestUpgradeStorePlan_DowngradeToFree(t *testing.T) {
	db := newUpgradeDB(t)
	future := time.Now().UTC().AddDate(0, 1, 0)
	grace := time.Now().UTC().AddDate(0, 0, 7)
	next := "pro_business"
	domain := "toko.example.com"

	st := seedStore(t, db, "pro_starter", &future)
	st.GracePeriodUntil = &grace
	st.NextPlanCode = &next
	st.CustomDomain = &domain
	st.CustomDomainStatus = "active"
	if err := db.Save(st).Error; err != nil {
		t.Fatalf("siapkan store: %v", err)
	}

	if _, err := UpgradeStorePlan(db, st.ID, "free", 1); err != nil {
		t.Fatalf("UpgradeStorePlan free: %v", err)
	}

	got := reloadStore(t, db, st.ID)
	if got.Plan != "free" {
		t.Errorf("plan = %q, want free", got.Plan)
	}
	if got.PlanStatus != "active" {
		t.Errorf("plan_status = %q, want active", got.PlanStatus)
	}
	if got.PlanExpiresAt != nil {
		t.Errorf("plan_expires_at = %v, want nil untuk paket free", got.PlanExpiresAt)
	}
	if got.GracePeriodUntil != nil {
		t.Error("grace_period_until tidak dibersihkan saat turun ke free")
	}
	if got.NextPlanCode != nil {
		t.Error("next_plan_code tidak dibersihkan saat turun ke free")
	}
	// Domain kustom adalah fitur berbayar: harus dicabut saat turun ke free.
	if got.CustomDomainStatus != "inactive_expired" {
		t.Errorf("custom_domain_status = %q, want inactive_expired", got.CustomDomainStatus)
	}
}

func TestUpgradeStorePlan_ReactivatesCustomDomain(t *testing.T) {
	db := newUpgradeDB(t)
	domain := "toko.example.com"
	st := seedStore(t, db, "free", nil)
	st.CustomDomain = &domain
	st.CustomDomainStatus = "inactive_expired"
	if err := db.Save(st).Error; err != nil {
		t.Fatalf("siapkan store: %v", err)
	}

	if _, err := UpgradeStorePlan(db, st.ID, "pro_starter", 1); err != nil {
		t.Fatalf("UpgradeStorePlan: %v", err)
	}

	got := reloadStore(t, db, st.ID)
	if got.CustomDomainStatus != "active" {
		t.Errorf("custom_domain_status = %q, want active (paket baru mendukung domain kustom)", got.CustomDomainStatus)
	}
}

// Domain yang masih "pending" (belum terverifikasi) tidak boleh dipaksa aktif
// hanya karena merchant upgrade paket.
func TestUpgradeStorePlan_DoesNotForcePendingDomain(t *testing.T) {
	db := newUpgradeDB(t)
	domain := "belum-verifikasi.example.com"
	st := seedStore(t, db, "free", nil)
	st.CustomDomain = &domain
	st.CustomDomainStatus = "pending"
	if err := db.Save(st).Error; err != nil {
		t.Fatalf("siapkan store: %v", err)
	}

	if _, err := UpgradeStorePlan(db, st.ID, "pro_starter", 1); err != nil {
		t.Fatalf("UpgradeStorePlan: %v", err)
	}

	got := reloadStore(t, db, st.ID)
	if got.CustomDomainStatus != "pending" {
		t.Errorf("custom_domain_status = %q, want pending (tidak boleh diaktifkan tanpa verifikasi)", got.CustomDomainStatus)
	}
}

func TestUpgradeStorePlan_ClearsScheduledDowngrade(t *testing.T) {
	db := newUpgradeDB(t)
	next := "free"
	st := seedStore(t, db, "pro_starter", nil)
	st.NextPlanCode = &next
	if err := db.Save(st).Error; err != nil {
		t.Fatalf("siapkan store: %v", err)
	}

	if _, err := UpgradeStorePlan(db, st.ID, "pro_business", 1); err != nil {
		t.Fatalf("UpgradeStorePlan: %v", err)
	}

	if got := reloadStore(t, db, st.ID); got.NextPlanCode != nil {
		t.Errorf("next_plan_code = %q, want nil (downgrade terjadwal harus dibatalkan)", *got.NextPlanCode)
	}
}

func TestUpgradeStorePlan_DefaultsToOneMonth(t *testing.T) {
	for _, months := range []int{0, -1, -12} {
		db := newUpgradeDB(t)
		st := seedStore(t, db, "free", nil)

		if _, err := UpgradeStorePlan(db, st.ID, "pro_starter", months); err != nil {
			t.Fatalf("months=%d: %v", months, err)
		}
		got := reloadStore(t, db, st.ID)
		assertWithin(t, *got.PlanExpiresAt, time.Now().UTC().AddDate(0, 1, 0), "plan_expires_at (months="+strconv.Itoa(months)+")")
	}
}

func TestUpgradeStorePlan_MultiMonth(t *testing.T) {
	db := newUpgradeDB(t)
	st := seedStore(t, db, "free", nil)

	if _, err := UpgradeStorePlan(db, st.ID, "pro_business", 12); err != nil {
		t.Fatalf("UpgradeStorePlan 12 bulan: %v", err)
	}
	got := reloadStore(t, db, st.ID)
	assertWithin(t, *got.PlanExpiresAt, time.Now().UTC().AddDate(0, 12, 0), "plan_expires_at 12 bulan")
}

func TestUpgradeStorePlan_StoreNotFound(t *testing.T) {
	db := newUpgradeDB(t)
	if _, err := UpgradeStorePlan(db, 99999, "pro_starter", 1); err == nil {
		t.Error("UpgradeStorePlan untuk toko tidak ada = nil error, want error")
	}
}

// BUG: GetPlanByCode fallback ke paket free saat kode tidak dikenal, sehingga
// kode paket yang salah ketik tetap "berhasil" dan toko terikat ke kode paket
// yang tidak ada. Upgrade harus menolak kode yang tidak dikenal.
func TestUpgradeStorePlan_RejectsUnknownPlanCode(t *testing.T) {
	db := newUpgradeDB(t)
	st := seedStore(t, db, "free", nil)

	if _, err := UpgradeStorePlan(db, st.ID, "pro_starter_typo", 1); err == nil {
		t.Error("kode paket tidak dikenal diterima (fallback diam-diam ke free), want error")
	}

	got := reloadStore(t, db, st.ID)
	if got.Plan != "free" {
		t.Errorf("plan berubah menjadi %q meski upgrade ditolak, want tetap free", got.Plan)
	}
}

// ---------------------------------------------------------------------------
// Downgrade terjadwal
// ---------------------------------------------------------------------------

func TestScheduleStoreDowngrade_SetsNextPlan(t *testing.T) {
	db := newUpgradeDB(t)
	st := seedStore(t, db, "pro_business", nil)

	if _, err := ScheduleStoreDowngrade(db, st.ID, "pro_starter"); err != nil {
		t.Fatalf("ScheduleStoreDowngrade: %v", err)
	}
	got := reloadStore(t, db, st.ID)
	if got.NextPlanCode == nil || *got.NextPlanCode != "pro_starter" {
		t.Errorf("next_plan_code = %v, want pro_starter", got.NextPlanCode)
	}
	// Paket aktif tidak boleh berubah sebelum siklus berakhir.
	if got.Plan != "pro_business" {
		t.Errorf("plan aktif berubah menjadi %q, want tetap pro_business", got.Plan)
	}
}

// Menjadwalkan downgrade ke paket yang sedang aktif = membatalkan jadwal.
func TestScheduleStoreDowngrade_SamePlanCancels(t *testing.T) {
	db := newUpgradeDB(t)
	next := "free"
	st := seedStore(t, db, "pro_starter", nil)
	st.NextPlanCode = &next
	if err := db.Save(st).Error; err != nil {
		t.Fatalf("siapkan store: %v", err)
	}

	if _, err := ScheduleStoreDowngrade(db, st.ID, "pro_starter"); err != nil {
		t.Fatalf("ScheduleStoreDowngrade: %v", err)
	}
	if got := reloadStore(t, db, st.ID); got.NextPlanCode != nil {
		t.Errorf("next_plan_code = %q, want nil", *got.NextPlanCode)
	}
}

func TestScheduleStoreDowngrade_RejectsUnknownPlan(t *testing.T) {
	db := newUpgradeDB(t)
	st := seedStore(t, db, "pro_business", nil)

	if _, err := ScheduleStoreDowngrade(db, st.ID, "paket_hantu"); err == nil {
		t.Error("paket target tidak dikenal diterima, want error")
	}
	if got := reloadStore(t, db, st.ID); got.NextPlanCode != nil {
		t.Errorf("next_plan_code terisi %q untuk paket tidak dikenal", *got.NextPlanCode)
	}
}

func TestScheduleStoreDowngrade_StoreNotFound(t *testing.T) {
	db := newUpgradeDB(t)
	if _, err := ScheduleStoreDowngrade(db, 99999, "free"); err == nil {
		t.Error("ScheduleStoreDowngrade untuk toko tidak ada = nil error, want error")
	}
}

func TestCancelStoreDowngrade(t *testing.T) {
	db := newUpgradeDB(t)
	next := "free"
	st := seedStore(t, db, "pro_business", nil)
	st.NextPlanCode = &next
	if err := db.Save(st).Error; err != nil {
		t.Fatalf("siapkan store: %v", err)
	}

	if _, err := CancelStoreDowngrade(db, st.ID); err != nil {
		t.Fatalf("CancelStoreDowngrade: %v", err)
	}
	if got := reloadStore(t, db, st.ID); got.NextPlanCode != nil {
		t.Errorf("next_plan_code = %q, want nil", *got.NextPlanCode)
	}
}
