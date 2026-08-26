package handlers

import (
	"encoding/json"
	"strings"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"

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
			"message": "Katalog / Store tidak ditemukan.",
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
			"message": "Katalog / Store tidak ditemukan.",
		})
	}

	query := database.DB.Model(&models.Fauna{}).Where("store_id = ?", store.ID)

	search := strings.TrimSpace(c.Query("search"))
	if search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		query = query.Where("LOWER(name) LIKE ? OR LOWER(scientific_name) LIKE ? OR LOWER(description) LIKE ?", searchPattern, searchPattern, searchPattern)
	}

	classFilter := strings.TrimSpace(c.Query("class"))
	if classFilter != "" && classFilter != "all" {
		query = query.Where("class = ?", classFilter)
	}

	habitatFilter := strings.TrimSpace(c.Query("habitat"))
	if habitatFilter != "" && habitatFilter != "all" {
		query = query.Where("habitat LIKE ?", "%"+habitatFilter+"%")
	}

	var faunas []models.Fauna
	if err := query.Order("id asc").Find(&faunas).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat katalog item.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    faunas,
	})
}

func (h *StoreHandler) CheckSlug(c *fiber.Ctx) error {
	slug := cleanSlug(c.Params("slug"))
	if len(slug) < 3 {
		return c.JSON(fiber.Map{
			"available": false,
			"message":   "Slug minimal 3 karakter.",
		})
	}

	var count int64
	database.DB.Model(&models.Store{}).Where("LOWER(slug) = ?", slug).Count(&count)

	return c.JSON(fiber.Map{
		"available": count == 0,
		"slug":      slug,
	})
}

func (h *StoreHandler) FeaturedStores(c *fiber.Ctx) error {
	var stores []models.Store
	database.DB.Order("id asc").Limit(12).Find(&stores)

	type FeaturedStoreResult struct {
		ID           uint   `json:"id"`
		Slug         string `json:"slug"`
		StoreTitle   string `json:"store_title"`
		StoreSlogan  string `json:"store_slogan"`
		StoreLogoURL string `json:"store_logo_url"`
		StoreTheme   string `json:"store_theme"`
		ItemCount    int64  `json:"item_count"`
	}

	var results []FeaturedStoreResult
	for _, s := range stores {
		var cnt int64
		database.DB.Model(&models.Fauna{}).Where("store_id = ?", s.ID).Count(&cnt)
		results = append(results, FeaturedStoreResult{
			ID:           s.ID,
			Slug:         s.Slug,
			StoreTitle:   s.StoreTitle,
			StoreSlogan:  s.StoreSlogan,
			StoreLogoURL: s.StoreLogoURL,
			StoreTheme:   s.StoreTheme,
			ItemCount:    cnt,
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    results,
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
		store.StoreTitle = strings.TrimSpace(val)
	}
	if val, ok := payload["store_slogan"].(string); ok {
		store.StoreSlogan = strings.TrimSpace(val)
	}
	if val, ok := payload["promo_banner"].(string); ok {
		store.PromoBanner = strings.TrimSpace(val)
	}
	if val, ok := payload["whatsapp_number"].(string); ok {
		store.WhatsappNumber = strings.TrimSpace(val)
	}
	if val, ok := payload["official_website"].(string); ok {
		store.OfficialWebsite = strings.TrimSpace(val)
	}
	if val, ok := payload["store_logo_url"].(string); ok {
		store.StoreLogoURL = strings.TrimSpace(val)
	}
	if val, ok := payload["store_theme"].(string); ok && val != "" {
		store.StoreTheme = strings.TrimSpace(val)
	}
	if val, ok := payload["about_title"].(string); ok {
		store.AboutTitle = strings.TrimSpace(val)
	}
	if val, ok := payload["about_slogan"].(string); ok {
		store.AboutSlogan = strings.TrimSpace(val)
	}
	if val, ok := payload["about_description"].(string); ok {
		store.AboutDescription = strings.TrimSpace(val)
	}
	if val, ok := payload["about_location"].(string); ok {
		store.AboutLocation = strings.TrimSpace(val)
	}
	if val, ok := payload["about_hours"].(string); ok {
		store.AboutHours = strings.TrimSpace(val)
	}
	if val, ok := payload["show_hours"].(bool); ok {
		store.ShowHours = val
	}
	if val, ok := payload["about_disclaimer"].(string); ok {
		store.AboutDisclaimer = strings.TrimSpace(val)
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
		store.AboutCards = datatypes.JSON(b)
	}
	if links, ok := payload["social_links"]; ok {
		b, _ := json.Marshal(links)
		store.SocialLinks = datatypes.JSON(b)
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
		Field string `json:"field"`
		Value string `json:"value"`
	}
	if err := c.BodyParser(&req); err != nil || req.Value == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Field dan Value wajib diisi.",
		})
	}

	val := strings.TrimSpace(req.Value)
	switch req.Field {
	case "class", "master_classes":
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
		Field    string `json:"field"`
		OldValue string `json:"old_value"`
		NewValue string `json:"new_value"`
	}
	if err := c.BodyParser(&req); err != nil || req.OldValue == "" || req.NewValue == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "OldValue dan NewValue wajib diisi.",
		})
	}

	oldVal := strings.TrimSpace(req.OldValue)
	newVal := strings.TrimSpace(req.NewValue)

	switch req.Field {
	case "class", "master_classes":
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
	case "class", "master_classes":
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
		classes = []string{"Pakaian & Busana", "Aksesoris & Fashion", "Gadget & Elektronik", "Kebutuhan Rumah Tangga", "Kerajinan Tangan"}
		habitats = []string{"Item Baru (Ready Stock)", "Pre-Order (PO)", "Varian Koleksi Khusus"}
		statuses = []string{"Tersedia (Ready Stock)", "Habis (Sold Out)", "Stok Terbatas (Limited)"}
		shipping = []string{"Bisa Kirim Seluruh Indonesia", "Jabodetabek Saja", "Ambil Sendiri di Toko"}
	case "digital":
		classes = []string{"E-Book & Panduan", "Source Code & Script", "Template Desain", "Video & Audio Materi", "Tools & Aset Digital"}
		habitats = []string{"Instant Download", "Akses Cloud / Web", "Lisensi Sekali Beli"}
		statuses = []string{"Tersedia (Aktif)", "Maintenance / Update", "Arsip (Tidak Dijual)"}
		shipping = []string{"Kirim via Email & Link Download", "Akses Portal Anggota"}
	case "fauna":
		classes = []string{"Reptil & Amfibi", "Ikan Hias & Aquascape", "Burung Kicau & Unggas", "Mamalia Hias", "Pakan & Perlengkapan"}
		habitats = []string{"Air Tawar", "Air Laut", "Darat (Terestrial)", "Arboreal (Pohon)"}
		statuses = []string{"Tersedia (For Sale)", "Terpesan (Booked)", "Habis Terjual (Sold Out)"}
		shipping = []string{"Bisa Kirim se-Indonesia (Garansi DoA)", "Pulau Jawa Saja", "Ambil Sendiri di Toko (No Shipping)"}
	case "service":
		classes = []string{"Konsultasi & Advice", "Desain & Kreatif", "Perbaikan & Servis", "Kursus & Pelatihan", "Pembuatan Web & Aplikasi"}
		habitats = []string{"Layanan Online / Remote", "Datang ke Lokasi Klien", "Datang ke Workshop / Kantor"}
		statuses = []string{"Jadwal Tersedia", "Jadwal Penuh (Booked)", "Libur / Tutup Sementara"}
		shipping = []string{"Layanan Digital / Online", "Area Jabodetabek", "Area Seluruh Indonesia"}
	case "food":
		classes = []string{"Makanan Utama / Berat", "Camilan & Snack", "Minuman Segar & Kopi", "Frozen Food Siap Masak", "Paket Katering"}
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
