package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"catavor-backend/internal/models"

	"github.com/rs/zerolog/log"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

const (
	auditChainLockKey    int64 = 72819401
	auditGenesisPrevHash       = "GENESIS"
	defaultTestHMACSeed        = "catavor-audit-chain-test-fallback-v1"
)

var (
	activityChainMu    sync.Mutex
	auditKeyMu         sync.RWMutex
	auditHMACKey       []byte
	auditWriteFailures atomic.Uint64
)

func init() {
	envKey := strings.TrimSpace(os.Getenv("AUDIT_HMAC_KEY"))
	jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	ConfigureAuditHMACKey(envKey, jwtSecret)
}

// ConfigureAuditHMACKey configures the domain-separated HMAC-SHA256 signing key
// used for tamper-evident audit log chaining.
func ConfigureAuditHMACKey(explicitAuditKey, jwtSecret string) {
	material := strings.TrimSpace(explicitAuditKey)
	if material == "" {
		material = strings.TrimSpace(jwtSecret)
	}
	if material == "" {
		material = defaultTestHMACSeed
	}
	sum := sha256.Sum256([]byte("catavor-audit-hmac-v1|" + material))
	auditKeyMu.Lock()
	auditHMACKey = sum[:]
	auditKeyMu.Unlock()
}

func getAuditHMACKey() []byte {
	auditKeyMu.RLock()
	defer auditKeyMu.RUnlock()
	if len(auditHMACKey) == 0 {
		sum := sha256.Sum256([]byte("catavor-audit-hmac-v1|" + defaultTestHMACSeed))
		return sum[:]
	}
	out := make([]byte, len(auditHMACKey))
	copy(out, auditHMACKey)
	return out
}

// GetAuditWriteFailures returns the total count of failed audit persistence attempts since boot.
func GetAuditWriteFailures() uint64 {
	return auditWriteFailures.Load()
}

type RecordActivityParams struct {
	DB          *gorm.DB
	StoreID     *uint
	UserID      *uint
	ActorRole   string // "merchant" | "superadmin" | "system" | staff slug
	ActorName   string
	ActorEmail  string
	Action      string // e.g. "product.create", "product.price_change", "admin.broadcast_notification"
	Category    string // "security" | "catalog" | "store" | "billing" | "superadmin" | "moderation" | "system" | "market_intel"
	EntityType  string // "product", "store", "notification", "plan", "policy", "report", "user", "safe_domain", "user_session"
	EntityID    *uint
	EntityTitle string
	Description string
	Changes     interface{} // Struct or map that will be redacted and JSON-marshaled
	IPAddress   string
	UserAgent   string
}

// AuditChainReport describes cryptographic verification results across stored activity logs.
type AuditChainReport struct {
	Intact               bool   `json:"intact"`
	CheckedCount         int    `json:"checked_count"`
	ChainedCount         int    `json:"chained_count"`
	UnchainedLegacyCount int    `json:"unchained_legacy_count"`
	LastChainSeq         uint64 `json:"last_chain_seq"`
	HeadHash             string `json:"head_hash,omitempty"`
	BrokenAtID           *uint  `json:"broken_at_id,omitempty"`
	Reason               string `json:"reason"`
}

func isSensitiveAuditKey(key string) bool {
	k := strings.ToLower(strings.TrimSpace(key))
	if k == "" {
		return false
	}
	sensitiveTokens := []string{
		"password", "passwd", "passphrase", "secret", "token",
		"otp", "backup_code", "private_key", "api_key", "apikey",
		"authorization", "cookie", "credential", "smtp_pass", "webhook_secret",
	}
	for _, tok := range sensitiveTokens {
		if strings.Contains(k, tok) {
			return true
		}
	}
	return false
}

func redactAuditValue(v interface{}) interface{} {
	switch typed := v.(type) {
	case map[string]interface{}:
		out := make(map[string]interface{}, len(typed))
		for k, val := range typed {
			if isSensitiveAuditKey(k) {
				out[k] = "[REDACTED]"
			} else {
				out[k] = redactAuditValue(val)
			}
		}
		return out
	case map[string]string:
		out := make(map[string]interface{}, len(typed))
		for k, val := range typed {
			if isSensitiveAuditKey(k) {
				out[k] = "[REDACTED]"
			} else {
				out[k] = val
			}
		}
		return out
	case []interface{}:
		out := make([]interface{}, len(typed))
		for i, item := range typed {
			out[i] = redactAuditValue(item)
		}
		return out
	default:
		return v
	}
}

func sanitizeAuditChangesJSON(changes interface{}) datatypes.JSON {
	if changes == nil {
		return nil
	}
	rawBytes, err := json.Marshal(changes)
	if err != nil || len(rawBytes) == 0 || string(rawBytes) == "null" {
		return nil
	}
	var generic interface{}
	if err := json.Unmarshal(rawBytes, &generic); err != nil {
		return datatypes.JSON(rawBytes)
	}
	sanitized := redactAuditValue(generic)
	cleanBytes, err := json.Marshal(sanitized)
	if err != nil {
		return datatypes.JSON(rawBytes)
	}
	return datatypes.JSON(cleanBytes)
}

// canonicalJSONString produces deterministic sorted-key compact JSON so PostgreSQL JSONB
// and SQLite TEXT yield identical byte sequences when verifying hashes.
func canonicalJSONString(raw datatypes.JSON) string {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" || trimmed == "null" {
		return ""
	}
	var v interface{}
	if err := json.Unmarshal([]byte(trimmed), &v); err != nil {
		return trimmed
	}
	out, err := json.Marshal(v)
	if err != nil {
		return trimmed
	}
	return string(out)
}

func formatUintPtr(v *uint) string {
	if v == nil {
		return ""
	}
	return fmt.Sprintf("%d", *v)
}

func truncateString(s string, maxLen int) string {
	s = strings.TrimSpace(s)
	if maxLen <= 0 || len(s) <= maxLen {
		return s
	}
	r := []rune(s)
	if len(r) <= maxLen {
		return s
	}
	return string(r[:maxLen])
}

// ComputeActivityHash calculates the HMAC-SHA256 integrity digest linking an ActivityLog entry
// to the preceding entry in the chain.
func ComputeActivityHash(entry *models.ActivityLog, key []byte) string {
	if entry == nil {
		return ""
	}
	if len(key) == 0 {
		key = getAuditHMACKey()
	}
	prev := strings.TrimSpace(entry.PrevHash)
	if prev == "" {
		prev = auditGenesisPrevHash
	}
	ts := entry.CreatedAt.UTC().Truncate(time.Microsecond).Format("2006-01-02T15:04:05.000000Z")
	canonicalPayload := strings.Join([]string{
		fmt.Sprintf("%d", entry.ChainSeq),
		prev,
		ts,
		formatUintPtr(entry.StoreID),
		formatUintPtr(entry.UserID),
		strings.TrimSpace(entry.ActorRole),
		strings.TrimSpace(entry.ActorName),
		strings.TrimSpace(entry.ActorEmail),
		strings.TrimSpace(entry.Action),
		strings.TrimSpace(entry.Category),
		strings.TrimSpace(entry.EntityType),
		formatUintPtr(entry.EntityID),
		strings.TrimSpace(entry.EntityTitle),
		strings.TrimSpace(entry.Description),
		canonicalJSONString(entry.Changes),
		strings.TrimSpace(entry.IPAddress),
		strings.TrimSpace(entry.UserAgent),
	}, "\x1f")

	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(canonicalPayload))
	return hex.EncodeToString(mac.Sum(nil))
}

// RecordActivity safely records an append-only, hash-chained audit entry.
// Callers inside critical ACID transactions should prefer RecordActivityErr so audit
// persistence failure rolls back the transaction cleanly.
func RecordActivity(params RecordActivityParams) {
	if err := RecordActivityErr(params); err != nil {
		auditWriteFailures.Add(1)
		log.Error().Err(err).Str("action", params.Action).Msg("Failed to persist activity log entry")
	}
}

// RecordActivityErr persists a sanitized, hash-chained audit trail record and returns any DB error.
func RecordActivityErr(params RecordActivityParams) error {
	if params.DB == nil {
		return nil
	}

	role := strings.TrimSpace(params.ActorRole)
	if role == "" {
		role = "merchant"
	}
	actorName := truncateString(params.ActorName, 255)
	if actorName == "" {
		actorName = "System"
	}
	actorEmail := truncateString(params.ActorEmail, 255)
	if actorEmail == "" {
		actorEmail = "system@catavor.com"
	}

	changesJSON := sanitizeAuditChangesJSON(params.Changes)
	now := time.Now().UTC().Truncate(time.Microsecond)

	activity := models.ActivityLog{
		StoreID:     params.StoreID,
		UserID:      params.UserID,
		ActorRole:   truncateString(role, 50),
		ActorName:   actorName,
		ActorEmail:  actorEmail,
		Action:      truncateString(params.Action, 100),
		Category:    truncateString(params.Category, 50),
		EntityType:  truncateString(params.EntityType, 50),
		EntityID:    params.EntityID,
		EntityTitle: truncateString(params.EntityTitle, 255),
		Description: strings.TrimSpace(params.Description),
		Changes:     changesJSON,
		IPAddress:   truncateString(params.IPAddress, 100),
		UserAgent:   truncateString(params.UserAgent, 512),
		CreatedAt:   now,
	}

	activityChainMu.Lock()
	defer activityChainMu.Unlock()

	return params.DB.Transaction(func(tx *gorm.DB) error {
		if tx.Dialector.Name() == "postgres" {
			_ = tx.Exec("SELECT pg_advisory_xact_lock(?)", auditChainLockKey).Error
		}

		var prevRow struct {
			ChainSeq  uint64
			EntryHash string
		}
		err := tx.Model(&models.ActivityLog{}).
			Select("chain_seq, entry_hash").
			Where("entry_hash <> ''").
			Order("chain_seq DESC, id DESC").
			Limit(1).
			Take(&prevRow).Error
		if err != nil && err != gorm.ErrRecordNotFound {
			return err
		}

		prevHash := auditGenesisPrevHash
		var nextSeq uint64 = 1
		if err == nil && strings.TrimSpace(prevRow.EntryHash) != "" {
			prevHash = strings.TrimSpace(prevRow.EntryHash)
			nextSeq = prevRow.ChainSeq + 1
		}

		activity.ChainSeq = nextSeq
		activity.PrevHash = prevHash
		activity.EntryHash = ComputeActivityHash(&activity, getAuditHMACKey())

		return tx.Create(&activity).Error
	})
}

// VerifyActivityLogChain verifies hash-chain continuity and per-row HMAC integrity.
// Unchained legacy rows before the first chained record are counted honestly in UnchainedLegacyCount;
// any unchained row injected AFTER the chain started is flagged as tampering.
func VerifyActivityLogChain(db *gorm.DB, limit int) (*AuditChainReport, error) {
	if db == nil {
		return nil, fmt.Errorf("database unavailable")
	}
	if limit <= 0 || limit > 20000 {
		limit = 5000
	}

	var rows []models.ActivityLog
	if err := db.Order("chain_seq ASC, id ASC").Limit(limit).Find(&rows).Error; err != nil {
		return nil, err
	}

	report := &AuditChainReport{
		Intact: true,
		Reason: "Rantai integritas audit trail utuh dan terverifikasi.",
	}
	if len(rows) == 0 {
		report.Reason = "Belum ada rekaman audit pada basis data."
		return report, nil
	}

	key := getAuditHMACKey()
	chainStarted := false
	expectedPrev := auditGenesisPrevHash
	var expectedSeq uint64 = 1

	for i := range rows {
		r := rows[i]
		report.CheckedCount++

		if strings.TrimSpace(r.EntryHash) == "" {
			if chainStarted {
				idCopy := r.ID
				report.Intact = false
				report.BrokenAtID = &idCopy
				report.Reason = fmt.Sprintf("Anomali: baris log #%d tidak memiliki tanda tangan hash setelah rantai audit aktif.", r.ID)
				return report, nil
			}
			report.UnchainedLegacyCount++
			continue
		}

		if !chainStarted {
			chainStarted = true
			// Support partial windowed verification starting past seq=1 only when limit truncated earlier records;
			// when starting from the beginning, seq=1 expects GENESIS.
			if r.ChainSeq > 1 && r.PrevHash != auditGenesisPrevHash {
				expectedSeq = r.ChainSeq
				expectedPrev = r.PrevHash
			}
		}

		if r.ChainSeq != expectedSeq {
			idCopy := r.ID
			report.Intact = false
			report.BrokenAtID = &idCopy
			report.Reason = fmt.Sprintf("Urutan rantai terputus pada log #%d (expected chain_seq=%d, got=%d).", r.ID, expectedSeq, r.ChainSeq)
			return report, nil
		}

		if r.PrevHash != expectedPrev {
			idCopy := r.ID
			report.Intact = false
			report.BrokenAtID = &idCopy
			report.Reason = fmt.Sprintf("Hash tautan sebelumnya tidak cocok pada log #%d (indikasi penyisipan/penghapusan baris).", r.ID)
			return report, nil
		}

		computed := ComputeActivityHash(&r, key)
		if !hmac.Equal([]byte(computed), []byte(r.EntryHash)) {
			idCopy := r.ID
			report.Intact = false
			report.BrokenAtID = &idCopy
			report.Reason = fmt.Sprintf("Integritas isi log #%d gagal diverifikasi (indikasi modifikasi data di basis data).", r.ID)
			return report, nil
		}

		report.ChainedCount++
		report.LastChainSeq = r.ChainSeq
		report.HeadHash = r.EntryHash
		expectedPrev = r.EntryHash
		expectedSeq = r.ChainSeq + 1
	}

	if report.ChainedCount == 0 && report.UnchainedLegacyCount > 0 {
		report.Reason = fmt.Sprintf("Seluruh %d rekaman berasal dari baseline lama sebelum aktivasi hash-chain.", report.UnchainedLegacyCount)
	}
	return report, nil
}

// CleanOldActivityLogs archives stale operational logs into archived_activity_logs before
// removing them from hot activity_logs:
// - Free stores (>90 days): operational catalog/store logs (never deletes security/superadmin/billing/moderation prematurely).
// - All records (>365 days): moved to archived_activity_logs before hot pruning.
func CleanOldActivityLogs(db *gorm.DB) (processed int64, cycleErr error) {
	defer func() { observeCycle("activity_log_cleaner", 24*time.Hour, processed, cycleErr) }()
	now := time.Now().UTC()
	freeCutoff := now.AddDate(0, 0, -90)
	globalCutoff := now.AddDate(0, 0, -365)

	var totalArchivedAndPruned int64

	// 0. Pre-prune aggregation: Snapshot historical price change frequency into store_daily_audience_metrics
	_ = db.Exec(`
		INSERT INTO store_daily_audience_metrics (store_id, date, dimension_type, dimension_value, views, unique_visitors, total_actions, created_at, updated_at)
		SELECT 
			0 as store_id,
			TO_CHAR(created_at, 'YYYY-MM-DD') as date,
			'hist_price_chg' as dimension_type,
			'catalog|price_change' as dimension_value,
			COUNT(*) as views,
			COUNT(DISTINCT store_id) as unique_visitors,
			COUNT(*) as total_actions,
			NOW(),
			NOW()
		FROM activity_logs
		WHERE action = 'product.price_change' 
		  AND (
		      (store_id IN (SELECT id FROM stores WHERE plan = 'free' OR plan IS NULL) AND created_at < ?)
		      OR created_at < ?
		  )
		GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
		ON CONFLICT (store_id, date, dimension_type, dimension_value) DO UPDATE SET
			views = store_daily_audience_metrics.views + EXCLUDED.views,
			unique_visitors = store_daily_audience_metrics.unique_visitors + EXCLUDED.unique_visitors,
			total_actions = store_daily_audience_metrics.total_actions + EXCLUDED.total_actions,
			updated_at = NOW()
	`, freeCutoff, globalCutoff).Error

	err := db.Transaction(func(tx *gorm.DB) error {
		if tx.Dialector.Name() == "postgres" {
			if err := tx.Exec("SET LOCAL catavor.audit_retention_purge = 'authorized'").Error; err != nil {
				return err
			}
		}

		hasArchiveTable := tx.Migrator().HasTable(&models.ArchivedActivityLog{})
		archiveIfPresent := func(whereClause string, args ...interface{}) {
			if !hasArchiveTable {
				return
			}
			var stale []models.ActivityLog
			if err := tx.Where(whereClause, args...).Find(&stale).Error; err != nil || len(stale) == 0 {
				return
			}
			archivedAt := time.Now().UTC()
			for _, s := range stale {
				var count int64
				if err := tx.Model(&models.ArchivedActivityLog{}).Where("original_id = ?", s.ID).Count(&count).Error; err == nil && count > 0 {
					continue
				}
				rec := models.ArchivedActivityLog{
					OriginalID:  s.ID,
					StoreID:     s.StoreID,
					UserID:      s.UserID,
					ActorRole:   s.ActorRole,
					ActorName:   s.ActorName,
					ActorEmail:  s.ActorEmail,
					Action:      s.Action,
					Category:    s.Category,
					EntityType:  s.EntityType,
					EntityID:    s.EntityID,
					EntityTitle: s.EntityTitle,
					Description: s.Description,
					Changes:     s.Changes,
					IPAddress:   s.IPAddress,
					UserAgent:   s.UserAgent,
					ChainSeq:    s.ChainSeq,
					PrevHash:    s.PrevHash,
					EntryHash:   s.EntryHash,
					CreatedAt:   s.CreatedAt,
					ArchivedAt:  archivedAt,
				}
				_ = tx.Create(&rec).Error
			}
		}

		// 1. Archive & prune Free store non-critical logs older than 90 days
		freeWhere := `store_id IN (SELECT id FROM stores WHERE plan = 'free' OR plan IS NULL)
			AND category NOT IN ('security', 'superadmin', 'billing', 'moderation')
			AND created_at < ?`
		archiveIfPresent(freeWhere, freeCutoff)
		res1 := tx.Exec("DELETE FROM activity_logs WHERE "+freeWhere, freeCutoff)
		if res1.Error != nil {
			log.Warn().Err(res1.Error).Msg("ActivityLogCleaner: Failed to purge free tier operational logs")
		} else {
			totalArchivedAndPruned += res1.RowsAffected
		}

		// 2. Archive & prune hot activity logs older than 365 days into archived_activity_logs
		globalWhere := "created_at < ?"
		archiveIfPresent(globalWhere, globalCutoff)
		res2 := tx.Exec("DELETE FROM activity_logs WHERE "+globalWhere, globalCutoff)
		if res2.Error != nil {
			log.Warn().Err(res2.Error).Msg("ActivityLogCleaner: Failed to purge global 365-day hot logs")
		} else {
			totalArchivedAndPruned += res2.RowsAffected
		}

		return nil
	})
	if err != nil {
		return totalArchivedAndPruned, err
	}

	return totalArchivedAndPruned, nil
}

// StartActivityLogCleaner starts the periodic background cleaner goroutine.
func StartActivityLogCleaner(ctx context.Context, db *gorm.DB, interval time.Duration) {
	go func() {
		if purged, err := CleanOldActivityLogs(db); err == nil && purged > 0 {
			log.Info().Int64("purged_count", purged).Msg("Initial activity logs archival cleanup completed")
		}

		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if purged, err := CleanOldActivityLogs(db); err == nil && purged > 0 {
					log.Info().Int64("purged_count", purged).Msg("Periodic activity logs archival cleanup completed")
				}
			}
		}
	}()
}

// ExportActivityLogsCSV writes audit log entries as UTF-8 BOM Excel-safe CSV with formula neutralization.
func ExportActivityLogsCSV(w io.Writer, logs []models.ActivityLog) error {
	if _, err := w.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return err
	}
	cw := csv.NewWriter(w)
	defer cw.Flush()

	wib := time.FixedZone("WIB", 7*3600)
	header := []string{
		"ID", "ChainSeq", "Waktu_WIB", "Waktu_UTC", "Kategori", "Aksi",
		"Peran_Aktor", "Nama_Aktor", "Email_Aktor", "Store_ID",
		"Entitas", "ID_Entitas", "Judul_Entitas", "Deskripsi",
		"IP_Address", "User_Agent", "Prev_Hash", "Entry_Hash",
	}
	if err := cw.Write(header); err != nil {
		return err
	}

	for _, l := range logs {
		row := []string{
			fmt.Sprintf("%d", l.ID),
			fmt.Sprintf("%d", l.ChainSeq),
			SanitizeCSVField(l.CreatedAt.In(wib).Format("2006-01-02 15:04:05 WIB")),
			SanitizeCSVField(l.CreatedAt.UTC().Format(time.RFC3339)),
			SanitizeCSVField(l.Category),
			SanitizeCSVField(l.Action),
			SanitizeCSVField(l.ActorRole),
			SanitizeCSVField(l.ActorName),
			SanitizeCSVField(l.ActorEmail),
			SanitizeCSVField(formatUintPtr(l.StoreID)),
			SanitizeCSVField(l.EntityType),
			SanitizeCSVField(formatUintPtr(l.EntityID)),
			SanitizeCSVField(l.EntityTitle),
			SanitizeCSVField(l.Description),
			SanitizeCSVField(l.IPAddress),
			SanitizeCSVField(l.UserAgent),
			SanitizeCSVField(l.PrevHash),
			SanitizeCSVField(l.EntryHash),
		}
		if err := cw.Write(row); err != nil {
			return err
		}
	}

	cw.Flush()
	return cw.Error()
}
