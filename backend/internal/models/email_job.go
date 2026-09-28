package models

import (
	"time"
)

type EmailJob struct {
	ID             string     `gorm:"primaryKey;size:64" json:"id"`
	RecipientEmail string     `gorm:"size:255;not null;index" json:"recipient_email"`
	RecipientName  string     `gorm:"size:255" json:"recipient_name"`
	FromName       string     `gorm:"size:255" json:"from_name"`
	Subject        string     `gorm:"size:500;not null" json:"subject"`
	BodyHTML       string     `gorm:"type:text;not null" json:"body_html"`
	Category       string     `gorm:"size:64;index" json:"category"` // compliance_banned, compliance_suspended, compliance_restored, compliance_warning, support_reply, dormancy_alert
	ReferenceID    string     `gorm:"size:100;index" json:"reference_id"`
	Status         string     `gorm:"size:32;default:'pending';index" json:"status"` // pending, processing, sent, failed
	Attempts       int        `gorm:"default:0" json:"attempts"`
	MaxAttempts    int        `gorm:"default:5" json:"max_attempts"`
	LastError      string     `gorm:"type:text" json:"last_error"`
	NextRetryAt    *time.Time `gorm:"index" json:"next_retry_at"`
	SentAt         *time.Time `json:"sent_at"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

func (EmailJob) TableName() string {
	return "email_jobs"
}
