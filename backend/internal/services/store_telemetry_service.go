package services

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"catavor-backend/internal/models"
	"catavor-backend/internal/utils"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	safeIdentifierRegex = regexp.MustCompile(`[^a-zA-Z0-9_\-\s]+`)
	cleanSpaceRegex     = regexp.MustCompile(`\s+`)
)

// StoreTelemetryEvent represents an incoming tracking event before aggregation.
type StoreTelemetryEvent struct {
	StoreID     uint
	StoreSlug   string
	Event       string // store_view | product_view | direct_wa_click | marketplace_click | rekber_click | video_view
	ProductID   uint
	ProductName string
	ProductType string
	ClientIP    string
	SessionID   string
	UserAgent   string
	Source      string
	Medium      string
	Campaign    string
	Referrer    string
	City        string
	Country     string
	Timestamp   time.Time
}

// In-Memory Aggregation Keys
type storeDateKey struct {
	StoreID uint
	Date    string
}

type trafficSourceKey struct {
	StoreID uint
	Date    string
	Source  string
}

type audienceKey struct {
	StoreID        uint
	Date           string
	DimensionType  string
	DimensionValue string
}

type productDateKey struct {
	ProductID   uint
	Date        string
	StoreID     uint
	ProductType string
}

// In-Memory Aggregation Accumulators
type storeMetricsAcc struct {
	StoreViews        int
	UniqueVisitors    int
	ProductViews      int
	Bounces           int
	WaClicks          int
	DirectWaClicks    int
	MarketplaceClicks int
	RekberClicks      int
	VideoViews        int
	TotalActions      int
}

type trafficMetricsAcc struct {
	Views          int
	UniqueVisitors int
	TotalActions   int
}

type audienceMetricsAcc struct {
	Views          int
	UniqueVisitors int
	TotalActions   int
}

type productMetricsAcc struct {
	Views             int
	WaClicks          int
	DirectWaClicks    int
	MarketplaceClicks int
	RekberClicks      int
	VideoViews        int
	TotalActions      int
	PopularityDelta   int
}

// RecentVisitorDTO represents an item in the live activity stream.
type RecentVisitorDTO struct {
	ID          uint64    `json:"id"`
	StoreID     uint      `json:"store_id"`
	StoreSlug   string    `json:"store_slug"`
	Event       string    `json:"event"`
	ProductID   uint      `json:"product_id,omitempty"`
	ProductName string    `json:"product_name,omitempty"`
	Source      string    `json:"source"`
	DeviceType  string    `json:"device_type"`
	Browser     string    `json:"browser"`
	OS          string    `json:"os"`
	City        string    `json:"city"`
	CreatedAt   time.Time `json:"created_at"`
	TimeAgo     string    `json:"time_ago"`
}

// StoreTelemetryService coordinates non-blocking ingestion and async batch flushing.
type StoreTelemetryService struct {
	db        *gorm.DB
	eventChan chan StoreTelemetryEvent
	stopChan  chan struct{}
	closeOnce sync.Once

	// Aggregator Buffer & Lock
	bufferMu       sync.Mutex
	storeBuffer    map[storeDateKey]*storeMetricsAcc
	storeCountDiff map[uint]*storeCountDelta
	trafficBuffer  map[trafficSourceKey]*trafficMetricsAcc
	audienceBuffer map[audienceKey]*audienceMetricsAcc
	productBuffer  map[productDateKey]*productMetricsAcc
	recentEvents   []models.RecentVisitorEvent

	// Live Visitor Ring Buffer (In-Memory per store and global)
	ringMu      sync.RWMutex
	storeRings  map[uint][]RecentVisitorDTO // last 50 per store
	globalRing  []RecentVisitorDTO          // last 100 global

	// Daily Visitor Deduplication & Bounce Engagement Tracking (HMAC-SHA256 with rotating salt)
	dedupMu    sync.RWMutex
	visitorSet map[string]int64 // hash -> timestamp unix seconds
	engagedSet map[string]int64 // hash -> timestamp unix seconds (visitors who viewed product or took action)

	// Product Name Cache for Live Visitor Feed enrichment
	prodNameMu    sync.RWMutex
	prodNameCache map[uint]string
}

type storeCountDelta struct {
	ViewsDelta   int
	ActionsDelta int
}

var (
	globalStoreTelemetry *StoreTelemetryService
	telemetryInitOnce    sync.Once
)

// InitStoreTelemetryService initializes the singleton high-performance telemetry service.
func InitStoreTelemetryService(db *gorm.DB) *StoreTelemetryService {
	telemetryInitOnce.Do(func() {
		svc := &StoreTelemetryService{
			db:             db,
			eventChan:      make(chan StoreTelemetryEvent, 10000),
			stopChan:       make(chan struct{}),
			storeBuffer:    make(map[storeDateKey]*storeMetricsAcc),
			storeCountDiff: make(map[uint]*storeCountDelta),
			trafficBuffer:  make(map[trafficSourceKey]*trafficMetricsAcc),
			audienceBuffer: make(map[audienceKey]*audienceMetricsAcc),
			productBuffer:  make(map[productDateKey]*productMetricsAcc),
			recentEvents:   make([]models.RecentVisitorEvent, 0, 100),
			storeRings:     make(map[uint][]RecentVisitorDTO),
			globalRing:     make([]RecentVisitorDTO, 0, 100),
			visitorSet:     make(map[string]int64),
			engagedSet:     make(map[string]int64),
			prodNameCache:  make(map[uint]string),
		}

		// Preload initial recent visitors from database if available
		svc.warmupRecentVisitors()

		// Start background processors
		go svc.startWorker()
		go svc.startFlusher()
		go svc.startPeriodicCleaner()

		globalStoreTelemetry = svc
		log.Info().Msg("StoreTelemetryService initialized: In-Memory Pre-Aggregation & 5s Async Batch Flusher active")
	})
	return globalStoreTelemetry
}

// GetStoreTelemetryService returns the singleton instance.
func GetStoreTelemetryService() *StoreTelemetryService {
	return globalStoreTelemetry
}

// EnqueueEvent pushes an event to the queue without blocking the HTTP request handler (< 0.1ms).
func (s *StoreTelemetryService) EnqueueEvent(item StoreTelemetryEvent) bool {
	if s == nil || s.eventChan == nil {
		return false
	}
	if item.Timestamp.IsZero() {
		item.Timestamp = time.Now().UTC()
	}

	select {
	case s.eventChan <- item:
		return true
	default:
		// Queue full during extreme traffic spike: drop safely to protect thread pool
		log.Warn().Uint("store_id", item.StoreID).Str("event", item.Event).Msg("Telemetry queue full; event dropped safely")
		return false
	}
}

// startWorker processes incoming events from the channel and pre-aggregates them in RAM.
func (s *StoreTelemetryService) startWorker() {
	defer func() {
		if r := recover(); r != nil {
			log.Error().Interface("panic", r).Msg("Recovered panic in StoreTelemetryService worker, restarting...")
			go s.startWorker()
		}
	}()

	for {
		select {
		case <-s.stopChan:
			return
		case event := <-s.eventChan:
			s.processEvent(event)
		}
	}
}

// computeVisitorHash produces an anonymous, un-reversible daily fingerprint.
func (s *StoreTelemetryService) computeVisitorHash(clientIP, sessionID, ua string, storeID uint, date string) string {
	raw := fmt.Sprintf("%s|%s|%s|%d|%s", clientIP, sessionID, ua, storeID, date)
	h := hmac.New(sha256.New, []byte("ctv_analytics_salt_"+date))
	h.Write([]byte(raw))
	return hex.EncodeToString(h.Sum(nil))
}

// checkVisitorAndEngagement checks if visitor is new for (store, date) and tracks bounce engagement. Thread-safe.
func (s *StoreTelemetryService) checkVisitorAndEngagement(hash string, event string) (isUnique bool, bounceDelta int) {
	now := time.Now().Unix()
	s.dedupMu.Lock()
	defer s.dedupMu.Unlock()

	// Prune old entries if map grows beyond 100,000 hashes
	if len(s.visitorSet) > 100000 {
		cutoff := now - 86400 // older than 24h
		for k, ts := range s.visitorSet {
			if ts < cutoff {
				delete(s.visitorSet, k)
				delete(s.engagedSet, k)
			}
		}
	}

	if _, exists := s.visitorSet[hash]; !exists {
		s.visitorSet[hash] = now
		if event == "store_view" {
			// Visitor starts as a single-page session (bounce) until they view a product or trigger an action
			return true, 1
		}
		// Visitor entered directly into a deep interaction (product view or action click)
		s.engagedSet[hash] = now
		return true, 0
	}

	// Visitor already seen today; if they now perform a deeper interaction for the first time, un-bounce them
	if event != "store_view" {
		if _, engaged := s.engagedSet[hash]; !engaged {
			s.engagedSet[hash] = now
			return false, -1
		}
	}

	return false, 0
}

// resolveProductName looks up a product's name by ID with an in-memory cache so Live Feed always displays item names.
func (s *StoreTelemetryService) resolveProductName(productID uint) string {
	if productID == 0 || s.db == nil {
		return ""
	}
	s.prodNameMu.RLock()
	if name, ok := s.prodNameCache[productID]; ok {
		s.prodNameMu.RUnlock()
		return name
	}
	s.prodNameMu.RUnlock()

	var prod models.Product
	if err := s.db.Select("name").Where("id = ?", productID).First(&prod).Error; err != nil {
		return ""
	}
	clean := strings.TrimSpace(prod.Name)
	if clean != "" {
		s.prodNameMu.Lock()
		if len(s.prodNameCache) > 5000 {
			s.prodNameCache = make(map[uint]string)
		}
		s.prodNameCache[productID] = clean
		s.prodNameMu.Unlock()
	}
	return clean
}

func (s *StoreTelemetryService) processEvent(ev StoreTelemetryEvent) {
	if ev.StoreID == 0 {
		return
	}
	date := ev.Timestamp.Format("2006-01-02")
	hourStr := ev.Timestamp.Format("15") // "00" .. "23"

	// 1. Calculate Unique Visitor Flag & Bounce Engagement Delta
	visitorHash := s.computeVisitorHash(ev.ClientIP, ev.SessionID, ev.UserAgent, ev.StoreID, date)
	isUnique, bounceDelta := s.checkVisitorAndEngagement(visitorHash, ev.Event)

	// 1b. Enrich ProductName if ProductID is provided without ProductName
	if ev.ProductID > 0 && strings.TrimSpace(ev.ProductName) == "" {
		ev.ProductName = s.resolveProductName(ev.ProductID)
	}

	// 2. Resolve Device, OS, Browser
	devInfo := utils.ParseUserAgent(ev.UserAgent)
	deviceType := devInfo.DeviceType
	if deviceType == "" {
		deviceType = "mobile"
	}
	osName := devInfo.OS
	if osName == "" {
		osName = "Sistem Operasi Lainnya"
	}
	browserName := devInfo.Browser
	if browserName == "" {
		browserName = "Browser Web"
	}

	// 3. Resolve City & Country
	city := strings.TrimSpace(ev.City)
	if city == "" {
		city = "Indonesia"
	}
	country := strings.TrimSpace(ev.Country)
	if country == "" {
		country = "Indonesia"
	}

	// 4. Resolve Source
	normSource := "direct"
	sLower := strings.ToLower(ev.Source)
	switch {
	case strings.Contains(sLower, "instagram") || strings.Contains(sLower, "ig"):
		normSource = "instagram"
	case strings.Contains(sLower, "tiktok"):
		normSource = "tiktok"
	case strings.Contains(sLower, "whatsapp") || strings.Contains(sLower, "wa.me"):
		normSource = "whatsapp"
	case strings.Contains(sLower, "facebook") || strings.Contains(sLower, "fb"):
		normSource = "facebook"
	case strings.Contains(sLower, "google"):
		normSource = "google"
	case strings.Contains(sLower, "shopee") || strings.Contains(sLower, "tokopedia") || strings.Contains(sLower, "lazada"):
		normSource = "marketplace"
	case sLower != "" && !strings.Contains(sLower, "direct") && !strings.Contains(sLower, "catavor") && !strings.Contains(sLower, "localhost"):
		normSource = "other"
	}

	cleanCampaign := ""
	if ev.Campaign != "" {
		cleanCampaign = safeIdentifierRegex.ReplaceAllString(ev.Campaign, "_")
		cleanCampaign = cleanSpaceRegex.ReplaceAllString(cleanCampaign, "_")
		if len(cleanCampaign) > 60 {
			cleanCampaign = cleanCampaign[:60]
		}
	}

	isAction := (ev.Event != "store_view" && ev.Event != "product_view")
	isStoreEntryView := (ev.Event == "store_view" || (ev.Event == "product_view" && isUnique))
	actionWeight := 0
	if isAction {
		actionWeight = 1
	}

	uniqueIncrement := 0
	if isUnique {
		uniqueIncrement = 1
	}

	// Lock in-memory accumulation buffers
	s.bufferMu.Lock()

	// A. Store Daily Metrics
	sKey := storeDateKey{StoreID: ev.StoreID, Date: date}
	sAcc, exists := s.storeBuffer[sKey]
	if !exists {
		sAcc = &storeMetricsAcc{}
		s.storeBuffer[sKey] = sAcc
	}
	sAcc.UniqueVisitors += uniqueIncrement
	sAcc.Bounces += bounceDelta

	cDelta, cExists := s.storeCountDiff[ev.StoreID]
	if !cExists {
		cDelta = &storeCountDelta{}
		s.storeCountDiff[ev.StoreID] = cDelta
	}

	switch ev.Event {
	case "store_view":
		sAcc.StoreViews++
		cDelta.ViewsDelta++
	case "product_view":
		sAcc.ProductViews++
		if isUnique {
			// Ensure direct deep-link to a product also registers a store session view
			sAcc.StoreViews++
		}
		cDelta.ViewsDelta++
	case "direct_wa_click":
		sAcc.DirectWaClicks++
		sAcc.WaClicks++
		sAcc.TotalActions++
		cDelta.ActionsDelta++
	case "marketplace_click", "marketplace_clicks":
		sAcc.MarketplaceClicks++
		sAcc.TotalActions++
		cDelta.ActionsDelta++
	case "rekber_click", "rekber_clicks":
		sAcc.RekberClicks++
		sAcc.TotalActions++
		cDelta.ActionsDelta++
	case "video_view", "video_views":
		sAcc.VideoViews++
		sAcc.TotalActions++
		cDelta.ActionsDelta++
	}

	// B. Traffic Source Metrics (Reconciled 1:1 with StoreViews & Actions)
	tKey := trafficSourceKey{StoreID: ev.StoreID, Date: date, Source: normSource}
	tAcc, tExists := s.trafficBuffer[tKey]
	if !tExists {
		tAcc = &trafficMetricsAcc{}
		s.trafficBuffer[tKey] = tAcc
	}
	if isStoreEntryView {
		tAcc.Views++
	} else if isAction {
		tAcc.TotalActions++
	}
	tAcc.UniqueVisitors += uniqueIncrement

	// C. Audience Dimension Metrics (store-level and global aggregate store_id=0, reconciled 1:1 with StoreViews)
	recordAudience := func(stID uint, dimType, dimVal string) {
		if strings.TrimSpace(dimVal) == "" {
			return
		}
		aKey := audienceKey{
			StoreID:        stID,
			Date:           date,
			DimensionType:  dimType,
			DimensionValue: dimVal,
		}
		aAcc, aExists := s.audienceBuffer[aKey]
		if !aExists {
			aAcc = &audienceMetricsAcc{}
			s.audienceBuffer[aKey] = aAcc
		}
		if isStoreEntryView {
			aAcc.Views++
		} else if isAction {
			aAcc.TotalActions++
		}
		aAcc.UniqueVisitors += uniqueIncrement
	}

	for _, targetStoreID := range []uint{ev.StoreID, 0} {
		recordAudience(targetStoreID, "device", deviceType)
		recordAudience(targetStoreID, "os", osName)
		recordAudience(targetStoreID, "browser", browserName)
		recordAudience(targetStoreID, "city", city)
		recordAudience(targetStoreID, "country", country)
		recordAudience(targetStoreID, "hour", hourStr)
		if cleanCampaign != "" {
			recordAudience(targetStoreID, "campaign", cleanCampaign)
		}
	}

	// D. Product-Level Metrics
	if ev.ProductID > 0 {
		pType := ev.ProductType
		if pType == "" {
			pType = "physical"
		}
		pKey := productDateKey{
			ProductID:   ev.ProductID,
			Date:        date,
			StoreID:     ev.StoreID,
			ProductType: pType,
		}
		pAcc, pExists := s.productBuffer[pKey]
		if !pExists {
			pAcc = &productMetricsAcc{}
			s.productBuffer[pKey] = pAcc
		}

		switch ev.Event {
		case "product_view", "store_view":
			pAcc.Views++
			pAcc.PopularityDelta += 1
		case "direct_wa_click":
			pAcc.DirectWaClicks++
			pAcc.WaClicks++
			pAcc.TotalActions++
			pAcc.PopularityDelta += 3
		case "marketplace_click", "marketplace_clicks":
			pAcc.MarketplaceClicks++
			pAcc.TotalActions++
			pAcc.PopularityDelta += 2
		case "rekber_click", "rekber_clicks":
			pAcc.RekberClicks++
			pAcc.TotalActions++
			pAcc.PopularityDelta += 5
		case "video_view", "video_views":
			pAcc.VideoViews++
			pAcc.TotalActions++
			pAcc.PopularityDelta += 1
		}
	}

	// E. Recent Visitor Item (Prepared for batch DB write)
	cleanName := ev.ProductName
	if len(cleanName) > 250 {
		cleanName = cleanName[:250]
	}
	recentItem := models.RecentVisitorEvent{
		StoreID:     ev.StoreID,
		StoreSlug:   ev.StoreSlug,
		Event:       ev.Event,
		ProductID:   ev.ProductID,
		ProductName: cleanName,
		Source:      normSource,
		DeviceType:  deviceType,
		Browser:     browserName,
		OS:          osName,
		City:        city,
		CreatedAt:   ev.Timestamp,
	}
	s.recentEvents = append(s.recentEvents, recentItem)

	s.bufferMu.Unlock()

	// F. Update In-Memory Live Visitor Ring Buffer
	dto := RecentVisitorDTO{
		StoreID:     ev.StoreID,
		StoreSlug:   ev.StoreSlug,
		Event:       ev.Event,
		ProductID:   ev.ProductID,
		ProductName: cleanName,
		Source:      normSource,
		DeviceType:  deviceType,
		Browser:     browserName,
		OS:          osName,
		City:        city,
		CreatedAt:   ev.Timestamp,
		TimeAgo:     "Baru saja",
	}

	s.ringMu.Lock()
	// Store ring (max 50)
	stList := s.storeRings[ev.StoreID]
	stList = append([]RecentVisitorDTO{dto}, stList...)
	if len(stList) > 50 {
		stList = stList[:50]
	}
	s.storeRings[ev.StoreID] = stList

	// Global ring (max 100)
	s.globalRing = append([]RecentVisitorDTO{dto}, s.globalRing...)
	if len(s.globalRing) > 100 {
		s.globalRing = s.globalRing[:100]
	}
	s.ringMu.Unlock()
	_ = actionWeight
}

// startFlusher wakes up every 5 seconds to persist pre-aggregated metrics in batch.
func (s *StoreTelemetryService) startFlusher() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopChan:
			s.flushBatch()
			return
		case <-ticker.C:
			s.flushBatch()
		}
	}
}

// FlushNow drains any pending events in the channel and flushes the in-memory buffers to DB immediately.
// Used when the merchant or admin opens the analytics dashboard to guarantee 100% read-after-write consistency.
func (s *StoreTelemetryService) FlushNow() {
	if s == nil {
		return
	}
	for {
		select {
		case ev := <-s.eventChan:
			s.processEvent(ev)
		default:
			s.flushBatch()
			return
		}
	}
}

// flushBatch swaps the in-memory buffer (< 0.1ms) and writes to PostgreSQL in background.
func (s *StoreTelemetryService) flushBatch() {
	if s.db == nil {
		return
	}

	// 1. Atomically swap buffers under lock
	s.bufferMu.Lock()
	if len(s.storeBuffer) == 0 && len(s.trafficBuffer) == 0 && len(s.audienceBuffer) == 0 && len(s.productBuffer) == 0 && len(s.recentEvents) == 0 {
		s.bufferMu.Unlock()
		return
	}

	stores := s.storeBuffer
	s.storeBuffer = make(map[storeDateKey]*storeMetricsAcc)

	storeDiffs := s.storeCountDiff
	s.storeCountDiff = make(map[uint]*storeCountDelta)

	traffics := s.trafficBuffer
	s.trafficBuffer = make(map[trafficSourceKey]*trafficMetricsAcc)

	audiences := s.audienceBuffer
	s.audienceBuffer = make(map[audienceKey]*audienceMetricsAcc)

	products := s.productBuffer
	s.productBuffer = make(map[productDateKey]*productMetricsAcc)

	recents := s.recentEvents
	s.recentEvents = make([]models.RecentVisitorEvent, 0, 100)

	s.bufferMu.Unlock()

	// 2. Perform Batch Upserts asynchronously
	defer func() {
		if r := recover(); r != nil {
			log.Error().Interface("panic", r).Msg("Recovered panic in StoreTelemetryService flushBatch")
		}
	}()

	now := time.Now()

	// A. Store Daily Metrics
	for k, m := range stores {
		assignments := map[string]interface{}{
			"updated_at": now,
		}
		if m.StoreViews > 0 {
			assignments["store_views"] = gorm.Expr("store_daily_analytics.store_views + ?", m.StoreViews)
		}
		if m.UniqueVisitors > 0 {
			assignments["unique_visitors"] = gorm.Expr("store_daily_analytics.unique_visitors + ?", m.UniqueVisitors)
		}
		if m.ProductViews > 0 {
			assignments["product_views"] = gorm.Expr("store_daily_analytics.product_views + ?", m.ProductViews)
		}
		if m.Bounces != 0 {
			assignments["bounces"] = gorm.Expr("CASE WHEN store_daily_analytics.bounces + ? < 0 THEN 0 ELSE store_daily_analytics.bounces + ? END", m.Bounces, m.Bounces)
		}
		if m.DirectWaClicks > 0 {
			assignments["direct_wa_clicks"] = gorm.Expr("store_daily_analytics.direct_wa_clicks + ?", m.DirectWaClicks)
			assignments["wa_clicks"] = gorm.Expr("store_daily_analytics.wa_clicks + ?", m.DirectWaClicks)
		}
		if m.MarketplaceClicks > 0 {
			assignments["marketplace_clicks"] = gorm.Expr("store_daily_analytics.marketplace_clicks + ?", m.MarketplaceClicks)
		}
		if m.RekberClicks > 0 {
			assignments["rekber_clicks"] = gorm.Expr("store_daily_analytics.rekber_clicks + ?", m.RekberClicks)
		}
		if m.VideoViews > 0 {
			assignments["video_views"] = gorm.Expr("store_daily_analytics.video_views + ?", m.VideoViews)
		}
		if m.TotalActions > 0 {
			assignments["total_actions"] = gorm.Expr("store_daily_analytics.total_actions + ?", m.TotalActions)
		}

		initBounces := m.Bounces
		if initBounces < 0 {
			initBounces = 0
		}

		initStore := models.StoreDailyAnalytics{
			StoreID:           k.StoreID,
			Date:              k.Date,
			StoreViews:        m.StoreViews,
			UniqueVisitors:    m.UniqueVisitors,
			ProductViews:      m.ProductViews,
			Bounces:           initBounces,
			DirectWaClicks:    m.DirectWaClicks,
			WaClicks:          m.DirectWaClicks,
			MarketplaceClicks: m.MarketplaceClicks,
			RekberClicks:      m.RekberClicks,
			VideoViews:        m.VideoViews,
			TotalActions:      m.TotalActions,
		}

		_ = s.db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "store_id"}, {Name: "date"}},
			DoUpdates: clause.Assignments(assignments),
		}).Create(&initStore).Error
	}

	// B. Stores Count Delta
	for storeID, diff := range storeDiffs {
		updates := map[string]interface{}{}
		if diff.ViewsDelta > 0 {
			updates["view_count"] = gorm.Expr("view_count + ?", diff.ViewsDelta)
		}
		if diff.ActionsDelta > 0 {
			updates["total_actions_count"] = gorm.Expr("total_actions_count + ?", diff.ActionsDelta)
		}
		if len(updates) > 0 {
			_ = s.db.Model(&models.Store{}).Where("id = ?", storeID).UpdateColumns(updates).Error
		}
	}

	// C. Traffic Sources
	for k, m := range traffics {
		tAssign := map[string]interface{}{
			"updated_at": now,
		}
		if m.Views > 0 {
			tAssign["views"] = gorm.Expr("store_daily_traffic_sources.views + ?", m.Views)
		}
		if m.UniqueVisitors > 0 {
			tAssign["unique_visitors"] = gorm.Expr("store_daily_traffic_sources.unique_visitors + ?", m.UniqueVisitors)
		}
		if m.TotalActions > 0 {
			tAssign["total_actions"] = gorm.Expr("store_daily_traffic_sources.total_actions + ?", m.TotalActions)
		}

		initTraffic := models.StoreDailyTrafficSource{
			StoreID:        k.StoreID,
			Date:           k.Date,
			Source:         k.Source,
			Views:          m.Views,
			UniqueVisitors: m.UniqueVisitors,
			TotalActions:   m.TotalActions,
		}

		_ = s.db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "store_id"}, {Name: "date"}, {Name: "source"}},
			DoUpdates: clause.Assignments(tAssign),
		}).Create(&initTraffic).Error
	}

	// D. Audience Dimension Metrics
	for k, m := range audiences {
		aAssign := map[string]interface{}{
			"updated_at": now,
		}
		if m.Views > 0 {
			aAssign["views"] = gorm.Expr("store_daily_audience_metrics.views + ?", m.Views)
		}
		if m.UniqueVisitors > 0 {
			aAssign["unique_visitors"] = gorm.Expr("store_daily_audience_metrics.unique_visitors + ?", m.UniqueVisitors)
		}
		if m.TotalActions > 0 {
			aAssign["total_actions"] = gorm.Expr("store_daily_audience_metrics.total_actions + ?", m.TotalActions)
		}

		initAudience := models.StoreDailyAudienceMetric{
			StoreID:        k.StoreID,
			Date:           k.Date,
			DimensionType:  k.DimensionType,
			DimensionValue: k.DimensionValue,
			Views:          m.Views,
			UniqueVisitors: m.UniqueVisitors,
			TotalActions:   m.TotalActions,
		}

		_ = s.db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "store_id"}, {Name: "date"}, {Name: "dimension_type"}, {Name: "dimension_value"}},
			DoUpdates: clause.Assignments(aAssign),
		}).Create(&initAudience).Error
	}

	// E. Product Daily Metrics
	for k, m := range products {
		pAssign := map[string]interface{}{
			"updated_at": now,
		}
		if m.Views > 0 {
			pAssign["views"] = gorm.Expr("product_daily_analytics.views + ?", m.Views)
		}
		if m.DirectWaClicks > 0 {
			pAssign["direct_wa_clicks"] = gorm.Expr("product_daily_analytics.direct_wa_clicks + ?", m.DirectWaClicks)
			pAssign["wa_clicks"] = gorm.Expr("product_daily_analytics.wa_clicks + ?", m.DirectWaClicks)
		}
		if m.MarketplaceClicks > 0 {
			pAssign["marketplace_clicks"] = gorm.Expr("product_daily_analytics.marketplace_clicks + ?", m.MarketplaceClicks)
		}
		if m.RekberClicks > 0 {
			pAssign["rekber_clicks"] = gorm.Expr("product_daily_analytics.rekber_clicks + ?", m.RekberClicks)
		}
		if m.VideoViews > 0 {
			pAssign["video_views"] = gorm.Expr("product_daily_analytics.video_views + ?", m.VideoViews)
		}
		if m.TotalActions > 0 {
			pAssign["total_actions"] = gorm.Expr("product_daily_analytics.total_actions + ?", m.TotalActions)
		}

		initProd := models.ProductDailyAnalytics{
			StoreID:           k.StoreID,
			ProductID:         k.ProductID,
			ProductType:       k.ProductType,
			Date:              k.Date,
			Views:             m.Views,
			DirectWaClicks:    m.DirectWaClicks,
			WaClicks:          m.DirectWaClicks,
			MarketplaceClicks: m.MarketplaceClicks,
			RekberClicks:      m.RekberClicks,
			VideoViews:        m.VideoViews,
			TotalActions:      m.TotalActions,
		}

		_ = s.db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "product_id"}, {Name: "date"}},
			DoUpdates: clause.Assignments(pAssign),
		}).Create(&initProd).Error

		// Update product entity counts
		prodUpdates := map[string]interface{}{}
		if m.Views > 0 {
			prodUpdates["view_count"] = gorm.Expr("view_count + ?", m.Views)
		}
		if m.DirectWaClicks > 0 {
			prodUpdates["wa_clicks_count"] = gorm.Expr("wa_clicks_count + ?", m.DirectWaClicks)
		}
		if m.MarketplaceClicks > 0 {
			prodUpdates["marketplace_clicks_count"] = gorm.Expr("marketplace_clicks_count + ?", m.MarketplaceClicks)
		}
		if m.RekberClicks > 0 {
			prodUpdates["rekber_clicks_count"] = gorm.Expr("rekber_clicks_count + ?", m.RekberClicks)
		}
		if m.VideoViews > 0 {
			prodUpdates["video_views_count"] = gorm.Expr("video_views_count + ?", m.VideoViews)
		}
		if m.PopularityDelta > 0 {
			prodUpdates["popularity_score"] = gorm.Expr("popularity_score + ?", m.PopularityDelta)
		}
		if len(prodUpdates) > 0 {
			_ = s.db.Model(&models.Product{}).Where("id = ?", k.ProductID).UpdateColumns(prodUpdates).Error
		}
	}

	// F. Recent Visitors Batch Insert (Max 100 per flush)
	if len(recents) > 0 {
		batchSize := 50
		for i := 0; i < len(recents); i += batchSize {
			end := i + batchSize
			if end > len(recents) {
				end = len(recents)
			}
			_ = s.db.CreateInBatches(recents[i:end], batchSize).Error
		}
	}
}

// GetRecentVisitors returns recent events for a given store from memory in < 0.1ms.
func (s *StoreTelemetryService) GetRecentVisitors(storeID uint, limit int) []RecentVisitorDTO {
	if s == nil {
		return []RecentVisitorDTO{}
	}
	if limit <= 0 || limit > 50 {
		limit = 30
	}

	s.ringMu.RLock()
	list, exists := s.storeRings[storeID]
	if !exists || len(list) == 0 {
		s.ringMu.RUnlock()
		return []RecentVisitorDTO{}
	}

	now := time.Now().UTC()
	result := make([]RecentVisitorDTO, 0, limit)
	for i := 0; i < len(list) && i < limit; i++ {
		item := list[i]
		item.TimeAgo = formatRelativeTime(now, item.CreatedAt)
		result = append(result, item)
	}
	s.ringMu.RUnlock()
	return result
}

// GetGlobalRecentVisitors returns recent platform-wide events from memory in < 0.1ms.
func (s *StoreTelemetryService) GetGlobalRecentVisitors(limit int) []RecentVisitorDTO {
	if s == nil {
		return []RecentVisitorDTO{}
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	s.ringMu.RLock()
	now := time.Now().UTC()
	result := make([]RecentVisitorDTO, 0, limit)
	for i := 0; i < len(s.globalRing) && i < limit; i++ {
		item := s.globalRing[i]
		item.TimeAgo = formatRelativeTime(now, item.CreatedAt)
		result = append(result, item)
	}
	s.ringMu.RUnlock()
	return result
}

func formatRelativeTime(now, past time.Time) string {
	diff := now.Sub(past)
	if diff < 10*time.Second {
		return "Baru saja"
	}
	if diff < time.Minute {
		return fmt.Sprintf("%d dtk lalu", int(diff.Seconds()))
	}
	if diff < time.Hour {
		return fmt.Sprintf("%d mnt lalu", int(diff.Minutes()))
	}
	if diff < 24*time.Hour {
		return fmt.Sprintf("%d jam lalu", int(diff.Hours()))
	}
	return past.Format("02 Jan 15:04")
}

// warmupRecentVisitors pre-populates in-memory ring buffers from database on boot.
func (s *StoreTelemetryService) warmupRecentVisitors() {
	if s.db == nil {
		return
	}
	var recentDB []models.RecentVisitorEvent
	if err := s.db.Order("created_at DESC").Limit(100).Find(&recentDB).Error; err == nil {
		now := time.Now().UTC()
		s.ringMu.Lock()
		for _, r := range recentDB {
			dto := RecentVisitorDTO{
				ID:          r.ID,
				StoreID:     r.StoreID,
				StoreSlug:   r.StoreSlug,
				Event:       r.Event,
				ProductID:   r.ProductID,
				ProductName: r.ProductName,
				Source:      r.Source,
				DeviceType:  r.DeviceType,
				Browser:     r.Browser,
				OS:          r.OS,
				City:        r.City,
				CreatedAt:   r.CreatedAt,
				TimeAgo:     formatRelativeTime(now, r.CreatedAt),
			}
			s.globalRing = append(s.globalRing, dto)
			s.storeRings[r.StoreID] = append(s.storeRings[r.StoreID], dto)
		}
		s.ringMu.Unlock()
	}
}

// startPeriodicCleaner prunes recent_visitor_events older than 7 days once per hour.
func (s *StoreTelemetryService) startPeriodicCleaner() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopChan:
			return
		case <-ticker.C:
			if s.db != nil {
				cutoff := time.Now().UTC().AddDate(0, 0, -7)
				_ = s.db.Where("created_at < ?", cutoff).Delete(&models.RecentVisitorEvent{}).Error
			}
		}
	}
}

// Stop gracefully flushes remaining in-memory buffers when server shuts down.
func (s *StoreTelemetryService) Stop() {
	if s == nil {
		return
	}
	s.closeOnce.Do(func() {
		close(s.stopChan)
		s.flushBatch()
		log.Info().Msg("StoreTelemetryService stopped: all buffers safely flushed to DB")
	})
}

