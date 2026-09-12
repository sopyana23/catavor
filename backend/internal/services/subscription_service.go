package services

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"catavor-backend/internal/models"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

type StoreQuotaInfo struct {
	StoreID             uint                     `json:"store_id"`
	StoreSlug           string                   `json:"store_slug"`
	StoreTitle          string                   `json:"store_title"`
	Plan                models.SubscriptionPlan  `json:"plan"`
	NextPlan            *models.SubscriptionPlan `json:"next_plan,omitempty"`
	PlanStatus          string                   `json:"plan_status"` // active | grace_period | expired
	PlanExpiresAt       *time.Time               `json:"plan_expires_at,omitempty"`
	GracePeriodUntil    *time.Time               `json:"grace_period_until,omitempty"`
	DaysRemaining       int                      `json:"days_remaining"`
	IsInGracePeriod     bool                     `json:"is_in_grace_period"`
	ActiveItemsCount    int64                    `json:"active_items_count"`
	ArchivedItemsCount  int64                    `json:"archived_items_count"`
	MaxItems            int                      `json:"max_items"`
	StorageUsedBytes    int64                    `json:"storage_used_bytes"`
	StorageLimitBytes   int64                    `json:"storage_limit_bytes"`
	StorageUsagePercent float64                  `json:"storage_usage_percent"`
	ItemsUsagePercent   float64                  `json:"items_usage_percent"`
	IsStorageOverLimit  bool                     `json:"is_storage_over_limit"`
	IsItemsOverLimit    bool                     `json:"is_items_over_limit"`
	CustomDomain        *string                  `json:"custom_domain,omitempty"`
	CustomDomainStatus  string                   `json:"custom_domain_status"`
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
			MaxItems:           15,                 // 15 items
			MaxImagesPerItem:   5,                  // Max 5 photos
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
			PriceMonthly:       49000,
			PriceAnnual:        490000,
			StorageLimitBytes:  2 * 1024 * 1024 * 1024, // 2 GB (~7.000-10.000 foto HD)
			MaxItems:           150,                    // 150 items
			MaxImagesPerItem:   8,                      // Max 8 photos
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
			MaxImagesPerItem:   10,                      // Max 10 photos
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

// GetStoreQuotaInfo calculates comprehensive quota usage and plan status for a store.
func GetStoreQuotaInfo(db *gorm.DB, storeID uint) (*StoreQuotaInfo, error) {
	var store models.Store
	if err := db.First(&store, storeID).Error; err != nil {
		return nil, err
	}

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
	db.Model(&models.Product{}).Where("store_id = ? AND is_active = ?", storeID, false).Count(&archivedCount)

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

	itemsPercent := float64(0)
	if plan.MaxItems > 0 {
		itemsPercent = float64(activeCount) / float64(plan.MaxItems) * 100.0
		if itemsPercent > 100.0 {
			itemsPercent = 100.0
		}
	}

	isStorageOver := plan.StorageLimitBytes > 0 && store.StorageUsedBytes > plan.StorageLimitBytes
	isItemsOver := plan.MaxItems > 0 && activeCount >= int64(plan.MaxItems)

	return &StoreQuotaInfo{
		StoreID:             store.ID,
		StoreSlug:           store.Slug,
		StoreTitle:          store.StoreTitle,
		Plan:                *plan,
		NextPlan:            nextPlan,
		PlanStatus:          store.PlanStatus,
		PlanExpiresAt:       store.PlanExpiresAt,
		GracePeriodUntil:    store.GracePeriodUntil,
		DaysRemaining:       daysRemaining,
		IsInGracePeriod:     isInGrace,
		ActiveItemsCount:    activeCount,
		ArchivedItemsCount:  archivedCount,
		MaxItems:            plan.MaxItems,
		StorageUsedBytes:    store.StorageUsedBytes,
		StorageLimitBytes:   plan.StorageLimitBytes,
		StorageUsagePercent: storagePercent,
		ItemsUsagePercent:   itemsPercent,
		IsStorageOverLimit:  isStorageOver,
		IsItemsOverLimit:    isItemsOver,
		CustomDomain:        store.CustomDomain,
		CustomDomainStatus:  store.CustomDomainStatus,
	}, nil
}

// CanAddProduct checks if the store is eligible to add a new active product.
func CanAddProduct(db *gorm.DB, storeID uint) (bool, string) {
	quota, err := GetStoreQuotaInfo(db, storeID)
	if err != nil {
		return false, "Gagal memverifikasi kuota toko."
	}

	if quota.MaxItems != -1 && quota.ActiveItemsCount >= int64(quota.MaxItems) {
		return false, fmt.Sprintf("Batas jumlah produk aktif untuk paket %s telah tercapai (%d/%d produk). Silakan upgrade paket Anda untuk menambah produk.", quota.Plan.Name, quota.ActiveItemsCount, quota.MaxItems)
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

	// If product was archived and user tries to set it active (or edit it)
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

// UpgradeStorePlan handles instant upgrade or renewal of a store subscription.
func UpgradeStorePlan(db *gorm.DB, storeID uint, targetPlanCode string, durationMonths int) (*StoreQuotaInfo, error) {
	if durationMonths <= 0 {
		durationMonths = 1
	}

	plan, err := GetPlanByCode(db, targetPlanCode)
	if err != nil {
		return nil, fmt.Errorf("paket langganan '%s' tidak ditemukan", targetPlanCode)
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
		}
	}

	if err := db.Save(&store).Error; err != nil {
		return nil, err
	}

	log.Info().
		Uint("store_id", store.ID).
		Str("plan", store.Plan).
		Time("expires_at", newExpiresAt).
		Msg("Store subscription successfully updated")

	return GetStoreQuotaInfo(db, storeID)
}

// ScheduleStoreDowngrade sets a scheduled downgrade for the end of the current billing cycle.
func ScheduleStoreDowngrade(db *gorm.DB, storeID uint, targetPlanCode string) (*StoreQuotaInfo, error) {
	_, err := GetPlanByCode(db, targetPlanCode)
	if err != nil {
		return nil, fmt.Errorf("paket target '%s' tidak valid", targetPlanCode)
	}

	var store models.Store
	if err := db.First(&store, storeID).Error; err != nil {
		return nil, err
	}

	if targetPlanCode == store.Plan {
		// Cancel scheduled change
		store.NextPlanCode = nil
	} else {
		store.NextPlanCode = &targetPlanCode
	}

	if err := db.Save(&store).Error; err != nil {
		return nil, err
	}

	return GetStoreQuotaInfo(db, storeID)
}

// ProcessSubscriptionLifecycle handles background expiration, grace periods, auto-downgrades, and overage archiving.
func ProcessSubscriptionLifecycle(db *gorm.DB) error {
	now := time.Now().UTC()

	var stores []models.Store
	// Find all non-free stores or stores with expiration set
	if err := db.Where("plan != ? AND plan_expires_at IS NOT NULL AND plan_expires_at <= ?", "free", now).Find(&stores).Error; err != nil {
		return err
	}

	for _, store := range stores {
		// Step 1: Check if grace period is needed or active
		graceDuration := 7 * 24 * time.Hour // 7 days grace period

		if store.GracePeriodUntil == nil {
			// Just expired: enter grace period
			graceEnd := store.PlanExpiresAt.Add(graceDuration)
			store.PlanStatus = "grace_period"
			store.GracePeriodUntil = &graceEnd
			db.Save(&store)
			log.Info().Uint("store_id", store.ID).Time("grace_until", graceEnd).Msg("Store entered subscription grace period")
			continue
		}

		if store.GracePeriodUntil.After(now) {
			// Still in grace period, maintain access
			continue
		}

		// Step 2: Grace period exceeded without renewal -> Execute Downgrade
		targetPlanCode := "free"
		if store.NextPlanCode != nil && *store.NextPlanCode != "" {
			targetPlanCode = *store.NextPlanCode
		}

		targetPlan, err := GetPlanByCode(db, targetPlanCode)
		if err != nil {
			targetPlan, _ = GetPlanByCode(db, "free")
			targetPlanCode = "free"
		}

		log.Info().
			Uint("store_id", store.ID).
			Str("old_plan", store.Plan).
			Str("new_plan", targetPlanCode).
			Msg("Grace period expired: executing auto-downgrade")

		store.Plan = targetPlanCode
		store.PlanStatus = "active"
		store.PlanExpiresAt = nil
		store.GracePeriodUntil = nil
		store.NextPlanCode = nil

		// Disable custom domain if target plan does not support it
		if !targetPlan.HasCustomDomain && store.CustomDomainStatus == "active" {
			store.CustomDomainStatus = "inactive_expired"
		}

		db.Save(&store)

		// Step 3: Auto-Archive Products exceeding new plan quota
		if targetPlan.MaxItems > 0 {
			var activeProducts []models.Product
			db.Where("store_id = ? AND is_active = ?", store.ID, true).
				Order("created_at desc").
				Find(&activeProducts)

			if len(activeProducts) > targetPlan.MaxItems {
				// Keep newest targetPlan.MaxItems active, archive the rest
				toArchive := activeProducts[targetPlan.MaxItems:]
				archivedTime := now
				for _, p := range toArchive {
					db.Model(&models.Product{}).Where("id = ?", p.ID).Updates(map[string]interface{}{
						"is_active":   false,
						"archived_at": archivedTime,
					})
				}
				log.Info().
					Uint("store_id", store.ID).
					Int("archived_count", len(toArchive)).
					Msg("Auto-archived over-quota products after downgrade")
			}
		}
	}

	return nil
}

type CreateOrderRequest struct {
	PlanCode        string `json:"plan_code"`
	BillingCycle    string `json:"billing_cycle"` // monthly | annual
	CouponCode      string `json:"coupon_code"`
	PaymentMethod   string `json:"payment_method"` // bank | qris | coupon_free
	PaymentProofURL string `json:"payment_proof_url"`
	Type            string `json:"type"` // upgrade | renewal
}

// CreateSubscriptionOrder handles checkout calculation, coupon discount, invoice creation, and plan activation.
func CreateSubscriptionOrder(db *gorm.DB, storeID uint, userID uint, req CreateOrderRequest) (*models.SubscriptionOrder, *StoreQuotaInfo, error) {
	planCode := strings.ToLower(strings.TrimSpace(req.PlanCode))
	if planCode == "" {
		planCode = "pro_starter"
	}

	plan, err := GetPlanByCode(db, planCode)
	if err != nil {
		return nil, nil, fmt.Errorf("paket langganan '%s' tidak valid", planCode)
	}

	durationMonths := 1
	var originalAmount float64
	if req.BillingCycle == "annual" {
		durationMonths = 12
		originalAmount = plan.PriceAnnual
		if originalAmount <= 0 {
			originalAmount = plan.PriceMonthly * 10 // 2 months free discount default
		}
	} else {
		req.BillingCycle = "monthly"
		durationMonths = 1
		originalAmount = plan.PriceMonthly
	}

	// Calculate Coupon Discount
	var discountAmount float64
	cleanCoupon := strings.ToUpper(strings.TrimSpace(req.CouponCode))
	if cleanCoupon != "" {
		// Built-in standard coupons
		if cleanCoupon == "CATAVOR100" || cleanCoupon == "GRATISPRO" {
			discountAmount = originalAmount
		} else if cleanCoupon == "DISKON10K" {
			discountAmount = 10000
		} else if cleanCoupon == "DISKON50K" {
			discountAmount = 50000
		} else {
			// Check database settings for custom coupons
			var couponSetting models.Setting
			if err := db.Where("key = ?", "master_coupons").First(&couponSetting).Error; err == nil && couponSetting.Value != "" {
				var coupons []struct {
					Code     string  `json:"code"`
					Type     string  `json:"type"`
					Discount float64 `json:"discount"`
				}
				if err := json.Unmarshal([]byte(couponSetting.Value), &coupons); err == nil {
					for _, c := range coupons {
						if strings.ToUpper(c.Code) == cleanCoupon {
							if c.Type == "free" {
								discountAmount = originalAmount
							} else {
								discountAmount = c.Discount
							}
							break
						}
					}
				}
			}
		}
	}

	if discountAmount > originalAmount {
		discountAmount = originalAmount
	}
	finalAmount := originalAmount - discountAmount

	orderNumber := fmt.Sprintf("INV-SUB-%s-%04d-%04d", time.Now().Format("20060102150405"), storeID%10000, (time.Now().Nanosecond()/1000)%10000)

	paymentMethod := strings.ToLower(strings.TrimSpace(req.PaymentMethod))
	if paymentMethod == "" {
		paymentMethod = "bank"
	}
	if finalAmount == 0 {
		paymentMethod = "coupon_free"
	}

	paymentStatus := "paid"
	now := time.Now().UTC()
	var paidAt *time.Time = &now

	orderType := req.Type
	if orderType == "" {
		var store models.Store
		if err := db.First(&store, storeID).Error; err == nil {
			if store.Plan == planCode {
				orderType = "renewal"
			} else {
				orderType = "upgrade"
			}
		} else {
			orderType = "upgrade"
		}
	}

	order := models.SubscriptionOrder{
		StoreID:         storeID,
		UserID:          userID,
		OrderNumber:     orderNumber,
		Type:            orderType,
		PlanCode:        planCode,
		BillingCycle:    req.BillingCycle,
		DurationMonths:  durationMonths,
		OriginalAmount:  originalAmount,
		DiscountAmount:  discountAmount,
		FinalAmount:     finalAmount,
		CouponCode:      cleanCoupon,
		PaymentMethod:   paymentMethod,
		PaymentProofURL: req.PaymentProofURL,
		PaymentStatus:   paymentStatus,
		PaidAt:          paidAt,
	}

	if err := db.Create(&order).Error; err != nil {
		return nil, nil, fmt.Errorf("gagal membuat invoice langganan: %w", err)
	}

	// Instantly execute Upgrade / Renewal
	quota, err := UpgradeStorePlan(db, storeID, planCode, durationMonths)
	if err != nil {
		return nil, nil, fmt.Errorf("gagal mengaktifkan paket: %w", err)
	}

	return &order, quota, nil
}

// GetStoreSubscriptionOrders returns all subscription invoices / orders for a store.
func GetStoreSubscriptionOrders(db *gorm.DB, storeID uint) ([]models.SubscriptionOrder, error) {
	var orders []models.SubscriptionOrder
	err := db.Where("store_id = ?", storeID).Order("created_at desc").Find(&orders).Error
	return orders, err
}

// CancelStoreDowngrade removes any scheduled plan downgrade.
func CancelStoreDowngrade(db *gorm.DB, storeID uint) (*StoreQuotaInfo, error) {
	var store models.Store
	if err := db.First(&store, storeID).Error; err != nil {
		return nil, err
	}

	store.NextPlanCode = nil
	if err := db.Save(&store).Error; err != nil {
		return nil, err
	}

	return GetStoreQuotaInfo(db, storeID)
}
