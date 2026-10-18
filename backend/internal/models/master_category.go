package models

import "time"

// MasterCategory adalah sumber otoritatif tunggal untuk daftar kategori
// default per product type. Disediakan via API (GET /api/master-categories)
// dan dipakai oleh IsSystemDefaultCategory untuk validasi.
//
// Data awal di-seed oleh migrasi 20261018_n53_master_categories.sql.
type MasterCategory struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	ProductType string    `gorm:"size:50;not null;index:idx_master_cat_type_name,unique" json:"product_type"`
	Name        string    `gorm:"size:100;not null;index:idx_master_cat_type_name,unique" json:"name"`
	SortOrder   int       `gorm:"default:0" json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// TableName memetakan MasterCategory ke tabel master_categories.
func (MasterCategory) TableName() string {
	return "master_categories"
}
