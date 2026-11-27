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

	"catavor-backend/internal/database"
	"catavor-backend/internal/middleware"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupAuditTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	name := strings.NewReplacer("/", "_", " ", "_", "-", "_").Replace(t.Name())
	dsn := fmt.Sprintf("file:audit_%s?mode=memory&cache=shared", name)
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger:  logger.Default.LogMode(logger.Silent),
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		t.Fatalf("gorm.Open(sqlite): %v", err)
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.UserSession{},
		&models.Store{},
		&models.SafeDomain{},
		&models.ActivityLog{},
		&models.ArchivedActivityLog{},
		&models.PlatformRole{},
		&models.PlatformPermission{},
		&models.PlatformRolePermission{},
		&models.Setting{},
	); err != nil {
		t.Fatalf("AutoMigrate(sqlite): %v", err)
	}
	database.DB = db
	services.ConfigureAuditHMACKey("test-audit-hmac-secret-key-0123456789abcdef", "")
	services.InitRBACService(db)
	return db
}

func seedAuditRBAC(t *testing.T, db *gorm.DB) {
	t.Helper()
	perm := models.PlatformPermission{Key: "audit:logs:read", Name: "Read Audit Logs", Group: "Audit"}
	if err := db.Create(&perm).Error; err != nil {
		t.Fatalf("seed permission: %v", err)
	}
	auditorRole := models.PlatformRole{Name: "Auditor", Slug: "auditor", Description: "Audit specialist", IsSystem: false}
	if err := db.Create(&auditorRole).Error; err != nil {
		t.Fatalf("seed auditor role: %v", err)
	}
	if err := db.Create(&models.PlatformRolePermission{RoleID: auditorRole.ID, PermissionID: perm.ID}).Error; err != nil {
		t.Fatalf("seed auditor role permission: %v", err)
	}
	supportRole := models.PlatformRole{Name: "Support", Slug: "support", Description: "Support agent", IsSystem: true}
	if err := db.Create(&supportRole).Error; err != nil {
		t.Fatalf("seed support role: %v", err)
	}
	services.InitRBACService(db)
}

func buildAuditTestApp(db *gorm.DB, actor **models.User, activeStore **models.Store, claims **middleware.JWTClaims) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		if actor != nil && *actor != nil {
			c.Locals("user", *actor)
			c.Locals("user_id", (*actor).ID)
		}
		if activeStore != nil && *activeStore != nil {
			c.Locals("store", *activeStore)
		}
		if claims != nil && *claims != nil {
			c.Locals("claims", *claims)
		}
		return c.Next()
	})
	h := NewActivityLogHandler(db)
	sd := NewSafeDomainHandler(db)
	sh := NewSessionHandler(testCfg(), db)

	app.Get("/api/activity-logs", h.GetStoreActivityLogs)
	app.Get("/api/activity-logs/summary", h.GetActivitySummary)
	app.Get("/api/activity-logs/export", h.ExportStoreActivityLogs)

	app.Get("/api/admin/audit-logs", h.GetSuperadminAuditLogs)
	app.Get("/api/admin/audit-logs/verify", h.VerifySuperadminAuditChain)
	app.Get("/api/admin/audit-logs/export", h.ExportSuperadminAuditLogs)

	app.Post("/api/admin/safe-domains", sd.CreateSafeDomain)
	app.Put("/api/admin/safe-domains/:id", sd.UpdateSafeDomain)
	app.Delete("/api/admin/safe-domains/:id", sd.DeleteSafeDomain)
	app.Post("/api/admin/safe-domains/reset-defaults", sd.ResetDefaultSafeDomains)

	app.Delete("/api/sessions/:id", sh.RevokeSession)
	app.Post("/api/sessions/revoke-others", sh.RevokeOtherSessions)
	return app
}

func TestActivityLogHandler_AuthorizationAndTenantIsolation(t *testing.T) {
	db := setupAuditTestDB(t)
	seedAuditRBAC(t, db)

	merchantA := &models.User{Name: "Owner A", Email: "owner.a@example.com", PlatformRole: "merchant"}
	merchantB := &models.User{Name: "Owner B", Email: "owner.b@example.com", PlatformRole: "merchant"}
	auditor := &models.User{Name: "Staff Auditor", Email: "auditor@catavor.local", PlatformRole: "auditor"}
	support := &models.User{Name: "Staff Support", Email: "support@catavor.local", PlatformRole: "support"}
	for _, u := range []*models.User{merchantA, merchantB, auditor, support} {
		if err := db.Create(u).Error; err != nil {
			t.Fatalf("create user %s: %v", u.Email, err)
		}
	}

	storeA := &models.Store{Slug: "toko-a", StoreTitle: "Toko A", UserID: merchantA.ID, Plan: "pro", DormancyStatus: "active"}
	storeB := &models.Store{Slug: "toko-b", StoreTitle: "Toko B", UserID: merchantB.ID, Plan: "free", DormancyStatus: "suspended", IsSuspended: true}
	for _, s := range []*models.Store{storeA, storeB} {
		if err := db.Create(s).Error; err != nil {
			t.Fatalf("create store %s: %v", s.Slug, err)
		}
	}

	services.RecordActivity(services.RecordActivityParams{
		DB: db, StoreID: &storeA.ID, UserID: &merchantA.ID, ActorRole: "merchant",
		ActorName: merchantA.Name, ActorEmail: merchantA.Email,
		Action: "product.create", Category: "catalog", EntityType: "product",
		EntityTitle: "=cmd|' /C calc'!A0", Description: "Menambahkan produk uji 100%_diskon",
		IPAddress: "203.0.113.10",
	})
	services.RecordActivity(services.RecordActivityParams{
		DB: db, StoreID: &storeB.ID, UserID: &merchantB.ID, ActorRole: "merchant",
		ActorName: merchantB.Name, ActorEmail: merchantB.Email,
		Action: "store.update", Category: "store", EntityType: "store",
		EntityTitle: "Toko B Secret", Description: "Pembaruan profil toko B",
		IPAddress: "203.0.113.20",
	})
	services.RecordActivity(services.RecordActivityParams{
		DB: db, UserID: &auditor.ID, ActorRole: "auditor",
		ActorName: auditor.Name, ActorEmail: auditor.Email,
		Action: "RBAC_CUSTOM_AUDIT", Category: "superadmin", EntityType: "platform_role",
		EntityTitle: "Auditor", Description: "Aksi staf khusus auditor",
		IPAddress: "10.0.0.5",
	})

	var curUser *models.User
	var curStore *models.Store
	app := buildAuditTestApp(db, &curUser, &curStore, nil)

	// 1. Unauthenticated requests -> 401
	for _, path := range []string{"/api/activity-logs", "/api/activity-logs/summary", "/api/activity-logs/export", "/api/admin/audit-logs", "/api/admin/audit-logs/verify", "/api/admin/audit-logs/export"} {
		resp, err := app.Test(httptest.NewRequest(http.MethodGet, path, nil), 5000)
		if err != nil {
			t.Fatalf("GET %s: %v", path, err)
		}
		if resp.StatusCode != http.StatusUnauthorized {
			t.Fatalf("GET %s unauth status=%d, want 401", path, resp.StatusCode)
		}
	}

	// 2. Merchant A trying platform audit endpoints -> 403 FORBIDDEN_PERMISSION_REQUIRED
	curUser = merchantA
	curStore = storeA
	for _, path := range []string{"/api/admin/audit-logs", "/api/admin/audit-logs/verify", "/api/admin/audit-logs/export"} {
		resp, _ := app.Test(httptest.NewRequest(http.MethodGet, path, nil), 5000)
		if resp.StatusCode != http.StatusForbidden {
			t.Fatalf("merchant GET %s status=%d, want 403", path, resp.StatusCode)
		}
	}

	// 3. Support staff without audit:logs:read inspecting Store A or platform audit -> 403
	curUser = support
	curStore = storeA
	for _, path := range []string{"/api/activity-logs", "/api/activity-logs/summary", "/api/admin/audit-logs"} {
		resp, _ := app.Test(httptest.NewRequest(http.MethodGet, path, nil), 5000)
		if resp.StatusCode != http.StatusForbidden {
			t.Fatalf("support without permission GET %s status=%d, want 403", path, resp.StatusCode)
		}
	}

	// 4. Merchant B suspended store -> 403 STORE_SUSPENDED on both /activity-logs and /activity-logs/summary
	curUser = merchantB
	curStore = storeB
	for _, path := range []string{"/api/activity-logs", "/api/activity-logs/summary", "/api/activity-logs/export"} {
		resp, _ := app.Test(httptest.NewRequest(http.MethodGet, path, nil), 5000)
		bodyBytes, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != http.StatusForbidden || !strings.Contains(string(bodyBytes), "STORE_SUSPENDED") {
			t.Fatalf("suspended merchant GET %s status=%d body=%s, want 403 STORE_SUSPENDED", path, resp.StatusCode, string(bodyBytes))
		}
	}

	// 5. Merchant A scoped logs: only sees Toko A (never Toko B), LIKE wildcards escaped properly
	curUser = merchantA
	curStore = storeA
	resp, _ := app.Test(httptest.NewRequest(http.MethodGet, "/api/activity-logs?q=100%25_diskon", nil), 5000)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("merchant A GET /api/activity-logs status=%d, want 200", resp.StatusCode)
	}
	var storeLogsResp struct {
		Success bool                 `json:"success"`
		Total   int64                `json:"total"`
		Data    []models.ActivityLog `json:"data"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&storeLogsResp)
	if storeLogsResp.Total != 1 || len(storeLogsResp.Data) != 1 || storeLogsResp.Data[0].Action != "product.create" {
		t.Fatalf("merchant A filtered logs mismatch: %+v", storeLogsResp)
	}

	// 6. Staff Auditor (custom role with audit:logs:read) can filter role=staff & category=superadmin
	curUser = auditor
	curStore = nil
	respStaff, _ := app.Test(httptest.NewRequest(http.MethodGet, "/api/admin/audit-logs?role=staff&category=superadmin", nil), 5000)
	if respStaff.StatusCode != http.StatusOK {
		t.Fatalf("auditor GET /api/admin/audit-logs status=%d, want 200", respStaff.StatusCode)
	}
	var adminLogsResp struct {
		Success bool                 `json:"success"`
		Total   int64                `json:"total"`
		Data    []models.ActivityLog `json:"data"`
	}
	_ = json.NewDecoder(respStaff.Body).Decode(&adminLogsResp)
	if adminLogsResp.Total != 1 || adminLogsResp.Data[0].ActorRole != "auditor" {
		t.Fatalf("expected role=staff to match auditor row, got %+v", adminLogsResp)
	}

	// 7. Store summary counts match Store A only
	curUser = merchantA
	curStore = storeA
	respSum, _ := app.Test(httptest.NewRequest(http.MethodGet, "/api/activity-logs/summary", nil), 5000)
	if respSum.StatusCode != http.StatusOK {
		t.Fatalf("summary status=%d, want 200", respSum.StatusCode)
	}
	var sumBody struct {
		Success bool             `json:"success"`
		Data    map[string]int64 `json:"data"`
	}
	_ = json.NewDecoder(respSum.Body).Decode(&sumBody)
	if sumBody.Data["catalog"] != 1 || sumBody.Data["total"] != 1 {
		t.Fatalf("unexpected store A summary: %+v", sumBody.Data)
	}
}

func TestActivityLog_ChainVerificationRedactionAndTamperDetection(t *testing.T) {
	db := setupAuditTestDB(t)
	seedAuditRBAC(t, db)

	auditor := &models.User{Name: "Auditor", Email: "auditor@catavor.local", PlatformRole: "auditor"}
	if err := db.Create(auditor).Error; err != nil {
		t.Fatalf("create auditor: %v", err)
	}

	// Legacy unchained row BEFORE chain started
	legacy := models.ActivityLog{
		ActorRole: "system", ActorName: "Legacy", ActorEmail: "legacy@catavor.local",
		Action: "legacy.init", Category: "system", Description: "Baseline sebelum hash chain",
		CreatedAt: time.Now().UTC().Add(-time.Hour),
	}
	if err := db.Create(&legacy).Error; err != nil {
		t.Fatalf("create legacy row: %v", err)
	}

	// Record chained entries with sensitive keys that MUST be redacted
	for i := 1; i <= 3; i++ {
		if err := services.RecordActivityErr(services.RecordActivityParams{
			DB: db, UserID: &auditor.ID, ActorRole: "auditor",
			ActorName: auditor.Name, ActorEmail: auditor.Email,
			Action: fmt.Sprintf("security.step_%d", i), Category: "security",
			EntityType: "user", EntityID: &auditor.ID, EntityTitle: auditor.Email,
			Description: fmt.Sprintf("Event terantai ke-%d", i),
			Changes: map[string]interface{}{
				"safe_field": "ok",
				"password":   "SuperSecretPassword123!",
				"nested": map[string]interface{}{
					"api_key":   "sk_live_should_not_appear",
					"otp_token": "998877",
				},
			},
			IPAddress: "198.51.100.7", UserAgent: "AuditVerify/1.0",
		}); err != nil {
			t.Fatalf("RecordActivityErr(%d): %v", i, err)
		}
	}

	// Ensure secret values were redacted in DB
	var chainedRows []models.ActivityLog
	if err := db.Where("entry_hash <> ''").Order("chain_seq ASC").Find(&chainedRows).Error; err != nil {
		t.Fatalf("query chained rows: %v", err)
	}
	if len(chainedRows) != 3 {
		t.Fatalf("expected 3 chained rows, got %d", len(chainedRows))
	}
	rawJSON := string(chainedRows[0].Changes)
	if strings.Contains(rawJSON, "SuperSecretPassword123!") || strings.Contains(rawJSON, "sk_live_should_not_appear") || strings.Contains(rawJSON, "998877") {
		t.Fatalf("sensitive values leaked into Changes JSON: %s", rawJSON)
	}
	if !strings.Contains(rawJSON, "[REDACTED]") {
		t.Fatalf("expected [REDACTED] placeholder in Changes JSON: %s", rawJSON)
	}

	// Verify intact via HTTP endpoint
	curUser := auditor
	app := buildAuditTestApp(db, &curUser, nil, nil)
	respOK, _ := app.Test(httptest.NewRequest(http.MethodGet, "/api/admin/audit-logs/verify", nil), 5000)
	if respOK.StatusCode != http.StatusOK {
		t.Fatalf("verify status=%d, want 200", respOK.StatusCode)
	}
	var verifyBody struct {
		Success bool                      `json:"success"`
		Data    services.AuditChainReport `json:"data"`
	}
	_ = json.NewDecoder(respOK.Body).Decode(&verifyBody)
	if !verifyBody.Data.Intact || verifyBody.Data.ChainedCount != 3 || verifyBody.Data.UnchainedLegacyCount != 1 {
		t.Fatalf("expected intact report with 3 chained & 1 legacy, got %+v", verifyBody.Data)
	}

	// Tamper row #2 description directly in DB -> verification MUST detect it and identify exact ID
	targetID := chainedRows[1].ID
	if err := db.Model(&models.ActivityLog{}).Where("id = ?", targetID).Update("description", "TAMPERED_DESCRIPTION").Error; err != nil {
		t.Fatalf("tamper row: %v", err)
	}
	reportTampered, err := services.VerifyActivityLogChain(db, 100)
	if err != nil {
		t.Fatalf("VerifyActivityLogChain: %v", err)
	}
	if reportTampered.Intact || reportTampered.BrokenAtID == nil || *reportTampered.BrokenAtID != targetID {
		t.Fatalf("expected tampered chain detection at ID %d, got %+v", targetID, reportTampered)
	}
}

func TestActivityLog_ExportCSVAndJSONSafety(t *testing.T) {
	db := setupAuditTestDB(t)
	seedAuditRBAC(t, db)

	owner := &models.User{Name: "Merchant CSV", Email: "csv@example.com", PlatformRole: "merchant"}
	auditor := &models.User{Name: "Auditor CSV", Email: "auditor.csv@catavor.local", PlatformRole: "auditor"}
	_ = db.Create(owner).Error
	_ = db.Create(auditor).Error
	store := &models.Store{Slug: "toko-csv", StoreTitle: "Toko CSV", UserID: owner.ID, Plan: "pro", DormancyStatus: "active"}
	_ = db.Create(store).Error

	services.RecordActivity(services.RecordActivityParams{
		DB: db, StoreID: &store.ID, UserID: &owner.ID, ActorRole: "merchant",
		ActorName: owner.Name, ActorEmail: owner.Email,
		Action: "product.create", Category: "catalog", EntityType: "product",
		EntityTitle: "=HYPERLINK(\"http://evil.invalid\",\"klik\")",
		Description: "+SUM(1,1) formula injection test",
		IPAddress:   "203.0.113.55",
	})

	var curUser *models.User
	var curStore *models.Store
	app := buildAuditTestApp(db, &curUser, &curStore, nil)

	// Store CSV Export: UTF-8 BOM + formula neutralized
	curUser = owner
	curStore = store
	respCSV, _ := app.Test(httptest.NewRequest(http.MethodGet, "/api/activity-logs/export?format=csv", nil), 5000)
	if respCSV.StatusCode != http.StatusOK {
		t.Fatalf("export csv status=%d, want 200", respCSV.StatusCode)
	}
	csvBytes, _ := io.ReadAll(respCSV.Body)
	if !bytes.HasPrefix(csvBytes, []byte{0xEF, 0xBB, 0xBF}) {
		t.Fatalf("CSV export missing UTF-8 BOM")
	}
	csvText := string(csvBytes)
	if !strings.Contains(csvText, "'=HYPERLINK") || !strings.Contains(csvText, "'+SUM(1,1)") {
		t.Fatalf("CSV export did not neutralize spreadsheet formula injection: %s", csvText)
	}

	// Admin JSON Export: records audit.logs_exported and returns structured payload
	curUser = auditor
	curStore = nil
	respJSON, _ := app.Test(httptest.NewRequest(http.MethodGet, "/api/admin/audit-logs/export?format=json", nil), 5000)
	if respJSON.StatusCode != http.StatusOK {
		t.Fatalf("admin export json status=%d, want 200", respJSON.StatusCode)
	}
	var exportPayload struct {
		TotalExported int                  `json:"total_exported"`
		Data          []models.ActivityLog `json:"data"`
	}
	if err := json.NewDecoder(respJSON.Body).Decode(&exportPayload); err != nil {
		t.Fatalf("decode admin JSON export: %v", err)
	}
	if exportPayload.TotalExported < 1 {
		t.Fatalf("expected >= 1 exported row, got %+v", exportPayload)
	}

	var exportLogCount int64
	db.Model(&models.ActivityLog{}).Where("action IN ?", []string{"activity_log.export", "audit.logs_exported"}).Count(&exportLogCount)
	if exportLogCount != 2 {
		t.Fatalf("expected 2 export audit logs (store + admin), got %d", exportLogCount)
	}
}

func TestHardening_SafeDomainSessionAndRetentionArchival(t *testing.T) {
	db := setupAuditTestDB(t)
	seedAuditRBAC(t, db)

	admin := &models.User{Name: "Super Admin", Email: "sa@catavor.local", PlatformRole: "superadmin"}
	merchant := &models.User{Name: "Merchant Retention", Email: "ret@example.com", PlatformRole: "merchant"}
	_ = db.Create(admin).Error
	_ = db.Create(merchant).Error

	freeStore := &models.Store{Slug: "free-ret", StoreTitle: "Free Store", UserID: merchant.ID, Plan: "free", DormancyStatus: "active"}
	_ = db.Create(freeStore).Error

	sess1 := models.UserSession{UserID: merchant.ID, TokenID: "jti-1", DeviceName: "Chrome Win", OS: "Windows", Browser: "Chrome", IPAddress: "127.0.0.1", LastActiveAt: time.Now().UTC(), ExpiresAt: time.Now().UTC().Add(time.Hour)}
	sess2 := models.UserSession{UserID: merchant.ID, TokenID: "jti-2", DeviceName: "Safari iOS", OS: "iOS", Browser: "Safari", IPAddress: "127.0.0.2", LastActiveAt: time.Now().UTC(), ExpiresAt: time.Now().UTC().Add(time.Hour)}
	_ = db.Create(&sess1).Error
	_ = db.Create(&sess2).Error

	var curUser *models.User
	var curStore *models.Store
	var curClaims *middleware.JWTClaims
	app := buildAuditTestApp(db, &curUser, &curStore, &curClaims)

	// 1. SafeDomain CRUD mutations must emit chained audit entries with real actor
	curUser = admin
	createBody := bytes.NewBufferString(`{"domain":"partner-aman.id","category":"Partner","description":"Test"}`)
	reqCreate := httptest.NewRequest(http.MethodPost, "/api/admin/safe-domains", createBody)
	reqCreate.Header.Set("Content-Type", "application/json")
	respCreate, _ := app.Test(reqCreate, 5000)
	if respCreate.StatusCode != http.StatusCreated {
		t.Fatalf("CreateSafeDomain status=%d, want 201", respCreate.StatusCode)
	}

	var created models.SafeDomain
	db.Where("domain = ?", "partner-aman.id").First(&created)
	if created.CreatedBy != admin.Email {
		t.Fatalf("expected CreatedBy=%q, got %q", admin.Email, created.CreatedBy)
	}

	updBody := bytes.NewBufferString(`{"is_active":false}`)
	reqUpd := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/admin/safe-domains/%d", created.ID), updBody)
	reqUpd.Header.Set("Content-Type", "application/json")
	_, _ = app.Test(reqUpd, 5000)
	_, _ = app.Test(httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/admin/safe-domains/%d", created.ID), nil), 5000)
	_, _ = app.Test(httptest.NewRequest(http.MethodPost, "/api/admin/safe-domains/reset-defaults", nil), 5000)

	var sdAuditCount int64
	db.Model(&models.ActivityLog{}).Where("entity_type = ?", "safe_domain").Count(&sdAuditCount)
	if sdAuditCount != 4 {
		t.Fatalf("expected 4 safe_domain audit logs (create/update/delete/reset), got %d", sdAuditCount)
	}

	// 2. SessionHandler revoke single & other sessions must emit security audit logs
	curUser = merchant
	curClaims = &middleware.JWTClaims{UserID: merchant.ID, RegisteredClaims: jwt.RegisteredClaims{ID: "jti-1"}}
	_, _ = app.Test(httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/sessions/%d", sess2.ID), nil), 5000)
	_, _ = app.Test(httptest.NewRequest(http.MethodPost, "/api/sessions/revoke-others", nil), 5000)

	var sessAuditCount int64
	db.Model(&models.ActivityLog{}).Where("entity_type = ? AND action IN ?", "user_session", []string{"auth.session_revoke", "auth.sessions_revoke_others"}).Count(&sessAuditCount)
	if sessAuditCount != 2 {
		t.Fatalf("expected 2 session revoke audit logs, got %d", sessAuditCount)
	}

	// 3. Retention archival: 100-day old catalog row on Free store archives & leaves hot table;
	// 100-day old security row on Free store stays hot; >365d row archives cleanly.
	oldTime := time.Now().UTC().AddDate(0, 0, -100)
	veryOldTime := time.Now().UTC().AddDate(0, 0, -400)
	oldCatalog := models.ActivityLog{StoreID: &freeStore.ID, Action: "product.create", Category: "catalog", ActorName: "M", Description: "Old catalog", CreatedAt: oldTime}
	oldSecurity := models.ActivityLog{StoreID: &freeStore.ID, Action: "auth.login", Category: "security", ActorName: "M", Description: "Old security <365d", CreatedAt: oldTime}
	oldGlobal := models.ActivityLog{Action: "system.old", Category: "system", ActorName: "S", Description: "Old >365d", CreatedAt: veryOldTime}
	_ = db.Create(&oldCatalog).Error
	_ = db.Create(&oldSecurity).Error
	_ = db.Create(&oldGlobal).Error

	_, err := services.CleanOldActivityLogs(db)
	if err != nil {
		t.Fatalf("CleanOldActivityLogs: %v", err)
	}

	var cntHotCatalog, cntHotSec, cntArchived int64
	db.Model(&models.ActivityLog{}).Where("id = ?", oldCatalog.ID).Count(&cntHotCatalog)
	db.Model(&models.ActivityLog{}).Where("id = ?", oldSecurity.ID).Count(&cntHotSec)
	db.Model(&models.ArchivedActivityLog{}).Where("original_id IN ?", []uint{oldCatalog.ID, oldGlobal.ID}).Count(&cntArchived)
	if cntHotCatalog != 0 || cntHotSec != 1 || cntArchived != 2 {
		t.Fatalf("unexpected archival retention counts: hotCatalog=%d want 0, hotSec=%d want 1, archived=%d want 2", cntHotCatalog, cntHotSec, cntArchived)
	}
}

func TestPostgres_AuditTrailAppendOnlyAndStoreDeletionPreservation(t *testing.T) {
	pgDB := openDisposablePostgres(t)
	services.ConfigureAuditHMACKey("pg-test-audit-hmac-secret-0123456789abcdef", "")

	owner := &models.User{Name: "PG Owner", Email: "pg.owner@example.com", PlatformRole: "merchant"}
	if err := pgDB.Create(owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}
	store := &models.Store{Slug: "pg-audit-store", StoreTitle: "PG Audit Store", UserID: owner.ID, Plan: "free", DormancyStatus: "active"}
	if err := pgDB.Create(store).Error; err != nil {
		t.Fatalf("create store: %v", err)
	}

	// 1. Record hash-chained activity logs with nested JSONB keys (verifies PG JSONB canonical ordering & microsecond timestamps)
	for i := 1; i <= 2; i++ {
		if err := services.RecordActivityErr(services.RecordActivityParams{
			DB: pgDB, StoreID: &store.ID, UserID: &owner.ID, ActorRole: "merchant",
			ActorName: owner.Name, ActorEmail: owner.Email,
			Action: fmt.Sprintf("pg.step_%d", i), Category: "catalog",
			EntityType: "product", EntityTitle: "Item PG",
			Description: fmt.Sprintf("Event PostgreSQL ke-%d", i),
			Changes: map[string]interface{}{
				"z_key": "value-z",
				"a_key": map[string]interface{}{"b": 2, "a": 1, "secret": "must_redact"},
			},
			IPAddress: "127.0.0.1", UserAgent: "PGTest/1.0",
		}); err != nil {
			t.Fatalf("RecordActivityErr(%d): %v", i, err)
		}
	}

	report, err := services.VerifyActivityLogChain(pgDB, 100)
	if err != nil {
		t.Fatalf("VerifyActivityLogChain(pg): %v", err)
	}
	if !report.Intact || report.ChainedCount < 2 {
		t.Fatalf("expected intact PG JSONB hash chain, got %+v", report)
	}

	// 2. Append-only DB trigger MUST block direct UPDATE and unauthorized DELETE on activity_logs & policy_audit_logs
	if err := pgDB.Exec("UPDATE activity_logs SET description = 'tamper' WHERE store_id = ?", store.ID).Error; err == nil {
		t.Fatal("expected PostgreSQL trigger error on direct UPDATE activity_logs, got nil")
	}
	if err := pgDB.Exec("DELETE FROM activity_logs WHERE store_id = ?", store.ID).Error; err == nil {
		t.Fatal("expected PostgreSQL trigger error on direct DELETE activity_logs, got nil")
	}

	pLog := models.PolicyAuditLog{PolicyType: "terms", Action: "update", OldVersion: "v1.0", NewVersion: "v1.1", ChangeSummary: "test", AdminEmail: "a@catavor.local", AdminIP: "127.0.0.1", CreatedAt: time.Now().UTC()}
	if err := pgDB.Create(&pLog).Error; err != nil {
		t.Fatalf("create policy audit log: %v", err)
	}
	if err := pgDB.Exec("UPDATE policy_audit_logs SET action = 'tamper' WHERE id = ?", pLog.ID).Error; err == nil {
		t.Fatal("expected PostgreSQL trigger error on direct UPDATE policy_audit_logs, got nil")
	}
	if err := pgDB.Exec("DELETE FROM policy_audit_logs WHERE id = ?", pLog.ID).Error; err == nil {
		t.Fatal("expected PostgreSQL trigger error on direct DELETE policy_audit_logs, got nil")
	}

	// 3. DeleteStoreRecords must succeed (no FK cascade / SET NULL conflict) AND preserve store's activity logs
	var beforeCount int64
	pgDB.Model(&models.ActivityLog{}).Where("store_id = ?", store.ID).Count(&beforeCount)
	if beforeCount < 2 {
		t.Fatalf("expected >= 2 audit logs before store delete, got %d", beforeCount)
	}
	if err := pgDB.Transaction(func(tx *gorm.DB) error {
		return services.DeleteStoreRecords(tx, store.ID)
	}); err != nil {
		t.Fatalf("DeleteStoreRecords(pg): %v", err)
	}
	var afterCount int64
	pgDB.Model(&models.ActivityLog{}).Where("store_id = ?", store.ID).Count(&afterCount)
	if afterCount != beforeCount {
		t.Fatalf("DeleteStoreRecords altered audit log count: before=%d after=%d", beforeCount, afterCount)
	}

	// 4. CleanOldActivityLogs with aged Free row (>90d) succeeds under trigger via SET LOCAL authorization and archives to archived_activity_logs
	agedTime := time.Now().UTC().AddDate(0, 0, -95)
	if err := pgDB.Exec(
		`INSERT INTO activity_logs (store_id, actor_role, actor_name, actor_email, action, category, description, created_at)
		 VALUES (NULL, 'system', 'Old', 'old@catavor.local', 'system.aged', 'catalog', 'aged global test', ?)`,
		time.Now().UTC().AddDate(0, 0, -370),
	).Error; err != nil {
		t.Fatalf("insert aged row: %v", err)
	}
	_ = agedTime
	if _, err := services.CleanOldActivityLogs(pgDB); err != nil {
		t.Fatalf("CleanOldActivityLogs(pg): %v", err)
	}
	var archivedCnt int64
	pgDB.Model(&models.ArchivedActivityLog{}).Where("action = ?", "system.aged").Count(&archivedCnt)
	if archivedCnt != 1 {
		t.Fatalf("expected aged row archived to archived_activity_logs, got %d", archivedCnt)
	}
}
