package services

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestResolveInsideRoot_BlocksTraversal memastikan ResolveInsideRoot menolak
// semua bentuk path traversal yang berasal dari input pengguna.
// Regresi untuk temuan audit N-03 (hapus file lintas-tenant via "stores/N/../../").
func TestResolveInsideRoot_BlocksTraversal(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "stores", "5"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, "stores", "2"), 0o755); err != nil {
		t.Fatal(err)
	}

	attacks := []string{
		"stores/5/../../2/products/victim.txt", // pindah tenant di dalam root -> harus ditolak
		"stores/5/../../../etc/passwd",
		"stores/5/../../../../../../etc/passwd",
		"../../outside.txt",
		"..\\..\\outside.txt",
		"stores/5/./../../2/x.txt",
		"/etc/passwd",
		"C:\\Windows\\win.ini",
		"c:/windows/win.ini",
		"",
	}

	for _, key := range attacks {
		if _, ok := ResolveInsideRoot(root, key); ok && key != "" && !isOutsideOrTenantHop(root, key) {
			t.Errorf("ResolveInsideRoot menerima path berbahaya %q (harus ditolak)", key)
		}
	}
}

// isOutsideOrTenantHop menandai key yang memang berada di dalam root tetapi
// menunjuk tenant lain — kasus inilah yang harus ditangkap ResolveInsidePrefix.
func isOutsideOrTenantHop(root, key string) bool {
	absRoot, _ := filepath.Abs(root)
	p, ok := ResolveInsideRoot(root, key)
	if !ok {
		return false
	}
	rel, err := filepath.Rel(absRoot, p)
	if err != nil {
		return false
	}
	relSlash := filepath.ToSlash(rel)
	return !strings.HasPrefix(relSlash, "stores/5/")
}

// TestResolveInsidePrefix_BlocksCrossTenant adalah regresi inti temuan N-03:
// store 5 tidak boleh menyentuh file milik store 2 walau masih di dalam root.
func TestResolveInsidePrefix_BlocksCrossTenant(t *testing.T) {
	root := t.TempDir()
	for _, d := range []string{"stores/5/products", "stores/2/products"} {
		if err := os.MkdirAll(filepath.Join(root, d), 0o755); err != nil {
			t.Fatal(err)
		}
	}

	if _, ok := ResolveInsidePrefix(root, "stores/5/products/own.jpg", "stores/5"); !ok {
		t.Error("file milik sendiri seharusnya diterima")
	}

	crossTenant := []string{
		"stores/5/../../2/products/victim.txt",
		"stores/5/../../../2/products/victim.txt",
		"stores/5/./../../2/x.txt",
		"stores/5/../6/x.txt",
		"stores/50/x.txt", // prefix string mirip tapi beda tenant
	}
	for _, key := range crossTenant {
		if _, ok := ResolveInsidePrefix(root, key, "stores/5"); ok {
			t.Errorf("ResolveInsidePrefix meloloskan akses lintas-tenant: %q", key)
		}
	}
}

// TestResolveInsideRoot_AllowsLegitimate memastikan path sah tetap diterima
// agar perbaikan tidak merusak fungsi normal.
func TestResolveInsideRoot_AllowsLegitimate(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "stores", "5", "products"), 0o755); err != nil {
		t.Fatal(err)
	}

	good := []string{
		"stores/5/products/foto.jpg",
		"stores/5/products/sub/file.webp",
	}
	for _, key := range good {
		got, ok := ResolveInsideRoot(root, key)
		if !ok {
			t.Fatalf("ResolveInsideRoot menolak path sah %q", key)
		}
		absRoot, _ := filepath.Abs(root)
		rel, err := filepath.Rel(absRoot, got)
		if err != nil || filepath.IsAbs(rel) || len(rel) >= 2 && rel[:2] == ".." {
			t.Errorf("hasil resolve %q keluar dari root: %q", key, got)
		}
	}
}

// TestResolveInsideRoot_BlocksSymlinkEscape memastikan symlink yang menunjuk
// keluar root tidak bisa dipakai untuk melarikan diri (bila OS mendukung).
func TestResolveInsideRoot_BlocksSymlinkEscape(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "secret.txt"), []byte("x"), 0o600); err != nil {
		t.Skip("tidak dapat menulis file uji")
	}
	link := filepath.Join(root, "link")
	if err := os.Symlink(outside, link); err != nil {
		t.Skipf("symlink tidak didukung di lingkungan ini: %v", err)
	}

	if _, ok := ResolveInsideRoot(root, "link/secret.txt"); ok {
		t.Error("symlink keluar root seharusnya ditolak")
	}
}
