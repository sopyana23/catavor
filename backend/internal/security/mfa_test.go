package security

import (
	"strings"
	"testing"
	"time"
)

// rfcSecret adalah base32 dari "12345678901234567890" — secret uji resmi RFC 6238.
const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"

// TestTOTPMatchesRFC6238Vectors memakai vektor uji Appendix B RFC 6238 dan
// memotong hasilnya ke 6 digit (parameter yang dipakai aplikasi authenticator).
func TestTOTPMatchesRFC6238Vectors(t *testing.T) {
	cases := []struct {
		unix int64
		want string
	}{
		{59, "287082"},          // 94287082 -> 6 digit
		{1111111109, "081804"},  // 07081804 -> 6 digit
		{1111111111, "050471"},  // 14050471 -> 6 digit
		{1234567890, "005924"},  // 89005924 -> 6 digit
		{2000000000, "279037"},  // 69279037 -> 6 digit
		{20000000000, "353130"}, // 65353130 -> 6 digit
	}
	for _, tc := range cases {
		ts := time.Unix(tc.unix, 0).UTC()
		got, err := GenerateTOTPCode(rfcSecret, TOTPStepAt(ts))
		if err != nil {
			t.Fatalf("unix %d: %v", tc.unix, err)
		}
		if got != tc.want {
			t.Errorf("unix %d: got %s want %s", tc.unix, got, tc.want)
		}
	}
}

// TestVerifyTOTPAcceptsSkewButRejectsOutsideWindow memastikan toleransi jam
// terbatas pada ±1 langkah.
func TestVerifyTOTPAcceptsSkewButRejectsOutsideWindow(t *testing.T) {
	now := time.Unix(1_700_000_000, 0).UTC()

	sameStep, err := GenerateTOTPCode(rfcSecret, TOTPStepAt(now))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := VerifyTOTP(rfcSecret, sameStep, now); err != nil {
		t.Errorf("kode pada langkah sekarang harus diterima: %v", err)
	}

	prevStep, _ := GenerateTOTPCode(rfcSecret, TOTPStepAt(now)-1)
	if _, err := VerifyTOTP(rfcSecret, prevStep, now); err != nil {
		t.Errorf("kode satu langkah sebelumnya harus diterima: %v", err)
	}

	tooOld, _ := GenerateTOTPCode(rfcSecret, TOTPStepAt(now)-3)
	if _, err := VerifyTOTP(rfcSecret, tooOld, now); err == nil {
		t.Error("kode tiga langkah ke belakang harus ditolak")
	}

	if _, err := VerifyTOTP(rfcSecret, "abcdef", now); err == nil {
		t.Error("kode non-numerik harus ditolak")
	}
	if _, err := VerifyTOTP(rfcSecret, "12345", now); err == nil {
		t.Error("kode dengan panjang salah harus ditolak")
	}
}

// TestVerifyTOTPReportsMatchedStep memastikan langkah yang cocok dilaporkan
// agar pemanggil bisa menolak replay kode yang sama.
func TestVerifyTOTPReportsMatchedStep(t *testing.T) {
	now := time.Unix(1_700_000_000, 0).UTC()
	wantStep := TOTPStepAt(now)
	code, _ := GenerateTOTPCode(rfcSecret, wantStep)

	gotStep, err := VerifyTOTP(rfcSecret, code, now)
	if err != nil {
		t.Fatal(err)
	}
	if gotStep != wantStep {
		t.Errorf("matched step got %d want %d", gotStep, wantStep)
	}
}

func TestSealOpenMFASecretRoundTripAndTamperDetection(t *testing.T) {
	key := "unit-test-key-material-0123456789"

	sealed, err := SealMFASecret(key, rfcSecret)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(sealed, "v1:") {
		t.Fatalf("format ciphertext tak terduga: %s", sealed)
	}
	if strings.Contains(sealed, rfcSecret) {
		t.Fatal("ciphertext tidak boleh memuat plaintext secret")
	}

	plain, err := OpenMFASecret(key, sealed)
	if err != nil {
		t.Fatal(err)
	}
	if plain != rfcSecret {
		t.Fatalf("round-trip berubah: %s", plain)
	}

	if _, err := OpenMFASecret("kunci-lain", sealed); err == nil {
		t.Error("kunci salah harus gagal (GCM tag) ")
	}

	tampered := []byte(sealed)
	tampered[len(tampered)-2] ^= 0x01
	if _, err := OpenMFASecret(key, string(tampered)); err == nil {
		t.Error("ciphertext yang diubah harus gagal diautentikasi")
	}
}

func TestBackupCodesSingleUseHashing(t *testing.T) {
	key := "unit-test-key-material-0123456789"

	codes, hashes, err := GenerateBackupCodes(key, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(codes) != 10 || len(hashes) != 10 {
		t.Fatalf("jumlah kode/hash salah: %d/%d", len(codes), len(hashes))
	}

	seen := map[string]bool{}
	for _, c := range codes {
		if seen[c] {
			t.Fatalf("kode duplikat: %s", c)
		}
		seen[c] = true
		if !strings.Contains(c, "-") {
			t.Errorf("kode harus diformat XXXXX-XXXXX, dapat %q", c)
		}
	}

	// Kode pertama harus cocok dengan hash index 0, termasuk saat pengguna
	// mengetik tanpa strip dan huruf kecil.
	idx := MatchBackupCodeHash(key, strings.ToLower(strings.ReplaceAll(codes[0], "-", "")), hashes)
	if idx != 0 {
		t.Errorf("kode pertama harus cocok di index 0, dapat %d", idx)
	}

	if idx := MatchBackupCodeHash(key, "AAAAA-AAAAA", hashes); idx != -1 {
		t.Errorf("kode asing tidak boleh cocok, dapat index %d", idx)
	}
	if idx := MatchBackupCodeHash("kunci-lain", codes[0], hashes); idx != -1 {
		t.Error("hash dengan kunci berbeda tidak boleh cocok")
	}
}

func TestBuildOTPAuthURL(t *testing.T) {
	u := BuildOTPAuthURL("Catavor", "admin@catavor.id", rfcSecret)
	for _, want := range []string{
		"otpauth://totp/",
		"secret=" + rfcSecret,
		"issuer=Catavor",
		"digits=6",
		"period=30",
		"algorithm=SHA1",
	} {
		if !strings.Contains(u, want) {
			t.Errorf("URI tidak memuat %q: %s", want, u)
		}
	}
}
