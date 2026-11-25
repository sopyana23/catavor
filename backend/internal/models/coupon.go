package models

import "time"

// Coupon represents a relational discount or 100%-free promotion code for platform subscriptions.
type Coupon struct {
	ID              uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	Code            string     `gorm:"size:64;uniqueIndex;not null" json:"code"`
	Label           string     `gorm:"size:255;not null" json:"label"`
	Type            string     `gorm:"size:20;not null;default:'discount'" json:"type"` // "free" | "discount"
	Discount        float64    `gorm:"type:decimal(15,2);not null;default:0" json:"discount"`
	UsageLimit      int        `gorm:"not null;default:0" json:"usage_limit"` // 0 = unlimited global
	UsedCount       int        `gorm:"not null;default:0" json:"used_count"`
	MaxUsesPerStore int        `gorm:"not null" json:"max_uses_per_store"` // 0 = unlimited per store
	IsActive        bool       `gorm:"not null;index" json:"is_active"`
	ExpiresAt       *time.Time `gorm:"index" json:"expires_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func (Coupon) TableName() string {
	return "coupons"
}

// CouponRedemption tracks per-store / per-user coupon reservations linked to subscription orders.
// States: 'reserved' (order created), 'committed' (order paid), 'released' (order rejected/expired).
type CouponRedemption struct {
	ID         uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	CouponID   uint       `gorm:"not null;index:idx_coupon_redemptions_lookup,priority:1" json:"coupon_id"`
	StoreID    *uint      `gorm:"index:idx_coupon_redemptions_lookup,priority:2" json:"store_id,omitempty"`
	UserID     *uint      `gorm:"index" json:"user_id,omitempty"`
	OrderID    *uint      `gorm:"index" json:"order_id,omitempty"`
	Status     string     `gorm:"size:20;not null;default:'reserved';index:idx_coupon_redemptions_lookup,priority:3" json:"status"`
	CreatedAt  time.Time  `json:"created_at"`
	ReleasedAt *time.Time `json:"released_at,omitempty"`
}

func (CouponRedemption) TableName() string {
	return "coupon_redemptions"
}
