package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/middleware"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"
	"catavor-backend/internal/services"
	"catavor-backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type SettingHandler struct {
	db      *gorm.DB
	storage storage.StorageService
}

func NewSettingHandler(db *gorm.DB, storageService ...storage.StorageService) *SettingHandler {
	var s storage.StorageService
	if len(storageService) > 0 {
		s = storageService[0]
	}
	return &SettingHandler{db: db, storage: s}
}

// extractPlatformStorageKey extracts a relative platform object key (e.g. platform/payments/qris/... or platform/partners/...)
// from either a storage URL or raw object key string.
func extractPlatformStorageKey(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if idx := strings.Index(raw, "platform/"); idx != -1 {
		return strings.TrimLeft(raw[idx:], "/")
	}
	return ""
}

// PublicIndex returns ONLY allowlisted public platform settings with safe defaults.
// Internal platform settings (such as master coupons or payment secrets)
// are strictly excluded from public visibility (OWASP Information Disclosure prevention).
func (h *SettingHandler) PublicIndex(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	publicKeys := map[string]bool{
		"store_title":                   true,
		"articles_enabled":              true,
		"ads_enabled":                   true,
		"ads_client_id":                 true,
		"ads_auto_enabled":              true,
		"ads_slot_header":               true,
		"ads_slot_infeed":               true,
		"ads_slot_product_detail":       true,
		"ads_slot_bottom":               true,
		"ads_slot_dashboard":            true,
		"ads_test_mode":                 true,
		"ads_txt_content":               true,
		"ga_enabled":                    true,
		"ga_measurement_id":             true,
		"market_intel_enabled":          true,
		"rekber_enabled":                true,
		"rekber_partner_name":           true,
		"rekber_website_url":            true,
		"rekber_wa_number":              true,
		"rekber_logo_url":               true,
		"rekber_template_physical":      true,
		"rekber_template_general":       true,
		"rekber_template_food":          true,
		"rekber_template_digital":       true,
		"rekber_template_service":       true,
		"rekber_template_plant":         true,
		"rekber_template_fauna":         true,
		"maintenance_mode":              true,
		"maintenance_message":           true,
		"payment_system_mode":           true,
		"payment_maintenance_title":     true,
		"payment_maintenance_message":   true,
		"payment_qris_manual_image":     true,
		"payment_qris_manual_merchant":  true,
		"payment_bank_name":             true,
		"payment_bank_account":          true,
		"payment_bank_holder":           true,
		"payment_aulaa_channel_qris":    true,
		"payment_aulaa_channel_va":      true,
		"payment_aulaa_channel_cc":      true,
		"payment_aulaa_channel_ewallet": true,
		"platform_official_whatsapp":    true,
		"platform_official_email":       true,
		"contact_whatsapp":              true,
		"contact_email":                 true,
		"terms_conditions":              true,
		"privacy_policy":                true,
		"legal_entity_name":             true,
		"legal_jurisdiction":            true,
		"legal_warning_banner":          true,
	}

	keys := make([]string, 0, len(publicKeys))
	for key := range publicKeys {
		keys = append(keys, key)
	}
	var settings []models.Setting
	if err := h.db.Where("key IN ?", keys).Find(&settings).Error; err != nil {
		return fiber.NewError(500, "Gagal memuat pengaturan")
	}
	res := make(map[string]string)
	for _, s := range settings {
		res[s.Key] = s.Value
	}

	h.applyFallbacks(res)
	for key := range res {
		if !publicKeys[key] {
			delete(res, key)
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    res,
	})
}

// allowedAdminSettingKeys restricts POST /api/admin/settings writes to documented platform configuration keys,
// explicitly excluding internal JSON blobs such as master_coupons or arbitrary unvalidated keys.
var allowedAdminSettingKeys = map[string]bool{
	"store_title":                   true,
	"articles_enabled":              true,
	"ads_enabled":                   true,
	"ads_client_id":                 true,
	"ads_auto_enabled":              true,
	"ads_slot_header":               true,
	"ads_slot_infeed":               true,
	"ads_slot_product_detail":       true,
	"ads_slot_bottom":               true,
	"ads_slot_dashboard":            true,
	"ads_test_mode":                 true,
	"ads_txt_content":               true,
	"ga_enabled":                    true,
	"ga_measurement_id":             true,
	"market_intel_enabled":          true,
	"internal_sponsored_ads_enabled": true,
	"payment_system_mode":           true,
	"payment_maintenance_title":     true,
	"payment_maintenance_message":   true,
	"payment_qris_manual_image":     true,
	"payment_qris_manual_merchant":  true,
	"payment_bank_name":             true,
	"payment_bank_account":          true,
	"payment_bank_holder":           true,
	"payment_aulaa_channel_qris":    true,
	"payment_aulaa_channel_va":      true,
	"payment_aulaa_channel_cc":      true,
	"payment_aulaa_channel_ewallet": true,
	"aulaa_base_url":                true,
	"aulaa_api_key":                 true,
	"aulaa_webhook_secret":          true,
	"smtp_host":                     true,
	"smtp_port":                     true,
	"smtp_username":                 true,
	"smtp_password":                 true,
	"smtp_from_email":               true,
	"smtp_from_name":                true,
	"rekber_enabled":                true,
	"rekber_partner_name":           true,
	"rekber_website_url":            true,
	"rekber_wa_number":              true,
	"rekber_logo_url":               true,
	"rekber_template_physical":      true,
	"rekber_template_general":       true,
	"rekber_template_food":          true,
	"rekber_template_digital":       true,
	"rekber_template_service":       true,
	"rekber_template_plant":         true,
	"rekber_template_fauna":         true,
	"platform_official_whatsapp":    true,
	"platform_official_email":       true,
	"contact_whatsapp":              true,
	"contact_email":                 true,
	"maintenance_mode":              true,
	"maintenance_message":           true,
	"terms_conditions":              true,
	"privacy_policy":                true,
	"legal_entity_name":             true,
	"legal_jurisdiction":            true,
	"legal_warning_banner":          true,
}

var richTextSettingKeys = map[string]bool{
	"terms_conditions":     true,
	"privacy_policy":       true,
	"legal_warning_banner": true,
}

func sanitizeSecretSettingValue(raw string, maxLen int) string {
	cleaned := strings.Map(func(r rune) rune {
		if r == 0 || r < 32 || r == 127 {
			return -1
		}
		return r
	}, raw)
	if maxLen > 0 {
		runes := []rune(cleaned)
		if len(runes) > maxLen {
			cleaned = string(runes[:maxLen])
		}
	}
	return cleaned
}

// secretPlatformKeys lists sensitive credential keys that must be masked on GET /api/admin/settings
// and protected against accidental overwrite by masked placeholder values ("****...").
var secretPlatformKeys = map[string]bool{
	"aulaa_api_key":        true,
	"aulaa_webhook_secret": true,
	"smtp_password":        true,
}

func maskSecretValue(val string) string {
	trimmed := strings.TrimSpace(val)
	if trimmed == "" {
		return ""
	}
	if len(trimmed) <= 4 {
		return "****"
	}
	return "****" + trimmed[len(trimmed)-4:]
}

func (h *SettingHandler) resolveActor(c *fiber.Ctx) *models.User {
	if userVal := c.Locals("user"); userVal != nil {
		if u, ok := userVal.(*models.User); ok && u != nil {
			return u
		}
	}
	if uid, ok := c.Locals("user_id").(uint); ok && uid > 0 && h.db != nil {
		var u models.User
		if err := h.db.First(&u, uid).Error; err == nil {
			return &u
		}
	}
	return nil
}

func canAccessSettingKey(user *models.User, rbac *services.RBACService, key string) bool {
	if user == nil || !user.IsPlatformStaff() {
		return false
	}
	if user.IsSuperadmin() || rbac.HasPermission(user, "system:settings:manage") {
		return true
	}
	if rbac.HasPermission(user, "finance:settings:manage") &&
		(strings.HasPrefix(key, "payment_") || strings.HasPrefix(key, "aulaa_")) {
		return true
	}
	if rbac.HasPermission(user, "monetization:google:manage") &&
		(strings.HasPrefix(key, "ads_") || strings.HasPrefix(key, "ga_")) {
		return true
	}
	return false
}

func hasAnySettingDomainPermission(user *models.User, rbac *services.RBACService) bool {
	if user == nil || !user.IsPlatformStaff() {
		return false
	}
	return user.IsSuperadmin() ||
		rbac.HasPermission(user, "system:settings:manage") ||
		rbac.HasPermission(user, "finance:settings:manage") ||
		rbac.HasPermission(user, "monetization:google:manage")
}

func (h *SettingHandler) Index(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user := h.resolveActor(c)
	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}
	if !middleware.IsPlatformStaffRole(user.PlatformRole) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "FORBIDDEN_ROLE",
			"message": "Akses Ditolak: Hanya Pengelola Platform yang berwenang membaca pengaturan internal.",
		})
	}
	rbac := services.GetRBACServiceForDB(h.db)
	if !hasAnySettingDomainPermission(user, rbac) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "FORBIDDEN_PERMISSION_REQUIRED",
			"message": "Akses Ditolak: Anda tidak memiliki izin untuk membaca pengaturan platform.",
		})
	}

	var settings []models.Setting
	query := h.db.Where("key <> ?", "master_coupons")
	if err := query.Find(&settings).Error; err != nil {
		return fiber.NewError(500, "Gagal memuat pengaturan")
	}

	res := make(map[string]string)
	for _, s := range settings {
		if secretPlatformKeys[s.Key] {
			res[s.Key] = maskSecretValue(s.Value)
		} else {
			res[s.Key] = s.Value
		}
	}

	h.applyFallbacks(res)

	if !user.IsSuperadmin() && !rbac.HasPermission(user, "system:settings:manage") {
		filtered := make(map[string]string)
		for k, v := range res {
			if canAccessSettingKey(user, rbac, k) {
				filtered[k] = v
			}
		}
		res = filtered
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    res,
	})
}

func (h *SettingHandler) applyFallbacks(res map[string]string) {
	// Set fallbacks if missing
	if _, ok := res["store_title"]; !ok {
		res["store_title"] = "Catavor"
	}
	if _, ok := res["articles_enabled"]; !ok {
		res["articles_enabled"] = "0"
	}
	if _, ok := res["ads_enabled"]; !ok {
		res["ads_enabled"] = "0"
	}
	if _, ok := res["ads_client_id"]; !ok {
		res["ads_client_id"] = ""
	}
	if _, ok := res["ads_auto_enabled"]; !ok {
		res["ads_auto_enabled"] = "0"
	}
	if _, ok := res["ads_slot_header"]; !ok {
		res["ads_slot_header"] = ""
	}
	if _, ok := res["ads_slot_infeed"]; !ok {
		res["ads_slot_infeed"] = ""
	}
	if _, ok := res["ads_slot_product_detail"]; !ok {
		res["ads_slot_product_detail"] = ""
	}
	if _, ok := res["ads_slot_bottom"]; !ok {
		res["ads_slot_bottom"] = ""
	}
	if _, ok := res["ads_slot_dashboard"]; !ok {
		res["ads_slot_dashboard"] = ""
	}
	if _, ok := res["ads_test_mode"]; !ok {
		res["ads_test_mode"] = "1"
	}
	if val, ok := res["ads_client_id"]; ok && isDummyAdSenseRef(val) {
		res["ads_client_id"] = ""
	}
	if val, ok := res["ads_txt_content"]; !ok || isDummyAdSenseRef(val) {
		res["ads_txt_content"] = ""
	}
	if _, ok := res["ga_enabled"]; !ok {
		res["ga_enabled"] = "0"
	}
	if _, ok := res["ga_measurement_id"]; !ok {
		res["ga_measurement_id"] = ""
	}
	if _, ok := res["market_intel_enabled"]; !ok {
		res["market_intel_enabled"] = "1"
	}

	// Master Settings: Platform Payment System
	if _, ok := res["payment_system_mode"]; !ok {
		res["payment_system_mode"] = "gateway_aulaa"
	}
	if _, ok := res["payment_maintenance_title"]; !ok {
		res["payment_maintenance_title"] = "Sistem Pembayaran Dalam Pemeliharaan"
	}
	if _, ok := res["payment_maintenance_message"]; !ok {
		res["payment_maintenance_message"] = "Layanan transaksi pembayaran sedang dalam pemeliharaan berkala untuk peningkatan keandalan jaringan. Silakan hubungi admin atau coba beberapa saat lagi."
	}
	if _, ok := res["payment_qris_manual_image"]; !ok {
		res["payment_qris_manual_image"] = ""
	}
	if _, ok := res["payment_qris_manual_merchant"]; !ok {
		res["payment_qris_manual_merchant"] = "Catavor Official Store"
	}
	if _, ok := res["payment_bank_name"]; !ok {
		res["payment_bank_name"] = "Bank Central Asia (BCA)"
	}
	if _, ok := res["payment_bank_account"]; !ok {
		res["payment_bank_account"] = "8830-1928-3920"
	}
	if _, ok := res["payment_bank_holder"]; !ok {
		res["payment_bank_holder"] = "PT Catavor Media Digital"
	}
	if _, ok := res["payment_aulaa_channel_qris"]; !ok {
		res["payment_aulaa_channel_qris"] = "1"
	}
	if _, ok := res["payment_aulaa_channel_va"]; !ok {
		res["payment_aulaa_channel_va"] = "1"
	}
	if _, ok := res["payment_aulaa_channel_cc"]; !ok {
		res["payment_aulaa_channel_cc"] = "0"
	}
	if _, ok := res["payment_aulaa_channel_ewallet"]; !ok {
		res["payment_aulaa_channel_ewallet"] = "1"
	}
	if _, ok := res["aulaa_base_url"]; !ok {
		res["aulaa_base_url"] = "https://api.aulaa.co/v1"
	}
	if _, ok := res["aulaa_api_key"]; !ok {
		res["aulaa_api_key"] = ""
	}
	if _, ok := res["aulaa_webhook_secret"]; !ok {
		res["aulaa_webhook_secret"] = ""
	}

	// Master Settings: Mitra Rekber Syariah (rekbersyariah.com)
	// Applicable exclusively to 6 transactional catalog types: Physical, Food, Digital, Service, Plant, Fauna (Property is excluded).
	if _, ok := res["rekber_enabled"]; !ok {
		res["rekber_enabled"] = "1"
	}
	if _, ok := res["rekber_partner_name"]; !ok {
		res["rekber_partner_name"] = "Rekber Syariah"
	}
	if _, ok := res["rekber_website_url"]; !ok {
		res["rekber_website_url"] = "https://rekbersyariah.com"
	}
	if _, ok := res["rekber_wa_number"]; !ok || res["rekber_wa_number"] == "" {
		res["rekber_wa_number"] = "62811220227"
	}
	if _, ok := res["rekber_logo_url"]; !ok {
		res["rekber_logo_url"] = ""
	}

	// Master Settings: Kontak Bantuan & Support Resmi Platform (WhatsApp & Email Resmi)
	if _, ok := res["platform_official_whatsapp"]; !ok || strings.TrimSpace(res["platform_official_whatsapp"]) == "" {
		if wa, hasWa := res["rekber_wa_number"]; hasWa && strings.TrimSpace(wa) != "" {
			res["platform_official_whatsapp"] = wa
		} else {
			res["platform_official_whatsapp"] = "62811220227"
		}
	}
	if _, ok := res["platform_official_email"]; !ok || strings.TrimSpace(res["platform_official_email"]) == "" {
		res["platform_official_email"] = "support@catavor.com"
	}
	if _, ok := res["contact_whatsapp"]; !ok || strings.TrimSpace(res["contact_whatsapp"]) == "" {
		res["contact_whatsapp"] = res["platform_official_whatsapp"]
	}
	if _, ok := res["contact_email"]; !ok || strings.TrimSpace(res["contact_email"]) == "" {
		res["contact_email"] = res["platform_official_email"]
	}

	// Master Settings: Platform Legal Identity & Warning Banner
	if _, ok := res["legal_entity_name"]; !ok || strings.TrimSpace(res["legal_entity_name"]) == "" {
		res["legal_entity_name"] = "PT Catavor Media Digital"
	}
	if _, ok := res["legal_jurisdiction"]; !ok || strings.TrimSpace(res["legal_jurisdiction"]) == "" {
		res["legal_jurisdiction"] = "Hukum Republik Indonesia"
	}
	if _, ok := res["legal_warning_banner"]; !ok || strings.TrimSpace(res["legal_warning_banner"]) == "" {
		res["legal_warning_banner"] = "Seluruh aktivitas etalase katalog, komunikasi pemesanan, dan transaksi tunduk pada Syarat & Ketentuan serta Kebijakan Privasi resmi Catavor."
	}
	defaultPhysicalTemplate := "Halo *{store_title}*, saya berminat membeli produk berikut:\n\n*Produk:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi secara aman menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})*.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih."
	defaultFoodTemplate := "Halo *{store_title}*, saya ingin memesan menu kuliner berikut:\n\n*Menu:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi secara aman menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})*.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih."
	defaultDigitalTemplate := "Halo *{store_title}*, saya ingin membeli item digital berikut:\n\n*Item:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})* agar file dan lisensi terlindungi secara aman.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih."
	defaultServiceTemplate := "Halo *{store_title}*, saya ingin memesan layanan jasa berikut:\n\n*Layanan:* {item_name}\n*Tarif:* {item_price}\n\nSaya ingin bertransaksi menggunakan perlindungan escrow *Rekening Bersama Syariah ({rekber_website_domain})* agar dana aman selama masa pengerjaan.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih."
	defaultPlantTemplate := "Halo *{store_title}*, saya ingin membeli tanaman berikut:\n\n*Tanaman:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi menggunakan perlindungan *Rekening Bersama Syariah ({rekber_website_domain})* agar dana aman hingga tanaman tiba dalam kondisi segar.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih."
	defaultFaunaTemplate := "Halo *{store_title}*, saya berminat membeli / mengadopsi hewan berikut:\n\n*Satwa/Hewan:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})* dengan proteksi garansi hidup & kesehatan saat tiba.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih."

	legacyIcons := []string{"📦", "🍲", "💾", "💼", "🌱", "🐾", "🏡"}
	hasLegacyIcon := func(s string) bool {
		for _, ic := range legacyIcons {
			if strings.Contains(s, ic) {
				return true
			}
		}
		return false
	}

	tmplMap := map[string]string{
		"rekber_template_physical": defaultPhysicalTemplate,
		"rekber_template_general":  defaultPhysicalTemplate,
		"rekber_template_food":     defaultFoodTemplate,
		"rekber_template_digital":  defaultDigitalTemplate,
		"rekber_template_service":  defaultServiceTemplate,
		"rekber_template_plant":    defaultPlantTemplate,
		"rekber_template_fauna":    defaultFaunaTemplate,
	}

	for k, defaultTmpl := range tmplMap {
		val, ok := res[k]
		if !ok || val == "" || strings.Contains(val, "wa.me") || !strings.Contains(val, "rekber_wa_number") || hasLegacyIcon(val) {
			res[k] = defaultTmpl
			if ok && hasLegacyIcon(val) {
				_ = h.db.Model(&models.Setting{}).Where("key = ?", k).Update("value", defaultTmpl).Error
			}
		}
	}
}

// GetAdsTxt serves public /ads.txt for Google AdSense site verification
var (
	adsClientIDRegex = regexp.MustCompile(`^(?:ca-)?pub-(\d{16})$`)
	adsSlotIDRegex   = regexp.MustCompile(`^\d{8,12}$`)
	gaMeasureIDRegex = regexp.MustCompile(`^G-[A-Z0-9]{6,16}$`)
)

func isDummyAdSenseRef(raw string) bool {
	return strings.Contains(strings.ToLower(strings.TrimSpace(raw)), "pub-0000000000000000")
}

func normalizeAdSenseClientID(raw string) (string, error) {
	trimmed := strings.ToLower(strings.TrimSpace(raw))
	if trimmed == "" {
		return "", nil
	}
	matches := adsClientIDRegex.FindStringSubmatch(trimmed)
	if len(matches) != 2 {
		return "", fmt.Errorf("format Publisher ID Google AdSense tidak valid (wajib ca-pub-XXXXXXXXXXXXXXXX dengan 16 digit)")
	}
	if matches[1] == "0000000000000000" {
		return "", fmt.Errorf("Publisher ID Google AdSense tidak boleh menggunakan ID placeholder pub-0000000000000000")
	}
	return "ca-pub-" + matches[1], nil
}

func validateAdSenseSlotID(raw, label string) error {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	if !adsSlotIDRegex.MatchString(trimmed) {
		return fmt.Errorf("format %s tidak valid (harus 8-12 digit angka)", label)
	}
	return nil
}

func normalizeGAMeasurementID(raw string) (string, error) {
	trimmed := strings.ToUpper(strings.TrimSpace(raw))
	if trimmed == "" {
		return "", nil
	}
	if !gaMeasureIDRegex.MatchString(trimmed) {
		return "", fmt.Errorf("format GA4 Measurement ID tidak valid (wajib G-XXXXXXXXXX)")
	}
	return trimmed, nil
}

func normalizeBoolSettingValue(raw string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "true":
		return "1", nil
	case "0", "false", "":
		return "0", nil
	default:
		return "", fmt.Errorf("nilai pengaturan boolean harus '1' atau '0'")
	}
}

func defaultAdsTxtLine(clientID string) string {
	norm, err := normalizeAdSenseClientID(clientID)
	if err != nil || norm == "" {
		return ""
	}
	return "google.com, " + strings.TrimPrefix(norm, "ca-") + ", DIRECT, f08c47fec0942fa0"
}

func (h *SettingHandler) GetAdsTxt(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	var content string
	var s models.Setting
	if err := h.db.Where("key = ?", "ads_txt_content").First(&s).Error; err == nil {
		trimmed := strings.TrimSpace(s.Value)
		if trimmed != "" && !isDummyAdSenseRef(trimmed) {
			content = security.SanitizePlainText(trimmed, 10000)
		}
	}
	if content == "" {
		var clientSetting models.Setting
		if err := h.db.Where("key = ?", "ads_client_id").First(&clientSetting).Error; err == nil {
			content = defaultAdsTxtLine(clientSetting.Value)
		}
	}
	c.Set("Content-Type", "text/plain; charset=utf-8")
	c.Set("X-Content-Type-Options", "nosniff")
	if content == "" {
		c.Set("Cache-Control", "no-store")
		return c.Status(fiber.StatusNotFound).SendString("ads.txt is not configured")
	}
	c.Set("Cache-Control", "public, max-age=300")
	return c.SendString(content)
}

func (h *SettingHandler) Store(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	// Security check: Only Platform Admin (Super Admin or operational staff) can mutate platform settings.
	// Merchants are strictly disallowed to prevent tampering with platform monetization, ads, or partner credentials.
	user := h.resolveActor(c)

	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	// SECURITY (N-12): whitelist eksplisit, bukan blacklist.
	if !middleware.IsPlatformStaffRole(user.PlatformRole) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "FORBIDDEN_ROLE",
			"message": "Akses Ditolak: Hanya Pengelola Platform (Admin/Superadmin) yang berwenang mengubah konfigurasi sistem.",
		})
	}

	rbac := services.GetRBACServiceForDB(h.db)
	if !hasAnySettingDomainPermission(user, rbac) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "FORBIDDEN_PERMISSION_REQUIRED",
			"message": "Akses Ditolak: Anda tidak memiliki izin untuk mengubah konfigurasi pengaturan.",
		})
	}

	var payload map[string]string
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	var disallowedKeys []string
	for k := range payload {
		sanitizedKey := security.SanitizePlainText(k, 100)
		if sanitizedKey == "" {
			continue
		}
		if !allowedAdminSettingKeys[sanitizedKey] {
			disallowedKeys = append(disallowedKeys, sanitizedKey)
		}
	}
	if len(disallowedKeys) > 0 {
		sort.Strings(disallowedKeys)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"code":    "INVALID_SETTING_KEY",
			"message": fmt.Sprintf("Kunci pengaturan tidak diizinkan: %s.", strings.Join(disallowedKeys, ", ")),
		})
	}

	// Validasi izin domain untuk setiap key sebelum transaksi dimulai agar tidak terjadi partial write.
	if !user.IsSuperadmin() && !rbac.HasPermission(user, "system:settings:manage") {
		var forbiddenKeys []string
		for k := range payload {
			sanitizedKey := security.SanitizePlainText(k, 100)
			if sanitizedKey == "" {
				continue
			}
			if !canAccessSettingKey(user, rbac, sanitizedKey) {
				forbiddenKeys = append(forbiddenKeys, sanitizedKey)
			}
		}
		if len(forbiddenKeys) > 0 {
			sort.Strings(forbiddenKeys)
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "FORBIDDEN_PERMISSION_REQUIRED",
				"message": fmt.Sprintf("Akses Ditolak: Anda tidak berwenang mengubah pengaturan domain lain (%s).", strings.Join(forbiddenKeys, ", ")),
			})
		}
	}

	if rawBaseURL, exists := payload["aulaa_base_url"]; exists && strings.TrimSpace(rawBaseURL) != "" {
		validURL, err := services.ValidateAulaaBaseURL(rawBaseURL)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": err.Error(),
			})
		}
		payload["aulaa_base_url"] = validURL
	}

	if err := validateAndPrepareMonetizationSettings(h.db, payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": err.Error(),
		})
	}

	return h.persistPlatformSettings(c, payload, "Pengaturan platform berhasil disimpan.")
}

var monetizationSettingKeys = []string{
	"ads_enabled",
	"ads_client_id",
	"ads_auto_enabled",
	"ads_test_mode",
	"ads_slot_header",
	"ads_slot_infeed",
	"ads_slot_product_detail",
	"ads_slot_bottom",
	"ads_slot_dashboard",
	"ads_txt_content",
	"ga_enabled",
	"ga_measurement_id",
}

func isMonetizationKey(key string) bool {
	for _, k := range monetizationSettingKeys {
		if k == key {
			return true
		}
	}
	return false
}

func validateAndPrepareMonetizationSettings(db *gorm.DB, payload map[string]string) error {
	if len(payload) == 0 {
		return nil
	}

	var touchedMonetization bool
	for rawKey := range payload {
		k := security.SanitizePlainText(rawKey, 100)
		if isMonetizationKey(k) {
			touchedMonetization = true
			break
		}
	}
	if !touchedMonetization {
		return nil
	}

	// Validasi & normalisasi seluruh field monetisasi & GA4
	for _, boolKey := range []string{"ads_enabled", "ads_auto_enabled", "ads_test_mode", "ga_enabled"} {
		if raw, exists := payload[boolKey]; exists {
			norm, err := normalizeBoolSettingValue(raw)
			if err != nil {
				return fmt.Errorf("%s: %w", boolKey, err)
			}
			payload[boolKey] = norm
		}
	}

	if rawClient, exists := payload["ads_client_id"]; exists {
		normClient, err := normalizeAdSenseClientID(rawClient)
		if err != nil {
			return err
		}
		payload["ads_client_id"] = normClient
	}

	slotLabels := map[string]string{
		"ads_slot_header":         "Slot ID Header Katalog",
		"ads_slot_infeed":         "Slot ID In-Feed Katalog",
		"ads_slot_product_detail": "Slot ID Detail Produk",
		"ads_slot_bottom":         "Slot ID Footer Katalog",
		"ads_slot_dashboard":      "Slot ID Dashboard",
	}
	for slotKey, label := range slotLabels {
		if rawSlot, exists := payload[slotKey]; exists {
			trimmed := strings.TrimSpace(rawSlot)
			if err := validateAdSenseSlotID(trimmed, label); err != nil {
				return err
			}
			payload[slotKey] = trimmed
		}
	}

	if rawGA, exists := payload["ga_measurement_id"]; exists {
		normGA, err := normalizeGAMeasurementID(rawGA)
		if err != nil {
			return err
		}
		payload["ga_measurement_id"] = normGA
	}

	if rawTxt, exists := payload["ads_txt_content"]; exists {
		cleanedTxt := security.SanitizePlainText(strings.ReplaceAll(rawTxt, "\r\n", "\n"), 10000)
		if isDummyAdSenseRef(cleanedTxt) {
			return fmt.Errorf("isi ads.txt tidak boleh menggunakan ID placeholder pub-0000000000000000")
		}
		payload["ads_txt_content"] = cleanedTxt
	}

	// Muat nilai efektif dari DB untuk validasi lintas-field & auto-sync ads.txt
	existing := map[string]string{}
	if db != nil {
		var rows []models.Setting
		_ = db.Where("key IN ?", []string{"ads_enabled", "ads_client_id", "ads_txt_content", "ga_enabled", "ga_measurement_id"}).Find(&rows).Error
		for _, r := range rows {
			existing[r.Key] = r.Value
		}
	}

	effectiveVal := func(k string) string {
		if v, ok := payload[k]; ok {
			return v
		}
		return existing[k]
	}

	effectiveClientID := strings.TrimSpace(effectiveVal("ads_client_id"))
	if _, clientSubmitted := payload["ads_client_id"]; clientSubmitted && effectiveClientID != "" {
		submittedTxt, txtSubmitted := payload["ads_txt_content"]
		if (!txtSubmitted && (strings.TrimSpace(existing["ads_txt_content"]) == "" || isDummyAdSenseRef(existing["ads_txt_content"]))) ||
			(txtSubmitted && strings.TrimSpace(submittedTxt) == "") {
			if line := defaultAdsTxtLine(effectiveClientID); line != "" {
				payload["ads_txt_content"] = line
			}
		}
	}

	if effectiveVal("ads_enabled") == "1" && (effectiveClientID == "" || isDummyAdSenseRef(effectiveClientID)) {
		return fmt.Errorf("Publisher ID Google AdSense (ca-pub-XXXXXXXXXXXXXXXX) wajib diisi sebelum mengaktifkan iklan")
	}
	if effectiveVal("ga_enabled") == "1" && strings.TrimSpace(effectiveVal("ga_measurement_id")) == "" {
		return fmt.Errorf("GA4 Measurement ID (G-XXXXXXXXXX) wajib diisi sebelum mengaktifkan Google Analytics 4")
	}

	return nil
}

func (h *SettingHandler) persistPlatformSettings(c *fiber.Ctx, payload map[string]string, successMsg string) error {
	var filesToDelete []string
	monetizationChanges := make(map[string]string)
	generalChanges := make(map[string]string)

	// ACID Atomic Database Transaction (AGENTS.md Rule 5 & Rule 10)
	txErr := h.db.Transaction(func(tx *gorm.DB) error {
		for k, v := range payload {
			sanitizedKey := security.SanitizePlainText(k, 100)
			if sanitizedKey == "" {
				continue
			}
			// Jangan menimpa secret gateway/SMTP yang sudah tersimpan dengan nilai masking "****..."
			if secretPlatformKeys[sanitizedKey] && strings.HasPrefix(strings.TrimSpace(v), "****") {
				continue
			}
			var sanitizedVal string
			if secretPlatformKeys[sanitizedKey] {
				sanitizedVal = sanitizeSecretSettingValue(v, 2048)
			} else if richTextSettingKeys[sanitizedKey] {
				sanitizedVal = security.SanitizeRichText(v, 50000)
			} else if sanitizedKey == "ads_txt_content" {
				sanitizedVal = security.SanitizePlainText(strings.ReplaceAll(v, "\r\n", "\n"), 10000)
			} else {
				sanitizedVal = security.SanitizePlainText(v, 10000)
			}

			if isMonetizationKey(sanitizedKey) {
				monetizationChanges[sanitizedKey] = sanitizedVal
			} else if secretPlatformKeys[sanitizedKey] {
				generalChanges[sanitizedKey] = "[REDACTED]"
			} else {
				generalChanges[sanitizedKey] = sanitizedVal
			}

			var s models.Setting
			if err := tx.Where("key = ?", sanitizedKey).First(&s).Error; err != nil {
				if err := tx.Create(&models.Setting{Key: sanitizedKey, Value: sanitizedVal}).Error; err != nil {
					return err
				}
			} else {
				// Standar Industri: jika aset dinamis platform diganti atau dikosongkan,
				// catat file lama untuk dibersihkan dari Cloudflare R2 / Storage setelah commit.
				if h.storage != nil && (sanitizedKey == "payment_qris_manual_image" || sanitizedKey == "rekber_logo_url") {
					oldKey := extractPlatformStorageKey(s.Value)
					newKey := extractPlatformStorageKey(sanitizedVal)
					if oldKey != "" && oldKey != newKey {
						filesToDelete = append(filesToDelete, oldKey)
					}
				}
				s.Value = sanitizedVal
				if err := tx.Save(&s).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})

	if txErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menyimpan pengaturan platform.",
		})
	}

	// Catat audit trail perubahan konfigurasi platform (monetisasi maupun umum)
	if len(monetizationChanges) > 0 || len(generalChanges) > 0 {
		var actorID *uint
		var actorName, actorEmail, actorRole string
		if u, ok := c.Locals("user").(*models.User); ok && u != nil {
			uid := u.ID
			actorID = &uid
			actorName = u.Name
			actorEmail = u.Email
			actorRole = u.PlatformStaffRoleLabel()
		}
		if actorRole == "" {
			actorRole = "superadmin"
		}
		if len(monetizationChanges) > 0 {
			services.RecordActivity(services.RecordActivityParams{
				DB:          h.db,
				UserID:      actorID,
				ActorRole:   actorRole,
				ActorName:   actorName,
				ActorEmail:  actorEmail,
				Action:      "admin.monetization_settings_updated",
				Category:    "superadmin",
				EntityType:  "setting",
				EntityTitle: "Google AdSense & GA4",
				Description: fmt.Sprintf("Memperbarui %d konfigurasi monetisasi & analitik platform.", len(monetizationChanges)),
				Changes:     map[string]interface{}{"updated": monetizationChanges},
				IPAddress:   c.IP(),
				UserAgent:   security.SanitizePlainText(c.Get("User-Agent"), 500),
			})
		}
		if len(generalChanges) > 0 {
			services.RecordActivity(services.RecordActivityParams{
				DB:          h.db,
				UserID:      actorID,
				ActorRole:   actorRole,
				ActorName:   actorName,
				ActorEmail:  actorEmail,
				Action:      "admin.settings_updated",
				Category:    "superadmin",
				EntityType:  "setting",
				EntityTitle: "Konfigurasi Platform",
				Description: fmt.Sprintf("Memperbarui %d konfigurasi pengaturan platform.", len(generalChanges)),
				Changes:     map[string]interface{}{"updated": generalChanges},
				IPAddress:   c.IP(),
				UserAgent:   security.SanitizePlainText(c.Get("User-Agent"), 500),
			})
		}
	}

	// Multi-Layer Rollback (AGENTS.md Rule 10): Hapus berkas fisik lama dari Cloudflare R2 / storage
	// HANYA setelah transaksi database berhasil di-commit.
	if len(filesToDelete) > 0 && h.storage != nil {
		for _, k := range filesToDelete {
			go func(key string) {
				_ = h.storage.Delete(context.Background(), key)
			}(k)
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": successMsg,
	})
}

// ResetRekberDefaults restores Rekber Syariah configuration back to official factory defaults
func (h *SettingHandler) ResetRekberDefaults(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	userVal := c.Locals("user")
	var user *models.User
	if userVal != nil {
		user, _ = userVal.(*models.User)
	}
	if user == nil {
		if uid, ok := c.Locals("user_id").(uint); ok && uid > 0 {
			var u models.User
			if err := h.db.First(&u, uid).Error; err == nil {
				user = &u
			}
		}
	}

	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	// SECURITY (N-12): otorisasi ditegakkan di level route lewat
	// RequirePermission("system:settings:manage"). Handler tetap menolak
	// non-staf sebagai lapisan kedua (defense in depth).
	if !middleware.IsPlatformStaffRole(user.PlatformRole) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "FORBIDDEN_ROLE",
			"message": "Akses Ditolak: Hanya Pengelola Platform yang berwenang.",
		})
	}

	keys := []string{
		"rekber_enabled",
		"rekber_partner_name",
		"rekber_website_url",
		"rekber_wa_number",
		"rekber_logo_url",
		"rekber_template_physical",
		"rekber_template_general",
		"rekber_template_food",
		"rekber_template_digital",
		"rekber_template_service",
		"rekber_template_plant",
		"rekber_template_fauna",
	}

	var fileToDelete string
	if h.storage != nil {
		var oldLogo models.Setting
		if err := h.db.Where("key = ?", "rekber_logo_url").First(&oldLogo).Error; err == nil && oldLogo.Value != "" {
			fileToDelete = extractPlatformStorageKey(oldLogo.Value)
		}
	}

	// ACID Atomic Database Transaction: Hapus entri setting rekber
	if err := h.db.Where("key IN ?", keys).Delete(&models.Setting{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mereset konfigurasi Rekber Syariah.",
		})
	}

	uid := user.ID
	services.RecordActivity(services.RecordActivityParams{
		DB:          h.db,
		UserID:      &uid,
		ActorRole:   user.PlatformStaffRoleLabel(),
		ActorName:   user.Name,
		ActorEmail:  user.Email,
		Action:      "admin.rekber_settings_reset",
		Category:    "superadmin",
		EntityType:  "setting",
		EntityTitle: "Konfigurasi Rekber Syariah",
		Description: "Mereset konfigurasi & template Rekber Syariah ke standar resmi platform.",
		Changes:     map[string]interface{}{"reset_keys": keys},
		IPAddress:   c.IP(),
		UserAgent:   security.SanitizePlainText(c.Get("User-Agent"), 500),
	})

	// Multi-Layer Rollback: Hapus berkas fisik lama dari storage HANYA setelah DB delete sukses
	if fileToDelete != "" && h.storage != nil {
		go func(k string) {
			_ = h.storage.Delete(context.Background(), k)
		}(fileToDelete)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Konfigurasi Rekber Syariah berhasil direset ke standar resmi rekbersyariah.com.",
	})
}

var (
	allowedPolicyTypes = map[string]bool{
		"terms":          true,
		"prohibited":     true,
		"privacy":        true,
		"moderation":     true,
		"transactions":   true,
		"subscription":   true,
		"acceptable_use": true,
	}
	policyMarkdownLinkRe = regexp.MustCompile(`\[([^\]]+)\]\(([^)]+)\)`)
)

func sanitizePolicyMarkdownLinks(input string) string {
	if !strings.Contains(input, "](") {
		return input
	}
	return policyMarkdownLinkRe.ReplaceAllStringFunc(input, func(match string) string {
		sub := policyMarkdownLinkRe.FindStringSubmatch(match)
		if len(sub) != 3 {
			return match
		}
		label := sub[1]
		rawTarget := strings.TrimSpace(sub[2])
		// Strip ASCII control characters & whitespace obfuscation (e.g. "java\tscript:")
		var cleaned strings.Builder
		for _, r := range rawTarget {
			if r > 0x20 && r != 0x7f {
				cleaned.WriteRune(r)
			}
		}
		target := cleaned.String()
		if target == "" {
			return label
		}
		if (strings.HasPrefix(target, "/") && !strings.HasPrefix(target, "//")) || strings.HasPrefix(target, "#") {
			return fmt.Sprintf("[%s](%s)", label, target)
		}
		parsed, err := url.Parse(target)
		if err != nil {
			return label
		}
		switch strings.ToLower(parsed.Scheme) {
		case "https", "http", "mailto", "tel":
			return fmt.Sprintf("[%s](%s)", label, target)
		default:
			return label
		}
	})
}

func (h *SettingHandler) GetPolicies(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}

	// SECURITY (SEC-06): Endpoint GET publik bersifat murni READ-ONLY (nol operasi tulis DB).
	// Baris aktif di database selalu diprioritaskan agar kebijakan kustom admin (termasuk mode
	// teks/markdown murni) tidak pernah ditimpa ulang; pilar yang belum ada di DB dihidrasi
	// secara in-memory dari definisi resmi.
	var policies []models.PolicyVersion
	if err := h.db.Where("is_active = ?", true).Find(&policies).Error; err != nil {
		log.Error().Err(err).Msg("settings: gagal mengambil kebijakan aktif")
	}

	res := make(map[string]models.PolicyVersion)
	for _, p := range policies {
		res[p.Type] = p
	}

	now := time.Now().UTC()
	for _, def := range database.GetDefaultPlatformPolicies() {
		if _, exists := res[def.Type]; !exists {
			sectionsJSON, _ := json.Marshal(def.Sections)
			res[def.Type] = models.PolicyVersion{
				Type:               def.Type,
				Title:              def.Title,
				Version:            def.Version,
				Content:            database.BuildMarkdownContent(def.Title, def.Sections.Summary, def.Sections.Articles),
				Sections:           datatypes.JSON(sectionsJSON),
				SummaryOfChanges:   def.SummaryOfChanges,
				ChangeType:         def.ChangeType,
				EffectiveDate:      now,
				IsActive:           true,
				RequiresAcceptance: def.RequiresAcceptance,
			}
		}
	}

	// Backwards compatibility alias: acceptable_use <-> prohibited
	if prohibitedDoc, ok := res["prohibited"]; ok {
		if _, hasAcceptable := res["acceptable_use"]; !hasAcceptable {
			acceptableCopy := prohibitedDoc
			acceptableCopy.Type = "acceptable_use"
			res["acceptable_use"] = acceptableCopy
		}
	} else if acceptableDoc, ok := res["acceptable_use"]; ok {
		if _, hasProhibited := res["prohibited"]; !hasProhibited {
			prohibitedCopy := acceptableDoc
			prohibitedCopy.Type = "prohibited"
			res["prohibited"] = prohibitedCopy
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    res,
	})
}

func (h *SettingHandler) UpdatePolicy(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Autentikasi diperlukan.",
		})
	}

	// Multi-layer RBAC check: Hanya platform staff / superadmin yang boleh memutakhirkan kebijakan
	if !middleware.IsPlatformStaffRole(user.PlatformRole) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses Ditolak: Hanya Pengelola Platform yang berwenang memperbarui kebijakan.",
		})
	}

	var req struct {
		Type               string          `json:"type"`
		Title              string          `json:"title"`
		Version            string          `json:"version"`
		Content            string          `json:"content"`
		Sections           json.RawMessage `json:"sections"`
		SummaryOfChanges   string          `json:"summary_of_changes"`
		ChangeType         string          `json:"change_type"`
		RequiresAcceptance bool            `json:"requires_acceptance"`
	}

	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Type) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Tipe kebijakan wajib diisi dengan format JSON yang valid.",
		})
	}

	policyType := strings.ToLower(strings.TrimSpace(security.SanitizePlainText(req.Type, 50)))
	if !allowedPolicyTypes[policyType] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Tipe pilar kebijakan tidak dikenali.",
		})
	}

	title := security.SanitizePlainText(req.Title, 255)
	if title == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Judul dokumen kebijakan wajib diisi.",
		})
	}
	version := security.SanitizePlainText(req.Version, 50)
	if version == "" {
		version = "v2.0"
	}
	summary := sanitizePolicyMarkdownLinks(security.SanitizeRichText(req.SummaryOfChanges, 2000))
	changeType := strings.ToLower(strings.TrimSpace(security.SanitizePlainText(req.ChangeType, 50)))
	if changeType != "major" && changeType != "minor" && changeType != "patch" {
		changeType = "minor"
	}

	var sectionsJSON datatypes.JSON
	content := req.Content

	trimmedSections := bytes.TrimSpace(req.Sections)
	if len(trimmedSections) > 0 && string(trimmedSections) != "null" && string(trimmedSections) != "{}" {
		if len(trimmedSections) > 512*1024 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Ukuran struktur pasal kebijakan melebihi batas maksimum (512 KB).",
			})
		}
		var secData database.PolicySectionData
		dec := json.NewDecoder(bytes.NewReader(trimmedSections))
		if err := dec.Decode(&secData); err != nil {
			// SECURITY (SEC-03): Dilarang menyimpan JSON mentah saat gagal decode!
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Struktur JSON pasal kebijakan tidak valid.",
			})
		}
		if len(secData.Articles) > 50 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Jumlah pasal melampaui batas maksimum (50 pasal per dokumen).",
			})
		}
		secData.Category = security.SanitizePlainText(secData.Category, 150)
		secData.Badge = security.SanitizePlainText(secData.Badge, 100)
		secData.IconKey = security.SanitizePlainText(secData.IconKey, 50)
		secData.Summary = sanitizePolicyMarkdownLinks(security.SanitizeRichText(secData.Summary, 2000))
		for i := range secData.Articles {
			if len(secData.Articles[i].Highlights) > 30 {
				secData.Articles[i].Highlights = secData.Articles[i].Highlights[:30]
			}
			secData.Articles[i].Number = security.SanitizePlainText(secData.Articles[i].Number, 50)
			secData.Articles[i].Heading = security.SanitizePlainText(secData.Articles[i].Heading, 255)
			secData.Articles[i].Content = sanitizePolicyMarkdownLinks(security.SanitizeRichText(secData.Articles[i].Content, 20000))
			for j := range secData.Articles[i].Highlights {
				secData.Articles[i].Highlights[j] = sanitizePolicyMarkdownLinks(security.SanitizePlainText(secData.Articles[i].Highlights[j], 1000))
			}
		}
		sanitizedBytes, err := json.Marshal(secData)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": "Gagal memproses struktur pasal kebijakan.",
			})
		}
		sectionsJSON = datatypes.JSON(sanitizedBytes)

		if strings.TrimSpace(content) == "" {
			content = database.BuildMarkdownContent(title, secData.Summary, secData.Articles)
		}
	}

	content = sanitizePolicyMarkdownLinks(security.SanitizeRichText(content, 100000))

	var oldVersion string
	var currentActive models.PolicyVersion
	if err := h.db.Where("type = ? AND is_active = ?", policyType, true).First(&currentActive).Error; err == nil {
		oldVersion = currentActive.Version
	}

	var newPolicy models.PolicyVersion
	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.PolicyVersion{}).Where("type = ?", policyType).Update("is_active", false).Error; err != nil {
			return err
		}

		now := time.Now().UTC()
		newPolicy = models.PolicyVersion{
			Type:               policyType,
			Title:              title,
			Version:            version,
			Content:            content,
			Sections:           sectionsJSON,
			SummaryOfChanges:   summary,
			ChangeType:         changeType,
			EffectiveDate:      now,
			IsActive:           true,
			RequiresAcceptance: req.RequiresAcceptance,
			CreatedBy:          user.ID,
			CreatedAt:          now,
			UpdatedAt:          now,
		}
		if err := tx.Create(&newPolicy).Error; err != nil {
			return err
		}

		auditLog := models.PolicyAuditLog{
			PolicyType:    policyType,
			Action:        "update",
			OldVersion:    oldVersion,
			NewVersion:    version,
			ChangeSummary: summary,
			AdminEmail:    user.Email,
			AdminIP:       c.IP(),
			CreatedAt:     now,
		}
		return tx.Create(&auditLog).Error
	})

	if err != nil {
		log.Error().Err(err).Str("policy_type", policyType).Msg("settings: gagal memperbarui kebijakan")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Gagal memperbarui kebijakan platform."),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Kebijakan berhasil diperbarui dan dicatat dalam audit trail.",
		"data":    newPolicy,
	})
}

func (h *SettingHandler) ResetDefaultPolicies(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil || !middleware.IsPlatformStaffRole(user.PlatformRole) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses Ditolak: Hanya Pengelola Platform yang berwenang mereset kebijakan resmi.",
		})
	}

	var req struct {
		Type       string `json:"type"`
		PolicyType string `json:"policy_type"` // Alias kompatibilitas mundur agar tidak jatuh ke "" (reset masal)
	}
	if err := c.BodyParser(&req); err != nil && len(c.Body()) > 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Payload permintaan reset tidak valid.",
		})
	}

	targetType := strings.ToLower(strings.TrimSpace(req.Type))
	if targetType == "" {
		targetType = strings.ToLower(strings.TrimSpace(req.PolicyType))
	}
	if targetType == "acceptable_use" {
		targetType = "prohibited"
	}

	// SECURITY (SEC-05): Tolak permintaan reset tanpa target eksplisit ("all" atau nama pilar sah)
	// agar ketidaksesuaian nama field tidak pernah memicu reset masal 6 pilar secara diam-diam!
	if targetType == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Target reset kebijakan wajib disebutkan secara eksplisit ('all' atau kode dokumen spesifik).",
		})
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		defs := database.GetDefaultPlatformPolicies()

		if targetType == "all" {
			for _, found := range defs {
				sectionsJSON, err := json.Marshal(found.Sections)
				if err != nil {
					return err
				}
				content := database.BuildMarkdownContent(found.Title, found.Sections.Summary, found.Sections.Articles)
				if err := tx.Model(&models.PolicyVersion{}).Where("type = ? AND is_active = ?", found.Type, true).Update("is_active", false).Error; err != nil {
					return err
				}
				newPolicy := models.PolicyVersion{
					Type:               found.Type,
					Title:              found.Title,
					Version:            found.Version,
					Content:            content,
					Sections:           datatypes.JSON(sectionsJSON),
					SummaryOfChanges:   "Reset ke standar resmi platform Catavor " + found.Version,
					ChangeType:         "major",
					EffectiveDate:      now,
					IsActive:           true,
					RequiresAcceptance: found.RequiresAcceptance,
					CreatedBy:          user.ID,
					CreatedAt:          now,
					UpdatedAt:          now,
				}
				if err := tx.Create(&newPolicy).Error; err != nil {
					return err
				}
			}
			auditLog := models.PolicyAuditLog{
				PolicyType:    "all",
				Action:        "reset_defaults",
				NewVersion:    "v2.0",
				ChangeSummary: "Seluruh 6 pilar kebijakan platform direset ke standar resmi Catavor v2.0.",
				AdminEmail:    user.Email,
				AdminIP:       c.IP(),
				CreatedAt:     now,
			}
			return tx.Create(&auditLog).Error
		}

		var found *database.PolicyDefinition
		for i := range defs {
			if defs[i].Type == targetType {
				found = &defs[i]
				break
			}
		}
		if found == nil {
			return fmt.Errorf("tipe kebijakan '%s' tidak valid", targetType)
		}

		sectionsJSON, err := json.Marshal(found.Sections)
		if err != nil {
			return err
		}
		content := database.BuildMarkdownContent(found.Title, found.Sections.Summary, found.Sections.Articles)

		if err := tx.Model(&models.PolicyVersion{}).Where("type = ? AND is_active = ?", targetType, true).Update("is_active", false).Error; err != nil {
			return err
		}

		newPolicy := models.PolicyVersion{
			Type:               found.Type,
			Title:              found.Title,
			Version:            found.Version,
			Content:            content,
			Sections:           datatypes.JSON(sectionsJSON),
			SummaryOfChanges:   "Reset ke standar resmi platform Catavor " + found.Version,
			ChangeType:         "major",
			EffectiveDate:      now,
			IsActive:           true,
			RequiresAcceptance: found.RequiresAcceptance,
			CreatedBy:          user.ID,
			CreatedAt:          now,
			UpdatedAt:          now,
		}
		if err := tx.Create(&newPolicy).Error; err != nil {
			return err
		}

		auditLog := models.PolicyAuditLog{
			PolicyType:    targetType,
			Action:        "reset_defaults",
			NewVersion:    found.Version,
			ChangeSummary: "Kebijakan " + found.Title + " direset ke standar resmi Catavor " + found.Version,
			AdminEmail:    user.Email,
			AdminIP:       c.IP(),
			CreatedAt:     now,
		}
		return tx.Create(&auditLog).Error
	})

	if err != nil {
		if strings.Contains(err.Error(), "tidak valid") {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"message": safeErrMsg(err, "Tipe kebijakan tidak valid."),
			})
		}
		log.Error().Err(err).Str("target_type", targetType).Msg("settings: gagal mereset kebijakan")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": safeErrMsg(err, "Gagal mereset kebijakan ke standar resmi."),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Kebijakan berhasil dikembalikan ke standar resmi Catavor.",
	})
}

func (h *SettingHandler) GetPolicyAuditLogs(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	// SECURITY (N-43): Pertahanan berlapis di level handler agar merchant biasa tidak dapat membaca AdminEmail/AdminIP.
	user, ok := c.Locals("user").(*models.User)
	if !ok || user == nil || !middleware.IsPlatformStaffRole(user.PlatformRole) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Akses Ditolak: Hanya Pengelola Platform yang berwenang melihat log audit kebijakan.",
		})
	}

	page := 1
	if p, err := strconv.Atoi(strings.TrimSpace(c.Query("page", "1"))); err == nil && p > 0 {
		page = p
	}
	perPage := 20
	if lp, err := strconv.Atoi(strings.TrimSpace(c.Query("per_page", c.Query("limit", "20")))); err == nil && lp > 0 {
		if lp > 100 {
			lp = 100
		}
		perPage = lp
	}

	var total int64
	if err := h.db.Model(&models.PolicyAuditLog{}).Count(&total).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menghitung total log audit kebijakan.",
		})
	}

	totalPages := int((total + int64(perPage) - 1) / int64(perPage))
	if totalPages < 1 {
		totalPages = 1
	}
	if page > totalPages {
		page = totalPages
	}
	offset := (page - 1) * perPage

	var logs []models.PolicyAuditLog
	if err := h.db.Order("created_at desc, id desc").Offset(offset).Limit(perPage).Find(&logs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat log audit kebijakan.",
		})
	}

	return c.JSON(fiber.Map{
		"success":     true,
		"data":        logs,
		"total":       total,
		"page":        page,
		"per_page":    perPage,
		"total_pages": totalPages,
	})
}

// Agreement registration
func (h *SettingHandler) RecordAgreement(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	var req struct {
		StoreID         *uint  `json:"store_id"`
		PolicyType      string `json:"policy_type"`
		PolicyVersion   string `json:"policy_version"`
		AgreedContext   string `json:"agreed_context"`
		CustomerContact string `json:"customer_contact"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format persetujuan kebijakan tidak valid.",
		})
	}

	agreement := models.UserPolicyAgreement{
		StoreID:         req.StoreID,
		PolicyType:      security.SanitizePlainText(req.PolicyType, 50),
		PolicyVersion:   security.SanitizePlainText(req.PolicyVersion, 50),
		IPAddress:       c.IP(),
		UserAgent:       security.SanitizePlainText(c.Get("User-Agent"), 500),
		AgreedContext:   security.SanitizePlainText(req.AgreedContext, 50),
		CustomerContact: security.SanitizePlainText(req.CustomerContact, 255),
		AgreedAt:        time.Now().UTC(),
	}
	if err := h.db.Create(&agreement).Error; err != nil {
		log.Error().Err(err).Msg("settings: gagal menyimpan persetujuan kebijakan")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal mencatat persetujuan kebijakan.",
		})
	}

	return c.JSON(fiber.Map{"success": true})
}

// GetMonetizationSettings returns ONLY Google AdSense & GA4 platform settings (safe for monetization:google:manage RBAC role).
func (h *SettingHandler) GetMonetizationSettings(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	var rows []models.Setting
	if err := h.db.Where("key IN ?", monetizationSettingKeys).Find(&rows).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat pengaturan monetisasi platform.",
		})
	}
	res := make(map[string]string, len(monetizationSettingKeys))
	for _, r := range rows {
		res[r.Key] = r.Value
	}
	h.applyFallbacks(res)
	filtered := make(map[string]string, len(monetizationSettingKeys))
	for _, k := range monetizationSettingKeys {
		filtered[k] = res[k]
	}
	return c.JSON(fiber.Map{
		"success": true,
		"data":    filtered,
	})
}

// StoreMonetization saves Google AdSense & GA4 platform settings with strict key allowlisting and audit logging.
func (h *SettingHandler) StoreMonetization(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	var rawPayload map[string]string
	if err := c.BodyParser(&rawPayload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data pengaturan monetisasi tidak valid.",
		})
	}
	filtered := make(map[string]string, len(rawPayload))
	for k, v := range rawPayload {
		cleanKey := security.SanitizePlainText(k, 100)
		if cleanKey == "" {
			continue
		}
		if !isMonetizationKey(cleanKey) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"message": fmt.Sprintf("Kunci pengaturan '%s' tidak termasuk modul monetisasi & analitik.", cleanKey),
			})
		}
		filtered[cleanKey] = v
	}
	if err := validateAndPrepareMonetizationSettings(h.db, filtered); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": err.Error(),
		})
	}
	return h.persistPlatformSettings(c, filtered, "Pengaturan monetisasi & analitik Google berhasil disimpan.")
}
