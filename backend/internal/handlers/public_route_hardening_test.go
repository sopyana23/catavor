package handlers

import (
	"os"
	"regexp"
	"strings"
	"testing"
	"time"
)

// bacaSumberUntukN15 membaca berkas handler sebagai teks agar perbaikan yang
// sifatnya "jangan lakukan X" bisa diuji tanpa menjalankan server.
func bacaSumberUntukN15(t *testing.T, nama string) string {
	t.Helper()
	b, err := os.ReadFile(nama)
	if err != nil {
		t.Fatalf("gagal membaca %s: %v", nama, err)
	}
	return string(b)
}

// TestN15TrustedProxiesTidakMencakupRFC1918 mengunci akar masalah N-15:
// daftar proxy terpercaya sebelumnya di-hardcode ke 10/8, 172.16/12, 192.168/16
// sehingga header X-Forwarded-For dapat dipalsukan dari jaringan lokal.
// Terbukti di runtime: dari IP LAN, setelah kuota habis (429) delapan
// permintaan dengan XFF berputar kembali dijawab 200.
func TestN15TrustedProxiesTidakMencakupRFC1918(t *testing.T) {
	main := bacaSumberUntukN15(t, "../../cmd/server/main.go")
	if strings.Contains(main, "192.168.0.0/16") || strings.Contains(main, "10.0.0.0/8") {
		t.Error("main.go masih me-hardcode RFC1918 di TrustedProxies")
	}

	cfg := bacaSumberUntukN15(t, "../config/config.go")
	if !strings.Contains(cfg, "TRUSTED_PROXIES") {
		t.Error("daftar proxy terpercaya harus dapat dikonfigurasi lewat TRUSTED_PROXIES")
	}
	// default harus loopback saja
	if !strings.Contains(cfg, `getEnv("TRUSTED_PROXIES", "127.0.0.1,::1")`) {
		t.Error("default TRUSTED_PROXIES harus hanya loopback")
	}
}

// TestN15TidakBacaXFFMentah memastikan handler tidak lagi membaca
// X-Forwarded-For secara langsung. Membacanya mentah mengabaikan
// EnableTrustedProxyCheck milik Fiber sehingga IP klien dapat dipalsukan.
func TestN15TidakBacaXFFMentah(t *testing.T) {
	berkas := []string{"analytics_handler.go", "report_handler.go"}
	for _, f := range berkas {
		src := bacaSumberUntukN15(t, f)
		if strings.Contains(src, `c.Get("X-Forwarded-For")`) {
			t.Errorf("%s masih membaca X-Forwarded-For mentah; gunakan c.IP()", f)
		}
		if !strings.Contains(src, "c.IP()") {
			t.Errorf("%s tidak memakai c.IP()", f)
		}
	}
}

// TestN16VoteHelpfulTerbatas memastikan rute helpful memakai rate limiter dan
// handler-nya mendeduplikasi vote per IP.
func TestN16VoteHelpfulTerbatas(t *testing.T) {
	main := bacaSumberUntukN15(t, "../../cmd/server/main.go")
	if !strings.Contains(main, `api.Post("/help/articles/:id/helpful", middleware.PublicSubmissionRateLimiter()`) {
		t.Error("rute /help/articles/:id/helpful belum memakai PublicSubmissionRateLimiter")
	}

	sup := bacaSumberUntukN15(t, "support_handler.go")
	if !strings.Contains(sup, "sudahVoteHelpful(c.IP()") {
		t.Error("VoteHelpful belum memakai dedup per IP")
	}
}

// TestN17ResponsOTPSeragam memastikan SEMUA jalur keluar SendRegistrationOTP
// mengembalikan pesan yang identik. Uji versi pertama hanya mencari string
// "responsSeragam" sehingga tetap LULUS walau satu jalur diberi pesan berbeda —
// itu uji yang tidak sah. Sekarang yang diperiksa adalah jumlah pesan unik
// yang benar-benar dikembalikan handler.
func TestN17ResponsOTPSeragam(t *testing.T) {
	src := bacaSumberUntukN15(t, "auth_handler.go")

	// Ambil hanya badan fungsi SendRegistrationOTP.
	awal := strings.Index(src, "func (h *AuthHandler) SendRegistrationOTP(")
	if awal < 0 {
		t.Fatal("fungsi SendRegistrationOTP tidak ditemukan")
	}
	sisa := src[awal:]
	if akhir := strings.Index(sisa[1:], "\nfunc "); akhir >= 0 {
		sisa = sisa[:akhir+1]
	}

	// Semua pesan yang dikembalikan lewat "message": di badan fungsi.
	pola := regexp.MustCompile(`"message":\s*"([^"]+)"`)
	var pesan []string
	for _, m := range pola.FindAllStringSubmatch(sisa, -1) {
		pesan = append(pesan, m[1])
	}
	if len(pesan) == 0 {
		t.Fatal("tidak ada pesan yang terdeteksi; pola uji perlu diperbarui")
	}

	// Pesan validasi format (email tidak valid / data tidak valid) memang boleh
	// berbeda karena tidak bergantung pada status akun. Yang dilarang adalah
	// pesan yang membedakan "sudah terdaftar" dari "belum terdaftar".
	terlarang := []string{
		"Email sudah terdaftar",
		"telah ditangguhkan",
	}
	jumlah := map[string]int{}
	for _, p := range pesan {
		for _, tl := range terlarang {
			if strings.Contains(p, tl) {
				t.Errorf("pesan membedakan status akun: %q", p)
			}
		}
		jumlah[p]++
	}

	// Pesan sukses yang dikembalikan ke klien harus satu bentuk saja.
	sukses := map[string]bool{}
	for _, p := range pesan {
		if strings.Contains(p, "OTP") {
			sukses[p] = true
		}
	}
	if len(sukses) != 1 {
		t.Errorf("pesan sukses OTP harus seragam, ditemukan %d bentuk: %v", len(sukses), sukses)
	}
}

// TestN17SemuaJalurSuksesSeragam memastikan setiap "return c.JSON" pada badan
// SendRegistrationOTP memakai respons seragam, bukan map ad-hoc.
func TestN17SemuaJalurSuksesSeragam(t *testing.T) {
	src := bacaSumberUntukN15(t, "auth_handler.go")

	awal := strings.Index(src, "func (h *AuthHandler) SendRegistrationOTP(")
	if awal < 0 {
		t.Fatal("fungsi SendRegistrationOTP tidak ditemukan")
	}
	sisa := src[awal:]
	if akhir := strings.Index(sisa[1:], "\nfunc "); akhir >= 0 {
		sisa = sisa[:akhir+1]
	}

	// Setiap balasan sukses OTP harus lewat responsSeragam.
	if n := strings.Count(sisa, "return c.JSON(responsSeragam)"); n != 3 {
		t.Errorf("jalur sukses memakai responsSeragam: %d, seharusnya 3 (honeypot + sudah terdaftar + sukses)", n)
	}
	if strings.Contains(sisa, `"Kode OTP 6-digit telah dikirimkan ke kotak masuk email Anda."`) {
		t.Error("masih ada jalur sukses dengan pesan berbeda dari responsSeragam")
	}
}

// TestSudahVoteHelpfulPerIP menguji logika dedup secara langsung.
func TestSudahVoteHelpfulPerIP(t *testing.T) {
	// bersihkan state global agar uji tidak bergantung urutan
	helpfulVoteDedup.mu.Lock()
	helpfulVoteDedup.seen = make(map[string]time.Time)
	helpfulVoteDedup.mu.Unlock()

	ip := "203.0.113.99"
	if sudahVoteHelpful(ip, 1) {
		t.Fatal("vote pertama seharusnya diterima")
	}
	for i := 0; i < 5; i++ {
		if !sudahVoteHelpful(ip, 1) {
			t.Fatalf("vote ulang ke-%d seharusnya ditolak", i+1)
		}
	}
	if sudahVoteHelpful(ip, 2) {
		t.Error("artikel berbeda harus punya kuota sendiri")
	}
	if sudahVoteHelpful("203.0.113.100", 1) {
		t.Error("IP berbeda harus punya kuota sendiri")
	}
}
