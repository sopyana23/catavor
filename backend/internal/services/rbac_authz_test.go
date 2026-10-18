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
