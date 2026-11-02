package handlers

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type PaymentHandler struct {
	db *gorm.DB
}

func NewPaymentHandler(db *gorm.DB) *PaymentHandler {
	return &PaymentHandler{db: db}
}

// HandleAulaaWebhook processes incoming server-to-server webhook notifications from Aulaa.co
func (h *PaymentHandler) HandleAulaaWebhook(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	rawBody := c.Body()
	sigHeader := c.Get("X-Webhook-Signature")

	aulaaCfg := services.GetAulaaConfig(h.db)
	if aulaaCfg.WebhookSecret != "" {
		if !services.VerifyAulaaSignature(rawBody, sigHeader, aulaaCfg.WebhookSecret) {
			log.Warn().
				Str("received_sig", sigHeader).
				Str("ip", c.IP()).
				Msg("payment_webhook: invalid Aulaa HMAC signature rejected")
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"message": "Signature webhook tidak valid.",
			})
		}
	}

	var payload services.AulaaWebhookPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		log.Error().Err(err).Str("body", string(rawBody)).Msg("payment_webhook: gagal membedah json payload")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format payload webhook tidak valid.",
		})
	}

	orderNumber := strings.TrimSpace(payload.OrderID)
	if orderNumber == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "order_id kosong pada webhook payload.",
		})
	}

	tx := h.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var order models.SubscriptionOrder
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("order_number = ?", orderNumber).
		First(&order).Error; err != nil {
		tx.Rollback()
		log.Warn().Str("order_number", orderNumber).Msg("payment_webhook: pesanan tidak ditemukan di database")
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": fmt.Sprintf("Pesanan '%s' tidak ditemukan.", orderNumber),
		})
	}

	// Idempotency: Jika order sudah dibayar sebelumnya, acknowledge dengan 200 OK
	if order.PaymentStatus == "paid" {
		tx.Rollback()
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"success": true,
			"message": "Pesanan sudah berstatus lunas sebelumnya.",
		})
	}

	cleanStatus := strings.ToLower(strings.TrimSpace(payload.Status))
	if cleanStatus == "paid" {
		now := time.Now().UTC()
		order.PaymentStatus = "paid"
		order.PaidAt = &now
		if payload.PaymentMethod != "" {
			order.PaymentMethod = strings.ToLower(payload.PaymentMethod)
		}
		order.GatewayRawResponse = datatypes.JSON(rawBody)

		if err := tx.Save(&order).Error; err != nil {
			tx.Rollback()
			log.Error().Err(err).Msg("payment_webhook: gagal memperbarui status order ke paid")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal menyimpan status transaksi.",
			})
		}

		quota, err := services.UpgradeStorePlan(tx, order.StoreID, order.PlanCode, order.DurationMonths)
		if err != nil {
			tx.Rollback()
			log.Error().Err(err).Msg("payment_webhook: gagal aktivasi kuota toko")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal mengaktifkan paket toko.",
			})
		}

		if err := tx.Commit().Error; err != nil {
			log.Error().Err(err).Msg("payment_webhook: commit transaksi gagal")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal commit status pesanan.",
			})
		}

		log.Info().
			Uint("order_id", order.ID).
			Str("order_number", order.OrderNumber).
			Uint("store_id", order.StoreID).
			Str("plan", order.PlanCode).
			Msg("payment_webhook: transaksi Aulaa sukses diverifikasi & paket toko aktif")

		_ = quota
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"success": true,
			"message": "Webhook pembayaran berhasil diproses dan paket telah aktif.",
		})
	} else if cleanStatus == "expired" || cleanStatus == "cancelled" {
		order.PaymentStatus = cleanStatus
		order.GatewayRawResponse = datatypes.JSON(rawBody)
		_ = tx.Save(&order).Error
		tx.Commit()
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"success": true,
			"message": fmt.Sprintf("Status pesanan diperbarui menjadi %s.", cleanStatus),
		})
	}

	tx.Rollback()
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"message": "Status diterima tanpa perubahan.",
	})
}

// SyncOrderStatus syncs payment state directly with Aulaa.co when requested by the store owner or admin
func (h *PaymentHandler) SyncOrderStatus(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	orderIDVal, err := c.ParamsInt("id")
	if err != nil || orderIDVal <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "ID pesanan tidak valid.",
		})
	}

	var order models.SubscriptionOrder
	if err := h.db.First(&order, uint(orderIDVal)).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Pesanan tidak ditemukan.",
		})
	}

	if order.PaymentStatus == "paid" {
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Pesanan sudah berstatus lunas.",
			"data":    order,
		})
	}

	if order.GatewayReference == "" || order.GatewayProvider != "aulaa" {
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Pesanan ini menggunakan verifikasi manual atau belum terhubung gateway.",
			"data":    order,
		})
	}

	aulaaCfg := services.GetAulaaConfig(h.db)
	statusResp, err := services.CheckAulaaPaymentStatus(aulaaCfg, order.GatewayReference)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"success": false,
			"message": fmt.Sprintf("Gagal memeriksa status ke Aulaa: %v", err),
		})
	}

	if strings.ToLower(statusResp.Status) == "paid" {
		now := time.Now().UTC()
		order.PaymentStatus = "paid"
		order.PaidAt = &now
		if statusResp.PaymentMethod != "" {
			order.PaymentMethod = strings.ToLower(statusResp.PaymentMethod)
		}
		rawB, _ := json.Marshal(statusResp)
		order.GatewayRawResponse = datatypes.JSON(rawB)
		_ = h.db.Save(&order).Error

		quota, err := services.UpgradeStorePlan(h.db, order.StoreID, order.PlanCode, order.DurationMonths)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Pembayaran lunas namun gagal mengaktifkan paket toko.",
			})
		}

		return c.JSON(fiber.Map{
			"success": true,
			"message": "Pembayaran berhasil diverifikasi langsung dari Aulaa.co!",
			"order":   order,
			"quota":   quota,
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("Status tagihan saat ini: %s", statusResp.Status),
		"order":   order,
	})
}

