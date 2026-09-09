package models

import (
	"time"

	"gorm.io/datatypes"
)

// ActivityLog represents an enterprise audit trail record for both Merchant and Superadmin actions.
type ActivityLog struct {
	ID          uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	StoreID     *uint          `gorm:"index:idx_activity_store_created;index" json:"store_id,omitempty"` // nullable for global Superadmin actions
	UserID      *uint          `gorm:"index:idx_activity_user_created;index" json:"user_id,omitempty"`   // actor user ID
	ActorRole   string         `gorm:"size:50;default:'merchant';index" json:"actor_role"`                // merchant | superadmin | system
	ActorName   string         `gorm:"size:255;not null" json:"actor_name"`                               // snapshot of actor's name
	ActorEmail  string         `gorm:"size:255;index" json:"actor_email"`                                 // snapshot of actor's email
	Action      string         `gorm:"size:100;index;not null" json:"action"`                              // e.g., 'product.create', 'product.price_change', 'admin.broadcast_notification'
	Category    string         `gorm:"size:50;index;not null" json:"category"`                            // security | catalog | store | billing | superadmin | moderation | system
	EntityType  string         `gorm:"size:50;index" json:"entity_type"`                                  // product | store | notification | plan | policy | report | user
	EntityID    *uint          `gorm:"index" json:"entity_id,omitempty"`                                  // ID of target entity
	EntityTitle string         `gorm:"size:255" json:"entity_title,omitempty"`                            // snapshot name/title of target
	Description string         `gorm:"type:text;not null" json:"description"`                             // human-readable message
	Changes     datatypes.JSON `gorm:"type:jsonb" json:"changes,omitempty"`                               // { before: {...}, after: {...} } or custom diff
	IPAddress   string         `gorm:"size:100" json:"ip_address,omitempty"`
	UserAgent   string         `gorm:"type:text" json:"user_agent,omitempty"`
	CreatedAt   time.Time      `gorm:"index:idx_activity_store_created,sort:desc;index:idx_activity_created,sort:desc;not null" json:"created_at"`

	// Relations
	Store *Store `gorm:"foreignKey:StoreID;constraint:OnDelete:CASCADE" json:"store,omitempty"`
	User  *User  `gorm:"foreignKey:UserID;constraint:OnDelete:SET NULL" json:"user,omitempty"`
}
