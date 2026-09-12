package services

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"math"
	"strconv"
	"time"

	"catavor-backend/internal/models"

	"gorm.io/gorm"
)

// MacroMarketSummary represents aggregated high-level market intelligence across Catavor ecosystem.
type MacroMarketSummary struct {
	TotalActiveStores     int64                    `json:"total_active_stores"`
	TotalActiveProducts   int64                    `json:"total_active_products"`
	TotalViews30D         int64                    `json:"total_views_30d"`
	TotalActions30D       int64                    `json:"total_actions_30d"`
	OverallConversionRate float64                  `json:"overall_conversion_rate"` // (actions / views) * 100
	ChannelBreakdown      ChannelBreakdownStats    `json:"channel_breakdown"`
	TopCategories         []CategoryTrendSummary   `json:"top_categories"`
	PriceBenchmarks       []CategoryPriceBenchmark `json:"price_benchmarks"`
	TrendTimeline         []DailyMarketTrendPoint  `json:"trend_timeline"`
	GeneratedAt           string                   `json:"generated_at"`
	DataPrivacyNotice     string                   `json:"data_privacy_notice"`
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
	CategoryName string  `json:"category_name"`
	MinPrice     float64 `json:"min_price"`
	AvgPrice     float64 `json:"avg_price"`
	MedianPrice  float64 `json:"median_price"`
	MaxPrice     float64 `json:"max_price"`
	SampleCount  int64   `json:"sample_count"`
}

type DailyMarketTrendPoint struct {
	Date         string `json:"date"`
	StoreViews   int64  `json:"store_views"`
	ProductViews int64  `json:"product_views"`
	TotalActions int64  `json:"total_actions"`
}

// GetMacroMarketSummary aggregates ecosystem-wide statistics ensuring strict K-Anonymity (Zero PII).
func GetMacroMarketSummary(db *gorm.DB) (*MacroMarketSummary, error) {
	summary := &MacroMarketSummary{
		GeneratedAt:       time.Now().UTC().Format(time.RFC3339),
		DataPrivacyNotice: "Seluruh data pasar disajikan dalam bentuk agregat statistik anonim sesuai UU No. 27 Tahun 2022 (UU PDP) & standar GDPR. Tanpa memuat data identitas pribadi atau toko individual.",
	}

	// 1. Total Active Stores & Products
	db.Model(&models.Store{}).Where("is_active = true AND status = 'active'").Count(&summary.TotalActiveStores)
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

	// 4. Price Benchmarks per Category
	type PriceBenchRow struct {
		CategoryName string  `gorm:"column:category_name"`
		MinPrice     float64 `gorm:"column:min_price"`
		AvgPrice     float64 `gorm:"column:avg_price"`
		MaxPrice     float64 `gorm:"column:max_price"`
		SampleCount  int64   `gorm:"column:sample_count"`
	}
	var priceRows []PriceBenchRow
	_ = db.Raw(`
		SELECT 
			COALESCE(c.name, 'Umum') as category_name,
			MIN(p.price) as min_price,
			AVG(p.price) as avg_price,
			MAX(p.price) as max_price,
			COUNT(p.id) as sample_count
		FROM products p
		LEFT JOIN categories c ON c.id = p.category_id
		WHERE p.is_active = true AND p.price > 0
		GROUP BY c.name
		HAVING COUNT(p.id) >= 1
		ORDER BY sample_count DESC
		LIMIT 10
	`).Scan(&priceRows).Error

	for _, pr := range priceRows {
		summary.PriceBenchmarks = append(summary.PriceBenchmarks, CategoryPriceBenchmark{
			CategoryName: pr.CategoryName,
			MinPrice:     math.Round(pr.MinPrice),
			AvgPrice:     math.Round(pr.AvgPrice),
			MedianPrice:  math.Round((pr.MinPrice + pr.MaxPrice) / 2),
			MaxPrice:     math.Round(pr.MaxPrice),
			SampleCount:  pr.SampleCount,
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

	return summary, nil
}

// GenerateMarketIntelligenceCSV builds a downloadable CSV dataset for B2B intelligence.
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
	_ = w.Write([]string{"CATEGORY", "PRODUCT_COUNT", "AVG_PRICE_IDR", "VIEWS_30D", "ACTIONS_30D", "CONVERSION_RATE_PCT"})
	for _, c := range summary.TopCategories {
		_ = w.Write([]string{
			c.CategoryName,
			strconv.FormatInt(c.ProductCount, 10),
			fmt.Sprintf("%.0f", c.AveragePrice),
			strconv.FormatInt(c.TotalViews, 10),
			strconv.FormatInt(c.TotalActions, 10),
			fmt.Sprintf("%.2f", c.ConversionRate),
		})
	}
	_ = w.Write([]string{""})

	// Section 3: Price Benchmarks
	_ = w.Write([]string{"CATEGORY", "MIN_PRICE_IDR", "AVG_PRICE_IDR", "MEDIAN_PRICE_IDR", "MAX_PRICE_IDR", "SAMPLE_SIZE"})
	for _, p := range summary.PriceBenchmarks {
		_ = w.Write([]string{
			p.CategoryName,
			fmt.Sprintf("%.0f", p.MinPrice),
			fmt.Sprintf("%.0f", p.AvgPrice),
			fmt.Sprintf("%.0f", p.MedianPrice),
			fmt.Sprintf("%.0f", p.MaxPrice),
			strconv.FormatInt(p.SampleCount, 10),
		})
	}

	w.Flush()
	return buf.Bytes(), nil
}
