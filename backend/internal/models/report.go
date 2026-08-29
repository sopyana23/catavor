package models

import (
	"time"
)

// Report represents a violation or complaint submitted by a user for a Catalog or specific Item
type Report struct {
	ID                uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	ReportNumber      string     `gorm:"size:50;uniqueIndex;not null" json:"report_number"`
	TargetType        string     `gorm:"size:50;index;not null" json:"target_type"` // 'catalog' | 'item'
	StoreID           uint       `gorm:"index;not null" json:"store_id"`
	FaunaID           *uint      `gorm:"index" json:"fauna_id,omitempty"` // nullable, present if target_type == 'item'
	StoreSlug         string     `gorm:"size:255;not null" json:"store_slug"`
	StoreTitle        string     `gorm:"size:255;not null" json:"store_title"`
	ItemName          string     `gorm:"size:255" json:"item_name,omitempty"`
	ReasonCategory    string     `gorm:"size:100;index;not null" json:"reason_category"`
	ReasonLabel       string     `gorm:"size:255;not null" json:"reason_label"`
	Description       string     `gorm:"type:text" json:"description"`
	ReporterEmail     string     `gorm:"size:255" json:"reporter_email"`
	ReporterIP        string     `gorm:"size:100" json:"reporter_ip"`
	ReporterUserAgent string     `gorm:"type:text" json:"reporter_user_agent"`
	Status            string     `gorm:"size:50;default:'pending';index" json:"status"` // pending | in_review | resolved | dismissed | action_taken
	AdminNotes        string     `gorm:"type:text" json:"admin_notes"`
	ActionTaken       string     `gorm:"size:100;default:'none'" json:"action_taken"` // none | warning_issued | item_hidden | catalog_suspended | account_banned
	ReviewedBy        *uint      `gorm:"index" json:"reviewed_by,omitempty"`
	ReviewedAt        *time.Time `json:"reviewed_at,omitempty"`
	CreatedAt         time.Time  `gorm:"index" json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`

	// Relations
	Store *Store `gorm:"foreignKey:StoreID" json:"store,omitempty"`
	Fauna *Fauna `gorm:"foreignKey:FaunaID" json:"fauna,omitempty"`
}
