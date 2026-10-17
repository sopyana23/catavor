package security

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/url"
	"regexp"
	"strings"
	"unicode"

	"github.com/microcosm-cc/bluemonday"
)

var (
	htmlTagRegex      = regexp.MustCompile(`(?i)<[^>]*>`)
	phoneAllowedRegex = regexp.MustCompile(`[^0-9+\-\s()]`)
	slugAllowedRegex  = regexp.MustCompile(`[^a-z0-9\-]`)
	emailRegex        = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
)

// SanitizePlainText removes all HTML tags, control bytes, and limits length
func SanitizePlainText(input string, maxLen int) string {
	if input == "" {
		return ""
	}

	// 1. Remove null bytes and non-printable control characters
	cleaned := strings.Map(func(r rune) rune {
		if r == 0 || (r < 32 && r != '\t' && r != '\n' && r != '\r') {
			return -1
		}
		return r
	}, input)

	// 2. Strip all HTML tags
	cleaned = htmlTagRegex.ReplaceAllString(cleaned, "")

	// 3. Trim extra whitespace
	cleaned = strings.TrimSpace(cleaned)

	// 4. Enforce max length constraint
	if maxLen > 0 {
		runes := []rune(cleaned)
		if len(runes) > maxLen {
			cleaned = string(runes[:maxLen])
		}
	}

	return cleaned
}

// SanitizeRichText removes dangerous executable tags (script, iframe, on*) while preserving safe markdown and text structure
// richTextPolicy adalah ALLOWLIST sanitizer (bluemonday): hanya tag/atribut yang
// didaftarkan di sini yang dipertahankan; sisanya dibuang. Ini menggantikan
// pendekatan blacklist-regex yang bisa dibypass (mis. "<scr<script>ipt>").
//
// SECURITY (L2): allowlist tidak bisa dibypass dengan trik nested-tag karena
// parsing dilakukan oleh parser HTML sungguhan, bukan regex.
var richTextPolicy = func() *bluemonday.Policy {
	p := bluemonday.NewPolicy()

	// Tag teks dasar yang aman untuk deskripsi produk/artikel.
	p.AllowElements(
		"p", "br", "hr", "span", "div",
		"strong", "b", "em", "i", "u", "s", "strike", "del", "ins", "mark", "small", "sub", "sup",
		"h1", "h2", "h3", "h4", "h5", "h6",
		"ul", "ol", "li", "dl", "dt", "dd",
		"blockquote", "pre", "code",
		"table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
	)

	// Atribut aman (tanpa event handler).
	p.AllowAttrs("class", "title", "dir", "lang").Globally()
	p.AllowAttrs("align", "colspan", "rowspan", "scope").OnElements("table", "thead", "tbody", "tfoot", "tr", "th", "td")

	// Tautan: hanya protokol aman, dan rel/target dipaksa aman.
	p.AllowAttrs("href").OnElements("a")
	p.AllowAttrs("title").OnElements("a")
	p.RequireNoFollowOnLinks(true)
	p.AddTargetBlankToFullyQualifiedLinks(true)

	// Gambar inline (opsional): hanya src http/https, tanpa data: URI.
	p.AllowAttrs("src", "alt", "title", "width", "height").OnElements("img")
	p.AllowURLSchemes("http", "https", "mailto", "tel")

	return p
}()

// SanitizeRichText membersihkan HTML rich-text memakai allowlist (bluemonday).
// Tag/atribut di luar daftar dihapus; event handler & protokol berbahaya
// (javascript:, data:) tidak mungkin lolos karena parser HTML asli yang menilai.
func SanitizeRichText(input string, maxLen int) string {
	if input == "" {
		return ""
	}

	// 1. Buang null byte sebelum parsing.
	cleaned := strings.ReplaceAll(input, "\x00", "")

	// 2. Allowlist sanitize (parser HTML, bukan regex).
	cleaned = richTextPolicy.Sanitize(cleaned)

	// 3. Trim.
	cleaned = strings.TrimSpace(cleaned)

	// 4. Batasi panjang.
	if maxLen > 0 {
		runes := []rune(cleaned)
		if len(runes) > maxLen {
			cleaned = string(runes[:maxLen])
		}
	}

	return cleaned
}

// SanitizeURL validates and permits only standard safe protocols (http, https, mailto, tel)
func SanitizeURL(rawURL string) string {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return ""
	}

	// Reject javascript / vbscript / data URLs
	lower := strings.ToLower(trimmed)
	if strings.HasPrefix(lower, "javascript:") ||
		strings.HasPrefix(lower, "vbscript:") ||
		strings.HasPrefix(lower, "data:") ||
		strings.HasPrefix(lower, "file:") {
		return ""
	}

	// Allow safe relative paths (e.g. /storage/stores/...)
	if strings.HasPrefix(trimmed, "/") {
		if strings.HasPrefix(trimmed, "//") {
			return ""
		}
		return trimmed
	}

	// Auto prefix http/https if it looks like a domain without scheme (e.g. instagram.com/myuser)
	if !strings.Contains(trimmed, "://") && !strings.HasPrefix(lower, "mailto:") && !strings.HasPrefix(lower, "tel:") {
		trimmed = "https://" + trimmed
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return ""
	}

	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" && scheme != "mailto" && scheme != "tel" {
		return ""
	}

	return trimmed
}

// SanitizeVideoURL verifies that video embeds belong to trusted domains like YouTube
func SanitizeVideoURL(rawURL string) string {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return ""
	}

	cleaned := SanitizeURL(trimmed)
	if cleaned == "" {
		return ""
	}

	parsed, err := url.Parse(cleaned)
	if err != nil {
		return ""
	}

	host := strings.ToLower(parsed.Host)
	// Whitelist YouTube domains
	if strings.Contains(host, "youtube.com") || strings.Contains(host, "youtu.be") {
		return cleaned
	}

	return ""
}

// SanitizePhone keeps only phone digits and format symbols (+, -, space, parentheses)
func SanitizePhone(phone string) string {
	cleaned := phoneAllowedRegex.ReplaceAllString(phone, "")
	cleaned = strings.TrimSpace(cleaned)
	if len(cleaned) > 30 {
		cleaned = cleaned[:30]
	}
	return cleaned
}

type WAContactSanitized struct {
	ID               string `json:"id"`
	Label            string `json:"label"`
	Number           string `json:"number"`
	IsDefault        bool   `json:"is_default"`
	UseForStorefront bool   `json:"use_for_storefront"`
}

// SanitizeWhatsAppContacts securely sanitizes single phone number or JSON array of multiple contacts
func SanitizeWhatsAppContacts(input string) string {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return ""
	}

	if strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]") {
		var rawList []map[string]interface{}
		if err := json.Unmarshal([]byte(trimmed), &rawList); err == nil && len(rawList) > 0 {
			var sanitized []WAContactSanitized
			hasDefault := false
			hasStorefront := false

			for idx, item := range rawList {
				id, _ := item["id"].(string)
				id = strings.TrimSpace(id)
				if id == "" {
					id = fmt.Sprintf("wa_%d", idx+1)
				} else {
					id = SanitizeSlug(id)
				}

				label, _ := item["label"].(string)
				if label == "" {
					label, _ = item["name"].(string)
				}
				label = SanitizePlainText(label, 100)
				if label == "" {
					if idx == 0 {
						label = "WhatsApp Utama"
					} else {
						label = fmt.Sprintf("WhatsApp CS %d", idx+1)
					}
				}

				numStr := ""
				if num, ok := item["number"].(string); ok {
					numStr = num
				} else if phone, ok := item["phone"].(string); ok {
					numStr = phone
				}
				cleanedNum := SanitizePhone(numStr)
				if cleanedNum == "" {
					continue
				}

				isDef, _ := item["is_default"].(bool)
				if isDef {
					hasDefault = true
				}
				useFront, _ := item["use_for_storefront"].(bool)
				if useFront {
					hasStorefront = true
				}

				sanitized = append(sanitized, WAContactSanitized{
					ID:               id,
					Label:            label,
					Number:           cleanedNum,
					IsDefault:        isDef,
					UseForStorefront: useFront,
				})
			}

			if len(sanitized) > 0 {
				if !hasDefault {
					sanitized[0].IsDefault = true
				}
				if !hasStorefront {
					found := false
					for i := range sanitized {
						if sanitized[i].IsDefault {
							sanitized[i].UseForStorefront = true
							found = true
							break
						}
					}
					if !found {
						sanitized[0].UseForStorefront = true
					}
				}
				marshaled, err := json.Marshal(sanitized)
				if err == nil {
					return string(marshaled)
				}
			}
		}
	}

	return SanitizePhone(trimmed)
}

// SanitizeSlug ensures the slug contains only lowercase alphanumeric characters and hyphens
func SanitizeSlug(slug string) string {
	lowered := strings.ToLower(strings.TrimSpace(slug))
	cleaned := slugAllowedRegex.ReplaceAllString(lowered, "-")
	// Collapse multiple hyphens
	multiHyphen := regexp.MustCompile(`-+`)
	cleaned = multiHyphen.ReplaceAllString(cleaned, "-")
	cleaned = strings.Trim(cleaned, "-")
	if len(cleaned) > 200 {
		cleaned = cleaned[:200]
	}
	return cleaned
}

// ValidateEmail validates an email address against standard RFC structure
func ValidateEmail(email string) bool {
	trimmed := strings.TrimSpace(email)
	if len(trimmed) == 0 || len(trimmed) > 254 {
		return false
	}
	return emailRegex.MatchString(trimmed)
}

// ValidatePassword validates password length boundaries and industry-standard complexity requirements
func ValidatePassword(password string) error {
	trimmed := strings.TrimSpace(password)
	if len(trimmed) < 8 {
		return errors.New("Kata sandi minimal 8 karakter.")
	}
	if len([]byte(password)) > 72 {
		return errors.New("Kata sandi maksimal 72 karakter.")
	}

	var hasUpper, hasLower, hasNumber, hasSpecial bool
	for _, r := range trimmed {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsNumber(r):
			hasNumber = true
		case unicode.IsPunct(r) || unicode.IsSymbol(r) || (!unicode.IsLetter(r) && !unicode.IsNumber(r)):
			hasSpecial = true
		}
	}

	if !hasUpper {
		return errors.New("Kata sandi harus mengandung minimal 1 huruf besar (A-Z).")
	}
	if !hasLower {
		return errors.New("Kata sandi harus mengandung minimal 1 huruf kecil (a-z).")
	}
	if !hasNumber {
		return errors.New("Kata sandi harus mengandung minimal 1 angka (0-9).")
	}
	if !hasSpecial {
		return errors.New("Kata sandi harus mengandung minimal 1 karakter khusus atau simbol (@, #, $, %, !, dll).")
	}

	return nil
}

// ValidatePrice ensures price is non-negative and valid decimal
func ValidatePrice(price float64) float64 {
	if math.IsNaN(price) || math.IsInf(price, 0) || price < 0 {
		return 0
	}
	// Round to 2 decimal places
	return math.Round(price*100) / 100
}

// SanitizeSocialLinksJSON cleans an array of social links JSON string
func SanitizeSocialLinks(jsonStr string) string {
	if strings.TrimSpace(jsonStr) == "" {
		return "[]"
	}
	// SECURITY (L2): strip tag/atribut dengan allowlist parser, bukan regex
	// blacklist. Nilai ini masuk ke JSON lalu dirender, jadi wajib bersih.
	cleaned := strings.ReplaceAll(jsonStr, "\x00", "")
	cleaned = richTextPolicy.Sanitize(cleaned)
	return cleaned
}

// ClampText restricts text length safely by runes
func ClampText(text string, maxLen int) string {
	if maxLen <= 0 {
		return text
	}
	runes := []rune(text)
	if len(runes) > maxLen {
		return string(runes[:maxLen])
	}
	return text
}

// ValidateOrderLimits validates and clamps min and max purchase quantities
func ValidateOrderLimits(minVal interface{}, maxVal interface{}) (int, *int) {
	minOrder := 1
	if minVal != nil {
		switch v := minVal.(type) {
		case float64:
			if v >= 1 {
				minOrder = int(v)
			}
		case int:
			if v >= 1 {
				minOrder = v
			}
		}
	}

	var maxOrder *int
	if maxVal != nil {
		switch v := maxVal.(type) {
		case float64:
			if v > 0 {
				valInt := int(v)
				if valInt < minOrder {
					valInt = minOrder
				}
				maxOrder = &valInt
			}
		case int:
			if v > 0 {
				valInt := v
				if valInt < minOrder {
					valInt = minOrder
				}
				maxOrder = &valInt
			}
		}
	}

	return minOrder, maxOrder
}

// IsBotHoneypotTriggered detects automated spam bots by checking if a hidden honeypot trap field was filled.
// Legitimate human users will not see or fill this hidden field.
func IsBotHoneypotTriggered(val string) bool {
	return strings.TrimSpace(val) != ""
}

