package models

import (
	"strings"
	"sync"
)

// PlatformStaffRoles adalah daftar role staf platform bawaan yang sah.
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

// ReservedNonStaffRoles adalah identifier yang tidak pernah boleh menjadi role staf
// kustom maupun dianggap staf pengelola platform.
var ReservedNonStaffRoles = map[string]struct{}{
	"":         {},
	"merchant": {},
	"admin":    {},
	"user":     {},
	"buyer":    {},
	"guest":    {},
	"system":   {},
	"*":        {},
}

var (
	customStaffRoleMu      sync.RWMutex
	customStaffRoleChecker func(string) bool
)

// RegisterCustomStaffRoleChecker mendaftarkan pemeriksa role kustom yang didukung DB/cache
// (diisi oleh package services agar models tetap bebas ketergantungan sirkular).
func RegisterCustomStaffRoleChecker(fn func(string) bool) {
	customStaffRoleMu.Lock()
	defer customStaffRoleMu.Unlock()
	customStaffRoleChecker = fn
}

// NormalizePlatformRole mengembalikan platform_role dalam bentuk kanonik
// (huruf kecil, tanpa spasi tepi).
func NormalizePlatformRole(role string) string {
	return strings.ToLower(strings.TrimSpace(role))
}

// IsPlatformStaffRole adalah varian string-level dari User.IsPlatformStaff,
// untuk pemanggil yang hanya menyimpan role sebagai string (mis. koneksi SSE).
// Tetap fail-closed: nilai kosong, reserved, mengandung null-byte, atau tidak
// terdaftar di built-in maupun role DB kustom dianggap BUKAN staf.
func IsPlatformStaffRole(role string) bool {
	if strings.ContainsRune(role, '\x00') {
		return false
	}
	norm := NormalizePlatformRole(role)
	if _, reserved := ReservedNonStaffRoles[norm]; reserved {
		return false
	}
	if _, ok := PlatformStaffRoles[norm]; ok {
		return true
	}
	customStaffRoleMu.RLock()
	checker := customStaffRoleChecker
	customStaffRoleMu.RUnlock()
	if checker != nil {
		return checker(norm)
	}
	return false
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
