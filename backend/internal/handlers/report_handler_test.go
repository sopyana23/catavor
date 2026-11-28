package handlers

import (
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func newReportTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := newTestDB(t)
	if err := db.AutoMigrate(
		&models.Report{},
		&models.SupportTicket{},
		&models.SupportMessage{},
		&models.EmailJob{},
		&models.AdCampaign{},
	); err != nil {
		t.Fatalf("AutoMigrate report tables: %v", err)
	}
	return db
}

func setupReportTestApp(t *testing.T, db *gorm.DB, actor *models.User) *fiber.App {
	t.Helper()
	cfg := testCfg()
	rh := NewReportHandler(db)
	ph := NewProductHandler(cfg, db)
	app := fiber.New(fiber.Config{DisableStartupMessage: true})

	app.Post("/api/reports", rh.CreateReport)

	adminAuth := func(c *fiber.Ctx) error {
		if actor != nil {
			c.Locals("user", actor)
		}
		return c.Next()
	}
	app.Get("/api/admin/reports", adminAuth, rh.Index)
	app.Get("/api/admin/reports/:id", adminAuth, rh.Show)
	app.Put("/api/admin/reports/:id", adminAuth, rh.UpdateStatus)

	app.Get("/api/products", ph.Index)
	app.Get("/api/u/:slug/products", ph.Index)
	app.Get("/api/products/:id", ph.Show)
	app.Get("/api/products/:id/recommendations", ph.GetRecommendations)
	return app
}

func seedReportFixtures(t *testing.T, db *gorm.DB) (admin models.User, storeA models.Store, storeB models.Store, prodA models.Product, prodB models.Product) {
	t.Helper()
	admin = models.User{Name: "Admin Kepatuhan", Email: "compliance-qa@example.invalid", PlatformRole: "superadmin"}
	mustCreate(t, db, &admin)

	merchantA := models.User{Name: "Merchant A", Email: "merchanta-qa@example.invalid"}
	merchantB := models.User{Name: "Merchant B", Email: "merchantb-qa@example.invalid"}
	mustCreate(t, db, &merchantA)
	mustCreate(t, db, &merchantB)

	storeA = models.Store{UserID: merchantA.ID, Slug: "qa-store-a", StoreTitle: "QA Store A", DormancyStatus: "active"}
	storeB = models.Store{UserID: merchantB.ID, Slug: "qa-store-b", StoreTitle: "QA Store B", DormancyStatus: "active"}
	mustCreate(t, db, &storeA)
	mustCreate(t, db, &storeB)

	prodA = models.Product{StoreID: storeA.ID, Name: "Produk Store A", Price: 150000, ProductType: "physical", IsActive: true}
	prodB = models.Product{StoreID: storeB.ID, Name: "Produk Store B", Price: 250000, ProductType: "physical", IsActive: true}
	mustCreate(t, db, &prodA)
	mustCreate(t, db, &prodB)
	return
}

func TestReportCreate_ProductIDDedupAndCrossTenantIDOR(t *testing.T) {
	db := newReportTestDB(t)
	admin, storeA, _, prodA, prodB := seedReportFixtures(t, db)
	app := setupReportTestApp(t, db, &admin)

	// 1. Cross-tenant item IDOR: store A slug + prodB.ID must return 404
	rCross := call(t, app, "POST", "/api/reports", map[string]any{
		"target_type":     "item",
		"store_id":        storeA.ID,
		"product_id":      prodB.ID,
		"reason_category": "prohibited_item",
		"reason_label":    "Item Terlarang",
		"description":     "Cross-tenant item binding attempt",
	})
	if rCross.Status != http.StatusNotFound {
		t.Fatalf("cross-tenant product_id status = %d, want 404 (%s)", rCross.Status, rCross.Raw)
	}

	// 2. Nonexistent product_id must return 404 (not 500 FK violation)
	rGhost := call(t, app, "POST", "/api/reports", map[string]any{
		"target_type":     "item",
		"store_id":        storeA.ID,
		"product_id":      999999,
		"reason_category": "prohibited_item",
		"reason_label":    "Item Terlarang",
		"description":     "Nonexistent product id",
	})
	if rGhost.Status != http.StatusNotFound {
		t.Fatalf("ghost product_id status = %d, want 404 (%s)", rGhost.Status, rGhost.Raw)
	}

	// 3. Valid item report with product_id only (no fauna_id) -> 201
	rItem1 := call(t, app, "POST", "/api/reports", map[string]any{
		"target_type":     "item",
		"store_id":        storeA.ID,
		"product_id":      prodA.ID,
		"reason_category": "prohibited_item",
		"reason_label":    "Item Terlarang",
		"description":     "Laporan pertama via product_id",
		"reporter_email":  "pelapor-item@example.invalid",
	})
	if rItem1.Status != http.StatusCreated {
		t.Fatalf("first item report status = %d, want 201 (%s)", rItem1.Status, rItem1.Raw)
	}

	// 4. Duplicate item report with product_id only must trigger dedup (200 duplicate:true)
	rItemDup := call(t, app, "POST", "/api/reports", map[string]any{
		"target_type":     "item",
		"store_id":        storeA.ID,
		"product_id":      prodA.ID,
		"reason_category": "prohibited_item",
		"reason_label":    "Item Terlarang",
		"description":     "Duplikat via product_id",
		"reporter_email":  "pelapor-item@example.invalid",
	})
	if rItemDup.Status != http.StatusOK || rItemDup.Body["duplicate"] != true {
		t.Fatalf("expected duplicate:true on product_id repeat, got status=%d raw=%s", rItemDup.Status, rItemDup.Raw)
	}

	// 5. Submitting a catalog-level report on the same store by the same reporter must NOT collide with item report
	rCatalog := call(t, app, "POST", "/api/reports", map[string]any{
		"target_type":     "catalog",
		"store_id":        storeA.ID,
		"reason_category": "fraud",
		"reason_label":    "Penipuan Katalog",
		"description":     "Laporan katalog terpisah",
		"reporter_email":  "pelapor-item@example.invalid",
	})
	if rCatalog.Status != http.StatusCreated {
		t.Fatalf("catalog report after item report status = %d, want 201 (%s)", rCatalog.Status, rCatalog.Raw)
	}

	// 6. When item report moves to re_review, dedup must still catch duplicates
	db.Model(&models.Report{}).Where("store_id = ? AND target_type = 'item'", storeA.ID).Update("status", "re_review")
	rItemReReviewDup := call(t, app, "POST", "/api/reports", map[string]any{
		"target_type":     "item",
		"store_id":        storeA.ID,
		"product_id":      prodA.ID,
		"reason_category": "prohibited_item",
		"reason_label":    "Item Terlarang",
		"reporter_email":  "pelapor-item@example.invalid",
	})
	if rItemReReviewDup.Status != http.StatusOK || rItemReReviewDup.Body["duplicate"] != true {
		t.Fatalf("expected duplicate:true during re_review, got status=%d raw=%s", rItemReReviewDup.Status, rItemReReviewDup.Raw)
	}
}

func TestReportUpdateStatus_LongAdminNotesBoundedActionURL(t *testing.T) {
	db := newReportTestDB(t)
	admin, storeA, _, prodA, _ := seedReportFixtures(t, db)
	app := setupReportTestApp(t, db, &admin)

	rpt := models.Report{
		ReportNumber:   "RPT-20261125-LONG1",
		TargetType:     "item",
		StoreID:        storeA.ID,
		ProductID:      &prodA.ID,
		FaunaID:        &prodA.ID,
		StoreSlug:      storeA.Slug,
		StoreTitle:     storeA.StoreTitle,
		ItemName:       prodA.Name,
		ReasonCategory: "policy",
		ReasonLabel:    "Ketidaksesuaian Deskripsi & Foto Produk",
		Status:         "pending",
	}
	mustCreate(t, db, &rpt)

	longNotes := strings.Repeat("Catatan peninjauan sangat panjang dengan simbol & ? = dan spasi. ", 40) // >2500 chars
	res := call(t, app, "PUT", fmt.Sprintf("/api/admin/reports/%d", rpt.ID), map[string]any{
		"status":       "action_taken",
		"action_taken": "item_needs_fix",
		"admin_notes":  longNotes,
	})
	if res.Status != http.StatusOK {
		t.Fatalf("UpdateStatus with long admin_notes failed: status=%d raw=%s", res.Status, res.Raw)
	}

	var notif models.Notification
	if err := db.Where("target_id = ? AND target_type = 'single_store'", storeA.ID).Order("created_at DESC").First(&notif).Error; err != nil {
		t.Fatalf("expected notification created: %v", err)
	}
	if len(notif.ActionURL) > 480 {
		t.Fatalf("action_url exceeds bounded 480-byte limit: len=%d url=%s", len(notif.ActionURL), notif.ActionURL)
	}
	if strings.Contains(notif.ActionURL, "notes=") {
		t.Fatalf("action_url must not embed notes query param: %s", notif.ActionURL)
	}
	if !strings.Contains(notif.DetailContent, "Catatan peninjauan sangat panjang") {
		t.Fatalf("expected full reviewer notes preserved in detail_content")
	}
}

func TestReportUpdateStatus_PreventZombieReactivationAndBannedItemRestore(t *testing.T) {
	db := newReportTestDB(t)
	admin, storeA, _, prodA, _ := seedReportFixtures(t, db)
	app := setupReportTestApp(t, db, &admin)

	// Mark storeA permanently banned & blacklisted
	db.Model(&models.Store{}).Where("id = ?", storeA.ID).Updates(map[string]interface{}{
		"dormancy_status": "banned",
		"is_suspended":    true,
		"is_blacklisted":  true,
	})
	rptStore := models.Report{
		ReportNumber:   "RPT-20261125-ZOMB1",
		TargetType:     "catalog",
		StoreID:        storeA.ID,
		StoreSlug:      storeA.Slug,
		StoreTitle:     storeA.StoreTitle,
		ReasonCategory: "fraud",
		ReasonLabel:    "Penipuan",
		Status:         "banned",
		ActionTaken:    "catalog_banned",
	}
	mustCreate(t, db, &rptStore)

	for _, action := range []string{"catalog_reactivated", "catalog_suspended"} {
		res := call(t, app, "PUT", fmt.Sprintf("/api/admin/reports/%d", rptStore.ID), map[string]any{
			"status":       "resolved",
			"action_taken": action,
			"admin_notes":  "Coba pulihkan toko banned",
		})
		if res.Status != http.StatusConflict {
			t.Fatalf("expected 409 Conflict for %s on banned store, got %d (%s)", action, res.Status, res.Raw)
		}
		if res.Body["code"] != "STORE_PERMANENTLY_BANNED" {
			t.Fatalf("unexpected error code for %s: %v", action, res.Body["code"])
		}
	}

	var refreshedStore models.Store
	db.First(&refreshedStore, storeA.ID)
	if refreshedStore.DormancyStatus != "banned" || !refreshedStore.IsBlacklisted {
		t.Fatalf("banned store mutated unexpectedly: status=%s blacklisted=%v", refreshedStore.DormancyStatus, refreshedStore.IsBlacklisted)
	}

	// Mark prodA permanently banned and attempt item_restored / item_needs_fix
	db.Model(&models.Product{}).Where("id = ?", prodA.ID).Updates(map[string]interface{}{
		"is_active":         false,
		"moderation_status": "banned",
	})
	rptItem := models.Report{
		ReportNumber:   "RPT-20261125-ZOMB2",
		TargetType:     "item",
		StoreID:        storeA.ID,
		ProductID:      &prodA.ID,
		StoreSlug:      storeA.Slug,
		StoreTitle:     storeA.StoreTitle,
		ItemName:       prodA.Name,
		ReasonCategory: "prohibited",
		ReasonLabel:    "Produk Terlarang",
		Status:         "banned",
		ActionTaken:    "item_banned",
	}
	mustCreate(t, db, &rptItem)

	for _, action := range []string{"item_restored", "item_needs_fix", "item_locked"} {
		res := call(t, app, "PUT", fmt.Sprintf("/api/admin/reports/%d", rptItem.ID), map[string]any{
			"action_taken": action,
			"admin_notes":  "Coba pulihkan item banned",
		})
		if res.Status != http.StatusConflict || res.Body["code"] != "ITEM_PERMANENTLY_BANNED" {
			t.Fatalf("expected 409 ITEM_PERMANENTLY_BANNED for %s, got %d (%s)", action, res.Status, res.Raw)
		}
	}
}

func TestReportUpdateStatus_SiblingReReviewSyncAndStrictValidation(t *testing.T) {
	db := newReportTestDB(t)
	admin, storeA, _, prodA, _ := seedReportFixtures(t, db)
	app := setupReportTestApp(t, db, &admin)

	// Primary report uses product_id ONLY (fauna_id nil), sibling report is in 're_review'
	primary := models.Report{
		ReportNumber:   "RPT-20261125-SIB1",
		TargetType:     "item",
		StoreID:        storeA.ID,
		ProductID:      &prodA.ID,
		StoreSlug:      storeA.Slug,
		StoreTitle:     storeA.StoreTitle,
		ItemName:       prodA.Name,
		ReasonCategory: "policy",
		ReasonLabel:    "Aturan Katalog",
		Status:         "pending",
	}
	sibling := models.Report{
		ReportNumber:   "RPT-20261125-SIB2",
		TargetType:     "item",
		StoreID:        storeA.ID,
		ProductID:      &prodA.ID,
		StoreSlug:      storeA.Slug,
		StoreTitle:     storeA.StoreTitle,
		ItemName:       prodA.Name,
		ReasonCategory: "policy",
		ReasonLabel:    "Aturan Katalog",
		Status:         "re_review",
	}
	mustCreate(t, db, &primary)
	mustCreate(t, db, &sibling)

	// Invalid status & invalid action_taken must return 400
	badStatus := call(t, app, "PUT", fmt.Sprintf("/api/admin/reports/%d", primary.ID), map[string]any{
		"status": "super_invalid_status",
	})
	if badStatus.Status != http.StatusBadRequest || badStatus.Body["code"] != "INVALID_REPORT_STATUS" {
		t.Fatalf("expected 400 INVALID_REPORT_STATUS, got %d (%s)", badStatus.Status, badStatus.Raw)
	}

	badAction := call(t, app, "PUT", fmt.Sprintf("/api/admin/reports/%d", primary.ID), map[string]any{
		"status":       "action_taken",
		"action_taken": "nuke_from_orbit",
	})
	if badAction.Status != http.StatusBadRequest || badAction.Body["code"] != "INVALID_MODERATION_ACTION" {
		t.Fatalf("expected 400 INVALID_MODERATION_ACTION, got %d (%s)", badAction.Status, badAction.Raw)
	}

	// Valid resolution must sync the 're_review' sibling too (no orphans left)
	okRes := call(t, app, "PUT", fmt.Sprintf("/api/admin/reports/%d", primary.ID), map[string]any{
		"status":       "resolved",
		"action_taken": "item_restored",
		"admin_notes":  "Sudah diperbaiki dan diverifikasi",
	})
	if okRes.Status != http.StatusOK {
		t.Fatalf("expected 200 OK resolving report, got %d (%s)", okRes.Status, okRes.Raw)
	}

	var refreshedSibling models.Report
	db.First(&refreshedSibling, sibling.ID)
	if refreshedSibling.Status != "resolved" || refreshedSibling.ActionTaken != "item_restored" {
		t.Fatalf("re_review sibling was not synchronized: status=%s action=%s", refreshedSibling.Status, refreshedSibling.ActionTaken)
	}

	// Negative page in Index must normalize to page=1 instead of crashing OFFSET -15
	idxNeg := call(t, app, "GET", "/api/admin/reports?page=-5", nil)
	if idxNeg.Status != http.StatusOK {
		t.Fatalf("Index page=-5 failed: status=%d (%s)", idxNeg.Status, idxNeg.Raw)
	}
	pgMap, _ := idxNeg.Body["pagination"].(map[string]any)
	if pgMap["page"] != float64(1) {
		t.Fatalf("expected normalized page=1, got %v", pgMap["page"])
	}
}

func TestReportUpdateStatus_CatalogBannedPersistence(t *testing.T) {
	// Ensure SMTP fallback never dials external hosts during unit tests
	t.Setenv("SMTP_HOST", "127.0.0.1")
	ln, err := net.Listen("tcp4", "127.0.0.1:0")
	if err == nil {
		t.Setenv("SMTP_PORT", strconv.Itoa(ln.Addr().(*net.TCPAddr).Port))
		ln.Close()
	}

	db := newReportTestDB(t)
	if services.GetEmailQueue() == nil {
		services.InitEmailQueue(db)
	}

	admin, _, storeB, _, prodB := seedReportFixtures(t, db)
	app := setupReportTestApp(t, db, &admin)

	rpt := models.Report{
		ReportNumber:   "RPT-20261125-BAN1",
		TargetType:     "catalog",
		StoreID:        storeB.ID,
		StoreSlug:      storeB.Slug,
		StoreTitle:     storeB.StoreTitle,
		ReasonCategory: "illegal",
		ReasonLabel:    "Penipuan Berat",
		Status:         "pending",
	}
	mustCreate(t, db, &rpt)

	res := call(t, app, "PUT", fmt.Sprintf("/api/admin/reports/%d", rpt.ID), map[string]any{
		"status":       "banned",
		"action_taken": "catalog_banned",
		"admin_notes":  "Pelanggaran berat terkonfirmasi",
	})
	if res.Status != http.StatusOK {
		t.Fatalf("catalog_banned failed: status=%d (%s)", res.Status, res.Raw)
	}

	var updatedStore models.Store
	db.First(&updatedStore, storeB.ID)
	if updatedStore.DormancyStatus != "banned" || !updatedStore.IsBlacklisted || !updatedStore.IsSuspended {
		t.Fatalf("store not properly banned: dormancy=%s blacklisted=%v suspended=%v",
			updatedStore.DormancyStatus, updatedStore.IsBlacklisted, updatedStore.IsSuspended)
	}

	var updatedProd models.Product
	db.Unscoped().First(&updatedProd, prodB.ID)
	if updatedProd.IsActive || updatedProd.ModerationStatus != "banned" {
		t.Fatalf("store product not deactivated on store ban: active=%v mod=%s", updatedProd.IsActive, updatedProd.ModerationStatus)
	}

	var blCount int64
	db.Model(&models.BlacklistedSlug{}).Where("LOWER(slug) = ?", storeB.Slug).Count(&blCount)
	if blCount != 1 {
		t.Fatalf("expected slug blacklisted, count=%d", blCount)
	}
}

const storeSlugTestPlaceholder = "qa-store-b"

func TestProductVisibility_SuspendedAndBannedStoreBlocked(t *testing.T) {
	db := newReportTestDB(t)
	admin, storeA, storeB, prodA, prodB := seedReportFixtures(t, db)

	// Secondary active product on storeA to verify recommendations filter
	prodA2 := models.Product{StoreID: storeA.ID, Name: "Produk Store A Kedua", Price: 175000, ProductType: "physical", IsActive: true}
	mustCreate(t, db, &prodA2)

	// Suspend storeA, ban storeB
	db.Model(&models.Store{}).Where("id = ?", storeA.ID).Updates(map[string]interface{}{
		"dormancy_status": "suspended",
		"is_suspended":    true,
	})
	db.Model(&models.Store{}).Where("id = ?", storeB.ID).Updates(map[string]interface{}{
		"dormancy_status": "banned",
		"is_suspended":    true,
		"is_blacklisted":  true,
	})

	publicApp := setupReportTestApp(t, db, nil)

	// 1. Global /api/products must exclude products from suspended & banned stores
	rGlobal := call(t, publicApp, "GET", "/api/products", nil)
	if rGlobal.Status != http.StatusOK {
		t.Fatalf("GET /api/products failed: %d", rGlobal.Status)
	}
	if dataArr, ok := rGlobal.Body["data"].([]any); ok && len(dataArr) != 0 {
		t.Fatalf("expected 0 public products when all stores suspended/banned, got %d (%s)", len(dataArr), rGlobal.Raw)
	}

	// 2. Store-scoped /api/u/:slug/products for suspended store returns empty list + is_suspended:true
	rStoreSusp := call(t, publicApp, "GET", fmt.Sprintf("/api/u/%s/products", storeA.Slug), nil)
	if rStoreSusp.Status != http.StatusOK || rStoreSusp.Body["is_suspended"] != true {
		t.Fatalf("expected is_suspended=true on /api/u/%s/products, got %d (%s)", storeA.Slug, rStoreSusp.Status, rStoreSusp.Raw)
	}
	if dataArr, ok := rStoreSusp.Body["data"].([]any); ok && len(dataArr) != 0 {
		t.Fatalf("suspended store products leaked %d items publicly", len(dataArr))
	}

	// 3. Store-scoped /api/u/:slug/products for banned store returns 404 STORE_BANNED
	rStoreBan := call(t, publicApp, "GET", fmt.Sprintf("/api/u/%s/products", storeB.Slug), nil)
	if rStoreBan.Status != http.StatusNotFound || rStoreBan.Body["code"] != "STORE_BANNED" {
		t.Fatalf("expected 404 STORE_BANNED, got %d (%s)", rStoreBan.Status, rStoreBan.Raw)
	}

	// 4. Direct /api/products/:id on suspended & banned stores must block public access
	rShowSusp := call(t, publicApp, "GET", fmt.Sprintf("/api/products/%d", prodA.ID), nil)
	if rShowSusp.Status != http.StatusNotFound || rShowSusp.Body["code"] != "STORE_SUSPENDED" {
		t.Fatalf("expected 404 STORE_SUSPENDED for /api/products/%d, got %d (%s)", prodA.ID, rShowSusp.Status, rShowSusp.Raw)
	}
	rShowBan := call(t, publicApp, "GET", fmt.Sprintf("/api/products/%d", prodB.ID), nil)
	if rShowBan.Status != http.StatusNotFound || rShowBan.Body["code"] != "STORE_BANNED" {
		t.Fatalf("expected 404 STORE_BANNED for /api/products/%d, got %d (%s)", prodB.ID, rShowBan.Status, rShowBan.Raw)
	}

	// 5. Recommendations for suspended/banned product must not leak sibling items
	rRecSusp := call(t, publicApp, "GET", fmt.Sprintf("/api/products/%d/recommendations", prodA.ID), nil)
	if rRecSusp.Status != http.StatusOK || rRecSusp.Body["is_suspended"] != true {
		t.Fatalf("expected empty is_suspended recommendations, got %d (%s)", rRecSusp.Status, rRecSusp.Raw)
	}
	if recArr, ok := rRecSusp.Body["data"].([]any); ok && len(recArr) != 0 {
		t.Fatalf("recommendations leaked %d items for suspended store", len(recArr))
	}

	// 6. Merchant store context (Locals("store")) or valid owner JWT still accesses own store items
	ph := NewProductHandler(testCfg(), db)
	merchantApp := fiber.New(fiber.Config{DisableStartupMessage: true})
	merchantApp.Use(func(c *fiber.Ctx) error {
		var s models.Store
		db.First(&s, storeA.ID)
		c.Locals("store", &s)
		c.Locals("user", &admin)
		return c.Next()
	})
	merchantApp.Get("/api/products/:id", ph.Show)
	merchantApp.Get("/api/u/:slug/products", ph.Index)

	rOwnerShow := call(t, merchantApp, "GET", fmt.Sprintf("/api/products/%d", prodA.ID), nil)
	if rOwnerShow.Status != http.StatusOK {
		t.Fatalf("merchant owner must still view own item while suspended, got %d (%s)", rOwnerShow.Status, rOwnerShow.Raw)
	}

	// Ensure unused helper is exercised cleanly
	_ = time.Now()
}

func TestReportIndexAndShow_BatchedActiveCountAndProductIDContext(t *testing.T) {
	db := newReportTestDB(t)
	admin, storeA, _, prodA, _ := seedReportFixtures(t, db)
	app := setupReportTestApp(t, db, &admin)

	now := time.Now().UTC()
	itemRpt1 := models.Report{
		ReportNumber:   "RPT-20261125-BATCH1",
		TargetType:     "item",
		StoreID:        storeA.ID,
		ProductID:      &prodA.ID,
		StoreSlug:      storeA.Slug,
		StoreTitle:     storeA.StoreTitle,
		ItemName:       prodA.Name,
		ReasonCategory: "policy",
		ReasonLabel:    "Aturan Produk",
		Status:         "pending",
		CreatedAt:      now,
	}
	itemRpt2 := models.Report{
		ReportNumber:   "RPT-20261125-BATCH2",
		TargetType:     "item",
		StoreID:        storeA.ID,
		ProductID:      &prodA.ID,
		StoreSlug:      storeA.Slug,
		StoreTitle:     storeA.StoreTitle,
		ItemName:       prodA.Name,
		ReasonCategory: "policy",
		ReasonLabel:    "Aturan Produk",
		Status:         "re_review",
		CreatedAt:      now.Add(time.Second),
	}
	itemHist := models.Report{
		ReportNumber:   "RPT-20261125-HIST1",
		TargetType:     "item",
		StoreID:        storeA.ID,
		ProductID:      &prodA.ID,
		StoreSlug:      storeA.Slug,
		StoreTitle:     storeA.StoreTitle,
		ItemName:       prodA.Name,
		ReasonCategory: "policy",
		ReasonLabel:    "Riwayat Lama",
		Status:         "resolved",
		ActionTaken:    "item_restored",
		ReviewedAt:     &now,
		CreatedAt:      now.Add(-time.Hour),
	}
	catRpt := models.Report{
		ReportNumber:   "RPT-20261125-CAT1",
		TargetType:     "catalog",
		StoreID:        storeA.ID,
		StoreSlug:      storeA.Slug,
		StoreTitle:     storeA.StoreTitle,
		ReasonCategory: "fraud",
		ReasonLabel:    "Laporan Katalog",
		Status:         "investigating",
		CreatedAt:      now.Add(2 * time.Second),
	}
	for _, r := range []*models.Report{&itemRpt1, &itemRpt2, &itemHist, &catRpt} {
		mustCreate(t, db, r)
	}

	idxRes := call(t, app, "GET", "/api/admin/reports", nil)
	if idxRes.Status != http.StatusOK {
		t.Fatalf("Index status=%d raw=%s", idxRes.Status, idxRes.Raw)
	}
	rows, _ := idxRes.Body["data"].([]any)
	if len(rows) != 4 {
		t.Fatalf("expected 4 rows, got %d", len(rows))
	}

	activeCounts := map[string]float64{}
	for _, rawRow := range rows {
		m, _ := rawRow.(map[string]any)
		rn, _ := m["report_number"].(string)
		cnt, _ := m["active_report_count"].(float64)
		activeCounts[rn] = cnt
	}
	if activeCounts["RPT-20261125-BATCH1"] != 2 || activeCounts["RPT-20261125-BATCH2"] != 2 {
		t.Fatalf("expected batched item active_report_count=2, got %v", activeCounts)
	}
	if activeCounts["RPT-20261125-CAT1"] != 1 {
		t.Fatalf("expected catalog active_report_count=1, got %v", activeCounts)
	}

	shwRes := call(t, app, "GET", fmt.Sprintf("/api/admin/reports/%s", itemRpt1.ReportNumber), nil)
	if shwRes.Status != http.StatusOK {
		t.Fatalf("Show status=%d raw=%s", shwRes.Status, shwRes.Raw)
	}
	activeRel, _ := shwRes.Body["active_reports"].([]any)
	historyRel, _ := shwRes.Body["history_reports"].([]any)
	if len(activeRel) != 1 {
		t.Fatalf("expected 1 related active report in Show, got %d (%s)", len(activeRel), shwRes.Raw)
	}
	if len(historyRel) != 1 {
		t.Fatalf("expected 1 related history report in Show, got %d (%s)", len(historyRel), shwRes.Raw)
	}
}

func TestReportCreate_ItemRequiresTargetProductID(t *testing.T) {
	db := newReportTestDB(t)
	admin, storeA, _, _, _ := seedReportFixtures(t, db)
	app := setupReportTestApp(t, db, &admin)

	res := call(t, app, "POST", "/api/reports", map[string]any{
		"target_type":     "item",
		"store_id":        storeA.ID,
		"item_name":       "Item Fiktif Tanpa ID",
		"reason_category": "scam",
		"reason_label":    "Penipuan",
	})
	if res.Status != http.StatusBadRequest {
		t.Fatalf("expected 400 when target_type=item without product_id/fauna_id, got %d (%s)", res.Status, res.Raw)
	}
	if code, _ := res.Body["code"].(string); code != "ITEM_ID_REQUIRED" {
		t.Fatalf("expected code=ITEM_ID_REQUIRED, got %q (%s)", code, res.Raw)
	}
}

func TestReportUpdateStatus_StaffWithoutSuspendCannotBypassStoreSanctionRBAC(t *testing.T) {
	db := newReportTestDB(t)
	_, storeA, _, _, _ := seedReportFixtures(t, db)

	perm := models.PlatformPermission{
		Key:   "compliance:reports:manage",
		Group: "compliance",
		Name:  "Kelola Laporan",
	}
	mustCreate(t, db, &perm)

	reportOnlyRole := models.PlatformRole{
		Slug: "report_viewer_qa",
		Name: "Report Reviewer QA",
	}
	mustCreate(t, db, &reportOnlyRole)
	mustCreate(t, db, &models.PlatformRolePermission{
		RoleID:       reportOnlyRole.ID,
		PermissionID: perm.ID,
	})

	staff := models.User{
		Name:         "Staff Laporan Saja",
		Email:        "staff-report-only@example.invalid",
		PlatformRole: reportOnlyRole.Slug,
	}
	mustCreate(t, db, &staff)
	services.InitRBACService(db)

	catRpt := models.Report{
		ReportNumber:   "RPT-20261128-RBAC1",
		TargetType:     "catalog",
		StoreID:        storeA.ID,
		StoreSlug:      storeA.Slug,
		StoreTitle:     storeA.StoreTitle,
		ReasonCategory: "fraud",
		ReasonLabel:    "Pelanggaran Berat",
		Status:         "pending",
	}
	mustCreate(t, db, &catRpt)

	app := setupReportTestApp(t, db, &staff)

	// Attempt bypass with apply_enforcement=false must STILL be rejected 403
	res := call(t, app, "PUT", "/api/admin/reports/"+catRpt.ReportNumber, map[string]any{
		"status":            "banned",
		"action_taken":      "catalog_banned",
		"admin_notes":       "Mencoba bypass RBAC dengan apply_enforcement=false",
		"apply_enforcement": false,
	})
	if res.Status != http.StatusForbidden {
		t.Fatalf("expected 403 for catalog_banned bypass attempt with apply_enforcement=false, got %d (%s)", res.Status, res.Raw)
	}

	var refreshed models.Report
	if err := db.Where("report_number = ?", catRpt.ReportNumber).First(&refreshed).Error; err != nil {
		t.Fatalf("query refreshed report: %v", err)
	}
	if refreshed.Status != "pending" || (refreshed.ActionTaken != "" && refreshed.ActionTaken != "none") {
		t.Fatalf("expected report unchanged on 403, got status=%s action=%s", refreshed.Status, refreshed.ActionTaken)
	}
}

func TestReportUpdateStatus_DismissUnsticksReReviewAndClearsStaleActionAndIncludesBannedHistory(t *testing.T) {
	db := newReportTestDB(t)
	admin, storeA, _, prodA, _ := seedReportFixtures(t, db)
	app := setupReportTestApp(t, db, &admin)

	// Simulate prodA currently awaiting re_review after needs_fix resubmission
	if err := db.Exec("UPDATE products SET is_active = ?, moderation_status = ? WHERE id = ?", false, "in_review", prodA.ID).Error; err != nil {
		t.Fatalf("update product to in_review: %v", err)
	}

	reRevRpt := models.Report{
		ReportNumber:   "RPT-20261128-REREV1",
		TargetType:     "item",
		StoreID:        storeA.ID,
		ProductID:      &prodA.ID,
		StoreSlug:      storeA.Slug,
		StoreTitle:     storeA.StoreTitle,
		ItemName:       prodA.Name,
		ReasonCategory: "misleading",
		ReasonLabel:    "Info Tidak Akurat",
		Status:         "re_review",
		ActionTaken:    "item_needs_fix",
	}
	mustCreate(t, db, &reRevRpt)

	// Historical banned catalog report for the same store must appear in history_reports
	now := time.Now().UTC()
	histBanned := models.Report{
		ReportNumber:   "RPT-20261128-HISTBAN",
		TargetType:     "item",
		StoreID:        storeA.ID,
		ProductID:      &prodA.ID,
		StoreSlug:      storeA.Slug,
		StoreTitle:     storeA.StoreTitle,
		ItemName:       prodA.Name,
		ReasonCategory: "fraud",
		ReasonLabel:    "Pelanggaran Sebelumnya",
		Status:         "banned",
		ActionTaken:    "item_banned",
		ReviewedAt:     &now,
	}
	mustCreate(t, db, &histBanned)

	// Verify Show returns the 'banned' report inside history_reports before dismissal
	shwRes := call(t, app, "GET", "/api/admin/reports/"+reRevRpt.ReportNumber, nil)
	if shwRes.Status != http.StatusOK {
		t.Fatalf("Show status=%d raw=%s", shwRes.Status, shwRes.Raw)
	}
	historyRel, _ := shwRes.Body["history_reports"].([]any)
	if len(historyRel) != 1 {
		t.Fatalf("expected 1 banned report in history_reports, got %d (%s)", len(historyRel), shwRes.Raw)
	}

	// Dismissing re_review with stale action_taken in request body must reset action_taken='none' and restore prodA from in_review
	disRes := call(t, app, "PUT", "/api/admin/reports/"+reRevRpt.ReportNumber, map[string]any{
		"status":       "dismissed",
		"action_taken": "item_locked",
		"admin_notes":  "Laporan revisi dinyatakan memenuhi syarat, penindakan dibatalkan.",
	})
	if disRes.Status != http.StatusOK {
		t.Fatalf("dismiss status=%d raw=%s", disRes.Status, disRes.Raw)
	}

	var updatedRpt models.Report
	if err := db.Where("report_number = ?", reRevRpt.ReportNumber).First(&updatedRpt).Error; err != nil {
		t.Fatalf("query updated report: %v", err)
	}
	if updatedRpt.Status != "dismissed" || updatedRpt.ActionTaken != "none" {
		t.Fatalf("expected status=dismissed and action_taken=none, got status=%s action=%s", updatedRpt.Status, updatedRpt.ActionTaken)
	}

	var updatedProd models.Product
	if err := db.Where("id = ?", prodA.ID).First(&updatedProd).Error; err != nil {
		t.Fatalf("query updated product: %v", err)
	}
	if !updatedProd.IsActive || updatedProd.ModerationStatus != "none" {
		t.Fatalf("expected prodA unstuck from in_review -> active/none, got is_active=%v moderation_status=%s", updatedProd.IsActive, updatedProd.ModerationStatus)
	}
}

