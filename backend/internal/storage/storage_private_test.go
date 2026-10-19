package storage

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"
)

// TestIsPrivateKey memastikan deteksi namespace privat tidak longgar.
// Kasus "privatex/..." penting: prefix harus diakhiri "/" agar direktori lain
// yang kebetulan berawalan "private" tidak ikut dianggap privat.
func TestIsPrivateKey(t *testing.T) {
	cases := map[string]bool{
		"private/support/tickets/2026/10/a.pdf": true,
		"/private/billing/x.png":                true,
		"private\\support\\x.pdf":               true,
		"stores/1/branding/x.jpg":               false,
		"privatex/y.png":                        false,
		"":                                      false,
	}
	for key, want := range cases {
		if got := IsPrivateKey(key); got != want {
			t.Errorf("IsPrivateKey(%q) = %v, ingin %v", key, got, want)
		}
	}
}

// TestUpload_PrivateKeyLandsInPrivateRoot adalah regresi ST-01: object
// ber-namespace "private/" WAJIB ditulis ke root privat, tidak boleh menyentuh
// root publik, dan tidak boleh menghasilkan URL publik.
func TestUpload_PrivateKeyLandsInPrivateRoot(t *testing.T) {
	pub := t.TempDir()
	priv := t.TempDir()
	s := &LocalStorageService{localRoot: pub, privateRoot: priv, publicBaseURL: "https://cdn.test/storage"}

	key := PrivateKeyPrefix + "support/tickets/2026/10/a.pdf"
	url, err := s.Upload(context.Background(), key, bytes.NewReader([]byte("%PDF-1.4")), 8, "application/pdf")
	if err != nil {
		t.Fatalf("Upload: %v", err)
	}
	if url != "" {
		t.Errorf("URL object privat harus kosong, dapat %q", url)
	}

	wantPrivate := filepath.Join(priv, "support", "tickets", "2026", "10", "a.pdf")
	if _, err := os.Stat(wantPrivate); err != nil {
		t.Errorf("berkas tidak ada di root privat: %v", err)
	}
	leaked := filepath.Join(pub, "support", "tickets", "2026", "10", "a.pdf")
	if _, err := os.Stat(leaked); !os.IsNotExist(err) {
		t.Error("REGRESI: berkas privat ikut ditulis ke root publik")
	}
}

// TestUpload_PublicKeyStillPublic memastikan aset publik tidak berubah
// perilakunya: tetap di root publik dan tetap punya URL.
func TestUpload_PublicKeyStillPublic(t *testing.T) {
	pub := t.TempDir()
	s := &LocalStorageService{localRoot: pub, privateRoot: t.TempDir(), publicBaseURL: "https://cdn.test/storage"}

	key := "stores/1/branding/x.jpg"
	url, err := s.Upload(context.Background(), key, bytes.NewReader([]byte("x")), 1, "image/jpeg")
	if err != nil {
		t.Fatalf("Upload: %v", err)
	}
	if want := "https://cdn.test/storage/stores/1/branding/x.jpg"; url != want {
		t.Errorf("URL publik = %q, ingin %q", url, want)
	}
	if _, err := os.Stat(filepath.Join(pub, "stores", "1", "branding", "x.jpg")); err != nil {
		t.Errorf("berkas publik tidak ada di root publik: %v", err)
	}
}

// TestUpload_PrivateWithoutPrivateRootFails memastikan salah konfigurasi gagal
// tertutup (error), bukan menulis ke path relatif terhadap cwd.
func TestUpload_PrivateWithoutPrivateRootFails(t *testing.T) {
	s := &LocalStorageService{localRoot: t.TempDir()}
	_, err := s.Upload(context.Background(), PrivateKeyPrefix+"support/x.pdf", bytes.NewReader([]byte("x")), 1, "application/pdf")
	if err == nil {
		t.Fatal("Upload privat tanpa privateRoot harus error")
	}
}

// TestDelete_PrivateKeyUsesPrivateRoot memastikan penghapusan object privat
// memetakan ke root privat, bukan root publik.
func TestDelete_PrivateKeyUsesPrivateRoot(t *testing.T) {
	priv := t.TempDir()
	pub := t.TempDir()
	s := &LocalStorageService{localRoot: pub, privateRoot: priv}

	key := PrivateKeyPrefix + "support/x.pdf"
	if _, err := s.Upload(context.Background(), key, bytes.NewReader([]byte("x")), 1, "application/pdf"); err != nil {
		t.Fatalf("Upload: %v", err)
	}
	if err := s.Delete(context.Background(), key); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := os.Stat(filepath.Join(priv, "support", "x.pdf")); !os.IsNotExist(err) {
		t.Error("berkas privat tidak terhapus dari root privat")
	}
}

// TestDelete_PrivateKeyCannotEscapePrivateRoot memastikan traversal tetap
// ditolak untuk namespace privat.
func TestDelete_PrivateKeyCannotEscapePrivateRoot(t *testing.T) {
	s := &LocalStorageService{localRoot: t.TempDir(), privateRoot: t.TempDir()}
	if err := s.Delete(context.Background(), PrivateKeyPrefix+"../evil.txt"); err == nil {
		t.Error("Delete privat dengan traversal harus ditolak")
	}
}
