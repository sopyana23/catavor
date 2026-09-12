package models

import (
	"time"
)

// PlatformRole represents an administrative role for platform management.
type PlatformRole struct {
	ID          uint                 `gorm:"primaryKey;autoIncrement" json:"id"`
	Slug        string               `gorm:"size:50;uniqueIndex;not null" json:"slug"` // superadmin, compliance, support, finance, content, or custom
	Name        string               `gorm:"size:100;not null" json:"name"`
	Description string               `gorm:"size:255" json:"description"`
	IsSystem    bool                 `gorm:"default:false" json:"is_system"` // System roles cannot be deleted
	CreatedAt   time.Time            `json:"created_at"`
	UpdatedAt   time.Time            `json:"updated_at"`
	Permissions []PlatformPermission `gorm:"many2many:platform_role_permissions;joinForeignKey:RoleID;joinReferences:PermissionID" json:"permissions,omitempty"`
}

// PlatformPermission represents a granular access permission.
type PlatformPermission struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Key         string    `gorm:"size:100;uniqueIndex;not null" json:"key"` // e.g. compliance:reports:manage
	Group       string    `gorm:"size:50;index;not null" json:"group"`       // compliance, support, finance, content, audit, system
	Name        string    `gorm:"size:100;not null" json:"name"`
	Description string    `gorm:"size:255" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// PlatformRolePermission is the explicit many-to-many join table model.
type PlatformRolePermission struct {
	RoleID       uint      `gorm:"primaryKey" json:"role_id"`
	PermissionID uint      `gorm:"primaryKey" json:"permission_id"`
	CreatedAt    time.Time `json:"created_at"`
}
