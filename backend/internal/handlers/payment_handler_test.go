package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func setupTestDBForPayment(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.Store{},
		&models.SubscriptionPlan{},
		&models.SubscriptionOrder{},
		&models.Setting{},
		&models.ActivityLog{},
	); err != nil {
		t.Fatalf("migration failed: %v", err)
	}

	// Seed settings
	db.Create(&models.Setting{Key: "aulaa_webhook_secret", Value: "test_secret_123"})
	db.Create(&models.Setting{Key: "payment_system_mode", Value: "gateway_aulaa"})

	// Seed subscription plan
	db.Create(&models.SubscriptionPlan{
		Code:         "pro_starter",
		Name:         "Pro Starter",
		PriceMonthly: 50000,
		IsActive:     true,
	})

	// Seed user & store
	user := models.User{Email: "merchant@test.com", Name: "Test Merchant"}
	db.Create(&user)

	store := models.Store{UserID: user.ID, Slug: "test-store", StoreTitle: "Test Store", Plan: "free", PlanStatus: "active"}
	db.Create(&store)

	return db
}

func TestPaymentHandler_HandleAulaaWebhook(t *testing.T) {
	db := setupTestDBForPayment(t)
	handler := NewPaymentHandler(db)

	app := fiber.New()
	app.Post("/api/webhooks/payment/aulaa", handler.HandleAulaaWebhook)

	// Create a pending subscription order
	order := models.SubscriptionOrder{
		StoreID:       1,
		UserID:        1,
		OrderNumber:   "INV-SUB-TEST-001",
		PlanCode:      "pro_starter",
		PaymentStatus: "pending",
		FinalAmount:   50000,
	}
	db.Create(&order)

	secret := "test_secret_123"
	payloadMap := map[string]interface{}{
		"order_id":       "INV-SUB-TEST-001",
		"amount":         50000,
		"currency":       "IDR",
		"country_code":   "ID",
		"status":         "paid",
		"payment_method": "qris",
	}
	payloadBytes, _ := json.Marshal(payloadMap)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payloadBytes)
	validSig := hex.EncodeToString(mac.Sum(nil))

	t.Run("valid webhook should approve order and activate plan", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/webhooks/payment/aulaa", bytes.NewBuffer(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Webhook-Signature", validSig)

		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		if resp.StatusCode != fiber.StatusOK {
			t.Errorf("status = %d, want 200", resp.StatusCode)
		}

		var updated models.SubscriptionOrder
		db.First(&updated, order.ID)
		if updated.PaymentStatus != "paid" {
			t.Errorf("order.PaymentStatus = %q, want 'paid'", updated.PaymentStatus)
		}
		if updated.PaidAt == nil {
			t.Errorf("order.PaidAt should not be nil")
		}
	})

	t.Run("invalid signature should be rejected with 401", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/webhooks/payment/aulaa", bytes.NewBuffer(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Webhook-Signature", "wrong_signature_hex")

		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		if resp.StatusCode != fiber.StatusUnauthorized {
			t.Errorf("status = %d, want 401", resp.StatusCode)
		}
	})
}

func TestSubscriptionHandler_RejectAndApprove(t *testing.T) {
	db := setupTestDBForPayment(t)
	subHandler := NewSubscriptionHandler(db)

	app := fiber.New()
	app.Post("/api/admin/subscription/orders/:id/approve", func(c *fiber.Ctx) error {
		c.Locals("user_id", uint(99))
		c.Locals("email", "admin@test.com")
		return subHandler.ApproveOrder(c)
	})
	app.Post("/api/admin/subscription/orders/:id/reject", func(c *fiber.Ctx) error {
		c.Locals("user_id", uint(99))
		c.Locals("email", "admin@test.com")
		return subHandler.RejectOrder(c)
	})
	app.Put("/api/admin/subscription/orders/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", uint(99))
		c.Locals("email", "admin@test.com")
		return subHandler.AdminUpdateOrder(c)
	})

	t.Run("reject order with reason", func(t *testing.T) {
		order := models.SubscriptionOrder{
			StoreID:       1,
			UserID:        1,
			OrderNumber:   "INV-SUB-REJECT-01",
			PlanCode:      "pro_starter",
			PaymentStatus: "pending_verification",
			FinalAmount:   50000,
		}
		db.Create(&order)

		body := bytes.NewBufferString(`{"reason": "Bukti transfer buram dan tidak terbaca."}`)
		req := httptest.NewRequest("POST", "/api/admin/subscription/orders/1/reject", body)
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		if resp.StatusCode != fiber.StatusOK {
			t.Errorf("status = %d, want 200", resp.StatusCode)
		}

		var updated models.SubscriptionOrder
		db.First(&updated, order.ID)
		if updated.PaymentStatus != "rejected" {
			t.Errorf("status = %q, want 'rejected'", updated.PaymentStatus)
		}
		if updated.RejectionReason != "Bukti transfer buram dan tidak terbaca." {
			t.Errorf("reason = %q, want 'Bukti transfer buram dan tidak terbaca.'", updated.RejectionReason)
		}
	})

	t.Run("PUT compatibility endpoint sets active", func(t *testing.T) {
		order := models.SubscriptionOrder{
			StoreID:        1,
			UserID:         1,
			OrderNumber:    "INV-SUB-PUT-01",
			PlanCode:       "pro_starter",
			DurationMonths: 1,
			PaymentStatus:  "pending_verification",
			FinalAmount:    50000,
		}
		db.Create(&order)

		body := bytes.NewBufferString(`{"status": "active"}`)
		req := httptest.NewRequest("PUT", "/api/admin/subscription/orders/2", body)
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		if resp.StatusCode != fiber.StatusOK {
			t.Errorf("status = %d, want 200", resp.StatusCode)
		}

		var updated models.SubscriptionOrder
		db.First(&updated, order.ID)
		if updated.PaymentStatus != "paid" {
			t.Errorf("status = %q, want 'paid'", updated.PaymentStatus)
		}
	})
}
