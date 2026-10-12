package handlers

import (
	"bytes"
	"context"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"
	"catavor-backend/internal/storage"

	"github.com/disintegration/imaging"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

type StorageHandler struct {
	cfg     *config.Config
	storage storage.StorageService
	db      *gorm.DB
}

func NewStorageHandler(cfg *config.Config, storage storage.StorageService, db *gorm.DB) *StorageHandler {
	return &StorageHandler{
		cfg:     cfg,
		storage: storage,
		db:      db,
	}
}

// Upload handles secure, multi-tenant scoped image and support document uploads with magic-byte validation and EXIF sanitization.
func (h *StorageHandler) Upload(c *fiber.Ctx) error {
	file, err := c.FormFile("image")
	if err != nil {
		file, err = c.FormFile("file")
	}
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "File wajib diunggah.",
		})
	}

	// 1. Strict File Size Limit (Max 10MB)
	if file.Size > 10*1024*1024 {
		return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{
			"success": false,
			"message": "Ukuran file maksimal 10MB.",
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

	// Determine category
	category := strings.ToLower(strings.TrimSpace(c.Query("category", "")))
	if category == "" {
		category = strings.ToLower(strings.TrimSpace(c.FormValue("category", "products")))
	}
	switch category {
	case "rekber", "partner", "partners", "escrow", "platform_partner", "platform_partners":
		category = "platform_partners"
	case "platform", "platform_branding":
		category = "platform_branding"
	case "branding", "logo", "banner":
		category = "branding"
	case "articles", "article", "blog":
		category = "articles"
	case "support", "tickets", "ticket", "screenshots", "screenshot":
		category = "support"
	case "billing", "subscription", "payment", "proof":
		category = "billing"
	default:
		category = "products"
	}

	isPlatformScope := category == "platform_partners" || category == "platform_branding"

	// Check if store is suspended/banned: allow support & billing proofs, block catalog changes
	if store, ok := c.Locals("store").(*models.Store); ok && store != nil {
		if store.DormancyStatus == "banned" || store.IsBlacklisted {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "STORE_BANNED",
				"message": "Operasional toko telah ditangguhkan secara permanen.",
			})
		}
		if (store.DormancyStatus == "suspended" || store.IsSuspended) && category != "support" && category != "billing" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "STORE_SUSPENDED",
				"message": "Operasional toko sedang dibekukan sementara. Unggah file produk atau branding ditangguhkan. Silakan ajukan banding melalui Pusat Bantuan.",
			})
		}
	}

	// 2. Anti-MIME Spoofing Magic Number Validation & Processing
	sampleSize := len(fileBytes)
	if sampleSize > 512 {
		sampleSize = 512
	}
	mimeType := http.DetectContentType(fileBytes[:sampleSize])

	buf := new(bytes.Buffer)
	contentType := "image/jpeg"
	ext := ".jpg"

	// Special handling: PDF documents are allowed for support tickets, billing/payment proofs, digital products, or any valid PDF upload
	isPDF := bytes.HasPrefix(fileBytes, []byte("%PDF-")) || strings.EqualFold(filepath.Ext(file.Filename), ".pdf")
	if isPDF {
		// Strict verification: must start with PDF magic bytes
		if !bytes.HasPrefix(fileBytes, []byte("%PDF-")) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "File PDF tidak valid atau rusak (header signature tidak cocok).",
			})
		}
		contentType = "application/pdf"
		ext = ".pdf"
		buf = bytes.NewBuffer(fileBytes)
	} else {
		// Image processing
		if !strings.HasPrefix(mimeType, "image/") {
			if category == "support" {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"success": false,
					"message": "Format file tidak valid. Untuk tiket bantuan hanya format gambar (JPG, PNG, WEBP) atau dokumen PDF yang diperbolehkan.",
				})
			}
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Format file tidak valid. Hanya file gambar asli (JPG, PNG, WEBP, GIF) atau dokumen PDF yang diperbolehkan.",
			})
		}

		// 3. EXIF Payload Stripping & Memory Image Decoding
		img, _, err := image.Decode(bytes.NewReader(fileBytes))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Gagal mendekode gambar. Pastikan integritas file gambar valid.",
			})
		}

		// 4. Auto-Resize to max 1920x1920 maintaining aspect ratio
		bounds := img.Bounds()
		if bounds.Dx() > 1920 || bounds.Dy() > 1920 {
			img = imaging.Fit(img, 1920, 1920, imaging.Lanczos)
		}

		// 5. Re-encode Image cleanly without any EXIF/webshell metadata
		if err := jpeg.Encode(buf, img, &jpeg.Options{Quality: 85}); err != nil {
			buf.Reset()
			if err := png.Encode(buf, img); err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"success": false,
					"message": "Gagal memproses dan mengompresi gambar.",
				})
			}
			contentType = "image/png"
			ext = ".png"
		}
	}

	now := time.Now().UTC()
	uniqueID := uuid.New().String()
	var objectKey string

	var userID uint = 0
	var isStaffUser bool = false
	if userVal, ok := c.Locals("user").(*models.User); ok && userVal != nil {
		userID = userVal.ID
		isStaffUser = strings.EqualFold(userVal.PlatformRole, "superadmin") ||
			strings.EqualFold(userVal.PlatformRole, "support") ||
			strings.EqualFold(userVal.PlatformRole, "admin") ||
			userVal.Email == "admin@catavor.com"
	}

	var storeID uint = 0
	if !isPlatformScope && category != "support" {
		// Prioritaskan slug spesifik jika dikirim oleh klien (Multi Profil Katalog)
		requestedSlug := strings.TrimSpace(c.Get("X-Store-Slug"))
		if requestedSlug == "" {
			requestedSlug = strings.TrimSpace(c.Query("slug", c.FormValue("slug", "")))
		}
		if requestedSlug != "" {
			var s models.Store
			// Validasi bahwa toko dengan slug tersebut dimiliki oleh user atau diakses oleh admin
			query := h.db.Where("LOWER(slug) = ?", strings.ToLower(requestedSlug))
			if !isStaffUser && userID > 0 {
				query = query.Where("user_id = ?", userID)
			}
			if err := query.First(&s).Error; err == nil {
				storeID = s.ID
			}
		}

		// Fallback ke store context yang telah diverifikasi oleh middleware
		if storeID == 0 {
			if storeVal, ok := c.Locals("store").(*models.Store); ok && storeVal != nil {
				storeID = storeVal.ID
			}
		}
	}

	// Capture buffer length BEFORE passing it to storage.Upload (which consumes the buffer)
	uploadSize := int64(buf.Len())

	// Validate Storage Quota for Store Media:
	// - Exclude support tickets (support messages)
	// - Exclude billing/payment proofs (allows merchants to upload upgrade payment proof even when media quota is full)
	// - Exclude platform-level assets
	isQuotaCounted := storeID > 0 && category != "support" && category != "billing" && !isPlatformScope
	if isQuotaCounted {
		if allowed, msg := services.CanUploadStorage(h.db, storeID, uploadSize); !allowed {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"message": msg,
			})
		}
	}

	// Best Practice Folder Structure (S3-Ready Key Hierarchy):
	// - Platform Partners: platform/partners/rekber/YYYY/MM/uuid.ext
	// - Platform Branding: platform/branding/YYYY/MM/uuid.ext
	// - Support Tickets (Staff): support/staff/YYYY/MM/uuid.ext
	// - Support Tickets (Tickets): support/tickets/YYYY/MM/uuid.ext
	// - Billing & Invoices: stores/:id/billing/YYYY/MM/uuid.ext or billing/users/:id/...
	// - Store Media (Products/Branding): stores/:id/:category/YYYY/MM/uuid.ext
	// - Articles & News: articles/YYYY/MM/uuid.ext
	if category == "platform_partners" {
		objectKey = fmt.Sprintf("platform/partners/rekber/%d/%02d/%s%s", now.Year(), now.Month(), uniqueID, ext)
	} else if category == "platform_branding" {
		objectKey = fmt.Sprintf("platform/branding/%d/%02d/%s%s", now.Year(), now.Month(), uniqueID, ext)
	} else if category == "support" {
		if isStaffUser {
			objectKey = fmt.Sprintf("support/staff/%d/%02d/%s%s", now.Year(), now.Month(), uniqueID, ext)
		} else {
			objectKey = fmt.Sprintf("support/tickets/%d/%02d/%s%s", now.Year(), now.Month(), uniqueID, ext)
		}
	} else if category == "billing" {
		if storeID > 0 {
			objectKey = fmt.Sprintf("stores/%d/billing/%d/%02d/%s%s", storeID, now.Year(), now.Month(), uniqueID, ext)
		} else if userID > 0 {
			objectKey = fmt.Sprintf("billing/users/%d/%d/%02d/%s%s", userID, now.Year(), now.Month(), uniqueID, ext)
		} else {
			objectKey = fmt.Sprintf("billing/%d/%02d/%s%s", now.Year(), now.Month(), uniqueID, ext)
		}
	} else if category == "articles" {
		objectKey = fmt.Sprintf("articles/%d/%02d/%s%s", now.Year(), now.Month(), uniqueID, ext)
	} else if storeID > 0 {
		objectKey = fmt.Sprintf("stores/%d/%s/%d/%02d/%s%s", storeID, category, now.Year(), now.Month(), uniqueID, ext)
	} else {
		objectKey = fmt.Sprintf("general/%s/%d/%02d/%s%s", category, now.Year(), now.Month(), uniqueID, ext)
	}

	// 7. Store via Abstracted Storage Service (Local / S3 / MinIO)
	fileURL, err := h.storage.Upload(c.Context(), objectKey, buf, uploadSize, contentType)
	if err != nil {
		log.Error().Err(err).Str("key", objectKey).Msg("Failed to upload object to storage")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menyimpan file ke penyimpanan cloud / lokal.",
		})
	}

	// Atomically increment store storage_used_bytes with real upload size (only for counted tenant media)
	if isQuotaCounted && uploadSize > 0 {
		h.db.Model(&models.Store{}).Where("id = ?", storeID).UpdateColumn("storage_used_bytes", gorm.Expr("storage_used_bytes + ?", uploadSize))
		database.InvalidateStoreQuotaCache(context.Background(), storeID)
	}

	origFileName := filepath.Base(file.Filename)

	return c.JSON(fiber.Map{
		"success":        true,
		"key":            objectKey,
		"url":            fileURL,
		"file_name":      origFileName,
		"file_size":      file.Size,
		"file_type":      contentType,
		"category":       category,
		"storage_driver": h.storage.GetDriverName(),
	})
}

// DeleteFile handles secure deletion of files with ownership authorization.
func (h *StorageHandler) DeleteFile(c *fiber.Ctx) error {
	var payload struct {
		Key string `json:"key"`
	}

	if err := c.BodyParser(&payload); err != nil || payload.Key == "" {
		payload.Key = c.Query("key")
	}

	if payload.Key == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Kunci objek (key) wajib disertakan.",
		})
	}

	cleanKey := strings.TrimLeft(filepath.ToSlash(payload.Key), "/")

	// Anti-IDOR Ownership Verification:
	// A store can only delete objects prefixed with "stores/{store_id}/"
	store, ok := c.Locals("store").(*models.Store)
	if !ok || store == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses ditolak: Anda harus memiliki toko aktif.",
		})
	}

	expectedPrefix := fmt.Sprintf("stores/%d/", store.ID)
	if !strings.HasPrefix(cleanKey, expectedPrefix) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses tidak sah: Anda hanya diizinkan menghapus file milik toko Anda sendiri.",
		})
	}

	targetPath := filepath.Join(services.GetStorageRoot(), filepath.FromSlash(cleanKey))
	_ = os.Remove(targetPath + ".fiber.gz")

	if err := h.storage.Delete(c.Context(), cleanKey); err != nil {
		log.Error().Err(err).Str("key", cleanKey).Msg("Failed to delete object from storage")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghapus file dari penyimpanan.",
		})
	}

	if store != nil && store.ID > 0 {
		services.SyncStoreStorageUsed(h.db, store.ID)
		database.InvalidateStoreQuotaCache(context.Background(), store.ID)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "File berhasil dihapus dari penyimpanan.",
		"key":     cleanKey,
	})
}
