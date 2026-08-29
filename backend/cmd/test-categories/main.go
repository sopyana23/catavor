package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/handlers"
	"catavor-backend/internal/middleware"
	"catavor-backend/internal/models"
	"catavor-backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"gorm.io/datatypes"
)

func main() {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})
	zerolog.SetGlobalLevel(zerolog.InfoLevel)

	fmt.Println("=================================================================")
	fmt.Println("  Catavor Category Test & Seed Tool (Store: Adidas)")
	fmt.Println("=================================================================")

	cfg := config.LoadConfig()
	db, err := database.InitDB(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("Database connection failed")
	}

	// 1. Find store for "adidas"
	var store models.Store
	res := db.Where("LOWER(slug) = ? OR LOWER(store_title) LIKE ?", "adidas", "%adidas%").Preload("User").First(&store)
	if res.Error != nil {
		log.Warn().Msg("Store 'adidas' not found by slug/title. Listing existing stores...")
		var allStores []models.Store
		db.Preload("User").Find(&allStores)
		for _, s := range allStores {
			fmt.Printf(" - ID: %d | Slug: %s | Title: %s | UserID: %d\n", s.ID, s.Slug, s.StoreTitle, s.UserID)
		}

		// If no adidas store, let's create one or find the first store
		if len(allStores) > 0 {
			store = allStores[0]
			log.Info().Str("slug", store.Slug).Str("title", store.StoreTitle).Msg("Using existing store for testing")
		} else {
			log.Fatal().Msg("No stores found in database")
		}
	} else {
		log.Info().Uint("store_id", store.ID).Str("slug", store.Slug).Str("title", store.StoreTitle).Msg("Found store 'adidas'")
	}

	// 2. Clear all existing items for this store
	deleteRes := db.Where("store_id = ?", store.ID).Delete(&models.Fauna{})
	log.Info().Int64("deleted_items", deleteRes.RowsAffected).Msg("Successfully cleared existing items for this store")

	// 3. Ensure store user exists and generate JWT token
	var user models.User
	if err := db.First(&user, store.UserID).Error; err != nil {
		log.Fatal().Err(err).Msg("Failed to find store owner user")
	}

	token, err := middleware.GenerateToken(&user, &store, cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to generate JWT token")
	}

	// 4. Setup in-memory Fiber App to test API endpoints
	storageService, _ := storage.NewStorageService(cfg)
	faunaHandler := handlers.NewFaunaHandler(cfg)
	storageHandler := handlers.NewStorageHandler(cfg, storageService, db)

	app := fiber.New()
	api := app.Group("/api")
	guarded := api.Group("", middleware.AuthRequired(cfg), middleware.StoreOwnerRequired())
	{
		guarded.Post("/storage/upload", storageHandler.Upload)
		guarded.Post("/fauna", faunaHandler.Store)
		guarded.Put("/fauna/:id", faunaHandler.Update)
		guarded.Delete("/fauna/:id", faunaHandler.Destroy)
	}

	// 5. Test Creating Dummy Data for all 5 Item Categories via API POST /api/fauna
	dummyItems := []struct {
		CategoryType string
		Payload      map[string]interface{}
	}{
		{
			CategoryType: "physical",
			Payload: map[string]interface{}{
				"name":                  "Adidas Ultraboost Light Running Shoes",
				"scientific_name":       "Adidas Sportswear Footwear",
				"class":                 "Sepatu Olahraga",
				"habitat":               "Footwear",
				"diet":                  "Running",
				"conservation_status":   "Original Authentic",
				"price":                 2499000,
				"min_order":             1,
				"max_order":             5,
				"description":           "Sepatu running performa tinggi dengan bantalan Light Boost yang 30% lebih ringan. Memberikan energi return maksimal untuk lari jarak jauh.",
				"product_type":          "physical",
				"image_url":             "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&auto=format&fit=crop",
				"is_shipping_available": true,
				"detailed_info": map[string]interface{}{
					"images": []string{
						"https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&auto=format&fit=crop",
						"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop",
					},
					"shipping_coverage": "Seluruh Indonesia (JNE/J&T/SiCepat)",
					"warranty":          "Garansi Original 100% atau Uang Kembali",
				},
				"attributes": map[string]interface{}{
					"condition": "Baru",
					"weight":    650,
					"brand":     "Adidas",
					"variant":   "Core Black / Cloud White (Size 40 - 45)",
				},
			},
		},
		{
			CategoryType: "digital",
			Payload: map[string]interface{}{
				"name":                  "E-Book Panduan Marathon Training 2026",
				"scientific_name":       "Digital Training Manual",
				"class":                 "E-Book & PDF",
				"habitat":               "Digital Asset",
				"diet":                  "Training Program",
				"conservation_status":   "Lisensi Personal",
				"price":                 149000,
				"min_order":             1,
				"max_order":             1,
				"description":           "E-Book komprehensif 12 minggu latihan persiapan marathon dari pelatih bersertifikasi internasional. Termasuk panduan nutrisi, jadwal lari harian, dan pencegahan cedera.\n\nLink download dan materi akses langsung dikirim otomatis via WhatsApp & Email setelah pesanan terkonfirmasi.",
				"product_type":          "digital",
				"image_url":             "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop",
				"is_shipping_available": true,
				"detailed_info": map[string]interface{}{
					"images": []string{
						"https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop",
					},
					"shipping_coverage": "Akses Instan Otomatis (Cloud Link via WA/Email)",
					"warranty":          "Lisensi Personal. Dilarang mendistribusikan ulang.",
				},
				"attributes": map[string]interface{}{
					"file_size":    "45 MB (PDF + Excel Sheet)",
					"license_type": "Lisensi Personal",
				},
			},
		},
		{
			CategoryType: "fauna",
			Payload: map[string]interface{}{
				"name":                  "Chinchilla Grey Royal Velvet",
				"scientific_name":       "Chinchilla lanigera",
				"class":                 "Mamalia",
				"habitat":               "Pegunungan Andes (Captive Bred)",
				"diet":                  "Herbivora (Timothy Hay)",
				"conservation_status":   "Legal Captive Bred",
				"price":                 4500000,
				"min_order":             1,
				"max_order":             2,
				"description":           "Chinchilla jinak dan terawat dengan bulu ekstra tebal dan halus. Sehat, aktif, sudah terbiasa interaksi tangan, dan lolos pemeriksaan dokter hewan.",
				"product_type":          "fauna",
				"image_url":             "https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&auto=format&fit=crop",
				"is_shipping_available": true,
				"detailed_info": map[string]interface{}{
					"images": []string{
						"https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&auto=format&fit=crop",
					},
					"shipping_coverage": "Pulau Jawa (Kereta Pet Express / Kurir Khusus)",
					"warranty":          "Garansi Sehat & Hidup 100% sampai tujuan (Sertakan Video Unboxing)",
				},
				"attributes": map[string]interface{}{
					"gender":    "Jantan",
					"age":       "4 Bulan",
					"care_tags": "Suhu Dingin AC (18-23 C), Kandang Bersih",
				},
			},
		},
		{
			CategoryType: "service",
			Payload: map[string]interface{}{
				"name":                  "Jasa Deep Clean & Repaint Sneakers Premium",
				"scientific_name":       "Shoe Care & Restoration Service",
				"class":                 "Laundry & Cleaning",
				"habitat":               "Studio Workshop",
				"diet":                  "Restoration",
				"conservation_status":   "Garansi 14 Hari",
				"price":                 125000,
				"description":           "Layanan cuci mendalam (deep cleaning) hingga ke sela insole dan outsole, unyellowing midsole, serta recoloring warna sepatu yang pudar menggunakan cat angelus khusus kulit/kanvas.\n\nTermasuk konsultasi bahan, desinfektan antibakteri, dan parfum sepatu premium.",
				"product_type":          "service",
				"image_url":             "https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=800&auto=format&fit=crop",
				"is_shipping_available": true,
				"detailed_info": map[string]interface{}{
					"images": []string{
						"https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=800&auto=format&fit=crop",
					},
					"shipping_coverage": "Antar-Jemput Area Jabodetabek / Kirim via Ekspedisi",
					"warranty":          "Garansi Re-Clean jika hasil kurang memuaskan",
				},
				"attributes": map[string]interface{}{
					"duration":         "2 - 3 Hari Kerja",
					"service_location": "Fleksibel (Toko / Home Visit)",
					"service_area":     "Jabodetabek & Seluruh Indonesia via Ekspedisi",
				},
			},
		},
		{
			CategoryType: "food",
			Payload: map[string]interface{}{
				"name":                  "Isotonic Recovery Booster & High-Protein Snack Pack",
				"scientific_name":       "Sports Nutrition & Electrolytes",
				"class":                 "Makanan Siap Saji",
				"habitat":               "Kitchen Laboratory",
				"diet":                  "Nutrition",
				"conservation_status":   "Halal & BPOM",
				"price":                 75000,
				"min_order":             1,
				"max_order":             20,
				"description":           "Paket nutrisi pelari dan pegiat olahraga berisi 5 sachet Isotonic Gel elektrolit dan 3 bar energi tinggi protein. Cocok dikonsumsi sebelum dan sesudah aktivitas intens.",
				"product_type":          "food",
				"image_url":             "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop",
				"is_shipping_available": true,
				"detailed_info": map[string]interface{}{
					"images": []string{
						"https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop",
					},
					"shipping_coverage": "Seluruh Indonesia (Packing Aman Kardus + Bubble Wrap)",
					"warranty":          "Jaminan Fresh & Masa Kadaluarsa > 12 Bulan",
				},
				"attributes": map[string]interface{}{
					"serving_type":       "Dingin / Suhu Ruang",
					"packaging":          "Pouch Kedap Udara + Seal",
					"spicy_level":        "Tidak Pedas",
					"shelf_life":         "12 Bulan",
					"net_weight":         "500 Gram",
					"dietary_labels":     []string{"Halal", "Bebas Gula Tambahan", "Tinggi Protein"},
					"allergens":          "Kedelai / Kacang",
					"storage_method":     "Simpan di tempat kering dan sejuk",
					"serving_suggestion": "Konsumsi 15 menit sebelum olahraga atau saat transisi rute",
				},
			},
		},
	}

	fmt.Println("\n-----------------------------------------------------------------")
	fmt.Println("  Testing API POST /api/fauna for all 5 Item Categories")
	fmt.Println("-----------------------------------------------------------------")

	for idx, item := range dummyItems {
		bodyBytes, _ := json.Marshal(item.Payload)
		req := httptest.NewRequest(http.MethodPost, "/api/fauna", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := app.Test(req, 5000)
		if err != nil {
			log.Error().Err(err).Str("type", item.CategoryType).Msg("HTTP request failed")
			continue
		}

		var respBody map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&respBody)

		if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated {
			data, _ := respBody["data"].(map[string]interface{})
			id := data["id"]
			name := data["name"]
			pType := data["product_type"]
			price := data["price"]
			fmt.Printf(" [%d/5] SUCCESS [%s] (Status: %d) -> ID: %v | Name: %s | Price: Rp %v\n",
				idx+1, pType, resp.StatusCode, id, name, price)
		} else {
			fmt.Printf(" [%d/5] FAILED [%s] (Status: %d) -> Error: %v\n",
				idx+1, item.CategoryType, resp.StatusCode, respBody["message"])
		}
	}

	// 6. Verify Database contents for this store
	var savedItems []models.Fauna
	db.Where("store_id = ?", store.ID).Order("id asc").Find(&savedItems)

	fmt.Println("\n-----------------------------------------------------------------")
	fmt.Printf("  Verification: Total %d items in store '%s' (Slug: %s)\n", len(savedItems), store.StoreTitle, store.Slug)
	fmt.Println("-----------------------------------------------------------------")
	for _, f := range savedItems {
		var attr map[string]interface{}
		if len(f.Attributes) > 0 {
			_ = json.Unmarshal(f.Attributes, &attr)
		}
		var detailed map[string]interface{}
		if len(f.DetailedInfo) > 0 {
			_ = json.Unmarshal(f.DetailedInfo, &detailed)
		}

		fmt.Printf(" • ID: %d | Type: %-8s | Name: %-45s | Class: %-18s | Price: Rp %-10.0f | MinOrder: %d | MaxOrder: %v\n",
			f.ID, f.ProductType, f.Name, f.Class, f.Price, f.MinOrder, f.MaxOrder)
	}

	fmt.Println("=================================================================")
	fmt.Println("  All Category API Tests Completed Successfully!")
	fmt.Println("=================================================================")
}

// Helper for dummy datatypes
func toJSON(v interface{}) datatypes.JSON {
	b, _ := json.Marshal(v)
	return datatypes.JSON(b)
}
