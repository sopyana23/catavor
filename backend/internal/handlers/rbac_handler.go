package handlers

import (
	"strconv"
	"strings"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
)

type RBACHandler struct {
	rbacService *services.RBACService
}

func NewRBACHandler() *RBACHandler {
	return &RBACHandler{
		rbacService: services.GetRBACService(),
	}
}

// GetMyPermissions returns current user's role and permission keys.
func (h *RBACHandler) GetMyPermissions(c *fiber.Ctx) error {
	userVal := c.Locals("user")
	if userVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}
	user := userVal.(*models.User)

	perms := h.rbacService.GetUserPermissions(user)
	isSuper := strings.EqualFold(user.PlatformRole, "superadmin")
	isAdmin := user.PlatformRole != "" && user.PlatformRole != "merchant"

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"user_id":       user.ID,
			"name":          user.Name,
			"email":         user.Email,
			"platform_role": user.PlatformRole,
			"is_superadmin": isSuper,
			"is_admin":      isAdmin,
			"permissions":   perms,
		},
	})
}

// GetMatrix returns the full role-permission matrix.
func (h *RBACHandler) GetMatrix(c *fiber.Ctx) error {
	matrix, err := h.rbacService.GetMatrix()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat matriks hak akses.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    matrix,
	})
}

type UpdateMatrixRequest struct {
	RoleSlug       string   `json:"role_slug"`
	PermissionKeys []string `json:"permission_keys"`
}

// UpdateMatrix modifies permissions assigned to a role.
func (h *RBACHandler) UpdateMatrix(c *fiber.Ctx) error {
	userVal := c.Locals("user")
	var actor *models.User
	if userVal != nil {
		actor = userVal.(*models.User)
	}

	var req UpdateMatrixRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format payload tidak valid.",
		})
	}

	if strings.TrimSpace(req.RoleSlug) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Role slug wajib ditentukan.",
		})
	}

	if err := h.rbacService.UpdateRolePermissions(req.RoleSlug, req.PermissionKeys, actor); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Matriks hak akses role berhasil diperbarui secara realtime.",
	})
}

// GetStaff returns all platform admin staff.
func (h *RBACHandler) GetStaff(c *fiber.Ctx) error {
	staff, err := h.rbacService.GetStaffList()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil daftar staf admin.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    staff,
	})
}

type AssignStaffRequest struct {
	EmailOrID string `json:"email_or_id"`
	Email     string `json:"email"`
	RoleSlug  string `json:"role_slug"`
	Role      string `json:"role"`
}

// AssignStaff assigns or updates a staff member's role.
func (h *RBACHandler) AssignStaff(c *fiber.Ctx) error {
	userVal := c.Locals("user")
	var actor *models.User
	if userVal != nil {
		actor = userVal.(*models.User)
	}

	var req AssignStaffRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	target := strings.TrimSpace(req.EmailOrID)
	if target == "" {
		target = strings.TrimSpace(req.Email)
	}

	role := strings.TrimSpace(req.RoleSlug)
	if role == "" {
		role = strings.TrimSpace(req.Role)
	}

	if target == "" || role == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Email/ID staf dan Role slug wajib diisi.",
		})
	}

	if err := h.rbacService.AssignStaffRole(target, role, actor); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Role staf admin berhasil diperbarui.",
	})
}

type RevokeStaffRequest struct {
	UserID uint   `json:"user_id"`
	Email  string `json:"email"`
}

// RevokeStaff revokes admin access from a staff member.
func (h *RBACHandler) RevokeStaff(c *fiber.Ctx) error {
	userVal := c.Locals("user")
	var actor *models.User
	if userVal != nil {
		actor = userVal.(*models.User)
	}

	var req RevokeStaffRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	if req.UserID == 0 {
		// Try from url param
		idParam := c.Params("id")
		if uID, err := strconv.ParseUint(idParam, 10, 64); err == nil {
			req.UserID = uint(uID)
		}
	}

	if req.UserID == 0 && strings.TrimSpace(req.Email) != "" {
		var targetUser models.User
		if err := database.DB.Where("LOWER(email) = ?", strings.ToLower(strings.TrimSpace(req.Email))).First(&targetUser).Error; err == nil {
			req.UserID = targetUser.ID
		}
	}

	if req.UserID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "User ID staf wajib ditentukan.",
		})
	}

	if err := h.rbacService.RevokeStaffRole(req.UserID, actor); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Hak akses staf admin berhasil dicabut. Akun kembali menjadi merchant biasa.",
	})
}

type CreateRoleRequest struct {
	Slug           string   `json:"slug"`
	Name           string   `json:"name"`
	Description    string   `json:"description"`
	PermissionKeys []string `json:"permission_keys"`
}

// CreateRole creates a new custom platform role.
func (h *RBACHandler) CreateRole(c *fiber.Ctx) error {
	userVal := c.Locals("user")
	var actor *models.User
	if userVal != nil {
		actor = userVal.(*models.User)
	}

	var req CreateRoleRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	role, err := h.rbacService.CreateCustomRole(req.Slug, req.Name, req.Description, req.PermissionKeys, actor)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Custom role baru berhasil dibuat.",
		"data":    role,
	})
}
