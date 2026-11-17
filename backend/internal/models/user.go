package models

import (
	"crypto/subtle"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID                       uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	Name                     string     `gorm:"size:255;not null" json:"name"`
	Email                    string     `gorm:"size:255;uniqueIndex;not null" json:"email"`
	EmailVerifiedAt          *time.Time `json:"email_verified_at,omitempty"`
	Password                 string     `gorm:"size:255;not null" json:"-"`
	GoogleID                 *string    `gorm:"size:255;index" json:"google_id,omitempty"`
	IsPasswordChanged        bool       `gorm:"default:false" json:"is_password_changed"`
	PlatformRole             string     `gorm:"size:50;default:'merchant';index;index:idx_users_platform_role_2fa,priority:1" json:"platform_role"`
	IsBlacklisted            bool       `gorm:"default:false;index" json:"is_blacklisted"`
	TokenVersion             int        `gorm:"default:1" json:"token_version"`
	HasCustomPassword        bool       `gorm:"default:false" json:"has_custom_password"`
	TwoFactorEnabled         bool       `gorm:"not null;default:false;index:idx_users_two_factor_enabled,where:two_factor_enabled = true;index:idx_users_platform_role_2fa,priority:2" json:"two_factor_enabled"`
	TwoFactorEnforced        bool       `gorm:"not null;default:false;index:idx_users_two_factor_enforced,where:two_factor_enforced = true" json:"two_factor_enforced"`
	TwoFactorSecretEnc       *string    `gorm:"type:text" json:"-"`
	TwoFactorBackupCodesHash *string    `gorm:"type:text" json:"-"`
	TwoFactorEnrolledAt      *time.Time `json:"two_factor_enrolled_at,omitempty"`
	TwoFactorSetupJTI        *string    `gorm:"size:64;index:idx_users_two_factor_setup_jti,where:two_factor_setup_jti IS NOT NULL" json:"-"`
	TwoFactorLastTOTPStep    int64      `gorm:"not null;default:0" json:"-"`
	RememberToken            *string    `gorm:"size:100" json:"-"`
	CreatedAt                time.Time  `json:"created_at"`
	UpdatedAt                time.Time  `json:"updated_at"`

	// Relations
	Store  *Store  `gorm:"foreignKey:UserID" json:"store,omitempty"`
	Stores []Store `gorm:"foreignKey:UserID" json:"stores,omitempty"`
}

func (u *User) SetPassword(plainPassword string) error {
	bytes, err := bcrypt.GenerateFromPassword([]byte(plainPassword), 12)
	if err != nil {
		return err
	}
	u.Password = string(bytes)
	return nil
}

func (u *User) CheckPassword(plainPassword string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(plainPassword))
	return err == nil
}

func SafeCompareString(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
