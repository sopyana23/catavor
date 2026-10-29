package handlers

import (
	"bytes"
	"fmt"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

type CatalogExportHandler struct {
	cfg *config.Config
	db  *gorm.DB
}

func NewCatalogExportHandler(cfg *config.Config, db *gorm.DB) *CatalogExportHandler {
	return &CatalogExportHandler{cfg: cfg, db: db}
}

// resolveStore defensively resolves the active store from locals, headers, query params, or user ownership
func (h *CatalogExportHandler) resolveStore(c *fiber.Ctx, user *models.User, store *models.Store) *models.Store {
	if store != nil {
		return store
	}
	if user == nil {
		return nil
	}

	targetSlug := strings.TrimSpace(c.Get("X-Store-Slug"))
	if targetSlug == "" {
		targetSlug = strings.TrimSpace(c.Query("slug"))
	}
	targetID := strings.TrimSpace(c.Query("store_id"))

	var dbStore models.Store
	if targetID != "" {
		if user.IsPlatformStaff() {
			_ = h.db.Where("id = ?", targetID).First(&dbStore).Error
		} else {
			_ = h.db.Where("id = ? AND user_id = ?", targetID, user.ID).First(&dbStore).Error
		}
	} else if targetSlug != "" {
		if user.IsPlatformStaff() {
			_ = h.db.Where("LOWER(slug) = ?", strings.ToLower(targetSlug)).First(&dbStore).Error
		} else {
			_ = h.db.Where("LOWER(slug) = ? AND user_id = ?", strings.ToLower(targetSlug), user.ID).First(&dbStore).Error
		}
	}

	if dbStore.ID > 0 {
		return &dbStore
	} else if len(user.Stores) > 0 {
		return &user.Stores[0]
	} else if user.Store != nil {
		return user.Store
	}
	return nil
}

// ExportProducts handles dedicated catalog items export (CSV & JSON items only, without store backup metadata)
func (h *CatalogExportHandler) ExportProducts(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	user, _ := c.Locals("user").(*models.User)
	initialStore, _ := c.Locals("store").(*models.Store)
	store := h.resolveStore(c, user, initialStore)

	if store == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses ditolak: Profil katalog tidak ditemukan.",
		})
	}

	format := strings.ToLower(strings.TrimSpace(c.Query("format", "csv")))
	if format != "json" && format != "csv" {
		format = "csv"
	}

	query := h.db.Preload("Category").
		Preload("Images", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC, id ASC")
		}).
		Preload("Variants", func(db *gorm.DB) *gorm.DB {
			return db.Order("id ASC")
		}).
		Where("store_id = ?", store.ID)

	statusFilter := strings.ToLower(strings.TrimSpace(c.Query("status", "all")))
	if statusFilter == "active" {
		query = query.Where("is_active = ? AND archived_at IS NULL", true)
	} else if statusFilter == "draft" {
		query = query.Where("is_active = ? AND archived_at IS NULL", false)
	} else if statusFilter == "archived" {
		query = query.Where("archived_at IS NOT NULL")
	}

	var products []models.Product
	if err := query.Order("id ASC").Find(&products).Error; err != nil {
		log.Error().Err(err).Uint("store_id", store.ID).Msg("export_products: gagal mengambil data item produk")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil data item produk katalog.",
		})
	}

	dateStr := time.Now().Format("20060102-1504")
	var buf bytes.Buffer

	// Log activity audit
	if user != nil {
		actorRole := "merchant"
		if user.IsPlatformStaff() {
			actorRole = string(user.PlatformRole)
		}
		go func(sID uint, uID uint, uName, uEmail, role, fmtChoice string, count int, ip, ua string) {
			act := "catalog.export_products_csv"
			if fmtChoice == "json" {
				act = "catalog.export_products_json"
			}
			services.RecordActivity(services.RecordActivityParams{
				DB:          h.db,
				StoreID:     &sID,
				UserID:      &uID,
				ActorRole:   role,
				ActorName:   uName,
				ActorEmail:  uEmail,
				Action:      act,
				Category:    "catalog",
				EntityType:  "store",
				EntityID:    &sID,
				Description: fmt.Sprintf("Mengekspor %d item katalog produk dalam format %s", count, strings.ToUpper(fmtChoice)),
				IPAddress:   ip,
				UserAgent:   ua,
			})
		}(store.ID, user.ID, user.Name, user.Email, actorRole, format, len(products), c.IP(), c.Get("User-Agent"))
	}

	if format == "json" {
		if err := services.ExportProductsJSON(&buf, store, products); err != nil {
			log.Error().Err(err).Msg("export_products: gagal membuat JSON data item katalog")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal memproses data item katalog JSON.",
			})
		}
		c.Set("Content-Type", "application/json; charset=utf-8")
		c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"katalog-items-%s-%s.json\"", store.Slug, dateStr))
		c.Set("Cache-Control", "no-store, no-cache, must-revalidate")
		c.Set("Pragma", "no-cache")
		return c.Send(buf.Bytes())
	}

	// Default: CSV
	if err := services.ExportCatalogCSV(&buf, store, products); err != nil {
		log.Error().Err(err).Msg("export_products: gagal membuat berkas CSV item katalog")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memproses berkas CSV item katalog.",
		})
	}
	c.Set("Content-Type", "text/csv; charset=utf-8")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"katalog-items-%s-%s.csv\"", store.Slug, dateStr))
	c.Set("Cache-Control", "no-store, no-cache, must-revalidate")
	c.Set("Pragma", "no-cache")
	return c.Send(buf.Bytes())
}

// ExportCatalog handles authenticated catalog export in CSV or JSON format (Full Store Backup or Items delegation)
func (h *CatalogExportHandler) ExportCatalog(c *fiber.Ctx) error {
	// If explicitly requested items-only scope, delegate to ExportProducts
	scope := strings.ToLower(strings.TrimSpace(c.Query("scope", "")))
	exportType := strings.ToLower(strings.TrimSpace(c.Query("type", "")))
	if scope == "items" || scope == "products" || exportType == "items" || exportType == "products" {
		return h.ExportProducts(c)
	}

	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	user, _ := c.Locals("user").(*models.User)
	initialStore, _ := c.Locals("store").(*models.Store)
	store := h.resolveStore(c, user, initialStore)

	if store == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses ditolak: Profil katalog tidak ditemukan.",
		})
	}

	format := strings.ToLower(strings.TrimSpace(c.Query("format", "csv")))
	if format != "json" && format != "csv" {
		format = "csv"
	}

	// 1. Fetch categories
	var categories []models.Category
	if err := h.db.Where("store_id = ?", store.ID).Order("sort_order ASC, name ASC").Find(&categories).Error; err != nil {
		log.Warn().Err(err).Uint("store_id", store.ID).Msg("export: gagal mengambil master categories")
	}

	// 2. Fetch products with relations (including draft/archived unless filtered)
	query := h.db.Preload("Category").
		Preload("Images", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC, id ASC")
		}).
		Preload("Variants", func(db *gorm.DB) *gorm.DB {
			return db.Order("id ASC")
		}).
		Where("store_id = ?", store.ID)

	statusFilter := strings.ToLower(strings.TrimSpace(c.Query("status", "all")))
	if statusFilter == "active" {
		query = query.Where("is_active = ? AND archived_at IS NULL", true)
	} else if statusFilter == "draft" {
		query = query.Where("is_active = ? AND archived_at IS NULL", false)
	} else if statusFilter == "archived" {
		query = query.Where("archived_at IS NOT NULL")
	}

	var products []models.Product
	if err := query.Order("id ASC").Find(&products).Error; err != nil {
		log.Error().Err(err).Uint("store_id", store.ID).Msg("export: gagal mengambil data produk")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil data produk katalog.",
		})
	}

	dateStr := time.Now().Format("20060102-1504")
	var buf bytes.Buffer

	// 3. Log activity audit
	if user != nil {
		actorRole := "merchant"
		if user.IsPlatformStaff() {
			actorRole = string(user.PlatformRole)
		}
		go func(sID uint, uID uint, uName, uEmail, role, fmtChoice string, count int, ip, ua string) {
			act := "catalog.export_csv"
			if fmtChoice == "json" {
				act = "catalog.export_json"
			}
			services.RecordActivity(services.RecordActivityParams{
				DB:          h.db,
				StoreID:     &sID,
				UserID:      &uID,
				ActorRole:   role,
				ActorName:   uName,
				ActorEmail:  uEmail,
				Action:      act,
				Category:    "catalog",
				EntityType:  "store",
				EntityID:    &sID,
				Description: fmt.Sprintf("Mengekspor cadangan %d produk katalog dalam format %s", count, strings.ToUpper(fmtChoice)),
				IPAddress:   ip,
				UserAgent:   ua,
			})
		}(store.ID, user.ID, user.Name, user.Email, actorRole, format, len(products), c.IP(), c.Get("User-Agent"))
	}

	// 4. Generate Export
	if format == "json" {
		if err := services.ExportCatalogJSON(&buf, store, categories, products); err != nil {
			log.Error().Err(err).Msg("export: gagal membuat JSON backup")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal memproses data arsip JSON.",
			})
		}
		c.Set("Content-Type", "application/json; charset=utf-8")
		c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"katalog-%s-%s.json\"", store.Slug, dateStr))
		c.Set("Cache-Control", "no-store, no-cache, must-revalidate")
		c.Set("Pragma", "no-cache")
		return c.Send(buf.Bytes())
	}

	// Default: CSV
	if err := services.ExportCatalogCSV(&buf, store, products); err != nil {
		log.Error().Err(err).Msg("export: gagal membuat berkas CSV")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memproses berkas CSV katalog.",
		})
	}
	c.Set("Content-Type", "text/csv; charset=utf-8")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"katalog-%s-%s.csv\"", store.Slug, dateStr))
	c.Set("Cache-Control", "no-store, no-cache, must-revalidate")
	c.Set("Pragma", "no-cache")
	return c.Send(buf.Bytes())
}
