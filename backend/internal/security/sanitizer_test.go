package security

import "testing"

// TestSanitizeRichText_Allowlist memastikan sanitizer memakai allowlist dan
// TIDAK bisa dibypass dengan trik yang dulu lolos pada implementasi regex.
func TestSanitizeRichText_Allowlist(t *testing.T) {
	cases := []struct {
		name    string
		in      string
		mustNot []string // substring yang TIDAK boleh tersisa
		mustHas []string // substring yang HARUS tetap ada
	}{
		{
			name:    "script tag dihapus",
			in:      `<p>halo</p><script>alert(1)</script>`,
			mustNot: []string{"<script", "alert(1)"},
			mustHas: []string{"<p>halo</p>"},
		},
		{
			name: "nested tag bypass (regex lama lolos)",
			in:   `<scr<script>ipt>alert(1)</scr</script>ipt>`,
			// Yang wajib hilang adalah TAG-nya. Teks sisa boleh ada asal ter-escape
			// (alert(1) sebagai teks biasa tidak bisa dieksekusi).
			mustNot: []string{"<script", "<script>"},
		},
		{
			name:    "event handler dihapus",
			in:      `<img src="x" onerror="alert(1)">`,
			mustNot: []string{"onerror", "alert(1)"},
		},
		{
			name:    "javascript: protocol ditolak",
			in:      `<a href="javascript:alert(1)">klik</a>`,
			mustNot: []string{"javascript:"},
		},
		{
			name:    "iframe dihapus",
			in:      `<iframe src="//evil.com"></iframe>`,
			mustNot: []string{"<iframe", "evil.com"},
		},
		{
			name:    "format aman dipertahankan",
			in:      `<p><strong>tebal</strong> dan <em>miring</em></p><ul><li>satu</li></ul>`,
			mustHas: []string{"<strong>", "<em>", "<ul>", "<li>"},
		},
		{
			name:    "tautan https aman dipertahankan",
			in:      `<a href="https://example.com">ok</a>`,
			mustHas: []string{`href="https://example.com"`},
		},
		{
			name:    "style tag dihapus",
			in:      `<style>body{display:none}</style><p>teks</p>`,
			mustNot: []string{"<style", "display:none"},
		},
		{
			name:    "form & input dihapus",
			in:      `<form action="/x"><input name="p"></form>`,
			mustNot: []string{"<form", "<input"},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := SanitizeRichText(c.in, 10000)
			for _, bad := range c.mustNot {
				if contains(got, bad) {
					t.Errorf("HARUSNYA hilang %q, tapi masih ada di output: %q", bad, got)
				}
			}
			for _, good := range c.mustHas {
				if !contains(got, good) {
					t.Errorf("HARUSNYA tetap ada %q, tapi hilang. output: %q", good, got)
				}
			}
		})
	}
}

// TestSanitizeRichText_MaxLen memastikan batas panjang tetap bekerja.
func TestSanitizeRichText_MaxLen(t *testing.T) {
	if got := SanitizeRichText("<p>abcdefghij</p>", 5); len([]rune(got)) > 5 {
		t.Errorf("panjang melebihi maxLen: %q", got)
	}
}

func contains(s, sub string) bool {
	return len(sub) > 0 && len(s) >= len(sub) && indexOf(s, sub) >= 0
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
