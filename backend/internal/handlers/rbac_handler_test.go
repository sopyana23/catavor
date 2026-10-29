package handlers

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// Harness RBAC. RBACService adalah singleton yang membaca database.DB pada
// pemanggilan pertama, jadi tes di sini sengaja hanya menyentuh jalur yang
// diputuskan SEBELUM akses database (validasi payload + gerbang superadmin).
// Itu justru jalur yang menyimpan risiko eskalasi hak akses.
// ---------------------------------------------------------------------------

// rbacApp memasang RBACHandler dengan Locals("user") yang diisi dari header
// X-Test-Actor: "nil" | "merchant" | "superadmin" | "garbage".
//
// handlerDB sengaja dipisah dari database.DB: NewRBACHandler selalu memanggil
// GetRBACService(), dan konstruksi singleton itu langsung me-RefreshCache() dari
// database.DB (panic kalau nil). Jadi database.DB harus hidup, sementara
// handlerDB boleh nil untuk menguji guard "database belum diinisialisasi".
func rbacApp(t *testing.T, handlerDB *gorm.DB) *fiber.App {
	t.Helper()
	if database.DB == nil {
		newTestDB(t) // hanya untuk memberi DB pada singleton RBACService
	}
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	h := NewRBACHandler(handlerDB)

	actorMiddleware := func(c *fiber.Ctx) error {
		switch c.Get("X-Test-Actor") {
		case "", "nil":
			// Locals tidak diisi.
		case "merchant":
			c.Locals("user", &models.User{ID: 7, Name: "Merchant", PlatformRole: "merchant"})
		case "superadmin":
			c.Locals("user", &models.User{ID: 1, Name: "Root", PlatformRole: "superadmin"})
		case "garbage":
			c.Locals("user", &models.User{ID: 9, Name: "Sampah", PlatformRole: "superadminx"})
		}
		return c.Next()
	}

	app.Get("/rbac/me", actorMiddleware, h.GetMyPermissions)
	app.Put("/rbac/matrix", actorMiddleware, h.UpdateMatrix)
	app.Get("/rbac/staff", actorMiddleware, h.GetStaff)
	app.Post("/rbac/staff", actorMiddleware, h.AssignStaff)
	app.Delete("/rbac/staff", actorMiddleware, h.RevokeStaff)
	app.Post("/rbac/roles", actorMiddleware, h.CreateRole)
	return app
}

func rbacReq(t *testing.T, app *fiber.App, method, path, actor, body string) (int, map[string]any) {
	t.Helper()
	var rdr io.Reader
	if body != "" {
		rdr = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, rdr)
	req.Header.Set("Content-Type", "application/json")
	if actor != "" {
		req.Header.Set("X-Test-Actor", actor)
	}
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	out := map[string]any{}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &out)
	}
	return resp.StatusCode, out
}

// ---------------------------------------------------------------------------
// GetMyPermissions
// ---------------------------------------------------------------------------

func TestRBACGetMyPermissions_SQLite(t *testing.T) {
	app := rbacApp(t, nil)

	t.Run("tanpa_aktor_401", func(t *testing.T) {
		code, body := rbacReq(t, app, "GET", "/rbac/me", "", "")
		if code != 401 {
			t.Fatalf("status = %d, want 401 (body %v)", code, body)
		}
	})

	t.Run("merchant_dapat_daftar_kosong", func(t *testing.T) {
		code, body := rbacReq(t, app, "GET", "/rbac/me", "merchant", "")
		if code != 200 {
			t.Fatalf("status = %d, want 200 (body %v)", code, body)
		}
		data, _ := body["data"].(map[string]any)
		if data == nil {
			t.Fatalf("data hilang: %v", body)
		}
		// Merchant bukan platform staff -> tidak boleh punya izin apa pun.
		perms, ok := data["permissions"].([]any)
		if !ok {
			t.Fatalf("permissions bukan array: %#v", data["permissions"])
		}
		if len(perms) != 0 {
			t.Errorf("merchant punya %d izin, want 0: %v", len(perms), perms)
		}
		if isAdmin, _ := data["is_admin"].(bool); isAdmin {
			t.Error("is_admin = true untuk merchant")
		}
		if isSuper, _ := data["is_superadmin"].(bool); isSuper {
			t.Error("is_superadmin = true untuk merchant")
		}
	})

	t.Run("role_sampah_tidak_dianggap_staf", func(t *testing.T) {
		// Regresi N-41: role "superadminx" dulu lolos daftar hitam dan bisa
		// mewarisi wildcard "*".
		code, body := rbacReq(t, app, "GET", "/rbac/me", "garbage", "")
		if code != 200 {
			t.Fatalf("status = %d, want 200 (body %v)", code, body)
		}
		data, _ := body["data"].(map[string]any)
		perms, _ := data["permissions"].([]any)
		if len(perms) != 0 {
			t.Errorf("role sampah dapat %d izin, want 0: %v", len(perms), perms)
		}
		if isAdmin, _ := data["is_admin"].(bool); !isAdmin {
			// is_admin hanya penanda tampilan (PlatformRole != "" dan != merchant);
			// yang mengikat adalah permissions. Pastikan tidak ada izin.
			t.Log("is_admin=true untuk role sampah (penanda tampilan), permissions tetap kosong")
		}
	})
}

// ---------------------------------------------------------------------------
// UpdateMatrix — validasi payload + gerbang superadmin
// ---------------------------------------------------------------------------

func TestRBACUpdateMatrix_SQLite(t *testing.T) {
	app := rbacApp(t, nil)

	t.Run("payload_rusak_400", func(t *testing.T) {
		code, body := rbacReq(t, app, "PUT", "/rbac/matrix", "superadmin", "{bukan json")
		if code != 400 {
			t.Fatalf("status = %d, want 400 (body %v)", code, body)
		}
	})

	t.Run("role_slug_kosong_400", func(t *testing.T) {
		code, body := rbacReq(t, app, "PUT", "/rbac/matrix", "superadmin",
			`{"role_slug":"   ","permission_keys":["x"]}`)
		if code != 400 {
			t.Fatalf("status = %d, want 400 (body %v)", code, body)
		}
	})

	t.Run("bukan_superadmin_ditolak", func(t *testing.T) {
		for _, actor := range []string{"", "merchant", "garbage"} {
			code, body := rbacReq(t, app, "PUT", "/rbac/matrix", actor,
				`{"role_slug":"admin","permission_keys":["*"]}`)
			if code != 400 {
				t.Fatalf("actor %q: status = %d, want 400 (body %v)", actor, code, body)
			}
			msg, _ := body["message"].(string)
			if !strings.Contains(strings.ToLower(msg), "akses ditolak") {
				t.Errorf("actor %q: pesan = %q, want mengandung 'akses ditolak'", actor, msg)
			}
		}
	})

	t.Run("superadmin_matrix_tidak_bisa_diubah", func(t *testing.T) {
		code, body := rbacReq(t, app, "PUT", "/rbac/matrix", "superadmin",
			`{"role_slug":"superadmin","permission_keys":["products.read"]}`)
		if code != 400 {
			t.Fatalf("status = %d, want 400 (body %v)", code, body)
		}
		msg, _ := body["message"].(string)
		if !strings.Contains(strings.ToLower(msg), "superadmin") {
			t.Errorf("pesan = %q, want mengandung 'superadmin'", msg)
		}
	})
}

// ---------------------------------------------------------------------------
// AssignStaff / RevokeStaff — eskalasi hak akses
// ---------------------------------------------------------------------------

func TestRBACAssignStaff_SQLite(t *testing.T) {
	app := rbacApp(t, nil)

	t.Run("payload_rusak_400", func(t *testing.T) {
		code, _ := rbacReq(t, app, "POST", "/rbac/staff", "superadmin", "{bukan json")
		if code != 400 {
			t.Fatalf("status = %d, want 400", code)
		}
	})

	t.Run("target_dan_role_wajib", func(t *testing.T) {
		cases := []string{
			`{}`,
			`{"role_slug":"admin"}`,
			`{"email":"staf@example.com"}`,
			`{"email_or_id":"   ","role_slug":"   "}`,
		}
		for _, body := range cases {
			code, resp := rbacReq(t, app, "POST", "/rbac/staff", "superadmin", body)
			if code != 400 {
				t.Errorf("body %s: status = %d, want 400 (resp %v)", body, code, resp)
			}
		}
	})

	t.Run("bukan_superadmin_tidak_boleh_menaikkan_role", func(t *testing.T) {
		for _, actor := range []string{"", "merchant", "garbage"} {
			code, body := rbacReq(t, app, "POST", "/rbac/staff", actor,
				`{"email":"saya@example.com","role_slug":"superadmin"}`)
			if code != 400 {
				t.Fatalf("actor %q: status = %d, want 400 (body %v)", actor, code, body)
			}
			msg, _ := body["message"].(string)
			if !strings.Contains(strings.ToLower(msg), "akses ditolak") {
				t.Errorf("actor %q: pesan = %q, want mengandung 'akses ditolak'", actor, msg)
			}
		}
	})
}

func TestRBACRevokeStaff_SQLite(t *testing.T) {
	t.Run("db_nil_503", func(t *testing.T) {
		app := rbacApp(t, nil)
		code, body := rbacReq(t, app, "DELETE", "/rbac/staff", "superadmin", `{"user_id":5}`)
		if code != 503 {
			t.Fatalf("status = %d, want 503 (body %v)", code, body)
		}
	})

	t.Run("user_id_wajib", func(t *testing.T) {
		db := newTestDB(t)
		app := rbacApp(t, db)
		for _, body := range []string{`{}`, `{"email":"  "}`} {
			code, resp := rbacReq(t, app, "DELETE", "/rbac/staff", "superadmin", body)
			if code != 400 {
				t.Errorf("body %s: status = %d, want 400 (resp %v)", body, code, resp)
			}
		}
	})

	t.Run("bukan_superadmin_ditolak", func(t *testing.T) {
		db := newTestDB(t)
		app := rbacApp(t, db)
		for _, actor := range []string{"", "merchant", "garbage"} {
			code, body := rbacReq(t, app, "DELETE", "/rbac/staff", actor, `{"user_id":5}`)
			if code != 400 {
				t.Fatalf("actor %q: status = %d, want 400 (body %v)", actor, code, body)
			}
			msg, _ := body["message"].(string)
			if !strings.Contains(strings.ToLower(msg), "akses ditolak") {
				t.Errorf("actor %q: pesan = %q, want mengandung 'akses ditolak'", actor, msg)
			}
		}
	})
}

// ---------------------------------------------------------------------------
// CreateRole — validasi wajib
// ---------------------------------------------------------------------------

func TestRBACCreateRole_SQLite(t *testing.T) {
	app := rbacApp(t, nil)

	t.Run("payload_rusak_400", func(t *testing.T) {
		code, _ := rbacReq(t, app, "POST", "/rbac/roles", "superadmin", "{bukan json")
		if code != 400 {
			t.Fatalf("status = %d, want 400", code)
		}
	})

	t.Run("slug_dan_nama_wajib", func(t *testing.T) {
		cases := []string{
			`{}`,
			`{"slug":"kurator"}`,
			`{"name":"Kurator"}`,
			`{"slug":"   ","name":"   "}`,
		}
		for _, body := range cases {
			code, resp := rbacReq(t, app, "POST", "/rbac/roles", "superadmin", body)
			if code != 400 {
				t.Errorf("body %s: status = %d, want 400 (resp %v)", body, code, resp)
			}
		}
	})
}
