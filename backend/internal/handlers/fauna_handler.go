package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"

	"github.com/disintegration/imaging"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
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
		query = query.Where("LOWER(name) LIKE ? OR LOWER(scientific_name) LIKE ?", searchPattern, searchPattern)
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
	if err := query.Order("name asc").Find(&faunas).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat katalog.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    faunas,
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

func (h *FaunaHandler) UploadImage(c *fiber.Ctx) error {
	file, err := c.FormFile("image")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "File gambar wajib diunggah.",
		})
	}

	// Max 10MB upload limit
	if file.Size > 10*1024*1024 {
		return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{
			"success": false,
			"message": "Ukuran gambar maksimal 10MB.",
		})
	}

	src, err := file.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal membuka file unggahan.",
		})
	}
	defer src.Close()

	fileBytes, err := io.ReadAll(src)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal membaca konten file.",
		})
	}

	// 1. Magic Number Content-Type Validation (Anti-MIME Spoofing)
	mimeType := http.DetectContentType(fileBytes[:min(512, len(fileBytes))])
	if !strings.HasPrefix(mimeType, "image/") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format file tidak valid. Hanya gambar yang diperbolehkan.",
		})
	}

	// 2. EXIF Stripping & Re-encoding via imaging library
	img, _, err := image.Decode(bytes.NewReader(fileBytes))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mendekode gambar.",
		})
	}

	// Resize max dimension to 1200px
	bounds := img.Bounds()
	if bounds.Dx() > 1200 || bounds.Dy() > 1200 {
		img = imaging.Fit(img, 1200, 1200, imaging.Lanczos)
	}

	// Prepare storage destination
	storageDir := filepath.Join(h.cfg.StorageDir, "fauna")
	_ = os.MkdirAll(storageDir, 0755)

	safeFilename := uuid.New().String() + ".jpg"
	targetFilePath := filepath.Join(storageDir, safeFilename)

	out, err := os.Create(targetFilePath)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menyimpan file ke penyimpanan.",
		})
	}
	defer out.Close()

	// Re-encode JPEG with 85 quality (clean of any EXIF payload)
	if err := jpeg.Encode(out, img, &jpeg.Options{Quality: 85}); err != nil {
		// Fallback to PNG if JPEG encode fails
		_ = png.Encode(out, img)
	}

	fileURL := fmt.Sprintf("%s/storage/fauna/%s", h.cfg.AppURL, safeFilename)

	return c.JSON(fiber.Map{
		"success": true,
		"url":     fileURL,
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
	if strings.TrimSpace(name) == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Nama item wajib diisi.",
		})
	}

	scientificName, _ := payload["scientific_name"].(string)
	class, _ := payload["class"].(string)
	habitat, _ := payload["habitat"].(string)
	diet, _ := payload["diet"].(string)
	status, _ := payload["conservation_status"].(string)
	priceVal, _ := payload["price"]
	videoURL, _ := payload["video_url"].(string)
	desc, _ := payload["description"].(string)
	imageURL, _ := payload["image_url"].(string)
	productType, _ := payload["product_type"].(string)
	if productType == "" {
		productType = "physical"
	}

	price := parsePrice(priceVal)

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
		Name:                strings.TrimSpace(name),
		ScientificName:      strings.TrimSpace(scientificName),
		Class:               strings.TrimSpace(class),
		Habitat:             strings.TrimSpace(habitat),
		Diet:                strings.TrimSpace(diet),
		ConservationStatus:  strings.TrimSpace(status),
		Price:               price,
		VideoURL:            strings.TrimSpace(videoURL),
		IsShippingAvailable: isShipping,
		Description:         strings.TrimSpace(desc),
		ImageURL:            strings.TrimSpace(imageURL),
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
	h.autoUpdateStoreMaster(store, class, habitat, status)

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

	if val, ok := payload["name"].(string); ok && strings.TrimSpace(val) != "" {
		fauna.Name = strings.TrimSpace(val)
	}
	if val, ok := payload["scientific_name"].(string); ok {
		fauna.ScientificName = strings.TrimSpace(val)
	}
	if val, ok := payload["class"].(string); ok {
		fauna.Class = strings.TrimSpace(val)
	}
	if val, ok := payload["habitat"].(string); ok {
		fauna.Habitat = strings.TrimSpace(val)
	}
	if val, ok := payload["diet"].(string); ok {
		fauna.Diet = strings.TrimSpace(val)
	}
	if val, ok := payload["conservation_status"].(string); ok {
		fauna.ConservationStatus = strings.TrimSpace(val)
	}
	if val, ok := payload["price"]; ok {
		fauna.Price = parsePrice(val)
	}
	if val, ok := payload["video_url"].(string); ok {
		fauna.VideoURL = strings.TrimSpace(val)
	}
	if val, ok := payload["is_shipping_available"].(bool); ok {
		fauna.IsShippingAvailable = val
	}
	if val, ok := payload["description"].(string); ok {
		fauna.Description = strings.TrimSpace(val)
	}
	if val, ok := payload["image_url"].(string); ok {
		fauna.ImageURL = strings.TrimSpace(val)
	}
	if val, ok := payload["product_type"].(string); ok && val != "" {
		fauna.ProductType = strings.TrimSpace(val)
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

	h.autoUpdateStoreMaster(store, fauna.Class, fauna.Habitat, fauna.ConservationStatus)

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

func (h *FaunaHandler) autoUpdateStoreMaster(store *models.Store, class, habitat, status string) {
	updated := false
	if class != "" {
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

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
