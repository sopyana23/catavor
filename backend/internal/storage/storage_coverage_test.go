package storage

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"catavor-backend/internal/config"
)

// Ambang CI untuk internal/storage adalah 22% (ci.yml:94). Sebelum file ini,
// seluruh jalur S3, pabrik NewStorageService, dan LocalStorageService.Get
// berada pada 0% karena test lokal hanya menyentuh Upload/Delete. File ini
// menutup jalur yang tidak butuh server S3 sungguhan:
//   - NewStorageService: pemilihan driver lokal vs s3
//   - NewS3StorageService: bentuk endpoint, path-style, URL publik fallback
//   - resolveMirrorPath: pemisahan key publik vs private/ (0700)
//   - LocalStorageService.Get / GetPresignedURL / GetDriverName
//   - mimeByExtension

func TestNewStorageService_DriverSelection(t *testing.T) {
	root := t.TempDir()

	// default -> local
	cfg := &config.Config{StorageLocalRoot: root}
	svc, err := NewStorageService(cfg)
	if err != nil {
		t.Fatalf("local driver: %v", err)
	}
	if svc.GetDriverName() != "local" {
		t.Errorf("expected local driver, got %q", svc.GetDriverName())
	}

	// STORAGE_DRIVER=s3 tanpa endpoint jelas -> error, bukan fallback diam-diam
	cfgS3 := &config.Config{StorageDriver: "S3", StorageLocalRoot: root}
	if _, err := NewStorageService(cfgS3); err == nil {
		t.Error("expected error for unusable s3 driver config, got nil")
	}
}

func TestNewS3StorageService_EndpointAndPublicURL(t *testing.T) {
	root := t.TempDir()
	private := t.TempDir()

	// Server kosong: BucketExists akan gagal -> log warning lalu lanjut.
	// Itu jalur produksi yang realistis saat kredensial/endpoint salah.
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	defer ts.Close()

	cfg := &config.Config{
		StorageDriver:     "s3",
		StorageLocalRoot:  root,
		StoragePrivateRoot: private,
		S3Endpoint:        ts.URL, // http://host:port -> dipangkas jadi host:port
		S3Bucket:          "bucket-uji",
		S3AccessKeyID:     "aki",
		S3SecretAccessKey: "sak",
		S3UsePathStyle:    true,
		S3SSL:             false,
	}

	svc, err := NewS3StorageService(cfg)
	if err != nil {
		t.Fatalf("NewS3StorageService: %v", err)
	}
	if svc.GetDriverName() != "s3" {
		t.Errorf("driver = %q, want s3", svc.GetDriverName())
	}

	// StoragePublicURL kosong -> fallback URL publik dibentuk dari endpoint+bucket
	got := svc.GetURL("pub/berkas.txt")
	want := "http://" + strings.TrimPrefix(ts.URL, "http://") + "/bucket-uji/pub/berkas.txt"
	if got != want {
		t.Errorf("GetURL fallback = %q, want %q", got, want)
	}
}

// Catatan perilaku terverifikasi (bukan bug):
//   "/etc/passwd" dan "a\b.txt" TIDAK ditolak, karena di Windows
//   filepath.IsAbs("/etc/passwd") == false dan HasPrefix(root) tetap terpenuhi.
//   Keduanya tetap TERKURUNG di dalam root (<root>\etc\passwd), jadi bukan
//   traversal keluar. Yang benar-benar berbahaya adalah "..", dan bentuk itu
//   ditolak. Jalur baca nyata (LocalStorageService.Get -> resolveSafeKey)
//   diuji terpisah dan 0 dari 6 bentuk traversal lolos.
func TestS3ResolveMirrorPath_PublicVsPrivate(t *testing.T) {
	root := t.TempDir()
	private := t.TempDir()
	svc := &S3StorageService{localRoot: root, privateRoot: private}

	cases := []struct {
		name    string
		key     string
		wantOK  bool
		wantPri bool
	}{
		{"publik biasa", "stores/1/branding/logo.png", true, false},
		{"privat", "private/proof/inv-1.pdf", true, true},
		{"traversal", "../escape.txt", false, false},
		{"private tanpa isi", "private/", false, false},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			path, perm, ok := svc.resolveMirrorPath(c.key)
			if ok != c.wantOK {
				t.Fatalf("ok = %v, want %v (path=%q)", ok, c.wantOK, path)
			}
			if !ok {
				return
			}
			isPrivate := perm == 0700
			if isPrivate != c.wantPri {
				t.Errorf("private = %v, want %v (perm=%v)", isPrivate, c.wantPri, perm)
			}
			wantRoot := root
			if c.wantPri {
				wantRoot = private
			}
			if !strings.HasPrefix(path, wantRoot) {
				t.Errorf("path %q tidak di dalam root %q", path, wantRoot)
			}
		})
	}
}

func TestLocalStorage_Get_And_Presigned(t *testing.T) {
	root := t.TempDir()
	cfg := &config.Config{
		StorageLocalRoot: root,
		StoragePublicURL: "https://cdn.catavor.test",
	}
	svc := NewLocalStorageService(cfg)
	if svc.GetDriverName() != "local" {
		t.Fatalf("driver = %q, want local", svc.GetDriverName())
	}

	if err := os.MkdirAll(filepath.Join(root, "stores", "1"), 0755); err != nil {
		t.Fatal(err)
	}
	payload := []byte("isi berkas uji")
	if err := os.WriteFile(filepath.Join(root, "stores", "1", "a.csv"), payload, 0644); err != nil {
		t.Fatal(err)
	}

	// Get: contentType dari ekstensi + ukuran
	rc, ctype, size, err := svc.Get(context.Background(), "stores/1/a.csv")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	buf := new(bytes.Buffer)
	if _, err := buf.ReadFrom(rc); err != nil {
		t.Fatal(err)
	}
	rc.Close()
	if ctype != "text/csv" {
		t.Errorf("contentType = %q, want text/csv", ctype)
	}
	if size != int64(len(payload)) {
		t.Errorf("size = %d, want %d", size, len(payload))
	}
	if buf.String() != string(payload) {
		t.Error("isi berkas berbeda")
	}

	// Get: key di luar root ditolak
	if _, _, _, err := svc.Get(context.Background(), "../keluar.txt"); err == nil {
		t.Error("expected path traversal ditolak")
	}

	// Get: direktori ditolak
	if _, _, _, err := svc.Get(context.Background(), "stores/1"); err == nil {
		t.Error("expected direktori ditolak")
	}

	// GetPresignedURL: publik -> URL CDN; privat -> error
	if u, err := svc.GetPresignedURL(context.Background(), "stores/1/a.csv", 0); err != nil || u == "" {
		t.Errorf("GetPresignedURL publik = %q, %v", u, err)
	}
	if _, err := svc.GetPresignedURL(context.Background(), PrivateKeyPrefix+"rahasia.pdf", 0); err == nil {
		t.Error("expected presigned untuk objek privat ditolak")
	}
}

func TestMimeByExtension(t *testing.T) {
	cases := map[string]string{
		".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
		".webp": "image/webp", ".pdf": "application/pdf", ".mp4": "video/mp4",
		".webm": "video/webm", ".json": "application/json", ".csv": "text/csv",
		".txt": "text/plain", ".ekstensianeh": "application/octet-stream",
		"": "application/octet-stream",
	}
	for ext, want := range cases {
		if got := mimeByExtension(ext); got != want {
			t.Errorf("mimeByExtension(%q) = %q, want %q", ext, got, want)
		}
	}
}
