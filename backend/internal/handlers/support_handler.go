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

// ListMyTickets returns all tickets opened by the authenticated user.
func (h *SupportHandler) ListMyTickets(c *fiber.Ctx) error {
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	var tickets []models.SupportTicket
	query := database.DB.Where("user_id = ?", user.ID)

	if status := strings.TrimSpace(c.Query("status")); status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}

	if err := query.Order("last_message_at DESC, id DESC").Find(&tickets).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil daftar tiket bantuan.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"count":   len(tickets),
		"data":    tickets,
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

	// Scoped ownership check: user must own the ticket
	if err := database.DB.Preload("User").Preload("Store").Where("id = ? AND user_id = ?", id, user.ID).First(&ticket).Error; err != nil {
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

	ticket.Messages = messages

	return c.JSON(fiber.Map{
		"success": true,
		"data":    ticket,
	})
}

// CreateTicket opens a new ticket thread with initial message and optional screenshot attachments.
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

	messageText := security.SanitizeRichText(req.Message, 5000)
	if messageText == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Pesan kendala wajib diisi.",
		})
	}

	category := security.SanitizePlainText(req.Category, 100)
	if category == "" {
		category = "general"
	}

	priority := strings.ToLower(strings.TrimSpace(req.Priority))
	if priority != "low" && priority != "high" && priority != "urgent" {
		priority = "medium"
	}

	var storeID *uint
	if store, ok := c.Locals("store").(*models.Store); ok && store != nil {
		storeID = &store.ID
	}

	now := time.Now().UTC()
	ticketNumber := generateTicketNumber()

	ticket := models.SupportTicket{
		TicketNumber:  ticketNumber,
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
	initialMsg := models.SupportMessage{
		TicketID:       ticket.ID,
		SenderID:       user.ID,
		SenderType:     "user",
		Message:        messageText,
		IsInternalNote: false,
		CreatedAt:      now,
	}
	database.DB.Create(&initialMsg)

	// Save attachments (multi-screenshots)
	if len(req.Attachments) > 0 {
		for _, att := range req.Attachments {
			cleanURL := security.SanitizeURL(att.FileURL)
			if cleanURL != "" {
				attachment := models.SupportAttachment{
					MessageID:  initialMsg.ID,
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

	// Preload full ticket thread
	database.DB.Preload("User").
		Preload("Messages.Attachments").
		First(&ticket, ticket.ID)

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

	if err := database.DB.Where("id = ? AND user_id = ?", id, user.ID).First(&ticket).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Tiket tidak ditemukan atau Anda tidak memiliki izin.",
		})
	}

	if ticket.Status == "closed" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Tiket ini telah ditutup dan tidak dapat menerima balasan baru.",
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

	// Update ticket status to waiting_agent
	ticket.Status = "waiting_agent"
	ticket.LastMessageAt = now
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

// ListAllTickets returns all tickets in system with filtering for CS agents.
func (h *SupportHandler) ListAllTickets(c *fiber.Ctx) error {
	query := database.DB.Model(&models.SupportTicket{}).Preload("User").Preload("Store")

	if status := strings.TrimSpace(c.Query("status")); status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	if category := strings.TrimSpace(c.Query("category")); category != "" && category != "all" {
		query = query.Where("category = ?", category)
	}
	if priority := strings.TrimSpace(c.Query("priority")); priority != "" && priority != "all" {
		query = query.Where("priority = ?", priority)
	}

	var tickets []models.SupportTicket
	if err := query.Order("last_message_at DESC, id DESC").Find(&tickets).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil data antrean tiket.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"count":   len(tickets),
		"data":    tickets,
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
	if err := database.DB.First(&ticket, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Tiket tidak ditemukan.",
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

	// If not internal note, set status to waiting_user
	if !req.IsInternalNote {
		ticket.Status = "waiting_user"
	}
	ticket.LastMessageAt = now
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
	if err := database.DB.First(&ticket, id).Error; err != nil {
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

	if req.Status != "" {
		ticket.Status = strings.ToLower(strings.TrimSpace(req.Status))
	}
	if req.Priority != "" {
		ticket.Priority = strings.ToLower(strings.TrimSpace(req.Priority))
	}
	ticket.UpdatedAt = time.Now().UTC()

	database.DB.Save(&ticket)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Status tiket berhasil diperbarui.",
		"data":    ticket,
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
