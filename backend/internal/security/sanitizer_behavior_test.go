package security

import (
	"encoding/json"
	"math"
	"strings"
	"testing"
)

// ============================================================================
// SanitizePlainText
// ============================================================================
//
// Setiap test bypass WAJIB punya positive control: input sah harus tetap lolos,
// supaya test tidak lulus hanya karena fungsinya mengembalikan string kosong.

func TestSanitizePlainText(t *testing.T) {
	cases := []struct {
		name   string
		input  string
		maxLen int
		want   string
	}{
		// --- positive control: teks sah harus bertahan utuh ---
		{"teks biasa", "Kucing Persia lucu", 0, "Kucing Persia lucu"},
		{"unicode non-latin", "Hewan 日本語 🐈", 0, "Hewan 日本語 🐈"},
		{"newline dipertahankan", "baris1\nbaris2", 0, "baris1\nbaris2"},
		{"tab dipertahankan", "a\tb", 0, "a\tb"},

		// --- vektor serangan ---
		{"strip tag script", "<script>alert(1)</script>Aman", 0, "alert(1)Aman"},
		{"strip tag img onerror", `<img src=x onerror=alert(1)>Halo`, 0, "Halo"},
		{"strip tag bersarang", "<scr<script>ipt>alert(1)", 0, "ipt>alert(1)"},
		{"strip null byte", "a\x00b", 0, "ab"},
		{"strip control char", "a\x01\x02b", 0, "ab"},
		{"trim spasi tepi", "   halo   ", 0, "halo"},

		// --- batas panjang ---
		{"potong ke maxLen", "abcdefghij", 5, "abcde"},
		{"maxLen 0 = tanpa batas", "abcdefghij", 0, "abcdefghij"},
		{"maxLen dihitung per rune", "日本語です", 3, "日本語"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := SanitizePlainText(c.input, c.maxLen); got != c.want {
				t.Errorf("SanitizePlainText(%q, %d) = %q, want %q", c.input, c.maxLen, got, c.want)
			}
		})
	}

	if got := SanitizePlainText("", 10); got != "" {
		t.Errorf("input kosong harus jadi string kosong, dapat %q", got)
	}
}

// ============================================================================
// SanitizeRichText — allowlist sanitizer (bluemonday)
// ============================================================================

func TestSanitizeRichText(t *testing.T) {
	t.Run("positive control: markdown aman dipertahankan", func(t *testing.T) {
		in := "<p>Halo <strong>dunia</strong></p>"
		got := SanitizeRichText(in, 0)
		if !strings.Contains(got, "<strong>") || !strings.Contains(got, "dunia") {
			t.Errorf("tag aman harus bertahan, dapat %q", got)
		}
	})

	attackCases := []struct {
		name    string
		input   string
		mustNot []string
	}{
		{"script tag", `<script>alert(1)</script>`, []string{"<script", "alert(1)"}},
		{"iframe", `<iframe src="evil.com"></iframe>`, []string{"<iframe"}},
		{"event handler onerror", `<img src=x onerror="alert(1)">`, []string{"onerror"}},
		{"event handler onclick", `<p onclick="alert(1)">klik</p>`, []string{"onclick"}},
		{"javascript: href", `<a href="javascript:alert(1)">x</a>`, []string{"javascript:"}},
		{"data: uri img", `<img src="data:text/html;base64,PHNjcmlwdD4=">`, []string{"data:text/html"}},
		{"svg onload", `<svg onload="alert(1)"></svg>`, []string{"<svg", "onload"}},
		{"style tag", `<style>body{background:url(javascript:1)}</style>`, []string{"<style"}},
		{"object tag", `<object data="evil.swf"></object>`, []string{"<object"}},
		{"form injection", `<form action="evil"><input name="p"></form>`, []string{"<form", "<input"}},
	}

	for _, c := range attackCases {
		t.Run(c.name, func(t *testing.T) {
			got := SanitizeRichText(c.input, 0)
			for _, bad := range c.mustNot {
				if strings.Contains(strings.ToLower(got), strings.ToLower(bad)) {
					t.Errorf("vektor %q lolos: hasil %q masih memuat %q", c.input, got, bad)
				}
			}
		})
	}

	t.Run("null byte dibuang", func(t *testing.T) {
		got := SanitizeRichText("<p>a\x00b</p>", 0)
		if strings.Contains(got, "\x00") {
			t.Errorf("null byte masih ada: %q", got)
		}
	})

	t.Run("batas panjang per rune", func(t *testing.T) {
		got := SanitizeRichText("<p>日本語</p>", 3)
		if len([]rune(got)) > 3 {
			t.Errorf("melebihi maxLen: %q (%d rune)", got, len([]rune(got)))
		}
	})
}

// ============================================================================
// SanitizeURL — cegah javascript:/data:/open-redirect
// ============================================================================

func TestSanitizeURL(t *testing.T) {
	allowed := []struct{ in, want string }{
		// positive control
		{"https://contoh.com/a", "https://contoh.com/a"},
		{"http://contoh.com", "http://contoh.com"},
		{"mailto:a@b.com", "mailto:a@b.com"},
		{"tel:+628123", "tel:+628123"},
		{"contoh.com/path", "https://contoh.com/path"}, // tanpa skema -> https
		{"/storage/stores/a.jpg", "/storage/stores/a.jpg"},
		{"  https://contoh.com  ", "https://contoh.com"}, // trim
	}

	for _, c := range allowed {
		if got := SanitizeURL(c.in); got != c.want {
			t.Errorf("SanitizeURL(%q) = %q, want %q", c.in, got, c.want)
		}
	}

	blocked := []struct{ name, in string }{
		{"javascript lowercase", "javascript:alert(1)"},
		{"javascript uppercase", "JAVASCRIPT:alert(1)"},
		{"javascript mixed case", "JaVaScRiPt:alert(1)"},
		{"javascript with space", "  javascript:alert(1)"},
		{"vbscript", "vbscript:msgbox(1)"},
		{"data uri", "data:text/html,<script>alert(1)</script>"},
		{"file uri", "file:///etc/passwd"},
		{"protocol relative", "//evil.com/x"},
	}

	for _, c := range blocked {
		t.Run(c.name, func(t *testing.T) {
			if got := SanitizeURL(c.in); got != "" {
				t.Errorf("SanitizeURL(%q) = %q, harus kosong", c.in, got)
			}
		})
	}

	if got := SanitizeURL(""); got != "" {
		t.Errorf("string kosong harus kosong, dapat %q", got)
	}
}

// ============================================================================
// SanitizeVideoURL — whitelist domain YouTube
// ============================================================================

func TestSanitizeVideoURL(t *testing.T) {
	ok := []string{
		"https://www.youtube.com/watch?v=abc",
		"https://youtube.com/embed/abc",
		"https://youtu.be/abc",
	}
	for _, in := range ok {
		if got := SanitizeVideoURL(in); got == "" {
			t.Errorf("SanitizeVideoURL(%q) harus lolos", in)
		}
	}

	bad := []struct{ name, in string }{
		{"domain lain", "https://evil.com/watch?v=abc"},
		{"javascript", "javascript:alert(1)"},
		{"kosong", ""},
		// Regresi: versi lama memakai strings.Contains(host, "youtube.com")
		// sehingga semua host di bawah ini LOLOS. Pencocokan harus berbasis
		// label domain utuh, bukan substring.
		{"youtube.com sebagai prefix host", "https://youtube.com.evil.com/embed"},
		{"youtube.com di tengah host", "https://notyoutube.com.evil.com/x"},
		{"youtu.be sebagai awalan host", "https://evil-youtu.be.attacker.net/x"},
		{"youtube.com di query", "https://evil.com/?u=youtube.com"},
		{"youtube.com di fragment", "https://evil.com#youtube.com"},
		{"nyaris sama", "https://youtube.co/x"},
	}
	for _, c := range bad {
		t.Run(c.name, func(t *testing.T) {
			if got := SanitizeVideoURL(c.in); got != "" {
				t.Errorf("SanitizeVideoURL(%q) = %q, harus kosong", c.in, got)
			}
		})
	}
}

// TestSanitizeVideoURLSubdomainSah memastikan penyaringan tidak terlalu ketat:
// subdomain resmi dan bentuk sah lain tetap harus lolos (positive control).
func TestSanitizeVideoURLSubdomainSah(t *testing.T) {
	for _, in := range []string{
		"https://www.youtube.com/watch?v=x",
		"https://m.youtube.com/watch?v=x",
		"https://music.youtube.com/watch?v=x",
		"https://www.youtube-nocookie.com/embed/x",
		"https://youtu.be/abc",
		"https://YOUTUBE.COM/watch?v=x",
		"https://vimeo.com/123456",
		"https://player.vimeo.com/video/123456",
		// File video langsung dirender sebagai <video>, bukan iframe, jadi
		// boleh berasal dari host mana pun.
		"https://cdn.contoh.com/klip.mp4",
		"https://cdn.contoh.com/video.webm?token=abc",
		"https://contoh.com/rekaman.MOV",
		// Aset milik sendiri.
		"/storage/videos/klip.mp4",
	} {
		if got := SanitizeVideoURL(in); got == "" {
			t.Errorf("URL sah %q ditolak", in)
		}
	}
}

// TestSanitizeVideoURLSkemaBerbahaya memastikan skema yang bisa mengeksekusi
// kode atau membaca berkas lokal selalu dibuang.
func TestSanitizeVideoURLSkemaBerbahaya(t *testing.T) {
	for _, in := range []string{
		"javascript:alert(1)",
		"JavaScript:alert(1)",
		"vbscript:msgbox(1)",
		"data:text/html,<script>alert(1)</script>",
		"file:///C:/Windows/win.ini",
		"blob:https://evil.com/uuid",
		"//evil.com/klip.mp4", // protokol-relatif ke host asing
	} {
		if got := SanitizeVideoURL(in); got != "" {
			t.Errorf("skema berbahaya %q lolos sebagai %q", in, got)
		}
	}
}

// ============================================================================
// SanitizePhone
// ============================================================================

func TestSanitizePhone(t *testing.T) {
	cases := []struct{ in, want string }{
		{"+62 812-3456-7890", "+62 812-3456-7890"}, // positive control
		{"(021) 555 1234", "(021) 555 1234"},
		{"+62812345abc", "+62812345"}, // huruf dibuang
		// Tag HTML ikut dibuang karakternya (hanya digit/format yang bertahan).
		{"62812<script>alert(1)</script>", "62812(1)"},
		// Dipotong tepat 30 karakter.
		{"+62 812 3456 7890 1111 2222 3333", "+62 812 3456 7890 1111 2222 33"},
		{"", ""},
	}
	for _, c := range cases {
		if got := SanitizePhone(c.in); got != c.want {
			t.Errorf("SanitizePhone(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

// ============================================================================
// SanitizeSlug
// ============================================================================

func TestSanitizeSlug(t *testing.T) {
	cases := []struct{ in, want string }{
		{"Toko Saya", "toko-saya"},          // positive control
		{"toko_saya", "toko-saya"},          // underscore -> hyphen
		{"  --Toko--Saya--  ", "toko-saya"}, // hyphen berlebih dirapikan
		{"tokö", "tok"},                     // non-ascii dibuang
		{"a/b?c=d", "a-b-c-d"},              // karakter path dibuang
		{"", ""},
	}
	for _, c := range cases {
		if got := SanitizeSlug(c.in); got != c.want {
			t.Errorf("SanitizeSlug(%q) = %q, want %q", c.in, got, c.want)
		}
	}

	t.Run("dipotong 200 karakter", func(t *testing.T) {
		got := SanitizeSlug(strings.Repeat("a", 300))
		if len(got) > 200 {
			t.Errorf("panjang %d melebihi 200", len(got))
		}
	})
}

// ============================================================================
// ValidateEmail
// ============================================================================

func TestValidateEmail(t *testing.T) {
	valid := []string{
		"a@b.co", "user.name+tag@contoh.com", "USER@CONTOH.COM", "  a@b.co  ",
	}
	for _, e := range valid {
		if !ValidateEmail(e) {
			t.Errorf("ValidateEmail(%q) harus true", e)
		}
	}

	invalid := []struct{ name, in string }{
		{"tanpa at", "abc.com"},
		{"tanpa domain", "a@"},
		{"tanpa tld", "a@b"},
		{"spasi di tengah", "a b@c.com"},
		{"kosong", ""},
		{"terlalu panjang", strings.Repeat("a", 250) + "@b.co"},
		{"header injection", "a@b.com\nBcc: x@y.com"},
		{"dua at", "a@@b.com"},
	}
	for _, c := range invalid {
		t.Run(c.name, func(t *testing.T) {
			if ValidateEmail(c.in) {
				t.Errorf("ValidateEmail(%q) harus false", c.in)
			}
		})
	}
}

// ============================================================================
// ValidatePassword
// ============================================================================

func TestValidatePassword(t *testing.T) {
	t.Run("positive control: password kuat lolos", func(t *testing.T) {
		if err := ValidatePassword("Rahasia1!"); err != nil {
			t.Fatalf("password sah ditolak: %v", err)
		}
	})

	cases := []struct{ name, in, wantErr string }{
		{"terlalu pendek", "Ab1!", "minimal 8"},
		{"tanpa huruf besar", "rahasia1!", "huruf besar"},
		{"tanpa huruf kecil", "RAHASIA1!", "huruf kecil"},
		{"tanpa angka", "Rahasia!!", "angka"},
		{"tanpa karakter khusus", "Rahasia12", "karakter khusus"},
		{"melebihi 72 byte", strings.Repeat("A", 70) + "1!b", "maksimal 72"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := ValidatePassword(c.in)
			if err == nil {
				t.Fatalf("password lemah %q diterima", c.in)
			}
			if !strings.Contains(err.Error(), c.wantErr) {
				t.Errorf("pesan error %q tidak memuat %q", err.Error(), c.wantErr)
			}
		})
	}
}

// ============================================================================
// ValidatePrice
// ============================================================================

func TestValidatePrice(t *testing.T) {
	cases := []struct{ in, want float64 }{
		{1000, 1000},
		{99.999, 100}, // dibulatkan 2 desimal
		{0, 0},
		{-5, 0},           // negatif -> 0
		{math.NaN(), 0},   // NaN -> 0
		{math.Inf(1), 0},  // +Inf -> 0
		{math.Inf(-1), 0}, // -Inf -> 0
	}
	for _, c := range cases {
		if got := ValidatePrice(c.in); got != c.want {
			t.Errorf("ValidatePrice(%v) = %v, want %v", c.in, got, c.want)
		}
	}
}

// ============================================================================
// ClampText
// ============================================================================

func TestClampText(t *testing.T) {
	if got := ClampText("abcdef", 3); got != "abc" {
		t.Errorf("ClampText = %q, want abc", got)
	}
	if got := ClampText("abc", 10); got != "abc" {
		t.Errorf("teks pendek harus utuh, dapat %q", got)
	}
	if got := ClampText("abc", 0); got != "abc" {
		t.Errorf("maxLen 0 = tanpa batas, dapat %q", got)
	}
	if got := ClampText("日本語", 2); len([]rune(got)) != 2 {
		t.Errorf("perhitungan rune salah: %q", got)
	}
}

// ============================================================================
// Inspeksi perilaku: SanitizeOrderLimits
// ============================================================================

func TestValidateOrderLimits(t *testing.T) {
	t.Run("default min 1 tanpa input", func(t *testing.T) {
		min, max := ValidateOrderLimits(nil, nil)
		if min != 1 || max != nil {
			t.Errorf("dapat min=%d max=%v", min, max)
		}
	})

	t.Run("nilai sah dipertahankan", func(t *testing.T) {
		min, max := ValidateOrderLimits(float64(2), float64(10))
		if min != 2 || max == nil || *max != 10 {
			t.Errorf("dapat min=%d max=%v", min, max)
		}
	})

	t.Run("min di bawah 1 jatuh ke 1", func(t *testing.T) {
		min, _ := ValidateOrderLimits(float64(0), nil)
		if min != 1 {
			t.Errorf("dapat %d, want 1", min)
		}
	})

	t.Run("max lebih kecil dari min dinaikkan ke min", func(t *testing.T) {
		min, max := ValidateOrderLimits(float64(5), float64(3))
		if max == nil || *max < min {
			t.Errorf("max %v lebih kecil dari min %d", max, min)
		}
	})

	t.Run("max nol diabaikan", func(t *testing.T) {
		_, max := ValidateOrderLimits(nil, float64(0))
		if max != nil {
			t.Errorf("max harus nil, dapat %v", *max)
		}
	})
}

// ============================================================================
// IsBotHoneypotTriggered
// ============================================================================

func TestIsBotHoneypotTriggered(t *testing.T) {
	for _, v := range []string{"", "   ", "\t\n"} {
		if IsBotHoneypotTriggered(v) {
			t.Errorf("honeypot kosong %q dianggap terisi", v)
		}
	}
	for _, v := range []string{"bot", " x ", "0"} {
		if !IsBotHoneypotTriggered(v) {
			t.Errorf("honeypot terisi %q tidak terdeteksi", v)
		}
	}
}

// ============================================================================
// SanitizeWhatsAppContacts
// ============================================================================

func TestSanitizeWhatsAppContacts(t *testing.T) {
	t.Run("nomor tunggal", func(t *testing.T) {
		got := SanitizeWhatsAppContacts("+62 812-3456")
		if got != "+62 812-3456" {
			t.Errorf("dapat %q", got)
		}
	})

	t.Run("string kosong", func(t *testing.T) {
		if got := SanitizeWhatsAppContacts(""); got != "" {
			t.Errorf("dapat %q, want kosong", got)
		}
	})

	t.Run("array valid: default & storefront diisi otomatis", func(t *testing.T) {
		in := `[{"number":"628111","label":"CS 1"},{"number":"628222","label":"CS 2"}]`
		got := SanitizeWhatsAppContacts(in)
		var out []WAContactSanitized
		if err := json.Unmarshal([]byte(got), &out); err != nil {
			t.Fatalf("hasil bukan JSON valid: %v (%q)", err, got)
		}
		if len(out) != 2 {
			t.Fatalf("jumlah kontak %d, want 2", len(out))
		}
		if !out[0].IsDefault {
			t.Error("kontak pertama harus default bila tak ada yang menandai")
		}
		if !out[0].UseForStorefront {
			t.Error("default harus dipakai untuk storefront")
		}
	})

	t.Run("nomor kosong dibuang, id otomatis", func(t *testing.T) {
		in := `[{"number":""},{"number":"628999"}]`
		got := SanitizeWhatsAppContacts(in)
		var out []WAContactSanitized
		if err := json.Unmarshal([]byte(got), &out); err != nil {
			t.Fatalf("JSON tidak valid: %v", err)
		}
		if len(out) != 1 {
			t.Fatalf("kontak tanpa nomor harus dibuang, tersisa %d", len(out))
		}
		if out[0].Number != "628999" {
			t.Errorf("nomor salah: %q", out[0].Number)
		}
	})

	t.Run("label berisi tag dibersihkan", func(t *testing.T) {
		in := `[{"number":"628111","label":"<script>alert(1)</script>CS"}]`
		got := SanitizeWhatsAppContacts(in)
		if strings.Contains(got, "<script") {
			t.Errorf("tag lolos ke label: %q", got)
		}
	})

	t.Run("array tidak valid jatuh ke sanitasi telepon", func(t *testing.T) {
		// Input rusak tetap diproses sebagai nomor telepon. Hasilnya bisa
		// kosong bila tidak ada digit sama sekali — yang penting fungsi tidak
		// panic dan tidak meneruskan karakter berbahaya.
		got := SanitizeWhatsAppContacts("[bukan json")
		for _, ch := range got {
			if !(ch >= '0' && ch <= '9') && ch != '+' && ch != '-' && ch != ' ' && ch != '(' && ch != ')' {
				t.Errorf("karakter tak diizinkan lolos: %q", ch)
			}
		}
	})

	t.Run("array rusak dengan digit -> jadi nomor", func(t *testing.T) {
		got := SanitizeWhatsAppContacts(`[{"number":"628111"}`) // kurang kurung tutup
		if got != "628111" {
			t.Errorf("dapat %q, want 628111", got)
		}
	})
}

// ============================================================================
// SanitizeSocialLinks
// ============================================================================

func TestSanitizeSocialLinks(t *testing.T) {
	t.Run("kosong -> array kosong", func(t *testing.T) {
		if got := SanitizeSocialLinks("   "); got != "[]" {
			t.Errorf("dapat %q, want []", got)
		}
	})

	t.Run("positive control: data bersih bertahan", func(t *testing.T) {
		in := `[{"platform":"instagram","url":"https://insta.com/me"}]`
		got := SanitizeSocialLinks(in)
		if !strings.Contains(got, "instagram") || !strings.Contains(got, "insta.com") {
			t.Errorf("data sah hilang: %q", got)
		}
	})

	t.Run("tag script dibuang", func(t *testing.T) {
		in := `[{"url":"<script>alert(1)</script>"}]`
		got := SanitizeSocialLinks(in)
		if strings.Contains(strings.ToLower(got), "<script") {
			t.Errorf("script lolos: %q", got)
		}
	})
}
