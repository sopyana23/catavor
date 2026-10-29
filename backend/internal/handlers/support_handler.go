package handlers

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"mime"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
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

type AdminPresenceInfo struct {
	AdminID   uint      `json:"admin_id"`
	AdminName string    `json:"admin_name"`
	LastSeen  time.Time `json:"last_seen"`
	IsTyping  bool      `json:"is_typing"`
}

var (
	presenceMutex  sync.RWMutex
	ticketPresence = make(map[uint]map[uint]AdminPresenceInfo) // ticketID -> adminID -> AdminPresenceInfo
)

type SupportHandler struct {
	cfg     *config.Config
	storage storage.StorageService
	db      *gorm.DB
}

func NewSupportHandler(cfg *config.Config, strg storage.StorageService, db *gorm.DB) *SupportHandler {
	return &SupportHandler{cfg: cfg, storage: strg, db: db}
}

func generateTicketNumber() string {
	dateStr := time.Now().Format("20060102")
	n, _ := rand.Int(rand.Reader, big.NewInt(9000))
	randomNum := n.Int64() + 1000
	return fmt.Sprintf("TCK-%s-%04d", dateStr, randomNum)
}

type AttachmentPayload struct {
	FileURL    string `json:"file_url"`
	StorageKey string `json:"storage_key"`
	FileName   string `json:"file_name"`
	FileSize   int    `json:"file_size"`
	FileType   string `json:"file_type"`
}

type CreateTicketRequest struct {
	Subject     string              `json:"subject"`
	Category    string              `json:"category"` // billing | technical | catalog_help | account | general
	Priority    string              `json:"priority"` // low | medium | high | urgent
	Message     string              `json:"message"`
	StoreSlug   string              `json:"store_slug"`
	StoreID     *uint               `json:"store_id"`
	Attachments []AttachmentPayload `json:"attachments"`
}

type ReplyTicketRequest struct {
	Message        string              `json:"message"`
	IsInternalNote bool                `json:"is_internal_note"`
	Attachments    []AttachmentPayload `json:"attachments"`
}

// ListMyTickets returns all tickets opened by the authenticated user with server-side filtering, store-scoping, and pagination.
func (h *SupportHandler) ListMyTickets(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

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

	isStaff := user.IsPlatformStaff()

	baseQuery := h.db.Model(&models.SupportTicket{})
	if !isStaff {
		baseQuery = baseQuery.Where("user_id = ?", user.ID)
	}

	// Store scoping filter (Best Practice: Contextual Store filter with fallback to all stores)
	storeSlug := strings.TrimSpace(c.Query("store_slug"))
	scope := strings.ToLower(strings.TrimSpace(c.Query("scope"))) // "store" | "all"
	var scopedStoreID *uint

	if storeSlug != "" && scope != "all" {
		var targetStore models.Store
		if err := h.db.Where("slug = ?", storeSlug).First(&targetStore).Error; err == nil && targetStore.ID != 0 {
			scopedStoreID = &targetStore.ID
			baseQuery = baseQuery.Where("store_id = ?", targetStore.ID)
		}
	} else if storeIDParam := c.Query("store_id"); storeIDParam != "" && scope != "all" {
		if sID, err := strconv.ParseUint(storeIDParam, 10, 32); err == nil && sID > 0 {
			uID := uint(sID)
			scopedStoreID = &uID
			baseQuery = baseQuery.Where("store_id = ?", uID)
		}
	}

	// Realtime summary metrics across relevant tickets for this user
	var metricTotal, metricActive, metricResolved int64
	type statusGroup struct {
		Status string
		Count  int64
	}
	var sgs []statusGroup
	metricQuery := h.db.Model(&models.SupportTicket{})
	if !isStaff {
		metricQuery = metricQuery.Where("user_id = ?", user.ID)
	}
	if scopedStoreID != nil {
		metricQuery = metricQuery.Where("store_id = ?", *scopedStoreID)
	}
	metricQuery.Select("status, COUNT(*) as count").Group("status").Scan(&sgs)
	for _, sg := range sgs {
		metricTotal += sg.Count
		if sg.Status == "resolved" || sg.Status == "closed" {
			metricResolved += sg.Count
		} else {
			metricActive += sg.Count
		}
	}

	// Status filtering
	status := strings.TrimSpace(c.Query("status"))
	if status != "" && status != "all" {
		if status == "active" {
			baseQuery = baseQuery.Where("status IN (?)", []string{"open", "waiting_agent", "in_progress", "waiting_user"})
		} else if status == "resolved" {
			baseQuery = baseQuery.Where("status IN (?)", []string{"resolved", "closed"})
		} else {
			baseQuery = baseQuery.Where("status = ?", status)
		}
	}

	// Keyword search
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		words := strings.Fields(q)
		for _, w := range words {
			cleanW := strings.TrimPrefix(w, "#")
			if cleanW == "" {
				continue
			}
			escapedW := escapeLikePattern(strings.ToLower(cleanW))
			term := "%" + escapedW + "%"
			baseQuery = baseQuery.Where(
				"(LOWER(ticket_number) LIKE ? OR LOWER(subject) LIKE ? OR LOWER(category) LIKE ? OR EXISTS (SELECT 1 FROM support_messages sm WHERE sm.ticket_id = support_tickets.id AND LOWER(sm.message) LIKE ?))",
				term, term, term, term,
			)
		}
	}

	// Time range filtering
	if timeRange := strings.TrimSpace(c.Query("time_range")); timeRange != "" && timeRange != "all" {
		now := time.Now().UTC()
		if timeRange == "30d" {
			cutoff := now.AddDate(0, 0, -30)
			baseQuery = baseQuery.Where("created_at >= ? OR updated_at >= ?", cutoff, cutoff)
		} else if timeRange == "90d" {
			cutoff := now.AddDate(0, 0, -90)
			baseQuery = baseQuery.Where("created_at >= ? OR updated_at >= ?", cutoff, cutoff)
		}
	}

	var totalCount int64
	baseQuery.Count(&totalCount)

	offset := (page - 1) * limit
	var tickets []models.SupportTicket
	if err := baseQuery.Session(&gorm.Session{}).
		Preload("User").
		Preload("Store").
		Order("COALESCE(NULLIF(last_message_at, '0001-01-01 00:00:00+00'), updated_at, created_at) DESC, id DESC").
		Limit(limit).
		Offset(offset).
		Find(&tickets).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil daftar tiket bantuan.",
		})
	}

	if len(tickets) > 0 {
		ticketIDs := make([]uint, len(tickets))
		for i, t := range tickets {
			ticketIDs[i] = t.ID
		}

		// 1. Batch unread counts in 1 single fast index query
		type unreadRes struct {
			TicketID uint `gorm:"column:ticket_id"`
			Count    int  `gorm:"column:count"`
		}
		var unreadRows []unreadRes
		h.db.Model(&models.SupportMessage{}).
			Select("ticket_id, COUNT(id) as count").
			Where("ticket_id IN (?) AND sender_type = ? AND read_at IS NULL AND is_internal_note = false", ticketIDs, "agent").
			Group("ticket_id").
			Scan(&unreadRows)

		unreadMap := make(map[uint]int, len(unreadRows))
		for _, r := range unreadRows {
			unreadMap[r.TicketID] = r.Count
		}

		// 2. Batch fetch ONLY the single latest message per ticket (lean DTO compatibility)
		var latestMessages []models.SupportMessage
		h.db.Raw(`
			SELECT sm.* FROM support_messages sm
			INNER JOIN (
				SELECT ticket_id, MAX(id) as max_id 
				FROM support_messages 
				WHERE ticket_id IN (?) AND is_internal_note = false 
				GROUP BY ticket_id
			) latest ON sm.id = latest.max_id
		`, ticketIDs).Scan(&latestMessages)

		latestMsgMap := make(map[uint]models.SupportMessage, len(latestMessages))
		for _, lm := range latestMessages {
			latestMsgMap[lm.TicketID] = lm
		}

		type attRes struct {
			TicketID uint `gorm:"column:ticket_id"`
			Count    int  `gorm:"column:count"`
		}
		var attRows []attRes
		h.db.Table("support_attachments").
			Select("support_messages.ticket_id, COUNT(support_attachments.id) as count").
			Joins("INNER JOIN support_messages ON support_messages.id = support_attachments.message_id").
			Where("support_messages.ticket_id IN (?) AND support_attachments.deleted_at IS NULL AND support_messages.deleted_at IS NULL", ticketIDs).
			Group("support_messages.ticket_id").
			Scan(&attRows)

		attMap := make(map[uint]int, len(attRows))
		for _, r := range attRows {
			attMap[r.TicketID] = r.Count
		}

		for i := range tickets {
			tickets[i].UnreadCount = unreadMap[tickets[i].ID]
			tickets[i].AttachmentCount = attMap[tickets[i].ID]
			if lm, ok := latestMsgMap[tickets[i].ID]; ok {
				tickets[i].Messages = []models.SupportMessage{lm}
			} else {
				tickets[i].Messages = []models.SupportMessage{}
			}
		}
	}

	totalPages := 0
	if totalCount > 0 {
		totalPages = int((totalCount + int64(limit) - 1) / int64(limit))
	}
	hasMore := page < totalPages

	return c.JSON(fiber.Map{
		"success": true,
		"count":   len(tickets),
		"data":    tickets,
		"metrics": fiber.Map{
			"total":    metricTotal,
			"active":   metricActive,
			"resolved": metricResolved,
		},
		"pagination": fiber.Map{
			"page":        page,
			"limit":       limit,
			"total_items": totalCount,
			"total_pages": totalPages,
			"has_more":    hasMore,
		},
	})
}

// GetTicketDetails returns the full conversation thread for a ticket with verified ownership.
func (h *SupportHandler) GetTicketDetails(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	id := c.Params("id")
	var ticket models.SupportTicket

	// Scoped ownership check: user must own the ticket, or be platform staff (lookup by id or ticket_number)
	isStaff := user.IsPlatformStaff()

	q := h.db.Preload("User").Preload("Store")
	if !isStaff {
		q = q.Where("user_id = ?", user.ID)
	}
	if num, err := strconv.ParseUint(strings.TrimSpace(id), 10, 64); err == nil && num > 0 {
		q = q.Where("id = ? OR ticket_number = ?", num, id)
	} else {
		q = q.Where("ticket_number = ?", id)
	}
	if err := q.First(&ticket).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Tiket tidak ditemukan atau Anda tidak memiliki izin akses.",
		})
	}

	// Mark unread agent messages in this ticket as read by the user
	now := time.Now().UTC()
	h.db.Model(&models.SupportMessage{}).
		Where("ticket_id = ? AND sender_type = ? AND read_at IS NULL", ticket.ID, "agent").
		Update("read_at", now)

	if ticket.Status == "waiting_user" {
		h.db.Model(&models.SupportTicket{}).Where("id = ?", ticket.ID).Update("status", "in_progress")
		ticket.Status = "in_progress"
	}

	var messages []models.SupportMessage
	h.db.Where("ticket_id = ? AND is_internal_note = false", ticket.ID).
		Preload("Attachments").
		Preload("Sender").
		Order("created_at ASC, id ASC").
		Find(&messages)

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"ticket":        ticket,
			"messages":      messages,
			"id":            ticket.ID,
			"ticket_number": ticket.TicketNumber,
			"subject":       ticket.Subject,
			"category":      ticket.Category,
			"priority":      ticket.Priority,
			"status":        ticket.Status,
			"user":          ticket.User,
			"store":         ticket.Store,
			"created_at":    ticket.CreatedAt,
			"updated_at":    ticket.UpdatedAt,
		},
	})
}

// MarkTicketAsRead marks all agent messages in a ticket as read by the merchant.
func (h *SupportHandler) MarkTicketAsRead(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	id := c.Params("id")
	var ticket models.SupportTicket
	q := h.db.Where("user_id = ?", user.ID)
	if num, err := strconv.ParseUint(strings.TrimSpace(id), 10, 64); err == nil && num > 0 {
		q = q.Where("id = ? OR ticket_number = ?", num, id)
	} else {
		q = q.Where("ticket_number = ?", id)
	}
	if err := q.First(&ticket).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Tiket tidak ditemukan.",
		})
	}

	now := time.Now().UTC()
	h.db.Model(&models.SupportMessage{}).
		Where("ticket_id = ? AND sender_type = ? AND read_at IS NULL", ticket.ID, "agent").
		Update("read_at", now)

	if ticket.Status == "waiting_user" {
		h.db.Model(&models.SupportTicket{}).Where("id = ?", ticket.ID).Update("status", "in_progress")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Tiket ditandai sudah dibaca.",
	})
}

// CreateTicket opens a new support inquiry ticket and adds the initial merchant message.
func (h *SupportHandler) CreateTicket(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	var req CreateTicketRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	subject := security.SanitizePlainText(req.Subject, 80)
	if subject == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Subjek kendala wajib diisi.",
		})
	}
	if len([]rune(strings.TrimSpace(req.Subject))) > 200 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Judul subjek tiket maksimal 200 karakter. Tuliskan rincian kendala pada kolom isi pesan.",
		})
	}

	category := strings.ToLower(strings.TrimSpace(req.Category))
	if category == "" {
		category = "general"
	}

	priority := strings.ToLower(strings.TrimSpace(req.Priority))
	if priority == "" {
		priority = "medium"
	}

	initialMessage := security.SanitizeRichText(req.Message, 5000)
	if initialMessage == "" && len(req.Attachments) == 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Deskripsi kendala atau lampiran bukti wajib disertakan.",
		})
	}

	isStaff := user.IsPlatformStaff()

	// Resolve targeted store context (Store-Scoped Best Practice)
	var store models.Store
	var storeID *uint
	targetSlug := strings.TrimSpace(req.StoreSlug)

	if targetSlug != "" {
		if err := h.db.Where("slug = ?", targetSlug).First(&store).Error; err == nil && store.ID != 0 {
			if store.UserID == user.ID || isStaff {
				storeID = &store.ID
			}
		}
	} else if req.StoreID != nil && *req.StoreID != 0 {
		if err := h.db.Where("id = ?", *req.StoreID).First(&store).Error; err == nil && store.ID != 0 {
			if store.UserID == user.ID || isStaff {
				storeID = &store.ID
			}
		}
	}

	// Fallback to user's first store only if no specific store was specified but user owns a store
	if storeID == nil {
		if err := h.db.Where("user_id = ?", user.ID).First(&store).Error; err == nil && store.ID != 0 {
			storeID = &store.ID
		}
	}

	now := time.Now().UTC()

	// Compute Multi-Tier SLA based on the targeted store plan
	var slaDuration time.Duration
	storePlan := strings.ToLower(string(store.Plan))
	if storeID != nil && storePlan == "enterprise" {
		slaDuration = 30 * time.Minute
	} else if storeID != nil && storePlan == "pro" {
		slaDuration = 2 * time.Hour
	} else {
		slaDuration = 8 * time.Hour
	}
	slaDueAt := now.Add(slaDuration)

	ticket := models.SupportTicket{
		TicketNumber:  generateTicketNumber(),
		UserID:        user.ID,
		StoreID:       storeID,
		Subject:       subject,
		Category:      category,
		Priority:      priority,
		Status:        "open",
		SLADueAt:      &slaDueAt,
		SLABreached:   false,
		LastMessageAt: now,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := h.db.Create(&ticket).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal membuat tiket bantuan baru.",
		})
	}

	// Create initial message
	msg := models.SupportMessage{
		TicketID:       ticket.ID,
		SenderID:       user.ID,
		SenderType:     "user",
		Message:        initialMessage,
		IsInternalNote: false,
		CreatedAt:      now,
	}
	h.db.Create(&msg)

	// Save attachments
	if len(req.Attachments) > 0 {
		for _, att := range req.Attachments {
			if attachment, ok := h.buildSupportAttachment(msg.ID, att, now); ok {
				h.db.Create(&attachment)
			}
		}
	}

	// 🤖 Automated SLA & Welcome Auto-Responder (Instant Trigger)
	var systemUserID uint = 1
	var firstAdmin models.User
	if err := h.db.Where("is_superadmin = ? OR platform_role IN ?", true, []string{"superadmin", "support"}).First(&firstAdmin).Error; err == nil && firstAdmin.ID != 0 {
		systemUserID = firstAdmin.ID
	}

	wibLoc := time.FixedZone("WIB", 7*3600)
	localNow := now.In(wibLoc)
	isWorkingHour := localNow.Hour() >= 8 && localNow.Hour() < 17 && localNow.Weekday() >= time.Monday && localNow.Weekday() <= time.Friday

	var autoMsgContent string
	merchantName := user.Name
	if merchantName == "" {
		merchantName = "Bapak/Ibu Merchant"
	}

	if isWorkingHour {
		autoMsgContent = fmt.Sprintf("Halo %s, terima kasih telah menghubungi Layanan Bantuan Catavor. Tiket Anda #%s telah masuk ke antrean tim Customer Support kami dengan komitmen estimasi respon 1-2 jam kerja.", merchantName, ticket.TicketNumber)
	} else {
		autoMsgContent = fmt.Sprintf("Halo %s, pesan Anda pada tiket #%s telah kami terima. Saat ini layanan bantuan sedang berada di luar jam operasional (Senin - Jumat, 08:00 - 17:00 WIB). Tim CS Catavor akan segera membalas kendala Anda mulai pukul 08:00 WIB pada hari kerja berikutnya.", merchantName, ticket.TicketNumber)
	}

	autoMsg := models.SupportMessage{
		TicketID:       ticket.ID,
		SenderID:       systemUserID,
		SenderType:     "system",
		Message:        autoMsgContent,
		IsInternalNote: false,
		CreatedAt:      now.Add(time.Second),
	}
	h.db.Create(&autoMsg)

	// Preload ticket relations
	h.db.Preload("User").Preload("Store").Preload("Messages.Attachments").First(&ticket, ticket.ID)

	targetStoreID := uint(0)
	if ticket.StoreID != nil {
		targetStoreID = *ticket.StoreID
	}

	// Broadcast real-time ticket event to all Superadmin & Support staff via SSE
	go services.GetNotificationHub().BroadcastTicketEvent("ticket_created", ticket, 0, targetStoreID, "superadmin")

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Tiket bantuan berhasil dibuat.",
		"data":    ticket,
	})
}

// ReplyTicket sends a reply message with screenshot attachments to an existing ticket.
func (h *SupportHandler) ReplyTicket(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	id := c.Params("id")
	var ticket models.SupportTicket

	q := h.db.Where("user_id = ?", user.ID)
	if num, err := strconv.ParseUint(strings.TrimSpace(id), 10, 64); err == nil && num > 0 {
		q = q.Where("id = ? OR ticket_number = ?", num, id)
	} else {
		q = q.Where("ticket_number = ?", id)
	}
	if err := q.First(&ticket).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Tiket tidak ditemukan atau Anda tidak memiliki izin.",
		})
	}

	if ticket.Status == "closed" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Tiket bantuan ini telah ditutup permanen (Read-Only) dan diarsipkan. Silakan buat tiket bantuan baru jika ada kendala lanjutan.",
		})
	}

	var req ReplyTicketRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	messageText := security.SanitizeRichText(req.Message, 5000)
	if messageText == "" && len(req.Attachments) == 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Pesan atau lampiran gambar wajib disertakan.",
		})
	}

	now := time.Now().UTC()
	msg := models.SupportMessage{
		TicketID:       ticket.ID,
		SenderID:       user.ID,
		SenderType:     "user",
		Message:        messageText,
		IsInternalNote: false,
		CreatedAt:      now,
	}
	h.db.Create(&msg)

	// Save attachments
	if len(req.Attachments) > 0 {
		for _, att := range req.Attachments {
			if attachment, ok := h.buildSupportAttachment(msg.ID, att, now); ok {
				h.db.Create(&attachment)
			}
		}
	}

	// Auto-Reopen if ticket was resolved, or set to waiting_agent
	if ticket.Status == "resolved" {
		ticket.Status = "waiting_agent"
		ticket.ResolvedAt = nil
		ticket.ClosedAt = nil
	} else {
		ticket.Status = "waiting_agent"
	}
	ticket.ReminderCount = 0
	ticket.ReminderSentAt = nil
	ticket.LastMessageAt = now
	ticket.UpdatedAt = now
	h.db.Save(&ticket)
	database.InvalidateTicketCache(c.Context(), ticket.ID)

	// Preload created message
	h.db.Preload("Attachments").Preload("Sender").First(&msg, msg.ID)

	targetStoreID := uint(0)
	if ticket.StoreID != nil {
		targetStoreID = *ticket.StoreID
	}
	var ticketStoreSlug string
	if ticket.Store != nil && ticket.Store.Slug != "" {
		ticketStoreSlug = ticket.Store.Slug
	} else if targetStoreID > 0 {
		var st models.Store
		if err := h.db.Select("slug").Where("id = ?", targetStoreID).First(&st).Error; err == nil {
			ticketStoreSlug = st.Slug
		}
	}

	// Broadcast real-time ticket reply event to all Superadmin & Support staff via SSE
	go services.GetNotificationHub().BroadcastTicketEvent("ticket_reply_from_user", map[string]interface{}{
		"ticket_id":     ticket.ID,
		"ticket_number": ticket.TicketNumber,
		"store_id":      ticket.StoreID,
		"store_slug":    ticketStoreSlug,
		"subject":       ticket.Subject,
		"status":        ticket.Status,
		"priority":      ticket.Priority,
		"sender_name":   user.Name,
		"message":       msg,
	}, 0, targetStoreID, "superadmin")

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Pesan balasan berhasil dikirim.",
		"data":    msg,
	})
}

// -----------------------------------------------------------------------------
// ADMIN / AGENT SUPPORT MODERATION ENDPOINTS
// -----------------------------------------------------------------------------

// ListAllTickets returns all tickets in system with server-side filtering, search, pagination, and triage metrics.
func (h *SupportHandler) ListAllTickets(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
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

	// 1. Calculate Realtime Triage Metrics across all tickets
	var totalCount, actionReqCount, inProgCount, waitUserCount, urgentCount, resolvedCount, slaBreachedCount int64
	nowTime := time.Now().UTC()
	h.db.Model(&models.SupportTicket{}).Count(&totalCount)
	h.db.Model(&models.SupportTicket{}).Where("status IN (?)", []string{"open", "waiting_agent"}).Count(&actionReqCount)
	h.db.Model(&models.SupportTicket{}).Where("status = ?", "in_progress").Count(&inProgCount)
	h.db.Model(&models.SupportTicket{}).Where("status = ?", "waiting_user").Count(&waitUserCount)
	h.db.Model(&models.SupportTicket{}).Where("priority IN (?) AND status NOT IN (?)", []string{"urgent", "high"}, []string{"resolved", "closed"}).Count(&urgentCount)
	h.db.Model(&models.SupportTicket{}).Where("status IN (?)", []string{"resolved", "closed"}).Count(&resolvedCount)
	h.db.Model(&models.SupportTicket{}).Where("(sla_breached = true OR (status = 'open' AND sla_due_at IS NOT NULL AND sla_due_at < ?)) AND status NOT IN (?)", nowTime, []string{"resolved", "closed"}).Count(&slaBreachedCount)

	// CSAT Metrics
	var csatRatedCount, csatPositiveCount int64
	var csatAvg float64
	h.db.Model(&models.SupportTicket{}).Where("rating IS NOT NULL AND rating > 0").Count(&csatRatedCount)
	h.db.Model(&models.SupportTicket{}).Where("rating >= 4").Count(&csatPositiveCount)
	h.db.Model(&models.SupportTicket{}).Where("rating IS NOT NULL AND rating > 0").Select("COALESCE(AVG(rating), 0)").Scan(&csatAvg)
	var csatScorePct float64
	if csatRatedCount > 0 {
		csatScorePct = (float64(csatPositiveCount) / float64(csatRatedCount)) * 100.0
	}

	// 2. Build Filtered Query
	query := h.db.Model(&models.SupportTicket{})

	if status := strings.TrimSpace(c.Query("status")); status != "" && status != "all" {
		if status == "action_required" {
			query = query.Where("status IN (?)", []string{"open", "waiting_agent"})
		} else if status == "urgent" {
			query = query.Where("priority IN (?) AND status NOT IN (?)", []string{"urgent", "high"}, []string{"resolved", "closed"})
		} else if status == "resolved" {
			query = query.Where("status IN (?)", []string{"resolved", "closed"})
		} else {
			query = query.Where("status = ?", status)
		}
	}

	if category := strings.TrimSpace(c.Query("category")); category != "" && category != "all" {
		query = query.Where("category = ?", category)
	}

	if priority := strings.TrimSpace(c.Query("priority")); priority != "" && priority != "all" {
		query = query.Where("priority = ?", priority)
	}

	if timeRange := strings.TrimSpace(c.Query("time_range")); timeRange != "" && timeRange != "all" {
		now := time.Now().UTC()
		if timeRange == "30d" {
			cutoff := now.AddDate(0, 0, -30)
			query = query.Where("created_at >= ? OR updated_at >= ?", cutoff, cutoff)
		} else if timeRange == "90d" {
			cutoff := now.AddDate(0, 0, -90)
			query = query.Where("created_at >= ? OR updated_at >= ?", cutoff, cutoff)
		}
	}

	if q := strings.TrimSpace(c.Query("q")); q != "" {
		words := strings.Fields(q)
		for _, w := range words {
			cleanW := strings.TrimPrefix(w, "#")
			if cleanW == "" {
				continue
			}
			escapedW := escapeLikePattern(strings.ToLower(cleanW))
			term := "%" + escapedW + "%"
			query = query.Where(
				"(LOWER(ticket_number) LIKE ? OR LOWER(subject) LIKE ? OR LOWER(category) LIKE ? OR LOWER(priority) LIKE ? OR LOWER(status) LIKE ? OR user_id IN (SELECT id FROM users WHERE LOWER(name) LIKE ? OR LOWER(email) LIKE ?) OR store_id IN (SELECT id FROM stores WHERE LOWER(store_title) LIKE ? OR LOWER(slug) LIKE ?) OR EXISTS (SELECT 1 FROM support_messages sm WHERE sm.ticket_id = support_tickets.id AND LOWER(sm.message) LIKE ?))",
				term, term, term, term, term, term, term, term, term, term,
			)
		}
	}

	var filteredCount int64
	query.Count(&filteredCount)

	offset := (page - 1) * limit
	var tickets []models.SupportTicket
	if err := query.Session(&gorm.Session{}).
		Preload("User").
		Preload("Store").
		Order("COALESCE(NULLIF(last_message_at, '0001-01-01 00:00:00+00'), updated_at, created_at) DESC, id DESC").
		Limit(limit).
		Offset(offset).
		Find(&tickets).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil data antrean tiket.",
		})
	}

	if len(tickets) > 0 {
		ticketIDs := make([]uint, len(tickets))
		for i, t := range tickets {
			ticketIDs[i] = t.ID
		}

		type unreadRes struct {
			TicketID uint `gorm:"column:ticket_id"`
			Count    int  `gorm:"column:count"`
		}
		var unreadRows []unreadRes
		h.db.Model(&models.SupportMessage{}).
			Select("ticket_id, COUNT(id) as count").
			Where("ticket_id IN (?) AND sender_type = ? AND read_at IS NULL", ticketIDs, "user").
			Group("ticket_id").
			Scan(&unreadRows)

		unreadMap := make(map[uint]int, len(unreadRows))
		for _, r := range unreadRows {
			unreadMap[r.TicketID] = r.Count
		}

		var latestMessages []models.SupportMessage
		h.db.Raw(`
			SELECT sm.* FROM support_messages sm
			INNER JOIN (
				SELECT ticket_id, MAX(id) as max_id 
				FROM support_messages 
				WHERE ticket_id IN (?) 
				GROUP BY ticket_id
			) latest ON sm.id = latest.max_id
		`, ticketIDs).Scan(&latestMessages)

		latestMsgMap := make(map[uint]models.SupportMessage, len(latestMessages))
		for _, lm := range latestMessages {
			latestMsgMap[lm.TicketID] = lm
		}

		type attRes struct {
			TicketID uint `gorm:"column:ticket_id"`
			Count    int  `gorm:"column:count"`
		}
		var attRows []attRes
		h.db.Table("support_attachments").
			Select("support_messages.ticket_id, COUNT(support_attachments.id) as count").
			Joins("INNER JOIN support_messages ON support_messages.id = support_attachments.message_id").
			Where("support_messages.ticket_id IN (?) AND support_attachments.deleted_at IS NULL AND support_messages.deleted_at IS NULL", ticketIDs).
			Group("support_messages.ticket_id").
			Scan(&attRows)

		attMap := make(map[uint]int, len(attRows))
		for _, r := range attRows {
			attMap[r.TicketID] = r.Count
		}

		for i := range tickets {
			tickets[i].UnreadCount = unreadMap[tickets[i].ID]
			tickets[i].AttachmentCount = attMap[tickets[i].ID]
			if lm, ok := latestMsgMap[tickets[i].ID]; ok {
				tickets[i].Messages = []models.SupportMessage{lm}
			} else {
				tickets[i].Messages = []models.SupportMessage{}
			}
		}
	}

	totalPages := 0
	if filteredCount > 0 {
		totalPages = int((filteredCount + int64(limit) - 1) / int64(limit))
	}
	hasMore := page < totalPages

	return c.JSON(fiber.Map{
		"success": true,
		"count":   len(tickets),
		"data":    tickets,
		"metrics": fiber.Map{
			"total":              totalCount,
			"action_required":    actionReqCount,
			"in_progress":        inProgCount,
			"waiting_user":       waitUserCount,
			"urgent":             urgentCount,
			"resolved":           resolvedCount,
			"sla_breached":       slaBreachedCount,
			"csat_rated_count":   csatRatedCount,
			"csat_avg":           fmt.Sprintf("%.1f", csatAvg),
			"csat_score_percent": int(csatScorePct),
		},
		"pagination": fiber.Map{
			"page":        page,
			"limit":       limit,
			"total_items": filteredCount,
			"total_pages": totalPages,
			"has_more":    hasMore,
		},
	})
}

// GetAdminTicketDetails returns full ticket with chronological messages (including internal notes), sender info, attachments, and store data.
func (h *SupportHandler) GetAdminTicketDetails(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	id := c.Params("id")
	var ticket models.SupportTicket

	q := h.db.Preload("User").Preload("Store")
	if num, err := strconv.ParseUint(strings.TrimSpace(id), 10, 64); err == nil && num > 0 {
		q = q.Where("id = ? OR ticket_number = ?", num, id)
	} else {
		q = q.Where("ticket_number = ?", id)
	}
	if err := q.First(&ticket).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Tiket tidak ditemukan.",
		})
	}

	// Tandai pesan user di tiket ini sebagai sudah dibaca oleh tim CS/Admin
	now := time.Now().UTC()
	h.db.Model(&models.SupportMessage{}).
		Where("ticket_id = ? AND sender_type = ? AND read_at IS NULL", ticket.ID, "user").
		Update("read_at", now)

	var messages []models.SupportMessage
	h.db.Where("ticket_id = ?", ticket.ID).
		Preload("Attachments").
		Preload("Sender").
		Order("created_at ASC, id ASC").
		Find(&messages)

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"ticket":        ticket,
			"messages":      messages,
			"id":            ticket.ID,
			"ticket_number": ticket.TicketNumber,
			"subject":       ticket.Subject,
			"category":      ticket.Category,
			"priority":      ticket.Priority,
			"status":        ticket.Status,
			"user":          ticket.User,
			"store":         ticket.Store,
			"created_at":    ticket.CreatedAt,
			"updated_at":    ticket.UpdatedAt,
		},
	})
}

// ReplyAsAdmin allows CS agents to reply or create internal notes.
func (h *SupportHandler) ReplyAsAdmin(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	id := c.Params("id")
	var ticket models.SupportTicket
	q := h.db
	if num, err := strconv.ParseUint(strings.TrimSpace(id), 10, 64); err == nil && num > 0 {
		q = q.Where("id = ? OR ticket_number = ?", num, id)
	} else {
		q = q.Where("ticket_number = ?", id)
	}
	if err := q.First(&ticket).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Tiket tidak ditemukan.",
		})
	}

	if ticket.Status == "closed" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Tiket ini telah berstatus ditutup permanen (Closed / Read-Only). Buka kembali status tiket terlebih dahulu jika ingin melanjutkan percakapan.",
		})
	}

	var req ReplyTicketRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	messageText := security.SanitizeRichText(req.Message, 5000)
	if messageText == "" && len(req.Attachments) == 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Pesan balasan wajib diisi.",
		})
	}

	now := time.Now().UTC()
	msg := models.SupportMessage{
		TicketID:       ticket.ID,
		SenderID:       user.ID,
		SenderType:     "agent",
		Message:        messageText,
		IsInternalNote: req.IsInternalNote,
		CreatedAt:      now,
	}
	h.db.Create(&msg)

	// Save attachments
	if len(req.Attachments) > 0 {
		for _, att := range req.Attachments {
			if attachment, ok := h.buildSupportAttachment(msg.ID, att, now); ok {
				h.db.Create(&attachment)
			}
		}
	}

	// If not internal note, update ticket status to waiting_user, track First Response SLA & notify merchant
	if !req.IsInternalNote {
		ticket.Status = "waiting_user"

		// Multi-Tier SLA First Response Tracking
		if ticket.FirstResponseAt == nil {
			ticket.FirstResponseAt = &now
			if ticket.SLADueAt != nil && now.After(*ticket.SLADueAt) {
				ticket.SLABreached = true
			}
		}

		// Multi-Channel Outbound Alert: Create In-App Notification for merchant (Store-Scoped)
		notifTargetType := "single_user"
		notifTargetID := ticket.UserID
		actionURL := fmt.Sprintf("/admin/help?ticket=%s", ticket.TicketNumber)

		if ticket.StoreID != nil && *ticket.StoreID > 0 {
			notifTargetType = "single_store"
			notifTargetID = *ticket.StoreID

			var st models.Store
			if err := h.db.Select("slug").Where("id = ?", *ticket.StoreID).First(&st).Error; err == nil && st.Slug != "" {
				actionURL = fmt.Sprintf("/%s/admin/help?ticket=%s", st.Slug, ticket.TicketNumber)
			}
		}

		notif := models.Notification{
			ID:          fmt.Sprintf("notif-supp-%d-%d", ticket.ID, now.UnixNano()),
			TargetType:  notifTargetType,
			TargetID:    notifTargetID,
			Title:       "Balasan Baru dari CS Catavor",
			Message:     fmt.Sprintf("Tim Customer Support Catavor telah menjawab tiket kendala Anda #%s: \"%s\".", ticket.TicketNumber, ticket.Subject),
			Category:    "SISTEM",
			Type:        "ticket",
			ActionType:  "navigate",
			LinkSubTab:  "help",
			ActionLabel: "Buka Tiket Bantuan →",
			ActionURL:   actionURL,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		if err := h.db.Create(&notif).Error; err == nil {
			services.GetNotificationHub().Broadcast(&notif)
		}

		// Transactional Outbox Email Dispatch: Enqueue professional notification email for merchant
		var ticketUser models.User
		if err := h.db.Select("id, name, email").Where("id = ?", ticket.UserID).First(&ticketUser).Error; err == nil && ticketUser.Email != "" {
			recipientName := ticketUser.Name
			if recipientName == "" {
				recipientName = "Pengelola Katalog"
			}
			agentName := user.Name
			if agentName == "" {
				agentName = "Tim Layanan Pelanggan"
			}
			ticketStoreSlug := ""
			ticketStoreTitle := ""
			if ticket.StoreID != nil && *ticket.StoreID > 0 {
				var st models.Store
				if err := h.db.Select("slug, store_title").Where("id = ?", *ticket.StoreID).First(&st).Error; err == nil {
					ticketStoreSlug = st.Slug
					ticketStoreTitle = st.StoreTitle
				}
			}
			mailSub, mailBody := services.BuildSupportReplyEmail(
				recipientName,
				ticketStoreTitle,
				ticket.TicketNumber,
				ticket.Subject,
				agentName,
				messageText,
				ticketStoreSlug,
			)
			_, _ = services.EnqueueEmail(
				ticketUser.Email,
				recipientName,
				"Catavor Customer Support",
				mailSub,
				mailBody,
				"support_reply",
				ticket.TicketNumber,
			)
		}
	}
	ticket.LastMessageAt = now
	ticket.UpdatedAt = now
	h.db.Save(&ticket)
	database.InvalidateTicketCache(c.Context(), ticket.ID)

	h.db.Preload("Attachments").Preload("Sender").First(&msg, msg.ID)

	targetStoreID := uint(0)
	var ticketStoreSlug string
	if ticket.StoreID != nil && *ticket.StoreID > 0 {
		targetStoreID = *ticket.StoreID
		var st models.Store
		if err := h.db.Select("slug").Where("id = ?", *ticket.StoreID).First(&st).Error; err == nil {
			ticketStoreSlug = st.Slug
		}
	}

	// Broadcast real-time ticket reply event to merchant via SSE (Store-Scoped Isolation)
	go services.GetNotificationHub().BroadcastTicketEvent("ticket_reply_from_staff", map[string]interface{}{
		"ticket_id":     ticket.ID,
		"ticket_number": ticket.TicketNumber,
		"store_id":      ticket.StoreID,
		"store_slug":    ticketStoreSlug,
		"subject":       ticket.Subject,
		"status":        ticket.Status,
		"message":       msg,
	}, ticket.UserID, targetStoreID, "")

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Balasan agen CS berhasil dikirim.",
		"data":    msg,
	})
}

// UpdateTicketStatus modifies ticket status (resolved, closed, in_progress).
func (h *SupportHandler) UpdateTicketStatus(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	id := c.Params("id")
	var ticket models.SupportTicket
	q := h.db
	if num, err := strconv.ParseUint(strings.TrimSpace(id), 10, 64); err == nil && num > 0 {
		q = q.Where("id = ? OR ticket_number = ?", num, id)
	} else {
		q = q.Where("ticket_number = ?", id)
	}
	if err := q.First(&ticket).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Tiket tidak ditemukan.",
		})
	}

	var req struct {
		Status   string `json:"status"`
		Priority string `json:"priority"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	now := time.Now().UTC()
	oldStatus := ticket.Status
	if req.Status != "" {
		newStatus := strings.ToLower(strings.TrimSpace(req.Status))
		ticket.Status = newStatus

		if newStatus == "resolved" {
			ticket.ResolvedAt = &now
			ticket.ClosedAt = nil
		} else if newStatus == "closed" {
			ticket.ClosedAt = &now
			if ticket.ResolvedAt == nil {
				ticket.ResolvedAt = &now
			}
		} else {
			// Reopened or in progress
			ticket.ResolvedAt = nil
			ticket.ClosedAt = nil
		}
	}
	if req.Priority != "" {
		ticket.Priority = strings.ToLower(strings.TrimSpace(req.Priority))
	}
	ticket.UpdatedAt = now

	h.db.Save(&ticket)
	database.InvalidateTicketCache(c.Context(), ticket.ID)

	// 🤖 Automated Resolution Notice (When status transitioned to resolved)
	if ticket.Status == "resolved" && oldStatus != "resolved" {
		var merchant models.User
		h.db.First(&merchant, ticket.UserID)
		merchantName := merchant.Name
		if merchantName == "" {
			merchantName = "Bapak/Ibu Merchant"
		}

		resolutionMsg := models.SupportMessage{
			TicketID:       ticket.ID,
			SenderID:       ticket.UserID,
			SenderType:     "system",
			Message:        fmt.Sprintf("Halo %s, kendala pada tiket #%s telah dinyatakan selesai oleh tim Customer Support kami. Jika kendala masih berlanjut atau ada pertanyaan tambahan, Anda dapat membalas pesan ini kapan saja untuk membuka kembali tiket. Terima kasih telah menggunakan Catavor!", merchantName, ticket.TicketNumber),
			IsInternalNote: false,
			CreatedAt:      now.Add(time.Second),
		}
		h.db.Create(&resolutionMsg)
	}

	targetStoreID := uint(0)
	var ticketStoreSlug string
	if ticket.StoreID != nil && *ticket.StoreID > 0 {
		targetStoreID = *ticket.StoreID
		var st models.Store
		if err := h.db.Select("slug").Where("id = ?", *ticket.StoreID).First(&st).Error; err == nil {
			ticketStoreSlug = st.Slug
		}
	}

	// Broadcast status update event to both merchant (store-scoped) and superadmins
	go services.GetNotificationHub().BroadcastTicketEvent("ticket_status_updated", map[string]interface{}{
		"ticket_id":     ticket.ID,
		"ticket_number": ticket.TicketNumber,
		"store_id":      ticket.StoreID,
		"store_slug":    ticketStoreSlug,
		"status":        ticket.Status,
		"old_status":    oldStatus,
	}, ticket.UserID, targetStoreID, "superadmin")

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Status tiket berhasil diperbarui.",
		"data":    ticket,
	})
}

// RateTicket allows a merchant to submit CSAT rating & optional feedback for a resolved or closed ticket.
func (h *SupportHandler) RateTicket(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	id := c.Params("id")
	var ticket models.SupportTicket
	q := h.db.Where("user_id = ?", user.ID)
	if num, err := strconv.ParseUint(strings.TrimSpace(id), 10, 64); err == nil && num > 0 {
		q = q.Where("id = ? OR ticket_number = ?", num, id)
	} else {
		q = q.Where("ticket_number = ?", id)
	}
	if err := q.First(&ticket).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Tiket tidak ditemukan.",
		})
	}

	if ticket.Status != "resolved" && ticket.Status != "closed" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Penilaian hanya dapat diberikan pada tiket yang telah dinyatakan selesai atau ditutup.",
		})
	}

	var req struct {
		Rating  int    `json:"rating"`
		Comment string `json:"comment"`
		AgentID *uint  `json:"agent_id,omitempty"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data penilaian tidak valid.",
		})
	}

	if req.Rating < 1 || req.Rating > 5 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Rating harus berskala 1 hingga 5.",
		})
	}

	now := time.Now().UTC()
	ticket.Rating = &req.Rating
	ticket.RatingComment = security.SanitizePlainText(req.Comment, 1000)
	ticket.RatedAt = &now
	ticket.UpdatedAt = now

	// Associate rating with targeted agent or last responding agent
	if req.AgentID != nil && *req.AgentID > 0 {
		ticket.RatedAgentID = req.AgentID
	} else {
		var lastAgentMsg models.SupportMessage
		if err := h.db.Where("ticket_id = ? AND sender_type = ? AND is_internal_note = false", ticket.ID, "agent").
			Order("id DESC").First(&lastAgentMsg).Error; err == nil && lastAgentMsg.SenderID > 0 {
			ticket.RatedAgentID = &lastAgentMsg.SenderID
		}
	}

	h.db.Save(&ticket)
	database.InvalidateTicketCache(c.Context(), ticket.ID)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Terima kasih atas penilaian dan ulasan Anda!",
		"data":    ticket,
	})
}

// UpdatePresence records an active admin presence and typing state on a support ticket.
func (h *SupportHandler) UpdatePresence(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	id := c.Params("id")
	var ticketID uint
	if num, err := strconv.ParseUint(strings.TrimSpace(id), 10, 64); err == nil && num > 0 {
		ticketID = uint(num)
	} else {
		var t models.SupportTicket
		if err := h.db.Where("ticket_number = ?", id).Select("id").First(&t).Error; err == nil {
			ticketID = t.ID
		}
	}
	if ticketID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Tiket tidak valid.",
		})
	}

	var req struct {
		IsTyping bool `json:"is_typing"`
	}
	_ = c.BodyParser(&req)

	now := time.Now()
	info := AdminPresenceInfo{
		AdminID:   user.ID,
		AdminName: user.Name,
		LastSeen:  now,
		IsTyping:  req.IsTyping,
	}

	if database.IsRedisAvailable() {
		if b, err := json.Marshal(info); err == nil {
			database.SetTicketPresence(c.Context(), ticketID, user.ID, string(b), 15*time.Second)
		}
	}

	presenceMutex.Lock()
	if ticketPresence[ticketID] == nil {
		ticketPresence[ticketID] = make(map[uint]AdminPresenceInfo)
	}
	ticketPresence[ticketID][user.ID] = info

	// Purge stale presence entries (> 35 seconds)
	for aid, p := range ticketPresence[ticketID] {
		if now.Sub(p.LastSeen) > 35*time.Second {
			delete(ticketPresence[ticketID], aid)
		}
	}
	presenceMutex.Unlock()

	return c.JSON(fiber.Map{
		"success": true,
	})
}

// GetPresence returns list of other CS agents currently viewing or typing on this ticket.
func (h *SupportHandler) GetPresence(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	id := c.Params("id")
	var ticketID uint
	if num, err := strconv.ParseUint(strings.TrimSpace(id), 10, 64); err == nil && num > 0 {
		ticketID = uint(num)
	} else {
		var t models.SupportTicket
		if err := h.db.Where("ticket_number = ?", id).Select("id").First(&t).Error; err == nil {
			ticketID = t.ID
		}
	}

	otherAdmins := make([]AdminPresenceInfo, 0)
	if database.IsRedisAvailable() {
		presences := database.GetTicketPresences(c.Context(), ticketID)
		for aid, raw := range presences {
			if aid != user.ID {
				var pInfo AdminPresenceInfo
				if err := json.Unmarshal([]byte(raw), &pInfo); err == nil {
					otherAdmins = append(otherAdmins, pInfo)
				}
			}
		}
	} else {
		now := time.Now()
		presenceMutex.RLock()
		if presMap, ok := ticketPresence[ticketID]; ok {
			for aid, p := range presMap {
				if aid != user.ID && now.Sub(p.LastSeen) <= 35*time.Second {
					otherAdmins = append(otherAdmins, p)
				}
			}
		}
		presenceMutex.RUnlock()
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    otherAdmins,
	})
}

// StartSupportLifecycleWorker executes the full enterprise lifecycle pipeline:
// 1. Stale Auto-Reminder (72h inactivity in waiting_user)
// 2. Stale Auto-Resolve (48h after reminder)
// 3. Stale Auto-Close (7-day grace period expiry)
// 4. Multi-Tier SLA Breach Detection
func (h *SupportHandler) StartSupportLifecycleWorker() {
	go func() {
		// Proactive background cycle every 15 minutes
		ticker := time.NewTicker(15 * time.Minute)
		defer ticker.Stop()

		// Initial cycle run after 10 seconds of server boot
		time.Sleep(10 * time.Second)
		h.runLifecycleTasks()

		for range ticker.C {
			h.runLifecycleTasks()
		}
	}()
}

// StartAutoCloseTicketsWorker maintains backward-compatibility with server boot
func (h *SupportHandler) StartAutoCloseTicketsWorker() {
	h.StartSupportLifecycleWorker()
}

func (h *SupportHandler) runLifecycleTasks() {
	now := time.Now().UTC()

	// 1. Stale Ticket Auto-Reminder (72 jam / 3 hari di waiting_user)
	threeDaysAgo := now.Add(-72 * time.Hour)
	var staleWaitingTickets []models.SupportTicket
	if err := h.db.Where("status = ? AND reminder_count = 0 AND last_message_at <= ?", "waiting_user", threeDaysAgo).Find(&staleWaitingTickets).Error; err == nil {
		for _, t := range staleWaitingTickets {
			var merchant models.User
			h.db.First(&merchant, t.UserID)
			merchantName := merchant.Name
			if merchantName == "" {
				merchantName = "Bapak/Ibu Merchant"
			}

			reminderMsg := models.SupportMessage{
				TicketID:       t.ID,
				SenderID:       t.UserID,
				SenderType:     "system",
				Message:        fmt.Sprintf("Halo %s, kami mencatat bahwa belum ada tanggapan lanjutan pada tiket kendala #%s. Apakah kendala ini masih Anda alami atau sudah terselesaikan? Jika sudah tidak ada kendala, tiket ini akan ditandai selesai secara otomatis oleh sistem dalam 48 jam ke depan. Terima kasih!", merchantName, t.TicketNumber),
				IsInternalNote: false,
				CreatedAt:      now,
			}
			h.db.Create(&reminderMsg)

			t.ReminderCount = 1
			t.ReminderSentAt = &now
			t.UpdatedAt = now
			h.db.Save(&t)
		}
	}

	// 2. Stale Ticket Auto-Resolve (48 jam setelah Reminder)
	twoDaysAgo := now.Add(-48 * time.Hour)
	var ticketsToResolve []models.SupportTicket
	if err := h.db.Where("status = ? AND reminder_count >= 1 AND reminder_sent_at <= ?", "waiting_user", twoDaysAgo).Find(&ticketsToResolve).Error; err == nil {
		for _, t := range ticketsToResolve {
			var merchant models.User
			h.db.First(&merchant, t.UserID)
			merchantName := merchant.Name
			if merchantName == "" {
				merchantName = "Bapak/Ibu Merchant"
			}

			autoResolveMsg := models.SupportMessage{
				TicketID:       t.ID,
				SenderID:       t.UserID,
				SenderType:     "system",
				Message:        fmt.Sprintf("Halo %s, karena tidak ada tanggapan lanjutan setelah pemberitahuan pengingat, tiket #%s telah kami tandai Selesai secara otomatis. Tiket kini memasuki Masa Sanggah 7 Hari. Anda dapat membalas pesan ini kapan saja jika kendala masih berlanjut untuk membukanya kembali.", merchantName, t.TicketNumber),
				IsInternalNote: false,
				CreatedAt:      now,
			}
			h.db.Create(&autoResolveMsg)

			t.Status = "resolved"
			t.ResolvedAt = &now
			t.UpdatedAt = now
			h.db.Save(&t)
		}
	}

	// 3. Stale Resolved Ticket Auto-Close (7 hari setelah Resolved)
	sevenDaysAgo := now.AddDate(0, 0, -7)
	var staleResolvedTickets []models.SupportTicket
	if err := h.db.Where("status = ? AND resolved_at <= ?", "resolved", sevenDaysAgo).Find(&staleResolvedTickets).Error; err == nil {
		for _, t := range staleResolvedTickets {
			t.Status = "closed"
			t.ClosedAt = &now
			t.UpdatedAt = now
			h.db.Save(&t)
		}
	}

	// 4. Multi-Tier SLA Breach Detection
	var breachCount int64
	h.db.Model(&models.SupportTicket{}).
		Where("status = ? AND first_response_at IS NULL AND sla_breached = false AND sla_due_at IS NOT NULL AND sla_due_at <= ?", "open", now).
		Count(&breachCount)
	if breachCount > 0 {
		h.db.Model(&models.SupportTicket{}).
			Where("status = ? AND first_response_at IS NULL AND sla_breached = false AND sla_due_at IS NOT NULL AND sla_due_at <= ?", "open", now).
			Update("sla_breached", true)
	}

	// 5. Automated PDP Ticket Retention & Physical File Hard Purge (UU PDP No. 27/2022)
	pdpStats, err := services.PurgeExpiredClosedTickets(h.db, h.storage)
	if err != nil {
		log.Warn().Err(err).Msg("PDP Ticket Retention Sweeper error during routine lifecycle")
	}

	// 6. Report Heartbeat to Automation Tracker
	totalProcessed := int64(len(staleWaitingTickets) + len(ticketsToResolve) + len(staleResolvedTickets) + int(pdpStats.PurgedTickets))
	summary := fmt.Sprintf("Siklus Helpdesk SLA & PDP: %d pengingat, %d auto-resolved, %d auto-closed, %d tiket PDP dimusnahkan (%d berkas fisik dihapus).",
		len(staleWaitingTickets), len(ticketsToResolve), len(staleResolvedTickets), pdpStats.PurgedTickets, pdpStats.PurgedFiles)
	services.GetAutomationTracker().RecordWorkerHeartbeat(
		"support_lifecycle",
		"running",
		summary,
		"",
		totalProcessed,
		now.Add(15*time.Minute),
	)

	if totalProcessed > 0 || breachCount > 0 {
		services.GetAutomationTracker().RecordLog(services.AutomationLogEntry{
			BotName:       "support_lifecycle",
			BotTitle:      "Bot Helpdesk SLA Escalation & Pemusnahan PDP",
			Target:        "Antrean Tiket Bantuan & Storage",
			Action:        "executed_cycle",
			TriggerType:   "cron",
			TriggeredBy:   "Support Daemon",
			Status:        "success",
			AffectedCount: totalProcessed,
			Details:       fmt.Sprintf("Siklus otomatis: %d pengingat, %d auto-resolved, %d auto-closed, %d SLA breach, %d tiket PDP dimusnahkan (%d berkas fisik).", len(staleWaitingTickets), len(ticketsToResolve), len(staleResolvedTickets), breachCount, pdpStats.PurgedTickets, pdpStats.PurgedFiles),
			Timestamp:     now,
		})
	}
}

// ListCannedResponses returns canned response templates with Redis caching, server-side filtering, and pagination.
func (h *SupportHandler) ListCannedResponses(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	category := strings.TrimSpace(c.Query("category"))
	search := strings.TrimSpace(c.Query("search"))
	if search == "" {
		search = strings.TrimSpace(c.Query("q"))
	}
	includeInactive := c.Query("include_inactive") == "true"
	isAll := c.Query("all") == "true" || c.Query("paginate") == "false"

	page, _ := strconv.Atoi(c.Query("page", "1"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	if limit < 1 {
		limit = 10
	} else if limit > 100 {
		limit = 100
	}

	cacheKey := fmt.Sprintf("cat=%s:q=%s:inact=%t:all=%t:p=%d:l=%d", category, search, includeInactive, isAll, page, limit)
	if cachedData, ok := database.GetSupportTemplatesCache(c.Context(), cacheKey); ok {
		c.Set("X-Cache", "HIT-REDIS")
		c.Set("Content-Type", "application/json")
		return c.SendString(cachedData)
	}

	q := h.db.Model(&models.SupportCannedResponse{})

	if !includeInactive {
		q = q.Where("is_active = true")
	}

	if category != "" && category != "all" {
		q = q.Where("category = ?", category)
	}

	if search != "" {
		term := "%" + strings.ToLower(search) + "%"
		q = q.Where("LOWER(title) LIKE ? OR LOWER(shortcut) LIKE ? OR LOWER(content) LIKE ?", term, term, term)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghitung template balasan.",
		})
	}

	// Auto-seed default canned responses if table is empty
	if total == 0 && category == "" && search == "" {
		SeedDefaultCannedResponses(h.db)
		_ = q.Count(&total).Error
	}

	var templates []models.SupportCannedResponse
	orderQuery := q.Order("sort_order asc, id asc")

	if isAll {
		if err := orderQuery.Find(&templates).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal memuat template balasan.",
			})
		}
	} else {
		offset := (page - 1) * limit
		if err := orderQuery.Offset(offset).Limit(limit).Find(&templates).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal memuat template balasan.",
			})
		}
	}

	totalPages := 1
	if !isAll && limit > 0 && total > 0 {
		totalPages = int((total + int64(limit) - 1) / int64(limit))
	}

	// Aggregate categories with active data (count > 0)
	var categoryCounts []struct {
		Category string `json:"category"`
		Count    int64  `json:"count"`
	}
	catQuery := h.db.Model(&models.SupportCannedResponse{})
	if !includeInactive {
		catQuery = catQuery.Where("is_active = true")
	}
	catQuery.Select("category, count(*) as count").
		Group("category").
		Having("count(*) > 0").
		Order("count desc, category asc").
		Scan(&categoryCounts)

	respMap := fiber.Map{
		"success":    true,
		"count":      len(templates),
		"data":       templates,
		"categories": categoryCounts,
		"pagination": fiber.Map{
			"page":        page,
			"limit":       limit,
			"total":       total,
			"total_pages": totalPages,
		},
	}

	if jsonBytes, err := json.Marshal(respMap); err == nil {
		database.SetSupportTemplatesCache(c.Context(), cacheKey, string(jsonBytes), 15*time.Minute)
	}

	c.Set("X-Cache", "MISS")
	return c.JSON(respMap)
}

// CreateCannedResponse adds a new quick reply template.
func (h *SupportHandler) CreateCannedResponse(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	var req struct {
		Title     string `json:"title"`
		Shortcut  string `json:"shortcut"`
		Category  string `json:"category"`
		Content   string `json:"content"`
		IsActive  *bool  `json:"is_active"`
		SortOrder int    `json:"sort_order"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	if len([]rune(strings.TrimSpace(req.Title))) > 60 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Judul template maksimal 60 karakter.",
		})
	}

	title := security.SanitizePlainText(req.Title, 60)
	content := security.SanitizePlainText(req.Content, 5000)
	if title == "" || content == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Judul dan isi template wajib diisi.",
		})
	}

	category := strings.ToLower(strings.TrimSpace(req.Category))
	if category == "" {
		category = "general"
	}

	shortcut := strings.ToLower(strings.TrimSpace(req.Shortcut))
	shortcut = strings.TrimPrefix(shortcut, "/")

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	tmpl := models.SupportCannedResponse{
		Title:       title,
		Shortcut:    shortcut,
		Category:    category,
		Content:     content,
		CreatedByID: user.ID,
		IsActive:    isActive,
		SortOrder:   req.SortOrder,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	if err := h.db.Create(&tmpl).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menyimpan template balasan.",
		})
	}

	// Purge Redis cache
	database.InvalidateSupportTemplatesCache(c.Context())

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Template balasan berhasil ditambahkan.",
		"data":    tmpl,
	})
}

// UpdateCannedResponse updates an existing canned response template.
func (h *SupportHandler) UpdateCannedResponse(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	id := c.Params("id")
	tmplID, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "ID template tidak valid.",
		})
	}

	var tmpl models.SupportCannedResponse
	if err := h.db.First(&tmpl, uint(tmplID)).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Template balasan tidak ditemukan.",
		})
	}

	var req struct {
		Title     *string `json:"title"`
		Shortcut  *string `json:"shortcut"`
		Category  *string `json:"category"`
		Content   *string `json:"content"`
		IsActive  *bool   `json:"is_active"`
		SortOrder *int    `json:"sort_order"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	if req.Title != nil {
		if len([]rune(strings.TrimSpace(*req.Title))) > 60 {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"success": false,
				"message": "Judul template maksimal 60 karakter.",
			})
		}
		t := security.SanitizePlainText(*req.Title, 60)
		if t != "" {
			tmpl.Title = t
		}
	}
	if req.Content != nil {
		cnt := security.SanitizePlainText(*req.Content, 5000)
		if cnt != "" {
			tmpl.Content = cnt
		}
	}
	if req.Category != nil {
		cat := strings.ToLower(strings.TrimSpace(*req.Category))
		if cat != "" {
			tmpl.Category = cat
		}
	}
	if req.Shortcut != nil {
		sc := strings.ToLower(strings.TrimSpace(*req.Shortcut))
		tmpl.Shortcut = strings.TrimPrefix(sc, "/")
	}
	if req.IsActive != nil {
		tmpl.IsActive = *req.IsActive
	}
	if req.SortOrder != nil {
		tmpl.SortOrder = *req.SortOrder
	}
	tmpl.UpdatedAt = time.Now().UTC()

	if err := h.db.Save(&tmpl).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui template balasan.",
		})
	}

	// Purge Redis cache
	database.InvalidateSupportTemplatesCache(c.Context())

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Template balasan berhasil diperbarui.",
		"data":    tmpl,
	})
}

// DeleteCannedResponse soft-deletes a canned response template.
func (h *SupportHandler) DeleteCannedResponse(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	id := c.Params("id")
	if tmplID, err := strconv.ParseUint(id, 10, 32); err == nil {
		h.db.Where("id = ?", uint(tmplID)).Delete(&models.SupportCannedResponse{})
		// Purge Redis cache
		database.InvalidateSupportTemplatesCache(c.Context())
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Template balasan berhasil dihapus.",
		})
	}

	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
		"success": false,
		"message": "ID template tidak valid.",
	})
}

// ResetDefaultCannedResponses restores standard default templates into the database.
func (h *SupportHandler) ResetDefaultCannedResponses(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	// Remove existing default or deleted
	h.db.Unscoped().Where("1 = 1").Delete(&models.SupportCannedResponse{})
	SeedDefaultCannedResponses(h.db)

	// Purge Redis cache
	database.InvalidateSupportTemplatesCache(c.Context())

	var templates []models.SupportCannedResponse
	h.db.Order("sort_order asc, id asc").Find(&templates)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Template bawaan berhasil dipulihkan.",
		"count":   len(templates),
		"data":    templates,
	})
}

// SeedDefaultCannedResponses populates standard industry quick replies into database.
func SeedDefaultCannedResponses(db *gorm.DB) {
	var count int64
	db.Model(&models.SupportCannedResponse{}).Count(&count)
	if count > 0 {
		return
	}

	defaults := []models.SupportCannedResponse{
		{
			Title:     "Salam & Permintaan Detail Bukti",
			Shortcut:  "salam",
			Category:  "general",
			Content:   "Halo {{merchant_name}}, terima kasih telah menghubungi Bantuan Catavor. Saya {{agent_name}} siap membantu Anda. Untuk mempercepat investigasi tiket {{ticket_number}}, mohon dapat melampirkan screenshot layar kendala serta perkiraan waktu kejadian. Terima kasih!",
			SortOrder: 1,
			IsActive:  true,
		},
		{
			Title:     "Verifikasi Pembayaran & Langganan Pro",
			Shortcut:  "billing",
			Category:  "billing",
			Content:   "Halo {{merchant_name}}, terkait kendala pembayaran pada toko {{store_name}}, pembayaran Anda saat ini sedang dalam proses verifikasi oleh Tim Keuangan kami. Mohon pastikan bukti transfer menampilkan kode referensi/NMID yang jelas. Estimasi verifikasi adalah 10-30 menit.",
			SortOrder: 2,
			IsActive:  true,
		},
		{
			Title:     "Panduan Refresh Cache & Tampilan",
			Shortcut:  "teknis",
			Category:  "technical",
			Content:   "Halo {{merchant_name}}, kendala tampilan produk biasanya disebabkan oleh cache browser lama. Silakan coba langkah berikut: (1) Buka menu Pengaturan Browser -> Bersihkan Cache & Cookies, (2) Lakukan Hard Refresh (Ctrl + F5 di PC atau swipe refresh di HP), (3) Login kembali ke akun Anda.",
			SortOrder: 3,
			IsActive:  true,
		},
		{
			Title:     "Eskalasi ke Tim Developer / Teknis",
			Shortcut:  "eskalasi",
			Category:  "technical",
			Content:   "Halo {{merchant_name}}, laporan kendala Anda pada tiket {{ticket_number}} telah kami teruskan ke Tim Teknis Catavor untuk investigasi mendalam. Kami akan mengabari Anda segera setelah perbaikan selesai diterapkan.",
			SortOrder: 4,
			IsActive:  true,
		},
		{
			Title:     "Konfirmasi Penyelesaian Kendala",
			Shortcut:  "selesai",
			Category:  "closing",
			Content:   "Halo {{merchant_name}}, kendala Anda telah berhasil kami selesaikan. Silakan periksa kembali akun/katalog Anda. Jika ada hal lain yang perlu dibantu, jangan ragu untuk membalas pesan ini. Semoga bisnis {{store_name}} semakin sukses!",
			SortOrder: 5,
			IsActive:  true,
		},
		{
			Title:     "Verifikasi Identitas & Keamanan Akun",
			Shortcut:  "akun",
			Category:  "account",
			Content:   "Halo {{merchant_name}}, demi keamanan data toko {{store_name}}, mohon konfirmasi alamat email terdaftar dan nomor WhatsApp penanggung jawab akun untuk verifikasi perubahan data.",
			SortOrder: 6,
			IsActive:  true,
		},
		{
			Title:     "Pemberitahuan Penutupan Tiket Otomatis",
			Shortcut:  "tutup",
			Category:  "closing",
			Content:   "Halo {{merchant_name}}, karena belum ada tanggapan lanjutan selama beberapa hari pada tiket {{ticket_number}}, kami akan menandai tiket ini selesai. Anda dapat membalas tiket ini kapan saja jika masih membutuhkan bantuan.",
			SortOrder: 7,
			IsActive:  true,
		},
	}

	for _, d := range defaults {
		d.CreatedAt = time.Now().UTC()
		d.UpdatedAt = time.Now().UTC()
		db.Create(&d)
	}
}

// ListHelpArticles returns a list of knowledge base guide articles.
func (h *SupportHandler) ListHelpArticles(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	var articles []models.HelpArticle
	q := h.db.Where("is_published = true").Order("sort_order asc, id asc")

	category := strings.TrimSpace(c.Query("category"))
	if category != "" && category != "all" {
		q = q.Where("category = ?", category)
	}

	if err := q.Find(&articles).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat artikel bantuan.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"count":   len(articles),
		"data":    articles,
	})
}

// -----------------------------------------------------------------------------
// PUBLIC HELP CENTER / KNOWLEDGE BASE ENDPOINTS
// -----------------------------------------------------------------------------

// GetHelpArticles returns published self-service guide articles.
func (h *SupportHandler) GetHelpArticles(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	var articles []models.HelpArticle
	query := h.db.Where("is_published = true")

	if category := strings.TrimSpace(c.Query("category")); category != "" && category != "all" {
		query = query.Where("category = ?", category)
	}

	if search := strings.TrimSpace(c.Query("search")); search != "" {
		pattern := "%" + strings.ToLower(search) + "%"
		query = query.Where("LOWER(title) LIKE ? OR LOWER(content) LIKE ?", pattern, pattern)
	}

	if err := query.Order("sort_order ASC, id ASC").Find(&articles).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat artikel bantuan.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"count":   len(articles),
		"data":    articles,
	})
}

// GetHelpArticleBySlug retrieves a single guide article by slug.
func (h *SupportHandler) GetHelpArticleBySlug(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	slug := strings.ToLower(strings.TrimSpace(c.Params("slug")))
	var article models.HelpArticle

	if err := h.db.Where("slug = ? AND is_published = true", slug).First(&article).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Artikel panduan tidak ditemukan.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    article,
	})
}

// helpfulVoteDedup mencegah satu klien menggelembungkan helpful_count.
// Sebelumnya rute ini terbuka tanpa rate limiter dan tanpa dedup: 40 permintaan
// POST berturut-turut dari satu IP menaikkan helpful_count 0 -> 40.
var helpfulVoteDedup = struct {
	mu   sync.Mutex
	seen map[string]time.Time
}{seen: make(map[string]time.Time)}

const helpfulVoteWindow = 24 * time.Hour

// sudahVoteHelpful mencatat dan melaporkan apakah (ip, articleID) sudah vote
// dalam jendela waktu. Entri kedaluwarsa dibersihkan saat pemanggilan.
func sudahVoteHelpful(ip string, articleID uint) bool {
	key := fmt.Sprintf("%s:%d", ip, articleID)
	now := time.Now()

	helpfulVoteDedup.mu.Lock()
	defer helpfulVoteDedup.mu.Unlock()

	for k, t := range helpfulVoteDedup.seen {
		if now.Sub(t) > helpfulVoteWindow {
			delete(helpfulVoteDedup.seen, k)
		}
	}
	if t, ok := helpfulVoteDedup.seen[key]; ok && now.Sub(t) <= helpfulVoteWindow {
		return true
	}
	helpfulVoteDedup.seen[key] = now
	return false
}

// VoteHelpful increments the helpful count of a guide article.
func (h *SupportHandler) VoteHelpful(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	id := c.Params("id")
	if artID, err := strconv.ParseUint(id, 10, 32); err == nil {
		// N-16: tolak vote berulang dari klien yang sama.
		if sudahVoteHelpful(c.IP(), uint(artID)) {
			return c.JSON(fiber.Map{
				"success": true,
				"message": "Terima kasih atas feedback Anda!",
			})
		}
		h.db.Model(&models.HelpArticle{}).Where("id = ?", uint(artID)).UpdateColumn("helpful_count", gorm.Expr("helpful_count + 1"))
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Terima kasih atas feedback Anda!",
		})
	}

	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
		"success": false,
		"message": "ID artikel tidak valid.",
	})
}

// GetSupportTicketsPing provides a super-fast, lightweight polling heartbeat for merchants and staff.
func (h *SupportHandler) GetSupportTicketsPing(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	isStaff := user.IsPlatformStaff()

	var unreadTicketsCount int64
	if isStaff {
		h.db.Model(&models.SupportTicket{}).
			Where("status IN (?)", []string{"open", "waiting_agent"}).
			Count(&unreadTicketsCount)
	} else {
		// Scoped by store context if provided
		storeSlug := strings.TrimSpace(c.Query("store_slug"))
		if storeSlug == "" {
			storeSlug = strings.TrimSpace(c.Query("slug"))
		}
		if storeSlug == "" {
			storeSlug = strings.TrimSpace(c.Get("X-Store-Slug"))
		}
		scope := strings.ToLower(strings.TrimSpace(c.Query("scope")))

		var scopedStoreID uint
		if storeSlug != "" && scope != "all" {
			var st models.Store
			if err := h.db.Where("slug = ? AND user_id = ?", storeSlug, user.ID).First(&st).Error; err == nil {
				scopedStoreID = st.ID
			}
		}

		q := h.db.Model(&models.SupportMessage{}).
			Where("sender_type = ? AND read_at IS NULL AND is_internal_note = false", "agent")

		if scopedStoreID > 0 {
			q = q.Where("ticket_id IN (SELECT id FROM support_tickets WHERE user_id = ? AND store_id = ?)", user.ID, scopedStoreID)
		} else {
			q = q.Where("ticket_id IN (SELECT id FROM support_tickets WHERE user_id = ?)", user.ID)
		}

		q.Select("COUNT(DISTINCT ticket_id)").Scan(&unreadTicketsCount)
	}

	var latestTime time.Time
	if isStaff {
		h.db.Model(&models.SupportTicket{}).Select("MAX(last_message_at)").Scan(&latestTime)
	} else {
		h.db.Model(&models.SupportTicket{}).Where("user_id = ?", user.ID).Select("MAX(last_message_at)").Scan(&latestTime)
	}

	return c.JSON(fiber.Map{
		"success":           true,
		"unread_count":      unreadTicketsCount,
		"latest_message_at": latestTime,
		"timestamp":         time.Now().UTC().Unix(),
	})
}

// ServeAttachment securely serves a support ticket attachment with strict RBAC authorization.
func (h *SupportHandler) ServeAttachment(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan untuk mengakses lampiran dokumen.",
		})
	}

	idStr := strings.TrimSpace(c.Params("id"))
	if idStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "ID lampiran tidak valid.",
		})
	}

	var attachment models.SupportAttachment
	var found bool

	// 1. Try lookup by primary key ID
	if attID, err := strconv.ParseUint(idStr, 10, 64); err == nil && attID > 0 {
		if err := h.db.Preload("Message.Ticket").First(&attachment, attID).Error; err == nil {
			found = true
		}
	}

	// 2. Fallback lookup by storage_key / file_url. Input user WAJIB di-escape:
	// tanpa ini, "%" atau "_" yang dikirim penyerang menjadi wildcard dan bisa
	// mencocokkan lampiran milik tiket lain (L1: ambiguous lookup).
	if !found && idStr != "" {
		escaped := escapeLikePattern(idStr)
		if err := h.db.Preload("Message.Ticket").
			Where("storage_key LIKE ? ESCAPE '\\' OR file_url LIKE ? ESCAPE '\\'",
				"%"+escaped+"%", "%"+escaped+"%").
			First(&attachment).Error; err == nil {
			found = true
		}
	}

	if !found {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Lampiran dokumen tidak ditemukan.",
		})
	}

	// 3. Strict RBAC Authorization Check
	isStaff := user.IsPlatformStaff()

	isOwner := false
	if attachment.Message != nil && attachment.Message.Ticket != nil {
		ticket := attachment.Message.Ticket
		if ticket.UserID == user.ID {
			isOwner = true
		}
		if ticket.StoreID != nil && *ticket.StoreID > 0 {
			if activeStore, ok := c.Locals("store").(*models.Store); ok && activeStore != nil && activeStore.ID == *ticket.StoreID {
				isOwner = true
			} else {
				var count int64
				h.db.Model(&models.Store{}).Where("id = ? AND user_id = ?", *ticket.StoreID, user.ID).Count(&count)
				if count > 0 {
					isOwner = true
				}
			}
		}
	}

	if !isStaff && !isOwner {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses ditolak: Anda tidak memiliki izin untuk melihat atau mengunduh dokumen lampiran ini.",
		})
	}

	// 4. Resolve Local File Path on Server
	// SECURITY (L1 + ST-01): semua path WAJIB tetap di dalam root yang sesuai.
	// Tanpa ini, StorageKey/FileURL berisi "../" bisa membaca berkas di luar root
	// (path traversal). resolveInsideRoot menolak hasil yang keluar dari root.
	// Key privat ("private/...") dipetakan ke StoragePrivateRoot; key lama
	// (publik) tetap dipetakan ke StorageLocalRoot agar data historis terbaca.
	cleanKey := strings.TrimLeft(filepath.ToSlash(attachment.StorageKey), "/")
	var filePath string
	if cleanKey != "" {
		if candidate, ok := h.resolveAttachmentPath(cleanKey); ok {
			filePath = candidate
		}
	}

	// Fallback lookup via FileURL if storage_key is relative or changed
	if filePath == "" && attachment.FileURL != "" {
		if u, err := url.Parse(attachment.FileURL); err == nil {
			urlPath := strings.TrimPrefix(u.Path, "/storage/")
			urlPath = strings.TrimPrefix(urlPath, "storage/")
			if candidate, ok := h.resolveAttachmentPath(urlPath); ok {
				filePath = candidate
			}
		}
	}

	if filePath == "" || !isRegularFile(filePath) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "File fisik lampiran tidak ditemukan di penyimpanan server.",
		})
	}

	// 5. Response Headers & Content Negotiation
	fileName := attachment.FileName
	if fileName == "" {
		fileName = filepath.Base(filePath)
	}

	contentType := attachment.FileType
	if contentType == "" || contentType == "application/octet-stream" {
		contentType = mime.TypeByExtension(filepath.Ext(filePath))
		if contentType == "" {
			contentType = "application/octet-stream"
		}
	}

	isDownload := c.Query("download") == "1" || strings.EqualFold(c.Query("download"), "true")

	// SECURITY (ST-08): berkas non-gambar TIDAK boleh dirender inline oleh
	// browser. Render inline same-origin memungkinkan dokumen (khususnya PDF)
	// tampil seolah berasal dari domain Catavor — bahan phishing yang meyakinkan
	// — dan memaksa parser PDF berjalan di origin aplikasi. Gambar tetap inline
	// agar preview lampiran berfungsi.
	dispositionType := "attachment"
	if !isDownload && strings.HasPrefix(strings.ToLower(contentType), "image/") {
		dispositionType = "inline"
	}

	// Sanitize fileName for Content-Disposition header
	safeFileName := strings.ReplaceAll(fileName, `"`, `_`)
	c.Set("Content-Type", contentType)
	c.Set("Content-Disposition", fmt.Sprintf(`%s; filename="%s"`, dispositionType, safeFileName))
	c.Set("X-Content-Type-Options", "nosniff")
	// SECURITY (ST-01): lampiran tiket bersifat privat per-pengguna. Cache
	// bersama (proxy, cache disk browser) tidak boleh menyimpannya.
	c.Set("Cache-Control", "private, no-store")
	c.Set("Pragma", "no-cache")

	return c.SendFile(filePath)
}

// resolveAttachmentPath memetakan storage key lampiran ke path fisik di disk.
//
// Key privat ("private/...") hanya dicari di StoragePrivateRoot — direktori
// yang tidak dilayani route statis mana pun. Key lama (publik, tanpa prefix)
// tetap dicari di StorageLocalRoot supaya lampiran historis tetap terbaca.
func (h *SupportHandler) resolveAttachmentPath(key string) (string, bool) {
	cleanKey := strings.TrimLeft(filepath.ToSlash(strings.TrimSpace(key)), "/")
	if cleanKey == "" || h.cfg == nil {
		return "", false
	}

	if storage.IsPrivateKey(cleanKey) {
		relKey := strings.TrimPrefix(cleanKey, storage.PrivateKeyPrefix)
		if candidate, ok := resolveInsideRoot(h.cfg.StoragePrivateRoot, relKey); ok && isRegularFile(candidate) {
			return candidate, true
		}
		return "", false
	}

	if candidate, ok := resolveInsideRoot(h.cfg.StorageLocalRoot, cleanKey); ok && isRegularFile(candidate) {
		return candidate, true
	}
	return "", false
}

// buildSupportAttachment menyusun record lampiran dari payload klien.
//
// SECURITY (ST-01): berkas privat tidak lagi punya URL publik, sehingga
// FileURL bisa kosong sementara storage_key terisi. Lampiran sah tidak boleh
// dibuang hanya karena URL-nya kosong — itu akan menghilangkan dokumen
// pengguna secara diam-diam.
func (h *SupportHandler) buildSupportAttachment(msgID uint, att AttachmentPayload, now time.Time) (models.SupportAttachment, bool) {
	cleanURL := security.SanitizeURL(att.FileURL)
	storageKey := storageKeyFromInput(att.StorageKey, cleanURL)

	if cleanURL == "" && storageKey == "" {
		return models.SupportAttachment{}, false
	}

	return models.SupportAttachment{
		MessageID:  msgID,
		FileURL:    cleanURL,
		StorageKey: storageKey,
		FileName:   security.SanitizePlainText(att.FileName, 255),
		FileSize:   att.FileSize,
		FileType:   security.SanitizePlainText(att.FileType, 100),
		CreatedAt:  now,
	}, true
}

// storageKeyFromInput menentukan storage key lampiran. Klien boleh mengirim
// storage_key eksplisit; bila tidak, key diturunkan dari path FileURL
// (".../storage/<key>") supaya lampiran lama tetap dapat dipetakan ke berkas
// fisiknya oleh ServeAttachment.
func storageKeyFromInput(rawKey, cleanURL string) string {
	if k := security.SanitizePlainText(rawKey, 500); k != "" {
		return strings.TrimLeft(filepath.ToSlash(strings.TrimSpace(k)), "/")
	}
	if cleanURL == "" {
		return ""
	}
	u, err := url.Parse(cleanURL)
	if err != nil {
		return ""
	}
	p := strings.TrimLeft(u.Path, "/")
	p = strings.TrimPrefix(p, "storage/")
	return security.SanitizePlainText(p, 500)
}

func isRegularFile(path string) bool {
	info, err := os.Stat(path)
	if err != nil || os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
}

// resolveInsideRoot menggabungkan root dengan key relatif dan MEMASTIKAN hasilnya
// tetap berada di dalam root. Mencegah path traversal ("../") pada nilai yang
// berasal dari database (storage_key / file_url).
//
// Return ok=false bila key kosong, absolut, atau hasil resolve keluar dari root.
func resolveInsideRoot(root, key string) (string, bool) {
	if root == "" || key == "" {
		return "", false
	}
	// Tolak path absolut & skema drive (C:\...) sebelum digabung.
	if filepath.IsAbs(key) || strings.Contains(key, ":") {
		return "", false
	}

	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", false
	}
	candidate := filepath.Join(absRoot, filepath.FromSlash(key))

	// EvalSymlinks bila memungkinkan, agar symlink keluar root ikut tertangkap.
	resolved := candidate
	if rp, err := filepath.EvalSymlinks(candidate); err == nil {
		resolved = rp
	}

	rel, err := filepath.Rel(absRoot, resolved)
	if err != nil {
		return "", false
	}
	// Rel mengembalikan ".." di awal bila keluar dari root.
	if rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return "", false
	}
	return resolved, true
}
