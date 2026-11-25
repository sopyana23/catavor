package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/middleware"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

// supportDB menyiapkan SQLite in-memory dengan tabel-tabel modul bantuan.
// seedSupportRBAC mengisi platform_roles, platform_permissions, dan relasinya
// supaya gerbang otorisasi berbasis permission benar-benar dieksekusi.
//
// Sebelum pengerasan RBAC, handler cukup memeriksa PlatformRole == "support".
// Sekarang handler menuntut permission eksplisit (support:tickets:read), dan
// permission itu hanya ada bila schema produksi ter-seed. Tanpa seed,
// HasPermission() selalu false sehingga staf sah ditolak 403/404 — bukan karena
// handler salah, melainkan karena fixture test-nya belum mencerminkan produksi.
func seedSupportRBAC(t *testing.T, db *gorm.DB) {
	t.Helper()

	perms := []models.PlatformPermission{
		{Key: "support:tickets:read", Group: "support", Name: "Lihat Tiket Bantuan"},
		{Key: "support:tickets:reply", Group: "support", Name: "Balas Tiket Bantuan"},
		{Key: "support:help_articles:manage", Group: "support", Name: "Kelola Pusat Bantuan"},
	}
	for i := range perms {
		if err := db.Where("key = ?", perms[i].Key).
			FirstOrCreate(&perms[i]).Error; err != nil {
			t.Fatalf("seed permission %s: %v", perms[i].Key, err)
		}
	}

	role := models.PlatformRole{
		Slug:        "support",
		Name:        "Layanan Pelanggan",
		Description: "Penanganan tiket merchant dan artikel Pusat Bantuan",
		IsSystem:    true,
	}
	if err := db.Where("slug = ?", role.Slug).FirstOrCreate(&role).Error; err != nil {
		t.Fatalf("seed role support: %v", err)
	}
	if err := db.Model(&role).Association("Permissions").Replace(perms); err != nil {
		t.Fatalf("relasi role-permission: %v", err)
	}

	// Singleton RBAC menyimpan cache permission. Cache harus dimuat ulang setelah
	// seed, jika tidak HasPermission() tetap membaca cache kosong.
	services.GetRBACService().RefreshCache()
}

func supportDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := newTestDB(t)
	if err := db.AutoMigrate(
		&models.SupportTicket{},
		&models.SupportMessage{},
		&models.SupportAttachment{},
	); err != nil {
		t.Fatalf("migrate tabel support: %v", err)
	}
	seedSupportRBAC(t, db)
	return db
}

// supportApp memasang handler bantuan. Aktor diambil dari header X-Test-Actor
// supaya gerbang otorisasi di dalam handler benar-benar dieksekusi.
func supportApp(t *testing.T, db *gorm.DB, cfg *config.Config) *fiber.App {
	t.Helper()
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	h := NewSupportHandler(cfg, nil, db)

	actor := func(c *fiber.Ctx) error {
		switch c.Get("X-Test-Actor") {
		case "pemilik":
			c.Locals("user", &models.User{ID: 10, Name: "Pemilik", Email: "pemilik@example.com", PlatformRole: "merchant"})
		case "penyusup":
			c.Locals("user", &models.User{ID: 11, Name: "Penyusup", Email: "penyusup@example.com", PlatformRole: "merchant"})
		case "staf":
			c.Locals("user", &models.User{ID: 1, Name: "Agen", Email: "agen@example.com", PlatformRole: "support"})
		}
		return c.Next()
	}

	app.Post("/tickets", actor, h.CreateTicket)
	app.Get("/tickets/:id", actor, h.GetTicketDetails)
	app.Post("/tickets/:id/reply", actor, h.ReplyTicket)
	app.Post("/admin/tickets/:id/reply", actor, h.ReplyAsAdmin)
	app.Get("/attachments/:id", actor, h.ServeAttachment)
	return app
}

func supportReq(t *testing.T, app *fiber.App, method, target, body string, actor string) (int, map[string]any, []byte) {
	t.Helper()
	var rdr io.Reader
	if body != "" {
		rdr = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, target, rdr)
	req.Header.Set("Content-Type", "application/json")
	if actor != "" {
		req.Header.Set("X-Test-Actor", actor)
	}
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("%s %s: %v", method, target, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	out := map[string]any{}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &out)
	}
	return resp.StatusCode, out, raw
}

func seedTicket(t *testing.T, db *gorm.DB, userID uint, number, subject, status string) models.SupportTicket {
	t.Helper()
	tk := models.SupportTicket{
		TicketNumber:  number,
		UserID:        userID,
		Subject:       subject,
		Category:      "technical",
		Priority:      "medium",
		Status:        status,
		LastMessageAt: time.Now().UTC(),
	}
	if err := db.Create(&tk).Error; err != nil {
		t.Fatalf("seed tiket %q: %v", number, err)
	}
	return tk
}

// ---------------------------------------------------------------------------
// GetTicketDetails — isolasi kepemilikan tiket
// ---------------------------------------------------------------------------

func TestSupportGetTicketDetails_SQLite(t *testing.T) {
	db := supportDB(t)
	app := supportApp(t, db, testCfg())

	milikSendiri := seedTicket(t, db, 10, "TCK-20261019-0001", "Tiket Sendiri", "open")
	milikOrang := seedTicket(t, db, 11, "TCK-20261019-0002", "Tiket Orang Lain", "open")

	// Pesan agen: satu publik, satu catatan internal.
	now := time.Now().UTC()
	db.Create(&models.SupportMessage{TicketID: milikSendiri.ID, SenderID: 1, SenderType: "agent",
		Message: "Balasan publik agen", CreatedAt: now})
	db.Create(&models.SupportMessage{TicketID: milikSendiri.ID, SenderID: 1, SenderType: "agent",
		Message: "CATATAN INTERNAL RAHASIA", IsInternalNote: true, CreatedAt: now})

	t.Run("tanpa_sesi_401", func(t *testing.T) {
		code, _, _ := supportReq(t, app, "GET", "/tickets/"+milikSendiri.TicketNumber, "", "")
		if code != 401 {
			t.Fatalf("status = %d, want 401", code)
		}
	})

	t.Run("db_nil_503", func(t *testing.T) {
		nilApp := supportApp(t, nil, testCfg())
		code, _, _ := supportReq(t, nilApp, "GET", "/tickets/"+milikSendiri.TicketNumber, "", "pemilik")
		if code != 503 {
			t.Fatalf("status = %d, want 503", code)
		}
	})

	t.Run("tiket_milik_orang_lain_404", func(t *testing.T) {
		// 404, bukan 403: penyerang tidak boleh bisa memastikan nomor tiket ada.
		code, _, _ := supportReq(t, app, "GET", "/tickets/"+milikOrang.TicketNumber, "", "pemilik")
		if code != 404 {
			t.Fatalf("status = %d, want 404", code)
		}
	})

	t.Run("id_numerik_milik_orang_lain_404", func(t *testing.T) {
		// Jalur lookup by primary key tidak boleh melewati filter kepemilikan.
		code, _, _ := supportReq(t, app, "GET", "/tickets/"+itoa(milikOrang.ID), "", "pemilik")
		if code != 404 {
			t.Fatalf("status = %d, want 404 (IDOR via ID numerik)", code)
		}
	})

	t.Run("tiket_sendiri_200", func(t *testing.T) {
		code, body, _ := supportReq(t, app, "GET", "/tickets/"+milikSendiri.TicketNumber, "", "pemilik")
		if code != 200 {
			t.Fatalf("status = %d, want 200 (body %v)", code, body)
		}
		data, _ := body["data"].(map[string]any)
		if data == nil {
			t.Fatalf("data hilang: %v", body)
		}
		if got, _ := data["ticket_number"].(string); got != milikSendiri.TicketNumber {
			t.Errorf("ticket_number = %q, want %q", got, milikSendiri.TicketNumber)
		}
	})

	t.Run("catatan_internal_tidak_bocor_ke_pemilik", func(t *testing.T) {
		_, _, raw := supportReq(t, app, "GET", "/tickets/"+milikSendiri.TicketNumber, "", "pemilik")
		if strings.Contains(string(raw), "CATATAN INTERNAL RAHASIA") {
			t.Fatal("is_internal_note=true ikut terkirim ke pemilik tiket")
		}
		if !strings.Contains(string(raw), "Balasan publik agen") {
			t.Error("pesan publik agen hilang dari respons")
		}
	})

	t.Run("staf_bisa_baca_tiket_merchant", func(t *testing.T) {
		code, _, _ := supportReq(t, app, "GET", "/tickets/"+milikOrang.TicketNumber, "", "staf")
		if code != 200 {
			t.Fatalf("status = %d, want 200 (staf harus bisa membuka tiket siapa pun)", code)
		}
	})

	t.Run("slug_ngawur_404", func(t *testing.T) {
		code, _, _ := supportReq(t, app, "GET", "/tickets/TCK-TIDAK-ADA", "", "pemilik")
		if code != 404 {
			t.Fatalf("status = %d, want 404", code)
		}
	})
}

// ---------------------------------------------------------------------------
// ReplyTicket — tidak boleh menulis ke tiket milik akun lain
// ---------------------------------------------------------------------------

func TestSupportReplyTicket_SQLite(t *testing.T) {
	db := supportDB(t)
	app := supportApp(t, db, testCfg())

	milikOrang := seedTicket(t, db, 11, "TCK-20261019-0101", "Tiket Orang Lain", "open")
	ditutup := seedTicket(t, db, 10, "TCK-20261019-0102", "Tiket Ditutup", "closed")
	milikSendiri := seedTicket(t, db, 10, "TCK-20261019-0103", "Tiket Sendiri", "open")

	t.Run("tanpa_sesi_401", func(t *testing.T) {
		code, _, _ := supportReq(t, app, "POST", "/tickets/"+milikSendiri.TicketNumber+"/reply",
			`{"message":"halo"}`, "")
		if code != 401 {
			t.Fatalf("status = %d, want 401", code)
		}
	})

	t.Run("balas_tiket_orang_lain_404_dan_tidak_menulis", func(t *testing.T) {
		code, _, _ := supportReq(t, app, "POST", "/tickets/"+milikOrang.TicketNumber+"/reply",
			`{"message":"pesan penyusup"}`, "pemilik")
		if code != 404 {
			t.Fatalf("status = %d, want 404", code)
		}
		var count int64
		db.Model(&models.SupportMessage{}).Where("ticket_id = ?", milikOrang.ID).Count(&count)
		if count != 0 {
			t.Fatalf("pesan tersimpan di tiket orang lain (count=%d)", count)
		}
	})

	t.Run("tiket_closed_400", func(t *testing.T) {
		code, _, _ := supportReq(t, app, "POST", "/tickets/"+ditutup.TicketNumber+"/reply",
			`{"message":"halo"}`, "pemilik")
		if code != 400 {
			t.Fatalf("status = %d, want 400 (tiket read-only)", code)
		}
	})

	t.Run("pesan_kosong_422", func(t *testing.T) {
		code, _, _ := supportReq(t, app, "POST", "/tickets/"+milikSendiri.TicketNumber+"/reply",
			`{"message":"   "}`, "pemilik")
		if code != 422 {
			t.Fatalf("status = %d, want 422", code)
		}
	})

	t.Run("balas_sendiri_200", func(t *testing.T) {
		code, body, _ := supportReq(t, app, "POST", "/tickets/"+milikSendiri.TicketNumber+"/reply",
			`{"message":"Terima kasih atas bantuannya"}`, "pemilik")
		if code != 201 {
			t.Fatalf("status = %d, want 201 (body %v)", code, body)
		}
		var count int64
		db.Model(&models.SupportMessage{}).
			Where("ticket_id = ? AND sender_type = ?", milikSendiri.ID, "user").Count(&count)
		if count != 1 {
			t.Fatalf("pesan pemilik tidak tersimpan (count=%d)", count)
		}
	})
}

// ---------------------------------------------------------------------------
// ServeAttachment — IDOR lampiran + path traversal
// ---------------------------------------------------------------------------

// c.SendFile menahan handle berkas sampai proses tes keluar, jadi direktori
// tidak bisa dihapus saat cleanup di Windows (RemoveAll gagal walau di-retry).
// Karena itu direktori dibuat sekali per proses dan sisa proses sebelumnya
// disapu di awal — saat itu handle-nya sudah pasti lepas.
var (
	attachmentRootOnce sync.Once
	attachmentRootDir  string
)

func attachmentRoot(t *testing.T) string {
	t.Helper()
	attachmentRootOnce.Do(func() {
		stale, _ := filepath.Glob(filepath.Join(os.TempDir(), "catavor-attachment-*"))
		for _, d := range stale {
			_ = os.RemoveAll(d)
		}
		dir, err := os.MkdirTemp("", "catavor-attachment-")
		if err != nil {
			t.Fatalf("mkdir temp: %v", err)
		}
		attachmentRootDir = dir
	})
	if attachmentRootDir == "" {
		t.Fatal("direktori lampiran gagal dibuat")
	}
	return attachmentRootDir
}

func TestSupportServeAttachment_SQLite(t *testing.T) {
	root := attachmentRoot(t)
	cfg := testCfg()
	cfg.StorageLocalRoot = root

	// Berkas sah di dalam root penyimpanan.
	if err := os.MkdirAll(filepath.Join(root, "support"), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	sahPath := filepath.Join(root, "support", "bukti.png")
	if err := os.WriteFile(sahPath, []byte("PNGDATA"), 0o644); err != nil {
		t.Fatalf("tulis berkas: %v", err)
	}
	// Berkas rahasia di LUAR root — target path traversal.
	luar := filepath.Join(filepath.Dir(root), "rahasia-server.txt")
	if err := os.WriteFile(luar, []byte("TOPSECRET"), 0o644); err != nil {
		t.Fatalf("tulis berkas luar: %v", err)
	}
	t.Cleanup(func() { os.Remove(luar) })

	db := supportDB(t)
	app := supportApp(t, db, cfg)

	tiketSendiri := seedTicket(t, db, 10, "TCK-20261019-0201", "Tiket Sendiri", "open")
	tiketOrang := seedTicket(t, db, 11, "TCK-20261019-0202", "Tiket Orang Lain", "open")

	msgSendiri := models.SupportMessage{TicketID: tiketSendiri.ID, SenderID: 10, SenderType: "user",
		Message: "lampiran saya", CreatedAt: time.Now().UTC()}
	db.Create(&msgSendiri)
	msgOrang := models.SupportMessage{TicketID: tiketOrang.ID, SenderID: 11, SenderType: "user",
		Message: "lampiran orang", CreatedAt: time.Now().UTC()}
	db.Create(&msgOrang)

	attSendiri := models.SupportAttachment{MessageID: msgSendiri.ID, FileURL: "/storage/support/bukti.png",
		StorageKey: "support/bukti.png", FileName: "bukti.png", FileType: "image/png"}
	db.Create(&attSendiri)

	attTraversal := models.SupportAttachment{MessageID: msgSendiri.ID, FileURL: "/storage/../rahasia-server.txt",
		StorageKey: "../rahasia-server.txt", FileName: "rahasia-server.txt", FileType: "text/plain"}
	db.Create(&attTraversal)

	t.Run("tanpa_sesi_401", func(t *testing.T) {
		code, _, _ := supportReq(t, app, "GET", "/attachments/"+itoa(attSendiri.ID), "", "")
		if code != 401 {
			t.Fatalf("status = %d, want 401", code)
		}
	})

	t.Run("id_tidak_ada_404", func(t *testing.T) {
		code, _, _ := supportReq(t, app, "GET", "/attachments/999999", "", "pemilik")
		if code != 404 {
			t.Fatalf("status = %d, want 404", code)
		}
	})

	t.Run("pemilik_bisa_unduh", func(t *testing.T) {
		code, _, raw := supportReq(t, app, "GET", "/attachments/"+itoa(attSendiri.ID), "", "pemilik")
		if code != 200 {
			t.Fatalf("status = %d, want 200", code)
		}
		if string(raw) != "PNGDATA" {
			t.Fatalf("isi berkas = %q, want PNGDATA", string(raw))
		}
	})

	t.Run("bukan_pemilik_403", func(t *testing.T) {
		code, _, raw := supportReq(t, app, "GET", "/attachments/"+itoa(attSendiri.ID), "", "penyusup")
		if code != 403 {
			t.Fatalf("status = %d, want 403", code)
		}
		if strings.Contains(string(raw), "PNGDATA") {
			t.Fatal("isi berkas bocor ke akun lain walau status 403")
		}
	})

	t.Run("staf_bisa_unduh", func(t *testing.T) {
		code, _, _ := supportReq(t, app, "GET", "/attachments/"+itoa(attSendiri.ID), "", "staf")
		if code != 200 {
			t.Fatalf("status = %d, want 200 (staf perlu akses untuk menangani tiket)", code)
		}
	})

	t.Run("path_traversal_ditolak", func(t *testing.T) {
		code, _, raw := supportReq(t, app, "GET", "/attachments/"+itoa(attTraversal.ID), "", "pemilik")
		if strings.Contains(string(raw), "TOPSECRET") {
			t.Fatalf("storage_key '../' membaca berkas di luar StorageLocalRoot (status %d)", code)
		}
		if code == 200 {
			t.Fatalf("status = %d, want bukan 200 untuk berkas di luar root", code)
		}
	})

	t.Run("wildcard_tidak_mencocokkan_lampiran_lain", func(t *testing.T) {
		// L1: id "%" tidak boleh menjadi wildcard LIKE yang mencocokkan lampiran
		// milik tiket orang lain.
		code, _, raw := supportReq(t, app, "GET", "/attachments/%25", "", "penyusup")
		if code == 200 && strings.Contains(string(raw), "PNGDATA") {
			t.Fatal("wildcard '%' mencocokkan lampiran milik akun lain")
		}
	})

	t.Run("lampiran_pdf_forced_attachment_dan_csp_sandbox", func(t *testing.T) {
		pdfPath := filepath.Join(root, "support", "tiket-dokumen.pdf")
		if err := os.WriteFile(pdfPath, []byte("%PDF-1.4\nPDFCONTENT"), 0o644); err != nil {
			t.Fatalf("tulis berkas pdf: %v", err)
		}
		attPDF := models.SupportAttachment{
			MessageID:  msgSendiri.ID,
			FileURL:    "/storage/support/tiket-dokumen.pdf",
			StorageKey: "support/tiket-dokumen.pdf",
			FileName:   "tiket-dokumen.pdf",
			FileType:   "application/pdf",
		}
		db.Create(&attPDF)

		req := httptest.NewRequest("GET", "/attachments/"+itoa(attPDF.ID), nil)
		req.Header.Set("X-Test-Actor", "pemilik")
		resp, err := app.Test(req, -1)
		if err != nil {
			t.Fatalf("app.Test: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != 200 {
			t.Fatalf("status = %d, want 200", resp.StatusCode)
		}
		cd := resp.Header.Get("Content-Disposition")
		if !strings.HasPrefix(cd, "attachment") {
			t.Errorf("Content-Disposition = %q, want attachment prefix", cd)
		}
		csp := resp.Header.Get("Content-Security-Policy")
		if csp != "sandbox; default-src 'none'" {
			t.Errorf("Content-Security-Policy = %q, want 'sandbox; default-src \\'none\\''", csp)
		}
	})
}

// ---------------------------------------------------------------------------
// Cloud Storage (Cloudflare R2 / S3) Proxy Streaming Tests
// ---------------------------------------------------------------------------

type mockCloudStorage struct {
	files map[string][]byte
}

func (m *mockCloudStorage) Upload(ctx context.Context, key string, r io.Reader, size int64, contentType string) (string, error) {
	return "", nil
}
func (m *mockCloudStorage) Delete(ctx context.Context, key string) error { return nil }
func (m *mockCloudStorage) DeletePrefix(ctx context.Context, prefix string) error { return nil }
func (m *mockCloudStorage) GetURL(key string) string { return "" }
func (m *mockCloudStorage) GetDriverName() string { return "r2" }
func (m *mockCloudStorage) Get(ctx context.Context, key string) (io.ReadCloser, string, int64, error) {
	cleanKey := strings.TrimLeft(filepath.ToSlash(key), "/")
	data, ok := m.files[cleanKey]
	if !ok {
		return nil, "", 0, fmt.Errorf("object not found: %s", key)
	}
	cType := "image/png"
	if strings.HasSuffix(cleanKey, ".pdf") {
		cType = "application/pdf"
	}
	return io.NopCloser(bytes.NewReader(data)), cType, int64(len(data)), nil
}
func (m *mockCloudStorage) GetPresignedURL(ctx context.Context, key string, expiry time.Duration) (string, error) {
	return "", nil
}

func TestSupportServeAttachment_CloudStorageDriver(t *testing.T) {
	cfg := testCfg()
	// Kosongkan root lokal untuk memastikan berkas HANYA bisa diambil dari cloud storage driver
	cfg.StorageLocalRoot = ""
	cfg.StoragePrivateRoot = ""

	mockS3 := &mockCloudStorage{
		files: map[string][]byte{
			"private/support/tickets/2026/11/cloud-screenshot.png": []byte("CLOUD_IMAGE_BYTES_OK"),
			"private/support/tickets/2026/11/rekening-koran.pdf":    []byte("%PDF-1.4 CLOUD_PDF_BYTES_OK"),
		},
	}

	db := supportDB(t)
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	h := NewSupportHandler(cfg, mockS3, db)

	actor := func(c *fiber.Ctx) error {
		switch c.Get("X-Test-Actor") {
		case "pemilik":
			c.Locals("user", &models.User{ID: 10, Name: "Pemilik", Email: "pemilik@example.com", PlatformRole: "merchant"})
		case "penyusup":
			c.Locals("user", &models.User{ID: 99, Name: "Penyusup", Email: "hacker@example.com", PlatformRole: "merchant"})
		case "staf":
			c.Locals("user", &models.User{ID: 2, Name: "Staf", Email: "support@catavor.id", PlatformRole: "support"})
		}
		return c.Next()
	}
	app.Get("/attachments/:id", actor, h.ServeAttachment)

	tiket := seedTicket(t, db, 10, "TCK-20261102-1001", "Tiket Bantuan Cloud", "open")
	msg := models.SupportMessage{TicketID: tiket.ID, SenderID: 10, SenderType: "user", Message: "Mohon cek bukti cloud", CreatedAt: time.Now().UTC()}
	db.Create(&msg)

	attImg := models.SupportAttachment{
		MessageID:  msg.ID,
		FileURL:    "",
		StorageKey: "private/support/tickets/2026/11/cloud-screenshot.png",
		FileName:   "cloud-screenshot.png",
		FileType:   "image/png",
	}
	db.Create(&attImg)

	attPdf := models.SupportAttachment{
		MessageID:  msg.ID,
		FileURL:    "",
		StorageKey: "private/support/tickets/2026/11/rekening-koran.pdf",
		FileName:   "rekening-koran.pdf",
		FileType:   "application/pdf",
	}
	db.Create(&attPdf)

	t.Run("pemilik_bisa_preview_gambar_dari_cloud_r2", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/attachments/"+itoa(attImg.ID), nil)
		req.Header.Set("X-Test-Actor", "pemilik")
		res, err := app.Test(req)
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		defer res.Body.Close()
		body, _ := io.ReadAll(res.Body)

		if res.StatusCode != 200 {
			t.Fatalf("status = %d, want 200 (body: %s)", res.StatusCode, string(body))
		}
		if string(body) != "CLOUD_IMAGE_BYTES_OK" {
			t.Fatalf("isi body = %q, want CLOUD_IMAGE_BYTES_OK", string(body))
		}
		if cType := res.Header.Get("Content-Type"); !strings.Contains(cType, "image/png") {
			t.Errorf("Content-Type = %q, want image/png", cType)
		}
		if disp := res.Header.Get("Content-Disposition"); !strings.Contains(disp, "inline") {
			t.Errorf("Content-Disposition = %q, want inline for in-app image preview", disp)
		}
		if cc := res.Header.Get("Cache-Control"); !strings.Contains(cc, "no-store") {
			t.Errorf("Cache-Control = %q, want private, no-store for UU PDP compliance", cc)
		}
	})

	t.Run("pemilik_bisa_preview_pdf_dari_cloud_r2", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/attachments/"+itoa(attPdf.ID), nil)
		req.Header.Set("X-Test-Actor", "pemilik")
		res, err := app.Test(req)
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		defer res.Body.Close()
		body, _ := io.ReadAll(res.Body)

		if res.StatusCode != 200 {
			t.Fatalf("status = %d, want 200 (body: %s)", res.StatusCode, string(body))
		}
		if !strings.Contains(string(body), "CLOUD_PDF_BYTES_OK") {
			t.Fatalf("isi body = %q, want CLOUD_PDF_BYTES_OK", string(body))
		}
		if cType := res.Header.Get("Content-Type"); !strings.Contains(cType, "application/pdf") {
			t.Errorf("Content-Type = %q, want application/pdf", cType)
		}
		if disp := res.Header.Get("Content-Disposition"); !strings.Contains(disp, "attachment") {
			t.Errorf("Content-Disposition = %q, want attachment for PDF security (N-47)", disp)
		}
		if csp := res.Header.Get("Content-Security-Policy"); csp != "sandbox; default-src 'none'" {
			t.Errorf("Content-Security-Policy = %q, want sandbox CSP for PDF (N-47)", csp)
		}
	})

	t.Run("download_query_param_mengubah_disposition_ke_attachment", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/attachments/"+itoa(attPdf.ID)+"?download=1", nil)
		req.Header.Set("X-Test-Actor", "pemilik")
		res, err := app.Test(req)
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		defer res.Body.Close()
		if disp := res.Header.Get("Content-Disposition"); !strings.Contains(disp, "attachment") {
			t.Errorf("Content-Disposition = %q, want attachment for download", disp)
		}
	})

	t.Run("anti_idor_penyusup_ditolak_403", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/attachments/"+itoa(attImg.ID), nil)
		req.Header.Set("X-Test-Actor", "penyusup")
		res, err := app.Test(req)
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		defer res.Body.Close()
		if res.StatusCode != 403 {
			t.Fatalf("status = %d, want 403 Forbidden", res.StatusCode)
		}
	})

	t.Run("staf_bisa_akses_lampiran_merchant", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/attachments/"+itoa(attImg.ID), nil)
		req.Header.Set("X-Test-Actor", "staf")
		res, err := app.Test(req)
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		defer res.Body.Close()
		if res.StatusCode != 200 {
			t.Fatalf("status = %d, want 200 OK for staff", res.StatusCode)
		}
	})
}

func TestSupportReplyAsAdmin_Transaction(t *testing.T) {
	db := supportDB(t)
	cfg := testCfg()
	app := supportApp(t, db, cfg)

	ownerUser := models.User{ID: 10, Name: "Pemilik", Email: "pemilik@example.com"}
	_ = db.Create(&ownerUser)

	ticket := models.SupportTicket{
		UserID:        10,
		TicketNumber:  "TCK-ADMIN-REPLY-001",
		Subject:       "Kendala Pembayaran",
		Category:      "billing",
		Priority:      "normal",
		Status:        "open",
		CreatedAt:     time.Now().UTC(),
		UpdatedAt:     time.Now().UTC(),
		LastMessageAt: time.Now().UTC(),
	}
	if err := db.Create(&ticket).Error; err != nil {
		t.Fatalf("seed ticket: %v", err)
	}

	replyPayload := `{"message":"Halo, kendala sudah kami cek dan transaksi sudah diverifikasi.","is_internal_note":false}`
	code, body, _ := supportReq(t, app, "POST", "/admin/tickets/"+ticket.TicketNumber+"/reply", replyPayload, "staf")
	if code != 201 {
		t.Fatalf("status = %d, want 201 (body %v)", code, body)
	}

	// Verify message was created
	var msgCount int64
	db.Model(&models.SupportMessage{}).Where("ticket_id = ? AND sender_type = 'agent'", ticket.ID).Count(&msgCount)
	if msgCount != 1 {
		t.Errorf("agent message count = %d, want 1", msgCount)
	}

	// Verify ticket status updated to waiting_user
	var updatedTicket models.SupportTicket
	if err := db.First(&updatedTicket, ticket.ID).Error; err != nil {
		t.Fatalf("reload ticket: %v", err)
	}
	if updatedTicket.Status != "waiting_user" {
		t.Errorf("ticket status = %q, want 'waiting_user'", updatedTicket.Status)
	}
	if updatedTicket.FirstResponseAt == nil {
		t.Errorf("ticket.FirstResponseAt is nil, want timestamp")
	}

	// Verify merchant in-app notification was created
	var notifCount int64
	db.Model(&models.Notification{}).Where("target_id = ? AND type = 'ticket'", ownerUser.ID).Count(&notifCount)
	if notifCount != 1 {
		t.Errorf("merchant notification count = %d, want 1", notifCount)
	}
}

func TestSupportTicket_AttachmentValidation_N65(t *testing.T) {
	cfg := &config.Config{
		StoragePrivateRoot: t.TempDir(),
		StorageLocalRoot:   t.TempDir(),
	}
	db := supportDB(t)
	app := supportApp(t, db, cfg)

	t.Run("create_ticket_rejects_billing_namespace", func(t *testing.T) {
		payload := `{
			"subject": "Kendala IDOR Billing",
			"category": "technical",
			"priority": "medium",
			"message": "Mohon cek bukti pembayaran ini",
			"attachments": [
				{"storage_key": "private/billing/users/1/secret.jpg", "file_name": "secret.jpg"}
			]
		}`
		code, body, _ := supportReq(t, app, "POST", "/tickets", payload, "pemilik")
		if code != 400 {
			t.Fatalf("status = %d, want 400 (body %v)", code, body)
		}
		msg, _ := body["message"].(string)
		if !strings.Contains(strings.ToLower(msg), "lampiran") {
			t.Errorf("expected error message to mention lampiran, got: %v", msg)
		}
	})

	t.Run("create_ticket_rejects_path_traversal", func(t *testing.T) {
		payload := `{
			"subject": "Kendala Traversal",
			"category": "technical",
			"priority": "medium",
			"message": "Traversal test",
			"attachments": [
				{"storage_key": "private/support/tickets/../../billing/users/1/secret.jpg", "file_name": "secret.jpg"}
			]
		}`
		code, body, _ := supportReq(t, app, "POST", "/tickets", payload, "pemilik")
		if code != 400 {
			t.Fatalf("status = %d, want 400 (body %v)", code, body)
		}
	})

	t.Run("create_ticket_rejects_stores_namespace", func(t *testing.T) {
		payload := `{
			"subject": "Kendala Store Media",
			"category": "technical",
			"priority": "medium",
			"message": "Store media test",
			"attachments": [
				{"storage_key": "stores/1/products/2026/secret.jpg", "file_name": "secret.jpg"}
			]
		}`
		code, body, _ := supportReq(t, app, "POST", "/tickets", payload, "pemilik")
		if code != 400 {
			t.Fatalf("status = %d, want 400 (body %v)", code, body)
		}
	})

	t.Run("create_ticket_allows_valid_support_key", func(t *testing.T) {
		payload := `{
			"subject": "Kendala Valid",
			"category": "technical",
			"priority": "medium",
			"message": "Kendala normal dengan attachment sah",
			"attachments": [
				{"storage_key": "private/support/tickets/2026/11/valid.jpg", "file_name": "valid.jpg"}
			]
		}`
		code, body, _ := supportReq(t, app, "POST", "/tickets", payload, "pemilik")
		if code != 201 && code != 200 {
			t.Fatalf("status = %d, want 200 or 201 (body %v)", code, body)
		}
	})

	t.Run("reply_ticket_rejects_billing_namespace", func(t *testing.T) {
		ticket := seedTicket(t, db, 10, "TCK-REPLY-N65-001", "Tiket Reply N65", "open")
		payload := `{
			"message": "Balasan dengan lampiran billing",
			"attachments": [
				{"storage_key": "private/billing/users/99/invoice.pdf", "file_name": "invoice.pdf"}
			]
		}`
		code, body, _ := supportReq(t, app, "POST", "/tickets/"+ticket.TicketNumber+"/reply", payload, "pemilik")
		if code != 400 {
			t.Fatalf("status = %d, want 400 (body %v)", code, body)
		}
	})

	t.Run("reply_ticket_allows_valid_support_key", func(t *testing.T) {
		ticket := seedTicket(t, db, 10, "TCK-REPLY-N65-002", "Tiket Reply N65 Valid", "open")
		payload := `{
			"message": "Balasan dengan lampiran support sah",
			"attachments": [
				{"storage_key": "private/support/tickets/2026/11/valid_reply.jpg", "file_name": "valid_reply.jpg"}
			]
		}`
		code, body, _ := supportReq(t, app, "POST", "/tickets/"+ticket.TicketNumber+"/reply", payload, "pemilik")
		if code != 200 && code != 201 {
			t.Fatalf("status = %d, want 200 or 201 (body %v)", code, body)
		}
	})
}

func TestSupportServeAttachment_LegacyMigrationFallback(t *testing.T) {
	// Gunakan attachmentRoot(t) agar tahan terhadap file lock Windows pada c.SendFile dan mandiri di CI (Temuan Baru C)
	privRoot := filepath.Join(attachmentRoot(t), "priv_legacy_test")

	cfg := &config.Config{
		StoragePrivateRoot: privRoot,
		StorageLocalRoot:   t.TempDir(),
	}
	db := supportDB(t)
	app := supportApp(t, db, cfg)

	ownerID := uint(10)
	ticket := seedTicket(t, db, ownerID, "TCK-LEGACY-001", "Tiket Legacy", "open")
	msg := models.SupportMessage{
		TicketID:   ticket.ID,
		SenderID:   ownerID,
		SenderType: "user",
		Message:    "lampiran legacy saya",
		CreatedAt:  time.Now().UTC(),
	}
	db.Create(&msg)

	legacyCases := []struct {
		storeID      string
		relPath      string
		fileName     string
		wantType     string
		dummyContent []byte
	}{
		{
			storeID:      "1",
			relPath:      "stores/1/support/2026/09/308115f4-ab39-4973-8b2a-7ed35c3c54f9.jpg",
			fileName:     "308115f4-ab39-4973-8b2a-7ed35c3c54f9.jpg",
			wantType:     "image/jpeg",
			dummyContent: []byte("\xFF\xD8\xFF\xE0\x00\x10JFIF"),
		},
		{
			storeID:      "5",
			relPath:      "stores/5/support/2026/10/95d467ac-e995-47b9-8b07-69ff18c21955.pdf",
			fileName:     "95d467ac-e995-47b9-8b07-69ff18c21955.pdf",
			wantType:     "application/pdf",
			dummyContent: []byte("%PDF-1.4\n%synthetic test pdf"),
		},
		{
			storeID:      "15",
			relPath:      "stores/15/support/2026/10/27500830-9972-4dc4-92cb-b94917b30446.jpg",
			fileName:     "27500830-9972-4dc4-92cb-b94917b30446.jpg",
			wantType:     "image/jpeg",
			dummyContent: []byte("\xFF\xD8\xFF\xE0\x00\x10JFIF"),
		},
	}

	for _, tc := range legacyCases {
		t.Run("store_"+tc.storeID, func(t *testing.T) {
			// Buat berkas dummy di privRoot/support/legacy/<tc.relPath>
			fullTarget := filepath.Join(privRoot, "support", "legacy", filepath.FromSlash(tc.relPath))
			if err := os.MkdirAll(filepath.Dir(fullTarget), 0755); err != nil {
				t.Fatalf("mkdir failed: %v", err)
			}
			if err := os.WriteFile(fullTarget, tc.dummyContent, 0644); err != nil {
				t.Fatalf("write file failed: %v", err)
			}

			att := models.SupportAttachment{
				MessageID:  msg.ID,
				StorageKey: tc.relPath,
				FileName:   tc.fileName,
				FileType:   tc.wantType,
			}
			db.Create(&att)

			code, _, raw := supportReq(t, app, "GET", "/attachments/"+itoa(att.ID), "", "pemilik")
			if code != 200 {
				t.Fatalf("ServeAttachment store %s: status = %d, want 200", tc.storeID, code)
			}
			if len(raw) == 0 {
				t.Fatalf("ServeAttachment store %s: body empty, want file contents", tc.storeID)
			}
		})
	}
}

func makeValid1x1PNG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	img.Set(0, 0, color.RGBA{R: 12, G: 34, B: 56, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}
	return buf.Bytes()
}

type recordingUploadStorage struct {
	uploadedKeys []string
}

func (r *recordingUploadStorage) Upload(ctx context.Context, key string, rd io.Reader, size int64, contentType string) (string, error) {
	_, _ = io.ReadAll(rd)
	r.uploadedKeys = append(r.uploadedKeys, key)
	return "", nil
}
func (r *recordingUploadStorage) Delete(ctx context.Context, key string) error            { return nil }
func (r *recordingUploadStorage) DeletePrefix(ctx context.Context, prefix string) error   { return nil }
func (r *recordingUploadStorage) GetURL(key string) string                                { return "" }
func (r *recordingUploadStorage) GetDriverName() string                                   { return "r2" }
func (r *recordingUploadStorage) Get(ctx context.Context, key string) (io.ReadCloser, string, int64, error) {
	return nil, "", 0, fmt.Errorf("not implemented")
}
func (r *recordingUploadStorage) GetPresignedURL(ctx context.Context, key string, expiry time.Duration) (string, error) {
	return "", nil
}

func TestSupportReplyAsAdmin_InternalNoteNoMerchantSSELeak(t *testing.T) {
	db := supportDB(t)
	cfg := testCfg()
	app := supportApp(t, db, cfg)

	ownerUser := models.User{ID: 10, Name: "Pemilik", Email: "pemilik@example.com"}
	_ = db.Create(&ownerUser)

	initialMsgTime := time.Now().UTC().Add(-2 * time.Hour).Truncate(time.Second)
	ticket := models.SupportTicket{
		UserID:        10,
		TicketNumber:  "TCK-SSE-NOTE-001",
		Subject:       "Uji Kebocoran SSE Internal Note",
		Category:      "technical",
		Priority:      "medium",
		Status:        "waiting_user",
		CreatedAt:     initialMsgTime,
		UpdatedAt:     initialMsgTime,
		LastMessageAt: initialMsgTime,
	}
	if err := db.Create(&ticket).Error; err != nil {
		t.Fatalf("seed ticket: %v", err)
	}

	hub := services.GetNotificationHub()
	merchantClient := hub.Register(10, 0, "pro", "")
	staffClient := hub.Register(1, 0, "", "support")
	defer hub.Unregister(merchantClient)
	defer hub.Unregister(staffClient)

	code, body, _ := supportReq(t, app, "POST", "/admin/tickets/"+ticket.TicketNumber+"/reply",
		`{"message":"RAHASIA_INTERNAL_TIDAK_BOLEH_BOCOR","is_internal_note":true}`, "staf")
	if code != 201 {
		t.Fatalf("status = %d, want 201 (body %v)", code, body)
	}

	// Goroutine BroadcastTicketEvent berjalan asinkron; tunggu singkat lalu drain channel.
	time.Sleep(80 * time.Millisecond)

	select {
	case payload := <-merchantClient.Send:
		if strings.Contains(string(payload), "RAHASIA_INTERNAL_TIDAK_BOLEH_BOCOR") || strings.Contains(string(payload), "ticket_reply_from_staff") {
			t.Fatalf("merchant menerima event SSE untuk catatan internal: %s", string(payload))
		}
		t.Fatalf("merchant tidak boleh menerima event SSE apa pun dari catatan internal, dapat: %s", string(payload))
	default:
	}

	select {
	case payload := <-staffClient.Send:
		if !strings.Contains(string(payload), "ticket_internal_note_added") {
			t.Errorf("staf mengharapkan ticket_internal_note_added, dapat: %s", string(payload))
		}
		if strings.Contains(string(payload), "RAHASIA_INTERNAL_TIDAK_BOLEH_BOCOR") {
			t.Errorf("event internal note seharusnya hanya mengirim sinyal metadata")
		}
	default:
		t.Errorf("staf tidak menerima sinyal SSE ticket_internal_note_added")
	}

	var reloaded models.SupportTicket
	if err := db.First(&reloaded, ticket.ID).Error; err != nil {
		t.Fatalf("reload ticket: %v", err)
	}
	if !reloaded.LastMessageAt.Equal(initialMsgTime) {
		t.Errorf("LastMessageAt ikut berubah akibat internal note: got %v want %v", reloaded.LastMessageAt, initialMsgTime)
	}
}

func TestAdminSupportUpload_StorelessStaffAllowedAndScoped(t *testing.T) {
	db := supportDB(t)
	cfg := testCfg()
	rec := &recordingUploadStorage{}
	sh := NewStorageHandler(cfg, rec, db)

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Post("/admin/support/upload", func(c *fiber.Ctx) error {
		switch c.Get("X-Test-Actor") {
		case "support":
			c.Locals("user", &models.User{ID: 1, Name: "Agen", Email: "agen@example.com", PlatformRole: "support"})
		case "finance":
			c.Locals("user", &models.User{ID: 2, Name: "Keuangan", Email: "finance@example.com", PlatformRole: "finance"})
		}
		return c.Next()
	}, middleware.RequirePermission(cfg, "support:tickets:reply"), sh.Upload)

	makeUploadReq := func(actor string) (int, map[string]any) {
		var body bytes.Buffer
		w := multipart.NewWriter(&body)
		part, err := w.CreateFormFile("image", "bukti-staf.png")
		if err != nil {
			t.Fatalf("create form file: %v", err)
		}
		_, _ = part.Write(makeValid1x1PNG(t))
		_ = w.Close()

		req := httptest.NewRequest("POST", "/admin/support/upload?category=support", &body)
		req.Header.Set("Content-Type", w.FormDataContentType())
		req.Header.Set("X-Test-Actor", actor)
		resp, err := app.Test(req, -1)
		if err != nil {
			t.Fatalf("app.Test: %v", err)
		}
		defer resp.Body.Close()
		raw, _ := io.ReadAll(resp.Body)
		out := map[string]any{}
		_ = json.Unmarshal(raw, &out)
		return resp.StatusCode, out
	}

	code, body := makeUploadReq("support")
	if code != 200 {
		t.Fatalf("staf support tanpa toko upload status = %d, want 200 (body %v)", code, body)
	}
	key, _ := body["storage_key"].(string)
	if !strings.HasPrefix(key, "private/support/staff/") {
		t.Errorf("storage_key = %q, want prefix private/support/staff/", key)
	}

	codeDenied, _ := makeUploadReq("finance")
	if codeDenied != 403 {
		t.Fatalf("staf tanpa izin support:tickets:reply status = %d, want 403", codeDenied)
	}
}

func TestStoreOwnershipMiddleware_SupportAppealExemptions(t *testing.T) {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Use(func(c *fiber.Ctx) error {
		switch c.Get("X-Test-Actor") {
		case "banned_merchant":
			c.Locals("user", &models.User{
				ID:           20,
				PlatformRole: "",
				Stores: []models.Store{
					{ID: 55, UserID: 20, Slug: "toko-banned", DormancyStatus: "banned", IsBlacklisted: true},
				},
			})
		case "storeless_user":
			c.Locals("user", &models.User{ID: 21, PlatformRole: ""})
		case "storeless_staff":
			c.Locals("user", &models.User{ID: 22, PlatformRole: "support"})
		}
		return c.Next()
	}, middleware.StoreOwnerRequired())

	okHandler := func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	}
	app.Post("/api/support/tickets", okHandler)
	app.Post("/api/storage/upload", okHandler)
	app.Post("/api/products", okHandler)

	run := func(actor, path, slug string) int {
		req := httptest.NewRequest("POST", path, strings.NewReader(`{}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Test-Actor", actor)
		if slug != "" {
			req.Header.Set("X-Store-Slug", slug)
		}
		resp, err := app.Test(req, -1)
		if err != nil {
			t.Fatalf("%s %s: %v", actor, path, err)
		}
		_ = resp.Body.Close()
		return resp.StatusCode
	}

	if got := run("banned_merchant", "/api/support/tickets", "toko-banned"); got != 200 {
		t.Errorf("banned_merchant POST /api/support/tickets = %d, want 200", got)
	}
	if got := run("banned_merchant", "/api/storage/upload?category=support", "toko-banned"); got != 200 {
		t.Errorf("banned_merchant POST /api/storage/upload?category=support = %d, want 200", got)
	}
	if got := run("banned_merchant", "/api/products", "toko-banned"); got != 403 {
		t.Errorf("banned_merchant POST /api/products = %d, want 403", got)
	}
	if got := run("storeless_user", "/api/support/tickets", ""); got != 200 {
		t.Errorf("storeless_user POST /api/support/tickets = %d, want 200", got)
	}
	if got := run("storeless_user", "/api/support/tickets", "toko-banned"); got != 403 {
		t.Errorf("storeless_user IDOR X-Store-Slug POST /api/support/tickets = %d, want 403", got)
	}
	if got := run("storeless_user", "/api/products", ""); got != 403 {
		t.Errorf("storeless_user POST /api/products = %d, want 403", got)
	}
	if got := run("storeless_staff", "/api/products", ""); got != 403 {
		t.Errorf("storeless_staff POST /api/products = %d, want 403", got)
	}
}

func TestSupportP1_GetTicketDetailsAndMarkRead_NoStatusMutation(t *testing.T) {
	db := supportDB(t)
	h := NewSupportHandler(testCfg(), nil, db)
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	actor := func(c *fiber.Ctx) error {
		c.Locals("user", &models.User{ID: 10, Name: "Pemilik", Email: "pemilik@example.com", PlatformRole: "merchant"})
		return c.Next()
	}
	app.Get("/tickets/:id", actor, h.GetTicketDetails)
	app.Post("/tickets/:id/mark-read", actor, h.MarkTicketAsRead)

	ticket := seedTicket(t, db, 10, "TCK-P1-GET-001", "Cek Side Effect GET", "waiting_user")
	agentMsg := models.SupportMessage{
		TicketID:   ticket.ID,
		SenderID:   1,
		SenderType: "agent",
		Message:    "Mohon konfirmasi kendala Anda.",
		CreatedAt:  time.Now().UTC(),
	}
	if err := db.Create(&agentMsg).Error; err != nil {
		t.Fatalf("seed agent msg: %v", err)
	}

	// 1. GET /tickets/:id tidak boleh memutasi read_at maupun status waiting_user -> in_progress
	code, _, _ := supportReq(t, app, "GET", "/tickets/"+ticket.TicketNumber, "", "pemilik")
	if code != 200 {
		t.Fatalf("GET status = %d, want 200", code)
	}
	var afterGetTicket models.SupportTicket
	_ = db.First(&afterGetTicket, ticket.ID)
	if afterGetTicket.Status != "waiting_user" {
		t.Fatalf("GET memutasi status menjadi %q, want waiting_user", afterGetTicket.Status)
	}
	var afterGetMsg models.SupportMessage
	_ = db.First(&afterGetMsg, agentMsg.ID)
	if afterGetMsg.ReadAt != nil {
		t.Fatalf("GET memutasi read_at menjadi non-nil (%v)", afterGetMsg.ReadAt)
	}

	// 2. POST /tickets/:id/mark-read memperbarui read_at, TETAP menjaga status waiting_user
	code, _, _ = supportReq(t, app, "POST", "/tickets/"+ticket.TicketNumber+"/mark-read", "", "pemilik")
	if code != 200 {
		t.Fatalf("mark-read status = %d, want 200", code)
	}
	_ = db.First(&afterGetTicket, ticket.ID)
	if afterGetTicket.Status != "waiting_user" {
		t.Fatalf("mark-read memutasi status menjadi %q, want waiting_user", afterGetTicket.Status)
	}
	_ = db.First(&afterGetMsg, agentMsg.ID)
	if afterGetMsg.ReadAt == nil {
		t.Fatal("mark-read tidak mengisi read_at pesan agen")
	}
}

func TestSupportP1_ListAllTickets_ExcludesInternalNoteFromPreview(t *testing.T) {
	db := supportDB(t)
	h := NewSupportHandler(testCfg(), nil, db)
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Get("/admin/tickets", func(c *fiber.Ctx) error {
		c.Locals("user", &models.User{ID: 1, Name: "Agen", Email: "agen@example.com", PlatformRole: "support"})
		return c.Next()
	}, h.ListAllTickets)

	ticket := seedTicket(t, db, 10, "TCK-P1-LIST-001", "Cek Preview Catatan Internal", "waiting_user")
	now := time.Now().UTC()
	_ = db.Create(&models.SupportMessage{
		TicketID:       ticket.ID,
		SenderID:       10,
		SenderType:     "user",
		Message:        "PESAN_PUBLIK_MERCHANT_OK",
		IsInternalNote: false,
		CreatedAt:      now.Add(-2 * time.Minute),
	})
	_ = db.Create(&models.SupportMessage{
		TicketID:       ticket.ID,
		SenderID:       1,
		SenderType:     "agent",
		Message:        "CATATAN_RAHASIA_PREVIEW_TIDAK_BOLEH_TAMPIL",
		IsInternalNote: true,
		CreatedAt:      now.Add(-1 * time.Minute),
	})

	req := httptest.NewRequest("GET", "/admin/tickets", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		t.Fatalf("status = %d, want 200 (%s)", resp.StatusCode, string(raw))
	}
	bodyStr := string(raw)
	if strings.Contains(bodyStr, "CATATAN_RAHASIA_PREVIEW_TIDAK_BOLEH_TAMPIL") {
		t.Fatalf("ListAllTickets membocorkan catatan internal ke preview daftar: %s", bodyStr)
	}
	if !strings.Contains(bodyStr, "PESAN_PUBLIK_MERCHANT_OK") {
		t.Fatalf("ListAllTickets seharusnya menampilkan pesan publik terakhir: %s", bodyStr)
	}
}

func TestSupportP1_SSEAndPing_RBACGranular(t *testing.T) {
	hub := services.GetNotificationHub()
	financeClient := hub.Register(91, 0, "", "finance", false)
	supportClient := hub.Register(92, 0, "", "support", true)
	defer hub.Unregister(financeClient)
	defer hub.Unregister(supportClient)

	hub.BroadcastTicketEvent("ticket_created", map[string]any{"ticket_number": "TCK-RBAC-SSE"}, 10, 0, "superadmin")
	time.Sleep(30 * time.Millisecond)

	select {
	case msg := <-financeClient.Send:
		t.Fatalf("staf finance tanpa izin support:tickets:read menerima SSE tiket: %s", string(msg))
	default:
	}

	select {
	case msg := <-supportClient.Send:
		if !strings.Contains(string(msg), "TCK-RBAC-SSE") {
			t.Errorf("support client menerima payload tak terduga: %s", string(msg))
		}
	default:
		t.Fatal("support client dengan izin support:tickets:read tidak menerima SSE tiket")
	}

	db := supportDB(t)
	h := NewSupportHandler(testCfg(), nil, db)
	_ = seedTicket(t, db, 10, "TCK-PING-RBAC-001", "Tiket Terbuka", "open")

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Get("/support/tickets-ping", func(c *fiber.Ctx) error {
		switch c.Get("X-Test-Actor") {
		case "finance":
			c.Locals("user", &models.User{ID: 91, PlatformRole: "finance"})
		case "support":
			c.Locals("user", &models.User{ID: 92, PlatformRole: "support"})
		}
		return c.Next()
	}, h.GetSupportTicketsPing)

	reqFin := httptest.NewRequest("GET", "/support/tickets-ping", nil)
	reqFin.Header.Set("X-Test-Actor", "finance")
	resFin, _ := app.Test(reqFin, -1)
	defer resFin.Body.Close()
	var bodyFin map[string]any
	_ = json.NewDecoder(resFin.Body).Decode(&bodyFin)
	if cnt, _ := bodyFin["unread_count"].(float64); cnt != 0 {
		t.Errorf("finance ping unread_count = %v, want 0", cnt)
	}

	reqSup := httptest.NewRequest("GET", "/support/tickets-ping", nil)
	reqSup.Header.Set("X-Test-Actor", "support")
	resSup, _ := app.Test(reqSup, -1)
	defer resSup.Body.Close()
	var bodySup map[string]any
	_ = json.NewDecoder(resSup.Body).Decode(&bodySup)
	if cnt, _ := bodySup["unread_count"].(float64); cnt != 1 {
		t.Errorf("support ping unread_count = %v, want 1", cnt)
	}
}

func TestSupportP1_UpdateStatusEnumAndRateTicketSecurity(t *testing.T) {
	db := supportDB(t)
	h := NewSupportHandler(testCfg(), nil, db)
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	actor := func(c *fiber.Ctx) error {
		switch c.Get("X-Test-Actor") {
		case "staf":
			c.Locals("user", &models.User{ID: 1, Name: "Agen", PlatformRole: "support"})
		case "pemilik":
			c.Locals("user", &models.User{ID: 10, Name: "Pemilik", PlatformRole: "merchant"})
		}
		return c.Next()
	}
	app.Put("/admin/tickets/:id/status", actor, h.UpdateTicketStatus)
	app.Post("/tickets/:id/rating", actor, h.RateTicket)

	_ = db.Create(&models.User{ID: 10, Name: "Pemilik", Email: "pemilik@example.com"})
	ticket := seedTicket(t, db, 10, "TCK-P1-STATE-001", "Uji State & CSAT", "in_progress")
	_ = db.Create(&models.SupportMessage{
		TicketID:       ticket.ID,
		SenderID:       1,
		SenderType:     "agent",
		Message:        "Solusi telah diterapkan.",
		IsInternalNote: false,
		CreatedAt:      time.Now().UTC(),
	})

	// 1. Tolak enum status/priority ngawur -> 422
	codeInvalid, _, _ := supportReq(t, app, "PUT", "/admin/tickets/"+ticket.TicketNumber+"/status", `{"status":"ngawur"}`, "staf")
	if codeInvalid != 422 {
		t.Fatalf("status invalid code = %d, want 422", codeInvalid)
	}
	codeInvalidPrio, _, _ := supportReq(t, app, "PUT", "/admin/tickets/"+ticket.TicketNumber+"/status", `{"priority":"ultra"}`, "staf")
	if codeInvalidPrio != 422 {
		t.Fatalf("priority invalid code = %d, want 422", codeInvalidPrio)
	}

	// 2. Transisi ke resolved menciptakan system message + notifikasi in-app merchant
	codeRes, _, _ := supportReq(t, app, "PUT", "/admin/tickets/"+ticket.TicketNumber+"/status", `{"status":"resolved"}`, "staf")
	if codeRes != 200 {
		t.Fatalf("resolve status = %d, want 200", codeRes)
	}
	var notifCnt int64
	db.Model(&models.Notification{}).Where("target_id = ? AND type = ?", 10, "ticket").Count(&notifCnt)
	if notifCnt != 1 {
		t.Errorf("notif resolved count = %d, want 1", notifCnt)
	}

	// 3. RateTicket memvalidasi agent_id palsu -> fallback ke agen riil (ID 1)
	codeRate1, _, _ := supportReq(t, app, "POST", "/tickets/"+ticket.TicketNumber+"/rating", `{"rating":5,"comment":"Bagus","agent_id":999}`, "pemilik")
	if codeRate1 != 200 {
		t.Fatalf("rate1 status = %d, want 200", codeRate1)
	}
	var rated models.SupportTicket
	_ = db.First(&rated, ticket.ID)
	if rated.RatedAgentID == nil || *rated.RatedAgentID != 1 {
		t.Errorf("RatedAgentID = %v, want 1 (bukan agent_id palsu 999)", rated.RatedAgentID)
	}

	// 4. RateTicket ulang -> 409 Conflict (tidak boleh overwrite CSAT)
	codeRate2, _, _ := supportReq(t, app, "POST", "/tickets/"+ticket.TicketNumber+"/rating", `{"rating":1,"comment":"Ubah"}`, "pemilik")
	if codeRate2 != 409 {
		t.Fatalf("duplicate rate status = %d, want 409", codeRate2)
	}
}

func TestSupportP1_ServeAttachment_SVGSandboxAndMaxAttachments(t *testing.T) {
	cfg := testCfg()
	mockS3 := &mockCloudStorage{
		files: map[string][]byte{
			"private/support/tickets/2026/11/xss.svg": []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`),
		},
	}
	db := supportDB(t)
	h := NewSupportHandler(cfg, mockS3, db)
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	actor := func(c *fiber.Ctx) error {
		c.Locals("user", &models.User{ID: 10, Name: "Pemilik", PlatformRole: "merchant"})
		return c.Next()
	}
	app.Post("/tickets", actor, h.CreateTicket)
	app.Get("/attachments/:id", actor, h.ServeAttachment)

	// 1. Lebih dari 5 lampiran ditolak 400
	tooMany := `{
		"subject": "Terlalu Banyak Lampiran",
		"category": "technical",
		"priority": "medium",
		"message": "uji batas",
		"attachments": [
			{"storage_key": "private/support/tickets/2026/11/a1.png", "file_name": "a1.png"},
			{"storage_key": "private/support/tickets/2026/11/a2.png", "file_name": "a2.png"},
			{"storage_key": "private/support/tickets/2026/11/a3.png", "file_name": "a3.png"},
			{"storage_key": "private/support/tickets/2026/11/a4.png", "file_name": "a4.png"},
			{"storage_key": "private/support/tickets/2026/11/a5.png", "file_name": "a5.png"},
			{"storage_key": "private/support/tickets/2026/11/a6.png", "file_name": "a6.png"}
		]
	}`
	codeTooMany, _, _ := supportReq(t, app, "POST", "/tickets", tooMany, "pemilik")
	if codeTooMany != 400 {
		t.Fatalf("too many attachments status = %d, want 400", codeTooMany)
	}

	// 2. SVG wajib dipaksa Content-Disposition: attachment dan CSP sandbox
	tiket := seedTicket(t, db, 10, "TCK-SVG-001", "Uji SVG", "open")
	msg := models.SupportMessage{TicketID: tiket.ID, SenderID: 10, SenderType: "user", Message: "svg", CreatedAt: time.Now().UTC()}
	_ = db.Create(&msg)
	att := models.SupportAttachment{
		MessageID:  msg.ID,
		StorageKey: "private/support/tickets/2026/11/xss.svg",
		FileName:   "xss.svg",
		FileType:   "image/svg+xml",
	}
	_ = db.Create(&att)

	req := httptest.NewRequest("GET", "/attachments/"+itoa(att.ID), nil)
	res, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("svg req failed: %v", err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatalf("svg status = %d, want 200", res.StatusCode)
	}
	if disp := res.Header.Get("Content-Disposition"); !strings.Contains(disp, "attachment") {
		t.Errorf("SVG Content-Disposition = %q, want attachment (anti-XSS)", disp)
	}
	if csp := res.Header.Get("Content-Security-Policy"); csp != "sandbox; default-src 'none'" {
		t.Errorf("SVG CSP = %q, want sandbox; default-src 'none'", csp)
	}
}

func TestSupportP2_MessageCountAndTemplatesHygiene(t *testing.T) {
	db := supportDB(t)
	if err := db.AutoMigrate(&models.SupportCannedResponse{}); err != nil {
		t.Fatalf("automigrate canned responses: %v", err)
	}
	h := NewSupportHandler(&config.Config{}, nil, db)

	merchant := models.User{ID: 10, Name: "Pemilik", Email: "pemilik@catavor.local", Password: "x", PlatformRole: "merchant"}
	staff := models.User{ID: 2, Name: "Staf CS", Email: "cs@catavor.local", Password: "x", PlatformRole: "support"}
	_ = db.Create(&merchant)
	_ = db.Create(&staff)

	tiket := seedTicket(t, db, 10, "TCK-CNT-001", "Uji Hitungan Pesan", "waiting_user")
	_ = db.Create(&models.SupportMessage{TicketID: tiket.ID, SenderID: 10, SenderType: "user", Message: "Pesan merchant 1", CreatedAt: time.Now().UTC().Add(-3 * time.Minute)})
	_ = db.Create(&models.SupportMessage{TicketID: tiket.ID, SenderID: 2, SenderType: "agent", Message: "Balasan publik CS", CreatedAt: time.Now().UTC().Add(-2 * time.Minute)})
	_ = db.Create(&models.SupportMessage{TicketID: tiket.ID, SenderID: 2, SenderType: "agent", Message: "Catatan internal rahasia", IsInternalNote: true, CreatedAt: time.Now().UTC().Add(-1 * time.Minute)})

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Get("/merchant/tickets", func(c *fiber.Ctx) error {
		c.Locals("user", &merchant)
		return c.Next()
	}, h.ListMyTickets)
	app.Get("/admin/tickets", func(c *fiber.Ctx) error {
		c.Locals("user", &staff)
		return c.Next()
	}, h.ListAllTickets)
	app.Get("/admin/templates", func(c *fiber.Ctx) error {
		c.Locals("user", &staff)
		return c.Next()
	}, h.ListCannedResponses)
	app.Post("/admin/templates/reset", func(c *fiber.Ctx) error {
		c.Locals("user", &staff)
		return c.Next()
	}, h.ResetDefaultCannedResponses)

	// 1. Merchant list: message_count=2 (exclude internal note), messages len=1 (lean latest public)
	codeM, jM, _ := supportReq(t, app, "GET", "/merchant/tickets", "", "merchant")
	if codeM != 200 {
		t.Fatalf("merchant list status = %d", codeM)
	}
	rowsM, _ := jM["data"].([]interface{})
	if len(rowsM) != 1 {
		t.Fatalf("expected 1 merchant ticket, got %d", len(rowsM))
	}
	rowM := rowsM[0].(map[string]interface{})
	if got := int(rowM["message_count"].(float64)); got != 2 {
		t.Errorf("merchant message_count = %d, want 2", got)
	}
	if msgsM, _ := rowM["messages"].([]interface{}); len(msgsM) != 1 {
		t.Errorf("merchant lean preview messages len = %d, want 1", len(msgsM))
	}

	// 2. Staff list: message_count=3 (include internal note for staff overview)
	codeA, jA, _ := supportReq(t, app, "GET", "/admin/tickets", "", "staff")
	if codeA != 200 {
		t.Fatalf("admin list status = %d", codeA)
	}
	rowsA := jA["data"].([]interface{})
	rowA := rowsA[0].(map[string]interface{})
	if got := int(rowA["message_count"].(float64)); got != 3 {
		t.Errorf("admin message_count = %d, want 3", got)
	}

	// 3. ResetDefaultCannedResponses atomic restore of 7 default templates
	codeR, jR, _ := supportReq(t, app, "POST", "/admin/templates/reset", "", "staff")
	if codeR != 200 {
		t.Fatalf("reset templates status = %d", codeR)
	}
	if cnt := int(jR["count"].(float64)); cnt != 7 {
		t.Errorf("reset count = %d, want 7", cnt)
	}

	// 4. ListCannedResponses LIKE escaping: "%" and "_" should NOT match everything
	_ = db.Create(&models.SupportCannedResponse{
		Title: "Diskon 50% Promo_VIP", Shortcut: "promo_vip", Category: "billing",
		Content: "Kode 50% aktif", SortOrder: 99, IsActive: true,
	}).Error
	codeSearchPct, jPct, _ := supportReq(t, app, "GET", "/admin/templates?search=50%25", "", "staff")
	if codeSearchPct != 200 {
		t.Fatalf("template search %% status = %d", codeSearchPct)
	}
	if itemsPct, _ := jPct["data"].([]interface{}); len(itemsPct) != 1 {
		t.Errorf("expected exactly 1 literal '50%%' template match, got %d", len(itemsPct))
	}

	// 5. Long >200 char query handled cleanly without panicking / cache key bloat
	longQ := strings.Repeat("x", 240)
	codeLong, _, _ := supportReq(t, app, "GET", "/admin/templates?search="+longQ, "", "staff")
	if codeLong != 200 {
		t.Fatalf("template long query status = %d, want 200", codeLong)
	}
}

func TestSupportP3_OwnershipTransitionsIdempotencyAndKB(t *testing.T) {
	db := supportDB(t)
	if err := db.AutoMigrate(&models.HelpArticle{}, &models.SupportCannedResponse{}, &models.ActivityLog{}); err != nil {
		t.Fatalf("automigrate P3 tables: %v", err)
	}
	h := NewSupportHandler(&config.Config{}, nil, db)

	merchant := models.User{ID: 10, Name: "Pemilik", Email: "pemilik-p3@catavor.local", Password: "x", PlatformRole: "merchant"}
	staff := models.User{ID: 2, Name: "Staf CS P3", Email: "cs-p3@catavor.local", Password: "x", PlatformRole: "support"}
	otherStaff := models.User{ID: 3, Name: "Staf CS Lain", Email: "cs2-p3@catavor.local", Password: "x", PlatformRole: "support"}
	_ = db.Create(&merchant)
	_ = db.Create(&staff)
	_ = db.Create(&otherStaff)

	_ = db.Create(&models.HelpArticle{
		Category:    "billing",
		Title:       "Cara Verifikasi Pembayaran Pro",
		Slug:        "verifikasi-pembayaran-pro",
		Content:     "Gunakan bukti transfer resmi.",
		IsPublished: true,
		SortOrder:   1,
	})
	_ = db.Create(&models.HelpArticle{
		Category:    "general",
		Title:       "Diskon 25% Paket Tahunan",
		Slug:        "diskon-25-persen",
		Content:     "Hemat 25% untuk langganan tahunan.",
		IsPublished: true,
		SortOrder:   2,
	})

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	withMerchant := func(c *fiber.Ctx) error {
		c.Locals("user", &merchant)
		return c.Next()
	}
	withStaff := func(c *fiber.Ctx) error {
		c.Locals("user", &staff)
		return c.Next()
	}
	app.Post("/tickets", withMerchant, h.CreateTicket)
	app.Post("/tickets/:id/reply", withMerchant, h.ReplyTicket)
	app.Get("/admin/tickets", withStaff, h.ListAllTickets)
	app.Put("/admin/tickets/:id/assign", withStaff, h.AssignTicket)
	app.Put("/admin/tickets/:id/status", withStaff, h.UpdateTicketStatus)
	app.Get("/help/articles", h.GetHelpArticles)

	// 1. Idempotency-Key on CreateTicket prevents duplicate ticket rows
	createPayload := `{"subject":"Uji Idempotensi P3","category":"billing","priority":"medium","message":"Klik tombol dua kali"}`
	req1 := httptest.NewRequest("POST", "/tickets", strings.NewReader(createPayload))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set("Idempotency-Key", "p3-create-key-001")
	res1, err := app.Test(req1, -1)
	if err != nil {
		t.Fatalf("create1 err: %v", err)
	}
	defer res1.Body.Close()
	if res1.StatusCode != 201 {
		t.Fatalf("create1 status = %d, want 201", res1.StatusCode)
	}
	raw1, _ := io.ReadAll(res1.Body)
	var body1 map[string]any
	_ = json.Unmarshal(raw1, &body1)
	ticket1 := body1["data"].(map[string]any)
	ticketNum := ticket1["ticket_number"].(string)

	req2 := httptest.NewRequest("POST", "/tickets", strings.NewReader(createPayload))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Idempotency-Key", "p3-create-key-001")
	res2, err := app.Test(req2, -1)
	if err != nil {
		t.Fatalf("create2 err: %v", err)
	}
	defer res2.Body.Close()
	if res2.StatusCode != 201 || res2.Header.Get("X-Idempotent-Replay") != "true" {
		t.Fatalf("create2 status=%d replay=%q, want 201 and X-Idempotent-Replay=true", res2.StatusCode, res2.Header.Get("X-Idempotent-Replay"))
	}
	var ticketCount int64
	db.Model(&models.SupportTicket{}).Count(&ticketCount)
	if ticketCount != 1 {
		t.Fatalf("expected 1 ticket after idempotent replay, got %d", ticketCount)
	}

	// 2. Idempotency-Key on ReplyTicket prevents duplicate merchant messages
	replyPayload := `{"message":"Balasan idempoten"}`
	r1 := httptest.NewRequest("POST", "/tickets/"+ticketNum+"/reply", strings.NewReader(replyPayload))
	r1.Header.Set("Content-Type", "application/json")
	r1.Header.Set("Idempotency-Key", "p3-reply-key-001")
	rs1, _ := app.Test(r1, -1)
	_ = rs1.Body.Close()
	if rs1.StatusCode != 201 {
		t.Fatalf("reply1 status = %d, want 201", rs1.StatusCode)
	}
	r2 := httptest.NewRequest("POST", "/tickets/"+ticketNum+"/reply", strings.NewReader(replyPayload))
	r2.Header.Set("Content-Type", "application/json")
	r2.Header.Set("Idempotency-Key", "p3-reply-key-001")
	rs2, _ := app.Test(r2, -1)
	_ = rs2.Body.Close()
	if rs2.StatusCode != 201 || rs2.Header.Get("X-Idempotent-Replay") != "true" {
		t.Fatalf("reply2 status=%d replay=%q, want 201 + replay header", rs2.StatusCode, rs2.Header.Get("X-Idempotent-Replay"))
	}
	var userMsgCount int64
	db.Model(&models.SupportMessage{}).Where("sender_type = 'user'").Count(&userMsgCount)
	if userMsgCount != 2 {
		t.Fatalf("expected 2 user messages (1 initial + 1 unique reply), got %d", userMsgCount)
	}

	// 3. AssignTicket: reject non-staff target (422), self-claim (200), assigned=me / unassigned filters, ActivityLog
	codeBadAssign, _, _ := supportReq(t, app, "PUT", "/admin/tickets/"+ticketNum+"/assign", `{"assigned_agent_id":10}`, "staff")
	if codeBadAssign != 422 {
		t.Fatalf("assign non-staff status = %d, want 422", codeBadAssign)
	}

	codeClaim, bodyClaim, _ := supportReq(t, app, "PUT", "/admin/tickets/"+ticketNum+"/assign", `{"self":true}`, "staff")
	if codeClaim != 200 {
		t.Fatalf("self-claim status = %d, want 200 (%v)", codeClaim, bodyClaim)
	}
	claimedData := bodyClaim["data"].(map[string]any)
	if uint(claimedData["assigned_agent_id"].(float64)) != staff.ID {
		t.Fatalf("assigned_agent_id = %v, want %d", claimedData["assigned_agent_id"], staff.ID)
	}

	codeMine, bodyMine, _ := supportReq(t, app, "GET", "/admin/tickets?assigned=me", "", "staff")
	if codeMine != 200 {
		t.Fatalf("assigned=me status = %d", codeMine)
	}
	if items := bodyMine["data"].([]any); len(items) != 1 {
		t.Fatalf("assigned=me count = %d, want 1", len(items))
	}
	metrics := bodyMine["metrics"].(map[string]any)
	if int(metrics["my_assigned"].(float64)) != 1 || int(metrics["unassigned"].(float64)) != 0 {
		t.Fatalf("unexpected assignment metrics: my_assigned=%v unassigned=%v", metrics["my_assigned"], metrics["unassigned"])
	}

	codeUnassignFilter, bodyUnassignFilter, _ := supportReq(t, app, "GET", "/admin/tickets?assigned=unassigned", "", "staff")
	if codeUnassignFilter != 200 {
		t.Fatalf("assigned=unassigned status = %d", codeUnassignFilter)
	}
	if items := bodyUnassignFilter["data"].([]any); len(items) != 0 {
		t.Fatalf("assigned=unassigned count = %d, want 0", len(items))
	}

	// Unassign via null/0
	codeRelease, _, _ := supportReq(t, app, "PUT", "/admin/tickets/"+ticketNum+"/assign", `{"assigned_agent_id":0}`, "staff")
	if codeRelease != 200 {
		t.Fatalf("release assign status = %d, want 200", codeRelease)
	}

	// 4. Workflow state machine: closed -> waiting_user blocked (422), closed -> in_progress allowed (200)
	codeClose, _, _ := supportReq(t, app, "PUT", "/admin/tickets/"+ticketNum+"/status", `{"status":"closed"}`, "staff")
	if codeClose != 200 {
		t.Fatalf("close status = %d, want 200", codeClose)
	}
	codeIllegalJump, _, _ := supportReq(t, app, "PUT", "/admin/tickets/"+ticketNum+"/status", `{"status":"waiting_user"}`, "staff")
	if codeIllegalJump != 422 {
		t.Fatalf("closed -> waiting_user status = %d, want 422", codeIllegalJump)
	}
	codeReopen, _, _ := supportReq(t, app, "PUT", "/admin/tickets/"+ticketNum+"/status", `{"status":"in_progress"}`, "staff")
	if codeReopen != 200 {
		t.Fatalf("closed -> in_progress status = %d, want 200", codeReopen)
	}

	var assignLogs, updateLogs int64
	db.Model(&models.ActivityLog{}).Where("action = ?", "support.ticket_assign").Count(&assignLogs)
	db.Model(&models.ActivityLog{}).Where("action = ?", "support.ticket_update").Count(&updateLogs)
	if assignLogs < 2 || updateLogs < 2 {
		t.Fatalf("expected >=2 assign logs and >=2 update logs, got assign=%d update=%d", assignLogs, updateLogs)
	}

	// 5. GetHelpArticles LIKE escaping: % only matches the 25% article
	codeKB, bodyKB, _ := supportReq(t, app, "GET", "/help/articles?q=25%25", "", "")
	if codeKB != 200 {
		t.Fatalf("help articles status = %d, want 200", codeKB)
	}
	if arts := bodyKB["data"].([]any); len(arts) != 1 {
		t.Fatalf("expected 1 KB article matching literal '25%%', got %d", len(arts))
	}
}
