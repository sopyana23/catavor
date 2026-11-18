package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func openAgentARemediationDB(t *testing.T) *gorm.DB {
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
		&models.ProductImage{},
		&models.ProductVariant{},
		&models.Setting{},
		&models.PolicyVersion{},
		&models.PolicyAuditLog{},
		&models.UserPolicyAgreement{},
		&models.PlatformRole{},
		&models.PlatformPermission{},
		&models.PlatformRolePermission{},
		&models.StoreDailyAnalytics{},
		&models.StoreDailyTrafficSource{},
		&models.StoreDailyAudienceMetric{},
		&models.ActivityLog{},
	); err != nil {
		t.Fatalf("automigrate: %v", err)
	}
	return db
}

func TestSEC02_CrossTenantExportRBACBlocksLowPrivStaffAllowsOwnerAndAuditor(t *testing.T) {
	db := openAgentARemediationDB(t)

	// Seed roles & permissions: content ONLY gets content:broadcast:send; compliance gets compliance:reports:manage.
	roleContent := models.PlatformRole{Slug: "content", Name: "Content", IsSystem: true}
	roleCompliance := models.PlatformRole{Slug: "compliance", Name: "Compliance", IsSystem: true}
	permBroadcast := models.PlatformPermission{Key: "content:broadcast:send", Group: "content", Name: "Broadcast"}
	permCompliance := models.PlatformPermission{Key: "compliance:reports:manage", Group: "compliance", Name: "Reports"}
	db.Create(&roleContent)
	db.Create(&roleCompliance)
	db.Create(&permBroadcast)
	db.Create(&permCompliance)
	db.Create(&models.PlatformRolePermission{RoleID: roleContent.ID, PermissionID: permBroadcast.ID})
	db.Create(&models.PlatformRolePermission{RoleID: roleCompliance.ID, PermissionID: permCompliance.ID})

	owner := models.User{Name: "Owner Free", Email: "owner@toko.test", Password: "x", PlatformRole: "merchant"}
	contentStaff := models.User{Name: "Content Staff", Email: "content@catavor.test", Password: "x", PlatformRole: "content"}
	complianceStaff := models.User{Name: "Compliance Staff", Email: "comp@catavor.test", Password: "x", PlatformRole: "compliance"}
	db.Create(&owner)
	db.Create(&contentStaff)
	db.Create(&complianceStaff)

	store := models.Store{
		UserID:         owner.ID,
		Slug:           "toko-korban",
		StoreTitle:     "Toko Korban",
		WhatsappNumber: "0819999999",
		Plan:           "free",
		PlanStatus:     "active",
	}
	db.Create(&store)

	cfg := &config.Config{AppEnv: "local"}
	catHandler := NewCatalogExportHandler(cfg, db)
	anaHandler := NewAnalyticsHandler(cfg, db)

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	var currentActor *models.User
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user", currentActor)
		c.Locals("store", &store)
		return c.Next()
	})
	app.Get("/api/admin/catalog/export", catHandler.ExportCatalog)
	app.Get("/api/admin/analytics/export", anaHandler.ExportStoreAnalytics)

	// 1. Staf content TANPA izin audit/compliance WAJIB ditolak 403 saat mencoba dump toko merchant lain!
	currentActor = &contentStaff
	for _, path := range []string{"/api/admin/catalog/export?format=json", "/api/admin/analytics/export?period=7d&type=daily"} {
		resp, err := app.Test(httptest.NewRequest(http.MethodGet, path, nil), 5000)
		if err != nil {
			t.Fatalf("req %s: %v", path, err)
		}
		if resp.StatusCode != http.StatusForbidden {
			t.Fatalf("SEC-02 regression on %s: content staff got %d instead of 403", path, resp.StatusCode)
		}
	}

	// 2. Merchant pemilik toko sah (paket free) TETAP diizinkan 200 mengekspor tokonya sendiri!
	currentActor = &owner
	for _, path := range []string{"/api/admin/catalog/export?format=json", "/api/admin/analytics/export?period=7d&type=daily"} {
		resp, err := app.Test(httptest.NewRequest(http.MethodGet, path, nil), 5000)
		if err != nil {
			t.Fatalf("owner req %s: %v", path, err)
		}
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("owner (free plan) blocked on %s: status=%d", path, resp.StatusCode)
		}
	}

	// 3. Staf compliance DENGAN izin compliance:reports:manage diizinkan 200 melakukan audit lintas-toko!
	currentActor = &complianceStaff
	for _, path := range []string{"/api/admin/catalog/export?format=json", "/api/admin/analytics/export?period=7d&type=daily"} {
		resp, err := app.Test(httptest.NewRequest(http.MethodGet, path, nil), 5000)
		if err != nil {
			t.Fatalf("compliance req %s: %v", path, err)
		}
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("authorized compliance staff blocked on %s: status=%d", path, resp.StatusCode)
		}
	}
}

func TestSEC03_SEC05_SEC06_PolicySanitizationReadOnlyGetAndSafeReset(t *testing.T) {
	db := openAgentARemediationDB(t)
	h := NewSettingHandler(db)

	super := models.User{ID: 77, Name: "Super", Email: "super@catavor.test", Password: "x", PlatformRole: "superadmin"}
	db.Create(&super)

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Get("/api/policies", h.GetPolicies)
	app.Post("/api/admin/settings/policies", func(c *fiber.Ctx) error {
		c.Locals("user", &super)
		return h.UpdatePolicy(c)
	})
	app.Post("/api/admin/settings/policies/reset-defaults", func(c *fiber.Ctx) error {
		c.Locals("user", &super)
		return h.ResetDefaultPolicies(c)
	})
	app.Get("/api/admin/settings/policy-audit-logs", func(c *fiber.Ctx) error {
		c.Locals("user", &super)
		return h.GetPolicyAuditLogs(c)
	})

	// 1. SEC-03: Malformed/array `sections` JSON WAJIB ditolak 400 (tidak disimpan mentah lewat cabang else!).
	badPayload := `{"type":"terms","title":"Valid","version":"v3.0","sections":[{"raw":"<script>alert(1)</script>"}]}`
	reqBad := httptest.NewRequest(http.MethodPost, "/api/admin/settings/policies", strings.NewReader(badPayload))
	reqBad.Header.Set("Content-Type", "application/json")
	respBad, _ := app.Test(reqBad, 5000)
	if respBad.StatusCode != http.StatusBadRequest {
		t.Fatalf("SEC-03 regression: malformed array sections returned %d instead of 400", respBad.StatusCode)
	}

	// 2. SEC-03: Arbitrary unknown policyType WAJIB ditolak 400.
	badType := `{"type":"evil_injected_key","title":"Valid","version":"v3.0","content":"isi"}`
	reqBadType := httptest.NewRequest(http.MethodPost, "/api/admin/settings/policies", strings.NewReader(badType))
	reqBadType.Header.Set("Content-Type", "application/json")
	respBadType, _ := app.Test(reqBadType, 5000)
	if respBadType.StatusCode != http.StatusBadRequest {
		t.Fatalf("SEC-03 regression: unknown policyType returned %d instead of 400", respBadType.StatusCode)
	}

	// 3. SEC-03 + SEC-06: Simpan kebijakan markdown kustom (tanpa sections) yang memuat tautan berbahaya javascript: & data:,
	// pastikan tautan berbahaya dinetralkan DAN pastikan GET /api/policies TIDAK menimpa kebijakan kustom tersebut!
	customBody := `{"type":"terms","title":"Ketentuan Kustom Admin","version":"v9.9","content":"Klik [Jahat](javascript:alert(1)) atau [Data](data:text/html,xss) dan [Resmi](https://catavor.com/legal)"}`
	reqCustom := httptest.NewRequest(http.MethodPost, "/api/admin/settings/policies", strings.NewReader(customBody))
	reqCustom.Header.Set("Content-Type", "application/json")
	respCustom, _ := app.Test(reqCustom, 5000)
	if respCustom.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(respCustom.Body)
		t.Fatalf("expected 200 on custom markdown policy, got %d: %s", respCustom.StatusCode, string(b))
	}

	respGet, _ := app.Test(httptest.NewRequest(http.MethodGet, "/api/policies", nil), 5000)
	var getEnv struct {
		Success bool                            `json:"success"`
		Data    map[string]models.PolicyVersion `json:"data"`
	}
	_ = json.NewDecoder(respGet.Body).Decode(&getEnv)
	gotTerms := getEnv.Data["terms"]
	if gotTerms.Version != "v9.9" || gotTerms.Title != "Ketentuan Kustom Admin" {
		t.Fatalf("SEC-06 regression: GET /api/policies overwrote custom markdown policy! got version=%q title=%q", gotTerms.Version, gotTerms.Title)
	}
	if strings.Contains(gotTerms.Content, "javascript:") || strings.Contains(gotTerms.Content, "data:text/html") {
		t.Fatalf("SEC-03 regression: dangerous markdown link scheme survived sanitization: %s", gotTerms.Content)
	}
	if !strings.Contains(gotTerms.Content, "https://catavor.com/legal") {
		t.Fatalf("expected safe https markdown link preserved, got: %s", gotTerms.Content)
	}

	// 4. SEC-05: Reset tanpa target eksplisit ({}) WAJIB ditolak 400 (tidak boleh diam-diam reset seluruh 6 pilar!).
	reqEmptyReset := httptest.NewRequest(http.MethodPost, "/api/admin/settings/policies/reset-defaults", strings.NewReader(`{}`))
	reqEmptyReset.Header.Set("Content-Type", "application/json")
	respEmptyReset, _ := app.Test(reqEmptyReset, 5000)
	if respEmptyReset.StatusCode != http.StatusBadRequest {
		t.Fatalf("SEC-05 regression: empty reset payload returned %d instead of 400", respEmptyReset.StatusCode)
	}

	// 5. Paginasi server-side GetPolicyAuditLogs backward-compatible.
	for i := 0; i < 15; i++ {
		db.Create(&models.PolicyAuditLog{
			PolicyType:    "terms",
			Action:        "update",
			NewVersion:    fmt.Sprintf("v2.%d", i),
			ChangeSummary: "Uji paginasi",
			AdminEmail:    super.Email,
			AdminIP:       "127.0.0.1",
		})
	}
	respLogs, _ := app.Test(httptest.NewRequest(http.MethodGet, "/api/admin/settings/policy-audit-logs?page=2&per_page=5", nil), 5000)
	var logsRes struct {
		Success    bool                    `json:"success"`
		Data       []models.PolicyAuditLog `json:"data"`
		Total      int64                   `json:"total"`
		Page       int                     `json:"page"`
		PerPage    int                     `json:"per_page"`
		TotalPages int                     `json:"total_pages"`
	}
	_ = json.NewDecoder(respLogs.Body).Decode(&logsRes)
	if !logsRes.Success || len(logsRes.Data) != 5 || logsRes.Page != 2 || logsRes.Total < 15 {
		t.Fatalf("unexpected paginated policy audit logs response: %+v (len=%d)", logsRes, len(logsRes.Data))
	}
}

func TestSEC08_ContentDispositionHeaderInjectionPrevented(t *testing.T) {
	app, db, _ := setupAnalyticsExportTestApp(t)
	st := &models.Store{
		ID:         202,
		Slug:       "toko-aman",
		StoreTitle: "Toko Aman",
	}
	db.Create(st)

	req := httptest.NewRequest(http.MethodGet, "/api/admin/analytics/export?period=30d.bat;%20foo=bar&type=daily", bytes.NewReader(nil))
	req.Header.Set("X-Test-Store-ID", "202")
	req.Header.Set("X-Test-User-Role", "merchant")

	resp, err := app.Test(req, 5000)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	cd := resp.Header.Get("Content-Disposition")
	if strings.Contains(cd, ".bat") || strings.Contains(cd, "foo=bar") || !strings.Contains(cd, `filename="catavor-analytics-toko-aman-daily-30d-`) {
		t.Fatalf("SEC-08 regression: Content-Disposition header injection not neutralized: %q", cd)
	}
}

func TestPostgresDisposable_AgentARemediationEndToEnd(t *testing.T) {
	pgDB := openDisposablePostgres(t)
	if err := pgDB.AutoMigrate(
		&models.SubscriptionPlan{},
		&models.SubscriptionOrder{},
		&models.Product{},
		&models.Setting{},
		&models.PolicyVersion{},
		&models.PolicyAuditLog{},
		&models.EmailJob{},
	); err != nil {
		t.Fatalf("AutoMigrate Policy & Billing models on PG17: %v", err)
	}

	// 1. Seed plans & verify FOR UPDATE payment-bypass block + grace-period fallback to free
	if err := services.SeedSubscriptionPlans(pgDB); err != nil {
		t.Fatalf("SeedSubscriptionPlans on PG17: %v", err)
	}

	owner := models.User{Email: "pg-owner@catavor.test", Name: "PG Owner", Password: "x", PlatformRole: "merchant"}
	if err := pgDB.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}
	expiredAt := time.Now().UTC().Add(-8 * 24 * time.Hour)
	graceEnded := time.Now().UTC().Add(-1 * time.Hour)
	store := models.Store{
		UserID:           owner.ID,
		Slug:             "pg-test-store",
		StoreTitle:       "PG Test Store",
		WhatsappNumber:   "0819999999",
		Plan:             "pro_business",
		PlanStatus:       "grace_period",
		PlanExpiresAt:    &expiredAt,
		GracePeriodUntil: &graceEnded,
	}
	if err := pgDB.Create(&store).Error; err != nil {
		t.Fatalf("create store: %v", err)
	}

	if _, err := services.ScheduleStoreDowngrade(pgDB, store.ID, "pro_business"); err != nil {
		t.Fatalf("unexpected error on idempotent current-plan call: %v", err)
	}
	// Attempting upward schedule from pro_starter -> pro_business MUST fail under FOR UPDATE lock
	pgDB.Model(&store).Update("plan", "pro_starter")
	if _, err := services.ScheduleStoreDowngrade(pgDB, store.ID, "pro_business"); err == nil {
		t.Fatal("SEC-01 PG17 failure: upward schedule pro_starter -> pro_business must be rejected")
	}
	// Valid downward schedule pro_business -> pro_starter, then unpaid grace expiry MUST land on free!
	pgDB.Model(&store).Update("plan", "pro_business")
	if _, err := services.ScheduleStoreDowngrade(pgDB, store.ID, "pro_starter"); err != nil {
		t.Fatalf("valid downward schedule pro_business -> pro_starter failed: %v", err)
	}
	if err := services.ProcessSubscriptionLifecycle(pgDB); err != nil {
		t.Fatalf("ProcessSubscriptionLifecycle on PG17: %v", err)
	}

	var refreshedStore models.Store
	if err := pgDB.First(&refreshedStore, store.ID).Error; err != nil {
		t.Fatalf("reload store: %v", err)
	}
	if refreshedStore.Plan != "free" || refreshedStore.NextPlanCode != nil || refreshedStore.GracePeriodUntil != nil {
		t.Fatalf("SEC-01 PG17 failure: unpaid grace expiry must transition to free, got plan=%q next=%v", refreshedStore.Plan, refreshedStore.NextPlanCode)
	}

	// 2. Seed policies & verify append-only ResetDefaultPolicies on PostgreSQL 17
	database.SeedPlatformPolicies(pgDB, false)
	admin := models.User{Email: "pg-super@catavor.test", Name: "PG Super", Password: "x", PlatformRole: "superadmin"}
	pgDB.Create(&admin)

	h := NewSettingHandler(pgDB)
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Get("/api/policies", h.GetPolicies)
	app.Post("/api/admin/settings/policies/reset-defaults", func(c *fiber.Ctx) error {
		c.Locals("user", &admin)
		return h.ResetDefaultPolicies(c)
	})

	reqReset := httptest.NewRequest(http.MethodPost, "/api/admin/settings/policies/reset-defaults", strings.NewReader(`{"type":"terms"}`))
	reqReset.Header.Set("Content-Type", "application/json")
	respReset, err := app.Test(reqReset, 5000)
	if err != nil || respReset.StatusCode != http.StatusOK {
		t.Fatalf("PG17 single-doc reset failed: status=%d err=%v", respReset.StatusCode, err)
	}

	var termsVersions []models.PolicyVersion
	pgDB.Where("type = ?", "terms").Order("id asc").Find(&termsVersions)
	if len(termsVersions) != 2 || termsVersions[0].IsActive || !termsVersions[1].IsActive || termsVersions[1].CreatedBy != admin.ID {
		t.Fatalf("SEC-06 PG17 failure: expected append-only history (old inactive, new active with CreatedBy=%d), got %+v", admin.ID, termsVersions)
	}
}
