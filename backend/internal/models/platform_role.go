package models

import "strings"

// PlatformStaffRoles adalah daftar TUNGGAL role staf platform yang sah.
//
// ARSITEKTUR (control plane vs data plane): staf platform dan merchant adalah
// dua dimensi yang INDEPENDEN.
//
//   - platform_role kosong / "merchant"  -> akun merchant (data plane)
//   - platform_role terisi dari daftar   -> akun staf platform (control plane)
//
// Seorang akun boleh memiliki platform_role DAN toko sekaligus (mis. karyawan
// yang berjualan dengan email pribadi). Yang tidak boleh adalah MEWAJIBKAN
// staf memiliki toko, atau memberi akses staf berdasarkan alamat email.
//
// Otorisasi berasal dari penugasan role yang tercatat di DB dan dapat dicabut
// serta diaudit lewat POST/DELETE /api/admin/rbac/staff — BUKAN dari whitelist
// email atau domain. Lihat OWASP Authorization Cheat Sheet: "enforce access
// control server-side using a trusted, non-modifiable source" — alamat email
// adalah identitas, bukan otorisasi.
//
// Fail-closed: nilai tak dikenal (typo, sisa migrasi) dianggap BUKAN staf.
// Daftar ini sengaja tidak memuat "admin" — nilai itu bukan role sah di DB.
var PlatformStaffRoles = map[string]struct{}{
	"superadmin": {},
	"support":    {},
	"compliance": {},
	"finance":    {},
	"content":    {},
}

// NormalizePlatformRole mengembalikan platform_role dalam bentuk kanonik
// (huruf kecil, tanpa spasi tepi).
func NormalizePlatformRole(role string) string {
	return strings.ToLower(strings.TrimSpace(role))
}

// IsPlatformStaffRole adalah varian string-level dari User.IsPlatformStaff,
// untuk pemanggil yang hanya menyimpan role sebagai string (mis. koneksi SSE).
func IsPlatformStaffRole(role string) bool {
	_, ok := PlatformStaffRoles[NormalizePlatformRole(role)]
	return ok
}

// IsPlatformStaff melaporkan apakah pemilik akun ini adalah staf platform.
// Nil-safe: user nil menghasilkan false.
func (u *User) IsPlatformStaff() bool {
	if u == nil {
		return false
	}
	return IsPlatformStaffRole(u.PlatformRole)
}

// PlatformStaffRoleLabel mengembalikan label role untuk keperluan audit.
// Akun non-staf dilaporkan sebagai "merchant" agar log tidak pernah mencatat
// role kosong.
func (u *User) PlatformStaffRoleLabel() string {
	if u.IsPlatformStaff() {
		return NormalizePlatformRole(u.PlatformRole)
	}
	return "merchant"
}

// IsSuperadmin melaporkan apakah akun memegang role superadmin (wildcard).
func (u *User) IsSuperadmin() bool {
	return u != nil && NormalizePlatformRole(u.PlatformRole) == "superadmin"
}
