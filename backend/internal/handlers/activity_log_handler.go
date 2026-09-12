package handlers

import (
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type ActivityLogHandler struct {
	db *gorm.DB
}

func NewActivityLogHandler(db *gorm.DB) *ActivityLogHandler {
	return &ActivityLogHandler{db: db}
}

// GetStoreActivityLogs returns paginated activity logs for the merchant's active store.
func (h *ActivityLogHandler) GetStoreActivityLogs(c *fiber.Ctx) error {
	userVal := c.Locals("user")
	if userVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}
	user := userVal.(*models.User)

	// Identify active store for the user
	storeVal := c.Locals("store")
	var storeID uint
	if storeVal != nil {
		storeID = storeVal.(*models.Store).ID
	} else {
		var store models.Store
		if err := h.db.Where("user_id = ?", user.ID).Order("id asc").First(&store).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"message": "Toko tidak ditemukan.",
			})
		}
		storeID = store.ID
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.Query("limit", "15"))
	if limit < 1 || limit > 50 {
		limit = 15
	}
	offset := (page - 1) * limit

	category := strings.TrimSpace(strings.ToLower(c.Query("category", "all")))
	searchQuery := strings.TrimSpace(c.Query("q", ""))

	query := h.db.Model(&models.ActivityLog{}).Where("store_id = ?", storeID)

	if category != "" && category != "all" {
		query = query.Where("category = ?", category)
	}

	if searchQuery != "" {
		likePattern := "%" + searchQuery + "%"
		query = query.Where("(description ILIKE ? OR entity_title ILIKE ? OR actor_name ILIKE ? OR action ILIKE ?)",
			likePattern, likePattern, likePattern, likePattern)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghitung total log aktivitas.",
		})
	}

	var logs []models.ActivityLog
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&logs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat log aktivitas toko.",
		})
	}

	hasMore := int64(offset+len(logs)) < total

	return c.JSON(fiber.Map{
		"success":  true,
		"data":     logs,
		"page":     page,
		"limit":    limit,
		"total":    total,
		"has_more": hasMore,
	})
}

// GetSuperadminAuditLogs returns system-wide audit logs across all stores (Superadmin only).
func (h *ActivityLogHandler) GetSuperadminAuditLogs(c *fiber.Ctx) error {
	userVal := c.Locals("user")
	if userVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}
	user := userVal.(*models.User)

	// RBAC Permission Check
	if !services.GetRBACService().HasPermission(user, "audit:logs:read") {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "FORBIDDEN_PERMISSION_REQUIRED",
			"message": "Akses ditolak: Anda memerlukan izin 'audit:logs:read' untuk melihat System Audit Trail.",
		})
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	role := strings.TrimSpace(strings.ToLower(c.Query("role", "all")))
	category := strings.TrimSpace(strings.ToLower(c.Query("category", "all")))
	searchQuery := strings.TrimSpace(c.Query("q", ""))
	storeIDParam := strings.TrimSpace(c.Query("store_id", ""))

	query := h.db.Model(&models.ActivityLog{})

	if storeIDParam != "" && storeIDParam != "all" {
		if sID, err := strconv.ParseUint(storeIDParam, 10, 64); err == nil {
			query = query.Where("store_id = ?", sID)
		}
	}

	if role != "" && role != "all" {
		query = query.Where("actor_role = ?", role)
	}

	if category != "" && category != "all" {
		query = query.Where("category = ?", category)
	}

	if searchQuery != "" {
		likePattern := "%" + searchQuery + "%"
		query = query.Where("(description ILIKE ? OR entity_title ILIKE ? OR actor_name ILIKE ? OR actor_email ILIKE ? OR action ILIKE ?)",
			likePattern, likePattern, likePattern, likePattern, likePattern)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghitung total system audit logs.",
		})
	}

	var logs []models.ActivityLog
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&logs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat system audit logs.",
		})
	}

	hasMore := int64(offset+len(logs)) < total

	return c.JSON(fiber.Map{
		"success":  true,
		"data":     logs,
		"page":     page,
		"limit":    limit,
		"total":    total,
		"has_more": hasMore,
	})
}

// GetActivitySummary returns activity counts by category for the last 30 days.
func (h *ActivityLogHandler) GetActivitySummary(c *fiber.Ctx) error {
	userVal := c.Locals("user")
	if userVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}
	user := userVal.(*models.User)

	storeVal := c.Locals("store")
	var storeID uint
	if storeVal != nil {
		storeID = storeVal.(*models.Store).ID
	} else {
		var store models.Store
		if err := h.db.Where("user_id = ?", user.ID).Order("id asc").First(&store).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"message": "Toko tidak ditemukan.",
			})
		}
		storeID = store.ID
	}

	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)

	type CategoryCount struct {
		Category string `json:"category"`
		Count    int64  `json:"count"`
	}

	var counts []CategoryCount
	h.db.Model(&models.ActivityLog{}).
		Select("category, count(*) as count").
		Where("store_id = ? AND created_at >= ?", storeID, thirtyDaysAgo).
		Group("category").
		Scan(&counts)

	summary := map[string]int64{
		"security": 0,
		"catalog":  0,
		"store":    0,
		"billing":  0,
		"total":    0,
	}

	for _, c := range counts {
		summary[c.Category] = c.Count
		summary["total"] += c.Count
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    summary,
	})
}
