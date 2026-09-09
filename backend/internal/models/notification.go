package models

import "time"

// Notification represents a system or broadcast notification item for merchants
type Notification struct {
	ID                    string     `json:"id" gorm:"primaryKey;type:varchar(64)"`
	TargetType            string     `json:"target_type" gorm:"type:varchar(32);default:'all';index"` // 'all', 'plan', 'single_store', 'single_user'
	TargetPlanCode        string     `json:"target_plan_code" gorm:"type:varchar(64);index"`          // e.g. 'free', 'pro_starter', 'pro_business' (dynamic plan code)
	TargetID              uint       `json:"target_id" gorm:"index;default:0"`                        // StoreID or UserID if single target
	Title                 string     `json:"title" gorm:"type:varchar(255);not null"`
	Category              string     `json:"category" gorm:"type:varchar(32);default:'SISTEM'"`       // 'PANDUAN', 'PROMOSI', 'INVENTARIS', 'SISTEM', 'KEAMANAN'
	Message               string     `json:"message" gorm:"type:text;not null"`
	DetailContent         string     `json:"detail_content" gorm:"type:text"`
	Type                  string     `json:"type" gorm:"type:varchar(32);default:'system'"`           // 'warning', 'success', 'order', 'system', 'info', 'ticket', 'stock'
	ActionType            string     `json:"action_type" gorm:"type:varchar(32);default:'detail'"`    // 'detail', 'navigate', 'none', 'external_link'
	LinkSubTab            string     `json:"link_sub_tab" gorm:"type:varchar(64)"`                   // e.g. 'settings', 'items', 'subscription', 'help', 'share', 'analytics'
	LinkMobileSettingsTab string     `json:"link_mobile_settings_tab" gorm:"type:varchar(64)"`        // e.g. 'about', 'general', 'contact', 'theme', 'master', 'domain'
	ActionLabel           string     `json:"action_label" gorm:"type:varchar(128)"`                  // e.g. 'Buka Pengaturan Tentang Kami →'
	ActionURL             string     `json:"action_url" gorm:"type:varchar(512)"`
	ExpiresAt             *time.Time `json:"expires_at" gorm:"index"`                                 // Absolute expiration timestamp (nil = unlimited)
	RetentionHours        int        `json:"retention_hours" gorm:"default:72"`                       // Hours to retain in history after being read (default 72h / 3 days)
	CreatedBy             uint       `json:"created_by" gorm:"default:0"`                             // Superadmin User ID who created the broadcast
	CreatedAt             time.Time  `json:"created_at" gorm:"index"`
	UpdatedAt             time.Time  `json:"updated_at"`

	// Virtual Computed Fields (Injected during query for specific store/user)
	IsRead      bool       `json:"read" gorm:"->;-:migration"`
	ReadAt      *time.Time `json:"read_at,omitempty" gorm:"->;-:migration"`
	DismissedAt *time.Time `json:"dismissed_at,omitempty" gorm:"->;-:migration"`
	Timestamp   string     `json:"timestamp,omitempty" gorm:"->;-:migration"`
}

// TableName explicitly maps to 'notifications' table.
func (Notification) TableName() string {
	return "notifications"
}

// NotificationRead records read & dismiss receipts for broadcast / store notifications without duplicating payload rows.
type NotificationRead struct {
	ID             uint       `json:"id" gorm:"primaryKey;autoIncrement"`
	NotificationID string     `json:"notification_id" gorm:"type:varchar(64);index:idx_notif_read_store;not null"`
	StoreID        uint       `json:"store_id" gorm:"index:idx_notif_read_store;index;not null"`
	UserID         uint       `json:"user_id" gorm:"index;not null"`
	ReadAt         time.Time  `json:"read_at" gorm:"not null"`
	DismissedAt    *time.Time `json:"dismissed_at" gorm:"index"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// TableName explicitly maps to 'notification_reads' table.
func (NotificationRead) TableName() string {
	return "notification_reads"
}
