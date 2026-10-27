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

// ExportCatalog handles authenticated catalog export in CSV or JSON format
func (h *CatalogExportHandler) ExportCatalog(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	user, _ := c.Locals("user").(*models.User)
	store, _ := c.Locals("store").(*models.Store)
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
			return db.Order("sort_order ASC")
		}).
		Preload("Variants").
		Where("store_id = ?", store.ID)

	statusFilter := strings.ToLower(strings.TrimSpace(c.Query("status", "all")))
	if statusFilter == "active" {
		query = query.Where("is_active = ?", true)
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
		go func(sID uint, uID uint, uName, uEmail, fmtChoice string, count int, ip, ua string) {
			act := "catalog.export_csv"
			if fmtChoice == "json" {
				act = "catalog.export_json"
			}
			services.RecordActivity(services.RecordActivityParams{
				DB:          h.db,
				StoreID:     &sID,
				UserID:      &uID,
				ActorRole:   "merchant",
				ActorName:   uName,
				ActorEmail:  uEmail,
				Action:      act,
				Category:    "catalog",
				EntityType:  "store",
				EntityID:    &sID,
				Description: fmt.Sprintf("Mengekspor %d produk katalog dalam format %s", count, strings.ToUpper(fmtChoice)),
				IPAddress:   ip,
				UserAgent:   ua,
			})
		}(store.ID, user.ID, user.Name, user.Email, format, len(products), c.IP(), c.Get("User-Agent"))
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
	return c.Send(buf.Bytes())
}
