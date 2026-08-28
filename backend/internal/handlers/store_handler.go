package handlers

import (
	"encoding/json"
	"strconv"
	"strings"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"

	"github.com/gofiber/fiber/v2"
	"gorm.io/datatypes"
)

type StoreHandler struct{}

func NewStoreHandler() *StoreHandler {
	return &StoreHandler{}
}

func (h *StoreHandler) ShowStore(c *fiber.Ctx) error {
	slug := strings.ToLower(strings.TrimSpace(c.Params("slug")))
	if slug == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Slug toko tidak valid.",
		})
	}

	var store models.Store
	if err := database.DB.Where("LOWER(slug) = ?", slug).First(&store).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Toko tidak ditemukan.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    store,
	})
}

func (h *StoreHandler) IndexFauna(c *fiber.Ctx) error {
	slug := strings.ToLower(strings.TrimSpace(c.Params("slug")))
	var store models.Store
	if err := database.DB.Where("LOWER(slug) = ?", slug).First(&store).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Toko tidak ditemukan.",
		})
	}

	query := database.DB.Model(&models.Fauna{}).Where("store_id = ?", store.ID)

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

	// Count total records matching criteria
	var totalItems int64
	if err := query.Count(&totalItems).Error; err != nil {
		totalItems = 0
	}

	// Sorting
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
		// Default: newest first
		query = query.Order("id desc")
	}

	// Server-Side Pagination
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
			limit = 10 // Default per page when page is requested
		}

		offset := (page - 1) * limit
		query = query.Offset(offset).Limit(limit)
	}

	var faunas []models.Fauna
	if err := query.Find(&faunas).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat katalog toko.",
		})
	}

	totalPages := 0
	if limit > 0 && totalItems > 0 {
		totalPages = int((totalItems + int64(limit) - 1) / int64(limit))
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
		"store": fiber.Map{
			"id":             store.ID,
			"slug":           store.Slug,
			"store_title":    store.StoreTitle,
			"store_theme":    store.StoreTheme,
			"store_logo_url": store.StoreLogoURL,
		},
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

func (h *StoreHandler) CheckSlug(c *fiber.Ctx) error {
	slug := cleanSlug(c.Params("slug"))
	if len(slug) < 3 {
		return c.JSON(fiber.Map{
			"available": false,
			"message":   "Nama pengguna minimal 3 karakter.",
		})
	}

	reservedWords := []string{"admin", "api", "sanctum", "desktop", "mobile", "assets", "login", "register", "terms", "privacy", "acceptable-use", "settings"}
	for _, r := range reservedWords {
		if slug == r {
			return c.JSON(fiber.Map{
				"available": false,
				"message":   "Nama pengguna ini telah digunakan oleh sistem.",
			})
		}
	}

	var count int64
	database.DB.Model(&models.Store{}).Where("LOWER(slug) = ?", slug).Count(&count)

	return c.JSON(fiber.Map{
		"available": count == 0,
		"slug":      slug,
		"message":   map[bool]string{true: "Nama pengguna tersedia!", false: "Nama pengguna sudah terpakai."}[count == 0],
	})
}

func (h *StoreHandler) FeaturedStores(c *fiber.Ctx) error {
	var stores []models.Store
	database.DB.Order("created_at desc").Limit(12).Find(&stores)

	type StoreCard struct {
		ID             uint   `json:"id"`
		Slug           string `json:"slug"`
		StoreTitle     string `json:"store_title"`
		StoreSlogan    string `json:"store_slogan"`
		StoreLogoURL   string `json:"store_logo_url"`
		StoreTheme     string `json:"store_theme"`
		Plan           string `json:"plan"`
		ItemCount      int64  `json:"item_count"`
		WhatsappNumber string `json:"whatsapp_number"`
	}

	var result []StoreCard
	for _, s := range stores {
		var cnt int64
		database.DB.Model(&models.Fauna{}).Where("store_id = ?", s.ID).Count(&cnt)
		result = append(result, StoreCard{
			ID:             s.ID,
			Slug:           s.Slug,
			StoreTitle:     s.StoreTitle,
			StoreSlogan:    s.StoreSlogan,
			StoreLogoURL:   s.StoreLogoURL,
			StoreTheme:     s.StoreTheme,
			Plan:           s.Plan,
			ItemCount:      cnt,
			WhatsappNumber: s.WhatsappNumber,
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    result,
	})
}

func (h *StoreHandler) UpdateStore(c *fiber.Ctx) error {
	store := c.Locals("store").(*models.Store)

	var payload map[string]interface{}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	if val, ok := payload["store_title"].(string); ok {
		store.StoreTitle = security.SanitizePlainText(val, 255)
	}
	if val, ok := payload["store_slogan"].(string); ok {
		store.StoreSlogan = security.SanitizePlainText(val, 500)
	}
	if val, ok := payload["promo_banner"].(string); ok {
		store.PromoBanner = security.SanitizeRichText(val, 2000)
	}
	if val, ok := payload["whatsapp_number"].(string); ok {
		store.WhatsappNumber = security.SanitizePhone(val)
	}
	if val, ok := payload["official_website"].(string); ok {
		store.OfficialWebsite = security.SanitizeURL(val)
	}
	if val, ok := payload["store_logo_url"].(string); ok {
		store.StoreLogoURL = security.SanitizeURL(val)
	}
	if val, ok := payload["store_theme"].(string); ok && val != "" {
		store.StoreTheme = security.SanitizePlainText(val, 50)
	}
	if val, ok := payload["about_title"].(string); ok {
		store.AboutTitle = security.SanitizePlainText(val, 255)
	}
	if val, ok := payload["about_slogan"].(string); ok {
		store.AboutSlogan = security.SanitizePlainText(val, 500)
	}
	if val, ok := payload["about_description"].(string); ok {
		store.AboutDescription = security.SanitizeRichText(val, 50000)
	}
	if val, ok := payload["about_location"].(string); ok {
		store.AboutLocation = security.SanitizePlainText(val, 500)
	}
	if val, ok := payload["about_hours"].(string); ok {
		store.AboutHours = security.SanitizePlainText(val, 500)
	}
	if val, ok := payload["show_hours"].(bool); ok {
		store.ShowHours = val
	}
	if val, ok := payload["about_disclaimer"].(string); ok {
		store.AboutDisclaimer = security.SanitizeRichText(val, 10000)
	}
	if val, ok := payload["enable_wa_direct"].(bool); ok {
		store.EnableWADirect = val
	}
	if val, ok := payload["enable_wa_rekber"].(bool); ok {
		store.EnableWARekber = val
	}

	// JSON fields
	if cards, ok := payload["about_cards"]; ok {
		b, _ := json.Marshal(cards)
		store.AboutCards = datatypes.JSON([]byte(security.SanitizeSocialLinks(string(b))))
	}
	if links, ok := payload["social_links"]; ok {
		b, _ := json.Marshal(links)
		store.SocialLinks = datatypes.JSON([]byte(security.SanitizeSocialLinks(string(b))))
	}

	if err := database.DB.Save(store).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui profil toko.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Profil toko berhasil diperbarui.",
		"data":    store,
	})
}

func (h *StoreHandler) UpgradePlan(c *fiber.Ctx) error {
	store := c.Locals("store").(*models.Store)

	var req struct {
		Plan string `json:"plan"`
	}
	_ = c.BodyParser(&req)

	targetPlan := "pro"
	if req.Plan != "" {
		targetPlan = strings.ToLower(req.Plan)
	}

	store.Plan = targetPlan
	store.PaymentStatus = "paid"
	database.DB.Save(store)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Selamat! Akun toko Anda telah berhasil di-upgrade ke Plan Pro.",
		"data":    store,
	})
}

func (h *StoreHandler) AddMasterOption(c *fiber.Ctx) error {
	store := c.Locals("store").(*models.Store)

	var req struct {
		Field       string `json:"field"`
		Value       string `json:"value"`
		ProductType string `json:"product_type"`
	}
	if err := c.BodyParser(&req); err != nil || req.Value == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Field dan Value wajib diisi.",
		})
	}

	val := security.SanitizePlainText(req.Value, 100)
	if val == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Value tidak boleh kosong.",
		})
	}
	switch req.Field {
	case "class", "master_classes", "category", "master_categories":
		if req.ProductType != "" {
			store.MasterCategories = appendMasterCategory(store.MasterCategories, security.SanitizePlainText(req.ProductType, 50), val)
		}
		store.MasterClasses = appendJSONString(store.MasterClasses, val)
	case "habitat", "master_habitats":
		store.MasterHabitats = appendJSONString(store.MasterHabitats, val)
	case "conservation_status", "master_statuses":
		store.MasterStatuses = appendJSONString(store.MasterStatuses, val)
	case "shipping_coverage", "master_shipping_coverages":
		store.MasterShippingCoverages = appendJSONString(store.MasterShippingCoverages, val)
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Field master data tidak dikenali.",
		})
	}

	database.DB.Save(store)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Opsi master data berhasil ditambahkan.",
		"data":    store,
	})
}

func (h *StoreHandler) RenameMasterOption(c *fiber.Ctx) error {
	store := c.Locals("store").(*models.Store)

	var req struct {
		Field       string `json:"field"`
		OldValue    string `json:"old_value"`
		NewValue    string `json:"new_value"`
		ProductType string `json:"product_type"`
	}
	if err := c.BodyParser(&req); err != nil || req.OldValue == "" || req.NewValue == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "OldValue dan NewValue wajib diisi.",
		})
	}

	oldVal := security.SanitizePlainText(req.OldValue, 100)
	newVal := security.SanitizePlainText(req.NewValue, 100)
	prodType := security.SanitizePlainText(req.ProductType, 50)

	switch req.Field {
	case "class", "master_classes", "category", "master_categories":
		if prodType != "" {
			store.MasterCategories = replaceMasterCategory(store.MasterCategories, prodType, oldVal, newVal)
		}
		store.MasterClasses = replaceJSONString(store.MasterClasses, oldVal, newVal)
		database.DB.Model(&models.Fauna{}).Where("store_id = ? AND class = ?", store.ID, oldVal).Update("class", newVal)
	case "habitat", "master_habitats":
		store.MasterHabitats = replaceJSONString(store.MasterHabitats, oldVal, newVal)
		database.DB.Model(&models.Fauna{}).Where("store_id = ? AND habitat = ?", store.ID, oldVal).Update("habitat", newVal)
	case "conservation_status", "master_statuses":
		store.MasterStatuses = replaceJSONString(store.MasterStatuses, oldVal, newVal)
		database.DB.Model(&models.Fauna{}).Where("store_id = ? AND conservation_status = ?", store.ID, oldVal).Update("conservation_status", newVal)
	case "shipping_coverage", "master_shipping_coverages":
		store.MasterShippingCoverages = replaceJSONString(store.MasterShippingCoverages, oldVal, newVal)
	}

	database.DB.Save(store)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Opsi master data dan item katalog terkait berhasil diperbarui.",
		"data":    store,
	})
}

func (h *StoreHandler) DeleteMasterOption(c *fiber.Ctx) error {
	store := c.Locals("store").(*models.Store)

	var req struct {
		Field             string `json:"field"`
		Value             string `json:"value"`
		ReplacementOption string `json:"replacement_option"`
		ProductType       string `json:"product_type"`
	}
	if err := c.BodyParser(&req); err != nil || req.Value == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Value wajib diisi.",
		})
	}

	val := strings.TrimSpace(req.Value)
	replacement := strings.TrimSpace(req.ReplacementOption)

	switch req.Field {
	case "class", "master_classes", "category", "master_categories":
		if req.ProductType != "" {
			store.MasterCategories = removeMasterCategory(store.MasterCategories, req.ProductType, val)
		}
		store.MasterClasses = removeJSONString(store.MasterClasses, val)
		if replacement != "" {
			database.DB.Model(&models.Fauna{}).Where("store_id = ? AND class = ?", store.ID, val).Update("class", replacement)
		}
	case "habitat", "master_habitats":
		store.MasterHabitats = removeJSONString(store.MasterHabitats, val)
		if replacement != "" {
			database.DB.Model(&models.Fauna{}).Where("store_id = ? AND habitat = ?", store.ID, val).Update("habitat", replacement)
		}
	case "conservation_status", "master_statuses":
		store.MasterStatuses = removeJSONString(store.MasterStatuses, val)
		if replacement != "" {
			database.DB.Model(&models.Fauna{}).Where("store_id = ? AND conservation_status = ?", store.ID, val).Update("conservation_status", replacement)
		}
	case "shipping_coverage", "master_shipping_coverages":
		store.MasterShippingCoverages = removeJSONString(store.MasterShippingCoverages, val)
	}

	database.DB.Save(store)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Opsi master data berhasil dihapus.",
		"data":    store,
	})
}

func (h *StoreHandler) ApplyMasterPreset(c *fiber.Ctx) error {
	store := c.Locals("store").(*models.Store)

	var req struct {
		Preset string `json:"preset"`
	}
	if err := c.BodyParser(&req); err != nil || req.Preset == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Preset wajib ditentukan.",
		})
	}

	var classes, habitats, statuses, shipping []string

	switch strings.ToLower(req.Preset) {
	case "physical":
		classes = []string{"Pakaian & Fashion", "Aksesoris & Gadget", "Elektronik & Komputer", "Perlengkapan Rumah", "Kerajinan & Kriya", "Koleksi & Hobi", "Lainnya"}
		habitats = []string{"Item Baru (Ready Stock)", "Pre-Order (PO)", "Varian Koleksi Khusus"}
		statuses = []string{"Tersedia (Ready Stock)", "Habis (Sold Out)", "Stok Terbatas (Limited)"}
		shipping = []string{"Bisa Kirim Seluruh Indonesia", "Jabodetabek Saja", "Ambil Sendiri di Toko"}
	case "digital":
		classes = []string{"E-Book & Dokumen", "Template Desain", "Preset & Audio", "Source Code & Software", "Video Kursus", "Foto & Ilustrasi", "Lainnya"}
		habitats = []string{"Instant Download", "Akses Cloud / Web", "Lisensi Sekali Beli"}
		statuses = []string{"Tersedia (Aktif)", "Maintenance / Update", "Arsip (Tidak Dijual)"}
		shipping = []string{"Kirim via Email & Link Download", "Akses Portal Anggota"}
	case "fauna":
		classes = []string{"Ikan Hias", "Reptil & Amphibi", "Burung & Unggas", "Mamalia Kecil", "Kucing & Anjing", "Serangga & Arthropoda", "Pakan & Perlengkapan", "Lainnya"}
		habitats = []string{"Air Tawar", "Air Laut", "Darat (Terestrial)", "Arboreal (Pohon)"}
		statuses = []string{"Tersedia (For Sale)", "Terpesan (Booked)", "Habis Terjual (Sold Out)"}
		shipping = []string{"Bisa Kirim se-Indonesia (Garansi DoA)", "Pulau Jawa Saja", "Ambil Sendiri di Toko (No Shipping)"}
	case "service":
		classes = []string{"Jasa Desain & Kreatif", "Konsultasi & Bisnis", "Reparasi & Servis", "Fotografi & Video", "Pendidikan & Les", "Kecantikan & Perawatan", "Lainnya"}
		habitats = []string{"Layanan Online / Remote", "Datang ke Lokasi Klien", "Datang ke Workshop / Kantor"}
		statuses = []string{"Jadwal Tersedia", "Jadwal Penuh (Booked)", "Libur / Tutup Sementara"}
		shipping = []string{"Layanan Digital / Online", "Area Jabodetabek", "Area Seluruh Indonesia"}
	case "food":
		classes = []string{"Makanan Siap Santap", "Minuman & Kopi", "Snack & Makanan Kering", "Bakery, Roti & Pastry", "Bumbu & Bahan Masak", "Katering & Paket Pesanan", "Lainnya"}
		habitats = []string{"Freshly Cooked", "Frozen Food", "Kemasan Tahan Lama"}
		statuses = []string{"Menu Tersedia", "Habis untuk Hari Ini", "Menu Spesial Musiman"}
		shipping = []string{"Kurir Instan / Sameday", "Dine-In & Take Away", "Bisa Kirim Luar Kota (Frozen)"}
	default:
		classes = []string{"Kategori Utama", "Koleksi Populer", "Item Unggulan", "Varian Baru", "Promo Spesial"}
		habitats = []string{"Standar", "Koleksi Terbatas", "Edisi Khusus"}
		statuses = []string{"Tersedia", "Habis", "Segera Hadir"}
		shipping = []string{"Kirim Seluruh Indonesia", "Ambil di Toko"}
	}

	bClasses, _ := json.Marshal(classes)
	bHabitats, _ := json.Marshal(habitats)
	bStatuses, _ := json.Marshal(statuses)
	bShipping, _ := json.Marshal(shipping)

	store.MasterClasses = datatypes.JSON(bClasses)
	store.MasterHabitats = datatypes.JSON(bHabitats)
	store.MasterStatuses = datatypes.JSON(bStatuses)
	store.MasterShippingCoverages = datatypes.JSON(bShipping)

	database.DB.Save(store)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Template Master Data berhasil diterapkan.",
		"data":    store,
	})
}

// Helper MasterCategories JSON map functions
func appendMasterCategory(raw datatypes.JSON, pType, val string) datatypes.JSON {
	pType = strings.ToLower(strings.TrimSpace(pType))
	if pType == "" {
		pType = "physical"
	}
	catMap := make(map[string][]string)
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &catMap)
	}
	if catMap == nil {
		catMap = make(map[string][]string)
	}
	list := catMap[pType]
	for _, item := range list {
		if strings.EqualFold(item, val) {
			b, _ := json.Marshal(catMap)
			return datatypes.JSON(b)
		}
	}
	catMap[pType] = append(list, val)
	b, _ := json.Marshal(catMap)
	return datatypes.JSON(b)
}

func replaceMasterCategory(raw datatypes.JSON, pType, oldVal, newVal string) datatypes.JSON {
	pType = strings.ToLower(strings.TrimSpace(pType))
	if pType == "" {
		pType = "physical"
	}
	catMap := make(map[string][]string)
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &catMap)
	}
	if catMap == nil {
		return raw
	}
	list := catMap[pType]
	for i, item := range list {
		if strings.EqualFold(item, oldVal) {
			list[i] = newVal
		}
	}
	catMap[pType] = list
	b, _ := json.Marshal(catMap)
	return datatypes.JSON(b)
}

func removeMasterCategory(raw datatypes.JSON, pType, val string) datatypes.JSON {
	pType = strings.ToLower(strings.TrimSpace(pType))
	if pType == "" {
		pType = "physical"
	}
	catMap := make(map[string][]string)
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &catMap)
	}
	if catMap == nil {
		return raw
	}
	list := catMap[pType]
	var updated []string
	for _, item := range list {
		if !strings.EqualFold(item, val) {
			updated = append(updated, item)
		}
	}
	catMap[pType] = updated
	b, _ := json.Marshal(catMap)
	return datatypes.JSON(b)
}

// Helper JSON string array functions
func appendJSONString(jsonBytes datatypes.JSON, val string) datatypes.JSON {
	var arr []string
	_ = json.Unmarshal(jsonBytes, &arr)
	for _, item := range arr {
		if strings.EqualFold(item, val) {
			return jsonBytes
		}
	}
	arr = append(arr, val)
	b, _ := json.Marshal(arr)
	return datatypes.JSON(b)
}

func replaceJSONString(jsonBytes datatypes.JSON, oldVal, newVal string) datatypes.JSON {
	var arr []string
	_ = json.Unmarshal(jsonBytes, &arr)
	for i, item := range arr {
		if strings.EqualFold(item, oldVal) {
			arr[i] = newVal
		}
	}
	b, _ := json.Marshal(arr)
	return datatypes.JSON(b)
}

func removeJSONString(jsonBytes datatypes.JSON, val string) datatypes.JSON {
	var arr []string
	_ = json.Unmarshal(jsonBytes, &arr)
	var newArr []string
	for _, item := range arr {
		if !strings.EqualFold(item, val) {
			newArr = append(newArr, item)
		}
	}
	b, _ := json.Marshal(newArr)
	return datatypes.JSON(b)
}
