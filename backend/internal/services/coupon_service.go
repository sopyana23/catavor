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

// MasterCoupon represents an industrial-grade coupon model for platform subscriptions.
type MasterCoupon struct {
	ID         string     `json:"id"`
	Code       string     `json:"code"`
	Label      string     `json:"label"`
	Type       string     `json:"type"` // "free" (100% free) | "discount" (nominal rupiah)
	Discount   float64    `json:"discount"`
	UsageLimit int        `json:"usage_limit"` // 0 = unlimited
	UsedCount  int        `json:"used_count"`
	IsActive   bool       `json:"is_active"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// GetDefaultCoupons returns initial seed coupons. By platform security standard,
// no free backdoor coupons are seeded by default; all promotions must be explicitly created by Admin.
func GetDefaultCoupons() []MasterCoupon {
	return []MasterCoupon{}
}

// GetMasterCoupons retrieves all master coupons from database settings.
func GetMasterCoupons(db *gorm.DB) ([]MasterCoupon, error) {
	if db == nil {
		return []MasterCoupon{}, nil
	}

	var setting models.Setting
	err := db.Where("key = ?", "master_coupons").First(&setting).Error
	if err != nil {
		return []MasterCoupon{}, nil
	}

	raw := strings.TrimSpace(setting.Value)
	if raw == "" || raw == "[]" {
		return []MasterCoupon{}, nil
	}

	var coupons []MasterCoupon
	if err := json.Unmarshal([]byte(raw), &coupons); err != nil {
		return []MasterCoupon{}, nil
	}

	return coupons, nil
}

// SaveMasterCoupons stores the slice of coupons back to database settings.
func SaveMasterCoupons(db *gorm.DB, coupons []MasterCoupon) error {
	if db == nil {
		return errors.New("database connection unavailable")
	}

	bytes, err := json.Marshal(coupons)
	if err != nil {
		return err
	}

	var setting models.Setting
	err = db.Where("key = ?", "master_coupons").First(&setting).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		setting = models.Setting{
			Key:   "master_coupons",
			Value: string(bytes),
		}
		return db.Create(&setting).Error
	} else if err != nil {
		return err
	}

	setting.Value = string(bytes)
	return db.Save(&setting).Error
}

// ValidateCoupon validates a coupon code against master data and calculates exact discount.
func ValidateCoupon(db *gorm.DB, code string, requestedPlan string, originalAmount float64) (*MasterCoupon, float64, float64, error) {
	clean := strings.ToUpper(strings.TrimSpace(code))
	if clean == "" {
		return nil, 0, originalAmount, errors.New("kode kupon tidak boleh kosong")
	}

	coupons, err := GetMasterCoupons(db)
	if err != nil {
		return nil, 0, originalAmount, errors.New("gagal memuat data kupon dari server")
	}

	var found *MasterCoupon
	for i := range coupons {
		if strings.ToUpper(strings.TrimSpace(coupons[i].Code)) == clean {
			found = &coupons[i]
			break
		}
	}

	if found == nil {
		return nil, 0, originalAmount, fmt.Errorf("kode kupon \"%s\" tidak ditemukan", clean)
	}

	if !found.IsActive {
		return nil, 0, originalAmount, fmt.Errorf("kode kupon \"%s\" saat ini sedang dinonaktifkan", clean)
	}

	if found.ExpiresAt != nil && !found.ExpiresAt.IsZero() && time.Now().UTC().After(*found.ExpiresAt) {
		return nil, 0, originalAmount, fmt.Errorf("kode kupon \"%s\" telah kedaluwarsa pada %s", clean, found.ExpiresAt.Format("02-01-2006"))
	}

	if found.UsageLimit > 0 && found.UsedCount >= found.UsageLimit {
		return nil, 0, originalAmount, fmt.Errorf("kuota pemakaian kupon \"%s\" telah habis", clean)
	}

	var discountAmount float64
	if found.Type == "free" {
		discountAmount = originalAmount
	} else {
		discountAmount = found.Discount
		if discountAmount > originalAmount {
			discountAmount = originalAmount
		}
	}

	finalAmount := originalAmount - discountAmount
	if finalAmount < 0 {
		finalAmount = 0
	}

	return found, discountAmount, finalAmount, nil
}

// ValidateAndConsumeCouponInTx atomically validates a coupon and increments its used counter
// under row lock (clause.Locking{Strength: "UPDATE"}) inside a database transaction.
func ValidateAndConsumeCouponInTx(tx *gorm.DB, code string, requestedPlan string, originalAmount float64) (*MasterCoupon, float64, float64, error) {
	clean := strings.ToUpper(strings.TrimSpace(code))
	if clean == "" {
		return nil, 0, originalAmount, errors.New("kode kupon tidak boleh kosong")
	}

	var setting models.Setting
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("key = ?", "master_coupons").First(&setting).Error
	if err != nil {
		return nil, 0, originalAmount, fmt.Errorf("kode kupon \"%s\" tidak ditemukan", clean)
	}

	var coupons []MasterCoupon
	if err := json.Unmarshal([]byte(setting.Value), &coupons); err != nil || len(coupons) == 0 {
		return nil, 0, originalAmount, fmt.Errorf("kode kupon \"%s\" tidak ditemukan", clean)
	}

	var foundIdx = -1
	for i := range coupons {
		if strings.ToUpper(strings.TrimSpace(coupons[i].Code)) == clean {
			foundIdx = i
			break
		}
	}

	if foundIdx == -1 {
		return nil, 0, originalAmount, fmt.Errorf("kode kupon \"%s\" tidak ditemukan", clean)
	}

	found := &coupons[foundIdx]
	if !found.IsActive {
		return nil, 0, originalAmount, fmt.Errorf("kode kupon \"%s\" saat ini sedang dinonaktifkan", clean)
	}

	if found.ExpiresAt != nil && !found.ExpiresAt.IsZero() && time.Now().UTC().After(*found.ExpiresAt) {
		return nil, 0, originalAmount, fmt.Errorf("kode kupon \"%s\" telah kedaluwarsa pada %s", clean, found.ExpiresAt.Format("02-01-2006"))
	}

	if found.UsageLimit > 0 && found.UsedCount >= found.UsageLimit {
		return nil, 0, originalAmount, fmt.Errorf("kuota pemakaian kupon \"%s\" telah habis", clean)
	}

	var discountAmount float64
	if found.Type == "free" {
		discountAmount = originalAmount
	} else {
		discountAmount = found.Discount
		if discountAmount > originalAmount {
			discountAmount = originalAmount
		}
	}

	finalAmount := originalAmount - discountAmount
	if finalAmount < 0 {
		finalAmount = 0
	}

	found.UsedCount++
	found.UpdatedAt = time.Now().UTC()

	bytes, err := json.Marshal(coupons)
	if err != nil {
		return nil, 0, originalAmount, err
	}
	setting.Value = string(bytes)
	if err := tx.Save(&setting).Error; err != nil {
		return nil, 0, originalAmount, err
	}

	return found, discountAmount, finalAmount, nil
}

// IncrementCouponUsage safely increments the used counter under row lock for a redeemed coupon.
func IncrementCouponUsage(db *gorm.DB, code string) error {
	clean := strings.ToUpper(strings.TrimSpace(code))
	if clean == "" || db == nil {
		return nil
	}

	var setting models.Setting
	err := db.Clauses(clause.Locking{Strength: "UPDATE"}).Where("key = ?", "master_coupons").First(&setting).Error
	if err != nil {
		return err
	}

	var coupons []MasterCoupon
	if err := json.Unmarshal([]byte(setting.Value), &coupons); err != nil {
		return err
	}

	updated := false
	for i := range coupons {
		if strings.ToUpper(strings.TrimSpace(coupons[i].Code)) == clean {
			if coupons[i].UsageLimit > 0 && coupons[i].UsedCount >= coupons[i].UsageLimit {
				return fmt.Errorf("kuota pemakaian kupon \"%s\" telah habis", clean)
			}
			coupons[i].UsedCount++
			coupons[i].UpdatedAt = time.Now().UTC()
			updated = true
			break
		}
	}

	if updated {
		bytes, err := json.Marshal(coupons)
		if err != nil {
			return err
		}
		setting.Value = string(bytes)
		return db.Save(&setting).Error
	}
	return nil
}

// DecrementCouponUsageInTx safely decrements the used counter when an unpaid order is cancelled or expired.
func DecrementCouponUsageInTx(tx *gorm.DB, code string) error {
	clean := strings.ToUpper(strings.TrimSpace(code))
	if clean == "" || tx == nil {
		return nil
	}

	var setting models.Setting
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("key = ?", "master_coupons").First(&setting).Error
	if err != nil {
		return nil
	}

	var coupons []MasterCoupon
	if err := json.Unmarshal([]byte(setting.Value), &coupons); err != nil {
		return nil
	}

	updated := false
	for i := range coupons {
		if strings.ToUpper(strings.TrimSpace(coupons[i].Code)) == clean {
			if coupons[i].UsedCount > 0 {
				coupons[i].UsedCount--
				coupons[i].UpdatedAt = time.Now().UTC()
				updated = true
			}
			break
		}
	}

	if updated {
		bytes, err := json.Marshal(coupons)
		if err != nil {
			return err
		}
		setting.Value = string(bytes)
		return tx.Save(&setting).Error
	}
	return nil
}
