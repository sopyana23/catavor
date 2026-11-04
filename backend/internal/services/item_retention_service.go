package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/storage"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// ItemRetentionStats tracks outcomes from a retention processing cycle.
type ItemRetentionStats struct {
	RemindersSent      int `json:"reminders_sent"`
	SoftDeleted        int `json:"soft_deleted"`
	HardDeleted        int `json:"hard_deleted"`
	RegularPurged      int `json:"regular_purged"`
	PurgedFiles        int `json:"purged_files"`
	BannedStoresPurged int `json:"banned_stores_purged"`
	SkippedActive      int `json:"skipped_active"`
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
		Where("moderation_status IN ('hidden', 'locked', 'banned', 'needs_fix', 'suspended') AND moderated_at IS NOT NULL AND moderated_at <= ? AND moderated_at > ? AND deleted_at IS NULL", h7Threshold, h30Threshold).
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

			storeTitle := "Katalog Catavor"
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

			var notifTitle, notifMsg, notifDetail, actionLabel, linkSubTab, actionURL string
			if p.ModerationStatus == "needs_fix" {
				notifTitle = fmt.Sprintf("⚠️ Batas Waktu Edit: Item '%s' (#%d) Dihapus dalam %d Hari", p.Name, p.ID, remainingDays)
				notifMsg = fmt.Sprintf("Item '%s' yang memerlukan penyesuaian informasi akan otomatis dipindahkan dari katalog Anda dalam waktu %d hari jika tidak diedit dan diajukan ulang.", p.Name, remainingDays)
				notifDetail = fmt.Sprintf("### Peringatan Masa Tenggang Perbaikan Item\n\nItem **%s** telah dinonaktifkan sementara sejak **%s** untuk memberi kesempatan perbaikan informasi katalog. Sesuai standar operasional kepatuhan, item yang tidak diedit dan diajukan ulang akan otomatis dipindahkan dari inventaris dalam waktu **%d hari** ke depan.\n\nSilakan buka menu inventaris item untuk memperbaiki foto, deskripsi, atau atribut yang belum sesuai.", p.Name, p.ModeratedAt.Format("02 Jan 2006"), remainingDays)
				actionLabel = "Perbaiki Item Sekarang →"
				linkSubTab = "items"
				actionURL = fmt.Sprintf("/%s/admin/items?item=%d&edit=%d", storeSlug, p.ID, p.ID)
			} else {
				notifTitle = fmt.Sprintf("⚠️ Peringatan: Item '%s' (#%d) Dihapus dalam %d Hari", p.Name, p.ID, remainingDays)
				notifMsg = fmt.Sprintf("Item '%s' yang dinonaktifkan oleh Tim Kepatuhan akan dihapus otomatis dari katalog Anda dalam waktu %d hari jika tidak ada tindakan klarifikasi.", p.Name, remainingDays)
				notifDetail = fmt.Sprintf("### Peringatan Masa Retensi Kepatuhan\n\nItem **%s** telah dinonaktifkan sejak **%s**. Sesuai standar operasional kepatuhan, item yang tidak mendapatkan klarifikasi akan otomatis dipindahkan dari inventaris dalam waktu **%d hari** ke depan.\n\nJika terdapat kekeliruan atau Anda telah memiliki izin legalitas resmi, segera ajukan klarifikasi melalui formulir Bantuan CS.", p.Name, p.ModeratedAt.Format("02 Jan 2006"), remainingDays)
				actionLabel = "Buka Pusat Bantuan CS →"
				linkSubTab = "help"
				actionURL = fmt.Sprintf("/%s/admin/help", storeSlug)
			}

			// 1. In-App Notification
			notifID := fmt.Sprintf("notif_ret_h7_%d_%d", p.ID, now.Unix())
			notif := models.Notification{
				ID:            notifID,
				TargetType:    "single_store",
				TargetID:      p.StoreID,
				TargetName:    storeTitle,
				Title:         notifTitle,
				Category:      "KEAMANAN",
				Message:       notifMsg,
				DetailContent: notifDetail,
				Type:          "warning",
				ActionEnabled: true,
				ActionType:    "navigate",
				LinkSubTab:    linkSubTab,
				ActionLabel:   actionLabel,
				ActionURL:     actionURL,
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
		Where("moderation_status IN ('hidden', 'locked', 'banned', 'needs_fix', 'suspended') AND moderated_at IS NOT NULL AND moderated_at <= ? AND deleted_at IS NULL", h30Threshold).
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

			// B. Collect heavy media files for deferred prune
			var filesToPrune []string
			if p.ImageURL != "" {
				filesToPrune = append(filesToPrune, p.ImageURL)
			}
			for _, pImg := range p.Images {
				if pImg.ImageURL != "" {
					filesToPrune = append(filesToPrune, pImg.ImageURL)
				}
			}

			// C. Execute Soft Delete in ACID Atomic Transaction (AGENTS.md Rule 5 & Rule 10)
			txErr := db.Transaction(func(tx *gorm.DB) error {
				if err := tx.Model(&models.Product{}).Where("id = ?", p.ID).Updates(map[string]interface{}{
					"is_active":  false,
					"deleted_at": now,
				}).Error; err != nil {
					return err
				}
				if tx.Migrator().HasTable("faunas") {
					if err := tx.Table("faunas").Where("id = ?", p.ID).Updates(map[string]interface{}{
						"is_active":  false,
						"deleted_at": now,
					}).Error; err != nil {
						return err
					}
				}
				return nil
			})

			if txErr != nil {
				log.Error().Err(txErr).Uint("product_id", p.ID).Msg("Failed to soft-delete compliance violation product")
				continue
			}

			// Multi-Layer Rollback (AGENTS.md Rule 10): Prune media files ONLY AFTER DB commit
			for _, rawImg := range filesToPrune {
				_, _ = HardDeleteLocalStorageFile(rawImg)
				if strg != nil {
					if k := extractStorageKeyFromURL(rawImg); k != "" {
						_ = strg.Delete(ctx, k)
					}
				}
			}

			// Recalculate store storage used and invalidate quota cache
			SyncStoreStorageUsed(db, p.StoreID)
			database.InvalidateStoreQuotaCache(ctx, p.StoreID)

			storeTitle := "Katalog Catavor"
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
				Title:         fmt.Sprintf("🗑️ Item '%s' Dipindahkan dari Katalog", p.Name),
				Category:      "KEAMANAN",
				Message:       fmt.Sprintf("Item '%s' telah otomatis dipindahkan dari inventaris katalog digital Anda karena telah melewati masa retensi 30 hari.", p.Name),
				DetailContent: fmt.Sprintf("### Pembersihan Otomatis Masa Retensi\n\nItem **%s** telah otomatis dipindahkan dari inventaris aktif Anda karena telah melewati batas retensi 30 hari tanpa permohonan klarifikasi.\n\nKuota item aktif katalog Anda kini telah dioptimalkan kembali.", p.Name),
				Type:          "info",
				ActionEnabled: true,
				ActionType:    "navigate",
				LinkSubTab:    "items",
				ActionLabel:   "Lihat Inventaris Katalog →",
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
		Preload("Images").
		Where("moderation_status IN ('hidden', 'locked', 'banned', 'needs_fix', 'suspended') AND moderated_at IS NOT NULL AND moderated_at <= ? AND deleted_at IS NOT NULL", h90Threshold).
		Find(&h90Candidates).Error

	if err == nil {
		for _, p := range h90Candidates {
			// Safety Guard: Check if an active ticket exists
			if hasActiveTicket(db, p.StoreID, p.ID) {
				stats.SkippedActive++
				continue
			}

			// Collect images for deferred permanent deletion
			var filesToDelete []string
			if p.ImageURL != "" {
				filesToDelete = append(filesToDelete, p.ImageURL)
			}
			for _, pImg := range p.Images {
				if pImg.ImageURL != "" {
					filesToDelete = append(filesToDelete, pImg.ImageURL)
				}
			}

			// Clean remaining relations and delete Product in ACID Atomic Transaction (AGENTS.md Rule 5 & Rule 10)
			txErr := db.Transaction(func(tx *gorm.DB) error {
				if err := tx.Unscoped().Where("product_id = ?", p.ID).Delete(&models.ProductImage{}).Error; err != nil {
					return err
				}
				if err := tx.Unscoped().Where("product_id = ?", p.ID).Delete(&models.ProductVariant{}).Error; err != nil {
					return err
				}
				if tx.Migrator().HasTable("sightings") {
					if err := tx.Unscoped().Where("fauna_id = ?", p.ID).Delete(&models.Sighting{}).Error; err != nil {
						return err
					}
				}

				// Nullify FK in reports to preserve historical violation records without constraint error
				if err := tx.Model(&models.Report{}).Where("fauna_id = ?", p.ID).Update("fauna_id", nil).Error; err != nil {
					return err
				}

				if err := tx.Unscoped().Where("id = ?", p.ID).Delete(&models.Product{}).Error; err != nil {
					return err
				}
				if tx.Migrator().HasTable("faunas") {
					if err := tx.Unscoped().Table("faunas").Where("id = ?", p.ID).Delete(nil).Error; err != nil {
						return err
					}
				}
				return nil
			})

			if txErr != nil {
				log.Error().Err(txErr).Uint("product_id", p.ID).Msg("Failed to hard-delete compliance product in transaction")
				continue
			}

			// Multi-Layer Rollback (AGENTS.md Rule 10): Delete remaining images ONLY AFTER DB commit
			for _, imgURL := range filesToDelete {
				_, _ = HardDeleteLocalStorageFile(imgURL)
				if strg != nil {
					if k := extractStorageKeyFromURL(imgURL); k != "" {
						_ = strg.Delete(ctx, k)
					}
				}
			}

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

			// Recalculate store storage used and invalidate quota cache
			SyncStoreStorageUsed(db, p.StoreID)
			database.InvalidateStoreQuotaCache(ctx, p.StoreID)

			stats.HardDeleted++
		}
	}

	// =========================================================================
	// 4. PHASE 4: REGULAR MERCHANT SOFT-DELETED PRODUCTS PURGE (>= 72 Hours / 3 Days)
	// =========================================================================
	regular72hThreshold := now.Add(-72 * time.Hour)

	var regularCandidates []models.Product
	err = db.Unscoped().Model(&models.Product{}).
		Preload("Images").
		Where("(moderation_status NOT IN ('hidden', 'locked', 'banned') OR moderation_status IS NULL) AND deleted_at IS NOT NULL AND deleted_at <= ?", regular72hThreshold).
		Find(&regularCandidates).Error

	if err == nil {
		for _, p := range regularCandidates {
			// Safety Guard / Litigation Hold: Check if an active ticket or report exists
			if hasActiveTicket(db, p.StoreID, p.ID) || hasActiveReport(db, p.ID) {
				stats.SkippedActive++
				continue
			}

			// Collect all images belonging to this product
			imagesToDelete := make([]string, 0)
			if p.ImageURL != "" {
				imagesToDelete = append(imagesToDelete, p.ImageURL)
			}
			for _, pImg := range p.Images {
				if pImg.ImageURL != "" {
					imagesToDelete = append(imagesToDelete, pImg.ImageURL)
				}
			}
			if len(p.DetailedInfo) > 0 {
				var dInfo map[string]interface{}
				if err := json.Unmarshal(p.DetailedInfo, &dInfo); err == nil {
					if rawImages, ok := dInfo["images"].([]interface{}); ok {
						for _, itm := range rawImages {
							if str, ok := itm.(string); ok && str != "" {
								imagesToDelete = append(imagesToDelete, str)
							}
						}
					}
				}
			}

			// Determine which image files can be safely deleted (not used by other active products)
			var confirmedFilesToDelete []string
			for _, imgURL := range imagesToDelete {
				var otherProdCount int64
				db.Model(&models.Product{}).Where("deleted_at IS NULL AND id != ? AND image_url = ?", p.ID, imgURL).Count(&otherProdCount)
				var otherImgCount int64
				db.Model(&models.ProductImage{}).
					Joins("JOIN products ON products.id = product_images.product_id").
					Where("products.deleted_at IS NULL AND product_images.product_id != ? AND product_images.image_url = ?", p.ID, imgURL).
					Count(&otherImgCount)
				if otherProdCount == 0 && otherImgCount == 0 {
					confirmedFilesToDelete = append(confirmedFilesToDelete, imgURL)
				}
			}

			// Clean child relations and delete product in ACID Atomic Transaction (AGENTS.md Rule 5 & Rule 10)
			txErr := db.Transaction(func(tx *gorm.DB) error {
				if err := tx.Unscoped().Where("product_id = ?", p.ID).Delete(&models.ProductImage{}).Error; err != nil {
					return err
				}
				if err := tx.Unscoped().Where("product_id = ?", p.ID).Delete(&models.ProductVariant{}).Error; err != nil {
					return err
				}
				if tx.Migrator().HasTable("sightings") {
					if err := tx.Unscoped().Where("fauna_id = ?", p.ID).Delete(&models.Sighting{}).Error; err != nil {
						return err
					}
				}

				// Nullify FK in reports if any archived report references it
				if err := tx.Model(&models.Report{}).Where("fauna_id = ?", p.ID).Update("fauna_id", nil).Error; err != nil {
					return err
				}

				if err := tx.Unscoped().Where("id = ?", p.ID).Delete(&models.Product{}).Error; err != nil {
					return err
				}
				if tx.Migrator().HasTable("faunas") {
					if err := tx.Unscoped().Table("faunas").Where("id = ?", p.ID).Delete(nil).Error; err != nil {
						return err
					}
				}
				return nil
			})

			if txErr != nil {
				log.Error().Err(txErr).Uint("product_id", p.ID).Msg("Failed to hard-delete regular product in transaction")
				continue
			}

			// Multi-Layer Rollback (AGENTS.md Rule 10): Delete physical files ONLY AFTER DB commit
			for _, imgURL := range confirmedFilesToDelete {
				if _, errDel := HardDeleteLocalStorageFile(imgURL); errDel == nil {
					stats.PurgedFiles++
				}
				if strg != nil {
					if k := extractStorageKeyFromURL(imgURL); k != "" {
						_ = strg.Delete(ctx, k)
					}
				}
			}

			// Record permanent purge in Activity Log
			RecordActivity(RecordActivityParams{
				DB:          db,
				StoreID:     &p.StoreID,
				ActorRole:   "system",
				ActorName:   "Bot Retensi Katalog",
				ActorEmail:  "system@catavor.com",
				Action:      "product.auto_purge_regular_hard_deleted",
				Category:    "catalog",
				EntityType:  "product",
				EntityID:    &p.ID,
				EntityTitle: p.Name,
				Description: fmt.Sprintf("Hard-delete permanen produk '%s' (#%d) setelah masa cooling-off 72 jam terpenuhi.", p.Name, p.ID),
			})

			// Recalculate store storage used
			SyncStoreStorageUsed(db, p.StoreID)

			stats.RegularPurged++
		}
	}

	// =========================================================================
	// 5. PHASE 5: BANNED STORE & MEDIA PERMANENT PURGE (>= 90 Days)
	// =========================================================================
	h90StoreThreshold := now.AddDate(0, 0, -90)

	var bannedStores []models.Store
	err = db.Model(&models.Store{}).
		Where("dormancy_status = 'banned' AND dormancy_banned_at IS NOT NULL AND dormancy_banned_at <= ?", h90StoreThreshold).
		Find(&bannedStores).Error

	if err == nil {
		for _, s := range bannedStores {
			// Safety Guard / Litigation Hold: Check if active unresolved reports exist for this store
			var activeDisputes int64
			db.Model(&models.Report{}).
				Where("store_id = ? AND status IN ('pending', 'investigating', 're_review')", s.ID).
				Count(&activeDisputes)
			if activeDisputes > 0 {
				stats.SkippedActive++
				continue
			}

			// 1. Gather product IDs for cascading removal
			var prodIDs []uint
			db.Unscoped().Model(&models.Product{}).Where("store_id = ?", s.ID).Pluck("id", &prodIDs)

			// 2. Cascade delete records and anonymize store in ACID Atomic Transaction (AGENTS.md Rule 5 & Rule 10)
			txErr := db.Transaction(func(tx *gorm.DB) error {
				if len(prodIDs) > 0 {
					if err := tx.Unscoped().Where("product_id IN ?", prodIDs).Delete(&models.ProductImage{}).Error; err != nil {
						return err
					}
					if err := tx.Unscoped().Where("product_id IN ?", prodIDs).Delete(&models.ProductVariant{}).Error; err != nil {
						return err
					}
					if tx.Migrator().HasTable("sightings") {
						if err := tx.Unscoped().Where("fauna_id IN ?", prodIDs).Delete(&models.Sighting{}).Error; err != nil {
							return err
						}
					}
					if err := tx.Unscoped().Where("id IN ?", prodIDs).Delete(&models.Product{}).Error; err != nil {
						return err
					}
					if tx.Migrator().HasTable("faunas") {
						if err := tx.Unscoped().Table("faunas").Where("id IN ?", prodIDs).Delete(nil).Error; err != nil {
							return err
						}
					}
				}

				// Mark store dormancy status as 'purged' and anonymize personal details (UU PDP compliance)
				return tx.Model(&models.Store{}).Where("id = ?", s.ID).Updates(map[string]interface{}{
					"dormancy_status":   "purged",
					"whatsapp_number":   "",
					"about_description": "",
					"about_location":    "",
					"store_slogan":      "",
					"promo_banner":      "",
					"store_logo_url":    "",
				}).Error
			})

			if txErr != nil {
				log.Error().Err(txErr).Uint("store_id", s.ID).Msg("Failed to purge banned store database records in transaction")
				continue
			}

			// 3. Multi-Layer Rollback (AGENTS.md Rule 10):
			// Clean physical media folders from disk & cloud storage ONLY AFTER DB commit
			storePrefix := fmt.Sprintf("stores/%d/", s.ID)
			if strg != nil {
				_ = strg.DeletePrefix(ctx, storePrefix)
				_ = strg.DeletePrefix(ctx, fmt.Sprintf("private/stores/%d/", s.ID))
			}
			if cfg != nil {
				if cfg.StorageLocalRoot != "" {
					_ = os.RemoveAll(filepath.Join(cfg.StorageLocalRoot, "stores", fmt.Sprintf("%d", s.ID)))
					_ = os.RemoveAll(filepath.Join(cfg.StorageLocalRoot, fmt.Sprintf("%d", s.ID)))
				}
				if cfg.StorageDir != "" {
					_ = os.RemoveAll(filepath.Join(cfg.StorageDir, "stores", fmt.Sprintf("%d", s.ID)))
				}
			}

			// Record permanent purge in Activity Log
			RecordActivity(RecordActivityParams{
				DB:          db,
				StoreID:     &s.ID,
				ActorRole:   "system",
				ActorName:   "Bot Retensi Kepatuhan",
				ActorEmail:  "system@catavor.com",
				Action:      "store.auto_purge_banned",
				Category:    "compliance",
				EntityType:  "store",
				EntityID:    &s.ID,
				EntityTitle: s.StoreTitle,
				Description: fmt.Sprintf("Pemusnahan total media fisik dan produk toko banned '%s' (#%d) setelah masa retensi hukum 90 hari terpenuhi.", s.StoreTitle, s.ID),
			})

			stats.BannedStoresPurged++
		}
	}

	log.Info().
		Int("reminders", stats.RemindersSent).
		Int("soft_deleted", stats.SoftDeleted).
		Int("hard_deleted", stats.HardDeleted).
		Int("regular_purged", stats.RegularPurged).
		Int("purged_files", stats.PurgedFiles).
		Int("banned_stores_purged", stats.BannedStoresPurged).
		Int("skipped_active", stats.SkippedActive).
		Msg("Item and banned store retention and purge lifecycle completed")

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

// hasActiveReport returns true if there is an active pending/investigating report regarding this product
func hasActiveReport(db *gorm.DB, productID uint) bool {
	var count int64
	err := db.Model(&models.Report{}).
		Where("target_type = 'item' AND fauna_id = ? AND status IN ('pending', 'investigating', 'action_taken', 're_review')", productID).
		Count(&count).Error
	return err == nil && count > 0
}

