package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"
	"catavor-backend/internal/storage"

	"github.com/rs/zerolog/log"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type PendingSubscriptionOrderSummary struct {
	ID            uint       `json:"id"`
	OrderNumber   string     `json:"order_number"`
	PlanCode      string     `json:"plan_code"`
	PlanName      string     `json:"plan_name"`
	FinalAmount   float64    `json:"final_amount"`
	UniqueCode    int        `json:"unique_code"`
	PaymentMethod string     `json:"payment_method"`
	PaymentMode   string     `json:"payment_mode"`
	PaymentStatus string     `json:"payment_status"`
	CreatedAt     time.Time  `json:"created_at"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty"`
}

type StoreQuotaInfo struct {
	StoreID                       uint                             `json:"store_id"`
	StoreSlug                     string                           `json:"store_slug"`
	StoreTitle                    string                           `json:"store_title"`
	Plan                          models.SubscriptionPlan          `json:"plan"`
	NextPlan                      *models.SubscriptionPlan         `json:"next_plan,omitempty"`
	PendingOrder                  *PendingSubscriptionOrderSummary `json:"pending_order,omitempty"`
	PlanStatus                    string                           `json:"plan_status"` // active | grace_period | expired
	PlanExpiresAt       *time.Time               `json:"plan_expires_at,omitempty"`
	GracePeriodUntil    *time.Time               `json:"grace_period_until,omitempty"`
	DaysRemaining       int                      `json:"days_remaining"`
	IsInGracePeriod               bool                     `json:"is_in_grace_period"`
	RemainingCreditAmount         float64                  `json:"remaining_credit_amount"`
	ActiveItemsCount              int64                    `json:"active_items_count"`
	ArchivedItemsCount  int64                    `json:"archived_items_count"`
	TotalItemsCount     int64                    `json:"total_items_count"`
	MaxItems            int                      `json:"max_items"`
	StorageUsedBytes    int64                    `json:"storage_used_bytes"`
	StorageLimitBytes   int64                    `json:"storage_limit_bytes"`
	StorageUsagePercent float64                  `json:"storage_usage_percent"`
	ItemsUsagePercent   float64                  `json:"items_usage_percent"`
	IsStorageOverLimit            bool                     `json:"is_storage_over_limit"`
	IsItemsOverLimit              bool                     `json:"is_items_over_limit"`
	CustomDomain                  *string                  `json:"custom_domain,omitempty"`
	CustomDomainStatus            string                   `json:"custom_domain_status"`
	CustomDomainVerificationToken string                   `json:"custom_domain_verification_token,omitempty"`
	CustomDomainVerifiedAt        *time.Time               `json:"custom_domain_verified_at,omitempty"`
	CustomDomainLastCheckedAt     *time.Time               `json:"custom_domain_last_checked_at,omitempty"`
	CustomDomainError             string                   `json:"custom_domain_error,omitempty"`
	CustomDomainDNSTarget         string                   `json:"custom_domain_dns_target,omitempty"`
	CustomDomainEdgeIP            string                   `json:"custom_domain_edge_ip,omitempty"`
	CustomDomainTXTHost           string                   `json:"custom_domain_txt_host,omitempty"`
	CustomDomainTXTRecordHost     string                   `json:"custom_domain_txt_record_host,omitempty"`
	CustomDomainIsApex            bool                     `json:"custom_domain_is_apex"`
}

// SeedSubscriptionPlans seeds default subscription tiers into the database if not present.
func SeedSubscriptionPlans(db *gorm.DB) error {
	defaultPlans := []models.SubscriptionPlan{
		{
			Code:               "free",
			Name:               "Gratis Terbatas",
			BadgeLabel:         "Merchant",
			Description:        "Katalog digital esensial gratis hingga 15 item (didukung iklan sponsor). Cocok untuk toko pemula & hobi.",
			PriceMonthly:       0,
			PriceAnnual:        0,
			StorageLimitBytes:  100 * 1024 * 1024, // 100 MB (~350-500 foto HD)
			MaxItems:           15,                // 15 items
			MaxImagesPerItem:   10,                // Standard 10 photos
			HasCustomDomain:    false,
			HasVerifiedBadge:   false,
			HasPrioritySearch:  false,
			HasPrioritySupport: false,
			IsActive:           true,
			SortOrder:          1,
		},
		{
			Code:               "pro_starter",
			Name:               "Pro Starter",
			BadgeLabel:         "Pro",
			Description:        "Solusi bisnis berkembang dengan 100% bebas iklan sponsor, kuota 150 item & badge terpercaya.",
			PriceMonthly:       30000,
			PriceAnnual:        300000,
			StorageLimitBytes:  2 * 1024 * 1024 * 1024, // 2 GB (~7.000-10.000 foto HD)
			MaxItems:           150,                    // 150 items
			MaxImagesPerItem:   10,                     // Standard 10 photos
			HasCustomDomain:    false,
			HasVerifiedBadge:   true,
			HasPrioritySearch:  true,
			HasPrioritySupport: false,
			IsActive:           true,
			SortOrder:          2,
		},
		{
			Code:               "pro_business",
			Name:               "Pro Bisnis",
			BadgeLabel:         "Pro VIP",
			Description:        "Kapasitas tanpa batas untuk brand & bisnis besar: 100% bebas iklan sponsor, Custom Domain & VIP Support.",
			PriceMonthly:       129000,
			PriceAnnual:        1290000,
			StorageLimitBytes:  10 * 1024 * 1024 * 1024, // 10 GB (~35.000+ foto HD)
			MaxItems:           -1,                      // Unlimited
			MaxImagesPerItem:   10,                      // Standard 10 photos
			HasCustomDomain:    true,
			HasVerifiedBadge:   true,
			HasPrioritySearch:  true,
			HasPrioritySupport: true,
			IsActive:           true,
			SortOrder:          3,
		},
	}

	for _, p := range defaultPlans {
		var existing models.SubscriptionPlan
		err := db.Where("code = ?", p.Code).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			if err := db.Create(&p).Error; err != nil {
				return err
			}
			log.Info().Str("plan", p.Code).Msg("Seeded subscription plan")
		} else if err == nil {
			// Update schema fields if needed
			existing.Name = p.Name
			existing.Description = p.Description
			existing.SortOrder = p.SortOrder
			existing.PriceMonthly = p.PriceMonthly
			existing.PriceAnnual = p.PriceAnnual
			existing.StorageLimitBytes = p.StorageLimitBytes
			existing.MaxItems = p.MaxItems
			db.Save(&existing)
		}
	}
	return nil
}

// GetSubscriptionPlans returns all active subscription plans ordered by SortOrder.
func GetSubscriptionPlans(db *gorm.DB) ([]models.SubscriptionPlan, error) {
	var plans []models.SubscriptionPlan
	err := db.Where("is_active = ?", true).Order("sort_order asc").Find(&plans).Error
	return plans, err
}

// GetPlanByCode retrieves a specific plan by its code (e.g. 'free', 'pro_starter', 'pro_business').
func GetPlanByCode(db *gorm.DB, code string) (*models.SubscriptionPlan, error) {
	var plan models.SubscriptionPlan
	err := db.Where("code = ?", code).First(&plan).Error
	if err != nil {
		// Fallback to free plan
		if err := db.Where("code = ?", "free").First(&plan).Error; err != nil {
			return nil, err
		}
	}
	return &plan, nil
}

// GetStoreQuotaInfo calculates comprehensive quota usage and plan status for a store with Redis Cache-Aside.
func GetStoreQuotaInfo(db *gorm.DB, storeID uint) (*StoreQuotaInfo, error) {
	if storeID == 0 {
		return nil, fmt.Errorf("invalid store id")
	}

	// 1. Try Redis Cache HIT
	if cachedVal, ok := database.GetStoreQuotaCache(context.Background(), storeID); ok && cachedVal != "" {
		var cachedQuota StoreQuotaInfo
		if err := json.Unmarshal([]byte(cachedVal), &cachedQuota); err == nil {
			if cachedQuota.StorageUsedBytes > 0 {
				return &cachedQuota, nil
			}
		}
	}

	// 2. Cache MISS: query PostgreSQL database
	var store models.Store
	if err := db.First(&store, storeID).Error; err != nil {
		return nil, err
	}

	// Always ensure storage_used_bytes reflects live active files on disk
	store.StorageUsedBytes = SyncStoreStorageUsed(db, storeID)

	planCode := store.Plan
	if planCode == "" {
		planCode = "free"
	}

	plan, err := GetPlanByCode(db, planCode)
	if err != nil {
		return nil, err
	}

	var nextPlan *models.SubscriptionPlan
	if store.NextPlanCode != nil && *store.NextPlanCode != "" {
		if np, err := GetPlanByCode(db, *store.NextPlanCode); err == nil {
			nextPlan = np
		}
	}

	// Count active and archived products
	var activeCount, archivedCount int64
	db.Model(&models.Product{}).Where("store_id = ? AND is_active = ?", storeID, true).Count(&activeCount)
	db.Model(&models.Product{}).Where("store_id = ? AND is_active = false AND (moderation_status IS NULL OR moderation_status NOT IN ('locked', 'hidden', 'banned', 'needs_fix', 'suspended'))", storeID).Count(&archivedCount)

	// Calculate days remaining
	daysRemaining := 0
	isInGrace := false
	now := time.Now().UTC()

	if store.PlanExpiresAt != nil {
		if store.PlanExpiresAt.After(now) {
			daysRemaining = int(time.Until(*store.PlanExpiresAt).Hours() / 24)
			if daysRemaining < 0 {
				daysRemaining = 0
			}
		} else {
			daysRemaining = 0
		}
	}

	if store.PlanStatus == "grace_period" || (store.GracePeriodUntil != nil && store.GracePeriodUntil.After(now) && (store.PlanExpiresAt != nil && store.PlanExpiresAt.Before(now))) {
		isInGrace = true
	}

	// Calculate percentages
	storagePercent := float64(0)
	if plan.StorageLimitBytes > 0 {
		storagePercent = float64(store.StorageUsedBytes) / float64(plan.StorageLimitBytes) * 100.0
		if storagePercent > 100.0 {
			storagePercent = 100.0
		}
	}

	totalCount := activeCount + archivedCount
	itemsPercent := float64(0)
	if plan.MaxItems > 0 {
		itemsPercent = float64(totalCount) / float64(plan.MaxItems) * 100.0
		if itemsPercent > 100.0 {
			itemsPercent = 100.0
		}
	}

	isStorageOver := plan.StorageLimitBytes > 0 && store.StorageUsedBytes > plan.StorageLimitBytes
	isItemsOver := plan.MaxItems > 0 && totalCount >= int64(plan.MaxItems)

	cnameTarget := "cname.catavor.com"
	edgeIP := ""
	if config.AppConfig != nil {
		if t := strings.TrimSpace(config.AppConfig.CustomDomainCNAMETarget); t != "" {
			cnameTarget = t
		}
		edgeIP = strings.TrimSpace(config.AppConfig.CustomDomainEdgeIP)
	}
	var txtHost, txtRecordHost string
	isApex := false
	if store.CustomDomain != nil && strings.TrimSpace(*store.CustomDomain) != "" {
		txtHost = BuildCustomDomainTXTFullHost(*store.CustomDomain)
		txtRecordHost = BuildCustomDomainTXTHost(*store.CustomDomain)
		isApex = IsApexDomain(*store.CustomDomain)
	}

	var pendingSummary *PendingSubscriptionOrderSummary
	if db.Migrator().HasTable(&models.SubscriptionOrder{}) {
		var pendingOrd models.SubscriptionOrder
		if err := db.Where("store_id = ? AND payment_status IN ?", store.ID, []string{"pending", "pending_verification"}).
			Order("created_at DESC, id DESC").First(&pendingOrd).Error; err == nil {
			pendingSummary = &PendingSubscriptionOrderSummary{
				ID:            pendingOrd.ID,
				OrderNumber:   pendingOrd.OrderNumber,
				PlanCode:      pendingOrd.PlanCode,
				PlanName:      resolveFriendlyPlanName(db, pendingOrd.PlanCode),
				FinalAmount:   pendingOrd.FinalAmount,
				UniqueCode:    pendingOrd.UniqueCode,
				PaymentMethod: pendingOrd.PaymentMethod,
				PaymentMode:   pendingOrd.PaymentMode,
				PaymentStatus: pendingOrd.PaymentStatus,
				CreatedAt:     pendingOrd.CreatedAt,
				ExpiresAt:     pendingOrd.ExpiresAt,
			}
		}
	}

	quota := &StoreQuotaInfo{
		StoreID:                       store.ID,
		StoreSlug:                     store.Slug,
		StoreTitle:                    store.StoreTitle,
		Plan:                          *plan,
		NextPlan:                      nextPlan,
		PendingOrder:                  pendingSummary,
		PlanStatus:                    store.PlanStatus,
		PlanExpiresAt:                 store.PlanExpiresAt,
		GracePeriodUntil:              store.GracePeriodUntil,
		DaysRemaining:                 daysRemaining,
		IsInGracePeriod:               isInGrace,
		RemainingCreditAmount:         CalculateRemainingPlanCredit(db, &store, plan, now),
		ActiveItemsCount:              activeCount,
		ArchivedItemsCount:            archivedCount,
		TotalItemsCount:               totalCount,
		MaxItems:                      plan.MaxItems,
		StorageUsedBytes:              store.StorageUsedBytes,
		StorageLimitBytes:             plan.StorageLimitBytes,
		StorageUsagePercent:           storagePercent,
		ItemsUsagePercent:             itemsPercent,
		IsStorageOverLimit:            isStorageOver,
		IsItemsOverLimit:              isItemsOver,
		CustomDomain:                  store.CustomDomain,
		CustomDomainStatus:            store.CustomDomainStatus,
		CustomDomainVerificationToken: store.CustomDomainVerificationToken,
		CustomDomainVerifiedAt:        store.CustomDomainVerifiedAt,
		CustomDomainLastCheckedAt:     store.CustomDomainLastCheckedAt,
		CustomDomainError:             store.CustomDomainError,
		CustomDomainDNSTarget:         cnameTarget,
		CustomDomainEdgeIP:            edgeIP,
		CustomDomainTXTHost:           txtHost,
		CustomDomainTXTRecordHost:     txtRecordHost,
		CustomDomainIsApex:            isApex,
	}

	// Cache in Redis with 10-minute safety TTL
	if bytes, err := json.Marshal(quota); err == nil {
		database.SetStoreQuotaCache(context.Background(), storeID, string(bytes), 10*time.Minute)
	}

	return quota, nil
}

// GetStoreQuotaInfoFresh forces a database query by invalidating the cache first.
func GetStoreQuotaInfoFresh(db *gorm.DB, storeID uint) (*StoreQuotaInfo, error) {
	database.InvalidateStoreQuotaCache(context.Background(), storeID)
	return GetStoreQuotaInfo(db, storeID)
}

// CanAddProduct checks if the store is eligible to add a new product (active or archived).
func CanAddProduct(db *gorm.DB, storeID uint) (bool, string) {
	quota, err := GetStoreQuotaInfo(db, storeID)
	if err != nil {
		return false, "Gagal memverifikasi kuota toko."
	}

	totalItems := quota.ActiveItemsCount + quota.ArchivedItemsCount
	if quota.MaxItems != -1 && totalItems >= int64(quota.MaxItems) {
		return false, fmt.Sprintf("Batas jumlah total produk (termasuk item arsip) untuk paket %s telah tercapai (%d/%d produk). Silakan upgrade paket Anda untuk menambah produk.", quota.Plan.Name, totalItems, quota.MaxItems)
	}

	return true, ""
}

// CanUploadStorage checks if an incoming file upload exceeds the store's storage quota.
func CanUploadStorage(db *gorm.DB, storeID uint, incomingBytes int64) (bool, string) {
	quota, err := GetStoreQuotaInfo(db, storeID)
	if err != nil {
		return false, "Gagal memverifikasi kapasitas storage toko."
	}

	if quota.StorageLimitBytes > 0 && (quota.StorageUsedBytes+incomingBytes) > quota.StorageLimitBytes {
		limitMB := quota.StorageLimitBytes / (1024 * 1024)
		usedMB := quota.StorageUsedBytes / (1024 * 1024)
		return false, fmt.Sprintf("Kapasitas penyimpanan toko Anda telah mencapai batas (%d MB / %d MB). Silakan upgrade paket atau hapus media yang tidak terpakai.", usedMB, limitMB)
	}

	return true, ""
}

// CanEditOrReactivateProduct guards against anti-cheat bypasses on archived products.
func CanEditOrReactivateProduct(db *gorm.DB, storeID uint, productID uint, willBeActive bool) (bool, string) {
	var product models.Product
	if err := db.Where("id = ? AND store_id = ?", productID, storeID).First(&product).Error; err != nil {
		return false, "Produk tidak ditemukan."
	}

	// 1. Compliance Takedown Guard:
	// If product is banned, it is permanently terminated and cannot be edited or activated
	if product.ModerationStatus == "banned" {
		return false, "Produk ini telah diblokir permanen oleh Tim Kepatuhan platform dan tidak dapat diakses atau diedit kembali."
	}
	// If product is locked by platform admin, merchant CANNOT edit or activate it
	if product.ModerationStatus == "locked" {
		return false, "Produk ini dinonaktifkan & dikunci oleh Tim Kepatuhan platform karena pelanggaran kebijakan komoditas. Pengeditan dinonaktifkan."
	}
	// If product is under review, merchant cannot edit until review completes
	if product.ModerationStatus == "in_review" {
		return false, "Produk ini sedang dalam peninjauan ulang oleh Tim Kepatuhan. Mohon tunggu proses verifikasi selesai."
	}
	// If product needs fix, merchant can edit, but CANNOT directly activate it to public
	if (product.ModerationStatus == "needs_fix" || product.ModerationStatus == "hidden") && willBeActive {
		return false, "Produk ini sedang dalam peninjauan kepatuhan. Anda dapat memperbarui data produk, namun tidak dapat langsung mengaktifkannya ke publik secara mandiri sebelum disetujui Tim Kepatuhan."
	}

	// 2. If product was archived and user tries to set it active (or edit it)
	if !product.IsActive && willBeActive {
		quota, err := GetStoreQuotaInfo(db, storeID)
		if err != nil {
			return false, "Gagal memverifikasi kuota produk."
		}

		if quota.MaxItems != -1 && quota.ActiveItemsCount >= int64(quota.MaxItems) {
			return false, fmt.Sprintf("Tidak dapat mengaktifkan produk ini. Kuota produk aktif paket %s Anda sudah penuh (%d/%d). Silakan arsipkan produk lain atau upgrade paket Anda.", quota.Plan.Name, quota.ActiveItemsCount, quota.MaxItems)
		}
	}

	return true, ""
}

// getPlanByCodeStrict memuat paket berdasarkan kode tanpa fallback.
//
// GetPlanByCode sengaja fallback ke paket free agar kuota toko lama tetap bisa
// dihitung. Untuk transaksi (upgrade/downgrade) fallback itu berbahaya: kode
// paket yang salah ketik akan diterima diam-diam dan toko terikat ke kode yang
// tidak ada, sementara kuotanya diam-diam memakai kuota paket free.
func getPlanByCodeStrict(db *gorm.DB, code string) (*models.SubscriptionPlan, error) {
	code = strings.ToLower(strings.TrimSpace(code))
	if code == "" {
		return nil, fmt.Errorf("kode paket langganan kosong")
	}
	var plan models.SubscriptionPlan
	if err := db.Where("code = ?", code).First(&plan).Error; err != nil {
		return nil, fmt.Errorf("paket langganan '%s' tidak ditemukan", code)
	}
	return &plan, nil
}

// UpgradeStorePlan handles instant upgrade or renewal of a store subscription.
func UpgradeStorePlan(db *gorm.DB, storeID uint, targetPlanCode string, durationMonths int) (*StoreQuotaInfo, error) {
	if durationMonths <= 0 {
		durationMonths = 1
	}

	targetPlanCode = strings.ToLower(strings.TrimSpace(targetPlanCode))
	plan, err := getPlanByCodeStrict(db, targetPlanCode)
	if err != nil {
		return nil, err
	}

	var store models.Store
	if err := db.First(&store, storeID).Error; err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	var newExpiresAt time.Time

	if targetPlanCode == "free" {
		store.Plan = "free"
		store.PlanStatus = "active"
		store.PlanExpiresAt = nil
		store.GracePeriodUntil = nil
		store.NextPlanCode = nil
		if store.CustomDomainStatus == "active" {
			store.CustomDomainStatus = "inactive_expired"
		}
	} else {
		if store.Plan == targetPlanCode && store.PlanExpiresAt != nil && store.PlanExpiresAt.After(now) {
			// Renewal: Extend from current expiration date
			newExpiresAt = store.PlanExpiresAt.AddDate(0, durationMonths, 0)
		} else {
			// New upgrade or expired renewal: Start from now
			newExpiresAt = now.AddDate(0, durationMonths, 0)
		}

		store.Plan = targetPlanCode
		store.PlanStatus = "active"
		store.PlanExpiresAt = &newExpiresAt
		store.GracePeriodUntil = nil
		store.NextPlanCode = nil

		if plan.HasCustomDomain && store.CustomDomain != nil && *store.CustomDomain != "" {
			if store.CustomDomainStatus == "inactive_expired" || store.CustomDomainStatus == "none" {
				store.CustomDomainStatus = "active"
			}
		} else if !plan.HasCustomDomain && store.CustomDomainStatus == "active" {
			store.CustomDomainStatus = "inactive_expired"
		}
	}

	if err := db.Save(&store).Error; err != nil {
		return nil, err
	}

	if plan.MaxItems > 0 {
		_ = archiveExcessProducts(db, storeID, plan.MaxItems, now)
	}

	log.Info().
		Uint("store_id", store.ID).
		Str("plan", store.Plan).
		Time("expires_at", newExpiresAt).
		Msg("Store subscription successfully updated")

	database.InvalidateStoreQuotaCache(context.Background(), storeID)
	if store.CustomDomain != nil && strings.TrimSpace(*store.CustomDomain) != "" {
		database.InvalidateCustomDomainCache(context.Background(), *store.CustomDomain)
	}
	GetNotificationHub().UpdateStorePlan(storeID, store.Plan)
	freshQuota, qErr := GetStoreQuotaInfo(db, storeID)
	if qErr == nil && freshQuota != nil {
		GetNotificationHub().BroadcastQuotaEvent(storeID, freshQuota)
	}
	return freshQuota, qErr
}

// ScheduleStoreDowngrade sets a scheduled downgrade for the end of the current billing cycle.
// SECURITY (SEC-01): Penjadwalan perubahan paket HANYA diizinkan dari paket berbayar aktif
// menuju paket dengan SortOrder lebih rendah (mis. pro_business -> pro_starter / free, atau
// pro_starter -> free), atau pembatalan kembali ke paket aktif saat ini.
func ScheduleStoreDowngrade(db *gorm.DB, storeID uint, targetPlanCode string) (*StoreQuotaInfo, error) {
	targetPlanCode = strings.ToLower(strings.TrimSpace(targetPlanCode))
	targetPlan, err := getPlanByCodeStrict(db, targetPlanCode)
	if err != nil {
		return nil, fmt.Errorf("paket target '%s' tidak valid: %w", targetPlanCode, err)
	}

	var store models.Store
	var currentPlan *models.SubscriptionPlan
	var shouldSendEmail bool
	var isCancelling bool

	txErr := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&store, storeID).Error; err != nil {
			return err
		}

		currentCode := strings.ToLower(strings.TrimSpace(store.Plan))
		if currentCode == "" {
			currentCode = "free"
		}

		if targetPlanCode == currentCode {
			isCancelling = true
			if store.NextPlanCode == nil || strings.TrimSpace(*store.NextPlanCode) == "" {
				// Idempotent no-op: tidak ada jadwal downgrade aktif, jangan kirim spam email.
				return nil
			}
			store.NextPlanCode = nil
			shouldSendEmail = true
			cp, _ := GetPlanByCode(tx, currentCode)
			currentPlan = cp
			return tx.Save(&store).Error
		}

		var existingPending models.SubscriptionOrder
		if err := tx.Where("store_id = ? AND payment_status IN ?", storeID, []string{"pending", "pending_verification"}).
			Order("created_at DESC, id DESC").
			First(&existingPending).Error; err == nil {
			return fmt.Errorf("PENDING_ORDER_EXISTS: Tidak dapat menjadwalkan perubahan paket karena tagihan %s masih dalam proses pembayaran atau verifikasi.", existingPending.OrderNumber)
		}

		if currentCode == "free" {
			return fmt.Errorf("toko pada paket Gratis Terbatas tidak dapat menjadwalkan penurunan paket; silakan lakukan upgrade berbayar")
		}

		cp, err := getPlanByCodeStrict(tx, currentCode)
		if err != nil {
			return fmt.Errorf("paket aktif toko '%s' tidak dikenali", currentCode)
		}
		currentPlan = cp

		if targetPlan.SortOrder >= currentPlan.SortOrder {
			return fmt.Errorf("penjadwalan akhir siklus hanya berlaku untuk penurunan paket (downgrade); untuk beralih ke '%s' silakan gunakan jalur upgrade berbayar", targetPlan.Name)
		}

		if store.NextPlanCode != nil && strings.EqualFold(strings.TrimSpace(*store.NextPlanCode), targetPlanCode) {
			// Idempotent no-op: target yang sama sudah terjadwal.
			return nil
		}

		codeCopy := targetPlanCode
		store.NextPlanCode = &codeCopy
		shouldSendEmail = true
		return tx.Save(&store).Error
	})
	if txErr != nil {
		return nil, txErr
	}

	database.InvalidateStoreQuotaCache(context.Background(), storeID)

	if shouldSendEmail {
		var user models.User
		if err := db.First(&user, store.UserID).Error; err == nil && user.Email != "" {
			effectiveDateStr := "akhir periode aktif saat ini"
			if store.PlanExpiresAt != nil {
				effectiveDateStr = store.PlanExpiresAt.Format("02 January 2006")
			}

			nowKey := time.Now().UTC().Format("2006010215")
			if isCancelling {
				currName := store.Plan
				if currentPlan != nil {
					currName = currentPlan.Name
				}
				subj, body := BuildSubscriptionDowngradeCancelledEmail(store.StoreTitle, currName, effectiveDateStr, store.Slug)
				_, _ = EnqueueEmail(user.Email, user.Name, "Catavor Billing", subj, body, "subscription_downgrade_cancelled", fmt.Sprintf("store_%d_cancel_downgrade_%s", store.ID, nowKey))
				DispatchSubscriptionLifecycleInApp(db, store.ID, fmt.Sprintf("notif_sub_cancel_dg_%d_%s", store.ID, nowKey),
					"Jadwal Penurunan Paket Dibatalkan", "LANGGANAN",
					fmt.Sprintf("Perubahan paket dibatalkan. Katalog \"%s\" tetap melanjutkan paket %s sampai %s.", store.StoreTitle, currName, effectiveDateStr),
					fmt.Sprintf("Jadwal perubahan paket telah dibatalkan. Seluruh fitur paket %s tetap aktif hingga %s.", currName, effectiveDateStr),
					"success", "Lihat Paket Langganan ->")
			} else {
				targetPrice := "Gratis"
				if targetPlan.PriceMonthly > 0 {
					targetPrice = fmt.Sprintf("Rp %d / bulan", int64(targetPlan.PriceMonthly))
				}
				subj, body := BuildSubscriptionDowngradeScheduledEmail(store.StoreTitle, targetPlan.Name, targetPrice, effectiveDateStr, store.Slug)
				_, _ = EnqueueEmail(user.Email, user.Name, "Catavor Billing", subj, body, "subscription_downgrade_scheduled", fmt.Sprintf("store_%d_downgrade_%s_%s", store.ID, targetPlanCode, nowKey))
				DispatchSubscriptionLifecycleInApp(db, store.ID, fmt.Sprintf("notif_sub_sched_dg_%d_%s_%s", store.ID, targetPlanCode, nowKey),
					fmt.Sprintf("Jadwal Perubahan ke %s Disimpan", targetPlan.Name), "LANGGANAN",
					fmt.Sprintf("Katalog \"%s\" dijadwalkan beralih ke paket %s pada %s. Fitur saat ini tetap penuh sampai periode berakhir.", store.StoreTitle, targetPlan.Name, effectiveDateStr),
					fmt.Sprintf("Perubahan ke paket %s akan berlaku efektif pada %s. Anda tetap dapat membatalkannya kapan saja sebelum tanggal efektif.", targetPlan.Name, effectiveDateStr),
					"info", "Kelola Jadwal Paket ->")
			}
		}
	}

	return GetStoreQuotaInfo(db, storeID)
}

// ProcessSubscriptionLifecycle handles background expiration, grace periods, auto-downgrades, overage archiving, and H-3 renewal notices.
func ProcessSubscriptionLifecycle(db *gorm.DB) (cycleErr error) {
	defer func() { observeCycle("subscription_lifecycle", time.Hour, 0, cycleErr) }()
	if db == nil {
		return nil
	}
	if err := ProcessExpiredPendingOrders(db); err != nil {
		return err
	}
	now := time.Now().UTC()

	// Preload active subscription plans once to eliminate N+1 queries inside lifecycle loops.
	planMap := make(map[string]models.SubscriptionPlan)
	var allPlans []models.SubscriptionPlan
	if err := db.Find(&allPlans).Error; err == nil {
		for _, p := range allPlans {
			planMap[strings.ToLower(strings.TrimSpace(p.Code))] = p
		}
	}
	freePlan, hasFreePlan := planMap["free"]
	if !hasFreePlan {
		if fp, err := GetPlanByCode(db, "free"); err == nil && fp != nil {
			freePlan = *fp
			hasFreePlan = true
		} else {
			freePlan = models.SubscriptionPlan{
				Code:            "free",
				Name:            "Gratis Terbatas",
				MaxItems:        15,
				HasCustomDomain: false,
			}
		}
	}

	// 1. Advance H-3 Renewal Reminder Scan (3 days before expiration — deduplicated permanently per expiry cycle!)
	h3Threshold := now.Add(72 * time.Hour)
	var expiringStores []models.Store
	if err := db.Where("plan != ? AND plan_status = ? AND plan_expires_at IS NOT NULL AND plan_expires_at > ? AND plan_expires_at <= ?", "free", "active", now, h3Threshold).Find(&expiringStores).Error; err == nil {
		for _, store := range expiringStores {
			if store.PlanExpiresAt == nil {
				continue
			}
			targetPlanCode := strings.ToLower(strings.TrimSpace(store.Plan))
			if store.NextPlanCode != nil && strings.TrimSpace(*store.NextPlanCode) != "" {
				cand := strings.ToLower(strings.TrimSpace(*store.NextPlanCode))
				// Hanya tampilkan NextPlanCode bila valid dan lebih rendah dari paket saat ini.
				currP, okCurr := planMap[targetPlanCode]
				candP, okCand := planMap[cand]
				if okCurr && okCand && candP.SortOrder < currP.SortOrder {
					targetPlanCode = cand
				}
			}

			targetName := targetPlanCode
			targetPrice := "Gratis"
			if tp, ok := planMap[targetPlanCode]; ok {
				targetName = tp.Name
				if tp.PriceMonthly > 0 {
					targetPrice = fmt.Sprintf("Rp %d / bulan", int64(tp.PriceMonthly))
				}
			}

			var user models.User
			if err := db.First(&user, store.UserID).Error; err == nil && user.Email != "" {
				expStr := store.PlanExpiresAt.Format("02 January 2006")
				refID := fmt.Sprintf("store_%d_h3_%s", store.ID, store.PlanExpiresAt.Format("20060102"))
				subj, body := BuildSubscriptionRenewalReminderH3Email(store.StoreTitle, targetName, targetPrice, expStr, store.Slug)
				_, _ = EnqueueLifecycleEmailOnce(db, user.Email, user.Name, "Catavor Billing", subj, body, "subscription_renewal_reminder_h3", refID)
				DispatchSubscriptionLifecycleInApp(db, store.ID, fmt.Sprintf("notif_%s", refID),
					fmt.Sprintf("Pengingat H-3: Paket Berakhir %s", expStr), "LANGGANAN",
					fmt.Sprintf("Masa aktif paket toko \"%s\" berakhir dalam 3 hari (%s). Lanjutkan ke %s (%s) atau biarkan berakhir tanpa auto-debit.", store.StoreTitle, expStr, targetName, targetPrice),
					fmt.Sprintf("Masa aktif paket akan berakhir pada %s. Platform tidak melakukan auto-debit. Silakan selesaikan pembayaran melalui menu Langganan bila ingin melanjutkan.", expStr),
					"warning", "Kelola Perpanjangan ->")
			}
		}
	}

	// 2. Scan expired stores (plan_expires_at <= now)
	var stores []models.Store
	if err := db.Where("plan != ? AND plan_expires_at IS NOT NULL AND plan_expires_at <= ?", "free", now).Find(&stores).Error; err != nil {
		return err
	}

	for _, store := range stores {
		if store.PlanExpiresAt == nil {
			continue
		}
		graceDuration := 7 * 24 * time.Hour

		if store.GracePeriodUntil == nil {
			graceEnd := store.PlanExpiresAt.Add(graceDuration)
			res := db.Model(&models.Store{}).
				Where("id = ? AND plan != ? AND plan_expires_at IS NOT NULL AND plan_expires_at <= ? AND grace_period_until IS NULL",
					store.ID, "free", now).
				Updates(map[string]interface{}{
					"plan_status":        "grace_period",
					"grace_period_until": &graceEnd,
					"updated_at":         now,
				})
			if res.Error != nil || res.RowsAffected == 0 {
				continue
			}
			database.InvalidateStoreQuotaCache(context.Background(), store.ID)
			log.Info().Uint("store_id", store.ID).Time("grace_until", graceEnd).Msg("Store entered subscription grace period")

			var user models.User
			if err := db.First(&user, store.UserID).Error; err == nil && user.Email != "" {
				pName := store.Plan
				if cp, ok := planMap[strings.ToLower(strings.TrimSpace(store.Plan))]; ok {
					pName = cp.Name
				}
				graceStr := graceEnd.Format("02 January 2006")
				subj, body := BuildSubscriptionGracePeriodEmail(store.StoreTitle, pName, graceStr, store.Slug)
				refID := fmt.Sprintf("store_%d_grace_%s", store.ID, graceEnd.Format("20060102"))
				_, _ = EnqueueLifecycleEmailOnce(db, user.Email, user.Name, "Catavor Billing", subj, body, "subscription_grace_period", refID)
				DispatchSubscriptionLifecycleInApp(db, store.ID, fmt.Sprintf("notif_%s", refID),
					"Masa Tenggang Langganan 7 Hari Dimulai", "LANGGANAN",
					fmt.Sprintf("Paket %s toko \"%s\" memasuki masa tenggang hingga %s. Perpanjang sebelum berakhir agar produk tidak diarsipkan.", pName, store.StoreTitle, graceStr),
					fmt.Sprintf("Katalog Anda tetap aktif selama masa tenggang 7 hari (hingga %s). Selesaikan perpanjangan di menu Langganan agar hak akses paket tetap utuh.", graceStr),
					"warning", "Perpanjang Sekarang ->")
			}
			continue
		}

		if store.GracePeriodUntil.After(now) {
			continue
		}

		// SECURITY (SEC-01): Pada sistem prabayar, saat masa tenggang 7 hari habis TANPA
		// pelunasan tagihan perpanjangan, toko WAJIB selalu turun ke paket "free".
		// Dilarang keras mengaktifkan paket berbayar dari NextPlanCode tanpa pembayaran!
		const targetPlanCode = "free"
		targetPlan := freePlan

		archivedCount := 0
		transitionApplied := false
		graceCycleKey := store.GracePeriodUntil.Format("20060102")

		txErr := db.Transaction(func(tx *gorm.DB) error {
			updates := map[string]interface{}{
				"plan":               targetPlanCode,
				"plan_status":        "active",
				"plan_expires_at":    nil,
				"grace_period_until": nil,
				"next_plan_code":     nil,
				"updated_at":         now,
			}
			if !targetPlan.HasCustomDomain && store.CustomDomainStatus == "active" {
				updates["custom_domain_status"] = "inactive_expired"
			}

			res := tx.Model(&models.Store{}).
				Where("id = ? AND plan != ? AND plan_expires_at IS NOT NULL AND plan_expires_at <= ? AND grace_period_until IS NOT NULL AND grace_period_until <= ?",
					store.ID, "free", now, now).
				Updates(updates)
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return nil
			}
			transitionApplied = true

			if targetPlan.MaxItems > 0 {
				var activeProductIDs []uint
				if err := tx.Model(&models.Product{}).
					Where("store_id = ? AND is_active = ?", store.ID, true).
					Order("created_at desc, id desc").
					Pluck("id", &activeProductIDs).Error; err != nil {
					return err
				}

				if len(activeProductIDs) > targetPlan.MaxItems {
					archiveIDs := activeProductIDs[targetPlan.MaxItems:]
					archivedCount = len(archiveIDs)
					if err := tx.Model(&models.Product{}).
						Where("store_id = ? AND id IN ?", store.ID, archiveIDs).
						Updates(map[string]interface{}{
							"is_active":   false,
							"archived_at": now,
						}).Error; err != nil {
						return err
					}
				}
			}
			return nil
		})
		if txErr != nil {
			log.Error().Err(txErr).Uint("store_id", store.ID).Msg("Failed to execute subscription grace-period downgrade transaction")
			continue
		}
		if !transitionApplied {
			continue
		}

		database.InvalidateStoreQuotaCache(context.Background(), store.ID)
		if store.CustomDomain != nil && strings.TrimSpace(*store.CustomDomain) != "" {
			database.InvalidateCustomDomainCache(context.Background(), *store.CustomDomain)
		}
		GetNotificationHub().UpdateStorePlan(store.ID, targetPlanCode)
		log.Info().
			Uint("store_id", store.ID).
			Str("old_plan", store.Plan).
			Str("new_plan", targetPlanCode).
			Int("archived_count", archivedCount).
			Msg("Grace period expired: executed auto-downgrade to free plan")

		var user models.User
		if err := db.First(&user, store.UserID).Error; err == nil && user.Email != "" {
			subj, body := BuildSubscriptionTransitionExecutedEmail(store.StoreTitle, targetPlan.Name, targetPlan.MaxItems, archivedCount, store.Slug)
			refID := fmt.Sprintf("store_%d_transition_%s", store.ID, graceCycleKey)
			_, _ = EnqueueLifecycleEmailOnce(db, user.Email, user.Name, "Catavor Billing", subj, body, "subscription_transition_executed", refID)
			DispatchSubscriptionLifecycleInApp(db, store.ID, fmt.Sprintf("notif_%s", refID),
				fmt.Sprintf("Paket Toko Kini Aktif di %s", targetPlan.Name), "LANGGANAN",
				fmt.Sprintf("Masa tenggang berakhir. Katalog \"%s\" kini beralih ke %s (%d item diarsipkan ke draft agar sesuai kuota).", store.StoreTitle, targetPlan.Name, archivedCount),
				fmt.Sprintf("Profil katalog Anda sekarang menggunakan paket %s. Sebanyak %d produk yang melampaui kuota dipindahkan sementara ke arsip dan tetap aman di database.", targetPlan.Name, archivedCount),
				"info", "Kelola Paket & Arsip ->")
		}
	}

	return nil
}

type CreateOrderRequest struct {
	PlanCode          string `json:"plan_code"`
	BillingCycle      string `json:"billing_cycle"` // monthly | annual
	CouponCode        string `json:"coupon_code"`
	PaymentMethod     string `json:"payment_method"` // bank | qris | coupon_free
	PaymentMode       string `json:"payment_mode"`   // gateway_aulaa | manual_qris | coupon_free
	PaymentProofURL   string `json:"payment_proof_url"`
	Type              string `json:"type"`       // upgrade | renewal
	OrderType         string `json:"order_type"` // alias to prevent frontend contract mismatch
	SenderAccountName string `json:"sender_account_name"`
	SenderPhone       string `json:"sender_phone"`
	RedirectURL       string `json:"redirect_url"`
	Notes             string `json:"notes"`
}

// CalculateRemainingPlanCredit computes unused plan monetary value (rounded to nearest Rp 100)
// for transparent mid-cycle upgrade proration.
func CalculateRemainingPlanCredit(db *gorm.DB, store *models.Store, currentPlan *models.SubscriptionPlan, now time.Time) float64 {
	if store == nil || currentPlan == nil || strings.EqualFold(strings.TrimSpace(store.Plan), "free") {
		return 0
	}
	if !strings.EqualFold(store.PlanStatus, "active") || store.PlanExpiresAt == nil || !store.PlanExpiresAt.After(now) || currentPlan.PriceMonthly <= 0 {
		return 0
	}
	remainingHours := store.PlanExpiresAt.Sub(now).Hours()
	if remainingHours <= 0 {
		return 0
	}
	if remainingHours > 720.0 {
		remainingHours = 720.0
	}
	raw := (remainingHours / 720.0) * currentPlan.PriceMonthly
	credit := math.Round(raw/100.0) * 100.0
	if credit < 0 {
		return 0
	}
	return credit
}

// CalculateUpgradeProrationCredit calculates prorated credit when upgrading from an active paid tier to a higher tier.
func CalculateUpgradeProrationCredit(db *gorm.DB, store *models.Store, targetPlan *models.SubscriptionPlan, now time.Time) float64 {
	if db == nil || store == nil || targetPlan == nil {
		return 0
	}
	currentCode := strings.ToLower(strings.TrimSpace(store.Plan))
	if currentCode == "" || currentCode == "free" {
		return 0
	}
	oldPlan, err := getPlanByCodeStrict(db, currentCode)
	if err != nil || oldPlan == nil || targetPlan.SortOrder <= oldPlan.SortOrder {
		return 0
	}
	credit := CalculateRemainingPlanCredit(db, store, oldPlan, now)
	if credit > targetPlan.PriceMonthly {
		credit = targetPlan.PriceMonthly
	}
	return credit
}

func archiveExcessProducts(db *gorm.DB, storeID uint, maxItems int, now time.Time) error {
	if db == nil || storeID == 0 || maxItems <= 0 {
		return nil
	}
	var activeProductIDs []uint
	if err := db.Model(&models.Product{}).
		Where("store_id = ? AND is_active = ?", storeID, true).
		Order("created_at desc, id desc").
		Pluck("id", &activeProductIDs).Error; err != nil {
		return err
	}
	if len(activeProductIDs) <= maxItems {
		return nil
	}
	archiveIDs := activeProductIDs[maxItems:]
	return db.Model(&models.Product{}).
		Where("store_id = ? AND id IN ?", storeID, archiveIDs).
		Updates(map[string]interface{}{
			"is_active":   false,
			"archived_at": now,
		}).Error
}

// AllocateUniqueNominal generates a non-colliding 3-digit unique code matching uq_sub_orders_active_unique_code.
func AllocateUniqueNominal(db *gorm.DB, baseAmount float64) (int, float64) {
	if db != nil && db.Dialector.Name() == "postgres" {
		_ = db.Exec("SELECT pg_advisory_xact_lock(918273645)").Error
	}
	var usedCodes []int
	if db != nil {
		db.Model(&models.SubscriptionOrder{}).
			Where("payment_status IN ? AND unique_code > 0", []string{"pending", "pending_verification"}).
			Pluck("unique_code", &usedCodes)
	}

	usedMap := make(map[int]bool, len(usedCodes))
	for _, c := range usedCodes {
		usedMap[c] = true
	}

	randOffset := int(time.Now().UnixNano()%999) + 1
	selectedCode := 0
	for i := 0; i < 999; i++ {
		candidate := ((randOffset + i - 1) % 999) + 1
		if !usedMap[candidate] {
			selectedCode = candidate
			break
		}
	}
	if selectedCode == 0 {
		selectedCode = int(time.Now().UnixNano()%999) + 1
	}

	finalAmount := baseAmount + float64(selectedCode)
	return selectedCode, finalAmount
}

// ProcessExpiredPendingOrders expires manual orders that exceeded TTL and releases any reserved coupon quota.
func ProcessExpiredPendingOrders(db *gorm.DB) error {
	if db == nil {
		return nil
	}
	now := time.Now().UTC()
	var expiredOrders []models.SubscriptionOrder
	txErr := db.Transaction(func(tx *gorm.DB) error {
		var expired []models.SubscriptionOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("payment_status = ? AND expires_at IS NOT NULL AND expires_at <= ?", "pending", now).
			Find(&expired).Error; err != nil {
			return err
		}
		for _, ord := range expired {
			if err := tx.Model(&models.SubscriptionOrder{}).Where("id = ?", ord.ID).Updates(map[string]interface{}{
				"payment_status": "expired",
				"updated_at":     now,
			}).Error; err != nil {
				return err
			}
			_ = ReleaseCouponRedemptionInTx(tx, ord.ID, ord.CouponCode)
			ord.PaymentStatus = "expired"
			expiredOrders = append(expiredOrders, ord)
		}
		return nil
	})
	if txErr != nil {
		return txErr
	}
	for i := range expiredOrders {
		ord := expiredOrders[i]
		database.InvalidateStoreQuotaCache(context.Background(), ord.StoreID)
		if freshQuota, err := GetStoreQuotaInfo(db, ord.StoreID); err == nil && freshQuota != nil {
			GetNotificationHub().BroadcastQuotaEvent(ord.StoreID, freshQuota)
		}
		DispatchSubscriptionOrderExpired(db, &ord)
	}
	return nil
}

func resolveOrderPaymentFamily(mode string) string {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "gateway_aulaa":
		return "gateway_aulaa"
	case "manual_qris", "manual_bank":
		return "manual"
	case "maintenance":
		return "maintenance"
	default:
		return "unknown"
	}
}

// CreateSubscriptionOrder handles checkout calculation, mid-cycle proration, relational coupon reservation, invoice creation, and plan activation.
func CreateSubscriptionOrder(db *gorm.DB, storeID uint, userID uint, req CreateOrderRequest) (*models.SubscriptionOrder, *StoreQuotaInfo, error) {
	// Sweep expired pending invoices first so freed unique_codes & coupons are immediately available.
	_ = ProcessExpiredPendingOrders(db)

	// Guard: Single in-flight order per store (block duplicate/spam invoices when pending or pending_verification exists)
	var prePending models.SubscriptionOrder
	if err := db.Where("store_id = ? AND payment_status IN ?", storeID, []string{"pending", "pending_verification"}).
		Order("created_at DESC, id DESC").
		First(&prePending).Error; err == nil {
		if prePending.PaymentStatus == "pending_verification" {
			return nil, nil, fmt.Errorf("PENDING_ORDER_EXISTS: Tagihan %s sedang dalam proses verifikasi Tim Finance. Harap tunggu verifikasi selesai sebelum memilih atau mengubah paket.", prePending.OrderNumber)
		}
		return nil, nil, fmt.Errorf("PENDING_ORDER_EXISTS: Anda masih memiliki tagihan %s yang menunggu pembayaran. Selesaikan atau batalkan tagihan tersebut terlebih dahulu sebelum memilih paket lain.", prePending.OrderNumber)
	}

	// Guard: Check Platform Payment System Mode (gateway_aulaa | manual_qris | manual_bank | maintenance)
	var modeSetting models.Setting
	if err := db.Where("key = ?", "payment_system_mode").First(&modeSetting).Error; err == nil {
		if strings.TrimSpace(strings.ToLower(modeSetting.Value)) == "maintenance" {
			return nil, nil, fmt.Errorf("PAYMENT_GATEWAY_MAINTENANCE: Layanan transaksi pembayaran sedang dalam masa pemeliharaan berkala.")
		}
	}

	planCode := strings.ToLower(strings.TrimSpace(req.PlanCode))
	if planCode == "" {
		planCode = "pro_starter"
	}
	if planCode == "free" {
		return nil, nil, fmt.Errorf("penurunan ke paket Gratis hanya dapat dijadwalkan untuk akhir periode aktif melalui menu jadwal penurunan paket")
	}

	plan, err := getPlanByCodeStrict(db, planCode)
	if err != nil {
		return nil, nil, fmt.Errorf("paket langganan '%s' tidak valid", planCode)
	}

	// SECURITY (SEC-09 & Entitlement Guard): Validasi status toko, jendela perpanjangan H-3, dan arah transisi tier
	orderType := strings.ToLower(strings.TrimSpace(req.Type))
	if orderType == "" {
		orderType = strings.ToLower(strings.TrimSpace(req.OrderType))
	}
	now := time.Now().UTC()
	var currentStore models.Store
	if err := db.First(&currentStore, storeID).Error; err == nil {
		currCode := strings.ToLower(strings.TrimSpace(currentStore.Plan))
		if currCode == "" {
			currCode = "free"
		}
		currPlan, _ := getPlanByCodeStrict(db, currCode)

		if strings.EqualFold(currCode, planCode) {
			orderType = "renewal"
			if currentStore.PlanStatus == "active" && currentStore.PlanExpiresAt != nil {
				renewalWindowStart := currentStore.PlanExpiresAt.Add(-3 * 24 * time.Hour)
				if now.Before(renewalWindowStart) {
					daysRemaining := int(currentStore.PlanExpiresAt.Sub(now).Hours() / 24)
					if daysRemaining < 1 {
						daysRemaining = 1
					}
					return nil, nil, fmt.Errorf("paket langganan Anda masih aktif (%d hari tersisa). Perpanjangan baru dapat dilakukan saat memasuki masa kedaluwarsa (H-3) atau masa tenggang", daysRemaining)
				}
			}
		} else if currCode != "free" && currPlan != nil && plan.SortOrder < currPlan.SortOrder {
			inGrace := strings.EqualFold(currentStore.PlanStatus, "grace_period") ||
				(currentStore.PlanExpiresAt != nil && !currentStore.PlanExpiresAt.After(now))
			inH3Window := currentStore.PlanExpiresAt != nil && !now.Before(currentStore.PlanExpiresAt.Add(-3*24*time.Hour))
			hasMatchingSchedule := currentStore.NextPlanCode != nil && strings.EqualFold(strings.TrimSpace(*currentStore.NextPlanCode), planCode)
			if !(hasMatchingSchedule && (inGrace || inH3Window)) {
				return nil, nil, fmt.Errorf("penurunan paket dari %s ke %s tidak dapat diproses langsung; silakan jadwalkan untuk akhir periode aktif Anda", currPlan.Name, plan.Name)
			}
			orderType = "downgrade_renewal"
		} else if orderType == "" {
			orderType = "upgrade"
		}
	} else if orderType == "" {
		orderType = "upgrade"
	}

	// Strict platform policy: Only monthly billing cycle (1 month) is supported (no annual)
	req.BillingCycle = "monthly"
	durationMonths := 1
	originalAmount := plan.PriceMonthly

	// Mid-cycle upgrade proration credit from remaining active paid plan duration
	prorationCredit := CalculateUpgradeProrationCredit(db, &currentStore, plan, now)
	netAfterProration := originalAmount - prorationCredit
	if netAfterProration < 0 {
		netAfterProration = 0
	}

	// Pre-validate coupon cleanly (legacy master_coupons JSON backfilled into relational coupons): NEVER drop invalid coupon silently!
	var discountAmount float64
	cleanCoupon := strings.ToUpper(strings.TrimSpace(req.CouponCode))
	if cleanCoupon != "" {
		_, disc, _, err := ValidateCouponForStore(db, cleanCoupon, storeID, netAfterProration)
		if err != nil {
			return nil, nil, fmt.Errorf("kupon tidak valid: %w", err)
		}
		discountAmount = disc
	}

	if discountAmount > netAfterProration {
		discountAmount = netAfterProration
	}
	baseFinalAmount := netAfterProration - discountAmount

	orderNumber := fmt.Sprintf("INV-SUB-%s-%04d-%04d", time.Now().Format("20060102150405"), storeID%10000, (time.Now().Nanosecond()/1000)%10000)

	// Server-authoritative payment_mode enforcement (blocks gateway <-> manual tampering)
	serverMode := strings.ToLower(strings.TrimSpace(modeSetting.Value))
	if serverMode == "" {
		serverMode = "gateway_aulaa"
	}
	serverFamily := resolveOrderPaymentFamily(serverMode)
	requestedMode := strings.ToLower(strings.TrimSpace(req.PaymentMode))
	if requestedMode != "" && baseFinalAmount > 0 {
		reqFamily := resolveOrderPaymentFamily(requestedMode)
		if reqFamily == "unknown" || reqFamily != serverFamily {
			return nil, nil, fmt.Errorf("mode pembayaran tidak sesuai dengan konfigurasi platform yang sedang aktif")
		}
	}

	paymentMethod := strings.ToLower(strings.TrimSpace(req.PaymentMethod))
	if paymentMethod == "" {
		if serverMode == "manual_bank" {
			paymentMethod = "bank"
		} else if serverMode == "manual_qris" {
			paymentMethod = "qris"
		} else {
			paymentMethod = "bank"
		}
	}

	paymentMode := serverMode
	if serverFamily == "manual" {
		if paymentMethod != "bank" && paymentMethod != "qris" {
			return nil, nil, fmt.Errorf("metode pembayaran manual harus 'qris' atau 'bank'")
		}
		if paymentMethod == "bank" {
			paymentMode = "manual_bank"
		} else {
			paymentMode = "manual_qris"
		}
	}

	paymentStatus := "pending"
	var paidAt *time.Time = nil
	uniqueCode := 0
	finalAmount := baseFinalAmount
	var expiresAt *time.Time = nil
	var gatewayProvider string
	var gatewayReference string
	var gatewayPaymentLink string
	var gatewayRawResponse datatypes.JSON

	if baseFinalAmount == 0 {
		paymentMethod = "coupon_free"
		paymentMode = "coupon_free"
		paymentStatus = "paid"
		paidAt = &now
		// SECURITY (N-61 Defense-in-Depth): Pesanan gratis/kupon 100% tidak pernah memiliki
		// bukti transfer manual. Kosongkan agar input liar tidak tersimpan dan dibaca GetOrderProof.
		req.PaymentProofURL = ""
	} else if paymentMode == "manual_qris" || paymentMode == "manual_bank" {
		// Strict manual payment integrity (B6): require sender name AND valid uploaded proof
		if strings.TrimSpace(req.SenderAccountName) == "" {
			return nil, nil, fmt.Errorf("nama pengirim / pemilik rekening wajib diisi untuk pembayaran manual")
		}
		if strings.TrimSpace(req.PaymentProofURL) == "" {
			return nil, nil, fmt.Errorf("bukti pembayaran wajib diunggah untuk pembayaran manual")
		}
		cleanedProof, proofErr := security.ValidatePaymentProofURL(req.PaymentProofURL)
		if proofErr != nil {
			return nil, nil, fmt.Errorf("bukti pembayaran tidak valid: %w", proofErr)
		}
		lowerProof := strings.ToLower(cleanedProof)
		subKey := strings.TrimPrefix(lowerProof, "private/")
		if strings.HasPrefix(subKey, "stores/") {
			expectedPrefix := fmt.Sprintf("stores/%d/billing/", storeID)
			if !strings.HasPrefix(subKey, expectedPrefix) {
				return nil, nil, fmt.Errorf("bukti pembayaran tidak valid: berkas bukan milik toko Anda")
			}
		} else if strings.HasPrefix(subKey, "billing/users/") {
			expectedPrefix := fmt.Sprintf("billing/users/%d/", userID)
			if !strings.HasPrefix(subKey, expectedPrefix) {
				return nil, nil, fmt.Errorf("bukti pembayaran tidak valid: berkas bukan milik akun Anda")
			}
		} else if !strings.HasPrefix(lowerProof, "data:image/") {
			return nil, nil, fmt.Errorf("bukti pembayaran tidak valid: namespace penyimpanan tidak memiliki identitas pemilik")
		}
		req.PaymentProofURL = cleanedProof
		paymentStatus = "pending_verification"
		exp := now.Add(2 * time.Hour)
		expiresAt = &exp
	} else if paymentMode == "gateway_aulaa" {
		req.PaymentProofURL = ""
		gatewayProvider = "aulaa"
		aulaaCfg := GetAulaaConfig(db)
		if aulaaCfg.APIKey != "" && !strings.Contains(aulaaCfg.APIKey, "xxxxxxxx") {
			redirectURL := strings.TrimSpace(req.RedirectURL)
			if redirectURL == "" {
				redirectURL = fmt.Sprintf("/admin/subscription?payment=success&order_number=%s", orderNumber)
			} else if parsed, err := url.Parse(redirectURL); err == nil {
				q := parsed.Query()
				if q.Get("payment") == "" {
					q.Set("payment", "success")
				}
				if q.Get("order_number") == "" {
					q.Set("order_number", orderNumber)
				}
				parsed.RawQuery = q.Encode()
				redirectURL = parsed.String()
			} else {
				separator := "?"
				if strings.Contains(redirectURL, "?") {
					separator = "&"
				}
				redirectURL = fmt.Sprintf("%s%spayment=success&order_number=%s", redirectURL, separator, orderNumber)
			}
			aulaaResp, err := CreateAulaaPayment(aulaaCfg, AulaaCreatePaymentRequest{
				OrderID:       orderNumber,
				Amount:        finalAmount,
				RedirectURL:   redirectURL,
				PaymentMethod: paymentMethod,
			})
			if err != nil {
				log.Warn().Err(err).Msg("Aulaa CreatePayment error; proceeding with pending gateway order")
			} else if aulaaResp != nil {
				gatewayReference = aulaaResp.ID
				gatewayPaymentLink = aulaaResp.PaymentLink
				rawB, _ := json.Marshal(aulaaResp)
				gatewayRawResponse = datatypes.JSON(rawB)
			}
		}
	} else {
		req.PaymentProofURL = ""
	}

	notes := strings.TrimSpace(req.Notes)

	order := models.SubscriptionOrder{
		StoreID:               storeID,
		UserID:                userID,
		OrderNumber:           orderNumber,
		Type:                  orderType,
		PlanCode:              planCode,
		BillingCycle:          req.BillingCycle,
		DurationMonths:        durationMonths,
		OriginalAmount:        originalAmount,
		ProrationCreditAmount: prorationCredit,
		DiscountAmount:        discountAmount,
		FinalAmount:           finalAmount,
		CouponCode:            cleanCoupon,
		PaymentMethod:         paymentMethod,
		PaymentMode:           paymentMode,
		UniqueCode:            uniqueCode,
		SenderAccountName:     strings.TrimSpace(req.SenderAccountName),
		SenderPhone:           strings.TrimSpace(req.SenderPhone),
		PaymentProofURL:       req.PaymentProofURL,
		PaymentStatus:         paymentStatus,
		Notes:                 notes,
		GatewayProvider:       gatewayProvider,
		GatewayReference:      gatewayReference,
		GatewayPaymentLink:    gatewayPaymentLink,
		GatewayRawResponse:    gatewayRawResponse,
		ExpiresAt:             expiresAt,
		PaidAt:                paidAt,
	}

	var quota *StoreQuotaInfo
	txErr := db.Transaction(func(tx *gorm.DB) error {
		var lockedStore models.Store
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&lockedStore, storeID).Error; err != nil {
			return err
		}
		var inFlight models.SubscriptionOrder
		if err := tx.Where("store_id = ? AND payment_status IN ?", storeID, []string{"pending", "pending_verification"}).
			Order("created_at DESC, id DESC").
			First(&inFlight).Error; err == nil {
			if inFlight.PaymentStatus == "pending_verification" {
				return fmt.Errorf("PENDING_ORDER_EXISTS: Tagihan %s sedang dalam proses verifikasi Tim Finance. Harap tunggu verifikasi selesai sebelum memilih atau mengubah paket.", inFlight.OrderNumber)
			}
			return fmt.Errorf("PENDING_ORDER_EXISTS: Anda masih memiliki tagihan %s yang menunggu pembayaran. Selesaikan atau batalkan tagihan tersebut terlebih dahulu sebelum memilih paket lain.", inFlight.OrderNumber)
		}

		var redemption *models.CouponRedemption
		if cleanCoupon != "" {
			_, _, _, red, cErr := ValidateAndReserveCouponInTx(tx, cleanCoupon, storeID, userID, nil, netAfterProration)
			if cErr != nil {
				return cErr
			}
			redemption = red
		}
		if baseFinalAmount > 0 && (paymentMode == "manual_bank" || (paymentMode == "manual_qris" && paymentMethod == "bank")) {
			codeAlloc, finAlloc := AllocateUniqueNominal(tx, baseFinalAmount)
			order.UniqueCode = codeAlloc
			order.FinalAmount = finAlloc
		}
		if err := tx.Create(&order).Error; err != nil {
			return err
		}
		if redemption != nil {
			if err := AttachOrderToCouponRedemptionInTx(tx, redemption.ID, order.ID, storeID); err != nil {
				return err
			}
		}
		if baseFinalAmount == 0 {
			var uErr error
			quota, uErr = UpgradeStorePlan(tx, storeID, planCode, durationMonths)
			return uErr
		}
		return nil
	})
	if txErr != nil {
		if strings.Contains(txErr.Error(), "PENDING_ORDER_EXISTS:") {
			return nil, nil, txErr
		}
		return nil, nil, fmt.Errorf("gagal membuat pesanan langganan: %w", txErr)
	}

	if baseFinalAmount > 0 {
		database.InvalidateStoreQuotaCache(context.Background(), storeID)
		quota, _ = GetStoreQuotaInfo(db, storeID)
		if quota != nil {
			GetNotificationHub().BroadcastQuotaEvent(storeID, quota)
		}
		DispatchSubscriptionOrderPending(db, &order)
	} else {
		var expiresAt *time.Time
		if quota != nil {
			expiresAt = quota.PlanExpiresAt
		}
		DispatchSubscriptionOrderActivated(db, &order, plan, expiresAt)
	}
	return &order, quota, nil
}

// reconcileStorePlanAfterOrderRevertInTx ensures reverting a historical paid invoice only rolls back the store
// when no other active paid invoice currently entitles the store to a plan.
func reconcileStorePlanAfterOrderRevertInTx(tx *gorm.DB, storeID uint, revertedOrderID uint) error {
	now := time.Now().UTC()
	var candidates []models.SubscriptionOrder
	if err := tx.Where("store_id = ? AND payment_status = ? AND id <> ? AND plan_code <> ?",
		storeID, "paid", revertedOrderID, "free").
		Order("paid_at DESC, id DESC").Find(&candidates).Error; err == nil {
		for _, cand := range candidates {
			if cand.PaidAt == nil {
				continue
			}
			dur := cand.DurationMonths
			if dur <= 0 {
				dur = 1
			}
			calcExp := cand.PaidAt.AddDate(0, dur, 0)
			if calcExp.After(now) {
				plan, pErr := getPlanByCodeStrict(tx, cand.PlanCode)
				if pErr != nil || plan == nil {
					continue
				}
				var st models.Store
				if err := tx.First(&st, storeID).Error; err != nil {
					return err
				}
				st.Plan = cand.PlanCode
				st.PlanStatus = "active"
				st.PlanExpiresAt = &calcExp
				st.GracePeriodUntil = nil
				st.NextPlanCode = nil
				if !plan.HasCustomDomain && st.CustomDomainStatus == "active" {
					st.CustomDomainStatus = "inactive_expired"
				}
				if err := tx.Save(&st).Error; err != nil {
					return err
				}
				database.InvalidateStoreQuotaCache(context.Background(), storeID)
				if st.CustomDomain != nil && strings.TrimSpace(*st.CustomDomain) != "" {
					database.InvalidateCustomDomainCache(context.Background(), *st.CustomDomain)
				}
				return nil
			}
		}
	}
	_, err := UpgradeStorePlan(tx, storeID, "free", 0)
	return err
}

// RejectSubscriptionOrder marks a subscription invoice as rejected, releases reserved coupon quota,
// and reconciles store tier cleanly without wiping a newer active paid plan.
func RejectSubscriptionOrder(db *gorm.DB, orderID uint, adminID uint, reason string) (*models.SubscriptionOrder, error) {
	var order models.SubscriptionOrder
	cleanReason := strings.TrimSpace(reason)
	if cleanReason == "" {
		cleanReason = "Bukti transfer tidak valid atau dana belum masuk mutasi rekening."
	}

	txErr := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, orderID).Error; err != nil {
			return fmt.Errorf("invoice langganan tidak ditemukan: %w", err)
		}
		wasPaid := order.PaymentStatus == "paid"
		order.PaymentStatus = "rejected"
		order.PaidAt = nil
		order.RejectionReason = cleanReason
		if adminID > 0 {
			order.ApprovedByUserID = &adminID
		}
		if err := tx.Save(&order).Error; err != nil {
			return fmt.Errorf("gagal memperbarui status penolakan invoice: %w", err)
		}
		if err := ReleaseCouponRedemptionInTx(tx, order.ID, order.CouponCode); err != nil {
			return err
		}
		if wasPaid {
			return reconcileStorePlanAfterOrderRevertInTx(tx, order.StoreID, order.ID)
		}
		return nil
	})
	if txErr != nil {
		return nil, txErr
	}

	log.Info().
		Uint("order_id", order.ID).
		Uint("store_id", order.StoreID).
		Uint("rejected_by_admin", adminID).
		Str("reason", cleanReason).
		Msg("Subscription order rejected by finance admin")

	database.InvalidateStoreQuotaCache(context.Background(), order.StoreID)
	if freshQuota, qErr := GetStoreQuotaInfo(db, order.StoreID); qErr == nil && freshQuota != nil {
		GetNotificationHub().BroadcastQuotaEvent(order.StoreID, freshQuota)
	}
	DispatchSubscriptionOrderRejected(db, &order)

	return &order, nil
}

// ResetSubscriptionOrderToPending returns an invoice back to pending verification queue cleanly
// without wiping a newer active paid plan when resetting an older historical invoice.
func ResetSubscriptionOrderToPending(db *gorm.DB, orderID uint, adminID uint) (*models.SubscriptionOrder, error) {
	var order models.SubscriptionOrder
	txErr := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, orderID).Error; err != nil {
			return fmt.Errorf("invoice langganan tidak ditemukan: %w", err)
		}
		wasPaid := order.PaymentStatus == "paid"
		if strings.TrimSpace(order.PaymentProofURL) != "" {
			order.PaymentStatus = "pending_verification"
		} else {
			order.PaymentStatus = "pending"
		}
		order.PaidAt = nil
		order.RejectionReason = ""
		if adminID > 0 {
			order.ApprovedByUserID = &adminID
		}
		if err := tx.Save(&order).Error; err != nil {
			return fmt.Errorf("gagal mengembalikan status invoice ke antrean verifikasi: %w", err)
		}
		if wasPaid {
			return reconcileStorePlanAfterOrderRevertInTx(tx, order.StoreID, order.ID)
		}
		return nil
	})
	if txErr != nil {
		return nil, txErr
	}

	database.InvalidateStoreQuotaCache(context.Background(), order.StoreID)
	if freshQuota, qErr := GetStoreQuotaInfo(db, order.StoreID); qErr == nil && freshQuota != nil {
		GetNotificationHub().BroadcastQuotaEvent(order.StoreID, freshQuota)
	}

	return &order, nil
}

// ApproveSubscriptionOrder confirms payment and activates the subscription plan for an order
// strictly allowing transitions only from pending or pending_verification states.
func ApproveSubscriptionOrder(db *gorm.DB, orderID uint, adminID uint) (*models.SubscriptionOrder, *StoreQuotaInfo, error) {
	if db == nil {
		return nil, nil, errors.New("database connection unavailable")
	}

	var order models.SubscriptionOrder
	var quota *StoreQuotaInfo
	wasAlreadyPaid := false
	now := time.Now().UTC()

	txErr := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, orderID).Error; err != nil {
			return fmt.Errorf("invoice langganan tidak ditemukan: %w", err)
		}

		if order.PaymentStatus == "paid" {
			wasAlreadyPaid = true
			var qErr error
			quota, qErr = GetStoreQuotaInfo(tx, order.StoreID)
			return qErr
		}
		if order.PaymentStatus != "pending" && order.PaymentStatus != "pending_verification" {
			return fmt.Errorf("INVALID_ORDER_STATE: invoice berstatus '%s' tidak dapat disetujui", order.PaymentStatus)
		}

		order.PaymentStatus = "paid"
		order.PaidAt = &now
		if adminID > 0 {
			order.ApprovedByUserID = &adminID
		}

		if err := tx.Save(&order).Error; err != nil {
			return fmt.Errorf("gagal memperbarui status invoice: %w", err)
		}
		_ = CommitCouponRedemptionInTx(tx, order.ID)

		var err error
		quota, err = UpgradeStorePlan(tx, order.StoreID, order.PlanCode, order.DurationMonths)
		if err != nil {
			return fmt.Errorf("gagal mengaktifkan paket langganan: %w", err)
		}
		return nil
	})

	if txErr != nil {
		return nil, nil, txErr
	}

	log.Info().
		Uint("order_id", order.ID).
		Uint("store_id", order.StoreID).
		Str("plan", order.PlanCode).
		Uint("approved_by_admin", adminID).
		Msg("Subscription order approved and store plan activated")

	if !wasAlreadyPaid {
		var activatedPlan *models.SubscriptionPlan
		var expiresAt *time.Time
		if quota != nil {
			activatedPlan = &quota.Plan
			expiresAt = quota.PlanExpiresAt
		}
		DispatchSubscriptionOrderActivated(db, &order, activatedPlan, expiresAt)
	}

	return &order, quota, nil
}

// RestoreArchivedProducts reactivates non-moderated system-archived products up to the current plan limit.
func RestoreArchivedProducts(db *gorm.DB, storeID uint) (int64, *StoreQuotaInfo, error) {
	if db == nil || storeID == 0 {
		return 0, nil, errors.New("database connection unavailable")
	}
	var restored int64
	err := db.Transaction(func(tx *gorm.DB) error {
		quota, qErr := GetStoreQuotaInfo(tx, storeID)
		if qErr != nil {
			return qErr
		}
		var candidateIDs []uint
		q := tx.Model(&models.Product{}).
			Where("store_id = ? AND is_active = ? AND archived_at IS NOT NULL AND (moderation_status IS NULL OR moderation_status NOT IN ('locked','hidden','banned','needs_fix','suspended','in_review'))",
				storeID, false).
			Order("archived_at DESC, id DESC")
		if quota.MaxItems > 0 {
			remainingSlots := int64(quota.MaxItems) - quota.ActiveItemsCount
			if remainingSlots <= 0 {
				return fmt.Errorf("kuota produk aktif paket %s sudah penuh (%d/%d)", quota.Plan.Name, quota.ActiveItemsCount, quota.MaxItems)
			}
			q = q.Limit(int(remainingSlots))
		}
		if err := q.Pluck("id", &candidateIDs).Error; err != nil {
			return err
		}
		if len(candidateIDs) == 0 {
			return nil
		}
		res := tx.Model(&models.Product{}).
			Where("store_id = ? AND id IN ?", storeID, candidateIDs).
			Updates(map[string]interface{}{
				"is_active":   true,
				"archived_at": nil,
				"updated_at":  time.Now().UTC(),
			})
		if res.Error != nil {
			return res.Error
		}
		restored = res.RowsAffected
		return nil
	})
	if err != nil {
		return 0, nil, err
	}
	database.InvalidateStoreQuotaCache(context.Background(), storeID)
	freshQuota, qErr := GetStoreQuotaInfo(db, storeID)
	return restored, freshQuota, qErr
}

// GetStoreSubscriptionOrders returns all subscription invoices / orders for a store.
func GetStoreSubscriptionOrders(db *gorm.DB, storeID uint) ([]models.SubscriptionOrder, error) {
	var orders []models.SubscriptionOrder
	err := db.Where("store_id = ?", storeID).Order("created_at desc").Find(&orders).Error
	return orders, err
}

// CancelPendingSubscriptionOrder allows a merchant to self-cancel an unpaid ('pending') order
// and atomically release any reserved coupon quota or unique code.
// Orders already in 'pending_verification' (proof submitted) are strictly rejected.
func CancelPendingSubscriptionOrder(db *gorm.DB, storeID uint, orderID uint) (*models.SubscriptionOrder, *StoreQuotaInfo, error) {
	if db == nil {
		return nil, nil, errors.New("database connection unavailable")
	}

	var order models.SubscriptionOrder
	txErr := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND store_id = ?", orderID, storeID).
			First(&order).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("ORDER_NOT_FOUND: Tagihan langganan tidak ditemukan.")
			}
			return err
		}

		if order.PaymentStatus == "pending_verification" {
			return fmt.Errorf("CANNOT_CANCEL_VERIFYING: Bukti pembayaran tagihan ini sudah diterima dan sedang diverifikasi Tim Finance sehingga tidak dapat dibatalkan mandiri. Silakan hubungi Admin melalui Pusat Bantuan jika ingin mengajukan perubahan paket.")
		}
		if order.PaymentStatus != "pending" {
			return fmt.Errorf("INVALID_ORDER_STATE: Tagihan dengan status '%s' tidak dapat dibatalkan.", order.PaymentStatus)
		}

		order.PaymentStatus = "cancelled"
		order.RejectionReason = "Dibatalkan oleh pemilik toko sebelum pembayaran diselesaikan."
		if err := tx.Save(&order).Error; err != nil {
			return err
		}
		return ReleaseCouponRedemptionInTx(tx, order.ID, order.CouponCode)
	})
	if txErr != nil {
		return nil, nil, txErr
	}

	database.InvalidateStoreQuotaCache(context.Background(), storeID)
	freshQuota, _ := GetStoreQuotaInfo(db, storeID)
	if freshQuota != nil {
		GetNotificationHub().BroadcastQuotaEvent(storeID, freshQuota)
	}
	return &order, freshQuota, nil
}

// CancelStoreDowngrade removes any scheduled plan downgrade.
func CancelStoreDowngrade(db *gorm.DB, storeID uint) (*StoreQuotaInfo, error) {
	var store models.Store
	var hadScheduledDowngrade bool

	txErr := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&store, storeID).Error; err != nil {
			return err
		}
		if store.NextPlanCode == nil || strings.TrimSpace(*store.NextPlanCode) == "" {
			return nil
		}
		hadScheduledDowngrade = true
		store.NextPlanCode = nil
		return tx.Save(&store).Error
	})
	if txErr != nil {
		return nil, txErr
	}
	if !hadScheduledDowngrade {
		return GetStoreQuotaInfo(db, storeID)
	}

	database.InvalidateStoreQuotaCache(context.Background(), storeID)

	var user models.User
	if err := db.First(&user, store.UserID).Error; err == nil && user.Email != "" {
		currPlan, _ := GetPlanByCode(db, store.Plan)
		currName := store.Plan
		if currPlan != nil {
			currName = currPlan.Name
		}
		effectiveDateStr := "akhir periode aktif"
		if store.PlanExpiresAt != nil {
			effectiveDateStr = store.PlanExpiresAt.Format("02 January 2006")
		}
		subj, body := BuildSubscriptionDowngradeCancelledEmail(store.StoreTitle, currName, effectiveDateStr, store.Slug)
		nowKey := time.Now().UTC().Format("2006010215")
		refKey := fmt.Sprintf("store_%d_cancel_downgrade_%s", store.ID, nowKey)
		_, _ = EnqueueEmail(user.Email, user.Name, "Catavor Billing", subj, body, "subscription_downgrade_cancelled", refKey)
		DispatchSubscriptionLifecycleInApp(db, store.ID, fmt.Sprintf("notif_sub_cancel_dg_%d_%s", store.ID, nowKey),
			"Jadwal Penurunan Paket Dibatalkan", "LANGGANAN",
			fmt.Sprintf("Perubahan paket dibatalkan. Katalog \"%s\" tetap melanjutkan paket %s sampai %s.", store.StoreTitle, currName, effectiveDateStr),
			fmt.Sprintf("Jadwal perubahan paket telah dibatalkan. Seluruh fitur paket %s tetap aktif hingga %s.", currName, effectiveDateStr),
			"success", "Lihat Paket Langganan ->")
	}

	return GetStoreQuotaInfo(db, storeID)
}

// GetStorageRootAbs mengembalikan storage root sebagai path absolut.
// SECURITY (N-03): ResolveInsideRoot membutuhkan root absolut yang sudah
// dinormalisasi agar perbandingan relatif tidak bisa diakali.
func GetStorageRootAbs() (string, bool) {
	root := GetStorageRoot()
	if root == "" {
		return "", false
	}
	abs, err := filepath.Abs(root)
	if err != nil {
		return "", false
	}
	return abs, true
}

// GetStoragePrivateRootAbs mengembalikan direktori absolut untuk object privat
// (namespace key "private/"). Direktori ini sengaja berada di luar pohon yang
// dilayani route statis /storage.
func GetStoragePrivateRootAbs() (string, bool) {
	if config.AppConfig == nil || config.AppConfig.StoragePrivateRoot == "" {
		return "", false
	}
	abs, err := filepath.Abs(config.AppConfig.StoragePrivateRoot)
	if err != nil {
		return "", false
	}
	return abs, true
}

// GetStorageRoot returns the absolute directory for local storage
func GetStorageRoot() string {
	if config.AppConfig != nil && config.AppConfig.StorageLocalRoot != "" {
		if fi, err := os.Stat(config.AppConfig.StorageLocalRoot); err == nil && fi.IsDir() {
			return config.AppConfig.StorageLocalRoot
		}
	}
	candidates := []string{"public/storage", "../public/storage"}
	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && fi.IsDir() {
			abs, err := filepath.Abs(c)
			if err == nil {
				return abs
			}
			return c
		}
	}
	return "public/storage"
}

// ExtractStorageKey extracts the object key from a full URL, relative path, or storage key.
func ExtractStorageKey(rawURL string) string {
	clean := strings.TrimSpace(rawURL)
	if clean == "" {
		return ""
	}
	if strings.Contains(clean, "://") {
		if u, err := url.Parse(clean); err == nil && u.Path != "" {
			clean = u.Path
		}
	}
	clean = strings.TrimLeft(filepath.ToSlash(clean), "/")
	if idx := strings.Index(clean, "storage/"); idx != -1 {
		clean = clean[idx+len("storage/"):]
	} else if idx := strings.Index(clean, "uploads/"); idx != -1 {
		clean = clean[idx+len("uploads/"):]
	}
	clean = strings.TrimLeft(clean, "/")
	if strings.Contains(clean, "..") {
		return ""
	}
	return clean
}

// HardDeleteFile securely deletes a file from cloud object storage (Cloudflare R2 / S3)
// and from local storage (if present), fulfilling Rule 4 & UU PDP Right to Erasure standards.
func HardDeleteFile(rawURL string, strg ...storage.StorageService) (int64, error) {
	if strings.TrimSpace(rawURL) == "" {
		return 0, nil
	}

	cleanKey := ExtractStorageKey(rawURL)
	if cleanKey == "" {
		return 0, nil
	}

	ctx := context.Background()
	var activeStrg storage.StorageService

	if len(strg) > 0 && strg[0] != nil {
		activeStrg = strg[0]
	} else if config.AppConfig != nil {
		if s, err := storage.NewStorageService(config.AppConfig); err == nil {
			activeStrg = s
		}
	}

	// 1. Delete from Cloud Storage (R2 / S3 / MinIO)
	if activeStrg != nil {
		_ = activeStrg.Delete(ctx, cleanKey)
		if !strings.HasPrefix(cleanKey, storage.PrivateKeyPrefix) {
			_ = activeStrg.Delete(ctx, storage.PrivateKeyPrefix+cleanKey)
		}
	}

	// 2. Also remove from local disk if file or gzip twin exists locally (strictly confined inside storage root)
	var freedBytes int64 = 0
	if absRoot, ok := GetStorageRootAbs(); ok {
		relKey := strings.TrimPrefix(cleanKey, storage.PrivateKeyPrefix)
		if diskPath, safe := ResolveInsideRoot(absRoot, relKey); safe {
			if fi, err := os.Stat(diskPath); err == nil && !fi.IsDir() {
				freedBytes = fi.Size()
				_ = os.Remove(diskPath)
			}
			_ = os.Remove(diskPath + ".fiber.gz")
		}
	}

	return freedBytes, nil
}

// HardDeleteLocalStorageFile safely deletes a file across storage backends (backward-compatible alias).
func HardDeleteLocalStorageFile(rawURL string) (int64, error) {
	return HardDeleteFile(rawURL)
}

// SyncStoreStorageUsed audits and calculates the actual disk storage usage of a store,
// while pruning orphaned files in the store's product directory.
func SyncStoreStorageUsed(db *gorm.DB, storeID uint) int64 {
	var totalBytes int64 = 0
	storageRoot := GetStorageRoot()

	normPath := func(p string) string {
		return strings.ToLower(filepath.ToSlash(filepath.Clean(p)))
	}

	// 1. Gather all active referenced file paths for this store
	activeFiles := make(map[string]bool)

	registerURL := func(rawURL string) {
		cleanKey := ExtractStorageKey(rawURL)
		if cleanKey != "" {
			localPath := filepath.Join(storageRoot, filepath.FromSlash(cleanKey))
			activeFiles[normPath(localPath)] = true
		}
	}

	var products []models.Product
	if err := db.Select("id, image_url, video_url, detailed_info").
		Where("store_id = ? AND deleted_at IS NULL AND (moderation_status IS NULL OR moderation_status NOT IN ('locked', 'hidden', 'banned', 'needs_fix', 'suspended'))", storeID).
		Find(&products).Error; err != nil {
		return cachedStorageUsageAfterScanError(db, storeID, err)
	}
	for _, p := range products {
		registerURL(p.ImageURL)
		registerURL(p.VideoURL)

		var prodImages []models.ProductImage
		if err := db.Select("image_url").Where("product_id = ?", p.ID).Find(&prodImages).Error; err != nil {
			return cachedStorageUsageAfterScanError(db, storeID, err)
		}
		for _, pi := range prodImages {
			registerURL(pi.ImageURL)
		}

		if len(p.DetailedInfo) > 0 {
			var dInfo map[string]interface{}
			if err := json.Unmarshal(p.DetailedInfo, &dInfo); err == nil {
				if rawImages, ok := dInfo["images"].([]interface{}); ok {
					for _, itm := range rawImages {
						if str, ok := itm.(string); ok {
							registerURL(str)
						}
					}
				}
			}
		}
	}

	var store models.Store
	if err := db.Select("id, store_logo_url, promo_banner, dormancy_status").First(&store, storeID).Error; err == nil {
		if store.DormancyStatus != "banned" {
			registerURL(store.StoreLogoURL)
			registerURL(store.PromoBanner)
		}
	} else {
		return cachedStorageUsageAfterScanError(db, storeID, err)
	}

	// 1b. Gather files belonging to recently soft-deleted products (72h retention) & moderated violation products (90d retention)
	retainedFiles := make(map[string]bool)
	registerRetainedURL := func(rawURL string) {
		cleanKey := ExtractStorageKey(rawURL)
		if cleanKey != "" {
			localPath := filepath.Join(storageRoot, filepath.FromSlash(cleanKey))
			retainedFiles[normPath(localPath)] = true
		}
	}

	// Protected category: Banned store branding media (logo & banner) retained in evidence vault
	if store.DormancyStatus == "banned" {
		if store.StoreLogoURL != "" {
			registerRetainedURL(store.StoreLogoURL)
		}
		if store.PromoBanner != "" {
			registerRetainedURL(store.PromoBanner)
		}
	}

	// Protected category A: Regular products soft-deleted within 72-hour cooling-off retention
	var softDeletedProducts []models.Product
	if err := db.Unscoped().Select("id, image_url, video_url, detailed_info").
		Where("store_id = ? AND deleted_at IS NOT NULL AND deleted_at > ?", storeID, time.Now().UTC().Add(-72*time.Hour)).
		Find(&softDeletedProducts).Error; err != nil {
		return cachedStorageUsageAfterScanError(db, storeID, err)
	}
	for _, p := range softDeletedProducts {
		registerRetainedURL(p.ImageURL)
		registerRetainedURL(p.VideoURL)

		var prodImages []models.ProductImage
		if err := db.Unscoped().Select("image_url").Where("product_id = ?", p.ID).Find(&prodImages).Error; err != nil {
			return cachedStorageUsageAfterScanError(db, storeID, err)
		}
		for _, pi := range prodImages {
			registerRetainedURL(pi.ImageURL)
		}

		if len(p.DetailedInfo) > 0 {
			var dInfo map[string]interface{}
			if err := json.Unmarshal(p.DetailedInfo, &dInfo); err == nil {
				if rawImages, ok := dInfo["images"].([]interface{}); ok {
					for _, itm := range rawImages {
						if str, ok := itm.(string); ok {
							registerRetainedURL(str)
						}
					}
				}
			}
		}
	}

	// Protected category B: Moderated violation products (locked / hidden / banned / needs_fix / suspended) within 90-day legal evidence retention
	var moderatedProducts []models.Product
	if err := db.Unscoped().Select("id, image_url, video_url, detailed_info").
		Where("store_id = ? AND moderation_status IN ('locked', 'hidden', 'banned', 'needs_fix', 'suspended') AND (moderated_at IS NULL OR moderated_at > ?)", storeID, time.Now().UTC().AddDate(0, 0, -90)).
		Find(&moderatedProducts).Error; err != nil {
		return cachedStorageUsageAfterScanError(db, storeID, err)
	}
	for _, p := range moderatedProducts {
		registerRetainedURL(p.ImageURL)
		registerRetainedURL(p.VideoURL)

		var prodImages []models.ProductImage
		if err := db.Unscoped().Select("image_url").Where("product_id = ?", p.ID).Find(&prodImages).Error; err != nil {
			return cachedStorageUsageAfterScanError(db, storeID, err)
		}
		for _, pi := range prodImages {
			registerRetainedURL(pi.ImageURL)
		}

		if len(p.DetailedInfo) > 0 {
			var dInfo map[string]interface{}
			if err := json.Unmarshal(p.DetailedInfo, &dInfo); err == nil {
				if rawImages, ok := dInfo["images"].([]interface{}); ok {
					for _, itm := range rawImages {
						if str, ok := itm.(string); ok {
							registerRetainedURL(str)
						}
					}
				}
			}
		}
	}

	// 2. Walk physical storage folder for this store: stores/<storeID>
	storeDir := filepath.Join(storageRoot, "stores", fmt.Sprintf("%d", storeID))
	prodDirPrefix := filepath.Join(storageRoot, "stores", fmt.Sprintf("%d", storeID), "products")
	normProdPrefix := normPath(prodDirPrefix)
	if !strings.HasSuffix(normProdPrefix, "/") {
		normProdPrefix += "/"
	}

	if info, err := os.Stat(storeDir); err == nil && info.IsDir() {
		supportPrefix := normPath(filepath.Join(storageRoot, "stores", fmt.Sprintf("%d", storeID), "support"))
		billingPrefix := normPath(filepath.Join(storageRoot, "stores", fmt.Sprintf("%d", storeID), "billing"))
		brandingPrefix := normPath(filepath.Join(storageRoot, "stores", fmt.Sprintf("%d", storeID), "branding"))

		_ = filepath.Walk(storeDir, func(path string, f os.FileInfo, err error) error {
			if err == nil && !f.IsDir() {
				if strings.HasSuffix(f.Name(), ".fiber.gz") {
					return nil
				}

				cleanPath := filepath.Clean(path)
				normClean := normPath(cleanPath)

				// EXCLUDE non-catalog media (support tickets, chat attachments, billing receipts, store branding/logo)
				// Merchant cloud storage quota is STRICTLY for catalog product items!
				if strings.HasPrefix(normClean, supportPrefix) || strings.HasPrefix(normClean, billingPrefix) || strings.HasPrefix(normClean, brandingPrefix) {
					return nil
				}

				// If file is inside store's products directory and not in activeFiles:
				if strings.HasPrefix(normClean, normProdPrefix) && !activeFiles[normClean] {
					// Protect files of soft-deleted products during the 72-hour cooling-off retention period.
					// They are preserved on disk for legal evidence/investigation, but EXCLUDED from active quota totalBytes.
					if retainedFiles[normClean] {
						return nil
					}

					// Protect recently uploaded files (drafts / pending form saves) with a 2-hour grace period
					if time.Since(f.ModTime()) < 2*time.Hour {
						totalBytes += f.Size()
						return nil
					}
					// Only prune abandoned orphans older than 2 hours
					_ = os.Remove(cleanPath)
					_ = os.Remove(cleanPath + ".fiber.gz")
					return nil
				}

				// Kebijakan: HANYA berkas item katalog/produk yang mengurangi kuota penyimpanan toko
				if strings.HasPrefix(normClean, normProdPrefix) {
					totalBytes += f.Size()
				}
			}
			return nil
		})

		// 3. Update DB record only when local storage directory exists
		db.Model(&models.Store{}).Where("id = ?", storeID).UpdateColumn("storage_used_bytes", totalBytes)
		return totalBytes
	}

	// In cloud storage mode (R2/S3) without a local folder mirror, preserve the atomically tracked quota
	var currentStored models.Store
	if err := db.Select("storage_used_bytes").First(&currentStored, storeID).Error; err == nil {
		return currentStored.StorageUsedBytes
	}
	return 0
}

func cachedStorageUsageAfterScanError(db *gorm.DB, storeID uint, err error) int64 {
	log.Warn().Err(err).Uint("store_id", storeID).Msg("Storage scan skipped: media references unavailable")
	var store models.Store
	if db.Select("storage_used_bytes").First(&store, storeID).Error != nil {
		return 0
	}
	return store.StorageUsedBytes
}

// BroadcastStoreQuotaSync calculates fresh StoreQuotaInfo and broadcasts it to connected clients in real-time.
func BroadcastStoreQuotaSync(db *gorm.DB, storeID uint) {
	if storeID == 0 {
		return
	}
	// Invalidate cache first so we get live accurate data
	database.InvalidateStoreQuotaCache(context.Background(), storeID)
	quota, err := GetStoreQuotaInfo(db, storeID)
	if err != nil {
		log.Error().Err(err).Uint("store_id", storeID).Msg("Failed to get fresh store quota for SSE broadcast")
		return
	}
	GetNotificationHub().BroadcastQuotaEvent(storeID, quota)
}
