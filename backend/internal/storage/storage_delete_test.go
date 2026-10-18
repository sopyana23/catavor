package storage

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// newLocal membuat LocalStorageService dengan root sementara.
func newLocal(t *testing.T) (*LocalStorageService, string) {
	t.Helper()
	root := t.TempDir()
	return &LocalStorageService{localRoot: root}, root
}

// relKey menyusun key relatif (format slash) dari root menuju target.
func relKey(t *testing.T, root, target string) string {
	t.Helper()
	rel, err := filepath.Rel(root, target)
	if err != nil {
		t.Fatal(err)
	}
	return strings.ReplaceAll(rel, string(os.PathSeparator), "/")
}

// TestDelete_BlocksEscapeFromRoot adalah regresi N-40: Delete tidak boleh
// menghapus file di luar storage root walau key berasal dari input klien.
func TestDelete_BlocksEscapeFromRoot(t *testing.T) {
	s, root := newLocal(t)
	outside := t.TempDir()

	victim := filepath.Join(outside, "victim.txt")
	if err := os.WriteFile(victim, []byte("data penting"), 0o600); err != nil {
		t.Fatal(err)
	}

	err := s.Delete(context.Background(), relKey(t, root, victim))
	if err == nil {
		t.Error("Delete seharusnya menolak key yang keluar dari root")
	}
	if _, statErr := os.Stat(victim); os.IsNotExist(statErr) {
		t.Fatal("REGRESI: file di luar root ikut terhapus")
	}
}

// TestDeletePrefix_BlocksEscapeFromRoot memastikan RemoveAll tidak bisa
// menyasar direktori di luar root.
func TestDeletePrefix_BlocksEscapeFromRoot(t *testing.T) {
	s, root := newLocal(t)
	outside := t.TempDir()

	victimDir := filepath.Join(outside, "victimdir")
	if err := os.MkdirAll(victimDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(victimDir, "f.txt"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}

	err := s.DeletePrefix(context.Background(), relKey(t, root, victimDir))
	if err == nil {
		t.Error("DeletePrefix seharusnya menolak prefix di luar root")
	}
	if _, statErr := os.Stat(victimDir); os.IsNotExist(statErr) {
		t.Fatal("REGRESI: direktori di luar root ikut terhapus")
	}
}

// TestDeletePrefix_RefusesRootItself memastikan RemoveAll tidak pernah
// menyasar root storage itu sendiri.
func TestDeletePrefix_RefusesRootItself(t *testing.T) {
	s, root := newLocal(t)
	if err := os.WriteFile(filepath.Join(root, "keep.txt"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"", ".", "/", "./"} {
		if err := s.DeletePrefix(context.Background(), key); err == nil {
			t.Errorf("DeletePrefix(%q) seharusnya ditolak", key)
		}
	}
	if _, err := os.Stat(filepath.Join(root, "keep.txt")); err != nil {
		t.Fatal("REGRESI: isi root storage ikut terhapus")
	}
}

// TestDelete_RejectsAbsoluteAndDrivePaths memastikan bentuk absolut ditolak.
//
// Catatan: "/etc/passwd" sengaja TIDAK masuk daftar ini. Leading slash dibuang
// oleh normalisasi sehingga menjadi key relatif "etc/passwd" DI DALAM root —
// tidak keluar root, jadi bukan serangan. Yang berbahaya adalah path absolut
// Windows/UNC dan key kosong.
func TestDelete_RejectsAbsoluteAndDrivePaths(t *testing.T) {
	s, _ := newLocal(t)
	bad := []string{"", "C:\\Windows\\win.ini", "c:/windows/win.ini", "  "}
	for _, key := range bad {
		if err := s.Delete(context.Background(), key); err == nil {
			t.Errorf("Delete(%q) seharusnya ditolak", key)
		}
	}
}

// TestDelete_LeadingSlashStaysInsideRoot mendokumentasikan perilaku normalisasi:
// leading slash dibuang, sehingga target tetap di dalam root (aman).
func TestDelete_LeadingSlashStaysInsideRoot(t *testing.T) {
	s, root := newLocal(t)
	target := filepath.Join(root, "etc", "passwd")
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(target, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := s.Delete(context.Background(), "/etc/passwd"); err != nil {
		t.Fatalf("key dengan leading slash seharusnya diterima di dalam root: %v", err)
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Fatal("file di dalam root seharusnya terhapus")
	}
}

// TestDelete_AllowsLegitimateKey adalah KONTROL POSITIF: perbaikan keamanan
// tidak boleh merusak penghapusan file yang sah di dalam root.
func TestDelete_AllowsLegitimateKey(t *testing.T) {
	s, root := newLocal(t)

	target := filepath.Join(root, "stores", "5", "products", "foto.jpg")
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(target, []byte("img"), 0o600); err != nil {
		t.Fatal(err)
	}

	if err := s.Delete(context.Background(), "stores/5/products/foto.jpg"); err != nil {
		t.Fatalf("Delete menolak key sah: %v", err)
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Fatal("file sah seharusnya terhapus")
	}
}

// TestDeletePrefix_AllowsLegitimatePrefix adalah KONTROL POSITIF untuk prefix.
func TestDeletePrefix_AllowsLegitimatePrefix(t *testing.T) {
	s, root := newLocal(t)

	dir := filepath.Join(root, "stores", "7")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	// Tetangga tenant lain harus tetap ada.
	other := filepath.Join(root, "stores", "8")
	if err := os.MkdirAll(other, 0o755); err != nil {
		t.Fatal(err)
	}

	if err := s.DeletePrefix(context.Background(), "stores/7"); err != nil {
		t.Fatalf("DeletePrefix menolak prefix sah: %v", err)
	}
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Fatal("direktori sah seharusnya terhapus")
	}
	if _, err := os.Stat(other); err != nil {
		t.Fatal("direktori tenant lain tidak boleh terhapus")
	}
}

// TestDelete_AllowsNestedTraversalInsideRoot memastikan ".." yang tetap
// berakhir di dalam root tetap diterima (perilaku normal, bukan serangan).
func TestDelete_AllowsNestedTraversalInsideRoot(t *testing.T) {
	s, root := newLocal(t)

	target := filepath.Join(root, "stores", "2", "x.txt")
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(target, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}

	// stores/5/../2/x.txt -> normalisasi ke stores/2/x.txt (masih di dalam root).
	if err := s.Delete(context.Background(), "stores/5/../2/x.txt"); err != nil {
		t.Fatalf("key yang ternormalisasi di dalam root seharusnya diterima: %v", err)
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Fatal("file target seharusnya terhapus")
	}
}
