package handlers

import (
	"strconv"
	"strings"
)

// parsePrice mengubah input (angka atau string format ID/EN) menjadi float64.
// Memperlakukan titik sebagai pemisah ribuan dan koma sebagai desimal (format ID),
// atau sebaliknya (format EN), tergantung konteks.
// Mengembalikan 0 untuk input yang tidak dapat diurai.
func parsePrice(in interface{}) float64 {
	switch v := in.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case int64:
		return float64(v)
	case int32:
		return float64(v)
	case uint:
		return float64(v)
	case uint64:
		return float64(v)
	case string:
		return parsePriceString(v)
	case nil:
		return 0
	case bool:
		return 0
	default:
		return 0
	}
}

func parsePriceString(s string) float64 {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "Rp")
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}

	hasDot := strings.Contains(s, ".")
	hasComma := strings.Contains(s, ",")

	switch {
	case hasDot && hasComma:
		// Format ID: 1.500.000,50 → dot=thousands, comma=decimal
		// Format EN: 1,500,000.50 → comma=thousands, dot=decimal
		lastDot := strings.LastIndex(s, ".")
		lastComma := strings.LastIndex(s, ",")
		if lastComma > lastDot {
			// Comma is decimal separator (format ID)
			s = strings.ReplaceAll(s, ".", "")
			s = strings.Replace(s, ",", ".", 1)
		} else {
			// Dot is decimal separator (format EN)
			s = strings.ReplaceAll(s, ",", "")
		}
	case hasDot:
		dotCount := strings.Count(s, ".")
		if dotCount > 1 {
			// Multiple dots → all thousands separators
			s = strings.ReplaceAll(s, ".", "")
		} else {
			// Single dot: ≤2 digits after = decimal, ≥3 = thousands
			parts := strings.SplitN(s, ".", 2)
			if len(parts) == 2 && len(parts[1]) <= 2 {
				// Decimal separator
			} else {
				// Thousands separator
				s = strings.ReplaceAll(s, ".", "")
			}
		}
	case hasComma:
		commaCount := strings.Count(s, ",")
		if commaCount > 1 {
			// Multiple commas → all thousands separators
			s = strings.ReplaceAll(s, ",", "")
		} else {
			// Single comma: ≤2 digits after = decimal, ≥3 = thousands
			parts := strings.SplitN(s, ",", 2)
			if len(parts) == 2 && len(parts[1]) <= 2 {
				// Decimal separator → replace with dot
				s = strings.Replace(s, ",", ".", 1)
			} else {
				// Thousands separator
				s = strings.ReplaceAll(s, ",", "")
			}
		}
	}

	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return f
}
