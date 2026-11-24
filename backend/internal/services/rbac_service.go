package services

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

const (
	rbacSuperadminManagePermKey  = "system:admins:manage"
	rbacCacheInvalidationChannel = "catavor:rbac:invalidate"
)

var (
	// Sentinel errors untuk mapping HTTP status yang akurat di RBACHandler.
	ErrRBACForbidden  = errors.New("akses ditolak")
	ErrRBACNotFound   = errors.New("data rbac tidak ditemukan")
	ErrRBACConflict   = errors.New("konflik operasi rbac")
	ErrRBACValidation = errors.New("validasi rbac gagal")

	customRoleSlugRegex = regexp.MustCompile(`^[a-z][a-z0-9_]{1,48}[a-z0-9]$`)
)

type RBACService struct {
	db        *gorm.DB
	cacheLock sync.RWMutex
	permCache map[string]map[string]bool // roleSlug -> map[permKey]bool
	roleSlugs map[string]bool            // registered DB role slugs (normalized)
}

var (
	rbacServiceInstance  *RBACService
	rbacOnce             sync.Once
	rbacSubStartedMu     sync.Mutex
	rbacSubStarted       bool
)

func init() {
	models.RegisterCustomStaffRoleChecker(func(slug string) bool {
		if database.DB == nil {
			return false
		}
		return GetRBACService().IsRegisteredStaffRole(slug)
	})
}

// SECURITY (N-05): gerbang otorisasi di level service.
// Sebelumnya AssignStaffRole / RevokeStaffRole / UpdateRolePermissions tidak
// memeriksa siapa aktornya sama sekali — keselamatan sepenuhnya bergantung pada
// middleware RequirePermission di route. Satu route baru yang lupa di-guard
// akan langsung membuka eskalasi hak akses. Fungsi ini menutup celah tersebut
// sebagai pertahanan berlapis (defense-in-depth).
func requireRBACSuperadmin(actor *models.User) error {
	if actor == nil {
		return fmt.Errorf("%w: aktor tidak teridentifikasi", ErrRBACForbidden)
	}
	if !actor.IsSuperadmin() {
		return fmt.Errorf("%w: hanya superadmin yang boleh mengubah RBAC", ErrRBACForbidden)
	}
	return nil
}

func InitRBACService(db *gorm.DB) *RBACService {
	svc := GetRBACService()
	svc.cacheLock.Lock()
	svc.db = db
	svc.permCache = make(map[string]map[string]bool)
	svc.roleSlugs = make(map[string]bool)
	svc.cacheLock.Unlock()
	if db != nil {
		svc.RefreshCache()
	}
	return svc
}

func GetRBACService() *RBACService {
	rbacOnce.Do(func() {
		rbacServiceInstance = &RBACService{
			db:        database.DB,
			permCache: make(map[string]map[string]bool),
			roleSlugs: make(map[string]bool),
		}
		if database.DB != nil {
			rbacServiceInstance.RefreshCache()
		}
	})

	// Singleton menangkap database.DB sekali saat rbacOnce. Bila koneksi global
	// kemudian berganti (reconnect pool, failover, restart driver, atau database.DB
	// diganti test), cache lama tetap menunjuk handle yang sudah mati sehingga
	// HasPermission() menjawab false untuk seluruh staf — dan bila handle lama
	// masih hidup, ia membaca permission dari database yang salah.
	// Samakan db lalu muat ulang cache setiap kali berbeda.
	if current := database.DB; current != nil && rbacServiceInstance.db != current {
		rbacServiceInstance.cacheLock.Lock()
		rbacServiceInstance.db = current
		rbacServiceInstance.cacheLock.Unlock()
		rbacServiceInstance.RefreshCache()
	}

	return rbacServiceInstance
}

// GetRBACServiceForDB returns the cached global singleton in production (db == database.DB)
// and an isolated instance when a test-specific *gorm.DB is injected.
func GetRBACServiceForDB(db *gorm.DB) *RBACService {
	if db == nil || db == database.DB {
		return GetRBACService()
	}
	svc := &RBACService{
		db:        db,
		permCache: make(map[string]map[string]bool),
		roleSlugs: make(map[string]bool),
	}
	svc.RefreshCache()
	return svc
}

// RefreshCache rebuilds the in-memory role-permission matrix cache for instant lookups.
func (s *RBACService) RefreshCache() {
	s.cacheLock.Lock()
	defer s.cacheLock.Unlock()

	if s.db == nil {
		return
	}

	var roles []models.PlatformRole
	if err := s.db.Preload("Permissions").Find(&roles).Error; err != nil {
		return
	}

	newCache := make(map[string]map[string]bool, len(roles))
	newSlugs := make(map[string]bool, len(roles))
	for _, role := range roles {
		normSlug := models.NormalizePlatformRole(role.Slug)
		if _, reserved := models.ReservedNonStaffRoles[normSlug]; reserved {
			continue
		}
		perms := make(map[string]bool, len(role.Permissions))
		for _, p := range role.Permissions {
			perms[p.Key] = true
		}
		newCache[normSlug] = perms
		newSlugs[normSlug] = true
	}
	s.permCache = newCache
	s.roleSlugs = newSlugs
}

// IsRegisteredStaffRole melaporkan apakah slug merupakan role staf bawaan atau custom role aktif di DB.
func (s *RBACService) IsRegisteredStaffRole(slug string) bool {
	if strings.ContainsRune(slug, '\x00') {
		return false
	}
	norm := models.NormalizePlatformRole(slug)
	if _, reserved := models.ReservedNonStaffRoles[norm]; reserved {
		return false
	}
	if _, builtin := models.PlatformStaffRoles[norm]; builtin {
		return true
	}

	s.cacheLock.RLock()
	hasSlugsCache := s.roleSlugs != nil && len(s.roleSlugs) > 0
	isRegistered := s.roleSlugs != nil && s.roleSlugs[norm]
	db := s.db
	s.cacheLock.RUnlock()

	if isRegistered {
		return true
	}
	if !hasSlugsCache && db != nil {
		s.RefreshCache()
		s.cacheLock.RLock()
		isRegistered = s.roleSlugs != nil && s.roleSlugs[norm]
		s.cacheLock.RUnlock()
		return isRegistered
	}
	return false
}

func (s *RBACService) isStaffForService(roleSlug string) bool {
	if roleSlug == "" {
		return false
	}
	if s.db == nil {
		_, builtin := models.PlatformStaffRoles[roleSlug]
		return builtin
	}
	return models.IsPlatformStaffRole(roleSlug) || s.IsRegisteredStaffRole(roleSlug)
}

func publishRBACInvalidation() {
	if !database.IsRedisAvailable() || database.RedisClient == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	if err := database.RedisClient.Publish(ctx, rbacCacheInvalidationChannel, time.Now().UTC().Format(time.RFC3339Nano)).Err(); err != nil {
		log.Warn().Err(err).Msg("rbac: gagal mempublikasikan invalidasi cache ke Redis")
	}
}

// StartRBACCacheSubscriber mendengarkan invalidasi matriks RBAC antar instance via Redis Pub/Sub.
func StartRBACCacheSubscriber(ctx context.Context) {
	if !database.IsRedisAvailable() || database.RedisClient == nil {
		return
	}
	rbacSubStartedMu.Lock()
	if rbacSubStarted {
		rbacSubStartedMu.Unlock()
		return
	}
	rbacSubStarted = true
	rbacSubStartedMu.Unlock()

	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Error().Interface("panic", r).Msg("rbac: subscriber cache invalidation mengalami panic")
			}
		}()

		pubsub := database.RedisClient.Subscribe(ctx, rbacCacheInvalidationChannel)
		defer pubsub.Close()

		ch := pubsub.Channel()
		for {
			select {
			case <-ctx.Done():
				return
			case msg, ok := <-ch:
				if !ok {
					return
				}
				_ = msg
				GetRBACService().RefreshCache()
			}
		}
	}()
}

// HasPermission checks if the user possesses the required permission.
func (s *RBACService) HasPermission(user *models.User, requiredPermission string) bool {
	if user == nil || strings.ContainsRune(user.PlatformRole, '\x00') {
		return false
	}

	roleSlug := models.NormalizePlatformRole(user.PlatformRole)
	if !s.isStaffForService(roleSlug) {
		return false
	}

	// Superadmin has absolute wildcard access to all platform features
	if user.IsSuperadmin() {
		return true
	}

	s.cacheLock.RLock()
	rolePerms, exists := s.permCache[roleSlug]
	s.cacheLock.RUnlock()

	if !exists && s.db != nil {
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
	if user == nil || strings.ContainsRune(user.PlatformRole, '\x00') {
		return []string{}
	}

	roleSlug := models.NormalizePlatformRole(user.PlatformRole)
	if !s.isStaffForService(roleSlug) {
		return []string{}
	}

	if roleSlug == "superadmin" {
		if s.db == nil {
			return []string{"*"}
		}
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

	if !exists && s.db != nil {
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
	roleSlug = models.NormalizePlatformRole(roleSlug)
	if roleSlug == "" {
		return fmt.Errorf("%w: role slug tidak valid", ErrRBACValidation)
	}

	// SECURITY (N-05): tolak bila aktor bukan superadmin (pertahanan berlapis).
	if err := requireRBACSuperadmin(actor); err != nil {
		return err
	}

	// SECURITY (N-05): role superadmin memiliki hak akses absolut wildcard dan matriks izinnya tidak dapat diubah
	if roleSlug == "superadmin" {
		return fmt.Errorf("%w: role 'superadmin' memiliki akses absolut wildcard dan matriks izinnya tidak dapat diubah", ErrRBACConflict)
	}

	var role models.PlatformRole
	if err := s.db.Where("slug = ?", roleSlug).First(&role).Error; err != nil {
		return fmt.Errorf("%w: role '%s' tidak ditemukan", ErrRBACNotFound, roleSlug)
	}

	targetPerms, uniqueKeys, err := s.validateAssignablePermissions(permissionKeys)
	if err != nil {
		return err
	}

	var addedKeys, removedKeys []string

	// Begin atomic transaction (snapshot diff + replace mappings)
	if txErr := s.db.Transaction(func(tx *gorm.DB) error {
		var oldKeys []string
		if err := tx.Model(&models.PlatformPermission{}).
			Joins("JOIN platform_role_permissions prp ON prp.permission_id = platform_permissions.id").
			Where("prp.role_id = ?", role.ID).
			Pluck("platform_permissions.key", &oldKeys).Error; err != nil {
			return err
		}

		oldSet := make(map[string]bool, len(oldKeys))
		for _, k := range oldKeys {
			oldSet[k] = true
		}
		newSet := make(map[string]bool, len(uniqueKeys))
		for _, k := range uniqueKeys {
			newSet[k] = true
			if !oldSet[k] {
				addedKeys = append(addedKeys, k)
			}
		}
		for _, k := range oldKeys {
			if !newSet[k] {
				removedKeys = append(removedKeys, k)
			}
		}

		if err := tx.Where("role_id = ?", role.ID).Delete(&models.PlatformRolePermission{}).Error; err != nil {
			return err
		}

		for _, p := range targetPerms {
			rp := models.PlatformRolePermission{
				RoleID:       role.ID,
				PermissionID: p.ID,
				CreatedAt:    time.Now().UTC(),
			}
			if err := tx.Create(&rp).Error; err != nil {
				return err
			}
		}
		return nil
	}); txErr != nil {
		return txErr
	}

	sort.Strings(addedKeys)
	sort.Strings(removedKeys)

	// Invalidate local cache & broadcast to sibling instances
	s.RefreshCache()
	publishRBACInvalidation()

	// Record Enterprise Audit Log with permission diff
	if actor != nil {
		roleID := role.ID
		diffSummary := ""
		if len(addedKeys) > 0 || len(removedKeys) > 0 {
			diffSummary = fmt.Sprintf(" (+[%s] -[%s])", strings.Join(addedKeys, ", "), strings.Join(removedKeys, ", "))
		}
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
			Description: fmt.Sprintf("Superadmin '%s' memperbarui matriks hak akses untuk role '%s' (%d izin aktif)%s.", actor.Name, role.Name, len(targetPerms), diffSummary),
		})
	}

	return nil
}

func (s *RBACService) validateAssignablePermissions(permissionKeys []string) ([]models.PlatformPermission, []string, error) {
	seen := make(map[string]bool, len(permissionKeys))
	uniqueKeys := make([]string, 0, len(permissionKeys))
	for _, raw := range permissionKeys {
		k := strings.TrimSpace(raw)
		if k == "" || seen[k] {
			continue
		}
		if k == rbacSuperadminManagePermKey {
			return nil, nil, fmt.Errorf("%w: izin '%s' eksklusif untuk superadmin dan tidak dapat diberikan ke role lain", ErrRBACValidation, rbacSuperadminManagePermKey)
		}
		seen[k] = true
		uniqueKeys = append(uniqueKeys, k)
	}
	if len(uniqueKeys) == 0 {
		return nil, uniqueKeys, nil
	}

	var perms []models.PlatformPermission
	if err := s.db.Where("key IN ?", uniqueKeys).Find(&perms).Error; err != nil {
		return nil, nil, err
	}
	if len(perms) != len(uniqueKeys) {
		foundSet := make(map[string]bool, len(perms))
		for _, p := range perms {
			foundSet[p.Key] = true
		}
		var missing []string
		for _, k := range uniqueKeys {
			if !foundSet[k] {
				missing = append(missing, k)
			}
		}
		sort.Strings(missing)
		return nil, nil, fmt.Errorf("%w: permission key tidak valid: %s", ErrRBACValidation, strings.Join(missing, ", "))
	}
	return perms, uniqueKeys, nil
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
	roleSlug = models.NormalizePlatformRole(roleSlug)
	targetEmailOrID = strings.TrimSpace(targetEmailOrID)

	// SECURITY (N-05): tolak bila aktor bukan superadmin (pertahanan berlapis).
	if err := requireRBACSuperadmin(actor); err != nil {
		return err
	}

	if roleSlug == "" || targetEmailOrID == "" {
		return fmt.Errorf("%w: target staf dan role slug wajib diisi", ErrRBACValidation)
	}
	if _, reserved := models.ReservedNonStaffRoles[roleSlug]; reserved {
		return fmt.Errorf("%w: role '%s' tidak valid untuk penugasan staf — gunakan endpoint pencabutan untuk menurunkan akses", ErrRBACValidation, roleSlug)
	}

	var targetUser models.User
	if err := s.db.Where("LOWER(email) = LOWER(?) OR CAST(id AS TEXT) = ?", targetEmailOrID, targetEmailOrID).First(&targetUser).Error; err != nil {
		return fmt.Errorf("%w: pengguna target tidak ditemukan", ErrRBACNotFound)
	}

	// Validate role exists
	var role models.PlatformRole
	if err := s.db.Where("slug = ?", roleSlug).First(&role).Error; err != nil {
		return fmt.Errorf("%w: role '%s' tidak terdaftar dalam sistem", ErrRBACNotFound, roleSlug)
	}

	// Validasi isolasi akun mutlak: Akun yang terdaftar sebagai merchant toko
	// tidak boleh dialihkan menjadi admin pengelola platform untuk mencegah
	// kebingungan hak akses sistem dan risiko keamanan operasional.
	var storeCount int64
	s.db.Model(&models.Store{}).Where("user_id = ?", targetUser.ID).Count(&storeCount)
	if storeCount > 0 || (!targetUser.IsPlatformStaff() && !s.isStaffForService(models.NormalizePlatformRole(targetUser.PlatformRole)) && targetUser.PlatformRole == "merchant") {
		return fmt.Errorf("%w: akun ini terdaftar sebagai akun merchant toko. Email merchant tidak dapat dialihkan menjadi admin pengelola platform demi keamanan dan integritas data.", ErrRBACConflict)
	}

	// Anti-lockout & self-demotion protection saat menurunkan superadmin via AssignStaffRole.
	if targetUser.IsSuperadmin() && roleSlug != "superadmin" {
		if actor != nil && targetUser.ID == actor.ID {
			return fmt.Errorf("%w: Anda tidak dapat menurunkan role superadmin milik Anda sendiri", ErrRBACConflict)
		}
		var superadminCount int64
		if err := s.db.Model(&models.User{}).
			Where("LOWER(TRIM(platform_role)) = ?", "superadmin").
			Count(&superadminCount).Error; err != nil {
			return fmt.Errorf("gagal memverifikasi jumlah superadmin: %w", err)
		}
		if superadminCount <= 1 {
			return fmt.Errorf("%w: role superadmin terakhir tidak dapat diturunkan — tugaskan superadmin lain terlebih dahulu", ErrRBACConflict)
		}
	}

	oldRole := targetUser.PlatformRole
	targetUser.PlatformRole = roleSlug
	targetUser.TwoFactorEnforced = true
	targetUser.TokenVersion++
	if err := s.db.Save(&targetUser).Error; err != nil {
		return err
	}

	// Mutasi role staf wajib mencabut sesi lama agar pengguna terikat kembali pada gerbang MFA & token version baru.
	if err := RevokeAllSessionsForUser(s.db, targetUser.ID); err != nil {
		log.Warn().Err(err).Uint("user_id", targetUser.ID).
			Msg("gagal mencabut sesi setelah penugasan role staf")
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

// CreateStaffParams contains parameters to create a new platform staff user.
type CreateStaffParams struct {
	Name     string
	Email    string
	Password string
	RoleSlug string
	Actor    *models.User
}

// CreateStaffUser creates a brand new user account directly as a platform staff member.
func (s *RBACService) CreateStaffUser(params CreateStaffParams) (*models.User, error) {
	// SECURITY (N-05): tolak bila aktor bukan superadmin (pertahanan berlapis).
	if err := requireRBACSuperadmin(params.Actor); err != nil {
		return nil, err
	}

	name := strings.TrimSpace(params.Name)
	email := strings.ToLower(strings.TrimSpace(params.Email))
	// NIST SP 800-63B §5.1.1.2: jangan pernah men-trim whitespace pada password pengguna
	password := params.Password
	roleSlug := models.NormalizePlatformRole(params.RoleSlug)

	if name == "" {
		return nil, fmt.Errorf("%w: nama lengkap petugas wajib diisi", ErrRBACValidation)
	}
	if email == "" || !strings.Contains(email, "@") || !strings.Contains(email, ".") {
		return nil, fmt.Errorf("%w: format email petugas tidak valid", ErrRBACValidation)
	}
	if err := security.ValidatePassword(params.Password); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrRBACValidation, err)
	}

	// Default role jika kosong
	if roleSlug == "" {
		roleSlug = "support"
	}
	if _, reserved := models.ReservedNonStaffRoles[roleSlug]; reserved {
		return nil, fmt.Errorf("%w: role '%s' tidak valid untuk akun staf pengelola platform", ErrRBACValidation, roleSlug)
	}

	// Cek apakah email sudah terdaftar (baik sebagai merchant maupun pengelola)
	var existingUser models.User
	if err := s.db.Where("LOWER(email) = ?", email).First(&existingUser).Error; err == nil {
		if existingUser.IsPlatformStaff() || s.isStaffForService(models.NormalizePlatformRole(existingUser.PlatformRole)) {
			return nil, fmt.Errorf("%w: email ini sudah terdaftar sebagai akun staf/pengelola platform", ErrRBACConflict)
		}
		return nil, fmt.Errorf("%w: email ini sudah terdaftar sebagai akun merchant dan tidak dapat didaftarkan kembali sebagai akun pengelola platform. Email pengelola dan merchant harus terpisah secara mutlak.", ErrRBACConflict)
	}

	var role models.PlatformRole
	if err := s.db.Where("slug = ?", roleSlug).First(&role).Error; err != nil {
		return nil, fmt.Errorf("%w: role '%s' tidak terdaftar dalam sistem", ErrRBACNotFound, roleSlug)
	}

	now := time.Now().UTC()
	newUser := models.User{
		Name:              name,
		Email:             email,
		PlatformRole:      roleSlug,
		TwoFactorEnforced: true,
		EmailVerifiedAt:   &now,
		IsPasswordChanged: true,
		HasCustomPassword: true,
		TokenVersion:      1,
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	if err := newUser.SetPassword(password); err != nil {
		return nil, fmt.Errorf("gagal mengenkripsi kata sandi: %w", err)
	}

	if err := s.db.Create(&newUser).Error; err != nil {
		return nil, fmt.Errorf("gagal membuat akun petugas: %w", err)
	}

	// Record Enterprise Audit Log
	if params.Actor != nil {
		targetUID := newUser.ID
		RecordActivity(RecordActivityParams{
			DB:          s.db,
			UserID:      &params.Actor.ID,
			ActorEmail:  params.Actor.Email,
			ActorName:   params.Actor.Name,
			ActorRole:   "superadmin",
			Action:      "RBAC_STAFF_USER_CREATED",
			Category:    "superadmin",
			EntityType:  "user",
			EntityID:    &targetUID,
			EntityTitle: newUser.Email,
			Description: fmt.Sprintf("Superadmin '%s' membuat akun petugas baru: '%s' (%s) dengan role '%s'.", params.Actor.Name, newUser.Name, newUser.Email, newUser.PlatformRole),
		})
	}

	return &newUser, nil
}

// RevokeStaffRole demotes a platform admin to standard merchant status.
func (s *RBACService) RevokeStaffRole(targetUserID uint, actor *models.User) error {
	// SECURITY (N-05): tolak bila aktor bukan superadmin (pertahanan berlapis).
	if err := requireRBACSuperadmin(actor); err != nil {
		return err
	}

	var targetUser models.User
	if err := s.db.First(&targetUser, targetUserID).Error; err != nil {
		return fmt.Errorf("%w: pengguna tidak ditemukan", ErrRBACNotFound)
	}

	// SECURITY (N-25): anti-lockout TIDAK boleh bergantung pada alamat email.
	// Dulu akun hardcode "admin@catavor.com" dilindungi, yang berarti (a) akun
	// itu tidak pernah ada di DB produksi sehingga perlindungannya kosong, dan
	// (b) superadmin sungguhan bisa dicabut sampai habis -> platform tanpa
	// admin. Aturan yang benar bersifat kapabilitas: jangan pernah mencabut
	// superadmin TERAKHIR.
	if targetUser.IsSuperadmin() {
		var superadminCount int64
		if err := s.db.Model(&models.User{}).
			Where("LOWER(TRIM(platform_role)) = ?", "superadmin").
			Count(&superadminCount).Error; err != nil {
			return errors.New("gagal memverifikasi jumlah superadmin")
		}
		if superadminCount <= 1 {
			return fmt.Errorf("%w: role superadmin terakhir tidak dapat dicabut — tugaskan superadmin lain terlebih dahulu", ErrRBACConflict)
		}
	}

	if actor != nil && targetUser.ID == actor.ID {
		return fmt.Errorf("%w: Anda tidak dapat mencabut hak akses admin Anda sendiri", ErrRBACConflict)
	}

	oldRole := targetUser.PlatformRole
	_ = oldRole
	targetUser.PlatformRole = "merchant"
	targetUser.TwoFactorEnforced = false
	targetUser.TokenVersion++
	if err := s.db.Save(&targetUser).Error; err != nil {
		return err
	}

	// SECURITY (N-33): pencabutan role wajib langsung mematikan sesi yang sudah
	// terbit. Tanpa ini, staf yang di-demote tetap memegang JWT valid sampai
	// kedaluwarsa (24 jam) dan masih bisa memakai endpoint terautentikasi biasa
	// milik akunnya. Otorisasi RBAC memang sudah membaca role dari DB (jadi
	// /admin/* langsung 403), tetapi sesi lama tetap harus dibunuh agar
	// konsisten dengan pencabutan akses.
	if err := RevokeAllSessionsForUser(s.db, targetUser.ID); err != nil {
		log.Warn().Err(err).Uint("user_id", targetUser.ID).
			Msg("gagal mencabut sesi setelah pencabutan role staf")
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
	// SECURITY (N-05): tolak bila aktor bukan superadmin (pertahanan berlapis).
	if err := requireRBACSuperadmin(actor); err != nil {
		return nil, err
	}

	slug = models.NormalizePlatformRole(slug)
	name = strings.TrimSpace(name)

	if slug == "" || name == "" {
		return nil, fmt.Errorf("%w: slug dan nama role wajib diisi", ErrRBACValidation)
	}
	if _, reserved := models.ReservedNonStaffRoles[slug]; reserved {
		return nil, fmt.Errorf("%w: slug role '%s' dicadangkan sistem dan tidak dapat dipakai", ErrRBACValidation, slug)
	}
	if _, builtin := models.PlatformStaffRoles[slug]; builtin {
		return nil, fmt.Errorf("%w: slug role bawaan '%s' sudah terdaftar", ErrRBACConflict, slug)
	}
	if !customRoleSlugRegex.MatchString(slug) {
		return nil, fmt.Errorf("%w: slug role harus 3-50 karakter huruf kecil, angka, atau garis bawah (diawali huruf, diakhiri huruf/angka)", ErrRBACValidation)
	}

	var existing models.PlatformRole
	if err := s.db.Where("slug = ?", slug).First(&existing).Error; err == nil {
		return nil, fmt.Errorf("%w: role dengan slug '%s' sudah terdaftar", ErrRBACConflict, slug)
	}

	perms, _, err := s.validateAssignablePermissions(permissionKeys)
	if err != nil {
		return nil, err
	}

	role := models.PlatformRole{
		Slug:        slug,
		Name:        name,
		Description: strings.TrimSpace(description),
		IsSystem:    false,
	}

	if txErr := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&role).Error; err != nil {
			return err
		}
		for _, p := range perms {
			rp := models.PlatformRolePermission{
				RoleID:       role.ID,
				PermissionID: p.ID,
				CreatedAt:    time.Now().UTC(),
			}
			if err := tx.Create(&rp).Error; err != nil {
				return err
			}
		}
		return nil
	}); txErr != nil {
		return nil, txErr
	}

	s.RefreshCache()
	publishRBACInvalidation()

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
			Description: fmt.Sprintf("Superadmin '%s' membuat custom role baru: '%s' (%s) dengan %d izin.", actor.Name, role.Name, role.Slug, len(perms)),
		})
	}

	return &role, nil
}

// UpdateCustomRole edits metadata and optionally syncs permissions of a non-system custom role.
func (s *RBACService) UpdateCustomRole(slug, name, description string, permissionKeys *[]string, actor *models.User) (*models.PlatformRole, error) {
	if err := requireRBACSuperadmin(actor); err != nil {
		return nil, err
	}

	slug = models.NormalizePlatformRole(slug)
	name = strings.TrimSpace(name)
	if slug == "" || name == "" {
		return nil, fmt.Errorf("%w: slug dan nama role wajib diisi", ErrRBACValidation)
	}

	var role models.PlatformRole
	if err := s.db.Where("slug = ?", slug).First(&role).Error; err != nil {
		return nil, fmt.Errorf("%w: role '%s' tidak ditemukan", ErrRBACNotFound, slug)
	}
	if role.IsSystem {
		return nil, fmt.Errorf("%w: metadata role bawaan sistem '%s' tidak dapat diubah — gunakan matriks untuk mengubah izinnya", ErrRBACConflict, slug)
	}

	var perms []models.PlatformPermission
	if permissionKeys != nil {
		var err error
		perms, _, err = s.validateAssignablePermissions(*permissionKeys)
		if err != nil {
			return nil, err
		}
	}

	if txErr := s.db.Transaction(func(tx *gorm.DB) error {
		role.Name = name
		role.Description = strings.TrimSpace(description)
		if err := tx.Save(&role).Error; err != nil {
			return err
		}
		if permissionKeys != nil {
			if err := tx.Where("role_id = ?", role.ID).Delete(&models.PlatformRolePermission{}).Error; err != nil {
				return err
			}
			for _, p := range perms {
				rp := models.PlatformRolePermission{
					RoleID:       role.ID,
					PermissionID: p.ID,
					CreatedAt:    time.Now().UTC(),
				}
				if err := tx.Create(&rp).Error; err != nil {
					return err
				}
			}
		}
		return nil
	}); txErr != nil {
		return nil, txErr
	}

	s.RefreshCache()
	publishRBACInvalidation()

	if actor != nil {
		roleID := role.ID
		RecordActivity(RecordActivityParams{
			DB:          s.db,
			UserID:      &actor.ID,
			ActorEmail:  actor.Email,
			ActorName:   actor.Name,
			ActorRole:   "superadmin",
			Action:      "RBAC_CUSTOM_ROLE_UPDATED",
			Category:    "superadmin",
			EntityType:  "platform_role",
			EntityID:    &roleID,
			EntityTitle: role.Name,
			Description: fmt.Sprintf("Superadmin '%s' memperbarui custom role '%s' (%s).", actor.Name, role.Name, role.Slug),
		})
	}

	return &role, nil
}

// DeleteCustomRole permanently removes a non-system role when no active staff holds it.
func (s *RBACService) DeleteCustomRole(slug string, actor *models.User) error {
	if err := requireRBACSuperadmin(actor); err != nil {
		return err
	}

	slug = models.NormalizePlatformRole(slug)
	if slug == "" {
		return fmt.Errorf("%w: slug role wajib diisi", ErrRBACValidation)
	}

	var role models.PlatformRole
	if err := s.db.Where("slug = ?", slug).First(&role).Error; err != nil {
		return fmt.Errorf("%w: role '%s' tidak ditemukan", ErrRBACNotFound, slug)
	}
	if role.IsSystem {
		return fmt.Errorf("%w: role bawaan sistem '%s' tidak dapat dihapus", ErrRBACConflict, slug)
	}
	if _, builtin := models.PlatformStaffRoles[slug]; builtin {
		return fmt.Errorf("%w: role bawaan '%s' tidak dapat dihapus", ErrRBACConflict, slug)
	}

	var activeCount int64
	if err := s.db.Model(&models.User{}).Where("LOWER(TRIM(platform_role)) = ?", slug).Count(&activeCount).Error; err != nil {
		return err
	}
	if activeCount > 0 {
		return fmt.Errorf("%w: masih ada %d staf aktif menggunakan role '%s' — pindahkan mereka ke role lain terlebih dahulu", ErrRBACConflict, activeCount, role.Name)
	}

	if txErr := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("role_id = ?", role.ID).Delete(&models.PlatformRolePermission{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&role).Error; err != nil {
			return err
		}
		return nil
	}); txErr != nil {
		return txErr
	}

	s.RefreshCache()
	publishRBACInvalidation()

	if actor != nil {
		roleID := role.ID
		RecordActivity(RecordActivityParams{
			DB:          s.db,
			UserID:      &actor.ID,
			ActorEmail:  actor.Email,
			ActorName:   actor.Name,
			ActorRole:   "superadmin",
			Action:      "RBAC_CUSTOM_ROLE_DELETED",
			Category:    "superadmin",
			EntityType:  "platform_role",
			EntityID:    &roleID,
			EntityTitle: role.Name,
			Description: fmt.Sprintf("Superadmin '%s' menghapus custom role '%s' (%s).", actor.Name, role.Name, role.Slug),
		})
	}

	return nil
}
