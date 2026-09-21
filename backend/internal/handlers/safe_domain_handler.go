package handlers

import (
	"strings"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"

	"github.com/gofiber/fiber/v2"
)

type SafeDomainHandler struct{}

func NewSafeDomainHandler() *SafeDomainHandler {
	return &SafeDomainHandler{}
}

// GetPublicSafeDomains returns active domain strings list for fast caching by frontend clients
func (h *SafeDomainHandler) GetPublicSafeDomains(c *fiber.Ctx) error {
	var domains []models.SafeDomain
	if err := database.DB.Where("is_active = ?", true).Order("domain asc").Find(&domains).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Failed to load safe domains",
		})
	}

	res := make([]string, 0, len(domains))
	for _, d := range domains {
		clean := strings.ToLower(strings.TrimSpace(d.Domain))
		if clean != "" {
			res = append(res, clean)
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    res,
	})
}

// GetAdminSafeDomains returns complete list with metadata for Super Admin management
func (h *SafeDomainHandler) GetAdminSafeDomains(c *fiber.Ctx) error {
	var domains []models.SafeDomain
	q := c.Query("q")
	category := c.Query("category")

	query := database.DB.Model(&models.SafeDomain{})
	if q != "" {
		searchTerm := "%" + strings.ToLower(strings.TrimSpace(q)) + "%"
		query = query.Where("LOWER(domain) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category) LIKE ?", searchTerm, searchTerm, searchTerm)
	}
	if category != "" && category != "Semua" && category != "all" {
		query = query.Where("category = ?", category)
	}

	if err := query.Order("is_system desc, category asc, domain asc").Find(&domains).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal memuat daftar master domain",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    domains,
	})
}

// CreateSafeDomain adds a new domain to the master whitelist
func (h *SafeDomainHandler) CreateSafeDomain(c *fiber.Ctx) error {
	var req struct {
		Domain      string `json:"domain"`
		Category    string `json:"category"`
		Description string `json:"description"`
		IsActive    bool   `json:"is_active"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Payload tidak valid",
		})
	}

	cleanDomain := strings.ToLower(strings.TrimSpace(req.Domain))
	cleanDomain = strings.TrimPrefix(cleanDomain, "https://")
	cleanDomain = strings.TrimPrefix(cleanDomain, "http://")
	cleanDomain = strings.TrimPrefix(cleanDomain, "www.")
	if idx := strings.Index(cleanDomain, "/"); idx != -1 {
		cleanDomain = cleanDomain[:idx]
	}
	if idx := strings.Index(cleanDomain, ":"); idx != -1 {
		cleanDomain = cleanDomain[:idx]
	}

	if cleanDomain == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Nama domain tidak boleh kosong",
		})
	}

	category := strings.TrimSpace(req.Category)
	if category == "" {
		category = "Umum"
	}

	var existing models.SafeDomain
	if err := database.DB.Where("LOWER(domain) = ?", cleanDomain).First(&existing).Error; err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"success": false,
			"error":   "Domain '" + cleanDomain + "' sudah terdaftar dalam master whitelist",
		})
	}

	item := models.SafeDomain{
		Domain:      cleanDomain,
		Category:    security.SanitizePlainText(category, 100),
		Description: security.SanitizePlainText(req.Description, 500),
		IsActive:    true,
		IsSystem:    false,
		CreatedBy:   "Admin",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := database.DB.Create(&item).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal menambahkan domain",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Domain berhasil ditambahkan ke whitelist",
		"data":    item,
	})
}

// UpdateSafeDomain updates domain attributes or active status
func (h *SafeDomainHandler) UpdateSafeDomain(c *fiber.Ctx) error {
	id := c.Params("id")
	var item models.SafeDomain
	if err := database.DB.First(&item, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   "Domain tidak ditemukan",
		})
	}

	var req struct {
		Domain      *string `json:"domain"`
		Category    *string `json:"category"`
		Description *string `json:"description"`
		IsActive    *bool   `json:"is_active"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Payload tidak valid",
		})
	}

	if req.Domain != nil {
		clean := strings.ToLower(strings.TrimSpace(*req.Domain))
		clean = strings.TrimPrefix(clean, "https://")
		clean = strings.TrimPrefix(clean, "http://")
		clean = strings.TrimPrefix(clean, "www.")
		if idx := strings.Index(clean, "/"); idx != -1 {
			clean = clean[:idx]
		}
		if idx := strings.Index(clean, ":"); idx != -1 {
			clean = clean[:idx]
		}
		if clean != "" {
			item.Domain = clean
		}
	}

	if req.Category != nil {
		item.Category = security.SanitizePlainText(strings.TrimSpace(*req.Category), 100)
	}
	if req.Description != nil {
		item.Description = security.SanitizePlainText(strings.TrimSpace(*req.Description), 500)
	}
	if req.IsActive != nil {
		item.IsActive = *req.IsActive
	}

	item.UpdatedAt = time.Now()
	if err := database.DB.Save(&item).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal memperbarui domain",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Domain berhasil diperbarui",
		"data":    item,
	})
}

// DeleteSafeDomain removes a non-system domain
func (h *SafeDomainHandler) DeleteSafeDomain(c *fiber.Ctx) error {
	id := c.Params("id")
	var item models.SafeDomain
	if err := database.DB.First(&item, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   "Domain tidak ditemukan",
		})
	}

	if err := database.DB.Delete(&item).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal menghapus domain",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Domain berhasil dihapus dari whitelist",
	})
}

// ResetDefaultSafeDomains restores original baseline domains
func (h *SafeDomainHandler) ResetDefaultSafeDomains(c *fiber.Ctx) error {
	// Re-insert missing default domains
	defaults := []models.SafeDomain{
		{Domain: "google.com", Category: "Google", Description: "Layanan Pencarian & Ekosistem Google", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "gemini.google.com", Category: "Google", Description: "Google Gemini AI Assistant", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "docs.google.com", Category: "Google", Description: "Google Docs & Spreadsheet", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "drive.google.com", Category: "Google", Description: "Google Drive Cloud Storage", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "mail.google.com", Category: "Google", Description: "Layanan Email Gmail", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "youtube.com", Category: "Media", Description: "Platform Video YouTube", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "youtu.be", Category: "Media", Description: "Tautan Pendek Video YouTube", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "maps.google.com", Category: "Google", Description: "Google Maps & Navigasi Lokasi", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "play.google.com", Category: "Google", Description: "Google Play Store", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "wa.me", Category: "Komunikasi", Description: "WhatsApp Direct Chat & Kontak CS", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "whatsapp.com", Category: "Komunikasi", Description: "Aplikasi WhatsApp Resmi", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "api.whatsapp.com", Category: "Komunikasi", Description: "WhatsApp Business API", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "telegram.org", Category: "Komunikasi", Description: "Aplikasi Telegram Messenger", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "t.me", Category: "Komunikasi", Description: "Tautan Langsung Channel & Kontak Telegram", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "instagram.com", Category: "Media Sosial", Description: "Instagram Official & Katalog Visual", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "facebook.com", Category: "Media Sosial", Description: "Facebook Page & Komunitas", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "fb.me", Category: "Media Sosial", Description: "Tautan Pendek Facebook", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "tiktok.com", Category: "Media Sosial", Description: "TikTok Official & Video Produk", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "x.com", Category: "Media Sosial", Description: "X (Twitter) Official Platform", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "twitter.com", Category: "Media Sosial", Description: "Twitter Platform", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "threads.net", Category: "Media Sosial", Description: "Meta Threads Official", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "linkedin.com", Category: "Media Sosial", Description: "LinkedIn Business Network", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "catavor.com", Category: "Platform", Description: "Platform Utama Catavor", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "catavor.id", Category: "Platform", Description: "Domain Ekosistem Catavor Indonesia", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "localhost", Category: "Platform", Description: "Localhost Development Server", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "canva.com", Category: "Produktivitas", Description: "Layanan Desain Grafis Canva", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "zoom.us", Category: "Komunikasi", Description: "Layanan Video Meeting Zoom", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "github.com", Category: "Produktivitas", Description: "Developer Platform GitHub", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "apple.com", Category: "Mitra", Description: "Situs Resmi Apple", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "apps.apple.com", Category: "Mitra", Description: "Apple App Store", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "midtrans.com", Category: "Finansial", Description: "Payment Gateway Midtrans", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "xendit.co", Category: "Finansial", Description: "Payment Gateway Xendit", IsActive: true, IsSystem: true, CreatedBy: "System"},
	}

	for _, d := range defaults {
		var existing models.SafeDomain
		if err := database.DB.Where("LOWER(domain) = ?", strings.ToLower(d.Domain)).First(&existing).Error; err != nil {
			database.DB.Create(&d)
		} else {
			// Ensure it's marked active
			existing.IsActive = true
			database.DB.Save(&existing)
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Master whitelist domain berhasil disinkronkan dengan default",
	})
}
