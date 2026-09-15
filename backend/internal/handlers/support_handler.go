package handlers

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
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

	baseQuery := database.DB.Model(&models.SupportTicket{}).Where("user_id = ?", user.ID)

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
		Preload("Messages", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_internal_note = false").Order("created_at ASC")
		}).
		Order("last_message_at DESC, id DESC").
		Limit(limit).
		Offset(offset).
		Find(&tickets).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil daftar tiket bantuan.",
		})
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

	// Scoped ownership check: user must own the ticket (lookup by id or ticket_number)
	q := database.DB.Preload("User").Preload("Store").Where("user_id = ?", user.ID)
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
	ticket := models.SupportTicket{
		TicketNumber:  generateTicketNumber(),
		UserID:        user.ID,
		StoreID:       storeID,
		Subject:       subject,
		Category:      category,
		Priority:      priority,
		Status:        "open",
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
	var totalCount, actionReqCount, inProgCount, waitUserCount, urgentCount, resolvedCount int64
	database.DB.Model(&models.SupportTicket{}).Count(&totalCount)
	database.DB.Model(&models.SupportTicket{}).Where("status IN (?)", []string{"open", "waiting_agent"}).Count(&actionReqCount)
	database.DB.Model(&models.SupportTicket{}).Where("status = ?", "in_progress").Count(&inProgCount)
	database.DB.Model(&models.SupportTicket{}).Where("status = ?", "waiting_user").Count(&waitUserCount)
	database.DB.Model(&models.SupportTicket{}).Where("priority IN (?) AND status NOT IN (?)", []string{"urgent", "high"}, []string{"resolved", "closed"}).Count(&urgentCount)
	database.DB.Model(&models.SupportTicket{}).Where("status IN (?)", []string{"resolved", "closed"}).Count(&resolvedCount)

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
		Preload("Messages", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at ASC")
		}).
		Order("last_message_at DESC, id DESC").
		Limit(limit).
		Offset(offset).
		Find(&tickets).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil data antrean tiket.",
		})
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
			"waiting_user":    waitUserCount,
			"urgent":          urgentCount,
			"resolved":        resolvedCount,
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

	// If not internal note, update ticket status to waiting_user
	if !req.IsInternalNote {
		ticket.Status = "waiting_user"
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

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Status tiket berhasil diperbarui.",
		"data":    ticket,
	})
}

// StartAutoCloseTicketsWorker runs a background cron worker that periodically (every 12 hours)
// marks resolved tickets older than 7 days as closed (Read-Only hard close).
func (h *SupportHandler) StartAutoCloseTicketsWorker() {
	go func() {
		// Run initial check after 1 minute from boot
		time.Sleep(1 * time.Minute)
		h.runAutoCloseJob()

		ticker := time.NewTicker(12 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			h.runAutoCloseJob()
		}
	}()
}

func (h *SupportHandler) runAutoCloseJob() {
	cutoff := time.Now().UTC().AddDate(0, 0, -7)
	now := time.Now().UTC()

	res := database.DB.Model(&models.SupportTicket{}).
		Where("status = ? AND (resolved_at <= ? OR (resolved_at IS NULL AND updated_at <= ?))", "resolved", cutoff, cutoff).
		Updates(map[string]interface{}{
			"status":     "closed",
			"closed_at":  now,
			"updated_at": now,
		})

	if res.RowsAffected > 0 {
		fmt.Printf("[Support] Auto-closed %d resolved tickets older than 7 days.\n", res.RowsAffected)
	}
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
