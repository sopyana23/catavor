package handlers

import (
	"strconv"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/middleware"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
)

type SessionHandler struct {
	cfg *config.Config
}

func NewSessionHandler(cfg *config.Config) *SessionHandler {
	return &SessionHandler{cfg: cfg}
}

// GetSessions lists all active connected devices and sessions for the current user.
func (h *SessionHandler) GetSessions(c *fiber.Ctx) error {
	user := c.Locals("user").(*models.User)
	claims, _ := c.Locals("claims").(*middleware.JWTClaims)

	var currentTokenID string
	if claims != nil {
		currentTokenID = claims.ID
	}

	var sessions []models.UserSession
	now := time.Now()
	err := database.DB.Where("user_id = ? AND is_revoked = false AND expires_at > ?", user.ID, now).
		Order("last_active_at DESC").
		Find(&sessions).Error
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil daftar sesi perangkat.",
		})
	}

	res := make([]models.UserSessionResponse, 0, len(sessions))
	for _, s := range sessions {
		isCurrent := (currentTokenID != "" && s.TokenID == currentTokenID)
		res = append(res, models.UserSessionResponse{
			ID:           s.ID,
			DeviceName:   s.DeviceName,
			DeviceType:   s.DeviceType,
			Browser:      s.Browser,
			OS:           s.OS,
			IPAddress:    s.IPAddress,
			Location:     s.Location,
			LastActiveAt: s.LastActiveAt,
			CreatedAt:    s.CreatedAt,
			IsCurrent:    isCurrent,
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    res,
	})
}

// RevokeSession revokes a specific session by its session ID.
func (h *SessionHandler) RevokeSession(c *fiber.Ctx) error {
	user := c.Locals("user").(*models.User)
	claims, _ := c.Locals("claims").(*middleware.JWTClaims)

	sessionIDStr := c.Params("id")
	sessionID, err := strconv.ParseUint(sessionIDStr, 10, 32)
	if err != nil || sessionID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "ID sesi tidak valid.",
		})
	}

	var session models.UserSession
	if err := database.DB.Where("id = ? AND user_id = ?", uint(sessionID), user.ID).First(&session).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Sesi perangkat tidak ditemukan.",
		})
	}

	if session.IsRevoked {
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Sesi telah dicabut sebelumnya.",
		})
	}

	if err := services.RevokeSessionByTokenID(database.DB, session.TokenID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mencabut sesi perangkat.",
		})
	}

	isCurrent := (claims != nil && claims.ID == session.TokenID)

	return c.JSON(fiber.Map{
		"success":    true,
		"message":    "Sesi perangkat berhasil dicabut.",
		"is_current": isCurrent,
	})
}

// RevokeOtherSessions revokes all active sessions for the user except the current session.
func (h *SessionHandler) RevokeOtherSessions(c *fiber.Ctx) error {
	user := c.Locals("user").(*models.User)
	claims, _ := c.Locals("claims").(*middleware.JWTClaims)

	if claims == nil || claims.ID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Sesi saat ini tidak dapat diverifikasi.",
		})
	}

	var otherSessions []models.UserSession
	now := time.Now()
	err := database.DB.Where("user_id = ? AND token_id != ? AND is_revoked = false AND expires_at > ?", user.ID, claims.ID, now).
		Find(&otherSessions).Error
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memproses pencabutan sesi.",
		})
	}

	revokedCount := 0
	for _, s := range otherSessions {
		_ = services.RevokeSessionByTokenID(database.DB, s.TokenID)
		revokedCount++
	}

	return c.JSON(fiber.Map{
		"success":       true,
		"message":       "Seluruh perangkat lain berhasil dikeluarkan.",
		"revoked_count": revokedCount,
	})
}
