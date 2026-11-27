package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

const maxAuditExportRows = 10000

type ActivityLogHandler struct {
	db *gorm.DB
}

func NewActivityLogHandler(db *gorm.DB) *ActivityLogHandler {
	return &ActivityLogHandler{db: db}
}

type activityLogFilterParams struct {
	Role        string
	Category    string
	Action      string
	EntityType  string
	SearchQuery string
	StoreID     *uint
	FromTime    *time.Time
	ToTime      *time.Time
}

func parseFlexibleAuditDate(raw string, isEnd bool) *time.Time {
	s := strings.TrimSpace(raw)
	if s == "" {
		return nil
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		u := t.UTC()
		return &u
	}
	wib := time.FixedZone("WIB", 7*3600)
	if d, err := time.ParseInLocation("2006-01-02", s, wib); err == nil {
		if isEnd {
			d = d.Add(24*time.Hour - time.Nanosecond)
		}
		u := d.UTC()
		return &u
	}
	return nil
}

func resolveMerchantAuditStore(db *gorm.DB, c *fiber.Ctx, user *models.User, isSummary bool) (*models.Store, error) {
	storeVal := c.Locals("store")
	var activeStore *models.Store
	if storeVal != nil {
		activeStore = storeVal.(*models.Store)
	} else {
		var store models.Store
		if err := db.Where("user_id = ?", user.ID).Order("id asc").First(&store).Error; err != nil {
			_ = c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"message": "Toko tidak ditemukan.",
			})
			return nil, err
		}
		activeStore = &store
	}

	isStaff := user.IsPlatformStaff()
	if isStaff && activeStore != nil && activeStore.UserID != user.ID {
		canReadAudit := user.IsSuperadmin() ||
			services.GetRBACService().HasPermission(user, "audit:logs:read")
		if !canReadAudit {
			msg := "Akses Ditolak: Anda memerlukan izin 'audit:logs:read' untuk melihat log aktivitas toko lain."
			if isSummary {
				msg = "Akses Ditolak: Anda memerlukan izin 'audit:logs:read' untuk melihat ringkasan aktivitas toko lain."
			}
			_ = c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"message": msg,
			})
			return nil, fiber.ErrForbidden
		}
	}
	if !isStaff && activeStore != nil && (activeStore.DormancyStatus == "suspended" || activeStore.IsSuspended || activeStore.DormancyStatus == "banned" || activeStore.IsBlacklisted) {
		_ = c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "STORE_SUSPENDED",
			"message": "Log aktivitas dinonaktifkan sementara karena operasional profil katalog sedang dibekukan.",
		})
		return nil, fiber.ErrForbidden
	}
	return activeStore, nil
}

func parseActivityLogFilters(c *fiber.Ctx, includeGlobal bool) activityLogFilterParams {
	p := activityLogFilterParams{
		Category:    strings.TrimSpace(strings.ToLower(c.Query("category", "all"))),
		Action:      strings.TrimSpace(c.Query("action", "")),
		EntityType:  strings.TrimSpace(strings.ToLower(c.Query("entity_type", ""))),
		SearchQuery: strings.TrimSpace(c.Query("q", "")),
		FromTime:    parseFlexibleAuditDate(c.Query("from", ""), false),
		ToTime:      parseFlexibleAuditDate(c.Query("to", ""), true),
	}
	if includeGlobal {
		p.Role = strings.TrimSpace(strings.ToLower(c.Query("role", "all")))
		storeIDParam := strings.TrimSpace(c.Query("store_id", ""))
		if storeIDParam != "" && storeIDParam != "all" {
			if sID, err := strconv.ParseUint(storeIDParam, 10, 64); err == nil {
				u := uint(sID)
				p.StoreID = &u
			}
		}
	}
	return p
}

func applyActivityLogFilters(query *gorm.DB, p activityLogFilterParams, includeActorEmailInSearch bool) *gorm.DB {
	if p.StoreID != nil {
		query = query.Where("store_id = ?", *p.StoreID)
	}
	if p.Role != "" && p.Role != "all" {
		if p.Role == "staff" {
			query = query.Where("actor_role <> '' AND actor_role NOT IN ?", []string{"merchant", "system"})
		} else {
			query = query.Where("LOWER(actor_role) = ?", p.Role)
		}
	}
	if p.Category != "" && p.Category != "all" {
		query = query.Where("LOWER(category) = ?", p.Category)
	}
	if p.Action != "" && p.Action != "all" {
		query = query.Where("action = ?", p.Action)
	}
	if p.EntityType != "" && p.EntityType != "all" {
		query = query.Where("LOWER(entity_type) = ?", p.EntityType)
	}
	if p.FromTime != nil {
		query = query.Where("created_at >= ?", *p.FromTime)
	}
	if p.ToTime != nil {
		query = query.Where("created_at <= ?", *p.ToTime)
	}
	if p.SearchQuery != "" {
		escapedQuery := escapeLikePattern(p.SearchQuery)
		likePattern := "%" + escapedQuery + "%"
		if query.Statement != nil && query.Statement.Dialector != nil && query.Statement.Dialector.Name() == "postgres" {
			if includeActorEmailInSearch {
				query = query.Where("(description ILIKE ? OR entity_title ILIKE ? OR actor_name ILIKE ? OR actor_email ILIKE ? OR action ILIKE ? OR ip_address ILIKE ?)",
					likePattern, likePattern, likePattern, likePattern, likePattern, likePattern)
			} else {
				query = query.Where("(description ILIKE ? OR entity_title ILIKE ? OR actor_name ILIKE ? OR action ILIKE ? OR ip_address ILIKE ?)",
					likePattern, likePattern, likePattern, likePattern, likePattern)
			}
		} else {
			if includeActorEmailInSearch {
				query = query.Where("(LOWER(description) LIKE LOWER(?) ESCAPE '\\' OR LOWER(entity_title) LIKE LOWER(?) ESCAPE '\\' OR LOWER(actor_name) LIKE LOWER(?) ESCAPE '\\' OR LOWER(actor_email) LIKE LOWER(?) ESCAPE '\\' OR LOWER(action) LIKE LOWER(?) ESCAPE '\\' OR LOWER(ip_address) LIKE LOWER(?) ESCAPE '\\')",
					likePattern, likePattern, likePattern, likePattern, likePattern, likePattern)
			} else {
				query = query.Where("(LOWER(description) LIKE LOWER(?) ESCAPE '\\' OR LOWER(entity_title) LIKE LOWER(?) ESCAPE '\\' OR LOWER(actor_name) LIKE LOWER(?) ESCAPE '\\' OR LOWER(action) LIKE LOWER(?) ESCAPE '\\' OR LOWER(ip_address) LIKE LOWER(?) ESCAPE '\\')",
					likePattern, likePattern, likePattern, likePattern, likePattern)
			}
		}
	}
	return query
}

func writeAuditExportResponse(c *fiber.Ctx, db *gorm.DB, user *models.User, store *models.Store, isGlobal bool, filters activityLogFilterParams) error {
	format := strings.ToLower(strings.TrimSpace(c.Query("format", "csv")))
	if format != "json" && format != "csv" {
		format = "csv"
	}

	query := db.Model(&models.ActivityLog{})
	query = applyActivityLogFilters(query, filters, isGlobal)

	var logs []models.ActivityLog
	if err := query.Order("created_at DESC, id DESC").Limit(maxAuditExportRows).Find(&logs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengekspor data audit trail.",
		})
	}

	var storeID *uint
	actorRole := user.PlatformStaffRoleLabel()
	actionName := "audit.logs_exported"
	category := "superadmin"
	entityType := "audit_log"
	entityTitle := fmt.Sprintf("Platform Audit Trail (%s)", strings.ToUpper(format))
	prefix := "catavor-audit-trail"
	if !isGlobal && store != nil {
		sID := store.ID
		storeID = &sID
		actorRole = "merchant"
		actionName = "activity_log.export"
		category = "security"
		entityTitle = store.StoreTitle
		prefix = fmt.Sprintf("catavor-activity-%s", store.Slug)
	}

	services.RecordActivity(services.RecordActivityParams{
		DB:          db,
		StoreID:     storeID,
		UserID:      &user.ID,
		ActorRole:   actorRole,
		ActorName:   user.Name,
		ActorEmail:  user.Email,
		Action:      actionName,
		Category:    category,
		EntityType:  entityType,
		EntityTitle: entityTitle,
		Description: fmt.Sprintf("Mengekspor %d rekaman audit trail ke format %s.", len(logs), strings.ToUpper(format)),
		Changes: map[string]interface{}{
			"format":       format,
			"record_count": len(logs),
			"category":     filters.Category,
			"role":         filters.Role,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	wib := time.FixedZone("WIB", 7*3600)
	dateStr := time.Now().In(wib).Format("20060102-1504")
	c.Set("Cache-Control", "no-store, no-cache, must-revalidate")

	if format == "json" {
		payload, err := json.MarshalIndent(fiber.Map{
			"exported_at_utc": time.Now().UTC().Format(time.RFC3339),
			"total_exported":  len(logs),
			"data":            logs,
		}, "", "  ")
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal membuat berkas JSON audit trail.",
			})
		}
		c.Set("Content-Type", "application/json; charset=utf-8")
		c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s-%s.json\"", prefix, dateStr))
		return c.Send(payload)
	}

	var buf bytes.Buffer
	if err := services.ExportActivityLogsCSV(&buf, logs); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal membuat berkas CSV audit trail.",
		})
	}
	c.Set("Content-Type", "text/csv; charset=utf-8")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s-%s.csv\"", prefix, dateStr))
	return c.Send(buf.Bytes())
}

// GetStoreActivityLogs returns paginated activity logs for the merchant's active store.
func (h *ActivityLogHandler) GetStoreActivityLogs(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	userVal := c.Locals("user")
	if userVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}
	user := userVal.(*models.User)

	activeStore, err := resolveMerchantAuditStore(h.db, c, user, false)
	if err != nil {
		return nil
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

	filters := parseActivityLogFilters(c, false)
	storeID := activeStore.ID
	filters.StoreID = &storeID

	query := applyActivityLogFilters(h.db.Model(&models.ActivityLog{}), filters, false)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghitung total log aktivitas.",
		})
	}

	var logs []models.ActivityLog
	if err := query.Order("created_at DESC, id DESC").Limit(limit).Offset(offset).Find(&logs).Error; err != nil {
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

// ExportStoreActivityLogs exports tenant-scoped activity logs as CSV (BOM + formula safe) or JSON.
func (h *ActivityLogHandler) ExportStoreActivityLogs(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	userVal := c.Locals("user")
	if userVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}
	user := userVal.(*models.User)

	activeStore, err := resolveMerchantAuditStore(h.db, c, user, false)
	if err != nil {
		return nil
	}

	filters := parseActivityLogFilters(c, false)
	storeID := activeStore.ID
	filters.StoreID = &storeID
	return writeAuditExportResponse(c, h.db, user, activeStore, false, filters)
}

// GetSuperadminAuditLogs returns system-wide audit logs across all stores (RBAC audit:logs:read).
func (h *ActivityLogHandler) GetSuperadminAuditLogs(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	userVal := c.Locals("user")
	if userVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}
	user := userVal.(*models.User)

	// RBAC Permission Check
	if !services.GetRBACServiceForDB(h.db).HasPermission(user, "audit:logs:read") {
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

	filters := parseActivityLogFilters(c, true)
	query := applyActivityLogFilters(h.db.Model(&models.ActivityLog{}), filters, true)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghitung total system audit logs.",
		})
	}

	var logs []models.ActivityLog
	if err := query.Order("created_at DESC, id DESC").Limit(limit).Offset(offset).Find(&logs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat system audit logs.",
		})
	}

	log.Info().
		Uint("actor_id", user.ID).
		Str("actor_email", user.Email).
		Str("role_filter", filters.Role).
		Str("category_filter", filters.Category).
		Int64("total_matched", total).
		Msg("audit_logs_read")

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

// ExportSuperadminAuditLogs exports system-wide audit logs to CSV/JSON with RBAC & audit tracking.
func (h *ActivityLogHandler) ExportSuperadminAuditLogs(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	userVal := c.Locals("user")
	if userVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}
	user := userVal.(*models.User)

	if !services.GetRBACServiceForDB(h.db).HasPermission(user, "audit:logs:read") {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "FORBIDDEN_PERMISSION_REQUIRED",
			"message": "Akses ditolak: Anda memerlukan izin 'audit:logs:read' untuk mengekspor System Audit Trail.",
		})
	}

	filters := parseActivityLogFilters(c, true)
	return writeAuditExportResponse(c, h.db, user, nil, true, filters)
}

// VerifySuperadminAuditChain verifies hash-chain and HMAC integrity across activity logs.
func (h *ActivityLogHandler) VerifySuperadminAuditChain(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	userVal := c.Locals("user")
	if userVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}
	user := userVal.(*models.User)

	if !services.GetRBACServiceForDB(h.db).HasPermission(user, "audit:logs:read") {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "FORBIDDEN_PERMISSION_REQUIRED",
			"message": "Akses ditolak: Anda memerlukan izin 'audit:logs:read' untuk memverifikasi integritas audit trail.",
		})
	}

	limit, _ := strconv.Atoi(c.Query("limit", "5000"))
	report, err := services.VerifyActivityLogChain(h.db, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memverifikasi integritas rantai audit trail.",
		})
	}

	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		UserID:      &user.ID,
		ActorRole:   user.PlatformStaffRoleLabel(),
		ActorName:   user.Name,
		ActorEmail:  user.Email,
		Action:      "audit.chain_verified",
		Category:    "security",
		EntityType:  "audit_log",
		EntityTitle: "Audit Chain Verification",
		Description: fmt.Sprintf("Verifikasi rantai hash audit trail: intact=%v, checked=%d, chained=%d.", report.Intact, report.CheckedCount, report.ChainedCount),
		Changes: map[string]interface{}{
			"intact":                 report.Intact,
			"checked_count":          report.CheckedCount,
			"chained_count":          report.ChainedCount,
			"unchained_legacy_count": report.UnchainedLegacyCount,
			"last_chain_seq":         report.LastChainSeq,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	return c.JSON(fiber.Map{
		"success": true,
		"data":    report,
	})
}

// GetActivitySummary returns activity counts by category for the last 30 days.
func (h *ActivityLogHandler) GetActivitySummary(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	userVal := c.Locals("user")
	if userVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}
	user := userVal.(*models.User)

	activeStore, err := resolveMerchantAuditStore(h.db, c, user, true)
	if err != nil {
		return nil
	}

	thirtyDaysAgo := time.Now().UTC().AddDate(0, 0, -30)

	type CategoryCount struct {
		Category string `json:"category"`
		Count    int64  `json:"count"`
	}

	var counts []CategoryCount
	h.db.Model(&models.ActivityLog{}).
		Select("category, count(*) as count").
		Where("store_id = ? AND created_at >= ?", activeStore.ID, thirtyDaysAgo).
		Group("category").
		Scan(&counts)

	summary := map[string]int64{
		"security":   0,
		"catalog":    0,
		"store":      0,
		"billing":    0,
		"moderation": 0,
		"total":      0,
	}

	for _, item := range counts {
		key := strings.ToLower(strings.TrimSpace(item.Category))
		if key != "" {
			summary[key] = item.Count
		}
		summary["total"] += item.Count
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    summary,
	})
}
