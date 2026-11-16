package handlers

import (
	"bytes"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// Self-check: pastikan field message+stack+tags benar-benar tercetak.
// ponytail: satu test ini cukup; menambah kasus saat ada field baru.
func TestClientLogFieldsEmitted(t *testing.T) {
	var buf bytes.Buffer
	prev := log.Logger
	log.Logger = zerolog.New(&buf)
	defer func() { log.Logger = prev }()

	ev := log.Warn().
		Str("section", strings.Repeat("S", 301)).
		Str("err_message", strings.Repeat("M", 2000)).
		Str("ip", "1.2.3.4")
	ev = ev.Strs("tags", []string{"a", "b"})
	ev = ev.Str("stack", "TypeError: boom")
	ev.Msg("Client runtime error")

	out := buf.String()
	for _, want := range []string{`"err_message"`, `"stack"`, `"tags"`, `"section"`} {
		if !strings.Contains(out, want) {
			t.Fatalf("field %q hilang dari output: %s", want, out)
		}
	}
	// key "message" hanya boleh muncul sekali (milik Msg()).
	if n := strings.Count(out, `"message"`); n != 1 {
		t.Fatalf("key message duplikat (%d kemunculan): %s", n, out)
	}
}

const validDummyJWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"

func TestClientLogRedaction(t *testing.T) {
	// Verifikasi langsung: regex JWT wajib cocok pada token 3-segmen RFC 7519 standar
	if !jwtRegex.MatchString(validDummyJWT) {
		t.Fatalf("jwtRegex gagal mencocokkan dummy JWT 3-segmen RFC 7519: %s", validDummyJWT)
	}

	tests := []struct {
		name        string
		input       string
		expected    string
		forbidden   string // nilai sensitif yang dilarang muncul di output
		mustContain string // penanda redaksi yang wajib ada di output
	}{
		{
			name:        "query token and access_token",
			input:       "https://catavor.com/callback?token=secret123&access_token=tok456&state=ok",
			expected:    "https://catavor.com/callback?token=[REDACTED]&access_token=[REDACTED]&state=ok",
			forbidden:   "secret123",
			mustContain: "[REDACTED]",
		},
		{
			name:        "query extended variants (id_token, auth_token, apikey, client_secret, pwd)",
			input:       "https://catavor.com/auth?id_token=idt_123&auth_token=aut_456&apikey=apk_789&client_secret=cls_999&pwd=secret_pwd",
			expected:    "https://catavor.com/auth?id_token=[REDACTED]&auth_token=[REDACTED]&apikey=[REDACTED]&client_secret=[REDACTED]&pwd=[REDACTED]",
			forbidden:   "secret_pwd",
			mustContain: "[REDACTED]",
		},
		{
			name:        "query refresh_token and api_key and password and secret",
			input:       "https://catavor.com/auth?refresh_token=ref789&api_key=key_xyz&password=p@ssword1&secret=shh",
			expected:    "https://catavor.com/auth?refresh_token=[REDACTED]&api_key=[REDACTED]&password=[REDACTED]&secret=[REDACTED]",
			forbidden:   "p@ssword1",
			mustContain: "[REDACTED]",
		},
		{
			name:        "bare JWT token in message (tanpa awalan Bearer)",
			input:       "Exception: failed to parse JWT " + validDummyJWT + " at line 42",
			expected:    "Exception: failed to parse JWT [REDACTED_JWT] at line 42",
			forbidden:   validDummyJWT,
			mustContain: "[REDACTED_JWT]",
		},
		{
			name:        "bare JWT in URL fragment/hash without key name (tanpa awalan Bearer)",
			input:       "https://catavor.com/oauth/callback#" + validDummyJWT,
			expected:    "https://catavor.com/oauth/callback#[REDACTED_JWT]",
			forbidden:   validDummyJWT,
			mustContain: "[REDACTED_JWT]",
		},
		{
			name:        "sensitive id_token query parameter containing valid JWT",
			input:       "https://catavor.com/oauth/callback?id_token=" + validDummyJWT + "&state=xyz",
			expected:    "https://catavor.com/oauth/callback?id_token=[REDACTED]&state=xyz",
			forbidden:   validDummyJWT,
			mustContain: "[REDACTED]",
		},
		{
			name:        "standalone bare JWT without surrounding text (tanpa awalan Bearer)",
			input:       validDummyJWT,
			expected:    "[REDACTED_JWT]",
			forbidden:   validDummyJWT,
			mustContain: "[REDACTED_JWT]",
		},
		{
			name:        "Bearer with valid JWT and email",
			input:       "User admin@catavor.test sent Authorization: Bearer " + validDummyJWT,
			expected:    "User [MASKED_EMAIL] sent Authorization: Bearer [REDACTED]",
			forbidden:   validDummyJWT,
			mustContain: "Bearer [REDACTED]",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := redactSensitive(tc.input)
			if got != tc.expected {
				t.Errorf("redactSensitive() = %q, want %q", got, tc.expected)
			}
			if tc.forbidden != "" && strings.Contains(got, tc.forbidden) {
				t.Errorf("redactSensitive() membocorkan nilai sensitif %q dalam output: %q", tc.forbidden, got)
			}
			if tc.mustContain != "" && !strings.Contains(got, tc.mustContain) {
				t.Errorf("redactSensitive() tidak memuat penanda redaksi %q dalam output: %q", tc.mustContain, got)
			}
		})
	}
}

func TestClipClientLog_RuneBoundary(t *testing.T) {
	// "1234567🐾extra" has 7 ASCII bytes + 4-byte emoji 🐾 + 5 ASCII bytes.
	// If clipped at 8 bytes, byte slicing takes 7 ASCII + 1 byte of 🐾, producing invalid UTF-8.
	// With []rune clipping at max=8 runes, it takes 7 ASCII + 1 rune of 🐾, producing valid UTF-8.
	input := "1234567🐾extra"
	clipped := clipClientLog(input, 8)
	if !utf8.ValidString(clipped) {
		t.Fatalf("clipClientLog produced invalid UTF-8: %q", clipped)
	}
	expected := "1234567🐾…[dipotong]"
	if clipped != expected {
		t.Errorf("clipClientLog() = %q, want %q", clipped, expected)
	}
}
