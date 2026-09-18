package handlers

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"sync"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"

	"github.com/gofiber/fiber/v2"
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
	cfg *config.Config
}

func NewSupportHandler(cfg *config.Config) *SupportHandler {
	return &SupportHandler{cfg: cfg}
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
	Attachments []AttachmentPayload `json:"attachments"`
}

type ReplyTicketRequest struct {
	Message        string              `json:"message"`
	IsInternalNote bool                `json:"is_internal_note"`
	Attachments    []AttachmentPayload `json:"attachments"`
}

// ListMyTickets returns all tickets opened by the authenticated user with server-side filtering and pagination.
func (h *SupportHandler) ListMyTickets(c *fiber.Ctx) error {
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

	isStaff := strings.EqualFold(user.PlatformRole, "superadmin") || 
		strings.EqualFold(user.PlatformRole, "support") || 
		user.Email == "admin@catavor.com"

	baseQuery := database.DB.Model(&models.SupportTicket{})
	if !isStaff {
		baseQuery = baseQuery.Where("user_id = ?", user.ID)
	}

	// Realtime summary metrics across all tickets for this user
	var metricTotal, metricActive, metricResolved int64
	type statusGroup struct {
		Status string
		Count  int64
	}
	var sgs []statusGroup
	metricQuery := database.DB.Model(&models.SupportTicket{})
	if !isStaff {
		metricQuery = metricQuery.Where("user_id = ?", user.ID)
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
		searchTerm := "%" + strings.ToLower(q) + "%"
		baseQuery = baseQuery.Where("LOWER(ticket_number) LIKE ? OR LOWER(subject) LIKE ?", searchTerm, searchTerm)
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
		database.DB.Model(&models.SupportMessage{}).
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
		database.DB.Raw(`
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

		for i := range tickets {
			tickets[i].UnreadCount = unreadMap[tickets[i].ID]
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
	isStaff := strings.EqualFold(user.PlatformRole, "superadmin") || 
		strings.EqualFold(user.PlatformRole, "support") || 
		user.Email == "admin@catavor.com"

	q := database.DB.Preload("User").Preload("Store")
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
	database.DB.Model(&models.SupportMessage{}).
		Where("ticket_id = ? AND sender_type = ? AND read_at IS NULL", ticket.ID, "agent").
		Update("read_at", now)

	if ticket.Status == "waiting_user" {
		database.DB.Model(&models.SupportTicket{}).Where("id = ?", ticket.ID).Update("status", "in_progress")
		ticket.Status = "in_progress"
	}

	var messages []models.SupportMessage
	database.DB.Where("ticket_id = ? AND is_internal_note = false", ticket.ID).
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
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	id := c.Params("id")
	var ticket models.SupportTicket
	q := database.DB.Where("user_id = ?", user.ID)
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
	database.DB.Model(&models.SupportMessage{}).
		Where("ticket_id = ? AND sender_type = ? AND read_at IS NULL", ticket.ID, "agent").
		Update("read_at", now)

	if ticket.Status == "waiting_user" {
		database.DB.Model(&models.SupportTicket{}).Where("id = ?", ticket.ID).Update("status", "in_progress")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Tiket ditandai sudah dibaca.",
	})
}

// CreateTicket opens a new support inquiry ticket and adds the initial merchant message.
func (h *SupportHandler) CreateTicket(c *fiber.Ctx) error {
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

	subject := security.SanitizePlainText(req.Subject, 255)
	if subject == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Subjek kendala wajib diisi.",
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

	// Fetch primary store if user is a merchant
	var store models.Store
	var storeID *uint
	if err := database.DB.Where("user_id = ?", user.ID).First(&store).Error; err == nil && store.ID != 0 {
		storeID = &store.ID
	}

	now := time.Now().UTC()

	// Compute Multi-Tier SLA based on merchant store tier
	var slaDuration time.Duration
	storePlan := strings.ToLower(string(store.Plan))
	if storePlan == "enterprise" {
		slaDuration = 30 * time.Minute
	} else if storePlan == "pro" {
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

	if err := database.DB.Create(&ticket).Error; err != nil {
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
	database.DB.Create(&msg)

	// Save attachments
	if len(req.Attachments) > 0 {
		for _, att := range req.Attachments {
			cleanURL := security.SanitizeURL(att.FileURL)
			if cleanURL != "" {
				attachment := models.SupportAttachment{
					MessageID:  msg.ID,
					FileURL:    cleanURL,
					StorageKey: security.SanitizePlainText(att.StorageKey, 500),
					FileName:   security.SanitizePlainText(att.FileName, 255),
					FileSize:   att.FileSize,
					FileType:   security.SanitizePlainText(att.FileType, 100),
					CreatedAt:  now,
				}
				database.DB.Create(&attachment)
			}
		}
	}

	// 🤖 Automated SLA & Welcome Auto-Responder (Instant Trigger)
	var systemUserID uint = 1
	var firstAdmin models.User
	if err := database.DB.Where("is_superadmin = ? OR platform_role IN ?", true, []string{"superadmin", "support"}).First(&firstAdmin).Error; err == nil && firstAdmin.ID != 0 {
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
	database.DB.Create(&autoMsg)

	// Preload ticket relations
	database.DB.Preload("User").Preload("Store").Preload("Messages.Attachments").First(&ticket, ticket.ID)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Tiket bantuan berhasil dibuat.",
		"data":    ticket,
	})
}

// ReplyTicket sends a reply message with screenshot attachments to an existing ticket.
func (h *SupportHandler) ReplyTicket(c *fiber.Ctx) error {
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	id := c.Params("id")
	var ticket models.SupportTicket

	q := database.DB.Where("user_id = ?", user.ID)
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
	database.DB.Create(&msg)

	// Save attachments
	if len(req.Attachments) > 0 {
		for _, att := range req.Attachments {
			cleanURL := security.SanitizeURL(att.FileURL)
			if cleanURL != "" {
				attachment := models.SupportAttachment{
					MessageID:  msg.ID,
					FileURL:    cleanURL,
					StorageKey: security.SanitizePlainText(att.StorageKey, 500),
					FileName:   security.SanitizePlainText(att.FileName, 255),
					FileSize:   att.FileSize,
					FileType:   security.SanitizePlainText(att.FileType, 100),
					CreatedAt:  now,
				}
				database.DB.Create(&attachment)
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
	database.DB.Save(&ticket)

	// Preload created message
	database.DB.Preload("Attachments").Preload("Sender").First(&msg, msg.ID)

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
	database.DB.Model(&models.SupportTicket{}).Count(&totalCount)
	database.DB.Model(&models.SupportTicket{}).Where("status IN (?)", []string{"open", "waiting_agent"}).Count(&actionReqCount)
	database.DB.Model(&models.SupportTicket{}).Where("status = ?", "in_progress").Count(&inProgCount)
	database.DB.Model(&models.SupportTicket{}).Where("status = ?", "waiting_user").Count(&waitUserCount)
	database.DB.Model(&models.SupportTicket{}).Where("priority IN (?) AND status NOT IN (?)", []string{"urgent", "high"}, []string{"resolved", "closed"}).Count(&urgentCount)
	database.DB.Model(&models.SupportTicket{}).Where("status IN (?)", []string{"resolved", "closed"}).Count(&resolvedCount)
	database.DB.Model(&models.SupportTicket{}).Where("(sla_breached = true OR (status = 'open' AND sla_due_at IS NOT NULL AND sla_due_at < ?)) AND status NOT IN (?)", nowTime, []string{"resolved", "closed"}).Count(&slaBreachedCount)

	// CSAT Metrics
	var csatRatedCount, csatPositiveCount int64
	var csatAvg float64
	database.DB.Model(&models.SupportTicket{}).Where("rating IS NOT NULL AND rating > 0").Count(&csatRatedCount)
	database.DB.Model(&models.SupportTicket{}).Where("rating >= 4").Count(&csatPositiveCount)
	database.DB.Model(&models.SupportTicket{}).Where("rating IS NOT NULL AND rating > 0").Select("COALESCE(AVG(rating), 0)").Scan(&csatAvg)
	var csatScorePct float64
	if csatRatedCount > 0 {
		csatScorePct = (float64(csatPositiveCount) / float64(csatRatedCount)) * 100.0
	}

	// 2. Build Filtered Query
	query := database.DB.Model(&models.SupportTicket{})

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
		searchTerm := "%" + strings.ToLower(q) + "%"
		query = query.Where(
			"LOWER(ticket_number) LIKE ? OR LOWER(subject) LIKE ? OR user_id IN (SELECT id FROM users WHERE LOWER(name) LIKE ? OR LOWER(email) LIKE ?) OR store_id IN (SELECT id FROM stores WHERE LOWER(store_title) LIKE ? OR LOWER(name) LIKE ?)",
			searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm,
		)
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
		database.DB.Model(&models.SupportMessage{}).
			Select("ticket_id, COUNT(id) as count").
			Where("ticket_id IN (?) AND sender_type = ? AND read_at IS NULL", ticketIDs, "user").
			Group("ticket_id").
			Scan(&unreadRows)

		unreadMap := make(map[uint]int, len(unreadRows))
		for _, r := range unreadRows {
			unreadMap[r.TicketID] = r.Count
		}

		var latestMessages []models.SupportMessage
		database.DB.Raw(`
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

		for i := range tickets {
			tickets[i].UnreadCount = unreadMap[tickets[i].ID]
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
			"total":           totalCount,
			"action_required": actionReqCount,
			"in_progress":     inProgCount,
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
	id := c.Params("id")
	var ticket models.SupportTicket

	q := database.DB.Preload("User").Preload("Store")
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
	database.DB.Model(&models.SupportMessage{}).
		Where("ticket_id = ? AND sender_type = ? AND read_at IS NULL", ticket.ID, "user").
		Update("read_at", now)

	var messages []models.SupportMessage
	database.DB.Where("ticket_id = ?", ticket.ID).
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
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	id := c.Params("id")
	var ticket models.SupportTicket
	q := database.DB
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
	database.DB.Create(&msg)

	// Save attachments
	if len(req.Attachments) > 0 {
		for _, att := range req.Attachments {
			cleanURL := security.SanitizeURL(att.FileURL)
			if cleanURL != "" {
				attachment := models.SupportAttachment{
					MessageID:  msg.ID,
					FileURL:    cleanURL,
					StorageKey: security.SanitizePlainText(att.StorageKey, 500),
					FileName:   security.SanitizePlainText(att.FileName, 255),
					FileSize:   att.FileSize,
					FileType:   security.SanitizePlainText(att.FileType, 100),
					CreatedAt:  now,
				}
				database.DB.Create(&attachment)
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

		// Multi-Channel Outbound Alert: Create In-App Notification for merchant
		notif := models.Notification{
			ID:          fmt.Sprintf("notif-supp-%d-%d", ticket.ID, now.UnixNano()),
			TargetType:  "single_user",
			TargetID:    ticket.UserID,
			Title:       "Balasan Baru dari CS Catavor",
			Message:     fmt.Sprintf("Tim Customer Support Catavor telah menjawab tiket kendala Anda #%s: \"%s\".", ticket.TicketNumber, ticket.Subject),
			Category:    "SISTEM",
			Type:        "ticket",
			ActionType:  "navigate",
			LinkSubTab:  "help",
			ActionLabel: "Buka Tiket Bantuan →",
			ActionURL:   fmt.Sprintf("/admin/help?ticket=%s", ticket.TicketNumber),
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		database.DB.Create(&notif)
	}
	ticket.LastMessageAt = now
	ticket.UpdatedAt = now
	database.DB.Save(&ticket)

	database.DB.Preload("Attachments").Preload("Sender").First(&msg, msg.ID)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Balasan agen CS berhasil dikirim.",
		"data":    msg,
	})
}

// UpdateTicketStatus modifies ticket status (resolved, closed, in_progress).
func (h *SupportHandler) UpdateTicketStatus(c *fiber.Ctx) error {
	id := c.Params("id")
	var ticket models.SupportTicket
	q := database.DB
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

	database.DB.Save(&ticket)

	// 🤖 Automated Resolution Notice (When status transitioned to resolved)
	if ticket.Status == "resolved" && oldStatus != "resolved" {
		var merchant models.User
		database.DB.First(&merchant, ticket.UserID)
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
		database.DB.Create(&resolutionMsg)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Status tiket berhasil diperbarui.",
		"data":    ticket,
	})
}

// RateTicket allows a merchant to submit CSAT rating & optional feedback for a resolved or closed ticket.
func (h *SupportHandler) RateTicket(c *fiber.Ctx) error {
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	id := c.Params("id")
	var ticket models.SupportTicket
	q := database.DB.Where("user_id = ?", user.ID)
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

	database.DB.Save(&ticket)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Terima kasih atas penilaian dan ulasan Anda!",
		"data":    ticket,
	})
}

// UpdatePresence records an active admin presence and typing state on a support ticket.
func (h *SupportHandler) UpdatePresence(c *fiber.Ctx) error {
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
		if err := database.DB.Where("ticket_number = ?", id).Select("id").First(&t).Error; err == nil {
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
	presenceMutex.Lock()
	if ticketPresence[ticketID] == nil {
		ticketPresence[ticketID] = make(map[uint]AdminPresenceInfo)
	}
	ticketPresence[ticketID][user.ID] = AdminPresenceInfo{
		AdminID:   user.ID,
		AdminName: user.Name,
		LastSeen:  now,
		IsTyping:  req.IsTyping,
	}

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
		if err := database.DB.Where("ticket_number = ?", id).Select("id").First(&t).Error; err == nil {
			ticketID = t.ID
		}
	}

	now := time.Now()
	presenceMutex.RLock()
	otherAdmins := make([]AdminPresenceInfo, 0)
	if presMap, ok := ticketPresence[ticketID]; ok {
		for aid, p := range presMap {
			if aid != user.ID && now.Sub(p.LastSeen) <= 35*time.Second {
				otherAdmins = append(otherAdmins, p)
			}
		}
	}
	presenceMutex.RUnlock()

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
	if err := database.DB.Where("status = ? AND reminder_count = 0 AND last_message_at <= ?", "waiting_user", threeDaysAgo).Find(&staleWaitingTickets).Error; err == nil {
		for _, t := range staleWaitingTickets {
			var merchant models.User
			database.DB.First(&merchant, t.UserID)
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
			database.DB.Create(&reminderMsg)

			t.ReminderCount = 1
			t.ReminderSentAt = &now
			t.UpdatedAt = now
			database.DB.Save(&t)
		}
	}

	// 2. Stale Ticket Auto-Resolve (48 jam setelah Reminder)
	twoDaysAgo := now.Add(-48 * time.Hour)
	var ticketsToResolve []models.SupportTicket
	if err := database.DB.Where("status = ? AND reminder_count >= 1 AND reminder_sent_at <= ?", "waiting_user", twoDaysAgo).Find(&ticketsToResolve).Error; err == nil {
		for _, t := range ticketsToResolve {
			var merchant models.User
			database.DB.First(&merchant, t.UserID)
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
			database.DB.Create(&autoResolveMsg)

			t.Status = "resolved"
			t.ResolvedAt = &now
			t.UpdatedAt = now
			database.DB.Save(&t)
		}
	}

	// 3. Stale Resolved Ticket Auto-Close (7 hari setelah Resolved)
	sevenDaysAgo := now.AddDate(0, 0, -7)
	var staleResolvedTickets []models.SupportTicket
	if err := database.DB.Where("status = ? AND resolved_at <= ?", "resolved", sevenDaysAgo).Find(&staleResolvedTickets).Error; err == nil {
		for _, t := range staleResolvedTickets {
			t.Status = "closed"
			t.ClosedAt = &now
			t.UpdatedAt = now
			database.DB.Save(&t)
		}
	}

	// 4. Multi-Tier SLA Breach Detection
	database.DB.Model(&models.SupportTicket{}).
		Where("status = ? AND first_response_at IS NULL AND sla_breached = false AND sla_due_at IS NOT NULL AND sla_due_at <= ?", "open", now).
		Update("sla_breached", true)
}

// ListCannedResponses returns all canned response templates grouped or filtered.
func (h *SupportHandler) ListCannedResponses(c *fiber.Ctx) error {
	var templates []models.SupportCannedResponse
	q := database.DB.Model(&models.SupportCannedResponse{}).Order("sort_order asc, id asc")

	includeInactive := c.Query("include_inactive") == "true"
	if !includeInactive {
		q = q.Where("is_active = true")
	}

	category := strings.TrimSpace(c.Query("category"))
	if category != "" && category != "all" {
		q = q.Where("category = ?", category)
	}

	search := strings.TrimSpace(c.Query("search"))
	if search != "" {
		term := "%" + strings.ToLower(search) + "%"
		q = q.Where("LOWER(title) LIKE ? OR LOWER(shortcut) LIKE ? OR LOWER(content) LIKE ?", term, term, term)
	}

	if err := q.Find(&templates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat template balasan.",
		})
	}

	// Auto-seed default canned responses if empty
	if len(templates) == 0 && category == "" && search == "" {
		SeedDefaultCannedResponses(database.DB)
		if includeInactive {
			database.DB.Order("sort_order asc, id asc").Find(&templates)
		} else {
			database.DB.Where("is_active = true").Order("sort_order asc, id asc").Find(&templates)
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"count":   len(templates),
		"data":    templates,
	})
}

// CreateCannedResponse adds a new quick reply template.
func (h *SupportHandler) CreateCannedResponse(c *fiber.Ctx) error {
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

	title := security.SanitizePlainText(req.Title, 150)
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

	if err := database.DB.Create(&tmpl).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menyimpan template balasan.",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Template balasan berhasil ditambahkan.",
		"data":    tmpl,
	})
}

// UpdateCannedResponse updates an existing canned response template.
func (h *SupportHandler) UpdateCannedResponse(c *fiber.Ctx) error {
	id := c.Params("id")
	tmplID, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "ID template tidak valid.",
		})
	}

	var tmpl models.SupportCannedResponse
	if err := database.DB.First(&tmpl, uint(tmplID)).Error; err != nil {
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
		t := security.SanitizePlainText(*req.Title, 150)
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

	if err := database.DB.Save(&tmpl).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui template balasan.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Template balasan berhasil diperbarui.",
		"data":    tmpl,
	})
}

// DeleteCannedResponse soft-deletes a canned response template.
func (h *SupportHandler) DeleteCannedResponse(c *fiber.Ctx) error {
	id := c.Params("id")
	if tmplID, err := strconv.ParseUint(id, 10, 32); err == nil {
		database.DB.Where("id = ?", uint(tmplID)).Delete(&models.SupportCannedResponse{})
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
	// Remove existing default or deleted
	database.DB.Unscoped().Where("1 = 1").Delete(&models.SupportCannedResponse{})
	SeedDefaultCannedResponses(database.DB)

	var templates []models.SupportCannedResponse
	database.DB.Order("sort_order asc, id asc").Find(&templates)

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
	var articles []models.HelpArticle
	q := database.DB.Where("is_published = true").Order("sort_order asc, id asc")

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
	var articles []models.HelpArticle
	query := database.DB.Where("is_published = true")

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
	slug := strings.ToLower(strings.TrimSpace(c.Params("slug")))
	var article models.HelpArticle

	if err := database.DB.Where("slug = ? AND is_published = true", slug).First(&article).Error; err != nil {
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

// VoteHelpful increments the helpful count of a guide article.
func (h *SupportHandler) VoteHelpful(c *fiber.Ctx) error {
	id := c.Params("id")
	if artID, err := strconv.ParseUint(id, 10, 32); err == nil {
		database.DB.Model(&models.HelpArticle{}).Where("id = ?", uint(artID)).UpdateColumn("helpful_count", gorm.Expr("helpful_count + 1"))
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
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	isStaff := strings.EqualFold(user.PlatformRole, "superadmin") || 
		strings.EqualFold(user.PlatformRole, "support") || 
		user.Email == "admin@catavor.com"

	var unreadTicketsCount int64
	if isStaff {
		database.DB.Model(&models.SupportTicket{}).
			Where("status IN (?)", []string{"open", "waiting_agent"}).
			Count(&unreadTicketsCount)
	} else {
		database.DB.Model(&models.SupportMessage{}).
			Where("ticket_id IN (SELECT id FROM support_tickets WHERE user_id = ?) AND sender_type = ? AND read_at IS NULL AND is_internal_note = false", user.ID, "agent").
			Select("COUNT(DISTINCT ticket_id)").
			Scan(&unreadTicketsCount)
	}

	var latestTime time.Time
	if isStaff {
		database.DB.Model(&models.SupportTicket{}).Select("MAX(last_message_at)").Scan(&latestTime)
	} else {
		database.DB.Model(&models.SupportTicket{}).Where("user_id = ?", user.ID).Select("MAX(last_message_at)").Scan(&latestTime)
	}

	return c.JSON(fiber.Map{
		"success":           true,
		"unread_count":      unreadTicketsCount,
		"latest_message_at": latestTime,
		"timestamp":         time.Now().UTC().Unix(),
	})
}
