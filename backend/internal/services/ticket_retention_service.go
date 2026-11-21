package services

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"catavor-backend/internal/models"
	"catavor-backend/internal/storage"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// TicketRetentionStats holds metrics returned by the retention execution cycle.
type TicketRetentionStats struct {
	PurgedTickets int64 `json:"purged_tickets"`
	PurgedFiles   int64 `json:"purged_files"`
	FreedBytes    int64 `json:"freed_bytes"`
}

// expiredClosedTickets is the retention predicate used by the real sweep and the synthetic preview.
func expiredClosedTickets(db *gorm.DB, now time.Time) *gorm.DB {
	return db.Where("status = ? AND ((category IN ('billing','account') AND closed_at <= ?) OR (category NOT IN ('billing','account') AND closed_at <= ?))",
		"closed", now.AddDate(0, 0, -30), now.AddDate(0, 0, -60))
}

func PreviewTicketRetention(db *gorm.DB, age int) (int64, error) {
	now := time.Now().UTC()
	samples := db.Table("(VALUES ('closed','billing',?::timestamptz),('closed','technical',?::timestamptz)) AS samples(status,category,closed_at)", now.AddDate(0, 0, -age), now.AddDate(0, 0, -age))
	var eligible int64
	err := expiredClosedTickets(samples, now).Count(&eligible).Error
	return eligible, err
}

// PurgeExpiredClosedTickets enforces the Indonesian PDP Law (UU No. 27/2022) & GDPR storage limitation principles.
// It hard-deletes closed support tickets and permanently removes physical media attachments from disk or cloud S3.
// Policy:
// - Sensitive Categories (billing, account): 30 days retention post-closure
// - Standard Categories (technical, catalog_help, general): 60 days retention post-closure
func PurgeExpiredClosedTickets(db *gorm.DB, storageDriver storage.StorageService) (stats TicketRetentionStats, err error) {
	now := time.Now().UTC()
	type fileCleanupItem struct {
		cleanKey string
		fileSize int
	}
	var filesToDelete []fileCleanupItem

	var expiredTickets []models.SupportTicket
	txErr := db.Transaction(func(tx *gorm.DB) error {
		err := expiredClosedTickets(tx, now).Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).Order("id").Find(&expiredTickets).Error
		if err != nil || len(expiredTickets) == 0 {
			return err
		}
		var ticketIDs []uint
		for _, t := range expiredTickets {
			ticketIDs = append(ticketIDs, t.ID)
		}

		// 1. Gather all attachments associated with these tickets
		var attachments []models.SupportAttachment
		if err := tx.Joins("JOIN support_messages ON support_messages.id = support_attachments.message_id").
			Where("support_messages.ticket_id IN (?)", ticketIDs).
			Find(&attachments).Error; err != nil {
			return err
		}

		for _, att := range attachments {
			cleanKey := strings.TrimLeft(filepath.ToSlash(att.StorageKey), "/")
			if cleanKey == "" && att.FileURL != "" {
				if idx := strings.Index(att.FileURL, "/storage/"); idx != -1 {
					cleanKey = strings.TrimLeft(filepath.ToSlash(att.FileURL[idx+len("/storage/"):]), "/")
				}
			}

			if cleanKey != "" {
				filesToDelete = append(filesToDelete, fileCleanupItem{
					cleanKey: cleanKey,
					fileSize: att.FileSize,
				})
			}
		}

		var messageIDs []uint
		if err := tx.Model(&models.SupportMessage{}).
			Where("ticket_id IN (?)", ticketIDs).
			Pluck("id", &messageIDs).Error; err != nil {
			return err
		}

		if len(messageIDs) > 0 {
			if err := tx.Unscoped().Where("message_id IN (?)", messageIDs).Delete(&models.SupportAttachment{}).Error; err != nil {
				return err
			}
		}

		if err := tx.Unscoped().Where("ticket_id IN (?)", ticketIDs).Delete(&models.SupportMessage{}).Error; err != nil {
			return err
		}

		return tx.Unscoped().Where("id IN (?)", ticketIDs).Delete(&models.SupportTicket{}).Error
	})

	if txErr != nil {
		return stats, fmt.Errorf("failed to commit ticket purge transaction: %w", txErr)
	}

	// 3. Multi-Layer Rollback (AGENTS.md Rule 10):
	// Physical File Deletion (Storage Erasure) executed ONLY AFTER database commit succeeds.
	storageRoot := GetStorageRoot()
	ctx := context.Background()

	for _, item := range filesToDelete {
		if storageDriver != nil {
			_ = storageDriver.Delete(ctx, item.cleanKey)
		}

		localPath := filepath.Join(storageRoot, filepath.FromSlash(item.cleanKey))
		_ = os.Remove(localPath)
		_ = os.Remove(localPath + ".fiber.gz")

		stats.PurgedFiles++
		stats.FreedBytes += int64(item.fileSize)
	}

	stats.PurgedTickets = int64(len(expiredTickets))

	log.Info().
		Int64("purged_tickets", stats.PurgedTickets).
		Int64("purged_files", stats.PurgedFiles).
		Int64("freed_bytes", stats.FreedBytes).
		Msg("PDP Ticket Retention Sweeper: Successfully purged expired closed tickets and media")

	return stats, nil
}

// DeleteOwnerTicketRecords prepares physical cleanup inside the account transaction.
func DeleteOwnerTicketRecords(tx *gorm.DB, userID uint) (int64, []string, error) {
	if userID == 0 {
		return 0, nil, fmt.Errorf("missing owner ID")
	}
	tickets := tx.Unscoped().Model(&models.SupportTicket{}).Select("id").Where("user_id = ?", userID)
	messages := tx.Unscoped().Model(&models.SupportMessage{}).Select("id").Where("ticket_id IN (?)", tickets)
	var attachments []models.SupportAttachment
	if err := tx.Unscoped().Where("message_id IN (?)", messages).Find(&attachments).Error; err != nil {
		return 0, nil, err
	}
	var keys []string
	for _, att := range attachments {
		key := att.StorageKey
		if key == "" {
			key = ExtractStorageKey(att.FileURL)
		}
		if key == "" {
			continue
		}
		key = filepath.ToSlash(key)
		if !filepath.IsLocal(filepath.FromSlash(key)) || filepath.ToSlash(filepath.Clean(key)) != key || !(strings.HasPrefix(key, "private/support/") || strings.HasPrefix(key, "support/")) {
			return 0, nil, fmt.Errorf("invalid support attachment namespace for %d", att.ID)
		}
		keys = append(keys, key)
	}
	if err := tx.Unscoped().Where("message_id IN (?)", messages).Delete(&models.SupportAttachment{}).Error; err != nil {
		return 0, nil, err
	}
	if err := tx.Unscoped().Where("ticket_id IN (?)", tickets).Delete(&models.SupportMessage{}).Error; err != nil {
		return 0, nil, err
	}
	res := tx.Unscoped().Where("user_id = ?", userID).Delete(&models.SupportTicket{})
	return res.RowsAffected, keys, res.Error
}

func RemoveOwnerTicketFiles(ctx context.Context, db *gorm.DB, driver storage.StorageService, keys []string) (int64, error) {
	var removed int64
	var cleanupErr error
	for _, key := range keys {
		var refs int64
		if err := db.Model(&models.SupportAttachment{}).Where("storage_key = ? OR file_url LIKE ?", key, "%/storage/"+key).Count(&refs).Error; err != nil {
			cleanupErr = errors.Join(cleanupErr, err)
			continue
		}
		if refs > 0 {
			continue
		}
		if driver == nil {
			return removed, fmt.Errorf("support storage unavailable")
		}
		if err := driver.Delete(ctx, key); err != nil {
			cleanupErr = errors.Join(cleanupErr, err)
			continue
		}
		removed++
		if driver.GetDriverName() == "local" {
			cleanupErr = errors.Join(cleanupErr, driver.Delete(ctx, key+".fiber.gz"))
		}
	}
	return removed, cleanupErr
}

func PurgeUserTicketsAndAttachments(db *gorm.DB, driver storage.StorageService, userID uint) (int64, int64, error) {
	if userID == 0 {
		return 0, 0, nil
	}
	var tickets int64
	var keys []string
	err := db.Transaction(func(tx *gorm.DB) error {
		var err error
		tickets, keys, err = DeleteOwnerTicketRecords(tx, userID)
		return err
	})
	if err != nil {
		return 0, 0, err
	}
	files, err := RemoveOwnerTicketFiles(context.Background(), db, driver, keys)
	return tickets, files, err
}
