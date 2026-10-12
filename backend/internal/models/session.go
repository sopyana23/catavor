package models

import (
	"time"
)

type UserSession struct {
	ID           uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID       uint       `gorm:"index;not null" json:"user_id"`
	TokenID      string     `gorm:"size:255;index;not null" json:"token_id"` // JWT jti UUID
	IPAddress    string     `gorm:"size:100;not null" json:"ip_address"`
	UserAgent    string     `gorm:"type:text" json:"user_agent"`
	DeviceName   string     `gorm:"size:255;not null" json:"device_name"` // e.g. "Chrome di Windows 11"
	DeviceType   string     `gorm:"size:50;not null" json:"device_type"`  // desktop | mobile | tablet
	Browser      string     `gorm:"size:100" json:"browser"`
	OS           string     `gorm:"size:100" json:"os"`
	Location     string     `gorm:"size:255" json:"location,omitempty"`
	LastActiveAt time.Time  `gorm:"index;not null" json:"last_active_at"`
	ExpiresAt    time.Time  `gorm:"index;not null" json:"expires_at"`
	IsRevoked    bool       `gorm:"default:false;index" json:"is_revoked"`
	RevokedAt    *time.Time `json:"revoked_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`

	// Relasi
	User *User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
}

type UserSessionResponse struct {
	ID           uint      `json:"id"`
	DeviceName   string    `json:"device_name"`
	DeviceType   string    `json:"device_type"`
	Browser      string    `json:"browser"`
	OS           string    `json:"os"`
	IPAddress    string    `json:"ip_address"`
	Location     string    `json:"location,omitempty"`
	LastActiveAt time.Time `json:"last_active_at"`
	CreatedAt    time.Time `json:"created_at"`
	IsCurrent    bool      `json:"is_current"`
}
