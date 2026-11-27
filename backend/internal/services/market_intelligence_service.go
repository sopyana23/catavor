package services

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"catavor-backend/internal/models"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

const KAnonymityMinStores = 3

type marketIntelCacheHolder struct {
	mu           sync.RWMutex
	cachedAt     int64
	summary      *MacroMarketSummary
	invalidators []func()
}

var globalMarketIntelCache = &marketIntelCacheHolder{}

// RegisterMarketCacheInvalidator registers a callback invoked whenever InvalidateMarketIntelCache runs.
func RegisterMarketCacheInvalidator(fn func()) {
	if fn == nil {
		return
	}
	globalMarketIntelCache.mu.Lock()
	defer globalMarketIntelCache.mu.Unlock()
	globalMarketIntelCache.invalidators = append(globalMarketIntelCache.invalidators, fn)
}

// InvalidateMarketIntelCache purges cached macro intelligence and sibling caches so next request computes freshly.
func InvalidateMarketIntelCache() {
	globalMarketIntelCache.mu.Lock()
	globalMarketIntelCache.cachedAt = 0
	globalMarketIntelCache.summary = nil
	fns := make([]func(), len(globalMarketIntelCache.invalidators))
	copy(fns, globalMarketIntelCache.invalidators)
	globalMarketIntelCache.mu.Unlock()

	for _, fn := range fns {
		if fn != nil {
			fn()
		}
	}
}

func clampRate(actions, views int64) float64 {
	if views <= 0 || actions <= 0 {
		return 0
	}
	rate := math.Round((float64(actions)/float64(views))*10000) / 100
	if rate > 100.0 {
		return 100.0
	}
	return rate
}

func computeLinearPercentile(sorted []float64, p float64) float64 {
	n := len(sorted)
	if n == 0 {
		return 0
	}
	if n == 1 {
		return sorted[0]
	}
	idx := p * float64(n-1)
	lo := int(math.Floor(idx))
	hi := int(math.Ceil(idx))
	if lo == hi || hi >= n {
		return sorted[lo]
	}
	frac := idx - float64(lo)
	return sorted[lo] + frac*(sorted[hi]-sorted[lo])
}

// MacroMarketSummary represents aggregated high-level market intelligence across Catavor ecosystem.
type MacroMarketSummary struct {
	TotalActiveStores        int64                    `json:"total_active_stores"`
	TotalActiveProducts      int64                    `json:"total_active_products"`
	TotalViews30D            int64                    `json:"total_views_30d"`
	TotalActions30D          int64                    `json:"total_actions_30d"`
	OverallConversionRate    float64                  `json:"overall_conversion_rate"` // (actions / views) * 100
	KAnonymityMinStores      int                      `json:"k_anonymity_min_stores"`
	ChannelBreakdown         ChannelBreakdownStats    `json:"channel_breakdown"`
	TopCategories            []CategoryTrendSummary   `json:"top_categories"`
	PriceBenchmarks          []CategoryPriceBenchmark `json:"price_benchmarks"`
	TrendTimeline            []DailyMarketTrendPoint  `json:"trend_timeline"`
	PriceBracketElasticity   []PriceBracketMetric     `json:"price_bracket_elasticity"`
	GeoIndustryMatrix        []GeoIndustryMetric      `json:"geo_industry_matrix"`
	DeviceIndustryMatrix     []DeviceIndustryMetric   `json:"device_industry_matrix"`
	CatalogQualityBenchmarks CatalogQualityMetrics    `json:"catalog_quality_benchmarks"`
	SupplySideDynamics       SupplyDynamicsMetrics    `json:"supply_side_dynamics"`
	TopSearchDemandGaps      []SearchDemandGapItem    `json:"top_search_demand_gaps"`
	GeneratedAt              string                   `json:"generated_at"`
	DataPrivacyNotice        string                   `json:"data_privacy_notice"`
}

type ChannelBreakdownStats struct {
	DirectWAClicks     int64   `json:"direct_wa_clicks"`
	DirectWAPercent    float64 `json:"direct_wa_percent"`
	MarketplaceClicks  int64   `json:"marketplace_clicks"`
	MarketplacePercent float64 `json:"marketplace_percent"`
	RekberClicks       int64   `json:"rekber_clicks"`
	RekberPercent      float64 `json:"rekber_percent"`
	VideoViews         int64   `json:"video_views"`
	VideoViewsPercent  float64 `json:"video_views_percent"`
	TotalActions       int64   `json:"total_actions"`
}

type CategoryTrendSummary struct {
	CategoryID       uint    `json:"category_id"`
	CategoryName     string  `json:"category_name"`
	ProductCount     int64   `json:"product_count"`
	UniqueStoreCount int64   `json:"unique_store_count"`
	TotalViews       int64   `json:"total_views"`
	TotalActions     int64   `json:"total_actions"`
	ConversionRate   float64 `json:"conversion_rate"`
	AveragePrice     float64 `json:"average_price"`
}

type CategoryPriceBenchmark struct {
	ProductType      string  `json:"product_type,omitempty"`
	CategoryName     string  `json:"category_name"`
	MinPrice         float64 `json:"min_price"`
	P25Price         float64 `json:"p25_price"`
	AvgPrice         float64 `json:"avg_price"`
	MedianPrice      float64 `json:"median_price"`
	P75Price         float64 `json:"p75_price"`
	MaxPrice         float64 `json:"max_price"`
	SampleCount      int64   `json:"sample_count"`
	UniqueStoreCount int64   `json:"unique_store_count"`
	IsKAnonymous     bool    `json:"is_k_anonymous"`
}

type DailyMarketTrendPoint struct {
	Date         string `json:"date"`
	StoreViews   int64  `json:"store_views"`
	ProductViews int64  `json:"product_views"`
	TotalActions int64  `json:"total_actions"`
}

type PriceBracketMetric struct {
	ProductType    string  `json:"product_type"`
	Bracket        string  `json:"bracket"`
	Views          int64   `json:"views"`
	TotalActions   int64   `json:"total_actions"`
	ConversionRate float64 `json:"conversion_rate"`
}

type GeoIndustryMetric struct {
	City           string  `json:"city"`
	ProductType    string  `json:"product_type"`
	Views          int64   `json:"views"`
	TotalActions   int64   `json:"total_actions"`
	ConversionRate float64 `json:"conversion_rate"`
}

type DeviceIndustryMetric struct {
	DeviceOS       string  `json:"device_os"`
	ProductType    string  `json:"product_type"`
	Views          int64   `json:"views"`
	TotalActions   int64   `json:"total_actions"`
	ConversionRate float64 `json:"conversion_rate"`
}

type CatalogQualityMetrics struct {
	MultiPhotoConversionRate  float64 `json:"multi_photo_conversion_rate"`  // 4+ photos
	SinglePhotoConversionRate float64 `json:"single_photo_conversion_rate"` // 1 photo
	VideoBoostMultiplier      float64 `json:"video_boost_multiplier"`       // Conversion multiplier with video vs without
	RekberTrustAdoptionRate   float64 `json:"rekber_trust_adoption_rate"`   // % active products with Rekber enabled
}

type SupplyDynamicsMetrics struct {
	PriceIncreaseRatio     float64 `json:"price_increase_ratio"` // % of price changes that were increases
	PriceDecreaseRatio     float64 `json:"price_decrease_ratio"` // % of price changes that were decreases
	SoldOutVelocityAvgDays float64 `json:"sold_out_velocity_avg_days"`
	NewListings30D         int64   `json:"new_listings_30d"`
}

type SearchDemandGapItem struct {
	Keyword      string  `json:"keyword"`
	ProductType  string  `json:"product_type"`
	SearchVolume int64   `json:"search_volume"`
	ZeroCount    int64   `json:"zero_count"`
	CTR          float64 `json:"ctr"`
}

// GetMacroMarketSummary aggregates ecosystem-wide statistics ensuring strict K-Anonymity (Zero PII).
func GetMacroMarketSummary(db *gorm.DB) (*MacroMarketSummary, error) {
	nowUnix := time.Now().Unix()
	globalMarketIntelCache.mu.RLock()
	if globalMarketIntelCache.summary != nil && (nowUnix-globalMarketIntelCache.cachedAt) < 180 {
		cached := globalMarketIntelCache.summary
		globalMarketIntelCache.mu.RUnlock()
		return cached, nil
	}
	globalMarketIntelCache.mu.RUnlock()

	if globalStoreTelemetry != nil {
		globalStoreTelemetry.FlushNow()
	}

	summary := &MacroMarketSummary{
		KAnonymityMinStores:    KAnonymityMinStores,
		TopCategories:          make([]CategoryTrendSummary, 0),
		PriceBenchmarks:        make([]CategoryPriceBenchmark, 0),
		TrendTimeline:          make([]DailyMarketTrendPoint, 0),
		PriceBracketElasticity: make([]PriceBracketMetric, 0),
		GeoIndustryMatrix:      make([]GeoIndustryMetric, 0),
		DeviceIndustryMatrix:   make([]DeviceIndustryMetric, 0),
		TopSearchDemandGaps:    make([]SearchDemandGapItem, 0),
		GeneratedAt:            time.Now().UTC().Format(time.RFC3339),
		DataPrivacyNotice:      "Seluruh data pasar disajikan dalam bentuk agregat statistik anonim tanpa memuat identitas pribadi (Zero-PII) sesuai UU No. 27 Tahun 2022 (UU PDP), dengan ambang privasi K-Anonymity minimal 3 toko unik per kategori.",
	}

	// 1. Total Active Stores & Products
	if err := db.Model(&models.Store{}).Where("(dormancy_status IS NULL OR dormancy_status = 'active') AND is_blacklisted = false").Count(&summary.TotalActiveStores).Error; err != nil {
		log.Warn().Err(err).Str("section", "active_stores").Msg("MarketIntel query error")
	}
	if err := db.Model(&models.Product{}).Where("is_active = true").Count(&summary.TotalActiveProducts).Error; err != nil {
		log.Warn().Err(err).Str("section", "active_products").Msg("MarketIntel query error")
	}

	// 2. 30 Days Aggregated Metrics (UTC consistent)
	startDate := time.Now().UTC().AddDate(0, 0, -30).Format("2006-01-02")

	type AggStats struct {
		TotalStoreViews  int64 `gorm:"column:total_store_views"`
		TotalDirectWA    int64 `gorm:"column:total_direct_wa"`
		TotalMarketplace int64 `gorm:"column:total_marketplace"`
		TotalRekber      int64 `gorm:"column:total_rekber"`
		TotalVideoViews  int64 `gorm:"column:total_video_views"`
		TotalActions     int64 `gorm:"column:total_actions"`
	}
	var storeAgg AggStats
	if err := db.Model(&models.StoreDailyAnalytics{}).
		Select("COALESCE(SUM(store_views), 0) as total_store_views, COALESCE(SUM(direct_wa_clicks), 0) as total_direct_wa, COALESCE(SUM(marketplace_clicks), 0) as total_marketplace, COALESCE(SUM(rekber_clicks), 0) as total_rekber, COALESCE(SUM(video_views), 0) as total_video_views, COALESCE(SUM(total_actions), 0) as total_actions").
		Where("date >= ?", startDate).
		Scan(&storeAgg).Error; err != nil {
		log.Warn().Err(err).Str("section", "store_daily_analytics").Msg("MarketIntel query error")
	}

	var prodViews int64
	if err := db.Model(&models.ProductDailyAnalytics{}).
		Select("COALESCE(SUM(views), 0)").
		Where("date >= ?", startDate).
		Scan(&prodViews).Error; err != nil {
		log.Warn().Err(err).Str("section", "product_daily_views").Msg("MarketIntel query error")
	}

	totalViews := storeAgg.TotalStoreViews + prodViews
	summary.TotalViews30D = totalViews
	summary.TotalActions30D = storeAgg.TotalActions
	summary.OverallConversionRate = clampRate(storeAgg.TotalActions, totalViews)

	// Channel Breakdown
	totalActions := storeAgg.TotalActions
	if totalActions == 0 {
		totalActions = storeAgg.TotalDirectWA + storeAgg.TotalMarketplace + storeAgg.TotalRekber + storeAgg.TotalVideoViews
	}
	summary.ChannelBreakdown.TotalActions = totalActions
	summary.ChannelBreakdown.DirectWAClicks = storeAgg.TotalDirectWA
	summary.ChannelBreakdown.MarketplaceClicks = storeAgg.TotalMarketplace
	summary.ChannelBreakdown.RekberClicks = storeAgg.TotalRekber
	summary.ChannelBreakdown.VideoViews = storeAgg.TotalVideoViews

	if totalActions > 0 {
		summary.ChannelBreakdown.DirectWAPercent = math.Min(100.0, math.Round((float64(storeAgg.TotalDirectWA)/float64(totalActions))*1000)/10)
		summary.ChannelBreakdown.MarketplacePercent = math.Min(100.0, math.Round((float64(storeAgg.TotalMarketplace)/float64(totalActions))*1000)/10)
		summary.ChannelBreakdown.RekberPercent = math.Min(100.0, math.Round((float64(storeAgg.TotalRekber)/float64(totalActions))*1000)/10)
		summary.ChannelBreakdown.VideoViewsPercent = math.Min(100.0, math.Round((float64(storeAgg.TotalVideoViews)/float64(totalActions))*1000)/10)
	}

	// 3. Category Market Trends (with K-Anonymity >= 3 unique stores and pre-aggregated product analytics to eliminate AVG fan-out distortion)
	type CatRow struct {
		CategoryID   uint    `gorm:"column:category_id"`
		CategoryName string  `gorm:"column:category_name"`
		ProductCount int64   `gorm:"column:product_count"`
		StoreCount   int64   `gorm:"column:store_count"`
		AvgPrice     float64 `gorm:"column:avg_price"`
		TotalViews   int64   `gorm:"column:total_views"`
		TotalActions int64   `gorm:"column:total_actions"`
	}
	var catRows []CatRow
	if err := db.Raw(`
		SELECT 
			MIN(c.id) as category_id,
			COALESCE(c.name, 'Umum') as category_name,
			COUNT(DISTINCT p.id) as product_count,
			COUNT(DISTINCT p.store_id) as store_count,
			COALESCE(AVG(CASE WHEN p.price > 0 THEN p.price END), 0) as avg_price,
			COALESCE(SUM(COALESCE(pda.views, 0)), 0) as total_views,
			COALESCE(SUM(COALESCE(pda.total_actions, 0)), 0) as total_actions
		FROM categories c
		INNER JOIN products p ON p.category_id = c.id AND p.is_active = true
		LEFT JOIN (
			SELECT product_id, SUM(views) as views, SUM(total_actions) as total_actions
			FROM product_daily_analytics
			WHERE date >= ?
			GROUP BY product_id
		) pda ON pda.product_id = p.id
		GROUP BY c.name
		HAVING COUNT(DISTINCT p.store_id) >= ?
		ORDER BY product_count DESC
		LIMIT 15
	`, startDate, KAnonymityMinStores).Scan(&catRows).Error; err != nil {
		log.Warn().Err(err).Str("section", "top_categories").Msg("MarketIntel query error")
	}

	for _, cr := range catRows {
		summary.TopCategories = append(summary.TopCategories, CategoryTrendSummary{
			CategoryID:       cr.CategoryID,
			CategoryName:     cr.CategoryName,
			ProductCount:     cr.ProductCount,
			UniqueStoreCount: cr.StoreCount,
			TotalViews:       cr.TotalViews,
			TotalActions:     cr.TotalActions,
			ConversionRate:   clampRate(cr.TotalActions, cr.TotalViews),
			AveragePrice:     math.Round(cr.AvgPrice),
		})
	}

	// 4. Price Benchmarks per Category with Real Quartiles & Strict K-Anonymity (PostgreSQL PERCENTILE_CONT or portable Go interpolation)
	type PriceBenchRow struct {
		ProductType  string  `gorm:"column:product_type"`
		CategoryName string  `gorm:"column:category_name"`
		MinPrice     float64 `gorm:"column:min_price"`
		P25Price     float64 `gorm:"column:p25_price"`
		MedianPrice  float64 `gorm:"column:median_price"`
		P75Price     float64 `gorm:"column:p75_price"`
		MaxPrice     float64 `gorm:"column:max_price"`
		AvgPrice     float64 `gorm:"column:avg_price"`
		SampleCount  int64   `gorm:"column:sample_count"`
		StoreCount   int64   `gorm:"column:store_count"`
	}
	var priceRows []PriceBenchRow
	if db.Dialector != nil && db.Dialector.Name() == "postgres" {
		if err := db.Raw(`
			SELECT 
				COALESCE(NULLIF(p.product_type, ''), 'physical') as product_type,
				COALESCE(c.name, 'Umum') as category_name,
				MIN(p.price) as min_price,
				COALESCE(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY p.price), MIN(p.price)) as p25_price,
				COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY p.price), AVG(p.price)) as median_price,
				COALESCE(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY p.price), MAX(p.price)) as p75_price,
				MAX(p.price) as max_price,
				AVG(p.price) as avg_price,
				COUNT(p.id) as sample_count,
				COUNT(DISTINCT p.store_id) as store_count
			FROM products p
			LEFT JOIN categories c ON c.id = p.category_id
			WHERE p.is_active = true AND p.price > 0
			GROUP BY COALESCE(NULLIF(p.product_type, ''), 'physical'), COALESCE(c.name, 'Umum')
			HAVING COUNT(DISTINCT p.store_id) >= ?
			ORDER BY sample_count DESC
			LIMIT 15
		`, KAnonymityMinStores).Scan(&priceRows).Error; err != nil {
			log.Warn().Err(err).Str("section", "price_benchmarks_pg").Msg("MarketIntel query error")
		}
	} else {
		type rawPriceSample struct {
			ProductType  string  `gorm:"column:product_type"`
			CategoryName string  `gorm:"column:category_name"`
			Price        float64 `gorm:"column:price"`
			StoreID      uint    `gorm:"column:store_id"`
		}
		var rawSamples []rawPriceSample
		if err := db.Raw(`
			SELECT 
				COALESCE(NULLIF(p.product_type, ''), 'physical') as product_type,
				COALESCE(c.name, 'Umum') as category_name,
				p.price as price,
				p.store_id as store_id
			FROM products p
			LEFT JOIN categories c ON c.id = p.category_id
			WHERE p.is_active = true AND p.price > 0
		`).Scan(&rawSamples).Error; err != nil {
			log.Warn().Err(err).Str("section", "price_benchmarks_portable").Msg("MarketIntel query error")
		} else {
			type benchBucket struct {
				productType  string
				categoryName string
				prices       []float64
				stores       map[uint]struct{}
				sum          float64
			}
			buckets := make(map[string]*benchBucket)
			for _, rs := range rawSamples {
				k := rs.ProductType + "|" + rs.CategoryName
				b, ok := buckets[k]
				if !ok {
					b = &benchBucket{
						productType:  rs.ProductType,
						categoryName: rs.CategoryName,
						stores:       make(map[uint]struct{}),
					}
					buckets[k] = b
				}
				b.prices = append(b.prices, rs.Price)
				b.stores[rs.StoreID] = struct{}{}
				b.sum += rs.Price
			}
			for _, b := range buckets {
				if len(b.stores) < KAnonymityMinStores || len(b.prices) == 0 {
					continue
				}
				sort.Float64s(b.prices)
				n := len(b.prices)
				priceRows = append(priceRows, PriceBenchRow{
					ProductType:  b.productType,
					CategoryName: b.categoryName,
					MinPrice:     b.prices[0],
					P25Price:     computeLinearPercentile(b.prices, 0.25),
					MedianPrice:  computeLinearPercentile(b.prices, 0.50),
					P75Price:     computeLinearPercentile(b.prices, 0.75),
					MaxPrice:     b.prices[n-1],
					AvgPrice:     b.sum / float64(n),
					SampleCount:  int64(n),
					StoreCount:   int64(len(b.stores)),
				})
			}
			sort.Slice(priceRows, func(i, j int) bool {
				if priceRows[i].SampleCount != priceRows[j].SampleCount {
					return priceRows[i].SampleCount > priceRows[j].SampleCount
				}
				return priceRows[i].CategoryName < priceRows[j].CategoryName
			})
			if len(priceRows) > 15 {
				priceRows = priceRows[:15]
			}
		}
	}

	for _, pr := range priceRows {
		isKAnon := pr.StoreCount >= KAnonymityMinStores
		summary.PriceBenchmarks = append(summary.PriceBenchmarks, CategoryPriceBenchmark{
			ProductType:      pr.ProductType,
			CategoryName:     pr.CategoryName,
			MinPrice:         math.Round(pr.MinPrice),
			P25Price:         math.Round(pr.P25Price),
			AvgPrice:         math.Round(pr.AvgPrice),
			MedianPrice:      math.Round(pr.MedianPrice),
			P75Price:         math.Round(pr.P75Price),
			MaxPrice:         math.Round(pr.MaxPrice),
			SampleCount:      pr.SampleCount,
			UniqueStoreCount: pr.StoreCount,
			IsKAnonymous:     isKAnon,
		})
	}

	// 5. 14 Days Daily Timeline (UTC)
	type DayPoint struct {
		Date         string `gorm:"column:date"`
		StoreViews   int64  `gorm:"column:store_views"`
		ProductViews int64  `gorm:"column:product_views"`
		TotalActions int64  `gorm:"column:total_actions"`
	}
	var dayPoints []DayPoint
	fourteenDaysAgo := time.Now().UTC().AddDate(0, 0, -14).Format("2006-01-02")
	if err := db.Raw(`
		SELECT 
			d.date,
			COALESCE(s.store_views, 0) as store_views,
			COALESCE(p.prod_views, 0) as product_views,
			COALESCE(s.actions, 0) as total_actions
		FROM (
			SELECT DISTINCT date FROM store_daily_analytics WHERE date >= ?
			UNION
			SELECT DISTINCT date FROM product_daily_analytics WHERE date >= ?
		) d
		LEFT JOIN (
			SELECT date, SUM(store_views) as store_views, SUM(total_actions) as actions 
			FROM store_daily_analytics 
			WHERE date >= ? 
			GROUP BY date
		) s ON s.date = d.date
		LEFT JOIN (
			SELECT date, SUM(views) as prod_views 
			FROM product_daily_analytics 
			WHERE date >= ? 
			GROUP BY date
		) p ON p.date = d.date
		ORDER BY d.date ASC
	`, fourteenDaysAgo, fourteenDaysAgo, fourteenDaysAgo, fourteenDaysAgo).Scan(&dayPoints).Error; err != nil {
		log.Warn().Err(err).Str("section", "trend_timeline").Msg("MarketIntel query error")
	}

	for _, dp := range dayPoints {
		summary.TrendTimeline = append(summary.TrendTimeline, DailyMarketTrendPoint{
			Date:         dp.Date,
			StoreViews:   dp.StoreViews,
			ProductViews: dp.ProductViews,
			TotalActions: dp.TotalActions,
		})
	}

	// 6. Price-Bracket Conversion Elasticity (30D from store_daily_audience_metrics store_id = 0)
	type DimensionRow struct {
		DimVal       string `gorm:"column:dimension_value"`
		Views        int64  `gorm:"column:views"`
		TotalActions int64  `gorm:"column:total_actions"`
	}
	var bracketRows []DimensionRow
	if err := db.Raw(`
		SELECT dimension_value, SUM(views) as views, SUM(total_actions) as total_actions
		FROM store_daily_audience_metrics
		WHERE store_id = 0 AND dimension_type = 'price_bracket' AND date >= ?
		GROUP BY dimension_value
		ORDER BY views DESC
		LIMIT 15
	`, startDate).Scan(&bracketRows).Error; err != nil {
		log.Warn().Err(err).Str("section", "price_bracket_elasticity").Msg("MarketIntel query error")
	}

	for _, br := range bracketRows {
		parts := strings.Split(br.DimVal, "|")
		pType := "all"
		bracket := br.DimVal
		if len(parts) >= 2 {
			pType = parts[0]
			bracket = parts[1]
		}
		summary.PriceBracketElasticity = append(summary.PriceBracketElasticity, PriceBracketMetric{
			ProductType:    pType,
			Bracket:        bracket,
			Views:          br.Views,
			TotalActions:   br.TotalActions,
			ConversionRate: clampRate(br.TotalActions, br.Views),
		})
	}

	// 7. Geo-Industry Matrix (City x ProductType)
	var geoRows []DimensionRow
	if err := db.Raw(`
		SELECT dimension_value, SUM(views) as views, SUM(total_actions) as total_actions
		FROM store_daily_audience_metrics
		WHERE store_id = 0 AND dimension_type = 'geo_type' AND date >= ?
		GROUP BY dimension_value
		ORDER BY views DESC
		LIMIT 15
	`, startDate).Scan(&geoRows).Error; err != nil {
		log.Warn().Err(err).Str("section", "geo_industry_matrix").Msg("MarketIntel query error")
	}

	for _, gr := range geoRows {
		parts := strings.Split(gr.DimVal, "|")
		city := gr.DimVal
		pType := "all"
		if len(parts) >= 2 {
			city = parts[0]
			pType = parts[1]
		}
		summary.GeoIndustryMatrix = append(summary.GeoIndustryMatrix, GeoIndustryMetric{
			City:           city,
			ProductType:    pType,
			Views:          gr.Views,
			TotalActions:   gr.TotalActions,
			ConversionRate: clampRate(gr.TotalActions, gr.Views),
		})
	}

	// 8. Device-Industry Matrix (OS x ProductType)
	var devRows []DimensionRow
	if err := db.Raw(`
		SELECT dimension_value, SUM(views) as views, SUM(total_actions) as total_actions
		FROM store_daily_audience_metrics
		WHERE store_id = 0 AND dimension_type = 'device_type' AND date >= ?
		GROUP BY dimension_value
		ORDER BY views DESC
		LIMIT 12
	`, startDate).Scan(&devRows).Error; err != nil {
		log.Warn().Err(err).Str("section", "device_industry_matrix").Msg("MarketIntel query error")
	}

	for _, dr := range devRows {
		parts := strings.Split(dr.DimVal, "|")
		devOS := dr.DimVal
		pType := "all"
		if len(parts) >= 2 {
			devOS = parts[0]
			pType = parts[1]
		}
		summary.DeviceIndustryMatrix = append(summary.DeviceIndustryMatrix, DeviceIndustryMetric{
			DeviceOS:       devOS,
			ProductType:    pType,
			Views:          dr.Views,
			TotalActions:   dr.TotalActions,
			ConversionRate: clampRate(dr.TotalActions, dr.Views),
		})
	}

	// 9. Merchandising / Catalog Quality Benchmarks (pre-aggregated pda & dialect-safe JSON check)
	type QualityRow struct {
		MultiImgViews    int64 `gorm:"column:multi_img_views"`
		MultiImgActions  int64 `gorm:"column:multi_img_actions"`
		SingleImgViews   int64 `gorm:"column:single_img_views"`
		SingleImgActions int64 `gorm:"column:single_img_actions"`
		VideoViews       int64 `gorm:"column:video_views"`
		VideoActions     int64 `gorm:"column:video_actions"`
		NoVideoViews     int64 `gorm:"column:no_video_views"`
		NoVideoActions   int64 `gorm:"column:no_video_actions"`
		TotalActive      int64 `gorm:"column:total_active"`
		RekberActive     int64 `gorm:"column:rekber_active"`
	}
	var qRow QualityRow
	rekberExpr := "p.detailed_info->>'rekber_enabled' = 'true'"
	if db.Dialector != nil && db.Dialector.Name() != "postgres" {
		rekberExpr = "(json_extract(p.detailed_info, '$.rekber_enabled') = 'true' OR json_extract(p.detailed_info, '$.rekber_enabled') = 1)"
	}
	qualitySQL := fmt.Sprintf(`
		SELECT 
			COALESCE(SUM(CASE WHEN p.img_cnt >= 4 THEN COALESCE(pda.views, 0) ELSE 0 END), 0) as multi_img_views,
			COALESCE(SUM(CASE WHEN p.img_cnt >= 4 THEN COALESCE(pda.total_actions, 0) ELSE 0 END), 0) as multi_img_actions,
			COALESCE(SUM(CASE WHEN p.img_cnt <= 1 THEN COALESCE(pda.views, 0) ELSE 0 END), 0) as single_img_views,
			COALESCE(SUM(CASE WHEN p.img_cnt <= 1 THEN COALESCE(pda.total_actions, 0) ELSE 0 END), 0) as single_img_actions,
			COALESCE(SUM(CASE WHEN p.has_vid THEN COALESCE(pda.views, 0) ELSE 0 END), 0) as video_views,
			COALESCE(SUM(CASE WHEN p.has_vid THEN COALESCE(pda.total_actions, 0) ELSE 0 END), 0) as video_actions,
			COALESCE(SUM(CASE WHEN NOT p.has_vid THEN COALESCE(pda.views, 0) ELSE 0 END), 0) as no_video_views,
			COALESCE(SUM(CASE WHEN NOT p.has_vid THEN COALESCE(pda.total_actions, 0) ELSE 0 END), 0) as no_video_actions,
			COUNT(DISTINCT p.id) as total_active,
			COUNT(DISTINCT CASE WHEN %s THEN p.id END) as rekber_active
		FROM (
			SELECT id, 
				(CASE WHEN video_url IS NOT NULL AND TRIM(video_url) != '' THEN 1 ELSE 0 END) = 1 as has_vid,
				(SELECT COUNT(*) FROM product_images WHERE product_id = products.id) as img_cnt,
				detailed_info
			FROM products
			WHERE is_active = true
		) p
		LEFT JOIN (
			SELECT product_id, SUM(views) as views, SUM(total_actions) as total_actions
			FROM product_daily_analytics
			WHERE date >= ?
			GROUP BY product_id
		) pda ON pda.product_id = p.id
	`, rekberExpr)
	if err := db.Raw(qualitySQL, startDate).Scan(&qRow).Error; err != nil {
		log.Warn().Err(err).Str("section", "catalog_quality_benchmarks").Msg("MarketIntel query error")
	}

	multiConv := clampRate(qRow.MultiImgActions, qRow.MultiImgViews)
	singleConv := clampRate(qRow.SingleImgActions, qRow.SingleImgViews)
	videoConv := 0.0
	if qRow.VideoViews > 0 {
		videoConv = float64(qRow.VideoActions) / float64(qRow.VideoViews)
	}
	noVideoConv := 0.0
	if qRow.NoVideoViews > 0 {
		noVideoConv = float64(qRow.NoVideoActions) / float64(qRow.NoVideoViews)
	}
	videoBoost := 1.0
	if noVideoConv > 0 && videoConv > 0 {
		videoBoost = math.Round((videoConv/noVideoConv)*100) / 100
	}
	rekberRate := clampRate(qRow.RekberActive, qRow.TotalActive)

	summary.CatalogQualityBenchmarks = CatalogQualityMetrics{
		MultiPhotoConversionRate:  multiConv,
		SinglePhotoConversionRate: singleConv,
		VideoBoostMultiplier:      videoBoost,
		RekberTrustAdoptionRate:   rekberRate,
	}

	// 10. Supply-Side Dynamics (Price Increases vs Decreases, New Listings)
	type SupplyRow struct {
		DimVal string `gorm:"column:dimension_value"`
		Cnt    int64  `gorm:"column:cnt"`
	}
	var sRows []SupplyRow
	_ = db.Raw(`
		SELECT dimension_value, SUM(views) as cnt
		FROM store_daily_audience_metrics
		WHERE store_id = 0 AND dimension_type IN ('supply_price_delta', 'supply_stock_turn') AND date >= ?
		GROUP BY dimension_value
	`, startDate).Scan(&sRows).Error

	var incCount, decCount, newListings int64
	for _, sr := range sRows {
		if strings.Contains(sr.DimVal, "up_") {
			incCount += sr.Cnt
		} else if strings.Contains(sr.DimVal, "down_") {
			decCount += sr.Cnt
		}
		if strings.Contains(sr.DimVal, "new_listing") {
			newListings += sr.Cnt
		}
	}
	totalPriceEvents := incCount + decCount
	incRatio := 0.0
	decRatio := 0.0
	if totalPriceEvents > 0 {
		incRatio = math.Round((float64(incCount)/float64(totalPriceEvents))*1000) / 10
		decRatio = math.Round((float64(decCount)/float64(totalPriceEvents))*1000) / 10
	}

	// Empirical sold-out velocity (average days from listing creation to sold_out update over last 30 days; 0 if no samples).
	soldOutVelocityDays := 0.0
	type soldOutSample struct {
		CreatedAt time.Time `gorm:"column:created_at"`
		UpdatedAt time.Time `gorm:"column:updated_at"`
	}
	var soldSamples []soldOutSample
	cutoff30d := time.Now().UTC().AddDate(0, 0, -30)
	if err := db.Model(&models.Product{}).
		Select("created_at, updated_at").
		Where("conservation_status = ? AND updated_at >= ?", "sold_out", cutoff30d).
		Order("updated_at DESC").
		Limit(500).
		Find(&soldSamples).Error; err == nil && len(soldSamples) > 0 {
		totalDays := 0.0
		validSamples := 0
		for _, sm := range soldSamples {
			if !sm.CreatedAt.IsZero() && !sm.UpdatedAt.Before(sm.CreatedAt) {
				totalDays += sm.UpdatedAt.Sub(sm.CreatedAt).Hours() / 24.0
				validSamples++
			}
		}
		if validSamples > 0 {
			soldOutVelocityDays = math.Round((totalDays/float64(validSamples))*10) / 10
		}
	}

	summary.SupplySideDynamics = SupplyDynamicsMetrics{
		PriceIncreaseRatio:     incRatio,
		PriceDecreaseRatio:     decRatio,
		SoldOutVelocityAvgDays: soldOutVelocityDays,
		NewListings30D:         newListings,
	}

	// 11. Top Search Demand Gaps
	type GapRow struct {
		Keyword      string  `gorm:"column:keyword"`
		ProductType  string  `gorm:"column:product_type"`
		SearchVolume int64   `gorm:"column:search_volume"`
		ZeroCount    int64   `gorm:"column:zero_count"`
		CTR          float64 `gorm:"column:ctr"`
	}
	var gapRows []GapRow
	if err := db.Raw(`
		SELECT 
			keyword,
			COALESCE(NULLIF(product_type, ''), 'all') as product_type,
			SUM(search_volume) as search_volume,
			SUM(zero_result_count) as zero_count,
			CASE WHEN SUM(search_volume) > 0 THEN
				CASE WHEN (CAST(SUM(clicked_product_count) AS DOUBLE PRECISION) / CAST(SUM(search_volume) AS DOUBLE PRECISION)) * 100.0 > 100.0
				THEN 100.0
				ELSE (CAST(SUM(clicked_product_count) AS DOUBLE PRECISION) / CAST(SUM(search_volume) AS DOUBLE PRECISION)) * 100.0
				END
			ELSE 0 END as ctr
		FROM search_daily_rollups
		WHERE date >= ?
		GROUP BY keyword, COALESCE(NULLIF(product_type, ''), 'all')
		HAVING SUM(zero_result_count) > 0
		ORDER BY zero_count DESC
		LIMIT 10
	`, startDate).Scan(&gapRows).Error; err != nil {
		log.Warn().Err(err).Str("section", "demand_gaps_rollup").Msg("MarketIntel query error")
	}

	if len(gapRows) == 0 {
		if err := db.Raw(`
			SELECT 
				clean_keyword as keyword,
				COALESCE(NULLIF(product_type, ''), 'all') as product_type,
				COUNT(*) as search_volume,
				SUM(CASE WHEN is_zero_result THEN 1 ELSE 0 END) as zero_count,
				0 as ctr
			FROM search_analytics
			WHERE date >= ?
			GROUP BY clean_keyword, COALESCE(NULLIF(product_type, ''), 'all')
			HAVING SUM(CASE WHEN is_zero_result THEN 1 ELSE 0 END) > 0
			ORDER BY zero_count DESC
			LIMIT 10
		`, startDate).Scan(&gapRows).Error; err != nil {
			log.Warn().Err(err).Str("section", "demand_gaps_raw").Msg("MarketIntel query error")
		}
	}

	for _, gr := range gapRows {
		ctrVal := math.Round(gr.CTR*100) / 100
		if ctrVal > 100.0 {
			ctrVal = 100.0
		} else if ctrVal < 0 {
			ctrVal = 0
		}
		summary.TopSearchDemandGaps = append(summary.TopSearchDemandGaps, SearchDemandGapItem{
			Keyword:      gr.Keyword,
			ProductType:  gr.ProductType,
			SearchVolume: gr.SearchVolume,
			ZeroCount:    gr.ZeroCount,
			CTR:          ctrVal,
		})
	}

	globalMarketIntelCache.mu.Lock()
	globalMarketIntelCache.summary = summary
	globalMarketIntelCache.cachedAt = time.Now().Unix()
	globalMarketIntelCache.mu.Unlock()

	return summary, nil
}

func sanitizeMarketCSVCell(s string) string {
	return SanitizeCSVField(s)
}

// GenerateMarketIntelligenceCSV builds a comprehensive, multi-section downloadable CSV dataset for B2B intelligence.
func GenerateMarketIntelligenceCSV(db *gorm.DB) ([]byte, error) {
	summary, err := GetMacroMarketSummary(db)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	// Write UTF-8 BOM so Microsoft Excel on Windows/Mac renders Indonesian characters reliably
	_, _ = buf.Write([]byte("\xef\xbb\xbf"))
	w := csv.NewWriter(&buf)

	// Header comments
	_ = w.Write([]string{"# CATAVOR ANONYMIZED MARKET INTELLIGENCE REPORT"})
	_ = w.Write([]string{"# Generated At", sanitizeMarketCSVCell(summary.GeneratedAt)})
	_ = w.Write([]string{"# Privacy Threshold", sanitizeMarketCSVCell(fmt.Sprintf("K-Anonymity >= %d unique stores", summary.KAnonymityMinStores))})
	_ = w.Write([]string{"# Compliance", sanitizeMarketCSVCell(summary.DataPrivacyNotice)})
	_ = w.Write([]string{""})

	// Section 1: Macro Metrics
	_ = w.Write([]string{"SECTION 1: MACRO MARKET METRICS", ""})
	_ = w.Write([]string{"METRIC", "VALUE"})
	_ = w.Write([]string{"Total Active Stores", strconv.FormatInt(summary.TotalActiveStores, 10)})
	_ = w.Write([]string{"Total Active Products", strconv.FormatInt(summary.TotalActiveProducts, 10)})
	_ = w.Write([]string{"Total Views (30D)", strconv.FormatInt(summary.TotalViews30D, 10)})
	_ = w.Write([]string{"Total Actions (30D)", strconv.FormatInt(summary.TotalActions30D, 10)})
	_ = w.Write([]string{"Overall Conversion Rate (%)", fmt.Sprintf("%.2f", summary.OverallConversionRate)})
	_ = w.Write([]string{"Direct WA Conversion (%)", fmt.Sprintf("%.2f", summary.ChannelBreakdown.DirectWAPercent)})
	_ = w.Write([]string{"Marketplace Conversion (%)", fmt.Sprintf("%.2f", summary.ChannelBreakdown.MarketplacePercent)})
	_ = w.Write([]string{"Rekber Conversion (%)", fmt.Sprintf("%.2f", summary.ChannelBreakdown.RekberPercent)})
	_ = w.Write([]string{""})

	// Section 2: Category Benchmarks
	_ = w.Write([]string{"SECTION 2: CATEGORY PERFORMANCE BENCHMARKS", "", "", "", "", ""})
	_ = w.Write([]string{"CATEGORY", "PRODUCT_COUNT", "AVG_PRICE_IDR", "VIEWS_30D", "ACTIONS_30D", "CONVERSION_RATE_PCT"})
	for _, c := range summary.TopCategories {
		_ = w.Write([]string{
			sanitizeMarketCSVCell(c.CategoryName),
			strconv.FormatInt(c.ProductCount, 10),
			fmt.Sprintf("%.0f", c.AveragePrice),
			strconv.FormatInt(c.TotalViews, 10),
			strconv.FormatInt(c.TotalActions, 10),
			fmt.Sprintf("%.2f", c.ConversionRate),
		})
	}
	_ = w.Write([]string{""})

	// Section 3: Price Benchmarks (Quartiles & K-Anonymity)
	_ = w.Write([]string{"SECTION 3: PRICE DISTRIBUTION & QUARTILES (K-ANONYMOUS >= 3 UNIQUE STORES)", "", "", "", "", "", "", "", "", ""})
	_ = w.Write([]string{"INDUSTRY_TYPE", "CATEGORY", "MIN_PRICE_IDR", "P25_PRICE_IDR", "AVG_PRICE_IDR", "MEDIAN_PRICE_IDR", "P75_PRICE_IDR", "MAX_PRICE_IDR", "SAMPLE_SIZE", "UNIQUE_STORES"})
	for _, p := range summary.PriceBenchmarks {
		_ = w.Write([]string{
			sanitizeMarketCSVCell(p.ProductType),
			sanitizeMarketCSVCell(p.CategoryName),
			fmt.Sprintf("%.0f", p.MinPrice),
			fmt.Sprintf("%.0f", p.P25Price),
			fmt.Sprintf("%.0f", p.AvgPrice),
			fmt.Sprintf("%.0f", p.MedianPrice),
			fmt.Sprintf("%.0f", p.P75Price),
			fmt.Sprintf("%.0f", p.MaxPrice),
			strconv.FormatInt(p.SampleCount, 10),
			strconv.FormatInt(p.UniqueStoreCount, 10),
		})
	}
	_ = w.Write([]string{""})

	// Section 4: Price-Bracket Conversion Elasticity
	if len(summary.PriceBracketElasticity) > 0 {
		_ = w.Write([]string{"SECTION 4: PRICE-BRACKET CONVERSION ELASTICITY", "", "", "", ""})
		_ = w.Write([]string{"INDUSTRY_TYPE", "PRICE_BRACKET", "VIEWS", "ACTIONS", "CONVERSION_RATE_PCT"})
		for _, pb := range summary.PriceBracketElasticity {
			_ = w.Write([]string{
				sanitizeMarketCSVCell(pb.ProductType),
				sanitizeMarketCSVCell(pb.Bracket),
				strconv.FormatInt(pb.Views, 10),
				strconv.FormatInt(pb.TotalActions, 10),
				fmt.Sprintf("%.2f", pb.ConversionRate),
			})
		}
		_ = w.Write([]string{""})
	}

	// Section 5: Geo-Industry Matrix
	if len(summary.GeoIndustryMatrix) > 0 {
		_ = w.Write([]string{"SECTION 5: TOP CITY & INDUSTRY DEMAND MATRIX", "", "", "", ""})
		_ = w.Write([]string{"CITY", "INDUSTRY_TYPE", "VIEWS", "ACTIONS", "CONVERSION_RATE_PCT"})
		for _, gi := range summary.GeoIndustryMatrix {
			_ = w.Write([]string{
				sanitizeMarketCSVCell(gi.City),
				sanitizeMarketCSVCell(gi.ProductType),
				strconv.FormatInt(gi.Views, 10),
				strconv.FormatInt(gi.TotalActions, 10),
				fmt.Sprintf("%.2f", gi.ConversionRate),
			})
		}
		_ = w.Write([]string{""})
	}

	// Section 6: Search Demand Gaps
	if len(summary.TopSearchDemandGaps) > 0 {
		_ = w.Write([]string{"SECTION 6: SEARCH DEMAND GAPS (UNMET MARKET DEMAND)", "", "", "", ""})
		_ = w.Write([]string{"KEYWORD", "INDUSTRY_TYPE", "SEARCH_VOLUME", "ZERO_RESULT_COUNT", "TRUE_CTR_PCT"})
		for _, sg := range summary.TopSearchDemandGaps {
			_ = w.Write([]string{
				sanitizeMarketCSVCell(sg.Keyword),
				sanitizeMarketCSVCell(sg.ProductType),
				strconv.FormatInt(sg.SearchVolume, 10),
				strconv.FormatInt(sg.ZeroCount, 10),
				fmt.Sprintf("%.2f", sg.CTR),
			})
		}
		_ = w.Write([]string{""})
	}

	// Section 7: Catalog Quality Impact Benchmarks
	_ = w.Write([]string{"SECTION 7: MERCHANDISING QUALITY & TRUST IMPACT", ""})
	_ = w.Write([]string{"METRIC", "VALUE"})
	_ = w.Write([]string{"Multi-Photo Catalog Conversion (4+ Photos) (%)", fmt.Sprintf("%.2f", summary.CatalogQualityBenchmarks.MultiPhotoConversionRate)})
	_ = w.Write([]string{"Single-Photo Catalog Conversion (1 Photo) (%)", fmt.Sprintf("%.2f", summary.CatalogQualityBenchmarks.SinglePhotoConversionRate)})
	_ = w.Write([]string{"Video Presence Conversion Multiplier", fmt.Sprintf("%.2fx", summary.CatalogQualityBenchmarks.VideoBoostMultiplier)})
	_ = w.Write([]string{"Rekber Syariah Trust Adoption Rate (%)", fmt.Sprintf("%.1f", summary.CatalogQualityBenchmarks.RekberTrustAdoptionRate)})
	_ = w.Write([]string{"Supply Price Increase Ratio (%)", fmt.Sprintf("%.1f", summary.SupplySideDynamics.PriceIncreaseRatio)})
	_ = w.Write([]string{"Supply Price Decrease Ratio (%)", fmt.Sprintf("%.1f", summary.SupplySideDynamics.PriceDecreaseRatio)})

	w.Flush()
	return buf.Bytes(), nil
}
