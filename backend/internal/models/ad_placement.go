package models

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// AdSlot represents a physical advertising location and configuration on the platform.
type AdSlot struct {
	ID                  uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	SlotCode            string    `gorm:"size:100;uniqueIndex;not null" json:"slot_code"`
	Name                string    `gorm:"size:255;not null" json:"name"`
	Description         string    `gorm:"type:text" json:"description"`
	TargetEntity        string    `gorm:"size:50;default:'store';not null" json:"target_entity"` // store | product | mixed
	AllowedProductTypes string    `gorm:"size:255;default:'all';not null" json:"allowed_product_types"`
	MaxItemsDisplayed   int       `gorm:"default:4;not null" json:"max_items_displayed"`
	PricingModel        string    `gorm:"size:50;default:'flat_daily';not null" json:"pricing_model"` // flat_daily | cpm | cpc
	DefaultRatePerDay   float64   `gorm:"type:decimal(15,2);default:0;not null" json:"default_rate_per_day"`
	MinDurationDays     int       `gorm:"default:1;not null" json:"min_duration_days"`
	IsActive            bool      `gorm:"default:true;index;not null" json:"is_active"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`

	// Relations
	Campaigns []AdCampaign `gorm:"foreignKey:AdSlotID" json:"campaigns,omitempty"`
}

// TableName explicitly maps AdSlot to 'ad_slots' table.
func (AdSlot) TableName() string {
	return "ad_slots"
}

// AdCampaign represents a tenant's sponsored placement rental contract.
type AdCampaign struct {
	ID                  uint64         `gorm:"primaryKey;autoIncrement" json:"id"`
	CampaignCode        string         `gorm:"size:100;uniqueIndex;not null" json:"campaign_code"`
	StoreID             uint           `gorm:"index;not null" json:"store_id"`
	AdSlotID            uint64         `gorm:"index;not null" json:"ad_slot_id"`
	TargetType          string         `gorm:"size:50;default:'store';not null" json:"target_type"` // store | product
	TargetStoreID       *uint          `gorm:"index" json:"target_store_id,omitempty"`
	TargetProductID     *uint          `gorm:"index" json:"target_product_id,omitempty"`
	TargetID            uint64         `gorm:"index;not null" json:"target_id"` // unified query pointer
	CampaignName        string         `gorm:"size:255;not null" json:"campaign_name"`
	StartAt             time.Time      `gorm:"index;not null" json:"start_at"`
	EndAt               time.Time      `gorm:"index;not null" json:"end_at"`
	Status              string         `gorm:"size:50;default:'pending_payment';index;not null" json:"status"`
	// draft | pending_payment | active | paused | completed | cancelled | rejected | in_review
	PricingModel        string         `gorm:"size:50;default:'flat_daily';not null" json:"pricing_model"`
	BudgetAmount        float64        `gorm:"type:decimal(15,2);default:0;not null" json:"budget_amount"`
	SpentAmount         float64        `gorm:"type:decimal(15,2);default:0;not null" json:"spent_amount"`
	PriorityWeight      int            `gorm:"default:10;not null" json:"priority_weight"`
	DailyImpressionCap  int            `gorm:"default:0;not null" json:"daily_impression_cap"`
	TargetProductType   string         `gorm:"size:50;default:'all';index;not null" json:"target_product_type"`
	TargetCity          string         `gorm:"size:100" json:"target_city,omitempty"`
	CustomBadgeText     string         `gorm:"size:50;default:'Disponsori'" json:"custom_badge_text"`
	RejectionReason     string         `gorm:"type:text" json:"rejection_reason,omitempty"`
	ApprovedByUserID    *uint          `gorm:"index" json:"approved_by_user_id,omitempty"`
	ApprovedAt          *time.Time     `json:"approved_at,omitempty"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// Relations
	Store         *Store         `gorm:"foreignKey:StoreID" json:"store,omitempty"`
	AdSlot        *AdSlot        `gorm:"foreignKey:AdSlotID" json:"ad_slot,omitempty"`
	TargetStore   *Store         `gorm:"foreignKey:TargetStoreID" json:"target_store,omitempty"`
	TargetProduct *Product       `gorm:"foreignKey:TargetProductID" json:"target_product,omitempty"`
	Orders        []AdOrder      `gorm:"foreignKey:CampaignID" json:"orders,omitempty"`
	DailyMetrics  []AdDailyMetric `gorm:"foreignKey:CampaignID" json:"daily_metrics,omitempty"`
}

// TableName explicitly maps AdCampaign to 'ad_campaigns' table.
func (AdCampaign) TableName() string {
	return "ad_campaigns"
}

// AdOrder represents an invoice / payment transaction for an ad campaign.
// Implements Controlled Denormalization for financial and historical audit integrity.
type AdOrder struct {
	ID                   uint64         `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderNumber          string         `gorm:"size:100;uniqueIndex;not null" json:"order_number"` // INV-AD-YYYYMMDD-XXXX
	CampaignID           uint64         `gorm:"index;not null" json:"campaign_id"`
	StoreID              uint           `gorm:"index;not null" json:"store_id"`
	UserID               uint           `gorm:"index;not null" json:"user_id"`
	SlotNameSnapshot     string         `gorm:"size:255;not null" json:"slot_name_snapshot"`
	PricingModelSnapshot string         `gorm:"size:50;not null" json:"pricing_model_snapshot"`
	DurationDays         int            `gorm:"default:1;not null" json:"duration_days"`
	OriginalAmount       float64        `gorm:"type:decimal(15,2);default:0;not null" json:"original_amount"`
	DiscountAmount       float64        `gorm:"type:decimal(15,2);default:0;not null" json:"discount_amount"`
	FinalAmount          float64        `gorm:"type:decimal(15,2);default:0;not null" json:"final_amount"`
	CouponCode           string         `gorm:"size:100" json:"coupon_code,omitempty"`
	UniqueCode           int            `gorm:"default:0" json:"unique_code"`
	PaymentMethod        string         `gorm:"size:50;default:'bank_transfer';not null" json:"payment_method"`
	PaymentStatus        string         `gorm:"size:50;default:'pending';index;not null" json:"payment_status"`
	// pending | pending_verification | paid | rejected | expired | refunded
	SenderAccountName    string         `gorm:"size:150" json:"sender_account_name,omitempty"`
	SenderBankName       string         `gorm:"size:100" json:"sender_bank_name,omitempty"`
	PaymentProofURL      string         `gorm:"type:text" json:"payment_proof_url,omitempty"`
	GatewayProvider      string         `gorm:"size:50" json:"gateway_provider,omitempty"`
	GatewayReference     string         `gorm:"size:150;index" json:"gateway_reference,omitempty"`
	GatewayPaymentLink   string         `gorm:"type:text" json:"gateway_payment_link,omitempty"`
	GatewayRawResponse   datatypes.JSON `gorm:"type:jsonb" json:"gateway_raw_response,omitempty"`
	RejectionReason      string         `gorm:"type:text" json:"rejection_reason,omitempty"`
	ApprovedByUserID     *uint          `gorm:"index" json:"approved_by_user_id,omitempty"`
	ExpiresAt            *time.Time     `gorm:"index" json:"expires_at,omitempty"`
	PaidAt               *time.Time     `json:"paid_at,omitempty"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`

	// Relations
	Campaign       *AdCampaign `gorm:"foreignKey:CampaignID" json:"campaign,omitempty"`
	Store          *Store      `gorm:"foreignKey:StoreID" json:"store,omitempty"`
	User           *User       `gorm:"foreignKey:UserID" json:"user,omitempty"`
	ApprovedByUser *User       `gorm:"foreignKey:ApprovedByUserID" json:"approved_by_user,omitempty"`
}

// TableName explicitly maps AdOrder to 'ad_orders' table.
func (AdOrder) TableName() string {
	return "ad_orders"
}

// AdDailyMetric records daily aggregated performance for an active ad campaign.
// Separated from organic product/store daily analytics to prevent data distortion.
type AdDailyMetric struct {
	ID               uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	CampaignID       uint64    `gorm:"index;not null" json:"campaign_id"`
	AdSlotID         uint64    `gorm:"index;not null" json:"ad_slot_id"`
	StoreID          uint      `gorm:"index:idx_ad_daily_metrics_store_date;not null" json:"store_id"`
	Date             string    `gorm:"type:varchar(10);index:idx_ad_daily_metrics_store_date;not null" json:"date"` // YYYY-MM-DD
	ImpressionsCount int64     `gorm:"default:0;not null" json:"impressions_count"`
	ClicksCount      int64     `gorm:"default:0;not null" json:"clicks_count"`
	WaClicksCount    int64     `gorm:"default:0;not null" json:"wa_clicks_count"`
	CostIncurred     float64   `gorm:"type:decimal(15,2);default:0;not null" json:"cost_incurred"`
	CTRPercentage    float64   `gorm:"type:decimal(5,2);default:0;not null" json:"ctr_percentage"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`

	// Relations
	Campaign *AdCampaign `gorm:"foreignKey:CampaignID" json:"campaign,omitempty"`
	AdSlot   *AdSlot     `gorm:"foreignKey:AdSlotID" json:"ad_slot,omitempty"`
	Store    *Store      `gorm:"foreignKey:StoreID" json:"store,omitempty"`
}

// TableName explicitly maps AdDailyMetric to 'ad_daily_metrics' table.
func (AdDailyMetric) TableName() string {
	return "ad_daily_metrics"
}

