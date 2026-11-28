package models

import (
	"strings"
	"time"
)

// Notification represents a system or broadcast notification item for merchants
type Notification struct {
	ID                    string     `json:"id" gorm:"primaryKey;type:varchar(64)"`
	TargetType            string     `json:"target_type" gorm:"type:varchar(32);default:'all';index"` // 'all', 'plan', 'specific', 'single_store', 'single_user'
	TargetPlanCode        string     `json:"target_plan_code" gorm:"type:varchar(64);index"`          // e.g. 'free', 'pro_starter', 'pro_business' (dynamic plan code)
	TargetID              uint       `json:"target_id" gorm:"index;default:0"`                        // StoreID or UserID if single target (legacy)
	TargetName            string     `json:"target_name" gorm:"type:varchar(255)"`                   // Store Name or User Name/Email for display
	TargetRecipients      string     `json:"-" gorm:"type:text"`                                      // JSON encoded list of target recipients (hidden from merchant JSON)
	IsBroadcast           bool       `json:"is_broadcast" gorm:"default:false;index"`                 // True if manually sent via Admin Broadcast
	Status                string     `json:"status" gorm:"type:varchar(24);default:'published';index"` // 'draft', 'scheduled', 'published', 'revoked'
	ScheduledAt           *time.Time `json:"scheduled_at,omitempty" gorm:"index"`                     // Scheduled UTC publish timestamp
	PublishedAt           *time.Time `json:"published_at,omitempty" gorm:"index"`                     // Actual UTC publish timestamp
	RevokedAt             *time.Time `json:"revoked_at,omitempty" gorm:"index"`                       // Non-destructive revocation timestamp
	RevokedBy             uint       `json:"revoked_by,omitempty" gorm:"default:0"`                   // Platform staff user ID who revoked the broadcast
	TargetAudienceCount   int64      `json:"target_audience_count" gorm:"default:0"`                  // Snapshot / estimated audience count at publish time
	IdempotencyKey        string     `json:"idempotency_key,omitempty" gorm:"type:varchar(128);index"`
	Title                 string     `json:"title" gorm:"type:varchar(255);not null"`
	Category              string     `json:"category" gorm:"type:varchar(32);default:'SISTEM'"`       // 'PANDUAN', 'PROMOSI', 'INVENTARIS', 'SISTEM', 'KEAMANAN', 'PENGUMUMAN', 'PEMELIHARAAN'
	Message               string     `json:"message" gorm:"type:text;not null"`
	DetailContent         string     `json:"detail_content" gorm:"type:text"`
	Type                  string     `json:"type" gorm:"type:varchar(32);default:'system'"`           // 'warning', 'success', 'order', 'system', 'info', 'ticket', 'stock'
	ActionEnabled         bool       `json:"action_enabled" gorm:"default:false"`                     // Explicit toggle for notification click action
	ActionType            string     `json:"action_type" gorm:"type:varchar(32);default:'none'"`      // 'none', 'detail', 'navigate', 'external_link'
	LinkSubTab            string     `json:"link_sub_tab" gorm:"type:varchar(64)"`                   // e.g. 'settings', 'items', 'subscription', 'help', 'share', 'analytics'
	LinkMobileSettingsTab string     `json:"link_mobile_settings_tab" gorm:"type:varchar(64)"`        // e.g. 'about', 'general', 'contact', 'theme', 'master', 'domain'
	ActionLabel           string     `json:"action_label" gorm:"type:varchar(128)"`                  // e.g. 'Buka Pengaturan Tentang Kami ->'
	ActionURL             string     `json:"action_url" gorm:"type:varchar(512)"`
	ExpiresAt             *time.Time `json:"expires_at" gorm:"index"`                                 // Absolute expiration timestamp (nil = unlimited)
	RetentionHours        int        `json:"retention_hours" gorm:"default:720"`                      // Hours to retain in history after being read (default 720h / 30 days)
	CreatedBy             uint       `json:"created_by" gorm:"default:0"`                             // Platform staff User ID who created the broadcast
	CreatedAt             time.Time  `json:"created_at" gorm:"index"`
	UpdatedAt             time.Time  `json:"updated_at"`

	// Virtual Computed Fields (Injected during query for specific store/user)
	IsRead      bool       `json:"read" gorm:"->;-:migration"`
	ReadAt      *time.Time `json:"read_at,omitempty" gorm:"->;-:migration"`
	ClickedAt   *time.Time `json:"clicked_at,omitempty" gorm:"->;-:migration"`
	DismissedAt *time.Time `json:"dismissed_at,omitempty" gorm:"->;-:migration"`
	Timestamp   string     `json:"timestamp,omitempty" gorm:"->;-:migration"`
}

// TableName explicitly maps to 'notifications' table.
func (Notification) TableName() string {
	return "notifications"
}

// SanitizedForRecipient strips internal admin & multi-recipient metadata before sending notifications
// to end users over HTTP or SSE frames (preventing sibling tenant identity leakage in 'specific' broadcasts).
func (n *Notification) SanitizedForRecipient() *Notification {
	if n == nil {
		return nil
	}
	copyVal := *n
	copyVal.TargetRecipients = ""
	copyVal.CreatedBy = 0
	copyVal.RevokedBy = 0
	copyVal.RevokedAt = nil
	copyVal.TargetAudienceCount = 0
	copyVal.IdempotencyKey = ""
	if strings.EqualFold(strings.TrimSpace(copyVal.TargetType), "specific") {
		copyVal.TargetName = ""
	}
	return &copyVal
}

// NotificationRecipient normalizes specific broadcast targets (store/user) for exact relational matching without LIKE collisions.
type NotificationRecipient struct {
	ID             uint      `json:"id_row,omitempty" gorm:"primaryKey;autoIncrement"`
	NotificationID string    `json:"notification_id,omitempty" gorm:"type:varchar(64);not null;index;uniqueIndex:idx_notif_recipient_unique"`
	RecipientType  string    `json:"type" gorm:"type:varchar(16);not null;index;uniqueIndex:idx_notif_recipient_unique"` // 'store' | 'user'
	RecipientID    uint      `json:"id" gorm:"not null;index;uniqueIndex:idx_notif_recipient_unique"`
	RecipientName  string    `json:"name" gorm:"type:varchar(255)"`
	RecipientSlug  string    `json:"slug,omitempty" gorm:"type:varchar(255)"`
	RecipientEmail string    `json:"email,omitempty" gorm:"type:varchar(255)"`
	RecipientPlan  string    `json:"plan,omitempty" gorm:"type:varchar(64)"`
	CreatedAt      time.Time `json:"created_at,omitempty"`
}

// TableName explicitly maps to 'notification_recipients' table.
func (NotificationRecipient) TableName() string {
	return "notification_recipients"
}

// NotificationRead records read, CTA click & dismiss receipts for broadcast / store notifications without duplicating payload rows.
type NotificationRead struct {
	ID             uint       `json:"id" gorm:"primaryKey;autoIncrement"`
	NotificationID string     `json:"notification_id" gorm:"type:varchar(64);index:idx_notif_read_store;not null"`
	StoreID        *uint      `json:"store_id,omitempty" gorm:"index:idx_notif_read_store;index"` // Nullable for account-level receipts (storeID == 0)
	UserID         uint       `json:"user_id" gorm:"index;not null"`
	ReadAt         time.Time  `json:"read_at" gorm:"not null"`
	ClickedAt      *time.Time `json:"clicked_at,omitempty" gorm:"index"`
	DismissedAt    *time.Time `json:"dismissed_at,omitempty" gorm:"index"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`

	// Relasi dideklarasikan agar constraint ON DELETE CASCADE terbentuk.
	User  *User  `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	Store *Store `gorm:"foreignKey:StoreID;constraint:OnDelete:CASCADE" json:"store,omitempty"`
}

// TableName explicitly maps to 'notification_reads' table.
func (NotificationRead) TableName() string {
	return "notification_reads"
}
