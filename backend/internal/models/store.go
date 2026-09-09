package models

import (
	"time"

	"gorm.io/datatypes"
)

type Store struct {
	ID                       uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID                   uint           `gorm:"index;not null" json:"user_id"`
	Slug                     string         `gorm:"size:255;uniqueIndex;not null" json:"slug"`
	StoreTitle               string         `gorm:"size:255;not null" json:"store_title"`
	StoreSlogan              string         `gorm:"type:text" json:"store_slogan"`
	PromoBanner              string         `gorm:"type:text" json:"promo_banner"`
	WhatsappNumber           string         `gorm:"type:text" json:"whatsapp_number"`
	OfficialWebsite          string         `gorm:"size:255" json:"official_website"`
	StoreLogoURL             string         `gorm:"type:text" json:"store_logo_url"`
	StoreTheme               string         `gorm:"size:50;default:'navy'" json:"store_theme"`
	AboutTitle               string         `gorm:"size:255" json:"about_title"`
	AboutSlogan              string         `gorm:"type:text" json:"about_slogan"`
	AboutDescription         string         `gorm:"type:text" json:"about_description"`
	AboutCards               datatypes.JSON `gorm:"type:jsonb" json:"about_cards"`
	AboutLocation            string         `gorm:"type:text" json:"about_location"`
	AboutHours               string         `gorm:"type:text" json:"about_hours"`
	ShowHours                bool           `gorm:"default:false" json:"show_hours"`
	AboutDisclaimer          string         `gorm:"type:text" json:"about_disclaimer"`
	SocialLinks              datatypes.JSON `gorm:"type:jsonb" json:"social_links"`
	Plan                     string         `gorm:"size:50;default:'free'" json:"plan"`
	NextPlanCode             *string        `gorm:"size:50" json:"next_plan_code,omitempty"`
	PlanStatus               string         `gorm:"size:50;default:'active'" json:"plan_status"` // active | grace_period | expired
	PlanExpiresAt            *time.Time     `json:"plan_expires_at,omitempty"`
	GracePeriodUntil         *time.Time     `json:"grace_period_until,omitempty"`
	StorageUsedBytes         int64          `gorm:"default:0" json:"storage_used_bytes"`
	CustomDomain             *string        `gorm:"size:255;index" json:"custom_domain,omitempty"`
	CustomDomainStatus       string         `gorm:"size:50;default:'none'" json:"custom_domain_status"` // none | pending | active | inactive_expired
	PaymentStatus            string         `gorm:"size:50;default:'free_active'" json:"payment_status"`
	EnableWADirect           bool           `gorm:"default:true" json:"enable_wa_direct"`
	EnableWARekber           bool           `gorm:"default:true" json:"enable_wa_rekber"`
	RegistrationTimezone     string         `gorm:"size:50;default:'Asia/Jakarta'" json:"registration_timezone"`
	MasterCategories         datatypes.JSON `gorm:"type:jsonb" json:"master_categories"`
	MasterClasses            datatypes.JSON `gorm:"type:jsonb" json:"master_classes"`
	MasterHabitats           datatypes.JSON `gorm:"type:jsonb" json:"master_habitats"`
	MasterStatuses           datatypes.JSON `gorm:"type:jsonb" json:"master_statuses"`
	MasterShippingCoverages  datatypes.JSON `gorm:"type:jsonb" json:"master_shipping_coverages"`
	LastActivityAt           time.Time      `gorm:"index;default:CURRENT_TIMESTAMP" json:"last_activity_at"`
	DormancyStatus           string         `gorm:"size:50;default:'active';index" json:"dormancy_status"` // active | warning_1 | warning_2 | suspended | purged
	DormancyWarning1SentAt   *time.Time     `json:"dormancy_warning1_sent_at,omitempty"`
	DormancyWarning2SentAt   *time.Time     `json:"dormancy_warning2_sent_at,omitempty"`
	DormancySuspendedAt      *time.Time     `json:"dormancy_suspended_at,omitempty"`
	ReactivationToken        string         `gorm:"size:128;index" json:"-"`
	IsExemptFromDormancy     bool           `gorm:"default:false" json:"is_exempt_from_dormancy"`
	CreatedAt                time.Time      `json:"created_at"`
	UpdatedAt                time.Time      `json:"updated_at"`

	// Relations
	User       *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Faunas     []Fauna    `gorm:"foreignKey:StoreID" json:"faunas,omitempty"`
	Products   []Product  `gorm:"foreignKey:StoreID" json:"products,omitempty"`
	Categories []Category `gorm:"foreignKey:StoreID" json:"categories,omitempty"`
}
