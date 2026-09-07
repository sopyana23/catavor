package handlers

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"catavor-backend/internal/config"
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

// Upload handles secure, multi-tenant scoped image uploads with magic-byte validation and EXIF sanitization.
func (h *StorageHandler) Upload(c *fiber.Ctx) error {
	file, err := c.FormFile("image")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "File gambar wajib diunggah.",
		})
	}

	// 1. Strict File Size Limit (Max 10MB)
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

	// 2. Anti-MIME Spoofing Magic Number Validation
	sampleSize := len(fileBytes)
	if sampleSize > 512 {
		sampleSize = 512
	}
	mimeType := http.DetectContentType(fileBytes[:sampleSize])
	if !strings.HasPrefix(mimeType, "image/") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format file tidak valid. Hanya file gambar asli (JPG, PNG, WEBP, GIF) yang diperbolehkan.",
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
	buf := new(bytes.Buffer)
	contentType := "image/jpeg"
	ext := ".jpg"

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

	// 6. Multi-Tenant Scoped Object Key Generation
	category := strings.ToLower(strings.TrimSpace(c.Query("category", c.FormValue("category", "products"))))
	switch category {
	case "branding", "logo", "banner":
		category = "branding"
	case "articles", "article", "blog":
		category = "articles"
	case "support", "tickets", "ticket", "screenshots", "screenshot":
		category = "support"
	default:
		category = "products"
	}

	now := time.Now().UTC()
	uniqueID := uuid.New().String()
	var objectKey string

	var storeID uint = 0
	if storeVal, ok := c.Locals("store").(*models.Store); ok && storeVal != nil {
		storeID = storeVal.ID
	}

	var userID uint = 0
	if userVal, ok := c.Locals("user").(*models.User); ok && userVal != nil {
		userID = userVal.ID
	}

	// Validate Storage Quota for Store Media (excluding pure support tickets)
	if storeID > 0 && category != "support" {
		if allowed, msg := services.CanUploadStorage(h.db, storeID, int64(buf.Len())); !allowed {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"message": msg,
			})
		}
	}

	// Structure: stores/:id/:category/YYYY/MM/uuid.ext or support/users/:id/YYYY/MM/uuid.ext
	if category == "support" {
		if storeID > 0 {
			objectKey = fmt.Sprintf("stores/%d/support/%d/%02d/%s%s", storeID, now.Year(), now.Month(), uniqueID, ext)
		} else if userID > 0 {
			objectKey = fmt.Sprintf("support/users/%d/%d/%02d/%s%s", userID, now.Year(), now.Month(), uniqueID, ext)
		} else {
			objectKey = fmt.Sprintf("support/%d/%02d/%s%s", now.Year(), now.Month(), uniqueID, ext)
		}
	} else if category == "articles" {
		objectKey = fmt.Sprintf("articles/%d/%02d/%s%s", now.Year(), now.Month(), uniqueID, ext)
	} else if storeID > 0 {
		objectKey = fmt.Sprintf("stores/%d/%s/%d/%02d/%s%s", storeID, category, now.Year(), now.Month(), uniqueID, ext)
	} else {
		objectKey = fmt.Sprintf("general/%s/%d/%02d/%s%s", category, now.Year(), now.Month(), uniqueID, ext)
	}

	// 7. Store via Abstracted Storage Service (Local / S3 / MinIO)
	fileURL, err := h.storage.Upload(c.Context(), objectKey, buf, int64(buf.Len()), contentType)
	if err != nil {
		log.Error().Err(err).Str("key", objectKey).Msg("Failed to upload object to storage")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menyimpan file ke penyimpanan cloud / lokal.",
		})
	}

	// Atomically increment store storage_used_bytes
	if storeID > 0 {
		h.db.Model(&models.Store{}).Where("id = ?", storeID).UpdateColumn("storage_used_bytes", gorm.Expr("storage_used_bytes + ?", int64(buf.Len())))
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

	if err := h.storage.Delete(c.Context(), cleanKey); err != nil {
		log.Error().Err(err).Str("key", cleanKey).Msg("Failed to delete object from storage")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghapus file dari penyimpanan.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "File berhasil dihapus dari penyimpanan.",
		"key":     cleanKey,
	})
}
