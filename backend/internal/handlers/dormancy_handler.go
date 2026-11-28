package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"html"
	"strings"

	"catavor-backend/internal/models"
	"catavor-backend/internal/services"
	"gorm.io/gorm"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

type DormancyHandler struct {
	db *gorm.DB
}

func NewDormancyHandler(db *gorm.DB) *DormancyHandler {
	return &DormancyHandler{db: db}
}

func renderDormancyHTMLPage(c *fiber.Ctx, status int, titleColor, heading, bodyHTML string) error {
	c.Type("html", "utf-8")
	return c.Status(status).SendString(fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><title>Reaktivasi Toko</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 80vh; background: #0f172a; color: #f8fafc; padding: 20px;">
  <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 30px; max-width: 460px; width: 100%%; text-align: center;">
    <h2 style="color: %s; margin-top: 0;">%s</h2>
    %s
  </div>
</body>
</html>`, titleColor, html.EscapeString(heading), bodyHTML))
}

// HandlePublicReactivateStore renders a non-mutating confirmation page for magic link tokens from email.
// Separating GET (read-only check) from POST (actual mutation) prevents mail scanners / SafeLinks
// pre-fetches from consuming single-use reactivation tokens before the merchant clicks confirm.
func (h *DormancyHandler) HandlePublicReactivateStore(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	token := strings.TrimSpace(c.Query("token"))
	if token == "" {
		return renderDormancyHTMLPage(c, fiber.StatusBadRequest, "#ef4444", "Token Tidak Valid", `
    <p style="color: #94a3b8; font-size: 14px;">Tautan reaktivasi tidak valid atau telah kedaluwarsa.</p>
    <a href="/" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">Kembali ke Beranda</a>`)
	}

	store, err := services.ValidateReactivationToken(h.db, token)
	if err != nil {
		// SECURITY (N-02b): Log only SHA-256 fingerprint, never raw token.
		sum := sha256.Sum256([]byte(token))
		log.Warn().Err(err).Str("token_fp", hex.EncodeToString(sum[:4])).Msg("Invalid reactivation token validation")
		return renderDormancyHTMLPage(c, fiber.StatusBadRequest, "#ef4444", "Reaktivasi Gagal", fmt.Sprintf(`
    <p style="color: #94a3b8; font-size: 14px;">%s</p>
    <a href="/" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">Kembali ke Beranda</a>`,
			html.EscapeString(safeErrMsg(err, "Tautan reaktivasi tidak valid atau sudah kedaluwarsa."))))
	}

	return renderDormancyHTMLPage(c, fiber.StatusOK, "#38bdf8", "Konfirmasi Reaktivasi Katalog", fmt.Sprintf(`
    <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">Klik tombol di bawah ini untuk mengaktifkan kembali profil katalog <strong>%s</strong> dan memperpanjang masa aktif gratis selama 45 hari ke depan.</p>
    <form method="POST" action="/api/public/stores/reactivate" style="margin-top: 18px;">
      <input type="hidden" name="token" value="%s" />
      <button type="submit" style="padding: 12px 22px; background: #10b981; color: #ffffff; border: none; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer;">Aktifkan Kembali Katalog Sekarang</button>
    </form>`, html.EscapeString(store.StoreTitle), html.EscapeString(token)))
}

// HandlePublicReactivateStoreConfirm executes the 1-click magic link store reactivation via POST.
func (h *DormancyHandler) HandlePublicReactivateStoreConfirm(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	token := strings.TrimSpace(c.FormValue("token"))
	if token == "" {
		var body struct {
			Token string `json:"token"`
		}
		if err := c.BodyParser(&body); err == nil {
			token = strings.TrimSpace(body.Token)
		}
	}
	if token == "" {
		token = strings.TrimSpace(c.Query("token"))
	}
	if token == "" {
		return renderDormancyHTMLPage(c, fiber.StatusBadRequest, "#ef4444", "Token Tidak Valid", `
    <p style="color: #94a3b8; font-size: 14px;">Token reaktivasi tidak ditemukan.</p>
    <a href="/" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">Kembali ke Beranda</a>`)
	}

	store, err := services.ReactivateStoreByToken(h.db, token)
	if err != nil {
		// SECURITY (N-02b): Log only SHA-256 fingerprint, never raw token.
		sum := sha256.Sum256([]byte(token))
		log.Warn().Err(err).Str("token_fp", hex.EncodeToString(sum[:4])).Msg("Failed to reactivate store via token")
		return renderDormancyHTMLPage(c, fiber.StatusBadRequest, "#ef4444", "Reaktivasi Gagal", fmt.Sprintf(`
    <p style="color: #94a3b8; font-size: 14px;">%s</p>
    <a href="/" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">Kembali ke Beranda</a>`,
			html.EscapeString(safeErrMsg(err, "Tautan reaktivasi tidak valid atau sudah kedaluwarsa."))))
	}

	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		StoreID:     &store.ID,
		ActorRole:   "system",
		ActorName:   "Magic Link Reaktivasi",
		ActorEmail:  "system@catavor.com",
		Action:      "store.reactivate",
		Category:    "store",
		EntityType:  "store",
		EntityID:    &store.ID,
		EntityTitle: store.StoreTitle,
		Description: fmt.Sprintf("Katalog '%s' berhasil direaktivasi melalui Magic Link Email.", store.StoreTitle),
		IPAddress:   c.IP(),
		UserAgent:   c.Get("User-Agent"),
	})

	redirectURL := fmt.Sprintf("/%s/admin?reactivated=true", store.Slug)
	return c.Redirect(redirectURL, fiber.StatusSeeOther)
}

// HandleExtendStoreActivity handles manual 1-click extend from merchant dashboard.
func (h *DormancyHandler) HandleExtendStoreActivity(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"status":  "error",
			"message": "Sesi pengguna tidak valid.",
		})
	}

	store, _ := c.Locals("store").(*models.Store)

	// Explicit multi-store fallback resolution without blind First(&s) across stores
	if store == nil {
		reqSlug := strings.ToLower(strings.TrimSpace(c.Get("X-Store-Slug")))
		if reqSlug == "" {
			reqSlug = strings.ToLower(strings.TrimSpace(c.Query("store_slug")))
		}
		if reqSlug != "" {
			var s models.Store
			if err := h.db.Where("user_id = ? AND LOWER(slug) = ?", user.ID, reqSlug).First(&s).Error; err == nil {
				store = &s
			}
		} else {
			var owned []models.Store
			if err := h.db.Where("user_id = ?", user.ID).Limit(2).Find(&owned).Error; err == nil {
				if len(owned) == 1 {
					store = &owned[0]
				} else if len(owned) > 1 {
					return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
						"status":  "error",
						"code":    "STORE_CONTEXT_REQUIRED",
						"message": "Silakan pilih profil katalog spesifik (X-Store-Slug) sebelum memperpanjang masa aktif.",
					})
				}
			}
		}
	}

	if store == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"status":  "error",
			"message": "Toko tidak ditemukan untuk akun ini.",
		})
	}

	updatedStore, err := services.ReactivateStoreByID(h.db, store.ID)
	if err != nil {
		statusCode := fiber.StatusInternalServerError
		if strings.Contains(err.Error(), "tim kepatuhan") {
			statusCode = fiber.StatusForbidden
		}
		log.Error().Err(err).Msg("dormancy: ReactivateStoreByID gagal")
		return c.Status(statusCode).JSON(fiber.Map{
			"status":  "error",
			"message": safeErrMsg(err, "Gagal mengaktifkan kembali toko."),
		})
	}

	// Record Activity Log
	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		StoreID:     &store.ID,
		UserID:      &user.ID,
		ActorRole:   "merchant",
		ActorName:   user.Name,
		ActorEmail:  user.Email,
		Action:      "store.extend_activity",
		Category:    "store",
		EntityType:  "store",
		EntityID:    &store.ID,
		EntityTitle: store.StoreTitle,
		Description: fmt.Sprintf("Pemilik toko '%s' memperpanjang masa aktif katalog 45 hari ke depan.", store.StoreTitle),
		IPAddress:   c.IP(),
		UserAgent:   c.Get("User-Agent"),
	})

	return c.JSON(fiber.Map{
		"status":           "success",
		"message":          "Masa aktif katalog toko Anda berhasil diperpanjang 45 hari ke depan.",
		"last_activity_at": updatedStore.LastActivityAt,
		"dormancy_status":  updatedStore.DormancyStatus,
	})
}

// HandleGetDormancyMetrics returns dormancy and activity statistics for superadmin dashboard.
func (h *DormancyHandler) HandleGetDormancyMetrics(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	metrics := services.GetDormancyMetrics(h.db)
	return c.JSON(fiber.Map{
		"status": "success",
		"data":   metrics,
	})
}
