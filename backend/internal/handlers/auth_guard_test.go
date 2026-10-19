package handlers

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// TestHandlerTanpaSesiTidakPanik memastikan handler yang membaca
// c.Locals("user") mengembalikan 401, bukan panic.
//
// Type assertion tanpa bentuk comma-ok akan melempar panic bila locals kosong.
// Panic di Fiber tidak otomatis di-recover dan mematikan seluruh proses, jadi
// handler tidak boleh bergantung pada middleware auth untuk keselamatannya.
func TestHandlerTanpaSesiTidakPanik(t *testing.T) {
	db := newTestDB(t)
	cfg := testCfg()

	authH := NewAuthHandler(cfg, db)
	sessH := NewSessionHandler(cfg, db)
	setH := NewSettingHandler(db)
	storeH := NewStoreHandler(db, cfg)

	cases := []struct {
		nama   string
		method string
		path   string
		body   string
		target string
	}{
		{"UpdateProfile", fiber.MethodPut, "/profile", `{"name":"X"}`, ""},
		{"DeleteAccount", fiber.MethodDelete, "/account", `{"password":"x"}`, ""},
		{"GetSessions", fiber.MethodGet, "/sessions", "", ""},
		{"RevokeSession", fiber.MethodDelete, "/sessions/:id", "", "7"},
		{"RevokeOtherSessions", fiber.MethodPost, "/sessions/revoke-others", "", ""},
		{"UpdatePolicy", fiber.MethodPut, "/policies", `{"type":"privacy","title":"T","content":"C"}`, ""},
		{"GetMyStores", fiber.MethodGet, "/stores", "", ""},
		{"CreateStore", fiber.MethodPost, "/stores", `{"name":"Toko","slug":"toko-uji"}`, ""},
		{"SwitchStore", fiber.MethodPost, "/stores/switch", `{"store_id":1}`, ""},
	}

	handler := map[string]fiber.Handler{
		"UpdateProfile":       authH.UpdateProfile,
		"DeleteAccount":       authH.DeleteAccount,
		"GetSessions":         sessH.GetSessions,
		"RevokeSession":       sessH.RevokeSession,
		"RevokeOtherSessions": sessH.RevokeOtherSessions,
		"UpdatePolicy":        setH.UpdatePolicy,
		"GetMyStores":         storeH.GetMyStores,
		"CreateStore":         storeH.CreateStore,
		"SwitchStore":         storeH.SwitchStore,
	}

	for _, tc := range cases {
		t.Run(tc.nama, func(t *testing.T) {
			app := fiber.New(fiber.Config{DisableStartupMessage: true})
			// Sengaja TANPA middleware auth: handler harus aman sendiri.
			app.Add(tc.method, tc.path, handler[tc.nama])

			req := httptest.NewRequest(tc.method, tc.path, nil)
			if tc.body != "" {
				req = httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
				req.Header.Set("Content-Type", "application/json")
			}

			resp, err := app.Test(req, 5000)
			if err != nil {
				t.Fatalf("request gagal (kemungkinan panic): %v", err)
			}
			if resp.StatusCode != fiber.StatusUnauthorized {
				t.Fatalf("status = %d, want 401", resp.StatusCode)
			}
		})
	}
}

// TestHandlerLocalsSalahTipeTidakPanik memastikan nilai locals yang bukan
// *models.User juga tidak memicu panic.
func TestHandlerLocalsSalahTipeTidakPanik(t *testing.T) {
	db := newTestDB(t)
	h := NewStoreHandler(db, testCfg())

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user", "bukan-user")
		return c.Next()
	})
	app.Get("/stores", h.GetMyStores)

	req := httptest.NewRequest(fiber.MethodGet, "/stores", nil)
	resp, err := app.Test(req, 5000)
	if err != nil {
		t.Fatalf("request gagal (kemungkinan panic): %v", err)
	}
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
}
