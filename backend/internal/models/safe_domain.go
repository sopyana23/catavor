package models

import "time"

type SafeDomain struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Domain      string    `gorm:"size:255;uniqueIndex;not null" json:"domain"` // e.g. "google.com", "wa.me"
	Category    string    `gorm:"size:100;default:'Umum'" json:"category"`     // e.g. "Google", "Media Sosial", "Komunikasi", "Mitra", "Finansial"
	Description string    `gorm:"size:500" json:"description"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	IsSystem    bool      `gorm:"default:false" json:"is_system"` // System default domains
	CreatedBy   string    `gorm:"size:100" json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
