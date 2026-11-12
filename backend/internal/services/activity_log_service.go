package services

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"catavor-backend/internal/models"

	"github.com/rs/zerolog/log"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type RecordActivityParams struct {
	DB          *gorm.DB
	StoreID     *uint
	UserID      *uint
	ActorRole   string // "merchant" | "superadmin" | "system"
	ActorName   string
	ActorEmail  string
	Action      string // e.g. "product.create", "product.price_change", "admin.broadcast_notification"
	Category    string // "security" | "catalog" | "store" | "billing" | "superadmin" | "moderation" | "system"
	EntityType  string // "product", "store", "notification", "plan", "policy", "report", "user"
	EntityID    *uint
	EntityTitle string
	Description string
	Changes     interface{} // Struct or map that will be JSON-marshaled
	IPAddress   string
	UserAgent   string
}

// RecordActivity safely records an audit/activity log entry without breaking parent transaction.
func RecordActivity(params RecordActivityParams) {
	if params.DB == nil {
		return
	}

	role := strings.TrimSpace(params.ActorRole)
	if role == "" {
		role = "merchant"
	}

	actorName := strings.TrimSpace(params.ActorName)
	if actorName == "" {
		actorName = "System"
	}

	actorEmail := strings.TrimSpace(params.ActorEmail)
	if actorEmail == "" {
		actorEmail = "system@catavor.com"
	}

	var changesJSON datatypes.JSON
	if params.Changes != nil {
		if b, err := json.Marshal(params.Changes); err == nil {
			changesJSON = datatypes.JSON(b)
		}
	}

	activity := models.ActivityLog{
		StoreID:     params.StoreID,
		UserID:      params.UserID,
		ActorRole:   role,
		ActorName:   actorName,
		ActorEmail:  actorEmail,
		Action:      params.Action,
		Category:    params.Category,
		EntityType:  params.EntityType,
		EntityID:    params.EntityID,
		EntityTitle: params.EntityTitle,
		Description: params.Description,
		Changes:     changesJSON,
		IPAddress:   params.IPAddress,
		UserAgent:   params.UserAgent,
		CreatedAt:   time.Now(),
	}

	if err := params.DB.Create(&activity).Error; err != nil {
		log.Warn().Err(err).Str("action", params.Action).Msg("Failed to persist activity log entry")
	}
}

// CleanOldActivityLogs purges stale logs based on SaaS plan tier retention:
// - Free stores: retains 90 days of logs.
// - Pro / System / Superadmin: retains 365 days of logs.
// Preserves historical price change event counts into macro audience dimensions before purging.
func CleanOldActivityLogs(db *gorm.DB) (int64, error) {
	now := time.Now()
	freeCutoff := now.AddDate(0, 0, -90)
	globalCutoff := now.AddDate(0, 0, -365)

	var totalDeleted int64

	// 0. Pre-prune aggregation: Snapshot historical price change frequency into store_daily_audience_metrics
	// so macro inflation & price elasticity intelligence remains permanently accessible with zero PII.
	_ = db.Exec(`
		INSERT INTO store_daily_audience_metrics (store_id, date, dimension_type, dimension_value, views, unique_visitors, total_actions, created_at, updated_at)
		SELECT 
			0 as store_id,
			TO_CHAR(created_at, 'YYYY-MM-DD') as date,
			'hist_price_chg' as dimension_type,
			'catalog|price_change' as dimension_value,
			COUNT(*) as views,
			COUNT(DISTINCT store_id) as unique_visitors,
			COUNT(*) as total_actions,
			NOW(),
			NOW()
		FROM activity_logs
		WHERE action = 'product.price_change' 
		  AND (
		      (store_id IN (SELECT id FROM stores WHERE plan = 'free' OR plan IS NULL) AND created_at < ?)
		      OR created_at < ?
		  )
		GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
		ON CONFLICT (store_id, date, dimension_type, dimension_value) DO UPDATE SET
			views = store_daily_audience_metrics.views + EXCLUDED.views,
			unique_visitors = store_daily_audience_metrics.unique_visitors + EXCLUDED.unique_visitors,
			total_actions = store_daily_audience_metrics.total_actions + EXCLUDED.total_actions,
			updated_at = NOW()
	`, freeCutoff, globalCutoff).Error

	// 1. Purge Free store logs older than 90 days
	res1 := db.Exec(`
		DELETE FROM activity_logs
		WHERE store_id IN (
			SELECT id FROM stores WHERE plan = 'free' OR plan IS NULL
		) AND created_at < ?
	`, freeCutoff)
	if res1.Error != nil {
		log.Warn().Err(res1.Error).Msg("ActivityLogCleaner: Failed to purge free tier logs")
	} else {
		totalDeleted += res1.RowsAffected
	}

	// 2. Purge all logs older than 365 days
	res2 := db.Exec(`
		DELETE FROM activity_logs
		WHERE created_at < ?
	`, globalCutoff)
	if res2.Error != nil {
		log.Warn().Err(res2.Error).Msg("ActivityLogCleaner: Failed to purge global 365-day logs")
	} else {
		totalDeleted += res2.RowsAffected
	}

	return totalDeleted, nil
}

// StartActivityLogCleaner starts the periodic background cleaner goroutine.
func StartActivityLogCleaner(ctx context.Context, db *gorm.DB, interval time.Duration) {
	go func() {
		// Run initial cleanup on startup
		if purged, err := CleanOldActivityLogs(db); err == nil && purged > 0 {
			log.Info().Int64("purged_count", purged).Msg("Initial activity logs cleanup completed")
		}

		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if purged, err := CleanOldActivityLogs(db); err == nil && purged > 0 {
					log.Info().Int64("purged_count", purged).Msg("Periodic activity logs cleanup completed")
				}
			}
		}
	}()
}
