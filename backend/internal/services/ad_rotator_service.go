package services

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"math"
	"math/rand"
	"sort"
	"strings"
	"time"

	"catavor-backend/internal/models"

	"gorm.io/gorm"
)

// =========================================================================================
// AD ROTATOR SERVICE (WEIGHTED TIME-SLICED SHUFFLE ENGINE)
// =========================================================================================
// Service ini menangani:
// 1. Ekstraksi kampanye iklan aktif per slot dan per sektor industri (7 format katalog).
// 2. Algoritma Rotasi Berbobot (Weighted Pseudo-Random Shuffling) berbasis Session Seed:
//    - Anti-Monopoli: Posisi teratas berputar secara berkala (tiap jam / per sesi unik pengunjung).
//    - Bobot Proporsional: Pengiklan dengan paket/bobot lebih tinggi memiliki probabilitas lebih sering tampil.
//    - Sesi Deterministik: Pengunjung yang berpindah tab atau me-refresh dalam 1 jam melihat urutan stabil.
// 3. De-duplikasi Ketat: 1 toko tidak akan muncul lebih dari 1 kali dalam satu layar beranda.
// 4. Graceful Fallback Organik: Jika tidak ada iklan aktif, slot otomatis diisi oleh produk/toko
//    terpopuler organik berbasis skor 7 hari terakhir (anti-layar kosong).
// =========================================================================================

// ShowcaseItem represents a unified display card for either a Store Profile or a Product Item on the landing page.
type ShowcaseItem struct {
	// Metadata Penayangan
	IsSponsored     bool    `json:"is_sponsored"`
	BadgeText       string  `json:"badge_text"` // "Disponsori" atau "Populer Minggu Ini"
	CampaignCode    string  `json:"campaign_code,omitempty"`
	AdSlotCode      string  `json:"ad_slot_code,omitempty"`
	RedirectURL     string  `json:"redirect_url"` // Endpoint redirect terlindung HMAC

	// Target Tipe: 'store' atau 'product'
	ItemType string `json:"item_type"` // "store" | "product"

	// Informasi Profil Toko
	StoreID         uint   `json:"store_id"`
	StoreSlug       string `json:"store_slug"`
	StoreTitle      string `json:"store_title"`
	StoreLogoURL    string `json:"store_logo_url,omitempty"`
	StoreSlogan     string `json:"store_slogan,omitempty"`
	StoreTheme      string `json:"store_theme,omitempty"`
	Plan            string `json:"plan,omitempty"`
	ItemCount       int64  `json:"item_count,omitempty"`

	// Informasi Item Produk (Jika item_type == "product")
	ProductID          uint    `json:"product_id,omitempty"`
	ProductName        string  `json:"product_name,omitempty"`
	ProductPrice       float64 `json:"product_price,omitempty"`
	ProductImageURL    string  `json:"product_image_url,omitempty"`
	ProductType        string  `json:"product_type,omitempty"`
	CategoryName       string  `json:"category_name,omitempty"`
	ConservationStatus string  `json:"conservation_status,omitempty"`
	TrendingScore7D    int64   `json:"trending_score_7d,omitempty"`
	ViewCount          int64   `json:"view_count,omitempty"`
}

// ShowcaseResult membungkus daftar item yang siap disajikan ke frontend.
type ShowcaseResult struct {
	SlotCode       string         `json:"slot_code"`
	SlotName       string         `json:"slot_name"`
	TargetEntity   string         `json:"target_entity"` // "store" | "product" | "mixed"
	TotalReturned  int            `json:"total_returned"`
	SponsoredCount int            `json:"sponsored_count"`
	OrganicCount   int            `json:"organic_count"`
	Items          []ShowcaseItem `json:"items"`
}

// weightedCandidate menyimpan data sementara untuk algoritma pengacakan berbobot.
type weightedCandidate struct {
	Campaign models.AdCampaign
	Score    float64
}

// GetRotatedShowcase mengambil kartu etalase untuk slot tertentu dengan algoritma rotasi berbobot.
// Jika kuota slot belum terpenuhi oleh iklan bersponsor, sisa slot diisi oleh katalog tren organik.
func GetRotatedShowcase(db *gorm.DB, slotCode, productType string, limit int, sessionID, jwtSecret string) (*ShowcaseResult, error) {
	if db == nil {
		return nil, fmt.Errorf("database handle nil")
	}
	if limit <= 0 {
		limit = 4
	}
	if limit > 24 {
		limit = 24
	}

	result := &ShowcaseResult{
		SlotCode:     slotCode,
		Items:        make([]ShowcaseItem, 0),
		TargetEntity: "mixed",
	}

	// 1. Ambil Konfigurasi Master Slot
	var slot models.AdSlot
	slotExists := false
	if err := db.Where("slot_code = ? AND is_active = true", slotCode).First(&slot).Error; err == nil {
		slotExists = true
		result.SlotName = slot.Name
		result.TargetEntity = slot.TargetEntity
		if slot.MaxItemsDisplayed > 0 && limit > slot.MaxItemsDisplayed {
			limit = slot.MaxItemsDisplayed
		}
	} else {
		// Fallback nama default jika master slot belum dimigrasi
		result.SlotName = "Katalog Pilihan Beranda"
		if strings.Contains(slotCode, "product") {
			result.TargetEntity = "product"
		} else {
			result.TargetEntity = "store"
		}
	}

	now := time.Now().UTC()
	usedStoreIDs := make(map[uint]bool)

	// 2. Ambil Kampanye Iklan Aktif yang Memenuhi Syarat
	if slotExists {
		var activeCampaigns []models.AdCampaign
		query := db.Model(&models.AdCampaign{}).
			Preload("Store").
			Preload("TargetStore").
			Preload("TargetProduct").
			Where("ad_slot_id = ? AND status = 'active' AND ? BETWEEN start_at AND end_at AND deleted_at IS NULL", slot.ID, now)

		// Filter sektor industri jika diminta (misal: 'food', 'physical', dll.)
		if productType != "" && productType != "all" {
			query = query.Where("target_product_type = ? OR target_product_type = 'all'", productType)
		}

		_ = query.Find(&activeCampaigns).Error

		// 3. Eksekusi Weighted Time-Sliced Shuffling di Memori
		if len(activeCampaigns) > 0 {
			// Hitung Seed Deterministik Sesi: Hash(sessionID + current_hour_utc)
			hourBucket := now.Format("2006-01-02-15") // Berganti otomatis setiap jam
			seedString := fmt.Sprintf("%s:%s:%s", sessionID, hourBucket, slotCode)
			seedHash := sha256.Sum256([]byte(seedString))
			seedInt := int64(binary.BigEndian.Uint64(seedHash[:8]))
			rng := rand.New(rand.NewSource(seedInt))

			candidates := make([]weightedCandidate, 0, len(activeCampaigns))
			for _, camp := range activeCampaigns {
				// Abaikan jika toko pemilik sedang disuspend atau dibanned
				if camp.Store == nil || camp.Store.IsSuspended || camp.Store.IsBlacklisted {
					continue
				}

				// Bobot default minimal 1
				weight := camp.PriorityWeight
				if weight <= 0 {
					weight = 10
				}

				// Algoritma Weighted Reservoir Sampling (Efraimidis-Spirakis):
				// Score = -ln(U) / Weight (Di mana U adalah acak seragam antara 0 dan 1)
				u := rng.Float64()
				if u <= 0.000001 {
					u = 0.000001
				}
				score := -math.Log(u) / float64(weight)

				candidates = append(candidates, weightedCandidate{
					Campaign: camp,
					Score:    score,
				})
			}

			// Urutkan kandidat berdasarkan skor terendah
			sort.Slice(candidates, func(i, j int) bool {
				return candidates[i].Score < candidates[j].Score
			})

			// Masukkan kartu iklan bersponsor terpilih (Maksimal setengah dari kapasitas slot agar adil dengan organik)
			maxSponsored := limit / 2
			if maxSponsored < 1 {
				maxSponsored = 1
			}

			for _, c := range candidates {
				if len(result.Items) >= maxSponsored {
					break
				}
				camp := c.Campaign

				// De-duplikasi: 1 toko tidak boleh muncul ganda
				if usedStoreIDs[camp.StoreID] {
					continue
				}

				item := ShowcaseItem{
					IsSponsored:  true,
					BadgeText:    camp.CustomBadgeText,
					CampaignCode: camp.CampaignCode,
					AdSlotCode:   slotCode,
					ItemType:     camp.TargetType,
					StoreID:      camp.StoreID,
				}

				if camp.TargetType == "product" && camp.TargetProduct != nil {
					prod := camp.TargetProduct
					item.ProductID = prod.ID
					item.ProductName = prod.Name
					item.ProductPrice = prod.Price
					item.ProductImageURL = prod.ImageURL
					item.ProductType = prod.ProductType
					item.ConservationStatus = prod.ConservationStatus
					item.CategoryName = prod.GetEffectiveCategory()
					if camp.Store != nil {
						item.StoreSlug = camp.Store.Slug
						item.StoreTitle = camp.Store.StoreTitle
					}
					// Catat telemetri impresi secara non-blocking
					GetAdTelemetryService().RecordImpression(camp.ID, camp.AdSlotID, camp.StoreID)
					item.RedirectURL = GenerateSignedClickURL(camp.CampaignCode, fmt.Sprintf("/u/%s", item.StoreSlug), jwtSecret)
				} else if camp.Store != nil {
					// Target Profil Toko
					item.StoreSlug = camp.Store.Slug
					item.StoreTitle = camp.Store.StoreTitle
					item.StoreLogoURL = camp.Store.StoreLogoURL
					item.StoreSlogan = camp.Store.StoreSlogan
					item.StoreTheme = camp.Store.StoreTheme
					item.Plan = camp.Store.Plan
					GetAdTelemetryService().RecordImpression(camp.ID, camp.AdSlotID, camp.StoreID)
					item.RedirectURL = GenerateSignedClickURL(camp.CampaignCode, fmt.Sprintf("/u/%s", camp.Store.Slug), jwtSecret)
				}

				usedStoreIDs[camp.StoreID] = true
				result.Items = append(result.Items, item)
				result.SponsoredCount++
			}
		}
	}

	// 4. Isi Slot yang Tersisa dengan Katalog Populer Organik (Graceful Fallback)
	remainingSlots := limit - len(result.Items)
	if remainingSlots > 0 {
		if result.TargetEntity == "product" {
			// Isi dengan Produk Populer Organik (Berdasarkan trending_score_7d DESC atau popularity_score DESC)
			var organicProducts []models.Product
			prodQuery := db.Model(&models.Product{}).
				Preload("Store").
				Preload("Category").
				Where("products.is_active = true")

			// Saring toko yang di-blacklist
			prodQuery = prodQuery.Joins("INNER JOIN stores ON stores.id = products.store_id").
				Where("stores.is_blacklisted = false AND stores.is_suspended = false AND stores.dormancy_status NOT IN ('suspended', 'banned', 'purged')")

			if productType != "" && productType != "all" {
				prodQuery = prodQuery.Where("products.product_type = ?", productType)
			}

			// Kueri terindeks cepat: utamakan trending 7 hari, lalu akumulasi popularitas
			_ = prodQuery.Order("products.trending_score_7d DESC, products.popularity_score DESC, products.view_count DESC").
				Limit(remainingSlots * 2).
				Find(&organicProducts).Error

			for _, p := range organicProducts {
				if len(result.Items) >= limit {
					break
				}
				if usedStoreIDs[p.StoreID] {
					continue
				}

				item := ShowcaseItem{
					IsSponsored:        false,
					BadgeText:          "Tren Minggu Ini",
					ItemType:           "product",
					StoreID:            p.StoreID,
					ProductID:          p.ID,
					ProductName:        p.Name,
					ProductPrice:       p.Price,
					ProductImageURL:    p.ImageURL,
					ProductType:        p.ProductType,
					ConservationStatus: p.ConservationStatus,
					CategoryName:       p.GetEffectiveCategory(),
					TrendingScore7D:    p.TrendingScore7D,
					ViewCount:          p.ViewCount,
				}
				if p.Store != nil {
					item.StoreSlug = p.Store.Slug
					item.StoreTitle = p.Store.StoreTitle
					item.RedirectURL = fmt.Sprintf("/u/%s", p.Store.Slug)
				}

				usedStoreIDs[p.StoreID] = true
				result.Items = append(result.Items, item)
				result.OrganicCount++
			}
		} else {
			// Isi dengan Toko Populer Organik
			var organicStores []models.Store
			storeQuery := db.Model(&models.Store{}).
				Where("dormancy_status NOT IN ('suspended', 'banned', 'purged') AND is_blacklisted = false AND is_suspended = false")

			if productType != "" && productType != "all" {
				storeQuery = storeQuery.Where("primary_product_type = ?", productType)
			}

			_ = storeQuery.Order("stores.trending_score_7d DESC, stores.view_count DESC, stores.total_actions_count DESC").
				Limit(remainingSlots * 2).
				Find(&organicStores).Error

			for _, st := range organicStores {
				if len(result.Items) >= limit {
					break
				}
				if usedStoreIDs[st.ID] {
					continue
				}

				item := ShowcaseItem{
					IsSponsored:     false,
					BadgeText:       "Katalog Pilihan",
					ItemType:        "store",
					StoreID:         st.ID,
					StoreSlug:       st.Slug,
					StoreTitle:      st.StoreTitle,
					StoreLogoURL:    st.StoreLogoURL,
					StoreSlogan:     st.StoreSlogan,
					StoreTheme:      st.StoreTheme,
					Plan:            st.Plan,
					TrendingScore7D: st.TrendingScore7D,
					ViewCount:       st.ViewCount,
					RedirectURL:     fmt.Sprintf("/u/%s", st.Slug),
				}

				usedStoreIDs[st.ID] = true
				result.Items = append(result.Items, item)
				result.OrganicCount++
			}
		}
	}

	result.TotalReturned = len(result.Items)
	return result, nil
}

