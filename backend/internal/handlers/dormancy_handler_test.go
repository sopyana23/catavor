package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func openDormancyTestDB(t *testing.T) *gorm.DB {
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
		&models.Notification{},
		&models.SupportTicket{},
		&models.Report{},
		&models.BlacklistedSlug{},
		&models.ActivityLog{},
	); err != nil {
		t.Fatalf("AutoMigrate: %v", err)
	}
	return db
}

func TestDormancyHandler_GETDoesNotConsumeToken_POSTReactivatesSuspendedDormancyStore(t *testing.T) {
	db := openDormancyTestDB(t)
	h := NewDormancyHandler(db)

	app := fiber.New()
	app.Get("/api/public/stores/reactivate", h.HandlePublicReactivateStore)
	app.Post("/api/public/stores/reactivate", h.HandlePublicReactivateStoreConfirm)

	suspendedAt := time.Now().UTC().AddDate(0, 0, -3)
	owner := models.User{Name: "Pemilik Dormant", Email: "dormant-owner@example.invalid", PlatformRole: "merchant"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}
	token := "secure-dormancy-token-45days"
	store := models.Store{
		UserID:              owner.ID,
		Slug:                "toko-dormant-stage3",
		StoreTitle:          "Toko Dormant Stage 3",
		Plan:                "free",
		DormancyStatus:      "suspended",
		IsSuspended:         true,
		SuspensionReason:    "dormancy",
		DormancySuspendedAt: &suspendedAt,
		ReactivationToken:   token,
		LastActivityAt:      time.Now().UTC().AddDate(0, 0, -48),
	}
	if err := db.Create(&store).Error; err != nil {
		t.Fatalf("create store: %v", err)
	}

	// 1. GET must only render confirmation page and NEVER consume the token (mail scanner protection)
	getReq := httptest.NewRequest(http.MethodGet, "/api/public/stores/reactivate?token="+token, nil)
	getResp, err := app.Test(getReq, -1)
	if err != nil {
		t.Fatalf("GET reactivate failed: %v", err)
	}
	getBody, _ := io.ReadAll(getResp.Body)
	getResp.Body.Close()
	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 confirmation page, got %d (%s)", getResp.StatusCode, string(getBody))
	}
	if !strings.Contains(string(getBody), `method="POST"`) || !strings.Contains(string(getBody), token) {
		t.Fatalf("confirmation page missing POST form or token: %s", string(getBody))
	}

	var afterGet models.Store
	if err := db.First(&afterGet, store.ID).Error; err != nil {
		t.Fatalf("load store after GET: %v", err)
	}
	if afterGet.DormancyStatus != "suspended" || !afterGet.IsSuspended || afterGet.ReactivationToken != token {
		t.Fatalf("GET mutated store state unexpectedly: status=%s susp=%v token=%q",
			afterGet.DormancyStatus, afterGet.IsSuspended, afterGet.ReactivationToken)
	}

	// 2. POST consumes token, reactivates suspended dormancy store, clears IsSuspended & SuspensionReason
	form := url.Values{}
	form.Set("token", token)
	postReq := httptest.NewRequest(http.MethodPost, "/api/public/stores/reactivate", strings.NewReader(form.Encode()))
	postReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	postResp, err := app.Test(postReq, -1)
	if err != nil {
		t.Fatalf("POST reactivate failed: %v", err)
	}
	postResp.Body.Close()
	if postResp.StatusCode != http.StatusSeeOther {
		t.Fatalf("expected 303 SeeOther redirect, got %d", postResp.StatusCode)
	}
	if loc := postResp.Header.Get("Location"); loc != "/toko-dormant-stage3/admin?reactivated=true" {
		t.Fatalf("unexpected redirect location: %q", loc)
	}

	var afterPost models.Store
	if err := db.First(&afterPost, store.ID).Error; err != nil {
		t.Fatalf("load store after POST: %v", err)
	}
	if afterPost.DormancyStatus != "active" || afterPost.IsSuspended || afterPost.SuspensionReason != "none" || afterPost.ReactivationToken != "" {
		t.Fatalf("store was not fully reactivated: status=%s susp=%v reason=%q token=%q",
			afterPost.DormancyStatus, afterPost.IsSuspended, afterPost.SuspensionReason, afterPost.ReactivationToken)
	}
}

func TestDormancyHandler_ExtendActivity_AllowsDormantSuspended_BlocksModeration_RequiresContextMultiStore(t *testing.T) {
	db := openDormancyTestDB(t)
	h := NewDormancyHandler(db)

	owner := models.User{Name: "Multi Store Owner", Email: "multi-dorm@example.invalid", PlatformRole: "merchant"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}
	dormStore := models.Store{
		UserID:           owner.ID,
		Slug:             "toko-inaktif",
		StoreTitle:       "Toko Inaktif",
		Plan:             "free",
		DormancyStatus:   "suspended",
		IsSuspended:      true,
		SuspensionReason: "dormancy",
		LastActivityAt:   time.Now().UTC().AddDate(0, 0, -50),
	}
	modStore := models.Store{
		UserID:           owner.ID,
		Slug:             "toko-moderasi",
		StoreTitle:       "Toko Moderasi",
		Plan:             "free",
		DormancyStatus:   "suspended",
		IsSuspended:      true,
		SuspensionReason: "moderation_violation",
		LastActivityAt:   time.Now().UTC().AddDate(0, 0, -5),
	}
	db.Create(&dormStore)
	db.Create(&modStore)

	// Unrelated catalog_help ticket MUST remain open; inactivity ticket MAY auto-resolve.
	generalTicket := models.SupportTicket{
		TicketNumber: "TCK-GEN-1",
		Subject:      "Cara ubah banner katalog",
		UserID:       owner.ID,
		StoreID:      &dormStore.ID,
		Status:       "open",
		Category:     "catalog_help",
	}
	dormTicket := models.SupportTicket{
		TicketNumber: "TCK-DORM-1",
		Subject:      "Perpanjangan masa aktif inaktivitas",
		UserID:       owner.ID,
		StoreID:      &dormStore.ID,
		Status:       "open",
		Category:     "catalog_help",
	}
	db.Create(&generalTicket)
	db.Create(&dormTicket)

	app := fiber.New()
	app.Post("/api/stores/extend-activity", func(c *fiber.Ctx) error {
		c.Locals("user", &owner)
		slug := strings.ToLower(strings.TrimSpace(c.Get("X-Store-Slug")))
		if slug == dormStore.Slug {
			c.Locals("store", &dormStore)
		} else if slug == modStore.Slug {
			c.Locals("store", &modStore)
		}
		return h.HandleExtendStoreActivity(c)
	})

	// 1. Dormant-suspended store succeeds
	reqOK := httptest.NewRequest(http.MethodPost, "/api/stores/extend-activity", nil)
	reqOK.Header.Set("X-Store-Slug", dormStore.Slug)
	respOK, err := app.Test(reqOK, -1)
	if err != nil {
		t.Fatalf("extend dormant request failed: %v", err)
	}
	respOK.Body.Close()
	if respOK.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 extending dormant suspended store, got %d", respOK.StatusCode)
	}

	var reloadedDorm models.Store
	db.First(&reloadedDorm, dormStore.ID)
	if reloadedDorm.DormancyStatus != "active" || reloadedDorm.IsSuspended || reloadedDorm.SuspensionReason != "none" {
		t.Fatalf("dormant store not reactivated: %+v", reloadedDorm)
	}

	var refreshedGeneral, refreshedDorm models.SupportTicket
	db.First(&refreshedGeneral, generalTicket.ID)
	db.First(&refreshedDorm, dormTicket.ID)
	if refreshedGeneral.Status != "open" {
		t.Fatalf("unrelated catalog_help ticket should stay open, got %q", refreshedGeneral.Status)
	}
	if refreshedDorm.Status != "resolved" {
		t.Fatalf("inactivity ticket expected resolved, got %q", refreshedDorm.Status)
	}

	// 2. Moderation-suspended store MUST be rejected 403
	reqMod := httptest.NewRequest(http.MethodPost, "/api/stores/extend-activity", nil)
	reqMod.Header.Set("X-Store-Slug", modStore.Slug)
	respMod, err := app.Test(reqMod, -1)
	if err != nil {
		t.Fatalf("extend moderation request failed: %v", err)
	}
	respMod.Body.Close()
	if respMod.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 rejecting moderation_violation self-reactivation, got %d", respMod.StatusCode)
	}

	// 3. Multi-store without explicit store context MUST return 400 instead of silently picking First(&s)
	reqNoCtx := httptest.NewRequest(http.MethodPost, "/api/stores/extend-activity", nil)
	respNoCtx, err := app.Test(reqNoCtx, -1)
	if err != nil {
		t.Fatalf("extend no context request failed: %v", err)
	}
	respNoCtx.Body.Close()
	if respNoCtx.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 STORE_CONTEXT_REQUIRED for multi-store without slug, got %d", respNoCtx.StatusCode)
	}
}

func TestDormancyHandler_MetricsAndShowStoreReasonSeparation(t *testing.T) {
	db := openDormancyTestDB(t)
	h := NewDormancyHandler(db)
	sh := NewStoreHandler(db, &config.Config{}, nil)

	owner := models.User{Name: "Metrics Owner", Email: "metrics-dorm@example.invalid"}
	db.Create(&owner)
	db.Create(&models.Store{UserID: owner.ID, Slug: "s-active", StoreTitle: "S Active", Plan: "free", DormancyStatus: "active"})
	db.Create(&models.Store{UserID: owner.ID, Slug: "s-w1", StoreTitle: "S W1", Plan: "free", DormancyStatus: "warning_1"})
	db.Create(&models.Store{
		UserID:           owner.ID,
		Slug:             "s-dorm-susp",
		StoreTitle:       "S Dorm Susp",
		Plan:             "free",
		DormancyStatus:   "suspended",
		IsSuspended:      true,
		SuspensionReason: "none", // historical suspended dormancy without explicit reason
	})

	app := fiber.New()
	app.Get("/api/admin/dormancy/metrics", h.HandleGetDormancyMetrics)
	app.Get("/api/u/:slug", sh.ShowStore)

	mReq := httptest.NewRequest(http.MethodGet, "/api/admin/dormancy/metrics", nil)
	mResp, err := app.Test(mReq, -1)
	if err != nil {
		t.Fatalf("metrics request failed: %v", err)
	}
	defer mResp.Body.Close()
	var mPayload struct {
		Status string                 `json:"status"`
		Data   map[string]interface{} `json:"data"`
	}
	if err := json.NewDecoder(mResp.Body).Decode(&mPayload); err != nil {
		t.Fatalf("decode metrics: %v", err)
	}
	if mPayload.Data["active_free"] != float64(1) ||
		mPayload.Data["warning_1_free"] != float64(1) ||
		mPayload.Data["suspended_free"] != float64(1) ||
		mPayload.Data["active_stores"] != float64(2) ||
		mPayload.Data["dormant_stores"] != float64(2) ||
		mPayload.Data["total_stores"] != float64(3) {
		t.Fatalf("unexpected dormancy metrics payload: %+v", mPayload.Data)
	}

	sReq := httptest.NewRequest(http.MethodGet, "/api/u/s-dorm-susp", nil)
	sResp, err := app.Test(sReq, -1)
	if err != nil {
		t.Fatalf("ShowStore failed: %v", err)
	}
	defer sResp.Body.Close()
	var sPayload struct {
		IsSuspended bool                   `json:"is_suspended"`
		Data        map[string]interface{} `json:"data"`
	}
	if err := json.NewDecoder(sResp.Body).Decode(&sPayload); err != nil {
		t.Fatalf("decode ShowStore: %v", err)
	}
	if !sPayload.IsSuspended || sPayload.Data["suspension_reason"] != "dormancy" {
		t.Fatalf("expected suspension_reason='dormancy' when no catalog_suspended moderation report exists, got %+v", sPayload)
	}
}
