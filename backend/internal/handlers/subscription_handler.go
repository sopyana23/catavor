package handlers

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"io"
	"net"
	"net/http"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"
	"catavor-backend/internal/services"
	"catavor-backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

type SubscriptionHandler struct {
	cfg         *config.Config
	db          *gorm.DB
	storage     storage.StorageService
	dnsResolver services.DomainDNSResolver
}

func NewSubscriptionHandler(db *gorm.DB, opts ...interface{}) *SubscriptionHandler {
	h := &SubscriptionHandler{
		db:          db,
		dnsResolver: services.DefaultDomainDNSResolver{},
	}
	for _, opt := range opts {
		switch v := opt.(type) {
		case *config.Config:
			h.cfg = v
		case storage.StorageService:
			h.storage = v
		case services.DomainDNSResolver:
			if v != nil {
				h.dnsResolver = v
			}
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
	if len(plans) == 0 {
		if seedErr := services.SeedSubscriptionPlans(h.db); seedErr == nil {
			if seeded, qErr := services.GetSubscriptionPlans(h.db); qErr == nil {
				plans = seeded
			}
		}
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

	// Otorisasi granular untuk staf platform: staf tanpa izin finance:orders:read tidak boleh mengintip kuota toko lain
	if user, ok := c.Locals("user").(*models.User); ok && user != nil && user.IsPlatformStaff() {
		store, _ := c.Locals("store").(*models.Store)
		isStoreOwner := store != nil && store.UserID == user.ID
		if !isStoreOwner && !user.IsSuperadmin() && !services.GetRBACService().HasPermission(user, "finance:orders:read") {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"message": "Akses Ditolak: Anda memerlukan izin 'finance:orders:read' untuk melihat data kuota toko lain.",
			})
		}
	}

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

	// Security Defense: Restrict direct plan upgrade to staff holding finance:orders:manage
	user, _ := c.Locals("user").(*models.User)
	if user == nil || !user.IsPlatformStaff() || !services.GetRBACServiceForDB(h.db).HasPermission(user, "finance:orders:manage") {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "FORBIDDEN_PERMISSION_REQUIRED",
			"message": "Peningkatan paket langsung hanya dapat dilakukan oleh administrator dengan izin finance:orders:manage. Silakan gunakan alur checkout pesanan langganan.",
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
		if strings.Contains(err.Error(), "PENDING_ORDER_EXISTS") {
			cleanMsg := strings.TrimSpace(strings.TrimPrefix(err.Error(), "PENDING_ORDER_EXISTS:"))
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"success": false,
				"code":    "PENDING_ORDER_EXISTS",
				"message": cleanMsg,
			})
		}
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

func (h *SubscriptionHandler) customDomainConfigTargets() (string, string) {
	cnameTarget := "cname.catavor.com"
	edgeIP := ""
	if h.cfg != nil {
		if t := strings.TrimSpace(h.cfg.CustomDomainCNAMETarget); t != "" {
			cnameTarget = t
		}
		edgeIP = strings.TrimSpace(h.cfg.CustomDomainEdgeIP)
	}
	return cnameTarget, edgeIP
}

func (h *SubscriptionHandler) invalidateCustomDomainCaches(storeID uint, slug string, domains ...string) {
	database.InvalidateStoreQuotaCache(context.Background(), storeID)
	if slug != "" {
		InvalidateStoreProfileCache(slug)
	}
	for _, d := range domains {
		if clean := strings.TrimSpace(d); clean != "" {
			database.InvalidateCustomDomainCache(context.Background(), clean)
		}
	}
}

func (h *SubscriptionHandler) isTrustedInternalCaller(c *fiber.Ctx) bool {
	if c == nil || c.Context() == nil {
		return false
	}
	peerIP := c.Context().RemoteIP()
	if peerIP == nil {
		return false
	}
	if peerIP.IsLoopback() {
		return true
	}
	if h.cfg == nil {
		return false
	}
	for _, entry := range h.cfg.TrustedProxies {
		trimmed := strings.TrimSpace(entry)
		if trimmed == "" {
			continue
		}
		if strings.Contains(trimmed, "/") {
			if _, cidr, err := net.ParseCIDR(trimmed); err == nil && cidr.Contains(peerIP) {
				return true
			}
		} else if ip := net.ParseIP(trimmed); ip != nil && ip.Equal(peerIP) {
			return true
		}
	}
	return false
}

func buildCustomDomainPayload(store *models.Store, cnameTarget, edgeIP string) fiber.Map {
	domainStr := ""
	if store.CustomDomain != nil {
		domainStr = *store.CustomDomain
	}
	isApex := false
	txtHost := ""
	txtFullHost := ""
	if domainStr != "" {
		isApex = services.IsApexDomain(domainStr)
		txtHost = services.BuildCustomDomainTXTHost(domainStr)
		txtFullHost = services.BuildCustomDomainTXTFullHost(domainStr)
	}
	return fiber.Map{
		"custom_domain":        store.CustomDomain,
		"custom_domain_status": store.CustomDomainStatus,
		"verification_token":   store.CustomDomainVerificationToken,
		"verified_at":          store.CustomDomainVerifiedAt,
		"last_checked_at":      store.CustomDomainLastCheckedAt,
		"error":                store.CustomDomainError,
		"cname_target":         cnameTarget,
		"edge_ip":              edgeIP,
		"txt_host":             txtHost,
		"txt_record_host":      txtFullHost,
		"txt_value":            store.CustomDomainVerificationToken,
		"is_apex":              isApex,
	}
}

// UpdateCustomDomain sets or removes a custom domain for eligible Pro Business stores,
// enforcing RFC hostname rules, platform anti-hijacking, uniqueness, and TXT ownership token generation.
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

	if store.DormancyStatus == "banned" || store.DormancyStatus == "purged" || store.IsBlacklisted || store.IsSuspended || store.DormancyStatus == "suspended" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Pengaturan domain tidak dapat diubah saat toko berstatus nonaktif atau ditangguhkan.",
		})
	}

	plan, _ := services.GetPlanByCode(h.db, store.Plan)
	if plan == nil || !plan.HasCustomDomain || strings.EqualFold(store.PlanStatus, "expired") {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "PLAN_UPGRADE_REQUIRED",
			"message": "Fitur Custom Domain hanya tersedia untuk paket Pro Bisnis aktif. Silakan upgrade paket Anda.",
		})
	}
	if strings.EqualFold(store.PlanStatus, "grace_period") || (store.GracePeriodUntil != nil && time.Now().After(*store.GracePeriodUntil)) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "GRACE_PERIOD_DOMAIN_LOCKED",
			"message": "Paket sedang dalam masa tenggang. Perpanjang paket Pro Bisnis untuk mengaktifkan atau mengubah Custom Domain.",
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

	oldDomain := ""
	if store.CustomDomain != nil {
		oldDomain = strings.TrimSpace(*store.CustomDomain)
	}
	cnameTarget, edgeIP := h.customDomainConfigTargets()
	rawInput := strings.TrimSpace(req.CustomDomain)

	var actorUserID *uint
	if uidVal := c.Locals("user_id"); uidVal != nil {
		if uid, ok := uidVal.(uint); ok && uid > 0 {
			actorUserID = &uid
		}
	}

	if rawInput == "" {
		store.CustomDomain = nil
		store.CustomDomainStatus = "none"
		store.CustomDomainVerificationToken = ""
		store.CustomDomainVerifiedAt = nil
		store.CustomDomainLastCheckedAt = nil
		store.CustomDomainError = ""

		if err := h.db.Save(&store).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal menghapus custom domain.",
			})
		}

		h.invalidateCustomDomainCaches(storeID, store.Slug, oldDomain)
		services.RecordActivity(services.RecordActivityParams{
			DB:          h.db,
			StoreID:     &storeID,
			UserID:      actorUserID,
			ActorRole:   "merchant",
			Action:      "CUSTOM_DOMAIN_REMOVED",
			Category:    "settings",
			EntityType:  "store",
			EntityID:    &storeID,
			EntityTitle: store.StoreTitle,
			Description: "Menghapus custom domain toko",
			Changes: map[string]interface{}{
				"old_domain": oldDomain,
			},
			IPAddress: c.IP(),
			UserAgent: c.Get("User-Agent"),
		})

		return c.JSON(fiber.Map{
			"success": true,
			"message": "Custom domain berhasil dihapus.",
			"data":    buildCustomDomainPayload(&store, cnameTarget, edgeIP),
		})
	}

	domain, valErr := services.NormalizeAndValidateCustomDomain(rawInput, h.cfg)
	if valErr != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"code":    "INVALID_DOMAIN",
			"message": safeErrMsg(valErr, "Format domain tidak valid."),
		})
	}

	var existing models.Store
	if err := h.db.Where("LOWER(custom_domain) = ? AND id != ?", domain, storeID).First(&existing).Error; err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"success": false,
			"code":    "DOMAIN_ALREADY_TAKEN",
			"message": "Domain ini sudah digunakan atau sedang diverifikasi oleh toko lain.",
		})
	}

	// Preserve verification state if merchant re-submits the exact same already-configured domain
	isSameDomain := strings.EqualFold(oldDomain, domain)
	if !isSameDomain || strings.TrimSpace(store.CustomDomainVerificationToken) == "" {
		token, err := services.GenerateDomainVerificationToken()
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Gagal membuat token verifikasi DNS.",
			})
		}
		store.CustomDomain = &domain
		store.CustomDomainVerificationToken = token
		store.CustomDomainStatus = "pending"
		store.CustomDomainVerifiedAt = nil
		store.CustomDomainLastCheckedAt = nil
		store.CustomDomainError = ""
	}

	if err := h.db.Save(&store).Error; err != nil {
		errLower := strings.ToLower(err.Error())
		if strings.Contains(errLower, "unique") || strings.Contains(errLower, "23505") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"success": false,
				"code":    "DOMAIN_ALREADY_TAKEN",
				"message": "Domain ini sudah digunakan atau sedang diverifikasi oleh toko lain.",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui custom domain.",
		})
	}

	h.invalidateCustomDomainCaches(storeID, store.Slug, oldDomain, domain)
	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		StoreID:     &storeID,
		UserID:      actorUserID,
		ActorRole:   "merchant",
		Action:      "CUSTOM_DOMAIN_UPDATED",
		Category:    "settings",
		EntityType:  "store",
		EntityID:    &storeID,
		EntityTitle: store.StoreTitle,
		Description: fmt.Sprintf("Mengatur custom domain ke %s", domain),
		Changes: map[string]interface{}{
			"old_domain": oldDomain,
			"new_domain": domain,
			"status":     store.CustomDomainStatus,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	msg := "Domain tersimpan. Silakan tambahkan record TXT dan CNAME/A di DNS Anda lalu klik Verifikasi DNS."
	if store.CustomDomainStatus == "active" {
		msg = "Pengaturan custom domain berhasil disimpan dan berstatus aktif."
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": msg,
		"data":    buildCustomDomainPayload(&store, cnameTarget, edgeIP),
	})
}

// VerifyCustomDomain runs real DNS TXT ownership and CNAME/A routing checks before activating custom_domain_status.
func (h *SubscriptionHandler) VerifyCustomDomain(c *fiber.Ctx) error {
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

	if store.DormancyStatus == "banned" || store.DormancyStatus == "purged" || store.IsBlacklisted || store.IsSuspended || store.DormancyStatus == "suspended" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Verifikasi domain tidak tersedia saat toko ditangguhkan atau dinonaktifkan.",
		})
	}

	plan, _ := services.GetPlanByCode(h.db, store.Plan)
	if plan == nil || !plan.HasCustomDomain || strings.EqualFold(store.PlanStatus, "expired") {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "PLAN_UPGRADE_REQUIRED",
			"message": "Fitur Custom Domain membutuhkan paket Pro Bisnis yang aktif.",
		})
	}

	if store.CustomDomain == nil || strings.TrimSpace(*store.CustomDomain) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Belum ada nama domain yang disimpan untuk diverifikasi.",
		})
	}

	if strings.TrimSpace(store.CustomDomainVerificationToken) == "" {
		tok, err := services.GenerateDomainVerificationToken()
		if err == nil {
			store.CustomDomainVerificationToken = tok
		}
	}

	domain := *store.CustomDomain
	cnameTarget, edgeIP := h.customDomainConfigTargets()
	resolver := h.dnsResolver
	if resolver == nil {
		resolver = services.DefaultDomainDNSResolver{}
	}

	dnsRes := services.VerifyCustomDomainDNS(c.Context(), domain, store.CustomDomainVerificationToken, cnameTarget, edgeIP, resolver)
	now := time.Now().UTC()
	store.CustomDomainLastCheckedAt = &now
	if dnsRes.Verified {
		store.CustomDomainStatus = "active"
		store.CustomDomainVerifiedAt = &now
		store.CustomDomainError = ""
	} else {
		store.CustomDomainStatus = "failed"
		store.CustomDomainError = dnsRes.ErrorMessage
	}

	if err := h.db.Save(&store).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menyimpan status verifikasi DNS.",
		})
	}

	h.invalidateCustomDomainCaches(storeID, store.Slug, domain)

	var actorUserID *uint
	if uidVal := c.Locals("user_id"); uidVal != nil {
		if uid, ok := uidVal.(uint); ok && uid > 0 {
			actorUserID = &uid
		}
	}
	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		StoreID:     &storeID,
		UserID:      actorUserID,
		ActorRole:   "merchant",
		Action:      "CUSTOM_DOMAIN_VERIFIED",
		Category:    "settings",
		EntityType:  "store",
		EntityID:    &storeID,
		EntityTitle: store.StoreTitle,
		Description: fmt.Sprintf("Verifikasi DNS custom domain %s (%s)", domain, store.CustomDomainStatus),
		Changes: map[string]interface{}{
			"domain":             domain,
			"verified":           dnsRes.Verified,
			"ownership_verified": dnsRes.OwnershipVerified,
			"routing_verified":   dnsRes.RoutingVerified,
			"status":             store.CustomDomainStatus,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	payload := buildCustomDomainPayload(&store, cnameTarget, edgeIP)
	payload["dns_check"] = dnsRes

	if !dnsRes.Verified {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"code":    "DNS_VERIFICATION_FAILED",
			"message": dnsRes.ErrorMessage,
			"data":    payload,
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Verifikasi DNS berhasil! Custom domain Anda kini aktif.",
		"data":    payload,
	})
}

// RemoveCustomDomain removes any custom domain attached to the authenticated store.
func (h *SubscriptionHandler) RemoveCustomDomain(c *fiber.Ctx) error {
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

	oldDomain := ""
	if store.CustomDomain != nil {
		oldDomain = strings.TrimSpace(*store.CustomDomain)
	}
	store.CustomDomain = nil
	store.CustomDomainStatus = "none"
	store.CustomDomainVerificationToken = ""
	store.CustomDomainVerifiedAt = nil
	store.CustomDomainLastCheckedAt = nil
	store.CustomDomainError = ""

	if err := h.db.Save(&store).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghapus custom domain.",
		})
	}

	h.invalidateCustomDomainCaches(storeID, store.Slug, oldDomain)
	cnameTarget, edgeIP := h.customDomainConfigTargets()

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Custom domain berhasil dihapus.",
		"data":    buildCustomDomainPayload(&store, cnameTarget, edgeIP),
	})
}

// ResolveCustomDomain resolves the active store bound to the incoming request Host header.
func (h *SubscriptionHandler) ResolveCustomDomain(c *fiber.Ctx) error {
	host := c.Hostname()
	if services.IsPlatformHost(host, h.cfg) {
		return c.JSON(fiber.Map{
			"success":          true,
			"is_custom_domain": false,
		})
	}
	resolved, err := services.ResolveActiveStoreByCustomDomain(h.db, h.cfg, host)
	if err != nil || resolved == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success":          false,
			"is_custom_domain": true,
			"code":             "CUSTOM_DOMAIN_NOT_FOUND",
			"message":          "Custom domain tidak terdaftar atau belum terverifikasi aktif.",
		})
	}
	return c.JSON(fiber.Map{
		"success":          true,
		"is_custom_domain": true,
		"data":             resolved,
	})
}

// CheckTLSAsk authorizes Caddy On-Demand TLS certificate issuance only for verified/active eligible store domains.
func (h *SubscriptionHandler) CheckTLSAsk(c *fiber.Ctx) error {
	if !h.isTrustedInternalCaller(c) {
		return c.Status(fiber.StatusForbidden).SendString("forbidden")
	}
	if h.cfg != nil && strings.TrimSpace(h.cfg.CustomDomainTLSAskSecret) != "" {
		provided := strings.TrimSpace(c.Get("X-TLS-Ask-Secret"))
		expected := strings.TrimSpace(h.cfg.CustomDomainTLSAskSecret)
		if subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) != 1 {
			return c.Status(fiber.StatusForbidden).SendString("forbidden")
		}
	}
	domain := strings.TrimSpace(c.Query("domain"))
	if domain == "" || !services.IsAllowedForTLSAsk(h.db, h.cfg, domain) {
		return c.Status(fiber.StatusForbidden).SendString("domain not authorized")
	}
	return c.Status(fiber.StatusOK).SendString("ok")
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
		if strings.Contains(err.Error(), "PENDING_ORDER_EXISTS") {
			cleanMsg := strings.TrimSpace(strings.TrimPrefix(err.Error(), "PENDING_ORDER_EXISTS:"))
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"success": false,
				"code":    "PENDING_ORDER_EXISTS",
				"message": cleanMsg,
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

	// Otorisasi granular untuk staf platform: staf tanpa izin finance:orders:read tidak boleh mengintip order toko lain
	if user, ok := c.Locals("user").(*models.User); ok && user != nil && user.IsPlatformStaff() {
		store, _ := c.Locals("store").(*models.Store)
		isStoreOwner := store != nil && store.UserID == user.ID
		if !isStoreOwner && !user.IsSuperadmin() && !services.GetRBACService().HasPermission(user, "finance:orders:read") {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"message": "Akses Ditolak: Anda memerlukan izin 'finance:orders:read' untuk melihat riwayat transaksi toko lain.",
			})
		}
	}

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

	// 1. Resolve User and Authenticate (SECURITY R3-2: strictly enforced by middleware.AuthRequired; no unvalidated fallback)
	user, _ := c.Locals("user").(*models.User)
	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan untuk melihat bukti transfer langganan.",
		})
	}

	// 2. Strict RBAC / Ownership Authorization Check (SECURITY R3-3: platform staff MUST hold finance:orders:read permission)
	canReadAllProofs := false
	if user.IsPlatformStaff() {
		canReadAllProofs = user.IsSuperadmin() || services.GetRBACService().HasPermission(user, "finance:orders:read")
	}
	isOwner := user.ID == order.UserID

	if !isOwner && order.StoreID > 0 {
		if store, ok := c.Locals("store").(*models.Store); ok && store != nil && store.ID == order.StoreID && store.UserID == user.ID {
			isOwner = true
		} else {
			var count int64
			h.db.Model(&models.Store{}).Where("id = ? AND user_id = ?", order.StoreID, user.ID).Count(&count)
			if count > 0 {
				isOwner = true
			}
		}
	}

	if !canReadAllProofs && !isOwner {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses ditolak: Anda tidak memiliki izin untuk melihat bukti transfer pesanan ini.",
		})
	}

	// 3. Handle base64 Data URLs (SECURITY: N-59 strictly whitelist image MIME types only; reject text/html & scripts)
	if strings.HasPrefix(proofURL, "data:") {
		parts := strings.SplitN(proofURL, ",", 2)
		if len(parts) == 2 {
			mimeType := "image/jpeg"
			meta := strings.ToLower(parts[0])
			if strings.Contains(meta, ":") && strings.Contains(meta, ";") {
				mimeType = meta[strings.Index(meta, ":")+1 : strings.Index(meta, ";")]
			}
			switch mimeType {
			case "image/jpeg", "image/png", "image/webp":
				// allowed safe image MIME
			default:
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"success": false,
					"message": "Format MIME bukti pembayaran tidak didukung atau tidak diizinkan.",
				})
			}
			data, err := base64.StdEncoding.DecodeString(parts[1])
			if err == nil && len(data) > 0 {
				c.Set("Content-Type", mimeType)
				c.Set("Cache-Control", "private, max-age=3600")
				c.Set("X-Content-Type-Options", "nosniff")
				c.Set("Content-Disposition", "inline; filename=\"bukti-pembayaran\"")
				return c.Send(data)
			}
		}
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Data base64 bukti pembayaran tidak valid.",
		})
	}

	// 4. Handle External URLs (SECURITY: N-59 reject arbitrary external redirects to eliminate open redirect & admin phishing)
	if strings.HasPrefix(proofURL, "http://") || strings.HasPrefix(proofURL, "https://") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Tautan bukti pembayaran eksternal tidak diizinkan.",
		})
	}

	// 5. Clean up Storage Key and re-validate namespace & tenant ownership at read-time
	// (SECURITY: N-61 + N-59 Defense-in-Depth against poisoned/legacy DB rows & SVG XSS)
	validatedProof, proofValErr := security.ValidatePaymentProofURL(proofURL)
	if proofValErr != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Format path berkas bukti pembayaran tidak valid.",
		})
	}
	cleanKey := strings.TrimLeft(filepath.ToSlash(validatedProof), "/")
	cleanKey = strings.TrimPrefix(cleanKey, "storage/")
	cleanKey = strings.TrimLeft(cleanKey, "/")

	if cleanKey == "" || strings.Contains(cleanKey, "..") || filepath.IsAbs(cleanKey) || strings.Contains(cleanKey, ":") || strings.Contains(cleanKey, "\\") {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Format path berkas bukti pembayaran tidak valid.",
		})
	}

	// Enforce tenant ownership prefix on stored key so an order can NEVER read another store's/user's proof
	lowerSubKey := strings.TrimPrefix(strings.ToLower(cleanKey), "private/")
	if strings.HasPrefix(lowerSubKey, "stores/") {
		expectedStorePrefix := fmt.Sprintf("stores/%d/billing/", order.StoreID)
		if order.StoreID == 0 || !strings.HasPrefix(lowerSubKey, expectedStorePrefix) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"message": "Berkas bukti pembayaran tidak sesuai dengan identitas toko pesanan.",
			})
		}
	} else if strings.HasPrefix(lowerSubKey, "billing/users/") {
		expectedUserPrefix := fmt.Sprintf("billing/users/%d/", order.UserID)
		if order.UserID == 0 || !strings.HasPrefix(lowerSubKey, expectedUserPrefix) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"message": "Berkas bukti pembayaran tidak sesuai dengan identitas pengguna pesanan.",
			})
		}
	} else {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Namespace berkas bukti pembayaran tidak diizinkan.",
		})
	}

	candidateKeys := make([]string, 0, 4)
	candidateKeys = append(candidateKeys, cleanKey)
	if strings.HasPrefix(cleanKey, storage.PrivateKeyPrefix) {
		candidateKeys = append(candidateKeys, strings.TrimPrefix(cleanKey, storage.PrivateKeyPrefix))
	} else {
		candidateKeys = append(candidateKeys, storage.PrivateKeyPrefix+cleanKey)
	}

	setSafeProofHeaders := func(cType string, isAttachment bool) {
		c.Set("Content-Type", cType)
		c.Set("Cache-Control", "private, max-age=3600")
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("Content-Security-Policy", "sandbox; default-src 'none'")
		if isAttachment {
			c.Set("Content-Disposition", "attachment; filename=\"bukti-pembayaran\"")
		} else {
			c.Set("Content-Disposition", "inline; filename=\"bukti-pembayaran\"")
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
				data, readErr := io.ReadAll(io.LimitReader(rc, 12*1024*1024))
				_ = rc.Close()
				if readErr == nil && len(data) > 0 {
					safeType, forceAttachment := normalizeOrderProofContentType(cType, key, data)
					setSafeProofHeaders(safeType, forceAttachment)
					return c.Send(data)
				}
			}
		}
	}

	// Fallback to local filesystem paths (SECURITY: N-61 strictly isolated inside StoragePrivateRoot & StorageLocalRoot via resolveInsideRoot)
	localRoots := make([]string, 0, 2)
	if h.cfg != nil {
		if h.cfg.StoragePrivateRoot != "" {
			localRoots = append(localRoots, h.cfg.StoragePrivateRoot)
		}
		if h.cfg.StorageLocalRoot != "" {
			localRoots = append(localRoots, h.cfg.StorageLocalRoot)
		}
	}
	if len(localRoots) == 0 {
		localRoots = append(localRoots, filepath.Join("storage", "private"), filepath.Join("public", "storage"))
	}

	for _, root := range localRoots {
		for _, key := range candidateKeys {
			relKey := strings.TrimPrefix(key, storage.PrivateKeyPrefix)
			if cand, ok := resolveInsideRoot(root, relKey); ok && isRegularFile(cand) {
				safeType, forceAttachment := normalizeOrderProofContentType("", cand, nil)
				setSafeProofHeaders(safeType, forceAttachment)
				return c.SendFile(cand)
			}
			if cand, ok := resolveInsideRoot(root, key); ok && isRegularFile(cand) {
				safeType, forceAttachment := normalizeOrderProofContentType("", cand, nil)
				setSafeProofHeaders(safeType, forceAttachment)
				return c.SendFile(cand)
			}
		}
	}

	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
		"success": false,
		"message": "File fisik bukti pembayaran tidak ditemukan di penyimpanan server.",
	})
}

func normalizeOrderProofContentType(rawMime, path string, sample []byte) (string, bool) {
	if len(sample) > 0 {
		limit := len(sample)
		if limit > 512 {
			limit = 512
		}
		sniffed := strings.ToLower(http.DetectContentType(sample[:limit]))
		switch sniffed {
		case "image/jpeg", "image/png", "image/webp", "image/gif":
			return sniffed, false
		}
		return "application/octet-stream", true
	}
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".png":
		return "image/png", false
	case ".webp":
		return "image/webp", false
	case ".jpg", ".jpeg":
		return "image/jpeg", false
	}
	// Never serve .svg or .pdf inline on payment proofs
	return "application/octet-stream", true
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

// CancelOrder allows a merchant to self-cancel an unpaid ('pending') subscription order.
// Orders already in 'pending_verification' are strictly locked (cannot be self-cancelled).
func (h *SubscriptionHandler) CancelOrder(c *fiber.Ctx) error {
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

	idParam := strings.TrimSpace(c.Params("id"))
	orderID, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil || orderID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "ID tagihan tidak valid.",
		})
	}

	order, quota, cErr := services.CancelPendingSubscriptionOrder(h.db, storeID, uint(orderID))
	if cErr != nil {
		errMsg := cErr.Error()
		switch {
		case strings.Contains(errMsg, "ORDER_NOT_FOUND"):
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"code":    "ORDER_NOT_FOUND",
				"message": strings.TrimSpace(strings.TrimPrefix(errMsg, "ORDER_NOT_FOUND:")),
			})
		case strings.Contains(errMsg, "CANNOT_CANCEL_VERIFYING"):
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"success": false,
				"code":    "CANNOT_CANCEL_VERIFYING",
				"message": strings.TrimSpace(strings.TrimPrefix(errMsg, "CANNOT_CANCEL_VERIFYING:")),
			})
		case strings.Contains(errMsg, "INVALID_ORDER_STATE"):
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"success": false,
				"code":    "INVALID_ORDER_STATE",
				"message": strings.TrimSpace(strings.TrimPrefix(errMsg, "INVALID_ORDER_STATE:")),
			})
		default:
			log.Error().Err(cErr).Uint("store_id", storeID).Uint64("order_id", orderID).Msg("subscription: CancelOrder gagal")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": safeErrMsg(cErr, "Gagal membatalkan tagihan langganan."),
			})
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Tagihan berhasil dibatalkan. Anda kini dapat memilih paket lain.",
		"order":   order,
		"quota":   quota,
	})
}

func resolveSubscriptionActorRole(c *fiber.Ctx) string {
	if c != nil {
		if u, ok := c.Locals("user").(*models.User); ok && u != nil {
			return u.PlatformStaffRoleLabel()
		}
	}
	return "finance"
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
		status := fiber.StatusBadRequest
		if strings.Contains(err.Error(), "INVALID_ORDER_STATE") {
			status = fiber.StatusConflict
		}
		return c.Status(status).JSON(fiber.Map{
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
		ActorRole:   resolveSubscriptionActorRole(c),
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
			status := fiber.StatusBadRequest
			if strings.Contains(err.Error(), "INVALID_ORDER_STATE") {
				status = fiber.StatusConflict
			}
			return c.Status(status).JSON(fiber.Map{
				"success": false,
				"message": safeErrMsg(err, "Gagal mengembalikan pesanan ke antrean verifikasi."),
			})
		}
		adminEmail, _ := c.Locals("email").(string)
		storeID := order.StoreID
		entityID := order.ID
		actorID := adminID
		services.RecordActivity(services.RecordActivityParams{
			DB:          h.db,
			StoreID:     &storeID,
			UserID:      &actorID,
			ActorRole:   resolveSubscriptionActorRole(c),
			ActorEmail:  adminEmail,
			Action:      "billing.subscription_reset_pending",
			Category:    "billing",
			EntityType:  "plan",
			EntityID:    &entityID,
			EntityTitle: order.OrderNumber,
			Description: "Invoice langganan dikembalikan ke antrean verifikasi",
			Changes: map[string]interface{}{
				"plan_code":      order.PlanCode,
				"payment_status": order.PaymentStatus,
				"reset_by":       adminID,
			},
			IPAddress: c.IP(),
			UserAgent: c.Get("User-Agent"),
		})
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
		ActorRole:   resolveSubscriptionActorRole(c),
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

// AdminListOrders returns one filtered page or a summary for the platform dashboard.
func (h *SubscriptionHandler) AdminListOrders(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	return h.financeOrdersPage(c)
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

	planCode, originalAmount := resolvePlanForCheckoutOrRegister(h.db, req.Plan, "pro_starter")
	if planCode == "free" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Kupon diskon tidak berlaku untuk paket Gratis.",
		})
	}

	coupon, discountAmount, finalAmount, err := services.ValidateCoupon(h.db, cleanCode, planCode, originalAmount)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Kode kupon tidak valid atau tidak dapat digunakan.",
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

// AdminListCoupons returns a filtered page of platform coupons and filter counts.
func (h *SubscriptionHandler) AdminListCoupons(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	return h.financeCouponsPage(c)
}

// AdminCreateCoupon handles creation of a new coupon by platform admin
func (h *SubscriptionHandler) AdminCreateCoupon(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	var req struct {
		Code            string     `json:"code"`
		Label           string     `json:"label"`
		Type            string     `json:"type"`
		Discount        float64    `json:"discount"`
		UsageLimit      int        `json:"usage_limit"`
		MaxUsesPerStore *int       `json:"max_uses_per_store"`
		IsActive        *bool      `json:"is_active"`
		ExpiresAt       *time.Time `json:"expires_at"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Payload kupon tidak valid.",
		})
	}

	cleanCode := strings.ToUpper(strings.TrimSpace(req.Code))
	if cleanCode == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Kode kupon wajib diisi.",
		})
	}

	codeRegex := regexp.MustCompile(`^[A-Z0-9_-]{3,30}$`)
	if !codeRegex.MatchString(cleanCode) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Kode kupon hanya boleh memuat huruf kapital, angka, garis bawah, dan strip (3-30 karakter).",
		})
	}

	if req.UsageLimit < 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Batas kuota pemakaian kupon tidak boleh bernilai negatif.",
		})
	}
	if req.Discount < 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Nominal diskon tidak boleh bernilai negatif.",
		})
	}
	maxPerStore := 1
	if req.MaxUsesPerStore != nil {
		if *req.MaxUsesPerStore < 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Batas pemakaian per toko tidak boleh bernilai negatif.",
			})
		}
		maxPerStore = *req.MaxUsesPerStore
	}

	label := strings.TrimSpace(req.Label)
	if label == "" {
		label = fmt.Sprintf("Kupon Diskon %s", cleanCode)
	}

	typ := strings.ToLower(strings.TrimSpace(req.Type))
	if typ != "free" && typ != "discount" {
		typ = "discount"
	}
	if typ == "discount" && req.Discount <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Nominal potongan diskon harus lebih besar dari Rp 0.",
		})
	}
	discVal := req.Discount
	if typ == "free" {
		discVal = 0
	}
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	created, err := services.CreateCoupon(h.db, services.MasterCoupon{
		Code:            cleanCode,
		Label:           label,
		Type:            typ,
		Discount:        discVal,
		UsageLimit:      req.UsageLimit,
		MaxUsesPerStore: maxPerStore,
		IsActive:        isActive,
		ExpiresAt:       req.ExpiresAt,
	})
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "sudah terdaftar") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"success": false,
				"message": fmt.Sprintf("Kode kupon \"%s\" sudah terdaftar. Gunakan kode lain.", cleanCode),
			})
		}
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Gagal menyimpan kupon baru ke database."),
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
		ActorRole:   resolveSubscriptionActorRole(c),
		ActorEmail:  adminEmail,
		Action:      "coupon.create",
		Category:    "billing",
		EntityType:  "coupon",
		EntityTitle: created.Code,
		Description: fmt.Sprintf("Membuat kupon diskon %s (%s)", created.Code, created.Label),
		Changes: map[string]interface{}{
			"code":               created.Code,
			"label":              created.Label,
			"type":               created.Type,
			"discount":           created.Discount,
			"usage_limit":        created.UsageLimit,
			"max_uses_per_store": created.MaxUsesPerStore,
			"is_active":          created.IsActive,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	return c.JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("Kupon \"%s\" berhasil dibuat.", created.Code),
		"data":    created,
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

	var patch services.CouponUpdatePatch
	if err := c.BodyParser(&patch); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Payload kupon tidak valid.",
		})
	}

	if patch.UsageLimit != nil && *patch.UsageLimit < 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Batas kuota pemakaian kupon tidak boleh bernilai negatif.",
		})
	}
	if patch.MaxUsesPerStore != nil && *patch.MaxUsesPerStore < 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Batas pemakaian per toko tidak boleh bernilai negatif.",
		})
	}
	if patch.Discount != nil && *patch.Discount < 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Nominal diskon tidak boleh bernilai negatif.",
		})
	}
	if patch.Type != nil {
		typ := strings.ToLower(strings.TrimSpace(*patch.Type))
		if typ == "discount" && patch.Discount != nil && *patch.Discount <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Nominal potongan diskon harus lebih besar dari Rp 0.",
			})
		}
	}

	updated, err := services.UpdateCoupon(h.db, targetCode, patch)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "tidak ditemukan") {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"message": fmt.Sprintf("Kupon \"%s\" tidak ditemukan.", targetCode),
			})
		}
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Gagal memperbarui kupon."),
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
		ActorRole:   resolveSubscriptionActorRole(c),
		ActorEmail:  adminEmail,
		Action:      "coupon.update",
		Category:    "billing",
		EntityType:  "coupon",
		EntityTitle: targetCode,
		Description: fmt.Sprintf("Memperbarui data kupon %s (%s)", targetCode, updated.Label),
		Changes: map[string]interface{}{
			"code":      targetCode,
			"label":     updated.Label,
			"type":      updated.Type,
			"discount":  updated.Discount,
			"is_active": updated.IsActive,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	return c.JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("Kupon \"%s\" berhasil diperbarui.", targetCode),
		"data":    updated,
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
	deleted, err := services.DeleteCoupon(h.db, targetCode)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "tidak ditemukan") {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"message": fmt.Sprintf("Kupon \"%s\" tidak ditemukan.", targetCode),
			})
		}
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
		ActorRole:   resolveSubscriptionActorRole(c),
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
	toggled, err := services.ToggleCoupon(h.db, targetCode)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "tidak ditemukan") {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"message": fmt.Sprintf("Kupon \"%s\" tidak ditemukan.", targetCode),
			})
		}
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
		ActorRole:   resolveSubscriptionActorRole(c),
		ActorEmail:  adminEmail,
		Action:      "coupon.toggle",
		Category:    "billing",
		EntityType:  "coupon",
		EntityTitle: targetCode,
		Description: fmt.Sprintf("Mengubah status aktif kupon %s menjadi %t", targetCode, toggled.IsActive),
		Changes: map[string]interface{}{
			"code":      targetCode,
			"is_active": toggled.IsActive,
		},
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	})

	return c.JSON(fiber.Map{
		"success":   true,
		"message":   fmt.Sprintf("Status kupon \"%s\" berhasil diubah.", targetCode),
		"is_active": toggled.IsActive,
	})
}
