package logutil

import (
	"strings"
)

// MaskEmail menyamarkan alamat email untuk kebutuhan logging aplikasi (N-53 / UU PDP).
// Format penyamaran aman berbasis UTF-8 rune:
//   - "dzikri@catavor.id"   -> "dz***i@catavor.id"
//   - "john@example.com"    -> "jo***n@example.com"
//   - "dan@domain.com"     -> "d*n@domain.com"
//   - "id@domain.com"      -> "i*@domain.com"
//   - "a@domain.com"       -> "*@domain.com"
//   - "" / format invalid  -> "***"
func MaskEmail(email string) string {
	trimmed := strings.TrimSpace(email)
	if trimmed == "" {
		return "***"
	}

	parts := strings.SplitN(trimmed, "@", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "***"
	}

	user := parts[0]
	domain := parts[1]
	runes := []rune(user)
	runeLen := len(runes)

	var maskedUser string
	switch {
	case runeLen == 0:
		maskedUser = "***"
	case runeLen == 1:
		maskedUser = "*"
	case runeLen == 2:
		maskedUser = string(runes[0]) + "*"
	case runeLen == 3:
		maskedUser = string(runes[0]) + "*" + string(runes[2])
	default:
		maskedUser = string(runes[0:2]) + "***" + string(runes[runeLen-1:])
	}

	return maskedUser + "@" + domain
}

// MaskName menyamarkan nama pengguna untuk logging aplikasi (misal "Budi Santoso" -> "B***o").
func MaskName(name string) string {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return "***"
	}
	runes := []rune(trimmed)
	runeLen := len(runes)
	if runeLen <= 1 {
		return "*"
	}
	if runeLen == 2 {
		return string(runes[0]) + "*"
	}
	return string(runes[0]) + "***" + string(runes[runeLen-1])
}

// SanitizeLogSnippet membatasi panjang teks (berbasis UTF-8 rune) dan mereduksi baris liar pada log mentah.
func SanitizeLogSnippet(input string, maxLen int) string {
	trimmed := strings.TrimSpace(input)
	if maxLen > 0 {
		runes := []rune(trimmed)
		if len(runes) > maxLen {
			trimmed = string(runes[:maxLen]) + "..."
		}
	}
	return strings.ReplaceAll(trimmed, "\n", " ")
}
