package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"catavor-backend/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// MasterCoupon represents the API/DTO payload for platform subscription coupons.
type MasterCoupon struct {
	ID              string     `json:"id"`
	Code            string     `json:"code"`
	Label           string     `json:"label"`
	Type            string     `json:"type"` // "free" (100% free) | "discount" (nominal rupiah)
	Discount        float64    `json:"discount"`
	UsageLimit      int        `json:"usage_limit"`        // 0 = unlimited global
	UsedCount       int        `json:"used_count"`
	MaxUsesPerStore int        `json:"max_uses_per_store"` // 0 = unlimited per store
	IsActive        bool       `json:"is_active"`
	ExpiresAt       *time.Time `json:"expires_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// CouponUpdatePatch holds pointer fields so explicit false or zero values are honored on update.
type CouponUpdatePatch struct {
	Label           *string    `json:"label"`
	Type            *string    `json:"type"`
	Discount        *float64   `json:"discount"`
	UsageLimit      *int       `json:"usage_limit"`
	MaxUsesPerStore *int       `json:"max_uses_per_store"`
	IsActive        *bool      `json:"is_active"`
	ExpiresAt       *time.Time `json:"expires_at"`
	ClearExpiry     bool       `json:"clear_expiry"`
}

// GetDefaultCoupons returns initial seed coupons. By platform security standard,
// no free backdoor coupons are seeded by default; all promotions must be explicitly created by Admin.
func GetDefaultCoupons() []MasterCoupon {
	return []MasterCoupon{}
}

func couponModelToDTO(c models.Coupon) MasterCoupon {
	return MasterCoupon{
		ID:              fmt.Sprintf("cpn_%d", c.ID),
		Code:            strings.ToUpper(strings.TrimSpace(c.Code)),
		Label:           c.Label,
		Type:            c.Type,
		Discount:        c.Discount,
		UsageLimit:      c.UsageLimit,
		UsedCount:       c.UsedCount,
		MaxUsesPerStore: c.MaxUsesPerStore,
		IsActive:        c.IsActive,
		ExpiresAt:       c.ExpiresAt,
		CreatedAt:       c.CreatedAt,
		UpdatedAt:       c.UpdatedAt,
	}
}

func ensureCouponTablesAndSyncLegacy(db *gorm.DB) error {
	if db == nil {
		return errors.New("database connection unavailable")
	}
	if !db.Migrator().HasTable(&models.Coupon{}) {
		if err := db.AutoMigrate(&models.Coupon{}, &models.CouponRedemption{}); err != nil {
			return err
		}
	}
	return syncLegacyMasterCouponsSetting(db)
}

// syncLegacyMasterCouponsSetting migrates any pending JSON coupons stored in settings.master_coupons
// into relational coupons rows (handles pre-migration prod data and legacy unit test fixtures).
func syncLegacyMasterCouponsSetting(db *gorm.DB) error {
	if db == nil || !db.Migrator().HasTable(&models.Setting{}) {
		return nil
	}
	var setting models.Setting
	if err := db.Where("key = ?", "master_coupons").First(&setting).Error; err != nil {
		return nil
	}
	raw := strings.TrimSpace(setting.Value)
	if raw == "" || raw == "[]" || raw == "null" {
		return nil
	}
	var legacy []MasterCoupon
	if err := json.Unmarshal([]byte(raw), &legacy); err != nil || len(legacy) == 0 {
		return nil
	}
	now := time.Now().UTC()
	for _, item := range legacy {
		code := strings.ToUpper(strings.TrimSpace(item.Code))
		if code == "" {
			continue
		}
		typ := strings.ToLower(strings.TrimSpace(item.Type))
		if typ != "free" {
			typ = "discount"
		}
		disc := item.Discount
		if disc < 0 {
			disc = 0
		}
		limit := item.UsageLimit
		if limit < 0 {
			limit = 0
		}
		used := item.UsedCount
		if used < 0 {
			used = 0
		}
		perStore := item.MaxUsesPerStore
		if perStore < 0 {
			perStore = 1
		}
		label := strings.TrimSpace(item.Label)
		if label == "" {
			label = fmt.Sprintf("Kupon %s", code)
		}
		var existing models.Coupon
		err := db.Where("UPPER(code) = ?", code).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			rec := models.Coupon{
				Code:            code,
				Label:           label,
				Type:            typ,
				Discount:        disc,
				UsageLimit:      limit,
				UsedCount:       used,
				MaxUsesPerStore: perStore,
				IsActive:        item.IsActive,
				ExpiresAt:       item.ExpiresAt,
				CreatedAt:       now,
				UpdatedAt:       now,
			}
			_ = db.Create(&rec).Error
		}
	}
	_ = db.Model(&models.Setting{}).Where("key = ?", "master_coupons").Updates(map[string]interface{}{
		"value":      "[]",
		"updated_at": now,
	}).Error
	return nil
}

// GetMasterCoupons retrieves all coupons ordered newest first from relational storage.
func GetMasterCoupons(db *gorm.DB) ([]MasterCoupon, error) {
	if db == nil {
		return []MasterCoupon{}, nil
	}
	if err := ensureCouponTablesAndSyncLegacy(db); err != nil {
		return []MasterCoupon{}, err
	}

	var rows []models.Coupon
	if err := db.Order("created_at DESC, id DESC").Find(&rows).Error; err != nil {
		return []MasterCoupon{}, err
	}
	out := make([]MasterCoupon, 0, len(rows))
	for _, r := range rows {
		out = append(out, couponModelToDTO(r))
	}
	return out, nil
}

// SaveMasterCoupons replaces or upserts a slice of coupons in relational storage atomically.
// Kept primarily for fixture compatibility; admin handlers use Create/Update/Delete/Toggle directly.
func SaveMasterCoupons(db *gorm.DB, coupons []MasterCoupon) error {
	if db == nil {
		return errors.New("database connection unavailable")
	}
	if err := ensureCouponTablesAndSyncLegacy(db); err != nil {
		return err
	}
	return db.Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		seen := make(map[string]struct{}, len(coupons))
		for _, item := range coupons {
			code := strings.ToUpper(strings.TrimSpace(item.Code))
			if code == "" {
				continue
			}
			seen[code] = struct{}{}
			typ := strings.ToLower(strings.TrimSpace(item.Type))
			if typ != "free" {
				typ = "discount"
			}
			label := strings.TrimSpace(item.Label)
			if label == "" {
				label = fmt.Sprintf("Kupon %s", code)
			}
			perStore := item.MaxUsesPerStore
			if perStore < 0 {
				perStore = 1
			}
			var existing models.Coupon
			err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("UPPER(code) = ?", code).First(&existing).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				row := models.Coupon{
					Code:            code,
					Label:           label,
					Type:            typ,
					Discount:        maxFloatZero(item.Discount),
					UsageLimit:      maxIntZero(item.UsageLimit),
					UsedCount:       maxIntZero(item.UsedCount),
					MaxUsesPerStore: perStore,
					IsActive:        item.IsActive,
					ExpiresAt:       item.ExpiresAt,
					CreatedAt:       now,
					UpdatedAt:       now,
				}
				if err := tx.Create(&row).Error; err != nil {
					return err
				}
			} else if err != nil {
				return err
			} else {
				existing.Label = label
				existing.Type = typ
				existing.Discount = maxFloatZero(item.Discount)
				existing.UsageLimit = maxIntZero(item.UsageLimit)
				existing.UsedCount = maxIntZero(item.UsedCount)
				existing.MaxUsesPerStore = perStore
				existing.IsActive = item.IsActive
				existing.ExpiresAt = item.ExpiresAt
				existing.UpdatedAt = now
				if err := tx.Save(&existing).Error; err != nil {
					return err
				}
			}
		}
		var allRows []models.Coupon
		if err := tx.Find(&allRows).Error; err != nil {
			return err
		}
		for _, r := range allRows {
			if _, ok := seen[strings.ToUpper(strings.TrimSpace(r.Code))]; !ok {
				if err := tx.Delete(&models.Coupon{}, r.ID).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}

func maxIntZero(v int) int {
	if v < 0 {
		return 0
	}
	return v
}

func maxFloatZero(v float64) float64 {
	if v < 0 {
		return 0
	}
	return v
}

// CreateCoupon inserts a single validated coupon inside a transaction.
func CreateCoupon(db *gorm.DB, input MasterCoupon) (*MasterCoupon, error) {
	if err := ensureCouponTablesAndSyncLegacy(db); err != nil {
		return nil, err
	}
	code := strings.ToUpper(strings.TrimSpace(input.Code))
	now := time.Now().UTC()
	perStore := input.MaxUsesPerStore
	if perStore < 0 {
		perStore = 1
	}
	var created models.Coupon
	err := db.Transaction(func(tx *gorm.DB) error {
		var existing models.Coupon
		if err := tx.Where("UPPER(code) = ?", code).First(&existing).Error; err == nil {
			return fmt.Errorf("CONFLICT:kode kupon \"%s\" sudah terdaftar", code)
		}
		disc := input.Discount
		if input.Type == "free" {
			disc = 0
		}
		created = models.Coupon{
			Code:            code,
			Label:           strings.TrimSpace(input.Label),
			Type:            input.Type,
			Discount:        disc,
			UsageLimit:      input.UsageLimit,
			UsedCount:       0,
			MaxUsesPerStore: perStore,
			IsActive:        input.IsActive,
			ExpiresAt:       input.ExpiresAt,
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		return tx.Create(&created).Error
	})
	if err != nil {
		return nil, err
	}
	dto := couponModelToDTO(created)
	return &dto, nil
}

// UpdateCoupon modifies an existing coupon under row lock without silently ignoring explicit 0 / false fields.
func UpdateCoupon(db *gorm.DB, code string, patch CouponUpdatePatch) (*MasterCoupon, error) {
	if err := ensureCouponTablesAndSyncLegacy(db); err != nil {
		return nil, err
	}
	clean := strings.ToUpper(strings.TrimSpace(code))
	var updated models.Coupon
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("UPPER(code) = ?", clean).First(&updated).Error; err != nil {
			return err
		}
		if patch.Label != nil && strings.TrimSpace(*patch.Label) != "" {
			updated.Label = strings.TrimSpace(*patch.Label)
		}
		if patch.Type != nil {
			typ := strings.ToLower(strings.TrimSpace(*patch.Type))
			if typ == "free" || typ == "discount" {
				updated.Type = typ
			}
		}
		if patch.Discount != nil {
			if *patch.Discount < 0 {
				return errors.New("VALIDATION:nominal diskon tidak boleh negatif")
			}
			updated.Discount = *patch.Discount
		}
		if updated.Type == "free" {
			updated.Discount = 0
		} else if updated.Discount <= 0 {
			return errors.New("VALIDATION:nominal potongan diskon harus lebih besar dari Rp 0")
		}
		if patch.UsageLimit != nil {
			if *patch.UsageLimit < 0 {
				return errors.New("VALIDATION:batas kuota penggunaan tidak boleh negatif")
			}
			updated.UsageLimit = *patch.UsageLimit
		}
		if patch.MaxUsesPerStore != nil {
			if *patch.MaxUsesPerStore < 0 {
				return errors.New("VALIDATION:batas pemakaian per toko tidak boleh negatif")
			}
			updated.MaxUsesPerStore = *patch.MaxUsesPerStore
		}
		if patch.IsActive != nil {
			updated.IsActive = *patch.IsActive
		}
		if patch.ClearExpiry {
			updated.ExpiresAt = nil
		} else if patch.ExpiresAt != nil {
			updated.ExpiresAt = patch.ExpiresAt
		}
		updated.UpdatedAt = time.Now().UTC()
		return tx.Save(&updated).Error
	})
	if err != nil {
		return nil, err
	}
	dto := couponModelToDTO(updated)
	return &dto, nil
}

// DeleteCoupon deletes a coupon by code under row lock.
func DeleteCoupon(db *gorm.DB, code string) (*MasterCoupon, error) {
	if err := ensureCouponTablesAndSyncLegacy(db); err != nil {
		return nil, err
	}
	clean := strings.ToUpper(strings.TrimSpace(code))
	var deleted models.Coupon
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("UPPER(code) = ?", clean).First(&deleted).Error; err != nil {
			return err
		}
		return tx.Delete(&deleted).Error
	})
	if err != nil {
		return nil, err
	}
	dto := couponModelToDTO(deleted)
	return &dto, nil
}

// ToggleCoupon flips IsActive atomically for a coupon code.
func ToggleCoupon(db *gorm.DB, code string) (*MasterCoupon, error) {
	if err := ensureCouponTablesAndSyncLegacy(db); err != nil {
		return nil, err
	}
	clean := strings.ToUpper(strings.TrimSpace(code))
	var toggled models.Coupon
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("UPPER(code) = ?", clean).First(&toggled).Error; err != nil {
			return err
		}
		toggled.IsActive = !toggled.IsActive
		toggled.UpdatedAt = time.Now().UTC()
		return tx.Save(&toggled).Error
	})
	if err != nil {
		return nil, err
	}
	dto := couponModelToDTO(toggled)
	return &dto, nil
}

func computeCouponAmounts(c *models.Coupon, originalAmount float64) (float64, float64) {
	var discountAmount float64
	if c.Type == "free" {
		discountAmount = originalAmount
	} else {
		discountAmount = c.Discount
		if discountAmount > originalAmount {
			discountAmount = originalAmount
		}
	}
	finalAmount := originalAmount - discountAmount
	if finalAmount < 0 {
		finalAmount = 0
	}
	return discountAmount, finalAmount
}

func checkCouponEligibility(db *gorm.DB, c *models.Coupon, storeID uint) error {
	if !c.IsActive {
		return fmt.Errorf("kode kupon \"%s\" saat ini sedang dinonaktifkan", c.Code)
	}
	if c.ExpiresAt != nil && !c.ExpiresAt.IsZero() && time.Now().UTC().After(*c.ExpiresAt) {
		return fmt.Errorf("kode kupon \"%s\" telah kedaluwarsa pada %s", c.Code, c.ExpiresAt.Format("02-01-2006"))
	}
	if c.UsageLimit > 0 && c.UsedCount >= c.UsageLimit {
		return fmt.Errorf("kuota pemakaian kupon \"%s\" telah habis", c.Code)
	}
	if storeID > 0 && c.MaxUsesPerStore > 0 {
		var usedByStore int64
		if err := db.Model(&models.CouponRedemption{}).
			Where("coupon_id = ? AND store_id = ? AND status IN ?", c.ID, storeID, []string{"reserved", "committed"}).
			Count(&usedByStore).Error; err == nil && usedByStore >= int64(c.MaxUsesPerStore) {
			return fmt.Errorf("kuota pemakaian kupon \"%s\" untuk toko ini telah mencapai batas maksimal (%d kali)", c.Code, c.MaxUsesPerStore)
		}
	}
	return nil
}

// ValidateCouponForStore validates a coupon against relational tables including optional per-store cap.
func ValidateCouponForStore(db *gorm.DB, code string, storeID uint, originalAmount float64) (*MasterCoupon, float64, float64, error) {
	clean := strings.ToUpper(strings.TrimSpace(code))
	if clean == "" {
		return nil, 0, originalAmount, errors.New("kode kupon tidak boleh kosong")
	}
	if err := ensureCouponTablesAndSyncLegacy(db); err != nil {
		return nil, 0, originalAmount, errors.New("gagal memuat data kupon dari server")
	}

	var coupon models.Coupon
	if err := db.Where("UPPER(code) = ?", clean).First(&coupon).Error; err != nil {
		return nil, 0, originalAmount, fmt.Errorf("kode kupon \"%s\" tidak ditemukan", clean)
	}
	if err := checkCouponEligibility(db, &coupon, storeID); err != nil {
		return nil, 0, originalAmount, err
	}

	discountAmount, finalAmount := computeCouponAmounts(&coupon, originalAmount)
	dto := couponModelToDTO(coupon)
	return &dto, discountAmount, finalAmount, nil
}

// ValidateCoupon validates a coupon code without store scoping (used by public preview).
func ValidateCoupon(db *gorm.DB, code string, requestedPlan string, originalAmount float64) (*MasterCoupon, float64, float64, error) {
	return ValidateCouponForStore(db, code, 0, originalAmount)
}

// ValidateAndReserveCouponInTx atomically locks the relational coupon row, checks global + per-store limits,
// increments used_count, and writes a CouponRedemption ledger record in the caller transaction.
func ValidateAndReserveCouponInTx(
	tx *gorm.DB,
	code string,
	storeID uint,
	userID uint,
	orderID *uint,
	originalAmount float64,
) (*MasterCoupon, float64, float64, *models.CouponRedemption, error) {
	clean := strings.ToUpper(strings.TrimSpace(code))
	if clean == "" {
		return nil, 0, originalAmount, nil, errors.New("kode kupon tidak boleh kosong")
	}
	if tx == nil {
		return nil, 0, originalAmount, nil, errors.New("database transaction unavailable")
	}
	_ = syncLegacyMasterCouponsSetting(tx)

	var coupon models.Coupon
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("UPPER(code) = ?", clean).First(&coupon).Error; err != nil {
		return nil, 0, originalAmount, nil, fmt.Errorf("kode kupon \"%s\" tidak ditemukan", clean)
	}
	if err := checkCouponEligibility(tx, &coupon, storeID); err != nil {
		return nil, 0, originalAmount, nil, err
	}

	discountAmount, finalAmount := computeCouponAmounts(&coupon, originalAmount)

	coupon.UsedCount++
	coupon.UpdatedAt = time.Now().UTC()
	if err := tx.Save(&coupon).Error; err != nil {
		return nil, 0, originalAmount, nil, err
	}

	redStatus := "reserved"
	if finalAmount == 0 {
		redStatus = "committed"
	}
	var storePtr, userPtr *uint
	if storeID > 0 {
		s := storeID
		storePtr = &s
	}
	if userID > 0 {
		u := userID
		userPtr = &u
	}
	redemption := &models.CouponRedemption{
		CouponID:  coupon.ID,
		StoreID:   storePtr,
		UserID:    userPtr,
		OrderID:   orderID,
		Status:    redStatus,
		CreatedAt: time.Now().UTC(),
	}
	if err := tx.Create(redemption).Error; err != nil {
		return nil, 0, originalAmount, nil, err
	}

	dto := couponModelToDTO(coupon)
	return &dto, discountAmount, finalAmount, redemption, nil
}

// ValidateAndConsumeCouponInTx preserves legacy 4-arg signature while routing to relational reservation.
func ValidateAndConsumeCouponInTx(tx *gorm.DB, code string, requestedPlan string, originalAmount float64) (*MasterCoupon, float64, float64, error) {
	dto, disc, fin, _, err := ValidateAndReserveCouponInTx(tx, code, 0, 0, nil, originalAmount)
	return dto, disc, fin, err
}

// AttachOrderToCouponRedemptionInTx binds a created SubscriptionOrder ID to an existing CouponRedemption row.
func AttachOrderToCouponRedemptionInTx(tx *gorm.DB, redemptionID uint, orderID uint, storeID uint) error {
	if tx == nil || redemptionID == 0 || orderID == 0 {
		return nil
	}
	updates := map[string]interface{}{"order_id": orderID}
	if storeID > 0 {
		updates["store_id"] = storeID
	}
	return tx.Model(&models.CouponRedemption{}).Where("id = ?", redemptionID).Updates(updates).Error
}

// CommitCouponRedemptionInTx marks reserved redemptions for an approved order as committed.
func CommitCouponRedemptionInTx(tx *gorm.DB, orderID uint) error {
	if tx == nil || orderID == 0 {
		return nil
	}
	return tx.Model(&models.CouponRedemption{}).
		Where("order_id = ? AND status = ?", orderID, "reserved").
		Update("status", "committed").Error
}

// ReleaseCouponRedemptionInTx returns reserved/committed coupon quota atomically when an order is rejected or expires.
func ReleaseCouponRedemptionInTx(tx *gorm.DB, orderID uint, couponCode string) error {
	if tx == nil {
		return nil
	}
	now := time.Now().UTC()
	var redemptions []models.CouponRedemption
	if orderID > 0 {
		_ = tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("order_id = ? AND status IN ?", orderID, []string{"reserved", "committed"}).
			Find(&redemptions).Error
	}
	if len(redemptions) > 0 {
		for _, r := range redemptions {
			if err := tx.Model(&models.CouponRedemption{}).Where("id = ?", r.ID).Updates(map[string]interface{}{
				"status":      "released",
				"released_at": &now,
			}).Error; err != nil {
				return err
			}
			var c models.Coupon
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&c, r.CouponID).Error; err == nil {
				if c.UsedCount > 0 {
					c.UsedCount--
					c.UpdatedAt = now
					if err := tx.Save(&c).Error; err != nil {
						return err
					}
				}
			}
		}
		return nil
	}
	return DecrementCouponUsageInTx(tx, couponCode)
}

// IncrementCouponUsage safely increments the used counter under row lock for a redeemed coupon.
func IncrementCouponUsage(db *gorm.DB, code string) error {
	clean := strings.ToUpper(strings.TrimSpace(code))
	if clean == "" || db == nil {
		return nil
	}
	if err := ensureCouponTablesAndSyncLegacy(db); err != nil {
		return err
	}

	return db.Transaction(func(tx *gorm.DB) error {
		var coupon models.Coupon
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("UPPER(code) = ?", clean).First(&coupon).Error; err != nil {
			return err
		}
		if coupon.UsageLimit > 0 && coupon.UsedCount >= coupon.UsageLimit {
			return fmt.Errorf("kuota pemakaian kupon \"%s\" telah habis", clean)
		}
		coupon.UsedCount++
		coupon.UpdatedAt = time.Now().UTC()
		return tx.Save(&coupon).Error
	})
}

// DecrementCouponUsageInTx safely decrements the used counter when an unpaid order is cancelled or expired.
func DecrementCouponUsageInTx(tx *gorm.DB, code string) error {
	clean := strings.ToUpper(strings.TrimSpace(code))
	if clean == "" || tx == nil {
		return nil
	}
	if !tx.Migrator().HasTable(&models.Coupon{}) {
		return nil
	}
	var coupon models.Coupon
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("UPPER(code) = ?", clean).First(&coupon).Error; err != nil {
		return nil
	}
	if coupon.UsedCount > 0 {
		coupon.UsedCount--
		coupon.UpdatedAt = time.Now().UTC()
		return tx.Save(&coupon).Error
	}
	return nil
}
