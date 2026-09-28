package handlers

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"catavor-backend/internal/config"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

var mobileUARegex = regexp.MustCompile(`(?i)(android|bb\d+|meego).+mobile|avantgo|bada/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino`)

type SPAHandler struct {
	cfg *config.Config
	db  *gorm.DB
}

func NewSPAHandler(cfg *config.Config, db *gorm.DB) *SPAHandler {
	return &SPAHandler{cfg: cfg, db: db}
}

func (h *SPAHandler) ServeSPA(c *fiber.Ctx) error {
	path := c.Path()

	// Skip API routes
	if strings.HasPrefix(path, "/api") || strings.HasPrefix(path, "/sanctum") {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "API endpoint tidak ditemukan.",
		})
	}

	// Check if the root slug in path is blacklisted
	isBlacklistedSlug := false
	if h.db != nil {
		cleanPath := strings.Trim(path, "/")
		parts := strings.Split(cleanPath, "/")
		if len(parts) > 0 && parts[0] != "" {
			firstSegment := strings.ToLower(parts[0])
			// Ignore known system routes
			reserved := map[string]bool{
				"api": true, "assets": true, "auth": true, "login": true, "register": true,
				"dashboard": true, "catalogs": true, "admin": true, "superadmin": true,
				"moderator": true, "support": true, "static": true, "help": true, "terms": true, "privacy": true,
			}
			if !reserved[firstSegment] {
				var count int64
				if err := h.db.Table("blacklisted_slugs").Where("LOWER(slug) = ?", firstSegment).Count(&count).Error; err == nil && count > 0 {
					isBlacklistedSlug = true
				}
			}
		}
	}

	userAgent := c.Get("User-Agent")
	viewQuery := c.Query("view")
	secCHMobile := c.Get("Sec-CH-UA-Mobile")

	isMobile := mobileUARegex.MatchString(userAgent) ||
		viewQuery == "mobile" ||
		secCHMobile == "?1"

	var targetDist string
	var fallbackDist string

	if isMobile {
		targetDist = h.cfg.MobileDistDir
		fallbackDist = h.cfg.DesktopDistDir
	} else {
		targetDist = h.cfg.DesktopDistDir
		fallbackDist = h.cfg.MobileDistDir
	}

	indexPath := resolveIndexHTML(targetDist)
	if indexPath == "" {
		indexPath = resolveIndexHTML(fallbackDist)
	}

	if indexPath == "" {
		return c.Status(fiber.StatusOK).SendString("Frontend belum di-build. Silakan jalankan `.\\build-all.ps1` pada root direktori.")
	}

	c.Set("Content-Type", "text/html; charset=utf-8")
	c.Set("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Set("Pragma", "no-cache")
	c.Set("Expires", "0")

	if isBlacklistedSlug {
		return c.Status(fiber.StatusNotFound).SendFile(indexPath)
	}

	return c.SendFile(indexPath)
}

func resolveIndexHTML(distDir string) string {
	candidates := []string{
		filepath.Join(distDir, "index.html"),
		filepath.Join(distDir, "..", "desktop", "index.html"),
		filepath.Join(distDir, "..", "mobile", "index.html"),
		filepath.Join("public", "desktop", "index.html"),
		filepath.Join("public", "mobile", "index.html"),
		filepath.Join(".", "public", "desktop", "index.html"),
		filepath.Join(".", "public", "mobile", "index.html"),
		filepath.Join("..", "public", "desktop", "index.html"),
		filepath.Join("..", "public", "mobile", "index.html"),
	}

	for _, p := range candidates {
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
			abs, err := filepath.Abs(p)
			if err == nil {
				return abs
			}
			return p
		}
	}
	return ""
}
