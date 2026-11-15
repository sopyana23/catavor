package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

// supportDB menyiapkan SQLite in-memory dengan tabel-tabel modul bantuan.
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
