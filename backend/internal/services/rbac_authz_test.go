package services

import (
	"testing"

	"catavor-backend/internal/models"
)

// TestGetUserPermissions_RejectsGarbageRole adalah regresi N-41.
//
// SECURITY: HasPermission sudah memakai whitelist IsPlatformStaff() (perbaikan
// N-25), tetapi GetUserPermissions masih memakai penolakan berbasis daftar hitam
// ("" dan "merchant"). Akibatnya role sampah seperti "superadminx" atau
// "  super admin " dianggap staf dan menembus jalur cache.
func TestGetUserPermissions_RejectsGarbageRole(t *testing.T) {
	s := &RBACService{permCache: map[string]map[string]bool{
		"superadminx":  {"*": true},
		"Super Admin":  {"*": true},
		"admin":        {"products.read": true},
		"super admin ": {"*": true},
	}}

	garbage := []string{"superadminx", "Super Admin", "super admin ", "adminx", "root", "  ", "SUPERADMIN2"}
	for _, role := range garbage {
		u := &models.User{PlatformRole: role}
		if perms := s.GetUserPermissions(u); len(perms) != 0 {
			t.Errorf("role sampah %q seharusnya tidak punya permission, dapat %v", role, perms)
		}
	}
}

// TestGetUserPermissions_AllowsLegitStaff adalah KONTROL POSITIF: role staf yang
// sah harus tetap mendapat permission-nya.
//
// Catatan: "admin" BUKAN role sah (lihat models.PlatformStaffRoles) — daftar
// resminya superadmin/support/compliance/finance/content.
func TestGetUserPermissions_AllowsLegitStaff(t *testing.T) {
	s := &RBACService{permCache: map[string]map[string]bool{
		"support": {"products.read": true, "products.write": true},
	}}

	u := &models.User{PlatformRole: "support"}
	perms := s.GetUserPermissions(u)
	if len(perms) != 2 {
		t.Fatalf("role support seharusnya punya 2 permission, dapat %v", perms)
	}

	// Kapitalisasi & spasi tepi harus dinormalkan.
	if got := s.GetUserPermissions(&models.User{PlatformRole: " Support "}); len(got) != 2 {
		t.Errorf("role dengan kapitalisasi/spasi seharusnya dinormalkan, dapat %v", got)
	}

	// Merchant (bukan staf platform) tetap kosong.
	if got := s.GetUserPermissions(&models.User{PlatformRole: "merchant"}); len(got) != 0 {
		t.Errorf("merchant seharusnya tidak punya permission platform, dapat %v", got)
	}

	if got := s.GetUserPermissions(nil); len(got) != 0 {
		t.Errorf("user nil seharusnya kosong, dapat %v", got)
	}
}

// TestHasPermission_RejectsGarbageRole memastikan kedua fungsi konsisten.
func TestHasPermission_RejectsGarbageRole(t *testing.T) {
	s := &RBACService{permCache: map[string]map[string]bool{
		"superadminx": {"*": true},
	}}
	for _, role := range []string{"superadminx", "root", "adminx"} {
		u := &models.User{PlatformRole: role}
		if s.HasPermission(u, "products.read") {
			t.Errorf("HasPermission meloloskan role sampah %q", role)
		}
	}
	if s.HasPermission(nil, "products.read") {
		t.Error("HasPermission(nil) harus false")
	}
}

// TestRequireRBACSuperadmin memastikan gerbang otorisasi level service menolak
// aktor yang bukan superadmin, termasuk variasi spasi/kapitalisasi.
func TestRequireRBACSuperadmin(t *testing.T) {
	if err := requireRBACSuperadmin(nil); err == nil {
		t.Error("aktor nil harus ditolak")
	}
	bad := []string{"", "admin", "merchant", "superadminx", "super admin", "SUPERADMINX"}
	for _, role := range bad {
		if err := requireRBACSuperadmin(&models.User{PlatformRole: role}); err == nil {
			t.Errorf("role %q seharusnya ditolak", role)
		}
	}

	// KONTROL POSITIF: superadmin sah harus lolos, termasuk beda kapitalisasi.
	for _, role := range []string{"superadmin", "SuperAdmin", " SUPERADMIN "} {
		if err := requireRBACSuperadmin(&models.User{PlatformRole: role}); err != nil {
			t.Errorf("role %q seharusnya diterima, dapat error: %v", role, err)
		}
	}
}

// ---------------------------------------------------------------------------
// PENTEST SUITE: RBAC Authorization & Escalation Resistance
// ---------------------------------------------------------------------------

func TestRBAC_Pentest_CreateCustomRole_RejectsNonSuperadmin(t *testing.T) {
	s := &RBACService{}
	maliciousActors := []*models.User{
		nil,
		{ID: 2, PlatformRole: "merchant"},
		{ID: 3, PlatformRole: "support"},
		{ID: 4, PlatformRole: "compliance"},
		{ID: 5, PlatformRole: "superadminx"},
		{ID: 6, PlatformRole: "admin"},
	}

	for _, actor := range maliciousActors {
		role, err := s.CreateCustomRole("hacked_role", "Hacked Role", "evil", []string{"*"}, actor)
		if err == nil || role != nil {
			roleName := "nil"
			if actor != nil {
				roleName = actor.PlatformRole
			}
			t.Fatalf("PENTEST BREACH: Aktor %s berhasil membuat custom role!", roleName)
		}
	}
}

func TestRBAC_Pentest_AssignStaffRole_RejectsNonSuperadmin(t *testing.T) {
	s := &RBACService{}
	maliciousActors := []*models.User{
		nil,
		{ID: 2, PlatformRole: "merchant"},
		{ID: 3, PlatformRole: "support"},
		{ID: 4, PlatformRole: "compliance"},
		{ID: 5, PlatformRole: "finance"},
	}

	for _, actor := range maliciousActors {
		err := s.AssignStaffRole("target@test.com", "superadmin", actor)
		if err == nil {
			roleName := "nil"
			if actor != nil {
				roleName = actor.PlatformRole
			}
			t.Fatalf("PENTEST BREACH: Aktor %s berhasil menugaskan role!", roleName)
		}
	}
}

func TestRBAC_Pentest_RevokeStaffRole_RejectsNonSuperadmin(t *testing.T) {
	s := &RBACService{}
	maliciousActors := []*models.User{
		nil,
		{ID: 2, PlatformRole: "merchant"},
		{ID: 3, PlatformRole: "support"},
		{ID: 4, PlatformRole: "content"},
	}

	for _, actor := range maliciousActors {
		err := s.RevokeStaffRole(99, actor)
		if err == nil {
			roleName := "nil"
			if actor != nil {
				roleName = actor.PlatformRole
			}
			t.Fatalf("PENTEST BREACH: Aktor %s berhasil mencabut wewenang staf!", roleName)
		}
	}
}

func TestRBAC_Pentest_UpdateRolePermissions_RejectsNonSuperadmin(t *testing.T) {
	s := &RBACService{}
	maliciousActors := []*models.User{
		nil,
		{ID: 2, PlatformRole: "merchant"},
		{ID: 3, PlatformRole: "support"},
	}

	for _, actor := range maliciousActors {
		err := s.UpdateRolePermissions("support", []string{"*"}, actor)
		if err == nil {
			roleName := "nil"
			if actor != nil {
				roleName = actor.PlatformRole
			}
			t.Fatalf("PENTEST BREACH: Aktor %s berhasil mengubah matriks izin!", roleName)
		}
	}
}
