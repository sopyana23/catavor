package services

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/models"
	"gorm.io/datatypes"
)

func TestSanitizeCSVField(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"Normal Text", "Normal Text"},
		{"=1+1", "'=1+1"},
		{"+628123456", "'+628123456"},
		{"-100", "'-100"},
		{"@SUM(A1:A10)", "'@SUM(A1:A10)"},
		{"", ""},
		{"   ", ""},
	}

	for _, c := range cases {
		got := SanitizeCSVField(c.input)
		if got != c.expected {
			t.Errorf("SanitizeCSVField(%q) = %q; want %q", c.input, got, c.expected)
		}
	}
}

func TestExportCatalogCSV(t *testing.T) {
	store := &models.Store{
		ID:         1,
		Slug:       "toko-test",
		StoreTitle: "Toko Test",
	}

	category := &models.Category{
		ID:   10,
		Name: "Fauna Eksotis",
	}

	price := 150000.0
	products := []models.Product{
		{
			ID:                 101,
			StoreID:            1,
			CategoryID:         &category.ID,
			Category:           category,
			Name:               "Gecko Leopard",
			ProductType:        "fauna",
			Price:              price,
			ConservationStatus: "available",
			MinOrder:           1,
			IsActive:           true,
			Attributes:         datatypes.JSON([]byte(`{"diet":"Serangga","habitat":"Gurun"}`)),
			DetailedInfo:       datatypes.JSON([]byte(`{"garansi":"1x24 jam"}`)),
			Description:        "Gecko sehat makan lancar",
			ImageURL:           "https://catavor.com/img/gecko.jpg",
			CreatedAt:          time.Date(2026, 10, 27, 10, 0, 0, 0, time.UTC),
			Variants: []models.ProductVariant{
				{
					VariantName: "Enigma",
					SKU:         "GCK-ENI",
					StockQty:    5,
				},
			},
		},
	}

	var buf bytes.Buffer
	err := ExportCatalogCSV(&buf, store, products)
	if err != nil {
		t.Fatalf("ExportCatalogCSV error: %v", err)
	}

	output := buf.Bytes()
	// Check BOM
	if len(output) < 3 || output[0] != 0xef || output[1] != 0xbb || output[2] != 0xbf {
		t.Errorf("Expected UTF-8 BOM at start of CSV")
	}

	csvStr := string(output[3:])
	if !strings.Contains(csvStr, "ID Produk") {
		t.Errorf("Expected header 'ID Produk' in CSV")
	}
	if !strings.Contains(csvStr, "Stok Utama") {
		t.Errorf("Expected header 'Stok Utama' in CSV")
	}
	if !strings.Contains(csvStr, "Gecko Leopard") {
		t.Errorf("Expected product 'Gecko Leopard' in CSV")
	}
	if !strings.Contains(csvStr, "GCK-ENI") {
		t.Errorf("Expected variant SKU 'GCK-ENI' in CSV")
	}
}

func TestExportCatalogJSON(t *testing.T) {
	store := &models.Store{
		ID:               1,
		Slug:             "toko-test",
		StoreTitle:       "Toko Test",
		AboutDescription: "Toko fauna terpercaya",
		OfficialWebsite:  "https://tokotest.com",
	}

	category := models.Category{
		ID:          10,
		Name:        "Fauna Eksotis",
		Slug:        "fauna-eksotis",
		ProductType: "fauna",
		SortOrder:   1,
	}

	products := []models.Product{
		{
			ID:                 101,
			StoreID:            1,
			CategoryID:         &category.ID,
			Category:           &category,
			Name:               "Gecko Leopard",
			ProductType:        "fauna",
			Price:              150000,
			ConservationStatus: "available",
			MinOrder:           1,
			IsActive:           true,
			Attributes:         datatypes.JSON([]byte(`{"diet":"Serangga"}`)),
			CreatedAt:          time.Now(),
			UpdatedAt:          time.Now(),
		},
	}

	var buf bytes.Buffer
	err := ExportCatalogJSON(&buf, store, []models.Category{category}, products)
	if err != nil {
		t.Fatalf("ExportCatalogJSON error: %v", err)
	}

	var root map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &root); err != nil {
		t.Fatalf("JSON parse error: %v", err)
	}

	metadata, ok := root["export_metadata"].(map[string]interface{})
	if !ok || metadata["platform"] != "Catavor Multi-Tenant Smart Catalog" {
		t.Errorf("Invalid metadata platform: %v", metadata)
	}

	storeMap, ok := root["store"].(map[string]interface{})
	if !ok || storeMap["about_description"] != "Toko fauna terpercaya" {
		t.Errorf("Store metadata missing about_description: %v", storeMap)
	}

	prods, ok := root["products"].([]interface{})
	if !ok || len(prods) != 1 {
		t.Errorf("Expected 1 product in JSON, got %d", len(prods))
	}

	masterCats, ok := root["master_categories"].([]interface{})
	if !ok || len(masterCats) != 1 || masterCats[0] != "Fauna Eksotis" {
		t.Errorf("Expected master_categories with 'Fauna Eksotis', got %v", masterCats)
	}
}

func TestExportProductsJSON(t *testing.T) {
	store := &models.Store{
		ID:         1,
		Slug:       "toko-test",
		StoreTitle: "Toko Test",
	}

	category := models.Category{
		ID:          10,
		Name:        "Fauna Eksotis",
		Slug:        "fauna-eksotis",
		ProductType: "fauna",
	}

	products := []models.Product{
		{
			ID:                 101,
			StoreID:            1,
			CategoryID:         &category.ID,
			Category:           &category,
			Name:               "Gecko Leopard",
			ProductType:        "fauna",
			Price:              150000,
			ConservationStatus: "available",
			MinOrder:           1,
			IsActive:           true,
			CreatedAt:          time.Now(),
			UpdatedAt:          time.Now(),
		},
	}

	var buf bytes.Buffer
	err := ExportProductsJSON(&buf, store, products)
	if err != nil {
		t.Fatalf("ExportProductsJSON error: %v", err)
	}

	var root map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &root); err != nil {
		t.Fatalf("JSON parse error: %v", err)
	}

	if root["export_type"] != "catalog_items" {
		t.Errorf("Expected export_type 'catalog_items', got %v", root["export_type"])
	}

	if root["store_slug"] != "toko-test" {
		t.Errorf("Expected store_slug 'toko-test', got %v", root["store_slug"])
	}

	// Verify store settings/backup fields are NOT present
	if _, hasStore := root["store"]; hasStore {
		t.Errorf("Catalog items export must not contain store backup object")
	}

	items, ok := root["items"].([]interface{})
	if !ok || len(items) != 1 {
		t.Errorf("Expected 1 item in JSON, got %d", len(items))
	}
}

