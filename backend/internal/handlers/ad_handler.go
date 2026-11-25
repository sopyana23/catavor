package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"
	"catavor-backend/internal/services"
	"catavor-backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// =========================================================================================
// AD HANDLER (CONTROLLER RESTFUL FITUR IKLAN & SHOWCASE POPULER)
// =========================================================================================
// Handler ini melayani 3 tingkatan akses:
// 1. PUBLIC:
//    - GET  /api/public/showcase/featured        (Showcase profil toko & item unggulan beranda)
//    - GET  /api/public/showcase/by-sector/:type (Showcase tertarget 7 format katalog)
//    - GET  /api/public/ads/click               (Redirect aman via token HMAC & anti-fraud)
//    - POST /api/public/ads/impressions/batch    (Batch telemetri impresi client-side)
// 2. MERCHANT (AuthRequired + StoreOwnerRequired):
//    - GET  /api/merchant/ads/slots             (Daftar slot sewa aktif & tarif harian)
//    - GET  /api/merchant/ads/campaigns         (Riwayat kampanye iklan toko sendiri)
//    - POST /api/merchant/ads/campaigns         (Buat kampanye: HANYA profil ATAU HANYA item)
//    - POST /api/merchant/ads/orders/:id/proof  (Unggah bukti bayar transfer sewa slot)
//    - GET  /api/merchant/ads/campaigns/:id/analytics (Laporan impresi, klik & ROAS)
// 3. ADMIN / OPS (AuthRequired + PlatformRoleRequired / Staff):
//    - GET  /api/ops/ads/campaigns/pending      (Daftar antrean moderasi & approval)
//    - POST /api/ops/ads/campaigns/:id/moderate (Moderasi: approve, reject, pause)
//    - POST /api/ops/ads/orders/:id/verify      (Verifikasi bayar atomik row lock SELECT FOR UPDATE)
// =========================================================================================

type AdHandler struct {
	cfg     *config.Config
	db      *gorm.DB
	storage storage.StorageService
}

func isMerchantSponsoredAdsEnabled() bool {
	val := strings.ToLower(strings.TrimSpace(os.Getenv("FEATURE_MERCHANT_SPONSORED_ADS_ENABLED")))
	return val == "1" || val == "true" || val == "yes" || val == "on"
}

func NewAdHandler(cfg *config.Config, db *gorm.DB, storage storage.StorageService) *AdHandler {
	return &AdHandler{
		cfg:     cfg,
		db:      db,
		storage: storage,
	}
}

// -----------------------------------------------------------------------------------------
// 1. PUBLIC SHOWCASE ENDPOINTS
// -----------------------------------------------------------------------------------------

// GetFeaturedShowcase menyajikan data etalase beranda utama:
// - Section 1: Profil Toko Pilihan (Kombinasi Sponsored & Organik Trending 7-Hari)
// - Section 2: Flash Spotlight Item Produk Unggulan Lintas Kategori
func (h *AdHandler) GetFeaturedShowcase(c *fiber.Ctx) error {
	if !isMerchantSponsoredAdsEnabled() {
		return c.JSON(fiber.Map{
			"success":          true,
			"feature_disabled": true,
			"data": fiber.Map{
				"featured_stores": fiber.Map{"items": []interface{}{}},
				"spotlight_items": fiber.Map{"items": []interface{}{}},
			},
		})
	}
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	limit := 4
	if lStr := c.Query("limit"); lStr != "" {
		if lVal, err := strconv.Atoi(lStr); err == nil && lVal > 0 && lVal <= 12 {
			limit = lVal
		}
	}

	// Session ID unik pengunjung dari cookie atau query untuk deterministik seed rotasi
	sessionID := strings.TrimSpace(c.Query("session_id"))
	if sessionID == "" {
		sessionID = c.Cookies("ctv_session", c.IP())
	}

	secret := h.cfg.JWTSecret

	// 1. Ambil Profil Toko Pilihan (Slot: landing_hero_showcase)
	storeShowcase, err := services.GetRotatedShowcase(h.db, "landing_hero_showcase", "all", limit, sessionID, secret)
	if err != nil {
		log.Error().Err(err).Msg("Gagal merotasi showcase toko beranda")
	}

	// 2. Ambil Item Produk Unggulan (Slot: landing_spotlight_products)
	productLimit := 6
	productShowcase, err := services.GetRotatedShowcase(h.db, "landing_spotlight_products", "all", productLimit, sessionID, secret)
	if err != nil {
		log.Error().Err(err).Msg("Gagal merotasi spotlight produk beranda")
	}

	c.Set("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"featured_stores": storeShowcase,
			"spotlight_items": productShowcase,
		},
	})
}

// GetSectorShowcase menyajikan produk unggulan bersponsor & organik khusus untuk 1 dari 7 sektor format katalog.
func (h *AdHandler) GetSectorShowcase(c *fiber.Ctx) error {
	if !isMerchantSponsoredAdsEnabled() {
		return c.JSON(fiber.Map{
			"success":          true,
			"feature_disabled": true,
			"product_type":     strings.ToLower(strings.TrimSpace(c.Params("product_type"))),
			"showcase":         fiber.Map{"items": []interface{}{}},
		})
	}
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	pType := strings.ToLower(strings.TrimSpace(c.Params("product_type")))
	validTypes := map[string]bool{
		"food": true, "physical": true, "fauna": true, "plant": true,
		"service": true, "digital": true, "property": true, "all": true,
	}
	if !validTypes[pType] {
		pType = "all"
	}

	limit := 8
	if lStr := c.Query("limit"); lStr != "" {
		if lVal, err := strconv.Atoi(lStr); err == nil && lVal > 0 && lVal <= 24 {
			limit = lVal
		}
	}

	sessionID := strings.TrimSpace(c.Query("session_id"))
	if sessionID == "" {
		sessionID = c.Cookies("ctv_session", c.IP())
	}

	slotCode := "landing_sector_" + pType
	if pType == "all" {
		slotCode = "landing_spotlight_products"
	}

	showcase, err := services.GetRotatedShowcase(h.db, slotCode, pType, limit, sessionID, h.cfg.JWTSecret)
	if err != nil {
		log.Error().Err(err).Str("sector", pType).Msg("Gagal mengambil showcase sektor")
	}

	c.Set("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
	return c.JSON(fiber.Map{
		"success":      true,
		"product_type": pType,
		"showcase":     showcase,
	})
}

// HandleAdClick memproses klik iklan dengan verifikasi tanda tangan HMAC-SHA256 (900 detik)
// dan mencatat telemetri dengan proteksi anti-click-fraud sebelum redirect 302.
func (h *AdHandler) HandleAdClick(c *fiber.Ctx) error {
	campaignCode := strings.TrimSpace(c.Query("c"))
	tsStr := strings.TrimSpace(c.Query("ts"))
	sig := strings.TrimSpace(c.Query("sig"))
	isWAClick := c.Query("is_wa") == "1" || c.Query("is_wa") == "true"

	if campaignCode == "" {
		return c.Redirect("/", fiber.StatusTemporaryRedirect)
	}

	// 1. Ambil data kampanye dan toko target
	var camp models.AdCampaign
	if err := h.db.Preload("Store").Preload("TargetProduct").
		Where("campaign_code = ?", campaignCode).First(&camp).Error; err != nil {
		return c.Redirect("/", fiber.StatusTemporaryRedirect)
	}
	if camp.Store == nil || strings.TrimSpace(camp.Store.Slug) == "" {
		return c.Redirect("/", fiber.StatusTemporaryRedirect)
	}

	// Tentukan URL tujuan default
	destinationURL := fmt.Sprintf("/u/%s", camp.Store.Slug)
	if camp.TargetType == "product" && camp.TargetProduct != nil {
		destinationURL = fmt.Sprintf("/u/%s?item=%d", camp.Store.Slug, camp.TargetProduct.ID)
	}

	// 2. SECURITY (N-44): Verifikasi tanda tangan HMAC wajib lulus sebelum mencatat metrik klik.
	// Redirect 302 tetap dijalankan agar navigasi pengunjung tidak terputus bila tautan kedaluwarsa,
	// namun metrik klik tidak boleh dimanipulasi oleh request tanpa signature yang sah.
	sigValid := false
	if tsStr != "" && sig != "" && h.cfg != nil {
		sigValid = services.VerifyClickSignature(campaignCode, destinationURL, tsStr, sig, h.cfg.JWTSecret)
	}

	if sigValid && camp.Status == "active" {
		// 3. Catat telemetri klik dengan perlindungan Token Bucket per IP (30 menit)
		clientIP := c.IP()
		sessionID := c.Cookies("ctv_session", "")
		services.GetAdTelemetryService().RecordClick(camp.ID, camp.AdSlotID, camp.StoreID, clientIP, sessionID, isWAClick)
	}

	// 4. Redirect 302 seketika ke halaman katalog / item target
	return c.Redirect(destinationURL, fiber.StatusTemporaryRedirect)
}

// RecordImpressionBatch menerima array impresi dari frontend untuk dicatat ke in-memory buffer.
// SECURITY (N-44): membatasi ukuran batch maksimum (50 item) dan melakukan deduplikasi per pasangan
// (campaign_id, ad_slot_id) dalam satu request untuk mencegah serangan amplifikasi impresi.
func (h *AdHandler) RecordImpressionBatch(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	type ImpressionPayload struct {
		CampaignID uint64 `json:"campaign_id"`
		AdSlotID   uint64 `json:"ad_slot_id"`
		StoreID    uint   `json:"store_id"`
	}

	var payload []ImpressionPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format payload impresi tidak valid.",
		})
	}

	const maxImpressionBatchSize = 50
	if len(payload) > maxImpressionBatchSize {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Ukuran batch impresi melebihi batas maksimum (50 item).",
		})
	}
	if len(payload) == 0 {
		return c.JSON(fiber.Map{"success": true, "recorded": 0})
	}

	campaignIDSet := make(map[uint64]struct{}, len(payload))
	campaignIDs := make([]uint64, 0, len(payload))
	for _, item := range payload {
		if item.CampaignID == 0 || item.AdSlotID == 0 || item.StoreID == 0 {
			continue
		}
		if _, exists := campaignIDSet[item.CampaignID]; !exists {
			campaignIDSet[item.CampaignID] = struct{}{}
			campaignIDs = append(campaignIDs, item.CampaignID)
		}
	}
	if len(campaignIDs) == 0 {
		return c.JSON(fiber.Map{"success": true, "recorded": 0})
	}

	now := time.Now().UTC()
	var activeCampaigns []models.AdCampaign
	_ = h.db.Where("id IN ? AND status = 'active' AND start_at <= ? AND end_at >= ?", campaignIDs, now, now).Find(&activeCampaigns).Error
	validCampaigns := make(map[uint64]models.AdCampaign, len(activeCampaigns))
	for _, camp := range activeCampaigns {
		validCampaigns[camp.ID] = camp
	}

	telemetry := services.GetAdTelemetryService()
	viewerKey := strings.TrimSpace(c.IP())
	seen := make(map[string]struct{}, len(payload))
	recorded := 0
	for _, item := range payload {
		if item.CampaignID == 0 || item.AdSlotID == 0 || item.StoreID == 0 {
			continue
		}
		camp, ok := validCampaigns[item.CampaignID]
		if !ok || camp.AdSlotID != item.AdSlotID || camp.StoreID != item.StoreID {
			continue
		}
		dedupKey := fmt.Sprintf("%d:%d", camp.ID, camp.AdSlotID)
		if _, exists := seen[dedupKey]; exists {
			continue
		}
		seen[dedupKey] = struct{}{}
		if telemetry.RecordImpressionWithDedup(camp.ID, camp.AdSlotID, camp.StoreID, viewerKey) {
			recorded++
		}
	}

	return c.JSON(fiber.Map{
		"success":  true,
		"recorded": recorded,
	})
}

// -----------------------------------------------------------------------------------------
// 2. MERCHANT AD MANAGEMENT ENDPOINTS (Zero-Trust Multi-Tenant)
// -----------------------------------------------------------------------------------------

// GetAvailableSlots mengembalikan daftar slot iklan yang dibuka untuk sewa beserta tarif per hari.
func (h *AdHandler) GetAvailableSlots(c *fiber.Ctx) error {
	if !isMerchantSponsoredAdsEnabled() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"code":    "FEATURE_DISABLED",
			"message": "Fitur promosi & iklan internal merchant sedang dinonaktifkan sementara untuk peluncuran awal.",
		})
	}
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	var slots []models.AdSlot
	if err := h.db.Where("is_active = true").Order("id ASC").Find(&slots).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat daftar slot iklan.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    slots,
	})
}

// GetMyCampaigns mengembalikan seluruh riwayat pengajuan iklan milik toko yang sedang aktif.
func (h *AdHandler) GetMyCampaigns(c *fiber.Ctx) error {
	if !isMerchantSponsoredAdsEnabled() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"code":    "FEATURE_DISABLED",
			"message": "Fitur promosi & iklan internal merchant sedang dinonaktifkan sementara untuk peluncuran awal.",
		})
	}
	store, ok := c.Locals("store").(*models.Store)
	if !ok || store == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Sesi toko tidak valid.",
		})
	}

	user, _ := c.Locals("user").(*models.User)
	if user != nil && user.IsPlatformStaff() && store.UserID != user.ID {
		canReadAds := user.IsSuperadmin() ||
			services.GetRBACService().HasPermission(user, "finance:orders:read") ||
			services.GetRBACService().HasPermission(user, "system:settings:manage")
		if !canReadAds {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"message": "Akses Ditolak: Anda memerlukan izin 'finance:orders:read' untuk melihat kampanye iklan toko lain.",
			})
		}
	}

	var campaigns []models.AdCampaign
	err := h.db.Preload("AdSlot").Preload("TargetProduct").Preload("Orders").
		Where("store_id = ?", store.ID).
		Order("created_at DESC").
		Find(&campaigns).Error
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat kampanye iklan toko.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    campaigns,
	})
}

// CreateCampaign menangani pembuatan kampanye sewa iklan baru oleh merchant.
// Melindungi dari IDOR: Verifikasi ketat bahwa target produk atau toko sah milik merchant pemanggil!
func (h *AdHandler) CreateCampaign(c *fiber.Ctx) error {
	if !isMerchantSponsoredAdsEnabled() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"code":    "FEATURE_DISABLED",
			"message": "Fitur promosi & iklan internal merchant sedang dinonaktifkan sementara untuk peluncuran awal.",
		})
	}
	store, ok := c.Locals("store").(*models.Store)
	if !ok || store == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Sesi toko tidak valid.",
		})
	}
	user, _ := c.Locals("user").(*models.User)
	if user != nil && user.IsPlatformStaff() && store.UserID != user.ID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses Ditolak: Hanya pemilik toko yang sah yang dapat membuat pengajuan kampanye iklan.",
		})
	}
	userID := uint(0)
	if user != nil {
		userID = user.ID
	}

	type CreateCampaignRequest struct {
		SlotCode        string `json:"slot_code"`
		TargetType      string `json:"target_type"` // "store" | "product"
		TargetProductID *uint  `json:"target_product_id"`
		CampaignName    string `json:"campaign_name"`
		DurationDays    int    `json:"duration_days"` // 1 s/d 30 hari
		PaymentMethod   string `json:"payment_method"` // "bank_transfer" | "qris"
	}

	var req CreateCampaignRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Payload permintaan iklan tidak valid.",
		})
	}

	req.TargetType = strings.ToLower(strings.TrimSpace(req.TargetType))
	if req.TargetType != "store" && req.TargetType != "product" {
		req.TargetType = "store"
	}
	if req.DurationDays < 1 {
		req.DurationDays = 1
	}
	if req.DurationDays > 90 {
		req.DurationDays = 90
	}
	if strings.TrimSpace(req.CampaignName) == "" {
		req.CampaignName = fmt.Sprintf("Promosi %s (%d Hari)", store.StoreTitle, req.DurationDays)
	}

	// 1. Ambil data master slot & validasi aturan sewa
	req.TargetType = strings.ToLower(strings.TrimSpace(req.TargetType))
	if req.TargetType != "store" && req.TargetType != "product" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Tipe target kampanye harus 'store' atau 'product'.",
		})
	}
	req.CampaignName = security.SanitizePlainText(req.CampaignName, 120)
	if req.CampaignName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Nama kampanye iklan wajib diisi.",
		})
	}

	var slot models.AdSlot
	if err := h.db.Where("slot_code = ? AND is_active = true", req.SlotCode).First(&slot).Error; err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Slot iklan yang dipilih tidak tersedia.",
		})
	}

	slotEntity := strings.ToLower(strings.TrimSpace(slot.TargetEntity))
	if slotEntity == "store" && req.TargetType != "store" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Slot iklan ini khusus untuk promosi Profil Toko.",
		})
	}
	if slotEntity == "product" && req.TargetType != "product" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Slot iklan ini khusus untuk promosi Produk Katalog.",
		})
	}

	minDays := slot.MinDurationDays
	if minDays < 1 {
		minDays = 1
	}
	if req.DurationDays < minDays || req.DurationDays > 90 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": fmt.Sprintf("Durasi sewa slot harus antara %d hingga 90 hari.", minDays),
		})
	}

	// 2. Proteksi IDOR Berlapis (Zero-Trust Multi-Tenant)
	var targetStoreID *uint
	var targetProductID *uint
	var targetID uint64
	targetProductType := "all"

	if req.TargetType == "product" {
		if req.TargetProductID == nil || *req.TargetProductID == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "ID produk yang ingin diiklankan wajib dipilih.",
			})
		}
		// Validasi kepemilikan produk: Wajib sah milik store_id pemanggil!
		var prod models.Product
		if err := h.db.Where("id = ? AND store_id = ? AND is_active = true", *req.TargetProductID, store.ID).First(&prod).Error; err != nil {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"message": "Anda tidak memiliki hak otorisasi untuk mempromosikan produk ini.",
			})
		}
		targetProductID = req.TargetProductID
		targetID = uint64(*req.TargetProductID)
		targetProductType = prod.ProductType
	} else {
		// Target profil toko
		targetStoreID = &store.ID
		targetID = uint64(store.ID)
		targetProductType = store.PrimaryProductType
	}

	allowedTypes := strings.ToLower(strings.TrimSpace(slot.AllowedProductTypes))
	if allowedTypes != "" && allowedTypes != "all" {
		normalizedTargetType := strings.ToLower(strings.TrimSpace(targetProductType))
		typeAllowed := false
		for _, candidate := range strings.Split(allowedTypes, ",") {
			if strings.TrimSpace(candidate) == normalizedTargetType && normalizedTargetType != "" {
				typeAllowed = true
				break
			}
		}
		if !typeAllowed {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": fmt.Sprintf("Slot ini hanya menerima kategori katalog: %s.", slot.AllowedProductTypes),
			})
		}
	}

	// 3. Kalkulasi Finansial 100% Server-Side (Haram mempercayai input uang dari client)
	originalAmount := math.Round(slot.DefaultRatePerDay * float64(req.DurationDays))
	discountAmount := 0.0

	// Generate 3-digit kode unik verifikasi transfer manual
	uniqueCode := 0
	if req.PaymentMethod != "qris" {
		rNum, _ := rand.Int(rand.Reader, big.NewInt(900))
		uniqueCode = int(rNum.Int64()) + 100
	}
	finalAmount := math.Round(originalAmount - discountAmount + float64(uniqueCode))

	now := time.Now().UTC()
	startAt := now
	endAt := now.AddDate(0, 0, req.DurationDays)

	// Format kode kampanye dan nomor invoice unik dengan CSPRNG (anti tabrakan per detik)
	randBytes := make([]byte, 3)
	if _, err := rand.Read(randBytes); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghasilkan kode kampanye unik.",
		})
	}
	randSuffix := strings.ToUpper(hex.EncodeToString(randBytes))
	campaignCode := fmt.Sprintf("CMP-%s-%s", now.Format("20060102"), randSuffix)
	orderNumber := fmt.Sprintf("INV-AD-%s-%s", now.Format("20060102"), randSuffix)
	var paymentURL string

	// 4. Eksekusi Penyimpanan Atomik Transaksi Database
	err := h.db.Transaction(func(tx *gorm.DB) error {
		// Buat Kampanye Iklan
		campaign := models.AdCampaign{
			CampaignCode:       campaignCode,
			StoreID:            store.ID,
			AdSlotID:           slot.ID,
			TargetType:         req.TargetType,
			TargetStoreID:      targetStoreID,
			TargetProductID:    targetProductID,
			TargetID:           targetID,
			CampaignName:       req.CampaignName,
			StartAt:            startAt,
			EndAt:              endAt,
			Status:             "pending_payment",
			PricingModel:       slot.PricingModel,
			BudgetAmount:       finalAmount,
			PriorityWeight:     10,
			DailyImpressionCap: 0,
			TargetProductType:  targetProductType,
			CustomBadgeText:    "Disponsori",
		}
		if err := tx.Create(&campaign).Error; err != nil {
			return err
		}

		// Buat Faktur Pembayaran Sewa Iklan (Snapshot Denormalized)
		expiresAt := now.Add(24 * time.Hour)
		order := models.AdOrder{
			OrderNumber:          orderNumber,
			CampaignID:           campaign.ID,
			StoreID:              store.ID,
			UserID:               userID,
			SlotNameSnapshot:     slot.Name,
			PricingModelSnapshot: slot.PricingModel,
			DurationDays:         req.DurationDays,
			OriginalAmount:       originalAmount,
			DiscountAmount:       discountAmount,
			FinalAmount:          finalAmount,
			UniqueCode:           uniqueCode,
			PaymentMethod:        req.PaymentMethod,
			PaymentStatus:        "pending",
			ExpiresAt:            &expiresAt,
		}

		// Periksa Mode Pembayaran Platform (gateway_aulaa / manual_qris)
		var modeSetting models.Setting
		paymentSystemMode := "manual_qris"
		if err := tx.Where("key = ?", "payment_system_mode").First(&modeSetting).Error; err == nil && modeSetting.Value != "" {
			paymentSystemMode = modeSetting.Value
		}

		if paymentSystemMode == "gateway_aulaa" && finalAmount > 0 {
			order.GatewayProvider = "aulaa"
			aulaaCfg := services.GetAulaaConfig(h.db)
			if aulaaCfg.APIKey != "" && !strings.Contains(aulaaCfg.APIKey, "xxxxxxxx") {
				redirectURL := fmt.Sprintf("/admin/ads?payment=success&order_number=%s", orderNumber)
				if h.cfg != nil && h.cfg.AppURL != "" {
					redirectURL = fmt.Sprintf("%s/admin/ads?payment=success&order_number=%s", strings.TrimRight(h.cfg.AppURL, "/"), orderNumber)
				}
				aulaaResp, aErr := services.CreateAulaaPayment(aulaaCfg, services.AulaaCreatePaymentRequest{
					OrderID:     orderNumber,
					Amount:      finalAmount,
					RedirectURL: redirectURL,
				})
				if aErr == nil && aulaaResp != nil {
					order.GatewayReference = aulaaResp.ID
					order.GatewayPaymentLink = aulaaResp.PaymentLink
					rawB, _ := json.Marshal(aulaaResp)
					order.GatewayRawResponse = datatypes.JSON(rawB)
					paymentURL = aulaaResp.PaymentLink
				} else if aErr != nil {
					log.Warn().Err(aErr).Msg("Aulaa CreatePayment untuk ad_order gagal; menggunakan order pending")
				}
			}
		}

		return tx.Create(&order).Error
	})

	if err != nil {
		log.Error().Err(err).Msg("Gagal membuat kampanye iklan baru")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memproses pengajuan sewa iklan.",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success":       true,
		"message":       "Pengajuan iklan berhasil dibuat. Silakan lakukan pembayaran.",
		"campaign_code": campaignCode,
		"order_number":  orderNumber,
		"final_amount":  finalAmount,
		"unique_code":   uniqueCode,
		"payment_url":   paymentURL,
	})
}

// UploadPaymentProof menangani pengunggahan bukti bayar sewa iklan dengan validasi magic bytes.
func (h *AdHandler) UploadPaymentProof(c *fiber.Ctx) error {
	if !isMerchantSponsoredAdsEnabled() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"code":    "FEATURE_DISABLED",
			"message": "Fitur promosi & iklan internal merchant sedang dinonaktifkan sementara untuk peluncuran awal.",
		})
	}
	store, ok := c.Locals("store").(*models.Store)
	if !ok || store == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Sesi toko tidak valid.",
		})
	}

	orderIDStr := c.Params("order_id")
	orderID, err := strconv.ParseUint(orderIDStr, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "ID pesanan iklan tidak valid.",
		})
	}

	// 1. Verifikasi kepemilikan pesanan
	var order models.AdOrder
	if err := h.db.Where("id = ? AND store_id = ?", orderID, store.ID).First(&order).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Faktur pesanan iklan tidak ditemukan.",
		})
	}

	file, err := c.FormFile("proof")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Berkas bukti transfer wajib dilampirkan.",
		})
	}

	// Batasi ukuran maksimal 5 MB
	if file.Size > 5*1024*1024 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Ukuran berkas maksimal 5 MB.",
		})
	}

	src, err := file.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal membaca berkas.",
		})
	}
	defer src.Close()

	// 2. Validasi Magic-Byte (Mencegah upload backdoor/shell terselubung gambar)
	headerBytes := make([]byte, 512)
	n, _ := src.Read(headerBytes)
	_, _ = src.Seek(0, io.SeekStart)

	mimeType := http.DetectContentType(headerBytes[:n])
	allowedMimes := map[string]string{
		"image/jpeg": ".jpg",
		"image/png":  ".png",
		"image/webp": ".webp",
	}
	ext, isAllowed := allowedMimes[mimeType]
	if !isAllowed {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format berkas tidak diizinkan. Hanya menerima JPG, PNG, atau WebP murni.",
		})
	}

	// 3. Simpan ke Storage Privat (Isolasi Keamanan ST-01: Tidak dapat diakses lewat route publik /storage)
	storageKey := fmt.Sprintf("%sad_proofs/store_%d_order_%d_%d%s", storage.PrivateKeyPrefix, store.ID, order.ID, time.Now().Unix(), ext)
	if h.storage != nil {
		_, err = h.storage.Upload(c.Context(), storageKey, src, file.Size, mimeType)
		if err != nil {
			log.Error().Err(err).Msg("Gagal mengunggah bukti bayar iklan ke storage privat")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal menyimpan bukti pembayaran ke penyimpanan aman.",
			})
		}
	}

	// 4. Perbarui status pesanan menjadi 'pending_verification'
	senderName := strings.TrimSpace(c.FormValue("sender_name"))
	senderBank := strings.TrimSpace(c.FormValue("sender_bank"))

	order.PaymentProofURL = storageKey
	order.PaymentStatus = "pending_verification"
	if senderName != "" {
		order.SenderAccountName = senderName
	}
	if senderBank != "" {
		order.SenderBankName = senderBank
	}
	_ = h.db.Save(&order)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Bukti pembayaran berhasil diunggah. Menunggu verifikasi admin.",
	})
}

// GetCampaignAnalytics mengembalikan data agregasi metrik harian untuk satu kampanye tertentu.
func (h *AdHandler) GetCampaignAnalytics(c *fiber.Ctx) error {
	if !isMerchantSponsoredAdsEnabled() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"code":    "FEATURE_DISABLED",
			"message": "Fitur promosi & iklan internal merchant sedang dinonaktifkan sementara untuk peluncuran awal.",
		})
	}
	store, ok := c.Locals("store").(*models.Store)
	if !ok || store == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Sesi toko tidak valid.",
		})
	}

	user, _ := c.Locals("user").(*models.User)
	if user != nil && user.IsPlatformStaff() && store.UserID != user.ID {
		canReadAds := user.IsSuperadmin() ||
			services.GetRBACService().HasPermission(user, "finance:orders:read") ||
			services.GetRBACService().HasPermission(user, "system:settings:manage")
		if !canReadAds {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"message": "Akses Ditolak: Anda memerlukan izin 'finance:orders:read' untuk melihat analitik kampanye iklan toko lain.",
			})
		}
	}

	campaignIDStr := c.Params("id")
	campID, err := strconv.ParseUint(campaignIDStr, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "ID kampanye tidak valid.",
		})
	}

	// Verifikasi kepemilikan kampanye
	var camp models.AdCampaign
	if err := h.db.Where("id = ? AND store_id = ?", campID, store.ID).First(&camp).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Kampanye iklan tidak ditemukan.",
		})
	}

	var metrics []models.AdDailyMetric
	_ = h.db.Where("campaign_id = ?", camp.ID).Order("date DESC").Limit(30).Find(&metrics)

	return c.JSON(fiber.Map{
		"success":       true,
		"campaign_code": camp.CampaignCode,
		"status":        camp.Status,
		"metrics":       metrics,
	})
}

// -----------------------------------------------------------------------------------------
// 3. ADMIN / OPS APPROVAL & VERIFICATION ENDPOINTS (Row-Lock Concurrency)
// -----------------------------------------------------------------------------------------

// GetPendingCampaigns menyajikan antrean kampanye iklan yang membutuhkan verifikasi bayar atau moderasi.
func (h *AdHandler) GetPendingCampaigns(c *fiber.Ctx) error {
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil || !user.IsPlatformStaff() {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses khusus staf pengelola platform.",
		})
	}

	var orders []models.AdOrder
	_ = h.db.Preload("Campaign").Preload("Store").Preload("User").
		Where("payment_status = 'pending_verification' OR payment_status = 'pending'").
		Order("created_at ASC").
		Find(&orders)

	return c.JSON(fiber.Map{
		"success": true,
		"data":    orders,
	})
}

// VerifyAdPayment mengeksekusi verifikasi pembayaran bukti transfer dengan Row Lock SELECT FOR UPDATE
// untuk mencegah race condition (dobel aktivasi).
func (h *AdHandler) VerifyAdPayment(c *fiber.Ctx) error {
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil || !user.IsPlatformStaff() {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses khusus staf pengelola platform.",
		})
	}

	orderIDStr := c.Params("order_id")
	orderID, err := strconv.ParseUint(orderIDStr, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "ID pesanan iklan tidak valid.",
		})
	}

	type VerifyActionRequest struct {
		Action          string `json:"action"` // "approve" | "reject"
		RejectionReason string `json:"rejection_reason"`
	}
	var req VerifyActionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format permintaan verifikasi tidak valid.",
		})
	}
	req.Action = strings.ToLower(strings.TrimSpace(req.Action))
	if req.Action != "approve" && req.Action != "reject" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Aksi verifikasi harus 'approve' atau 'reject'.",
		})
	}
	req.RejectionReason = security.SanitizePlainText(req.RejectionReason, 1000)

	now := time.Now().UTC()
	var verifiedCampaignName string
	var verifiedStoreID uint

	// Eksekusi Transaksi Atomik dengan Penguncian Baris (SELECT FOR UPDATE)
	err = h.db.Transaction(func(tx *gorm.DB) error {
		var order models.AdOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", orderID).First(&order).Error; err != nil {
			return fmt.Errorf("pesanan iklan tidak ditemukan: %w", err)
		}

		if order.PaymentStatus == "paid" {
			return fmt.Errorf("pesanan ini sudah diverifikasi sebelumnya")
		}

		var campaign models.AdCampaign
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", order.CampaignID).First(&campaign).Error; err != nil {
			return fmt.Errorf("kampanye terkait tidak ditemukan: %w", err)
		}

		verifiedCampaignName = campaign.CampaignName
		verifiedStoreID = order.StoreID

		if req.Action == "approve" {
			order.PaymentStatus = "paid"
			order.PaidAt = &now
			order.ApprovedByUserID = &user.ID

			// Aktifkan kampanye iklan
			campaign.Status = "active"
			campaign.ApprovedByUserID = &user.ID
			campaign.ApprovedAt = &now
			campaign.StartAt = now
			campaign.EndAt = now.AddDate(0, 0, order.DurationDays)

			if err := tx.Save(&order).Error; err != nil {
				return err
			}
			return tx.Save(&campaign).Error
		}

		// Tolak pembayaran
		if req.RejectionReason == "" {
			req.RejectionReason = "Bukti transfer tidak sesuai atau belum masuk mutasi."
		}
		order.PaymentStatus = "rejected"
		order.RejectionReason = req.RejectionReason
		campaign.Status = "rejected"
		campaign.RejectionReason = req.RejectionReason

		if err := tx.Save(&order).Error; err != nil {
			return err
		}
		return tx.Save(&campaign).Error
	})

	if err != nil {
		log.Warn().Err(err).Uint64("order_id", orderID).Msg("Gagal memverifikasi pembayaran iklan")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Gagal memverifikasi pembayaran iklan."),
		})
	}

	actorID := user.ID
	var storePtr *uint
	if verifiedStoreID > 0 {
		sID := verifiedStoreID
		storePtr = &sID
	}
	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		StoreID:     storePtr,
		UserID:      &actorID,
		ActorRole:   user.PlatformRole,
		ActorName:   user.Name,
		ActorEmail:  user.Email,
		Action:      "admin.ad_payment_" + req.Action,
		Category:    "billing",
		EntityType:  "ad_order",
		EntityTitle: verifiedCampaignName,
		Description: fmt.Sprintf("Verifikasi pembayaran iklan #%d: %s.", orderID, req.Action),
		Changes: map[string]interface{}{
			"order_id":         orderID,
			"action":           req.Action,
			"rejection_reason": req.RejectionReason,
		},
		IPAddress: c.IP(),
		UserAgent: security.SanitizePlainText(c.Get("User-Agent"), 500),
	})

	return c.JSON(fiber.Map{
		"success": true,
		"message": map[bool]string{true: "Pembayaran iklan berhasil disetujui & kampanye aktif!", false: "Pesanan iklan telah ditolak."}[req.Action == "approve"],
	})
}

// -----------------------------------------------------------------------------------------
// 4. ADMIN OPS CONSOLE: OVERVIEW, SLOT PRICING, CAMPAIGN MODERATION, & PAYMENT PROOF
// -----------------------------------------------------------------------------------------

// AdminGetOverview menyajikan ringkasan performa iklan internal, daftar slot, dan daftar kampanye terpaginasi.
func (h *AdHandler) AdminGetOverview(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil || !user.IsPlatformStaff() {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses khusus staf pengelola platform.",
		})
	}

	var activeCount, pendingCount, pausedCount, totalCount int64
	_ = h.db.Model(&models.AdCampaign{}).Count(&totalCount).Error
	_ = h.db.Model(&models.AdCampaign{}).Where("status = 'active'").Count(&activeCount).Error
	_ = h.db.Model(&models.AdCampaign{}).Where("status = 'paused'").Count(&pausedCount).Error
	_ = h.db.Model(&models.AdOrder{}).Where("payment_status IN ?", []string{"pending", "pending_verification"}).Count(&pendingCount).Error

	var totalRevenuePaid float64
	_ = h.db.Model(&models.AdOrder{}).
		Select("COALESCE(SUM(final_amount), 0)").
		Where("payment_status = 'paid'").
		Scan(&totalRevenuePaid).Error

	since30d := time.Now().UTC().AddDate(0, 0, -30).Format("2006-01-02")
	type aggMetrics struct {
		Impressions uint64
		Clicks      uint64
		WaClicks    uint64
	}
	var m30 aggMetrics
	_ = h.db.Table("ad_daily_metrics").
		Select("COALESCE(SUM(impressions_count), 0) AS impressions, COALESCE(SUM(clicks_count), 0) AS clicks, COALESCE(SUM(wa_clicks_count), 0) AS wa_clicks").
		Where("date >= ?", since30d).
		Scan(&m30).Error

	var slots []models.AdSlot
	_ = h.db.Order("id ASC").Find(&slots).Error

	page := 1
	if p, err := strconv.Atoi(strings.TrimSpace(c.Query("page", "1"))); err == nil && p > 0 {
		page = p
	}
	perPage := 20
	if lp, err := strconv.Atoi(strings.TrimSpace(c.Query("per_page", "20"))); err == nil && lp > 0 {
		if lp > 100 {
			lp = 100
		}
		perPage = lp
	}

	campQuery := h.db.Model(&models.AdCampaign{})
	statusFilter := strings.ToLower(strings.TrimSpace(c.Query("status")))
	if statusFilter != "" && statusFilter != "all" {
		campQuery = campQuery.Where("status = ?", statusFilter)
	}
	if slotIDStr := strings.TrimSpace(c.Query("slot_id")); slotIDStr != "" {
		if slotID, err := strconv.ParseUint(slotIDStr, 10, 64); err == nil && slotID > 0 {
			campQuery = campQuery.Where("ad_slot_id = ?", slotID)
		}
	}
	if searchQ := strings.ToLower(security.SanitizePlainText(c.Query("q"), 100)); searchQ != "" {
		likePattern := "%" + searchQ + "%"
		campQuery = campQuery.Where(
			"LOWER(campaign_name) LIKE ? OR LOWER(campaign_code) LIKE ? OR store_id IN (SELECT id FROM stores WHERE LOWER(store_title) LIKE ? OR LOWER(slug) LIKE ?)",
			likePattern, likePattern, likePattern, likePattern,
		)
	}

	var filteredTotal int64
	_ = campQuery.Count(&filteredTotal).Error
	totalPages := int((filteredTotal + int64(perPage) - 1) / int64(perPage))
	if totalPages < 1 {
		totalPages = 1
	}
	if page > totalPages {
		page = totalPages
	}
	offset := (page - 1) * perPage

	var campaigns []models.AdCampaign
	_ = campQuery.Preload("Store").Preload("AdSlot").Preload("TargetProduct").Preload("Orders").
		Order("created_at DESC").Offset(offset).Limit(perPage).Find(&campaigns).Error

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"summary": fiber.Map{
				"active_campaigns":      activeCount,
				"pending_verifications": pendingCount,
				"paused_campaigns":      pausedCount,
				"total_campaigns":       totalCount,
				"total_revenue_paid":    totalRevenuePaid,
				"impressions_30d":       m30.Impressions,
				"clicks_30d":            m30.Clicks,
				"wa_clicks_30d":         m30.WaClicks,
			},
			"slots":     slots,
			"campaigns": campaigns,
			"pagination": fiber.Map{
				"total":       filteredTotal,
				"page":        page,
				"per_page":    perPage,
				"total_pages": totalPages,
			},
		},
	})
}

// AdminUpdateSlot memperbarui konfigurasi slot iklan internal (tarif harian, durasi minimum, batas tampil, status aktif).
func (h *AdHandler) AdminUpdateSlot(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil || !user.IsPlatformStaff() {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses khusus staf pengelola platform.",
		})
	}
	slotID, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil || slotID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "ID slot iklan tidak valid.",
		})
	}

	var req struct {
		Name                *string  `json:"name"`
		Description         *string  `json:"description"`
		DefaultRatePerDay   *float64 `json:"default_rate_per_day"`
		MinDurationDays     *int     `json:"min_duration_days"`
		MaxItemsDisplayed   *int     `json:"max_items_displayed"`
		IsActive            *bool    `json:"is_active"`
		AllowedProductTypes *string  `json:"allowed_product_types"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format pembaruan slot iklan tidak valid.",
		})
	}

	var slot models.AdSlot
	if err := h.db.Where("id = ?", slotID).First(&slot).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Slot iklan tidak ditemukan.",
		})
	}

	if req.Name != nil {
		cleanName := security.SanitizePlainText(*req.Name, 150)
		if cleanName == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "message": "Nama slot tidak boleh kosong."})
		}
		slot.Name = cleanName
	}
	if req.Description != nil {
		slot.Description = security.SanitizePlainText(*req.Description, 1000)
	}
	if req.DefaultRatePerDay != nil {
		if math.IsNaN(*req.DefaultRatePerDay) || math.IsInf(*req.DefaultRatePerDay, 0) || *req.DefaultRatePerDay < 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "message": "Tarif harian slot tidak boleh negatif."})
		}
		slot.DefaultRatePerDay = math.Round(*req.DefaultRatePerDay)
	}
	if req.MinDurationDays != nil {
		if *req.MinDurationDays < 1 || *req.MinDurationDays > 90 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "message": "Durasi minimum sewa harus antara 1 sampai 90 hari."})
		}
		slot.MinDurationDays = *req.MinDurationDays
	}
	if req.MaxItemsDisplayed != nil {
		if *req.MaxItemsDisplayed < 1 || *req.MaxItemsDisplayed > 24 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "message": "Jumlah item tampil maksimal harus antara 1 sampai 24."})
		}
		slot.MaxItemsDisplayed = *req.MaxItemsDisplayed
	}
	if req.AllowedProductTypes != nil {
		cleaned := security.SanitizePlainText(*req.AllowedProductTypes, 255)
		if cleaned == "" {
			cleaned = "all"
		}
		slot.AllowedProductTypes = cleaned
	}
	if req.IsActive != nil {
		slot.IsActive = *req.IsActive
	}

	if err := h.db.Save(&slot).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menyimpan pembaruan slot iklan.",
		})
	}

	actorID := user.ID
	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		UserID:      &actorID,
		ActorRole:   user.PlatformRole,
		ActorName:   user.Name,
		ActorEmail:  user.Email,
		Action:      "admin.ad_slot_updated",
		Category:    "superadmin",
		EntityType:  "ad_slot",
		EntityTitle: slot.Name,
		Description: fmt.Sprintf("Memperbarui konfigurasi slot iklan '%s' (Rp %.0f/hari).", slot.SlotCode, slot.DefaultRatePerDay),
		Changes: map[string]interface{}{
			"slot_id":              slot.ID,
			"default_rate_per_day": slot.DefaultRatePerDay,
			"min_duration_days":    slot.MinDurationDays,
			"max_items_displayed":  slot.MaxItemsDisplayed,
			"is_active":            slot.IsActive,
		},
		IPAddress: c.IP(),
		UserAgent: security.SanitizePlainText(c.Get("User-Agent"), 500),
	})

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Konfigurasi slot iklan berhasil diperbarui.",
		"data":    slot,
	})
}

// ModerateCampaign menghentikan sementara, mengaktifkan kembali, atau menghentikan kampanye iklan yang melanggar kebijakan.
func (h *AdHandler) ModerateCampaign(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil || !user.IsPlatformStaff() {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses khusus staf pengelola platform.",
		})
	}
	campID, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil || campID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "ID kampanye iklan tidak valid.",
		})
	}

	var req struct {
		Action string `json:"action"` // pause | resume | reject | complete
		Reason string `json:"reason"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format permintaan moderasi tidak valid.",
		})
	}
	req.Action = strings.ToLower(strings.TrimSpace(req.Action))
	req.Reason = security.SanitizePlainText(req.Reason, 1000)

	var targetStatus string
	switch req.Action {
	case "pause":
		targetStatus = "paused"
	case "resume":
		targetStatus = "active"
	case "reject":
		targetStatus = "rejected"
	case "complete":
		targetStatus = "completed"
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Aksi moderasi harus berupa 'pause', 'resume', 'reject', atau 'complete'.",
		})
	}

	var campStoreID uint
	var campName string
	txErr := h.db.Transaction(func(tx *gorm.DB) error {
		var camp models.AdCampaign
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", campID).First(&camp).Error; err != nil {
			return fmt.Errorf("kampanye tidak ditemukan: %w", err)
		}
		if req.Action == "resume" && camp.Status != "paused" {
			return fmt.Errorf("hanya kampanye berstatus 'paused' yang dapat diaktifkan kembali")
		}
		if req.Action == "pause" && camp.Status != "active" {
			return fmt.Errorf("hanya kampanye berstatus 'active' yang dapat dijeda")
		}
		camp.Status = targetStatus
		if req.Reason != "" {
			camp.RejectionReason = req.Reason
		}
		campStoreID = camp.StoreID
		campName = camp.CampaignName
		return tx.Save(&camp).Error
	})

	if txErr != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(txErr, "Gagal memoderasi status kampanye iklan."),
		})
	}

	actorID := user.ID
	var storePtr *uint
	if campStoreID > 0 {
		sID := campStoreID
		storePtr = &sID
	}
	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		StoreID:     storePtr,
		UserID:      &actorID,
		ActorRole:   user.PlatformRole,
		ActorName:   user.Name,
		ActorEmail:  user.Email,
		Action:      "admin.ad_campaign_" + req.Action,
		Category:    "moderation",
		EntityType:  "ad_campaign",
		EntityTitle: campName,
		Description: fmt.Sprintf("Moderasi kampanye #%d menjadi '%s'.", campID, targetStatus),
		Changes:     map[string]interface{}{"campaign_id": campID, "action": req.Action, "status": targetStatus, "reason": req.Reason},
		IPAddress:   c.IP(),
		UserAgent:   security.SanitizePlainText(c.Get("User-Agent"), 500),
	})

	return c.JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("Status kampanye berhasil diubah menjadi '%s'.", targetStatus),
	})
}

// AdminGetOrderProof menyajikan bukti transfer pesanan iklan secara privat dengan proteksi RBAC/kepemilikan & path confinement.
func (h *AdHandler) AdminGetOrderProof(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	orderID, err := strconv.ParseUint(c.Params("order_id"), 10, 64)
	if err != nil || orderID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "ID pesanan iklan tidak valid.",
		})
	}

	var order models.AdOrder
	if err := h.db.Where("id = ?", orderID).First(&order).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Pesanan iklan tidak ditemukan.",
		})
	}

	user, _ := c.Locals("user").(*models.User)
	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan untuk melihat bukti pembayaran.",
		})
	}

	allowed := false
	if user.IsPlatformStaff() {
		rbac := services.GetRBACService()
		allowed = user.IsSuperadmin() ||
			rbac.HasPermission(user, "finance:orders:read") ||
			rbac.HasPermission(user, "finance:orders:manage") ||
			rbac.HasPermission(user, "monetization:google:manage") ||
			rbac.HasPermission(user, "system:settings:manage")
	}
	if !allowed {
		if store, ok := c.Locals("store").(*models.Store); ok && store != nil && store.ID == order.StoreID && store.UserID == user.ID {
			allowed = true
		} else if order.UserID == user.ID {
			allowed = true
		}
	}
	if !allowed {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Anda tidak memiliki izin mengakses bukti pembayaran iklan ini.",
		})
	}

	proofURL := strings.TrimSpace(order.PaymentProofURL)
	if proofURL == "" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Bukti pembayaran belum diunggah.",
		})
	}
	if strings.HasPrefix(proofURL, "http://") || strings.HasPrefix(proofURL, "https://") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Tautan eksternal bukti pembayaran tidak diizinkan.",
		})
	}

	cleanKey := strings.TrimLeft(filepath.ToSlash(proofURL), "/")
	cleanKey = strings.TrimPrefix(cleanKey, "storage/")
	cleanKey = strings.TrimLeft(cleanKey, "/")
	if cleanKey == "" || strings.Contains(cleanKey, "..") || filepath.IsAbs(cleanKey) || strings.Contains(cleanKey, ":") || strings.Contains(cleanKey, "\\") {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Format path bukti pembayaran tidak valid.",
		})
	}

	lowerSubKey := strings.TrimPrefix(strings.ToLower(cleanKey), "private/")
	expectedPrefix := fmt.Sprintf("ad_proofs/store_%d_order_%d_", order.StoreID, order.ID)
	if !strings.HasPrefix(lowerSubKey, expectedPrefix) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Berkas bukti pembayaran tidak sesuai dengan pesanan toko.",
		})
	}

	candidateKeys := []string{cleanKey}
	if strings.HasPrefix(cleanKey, storage.PrivateKeyPrefix) {
		candidateKeys = append(candidateKeys, strings.TrimPrefix(cleanKey, storage.PrivateKeyPrefix))
	} else {
		candidateKeys = append(candidateKeys, storage.PrivateKeyPrefix+cleanKey)
	}

	setProofHeaders := func(cType string, isAttachment bool) {
		c.Set("Content-Type", cType)
		c.Set("Cache-Control", "private, max-age=3600")
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("Content-Security-Policy", "sandbox; default-src 'none'")
		if isAttachment {
			c.Set("Content-Disposition", `attachment; filename="bukti-pembayaran-iklan"`)
		} else {
			c.Set("Content-Disposition", `inline; filename="bukti-pembayaran-iklan"`)
		}
	}

	if h.storage != nil {
		for _, key := range candidateKeys {
			if strings.Contains(key, "..") || filepath.IsAbs(key) || strings.Contains(key, ":") {
				continue
			}
			rc, cType, _, gErr := h.storage.Get(c.Context(), key)
			if gErr == nil && rc != nil {
				data, readErr := io.ReadAll(io.LimitReader(rc, 12*1024*1024))
				_ = rc.Close()
				if readErr == nil && len(data) > 0 {
					safeType, forceAttachment := normalizeOrderProofContentType(cType, key, data)
					setProofHeaders(safeType, forceAttachment)
					return c.Send(data)
				}
			}
		}
	}

	localRoots := make([]string, 0, 2)
	if h.cfg != nil {
		if h.cfg.StoragePrivateRoot != "" {
			localRoots = append(localRoots, h.cfg.StoragePrivateRoot)
		}
		if h.cfg.StorageLocalRoot != "" {
			localRoots = append(localRoots, h.cfg.StorageLocalRoot)
		}
	}
	if len(localRoots) == 0 {
		localRoots = append(localRoots, filepath.Join("storage", "private"), filepath.Join("public", "storage"))
	}

	for _, root := range localRoots {
		for _, key := range candidateKeys {
			relKey := strings.TrimPrefix(key, storage.PrivateKeyPrefix)
			for _, candidateRel := range []string{relKey, key} {
				if cand, ok := resolveInsideRoot(root, candidateRel); ok && isRegularFile(cand) {
					if fi, sErr := os.Stat(cand); sErr == nil && fi.Size() > 0 && fi.Size() <= 12*1024*1024 {
						if data, rErr := os.ReadFile(cand); rErr == nil && len(data) > 0 {
							safeType, forceAttachment := normalizeOrderProofContentType("", cand, data)
							setProofHeaders(safeType, forceAttachment)
							return c.Send(data)
						}
					}
				}
			}
		}
	}

	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
		"success": false,
		"message": "Berkas bukti pembayaran iklan tidak ditemukan di penyimpanan.",
	})
}

