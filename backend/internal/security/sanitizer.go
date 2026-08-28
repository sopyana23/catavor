package security

import (
	"errors"
	"math"
	"net/url"
	"regexp"
	"strings"
)

var (
	htmlTagRegex       = regexp.MustCompile(`(?i)<[^>]*>`)
	scriptTagRegex     = regexp.MustCompile(`(?is)<script.*?>.*?</script>`)
	styleTagRegex      = regexp.MustCompile(`(?is)<style.*?>.*?</style>`)
	iframeTagRegex     = regexp.MustCompile(`(?is)<iframe.*?>.*?</iframe>`)
	objectTagRegex     = regexp.MustCompile(`(?is)<(object|embed|applet).*?>.*?</(object|embed|applet)>`)
	formTagRegex       = regexp.MustCompile(`(?is)<(form|input|button|textarea|select).*?>.*?</(form|button|textarea|select)>`)
	onEventHandler     = regexp.MustCompile(`(?i)\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)`)
	jsProtocolRegex    = regexp.MustCompile(`(?i)(javascript|vbscript|data\s*:\s*text\/html)\s*:`)
	phoneAllowedRegex  = regexp.MustCompile(`[^0-9+\-\s()]`)
	slugAllowedRegex   = regexp.MustCompile(`[^a-z0-9\-]`)
	emailRegex         = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
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
func SanitizeRichText(input string, maxLen int) string {
	if input == "" {
		return ""
	}

	// 1. Remove null bytes
	cleaned := strings.ReplaceAll(input, "\x00", "")

	// 2. Strip dangerous tags
	cleaned = scriptTagRegex.ReplaceAllString(cleaned, "")
	cleaned = styleTagRegex.ReplaceAllString(cleaned, "")
	cleaned = iframeTagRegex.ReplaceAllString(cleaned, "")
	cleaned = objectTagRegex.ReplaceAllString(cleaned, "")
	cleaned = formTagRegex.ReplaceAllString(cleaned, "")

	// 3. Strip inline event handlers (e.g. onload, onerror, onclick)
	cleaned = onEventHandler.ReplaceAllString(cleaned, "")

	// 4. Neutralize javascript/data pseudo-protocols
	cleaned = jsProtocolRegex.ReplaceAllString(cleaned, "blocked:")

	// 5. Trim
	cleaned = strings.TrimSpace(cleaned)

	// 6. Enforce max length constraint
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

// ValidatePassword validates password length boundaries
func ValidatePassword(password string) error {
	trimmed := strings.TrimSpace(password)
	if len(trimmed) < 8 {
		return errors.New("Password minimal 8 karakter.")
	}
	if len([]byte(password)) > 72 {
		return errors.New("Password maksimal 72 karakter.")
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
	// Sanitize raw text to prevent stored XSS inside JSON structures
	cleaned := strings.ReplaceAll(jsonStr, "\x00", "")
	cleaned = scriptTagRegex.ReplaceAllString(cleaned, "")
	cleaned = onEventHandler.ReplaceAllString(cleaned, "")
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
