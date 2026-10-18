package handlers

import (
	"os"
	"strings"
	"testing"
)

// bacaSumberHandler membaca berkas sumber handler untuk pemeriksaan statis.
func bacaSumberHandler(nama string) (string, error) {
	b, err := os.ReadFile(nama)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// Uji N-14: klaim `email_verified` dari Google wajib diinterpretasikan
// fail-closed. Google mengirim bool (endpoint userinfo) maupun string
// (tokeninfo), dan nilai yang tidak dikenali tidak boleh dianggap terverifikasi.
func TestClaimsEmailVerified(t *testing.T) {
	cases := []struct {
		nama string
		in   any
		want bool
	}{
		{"bool true", true, true},
		{"bool false", false, false},
		{"string true", "true", true},
		{"string TRUE", "TRUE", true},
		{"string true+spasi", " true ", true},
		{"string false", "false", false},
		{"string kosong", "", false},
		{"angka 1 (bukan klaim sah)", float64(1), false},
		{"nil", nil, false},
		{"map (bentuk tak dikenal)", map[string]any{"x": true}, false},
	}

	for _, tc := range cases {
		if got := claimsEmailVerified(tc.in); got != tc.want {
			t.Errorf("%s: claimsEmailVerified(%#v) = %v, ingin %v", tc.nama, tc.in, got, tc.want)
		}
	}
}

// Uji N-13: GoogleAuth tidak boleh lagi memakai `req.Plan` untuk menentukan
// paket. Sumber kebenaran adalah kode sumber, karena alur ini butuh token
// Google asli yang tidak tersedia di lingkungan uji.
func TestGoogleAuthMengabaikanPlanDariRequest(t *testing.T) {
	src, err := bacaSumberHandler("auth_handler.go")
	if err != nil {
		t.Fatalf("gagal membaca sumber: %v", err)
	}

	awal := strings.Index(src, "func (h *AuthHandler) GoogleAuth(")
	if awal < 0 {
		t.Fatal("fungsi GoogleAuth tidak ditemukan")
	}
	akhir := strings.Index(src[awal:], "\nfunc ")
	if akhir < 0 {
		t.Fatal("batas akhir GoogleAuth tidak ditemukan")
	}
	badan := src[awal : awal+akhir]

	// Nilai plan tidak boleh diturunkan dari request.
	terlarang := []string{
		`plan = "pro_starter"`,
		`plan = "pro_business"`,
		`paymentStatus = "paid"`,
	}
	for _, pola := range terlarang {
		if strings.Contains(badan, pola) {
			t.Errorf("GoogleAuth masih menetapkan paket berbayar dari request: %q", pola)
		}
	}

	// Harus start dari paket gratis.
	if !strings.Contains(badan, `plan := "free"`) {
		t.Error("GoogleAuth tidak memulai toko dari paket free")
	}
	if !strings.Contains(badan, `paymentStatus := "free_active"`) {
		t.Error("GoogleAuth tidak menetapkan payment_status free_active")
	}

	// req.Plan harus diabaikan, bukan dipakai.
	if !strings.Contains(badan, "req.Plan") {
		t.Error("GoogleAuth seharusnya tetap menyebut req.Plan sebagai diabaikan")
	}
	if strings.Contains(badan, "strings.ToLower(strings.TrimSpace(req.Plan))") {
		t.Error("GoogleAuth masih membaca req.Plan sebagai sumber paket")
	}
}

// Uji N-14: penjagaan email belum-verifikasi TIDAK boleh mengunci akun yang
// sudah tertaut Google. Di data produksi ada akun dengan google_id terisi dan
// toko aktif, tetapi email_verified_at kosong; mereka adalah pengguna sah.
func TestPenjagaanN14TidakMengunciAkunTertautGoogle(t *testing.T) {
	src, err := bacaSumberHandler("auth_handler.go")
	if err != nil {
		t.Fatalf("gagal membaca sumber: %v", err)
	}

	awal := strings.Index(src, "func (h *AuthHandler) GoogleAuth(")
	if awal < 0 {
		t.Fatal("fungsi GoogleAuth tidak ditemukan")
	}
	akhir := strings.Index(src[awal:], "\nfunc ")
	badan := src[awal : awal+akhir]

	// Blok penjagaan harus mensyaratkan akun belum tertaut Google.
	if !strings.Contains(badan, "belumTertautGoogle := user.GoogleID == nil || *user.GoogleID == \"\"") {
		t.Error("penjagaan N-14 tidak mendefinisikan belumTertautGoogle")
	}
	if !strings.Contains(badan, "user.EmailVerifiedAt == nil && belumTertautGoogle") {
		t.Error("penjagaan N-14 harus mensyaratkan akun belum tertaut Google")
	}
	// Penjagaan tanpa syarat itu yang berbahaya: akan mengunci 5 akun sah.
	if strings.Contains(badan, "if user.EmailVerifiedAt == nil {") {
		t.Error("penjagaan N-14 tanpa syarat google_id akan mengunci pengguna sah")
	}
}
