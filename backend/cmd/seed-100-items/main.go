package main

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"gorm.io/datatypes"
)

type SeedItem struct {
	Name                string                 `json:"name"`
	ScientificName      string                 `json:"scientific_name"`
	Class               string                 `json:"class"`
	Habitat             string                 `json:"habitat"`
	Diet                string                 `json:"diet"`
	ConservationStatus  string                 `json:"conservation_status"`
	Price               float64                `json:"price"`
	MinOrder            int                    `json:"min_order"`
	MaxOrder            *int                   `json:"max_order,omitempty"`
	Description         string                 `json:"description"`
	ProductType         string                 `json:"product_type"` // physical | food | service | digital | fauna
	ImageURL            string                 `json:"image_url"`
	IsShippingAvailable bool                   `json:"is_shipping_available"`
	DetailedInfo        map[string]interface{} `json:"detailed_info"`
	Attributes          map[string]interface{} `json:"attributes"`
}

func main() {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})
	zerolog.SetGlobalLevel(zerolog.InfoLevel)

	fmt.Println("=================================================================")
	fmt.Println("  Catavor 100-Item Complete Multi-Category Seeder")
	fmt.Println("=================================================================")

	cfg := config.LoadConfig()
	db, err := database.InitDB(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("Database connection failed")
	}

	// 1. Find store for "adidas" or use primary store
	var store models.Store
	res := db.Where("LOWER(slug) = ? OR LOWER(store_title) LIKE ?", "adidas", "%adidas%").Preload("User").First(&store)
	if res.Error != nil {
		log.Warn().Msg("Store 'adidas' not found by slug/title. Listing existing stores...")
		var allStores []models.Store
		db.Preload("User").Find(&allStores)
		if len(allStores) > 0 {
			store = allStores[0]
			log.Info().Str("slug", store.Slug).Str("title", store.StoreTitle).Msg("Using existing store for testing")
		} else {
			log.Fatal().Msg("No stores found in database")
		}
	} else {
		log.Info().Uint("store_id", store.ID).Str("slug", store.Slug).Str("title", store.StoreTitle).Msg("Target store identified")
	}

	// 2. Clear existing fauna items for this store
	deleteRes := db.Where("store_id = ?", store.ID).Delete(&models.Fauna{})
	log.Info().Int64("deleted_items", deleteRes.RowsAffected).Msg("Existing items cleared for fresh 100-item dataset")

	// 3. Build 100 diverse, high-quality items
	items := generate100Items()
	log.Info().Int("total_items_to_seed", len(items)).Msg("Generated 100 diverse items across 5 item types and 20+ categories")

	var insertedCount int
	for _, item := range items {
		detJSON, _ := json.Marshal(item.DetailedInfo)
		attrJSON, _ := json.Marshal(item.Attributes)

		fauna := models.Fauna{
			StoreID:             store.ID,
			Name:                item.Name,
			ScientificName:      item.ScientificName,
			Class:               item.Class,
			Habitat:             item.Habitat,
			Diet:                item.Diet,
			ConservationStatus:  item.ConservationStatus,
			Price:               item.Price,
			MinOrder:            item.MinOrder,
			MaxOrder:            item.MaxOrder,
			Description:         item.Description,
			ProductType:         item.ProductType,
			ImageURL:            item.ImageURL,
			IsShippingAvailable: item.IsShippingAvailable,
			DetailedInfo:        datatypes.JSON(detJSON),
			Attributes:          datatypes.JSON(attrJSON),
			CreatedAt:           time.Now().Add(-time.Duration(insertedCount) * time.Hour),
			UpdatedAt:           time.Now(),
		}

		if err := db.Create(&fauna).Error; err != nil {
			log.Error().Err(err).Str("item", item.Name).Msg("Failed to insert item")
		} else {
			insertedCount++
		}
	}

	fmt.Printf("\n=================================================================\n")
	fmt.Printf("  SUCCESS: %d / 100 Items Successfully Seeded for '%s'!\n", insertedCount, store.StoreTitle)
	fmt.Printf("=================================================================\n\n")
}

func ptrInt(i int) *int {
	return &i
}

func generate100Items() []SeedItem {
	items := make([]SeedItem, 0, 100)

	// =========================================================================
	// 1. PHYSICAL PRODUCTS (35 ITEMS)
	// =========================================================================

	// Sepatu Olahraga (7 items)
	items = append(items,
		SeedItem{
			Name: "Adidas Ultraboost Light Running Shoes", ScientificName: "Adidas Sportswear Footwear", Class: "Sepatu Olahraga",
			Habitat: "Footwear", Diet: "Running", ConservationStatus: "Original Authentic", Price: 2499000, MinOrder: 1, MaxOrder: ptrInt(5),
			Description: "Sepatu running performa tinggi dengan bantalan Light Boost 30% lebih ringan untuk kenyamanan jarak jauh.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Original 100%"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 650, "brand": "Adidas", "variant": "Size 40-45 (Core Black)"},
		},
		SeedItem{
			Name: "Adidas Terrex Agravic Trail Running Shoes", ScientificName: "Outdoor Trail Footwear", Class: "Sepatu Olahraga",
			Habitat: "Footwear", Diet: "Trail & Hiking", ConservationStatus: "Original Authentic", Price: 1899000, MinOrder: 1, MaxOrder: ptrInt(3),
			Description: "Sepatu lari trail tangguh dengan outsole Continental Rubber untuk cengkeraman maksimal di medan berbatu dan basah.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Original 100%"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 720, "brand": "Adidas Terrex", "variant": "Size 41-44 (Olive Khaki)"},
		},
		SeedItem{
			Name: "Adidas Trae Young 3 Basketball Shoes", ScientificName: "Performance Basketball Footwear", Class: "Sepatu Olahraga",
			Habitat: "Footwear", Diet: "Basketball", ConservationStatus: "Original Authentic", Price: 2199000, MinOrder: 1, MaxOrder: ptrInt(2),
			Description: "Sepatu basket signature Trae Young dengan bantalan responsif untuk pergerakan lincah dan tembakan akurat.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Original 100%"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 800, "brand": "Adidas", "variant": "Size 42-46 (Solar Red)"},
		},
		SeedItem{
			Name: "Adidas Predator Elite FG Football Boots", ScientificName: "Professional Football Footwear", Class: "Sepatu Olahraga",
			Habitat: "Footwear", Diet: "Football / Soccer", ConservationStatus: "Original Authentic", Price: 3499000, MinOrder: 1, MaxOrder: ptrInt(2),
			Description: "Sepatu bola kasta tertinggi dengan teknologi Strikeskin rubber fins untuk kontrol dan akurasi tendangan mematikan.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Original 100%"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 420, "brand": "Adidas", "variant": "Size 39-44 (Core Black/Solar Red)"},
		},
		SeedItem{
			Name: "Adidas Samba OG Cloud White Classics", ScientificName: "Heritage Lifestyle Sneaker", Class: "Sepatu Olahraga",
			Habitat: "Footwear", Diet: "Casual & Streetwear", ConservationStatus: "Original Authentic", Price: 2200000, MinOrder: 1, MaxOrder: ptrInt(3),
			Description: "Sneaker klasik legendaris dengan upper kulit premium dan toe cap suede ikonik untuk gaya kasual abadi.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Original 100%"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 580, "brand": "Adidas Originals", "variant": "Size 38-44 (Cloud White/Black)"},
		},
		SeedItem{
			Name: "Adidas Adizero Adios Pro 3 Marathon Racing", ScientificName: "Elite Racing Footwear", Class: "Sepatu Olahraga",
			Habitat: "Footwear", Diet: "Marathon & Racing", ConservationStatus: "Original Authentic", Price: 3999000, MinOrder: 1, MaxOrder: ptrInt(2),
			Description: "Sepatu marathon pemecah rekor dunia dengan Energyrods karbon kaku dan busa Lightstrike Pro ganda.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Original 100%"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 430, "brand": "Adidas", "variant": "Size 40-45 (Lucid Cyan)"},
		},
		SeedItem{
			Name: "Adidas Dropset 2 Strength Training Shoes", ScientificName: "Cross-Training Footwear", Class: "Sepatu Olahraga",
			Habitat: "Footwear", Diet: "Gym & Weightlifting", ConservationStatus: "Original Authentic", Price: 1750000, MinOrder: 1, MaxOrder: ptrInt(3),
			Description: "Sepatu gym dengan tumit kokoh dan sol datar berventilasi untuk stabilitas maksimal saat squat dan deadlift.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1579338559194-a162d19bf842?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Original 100%"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 620, "brand": "Adidas", "variant": "Size 40-44 (Grey Carbon)"},
		},
	)

	// Jersey & Apparel (7 items)
	items = append(items,
		SeedItem{
			Name: "Adidas Real Madrid Home Jersey 2025/2026", ScientificName: "Official Match Apparel", Class: "Jersey & Apparel",
			Habitat: "Apparel", Diet: "Football / Sport", ConservationStatus: "Original Authentic", Price: 1100000, MinOrder: 1, MaxOrder: ptrInt(5),
			Description: "Jersey kandang resmi Real Madrid dengan teknologi HEAT.RDY breathable dan aksen houndstooth emas elegan.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Original Product Guarantee"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 220, "brand": "Adidas", "variant": "S, M, L, XL, XXL"},
		},
		SeedItem{
			Name: "Adidas Arsenal Away Authentic Jersey", ScientificName: "Official Match Apparel", Class: "Jersey & Apparel",
			Habitat: "Apparel", Diet: "Football", ConservationStatus: "Original Authentic", Price: 1150000, MinOrder: 1, MaxOrder: ptrInt(5),
			Description: "Jersey tandang resmi Arsenal dengan grafis kontemporer dan material ultra-lightweight aeroready.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Original Product Guarantee"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 210, "brand": "Adidas", "variant": "M, L, XL"},
		},
		SeedItem{
			Name: "Adidas Terrex Multi Windbreaker Jacket", ScientificName: "Weather-Resistant Outerwear", Class: "Jersey & Apparel",
			Habitat: "Outerwear", Diet: "Hiking & Running", ConservationStatus: "Original Authentic", Price: 1400000, MinOrder: 1, MaxOrder: ptrInt(3),
			Description: "Jaket windbreaker ultra-ringan tahan angin dan gerimis yang bisa dilipat kecil masuk ke kantong saku.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "100% Original"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 280, "brand": "Adidas Terrex", "variant": "Black / Wonder Steel (M, L)"},
		},
		SeedItem{
			Name: "Adidas Techfit Compression Training Tights", ScientificName: "Athletic Compression Layer", Class: "Jersey & Apparel",
			Habitat: "Apparel", Diet: "Gym & Recovery", ConservationStatus: "Original Authentic", Price: 650000, MinOrder: 1, MaxOrder: ptrInt(5),
			Description: "Celana kompresi pria dengan support otot maksimal dan ventilasi mesh strategis untuk mencegah kram.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "100% Original"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 190, "brand": "Adidas", "variant": "S, M, L, XL"},
		},
		SeedItem{
			Name: "Adidas Z.N.E. Premium Full-Zip Hoodie", ScientificName: "Athleisure Comfort Hoodie", Class: "Jersey & Apparel",
			Habitat: "Apparel", Diet: "Lifestyle & Warmup", ConservationStatus: "Original Authentic", Price: 1600000, MinOrder: 1, MaxOrder: ptrInt(4),
			Description: "Hoodie premium dengan bahan 4-way stretch doubleknit yang memberi isolasi suara dan kenyamanan sebelum tanding.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "100% Original"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 680, "brand": "Adidas", "variant": "Chalk Pearl / Black (M, L)"},
		},
		SeedItem{
			Name: "Adidas Designed 4 Running 2-in-1 Shorts", ScientificName: "Athletic Running Shorts", Class: "Jersey & Apparel",
			Habitat: "Apparel", Diet: "Running", ConservationStatus: "Original Authentic", Price: 580000, MinOrder: 1, MaxOrder: ptrInt(5),
			Description: "Celana lari pendek 2-in-1 dengan inner tight elastis anti-chafing dan saku ritsleting anti-keringat untuk ponsel.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "100% Original"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 160, "brand": "Adidas", "variant": "S, M, L, XL"},
		},
		SeedItem{
			Name: "Adidas Adicolor Classics Beckenbauer Tracktop", ScientificName: "Heritage Track Jacket", Class: "Jersey & Apparel",
			Habitat: "Apparel", Diet: "Streetwear", ConservationStatus: "Original Authentic", Price: 1300000, MinOrder: 1, MaxOrder: ptrInt(3),
			Description: "Tracktop retro legendaris dengan 3-Stripes khas dan bordir logo Trefoil emas di dada.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "100% Original"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 490, "brand": "Adidas Originals", "variant": "Night Indigo (S, M, L)"},
		},
	)

	// Aksesoris & Peralatan (7 items)
	items = append(items,
		SeedItem{
			Name: "Adidas Performance Steel Water Bottle 750ml", ScientificName: "Insulated Sports Flask", Class: "Aksesoris & Peralatan",
			Habitat: "Gear", Diet: "Hydration", ConservationStatus: "BPA Free", Price: 350000, MinOrder: 1, MaxOrder: ptrInt(10),
			Description: "Botol minum stainless steel vakum ganda menjaga suhu dingin hingga 24 jam dan panas hingga 12 jam.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Kebocoran 1 Bulan"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 380, "brand": "Adidas", "variant": "Matte Black (750ml)"},
		},
		SeedItem{
			Name: "Adidas Defender Large Gym Duffle Bag 65L", ScientificName: "Sports Travel Duffel", Class: "Aksesoris & Peralatan",
			Habitat: "Bags", Diet: "Gym & Travel", ConservationStatus: "Water-Resistant Base", Price: 750000, MinOrder: 1, MaxOrder: ptrInt(4),
			Description: "Tas gym kapasitas besar 65L dengan kompartemen khusus sepatu berventilasi dan strap bahu padded.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Ritsleting 6 Bulan"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 850, "brand": "Adidas", "variant": "65L (Black/White Logo)"},
		},
		SeedItem{
			Name: "Adidas Premium 10mm Dual-Grip Yoga Mat", ScientificName: "Fitness & Pilates Mat", Class: "Aksesoris & Peralatan",
			Habitat: "Fitness", Diet: "Yoga & Core", ConservationStatus: "Eco TPE Material", Price: 490000, MinOrder: 1, MaxOrder: ptrInt(5),
			Description: "Matras yoga tebal 10mm dengan grip anti-slip di kedua sisi dan tali strap pembawa praktis.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi 1 Bulan"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 1100, "brand": "Adidas Training", "variant": "Raw Green (183 x 61 cm)"},
		},
		SeedItem{
			Name: "Adidas Heavy Duty Speed Jump Rope", ScientificName: "Cardio Conditioning Rope", Class: "Aksesoris & Peralatan",
			Habitat: "Fitness", Diet: "Cardio & HIIT", ConservationStatus: "Steel Ball Bearing", Price: 220000, MinOrder: 1, MaxOrder: ptrInt(10),
			Description: "Tali skipping kabel baja berlapis polimer dengan bearing putar 360 derajat untuk kecepatan putar maksimal.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1598971861713-54ad16a7e72e?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi 14 Hari"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 210, "brand": "Adidas", "variant": "Panjang 3 Meter (Adjustable)"},
		},
		SeedItem{
			Name: "Adidas Training Resistance Bands Set (5 Level)", ScientificName: "Strength Loop Bands", Class: "Aksesoris & Peralatan",
			Habitat: "Fitness", Diet: "Strength & Mobility", ConservationStatus: "100% Natural Latex", Price: 299000, MinOrder: 1, MaxOrder: ptrInt(10),
			Description: "Set 5 karet resistensi dari level Extra Light hingga Extra Heavy untuk pemanasan, glute workout, dan rehabilitasi.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Elastisitas 3 Bulan"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 180, "brand": "Adidas", "variant": "5-in-1 Multi Color Pouch"},
		},
		SeedItem{
			Name: "Adidas Running Waist Pack Belt", ScientificName: "Ergonomic Waist Bag", Class: "Aksesoris & Peralatan",
			Habitat: "Accessories", Diet: "Running", ConservationStatus: "Reflective Accents", Price: 320000, MinOrder: 1, MaxOrder: ptrInt(8),
			Description: "Tas pinggang lari ergonomis anti-pantul (bounce-free) dengan saku elastis muat smartphone hingga 6.8 inch.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi 1 Bulan"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 110, "brand": "Adidas", "variant": "One Size (All Waist)"},
		},
		SeedItem{
			Name: "Adidas Weightlifting Padded Wrist Wraps", ScientificName: "Heavy Support Wrist Straps", Class: "Aksesoris & Peralatan",
			Habitat: "Fitness", Diet: "Powerlifting", ConservationStatus: "Reinforced Stitching", Price: 195000, MinOrder: 1, MaxOrder: ptrInt(10),
			Description: "Pelindung pergelangan tangan elastis tebal dengan pengait jempol untuk bench press dan overhead press berat.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi 1 Bulan"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 140, "brand": "Adidas", "variant": "Pair (Black/Red)"},
		},
	)

	// Elektronik & Gadget (7 items)
	items = append(items,
		SeedItem{
			Name: "Garmin Forerunner 265 GPS Running Smartwatch", ScientificName: "Advanced GPS Multisport Watch", Class: "Elektronik & Gadget",
			Habitat: "Wearable Tech", Diet: "Running & Triathlon", ConservationStatus: "Garansi Resmi 2 Tahun", Price: 7799000, MinOrder: 1, MaxOrder: ptrInt(2),
			Description: "Jam tangan lari layar AMOLED cerah dengan metrik kesiapan latihan, HRV status, dan analisis VO2 Max akurat.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia (Asuransi Penuh)", "warranty": "Garansi Resmi TAM 2 Tahun"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 47, "brand": "Garmin", "variant": "Black / Powder Grey"},
		},
		SeedItem{
			Name: "Shokz OpenRun Pro Bone Conduction Earphones", ScientificName: "Wireless Sports Headphone", Class: "Elektronik & Gadget",
			Habitat: "Audio Gear", Diet: "Outdoor Running & Cycling", ConservationStatus: "IP55 Water Resistant", Price: 2699000, MinOrder: 1, MaxOrder: ptrInt(3),
			Description: "Earphone transmisi getaran tulang pipi (open-ear) menjaga telinga tetap waspada terhadap suara lalu lintas sekitar.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Resmi 2 Tahun"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 29, "brand": "Shokz", "variant": "Matte Black (10 Jam Baterai)"},
		},
		SeedItem{
			Name: "Theragun Pro Deep Tissue Massage Gun", ScientificName: "Percussive Therapy Device", Class: "Elektronik & Gadget",
			Habitat: "Recovery Tech", Diet: "Muscle Therapy", ConservationStatus: "Commercial Grade", Price: 8999000, MinOrder: 1, MaxOrder: ptrInt(2),
			Description: "Alat pijat perkusi profesional dengan kedalaman pukulan 16mm untuk pemulihan asam laktat otot secara instan.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia (Asuransi)", "warranty": "Garansi Resmi 1 Tahun"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 1300, "brand": "Therabody", "variant": "Gen 5 (6 Attachments)"},
		},
		SeedItem{
			Name: "Polar H10 Heart Rate Sensor Chest Strap", ScientificName: "ECG Heart Rate Monitor", Class: "Elektronik & Gadget",
			Habitat: "Sensors", Diet: "Cardio Analytics", ConservationStatus: "ANT+ / Bluetooth", Price: 1599000, MinOrder: 1, MaxOrder: ptrInt(4),
			Description: "Sensor detak jantung dada standar emas medis dengan konektivitas ganda ke aplikasi Zwift, Strava, dan treadmill.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1510519138161-584736b2b71b?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Resmi 1 Tahun"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 60, "brand": "Polar", "variant": "Size M-XXL (Waterproof 30m)"},
		},
		SeedItem{
			Name: "JBL Endurance Peak 3 TWS Sports Earbuds", ScientificName: "True Wireless Sport Audio", Class: "Elektronik & Gadget",
			Habitat: "Audio", Diet: "Gym & Swimming", ConservationStatus: "IP68 Waterproof", Price: 1899000, MinOrder: 1, MaxOrder: ptrInt(5),
			Description: "Earbuds hook telinga ergonomis anti-jatuh dengan bass bertenaga dan total playtime baterai hingga 50 jam.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Resmi IMS 1 Tahun"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 76, "brand": "JBL", "variant": "All Black"},
		},
		SeedItem{
			Name: "Smart LED Night Running Clip-On Armband", ScientificName: "Safety Flashing LED Light", Class: "Elektronik & Gadget",
			Habitat: "Safety Gadget", Diet: "Night Running", ConservationStatus: "USB-C Rechargeable", Price: 85000, MinOrder: 1, MaxOrder: ptrInt(20),
			Description: "Lampu LED lengan keselamatan lari malam hari dengan mode kedip strobo terang dan pengisian daya USB-C.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1508962914676-134849a727f0?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Toko 1 Bulan"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 45, "brand": "Catavor Gear", "variant": "Neon Green / Cyan"},
		},
		SeedItem{
			Name: "Smart Digital Jump Rope with LCD Counter", ScientificName: "Bluetooth Calorie Skipping Rope", Class: "Elektronik & Gadget",
			Habitat: "Fitness Tech", Diet: "Home Workout", ConservationStatus: "Dual Ball/Rope Mode", Price: 185000, MinOrder: 1, MaxOrder: ptrInt(15),
			Description: "Tali skipping pintar dengan sensor magnetik pencatat lompatan otomatis dan mode cordless bola tanpa tali.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1598971861713-54ad16a7e72e?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi 1 Bulan"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 220, "brand": "SmartFit", "variant": "Digital Screen (Black)"},
		},
	)

	// Outdoor & Adventure (7 items)
	items = append(items,
		SeedItem{
			Name: "Osprey Atmos AG 65L Ultralight Backpack", ScientificName: "Anti-Gravity Trekking Pack", Class: "Outdoor & Adventure",
			Habitat: "Mountain Gear", Diet: "Expedition", ConservationStatus: "Lifetime Warranty", Price: 4250000, MinOrder: 1, MaxOrder: ptrInt(2),
			Description: "Carrier gunung legendaris dengan backsystem jaring Anti-Gravity yang mendistribusikan beban secara sempurna.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia (Asuransi)", "warranty": "Garansi Resmi Seumur Hidup"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 2180, "brand": "Osprey", "variant": "Size M/L (Ventana Blue)"},
		},
		SeedItem{
			Name: "Naturehike Cloud Up 2 Ultralight Tent 2P", ScientificName: "Double-Layer Camping Tent", Class: "Outdoor & Adventure",
			Habitat: "Shelter", Diet: "Camping & Bushcraft", ConservationStatus: "Silicone 20D Nylon", Price: 1650000, MinOrder: 1, MaxOrder: ptrInt(3),
			Description: "Tenda dome 2 orang dengan bobot hanya 1.4kg, frame aluminium 7001, dan rating tahan air 4000mm.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi 6 Bulan"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 1450, "brand": "Naturehike", "variant": "2 Person (Forest Green)"},
		},
		SeedItem{
			Name: "Black Diamond Distance Carbon Z Trekking Poles", ScientificName: "Carbon Fiber Hiking Poles", Class: "Outdoor & Adventure",
			Habitat: "Trekking", Diet: "Trail & Mountaineering", ConservationStatus: "100% Carbon Fiber", Price: 2450000, MinOrder: 1, MaxOrder: ptrInt(3),
			Description: "Tongkat hiking lipat 3 section bahan full karbon ultra-ringan dengan pegangan busa EVA anti-keringat.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Resmi 1 Tahun"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 290, "brand": "Black Diamond", "variant": "Length 120cm (Pair)"},
		},
		SeedItem{
			Name: "Sawyer Squeeze Portable Water Filter System", ScientificName: "Microfiber Membrane Filter", Class: "Outdoor & Adventure",
			Habitat: "Survival", Diet: "Water Purification", ConservationStatus: "0.1 Micron Absolute", Price: 680000, MinOrder: 1, MaxOrder: ptrInt(5),
			Description: "Filter air minum portable outdoor menyaring 99.99999% bakteri dan protozoa dari sungai tanpa bahan kimia.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1508873696983-2df5293cb32f?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Toko 1 Bulan"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 85, "brand": "Sawyer", "variant": "Complete Pouch Kit"},
		},
		SeedItem{
			Name: "Petzl Actik Core Headlamp 600 Lumens", ScientificName: "Rechargeable Head Torch", Class: "Outdoor & Adventure",
			Habitat: "Lighting", Diet: "Night Trekking", ConservationStatus: "IPX4 Weatherproof", Price: 890000, MinOrder: 1, MaxOrder: ptrInt(6),
			Description: "Senter kepala rechargeable 600 lumens dengan dual beam putih/merah dan baterai Core tahan 100 jam.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Resmi 5 Tahun"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 88, "brand": "Petzl", "variant": "Black Core Battery"},
		},
		SeedItem{
			Name: "Hydrapak Shape-Shift 2L Hydration Bladder", ScientificName: "Reversible Water Reservoir", Class: "Outdoor & Adventure",
			Habitat: "Hydration", Diet: "Trail Running", ConservationStatus: "BPA / PVC Free", Price: 520000, MinOrder: 1, MaxOrder: ptrInt(8),
			Description: "Kantung air ransel 2 liter dengan baffle pembagi profil datar dan katup gigit High-Flow Blaster.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Anti Bocor Seumur Hidup"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 140, "brand": "Hydrapak", "variant": "2.0 Liter Clear"},
		},
		SeedItem{
			Name: "Sea to Summit Spark Ultralight Sleeping Bag", ScientificName: "850+ Loft Goose Down", Class: "Outdoor & Adventure",
			Habitat: "Sleep System", Diet: "Alpine Trekking", ConservationStatus: "RDS Certified Down", Price: 5500000, MinOrder: 1, MaxOrder: ptrInt(2),
			Description: "Sleeping bag bulu angsa ultra-kompak dengan limit kenyamanan -2C dan bobot hanya 490 gram.",
			ProductType: "physical", ImageURL: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia (Asuransi)", "warranty": "Garansi 1 Tahun"},
			Attributes: map[string]interface{}{"condition": "Baru", "weight": 490, "brand": "Sea to Summit", "variant": "Spark SpII (Regular Size)"},
		},
	)

	// =========================================================================
	// 2. FOOD & BEVERAGE / KULINER (20 ITEMS)
	// =========================================================================

	// Makanan Siap Saji (5 items)
	items = append(items,
		SeedItem{
			Name: "Grilled Rosemary Chicken & Quinoa Fit Bowl", ScientificName: "High-Protein Clean Meal", Class: "Makanan Siap Saji",
			Habitat: "Dapur Fresh", Diet: "High-Protein Low-Carb", ConservationStatus: "Halal MUI", Price: 65000, MinOrder: 1, MaxOrder: ptrInt(20),
			Description: "Dada ayam panggang bumbu rosemary wangi dengan quinoa organik, jagung manis rebus, dan saus honey mustard.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Area Pengiriman Instan / Sameday", "warranty": "Garansi Makanan Segar & Higienis"},
			Attributes: map[string]interface{}{"portion": "1 Porsi (450 kcal / 45g Protein)", "expired_info": "1 Hari (Konsumsi Hangat)", "storage_temp": "Suhu Ruang / Microwave"},
		},
		SeedItem{
			Name: "Norwegian Salmon Teriyaki with Edamame Rice", ScientificName: "Omega-3 Salmon Super Bowl", Class: "Makanan Siap Saji",
			Habitat: "Dapur Fresh", Diet: "Omega-3 & Clean Eating", ConservationStatus: "Fresh Cooked", Price: 85000, MinOrder: 1, MaxOrder: ptrInt(15),
			Description: "Fillet salmon Norwegia pan-seared dengan saus teriyaki gurih manis rendah sodium dan nasi beras merah edamame.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Area Pengiriman Instan / Sameday", "warranty": "100% Salmon Segar"},
			Attributes: map[string]interface{}{"portion": "1 Porsi (520 kcal / 38g Protein)", "expired_info": "1 Hari", "storage_temp": "Hangat / Dingin"},
		},
		SeedItem{
			Name: "Vegan Mediterranean Salad with Baked Tofu", ScientificName: "Plant-Based Protein Salad", Class: "Makanan Siap Saji",
			Habitat: "Dapur Fresh", Diet: "100% Vegan & Fiber Rich", ConservationStatus: "Organic Certified", Price: 55000, MinOrder: 1, MaxOrder: ptrInt(20),
			Description: "Salad selada romaine renyah, tomat ceri, mentimun kyuri, tahu panggang wijen, dan saus balsamic olive oil.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Pengiriman Instan & Sameday", "warranty": "Sayuran Hidroponik Segar"},
			Attributes: map[string]interface{}{"portion": "1 Bowl (320 kcal / 18g Protein)", "expired_info": "1 Hari", "storage_temp": "Suhu Dingin (4-8 C)"},
		},
		SeedItem{
			Name: "Beef Bulgogi Lean Meat Shirataki Rice", ScientificName: "Low-Calorie Beef Shirataki", Class: "Makanan Siap Saji",
			Habitat: "Dapur Fresh", Diet: "Keto & Low Carb", ConservationStatus: "Halal Premium Beef", Price: 75000, MinOrder: 1, MaxOrder: ptrInt(20),
			Description: "Daging sapi tenderloin iris tipis saus bulgogi autentik Korea disajikan dengan nasi shirataki nol karbohidrat.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Pengiriman Instan & Sameday", "warranty": "Daging Sapi Pilihan"},
			Attributes: map[string]interface{}{"portion": "1 Porsi (380 kcal / 36g Protein)", "expired_info": "1 Hari", "storage_temp": "Suhu Ruang"},
		},
		SeedItem{
			Name: "Wholewheat Protein Pasta Chicken Bolognese", ScientificName: "Complex Carb Sports Meal", Class: "Makanan Siap Saji",
			Habitat: "Dapur Fresh", Diet: "Carbo Loading & Protein", ConservationStatus: "No Preservatives", Price: 60000, MinOrder: 1, MaxOrder: ptrInt(15),
			Description: "Pasta gandum utuh dengan saus bolognese daging cincang rendah lemak dan taburan keju parmesan premium.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Pengiriman Instan / Sameday", "warranty": "Fresh Made Daily"},
			Attributes: map[string]interface{}{"portion": "1 Porsi (490 kcal / 40g Protein)", "expired_info": "1 Hari", "storage_temp": "Hangat"},
		},
	)

	// Minuman Nutrisi (5 items)
	items = append(items,
		SeedItem{
			Name: "Cold-Pressed Green Detox Juice 500ml", ScientificName: "Raw Nutrient Botanical Elixir", Class: "Minuman Nutrisi",
			Habitat: "Beverage Studio", Diet: "Detox & Alkalizing", ConservationStatus: "No Added Sugar", Price: 38000, MinOrder: 1, MaxOrder: ptrInt(30),
			Description: "Perasan murni kale hidroponik, apel hijau malang, seledri stik, mentimun, dan perasan lemon segar tanpa air/gula.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Kurir Instan & Sameday", "warranty": "100% Buah & Sayur Alami"},
			Attributes: map[string]interface{}{"portion": "500 ml", "expired_info": "3 Hari (Simpan Dingin)", "storage_temp": "Suhu Kulkas (2-4 C)"},
		},
		SeedItem{
			Name: "Whey Isolate Double Rich Chocolate 30g Shake", ScientificName: "Instant Hydrolyzed Whey Shake", Class: "Minuman Nutrisi",
			Habitat: "Beverage Studio", Diet: "Muscle Recovery", ConservationStatus: "BPOM Certified", Price: 35000, MinOrder: 1, MaxOrder: ptrInt(50),
			Description: "Minuman shake siap minum 30g protein whey isolate murni dengan rasa cokelat belgian pekat dan 0g gula pasir.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1579722820308-d74e571900a9?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Segel Higienis"},
			Attributes: map[string]interface{}{"portion": "350 ml (30g Protein)", "expired_info": "7 Hari", "storage_temp": "Suhu Dingin"},
		},
		SeedItem{
			Name: "Electrolyte Recovery Lemon Lime Sports Drink", ScientificName: "Isotonic Hydration Solution", Class: "Minuman Nutrisi",
			Habitat: "Beverage Studio", Diet: "Endurance & Hydration", ConservationStatus: "Natural Sea Salt", Price: 25000, MinOrder: 1, MaxOrder: ptrInt(40),
			Description: "Minuman isotonik alami dengan kalium kelapa, magnesium, garam laut bali, dan perasan jeruk nipis asli.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Segel Pabrik"},
			Attributes: map[string]interface{}{"portion": "500 ml", "expired_info": "14 Hari", "storage_temp": "Suhu Ruang / Dingin"},
		},
		SeedItem{
			Name: "Ceremonial Matcha Almond Latte (Sugar-Free)", ScientificName: "Uji Matcha Botanical Latte", Class: "Minuman Nutrisi",
			Habitat: "Beverage Studio", Diet: "Antioxidant & L-Theanine", ConservationStatus: "Direct Japanese Import", Price: 42000, MinOrder: 1, MaxOrder: ptrInt(30),
			Description: "Matcha grade upacara dari Uji Kyoto dipadukan dengan susu almond panggang homemade tanpa pemanis buatan.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Kurir Instan & Sameday", "warranty": "Authentic Japanese Matcha"},
			Attributes: map[string]interface{}{"portion": "350 ml", "expired_info": "3 Hari", "storage_temp": "Suhu Dingin (2-4 C)"},
		},
		SeedItem{
			Name: "Artisanal Single Origin Cold Brew Coffee 250ml", ScientificName: "Steeped Arabica Concentrate", Class: "Minuman Nutrisi",
			Habitat: "Beverage Studio", Diet: "Clean Energy & Focus", ConservationStatus: "100% Specialty Arabica", Price: 32000, MinOrder: 1, MaxOrder: ptrInt(30),
			Description: "Kopi cold brew seduh dingin 24 jam biji Arabika Gayo dengan profil rasa cokelat floral lembut dan asam rendah.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Pengiriman Instan & Ekspedisi", "warranty": "Biji Kopi Specialty"},
			Attributes: map[string]interface{}{"portion": "250 ml", "expired_info": "14 Hari (Simpan Kulkas)", "storage_temp": "Suhu Kulkas (4 C)"},
		},
	)

	// Camilan Sehat (5 items)
	items = append(items,
		SeedItem{
			Name: "Roasted Almond, Chia & Cranberry Energy Bar", ScientificName: "Plant Energy Nutrient Bar", Class: "Camilan Sehat",
			Habitat: "Snack Lab", Diet: "Clean Energy Snack", ConservationStatus: "Gluten-Free", Price: 22000, MinOrder: 1, MaxOrder: ptrInt(50),
			Description: "Bar kacang almond panggang renyah dengan biji chia, cranberry kering asam manis, dan perekat madu hutan asli.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Higienis & Alami"},
			Attributes: map[string]interface{}{"portion": "1 Bar (50g / 210 kcal)", "expired_info": "3 Bulan", "storage_temp": "Suhu Ruang Sejuk"},
		},
		SeedItem{
			Name: "Dark Chocolate & Rolled Oat Granola Clusters", ScientificName: "Artisan Granola Crunch", Class: "Camilan Sehat",
			Habitat: "Snack Lab", Diet: "High Fiber & Antioxidant", ConservationStatus: "No Palm Oil", Price: 48000, MinOrder: 1, MaxOrder: ptrInt(30),
			Description: "Granola gandum giling panggang dengan lelehan dark chocolate 70%, biji labu, dan serpihan kelapa panggang.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1517093157656-b9ec91e3e606?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Kemasan Ziplock Kedap Udara"},
			Attributes: map[string]interface{}{"portion": "Pouch 250 gram", "expired_info": "6 Bulan", "storage_temp": "Suhu Ruang"},
		},
		SeedItem{
			Name: "Freeze-Dried Pitaya Dragonfruit Chips 100g", ScientificName: "Dehydrated Exotic Fruit Snack", Class: "Camilan Sehat",
			Habitat: "Snack Lab", Diet: "100% Pure Fruit", ConservationStatus: "No Sugar Added", Price: 35000, MinOrder: 1, MaxOrder: ptrInt(40),
			Description: "Keripik buah naga merah beku-kering renyah tanpa minyak dan tanpa gula tambahan, kaya vitamin C alami.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1528825871115-3581a5387919?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "100% Buah Murni"},
			Attributes: map[string]interface{}{"portion": "Pack 100g", "expired_info": "6 Bulan", "storage_temp": "Suhu Ruang Kering"},
		},
		SeedItem{
			Name: "Organic Peanut Butter High-Protein Energy Bites", ScientificName: "No-Bake Protein Balls", Class: "Camilan Sehat",
			Habitat: "Snack Lab", Diet: "Keto & Workout Fuel", ConservationStatus: "Handmade Fresh", Price: 32000, MinOrder: 1, MaxOrder: ptrInt(30),
			Description: "Bola-bola energi selai kacang tanah panggang, kurma medjool, dan bubuk protein rami tanpa tepung terigu.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Segel Higienis"},
			Attributes: map[string]interface{}{"portion": "Box isi 6 pcs", "expired_info": "1 Bulan", "storage_temp": "Suhu Kulkas (4-10 C)"},
		},
		SeedItem{
			Name: "Baked Sea Salt & Herb Cashew Nuts 200g", ScientificName: "Oven-Roasted Tree Nuts", Class: "Camilan Sehat",
			Habitat: "Snack Lab", Diet: "Healthy Fats Snack", ConservationStatus: "Premium Grade Cashew", Price: 62000, MinOrder: 1, MaxOrder: ptrInt(25),
			Description: "Kacang mede panggang oven bumbu rosemary dan garam laut bali renyah tanpa digoreng minyak.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1536591375315-1b836814d60a?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Kualitas Super"},
			Attributes: map[string]interface{}{"portion": "Jar 200 gram", "expired_info": "4 Bulan", "storage_temp": "Suhu Ruang"},
		},
	)

	// Frozen Food & Prep (5 items)
	items = append(items,
		SeedItem{
			Name: "Marinated Lemon Herb Chicken Breast 1kg (Frozen)", ScientificName: "Pre-Portioned Skinless Breast", Class: "Frozen Food & Prep",
			Habitat: "Cold Storage", Diet: "Meal Prep Essential", ConservationStatus: "HACCP Certified", Price: 85000, MinOrder: 1, MaxOrder: ptrInt(20),
			Description: "Dada ayam tanpa kulit marinasi rempah lemon siap panggang/airfryer dalam 5 kantong vakum individual @200g.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Instant / SameDay / Paxel Frozen", "warranty": "Rantai Dingin Terjaga"},
			Attributes: map[string]interface{}{"portion": "1 kg (5 pack vakum)", "expired_info": "6 Bulan (Beku)", "storage_temp": "Freezer (-18 C)"},
		},
		SeedItem{
			Name: "Organic Frozen Wild Acai Berry Puree 4x100g", ScientificName: "Unsweetened Brazilian Acai", Class: "Frozen Food & Prep",
			Habitat: "Cold Storage", Diet: "Superfood Smoothie Bowl", ConservationStatus: "100% Organic", Price: 78000, MinOrder: 1, MaxOrder: ptrInt(20),
			Description: "Bubur buah acai beku liar dari hutan Amazon Brazil tanpa gula untuk smoothie bowl antioksidan tinggi.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Kurir Instan & Paxel Frozen", "warranty": "Impor Resmi Brazil"},
			Attributes: map[string]interface{}{"portion": "Pack isi 4 x 100g", "expired_info": "12 Bulan", "storage_temp": "Freezer (-18 C)"},
		},
		SeedItem{
			Name: "Grass-Fed Lean Beef Burger Patties 4x125g", ScientificName: "90/10 Lean Minced Beef", Class: "Frozen Food & Prep",
			Habitat: "Cold Storage", Diet: "Keto Burger Prep", ConservationStatus: "Aussie Grass-Fed", Price: 95000, MinOrder: 1, MaxOrder: ptrInt(15),
			Description: "Patty burger daging sapi Australia 90% tanpa lemak dengan bumbu lada hitam dan garam laut.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Instant / SameDay / Paxel Frozen", "warranty": "100% Halal Beef"},
			Attributes: map[string]interface{}{"portion": "4 Patty @125g (500g)", "expired_info": "6 Bulan", "storage_temp": "Freezer (-18 C)"},
		},
		SeedItem{
			Name: "Japanese Steamed Edamame Beans 500g (Frozen)", ScientificName: "Non-GMO Green Soybeans", Class: "Frozen Food & Prep",
			Habitat: "Cold Storage", Diet: "Fiber & Isoflavone", ConservationStatus: "Export Grade", Price: 28000, MinOrder: 1, MaxOrder: ptrInt(30),
			Description: "Kedelai edamame jepang manis gurih yang sudah diblansir, cukup dihangatkan 3 menit langsung siap santap.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Instant / SameDay / Paxel Frozen", "warranty": "Kualitas Ekspor"},
			Attributes: map[string]interface{}{"portion": "Pack 500 gram", "expired_info": "12 Bulan", "storage_temp": "Freezer (-18 C)"},
		},
		SeedItem{
			Name: "Artisan Chicken & Prawn Siomay Dimsum 10pcs", ScientificName: "Steamed Dimsum Frozen Pack", Class: "Frozen Food & Prep",
			Habitat: "Cold Storage", Diet: "High-Protein Snack", ConservationStatus: "No Added MSG", Price: 45000, MinOrder: 1, MaxOrder: ptrInt(25),
			Description: "Siomay dimsum isi daging paha ayam cincang dan udang utuh dengan kulit tipis lembut dan saus cabai cocol.",
			ProductType: "food", ImageURL: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Instant / SameDay / Paxel Frozen", "warranty": "Higienis & Halal"},
			Attributes: map[string]interface{}{"portion": "Pack isi 10 pcs + Saus", "expired_info": "3 Bulan", "storage_temp": "Freezer (-18 C)"},
		},
	)

	// =========================================================================
	// 3. SERVICE / JASA & LAYANAN (15 ITEMS)
	// =========================================================================

	// Laundry & Shoe Care (4 items)
	items = append(items,
		SeedItem{
			Name: "Jasa Deep Clean & Repaint Sneakers Premium", ScientificName: "Shoe Care & Restoration Service", Class: "Laundry & Shoe Care",
			Habitat: "Studio Workshop", Diet: "Restoration", ConservationStatus: "Garansi 14 Hari", Price: 125000, MinOrder: 1,
			Description: "Layanan cuci mendalam hingga ke sela insole dan outsole, unyellowing midsole, serta recoloring warna pudar.",
			ProductType: "service", ImageURL: "https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Antar-Jemput Jabodetabek / Kirim Ekspedisi", "warranty": "Garansi Re-Clean"},
			Attributes: map[string]interface{}{"duration": "2-3 Hari Kerja", "service_location": "Toko & Antar Jemput", "service_area": "Jabodetabek & Nasional"},
		},
		SeedItem{
			Name: "Jasa Restorasi & Spa Tas Kulit Branded", ScientificName: "Luxury Leather Bag Spa", Class: "Laundry & Shoe Care",
			Habitat: "Studio Workshop", Diet: "Leather Treatment", ConservationStatus: "Premium Angelus Paint", Price: 450000, MinOrder: 1,
			Description: "Pembersihan noda jamur, rehidrasi pelembab kulit asli, touch-up baret sudut, dan pelapisan nano coating pelindung air.",
			ProductType: "service", ImageURL: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Antar Jemput Kurir Khusus / Asuransi", "warranty": "Garansi Bahan Asli"},
			Attributes: map[string]interface{}{"duration": "5-7 Hari Kerja", "service_location": "Studio Workshop", "service_area": "Seluruh Indonesia"},
		},
		SeedItem{
			Name: "Jasa Hydrophobic Nano Waterproofing Sepatu", ScientificName: "Liquid Repellent Coating", Class: "Laundry & Shoe Care",
			Habitat: "Studio Workshop", Diet: "Protection", ConservationStatus: "German Nano Tech", Price: 65000, MinOrder: 1,
			Description: "Pelapisan semprotan nano hydrophobic pada bahan kanvas/suede agar tahan tumpahan kopi, saus, dan lumpur hujan.",
			ProductType: "service", ImageURL: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Drop Point Toko & Kirim", "warranty": "Tahan hingga 3 Bulan"},
			Attributes: map[string]interface{}{"duration": "1 Hari", "service_location": "Workshop", "service_area": "Jabodetabek"},
		},
		SeedItem{
			Name: "Jasa Express Unyellowing Midsole Sepatu", ScientificName: "Oxidation Bleaching Service", Class: "Laundry & Shoe Care",
			Habitat: "Studio Workshop", Diet: "De-Oxidation", ConservationStatus: "UV Chamber Light", Price: 75000, MinOrder: 1,
			Description: "Menghilangkan warna kuning oksidasi pada sol karet putih sepatu boost/samba kembali putih bersih seperti baru.",
			ProductType: "service", ImageURL: "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Drop Point / Pick-Up", "warranty": "Hasil Putih Terbukti"},
			Attributes: map[string]interface{}{"duration": "1-2 Hari Kerja", "service_location": "Workshop", "service_area": "Jabodetabek"},
		},
	)

	// Fitness & Personal Training (4 items)
	items = append(items,
		SeedItem{
			Name: "Private 1-on-1 Personal Gym Coaching (10 Sesi)", ScientificName: "Certified Strength Training", Class: "Fitness & Personal Training",
			Habitat: "Gym & Fitness Club", Diet: "Hypertrophy & Fat Loss", ConservationStatus: "Certified Trainer", Price: 2500000, MinOrder: 1,
			Description: "Program latihan beban privat 10 sesi intensif dengan evaluasi postur, teknik angkat aman, dan program periodisasi.",
			ProductType: "service", ImageURL: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop", IsShippingAvailable: false,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "In-Person Gym Session", "warranty": "Garansi Hasil Target"},
			Attributes: map[string]interface{}{"duration": "10 Sesi @60 Menit", "service_location": "Gym Partner / Home Gym", "service_area": "Jakarta & Tangerang"},
		},
		SeedItem{
			Name: "Online Custom Diet & Workout Plan (30 Hari)", ScientificName: "Nutritionist & Fitness Program", Class: "Fitness & Personal Training",
			Habitat: "Online / WhatsApp", Diet: "Macro Nutrition", ConservationStatus: "Ahli Gizi Bersertifikasi", Price: 499000, MinOrder: 1,
			Description: "Menu makan harian terhitung kalori & makro nutrisi sesuai target berat badan, plus video gerakan latihan mingguan.",
			ProductType: "service", ImageURL: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&auto=format&fit=crop", IsShippingAvailable: false,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Online Consultation via WA & Zoom", "warranty": "Monitoring Harian"},
			Attributes: map[string]interface{}{"duration": "30 Hari Pendampingan", "service_location": "Online via WA / Zoom", "service_area": "Seluruh Dunia"},
		},
		SeedItem{
			Name: "Gait Analysis & Biomekanik Lari Marathon", ScientificName: "High-Speed Running Analysis", Class: "Fitness & Personal Training",
			Habitat: "Running Lab", Diet: "Injury Prevention", ConservationStatus: "Sensor Video 240fps", Price: 650000, MinOrder: 1,
			Description: "Analisis rekaman video gerak lambat langkah lari di treadmill untuk menentukan jenis sepatu terbaik dan cegah cedera.",
			ProductType: "service", ImageURL: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop", IsShippingAvailable: false,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Studio Lab Session", "warranty": "Laporan PDF Detail"},
			Attributes: map[string]interface{}{"duration": "90 Menit Sesi", "service_location": "Running Lab Jakarta", "service_area": "Jabodetabek"},
		},
		SeedItem{
			Name: "Fisioterapi & Sports Massage Recovery", ScientificName: "Musculoskeletal Sports Therapy", Class: "Fitness & Personal Training",
			Habitat: "Clinic / Home Visit", Diet: "Recovery & Pain Relief", ConservationStatus: "Fisioterapis Berizin", Price: 350000, MinOrder: 1,
			Description: "Terapi pelepasan ketegangan otot (myofascial release), dry needling, dan stretching pasca marathon atau pertandingan.",
			ProductType: "service", ImageURL: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&auto=format&fit=crop", IsShippingAvailable: false,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Home Visit / Datang ke Klinik", "warranty": "Fisioterapis Profesional"},
			Attributes: map[string]interface{}{"duration": "60 Menit", "service_location": "Klinik / Home Visit", "service_area": "Jabodetabek"},
		},
	)

	// Desain & Kreatif (4 items)
	items = append(items,
		SeedItem{
			Name: "Jasa Desain Jersey Custom Tim Olahraga", ScientificName: "Vector Sublimation Apparel Design", Class: "Desain & Kreatif",
			Habitat: "Digital Studio", Diet: "Graphic Design", ConservationStatus: "Revisi Unlimited", Price: 350000, MinOrder: 1,
			Description: "Pembuatan konsep desain jersey futsal, basket, atau lari custom lengkap dengan pola print sublimasi siap cetak.",
			ProductType: "service", ImageURL: "https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=800&auto=format&fit=crop", IsShippingAvailable: false,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Kirim File via Email / Google Drive", "warranty": "File Master AI, PDF, CDR"},
			Attributes: map[string]interface{}{"duration": "2-3 Hari Kerja", "service_location": "Online", "service_area": "Seluruh Indonesia"},
		},
		SeedItem{
			Name: "Jasa Desain Logo & Brand Identity Toko", ScientificName: "Visual Corporate Branding Kit", Class: "Desain & Kreatif",
			Habitat: "Digital Studio", Diet: "Identity Design", ConservationStatus: "Copyright Ownership", Price: 750000, MinOrder: 1,
			Description: "Desain logo profesional dengan 3 alternatif konsep, panduan warna tema, tipografi, dan mockup kemasan produk.",
			ProductType: "service", ImageURL: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800&auto=format&fit=crop", IsShippingAvailable: false,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Download Link Cloud Drive", "warranty": "Revisi Sampai Cocok"},
			Attributes: map[string]interface{}{"duration": "3-5 Hari Kerja", "service_location": "Online", "service_area": "Nasional"},
		},
		SeedItem{
			Name: "Jasa Foto Katalog Produk Studio Profesional", ScientificName: "Commercial Studio Photography", Class: "Desain & Kreatif",
			Habitat: "Photo Studio", Diet: "Commercial Photography", ConservationStatus: "High-Res 45MP", Price: 850000, MinOrder: 1,
			Description: "Sesi foto produk di studio dengan pencahayaan profesional, model atlet, dan 15 foto hasil edit retouch resolusi tinggi.",
			ProductType: "service", ImageURL: "https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=800&auto=format&fit=crop", IsShippingAvailable: false,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Barang dikirim ke studio", "warranty": "Foto Siap Upload E-Commerce"},
			Attributes: map[string]interface{}{"duration": "3 Hari Kerja", "service_location": "Studio Jakarta", "service_area": "Nasional"},
		},
		SeedItem{
			Name: "Jasa Pembuatan Video Promosi Reels & TikTok", ScientificName: "Short-Form Video Production", Class: "Desain & Kreatif",
			Habitat: "Digital Studio", Diet: "Video Marketing", ConservationStatus: "4K 60fps Export", Price: 600000, MinOrder: 1,
			Description: "Pembuatan video pendek vertikal 30-60 detik dengan hook menarik, audio viral berlisensi, dan color grading estetik.",
			ProductType: "service", ImageURL: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&auto=format&fit=crop", IsShippingAvailable: false,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "File Kirim Cloud Link", "warranty": "2x Revisi Minor"},
			Attributes: map[string]interface{}{"duration": "2 Hari Kerja", "service_location": "Online", "service_area": "Seluruh Indonesia"},
		},
	)

	// Service & Repair (3 items)
	items = append(items,
		SeedItem{
			Name: "Jasa Servis & Maintenance Treadmill Gym", ScientificName: "Fitness Equipment Overhaul", Class: "Service & Repair",
			Habitat: "On-Site Visit", Diet: "Mechanical & Electrical", ConservationStatus: "Garansi Sparepart 3 Bulan", Price: 350000, MinOrder: 1,
			Description: "Pemeriksaan motor penggerak, pelumasan belt berjalan, perataan dek lari, dan kalibrasi sensor kecepatan treadmill.",
			ProductType: "service", ImageURL: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop", IsShippingAvailable: false,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Teknisi Datang ke Lokasi (Home Visit)", "warranty": "Garansi Kerja 1 Bulan"},
			Attributes: map[string]interface{}{"duration": "2 Jam Pengerjaan", "service_location": "Home Visit / Gym On-Site", "service_area": "Jabodetabek"},
		},
		SeedItem{
			Name: "Jasa Overhaul & Tune-Up Sepeda Roadbike / MTB", ScientificName: "Bicycle Complete Overhaul", Class: "Service & Repair",
			Habitat: "Bike Workshop", Diet: "Drivetrain & Bearing", ConservationStatus: "Shimano Certified Tech", Price: 275000, MinOrder: 1,
			Description: "Pembersihan total drivetrain ultrasonic, penyetelan groupset indexing gigi, bleeding rem hidrolik, dan truing velg.",
			ProductType: "service", ImageURL: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&auto=format&fit=crop", IsShippingAvailable: false,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Bawa Sepeda ke Workshop / Antar Jemput", "warranty": "Garansi Setelan 2 Minggu"},
			Attributes: map[string]interface{}{"duration": "1 Hari Kerja", "service_location": "Bike Shop", "service_area": "Jabodetabek"},
		},
		SeedItem{
			Name: "Jasa Ganti Baterai & Layar Smartwatch Garmin", ScientificName: "Wearable Hardware Repair", Class: "Service & Repair",
			Habitat: "Tech Lab", Diet: "Precision Electronics", ConservationStatus: "Original Replacement Part", Price: 450000, MinOrder: 1,
			Description: "Penggantian baterai smartwatch boros dan kaca LCD pecah dengan seal lem anti-air kembali standar IP68.",
			ProductType: "service", ImageURL: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Bisa Kirim Unit via JNE / J&T", "warranty": "Garansi Part 3 Bulan"},
			Attributes: map[string]interface{}{"duration": "2 Hari Kerja", "service_location": "Tech Lab", "service_area": "Seluruh Indonesia"},
		},
	)

	// =========================================================================
	// 4. DIGITAL ASSETS (15 ITEMS)
	// =========================================================================

	// E-Book & Panduan (4 items)
	items = append(items,
		SeedItem{
			Name: "E-Book Panduan Marathon Training 2026", ScientificName: "Digital Training Manual", Class: "E-Book & Panduan",
			Habitat: "Digital Asset", Diet: "Training Program", ConservationStatus: "Lisensi Personal", Price: 149000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "E-Book komprehensif 12 minggu persiapan marathon dari pelatih bersertifikasi internasional. Termasuk panduan nutrisi dan pencegahan cedera.",
			ProductType: "digital", ImageURL: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Instant Download Cloud Link", "warranty": "Lisensi Personal"},
			Attributes: map[string]interface{}{"file_size": "45 MB (PDF + Excel)", "license_type": "Personal Use"},
		},
		SeedItem{
			Name: "E-Book Panduan Nutrisi & Fat Loss Sains", ScientificName: "Scientific Fat Loss Blueprint", Class: "E-Book & Panduan",
			Habitat: "Digital Asset", Diet: "Nutrition Guide", ConservationStatus: "Evidence-Based", Price: 119000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "Buku panduan berbasis riset ilmiah untuk membakar lemak tubuh tanpa kehilangan massa otot dan tanpa diet ekstrem menyiksa.",
			ProductType: "digital", ImageURL: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Instant Download", "warranty": "Akses Selamanya"},
			Attributes: map[string]interface{}{"file_size": "28 MB (PDF)", "license_type": "Personal License"},
		},
		SeedItem{
			Name: "Manual Kalistenik Pemula ke Mahir (PDF)", ScientificName: "Bodyweight Mastery Guide", Class: "E-Book & Panduan",
			Habitat: "Digital Asset", Diet: "Calisthenics", ConservationStatus: "Illustrated Step-by-Step", Price: 99000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "Panduan bergambar progres gerakan pull up, dips, muscle up, dan handstand bertahap dari nol tanpa alat gym mahal.",
			ProductType: "digital", ImageURL: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Instant Download via Email", "warranty": "Lisensi Personal"},
			Attributes: map[string]interface{}{"file_size": "36 MB (PDF)", "license_type": "Personal License"},
		},
		SeedItem{
			Name: "Handbook Pencegahan & Rehabilitasi Cedera Lari", ScientificName: "Running Physio Handbook", Class: "E-Book & Panduan",
			Habitat: "Digital Asset", Diet: "Injury Recovery", ConservationStatus: "Physiotherapist Written", Price: 129000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "Penanganan mandiri shin splints, plantar fasciitis, ITB syndrome, dan runner's knee dengan panduan stretching teruji.",
			ProductType: "digital", ImageURL: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Akses Link Google Drive", "warranty": "Akses Seumur Hidup"},
			Attributes: map[string]interface{}{"file_size": "22 MB (PDF)", "license_type": "Personal License"},
		},
	)

	// Template & Spreadsheet (4 items)
	items = append(items,
		SeedItem{
			Name: "Google Sheets Financial Planner & POS Toko", ScientificName: "Automated Bookkeeping Sheet", Class: "Template & Spreadsheet",
			Habitat: "Digital Asset", Diet: "Finance & Accounting", ConservationStatus: "Commercial License", Price: 175000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "Spreadsheet pembukuan otomatis untuk toko online dengan laporan laba rugi, stok barang, dan grafik arus kas realtime.",
			ProductType: "digital", ImageURL: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Akses Langsung Duplikat Sheet", "warranty": "Update Formula Gratis"},
			Attributes: map[string]interface{}{"file_size": "Google Sheet Template", "license_type": "Commercial License"},
		},
		SeedItem{
			Name: "Notion Ultimate Fitness & Workout Hub", ScientificName: "Notion Life System Template", Class: "Template & Spreadsheet",
			Habitat: "Digital Asset", Diet: "Habit & Workout Tracking", ConservationStatus: "Notion Template Link", Price: 135000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "Dashboard Notion interaktif untuk mencatat PR angkatan beban, jadwal latihan mingguan, dan rekap foto progres tubuh.",
			ProductType: "digital", ImageURL: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Notion Duplicate Link", "warranty": "Akses Selamanya"},
			Attributes: map[string]interface{}{"file_size": "Notion Web Link", "license_type": "Personal License"},
		},
		SeedItem{
			Name: "50+ Template Desain Banner Sosmed Toko (Canva)", ScientificName: "Canva Pro E-Commerce Kit", Class: "Template & Spreadsheet",
			Habitat: "Digital Asset", Diet: "Marketing Assets", ConservationStatus: "Fully Editable", Price: 95000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "Koleksi 50 desain banner Instagram feed, story, dan carousel promosi produk yang bisa diedit mudah di Canva gratis.",
			ProductType: "digital", ImageURL: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Canva Direct Template Link", "warranty": "Siap Pakai"},
			Attributes: map[string]interface{}{"file_size": "Canva Template Pack", "license_type": "Commercial License"},
		},
		SeedItem{
			Name: "Excel Auto Inventory & Barcode Generator", ScientificName: "Warehouse Stock System", Class: "Template & Spreadsheet",
			Habitat: "Digital Asset", Diet: "Inventory Logistics", ConservationStatus: "VBA Macro Enabled", Price: 189000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "Template Excel dengan macro pencetak barcode produk dan pengingat otomatis ketika stok barang menipis di gudang.",
			ProductType: "digital", ImageURL: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "File Kirim via Email / WA", "warranty": "Bantuan Setup Awal"},
			Attributes: map[string]interface{}{"file_size": "12 MB (Excel XLSM)", "license_type": "Commercial License"},
		},
	)

	// Software & Preset (4 items)
	items = append(items,
		SeedItem{
			Name: "Lightroom Presets Sports Photography (20 Pack)", ScientificName: "Adobe XMP / DNG Presets", Class: "Software & Preset",
			Habitat: "Digital Asset", Diet: "Color Grading", ConservationStatus: "Desktop & Mobile", Price: 145000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "Preset warna dramatis dan kontras tinggi untuk foto olahraga lari, gym, dan aksi lapangan luar ruangan.",
			ProductType: "digital", ImageURL: "https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Instant Download ZIP File", "warranty": "Kompatibel iOS/Android/PC"},
			Attributes: map[string]interface{}{"file_size": "15 MB (DNG & XMP)", "license_type": "Commercial License"},
		},
		SeedItem{
			Name: "Cinematic Fitness Video LUTs (DaVinci / Premiere)", ScientificName: "3D CUBE Color LUTs", Class: "Software & Preset",
			Habitat: "Digital Asset", Diet: "Video Editing", ConservationStatus: "Universal 3D LUT", Price: 165000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "Tabel gradasi warna sinematik bergaya Nike/Adidas commercial untuk video Reels, YouTube, dan iklan komersial.",
			ProductType: "digital", ImageURL: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Instant Download ZIP Link", "warranty": "Akses Selamanya"},
			Attributes: map[string]interface{}{"file_size": "25 MB (.CUBE files)", "license_type": "Commercial License"},
		},
		SeedItem{
			Name: "Macro & TDEE Calculator Web Widget (Source Code)", ScientificName: "React / Vue JavaScript Plugin", Class: "Software & Preset",
			Habitat: "Digital Asset", Diet: "Web Component", ConservationStatus: "MIT Open License", Price: 250000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "Source code kalkulator kalori dan makro interaktif siap pasang di website gym atau portal nutrisi Anda.",
			ProductType: "digital", ImageURL: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "GitHub Repo / ZIP File", "warranty": "Dokumentasi Lengkap"},
			Attributes: map[string]interface{}{"file_size": "5 MB (TypeScript / CSS)", "license_type": "Developer License"},
		},
		SeedItem{
			Name: "E-Commerce Mobile App UI Kit (Figma File)", ScientificName: "Design System & Components", Class: "Software & Preset",
			Habitat: "Digital Asset", Diet: "UI/UX Design", ConservationStatus: "Figma Community File", Price: 299000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "Kit antarmuka 60+ halaman mobile e-commerce modern dengan autolayout, dark mode, dan komponen responsif lengkap.",
			ProductType: "digital", ImageURL: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Figma Direct Link", "warranty": "Free Component Updates"},
			Attributes: map[string]interface{}{"file_size": "Figma Cloud Project", "license_type": "Commercial License"},
		},
	)

	// Kursus Video & Audio (3 items)
	items = append(items,
		SeedItem{
			Name: "Masterclass Video HIIT Coaching & Fat Burn", ScientificName: "10-Episode Video Masterclass", Class: "Kursus Video & Audio",
			Habitat: "Digital Asset", Diet: "Video Course", ConservationStatus: "Full HD 1080p", Price: 350000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "10 modul video pelatihan intensitas tinggi HIIT dari instruktur berlisensi untuk membakar kalori maksimal di rumah.",
			ProductType: "digital", ImageURL: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Akses Streaming & Download", "warranty": "Akses Seumur Hidup"},
			Attributes: map[string]interface{}{"file_size": "2.4 GB (10 Video MP4)", "license_type": "Personal License"},
		},
		SeedItem{
			Name: "Audio Guided Breathing & Sports Recovery", ScientificName: "Breathwork Audio Sessions", Class: "Kursus Video & Audio",
			Habitat: "Digital Asset", Diet: "Mental Recovery & Sleep", ConservationStatus: "High-Bitrate MP3", Price: 89000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "Sesi audio pemulihan pernapasan terpandu untuk menurunkan detak jantung pasca olahraga dan meningkatkan kualitas tidur lelap.",
			ProductType: "digital", ImageURL: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Instant Download MP3", "warranty": "Akses Selamanya"},
			Attributes: map[string]interface{}{"file_size": "180 MB (8 Audio Track)", "license_type": "Personal License"},
		},
		SeedItem{
			Name: "Video Taktik Futsal Modern & Set-Piece Plays", ScientificName: "Futsal Coaching Masterclass", Class: "Kursus Video & Audio",
			Habitat: "Digital Asset", Diet: "Tactics & Strategy", ConservationStatus: "Full HD Animation", Price: 199000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "Analisis animasi taktik rotasi 4-0, 3-1, skema bola mati corner kick, dan pertahanan zona marking futsal modern.",
			ProductType: "digital", ImageURL: "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Cloud Video Link", "warranty": "Akses Seumur Hidup"},
			Attributes: map[string]interface{}{"file_size": "1.2 GB (Video HD)", "license_type": "Personal License"},
		},
	)

	// =========================================================================
	// 5. SATWA & LIVING FAUNA (15 ITEMS)
	// =========================================================================

	// Mamalia (4 items)
	items = append(items,
		SeedItem{
			Name: "Chinchilla Grey Royal Velvet", ScientificName: "Chinchilla lanigera", Class: "Mamalia",
			Habitat: "Pegunungan Andes (Captive Bred)", Diet: "Herbivora (Timothy Hay)", ConservationStatus: "Legal Captive Bred", Price: 45000000, MinOrder: 1, MaxOrder: ptrInt(2),
			Description: "Chinchilla jinak dan terawat dengan bulu ekstra tebal dan halus grade eksklusif. Sehat, aktif, dan bersertifikat dokter hewan.",
			ProductType: "fauna", ImageURL: "https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Pulau Jawa via Pet Courier", "warranty": "Garansi Sehat & Hidup Sampai Tujuan"},
			Attributes: map[string]interface{}{"gender": "Jantan", "age": "4 Bulan", "care_tags": "Suhu Dingin AC (18-22 C), Pakan Hay"},
		},
		SeedItem{
			Name: "Sugar Glider White Face Mosaic Pedigree", ScientificName: "Petaurus breviceps", Class: "Mamalia",
			Habitat: "Captive Breeding Sanctuary", Diet: "Omnivora (Nectar & Jangkrik)", ConservationStatus: "Legal Pet", Price: 1850000, MinOrder: 1, MaxOrder: ptrInt(2),
			Description: "Sugar glider warna mutasi White Face Mosaic dengan corak bersih, karakter bonding jinak total tidak menggigit.",
			ProductType: "fauna", ImageURL: "https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Jabodetabek & Kereta Pet Express", "warranty": "Garansi 100% Hidup"},
			Attributes: map[string]interface{}{"gender": "Betina", "age": "2.5 Bulan OOP", "care_tags": "Kandang Tinggi, Pouch Tidur"},
		},
		SeedItem{
			Name: "Kelinci Holland Lop Purebred Show Quality", ScientificName: "Oryctolagus cuniculus", Class: "Mamalia",
			Habitat: "Indoor Rabbitry", Diet: "Herbivora (Hay & Pellet)", ConservationStatus: "Pedigree Certificate", Price: 1200000, MinOrder: 1, MaxOrder: ptrInt(2),
			Description: "Kelinci telinga turun ras murni Holland Lop dengan kepala bulat menggemaskan, bulu terawat bebas kutu dan jamur.",
			ProductType: "fauna", ImageURL: "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Pulau Jawa", "warranty": "Garansi Sehat 3 Hari"},
			Attributes: map[string]interface{}{"gender": "Jantan", "age": "3 Bulan", "care_tags": "Bebas Kandang Kawat Kasar"},
		},
		SeedItem{
			Name: "Landak Mini Albino Eyes Ruby Grade A", ScientificName: "Atelerix albiventris", Class: "Mamalia",
			Habitat: "Captive Bred Cage", Diet: "Insektivora (Cat Food & Ulat)", ConservationStatus: "Domestik Legal", Price: 350000, MinOrder: 1, MaxOrder: ptrInt(4),
			Description: "Landak mini albino berduri putih bersih dengan mata merah ruby, sehat gemuk dan terbiasa dipegang tangan.",
			ProductType: "fauna", ImageURL: "https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Jabodetabek / Pet Courier", "warranty": "Garansi Hidup"},
			Attributes: map[string]interface{}{"gender": "Betina", "age": "2 Bulan", "care_tags": "Serbuk Kayu Bersih, Suhu Hangat"},
		},
	)

	// Ikan Hias (4 items)
	items = append(items,
		SeedItem{
			Name: "Super Red Arowana Kapuas Hulu Grade A+", ScientificName: "Scleropages formosus", Class: "Ikan Hias",
			Habitat: "Sungai Kapuas (Penangkar Resmi)", Diet: "Karnivora (Udang & Jangkrik)", ConservationStatus: "Sertifikat & Microchip", Price: 18500000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "Arowana Super Red anatomi sempurna, dayung lebar, ring sisik merah pekat menyala dengan sertifikat resmi dan microchip.",
			ProductType: "fauna", ImageURL: "https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia (Packing Oksigen Box)", "warranty": "Garansi Hidup 100% Sertakan Video"},
			Attributes: map[string]interface{}{"size": "22 cm", "certificate": "Sertifikat CITES & Microchip", "care_tags": "Tank Min 150cm, Filter Matang"},
		},
		SeedItem{
			Name: "Discus Blue Diamond Penang Import 3.5 Inch", ScientificName: "Symphysodon aequifasciatus", Class: "Ikan Hias",
			Habitat: "Amazon River (Penang Breeding)", Diet: "Omnivora (Burger Discus / Cacing)", ConservationStatus: "Aquarium Bred", Price: 450000, MinOrder: 1, MaxOrder: ptrInt(10),
			Description: "Ikan Discus warna biru berlian solid mengkilap, bentuk tubuh bulat sempurna (round body) bebas penyakit jamur.",
			ProductType: "fauna", ImageURL: "https://images.unsplash.com/photo-1520302630591-fd1c66edc19d?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Oksigen 24 Jam"},
			Attributes: map[string]interface{}{"size": "3.5 Inch (9 cm)", "certificate": "Farm Grade Import", "care_tags": "Suhu Hangat 29-31 C, pH 6.5"},
		},
		SeedItem{
			Name: "Ikan Cupang Avatar Gordon Halfmoon Champion", ScientificName: "Betta splendens", Class: "Ikan Hias",
			Habitat: "Indo Betta Farm", Diet: "Karnivora (Jentik & Pelet)", ConservationStatus: "Champion Lineage", Price: 350000, MinOrder: 1, MaxOrder: ptrInt(5),
			Description: "Cupang halfmoon ekor mekar 180 derajat dengan corak sisik avatar mutiara biru hitam metalik pekat.",
			ProductType: "fauna", ImageURL: "https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Ekor Utuh & Hidup"},
			Attributes: map[string]interface{}{"size": "Size M", "certificate": "F1 Champion Bloodline", "care_tags": "Soliter Tank, Ekstrak Ketapang"},
		},
		SeedItem{
			Name: "Ranchu Goldfish Super White & Red 12cm", ScientificName: "Carassius auratus", Class: "Ikan Hias",
			Habitat: "Pond Breeding", Diet: "Pelet Sinking & Cacing Sutra", ConservationStatus: "Grade A Show", Price: 550000, MinOrder: 1, MaxOrder: ptrInt(4),
			Description: "Koki Ranchu punggung mulus bulat tanpa sirip atas, wen jambul kepala tebal simetris dan renang lincah.",
			ProductType: "fauna", ImageURL: "https://images.unsplash.com/photo-1520302630591-fd1c66edc19d?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Pulau Jawa & Kota Besar", "warranty": "Garansi 100% Hidup"},
			Attributes: map[string]interface{}{"size": "12 cm", "certificate": "Selected Grade", "care_tags": "Aerasi Kuat, Pakan Tenggelam"},
		},
	)

	// Reptil & Amfibi (4 items)
	items = append(items,
		SeedItem{
			Name: "Leopard Gecko Sunglow Tremper Albino (High Yellow)", ScientificName: "Eublepharis macularius", Class: "Reptil & Amfibi",
			Habitat: "Gurun Pakistan (Captive Bred)", Diet: "Insektivora (Jangkrik & Ulat)", ConservationStatus: "Captive Bred Pet", Price: 650000, MinOrder: 1, MaxOrder: ptrInt(3),
			Description: "Gecko jinak warna kuning cerah polos tanpa corak bercak gelap, ekor wortel montok, dan mata albino sehat.",
			ProductType: "fauna", ImageURL: "https://images.unsplash.com/photo-1563281577-a7be47e20db9?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Pulau Jawa", "warranty": "Garansi Ekor Utuh & Sehat"},
			Attributes: map[string]interface{}{"gender": "Jantan", "age": "5 Bulan", "care_tags": "Alas Kalsium / Kertas, Kotak Lembab"},
		},
		SeedItem{
			Name: "Bearded Dragon Citrus Hypo Trans Baby", ScientificName: "Pogona vitticeps", Class: "Reptil & Amfibi",
			Habitat: "Gurun Australia (Captive Bred)", Diet: "Omnivora (Sayur Sawi & Dubia)", ConservationStatus: "Legal Captive Bred", Price: 1500000, MinOrder: 1, MaxOrder: ptrInt(2),
			Description: "Kadal bearded dragon warna kuning citrus menyala dengan kuku transparan hypo, nafsu makan rakus dan ramah disentuh.",
			ProductType: "fauna", ImageURL: "https://images.unsplash.com/photo-1563281577-a7be47e20db9?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Pulau Jawa", "warranty": "Garansi 100% Hidup"},
			Attributes: map[string]interface{}{"gender": "Unsex", "age": "2 Bulan (18 cm)", "care_tags": "Lampu UVB 10.0 + Basking Spot"},
		},
		SeedItem{
			Name: "Corn Snake Snow Motley 60cm (Jinak Total)", ScientificName: "Pantherophis guttatus", Class: "Reptil & Amfibi",
			Habitat: "North America (Captive Line)", Diet: "Karnivora (Mencit Jumper Beku)", ConservationStatus: "Non-Venomous Legal Pet", Price: 1250000, MinOrder: 1, MaxOrder: ptrInt(2),
			Description: "Ular jagung putih bersih mata pink tanpa bisa sama sekali, sangat jinak dan rutin makan mencit beku thawed seminggu sekali.",
			ProductType: "fauna", ImageURL: "https://images.unsplash.com/photo-1531386151447-fd76ad50012f?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Pulau Jawa via Kereta KIB / Ki8", "warranty": "Garansi Hidup & Makan Lancar"},
			Attributes: map[string]interface{}{"gender": "Betina", "age": "7 Bulan (60 cm)", "care_tags": "Kandang Rapat, Alas Serbuk Aspen"},
		},
		SeedItem{
			Name: "Kura-kura Darat Sulcata Baby 6cm (High Dome)", ScientificName: "Centrochelys sulcata", Class: "Reptil & Amfibi",
			Habitat: "Gurun Sahara (Captive Bred)", Diet: "Herbivora (Rumput & Kaktus)", ConservationStatus: "Legal Captive Bred", Price: 1100000, MinOrder: 1, MaxOrder: ptrInt(3),
			Description: "Baby kura-kura sulcata tempurung tinggi mulus (smooth scutes) tanpa piramiding, aktif jalan, dan suka berjemur matahari.",
			ProductType: "fauna", ImageURL: "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia", "warranty": "Garansi Sehat & Hidup"},
			Attributes: map[string]interface{}{"size": "6 cm", "gender": "Unsex Baby", "care_tags": "Jemur Pagi 15 Menit, Rendam Air Hangat"},
		},
	)

	// Tanaman Hias & Biota (3 items)
	items = append(items,
		SeedItem{
			Name: "Monstera Deliciosa Variegata Albo Halfmoon 4 Daun", ScientificName: "Monstera deliciosa var. borsigiana", Class: "Tanaman Hias & Biota",
			Habitat: "Greenhouse Tropis", Diet: "Fotosintesis & Pupuk Slow Release", ConservationStatus: "Rare Plant Collection", Price: 3800000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "Monstera varigata putih pekat corak halfmoon stabil 4 daun berakar rimbun sehat, siap display indoor.",
			ProductType: "fauna", ImageURL: "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Seluruh Indonesia (Packing Kayu Khusus)", "warranty": "Garansi Daun Segar"},
			Attributes: map[string]interface{}{"leaves_count": "4 Daun Aktif", "pot_size": "Pot 20 cm", "care_tags": "Cahaya Terang Tidak Langsung"},
		},
		SeedItem{
			Name: "Bonsai Beringin Kimeng (Ficus microcarpa) Juara", ScientificName: "Ficus microcarpa bonsai", Class: "Tanaman Hias & Biota",
			Habitat: "Taman Outdoor", Diet: "Pupuk Organik & Pemangkasan", ConservationStatus: "Pameran Tingkat Nasional", Price: 8500000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "Bonsai kimeng batang tua berkarakter berumur 12 tahun dengan percabangan matang di pot keramik impor.",
			ProductType: "fauna", ImageURL: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Pulau Jawa (Kurir Khusus Truk)", "warranty": "Kondisi Sehat & Terawat"},
			Attributes: map[string]interface{}{"height": "65 cm", "age": "12 Tahun", "care_tags": "Full Sun Outdoor, Siram 2x Sehari"},
		},
		SeedItem{
			Name: "Complete Aquascape Nature Aquarium Tank 60cm", ScientificName: "Aquatic Ecosystem Layout", Class: "Tanaman Hias & Biota",
			Habitat: "Aquarium Interior", Diet: "CO2 Injeksi & Liquid Fertilizer", ConservationStatus: "Live Aquatic Ecosystem", Price: 4200000, MinOrder: 1, MaxOrder: ptrInt(1),
			Description: "Set akuarium aquascape lengkap kaca optik clear 60cm, hardscape batu seiryu, karpet monte carlo, filter canister, dan lampu LED Chihiros.",
			ProductType: "fauna", ImageURL: "https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=800&auto=format&fit=crop", IsShippingAvailable: true,
			DetailedInfo: map[string]interface{}{"shipping_coverage": "Antar Langsung Jabodetabek / Setting di Tempat", "warranty": "Garansi Ekosistem 1 Bulan"},
			Attributes: map[string]interface{}{"tank_size": "60 x 30 x 36 cm", "equipment": "Filter Canister + CO2 Tabung", "care_tags": "Lampu 8 Jam/Hari, Water Change 30%/Minggu"},
		},
	)

	return items
}
