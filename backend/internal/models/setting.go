package models

import (
	"time"

	"gorm.io/datatypes"
)

type Setting struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Key       string    `gorm:"size:255;uniqueIndex;not null" json:"key"`
	Value     string    `gorm:"type:text" json:"value"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type PolicyVersion struct {
	ID                 uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	Type               string         `gorm:"size:50;index;not null" json:"type"` // terms | privacy | acceptable_use
	Title              string         `gorm:"size:255;not null" json:"title"`
	Version            string         `gorm:"size:50;not null" json:"version"`
	Content            string         `gorm:"type:text;not null" json:"content"`
	Sections           datatypes.JSON `gorm:"type:jsonb" json:"sections"`
	SummaryOfChanges   string         `gorm:"type:text" json:"summary_of_changes"`
	ChangeType         string         `gorm:"size:50;default:'minor'" json:"change_type"` // minor | major | critical
	EffectiveDate      time.Time      `json:"effective_date"`
	IsActive           bool           `gorm:"default:true" json:"is_active"`
	RequiresAcceptance bool           `gorm:"default:false" json:"requires_acceptance"`
	CreatedBy          uint           `json:"created_by"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
}

type PolicyAuditLog struct {
	ID            uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	PolicyType    string         `gorm:"size:50;index;not null" json:"policy_type"`
	Action        string         `gorm:"size:50;not null" json:"action"` // update | publish | rollback | create
	OldVersion    string         `gorm:"size:50" json:"old_version"`
	NewVersion    string         `gorm:"size:50" json:"new_version"`
	ChangeSummary string         `gorm:"type:text" json:"change_summary"`
	ChangedFields datatypes.JSON `gorm:"type:jsonb" json:"changed_fields"`
	AdminEmail    string         `gorm:"size:255" json:"admin_email"`
	AdminIP       string         `gorm:"size:100" json:"admin_ip"`
	CreatedAt     time.Time      `json:"created_at"`
}

type UserPolicyAgreement struct {
	ID              uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID          *uint     `gorm:"index" json:"user_id"`
	StoreID         *uint     `gorm:"index" json:"store_id"`
	PolicyType      string    `gorm:"size:50;not null" json:"policy_type"`
	PolicyVersion   string    `gorm:"size:50;not null" json:"policy_version"`
	IPAddress       string    `gorm:"size:100" json:"ip_address"`
	UserAgent       string    `gorm:"type:text" json:"user_agent"`
	AgreedContext   string    `gorm:"size:50" json:"agreed_context"` // checkout | registration | popup
	CustomerContact string    `gorm:"size:255" json:"customer_contact"`
	AgreedAt        time.Time `json:"agreed_at"`
}
