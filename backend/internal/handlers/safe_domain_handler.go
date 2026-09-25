package handlers

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"

	"github.com/gofiber/fiber/v2"
)

type SafeDomainHandler struct{}

func NewSafeDomainHandler() *SafeDomainHandler {
	return &SafeDomainHandler{}
}

// GetPublicSafeDomains returns active domain strings list with Redis caching for ultra-fast response
func (h *SafeDomainHandler) GetPublicSafeDomains(c *fiber.Ctx) error {
	ctx := c.Context()
	cacheKey := "public"

	// 1. Check Redis Cache
	if cached, ok := database.GetSafeDomainsCache(ctx, cacheKey); ok && cached != "" {
		var res []string
		if err := json.Unmarshal([]byte(cached), &res); err == nil {
			c.Set("X-Cache", "HIT-REDIS")
			return c.JSON(fiber.Map{
				"success": true,
				"data":    res,
			})
		}
	}

	// 2. Query Database
	var domains []models.SafeDomain
	if err := database.DB.Where("is_active = ?", true).Order("domain asc").Find(&domains).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Failed to load safe domains",
		})
	}

	res := make([]string, 0, len(domains))
	for _, d := range domains {
		clean := strings.ToLower(strings.TrimSpace(d.Domain))
		if clean != "" {
			res = append(res, clean)
		}
	}

	// 3. Save to Redis Cache (24-Hour TTL, automatically purged on write)
	if bytes, err := json.Marshal(res); err == nil {
		database.SetSafeDomainsCache(ctx, cacheKey, string(bytes), 24*time.Hour)
	}

	c.Set("X-Cache", "MISS-REDIS")
	c.Set("Cache-Control", "public, max-age=1800, stale-while-revalidate=86400")
	return c.JSON(fiber.Map{
		"success": true,
		"data":    res,
	})
}

// GetAdminSafeDomains returns paginated list with metadata for Super Admin management (with Redis Caching)
func (h *SafeDomainHandler) GetAdminSafeDomains(c *fiber.Ctx) error {
	ctx := c.Context()
	q := strings.TrimSpace(c.Query("q"))
	category := strings.TrimSpace(c.Query("category"))
	if category == "Semua" {
		category = "all"
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	if page < 1 {
		page = 1
	}

	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	if limit < 1 {
		limit = 10
	} else if limit > 100 {
		limit = 100
	}

	cacheKey := fmt.Sprintf("admin:cat=%s:q=%s:p=%d:l=%d", category, q, page, limit)

	// 1. Check Redis Cache
	if cached, ok := database.GetSafeDomainsCache(ctx, cacheKey); ok && cached != "" {
		var cachedResp fiber.Map
		if err := json.Unmarshal([]byte(cached), &cachedResp); err == nil {
			c.Set("X-Cache", "HIT-REDIS")
			return c.JSON(cachedResp)
		}
	}

	// 2. Build Base Query
	query := database.DB.Model(&models.SafeDomain{})
	if q != "" {
		searchTerm := "%" + strings.ToLower(q) + "%"
		query = query.Where("LOWER(domain) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category) LIKE ?", searchTerm, searchTerm, searchTerm)
	}
	if category != "" && category != "all" {
		query = query.Where("category = ?", category)
	}

	// Count total items
	var totalItems int64
	if err := query.Count(&totalItems).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal menghitung total data master domain",
		})
	}

	totalPages := int(math.Ceil(float64(totalItems) / float64(limit)))
	if totalPages == 0 {
		totalPages = 1
	}

	offset := (page - 1) * limit
	var domains []models.SafeDomain
	if err := query.Order("is_system desc, category asc, domain asc").Offset(offset).Limit(limit).Find(&domains).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal memuat daftar master domain",
		})
	}

	resp := fiber.Map{
		"success": true,
		"data":    domains,
		"pagination": fiber.Map{
			"page":        page,
			"limit":       limit,
			"total":       totalItems,
			"total_items": totalItems,
			"total_pages": totalPages,
			"has_next":    page < totalPages,
			"has_prev":    page > 1,
		},
	}

	// 3. Cache Result in Redis (15m TTL)
	if bytes, err := json.Marshal(resp); err == nil {
		database.SetSafeDomainsCache(ctx, cacheKey, string(bytes), 15*time.Minute)
	}

	c.Set("X-Cache", "MISS-REDIS")
	return c.JSON(resp)
}

// CreateSafeDomain adds a new domain to the master whitelist
func (h *SafeDomainHandler) CreateSafeDomain(c *fiber.Ctx) error {
	var req struct {
		Domain      string `json:"domain"`
		Category    string `json:"category"`
		Description string `json:"description"`
		IsActive    bool   `json:"is_active"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Payload tidak valid",
		})
	}

	cleanDomain := strings.ToLower(strings.TrimSpace(req.Domain))
	cleanDomain = strings.TrimPrefix(cleanDomain, "https://")
	cleanDomain = strings.TrimPrefix(cleanDomain, "http://")
	cleanDomain = strings.TrimPrefix(cleanDomain, "www.")
	if idx := strings.Index(cleanDomain, "/"); idx != -1 {
		cleanDomain = cleanDomain[:idx]
	}
	if idx := strings.Index(cleanDomain, ":"); idx != -1 {
		cleanDomain = cleanDomain[:idx]
	}

	if cleanDomain == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Nama domain tidak boleh kosong",
		})
	}

	category := strings.TrimSpace(req.Category)
	if category == "" {
		category = "Umum"
	}

	var existing models.SafeDomain
	if err := database.DB.Where("LOWER(domain) = ?", cleanDomain).First(&existing).Error; err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"success": false,
			"error":   "Domain '" + cleanDomain + "' sudah terdaftar dalam master whitelist",
		})
	}

	item := models.SafeDomain{
		Domain:      cleanDomain,
		Category:    security.SanitizePlainText(category, 100),
		Description: security.SanitizePlainText(req.Description, 500),
		IsActive:    true,
		IsSystem:    false,
		CreatedBy:   "Admin",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := database.DB.Create(&item).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal menambahkan domain",
		})
	}

	database.InvalidateSafeDomainsCache(c.Context())

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Domain berhasil ditambahkan ke whitelist",
		"data":    item,
	})
}

// UpdateSafeDomain updates domain attributes or active status
func (h *SafeDomainHandler) UpdateSafeDomain(c *fiber.Ctx) error {
	id := c.Params("id")
	var item models.SafeDomain
	if err := database.DB.First(&item, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   "Domain tidak ditemukan",
		})
	}

	var req struct {
		Domain      *string `json:"domain"`
		Category    *string `json:"category"`
		Description *string `json:"description"`
		IsActive    *bool   `json:"is_active"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Payload tidak valid",
		})
	}

	if req.Domain != nil {
		clean := strings.ToLower(strings.TrimSpace(*req.Domain))
		clean = strings.TrimPrefix(clean, "https://")
		clean = strings.TrimPrefix(clean, "http://")
		clean = strings.TrimPrefix(clean, "www.")
		if idx := strings.Index(clean, "/"); idx != -1 {
			clean = clean[:idx]
		}
		if idx := strings.Index(clean, ":"); idx != -1 {
			clean = clean[:idx]
		}
		if clean != "" {
			item.Domain = clean
		}
	}

	if req.Category != nil {
		item.Category = security.SanitizePlainText(strings.TrimSpace(*req.Category), 100)
	}
	if req.Description != nil {
		item.Description = security.SanitizePlainText(strings.TrimSpace(*req.Description), 500)
	}
	if req.IsActive != nil {
		item.IsActive = *req.IsActive
	}

	item.UpdatedAt = time.Now()
	if err := database.DB.Save(&item).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal memperbarui domain",
		})
	}

	database.InvalidateSafeDomainsCache(c.Context())

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Domain berhasil diperbarui",
		"data":    item,
	})
}

// DeleteSafeDomain removes a non-system domain
func (h *SafeDomainHandler) DeleteSafeDomain(c *fiber.Ctx) error {
	id := c.Params("id")
	var item models.SafeDomain
	if err := database.DB.First(&item, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   "Domain tidak ditemukan",
		})
	}

	if err := database.DB.Delete(&item).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal menghapus domain",
		})
	}

	database.InvalidateSafeDomainsCache(c.Context())

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Domain berhasil dihapus dari whitelist",
	})
}

// ResetDefaultSafeDomains restores original baseline domains
func (h *SafeDomainHandler) ResetDefaultSafeDomains(c *fiber.Ctx) error {
	// Re-insert missing default domains
	defaults := []models.SafeDomain{
		{Domain: "catavor.com", Category: "Platform", Description: "Platform Utama Catavor", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "catavor.id", Category: "Platform", Description: "Domain Ekosistem Catavor Indonesia", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "localhost", Category: "Platform", Description: "Localhost Development Server", IsActive: true, IsSystem: true, CreatedBy: "System"},
	}

	for _, d := range defaults {
		var existing models.SafeDomain
		if err := database.DB.Where("LOWER(domain) = ?", strings.ToLower(d.Domain)).First(&existing).Error; err != nil {
			database.DB.Create(&d)
		} else {
			// Ensure it's marked active
			existing.IsActive = true
			database.DB.Save(&existing)
		}
	}

	database.InvalidateSafeDomainsCache(c.Context())

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Master whitelist domain berhasil disinkronkan dengan default",
	})
}
