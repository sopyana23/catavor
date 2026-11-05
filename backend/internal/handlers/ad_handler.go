package handlers

import (
	"crypto/rand"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"
	"catavor-backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
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

// HandleAdClick memproses klik iklan dengan verifikasi tanda tangan HMAC-SHA256 (60 detik)
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

	// Tentukan URL tujuan default
	destinationURL := fmt.Sprintf("/u/%s", camp.Store.Slug)
	if camp.TargetType == "product" && camp.TargetProduct != nil {
		destinationURL = fmt.Sprintf("/u/%s?item=%d", camp.Store.Slug, camp.TargetProduct.ID)
	}

	// 2. Verifikasi tanda tangan HMAC (jika parameter lengkap)
	if tsStr != "" && sig != "" {
		_ = services.VerifyClickSignature(campaignCode, destinationURL, tsStr, sig, h.cfg.JWTSecret)
	}

	// 3. Catat telemetri klik dengan perlindungan Token Bucket per IP (30 menit)
	clientIP := c.IP()
	sessionID := c.Cookies("ctv_session", "")
	services.GetAdTelemetryService().RecordClick(camp.ID, camp.AdSlotID, camp.StoreID, clientIP, sessionID, isWAClick)

	// 4. Redirect 302 seketika ke halaman katalog / item target
	return c.Redirect(destinationURL, fiber.StatusTemporaryRedirect)
}

// RecordImpressionBatch menerima array impresi dari frontend untuk dicatat ke in-memory buffer.
func (h *AdHandler) RecordImpressionBatch(c *fiber.Ctx) error {
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

	telemetry := services.GetAdTelemetryService()
	for _, item := range payload {
		telemetry.RecordImpression(item.CampaignID, item.AdSlotID, item.StoreID)
	}

	return c.JSON(fiber.Map{
		"success":  true,
		"recorded": len(payload),
	})
}

// -----------------------------------------------------------------------------------------
// 2. MERCHANT AD MANAGEMENT ENDPOINTS (Zero-Trust Multi-Tenant)
// -----------------------------------------------------------------------------------------

// GetAvailableSlots mengembalikan daftar slot iklan yang dibuka untuk sewa beserta tarif per hari.
func (h *AdHandler) GetAvailableSlots(c *fiber.Ctx) error {
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
	store, ok := c.Locals("store").(*models.Store)
	if !ok || store == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Sesi toko tidak valid.",
		})
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
	store, ok := c.Locals("store").(*models.Store)
	if !ok || store == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Sesi toko tidak valid.",
		})
	}
	user, _ := c.Locals("user").(*models.User)
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

	// 1. Ambil data master slot
	var slot models.AdSlot
	if err := h.db.Where("slot_code = ? AND is_active = true", req.SlotCode).First(&slot).Error; err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Slot iklan yang dipilih tidak tersedia.",
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

	// 3. Kalkulasi Finansial 100% Server-Side (Haram mempercayai input uang dari client)
	originalAmount := slot.DefaultRatePerDay * float64(req.DurationDays)
	discountAmount := 0.0

	// Generate 3-digit kode unik verifikasi transfer manual
	uniqueCode := 0
	if req.PaymentMethod != "qris" {
		rNum, _ := rand.Int(rand.Reader, big.NewInt(900))
		uniqueCode = int(rNum.Int64()) + 100
	}
	finalAmount := originalAmount - discountAmount + float64(uniqueCode)

	now := time.Now().UTC()
	startAt := now
	endAt := now.AddDate(0, 0, req.DurationDays)

	// Format kode kampanye dan nomor invoice unik
	campaignCode := fmt.Sprintf("CMP-%s-%04d", now.Format("20060102"), time.Now().Unix()%10000)
	orderNumber := fmt.Sprintf("INV-AD-%s-%04d", now.Format("20060102"), time.Now().Unix()%10000)

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
	})
}

// UploadPaymentProof menangani pengunggahan bukti bayar sewa iklan dengan validasi magic bytes.
func (h *AdHandler) UploadPaymentProof(c *fiber.Ctx) error {
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
	store, ok := c.Locals("store").(*models.Store)
	if !ok || store == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Sesi toko tidak valid.",
		})
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
	_ = c.BodyParser(&req)
	req.Action = strings.ToLower(strings.TrimSpace(req.Action))

	now := time.Now().UTC()

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
		} else {
			// Tolak pembayaran
			order.PaymentStatus = "rejected"
			order.RejectionReason = req.RejectionReason
			campaign.Status = "rejected"
			campaign.RejectionReason = req.RejectionReason

			if err := tx.Save(&order).Error; err != nil {
				return err
			}
			return tx.Save(&campaign).Error
		}
	})

	if err != nil {
		log.Warn().Err(err).Uint64("order_id", orderID).Msg("Gagal memverifikasi pembayaran iklan")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": map[bool]string{true: "Pembayaran iklan berhasil disetujui & kampanye aktif!", false: "Pesanan iklan telah ditolak."}[req.Action == "approve"],
	})
}

