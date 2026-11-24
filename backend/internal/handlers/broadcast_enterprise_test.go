package handlers

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/middleware"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"
	"catavor-backend/internal/services"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupEnterpriseBroadcastTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("gagal membuka sqlite test db: %v", err)
	}
	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxOpenConns(1)
	}
	err = db.AutoMigrate(
		&models.User{},
		&models.Store{},
		&models.Notification{},
		&models.NotificationRead{},
		&models.NotificationRecipient{},
		&models.SubscriptionPlan{},
		&models.ActivityLog{},
	)
	if err != nil {
		t.Fatalf("gagal automigrate schema test: %v", err)
	}
	return db
}

func seedEnterprisePlans(t *testing.T, db *gorm.DB) {
	t.Helper()
	plans := []models.SubscriptionPlan{
		{Code: "free", Name: "Gratis", IsActive: true, SortOrder: 1},
		{Code: "pro_starter", Name: "Pro Starter", PriceMonthly: 49000, IsActive: true, SortOrder: 2},
		{Code: "pro_business", Name: "Pro Business", PriceMonthly: 149000, IsActive: true, SortOrder: 3},
	}
	for _, p := range plans {
		if err := db.Create(&p).Error; err != nil {
			t.Fatalf("gagal seed plan %s: %v", p.Code, err)
		}
	}
}

func newEnterpriseTestApp(db *gorm.DB, cfg *config.Config) *fiber.App {
	app := fiber.New()
	h := NewNotificationHandler(db, cfg)

	injectAuth := func(c *fiber.Ctx) error {
		uidRaw := strings.TrimSpace(c.Get("X-Test-User-ID"))
		if uidRaw != "" {
			var u models.User
			if err := db.Where("id = ?", uidRaw).First(&u).Error; err == nil {
				c.Locals("user", &u)
				c.Locals("user_id", u.ID)
			}
		}
		if slug := strings.TrimSpace(c.Get("X-Store-Slug")); slug != "" {
			var s models.Store
			if err := db.Where("LOWER(slug) = ?", strings.ToLower(slug)).First(&s).Error; err == nil {
				c.Locals("store", &s)
			}
		}
		return c.Next()
	}

	app.Use(injectAuth)
	app.Get("/api/notifications", h.GetNotifications)
	app.Get("/api/notifications/:id", h.GetNotificationByID)
	app.Post("/api/notifications/:id/read", h.MarkAsRead)
	app.Post("/api/notifications/:id/click", h.TrackClick)
	app.Post("/api/notifications/:id/dismiss", h.Dismiss)
	app.Get("/api/notifications/stream", h.Stream)

	app.Get("/api/admin/notifications", h.SuperadminIndex)
	app.Get("/api/admin/notifications/:id", h.SuperadminGetOne)
	app.Post("/api/admin/notifications", h.SuperadminBroadcast)
	app.Put("/api/admin/notifications/:id", h.SuperadminUpdate)
	app.Post("/api/admin/notifications/:id/publish", h.SuperadminPublish)
	app.Post("/api/admin/notifications/:id/revoke", h.SuperadminRevoke)
	app.Delete("/api/admin/notifications/:id", h.SuperadminDelete)

	return app
}

func execBroadcastJSON(t *testing.T, app *fiber.App, method, path string, headers map[string]string, body interface{}) (*http.Response, map[string]interface{}) {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("gagal encode body json: %v", err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("%s %s gagal: %v", method, path, err)
	}
	var parsed map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&parsed)
	_ = resp.Body.Close()
	return resp, parsed
}

func filterBroadcastItems(raw interface{}) []map[string]interface{} {
	arr, ok := raw.([]interface{})
	if !ok {
		return nil
	}
	out := make([]map[string]interface{}, 0, len(arr))
	for _, entry := range arr {
		m, ok := entry.(map[string]interface{})
		if !ok {
			continue
		}
		if isBcast, _ := m["is_broadcast"].(bool); isBcast {
			out = append(out, m)
		}
	}
	return out
}

func TestBroadcastEnterprise_SpecificAntiLikeCollision(t *testing.T) {
	db := setupEnterpriseBroadcastTestDB(t)
	app := newEnterpriseTestApp(db, &config.Config{AppEnv: "local"})

	now := time.Now().UTC().Add(-10 * time.Minute)
	admin := models.User{ID: 900, Name: "Admin Content", Email: "content@catavor.test", PlatformRole: "content", CreatedAt: now}
	user1 := models.User{ID: 1, Name: "Merchant Satu", Email: "u1@catavor.test", PlatformRole: "merchant", CreatedAt: now}
	user10 := models.User{ID: 10, Name: "Merchant Sepuluh", Email: "u10@catavor.test", PlatformRole: "merchant", CreatedAt: now}
	for _, u := range []models.User{admin, user1, user10} {
		if err := db.Create(&u).Error; err != nil {
			t.Fatalf("create user %d: %v", u.ID, err)
		}
	}
	store1 := models.Store{ID: 1, UserID: user1.ID, Slug: "toko-1", StoreTitle: "Toko Satu", Plan: "free", CreatedAt: now}
	store10 := models.Store{ID: 10, UserID: user10.ID, Slug: "toko-10", StoreTitle: "Toko Sepuluh", Plan: "free", CreatedAt: now}
	for _, s := range []models.Store{store1, store10} {
		if err := db.Create(&s).Error; err != nil {
			t.Fatalf("create store %d: %v", s.ID, err)
		}
	}

	adminHdr := map[string]string{"X-Test-User-ID": "900"}

	// Broadcast A: khusus Store #10 saja
	respA, bodyA := execBroadcastJSON(t, app, "POST", "/api/admin/notifications", adminHdr, map[string]interface{}{
		"target_type": "specific",
		"recipients": []map[string]interface{}{
			{"type": "store", "id": 10, "name": "Toko Sepuluh", "slug": "toko-10"},
		},
		"status":   "published",
		"title":    "Khusus Toko 10",
		"category": "PENGUMUMAN",
		"message":  "Hanya untuk toko ID 10.",
	})
	if respA.StatusCode != http.StatusCreated {
		t.Fatalf("broadcast store 10 status=%d body=%v", respA.StatusCode, bodyA)
	}
	notifStore10 := bodyA["data"].(map[string]interface{})["id"].(string)

	// Broadcast B: khusus User #1 saja
	respB, bodyB := execBroadcastJSON(t, app, "POST", "/api/admin/notifications", adminHdr, map[string]interface{}{
		"target_type": "specific",
		"recipients": []map[string]interface{}{
			{"type": "user", "id": 1, "name": "Merchant Satu", "email": "u1@catavor.test"},
		},
		"status":   "published",
		"title":    "Khusus User 1",
		"category": "PENGUMUMAN",
		"message":  "Hanya untuk user ID 1.",
	})
	if respB.StatusCode != http.StatusCreated {
		t.Fatalf("broadcast user 1 status=%d body=%v", respB.StatusCode, bodyB)
	}
	notifUser1 := bodyB["data"].(map[string]interface{})["id"].(string)

	// Store 1 TIDAK boleh melihat Broadcast A (store 10), hanya Broadcast B (user 1)
	r1, list1 := execBroadcastJSON(t, app, "GET", "/api/notifications?slug=toko-1", map[string]string{"X-Test-User-ID": "1"}, nil)
	if r1.StatusCode != http.StatusOK {
		t.Fatalf("get notif store 1 status=%d", r1.StatusCode)
	}
	items1 := filterBroadcastItems(list1["data"])
	if len(items1) != 1 || items1[0]["id"] != notifUser1 {
		t.Fatalf("isolasi LIKE gagal untuk store 1: dapat %d item: %v", len(items1), items1)
	}

	// Store 10 hanya boleh melihat Broadcast A, dan akses langsung GET/:id ke Broadcast B harus 404
	r10, list10 := execBroadcastJSON(t, app, "GET", "/api/notifications?slug=toko-10", map[string]string{"X-Test-User-ID": "10"}, nil)
	if r10.StatusCode != http.StatusOK {
		t.Fatalf("get notif store 10 status=%d", r10.StatusCode)
	}
	items10 := filterBroadcastItems(list10["data"])
	if len(items10) != 1 || items10[0]["id"] != notifStore10 {
		t.Fatalf("isolasi LIKE gagal untuk store 10: dapat %d item: %v", len(items10), items10)
	}

	// User 10 tanpa ?slug= juga tidak boleh bocor ke user:1 dan tetap melihat store:10 miliknya
	r10NoSlug, list10NoSlug := execBroadcastJSON(t, app, "GET", "/api/notifications", map[string]string{"X-Test-User-ID": "10"}, nil)
	if r10NoSlug.StatusCode != http.StatusOK {
		t.Fatalf("get notif user 10 without slug status=%d", r10NoSlug.StatusCode)
	}
	items10NS := filterBroadcastItems(list10NoSlug["data"])
	if len(items10NS) != 1 || items10NS[0]["id"] != notifStore10 {
		t.Fatalf("isolasi user 10 tanpa slug gagal: %v", items10NS)
	}

	// Cross-tenant GET by ID ditolak 404
	rCross, _ := execBroadcastJSON(t, app, "GET", "/api/notifications/"+notifStore10+"?slug=toko-1", map[string]string{"X-Test-User-ID": "1"}, nil)
	if rCross.StatusCode != http.StatusNotFound {
		t.Fatalf("cross-tenant GET by ID status=%d, want 404", rCross.StatusCode)
	}
}

func TestBroadcastEnterprise_SubscriptionPlanMatchingAndLiveHubUpdate(t *testing.T) {
	db := setupEnterpriseBroadcastTestDB(t)
	seedEnterprisePlans(t, db)
	app := newEnterpriseTestApp(db, &config.Config{AppEnv: "local"})

	now := time.Now().UTC().Add(-10 * time.Minute)
	admin := models.User{ID: 1, Name: "Super", Email: "super@catavor.test", PlatformRole: "superadmin", CreatedAt: now}
	uFree := models.User{ID: 2, Name: "Free", Email: "free@catavor.test", PlatformRole: "merchant", CreatedAt: now}
	uStarter := models.User{ID: 3, Name: "Starter", Email: "starter@catavor.test", PlatformRole: "merchant", CreatedAt: now}
	uBiz := models.User{ID: 4, Name: "Biz", Email: "biz@catavor.test", PlatformRole: "merchant", CreatedAt: now}
	for _, u := range []models.User{admin, uFree, uStarter, uBiz} {
		_ = db.Create(&u).Error
	}
	sFree := models.Store{ID: 2, UserID: uFree.ID, Slug: "s-free", StoreTitle: "S Free", Plan: "free", CreatedAt: now}
	sStarter := models.Store{ID: 3, UserID: uStarter.ID, Slug: "s-starter", StoreTitle: "S Starter", Plan: "pro_starter", CreatedAt: now}
	sBiz := models.Store{ID: 4, UserID: uBiz.ID, Slug: "s-biz", StoreTitle: "S Biz", Plan: "pro_business", CreatedAt: now}
	for _, s := range []models.Store{sFree, sStarter, sBiz} {
		_ = db.Create(&s).Error
	}

	adminHdr := map[string]string{"X-Test-User-ID": "1"}

	// Broadcast ke pro_starter + alias legacy 'pro'
	rStarter, bStarter := execBroadcastJSON(t, app, "POST", "/api/admin/notifications", adminHdr, map[string]interface{}{
		"target_type":      "plan",
		"target_plan_code": "pro_starter",
		"status":           "published",
		"title":            "Fitur Pro Starter",
		"category":         "PROMOSI",
		"message":          "Hanya untuk paket pro_starter.",
	})
	if rStarter.StatusCode != http.StatusCreated {
		t.Fatalf("broadcast pro_starter gagal status=%d body=%v", rStarter.StatusCode, bStarter)
	}

	rLegacyPro, bLegacy := execBroadcastJSON(t, app, "POST", "/api/admin/notifications", adminHdr, map[string]interface{}{
		"target_type":      "plan",
		"target_plan_code": "pro",
		"status":           "published",
		"title":            "Promo Semua Tier Pro",
		"category":         "PROMOSI",
		"message":          "Berlaku untuk pro_starter & pro_business.",
	})
	if rLegacyPro.StatusCode != http.StatusCreated {
		t.Fatalf("broadcast legacy pro gagal status=%d body=%v", rLegacyPro.StatusCode, bLegacy)
	}

	// Verifikasi Free tidak menerima apapun
	_, lFree := execBroadcastJSON(t, app, "GET", "/api/notifications?slug=s-free", map[string]string{"X-Test-User-ID": "2"}, nil)
	if got := len(filterBroadcastItems(lFree["data"])); got != 0 {
		t.Fatalf("toko free seharusnya mendapat 0 notifikasi plan, dapat %d", got)
	}
	// Pro Starter menerima kedua siaran (pro_starter + pro)
	_, lStarter := execBroadcastJSON(t, app, "GET", "/api/notifications?slug=s-starter", map[string]string{"X-Test-User-ID": "3"}, nil)
	if got := len(filterBroadcastItems(lStarter["data"])); got != 2 {
		t.Fatalf("toko pro_starter seharusnya mendapat 2 notifikasi plan, dapat %d", got)
	}
	// Pro Business menerima 'pro' alias saja, bukan 'pro_starter'
	_, lBiz := execBroadcastJSON(t, app, "GET", "/api/notifications?slug=s-biz", map[string]string{"X-Test-User-ID": "4"}, nil)
	itemsBiz := filterBroadcastItems(lBiz["data"])
	if len(itemsBiz) != 1 || itemsBiz[0]["title"] != "Promo Semua Tier Pro" {
		t.Fatalf("toko pro_business mendapat hasil salah: %v", itemsBiz)
	}

	// Uji live NotificationHub.UpdateStorePlan
	hub := services.GetNotificationHub()
	client := hub.Register(uFree.ID, sFree.ID, "free", "merchant")
	defer hub.Unregister(client)

	testNotif := &models.Notification{
		ID:             "notif_live_plan_1",
		TargetType:     "plan",
		TargetPlanCode: "pro_starter",
		Status:         "published",
		Title:          "Live Upgrade Notice",
		Message:        "Selamat datang di Pro Starter",
	}
	hub.Broadcast(testNotif)
	select {
	case msg := <-client.Send:
		t.Fatalf("klien free seharusnya tidak menerima broadcast pro_starter, malah dapat: %s", string(msg))
	case <-time.After(40 * time.Millisecond):
	}

	updatedCount := hub.UpdateStorePlan(sFree.ID, "pro_starter")
	if updatedCount < 1 {
		t.Fatalf("UpdateStorePlan mengembalikan 0 klien terupdate")
	}
	hub.Broadcast(testNotif)
	select {
	case msg := <-client.Send:
		if !strings.Contains(string(msg), "notif_live_plan_1") {
			t.Fatalf("payload SSE tidak sesuai: %s", string(msg))
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("klien setelah UpdateStorePlan tidak menerima siaran SSE")
	}
}

func TestBroadcastEnterprise_UserTargetedNullableStoreAndValidation(t *testing.T) {
	db := setupEnterpriseBroadcastTestDB(t)
	seedEnterprisePlans(t, db)
	app := newEnterpriseTestApp(db, &config.Config{AppEnv: "local"})

	now := time.Now().UTC().Add(-10 * time.Minute)
	admin := models.User{ID: 1, Name: "Super", Email: "s@catavor.test", PlatformRole: "superadmin", CreatedAt: now}
	uNoStore := models.User{ID: 99, Name: "User Tanpa Toko", Email: "u99@catavor.test", PlatformRole: "merchant", CreatedAt: now}
	uOther := models.User{ID: 100, Name: "User Lain", Email: "u100@catavor.test", PlatformRole: "merchant", CreatedAt: now}
	for _, u := range []models.User{admin, uNoStore, uOther} {
		_ = db.Create(&u).Error
	}

	adminHdr := map[string]string{"X-Test-User-ID": "1"}

	// Validasi ketat
	invalidCases := []struct {
		name string
		body map[string]interface{}
	}{
		{"invalid target_type", map[string]interface{}{"target_type": "bogus", "title": "A", "message": "B"}},
		{"invalid plan", map[string]interface{}{"target_type": "plan", "target_plan_code": "platinum_x", "title": "A", "message": "B"}},
		{"empty specific recipients", map[string]interface{}{"target_type": "specific", "recipients": []interface{}{}, "title": "A", "message": "B"}},
		{"javascript action_url", map[string]interface{}{"target_type": "all", "title": "A", "message": "B", "action_type": "external_link", "action_url": "javascript:alert(1)"}},
		{"past schedule", map[string]interface{}{"target_type": "all", "status": "scheduled", "scheduled_at": time.Now().UTC().Add(-10 * time.Minute).Format(time.RFC3339), "title": "A", "message": "B"}},
	}
	for _, tc := range invalidCases {
		resp, _ := execBroadcastJSON(t, app, "POST", "/api/admin/notifications", adminHdr, tc.body)
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("kasus validasi '%s' status=%d, want 400", tc.name, resp.StatusCode)
		}
	}

	// Idempotency-Key deduplication
	idemHdr := map[string]string{"X-Test-User-ID": "1", "Idempotency-Key": "idem-broadcast-001"}
	payloadSU := map[string]interface{}{
		"target_type": "single_user",
		"target_id":   99,
		"target_name": "User Tanpa Toko",
		"status":      "published",
		"title":       "Khusus User Tanpa Toko",
		"category":    "SISTEM",
		"message":     "Siaran untuk single_user.",
		"action_type": "navigate",
		"action_label": "Lanjut",
		"link_sub_tab": "settings",
	}
	r1, b1 := execBroadcastJSON(t, app, "POST", "/api/admin/notifications", idemHdr, payloadSU)
	r2, b2 := execBroadcastJSON(t, app, "POST", "/api/admin/notifications", idemHdr, payloadSU)
	if r1.StatusCode != http.StatusCreated || r2.StatusCode != http.StatusOK {
		t.Fatalf("idempotency status salah: r1=%d r2=%d", r1.StatusCode, r2.StatusCode)
	}
	nid1 := b1["data"].(map[string]interface{})["id"].(string)
	nid2 := b2["data"].(map[string]interface{})["id"].(string)
	if nid1 != nid2 {
		t.Fatalf("Idempotency-Key gagal mendeduplikasi: id1=%s id2=%s", nid1, nid2)
	}

	// User 99 (storeID=0) bisa melihat, read, click, lalu dismiss dengan StoreID=nil
	u99Hdr := map[string]string{"X-Test-User-ID": "99"}
	rGet, _ := execBroadcastJSON(t, app, "GET", "/api/notifications/"+nid1, u99Hdr, nil)
	if rGet.StatusCode != http.StatusOK {
		t.Fatalf("GET single_user status=%d, want 200", rGet.StatusCode)
	}
	rOther, _ := execBroadcastJSON(t, app, "GET", "/api/notifications/"+nid1, map[string]string{"X-Test-User-ID": "100"}, nil)
	if rOther.StatusCode != http.StatusNotFound {
		t.Fatalf("user lain mengakses single_user status=%d, want 404", rOther.StatusCode)
	}
	rRead, _ := execBroadcastJSON(t, app, "POST", "/api/notifications/"+nid1+"/read", u99Hdr, nil)
	rReadDup, _ := execBroadcastJSON(t, app, "POST", "/api/notifications/"+nid1+"/read", u99Hdr, nil)
	rClick, _ := execBroadcastJSON(t, app, "POST", "/api/notifications/"+nid1+"/click", u99Hdr, nil)
	if rRead.StatusCode != http.StatusOK || rReadDup.StatusCode != http.StatusOK || rClick.StatusCode != http.StatusOK {
		t.Fatalf("read/click gagal: read=%d dup=%d click=%d", rRead.StatusCode, rReadDup.StatusCode, rClick.StatusCode)
	}

	var reads []models.NotificationRead
	if err := db.Where("notification_id = ?", nid1).Find(&reads).Error; err != nil {
		t.Fatalf("query reads gagal: %v", err)
	}
	if len(reads) != 1 || reads[0].StoreID != nil || reads[0].ClickedAt == nil {
		t.Fatalf("ekspektasi tepat 1 NotificationRead dengan StoreID==nil & ClickedAt terisi, dapat: %+v", reads)
	}

	rDismiss, _ := execBroadcastJSON(t, app, "POST", "/api/notifications/"+nid1+"/dismiss", u99Hdr, nil)
	if rDismiss.StatusCode != http.StatusOK {
		t.Fatalf("dismiss gagal: %d", rDismiss.StatusCode)
	}
	_, lAfterDismiss := execBroadcastJSON(t, app, "GET", "/api/notifications", u99Hdr, nil)
	if len(lAfterDismiss["data"].([]interface{})) != 0 {
		t.Fatalf("notifikasi yang sudah di-dismiss masih muncul di feed user")
	}
}

func TestBroadcastEnterprise_FullLifecycleScheduledClickRevokeDeleteAndAudit(t *testing.T) {
	db := setupEnterpriseBroadcastTestDB(t)
	seedEnterprisePlans(t, db)
	app := newEnterpriseTestApp(db, &config.Config{AppEnv: "local"})

	now := time.Now().UTC().Add(-10 * time.Minute)
	staffContent := models.User{ID: 7, Name: "Staf Konten", Email: "konten@catavor.test", PlatformRole: "content", CreatedAt: now}
	uMerch := models.User{ID: 8, Name: "Merchant Delapan", Email: "m8@catavor.test", PlatformRole: "merchant", CreatedAt: now}
	_ = db.Create(&staffContent).Error
	_ = db.Create(&uMerch).Error
	_ = db.Create(&models.Store{ID: 8, UserID: uMerch.ID, Slug: "toko-8", StoreTitle: "Toko 8", Plan: "pro_starter", CreatedAt: now}).Error

	staffHdr := map[string]string{"X-Test-User-ID": "7"}
	merchHdr := map[string]string{"X-Test-User-ID": "8"}

	// 1. Buat draft oleh staf content -> tidak tampil ke merchant
	rDraft, bDraft := execBroadcastJSON(t, app, "POST", "/api/admin/notifications", staffHdr, map[string]interface{}{
		"target_type": "all",
		"status":      "draft",
		"title":       "Draf Rilis Fitur",
		"category":    "PANDUAN",
		"message":     "Masih draf internal.",
	})
	if rDraft.StatusCode != http.StatusCreated {
		t.Fatalf("create draft status=%d body=%v", rDraft.StatusCode, bDraft)
	}
	draftID := bDraft["data"].(map[string]interface{})["id"].(string)

	// Verifikasi ActorRole log = 'content' bukan hardcoded 'superadmin'
	var actLog models.ActivityLog
	if err := db.Where("action = ?", "admin.broadcast_notification").Order("id DESC").First(&actLog).Error; err != nil {
		t.Fatalf("activity log tidak tercatat: %v", err)
	}
	if actLog.ActorRole != "content" {
		t.Fatalf("ActorRole = %q, want 'content'", actLog.ActorRole)
	}

	_, listBefore := execBroadcastJSON(t, app, "GET", "/api/notifications?slug=toko-8", merchHdr, nil)
	if len(filterBroadcastItems(listBefore["data"])) != 0 {
		t.Fatalf("draft tidak boleh muncul di merchant feed")
	}

	// 2. Edit ke scheduled
	futureSched := time.Now().UTC().Add(30 * time.Minute).Format(time.RFC3339)
	rUpd, _ := execBroadcastJSON(t, app, "PUT", "/api/admin/notifications/"+draftID, staffHdr, map[string]interface{}{
		"target_type":  "all",
		"status":       "scheduled",
		"scheduled_at": futureSched,
		"title":        "Rilis Fitur v2",
		"category":     "PANDUAN",
		"message":      "Sudah terjadwal resmi.",
		"action_type":  "detail",
		"detail_content": "Artikel panduan lengkap.",
	})
	if rUpd.StatusCode != http.StatusOK {
		t.Fatalf("update to scheduled gagal status=%d", rUpd.StatusCode)
	}

	// Simulasikan waktu jadwal sudah jatuh tempo
	past := time.Now().UTC().Add(-1 * time.Minute)
	if err := db.Model(&models.Notification{}).Where("id = ?", draftID).Update("scheduled_at", &past).Error; err != nil {
		t.Fatalf("set past scheduled_at: %v", err)
	}
	pubCount, err := services.PublishDueScheduledBroadcasts(db)
	if err != nil || pubCount != 1 {
		t.Fatalf("PublishDueScheduledBroadcasts count=%d err=%v, want 1", pubCount, err)
	}

	// 3. Buat 2 broadcast manual dengan judul sama -> pastikan tidak ter-deduplikasi keliru
	for i := 0; i < 2; i++ {
		rDup, _ := execBroadcastJSON(t, app, "POST", "/api/admin/notifications", staffHdr, map[string]interface{}{
			"target_type": "all",
			"status":      "published",
			"title":       "Pengumuman Rutin Mingguan",
			"category":    "PENGUMUMAN",
			"message":     fmt.Sprintf("Edisi ke-%d", i+1),
		})
		if rDup.StatusCode != http.StatusCreated {
			t.Fatalf("broadcast judul sama ke-%d gagal: %d", i+1, rDup.StatusCode)
		}
	}
	var dupTitleCount int64
	db.Model(&models.Notification{}).Where("title = ?", "Pengumuman Rutin Mingguan").Count(&dupTitleCount)
	if dupTitleCount != 2 {
		t.Fatalf("ekspektasi 2 baris untuk judul kembar manual, dapat %d", dupTitleCount)
	}

	// 4. Merchant baca + klik CTA -> verifikasi ReadCount=1, ClickCount=1, CTR=100
	rClick, _ := execBroadcastJSON(t, app, "POST", "/api/notifications/"+draftID+"/click?slug=toko-8", merchHdr, nil)
	if rClick.StatusCode != http.StatusOK {
		t.Fatalf("TrackClick gagal: %d", rClick.StatusCode)
	}
	rAdminOne, bAdminOne := execBroadcastJSON(t, app, "GET", "/api/admin/notifications/"+draftID, staffHdr, nil)
	if rAdminOne.StatusCode != http.StatusOK {
		t.Fatalf("SuperadminGetOne gagal: %d", rAdminOne.StatusCode)
	}
	oneData := bAdminOne["data"].(map[string]interface{})
	if oneData["read_count"].(float64) != 1 || oneData["click_count"].(float64) != 1 || oneData["ctr_pct"].(float64) != 100 {
		t.Fatalf("metrik read/click/CTR salah: %+v", oneData)
	}

	// 5. Revoke mengirim SSE notification_deleted & menyembunyikan dari merchant namun tetap mempertahankan analitik
	hub := services.GetNotificationHub()
	client := hub.Register(uMerch.ID, 8, "pro_starter", "merchant")
	defer hub.Unregister(client)

	rRev, _ := execBroadcastJSON(t, app, "POST", "/api/admin/notifications/"+draftID+"/revoke", staffHdr, nil)
	if rRev.StatusCode != http.StatusOK {
		t.Fatalf("SuperadminRevoke gagal: %d", rRev.StatusCode)
	}
	select {
	case ev := <-client.Send:
		if !strings.Contains(string(ev), `"event":"notification_deleted"`) || !strings.Contains(string(ev), draftID) {
			t.Fatalf("event pencabutan SSE tidak cocok: %s", string(ev))
		}
	case <-time.After(250 * time.Millisecond):
		t.Fatalf("klien SSE tidak menerima notification_deleted saat revoke")
	}

	rMerchAfterRev, _ := execBroadcastJSON(t, app, "GET", "/api/notifications/"+draftID+"?slug=toko-8", merchHdr, nil)
	if rMerchAfterRev.StatusCode != http.StatusNotFound {
		t.Fatalf("notifikasi tercabut masih bisa diakses merchant status=%d, want 404", rMerchAfterRev.StatusCode)
	}
	_, bAfterRev := execBroadcastJSON(t, app, "GET", "/api/admin/notifications/"+draftID, staffHdr, nil)
	afterRevData := bAfterRev["data"].(map[string]interface{})
	if afterRevData["status"] != "revoked" || afterRevData["click_count"].(float64) != 1 {
		t.Fatalf("jejak analitik hilang setelah revoke: %+v", afterRevData)
	}

	// 6. Delete membersihkan baris database
	rDel, _ := execBroadcastJSON(t, app, "DELETE", "/api/admin/notifications/"+draftID, staffHdr, nil)
	if rDel.StatusCode != http.StatusOK {
		t.Fatalf("SuperadminDelete gagal: %d", rDel.StatusCode)
	}
	var cnt int64
	db.Model(&models.Notification{}).Where("id = ?", draftID).Count(&cnt)
	if cnt != 0 {
		t.Fatalf("notifikasi seharusnya sudah terhapus, count=%d", cnt)
	}
}

func TestBroadcastEnterprise_SSECorsOriginAndRateLimiter(t *testing.T) {
	cfg := &config.Config{
		AppEnv:         "production",
		AppURL:         "https://catavor.com",
		AllowedOrigins: []string{"https://admin.catavor.com"},
	}
	if !middleware.IsOriginAllowed("https://catavor.com", cfg) || !middleware.IsOriginAllowed("https://admin.catavor.com", cfg) {
		t.Fatalf("origin sah seharusnya diizinkan")
	}
	if middleware.IsOriginAllowed("https://evil.attacker.example", cfg) {
		t.Fatalf("origin asing HARUS ditolak")
	}

	// Uji CORS aktual pada live HTTP Stream handler
	db := setupEnterpriseBroadcastTestDB(t)
	u := models.User{ID: 55, Name: "SSE Merchant", Email: "sse@catavor.test", PlatformRole: "merchant", CreatedAt: time.Now().UTC()}
	_ = db.Create(&u).Error

	app := fiber.New()
	h := NewNotificationHandler(db, cfg)
	app.Get("/api/notifications/stream", func(c *fiber.Ctx) error {
		c.Locals("user", &u)
		return h.Stream(c)
	})
	// Pasang rate limiter uji
	app.Post("/api/admin/notifications/rate-test", func(c *fiber.Ctx) error {
		c.Locals("user", &u)
		return c.Next()
	}, middleware.BroadcastRateLimiter(), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	// Uji Rate Limiter (20 ok, ke-21 -> 429)
	for i := 1; i <= 21; i++ {
		req := httptest.NewRequest("POST", "/api/admin/notifications/rate-test", nil)
		resp, err := app.Test(req, -1)
		if err != nil {
			t.Fatalf("rate test req %d err: %v", i, err)
		}
		_ = resp.Body.Close()
		if i <= 20 && resp.StatusCode != http.StatusOK {
			t.Fatalf("req %d status=%d, want 200", i, resp.StatusCode)
		}
		if i == 21 && resp.StatusCode != http.StatusTooManyRequests {
			t.Fatalf("req 21 status=%d, want 429", resp.StatusCode)
		}
	}

	// Uji live TCP listener SSE header CORS
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen tcp: %v", err)
	}
	defer func() {
		_ = app.Shutdown()
		_ = ln.Close()
	}()
	go func() {
		_ = app.Listener(ln)
	}()
	time.Sleep(30 * time.Millisecond)

	baseURL := fmt.Sprintf("http://%s/api/notifications/stream", ln.Addr().String())

	// Origin asing TIDAK boleh mendapat ACAO
	reqBad, _ := http.NewRequest("GET", baseURL, nil)
	reqBad.Header.Set("Origin", "https://evil.attacker.example")
	respBad, err := http.DefaultClient.Do(reqBad)
	if err != nil {
		t.Fatalf("GET sse evil origin err: %v", err)
	}
	if acao := respBad.Header.Get("Access-Control-Allow-Origin"); acao != "" {
		_ = respBad.Body.Close()
		t.Fatalf("origin asing malah mendapat Access-Control-Allow-Origin=%q", acao)
	}
	_ = respBad.Body.Close()

	// Origin sah mendapat ACAO exact origin + ACAC true + event connected
	reqGood, _ := http.NewRequest("GET", baseURL, nil)
	reqGood.Header.Set("Origin", "https://catavor.com")
	respGood, err := http.DefaultClient.Do(reqGood)
	if err != nil {
		t.Fatalf("GET sse valid origin err: %v", err)
	}
	defer func() { _ = respGood.Body.Close() }()
	if got := respGood.Header.Get("Access-Control-Allow-Origin"); got != "https://catavor.com" {
		t.Fatalf("ACAO=%q, want 'https://catavor.com'", got)
	}
	if got := respGood.Header.Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Fatalf("ACAC=%q, want 'true'", got)
	}
	scanner := bufio.NewScanner(respGood.Body)
	if !scanner.Scan() || !strings.Contains(scanner.Text(), "event: connected") {
		t.Fatalf("tidak menerima frame connected SSE")
	}

	// Pastikan unused variable security package tidak terjadi; uji token helper jika dipakai
	_ = security.SSETicketStore(nil)
}

func TestBroadcastEnterprise_PostgreSQLMigrationAndConstraints(t *testing.T) {
	// Gunakan godotenv.Read agar tidak memutasi process env test lain di package handlers
	var envMap map[string]string
	for _, candidate := range []string{".env", "../.env", "../../.env"} {
		if m, err := godotenv.Read(candidate); err == nil && len(m) > 0 {
			envMap = m
			break
		}
	}
	getVal := func(k, fallback string) string {
		if v := strings.TrimSpace(os.Getenv(k)); v != "" {
			return v
		}
		if v := strings.TrimSpace(envMap[k]); v != "" {
			return v
		}
		return fallback
	}
	dbHost := getVal("DB_HOST", "")
	dbName := getVal("DB_NAME", "")
	if dbName == "" || dbHost == "" {
		t.Skip("konfigurasi PostgreSQL tidak disetel")
	}
	pgCfg := &config.Config{
		DBHost:     dbHost,
		DBPort:     getVal("DB_PORT", "5432"),
		DBUser:     getVal("DB_USER", "postgres"),
		DBPassword: getVal("DB_PASSWORD", ""),
		DBName:     dbName,
		DBSSLMode:  getVal("DB_SSLMODE", "disable"),
	}

	pgDB, err := gorm.Open(postgres.Open(pgCfg.GetPostgresDSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Skipf("PostgreSQL live tidak dapat dijangkau: %v", err)
	}
	sqlDB, err := pgDB.DB()
	if err == nil {
		defer func() { _ = sqlDB.Close() }()
	}

	// Pastikan migrasi n64 sudah terpasang
	var curDB, curSchema string
	_ = pgDB.Raw("SELECT current_database(), current_schema()").Row().Scan(&curDB, &curSchema)
	var isNullable string
	row := pgDB.Raw(`
		SELECT is_nullable FROM information_schema.columns
		WHERE table_schema = current_schema()
		  AND table_name = 'notification_reads'
		  AND column_name = 'store_id'
		UNION ALL
		SELECT CASE WHEN attnotnull THEN 'NO' ELSE 'YES' END
		FROM pg_attribute
		WHERE attrelid = 'notification_reads'::regclass
		  AND attname = 'store_id'
		  AND NOT attisdropped
		LIMIT 1
	`).Row()
	if err := row.Scan(&isNullable); err != nil || strings.ToUpper(isNullable) != "YES" {
		t.Fatalf("notification_reads.store_id belum nullable (db=%q schema=%q is_nullable=%q err=%v) — jalankan admin-cli -migrate untuk n64!", curDB, curSchema, isNullable, err)
	}

	var idxCount int64
	pgDB.Raw(`
		SELECT COUNT(*) FROM pg_indexes
		WHERE tablename = 'notification_reads'
		  AND indexname IN ('uq_notification_reads_notif_store', 'uq_notification_reads_notif_user_nostore')
	`).Scan(&idxCount)
	if idxCount != 2 {
		t.Fatalf("partial unique indexes pada notification_reads belum lengkap (count=%d, want 2)", idxCount)
	}

	// Data uji terisolasi yang dibersihkan penuh lewat t.Cleanup
	suffix := fmt.Sprintf("%d", time.Now().UnixNano())
	testEmail := fmt.Sprintf("pgtest_broadcast_%s@catavor.local", suffix)
	testSlug := fmt.Sprintf("pgtest-bcast-%s", suffix)
	testNotifID := "notif_pgtest_" + suffix

	var testUserID uint
	var testStoreID uint

	t.Cleanup(func() {
		pgDB.Exec("DELETE FROM notification_reads WHERE notification_id = ?", testNotifID)
		pgDB.Exec("DELETE FROM notification_recipients WHERE notification_id = ?", testNotifID)
		pgDB.Exec("DELETE FROM notifications WHERE id = ?", testNotifID)
		if testStoreID > 0 {
			pgDB.Exec("DELETE FROM stores WHERE id = ?", testStoreID)
		}
		if testUserID > 0 {
			pgDB.Exec("DELETE FROM users WHERE id = ?", testUserID)
		}
	})

	testUser := models.User{
		Name:         "PG Test User",
		Email:        testEmail,
		Password:     "not-for-login-hash",
		PlatformRole: "merchant",
	}
	if err := pgDB.Create(&testUser).Error; err != nil {
		t.Fatalf("insert test user ke PG gagal: %v", err)
	}
	testUserID = testUser.ID

	testStore := models.Store{
		UserID:     testUserID,
		Slug:       testSlug,
		StoreTitle: "PG Test Store",
		Plan:       "free",
	}
	if err := pgDB.Create(&testStore).Error; err != nil {
		t.Fatalf("insert test store ke PG gagal: %v", err)
	}
	testStoreID = testStore.ID

	testNotif := models.Notification{
		ID:               testNotifID,
		TargetType:       "specific",
		TargetRecipients: "[]",
		Status:           "published",
		Title:            "PG Integration Constraint Test",
		Category:         "SISTEM",
		Message:          "Verifikasi FK nullable dan cascade delete PostgreSQL.",
		Type:             "info",
		ActionType:       "none",
	}
	if err := pgDB.Create(&testNotif).Error; err != nil {
		t.Fatalf("insert test notif ke PG gagal: %v", err)
	}

	recip := models.NotificationRecipient{
		NotificationID: testNotifID,
		RecipientType:  "store",
		RecipientID:    testStoreID,
		RecipientName:  "PG Test Store",
		RecipientSlug:  testSlug,
		CreatedAt:      time.Now().UTC(),
	}
	if err := pgDB.Create(&recip).Error; err != nil {
		t.Fatalf("insert notification_recipients ke PG gagal: %v", err)
	}

	// 1. Insert notification_reads dengan store_id = NULL -> HARUS sukses
	readNullStore := models.NotificationRead{
		NotificationID: testNotifID,
		StoreID:        nil,
		UserID:         testUserID,
		ReadAt:         time.Now().UTC(),
	}
	if err := pgDB.Create(&readNullStore).Error; err != nil {
		t.Fatalf("insert notification_reads dengan store_id NULL gagal di PG: %v", err)
	}

	// 2. Duplikat (notification_id, user_id) saat store_id IS NULL -> HARUS ditolak unique index
	dupNullStore := models.NotificationRead{
		NotificationID: testNotifID,
		StoreID:        nil,
		UserID:         testUserID,
		ReadAt:         time.Now().UTC(),
	}
	if err := pgDB.Create(&dupNullStore).Error; err == nil {
		t.Fatalf("duplikat notification_reads dengan store_id IS NULL seharusnya ditolak uq_notification_reads_notif_user_nostore")
	}

	// 3. Insert dengan store_id = testStoreID lalu duplikat -> ke-1 sukses, ke-2 ditolak
	sid := testStoreID
	readWithStore := models.NotificationRead{
		NotificationID: testNotifID,
		StoreID:        &sid,
		UserID:         testUserID,
		ReadAt:         time.Now().UTC(),
	}
	if err := pgDB.Create(&readWithStore).Error; err != nil {
		t.Fatalf("insert notification_reads dengan store_id valid gagal di PG: %v", err)
	}
	dupWithStore := models.NotificationRead{
		NotificationID: testNotifID,
		StoreID:        &sid,
		UserID:         testUserID,
		ReadAt:         time.Now().UTC(),
	}
	if err := pgDB.Create(&dupWithStore).Error; err == nil {
		t.Fatalf("duplikat notification_reads dengan store_id sama seharusnya ditolak uq_notification_reads_notif_store")
	}

	// 4. DELETE notification men-cascade delete notification_recipients & notification_reads
	pgDB.Exec("DELETE FROM notifications WHERE id = ?", testNotifID)
	var recipAfter int64
	pgDB.Raw("SELECT COUNT(*) FROM notification_recipients WHERE notification_id = ?", testNotifID).Scan(&recipAfter)
	if recipAfter != 0 {
		t.Fatalf("CASCADE delete notification_recipients gagal, tersisa %d baris", recipAfter)
	}
}

func TestBroadcastEnterprise_StorelessSuperadminNoStoreContextLeak(t *testing.T) {
	db := setupEnterpriseBroadcastTestDB(t)
	if err := db.AutoMigrate(&models.UserSession{}); err != nil {
		t.Fatalf("automigrate UserSession: %v", err)
	}
	oldDB := database.DB
	database.DB = db
	services.InitRBACService(db)
	t.Cleanup(func() {
		database.DB = oldDB
	})

	cfg := &config.Config{
		AppEnv:             "test",
		JWTSecret:          "unit-test-secret-superadmin-routing-check-32b",
		JWTExpirationHours: 24,
		MFAEnabled:         true,
		MFAEncryptionKey:   "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
	}

	uAdmin := models.User{
		ID:                77,
		Name:              "Super Admin Tanpa Toko",
		Email:             "superadmin2@catavor.local",
		PlatformRole:      "superadmin",
		TwoFactorEnabled:  true,
		TwoFactorEnforced: true,
		TokenVersion:      1,
		CreatedAt:         time.Now().UTC(),
	}
	if err := db.Create(&uAdmin).Error; err != nil {
		t.Fatalf("create superadmin user: %v", err)
	}

	token, jti, exp, err := middleware.GenerateTokenWithIDVerified(&uAdmin, nil, cfg)
	if err != nil {
		t.Fatalf("generate verified superadmin token: %v", err)
	}
	if err := db.Create(&models.UserSession{
		UserID:       uAdmin.ID,
		TokenID:      jti,
		ExpiresAt:    exp,
		IsRevoked:    false,
		CreatedAt:    time.Now().UTC(),
		LastActiveAt: time.Now().UTC(),
	}).Error; err != nil {
		t.Fatalf("create user session fixture: %v", err)
	}

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	h := NewNotificationHandler(db, cfg)
	api := app.Group("/api")

	type scoped struct {
		parent fiber.Router
		mws    []fiber.Handler
	}
	wrap := func(s scoped, hs ...fiber.Handler) []fiber.Handler {
		out := make([]fiber.Handler, 0, len(s.mws)+len(hs))
		out = append(out, s.mws...)
		out = append(out, hs...)
		return out
	}

	authOnly := scoped{parent: api, mws: []fiber.Handler{middleware.AuthRequired(cfg)}}
	guarded := scoped{parent: api, mws: []fiber.Handler{middleware.AuthRequired(cfg), middleware.StoreOwnerRequired()}}
	guardedMutations := scoped{parent: api, mws: []fiber.Handler{middleware.AuthRequired(cfg), middleware.StoreOwnerRequired(), middleware.OperationalStoreRequired()}}

	api.Get("/auth/me", wrap(authOnly, func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"success": true})
	})...)
	api.Get("/admin/analytics", wrap(guarded, func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"success": true})
	})...)
	api.Post("/products", wrap(guardedMutations, func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"success": true})
	})...)

	adminApi := api.Group("/admin", middleware.AuthRequired(cfg), middleware.RequireAdmin(cfg), middleware.RequireMFACompleted(cfg))
	adminApi.Post("/notifications/broadcast", middleware.RequirePermission(cfg, "content:broadcast:send"), h.SuperadminBroadcast)
	adminApi.Post("/notifications/:id/publish", middleware.RequirePermission(cfg, "content:broadcast:send"), h.SuperadminPublish)
	adminApi.Post("/notifications/:id/revoke", middleware.RequirePermission(cfg, "content:broadcast:send"), h.SuperadminRevoke)
	adminApi.Delete("/notifications/:id", middleware.RequirePermission(cfg, "content:broadcast:send"), h.SuperadminDelete)

	hdr := map[string]string{"Authorization": "Bearer " + token}

	// 1. Mutasi platform admin oleh superadmin tanpa toko TIDAK BOLEH bocor ke StoreOwnerRequired (403 STORE_CONTEXT_REQUIRED)
	rCreate, bCreate := execBroadcastJSON(t, app, "POST", "/api/admin/notifications/broadcast", hdr, map[string]interface{}{
		"target_type": "all",
		"status":      "draft",
		"title":       "Uji Storeless Superadmin",
		"category":    "SISTEM",
		"message":     "Pastikan tidak kena STORE_CONTEXT_REQUIRED.",
	})
	if rCreate.StatusCode != http.StatusCreated {
		t.Fatalf("POST /api/admin/notifications/broadcast status=%d body=%v, want 201", rCreate.StatusCode, bCreate)
	}
	bid := bCreate["notification"].(map[string]interface{})["id"].(string)

	rPub, bPub := execBroadcastJSON(t, app, "POST", "/api/admin/notifications/"+bid+"/publish", hdr, nil)
	if rPub.StatusCode != http.StatusOK {
		t.Fatalf("POST /api/admin/notifications/%s/publish status=%d body=%v, want 200", bid, rPub.StatusCode, bPub)
	}

	rRev, bRev := execBroadcastJSON(t, app, "POST", "/api/admin/notifications/"+bid+"/revoke", hdr, nil)
	if rRev.StatusCode != http.StatusOK {
		t.Fatalf("POST /api/admin/notifications/%s/revoke status=%d body=%v, want 200", bid, rRev.StatusCode, bRev)
	}

	rDel, bDel := execBroadcastJSON(t, app, "DELETE", "/api/admin/notifications/"+bid, hdr, nil)
	if rDel.StatusCode != http.StatusOK {
		t.Fatalf("DELETE /api/admin/notifications/%s status=%d body=%v, want 200", bid, rDel.StatusCode, bDel)
	}

	// 2. Rute tenant merchant (/api/products) tetap wajib menolak staf tanpa toko dengan 403 STORE_CONTEXT_REQUIRED
	rProd, bProd := execBroadcastJSON(t, app, "POST", "/api/products", hdr, map[string]interface{}{"name": "x"})
	if rProd.StatusCode != http.StatusForbidden || bProd["code"] != "STORE_CONTEXT_REQUIRED" {
		t.Fatalf("POST /api/products oleh staf tanpa toko seharusnya 403 STORE_CONTEXT_REQUIRED, dapat status=%d body=%v", rProd.StatusCode, bProd)
	}
}
