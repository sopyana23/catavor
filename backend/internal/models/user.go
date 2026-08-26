package models

import (
	"crypto/subtle"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID                uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	Name              string     `gorm:"size:255;not null" json:"name"`
	Email             string     `gorm:"size:255;uniqueIndex;not null" json:"email"`
	EmailVerifiedAt   *time.Time `json:"email_verified_at,omitempty"`
	Password          string     `gorm:"size:255;not null" json:"-"`
	GoogleID          *string    `gorm:"size:255;index" json:"google_id,omitempty"`
	IsPasswordChanged bool       `gorm:"default:false" json:"is_password_changed"`
	RememberToken     *string    `gorm:"size:100" json:"-"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`

	// Relations
	Store *Store `gorm:"foreignKey:UserID" json:"store,omitempty"`
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
