package models

import "time"

// EmailVerificationOTP represents an enterprise one-time password record for email verification and account recovery.
type EmailVerificationOTP struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Email     string    `gorm:"size:255;not null;index" json:"email"`
	OTPHash   string    `gorm:"size:255;not null" json:"-"`
	Purpose   string    `gorm:"size:50;not null;index" json:"purpose"` // "registration" | "password_reset"
	Token     string    `gorm:"size:255;index" json:"token,omitempty"`
	Attempts  int       `gorm:"default:0" json:"attempts"`
	ExpiresAt time.Time `gorm:"not null;index" json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}
