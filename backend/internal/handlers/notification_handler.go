package handlers

import (
	"bufio"
	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/middleware"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"
	"catavor-backend/internal/services"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

type NotificationHandler struct {
	DB  *gorm.DB
	Cfg *config.Config
}

func NewNotificationHandler(db *gorm.DB, opts ...interface{}) *NotificationHandler {
	h := &NotificationHandler{DB: db}
	for _, opt := range opts {
		if cfg, ok := opt.(*config.Config); ok {
			h.Cfg = cfg
		}
	}
	return h
}

var planCodeRegex = regexp.MustCompile(`^[a-z0-9_-]{2,64}$`)

type BroadcastRecipientInput struct {
	Type  string `json:"type"`
	ID    uint   `json:"id"`
	Name  string `json:"name"`
	Slug  string `json:"slug"`
	Email string `json:"email"`
	Plan  string `json:"plan"`
}

type BroadcastRequest struct {
	TargetType            string                    `json:"target_type"`
	TargetPlanCode        string                    `json:"target_plan_code"`
	TargetID              uint                      `json:"target_id"`
	TargetName            string                    `json:"target_name"`
	Recipients            []BroadcastRecipientInput `json:"recipients"`
	Status                string                    `json:"status"`       // 'draft', 'scheduled', 'published'
	ScheduledAt           string                    `json:"scheduled_at"` // RFC3339 / ISO8601 when status='scheduled'
	IdempotencyKey        string                    `json:"idempotency_key"`
	Title                 string                    `json:"title"`
	Category              string                    `json:"category"`
	Message               string                    `json:"message"`
	DetailContent         string                    `json:"detail_content"`
	Type                  string                    `json:"type"`
	ActionEnabled         bool                      `json:"action_enabled"`
	ActionType            string                    `json:"action_type"`
	LinkSubTab            string                    `json:"link_sub_tab"`
	LinkMobileSettingsTab string                    `json:"link_mobile_settings_tab"`
	ActionLabel           string                    `json:"action_label"`
	ActionURL             string                    `json:"action_url"`
	ExpiresInHours        int                       `json:"expires_in_hours"`
	RetentionHours        int                       `json:"retention_hours"`
}

// AdminBroadcastItem merupakan representasi respons terpadu untuk portal Admin (daftar & detail).
type AdminBroadcastItem struct {
	models.Notification
	Recipients  []models.NotificationRecipient `json:"recipients"`
	ReadCount   int64                          `json:"read_count"`
	ClickCount  int64                          `json:"click_count"`
	ReadRatePct float64                        `json:"read_rate_pct"`
	CTRPct      float64                        `json:"ctr_pct"`
}

func roundTwoDecimals(v float64) float64 {
	return math.Round(v*100) / 100
}

func computeRates(item *AdminBroadcastItem) {
	if item == nil {
		return
	}
	if item.TargetAudienceCount > 0 {
		item.ReadRatePct = roundTwoDecimals(math.Min(100, (float64(item.ReadCount)/float64(item.TargetAudienceCount))*100))
	}
	denom := item.ReadCount
	if denom == 0 && item.TargetAudienceCount > 0 {
		denom = item.TargetAudienceCount
	}
	if denom > 0 && item.ClickCount > 0 {
		item.CTRPct = roundTwoDecimals(math.Min(100, (float64(item.ClickCount)/float64(denom))*100))
	}
}

func planConditionSQL(storePlan string) (string, []interface{}) {
	clean := strings.ToLower(strings.TrimSpace(storePlan))
	if clean == "" {
		clean = "free"
	}
	if clean == "pro_starter" || clean == "pro_business" {
		return "LOWER(notifications.target_plan_code) IN ('pro', ?)", []interface{}{clean}
	}
	return "LOWER(notifications.target_plan_code) = ?", []interface{}{clean}
}

func (h *NotificationHandler) isValidPlanCode(planCode string) bool {
	if !planCodeRegex.MatchString(planCode) {
		return false
	}
	if planCode == "pro" {
		return true
	}
	var activeCount int64
	if err := h.DB.Model(&models.SubscriptionPlan{}).Where("is_active = ?", true).Count(&activeCount).Error; err == nil && activeCount > 0 {
		var matchCount int64
		_ = h.DB.Model(&models.SubscriptionPlan{}).
			Where("is_active = ? AND LOWER(code) = ?", true, planCode).
			Count(&matchCount).Error
		return matchCount > 0
	}
	switch planCode {
	case "free", "pro_starter", "pro_business", "enterprise":
		return true
	default:
		return false
	}
}

func normalizeBroadcastStatus(raw string) (string, bool) {
	s := strings.ToLower(strings.TrimSpace(raw))
	if s == "" {
		return "published", true
	}
	switch s {
	case "draft", "scheduled", "published":
		return s, true
	default:
		return "", false
	}
}

func normalizeTargetType(raw string) (string, bool) {
	t := strings.ToLower(strings.TrimSpace(raw))
	if t == "" {
		return "all", true
	}
	switch t {
	case "all", "plan", "specific", "single_store", "single_user":
		return t, true
	default:
		return "", false
	}
}

func parseScheduledTimestamp(raw string) (*time.Time, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, fmt.Errorf("waktu jadwal publikasi wajib diisi")
	}
	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02T15:04",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, trimmed); err == nil {
			utc := parsed.UTC()
			if utc.Before(time.Now().UTC().Add(-1 * time.Minute)) {
				return nil, fmt.Errorf("waktu penjadwalan harus di masa depan")
			}
			return &utc, nil
		}
	}
	return nil, fmt.Errorf("format waktu jadwal tidak valid (gunakan ISO-8601)")
}

func resolveActorRole(user *models.User) string {
	if user == nil {
		return "superadmin"
	}
	role := strings.TrimSpace(user.PlatformStaffRoleLabel())
	if role == "" {
		return "superadmin"
	}
	return role
}

func sanitizeRecipients(notifID string, raw []BroadcastRecipientInput) ([]models.NotificationRecipient, []BroadcastRecipientInput, error) {
	seen := make(map[string]struct{}, len(raw))
	rows := make([]models.NotificationRecipient, 0, len(raw))
	cleanInputs := make([]BroadcastRecipientInput, 0, len(raw))

	for _, item := range raw {
		recType := strings.ToLower(strings.TrimSpace(item.Type))
		if recType != "store" && recType != "user" {
			return nil, nil, fmt.Errorf("tipe penerima '%s' tidak valid (harus 'store' atau 'user')", item.Type)
		}
		if item.ID == 0 {
			return nil, nil, fmt.Errorf("ID penerima spesifik tidak valid")
		}
		key := fmt.Sprintf("%s:%d", recType, item.ID)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}

		cleanName := security.SanitizePlainText(item.Name, 255)
		cleanSlug := security.SanitizePlainText(item.Slug, 255)
		cleanEmail := security.SanitizePlainText(item.Email, 255)
		cleanPlan := strings.ToLower(security.SanitizePlainText(item.Plan, 64))
		if cleanName == "" {
			if recType == "store" {
				cleanName = fmt.Sprintf("Toko #%d", item.ID)
			} else {
				cleanName = fmt.Sprintf("User #%d", item.ID)
			}
		}

		rows = append(rows, models.NotificationRecipient{
			NotificationID: notifID,
			RecipientType:  recType,
			RecipientID:    item.ID,
			RecipientName:  cleanName,
			RecipientSlug:  cleanSlug,
			RecipientEmail: cleanEmail,
			RecipientPlan:  cleanPlan,
			CreatedAt:      time.Now().UTC(),
		})
		cleanInputs = append(cleanInputs, BroadcastRecipientInput{
			Type:  recType,
			ID:    item.ID,
			Name:  cleanName,
			Slug:  cleanSlug,
			Email: cleanEmail,
			Plan:  cleanPlan,
		})
	}
	return rows, cleanInputs, nil
}

func formatSpecificTargetSummary(clean []BroadcastRecipientInput) string {
	if len(clean) == 0 {
		return "Penerima Spesifik"
	}
	if len(clean) == 1 {
		return clean[0].Name
	}
	if len(clean) == 2 {
		return fmt.Sprintf("2 Penerima Terpilih (%s, %s)", clean[0].Name, clean[1].Name)
	}
	return fmt.Sprintf("%d Penerima Terpilih (%s, %s, +%d lainnya)", len(clean), clean[0].Name, clean[1].Name, len(clean)-2)
}

// resolveStoreContext accurately extracts and resolves the store context from query slug, X-Store-Slug header, or c.Locals.
func (h *NotificationHandler) resolveStoreContext(c *fiber.Ctx, user *models.User) (storeID uint, storePlan string, storeCreatedAt time.Time, isSuspended bool, dormancySuspendedAt *time.Time) {
	storePlan = "free"

	requestedSlug := strings.TrimSpace(c.Query("slug"))
	if requestedSlug == "" {
		requestedSlug = strings.TrimSpace(c.Get("X-Store-Slug"))
	}
	if requestedSlug != "" && user != nil {
		var matchedStore models.Store
		if err := h.DB.Where("LOWER(slug) = ? AND user_id = ?", strings.ToLower(requestedSlug), user.ID).First(&matchedStore).Error; err == nil {
			storeID = matchedStore.ID
			storeCreatedAt = matchedStore.CreatedAt
			if matchedStore.Plan != "" {
				storePlan = strings.ToLower(strings.TrimSpace(matchedStore.Plan))
			}
			isSuspended = matchedStore.IsSuspended || matchedStore.DormancyStatus == "suspended"
			dormancySuspendedAt = matchedStore.DormancySuspendedAt
			return
		}
	}

	if store, ok := c.Locals("store").(*models.Store); ok && store != nil {
		storeID = store.ID
		storeCreatedAt = store.CreatedAt
		if store.Plan != "" {
			storePlan = strings.ToLower(strings.TrimSpace(store.Plan))
		}
		isSuspended = store.IsSuspended || store.DormancyStatus == "suspended"
		dormancySuspendedAt = store.DormancySuspendedAt
		return
	}

	return
}

// visibleStoreQuery membangun predikat visibilitas terpadu untuk GetNotifications, MarkAllAsRead, GetNotificationByID, & notificationVisibleTo.
func (h *NotificationHandler) visiblePredicateAndArgs(storeID, userID uint, storePlan string, storeCreatedAt time.Time, now, thirtyDaysAgo time.Time) (string, []interface{}) {
	args := []interface{}{now, now, thirtyDaysAgo}
	base := `
		(notifications.status = '' OR notifications.status IS NULL OR notifications.status = 'published')
		AND notifications.revoked_at IS NULL
		AND (notifications.scheduled_at IS NULL OR notifications.scheduled_at <= ?)
		AND (notifications.expires_at IS NULL OR notifications.expires_at > ?)
		AND notifications.created_at >= ?
	`

	if storeID > 0 {
		storeCutoff := storeCreatedAt.Add(-2 * time.Minute)
		if storeCutoff.Before(thirtyDaysAgo) {
			storeCutoff = thirtyDaysAgo
		}
		planSQL, planArgs := planConditionSQL(storePlan)
		clause := fmt.Sprintf(`%s AND (
			(notifications.target_type = 'single_store' AND notifications.target_id = ?)
			OR (notifications.target_type = 'specific' AND EXISTS (
				SELECT 1 FROM notification_recipients nr
				WHERE nr.notification_id = notifications.id
				  AND nr.recipient_type = 'store'
				  AND nr.recipient_id = ?
			))
			OR (notifications.target_type = 'all' AND notifications.created_at >= ?)
			OR (notifications.target_type = 'plan' AND %s AND notifications.created_at >= ?)
			OR (notifications.target_type = 'single_user' AND notifications.target_id = ? AND notifications.created_at >= ?)
			OR (notifications.target_type = 'specific' AND ? > 0 AND notifications.created_at >= ? AND EXISTS (
				SELECT 1 FROM notification_recipients nr
				WHERE nr.notification_id = notifications.id
				  AND nr.recipient_type = 'user'
				  AND nr.recipient_id = ?
			))
		)`, base, planSQL)

		args = append(args, storeID, storeID, storeCutoff)
		args = append(args, planArgs...)
		args = append(args, storeCutoff, userID, storeCutoff, userID, storeCutoff, userID)
		return clause, args
	}

	if userID > 0 {
		planClean := strings.ToLower(strings.TrimSpace(storePlan))
		if planClean == "" {
			planClean = "free"
		}
		clause := fmt.Sprintf(`%s AND (
			notifications.target_type = 'all'
			OR (notifications.target_type = 'single_user' AND notifications.target_id = ?)
			OR (notifications.target_type = 'single_store' AND notifications.target_id IN (SELECT id FROM stores WHERE user_id = ?))
			OR (notifications.target_type = 'specific' AND EXISTS (
				SELECT 1 FROM notification_recipients nr
				WHERE nr.notification_id = notifications.id
				  AND (
					(nr.recipient_type = 'user' AND nr.recipient_id = ?)
					OR (nr.recipient_type = 'store' AND nr.recipient_id IN (SELECT id FROM stores WHERE user_id = ?))
				  )
			))
			OR (notifications.target_type = 'plan' AND (
				EXISTS (
					SELECT 1 FROM stores s
					WHERE s.user_id = ?
					  AND s.is_blacklisted = false
					  AND (s.dormancy_status IS NULL OR s.dormancy_status <> 'purged')
					  AND (
						LOWER(s.plan) = LOWER(notifications.target_plan_code)
						OR (LOWER(notifications.target_plan_code) = 'pro' AND LOWER(s.plan) IN ('pro', 'pro_starter', 'pro_business'))
					  )
					  AND notifications.created_at >= s.created_at
				)
				OR (
					NOT EXISTS (SELECT 1 FROM stores s2 WHERE s2.user_id = ?)
					AND LOWER(notifications.target_plan_code) = ?
				)
			))
		)`, base)
		args = append(args, userID, userID, userID, userID, userID, userID, planClean)
		return clause, args
	}

	clause := fmt.Sprintf(`%s AND notifications.target_type = 'all'`, base)
	return clause, args
}

// GetNotifications returns active notifications for the authenticated store/user with pagination.
func (h *NotificationHandler) GetNotifications(c *fiber.Ctx) error {
	user, _ := c.Locals("user").(*models.User)
	var userID uint
	if user != nil {
		userID = user.ID
	}

	storeID, storePlan, storeCreatedAt, _, _ := h.resolveStoreContext(c, user)

	if storeID > 0 {
		h.ensureStoreInitialNotifications(storeID, userID)
	}

	now := time.Now().UTC()
	thirtyDaysAgo := now.Add(-30 * 24 * time.Hour)

	page, _ := strconv.Atoi(c.Query("page", "1"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	if limit < 1 {
		limit = 20
	} else if limit > 100 {
		limit = 100
	}
	offset := (page - 1) * limit
	filter := strings.ToLower(strings.TrimSpace(c.Query("filter", "all")))
	categoryParam := strings.ToLower(strings.TrimSpace(c.Query("category", "all")))
	searchParam := strings.ToLower(strings.TrimSpace(c.Query("q", c.Query("search", ""))))

	type NotifResult struct {
		models.Notification
		ReadID      *uint      `json:"-"`
		ReadAtTime  *time.Time `json:"-"`
		ClickAtTime *time.Time `json:"-"`
		DismissTime *time.Time `json:"-"`
	}

	var allResults []NotifResult

	baseQuery := h.DB.Table("notifications").
		Select(`notifications.*,
		        notification_reads.id as read_id,
		        notification_reads.read_at as read_at_time,
		        notification_reads.clicked_at as click_at_time,
		        notification_reads.dismissed_at as dismiss_time`)

	whereSQL, whereArgs := h.visiblePredicateAndArgs(storeID, userID, storePlan, storeCreatedAt, now, thirtyDaysAgo)

	if storeID > 0 {
		baseQuery = baseQuery.
			Joins("LEFT JOIN notification_reads ON notification_reads.notification_id = notifications.id AND notification_reads.store_id = ?", storeID)
	} else {
		baseQuery = baseQuery.
			Joins("LEFT JOIN notification_reads ON notification_reads.notification_id = notifications.id AND ((notification_reads.store_id IS NULL AND notification_reads.user_id = ?) OR notification_reads.store_id IN (SELECT id FROM stores WHERE user_id = ?))", userID, userID)
	}

	baseQuery = baseQuery.
		Where(whereSQL, whereArgs...).
		Where("notification_reads.dismissed_at IS NULL").
		Where("notification_reads.read_at IS NULL OR notification_reads.read_at >= ?", thirtyDaysAgo)

	if err := baseQuery.Order("notifications.created_at DESC").Find(&allResults).Error; err != nil {
		log.Error().Err(err).Msg("Failed to query notifications")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to load notifications",
		})
	}

	var allVisible []models.Notification
	var filtered []models.Notification
	unreadCount := 0
	securityCount := 0
	systemCount := 0
	seenNotifIDs := make(map[string]bool)
	seenContentKeys := make(map[string]bool)

	for _, res := range allResults {
		if seenNotifIDs[res.Notification.ID] {
			continue
		}
		seenNotifIDs[res.Notification.ID] = true

		notif := res.Notification

		// Manual broadcasts (IsBroadcast == true) are NEVER swallowed by title deduplication;
		// Automated system notifications include Message in contentKey so distinct alerts remain visible.
		if !notif.IsBroadcast {
			contentKey := fmt.Sprintf("%s|%s|%s|%d|%s|%s", notif.TargetType, notif.Title, notif.ActionURL, notif.TargetID, notif.Category, notif.Message)
			if seenContentKeys[contentKey] {
				continue
			}
			seenContentKeys[contentKey] = true
		}

		notif.IsRead = res.ReadID != nil && *res.ReadID > 0
		notif.ReadAt = res.ReadAtTime
		notif.ClickedAt = res.ClickAtTime
		notif.DismissedAt = res.DismissTime
		notif.Timestamp = formatRelativeTime(notif.CreatedAt)

		titleLower := strings.ToLower(notif.Title)
		msgLower := strings.ToLower(notif.Message)

		if !notif.IsRead {
			unreadCount++
		}

		catUpper := strings.ToUpper(notif.Category)
		isSecurity := catUpper == "KEAMANAN" || catUpper == "MODERASI" || catUpper == "KEPATUHAN" || catUpper == "SUSPEND" || catUpper == "TIKET" || catUpper == "PERBAIKAN" || catUpper == "PERINGATAN" || catUpper == "PEMULIHAN" || catUpper == "BAHAYA" || catUpper == "DANGER" || notif.Type == "ticket" || notif.Type == "danger" || notif.Type == "warning" || notif.LinkSubTab == "help" || strings.Contains(titleLower, "keamanan") || strings.Contains(titleLower, "moderasi") || strings.Contains(titleLower, "suspend") || strings.Contains(titleLower, "banding") || strings.Contains(titleLower, "cs catavor") || strings.Contains(titleLower, "balasan baru") || strings.Contains(titleLower, "peringatan") || strings.Contains(titleLower, "perbaikan") || strings.Contains(titleLower, "penonaktifan") || strings.Contains(titleLower, "pemblokiran") || strings.Contains(titleLower, "pelanggaran")
		if isSecurity {
			securityCount++
		} else {
			systemCount++
		}

		allVisible = append(allVisible, notif)

		if (filter == "unread" || categoryParam == "unread") && notif.IsRead {
			continue
		}
		if categoryParam == "security" && !isSecurity {
			continue
		} else if categoryParam == "system" && isSecurity {
			continue
		}
		if searchParam != "" {
			catLower := strings.ToLower(notif.Category)
			if !strings.Contains(titleLower, searchParam) &&
				!strings.Contains(msgLower, searchParam) &&
				!strings.Contains(catLower, searchParam) {
				continue
			}
		}

		filtered = append(filtered, notif)
	}

	totalAll := len(allVisible)
	totalFiltered := len(filtered)

	var pagedData []models.Notification
	if offset < totalFiltered {
		end := offset + limit
		if end > totalFiltered {
			end = totalFiltered
		}
		pagedData = filtered[offset:end]
	} else {
		pagedData = []models.Notification{}
	}

	hasMore := (offset + len(pagedData)) < totalFiltered

	return c.JSON(fiber.Map{
		"data":           pagedData,
		"unread_count":   unreadCount,
		"read_count":     totalAll - unreadCount,
		"security_count": securityCount,
		"system_count":   systemCount,
		"total":          totalAll,
		"total_all":      totalAll,
		"total_filtered": totalFiltered,
		"page":           page,
		"limit":          limit,
		"has_more":       hasMore,
	})
}

// GetNotificationByID mengambil satu notifikasi milik merchant secara aman untuk deep-link URL (?id=...).
func (h *NotificationHandler) GetNotificationByID(c *fiber.Ctx) error {
	notifID := strings.TrimSpace(c.Params("id"))
	if notifID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID notifikasi wajib diisi"})
	}

	user, _ := c.Locals("user").(*models.User)
	var userID uint
	if user != nil {
		userID = user.ID
	}
	storeID, storePlan, storeCreatedAt, _, _ := h.resolveStoreContext(c, user)
	if userID == 0 && storeID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Sesi tidak valid."})
	}

	if !h.notificationVisibleTo(storeID, userID, storePlan, storeCreatedAt, notifID) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Notifikasi tidak ditemukan"})
	}

	var notif models.Notification
	if err := h.DB.Where("id = ?", notifID).First(&notif).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Notifikasi tidak ditemukan"})
	}

	var readRec models.NotificationRead
	readQ := h.DB.Where("notification_id = ?", notifID)
	if storeID > 0 {
		readQ = readQ.Where("store_id = ?", storeID)
	} else {
		readQ = readQ.Where("store_id IS NULL AND user_id = ?", userID)
	}
	if err := readQ.First(&readRec).Error; err == nil {
		if readRec.DismissedAt != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Notifikasi telah disembunyikan"})
		}
		notif.IsRead = true
		rAt := readRec.ReadAt
		notif.ReadAt = &rAt
		notif.ClickedAt = readRec.ClickedAt
		notif.DismissedAt = readRec.DismissedAt
	}
	notif.Timestamp = formatRelativeTime(notif.CreatedAt)

	return c.JSON(fiber.Map{
		"success":      true,
		"data":         notif,
		"notification": notif,
	})
}

// notificationVisibleTo memeriksa apakah notifikasi aktif, terbit, tidak dicabut, dan benar-benar ditujukan
// untuk konteks toko/pengguna pemanggil (mencegah IDOR serta kebocoran spesifik/plan).
func (h *NotificationHandler) notificationVisibleTo(storeID, userID uint, storePlan string, storeCreatedAt time.Time, notifID string) bool {
	if storeID == 0 && userID == 0 {
		return false
	}

	now := time.Now().UTC()
	thirtyDaysAgo := now.Add(-30 * 24 * time.Hour)
	whereSQL, whereArgs := h.visiblePredicateAndArgs(storeID, userID, storePlan, storeCreatedAt, now, thirtyDaysAgo)

	var count int64
	err := h.DB.Model(&models.Notification{}).
		Where("notifications.id = ?", notifID).
		Where(whereSQL, whereArgs...).
		Count(&count).Error
	if err != nil {
		log.Error().Err(err).Str("notification_id", notifID).Msg("gagal memeriksa visibilitas notifikasi")
		return false
	}
	return count > 0
}

// upsertNotificationRead mencatat read_at, clicked_at, dan/atau dismissed_at secara aman untuk store_id > 0 maupun store_id = NULL.
func (h *NotificationHandler) upsertNotificationRead(storeID, userID uint, notifID string, setRead, setClick, setDismiss bool) error {
	now := time.Now().UTC()
	var storePtr *uint
	if storeID > 0 {
		sid := storeID
		storePtr = &sid
	}

	applyFields := func(rec *models.NotificationRead) {
		if setRead && rec.ReadAt.IsZero() {
			rec.ReadAt = now
		} else if setRead {
			rec.ReadAt = now
		}
		if setClick && rec.ClickedAt == nil {
			rec.ClickedAt = &now
		}
		if setDismiss && rec.DismissedAt == nil {
			rec.DismissedAt = &now
		}
	}

	findExisting := func() (*models.NotificationRead, error) {
		var rec models.NotificationRead
		q := h.DB.Where("notification_id = ?", notifID)
		if storeID > 0 {
			q = q.Where("store_id = ?", storeID)
		} else {
			q = q.Where("store_id IS NULL AND user_id = ?", userID)
		}
		if err := q.First(&rec).Error; err != nil {
			return nil, err
		}
		return &rec, nil
	}

	existing, err := findExisting()
	if err == nil && existing != nil {
		applyFields(existing)
		return h.DB.Save(existing).Error
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	newRec := models.NotificationRead{
		NotificationID: notifID,
		StoreID:        storePtr,
		UserID:         userID,
		ReadAt:         now,
	}
	if setClick {
		newRec.ClickedAt = &now
	}
	if setDismiss {
		newRec.DismissedAt = &now
	}

	if cErr := h.DB.Create(&newRec).Error; cErr != nil {
		// Handle concurrent insert conflict cleanly
		if retryExisting, rErr := findExisting(); rErr == nil && retryExisting != nil {
			applyFields(retryExisting)
			return h.DB.Save(retryExisting).Error
		}
		return cErr
	}
	return nil
}

// MarkAsRead marks a specific notification as read for the store or user.
func (h *NotificationHandler) MarkAsRead(c *fiber.Ctx) error {
	notifID := strings.TrimSpace(c.Params("id"))
	if notifID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Notification ID is required"})
	}

	user, _ := c.Locals("user").(*models.User)
	var userID uint
	if user != nil {
		userID = user.ID
	}
	storeID, storePlan, storeCreatedAt, _, _ := h.resolveStoreContext(c, user)

	if userID == 0 && storeID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Sesi tidak valid."})
	}

	if !h.notificationVisibleTo(storeID, userID, storePlan, storeCreatedAt, notifID) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Notifikasi tidak ditemukan"})
	}

	if err := h.upsertNotificationRead(storeID, userID, notifID, true, false, false); err != nil {
		log.Error().Err(err).Str("notif_id", notifID).Msg("Failed to mark notification as read")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to mark notification as read"})
	}
	database.InvalidateBroadcastCache(c.Context())

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Notification marked as read",
	})
}

// TrackClick mencatat klik CTA pada notifikasi (sekaligus menandai dibaca secara idempoten) untuk analitik CTR.
func (h *NotificationHandler) TrackClick(c *fiber.Ctx) error {
	notifID := strings.TrimSpace(c.Params("id"))
	if notifID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID notifikasi wajib diisi"})
	}

	user, _ := c.Locals("user").(*models.User)
	var userID uint
	if user != nil {
		userID = user.ID
	}
	storeID, storePlan, storeCreatedAt, _, _ := h.resolveStoreContext(c, user)

	if userID == 0 && storeID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Sesi tidak valid."})
	}

	if !h.notificationVisibleTo(storeID, userID, storePlan, storeCreatedAt, notifID) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Notifikasi tidak ditemukan"})
	}

	if err := h.upsertNotificationRead(storeID, userID, notifID, true, true, false); err != nil {
		log.Error().Err(err).Str("notif_id", notifID).Msg("Failed to track notification CTA click")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal mencatat interaksi notifikasi"})
	}
	database.InvalidateBroadcastCache(c.Context())

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Interaksi notifikasi tercatat",
	})
}

// MarkAllAsRead marks all currently unread visible notifications as read for the store.
func (h *NotificationHandler) MarkAllAsRead(c *fiber.Ctx) error {
	user, _ := c.Locals("user").(*models.User)
	var userID uint
	if user != nil {
		userID = user.ID
	}
	storeID, storePlan, storeCreatedAt, _, _ := h.resolveStoreContext(c, user)
	if userID == 0 && storeID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Sesi tidak valid."})
	}

	now := time.Now().UTC()
	thirtyDaysAgo := now.Add(-30 * 24 * time.Hour)
	whereSQL, whereArgs := h.visiblePredicateAndArgs(storeID, userID, storePlan, storeCreatedAt, now, thirtyDaysAgo)

	var unreadNotifIDs []string
	query := h.DB.Table("notifications").Select("notifications.id")
	if storeID > 0 {
		query = query.Joins("LEFT JOIN notification_reads ON notification_reads.notification_id = notifications.id AND notification_reads.store_id = ?", storeID)
	} else {
		query = query.Joins("LEFT JOIN notification_reads ON notification_reads.notification_id = notifications.id AND ((notification_reads.store_id IS NULL AND notification_reads.user_id = ?) OR notification_reads.store_id IN (SELECT id FROM stores WHERE user_id = ?))", userID, userID)
	}

	err := query.
		Where(whereSQL, whereArgs...).
		Where("notification_reads.id IS NULL").
		Pluck("notifications.id", &unreadNotifIDs).Error
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch unread notifications"})
	}

	marked := 0
	for _, notifID := range unreadNotifIDs {
		if err := h.upsertNotificationRead(storeID, userID, notifID, true, false, false); err == nil {
			marked++
		}
	}
	if marked > 0 {
		database.InvalidateBroadcastCache(c.Context())
	}

	return c.JSON(fiber.Map{
		"success":      true,
		"marked_count": marked,
	})
}

// Dismiss marks a notification as dismissed/hidden for the store or user.
func (h *NotificationHandler) Dismiss(c *fiber.Ctx) error {
	notifID := strings.TrimSpace(c.Params("id"))
	user, _ := c.Locals("user").(*models.User)
	var userID uint
	if user != nil {
		userID = user.ID
	}
	storeID, storePlan, storeCreatedAt, _, _ := h.resolveStoreContext(c, user)

	if userID == 0 && storeID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Sesi tidak valid."})
	}

	if !h.notificationVisibleTo(storeID, userID, storePlan, storeCreatedAt, notifID) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Notifikasi tidak ditemukan"})
	}

	if err := h.upsertNotificationRead(storeID, userID, notifID, true, false, true); err != nil {
		log.Error().Err(err).Str("notif_id", notifID).Msg("Failed to dismiss notification")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menyembunyikan notifikasi"})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Notification dismissed",
	})
}

// ClearReadNotifications dismisses all notifications that have already been read by the store.
func (h *NotificationHandler) ClearReadNotifications(c *fiber.Ctx) error {
	user, _ := c.Locals("user").(*models.User)
	var userID uint
	if user != nil {
		userID = user.ID
	}
	storeID, _, _, _, _ := h.resolveStoreContext(c, user)

	now := time.Now().UTC()

	query := h.DB.Model(&models.NotificationRead{}).Where("dismissed_at IS NULL")
	if storeID > 0 {
		query = query.Where("store_id = ?", storeID)
	} else if userID > 0 {
		query = query.Where("store_id IS NULL AND user_id = ?", userID)
	} else {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Identitas pengguna atau toko tidak valid"})
	}

	res := query.Update("dismissed_at", now)
	if res.Error != nil {
		log.Error().Err(res.Error).Msg("Failed to clear read notifications")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal membersihkan riwayat notifikasi"})
	}

	return c.JSON(fiber.Map{
		"success":       true,
		"cleared_count": res.RowsAffected,
		"message":       "Riwayat notifikasi terbaca berhasil dibersihkan",
	})
}

// IssueStreamTicket — POST /api/notifications/ticket
func (h *NotificationHandler) IssueStreamTicket(c *fiber.Ctx) error {
	uid, ok := security.UserIDFromLocals(c.Locals("user_id"))
	if !ok || uid == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"status":  "error",
			"message": "Sesi tidak valid.",
		})
	}

	claims, _ := c.Locals("claims").(*middleware.JWTClaims)
	user, _ := c.Locals("user").(*models.User)
	mfaVerified := claims != nil && claims.MfaVerified
	tokenVer := 0
	if user != nil {
		tokenVer = user.TokenVersion
	} else if claims != nil {
		tokenVer = claims.TokenVersion
	}

	ticket, exp, err := security.IssueSSETicketWithMeta(uid, mfaVerified, tokenVer)
	if err != nil {
		log.Error().Err(err).Uint("user_id", uid).Msg("gagal membuat tiket SSE")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Gagal membuat tiket stream.",
		})
	}

	c.Set(fiber.HeaderCacheControl, "no-store")
	return c.JSON(fiber.Map{
		"status":     "success",
		"ticket":     ticket,
		"expires_in": int(security.SSETicketTTL.Seconds()),
		"expires_at": exp.UTC().Format(time.RFC3339),
	})
}

// Stream handles Server-Sent Events (SSE) for real-time notification streaming.
func (h *NotificationHandler) Stream(c *fiber.Ctx) error {
	user, _ := c.Locals("user").(*models.User)
	var userID uint
	platformRole := ""

	if user != nil {
		userID = user.ID
		platformRole = user.PlatformStaffRoleLabel()
	}

	storeID, storePlan, _, _, _ := h.resolveStoreContext(c, user)

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache, no-transform")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	// Strict Origin-Checked CORS (no wildcard '*') on authenticated SSE stream
	if origin := c.Get("Origin"); origin != "" && middleware.IsOriginAllowed(origin, h.Cfg) {
		c.Set("Access-Control-Allow-Origin", origin)
		c.Set("Access-Control-Allow-Credentials", "true")
		c.Set("Vary", "Origin")
	}

	canReadSupport := false
	if user != nil && user.IsPlatformStaff() {
		canReadSupport = user.IsSuperadmin() || services.GetRBACService().HasPermission(user, "support:tickets:read")
	}

	client := services.GetNotificationHub().Register(userID, storeID, storePlan, platformRole, canReadSupport)
	notifyDone := c.Context().Done()

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		defer func() {
			if r := recover(); r != nil {
				log.Warn().Interface("recover", r).Msg("Recovered from SSE stream writer panic")
			}
			services.GetNotificationHub().Unregister(client)
		}()

		fmt.Fprintf(w, "event: connected\ndata: {\"status\":\"connected\",\"client_id\":\"%s\"}\n\n", client.ID)
		if err := w.Flush(); err != nil {
			return
		}

		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-notifyDone:
				return
			case msg, ok := <-client.Send:
				if !ok {
					return
				}
				fmt.Fprintf(w, "data: %s\n\n", string(msg))
				if err := w.Flush(); err != nil {
					return
				}
			case <-ticker.C:
				fmt.Fprintf(w, ": heartbeat\n\n")
				if err := w.Flush(); err != nil {
					return
				}
			}
		}
	})

	return nil
}

func (h *NotificationHandler) buildAdminBroadcastItem(notif models.Notification) AdminBroadcastItem {
	var recips []models.NotificationRecipient
	_ = h.DB.Where("notification_id = ?", notif.ID).Find(&recips).Error
	if len(recips) == 0 && strings.TrimSpace(notif.TargetRecipients) != "" {
		var legacy []BroadcastRecipientInput
		if err := json.Unmarshal([]byte(notif.TargetRecipients), &legacy); err == nil {
			for _, item := range legacy {
				recips = append(recips, models.NotificationRecipient{
					NotificationID: notif.ID,
					RecipientType:  item.Type,
					RecipientID:    item.ID,
					RecipientName:  item.Name,
					RecipientSlug:  item.Slug,
					RecipientEmail: item.Email,
					RecipientPlan:  item.Plan,
				})
			}
		}
	}

	var agg struct {
		ReadCount  int64
		ClickCount int64
	}
	_ = h.DB.Table("notification_reads").
		Select("COUNT(id) AS read_count, COUNT(clicked_at) AS click_count").
		Where("notification_id = ?", notif.ID).
		Scan(&agg).Error

	item := AdminBroadcastItem{
		Notification: notif,
		Recipients:   recips,
		ReadCount:    agg.ReadCount,
		ClickCount:   agg.ClickCount,
	}
	if item.Recipients == nil {
		item.Recipients = []models.NotificationRecipient{}
	}
	computeRates(&item)
	return item
}

func (h *NotificationHandler) validateAndBuildBroadcastFields(notifID string, req BroadcastRequest, now time.Time) (
	targetType, targetPlanCode, targetName, category, notifType, status string,
	scheduledAt *time.Time,
	actionEnabled bool,
	actionType, detailContent, linkSubTab, linkMobileSettingsTab, actionLabel, actionURL string,
	recipientRows []models.NotificationRecipient,
	targetRecipientsJSON string,
	errMsg string,
) {
	var ok bool
	targetType, ok = normalizeTargetType(req.TargetType)
	if !ok {
		errMsg = "Tipe target penerima tidak valid (gunakan: all, plan, specific, single_store, single_user)"
		return
	}

	status, ok = normalizeBroadcastStatus(req.Status)
	if !ok {
		errMsg = "Status publikasi tidak valid (gunakan: draft, scheduled, published)"
		return
	}

	if status == "scheduled" {
		parsedSched, sErr := parseScheduledTimestamp(req.ScheduledAt)
		if sErr != nil {
			errMsg = sErr.Error()
			return
		}
		scheduledAt = parsedSched
	}

	targetPlanCode = strings.ToLower(strings.TrimSpace(req.TargetPlanCode))
	targetName = security.SanitizePlainText(req.TargetName, 255)

	switch targetType {
	case "all":
		if targetName == "" {
			targetName = "Semua Merchant & Pengguna (Global)"
		}
		targetPlanCode = ""
	case "plan":
		if targetPlanCode == "" {
			errMsg = "Kode paket langganan target wajib dipilih untuk broadcast berbasis paket"
			return
		}
		if !h.isValidPlanCode(targetPlanCode) {
			errMsg = fmt.Sprintf("Kode paket langganan '%s' tidak valid atau tidak aktif", targetPlanCode)
			return
		}
		if targetName == "" {
			targetName = fmt.Sprintf("Paket %s", strings.ToUpper(targetPlanCode))
		}
	case "specific":
		if len(req.Recipients) == 0 {
			errMsg = "Minimal 1 penerima spesifik (toko/pengguna) wajib dipilih"
			return
		}
		rows, cleanInputs, rErr := sanitizeRecipients(notifID, req.Recipients)
		if rErr != nil {
			errMsg = rErr.Error()
			return
		}
		if len(rows) == 0 {
			errMsg = "Minimal 1 penerima spesifik yang valid wajib dipilih"
			return
		}
		recipientRows = rows
		if b, mErr := json.Marshal(cleanInputs); mErr == nil {
			targetRecipientsJSON = string(b)
		}
		if targetName == "" {
			targetName = formatSpecificTargetSummary(cleanInputs)
		}
	case "single_store":
		if req.TargetID == 0 {
			errMsg = "ID toko target wajib diisi"
			return
		}
		if targetName == "" {
			var st models.Store
			if err := h.DB.Select("slug, store_title").Where("id = ?", req.TargetID).First(&st).Error; err == nil {
				if st.StoreTitle != "" {
					targetName = st.StoreTitle
				} else {
					targetName = st.Slug
				}
			}
		}
	case "single_user":
		if req.TargetID == 0 {
			errMsg = "ID pengguna target wajib diisi"
			return
		}
		if targetName == "" {
			var u models.User
			if err := h.DB.Select("name, email").Where("id = ?", req.TargetID).First(&u).Error; err == nil {
				if u.Name != "" {
					targetName = u.Name
				} else {
					targetName = u.Email
				}
			}
		}
	}

	category = strings.ToUpper(security.SanitizePlainText(req.Category, 32))
	if category == "" {
		category = "PENGUMUMAN"
	}
	notifType = strings.ToLower(security.SanitizePlainText(req.Type, 32))
	if notifType == "" {
		notifType = "info"
	}

	actionType = strings.ToLower(strings.TrimSpace(req.ActionType))
	if actionType == "" {
		if req.ActionURL != "" {
			actionType = "external_link"
		} else if req.LinkSubTab != "" {
			actionType = "navigate"
		} else if req.DetailContent != "" {
			actionType = "detail"
		} else {
			actionType = "none"
		}
	}
	switch actionType {
	case "none", "detail", "navigate", "external_link":
	default:
		errMsg = "Tipe aksi sentuh tidak valid"
		return
	}

	actionEnabled = actionType != "none" && req.ActionType != "none" && (req.ActionEnabled || req.ActionType != "")
	if !actionEnabled {
		actionType = "none"
	}

	if actionEnabled {
		switch actionType {
		case "detail":
			detailContent = security.SanitizeRichText(req.DetailContent, 20000)
			if strings.TrimSpace(detailContent) == "" {
				errMsg = "Isi artikel lengkap wajib diisi untuk tipe aksi Artikel Detail"
				return
			}
			actionLabel = security.SanitizePlainText(req.ActionLabel, 128)
		case "navigate":
			linkSubTab = security.SanitizePlainText(req.LinkSubTab, 64)
			if strings.TrimSpace(linkSubTab) == "" {
				errMsg = "Menu internal tujuan wajib dipilih untuk tipe aksi Navigasi Menu"
				return
			}
			if linkSubTab == "settings" {
				linkMobileSettingsTab = security.SanitizePlainText(req.LinkMobileSettingsTab, 64)
			}
			actionLabel = security.SanitizePlainText(req.ActionLabel, 128)
		case "external_link":
			actionURL = security.SanitizeURL(req.ActionURL)
			if strings.TrimSpace(actionURL) == "" {
				errMsg = "URL tautan eksternal yang valid (http/https) wajib diisi"
				return
			}
			actionLabel = security.SanitizePlainText(req.ActionLabel, 128)
		}
	}

	_ = now
	return
}

// SuperadminBroadcast membuat siaran baru (draft, terjadwal, atau langsung tayang) secara atomik dengan validasi & idempotency.
func (h *NotificationHandler) SuperadminBroadcast(c *fiber.Ctx) error {
	user, _ := c.Locals("user").(*models.User)

	var req BroadcastRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format data tidak valid"})
	}

	idemKey := security.SanitizePlainText(strings.TrimSpace(c.Get("Idempotency-Key")), 128)
	if idemKey == "" {
		idemKey = security.SanitizePlainText(strings.TrimSpace(req.IdempotencyKey), 128)
	}
	if idemKey != "" {
		var existing models.Notification
		if err := h.DB.Where("idempotency_key = ?", idemKey).First(&existing).Error; err == nil {
			item := h.buildAdminBroadcastItem(existing)
			return c.Status(fiber.StatusOK).JSON(fiber.Map{
				"success":           true,
				"idempotent_replay": true,
				"message":           "Siaran sudah diproses sebelumnya (idempotent replay).",
				"notification":      item,
				"data":              item,
			})
		}
	}

	title := security.SanitizePlainText(req.Title, 150)
	message := security.SanitizePlainText(req.Message, 2000)
	if title == "" || message == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Judul dan pesan siaran wajib diisi"})
	}

	notifID := "notif_bc_" + uuid.New().String()[:12]
	now := time.Now().UTC()

	targetType, targetPlanCode, targetName, category, notifType, status,
		scheduledAt, actionEnabled, actionType, detailContent, linkSubTab,
		linkMobileSettingsTab, actionLabel, actionURL, recipientRows,
		targetRecipientsJSON, errMsg := h.validateAndBuildBroadcastFields(notifID, req, now)
	if errMsg != "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": errMsg})
	}

	retentionHours := req.RetentionHours
	if retentionHours <= 0 {
		retentionHours = 720
	}

	var createdBy uint
	if user != nil {
		createdBy = user.ID
	}

	var publishedAt *time.Time
	var audienceCount int64
	if status == "published" {
		publishedAt = &now
		audienceCount = services.EstimateBroadcastAudience(h.DB, targetType, targetPlanCode, int64(req.TargetID), int64(len(recipientRows)))
	}

	notif := models.Notification{
		ID:                    notifID,
		TargetType:            targetType,
		TargetPlanCode:        targetPlanCode,
		TargetID:              req.TargetID,
		TargetName:            targetName,
		TargetRecipients:      targetRecipientsJSON,
		IsBroadcast:           true,
		Status:                status,
		ScheduledAt:           scheduledAt,
		PublishedAt:           publishedAt,
		TargetAudienceCount:   audienceCount,
		IdempotencyKey:        idemKey,
		Title:                 title,
		Category:              category,
		Message:               message,
		DetailContent:         detailContent,
		Type:                  notifType,
		ActionEnabled:         actionEnabled,
		ActionType:            actionType,
		LinkSubTab:            linkSubTab,
		LinkMobileSettingsTab: linkMobileSettingsTab,
		ActionLabel:           actionLabel,
		ActionURL:             actionURL,
		RetentionHours:        retentionHours,
		CreatedBy:             createdBy,
		CreatedAt:             now,
		UpdatedAt:             now,
	}

	if req.ExpiresInHours > 0 {
		exp := now.Add(time.Duration(req.ExpiresInHours) * time.Hour)
		if scheduledAt != nil {
			exp = scheduledAt.Add(time.Duration(req.ExpiresInHours) * time.Hour)
		}
		notif.ExpiresAt = &exp
	}

	txErr := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&notif).Error; err != nil {
			return err
		}
		if len(recipientRows) > 0 {
			if err := tx.Create(&recipientRows).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if txErr != nil {
		log.Error().Err(txErr).Msg("notif: gagal menyimpan notifikasi siaran")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menyimpan notifikasi siaran."})
	}

	database.InvalidateBroadcastCache(c.Context())

	if status == "published" {
		services.GetNotificationHub().Broadcast(&notif)
	}

	var userID *uint
	actorName := "System"
	actorEmail := "system@catavor.com"
	if user != nil {
		userID = &user.ID
		actorName = user.Name
		actorEmail = user.Email
	}
	actorRole := resolveActorRole(user)

	services.RecordActivity(services.RecordActivityParams{
		DB:          h.DB,
		UserID:      userID,
		ActorRole:   actorRole,
		ActorName:   actorName,
		ActorEmail:  actorEmail,
		Action:      "admin.broadcast_notification",
		Category:    actorRole,
		EntityType:  "notification",
		EntityTitle: notif.Title,
		Description: fmt.Sprintf("%s menyebarkan siaran '%s' (Status: %s, Target: %s %s).", actorName, notif.Title, notif.Status, notif.TargetType, notif.TargetName),
		Changes: map[string]interface{}{
			"status":           notif.Status,
			"target_type":      notif.TargetType,
			"target_plan_code": notif.TargetPlanCode,
			"target_id":        notif.TargetID,
			"target_name":      notif.TargetName,
			"category":         notif.Category,
			"action_type":      notif.ActionType,
			"audience_count":   notif.TargetAudienceCount,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	item := h.buildAdminBroadcastItem(notif)
	msgText := "Siaran broadcast berhasil dikirim dan dipublikasikan!"
	if status == "draft" {
		msgText = "Draf siaran berhasil disimpan!"
	} else if status == "scheduled" {
		msgText = "Siaran berhasil dijadwalkan!"
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success":      true,
		"message":      msgText,
		"notification": item,
		"data":         item,
	})
}

func (h *NotificationHandler) findAdminBroadcastByParam(rawID string) (models.Notification, error) {
	notifID := strings.TrimSpace(rawID)
	cleanID := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(notifID, "@"), "#"))
	cleanID = strings.TrimPrefix(strings.TrimPrefix(cleanID, "ID:"), "id:")
	cleanID = strings.TrimPrefix(strings.TrimPrefix(cleanID, "ID"), "id")
	cleanID = strings.TrimSpace(cleanID)

	var notif models.Notification
	q := h.DB.Where("is_broadcast = ? OR created_by > 0", true)
	if len(cleanID) >= 8 {
		q = q.Where("(id = ? OR id = ? OR id LIKE ?)", notifID, cleanID, escapeLikePattern(cleanID)+"%")
	} else {
		q = q.Where("(id = ? OR id = ?)", notifID, cleanID)
	}
	err := q.First(&notif).Error
	return notif, err
}

// SuperadminUpdate memperbarui siaran (penuh untuk draft/scheduled; konten/aksi/masa berlaku untuk published).
func (h *NotificationHandler) SuperadminUpdate(c *fiber.Ctx) error {
	existing, err := h.findAdminBroadcastByParam(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Siaran tidak ditemukan"})
	}
	if strings.EqualFold(existing.Status, "revoked") || existing.RevokedAt != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Siaran yang sudah dicabut tidak dapat diedit kembali"})
	}

	var req BroadcastRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format data tidak valid"})
	}

	title := security.SanitizePlainText(req.Title, 150)
	message := security.SanitizePlainText(req.Message, 2000)
	if title == "" || message == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Judul dan pesan siaran wajib diisi"})
	}

	prevStatus := strings.ToLower(strings.TrimSpace(existing.Status))
	if prevStatus == "" {
		prevStatus = "published"
	}

	// Siaran yang sudah terbit hanya boleh mengubah konten/aksi/masa berlaku (target dikunci demi integritas audiens).
	if prevStatus == "published" {
		req.TargetType = existing.TargetType
		req.TargetPlanCode = existing.TargetPlanCode
		req.TargetID = existing.TargetID
		req.Status = "published"
		if len(req.Recipients) == 0 && existing.TargetType == "specific" {
			var curRecips []models.NotificationRecipient
			_ = h.DB.Where("notification_id = ?", existing.ID).Find(&curRecips).Error
			for _, cr := range curRecips {
				req.Recipients = append(req.Recipients, BroadcastRecipientInput{
					Type:  cr.RecipientType,
					ID:    cr.RecipientID,
					Name:  cr.RecipientName,
					Slug:  cr.RecipientSlug,
					Email: cr.RecipientEmail,
					Plan:  cr.RecipientPlan,
				})
			}
		}
	}

	now := time.Now().UTC()
	targetType, targetPlanCode, targetName, category, notifType, status,
		scheduledAt, actionEnabled, actionType, detailContent, linkSubTab,
		linkMobileSettingsTab, actionLabel, actionURL, recipientRows,
		targetRecipientsJSON, errMsg := h.validateAndBuildBroadcastFields(existing.ID, req, now)
	if errMsg != "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": errMsg})
	}

	updates := map[string]interface{}{
		"title":                    title,
		"message":                  message,
		"category":                 category,
		"type":                     notifType,
		"action_enabled":           actionEnabled,
		"action_type":              actionType,
		"detail_content":           detailContent,
		"link_sub_tab":             linkSubTab,
		"link_mobile_settings_tab": linkMobileSettingsTab,
		"action_label":             actionLabel,
		"action_url":               actionURL,
		"updated_at":               now,
	}

	if req.ExpiresInHours > 0 {
		baseTime := now
		if scheduledAt != nil {
			baseTime = *scheduledAt
		} else if existing.PublishedAt != nil {
			baseTime = *existing.PublishedAt
		}
		exp := baseTime.Add(time.Duration(req.ExpiresInHours) * time.Hour)
		updates["expires_at"] = &exp
	} else if req.ExpiresInHours == 0 {
		updates["expires_at"] = nil
	}

	if prevStatus != "published" {
		updates["target_type"] = targetType
		updates["target_plan_code"] = targetPlanCode
		updates["target_id"] = req.TargetID
		updates["target_name"] = targetName
		updates["target_recipients"] = targetRecipientsJSON
		updates["status"] = status
		updates["scheduled_at"] = scheduledAt
		if status == "published" {
			updates["published_at"] = &now
			updates["target_audience_count"] = services.EstimateBroadcastAudience(h.DB, targetType, targetPlanCode, int64(req.TargetID), int64(len(recipientRows)))
		}
	}

	txErr := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Notification{}).Where("id = ?", existing.ID).Updates(updates).Error; err != nil {
			return err
		}
		if prevStatus != "published" {
			if err := tx.Where("notification_id = ?", existing.ID).Delete(&models.NotificationRecipient{}).Error; err != nil {
				return err
			}
			if len(recipientRows) > 0 {
				if err := tx.Create(&recipientRows).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
	if txErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memperbarui siaran"})
	}

	database.InvalidateBroadcastCache(c.Context())

	var updated models.Notification
	_ = h.DB.Where("id = ?", existing.ID).First(&updated).Error
	if prevStatus != "published" && status == "published" {
		services.GetNotificationHub().Broadcast(&updated)
	}

	user, _ := c.Locals("user").(*models.User)
	var userID *uint
	actorName, actorEmail := "System", "system@catavor.com"
	if user != nil {
		userID = &user.ID
		actorName = user.Name
		actorEmail = user.Email
	}
	actorRole := resolveActorRole(user)
	services.RecordActivity(services.RecordActivityParams{
		DB:          h.DB,
		UserID:      userID,
		ActorRole:   actorRole,
		ActorName:   actorName,
		ActorEmail:  actorEmail,
		Action:      "admin.update_notification",
		Category:    actorRole,
		EntityType:  "notification",
		EntityTitle: updated.Title,
		Description: fmt.Sprintf("%s memperbarui siaran '%s' (ID: %s).", actorName, updated.Title, updated.ID),
		IPAddress:   c.IP(),
		UserAgent:   c.Get("User-Agent"),
	})

	item := h.buildAdminBroadcastItem(updated)
	return c.JSON(fiber.Map{
		"success":      true,
		"message":      "Siaran berhasil diperbarui.",
		"notification": item,
		"data":         item,
	})
}

// SuperadminPublish menerbitkan draf atau siaran terjadwal secara instan ke target audiens.
func (h *NotificationHandler) SuperadminPublish(c *fiber.Ctx) error {
	existing, err := h.findAdminBroadcastByParam(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Siaran tidak ditemukan"})
	}
	if strings.EqualFold(existing.Status, "revoked") || existing.RevokedAt != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Siaran yang telah dicabut tidak dapat diterbitkan kembali"})
	}
	if strings.EqualFold(existing.Status, "published") {
		item := h.buildAdminBroadcastItem(existing)
		return c.JSON(fiber.Map{"success": true, "message": "Siaran sudah berstatus terbit.", "data": item, "notification": item})
	}

	now := time.Now().UTC()
	var recipsCount int64
	_ = h.DB.Model(&models.NotificationRecipient{}).Where("notification_id = ?", existing.ID).Count(&recipsCount).Error
	audience := services.EstimateBroadcastAudience(h.DB, existing.TargetType, existing.TargetPlanCode, int64(existing.TargetID), recipsCount)

	if err := h.DB.Model(&models.Notification{}).Where("id = ?", existing.ID).Updates(map[string]interface{}{
		"status":                "published",
		"published_at":          &now,
		"scheduled_at":          nil,
		"target_audience_count": audience,
		"updated_at":            now,
	}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menerbitkan siaran"})
	}

	database.InvalidateBroadcastCache(c.Context())

	var updated models.Notification
	_ = h.DB.Where("id = ?", existing.ID).First(&updated).Error
	services.GetNotificationHub().Broadcast(&updated)

	user, _ := c.Locals("user").(*models.User)
	var userID *uint
	actorName, actorEmail := "System", "system@catavor.com"
	if user != nil {
		userID = &user.ID
		actorName = user.Name
		actorEmail = user.Email
	}
	actorRole := resolveActorRole(user)
	services.RecordActivity(services.RecordActivityParams{
		DB:          h.DB,
		UserID:      userID,
		ActorRole:   actorRole,
		ActorName:   actorName,
		ActorEmail:  actorEmail,
		Action:      "admin.publish_notification",
		Category:    actorRole,
		EntityType:  "notification",
		EntityTitle: updated.Title,
		Description: fmt.Sprintf("%s menerbitkan siaran '%s' secara langsung.", actorName, updated.Title),
		IPAddress:   c.IP(),
		UserAgent:   c.Get("User-Agent"),
	})

	item := h.buildAdminBroadcastItem(updated)
	return c.JSON(fiber.Map{
		"success":      true,
		"message":      "Siaran berhasil diterbitkan dan disebarkan ke penerima!",
		"notification": item,
		"data":         item,
	})
}

// SuperadminRevoke mencabut siaran secara non-destruktif (hilang real-time di merchant, jejak audit & analitik tetap utuh).
func (h *NotificationHandler) SuperadminRevoke(c *fiber.Ctx) error {
	existing, err := h.findAdminBroadcastByParam(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Siaran tidak ditemukan"})
	}
	if strings.EqualFold(existing.Status, "revoked") || existing.RevokedAt != nil {
		item := h.buildAdminBroadcastItem(existing)
		return c.JSON(fiber.Map{"success": true, "message": "Siaran sudah dicabut sebelumnya.", "data": item})
	}

	user, _ := c.Locals("user").(*models.User)
	var actorID uint
	var userID *uint
	actorName, actorEmail := "System", "system@catavor.com"
	if user != nil {
		actorID = user.ID
		userID = &user.ID
		actorName = user.Name
		actorEmail = user.Email
	}

	now := time.Now().UTC()
	if err := h.DB.Model(&models.Notification{}).Where("id = ?", existing.ID).Updates(map[string]interface{}{
		"status":     "revoked",
		"revoked_at": &now,
		"revoked_by": actorID,
		"updated_at": now,
	}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal mencabut siaran"})
	}

	database.InvalidateBroadcastCache(c.Context())
	services.GetNotificationHub().BroadcastRemoval(existing.ID, &existing)

	actorRole := resolveActorRole(user)
	services.RecordActivity(services.RecordActivityParams{
		DB:          h.DB,
		UserID:      userID,
		ActorRole:   actorRole,
		ActorName:   actorName,
		ActorEmail:  actorEmail,
		Action:      "admin.revoke_notification",
		Category:    actorRole,
		EntityType:  "notification",
		EntityTitle: existing.Title,
		Description: fmt.Sprintf("%s mencabut publikasi siaran '%s' secara non-destruktif.", actorName, existing.Title),
		IPAddress:   c.IP(),
		UserAgent:   c.Get("User-Agent"),
	})

	var updated models.Notification
	_ = h.DB.Where("id = ?", existing.ID).First(&updated).Error
	item := h.buildAdminBroadcastItem(updated)
	return c.JSON(fiber.Map{
		"success":      true,
		"message":      "Siaran berhasil dicabut dari etalase notifikasi merchant.",
		"notification": item,
		"data":         item,
	})
}

// SuperadminIndex lists all broadcasted notifications with server-side pagination, search, metrics, and caching.
func (h *NotificationHandler) SuperadminIndex(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.Query("limit", "15"))
	if limit < 1 {
		limit = 15
	} else if limit > 100 {
		limit = 100
	}
	offset := (page - 1) * limit

	status := strings.ToLower(strings.TrimSpace(c.Query("status", "all")))
	target := strings.ToLower(strings.TrimSpace(c.Query("target", "all")))
	category := strings.ToUpper(strings.TrimSpace(c.Query("category", "all")))
	q := strings.TrimSpace(c.Query("q", ""))

	cacheKey := fmt.Sprintf("v2_p%d_l%d_s%s_t%s_c%s_q%s", page, limit, status, target, category, q)
	if cachedData, found := database.GetBroadcastListCache(c.Context(), cacheKey); found && cachedData != "" {
		var cachedResp fiber.Map
		if err := json.Unmarshal([]byte(cachedData), &cachedResp); err == nil {
			c.Set("X-Cache", "HIT-REDIS")
			return c.JSON(cachedResp)
		}
	}

	now := time.Now().UTC()

	applyFilters := func(tx *gorm.DB) *gorm.DB {
		tx = tx.Where("notifications.is_broadcast = true OR notifications.created_by > 0")

		switch status {
		case "active", "published":
			tx = tx.Where("(notifications.status = '' OR notifications.status IS NULL OR notifications.status = 'published') AND notifications.revoked_at IS NULL AND (notifications.expires_at IS NULL OR notifications.expires_at > ?)", now)
		case "draft":
			tx = tx.Where("notifications.status = 'draft'")
		case "scheduled":
			tx = tx.Where("notifications.status = 'scheduled' AND notifications.revoked_at IS NULL")
		case "expired":
			tx = tx.Where("(notifications.status = '' OR notifications.status IS NULL OR notifications.status = 'published') AND notifications.revoked_at IS NULL AND notifications.expires_at IS NOT NULL AND notifications.expires_at <= ?", now)
		case "revoked":
			tx = tx.Where("notifications.status = 'revoked' OR notifications.revoked_at IS NOT NULL")
		}

		if target != "" && target != "all" {
			switch target {
			case "global":
				tx = tx.Where("notifications.target_type = 'all'")
			case "store":
				tx = tx.Where("(notifications.target_type = 'single_store' OR (notifications.target_type = 'specific' AND EXISTS (SELECT 1 FROM notification_recipients nr WHERE nr.notification_id = notifications.id AND nr.recipient_type = 'store')))")
			case "user":
				tx = tx.Where("(notifications.target_type = 'single_user' OR (notifications.target_type = 'specific' AND EXISTS (SELECT 1 FROM notification_recipients nr WHERE nr.notification_id = notifications.id AND nr.recipient_type = 'user')))")
			default:
				tx = tx.Where("notifications.target_type = ?", target)
			}
		}

		if category != "" && category != "ALL" {
			tx = tx.Where("UPPER(notifications.category) = ?", category)
		}

		if q != "" {
			term := "%" + strings.ToLower(q) + "%"
			tx = tx.Where(`(
				LOWER(notifications.title) LIKE ?
				OR LOWER(notifications.message) LIKE ?
				OR LOWER(notifications.target_name) LIKE ?
				OR EXISTS (
					SELECT 1 FROM notification_recipients nr
					WHERE nr.notification_id = notifications.id
					  AND LOWER(nr.recipient_name) LIKE ?
				)
			)`, term, term, term, term)
		}
		return tx
	}

	var totalFiltered int64
	applyFilters(h.DB.Table("notifications")).Count(&totalFiltered)

	type rawBroadcastRow struct {
		models.Notification
		ReadCount  int64 `json:"read_count"`
		ClickCount int64 `json:"click_count"`
	}
	var rows []rawBroadcastRow

	listQ := applyFilters(
		h.DB.Table("notifications").
			Select(`notifications.*, COALESCE(reads.read_cnt, 0) as read_count, COALESCE(reads.click_cnt, 0) as click_count`).
			Joins(`LEFT JOIN (
				SELECT notification_id, COUNT(id) as read_cnt, COUNT(clicked_at) as click_cnt
				FROM notification_reads
				GROUP BY notification_id
			) reads ON reads.notification_id = notifications.id`),
	)

	if err := listQ.Order("notifications.created_at DESC").
		Limit(limit).
		Offset(offset).
		Scan(&rows).Error; err != nil {
		log.Error().Err(err).Msg("Failed to query broadcasts")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memuat riwayat siaran"})
	}

	// Batch load recipients for returned IDs (anti-N+1)
	notifIDs := make([]string, 0, len(rows))
	for _, r := range rows {
		notifIDs = append(notifIDs, r.ID)
	}
	recipMap := make(map[string][]models.NotificationRecipient, len(notifIDs))
	if len(notifIDs) > 0 {
		var allRecips []models.NotificationRecipient
		if err := h.DB.Where("notification_id IN ?", notifIDs).Find(&allRecips).Error; err == nil {
			for _, rec := range allRecips {
				recipMap[rec.NotificationID] = append(recipMap[rec.NotificationID], rec)
			}
		}
	}

	items := make([]AdminBroadcastItem, 0, len(rows))
	for _, r := range rows {
		recips := recipMap[r.ID]
		if len(recips) == 0 && strings.TrimSpace(r.TargetRecipients) != "" {
			var legacy []BroadcastRecipientInput
			if err := json.Unmarshal([]byte(r.TargetRecipients), &legacy); err == nil {
				for _, lr := range legacy {
					recips = append(recips, models.NotificationRecipient{
						NotificationID: r.ID,
						RecipientType:  lr.Type,
						RecipientID:    lr.ID,
						RecipientName:  lr.Name,
						RecipientSlug:  lr.Slug,
						RecipientEmail: lr.Email,
						RecipientPlan:  lr.Plan,
					})
				}
			}
		}
		if recips == nil {
			recips = []models.NotificationRecipient{}
		}
		item := AdminBroadcastItem{
			Notification: r.Notification,
			Recipients:   recips,
			ReadCount:    r.ReadCount,
			ClickCount:   r.ClickCount,
		}
		computeRates(&item)
		items = append(items, item)
	}

	// Single aggregated metrics query (replaces 5 separate COUNT queries)
	var metricsAgg struct {
		TotalBroadcasts     int64
		ActiveBroadcasts    int64
		DraftBroadcasts     int64
		ScheduledBroadcasts int64
		RevokedBroadcasts   int64
		GlobalBroadcasts    int64
		TargetedBroadcasts  int64
	}
	_ = h.DB.Table("notifications").
		Select(`
			COUNT(*) AS total_broadcasts,
			COALESCE(SUM(CASE WHEN (status = '' OR status IS NULL OR status = 'published') AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) THEN 1 ELSE 0 END), 0) AS active_broadcasts,
			COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) AS draft_broadcasts,
			COALESCE(SUM(CASE WHEN status = 'scheduled' AND revoked_at IS NULL THEN 1 ELSE 0 END), 0) AS scheduled_broadcasts,
			COALESCE(SUM(CASE WHEN status = 'revoked' OR revoked_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS revoked_broadcasts,
			COALESCE(SUM(CASE WHEN target_type = 'all' THEN 1 ELSE 0 END), 0) AS global_broadcasts,
			COALESCE(SUM(CASE WHEN target_type != 'all' THEN 1 ELSE 0 END), 0) AS targeted_broadcasts
		`, now).
		Where("is_broadcast = true OR created_by > 0").
		Scan(&metricsAgg).Error

	var engageAgg struct {
		TotalReads  int64
		TotalClicks int64
	}
	_ = h.DB.Table("notification_reads").
		Select("COUNT(id) AS total_reads, COUNT(clicked_at) AS total_clicks").
		Where("notification_id IN (SELECT id FROM notifications WHERE is_broadcast = true OR created_by > 0)").
		Scan(&engageAgg).Error

	avgCTRPct := 0.0
	if engageAgg.TotalReads > 0 && engageAgg.TotalClicks > 0 {
		avgCTRPct = roundTwoDecimals(math.Min(100, (float64(engageAgg.TotalClicks)/float64(engageAgg.TotalReads))*100))
	}

	totalPages := 0
	if totalFiltered > 0 {
		totalPages = int((totalFiltered + int64(limit) - 1) / int64(limit))
	}
	hasMore := page < totalPages

	resp := fiber.Map{
		"success": true,
		"data":    items,
		"metrics": fiber.Map{
			"total_broadcasts":     metricsAgg.TotalBroadcasts,
			"active_broadcasts":    metricsAgg.ActiveBroadcasts,
			"draft_broadcasts":     metricsAgg.DraftBroadcasts,
			"scheduled_broadcasts": metricsAgg.ScheduledBroadcasts,
			"revoked_broadcasts":   metricsAgg.RevokedBroadcasts,
			"global_broadcasts":    metricsAgg.GlobalBroadcasts,
			"targeted_broadcasts":  metricsAgg.TargetedBroadcasts,
			"total_reads":          engageAgg.TotalReads,
			"total_clicks":         engageAgg.TotalClicks,
			"avg_ctr_pct":          avgCTRPct,
		},
		"pagination": fiber.Map{
			"page":        page,
			"limit":       limit,
			"total_items": totalFiltered,
			"total_pages": totalPages,
			"has_more":    hasMore,
		},
	}

	if respBytes, err := json.Marshal(resp); err == nil {
		database.SetBroadcastListCache(c.Context(), cacheKey, string(respBytes), 60*time.Second)
	}

	c.Set("X-Cache", "MISS")
	return c.JSON(resp)
}

// SuperadminGetOne retrieves a single broadcast notification with recipients, read stats, and CTR analytics.
func (h *NotificationHandler) SuperadminGetOne(c *fiber.Ctx) error {
	if strings.TrimSpace(c.Params("id")) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID siaran tidak valid"})
	}
	notif, err := h.findAdminBroadcastByParam(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Siaran tidak ditemukan"})
	}
	item := h.buildAdminBroadcastItem(notif)
	return c.JSON(fiber.Map{
		"success": true,
		"data":    item,
	})
}

// SuperadminDelete deletes a broadcast notification, its recipients, and read receipts, and emits real-time removal via SSE.
func (h *NotificationHandler) SuperadminDelete(c *fiber.Ctx) error {
	rawID := strings.TrimSpace(c.Params("id"))
	if rawID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID siaran tidak valid"})
	}

	notif, err := h.findAdminBroadcastByParam(rawID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Siaran tidak ditemukan"})
	}
	targetID := notif.ID

	txErr := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("notification_id = ?", targetID).Delete(&models.NotificationRecipient{}).Error; err != nil {
			return err
		}
		if err := tx.Where("notification_id = ?", targetID).Delete(&models.NotificationRead{}).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", targetID).Delete(&models.Notification{}).Error
	})

	if txErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menghapus siaran"})
	}

	database.InvalidateBroadcastCache(c.Context())
	services.GetNotificationHub().BroadcastRemoval(targetID, &notif)

	user, _ := c.Locals("user").(*models.User)
	var userID *uint
	actorName := "System"
	actorEmail := "system@catavor.com"
	if user != nil {
		userID = &user.ID
		actorName = user.Name
		actorEmail = user.Email
	}
	actorRole := resolveActorRole(user)

	services.RecordActivity(services.RecordActivityParams{
		DB:          h.DB,
		UserID:      userID,
		ActorRole:   actorRole,
		ActorName:   actorName,
		ActorEmail:  actorEmail,
		Action:      "admin.delete_notification",
		Category:    actorRole,
		EntityType:  "notification",
		EntityTitle: notif.Title,
		Description: fmt.Sprintf("%s menghapus siaran '%s' (ID: %s).", actorName, notif.Title, targetID),
		IPAddress:   c.IP(),
		UserAgent:   c.Get("User-Agent"),
	})

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Siaran berhasil dihapus.",
	})
}

// SearchStores returns matching stores for broadcast targeted selection.
func (h *NotificationHandler) SearchStores(c *fiber.Ctx) error {
	rawQ := strings.TrimSpace(c.Query("q", ""))
	type StoreResult struct {
		ID         uint   `json:"id"`
		Slug       string `json:"slug"`
		StoreTitle string `json:"store_title"`
		Plan       string `json:"plan"`
		UserID     uint   `json:"user_id"`
		UserName   string `json:"user_name,omitempty"`
		UserEmail  string `json:"user_email,omitempty"`
	}

	if rawQ == "" {
		return c.JSON(fiber.Map{
			"success": true,
			"data":    []StoreResult{},
		})
	}

	cleanQ := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(rawQ, "@"), "#"))
	cleanQ = strings.TrimPrefix(strings.TrimPrefix(cleanQ, "ID:"), "id:")
	cleanQ = strings.TrimPrefix(strings.TrimPrefix(cleanQ, "ID"), "id")
	cleanQ = strings.TrimSpace(cleanQ)

	term := "%" + strings.ToLower(cleanQ) + "%"
	rawTerm := "%" + strings.ToLower(rawQ) + "%"

	var stores []StoreResult
	query := h.DB.Table("stores").
		Select("stores.id, stores.slug, stores.store_title, stores.plan, stores.user_id, users.name as user_name, users.email as user_email").
		Joins("LEFT JOIN users ON users.id = stores.user_id")

	if parsedID, err := strconv.ParseUint(cleanQ, 10, 64); err == nil && parsedID > 0 {
		query = query.Where("stores.id = ? OR stores.user_id = ? OR LOWER(stores.slug) LIKE ? OR LOWER(stores.store_title) LIKE ?", parsedID, parsedID, term, term)
	} else {
		query = query.Where("LOWER(stores.slug) LIKE ? OR LOWER(stores.store_title) LIKE ? OR LOWER(stores.about_title) LIKE ? OR LOWER(stores.custom_domain) LIKE ? OR LOWER(users.name) LIKE ? OR LOWER(users.email) LIKE ? OR LOWER(stores.slug) LIKE ?", term, term, term, term, term, term, rawTerm)
	}

	query.Order("stores.store_title ASC, stores.id DESC").Limit(20).Scan(&stores)

	return c.JSON(fiber.Map{
		"success": true,
		"data":    stores,
	})
}

// SearchUsers returns matching users for broadcast targeted selection.
func (h *NotificationHandler) SearchUsers(c *fiber.Ctx) error {
	rawQ := strings.TrimSpace(c.Query("q", ""))
	type UserResult struct {
		ID           uint   `json:"id"`
		Name         string `json:"name"`
		Email        string `json:"email"`
		PlatformRole string `json:"platform_role"`
	}

	if rawQ == "" {
		return c.JSON(fiber.Map{
			"success": true,
			"data":    []UserResult{},
		})
	}

	cleanQ := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(rawQ, "@"), "#"))
	cleanQ = strings.TrimPrefix(strings.TrimPrefix(cleanQ, "ID:"), "id:")
	cleanQ = strings.TrimPrefix(strings.TrimPrefix(cleanQ, "ID"), "id")
	cleanQ = strings.TrimSpace(cleanQ)

	term := "%" + strings.ToLower(cleanQ) + "%"

	var users []UserResult
	query := h.DB.Table("users").Select("id, name, email, platform_role")

	if parsedID, err := strconv.ParseUint(cleanQ, 10, 64); err == nil && parsedID > 0 {
		query = query.Where("id = ? OR LOWER(name) LIKE ? OR LOWER(email) LIKE ?", parsedID, term, term)
	} else {
		query = query.Where("LOWER(name) LIKE ? OR LOWER(email) LIKE ?", term, term)
	}

	query.Order("name ASC, id DESC").Limit(20).Scan(&users)

	return c.JSON(fiber.Map{
		"success": true,
		"data":    users,
	})
}

// ensureStoreInitialNotifications seeds initial guides if the store is newly registered.
func (h *NotificationHandler) ensureStoreInitialNotifications(storeID, userID uint) {
	var count int64
	h.DB.Model(&models.Notification{}).
		Where("target_type = 'single_store' AND target_id = ?", storeID).
		Count(&count)

	if count > 0 {
		return
	}

	now := time.Now().UTC()
	initialGuides := []models.Notification{
		{
			ID:                    fmt.Sprintf("notif_about_%d", storeID),
			TargetType:            "single_store",
			TargetID:              storeID,
			Status:                "published",
			PublishedAt:           &now,
			Title:                 "Panduan Kelengkapan Halaman Tentang Kami",
			Category:              "PANDUAN",
			Message:               "Lengkapi Alamat Bisnis, Jam Operasional, dan Profil Komitmen Layanan Anda agar profil katalog terlihat profesional dan terpercaya di mata pembeli.",
			DetailContent:         "Halaman Tentang Kami adalah wajah utama brand profil bisnis Anda di mata pembeli. Untuk membangun kepercayaan maksimal pelanggan baru, pastikan Anda melengkapi:\n\n1. Alamat Bisnis & Titik Maps:\nMempermudah calon pelanggan menemukan lokasi fisik toko, workshop, atau titik penjemputan pesanan.\n\n2. Jam Operasional Toko:\nJadwal buka dan jam operasional harian dalam melayani pesanan atau chat pelanggan.\n\n3. Profil Komitmen Layanan & Garansi:\nPenjelasan jaminan kualitas produk, keaslian barang, serta standar pelayanan terbaik toko Anda.\n\nKlik tombol di bawah untuk langsung menuju formulir pengaturan Tentang Kami.",
			Type:                  "warning",
			ActionEnabled:         true,
			ActionType:            "detail",
			LinkSubTab:            "settings",
			LinkMobileSettingsTab: "about",
			ActionLabel:           "Buka Pengaturan Tentang Kami →",
			RetentionHours:        168,
			CreatedAt:             now,
			UpdatedAt:             now,
		},
		{
			ID:             fmt.Sprintf("notif_share_%d", storeID),
			TargetType:     "single_store",
			TargetID:       storeID,
			Status:         "published",
			PublishedAt:    &now,
			Title:          "Fitur Bagikan Katalog & QR Code Bisnis",
			Category:       "PROMOSI",
			Message:        "Katalog digital Anda kini telah aktif! Bagikan tautan resmi atau unduh QR Code dinamis untuk mulai menjangkau pembeli di berbagai platform.",
			DetailContent:  "Katalog bisnis Anda kini telah aktif dan dapat diakses oleh publik secara instan.\n\nFitur Bagikan Katalog memungkinkan Anda untuk:\n• Membagikan tautan link langsung ke media sosial (WhatsApp, Instagram Bio, TikTok, dan Facebook).\n• Mengunduh Poster QR Code beresolusi tinggi untuk dicetak dan dipajang di meja kasir, etalase toko, atau kartu nama bisnis Anda.\n• Memantau trafik pengunjung dan total klik katalog secara realtime di dashboard analitik.\n\nMulai promosikan katalog Anda sekarang untuk memaksimalkan penjualan!",
			Type:           "success",
			ActionEnabled:  true,
			ActionType:     "detail",
			LinkSubTab:     "share",
			ActionLabel:    "Buka Menu Bagikan Katalog →",
			RetentionHours: 168,
			CreatedAt:      now.Add(-5 * time.Minute),
			UpdatedAt:      now.Add(-5 * time.Minute),
		},
		{
			ID:             fmt.Sprintf("notif_inventory_%d", storeID),
			TargetType:     "single_store",
			TargetID:       storeID,
			Status:         "published",
			PublishedAt:    &now,
			Title:          "Kelola Stok & Inventaris Produk",
			Category:       "INVENTARIS",
			Message:        "Akses cepat ke menu inventaris untuk menambah produk baru, mengubah varian, atau memperbarui harga jual.",
			Type:           "order",
			ActionEnabled:  true,
			ActionType:     "navigate",
			LinkSubTab:     "items",
			RetentionHours: 168,
			CreatedAt:      now.Add(-1 * time.Hour),
			UpdatedAt:      now.Add(-1 * time.Hour),
		},
	}

	for _, g := range initialGuides {
		h.DB.Create(&g)
	}

	services.GetAutomationTracker().RecordLog(services.AutomationLogEntry{
		BotName:     "onboarding_engine",
		TriggerType: "event_hook",
		BotTitle:    "Bot Panduan Onboarding Toko Baru",
		Target:      fmt.Sprintf("Toko #%d", storeID),
		TargetID:    storeID,
		Action:      "sent_in_app",
		Status:      "success",
		Details:     fmt.Sprintf("3 artikel panduan onboarding otomatis disematkan ke katalog toko #%d.", storeID),
		Timestamp:   time.Now().UTC(),
	})

	services.GetAutomationTracker().RecordWorkerHeartbeat(
		"onboarding_engine",
		"running",
		fmt.Sprintf("Panduan onboarding berhasil diinjeksi ke Toko #%d.", storeID),
		"",
		3,
		time.Now().UTC().Add(1*time.Hour),
	)
}

func (h *NotificationHandler) RegisterAutomationRoutes(router fiber.Router, cfg *config.Config) {
	router.Get("/automation/preview", middleware.RequireAnyPermission(cfg, "system:automation:view", "system:automation:manage"), h.PreviewAutomation)
	router.Get("/automation/status", middleware.RequireAnyPermission(cfg, "system:automation:view", "system:automation:manage"), h.GetAutomationStatus)
	router.Get("/automation/logs", middleware.RequireAnyPermission(cfg, "system:automation:view", "system:automation:manage"), h.GetAutomationLogs)
	router.Post("/automation/trigger", middleware.RequirePermission(cfg, "system:automation:manage"), h.TriggerAutomationBot)
}

// GetAutomationStatus returns runtime health status of background workers and bot engines.
func (h *NotificationHandler) GetAutomationStatus(c *fiber.Ctx) error {
	tracker := services.GetAutomationTracker()
	snapshot := tracker.GetStatusSnapshot(c.Context())

	dormancyMetrics := services.GetDormancyMetrics(h.DB)
	snapshot["dormancy_metrics"] = dormancyMetrics

	return c.JSON(fiber.Map{
		"success": true,
		"data":    snapshot,
	})
}

// GetAutomationLogs returns recent bot execution logs with filtering and pagination.
func (h *NotificationHandler) GetAutomationLogs(c *fiber.Ctx) error {
	botFilter := strings.TrimSpace(c.Query("bot", "all"))
	statusFilter := strings.TrimSpace(c.Query("status", "all"))
	searchQuery := strings.TrimSpace(c.Query("q", ""))
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))

	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 50
	} else if limit > 100 {
		limit = 100
	}

	tracker := services.GetAutomationTracker()
	logs, total, err := tracker.GetLogs(botFilter, statusFilter, searchQuery, limit, page)

	if err != nil {
		return c.Status(503).JSON(fiber.Map{"error": "Riwayat otomasi tidak tersedia."})
	}
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	if totalPages < 1 {
		totalPages = 1
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    logs,
		"total":   total,
		"pagination": fiber.Map{
			"page":        page,
			"limit":       limit,
			"total":       total,
			"total_pages": totalPages,
		},
	})
}

// PreviewAutomation evaluates two synthetic tickets without reading or changing tenant data.
func (h *NotificationHandler) PreviewAutomation(c *fiber.Ctx) error {
	age, err := strconv.Atoi(c.Query("age_days", "31"))
	if err != nil || age < 0 || age > 3650 {
		return c.Status(400).JSON(fiber.Map{"error": "Umur tiket harus antara 0 dan 3650 hari."})
	}
	count, err := services.PreviewTicketRetention(h.DB.WithContext(c.Context()), age)
	if err != nil {
		return c.Status(503).JSON(fiber.Map{"error": "Simulasi retensi tidak tersedia."})
	}
	return c.JSON(fiber.Map{"eligible": count, "sample_count": 2, "message": fmt.Sprintf("%d dari 2 tiket contoh memenuhi retensi pada hari ke-%d. Tidak ada data yang dihapus.", count, age)})
}

// TriggerAutomationBot handles manual force-execution and sandbox test message dispatch.
func (h *NotificationHandler) TriggerAutomationBot(c *fiber.Ctx) error {
	var req struct {
		Action  string `json:"action"`
		BotType string `json:"bot_type"`
	}
	_ = c.BodyParser(&req)

	action := strings.ToLower(strings.TrimSpace(req.Action))
	if action == "" {
		action = strings.ToLower(strings.TrimSpace(req.BotType))
	}
	if action == "" {
		action = strings.ToLower(strings.TrimSpace(c.Query("action", c.Query("bot_type", ""))))
	}

	tracker := services.GetAutomationTracker()
	user, _ := c.Locals("user").(*models.User)

	actor := "Admin Portal"
	if user != nil {
		actor = fmt.Sprintf("user:%d", user.ID)
	}

	db := h.DB.Set("automation_actor", actor).Session(&gorm.Session{})
	switch action {
	case "store_expiry", "dormancy_cycle", "store_expiration", "dormancy_worker":
		if err := tracker.TriggerStoreExpiryManual(db, nil); err != nil {
			log.Error().Err(err).Msg("admin: TriggerStoreExpiryManual gagal")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Gagal memicu bot kedaluwarsa toko."})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Pemeriksaan dormansi setiap toko telah dijadwalkan.",
		})

	case "promo_expiry", "promo_expiration", "promo_worker", "flash_sale", "flashsale", "flash_sale_worker", "weekly_summary", "summary", "weekly_summary_worker":
		name := "weekly_summary"
		switch action {
		case "promo_expiry", "promo_expiration", "promo_worker":
			name = "promo_expiry"
		case "flash_sale", "flashsale", "flash_sale_worker":
			name = "flash_sale"
		}

		summary, err := tracker.RunDiagnostic(h.DB.WithContext(c.Context()), name, actor)
		if err != nil {
			return c.Status(503).JSON(fiber.Map{"error": "Hasil diagnostik tidak tersedia."})
		}
		return c.JSON(fiber.Map{"success": true, "message": summary})
	case "support_lifecycle", "support", "sla_escalation", "ticket_lifecycle":
		summary, err := tracker.TriggerSupportLifecycleManual(db, actor)
		if err != nil {
			return c.Status(503).JSON(fiber.Map{"error": "Siklus helpdesk gagal atau sedang berjalan."})
		}
		return c.JSON(fiber.Map{"success": true, "message": summary})
	case "ticket_retention", "ticket_retention_worker", "ticket_purge", "pdp_purge":
		stats, err := tracker.TriggerTicketRetentionManual(db)
		if err != nil {
			log.Error().Err(err).Msg("admin: TriggerTicketRetentionManual gagal")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Gagal memicu bot retensi tiket."})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": fmt.Sprintf("Bot Retensi & Pemusnahan Data PDP berhasil dieksekusi: %d tiket dimusnahkan, %d berkas fisik dihapus.", stats.PurgedTickets, stats.PurgedFiles),
			"stats":   stats,
		})

	case "market_intel_worker", "market_intel", "market_intelligence", "market_rollup":
		if err := tracker.TriggerMarketIntelManual(db); err != nil {
			log.Error().Err(err).Msg("admin: TriggerMarketIntelManual gagal")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Gagal memicu bot riset pasar & intelijen."})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Bot Agregasi Riset Pasar & Demand Gap (B2B) berhasil dipicu di latar belakang.",
		})

	case "notification_cleaner", "cleaner_worker", "cleaner":
		if err := tracker.TriggerCleanerManual(db); err != nil {
			log.Error().Err(err).Msg("admin: TriggerCleanerManual gagal")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Gagal menjalankan pembersihan notifikasi."})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Permintaan pembersihan notifikasi dan sesi diterima.",
		})

	case "item_retention_worker", "item_retention", "moderation_cleanup", "item_cleanup":
		stats, err := tracker.TriggerItemRetentionManual(db, nil)
		if err != nil {
			log.Error().Err(err).Msg("admin: TriggerItemRetentionManual gagal")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Gagal memicu bot retensi item moderasi."})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": fmt.Sprintf("Bot Retensi Item Moderasi berhasil diproses: %d pengingat H-7 dikirim, %d item di-soft delete (H-30), %d item di-hard delete total (H-90).", stats.RemindersSent, stats.SoftDeleted, stats.HardDeleted),
			"stats":   stats,
		})

	case "storage_sweeper", "storage_sweep", "sweeper", "orphan_cleanup":
		total, err := tracker.TriggerStorageSweeperManual(db)
		if err != nil {
			log.Error().Err(err).Msg("admin: TriggerStorageSweeperManual gagal")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Gagal memicu bot audit penyimpanan."})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": fmt.Sprintf("Bot Audit Kuota & Pembersih Yatim Piatu berhasil dieksekusi: %d toko diaudit dan disinkronkan.", total),
		})

	case "test_guide", "sandbox_test", "test_sandbox", "guide":
		notif, err := tracker.TriggerSandboxTestGuide(h.DB, user)
		if err != nil {
			log.Error().Err(err).Msg("notif: gagal mengirim notifikasi uji coba")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal mengirim notifikasi uji coba."})
		}
		return c.JSON(fiber.Map{
			"success":      true,
			"message":      "Notifikasi panduan tersimpan untuk akun Anda.",
			"notification": notif,
		})

	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fmt.Sprintf("Aksi '%s' tidak dikenal. Pilihan: 'store_expiry', 'promo_expiry', 'flash_sale', 'support_lifecycle', 'weekly_summary', 'notification_cleaner', 'test_guide'", action),
		})
	}
}

// formatRelativeTime formats timestamp into clean human-readable Indonesian relative time.
func formatRelativeTime(t time.Time) string {
	diff := time.Since(t)
	if diff < 1*time.Minute {
		return "Baru saja"
	}
	if diff < 60*time.Minute {
		return fmt.Sprintf("%d menit lalu", int(diff.Minutes()))
	}
	if diff < 24*time.Hour {
		return fmt.Sprintf("%d jam lalu", int(diff.Hours()))
	}
	days := int(diff.Hours() / 24)
	if days == 1 {
		return "Kemarin"
	}
	if days < 7 {
		return fmt.Sprintf("%d hari lalu", days)
	}
	return t.Format("02 Jan 2006")
}
