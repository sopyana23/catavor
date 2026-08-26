package models

import (
	"time"

	"gorm.io/datatypes"
)

type Fauna struct {
	ID                  uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	StoreID             uint           `gorm:"index;not null" json:"store_id"`
	Name                string         `gorm:"size:255;not null" json:"name"`
	ScientificName      string         `gorm:"size:255" json:"scientific_name"`
	Class               string         `gorm:"size:100;index" json:"class"`
	Habitat             string         `gorm:"size:100;index" json:"habitat"`
	Diet                string         `gorm:"size:100" json:"diet"`
	ConservationStatus  string         `gorm:"size:100" json:"conservation_status"`
	Price               float64        `gorm:"type:decimal(15,2);default:0" json:"price"`
	VideoURL            string         `gorm:"type:text" json:"video_url"`
	IsShippingAvailable bool           `gorm:"default:true" json:"is_shipping_available"`
	Description         string         `gorm:"type:text" json:"description"`
	ImageURL            string         `gorm:"type:text" json:"image_url"`
	DetailedInfo        datatypes.JSON `gorm:"type:jsonb" json:"detailed_info"`
	ProductType         string         `gorm:"size:50;default:'physical';index" json:"product_type"` // physical | digital | fauna | service | food
	Attributes          datatypes.JSON `gorm:"type:jsonb" json:"attributes"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`

	// Relations
	Store     *Store     `gorm:"foreignKey:StoreID" json:"store,omitempty"`
	Sightings []Sighting `gorm:"foreignKey:FaunaID" json:"sightings,omitempty"`
}

type Sighting struct {
	ID        uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	FaunaID   uint       `gorm:"index;not null" json:"fauna_id"`
	Location  string     `gorm:"size:255;not null" json:"location"`
	Latitude  float64    `gorm:"type:decimal(10,7)" json:"latitude"`
	Longitude float64    `gorm:"type:decimal(10,7)" json:"longitude"`
	SightedAt *time.Time `json:"sighted_at"`
	Notes     string     `gorm:"type:text" json:"notes"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}
