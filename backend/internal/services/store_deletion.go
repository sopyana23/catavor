package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/storage"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// DeleteStoreRecords runs inside the caller's transaction, after locking the selected store.
// Support history follows ticket retention. Policy acknowledgements retain their original evidence.
func DeleteStoreRecords(tx *gorm.DB, storeIDs ...uint) error {
	if len(storeIDs) == 0 {
		return nil
	}
	for _, id := range storeIDs {
		if id == 0 {
			return errors.New("missing store ID")
		}
	}
	// Guard historical or inconsistent references before the ad FK can cascade
	// into a campaign belonging to a different store.
	var foreignCampaign bool
	if err := tx.Raw(`SELECT EXISTS (SELECT 1 FROM ad_campaigns WHERE store_id NOT IN ?
		AND (target_store_id IN ? OR target_product_id IN (SELECT id FROM products WHERE store_id IN ?)))`,
		storeIDs, storeIDs, storeIDs).Scan(&foreignCampaign).Error; err != nil {
		return err
	}
	if foreignCampaign {
		return errors.New("catalog referenced by a campaign outside the deletion scope")
	}

	for _, statement := range []string{
		`WITH retained AS (DELETE FROM subscription_orders WHERE store_id IN ? RETURNING
			id, store_id, order_number, plan_code, billing_cycle, duration_months, original_amount, discount_amount,
			final_amount, coupon_code, payment_method, payment_status, gateway_reference, paid_at, created_at)
		 INSERT INTO retained_store_orders(order_kind,source_id,former_store_id,snapshot)
		 SELECT 'subscription', id, store_id, to_jsonb(retained) FROM retained`,
		`WITH retained AS (DELETE FROM ad_orders WHERE store_id IN ? RETURNING
			id, store_id, order_number, campaign_id, slot_name_snapshot, pricing_model_snapshot, duration_days,
			original_amount, discount_amount, final_amount, coupon_code, payment_method, payment_status, gateway_reference, paid_at, created_at)
		 INSERT INTO retained_store_orders(order_kind,source_id,former_store_id,snapshot)
		 SELECT 'advertising', id, store_id, to_jsonb(retained) FROM retained`,
		"UPDATE support_tickets SET store_id = NULL WHERE store_id IN ?",
		"UPDATE user_policy_agreements SET store_id = NULL WHERE store_id IN ?",
		"DELETE FROM notification_reads WHERE notification_id IN (SELECT id FROM notifications WHERE target_type = 'single_store' AND target_id IN ?)",
		"DELETE FROM notifications WHERE target_type = 'single_store' AND target_id IN ?",
		"DELETE FROM notification_reads WHERE store_id IN ?",
		"DELETE FROM comments WHERE article_id IN (SELECT id FROM articles WHERE store_id IN ?)",
		"DELETE FROM articles WHERE store_id IN ?",
		"DELETE FROM reports WHERE store_id IN ?",
		"DELETE FROM ad_daily_metrics WHERE store_id IN ?",
		"DELETE FROM ad_campaigns WHERE store_id IN ?",
		"DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE store_id IN ?)",
		"DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE store_id IN ?)",
		"DELETE FROM product_daily_analytics WHERE store_id IN ?",
		"DELETE FROM products WHERE store_id IN ?",
		"DELETE FROM categories WHERE store_id IN ?",
		"DELETE FROM store_daily_analytics WHERE store_id IN ?",
		"DELETE FROM store_daily_traffic_sources WHERE store_id IN ?",
		"DELETE FROM store_daily_audience_metrics WHERE store_id IN ?",
		"DELETE FROM recent_visitor_events WHERE store_id IN ?",
		"DELETE FROM search_analytics WHERE store_id IN ?",
		"DELETE FROM activity_logs WHERE store_id IN ?",
	} {
		if err := tx.Exec(statement, storeIDs).Error; err != nil {
			return err
		}
	}
	if err := tx.Exec("INSERT INTO pending_store_media_deletions(store_id) SELECT id FROM stores WHERE id IN ?", storeIDs).Error; err != nil {
		return err
	}
	result := tx.Exec("DELETE FROM stores WHERE id IN ?", storeIDs)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != int64(len(storeIDs)) {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// RemoveStoreMedia only addresses namespaces derived from the numeric ID. URLs in
// merchant content cannot direct cleanup into another catalog.
func RemoveStoreMedia(ctx context.Context, db *gorm.DB, driver storage.StorageService, cfg *config.Config, storeID uint) error {
	if storeID == 0 {
		return errors.New("missing store ID")
	}
	id := strconv.FormatUint(uint64(storeID), 10)
	attempt := db.Exec("UPDATE pending_store_media_deletions SET last_attempt_at=? WHERE store_id=? AND NOT EXISTS (SELECT 1 FROM stores WHERE id=?)", time.Now().UTC(), storeID, storeID)
	if attempt.Error != nil {
		return attempt.Error
	}
	if attempt.RowsAffected == 0 {
		return nil
	}
	if driver == nil {
		if cfg == nil {
			return errors.New("storage configuration unavailable")
		}
		var err error
		driver, err = storage.NewStorageService(cfg)
		if err != nil {
			return err
		}
	}
	if cfg != nil {
		for _, root := range []string{cfg.StorageLocalRoot, cfg.StoragePrivateRoot} {
			if root == "" {
				continue
			}
			for _, sub := range []string{"stores", filepath.Join("stores", id), id} {
				fi, err := os.Lstat(filepath.Join(root, sub))
				if err != nil && !os.IsNotExist(err) {
					return err
				}
				if err == nil && fi.Mode()&os.ModeSymlink != 0 {
					return fmt.Errorf("cannot clean symbolic link in catalog storage: %s", sub)
				}
			}
		}
	}
	var err error
	if driver != nil {
		for _, prefix := range []string{"stores/" + id + "/", "private/stores/" + id + "/"} {
			err = errors.Join(err, driver.DeletePrefix(ctx, prefix))
		}
	}
	if cfg != nil {
		if cfg.StorageLocalRoot != "" {
			err = errors.Join(err, os.RemoveAll(filepath.Join(cfg.StorageLocalRoot, "stores", id)), os.RemoveAll(filepath.Join(cfg.StorageLocalRoot, id)))
		}
		if cfg.StoragePrivateRoot != "" {
			err = errors.Join(err, os.RemoveAll(filepath.Join(cfg.StoragePrivateRoot, "stores", id)))
		}
	}
	if err != nil {
		return err
	}
	return db.Exec("DELETE FROM pending_store_media_deletions WHERE store_id=?", storeID).Error
}

func retryDeletedStoreMedia(db *gorm.DB) {
	var ids []uint
	if err := db.Table("pending_store_media_deletions").Order("last_attempt_at ASC NULLS FIRST, store_id").Limit(100).Pluck("store_id", &ids).Error; err != nil {
		log.Error().Err(err).Msg("Failed to read pending store media cleanup")
		return
	}
	for _, id := range ids {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		err := RemoveStoreMedia(ctx, db, nil, config.AppConfig, id)
		cancel()
		if err != nil {
			log.Error().Err(err).Uint("store_id", id).Msg("Store media cleanup pending")
		}
	}
	var owners []uint
	if err := db.Table("pending_owner_media_deletions").Order("last_attempt_at ASC NULLS FIRST, owner_id").Limit(100).Pluck("owner_id", &owners).Error; err != nil {
		log.Error().Err(err).Msg("Failed to read pending account media cleanup")
		return
	}
	for _, id := range owners {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		err := RemoveClosedAccountMedia(ctx, db, nil, config.AppConfig, id)
		cancel()
		if err != nil {
			log.Error().Err(err).Uint("user_id", id).Msg("Account media cleanup pending")
		}
	}
}

// QueueClosedAccountMedia commits alongside the verified account closure so a
// crash between the database commit and physical deletion remains recoverable.
func QueueClosedAccountMedia(tx *gorm.DB, ownerID uint, keys []string) error {
	data, err := json.Marshal(keys)
	if err != nil {
		return err
	}
	return tx.Exec("INSERT INTO pending_owner_media_deletions(owner_id,support_keys) VALUES (?,?::jsonb)", ownerID, string(data)).Error
}

func RemoveClosedAccountMedia(ctx context.Context, db *gorm.DB, driver storage.StorageService, cfg *config.Config, ownerID uint) error {
	var pending struct{ SupportKeys string }
	result := db.Raw("UPDATE pending_owner_media_deletions SET last_attempt_at=? WHERE owner_id=? AND NOT EXISTS (SELECT 1 FROM users WHERE id=?) RETURNING support_keys::text", time.Now().UTC(), ownerID, ownerID).Scan(&pending)
	if result.Error != nil || result.RowsAffected == 0 {
		return result.Error
	}
	var keys []string
	if err := json.Unmarshal([]byte(pending.SupportKeys), &keys); err != nil {
		return err
	}
	if driver == nil {
		if cfg == nil {
			return errors.New("storage configuration unavailable")
		}
		var err error
		driver, err = storage.NewStorageService(cfg)
		if err != nil {
			return err
		}
	}
	_, err := RemoveOwnerTicketFiles(ctx, db, driver, keys)
	prefix := fmt.Sprintf("private/billing/users/%d/", ownerID)
	err = errors.Join(err, driver.DeletePrefix(ctx, prefix))
	if cfg != nil && cfg.StoragePrivateRoot != "" && driver.GetDriverName() != "local" {
		err = errors.Join(err, storage.NewLocalStorageService(cfg).DeletePrefix(ctx, prefix))
	}
	if err != nil {
		return err
	}
	return db.Exec("DELETE FROM pending_owner_media_deletions WHERE owner_id=?", ownerID).Error
}

func storeMediaKey(raw string, storeID uint) string {
	key := ExtractStorageKey(raw)
	if storeID == 0 || key == "" || strings.ContainsAny(key, "\\\\:") || filepath.ToSlash(filepath.Clean(key)) != key {
		return ""
	}
	id := strconv.FormatUint(uint64(storeID), 10) + "/"
	if strings.HasPrefix(key, "stores/"+id) || strings.HasPrefix(key, "private/stores/"+id) || strings.HasPrefix(key, id) {
		return key
	}
	return ""
}
