package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/smtp"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"
	"catavor-backend/internal/services"

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
	var pendingCount, investigatingCount, actionCount, dismissedCount, resolvedCount, totalCount int64
	db.Model(&models.Report{}).Where("status = ?", "pending").Count(&pendingCount)
	db.Model(&models.Report{}).Where("status = ?", "investigating").Count(&investigatingCount)
	db.Model(&models.Report{}).Where("status = ?", "action_taken").Count(&actionCount)
	db.Model(&models.Report{}).Where("status = ?", "dismissed").Count(&dismissedCount)
	db.Model(&models.Report{}).Where("status = ?", "resolved").Count(&resolvedCount)
	db.Model(&models.Report{}).Count(&totalCount)

	metrics := map[string]int64{
		"pending":       pendingCount,
		"investigating": investigatingCount,
		"action_taken":  actionCount,
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

	if fauna != nil {
		report.FaunaID = &fauna.ID
		report.ItemName = itemName
		report.ItemType = fauna.ProductType
	} else if req.TargetType == "item" && itemName != "" {
		report.ItemName = itemName
		if req.FaunaID != nil && *req.FaunaID > 0 {
			report.FaunaID = req.FaunaID
			var f models.Fauna
			if err := database.DB.Select("id, product_type").Where("id = ?", *req.FaunaID).First(&f).Error; err == nil {
				report.ItemType = f.ProductType
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
		if r.ItemType == "" && r.Fauna != nil && r.Fauna.ProductType != "" {
			r.ItemType = r.Fauna.ProductType
		}
		var activeCount int64
		subQ := database.DB.Model(&models.Report{}).
			Where("store_id = ? AND status IN ('pending', 'investigating')", r.StoreID)
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
	actQ := database.DB.Where("store_id = ? AND id != ? AND status IN ('pending', 'investigating')", report.StoreID, report.ID)
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
			case "item_hidden":
				if report.FaunaID != nil && *report.FaunaID > 0 {
					if err := tx.Model(&models.Product{}).Where("id = ? AND store_id = ?", *report.FaunaID, report.StoreID).Updates(map[string]interface{}{
						"is_active":             false,
						"moderation_status":     "hidden",
						"moderation_reason":     adminNotes,
						"is_shipping_available": false,
					}).Error; err != nil {
						return err
					}
				}
			case "item_restored":
				if report.FaunaID != nil && *report.FaunaID > 0 {
					if err := tx.Model(&models.Product{}).Where("id = ? AND store_id = ?", *report.FaunaID, report.StoreID).Updates(map[string]interface{}{
						"is_active":             true,
						"moderation_status":     "none",
						"moderation_reason":     "",
						"is_shipping_available": true,
					}).Error; err != nil {
						return err
					}
				}
			case "catalog_suspended":
				if report.StoreID > 0 {
					if err := tx.Model(&models.Store{}).Where("id = ?", report.StoreID).Updates(map[string]interface{}{
						"dormancy_status":       "suspended",
						"suspension_reason":     "moderation_violation",
						"dormancy_suspended_at": &now,
					}).Error; err != nil {
						return err
					}
				}
			case "catalog_reactivated":
				if report.StoreID > 0 {
					if err := tx.Model(&models.Store{}).Where("id = ?", report.StoreID).Updates(map[string]interface{}{
						"dormancy_status":       "active",
						"suspension_reason":     "none",
						"dormancy_suspended_at": nil,
					}).Error; err != nil {
						return err
					}
				}
			}
		}

		// D. Generate In-App Notification for Merchant (models.Notification)
		if report.StoreID > 0 && actionTaken != "none" {
			targetEntityName := report.StoreTitle
			itemTypeLabel := ""
			rawItemType := report.ItemType
			if report.TargetType == "item" {
				if report.ItemName != "" {
					targetEntityName = report.ItemName
				}
				if rawItemType == "" && report.FaunaID != nil && *report.FaunaID > 0 {
					var f models.Fauna
					if err := tx.Select("id, product_type").Where("id = ?", *report.FaunaID).First(&f).Error; err == nil {
						rawItemType = f.ProductType
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
				if actionTaken == "catalog_reactivated" {
					actionURL = fmt.Sprintf("/%s/admin/settings", report.StoreSlug)
					targetSubTab = "settings"
					actionType = "navigate"
				}

				notif := models.Notification{
					ID:            fmt.Sprintf("notif_mod_%d_%d", report.StoreID, now.UnixNano()),
					TargetType:    "single_store",
					TargetID:      report.StoreID,
					TargetName:    report.StoreTitle,
					Title:         notifTitle,
					Category:      "KEAMANAN",
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
	merchantEmail := ""
	if report.Store != nil && report.Store.User != nil && report.Store.User.Email != "" {
		merchantEmail = report.Store.User.Email
	}
	if merchantEmail != "" && actionTaken != "none" {
		targetEntityName := report.StoreTitle
		if report.TargetType == "item" && report.ItemName != "" {
			targetEntityName = report.ItemName
		}
		go sendModerationEmail(merchantEmail, report.StoreTitle, targetEntityName, actionTaken, adminNotes, report.ReportNumber)
	}

	// C. Invalidate Redis Metrics Cache
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
	case "item_hidden":
		return "Penonaktifan Sementara Item Katalog",
			fmt.Sprintf("Item \"%s\" dinonaktifkan sementara dari etalase publik (#%s). Buka rincian untuk informasi banding.", targetName, reportNumber),
			"warning",
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
	case "catalog_reactivated":
		return "Pemulihan Operasional Profil Katalog",
			fmt.Sprintf("Penangguhan untuk profil katalog \"%s\" telah dicabut. Akses kembali normal.", targetName),
			"success",
			"Buka Pengaturan Katalog →"
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
	case "item_hidden":
		actionHeadline = "Penonaktifan Sementara Item Katalog (Takedown)"
		actionExplanation = fmt.Sprintf("Item katalog **%s** telah dinonaktifkan sementara dari etalase publik untuk melindungi keamanan ekosistem niaga. Item tidak dapat dilihat maupun dipesan oleh pengunjung umum selama masa investigasi dan klarifikasi berlangsung.", targetName)
	case "item_restored":
		actionHeadline = "Pemulihan Visibilitas Item Katalog"
		actionExplanation = fmt.Sprintf("Peninjauan atas item katalog **%s** telah selesai dievaluasi. Item telah diaktifkan kembali secara penuh ke etalase publik dan kini dapat diakses normal oleh pelanggan.", targetName)
	case "catalog_suspended":
		actionHeadline = "Penangguhan Operasional Profil Katalog"
		actionExplanation = fmt.Sprintf("Operasional profil katalog **%s** telah ditangguhkan sementara terkait indikasi pelanggaran kebijakan komunitas. Seluruh akses publik dan tautan transaksi dijeda sementara.", storeTitle)
	case "catalog_reactivated":
		actionHeadline = "Pemulihan Operasional Profil Katalog"
		actionExplanation = fmt.Sprintf("Penangguhan atas profil katalog **%s** telah resmi dicabut setelah peninjauan komprehensif. Operasional profil katalog kini telah kembali normal dan aktif sepenuhnya.", storeTitle)
	}

	notesBlock := ""
	if strings.TrimSpace(adminNotes) != "" {
		notesBlock = fmt.Sprintf("\n\n### Catatan & Temuan Peninjau (Trust & Safety):\n> \"%s\"", strings.TrimSpace(adminNotes))
	}

	itemTypeRow := ""
	if targetType == "item" && itemTypeLabel != "" {
		itemTypeRow = fmt.Sprintf("\n• Jenis / Tipe Katalog: **%s**", itemTypeLabel)
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

// sendModerationEmail dispatches official transactional email to merchant owner via SMTP with safe fallback
func sendModerationEmail(toEmail, storeTitle, targetName, actionTaken, adminNotes, reportNumber string) {
	toEmail = strings.TrimSpace(toEmail)
	if toEmail == "" {
		return
	}

	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := os.Getenv("SMTP_PORT")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASSWORD")
	fromEmail := os.Getenv("SMTP_FROM")
	if fromEmail == "" {
		fromEmail = "compliance@catavor.com"
	}

	subject := fmt.Sprintf("[Catavor Kepatuhan] Pemberitahuan Moderasi Konten - #%s", reportNumber)
	headline := "Pemberitahuan Tim Kepatuhan Catavor"
	actionDesc := ""

	switch actionTaken {
	case "warning_issued":
		subject = fmt.Sprintf("[Catavor Kepatuhan] Peringatan Resmi Pelanggaran Konten - #%s", reportNumber)
		headline = "Surat Peringatan Resmi Kepatuhan"
		actionDesc = fmt.Sprintf("Tim Kepatuhan kami telah meninjau laporan masyarakat dan menemukan indikasi ketidaksesuaian kebijakan pada <strong>%s</strong>.", targetName)
	case "item_hidden":
		subject = fmt.Sprintf("[Catavor Kepatuhan] Pemberitahuan Penurunan Item Katalog - #%s", reportNumber)
		headline = "Pemberitahuan Penonaktifan Item Katalog (Takedown)"
		actionDesc = fmt.Sprintf("Item katalog <strong>%s</strong> telah kami nonaktifkan sementara dari etalase publik untuk menjaga keamanan ekosistem niaga.", targetName)
	case "item_restored":
		subject = fmt.Sprintf("[Catavor Kepatuhan] Pemulihan Item Katalog Selesai - #%s", reportNumber)
		headline = "Konfirmasi Pemulihan Item Katalog"
		actionDesc = fmt.Sprintf("Peninjauan atas item katalog <strong>%s</strong> telah selesai. Item telah diaktifkan kembali di etalase katalog Anda.", targetName)
	case "catalog_suspended":
		subject = fmt.Sprintf("[Catavor Kepatuhan] PEMBERITAHUAN PENANGGUHAN PROFIL KATALOG - #%s", reportNumber)
		headline = "Pemberitahuan Penangguhan Operasional Profil Katalog"
		actionDesc = fmt.Sprintf("Operasional profil katalog <strong>%s</strong> telah ditangguhkan sementara terkait pelanggaran standar komunitas.", storeTitle)
	case "catalog_reactivated":
		subject = fmt.Sprintf("[Catavor Kepatuhan] Pemulihan Operasional Profil Katalog Berhasil - #%s", reportNumber)
		headline = "Konfirmasi Pemulihan Akun Profil Katalog"
		actionDesc = fmt.Sprintf("Penangguhan atas profil katalog <strong>%s</strong> telah resmi dicabut. Profil Anda kini telah dapat diakses kembali oleh publik.", storeTitle)
	}

	bodyContent := fmt.Sprintf(`
Halo Mitra Pengelola <strong>%s</strong>,<br><br>
%s<br><br>
<strong>Rincian Kasus:</strong><br>
• Nomor Tiket: <strong>%s</strong><br>
• Entitas Terkait: <strong>%s</strong><br>
• Catatan Resmi Kepatuhan: <em>"%s"</em><br><br>
Jika Anda merasa terdapat kekeliruan atau ingin mengajukan klarifikasi / perbaikan, Anda dapat menghubungi tim kami melalui menu Pusat Bantuan di Portal Mitra Catavor.<br><br>
Salam hangat,<br>
<strong>Tim Kepatuhan & Keamanan Catavor (Trust & Safety)</strong>
`, storeTitle, actionDesc, reportNumber, targetName, adminNotes)

	msg := []byte(fmt.Sprintf("From: Catavor Trust & Safety <%s>\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: text/html; charset=UTF-8\r\n\r\n"+
		`<!DOCTYPE html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; padding: 20px;">`+
		`<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">`+
		`<div style="background-color: #0f172a; padding: 24px; text-align: center; color: #ffffff;">`+
		`<h2 style="margin: 0; font-size: 1.25rem;">%s</h2>`+
		`</div>`+
		`<div style="padding: 24px;">`+
		`%s`+
		`</div>`+
		`<div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 0.75rem; color: #64748b;">`+
		`Email ini dikirim secara otomatis oleh Sistem Kepatuhan Platform Catavor. Mohon tidak membalas email ini secara langsung.`+
		`</div></div></body></html>`, fromEmail, toEmail, subject, headline, bodyContent))

	if smtpHost != "" && smtpPort != "" {
		addr := fmt.Sprintf("%s:%s", smtpHost, smtpPort)
		var auth smtp.Auth
		if smtpUser != "" && smtpPass != "" {
			auth = smtp.PlainAuth("", smtpUser, smtpPass, smtpHost)
		}
		if err := smtp.SendMail(addr, auth, fromEmail, []string{toEmail}, msg); err != nil {
			log.Warn().Err(err).Str("to", toEmail).Msg("Failed to dispatch moderation email via SMTP")
		} else {
			log.Info().Str("to", toEmail).Str("subject", subject).Msg("Moderation email successfully dispatched via SMTP")
		}
	} else {
		log.Info().
			Str("to", toEmail).
			Str("subject", subject).
			Str("action", actionTaken).
			Msg("SMTP not configured in local environment; simulated moderation email logged successfully")
	}
}
