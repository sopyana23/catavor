package handlers

import (
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/middleware"
	"catavor-backend/internal/models"
	"catavor-backend/internal/services"
	"catavor-backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

type SubscriptionHandler struct {
	cfg     *config.Config
	db      *gorm.DB
	storage storage.StorageService
}

func NewSubscriptionHandler(db *gorm.DB, opts ...interface{}) *SubscriptionHandler {
	h := &SubscriptionHandler{db: db}
	for _, opt := range opts {
		switch v := opt.(type) {
		case *config.Config:
			h.cfg = v
		case storage.StorageService:
			h.storage = v
		}
	}
	return h
}

// GetPlans returns all active subscription tiers (Free, Pro Starter, Pro Bisnis)
func (h *SubscriptionHandler) GetPlans(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	plans, err := services.GetSubscriptionPlans(h.db)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat paket langganan.",
		})
	}

	c.Set("Cache-Control", "public, max-age=600, stale-while-revalidate=86400")
	return c.JSON(fiber.Map{
		"success": true,
		"data":    plans,
	})
}

// GetStoreQuota returns current quota usage, limits, and plan details for the logged-in store
func (h *SubscriptionHandler) GetStoreQuota(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	storeIDVal := c.Locals("store_id")
	if storeIDVal == nil {
		user, _ := c.Locals("user").(*models.User)
		userRole, _ := c.Locals("platform_role").(string)
		isSuperadmin, _ := c.Locals("is_superadmin").(bool)
		if (user != nil && user.IsPlatformStaff()) || models.IsPlatformStaffRole(userRole) || isSuperadmin {
			quota := services.StoreQuotaInfo{
				StoreID:    0,
				StoreSlug:  "platform-admin",
				StoreTitle: "Platform Admin Console",
				Plan: models.SubscriptionPlan{
					Code:               "platform_staff",
					Name:               "Platform Console",
					BadgeLabel:         "Console",
					Description:        "Platform Staff Console Access",
					StorageLimitBytes:  0,
					MaxItems:           -1,
					MaxImagesPerItem:   10,
					HasCustomDomain:    true,
					HasVerifiedBadge:   true,
					HasPrioritySearch:  true,
					HasPrioritySupport: true,
					IsActive:           true,
				},
				PlanStatus:          "active",
				DaysRemaining:       9999,
				IsInGracePeriod:     false,
				ActiveItemsCount:    0,
				ArchivedItemsCount:  0,
				TotalItemsCount:     0,
				MaxItems:            -1,
				StorageUsedBytes:    0,
				StorageLimitBytes:   0,
				StorageUsagePercent: 0,
				ItemsUsagePercent:   0,
				IsStorageOverLimit:  false,
				IsItemsOverLimit:    false,
				CustomDomainStatus:  "none",
			}
			return c.JSON(fiber.Map{
				"success": true,
				"data":    quota,
			})
		}

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "STORE_REQUIRED",
			"message": "Autentikasi toko diperlukan.",
		})
	}
	storeID := storeIDVal.(uint)

	quota, err := services.GetStoreQuotaInfo(h.db, storeID)
	if err != nil {
		log.Error().Err(err).Msg("subscription: gagal mengambil kuota toko")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil data kuota toko.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    quota,
	})
}

// UpgradePlan handles instant upgrade or renewal of store plan
func (h *SubscriptionHandler) UpgradePlan(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	storeIDVal := c.Locals("store_id")
	if storeIDVal == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "STORE_REQUIRED",
			"message": "Autentikasi toko diperlukan.",
		})
	}
	storeID := storeIDVal.(uint)

	// Security Defense: Restrict direct plan upgrade to Platform Admins / Superadmins
	userRole, _ := c.Locals("platform_role").(string)
	isSuperadmin, _ := c.Locals("is_superadmin").(bool)
	if userRole != "admin" && userRole != "superadmin" && !isSuperadmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Peningkatan paket langsung hanya dapat dilakukan oleh administrator platform. Silakan gunakan alur checkout pesanan langganan.",
		})
	}

	var req struct {
		PlanCode string `json:"plan_code"`
		Months   int    `json:"months"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Payload permintaan tidak valid.",
		})
	}

	planCode := strings.ToLower(strings.TrimSpace(req.PlanCode))
	if planCode == "" {
		planCode = "pro_starter"
	}
	if req.Months <= 0 {
		req.Months = 1
	}

	quota, err := services.UpgradeStorePlan(h.db, storeID, planCode, req.Months)
	if err != nil {
		log.Error().Err(err).Msg("subscription: UpgradeStorePlan gagal")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Gagal meningkatkan paket langganan."),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Paket langganan berhasil diperbarui.",
		"data":    quota,
	})
}

// ScheduleDowngrade schedules a downgrade at the end of the billing cycle
func (h *SubscriptionHandler) ScheduleDowngrade(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	storeIDVal := c.Locals("store_id")
	if storeIDVal == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "STORE_REQUIRED",
			"message": "Autentikasi toko diperlukan.",
		})
	}
	storeID := storeIDVal.(uint)

	var req struct {
		TargetPlanCode string `json:"target_plan_code"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Payload tidak valid.",
		})
	}

	targetCode := strings.ToLower(strings.TrimSpace(req.TargetPlanCode))
	if targetCode == "" {
		targetCode = "free"
	}

	quota, err := services.ScheduleStoreDowngrade(h.db, storeID, targetCode)
	if err != nil {
		log.Error().Err(err).Msg("subscription: ScheduleStoreDowngrade gagal")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Gagal menjadwalkan penurunan paket."),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Perubahan paket berhasil dijadwalkan pada akhir periode langganan saat ini.",
		"data":    quota,
	})
}

// UpdateCustomDomain sets or verifies custom domain for Pro Business stores
func (h *SubscriptionHandler) UpdateCustomDomain(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	storeIDVal := c.Locals("store_id")
	if storeIDVal == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "STORE_REQUIRED",
			"message": "Autentikasi toko diperlukan.",
		})
	}
	storeID := storeIDVal.(uint)

	var store models.Store
	if err := h.db.First(&store, storeID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Toko tidak ditemukan.",
		})
	}

	plan, _ := services.GetPlanByCode(h.db, store.Plan)
	if plan == nil || !plan.HasCustomDomain {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Fitur Custom Domain hanya tersedia untuk paket Pro Bisnis. Silakan upgrade paket Anda.",
		})
	}

	var req struct {
		CustomDomain string `json:"custom_domain"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Payload tidak valid.",
		})
	}

	domain := strings.ToLower(strings.TrimSpace(req.CustomDomain))
	domain = strings.TrimPrefix(domain, "https://")
	domain = strings.TrimPrefix(domain, "http://")
	domain = strings.TrimRight(domain, "/")

	if domain == "" {
		store.CustomDomain = nil
		store.CustomDomainStatus = "none"
	} else {
		var existing models.Store
		if err := h.db.Where("custom_domain = ? AND id != ?", domain, storeID).First(&existing).Error; err == nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Domain ini sudah digunakan oleh toko lain.",
			})
		}
		store.CustomDomain = &domain
		store.CustomDomainStatus = "active"
	}

	if err := h.db.Save(&store).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui custom domain.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Pengaturan custom domain berhasil disimpan.",
		"data": fiber.Map{
			"custom_domain":        store.CustomDomain,
			"custom_domain_status": store.CustomDomainStatus,
		},
	})
}

// CreateOrder handles creating a new subscription invoice, processing payment/coupon, and activating plan
func (h *SubscriptionHandler) CreateOrder(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	storeIDVal := c.Locals("store_id")
	userIDVal := c.Locals("user_id")
	if userIDVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}
	if storeIDVal == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "STORE_REQUIRED",
			"message": "Autentikasi toko diperlukan.",
		})
	}
	storeID := storeIDVal.(uint)
	userID := userIDVal.(uint)

	var req services.CreateOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data pesanan tidak valid.",
		})
	}

	order, quota, err := services.CreateSubscriptionOrder(h.db, storeID, userID, req)
	if err != nil {
		log.Error().Err(err).Msg("subscription: CreateSubscriptionOrder gagal")
		if strings.Contains(err.Error(), "PAYMENT_GATEWAY_MAINTENANCE") {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"success": false,
				"code":    "PAYMENT_GATEWAY_MAINTENANCE",
				"message": "Sistem transaksi pembayaran sedang dalam masa pemeliharaan berkala. Silakan coba kembali beberapa saat lagi.",
			})
		}
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Gagal membuat pesanan langganan."),
		})
	}

	msg := "Transaksi langganan berhasil diproses dan paket Anda telah aktif."
	if order.PaymentStatus != "paid" {
		msg = "Pesanan langganan berhasil dibuat. Silakan selesaikan pembayaran agar paket dapat diverifikasi dan diaktifkan."
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": msg,
		"order":   order,
		"quota":   quota,
	})
}

// GetOrders returns subscription invoice history for the authenticated store
func (h *SubscriptionHandler) GetOrders(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	storeIDVal := c.Locals("store_id")
	if storeIDVal == nil {
		user, _ := c.Locals("user").(*models.User)
		userRole, _ := c.Locals("platform_role").(string)
		isSuperadmin, _ := c.Locals("is_superadmin").(bool)
		if (user != nil && user.IsPlatformStaff()) || models.IsPlatformStaffRole(userRole) || isSuperadmin {
			return c.JSON(fiber.Map{
				"success": true,
				"data":    []models.SubscriptionOrder{},
			})
		}
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "STORE_REQUIRED",
			"message": "Autentikasi toko diperlukan.",
		})
	}
	storeID := storeIDVal.(uint)

	orders, err := services.GetStoreSubscriptionOrders(h.db, storeID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat riwayat transaksi langganan.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    orders,
	})
}

// GetOrderProof securely serves a subscription order's payment proof image with strict authorization.
func (h *SubscriptionHandler) GetOrderProof(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	idParam := strings.TrimSpace(c.Params("id"))
	if idParam == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Parameter ID atau nomor pesanan tidak valid.",
		})
	}

	var order models.SubscriptionOrder
	query := h.db.Model(&models.SubscriptionOrder{})
	if num, err := strconv.ParseUint(idParam, 10, 64); err == nil && num > 0 {
		query = query.Where("id = ? OR LOWER(order_number) = LOWER(?)", num, idParam)
	} else {
		query = query.Where("LOWER(order_number) = LOWER(?)", idParam)
	}

	if err := query.First(&order).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Pesanan langganan tidak ditemukan.",
		})
	}

	proofURL := strings.TrimSpace(order.PaymentProofURL)
	if proofURL == "" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Bukti pembayaran belum diunggah untuk pesanan ini.",
		})
	}

	// 1. Resolve User and Authenticate
	user, _ := c.Locals("user").(*models.User)
	if user == nil && h.cfg != nil {
		// Try cookie, authorization header, or ?token= query param
		claims := middleware.ExtractOptionalClaims(c, h.cfg)
		if claims == nil {
			if tokenParam := strings.TrimSpace(c.Query("token")); tokenParam != "" {
				parsedClaims := &middleware.JWTClaims{}
				token, err := jwt.ParseWithClaims(tokenParam, parsedClaims, func(t *jwt.Token) (interface{}, error) {
					if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
						return nil, errors.New("unexpected signing algorithm")
					}
					return []byte(h.cfg.JWTSecret), nil
				},
					jwt.WithValidMethods([]string{"HS256"}),
					jwt.WithIssuer(middleware.JWTIssuer),
					jwt.WithAudience(middleware.JWTAudience),
				)
				if err == nil && token.Valid {
					claims = parsedClaims
				}
			}
		}

		if claims != nil && claims.UserID > 0 {
			var u models.User
			if err := h.db.First(&u, claims.UserID).Error; err == nil {
				user = &u
			}
		}
	}

	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan untuk melihat bukti transfer langganan.",
		})
	}

	// 2. Strict RBAC / Ownership Authorization Check
	isStaff := user.IsPlatformStaff()
	isOwner := user.ID == order.UserID

	if !isOwner && order.StoreID > 0 {
		if store, ok := c.Locals("store").(*models.Store); ok && store != nil && store.ID == order.StoreID {
			isOwner = true
		} else {
			var count int64
			h.db.Model(&models.Store{}).Where("id = ? AND user_id = ?", order.StoreID, user.ID).Count(&count)
			if count > 0 {
				isOwner = true
			}
		}
	}

	if !isStaff && !isOwner {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses ditolak: Anda tidak memiliki izin untuk melihat bukti transfer pesanan ini.",
		})
	}

	// 3. Handle base64 Data URLs
	if strings.HasPrefix(proofURL, "data:") {
		parts := strings.SplitN(proofURL, ",", 2)
		if len(parts) == 2 {
			mimeType := "image/jpeg"
			meta := parts[0]
			if strings.Contains(meta, ":") && strings.Contains(meta, ";") {
				mimeType = meta[strings.Index(meta, ":")+1 : strings.Index(meta, ";")]
			}
			data, err := base64.StdEncoding.DecodeString(parts[1])
			if err == nil && len(data) > 0 {
				c.Set("Content-Type", mimeType)
				c.Set("Cache-Control", "private, max-age=3600")
				c.Set("X-Content-Type-Options", "nosniff")
				return c.Send(data)
			}
		}
	}

	// 4. Handle External URLs
	if strings.HasPrefix(proofURL, "http://") || strings.HasPrefix(proofURL, "https://") {
		return c.Redirect(proofURL, fiber.StatusFound)
	}

	// 5. Clean up Storage Key and prepare candidate paths
	cleanKey := strings.TrimLeft(filepath.ToSlash(proofURL), "/")
	cleanKey = strings.TrimPrefix(cleanKey, "storage/")
	cleanKey = strings.TrimLeft(cleanKey, "/")

	candidateKeys := make([]string, 0, 4)
	if cleanKey != "" {
		candidateKeys = append(candidateKeys, cleanKey)
		if strings.HasPrefix(cleanKey, storage.PrivateKeyPrefix) {
			candidateKeys = append(candidateKeys, strings.TrimPrefix(cleanKey, storage.PrivateKeyPrefix))
		} else {
			candidateKeys = append(candidateKeys, storage.PrivateKeyPrefix+cleanKey)
		}
	}

	// Try retrieval from configured storage service (Cloudflare R2 / S3 / MinIO / Local)
	if h.storage != nil {
		for _, key := range candidateKeys {
			if strings.Contains(key, "..") || filepath.IsAbs(key) || strings.Contains(key, ":") {
				continue
			}
			rc, cType, _, err := h.storage.Get(c.Context(), key)
			if err == nil && rc != nil {
				data, readErr := io.ReadAll(rc)
				_ = rc.Close()
				if readErr == nil && len(data) > 0 {
					if cType == "" {
						cType = detectOrderProofContentType(key)
					}
					c.Set("Content-Type", cType)
					c.Set("Cache-Control", "private, max-age=3600")
					c.Set("X-Content-Type-Options", "nosniff")
					return c.Send(data)
				}
			}
		}
	}

	// Fallback to local filesystem paths
	localCandidates := make([]string, 0, 8)
	if h.cfg != nil {
		for _, key := range candidateKeys {
			rel := filepath.FromSlash(key)
			if h.cfg.StoragePrivateRoot != "" {
				localCandidates = append(localCandidates, filepath.Join(h.cfg.StoragePrivateRoot, rel))
				localCandidates = append(localCandidates, filepath.Join(h.cfg.StoragePrivateRoot, strings.TrimPrefix(rel, "private"+string(os.PathSeparator))))
			}
			if h.cfg.StorageLocalRoot != "" {
				localCandidates = append(localCandidates, filepath.Join(h.cfg.StorageLocalRoot, rel))
				localCandidates = append(localCandidates, filepath.Join(h.cfg.StorageLocalRoot, strings.TrimPrefix(rel, "private"+string(os.PathSeparator))))
			}
		}
	}
	// Common relative paths in repo
	for _, key := range candidateKeys {
		rel := filepath.FromSlash(key)
		localCandidates = append(localCandidates, filepath.Join("storage", "private", strings.TrimPrefix(rel, "private"+string(os.PathSeparator))))
		localCandidates = append(localCandidates, filepath.Join("public", "storage", rel))
	}

	for _, cand := range localCandidates {
		if fi, err := os.Stat(cand); err == nil && !fi.IsDir() {
			cType := detectOrderProofContentType(cand)
			c.Set("Content-Type", cType)
			c.Set("Cache-Control", "private, max-age=3600")
			c.Set("X-Content-Type-Options", "nosniff")
			return c.SendFile(cand)
		}
	}

	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
		"success": false,
		"message": "File fisik bukti pembayaran tidak ditemukan di penyimpanan server.",
	})
}

func detectOrderProofContentType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".svg":
		return "image/svg+xml"
	case ".pdf":
		return "application/pdf"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	}
	return "image/jpeg"
}

// CancelDowngrade cancels any scheduled downgrade for the authenticated store
func (h *SubscriptionHandler) CancelDowngrade(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	storeIDVal := c.Locals("store_id")
	if storeIDVal == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "STORE_REQUIRED",
			"message": "Autentikasi toko diperlukan.",
		})
	}
	storeID := storeIDVal.(uint)

	quota, err := services.CancelStoreDowngrade(h.db, storeID)
	if err != nil {
		log.Error().Err(err).Msg("subscription: CancelStoreDowngrade gagal")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Gagal membatalkan penurunan paket."),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Jadwal downgrade berhasil dibatalkan. Paket langganan Anda tetap berlanjut.",
		"data":    quota,
	})
}

// ApproveOrder allows platform admin to verify payment and activate subscription plan
func (h *SubscriptionHandler) ApproveOrder(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	orderIDVal, err := c.ParamsInt("id")
	if err != nil || orderIDVal <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "ID pesanan langganan tidak valid.",
		})
	}

	adminIDVal := c.Locals("user_id")
	var adminID uint = 0
	if adminIDVal != nil {
		adminID = adminIDVal.(uint)
	}

	order, quota, err := services.ApproveSubscriptionOrder(h.db, uint(orderIDVal), adminID)
	if err != nil {
		log.Error().Err(err).Msg("subscription: ApproveSubscriptionOrder gagal")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Gagal menyetujui pesanan langganan."),
		})
	}

	// SECURITY (N-20): persetujuan invoice mengaktifkan paket berbayar tanpa
	// verifikasi pembayaran otomatis, sehingga aksi ini WAJIB meninggalkan
	// jejak siapa pelakunya. Sebelumnya hanya tercatat di stdout (zerolog)
	// yang hilang saat rotasi log, sementara aksi katalog biasa sudah masuk
	// activity_logs. Catat agar penyalahgunaan wewenang finance dapat ditelusuri.
	adminEmail, _ := c.Locals("email").(string)
	catatAktivitasApprove(h.db, c, "billing.subscription_approve", "Invoice langganan disetujui",
		order, adminID, adminEmail)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Invoice langganan berhasil disetujui dan paket toko telah aktif.",
		"order":   order,
		"quota":   quota,
	})
}

// catatAktivitasApprove menulis entri audit untuk persetujuan invoice
// langganan. Dipisah agar dapat diuji dan agar kegagalan pencatatan tidak
// membatalkan aksi yang sudah terjadi.
func catatAktivitasApprove(db *gorm.DB, c *fiber.Ctx, action, deskripsi string,
	order *models.SubscriptionOrder, adminID uint, adminEmail string) {
	if order == nil {
		return
	}
	storeID := order.StoreID
	entityID := order.ID
	actorID := adminID
	services.RecordActivity(services.RecordActivityParams{
		DB:          db,
		StoreID:     &storeID,
		UserID:      &actorID,
		ActorRole:   "superadmin",
		ActorEmail:  adminEmail,
		Action:      action,
		Category:    "billing",
		EntityType:  "plan",
		EntityID:    &entityID,
		EntityTitle: order.OrderNumber,
		Description: deskripsi,
		Changes: map[string]interface{}{
			"plan_code":      order.PlanCode,
			"duration_month": order.DurationMonths,
			"payment_status": order.PaymentStatus,
			"approved_by":    adminID,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})
}

// RejectOrder allows platform admin to reject an invalid subscription payment
func (h *SubscriptionHandler) RejectOrder(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	orderIDVal, err := c.ParamsInt("id")
	if err != nil || orderIDVal <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "ID pesanan langganan tidak valid.",
		})
	}

	var req struct {
		Reason          string `json:"reason"`
		RejectionReason string `json:"rejection_reason"`
	}
	_ = c.BodyParser(&req)
	finalReason := strings.TrimSpace(req.Reason)
	if finalReason == "" {
		finalReason = strings.TrimSpace(req.RejectionReason)
	}

	adminIDVal := c.Locals("user_id")
	var adminID uint = 0
	if adminIDVal != nil {
		adminID = adminIDVal.(uint)
	}

	order, err := services.RejectSubscriptionOrder(h.db, uint(orderIDVal), adminID, finalReason)
	if err != nil {
		log.Error().Err(err).Msg("subscription: RejectSubscriptionOrder gagal")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Gagal menolak pesanan langganan."),
		})
	}

	adminEmail, _ := c.Locals("email").(string)
	catatAktivitasReject(h.db, c, "billing.subscription_reject", "Invoice langganan ditolak",
		order, adminID, adminEmail, finalReason)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Invoice langganan berhasil ditolak.",
		"order":   order,
	})
}

// AdminUpdateOrder handles PUT /api/admin/subscription/orders/:id for frontend compatibility
func (h *SubscriptionHandler) AdminUpdateOrder(c *fiber.Ctx) error {
	var req struct {
		Status          string `json:"status"` // active | paid | rejected | pending | pending_verification
		Reason          string `json:"reason"`
		RejectionReason string `json:"rejection_reason"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Payload permintaan tidak valid.",
		})
	}

	st := strings.ToLower(strings.TrimSpace(req.Status))
	if st == "active" || st == "paid" {
		return h.ApproveOrder(c)
	} else if st == "rejected" {
		return h.RejectOrder(c)
	} else if st == "pending" || st == "pending_verification" {
		orderIDVal, err := c.ParamsInt("id")
		if err != nil || orderIDVal <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "ID pesanan langganan tidak valid.",
			})
		}
		var adminID uint = 0
		if adminIDVal := c.Locals("user_id"); adminIDVal != nil {
			adminID = adminIDVal.(uint)
		}
		order, err := services.ResetSubscriptionOrderToPending(h.db, uint(orderIDVal), adminID)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": safeErrMsg(err, "Gagal mengembalikan pesanan ke antrean verifikasi."),
			})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Pesanan dikembalikan ke antrean verifikasi.",
			"order":   order,
		})
	}

	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
		"success": false,
		"message": "Status tidak valid. Gunakan 'active', 'rejected', atau 'pending_verification'.",
	})
}

func catatAktivitasReject(db *gorm.DB, c *fiber.Ctx, action, deskripsi string,
	order *models.SubscriptionOrder, adminID uint, adminEmail string, reason string) {
	if order == nil {
		return
	}
	storeID := order.StoreID
	entityID := order.ID
	actorID := adminID
	services.RecordActivity(services.RecordActivityParams{
		DB:          db,
		StoreID:     &storeID,
		UserID:      &actorID,
		ActorRole:   "superadmin",
		ActorEmail:  adminEmail,
		Action:      action,
		Category:    "billing",
		EntityType:  "plan",
		EntityID:    &entityID,
		EntityTitle: order.OrderNumber,
		Description: deskripsi,
		Changes: map[string]interface{}{
			"plan_code":        order.PlanCode,
			"payment_status":   order.PaymentStatus,
			"rejection_reason": reason,
			"rejected_by":      adminID,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})
}

// AdminListOrders allows platform admin to view all subscription orders
func (h *SubscriptionHandler) AdminListOrders(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	var orders []models.SubscriptionOrder
	query := h.db.Preload("Store").Preload("User").Preload("ApprovedByUser").Order("created_at desc")
	if status := c.Query("status"); status != "" {
		query = query.Where("payment_status = ?", status)
	}
	if err := query.Find(&orders).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat daftar transaksi langganan.",
		})
	}
	return c.JSON(fiber.Map{
		"success": true,
		"data":    orders,
	})
}

// VerifyCouponRequest represents payload to validate a coupon code
type VerifyCouponRequest struct {
	Code         string `json:"code"`
	Plan         string `json:"plan"`
	BillingCycle string `json:"billing_cycle"`
}

// VerifyCoupon validates a coupon code publicly or for logged-in stores
func (h *SubscriptionHandler) VerifyCoupon(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	var req VerifyCouponRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format request tidak valid.",
		})
	}

	cleanCode := strings.ToUpper(strings.TrimSpace(req.Code))
	if cleanCode == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Kode kupon tidak boleh kosong.",
		})
	}

	planCode := strings.ToLower(strings.TrimSpace(req.Plan))
	if planCode == "" || planCode == "pro" {
		planCode = "pro_starter"
	}

	// Strict platform policy: Only monthly billing cycle is supported (no annual)
	var originalAmount float64
	planInfo, _ := services.GetPlanByCode(h.db, planCode)
	if planInfo != nil {
		originalAmount = planInfo.PriceMonthly
	} else {
		// Fallbacks
		if planCode == "pro_business" {
			originalAmount = 129000
		} else {
			originalAmount = 30000
		}
	}

	coupon, discountAmount, finalAmount, err := services.ValidateCoupon(h.db, cleanCode, planCode, originalAmount)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": err.Error(),
		})
	}

	couponMap := fiber.Map{
		"code":           coupon.Code,
		"label":          coupon.Label,
		"type":           coupon.Type,
		"discount":       discountAmount,
		"final_price":    finalAmount,
		"original_price": originalAmount,
		"description":    coupon.Label,
	}

	return c.JSON(fiber.Map{
		"success": true,
		"valid":   true,
		"coupon":  couponMap,
		"data":    couponMap,
	})
}

// AdminListCoupons returns all platform coupons for platform administrators
func (h *SubscriptionHandler) AdminListCoupons(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	coupons, err := services.GetMasterCoupons(h.db)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mengambil daftar kupon platform.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    coupons,
	})
}

// AdminCreateCoupon handles creation of a new coupon by platform admin
func (h *SubscriptionHandler) AdminCreateCoupon(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	var input services.MasterCoupon
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Payload kupon tidak valid.",
		})
	}

	input.Code = strings.ToUpper(strings.TrimSpace(input.Code))
	if input.Code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Kode kupon wajib diisi.",
		})
	}

	codeRegex := regexp.MustCompile(`^[A-Z0-9_-]{3,30}$`)
	if !codeRegex.MatchString(input.Code) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Kode kupon hanya boleh memuat huruf kapital, angka, garis bawah, dan strip (3-30 karakter).",
		})
	}

	input.Label = strings.TrimSpace(input.Label)
	if input.Label == "" {
		input.Label = fmt.Sprintf("Kupon Diskon %s", input.Code)
	}

	input.Type = strings.ToLower(strings.TrimSpace(input.Type))
	if input.Type != "free" && input.Type != "discount" {
		input.Type = "discount"
	}

	if input.Type == "discount" && input.Discount <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Nominal potongan diskon harus lebih besar dari Rp 0.",
		})
	}

	coupons, err := services.GetMasterCoupons(h.db)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat master kupon.",
		})
	}

	for _, cItem := range coupons {
		if strings.ToUpper(cItem.Code) == input.Code {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"success": false,
				"message": fmt.Sprintf("Kode kupon \"%s\" sudah terdaftar. Gunakan kode lain.", input.Code),
			})
		}
	}

	now := time.Now().UTC()
	input.ID = fmt.Sprintf("cpn_%d", now.UnixNano())
	input.CreatedAt = now
	input.UpdatedAt = now
	input.UsedCount = 0

	coupons = append([]services.MasterCoupon{input}, coupons...)
	if err := services.SaveMasterCoupons(h.db, coupons); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menyimpan kupon baru ke database.",
		})
	}

	adminID := uint(0)
	adminEmail := ""
	if u, ok := c.Locals("user").(*models.User); ok && u != nil {
		adminID = u.ID
		adminEmail = u.Email
	}
	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		UserID:      &adminID,
		ActorRole:   "superadmin",
		ActorEmail:  adminEmail,
		Action:      "coupon.create",
		Category:    "billing",
		EntityType:  "coupon",
		EntityTitle: input.Code,
		Description: fmt.Sprintf("Membuat kupon diskon %s (%s)", input.Code, input.Label),
		Changes: map[string]interface{}{
			"code":     input.Code,
			"label":    input.Label,
			"type":     input.Type,
			"discount": input.Discount,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	return c.JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("Kupon \"%s\" berhasil dibuat.", input.Code),
		"data":    input,
	})
}

// AdminUpdateCoupon handles editing an existing coupon
func (h *SubscriptionHandler) AdminUpdateCoupon(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	targetCode := strings.ToUpper(strings.TrimSpace(c.Params("code")))
	if targetCode == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Parameter kode kupon tidak valid.",
		})
	}

	var input services.MasterCoupon
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Payload kupon tidak valid.",
		})
	}

	coupons, err := services.GetMasterCoupons(h.db)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat master kupon.",
		})
	}

	foundIdx := -1
	for i, cItem := range coupons {
		if strings.ToUpper(cItem.Code) == targetCode {
			foundIdx = i
			break
		}
	}

	if foundIdx == -1 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": fmt.Sprintf("Kupon \"%s\" tidak ditemukan.", targetCode),
		})
	}

	if input.Label != "" {
		coupons[foundIdx].Label = strings.TrimSpace(input.Label)
	}
	if input.Type == "free" || input.Type == "discount" {
		coupons[foundIdx].Type = input.Type
	}
	if coupons[foundIdx].Type == "discount" && input.Discount > 0 {
		coupons[foundIdx].Discount = input.Discount
	} else if coupons[foundIdx].Type == "free" {
		coupons[foundIdx].Discount = 0
	}
	coupons[foundIdx].UsageLimit = input.UsageLimit
	coupons[foundIdx].ExpiresAt = input.ExpiresAt
	coupons[foundIdx].IsActive = input.IsActive
	coupons[foundIdx].UpdatedAt = time.Now().UTC()

	if err := services.SaveMasterCoupons(h.db, coupons); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui kupon.",
		})
	}

	adminID := uint(0)
	adminEmail := ""
	if u, ok := c.Locals("user").(*models.User); ok && u != nil {
		adminID = u.ID
		adminEmail = u.Email
	}
	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		UserID:      &adminID,
		ActorRole:   "superadmin",
		ActorEmail:  adminEmail,
		Action:      "coupon.update",
		Category:    "billing",
		EntityType:  "coupon",
		EntityTitle: targetCode,
		Description: fmt.Sprintf("Memperbarui data kupon %s (%s)", targetCode, coupons[foundIdx].Label),
		Changes: map[string]interface{}{
			"code":      targetCode,
			"label":     coupons[foundIdx].Label,
			"is_active": coupons[foundIdx].IsActive,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	return c.JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("Kupon \"%s\" berhasil diperbarui.", targetCode),
		"data":    coupons[foundIdx],
	})
}

// AdminDeleteCoupon removes a coupon from platform settings
func (h *SubscriptionHandler) AdminDeleteCoupon(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	targetCode := strings.ToUpper(strings.TrimSpace(c.Params("code")))
	coupons, err := services.GetMasterCoupons(h.db)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat master kupon.",
		})
	}

	foundIdx := -1
	for i, cItem := range coupons {
		if strings.ToUpper(cItem.Code) == targetCode {
			foundIdx = i
			break
		}
	}

	if foundIdx == -1 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": fmt.Sprintf("Kupon \"%s\" tidak ditemukan.", targetCode),
		})
	}

	deleted := coupons[foundIdx]
	coupons = append(coupons[:foundIdx], coupons[foundIdx+1:]...)

	if err := services.SaveMasterCoupons(h.db, coupons); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghapus kupon.",
		})
	}

	adminID := uint(0)
	adminEmail := ""
	if u, ok := c.Locals("user").(*models.User); ok && u != nil {
		adminID = u.ID
		adminEmail = u.Email
	}
	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		UserID:      &adminID,
		ActorRole:   "superadmin",
		ActorEmail:  adminEmail,
		Action:      "coupon.delete",
		Category:    "billing",
		EntityType:  "coupon",
		EntityTitle: deleted.Code,
		Description: fmt.Sprintf("Menghapus kupon %s (%s)", deleted.Code, deleted.Label),
		Changes: map[string]interface{}{
			"code":  deleted.Code,
			"label": deleted.Label,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	return c.JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("Kupon \"%s\" berhasil dihapus.", targetCode),
	})
}

// AdminToggleCoupon toggles the active state of a coupon
func (h *SubscriptionHandler) AdminToggleCoupon(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	targetCode := strings.ToUpper(strings.TrimSpace(c.Params("code")))
	coupons, err := services.GetMasterCoupons(h.db)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat master kupon.",
		})
	}

	foundIdx := -1
	for i, cItem := range coupons {
		if strings.ToUpper(cItem.Code) == targetCode {
			foundIdx = i
			break
		}
	}

	if foundIdx == -1 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": fmt.Sprintf("Kupon \"%s\" tidak ditemukan.", targetCode),
		})
	}

	coupons[foundIdx].IsActive = !coupons[foundIdx].IsActive
	coupons[foundIdx].UpdatedAt = time.Now().UTC()

	if err := services.SaveMasterCoupons(h.db, coupons); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui status kupon.",
		})
	}

	adminID := uint(0)
	adminEmail := ""
	if u, ok := c.Locals("user").(*models.User); ok && u != nil {
		adminID = u.ID
		adminEmail = u.Email
	}
	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		UserID:      &adminID,
		ActorRole:   "superadmin",
		ActorEmail:  adminEmail,
		Action:      "coupon.toggle",
		Category:    "billing",
		EntityType:  "coupon",
		EntityTitle: targetCode,
		Description: fmt.Sprintf("Mengubah status aktif kupon %s menjadi %t", targetCode, coupons[foundIdx].IsActive),
		Changes: map[string]interface{}{
			"code":      targetCode,
			"is_active": coupons[foundIdx].IsActive,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	return c.JSON(fiber.Map{
		"success":   true,
		"message":   fmt.Sprintf("Status kupon \"%s\" berhasil diubah.", targetCode),
		"is_active": coupons[foundIdx].IsActive,
	})
}
