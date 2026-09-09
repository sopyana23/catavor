package handlers

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type ProductHandler struct {
	cfg *config.Config
}

func NewProductHandler(cfg *config.Config) *ProductHandler {
	return &ProductHandler{cfg: cfg}
}

type ProductRequest struct {
	Name                string                 `json:"name"`
	ScientificName      string                 `json:"scientific_name"`
	Class               string                 `json:"class"`
	CategoryID          *uint                  `json:"category_id"`
	Habitat             string                 `json:"habitat"`
	Diet                string                 `json:"diet"`
	ConservationStatus  string                 `json:"conservation_status"`
	Price               float64                `json:"price"`
	MinOrder            int                    `json:"min_order"`
	MaxOrder            *int                   `json:"max_order"`
	VideoURL            string                 `json:"video_url"`
	IsShippingAvailable *bool                  `json:"is_shipping_available"`
	Description         string                 `json:"description"`
	ImageURL            string                 `json:"image_url"`
	DetailedInfo        map[string]interface{} `json:"detailed_info"`
	ProductType         string                 `json:"product_type"`
	Attributes          map[string]interface{} `json:"attributes"`
	GalleryImages       []string               `json:"gallery_images"`
	IsActive            *bool                  `json:"is_active"`
	Variants            []struct {
		VariantName   string   `json:"variant_name"`
		SKU           string   `json:"sku"`
		PriceOverride *float64 `json:"price_override"`
		StockQty      int      `json:"stock_qty"`
	} `json:"variants"`
}

// Index returns a list of products with optional search, category, and type filters.
func (h *ProductHandler) Index(c *fiber.Ctx) error {
	var storeID uint
	isMerchantView := false

	if storeVal, ok := c.Locals("store").(*models.Store); ok && storeVal != nil {
		storeID = storeVal.ID
		isMerchantView = true
	} else if slug := c.Params("slug"); slug != "" {
		var store models.Store
		if err := database.DB.Where("LOWER(slug) = ?", strings.ToLower(slug)).First(&store).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"message": "Toko tidak ditemukan.",
			})
		}
		storeID = store.ID
	}

	query := database.DB.Model(&models.Product{}).Preload("Category").Preload("Images").Preload("Variants")
	if storeID > 0 {
		query = query.Where("products.store_id = ?", storeID)
	}

	// Status filter: for merchant dashboard allow 'all', 'active', 'archived'. For public always active only.
	statusFilter := strings.ToLower(strings.TrimSpace(c.Query("status")))
	if isMerchantView && (statusFilter == "all" || statusFilter == "archived") {
		if statusFilter == "archived" {
			query = query.Where("products.is_active = ?", false)
		}
	} else {
		// Public storefront default: only active products
		query = query.Where("products.is_active = ?", true)
	}

	if search := strings.TrimSpace(c.Query("search")); search != "" {
		searchTerm := "%" + strings.ToLower(search) + "%"
		query = query.Where("LOWER(products.name) LIKE ? OR LOWER(products.description) LIKE ? OR LOWER(products.class) LIKE ?", searchTerm, searchTerm, searchTerm)
	}

	if class := c.Query("class"); class != "" && class != "Semua" && class != "all" {
		query = query.Where("products.class = ?", class)
	}

	if categoryID := c.Query("category_id"); categoryID != "" {
		if catID, err := strconv.ParseUint(categoryID, 10, 32); err == nil {
			query = query.Where("products.category_id = ?", uint(catID))
		}
	}

	if pType := c.Query("product_type"); pType != "" && pType != "all" {
		query = query.Where("products.product_type = ?", pType)
	}

	if habitat := c.Query("habitat"); habitat != "" && habitat != "Semua" {
		query = query.Where("products.habitat = ?", habitat)
	}

	var products []models.Product
	if err := query.Order("products.id DESC").Find(&products).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil data produk.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"count":   len(products),
		"data":    products,
	})
}

// Show returns details of a single product.
func (h *ProductHandler) Show(c *fiber.Ctx) error {
	id := c.Params("id")
	var product models.Product

	if err := database.DB.Preload("Category").Preload("Images").Preload("Variants").Preload("Store").First(&product, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Produk tidak ditemukan.",
		})
	}

	// Increment view count
	database.DB.Model(&product).UpdateColumn("view_count", gormExpr("view_count + 1"))

	return c.JSON(fiber.Map{
		"success": true,
		"data":    product,
	})
}

func gormExpr(expr string) interface{} {
	return gorm.Expr(expr)
}

// Store creates a new product with dynamic JSONB attributes, multi-images, and quota checks.
func (h *ProductHandler) Store(c *fiber.Ctx) error {
	store, ok := c.Locals("store").(*models.Store)
	if !ok || store == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses ditolak: Anda harus memiliki toko aktif.",
		})
	}

	// Dynamic Plan Quota Check
	if allowed, msg := services.CanAddProduct(database.DB, store.ID); !allowed {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": msg,
		})
	}

	var req ProductRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data produk tidak valid.",
		})
	}

	name := security.SanitizePlainText(req.Name, 255)
	if name == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Nama produk wajib diisi.",
		})
	}

	pType := strings.ToLower(strings.TrimSpace(req.ProductType))
	if pType == "" {
		pType = "physical"
	}

	minOrder := req.MinOrder
	if minOrder < 1 {
		minOrder = 1
	}

	isShipping := true
	if req.IsShippingAvailable != nil {
		isShipping = *req.IsShippingAvailable
	}

	detailedInfoBytes, _ := json.Marshal(req.DetailedInfo)
	attributesBytes, _ := json.Marshal(req.Attributes)

	product := models.Product{
		StoreID:             store.ID,
		CategoryID:          req.CategoryID,
		Name:                name,
		ScientificName:      security.SanitizePlainText(req.ScientificName, 255),
		Class:               security.SanitizePlainText(req.Class, 100),
		Habitat:             security.SanitizePlainText(req.Habitat, 100),
		Diet:                security.SanitizePlainText(req.Diet, 100),
		ConservationStatus:  security.SanitizePlainText(req.ConservationStatus, 100),
		Price:               math.Max(0, req.Price),
		MinOrder:            minOrder,
		MaxOrder:            req.MaxOrder,
		VideoURL:            security.SanitizeURL(req.VideoURL),
		IsShippingAvailable: isShipping,
		Description:         security.SanitizeRichText(req.Description, 5000),
		ImageURL:            security.SanitizeURL(req.ImageURL),
		DetailedInfo:        datatypes.JSON(detailedInfoBytes),
		ProductType:         pType,
		Attributes:          datatypes.JSON(attributesBytes),
		IsActive:            true,
	}

	if err := database.DB.Create(&product).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menyimpan produk baru.",
		})
	}

	// Process multi-images gallery if provided
	if len(req.GalleryImages) > 0 {
		plan, _ := services.GetPlanByCode(database.DB, store.Plan)
		maxImages := 5
		if plan != nil {
			maxImages = plan.MaxImagesPerItem
		}
		if len(req.GalleryImages) > maxImages {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": fmt.Sprintf("Jumlah foto melebihi batas paket %s (maksimal %d foto per produk).", plan.Name, maxImages),
			})
		}

		for idx, imgURL := range req.GalleryImages {
			cleanURL := security.SanitizeURL(imgURL)
			if cleanURL != "" {
				prodImg := models.ProductImage{
					ProductID: product.ID,
					ImageURL:  cleanURL,
					SortOrder: idx,
					IsPrimary: idx == 0,
				}
				database.DB.Create(&prodImg)
			}
		}
	}

	// Process variants if provided
	if len(req.Variants) > 0 {
		for _, v := range req.Variants {
			vName := security.SanitizePlainText(v.VariantName, 100)
			if vName != "" {
				variant := models.ProductVariant{
					ProductID:     product.ID,
					VariantName:   vName,
					SKU:           security.SanitizePlainText(v.SKU, 100),
					PriceOverride: v.PriceOverride,
					StockQty:      v.StockQty,
					IsActive:      true,
				}
				database.DB.Create(&variant)
			}
		}
	}

	// Reload complete product with relations
	database.DB.Preload("Category").Preload("Images").Preload("Variants").First(&product, product.ID)

	// Record Activity Log
	userVal := c.Locals("user")
	var userID *uint
	actorName := "Pemilik Toko"
	actorEmail := "owner@catavor.com"
	if userVal != nil {
		u := userVal.(*models.User)
		userID = &u.ID
		actorName = u.Name
		actorEmail = u.Email
	}

	services.RecordActivity(services.RecordActivityParams{
		DB:          database.DB,
		StoreID:     &store.ID,
		UserID:      userID,
		ActorRole:   "merchant",
		ActorName:   actorName,
		ActorEmail:  actorEmail,
		Action:      "product.create",
		Category:    "catalog",
		EntityType:  "product",
		EntityID:    &product.ID,
		EntityTitle: product.Name,
		Description: fmt.Sprintf("Menambahkan produk baru '%s' dengan harga Rp %s.", product.Name, formatRupiahInt(int(product.Price))),
		Changes: map[string]interface{}{
			"price": product.Price,
			"type":  product.ProductType,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Produk berhasil ditambahkan.",
		"data":    product,
	})
}

// Update modifies an existing product.
func (h *ProductHandler) Update(c *fiber.Ctx) error {
	store, ok := c.Locals("store").(*models.Store)
	if !ok || store == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses ditolak.",
		})
	}

	id := c.Params("id")
	var product models.Product
	if err := database.DB.Where("id = ? AND store_id = ?", id, store.ID).First(&product).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Produk tidak ditemukan atau bukan milik toko Anda.",
		})
	}

	oldPrice := product.Price
	oldName := product.Name

	var req ProductRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data produk tidak valid.",
		})
	}

	// Anti-Cheat & Activation Guard
	targetActive := product.IsActive
	if req.IsActive != nil {
		targetActive = *req.IsActive
	}

	if allowed, msg := services.CanEditOrReactivateProduct(database.DB, store.ID, product.ID, targetActive); !allowed {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": msg,
		})
	}
	product.IsActive = targetActive

	if req.Name != "" {
		product.Name = security.SanitizePlainText(req.Name, 255)
	}
	if req.ScientificName != "" {
		product.ScientificName = security.SanitizePlainText(req.ScientificName, 255)
	}
	if req.Class != "" {
		product.Class = security.SanitizePlainText(req.Class, 100)
	}
	if req.CategoryID != nil {
		product.CategoryID = req.CategoryID
	}
	if req.Habitat != "" {
		product.Habitat = security.SanitizePlainText(req.Habitat, 100)
	}
	if req.Diet != "" {
		product.Diet = security.SanitizePlainText(req.Diet, 100)
	}
	if req.ConservationStatus != "" {
		product.ConservationStatus = security.SanitizePlainText(req.ConservationStatus, 100)
	}
	if req.Price >= 0 {
		product.Price = req.Price
	}
	if req.MinOrder > 0 {
		product.MinOrder = req.MinOrder
	}
	product.MaxOrder = req.MaxOrder
	if req.VideoURL != "" {
		product.VideoURL = security.SanitizeURL(req.VideoURL)
	}
	if req.IsShippingAvailable != nil {
		product.IsShippingAvailable = *req.IsShippingAvailable
	}
	if req.Description != "" {
		product.Description = security.SanitizeRichText(req.Description, 5000)
	}
	if req.ImageURL != "" {
		product.ImageURL = security.SanitizeURL(req.ImageURL)
	}
	if req.ProductType != "" {
		product.ProductType = strings.ToLower(strings.TrimSpace(req.ProductType))
	}
	if req.DetailedInfo != nil {
		b, _ := json.Marshal(req.DetailedInfo)
		product.DetailedInfo = datatypes.JSON(b)
	}
	if req.Attributes != nil {
		b, _ := json.Marshal(req.Attributes)
		product.Attributes = datatypes.JSON(b)
	}

	if err := database.DB.Save(&product).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui produk.",
		})
	}

	// Update gallery images if provided
	if len(req.GalleryImages) > 0 {
		plan, _ := services.GetPlanByCode(database.DB, store.Plan)
		maxImages := 5
		if plan != nil {
			maxImages = plan.MaxImagesPerItem
		}
		if len(req.GalleryImages) > maxImages {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": fmt.Sprintf("Jumlah foto melebihi batas paket %s (maksimal %d foto per produk).", plan.Name, maxImages),
			})
		}

		database.DB.Where("product_id = ?", product.ID).Delete(&models.ProductImage{})
		for idx, imgURL := range req.GalleryImages {
			cleanURL := security.SanitizeURL(imgURL)
			if cleanURL != "" {
				prodImg := models.ProductImage{
					ProductID: product.ID,
					ImageURL:  cleanURL,
					SortOrder: idx,
					IsPrimary: idx == 0,
				}
				database.DB.Create(&prodImg)
			}
		}
	}

	database.DB.Preload("Category").Preload("Images").Preload("Variants").First(&product, product.ID)

	// Record Activity Log
	userVal := c.Locals("user")
	var uID *uint
	actName := "Pemilik Toko"
	actEmail := "owner@catavor.com"
	if userVal != nil {
		u := userVal.(*models.User)
		uID = &u.ID
		actName = u.Name
		actEmail = u.Email
	}

	actionType := "product.update"
	desc := fmt.Sprintf("Memperbarui data produk '%s'.", product.Name)
	if oldPrice != product.Price {
		actionType = "product.price_change"
		desc = fmt.Sprintf("Mengubah harga produk '%s' dari Rp %s menjadi Rp %s.", product.Name, formatRupiahInt(int(oldPrice)), formatRupiahInt(int(product.Price)))
	}

	services.RecordActivity(services.RecordActivityParams{
		DB:          database.DB,
		StoreID:     &store.ID,
		UserID:      uID,
		ActorRole:   "merchant",
		ActorName:   actName,
		ActorEmail:  actEmail,
		Action:      actionType,
		Category:    "catalog",
		EntityType:  "product",
		EntityID:    &product.ID,
		EntityTitle: product.Name,
		Description: desc,
		Changes: map[string]interface{}{
			"before": map[string]interface{}{"price": oldPrice, "name": oldName},
			"after":  map[string]interface{}{"price": product.Price, "name": product.Name},
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Produk berhasil diperbarui.",
		"data":    product,
	})
}

// Destroy deletes a product securely with Anti-IDOR check.
func (h *ProductHandler) Destroy(c *fiber.Ctx) error {
	store, ok := c.Locals("store").(*models.Store)
	if !ok || store == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses ditolak.",
		})
	}

	id := c.Params("id")
	var product models.Product
	if err := database.DB.Where("id = ? AND store_id = ?", id, store.ID).First(&product).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Produk tidak ditemukan atau bukan milik toko Anda.",
		})
	}

	deletedTitle := product.Name
	deletedID := product.ID

	// Delete related records
	database.DB.Where("product_id = ?", product.ID).Delete(&models.ProductImage{})
	database.DB.Where("product_id = ?", product.ID).Delete(&models.ProductVariant{})

	if err := database.DB.Delete(&product).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghapus produk.",
		})
	}

	// Record Activity Log
	userVal := c.Locals("user")
	var uID *uint
	actName := "Pemilik Toko"
	actEmail := "owner@catavor.com"
	if userVal != nil {
		u := userVal.(*models.User)
		uID = &u.ID
		actName = u.Name
		actEmail = u.Email
	}

	services.RecordActivity(services.RecordActivityParams{
		DB:          database.DB,
		StoreID:     &store.ID,
		UserID:      uID,
		ActorRole:   "merchant",
		ActorName:   actName,
		ActorEmail:  actEmail,
		Action:      "product.delete",
		Category:    "catalog",
		EntityType:  "product",
		EntityID:    &deletedID,
		EntityTitle: deletedTitle,
		Description: fmt.Sprintf("Menghapus produk '%s' dari katalog.", deletedTitle),
		IPAddress:   c.IP(),
		UserAgent:   c.Get("User-Agent"),
	})

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Produk berhasil dihapus.",
	})
}

func formatRupiahInt(n int) string {
	in := strconv.Itoa(n)
	out := make([]byte, len(in)+(len(in)-1)/3)
	for i, j, k := len(in)-1, len(out)-1, 0; i >= 0; i, j = i-1, j-1 {
		out[j] = in[i]
		k++
		if k == 3 && i > 0 {
			j--
			out[j] = '.'
			k = 0
		}
	}
	return string(out)
}

// GetRecommendations returns related products within the same store.
func (h *ProductHandler) GetRecommendations(c *fiber.Ctx) error {
	id := c.Params("id")
	var current models.Product
	if err := database.DB.First(&current, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Produk tidak ditemukan.",
		})
	}

	var recs []models.Product
	database.DB.Where("store_id = ? AND id != ? AND is_active = true", current.StoreID, current.ID).
		Where("class = ? OR product_type = ?", current.Class, current.ProductType).
		Order("id DESC").
		Limit(4).
		Find(&recs)

	return c.JSON(fiber.Map{
		"success": true,
		"data":    recs,
	})
}
