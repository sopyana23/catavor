package middleware

import (
	"fmt"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
)

// RequirePermission enforces granular database-driven permission checks with Superadmin bypass.
func RequirePermission(cfg *config.Config, requiredPermission string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userVal := c.Locals("user")
		if userVal == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "UNAUTHENTICATED",
				"message": "Autentikasi diperlukan.",
			})
		}

		user, ok := userVal.(*models.User)
		if !ok || user == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "UNAUTHENTICATED",
				"message": "Sesi pengguna tidak valid.",
			})
		}

		rbac := services.GetRBACService()
		if !rbac.HasPermission(user, requiredPermission) {
			// Log rejected access attempt as a security event
			services.RecordActivity(services.RecordActivityParams{
				DB:          database.DB,
				UserID:      &user.ID,
				ActorEmail:  user.Email,
				ActorName:   user.Name,
				ActorRole:   user.PlatformRole,
				Action:      "RBAC_ACCESS_DENIED",
				Category:    "security",
				EntityType:  "permission",
				EntityTitle: requiredPermission,
				Description: fmt.Sprintf("Akses ditolak untuk pengguna '%s' (Role: '%s') pada izin '%s' di rute '%s'.", user.Email, user.PlatformRole, requiredPermission, c.Path()),
				IPAddress:   c.IP(),
				UserAgent:   c.Get("User-Agent"),
			})

			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "FORBIDDEN_PERMISSION_REQUIRED",
				"message": fmt.Sprintf("Akses Ditolak: Anda memerlukan hak akses '%s' untuk melakukan tindakan ini.", requiredPermission),
			})
		}

		return c.Next()
	}
}

// RequireAnyPermission allows access if the user has AT LEAST ONE of the specified permissions.
func RequireAnyPermission(cfg *config.Config, permissions ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userVal := c.Locals("user")
		if userVal == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "UNAUTHENTICATED",
				"message": "Autentikasi diperlukan.",
			})
		}

		user, ok := userVal.(*models.User)
		if !ok || user == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "UNAUTHENTICATED",
				"message": "Sesi pengguna tidak valid.",
			})
		}

		rbac := services.GetRBACService()
		hasAny := false
		for _, p := range permissions {
			if rbac.HasPermission(user, p) {
				hasAny = true
				break
			}
		}

		if !hasAny {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "FORBIDDEN_PERMISSION_REQUIRED",
				"message": "Akses Ditolak: Anda tidak memiliki salah satu izin yang diperlukan untuk halaman ini.",
			})
		}

		return c.Next()
	}
}

// PlatformStaffRoles adalah alias dari models.PlatformStaffRoles — SATU sumber
// kebenaran. Sebelumnya daftar ini hidup di dua tempat (middleware dan handler
// punya salinan logika sendiri), sehingga role baru bisa lolos di satu jalur
// tapi ditolak di jalur lain.
var PlatformStaffRoles = models.PlatformStaffRoles

// IsPlatformStaffRole melaporkan apakah role (case-insensitive) termasuk staf platform.
func IsPlatformStaffRole(role string) bool {
	_, ok := PlatformStaffRoles[models.NormalizePlatformRole(role)]
	return ok
}

// RequireAdmin ensures the user is a platform admin (not a regular merchant).
func RequireAdmin(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userVal := c.Locals("user")
		if userVal == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "UNAUTHENTICATED",
				"message": "Autentikasi diperlukan.",
			})
		}

		user, ok := userVal.(*models.User)
		if !ok || user == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "UNAUTHENTICATED",
				"message": "Sesi pengguna tidak valid.",
			})
		}

		// SECURITY (N-05): whitelist eksplisit, bukan blacklist.
		if !IsPlatformStaffRole(user.PlatformRole) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "FORBIDDEN_ADMIN_ONLY",
				"message": "Akses Ditolak: Halaman ini hanya untuk staf pengelola platform.",
			})
		}

		return c.Next()
	}
}
