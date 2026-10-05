package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"
	"catavor-backend/internal/services"
	"catavor-backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
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

// InvalidateReportMetricsCache purges cached moderation counts in Redis on new reports or status updates
func InvalidateReportMetricsCache() {
	if database.IsRedisAvailable() && database.RedisClient != nil {
		_ = database.RedisClient.Del(context.Background(), "catavor:reports:metrics").Err()
	}
}

// GetReportMetrics retrieves aggregated report counts, utilizing Redis cache with graceful DB fallback
func GetReportMetrics(db *gorm.DB) map[string]int64 {
	ctx := context.Background()
	cacheKey := "catavor:reports:metrics"

	// 1. Try Redis cache
	if database.IsRedisAvailable() && database.RedisClient != nil {
		val, err := database.RedisClient.Get(ctx, cacheKey).Result()
		if err == nil && val != "" {
			var cached map[string]int64
			if err := json.Unmarshal([]byte(val), &cached); err == nil {
				return cached
			}
		}
	}

	// 2. Direct DB Aggregation fallback
	var pendingCount, investigatingCount, reReviewCount, actionCount, bannedCount, dismissedCount, resolvedCount, totalCount int64
	db.Model(&models.Report{}).Where("status = ?", "pending").Count(&pendingCount)
	db.Model(&models.Report{}).Where("status = ?", "investigating").Count(&investigatingCount)
	db.Model(&models.Report{}).Where("status = ?", "re_review").Count(&reReviewCount)
	db.Model(&models.Report{}).Where("status = ?", "action_taken").Count(&actionCount)
	db.Model(&models.Report{}).Where("status = ? OR action_taken = 'catalog_banned'", "banned").Count(&bannedCount)
	db.Model(&models.Report{}).Where("status = ?", "dismissed").Count(&dismissedCount)
	db.Model(&models.Report{}).Where("status = ?", "resolved").Count(&resolvedCount)
	db.Model(&models.Report{}).Count(&totalCount)

	metrics := map[string]int64{
		"pending":       pendingCount,
		"investigating": investigatingCount,
		"re_review":     reReviewCount,
		"action_taken":  actionCount,
		"banned":        bannedCount,
		"dismissed":     dismissedCount,
		"resolved":      resolvedCount,
		"total":         totalCount,
	}

	// 3. Save to Redis Cache (60s TTL)
	if database.IsRedisAvailable() && database.RedisClient != nil {
		if bytes, err := json.Marshal(metrics); err == nil {
			_ = database.RedisClient.Set(ctx, cacheKey, string(bytes), 60*time.Second).Err()
		}
	}

	return metrics
}

// CreateReport handles public submission of a Catalog or Item violation report with Anti-Spam deduplication
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

	// 4. Resolve & Verify Product/Item if TargetType == 'item'
	var product *models.Product
	var itemName string
	if req.TargetType == "item" {
		if req.FaunaID != nil && *req.FaunaID > 0 {
			var p models.Product
			if err := database.DB.Where("id = ? AND store_id = ?", *req.FaunaID, store.ID).First(&p).Error; err == nil {
				product = &p
				itemName = p.Name
			}
		}
		if itemName == "" && req.ItemName != "" {
			itemName = security.SanitizePlainText(req.ItemName, 255)
		}
		if itemName == "" && product == nil {
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

	// 6. Capture Client Metadata
	clientIP := c.IP()
	if forwarded := c.Get("X-Forwarded-For"); forwarded != "" {
		clientIP = strings.TrimSpace(strings.Split(forwarded, ",")[0])
	}
	userAgent := c.Get("User-Agent")

	targetDisplayName := store.StoreTitle
	if req.TargetType == "item" && itemName != "" {
		targetDisplayName = itemName
	}

	// 7. Anti-Spam & Deduplication Guard: Check recent active report from same IP / Email within 24h
	var existingActiveCount int64
	checkQ := database.DB.Model(&models.Report{}).
		Where("store_id = ? AND status IN ('pending', 'investigating')", store.ID).
		Where("created_at >= ?", time.Now().UTC().Add(-24*time.Hour))

	if req.TargetType == "item" && req.FaunaID != nil {
		checkQ = checkQ.Where("fauna_id = ?", *req.FaunaID)
	} else {
		checkQ = checkQ.Where("target_type = 'catalog'")
	}

	if reporterEmail != "" {
		checkQ = checkQ.Where("(reporter_ip = ? OR reporter_email = ?)", clientIP, reporterEmail)
	} else {
		checkQ = checkQ.Where("reporter_ip = ?", clientIP)
	}

	checkQ.Count(&existingActiveCount)
	if existingActiveCount > 0 {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"success":   true,
			"message":   fmt.Sprintf("Laporan Anda untuk \"%s\" sudah tercatat di sistem kami sebelumnya dan sedang dalam antrean peninjauan tim kepatuhan. Terima kasih atas partisipasi Anda menjaga ekosistem Catavor.", targetDisplayName),
			"duplicate": true,
		})
	}

	// 8. Generate Ticket Number & Store Report Record
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

	if product != nil {
		report.FaunaID = &product.ID
		report.ItemName = itemName
		report.ItemType = product.ProductType
	} else if req.TargetType == "item" && itemName != "" {
		report.ItemName = itemName
		if req.FaunaID != nil && *req.FaunaID > 0 {
			report.FaunaID = req.FaunaID
			var p models.Product
			if err := database.DB.Select("id, product_type").Where("id = ?", *req.FaunaID).First(&p).Error; err == nil {
				report.ItemType = p.ProductType
			}
		}
	}

	if err := database.DB.Create(&report).Error; err != nil {
		log.Error().Err(err).Msg("Failed to store violation report in database")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menyimpan laporan. Silakan coba beberapa saat lagi.",
		})
	}

	// Purge Redis Metrics Cache so dashboard count immediately increases
	InvalidateReportMetricsCache()

	// Dispatch Transactional Confirmation Email to Reporter (if email was provided)
	if reporterEmail != "" {
		targetName := report.StoreTitle
		if report.TargetType == "item" && report.ItemName != "" {
			targetName = report.ItemName
		}
		reportedAtStr := report.CreatedAt.Format("02 Jan 2006 15:04 WIB")
		repSubject, repHTML := services.BuildReporterReceivedEmail(
			report.ReportNumber,
			report.TargetType,
			targetName,
			report.StoreTitle,
			report.ReasonLabel,
			reportedAtStr,
		)
		_, _ = services.EnqueueEmail(
			reporterEmail,
			"Pelapor Komunitas",
			"Catavor Trust & Safety",
			repSubject,
			repHTML,
			"reporter_receipt",
			report.ReportNumber,
		)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("Laporan pelanggaran berhasil dikirim dengan nomor tiket #%s. Tim integritas Catavor akan segera menindaklanjuti.", reportNumber),
		"data": fiber.Map{
			"report_number": reportNumber,
			"status":        report.Status,
			"created_at":    report.CreatedAt,
		},
	})
}

// Index lists reports with filtering, pagination, and active case counts
func (h *ReportHandler) Index(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 15)
	if limit <= 0 || limit > 100 {
		limit = 15
	}
	offset := (page - 1) * limit

	query := database.DB.Model(&models.Report{})

	status := strings.TrimSpace(c.Query("status"))
	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}

	reasonCat := strings.TrimSpace(c.Query("reason_category"))
	if reasonCat != "" && reasonCat != "all" {
		query = query.Where("reason_category = ?", reasonCat)
	}

	targetType := strings.TrimSpace(c.Query("target_type"))
	if targetType != "" && targetType != "all" {
		query = query.Where("target_type = ?", targetType)
	}

	if storeID := c.QueryInt("store_id"); storeID > 0 {
		query = query.Where("store_id = ?", storeID)
	}

	search := strings.TrimSpace(c.Query("search"))
	if search != "" {
		likeTerm := "%" + security.SanitizePlainText(search, 100) + "%"
		query = query.Where("(report_number ILIKE ? OR store_title ILIKE ? OR item_name ILIKE ? OR reporter_email ILIKE ? OR reason_label ILIKE ?)",
			likeTerm, likeTerm, likeTerm, likeTerm, likeTerm)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghitung data laporan.",
		})
	}

	var reports []models.Report
	if err := query.Preload("Fauna").Order("created_at DESC").Offset(offset).Limit(limit).Find(&reports).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil data laporan.",
		})
	}

	// Attach active report count for each entity to power 🔥 Multi-Reporter badge
	type ReportAggResult struct {
		models.Report
		ActiveReportCount int64 `json:"active_report_count"`
	}

	results := make([]ReportAggResult, len(reports))
	for i, r := range reports {
		if r.ItemType == "" && r.Product != nil && r.Product.ProductType != "" {
			r.ItemType = r.Product.ProductType
		}
		var activeCount int64
		subQ := database.DB.Model(&models.Report{}).
			Where("store_id = ? AND status IN ('pending', 'investigating', 're_review')", r.StoreID)
		if r.TargetType == "item" && r.FaunaID != nil {
			subQ = subQ.Where("fauna_id = ?", *r.FaunaID)
		} else {
			subQ = subQ.Where("target_type = 'catalog'")
		}
		subQ.Count(&activeCount)

		results[i] = ReportAggResult{
			Report:            r,
			ActiveReportCount: activeCount,
		}
	}

	metrics := GetReportMetrics(database.DB)
	totalPages := int((total + int64(limit) - 1) / int64(limit))
	if totalPages < 1 {
		totalPages = 1
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    results,
		"pagination": fiber.Map{
			"page":        page,
			"limit":       limit,
			"total":       total,
			"total_pages": totalPages,
		},
		"metrics": metrics,
	})
}

// Show retrieves details of a specific report, including other active reports for the same entity and prior review history
func (h *ReportHandler) Show(c *fiber.Ctx) error {
	id := c.Params("id")
	var report models.Report
	query := database.DB.Preload("Store.User").Preload("Fauna")
	if numID, err := strconv.ParseUint(id, 10, 64); err == nil {
		query = query.Where("id = ? OR report_number = ?", numID, id)
	} else {
		query = query.Where("report_number = ?", id)
	}

	if err := query.First(&report).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Data laporan tidak ditemukan.",
		})
	}

	// 1. Fetch other active reports for the same entity (Multi-Reporter Evidence Timeline)
	var activeReports []models.Report
	actQ := database.DB.Where("store_id = ? AND id != ? AND status IN ('pending', 'investigating', 're_review')", report.StoreID, report.ID)
	if report.TargetType == "item" && report.FaunaID != nil {
		actQ = actQ.Where("fauna_id = ?", *report.FaunaID)
	} else {
		actQ = actQ.Where("target_type = 'catalog'")
	}
	_ = actQ.Order("created_at DESC").Find(&activeReports).Error

	// 2. Fetch prior review history for this entity (Prior Audit History Ledger)
	var historyReports []models.Report
	histQ := database.DB.Where("store_id = ? AND id != ? AND status IN ('action_taken', 'dismissed', 'resolved')", report.StoreID, report.ID)
	if report.TargetType == "item" && report.FaunaID != nil {
		histQ = histQ.Where("fauna_id = ?", *report.FaunaID)
	} else {
		histQ = histQ.Where("target_type = 'catalog'")
	}
	_ = histQ.Order("reviewed_at DESC, updated_at DESC").Limit(10).Find(&historyReports).Error

	return c.JSON(fiber.Map{
		"success":         true,
		"data":            report,
		"active_reports":  activeReports,
		"history_reports": historyReports,
	})
}

// UpdateStatus executes ACID transactional enforcement with auto-rollback, multi-channel alerts, and audit logging
func (h *ReportHandler) UpdateStatus(c *fiber.Ctx) error {
	id := c.Params("id")
	var report models.Report
	query := database.DB.Preload("Store.User")
	if numID, err := strconv.ParseUint(id, 10, 64); err == nil {
		query = query.Where("id = ? OR report_number = ?", numID, id)
	} else {
		query = query.Where("report_number = ?", id)
	}

	if err := query.First(&report).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Data laporan tidak ditemukan.",
		})
	}

	var req struct {
		Status           string `json:"status"`
		AdminNotes       string `json:"admin_notes"`
		ActionTaken      string `json:"action_taken"`
		ApplyEnforcement *bool  `json:"apply_enforcement"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	newStatus := report.Status
	if req.Status != "" {
		newStatus = security.SanitizePlainText(req.Status, 50)
	}

	adminNotes := report.AdminNotes
	if req.AdminNotes != "" {
		adminNotes = security.SanitizeRichText(req.AdminNotes, 5000)
	}

	actionTaken := report.ActionTaken
	if req.ActionTaken != "" {
		actionTaken = security.SanitizePlainText(req.ActionTaken, 100)
	}

	if actionTaken == "catalog_banned" && (newStatus == "" || newStatus == "action_taken" || newStatus == "investigating" || newStatus == "pending") {
		newStatus = "banned"
	}
	if actionTaken == "catalog_suspended" && (newStatus == "" || newStatus == "investigating" || newStatus == "pending") {
		newStatus = "action_taken"
	}
	if actionTaken == "catalog_reactivated" && (newStatus == "" || newStatus == "action_taken" || newStatus == "investigating") {
		newStatus = "resolved"
	}

	// Automatic Failsafe: Promote action_taken if status is banned/resolved/action_taken but action_taken was omitted or none
	if newStatus == "banned" && (actionTaken == "" || actionTaken == "none") {
		if report.TargetType == "item" && report.FaunaID != nil && *report.FaunaID > 0 {
			actionTaken = "item_hidden"
		} else {
			actionTaken = "catalog_banned"
		}
	} else if newStatus == "action_taken" && (actionTaken == "" || actionTaken == "none") {
		if report.TargetType == "item" && report.FaunaID != nil && *report.FaunaID > 0 {
			actionTaken = "item_hidden"
		} else {
			actionTaken = "catalog_suspended"
		}
	} else if newStatus == "resolved" && (actionTaken == "" || actionTaken == "none") {
		if report.TargetType == "item" && report.FaunaID != nil && *report.FaunaID > 0 {
			actionTaken = "item_restored"
		} else {
			actionTaken = "catalog_reactivated"
		}
	}

	applyEnforcement := true
	if req.ApplyEnforcement != nil {
		applyEnforcement = *req.ApplyEnforcement
	}

	now := time.Now().UTC()
	var actorUserID *uint
	var actorName = "Admin Kepatuhan"
	var actorEmail = "compliance@catavor.com"
	var actorRole = "superadmin"

	if user, ok := c.Locals("user").(*models.User); ok && user != nil {
		actorUserID = &user.ID
		if user.Name != "" {
			actorName = user.Name
		}
		if user.Email != "" {
			actorEmail = user.Email
		}
		if user.PlatformRole != "" {
			actorRole = user.PlatformRole
		}
	}

	var notificationCreated *models.Notification

	// Ensure report.StoreID is populated if StoreSlug exists
	if report.StoreID <= 0 && report.StoreSlug != "" {
		var s models.Store
		if err := database.DB.Select("id").Where("LOWER(slug) = ?", strings.ToLower(report.StoreSlug)).First(&s).Error; err == nil {
			report.StoreID = s.ID
		}
	}

	// Capture merchant owner email beforehand for transactional email dispatch
	merchantOwnerEmail := ""
	if report.StoreID > 0 {
		var s models.Store
		if err := database.DB.Preload("User").Where("id = ?", report.StoreID).First(&s).Error; err == nil {
			if s.User != nil && s.User.Email != "" {
				merchantOwnerEmail = s.User.Email
			}
		}
	}

	// Capture all unique reporter emails for post-decision resolution dispatch (including multi-reporters)
	reporterMap := make(map[string]string) // email -> reportNumber
	if strings.TrimSpace(report.ReporterEmail) != "" {
		reporterMap[strings.ToLower(strings.TrimSpace(report.ReporterEmail))] = report.ReportNumber
	}

	var relatedReports []models.Report
	relQ := database.DB.Select("id, report_number, reporter_email").
		Where("store_id = ? AND id != ? AND status IN ('pending', 'investigating')", report.StoreID, report.ID)
	if report.TargetType == "item" && report.FaunaID != nil {
		relQ = relQ.Where("fauna_id = ?", *report.FaunaID)
	} else {
		relQ = relQ.Where("target_type = 'catalog'")
	}
	if err := relQ.Find(&relatedReports).Error; err == nil {
		for _, rr := range relatedReports {
			em := strings.ToLower(strings.TrimSpace(rr.ReporterEmail))
			if em != "" {
				if _, exists := reporterMap[em]; !exists {
					reporterMap[em] = rr.ReportNumber
				}
			}
		}
	}

	// 1. ACID DATABASE TRANSACTION (TRY - CATCH - AUTO-ROLLBACK)
	txErr := database.DB.Transaction(func(tx *gorm.DB) error {
		// A. Update current report
		report.Status = newStatus
		report.AdminNotes = adminNotes
		report.ActionTaken = actionTaken
		report.ReviewedAt = &now
		report.ReviewedBy = actorUserID

		if err := tx.Save(&report).Error; err != nil {
			return err
		}

		// B. Bulk-update all other pending/investigating reports for this same entity
		bulkUpdateQ := tx.Model(&models.Report{}).
			Where("store_id = ? AND id != ? AND status IN ('pending', 'investigating')", report.StoreID, report.ID)
		if report.TargetType == "item" && report.FaunaID != nil {
			bulkUpdateQ = bulkUpdateQ.Where("fauna_id = ?", *report.FaunaID)
		} else {
			bulkUpdateQ = bulkUpdateQ.Where("target_type = 'catalog'")
		}
		_ = bulkUpdateQ.Updates(map[string]interface{}{
			"status":       newStatus,
			"action_taken": actionTaken,
			"reviewed_at":  &now,
			"reviewed_by":  actorUserID,
			"admin_notes":  adminNotes,
		}).Error

		// C. Execute Technical Enforcement
		if applyEnforcement {
			switch actionTaken {
			case "item_needs_fix":
				if report.FaunaID != nil && *report.FaunaID > 0 {
					if err := tx.Model(&models.Product{}).Where("id = ? AND store_id = ?", *report.FaunaID, report.StoreID).Updates(map[string]interface{}{
						"is_active":             false,
						"moderation_status":     "needs_fix",
						"moderation_reason":     adminNotes,
						"moderated_at":          &now,
						"is_shipping_available": false,
					}).Error; err != nil {
						return err
					}
					_ = tx.Table("faunas").Where("id = ? AND store_id = ?", *report.FaunaID, report.StoreID).Updates(map[string]interface{}{
						"is_active":             false,
						"moderation_status":     "needs_fix",
						"moderation_reason":     adminNotes,
						"moderated_at":          &now,
						"is_shipping_available": false,
					}).Error
				}
			case "item_locked", "item_hidden":
				if report.FaunaID != nil && *report.FaunaID > 0 {
					if err := tx.Model(&models.Product{}).Where("id = ? AND store_id = ?", *report.FaunaID, report.StoreID).Updates(map[string]interface{}{
						"is_active":             false,
						"moderation_status":     "locked",
						"moderation_reason":     adminNotes,
						"moderated_at":          &now,
						"is_shipping_available": false,
					}).Error; err != nil {
						return err
					}
					_ = tx.Table("faunas").Where("id = ? AND store_id = ?", *report.FaunaID, report.StoreID).Updates(map[string]interface{}{
						"is_active":             false,
						"moderation_status":     "locked",
						"moderation_reason":     adminNotes,
						"moderated_at":          &now,
						"is_shipping_available": false,
					}).Error
				}
			case "item_restored":
				if report.FaunaID != nil && *report.FaunaID > 0 {
					if err := tx.Model(&models.Product{}).Where("id = ? AND store_id = ?", *report.FaunaID, report.StoreID).Updates(map[string]interface{}{
						"is_active":             true,
						"moderation_status":     "none",
						"moderation_reason":     "",
						"moderated_at":          nil,
						"resubmitted_at":        nil,
						"is_shipping_available": true,
					}).Error; err != nil {
						return err
					}
					_ = tx.Table("faunas").Where("id = ? AND store_id = ?", *report.FaunaID, report.StoreID).Updates(map[string]interface{}{
						"is_active":             true,
						"moderation_status":     "none",
						"moderation_reason":     "",
						"moderated_at":          nil,
						"resubmitted_at":        nil,
						"is_shipping_available": true,
					}).Error
				}
			case "catalog_suspended":
				if report.StoreID > 0 {
					if err := tx.Model(&models.Store{}).Where("id = ?", report.StoreID).Updates(map[string]interface{}{
						"dormancy_status":       "suspended",
						"is_suspended":          true,
						"suspension_reason":     "moderation_violation",
						"dormancy_suspended_at": &now,
					}).Error; err != nil {
						return err
					}
					// Clean/dismiss older suspension notifications for this store so only this new incident notification is active
					tx.Exec(`
						DELETE FROM notifications 
						WHERE target_type = 'single_store' AND target_id = ? 
						  AND category = 'KEAMANAN' 
						  AND (title LIKE '%Dibekukan%' OR title LIKE '%Suspensi%' OR message LIKE '%dibekukan%' OR message LIKE '%penangguhan%')
					`, report.StoreID)
				}
			case "catalog_banned", "account_banned":
				if report.StoreID > 0 {
					if err := purgeBannedStore(tx, report.StoreID, report.StoreSlug, report.StoreTitle, report.ReportNumber, report.ReasonLabel, actorName); err != nil {
						return err
					}
				}
			case "catalog_reactivated":
				if report.StoreID > 0 {
					if err := tx.Model(&models.Store{}).Where("id = ?", report.StoreID).Updates(map[string]interface{}{
						"dormancy_status":       "active",
						"is_suspended":          false,
						"suspension_reason":     "none",
						"dormancy_suspended_at": nil,
					}).Error; err != nil {
						return err
					}
					// Auto-dismiss/clean previous suspension notifications for this store
					tx.Exec(`
						DELETE FROM notifications 
						WHERE target_type = 'single_store' AND target_id = ? 
						  AND category = 'KEAMANAN' 
						  AND (title LIKE '%Dibekukan%' OR title LIKE '%Suspensi%' OR message LIKE '%dibekukan%' OR message LIKE '%penangguhan%')
					`, report.StoreID)

					// Mark any active appeal/compliance tickets from the past suspension as resolved
					tx.Model(&models.SupportTicket{}).
						Where("store_id = ? AND status IN ('open', 'in_progress', 'waiting_user', 'waiting_agent') AND (category = 'compliance' OR category = 'catalog_help' OR subject LIKE '%Banding%' OR subject LIKE '%Pembekuan%')", report.StoreID).
						Updates(map[string]interface{}{
							"status":      "resolved",
							"resolved_at": now,
						})
				}
			}
		}

		// D. Generate In-App Notification for Merchant (models.Notification)
		// For permanently banned catalogs, do NOT generate in-app notification because the store and merchant access have been terminated.
		if report.StoreID > 0 && actionTaken != "none" && actionTaken != "catalog_banned" {
			targetEntityName := report.StoreTitle
			itemTypeLabel := ""
			rawItemType := report.ItemType
			if report.TargetType == "item" {
				if report.ItemName != "" {
					targetEntityName = report.ItemName
				}
				if rawItemType == "" && report.FaunaID != nil && *report.FaunaID > 0 {
					var p models.Product
					if err := tx.Select("id, product_type").Where("id = ?", *report.FaunaID).First(&p).Error; err == nil {
						rawItemType = p.ProductType
					}
				}
				itemTypeLabel = mapProductTypeLabel(rawItemType)
			}

			notifTitle, notifMsg, notifType, notifActionLabel := buildModerationNotificationContent(actionTaken, targetEntityName, report.ReportNumber)
			if notifTitle != "" {
				detailArticle := buildModerationDetailArticle(actionTaken, report.StoreTitle, targetEntityName, report.TargetType, itemTypeLabel, report.ReportNumber, report.ReasonLabel, adminNotes, now)
				actionURL := fmt.Sprintf("/%s/admin/help?action=appeal&report=%s&target_type=%s&target_name=%s&item_type=%s&reason=%s&notes=%s",
					report.StoreSlug,
					report.ReportNumber,
					url.QueryEscape(report.TargetType),
					url.QueryEscape(targetEntityName),
					url.QueryEscape(itemTypeLabel),
					url.QueryEscape(report.ReasonLabel),
					url.QueryEscape(adminNotes),
				)
				targetSubTab := ""
				actionType := "detail"
				notifCategory := "KEAMANAN"
				if actionTaken == "item_needs_fix" {
					notifCategory = "PERBAIKAN"
					actionURL = fmt.Sprintf("/%s/admin/items", report.StoreSlug)
					targetSubTab = "items"
				} else if actionTaken == "catalog_reactivated" || actionTaken == "item_restored" {
					notifCategory = "PEMULIHAN"
					actionURL = fmt.Sprintf("/%s/admin", report.StoreSlug)
					targetSubTab = "items"
				}

				notif := models.Notification{
					ID:            fmt.Sprintf("notif_mod_%d_%d", report.StoreID, now.UnixNano()),
					TargetType:    "single_store",
					TargetID:      report.StoreID,
					TargetName:    report.StoreTitle,
					Title:         notifTitle,
					Category:      notifCategory,
					Message:       notifMsg,
					DetailContent: detailArticle,
					Type:          notifType,
					ActionEnabled: true,
					ActionType:    actionType,
					LinkSubTab:    targetSubTab,
					ActionLabel:   notifActionLabel,
					ActionURL:     actionURL,
					CreatedBy:     0,
					CreatedAt:     now,
					UpdatedAt:     now,
				}
				if err := tx.Create(&notif).Error; err == nil {
					notificationCreated = &notif
				}
			}
		}

		// E. Create Enterprise Activity Log (Audit Trail)
		auditDesc := fmt.Sprintf("Laporan #%s (%s) diputuskan: Status '%s', Sanksi '%s'. Catatan: %s", report.ReportNumber, report.ReasonLabel, report.Status, report.ActionTaken, adminNotes)
		activityLog := models.ActivityLog{
			StoreID:     &report.StoreID,
			UserID:      actorUserID,
			ActorRole:   actorRole,
			ActorName:   actorName,
			ActorEmail:  actorEmail,
			Action:      "report.moderation_enforce",
			Category:    "moderation",
			EntityType:  "report",
			EntityID:    &report.ID,
			EntityTitle: report.ReportNumber,
			Description: auditDesc,
			IPAddress:   c.IP(),
			UserAgent:   c.Get("User-Agent"),
			CreatedAt:   now,
		}
		if err := tx.Create(&activityLog).Error; err != nil {
			return err
		}

		return nil
	})

	if txErr != nil {
		log.Error().Err(txErr).Str("report_number", report.ReportNumber).Msg("Moderation transaction failed and rolled back successfully")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memproses transaksi moderasi. Seluruh perubahan telah dibatalkan dengan aman.",
			"error":   txErr.Error(),
		})
	}

	// 2. POST-TRANSACTION ASYNC ACTIONS (Non-blocking)
	// A. Broadcast In-App Notification via WebSocket Hub
	if notificationCreated != nil {
		go services.GetNotificationHub().Broadcast(notificationCreated)
	}

	// B. Dispatch Transactional Email via SMTP (in background goroutine)
	targetRecipientEmail := merchantOwnerEmail
	if targetRecipientEmail == "" && report.Store != nil && report.Store.User != nil {
		targetRecipientEmail = report.Store.User.Email
	}
	if targetRecipientEmail != "" && actionTaken != "none" {
		targetEntityName := report.StoreTitle
		if report.TargetType == "item" && report.ItemName != "" {
			targetEntityName = report.ItemName
		}
		itemTypeLabel := mapProductTypeLabel(report.ItemType)
		sendModerationEmail(targetRecipientEmail, report.StoreTitle, targetEntityName, actionTaken, adminNotes, report.ReportNumber, report.ReasonLabel, report.StoreSlug, itemTypeLabel)
	}

	// C. Dispatch Resolution / Outcome Notification to Reporter(s) via persistent queue
	if len(reporterMap) > 0 {
		targetEntityName := report.StoreTitle
		if report.TargetType == "item" && report.ItemName != "" {
			targetEntityName = report.ItemName
		}
		for repEmail, repNumber := range reporterMap {
			repSubject, repHTML := services.BuildReporterOutcomeEmail(
				repNumber,
				report.TargetType,
				targetEntityName,
				report.StoreTitle,
				report.ReasonLabel,
				actionTaken,
			)
			category := "reporter_enforced"
			if actionTaken == "none" || newStatus == "rejected" || newStatus == "dismissed" {
				category = "reporter_dismissed"
			}
			_, _ = services.EnqueueEmail(
				repEmail,
				"Pelapor Komunitas",
				"Catavor Trust & Safety",
				repSubject,
				repHTML,
				category,
				repNumber,
			)
		}
	}

	// D. Invalidate Redis Metrics Cache
	InvalidateReportMetricsCache()

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Tindakan moderasi berhasil diterapkan secara transaksional, notifikasi telah dikirim ke merchant, dan audit trail telah tersimpan.",
		"data":    report,
	})
}

// mapProductTypeLabel maps raw product type strings to human-friendly Indonesian labels
func mapProductTypeLabel(pType string) string {
	switch strings.ToLower(strings.TrimSpace(pType)) {
	case "fauna":
		return "Hewan / Satwa (Fauna)"
	case "physical":
		return "Barang Fisik"
	case "digital":
		return "Produk Digital"
	case "service":
		return "Jasa / Layanan"
	case "food":
		return "Kuliner / Makanan & Minuman"
	case "property":
		return "Properti"
	default:
		if pType != "" {
			return pType
		}
		return "Barang Fisik"
	}
}

// buildModerationNotificationContent returns in-app notification title, message, type, and actionLabel
func buildModerationNotificationContent(actionTaken, targetName, reportNumber string) (title, message, notifType, actionLabel string) {
	switch actionTaken {
	case "warning_issued":
		return "Peringatan Kepatuhan Konten Katalog",
			fmt.Sprintf("Peringatan resmi untuk \"%s\" (#%s). Buka rincian untuk panduan perbaikan & hak banding.", targetName, reportNumber),
			"warning",
			"Ajukan Banding Kepatuhan →"
	case "item_needs_fix":
		return "Perlu Perbaikan Informasi Produk",
			fmt.Sprintf("Produk \"%s\" memerlukan penyesuaian informasi (#%s). Buka rincian untuk panduan perbaikan.", targetName, reportNumber),
			"warning",
			"Perbaiki Produk Sekarang →"
	case "item_locked", "item_hidden":
		return "Penonaktifan & Penguncian Produk",
			fmt.Sprintf("Produk \"%s\" dinonaktifkan & dikunci oleh Tim Kepatuhan (#%s). Buka rincian untuk hak banding.", targetName, reportNumber),
			"danger",
			"Ajukan Banding Kepatuhan →"
	case "item_restored":
		return "Item Katalog Berhasil Dipulihkan",
			fmt.Sprintf("Item \"%s\" telah diaktifkan kembali ke etalase publik (#%s). Akses normal.", targetName, reportNumber),
			"success",
			"Lihat Rincian Pemulihan →"
	case "catalog_suspended":
		return "Penangguhan Operasional Profil Katalog",
			fmt.Sprintf("Operasional profil katalog \"%s\" ditangguhkan sementara (#%s). Buka rincian untuk informasi banding.", targetName, reportNumber),
			"warning",
			"Ajukan Banding Kepatuhan →"
	case "catalog_banned":
		return "Penonaktifan Permanen Akun & Katalog",
			fmt.Sprintf("Profil katalog \"%s\" telah ditangguhkan secara permanen (#%s). Buka rincian untuk informasi banding kepatuhan.", targetName, reportNumber),
			"danger",
			"Ajukan Banding Kepatuhan →"
	case "catalog_reactivated":
		return "Pemulihan Operasional Profil Katalog Berhasil",
			fmt.Sprintf("Penangguhan untuk profil katalog \"%s\" telah resmi dicabut. Etalase publik dan seluruh fitur operasional Anda kini telah aktif kembali secara normal.", targetName),
			"success",
			"Lihat Status Pemulihan →"
	default:
		return "", "", "", ""
	}
}

// buildModerationDetailArticle formats a professional, official compliance decision document in Markdown
func buildModerationDetailArticle(actionTaken, storeTitle, targetName, targetType, itemTypeLabel, reportNumber, reasonLabel, adminNotes string, issuedAt time.Time) string {
	dateStr := issuedAt.Format("02 Jan 2006, 15:04 WIB")

	actionHeadline := ""
	actionExplanation := ""
	switch actionTaken {
	case "warning_issued":
		actionHeadline = "Peringatan Resmi Kepatuhan Konten Katalog"
		actionExplanation = fmt.Sprintf("Tim Kepatuhan menemukan ketidaksesuaian konten pada entitas **%s** dengan Standar Kebijakan Komunitas Catavor. Anda diminta meninjau dan melakukan koreksi mandiri terhadap foto, deskripsi, izin, atau klaim produk terkait. Sanksi penonaktifan dapat dijatuhkan apabila pelanggaran berulang.", targetName)
	case "item_needs_fix":
		actionHeadline = "Pemberitahuan Resmi Penyesuaian & Koreksi Produk"
		actionExplanation = fmt.Sprintf("Item katalog **%s** telah disembunyikan sementara dari etalase publik karena informasi produk belum memenuhi standar komunitas. Anda memiliki kesempatan untuk mengoreksi data produk (foto, deskripsi, harga, spesifikasi) dan mengajukan peninjauan kembali melalui tombol **Simpan & Ajukan Tinjauan Ulang**.", targetName)
	case "item_locked", "item_hidden":
		actionHeadline = "Penonaktifan & Penguncian Produk (Pelanggaran Komoditas/Kebijakan)"
		actionExplanation = fmt.Sprintf("Item katalog **%s** telah dinonaktifkan dan dikunci oleh Tim Kepatuhan Catavor sehubungan dengan dugaan pelanggaran komoditas atau standar integritas komunitas. Fitur pengeditan dinonaktifkan untuk mencegah peredaran komoditas terlarang.", targetName)
	case "item_restored":
		actionHeadline = "Pemulihan Visibilitas Item Katalog"
		actionExplanation = fmt.Sprintf("Peninjauan atas item katalog **%s** telah selesai dievaluasi. Item telah diaktifkan kembali secara penuh ke etalase publik dan kini dapat diakses normal oleh pelanggan.", targetName)
	case "catalog_suspended":
		actionHeadline = "Penangguhan Operasional Profil Katalog"
		actionExplanation = fmt.Sprintf("Operasional profil katalog **%s** telah ditangguhkan sementara terkait indikasi pelanggaran kebijakan komunitas. Seluruh akses publik dan tautan transaksi dijeda sementara.", storeTitle)
	case "catalog_banned":
		actionHeadline = "Penonaktifan Permanen Profil Katalog & Akun (Banned)"
		actionExplanation = fmt.Sprintf("Akses publik ke profil katalog **%s** dan akun pemilik telah ditangguhkan secara permanen oleh Tim Kepatuhan & Moderasi Catavor karena pelanggaran berat terhadap pedoman platform atau masa sanggahan banding telah kedaluwarsa.", storeTitle)
	case "catalog_reactivated":
		actionHeadline = "Keputusan Resmi Pemulihan Operasional Profil Katalog"
		actionExplanation = fmt.Sprintf("Berdasarkan verifikasi komprehensif dan klarifikasi kepatuhan, penangguhan atas profil katalog **%s** telah **resmi dicabut**. Seluruh etalase publik, fitur manajemen produk, dan kanal pemesanan WhatsApp kini telah kembali aktif normal sepenuhnya.", storeTitle)
	}

	notesBlock := ""
	if strings.TrimSpace(adminNotes) != "" {
		notesBlock = fmt.Sprintf("\n\n### Catatan & Temuan Peninjau (Trust & Safety):\n> \"%s\"", strings.TrimSpace(adminNotes))
	}

	itemTypeRow := ""
	if targetType == "item" && itemTypeLabel != "" {
		itemTypeRow = fmt.Sprintf("\n• Jenis / Tipe Katalog: **%s**", itemTypeLabel)
	}

	if actionTaken == "catalog_reactivated" || actionTaken == "item_restored" {
		return fmt.Sprintf(`### %s
Pemberitahuan Resmi Pencabutan Sanksi & Pemulihan Akses Platform Catavor.

---
### Rincian Pemulihan Resmi:
• Nomor Berkas: **#%s**
• Tanggal Pemulihan: **%s**
• Nama Profil Katalog: **%s**
• Entitas Terkait: **%s**%s
• Kategori Evaluasi: **%s**%s

---
### Penjelasan Keputusan Pemulihan:
%s

---
### Status Layanan & Fitur Pasca-Pemulihan:
1. **Etalase Publik Aktif**: Pengunjung umum kini dapat kembali mengakses tautan katalog digital dan melakukan pemesanan langsung melalui WhatsApp.
2. **Katalog Produk Terbuka Penuh**: Anda dapat mengelola produk, memperbarui stok, serta mengubah informasi katalog tanpa hambatan.
3. **Integritas Akun Terjaga**: Status kepatuhan akun Anda telah kembali normal dan berkas peninjauan telah ditutup secara tertib.`,
			actionHeadline, reportNumber, dateStr, storeTitle, targetName, itemTypeRow, reasonLabel, notesBlock, actionExplanation)
	}

	if actionTaken == "item_needs_fix" {
		return fmt.Sprintf(`### %s
Dokumen Resmi Penegakan Standar Komunitas & Kepatuhan Platform Catavor.

---
### Rincian Kasus Kepatuhan:
• Nomor Tiket Kepatuhan: **#%s**
• Tanggal Penerbitan: **%s**
• Nama Profil Terdaftar: **%s**
• Entitas Terkait: **%s**%s
• Kategori Dugaan Pelanggaran: **%s**%s

---
### Penjelasan Keputusan & Tindak Lanjut:
%s

---
### Hak Koreksi & Langkah Perbaikan (Action Required):
Platform Catavor memberikan kesempatan bagi mitra untuk memperbaiki data produk agar selaras dengan Pedoman Komunitas:
1. **Lakukan Koreksi Mandiri**: Buka menu inventaris produk Anda, perbaiki atribut yang bermasalah (foto, deskripsi, legalitas izin edar, atau spesifikasi).
2. **Ajukan Tinjauan Ulang**: Tekan tombol **Simpan & Ajukan Tinjauan Ulang** pada form edit produk. Tim Kepatuhan akan segera meninjau kembali perbaikan Anda dalam 1x24 jam kerja.
3. **Opsi Hapus Item**: Jika Anda tidak berniat menjual produk ini lagi, Anda dipersilakan menghapus produk secara mandiri untuk menjaga reputasi toko Anda.`,
			actionHeadline, reportNumber, dateStr, storeTitle, targetName, itemTypeRow, reasonLabel, notesBlock, actionExplanation)
	}

	return fmt.Sprintf(`### %s
Dokumen Resmi Penegakan Standar Komunitas & Kepatuhan Platform Catavor.

---
### Rincian Kasus Kepatuhan:
• Nomor Tiket Kepatuhan: **#%s**
• Tanggal Penerbitan: **%s**
• Nama Profil Terdaftar: **%s**
• Entitas Terkait: **%s**%s
• Kategori Dugaan Pelanggaran: **%s**%s

---
### Penjelasan Keputusan & Tindak Lanjut:
%s

---
### Hak Banding & Klarifikasi Mitra (Right to Appeal):
Platform Catavor berkomitmen penuh menjaga ekosistem niaga yang adil, aman, dan transparan. Jika Anda meyakini keputusan ini terjadi karena kekeliruan, atau jika Anda telah melakukan perbaikan serta memiliki dokumen / bukti keabsahan pendukung, Anda berhak mengajukan permohonan banding resmi ke Tim Kepatuhan.

Klik tombol **Ajukan Banding Kepatuhan** di bawah untuk langsung membuka formulir pengaduan resmi dengan draf tiket yang telah disiapkan secara otomatis.`,
		actionHeadline, reportNumber, dateStr, storeTitle, targetName, itemTypeRow, reasonLabel, notesBlock, actionExplanation)
}

// sendModerationEmail dispatches official transactional email to merchant owner via persistent queue
func sendModerationEmail(toEmail, storeTitle, targetName, actionTaken, adminNotes, reportNumber, reasonLabel, storeSlug, itemTypeLabel string) {
	toEmail = strings.TrimSpace(toEmail)
	if toEmail == "" {
		return
	}

	var subject, bodyHTML, category string

	switch actionTaken {
	case "catalog_banned", "account_banned":
		subject, bodyHTML = services.BuildBannedEmail(storeTitle, reasonLabel, adminNotes, reportNumber, toEmail)
		category = "compliance_banned"
	case "catalog_suspended":
		subject, bodyHTML = services.BuildSuspendedEmail(storeTitle, reasonLabel, adminNotes, reportNumber, storeSlug)
		category = "compliance_suspended"
	case "catalog_reactivated":
		subject, bodyHTML = services.BuildRestoredEmail(storeTitle, reportNumber, storeSlug)
		category = "compliance_restored"
	case "warning_issued":
		subject, bodyHTML = services.BuildWarningEmail(storeTitle, targetName, reasonLabel, adminNotes, reportNumber, storeSlug)
		category = "compliance_warning"
	case "item_needs_fix":
		subject, bodyHTML = services.BuildItemNeedsFixEmail(storeTitle, targetName, itemTypeLabel, reasonLabel, adminNotes, reportNumber, storeSlug)
		category = "compliance_item_needs_fix"
	case "item_locked", "item_hidden":
		subject, bodyHTML = services.BuildItemLockedEmail(storeTitle, targetName, itemTypeLabel, reasonLabel, adminNotes, reportNumber, storeSlug)
		category = "compliance_item_locked"
	case "item_restored":
		subject, bodyHTML = services.BuildItemApprovedEmail(storeTitle, targetName, reportNumber, storeSlug)
		category = "compliance_item_restored"
	default:
		subject, bodyHTML = services.BuildWarningEmail(storeTitle, targetName, reasonLabel, adminNotes, reportNumber, storeSlug)
		category = "compliance_warning"
	}

	_, _ = services.EnqueueEmail(toEmail, storeTitle, "Catavor Trust & Safety", subject, bodyHTML, category, reportNumber)
}

// extractStorageKeyFromURL parses the object key from standard or local upload URLs
func extractStorageKeyFromURL(rawURL string) string {
	clean := strings.TrimSpace(rawURL)
	if clean == "" {
		return ""
	}
	if idx := strings.Index(clean, "/uploads/"); idx != -1 {
		return strings.TrimLeft(clean[idx+len("/uploads/"):], "/")
	}
	return strings.TrimLeft(clean, "/")
}

// purgeBannedStore safely and permanently bans a catalog store, deactivates all products,
// secures the slug in blacklisted_slugs, and cleans media files while preserving database integrity
// and relational foreign keys (reports, activity_logs, support_tickets).
func purgeBannedStore(tx *gorm.DB, storeID uint, storeSlug, storeTitle, reportNumber, reasonLabel, reviewerName string) error {
	if storeID == 0 {
		return nil
	}

	var store models.Store
	if err := tx.Where("id = ?", storeID).First(&store).Error; err != nil {
		return err
	}

	cleanSlug := strings.ToLower(strings.TrimSpace(storeSlug))
	if cleanSlug == "" && store.Slug != "" {
		cleanSlug = strings.ToLower(strings.TrimSpace(store.Slug))
	}
	if storeTitle == "" && store.StoreTitle != "" {
		storeTitle = store.StoreTitle
	}

	now := time.Now().UTC()

	// 1. Fetch Owner Email for Blacklist metadata
	var ownerEmail string
	if store.UserID > 0 {
		var u models.User
		if err := tx.Select("id, email").Where("id = ?", store.UserID).First(&u).Error; err == nil {
			ownerEmail = u.Email
		}
	}

	// 2. Insert into blacklisted_slugs table (safe check with Count to avoid ErrRecordNotFound in Postgres tx)
	if cleanSlug != "" {
		var count int64
		_ = tx.Model(&models.BlacklistedSlug{}).Where("LOWER(slug) = ?", cleanSlug).Count(&count).Error
		if count == 0 {
			bannedRecord := models.BlacklistedSlug{
				Slug:         cleanSlug,
				StoreTitle:   storeTitle,
				OwnerEmail:   ownerEmail,
				Reason:       reasonLabel,
				BannedBy:     reviewerName,
				ReportNumber: reportNumber,
				BannedAt:     now,
				CreatedAt:    now,
			}
			if err := tx.Create(&bannedRecord).Error; err != nil {
				return err
			}
		}
	}

	// 3. Update Store Status in database: mark as banned, blacklisted, and record timestamp
	if err := tx.Model(&models.Store{}).Where("id = ?", storeID).Updates(map[string]interface{}{
		"dormancy_status":       "banned",
		"is_suspended":          true,
		"is_blacklisted":        true,
		"dormancy_banned_at":    &now,
		"suspension_reason":     "moderation_violation",
	}).Error; err != nil {
		return err
	}

	// 4. Deactivate and hide all products of this store in catalog
	if err := tx.Model(&models.Product{}).Where("store_id = ?", storeID).Updates(map[string]interface{}{
		"is_active":             false,
		"moderation_status":     "banned",
		"moderation_reason":     reasonLabel,
		"is_shipping_available": false,
	}).Error; err != nil {
		return err
	}

	// 5. Update User Status if owner has no other active stores
	if store.UserID > 0 {
		var remainingActiveCount int64
		_ = tx.Model(&models.Store{}).
			Where("user_id = ? AND id != ? AND dormancy_status != 'banned' AND is_blacklisted = false", store.UserID, storeID).
			Count(&remainingActiveCount).Error
		if remainingActiveCount == 0 {
			_ = tx.Model(&models.User{}).Where("id = ?", store.UserID).Update("is_blacklisted", true).Error
		}
	}

	// 6. Asynchronously Clean Physical Media Files (Logo, Banner, Products images)
	cfg := config.LoadConfig()
	strg, _ := storage.NewStorageService(cfg)
	ctx := context.Background()

	if store.StoreLogoURL != "" && strg != nil {
		if k := extractStorageKeyFromURL(store.StoreLogoURL); k != "" {
			_ = strg.Delete(ctx, k)
		}
	}
	if store.PromoBanner != "" && strg != nil {
		if k := extractStorageKeyFromURL(store.PromoBanner); k != "" {
			_ = strg.Delete(ctx, k)
		}
	}

	// Delete Product images from storage
	var products []models.Product
	if err := tx.Preload("Images").Where("store_id = ?", storeID).Find(&products).Error; err == nil {
		for _, prod := range products {
			if prod.ImageURL != "" && strg != nil {
				if k := extractStorageKeyFromURL(prod.ImageURL); k != "" {
					_ = strg.Delete(ctx, k)
				}
			}
			for _, pImg := range prod.Images {
				if pImg.ImageURL != "" && strg != nil {
					if k := extractStorageKeyFromURL(pImg.ImageURL); k != "" {
						_ = strg.Delete(ctx, k)
					}
				}
			}
		}
	}

	// Clean local directory folders on disk if local storage driver is used
	if cfg.StorageLocalRoot != "" {
		_ = os.RemoveAll(filepath.Join(cfg.StorageLocalRoot, "stores", fmt.Sprintf("%d", storeID)))
		_ = os.RemoveAll(filepath.Join(cfg.StorageLocalRoot, fmt.Sprintf("%d", storeID)))
	}
	if cfg.StorageDir != "" {
		_ = os.RemoveAll(filepath.Join(cfg.StorageDir, "stores", fmt.Sprintf("%d", storeID)))
	}

	log.Info().
		Uint("store_id", storeID).
		Str("slug", cleanSlug).
		Str("report", reportNumber).
		Msg("Permanently banned store, locked slug in blacklisted_slugs, and purged media files safely.")

	if ownerEmail != "" {
		go services.SendSingleCatalogBannedEmail(ownerEmail, storeTitle, cleanSlug, reportNumber, reasonLabel, reviewerName)
	}

	return nil
}

type ReviewItemRequest struct {
	ProductID  uint   `json:"product_id"`
	Decision   string `json:"decision"` // "approve" or "reject"
	AdminNotes string `json:"admin_notes"`
}

// ReviewRemediatedItem allows platform admin to approve or reject a product that was resubmitted by a merchant.
func (h *ReportHandler) ReviewRemediatedItem(c *fiber.Ctx) error {
	var req ReviewItemRequest
	if err := c.BodyParser(&req); err != nil || req.ProductID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format permintaan tinjauan tidak valid.",
		})
	}

	var product models.Product
	if err := database.DB.Preload("Store").Preload("Store.User").Where("id = ?", req.ProductID).First(&product).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Produk tidak ditemukan.",
		})
	}

	now := time.Now().UTC()
	storeTitle := "Katalog Digital"
	storeSlug := ""
	ownerEmail := ""
	if product.Store != nil {
		storeTitle = product.Store.StoreTitle
		storeSlug = product.Store.Slug
		if product.Store.User != nil {
			ownerEmail = product.Store.User.Email
		}
	}

	reportNum := fmt.Sprintf("REV-%d", product.ID)

	if req.Decision == "approve" {
		product.IsActive = true
		product.ModerationStatus = "none"
		product.ModerationReason = ""
		product.ModeratedAt = nil
		product.ResubmittedAt = nil
		_ = database.DB.Save(&product).Error
		_ = database.DB.Table("faunas").Where("id = ?", product.ID).Updates(map[string]interface{}{
			"is_active":         true,
			"moderation_status": "none",
			"moderation_reason": "",
			"moderated_at":      nil,
			"resubmitted_at":    nil,
		}).Error

		// Invalidate cache
		InvalidateReportMetricsCache()

		// Send email to merchant
		if ownerEmail != "" {
			sub, bHTML := services.BuildItemApprovedEmail(storeTitle, product.Name, reportNum, storeSlug)
			_, _ = services.EnqueueEmail(ownerEmail, storeTitle, "Catavor Trust & Safety", sub, bHTML, "compliance_item_approved", reportNum)
		}

		// Create in-app notification
		notif := models.Notification{
			ID:            fmt.Sprintf("notif_appr_%d_%d", product.ID, now.UnixNano()),
			TargetType:    "single_store",
			TargetID:      product.StoreID,
			TargetName:    storeTitle,
			Title:         "Perbaikan Produk Telah Disetujui",
			Category:      "PEMULIHAN",
			Message:       fmt.Sprintf("Perbaikan untuk produk \"%s\" telah disetujui oleh Tim Kepatuhan. Produk kini telah aktif kembali secara publik.", product.Name),
			Type:          "success",
			ActionEnabled: true,
			ActionType:    "detail",
			LinkSubTab:    "items",
			ActionLabel:   "Lihat Produk di Katalog →",
			ActionURL:     fmt.Sprintf("/%s", storeSlug),
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		_ = database.DB.Create(&notif).Error
		services.GetNotificationHub().Broadcast(&notif)

		return c.JSON(fiber.Map{
			"success": true,
			"message": "Perbaikan produk berhasil disetujui. Produk telah aktif kembali di katalog publik.",
			"data":    product,
		})
	}

	// Decision == "reject" (needs further remediation)
	notes := strings.TrimSpace(req.AdminNotes)
	if notes == "" {
		notes = "Perbaikan yang diajukan belum memenuhi standar kepatuhan komunitas. Silakan periksa kembali foto dan deskripsi produk."
	}

	product.IsActive = false
	product.ModerationStatus = "needs_fix"
	product.ModerationReason = notes
	product.ModeratedAt = &now
	_ = database.DB.Save(&product).Error
	_ = database.DB.Table("faunas").Where("id = ?", product.ID).Updates(map[string]interface{}{
		"is_active":         false,
		"moderation_status": "needs_fix",
		"moderation_reason": notes,
		"moderated_at":      &now,
	}).Error

	InvalidateReportMetricsCache()

	itemTypeLabel := mapProductTypeLabel(product.ProductType)
	if ownerEmail != "" {
		sub, bHTML := services.BuildItemNeedsFixEmail(storeTitle, product.Name, itemTypeLabel, "Revisi Belum Sesuai", notes, reportNum, storeSlug)
		_, _ = services.EnqueueEmail(ownerEmail, storeTitle, "Catavor Trust & Safety", sub, bHTML, "compliance_item_needs_fix", reportNum)
	}

	notif := models.Notification{
		ID:            fmt.Sprintf("notif_revisi_%d_%d", product.ID, now.UnixNano()),
		TargetType:    "single_store",
		TargetID:      product.StoreID,
		TargetName:    storeTitle,
		Title:         "Perbaikan Produk Memerlukan Revisi Lanjutan",
		Category:      "PERBAIKAN",
		Message:       fmt.Sprintf("Perbaikan untuk produk \"%s\" belum disetujui: %s", product.Name, notes),
		Type:          "warning",
		ActionEnabled: true,
		ActionType:    "detail",
		LinkSubTab:    "items",
		ActionLabel:   "Perbaiki Produk Sekarang →",
		ActionURL:     fmt.Sprintf("/%s/admin/items", storeSlug),
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	_ = database.DB.Create(&notif).Error
	services.GetNotificationHub().Broadcast(&notif)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Pengajuan ulang ditolak. Catatan revisi telah dikirimkan ke merchant.",
		"data":    product,
	})
}


