package handlers

import (
	"bufio"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

type NotificationHandler struct {
	DB *gorm.DB
}

func NewNotificationHandler(db *gorm.DB) *NotificationHandler {
	return &NotificationHandler{DB: db}
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
				storePlan = matchedStore.Plan
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
			storePlan = store.Plan
		}
		isSuspended = store.IsSuspended || store.DormancyStatus == "suspended"
		dormancySuspendedAt = store.DormancySuspendedAt
		return
	}

	return
}

// GetNotifications returns active notifications for the authenticated store/user with pagination.
func (h *NotificationHandler) GetNotifications(c *fiber.Ctx) error {
	user, _ := c.Locals("user").(*models.User)
	var userID uint
	if user != nil {
		userID = user.ID
	}

	storeID, storePlan, storeCreatedAt, isSuspended, dormancySuspendedAt := h.resolveStoreContext(c, user)

	// 1. Seed initial standard guide notifications if store has none
	if storeID > 0 {
		h.ensureStoreInitialNotifications(storeID, userID)
	}

	now := time.Now().UTC()
	thirtyDaysAgo := now.Add(-30 * 24 * time.Hour)

	// Parse pagination parameters
	page, _ := strconv.Atoi(c.Query("page", "1"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	if limit < 1 {
		limit = 10
	} else if limit > 50 {
		limit = 50
	}
	offset := (page - 1) * limit
	filter := c.Query("filter", "all")

	// 2. Fetch all matching notifications with left join on reads
	type NotifResult struct {
		models.Notification
		ReadID      *uint      `json:"-"`
		ReadAtTime  *time.Time `json:"-"`
		DismissedAt *time.Time `json:"-"`
	}

	var allResults []NotifResult

	baseQuery := h.DB.Table("notifications").
		Select(`notifications.*, 
		        notification_reads.id as read_id, 
		        notification_reads.read_at as read_at_time, 
		        notification_reads.dismissed_at as dismissed_at`)

	if storeID > 0 {
		// Strict Store Workspace Isolation:
		// A newly created catalog profile / store only sees:
		// 1. Its own store notifications (target_type = 'single_store' AND target_id = storeID)
		// 2. Its specific store recipient broadcasts (target_recipients containing storeID)
		// 3. Platform broadcasts ('all', 'plan') that were created ON or AFTER the store was created
		// 4. User notifications sent to userID created ON or AFTER the store was created
		// This strictly prevents notification history leakage from other stores or past obsolete events.
		storeCutoff := storeCreatedAt.Add(-2 * time.Minute)
		if storeCutoff.Before(thirtyDaysAgo) {
			storeCutoff = thirtyDaysAgo
		}

		baseQuery = baseQuery.
			Joins("LEFT JOIN notification_reads ON notification_reads.notification_id = notifications.id AND notification_reads.store_id = ?", storeID).
			Where(`
				(notifications.expires_at IS NULL OR notifications.expires_at > ?)
				AND (
					(notifications.target_type = 'single_store' AND notifications.target_id = ?)
					OR (notifications.target_type = 'specific' AND (notifications.target_recipients LIKE ? AND ? > 0))
					OR (notifications.target_type = 'all' AND notifications.created_at >= ?)
					OR (notifications.target_type = 'plan' AND notifications.target_plan_code = ? AND notifications.created_at >= ?)
					OR (notifications.target_type = 'single_user' AND notifications.target_id = ? AND notifications.created_at >= ?)
					OR (notifications.target_type = 'specific' AND (notifications.target_recipients LIKE ? AND ? > 0 AND notifications.created_at >= ?))
				)
				AND (notification_reads.dismissed_at IS NULL)
			`, now,
				storeID,
				fmt.Sprintf(`%%"id":%d%%`, storeID), storeID,
				storeCutoff,
				storePlan, storeCutoff,
				userID, storeCutoff,
				fmt.Sprintf(`%%"id":%d%%`, userID), userID, storeCutoff)
	} else {
		// User/Platform level notifications (without store context)
		baseQuery = baseQuery.
			Joins("LEFT JOIN notification_reads ON notification_reads.notification_id = notifications.id AND notification_reads.user_id = ?", userID).
			Where(`
				(notifications.expires_at IS NULL OR notifications.expires_at > ?)
				AND notifications.created_at >= ?
				AND (
					notifications.target_type = 'all'
					OR (notifications.target_type = 'single_user' AND notifications.target_id = ?)
					OR (notifications.target_type = 'specific' AND (notifications.target_recipients LIKE ? AND ? > 0))
				)
				AND (notification_reads.dismissed_at IS NULL)
			`, now, thirtyDaysAgo, userID,
				fmt.Sprintf(`%%"id":%d%%`, userID), userID)
	}

	// Exclude read notifications that have exceeded the 30-day retention window
	baseQuery = baseQuery.Where(`
		notification_reads.read_at IS NULL 
		OR notification_reads.read_at >= ?
	`, thirtyDaysAgo)

	err := baseQuery.Order("notifications.created_at DESC").Find(&allResults).Error
	if err != nil {
		log.Error().Err(err).Msg("Failed to query notifications")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to load notifications",
		})
	}

	// 3. Process, filter, and calculate unread count
	var allVisible []models.Notification
	var filtered []models.Notification
	unreadCount := 0
	hasSeenCurrentSuspensionNotif := false

	for _, res := range allResults {
		notif := res.Notification
		notif.IsRead = res.ReadID != nil && *res.ReadID > 0
		notif.ReadAt = res.ReadAtTime
		notif.DismissedAt = res.DismissedAt
		notif.Timestamp = formatRelativeTime(notif.CreatedAt)

		isSuspensionNotif := notif.Category == "KEAMANAN" && (strings.Contains(notif.Title, "Dibekukan") || strings.Contains(notif.Title, "Suspensi") || strings.Contains(notif.Message, "dibekukan") || strings.Contains(notif.Message, "penangguhan"))
		titleLower := strings.ToLower(notif.Title)
		msgLower := strings.ToLower(notif.Message)

		// Strict Incident Scoping & SaaS Best Practice Rules:
		if isSuspended {
			// 1. When store is suspended: ALL notifications created prior to the current suspension incident MUST BE HIDDEN.
			if dormancySuspendedAt != nil {
				if notif.CreatedAt.Before(dormancySuspendedAt.Add(-2 * time.Minute)) {
					continue
				}
			}

			// 2. Hide past restoration / recovery notices completely while in suspended state
			if strings.Contains(titleLower, "pemulihan") ||
				strings.Contains(titleLower, "dipulihkan") ||
				strings.Contains(titleLower, "diaktifkan kembali") ||
				strings.Contains(msgLower, "pemulihan") ||
				strings.Contains(msgLower, "dipulihkan") ||
				strings.Contains(msgLower, "diaktifkan kembali") {
				continue
			}

			// 3. Only keep notifications relevant to compliance, suspension, moderation, and appeals
			isRelevantToSuspension := notif.Category == "MODERASI" ||
				notif.Category == "KEPATUHAN" ||
				notif.Category == "KEAMANAN" ||
				notif.Category == "SUSPEND" ||
				notif.Category == "TIKET" ||
				notif.Type == "ticket" ||
				notif.LinkSubTab == "help" ||
				strings.Contains(titleLower, "suspend") ||
				strings.Contains(titleLower, "dibekukan") ||
				strings.Contains(titleLower, "pelanggaran") ||
				strings.Contains(titleLower, "banding") ||
				strings.Contains(titleLower, "tiket") ||
				strings.Contains(msgLower, "suspend") ||
				strings.Contains(msgLower, "dibekukan") ||
				strings.Contains(msgLower, "banding")

			if !isRelevantToSuspension {
				continue
			}

			// 4. Only allow the single latest suspension notification for the current incident
			if isSuspensionNotif {
				if hasSeenCurrentSuspensionNotif {
					continue
				}
				hasSeenCurrentSuspensionNotif = true
			}
		}
		// When store is active: all notifications (including restoration and historical events) are fully visible

		if !notif.IsRead {
			unreadCount++
		}

		allVisible = append(allVisible, notif)

		if filter == "unread" && notif.IsRead {
			continue
		}

		filtered = append(filtered, notif)
	}

	totalAll := len(allVisible)
	totalFiltered := len(filtered)

	// Apply pagination slice
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
		"total":          totalAll,
		"total_all":      totalAll,
		"total_filtered": totalFiltered,
		"page":           page,
		"limit":          limit,
		"has_more":       hasMore,
	})
}

// MarkAsRead marks a specific notification as read for the store.
func (h *NotificationHandler) MarkAsRead(c *fiber.Ctx) error {
	notifID := c.Params("id")
	if notifID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Notification ID is required"})
	}

	user, _ := c.Locals("user").(*models.User)
	var userID uint
	if user != nil {
		userID = user.ID
	}
	storeID, _, _, _, _ := h.resolveStoreContext(c, user)

	now := time.Now().UTC()

	var readRecord models.NotificationRead
	query := h.DB.Where("notification_id = ?", notifID)
	if storeID > 0 {
		query = query.Where("store_id = ?", storeID)
	} else {
		query = query.Where("user_id = ?", userID)
	}

	err := query.First(&readRecord).Error
	if err == gorm.ErrRecordNotFound {
		readRecord = models.NotificationRead{
			NotificationID: notifID,
			StoreID:        storeID,
			UserID:         userID,
			ReadAt:         now,
		}
		if err := h.DB.Create(&readRecord).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to mark notification as read"})
		}
	} else if err == nil {
		readRecord.ReadAt = now
		h.DB.Save(&readRecord)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Notification marked as read",
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

	now := time.Now().UTC()
	thirtyDaysAgo := now.Add(-30 * 24 * time.Hour)

	var unreadNotifIDs []string
	query := h.DB.Table("notifications").Select("notifications.id")

	if storeID > 0 {
		storeCutoff := storeCreatedAt.Add(-2 * time.Minute)
		if storeCutoff.Before(thirtyDaysAgo) {
			storeCutoff = thirtyDaysAgo
		}

		query = query.
			Joins("LEFT JOIN notification_reads ON notification_reads.notification_id = notifications.id AND notification_reads.store_id = ?", storeID).
			Where(`
				(notifications.expires_at IS NULL OR notifications.expires_at > ?)
				AND (
					(notifications.target_type = 'single_store' AND notifications.target_id = ?)
					OR (notifications.target_type = 'specific' AND (notifications.target_recipients LIKE ? AND ? > 0))
					OR (notifications.target_type = 'all' AND notifications.created_at >= ?)
					OR (notifications.target_type = 'plan' AND notifications.target_plan_code = ? AND notifications.created_at >= ?)
					OR (notifications.target_type = 'single_user' AND notifications.target_id = ? AND notifications.created_at >= ?)
					OR (notifications.target_type = 'specific' AND (notifications.target_recipients LIKE ? AND ? > 0 AND notifications.created_at >= ?))
				)
				AND notification_reads.id IS NULL
			`, now,
				storeID,
				fmt.Sprintf(`%%"id":%d%%`, storeID), storeID,
				storeCutoff,
				storePlan, storeCutoff,
				userID, storeCutoff,
				fmt.Sprintf(`%%"id":%d%%`, userID), userID, storeCutoff)
	} else {
		query = query.
			Joins("LEFT JOIN notification_reads ON notification_reads.notification_id = notifications.id AND notification_reads.user_id = ?", userID).
			Where(`
				(notifications.expires_at IS NULL OR notifications.expires_at > ?)
				AND notifications.created_at >= ?
				AND (
					notifications.target_type = 'all'
					OR (notifications.target_type = 'single_user' AND notifications.target_id = ?)
					OR (notifications.target_type = 'specific' AND (notifications.target_recipients LIKE ? AND ? > 0))
				)
				AND notification_reads.id IS NULL
			`, now, thirtyDaysAgo, userID,
				fmt.Sprintf(`%%"id":%d%%`, userID), userID)
	}

	err := query.Pluck("notifications.id", &unreadNotifIDs).Error
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch unread notifications"})
	}

	for _, notifID := range unreadNotifIDs {
		readRecord := models.NotificationRead{
			NotificationID: notifID,
			StoreID:        storeID,
			UserID:         userID,
			ReadAt:         now,
		}
		h.DB.Create(&readRecord)
	}

	return c.JSON(fiber.Map{
		"success":      true,
		"marked_count": len(unreadNotifIDs),
	})
}

// Dismiss marks a notification as dismissed/hidden for the store.
func (h *NotificationHandler) Dismiss(c *fiber.Ctx) error {
	notifID := c.Params("id")
	user, _ := c.Locals("user").(*models.User)
	var userID uint
	if user != nil {
		userID = user.ID
	}
	storeID, _, _, _, _ := h.resolveStoreContext(c, user)

	now := time.Now().UTC()

	var readRecord models.NotificationRead
	query := h.DB.Where("notification_id = ?", notifID)
	if storeID > 0 {
		query = query.Where("store_id = ?", storeID)
	} else {
		query = query.Where("user_id = ?", userID)
	}

	err := query.First(&readRecord).Error
	if err == gorm.ErrRecordNotFound {
		readRecord = models.NotificationRead{
			NotificationID: notifID,
			StoreID:        storeID,
			UserID:         userID,
			ReadAt:         now,
			DismissedAt:    &now,
		}
		h.DB.Create(&readRecord)
	} else if err == nil {
		readRecord.DismissedAt = &now
		h.DB.Save(&readRecord)
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

	// Update all read receipts for this store that are not yet dismissed
	query := h.DB.Model(&models.NotificationRead{}).Where("dismissed_at IS NULL")
	if storeID > 0 {
		query = query.Where("store_id = ?", storeID)
	} else if userID > 0 {
		query = query.Where("user_id = ?", userID)
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

// Stream handles Server-Sent Events (SSE) for real-time notification streaming.
func (h *NotificationHandler) Stream(c *fiber.Ctx) error {
	user, _ := c.Locals("user").(*models.User)
	var userID uint
	platformRole := ""

	if user != nil {
		userID = user.ID
		platformRole = user.PlatformRole
		if strings.EqualFold(user.PlatformRole, "superadmin") || user.Email == "admin@catavor.com" {
			platformRole = "superadmin"
		}
	}

	storeID, storePlan, _, _, _ := h.resolveStoreContext(c, user)

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache, no-transform")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")
	c.Set("Access-Control-Allow-Origin", "*")

	client := services.GetNotificationHub().Register(userID, storeID, storePlan, platformRole)

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		defer services.GetNotificationHub().Unregister(client)

		// Send initial connect greeting
		fmt.Fprintf(w, "event: connected\ndata: {\"status\":\"connected\",\"client_id\":\"%s\"}\n\n", client.ID)
		if err := w.Flush(); err != nil {
			return
		}

		ticker := time.NewTicker(15 * time.Second) // Keepalive heartbeat every 15s
		defer ticker.Stop()

		for {
			select {
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

// SuperadminBroadcast allows superadmin to create and broadcast notifications dynamically.
func (h *NotificationHandler) SuperadminBroadcast(c *fiber.Ctx) error {
	user, _ := c.Locals("user").(*models.User)

	type RecipientItem struct {
		Type  string `json:"type"`  // 'store' | 'user'
		ID    uint   `json:"id"`    // StoreID or UserID
		Name  string `json:"name"`  // Store Name or User Name
		Slug  string `json:"slug"`  // Store slug
		Email string `json:"email"` // User email
		Plan  string `json:"plan"`  // Store plan
	}

	type BroadcastReq struct {
		TargetType            string          `json:"target_type"`             // 'all', 'plan', 'specific', 'single_store', 'single_user'
		TargetPlanCode        string          `json:"target_plan_code"`        // e.g. 'free', 'pro', 'enterprise'
		TargetID              uint            `json:"target_id"`               // store_id or user_id (legacy)
		TargetName            string          `json:"target_name"`             // store title / user name / email
		Recipients            []RecipientItem `json:"recipients"`              // multiple targeted stores / users
		Title                 string          `json:"title"`
		Category              string          `json:"category"`
		Message               string          `json:"message"`
		DetailContent         string          `json:"detail_content"`
		Type                  string          `json:"type"`                    // 'warning', 'success', 'order', 'system', 'info'
		ActionEnabled         bool            `json:"action_enabled"`          // explicit toggle for notification action
		ActionType            string          `json:"action_type"`             // 'detail', 'navigate', 'none', 'external_link'
		LinkSubTab            string          `json:"link_sub_tab"`
		LinkMobileSettingsTab string          `json:"link_mobile_settings_tab"`
		ActionLabel           string          `json:"action_label"`
		ActionURL             string          `json:"action_url"`
		ExpiresInHours        int             `json:"expires_in_hours"`        // 0 = unlimited
		RetentionHours        int             `json:"retention_hours"`         // default 720
	}

	var req BroadcastReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format data tidak valid"})
	}

	title := security.SanitizePlainText(req.Title, 150)
	message := security.SanitizePlainText(req.Message, 2000)
	if title == "" || message == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Judul dan pesan siaran wajib diisi"})
	}

	targetType := strings.ToLower(strings.TrimSpace(req.TargetType))
	if targetType == "" {
		targetType = "all"
	}
	targetPlanCode := strings.ToLower(strings.TrimSpace(req.TargetPlanCode))

	category := strings.ToUpper(strings.TrimSpace(req.Category))
	if category == "" {
		category = "PENGUMUMAN"
	}

	notifType := strings.ToLower(strings.TrimSpace(req.Type))
	if notifType == "" {
		notifType = "info"
	}

	actionType := strings.ToLower(strings.TrimSpace(req.ActionType))
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
	actionEnabled := actionType != "none" && req.ActionType != "none"

	retentionHours := req.RetentionHours
	if retentionHours <= 0 {
		retentionHours = 720
	}

	var targetRecipientsJSON string
	targetName := security.SanitizePlainText(req.TargetName, 255)

	if targetType == "specific" && len(req.Recipients) > 0 {
		// Serialize multiple recipients
		if recBytes, err := json.Marshal(req.Recipients); err == nil {
			targetRecipientsJSON = string(recBytes)
		}
		if len(req.Recipients) == 1 {
			targetName = req.Recipients[0].Name
		} else {
			targetName = fmt.Sprintf("%d Penerima Terpilih (%s, %s%s)",
				len(req.Recipients),
				req.Recipients[0].Name,
				req.Recipients[1].Name,
				func() string {
					if len(req.Recipients) > 2 {
						return fmt.Sprintf(", +%d lainnya", len(req.Recipients)-2)
					}
					return ""
				}())
		}
	} else if targetName == "" && req.TargetID > 0 {
		if targetType == "single_store" {
			var st models.Store
			if err := h.DB.Select("slug, store_title").Where("id = ?", req.TargetID).First(&st).Error; err == nil {
				if st.StoreTitle != "" {
					targetName = st.StoreTitle
				} else {
					targetName = st.Slug
				}
			}
		} else if targetType == "single_user" {
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

	var createdBy uint
	if user != nil {
		createdBy = user.ID
	}

	detailContent := ""
	if actionType == "detail" || (actionEnabled && req.DetailContent != "") {
		detailContent = security.SanitizeRichText(req.DetailContent, 20000)
	}

	now := time.Now().UTC()
	notif := models.Notification{
		ID:                    "notif_bc_" + uuid.New().String()[:12],
		TargetType:            targetType,
		TargetPlanCode:        targetPlanCode,
		TargetID:              req.TargetID,
		TargetName:            targetName,
		TargetRecipients:      targetRecipientsJSON,
		IsBroadcast:           true,
		Title:                 title,
		Category:              category,
		Message:               message,
		DetailContent:         detailContent,
		Type:                  notifType,
		ActionEnabled:         actionEnabled,
		ActionType:            actionType,
		LinkSubTab:            security.SanitizePlainText(req.LinkSubTab, 64),
		LinkMobileSettingsTab: security.SanitizePlainText(req.LinkMobileSettingsTab, 64),
		ActionLabel:           security.SanitizePlainText(req.ActionLabel, 128),
		ActionURL:             security.SanitizeURL(req.ActionURL),
		RetentionHours:        retentionHours,
		CreatedBy:             createdBy,
		CreatedAt:             now,
		UpdatedAt:             now,
	}

	if req.ExpiresInHours > 0 {
		exp := now.Add(time.Duration(req.ExpiresInHours) * time.Hour)
		notif.ExpiresAt = &exp
	}

	if err := h.DB.Create(&notif).Error; err != nil {
		log.Error().Err(err).Msg("Failed to save broadcast notification")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": fmt.Sprintf("Gagal menyimpan notifikasi siaran: %v", err)})
	}

	// Purge redis broadcast cache on write
	database.InvalidateBroadcastCache(c.Context())

	// Broadcast instantly via SSE Hub
	services.GetNotificationHub().Broadcast(&notif)

	// Record Superadmin Audit Log
	var userID *uint
	actorName := "Superadmin"
	actorEmail := "admin@catavor.com"
	if user != nil {
		userID = &user.ID
		actorName = user.Name
		actorEmail = user.Email
	}

	services.RecordActivity(services.RecordActivityParams{
		DB:          h.DB,
		UserID:      userID,
		ActorRole:   "superadmin",
		ActorName:   actorName,
		ActorEmail:  actorEmail,
		Action:      "admin.broadcast_notification",
		Category:    "superadmin",
		EntityType:  "notification",
		EntityTitle: notif.Title,
		Description: fmt.Sprintf("Superadmin menyebarkan siaran pengumuman '%s' (Target: %s %s).", notif.Title, notif.TargetType, notif.TargetName),
		Changes: map[string]interface{}{
			"target_type":      notif.TargetType,
			"target_plan_code": notif.TargetPlanCode,
			"target_id":        notif.TargetID,
			"target_name":      notif.TargetName,
			"category":         notif.Category,
			"action_type":      notif.ActionType,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success":      true,
		"message":      "Siaran broadcast berhasil dikirim dan dipublikasikan!",
		"notification": notif,
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

	status := strings.ToLower(strings.TrimSpace(c.Query("status", "all"))) // 'all', 'active', 'expired'
	target := strings.ToLower(strings.TrimSpace(c.Query("target", "all"))) // 'all', 'plan', 'store', 'user'
	category := strings.ToUpper(strings.TrimSpace(c.Query("category", "all")))
	q := strings.TrimSpace(c.Query("q", ""))

	// 1. Check Redis Cache
	cacheKey := fmt.Sprintf("p%d_l%d_s%s_t%s_c%s_q%s", page, limit, status, target, category, q)
	if cachedData, found := database.GetBroadcastListCache(c.Context(), cacheKey); found && cachedData != "" {
		var cachedResp fiber.Map
		if err := json.Unmarshal([]byte(cachedData), &cachedResp); err == nil {
			c.Set("X-Cache", "HIT-REDIS")
			return c.JSON(cachedResp)
		}
	}

	now := time.Now().UTC()

	// Base count & filtering query
	baseFilter := h.DB.Table("notifications").Where("is_broadcast = true OR created_by > 0")

	if status == "active" {
		baseFilter = baseFilter.Where("expires_at IS NULL OR expires_at > ?", now)
	} else if status == "expired" {
		baseFilter = baseFilter.Where("expires_at IS NOT NULL AND expires_at <= ?", now)
	}

	if target != "" && target != "all" {
		if target == "store" {
			baseFilter = baseFilter.Where("target_type = 'single_store'")
		} else if target == "user" {
			baseFilter = baseFilter.Where("target_type = 'single_user'")
		} else {
			baseFilter = baseFilter.Where("target_type = ?", target)
		}
	}

	if category != "" && category != "ALL" {
		baseFilter = baseFilter.Where("category = ?", category)
	}

	if q != "" {
		term := "%" + strings.ToLower(q) + "%"
		baseFilter = baseFilter.Where("(LOWER(title) LIKE ? OR LOWER(message) LIKE ? OR LOWER(target_name) LIKE ?)", term, term, term)
	}

	var totalFiltered int64
	baseFilter.Count(&totalFiltered)

	// Single Aggregated Query with Anti-N+1 Join for read counts
	type BroadcastItemWithReads struct {
		models.Notification
		ReadCount int64 `json:"read_count"`
	}
	var results []BroadcastItemWithReads

	query := h.DB.Table("notifications").
		Select(`notifications.*, COALESCE(reads.cnt, 0) as read_count`).
		Joins(`LEFT JOIN (
			SELECT notification_id, COUNT(id) as cnt 
			FROM notification_reads 
			GROUP BY notification_id
		) reads ON reads.notification_id = notifications.id`).
		Where("notifications.is_broadcast = true OR notifications.created_by > 0")

	if status == "active" {
		query = query.Where("notifications.expires_at IS NULL OR notifications.expires_at > ?", now)
	} else if status == "expired" {
		query = query.Where("notifications.expires_at IS NOT NULL AND notifications.expires_at <= ?", now)
	}
	if target != "" && target != "all" {
		if target == "store" {
			query = query.Where("notifications.target_type = 'single_store'")
		} else if target == "user" {
			query = query.Where("notifications.target_type = 'single_user'")
		} else {
			query = query.Where("notifications.target_type = ?", target)
		}
	}
	if category != "" && category != "ALL" {
		query = query.Where("notifications.category = ?", category)
	}
	if q != "" {
		term := "%" + strings.ToLower(q) + "%"
		query = query.Where("(LOWER(notifications.title) LIKE ? OR LOWER(notifications.message) LIKE ? OR LOWER(notifications.target_name) LIKE ?)", term, term, term)
	}

	if err := query.Order("notifications.created_at DESC").
		Limit(limit).
		Offset(offset).
		Scan(&results).Error; err != nil {
		log.Error().Err(err).Msg("Failed to query broadcasts")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memuat riwayat siaran"})
	}

	// Overall Broadcast Analytics Metrics
	var totalBroadcasts, activeBroadcasts, globalBroadcasts, targetedBroadcasts, totalReads int64
	h.DB.Table("notifications").Where("is_broadcast = true OR created_by > 0").Count(&totalBroadcasts)
	h.DB.Table("notifications").Where("(is_broadcast = true OR created_by > 0) AND (expires_at IS NULL OR expires_at > ?)", now).Count(&activeBroadcasts)
	h.DB.Table("notifications").Where("(is_broadcast = true OR created_by > 0) AND target_type = 'all'").Count(&globalBroadcasts)
	h.DB.Table("notifications").Where("(is_broadcast = true OR created_by > 0) AND target_type != 'all'").Count(&targetedBroadcasts)
	h.DB.Table("notification_reads").Where("notification_id IN (SELECT id FROM notifications WHERE is_broadcast = true OR created_by > 0)").Count(&totalReads)

	totalPages := 0
	if totalFiltered > 0 {
		totalPages = int((totalFiltered + int64(limit) - 1) / int64(limit))
	}
	hasMore := page < totalPages

	resp := fiber.Map{
		"success": true,
		"data":    results,
		"metrics": fiber.Map{
			"total_broadcasts":    totalBroadcasts,
			"active_broadcasts":   activeBroadcasts,
			"global_broadcasts":   globalBroadcasts,
			"targeted_broadcasts": targetedBroadcasts,
			"total_reads":         totalReads,
		},
		"pagination": fiber.Map{
			"page":        page,
			"limit":       limit,
			"total_items": totalFiltered,
			"total_pages": totalPages,
			"has_more":    hasMore,
		},
	}

	// Save to Redis Cache (60s TTL)
	if respBytes, err := json.Marshal(resp); err == nil {
		database.SetBroadcastListCache(c.Context(), cacheKey, string(respBytes), 60*time.Second)
	}

	c.Set("X-Cache", "MISS")
	return c.JSON(resp)
}

// SuperadminGetOne retrieves a single broadcast notification with read stats.
func (h *NotificationHandler) SuperadminGetOne(c *fiber.Ctx) error {
	notifID := strings.TrimSpace(c.Params("id"))
	if notifID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID siaran tidak valid"})
	}

	cleanID := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(notifID, "@"), "#"))
	cleanID = strings.TrimPrefix(strings.TrimPrefix(cleanID, "ID:"), "id:")
	cleanID = strings.TrimPrefix(strings.TrimPrefix(cleanID, "ID"), "id")
	cleanID = strings.TrimSpace(cleanID)

	type BroadcastItemWithReads struct {
		models.Notification
		ReadCount int64 `json:"read_count"`
	}
	var result BroadcastItemWithReads

	err := h.DB.Table("notifications").
		Select(`notifications.*, COALESCE(reads.cnt, 0) as read_count`).
		Joins(`LEFT JOIN (
			SELECT notification_id, COUNT(id) as cnt 
			FROM notification_reads 
			GROUP BY notification_id
		) reads ON reads.notification_id = notifications.id`).
		Where("notifications.id = ? OR notifications.id = ? OR notifications.id LIKE ?", notifID, cleanID, "%"+cleanID).
		First(&result).Error

	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Siaran tidak ditemukan"})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    result,
	})
}

// SuperadminDelete deletes a broadcast notification and its read receipts.
func (h *NotificationHandler) SuperadminDelete(c *fiber.Ctx) error {
	notifID := strings.TrimSpace(c.Params("id"))
	if notifID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID siaran tidak valid"})
	}

	cleanID := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(notifID, "@"), "#"))
	cleanID = strings.TrimPrefix(strings.TrimPrefix(cleanID, "ID:"), "id:")
	cleanID = strings.TrimPrefix(strings.TrimPrefix(cleanID, "ID"), "id")
	cleanID = strings.TrimSpace(cleanID)

	var notif models.Notification
	if err := h.DB.Where("id = ? OR id = ? OR id LIKE ?", notifID, cleanID, "%"+cleanID).First(&notif).Error; err == nil {
		h.DB.Where("notification_id = ?", notif.ID).Delete(&models.NotificationRead{})
		h.DB.Where("id = ?", notif.ID).Delete(&models.Notification{})
	} else {
		h.DB.Where("notification_id = ?", notifID).Delete(&models.NotificationRead{})
		if err := h.DB.Where("id = ?", notifID).Delete(&models.Notification{}).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menghapus siaran"})
		}
	}

	// Invalidate redis broadcast cache
	database.InvalidateBroadcastCache(c.Context())

	// Record Superadmin Audit Log
	userVal := c.Locals("user")
	var userID *uint
	actorName := "Superadmin"
	actorEmail := "admin@catavor.com"
	if userVal != nil {
		u := userVal.(*models.User)
		userID = &u.ID
		actorName = u.Name
		actorEmail = u.Email
	}

	services.RecordActivity(services.RecordActivityParams{
		DB:          h.DB,
		UserID:      userID,
		ActorRole:   "superadmin",
		ActorName:   actorName,
		ActorEmail:  actorEmail,
		Action:      "admin.delete_notification",
		Category:    "superadmin",
		EntityType:  "notification",
		EntityTitle: notif.Title,
		Description: fmt.Sprintf("Superadmin menghapus siaran '%s' (ID: %s).", notif.Title, notifID),
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

	// Seed default onboarding guides specifically for this store
	initialGuides := []models.Notification{
		{
			ID:             fmt.Sprintf("notif_about_%d", storeID),
			TargetType:     "single_store",
			TargetID:       storeID,
			Title:          "Panduan Kelengkapan Halaman Tentang Kami",
			Category:       "PANDUAN",
			Message:        "Lengkapi Alamat Bisnis, Jam Operasional, dan Profil Komitmen Layanan Anda agar profil katalog terlihat profesional dan terpercaya di mata pembeli.",
			DetailContent:  "Halaman Tentang Kami adalah wajah utama brand profil bisnis Anda di mata pembeli. Untuk membangun kepercayaan maksimal pelanggan baru, pastikan Anda melengkapi:\n\n1. Alamat Bisnis & Titik Maps:\nMempermudah calon pelanggan menemukan lokasi fisik toko, workshop, atau titik penjemputan pesanan.\n\n2. Jam Operasional Toko:\nJadwal buka dan jam operasional harian dalam melayani pesanan atau chat pelanggan.\n\n3. Profil Komitmen Layanan & Garansi:\nPenjelasan jaminan kualitas produk, keaslian barang, serta standar pelayanan terbaik toko Anda.\n\nKlik tombol di bawah untuk langsung menuju formulir pengaturan Tentang Kami.",
			Type:           "warning",
			ActionType:     "detail",
			LinkSubTab:     "settings",
			LinkMobileSettingsTab: "about",
			ActionLabel:    "Buka Pengaturan Tentang Kami →",
			RetentionHours: 168, // 7 days in history after read
			CreatedAt:      time.Now().UTC(),
			UpdatedAt:      time.Now().UTC(),
		},
		{
			ID:             fmt.Sprintf("notif_share_%d", storeID),
			TargetType:     "single_store",
			TargetID:       storeID,
			Title:          "Fitur Bagikan Katalog & QR Code Bisnis",
			Category:       "PROMOSI",
			Message:        "Katalog digital Anda kini telah aktif! Bagikan tautan resmi atau unduh QR Code dinamis untuk mulai menjangkau pembeli di berbagai platform.",
			DetailContent:  "Katalog bisnis Anda kini telah aktif dan dapat diakses oleh publik secara instan.\n\nFitur Bagikan Katalog memungkinkan Anda untuk:\n• Membagikan tautan link langsung ke media sosial (WhatsApp, Instagram Bio, TikTok, dan Facebook).\n• Mengunduh Poster QR Code beresolusi tinggi untuk dicetak dan dipajang di meja kasir, etalase toko, atau kartu nama bisnis Anda.\n• Memantau trafik pengunjung dan total klik katalog secara realtime di dashboard analitik.\n\nMulai promosikan katalog Anda sekarang untuk memaksimalkan penjualan!",
			Type:           "success",
			ActionType:     "detail",
			LinkSubTab:     "share",
			ActionLabel:    "Buka Menu Bagikan Katalog →",
			RetentionHours: 168,
			CreatedAt:      time.Now().UTC().Add(-5 * time.Minute),
			UpdatedAt:      time.Now().UTC().Add(-5 * time.Minute),
		},
		{
			ID:             fmt.Sprintf("notif_inventory_%d", storeID),
			TargetType:     "single_store",
			TargetID:       storeID,
			Title:          "Kelola Stok & Inventaris Produk",
			Category:       "INVENTARIS",
			Message:        "Akses cepat ke menu inventaris untuk menambah produk baru, mengubah varian, atau memperbarui harga jual.",
			Type:           "order",
			ActionType:     "navigate",
			LinkSubTab:     "items",
			RetentionHours: 168,
			CreatedAt:      time.Now().UTC().Add(-1 * time.Hour),
			UpdatedAt:      time.Now().UTC().Add(-1 * time.Hour),
		},
	}

	for _, g := range initialGuides {
		h.DB.Create(&g)
	}

	// Record to automation tracker
	services.GetAutomationTracker().RecordLog(services.AutomationLogEntry{
		BotName:   "onboarding",
		BotTitle:  "Bot Panduan Onboarding Toko Baru",
		Target:    fmt.Sprintf("Toko #%d", storeID),
		TargetID:  storeID,
		Action:    "sent_in_app",
		Status:    "success",
		Details:   fmt.Sprintf("3 artikel panduan onboarding otomatis disematkan ke katalog toko #%d.", storeID),
		Timestamp: time.Now().UTC(),
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

// GetAutomationStatus returns runtime health status of background workers and bot engines.
func (h *NotificationHandler) GetAutomationStatus(c *fiber.Ctx) error {
	tracker := services.GetAutomationTracker()
	snapshot := tracker.GetStatusSnapshot(c.Context())

	// Augment with dormancy metrics
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
	logs, total := tracker.GetLogs(botFilter, statusFilter, searchQuery, limit, page)

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

// TriggerAutomationBot handles manual force-execution and sandbox test message dispatch.
func (h *NotificationHandler) TriggerAutomationBot(c *fiber.Ctx) error {
	var req struct {
		Action  string `json:"action"`   // 'store_expiry', 'promo_expiry', 'flash_sale', 'weekly_summary', 'support_lifecycle', 'dormancy_cycle', 'notification_cleaner', 'test_guide'
		BotType string `json:"bot_type"` // Alternate field name sent from frontend
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

	switch action {
	case "store_expiry", "dormancy_cycle", "store_expiration", "dormancy_worker":
		if err := tracker.TriggerStoreExpiryManual(h.DB, nil); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Bot Kedaluwarsa Toko & siklus pemindaian inaktivitas akun berhasil dipicu di latar belakang.",
		})

	case "promo_expiry", "promo_expiration", "promo_worker":
		if err := tracker.TriggerPromoExpiryManual(h.DB); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Bot Kedaluwarsa Promo berhasil memindai katalog merchant dan memperbarui promo aktif.",
		})

	case "flash_sale", "flashsale", "flash_sale_worker":
		if err := tracker.TriggerFlashSaleManual(h.DB); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Bot Sinkronisasi Flash Sale berhasil menyinkronkan sesi diskon dan label promo produk realtime.",
		})

	case "support_lifecycle", "support", "sla_escalation", "ticket_lifecycle":
		if err := tracker.TriggerSupportLifecycleManual(h.DB); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Bot Helpdesk SLA Escalation berhasil memproses pengingat tiket dan auto-resolve.",
		})

	case "weekly_summary", "summary", "weekly_summary_worker":
		if err := tracker.TriggerWeeklySummaryManual(h.DB, user); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Bot Ringkasan Mingguan Platform berhasil mengompilasi statistik transaksi dan performa platform.",
		})

	case "notification_cleaner", "cleaner_worker", "cleaner":
		if err := tracker.TriggerCleanerManual(h.DB); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Pembersihan notifikasi kedaluwarsa & retensi 30 hari berhasil dijalankan.",
		})

	case "item_retention_worker", "item_retention", "moderation_cleanup", "item_cleanup":
		stats, err := tracker.TriggerItemRetentionManual(h.DB, nil)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": fmt.Sprintf("Bot Retensi Item Moderasi berhasil diproses: %d pengingat H-7 dikirim, %d item di-soft delete (H-30), %d item di-hard delete total (H-90).", stats.RemindersSent, stats.SoftDeleted, stats.HardDeleted),
			"stats":   stats,
		})

	case "test_guide", "sandbox_test", "test_sandbox", "guide":
		notif, err := tracker.TriggerSandboxTestGuide(h.DB, user)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": fmt.Sprintf("Gagal mengirim notifikasi uji coba: %v", err)})
		}
		return c.JSON(fiber.Map{
			"success":      true,
			"message":      "Notifikasi simulasi panduan berhasil dikirim ke akun Anda.",
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
