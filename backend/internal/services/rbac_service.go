package services

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"

	"gorm.io/gorm"
)

type RBACService struct {
	db        *gorm.DB
	cacheLock sync.RWMutex
	permCache map[string]map[string]bool // roleSlug -> map[permKey]bool
}

var (
	rbacServiceInstance *RBACService
	rbacOnce            sync.Once
)

func GetRBACService() *RBACService {
	rbacOnce.Do(func() {
		rbacServiceInstance = &RBACService{
			db:        database.DB,
			permCache: make(map[string]map[string]bool),
		}
		rbacServiceInstance.RefreshCache()
	})
	return rbacServiceInstance
}

// RefreshCache rebuilds the in-memory role-permission matrix cache for instant lookups.
func (s *RBACService) RefreshCache() {
	s.cacheLock.Lock()
	defer s.cacheLock.Unlock()

	var roles []models.PlatformRole
	if err := s.db.Preload("Permissions").Find(&roles).Error; err != nil {
		return
	}

	newCache := make(map[string]map[string]bool)
	for _, role := range roles {
		perms := make(map[string]bool)
		for _, p := range role.Permissions {
			perms[p.Key] = true
		}
		newCache[role.Slug] = perms
	}
	s.permCache = newCache
}

// HasPermission checks if the user possesses the required permission.
func (s *RBACService) HasPermission(user *models.User, requiredPermission string) bool {
	if user == nil {
		return false
	}

	roleSlug := strings.ToLower(strings.TrimSpace(user.PlatformRole))
	if roleSlug == "" || roleSlug == "merchant" {
		return false
	}

	// Superadmin has absolute wildcard access to all platform features
	if roleSlug == "superadmin" {
		return true
	}

	s.cacheLock.RLock()
	rolePerms, exists := s.permCache[roleSlug]
	s.cacheLock.RUnlock()

	if !exists {
		// Cache miss fallback: reload
		s.RefreshCache()
		s.cacheLock.RLock()
		rolePerms, exists = s.permCache[roleSlug]
		s.cacheLock.RUnlock()
	}

	if !exists {
		return false
	}

	return rolePerms[requiredPermission] || rolePerms["*"]
}

// GetUserPermissions returns all active permission keys for a user.
func (s *RBACService) GetUserPermissions(user *models.User) []string {
	if user == nil {
		return []string{}
	}

	roleSlug := strings.ToLower(strings.TrimSpace(user.PlatformRole))
	if roleSlug == "" || roleSlug == "merchant" {
		return []string{}
	}

	if roleSlug == "superadmin" {
		var allPerms []models.PlatformPermission
		s.db.Find(&allPerms)
		keys := make([]string, 0, len(allPerms))
		for _, p := range allPerms {
			keys = append(keys, p.Key)
		}
		return keys
	}

	s.cacheLock.RLock()
	rolePerms, exists := s.permCache[roleSlug]
	s.cacheLock.RUnlock()

	if !exists {
		s.RefreshCache()
		s.cacheLock.RLock()
		rolePerms = s.permCache[roleSlug]
		s.cacheLock.RUnlock()
	}

	keys := make([]string, 0, len(rolePerms))
	for k, v := range rolePerms {
		if v {
			keys = append(keys, k)
		}
	}
	return keys
}

// RoleMatrixResponse represents the full RBAC matrix returned to frontend.
type RoleMatrixResponse struct {
	Roles       []models.PlatformRole       `json:"roles"`
	Permissions []models.PlatformPermission `json:"permissions"`
}

// GetMatrix returns all platform roles with populated permissions and the full permission catalog.
func (s *RBACService) GetMatrix() (*RoleMatrixResponse, error) {
	var roles []models.PlatformRole
	if err := s.db.Preload("Permissions").Order("is_system DESC, name ASC").Find(&roles).Error; err != nil {
		return nil, err
	}

	var permissions []models.PlatformPermission
	if err := s.db.Order("\"group\" ASC, id ASC").Find(&permissions).Error; err != nil {
		return nil, err
	}

	return &RoleMatrixResponse{
		Roles:       roles,
		Permissions: permissions,
	}, nil
}

// UpdateRolePermissions modifies the active permission set for a given platform role.
func (s *RBACService) UpdateRolePermissions(roleSlug string, permissionKeys []string, actor *models.User) error {
	roleSlug = strings.ToLower(strings.TrimSpace(roleSlug))
	if roleSlug == "" {
		return errors.New("role slug tidak valid")
	}

	var role models.PlatformRole
	if err := s.db.Where("slug = ?", roleSlug).First(&role).Error; err != nil {
		return fmt.Errorf("role '%s' tidak ditemukan", roleSlug)
	}

	// Resolve permission IDs from keys
	var targetPerms []models.PlatformPermission
	if len(permissionKeys) > 0 {
		if err := s.db.Where("key IN ?", permissionKeys).Find(&targetPerms).Error; err != nil {
			return err
		}
	}

	// Begin atomic transaction
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Delete old mappings
	if err := tx.Where("role_id = ?", role.ID).Delete(&models.PlatformRolePermission{}).Error; err != nil {
		tx.Rollback()
		return err
	}

	// Insert new mappings
	for _, p := range targetPerms {
		rp := models.PlatformRolePermission{
			RoleID:       role.ID,
			PermissionID: p.ID,
			CreatedAt:    time.Now(),
		}
		if err := tx.Create(&rp).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	if err := tx.Commit().Error; err != nil {
		return err
	}

	// Invalidate and refresh in-memory cache
	s.RefreshCache()

	// Record Enterprise Audit Log
	if actor != nil {
		roleID := role.ID
		RecordActivity(RecordActivityParams{
			DB:          s.db,
			UserID:      &actor.ID,
			ActorEmail:  actor.Email,
			ActorName:   actor.Name,
			ActorRole:   "superadmin",
			Action:      "RBAC_ROLE_PERMISSIONS_UPDATED",
			Category:    "superadmin",
			EntityType:  "platform_role",
			EntityID:    &roleID,
			EntityTitle: role.Name,
			Description: fmt.Sprintf("Superadmin '%s' memperbarui matriks hak akses untuk role '%s' (%d izin aktif).", actor.Name, role.Name, len(targetPerms)),
		})
	}

	return nil
}

// AdminStaffUser represents a platform staff user with their active role metadata.
type AdminStaffUser struct {
	ID           uint      `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PlatformRole string    `json:"platform_role"`
	RoleName     string    `json:"role_name"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// GetStaffList retrieves all registered platform administrators and operational staff.
func (s *RBACService) GetStaffList() ([]AdminStaffUser, error) {
	var users []models.User
	if err := s.db.Where("platform_role != ? AND platform_role != ? AND platform_role IS NOT NULL", "merchant", "").
		Order("platform_role ASC, name ASC").
		Find(&users).Error; err != nil {
		return nil, err
	}

	var roles []models.PlatformRole
	s.db.Find(&roles)
	roleNameMap := make(map[string]string)
	for _, r := range roles {
		roleNameMap[r.Slug] = r.Name
	}

	staffList := make([]AdminStaffUser, 0, len(users))
	for _, u := range users {
		rName := roleNameMap[u.PlatformRole]
		if rName == "" {
			rName = strings.Title(u.PlatformRole)
		}
		staffList = append(staffList, AdminStaffUser{
			ID:           u.ID,
			Name:         u.Name,
			Email:        u.Email,
			PlatformRole: u.PlatformRole,
			RoleName:     rName,
			CreatedAt:    u.CreatedAt,
			UpdatedAt:    u.UpdatedAt,
		})
	}

	return staffList, nil
}

// AssignStaffRole changes or assigns a platform role to a user.
func (s *RBACService) AssignStaffRole(targetEmailOrID string, roleSlug string, actor *models.User) error {
	roleSlug = strings.ToLower(strings.TrimSpace(roleSlug))
	targetEmailOrID = strings.TrimSpace(targetEmailOrID)

	var targetUser models.User
	if err := s.db.Where("email = ? OR CAST(id AS TEXT) = ?", targetEmailOrID, targetEmailOrID).First(&targetUser).Error; err != nil {
		return errors.New("pengguna target tidak ditemukan")
	}

	// Validate role exists
	var role models.PlatformRole
	if err := s.db.Where("slug = ?", roleSlug).First(&role).Error; err != nil {
		return fmt.Errorf("role '%s' tidak terdaftar dalam sistem", roleSlug)
	}

	oldRole := targetUser.PlatformRole
	targetUser.PlatformRole = roleSlug
	if err := s.db.Save(&targetUser).Error; err != nil {
		return err
	}

	// Record Enterprise Audit Log
	if actor != nil {
		targetUserID := targetUser.ID
		RecordActivity(RecordActivityParams{
			DB:          s.db,
			UserID:      &actor.ID,
			ActorEmail:  actor.Email,
			ActorName:   actor.Name,
			ActorRole:   "superadmin",
			Action:      "RBAC_STAFF_ROLE_ASSIGNED",
			Category:    "superadmin",
			EntityType:  "user",
			EntityID:    &targetUserID,
			EntityTitle: targetUser.Email,
			Description: fmt.Sprintf("Superadmin '%s' menetapkan role '%s' kepada staf '%s' (%s) (Role sebelumnya: '%s').", actor.Name, role.Name, targetUser.Name, targetUser.Email, oldRole),
		})
	}

	return nil
}

// RevokeStaffRole demotes a platform admin to standard merchant status.
func (s *RBACService) RevokeStaffRole(targetUserID uint, actor *models.User) error {
	var targetUser models.User
	if err := s.db.First(&targetUser, targetUserID).Error; err != nil {
		return errors.New("pengguna tidak ditemukan")
	}

	if targetUser.Email == "admin@catavor.com" {
		return errors.New("role Superadmin utama (admin@catavor.com) tidak dapat dicabut")
	}

	if actor != nil && targetUser.ID == actor.ID {
		return errors.New("Anda tidak dapat mencabut hak akses admin Anda sendiri")
	}

	oldRole := targetUser.PlatformRole
	_ = oldRole
	targetUser.PlatformRole = "merchant"
	if err := s.db.Save(&targetUser).Error; err != nil {
		return err
	}

	// Record Enterprise Audit Log
	if actor != nil {
		targetUID := targetUser.ID
		RecordActivity(RecordActivityParams{
			DB:          s.db,
			UserID:      &actor.ID,
			ActorEmail:  actor.Email,
			ActorName:   actor.Name,
			ActorRole:   "superadmin",
			Action:      "RBAC_STAFF_ROLE_REVOKED",
			Category:    "superadmin",
			EntityType:  "user",
			EntityID:    &targetUID,
			EntityTitle: targetUser.Email,
			Description: fmt.Sprintf("Superadmin '%s' mencabut hak akses admin dari '%s' (%s). Role dikembalikan menjadi merchant.", actor.Name, targetUser.Name, targetUser.Email),
		})
	}

	return nil
}

// CreateCustomRole registers a new customizable platform role with initial permissions.
func (s *RBACService) CreateCustomRole(slug, name, description string, permissionKeys []string, actor *models.User) (*models.PlatformRole, error) {
	slug = strings.ToLower(strings.TrimSpace(slug))
	slug = strings.ReplaceAll(slug, " ", "_")
	name = strings.TrimSpace(name)

	if slug == "" || name == "" {
		return nil, errors.New("slug dan nama role wajib diisi")
	}

	var existing models.PlatformRole
	if err := s.db.Where("slug = ?", slug).First(&existing).Error; err == nil {
		return nil, fmt.Errorf("role dengan slug '%s' sudah terdaftar", slug)
	}

	role := models.PlatformRole{
		Slug:        slug,
		Name:        name,
		Description: strings.TrimSpace(description),
		IsSystem:    false,
	}

	if err := s.db.Create(&role).Error; err != nil {
		return nil, err
	}

	// Map initial permissions if provided
	if len(permissionKeys) > 0 {
		var perms []models.PlatformPermission
		s.db.Where("key IN ?", permissionKeys).Find(&perms)
		for _, p := range perms {
			rp := models.PlatformRolePermission{
				RoleID:       role.ID,
				PermissionID: p.ID,
				CreatedAt:    time.Now(),
			}
			s.db.Create(&rp)
		}
	}

	s.RefreshCache()

	if actor != nil {
		newRoleID := role.ID
		RecordActivity(RecordActivityParams{
			DB:          s.db,
			UserID:      &actor.ID,
			ActorEmail:  actor.Email,
			ActorName:   actor.Name,
			ActorRole:   "superadmin",
			Action:      "RBAC_CUSTOM_ROLE_CREATED",
			Category:    "superadmin",
			EntityType:  "platform_role",
			EntityID:    &newRoleID,
			EntityTitle: role.Name,
			Description: fmt.Sprintf("Superadmin '%s' membuat custom role baru: '%s' (%s).", actor.Name, role.Name, role.Slug),
		})
	}

	return &role, nil
}
