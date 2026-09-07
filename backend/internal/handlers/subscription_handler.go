package handlers

import (
	"strings"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
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
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil data kuota toko.",
			"error":   err.Error(),
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
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": err.Error(),
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
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": err.Error(),
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
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Transaksi langganan berhasil diproses dan paket Anda telah aktif.",
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
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Jadwal downgrade berhasil dibatalkan. Paket langganan Anda tetap berlanjut.",
		"data":    quota,
	})
}
