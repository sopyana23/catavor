package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"

	"github.com/gofiber/fiber/v2"
)

type CategoryHandler struct{}

func NewCategoryHandler() *CategoryHandler {
	return &CategoryHandler{}
}

func slugifyCategory(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	reg := regexp.MustCompile(`[^a-z0-9\-]+`)
	s = reg.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

// InvalidateStoreCategoriesCache purges cached category queries and store profile for a specific store.
func InvalidateStoreCategoriesCache(storeID uint) {
	if database.IsRedisAvailable() && database.RedisClient != nil && storeID > 0 {
		ctx := context.Background()
		pattern := fmt.Sprintf("catavor:store:%d:categories:*", storeID)
		iter := database.RedisClient.Scan(ctx, 0, pattern, 0).Iterator()
		for iter.Next(ctx) {
			_ = database.RedisClient.Del(ctx, iter.Val()).Err()
		}
		var store models.Store
		if err := database.DB.Select("slug").Where("id = ?", storeID).First(&store).Error; err == nil && store.Slug != "" {
			_ = database.RedisClient.Del(ctx, fmt.Sprintf("catavor:store:%s:profile", strings.ToLower(store.Slug))).Err()
		}
	}
}

// Index returns all categories for the authenticated store or requested store slug.
func (h *CategoryHandler) Index(c *fiber.Ctx) error {
	var storeID uint

	if storeVal, ok := c.Locals("store").(*models.Store); ok && storeVal != nil {
		storeID = storeVal.ID
	} else if slug := c.Params("slug"); slug != "" {
		cleanSlug := strings.ToLower(strings.TrimSpace(slug))
		var blacklistedCount int64
		database.DB.Model(&models.BlacklistedSlug{}).Where("LOWER(slug) = ?", cleanSlug).Count(&blacklistedCount)
		if blacklistedCount > 0 {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"code":    "STORE_BANNED",
				"message": "Katalog toko telah dinonaktifkan secara permanen.",
			})
		}
		var store models.Store
		if err := database.DB.Where("LOWER(slug) = ?", cleanSlug).First(&store).Error; err != nil || store.DormancyStatus == "banned" || store.DormancyStatus == "purged" || store.IsBlacklisted {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"code":    "STORE_BANNED",
				"message": "Toko tidak ditemukan.",
			})
		}
		storeID = store.ID
	}

	if storeID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Store ID atau slug toko wajib disertakan.",
		})
	}

	pType := strings.ToLower(strings.TrimSpace(c.Query("product_type")))
	cacheKey := fmt.Sprintf("catavor:store:%d:categories:%s", storeID, pType)

	// 1. Try Redis cache
	if database.IsRedisAvailable() && database.RedisClient != nil {
		if cachedVal, err := database.RedisClient.Get(context.Background(), cacheKey).Result(); err == nil && cachedVal != "" {
			var cachedRes fiber.Map
			if err := json.Unmarshal([]byte(cachedVal), &cachedRes); err == nil {
				c.Set("X-Cache", "HIT")
				return c.JSON(cachedRes)
			}
		}
	}

	var categories []models.Category
	query := database.DB.Where("store_id = ?", storeID)

	if pType != "" {
		query = query.Where("product_type = ?", pType)
	}

	if err := query.Order("sort_order ASC, id ASC").Find(&categories).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil data kategori.",
		})
	}

	responsePayload := fiber.Map{
		"success": true,
		"data":    categories,
	}

	// 2. Cache in Redis (TTL: 300s)
	if database.IsRedisAvailable() && database.RedisClient != nil {
		if bytes, err := json.Marshal(responsePayload); err == nil {
			_ = database.RedisClient.Set(context.Background(), cacheKey, string(bytes), 300*time.Second).Err()
		}
	}

	c.Set("X-Cache", "MISS")
	return c.JSON(responsePayload)
}

// Store creates a new category for the authenticated store.
func (h *CategoryHandler) Store(c *fiber.Ctx) error {
	store, ok := c.Locals("store").(*models.Store)
	if !ok || store == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses ditolak: Anda harus memiliki toko aktif.",
		})
	}

	var req struct {
		Name        string `json:"name"`
		ProductType string `json:"product_type"`
		SortOrder   int    `json:"sort_order"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	name := security.SanitizePlainText(req.Name, 100)
	if name == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Nama kategori wajib diisi.",
		})
	}

	slug := slugifyCategory(name)
	if slug == "" {
		slug = "kategori"
	}

	pType := strings.ToLower(strings.TrimSpace(req.ProductType))
	if pType == "" {
		pType = "physical"
	}

	category := models.Category{
		StoreID:     store.ID,
		Name:        name,
		Slug:        slug,
		ProductType: pType,
		SortOrder:   req.SortOrder,
		IsActive:    true,
	}

	if err := database.DB.Create(&category).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menambahkan kategori baru.",
		})
	}

	InvalidateStoreCategoriesCache(store.ID)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Kategori berhasil ditambahkan.",
		"data":    category,
	})
}

// Update modifies an existing category.
func (h *CategoryHandler) Update(c *fiber.Ctx) error {
	store, ok := c.Locals("store").(*models.Store)
	if !ok || store == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses ditolak.",
		})
	}

	id := c.Params("id")
	var category models.Category
	if err := database.DB.Where("id = ? AND store_id = ?", id, store.ID).First(&category).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Kategori tidak ditemukan.",
		})
	}

	var req struct {
		Name      string `json:"name"`
		SortOrder *int   `json:"sort_order"`
		IsActive  *bool  `json:"is_active"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	if req.Name != "" {
		category.Name = security.SanitizePlainText(req.Name, 100)
		category.Slug = slugifyCategory(category.Name)
	}
	if req.SortOrder != nil {
		category.SortOrder = *req.SortOrder
	}
	if req.IsActive != nil {
		category.IsActive = *req.IsActive
	}

	if err := database.DB.Save(&category).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui kategori.",
		})
	}

	InvalidateStoreCategoriesCache(store.ID)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Kategori berhasil diperbarui.",
		"data":    category,
	})
}

// Destroy deletes a category safely.
func (h *CategoryHandler) Destroy(c *fiber.Ctx) error {
	store, ok := c.Locals("store").(*models.Store)
	if !ok || store == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses ditolak.",
		})
	}

	id := c.Params("id")
	var category models.Category
	if err := database.DB.Where("id = ? AND store_id = ?", id, store.ID).First(&category).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Kategori tidak ditemukan.",
		})
	}

	// Detach products linked to this category
	_ = database.DB.Model(&models.Product{}).Where("category_id = ?", category.ID).Update("category_id", nil).Error

	if err := database.DB.Delete(&category).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghapus kategori.",
		})
	}

	InvalidateStoreCategoriesCache(store.ID)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Kategori berhasil dihapus.",
	})
}
