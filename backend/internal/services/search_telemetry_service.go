package services

import (
	"math"
	"regexp"
	"strings"
	"sync"
	"time"

	"catavor-backend/internal/models"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	nonAlphaRegex              = regexp.MustCompile(`[^a-zA-Z0-9\s]+`)
	spaceRegex                 = regexp.MustCompile(`\s+`)
	vowelRegex                 = regexp.MustCompile(`(?i)[aeiouy]`)
	consecutiveConsonantsRegex = regexp.MustCompile(`(?i)[bcdfghjklmnpqrstvwxyz]{5,}`)
	digitRegex                 = regexp.MustCompile(`[0-9]`)
	emailQueryRegex            = regexp.MustCompile(`(?i)[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}`)
	urlQueryRegex              = regexp.MustCompile(`(?i)(https?://|www\.|wa\.me/|t\.me/|bit\.ly/)`)
	phonePrefixRegex           = regexp.MustCompile(`(?:\+?62|08)[\s\-.\d]{6,}`)

	// Common Indonesian business acronyms, tax/legal terms, and tech specs without vowels
	validAcronyms = map[string]bool{
		"cctv": true, "shgb": true, "shm": true, "npwp": true, "stnk": true, "bpkb": true,
		"pdam": true, "plts": true, "ppjb": true, "kpr": true, "hpl": true, "pvc": true,
		"umkm": true, "qris": true, "bca": true, "bri": true, "bsi": true, "btn": true,
		"ktp": true, "sim": true, "bpjs": true, "psu": true, "vga": true, "ssd": true,
		"hdd": true, "ram": true, "cpu": true, "lcd": true, "led": true, "usb": true,
		"gps": true, "gsm": true, "lte": true, "fmcg": true, "sppg": true, "ddr": true,
	}
)

// hasRepeatedCharacters checks if any character is repeated consecutively 4 or more times.
func hasRepeatedCharacters(s string) bool {
	count := 1
	var last rune
	for i, r := range strings.ToLower(s) {
		if i == 0 {
			last = r
			continue
		}
		if r == last {
			count++
			if count >= 4 {
				return true
			}
		} else {
			last = r
			count = 1
		}
	}
	return false
}

// CleanSearchKeyword normalizes raw user search input: lowercase, strip punctuation, single spacing.
func CleanSearchKeyword(raw string) string {
	raw = strings.ToLower(strings.TrimSpace(raw))
	cleaned := nonAlphaRegex.ReplaceAllString(raw, " ")
	cleaned = spaceRegex.ReplaceAllString(cleaned, " ")
	return strings.TrimSpace(cleaned)
}

// IsValidSearchKeyword enforces enterprise quality heuristics to prevent spam,
// gibberish keyboard-smashing, search poisoning, and malicious injection attempts,
// while preserving valid searches with numbers (specs, years, packaging e.g. "beras 10kg", "rumah 2026")
// and standard 2-letter products (e.g. "ac", "tv", "pc", "hp").
func IsValidSearchKeyword(raw string) bool {
	raw = strings.TrimSpace(raw)
	// Length boundaries: real product/service catalog searches are between 2 and 60 chars (e.g. "ac", "tv", "pc", "hp")
	if len(raw) < 2 || len(raw) > 60 {
		return false
	}

	words := strings.Fields(raw)
	// Word count boundary: realistic searches rarely exceed 8 words
	if len(words) > 8 {
		return false
	}

	// Reject character spam / repeated keys (e.g. "aaaaaa", "zzzz")
	if hasRepeatedCharacters(raw) {
		return false
	}

	// Reject PII (emails, URLs, phone numbers, NIK, bank accounts) before telemetry ingestion
	if emailQueryRegex.MatchString(raw) || strings.Contains(raw, "@") {
		return false
	}
	if urlQueryRegex.MatchString(raw) {
		return false
	}
	if phonePrefixRegex.MatchString(raw) {
		return false
	}
	totalDigits := 0
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			totalDigits++
			if totalDigits >= 8 {
				return false
			}
		}
	}

	lower := strings.ToLower(raw)

	// Reject injection patterns, web exploits, and malicious tokens
	badTokens := []string{
		"<script", "javascript:", "union select", "../", "eval(", "onload=", "onerror=",
		"benchmark(", "waitfor delay", "pg_sleep", "drop table", "select *", "1=1",
		"slot gacor", "judi online", "bokep", "hack", "exploit",
	}
	for _, bt := range badTokens {
		if strings.Contains(lower, bt) {
			return false
		}
	}

	// Reject keyboard smashing / pure consonant clusters
	for _, w := range words {
		cleanedWord := strings.ToLower(nonAlphaRegex.ReplaceAllString(w, ""))
		if cleanedWord == "" {
			continue
		}

		// If the word contains digits (e.g. "10kg", "2026", "100m2", "128gb", "500gr", "ddr4"),
		// it is a spec, year, model number, or packaging unit. Allow if under reasonable length.
		if digitRegex.MatchString(cleanedWord) {
			if len(cleanedWord) > 20 {
				return false
			}
			continue
		}

		// Check known acronym whitelist without vowels
		if validAcronyms[cleanedWord] {
			continue
		}

		// 5 or more consonants in a row is unnatural and indicates keyboard smashing
		if consecutiveConsonantsRegex.MatchString(cleanedWord) {
			return false
		}

		// Pure alphabetic words >= 4 chars must contain at least 1 vowel unless in whitelist
		if len(cleanedWord) >= 4 && !vowelRegex.MatchString(cleanedWord) {
			return false
		}
	}

	return true
}

type searchClickEvent struct {
	date        string
	keyword     string
	productType string
}

// SearchTelemetryService provides non-blocking buffered ingestion of search queries and demand gaps.
type SearchTelemetryService struct {
	db            *gorm.DB
	telemetryChan chan models.SearchAnalytics
	clickChan     chan searchClickEvent
	closeOnce     sync.Once
	stopChan      chan struct{}
}

var (
	globalTelemetryService *SearchTelemetryService
	telemetryOnce          sync.Once
)

// InitSearchTelemetryService initializes the singleton search telemetry buffer & batch flusher.
func InitSearchTelemetryService(db *gorm.DB) *SearchTelemetryService {
	telemetryOnce.Do(func() {
		svc := &SearchTelemetryService{
			db:            db,
			telemetryChan: make(chan models.SearchAnalytics, 5000),
			clickChan:     make(chan searchClickEvent, 2048),
			stopChan:      make(chan struct{}),
		}
		go svc.startBatchFlusher()
		go svc.startClickWorker()
		globalTelemetryService = svc
		log.Info().Msg("SearchTelemetryService initialized with bounded search & click channels")
	})
	return globalTelemetryService
}

// GetSearchTelemetryService returns the singleton instance.
func GetSearchTelemetryService() *SearchTelemetryService {
	return globalTelemetryService
}

// EnqueueSearchEvent pushes a search event to the memory buffer without blocking HTTP requests.
func (s *SearchTelemetryService) EnqueueSearchEvent(event models.SearchAnalytics) bool {
	if s == nil || s.telemetryChan == nil {
		return false
	}

	rawKw := strings.TrimSpace(event.Keyword)
	if !IsValidSearchKeyword(rawKw) {
		return false // Reject spam, gibberish, injection, or invalid length
	}

	cleanKw := CleanSearchKeyword(rawKw)
	if cleanKw == "" {
		return false
	}

	event.Keyword = rawKw
	event.CleanKeyword = cleanKw
	if event.Date == "" {
		event.Date = time.Now().UTC().Format("2006-01-02")
	}
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now().UTC()
	}
	if event.ProductType == "" {
		event.ProductType = "all"
	}
	if event.City == "" {
		event.City = "Indonesia"
	}

	select {
	case s.telemetryChan <- event:
		return true
	default:
		// Buffer is full (extreme traffic spike) - drop gracefully to prevent thread stall
		log.Warn().Str("keyword", cleanKw).Msg("Search telemetry buffer full; event dropped safely")
		return false
	}
}

// startBatchFlusher processes incoming events in batches of 50 or every 500ms.
func (s *SearchTelemetryService) startBatchFlusher() {
	defer func() {
		if r := recover(); r != nil {
			log.Error().Interface("panic", r).Msg("Recovered from panic in SearchTelemetryService batch flusher")
			// Restart flusher safely
			go s.startBatchFlusher()
		}
	}()

	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	batch := make([]models.SearchAnalytics, 0, 50)

	flush := func() {
		if len(batch) == 0 || s.db == nil {
			return
		}
		toInsert := make([]models.SearchAnalytics, len(batch))
		copy(toInsert, batch)
		batch = batch[:0]

		if err := s.db.CreateInBatches(toInsert, 50).Error; err != nil {
			observeCycle("search_ingest", 0, 0, err)
			log.Error().Err(err).Int("count", len(toInsert)).Msg("Failed to persist search telemetry batch to PostgreSQL")
			return
		}

		observeCycle("search_ingest", 0, int64(len(toInsert)), nil)
		// Real-time incremental rollup into search_daily_rollups so CTR & demand gaps are immediately live
		type rollupAcc struct {
			date        string
			keyword     string
			productType string
			vol         int
			zero        int
		}
		accMap := make(map[string]*rollupAcc)
		for _, ev := range toInsert {
			if ev.CleanKeyword == "" {
				continue
			}
			key := ev.Date + "|" + ev.CleanKeyword
			acc, exists := accMap[key]
			if !exists {
				pType := ev.ProductType
				if pType == "" {
					pType = "all"
				}
				acc = &rollupAcc{
					date:        ev.Date,
					keyword:     ev.CleanKeyword,
					productType: pType,
				}
				accMap[key] = acc
			}
			acc.vol++
			if ev.IsZeroResult {
				acc.zero++
			}
			if (acc.productType == "all" || acc.productType == "") && ev.ProductType != "" && ev.ProductType != "all" {
				acc.productType = ev.ProductType
			}
		}

		now := time.Now().UTC()
		for _, acc := range accMap {
			_ = s.db.Exec(`
				INSERT INTO search_daily_rollups (date, keyword, product_type, search_volume, zero_result_count, clicked_product_count, ctr_percentage, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, 0, 0.0, ?, ?)
				ON CONFLICT (date, keyword) DO UPDATE SET
					search_volume = search_daily_rollups.search_volume + EXCLUDED.search_volume,
					zero_result_count = search_daily_rollups.zero_result_count + EXCLUDED.zero_result_count,
					product_type = CASE WHEN search_daily_rollups.product_type = 'all' OR search_daily_rollups.product_type = '' THEN EXCLUDED.product_type ELSE search_daily_rollups.product_type END,
					ctr_percentage = ROUND(LEAST(100.0, (search_daily_rollups.clicked_product_count::numeric / GREATEST(search_daily_rollups.search_volume + EXCLUDED.search_volume, 1)::numeric) * 100), 2),
					updated_at = EXCLUDED.updated_at
			`, acc.date, acc.keyword, acc.productType, acc.vol, acc.zero, now, now).Error
		}
	}

	for {
		select {
		case <-s.stopChan:
			flush()
			return
		case event := <-s.telemetryChan:
			batch = append(batch, event)
			if len(batch) >= 50 {
				flush()
			}
		case <-ticker.C:
			if len(batch) > 0 {
				flush()
			}
		}
	}
}

// Stop gracefully flushes remaining items in buffer.
func (s *SearchTelemetryService) Stop() {
	if s == nil {
		return
	}
	s.closeOnce.Do(func() {
		close(s.stopChan)
	})
}

func (s *SearchTelemetryService) startClickWorker() {
	defer func() {
		if r := recover(); r != nil {
			log.Error().Interface("panic", r).Msg("Recovered from panic in SearchTelemetryService click worker")
			go s.startClickWorker()
		}
	}()
	for {
		select {
		case <-s.stopChan:
			return
		case ev := <-s.clickChan:
			s.persistSearchClick(ev)
		}
	}
}

func (s *SearchTelemetryService) persistSearchClick(ev searchClickEvent) {
	if s == nil || s.db == nil {
		return
	}
	now := time.Now().UTC()
	err := s.db.Exec(`
		INSERT INTO search_daily_rollups (date, keyword, product_type, search_volume, zero_result_count, clicked_product_count, ctr_percentage, created_at, updated_at)
		VALUES (?, ?, ?, 1, 0, 1, 100.0, ?, ?)
		ON CONFLICT (date, keyword) DO UPDATE SET
			clicked_product_count = search_daily_rollups.clicked_product_count + 1,
			ctr_percentage = ROUND(LEAST(100.0, ((search_daily_rollups.clicked_product_count + 1)::numeric / GREATEST(search_daily_rollups.search_volume, 1)::numeric) * 100), 2),
			updated_at = ?
	`, ev.date, ev.keyword, ev.productType, now, now, now).Error
	observeCycle("search_click", 0, 0, err)
	if err != nil {
		log.Warn().Err(err).Str("keyword", ev.keyword).Msg("Failed to record search click attribution")
	}
}

// RecordSearchClick records when a user clicks into a product or catalog from search results.
// Uses a bounded non-blocking channel instead of spawning unbounded goroutines per click.
func (s *SearchTelemetryService) RecordSearchClick(keyword string, productType string) {
	if s == nil || s.db == nil {
		return
	}
	cleanKw := CleanSearchKeyword(keyword)
	if cleanKw == "" {
		return
	}
	if productType == "" {
		productType = "all"
	}
	ev := searchClickEvent{
		date:        time.Now().UTC().Format("2006-01-02"),
		keyword:     cleanKw,
		productType: productType,
	}
	if s.clickChan == nil {
		s.persistSearchClick(ev)
		return
	}
	select {
	case s.clickChan <- ev:
	default:
		log.Warn().Str("keyword", cleanKw).Msg("Search click buffer full; click attribution dropped safely")
	}
}

// RollupDailySearchTrends aggregates raw searches into daily rollups for fast reporting.
func RollupDailySearchTrends(db *gorm.DB, targetDate string) error {
	if db == nil {
		return nil
	}
	if targetDate == "" {
		targetDate = time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02")
	}

	type RollupRow struct {
		Keyword         string `gorm:"column:keyword"`
		ProductType     string `gorm:"column:product_type"`
		SearchVolume    int    `gorm:"column:search_volume"`
		ZeroResultCount int    `gorm:"column:zero_result_count"`
	}

	var rows []RollupRow
	err := db.Raw(`
		SELECT 
			clean_keyword as keyword,
			COALESCE(MODE() WITHIN GROUP (ORDER BY product_type), 'all') as product_type,
			COUNT(*) as search_volume,
			SUM(CASE WHEN is_zero_result THEN 1 ELSE 0 END) as zero_result_count
		FROM search_analytics
		WHERE date = ?
		GROUP BY clean_keyword
		HAVING COUNT(*) >= 1
	`, targetDate).Scan(&rows).Error
	if err != nil {
		log.Error().Err(err).Str("date", targetDate).Msg("Failed to query raw search analytics for rollup")
		return err
	}

	now := time.Now().UTC()
	for _, r := range rows {
		// Use atomic upsert that preserves existing clicked_product_count and updates CTR
		err := db.Exec(`
			INSERT INTO search_daily_rollups (date, keyword, product_type, search_volume, zero_result_count, clicked_product_count, ctr_percentage, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 0, 0.0, ?, ?)
			ON CONFLICT (date, keyword) DO UPDATE SET
				product_type = EXCLUDED.product_type,
				search_volume = EXCLUDED.search_volume,
				zero_result_count = EXCLUDED.zero_result_count,
				ctr_percentage = ROUND(LEAST(100.0, (search_daily_rollups.clicked_product_count::numeric / GREATEST(EXCLUDED.search_volume, 1)::numeric) * 100), 2),
				updated_at = ?
		`, targetDate, r.Keyword, r.ProductType, r.SearchVolume, r.ZeroResultCount, now, now, now).Error
		if err != nil {
			log.Warn().Err(err).Str("keyword", r.Keyword).Msg("Failed to upsert search daily rollup row")
		}
	}

	log.Info().Str("date", targetDate).Int("rows", len(rows)).Msg("Search daily rollups computed successfully")
	return nil
}

// RollupDailyMarketTrends snapshots category & product-type performance metrics.
func RollupDailyMarketTrends(db *gorm.DB, targetDate string) error {
	if db == nil {
		return nil
	}
	if targetDate == "" {
		targetDate = time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02")
	}

	type CatRollupRow struct {
		ProductType  string  `gorm:"column:product_type"`
		CategoryName string  `gorm:"column:category_name"`
		ActiveCount  int64   `gorm:"column:active_count"`
		AvgPrice     float64 `gorm:"column:avg_price"`
		Views        int64   `gorm:"column:views"`
		WAClicks     int64   `gorm:"column:wa_clicks"`
		RekberClicks int64   `gorm:"column:rekber_clicks"`
	}

	var rows []CatRollupRow
	err := db.Raw(`
		SELECT 
			COALESCE(NULLIF(p.product_type, ''), 'physical') as product_type,
			COALESCE(c.name, 'Umum') as category_name,
			COUNT(DISTINCT p.id) as active_count,
			COALESCE(AVG(CASE WHEN p.price > 0 THEN p.price END), 0) as avg_price,
			COALESCE(SUM(COALESCE(pda.views, 0)), 0) as views,
			COALESCE(SUM(COALESCE(pda.wa_clicks, 0)), 0) as wa_clicks,
			COALESCE(SUM(COALESCE(pda.rekber_clicks, 0)), 0) as rekber_clicks
		FROM products p
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN (
			SELECT product_id, SUM(views) as views, SUM(direct_wa_clicks) as wa_clicks, SUM(rekber_clicks) as rekber_clicks
			FROM product_daily_analytics
			WHERE date = ?
			GROUP BY product_id
		) pda ON pda.product_id = p.id
		WHERE p.is_active = true
		GROUP BY COALESCE(NULLIF(p.product_type, ''), 'physical'), COALESCE(c.name, 'Umum')
		HAVING COUNT(DISTINCT p.id) >= 1
	`, targetDate).Scan(&rows).Error
	if err != nil {
		return err
	}

	for _, r := range rows {
		totalActions := r.WAClicks + r.RekberClicks
		convRate := 0.0
		if r.Views > 0 {
			convRate = math.Round((float64(totalActions)/float64(r.Views))*10000) / 100
		}

		item := models.MarketDailyRollup{
			Date:                targetDate,
			ProductType:         r.ProductType,
			CategoryName:        r.CategoryName,
			TotalActiveProducts: r.ActiveCount,
			TotalViews:          r.Views,
			TotalWAClicks:       r.WAClicks,
			TotalRekberClicks:   r.RekberClicks,
			ConversionRate:      convRate,
			AveragePrice:        math.Round(r.AvgPrice),
			CreatedAt:           time.Now().UTC(),
		}

		_ = db.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "date"}, {Name: "product_type"}, {Name: "category_name"}},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"total_active_products": r.ActiveCount,
				"total_views":           r.Views,
				"total_wa_clicks":       r.WAClicks,
				"total_rekber_clicks":   r.RekberClicks,
				"conversion_rate":       convRate,
				"average_price":         math.Round(r.AvgPrice),
			}),
		}).Create(&item).Error
	}

	log.Info().Str("date", targetDate).Int("categories", len(rows)).Msg("Market daily rollups computed successfully")
	return nil
}

// CalculatePriceBenchmarks calculates price distributions ensuring strict K-Anonymity (store_count >= 3, sample >= 5)
// and pure statistical quartiles via PostgreSQL PERCENTILE_CONT.
func CalculatePriceBenchmarks(db *gorm.DB, targetDate string) error {
	if db == nil {
		return nil
	}
	if targetDate == "" {
		targetDate = time.Now().UTC().Format("2006-01-02")
	}

	type BenchRow struct {
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

	var rows []BenchRow
	if db.Dialector != nil && db.Dialector.Name() == "postgres" {
		err := db.Raw(`
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
			HAVING COUNT(DISTINCT p.store_id) >= ? AND COUNT(p.id) >= 5
		`, KAnonymityMinStores).Scan(&rows).Error
		if err != nil {
			log.Warn().Err(err).Msg("CalculatePriceBenchmarks: PERCENTILE_CONT query failed")
			return err
		}
	} else {
		type rawSample struct {
			ProductType  string  `gorm:"column:product_type"`
			CategoryName string  `gorm:"column:category_name"`
			Price        float64 `gorm:"column:price"`
			StoreID      uint    `gorm:"column:store_id"`
		}
		var raw []rawSample
		if err := db.Raw(`
			SELECT COALESCE(NULLIF(p.product_type, ''), 'physical') as product_type, COALESCE(c.name, 'Umum') as category_name, p.price, p.store_id
			FROM products p
			LEFT JOIN categories c ON c.id = p.category_id
			WHERE p.is_active = true AND p.price > 0
		`).Scan(&raw).Error; err != nil {
			return err
		}
		// Reuse portable percentile helper when dialect is non-postgres.
		type bucket struct {
			productType  string
			categoryName string
			prices       []float64
			stores       map[uint]struct{}
			sum          float64
		}
		grouped := make(map[string]*bucket)
		for _, r := range raw {
			key := r.ProductType + "|" + r.CategoryName
			b, ok := grouped[key]
			if !ok {
				b = &bucket{productType: r.ProductType, categoryName: r.CategoryName, stores: make(map[uint]struct{})}
				grouped[key] = b
			}
			b.prices = append(b.prices, r.Price)
			b.stores[r.StoreID] = struct{}{}
			b.sum += r.Price
		}
		for _, b := range grouped {
			if len(b.stores) < KAnonymityMinStores || len(b.prices) < 5 {
				continue
			}
			// Sort ascending using simple insertion/sort helper from stdlib? We can reuse market_intelligence helper cleanly.
			for i := 1; i < len(b.prices); i++ {
				for j := i; j > 0 && b.prices[j] < b.prices[j-1]; j-- {
					b.prices[j], b.prices[j-1] = b.prices[j-1], b.prices[j]
				}
			}
			rows = append(rows, BenchRow{
				ProductType:  b.productType,
				CategoryName: b.categoryName,
				MinPrice:     b.prices[0],
				P25Price:     computeLinearPercentile(b.prices, 0.25),
				MedianPrice:  computeLinearPercentile(b.prices, 0.50),
				P75Price:     computeLinearPercentile(b.prices, 0.75),
				MaxPrice:     b.prices[len(b.prices)-1],
				AvgPrice:     b.sum / float64(len(b.prices)),
				SampleCount:  int64(len(b.prices)),
				StoreCount:   int64(len(b.stores)),
			})
		}
	}

	for _, r := range rows {
		bench := models.CategoryPriceBenchmark{
			Date:         targetDate,
			ProductType:  r.ProductType,
			CategoryName: r.CategoryName,
			MinPrice:     math.Round(r.MinPrice),
			P25Price:     math.Round(r.P25Price),
			MedianPrice:  math.Round(r.MedianPrice),
			P75Price:     math.Round(r.P75Price),
			MaxPrice:     math.Round(r.MaxPrice),
			SampleCount:  r.SampleCount,
			CreatedAt:    time.Now().UTC(),
		}

		_ = db.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "date"}, {Name: "product_type"}, {Name: "category_name"}},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"min_price":    math.Round(r.MinPrice),
				"p25_price":    math.Round(r.P25Price),
				"median_price": math.Round(r.MedianPrice),
				"p75_price":    math.Round(r.P75Price),
				"max_price":    math.Round(r.MaxPrice),
				"sample_count": r.SampleCount,
			}),
		}).Create(&bench).Error
	}

	log.Info().Str("date", targetDate).Int("benchmarks", len(rows)).Msg("Category price benchmarks calculated with strict K-Anonymity")
	return nil
}

// PurgeOldSearchAnalytics90D purges raw search records older than 90 days to keep production database lean.
func PurgeOldSearchAnalytics90D(db *gorm.DB) (int64, error) {
	if db == nil {
		return 0, nil
	}
	cutoff := time.Now().UTC().AddDate(0, 0, -90).Format("2006-01-02")
	res := db.Where("date < ?", cutoff).Delete(&models.SearchAnalytics{})
	if res.Error != nil {
		return 0, res.Error
	}
	if res.RowsAffected > 0 {
		log.Info().Int64("purged_rows", res.RowsAffected).Str("cutoff", cutoff).Msg("Purged raw search analytics older than 90 days")
	}
	return res.RowsAffected, nil
}
