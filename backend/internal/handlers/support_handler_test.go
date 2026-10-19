package handlers

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
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

	app.Get("/tickets/:id", actor, h.GetTicketDetails)
	app.Post("/tickets/:id/reply", actor, h.ReplyTicket)
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

func TestSupportServeAttachment_SQLite(t *testing.T) {
	// Bukan t.TempDir(): fasthttp menahan handle berkas yang sudah dikirim,
	// sehingga RemoveAll saat cleanup gagal di Windows. Bersihkan manual.
	root, err := os.MkdirTemp("", "catavor-attachment-")
	if err != nil {
		t.Fatalf("mkdir temp: %v", err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(root) })
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
}
