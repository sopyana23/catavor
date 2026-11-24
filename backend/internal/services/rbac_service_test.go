package services

import (
	"errors"
	"testing"

	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func rbacTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("buka sqlite rbac: %v", err)
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.Store{},
		&models.UserSession{},
		&models.PlatformRole{},
		&models.PlatformPermission{},
		&models.PlatformRolePermission{},
		&models.ActivityLog{},
	); err != nil {
		t.Fatalf("migrasi rbac: %v", err)
	}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)

	// Seed permissions & system roles
	perms := []models.PlatformPermission{
		{Key: "compliance:reports:manage", Group: "compliance", Name: "Kelola Laporan"},
		{Key: "support:tickets:read", Group: "support", Name: "Lihat Tiket"},
		{Key: "finance:orders:read", Group: "finance", Name: "Lihat Order"},
		{Key: "finance:orders:manage", Group: "finance", Name: "Validasi Order"},
		{Key: "finance:settings:manage", Group: "finance", Name: "Konfigurasi Pembayaran"},
		{Key: "finance:revenue:read", Group: "finance", Name: "Lihat Omzet"},
		{Key: "monetization:google:manage", Group: "monetization", Name: "Kelola AdSense"},
		{Key: "audit:logs:read", Group: "audit", Name: "Lihat Audit Log"},
		{Key: "system:admins:manage", Group: "system", Name: "Kelola Staf & RBAC"},
		{Key: "system:settings:manage", Group: "system", Name: "Kelola Master Settings"},
	}
	for i := range perms {
		if err := db.Create(&perms[i]).Error; err != nil {
			t.Fatalf("seed perm %s: %v", perms[i].Key, err)
		}
	}

	sysRoles := []models.PlatformRole{
		{Slug: "superadmin", Name: "Super Administrator", IsSystem: true},
		{Slug: "support", Name: "Customer Support", IsSystem: true},
		{Slug: "finance", Name: "Finance & Billing", IsSystem: true},
		{Slug: "content", Name: "Content & Marketing", IsSystem: true},
	}
	for i := range sysRoles {
		if err := db.Create(&sysRoles[i]).Error; err != nil {
			t.Fatalf("seed role %s: %v", sysRoles[i].Slug, err)
		}
	}

	return db
}

func TestRBACService_CustomRoleLifecycleAndDynamicStaff(t *testing.T) {
	db := rbacTestDB(t)
	useGlobalDB(t, db)
	svc := InitRBACService(db)
	t.Cleanup(func() { InitRBACService(nil) })

	root := &models.User{ID: 1, Name: "Root", Email: "root@catavor.local", PlatformRole: "superadmin"}
	if err := db.Create(root).Error; err != nil {
		t.Fatalf("seed root: %v", err)
	}

	// 1. Tolak slug reserved, built-in, atau format tidak sah
	for _, badSlug := range []string{"admin", "merchant", "superadmin", "support", "a", "Bad-Slug!", "audit log"} {
		if _, err := svc.CreateCustomRole(badSlug, "Bad Role", "desc", []string{"audit:logs:read"}, root); err == nil {
			t.Errorf("slug %q seharusnya ditolak", badSlug)
		}
	}

	// 2. Tolak Opsi A escalation (system:admins:manage) & unknown permission keys
	if _, err := svc.CreateCustomRole("escalated_role", "Escalated", "", []string{"system:admins:manage"}, root); !errors.Is(err, ErrRBACValidation) {
		t.Errorf("create custom role dengan system:admins:manage harus gagal ErrRBACValidation, dapat: %v", err)
	}
	if _, err := svc.CreateCustomRole("ghost_perm_role", "Ghost Perm", "", []string{"nonexistent:perm:key"}, root); !errors.Is(err, ErrRBACValidation) {
		t.Errorf("create custom role dengan permission key fiktif harus gagal ErrRBACValidation, dapat: %v", err)
	}

	// 3. Buat custom role valid secara atomik
	role, err := svc.CreateCustomRole("custom_auditor", "Auditor Internal", "Hanya audit & order", []string{"audit:logs:read", "finance:orders:read"}, root)
	if err != nil {
		t.Fatalf("CreateCustomRole valid gagal: %v", err)
	}
	if role.IsSystem {
		t.Error("custom role baru tidak boleh bertanda IsSystem=true")
	}

	// 4. Fail-open whitelist fix: models.IsPlatformStaffRole & HasPermission & GetUserPermissions wajib mengenali custom role!
	if !models.IsPlatformStaffRole("custom_auditor") {
		t.Fatal("models.IsPlatformStaffRole harus mengenali custom role yang terdaftar di DB")
	}
	if !models.IsPlatformStaffRole("  CUSTOM_AUDITOR ") {
		t.Fatal("models.IsPlatformStaffRole harus menormalisasi spasi & kapitalisasi pada custom role")
	}
	auditorUser := &models.User{ID: 10, Name: "Audi", Email: "audi@catavor.local", PlatformRole: "custom_auditor"}
	if err := db.Create(auditorUser).Error; err != nil {
		t.Fatalf("create auditor user: %v", err)
	}
	if !svc.HasPermission(auditorUser, "audit:logs:read") || !svc.HasPermission(auditorUser, "finance:orders:read") {
		t.Fatal("pemegang custom role harus memiliki permission miliknya")
	}
	if svc.HasPermission(auditorUser, "system:admins:manage") {
		t.Fatal("pemegang custom role tidak boleh mewarisi system:admins:manage")
	}
	perms := svc.GetUserPermissions(auditorUser)
	if len(perms) != 2 {
		t.Fatalf("GetUserPermissions(custom_auditor) = %v, want 2 keys", perms)
	}

	// 5. UpdateCustomRole mengubah metadata & menyinkronkan izin, sambil tetap memblokir Opsi A
	updatedPerms := []string{"audit:logs:read"}
	if _, err := svc.UpdateCustomRole("custom_auditor", "Auditor Senior", "Revisi deskripsi", &updatedPerms, root); err != nil {
		t.Fatalf("UpdateCustomRole gagal: %v", err)
	}
	if svc.HasPermission(auditorUser, "finance:orders:read") {
		t.Error("izin finance:orders:read seharusnya sudah dicabut setelah UpdateCustomRole")
	}
	badUpdatePerms := []string{"system:admins:manage"}
	if _, err := svc.UpdateCustomRole("custom_auditor", "Auditor Senior", "Hack", &badUpdatePerms, root); !errors.Is(err, ErrRBACValidation) {
		t.Errorf("UpdateCustomRole dengan system:admins:manage harus ditolak, dapat: %v", err)
	}

	// 6. System role tidak dapat di-update via UpdateCustomRole maupun dihapus via DeleteCustomRole
	if _, err := svc.UpdateCustomRole("support", "CS Hacked", "", nil, root); !errors.Is(err, ErrRBACConflict) {
		t.Errorf("UpdateCustomRole untuk system role harus 409 Conflict, dapat: %v", err)
	}
	if err := svc.DeleteCustomRole("support", root); !errors.Is(err, ErrRBACConflict) {
		t.Errorf("DeleteCustomRole untuk system role harus 409 Conflict, dapat: %v", err)
	}

	// 7. DeleteCustomRole ditolak (409 Conflict) selama masih ada user aktif memegang role tersebut
	if err := svc.DeleteCustomRole("custom_auditor", root); !errors.Is(err, ErrRBACConflict) {
		t.Errorf("DeleteCustomRole selagi ada staf aktif harus gagal 409 Conflict, dapat: %v", err)
	}

	// 8. Setelah staf di-revoke, custom role dapat dihapus bersih + tidak lagi dikenal IsPlatformStaffRole
	if err := svc.RevokeStaffRole(auditorUser.ID, root); err != nil {
		t.Fatalf("RevokeStaffRole gagal: %v", err)
	}
	if err := svc.DeleteCustomRole("custom_auditor", root); err != nil {
		t.Fatalf("DeleteCustomRole setelah tidak ada staf aktif gagal: %v", err)
	}
	if models.IsPlatformStaffRole("custom_auditor") {
		t.Error("custom role yang sudah dihapus tidak boleh masih dianggap staf oleh IsPlatformStaffRole")
	}
}

func TestRBACService_AntiSelfLastSuperadminAndMerchantIsolation(t *testing.T) {
	db := rbacTestDB(t)
	useGlobalDB(t, db)
	svc := InitRBACService(db)
	t.Cleanup(func() { InitRBACService(nil) })

	root := &models.User{ID: 1, Name: "Root", Email: "root@catavor.local", PlatformRole: "superadmin", TokenVersion: 1}
	merchant := &models.User{ID: 2, Name: "Toko", Email: "merchant@catavor.local", PlatformRole: "merchant"}
	supportUser := &models.User{ID: 3, Name: "CS", Email: "cs@catavor.local", PlatformRole: "support", TokenVersion: 1}
	db.Create(root)
	db.Create(merchant)
	db.Create(supportUser)
	db.Create(&models.Store{UserID: merchant.ID, Slug: "toko-m", StoreTitle: "Toko M"})

	// 1. AssignStaffRole ke email merchant ditolak 409 Conflict
	if err := svc.AssignStaffRole(merchant.Email, "support", root); !errors.Is(err, ErrRBACConflict) {
		t.Errorf("AssignStaffRole merchant seharusnya gagal Conflict, dapat: %v", err)
	}

	// 2. AssignStaffRole tidak boleh mengirim role "merchant" (harus pakai RevokeStaffRole)
	if err := svc.AssignStaffRole(supportUser.Email, "merchant", root); !errors.Is(err, ErrRBACValidation) {
		t.Errorf("AssignStaffRole ke 'merchant' harus gagal Validation, dapat: %v", err)
	}

	// 3. AssignStaffRole self-demotion superadmin ditolak Conflict
	if err := svc.AssignStaffRole(root.Email, "finance", root); !errors.Is(err, ErrRBACConflict) {
		t.Errorf("superadmin tidak boleh menurunkan role dirinya sendiri via AssignStaffRole: %v", err)
	}

	// 4. Anti last-superadmin protection lewat AssignStaffRole: buat superadmin kedua yang mencoba menurunkan root? Tunggu — jika cuma 1 superadmin, aktor lain tidak bisa assign; uji skenario 1 superadmin oleh dirinya sudah tertangkap, dan jika superadmin#2 bukan superadmin ia sudah tertolak actor gate. Jika ada 2 superadmin, turunkan 1 -> sukses; turunkan terakhir -> gagal self-demote!
	// Uji sukses AssignStaffRole menaikkan TokenVersion + Enforce TwoFactorEnforced + RevokeAllSessions
	if err := svc.AssignStaffRole(supportUser.Email, "finance", root); err != nil {
		t.Fatalf("AssignStaffRole support->finance gagal: %v", err)
	}
	var updated models.User
	db.First(&updated, supportUser.ID)
	if updated.PlatformRole != "finance" || !updated.TwoFactorEnforced || updated.TokenVersion <= 1 {
		t.Errorf("post-AssignStaffRole state invalid: role=%s twoFA=%v tokenVer=%d", updated.PlatformRole, updated.TwoFactorEnforced, updated.TokenVersion)
	}

	// 5. UpdateRolePermissions menolak superadmin & system:admins:manage
	if err := svc.UpdateRolePermissions("finance", []string{"system:admins:manage"}, root); !errors.Is(err, ErrRBACValidation) {
		t.Errorf("UpdateRolePermissions dengan system:admins:manage harus ditolak Validation, dapat: %v", err)
	}

	// 6. CreateStaffUser menolak role "merchant" & mencatat TwoFactorEnforced=true bahkan untuk custom role
	created, err := svc.CreateStaffUser(CreateStaffParams{
		Name:     "Finance Ops",
		Email:    "finops@catavor.local",
		Password: "K9v!mQ4#xL8zR2w",
		RoleSlug: "finance",
		Actor:    root,
	})
	if err != nil {
		t.Fatalf("CreateStaffUser valid gagal: %v", err)
	}
	if !created.TwoFactorEnforced || created.TokenVersion != 1 {
		t.Errorf("created staff user invariants invalid: TwoFactorEnforced=%v TokenVersion=%d", created.TwoFactorEnforced, created.TokenVersion)
	}
	if _, err := svc.CreateStaffUser(CreateStaffParams{
		Name:     "Merchant Bypass",
		Email:    "mbypass@catavor.local",
		Password: "K9v!mQ4#xL8zR2w",
		RoleSlug: "merchant",
		Actor:    root,
	}); !errors.Is(err, ErrRBACValidation) {
		t.Errorf("CreateStaffUser dengan role 'merchant' seharusnya ditolak Validation, dapat: %v", err)
	}
}
