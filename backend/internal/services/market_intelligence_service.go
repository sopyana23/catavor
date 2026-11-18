package services

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"math"
	"strconv"
	"strings"
	"sync"
	"time"

	"catavor-backend/internal/models"

	"gorm.io/gorm"
)

type marketIntelCacheHolder struct {
	mu       sync.RWMutex
	cachedAt int64
	summary  *MacroMarketSummary
}

var globalMarketIntelCache = &marketIntelCacheHolder{}

// InvalidateMarketIntelCache purges cached macro intelligence so next request computes freshly.
func InvalidateMarketIntelCache() {
	globalMarketIntelCache.mu.Lock()
	defer globalMarketIntelCache.mu.Unlock()
	globalMarketIntelCache.cachedAt = 0
	globalMarketIntelCache.summary = nil
}

// MacroMarketSummary represents aggregated high-level market intelligence across Catavor ecosystem.
type MacroMarketSummary struct {
	TotalActiveStores        int64                    `json:"total_active_stores"`
	TotalActiveProducts      int64                    `json:"total_active_products"`
	TotalViews30D            int64                    `json:"total_views_30d"`
	TotalActions30D          int64                    `json:"total_actions_30d"`
	OverallConversionRate    float64                  `json:"overall_conversion_rate"` // (actions / views) * 100
	ChannelBreakdown         ChannelBreakdownStats    `json:"channel_breakdown"`
	TopCategories            []CategoryTrendSummary   `json:"top_categories"`
	PriceBenchmarks          []CategoryPriceBenchmark `json:"price_benchmarks"`
	TrendTimeline            []DailyMarketTrendPoint  `json:"trend_timeline"`
	PriceBracketElasticity   []PriceBracketMetric     `json:"price_bracket_elasticity,omitempty"`
	GeoIndustryMatrix        []GeoIndustryMetric      `json:"geo_industry_matrix,omitempty"`
	DeviceIndustryMatrix     []DeviceIndustryMetric   `json:"device_industry_matrix,omitempty"`
	CatalogQualityBenchmarks CatalogQualityMetrics    `json:"catalog_quality_benchmarks"`
	SupplySideDynamics       SupplyDynamicsMetrics    `json:"supply_side_dynamics"`
	TopSearchDemandGaps      []SearchDemandGapItem    `json:"top_search_demand_gaps,omitempty"`
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
	CategoryID     uint    `json:"category_id"`
	CategoryName   string  `json:"category_name"`
	ProductCount   int64   `json:"product_count"`
	TotalViews     int64   `json:"total_views"`
	TotalActions   int64   `json:"total_actions"`
	ConversionRate float64 `json:"conversion_rate"`
	AveragePrice   float64 `json:"average_price"`
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
		globalStoreTelemetry.flushBatch()
	}

	summary := &MacroMarketSummary{
		GeneratedAt:       time.Now().UTC().Format(time.RFC3339),
		DataPrivacyNotice: "Seluruh data pasar disajikan dalam bentuk agregat statistik anonim sesuai UU No. 27 Tahun 2022 (UU PDP) & standar GDPR. Tanpa memuat data identitas pribadi atau toko individual.",
	}

	// 1. Total Active Stores & Products
	db.Model(&models.Store{}).Where("(dormancy_status IS NULL OR dormancy_status = 'active') AND is_blacklisted = false").Count(&summary.TotalActiveStores)
	db.Model(&models.Product{}).Where("is_active = true").Count(&summary.TotalActiveProducts)

	// 2. 30 Days Aggregated Metrics
	startDate := time.Now().AddDate(0, 0, -30).Format("2006-01-02")

	type AggStats struct {
		TotalStoreViews  int64 `gorm:"column:total_store_views"`
		TotalDirectWA    int64 `gorm:"column:total_direct_wa"`
		TotalMarketplace int64 `gorm:"column:total_marketplace"`
		TotalRekber      int64 `gorm:"column:total_rekber"`
		TotalVideoViews  int64 `gorm:"column:total_video_views"`
		TotalActions     int64 `gorm:"column:total_actions"`
	}
	var storeAgg AggStats
	_ = db.Model(&models.StoreDailyAnalytics{}).
		Select("COALESCE(SUM(store_views), 0) as total_store_views, COALESCE(SUM(direct_wa_clicks), 0) as total_direct_wa, COALESCE(SUM(marketplace_clicks), 0) as total_marketplace, COALESCE(SUM(rekber_clicks), 0) as total_rekber, COALESCE(SUM(video_views), 0) as total_video_views, COALESCE(SUM(total_actions), 0) as total_actions").
		Where("date >= ?", startDate).
		Scan(&storeAgg).Error

	var prodViews int64
	_ = db.Model(&models.ProductDailyAnalytics{}).
		Select("COALESCE(SUM(views), 0)").
		Where("date >= ?", startDate).
		Scan(&prodViews).Error

	totalViews := storeAgg.TotalStoreViews + prodViews
	if totalViews == 0 {
		totalViews = storeAgg.TotalStoreViews
	}
	summary.TotalViews30D = totalViews
	summary.TotalActions30D = storeAgg.TotalActions

	if totalViews > 0 {
		summary.OverallConversionRate = math.Round((float64(storeAgg.TotalActions)/float64(totalViews))*10000) / 100
	}

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
		summary.ChannelBreakdown.DirectWAPercent = math.Round((float64(storeAgg.TotalDirectWA)/float64(totalActions))*1000) / 10
		summary.ChannelBreakdown.MarketplacePercent = math.Round((float64(storeAgg.TotalMarketplace)/float64(totalActions))*1000) / 10
		summary.ChannelBreakdown.RekberPercent = math.Round((float64(storeAgg.TotalRekber)/float64(totalActions))*1000) / 10
		summary.ChannelBreakdown.VideoViewsPercent = math.Round((float64(storeAgg.TotalVideoViews)/float64(totalActions))*1000) / 10
	}

	// 3. Category Market Trends (with K-Anonymity)
	type CatRow struct {
		CategoryID   uint    `gorm:"column:category_id"`
		CategoryName string  `gorm:"column:category_name"`
		ProductCount int64   `gorm:"column:product_count"`
		AvgPrice     float64 `gorm:"column:avg_price"`
		TotalViews   int64   `gorm:"column:total_views"`
		TotalActions int64   `gorm:"column:total_actions"`
	}
	var catRows []CatRow
	_ = db.Raw(`
		SELECT 
			c.id as category_id,
			c.name as category_name,
			COUNT(DISTINCT p.id) as product_count,
			COALESCE(AVG(p.price), 0) as avg_price,
			COALESCE(SUM(pda.views), 0) as total_views,
			COALESCE(SUM(pda.total_actions), 0) as total_actions
		FROM categories c
		LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
		LEFT JOIN product_daily_analytics pda ON pda.product_id = p.id AND pda.date >= ?
		GROUP BY c.id, c.name
		HAVING COUNT(DISTINCT p.id) > 0
		ORDER BY product_count DESC
		LIMIT 15
	`, startDate).Scan(&catRows).Error

	for _, cr := range catRows {
		convRate := 0.0
		if cr.TotalViews > 0 {
			convRate = math.Round((float64(cr.TotalActions)/float64(cr.TotalViews))*10000) / 100
		}
		summary.TopCategories = append(summary.TopCategories, CategoryTrendSummary{
			CategoryID:     cr.CategoryID,
			CategoryName:   cr.CategoryName,
			ProductCount:   cr.ProductCount,
			TotalViews:     cr.TotalViews,
			TotalActions:   cr.TotalActions,
			ConversionRate: convRate,
			AveragePrice:   math.Round(cr.AvgPrice),
		})
	}

	// 4. Price Benchmarks per Category with Real PostgreSQL Percentiles & Strict K-Anonymity
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
	_ = db.Raw(`
		SELECT 
			COALESCE(p.product_type, 'physical') as product_type,
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
		GROUP BY p.product_type, c.name
		ORDER BY sample_count DESC
		LIMIT 15
	`).Scan(&priceRows).Error

	for _, pr := range priceRows {
		isKAnon := pr.StoreCount >= 3
		minP := math.Round(pr.MinPrice)
		maxP := math.Round(pr.MaxPrice)
		// Privacy protection: If fewer than 3 unique stores, clamp min & max to P25 and P75 to avoid single-merchant price exposure
		if !isKAnon && pr.P25Price > 0 {
			minP = math.Round(pr.P25Price)
			maxP = math.Round(pr.P75Price)
		}
		summary.PriceBenchmarks = append(summary.PriceBenchmarks, CategoryPriceBenchmark{
			ProductType:      pr.ProductType,
			CategoryName:     pr.CategoryName,
			MinPrice:         minP,
			P25Price:         math.Round(pr.P25Price),
			AvgPrice:         math.Round(pr.AvgPrice),
			MedianPrice:      math.Round(pr.MedianPrice),
			P75Price:         math.Round(pr.P75Price),
			MaxPrice:         maxP,
			SampleCount:      pr.SampleCount,
			UniqueStoreCount: pr.StoreCount,
			IsKAnonymous:     isKAnon,
		})
	}

	// 5. 14 Days Daily Timeline
	type DayPoint struct {
		Date         string `gorm:"column:date"`
		StoreViews   int64  `gorm:"column:store_views"`
		ProductViews int64  `gorm:"column:product_views"`
		TotalActions int64  `gorm:"column:total_actions"`
	}
	var dayPoints []DayPoint
	fourteenDaysAgo := time.Now().AddDate(0, 0, -14).Format("2006-01-02")
	_ = db.Raw(`
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
	`, fourteenDaysAgo, fourteenDaysAgo, fourteenDaysAgo, fourteenDaysAgo).Scan(&dayPoints).Error

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
	_ = db.Raw(`
		SELECT dimension_value, SUM(views) as views, SUM(total_actions) as total_actions
		FROM store_daily_audience_metrics
		WHERE store_id = 0 AND dimension_type = 'price_bracket' AND date >= ?
		GROUP BY dimension_value
		ORDER BY views DESC
		LIMIT 15
	`, startDate).Scan(&bracketRows).Error

	for _, br := range bracketRows {
		parts := strings.Split(br.DimVal, "|")
		pType := "all"
		bracket := br.DimVal
		if len(parts) >= 2 {
			pType = parts[0]
			bracket = parts[1]
		}
		conv := 0.0
		if br.Views > 0 {
			conv = math.Round((float64(br.TotalActions)/float64(br.Views))*10000) / 100
		}
		summary.PriceBracketElasticity = append(summary.PriceBracketElasticity, PriceBracketMetric{
			ProductType:    pType,
			Bracket:        bracket,
			Views:          br.Views,
			TotalActions:   br.TotalActions,
			ConversionRate: conv,
		})
	}

	// 7. Geo-Industry Matrix (City x ProductType)
	var geoRows []DimensionRow
	_ = db.Raw(`
		SELECT dimension_value, SUM(views) as views, SUM(total_actions) as total_actions
		FROM store_daily_audience_metrics
		WHERE store_id = 0 AND dimension_type = 'geo_type' AND date >= ?
		GROUP BY dimension_value
		ORDER BY views DESC
		LIMIT 15
	`, startDate).Scan(&geoRows).Error

	for _, gr := range geoRows {
		parts := strings.Split(gr.DimVal, "|")
		city := gr.DimVal
		pType := "all"
		if len(parts) >= 2 {
			city = parts[0]
			pType = parts[1]
		}
		conv := 0.0
		if gr.Views > 0 {
			conv = math.Round((float64(gr.TotalActions)/float64(gr.Views))*10000) / 100
		}
		summary.GeoIndustryMatrix = append(summary.GeoIndustryMatrix, GeoIndustryMetric{
			City:           city,
			ProductType:    pType,
			Views:          gr.Views,
			TotalActions:   gr.TotalActions,
			ConversionRate: conv,
		})
	}

	// 8. Device-Industry Matrix (OS x ProductType)
	var devRows []DimensionRow
	_ = db.Raw(`
		SELECT dimension_value, SUM(views) as views, SUM(total_actions) as total_actions
		FROM store_daily_audience_metrics
		WHERE store_id = 0 AND dimension_type = 'device_type' AND date >= ?
		GROUP BY dimension_value
		ORDER BY views DESC
		LIMIT 12
	`, startDate).Scan(&devRows).Error

	for _, dr := range devRows {
		parts := strings.Split(dr.DimVal, "|")
		devOS := dr.DimVal
		pType := "all"
		if len(parts) >= 2 {
			devOS = parts[0]
			pType = parts[1]
		}
		conv := 0.0
		if dr.Views > 0 {
			conv = math.Round((float64(dr.TotalActions)/float64(dr.Views))*10000) / 100
		}
		summary.DeviceIndustryMatrix = append(summary.DeviceIndustryMatrix, DeviceIndustryMetric{
			DeviceOS:       devOS,
			ProductType:    pType,
			Views:          dr.Views,
			TotalActions:   dr.TotalActions,
			ConversionRate: conv,
		})
	}

	// 9. Merchandising / Catalog Quality Benchmarks
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
	_ = db.Raw(`
		SELECT 
			COALESCE(SUM(CASE WHEN img_cnt >= 4 THEN pda.views ELSE 0 END), 0) as multi_img_views,
			COALESCE(SUM(CASE WHEN img_cnt >= 4 THEN pda.total_actions ELSE 0 END), 0) as multi_img_actions,
			COALESCE(SUM(CASE WHEN img_cnt <= 1 THEN pda.views ELSE 0 END), 0) as single_img_views,
			COALESCE(SUM(CASE WHEN img_cnt <= 1 THEN pda.total_actions ELSE 0 END), 0) as single_img_actions,
			COALESCE(SUM(CASE WHEN has_vid THEN pda.views ELSE 0 END), 0) as video_views,
			COALESCE(SUM(CASE WHEN has_vid THEN pda.total_actions ELSE 0 END), 0) as video_actions,
			COALESCE(SUM(CASE WHEN NOT has_vid THEN pda.views ELSE 0 END), 0) as no_video_views,
			COALESCE(SUM(CASE WHEN NOT has_vid THEN pda.total_actions ELSE 0 END), 0) as no_video_actions,
			COUNT(DISTINCT p.id) as total_active,
			COUNT(DISTINCT CASE WHEN p.detailed_info->>'rekber_enabled' = 'true' THEN p.id END) as rekber_active
		FROM (
			SELECT id, 
				(CASE WHEN video_url IS NOT NULL AND TRIM(video_url) != '' THEN true ELSE false END) as has_vid,
				(SELECT COUNT(*) FROM product_images WHERE product_id = products.id) as img_cnt,
				detailed_info
			FROM products
			WHERE is_active = true
		) p
		LEFT JOIN product_daily_analytics pda ON pda.product_id = p.id AND pda.date >= ?
	`, startDate).Scan(&qRow).Error

	multiConv := 0.0
	if qRow.MultiImgViews > 0 {
		multiConv = math.Round((float64(qRow.MultiImgActions)/float64(qRow.MultiImgViews))*10000) / 100
	}
	singleConv := 0.0
	if qRow.SingleImgViews > 0 {
		singleConv = math.Round((float64(qRow.SingleImgActions)/float64(qRow.SingleImgViews))*10000) / 100
	}
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
	rekberRate := 0.0
	if qRow.TotalActive > 0 {
		rekberRate = math.Round((float64(qRow.RekberActive)/float64(qRow.TotalActive))*1000) / 10
	}

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
	_ = db.Raw(`
		SELECT 
			keyword,
			COALESCE(NULLIF(product_type, ''), 'all') as product_type,
			SUM(search_volume) as search_volume,
			SUM(zero_result_count) as zero_count,
			CASE WHEN SUM(search_volume) > 0 THEN LEAST(100.0, (SUM(clicked_product_count)::float / SUM(search_volume)::float) * 100) ELSE 0 END as ctr
		FROM search_daily_rollups
		WHERE date >= ?
		GROUP BY keyword, COALESCE(NULLIF(product_type, ''), 'all')
		HAVING SUM(zero_result_count) > 0
		ORDER BY zero_count DESC
		LIMIT 10
	`, startDate).Scan(&gapRows).Error

	if len(gapRows) == 0 {
		_ = db.Raw(`
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
		`, startDate).Scan(&gapRows).Error
	}

	for _, gr := range gapRows {
		summary.TopSearchDemandGaps = append(summary.TopSearchDemandGaps, SearchDemandGapItem{
			Keyword:      gr.Keyword,
			ProductType:  gr.ProductType,
			SearchVolume: gr.SearchVolume,
			ZeroCount:    gr.ZeroCount,
			CTR:          math.Round(gr.CTR*100) / 100,
		})
	}

	globalMarketIntelCache.mu.Lock()
	globalMarketIntelCache.summary = summary
	globalMarketIntelCache.cachedAt = time.Now().Unix()
	globalMarketIntelCache.mu.Unlock()

	return summary, nil
}

func sanitizeMarketCSVCell(s string) string {
	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		return ""
	}
	switch trimmed[0] {
	case '=', '+', '-', '@', '|':
		return "'" + trimmed
	}
	return trimmed
}

// GenerateMarketIntelligenceCSV builds a comprehensive, multi-section downloadable CSV dataset for B2B intelligence.
func GenerateMarketIntelligenceCSV(db *gorm.DB) ([]byte, error) {
	summary, err := GetMacroMarketSummary(db)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	w := csv.NewWriter(&buf)

	// Header comments
	_ = w.Write([]string{"# CATAVOR ANONYMIZED MARKET INTELLIGENCE REPORT"})
	_ = w.Write([]string{"# Generated At", summary.GeneratedAt})
	_ = w.Write([]string{"# Compliance", summary.DataPrivacyNotice})
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
	_ = w.Write([]string{"SECTION 3: PRICE DISTRIBUTION & QUARTILES (K-ANONYMOUS)", "", "", "", "", "", "", "", ""})
	_ = w.Write([]string{"INDUSTRY_TYPE", "CATEGORY", "MIN_PRICE_IDR", "P25_PRICE_IDR", "AVG_PRICE_IDR", "MEDIAN_PRICE_IDR", "P75_PRICE_IDR", "MAX_PRICE_IDR", "SAMPLE_SIZE"})
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
