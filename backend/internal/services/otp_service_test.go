package services

import (
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// otpTestDB menyiapkan DB in-memory berisi tabel email_verification_otps.
func otpTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("buka sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.EmailVerificationOTP{}); err != nil {
		t.Fatalf("migrasi: %v", err)
	}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)
	return db
}

func seedOTP(t *testing.T, db *gorm.DB, email, code, purpose string, expiresIn time.Duration) models.EmailVerificationOTP {
	t.Helper()
	rec := models.EmailVerificationOTP{
		Email:     email,
		OTPHash:   hashOTP(code),
		Purpose:   purpose,
		Attempts:  0,
		ExpiresAt: time.Now().Add(expiresIn),
		CreatedAt: time.Now(),
	}
	if err := db.Create(&rec).Error; err != nil {
		t.Fatalf("seed OTP: %v", err)
	}
	return rec
}

// --- Generator -------------------------------------------------------------

func TestGenerateCryptographicOTP_SelaluEnamDigit(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 300; i++ {
		code, err := GenerateCryptographicOTP()
		if err != nil {
			t.Fatalf("iterasi %d: %v", i, err)
		}
		if len(code) != 6 {
			t.Fatalf("panjang kode = %d (%q), want 6", len(code), code)
		}
		n, err := strconv.Atoi(code)
		if err != nil {
			t.Fatalf("kode bukan numerik: %q", code)
		}
		if n < 100000 || n > 999999 {
			t.Fatalf("kode di luar rentang 6 digit: %q", code)
		}
		seen[code] = true
	}
	// 300 undian dari 900.000 nilai: kolisi masif berarti sumber acaknya rusak.
	if len(seen) < 290 {
		t.Errorf("hanya %d nilai unik dari 300 undian; entropy mencurigakan", len(seen))
	}
}

func TestHashOTP_DeterministikDanBerbeda(t *testing.T) {
	a := hashOTP("123456")
	if a != hashOTP("123456") {
		t.Error("hash harus deterministik")
	}
	if a == hashOTP("123457") {
		t.Error("kode berbeda harus menghasilkan hash berbeda")
	}
	if len(a) != 64 {
		t.Errorf("panjang hash = %d, want 64 (hex sha256)", len(a))
	}
	if strings.Contains(a, "123456") {
		t.Error("kode mentah tidak boleh muncul di hash")
	}
}

// --- VerifyOTP -------------------------------------------------------------

func TestVerifyOTP_SalahKodeMengurangiKesempatan(t *testing.T) {
	db := otpTestDB(t)
	svc := InitOTPService(db)
	seedOTP(t, db, "u@t.test", "111111", "registration", 5*time.Minute)

	want := []string{"Sisa kesempatan: 2", "Sisa kesempatan: 1", "Sisa kesempatan: 0"}
	for i, w := range want {
		_, err := svc.VerifyOTP("u@t.test", "999999", "registration")
		if err == nil {
			t.Fatalf("percobaan %d: kode salah seharusnya gagal", i+1)
		}
		if !strings.Contains(err.Error(), w) {
			t.Fatalf("percobaan %d: err = %q, want memuat %q", i+1, err.Error(), w)
		}
	}

	// Percobaan keempat: batas terlampaui dan record dihapus.
	_, err := svc.VerifyOTP("u@t.test", "999999", "registration")
	if err == nil || !strings.Contains(err.Error(), "batas percobaan") {
		t.Fatalf("percobaan keempat: err = %v, want batas percobaan", err)
	}

	var count int64
	db.Model(&models.EmailVerificationOTP{}).Count(&count)
	if count != 0 {
		t.Errorf("record OTP = %d, want 0 setelah batas percobaan", count)
	}
}

func TestVerifyOTP_KodeKedaluwarsa(t *testing.T) {
	db := otpTestDB(t)
	svc := InitOTPService(db)
	seedOTP(t, db, "exp@t.test", "222222", "registration", -1*time.Minute)

	_, err := svc.VerifyOTP("exp@t.test", "222222", "registration")
	if err == nil || !strings.Contains(err.Error(), "kedaluwarsa") {
		t.Fatalf("err = %v, want kedaluwarsa", err)
	}

	var count int64
	db.Model(&models.EmailVerificationOTP{}).Count(&count)
	if count != 0 {
		t.Errorf("record kedaluwarsa harus dihapus, tersisa %d", count)
	}
}

func TestVerifyOTP_SuksesMengembalikanTokenSekaliPakai(t *testing.T) {
	db := otpTestDB(t)
	svc := InitOTPService(db)
	seedOTP(t, db, "ok@t.test", "333333", "registration", 5*time.Minute)

	token, err := svc.VerifyOTP("ok@t.test", "333333", "registration")
	if err != nil {
		t.Fatalf("kode benar seharusnya lolos: %v", err)
	}
	if !strings.HasPrefix(token, "vt_") {
		t.Errorf("token = %q, want berawalan vt_", token)
	}

	var rec models.EmailVerificationOTP
	if err := db.Where("email = ?", "ok@t.test").First(&rec).Error; err != nil {
		t.Fatalf("baca record: %v", err)
	}
	if rec.Token != token {
		t.Errorf("token di DB = %q, want %q", rec.Token, token)
	}
	// Token diberi 15 menit untuk menyelesaikan form.
	if d := time.Until(rec.ExpiresAt); d < 14*time.Minute || d > 16*time.Minute {
		t.Errorf("masa berlaku token = %v, want ~15 menit", d)
	}
}

func TestVerifyOTP_EmailDinormalisasi(t *testing.T) {
	db := otpTestDB(t)
	svc := InitOTPService(db)
	seedOTP(t, db, "norm@t.test", "444444", "registration", 5*time.Minute)

	if _, err := svc.VerifyOTP("  NORM@T.TEST  ", " 444444 ", "registration"); err != nil {
		t.Fatalf("email/kode dengan spasi & huruf besar harus lolos: %v", err)
	}
}

func TestVerifyOTP_InputKosongDanTidakAdaRecord(t *testing.T) {
	db := otpTestDB(t)
	svc := InitOTPService(db)

	if _, err := svc.VerifyOTP("", "123456", "registration"); err == nil {
		t.Error("email kosong harus ditolak")
	}
	if _, err := svc.VerifyOTP("a@b.test", "", "registration"); err == nil {
		t.Error("kode kosong harus ditolak")
	}
	if _, err := svc.VerifyOTP("none@t.test", "123456", "registration"); err == nil {
		t.Error("tanpa record harus ditolak")
	}
}

func TestVerifyOTP_PurposeTerpisah(t *testing.T) {
	db := otpTestDB(t)
	svc := InitOTPService(db)
	seedOTP(t, db, "p@t.test", "555555", "registration", 5*time.Minute)

	// Kode registrasi tidak boleh dipakai untuk reset password.
	if _, err := svc.VerifyOTP("p@t.test", "555555", "password_reset"); err == nil {
		t.Error("purpose berbeda harus ditolak")
	}
	if _, err := svc.VerifyOTP("p@t.test", "555555", "registration"); err != nil {
		t.Fatalf("purpose yang benar harus lolos: %v", err)
	}
}

// --- ValidateAndConsumeToken ----------------------------------------------

func TestValidateAndConsumeToken_SekaliPakai(t *testing.T) {
	db := otpTestDB(t)
	svc := InitOTPService(db)
	seedOTP(t, db, "c@t.test", "666666", "registration", 5*time.Minute)

	token, err := svc.VerifyOTP("c@t.test", "666666", "registration")
	if err != nil {
		t.Fatalf("verify: %v", err)
	}

	if !svc.ValidateAndConsumeToken("c@t.test", token, "registration") {
		t.Fatal("token pertama harus diterima")
	}
	if svc.ValidateAndConsumeToken("c@t.test", token, "registration") {
		t.Error("token yang sudah dipakai tidak boleh diterima lagi")
	}
}

// Regresi TOCTOU: sebelumnya SELECT lalu DELETE terpisah, sehingga dua request
// bersamaan dengan token yang sama bisa sama-sama lolos. Konsumsi sekarang satu
// statement DELETE dengan syarat validasi; hanya satu pemanggil boleh menang.
func TestValidateAndConsumeToken_BalapanHanyaSatuMenang(t *testing.T) {
	db := otpTestDB(t)
	svc := InitOTPService(db)
	seedOTP(t, db, "race@t.test", "777777", "registration", 5*time.Minute)

	token, err := svc.VerifyOTP("race@t.test", "777777", "registration")
	if err != nil {
		t.Fatalf("verify: %v", err)
	}

	const n = 8
	var wg sync.WaitGroup
	var mu sync.Mutex
	menang := 0
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if svc.ValidateAndConsumeToken("race@t.test", token, "registration") {
				mu.Lock()
				menang++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	if menang != 1 {
		t.Errorf("pemenang = %d, want tepat 1 (token sekali pakai)", menang)
	}
}

func TestValidateAndConsumeToken_KondisiTidakSah(t *testing.T) {
	db := otpTestDB(t)
	svc := InitOTPService(db)
	seedOTP(t, db, "v@t.test", "888888", "registration", 5*time.Minute)

	token, _ := svc.VerifyOTP("v@t.test", "888888", "registration")

	if svc.ValidateAndConsumeToken("", token, "registration") {
		t.Error("email kosong harus ditolak")
	}
	if svc.ValidateAndConsumeToken("v@t.test", "", "registration") {
		t.Error("token kosong harus ditolak")
	}
	if svc.ValidateAndConsumeToken("v@t.test", "vt_palsu", "registration") {
		t.Error("token karangan harus ditolak")
	}
	if svc.ValidateAndConsumeToken("lain@t.test", token, "registration") {
		t.Error("email lain harus ditolak")
	}
	if svc.ValidateAndConsumeToken("v@t.test", token, "password_reset") {
		t.Error("purpose lain harus ditolak")
	}
	// Token asli tetap berlaku setelah percobaan gagal di atas.
	if !svc.ValidateAndConsumeToken("v@t.test", token, "registration") {
		t.Error("token sah harus tetap diterima")
	}
}

func TestValidateAndConsumeToken_TokenKedaluwarsa(t *testing.T) {
	db := otpTestDB(t)
	svc := InitOTPService(db)

	rec := models.EmailVerificationOTP{
		Email:     "x@t.test",
		OTPHash:   hashOTP("999999"),
		Purpose:   "registration",
		Token:     "vt_expired",
		ExpiresAt: time.Now().Add(-1 * time.Minute),
		CreatedAt: time.Now(),
	}
	if err := db.Create(&rec).Error; err != nil {
		t.Fatalf("seed: %v", err)
	}

	if svc.ValidateAndConsumeToken("x@t.test", "vt_expired", "registration") {
		t.Error("token kedaluwarsa harus ditolak")
	}
}

// --- generateAndSendOTP ----------------------------------------------------

func TestGenerateAndSendOTP_CooldownEnamPuluhDetik(t *testing.T) {
	db := otpTestDB(t)
	svc := InitOTPService(db)

	if _, err := svc.GenerateAndSendRegistrationOTP("cd@t.test", "Budi"); err != nil {
		t.Fatalf("permintaan pertama: %v", err)
	}

	_, err := svc.GenerateAndSendRegistrationOTP("cd@t.test", "Budi")
	if err == nil || !strings.Contains(err.Error(), "mohon tunggu") {
		t.Fatalf("permintaan kedua: err = %v, want cooldown", err)
	}
}

func TestGenerateAndSendOTP_MenggantikanKodeLama(t *testing.T) {
	db := otpTestDB(t)
	svc := InitOTPService(db)

	// Record lama yang sudah lewat cooldown tapi belum kedaluwarsa.
	lama := models.EmailVerificationOTP{
		Email:     "sup@t.test",
		OTPHash:   hashOTP("000000"),
		Purpose:   "registration",
		ExpiresAt: time.Now().Add(3 * time.Minute),
		CreatedAt: time.Now().Add(-2 * time.Minute),
	}
	if err := db.Create(&lama).Error; err != nil {
		t.Fatalf("seed lama: %v", err)
	}

	if _, err := svc.GenerateAndSendRegistrationOTP("sup@t.test", "Sari"); err != nil {
		t.Fatalf("generate: %v", err)
	}

	var sisa []models.EmailVerificationOTP
	db.Where("email = ? AND purpose = ?", "sup@t.test", "registration").Find(&sisa)
	if len(sisa) != 1 {
		t.Fatalf("jumlah record = %d, want 1 (kode lama digantikan)", len(sisa))
	}
	if sisa[0].OTPHash == hashOTP("000000") {
		t.Error("kode lama seharusnya sudah tidak berlaku")
	}
}

func TestGenerateAndSendOTP_EmailKosongDitolak(t *testing.T) {
	db := otpTestDB(t)
	svc := InitOTPService(db)

	if _, err := svc.GenerateAndSendRegistrationOTP("", "X"); err == nil {
		t.Error("email kosong harus ditolak")
	}
	if _, err := svc.GenerateAndSendPasswordResetOTP("   ", "X"); err == nil {
		t.Error("email spasi harus ditolak")
	}
}

func TestGetOTPService(t *testing.T) {
	db := otpTestDB(t)
	svc := InitOTPService(db)
	if GetOTPService() != svc {
		t.Error("GetOTPService harus mengembalikan instance terakhir")
	}
}
