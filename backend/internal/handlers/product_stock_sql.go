package handlers

import (
	"fmt"

	"gorm.io/gorm"
)

const (
	outOfStockStatusSQL = "(LOWER(COALESCE(products.conservation_status, '')) IN ('sold_out', 'out_of_stock', 'habis') OR LOWER(COALESCE(products.conservation_status, '')) LIKE '%sold out%' OR LOWER(COALESCE(products.conservation_status, '')) LIKE '%habis%')"
	lowStockStatusSQL   = "(LOWER(COALESCE(products.conservation_status, '')) IN ('limited', 'low_stock', 'terbatas') OR LOWER(COALESCE(products.conservation_status, '')) LIKE '%terbatas%')"
)

// effectiveProductStockSQLExpr returns a dialect-safe SQL expression computing effective numeric stock
// from active product_variants or numeric JSONB attributes/detailed_info fields, returning NULL when unquantified.
func effectiveProductStockSQLExpr(db *gorm.DB) string {
	if db != nil && db.Dialector.Name() == "postgres" {
		return `(CASE
			WHEN EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = products.id AND pv.is_active = true)
				THEN (SELECT COALESCE(SUM(pv.stock_qty), 0) FROM product_variants pv WHERE pv.product_id = products.id AND pv.is_active = true)
			WHEN NULLIF(TRIM(COALESCE(products.attributes->>'stock', '')), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
				THEN FLOOR(CAST(TRIM(products.attributes->>'stock') AS NUMERIC))::BIGINT
			WHEN NULLIF(TRIM(COALESCE(products.attributes->>'stock_qty', '')), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
				THEN FLOOR(CAST(TRIM(products.attributes->>'stock_qty') AS NUMERIC))::BIGINT
			WHEN NULLIF(TRIM(COALESCE(products.detailed_info->>'stock', '')), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
				THEN FLOOR(CAST(TRIM(products.detailed_info->>'stock') AS NUMERIC))::BIGINT
			ELSE NULL
		END)`
	}

	return `(CASE
		WHEN EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = products.id AND pv.is_active = 1)
			THEN (SELECT COALESCE(SUM(pv.stock_qty), 0) FROM product_variants pv WHERE pv.product_id = products.id AND pv.is_active = 1)
		WHEN json_valid(products.attributes) AND typeof(json_extract(products.attributes, '$.stock')) IN ('integer', 'real')
			THEN CAST(json_extract(products.attributes, '$.stock') AS INTEGER)
		WHEN json_valid(products.attributes) AND typeof(json_extract(products.attributes, '$.stock_qty')) IN ('integer', 'real')
			THEN CAST(json_extract(products.attributes, '$.stock_qty') AS INTEGER)
		WHEN json_valid(products.detailed_info) AND typeof(json_extract(products.detailed_info, '$.stock')) IN ('integer', 'real')
			THEN CAST(json_extract(products.detailed_info, '$.stock') AS INTEGER)
		ELSE NULL
	END)`
}

func productOutOfStockCondition(db *gorm.DB) string {
	expr := effectiveProductStockSQLExpr(db)
	return fmt.Sprintf("((%s) <= 0 OR ((%s) IS NULL AND %s))", expr, expr, outOfStockStatusSQL)
}

func productLowStockCondition(db *gorm.DB) string {
	expr := effectiveProductStockSQLExpr(db)
	return fmt.Sprintf("(((%s) > 0 AND (%s) <= 5) OR ((%s) IS NULL AND %s))", expr, expr, expr, lowStockStatusSQL)
}

func productInStockCondition(db *gorm.DB) string {
	expr := effectiveProductStockSQLExpr(db)
	return fmt.Sprintf("((%s) > 0 OR ((%s) IS NULL AND NOT %s))", expr, expr, outOfStockStatusSQL)
}
