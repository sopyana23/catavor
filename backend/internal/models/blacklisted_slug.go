package models

import "time"

// BlacklistedSlug represents a permanently terminated catalog store slug reserved to prevent re-registration.
type BlacklistedSlug struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Slug         string    `gorm:"uniqueIndex;size:100;not null" json:"slug"`
	StoreTitle   string    `gorm:"size:255" json:"store_title"`
	OwnerEmail   string    `gorm:"size:255" json:"owner_email"`
	Reason       string    `gorm:"size:255" json:"reason"`
	BannedBy     string    `gorm:"size:100" json:"banned_by"`
	ReportNumber string    `gorm:"size:50" json:"report_number"`
	BannedAt     time.Time `gorm:"not null" json:"banned_at"`
	CreatedAt    time.Time `json:"created_at"`
}
