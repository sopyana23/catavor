package services

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/storage"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// AutomationLogEntry represents an individual automated system event (API & memory layer).
type AutomationLogEntry struct {
	ID            string    `json:"id"`
	BotName       string    `json:"bot_name"`                 // 'store_expiry', 'promo_expiry', 'flash_sale', 'weekly_summary', etc.
	BotType       string    `json:"bot_type,omitempty"`       // Alias for frontend compatibility
	BotTitle      string    `json:"bot_title"`                // Human-readable title
	Target        string    `json:"target"`                   // Store name / User email / System
	TargetID      uint      `json:"target_id,omitempty"`      // StoreID or UserID
	Action        string    `json:"action"`                   // 'sent_in_app', 'sent_email', 'purged_records', 'executed_cycle'
	TriggerType   string    `json:"trigger_type,omitempty"`   // 'cron', 'manual_admin', 'event_hook', 'sandbox'
	TriggeredBy   string    `json:"triggered_by,omitempty"`   // Admin email or 'System Daemon'
	Status        string    `json:"status"`                   // 'success', 'warning', 'info', 'error'
	Details       string    `json:"details"`                  // Contextual message
	Message       string    `json:"message,omitempty"`        // Alias for frontend compatibility
	DurationMs    int64     `json:"duration_ms,omitempty"`    // Execution latency in milliseconds
	AffectedCount int64     `json:"affected_count,omitempty"` // Count of records touched
	ErrorMessage  string    `json:"error_message,omitempty"`  // Error stack/details if any
	Timestamp     time.Time `json:"timestamp"`
	CreatedAt     time.Time `json:"created_at,omitempty"` // Alias for frontend compatibility
}

// WorkerStatus represents the health, runtime state, and telemetry of a background job.
type WorkerStatus struct {
	Manual         bool      `json:"manual"`
	Conditions     string    `json:"conditions"`
	Name           string    `json:"name"`          // e.g. 'store_expiry', 'dormancy_worker', 'cleaner_worker', etc.
	Title          string    `json:"title"`         // e.g. 'Bot Kedaluwarsa Toko'
	Category       string    `json:"category"`      // 'lifecycle', 'commerce', 'support', 'system', 'streaming'
	Status         string    `json:"status"`        // 'running', 'idle', 'warning', 'stopped', 'executing'
	IntervalDesc   string    `json:"interval_desc"` // e.g. 'Setiap 1 Jam', 'Event-Driven Realtime'
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
	mu          sync.RWMutex
	workers     map[string]*WorkerStatus
	runningBots map[string]bool
	logs        []AutomationLogEntry
	maxLogs     int
	db          *gorm.DB
	storage     storage.StorageService
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
			workers:     automationWorkers(),
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
			Details:     "Katalog pekerjaan siap. Status menunggu observasi pertama.",
			Timestamp:   now,
		})
	})
	return trackerInstance
}

// GetAutomationTracker returns the global automation tracker singleton.
func GetAutomationTracker() *AutomationTracker {
	return InitAutomationTracker(nil, nil)
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
	if w.IntervalDesc == "Manual" {
		w.NextRunAt = time.Time{}
	} else if !nextRun.IsZero() {
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
	db := t.db
	t.mu.Unlock()
	if db != nil {
		dbLog := models.AutomationLog{
			BotName:       entry.BotName,
			BotTitle:      entry.BotTitle,
			Action:        entry.Action,
			TriggerType:   entry.TriggerType,
			TriggeredBy:   entry.TriggeredBy,
			Status:        entry.Status,
			Target:        entry.Target,
			TargetID:      entry.TargetID,
			Details:       entry.Details,
			DurationMs:    entry.DurationMs,
			AffectedCount: entry.AffectedCount,
			ErrorMessage:  entry.ErrorMessage,
			CreatedAt:     entry.Timestamp,
			UpdatedAt:     entry.Timestamp,
		}
		if err := db.Create(&dbLog).Error; err != nil {
			log.Warn().Err(err).Msg("Failed to persist automation log to database")
		}
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

	workersList := make([]WorkerStatus, 0, len(t.workers))
	allHealthy := true
	healthyCount := 0

	for _, w := range t.workers {
		observed := *w
		if observed.IsExecuting {
			observed.Status = "executing"
		}
		if !observed.IsExecuting && !observed.NextRunAt.IsZero() && time.Since(observed.NextRunAt) > time.Minute && observed.IntervalDesc != "Manual" {
			observed.Status = "late"
		}
		workersList = append(workersList, observed)
		if observed.ExecutionCount > 0 && observed.LastError == "" && (observed.Status == "running" || observed.Status == "success") {
			healthyCount++
		} else {
			allHealthy = false
		}
	}
	sort.Slice(workersList, func(i, j int) bool { return workersList[i].Name < workersList[j].Name })

	db := t.db
	recent := append([]AutomationLogEntry(nil), t.logs...)
	t.mu.RUnlock()
	// Calculate SSE Hub active clients
	sseClientsCount := 0
	if hub := GetNotificationHub(); hub != nil {
		sseClientsCount = hub.GetActiveClientsCount()
	}

	// Check Redis Status
	redisAvailable := database.IsRedisAvailable()

	since := time.Now().UTC().Add(-24 * time.Hour)
	var stats struct {
		Total  int64
		Errors int64
	}
	var queryErr error
	if db != nil {
		queryErr = db.WithContext(ctx).Model(&models.AutomationLog{}).
			Select("count(*) AS total, count(*) FILTER (WHERE status = 'error') AS errors").
			Where("created_at >= ? AND bot_name <> ? AND trigger_type <> ?", since, "system_boot", "sandbox").Scan(&stats).Error
	} else {
		for _, entry := range recent {
			if entry.Timestamp.Before(since) || entry.BotName == "system_boot" || entry.TriggerType == "sandbox" {
				continue
			}
			stats.Total++
			if entry.Status == "error" {
				stats.Errors++
			}
		}
	}
	var total, failures, rate interface{}
	if queryErr == nil {
		total, failures = stats.Total, stats.Errors
		if stats.Total > 0 {
			rate = fmt.Sprintf("%.1f%%", 100*float64(stats.Total-stats.Errors)/float64(stats.Total))
		}
	}

	return map[string]interface{}{
		"system_healthy":    allHealthy,
		"healthy_workers":   healthyCount,
		"total_workers":     len(workersList),
		"executions_24h":    total,
		"errors_24h":        failures,
		"success_rate_24h":  rate,
		"redis_available":   redisAvailable,
		"sse_clients_count": sseClientsCount,
		"workers":           workersList,
		"server_time":       time.Now().UTC(),
	}
}

// GetLogs returns the recorded automation logs with filtering and pagination.
func (t *AutomationTracker) GetLogs(botFilter, statusFilter, searchQuery string, limit, page int) ([]AutomationLogEntry, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit

	// If DB is connected, fetch from DB for permanent records & pagination
	t.mu.RLock()
	db := t.db
	t.mu.RUnlock()
	if db != nil {
		var dbLogs []models.AutomationLog
		var total int64

		query := db.Model(&models.AutomationLog{})

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

		if err := query.Count(&total).Error; err != nil {
			return nil, 0, err
		}
		if err := query.Order("created_at DESC, id DESC").Limit(limit).Offset(offset).Find(&dbLogs).Error; err != nil {
			return nil, 0, err
		}
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
		return results, total, nil
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
		return []AutomationLogEntry{}, total, nil
	}
	end := offset + limit
	if end > len(filtered) {
		end = len(filtered)
	}

	return filtered[offset:end], total, nil
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
		defer t.recoverCycle("store_expiry")
		start := time.Now()
		log.Info().Msg("Manual store expiry & dormancy cycle triggered via admin API")
		processed, err := RunDormancyCycle(db, strg)
		duration := time.Since(start).Milliseconds()
		now := time.Now().UTC()
		summary := fmt.Sprintf("Siklus dormansi berakhir. %d perubahan tahap tercatat.", processed)
		status, fault := "success", ""
		if err != nil {
			status, fault = "error", err.Error()
		}
		t.RecordWorkerHeartbeat(
			"store_expiry",
			status,
			summary,
			fault,
			processed,
			now.Add(1*time.Hour),
		)

		t.RecordLog(AutomationLogEntry{
			BotName:     "store_expiry",
			BotTitle:    "Bot Kedaluwarsa & Paket Toko",
			Target:      "Seluruh Merchant & Toko",
			Action:      "executed_cycle",
			TriggerType: "manual_admin",
			TriggeredBy: manualActor(db),
			Status:      status, ErrorMessage: fault,
			DurationMs:    duration,
			AffectedCount: processed,
			Details:       summary,
			Timestamp:     now,
		})
	}()

	return nil
}

func manualActor(db *gorm.DB) string {
	if db != nil {
		if value, ok := db.Get("automation_actor"); ok {
			if actor, ok := value.(string); ok {
				return actor
			}
		}
	}
	return "Admin Portal"
}

func (t *AutomationTracker) recoverCycle(name string) {
	if reason := recover(); reason != nil {
		log.Error().Str("worker", name).Interface("panic", reason).Msg("Automation cycle interrupted")
		t.RecordWorkerHeartbeat(name, "error", "Siklus terhenti.", "Kesalahan internal saat eksekusi.", 0, time.Time{})
	}
}

// observeCycle records a completed cycle or a returned failure, including cycles with no candidates.
func observeCycle(name string, interval time.Duration, processed int64, err error) {
	status, fault := "success", ""
	if err != nil {
		status, fault = "error", err.Error()
	}
	var next time.Time
	if interval > 0 {
		next = time.Now().UTC().Add(interval)
	}
	GetAutomationTracker().RecordWorkerHeartbeat(name, status, "", fault, processed, next)
}

// RunDiagnostic returns the observed counts only after PostgreSQL has answered.
func (t *AutomationTracker) RunDiagnostic(db *gorm.DB, name, actor string) (string, error) {
	start := time.Now()
	var count int64
	var summary string
	var err error
	switch name {
	case "promo_expiry":
		err = db.Model(&models.Store{}).Where("promo_banner <> ''").Count(&count).Error
		summary = fmt.Sprintf("%d toko memiliki banner promo.", count)
	case "flash_sale":
		err = db.Model(&models.Product{}).Where("is_active = true").Count(&count).Error
		summary = fmt.Sprintf("%d produk aktif.", count)
	case "weekly_summary":
		var result struct{ Stores, Users, Products, Tickets int64 }
		err = db.Raw("SELECT (SELECT count(*) FROM stores) AS stores, (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM products WHERE is_active AND deleted_at IS NULL) AS products, (SELECT count(*) FROM support_tickets WHERE deleted_at IS NULL AND status NOT IN ('resolved','closed')) AS tickets").Scan(&result).Error
		count = result.Stores + result.Users
		summary = fmt.Sprintf("%d toko, %d pengguna, %d produk aktif, %d tiket terbuka.", result.Stores, result.Users, result.Products, result.Tickets)
	default:
		return "", fmt.Errorf("diagnostik tidak dikenal")
	}
	status, fault := "success", ""
	if err != nil {
		status = "error"
		fault = err.Error()
		summary = "Gagal membaca jumlah dari database."
	}
	t.RecordWorkerHeartbeat(name, status, summary, fault, count, time.Time{})
	t.mu.RLock()
	title := t.workers[name].Title
	t.mu.RUnlock()
	t.RecordLog(AutomationLogEntry{BotName: name, BotTitle: title, Target: "Platform", Action: "diagnostic_count", TriggerType: "manual_admin", TriggeredBy: actor, Status: status, Details: summary, ErrorMessage: fault, DurationMs: time.Since(start).Milliseconds()})
	return summary, err
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
		defer t.recoverCycle("cleaner_worker")
		start := time.Now()
		log.Info().Msg("Manual notification cleaner triggered via admin API")
		err := runCleanup(db)
		status, fault := "success", ""
		if err != nil {
			status, fault = "error", err.Error()
		}
		duration := time.Since(start).Milliseconds()

		t.RecordLog(AutomationLogEntry{
			BotName:     "cleaner_worker",
			BotTitle:    "Worker Pembersih Notifikasi & Sampah Data",
			Target:      "Tabel Notifikasi & Riwayat Baca",
			Action:      "purged_records",
			TriggerType: "manual_admin",
			TriggeredBy: manualActor(db),
			Status:      status, ErrorMessage: fault,
			DurationMs: duration,
			Details:    fmt.Sprintf("Pembersihan notifikasi kedaluwarsa & retensi 30 hari berakhir (%d ms).", duration),
			Timestamp:  time.Now().UTC(),
		})
	}()

	return nil
}

func (t *AutomationTracker) TriggerSupportLifecycleManual(db *gorm.DB, actor string) (string, error) {
	if !t.TryLockBot("support_lifecycle") {
		return "", fmt.Errorf("siklus helpdesk sedang berjalan")
	}
	defer t.UnlockBot("support_lifecycle")
	return RunSupportLifecycle(db, t.storage, "manual_admin", actor)
}

// TriggerSandboxTestGuide dispatches a test onboarding notification directly to a target user/store or admin.
func (t *AutomationTracker) TriggerSandboxTestGuide(db *gorm.DB, adminUser *models.User) (*models.Notification, error) {
	if db == nil {
		db = t.db
	}
	if db == nil {
		return nil, fmt.Errorf("koneksi database tidak tersedia")
	}

	if adminUser == nil || adminUser.ID == 0 {
		return nil, fmt.Errorf("akun tujuan diperlukan")
	}
	userID, userName := adminUser.ID, adminUser.Name

	now := time.Now().UTC()
	exp := now.Add(48 * time.Hour)

	testNotif := models.Notification{
		ID:             fmt.Sprintf("test_guide_%d", now.UnixNano()),
		TargetType:     "single_user",
		TargetID:       userID,
		TargetName:     userName,
		IsBroadcast:    false,
		Title:          "Panduan uji pengiriman",
		Category:       "PANDUAN",
		Message:        "Pesan uji yang Anda minta melalui Mesin Otomasi.",
		DetailContent:  "Panduan ini disimpan untuk akun Anda dan diterbitkan ke kanal notifikasi realtime.",
		Type:           "info",
		ActionEnabled:  true,
		ActionType:     "detail",
		ActionLabel:    "Buka panduan",
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
		BotTitle:      "Uji pengiriman panduan",
		Target:        userName,
		TargetID:      userID,
		Action:        "sent_in_app",
		TriggerType:   "manual_admin",
		TriggeredBy:   userName,
		Status:        "success",
		DurationMs:    time.Since(now).Milliseconds(),
		AffectedCount: 1,
		Details:       fmt.Sprintf("Notifikasi simulasi panduan onboarding berhasil dikirimkan ke akun '%s'.", userName),
		Timestamp:     now,
	})

	return &testNotif, nil
}

// TriggerItemRetentionManual executes the item retention and purge cycle manually.
func (t *AutomationTracker) TriggerItemRetentionManual(db *gorm.DB, cfg *config.Config) (*ItemRetentionStats, error) {
	if !t.TryLockBot("item_retention_worker") {
		return nil, fmt.Errorf("pekerjaan sedang berjalan")
	}
	defer t.UnlockBot("item_retention_worker")

	targetDB := db
	if targetDB == nil {
		targetDB = t.db
	}

	targetCfg := cfg
	if targetCfg == nil {
		targetCfg = config.AppConfig
	}

	stats, err := ProcessItemRetentionCycle(targetDB, targetCfg)
	now := time.Now().UTC()
	status := "success"
	summary := ""
	if stats != nil {
		summary = fmt.Sprintf("Retensi selesai: %d toko banned dimusnahkan (90d), %d produk reguler dimusnahkan (72h), %d berkas foto dihapus, %d pengingat H-7, %d moderasi soft-delete (H-30), %d moderasi hard-delete (H-90).", stats.BannedStoresPurged, stats.RegularPurged, stats.PurgedFiles, stats.RemindersSent, stats.SoftDeleted, stats.HardDeleted)
	}
	errStr := ""
	if err != nil {
		status = "error"
		errStr = err.Error()
		summary = "Gagal memproses siklus retensi item: " + errStr
	}

	affected := int64(0)
	if stats != nil {
		affected = int64(stats.BannedStoresPurged + stats.RegularPurged + stats.SoftDeleted + stats.HardDeleted)
	}

	t.RecordWorkerHeartbeat("item_retention_worker", status, summary, errStr, affected, now.Add(24*time.Hour))
	t.RecordLog(AutomationLogEntry{
		ID:          fmt.Sprintf("log_%d_item_retention", now.UnixNano()),
		BotName:     "item_retention_worker",
		BotTitle:    "Bot Retensi & Pembersihan Item Moderasi",
		Target:      "Katalog Produk & Moderasi",
		Action:      "manual_execution",
		TriggerType: "manual_admin",
		TriggeredBy: manualActor(db),
		Status:      status,
		Details:     summary,
		Timestamp:   now,
	})

	return stats, err
}

// TriggerTicketRetentionManual executes the PDP closed ticket and media hard purge cycle manually.
func (t *AutomationTracker) TriggerTicketRetentionManual(db *gorm.DB) (*TicketRetentionStats, error) {
	if !t.TryLockBot("ticket_retention_worker") {
		return nil, fmt.Errorf("pekerjaan sedang berjalan")
	}
	defer t.UnlockBot("ticket_retention_worker")

	targetDB := db
	if targetDB == nil {
		targetDB = t.db
	}

	stats, err := PurgeExpiredClosedTickets(targetDB, t.storage)
	now := time.Now().UTC()
	status := "success"
	summary := fmt.Sprintf("Pemusnahan PDP selesai: %d tiket kedaluwarsa dimusnahkan, %d berkas lampiran dihapus permanen (%.2f MB dibebaskan).",
		stats.PurgedTickets, stats.PurgedFiles, float64(stats.FreedBytes)/(1024*1024))
	errStr := ""
	if err != nil {
		status = "error"
		errStr = err.Error()
		summary = "Gagal memproses pemusnahan tiket PDP: " + errStr
	}

	t.RecordWorkerHeartbeat("ticket_retention_worker", status, summary, errStr, stats.PurgedTickets, now.Add(15*time.Minute))
	t.RecordLog(AutomationLogEntry{
		ID:            fmt.Sprintf("log_%d_ticket_pdp", now.UnixNano()),
		BotName:       "ticket_retention_worker",
		BotTitle:      "Bot Retensi & Pemusnahan Data PDP Tiket",
		Target:        "Tiket Bantuan & Storage Server",
		Action:        "purged_records",
		TriggerType:   "manual_admin",
		TriggeredBy:   manualActor(db),
		Status:        status,
		AffectedCount: stats.PurgedTickets,
		Details:       summary,
		Timestamp:     now,
	})

	return &stats, err
}

// TriggerMarketIntelManual forces an immediate rollup and purge of market intelligence telemetry.
func (t *AutomationTracker) TriggerMarketIntelManual(db *gorm.DB) error {
	if !t.TryLockBot("market_intel_worker") {
		return fmt.Errorf("agregasi pasar sedang berjalan")
	}
	go func() {
		defer t.UnlockBot("market_intel_worker")
		defer t.recoverCycle("market_intel_worker")
		t.runMarketRollup(db, "manual_admin", manualActor(db))
	}()
	return nil
}

func (t *AutomationTracker) ScheduledMarketRollup(db *gorm.DB) {
	if !t.TryLockBot("market_intel_worker") {
		return
	}
	defer t.UnlockBot("market_intel_worker")
	defer t.recoverCycle("market_intel_worker")
	t.runMarketRollup(db, "cron", "System Daemon")
}

func (t *AutomationTracker) runMarketRollup(db *gorm.DB, origin, actor string) {
	start := time.Now().UTC()
	day := start.AddDate(0, 0, -1).Format("2006-01-02")
	today := start.Format("2006-01-02")
	var purged int64
	err := db.Transaction(func(tx *gorm.DB) error {
		for _, targetDay := range []string{day, today} {
			if err := RollupDailySearchTrends(tx, targetDay); err != nil {
				return err
			}
			if err := RollupDailyMarketTrends(tx, targetDay); err != nil {
				return err
			}
		}
		if err := CalculatePriceBenchmarks(tx, today); err != nil {
			return err
		}
		var err error
		purged, err = PurgeOldSearchAnalytics90D(tx)
		return err
	})
	status, fault, summary := "success", "", fmt.Sprintf("Agregasi pasar tanggal %s selesai. %d baris melewati retensi.", day, purged)
	if err != nil {
		status, fault, summary = "error", err.Error(), "Agregasi pasar gagal."
		purged = 0
	} else {
		InvalidateMarketIntelCache()
	}
	t.RecordWorkerHeartbeat("market_intel_worker", status, summary, fault, purged, start.Add(24*time.Hour))
	t.RecordLog(AutomationLogEntry{BotName: "market_intel_worker", BotTitle: "Agregasi riset pasar", Action: "executed_cycle", TriggerType: origin, TriggeredBy: actor, Status: status, Details: summary, ErrorMessage: fault, AffectedCount: purged, DurationMs: time.Since(start).Milliseconds()})
}

// TriggerStorageSweeperManual executes storage quota audit and orphan pruning manually.
func (t *AutomationTracker) TriggerStorageSweeperManual(db *gorm.DB) (int, error) {
	if !t.TryLockBot("storage_sweeper") {
		return 0, fmt.Errorf("pekerjaan sedang berjalan")
	}
	defer t.UnlockBot("storage_sweeper")

	targetDB := db
	if targetDB == nil {
		targetDB = t.db
	}

	totalAudited := RunStorageSweep(targetDB)
	now := time.Now().UTC()
	summary := fmt.Sprintf("Audit penyimpanan selesai: %d toko diaudit dan disinkronkan.", totalAudited)

	t.RecordWorkerHeartbeat("storage_sweeper", "running", summary, "", int64(totalAudited), now.Add(1*time.Hour))
	t.RecordLog(AutomationLogEntry{
		ID:            fmt.Sprintf("log_%d_storage_sweeper", now.UnixNano()),
		BotName:       "storage_sweeper",
		BotTitle:      "Bot Audit Kuota & Pembersih Yatim Piatu",
		Target:        "Penyimpanan File & Kuota Toko",
		Action:        "manual_execution",
		TriggerType:   "manual_admin",
		TriggeredBy:   manualActor(db),
		Status:        "success",
		AffectedCount: int64(totalAudited),
		Details:       summary,
		Timestamp:     now,
	})

	return totalAudited, nil
}
