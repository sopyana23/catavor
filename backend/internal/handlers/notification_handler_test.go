package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// notifApp memasang handler dengan middleware yang mengisi c.Locals("user")
// dari header X-Test-User, sehingga isolasi antar pengguna bisa diuji.
func notifApp(t *testing.T, db *gorm.DB) *fiber.App {
	t.Helper()
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	h := NewNotificationHandler(db)

	app.Use(func(c *fiber.Ctx) error {
		if raw := c.Get("X-Test-User"); raw != "" {
			if id, err := strconv.Atoi(raw); err == nil && id > 0 {
				var u models.User
				if err := db.First(&u, id).Error; err == nil {
					c.Locals("user", &u)
					c.Locals("user_id", u.ID)
				}
			}
		}
		return c.Next()
	})

	app.Get("/api/notifications", h.GetNotifications)
	app.Patch("/api/notifications/:id/read", h.MarkAsRead)
	app.Post("/api/notifications/read-all", h.MarkAllAsRead)
	app.Delete("/api/notifications/read/clear", h.ClearReadNotifications)
	app.Delete("/api/notifications/:id", h.Dismiss)

	app.Get("/admin/notifications", h.SuperadminIndex)
	app.Get("/admin/notifications/:id", h.SuperadminGetOne)
	app.Delete("/admin/notifications/:id", h.SuperadminDelete)
	app.Get("/admin/stores/search", h.SearchStores)
	app.Get("/admin/users/search", h.SearchUsers)
	app.Post("/api/notifications/stream-ticket", h.IssueStreamTicket)
	app.Post("/admin/notifications/broadcast", h.SuperadminBroadcast)
	return app
}

func notifCall(t *testing.T, app *fiber.App, method, target string, userID uint) (int, map[string]any, string) {
	t.Helper()
	req := httptest.NewRequest(method, target, nil)
	if userID > 0 {
		req.Header.Set("X-Test-User", strconv.FormatUint(uint64(userID), 10))
	}
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("%s %s: %v", method, target, err)
	}
	defer resp.Body.Close()
	rawBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("%s %s: read body: %v", method, target, err)
	}
	raw := string(rawBytes)
	var body map[string]any
	if raw != "" {
		_ = json.Unmarshal(rawBytes, &body)
	}
	return resp.StatusCode, body, raw
}

// notifUsers membuat dua pengguna dengan satu toko masing-masing.
func notifUsers(t *testing.T, db *gorm.DB) (models.User, models.Store, models.User, models.Store) {
	t.Helper()
	mk := func(n string) (models.User, models.Store) {
		u := models.User{
			Name:     "User " + n,
			Email:    fmt.Sprintf("notif-%s-%d@example.test", n, time.Now().UnixNano()),
			Password: "x",
		}
		mustCreate(t, db, &u)
		s := models.Store{
			UserID:     u.ID,
			Slug:       fmt.Sprintf("toko-%s-%d", n, time.Now().UnixNano()),
			StoreTitle: "Toko " + n,
			Plan:       "free",
		}
		mustCreate(t, db, &s)
		return u, s
	}
	u1, s1 := mk("a")
	u2, s2 := mk("b")
	return u1, s1, u2, s2
}

func mkNotif(t *testing.T, db *gorm.DB, n models.Notification) {
	t.Helper()
	if n.CreatedAt.IsZero() {
		n.CreatedAt = time.Now().UTC()
	}
	n.UpdatedAt = n.CreatedAt
	mustCreate(t, db, &n)
}

func countReads(t *testing.T, db *gorm.DB) int64 {
	t.Helper()
	var n int64
	if err := db.Model(&models.NotificationRead{}).Count(&n).Error; err != nil {
		t.Fatalf("count reads: %v", err)
	}
	return n
}

// notifCallBody sama seperti notifCall tetapi mengirim body JSON.
func notifCallBody(t *testing.T, app *fiber.App, method, target string, userID uint, payload map[string]any) (int, map[string]any) {
	t.Helper()
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	req := httptest.NewRequest(method, target, strings.NewReader(string(raw)))
	req.Header.Set("Content-Type", "application/json")
	if userID > 0 {
		req.Header.Set("X-Test-User", strconv.FormatUint(uint64(userID), 10))
	}
	resp, err := app.Test(req, 10000)
	if err != nil {
		t.Fatalf("%s %s: %v", method, target, err)
	}
	defer resp.Body.Close()
	bodyBytes, _ := io.ReadAll(resp.Body)
	var body map[string]any
	if len(bodyBytes) > 0 {
		_ = json.Unmarshal(bodyBytes, &body)
	}
	return resp.StatusCode, body
}

// --- GetNotifications ------------------------------------------------------

func TestNotificationGetNotifications_IsolasiStore(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)
	u1, s1, _, s2 := notifUsers(t, db)

	mkNotif(t, db, models.Notification{
		ID: "n-store-a", TargetType: "single_store", TargetID: s1.ID,
		Title: "Untuk Toko A", Message: "isi", Category: "SISTEM",
	})
	mkNotif(t, db, models.Notification{
		ID: "n-store-b", TargetType: "single_store", TargetID: s2.ID,
		Title: "Untuk Toko B", Message: "isi", Category: "SISTEM",
	})
	mkNotif(t, db, models.Notification{
		ID: "n-all-baru", TargetType: "all",
		Title: "Broadcast Baru", Message: "isi", Category: "SISTEM",
		CreatedAt: time.Now().UTC(),
	})
	mkNotif(t, db, models.Notification{
		ID: "n-all-lama", TargetType: "all",
		Title: "Broadcast Lama", Message: "isi", Category: "SISTEM",
		CreatedAt: s1.CreatedAt.Add(-2 * time.Hour),
	})

	status, _, raw := notifCall(t, app, "GET", "/api/notifications?slug="+s1.Slug, u1.ID)
	if status != 200 {
		t.Fatalf("status = %d, want 200 (body=%s)", status, raw)
	}
	if !strings.Contains(raw, "Untuk Toko A") {
		t.Error("notifikasi milik toko sendiri hilang")
	}
	if !strings.Contains(raw, "Broadcast Baru") {
		t.Error("broadcast baru untuk semua toko tidak muncul")
	}
	if strings.Contains(raw, "Untuk Toko B") {
		t.Error("BOCOR: notifikasi toko lain ikut terkirim")
	}
	if strings.Contains(raw, "Broadcast Lama") {
		t.Error("broadcast yang dibuat sebelum toko lahir tidak boleh muncul")
	}
}

func TestNotificationGetNotifications_SlugTokoLainDiabaikan(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)
	u1, _, _, s2 := notifUsers(t, db)

	mkNotif(t, db, models.Notification{
		ID: "n-rahasia-b", TargetType: "single_store", TargetID: s2.ID,
		Title: "Rahasia Toko B", Message: "isi", Category: "SISTEM",
	})

	// Pengguna A menebak slug toko B: konteks toko harus ditolak, bukan dipakai.
	status, _, raw := notifCall(t, app, "GET", "/api/notifications?slug="+s2.Slug, u1.ID)
	if status != 200 {
		t.Fatalf("status = %d, want 200", status)
	}
	if strings.Contains(raw, "Rahasia Toko B") {
		t.Error("BOCOR: slug toko milik pengguna lain dipakai sebagai konteks")
	}
}

func TestNotificationGetNotifications_TanpaSesi(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)
	mkNotif(t, db, models.Notification{
		ID: "n-all", TargetType: "all", Title: "Umum", Message: "isi", Category: "SISTEM",
	})

	status, body, raw := notifCall(t, app, "GET", "/api/notifications", 0)
	if status != 200 {
		t.Fatalf("status = %d, want 200 (tanpa identitas hanya boleh melihat broadcast)", status)
	}
	if _, ok := body["data"]; !ok {
		t.Fatalf("respons tanpa field data: %s", raw)
	}
}

func TestNotificationGetNotifications_FilterKategori(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)
	u1, s1, _, _ := notifUsers(t, db)

	mkNotif(t, db, models.Notification{
		ID: "n-sec", TargetType: "single_store", TargetID: s1.ID,
		Title: "Peringatan Keamanan", Message: "isi", Category: "KEAMANAN", Type: "warning",
	})
	mkNotif(t, db, models.Notification{
		ID: "n-sys", TargetType: "single_store", TargetID: s1.ID,
		Title: "Info Biasa", Message: "isi", Category: "SISTEM",
	})

	_, body, raw := notifCall(t, app, "GET", "/api/notifications?slug="+s1.Slug+"&category=security", u1.ID)
	if !strings.Contains(raw, "Peringatan Keamanan") {
		t.Fatalf("kategori security tidak memuat notifikasi keamanan: %s", raw)
	}
	if strings.Contains(raw, "Info Biasa") {
		t.Error("filter category=security masih memuat notifikasi sistem")
	}
	if sc, ok := body["security_count"].(float64); !ok || sc < 1 {
		t.Errorf("security_count = %v, want >= 1", body["security_count"])
	}
}

func TestNotificationGetNotifications_Paginasi(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)
	u1, s1, _, _ := notifUsers(t, db)

	for i := 0; i < 5; i++ {
		mkNotif(t, db, models.Notification{
			ID:         fmt.Sprintf("n-page-%d", i),
			TargetType: "single_store", TargetID: s1.ID,
			Title: fmt.Sprintf("Halaman %d", i), Message: "isi", Category: "SISTEM",
			CreatedAt: time.Now().UTC().Add(-time.Duration(i) * time.Minute),
		})
	}

	_, body, raw := notifCall(t, app, "GET", "/api/notifications?slug="+s1.Slug+"&limit=2&page=1", u1.ID)
	data, _ := body["data"].([]any)
	if len(data) != 2 {
		t.Fatalf("limit=2 mengembalikan %d item: %s", len(data), raw)
	}
	if hm, ok := body["has_more"].(bool); !ok || !hm {
		t.Errorf("has_more = %v, want true", body["has_more"])
	}

	_, body2, _ := notifCall(t, app, "GET", "/api/notifications?slug="+s1.Slug+"&limit=2&page=3", u1.ID)
	data2, _ := body2["data"].([]any)
	if len(data2) != 1 {
		t.Errorf("halaman 3 berisi %d item, want 1", len(data2))
	}
}

// --- MarkAsRead / Dismiss --------------------------------------------------

func TestNotificationMarkAsRead_Idempoten(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)
	u1, s1, _, _ := notifUsers(t, db)

	mkNotif(t, db, models.Notification{
		ID: "n-read-1", TargetType: "single_store", TargetID: s1.ID,
		Title: "Baca Saya", Message: "isi", Category: "SISTEM",
	})

	if status, _, raw := notifCall(t, app, "PATCH", "/api/notifications/n-read-1/read?slug="+s1.Slug, u1.ID); status != 200 {
		t.Fatalf("tandai baca pertama status = %d (%s)", status, raw)
	}
	if n := countReads(t, db); n != 1 {
		t.Fatalf("read receipt = %d, want 1", n)
	}

	// Panggilan kedua harus memperbarui baris yang sama, bukan menambah baris.
	if status, _, raw := notifCall(t, app, "PATCH", "/api/notifications/n-read-1/read?slug="+s1.Slug, u1.ID); status != 200 {
		t.Fatalf("tandai baca kedua status = %d (%s)", status, raw)
	}
	if n := countReads(t, db); n != 1 {
		t.Errorf("read receipt menumpuk jadi %d, want 1 (idempoten)", n)
	}
}

func TestNotificationMarkAsRead_NotificationTidakAdaDitolak(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)
	u1, s1, _, _ := notifUsers(t, db)

	// ID acak: tidak pernah ada notifikasi dengan id ini.
	status, _, raw := notifCall(t, app, "PATCH", "/api/notifications/notif_karangan_999/read?slug="+s1.Slug, u1.ID)
	if status == 200 {
		t.Errorf("ID notifikasi karangan diterima (status 200): %s", raw)
	}
	if n := countReads(t, db); n != 0 {
		t.Errorf("read receipt untuk ID karangan tetap dibuat: %d baris", n)
	}
}

func TestNotificationDismiss_NotificationTidakAdaDitolak(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)
	u1, s1, _, _ := notifUsers(t, db)

	status, _, raw := notifCall(t, app, "DELETE", "/api/notifications/notif_karangan_888?slug="+s1.Slug, u1.ID)
	if status == 200 {
		t.Errorf("dismiss ID karangan diterima (status 200): %s", raw)
	}
	if n := countReads(t, db); n != 0 {
		t.Errorf("read receipt untuk ID karangan tetap dibuat: %d baris", n)
	}
}

func TestNotificationMarkAsRead_NotificationTokoLainDitolak(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)
	u1, s1, _, s2 := notifUsers(t, db)

	mkNotif(t, db, models.Notification{
		ID: "n-milik-b", TargetType: "single_store", TargetID: s2.ID,
		Title: "Milik B", Message: "isi", Category: "SISTEM",
	})

	status, _, raw := notifCall(t, app, "PATCH", "/api/notifications/n-milik-b/read?slug="+s1.Slug, u1.ID)
	if status == 200 {
		t.Errorf("pengguna A bisa menandai notifikasi toko B sebagai dibaca: %s", raw)
	}
	if n := countReads(t, db); n != 0 {
		t.Errorf("read receipt lintas toko dibuat: %d baris", n)
	}
}

func TestNotificationMarkAllAsRead_HanyaMilikSendiri(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)
	u1, s1, _, s2 := notifUsers(t, db)

	mkNotif(t, db, models.Notification{
		ID: "n-a1", TargetType: "single_store", TargetID: s1.ID,
		Title: "A1", Message: "isi", Category: "SISTEM",
	})
	mkNotif(t, db, models.Notification{
		ID: "n-a2", TargetType: "single_store", TargetID: s1.ID,
		Title: "A2", Message: "isi", Category: "SISTEM",
	})
	mkNotif(t, db, models.Notification{
		ID: "n-b1", TargetType: "single_store", TargetID: s2.ID,
		Title: "B1", Message: "isi", Category: "SISTEM",
	})

	if status, _, raw := notifCall(t, app, "POST", "/api/notifications/read-all?slug="+s1.Slug, u1.ID); status != 200 {
		t.Fatalf("read-all status = %d (%s)", status, raw)
	}

	var reads []models.NotificationRead
	db.Find(&reads)
	if len(reads) != 2 {
		t.Fatalf("read receipt = %d, want 2 (hanya notifikasi toko sendiri)", len(reads))
	}
	for _, r := range reads {
		if r.StoreID != s1.ID {
			t.Errorf("read receipt dibuat untuk store %d, want %d", r.StoreID, s1.ID)
		}
	}
}

func TestNotificationClearRead_TanpaIdentitas400(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)
	_, s1, _, _ := notifUsers(t, db)

	mustCreate(t, db, &models.NotificationRead{
		NotificationID: "n-x", StoreID: s1.ID, ReadAt: time.Now().UTC(),
	})

	status, _, raw := notifCall(t, app, "DELETE", "/api/notifications/read/clear?slug="+s1.Slug, 0)
	if status != 400 {
		t.Errorf("clear tanpa identitas status = %d, want 400 (%s)", status, raw)
	}
	var n int64
	db.Model(&models.NotificationRead{}).Where("dismissed_at IS NOT NULL").Count(&n)
	if n != 0 {
		t.Errorf("clear tanpa identitas tetap mengubah %d baris", n)
	}
}

// --- Konteks toko & endpoint admin ----------------------------------------

func TestNotificationClearRead_MenandaiTerbacaMilikSendiri(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)
	u1, s1, _, s2 := notifUsers(t, db)
	now := time.Now().UTC()

	mustCreate(t, db, &models.NotificationRead{NotificationID: "n-1", StoreID: s1.ID, ReadAt: now})
	mustCreate(t, db, &models.NotificationRead{NotificationID: "n-2", StoreID: s1.ID, ReadAt: now})
	mustCreate(t, db, &models.NotificationRead{NotificationID: "n-3", StoreID: s2.ID, ReadAt: now})

	status, body, raw := notifCall(t, app, "DELETE", "/api/notifications/read/clear?slug="+s1.Slug, u1.ID)
	if status != 200 {
		t.Fatalf("clear status = %d (%s)", status, raw)
	}
	if c, ok := body["cleared_count"].(float64); !ok || int(c) != 2 {
		t.Errorf("cleared_count = %v, want 2", body["cleared_count"])
	}

	var s2Dismissed int64
	db.Model(&models.NotificationRead{}).Where("store_id = ? AND dismissed_at IS NOT NULL", s2.ID).Count(&s2Dismissed)
	if s2Dismissed != 0 {
		t.Errorf("read receipt toko lain ikut dibersihkan: %d baris", s2Dismissed)
	}
}

func TestNotificationResolveStoreContext_HeaderSlug(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)
	u1, s1, _, _ := notifUsers(t, db)

	mkNotif(t, db, models.Notification{
		ID: "n-hdr", TargetType: "single_store", TargetID: s1.ID,
		Title: "Lewat Header", Message: "isi", Category: "SISTEM",
	})

	req := httptest.NewRequest("GET", "/api/notifications", nil)
	req.Header.Set("X-Test-User", strconv.FormatUint(uint64(u1.ID), 10))
	req.Header.Set("X-Store-Slug", s1.Slug)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	rawBytes, _ := io.ReadAll(resp.Body)
	if !strings.Contains(string(rawBytes), "Lewat Header") {
		t.Errorf("X-Store-Slug tidak dipakai sebagai konteks toko: %s", string(rawBytes))
	}
}

func TestNotificationSuperadminIndex_Filter(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)
	_, s1, _, _ := notifUsers(t, db)

	mkNotif(t, db, models.Notification{
		ID: "n-bc-1", TargetType: "single_store", TargetID: s1.ID, IsBroadcast: true,
		Title: "Siaran Toko", Message: "isi", Category: "PROMOSI",
	})
	mkNotif(t, db, models.Notification{
		ID: "n-bc-2", TargetType: "all", IsBroadcast: true,
		Title: "Siaran Umum", Message: "isi", Category: "SISTEM",
	})

	status, body, raw := notifCall(t, app, "GET", "/admin/notifications?target=store", 0)
	if status != 200 {
		t.Fatalf("status = %d (%s)", status, raw)
	}
	data, _ := body["data"].([]any)
	if len(data) != 1 {
		t.Fatalf("filter target=store mengembalikan %d item, want 1 (%s)", len(data), raw)
	}
	if strings.Contains(raw, "Siaran Umum") {
		t.Error("filter target=store masih memuat broadcast umum")
	}

	_, _, rawQ := notifCall(t, app, "GET", "/admin/notifications?q=umum", 0)
	if !strings.Contains(rawQ, "Siaran Umum") {
		t.Errorf("pencarian q=umum tidak menemukan Siaran Umum: %s", rawQ)
	}
}

func TestNotificationSuperadminGetOneDanDelete(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)

	mkNotif(t, db, models.Notification{
		ID: "n-admin-1", TargetType: "all", IsBroadcast: true,
		Title: "Siaran Hapus", Message: "isi", Category: "SISTEM",
	})

	if status, _, raw := notifCall(t, app, "GET", "/admin/notifications/n-admin-1", 0); status != 200 {
		t.Fatalf("get one status = %d (%s)", status, raw)
	}
	if status, _, raw := notifCall(t, app, "DELETE", "/admin/notifications/n-admin-1", 0); status != 200 {
		t.Fatalf("delete status = %d (%s)", status, raw)
	}
	var n int64
	db.Model(&models.Notification{}).Where("id = ?", "n-admin-1").Count(&n)
	if n != 0 {
		t.Errorf("notifikasi masih ada setelah dihapus")
	}
}

func TestNotificationSuperadminGetOne_TidakAda(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)

	status, _, raw := notifCall(t, app, "GET", "/admin/notifications/tidak-ada", 0)
	if status == 200 {
		t.Errorf("notifikasi tak ada mengembalikan 200: %s", raw)
	}
}

func TestNotificationSearchStores(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)
	_, s1, _, _ := notifUsers(t, db)

	_, body, raw := notifCall(t, app, "GET", "/admin/stores/search?q="+s1.Slug, 0)
	if !strings.Contains(raw, s1.Slug) {
		t.Fatalf("pencarian toko tidak menemukan %q: %s", s1.Slug, raw)
	}
	data, _ := body["data"].([]any)
	if len(data) == 0 {
		t.Fatalf("data kosong untuk query yang cocok: %s", raw)
	}

	// Query kosong harus mengembalikan daftar kosong, bukan seluruh toko.
	_, bodyEmpty, _ := notifCall(t, app, "GET", "/admin/stores/search?q=", 0)
	if d, _ := bodyEmpty["data"].([]any); len(d) != 0 {
		t.Errorf("query kosong mengembalikan %d toko, want 0", len(d))
	}
}

func TestNotificationSearchUsers(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)
	u1, _, _, _ := notifUsers(t, db)

	_, _, raw := notifCall(t, app, "GET", "/admin/users/search?q="+u1.Email, 0)
	if !strings.Contains(raw, u1.Email) {
		t.Fatalf("pencarian pengguna tidak menemukan %q: %s", u1.Email, raw)
	}
}

func TestNotificationFormatRelativeTime(t *testing.T) {
	now := time.Now().UTC()
	cases := []struct {
		in   time.Time
		want string
	}{
		{now.Add(-10 * time.Second), "baru saja"},
		{now.Add(-5 * time.Minute), "menit"},
		{now.Add(-3 * time.Hour), "jam"},
		{now.Add(-48 * time.Hour), "hari"},
	}
	for _, c := range cases {
		got := formatRelativeTime(c.in)
		if !strings.Contains(strings.ToLower(got), c.want) {
			t.Errorf("formatRelativeTime(%v) = %q, want memuat %q", c.in, got, c.want)
		}
	}
}

// --- SSE ticket & broadcast admin ------------------------------------------

func TestNotificationIssueStreamTicket(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)
	u1, _, _, _ := notifUsers(t, db)

	status, body, _ := notifCall(t, app, "POST", "/api/notifications/stream-ticket", 0)
	if status != 401 {
		t.Errorf("tanpa sesi: status = %d, want 401", status)
	}

	status, body, _ = notifCall(t, app, "POST", "/api/notifications/stream-ticket", u1.ID)
	if status != 200 {
		t.Fatalf("dengan sesi: status = %d, want 200 (body=%v)", status, body)
	}
	ticket, _ := body["ticket"].(string)
	if ticket == "" {
		t.Error("ticket kosong")
	}
	if exp, ok := body["expires_in"].(float64); !ok || exp <= 0 {
		t.Errorf("expires_in = %v, want > 0", body["expires_in"])
	}
}

func TestNotificationSuperadminBroadcast(t *testing.T) {
	db := newTestDB(t)
	app := notifApp(t, db)
	admin, _, _, _ := notifUsers(t, db)

	// Judul/pesan kosong harus ditolak.
	status, _ := notifCallBody(t, app, "POST", "/admin/notifications/broadcast", admin.ID,
		map[string]any{"target_type": "all", "title": "", "message": ""})
	if status != 400 {
		t.Errorf("tanpa judul: status = %d, want 400", status)
	}

	status, body := notifCallBody(t, app, "POST", "/admin/notifications/broadcast", admin.ID,
		map[string]any{
			"target_type": "all",
			"title":       "Pemeliharaan Terjadwal",
			"message":     "Server akan dirawat malam ini.",
			"type":        "info",
		})
	if status != 200 && status != 201 {
		t.Fatalf("siaran sah: status = %d (body=%v)", status, body)
	}

	var n models.Notification
	if err := db.Where("title = ?", "Pemeliharaan Terjadwal").First(&n).Error; err != nil {
		t.Fatalf("notifikasi siaran tidak tersimpan: %v", err)
	}
	if n.TargetType != "all" {
		t.Errorf("target_type = %q, want all", n.TargetType)
	}
}
