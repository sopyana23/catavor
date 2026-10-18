package handlers

import (
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// TestHealthHandler_NilDB membuktikan Readiness mengembalikan 503 ketika DB nil.
// Ini adalah inti dari DI refactor: handler testable tanpa global state / DB live.
func TestHealthHandler_NilDB(t *testing.T) {
	h := NewHealthHandler(nil) // db = nil → simulasi DB belum diinisialisasi

	app := fiber.New()
	app.Get("/readyz", h.Readiness)

	req := httptest.NewRequest("GET", "/readyz", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request error: %v", err)
	}
	if resp.StatusCode != fiber.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if !strings.Contains(string(body), "not_ready") {
		t.Errorf("expected 'not_ready' in body, got: %s", string(body))
	}
}

// TestHealthHandler_LivenessNoDB membuktikan Liveness tidak bergantung pada DB.
func TestHealthHandler_LivenessNoDB(t *testing.T) {
	app := fiber.New()
	app.Get("/healthz", LivenessHandler)

	req := httptest.NewRequest("GET", "/healthz", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request error: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}
