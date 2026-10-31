package models

import (
	"time"
)

// SearchAnalytics records public storefront catalog search events with Zero PII.
// Strictly avoids storing IP addresses, names, or individual identities.
type SearchAnalytics struct {
	ID           uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	StoreID      *uint     `gorm:"index:idx_search_store_date" json:"store_id,omitempty"` // null if global marketplace search
	StoreSlug    string    `gorm:"size:100;index" json:"store_slug,omitempty"`
	Keyword      string    `gorm:"size:255;not null;index:idx_search_keyword_date" json:"keyword"`
	CleanKeyword string    `gorm:"size:255;not null;index" json:"clean_keyword"` // lowercase, stripped symbols
	CategorySlug string    `gorm:"size:100;index" json:"category_slug,omitempty"`
	ProductType  string    `gorm:"size:50;default:'all';index" json:"product_type"` // physical, food, service, digital, property, plant, fauna, all
	City         string    `gorm:"size:100;default:'Indonesia';index" json:"city"`  // Coarse anonymous city (no GPS or street addresses)
	ResultCount  int       `gorm:"default:0" json:"result_count"`
	IsZeroResult bool      `gorm:"default:false;index:idx_search_zero_result;index:idx_search_zero_date,priority:1" json:"is_zero_result"` // Critical for Demand Gap analysis
	Date         string    `gorm:"type:varchar(10);index:idx_search_date;index:idx_search_zero_date,priority:2;not null" json:"date"`     // YYYY-MM-DD
	CreatedAt    time.Time `gorm:"index" json:"created_at"`
}

// TableName explicitly maps SearchAnalytics model to 'search_analytics' table.
func (SearchAnalytics) TableName() string {
	return "search_analytics"
}

// SearchDailyRollup represents daily aggregated keyword search volume and demand gap metrics.
type SearchDailyRollup struct {
	ID                  uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Date                string    `gorm:"type:varchar(10);index:idx_search_rollup_date_kw,unique;not null" json:"date"` // YYYY-MM-DD
	Keyword             string    `gorm:"size:255;index:idx_search_rollup_date_kw,unique;not null" json:"keyword"`
	ProductType         string    `gorm:"size:50;default:'all';index" json:"product_type"`
	SearchVolume        int       `gorm:"default:0;not null" json:"search_volume"`
	ZeroResultCount     int       `gorm:"default:0;not null" json:"zero_result_count"`
	ClickedProductCount int       `gorm:"default:0;not null" json:"clicked_product_count"`
	CTRPercentage       float64   `gorm:"type:decimal(5,2);default:0" json:"ctr_percentage"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// TableName explicitly maps SearchDailyRollup model to 'search_daily_rollups' table.
func (SearchDailyRollup) TableName() string {
	return "search_daily_rollups"
}

// MarketDailyRollup stores macro industry benchmarks and performance snapshots across Catavor.
type MarketDailyRollup struct {
	ID                  uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Date                string    `gorm:"type:varchar(10);index:idx_market_rollup_date_cat,unique;not null" json:"date"` // YYYY-MM-DD
	ProductType         string    `gorm:"size:50;index:idx_market_rollup_date_cat,unique;not null" json:"product_type"`
	CategoryName        string    `gorm:"size:100;index:idx_market_rollup_date_cat,unique;not null" json:"category_name"`
	TotalActiveProducts int64     `gorm:"default:0;not null" json:"total_active_products"`
	TotalViews          int64     `gorm:"default:0;not null" json:"total_views"`
	TotalWAClicks       int64     `gorm:"default:0;not null" json:"total_wa_clicks"`
	TotalRekberClicks   int64     `gorm:"default:0;not null" json:"total_rekber_clicks"`
	ConversionRate      float64   `gorm:"type:decimal(5,2);default:0" json:"conversion_rate"`
	AveragePrice        float64   `gorm:"type:decimal(15,2);default:0" json:"average_price"`
	CreatedAt           time.Time `json:"created_at"`
}

// TableName explicitly maps MarketDailyRollup model to 'market_daily_rollups' table.
func (MarketDailyRollup) TableName() string {
	return "market_daily_rollups"
}

// CategoryPriceBenchmark stores statistical price distribution percentiles per category (K-Anonymity >= 50).
type CategoryPriceBenchmark struct {
	ID           uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Date         string    `gorm:"type:varchar(10);index:idx_price_bench_date_cat,unique;not null" json:"date"` // YYYY-MM-DD
	ProductType  string    `gorm:"size:50;index:idx_price_bench_date_cat,unique;not null" json:"product_type"`
	CategoryName string    `gorm:"size:100;index:idx_price_bench_date_cat,unique;not null" json:"category_name"`
	MinPrice     float64   `gorm:"type:decimal(15,2);default:0" json:"min_price"`
	P25Price     float64   `gorm:"type:decimal(15,2);default:0" json:"p25_price"`
	MedianPrice  float64   `gorm:"type:decimal(15,2);default:0" json:"median_price"`
	P75Price     float64   `gorm:"type:decimal(15,2);default:0" json:"p75_price"`
	MaxPrice     float64   `gorm:"type:decimal(15,2);default:0" json:"max_price"`
	SampleCount  int64     `gorm:"default:0;not null" json:"sample_count"` // Must be >= 50 for privacy
	CreatedAt    time.Time `json:"created_at"`
}

// TableName explicitly maps CategoryPriceBenchmark model to 'category_price_benchmarks' table.
func (CategoryPriceBenchmark) TableName() string {
	return "category_price_benchmarks"
}

// B2BAPIKey stores client credentials for commercial B2B Data-as-a-Service subscriptions.
type B2BAPIKey struct {
	ID                 uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	ClientName         string     `gorm:"size:255;not null" json:"client_name"`
	CompanyTIN         string     `gorm:"size:100" json:"company_tin"` // NPWP / Business tax ID
	ContactEmail       string     `gorm:"size:255;not null" json:"contact_email"`
	APIKeyHash         string     `gorm:"size:255;uniqueIndex;not null" json:"-"`
	APIKeyPrefix       string     `gorm:"size:24;not null" json:"api_key_prefix"` // e.g. "ctv_live_8f2a..."
	Tier               string     `gorm:"size:50;default:'starter'" json:"tier"`  // starter | enterprise
	RateLimitPerMinute int        `gorm:"default:60" json:"rate_limit_per_minute"`
	AllowedIndustries  string     `gorm:"size:255;default:'all'" json:"allowed_industries"` // comma-separated or 'all'
	ExpiresAt          time.Time  `gorm:"index;not null" json:"expires_at"`
	IsActive           bool       `gorm:"default:true;index" json:"is_active"`
	TotalRequests      int64      `gorm:"default:0" json:"total_requests"`
	LastUsedAt         *time.Time `json:"last_used_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// TableName explicitly maps B2BAPIKey model to 'b2b_api_keys' table.
func (B2BAPIKey) TableName() string {
	return "b2b_api_keys"
}

