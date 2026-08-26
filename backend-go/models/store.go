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
	StoreTheme               string         `gorm:"size:50;default:'emerald'" json:"store_theme"`
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
	PaymentStatus            string         `gorm:"size:50;default:'free_active'" json:"payment_status"`
	EnableWADirect           bool           `gorm:"default:true" json:"enable_wa_direct"`
	EnableWARekber           bool           `gorm:"default:true" json:"enable_wa_rekber"`
	RegistrationTimezone     string         `gorm:"size:50;default:'Asia/Jakarta'" json:"registration_timezone"`
	MasterClasses            datatypes.JSON `gorm:"type:jsonb" json:"master_classes"`
	MasterHabitats           datatypes.JSON `gorm:"type:jsonb" json:"master_habitats"`
	MasterStatuses           datatypes.JSON `gorm:"type:jsonb" json:"master_statuses"`
	MasterShippingCoverages  datatypes.JSON `gorm:"type:jsonb" json:"master_shipping_coverages"`
	CreatedAt                time.Time      `json:"created_at"`
	UpdatedAt                time.Time      `json:"updated_at"`

	// Relations
	User   *User   `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Faunas []Fauna `gorm:"foreignKey:StoreID" json:"faunas,omitempty"`
}
