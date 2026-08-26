package handlers

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"catavor-backend/internal/config"

	"github.com/gofiber/fiber/v2"
)

var mobileUARegex = regexp.MustCompile(`(?i)(android|bb\d+|meego).+mobile|avantgo|bada/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino`)

type SPAHandler struct {
	cfg *config.Config
}

func NewSPAHandler(cfg *config.Config) *SPAHandler {
	return &SPAHandler{cfg: cfg}
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

	userAgent := c.Get("User-Agent")
	viewQuery := c.Query("view")
	secCHMobile := c.Get("Sec-CH-UA-Mobile")

	isMobile := mobileUARegex.MatchString(userAgent) ||
		viewQuery == "mobile" ||
		secCHMobile == "?1"

	var indexPath string
	if isMobile {
		indexPath = filepath.Join(h.cfg.MobileDistDir, "index.html")
		if _, err := os.Stat(indexPath); os.IsNotExist(err) {
			// Fallback to desktop if mobile not built
			indexPath = filepath.Join(h.cfg.DesktopDistDir, "index.html")
		}
	} else {
		indexPath = filepath.Join(h.cfg.DesktopDistDir, "index.html")
		if _, err := os.Stat(indexPath); os.IsNotExist(err) {
			// Fallback to mobile if desktop not built
			indexPath = filepath.Join(h.cfg.MobileDistDir, "index.html")
		}
	}

	if _, err := os.Stat(indexPath); os.IsNotExist(err) {
		return c.Status(fiber.StatusOK).SendString("Frontend belum di-build. Silakan jalankan `.\\build-all.ps1` pada root direktori.")
	}

	c.Set("Content-Type", "text/html; charset=utf-8")
	c.Set("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Set("Pragma", "no-cache")
	c.Set("Expires", "0")

	return c.SendFile(indexPath)
}
