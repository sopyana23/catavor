package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/middleware"
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
	IsResubmit          *bool                  `json:"is_resubmit"`
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

	// Inactive item guard for public storefront visitors
	if !product.IsActive {
		isAuthorized := false
		if storeVal, ok := c.Locals("store").(*models.Store); ok && storeVal != nil && storeVal.ID == product.StoreID {
			isAuthorized = true
		} else if claims := middleware.ExtractOptionalClaims(c, h.cfg); claims != nil {
			if claims.StoreID == product.StoreID {
				isAuthorized = true
			} else if claims.UserID > 0 {
				var store models.Store
				if err := database.DB.Where("id = ? AND user_id = ?", product.StoreID, claims.UserID).First(&store).Error; err == nil {
					isAuthorized = true
				} else {
					var user models.User
					if err := database.DB.Select("platform_role").First(&user, claims.UserID).Error; err == nil && (user.PlatformRole == "superadmin" || user.PlatformRole == "investigator") {
						isAuthorized = true
					}
				}
			}
		}

		if !isAuthorized {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success":     false,
				"message":     "Item katalog ini sedang dinonaktifkan atau diturunkan sementara oleh pengelola.",
				"is_inactive": true,
			})
		}
	}

	// Increment view count only for active items viewed by public
	if product.IsActive {
		database.DB.Model(&product).UpdateColumn("view_count", gormExpr("view_count + 1"))
	}

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

	// Sanitize and normalize scientific name, habitat, and diet
	scientificName := ""
	if pType == "fauna" || pType == "plant" {
		scientificName = security.SanitizePlainText(req.ScientificName, 255)
	}

	habitat := ""
	diet := ""
	if pType == "fauna" {
		if req.Attributes != nil {
			if h, ok := req.Attributes["habitat"].(string); ok && h != "" {
				habitat = security.SanitizePlainText(h, 100)
			}
			if d, ok := req.Attributes["diet"].(string); ok && d != "" {
				diet = security.SanitizePlainText(d, 100)
			}
		}
		if habitat == "" && req.Habitat != "" && req.Habitat != "General" {
			habitat = security.SanitizePlainText(req.Habitat, 100)
		}
		if diet == "" && req.Diet != "" && req.Diet != "N/A" {
			diet = security.SanitizePlainText(req.Diet, 100)
		}
		if req.Attributes != nil {
			if habitat != "" {
				req.Attributes["habitat"] = habitat
			}
			if diet != "" {
				req.Attributes["diet"] = diet
			}
		}
	} else if req.Attributes != nil {
		delete(req.Attributes, "habitat")
		delete(req.Attributes, "diet")
	}

	// Auto-associate Category relation if category_id not explicitly sent
	var categoryID *uint = req.CategoryID
	className := security.SanitizePlainText(req.Class, 100)
	if categoryID == nil && className != "" {
		var cat models.Category
		if err := database.DB.Where("store_id = ? AND LOWER(name) = ?", store.ID, strings.ToLower(className)).First(&cat).Error; err == nil {
			categoryID = &cat.ID
		} else {
			slug := strings.ToLower(className)
			slug = strings.ReplaceAll(slug, " & ", "-")
			slug = strings.ReplaceAll(slug, " ", "-")
			slug = strings.ReplaceAll(slug, "/", "-")
			newCat := models.Category{
				StoreID:     store.ID,
				Name:        className,
				Slug:        slug,
				ProductType: pType,
				SortOrder:   0,
				IsActive:    true,
			}
			if err := database.DB.Create(&newCat).Error; err == nil {
				categoryID = &newCat.ID
			}
		}
	}

	detailedInfoBytes, _ := json.Marshal(req.DetailedInfo)
	attributesBytes, _ := json.Marshal(req.Attributes)

	product := models.Product{
		StoreID:             store.ID,
		CategoryID:          categoryID,
		Name:                name,
		ScientificName:      scientificName,
		Class:               security.SanitizePlainText(req.Class, 100),
		Habitat:             habitat,
		Diet:                diet,
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

	// Pre-validate multi-images gallery if provided (direct or fallback to detailed_info.images)
	galleryImages := req.GalleryImages
	if len(galleryImages) == 0 && req.DetailedInfo != nil {
		if rawImgs, ok := req.DetailedInfo["images"]; ok {
			if slice, ok := rawImgs.([]interface{}); ok {
				for _, item := range slice {
					if str, ok := item.(string); ok && strings.TrimSpace(str) != "" {
						galleryImages = append(galleryImages, strings.TrimSpace(str))
					}
				}
			}
		}
	}

	const maxImages = 10
	if len(galleryImages) > maxImages {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": fmt.Sprintf("Jumlah foto melebihi batas maksimal (%d foto per produk).", maxImages),
		})
	}

	// Actor context for audit log
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

	// ACID Database Transaction: All-or-Nothing (No half-baked / orphaned product records)
	txErr := database.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Insert product record
		if err := tx.Create(&product).Error; err != nil {
			return err
		}

		// 2. Insert gallery images
		if len(galleryImages) > 0 {
			for idx, imgURL := range galleryImages {
				cleanURL := security.SanitizeURL(imgURL)
				if cleanURL != "" {
					prodImg := models.ProductImage{
						ProductID: product.ID,
						ImageURL:  cleanURL,
						SortOrder: idx,
						IsPrimary: idx == 0,
					}
					if err := tx.Create(&prodImg).Error; err != nil {
						return err
					}
				}
			}
		}

		// 3. Insert variants if provided
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
					if err := tx.Create(&variant).Error; err != nil {
						return err
					}
				}
			}
		}

		// 4. Record Activity Log atomically
		services.RecordActivity(services.RecordActivityParams{
			DB:          tx,
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

		return nil
	})

	if txErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menyimpan produk baru: " + txErr.Error(),
		})
	}

	// Reload complete product with relations
	database.DB.Preload("Category").Preload("Images").Preload("Variants").First(&product, product.ID)

	InvalidateStoreProductsCache(store.ID)
	services.SyncStoreStorageUsed(database.DB, store.ID)
	database.InvalidateStoreQuotaCache(context.Background(), store.ID)

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

	// Capture existing images before update to detect removed files for hard deletion
	oldImagesMap := make(map[string]bool)
	if product.ImageURL != "" {
		oldImagesMap[product.ImageURL] = true
	}
	var existingGalleryImgs []models.ProductImage
	database.DB.Where("product_id = ?", product.ID).Find(&existingGalleryImgs)
	for _, eg := range existingGalleryImgs {
		if eg.ImageURL != "" {
			oldImagesMap[eg.ImageURL] = true
		}
	}
	if len(product.DetailedInfo) > 0 {
		var dInfo map[string]interface{}
		if err := json.Unmarshal(product.DetailedInfo, &dInfo); err == nil {
			if rawImages, ok := dInfo["images"].([]interface{}); ok {
				for _, itm := range rawImages {
					if str, ok := itm.(string); ok && str != "" {
						oldImagesMap[str] = true
					}
				}
			}
		}
	}

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
	effectiveType := product.ProductType
	if req.ProductType != "" {
		effectiveType = strings.ToLower(strings.TrimSpace(req.ProductType))
		product.ProductType = effectiveType
	}

	if effectiveType == "fauna" || effectiveType == "plant" {
		if req.ScientificName != "" {
			product.ScientificName = security.SanitizePlainText(req.ScientificName, 255)
		}
	} else {
		product.ScientificName = ""
	}

	if req.Class != "" {
		className := security.SanitizePlainText(req.Class, 100)
		product.Class = className
		if req.CategoryID != nil {
			product.CategoryID = req.CategoryID
		} else {
			var cat models.Category
			if err := database.DB.Where("store_id = ? AND LOWER(name) = ?", store.ID, strings.ToLower(className)).First(&cat).Error; err == nil {
				product.CategoryID = &cat.ID
			} else {
				slug := strings.ToLower(className)
				slug = strings.ReplaceAll(slug, " & ", "-")
				slug = strings.ReplaceAll(slug, " ", "-")
				slug = strings.ReplaceAll(slug, "/", "-")
				newCat := models.Category{
					StoreID:     store.ID,
					Name:        className,
					Slug:        slug,
					ProductType: effectiveType,
					SortOrder:   0,
					IsActive:    true,
				}
				if err := database.DB.Create(&newCat).Error; err == nil {
					product.CategoryID = &newCat.ID
				}
			}
		}
	} else if req.CategoryID != nil {
		product.CategoryID = req.CategoryID
	}

	if effectiveType == "fauna" {
		if req.Attributes != nil {
			if h, ok := req.Attributes["habitat"].(string); ok && h != "" {
				product.Habitat = security.SanitizePlainText(h, 100)
			}
			if d, ok := req.Attributes["diet"].(string); ok && d != "" {
				product.Diet = security.SanitizePlainText(d, 100)
			}
		}
		if req.Habitat != "" && req.Habitat != "General" {
			product.Habitat = security.SanitizePlainText(req.Habitat, 100)
		}
		if req.Diet != "" && req.Diet != "N/A" {
			product.Diet = security.SanitizePlainText(req.Diet, 100)
		}
		if req.Attributes != nil {
			if product.Habitat != "" {
				req.Attributes["habitat"] = product.Habitat
			}
			if product.Diet != "" {
				req.Attributes["diet"] = product.Diet
			}
		}
	} else {
		product.Habitat = ""
		product.Diet = ""
		if req.Attributes != nil {
			delete(req.Attributes, "habitat")
			delete(req.Attributes, "diet")
		}
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
	if req.DetailedInfo != nil {
		b, _ := json.Marshal(req.DetailedInfo)
		product.DetailedInfo = datatypes.JSON(b)
	}
	if req.Attributes != nil {
		b, _ := json.Marshal(req.Attributes)
		product.Attributes = datatypes.JSON(b)
	}

	wasInNeedsFix := product.ModerationStatus == "needs_fix" || product.ModerationStatus == "hidden"
	if wasInNeedsFix {
		now := time.Now().UTC()
		product.ModerationStatus = "in_review"
		product.IsActive = false
		product.ResubmittedAt = &now
		product.ResubmitCount = product.ResubmitCount + 1
	}

	// Pre-validate update gallery images before starting transaction
	updateGallery := req.GalleryImages
	if len(updateGallery) == 0 && req.DetailedInfo != nil {
		if rawImgs, ok := req.DetailedInfo["images"]; ok {
			if slice, ok := rawImgs.([]interface{}); ok {
				for _, item := range slice {
					if str, ok := item.(string); ok && strings.TrimSpace(str) != "" {
						updateGallery = append(updateGallery, strings.TrimSpace(str))
					}
				}
			}
		}
	}

	const maxImages = 10
	if len(updateGallery) > maxImages {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": fmt.Sprintf("Jumlah foto melebihi batas maksimal (%d foto per produk).", maxImages),
		})
	}

	// Actor context for audit log
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
	if wasInNeedsFix {
		actionType = "product.resubmit"
		desc = fmt.Sprintf("Mengajukan ulang perbaikan untuk produk '%s' yang sebelumnya disembunyikan.", product.Name)
	} else if oldPrice != product.Price {
		actionType = "product.price_change"
		desc = fmt.Sprintf("Mengubah harga produk '%s' dari Rp %s menjadi Rp %s.", product.Name, formatRupiahInt(int(oldPrice)), formatRupiahInt(int(product.Price)))
	}

	var itemReports []models.Report
	now := time.Now().UTC()

	// ACID Database Transaction: All-or-Nothing (No half-baked / inconsistent state)
	txErr := database.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Save product record
		if err := tx.Save(&product).Error; err != nil {
			return err
		}

		// 2. Update gallery images
		if len(updateGallery) > 0 {
			if err := tx.Where("product_id = ?", product.ID).Delete(&models.ProductImage{}).Error; err != nil {
				return err
			}
			for idx, imgURL := range updateGallery {
				cleanURL := security.SanitizeURL(imgURL)
				if cleanURL != "" {
					prodImg := models.ProductImage{
						ProductID: product.ID,
						ImageURL:  cleanURL,
						SortOrder: idx,
						IsPrimary: idx == 0,
					}
					if err := tx.Create(&prodImg).Error; err != nil {
						return err
					}
				}
			}
		}

		// 3. Update moderation report statuses if resubmitted
		if wasInNeedsFix {
			if err := tx.Where("target_type = 'item' AND fauna_id = ? AND status IN ('action_taken', 'investigating', 'pending')", product.ID).Find(&itemReports).Error; err == nil {
				for _, r := range itemReports {
					noteUpdate := strings.TrimSpace(r.AdminNotes + fmt.Sprintf("\n[%s] Merchant telah memperbarui data produk dan mengajukan peninjauan ulang.", now.Format("02 Jan 2006 15:04 WIB")))
					if err := tx.Model(&r).Updates(map[string]interface{}{
						"status":      "re_review",
						"admin_notes": noteUpdate,
						"updated_at":  now,
					}).Error; err != nil {
						return err
					}
				}
			}
		}

		// 4. Record Activity Log atomically
		services.RecordActivity(services.RecordActivityParams{
			DB:          tx,
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

		return nil
	})

	if txErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui produk: " + txErr.Error(),
		})
	}

	// Hard delete old images that are no longer referenced in new product images
	newImagesMap := make(map[string]bool)
	if product.ImageURL != "" {
		newImagesMap[product.ImageURL] = true
	}
	for _, ug := range updateGallery {
		if ug != "" {
			newImagesMap[ug] = true
		}
	}

	if len(product.DetailedInfo) > 0 {
		var dInfo map[string]interface{}
		if err := json.Unmarshal(product.DetailedInfo, &dInfo); err == nil {
			if rawImages, ok := dInfo["images"].([]interface{}); ok {
				for _, itm := range rawImages {
					if str, ok := itm.(string); ok && str != "" {
						newImagesMap[str] = true
					}
				}
			}
		}
	}

	for oldImg := range oldImagesMap {
		if !newImagesMap[oldImg] {
			var otherProdCount int64
			database.DB.Model(&models.Product{}).Where("deleted_at IS NULL AND id != ? AND image_url = ?", product.ID, oldImg).Count(&otherProdCount)
			var otherGalleryCount int64
			database.DB.Model(&models.ProductImage{}).
				Joins("JOIN products ON products.id = product_images.product_id").
				Where("products.deleted_at IS NULL AND product_images.product_id != ? AND product_images.image_url = ?", product.ID, oldImg).
				Count(&otherGalleryCount)
			if otherProdCount == 0 && otherGalleryCount == 0 {
				_, _ = services.HardDeleteLocalStorageFile(oldImg)
			}
		}
	}

	// Always sync store storage bytes and clear quota cache
	services.SyncStoreStorageUsed(database.DB, store.ID)
	database.InvalidateStoreQuotaCache(context.Background(), store.ID)

	// Trigger broadcast alert & report synchronization if product was resubmitted
	if wasInNeedsFix {
		InvalidateReportMetricsCache()

		// 1. Broadcast and record notification for platform admins
		go func(pID uint, pName, sTitle string) {
			adminMsg := fmt.Sprintf("Merchant \"%s\" telah memperbarui data produk \"%s\" dan mengajukan peninjauan ulang.", sTitle, pName)
			adminNotif := models.Notification{
				ID:            fmt.Sprintf("notif_resubmit_%d_%d", pID, now.UnixNano()),
				TargetType:    "all",
				Title:         "Pengajuan Ulang Perbaikan Produk",
				Message:       adminMsg,
				Type:          "info",
				Category:      "MODERASI",
				ActionEnabled: true,
				ActionType:    "detail",
				ActionLabel:   "Tinjau Produk →",
				ActionURL:     fmt.Sprintf("/superadmin?tab=reports&item_id=%d", pID),
				CreatedAt:     now,
				UpdatedAt:     now,
			}
			_ = database.DB.Create(&adminNotif).Error
			services.GetNotificationHub().Broadcast(&adminNotif)
		}(product.ID, product.Name, store.StoreTitle)

		// 2. Create acknowledgement notification for merchant
		merchantNotif := models.Notification{
			ID:         fmt.Sprintf("notif_resubmit_ack_%d_%d", product.ID, now.UnixNano()),
			TargetType: "store",
			TargetID:   store.ID,
			Title:      "Pengajuan Perbaikan Produk Diterima",
			Message:    fmt.Sprintf("Perbaikan data produk \"%s\" telah kami terima dan masuk antrean peninjauan oleh tim kepatuhan.", product.Name),
			Type:       "info",
			Category:   "MODERASI",
			CreatedAt:  now,
			UpdatedAt:  now,
		}
		_ = database.DB.Create(&merchantNotif).Error
	}

	database.DB.Preload("Category").Preload("Images").Preload("Variants").First(&product, product.ID)

	respMsg := "Produk berhasil diperbarui."
	if wasInNeedsFix {
		respMsg = "Perbaikan produk berhasil dikirim dan kini dalam status peninjauan ulang oleh Tim Kepatuhan."
	}

	InvalidateStoreProductsCache(store.ID)

	return c.JSON(fiber.Map{
		"success": true,
		"message": respMsg,
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

	// 1. Collect all images associated with this product before deletion
	imagesToDelete := make([]string, 0)
	if product.ImageURL != "" {
		imagesToDelete = append(imagesToDelete, product.ImageURL)
	}

	var prodImages []models.ProductImage
	database.DB.Where("product_id = ?", product.ID).Find(&prodImages)
	for _, pi := range prodImages {
		if pi.ImageURL != "" {
			imagesToDelete = append(imagesToDelete, pi.ImageURL)
		}
	}

	if len(product.DetailedInfo) > 0 {
		var dInfo map[string]interface{}
		if err := json.Unmarshal(product.DetailedInfo, &dInfo); err == nil {
			if rawImages, ok := dInfo["images"].([]interface{}); ok {
				for _, itm := range rawImages {
					if str, ok := itm.(string); ok && str != "" {
						imagesToDelete = append(imagesToDelete, str)
					}
				}
			}
		}
	}

	// Actor context for audit log
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

	// 2. ACID Database Transaction: All-or-Nothing (No partial deletions)
	txErr := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("product_id = ?", product.ID).Delete(&models.ProductImage{}).Error; err != nil {
			return err
		}
		if err := tx.Where("product_id = ?", product.ID).Delete(&models.ProductVariant{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&product).Error; err != nil {
			return err
		}

		// Record Activity Log atomically within transaction
		services.RecordActivity(services.RecordActivityParams{
			DB:          tx,
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

		return nil
	})

	if txErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghapus produk: " + txErr.Error(),
		})
	}

	// 3. Hard delete each local physical image file from storage if not used by any other active product
	for _, imgURL := range imagesToDelete {
		var otherProdCount int64
		database.DB.Model(&models.Product{}).Where("deleted_at IS NULL AND id != ? AND image_url = ?", product.ID, imgURL).Count(&otherProdCount)
		var otherImgCount int64
		database.DB.Model(&models.ProductImage{}).
			Joins("JOIN products ON products.id = product_images.product_id").
			Where("products.deleted_at IS NULL AND product_images.product_id != ? AND product_images.image_url = ?", product.ID, imgURL).
			Count(&otherImgCount)
		if otherProdCount == 0 && otherImgCount == 0 {
			_, _ = services.HardDeleteLocalStorageFile(imgURL)
		}
	}

	// 4. Recalculate store storage used and invalidate cache
	services.SyncStoreStorageUsed(database.DB, store.ID)
	database.InvalidateStoreQuotaCache(context.Background(), store.ID)

	InvalidateStoreProductsCache(store.ID)

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

// ResubmitForReview allows a merchant to submit a product for compliance review after fixing it
func (h *ProductHandler) ResubmitForReview(c *fiber.Ctx) error {
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
			"message": "Produk tidak ditemukan.",
		})
	}

	if product.ModerationStatus != "needs_fix" && product.ModerationStatus != "hidden" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Item ini tidak dalam status perlu perbaikan kepatuhan.",
		})
	}

	now := time.Now().UTC()
	product.ModerationStatus = "in_review"
	product.IsActive = false
	product.ResubmittedAt = &now
	product.ResubmitCount = product.ResubmitCount + 1

	if err := database.DB.Save(&product).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengajukan peninjauan ulang.",
		})
	}

	InvalidateStoreProductsCache(store.ID)

	// Update associated reports to 're_review'
	var itemReports []models.Report
	database.DB.Where("target_type = 'item' AND fauna_id = ? AND status IN ('action_taken', 'investigating', 'pending')", product.ID).Find(&itemReports)
	for _, r := range itemReports {
		noteUpdate := strings.TrimSpace(r.AdminNotes + fmt.Sprintf("\n[%s] Merchant telah mengajukan peninjauan ulang produk.", now.Format("02 Jan 2006 15:04 WIB")))
		database.DB.Model(&r).Updates(map[string]interface{}{
			"status":      "re_review",
			"admin_notes": noteUpdate,
			"updated_at":  now,
		})
	}
	InvalidateReportMetricsCache()

	// Broadcast alert to admins
	go func(pID uint, pName, sTitle string) {
		adminMsg := fmt.Sprintf("Merchant \"%s\" telah mengajukan peninjauan ulang untuk produk \"%s\".", sTitle, pName)
		adminNotif := models.Notification{
			ID:            fmt.Sprintf("notif_resubmit_%d_%d", pID, now.UnixNano()),
			TargetType:    "all",
			Title:         "Pengajuan Ulang Perbaikan Produk",
			Message:       adminMsg,
			Type:          "info",
			Category:      "MODERASI",
			ActionEnabled: true,
			ActionType:    "detail",
			ActionLabel:   "Tinjau Produk →",
			ActionURL:     fmt.Sprintf("/superadmin?tab=reports&item_id=%d", pID),
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		_ = database.DB.Create(&adminNotif).Error
		services.GetNotificationHub().Broadcast(&adminNotif)
	}(product.ID, product.Name, store.StoreTitle)

	// Notification for merchant
	merchantNotif := models.Notification{
		ID:         fmt.Sprintf("notif_resubmit_ack_%d_%d", product.ID, now.UnixNano()),
		TargetType: "store",
		TargetID:   store.ID,
		Title:      "Pengajuan Perbaikan Produk Diterima",
		Message:    fmt.Sprintf("Perbaikan data produk \"%s\" telah kami terima dan masuk antrean peninjauan oleh tim kepatuhan.", product.Name),
		Type:       "info",
		Category:   "MODERASI",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	_ = database.DB.Create(&merchantNotif).Error

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Produk berhasil diajukan untuk peninjauan ulang oleh tim kepatuhan.",
		"data":    product,
	})
}

// CulinaryTaxonomyItem represents presets for F&B product taxonomy.
type CulinaryTaxonomyItem struct {
	CategoryName       string   `json:"category_name"`
	Description        string   `json:"description"`
	DefaultStorageTemp string   `json:"default_storage_temp"`
	DefaultExpiredInfo string   `json:"default_expired_info"`
	DefaultShipping    string   `json:"default_shipping"`
	PortionPlaceholder string   `json:"portion_placeholder"`
	SpecificFields     []string `json:"specific_fields"`
}

// GetCulinaryTaxonomy returns default taxonomy presets for culinary / food items.
func (h *ProductHandler) GetCulinaryTaxonomy(c *fiber.Ctx) error {
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


