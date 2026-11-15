package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"catavor-backend/internal/config"
	"catavor-backend/internal/models"
	"catavor-backend/internal/storage"

	"github.com/gofiber/fiber/v2"
)

// TestPDFUploadGating_N47 menguji bahwa dokumen PDF hanya diizinkan untuk category=support,
// dan ditolak dengan HTTP 415 untuk category produk maupun billing.
func TestPDFUploadGating_N47(t *testing.T) {
	db := newTestDB(t)
	cfg := &config.Config{
		AppEnv:             "local",
		StorageLocalRoot:   t.TempDir(),
		StoragePrivateRoot: t.TempDir(),
		StoragePublicURL:   "http://localhost:8000/storage",
	}

	localStorage := storage.NewLocalStorageService(cfg)
	h := NewStorageHandler(cfg, localStorage, db)

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	// Mock middleware to inject user and store context
	app.Use(func(c *fiber.Ctx) error {
		u := &models.User{Name: "Uji User", Email: "user@test.local"}
		u.ID = 1
		s := &models.Store{UserID: 1, Slug: "toko-uji"}
		s.ID = 1
		c.Locals("user", u)
		c.Locals("store", s)
		return c.Next()
	})
	app.Post("/upload", h.Upload)

	makePDFRequest := func(category string) *http.Response {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, err := writer.CreateFormFile("file", "test-doc.pdf")
		if err != nil {
			t.Fatalf("CreateFormFile: %v", err)
		}
		// Valid PDF magic header
		_, _ = part.Write([]byte("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"))
		_ = writer.Close()

		req := httptest.NewRequest("POST", "/upload?category="+category, body)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		resp, err := app.Test(req, 5000)
		if err != nil {
			t.Fatalf("app.Test error: %v", err)
		}
		return resp
	}

	// 1. PDF pada kategori products wajib ditolak 415
	respProd := makePDFRequest("products")
	defer respProd.Body.Close()
	if respProd.StatusCode != fiber.StatusUnsupportedMediaType {
		t.Fatalf("Upload PDF category=products: status %d, want 415", respProd.StatusCode)
	}

	// 2. PDF pada kategori billing wajib ditolak 415
	respBilling := makePDFRequest("billing")
	defer respBilling.Body.Close()
	if respBilling.StatusCode != fiber.StatusUnsupportedMediaType {
		t.Fatalf("Upload PDF category=billing: status %d, want 415", respBilling.StatusCode)
	}

	// 3. PDF pada kategori support wajib diterima 200 dan menghasilkan storage_key di namespace private/
	respSupport := makePDFRequest("support")
	defer respSupport.Body.Close()
	if respSupport.StatusCode != fiber.StatusOK {
		t.Fatalf("Upload PDF category=support: status %d, want 200", respSupport.StatusCode)
	}

	var resData struct {
		Success    bool   `json:"success"`
		StorageKey string `json:"storage_key"`
		Key        string `json:"key"`
		URL        string `json:"url"`
	}
	bodyBytes, err := io.ReadAll(respSupport.Body)
	if err != nil {
		t.Fatalf("ReadAll body: %v", err)
	}
	if err := json.Unmarshal(bodyBytes, &resData); err != nil {
		t.Fatalf("Unmarshal response: %v", err)
	}
	if !resData.Success {
		t.Fatalf("Upload PDF category=support tidak success: %s", string(bodyBytes))
	}
	if !strings.HasPrefix(resData.StorageKey, "private/") {
		t.Fatalf("storage_key PDF support tidak berawalan private/: got %q", resData.StorageKey)
	}
}
