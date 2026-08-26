package handlers

import (
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"

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

	return c.JSON(fiber.Map{
		"success": true,
		"data":    res,
	})
}

func (h *SettingHandler) Store(c *fiber.Ctx) error {
	var payload map[string]string
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	for k, v := range payload {
		var s models.Setting
		if err := database.DB.Where("key = ?", k).First(&s).Error; err != nil {
			database.DB.Create(&models.Setting{Key: k, Value: v})
		} else {
			s.Value = v
			database.DB.Save(&s)
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Pengaturan berhasil disimpan.",
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

	// Deactivate previous
	database.DB.Model(&models.PolicyVersion{}).Where("type = ?", req.Type).Update("is_active", false)

	newVersion := models.PolicyVersion{
		Type:             req.Type,
		Title:            req.Title,
		Version:          req.Version,
		Content:          req.Content,
		SummaryOfChanges: req.SummaryOfChanges,
		ChangeType:       req.ChangeType,
		EffectiveDate:    time.Now(),
		IsActive:         true,
		CreatedBy:        user.ID,
		CreatedAt:        time.Now(),
	}
	database.DB.Create(&newVersion)

	// SOC 2 Audit Trail
	auditLog := models.PolicyAuditLog{
		PolicyType:    req.Type,
		Action:        "update",
		NewVersion:    req.Version,
		ChangeSummary: req.SummaryOfChanges,
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

func (h *SettingHandler) StoreSighting(c *fiber.Ctx) error {
	var sighting models.Sighting
	if err := c.BodyParser(&sighting); err != nil || sighting.FaunaID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Data penampakan tidak valid.",
		})
	}

	now := time.Now()
	if sighting.SightedAt == nil {
		sighting.SightedAt = &now
	}
	database.DB.Create(&sighting)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Penampakan berhasil dicatat.",
		"data":    sighting,
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
		PolicyType:      req.PolicyType,
		PolicyVersion:   req.PolicyVersion,
		IPAddress:       c.IP(),
		UserAgent:       c.Get("User-Agent"),
		AgreedContext:   req.AgreedContext,
		CustomerContact: req.CustomerContact,
		AgreedAt:        time.Now(),
	}
	database.DB.Create(&agreement)

	return c.JSON(fiber.Map{"success": true})
}
