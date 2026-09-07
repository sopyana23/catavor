package models

import (
	"time"

	"gorm.io/datatypes"
)

// Category represents a structured category taxonomy for a store.
type Category struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	StoreID     uint      `gorm:"index;not null" json:"store_id"`
	Name        string    `gorm:"size:100;not null" json:"name"`
	Slug        string    `gorm:"size:100;not null" json:"slug"`
	ProductType string    `gorm:"size:50;default:'physical'" json:"product_type"` // physical | food | service | digital | property | fauna
	SortOrder   int       `gorm:"default:0" json:"sort_order"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// Relations
	Store    *Store    `gorm:"foreignKey:StoreID" json:"store,omitempty"`
	Products []Product `gorm:"foreignKey:CategoryID" json:"products,omitempty"`
}

// Product represents a universal catalog item across all business industries.
type Product struct {
	ID                  uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	StoreID             uint           `gorm:"index;not null" json:"store_id"`
	CategoryID          *uint          `gorm:"index" json:"category_id,omitempty"`
	Name                string         `gorm:"size:255;not null" json:"name"`
	ScientificName      string         `gorm:"size:255" json:"scientific_name,omitempty"`
	Class               string         `gorm:"size:100;index" json:"class"`
	Habitat             string         `gorm:"size:100;index" json:"habitat"`
	Diet                string         `gorm:"size:100" json:"diet,omitempty"`
	ConservationStatus  string         `gorm:"size:100" json:"conservation_status"` // available | sold_out | limited | pre_order
	Price               float64        `gorm:"type:decimal(15,2);default:0" json:"price"`
	MinOrder            int            `gorm:"default:1" json:"min_order"`
	MaxOrder            *int           `gorm:"default:null" json:"max_order"`
	VideoURL            string         `gorm:"type:text" json:"video_url"`
	IsShippingAvailable bool           `gorm:"default:true" json:"is_shipping_available"`
	Description         string         `gorm:"type:text" json:"description"`
	ImageURL            string         `gorm:"type:text" json:"image_url"`
	DetailedInfo        datatypes.JSON `gorm:"type:jsonb" json:"detailed_info"`
	ProductType         string         `gorm:"size:50;default:'physical';index" json:"product_type"` // physical | food | service | digital | property | fauna
	Attributes          datatypes.JSON `gorm:"type:jsonb" json:"attributes"`
	IsActive            bool           `gorm:"default:true;index" json:"is_active"`
	ArchivedAt          *time.Time     `gorm:"index" json:"archived_at,omitempty"`
	ViewCount           int64          `gorm:"default:0" json:"view_count"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`

	// Relations
	Store     *Store           `gorm:"foreignKey:StoreID" json:"store,omitempty"`
	Category  *Category        `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Images    []ProductImage   `gorm:"foreignKey:ProductID" json:"images,omitempty"`
	Variants  []ProductVariant `gorm:"foreignKey:ProductID" json:"variants,omitempty"`
	Sightings []Sighting       `gorm:"foreignKey:FaunaID" json:"sightings,omitempty"`
}

// TableName explicitly maps the Product model to the 'products' database table.
func (Product) TableName() string {
	return "products"
}

// ProductImage represents multiple gallery images attached to a product.
type ProductImage struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	ProductID  uint      `gorm:"index;not null" json:"product_id"`
	ImageURL   string    `gorm:"type:text;not null" json:"image_url"`
	StorageKey string    `gorm:"size:500" json:"storage_key,omitempty"`
	SortOrder  int       `gorm:"default:0" json:"sort_order"`
	IsPrimary  bool      `gorm:"default:false" json:"is_primary"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`

	// Relations
	Product *Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}

// TableName maps to product_images table.
func (ProductImage) TableName() string {
	return "product_images"
}

// ProductVariant represents item variations (sizes, flavors, colors, SKU).
type ProductVariant struct {
	ID            uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	ProductID     uint       `gorm:"index;not null" json:"product_id"`
	VariantName   string     `gorm:"size:100;not null" json:"variant_name"`
	SKU           string     `gorm:"size:100" json:"sku,omitempty"`
	PriceOverride *float64   `gorm:"type:decimal(15,2)" json:"price_override,omitempty"`
	StockQty      int        `gorm:"default:0" json:"stock_qty"`
	IsActive      bool       `gorm:"default:true" json:"is_active"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`

	// Relations
	Product *Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}

// TableName maps to product_variants table.
func (ProductVariant) TableName() string {
	return "product_variants"
}
