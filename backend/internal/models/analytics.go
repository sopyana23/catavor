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
	UniqueVisitors    int       `gorm:"default:0;not null" json:"unique_visitors"`
	ProductViews      int       `gorm:"default:0;not null" json:"product_views"`
	Bounces           int       `gorm:"default:0;not null" json:"bounces"`
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
	ID             uint      `gorm:"primaryKey" json:"id"`
	StoreID        uint      `gorm:"index:idx_traffic_store_date_source,unique;not null" json:"store_id"`
	Store          Store     `gorm:"foreignKey:StoreID;constraint:OnDelete:CASCADE" json:"-"`
	Date           string    `gorm:"type:varchar(10);index:idx_traffic_store_date_source,unique;not null" json:"date"` // YYYY-MM-DD
	Source         string    `gorm:"type:varchar(50);index:idx_traffic_store_date_source,unique;not null" json:"source"` // instagram, tiktok, whatsapp, facebook, google, marketplace, direct, other
	Views          int       `gorm:"default:0;not null" json:"views"`
	UniqueVisitors int       `gorm:"default:0;not null" json:"unique_visitors"`
	TotalActions   int       `gorm:"default:0;not null" json:"total_actions"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// StoreDailyAudienceMetric stores dimensional aggregated metrics (device, os, browser, city, country, hour, campaign).
// Supports store_id = 0 for platform-wide macro benchmarks.
type StoreDailyAudienceMetric struct {
	ID             uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	StoreID        uint      `gorm:"index:idx_store_audience_dim_unique,unique;index:idx_store_audience_lookup;not null;default:0" json:"store_id"`
	Date           string    `gorm:"type:varchar(10);index:idx_store_audience_dim_unique,unique;index:idx_store_audience_lookup;not null" json:"date"` // YYYY-MM-DD
	DimensionType  string    `gorm:"type:varchar(32);index:idx_store_audience_dim_unique,unique;index:idx_store_audience_lookup;not null" json:"dimension_type"` // device | os | browser | city | country | hour | campaign
	DimensionValue string    `gorm:"type:varchar(100);index:idx_store_audience_dim_unique,unique;not null" json:"dimension_value"`
	Views          int       `gorm:"default:0;not null" json:"views"`
	UniqueVisitors int       `gorm:"default:0;not null" json:"unique_visitors"`
	TotalActions   int       `gorm:"default:0;not null" json:"total_actions"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// TableName explicitly maps StoreDailyAudienceMetric model to 'store_daily_audience_metrics' table.
func (StoreDailyAudienceMetric) TableName() string {
	return "store_daily_audience_metrics"
}

// RecentVisitorEvent stores real-time sanitized visitor activity stream (Zero PII).
type RecentVisitorEvent struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	StoreID     uint      `gorm:"index:idx_recent_visitors_store;not null;default:0" json:"store_id"`
	StoreSlug   string    `gorm:"size:100;not null;default:''" json:"store_slug"`
	Event       string    `gorm:"size:50;not null;default:'store_view'" json:"event"` // store_view | product_view | direct_wa_click | marketplace_click | rekber_click | video_view
	ProductID   uint      `gorm:"default:0" json:"product_id"`
	ProductName string    `gorm:"size:255;default:''" json:"product_name"`
	Source      string    `gorm:"size:50;default:'direct'" json:"source"`
	DeviceType  string    `gorm:"size:50;default:'mobile'" json:"device_type"`
	Browser     string    `gorm:"size:100;default:''" json:"browser"`
	OS          string    `gorm:"size:100;default:''" json:"os"`
	City        string    `gorm:"size:100;default:'Indonesia'" json:"city"`
	CreatedAt   time.Time `gorm:"index:idx_recent_visitors_store,sort:desc;index:idx_recent_visitors_global,sort:desc;not null" json:"created_at"`
}

// TableName explicitly maps RecentVisitorEvent model to 'recent_visitor_events' table.
func (RecentVisitorEvent) TableName() string {
	return "recent_visitor_events"
}
