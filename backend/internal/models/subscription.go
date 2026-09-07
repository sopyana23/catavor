package models

import "time"

// SubscriptionPlan represents a dynamically configured subscription tier.
type SubscriptionPlan struct {
	ID                 uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Code               string    `gorm:"size:50;uniqueIndex;not null" json:"code"` // free | pro_starter | pro_business
	Name               string    `gorm:"size:100;not null" json:"name"`
	BadgeLabel         string    `gorm:"size:50" json:"badge_label"`
	Description        string    `gorm:"type:text" json:"description"`
	PriceMonthly       float64   `gorm:"type:decimal(15,2);default:0" json:"price_monthly"`
	PriceAnnual        float64   `gorm:"type:decimal(15,2);default:0" json:"price_annual"`
	StorageLimitBytes  int64     `gorm:"default:104857600" json:"storage_limit_bytes"` // 100MB, 2GB, 10GB
	MaxItems           int       `gorm:"default:15" json:"max_items"`                  // 15, 150, -1 (unlimited)
	MaxImagesPerItem   int       `gorm:"default:5" json:"max_images_per_item"`         // 5, 8, 10
	HasCustomDomain    bool      `gorm:"default:false" json:"has_custom_domain"`
	HasVerifiedBadge   bool      `gorm:"default:false" json:"has_verified_badge"`
	HasPrioritySearch  bool      `gorm:"default:false" json:"has_priority_search"`
	HasPrioritySupport bool      `gorm:"default:false" json:"has_priority_support"`
	IsActive           bool      `gorm:"default:true" json:"is_active"`
	SortOrder          int       `gorm:"default:0" json:"sort_order"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// TableName explicitly maps to 'subscription_plans' table.
func (SubscriptionPlan) TableName() string {
	return "subscription_plans"
}
