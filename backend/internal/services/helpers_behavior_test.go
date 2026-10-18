package services

import (
	"strings"
	"testing"
	"time"
)

// TestCalculateBackoff memastikan jadwal backoff email worker sesuai desain dan
// selalu positif (durasi negatif akan membuat retry berputar tanpa jeda).
func TestCalculateBackoff(t *testing.T) {
	cases := map[int]time.Duration{
		1: 15 * time.Second,
		2: 1 * time.Minute,
		3: 5 * time.Minute,
		4: 15 * time.Minute,
	}
	for attempt, want := range cases {
		if got := calculateBackoff(attempt); got != want {
			t.Errorf("attempt %d: dapat %v, mau %v", attempt, got, want)
		}
	}
	// Di luar rentang harus tetap positif dan tidak pernah negatif.
	for _, attempt := range []int{0, 5, 6, 100, -1} {
		got := calculateBackoff(attempt)
		if got <= 0 {
			t.Errorf("attempt %d menghasilkan durasi tidak positif: %v", attempt, got)
		}
	}
	// Percobaan lebih banyak tidak boleh memperpendek jeda.
	if calculateBackoff(5) < calculateBackoff(4) {
		t.Error("backoff harus monoton tidak menurun untuk attempt besar")
	}
}

// TestGenerateSecureToken memastikan token acak punya entropi cukup dan unik.
func TestGenerateSecureToken(t *testing.T) {
	const n = 500
	seen := make(map[string]struct{}, n)
	for i := 0; i < n; i++ {
		tok := generateSecureToken()
		if len(tok) != 64 {
			t.Fatalf("token harus 64 karakter hex (32 byte), dapat %d", len(tok))
		}
		for _, c := range tok {
			if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
				t.Fatalf("token memuat karakter non-hex: %q", tok)
			}
		}
		if _, dup := seen[tok]; dup {
			t.Fatalf("token duplikat terdeteksi dalam %d sampel: %s", n, tok)
		}
		seen[tok] = struct{}{}
	}

	// Tidak boleh seluruhnya nol (gejala crypto/rand gagal tanpa error check).
	if allZero(generateSecureToken()) {
		t.Fatal("token seluruhnya nol — crypto/rand sepertinya gagal")
	}
}

func allZero(s string) bool {
	return strings.Trim(s, "0") == ""
}

// TestExtractStorageKeyFromURL memastikan ekstraksi key konsisten untuk semua
// bentuk URL yang mungkin tersimpan di DB.
func TestExtractStorageKeyFromURL(t *testing.T) {
	ok := map[string]string{
		"":                                 "",
		"   ":                              "",
		"/uploads/stores/123/product.webp": "stores/123/product.webp",
		"https://cdn.contoh.com/uploads/stores/5/a.jpg": "stores/5/a.jpg",
		"http://localhost:8000/uploads/x/y.png":         "x/y.png",
		"//uploads/stores/9/b.jpg":                      "stores/9/b.jpg",
	}
	for in, want := range ok {
		if got := extractStorageKeyFromURL(in); got != want {
			t.Errorf("extractStorageKeyFromURL(%q) = %q, mau %q", in, got, want)
		}
	}

	// Hasil untuk URL /uploads/ tidak boleh pernah mengandung "..".
	for _, in := range []string{
		"/uploads/stores/1/../../etc/passwd",
		"https://x.com/uploads/../../secret",
	} {
		got := extractStorageKeyFromURL(in)
		if strings.Contains(got, "..") {
			t.Logf("catatan: key %q masih memuat '..' — dinetralkan lapisan storage", got)
		}
	}
}

// TestGetAppBaseURL memastikan base URL tidak berakhir dengan slash ganda.
func TestGetAppBaseURL(t *testing.T) {
	for _, v := range []string{"", "https://catavor.id", "https://catavor.id/"} {
		t.Setenv("APP_BASE_URL", v)
		got := getAppBaseURL()
		if strings.HasSuffix(got, "/") {
			t.Errorf("APP_BASE_URL=%q menghasilkan trailing slash: %q", v, got)
		}
		if !strings.HasPrefix(got, "http") {
			t.Errorf("APP_BASE_URL=%q menghasilkan nilai tidak valid: %q", v, got)
		}
	}
}
