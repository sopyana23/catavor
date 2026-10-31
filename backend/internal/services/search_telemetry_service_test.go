package services

import (
	"testing"
)

func TestCleanSearchKeyword(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"  Kucing Anggora!  ", "kucing anggora"},
		{"PRODUK #1 (Terbaik)??", "produk 1 terbaik"},
		{"Burung   Murai    Batu", "burung murai batu"},
	}

	for _, tt := range tests {
		got := CleanSearchKeyword(tt.input)
		if got != tt.expected {
			t.Errorf("CleanSearchKeyword(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestIsValidSearchKeyword(t *testing.T) {
	valid := []string{
		"kucing anggora",
		"sepatu running pria",
		"jasa desain interior",
		"tanaman hias monstera",
		"laptop gaming murah",
	}

	for _, kw := range valid {
		if !IsValidSearchKeyword(kw) {
			t.Errorf("IsValidSearchKeyword(%q) should be valid, got invalid", kw)
		}
	}

	invalid := []string{
		"ab",                                             // too short (< 3)
		"ini adalah contoh pencarian yang sangat panjang sekali melebihi delapan kata sehingga harus ditolak oleh sistem keamanan", // > 8 words
		"aaaaaaaaa",                                       // character spam (>= 4 repeated)
		"zzzzzzz",                                         // character spam
		"asdfghjkl",                                       // keyboard smash (no vowels in 5+ char word)
		"bcdfgh",                                          // keyboard smash
		"<script>alert(1)</script>",                       // XSS injection
		"union select * from users",                       // SQL injection
		"eval(payload)",                                   // code injection
		"slot gacor hari ini",                             // blacklisted spam
		"judi online deposit",                             // blacklisted spam
	}

	for _, kw := range invalid {
		if IsValidSearchKeyword(kw) {
			t.Errorf("IsValidSearchKeyword(%q) should be invalid, got valid", kw)
		}
	}
}

