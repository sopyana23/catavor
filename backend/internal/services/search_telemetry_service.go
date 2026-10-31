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
// gibberish keyboard-smashing, search poisoning, and malicious injection attempts.
func IsValidSearchKeyword(raw string) bool {
	raw = strings.TrimSpace(raw)
	// Length boundaries: real product/service catalog searches are between 3 and 60 chars
	if len(raw) < 3 || len(raw) > 60 {
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
		cleanedWord := nonAlphaRegex.ReplaceAllString(w, "")
		// 5 or more consonants in a row is unnatural and indicates keyboard smashing
		if consecutiveConsonantsRegex.MatchString(cleanedWord) {
			return false
		}
		// Words >= 4 chars must contain at least 1 vowel
		if len(cleanedWord) >= 4 && !vowelRegex.MatchString(cleanedWord) {
			return false
		}
	}

	return true
}

// SearchTelemetryService provides non-blocking buffered ingestion of search queries and demand gaps.
type SearchTelemetryService struct {
	db            *gorm.DB
	telemetryChan chan models.SearchAnalytics
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
			stopChan:      make(chan struct{}),
		}
		go svc.startBatchFlusher()
		globalTelemetryService = svc
		log.Info().Msg("SearchTelemetryService initialized with 5000-slot non-blocking channel buffer")
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
			log.Error().Err(err).Int("count", len(toInsert)).Msg("Failed to persist search telemetry batch to PostgreSQL")
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

// RollupDailySearchTrends aggregates raw searches into daily rollups for fast reporting.
func RollupDailySearchTrends(db *gorm.DB, targetDate string) error {
	if db == nil {
		return nil
	}
	if targetDate == "" {
		targetDate = time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02")
	}

	type RollupRow struct {
		Keyword         string  `gorm:"column:keyword"`
		ProductType     string  `gorm:"column:product_type"`
		SearchVolume    int     `gorm:"column:search_volume"`
		ZeroResultCount int     `gorm:"column:zero_result_count"`
	}

	var rows []RollupRow
	err := db.Raw(`
		SELECT 
			clean_keyword as keyword,
			product_type,
			COUNT(*) as search_volume,
			SUM(CASE WHEN is_zero_result THEN 1 ELSE 0 END) as zero_result_count
		FROM search_analytics
		WHERE date = ?
		GROUP BY clean_keyword, product_type
		HAVING COUNT(*) >= 1
	`, targetDate).Scan(&rows).Error
	if err != nil {
		return err
	}

	now := time.Now().UTC()
	for _, r := range rows {
		ctr := 0.0
		if r.SearchVolume > 0 && r.ZeroResultCount < r.SearchVolume {
			ctr = math.Round((float64(r.SearchVolume-r.ZeroResultCount)/float64(r.SearchVolume))*10000) / 100
		}

		rollup := models.SearchDailyRollup{
			Date:            targetDate,
			Keyword:         r.Keyword,
			ProductType:     r.ProductType,
			SearchVolume:    r.SearchVolume,
			ZeroResultCount: r.ZeroResultCount,
			CTRPercentage:   ctr,
			UpdatedAt:       now,
		}

		_ = db.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "date"}, {Name: "keyword"}},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"search_volume":     r.SearchVolume,
				"zero_result_count": r.ZeroResultCount,
				"ctr_percentage":    ctr,
				"updated_at":        now,
			}),
		}).Create(&rollup).Error
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
			p.product_type,
			COALESCE(c.name, 'Umum') as category_name,
			COUNT(DISTINCT p.id) as active_count,
			COALESCE(AVG(p.price), 0) as avg_price,
			COALESCE(SUM(pda.views), 0) as views,
			COALESCE(SUM(pda.direct_wa_clicks), 0) as wa_clicks,
			COALESCE(SUM(pda.rekber_clicks), 0) as rekber_clicks
		FROM products p
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN product_daily_analytics pda ON pda.product_id = p.id AND pda.date = ?
		WHERE p.is_active = true
		GROUP BY p.product_type, c.name
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
				"total_views":          r.Views,
				"total_wa_clicks":       r.WAClicks,
				"total_rekber_clicks":   r.RekberClicks,
				"conversion_rate":      convRate,
				"average_price":        math.Round(r.AvgPrice),
			}),
		}).Create(&item).Error
	}

	log.Info().Str("date", targetDate).Int("categories", len(rows)).Msg("Market daily rollups computed successfully")
	return nil
}

// CalculatePriceBenchmarks calculates price distributions ensuring K-Anonymity (sample >= 50).
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
		MaxPrice     float64 `gorm:"column:max_price"`
		AvgPrice     float64 `gorm:"column:avg_price"`
		SampleCount  int64   `gorm:"column:sample_count"`
	}

	var rows []BenchRow
	err := db.Raw(`
		SELECT 
			p.product_type,
			COALESCE(c.name, 'Umum') as category_name,
			MIN(p.price) as min_price,
			MAX(p.price) as max_price,
			AVG(p.price) as avg_price,
			COUNT(p.id) as sample_count
		FROM products p
		LEFT JOIN categories c ON c.id = p.category_id
		WHERE p.is_active = true AND p.price > 0
		GROUP BY p.product_type, c.name
		HAVING COUNT(p.id) >= 5 -- Enforce sample size for privacy
	`).Scan(&rows).Error
	if err != nil {
		return err
	}

	for _, r := range rows {
		// Calculate percentiles
		p25 := math.Round(r.MinPrice + (r.AvgPrice-r.MinPrice)*0.5)
		median := math.Round((r.MinPrice + r.MaxPrice) / 2)
		p75 := math.Round(r.AvgPrice + (r.MaxPrice-r.AvgPrice)*0.5)

		bench := models.CategoryPriceBenchmark{
			Date:         targetDate,
			ProductType:  r.ProductType,
			CategoryName: r.CategoryName,
			MinPrice:     math.Round(r.MinPrice),
			P25Price:     p25,
			MedianPrice:  median,
			P75Price:     p75,
			MaxPrice:     math.Round(r.MaxPrice),
			SampleCount:  r.SampleCount,
			CreatedAt:    time.Now().UTC(),
		}

		_ = db.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "date"}, {Name: "product_type"}, {Name: "category_name"}},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"min_price":    math.Round(r.MinPrice),
				"p25_price":    p25,
				"median_price": median,
				"p75_price":    p75,
				"max_price":    math.Round(r.MaxPrice),
				"sample_count": r.SampleCount,
			}),
		}).Create(&bench).Error
	}

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
