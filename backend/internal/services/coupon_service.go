package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"catavor-backend/internal/models"
	"gorm.io/gorm"
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

// GetDefaultCoupons returns initial seed coupons for high availability.
func GetDefaultCoupons() []MasterCoupon {
	now := time.Now().UTC()
	return []MasterCoupon{
		{
			ID:         "cpn_gratispro",
			Code:       "GRATISPRO",
			Label:      "Aktivasi Uji Coba Pro Bebas Biaya",
			Type:       "free",
			Discount:   0,
			UsageLimit: 1000,
			UsedCount:  0,
			IsActive:   true,
			CreatedAt:  now,
			UpdatedAt:  now,
		},
		{
			ID:         "cpn_catavor100",
			Code:       "CATAVOR100",
			Label:      "Kupon Pendaftaran Spesial 100% Gratis",
			Type:       "free",
			Discount:   0,
			UsageLimit: 1000,
			UsedCount:  0,
			IsActive:   true,
			CreatedAt:  now,
			UpdatedAt:  now,
		},
		{
			ID:         "cpn_diskon50k",
			Code:       "DISKON50K",
			Label:      "Potongan Harga Rp 50.000",
			Type:       "discount",
			Discount:   50000,
			UsageLimit: 500,
			UsedCount:  0,
			IsActive:   true,
			CreatedAt:  now,
			UpdatedAt:  now,
		},
		{
			ID:         "cpn_diskon10k",
			Code:       "DISKON10K",
			Label:      "Potongan Hemat Rp 10.000",
			Type:       "discount",
			Discount:   10000,
			UsageLimit: 500,
			UsedCount:  0,
			IsActive:   true,
			CreatedAt:  now,
			UpdatedAt:  now,
		},
	}
}

// GetMasterCoupons retrieves all master coupons from database settings.
func GetMasterCoupons(db *gorm.DB) ([]MasterCoupon, error) {
	if db == nil {
		return GetDefaultCoupons(), nil
	}

	if !db.Migrator().HasTable(&models.Setting{}) {
		_ = db.AutoMigrate(&models.Setting{})
	}

	var setting models.Setting
	err := db.Where("key = ?", "master_coupons").First(&setting).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || !db.Migrator().HasTable(&models.Setting{}) {
			defaults := GetDefaultCoupons()
			_ = SaveMasterCoupons(db, defaults)
			return defaults, nil
		}
		// If table was just created or any error, return defaults safely
		defaults := GetDefaultCoupons()
		_ = SaveMasterCoupons(db, defaults)
		return defaults, nil
	}

	raw := strings.TrimSpace(setting.Value)
	if raw == "" || raw == "[]" {
		defaults := GetDefaultCoupons()
		_ = SaveMasterCoupons(db, defaults)
		return defaults, nil
	}

	var coupons []MasterCoupon
	if err := json.Unmarshal([]byte(raw), &coupons); err != nil {
		// Fallback if legacy JSON format
		var legacy []struct {
			Code     string  `json:"code"`
			Type     string  `json:"type"`
			Discount float64 `json:"discount"`
			Label    string  `json:"label"`
		}
		if err2 := json.Unmarshal([]byte(raw), &legacy); err2 == nil && len(legacy) > 0 {
			now := time.Now().UTC()
			for i, l := range legacy {
				coupons = append(coupons, MasterCoupon{
					ID:         fmt.Sprintf("cpn_legacy_%d", i+1),
					Code:       strings.ToUpper(strings.TrimSpace(l.Code)),
					Label:      l.Label,
					Type:       l.Type,
					Discount:   l.Discount,
					UsageLimit: 0,
					UsedCount:  0,
					IsActive:   true,
					CreatedAt:  now,
					UpdatedAt:  now,
				})
			}
			_ = SaveMasterCoupons(db, coupons)
			return coupons, nil
		}
		return GetDefaultCoupons(), nil
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

// IncrementCouponUsage safely increments the used counter for a redeemed coupon.
func IncrementCouponUsage(db *gorm.DB, code string) error {
	clean := strings.ToUpper(strings.TrimSpace(code))
	if clean == "" || db == nil {
		return nil
	}

	coupons, err := GetMasterCoupons(db)
	if err != nil {
		return err
	}

	updated := false
	for i := range coupons {
		if strings.ToUpper(strings.TrimSpace(coupons[i].Code)) == clean {
			coupons[i].UsedCount++
			coupons[i].UpdatedAt = time.Now().UTC()
			updated = true
			break
		}
	}

	if updated {
		return SaveMasterCoupons(db, coupons)
	}
	return nil
}
