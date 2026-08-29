package handlers

import (
	"encoding/json"
	"strconv"
	"strings"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"

	"github.com/gofiber/fiber/v2"
	"gorm.io/datatypes"
)

type FaunaHandler struct {
	cfg *config.Config
}

func NewFaunaHandler(cfg *config.Config) *FaunaHandler {
	return &FaunaHandler{cfg: cfg}
}

func (h *FaunaHandler) Index(c *fiber.Ctx) error {
	query := database.DB.Model(&models.Fauna{})

	search := strings.TrimSpace(c.Query("search"))
	if search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		query = query.Where("LOWER(name) LIKE ? OR LOWER(scientific_name) LIKE ? OR LOWER(description) LIKE ?", searchPattern, searchPattern, searchPattern)
	}

	productType := strings.TrimSpace(c.Query("product_type"))
	if productType == "" {
		productType = strings.TrimSpace(c.Query("type"))
	}
	if productType != "" && productType != "all" {
		query = query.Where("product_type = ?", productType)
	}

	classFilter := strings.TrimSpace(c.Query("class"))
	if classFilter != "" && classFilter != "all" {
		query = query.Where("class = ?", classFilter)
	}

	habitatFilter := strings.TrimSpace(c.Query("habitat"))
	if habitatFilter != "" && habitatFilter != "all" {
		query = query.Where("habitat LIKE ?", "%"+habitatFilter+"%")
	}

	statusFilter := strings.TrimSpace(c.Query("status"))
	if statusFilter != "" && statusFilter != "all" {
		query = query.Where("conservation_status LIKE ?", "%"+statusFilter+"%")
	}

	var totalItems int64
	if err := query.Count(&totalItems).Error; err != nil {
		totalItems = 0
	}

	sortBy := strings.TrimSpace(c.Query("sort"))
	switch sortBy {
	case "oldest":
		query = query.Order("id asc")
	case "name_asc":
		query = query.Order("name asc")
	case "name_desc":
		query = query.Order("name desc")
	case "price_asc":
		query = query.Order("price asc")
	case "price_desc":
		query = query.Order("price desc")
	default:
		query = query.Order("id desc")
	}

	pageStr := strings.TrimSpace(c.Query("page"))
	limitStr := strings.TrimSpace(c.Query("limit"))
	if limitStr == "" {
		limitStr = strings.TrimSpace(c.Query("per_page"))
	}

	page := 1
	limit := 0

	if pageStr != "" || limitStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
			if limit > 100 {
				limit = 100
			}
		} else {
			limit = 10
		}

		offset := (page - 1) * limit
		query = query.Offset(offset).Limit(limit)
	}

	var faunas []models.Fauna
	if err := query.Find(&faunas).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat katalog.",
		})
	}

	totalPages := 1
	if limit > 0 && totalItems > 0 {
		totalPages = int((totalItems + int64(limit) - 1) / int64(limit))
		if totalPages < 1 {
			totalPages = 1
		}
	} else if totalItems > 0 {
		totalPages = 1
	}

	perPageResponse := limit
	if perPageResponse == 0 {
		perPageResponse = int(totalItems)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    faunas,
		"pagination": fiber.Map{
			"current_page": page,
			"per_page":     perPageResponse,
			"total_items":  totalItems,
			"total_pages":  totalPages,
			"has_next":     limit > 0 && page < totalPages,
			"has_prev":     page > 1,
		},
	})
}

func (h *FaunaHandler) Show(c *fiber.Ctx) error {
	id := c.Params("id")
	var fauna models.Fauna
	if err := database.DB.Preload("Sightings").First(&fauna, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Item tidak ditemukan.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    fauna,
	})
}

func (h *FaunaHandler) Store(c *fiber.Ctx) error {
	store := c.Locals("store").(*models.Store)

	// Check plan limits (Free plan max 10 items)
	var itemCount int64
	database.DB.Model(&models.Fauna{}).Where("store_id = ?", store.ID).Count(&itemCount)
	if store.Plan == "free" && itemCount >= 10 {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Batas postingan Plan Gratis telah tercapai (Maksimal 10 item). Silakan upgrade ke Plan Pro untuk posting tanpa batas!",
		})
	}

	var payload map[string]interface{}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	name, _ := payload["name"].(string)
	name = security.SanitizePlainText(name, 255)
	if name == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Nama item wajib diisi.",
		})
	}

	scientificName, _ := payload["scientific_name"].(string)
	scientificName = security.SanitizePlainText(scientificName, 255)

	class, _ := payload["class"].(string)
	class = security.SanitizePlainText(class, 100)

	habitat, _ := payload["habitat"].(string)
	habitat = security.SanitizePlainText(habitat, 100)

	diet, _ := payload["diet"].(string)
	diet = security.SanitizePlainText(diet, 100)

	status, _ := payload["conservation_status"].(string)
	status = security.SanitizePlainText(status, 100)

	priceVal, _ := payload["price"]
	price := security.ValidatePrice(parsePrice(priceVal))

	minOrder, maxOrder := security.ValidateOrderLimits(payload["min_order"], payload["max_order"])

	videoURL, _ := payload["video_url"].(string)
	videoURL = security.SanitizeVideoURL(videoURL)

	desc, _ := payload["description"].(string)
	desc = security.SanitizeRichText(desc, 50000)

	imageURL, _ := payload["image_url"].(string)
	imageURL = security.SanitizeURL(imageURL)

	productType, _ := payload["product_type"].(string)
	productType = security.SanitizePlainText(productType, 50)
	if productType == "" {
		productType = "physical"
	}

	isShipping := true
	if val, ok := payload["is_shipping_available"].(bool); ok {
		isShipping = val
	}

	detailedInfoJSON := datatypes.JSON([]byte("{}"))
	if dInfo, ok := payload["detailed_info"]; ok {
		b, _ := json.Marshal(dInfo)
		detailedInfoJSON = datatypes.JSON(b)
	}

	attributesJSON := datatypes.JSON([]byte("{}"))
	if attrs, ok := payload["attributes"]; ok {
		b, _ := json.Marshal(attrs)
		attributesJSON = datatypes.JSON(b)
	}

	fauna := models.Fauna{
		StoreID:             store.ID,
		Name:                name,
		ScientificName:      scientificName,
		Class:               class,
		Habitat:             habitat,
		Diet:                diet,
		ConservationStatus:  status,
		Price:               price,
		MinOrder:            minOrder,
		MaxOrder:            maxOrder,
		VideoURL:            videoURL,
		IsShippingAvailable: isShipping,
		Description:         desc,
		ImageURL:            imageURL,
		DetailedInfo:        detailedInfoJSON,
		ProductType:         productType,
		Attributes:          attributesJSON,
	}

	if err := database.DB.Create(&fauna).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menyimpan item katalog.",
		})
	}

	// Auto-append master values to store if new
	h.autoUpdateStoreMaster(store, productType, class, habitat, status)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Item katalog berhasil ditambahkan!",
		"data":    fauna,
	})
}

func (h *FaunaHandler) Update(c *fiber.Ctx) error {
	store := c.Locals("store").(*models.Store)
	id := c.Params("id")

	// Zero-Trust Tenant Isolation
	var fauna models.Fauna
	if err := database.DB.Where("id = ? AND store_id = ?", id, store.ID).First(&fauna).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Item tidak ditemukan atau Anda tidak memiliki akses.",
		})
	}

	var payload map[string]interface{}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	if val, ok := payload["name"].(string); ok {
		sanitizedName := security.SanitizePlainText(val, 255)
		if sanitizedName != "" {
			fauna.Name = sanitizedName
		}
	}
	if val, ok := payload["scientific_name"].(string); ok {
		fauna.ScientificName = security.SanitizePlainText(val, 255)
	}
	if val, ok := payload["class"].(string); ok {
		fauna.Class = security.SanitizePlainText(val, 100)
	}
	if val, ok := payload["habitat"].(string); ok {
		fauna.Habitat = security.SanitizePlainText(val, 100)
	}
	if val, ok := payload["diet"].(string); ok {
		fauna.Diet = security.SanitizePlainText(val, 100)
	}
	if val, ok := payload["conservation_status"].(string); ok {
		fauna.ConservationStatus = security.SanitizePlainText(val, 100)
	}
	if val, ok := payload["price"]; ok {
		fauna.Price = security.ValidatePrice(parsePrice(val))
	}

	if _, hasMin := payload["min_order"]; hasMin || payload["max_order"] != nil {
		minVal := payload["min_order"]
		if minVal == nil {
			minVal = fauna.MinOrder
		}
		maxVal := payload["max_order"]
		if _, exists := payload["max_order"]; !exists {
			maxVal = fauna.MaxOrder
		}
		minOrder, maxOrder := security.ValidateOrderLimits(minVal, maxVal)
		fauna.MinOrder = minOrder
		fauna.MaxOrder = maxOrder
	}

	if val, ok := payload["video_url"].(string); ok {
		fauna.VideoURL = security.SanitizeVideoURL(val)
	}
	if val, ok := payload["is_shipping_available"].(bool); ok {
		fauna.IsShippingAvailable = val
	}
	if val, ok := payload["description"].(string); ok {
		fauna.Description = security.SanitizeRichText(val, 50000)
	}
	if val, ok := payload["image_url"].(string); ok {
		fauna.ImageURL = security.SanitizeURL(val)
	}
	if val, ok := payload["product_type"].(string); ok && val != "" {
		fauna.ProductType = security.SanitizePlainText(val, 50)
	}

	if dInfo, ok := payload["detailed_info"]; ok {
		b, _ := json.Marshal(dInfo)
		fauna.DetailedInfo = datatypes.JSON(b)
	}
	if attrs, ok := payload["attributes"]; ok {
		b, _ := json.Marshal(attrs)
		fauna.Attributes = datatypes.JSON(b)
	}

	if err := database.DB.Save(&fauna).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui item katalog.",
		})
	}

	h.autoUpdateStoreMaster(store, fauna.ProductType, fauna.Class, fauna.Habitat, fauna.ConservationStatus)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Item katalog berhasil diperbarui!",
		"data":    fauna,
	})
}

func (h *FaunaHandler) Destroy(c *fiber.Ctx) error {
	store := c.Locals("store").(*models.Store)
	id := c.Params("id")

	// Zero-Trust Tenant Isolation
	var fauna models.Fauna
	if err := database.DB.Where("id = ? AND store_id = ?", id, store.ID).First(&fauna).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Item tidak ditemukan atau Anda tidak memiliki akses.",
		})
	}

	if err := database.DB.Delete(&fauna).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghapus item.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Item katalog berhasil dihapus.",
	})
}

func (h *FaunaHandler) autoUpdateStoreMaster(store *models.Store, productType, class, habitat, status string) {
	updated := false
	if class != "" {
		pType := strings.ToLower(strings.TrimSpace(productType))
		if pType == "" {
			pType = "physical"
		}
		store.MasterCategories = appendMasterCategory(store.MasterCategories, pType, class)
		store.MasterClasses = appendJSONString(store.MasterClasses, class)
		updated = true
	}
	if habitat != "" {
		store.MasterHabitats = appendJSONString(store.MasterHabitats, habitat)
		updated = true
	}
	if status != "" {
		store.MasterStatuses = appendJSONString(store.MasterStatuses, status)
		updated = true
	}
	if updated {
		database.DB.Save(store)
	}
}

func parsePrice(val interface{}) float64 {
	switch v := val.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case int64:
		return float64(v)
	case string:
		cleanStr := strings.ReplaceAll(strings.ReplaceAll(v, ".", ""), ",", "")
		cleanStr = strings.TrimSpace(cleanStr)
		f, _ := strconv.ParseFloat(cleanStr, 64)
		return f
	default:
		return 0
	}
}

type CulinaryTaxonomyItem struct {
	CategoryName       string   `json:"category_name"`
	Description        string   `json:"description"`
	DefaultStorageTemp string   `json:"default_storage_temp"`
	DefaultExpiredInfo string   `json:"default_expired_info"`
	DefaultShipping    string   `json:"default_shipping"`
	PortionPlaceholder string   `json:"portion_placeholder"`
	SpecificFields     []string `json:"specific_fields"`
}

func (h *FaunaHandler) GetCulinaryTaxonomy(c *fiber.Ctx) error {
	taxonomy := []CulinaryTaxonomyItem{
		{
			CategoryName:       "Makanan Siap Santap",
			Description:        "Makanan matang siap makan (dine-in, takeaway, atau kurir instan).",
			DefaultStorageTemp: "Hangat / Langsung Santap",
			DefaultExpiredInfo: "Fresh Daily (Hari Ini)",
			DefaultShipping:    "Khusus Kurir Instan / Sameday (Gojek / Grab / Maxim)",
			PortionPlaceholder: "Contoh: 1 Porsi / Paket Nasi Komplit",
			SpecificFields:     []string{"portion_size", "spicy_level", "prep_time", "serving_method", "certification"},
		},
		{
			CategoryName:       "Makanan Beku & Olahan (Frozen)",
			Description:        "Makanan beku atau olahan siap masak (dimsum, bakso, daging marinasi).",
			DefaultStorageTemp: "Beku (Freezer -18°C)",
			DefaultExpiredInfo: "3 Bulan di Freezer",
			DefaultShipping:    "Ekspedisi Cold-Chain / Paxel 1 Hari Sampai (Frozen / Makanan Segar)",
			PortionPlaceholder: "Contoh: Pack 500 gr / Box isi 10 pcs",
			SpecificFields:     []string{"portion_size", "cooking_guide", "expired_info", "storage_temp", "certification"},
		},
		{
			CategoryName:       "Minuman & Olahan Kopi",
			Description:        "Minuman segar, kopi botolan, artisan tea, atau jus.",
			DefaultStorageTemp: "Dingin (Chiller)",
			DefaultExpiredInfo: "3-7 Hari di Kulkas",
			DefaultShipping:    "Khusus Kurir Instan / Sameday (Gojek / Grab / Maxim)",
			PortionPlaceholder: "Contoh: Botol 250 ml / Literan 1000 ml / Cup 16oz",
			SpecificFields:     []string{"portion_size", "sugar_ice_options", "storage_temp", "expired_info", "certification"},
		},
		{
			CategoryName:       "Camilan, Snack & Kue Kering",
			Description:        "Makanan ringan renyah, keripik, cookies, atau camilan kering tahan lama.",
			DefaultStorageTemp: "Suhu Ruang",
			DefaultExpiredInfo: "3-6 Bulan (Kemasan Rapat)",
			DefaultShipping:    "Bisa Kirim Seluruh Indonesia (Ekspedisi Reguler / Produk Kering)",
			PortionPlaceholder: "Contoh: Pouch 200 gr / Toples 250 gr / Pack 100 gr",
			SpecificFields:     []string{"portion_size", "spicy_level", "expired_info", "storage_temp", "certification"},
		},
		{
			CategoryName:       "Bakery, Roti & Pastry",
			Description:        "Roti panggang segar, kue bolu, pastry, donat, atau cake harian.",
			DefaultStorageTemp: "Suhu Ruang",
			DefaultExpiredInfo: "3-4 Hari (Suhu Ruang)",
			DefaultShipping:    "Khusus Kurir Instan / Sameday (Gojek / Grab / Maxim)",
			PortionPlaceholder: "Contoh: 1 Loyang (Diameter 20cm) / Box isi 6 pcs / Loaf 400 gr",
			SpecificFields:     []string{"portion_size", "taste_options", "expired_info", "bake_status", "certification"},
		},
		{
			CategoryName:       "Bumbu & Bahan Masak",
			Description:        "Bumbu masakan siap pakai, saus botolan, rempah, atau minyak olahan.",
			DefaultStorageTemp: "Suhu Ruang",
			DefaultExpiredInfo: "6-12 Bulan",
			DefaultShipping:    "Bisa Kirim Seluruh Indonesia (Ekspedisi Reguler / Produk Kering)",
			PortionPlaceholder: "Contoh: Botol 250 gr / Pouch 500 gr / Pack 1 kg",
			SpecificFields:     []string{"portion_size", "serving_capacity", "expired_info", "storage_temp", "certification"},
		},
		{
			CategoryName:       "Katering & Paket Pesanan",
			Description:        "Paket pesanan porsi banyak, tumpeng, nasi boks prasmanan, meal prep.",
			DefaultStorageTemp: "Hangat / Langsung Santap",
			DefaultExpiredInfo: "Fresh Daily (Hari Acara)",
			DefaultShipping:    "Pre-Order Khusus (Katering / Acara)",
			PortionPlaceholder: "Contoh: Minimal 20 Box / Tampah 15 Porsi",
			SpecificFields:     []string{"min_order", "inclusions", "prep_time", "delivery_service", "certification"},
		},
		{
			CategoryName:       "Lainnya",
			Description:        "Produk kuliner khusus atau kombinasi lainnya.",
			DefaultStorageTemp: "Fleksibel",
			DefaultExpiredInfo: "Sesuai Kemasan",
			DefaultShipping:    "Bisa Kirim Seluruh Indonesia (Ekspedisi Reguler / Produk Kering)",
			PortionPlaceholder: "Contoh: 1 Unit / Pack / Box",
			SpecificFields:     []string{"portion_size", "expired_info", "storage_temp", "certification"},
		},
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    taxonomy,
	})
}
