package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

type ReportHandler struct{}

func NewReportHandler() *ReportHandler {
	return &ReportHandler{}
}

type CreateReportRequest struct {
	TargetType     string `json:"target_type"`     // 'catalog' or 'item'
	StoreID        uint   `json:"store_id"`        // Store ID
	StoreSlug      string `json:"store_slug"`      // Store Slug
	StoreTitle     string `json:"store_title"`     // Store Title snapshot
	FaunaID        *uint  `json:"fauna_id"`        // Optional Fauna/Item ID
	ItemName       string `json:"item_name"`       // Optional Item Name snapshot
	ReasonCategory string `json:"reason_category"` // Violation category ID
	ReasonLabel    string `json:"reason_label"`    // Human-readable violation title
	Description    string `json:"description"`     // Additional user notes
	ReporterEmail  string `json:"reporter_email"`  // Optional reporter email
}

// GenerateReportNumber generates a unique, human-readable ticket reference e.g. RPT-20260829-AB12C
func GenerateReportNumber() string {
	now := time.Now().UTC()
	b := make([]byte, 3)
	_, _ = rand.Read(b)
	randHex := strings.ToUpper(hex.EncodeToString(b))
	return fmt.Sprintf("RPT-%s-%s", now.Format("20060102"), randHex)
}

// CreateReport handles public submission of a Catalog or Item violation report
func (h *ReportHandler) CreateReport(c *fiber.Ctx) error {
	var req CreateReportRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data laporan tidak valid.",
		})
	}

	// 1. Validate Target Type ('catalog' or 'item')
	req.TargetType = strings.ToLower(strings.TrimSpace(req.TargetType))
	if req.TargetType != "catalog" && req.TargetType != "item" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Jenis pelaporan harus berupa 'catalog' atau 'item'.",
		})
	}

	// 2. Validate Reason
	req.ReasonCategory = security.SanitizePlainText(req.ReasonCategory, 100)
	req.ReasonLabel = security.SanitizePlainText(req.ReasonLabel, 255)
	if req.ReasonCategory == "" || req.ReasonLabel == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Alasan pelaporan wajib dipilih.",
		})
	}

	// 3. Resolve & Verify Store
	var store models.Store
	if req.StoreID > 0 {
		if err := database.DB.First(&store, req.StoreID).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"message": "Katalog yang dilaporkan tidak ditemukan.",
			})
		}
	} else if req.StoreSlug != "" {
		sanitizedSlug := security.SanitizeSlug(req.StoreSlug)
		if err := database.DB.Where("slug = ?", sanitizedSlug).First(&store).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"message": "Katalog dengan slug tersebut tidak ditemukan.",
			})
		}
	} else {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "ID atau slug katalog wajib disertakan.",
		})
	}

	// 4. Resolve & Verify Fauna/Item if TargetType == 'item'
	var fauna *models.Fauna
	var itemName string
	if req.TargetType == "item" {
		if req.FaunaID != nil && *req.FaunaID > 0 {
			var f models.Fauna
			if err := database.DB.Where("id = ? AND store_id = ?", *req.FaunaID, store.ID).First(&f).Error; err == nil {
				fauna = &f
				itemName = f.Name
			}
		}
		if itemName == "" && req.ItemName != "" {
			itemName = security.SanitizePlainText(req.ItemName, 255)
		}
		if itemName == "" && fauna == nil {
			itemName = "Item Produk"
		}
	}

	// 5. Sanitize Description & Email
	description := security.SanitizeRichText(req.Description, 5000)
	reporterEmail := strings.TrimSpace(req.ReporterEmail)
	if reporterEmail != "" {
		if !security.ValidateEmail(reporterEmail) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Format alamat email pelapor tidak valid.",
			})
		}
	}

	// 6. Capture Client Metadata for Audit Trail
	clientIP := c.IP()
	if forwarded := c.Get("X-Forwarded-For"); forwarded != "" {
		clientIP = strings.TrimSpace(strings.Split(forwarded, ",")[0])
	}
	userAgent := c.Get("User-Agent")

	// 7. Generate Ticket Number & Construct Report Record
	reportNumber := GenerateReportNumber()
	report := models.Report{
		ReportNumber:      reportNumber,
		TargetType:        req.TargetType,
		StoreID:           store.ID,
		StoreSlug:         store.Slug,
		StoreTitle:        store.StoreTitle,
		ReasonCategory:    req.ReasonCategory,
		ReasonLabel:       req.ReasonLabel,
		Description:       description,
		ReporterEmail:     reporterEmail,
		ReporterIP:        clientIP,
		ReporterUserAgent: userAgent,
		Status:            "pending",
		ActionTaken:       "none",
	}

	if fauna != nil {
		report.FaunaID = &fauna.ID
		report.ItemName = itemName
	} else if req.TargetType == "item" && itemName != "" {
		report.ItemName = itemName
		if req.FaunaID != nil && *req.FaunaID > 0 {
			report.FaunaID = req.FaunaID
		}
	}

	if err := database.DB.Create(&report).Error; err != nil {
		log.Error().Err(err).Msg("Failed to store violation report in database")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menyimpan laporan. Silakan coba beberapa saat lagi.",
		})
	}

	log.Info().
		Str("report_number", reportNumber).
		Str("target_type", report.TargetType).
		Str("store_slug", report.StoreSlug).
		Str("reason", report.ReasonCategory).
		Msg("New violation report recorded successfully")

	targetDisplayName := store.StoreTitle
	if report.TargetType == "item" && report.ItemName != "" {
		targetDisplayName = report.ItemName
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("Terima kasih. Laporan untuk \"%s\" telah berhasil diterima dan tercatat di sistem.", targetDisplayName),
		"data": fiber.Map{
			"report_number":   report.ReportNumber,
			"target_type":     report.TargetType,
			"target_name":     targetDisplayName,
			"reason_label":    report.ReasonLabel,
			"status":          report.Status,
			"created_at":      report.CreatedAt,
		},
	})
}

// Index retrieves reports with optional query filters (Admin/Compliance only)
func (h *ReportHandler) Index(c *fiber.Ctx) error {
	query := database.DB.Model(&models.Report{}).Order("created_at DESC")

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if targetType := c.Query("target_type"); targetType != "" {
		query = query.Where("target_type = ?", targetType)
	}
	if storeID := c.QueryInt("store_id"); storeID > 0 {
		query = query.Where("store_id = ?", storeID)
	}

	var reports []models.Report
	if err := query.Limit(100).Find(&reports).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil data laporan.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    reports,
	})
}

// Show retrieves details of a specific report (Admin/Compliance only)
func (h *ReportHandler) Show(c *fiber.Ctx) error {
	id := c.Params("id")
	var report models.Report
	if err := database.DB.Preload("Store").Preload("Fauna").First(&report, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Data laporan tidak ditemukan.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    report,
	})
}

// UpdateStatus updates report review status and internal compliance notes (Admin/Compliance only)
func (h *ReportHandler) UpdateStatus(c *fiber.Ctx) error {
	id := c.Params("id")
	var report models.Report
	if err := database.DB.First(&report, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Data laporan tidak ditemukan.",
		})
	}

	var req struct {
		Status      string `json:"status"`
		AdminNotes  string `json:"admin_notes"`
		ActionTaken string `json:"action_taken"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	if req.Status != "" {
		report.Status = security.SanitizePlainText(req.Status, 50)
	}
	if req.AdminNotes != "" {
		report.AdminNotes = security.SanitizeRichText(req.AdminNotes, 5000)
	}
	if req.ActionTaken != "" {
		report.ActionTaken = security.SanitizePlainText(req.ActionTaken, 100)
	}

	now := time.Now().UTC()
	report.ReviewedAt = &now

	if user, ok := c.Locals("user").(*models.User); ok && user != nil {
		report.ReviewedBy = &user.ID
	}

	if err := database.DB.Save(&report).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui status laporan.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Status laporan berhasil diperbarui.",
		"data":    report,
	})
}
