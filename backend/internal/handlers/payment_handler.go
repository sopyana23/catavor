package handlers

import (
	"encoding/json"
	"fmt"
	"strconv"
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
	if strings.TrimSpace(aulaaCfg.WebhookSecret) == "" {
		log.Error().Msg("payment_webhook: aulaa_webhook_secret belum dikonfigurasi di pengaturan platform")
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Webhook secret gateway belum dikonfigurasi pada sistem.",
		})
	}
	if strings.TrimSpace(sigHeader) == "" || !services.VerifyAulaaSignature(rawBody, sigHeader, aulaaCfg.WebhookSecret) {
		log.Warn().
			Str("received_sig", sigHeader).
			Str("ip", c.IP()).
			Msg("payment_webhook: invalid or missing Aulaa HMAC signature rejected")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Signature webhook tidak valid atau tidak disertakan.",
		})
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
		First(&order).Error; err == nil {
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
			// Validasi nominal pembayaran untuk mencegah manipulasi underpayment
			if payload.Amount > 0 && payload.Amount < order.FinalAmount {
				tx.Rollback()
				log.Warn().
					Float64("payload_amount", payload.Amount).
					Float64("order_amount", order.FinalAmount).
					Str("order_number", order.OrderNumber).
					Msg("payment_webhook: nominal pembayaran lebih kecil dari tagihan (underpayment)")
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"success": false,
					"message": "Nominal pembayaran tidak mencukupi nilai tagihan.",
				})
			}

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

	// 2. Jika tidak ditemukan di SubscriptionOrder, cari di AdOrder
	var adOrder models.AdOrder
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("order_number = ?", orderNumber).
		First(&adOrder).Error; err != nil {
		tx.Rollback()
		log.Warn().Str("order_number", orderNumber).Msg("payment_webhook: pesanan langganan/iklan tidak ditemukan di database")
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": fmt.Sprintf("Pesanan '%s' tidak ditemukan.", orderNumber),
		})
	}

	if adOrder.PaymentStatus == "paid" {
		tx.Rollback()
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"success": true,
			"message": "Pesanan sewa iklan sudah berstatus lunas sebelumnya.",
		})
	}

	cleanStatus := strings.ToLower(strings.TrimSpace(payload.Status))
	if cleanStatus == "paid" {
		// Validasi nominal pembayaran iklan
		if payload.Amount > 0 && payload.Amount < adOrder.FinalAmount {
			tx.Rollback()
			log.Warn().
				Float64("payload_amount", payload.Amount).
				Float64("order_amount", adOrder.FinalAmount).
				Str("order_number", adOrder.OrderNumber).
				Msg("payment_webhook: nominal pembayaran sewa iklan lebih kecil dari tagihan")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Nominal pembayaran sewa iklan tidak mencukupi nilai tagihan.",
			})
		}

		now := time.Now().UTC()
		adOrder.PaymentStatus = "paid"
		adOrder.PaidAt = &now
		if payload.PaymentMethod != "" {
			adOrder.PaymentMethod = strings.ToLower(payload.PaymentMethod)
		}
		adOrder.GatewayRawResponse = datatypes.JSON(rawBody)

		if err := tx.Save(&adOrder).Error; err != nil {
			tx.Rollback()
			log.Error().Err(err).Msg("payment_webhook: gagal memperbarui status ad_order ke paid")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal menyimpan status transaksi iklan.",
			})
		}

		// Aktifkan status kampanye iklan
		if err := tx.Model(&models.AdCampaign{}).
			Where("id = ?", adOrder.CampaignID).
			Updates(map[string]interface{}{
				"status":     "active",
				"updated_at": now,
			}).Error; err != nil {
			tx.Rollback()
			log.Error().Err(err).Msg("payment_webhook: gagal aktivasi kampanye iklan")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal mengaktifkan status kampanye iklan.",
			})
		}

		if err := tx.Commit().Error; err != nil {
			log.Error().Err(err).Msg("payment_webhook: commit transaksi sewa iklan gagal")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal commit status pesanan iklan.",
			})
		}

		log.Info().
			Uint64("ad_order_id", adOrder.ID).
			Str("order_number", adOrder.OrderNumber).
			Uint64("campaign_id", adOrder.CampaignID).
			Msg("payment_webhook: transaksi sewa iklan Aulaa sukses diverifikasi & kampanye aktif")

		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"success": true,
			"message": "Webhook pembayaran sewa iklan berhasil diproses dan kampanye telah aktif.",
		})
	} else if cleanStatus == "expired" || cleanStatus == "cancelled" {
		adOrder.PaymentStatus = cleanStatus
		adOrder.GatewayRawResponse = datatypes.JSON(rawBody)
		_ = tx.Save(&adOrder).Error
		_ = tx.Model(&models.AdCampaign{}).Where("id = ?", adOrder.CampaignID).Update("status", "cancelled").Error
		tx.Commit()
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"success": true,
			"message": fmt.Sprintf("Status pesanan iklan diperbarui menjadi %s.", cleanStatus),
		})
	}

	tx.Rollback()
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"message": "Status iklan diterima tanpa perubahan.",
	})
}

// SyncOrderStatus syncs payment state directly with Aulaa.co when requested by the store owner or admin.
// SECURITY (N-41): enforces tenant ownership (order.StoreID == callerStoreID) for non-staff callers,
// validates paid amount against order.FinalAmount, and uses row-level locking (SELECT ... FOR UPDATE)
// inside a DB transaction to prevent double-plan-extension race conditions with concurrent webhooks.
func (h *PaymentHandler) SyncOrderStatus(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	idOrNumber := strings.TrimSpace(c.Params("id"))
	if idOrNumber == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "ID atau nomor pesanan tidak valid.",
		})
	}

	var isPlatformStaff bool
	if u, ok := c.Locals("user").(*models.User); ok && u != nil && u.IsPlatformStaff() {
		isPlatformStaff = true
	}
	var callerStoreID uint
	if sid, ok := c.Locals("store_id").(uint); ok {
		callerStoreID = sid
	}

	var order models.SubscriptionOrder
	if numID, err := strconv.Atoi(idOrNumber); err == nil && numID > 0 {
		if err := h.db.First(&order, uint(numID)).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"message": "Pesanan tidak ditemukan.",
			})
		}
	} else {
		if err := h.db.Where("order_number = ?", idOrNumber).First(&order).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"message": "Pesanan tidak ditemukan.",
			})
		}
	}

	// SECURITY (N-41): Prevent cross-tenant IDOR / BOLA when invoked by a merchant.
	if !isPlatformStaff {
		if callerStoreID == 0 || order.StoreID != callerStoreID {
			log.Warn().
				Uint("caller_store_id", callerStoreID).
				Uint("target_store_id", order.StoreID).
				Str("order_number", order.OrderNumber).
				Msg("payment_sync: cross-tenant order sync attempt blocked")
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"message": "Pesanan tidak ditemukan.",
			})
		}
	}

	if order.PaymentStatus == "paid" {
		quota, _ := services.GetStoreQuotaInfo(h.db, order.StoreID)
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Pesanan sudah berstatus lunas.",
			"data":    order,
			"order":   order,
			"quota":   quota,
		})
	}

	if order.GatewayReference == "" || order.GatewayProvider != "aulaa" {
		quota, _ := services.GetStoreQuotaInfo(h.db, order.StoreID)
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Pesanan ini menggunakan verifikasi manual atau belum terhubung gateway.",
			"data":    order,
			"order":   order,
			"quota":   quota,
		})
	}

	aulaaCfg := services.GetAulaaConfig(h.db)
	statusResp, err := services.CheckAulaaPaymentStatus(aulaaCfg, order.GatewayReference)
	if err != nil {
		log.Warn().Err(err).Str("order_number", order.OrderNumber).Msg("payment_sync: gagal memeriksa status ke Aulaa")
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memeriksa status pembayaran ke gateway Aulaa. Silakan coba beberapa saat lagi.",
		})
	}

	if strings.ToLower(strings.TrimSpace(statusResp.Status)) == "paid" {
		if statusResp.Amount > 0 && statusResp.Amount < order.FinalAmount {
			log.Error().
				Str("order_number", order.OrderNumber).
				Float64("expected_amount", order.FinalAmount).
				Float64("gateway_amount", statusResp.Amount).
				Msg("payment_sync: underpayment detected from Aulaa status check")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Nominal pembayaran yang tercatat pada gateway kurang dari tagihan pesanan.",
			})
		}

		tx := h.db.Begin()
		if tx.Error != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal memulai transaksi database.",
			})
		}
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
			}
		}()

		var lockedOrder models.SubscriptionOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&lockedOrder, order.ID).Error; err != nil {
			tx.Rollback()
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"message": "Pesanan tidak ditemukan.",
			})
		}

		if lockedOrder.PaymentStatus == "paid" {
			tx.Rollback()
			quota, _ := services.GetStoreQuotaInfo(h.db, lockedOrder.StoreID)
			return c.JSON(fiber.Map{
				"success": true,
				"message": "Pesanan sudah berstatus lunas.",
				"data":    lockedOrder,
				"order":   lockedOrder,
				"quota":   quota,
			})
		}

		now := time.Now().UTC()
		lockedOrder.PaymentStatus = "paid"
		lockedOrder.PaidAt = &now
		if statusResp.PaymentMethod != "" {
			lockedOrder.PaymentMethod = strings.ToLower(statusResp.PaymentMethod)
		}
		rawB, _ := json.Marshal(statusResp)
		lockedOrder.GatewayRawResponse = datatypes.JSON(rawB)
		if err := tx.Save(&lockedOrder).Error; err != nil {
			tx.Rollback()
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal menyimpan status pembayaran pesanan.",
			})
		}

		quota, err := services.UpgradeStorePlan(tx, lockedOrder.StoreID, lockedOrder.PlanCode, lockedOrder.DurationMonths)
		if err != nil {
			tx.Rollback()
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Pembayaran lunas namun gagal mengaktifkan paket toko.",
			})
		}

		if err := tx.Commit().Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal menyelesaikan transaksi aktivasi paket.",
			})
		}

		return c.JSON(fiber.Map{
			"success": true,
			"message": "Pembayaran berhasil diverifikasi langsung dari Aulaa.co!",
			"order":   lockedOrder,
			"quota":   quota,
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("Status tagihan saat ini: %s", statusResp.Status),
		"order":   order,
	})
}

// TestAulaaConnection allows platform administrators to test their Aulaa API credentials and fetch active payment channels.
// SECURITY (N-42): validates BaseURL against SSRF and prevents stored API key exfiltration to untrusted custom hosts.
func (h *PaymentHandler) TestAulaaConnection(c *fiber.Ctx) error {
	var req struct {
		APIKey  string `json:"api_key"`
		BaseURL string `json:"base_url"`
	}
	_ = c.BodyParser(&req)

	cfg := services.GetAulaaConfig(h.db)
	savedBaseURL := cfg.BaseURL

	reqAPIKey := strings.TrimSpace(req.APIKey)
	if reqAPIKey != "" && !strings.Contains(reqAPIKey, "****") {
		cfg.APIKey = reqAPIKey
	}

	if strings.TrimSpace(req.BaseURL) != "" {
		validURL, err := services.ValidateAulaaBaseURL(req.BaseURL)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": err.Error(),
			})
		}
		// SECURITY (N-42): Do not transmit the saved database APIKey to a different custom BaseURL
		// unless the administrator explicitly supplies the APIKey in the test request.
		if !strings.EqualFold(validURL, savedBaseURL) && (reqAPIKey == "" || strings.Contains(reqAPIKey, "****")) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Untuk menguji Base URL baru, masukkan kembali API Key Aulaa secara eksplisit demi keamanan kredensial.",
			})
		}
		cfg.BaseURL = validURL
	}

	if cfg.APIKey == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "API Key Aulaa belum diisi. Masukkan API Key sebelum melakukan uji koneksi.",
		})
	}

	methods, err := services.GetAulaaPaymentMethods(cfg)
	if err != nil {
		log.Warn().Err(err).Str("base_url", cfg.BaseURL).Msg("Uji koneksi Aulaa gagal")
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"success": false,
			"message": "Gagal terhubung ke Aulaa API. Periksa kembali Base URL dan validitas API Key Anda.",
		})
	}

	return c.JSON(fiber.Map{
		"success":  true,
		"message":  "Koneksi ke Gateway Aulaa.co berhasil diverifikasi!",
		"base_url": cfg.BaseURL,
		"methods":  methods,
	})
}


