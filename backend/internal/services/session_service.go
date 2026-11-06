package services

import (
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/utils"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// runBackground menjalankan tugas latar belakang tanpa membiarkan panic
// mematikan proses.
//
// Goroutine fire-and-forget tidak tercakup recover middleware Fiber: satu
// panic di sini akan menghentikan seluruh server. RecordUserSession dipanggil
// sebagai `go services.RecordUserSession(...)` dari beberapa jalur login, jadi
// kegagalan di dalamnya (mis. database.DB belum siap) harus ditelan, bukan
// menjatuhkan proses.
func runBackground(task string, fn func()) {
	defer func() {
		if r := recover(); r != nil {
			log.Error().Interface("panic", r).Str("task", task).Msg("tugas latar belakang panik dan dihentikan")
		}
	}()
	fn()
}

// RecordUserSession creates an active user session record for device tracking.
func RecordUserSession(userID uint, tokenID string, expiresAt time.Time, ip string, userAgent string) {
	if userID == 0 || tokenID == "" {
		return
	}
	runBackground("RecordUserSession", func() {
		recordUserSession(userID, tokenID, expiresAt, ip, userAgent)
	})
}

func recordUserSession(userID uint, tokenID string, expiresAt time.Time, ip string, userAgent string) {
	if database.DB == nil {
		return
	}

	now := time.Now()

	// LRU Auto-Eviction: Enforce max 10 active concurrent sessions per user (Industry Standard)
	var activeCount int64
	database.DB.Model(&models.UserSession{}).
		Where("user_id = ? AND is_revoked = false AND expires_at > ?", userID, now).
		Count(&activeCount)

	if activeCount >= 10 {
		excess := int(activeCount - 9)
		var oldestSessions []models.UserSession
		if err := database.DB.Where("user_id = ? AND is_revoked = false AND expires_at > ?", userID, now).
			Order("last_active_at ASC").
			Limit(excess).
			Find(&oldestSessions).Error; err == nil {
			for _, s := range oldestSessions {
				s.IsRevoked = true
				s.RevokedAt = &now
				_ = database.DB.Save(&s).Error

				ttl := 72 * time.Hour
				if s.ExpiresAt.After(now) {
					ttl = time.Until(s.ExpiresAt)
				}
				if s.TokenID != "" {
					database.BlacklistToken(s.TokenID, ttl)
				}
			}
		}
	}

	devInfo := utils.ParseUserAgent(userAgent)

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
	if tokenID == "" || database.DB == nil {
		return
	}

	runBackground("TouchUserSession", func() {
		touchUserSession(tokenID, ip)
	})
}

func touchUserSession(tokenID string, ip string) {
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
	if db == nil {
		db = database.DB
	}
	if db == nil {
		return nil
	}

	var sess models.UserSession
	if err := db.Where("token_id = ? AND is_revoked = false", tokenID).First(&sess).Error; err != nil {
		// Even if not found or already marked revoked in DB, ensure token is blacklisted in cache
		database.BlacklistToken(tokenID, 72*time.Hour)
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

// RevokeOtherSessionsForUser revokes all active sessions for a user except the current session token ID.
// Returns the number of sessions revoked and any error encountered.
func RevokeOtherSessionsForUser(db *gorm.DB, userID uint, currentTokenID string) (int, error) {
	if userID == 0 {
		return 0, nil
	}
	if db == nil {
		db = database.DB
	}
	if db == nil {
		return 0, nil
	}

	now := time.Now()
	var otherSessions []models.UserSession
	query := db.Where("user_id = ? AND is_revoked = false AND expires_at > ?", userID, now)
	if currentTokenID != "" {
		query = query.Where("token_id != ?", currentTokenID)
	}

	if err := query.Find(&otherSessions).Error; err != nil {
		return 0, err
	}

	revokedCount := 0
	for _, s := range otherSessions {
		nowRevoked := time.Now()
		s.IsRevoked = true
		s.RevokedAt = &nowRevoked
		_ = db.Save(&s).Error

		ttl := 72 * time.Hour
		if s.ExpiresAt.After(nowRevoked) {
			ttl = time.Until(s.ExpiresAt)
		}
		if s.TokenID != "" {
			database.BlacklistToken(s.TokenID, ttl)
		}
		revokedCount++
	}

	log.Info().Uint("user_id", userID).Int("revoked_count", revokedCount).Msg("Successfully revoked other sessions for user")
	return revokedCount, nil
}

// CleanupExpiredUserSessions deletes user session records that have been expired for more than 30 days.
func CleanupExpiredUserSessions(db *gorm.DB) (int64, error) {
	if db == nil {
		db = database.DB
	}
	if db == nil {
		return 0, nil
	}
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)
	res := db.Where("expires_at < ?", thirtyDaysAgo).Delete(&models.UserSession{})
	if res.Error != nil {
		return 0, res.Error
	}
	return res.RowsAffected, nil
}

// RevokeAllSessionsForUser revokes and blacklists all active sessions for a user,
// ensuring immediate kick-out upon user or catalog ban.
func RevokeAllSessionsForUser(db *gorm.DB, userID uint) error {
	if userID == 0 {
		return nil
	}

	now := time.Now()

	// 1. Fetch active session token IDs
	var sessions []models.UserSession
	if err := db.Where("user_id = ? AND is_revoked = false", userID).Find(&sessions).Error; err != nil {
		log.Warn().Err(err).Uint("user_id", userID).Msg("Failed to query active sessions for revocation")
	} else {
		for _, s := range sessions {
			ttl := 72 * time.Hour
			if s.ExpiresAt.After(now) {
				ttl = time.Until(s.ExpiresAt)
			}
			if s.TokenID != "" {
				database.BlacklistToken(s.TokenID, ttl)
			}
		}
	}

	// 2. Mark all sessions as revoked in database
	_ = db.Model(&models.UserSession{}).
		Where("user_id = ? AND is_revoked = false", userID).
		Updates(map[string]interface{}{
			"is_revoked": true,
			"revoked_at": &now,
			"updated_at": now,
		}).Error

	// 3. Increment TokenVersion on User record to immediately invalidate any lingering JWTs
	_ = db.Model(&models.User{}).Where("id = ?", userID).UpdateColumn("token_version", gorm.Expr("token_version + 1")).Error

	log.Info().Uint("user_id", userID).Msg("Successfully revoked all active sessions and bumped token_version.")
	return nil
}

