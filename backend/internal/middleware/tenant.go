package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

// TenantResolver extracts the active tenant slug from header or URL
func TenantResolver() fiber.Handler {
	return func(c *fiber.Ctx) error {
		slug := strings.TrimSpace(c.Get("X-Store-Slug"))
		if slug == "" {
			slug = strings.TrimSpace(c.Params("slug"))
		}

		if slug != "" {
			c.Locals("tenant_slug", strings.ToLower(slug))
		}

		return c.Next()
	}
}
