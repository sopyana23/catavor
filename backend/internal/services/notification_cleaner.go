package services

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// StartNotificationCleaner runs a periodic background worker to purge expired and stale notifications.
func StartNotificationCleaner(ctx context.Context, db *gorm.DB, interval time.Duration) {
	if interval <= 0 {
		interval = 1 * time.Hour
	}

	go func() {
		log.Info().Dur("interval", interval).Msg("Notification background cleaner started")
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		// Run once on startup
		runCleanup(db)

		for {
			select {
			case <-ticker.C:
				runCleanup(db)
			case <-ctx.Done():
				log.Info().Msg("Notification background cleaner stopped gracefully")
				return
			}
		}
	}()
}

// runCleanup executes the database cleanup queries for expired notifications.
func runCleanup(db *gorm.DB) {
	if db == nil {
		return
	}

	now := time.Now().UTC()

	// 1. Delete absolute expired notifications
	resExpired := db.Exec("DELETE FROM notifications WHERE expires_at IS NOT NULL AND expires_at < ?", now)
	if resExpired.Error != nil {
		log.Warn().Err(resExpired.Error).Msg("Failed to clean expired notifications")
	} else if resExpired.RowsAffected > 0 {
		log.Info().Int64("purged_count", resExpired.RowsAffected).Msg("Purged expired notifications from database")
	}

	// 2. Delete orphaned notification_reads (where notification no longer exists)
	resOrphaned := db.Exec("DELETE FROM notification_reads WHERE notification_id NOT IN (SELECT id FROM notifications)")
	if resOrphaned.Error != nil {
		log.Warn().Err(resOrphaned.Error).Msg("Failed to clean orphaned notification reads")
	}

	// 3. Delete single-store notifications that passed retention hours after being read
	resRetention := db.Exec(`
		DELETE FROM notifications 
		WHERE target_type IN ('single_store', 'single_user') 
		  AND id IN (
		    SELECT nr.notification_id 
		    FROM notification_reads nr 
		    JOIN notifications n ON n.id = nr.notification_id 
		    WHERE (nr.read_at + (n.retention_hours * INTERVAL '1 hour')) <= ?
		  )
	`, now)
	if resRetention.Error != nil {
		log.Warn().Err(resRetention.Error).Msg("Failed to clean retained read notifications")
	} else if resRetention.RowsAffected > 0 {
		log.Info().Int64("purged_count", resRetention.RowsAffected).Msg("Purged read notifications past retention window")
	}
}
