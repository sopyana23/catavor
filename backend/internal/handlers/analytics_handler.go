package handlers

import (
	"crypto/sha256"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// In-memory sliding window deduplication cache
type dedupCache struct {
	mu      sync.RWMutex
	entries map[string]int64 // key -> timestamp unix seconds
}

var telemetryDedup = &dedupCache{
	entries: make(map[string]int64),
}

func (c *dedupCache) isDuplicate(key string, ttlSeconds int64) bool {
	now := time.Now().Unix()
	c.mu.Lock()
	defer c.mu.Unlock()

	// Periodic cleanup of expired keys if cache grows large
	if len(c.entries) > 10000 {
		for k, exp := range c.entries {
			if now-exp > 7200 { // 2 hours old
				delete(c.entries, k)
			}
		}
		// Hard cap protection: if still over 50,000 entries (massive scan/traffic spike), safely prune
		if len(c.entries) > 50000 {
			c.entries = make(map[string]int64)
		}
	}

	lastSeen, exists := c.entries[key]
	if exists && (now-lastSeen) < ttlSeconds {
		return true
	}

	c.entries[key] = now
	return false
}

type AnalyticsHandler struct {
	cfg *config.Config
}

func NewAnalyticsHandler(cfg *config.Config) *AnalyticsHandler {
	return &AnalyticsHandler{cfg: cfg}
}

type TrackEventRequest struct {
	StoreSlug   string                 `json:"store_slug"`
	Event       string                 `json:"event"`        // store_view | product_view | direct_wa_click | marketplace_click | rekber_click | video_view
	ProductID   uint                   `json:"product_id"`   // optional product ID
	ProductType string                 `json:"product_type"` // optional product type
	SessionID   string                 `json:"session_id"`   // Anonymous session token (CGNAT resilience)
	Source      string                 `json:"source"`       // instagram, tiktok, whatsapp, facebook, google, marketplace, direct, other
	Medium      string                 `json:"medium"`       // referral, bio, story, cpc, organic
	Campaign    string                 `json:"campaign"`     // utm_campaign
	HpCheck     string                 `json:"_hp_check"`    // honeypot field (must be empty)
	Metadata    map[string]interface{} `json:"metadata"`     // optional metadata (platform name, etc.)
}

// isBotOrCrawler checks User-Agent against standard automated crawler and bot signatures.
func isBotOrCrawler(ua string) bool {
	if ua == "" {
		return true
	}
	uaLower := strings.ToLower(ua)
	botPatterns := []string{
		"bot", "crawler", "spider", "slurp", "googlebot", "bingbot", "yandex",
		"baiduspider", "duckduckbot", "facebookexternalhit", "twitterbot",
		"rogerbot", "linkedinbot", "embedly", "quora link preview", "showyoubot",
		"outbrain", "pinterest", "slackbot", "vkshare", "w3c_validator",
		"headlesschrome", "phantomjs", "selenium", "puppeteer", "playwright",
		"curl", "wget", "python-requests", "python-urllib", "postmanruntime",
		"axios", "go-http-client", "node-fetch", "got/", "insomnia",
		"ahrefsbot", "semrushbot", "dotbot", "mj12bot", "screaming frog",
	}

	for _, pattern := range botPatterns {
		if strings.Contains(uaLower, pattern) {
			return true
		}
	}
	return false
}

// TrackEvent handles public non-blocking telemetry events with Bot Defense & Deduplication.
func (h *AnalyticsHandler) TrackEvent(c *fiber.Ctx) error {
	var req TrackEventRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Payload telemetry tidak valid.",
		})
	}

	// 1. Honeypot check: If bot filled the hidden honeypot trap, silently return OK
	if strings.TrimSpace(req.HpCheck) != "" {
		return c.JSON(fiber.Map{"success": true, "message": "Event tercatat."})
	}

	// 2. User-Agent Bot & Crawler Filtering
	ua := c.Get("User-Agent")
	if isBotOrCrawler(ua) {
		// Silently drop bot traffic without modifying merchant database metrics
		return c.JSON(fiber.Map{"success": true, "message": "Event tercatat."})
	}

	slug := strings.TrimSpace(strings.ToLower(req.StoreSlug))
	if slug == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "store_slug wajib diisi.",
		})
	}

	event := strings.TrimSpace(strings.ToLower(req.Event))
	// Normalize legacy events
	if event == "wa_click" || event == "product_wa_click" {
		event = "direct_wa_click"
	}
	if event == "" {
		event = "store_view"
	}

	db := database.DB

	// Find store by slug
	var store models.Store
	if err := db.Select("id, slug, user_id").Where("slug = ?", slug).First(&store).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Toko tidak ditemukan.",
		})
	}

	// 3. Sliding Window Deduplication per Client IP + UA + Store + Event + Product
	clientIP := c.IP()
	if xff := c.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			clientIP = strings.TrimSpace(parts[0])
		}
	}

	uaHash := fmt.Sprintf("%x", sha256.Sum256([]byte(ua)))[:12]
	sessionToken := strings.TrimSpace(req.SessionID)
	var dedupKey string
	if sessionToken != "" {
		dedupKey = fmt.Sprintf("%s:%s:%s:%d:%s:%d", clientIP, sessionToken, uaHash, store.ID, event, req.ProductID)
	} else {
		dedupKey = fmt.Sprintf("%s:%s:%d:%s:%d", clientIP, uaHash, store.ID, event, req.ProductID)
	}

	// TTL: 1 Hour (3600s) for view events; 30 seconds for action clicks to prevent rapid spam clicking
	ttl := int64(3600)
	if event != "store_view" && event != "product_view" {
		ttl = 30
	}

	if telemetryDedup.isDuplicate(dedupKey, ttl) {
		// Event within deduplication window, return OK without duplicating counters
		return c.JSON(fiber.Map{"success": true, "message": "Event tercatat."})
	}

	today := time.Now().Format("2006-01-02")

	// Extract and categorize traffic source
	cleanSource := strings.TrimSpace(strings.ToLower(req.Source))
	if cleanSource == "" && req.Metadata != nil {
		if src, ok := req.Metadata["source"].(string); ok {
			cleanSource = strings.TrimSpace(strings.ToLower(src))
		} else if ref, ok := req.Metadata["referrer"].(string); ok {
			cleanSource = strings.TrimSpace(strings.ToLower(ref))
		}
	}

	normSource := "direct"
	if strings.Contains(cleanSource, "instagram") || strings.Contains(cleanSource, "ig") {
		normSource = "instagram"
	} else if strings.Contains(cleanSource, "tiktok") {
		normSource = "tiktok"
	} else if strings.Contains(cleanSource, "whatsapp") || strings.Contains(cleanSource, "wa.me") {
		normSource = "whatsapp"
	} else if strings.Contains(cleanSource, "facebook") || strings.Contains(cleanSource, "fb") {
		normSource = "facebook"
	} else if strings.Contains(cleanSource, "google") {
		normSource = "google"
	} else if strings.Contains(cleanSource, "shopee") || strings.Contains(cleanSource, "tokopedia") || strings.Contains(cleanSource, "lazada") {
		normSource = "marketplace"
	} else if cleanSource != "" && !strings.Contains(cleanSource, "direct") && !strings.Contains(cleanSource, "catavor") && !strings.Contains(cleanSource, "localhost") {
		normSource = "other"
	}

	// 4a. Process traffic source daily analytics upsert
	trafficAssignments := map[string]interface{}{
		"updated_at": time.Now(),
	}
	initialTraffic := models.StoreDailyTrafficSource{
		StoreID: store.ID,
		Date:    today,
		Source:  normSource,
	}
	if event == "store_view" || event == "product_view" {
		trafficAssignments["views"] = gorm.Expr("store_daily_traffic_sources.views + 1")
		initialTraffic.Views = 1
	} else {
		trafficAssignments["total_actions"] = gorm.Expr("store_daily_traffic_sources.total_actions + 1")
		initialTraffic.TotalActions = 1
	}
	_ = db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "store_id"}, {Name: "date"}, {Name: "source"}},
		DoUpdates: clause.Assignments(trafficAssignments),
	}).Create(&initialTraffic).Error

	// 4b. Process store-level analytics upsert
	storeAssignments := map[string]interface{}{
		"updated_at": time.Now(),
	}
	initialStore := models.StoreDailyAnalytics{
		StoreID: store.ID,
		Date:    today,
	}

	switch event {
	case "store_view":
		storeAssignments["store_views"] = gorm.Expr("store_daily_analytics.store_views + 1")
		initialStore.StoreViews = 1
	case "direct_wa_click":
		storeAssignments["direct_wa_clicks"] = gorm.Expr("store_daily_analytics.direct_wa_clicks + 1")
		storeAssignments["wa_clicks"] = gorm.Expr("store_daily_analytics.wa_clicks + 1")
		storeAssignments["total_actions"] = gorm.Expr("store_daily_analytics.total_actions + 1")
		initialStore.DirectWaClicks = 1
		initialStore.WaClicks = 1
		initialStore.TotalActions = 1
	case "marketplace_clicks", "marketplace_click":
		event = "marketplace_click"
		storeAssignments["marketplace_clicks"] = gorm.Expr("store_daily_analytics.marketplace_clicks + 1")
		storeAssignments["total_actions"] = gorm.Expr("store_daily_analytics.total_actions + 1")
		initialStore.MarketplaceClicks = 1
		initialStore.TotalActions = 1
	case "rekber_clicks", "rekber_click":
		event = "rekber_click"
		storeAssignments["rekber_clicks"] = gorm.Expr("store_daily_analytics.rekber_clicks + 1")
		storeAssignments["total_actions"] = gorm.Expr("store_daily_analytics.total_actions + 1")
		initialStore.RekberClicks = 1
		initialStore.TotalActions = 1
	case "video_view", "video_views":
		event = "video_view"
		storeAssignments["video_views"] = gorm.Expr("store_daily_analytics.video_views + 1")
		storeAssignments["total_actions"] = gorm.Expr("store_daily_analytics.total_actions + 1")
		initialStore.VideoViews = 1
		initialStore.TotalActions = 1
	}

	_ = db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "store_id"}, {Name: "date"}},
		DoUpdates: clause.Assignments(storeAssignments),
	}).Create(&initialStore).Error

	// 5. Process product-level analytics if product_id is provided
	if req.ProductID > 0 {
		var product models.Product
		if err := db.Select("id, store_id, product_type").
			Where("id = ? AND store_id = ?", req.ProductID, store.ID).
			First(&product).Error; err == nil {

			pType := product.ProductType
			if pType == "" {
				pType = "physical"
			}

			prodAssignments := map[string]interface{}{
				"updated_at": time.Now(),
			}
			initialProd := models.ProductDailyAnalytics{
				StoreID:     store.ID,
				ProductID:   req.ProductID,
				ProductType: pType,
				Date:        today,
			}

			switch event {
			case "product_view", "store_view":
				prodAssignments["views"] = gorm.Expr("product_daily_analytics.views + 1")
				initialProd.Views = 1
				_ = db.Model(&models.Product{}).
					Where("id = ?", req.ProductID).
					UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error

			case "direct_wa_click":
				prodAssignments["direct_wa_clicks"] = gorm.Expr("product_daily_analytics.direct_wa_clicks + 1")
				prodAssignments["wa_clicks"] = gorm.Expr("product_daily_analytics.wa_clicks + 1")
				prodAssignments["total_actions"] = gorm.Expr("product_daily_analytics.total_actions + 1")
				initialProd.DirectWaClicks = 1
				initialProd.WaClicks = 1
				initialProd.TotalActions = 1
				_ = db.Model(&models.Product{}).
					Where("id = ?", req.ProductID).
					UpdateColumn("wa_clicks_count", gorm.Expr("wa_clicks_count + 1")).Error

			case "marketplace_click":
				prodAssignments["marketplace_clicks"] = gorm.Expr("product_daily_analytics.marketplace_clicks + 1")
				prodAssignments["total_actions"] = gorm.Expr("product_daily_analytics.total_actions + 1")
				initialProd.MarketplaceClicks = 1
				initialProd.TotalActions = 1
				_ = db.Model(&models.Product{}).
					Where("id = ?", req.ProductID).
					UpdateColumn("marketplace_clicks_count", gorm.Expr("marketplace_clicks_count + 1")).Error

			case "rekber_click":
				prodAssignments["rekber_clicks"] = gorm.Expr("product_daily_analytics.rekber_clicks + 1")
				prodAssignments["total_actions"] = gorm.Expr("product_daily_analytics.total_actions + 1")
				initialProd.RekberClicks = 1
				initialProd.TotalActions = 1
				_ = db.Model(&models.Product{}).
					Where("id = ?", req.ProductID).
					UpdateColumn("rekber_clicks_count", gorm.Expr("rekber_clicks_count + 1")).Error

			case "video_view":
				prodAssignments["video_views"] = gorm.Expr("product_daily_analytics.video_views + 1")
				prodAssignments["total_actions"] = gorm.Expr("product_daily_analytics.total_actions + 1")
				initialProd.VideoViews = 1
				initialProd.TotalActions = 1
				_ = db.Model(&models.Product{}).
					Where("id = ?", req.ProductID).
					UpdateColumn("video_views_count", gorm.Expr("video_views_count + 1")).Error
			}

			_ = db.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "product_id"}, {Name: "date"}},
				DoUpdates: clause.Assignments(prodAssignments),
			}).Create(&initialProd).Error
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Event tercatat.",
	})
}

type DailyMetricPoint struct {
	Date              string `json:"date"`
	StoreViews        int    `json:"store_views"`
	WaClicks          int    `json:"wa_clicks"`
	DirectWaClicks    int    `json:"direct_wa_clicks"`
	MarketplaceClicks int    `json:"marketplace_clicks"`
	RekberClicks      int    `json:"rekber_clicks"`
	VideoViews        int    `json:"video_views"`
	TotalActions      int    `json:"total_actions"`
}

type TopProductSummary struct {
	ID                     uint    `json:"id"`
	Name                   string  `json:"name"`
	ImageURL               string  `json:"image_url"`
	Price                  float64 `json:"price"`
	Class                  string  `json:"class"`
	ViewCount              int64   `json:"view_count"`
	WaClicksCount          int64   `json:"wa_clicks_count"`
	MarketplaceClicksCount int64   `json:"marketplace_clicks_count"`
	RekberClicksCount      int64   `json:"rekber_clicks_count"`
	VideoViewsCount        int64   `json:"video_views_count"`
	TotalActionsCount      int64   `json:"total_actions_count"`
	ConversionRatePercent  float64 `json:"conversion_rate_percent"`
	ProductType            string  `json:"product_type"`
}

type ProductTypeMetricSummary struct {
	ProductType           string  `json:"product_type"`
	TypeName              string  `json:"type_name"`
	ItemCount             int     `json:"item_count"`
	Views                 int64   `json:"views"`
	DirectWaClicks        int64   `json:"direct_wa_clicks"`
	MarketplaceClicks     int64   `json:"marketplace_clicks"`
	RekberClicks          int64   `json:"rekber_clicks"`
	VideoViews            int64   `json:"video_views"`
	TotalActions          int64   `json:"total_actions"`
	ConversionRatePercent float64 `json:"conversion_rate_percent"`
}

type CategoryMetricSummary struct {
	Category     string `json:"category"`
	Views        int64  `json:"views"`
	TotalActions int64  `json:"total_actions"`
	Items        int    `json:"items"`
}

type SmartInsight struct {
	Type        string `json:"type"`        // success | tip | warning
	Title       string `json:"title"`
	Description string `json:"description"`
}

type TrafficSourceSummary struct {
	Source                string  `json:"source"`
	Name                  string  `json:"name"`
	Views                 int     `json:"views"`
	TotalActions          int     `json:"total_actions"`
	Percentage            float64 `json:"percentage"`
	ConversionRatePercent float64 `json:"conversion_rate_percent"`
}

type PeriodGrowthSummary struct {
	StoreViewsGrowthPercent     float64 `json:"store_views_growth_percent"`
	TotalActionsGrowthPercent   float64 `json:"total_actions_growth_percent"`
	PrevStoreViews              int     `json:"prev_store_views"`
	PrevTotalActions            int     `json:"prev_total_actions"`
}

type ConversionFunnelSummary struct {
	StoreViews            int     `json:"store_views"`
	ProductViews          int     `json:"product_views"`
	TotalActions          int     `json:"total_actions"`
	ViewToProductRate     float64 `json:"view_to_product_rate"`
	ProductToActionRate   float64 `json:"product_to_action_rate"`
	OverallConversionRate float64 `json:"overall_conversion_rate"`
}

// GetStoreAnalytics returns aggregated stats, multi-channel metrics, product type breakdown, and actionable insights.
func (h *AnalyticsHandler) GetStoreAnalytics(c *fiber.Ctx) error {
	var store *models.Store
	if s, ok := c.Locals("store").(*models.Store); ok {
		store = s
	} else if sVal, ok := c.Locals("store").(models.Store); ok {
		store = &sVal
	}

	if store == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses toko tidak valid.",
		})
	}

	period := strings.ToLower(strings.TrimSpace(c.Query("period", "7d")))
	days := 7
	if period == "30d" {
		days = 30
	} else if period == "90d" {
		days = 90
	} else {
		period = "7d"
	}

	startDate := time.Now().AddDate(0, 0, -(days - 1)).Format("2006-01-02")
	db := database.DB

	// Query daily analytics for store
	var dailyRecords []models.StoreDailyAnalytics
	if err := db.Where("store_id = ? AND date >= ?", store.ID, startDate).
		Order("date ASC").
		Find(&dailyRecords).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil data statistik.",
		})
	}

	// Build map for quick lookup
	recordMap := make(map[string]models.StoreDailyAnalytics)
	totalStoreViews := 0
	totalDirectWa := 0
	totalMarketplace := 0
	totalRekber := 0
	totalVideo := 0
	totalActions := 0

	for _, r := range dailyRecords {
		recordMap[r.Date] = r
		totalStoreViews += r.StoreViews
		directWa := r.DirectWaClicks
		if directWa == 0 && r.WaClicks > 0 {
			directWa = r.WaClicks
		}
		totalDirectWa += directWa
		totalMarketplace += r.MarketplaceClicks
		totalRekber += r.RekberClicks
		totalVideo += r.VideoViews

		act := r.TotalActions
		if act == 0 {
			act = directWa + r.MarketplaceClicks + r.RekberClicks + r.VideoViews
		}
		totalActions += act
	}

	// Generate complete sequential date series (fills missing days with 0)
	trends := make([]DailyMetricPoint, 0, days)
	peakViews := 0
	peakDate := ""

	for i := days - 1; i >= 0; i-- {
		dt := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		if rec, exists := recordMap[dt]; exists {
			directWa := rec.DirectWaClicks
			if directWa == 0 && rec.WaClicks > 0 {
				directWa = rec.WaClicks
			}
			act := rec.TotalActions
			if act == 0 {
				act = directWa + rec.MarketplaceClicks + rec.RekberClicks + rec.VideoViews
			}

			trends = append(trends, DailyMetricPoint{
				Date:              dt,
				StoreViews:        rec.StoreViews,
				WaClicks:          rec.WaClicks,
				DirectWaClicks:    directWa,
				MarketplaceClicks: rec.MarketplaceClicks,
				RekberClicks:      rec.RekberClicks,
				VideoViews:        rec.VideoViews,
				TotalActions:      act,
			})
			if rec.StoreViews >= peakViews {
				peakViews = rec.StoreViews
				peakDate = dt
			}
		} else {
			trends = append(trends, DailyMetricPoint{
				Date:              dt,
				StoreViews:        0,
				WaClicks:          0,
				DirectWaClicks:    0,
				MarketplaceClicks: 0,
				RekberClicks:      0,
				VideoViews:        0,
				TotalActions:      0,
			})
		}
	}

	// Calculate overall store conversion rate (% of visitors who took an action)
	var overallConversionRate float64 = 0
	if totalStoreViews > 0 {
		overallConversionRate = (float64(totalActions) / float64(totalStoreViews)) * 100
		if overallConversionRate > 100 {
			overallConversionRate = 100
		}
	}

	// 1. Calculate true total product views across 100% of active store products directly via DB aggregation
	var totalProductViews int64 = 0
	_ = db.Model(&models.Product{}).
		Where("store_id = ? AND is_active = ?", store.ID, true).
		Select("COALESCE(SUM(view_count), 0)").
		Scan(&totalProductViews).Error

	// 2. Query top performing active products for this store leaderboard (limited to top 50 for lightweight payload)
	var products []models.Product
	_ = db.Select("id, name, image_url, price, class, view_count, wa_clicks_count, marketplace_clicks_count, rekber_clicks_count, video_views_count, product_type").
		Where("store_id = ? AND is_active = ?", store.ID, true).
		Order("view_count DESC, wa_clicks_count DESC, id DESC").
		Limit(50).
		Find(&products).Error

	topSummary := make([]TopProductSummary, len(products))
	categoryMap := make(map[string]*CategoryMetricSummary)

	// Map for product type breakdown
	typeNames := map[string]string{
		"physical": "Produk Fisik",
		"service":  "Layanan / Jasa",
		"digital":  "File Digital",
		"food":     "Kuliner & FnB",
		"property": "Properti & Listing",
		"fauna":    "Satwa & Fauna",
	}

	prodTypeMap := make(map[string]*ProductTypeMetricSummary)
	for code, name := range typeNames {
		prodTypeMap[code] = &ProductTypeMetricSummary{
			ProductType: code,
			TypeName:    name,
		}
	}

	for i, p := range products {
		pType := p.ProductType
		if pType == "" {
			pType = "physical"
		}

		itemActions := p.WaClicksCount + p.MarketplaceClicksCount + p.RekberClicksCount + p.VideoViewsCount
		var itemCtr float64 = 0
		if p.ViewCount > 0 {
			itemCtr = (float64(itemActions) / float64(p.ViewCount)) * 100
			if itemCtr > 100 {
				itemCtr = 100
			}
		}

		topSummary[i] = TopProductSummary{
			ID:                     p.ID,
			Name:                   p.Name,
			ImageURL:               p.ImageURL,
			Price:                  p.Price,
			Class:                  p.Class,
			ViewCount:              p.ViewCount,
			WaClicksCount:          p.WaClicksCount,
			MarketplaceClicksCount: p.MarketplaceClicksCount,
			RekberClicksCount:      p.RekberClicksCount,
			VideoViewsCount:        p.VideoViewsCount,
			TotalActionsCount:      itemActions,
			ConversionRatePercent:  itemCtr,
			ProductType:            pType,
		}

		// Update product type summary
		if ptSummary, exists := prodTypeMap[pType]; exists {
			ptSummary.ItemCount++
			ptSummary.Views += p.ViewCount
			ptSummary.DirectWaClicks += p.WaClicksCount
			ptSummary.MarketplaceClicks += p.MarketplaceClicksCount
			ptSummary.RekberClicks += p.RekberClicksCount
			ptSummary.VideoViews += p.VideoViewsCount
			ptSummary.TotalActions += itemActions
		}

		// Update category summary
		catName := p.Class
		if strings.TrimSpace(catName) == "" {
			catName = "Umum"
		}
		if _, exists := categoryMap[catName]; !exists {
			categoryMap[catName] = &CategoryMetricSummary{
				Category:     catName,
				Views:        0,
				TotalActions: 0,
				Items:        0,
			}
		}
		categoryMap[catName].Views += p.ViewCount
		categoryMap[catName].TotalActions += itemActions
		categoryMap[catName].Items++
	}

	// Calculate conversion rate for each product type
	prodTypeSummaries := make([]ProductTypeMetricSummary, 0, len(prodTypeMap))
	for _, pt := range prodTypeMap {
		if pt.ItemCount > 0 {
			if pt.Views > 0 {
				pt.ConversionRatePercent = (float64(pt.TotalActions) / float64(pt.Views)) * 100
				if pt.ConversionRatePercent > 100 {
					pt.ConversionRatePercent = 100
				}
			}
			prodTypeSummaries = append(prodTypeSummaries, *pt)
		}
	}

	categories := make([]CategoryMetricSummary, 0, len(categoryMap))
	for _, cSummary := range categoryMap {
		categories = append(categories, *cSummary)
	}

	// Channel distribution breakdown
	channelDist := fiber.Map{
		"direct_wa":   totalDirectWa,
		"marketplace": totalMarketplace,
		"rekber":      totalRekber,
		"video":       totalVideo,
	}

	// Smart Actionable Insights Generator
	insights := make([]SmartInsight, 0)
	if totalStoreViews > 0 {
		if overallConversionRate >= 5.0 {
			insights = append(insights, SmartInsight{
				Type:        "success",
				Title:       "Performa Konversi Sangat Optimal",
				Description: fmt.Sprintf("Katalog Anda memiliki rasio konversi %.1f%%. Pengunjung sangat tertarik untuk melakukan aksi / menghubungi Anda langsung.", overallConversionRate),
			})
		} else if overallConversionRate < 2.0 && totalStoreViews > 20 {
			insights = append(insights, SmartInsight{
				Type:        "tip",
				Title:       "Peluang Tingkatkan Konversi",
				Description: "Tingkatkan minat pengunjung dengan menambahkan foto resolusi tinggi, promo harga menarik, atau menyertakan tautan marketplace/video demo produk.",
			})
		}
	}

	if totalMarketplace > totalDirectWa && totalMarketplace > 0 {
		insights = append(insights, SmartInsight{
			Type:        "tip",
			Title:       "Minat Marketplace Sangat Kuat",
			Description: "Pengunjung lebih gemar bertransaksi via marketplace (Shopee/Tokopedia). Pastikan stok dan harga di toko marketplace Anda selalu sinkron.",
		})
	}

	if totalRekber > 0 {
		insights = append(insights, SmartInsight{
			Type:        "success",
			Title:       "Peminat Rekber Syariah Terdeteksi",
			Description: "Pengunjung menghargai opsi transaksi aman Rekber Syariah untuk produk bernilai tinggi.",
		})
	}

	if len(insights) == 0 {
		insights = append(insights, SmartInsight{
			Type:        "tip",
			Title:       "Siap Menerima Calon Pembeli",
			Description: "Bagikan tautan katalog toko Anda ke media sosial atau status WhatsApp untuk mulai mendatangkan pengunjung dan calon pembeli.",
		})
	}

	// Period-over-period growth calculation
	prevStartDate := time.Now().AddDate(0, 0, -(days*2 - 1)).Format("2006-01-02")
	prevEndDate := time.Now().AddDate(0, 0, -days).Format("2006-01-02")
	var prevDailyRecords []models.StoreDailyAnalytics
	_ = db.Where("store_id = ? AND date >= ? AND date <= ?", store.ID, prevStartDate, prevEndDate).Find(&prevDailyRecords).Error
	prevStoreViews := 0
	prevTotalActions := 0
	for _, r := range prevDailyRecords {
		prevStoreViews += r.StoreViews
		directWa := r.DirectWaClicks
		if directWa == 0 && r.WaClicks > 0 {
			directWa = r.WaClicks
		}
		act := r.TotalActions
		if act == 0 {
			act = directWa + r.MarketplaceClicks + r.RekberClicks + r.VideoViews
		}
		prevTotalActions += act
	}

	calcGrowth := func(curr, prev int) float64 {
		if prev == 0 {
			if curr > 0 {
				return 100.0
			}
			return 0.0
		}
		return ((float64(curr) - float64(prev)) / float64(prev)) * 100.0
	}

	growthData := PeriodGrowthSummary{
		StoreViewsGrowthPercent:   calcGrowth(totalStoreViews, prevStoreViews),
		TotalActionsGrowthPercent: calcGrowth(totalActions, prevTotalActions),
		PrevStoreViews:            prevStoreViews,
		PrevTotalActions:          prevTotalActions,
	}

	// Traffic source breakdown
	var trafficRecords []models.StoreDailyTrafficSource
	_ = db.Where("store_id = ? AND date >= ?", store.ID, startDate).Find(&trafficRecords).Error

	sourceMap := make(map[string]*TrafficSourceSummary)
	sourceLabels := map[string]string{
		"instagram":   "Instagram",
		"tiktok":      "TikTok",
		"whatsapp":    "WhatsApp",
		"facebook":    "Facebook",
		"google":      "Google / Search",
		"marketplace": "Marketplace",
		"direct":      "Direct / Link Langsung",
		"other":       "Sumber Lainnya",
	}

	totalTrafficViews := 0
	for _, tr := range trafficRecords {
		s := tr.Source
		if s == "" {
			s = "direct"
		}
		lbl := sourceLabels[s]
		if lbl == "" {
			lbl = strings.Title(s)
		}
		if _, exists := sourceMap[s]; !exists {
			sourceMap[s] = &TrafficSourceSummary{
				Source: s,
				Name:   lbl,
			}
		}
		sourceMap[s].Views += tr.Views
		sourceMap[s].TotalActions += tr.TotalActions
		totalTrafficViews += tr.Views
	}

	// If no traffic source rows exist yet (e.g. freshly upgraded), fallback to direct so charts look populated
	if len(sourceMap) == 0 && totalStoreViews > 0 {
		sourceMap["direct"] = &TrafficSourceSummary{
			Source:       "direct",
			Name:         "Direct / Link Langsung",
			Views:        totalStoreViews,
			TotalActions: totalActions,
		}
		totalTrafficViews = totalStoreViews
	}

	trafficSources := make([]TrafficSourceSummary, 0, len(sourceMap))
	for _, sm := range sourceMap {
		if totalTrafficViews > 0 {
			sm.Percentage = (float64(sm.Views) / float64(totalTrafficViews)) * 100.0
		}
		if sm.Views > 0 {
			sm.ConversionRatePercent = (float64(sm.TotalActions) / float64(sm.Views)) * 100.0
			if sm.ConversionRatePercent > 100.0 {
				sm.ConversionRatePercent = 100.0
			}
		}
		trafficSources = append(trafficSources, *sm)
	}

	// Conversion Funnel metrics
	viewToProdRate := 0.0
	if totalStoreViews > 0 {
		viewToProdRate = (float64(totalProductViews) / float64(totalStoreViews)) * 100.0
		if viewToProdRate > 100.0 {
			viewToProdRate = 100.0
		}
	}
	prodToActionRate := 0.0
	if totalProductViews > 0 {
		prodToActionRate = (float64(totalActions) / float64(totalProductViews)) * 100.0
		if prodToActionRate > 100.0 {
			prodToActionRate = 100.0
		}
	}
	funnelData := ConversionFunnelSummary{
		StoreViews:            totalStoreViews,
		ProductViews:          int(totalProductViews),
		TotalActions:          totalActions,
		ViewToProductRate:     viewToProdRate,
		ProductToActionRate:   prodToActionRate,
		OverallConversionRate: overallConversionRate,
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"period":                   period,
			"days":                     days,
			"total_store_views":        totalStoreViews,
			"total_product_views":      totalProductViews,
			"total_wa_clicks":          totalDirectWa, // backward compatibility
			"total_direct_wa":          totalDirectWa,
			"total_marketplace_clicks": totalMarketplace,
			"total_rekber_clicks":      totalRekber,
			"total_video_views":        totalVideo,
			"total_actions":            totalActions,
			"conversion_rate_percent":  overallConversionRate,
			"peak_date":                peakDate,
			"peak_views":               peakViews,
			"trends":                   trends,
			"channels":                 channelDist,
			"product_types":            prodTypeSummaries,
			"top_products":             topSummary,
			"categories":               categories,
			"insights":                 insights,
			"growth":                   growthData,
			"traffic_sources":          trafficSources,
			"funnel":                   funnelData,
			"bot_defense_active":       true,
		},
	})
}

// GetStoreAnalyticsProducts returns server-side paginated product performance analytics with filtering, search, and sorting.
func (h *AnalyticsHandler) GetStoreAnalyticsProducts(c *fiber.Ctx) error {
	var store *models.Store
	if s, ok := c.Locals("store").(*models.Store); ok {
		store = s
	} else if sVal, ok := c.Locals("store").(models.Store); ok {
		store = &sVal
	}

	if store == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses toko tidak valid.",
		})
	}

	db := database.DB

	// Parse pagination parameters
	page := 1
	if p, err := strconv.Atoi(strings.TrimSpace(c.Query("page", "1"))); err == nil && p > 0 {
		page = p
	}

	perPage := 10
	if l, err := strconv.Atoi(strings.TrimSpace(c.Query("per_page", c.Query("limit", "10")))); err == nil && l > 0 {
		perPage = l
		if perPage > 100 {
			perPage = 100
		}
	}

	search := strings.TrimSpace(c.Query("search", c.Query("q", "")))
	productType := strings.TrimSpace(strings.ToLower(c.Query("product_type", c.Query("type", "all"))))
	sortOption := strings.TrimSpace(strings.ToLower(c.Query("sort", "views")))

	// 1. Calculate Product Type Counts across all active store products (for filter badges)
	type typeCountRow struct {
		ProductType string `gorm:"column:product_type"`
		Count       int64  `gorm:"column:count"`
	}
	var typeCounts []typeCountRow
	_ = db.Model(&models.Product{}).
		Select("COALESCE(NULLIF(product_type, ''), 'physical') as product_type, COUNT(*) as count").
		Where("store_id = ? AND is_active = ?", store.ID, true).
		Group("COALESCE(NULLIF(product_type, ''), 'physical')").
		Find(&typeCounts).Error

	var totalActiveProducts int64 = 0
	typeCountsMap := map[string]int64{
		"all":      0,
		"physical": 0,
		"service":  0,
		"digital":  0,
		"food":     0,
		"property": 0,
		"fauna":    0,
	}

	for _, tc := range typeCounts {
		pType := tc.ProductType
		if pType == "" {
			pType = "physical"
		}
		typeCountsMap[pType] = tc.Count
		totalActiveProducts += tc.Count
	}
	typeCountsMap["all"] = totalActiveProducts

	// 2. Build Base Query for Paginated Result
	query := db.Model(&models.Product{}).
		Where("store_id = ? AND is_active = ?", store.ID, true)

	// Filter by product type
	if productType != "" && productType != "all" {
		query = query.Where("COALESCE(NULLIF(product_type, ''), 'physical') = ?", productType)
	}

	// Filter by search term
	if search != "" {
		searchLike := "%" + strings.ToLower(search) + "%"
		query = query.Where("(LOWER(name) LIKE ? OR LOWER(class) LIKE ? OR LOWER(scientific_name) LIKE ?)", searchLike, searchLike, searchLike)
	}

	// Get total matching count
	var totalMatching int64
	if err := query.Count(&totalMatching).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghitung total data performa produk.",
		})
	}

	totalPages := int((totalMatching + int64(perPage) - 1) / int64(perPage))
	if totalPages < 1 {
		totalPages = 1
	}
	if page > totalPages {
		page = totalPages
	}

	offset := (page - 1) * perPage
	if offset < 0 {
		offset = 0
	}

	// Apply Sorting
	orderClause := "view_count DESC, id DESC"
	switch sortOption {
	case "views":
		orderClause = "view_count DESC, id DESC"
	case "actions":
		orderClause = "(COALESCE(wa_clicks_count, 0) + COALESCE(marketplace_clicks_count, 0) + COALESCE(rekber_clicks_count, 0) + COALESCE(video_views_count, 0)) DESC, id DESC"
	case "ctr":
		orderClause = "(CASE WHEN view_count > 0 THEN ((COALESCE(wa_clicks_count, 0) + COALESCE(marketplace_clicks_count, 0) + COALESCE(rekber_clicks_count, 0) + COALESCE(video_views_count, 0))::float / view_count::float) ELSE 0 END) DESC, id DESC"
	case "price_desc":
		orderClause = "price DESC, id DESC"
	case "price_asc":
		orderClause = "price ASC, id DESC"
	}

	var products []models.Product
	if err := query.
		Select("id, name, image_url, price, class, view_count, wa_clicks_count, marketplace_clicks_count, rekber_clicks_count, video_views_count, product_type").
		Order(orderClause).
		Offset(offset).
		Limit(perPage).
		Find(&products).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil daftar performa produk.",
		})
	}

	productSummaries := make([]TopProductSummary, len(products))
	for i, p := range products {
		pType := p.ProductType
		if pType == "" {
			pType = "physical"
		}
		itemActions := p.WaClicksCount + p.MarketplaceClicksCount + p.RekberClicksCount + p.VideoViewsCount
		var itemCtr float64 = 0
		if p.ViewCount > 0 {
			itemCtr = (float64(itemActions) / float64(p.ViewCount)) * 100
			if itemCtr > 100 {
				itemCtr = 100
			}
		}

		productSummaries[i] = TopProductSummary{
			ID:                     p.ID,
			Name:                   p.Name,
			ImageURL:               p.ImageURL,
			Price:                  p.Price,
			Class:                  p.Class,
			ViewCount:              p.ViewCount,
			WaClicksCount:          p.WaClicksCount,
			MarketplaceClicksCount: p.MarketplaceClicksCount,
			RekberClicksCount:      p.RekberClicksCount,
			VideoViewsCount:        p.VideoViewsCount,
			TotalActionsCount:      itemActions,
			ConversionRatePercent:  itemCtr,
			ProductType:            pType,
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"products":     productSummaries,
			"total":        totalMatching,
			"page":         page,
			"per_page":     perPage,
			"total_pages":  totalPages,
			"has_next":     page < totalPages,
			"has_prev":     page > 1,
			"type_counts":  typeCountsMap,
			"sort":         sortOption,
			"product_type": productType,
			"search":       search,
		},
	})
}

// GetMarketIntelligenceSummary returns macro industry trends, channel metrics, and price benchmarks with zero PII.
func (h *AnalyticsHandler) GetMarketIntelligenceSummary(c *fiber.Ctx) error {
	// Check if market intelligence is enabled
	var setting models.Setting
	if err := database.DB.Where("key = ?", "market_intel_enabled").First(&setting).Error; err == nil {
		if setting.Value == "0" || setting.Value == "false" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"message": "Fitur Market Intelligence saat ini sedang dinonaktifkan oleh administrator.",
			})
		}
	}

	summary, err := services.GetMacroMarketSummary(database.DB)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengagregasi data market intelligence: " + err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    summary,
	})
}

// ExportMarketIntelligenceData streams an anonymized CSV or JSON export of market trends.
func (h *AnalyticsHandler) ExportMarketIntelligenceData(c *fiber.Ctx) error {
	format := strings.ToLower(c.Query("format", "csv"))

	if format == "json" {
		summary, err := services.GetMacroMarketSummary(database.DB)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal mengekspor data: " + err.Error(),
			})
		}
		c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=catavor-market-intelligence-%s.json", time.Now().Format("20060102")))
		return c.JSON(summary)
	}

	csvData, err := services.GenerateMarketIntelligenceCSV(database.DB)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal membuat berkas CSV: " + err.Error(),
		})
	}

	c.Set("Content-Type", "text/csv; charset=utf-8")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=catavor-market-intelligence-%s.csv", time.Now().Format("20060102")))
	return c.Send(csvData)
}

// ExportStoreAnalytics streams a clean, Excel-compatible CSV export of the store's performance metrics.
// Supports periods ('7d', '30d', '90d', 'all') and report types ('daily', 'products', 'full').
func (h *AnalyticsHandler) ExportStoreAnalytics(c *fiber.Ctx) error {
	var store *models.Store
	if s, ok := c.Locals("store").(*models.Store); ok {
		store = s
	} else if sVal, ok := c.Locals("store").(models.Store); ok {
		store = &sVal
	}

	if store == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses toko tidak valid.",
		})
	}

	period := strings.ToLower(strings.TrimSpace(c.Query("period", "30d")))
	reportType := strings.ToLower(strings.TrimSpace(c.Query("type", "full")))
	if reportType == "" {
		reportType = "full"
	}

	days := 30
	periodLabel := "30 Hari Terakhir"
	isAllTime := false

	if period == "7d" {
		days = 7
		periodLabel = "7 Hari Terakhir"
	} else if period == "90d" {
		days = 90
		periodLabel = "90 Hari Terakhir"
	} else if period == "all" || period == "all-time" || period == "alltime" {
		isAllTime = true
		period = "all"
		periodLabel = "Sepanjang Waktu (Semua Riwayat)"
	} else {
		period = "30d"
	}

	db := database.DB

	// CSV formatting & security helpers
	escapeCSV := func(s string) string {
		clean := strings.TrimSpace(s)
		// Security: Prevent CSV formula injection in Microsoft Excel / LibreOffice
		if len(clean) > 0 && (clean[0] == '=' || clean[0] == '+' || clean[0] == '-' || clean[0] == '@') {
			clean = "'" + clean
		}
		if strings.ContainsAny(clean, ",\"\n\r") {
			clean = `"` + strings.ReplaceAll(clean, `"`, `""`) + `"`
		}
		return clean
	}

	formatProductType := func(pType string) string {
		switch strings.ToLower(pType) {
		case "service":
			return "Layanan / Jasa"
		case "digital":
			return "Produk Digital"
		case "food":
			return "Kuliner & FnB"
		case "property":
			return "Properti & Listing"
		case "fauna":
			return "Satwa & Fauna"
		case "plant":
			return "Tanaman & Flora"
		default:
			return "Produk Fisik"
		}
	}

	var sb strings.Builder
	// 1. Mandatory UTF-8 Byte Order Mark (BOM) for 100% Microsoft Excel Windows/Mac compatibility
	sb.WriteString("\xEF\xBB\xBF")

	// 2. Fetch daily records if needed
	var dailyRecords []models.StoreDailyAnalytics
	if reportType == "daily" || reportType == "full" {
		query := db.Where("store_id = ?", store.ID)
		if !isAllTime {
			startDate := time.Now().AddDate(0, 0, -(days - 1)).Format("2006-01-02")
			query = query.Where("date >= ?", startDate)
		}
		_ = query.Order("date DESC").Find(&dailyRecords).Error
	}

	// 3. Fetch product records if needed
	var products []models.Product
	if reportType == "products" || reportType == "full" {
		_ = db.Select("id, name, price, class, view_count, wa_clicks_count, marketplace_clicks_count, rekber_clicks_count, video_views_count, product_type").
			Where("store_id = ? AND is_active = ?", store.ID, true).
			Order("view_count DESC, wa_clicks_count DESC, id DESC").
			Find(&products).Error
	}

	switch reportType {
	case "products":
		// Header row
		sb.WriteString("ID Item,Nama Produk,Tipe Katalog,Kategori/Kelas,Harga (Rp),Tayangan (Views),Klik WhatsApp,Klik Marketplace,Klik Rekber,Tayangan Video,Total Aksi Peminat,Rasio Konversi CTR (%)\n")
		for _, p := range products {
			totalAct := p.WaClicksCount + p.MarketplaceClicksCount + p.RekberClicksCount + p.VideoViewsCount
			ctr := 0.0
			if p.ViewCount > 0 {
				ctr = (float64(totalAct) / float64(p.ViewCount)) * 100
				if ctr > 100 {
					ctr = 100
				}
			}
			catName := p.Class
			if catName == "" {
				catName = "Umum"
			}
			sb.WriteString(fmt.Sprintf("%d,%s,%s,%s,%.0f,%d,%d,%d,%d,%d,%d,%.2f%%\n",
				p.ID,
				escapeCSV(p.Name),
				escapeCSV(formatProductType(p.ProductType)),
				escapeCSV(catName),
				p.Price,
				p.ViewCount,
				p.WaClicksCount,
				p.MarketplaceClicksCount,
				p.RekberClicksCount,
				p.VideoViewsCount,
				totalAct,
				ctr,
			))
		}

	case "daily":
		// Header row
		sb.WriteString("Tanggal,Tayangan Toko,Klik WhatsApp,Klik Marketplace,Klik Rekber,Tayangan Video,Total Aksi,Tingkat Konversi (%)\n")
		for _, r := range dailyRecords {
			directWa := r.DirectWaClicks
			if directWa == 0 && r.WaClicks > 0 {
				directWa = r.WaClicks
			}
			act := r.TotalActions
			if act == 0 {
				act = directWa + r.MarketplaceClicks + r.RekberClicks + r.VideoViews
			}
			cr := 0.0
			if r.StoreViews > 0 {
				cr = (float64(act) / float64(r.StoreViews)) * 100
				if cr > 100 {
					cr = 100
				}
			}
			sb.WriteString(fmt.Sprintf("%s,%d,%d,%d,%d,%d,%d,%.2f%%\n",
				r.Date, r.StoreViews, directWa, r.MarketplaceClicks, r.RekberClicks, r.VideoViews, act, cr))
		}

	default: // "full"
		// Executive Summary Metadata
		totalStoreViews := 0
		totalActions := 0
		for _, r := range dailyRecords {
			totalStoreViews += r.StoreViews
			act := r.TotalActions
			if act == 0 {
				directWa := r.DirectWaClicks
				if directWa == 0 && r.WaClicks > 0 {
					directWa = r.WaClicks
				}
				act = directWa + r.MarketplaceClicks + r.RekberClicks + r.VideoViews
			}
			totalActions += act
		}
		overallCR := 0.0
		if totalStoreViews > 0 {
			overallCR = (float64(totalActions) / float64(totalStoreViews)) * 100
			if overallCR > 100 {
				overallCR = 100
			}
		}

		storeName := store.StoreTitle
		if storeName == "" {
			storeName = store.Slug
		}
		sb.WriteString(fmt.Sprintf("# LAPORAN ANALITIK RESMI KATALOG CATAVOR - %s\n", escapeCSV(storeName)))
		sb.WriteString(fmt.Sprintf("# Periode Laporan: %s | Tanggal Cetak: %s\n", periodLabel, time.Now().Format("2006-01-02 15:04:05")))
		sb.WriteString(fmt.Sprintf("# Total Kunjungan Toko: %d | Total Aksi Peminat: %d | Rata-rata Konversi: %.2f%%\n\n", totalStoreViews, totalActions, overallCR))

		// Section 1: Daily Timeline
		sb.WriteString("=== BAGIAN 1: REKAPITULASI TREN HARIAN TOKO ===\n")
		sb.WriteString("Tanggal,Tayangan Toko,Klik WhatsApp,Klik Marketplace,Klik Rekber,Tayangan Video,Total Aksi,Tingkat Konversi (%)\n")
		for _, r := range dailyRecords {
			directWa := r.DirectWaClicks
			if directWa == 0 && r.WaClicks > 0 {
				directWa = r.WaClicks
			}
			act := r.TotalActions
			if act == 0 {
				act = directWa + r.MarketplaceClicks + r.RekberClicks + r.VideoViews
			}
			cr := 0.0
			if r.StoreViews > 0 {
				cr = (float64(act) / float64(r.StoreViews)) * 100
				if cr > 100 {
					cr = 100
				}
			}
			sb.WriteString(fmt.Sprintf("%s,%d,%d,%d,%d,%d,%d,%.2f%%\n",
				r.Date, r.StoreViews, directWa, r.MarketplaceClicks, r.RekberClicks, r.VideoViews, act, cr))
		}

		// Section 2: Product Breakdown
		sb.WriteString("\n=== BAGIAN 2: RINCIAN PERFORMA KATALOG ITEM ===\n")
		sb.WriteString("ID Item,Nama Produk,Tipe Katalog,Kategori/Kelas,Harga (Rp),Tayangan (Views),Klik WhatsApp,Klik Marketplace,Klik Rekber,Tayangan Video,Total Aksi Peminat,Rasio Konversi CTR (%)\n")
		for _, p := range products {
			totalAct := p.WaClicksCount + p.MarketplaceClicksCount + p.RekberClicksCount + p.VideoViewsCount
			ctr := 0.0
			if p.ViewCount > 0 {
				ctr = (float64(totalAct) / float64(p.ViewCount)) * 100
				if ctr > 100 {
					ctr = 100
				}
			}
			catName := p.Class
			if catName == "" {
				catName = "Umum"
			}
			sb.WriteString(fmt.Sprintf("%d,%s,%s,%s,%.0f,%d,%d,%d,%d,%d,%d,%.2f%%\n",
				p.ID,
				escapeCSV(p.Name),
				escapeCSV(formatProductType(p.ProductType)),
				escapeCSV(catName),
				p.Price,
				p.ViewCount,
				p.WaClicksCount,
				p.MarketplaceClicksCount,
				p.RekberClicksCount,
				p.VideoViewsCount,
				totalAct,
				ctr,
			))
		}
	}

	filename := fmt.Sprintf("catavor-analytics-%s-%s-%s-%s.csv", store.Slug, reportType, period, time.Now().Format("20060102"))
	c.Set("Content-Type", "text/csv; charset=utf-8")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	return c.Send([]byte(sb.String()))
}


