package models

import (
	"time"

	"gorm.io/datatypes"
)

// MasterPreset adalah template data master default per product type.
// Dipakai oleh ApplyMasterPreset untuk mengisi master_classes, master_habitats,
// master_statuses, dan master_shipping_coverages pada store baru.
type MasterPreset struct {
	ID                      uint           `gorm:"primaryKey" json:"id"`
	ProductType             string         `gorm:"type:varchar(50);uniqueIndex;not null" json:"product_type"`
	MasterClasses           datatypes.JSON `gorm:"type:jsonb" json:"master_classes"`
	MasterHabitats          datatypes.JSON `gorm:"type:jsonb" json:"master_habitats"`
	MasterStatuses          datatypes.JSON `gorm:"type:jsonb" json:"master_statuses"`
	MasterShippingCoverages datatypes.JSON `gorm:"type:jsonb" json:"master_shipping_coverages"`
	CreatedAt               time.Time      `json:"created_at"`
	UpdatedAt               time.Time      `json:"updated_at"`
}

func (MasterPreset) TableName() string { return "master_presets" }
