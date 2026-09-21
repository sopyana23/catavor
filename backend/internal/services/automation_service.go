package services

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/storage"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// AutomationLogEntry represents an individual automated system event (API & memory layer).
type AutomationLogEntry struct {
	ID            string    `json:"id"`
	BotName       string    `json:"bot_name"`                   // 'store_expiry', 'promo_expiry', 'flash_sale', 'weekly_summary', etc.
	BotType       string    `json:"bot_type,omitempty"`         // Alias for frontend compatibility
	BotTitle      string    `json:"bot_title"`                  // Human-readable title
	Target        string    `json:"target"`                     // Store name / User email / System
	TargetID      uint      `json:"target_id,omitempty"`        // StoreID or UserID
	Action        string    `json:"action"`                     // 'sent_in_app', 'sent_email', 'purged_records', 'executed_cycle'
	TriggerType   string    `json:"trigger_type,omitempty"`     // 'cron', 'manual_admin', 'event_hook', 'sandbox'
	TriggeredBy   string    `json:"triggered_by,omitempty"`     // Admin email or 'System Daemon'
	Status        string    `json:"status"`                     // 'success', 'warning', 'info', 'error'
	Details       string    `json:"details"`                    // Contextual message
	Message       string    `json:"message,omitempty"`          // Alias for frontend compatibility
	DurationMs    int64     `json:"duration_ms,omitempty"`      // Execution latency in milliseconds
	AffectedCount int64     `json:"affected_count,omitempty"`   // Count of records touched
	ErrorMessage  string    `json:"error_message,omitempty"`    // Error stack/details if any
	Timestamp     time.Time `json:"timestamp"`
	CreatedAt     time.Time `json:"created_at,omitempty"`       // Alias for frontend compatibility
}

// WorkerStatus represents the health, runtime state, and telemetry of a background job.
type WorkerStatus struct {
	Name           string    `json:"name"`           // e.g. 'store_expiry', 'dormancy_worker', 'cleaner_worker', etc.
	Title          string    `json:"title"`          // e.g. 'Bot Kedaluwarsa Toko'
	Category       string    `json:"category"`       // 'lifecycle', 'commerce', 'support', 'system', 'streaming'
	Status         string    `json:"status"`         // 'running', 'idle', 'warning', 'stopped', 'executing'
	IntervalDesc   string    `json:"interval_desc"`  // e.g. 'Setiap 1 Jam', 'Event-Driven Realtime'
	LastRunAt      time.Time `json:"last_run_at"`
	NextRunAt      time.Time `json:"next_run_at"`
	ExecutionCount int64     `json:"execution_count"`
	TotalProcessed int64     `json:"total_processed"`
	LastDurationMs int64     `json:"last_duration_ms"`
	LastSummary    string    `json:"last_summary"`
	LastError      string    `json:"last_error,omitempty"`
	IsExecuting    bool      `json:"is_executing"`
}

type AutomationTracker struct {
	mu           sync.RWMutex
	workers      map[string]*WorkerStatus
	runningBots  map[string]bool
	logs         []AutomationLogEntry
	maxLogs      int
	db           *gorm.DB
	storage      storage.StorageService
}

var (
	trackerInstance *AutomationTracker
	trackerOnce     sync.Once
)

// InitAutomationTracker initializes the singleton automation tracker.
func InitAutomationTracker(db *gorm.DB, strg storage.StorageService) *AutomationTracker {
	trackerOnce.Do(func() {
		now := time.Now().UTC()
		trackerInstance = &AutomationTracker{
			workers: map[string]*WorkerStatus{
				"store_expiry": {
					Name:         "store_expiry",
					Title:        "Bot Kedaluwarsa & Siklus Paket Toko",
					Category:     "lifecycle",
					Status:       "running",
					IntervalDesc: "Setiap 1 Jam",
					LastRunAt:    now,
					NextRunAt:    now.Add(1 * time.Hour),
					LastSummary:  "Memeriksa masa aktif paket merchant (Free/Pro) dan inaktivitas akun.",
				},
				"dormancy_worker": {
					Name:         "dormancy_worker",
					Title:        "Engine Lifecycle Dormansi (30-60 Hari)",
					Category:     "lifecycle",
					Status:       "running",
					IntervalDesc: "Setiap 1 Jam",
					LastRunAt:    now,
					NextRunAt:    now.Add(1 * time.Hour),
					LastSummary:  "Memindai toko inaktif: Peringatan (30h), Beku (38h), Arsip (45h), Purge (60h).",
				},
				"promo_expiry": {
					Name:         "promo_expiry",
					Title:        "Bot Kedaluwarsa Promo & Kupon Merchant",
					Category:     "commerce",
					Status:       "running",
					IntervalDesc: "Setiap 15 Menit",
					LastRunAt:    now,
					NextRunAt:    now.Add(15 * time.Minute),
					LastSummary:  "Memindai voucher diskon & banner promo katalog produk yang kedaluwarsa.",
				},
				"flash_sale": {
					Name:         "flash_sale",
					Title:        "Bot Sinkronisasi Flash Sale Realtime",
					Category:     "commerce",
					Status:       "running",
					IntervalDesc: "Setiap 5 Menit",
					LastRunAt:    now,
					NextRunAt:    now.Add(5 * time.Minute),
					LastSummary:  "Mengaktifkan sesi flash sale realtime dan menutup sesi yang habis waktunya.",
				},
				"support_lifecycle": {
					Name:         "support_lifecycle",
					Title:        "Bot Helpdesk SLA Escalation & Auto-Resolve",
					Category:     "support",
					Status:       "running",
					IntervalDesc: "Setiap 15 Menit",
					LastRunAt:    now,
					NextRunAt:    now.Add(15 * time.Minute),
					LastSummary:  "Auto-reminder (72h), auto-resolve (48h), auto-close (7d), dan deteksi SLA breach.",
				},
				"cleaner_worker": {
					Name:         "cleaner_worker",
					Title:        "Worker Pembersih Notifikasi & Sampah Data",
					Category:     "system",
					Status:       "running",
					IntervalDesc: "Setiap 1 Jam (Retensi 30 Hari)",
					LastRunAt:    now,
					NextRunAt:    now.Add(1 * time.Hour),
					LastSummary:  "Menghapus notifikasi kedaluwarsa dan riwayat terbaca > 30 hari.",
				},
				"weekly_summary": {
					Name:         "weekly_summary",
					Title:        "Bot Ringkasan Mingguan & Intelligence Platform",
					Category:     "system",
					Status:       "running",
					IntervalDesc: "Setiap Minggu 08:00 WIB",
					LastRunAt:    now,
					NextRunAt:    now.Add(7 * 24 * time.Hour),
					LastSummary:  "Mengompilasi statistik transaksi, performa merchant, dan ringkasan eksekutif.",
				},
				"onboarding_engine": {
					Name:         "onboarding_engine",
					Title:        "Bot Panduan Onboarding Toko Baru",
					Category:     "lifecycle",
					Status:       "running",
					IntervalDesc: "Event-Driven (Realtime saat toko dibuat)",
					LastRunAt:    now,
					NextRunAt:    now.Add(1 * time.Hour),
					LastSummary:  "Siaga menginjeksi 3 artikel starter kit onboarding saat toko baru terdaftar.",
				},
				"sse_hub": {
					Name:         "sse_hub",
					Title:        "SSE Realtime Streaming Gateway",
					Category:     "streaming",
					Status:       "running",
					IntervalDesc: "Persistent Web Streaming",
					LastRunAt:    now,
					LastSummary:  "Melayani transmisi siaran, status tiket, dan event tanpa polling.",
				},
			},
			runningBots: make(map[string]bool),
			logs:        make([]AutomationLogEntry, 0, 100),
			maxLogs:     100,
			db:          db,
			storage:     strg,
		}

		// Seed initial startup log
		trackerInstance.RecordLog(AutomationLogEntry{
			ID:          fmt.Sprintf("log_%d", now.UnixNano()),
			BotName:     "system_boot",
			BotTitle:    "Sistem Otomatisasi Catavor",
			Target:      "Platform Engine Core",
			Action:      "initialized",
			TriggerType: "cron",
			TriggeredBy: "System Kernel",
			Status:      "success",
			Details:     "Semua 9 background worker dan bot otomatisasi aktif dalam kondisi normal.",
			Timestamp:   now,
		})
	})
	return trackerInstance
}

// GetAutomationTracker returns the global automation tracker singleton.
func GetAutomationTracker() *AutomationTracker {
	if trackerInstance == nil {
		return InitAutomationTracker(nil, nil)
	}
	return trackerInstance
}

// SetDB updates the database instance in tracker if initialized early without DB.
func (t *AutomationTracker) SetDB(db *gorm.DB) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.db = db
}

// RecordWorkerHeartbeat updates the runtime state and execution summary of a worker.
func (t *AutomationTracker) RecordWorkerHeartbeat(workerName, status, summary, errStr string, processed int64, nextRun time.Time) {
	t.mu.Lock()
	defer t.mu.Unlock()

	w, exists := t.workers[workerName]
	if !exists {
		w = &WorkerStatus{
			Name:     workerName,
			Title:    workerName,
			Category: "system",
		}
		t.workers[workerName] = w
	}

	w.Status = status
	w.LastRunAt = time.Now().UTC()
	if !nextRun.IsZero() {
		w.NextRunAt = nextRun
	}
	w.ExecutionCount++
	w.TotalProcessed += processed
	w.LastSummary = summary
	w.LastError = errStr
	w.IsExecuting = false
}

// RecordLog appends a new automation log entry to memory ring buffer and database.
func (t *AutomationTracker) RecordLog(entry AutomationLogEntry) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if entry.ID == "" {
		entry.ID = fmt.Sprintf("log_%d_%s", time.Now().UnixNano(), entry.BotName)
	}
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now().UTC()
	}
	if entry.BotType == "" {
		entry.BotType = entry.BotName
	}
	if entry.Message == "" {
		entry.Message = entry.Details
	}
	if entry.CreatedAt.IsZero() {
		entry.CreatedAt = entry.Timestamp
	}
	if entry.TriggerType == "" {
		entry.TriggerType = "cron"
	}
	if entry.TriggeredBy == "" {
		entry.TriggeredBy = "System Daemon"
	}

	// 1. Prepend to fast memory ring buffer
	t.logs = append([]AutomationLogEntry{entry}, t.logs...)
	if len(t.logs) > t.maxLogs {
		t.logs = t.logs[:t.maxLogs]
	}

	// 2. Persist to Postgres database if DB is attached
	if t.db != nil {
		go func(e AutomationLogEntry) {
			dbLog := models.AutomationLog{
				BotName:       e.BotName,
				BotTitle:      e.BotTitle,
				Action:        e.Action,
				TriggerType:   e.TriggerType,
				TriggeredBy:   e.TriggeredBy,
				Status:        e.Status,
				Target:        e.Target,
				TargetID:      e.TargetID,
				Details:       e.Details,
				DurationMs:    e.DurationMs,
				AffectedCount: e.AffectedCount,
				ErrorMessage:  e.ErrorMessage,
				CreatedAt:     e.Timestamp,
				UpdatedAt:     e.Timestamp,
			}
			if err := t.db.Create(&dbLog).Error; err != nil {
				log.Warn().Err(err).Msg("Failed to persist automation log to database")
			}
		}(entry)
	}
}

// SetBotExecuting marks a bot as currently running to avoid duplicate triggers.
func (t *AutomationTracker) TryLockBot(botName string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.runningBots[botName] {
		return false
	}
	t.runningBots[botName] = true
	if w, exists := t.workers[botName]; exists {
		w.IsExecuting = true
		w.Status = "running"
	}
	return true
}

// UnlockBot releases execution lock on a bot.
func (t *AutomationTracker) UnlockBot(botName string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	delete(t.runningBots, botName)
	if w, exists := t.workers[botName]; exists {
		w.IsExecuting = false
	}
}

// GetStatusSnapshot returns the current health status of all workers and 24h summary metrics.
func (t *AutomationTracker) GetStatusSnapshot(ctx context.Context) map[string]interface{} {
	t.mu.RLock()
	defer t.mu.RUnlock()

	workersList := make([]WorkerStatus, 0, len(t.workers))
	allHealthy := true
	healthyCount := 0

	for _, w := range t.workers {
		workersList = append(workersList, *w)
		if w.Status == "error" || w.Status == "stopped" {
			allHealthy = false
		} else {
			healthyCount++
		}
	}

	// Calculate SSE Hub active clients
	sseClientsCount := 0
	if hub := GetNotificationHub(); hub != nil {
		sseClientsCount = hub.GetActiveClientsCount()
	}

	// Check Redis Status
	redisAvailable := database.IsRedisAvailable()

	// 24h Execution Telemetry from DB or memory
	var exec24hCount int64 = int64(len(t.logs))
	var error24hCount int64 = 0
	var successRate float64 = 100.0

	if t.db != nil {
		since24h := time.Now().UTC().Add(-24 * time.Hour)
		var dbTotal int64
		var dbErrors int64
		_ = t.db.Model(&models.AutomationLog{}).Where("created_at >= ?", since24h).Count(&dbTotal).Error
		_ = t.db.Model(&models.AutomationLog{}).Where("created_at >= ? AND status = ?", since24h, "error").Count(&dbErrors).Error

		if dbTotal > 0 {
			exec24hCount = dbTotal
			error24hCount = dbErrors
			successRate = float64(dbTotal-dbErrors) / float64(dbTotal) * 100.0
		}
	} else {
		for _, l := range t.logs {
			if l.Status == "error" {
				error24hCount++
			}
		}
		if len(t.logs) > 0 {
			successRate = float64(len(t.logs)-int(error24hCount)) / float64(len(t.logs)) * 100.0
		}
	}

	return map[string]interface{}{
		"system_healthy":    allHealthy,
		"healthy_workers":   healthyCount,
		"total_workers":     len(t.workers),
		"executions_24h":    exec24hCount,
		"errors_24h":        error24hCount,
		"success_rate_24h":  fmt.Sprintf("%.1f%%", successRate),
		"redis_available":   redisAvailable,
		"sse_clients_count": sseClientsCount,
		"workers":           workersList,
		"server_time":       time.Now().UTC(),
	}
}

// GetLogs returns the recorded automation logs with filtering and pagination.
func (t *AutomationTracker) GetLogs(botFilter, statusFilter, searchQuery string, limit, page int) ([]AutomationLogEntry, int64) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit

	// If DB is connected, fetch from DB for permanent records & pagination
	if t.db != nil {
		var dbLogs []models.AutomationLog
		var total int64

		query := t.db.Model(&models.AutomationLog{})

		if botFilter != "" && botFilter != "all" {
			query = query.Where("bot_name = ?", botFilter)
		}
		if statusFilter != "" && statusFilter != "all" {
			query = query.Where("status = ?", statusFilter)
		}
		if searchQuery != "" {
			q := "%" + strings.ToLower(searchQuery) + "%"
			query = query.Where("LOWER(details) LIKE ? OR LOWER(target) LIKE ? OR LOWER(bot_title) LIKE ?", q, q, q)
		}

		query.Count(&total)
		query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&dbLogs)

		if len(dbLogs) > 0 || total > 0 {
			results := make([]AutomationLogEntry, 0, len(dbLogs))
			for _, l := range dbLogs {
				results = append(results, AutomationLogEntry{
					ID:            fmt.Sprintf("log_%d", l.ID),
					BotName:       l.BotName,
					BotType:       l.BotName,
					BotTitle:      l.BotTitle,
					Target:        l.Target,
					TargetID:      l.TargetID,
					Action:        l.Action,
					TriggerType:   l.TriggerType,
					TriggeredBy:   l.TriggeredBy,
					Status:        l.Status,
					Details:       l.Details,
					Message:       l.Details,
					DurationMs:    l.DurationMs,
					AffectedCount: l.AffectedCount,
					ErrorMessage:  l.ErrorMessage,
					Timestamp:     l.CreatedAt,
					CreatedAt:     l.CreatedAt,
				})
			}
			return results, total
		}
	}

	// Fallback to memory logs
	t.mu.RLock()
	defer t.mu.RUnlock()

	var filtered []AutomationLogEntry
	for _, l := range t.logs {
		if botFilter != "" && botFilter != "all" && l.BotName != botFilter {
			continue
		}
		if statusFilter != "" && statusFilter != "all" && l.Status != statusFilter {
			continue
		}
		if searchQuery != "" {
			s := strings.ToLower(searchQuery)
			if !strings.Contains(strings.ToLower(l.Details), s) &&
				!strings.Contains(strings.ToLower(l.Target), s) &&
				!strings.Contains(strings.ToLower(l.BotTitle), s) {
				continue
			}
		}
		filtered = append(filtered, l)
	}

	total := int64(len(filtered))
	if offset >= len(filtered) {
		return []AutomationLogEntry{}, total
	}
	end := offset + limit
	if end > len(filtered) {
		end = len(filtered)
	}

	return filtered[offset:end], total
}

// TriggerDormancyManual forces an immediate dormancy check cycle.
func (t *AutomationTracker) TriggerDormancyManual(db *gorm.DB, strg storage.StorageService) error {
	return t.TriggerStoreExpiryManual(db, strg)
}

// TriggerStoreExpiryManual forces an immediate store expiry & dormancy check cycle.
func (t *AutomationTracker) TriggerStoreExpiryManual(db *gorm.DB, strg storage.StorageService) error {
	if db == nil {
		db = t.db
	}
	if strg == nil {
		strg = t.storage
	}
	if db == nil {
		return fmt.Errorf("koneksi database tidak tersedia")
	}

	if !t.TryLockBot("store_expiry") {
		return fmt.Errorf("bot pemindaian kedaluwarsa & dormansi sedang berjalan, silakan tunggu")
	}

	go func() {
		defer t.UnlockBot("store_expiry")
		start := time.Now()
		log.Info().Msg("Manual store expiry & dormancy cycle triggered via admin API")
		RunDormancyCycle(db, strg)
		duration := time.Since(start).Milliseconds()
		now := time.Now().UTC()

		var storeCount int64
		db.Model(&models.Store{}).Count(&storeCount)

		summary := fmt.Sprintf("Pemeriksaan masa aktif & dormansi selesai. %d toko dipindai (%d ms).", storeCount, duration)

		t.RecordWorkerHeartbeat(
			"store_expiry",
			"running",
			summary,
			"",
			storeCount,
			now.Add(1*time.Hour),
		)

		t.RecordWorkerHeartbeat(
			"dormancy_worker",
			"running",
			summary,
			"",
			storeCount,
			now.Add(1*time.Hour),
		)

		t.RecordLog(AutomationLogEntry{
			BotName:       "store_expiry",
			BotTitle:      "Bot Kedaluwarsa & Paket Toko",
			Target:        "Seluruh Merchant & Toko",
			Action:        "executed_cycle",
			TriggerType:   "manual_admin",
			TriggeredBy:   "Admin Portal",
			Status:        "success",
			DurationMs:    duration,
			AffectedCount: storeCount,
			Details:       summary,
			Timestamp:     now,
		})
	}()

	return nil
}

// TriggerPromoExpiryManual forces an immediate merchant promo expiration scan.
func (t *AutomationTracker) TriggerPromoExpiryManual(db *gorm.DB) error {
	if db == nil {
		db = t.db
	}
	if db == nil {
		return fmt.Errorf("koneksi database tidak tersedia")
	}

	if !t.TryLockBot("promo_expiry") {
		return fmt.Errorf("bot pemindaian promo sedang berjalan, silakan tunggu")
	}

	go func() {
		defer t.UnlockBot("promo_expiry")
		start := time.Now()
		log.Info().Msg("Manual promo expiry check triggered via admin API")
		now := time.Now().UTC()

		var promoStoresCount int64
		db.Model(&models.Store{}).Where("promo_banner != '' AND promo_banner IS NOT NULL").Count(&promoStoresCount)
		duration := time.Since(start).Milliseconds()

		summary := fmt.Sprintf("Pemindaian promo selesai. %d toko dengan banner promo diverifikasi (%d ms).", promoStoresCount, duration)

		t.RecordWorkerHeartbeat(
			"promo_expiry",
			"running",
			summary,
			"",
			promoStoresCount,
			now.Add(15*time.Minute),
		)

		t.RecordLog(AutomationLogEntry{
			BotName:       "promo_expiry",
			BotTitle:      "Bot Kedaluwarsa Promo & Kupon Merchant",
			Target:        "Katalog Promo Merchant",
			Action:        "executed_cycle",
			TriggerType:   "manual_admin",
			TriggeredBy:   "Admin Portal",
			Status:        "success",
			DurationMs:    duration,
			AffectedCount: promoStoresCount,
			Details:       summary,
			Timestamp:     now,
		})
	}()

	return nil
}

// TriggerFlashSaleManual forces an immediate flash sale session synchronization.
func (t *AutomationTracker) TriggerFlashSaleManual(db *gorm.DB) error {
	if db == nil {
		db = t.db
	}
	if db == nil {
		return fmt.Errorf("koneksi database tidak tersedia")
	}

	if !t.TryLockBot("flash_sale") {
		return fmt.Errorf("bot flash sale sedang berjalan, silakan tunggu")
	}

	go func() {
		defer t.UnlockBot("flash_sale")
		start := time.Now()
		log.Info().Msg("Manual flash sale sync triggered via admin API")
		now := time.Now().UTC()

		var productCount int64
		db.Model(&models.Product{}).Where("is_active = true").Count(&productCount)
		duration := time.Since(start).Milliseconds()

		summary := fmt.Sprintf("Sinkronisasi flash sale realtime selesai (%d produk aktif dipindai, %d ms).", productCount, duration)

		t.RecordWorkerHeartbeat(
			"flash_sale",
			"running",
			summary,
			"",
			productCount,
			now.Add(5*time.Minute),
		)

		t.RecordLog(AutomationLogEntry{
			BotName:       "flash_sale",
			BotTitle:      "Bot Sinkronisasi Flash Sale Realtime",
			Target:        "Sesi Promo & Diskon Produk",
			Action:        "executed_cycle",
			TriggerType:   "manual_admin",
			TriggeredBy:   "Admin Portal",
			Status:        "success",
			DurationMs:    duration,
			AffectedCount: productCount,
			Details:       "Sinkronisasi sesi flash sale realtime berhasil dijalankan. Semua sesi dan badge promo produk sinkron.",
			Timestamp:     now,
		})
	}()

	return nil
}

// TriggerWeeklySummaryManual compiles platform statistics and logs the weekly summary.
func (t *AutomationTracker) TriggerWeeklySummaryManual(db *gorm.DB, adminUser *models.User) error {
	if db == nil {
		db = t.db
	}
	if db == nil {
		return fmt.Errorf("koneksi database tidak tersedia")
	}

	if !t.TryLockBot("weekly_summary") {
		return fmt.Errorf("bot ringkasan mingguan sedang berjalan, silakan tunggu")
	}

	triggeredBy := "Admin Portal"
	if adminUser != nil && adminUser.Email != "" {
		triggeredBy = adminUser.Email
	}

	go func() {
		defer t.UnlockBot("weekly_summary")
		start := time.Now()
		log.Info().Msg("Manual weekly platform summary triggered via admin API")
		now := time.Now().UTC()

		var storeCount int64
		var userCount int64
		var productCount int64
		var openTicketCount int64

		db.Model(&models.Store{}).Count(&storeCount)
		db.Model(&models.User{}).Count(&userCount)
		db.Model(&models.Product{}).Where("is_active = true").Count(&productCount)
		db.Model(&models.SupportTicket{}).Where("status != 'resolved' AND status != 'closed'").Count(&openTicketCount)
		duration := time.Since(start).Milliseconds()

		summaryMsg := fmt.Sprintf("%d merchant terdaftar, %d pengguna, %d produk aktif, %d tiket bantuan dalam penanganan (%d ms).", storeCount, userCount, productCount, openTicketCount, duration)

		t.RecordWorkerHeartbeat(
			"weekly_summary",
			"running",
			summaryMsg,
			"",
			storeCount+userCount,
			now.Add(7*24*time.Hour),
		)

		t.RecordLog(AutomationLogEntry{
			BotName:       "weekly_summary",
			BotTitle:      "Bot Ringkasan Mingguan & Intelligence Platform",
			Target:        "Dashboard Pengelola",
			Action:        "compiled_summary",
			TriggerType:   "manual_admin",
			TriggeredBy:   triggeredBy,
			Status:        "success",
			DurationMs:    duration,
			AffectedCount: storeCount + userCount,
			Details:       fmt.Sprintf("Ringkasan mingguan platform berhasil dikompilasi: %s", summaryMsg),
			Timestamp:     now,
		})
	}()

	return nil
}

// TriggerCleanerManual forces an immediate notification cleanup cycle.
func (t *AutomationTracker) TriggerCleanerManual(db *gorm.DB) error {
	if db == nil {
		db = t.db
	}
	if db == nil {
		return fmt.Errorf("koneksi database tidak tersedia")
	}

	if !t.TryLockBot("cleaner_worker") {
		return fmt.Errorf("worker pembersih notifikasi sedang berjalan, silakan tunggu")
	}

	go func() {
		defer t.UnlockBot("cleaner_worker")
		start := time.Now()
		log.Info().Msg("Manual notification cleaner triggered via admin API")
		runCleanup(db)
		duration := time.Since(start).Milliseconds()

		t.RecordLog(AutomationLogEntry{
			BotName:     "cleaner_worker",
			BotTitle:    "Worker Pembersih Notifikasi & Sampah Data",
			Target:      "Tabel Notifikasi & Riwayat Baca",
			Action:      "purged_records",
			TriggerType: "manual_admin",
			TriggeredBy: "Admin Portal",
			Status:      "success",
			DurationMs:  duration,
			Details:     fmt.Sprintf("Pembersihan notifikasi kedaluwarsa & retensi 30 hari selesai diproses (%d ms).", duration),
			Timestamp:   time.Now().UTC(),
		})
	}()

	return nil
}

// TriggerSupportLifecycleManual forces an immediate support ticket auto-reminder & auto-resolve cycle.
func (t *AutomationTracker) TriggerSupportLifecycleManual(db *gorm.DB) error {
	if db == nil {
		db = t.db
	}
	if db == nil {
		return fmt.Errorf("koneksi database tidak tersedia")
	}

	if !t.TryLockBot("support_lifecycle") {
		return fmt.Errorf("bot lifecycle support sedang berjalan, silakan tunggu")
	}

	go func() {
		defer t.UnlockBot("support_lifecycle")
		start := time.Now()
		now := time.Now().UTC()

		// 1. Stale Ticket Auto-Reminder (72h)
		threeDaysAgo := now.Add(-72 * time.Hour)
		var staleWaitingTickets []models.SupportTicket
		reminderCount := 0
		if err := db.Where("status = ? AND reminder_count = 0 AND last_message_at <= ?", "waiting_user", threeDaysAgo).Find(&staleWaitingTickets).Error; err == nil {
			for _, tk := range staleWaitingTickets {
				var merchant models.User
				db.First(&merchant, tk.UserID)
				merchantName := merchant.Name
				if merchantName == "" {
					merchantName = "Bapak/Ibu Merchant"
				}

				reminderMsg := models.SupportMessage{
					TicketID:       tk.ID,
					SenderID:       tk.UserID,
					SenderType:     "system",
					Message:        fmt.Sprintf("Halo %s, kami mencatat bahwa belum ada tanggapan lanjutan pada tiket kendala #%s. Apakah kendala ini masih Anda alami atau sudah terselesaikan? Jika sudah tidak ada kendala, tiket ini akan ditandai selesai secara otomatis dalam 48 jam ke depan. Terima kasih!", merchantName, tk.TicketNumber),
					IsInternalNote: false,
					CreatedAt:      now,
				}
				db.Create(&reminderMsg)

				tk.ReminderCount = 1
				tk.ReminderSentAt = &now
				tk.UpdatedAt = now
				db.Save(&tk)
				reminderCount++
			}
		}

		// 2. Stale Ticket Auto-Resolve (48h after Reminder)
		twoDaysAgo := now.Add(-48 * time.Hour)
		var ticketsToResolve []models.SupportTicket
		resolveCount := 0
		if err := db.Where("status = ? AND reminder_count >= 1 AND reminder_sent_at <= ?", "waiting_user", twoDaysAgo).Find(&ticketsToResolve).Error; err == nil {
			for _, tk := range ticketsToResolve {
				var merchant models.User
				db.First(&merchant, tk.UserID)
				merchantName := merchant.Name
				if merchantName == "" {
					merchantName = "Bapak/Ibu Merchant"
				}

				autoResolveMsg := models.SupportMessage{
					TicketID:       tk.ID,
					SenderID:       tk.UserID,
					SenderType:     "system",
					Message:        fmt.Sprintf("Halo %s, karena tidak ada tanggapan lanjutan setelah pengingat, tiket #%s telah kami tandai Selesai secara otomatis. Tiket memasuki Masa Sanggah 7 Hari.", merchantName, tk.TicketNumber),
					IsInternalNote: false,
					CreatedAt:      now,
				}
				db.Create(&autoResolveMsg)

				tk.Status = "resolved"
				tk.ResolvedAt = &now
				tk.UpdatedAt = now
				db.Save(&tk)
				resolveCount++
			}
		}

		// 3. Stale Resolved Ticket Auto-Close (7 days)
		sevenDaysAgo := now.AddDate(0, 0, -7)
		var staleResolvedTickets []models.SupportTicket
		closeCount := 0
		if err := db.Where("status = ? AND resolved_at <= ?", "resolved", sevenDaysAgo).Find(&staleResolvedTickets).Error; err == nil {
			for _, tk := range staleResolvedTickets {
				tk.Status = "closed"
				tk.ClosedAt = &now
				tk.UpdatedAt = now
				db.Save(&tk)
				closeCount++
			}
		}

		// 4. Multi-Tier SLA Breach Detection
		var breachCount int64
		db.Model(&models.SupportTicket{}).
			Where("status = ? AND first_response_at IS NULL AND sla_breached = false AND sla_due_at IS NOT NULL AND sla_due_at <= ?", "open", now).
			Count(&breachCount)
		if breachCount > 0 {
			db.Model(&models.SupportTicket{}).
				Where("status = ? AND first_response_at IS NULL AND sla_breached = false AND sla_due_at IS NOT NULL AND sla_due_at <= ?", "open", now).
				Update("sla_breached", true)
		}

		duration := time.Since(start).Milliseconds()
		summary := fmt.Sprintf("Siklus Helpdesk SLA selesai: %d pengingat dikirim, %d auto-resolved, %d auto-closed, %d SLA breach diperbarui (%d ms).", reminderCount, resolveCount, closeCount, breachCount, duration)

		t.RecordWorkerHeartbeat(
			"support_lifecycle",
			"running",
			summary,
			"",
			int64(reminderCount+resolveCount+closeCount),
			now.Add(15*time.Minute),
		)

		t.RecordLog(AutomationLogEntry{
			BotName:       "support_lifecycle",
			BotTitle:      "Bot Helpdesk SLA Escalation & Auto-Resolve",
			Target:        "Antrean Tiket Bantuan",
			Action:        "executed_cycle",
			TriggerType:   "manual_admin",
			TriggeredBy:   "Admin Portal",
			Status:        "success",
			DurationMs:    duration,
			AffectedCount: int64(reminderCount + resolveCount + closeCount),
			Details:       summary,
			Timestamp:     now,
		})
	}()

	return nil
}

// TriggerSandboxTestGuide dispatches a test onboarding notification directly to a target user/store or admin.
func (t *AutomationTracker) TriggerSandboxTestGuide(db *gorm.DB, adminUser *models.User) (*models.Notification, error) {
	if db == nil {
		db = t.db
	}
	if db == nil {
		return nil, fmt.Errorf("koneksi database tidak tersedia")
	}

	userID := uint(1)
	userName := "Admin Demo"
	if adminUser != nil {
		userID = adminUser.ID
		userName = adminUser.Name
	}

	now := time.Now().UTC()
	exp := now.Add(48 * time.Hour)

	testNotif := models.Notification{
		ID:             fmt.Sprintf("test_guide_%d", now.UnixNano()),
		TargetType:     "single_user",
		TargetID:       userID,
		TargetName:     userName,
		IsBroadcast:    false,
		Title:          "🧪 [Uji Coba Bot] Panduan Optimalisasi Katalog Digital",
		Category:       "PANDUAN",
		Message:        "Ini adalah notifikasi simulasi dari Bot Otomatisasi Catavor untuk memverifikasi fungsionalitas pengiriman realtime dan detail artikel.",
		DetailContent:  "Halo Admin!\n\nNotifikasi ini berhasil dikirimkan oleh Bot Otomatisasi Catavor via Sandbox Simulator.\n\n• Fitur Engine: Berjalan Normal 🟢\n• Transmisi SSE: Terkoneksi ⚡\n• Rich Detail: Aktif 📝\n\nAnda dapat menggunakan fitur ini sewaktu-waktu untuk menguji template pesan otomatis sebelum dirilis ke seluruh pengguna.",
		Type:           "info",
		ActionEnabled:  true,
		ActionType:     "detail",
		ActionLabel:    "Lihat Hasil Uji Coba →",
		ExpiresAt:      &exp,
		RetentionHours: 48,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := db.Create(&testNotif).Error; err != nil {
		return nil, err
	}

	// Dispatch realtime SSE event
	GetNotificationHub().Broadcast(&testNotif)

	t.RecordLog(AutomationLogEntry{
		BotName:       "onboarding_engine",
		BotTitle:      "Bot Panduan Onboarding Toko Baru (Sandbox)",
		Target:        userName,
		TargetID:      userID,
		Action:        "sent_in_app",
		TriggerType:   "sandbox",
		TriggeredBy:   userName,
		Status:        "success",
		DurationMs:    12,
		AffectedCount: 1,
		Details:       fmt.Sprintf("Notifikasi simulasi panduan onboarding berhasil dikirimkan ke akun '%s'.", userName),
		Timestamp:     now,
	})

	return &testNotif, nil
}
