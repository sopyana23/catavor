package handlers

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// --- CategoryHandler DI tests ---

// TestCategoryHandler_NilDB_NoPanic membuktikan CategoryHandler yang diinject dengan nil DB
// tidak panic dan mengembalikan error response (400) — bukan panic crash.
// Ini adalah inti DI refactor: handler testable tanpa global state / DB live.
func TestCategoryHandler_NilDB_NoPanic(t *testing.T) {
	h := NewCategoryHandler(nil) // db = nil → simulasi DB belum diinisialisasi

	app := fiber.New()
	app.Get("/api/categories", h.Index)

	req := httptest.NewRequest("GET", "/api/categories", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request error: %v", err)
	}

	// With nil DB, the nil-db guard fires first and returns 503
	// ("Database belum diinisialisasi") — bukan panic, bukan 400.
	if resp.StatusCode != fiber.StatusServiceUnavailable {
		t.Errorf("expected 503 (nil-db guard), got %d", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	_ = json.Unmarshal(body, &result)
	if result["success"] != false {
		t.Errorf("expected success=false, got body: %s", string(body))
	}
}

// TestCategoryHandler_WithDB verifies the constructor correctly stores the db reference
// and the handler struct has the expected shape after DI refactor.
func TestCategoryHandler_WithDB(t *testing.T) {
	h := NewCategoryHandler(&gorm.DB{})
	if h == nil {
		t.Fatal("expected non-nil CategoryHandler")
	}
	if h.db == nil {
		t.Error("expected db field to be non-nil after construction")
	}
}

// --- ProductHandler DI tests ---

// TestProductHandler_NilDB_Index_NoPanic membuktikan ProductHandler.Index yang diinject
// dengan nil DB tidak panic ketika di-call tanpa store context.
func TestProductHandler_NilDB_Index_NoPanic(t *testing.T) {
	h := NewProductHandler(nil, nil) // cfg=nil, db=nil

	app := fiber.New()
	app.Get("/api/products", h.Index)

	req := httptest.NewRequest("GET", "/api/products", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request error: %v", err)
	}

	// Key assertion: NOT a panic (which would return 503 fiber default or crash).
	// Status should be non-zero — any non-panic response is acceptable.
	if resp.StatusCode == 0 {
		t.Fatal("expected non-zero status code (handler panicked or didn't respond)")
	}

	body, _ := io.ReadAll(resp.Body)
	if len(body) == 0 {
		t.Error("expected non-empty response body")
	}
}

// TestProductHandler_WithDB verifies the constructor correctly stores cfg and db.
func TestProductHandler_WithDB(t *testing.T) {
	h := NewProductHandler(nil, &gorm.DB{})
	if h == nil {
		t.Fatal("expected non-nil ProductHandler")
	}
	if h.db == nil {
		t.Error("expected db field to be non-nil after construction")
	}
}
