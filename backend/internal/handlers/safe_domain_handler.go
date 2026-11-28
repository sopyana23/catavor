package handlers

import (
	"encoding/json"
	"fmt"
	"math"
	"net"
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/net/idna"
	"gorm.io/gorm"
)

func normalizeAndValidateSafeDomain(raw string) (string, error) {
	s := strings.TrimSpace(strings.ToLower(raw))
	if s == "" {
		return "", fmt.Errorf("nama domain tidak boleh kosong")
	}
	for _, r := range s {
		if r <= 0x20 || r == 0x7f {
			return "", fmt.Errorf("nama domain tidak boleh mengandung spasi atau karakter kontrol")
		}
	}
	if strings.HasPrefix(s, "//") {
		return "", fmt.Errorf("format protocol-relative URL tidak diizinkan; masukkan nama host saja")
	}

	if strings.HasPrefix(s, "https://") {
		s = strings.TrimPrefix(s, "https://")
	} else if strings.HasPrefix(s, "http://") {
		s = strings.TrimPrefix(s, "http://")
	} else if colonIdx := strings.Index(s, ":"); colonIdx != -1 {
		// Any other explicit scheme (e.g. javascript:, data:, file:, ftp:) is invalid unless colon is strictly :port
		slashIdx := strings.IndexAny(s, "/?#")
		if slashIdx == -1 || colonIdx < slashIdx {
			afterColon := s[colonIdx+1:]
			if cutIdx := strings.IndexAny(afterColon, "/?#"); cutIdx != -1 {
				afterColon = afterColon[:cutIdx]
			}
			isNumericPort := afterColon != ""
			if isNumericPort {
				for _, ch := range afterColon {
					if ch < '0' || ch > '9' {
						isNumericPort = false
						break
					}
				}
			}
			if !isNumericPort {
				return "", fmt.Errorf("skema URL tidak valid; gunakan hanya nama domain (contoh: example.com)")
			}
		}
	}

	// Isolate authority segment before any path/query/fragment and reject userinfo spoof (@) or wildcards (*)
	authority := s
	if cut := strings.IndexAny(authority, "/?#"); cut != -1 {
		authority = authority[:cut]
	}
	if strings.Contains(authority, "@") {
		return "", fmt.Errorf("nama domain tidak boleh mengandung informasi autentikasi '@'")
	}
	if strings.ContainsAny(authority, "*\\") {
		return "", fmt.Errorf("nama domain tidak boleh mengandung wildcard '*' atau backslash")
	}

	// Reject bracketed / raw IPv6 addresses
	if strings.Contains(authority, "[") || strings.Contains(authority, "]") {
		return "", fmt.Errorf("alamat IPv6 tidak didukung untuk safe domain")
	}

	host := authority
	if colonIdx := strings.LastIndex(host, ":"); colonIdx != -1 {
		portPart := host[colonIdx+1:]
		if portPart == "" {
			return "", fmt.Errorf("format port pada domain tidak valid")
		}
		if p, err := strconv.Atoi(portPart); err != nil || p < 1 || p > 65535 {
			return "", fmt.Errorf("nomor port domain tidak valid")
		}
		host = host[:colonIdx]
	}

	host = strings.TrimSuffix(host, ".")
	host = strings.TrimPrefix(host, "www.")
	if host == "" || len(host) > 253 {
		return "", fmt.Errorf("panjang nama domain harus antara 1 sampai 253 karakter")
	}

	// Normalize Unicode IDN labels into canonical ASCII punycode
	asciiHost, err := idna.Lookup.ToASCII(host)
	if err != nil {
		return "", fmt.Errorf("format domain IDN tidak valid")
	}
	asciiHost = strings.ToLower(strings.TrimSpace(asciiHost))
	if asciiHost == "" || len(asciiHost) > 253 {
		return "", fmt.Errorf("nama domain tidak valid")
	}

	if asciiHost == "localhost" {
		return asciiHost, nil
	}
	if ip := net.ParseIP(asciiHost); ip != nil {
		if ip.To4() == nil {
			return "", fmt.Errorf("hanya domain atau alamat IPv4 yang didukung")
		}
		return ip.String(), nil
	}

	labels := strings.Split(asciiHost, ".")
	if len(labels) < 2 {
		return "", fmt.Errorf("masukkan domain lengkap beserta TLD (contoh: google.com)")
	}
	for _, lbl := range labels {
		if len(lbl) == 0 || len(lbl) > 63 || strings.HasPrefix(lbl, "-") || strings.HasSuffix(lbl, "-") {
			return "", fmt.Errorf("format label hostname domain tidak valid")
		}
		for i := 0; i < len(lbl); i++ {
			ch := lbl[i]
			isAlphaNum := (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')
			if !isAlphaNum && ch != '-' {
				return "", fmt.Errorf("nama domain mengandung karakter yang tidak diizinkan")
			}
		}
	}
	tld := labels[len(labels)-1]
	if len(tld) < 2 {
		return "", fmt.Errorf("ekstensi TLD domain minimal 2 karakter")
	}
	allDigits := true
	for i := 0; i < len(tld); i++ {
		if tld[i] < '0' || tld[i] > '9' {
			allDigits = false
			break
		}
	}
	if allDigits {
		return "", fmt.Errorf("TLD domain tidak boleh seluruhnya angka")
	}

	return asciiHost, nil
}

func safeDomainAuditActor(c *fiber.Ctx) (*uint, string, string, string) {
	if c != nil {
		if u, ok := c.Locals("user").(*models.User); ok && u != nil {
			uid := u.ID
			role := u.PlatformStaffRoleLabel()
			if role == "" {
				role = "superadmin"
			}
			return &uid, role, u.Name, u.Email
		}
	}
	return nil, "superadmin", "Admin", "admin@catavor.local"
}

type SafeDomainHandler struct {
	db *gorm.DB
}

func NewSafeDomainHandler(db *gorm.DB) *SafeDomainHandler {
	return &SafeDomainHandler{db: db}
}

// GetPublicSafeDomains returns active domain strings list with Redis caching for ultra-fast response
func (h *SafeDomainHandler) GetPublicSafeDomains(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	ctx := c.Context()
	cacheKey := "public"

	// 1. Check Redis Cache
	if cached, ok := database.GetSafeDomainsCache(ctx, cacheKey); ok && cached != "" {
		var res []string
		if err := json.Unmarshal([]byte(cached), &res); err == nil {
			c.Set("X-Cache", "HIT-REDIS")
			return c.JSON(fiber.Map{
				"success": true,
				"data":    res,
			})
		}
	}

	// 2. Query Database
	var domains []models.SafeDomain
	if err := h.db.Where("is_active = ?", true).Order("domain asc").Find(&domains).Error; err != nil {
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

	// 3. Save to Redis Cache (24-Hour TTL, automatically purged on write)
	if bytes, err := json.Marshal(res); err == nil {
		database.SetSafeDomainsCache(ctx, cacheKey, string(bytes), 24*time.Hour)
	}

	c.Set("X-Cache", "MISS-REDIS")
	c.Set("Cache-Control", "public, max-age=1800, stale-while-revalidate=86400")
	return c.JSON(fiber.Map{
		"success": true,
		"data":    res,
	})
}

// GetAdminSafeDomains returns paginated list with metadata for Super Admin management (with Redis Caching)
func (h *SafeDomainHandler) GetAdminSafeDomains(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	ctx := c.Context()
	q := strings.TrimSpace(c.Query("q"))
	category := strings.TrimSpace(c.Query("category"))
	if category == "Semua" {
		category = "all"
	}

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

	cacheKey := fmt.Sprintf("admin:cat=%s:q=%s:p=%d:l=%d", category, q, page, limit)

	// 1. Check Redis Cache
	if cached, ok := database.GetSafeDomainsCache(ctx, cacheKey); ok && cached != "" {
		var cachedResp fiber.Map
		if err := json.Unmarshal([]byte(cached), &cachedResp); err == nil {
			c.Set("X-Cache", "HIT-REDIS")
			return c.JSON(cachedResp)
		}
	}

	// 2. Build Base Query
	query := h.db.Model(&models.SafeDomain{})
	if q != "" {
		searchTerm := "%" + escapeLikePattern(strings.ToLower(q)) + "%"
		query = query.Where("LOWER(domain) LIKE ? ESCAPE '\\' OR LOWER(description) LIKE ? ESCAPE '\\' OR LOWER(category) LIKE ? ESCAPE '\\'", searchTerm, searchTerm, searchTerm)
	}
	if category != "" && category != "all" {
		query = query.Where("category = ?", category)
	}

	// Count total items matching filter
	var totalItems int64
	if err := query.Count(&totalItems).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal menghitung total data master domain",
		})
	}

	totalPages := int(math.Ceil(float64(totalItems) / float64(limit)))
	if totalPages == 0 {
		totalPages = 1
	}

	offset := (page - 1) * limit
	var domains []models.SafeDomain
	if err := query.Order("is_system desc, category asc, domain asc").Offset(offset).Limit(limit).Find(&domains).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal memuat daftar master domain",
		})
	}

	// Global table stats across all pages (accurate KPI regardless of active filter/page)
	var globalTotal, globalActive, globalSystem, globalCustom int64
	_ = h.db.Model(&models.SafeDomain{}).Count(&globalTotal).Error
	_ = h.db.Model(&models.SafeDomain{}).Where("is_active = ?", true).Count(&globalActive).Error
	_ = h.db.Model(&models.SafeDomain{}).Where("is_system = ?", true).Count(&globalSystem).Error
	_ = h.db.Model(&models.SafeDomain{}).Where("is_system = ?", false).Count(&globalCustom).Error

	// 2b. Aggregate categories with data (count > 0)
	var categoryCounts []struct {
		Category string `json:"category"`
		Count    int64  `json:"count"`
	}
	h.db.Model(&models.SafeDomain{}).
		Select("category, count(*) as count").
		Group("category").
		Having("count(*) > 0").
		Order("count desc, category asc").
		Scan(&categoryCounts)

	resp := fiber.Map{
		"success":    true,
		"data":       domains,
		"categories": categoryCounts,
		"stats": fiber.Map{
			"total":  globalTotal,
			"active": globalActive,
			"system": globalSystem,
			"custom": globalCustom,
		},
		"pagination": fiber.Map{
			"page":        page,
			"limit":       limit,
			"total":       totalItems,
			"total_items": totalItems,
			"total_pages": totalPages,
			"has_next":    page < totalPages,
			"has_prev":    page > 1,
		},
	}

	// 3. Cache Result in Redis (15m TTL)
	if bytes, err := json.Marshal(resp); err == nil {
		database.SetSafeDomainsCache(ctx, cacheKey, string(bytes), 15*time.Minute)
	}

	c.Set("X-Cache", "MISS-REDIS")
	return c.JSON(resp)
}

// CreateSafeDomain adds a new domain to the master whitelist
func (h *SafeDomainHandler) CreateSafeDomain(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	var req struct {
		Domain      string `json:"domain"`
		Category    string `json:"category"`
		Description string `json:"description"`
		IsActive    *bool  `json:"is_active"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Payload tidak valid",
		})
	}

	cleanDomain, err := normalizeAndValidateSafeDomain(req.Domain)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   strings.ToUpper(err.Error()[:1]) + err.Error()[1:],
		})
	}

	category := strings.TrimSpace(req.Category)
	if category == "" {
		category = "Umum"
	}

	var existing models.SafeDomain
	if err := h.db.Where("LOWER(domain) = ?", cleanDomain).First(&existing).Error; err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"success": false,
			"error":   "Domain '" + cleanDomain + "' sudah terdaftar dalam master whitelist",
		})
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	actorID, actorRole, actorName, actorEmail := safeDomainAuditActor(c)

	item := models.SafeDomain{
		Domain:      cleanDomain,
		Category:    security.SanitizePlainText(category, 100),
		Description: security.SanitizePlainText(req.Description, 500),
		IsActive:    isActive,
		IsSystem:    false,
		CreatedBy:   actorEmail,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&item).Error; err != nil {
			return err
		}
		if !isActive {
			if err := tx.Model(&item).Update("is_active", false).Error; err != nil {
				return err
			}
			item.IsActive = false
		}
		return nil
	}); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal menambahkan domain",
		})
	}

	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		UserID:      actorID,
		ActorRole:   actorRole,
		ActorName:   actorName,
		ActorEmail:  actorEmail,
		Action:      "admin.safe_domain_create",
		Category:    "security",
		EntityType:  "safe_domain",
		EntityID:    &item.ID,
		EntityTitle: item.Domain,
		Description: fmt.Sprintf("Menambahkan domain whitelist '%s' (kategori: %s).", item.Domain, item.Category),
		Changes: map[string]interface{}{
			"after": map[string]interface{}{"domain": item.Domain, "category": item.Category, "is_active": item.IsActive},
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	database.InvalidateSafeDomainsCache(c.Context())

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Domain berhasil ditambahkan ke whitelist",
		"data":    item,
	})
}

// UpdateSafeDomain updates domain attributes or active status
func (h *SafeDomainHandler) UpdateSafeDomain(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	id := c.Params("id")
	var item models.SafeDomain
	if err := h.db.First(&item, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   "Domain tidak ditemukan",
		})
	}

	beforeState := map[string]interface{}{
		"domain":      item.Domain,
		"category":    item.Category,
		"description": item.Description,
		"is_active":   item.IsActive,
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
		clean, err := normalizeAndValidateSafeDomain(*req.Domain)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"error":   strings.ToUpper(err.Error()[:1]) + err.Error()[1:],
			})
		}
		var dup models.SafeDomain
		if err := h.db.Where("LOWER(domain) = ? AND id <> ?", clean, item.ID).First(&dup).Error; err == nil {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"success": false,
				"error":   "Domain '" + clean + "' sudah terdaftar dalam master whitelist",
			})
		}
		item.Domain = clean
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

	item.UpdatedAt = time.Now().UTC()
	if err := h.db.Save(&item).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal memperbarui domain",
		})
	}

	actorID, actorRole, actorName, actorEmail := safeDomainAuditActor(c)
	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		UserID:      actorID,
		ActorRole:   actorRole,
		ActorName:   actorName,
		ActorEmail:  actorEmail,
		Action:      "admin.safe_domain_update",
		Category:    "security",
		EntityType:  "safe_domain",
		EntityID:    &item.ID,
		EntityTitle: item.Domain,
		Description: fmt.Sprintf("Memperbarui domain whitelist '%s' (aktif=%v).", item.Domain, item.IsActive),
		Changes: map[string]interface{}{
			"before": beforeState,
			"after": map[string]interface{}{
				"domain":      item.Domain,
				"category":    item.Category,
				"description": item.Description,
				"is_active":   item.IsActive,
			},
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	database.InvalidateSafeDomainsCache(c.Context())

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Domain berhasil diperbarui",
		"data":    item,
	})
}

// DeleteSafeDomain removes a non-system domain
func (h *SafeDomainHandler) DeleteSafeDomain(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	id := c.Params("id")
	var item models.SafeDomain
	if err := h.db.First(&item, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   "Domain tidak ditemukan",
		})
	}
	if item.IsSystem {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"error":   "Domain sistem bawaan platform tidak dapat dihapus; gunakan toggle nonaktif bila diperlukan",
		})
	}

	if err := h.db.Delete(&item).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal menghapus domain",
		})
	}

	actorID, actorRole, actorName, actorEmail := safeDomainAuditActor(c)
	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		UserID:      actorID,
		ActorRole:   actorRole,
		ActorName:   actorName,
		ActorEmail:  actorEmail,
		Action:      "admin.safe_domain_delete",
		Category:    "security",
		EntityType:  "safe_domain",
		EntityID:    &item.ID,
		EntityTitle: item.Domain,
		Description: fmt.Sprintf("Menghapus domain whitelist '%s'.", item.Domain),
		Changes: map[string]interface{}{
			"before": map[string]interface{}{"domain": item.Domain, "category": item.Category, "is_active": item.IsActive},
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	database.InvalidateSafeDomainsCache(c.Context())

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Domain berhasil dihapus dari whitelist",
	})
}

// ResetDefaultSafeDomains restores original baseline domains
func (h *SafeDomainHandler) ResetDefaultSafeDomains(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	// Re-insert missing default domains
	defaults := []models.SafeDomain{
		{Domain: "catavor.com", Category: "Platform", Description: "Platform Utama Catavor", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "catavor.id", Category: "Platform", Description: "Domain Ekosistem Catavor Indonesia", IsActive: true, IsSystem: true, CreatedBy: "System"},
		{Domain: "localhost", Category: "Platform", Description: "Localhost Development Server", IsActive: true, IsSystem: true, CreatedBy: "System"},
	}

	for _, d := range defaults {
		var existing models.SafeDomain
		if err := h.db.Where("LOWER(domain) = ?", strings.ToLower(d.Domain)).First(&existing).Error; err != nil {
			h.db.Create(&d)
		} else {
			// Ensure it's marked active
			existing.IsActive = true
			h.db.Save(&existing)
		}
	}

	actorID, actorRole, actorName, actorEmail := safeDomainAuditActor(c)
	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		UserID:      actorID,
		ActorRole:   actorRole,
		ActorName:   actorName,
		ActorEmail:  actorEmail,
		Action:      "admin.safe_domain_reset_defaults",
		Category:    "security",
		EntityType:  "safe_domain",
		EntityTitle: "Default Safe Domains",
		Description: "Menyinkronkan master whitelist domain anti-phishing ke konfigurasi default.",
		IPAddress:   c.IP(),
		UserAgent:   c.Get("User-Agent"),
	})

	database.InvalidateSafeDomainsCache(c.Context())

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Master whitelist domain berhasil disinkronkan dengan default",
	})
}
