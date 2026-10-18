package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"catavor-backend/internal/config"

	"github.com/gofiber/fiber/v2"
)

// testNilDBHandler verifies that a handler constructed with nil DB
// returns 503 (Service Unavailable) instead of panicking.
// Method is the handler method to call, httpMethod is GET/POST/etc.
func testNilDBHandler(t *testing.T, name string, app *fiber.App, path string, httpMethod string) {
	t.Helper()
	var req *http.Request
	if httpMethod == "POST" {
		req = httptest.NewRequest("POST", path, nil)
	} else {
		req = httptest.NewRequest("GET", path, nil)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("%s: app.Test error: %v", name, err)
	}
	if resp.StatusCode != fiber.StatusServiceUnavailable {
		t.Errorf("%s: expected 503, got %d", name, resp.StatusCode)
	}
}

// ---- Batch 1: empty-struct handlers ----

func TestReportHandler_NilDB_NotPanic(t *testing.T) {
	h := NewReportHandler(nil)
	app := fiber.New()
	app.Get("/test", h.Index)
	testNilDBHandler(t, "ReportHandler.Index", app, "/test", "GET")
}

func TestSettingHandler_NilDB_NotPanic(t *testing.T) {
	h := NewSettingHandler(nil)
	app := fiber.New()
	app.Get("/test", h.Index)
	testNilDBHandler(t, "SettingHandler.Index", app, "/test", "GET")
}

func TestSubscriptionHandler_NilDB_NotPanic(t *testing.T) {
	h := NewSubscriptionHandler(nil)
	app := fiber.New()
	app.Get("/test", h.GetPlans)
	testNilDBHandler(t, "SubscriptionHandler.GetPlans", app, "/test", "GET")
}

func TestArticleHandler_NilDB_NotPanic(t *testing.T) {
	h := NewArticleHandler(nil)
	app := fiber.New()
	app.Get("/test", h.Index)
	testNilDBHandler(t, "ArticleHandler.Index", app, "/test", "GET")
}

func TestSafeDomainHandler_NilDB_NotPanic(t *testing.T) {
	h := NewSafeDomainHandler(nil)
	app := fiber.New()
	app.Get("/test", h.GetPublicSafeDomains)
	testNilDBHandler(t, "SafeDomainHandler.GetPublicSafeDomains", app, "/test", "GET")
}

func TestRBACHandler_NilDB_NotPanic(t *testing.T) {
	// NewRBACHandler calls services.GetRBACService() which depends on
	// database.DB global (singleton with sync.Once). Can't test with nil DB
	// via constructor — construct struct directly.
	// Only RevokeStaff uses h.db; GetMatrix uses h.rbacService (nil here).
	h := &RBACHandler{db: nil}
	app := fiber.New()
	app.Post("/test", h.RevokeStaff)
	testNilDBHandler(t, "RBACHandler.RevokeStaff", app, "/test", "POST")
}

// ---- Batch 2: existing-struct handlers ----

func TestSupportHandler_NilDB_NotPanic(t *testing.T) {
	h := NewSupportHandler(&config.Config{}, nil, nil)
	app := fiber.New()
	app.Get("/test", h.ListMyTickets)
	testNilDBHandler(t, "SupportHandler.ListMyTickets", app, "/test", "GET")
}

func TestStoreHandler_NilDB_NotPanic(t *testing.T) {
	h := NewStoreHandler(nil)
	app := fiber.New()
	app.Get("/test", h.FeaturedStores)
	testNilDBHandler(t, "StoreHandler.FeaturedStores", app, "/test", "GET")
}

func TestAuthHandler_NilDB_NotPanic(t *testing.T) {
	h := NewAuthHandler(&config.Config{}, nil)
	app := fiber.New()
	app.Post("/test", h.Login)
	testNilDBHandler(t, "AuthHandler.Login", app, "/test", "POST")
}

func TestAnalyticsHandler_NilDB_NotPanic(t *testing.T) {
	h := NewAnalyticsHandler(&config.Config{}, nil)
	app := fiber.New()
	app.Post("/test", h.TrackEvent)
	testNilDBHandler(t, "AnalyticsHandler.TrackEvent", app, "/test", "POST")
}

func TestSessionHandler_NilDB_NotPanic(t *testing.T) {
	h := NewSessionHandler(&config.Config{}, nil)
	app := fiber.New()
	app.Get("/test", h.GetSessions)
	testNilDBHandler(t, "SessionHandler.GetSessions", app, "/test", "GET")
}

// ---- Batch 3: no-struct handlers ----

func TestDormancyHandler_NilDB_NotPanic(t *testing.T) {
	h := NewDormancyHandler(nil)
	app := fiber.New()
	app.Get("/test", h.HandlePublicReactivateStore)
	testNilDBHandler(t, "DormancyHandler.HandlePublicReactivateStore", app, "/test", "GET")
}

// ---- Constructor sanity checks ----

func TestAllHandlers_ConstructWithNilDB_NoPanic(t *testing.T) {
	// Verify all constructors accept nil DB without panicking
	_ = NewReportHandler(nil)
	_ = NewSettingHandler(nil)
	_ = NewSubscriptionHandler(nil)
	_ = NewArticleHandler(nil)
	_ = NewSafeDomainHandler(nil)
	// RBACHandler omitted: NewRBACHandler calls services.GetRBACService()
	// which depends on database.DB global singleton — panics with nil DB.
	_ = NewSupportHandler(&config.Config{}, nil, nil)
	_ = NewStoreHandler(nil)
	_ = NewAuthHandler(&config.Config{}, nil)
	_ = NewAnalyticsHandler(&config.Config{}, nil)
	_ = NewSessionHandler(&config.Config{}, nil)
	_ = NewDormancyHandler(nil)
	_ = NewCategoryHandler(nil)
	_ = NewProductHandler(&config.Config{}, nil)
	_ = NewHealthHandler(nil)
}
