package models

import (
	"time"

	"gorm.io/datatypes"
)

// ActivityLog represents an append-only, hash-chained enterprise audit trail record
// for both Merchant and Platform Staff/Superadmin actions.
// StoreID and UserID are intentionally stored as immutable historical snapshots
// (without cascading deletes) so deleting a store or closing an account never destroys
// prior forensic or compliance records.
type ActivityLog struct {
	ID          uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	StoreID     *uint          `gorm:"index:idx_activity_store_created;index" json:"store_id,omitempty"` // nullable for global Superadmin actions
	UserID      *uint          `gorm:"index:idx_activity_user_created;index" json:"user_id,omitempty"`   // actor user ID snapshot
	ActorRole   string         `gorm:"size:50;default:'merchant';index" json:"actor_role"`               // merchant | superadmin | system | platform staff slug
	ActorName   string         `gorm:"size:255;not null" json:"actor_name"`                              // snapshot of actor's name
	ActorEmail  string         `gorm:"size:255;index" json:"actor_email"`                                // snapshot of actor's email
	Action      string         `gorm:"size:100;index;not null" json:"action"`                            // e.g., 'product.create', 'product.price_change', 'admin.broadcast_notification'
	Category    string         `gorm:"size:50;index;not null" json:"category"`                           // security | catalog | store | billing | superadmin | moderation | system | market_intel
	EntityType  string         `gorm:"size:50;index" json:"entity_type"`                                 // product | store | notification | plan | policy | report | user | safe_domain | user_session
	EntityID    *uint          `gorm:"index" json:"entity_id,omitempty"`                                 // ID of target entity
	EntityTitle string         `gorm:"size:255" json:"entity_title,omitempty"`                           // snapshot name/title of target
	Description string         `gorm:"type:text;not null" json:"description"`                            // human-readable message
	Changes     datatypes.JSON `gorm:"type:jsonb" json:"changes,omitempty"`                              // { before: {...}, after: {...} } or custom diff
	IPAddress   string         `gorm:"size:100" json:"ip_address,omitempty"`
	UserAgent   string         `gorm:"type:text" json:"user_agent,omitempty"`
	ChainSeq    uint64         `gorm:"index;not null;default:0" json:"chain_seq,omitempty"`
	PrevHash    string         `gorm:"size:64;not null;default:''" json:"prev_hash,omitempty"`
	EntryHash   string         `gorm:"size:64;index;not null;default:''" json:"entry_hash,omitempty"`
	CreatedAt   time.Time      `gorm:"index:idx_activity_store_created,sort:desc;index:idx_activity_created,sort:desc;not null" json:"created_at"`
}

// ArchivedActivityLog preserves aged operational logs moved out of hot activity_logs
// by retention cleanup so historical forensic evidence is never silently lost.
type ArchivedActivityLog struct {
	ID          uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	OriginalID  uint           `gorm:"uniqueIndex;not null" json:"original_id"`
	StoreID     *uint          `gorm:"index" json:"store_id,omitempty"`
	UserID      *uint          `gorm:"index" json:"user_id,omitempty"`
	ActorRole   string         `gorm:"size:50;index" json:"actor_role"`
	ActorName   string         `gorm:"size:255;not null" json:"actor_name"`
	ActorEmail  string         `gorm:"size:255;index" json:"actor_email"`
	Action      string         `gorm:"size:100;index;not null" json:"action"`
	Category    string         `gorm:"size:50;index;not null" json:"category"`
	EntityType  string         `gorm:"size:50;index" json:"entity_type"`
	EntityID    *uint          `gorm:"index" json:"entity_id,omitempty"`
	EntityTitle string         `gorm:"size:255" json:"entity_title,omitempty"`
	Description string         `gorm:"type:text;not null" json:"description"`
	Changes     datatypes.JSON `gorm:"type:jsonb" json:"changes,omitempty"`
	IPAddress   string         `gorm:"size:100" json:"ip_address,omitempty"`
	UserAgent   string         `gorm:"type:text" json:"user_agent,omitempty"`
	ChainSeq    uint64         `gorm:"index;not null;default:0" json:"chain_seq,omitempty"`
	PrevHash    string         `gorm:"size:64;not null;default:''" json:"prev_hash,omitempty"`
	EntryHash   string         `gorm:"size:64;index;not null;default:''" json:"entry_hash,omitempty"`
	CreatedAt   time.Time      `gorm:"index;not null" json:"created_at"`
	ArchivedAt  time.Time      `gorm:"index;not null" json:"archived_at"`
}

func (ArchivedActivityLog) TableName() string {
	return "archived_activity_logs"
}
