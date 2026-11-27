package handlers

import (
	"fmt"
	"strconv"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/middleware"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type SessionHandler struct {
	cfg *config.Config
	db  *gorm.DB
}

func NewSessionHandler(cfg *config.Config, db *gorm.DB) *SessionHandler {
	return &SessionHandler{cfg: cfg, db: db}
}

// GetSessions lists all active connected devices and sessions for the current user.
func (h *SessionHandler) GetSessions(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}
	claims, _ := c.Locals("claims").(*middleware.JWTClaims)

	var currentTokenID string
	if claims != nil {
		currentTokenID = claims.ID
	}

	var sessions []models.UserSession
	now := time.Now()
	err := h.db.Where("user_id = ? AND is_revoked = false AND expires_at > ?", user.ID, now).
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
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}
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
	if err := h.db.Where("id = ? AND user_id = ?", uint(sessionID), user.ID).First(&session).Error; err != nil {
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

	if err := services.RevokeSessionByTokenID(h.db, session.TokenID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mencabut sesi perangkat.",
		})
	}

	isCurrent := (claims != nil && claims.ID == session.TokenID)
	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		UserID:      &user.ID,
		ActorRole:   user.PlatformStaffRoleLabel(),
		ActorName:   user.Name,
		ActorEmail:  user.Email,
		Action:      "auth.session_revoke",
		Category:    "security",
		EntityType:  "user_session",
		EntityID:    &session.ID,
		EntityTitle: session.DeviceName,
		Description: fmt.Sprintf("Mencabut sesi perangkat %s (%s / %s).", session.DeviceName, session.OS, session.Browser),
		Changes: map[string]interface{}{
			"session_id":  session.ID,
			"device_name": session.DeviceName,
			"session_ip":  session.IPAddress,
			"is_current":  isCurrent,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	return c.JSON(fiber.Map{
		"success":    true,
		"message":    "Sesi perangkat berhasil dicabut.",
		"is_current": isCurrent,
	})
}

// RevokeOtherSessions revokes all active sessions for the user except the current session.
func (h *SessionHandler) RevokeOtherSessions(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}
	claims, _ := c.Locals("claims").(*middleware.JWTClaims)

	if claims == nil || claims.ID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Sesi saat ini tidak dapat diverifikasi.",
		})
	}

	revokedCount, err := services.RevokeOtherSessionsForUser(h.db, user.ID, claims.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memproses pencabutan sesi.",
		})
	}

	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		UserID:      &user.ID,
		ActorRole:   user.PlatformStaffRoleLabel(),
		ActorName:   user.Name,
		ActorEmail:  user.Email,
		Action:      "auth.sessions_revoke_others",
		Category:    "security",
		EntityType:  "user_session",
		EntityID:    &user.ID,
		EntityTitle: user.Email,
		Description: fmt.Sprintf("Mengeluarkan %d sesi perangkat lain pada akun %s.", revokedCount, user.Email),
		Changes: map[string]interface{}{
			"revoked_count": revokedCount,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	return c.JSON(fiber.Map{
		"success":       true,
		"message":       "Seluruh perangkat lain berhasil dikeluarkan.",
		"revoked_count": revokedCount,
	})
}
