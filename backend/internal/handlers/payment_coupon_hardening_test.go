package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/middleware"
	"catavor-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func seedHardeningPlans(t *testing.T, db *gorm.DB) {
	t.Helper()
	plans := []models.SubscriptionPlan{
		{Code: "free", Name: "Free", MaxItems: 15, StorageLimitBytes: 100 << 20, PriceMonthly: 0, HasCustomDomain: false, HasVerifiedBadge: false, SortOrder: 1, IsActive: true},
		{Code: "pro_starter", Name: "Pro Starter", MaxItems: 150, StorageLimitBytes: 2 << 30, PriceMonthly: 30000, HasCustomDomain: false, HasVerifiedBadge: true, SortOrder: 2, IsActive: true},
		{Code: "pro_business", Name: "Pro Bisnis", MaxItems: -1, StorageLimitBytes: 10 << 30, PriceMonthly: 129000, HasCustomDomain: true, HasVerifiedBadge: true, SortOrder: 3, IsActive: true},
	}
	for i := range plans {
		mustCreate(t, db, &plans[i])
	}
}

func TestPublicSettings_NeverLeaksAulaaKeys(t *testing.T) {
	db := newTestDB(t)
	mustCreate(t, db, &models.Setting{Key: "payment_system_mode", Value: "manual_qris"})
	mustCreate(t, db, &models.Setting{Key: "aulaa_api_key", Value: "secret-live-key-123"})
	mustCreate(t, db, &models.Setting{Key: "aulaa_webhook_secret", Value: "whsec-456"})
	mustCreate(t, db, &models.Setting{Key: "aulaa_base_url", Value: "https://internal.aulaa.local"})

	sh := NewSettingHandler(db)
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Get("/api/settings", sh.PublicIndex)

	resp := call(t, app, "GET", "/api/settings", nil)
	if resp.Status != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.Status)
	}
	data, _ := resp.Body["data"].(map[string]any)
	for _, secretKey := range []string{"aulaa_api_key", "aulaa_webhook_secret", "aulaa_base_url"} {
		if _, exists := data[secretKey]; exists {
			t.Fatalf("kunci rahasia %q bocor di GET /api/settings publik", secretKey)
		}
	}
	if data["payment_system_mode"] != "manual_qris" {
		t.Fatalf("payment_system_mode = %v, want manual_qris", data["payment_system_mode"])
	}
}

func TestUpdateCustomDomain_GracePeriodLocked(t *testing.T) {
	db := newTestDB(t)
	seedHardeningPlans(t, db)
	user := models.User{Name: "Biz", Email: "biz@test.local", Password: "hash", PlatformRole: "merchant"}
	mustCreate(t, db, &user)
	graceUntil := time.Now().UTC().Add(5 * 24 * time.Hour)
	store := models.Store{
		UserID:           user.ID,
		Slug:             "biz-grace",
		StoreTitle:       "Biz Grace",
		Plan:             "pro_business",
		PlanStatus:       "grace_period",
		GracePeriodUntil: &graceUntil,
		PaymentStatus:    "paid",
	}
	mustCreate(t, db, &store)

	subH := NewSubscriptionHandler(db, testCfg())
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Put("/api/subscription/custom-domain", func(c *fiber.Ctx) error {
		c.Locals("store_id", store.ID)
		c.Locals("user_id", user.ID)
		return subH.UpdateCustomDomain(c)
	})

	resp := call(t, app, "PUT", "/api/subscription/custom-domain", map[string]string{
		"custom_domain": "baru.example.com",
	})
	if resp.Status != http.StatusForbidden {
		t.Fatalf("status = %d, want 403 (%s)", resp.Status, resp.Raw)
	}
	if resp.Body["code"] != "GRACE_PERIOD_DOMAIN_LOCKED" {
		t.Fatalf("code = %v, want GRACE_PERIOD_DOMAIN_LOCKED", resp.Body["code"])
	}
}

func TestVerifyCoupon_AntiOracleAndRateLimitBurst(t *testing.T) {
	db := newTestDB(t)
	seedHardeningPlans(t, db)
	past := time.Now().UTC().Add(-24 * time.Hour)
	mustCreate(t, db, &models.Coupon{Code: "NONAKTIF", Label: "Off", Type: "discount", Discount: 10000, IsActive: false})
	mustCreate(t, db, &models.Coupon{Code: "KADALUARSA", Label: "Exp", Type: "discount", Discount: 10000, IsActive: true, ExpiresAt: &past})

	subH := NewSubscriptionHandler(db, testCfg())
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Post("/api/subscription/verify-coupon", middleware.AuthRateLimiter(), subH.VerifyCoupon)

	rMissing := call(t, app, "POST", "/api/subscription/verify-coupon", map[string]string{"code": "TIDAKADA", "plan_code": "pro_starter"})
	rInactive := call(t, app, "POST", "/api/subscription/verify-coupon", map[string]string{"code": "NONAKTIF", "plan_code": "pro_starter"})
	rExpired := call(t, app, "POST", "/api/subscription/verify-coupon", map[string]string{"code": "KADALUARSA", "plan_code": "pro_starter"})

	for _, r := range []apiResp{rMissing, rInactive, rExpired} {
		if r.Status != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400 (%s)", r.Status, r.Raw)
		}
		if r.Body["message"] != "Kode kupon tidak valid atau tidak dapat digunakan." {
			t.Fatalf("oracle leak: got message %v", r.Body["message"])
		}
	}

	// Burst remaining requests beyond AuthRateLimiter Max=20 -> expect 429
	got429 := false
	for i := 0; i < 25; i++ {
		r := call(t, app, "POST", "/api/subscription/verify-coupon", map[string]string{"code": "TIDAKADA", "plan_code": "pro_starter"})
		if r.Status == http.StatusTooManyRequests {
			got429 = true
			break
		}
	}
	if !got429 {
		t.Fatalf("burst > 20 request ke /api/subscription/verify-coupon harus terkena rate limit 429")
	}
}

func TestAdminBillingAndCoupons_FinanceActorRoleAndValidation(t *testing.T) {
	db := newTestDB(t)
	seedHardeningPlans(t, db)
	financeUser := models.User{
		Name:         "Staf Finance",
		Email:        "finance@catavor.local",
		Password:     "hash",
		PlatformRole: "finance",
	}
	mustCreate(t, db, &financeUser)
	owner := models.User{Name: "Merchant", Email: "m@test.local", Password: "hash", PlatformRole: "merchant"}
	mustCreate(t, db, &owner)
	store := models.Store{UserID: owner.ID, Slug: "m-audit", StoreTitle: "M Audit", Plan: "free", PaymentStatus: "free_active"}
	mustCreate(t, db, &store)

	pendingOrder := models.SubscriptionOrder{
		StoreID:           store.ID,
		UserID:            owner.ID,
		OrderNumber:       "INV-FIN-001",
		Type:              "upgrade",
		PlanCode:          "pro_starter",
		BillingCycle:      "monthly",
		DurationMonths:    1,
		OriginalAmount:    30000,
		FinalAmount:       30000,
		PaymentMethod:     "qris",
		PaymentMode:       "manual_qris",
		PaymentProofURL:   "/api/proof.png",
		SenderAccountName: "Merchant",
		PaymentStatus:     "pending_verification",
	}
	rejectedOrder := models.SubscriptionOrder{
		StoreID:       store.ID,
		UserID:        owner.ID,
		OrderNumber:   "INV-FIN-REJ",
		Type:          "upgrade",
		PlanCode:      "pro_starter",
		BillingCycle:  "monthly",
		OriginalAmount: 30000,
		FinalAmount:   30000,
		PaymentStatus: "rejected",
	}
	mustCreate(t, db, &pendingOrder)
	mustCreate(t, db, &rejectedOrder)

	subH := NewSubscriptionHandler(db, testCfg())
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user", &financeUser)
		c.Locals("user_id", financeUser.ID)
		c.Locals("email", financeUser.Email)
		return c.Next()
	})
	app.Put("/api/admin/subscription/orders/:id", subH.AdminUpdateOrder)
	app.Post("/api/admin/subscription/coupons", subH.AdminCreateCoupon)
	app.Put("/api/admin/subscription/coupons/:code", subH.AdminUpdateCoupon)
	app.Patch("/api/admin/subscription/coupons/:code/toggle", subH.AdminToggleCoupon)
	app.Delete("/api/admin/subscription/coupons/:code", subH.AdminDeleteCoupon)

	// 1. Approving rejected order returns 409 Conflict
	rConflict := call(t, app, "PUT", "/api/admin/subscription/orders/"+itoa(rejectedOrder.ID), map[string]string{"status": "active"})
	if rConflict.Status != http.StatusConflict {
		t.Fatalf("approve rejected order status = %d, want 409 (%s)", rConflict.Status, rConflict.Raw)
	}

	// 2. Finance approves pendingOrder then resets it back to pending_verification
	rApp := call(t, app, "PUT", "/api/admin/subscription/orders/"+itoa(pendingOrder.ID), map[string]string{"status": "active"})
	if rApp.Status != http.StatusOK {
		t.Fatalf("approve status = %d, want 200 (%s)", rApp.Status, rApp.Raw)
	}
	rReset := call(t, app, "PUT", "/api/admin/subscription/orders/"+itoa(pendingOrder.ID), map[string]string{"status": "pending_verification"})
	if rReset.Status != http.StatusOK {
		t.Fatalf("reset status = %d, want 200 (%s)", rReset.Status, rReset.Raw)
	}

	// 3. Negative usage_limit rejected 400; valid create defaults is_active=true; update *bool=false & type=free,discount=0 respected
	rBad := call(t, app, "POST", "/api/admin/subscription/coupons", map[string]any{
		"code": "BADNEG", "type": "discount", "discount": 5000, "usage_limit": -1,
	})
	if rBad.Status != http.StatusBadRequest {
		t.Fatalf("negative usage_limit status = %d, want 400", rBad.Status)
	}
	rCreate := call(t, app, "POST", "/api/admin/subscription/coupons", map[string]any{
		"code": "FINPROMO", "label": "Promo Finance", "type": "discount", "discount": 15000, "usage_limit": 5, "max_uses_per_store": 2,
	})
	if rCreate.Status != http.StatusOK {
		t.Fatalf("create coupon status = %d, want 200 (%s)", rCreate.Status, rCreate.Raw)
	}
	rDup := call(t, app, "POST", "/api/admin/subscription/coupons", map[string]any{
		"code": "FINPROMO", "type": "discount", "discount": 15000,
	})
	if rDup.Status != http.StatusConflict {
		t.Fatalf("duplicate coupon status = %d, want 409", rDup.Status)
	}

	rUpd := call(t, app, "PUT", "/api/admin/subscription/coupons/FINPROMO", map[string]any{
		"type": "free", "discount": 0, "is_active": false,
	})
	if rUpd.Status != http.StatusOK {
		t.Fatalf("update coupon status = %d, want 200 (%s)", rUpd.Status, rUpd.Raw)
	}
	var updatedCoupon models.Coupon
	db.Where("code = ?", "FINPROMO").First(&updatedCoupon)
	if updatedCoupon.IsActive || updatedCoupon.Discount != 0 || updatedCoupon.Type != "free" {
		t.Fatalf("updated coupon = %+v, want free/0/inactive", updatedCoupon)
	}

	if rTog := call(t, app, "PATCH", "/api/admin/subscription/coupons/FINPROMO/toggle", nil); rTog.Status != http.StatusOK {
		t.Fatalf("toggle status = %d", rTog.Status)
	}
	if rDel := call(t, app, "DELETE", "/api/admin/subscription/coupons/FINPROMO", nil); rDel.Status != http.StatusOK {
		t.Fatalf("delete status = %d", rDel.Status)
	}

	// Verify ALL logged audit rows record ActorRole == "finance" (never "superadmin")
	var logs []models.ActivityLog
	db.Find(&logs)
	if len(logs) < 6 {
		t.Fatalf("expected >= 6 activity logs (approve, reset, create, update, toggle, delete), got %d", len(logs))
	}
	for _, entry := range logs {
		if entry.ActorRole != "finance" {
			t.Fatalf("activity log action=%s recorded ActorRole=%q, want finance", entry.Action, entry.ActorRole)
		}
	}
}

func TestRegister_MaintenanceBlocksFreeCouponAndAllowsPureFree(t *testing.T) {
	db := newTestDB(t)
	seedHardeningPlans(t, db)
	mustCreate(t, db, &models.Setting{Key: "payment_system_mode", Value: "maintenance"})
	mustCreate(t, db, &models.Coupon{Code: "CATFREE100", Label: "Free 100%", Type: "free", IsActive: true})

	seedRegistrationToken(t, db, "reg1@example.com", "vt_reg_1")
	seedRegistrationToken(t, db, "reg2@example.com", "vt_reg_2")
	app := newTestApp(db)

	payloadPaid := map[string]any{
		"name":               "User One",
		"email":              "reg1@example.com",
		"password":           "KuatSekali123!",
		"store_title":        "Toko Satu",
		"slug":               "toko-satu-maint",
		"whatsapp_number":    "081234567890",
		"plan":               "pro_starter",
		"billing_cycle":      "monthly",
		"coupon_code":        "CATFREE100",
		"verification_token": "vt_reg_1",
	}
	rPaid := call(t, app, "POST", "/api/auth/register", payloadPaid)
	if rPaid.Status != http.StatusServiceUnavailable || rPaid.Body["code"] != "PAYMENT_GATEWAY_MAINTENANCE" {
		t.Fatalf("register paket berbayar + kupon 100%% saat maintenance harus 503 PAYMENT_GATEWAY_MAINTENANCE, dapat %d (%s)", rPaid.Status, rPaid.Raw)
	}

	payloadFree := map[string]any{
		"name":               "User Two",
		"email":              "reg2@example.com",
		"password":           "KuatSekali123!",
		"store_title":        "Toko Dua",
		"slug":               "toko-dua-free",
		"whatsapp_number":    "081234567891",
		"plan":               "free",
		"verification_token": "vt_reg_2",
	}
	rFree := call(t, app, "POST", "/api/auth/register", payloadFree)
	if rFree.Status != http.StatusOK {
		t.Fatalf("register paket free saat maintenance harus tetap 200 OK, dapat %d (%s)", rFree.Status, rFree.Raw)
	}
}

func TestProductRestoreArchived_Handler(t *testing.T) {
	db := newTestDB(t)
	seedHardeningPlans(t, db)
	user := models.User{Name: "Rest", Email: "rest@test.local", Password: "hash", PlatformRole: "merchant"}
	mustCreate(t, db, &user)
	store := models.Store{UserID: user.ID, Slug: "rest-store", StoreTitle: "Rest Store", Plan: "pro_starter", PaymentStatus: "paid"}
	mustCreate(t, db, &store)

	past := time.Now().UTC().Add(-time.Hour)
	for i := 0; i < 3; i++ {
		p := models.Product{StoreID: store.ID, Name: "Archived Ok", Price: 1000, ModerationStatus: "approved", ArchivedAt: &past}
		mustCreate(t, db, &p)
		db.Model(&p).Update("is_active", false)
	}
	bannedP := models.Product{StoreID: store.ID, Name: "Archived Banned", Price: 1000, ModerationStatus: "banned", ArchivedAt: &past}
	mustCreate(t, db, &bannedP)
	db.Model(&bannedP).Update("is_active", false)

	ph := NewProductHandler(testCfg(), db)
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Post("/api/products/restore-archived", func(c *fiber.Ctx) error {
		c.Locals("store", &store)
		return ph.RestoreArchived(c)
	})

	resp := call(t, app, "POST", "/api/products/restore-archived", nil)
	if resp.Status != http.StatusOK {
		t.Fatalf("restore-archived status = %d, want 200 (%s)", resp.Status, resp.Raw)
	}
	rawCount, _ := json.Marshal(resp.Body["restored_count"])
	if string(rawCount) != "3" {
		t.Fatalf("restored_count = %s, want 3 (%s)", rawCount, resp.Raw)
	}
	var stillArchived int64
	db.Model(&models.Product{}).Where("store_id = ? AND archived_at IS NOT NULL", store.ID).Count(&stillArchived)
	if stillArchived != 1 {
		t.Fatalf("produk banned harus tetap terarsip (stillArchived=%d, want 1)", stillArchived)
	}
	if !strings.Contains(strings.ToLower(resp.Raw), "dipulihkan") {
		t.Fatalf("response message unexpected: %s", resp.Raw)
	}
}
