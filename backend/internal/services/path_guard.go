package services

import (
	"os"
	"path/filepath"
	"strings"
)

// ResolveInsideRoot menggabungkan root dengan key relatif dari klien dan memastikan
// hasilnya TETAP berada di dalam root. Mengembalikan (path, true) bila aman.
//
// SECURITY: fungsi ini adalah satu-satunya cara yang benar untuk menangani key
// yang berasal dari input pengguna. JANGAN memakai strings.HasPrefix pada key
// mentah — prefix seperti "stores/5/../../2/x" lolos pemeriksaan prefix padahal
// setelah normalisasi keluar dari direktori yang diizinkan (temuan audit N-03).
//
// Yang ditolak: path absolut, skema drive (C:\...), key kosong, dan hasil yang
// setelah normalisasi/symlink-resolution keluar dari root.
func ResolveInsideRoot(root, key string) (string, bool) {
	return ResolveInsidePrefix(root, key, "")
}

// ResolveInsidePrefix seperti ResolveInsideRoot, tetapi TAMBAH mewajibkan hasil
// normalisasi berada di bawah prefix relatif tertentu (mis. "stores/5/").
//
// SECURITY (N-03): ResolveInsideRoot saja TIDAK cukup untuk isolasi tenant.
// "stores/5/../../2/x" tetap berada di dalam root storage, jadi ia lolos — padahal
// sudah menunjuk ke data tenant lain. Prefix diperiksa SETELAH normalisasi, bukan
// pada string mentah, sehingga ".." tidak bisa dipakai untuk melewatinya.
func ResolveInsidePrefix(root, key, requiredPrefix string) (string, bool) {
	if root == "" || key == "" {
		return "", false
	}
	// Tolak path absolut & skema drive (C:\...) sebelum digabung.
	if filepath.IsAbs(key) || strings.Contains(key, ":") {
		return "", false
	}

	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", false
	}
	candidate := filepath.Join(absRoot, filepath.FromSlash(key))

	// EvalSymlinks bila memungkinkan, agar symlink keluar root ikut tertangkap.
	resolved := candidate
	if rp, err := filepath.EvalSymlinks(candidate); err == nil {
		resolved = rp
	}

	rel, err := filepath.Rel(absRoot, resolved)
	if err != nil {
		return "", false
	}
	// Rel mengembalikan ".." di awal bila keluar dari root.
	if rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return "", false
	}

	// SECURITY (N-03): wajibkan prefix relatif, diperiksa setelah normalisasi.
	if requiredPrefix != "" {
		relSlash := filepath.ToSlash(rel)
		want := strings.TrimSuffix(filepath.ToSlash(requiredPrefix), "/") + "/"
		if !strings.HasPrefix(relSlash, want) {
			return "", false
		}
	}

	return resolved, true
}
