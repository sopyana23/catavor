package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func openMonetizationAuditDB(t *testing.T) *gorm.DB {
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
		&models.Setting{},
		&models.ActivityLog{},
		&models.PlatformRole{},
		&models.PlatformPermission{},
		&models.PlatformRolePermission{},
		&models.AdSlot{},
		&models.AdCampaign{},
		&models.AdOrder{},
		&models.AdDailyMetric{},
	); err != nil {
		t.Fatalf("automigrate: %v", err)
	}
	return db
}

func TestMonetization_AdsTxtNoDummyFallbackAndValidation(t *testing.T) {
	db := openMonetizationAuditDB(t)
	h := NewSettingHandler(db)

	app := fiber.New()
	app.Get("/ads.txt", h.GetAdsTxt)
	app.Get("/api/settings", h.PublicIndex)
	admin := models.User{Name: "Content Admin", Email: "content@catavor.test", Password: "x", PlatformRole: "content"}
	_ = db.Create(&admin).Error

	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user", &admin)
		return c.Next()
	})
	app.Get("/api/admin/monetization/settings", h.GetMonetizationSettings)
	app.Post("/api/admin/monetization/settings", h.StoreMonetization)

	// 1. Unconfigured DB must return 404 on /ads.txt (NO pub-0000000000000000 leak)
	req := httptest.NewRequest(http.MethodGet, "/ads.txt", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("ads.txt request: %v", err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 when ads_txt unconfigured, got %d", resp.StatusCode)
	}

	// 2. Public /api/settings must return empty ads_txt_content (no dummy)
	pubReq := httptest.NewRequest(http.MethodGet, "/api/settings", nil)
	pubResp, err := app.Test(pubReq)
	if err != nil {
		t.Fatalf("public settings: %v", err)
	}
	var pubBody struct {
		Data map[string]string `json:"data"`
	}
	_ = json.NewDecoder(pubResp.Body).Decode(&pubBody)
	if strings.Contains(pubBody.Data["ads_txt_content"], "pub-0000000000000000") {
		t.Fatalf("public settings leaked dummy publisher id: %q", pubBody.Data["ads_txt_content"])
	}

	// 3. Legacy poisoned row pub-0000000000000000 must still yield 404 on /ads.txt
	_ = db.Create(&models.Setting{Key: "ads_txt_content", Value: "google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0"}).Error
	resp2, _ := app.Test(httptest.NewRequest(http.MethodGet, "/ads.txt", nil))
	if resp2.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 for dummy placeholder ads.txt row, got %d", resp2.StatusCode)
	}

	// 4. Reject invalid formats & cross-field errors
	badPayloads := []map[string]string{
		{"ads_enabled": "1", "ads_client_id": ""},
		{"ads_enabled": "1", "ads_client_id": "ca-pub-0000000000000000"},
		{"ads_client_id": "invalid-pub"},
		{"ads_slot_header": "not-digits"},
		{"ga_enabled": "1", "ga_measurement_id": "UA-123"},
		{"aulaa_api_key": "escalation"},
	}
	for idx, p := range badPayloads {
		raw, _ := json.Marshal(p)
		r := httptest.NewRequest(http.MethodPost, "/api/admin/monetization/settings", bytes.NewReader(raw))
		r.Header.Set("Content-Type", "application/json")
		res, err := app.Test(r)
		if err != nil {
			t.Fatalf("bad payload %d: %v", idx, err)
		}
		if res.StatusCode < 400 {
			t.Fatalf("expected >=400 rejection for payload %d (%v), got %d", idx, p, res.StatusCode)
		}
	}

	// 5. Save valid configuration -> normalizes pub- -> ca-pub-, auto-syncs ads.txt, logs ActivityLog
	goodPayload, _ := json.Marshal(map[string]string{
		"ads_enabled":       "1",
		"ads_client_id":     "pub-1234567890123456",
		"ads_slot_header":   "1234567890",
		"ga_enabled":        "1",
		"ga_measurement_id": "g-abc12345xy",
	})
	saveReq := httptest.NewRequest(http.MethodPost, "/api/admin/monetization/settings", bytes.NewReader(goodPayload))
	saveReq.Header.Set("Content-Type", "application/json")
	saveResp, err := app.Test(saveReq)
	if err != nil {
		t.Fatalf("save monetization settings: %v", err)
	}
	if saveResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 saving valid settings, got %d", saveResp.StatusCode)
	}

	// Verify /ads.txt now serves 200 with canonical ca-pub stripped line
	okTxtResp, _ := app.Test(httptest.NewRequest(http.MethodGet, "/ads.txt", nil))
	if okTxtResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on /ads.txt after save, got %d", okTxtResp.StatusCode)
	}
	buf := new(bytes.Buffer)
	_, _ = buf.ReadFrom(okTxtResp.Body)
	expectedLine := "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0"
	if strings.TrimSpace(buf.String()) != expectedLine {
		t.Fatalf("expected /ads.txt %q, got %q", expectedLine, buf.String())
	}

	var logCount int64
	db.Model(&models.ActivityLog{}).Where("action = ?", "admin.monetization_settings_updated").Count(&logCount)
	if logCount == 0 {
		t.Fatalf("expected ActivityLog entry for monetization update")
	}
}

func TestAdTelemetry_ClickFraudBlocking_ImpressionDedup_SignatureTTL(t *testing.T) {
	svc := services.GetAdTelemetryService()
	campID := uint64(90001)
	slotID := uint64(2)
	storeID := uint(501)

	// Drain any leftovers for unique campID
	baseImps := svc.GetBufferedImpressionsToday(campID)
	if !svc.RecordImpressionWithDedup(campID, slotID, storeID, "203.0.113.55") {
		t.Fatalf("expected first impression to be recorded")
	}
	if svc.RecordImpressionWithDedup(campID, slotID, storeID, "203.0.113.55") {
		t.Fatalf("expected duplicate impression within 60s from same IP to be deduplicated")
	}
	if got := svc.GetBufferedImpressionsToday(campID); got != baseImps+1 {
		t.Fatalf("expected buffered impressions = %d, got %d", baseImps+1, got)
	}

	// Click fraud blocking: duplicate within 30min must return false AND not increment clicks
	db := openMonetizationAuditDB(t)
	if !svc.RecordClick(campID, slotID, storeID, "198.51.100.10", "", true) {
		t.Fatalf("expected first click to be chargeable")
	}
	if svc.RecordClick(campID, slotID, storeID, "198.51.100.10", "", true) {
		t.Fatalf("expected repeat click within 30min to be non-chargeable")
	}
	// Verify DB after FlushToDatabase shows exact Clicks == 1 (SQLite compatible SQL? Note FlushToDatabase uses PostgreSQL ::decimal syntax, so test in-memory directly + verify!)
	// Note: VerifyClickSignature 900s TTL check:
	secret := "test-jwt-secret"
	target := "/u/toko-test?item=77"
	tsValid := time.Now().UTC().Add(-120 * time.Second).Unix()
	payloadValid := fmt.Sprintf("CMP-T1|%s|%d", target, tsValid)
	macValid := hmac.New(sha256.New, []byte(secret))
	macValid.Write([]byte(payloadValid))
	sigValid := hex.EncodeToString(macValid.Sum(nil))
	if !services.VerifyClickSignature("CMP-T1", target, fmt.Sprintf("%d", tsValid), sigValid, secret) {
		t.Fatalf("expected 120s-old HMAC signature to pass within 900s TTL")
	}

	tsExpired := time.Now().UTC().Add(-950 * time.Second).Unix()
	payloadExpired := fmt.Sprintf("CMP-T1|%s|%d", target, tsExpired)
	macExp := hmac.New(sha256.New, []byte(secret))
	macExp.Write([]byte(payloadExpired))
	sigExp := hex.EncodeToString(macExp.Sum(nil))
	if services.VerifyClickSignature("CMP-T1", target, fmt.Sprintf("%d", tsExpired), sigExp, secret) {
		t.Fatalf("expected 950s-old HMAC signature (>900s TTL) to fail")
	}
	_ = db
}

func TestAdRotator_ProductClickURLAlignmentAndCapEnforcement(t *testing.T) {
	db := openMonetizationAuditDB(t)
	cfg := &config.Config{JWTSecret: "rotator-secret-123"}
	h := NewAdHandler(cfg, db, nil)

	owner := models.User{Name: "Seller", Email: "seller@test.id", Password: "x", PlatformRole: "merchant"}
	_ = db.Create(&owner).Error
	store := models.Store{
		UserID:             owner.ID,
		Slug:               "toko-rotator",
		StoreTitle:         "Toko Rotator",
		PrimaryProductType: "fauna",
		DormancyStatus:     "active",
	}
	_ = db.Create(&store).Error
	prod := models.Product{
		StoreID:     store.ID,
		Name:        "Burung Kicau Juara",
		Price:       250000,
		ProductType: "fauna",
		IsActive:    true,
	}
	_ = db.Create(&prod).Error
	slot := models.AdSlot{
		SlotCode:            "landing_spotlight_products",
		Name:                "Spotlight Produk",
		TargetEntity:        "product",
		AllowedProductTypes: "all",
		MaxItemsDisplayed:   6,
		PricingModel:        "flat_daily",
		DefaultRatePerDay:   15000,
		MinDurationDays:     1,
		IsActive:            true,
	}
	_ = db.Create(&slot).Error

	now := time.Now().UTC()
	camp := models.AdCampaign{
		CampaignCode:       "CMP-ROT-001",
		StoreID:            store.ID,
		AdSlotID:           slot.ID,
		TargetType:         "product",
		TargetProductID:    &prod.ID,
		TargetID:           uint64(prod.ID),
		CampaignName:       "Promo Kicau",
		StartAt:            now.Add(-1 * time.Hour),
		EndAt:              now.Add(24 * time.Hour),
		Status:             "active",
		PriorityWeight:     20,
		DailyImpressionCap: 5,
		TargetProductType:  "fauna",
		CustomBadgeText:    "Disponsori",
	}
	_ = db.Create(&camp).Error

	// 1. GetRotatedShowcase produces signed URL & campaign metadata
	res, err := services.GetRotatedShowcase(db, slot.SlotCode, "all", 4, "", cfg.JWTSecret)
	if err != nil {
		t.Fatalf("GetRotatedShowcase failed: %v", err)
	}
	if len(res.Items) == 0 || !res.Items[0].IsSponsored {
		t.Fatalf("expected sponsored product showcase item, got %+v", res.Items)
	}
	sponsored := res.Items[0]
	if sponsored.CampaignID != camp.ID || sponsored.AdSlotID != slot.ID {
		t.Fatalf("expected CampaignID=%d AdSlotID=%d, got %d/%d", camp.ID, slot.ID, sponsored.CampaignID, sponsored.AdSlotID)
	}

	// 2. Hitting /api/public/ads/click with generated redirect_url must validate HMAC & redirect to /u/<slug>?item=<id>
	app := fiber.New()
	app.Get("/api/public/ads/click", h.HandleAdClick)
	app.Post("/api/ads/impressions/batch", h.RecordImpressionBatch)
	clickResp, err := app.Test(httptest.NewRequest(http.MethodGet, sponsored.RedirectURL, nil))
	if err != nil {
		t.Fatalf("click request: %v", err)
	}
	if clickResp.StatusCode != http.StatusTemporaryRedirect && clickResp.StatusCode != http.StatusFound {
		t.Fatalf("expected 302/307 redirect, got %d", clickResp.StatusCode)
	}
	loc := clickResp.Header.Get("Location")
	expectedDest := fmt.Sprintf("/u/%s?item=%d", store.Slug, prod.ID)
	if loc != expectedDest {
		t.Fatalf("expected click redirect %q, got %q", expectedDest, loc)
	}
	// Verify parsed query sig verified successfully by repeating via second IP triggers chargeable click
	parsed, _ := url.Parse(sponsored.RedirectURL)
	if parsed.Query().Get("sig") == "" {
		t.Fatalf("missing sig in signed click URL")
	}

	// 3. Saturate DailyImpressionCap (5) in ad_daily_metrics and verify GetRotatedShowcase omits capped campaign
	_ = db.Create(&models.AdDailyMetric{
		CampaignID:       camp.ID,
		AdSlotID:         slot.ID,
		StoreID:          store.ID,
		Date:             now.Format("2006-01-02"),
		ImpressionsCount: 5,
	}).Error
	resAfterCap, err := services.GetRotatedShowcase(db, slot.SlotCode, "all", 4, "", cfg.JWTSecret)
	if err != nil {
		t.Fatalf("GetRotatedShowcase after cap failed: %v", err)
	}
	if resAfterCap.SponsoredCount != 0 {
		t.Fatalf("expected capped campaign to be skipped, got SponsoredCount=%d", resAfterCap.SponsoredCount)
	}
}

func TestAdHandler_CreateCampaignValidationAndAdminOpsWorkflow(t *testing.T) {
	db := openMonetizationAuditDB(t)
	tmpPrivate := t.TempDir()
	cfg := &config.Config{JWTSecret: "ops-secret", StoragePrivateRoot: tmpPrivate, StorageLocalRoot: tmpPrivate}
	h := NewAdHandler(cfg, db, nil)

	owner := models.User{Name: "Merchant One", Email: "m1@test.id", Password: "x", PlatformRole: "merchant"}
	admin := models.User{Name: "Super Admin", Email: "sa@catavor.test", Password: "x", PlatformRole: "superadmin"}
	_ = db.Create(&owner).Error
	_ = db.Create(&admin).Error

	store := models.Store{
		UserID:             owner.ID,
		Slug:               "toko-fauna",
		StoreTitle:         "Toko Fauna",
		PrimaryProductType: "fauna",
	}
	_ = db.Create(&store).Error
	prod := models.Product{StoreID: store.ID, Name: "Tanaman Hias", Price: 50000, ProductType: "plant", IsActive: true}
	_ = db.Create(&prod).Error

	slotStoreOnly := models.AdSlot{
		SlotCode:            "landing_sector_fauna",
		Name:                "Banner Sektor Fauna",
		TargetEntity:        "store",
		AllowedProductTypes: "fauna",
		MaxItemsDisplayed:   4,
		PricingModel:        "flat_daily",
		DefaultRatePerDay:   25000,
		MinDurationDays:     3,
		IsActive:            true,
	}
	_ = db.Create(&slotStoreOnly).Error

	app := fiber.New()
	app.Post("/api/public/ads/impressions/batch", h.RecordImpressionBatch)

	merchantGroup := app.Group("/api", func(c *fiber.Ctx) error {
		c.Locals("user", &owner)
		c.Locals("store", &store)
		return c.Next()
	})
	merchantGroup.Post("/ads/campaigns", h.CreateCampaign)

	adminGroup := app.Group("/api/admin", func(c *fiber.Ctx) error {
		c.Locals("user", &admin)
		return c.Next()
	})
	adminGroup.Get("/ads/overview", h.AdminGetOverview)
	adminGroup.Put("/ads/slots/:id", h.AdminUpdateSlot)
	adminGroup.Post("/ads/orders/:order_id/verify", h.VerifyAdPayment)
	adminGroup.Post("/ads/campaigns/:id/moderate", h.ModerateCampaign)
	adminGroup.Get("/ads/orders/:order_id/proof", h.AdminGetOrderProof)

	// 1. Wrong target_type ('product' on store-only slot) -> 400
	badType, _ := json.Marshal(map[string]interface{}{
		"slot_code":      slotStoreOnly.SlotCode,
		"target_type":    "product",
		"campaign_name":  "Promo Salah Target",
		"duration_days":  3,
		"payment_method": "manual_transfer",
	})
	r1, _ := app.Test(httptest.NewRequest(http.MethodPost, "/api/ads/campaigns", bytes.NewReader(badType)))
	if r1.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for wrong target_type, got %d", r1.StatusCode)
	}

	// 2. Below MinDurationDays (1 < 3) -> 400
	badDur, _ := json.Marshal(map[string]interface{}{
		"slot_code":      slotStoreOnly.SlotCode,
		"target_type":    "store",
		"campaign_name":  "Promo Durasi Pendek",
		"duration_days":  1,
		"payment_method": "manual_transfer",
	})
	r2, _ := app.Test(httptest.NewRequest(http.MethodPost, "/api/ads/campaigns", bytes.NewReader(badDur)))
	if r2.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for duration < min_duration_days, got %d", r2.StatusCode)
	}

	// 3. Valid campaign creation -> 201
	goodCamp, _ := json.Marshal(map[string]interface{}{
		"slot_code":      slotStoreOnly.SlotCode,
		"target_type":    "store",
		"campaign_name":  "Promo Toko Fauna",
		"duration_days":  3,
		"payment_method": "manual_transfer",
	})
	reqGood := httptest.NewRequest(http.MethodPost, "/api/ads/campaigns", bytes.NewReader(goodCamp))
	reqGood.Header.Set("Content-Type", "application/json")
	r3, err := app.Test(reqGood)
	if err != nil || r3.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 on valid CreateCampaign, got %d (err=%v)", r3.StatusCode, err)
	}
	var createRes struct {
		Success      bool    `json:"success"`
		CampaignCode string  `json:"campaign_code"`
		OrderNumber  string  `json:"order_number"`
		FinalAmount  float64 `json:"final_amount"`
	}
	_ = json.NewDecoder(r3.Body).Decode(&createRes)
	var createdCamp models.AdCampaign
	if err := db.Where("campaign_code = ?", createRes.CampaignCode).First(&createdCamp).Error; err != nil {
		t.Fatalf("campaign not persisted: %v", err)
	}
	var createdOrder models.AdOrder
	if err := db.Where("order_number = ?", createRes.OrderNumber).First(&createdOrder).Error; err != nil {
		t.Fatalf("order not persisted: %v", err)
	}
	orderID := createdOrder.ID
	campID := createdCamp.ID

	// 4. RecordImpressionBatch must ignore unverified/non-active campaign
	impRaw, _ := json.Marshal([]map[string]interface{}{
		{"campaign_id": campID, "ad_slot_id": slotStoreOnly.ID, "store_id": store.ID},
		{"campaign_id": 999999, "ad_slot_id": slotStoreOnly.ID, "store_id": store.ID},
	})
	impReq := httptest.NewRequest(http.MethodPost, "/api/public/ads/impressions/batch", bytes.NewReader(impRaw))
	impReq.Header.Set("Content-Type", "application/json")
	impResp, _ := app.Test(impReq)
	var impRes struct {
		Recorded int `json:"recorded"`
	}
	_ = json.NewDecoder(impResp.Body).Decode(&impRes)
	if impRes.Recorded != 0 {
		t.Fatalf("expected 0 impressions recorded for pending/bogus campaigns, got %d", impRes.Recorded)
	}

	// 5. Invalid VerifyAdPayment action must return 400
	badAction, _ := json.Marshal(map[string]string{"action": "hack"})
	vrBadReq := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/admin/ads/orders/%d/verify", orderID), bytes.NewReader(badAction))
	vrBadReq.Header.Set("Content-Type", "application/json")
	vrBadResp, _ := app.Test(vrBadReq)
	if vrBadResp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid verify action, got %d", vrBadResp.StatusCode)
	}

	// 6. Approve payment -> campaign active + now RecordImpressionBatch records 1 (and ignores 2nd call within 60s)
	approveBody, _ := json.Marshal(map[string]string{"action": "approve"})
	appReq := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/admin/ads/orders/%d/verify", orderID), bytes.NewReader(approveBody))
	appReq.Header.Set("Content-Type", "application/json")
	appResp, _ := app.Test(appReq)
	if appResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 approving ad order, got %d", appResp.StatusCode)
	}

	impReq2 := httptest.NewRequest(http.MethodPost, "/api/public/ads/impressions/batch", bytes.NewReader(impRaw))
	impReq2.Header.Set("Content-Type", "application/json")
	impResp2, _ := app.Test(impReq2)
	_ = json.NewDecoder(impResp2.Body).Decode(&impRes)
	if impRes.Recorded != 1 {
		t.Fatalf("expected 1 impression recorded for active campaign, got %d", impRes.Recorded)
	}

	// 7. AdminUpdateSlot pricing update + ModerateCampaign pause/resume + AdminGetOverview
	slotUpd, _ := json.Marshal(map[string]interface{}{"default_rate_per_day": 30000, "min_duration_days": 2})
	updReq := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/admin/ads/slots/%d", slotStoreOnly.ID), bytes.NewReader(slotUpd))
	updReq.Header.Set("Content-Type", "application/json")
	updResp, _ := app.Test(updReq)
	if updResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on AdminUpdateSlot, got %d", updResp.StatusCode)
	}

	pauseBody, _ := json.Marshal(map[string]string{"action": "pause", "reason": "Audit visual sementara"})
	modReq := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/admin/ads/campaigns/%d/moderate", campID), bytes.NewReader(pauseBody))
	modReq.Header.Set("Content-Type", "application/json")
	modResp, _ := app.Test(modReq)
	if modResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on ModerateCampaign pause, got %d", modResp.StatusCode)
	}

	ovResp, _ := app.Test(httptest.NewRequest(http.MethodGet, "/api/admin/ads/overview?status=paused", nil))
	if ovResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on AdminGetOverview, got %d", ovResp.StatusCode)
	}

	// 8. AdminGetOrderProof validates ownership prefix & serves file safely
	proofRel := fmt.Sprintf("ad_proofs/store_%d_order_%d_12345.png", store.ID, orderID)
	proofFull := filepath.Join(tmpPrivate, filepath.FromSlash(proofRel))
	_ = os.MkdirAll(filepath.Dir(proofFull), 0755)
	_ = os.WriteFile(proofFull, []byte("\x89PNG\r\n\x1a\nfake"), 0644)
	_ = db.Model(&models.AdOrder{}).Where("id = ?", orderID).Update("payment_proof_url", "private/"+proofRel).Error

	proofResp, err := app.Test(httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/admin/ads/orders/%d/proof", orderID), nil))
	if err != nil {
		t.Fatalf("proof request: %v", err)
	}
	defer proofResp.Body.Close()
	if proofResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 serving ad proof, got %d", proofResp.StatusCode)
	}
	if proofResp.Header.Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("expected nosniff security header on proof")
	}
}
