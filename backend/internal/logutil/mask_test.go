package logutil

import (
	"testing"
	"unicode/utf8"
)

func TestMaskEmail(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"dzikri@catavor.id", "dz***i@catavor.id"},
		{"john@example.com", "jo***n@example.com"},
		{"dan@domain.com", "d*n@domain.com"},
		{"id@domain.com", "i*@domain.com"},
		{"a@domain.com", "*@domain.com"},
		{"ユーザー@catavor.id", "ユー***ー@catavor.id"},
		{"ø@domain.com", "*@domain.com"},
		{"  spasi@domain.com  ", "sp***i@domain.com"},
		{"", "***"},
		{"   ", "***"},
		{"bukan-email", "***"},
		{"@domain.com", "***"},
		{"user@", "***"},
		{"user@@domain.com", "us***r@@domain.com"},
	}

	for _, tc := range tests {
		actual := MaskEmail(tc.input)
		if actual != tc.expected {
			t.Errorf("MaskEmail(%q) = %q; want %q", tc.input, actual, tc.expected)
		}
	}
}

func TestMaskName(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Budi Santoso", "B***o"},
		{"Alexander", "A***r"},
		{"Jo", "J*"},
		{"A", "*"},
		{"", "***"},
		{"  ", "***"},
		{"太郎", "太*"},
		{"山田太郎", "山***郎"},
	}

	for _, tc := range tests {
		actual := MaskName(tc.input)
		if actual != tc.expected {
			t.Errorf("MaskName(%q) = %q; want %q", tc.input, actual, tc.expected)
		}
	}
}

func TestSanitizeLogSnippet(t *testing.T) {
	short := "pesan biasa"
	if actual := SanitizeLogSnippet(short, 50); actual != short {
		t.Errorf("SanitizeLogSnippet short failed: got %q, want %q", actual, short)
	}

	multiline := "baris 1\nbaris 2\nbaris 3"
	expectedMulti := "baris 1 baris 2 baris 3"
	if actual := SanitizeLogSnippet(multiline, 50); actual != expectedMulti {
		t.Errorf("SanitizeLogSnippet multiline failed: got %q, want %q", actual, expectedMulti)
	}

	long := "12345678901234567890"
	expectedLong := "1234567890..."
	if actual := SanitizeLogSnippet(long, 10); actual != expectedLong {
		t.Errorf("SanitizeLogSnippet truncate failed: got %q, want %q", actual, expectedLong)
	}
}

func TestSanitizeLogSnippet_RuneBoundary(t *testing.T) {
	// "1234567🐾extra" has 7 ASCII bytes + 4-byte emoji 🐾 + 5 ASCII bytes.
	// Byte-based slicing at maxLen=8 results in "1234567\xf0...", which is invalid UTF-8.
	// Rune-based slicing at maxLen=8 results in "1234567🐾...", which is valid UTF-8.
	input := "1234567🐾extra"
	actual := SanitizeLogSnippet(input, 8)
	if !utf8.ValidString(actual) {
		t.Fatalf("SanitizeLogSnippet produced invalid UTF-8: %q", actual)
	}
	expected := "1234567🐾..."
	if actual != expected {
		t.Errorf("SanitizeLogSnippet() = %q, want %q", actual, expected)
	}
}
