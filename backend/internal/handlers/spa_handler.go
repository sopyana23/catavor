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
