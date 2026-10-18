package handlers

import (
	"strings"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

type SubscriptionHandler struct{}

func NewSubscriptionHandler() *SubscriptionHandler {
	return &SubscriptionHandler{}
}

// GetPlans returns all active subscription tiers (Free, Pro Starter, Pro Bisnis)
func (h *SubscriptionHandler) GetPlans(c *fiber.Ctx) error {
	plans, err := services.GetSubscriptionPlans(database.DB)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat paket langganan.",
		})
	}

	c.Set("Cache-Control", "public, max-age=600, stale-while-revalidate=86400")
	return c.JSON(fiber.Map{
		"success": true,
		"data":    plans,
	})
}

// GetStoreQuota returns current quota usage, limits, and plan details for the logged-in store
func (h *SubscriptionHandler) GetStoreQuota(c *fiber.Ctx) error {
	storeIDVal := c.Locals("store_id")
	if storeIDVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi toko diperlukan.",
		})
	}
	storeID := storeIDVal.(uint)

	quota, err := services.GetStoreQuotaInfo(database.DB, storeID)
	if err != nil {
		log.Error().Err(err).Msg("subscription: gagal mengambil kuota toko")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil data kuota toko.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    quota,
	})
}

// UpgradePlan handles instant upgrade or renewal of store plan
func (h *SubscriptionHandler) UpgradePlan(c *fiber.Ctx) error {
	storeIDVal := c.Locals("store_id")
	if storeIDVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi toko diperlukan.",
		})
	}
	storeID := storeIDVal.(uint)

	// Security Defense: Restrict direct plan upgrade to Platform Admins / Superadmins
	userRole, _ := c.Locals("platform_role").(string)
	isSuperadmin, _ := c.Locals("is_superadmin").(bool)
	if userRole != "admin" && userRole != "superadmin" && !isSuperadmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Peningkatan paket langsung hanya dapat dilakukan oleh administrator platform. Silakan gunakan alur checkout pesanan langganan.",
		})
	}

	var req struct {
		PlanCode string `json:"plan_code"`
		Months   int    `json:"months"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Payload permintaan tidak valid.",
		})
	}

	planCode := strings.ToLower(strings.TrimSpace(req.PlanCode))
	if planCode == "" {
		planCode = "pro_starter"
	}
	if req.Months <= 0 {
		req.Months = 1
	}

	quota, err := services.UpgradeStorePlan(database.DB, storeID, planCode, req.Months)
	if err != nil {
		log.Error().Err(err).Msg("subscription: UpgradeStorePlan gagal")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Gagal meningkatkan paket langganan."),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Paket langganan berhasil diperbarui.",
		"data":    quota,
	})
}

// ScheduleDowngrade schedules a downgrade at the end of the billing cycle
func (h *SubscriptionHandler) ScheduleDowngrade(c *fiber.Ctx) error {
	storeIDVal := c.Locals("store_id")
	if storeIDVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi toko diperlukan.",
		})
	}
	storeID := storeIDVal.(uint)

	var req struct {
		TargetPlanCode string `json:"target_plan_code"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Payload tidak valid.",
		})
	}

	targetCode := strings.ToLower(strings.TrimSpace(req.TargetPlanCode))
	if targetCode == "" {
		targetCode = "free"
	}

	quota, err := services.ScheduleStoreDowngrade(database.DB, storeID, targetCode)
	if err != nil {
		log.Error().Err(err).Msg("subscription: ScheduleStoreDowngrade gagal")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Gagal menjadwalkan penurunan paket."),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Perubahan paket berhasil dijadwalkan pada akhir periode langganan saat ini.",
		"data":    quota,
	})
}

// UpdateCustomDomain sets or verifies custom domain for Pro Business stores
func (h *SubscriptionHandler) UpdateCustomDomain(c *fiber.Ctx) error {
	storeIDVal := c.Locals("store_id")
	if storeIDVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi toko diperlukan.",
		})
	}
	storeID := storeIDVal.(uint)

	var store models.Store
	if err := database.DB.First(&store, storeID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Toko tidak ditemukan.",
		})
	}

	plan, _ := services.GetPlanByCode(database.DB, store.Plan)
	if plan == nil || !plan.HasCustomDomain {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Fitur Custom Domain hanya tersedia untuk paket Pro Bisnis. Silakan upgrade paket Anda.",
		})
	}

	var req struct {
		CustomDomain string `json:"custom_domain"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Payload tidak valid.",
		})
	}

	domain := strings.ToLower(strings.TrimSpace(req.CustomDomain))
	domain = strings.TrimPrefix(domain, "https://")
	domain = strings.TrimPrefix(domain, "http://")
	domain = strings.TrimRight(domain, "/")

	if domain == "" {
		store.CustomDomain = nil
		store.CustomDomainStatus = "none"
	} else {
		var existing models.Store
		if err := database.DB.Where("custom_domain = ? AND id != ?", domain, storeID).First(&existing).Error; err == nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Domain ini sudah digunakan oleh toko lain.",
			})
		}
		store.CustomDomain = &domain
		store.CustomDomainStatus = "active"
	}

	if err := database.DB.Save(&store).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui custom domain.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Pengaturan custom domain berhasil disimpan.",
		"data": fiber.Map{
			"custom_domain":        store.CustomDomain,
			"custom_domain_status": store.CustomDomainStatus,
		},
	})
}

// CreateOrder handles creating a new subscription invoice, processing payment/coupon, and activating plan
func (h *SubscriptionHandler) CreateOrder(c *fiber.Ctx) error {
	storeIDVal := c.Locals("store_id")
	userIDVal := c.Locals("user_id")
	if storeIDVal == nil || userIDVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi toko diperlukan.",
		})
	}
	storeID := storeIDVal.(uint)
	userID := userIDVal.(uint)

	var req services.CreateOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data pesanan tidak valid.",
		})
	}

	order, quota, err := services.CreateSubscriptionOrder(database.DB, storeID, userID, req)
	if err != nil {
		log.Error().Err(err).Msg("subscription: CreateSubscriptionOrder gagal")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Gagal membuat pesanan langganan."),
		})
	}

	msg := "Transaksi langganan berhasil diproses dan paket Anda telah aktif."
	if order.PaymentStatus != "paid" {
		msg = "Pesanan langganan berhasil dibuat. Silakan selesaikan pembayaran agar paket dapat diverifikasi dan diaktifkan."
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": msg,
		"order":   order,
		"quota":   quota,
	})
}

// GetOrders returns subscription invoice history for the authenticated store
func (h *SubscriptionHandler) GetOrders(c *fiber.Ctx) error {
	storeIDVal := c.Locals("store_id")
	if storeIDVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi toko diperlukan.",
		})
	}
	storeID := storeIDVal.(uint)

	orders, err := services.GetStoreSubscriptionOrders(database.DB, storeID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat riwayat transaksi langganan.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    orders,
	})
}

// CancelDowngrade cancels any scheduled downgrade for the authenticated store
func (h *SubscriptionHandler) CancelDowngrade(c *fiber.Ctx) error {
	storeIDVal := c.Locals("store_id")
	if storeIDVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi toko diperlukan.",
		})
	}
	storeID := storeIDVal.(uint)

	quota, err := services.CancelStoreDowngrade(database.DB, storeID)
	if err != nil {
		log.Error().Err(err).Msg("subscription: CancelStoreDowngrade gagal")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Gagal membatalkan penurunan paket."),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Jadwal downgrade berhasil dibatalkan. Paket langganan Anda tetap berlanjut.",
		"data":    quota,
	})
}

// ApproveOrder allows platform admin to verify payment and activate subscription plan
func (h *SubscriptionHandler) ApproveOrder(c *fiber.Ctx) error {
	orderIDVal, err := c.ParamsInt("id")
	if err != nil || orderIDVal <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "ID pesanan langganan tidak valid.",
		})
	}

	adminIDVal := c.Locals("user_id")
	var adminID uint = 0
	if adminIDVal != nil {
		adminID = adminIDVal.(uint)
	}

	order, quota, err := services.ApproveSubscriptionOrder(database.DB, uint(orderIDVal), adminID)
	if err != nil {
		log.Error().Err(err).Msg("subscription: ApproveSubscriptionOrder gagal")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Gagal menyetujui pesanan langganan."),
		})
	}

	// SECURITY (N-20): persetujuan invoice mengaktifkan paket berbayar tanpa
	// verifikasi pembayaran otomatis, sehingga aksi ini WAJIB meninggalkan
	// jejak siapa pelakunya. Sebelumnya hanya tercatat di stdout (zerolog)
	// yang hilang saat rotasi log, sementara aksi katalog biasa sudah masuk
	// activity_logs. Catat agar penyalahgunaan wewenang finance dapat ditelusuri.
	adminEmail, _ := c.Locals("email").(string)
	catatAktivitasApprove(c, "billing.subscription_approve", "Invoice langganan disetujui",
		order, adminID, adminEmail)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Invoice langganan berhasil disetujui dan paket toko telah aktif.",
		"order":   order,
		"quota":   quota,
	})
}

// catatAktivitasApprove menulis entri audit untuk persetujuan invoice
// langganan. Dipisah agar dapat diuji dan agar kegagalan pencatatan tidak
// membatalkan aksi yang sudah terjadi.
func catatAktivitasApprove(c *fiber.Ctx, action, deskripsi string,
	order *models.SubscriptionOrder, adminID uint, adminEmail string) {
	if order == nil {
		return
	}
	storeID := order.StoreID
	entityID := order.ID
	actorID := adminID
	services.RecordActivity(services.RecordActivityParams{
		DB:          database.DB,
		StoreID:     &storeID,
		UserID:      &actorID,
		ActorRole:   "superadmin",
		ActorEmail:  adminEmail,
		Action:      action,
		Category:    "billing",
		EntityType:  "plan",
		EntityID:    &entityID,
		EntityTitle: order.OrderNumber,
		Description: deskripsi,
		Changes: map[string]interface{}{
			"plan_code":      order.PlanCode,
			"duration_month": order.DurationMonths,
			"payment_status": order.PaymentStatus,
			"approved_by":    adminID,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})
}

// AdminListOrders allows platform admin to view all subscription orders
func (h *SubscriptionHandler) AdminListOrders(c *fiber.Ctx) error {
	var orders []models.SubscriptionOrder
	query := database.DB.Preload("Store").Preload("User").Order("created_at desc")
	if status := c.Query("status"); status != "" {
		query = query.Where("payment_status = ?", status)
	}
	if err := query.Find(&orders).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat daftar transaksi langganan.",
		})
	}
	return c.JSON(fiber.Map{
		"success": true,
		"data":    orders,
	})
}
