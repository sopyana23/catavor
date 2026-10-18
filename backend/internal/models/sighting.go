package models

import "time"

// Sighting adalah catatan pengamatan lokasi untuk produk tipe fauna.
// Field FaunaID mereferensikan products.id (nama kolom legacy dari iterasi awal).
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
