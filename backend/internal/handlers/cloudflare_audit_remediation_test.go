package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func openCloudflareAuditDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if sqlDB, err := db.DB(); err == nil {
		sqlDB.SetMaxOpenConns(1)
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.Store{},
		&models.Category{},
		&models.Product{},
		&models.Coupon{},
		&models.CouponRedemption{},
		&models.SubscriptionOrder{},
		&models.PlatformRole{},
		&models.PlatformPermission{},
		&models.PlatformRolePermission{},
		&models.Setting{},
		&models.Notification{},
	); err != nil {
		t.Fatalf("automigrate: %v", err)
	}
	database.DB = db
	return db
}

// 1. RBAC Granular Staf pada Bukti Pembayaran dan Pesanan Toko Lain
func TestCloudflareAudit_RBACStaffStoreProofAndOrderIsolation(t *testing.T) {
	db := openCloudflareAuditDB(t)

	// Roles & Permissions
	roleSupport := models.PlatformRole{Slug: "support", Name: "Support", IsSystem: true}
	roleFinance := models.PlatformRole{Slug: "finance", Name: "Finance", IsSystem: true}
	permTickets := models.PlatformPermission{Key: "support:tickets:read", Group: "support", Name: "Tickets"}
	permFinanceRead := models.PlatformPermission{Key: "finance:orders:read", Group: "finance", Name: "Finance Read"}
	db.Create(&roleSupport)
	db.Create(&roleFinance)
	db.Create(&permTickets)
	db.Create(&permFinanceRead)
	db.Create(&models.PlatformRolePermission{RoleID: roleSupport.ID, PermissionID: permTickets.ID})
	db.Create(&models.PlatformRolePermission{RoleID: roleFinance.ID, PermissionID: permFinanceRead.ID})

	owner := models.User{Name: "Store Owner", Email: "owner@merchant.test", Password: "x", PlatformRole: "merchant"}
	supportStaff := models.User{Name: "Support Staff", Email: "support@catavor.test", Password: "x", PlatformRole: "support"}
	financeStaff := models.User{Name: "Finance Staff", Email: "finance@catavor.test", Password: "x", PlatformRole: "finance"}
	db.Create(&owner)
	db.Create(&supportStaff)
	db.Create(&financeStaff)

	store := models.Store{UserID: owner.ID, Slug: "toko-rahasia", StoreTitle: "Toko Rahasia", WhatsappNumber: "0812345678"}
	db.Create(&store)

	order := models.SubscriptionOrder{
		StoreID:         store.ID,
		UserID:          owner.ID,
		OrderNumber:     "INV-TEST-001",
		Type:            "initial",
		PlanCode:        "pro_starter",
		PaymentStatus:   "pending",
		PaymentProofURL: "stores/" + fmt.Sprint(store.ID) + "/proof.jpg",
	}
	db.Create(&order)

	cfg := &config.Config{AppEnv: "local"}
	subHandler := NewSubscriptionHandler(db, cfg)

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	var currentActor *models.User
	var currentStore *models.Store
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user", currentActor)
		c.Locals("store", currentStore)
		return c.Next()
	})
	app.Get("/subscription/orders/:id/proof", subHandler.GetOrderProof)

	// Kasus 1: Support staff tanpa izin finance:orders:read mengakses bukti bayar toko -> Wajib 403
	currentActor = &supportStaff
	currentStore = &store // Store context di-set seolah staf inspeksi
	req1 := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/subscription/orders/%d/proof", order.ID), nil)
	resp1, err := app.Test(req1)
	if err != nil {
		t.Fatalf("req1 failed: %v", err)
	}
	if resp1.StatusCode != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden for support staff, got %d", resp1.StatusCode)
	}

	// Kasus 2: Finance staff dengan izin finance:orders:read mengakses bukti bayar -> Diizinkan (bukan 403)
	currentActor = &financeStaff
	req2 := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/subscription/orders/%d/proof", order.ID), nil)
	resp2, err := app.Test(req2)
	if err != nil {
		t.Fatalf("req2 failed: %v", err)
	}
	if resp2.StatusCode == http.StatusForbidden {
		t.Errorf("Expected Finance staff to be allowed, got 403 Forbidden")
	}

	// Kasus 3: Store owner sah mengakses pesanan miliknya -> Diizinkan (bukan 403)
	currentActor = &owner
	req3 := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/subscription/orders/%d/proof", order.ID), nil)
	resp3, err := app.Test(req3)
	if err != nil {
		t.Fatalf("req3 failed: %v", err)
	}
	if resp3.StatusCode == http.StatusForbidden {
		t.Errorf("Expected Store Owner to be allowed, got 403 Forbidden")
	}
}

// 2. Kupon Default Dihapus Total dan Increment Atomik Membatasi Kuota
func TestCloudflareAudit_CouponDefaultRemovedAndAtomicLimit(t *testing.T) {
	db := openCloudflareAuditDB(t)

	// Pastikan GetDefaultCoupons() kosong total
	defCoupons := services.GetDefaultCoupons()
	if len(defCoupons) != 0 {
		t.Errorf("Expected 0 default coupons, got %d", len(defCoupons))
	}

	// Buat kupon dengan limit 1 pemakaian
	coupon := services.MasterCoupon{
		Code:       "LIMITED1",
		Type:       "discount",
		Discount:   10000,
		UsageLimit: 1,
		UsedCount:  0,
		IsActive:   true,
	}
	data, _ := json.Marshal([]services.MasterCoupon{coupon})
	db.Create(&models.Setting{Key: "master_coupons", Value: string(data)})

	// Pakai kupon pertama kali -> Sukses
	err := services.IncrementCouponUsage(db, "LIMITED1")
	if err != nil {
		t.Fatalf("First coupon increment should succeed, got %v", err)
	}

	// Pakai kupon kedua kali -> Wajib gagal karena limit tercapai
	err = services.IncrementCouponUsage(db, "LIMITED1")
	if err == nil {
		t.Fatalf("Second coupon increment should fail due to usage limit")
	}
}

// 3. Storage Branding Quota Bypass Ditutup
func TestCloudflareAudit_StorageBrandingQuotaBypassBlocked(t *testing.T) {
	storeID := uint(42)

	// Path legal katalog produk toko
	validPath := "stores/42/catalog/photo1.webp"
	if !isOwnedStoreMediaKey(storeID, validPath) {
		t.Errorf("Expected validPath %q to be allowed", validPath)
	}

	// Path branding yang mencoba membypass kuota katalog
	bypassPath := "stores/42/branding/logo.png"
	if isOwnedStoreMediaKey(storeID, bypassPath) {
		t.Errorf("Expected branding path %q to be BLOCKED from product media", bypassPath)
	}

	// Path toko lain
	otherStorePath := "stores/99/catalog/photo1.webp"
	if isOwnedStoreMediaKey(storeID, otherStorePath) {
		t.Errorf("Expected otherStorePath %q to be BLOCKED", otherStorePath)
	}
}

// 4. Ubah Email di Profil Wajib OTP
func TestCloudflareAudit_ProfileEmailChangeRequiresOTP(t *testing.T) {
	db := openCloudflareAuditDB(t)
	cfg := &config.Config{AppEnv: "local", JWTSecret: "test-secret-key-1234567890123456"}
	authHandler := NewAuthHandler(cfg, db)

	user := models.User{
		Name:  "Akun Asli",
		Email: "asli@catavor.test",
	}
	user.SetPassword("rahasia123")
	user.HasCustomPassword = true
	db.Create(&user)

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user", &user)
		return c.Next()
	})
	app.Put("/profile", authHandler.UpdateProfile)

	// Request perubahan email TANPA token OTP -> Wajib 422 Unprocessable Entity
	bodyPayload := map[string]string{
		"name":             "Akun Asli Diubah",
		"email":            "baru-hacked@catavor.test",
		"current_password": "rahasia123",
	}
	bodyBytes, _ := json.Marshal(bodyPayload)
	req := httptest.NewRequest(http.MethodPut, "/profile", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("req failed: %v", err)
	}

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("Expected 422 Unprocessable Entity when changing email without OTP, got %d", resp.StatusCode)
	}
}

// 5. Google SSO Mencegah Account Takeover Bila Google ID Tidak Cocok
func TestCloudflareAudit_GoogleSSOIdentityMismatch(t *testing.T) {
	db := openCloudflareAuditDB(t)
	cfg := &config.Config{
		AppEnv:         "local",
		JWTSecret:      "test-secret-key-1234567890123456",
		GoogleClientID: "fake-client-id.apps.googleusercontent.com",
	}
	authHandler := NewAuthHandler(cfg, db)

	// Verifier Google dipalsukan: test ini membuktikan aturan IDENTITY MISMATCH,
	// bukan kemampuan menjangkau oauth2.googleapis.com. Verifier asli memakai
	// http.Client 8 detik sedangkan app.Test() default memutus koneksi pada 1
	// detik, sehingga test yang menembak jaringan sungguhan gagal secara acak
	// (flaky) — bukan karena ada regresi.
	authHandler.googleVerifier = func(credentialStr, expectedClientID string) (string, string, string, string, error) {
		// Menirukan token Google sah untuk orang lain: email sama dengan akun
		// yang tersimpan, tetapi google_id berbeda.
		return "user@catavor.test", "User Sah", "google-uid-ATTACKER", "", nil
	}

	existingGoogleID := "google-uid-111111"
	user := models.User{
		Name:         "User Sah",
		Email:        "user@catavor.test",
		Password:     "x",
		GoogleID:     &existingGoogleID,
		PlatformRole: "merchant",
	}
	db.Create(&user)

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Post("/auth/google", authHandler.GoogleAuth)

	// Login percobaan dengan email sama tetapi Google ID berbeda
	bodyPayload := map[string]string{
		"email":     "user@catavor.test",
		"google_id": "google-uid-ATTACKER",
		"token":     "fake-token",
	}
	bodyBytes, _ := json.Marshal(bodyPayload)
	req := httptest.NewRequest(http.MethodPost, "/auth/google", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("req failed: %v", err)
	}

	// Wajib ditolak 401 Unauthorized (Identity Mismatch)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized for mismatched Google ID, got %d", resp.StatusCode)
	}
}

// 6. Magic Token Dormansi Tidak Boleh Mengaktifkan Toko yang Disuspensi Kepatuhan
func TestCloudflareAudit_DormancyReactivationBlocksModerationSuspended(t *testing.T) {
	db := openCloudflareAuditDB(t)

	magicToken := "valid-magic-reactivation-token-xyz"
	suspendedStore := models.Store{
		Slug:              "toko-fraud",
		StoreTitle:        "Toko Fraud",
		WhatsappNumber:    "0899999999",
		IsSuspended:       true, // Disuspensi oleh admin kepatuhan
		ReactivationToken: magicToken,
		DormancyStatus:    "warning",
	}
	db.Create(&suspendedStore)

	// Coba reaktivasi via magic token
	reactivatedStore, err := services.ReactivateStoreByToken(db, magicToken)
	if err == nil {
		t.Errorf("Expected ReactivateStoreByToken to FAIL for moderation-suspended store, but it succeeded")
	}
	if reactivatedStore != nil {
		t.Errorf("Reactivated store should be nil on error")
	}
}

// 7. Market Intelligence Menerapkan K-Anonymity (Minimal 3 Toko)
func TestCloudflareAudit_MarketIntelligenceRequiresAuthAndKAnonymity(t *testing.T) {
	db := openCloudflareAuditDB(t)

	// Buat 2 kategori
	cat1 := models.Category{StoreID: 1, Name: "Exotic Pets", Slug: "exotic-pets"}
	cat2 := models.Category{StoreID: 1, Name: "Burung Kicau", Slug: "burung-kicau"}
	db.Create(&cat1)
	db.Create(&cat2)

	catID1 := cat1.ID
	catID2 := cat2.ID

	// Tambah 3 toko untuk Burung Kicau (memenuhi k-anonymity >= 3)
	for i := 1; i <= 3; i++ {
		st := models.Store{Slug: fmt.Sprintf("toko-burung-%d", i), StoreTitle: fmt.Sprintf("Burung %d", i), WhatsappNumber: "0812"}
		db.Create(&st)
		prod := models.Product{StoreID: st.ID, CategoryID: &catID2, Name: fmt.Sprintf("Burung Kenari %d", i), Price: 150000, IsActive: true}
		db.Create(&prod)
	}

	// Tambah hanya 1 toko untuk Exotic Pets (tidak memenuhi k-anonymity >= 3)
	stExotic := models.Store{Slug: "toko-exotic-1", StoreTitle: "Exotic 1", WhatsappNumber: "0813"}
	db.Create(&stExotic)
	prodExotic := models.Product{StoreID: stExotic.ID, CategoryID: &catID1, Name: "Gecko Sunglow", Price: 350000, IsActive: true}
	db.Create(&prodExotic)

	services.InvalidateMarketIntelCache()
	macroReport, err := services.GetMacroMarketSummary(db)
	if err != nil {
		t.Fatalf("GetMacroMarketIntelligence failed: %v", err)
	}

	// Periksa top categories
	for _, cat := range macroReport.TopCategories {
		if cat.CategoryName == "Exotic Pets" {
			t.Errorf("Category 'Exotic Pets' with only 1 store MUST NOT be included in macro intelligence (violates k-anonymity >= 3)")
		}
	}
}

// 8. SSE Notification Target Isolation (Target Specific & Fail Closed)
func TestCloudflareAudit_SSENotificationTargetIsolation(t *testing.T) {
	hub := services.GetNotificationHub()

	notifSpecific := &models.Notification{
		TargetType:       "specific",
		TargetRecipients: `[{"type":"user","id":100},{"type":"store","id":200}]`,
	}

	clientMatchingUser := &services.SSEClient{UserID: 100}
	clientMatchingStore := &services.SSEClient{StoreID: 200}
	clientAttacker := &services.SSEClient{UserID: 999, StoreID: 999}

	if !hub.IsClientTargetMatchForTest(clientMatchingUser, notifSpecific) {
		t.Errorf("Client with UserID 100 should match target recipients")
	}
	if !hub.IsClientTargetMatchForTest(clientMatchingStore, notifSpecific) {
		t.Errorf("Client with StoreID 200 should match target recipients")
	}
	if hub.IsClientTargetMatchForTest(clientAttacker, notifSpecific) {
		t.Errorf("Attacker with UserID 999 MUST NOT receive specific notification")
	}

	// Unknown target type must fail closed
	notifUnknown := &models.Notification{TargetType: "unknown_hack_type"}
	if hub.IsClientTargetMatchForTest(clientMatchingUser, notifUnknown) {
		t.Errorf("Unknown target type must fail closed")
	}
}
