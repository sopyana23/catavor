package models

import "time"

// Notification represents an industry-standard in-app notification item for merchants
type Notification struct {
	ID                    string    `json:"id" gorm:"primaryKey;type:varchar(64)"`
	StoreID               uint      `json:"store_id" gorm:"index"`
	UserID                uint      `json:"user_id" gorm:"index"`
	Title                 string    `json:"title" gorm:"type:varchar(255);not null"`
	Message               string    `json:"message" gorm:"type:text;not null"`
	DetailContent         string    `json:"detail_content" gorm:"type:text"`
	Type                  string    `json:"type" gorm:"type:varchar(32);default:'system'"` // 'system', 'order', 'comment', 'ticket', 'warning', 'info', 'success', 'stock'
	ActionType            string    `json:"action_type" gorm:"type:varchar(32);default:'detail'"` // 'detail', 'navigate', 'external_link'
	LinkSubTab            string    `json:"link_sub_tab" gorm:"type:varchar(64)"` // e.g. 'settings', 'items', 'subscription', 'help'
	LinkMobileSettingsTab string    `json:"link_mobile_settings_tab" gorm:"type:varchar(64)"` // e.g. 'about', 'general', 'contact', 'theme', 'master'
	ActionLabel           string    `json:"action_label" gorm:"type:varchar(128)"` // e.g. 'Buka Pengaturan Tentang Kami'
	ActionURL             string    `json:"action_url" gorm:"type:varchar(512)"`
	IsRead                bool      `json:"read" gorm:"default:false"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}
