package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"html"
	"strings"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

// HandlePublicReactivateStore handles 1-click magic link reactivation from emails.
func HandlePublicReactivateStore(c *fiber.Ctx) error {
	token := strings.TrimSpace(c.Query("token"))
	if token == "" {
		return c.Status(fiber.StatusBadRequest).SendString(`
<!DOCTYPE html>
<html>
<head><title>Reaktivasi Toko</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 80vh; background: #0f172a; color: #f8fafc; padding: 20px;">
  <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 30px; max-width: 460px; text-align: center;">
    <h2 style="color: #ef4444; margin-top: 0;">Token Tidak Valid</h2>
    <p style="color: #94a3b8; font-size: 14px;">Tautan reaktivasi tidak valid atau telah kedaluwarsa.</p>
    <a href="/" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">Kembali ke Beranda</a>
  </div>
</body>
</html>
`)
	}

	store, err := services.ReactivateStoreByToken(database.DB, token)
	if err != nil {
		// SECURITY (N-02b): JANGAN catat token ke log. Token reaktivasi adalah
		// kapabilitas sekali-pakai — siapa pun yang membaca log bisa memakainya.
		// Catat hanya sidik jari (8 hex pertama sha256) untuk korelasi.
		sum := sha256.Sum256([]byte(token))
		log.Warn().Err(err).Str("token_fp", hex.EncodeToString(sum[:4])).Msg("Failed to reactivate store via token")
		return c.Status(fiber.StatusBadRequest).SendString(fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><title>Reaktivasi Toko</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 80vh; background: #0f172a; color: #f8fafc; padding: 20px;">
  <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 30px; max-width: 460px; text-align: center;">
    <h2 style="color: #ef4444; margin-top: 0;">Reaktivasi Gagal</h2>
    <p style="color: #94a3b8; font-size: 14px;">%s</p>
    <a href="/" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">Kembali ke Beranda</a>
  </div>
</body>
</html>
`, html.EscapeString(safeErrMsg(err, "Tautan reaktivasi tidak valid atau sudah kedaluwarsa."))))
	}

	// Record Activity Log
	services.RecordActivity(services.RecordActivityParams{
		DB:          database.DB,
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

	// Success: Redirect user to their store admin dashboard with a celebratory query parameter
	redirectURL := fmt.Sprintf("/%s/admin?reactivated=true", store.Slug)
	return c.Redirect(redirectURL, fiber.StatusTemporaryRedirect)
}

// HandleExtendStoreActivity handles manual 1-click extend from merchant dashboard.
func HandleExtendStoreActivity(c *fiber.Ctx) error {
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"status":  "error",
			"message": "Sesi pengguna tidak valid.",
		})
	}

	store, _ := c.Locals("store").(*models.Store)

	// Fallback lookup by UserID
	if store == nil {
		var s models.Store
		if err := database.DB.Where("user_id = ?", user.ID).First(&s).Error; err == nil {
			store = &s
		}
	}

	if store == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"status":  "error",
			"message": "Toko tidak ditemukan untuk akun ini.",
		})
	}

	updatedStore, err := services.ReactivateStoreByID(database.DB, store.ID)
	if err != nil {
		log.Error().Err(err).Msg("dormancy: ReactivateStoreByID gagal")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": safeErrMsg(err, "Gagal mengaktifkan kembali toko."),
		})
	}

	// Record Activity Log
	services.RecordActivity(services.RecordActivityParams{
		DB:          database.DB,
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
func HandleGetDormancyMetrics(c *fiber.Ctx) error {
	metrics := services.GetDormancyMetrics(database.DB)
	return c.JSON(fiber.Map{
		"status": "success",
		"data":   metrics,
	})
}
