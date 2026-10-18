package models

import "testing"

// Platform role adalah SATU-SATUNYA sumber kebenaran otorisasi staf platform.
// Test ini mengunci kontraknya: fail-closed untuk nilai tak dikenal, dan
// normalize harus tahan variasi huruf/spasi yang bisa dipakai menembus filter.

func TestNormalizePlatformRole(t *testing.T) {
	cases := []struct{ in, want string }{
		{"superadmin", "superadmin"},
		{"SUPERADMIN", "superadmin"},
		{"  SuperAdmin  ", "superadmin"},
		{"", ""},
		{"   ", ""},
		{"Support", "support"},
	}
	for _, c := range cases {
		if got := NormalizePlatformRole(c.in); got != c.want {
			t.Errorf("NormalizePlatformRole(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestIsPlatformStaffRole(t *testing.T) {
	// Positive control: setiap role yang tercatat di daftar harus dikenali.
	for role := range PlatformStaffRoles {
		if !IsPlatformStaffRole(role) {
			t.Errorf("role terdaftar %q ditolak", role)
		}
		if !IsPlatformStaffRole("  " + role + "  ") {
			t.Errorf("role %q dengan spasi tepi ditolak", role)
		}
		if !IsPlatformStaffRole(strings_upper(role)) {
			t.Errorf("role %q huruf besar ditolak", role)
		}
	}

	// Fail-closed: nilai tak dikenal BUKAN staf.
	denied := []struct{ name, role string }{
		{"kosong", ""},
		{"spasi", "   "},
		{"admin bukan role sah", "admin"},
		{"merchant", "merchant"},
		{"salah ketik", "superadm"},
		{"typo dgn spasi", "super admin"},
		{"null byte", "superadmin\x00"},
		{"prefix saja", "super"},
		{"suffix", "superadminx"},
		{"wildcard", "*"},
		{"sql injection", "' OR '1'='1"},
	}
	for _, d := range denied {
		t.Run(d.name, func(t *testing.T) {
			if IsPlatformStaffRole(d.role) {
				t.Errorf("role %q diterima sebagai staf, seharusnya ditolak", d.role)
			}
		})
	}
}

func TestUserIsPlatformStaff(t *testing.T) {
	t.Run("nil user aman (tidak panic)", func(t *testing.T) {
		var u *User
		if u.IsPlatformStaff() {
			t.Error("nil user dianggap staf")
		}
	})

	t.Run("superadmin dikenali", func(t *testing.T) {
		u := &User{PlatformRole: "superadmin"}
		if !u.IsPlatformStaff() {
			t.Error("superadmin tidak dikenali sebagai staf")
		}
	})

	t.Run("merchant bukan staf", func(t *testing.T) {
		u := &User{PlatformRole: "merchant"}
		if u.IsPlatformStaff() {
			t.Error("merchant dianggap staf")
		}
	})

	t.Run("role kosong bukan staf", func(t *testing.T) {
		u := &User{}
		if u.IsPlatformStaff() {
			t.Error("role kosong dianggap staf")
		}
	})
}

func TestUserIsSuperadmin(t *testing.T) {
	t.Run("nil user aman", func(t *testing.T) {
		var u *User
		if u.IsSuperadmin() {
			t.Error("nil user dianggap superadmin")
		}
	})

	cases := []struct {
		role string
		want bool
	}{
		{"superadmin", true},
		{"  SUPERADMIN  ", true},
		{"SuperAdmin", true},
		{"support", false},
		{"admin", false},
		{"", false},
		{"superadmins", false},
	}
	for _, c := range cases {
		u := &User{PlatformRole: c.role}
		if got := u.IsSuperadmin(); got != c.want {
			t.Errorf("IsSuperadmin(role=%q) = %v, want %v", c.role, got, c.want)
		}
	}
}

func TestPlatformStaffRoleLabel(t *testing.T) {
	if got := (&User{PlatformRole: "finance"}).PlatformStaffRoleLabel(); got != "finance" {
		t.Errorf("label staf = %q, want finance", got)
	}
	// Akun non-staf tidak boleh tercatat dengan role kosong di log audit.
	for _, role := range []string{"", "merchant", "admin", "  "} {
		if got := (&User{PlatformRole: role}).PlatformStaffRoleLabel(); got != "merchant" {
			t.Errorf("label untuk role %q = %q, want merchant", role, got)
		}
	}
}

func TestSafeCompareString(t *testing.T) {
	if !SafeCompareString("abc", "abc") {
		t.Error("string identik harus true")
	}
	cases := []struct{ a, b string }{
		{"abc", "abd"},
		{"abc", "ab"},
		{"", "a"},
		{"a", ""},
		{"ABC", "abc"},
	}
	for _, c := range cases {
		if SafeCompareString(c.a, c.b) {
			t.Errorf("SafeCompareString(%q, %q) harus false", c.a, c.b)
		}
	}
	// Dua string kosong identik -> true (kontrak subtle.ConstantTimeCompare)
	if !SafeCompareString("", "") {
		t.Error("dua string kosong harus true")
	}
}

// strings_upper menghindari impor strings hanya untuk satu panggilan,
// sekaligus menjaga test tetap terbaca.
func strings_upper(s string) string {
	b := []rune(s)
	for i, r := range b {
		if r >= 'a' && r <= 'z' {
			b[i] = r - 32
		}
	}
	return string(b)
}
