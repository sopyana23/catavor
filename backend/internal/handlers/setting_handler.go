package handlers

import (
	"strings"
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"

	"github.com/gofiber/fiber/v2"
)

type SettingHandler struct{}

func NewSettingHandler() *SettingHandler {
	return &SettingHandler{}
}

func (h *SettingHandler) Index(c *fiber.Ctx) error {
	var settings []models.Setting
	database.DB.Find(&settings)

	res := make(map[string]string)
	for _, s := range settings {
		res[s.Key] = s.Value
	}

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
		res["ads_auto_enabled"] = "1"
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
	if _, ok := res["rekber_wa_number"]; !ok {
		res["rekber_wa_number"] = ""
	}
	if _, ok := res["rekber_template_physical"]; !ok {
		res["rekber_template_physical"] = "Halo *{store_title}*, saya berminat membeli barang berikut:\n📦 *{item_name}* (Harga: {item_price})\n\nSaya ingin bertransaksi secara aman menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})*.\nMohon bantuannya untuk mendaftarkan transaksi ini melalui website {rekber_website_url}{rekber_wa_section}. Terima kasih."
	}
	if _, ok := res["rekber_template_general"]; !ok {
		res["rekber_template_general"] = res["rekber_template_physical"]
	}
	if _, ok := res["rekber_template_food"]; !ok {
		res["rekber_template_food"] = "Halo Admin Rekber Syariah *{store_title}*, saya ingin memesan menu kuliner berikut:\n🍲 *{item_name}* (Harga: {item_price})\n\nSaya ingin bertransaksi menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})*.\nMohon bantuannya untuk mendaftarkan transaksi ini{rekber_wa_section} dan membuatkan grup WhatsApp transaksi bersama. Terima kasih."
	}
	if _, ok := res["rekber_template_digital"]; !ok {
		res["rekber_template_digital"] = "Halo Admin Rekber Syariah *{store_title}*, saya ingin membeli item digital berlisensi berikut:\n💾 *{item_name}* (Harga: {item_price})\n\nSaya ingin bertransaksi menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})* agar file dan pembayaran terlindungi secara aman.\nMohon bantuannya untuk mendaftarkan transaksi ini melalui website {rekber_website_url}{rekber_wa_section}. Terima kasih."
	}
	if _, ok := res["rekber_template_service"]; !ok {
		res["rekber_template_service"] = "Halo Admin Rekber Syariah *{store_title}*, saya ingin memesan layanan jasa dengan perlindungan escrow aman:\n💼 *{item_name}* (Tarif: {item_price})\n\nSaya ingin bertransaksi menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})* agar dana aman selama masa pengerjaan.\nMohon bantuannya untuk mendaftarkan transaksi ini melalui website {rekber_website_url}{rekber_wa_section} atau membuatkan grup WhatsApp transaksi bersama. Terima kasih."
	}
	if _, ok := res["rekber_template_plant"]; !ok {
		res["rekber_template_plant"] = "Halo Admin Rekber Syariah *{store_title}*, saya ingin membeli tanaman berikut:\n🌱 *{item_name}* (Harga: {item_price})\n\nSaya ingin bertransaksi menggunakan perlindungan *Rekening Bersama Syariah ({rekber_website_domain})* agar dana aman hingga tanaman tiba dalam kondisi segar.\nMohon bantuannya untuk mendaftarkan transaksi ini melalui website {rekber_website_url}{rekber_wa_section}. Terima kasih."
	}
	if _, ok := res["rekber_template_fauna"]; !ok {
		res["rekber_template_fauna"] = "Halo Admin Rekber Syariah *{store_title}*, saya berminat mengadopsi / membeli hewan berikut:\n🐾 *{item_name}* (Biaya Adopsi/Harga: {item_price})\n\nSaya ingin bertransaksi menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})* dengan proteksi garansi hidup & kesehatan saat tiba.\nMohon bantuannya untuk mendaftarkan transaksi ini melalui website {rekber_website_url}{rekber_wa_section} atau membuatkan grup WhatsApp bersama. Terima kasih."
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    res,
	})
}

// GetAdsTxt serves public /ads.txt for Google AdSense site verification
func (h *SettingHandler) GetAdsTxt(c *fiber.Ctx) error {
	var s models.Setting
	content := "google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0"
	if err := database.DB.Where("key = ?", "ads_txt_content").First(&s).Error; err == nil && s.Value != "" {
		content = s.Value
	} else if err := database.DB.Where("key = ?", "ads_client_id").First(&s).Error; err == nil && s.Value != "" {
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
			if err := database.DB.First(&u, uid).Error; err == nil {
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

	role := strings.ToLower(strings.TrimSpace(user.PlatformRole))
	if role == "" || role == "merchant" {
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

	for k, v := range payload {
		sanitizedKey := security.SanitizePlainText(k, 100)
		if sanitizedKey == "" {
			continue
		}
		sanitizedVal := security.SanitizeRichText(v, 10000)

		var s models.Setting
		if err := database.DB.Where("key = ?", sanitizedKey).First(&s).Error; err != nil {
			database.DB.Create(&models.Setting{Key: sanitizedKey, Value: sanitizedVal})
		} else {
			s.Value = sanitizedVal
			database.DB.Save(&s)
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Pengaturan platform berhasil disimpan.",
	})
}

// ResetRekberDefaults restores Rekber Syariah configuration back to official factory defaults
func (h *SettingHandler) ResetRekberDefaults(c *fiber.Ctx) error {
	userVal := c.Locals("user")
	var user *models.User
	if userVal != nil {
		user, _ = userVal.(*models.User)
	}
	if user == nil {
		if uid, ok := c.Locals("user_id").(uint); ok && uid > 0 {
			var u models.User
			if err := database.DB.First(&u, uid).Error; err == nil {
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

	role := strings.ToLower(strings.TrimSpace(user.PlatformRole))
	if role == "" || role == "merchant" {
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
		"rekber_template_physical",
		"rekber_template_general",
		"rekber_template_food",
		"rekber_template_digital",
		"rekber_template_service",
		"rekber_template_plant",
		"rekber_template_fauna",
	}

	database.DB.Where("key IN ?", keys).Delete(&models.Setting{})

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Konfigurasi Rekber Syariah berhasil direset ke standar resmi rekbersyariah.com.",
	})
}

func (h *SettingHandler) GetPolicies(c *fiber.Ctx) error {
	var policies []models.PolicyVersion
	database.DB.Where("is_active = true").Find(&policies)

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
	user := c.Locals("user").(*models.User)

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
	database.DB.Model(&models.PolicyVersion{}).Where("type = ?", policyType).Update("is_active", false)

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
	database.DB.Create(&newVersion)

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
	database.DB.Create(&auditLog)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Kebijakan berhasil diperbarui dan dicatat dalam audit trail.",
		"data":    newVersion,
	})
}

func (h *SettingHandler) GetPolicyAuditLogs(c *fiber.Ctx) error {
	var logs []models.PolicyAuditLog
	database.DB.Order("created_at desc").Limit(100).Find(&logs)

	return c.JSON(fiber.Map{
		"success": true,
		"data":    logs,
	})
}



// Agreement registration
func (h *SettingHandler) RecordAgreement(c *fiber.Ctx) error {
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
	database.DB.Create(&agreement)

	return c.JSON(fiber.Map{"success": true})
}
