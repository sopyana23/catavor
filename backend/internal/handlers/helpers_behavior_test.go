package handlers

import (
	"strings"
	"testing"
)

// TestCleanSlug memastikan normalisasi slug toko konsisten dan aman dipakai
// sebagai komponen URL.
func TestCleanSlug(t *testing.T) {
	cases := map[string]string{
		"Toko Saya":     "toko-saya",
		"  Toko Saya  ": "toko-saya",
		"TOKO_SAYA":     "toko-saya", // underscore -> "-" lalu trim tepi
		"toko--saya":    "toko--saya",
		"toko saya!!!":  "toko-saya",
		"../../etc":     "etc",
		"catavor":       "catavor",
		"":              "",
		"!!!":           "",
		"TokoÜnïcode":   "toko-n-code",
		"a/b?c#d":       "a-b-c-d",
	}
	for in, want := range cases {
		if got := cleanSlug(in); got != want {
			t.Errorf("cleanSlug(%q) = %q, mau %q", in, got, want)
		}
	}

	// Invarian: hasil tidak boleh memuat karakter selain [a-z0-9_-].
	for _, in := range []string{"Toko Saya", "../../etc/passwd", "<script>", "a?b=c&d"} {
		got := cleanSlug(in)
		for _, r := range got {
			ok := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_'
			if !ok {
				t.Errorf("cleanSlug(%q) = %q memuat karakter tidak aman %q", in, got, r)
			}
		}
	}
}

// TestSlugifyCategory memastikan slug kategori tidak pernah menyisakan
// pemisah ganda di tepi.
func TestSlugifyCategory(t *testing.T) {
	cases := map[string]string{
		"Reptil & Amfibi": "reptil-amfibi",
		"  Mamalia  ":     "mamalia",
		"ikan--hias":      "ikan--hias",
		"!!!":             "",
		"":                "",
		"A/B":             "a-b",
	}
	for in, want := range cases {
		if got := slugifyCategory(in); got != want {
			t.Errorf("slugifyCategory(%q) = %q, mau %q", in, got, want)
		}
	}

	// Tidak boleh ada tanda hubung di awal/akhir.
	for _, in := range []string{"-ikan-", "!!!ikan???", "  -x-  "} {
		got := slugifyCategory(in)
		if strings.HasPrefix(got, "-") || strings.HasSuffix(got, "-") {
			t.Errorf("slugifyCategory(%q) = %q punya tanda hubung di tepi", in, got)
		}
	}
}

// TestIsBotOrCrawler adalah pertahanan utama agar analytics toko tidak
// tercemar trafik otomatis. Positif (bot) harus tertangkap, negatif (manusia)
// tidak boleh salah tertangkap.
func TestIsBotOrCrawler(t *testing.T) {
	bots := []string{
		"",
		"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
		"curl/8.4.0",
		"python-requests/2.31.0",
		"Go-http-client/1.1",
		"Mozilla/5.0 HeadlessChrome/120.0.0.0",
		"facebookexternalhit/1.1",
		"Mozilla/5.0 (compatible; AhrefsBot/7.0)",
		"axios/1.6.0",
		"Slackbot-LinkExpanding 1.0",
	}
	for _, ua := range bots {
		if !isBotOrCrawler(ua) {
			t.Errorf("UA %q seharusnya terdeteksi bot", ua)
		}
	}

	// KONTROL POSITIF: user agent browser nyata TIDAK boleh diklasifikasikan bot.
	humans := []string{
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	}
	for _, ua := range humans {
		if isBotOrCrawler(ua) {
			t.Errorf("UA browser nyata %q salah diklasifikasikan sebagai bot", ua)
		}
	}
}

// TestClipClientLog memastikan log dari klien tidak bisa dipakai untuk
// membanjiri penyimpanan log (log flooding).
func TestClipClientLog(t *testing.T) {
	if got := clipClientLog("pendek", 100); got != "pendek" {
		t.Errorf("string pendek tidak boleh diubah, dapat %q", got)
	}
	long := strings.Repeat("A", 5000)
	got := clipClientLog(long, 200)
	// Implementasi menambahkan penanda "…[dipotong]" setelah 200 byte pertama.
	if !strings.HasPrefix(got, strings.Repeat("A", 200)) {
		t.Errorf("clipClientLog harus mempertahankan 200 byte pertama, dapat %q", got[:20])
	}
	if len(got) > 200+32 {
		t.Errorf("clipClientLog terlalu panjang: %d byte (harus ~200 + penanda)", len(got))
	}
	if !strings.Contains(got, "dipotong") {
		t.Errorf("clipClientLog harus menandai pemotongan, dapat %q", got[190:])
	}
	if got == "" {
		t.Error("clipClientLog mengembalikan string kosong untuk input tak kosong")
	}
	// Batas nol/negatif tidak boleh panik.
	_ = clipClientLog("x", 0)
	_ = clipClientLog("x", -5)
}

// TestParsePrice memastikan harga dari payload JSON (angka atau string) diurai
// konsisten — kesalahan di sini berarti salah harga di toko.
//
// Regresi N-43: sebelumnya SEMUA titik & koma dibuang sehingga "150000.50"
// menjadi 15000050 (100x lipat) dan "1.500.000" kebetulan benar.
func TestParsePrice(t *testing.T) {
	cases := []struct {
		in   interface{}
		want float64
		note string
	}{
		{float64(150000), 150000, "angka JSON"},
		{int(25000), 25000, "int"},
		{int64(9000), 9000, "int64"},

		// Desimal — inti regresi N-43.
		{"150000.50", 150000.50, "desimal titik"},
		{"1500,50", 1500.50, "desimal koma (format ID)"},
		{"12.5", 12.5, "desimal pendek"},

		// Pemisah ribuan.
		{"1.500.000", 1500000, "ribuan titik"},
		{"1.500", 1500, "ribuan tiga digit tunggal"},
		{"1,500,000", 1500000, "ribuan koma"},
		{"1.500.000,50", 1500000.50, "ribuan + desimal ID"},
		{"1,500,000.50", 1500000.50, "ribuan + desimal EN"},

		// Awalan mata uang.
		{"Rp 150.000", 150000, "awalan Rp + ribuan"},
		{" 25000 ", 25000, "spasi tepi"},

		// Tidak dapat diurai -> 0, bukan panic.
		{"", 0, "kosong"},
		{nil, 0, "nil"},
		{true, 0, "bool"},
		{"abc", 0, "bukan angka"},

		// Negatif diteruskan; validasi bisnis ada di lapisan lain.
		{-500, -500, "negatif"},
	}
	for _, c := range cases {
		if got := parsePrice(c.in); got != c.want {
			t.Errorf("parsePrice(%#v) [%s] = %v, mau %v", c.in, c.note, got, c.want)
		}
	}

	// Invarian khusus regresi: nilai desimal TIDAK boleh berlipat 100.
	if got := parsePrice("150000.50"); got == 15000050 {
		t.Errorf("REGRESI N-43: parsePrice(\"150000.50\") mengembalikan %v (titik dibuang)", got)
	}
}
