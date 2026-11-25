package handlers

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"catavor-backend/internal/config"
	"catavor-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/datatypes"
)

func TestCatalogMetricsAndProductStockFilter(t *testing.T) {
	db := newTestDB(t)
	if err := db.AutoMigrate(&models.Category{}, &models.Product{}, &models.ProductVariant{}, &models.ProductImage{}); err != nil {
		t.Fatalf("automigrate catalog tables: %v", err)
	}

	owner := models.User{
		Name:         "Pemilik Katalog",
		Email:        "katalog-owner@example.com",
		Password:     "hashed",
		PlatformRole: "merchant",
	}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}

	store := models.Store{
		UserID:         owner.ID,
		Slug:           "toko-uji-stok",
		StoreTitle:     "Toko Uji Stok",
		Plan:           "pro_starter",
		PlanStatus:     "active",
		DormancyStatus: "active",
	}
	if err := db.Create(&store).Error; err != nil {
		t.Fatalf("create store: %v", err)
	}

	items := []struct {
		product  models.Product
		variants []models.ProductVariant
	}{
		{
			product: models.Product{
				StoreID: store.ID, Name: "Variant Out", ProductType: "physical",
				ConservationStatus: "available", Price: 10000, IsActive: true, ModerationStatus: "none",
			},
			variants: []models.ProductVariant{{VariantName: "S", StockQty: 0, IsActive: true}},
		},
		{
			product: models.Product{
				StoreID: store.ID, Name: "Variant Low Active Only", ProductType: "physical",
				ConservationStatus: "available", Price: 12000, IsActive: true, ModerationStatus: "none",
			},
			variants: []models.ProductVariant{
				{VariantName: "M", StockQty: 3, IsActive: true},
				{VariantName: "L", StockQty: 10, IsActive: false},
			},
		},
		{
			product: models.Product{
				StoreID: store.ID, Name: "Variant In Stock", ProductType: "physical",
				ConservationStatus: "available", Price: 15000, IsActive: true, ModerationStatus: "none",
			},
			variants: []models.ProductVariant{{VariantName: "XL", StockQty: 12, IsActive: true}},
		},
		{
			product: models.Product{
				StoreID: store.ID, Name: "JSON Attr Zero", ProductType: "physical",
				ConservationStatus: "available", Price: 18000, IsActive: true, ModerationStatus: "none",
				Attributes: datatypes.JSON([]byte(`{"stock": 0}`)),
			},
		},
		{
			product: models.Product{
				StoreID: store.ID, Name: "JSON Attr Four", ProductType: "physical",
				ConservationStatus: "available", Price: 20000, IsActive: true, ModerationStatus: "none",
				Attributes: datatypes.JSON([]byte(`{"stock": 4}`)),
			},
		},
		{
			product: models.Product{
				StoreID: store.ID, Name: "JSON Detailed Two", ProductType: "food",
				ConservationStatus: "available", Price: 22000, IsActive: true, ModerationStatus: "none",
				DetailedInfo: datatypes.JSON([]byte(`{"stock": 2}`)),
			},
		},
		{
			product: models.Product{
				StoreID: store.ID, Name: "JSON NonNumeric Ready", ProductType: "service",
				ConservationStatus: "Tersedia (Ready Stock)", Price: 25000, IsActive: true, ModerationStatus: "none",
				Attributes: datatypes.JSON([]byte(`{"stock": "ready"}`)),
			},
		},
		{
			product: models.Product{
				StoreID: store.ID, Name: "Status Sold Out", ProductType: "fauna",
				ConservationStatus: "sold_out", Price: 30000, IsActive: true, ModerationStatus: "none",
			},
		},
		{
			product: models.Product{
				StoreID: store.ID, Name: "Status Limited", ProductType: "plant",
				ConservationStatus: "limited", Price: 35000, IsActive: true, ModerationStatus: "none",
			},
		},
		{
			product: models.Product{
				StoreID: store.ID, Name: "Status Habis Label", ProductType: "physical",
				ConservationStatus: "Habis (Sold Out)", Price: 40000, IsActive: true, ModerationStatus: "none",
			},
		},
	}

	for i := range items {
		if err := db.Create(&items[i].product).Error; err != nil {
			t.Fatalf("create product %d (%s): %v", i, items[i].product.Name, err)
		}
		for j := range items[i].variants {
			v := items[i].variants[j]
			wantActive := v.IsActive
			v.ProductID = items[i].product.ID
			if err := db.Create(&v).Error; err != nil {
				t.Fatalf("create variant %s: %v", v.VariantName, err)
			}
			if !wantActive {
				if err := db.Model(&v).Update("is_active", false).Error; err != nil {
					t.Fatalf("deactivate variant %s: %v", v.VariantName, err)
				}
			}
		}
	}

	cfg := &config.Config{JWTSecret: "test-secret"}
	storeH := NewStoreHandler(db, cfg)
	prodH := NewProductHandler(cfg, db)

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Get("/api/u/:slug/catalog-metrics", storeH.CatalogMetrics)
	app.Get("/api/products", prodH.Index)

	// 1. Assert CatalogMetrics
	req := httptest.NewRequest("GET", "/api/u/toko-uji-stok/catalog-metrics", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("catalog-metrics request: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("catalog-metrics status = %d, want 200", resp.StatusCode)
	}
	var metricsBody struct {
		Success bool `json:"success"`
		Data    struct {
			TotalItems      int64 `json:"total_items"`
			ActiveItems     int64 `json:"active_items"`
			OutOfStockItems int64 `json:"out_of_stock_items"`
			LowStockItems   int64 `json:"low_stock_items"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&metricsBody); err != nil {
		t.Fatalf("decode catalog-metrics: %v", err)
	}
	if metricsBody.Data.TotalItems != 10 || metricsBody.Data.ActiveItems != 10 {
		t.Fatalf("unexpected totals: %+v", metricsBody.Data)
	}
	if metricsBody.Data.OutOfStockItems != 4 {
		t.Fatalf("out_of_stock_items = %d, want 4", metricsBody.Data.OutOfStockItems)
	}
	if metricsBody.Data.LowStockItems != 4 {
		t.Fatalf("low_stock_items = %d, want 4", metricsBody.Data.LowStockItems)
	}

	// 2. Assert ProductHandler.Index ?stock=in_stock and ?stock=out_of_stock
	checkStockFilter := func(filter string, wantTotal int64) {
		t.Helper()
		r := httptest.NewRequest("GET", "/api/products?store_slug=toko-uji-stok&stock="+filter, nil)
		res, err := app.Test(r, -1)
		if err != nil {
			t.Fatalf("products stock=%s request: %v", filter, err)
		}
		if res.StatusCode != 200 {
			t.Fatalf("products stock=%s status = %d, want 200", filter, res.StatusCode)
		}
		var body struct {
			Success bool  `json:"success"`
			Count   int   `json:"count"`
			Total   int64 `json:"total"`
		}
		if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
			t.Fatalf("decode products stock=%s: %v", filter, err)
		}
		if body.Total != wantTotal || int64(body.Count) != wantTotal {
			t.Fatalf("products stock=%s total=%d count=%d, want %d", filter, body.Total, body.Count, wantTotal)
		}
	}

	checkStockFilter("in_stock", 6)
	checkStockFilter("out_of_stock", 4)
}
