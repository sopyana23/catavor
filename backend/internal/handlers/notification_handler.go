package handlers

import (
	"bufio"
	"fmt"
	"strconv"
	"time"

	"catavor-backend/internal/models"
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

// GetNotifications returns active notifications for the authenticated store/user with pagination.
func (h *NotificationHandler) GetNotifications(c *fiber.Ctx) error {
	store, _ := c.Locals("store").(*models.Store)
	user, _ := c.Locals("user").(*models.User)

	var storeID uint
	var userID uint
	storePlan := "free"

	if store != nil {
		storeID = store.ID
		if store.Plan != "" {
			storePlan = store.Plan
		}
	}
	if user != nil {
		userID = user.ID
	}

	// 1. Seed initial standard guide notifications if store has none
	if storeID > 0 {
		h.ensureStoreInitialNotifications(storeID, userID)
	}

	now := time.Now().UTC()

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

	// Target matching: all, matching dynamic plan, single_store, single_user
	baseQuery := h.DB.Table("notifications").
		Select(`notifications.*, 
		        notification_reads.id as read_id, 
		        notification_reads.read_at as read_at_time, 
		        notification_reads.dismissed_at as dismissed_at`).
		Joins("LEFT JOIN notification_reads ON notification_reads.notification_id = notifications.id AND notification_reads.store_id = ?", storeID).
		Where(`
			(notifications.expires_at IS NULL OR notifications.expires_at > ?)
			AND (
				notifications.target_type = 'all'
				OR (notifications.target_type = 'plan' AND notifications.target_plan_code = ?)
				OR (notifications.target_type = 'single_store' AND notifications.target_id = ?)
				OR (notifications.target_type = 'single_user' AND notifications.target_id = ?)
			)
			AND (notification_reads.dismissed_at IS NULL)
		`, now, storePlan, storeID, userID)

	// Exclude read notifications that have exceeded their retention window
	baseQuery = baseQuery.Where(`
		notification_reads.read_at IS NULL 
		OR ((notification_reads.read_at + (notifications.retention_hours * INTERVAL '1 hour')) >= ?)
	`, now)

	err := baseQuery.Order("notifications.created_at DESC").Find(&allResults).Error
	if err != nil {
		log.Error().Err(err).Msg("Failed to query notifications")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to load notifications",
		})
	}

	// 3. Process, filter, and calculate unread count
	var filtered []models.Notification
	unreadCount := 0

	for _, res := range allResults {
		notif := res.Notification
		notif.IsRead = res.ReadID != nil && *res.ReadID > 0
		notif.ReadAt = res.ReadAtTime
		notif.DismissedAt = res.DismissedAt
		notif.Timestamp = formatRelativeTime(notif.CreatedAt)

		if !notif.IsRead {
			unreadCount++
		}

		if filter == "unread" && notif.IsRead {
			continue
		}

		filtered = append(filtered, notif)
	}

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
		"data":         pagedData,
		"unread_count": unreadCount,
		"total":        totalFiltered,
		"page":         page,
		"limit":        limit,
		"has_more":     hasMore,
	})
}

// MarkAsRead marks a specific notification as read for the store.
func (h *NotificationHandler) MarkAsRead(c *fiber.Ctx) error {
	notifID := c.Params("id")
	if notifID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Notification ID is required"})
	}

	store, _ := c.Locals("store").(*models.Store)
	user, _ := c.Locals("user").(*models.User)

	var storeID uint
	var userID uint
	if store != nil {
		storeID = store.ID
	}
	if user != nil {
		userID = user.ID
	}

	now := time.Now().UTC()

	var readRecord models.NotificationRead
	err := h.DB.Where("notification_id = ? AND store_id = ?", notifID, storeID).First(&readRecord).Error
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
	store, _ := c.Locals("store").(*models.Store)
	user, _ := c.Locals("user").(*models.User)

	var storeID uint
	var userID uint
	storePlan := "free"

	if store != nil {
		storeID = store.ID
		if store.Plan != "" {
			storePlan = store.Plan
		}
	}
	if user != nil {
		userID = user.ID
	}

	now := time.Now().UTC()

	// Find all unread visible notification IDs
	var unreadNotifIDs []string
	err := h.DB.Table("notifications").
		Select("notifications.id").
		Joins("LEFT JOIN notification_reads ON notification_reads.notification_id = notifications.id AND notification_reads.store_id = ?", storeID).
		Where(`
			(notifications.expires_at IS NULL OR notifications.expires_at > ?)
			AND (
				notifications.target_type = 'all'
				OR (notifications.target_type = 'plan' AND notifications.target_plan_code = ?)
				OR (notifications.target_type = 'single_store' AND notifications.target_id = ?)
				OR (notifications.target_type = 'single_user' AND notifications.target_id = ?)
			)
			AND notification_reads.id IS NULL
		`, now, storePlan, storeID, userID).
		Pluck("notifications.id", &unreadNotifIDs).Error

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
	store, _ := c.Locals("store").(*models.Store)
	user, _ := c.Locals("user").(*models.User)

	var storeID uint
	var userID uint
	if store != nil {
		storeID = store.ID
	}
	if user != nil {
		userID = user.ID
	}

	now := time.Now().UTC()

	var readRecord models.NotificationRead
	err := h.DB.Where("notification_id = ? AND store_id = ?", notifID, storeID).First(&readRecord).Error
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

// Stream handles Server-Sent Events (SSE) for real-time notification streaming.
func (h *NotificationHandler) Stream(c *fiber.Ctx) error {
	store, _ := c.Locals("store").(*models.Store)
	user, _ := c.Locals("user").(*models.User)

	var storeID uint
	var userID uint
	storePlan := "free"

	if store != nil {
		storeID = store.ID
		if store.Plan != "" {
			storePlan = store.Plan
		}
	}
	if user != nil {
		userID = user.ID
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")
	c.Set("Access-Control-Allow-Origin", "*")

	client := services.GetNotificationHub().Register(userID, storeID, storePlan)

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		defer services.GetNotificationHub().Unregister(client)

		// Send initial connect greeting
		fmt.Fprintf(w, "event: connected\ndata: {\"status\":\"connected\",\"client_id\":\"%s\"}\n\n", client.ID)
		w.Flush()

		ticker := time.NewTicker(25 * time.Second) // Keepalive heartbeat
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

	type BroadcastReq struct {
		TargetType            string `json:"target_type"`             // 'all', 'plan', 'single_store', 'single_user'
		TargetPlanCode        string `json:"target_plan_code"`        // e.g. 'free', 'pro_starter', 'pro_business'
		TargetID              uint   `json:"target_id"`               // store_id or user_id
		Title                 string `json:"title"`
		Category              string `json:"category"`
		Message               string `json:"message"`
		DetailContent         string `json:"detail_content"`
		Type                  string `json:"type"`                    // 'warning', 'success', 'order', 'system', 'info'
		ActionType            string `json:"action_type"`             // 'detail', 'navigate', 'none', 'external_link'
		LinkSubTab            string `json:"link_sub_tab"`
		LinkMobileSettingsTab string `json:"link_mobile_settings_tab"`
		ActionLabel           string `json:"action_label"`
		ActionURL             string `json:"action_url"`
		ExpiresInHours        int    `json:"expires_in_hours"`        // 0 = unlimited
		RetentionHours        int    `json:"retention_hours"`         // default 72
	}

	var req BroadcastReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Title == "" || req.Message == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Title and message are required"})
	}

	if req.TargetType == "" {
		req.TargetType = "all"
	}
	if req.Category == "" {
		req.Category = "SISTEM"
	}
	if req.Type == "" {
		req.Type = "info"
	}
	if req.ActionType == "" {
		req.ActionType = "detail"
	}
	if req.RetentionHours <= 0 {
		req.RetentionHours = 72
	}

	var createdBy uint
	if user != nil {
		createdBy = user.ID
	}

	notif := models.Notification{
		ID:                    "notif_" + uuid.New().String()[:12],
		TargetType:            req.TargetType,
		TargetPlanCode:        req.TargetPlanCode,
		TargetID:              req.TargetID,
		Title:                 req.Title,
		Category:              req.Category,
		Message:               req.Message,
		DetailContent:         req.DetailContent,
		Type:                  req.Type,
		ActionType:            req.ActionType,
		LinkSubTab:            req.LinkSubTab,
		LinkMobileSettingsTab: req.LinkMobileSettingsTab,
		ActionLabel:           req.ActionLabel,
		ActionURL:             req.ActionURL,
		RetentionHours:        req.RetentionHours,
		CreatedBy:             createdBy,
		CreatedAt:             time.Now().UTC(),
		UpdatedAt:             time.Now().UTC(),
	}

	if req.ExpiresInHours > 0 {
		exp := time.Now().UTC().Add(time.Duration(req.ExpiresInHours) * time.Hour)
		notif.ExpiresAt = &exp
	}

	if err := h.DB.Create(&notif).Error; err != nil {
		log.Error().Err(err).Msg("Failed to save broadcast notification")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save notification"})
	}

	// Broadcast instantly via SSE Hub
	services.GetNotificationHub().Broadcast(&notif)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success":      true,
		"message":      "Notification broadcasted successfully",
		"notification": notif,
	})
}

// SuperadminIndex lists all broadcasted notifications with read analytics.
func (h *NotificationHandler) SuperadminIndex(c *fiber.Ctx) error {
	var notifs []models.Notification
	if err := h.DB.Order("created_at DESC").Find(&notifs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch notifications"})
	}

	type AdminNotifItem struct {
		models.Notification
		ReadCount int64 `json:"read_count"`
	}

	var formatted []AdminNotifItem
	for _, n := range notifs {
		var readCount int64
		h.DB.Model(&models.NotificationRead{}).Where("notification_id = ?", n.ID).Count(&readCount)
		formatted = append(formatted, AdminNotifItem{
			Notification: n,
			ReadCount:    readCount,
		})
	}

	return c.JSON(fiber.Map{
		"data":  formatted,
		"total": len(formatted),
	})
}

// SuperadminDelete deletes a broadcast notification and its read receipts.
func (h *NotificationHandler) SuperadminDelete(c *fiber.Ctx) error {
	notifID := c.Params("id")
	if notifID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Notification ID is required"})
	}

	h.DB.Where("notification_id = ?", notifID).Delete(&models.NotificationRead{})
	if err := h.DB.Where("id = ?", notifID).Delete(&models.Notification{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete notification"})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Notification deleted successfully",
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
