package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// StartNotificationCleaner runs a periodic background worker to purge expired and stale notifications.
func StartNotificationCleaner(ctx context.Context, db *gorm.DB, interval time.Duration) {
	if interval <= 0 {
		interval = 1 * time.Hour
	}

	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Error().Interface("panic", r).Msg("Recovered panic in notification cleaner goroutine")
			}
		}()

		log.Info().Dur("interval", interval).Msg("Notification background cleaner started")
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		safeRunCleanup := func(stage string) {
			defer func() {
				if r := recover(); r != nil {
					log.Error().Interface("panic", r).Str("stage", stage).Msg("Recovered panic in notification cleanup cycle")
				}
			}()
			_ = runCleanup(db)
		}

		// Run once on startup
		safeRunCleanup("boot")

		for {
			select {
			case <-ticker.C:
				safeRunCleanup("periodic")
			case <-ctx.Done():
				log.Info().Msg("Notification background cleaner stopped gracefully")
				return
			}
		}
	}()
}

// StartBroadcastScheduler menjalankan pekerja latar yang menerbitkan siaran berstatus 'scheduled' saat waktunya tiba.
func StartBroadcastScheduler(ctx context.Context, db *gorm.DB, interval time.Duration) {
	if interval <= 0 {
		interval = 30 * time.Second
	}

	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Error().Interface("panic", r).Msg("Recovered panic in broadcast scheduler goroutine")
			}
		}()

		log.Info().Dur("interval", interval).Msg("Scheduled broadcast publisher started")
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		safePublish := func(stage string) {
			defer func() {
				if r := recover(); r != nil {
					log.Error().Interface("panic", r).Str("stage", stage).Msg("Recovered panic in broadcast publish cycle")
				}
			}()
			if count, err := PublishDueScheduledBroadcasts(db); err != nil {
				log.Warn().Err(err).Str("stage", stage).Msg("Scheduled broadcast publish cycle encountered error")
			} else if count > 0 {
				log.Info().Int64("published_count", count).Str("stage", stage).Msg("Published scheduled broadcasts")
			}
		}

		safePublish("boot")

		for {
			select {
			case <-ticker.C:
				safePublish("periodic")
			case <-ctx.Done():
				log.Info().Msg("Scheduled broadcast publisher stopped gracefully")
				return
			}
		}
	}()
}

// PublishDueScheduledBroadcasts menerbitkan seluruh siaran terjadwal yang telah melewati scheduled_at secara atomik.
func PublishDueScheduledBroadcasts(db *gorm.DB) (int64, error) {
	if db == nil {
		return 0, fmt.Errorf("database tidak tersedia")
	}

	now := time.Now().UTC()
	var due []models.Notification
	if err := db.Where("status = ? AND scheduled_at IS NOT NULL AND scheduled_at <= ? AND revoked_at IS NULL", "scheduled", now).
		Order("scheduled_at ASC").
		Find(&due).Error; err != nil {
		return 0, err
	}
	if len(due) == 0 {
		return 0, nil
	}

	var publishedCount int64
	hub := GetNotificationHub()

	for i := range due {
		n := due[i]
		var recipients []models.NotificationRecipient
		if n.TargetType == "specific" {
			_ = db.Where("notification_id = ?", n.ID).Find(&recipients).Error
			if len(recipients) > 0 && strings.TrimSpace(n.TargetRecipients) == "" {
				if raw, mErr := json.Marshal(recipients); mErr == nil {
					n.TargetRecipients = string(raw)
				}
			}
		}

		audience := EstimateBroadcastAudience(db, n.TargetType, n.TargetPlanCode, int64(n.TargetID), int64(len(recipients)))

		claimed := false
		txErr := db.Transaction(func(tx *gorm.DB) error {
			res := tx.Model(&models.Notification{}).
				Where("id = ? AND status = ?", n.ID, "scheduled").
				Updates(map[string]interface{}{
					"status":                "published",
					"published_at":          now,
					"target_audience_count": audience,
					"updated_at":            now,
				})
			if res.Error != nil {
				return res.Error
			}
			claimed = res.RowsAffected > 0
			return nil
		})
		if txErr != nil || !claimed {
			continue
		}

		n.Status = "published"
		n.PublishedAt = &now
		n.TargetAudienceCount = audience
		n.UpdatedAt = now
		publishedCount++

		database.InvalidateBroadcastCache(context.Background())
		hub.Broadcast(&n)
	}

	return publishedCount, nil
}

// EstimateBroadcastAudience menghitung estimasi ukuran audiens sasaran untuk analitik keterbacaan & CTR.
func EstimateBroadcastAudience(db *gorm.DB, targetType, targetPlanCode string, targetID, specificCount int64) int64 {
	if db == nil {
		return 0
	}
	switch strings.ToLower(strings.TrimSpace(targetType)) {
	case "all":
		var cnt int64
		_ = db.Table("stores").
			Where("is_banned = ? AND dormancy_status != ?", false, "banned").
			Count(&cnt).Error
		return cnt
	case "plan":
		plan := strings.ToLower(strings.TrimSpace(targetPlanCode))
		if plan == "" {
			return 0
		}
		var cnt int64
		q := db.Table("stores").Where("is_banned = ? AND dormancy_status != ?", false, "banned")
		if plan == "pro" {
			q = q.Where("LOWER(plan) IN ?", []string{"pro", "pro_starter", "pro_business"})
		} else {
			q = q.Where("LOWER(plan) = ?", plan)
		}
		_ = q.Count(&cnt).Error
		return cnt
	case "specific":
		return specificCount
	case "single_store", "single_user":
		if targetID > 0 {
			return 1
		}
		return 0
	default:
		return 0
	}
}

// runCleanup executes the database cleanup queries for expired notifications and 30-day retention.
func runCleanup(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("database tidak tersedia")
	}

	now := time.Now().UTC()
	thirtyDaysAgo := now.Add(-30 * 24 * time.Hour)
	ninetyDaysAgo := now.Add(-90 * 24 * time.Hour)

	// 1. Delete absolute expired notifications
	resExpired := db.Exec("DELETE FROM notifications WHERE expires_at IS NOT NULL AND expires_at < ?", now)
	if resExpired.Error != nil {
		log.Warn().Err(resExpired.Error).Msg("Failed to clean expired notifications")
	} else if resExpired.RowsAffected > 0 {
		log.Info().Int64("purged_count", resExpired.RowsAffected).Msg("Purged expired notifications from database")
	}

	// 2. Delete non-compliance targeted notifications older than 30 days (Preserve security, compliance, warning, and moderation sanction records)
	resOldTargeted := db.Exec(`
		DELETE FROM notifications 
		WHERE target_type IN ('single_store', 'single_user') 
		  AND created_at < ?
		  AND category NOT IN ('KEAMANAN', 'MODERASI', 'KEPATUHAN', 'SUSPEND', 'PERINGATAN', 'PERBAIKAN', 'PEMULIHAN')
	`, thirtyDaysAgo)
	if resOldTargeted.Error != nil {
		log.Warn().Err(resOldTargeted.Error).Msg("Failed to clean targeted notifications older than 30 days")
	} else if resOldTargeted.RowsAffected > 0 {
		log.Info().Int64("purged_count", resOldTargeted.RowsAffected).Msg("Purged 30-day old targeted notifications from database")
	}

	// 3. Delete non-compliance single-store notifications that passed retention after being read
	resRetention := db.Exec(`
		DELETE FROM notifications 
		WHERE target_type IN ('single_store', 'single_user') 
		  AND category NOT IN ('KEAMANAN', 'MODERASI', 'KEPATUHAN', 'SUSPEND', 'PERINGATAN', 'PERBAIKAN', 'PEMULIHAN')
		  AND id IN (
		    SELECT nr.notification_id 
		    FROM notification_reads nr 
		    JOIN notifications n ON n.id = nr.notification_id 
		    WHERE nr.read_at <= ?
		  )
	`, thirtyDaysAgo)
	if resRetention.Error != nil {
		log.Warn().Err(resRetention.Error).Msg("Failed to clean retained read notifications")
	} else if resRetention.RowsAffected > 0 {
		log.Info().Int64("purged_count", resRetention.RowsAffected).Msg("Purged read notifications past retention window")
	}

	// 3b. Delete revoked non-compliance broadcasts older than 90 days
	resOldRevoked := db.Exec(`
		DELETE FROM notifications
		WHERE status = 'revoked'
		  AND revoked_at IS NOT NULL
		  AND revoked_at < ?
		  AND category NOT IN ('KEAMANAN', 'MODERASI', 'KEPATUHAN', 'SUSPEND', 'PERINGATAN', 'PERBAIKAN', 'PEMULIHAN')
	`, ninetyDaysAgo)
	if resOldRevoked.Error != nil {
		log.Warn().Err(resOldRevoked.Error).Msg("Failed to clean old revoked broadcasts")
	} else if resOldRevoked.RowsAffected > 0 {
		log.Info().Int64("purged_count", resOldRevoked.RowsAffected).Msg("Purged 90-day old revoked broadcasts from database")
	}

	// 4. Delete old dismissed read receipts older than 30 days
	resOldDismissed := db.Exec("DELETE FROM notification_reads WHERE dismissed_at IS NOT NULL AND dismissed_at < ?", thirtyDaysAgo)
	if resOldDismissed.Error != nil {
		log.Warn().Err(resOldDismissed.Error).Msg("Failed to clean old dismissed notification receipts")
	} else if resOldDismissed.RowsAffected > 0 {
		log.Info().Int64("purged_count", resOldDismissed.RowsAffected).Msg("Purged 30-day old dismissed receipts from database")
	}

	// 5. Delete orphaned notification_reads (where notification no longer exists)
	resOrphaned := db.Exec("DELETE FROM notification_reads WHERE notification_id NOT IN (SELECT id FROM notifications)")
	if resOrphaned.Error != nil {
		log.Warn().Err(resOrphaned.Error).Msg("Failed to clean orphaned notification reads")
	} else if resOrphaned.RowsAffected > 0 {
		log.Info().Int64("purged_count", resOrphaned.RowsAffected).Msg("Purged orphaned notification reads")
	}

	// 6. Delete expired user sessions older than 30 days (Industry Standard Housekeeping)
	var purgedSessions int64
	var sessionErr error
	if count, err := CleanupExpiredUserSessions(db); err != nil {
		sessionErr = err
		log.Warn().Err(err).Msg("Failed to clean expired user sessions")
	} else if count > 0 {
		purgedSessions = count
		log.Info().Int64("purged_count", count).Msg("Purged expired user sessions older than 30 days from database")
	}

	var totalCleaned int64
	for _, cnt := range []int64{
		resExpired.RowsAffected,
		resOldTargeted.RowsAffected,
		resRetention.RowsAffected,
		resOldRevoked.RowsAffected,
		resOldDismissed.RowsAffected,
		resOrphaned.RowsAffected,
		purgedSessions,
	} {
		if cnt > 0 {
			totalCleaned += cnt
		}
	}

	summary := fmt.Sprintf("Pembersihan selesai. Total %d record kedaluwarsa dibersihkan.", totalCleaned)
	fault := ""
	status := "success"
	cycleErr := errors.Join(resExpired.Error, resOldTargeted.Error, resRetention.Error, resOldRevoked.Error, resOldDismissed.Error, resOrphaned.Error, sessionErr)
	if cycleErr != nil {
		fault = cycleErr.Error()
		status = "error"
	}
	GetAutomationTracker().RecordWorkerHeartbeat(
		"cleaner_worker",
		status,
		summary,
		fault,
		totalCleaned,
		time.Now().UTC().Add(1*time.Hour),
	)
	return cycleErr
}
