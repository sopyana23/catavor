package services

import (
	"errors"
	"strings"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/utils"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

var (
	ErrSessionStorageUnavailable = errors.New("session: penyimpanan sesi tidak tersedia")
	ErrSessionInvalidInput       = errors.New("session: parameter sesi tidak lengkap")
	ErrSessionNotFound           = errors.New("session: sesi aktif tidak ditemukan")
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

func sanitizeSessionIP(ip string) string {
	clean := strings.TrimSpace(ip)
	if clean == "" {
		return "0.0.0.0"
	}
	if idx := strings.Index(clean, ","); idx != -1 {
		clean = strings.TrimSpace(clean[:idx])
	}
	if len(clean) > 64 {
		clean = clean[:64]
	}
	return clean
}

// CreateUserSessionTx menulis baris sesi aktif di dalam transaksi yang sedang
// berjalan. Semua error database dipropagasikan agar pemanggil dapat fail-closed
// sebelum menerbitkan token atau cookie. Mengembalikan daftar token_id lama
// yang tergusur oleh batas LRU (maks 10 sesi aktif) untuk di-blacklist setelah commit.
func CreateUserSessionTx(tx *gorm.DB, userID uint, tokenID string, expiresAt time.Time, ip string, userAgent string, now time.Time) (*models.UserSession, []string, error) {
	if tx == nil {
		return nil, nil, ErrSessionStorageUnavailable
	}
	if userID == 0 || strings.TrimSpace(tokenID) == "" || expiresAt.IsZero() {
		return nil, nil, ErrSessionInvalidInput
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}

	cleanIP := sanitizeSessionIP(ip)

	var evictedTokens []string
	var activeCount int64
	if err := tx.Model(&models.UserSession{}).
		Where("user_id = ? AND is_revoked = false AND expires_at > ?", userID, now).
		Count(&activeCount).Error; err != nil {
		return nil, nil, err
	}

	if activeCount >= 10 {
		excess := int(activeCount - 9)
		var oldestSessions []models.UserSession
		if err := tx.Where("user_id = ? AND is_revoked = false AND expires_at > ?", userID, now).
			Order("last_active_at ASC, id ASC").
			Limit(excess).
			Find(&oldestSessions).Error; err != nil {
			return nil, nil, err
		}
		for _, s := range oldestSessions {
			if err := tx.Model(&models.UserSession{}).
				Where("id = ?", s.ID).
				Updates(map[string]interface{}{
					"is_revoked": true,
					"revoked_at": &now,
					"updated_at": now,
				}).Error; err != nil {
				return nil, nil, err
			}
			if s.TokenID != "" {
				evictedTokens = append(evictedTokens, s.TokenID)
			}
		}
	}

	devInfo := utils.ParseUserAgent(userAgent)
	devName := strings.TrimSpace(devInfo.DeviceName)
	if devName == "" {
		devName = "Unknown Device"
	}
	devType := strings.TrimSpace(devInfo.DeviceType)
	if devType == "" {
		devType = "desktop"
	}

	sess := &models.UserSession{
		UserID:       userID,
		TokenID:      tokenID,
		IPAddress:    cleanIP,
		UserAgent:    userAgent,
		DeviceName:   devName,
		DeviceType:   devType,
		Browser:      devInfo.Browser,
		OS:           devInfo.OS,
		LastActiveAt: now,
		ExpiresAt:    expiresAt,
		IsRevoked:    false,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := tx.Create(sess).Error; err != nil {
		return nil, nil, err
	}
	return sess, evictedTokens, nil
}

// BlacklistTokenIDs mem-blacklist daftar JTI sesi setelah transaksi DB berhasil commit.
func BlacklistTokenIDs(tokenIDs []string, ttl time.Duration) {
	if ttl <= 0 {
		ttl = 72 * time.Hour
	}
	for _, tid := range tokenIDs {
		if strings.TrimSpace(tid) != "" {
			database.BlacklistToken(tid, ttl)
		}
	}
}

// CreateDurableUserSession menyimpan sesi secara sinkron dalam transaksi DB.
// Kegagalan penyimpanan dikembalikan ke pemanggil (fail-closed).
func CreateDurableUserSession(db *gorm.DB, userID uint, tokenID string, expiresAt time.Time, ip string, userAgent string) (*models.UserSession, error) {
	if db == nil {
		return nil, ErrSessionStorageUnavailable
	}
	now := time.Now().UTC()
	var created *models.UserSession
	var evicted []string
	err := db.Transaction(func(tx *gorm.DB) error {
		var txErr error
		created, evicted, txErr = CreateUserSessionTx(tx, userID, tokenID, expiresAt, ip, userAgent, now)
		return txErr
	})
	if err != nil {
		return nil, err
	}
	BlacklistTokenIDs(evicted, 72*time.Hour)
	return created, nil
}

// RevokeUserSessionsTx menandai seluruh sesi aktif milik user sebagai revoked di
// dalam transaksi yang sedang berjalan (opsional mengecualikan satu tokenID),
// dan mengembalikan daftar token_id yang dicabut untuk di-blacklist pasca-commit.
func RevokeUserSessionsTx(tx *gorm.DB, userID uint, exceptTokenID string, now time.Time) ([]string, error) {
	if tx == nil {
		return nil, ErrSessionStorageUnavailable
	}
	if userID == 0 {
		return nil, nil
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}

	q := tx.Where("user_id = ? AND is_revoked = false", userID)
	if strings.TrimSpace(exceptTokenID) != "" {
		q = q.Where("token_id != ?", strings.TrimSpace(exceptTokenID))
	}
	var sessions []models.UserSession
	if err := q.Find(&sessions).Error; err != nil {
		return nil, err
	}
	if len(sessions) == 0 {
		return nil, nil
	}

	upd := tx.Model(&models.UserSession{}).Where("user_id = ? AND is_revoked = false", userID)
	if strings.TrimSpace(exceptTokenID) != "" {
		upd = upd.Where("token_id != ?", strings.TrimSpace(exceptTokenID))
	}
	if err := upd.Updates(map[string]interface{}{
		"is_revoked": true,
		"revoked_at": &now,
		"updated_at": now,
	}).Error; err != nil {
		return nil, err
	}

	ids := make([]string, 0, len(sessions))
	for _, s := range sessions {
		if s.TokenID != "" {
			ids = append(ids, s.TokenID)
		}
	}
	return ids, nil
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
	if _, err := CreateDurableUserSession(database.DB, userID, tokenID, expiresAt, ip, userAgent); err != nil {
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
	if tokenID == "" || database.DB == nil {
		return
	}
	// Update if last_active_at is older than 5 minutes
	now := time.Now()
	threshold := now.Add(-5 * time.Minute)

	_ = database.DB.Model(&models.UserSession{}).
		Where("token_id = ? AND is_revoked = false AND last_active_at < ?", tokenID, threshold).
		Updates(map[string]interface{}{
			"last_active_at": now,
			"ip_address":     sanitizeSessionIP(ip),
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
// Cleans up referencing MFAAuthCompletion rows first so PostgreSQL FK RESTRICT never blocks cleanup.
func CleanupExpiredUserSessions(db *gorm.DB) (int64, error) {
	if db == nil {
		db = database.DB
	}
	if db == nil {
		return 0, nil
	}
	thirtyDaysAgo := time.Now().UTC().AddDate(0, 0, -30)
	if db.Migrator().HasTable(&models.MFAAuthCompletion{}) {
		subQuery := db.Model(&models.UserSession{}).Select("id").Where("expires_at < ?", thirtyDaysAgo)
		_ = db.Where("expires_at < ? OR session_id IN (?)", thirtyDaysAgo, subQuery).Delete(&models.MFAAuthCompletion{}).Error
	}
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
	if db == nil {
		db = database.DB
	}
	if db == nil {
		return ErrSessionStorageUnavailable
	}

	now := time.Now().UTC()

	// 1. Fetch active session token IDs
	var sessions []models.UserSession
	if err := db.Where("user_id = ? AND is_revoked = false", userID).Find(&sessions).Error; err != nil {
		log.Warn().Err(err).Uint("user_id", userID).Msg("Failed to query active sessions for revocation")
		return err
	}

	// 2. Mark all sessions as revoked in database and bump token_version atomically
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.UserSession{}).
			Where("user_id = ? AND is_revoked = false", userID).
			Updates(map[string]interface{}{
				"is_revoked": true,
				"revoked_at": &now,
				"updated_at": now,
			}).Error; err != nil {
			return err
		}
		return tx.Model(&models.User{}).Where("id = ?", userID).
			UpdateColumn("token_version", gorm.Expr("token_version + 1")).Error
	}); err != nil {
		return err
	}

	for _, s := range sessions {
		ttl := 72 * time.Hour
		if s.ExpiresAt.After(now) {
			ttl = time.Until(s.ExpiresAt)
		}
		if s.TokenID != "" {
			database.BlacklistToken(s.TokenID, ttl)
		}
	}

	log.Info().Uint("user_id", userID).Msg("Successfully revoked all active sessions and bumped token_version.")
	return nil
}

// RotateUserSessionToken memperbarui token_id, expires_at, dan last_active_at pada models.UserSession
// saat rotasi token (N-55 / REV-R3-03).
func RotateUserSessionToken(db *gorm.DB, oldTokenID, newTokenID string, newExpiresAt time.Time, ip string) error {
	if oldTokenID == "" || newTokenID == "" {
		return nil
	}
	if db == nil {
		db = database.DB
	}
	if db == nil {
		return nil
	}
	now := time.Now()
	updates := map[string]interface{}{
		"token_id":       newTokenID,
		"expires_at":     newExpiresAt,
		"last_active_at": now,
		"updated_at":     now,
	}
	if ip != "" {
		updates["ip_address"] = ip
	}
	return db.Model(&models.UserSession{}).
		Where("token_id = ? AND is_revoked = false", oldTokenID).
		Updates(updates).Error
}

// RotateUserSessionTokenStrict memperbarui token_id pada sesi aktif dan
// menolak (fail-closed) bila baris sesi tidak ditemukan, sudah dicabut, atau DB gagal.
func RotateUserSessionTokenStrict(db *gorm.DB, userID uint, oldTokenID, newTokenID string, newExpiresAt time.Time, ip string) error {
	if db == nil {
		db = database.DB
	}
	if db == nil {
		return ErrSessionStorageUnavailable
	}
	if userID == 0 || strings.TrimSpace(oldTokenID) == "" || strings.TrimSpace(newTokenID) == "" || newExpiresAt.IsZero() {
		return ErrSessionInvalidInput
	}
	now := time.Now().UTC()
	updates := map[string]interface{}{
		"token_id":       newTokenID,
		"expires_at":     newExpiresAt,
		"last_active_at": now,
		"updated_at":     now,
	}
	if strings.TrimSpace(ip) != "" {
		updates["ip_address"] = strings.TrimSpace(ip)
	}
	res := db.Model(&models.UserSession{}).
		Where("user_id = ? AND token_id = ? AND is_revoked = false AND expires_at > ?", userID, oldTokenID, now).
		Updates(updates)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrSessionNotFound
	}
	return nil
}

