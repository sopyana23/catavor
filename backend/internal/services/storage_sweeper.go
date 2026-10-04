package services

import (
	"context"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// StartStorageSweeper runs a periodic background worker to audit storage and sweep abandoned orphaned uploads.
func StartStorageSweeper(ctx context.Context, db *gorm.DB, interval time.Duration) {
	if interval <= 0 {
		interval = 1 * time.Hour
	}

	go func() {
		// Stagger startup by 45 seconds to let server boot cleanly
		select {
		case <-time.After(45 * time.Second):
		case <-ctx.Done():
			return
		}

		log.Info().Dur("interval", interval).Msg("Storage Sweeper background worker started")
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		// Run sweep on initial staggered start
		runStorageSweep(db)

		for {
			select {
			case <-ticker.C:
				runStorageSweep(db)
			case <-ctx.Done():
				log.Info().Msg("Storage Sweeper background worker stopped gracefully")
				return
			}
		}
	}()
}

// runStorageSweep walks all active stores and recalculates live storage while pruning stale abandoned files (>2 hours).
func runStorageSweep(db *gorm.DB) {
	if db == nil {
		return
	}

	var stores []models.Store
	if err := db.Select("id, slug").Find(&stores).Error; err != nil {
		log.Warn().Err(err).Msg("Storage Sweeper: Failed to list stores for audit")
		return
	}

	totalAudited := 0
	for _, store := range stores {
		// SyncStoreStorageUsed prunes files older than 2-hour grace period if not linked to active products
		SyncStoreStorageUsed(db, store.ID)
		database.InvalidateStoreQuotaCache(context.Background(), store.ID)
		totalAudited++
	}

	if totalAudited > 0 {
		log.Info().Int("stores_audited", totalAudited).Msg("Storage Sweeper: Completed periodic storage audit & orphan cleanup")
	}
}
