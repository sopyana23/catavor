package main

import (
	"catavor-backend/internal/middleware"
	"catavor-backend/internal/models"
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestScopedGroupPreventsPrefixMiddlewareLeakToAdminRoutes(t *testing.T) {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	api := app.Group("/api")

	var activeUser *models.User
	authCounter := 0
	mockAuth := func(c *fiber.Ctx) error {
		authCounter++
		c.Locals("user", activeUser)
		return c.Next()
	}

	authOnly := newScopedGroup(api, mockAuth)
	guarded := newScopedGroup(api, mockAuth, middleware.StoreOwnerRequired())
	guardedMutations := newScopedGroup(api, mockAuth, middleware.StoreOwnerRequired(), middleware.OperationalStoreRequired())

	authOnly.Get("/auth/verify", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})
	guarded.Get("/admin/categories", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})
	guarded.Get("/support/tickets", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})
	guardedMutations.Post("/products", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusCreated)
	})

	requireAdmin := func(c *fiber.Ctx) error {
		u, _ := c.Locals("user").(*models.User)
		if u == nil || !u.IsPlatformStaff() {
			return c.SendStatus(fiber.StatusForbidden)
		}
		return c.Next()
	}
	adminApi := api.Group("/admin", mockAuth, requireAdmin)
	adminApi.Post("/rbac/staff/create", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusCreated)
	})

	t.Run("storeless_superadmin_admin_mutation_succeeds_and_auth_runs_once", func(t *testing.T) {
		authCounter = 0
		activeUser = &models.User{ID: 1, PlatformRole: "superadmin"}
		req := httptest.NewRequest(fiber.MethodPost, "/api/admin/rbac/staff/create", nil)
		resp, err := app.Test(req, -1)
		if err != nil {
			t.Fatalf("app.Test failed: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != fiber.StatusCreated {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("got status %d (%s), want 201", resp.StatusCode, string(body))
		}
		if authCounter != 1 {
			t.Fatalf("auth middleware ran %d times, want 1 (no prefix middleware leak)", authCounter)
		}
	})

	t.Run("storeless_superadmin_tenant_mutation_still_blocked_with_STORE_CONTEXT_REQUIRED", func(t *testing.T) {
		authCounter = 0
		activeUser = &models.User{ID: 1, PlatformRole: "superadmin"}
		req := httptest.NewRequest(fiber.MethodPost, "/api/products", nil)
		resp, err := app.Test(req, -1)
		if err != nil {
			t.Fatalf("app.Test failed: %v", err)
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != fiber.StatusForbidden || !strings.Contains(string(body), "STORE_CONTEXT_REQUIRED") {
			t.Fatalf("got status %d body=%s, want 403 STORE_CONTEXT_REQUIRED", resp.StatusCode, string(body))
		}
		if authCounter != 1 {
			t.Fatalf("auth middleware ran %d times, want 1", authCounter)
		}
	})

	t.Run("merchant_with_store_can_reach_guarded_admin_categories_before_adminApi", func(t *testing.T) {
		authCounter = 0
		activeUser = &models.User{
			ID:           2,
			PlatformRole: "merchant",
			Stores:       []models.Store{{ID: 10, UserID: 2, Slug: "toko-uji"}},
		}
		req := httptest.NewRequest(fiber.MethodGet, "/api/admin/categories", nil)
		resp, err := app.Test(req, -1)
		if err != nil {
			t.Fatalf("app.Test failed: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != fiber.StatusOK {
			t.Fatalf("got status %d, want 200", resp.StatusCode)
		}
		if authCounter != 1 {
			t.Fatalf("auth middleware ran %d times, want 1", authCounter)
		}
	})

	t.Run("suspended_merchant_can_still_read_guarded_support_tickets", func(t *testing.T) {
		authCounter = 0
		activeUser = &models.User{
			ID:           3,
			PlatformRole: "merchant",
			Stores:       []models.Store{{ID: 11, UserID: 3, Slug: "toko-beku", IsSuspended: true, DormancyStatus: "suspended"}},
		}
		req := httptest.NewRequest(fiber.MethodGet, "/api/support/tickets", nil)
		resp, err := app.Test(req, -1)
		if err != nil {
			t.Fatalf("app.Test failed: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != fiber.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("got status %d (%s), want 200 (guarded should not inherit OperationalStoreRequired)", resp.StatusCode, string(body))
		}
	})
}
