package services

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"catavor-backend/internal/models"
	"catavor-backend/internal/storage"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// TicketRetentionStats holds metrics returned by the retention execution cycle.
type TicketRetentionStats struct {
	PurgedTickets int64 `json:"purged_tickets"`
	PurgedFiles   int64 `json:"purged_files"`
	FreedBytes    int64 `json:"freed_bytes"`
}

// PurgeExpiredClosedTickets enforces the Indonesian PDP Law (UU No. 27/2022) & GDPR storage limitation principles.
// It hard-deletes closed support tickets and permanently removes physical media attachments from disk or cloud S3.
// Policy:
// - Sensitive Categories (billing, account): 30 days retention post-closure
// - Standard Categories (technical, catalog_help, general): 60 days retention post-closure
func PurgeExpiredClosedTickets(db *gorm.DB, storageDriver storage.StorageService) (stats TicketRetentionStats, err error) {
	now := time.Now().UTC()
	cutoffSensitive := now.AddDate(0, 0, -30)
	cutoffStandard := now.AddDate(0, 0, -60)

	var expiredTickets []models.SupportTicket
	err = db.Where("(status = ? AND category IN ('billing', 'account') AND closed_at <= ?) OR (status = ? AND category NOT IN ('billing', 'account') AND closed_at <= ?)",
		"closed", cutoffSensitive, "closed", cutoffStandard).
		Find(&expiredTickets).Error

	if err != nil {
		return stats, fmt.Errorf("failed to query expired tickets: %w", err)
	}

	if len(expiredTickets) == 0 {
		return stats, nil
	}

	var ticketIDs []uint
	for _, t := range expiredTickets {
		ticketIDs = append(ticketIDs, t.ID)
	}

	// 1. Gather all attachments associated with these tickets
	var attachments []models.SupportAttachment
	db.Joins("JOIN support_messages ON support_messages.id = support_attachments.message_id").
		Where("support_messages.ticket_id IN (?)", ticketIDs).
		Find(&attachments)

	storageRoot := GetStorageRoot()
	ctx := context.Background()

	// 2. Physical File Deletion (Storage Erasure)
	for _, att := range attachments {
		cleanKey := strings.TrimLeft(filepath.ToSlash(att.StorageKey), "/")
		if cleanKey == "" && att.FileURL != "" {
			if idx := strings.Index(att.FileURL, "/storage/"); idx != -1 {
				cleanKey = strings.TrimLeft(filepath.ToSlash(att.FileURL[idx+len("/storage/"): ]), "/")
			}
		}

		if cleanKey != "" {
			// Delete via storage abstraction (Local / S3 / Cloudflare R2 / MinIO)
			if storageDriver != nil {
				_ = storageDriver.Delete(ctx, cleanKey)
			}

			// Clean local gzipped compression cache if local filesystem driver
			localPath := filepath.Join(storageRoot, filepath.FromSlash(cleanKey))
			_ = os.Remove(localPath)
			_ = os.Remove(localPath + ".fiber.gz")

			stats.PurgedFiles++
			stats.FreedBytes += int64(att.FileSize)
		}
	}

	// 3. Database Purge (Relational Hard-Delete)
	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var messageIDs []uint
	tx.Model(&models.SupportMessage{}).
		Where("ticket_id IN (?)", ticketIDs).
		Pluck("id", &messageIDs)

	if len(messageIDs) > 0 {
		_ = tx.Unscoped().Where("message_id IN (?)", messageIDs).Delete(&models.SupportAttachment{}).Error
	}

	_ = tx.Unscoped().Where("ticket_id IN (?)", ticketIDs).Delete(&models.SupportMessage{}).Error
	if err := tx.Unscoped().Where("id IN (?)", ticketIDs).Delete(&models.SupportTicket{}).Error; err != nil {
		tx.Rollback()
		return stats, fmt.Errorf("failed to hard delete support tickets: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return stats, fmt.Errorf("failed to commit ticket purge transaction: %w", err)
	}

	stats.PurgedTickets = int64(len(expiredTickets))

	log.Info().
		Int64("purged_tickets", stats.PurgedTickets).
		Int64("purged_files", stats.PurgedFiles).
		Int64("freed_bytes", stats.FreedBytes).
		Msg("PDP Ticket Retention Sweeper: Successfully purged expired closed tickets and media")

	return stats, nil
}

// PurgeUserTicketsAndAttachments immediately hard-deletes all support tickets and physical attachments
// belonging to a specific user (used when user executes permanent account closure under GDPR / UU PDP Right to Erasure).
func PurgeUserTicketsAndAttachments(db *gorm.DB, storageDriver storage.StorageService, userID uint) (purgedTickets int64, purgedFiles int64, err error) {
	if userID == 0 {
		return 0, 0, nil
	}

	var tickets []models.SupportTicket
	if err := db.Where("user_id = ?", userID).Find(&tickets).Error; err != nil || len(tickets) == 0 {
		return 0, 0, nil
	}

	var ticketIDs []uint
	for _, t := range tickets {
		ticketIDs = append(ticketIDs, t.ID)
	}

	var attachments []models.SupportAttachment
	db.Joins("JOIN support_messages ON support_messages.id = support_attachments.message_id").
		Where("support_messages.ticket_id IN (?)", ticketIDs).
		Find(&attachments)

	storageRoot := GetStorageRoot()
	ctx := context.Background()

	for _, att := range attachments {
		cleanKey := strings.TrimLeft(filepath.ToSlash(att.StorageKey), "/")
		if cleanKey == "" && att.FileURL != "" {
			if idx := strings.Index(att.FileURL, "/storage/"); idx != -1 {
				cleanKey = strings.TrimLeft(filepath.ToSlash(att.FileURL[idx+len("/storage/"): ]), "/")
			}
		}

		if cleanKey != "" {
			if storageDriver != nil {
				_ = storageDriver.Delete(ctx, cleanKey)
			}
			localPath := filepath.Join(storageRoot, filepath.FromSlash(cleanKey))
			_ = os.Remove(localPath)
			_ = os.Remove(localPath + ".fiber.gz")
			purgedFiles++
		}
	}

	var messageIDs []uint
	db.Model(&models.SupportMessage{}).
		Where("ticket_id IN (?)", ticketIDs).
		Pluck("id", &messageIDs)

	if len(messageIDs) > 0 {
		_ = db.Unscoped().Where("message_id IN (?)", messageIDs).Delete(&models.SupportAttachment{})
	}
	_ = db.Unscoped().Where("ticket_id IN (?)", ticketIDs).Delete(&models.SupportMessage{})
	_ = db.Unscoped().Where("id IN (?)", ticketIDs).Delete(&models.SupportTicket{})

	purgedTickets = int64(len(tickets))
	return purgedTickets, purgedFiles, nil
}
