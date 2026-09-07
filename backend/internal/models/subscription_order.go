package models

import "time"

// SubscriptionOrder represents an invoice / payment transaction for subscription plans.
type SubscriptionOrder struct {
	ID              uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	StoreID         uint       `gorm:"index;not null" json:"store_id"`
	UserID          uint       `gorm:"index;not null" json:"user_id"`
	OrderNumber     string     `gorm:"size:100;uniqueIndex;not null" json:"order_number"` // INV-SUB-20260907-XXXX
	Type            string     `gorm:"size:50;not null" json:"type"`                     // initial | upgrade | renewal
	PlanCode        string     `gorm:"size:50;not null" json:"plan_code"`                // pro_starter | pro_business
	BillingCycle    string     `gorm:"size:20;default:'monthly'" json:"billing_cycle"`   // monthly | annual
	DurationMonths  int        `gorm:"default:1" json:"duration_months"`
	OriginalAmount  float64    `gorm:"type:decimal(15,2);not null" json:"original_amount"`
	DiscountAmount  float64    `gorm:"type:decimal(15,2);default:0" json:"discount_amount"`
	FinalAmount     float64    `gorm:"type:decimal(15,2);not null" json:"final_amount"`
	CouponCode      string     `gorm:"size:100" json:"coupon_code"`
	PaymentMethod   string     `gorm:"size:50;default:'bank'" json:"payment_method"` // bank | qris | coupon_free
	PaymentProofURL string     `gorm:"type:text" json:"payment_proof_url"`
	PaymentStatus   string     `gorm:"size:50;default:'paid'" json:"payment_status"` // pending_verification | paid | rejected
	Notes           string     `gorm:"type:text" json:"notes"`
	PaidAt          *time.Time `json:"paid_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`

	// Relations
	Store *Store `gorm:"foreignKey:StoreID" json:"store,omitempty"`
	User  *User  `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// TableName explicitly maps to 'subscription_orders' table.
func (SubscriptionOrder) TableName() string {
	return "subscription_orders"
}
