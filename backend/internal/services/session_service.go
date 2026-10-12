package services

import (
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/utils"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// RecordUserSession creates an active user session record for device tracking.
func RecordUserSession(userID uint, tokenID string, expiresAt time.Time, ip string, userAgent string) {
	if userID == 0 || tokenID == "" {
		return
	}

	devInfo := utils.ParseUserAgent(userAgent)
	now := time.Now()

	sess := models.UserSession{
		UserID:       userID,
		TokenID:      tokenID,
		IPAddress:    ip,
		UserAgent:    userAgent,
		DeviceName:   devInfo.DeviceName,
		DeviceType:   devInfo.DeviceType,
		Browser:      devInfo.Browser,
		OS:           devInfo.OS,
		LastActiveAt: now,
		ExpiresAt:    expiresAt,
		IsRevoked:    false,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := database.DB.Create(&sess).Error; err != nil {
		log.Warn().Err(err).Uint("user_id", userID).Msg("Failed to record user session in database")
	}
}

// TouchUserSession updates last_active_at for an active session (throttled to avoid heavy write load).
func TouchUserSession(tokenID string, ip string) {
	if tokenID == "" {
		return
	}

	// Update if last_active_at is older than 5 minutes
	now := time.Now()
	threshold := now.Add(-5 * time.Minute)

	_ = database.DB.Model(&models.UserSession{}).
		Where("token_id = ? AND is_revoked = false AND last_active_at < ?", tokenID, threshold).
		Updates(map[string]interface{}{
			"last_active_at": now,
			"ip_address":     ip,
			"updated_at":     now,
		}).Error
}

// RevokeSessionByTokenID revokes a specific session token across database and memory/Redis blacklist.
func RevokeSessionByTokenID(db *gorm.DB, tokenID string) error {
	if tokenID == "" {
		return nil
	}

	var sess models.UserSession
	if err := db.Where("token_id = ? AND is_revoked = false", tokenID).First(&sess).Error; err != nil {
		return err
	}

	now := time.Now()
	sess.IsRevoked = true
	sess.RevokedAt = &now
	_ = db.Save(&sess).Error

	ttl := 72 * time.Hour
	if sess.ExpiresAt.After(now) {
		ttl = time.Until(sess.ExpiresAt)
	}
	database.BlacklistToken(tokenID, ttl)

	return nil
}
