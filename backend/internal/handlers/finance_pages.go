package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

const financeStatusSQL = `CASE WHEN o.payment_status IN ('pending','pending_payment','pending_verification') THEN 'pending'
 WHEN o.payment_status IN ('active','paid') THEN 'paid' WHEN o.payment_status IN ('rejected','cancelled','expired') THEN 'rejected'
 ELSE o.payment_status END`

// Keep older invoices without payment_mode classifiable, just like the portal's paymentChannel.
const financeChannelSQL = `CASE WHEN lower(trim(payment_mode))='coupon_free' OR lower(trim(payment_method)) IN ('free','coupon_free')
 OR (final_amount=0 AND (coalesce(trim(coupon_code),'')<>'' OR (original_amount>0 AND discount_amount>=original_amount))) THEN 'coupon_free'
 WHEN lower(trim(payment_mode))='gateway_aulaa' OR lower(gateway_provider)='aulaa' OR coalesce(trim(gateway_reference),'')<>''
 OR coalesce(trim(gateway_payment_link),'')<>'' OR lower(trim(payment_method)) LIKE 'aulaa%'
 OR lower(trim(payment_method)) IN ('va','ewallet','cc','card') THEN 'gateway_aulaa'
 WHEN lower(payment_method) LIKE '%qris%' THEN 'manual_qris' ELSE 'manual_bank' END`

type financeBucket struct {
	State, Kind, Raw string
	N                int
	Revenue          string
}

// A finance row carries the merchant and reviewer details displayed on the invoice.
// Using projections here avoids reading storefront catalogs, page content and account settings.
type financeStore struct {
	ID             uint   `json:"id"`
	StoreTitle     string `json:"store_title"`
	Slug           string `json:"slug"`
	WhatsappNumber string `json:"whatsapp_number"`
	Plan           string `json:"plan"`
}

func (financeStore) TableName() string { return "stores" }

type financeUser struct {
	ID    uint   `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

func (financeUser) TableName() string { return "users" }

type financeOrderRow struct {
	models.SubscriptionOrder
	Store          *financeStore `gorm:"foreignKey:StoreID" json:"store,omitempty"`
	User           *financeUser  `gorm:"foreignKey:UserID" json:"user,omitempty"`
	ApprovedByUser *financeUser  `gorm:"foreignKey:ApprovedByUserID" json:"approved_by_user,omitempty"`
}

type financeQuery struct {
	Page, Limit           int
	Keyword, Status, Kind string
}

type financePage struct {
	Success bool                      `json:"success"`
	Data    any                       `json:"data"`
	Page    int                       `json:"page"`
	Limit   int                       `json:"limit"`
	Total   int                       `json:"total"`
	Facets  map[string]map[string]int `json:"facets"`
	Summary map[string]any            `json:"summary"`
}

func financeParam(c *fiber.Ctx, key string) string {
	s := strings.TrimSpace(c.Query(key))
	if s == "all" {
		return ""
	}
	return s
}

func parseFinanceQuery(c *fiber.Ctx, kind string) (financeQuery, error) {
	page, err := strconv.Atoi(c.Query("page", "1"))
	if err != nil || page < 1 {
		return financeQuery{}, fiber.NewError(400, "Halaman tidak valid")
	}
	limit, err := strconv.Atoi(c.Query("limit", "10"))
	if err != nil || limit < 1 || limit > 100 {
		return financeQuery{}, fiber.NewError(400, "Batas halaman harus antara 1 dan 100")
	}
	q := strings.TrimSpace(c.Query("q"))
	if len([]rune(q)) > 150 {
		return financeQuery{}, fiber.NewError(400, "Kata kunci terlalu panjang")
	}
	return financeQuery{page, limit, q, financeParam(c, "status"), financeParam(c, kind)}, nil
}

func (q financeQuery) aggregate(rows []financeBucket, kindKey string) financePage {
	states, kinds := map[string]int{"all": 0}, map[string]int{"all": 0}
	counts := map[string]int{"total": 0}
	p := financePage{Success: true, Page: q.Page, Limit: q.Limit, Facets: map[string]map[string]int{"status": states, kindKey: kinds},
		Summary: map[string]any{"revenue": 0, "pending": 0, "paid": 0, "rejected": 0, "active": 0, "inactive": 0, "free": 0, "discount": 0}}
	if len(rows) > 0 && rows[0].Revenue != "" {
		p.Summary["revenue"] = json.Number(rows[0].Revenue)
	}
	for _, row := range rows {
		counts["total"] += row.N
		counts[row.State] += row.N
		if kindKey == "type" {
			counts[row.Kind] += row.N
		}
		statusMatch := q.Status == "" || q.Status == row.State || q.Status == row.Raw
		kindMatch := q.Kind == "" || q.Kind == row.Kind
		if kindMatch {
			states["all"] += row.N
			states[row.State] += row.N
		}
		if statusMatch {
			kinds["all"] += row.N
			kinds[row.Kind] += row.N
		}
		if kindMatch && statusMatch {
			p.Total += row.N
		}
	}
	for key, count := range counts {
		p.Summary[key] = count
	}
	last := max(1, (p.Total+p.Limit-1)/p.Limit)
	p.Page = min(p.Page, last)
	return p
}

func financeSearchPattern(q string) string {
	return "%" + strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`).Replace(q) + "%"
}

func financeOrderBase(db *gorm.DB, q string) *gorm.DB {
	query := db.Table("subscription_orders AS o")
	if q == "" {
		return query
	}
	// Search display fields, including legacy method/plan codes. Bind the keyword once.
	return query.Joins("LEFT JOIN stores s ON s.id=o.store_id").Joins("LEFT JOIN users u ON u.id=o.user_id").
		Where(`concat_ws(' ', o.order_number, o.id::text, s.store_title, s.slug, s.whatsapp_number,
		u.name, u.email, o.sender_account_name, o.sender_phone, o.gateway_reference, o.coupon_code, o.plan_code,
		o.payment_method, o.payment_mode, o.payment_status) ILIKE ?`, financeSearchPattern(q))
}

func (h *SubscriptionHandler) financeOrdersPage(c *fiber.Ctx) error {
	q, err := parseFinanceQuery(c, "channel")
	if err != nil {
		return err
	}
	var result financePage
	ctx, cancel := context.WithTimeout(c.UserContext(), 10*time.Second)
	defer cancel()
	err = h.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var stats []financeBucket
		summaryOnly := c.Query("summary") == "1"
		kind := financeChannelSQL
		if summaryOnly {
			kind = "''::text"
		}
		// Sum the fixed-point amounts in PostgreSQL, keeping decimal precision through JSON encoding.
		revenue := "coalesce(sum(sum(o.final_amount)) FILTER (WHERE o.payment_status IN ('paid','active')) OVER (), 0)::text"
		if err := financeOrderBase(tx, q.Keyword).Select(financeStatusSQL + " AS state, " + kind + " AS kind, o.payment_status AS raw, count(*) AS n, " + revenue + " AS revenue").Group("1,2,3").Scan(&stats).Error; err != nil {
			return err
		}
		result = q.aggregate(stats, "channel")
		rows := []financeOrderRow{}
		result.Data = rows
		if summaryOnly || result.Total == 0 {
			return nil
		}
		query := financeOrderBase(tx, q.Keyword)
		if q.Status != "" {
			query = query.Where("("+financeStatusSQL+" = ? OR o.payment_status = ?)", q.Status, q.Status)
		}
		if q.Kind != "" {
			query = query.Where(financeChannelSQL+" = ?", q.Kind)
		}
		invoiceContact := func(db *gorm.DB) *gorm.DB { return db.Select("id", "name", "email") }
		err := query.Select("o.*").Preload("Store", func(db *gorm.DB) *gorm.DB {
			return db.Select("id", "store_title", "slug", "whatsapp_number", "plan")
		}).Preload("User", invoiceContact).Preload("ApprovedByUser", invoiceContact).
			Order("o.created_at DESC, o.id DESC").Limit(q.Limit).Offset((result.Page - 1) * q.Limit).Find(&rows).Error
		result.Data = rows
		return err
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return fiber.NewError(500, "Gagal memuat transaksi")
	}
	return c.JSON(result)
}

// Coupons currently live in one settings value. Expand inside PostgreSQL so only the requested
// page crosses the DB connection. Ordinality preserves the ordering used by the existing editor.
func financeCouponBase(db *gorm.DB, q string) *gorm.DB {
	query := db.Table(`settings CROSS JOIN LATERAL jsonb_array_elements(COALESCE(NULLIF(NULLIF(trim(value),'null'),''),'[]')::jsonb) WITH ORDINALITY AS coupons(item,pos)`).
		Where("key = ?", "master_coupons")
	if q != "" {
		query = query.Where("concat_ws(' ',item->>'code',item->>'label') ILIKE ?", financeSearchPattern(q))
	}
	return query
}

const couponStateSQL = `CASE WHEN item->>'is_active' = 'true' THEN 'active' ELSE 'inactive' END`

func (h *SubscriptionHandler) financeCouponsPage(c *fiber.Ctx) error {
	q, err := parseFinanceQuery(c, "type")
	if err != nil {
		return err
	}
	var result financePage
	ctx, cancel := context.WithTimeout(c.UserContext(), 10*time.Second)
	defer cancel()
	err = h.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var stats []financeBucket
		if err := financeCouponBase(tx, q.Keyword).Select(couponStateSQL + " AS state, item->>'type' AS kind, count(*) AS n").Group("1,2").Scan(&stats).Error; err != nil {
			return err
		}
		result = q.aggregate(stats, "type")
		items := []json.RawMessage{}
		result.Data = items
		if result.Total == 0 {
			return nil
		}
		query := financeCouponBase(tx, q.Keyword)
		if q.Status != "" {
			query = query.Where(couponStateSQL+" = ?", q.Status)
		}
		if q.Kind != "" {
			query = query.Where("item->>'type' = ?", q.Kind)
		}
		var values []string
		if err := query.Select("item::text AS value").Order("pos").Limit(q.Limit).Offset((result.Page - 1) * q.Limit).Scan(&values).Error; err != nil {
			return err
		}
		for _, raw := range values {
			items = append(items, json.RawMessage(raw))
		}
		result.Data = items
		return nil
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return fiber.NewError(500, "Gagal memuat kupon")
	}
	return c.JSON(result)
}
