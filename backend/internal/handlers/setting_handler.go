package handlers

import (
	"context"
	"strings"
	"time"

	"catavor-backend/internal/middleware"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"
	"catavor-backend/internal/services"
	"catavor-backend/internal/storage"

	"github.com/gofiber/fiber/v2"
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
		"store_title":              true,
		"articles_enabled":         true,
		"ads_enabled":              true,
		"ads_client_id":            true,
		"ads_auto_enabled":         true,
		"ads_slot_header":          true,
		"ads_slot_infeed":          true,
		"ads_slot_product_detail":  true,
		"ads_slot_bottom":          true,
		"ads_slot_dashboard":       true,
		"ads_test_mode":            true,
		"ads_txt_content":          true,
		"ga_enabled":               true,
		"ga_measurement_id":        true,
		"market_intel_enabled":     true,
		"rekber_enabled":           true,
		"rekber_partner_name":      true,
		"rekber_website_url":       true,
		"rekber_wa_number":         true,
		"rekber_logo_url":          true,
		"rekber_template_physical": true,
		"rekber_template_general":  true,
		"rekber_template_food":     true,
		"rekber_template_digital":  true,
		"rekber_template_service":  true,
		"rekber_template_plant":    true,
		"rekber_template_fauna":    true,
		"maintenance_mode":         true,
		"maintenance_message":      true,
		"payment_system_mode":         true,
		"payment_maintenance_title":    true,
		"payment_maintenance_message":  true,
		"payment_qris_manual_image":    true,
		"payment_qris_manual_merchant": true,
		"payment_bank_name":            true,
		"payment_bank_account":         true,
		"payment_bank_holder":          true,
		"payment_aulaa_channel_qris":    true,
		"payment_aulaa_channel_va":      true,
		"payment_aulaa_channel_cc":      true,
		"payment_aulaa_channel_ewallet": true,
		"platform_official_whatsapp":   true,
		"platform_official_email":      true,
		"contact_whatsapp":             true,
		"contact_email":                true,
		"terms_conditions":             true,
		"privacy_policy":           true,
	}

	var settings []models.Setting
	h.db.Find(&settings)

	res := make(map[string]string)
	for _, s := range settings {
		if publicKeys[s.Key] {
			res[s.Key] = s.Value
		}
	}

	h.applyFallbacks(res)

	return c.JSON(fiber.Map{
		"success": true,
		"data":    res,
	})
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

func (h *SettingHandler) Index(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	var settings []models.Setting
	h.db.Find(&settings)

	res := make(map[string]string)
	for _, s := range settings {
		if secretPlatformKeys[s.Key] {
			res[s.Key] = maskSecretValue(s.Value)
		} else {
			res[s.Key] = s.Value
		}
	}

	h.applyFallbacks(res)

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
	if _, ok := res["ads_txt_content"]; !ok {
		res["ads_txt_content"] = "google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0"
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
func (h *SettingHandler) GetAdsTxt(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	var s models.Setting
	content := "google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0"
	if err := h.db.Where("key = ?", "ads_txt_content").First(&s).Error; err == nil && s.Value != "" {
		content = s.Value
	} else if err := h.db.Where("key = ?", "ads_client_id").First(&s).Error; err == nil && s.Value != "" {
		pubId := s.Value
		if len(pubId) > 3 && pubId[:3] == "ca-" {
			pubId = pubId[3:]
		}
		content = "google.com, " + pubId + ", DIRECT, f08c47fec0942fa0"
	}
	c.Set("Content-Type", "text/plain; charset=utf-8")
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

	// SECURITY (N-12): whitelist eksplisit, bukan blacklist. Sebelumnya hanya
	// "" dan "merchant" yang ditolak sehingga staf operasional mana pun (mis.
	// support) bisa mengubah pengaturan platform.
	if !middleware.IsPlatformStaffRole(user.PlatformRole) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"code":    "FORBIDDEN_ROLE",
			"message": "Akses Ditolak: Hanya Pengelola Platform (Admin/Superadmin) yang berwenang mengubah konfigurasi sistem.",
		})
	}

	var payload map[string]string
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
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

	var filesToDelete []string

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
			sanitizedVal := security.SanitizeRichText(v, 10000)

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
		"message": "Pengaturan platform berhasil disimpan.",
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

func (h *SettingHandler) GetPolicies(c *fiber.Ctx) error {
	if h.db == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
	}
	var policies []models.PolicyVersion
	h.db.Where("is_active = true").Find(&policies)

	res := make(map[string]models.PolicyVersion)
	for _, p := range policies {
		res[p.Type] = p
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

	var req struct {
		Type             string `json:"type"`
		Title            string `json:"title"`
		Version          string `json:"version"`
		Content          string `json:"content"`
		SummaryOfChanges string `json:"summary_of_changes"`
		ChangeType       string `json:"change_type"`
	}

	if err := c.BodyParser(&req); err != nil || req.Type == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Tipe kebijakan wajib diisi.",
		})
	}

	policyType := security.SanitizePlainText(req.Type, 50)
	title := security.SanitizePlainText(req.Title, 255)
	version := security.SanitizePlainText(req.Version, 50)
	content := security.SanitizeRichText(req.Content, 100000)
	summary := security.SanitizeRichText(req.SummaryOfChanges, 2000)
	changeType := security.SanitizePlainText(req.ChangeType, 50)
	if changeType == "" {
		changeType = "minor"
	}

	// Deactivate previous
	h.db.Model(&models.PolicyVersion{}).Where("type = ?", policyType).Update("is_active", false)

	newVersion := models.PolicyVersion{
		Type:             policyType,
		Title:            title,
		Version:          version,
		Content:          content,
		SummaryOfChanges: summary,
		ChangeType:       changeType,
		EffectiveDate:    time.Now(),
		IsActive:         true,
		CreatedBy:        user.ID,
		CreatedAt:        time.Now(),
	}
	h.db.Create(&newVersion)

	// SOC 2 Audit Trail
	auditLog := models.PolicyAuditLog{
		PolicyType:    policyType,
		Action:        "update",
		NewVersion:    version,
		ChangeSummary: summary,
		AdminEmail:    user.Email,
		AdminIP:       c.IP(),
		CreatedAt:     time.Now(),
	}
	h.db.Create(&auditLog)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Kebijakan berhasil diperbarui dan dicatat dalam audit trail.",
		"data":    newVersion,
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
	var logs []models.PolicyAuditLog
	h.db.Order("created_at desc").Limit(100).Find(&logs)

	return c.JSON(fiber.Map{
		"success": true,
		"data":    logs,
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
	_ = c.BodyParser(&req)

	agreement := models.UserPolicyAgreement{
		StoreID:         req.StoreID,
		PolicyType:      security.SanitizePlainText(req.PolicyType, 50),
		PolicyVersion:   security.SanitizePlainText(req.PolicyVersion, 50),
		IPAddress:       c.IP(),
		UserAgent:       security.SanitizePlainText(c.Get("User-Agent"), 500),
		AgreedContext:   security.SanitizePlainText(req.AgreedContext, 50),
		CustomerContact: security.SanitizePlainText(req.CustomerContact, 255),
		AgreedAt:        time.Now(),
	}
	h.db.Create(&agreement)

	return c.JSON(fiber.Map{"success": true})
}
