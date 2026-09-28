package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/models"
	"catavor-backend/internal/storage"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// ItemRetentionStats tracks outcomes from a retention processing cycle.
type ItemRetentionStats struct {
	RemindersSent int `json:"reminders_sent"`
	SoftDeleted   int `json:"soft_deleted"`
	HardDeleted   int `json:"hard_deleted"`
	SkippedActive int `json:"skipped_active"`
}

// ProcessItemRetentionCycle runs the 3-phase retention lifecycle:
// Phase 1 (T-23 / H-7): Reminder notification & email via queue
// Phase 2 (T-30): Soft-delete, legal snapshot, media prune, merchant notification
// Phase 3 (T-90): Total hard-delete from database
func ProcessItemRetentionCycle(db *gorm.DB, cfg *config.Config) (*ItemRetentionStats, error) {
	if db == nil {
		return nil, fmt.Errorf("database connection is required")
	}

	stats := &ItemRetentionStats{}
	now := time.Now().UTC()
	ctx := context.Background()

	var strg storage.StorageService
	if cfg != nil {
		strg, _ = storage.NewStorageService(cfg)
	}

	// =========================================================================
	// 1. PHASE 1: H-7 REMINDER (23 <= Days Since Moderation < 30)
	// =========================================================================
	h7Threshold := now.AddDate(0, 0, -23)
	h30Threshold := now.AddDate(0, 0, -30)

	var h7Candidates []models.Product
	err := db.Model(&models.Product{}).
		Preload("Store").
		Preload("Store.User").
		Where("moderation_status = 'hidden' AND moderated_at IS NOT NULL AND moderated_at <= ? AND moderated_at > ? AND deleted_at IS NULL", h7Threshold, h30Threshold).
		Find(&h7Candidates).Error

	if err == nil {
		for _, p := range h7Candidates {
			// Safety Guard: Check if an active ticket exists regarding this product or compliance
			if hasActiveTicket(db, p.StoreID, p.ID) {
				stats.SkippedActive++
				continue
			}

			// Deduplication: Check if reminder notification was already sent in the last 10 days
			var alreadyReminded int64
			searchPattern := fmt.Sprintf("%%#%d%%", p.ID)
			db.Model(&models.Notification{}).
				Where("target_id = ? AND category = 'KEAMANAN' AND title LIKE ? AND created_at >= ?", p.StoreID, searchPattern, now.AddDate(0, 0, -10)).
				Count(&alreadyReminded)

			if alreadyReminded > 0 {
				continue
			}

			daysSince := int(now.Sub(*p.ModeratedAt).Hours() / 24)
			remainingDays := 30 - daysSince
			if remainingDays < 1 {
				remainingDays = 1
			}

			storeTitle := "Toko Catavor"
			storeSlug := ""
			recipientEmail := ""
			if p.Store != nil {
				storeTitle = p.Store.StoreTitle
				storeSlug = p.Store.Slug
				if p.Store.User != nil {
					recipientEmail = p.Store.User.Email
				}
			}

			reportNum := fmt.Sprintf("ITM-%d", p.ID)

			// 1. In-App Notification
			notifID := fmt.Sprintf("notif_ret_h7_%d_%d", p.ID, now.Unix())
			notif := models.Notification{
				ID:            notifID,
				TargetType:    "single_store",
				TargetID:      p.StoreID,
				TargetName:    storeTitle,
				Title:         fmt.Sprintf("⚠️ Peringatan: Produk '%s' (#%d) Dihapus dalam %d Hari", p.Name, p.ID, remainingDays),
				Category:      "KEAMANAN",
				Message:       fmt.Sprintf("Produk '%s' yang dinonaktifkan oleh Tim Kepatuhan akan dihapus otomatis dari katalog Anda dalam waktu %d hari jika tidak ada tindakan klarifikasi.", p.Name, remainingDays),
				DetailContent: fmt.Sprintf("### Peringatan Masa Retensi Kepatuhan\n\nProduk **%s** telah dinonaktifkan sejak **%s**. Sesuai standar operasional kepatuhan, item yang tidak mendapatkan klarifikasi akan otomatis dipindahkan dari inventaris dalam waktu **%d hari** ke depan.\n\nJika terdapat kekeliruan atau Anda telah memiliki izin legalitas resmi, segera ajukan klarifikasi melalui formulir Bantuan CS.", p.Name, p.ModeratedAt.Format("02 Jan 2006"), remainingDays),
				Type:          "warning",
				ActionEnabled: true,
				ActionType:    "navigate",
				LinkSubTab:    "help",
				ActionLabel:   "Buka Pusat Bantuan CS →",
				ActionURL:     fmt.Sprintf("/%s/admin/help", storeSlug),
				CreatedAt:     now,
				UpdatedAt:     now,
			}
			_ = db.Create(&notif).Error

			// 2. Email via Transactional Queue
			if recipientEmail != "" {
				subj, bodyHTML := BuildItemRetentionReminderEmail(storeTitle, p.Name, reportNum, storeSlug, remainingDays)
				_, _ = EnqueueEmail(recipientEmail, storeTitle, "Catavor Trust & Safety", subj, bodyHTML, "item_retention_reminder", reportNum)
			}

			stats.RemindersSent++
		}
	}

	// =========================================================================
	// 2. PHASE 2: SOFT-DELETE & MEDIA PRUNE (30 <= Days Since Moderation < 90)
	// =========================================================================
	var h30Candidates []models.Product
	err = db.Model(&models.Product{}).
		Preload("Store").
		Preload("Store.User").
		Preload("Images").
		Where("moderation_status = 'hidden' AND moderated_at IS NOT NULL AND moderated_at <= ? AND deleted_at IS NULL", h30Threshold).
		Find(&h30Candidates).Error

	if err == nil {
		for _, p := range h30Candidates {
			// Safety Guard: Check if an active ticket exists
			if hasActiveTicket(db, p.StoreID, p.ID) {
				stats.SkippedActive++
				continue
			}

			// A. Create Legal Snapshot in Activity Logs (Compact Text/JSON audit proof)
			snapshot := map[string]interface{}{
				"product_id":        p.ID,
				"store_id":          p.StoreID,
				"name":              p.Name,
				"price":             p.Price,
				"image_url":         p.ImageURL,
				"product_type":      p.ProductType,
				"moderation_reason": p.ModerationReason,
				"moderated_at":      p.ModeratedAt,
				"soft_deleted_at":   now,
			}
			snapshotJSON, _ := json.Marshal(snapshot)

			RecordActivity(RecordActivityParams{
				DB:          db,
				StoreID:     &p.StoreID,
				ActorRole:   "system",
				ActorName:   "Bot Retensi Kepatuhan",
				ActorEmail:  "system@catavor.com",
				Action:      "product.auto_purge_soft_deleted",
				Category:    "compliance",
				EntityType:  "product",
				EntityID:    &p.ID,
				EntityTitle: p.Name,
				Description: fmt.Sprintf("Soft-delete otomatis item pelanggaran '%s' (#%d) setelah melewati masa retensi 30 hari.", p.Name, p.ID),
				Changes: map[string]interface{}{
					"snapshot": string(snapshotJSON),
				},
			})

			// B. Prune heavy media files from storage to save server disk space
			if strg != nil {
				if p.ImageURL != "" {
					if k := extractStorageKeyFromURL(p.ImageURL); k != "" {
						_ = strg.Delete(ctx, k)
					}
				}
				for _, pImg := range p.Images {
					if pImg.ImageURL != "" {
						if k := extractStorageKeyFromURL(pImg.ImageURL); k != "" {
							_ = strg.Delete(ctx, k)
						}
					}
				}
			}

			// C. Execute Soft Delete
			_ = db.Model(&models.Product{}).Where("id = ?", p.ID).Updates(map[string]interface{}{
				"is_active":  false,
				"deleted_at": now,
			}).Error
			_ = db.Table("faunas").Where("id = ?", p.ID).Updates(map[string]interface{}{
				"is_active":  false,
				"deleted_at": now,
			}).Error

			storeTitle := "Toko Catavor"
			storeSlug := ""
			recipientEmail := ""
			if p.Store != nil {
				storeTitle = p.Store.StoreTitle
				storeSlug = p.Store.Slug
				if p.Store.User != nil {
					recipientEmail = p.Store.User.Email
				}
			}

			reportNum := fmt.Sprintf("ITM-%d", p.ID)

			// D. Send In-App Notification
			notifID := fmt.Sprintf("notif_ret_h30_%d_%d", p.ID, now.Unix())
			notif := models.Notification{
				ID:            notifID,
				TargetType:    "single_store",
				TargetID:      p.StoreID,
				TargetName:    storeTitle,
				Title:         fmt.Sprintf("🗑️ Produk '%s' Dipindahkan dari Katalog", p.Name),
				Category:      "KEAMANAN",
				Message:       fmt.Sprintf("Produk '%s' telah otomatis dipindahkan dari inventaris katalog digital Anda karena telah melewati masa retensi 30 hari.", p.Name),
				DetailContent: fmt.Sprintf("### Pembersihan Otomatis Masa Retensi\n\nProduk **%s** telah otomatis dipindahkan dari inventaris aktif Anda karena telah melewati batas retensi 30 hari tanpa permohonan klarifikasi.\n\nKuota produk aktif katalog Anda kini telah dioptimalkan kembali.", p.Name),
				Type:          "info",
				ActionEnabled: true,
				ActionType:    "navigate",
				LinkSubTab:    "items",
				ActionLabel:   "Lihat Inventaris Toko →",
				ActionURL:     fmt.Sprintf("/%s/admin/items", storeSlug),
				CreatedAt:     now,
				UpdatedAt:     now,
			}
			_ = db.Create(&notif).Error

			// E. Dispatch Email via Transactional Queue
			if recipientEmail != "" {
				subj, bodyHTML := BuildItemRetentionSoftDeletedEmail(storeTitle, p.Name, reportNum, storeSlug)
				_, _ = EnqueueEmail(recipientEmail, storeTitle, "Catavor Trust & Safety", subj, bodyHTML, "item_retention_soft_deleted", reportNum)
			}

			stats.SoftDeleted++
		}
	}

	// =========================================================================
	// 3. PHASE 3: FINAL HARD-DELETE PURGE (Days Since Moderation >= 90)
	// =========================================================================
	h90Threshold := now.AddDate(0, 0, -90)

	var h90Candidates []models.Product
	err = db.Unscoped().Model(&models.Product{}).
		Where("moderation_status = 'hidden' AND moderated_at IS NOT NULL AND moderated_at <= ? AND deleted_at IS NOT NULL", h90Threshold).
		Find(&h90Candidates).Error

	if err == nil {
		for _, p := range h90Candidates {
			// Safety Guard: Check if an active ticket exists
			if hasActiveTicket(db, p.StoreID, p.ID) {
				stats.SkippedActive++
				continue
			}

			// Clean remaining relations
			_ = db.Unscoped().Where("product_id = ?", p.ID).Delete(&models.ProductImage{}).Error
			_ = db.Unscoped().Where("product_id = ?", p.ID).Delete(&models.ProductVariant{}).Error
			_ = db.Unscoped().Where("fauna_id = ?", p.ID).Delete(&models.Sighting{}).Error

			// Nullify FK in reports to preserve historical violation records without constraint error
			_ = db.Model(&models.Report{}).Where("fauna_id = ?", p.ID).Update("fauna_id", nil).Error

			// Hard Delete Product row permanently
			_ = db.Unscoped().Where("id = ?", p.ID).Delete(&models.Product{}).Error
			_ = db.Unscoped().Table("faunas").Where("id = ?", p.ID).Delete(nil).Error

			// Log Hard Delete in Activity Logs
			RecordActivity(RecordActivityParams{
				DB:          db,
				StoreID:     &p.StoreID,
				ActorRole:   "system",
				ActorName:   "Bot Retensi Kepatuhan",
				ActorEmail:  "system@catavor.com",
				Action:      "product.auto_purge_hard_deleted",
				Category:    "compliance",
				EntityType:  "product",
				EntityID:    &p.ID,
				EntityTitle: p.Name,
				Description: fmt.Sprintf("Hard-delete permanen total item pelanggaran '%s' (#%d) setelah masa retensi hukum 90 hari terpenuhi.", p.Name, p.ID),
			})

			stats.HardDeleted++
		}
	}

	log.Info().
		Int("reminders", stats.RemindersSent).
		Int("soft_deleted", stats.SoftDeleted).
		Int("hard_deleted", stats.HardDeleted).
		Int("skipped_active", stats.SkippedActive).
		Msg("Item retention and purge lifecycle completed")

	return stats, nil
}

// hasActiveTicket returns true if there is an active support ticket regarding this product
func hasActiveTicket(db *gorm.DB, storeID uint, productID uint) bool {
	var count int64
	searchPattern := fmt.Sprintf("%%#%d%%", productID)
	err := db.Model(&models.SupportTicket{}).
		Where("store_id = ? AND status IN ('open', 'in_progress', 'waiting_user', 'waiting_agent') AND (subject LIKE ? OR category = 'compliance')", storeID, searchPattern).
		Count(&count).Error
	return err == nil && count > 0
}

