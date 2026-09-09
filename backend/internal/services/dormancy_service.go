package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/smtp"
	"os"
	"strings"
	"sync"
	"time"

	"catavor-backend/internal/models"
	"catavor-backend/internal/storage"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// inMemoryActivityCache prevents excessive database writes on high-traffic public catalog views.
var (
	activityCacheMutex sync.RWMutex
	activityCache      = make(map[uint]time.Time)
)

// StartDormancyWorker initializes and runs the background inactivity lifecycle engine.
func StartDormancyWorker(ctx context.Context, db *gorm.DB, strg storage.StorageService, interval time.Duration) {
	if interval <= 0 {
		interval = 1 * time.Hour
	}

	go func() {
		log.Info().Dur("interval", interval).Msg("Dormancy & Account Inactivity Lifecycle Worker started")
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		// Run an initial scan on startup after 10 seconds
		time.Sleep(10 * time.Second)
		RunDormancyCycle(db, strg)

		for {
			select {
			case <-ticker.C:
				RunDormancyCycle(db, strg)
			case <-ctx.Done():
				log.Info().Msg("Dormancy Lifecycle Worker stopped gracefully")
				return
			}
		}
	}()
}

// TouchStoreActivity safely updates last_activity_at with memory-based throttling (max 1 DB write per 30 mins per store).
func TouchStoreActivity(db *gorm.DB, storeID uint) {
	if db == nil || storeID == 0 {
		return
	}

	now := time.Now().UTC()

	activityCacheMutex.RLock()
	lastTouch, exists := activityCache[storeID]
	activityCacheMutex.RUnlock()

	// Throttle: If touched within last 30 minutes, skip database write
	if exists && now.Sub(lastTouch) < 30*time.Minute {
		return
	}

	activityCacheMutex.Lock()
	activityCache[storeID] = now
	activityCacheMutex.Unlock()

	// Update last_activity_at in DB and auto-restore status to 'active' if it was in warning/suspended
	go func(sID uint, t time.Time) {
		_ = db.Model(&models.Store{}).
			Where("id = ?", sID).
			Updates(map[string]interface{}{
				"last_activity_at":          t,
				"dormancy_status":           "active",
				"dormancy_warning1_sent_at": nil,
				"dormancy_warning2_sent_at": nil,
				"dormancy_suspended_at":     nil,
			}).Error
	}(storeID, now)
}

// ReactivateStoreByToken restores a store using a 1-click magic link token from email.
func ReactivateStoreByToken(db *gorm.DB, token string) (*models.Store, error) {
	if db == nil || strings.TrimSpace(token) == "" {
		return nil, fmt.Errorf("token tidak valid")
	}

	var store models.Store
	err := db.Preload("User").Where("reactivation_token = ?", strings.TrimSpace(token)).First(&store).Error
	if err != nil {
		return nil, fmt.Errorf("token reaktivasi tidak ditemukan atau sudah kedaluwarsa")
	}

	now := time.Now().UTC()
	store.LastActivityAt = now
	store.DormancyStatus = "active"
	store.DormancyWarning1SentAt = nil
	store.DormancyWarning2SentAt = nil
	store.DormancySuspendedAt = nil
	store.ReactivationToken = ""

	if err := db.Save(&store).Error; err != nil {
		return nil, fmt.Errorf("gagal memperbarui status toko: %w", err)
	}

	// Invalidate memory cache to allow immediate activity tracking
	activityCacheMutex.Lock()
	delete(activityCache, store.ID)
	activityCacheMutex.Unlock()

	log.Info().Uint("store_id", store.ID).Str("slug", store.Slug).Msg("Store successfully reactivated via 1-click magic token")
	return &store, nil
}

// ReactivateStoreByID restores a store by store ID directly from merchant dashboard.
func ReactivateStoreByID(db *gorm.DB, storeID uint) (*models.Store, error) {
	if db == nil || storeID == 0 {
		return nil, fmt.Errorf("store_id tidak valid")
	}

	var store models.Store
	err := db.Preload("User").Where("id = ?", storeID).First(&store).Error
	if err != nil {
		return nil, fmt.Errorf("toko tidak ditemukan")
	}

	now := time.Now().UTC()
	store.LastActivityAt = now
	store.DormancyStatus = "active"
	store.DormancyWarning1SentAt = nil
	store.DormancyWarning2SentAt = nil
	store.DormancySuspendedAt = nil
	store.ReactivationToken = ""

	if err := db.Save(&store).Error; err != nil {
		return nil, fmt.Errorf("gagal memperpanjang masa aktif toko: %w", err)
	}

	activityCacheMutex.Lock()
	delete(activityCache, store.ID)
	activityCacheMutex.Unlock()

	return &store, nil
}

// RunDormancyCycle evaluates all stores against the multi-stage dormancy lifecycle matrix.
func RunDormancyCycle(db *gorm.DB, strg storage.StorageService) {
	if db == nil {
		return
	}

	now := time.Now().UTC()
	baseURL := getAppBaseURL()

	// -------------------------------------------------------------
	// STAGE 1: Warning 1 (30 Days Inactive -> Sisa 15 Hari Sebelum Freeze)
	// -------------------------------------------------------------
	day30Threshold := now.AddDate(0, 0, -30)
	var stage1Stores []models.Store
	err := db.Preload("User").
		Where("plan = 'free' AND is_exempt_from_dormancy = false AND dormancy_status = 'active' AND last_activity_at <= ?", day30Threshold).
		Find(&stage1Stores).Error

	if err == nil && len(stage1Stores) > 0 {
		for _, store := range stage1Stores {
			token := generateSecureToken()
			sentAt := now

			db.Model(&store).Updates(map[string]interface{}{
				"dormancy_status":           "warning_1",
				"dormancy_warning1_sent_at": sentAt,
				"reactivation_token":        token,
			})

			reactivateURL := fmt.Sprintf("%s/api/public/stores/reactivate?token=%s", baseURL, token)

			// 1. In-App Notification
			createInAppDormancyNotification(db, store.ID, store.UserID,
				"Pemberitahuan Inaktivitas Katalog",
				fmt.Sprintf("Katalog '%s' terdeteksi tidak aktif selama 30 hari. Perpanjang masa aktif gratis dalam 15 hari ke depan agar katalog tetap online.", store.StoreTitle),
				"warning",
			)

			// 2. Automated Email
			if store.User != nil && store.User.Email != "" {
				sendDormancyEmail(
					store.User.Email,
					store.StoreTitle,
					"Peringatan Awal: Katalog Anda Terdeteksi Tidak Aktif",
					1,
					15,
					reactivateURL,
				)
			}
			log.Info().Uint("store_id", store.ID).Str("slug", store.Slug).Msg("Dispatched Inactivity Warning 1 (Day 30)")
		}
	}

	// -------------------------------------------------------------
	// STAGE 2: Warning 2 Urgent Countdown (38 Days Inactive -> Sisa 7 Hari)
	// -------------------------------------------------------------
	day38Threshold := now.AddDate(0, 0, -38)
	var stage2Stores []models.Store
	err = db.Preload("User").
		Where("plan = 'free' AND is_exempt_from_dormancy = false AND dormancy_status = 'warning_1' AND last_activity_at <= ? AND dormancy_warning2_sent_at IS NULL", day38Threshold).
		Find(&stage2Stores).Error

	if err == nil && len(stage2Stores) > 0 {
		for _, store := range stage2Stores {
			token := store.ReactivationToken
			if token == "" {
				token = generateSecureToken()
			}
			sentAt := now

			db.Model(&store).Updates(map[string]interface{}{
				"dormancy_status":           "warning_2",
				"dormancy_warning2_sent_at": sentAt,
				"reactivation_token":        token,
			})

			reactivateURL := fmt.Sprintf("%s/api/public/stores/reactivate?token=%s", baseURL, token)

			createInAppDormancyNotification(db, store.ID, store.UserID,
				"⚠️ 7 Hari Tersisa: Katalog Akan Dinonaktifkan Sementara",
				fmt.Sprintf("Katalog '%s' akan dinonaktifkan dalam 7 hari karena tidak ada aktivitas. Klik tombol untuk memperpanjang masa aktif gratis.", store.StoreTitle),
				"warning",
			)

			if store.User != nil && store.User.Email != "" {
				sendDormancyEmail(
					store.User.Email,
					store.StoreTitle,
					"⚠️ 7 Hari Tersisa: Pertahankan Katalog & Data Anda",
					2,
					7,
					reactivateURL,
				)
			}
			log.Info().Uint("store_id", store.ID).Str("slug", store.Slug).Msg("Dispatched Urgent Inactivity Warning 2 (Day 38)")
		}
	}

	// -------------------------------------------------------------
	// STAGE 3: Soft Suspension (45 Days Inactive -> Freeze Catalog)
	// -------------------------------------------------------------
	day45Threshold := now.AddDate(0, 0, -45)
	var stage3Stores []models.Store
	err = db.Preload("User").
		Where("plan = 'free' AND is_exempt_from_dormancy = false AND dormancy_status IN ('active', 'warning_1', 'warning_2') AND last_activity_at <= ?", day45Threshold).
		Find(&stage3Stores).Error

	if err == nil && len(stage3Stores) > 0 {
		for _, store := range stage3Stores {
			token := store.ReactivationToken
			if token == "" {
				token = generateSecureToken()
			}
			suspendedAt := now

			db.Model(&store).Updates(map[string]interface{}{
				"dormancy_status":       "suspended",
				"dormancy_suspended_at": suspendedAt,
				"reactivation_token":    token,
			})

			reactivateURL := fmt.Sprintf("%s/api/public/stores/reactivate?token=%s", baseURL, token)

			createInAppDormancyNotification(db, store.ID, store.UserID,
				"Katalog Dinonaktifkan Sementara",
				fmt.Sprintf("Katalog '%s' telah dinonaktifkan sementara. Data dan foto produk Anda masih tersimpan aman selama 15 hari. Klik untuk mengaktifkan kembali.", store.StoreTitle),
				"warning",
			)

			if store.User != nil && store.User.Email != "" {
				sendDormancyEmail(
					store.User.Email,
					store.StoreTitle,
					"Katalog Anda Dinonaktifkan Sementara (Masa Tenggang 15 Hari)",
					3,
					15,
					reactivateURL,
				)
			}
			log.Warn().Uint("store_id", store.ID).Str("slug", store.Slug).Msg("Store soft suspended due to 45-day inactivity")
		}
	}

	// -------------------------------------------------------------
	// STAGE 4: Hard Purge & Resource Reclamation (60 Days Inactive)
	// -------------------------------------------------------------
	day60Threshold := now.AddDate(0, 0, -60)
	var stage4Stores []models.Store
	err = db.Preload("User").
		Where("plan = 'free' AND is_exempt_from_dormancy = false AND dormancy_status = 'suspended' AND last_activity_at <= ?", day60Threshold).
		Find(&stage4Stores).Error

	if err == nil && len(stage4Stores) > 0 {
		ctx := context.Background()
		for _, store := range stage4Stores {
			userEmail := ""
			userName := ""
			userID := store.UserID
			if store.User != nil {
				userEmail = store.User.Email
				userName = store.User.Name
			}

			log.Warn().Uint("store_id", store.ID).Str("slug", store.Slug).Msg("Executing Hard Purge on 60-day dormant store...")

			// 1. Collect and delete all physical media files from storage
			var products []models.Product
			_ = db.Preload("Images").Where("store_id = ?", store.ID).Find(&products).Error

			deletedFilesCount := 0
			for _, prod := range products {
				// Delete primary image
				if prod.ImageURL != "" {
					key := extractStorageKeyFromURL(prod.ImageURL)
					if key != "" && strg != nil {
						_ = strg.Delete(ctx, key)
						deletedFilesCount++
					}
				}
				// Delete gallery images
				for _, pImg := range prod.Images {
					if pImg.ImageURL != "" {
						key := extractStorageKeyFromURL(pImg.ImageURL)
						if key != "" && strg != nil {
							_ = strg.Delete(ctx, key)
							deletedFilesCount++
						}
					}
				}
			}

			// Delete store logo and banner
			if store.StoreLogoURL != "" && strg != nil {
				key := extractStorageKeyFromURL(store.StoreLogoURL)
				if key != "" {
					_ = strg.Delete(ctx, key)
					deletedFilesCount++
				}
			}
			if store.PromoBanner != "" && strg != nil {
				key := extractStorageKeyFromURL(store.PromoBanner)
				if key != "" {
					_ = strg.Delete(ctx, key)
					deletedFilesCount++
				}
			}

			// 2. Cascade delete database records
			_ = db.Exec("DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE store_id = ?)", store.ID)
			_ = db.Exec("DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE store_id = ?)", store.ID)
			_ = db.Exec("DELETE FROM product_daily_analytics WHERE store_id = ?", store.ID)
			_ = db.Exec("DELETE FROM store_daily_analytics WHERE store_id = ?", store.ID)
			_ = db.Exec("DELETE FROM comments WHERE store_id = ?", store.ID)
			_ = db.Exec("DELETE FROM articles WHERE store_id = ?", store.ID)
			_ = db.Exec("DELETE FROM products WHERE store_id = ?", store.ID)
			_ = db.Exec("DELETE FROM categories WHERE store_id = ?", store.ID)
			_ = db.Exec("DELETE FROM notifications WHERE (target_type = 'single_store' AND target_id = ?) OR (target_type = 'single_user' AND target_id = ?)", store.ID, userID)
			_ = db.Exec("DELETE FROM notification_reads WHERE store_id = ? OR user_id = ?", store.ID, userID)
			_ = db.Exec("DELETE FROM support_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_id = ?)", userID)
			_ = db.Exec("DELETE FROM support_tickets WHERE user_id = ?", userID)
			_ = db.Exec("DELETE FROM stores WHERE id = ?", store.ID)
			if userID > 0 {
				_ = db.Exec("DELETE FROM users WHERE id = ?", userID)
			}

			// Invalidate cache
			activityCacheMutex.Lock()
			delete(activityCache, store.ID)
			activityCacheMutex.Unlock()

			// 3. Send final notification email
			if userEmail != "" {
				sendDormancyEmail(
					userEmail,
					store.StoreTitle,
					"Pemberitahuan Penghapusan Akun & Pembersihan Data Toko",
					4,
					0,
					baseURL,
				)
			}

			log.Info().
				Uint("store_id", store.ID).
				Str("user_email", userEmail).
				Str("user_name", userName).
				Int("freed_files", deletedFilesCount).
				Msg("Hard Purge completed. Database records and physical media files successfully reclaimed.")
		}
	}
}

// GetDormancyMetrics aggregates high-level dormancy status counts for superadmin insights.
func GetDormancyMetrics(db *gorm.DB) map[string]interface{} {
	if db == nil {
		return map[string]interface{}{
			"active":    0,
			"warning_1": 0,
			"warning_2": 0,
			"suspended": 0,
			"total":     0,
		}
	}

	var activeCount, warning1Count, warning2Count, suspendedCount int64
	db.Model(&models.Store{}).Where("plan = 'free' AND dormancy_status = 'active'").Count(&activeCount)
	db.Model(&models.Store{}).Where("plan = 'free' AND dormancy_status = 'warning_1'").Count(&warning1Count)
	db.Model(&models.Store{}).Where("plan = 'free' AND dormancy_status = 'warning_2'").Count(&warning2Count)
	db.Model(&models.Store{}).Where("plan = 'free' AND dormancy_status = 'suspended'").Count(&suspendedCount)

	return map[string]interface{}{
		"active_free":    activeCount,
		"warning_1_free": warning1Count,
		"warning_2_free": warning2Count,
		"suspended_free": suspendedCount,
		"total_free":     activeCount + warning1Count + warning2Count + suspendedCount,
	}
}

func createInAppDormancyNotification(db *gorm.DB, storeID uint, userID uint, title, message, notifType string) {
	if db == nil {
		return
	}
	now := time.Now().UTC()
	exp := now.AddDate(0, 0, 30)

	notif := models.Notification{
		ID:          fmt.Sprintf("dormancy_%d_%d", storeID, now.Unix()),
		TargetType:  "single_store",
		TargetID:    storeID,
		Title:       title,
		Category:    "SISTEM",
		Message:     message,
		Type:        notifType,
		ActionType:  "detail",
		ActionLabel: "Perpanjang Masa Aktif",
		ExpiresAt:   &exp,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	_ = db.Create(&notif).Error
}

func generateSecureToken() string {
	bytes := make([]byte, 32)
	_, _ = rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func extractStorageKeyFromURL(rawURL string) string {
	clean := strings.TrimSpace(rawURL)
	if clean == "" {
		return ""
	}
	// Extract key from path like /uploads/stores/123/product.webp
	if idx := strings.Index(clean, "/uploads/"); idx != -1 {
		return strings.TrimLeft(clean[idx+len("/uploads/"):], "/")
	}
	return strings.TrimLeft(clean, "/")
}

func getAppBaseURL() string {
	envURL := os.Getenv("APP_BASE_URL")
	if envURL != "" {
		return strings.TrimRight(envURL, "/")
	}
	return "http://localhost:8000"
}

func sendDormancyEmail(toEmail, storeTitle, subject string, stage int, daysRemaining int, actionURL string) {
	toEmail = strings.TrimSpace(toEmail)
	if toEmail == "" {
		return
	}

	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := os.Getenv("SMTP_PORT")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASSWORD")
	fromEmail := os.Getenv("SMTP_FROM")
	if fromEmail == "" {
		fromEmail = "no-reply@catavor.com"
	}

	bodyContent := ""
	switch stage {
	case 1:
		bodyContent = fmt.Sprintf(`
Halo Pemilik Toko <strong>%s</strong>,<br><br>
Sistem kami mendeteksi bahwa profil katalog toko Anda belum memiliki aktivitas atau kunjungan dalam <strong>30 hari terakhir</strong>.<br><br>
Untuk menjaga kualitas server dan memastikan katalog Anda tetap aktif di publik, silakan klik tombol di bawah ini untuk <strong>memperpanjang masa aktif gratis</strong> Anda:<br><br>
<div style="text-align: center; margin: 25px 0;">
  <a href="%s" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Perpanjang Masa Aktif (1-Klik)</a>
</div>
Jika tidak ada aktivitas dalam %d hari ke depan, katalog akan dinonaktifkan sementara.<br><br>
Salam hangat,<br>
<strong>Tim Catavor</strong>
`, storeTitle, actionURL, daysRemaining)

	case 2:
		bodyContent = fmt.Sprintf(`
Halo Pemilik Toko <strong>%s</strong>,<br><br>
<strong style="color: #d97706;">⚠️ Peringatan Penting: Tersisa %d Hari!</strong><br><br>
Katalog toko Anda akan dinonaktifkan sementara dalam <strong>%d hari</strong> karena belum ada aktivitas. Semua tautan publik dan WhatsApp checkout akan dijeda.<br><br>
Klik tombol di bawah sekarang untuk mempertahankan katalog dan data produk Anda:<br><br>
<div style="text-align: center; margin: 25px 0;">
  <a href="%s" style="background-color: #d97706; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Pertahankan Toko Saya Sekarang (1-Klik)</a>
</div>
Salam hangat,<br>
<strong>Tim Catavor</strong>
`, storeTitle, daysRemaining, daysRemaining, actionURL)

	case 3:
		bodyContent = fmt.Sprintf(`
Halo Pemilik Toko <strong>%s</strong>,<br><br>
Katalog toko Anda saat ini telah <strong>dinonaktifkan sementara</strong> (mode istirahat) karena tidak ada aktivitas selama 45 hari.<br><br>
<strong style="color: #059669;">Data dan foto produk Anda masih tersimpan aman</strong> selama masa tenggang <strong>%d hari ke depan</strong>.<br><br>
Anda dapat mengaktifkan kembali katalog Anda kapan saja dengan mengklik tautan berikut:<br><br>
<div style="text-align: center; margin: 25px 0;">
  <a href="%s" style="background-color: #059669; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Aktifkan Kembali Katalog Toko</a>
</div>
Jika tidak diaktifkan dalam %d hari, seluruh data dan media akan dibersihkan permanen dari server.<br><br>
Salam hangat,<br>
<strong>Tim Catavor</strong>
`, storeTitle, daysRemaining, actionURL, daysRemaining)

	case 4:
		bodyContent = fmt.Sprintf(`
Halo Pemilik Toko <strong>%s</strong>,<br><br>
Pemberitahuan resmi bahwa akun dan seluruh data katalog toko Anda telah <strong>dihapus secara permanen dari server</strong> karena melewati batas inaktivitas 60 hari.<br><br>
Seluruh kapasitas penyimpanan file gambar dan database telah dibersihkan. Jika di masa mendatang Anda ingin kembali membuka katalog digital, Anda selalu dapat mendaftarkan akun baru di Catavor.<br><br>
Terima kasih telah menggunakan Catavor.<br><br>
Salam hangat,<br>
<strong>Tim Catavor</strong>
`, storeTitle)
	}

	htmlMessage := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; padding: 20px;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px;">
      <h2 style="color: #0f172a; margin: 0; font-size: 20px;">Catavor Notification</h2>
    </div>
    %s
    <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
      Email ini dikirim otomatis oleh sistem Catavor Multi-Channel Commerce Engine.<br>
      © %d Catavor. Hak cipta dilindungi.
    </div>
  </div>
</body>
</html>`, bodyContent, time.Now().Year())

	// If SMTP is configured, send email via SMTP; otherwise log to system console
	if smtpHost != "" && smtpPort != "" {
		go func() {
			addr := fmt.Sprintf("%s:%s", smtpHost, smtpPort)
			mime := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"
			msg := []byte(fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n%s%s", fromEmail, toEmail, subject, mime, htmlMessage))

			var auth smtp.Auth
			if smtpUser != "" && smtpPass != "" {
				auth = smtp.PlainAuth("", smtpUser, smtpPass, smtpHost)
			}
			err := smtp.SendMail(addr, auth, fromEmail, []string{toEmail}, msg)
			if err != nil {
				log.Warn().Err(err).Str("to", toEmail).Msg("Failed to dispatch dormancy email via SMTP")
			} else {
				log.Info().Str("to", toEmail).Str("subject", subject).Msg("Dormancy email successfully dispatched via SMTP")
			}
		}()
	} else {
		log.Info().
			Str("to", toEmail).
			Str("subject", subject).
			Int("stage", stage).
			Msg("SMTP not configured in local environment; simulated dormancy email logged successfully")
	}
}
