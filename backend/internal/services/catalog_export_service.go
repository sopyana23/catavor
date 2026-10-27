package services

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strings"
	"time"

	"catavor-backend/internal/models"
	"gorm.io/datatypes"
)

// SanitizeCSVField prevents CSV Formula Injection (CWE-1236)
// Prepends single quote if field starts with formula trigger characters (=, +, -, @, \t, \r)
func SanitizeCSVField(val string) string {
	clean := strings.TrimSpace(val)
	if len(clean) == 0 {
		return ""
	}
	first := clean[0]
	if first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r' {
		return "'" + clean
	}
	return clean
}

// FormatAttributesSummary serializes attributes JSON map into readable human text
func FormatAttributesSummary(attrs datatypes.JSON, detailed datatypes.JSON) string {
	pairs := make([]string, 0)

	// Process domain specific attributes
	if len(attrs) > 0 && string(attrs) != "null" && string(attrs) != "{}" {
		var m map[string]interface{}
		if err := json.Unmarshal(attrs, &m); err == nil {
			for k, v := range m {
				if v != nil && fmt.Sprintf("%v", v) != "" {
					pairs = append(pairs, fmt.Sprintf("%s: %v", k, v))
				}
			}
		}
	}

	// Process detailed_info if available
	if len(detailed) > 0 && string(detailed) != "null" && string(detailed) != "{}" {
		var m map[string]interface{}
		if err := json.Unmarshal(detailed, &m); err == nil {
			for k, v := range m {
				if v != nil && fmt.Sprintf("%v", v) != "" {
					pairs = append(pairs, fmt.Sprintf("%s: %v", k, v))
				}
			}
		}
	}

	sort.Strings(pairs)
	return strings.Join(pairs, "; ")
}

// FormatVariantsSummary serializes product variants into a structured one-line string
func FormatVariantsSummary(variants []models.ProductVariant) string {
	if len(variants) == 0 {
		return "-"
	}
	parts := make([]string, 0, len(variants))
	for _, v := range variants {
		priceStr := "-"
		if v.PriceOverride != nil {
			priceStr = fmt.Sprintf("Rp%0.0f", *v.PriceOverride)
		}
		skuStr := v.SKU
		if skuStr == "" {
			skuStr = "-"
		}
		parts = append(parts, fmt.Sprintf("%s (SKU: %s, Harga: %s, Stok: %d)", v.VariantName, skuStr, priceStr, v.StockQty))
	}
	return strings.Join(parts, " | ")
}

// FormatGalleryImages joins gallery image URLs with semicolon
func FormatGalleryImages(images []models.ProductImage) string {
	if len(images) == 0 {
		return "-"
	}
	urls := make([]string, 0, len(images))
	for _, img := range images {
		if strings.TrimSpace(img.ImageURL) != "" {
			urls = append(urls, strings.TrimSpace(img.ImageURL))
		}
	}
	if len(urls) == 0 {
		return "-"
	}
	return strings.Join(urls, "; ")
}

// ExportCatalogCSV writes a complete, Excel-compatible CSV stream
func ExportCatalogCSV(w io.Writer, store *models.Store, products []models.Product) error {
	// 1. Write UTF-8 BOM (\xef\xbb\xbf) for seamless opening in Microsoft Excel
	if _, err := w.Write([]byte("\xef\xbb\xbf")); err != nil {
		return err
	}

	csvWriter := csv.NewWriter(w)
	defer csvWriter.Flush()

	// 2. CSV Headers
	headers := []string{
		"ID Produk",
		"Nama Produk",
		"Tipe Katalog",
		"Kategori",
		"Harga Pokok (IDR)",
		"Status Ketersediaan",
		"Min Order",
		"Max Order",
		"Status Tayang",
		"Pengiriman Tersedia",
		"Varian Produk",
		"Spesifikasi Atribut Domain",
		"Deskripsi Produk",
		"URL Foto Utama",
		"Galeri Foto Tambahan",
		"URL Video Preview",
		"Total Dilihat (Views)",
		"Total Klik WhatsApp (Leads)",
		"Total Klik Marketplace",
		"Total Klik Rekber Syariah",
		"Tanggal Dibuat",
	}

	if err := csvWriter.Write(headers); err != nil {
		return err
	}

	// 3. Write data rows
	for _, p := range products {
		categoryName := "-"
		if p.Category != nil && p.Category.Name != "" {
			categoryName = p.Category.Name
		}

		maxOrderStr := "-"
		if p.MaxOrder != nil {
			maxOrderStr = fmt.Sprintf("%d", *p.MaxOrder)
		}

		statusTayang := "Aktif"
		if !p.IsActive {
			statusTayang = "Draft/Nonaktif"
		}
		if p.ArchivedAt != nil {
			statusTayang = "Diarsipkan"
		}

		shippingStr := "Ya"
		if !p.IsShippingAvailable {
			shippingStr = "Tidak"
		}

		// Clean description from raw newlines to prevent broken spreadsheet rows
		cleanDesc := strings.ReplaceAll(p.Description, "\r\n", " ")
		cleanDesc = strings.ReplaceAll(cleanDesc, "\n", " ")

		row := []string{
			fmt.Sprintf("%d", p.ID),
			SanitizeCSVField(p.Name),
			SanitizeCSVField(p.ProductType),
			SanitizeCSVField(categoryName),
			fmt.Sprintf("%.0f", p.Price),
			SanitizeCSVField(p.ConservationStatus),
			fmt.Sprintf("%d", p.MinOrder),
			SanitizeCSVField(maxOrderStr),
			SanitizeCSVField(statusTayang),
			SanitizeCSVField(shippingStr),
			SanitizeCSVField(FormatVariantsSummary(p.Variants)),
			SanitizeCSVField(FormatAttributesSummary(p.Attributes, p.DetailedInfo)),
			SanitizeCSVField(cleanDesc),
			SanitizeCSVField(p.ImageURL),
			SanitizeCSVField(FormatGalleryImages(p.Images)),
			SanitizeCSVField(p.VideoURL),
			fmt.Sprintf("%d", p.ViewCount),
			fmt.Sprintf("%d", p.WaClicksCount),
			fmt.Sprintf("%d", p.MarketplaceClicksCount),
			fmt.Sprintf("%d", p.RekberClicksCount),
			p.CreatedAt.Format("2006-01-02 15:04:05"),
		}

		if err := csvWriter.Write(row); err != nil {
			return err
		}
	}

	csvWriter.Flush()
	return csvWriter.Error()
}

// JSONExportProduct represents product item in technical backup JSON
type JSONExportProduct struct {
	ID                  uint                   `json:"id"`
	Name                string                 `json:"name"`
	ProductType         string                 `json:"product_type"`
	CategoryName        string                 `json:"category_name,omitempty"`
	Price               float64                `json:"price"`
	ConservationStatus  string                 `json:"conservation_status"`
	MinOrder            int                    `json:"min_order"`
	MaxOrder            *int                   `json:"max_order,omitempty"`
	IsShippingAvailable bool                   `json:"is_shipping_available"`
	Description         string                 `json:"description"`
	ImageURL            string                 `json:"image_url"`
	VideoURL            string                 `json:"video_url,omitempty"`
	Attributes          map[string]interface{} `json:"attributes"`
	DetailedInfo        map[string]interface{} `json:"detailed_info"`
	IsActive            bool                   `json:"is_active"`
	Images              []string               `json:"images"`
	Variants            []JSONExportVariant    `json:"variants"`
	Metrics             JSONExportMetrics      `json:"metrics"`
	CreatedAt           time.Time              `json:"created_at"`
	UpdatedAt           time.Time              `json:"updated_at"`
}

type JSONExportVariant struct {
	VariantName   string   `json:"variant_name"`
	SKU           string   `json:"sku,omitempty"`
	PriceOverride *float64 `json:"price_override,omitempty"`
	StockQty      int      `json:"stock_qty"`
}

type JSONExportMetrics struct {
	ViewCount              int64 `json:"view_count"`
	WaClicksCount          int64 `json:"wa_clicks_count"`
	MarketplaceClicksCount int64 `json:"marketplace_clicks_count"`
	RekberClicksCount      int64 `json:"rekber_clicks_count"`
	VideoViewsCount        int64 `json:"video_views_count"`
}

// ExportCatalogJSON writes deep relational JSON backup stream
func ExportCatalogJSON(w io.Writer, store *models.Store, categories []models.Category, products []models.Product) error {
	exportProducts := make([]JSONExportProduct, 0, len(products))

	for _, p := range products {
		catName := ""
		if p.Category != nil {
			catName = p.Category.Name
		}

		var attrsMap map[string]interface{}
		if len(p.Attributes) > 0 && string(p.Attributes) != "null" {
			_ = json.Unmarshal(p.Attributes, &attrsMap)
		}
		if attrsMap == nil {
			attrsMap = make(map[string]interface{})
		}

		var detailMap map[string]interface{}
		if len(p.DetailedInfo) > 0 && string(p.DetailedInfo) != "null" {
			_ = json.Unmarshal(p.DetailedInfo, &detailMap)
		}
		if detailMap == nil {
			detailMap = make(map[string]interface{})
		}

		imagesList := make([]string, 0, len(p.Images))
		for _, img := range p.Images {
			if strings.TrimSpace(img.ImageURL) != "" {
				imagesList = append(imagesList, strings.TrimSpace(img.ImageURL))
			}
		}

		variantsList := make([]JSONExportVariant, 0, len(p.Variants))
		for _, v := range p.Variants {
			variantsList = append(variantsList, JSONExportVariant{
				VariantName:   v.VariantName,
				SKU:           v.SKU,
				PriceOverride: v.PriceOverride,
				StockQty:      v.StockQty,
			})
		}

		exportProducts = append(exportProducts, JSONExportProduct{
			ID:                  p.ID,
			Name:                p.Name,
			ProductType:         p.ProductType,
			CategoryName:        catName,
			Price:               p.Price,
			ConservationStatus:  p.ConservationStatus,
			MinOrder:            p.MinOrder,
			MaxOrder:            p.MaxOrder,
			IsShippingAvailable: p.IsShippingAvailable,
			Description:         p.Description,
			ImageURL:            p.ImageURL,
			VideoURL:            p.VideoURL,
			Attributes:          attrsMap,
			DetailedInfo:        detailMap,
			IsActive:            p.IsActive,
			Images:              imagesList,
			Variants:            variantsList,
			Metrics: JSONExportMetrics{
				ViewCount:              p.ViewCount,
				WaClicksCount:          p.WaClicksCount,
				MarketplaceClicksCount: p.MarketplaceClicksCount,
				RekberClicksCount:      p.RekberClicksCount,
				VideoViewsCount:        p.VideoViewsCount,
			},
			CreatedAt: p.CreatedAt,
			UpdatedAt: p.UpdatedAt,
		})
	}

	catNames := make([]string, 0, len(categories))
	for _, c := range categories {
		catNames = append(catNames, c.Name)
	}

	root := map[string]interface{}{
		"export_metadata": map[string]interface{}{
			"exported_at":    time.Now().UTC().Format(time.RFC3339),
			"platform":       "Catavor Multi-Tenant Smart Catalog",
			"schema_version": "1.0",
			"total_products": len(products),
		},
		"store": map[string]interface{}{
			"id":               store.ID,
			"slug":             store.Slug,
			"store_title":      store.StoreTitle,
			"store_slogan":     store.StoreSlogan,
			"whatsapp_number":  store.WhatsappNumber,
			"store_theme":      store.StoreTheme,
			"about_location":   store.AboutLocation,
			"about_hours":      store.AboutHours,
			"social_links":     store.SocialLinks,
			"enable_wa_direct": store.EnableWADirect,
			"enable_wa_rekber": store.EnableWARekber,
		},
		"categories": catNames,
		"products":   exportProducts,
	}

	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ")
	return encoder.Encode(root)
}
