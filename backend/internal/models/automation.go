package models

import (
	"time"
)

// AutomationLog stores the persistent execution history and telemetry of platform bots and background workers.
type AutomationLog struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	BotName       string    `gorm:"size:64;index" json:"bot_name"`       // 'store_expiry', 'promo_expiry', 'flash_sale', 'support_lifecycle', etc.
	BotTitle      string    `gorm:"size:128" json:"bot_title"`          // Human-readable title
	Action        string    `gorm:"size:64" json:"action"`              // 'executed_cycle', 'purged_records', 'sent_in_app', 'compiled_summary'
	TriggerType   string    `gorm:"size:32;default:'cron'" json:"trigger_type"` // 'cron', 'manual_admin', 'event_hook', 'sandbox'
	TriggeredBy   string    `gorm:"size:128" json:"triggered_by,omitempty"`     // Admin email or 'System Daemon'
	Status        string    `gorm:"size:32;index" json:"status"`        // 'success', 'warning', 'info', 'error'
	Target        string    `gorm:"size:255" json:"target,omitempty"`   // Target description (e.g. 'Seluruh Merchant', 'Toko #12')
	TargetID      uint      `json:"target_id,omitempty"`                // StoreID or UserID
	Details       string    `gorm:"type:text" json:"details"`           // Execution summary
	DurationMs    int64     `json:"duration_ms"`                        // Execution latency in milliseconds
	AffectedCount int64     `json:"affected_count"`                     // Number of items processed/updated/notified
	ErrorMessage  string    `gorm:"type:text" json:"error_message,omitempty"` // Error stack/details if failed
	CreatedAt     time.Time `gorm:"index" json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// TableName overrides the default table name for AutomationLog.
func (AutomationLog) TableName() string {
	return "automation_logs"
}
