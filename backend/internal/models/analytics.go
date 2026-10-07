package models

import (
	"time"
)

// StoreDailyAnalytics stores daily aggregated visitor and multi-channel CTA metrics per store.
// Keeps storage footprint minimal (~30 rows per store per month).
type StoreDailyAnalytics struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	StoreID           uint      `gorm:"index:idx_analytics_store_date,unique;not null" json:"store_id"`
	Store             Store     `gorm:"foreignKey:StoreID;constraint:OnDelete:CASCADE" json:"-"`
	Date              string    `gorm:"type:varchar(10);index:idx_analytics_store_date,unique;not null" json:"date"` // YYYY-MM-DD
	StoreViews        int       `gorm:"default:0;not null" json:"store_views"`
	WaClicks          int       `gorm:"default:0;not null" json:"wa_clicks"` // Legacy / Total WA
	DirectWaClicks    int       `gorm:"default:0;not null" json:"direct_wa_clicks"`
	MarketplaceClicks int       `gorm:"default:0;not null" json:"marketplace_clicks"`
	RekberClicks      int       `gorm:"default:0;not null" json:"rekber_clicks"`
	VideoViews        int       `gorm:"default:0;not null" json:"video_views"`
	TotalActions      int       `gorm:"default:0;not null" json:"total_actions"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// ProductDailyAnalytics stores daily aggregated view and multi-channel CTA metrics per product.
type ProductDailyAnalytics struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	StoreID           uint      `gorm:"index:idx_prod_analytics_store_date;not null" json:"store_id"`
	ProductID         uint      `gorm:"index:idx_prod_analytics_product_date,unique;not null" json:"product_id"`
	Product           Product   `gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE" json:"-"`
	ProductType       string    `gorm:"size:50;default:'physical'" json:"product_type"`
	Date              string    `gorm:"type:varchar(10);index:idx_prod_analytics_product_date,unique;not null" json:"date"` // YYYY-MM-DD
	Views             int       `gorm:"default:0;not null" json:"views"`
	WaClicks          int       `gorm:"default:0;not null" json:"wa_clicks"` // Legacy / Total WA
	DirectWaClicks    int       `gorm:"default:0;not null" json:"direct_wa_clicks"`
	MarketplaceClicks int       `gorm:"default:0;not null" json:"marketplace_clicks"`
	RekberClicks      int       `gorm:"default:0;not null" json:"rekber_clicks"`
	VideoViews        int       `gorm:"default:0;not null" json:"video_views"`
	TotalActions      int       `gorm:"default:0;not null" json:"total_actions"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// StoreDailyTrafficSource stores daily aggregated visitor and action metrics per traffic source (Instagram, TikTok, WA, etc.).
type StoreDailyTrafficSource struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	StoreID      uint      `gorm:"index:idx_traffic_store_date_source,unique;not null" json:"store_id"`
	Store        Store     `gorm:"foreignKey:StoreID;constraint:OnDelete:CASCADE" json:"-"`
	Date         string    `gorm:"type:varchar(10);index:idx_traffic_store_date_source,unique;not null" json:"date"` // YYYY-MM-DD
	Source       string    `gorm:"type:varchar(50);index:idx_traffic_store_date_source,unique;not null" json:"source"` // instagram, tiktok, whatsapp, facebook, google, marketplace, direct, other
	Views        int       `gorm:"default:0;not null" json:"views"`
	TotalActions int       `gorm:"default:0;not null" json:"total_actions"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
