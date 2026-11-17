package mfa

import (
	"strings"
	"testing"
	"time"

	"catavor-backend/internal/models"
	"catavor-backend/internal/security"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const (
	testKey   = "unit-test-mfa-key-material-0123456789abcdef"
	testJWT   = "unit-test-challenge-secret-0123456789abcdef"
	fixedUnix = int64(1_700_000_000)
)

func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := "file:mfa_test_" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.UserSession{}, &models.MFAAuthCompletion{}, &models.MFAAccountLockout{}, &models.MFAChallengeFailure{}); err != nil {
		t.Fatalf("automigrate: %v", err)
	}
	return db
}

// enrolledUser membuat user dengan faktor kedua aktif dan secret terenkripsi.
func enrolledUser(t *testing.T, db *gorm.DB) (*models.User, string) {
	t.Helper()
	secret, err := security.GenerateTOTPSecret()
	if err != nil {
		t.Fatal(err)
	}
	sealed, err := security.SealMFASecret(testKey, secret)
	if err != nil {
		t.Fatal(err)
	}
	user := models.User{
		Name:               "Uji MFA",
		Email:              "mfa@example.test",
		Password:           "x",
		TwoFactorEnabled:   true,
		TwoFactorSecretEnc: &sealed,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	return &user, secret
}

func TestIssueAndParseChallengeRejectsWrongPurposeAndExpiry(t *testing.T) {
	now := time.Unix(fixedUnix, 0).UTC()

	token, jti, exp, err := IssueChallenge(testJWT, 42, now)
	if err != nil {
		t.Fatal(err)
	}
	if jti == "" || !exp.After(now) {
		t.Fatalf("challenge tidak lengkap: jti=%q exp=%v", jti, exp)
	}

	claims, err := ParseChallenge(testJWT, token, now)
	if err != nil {
		t.Fatalf("challenge valid harus bisa diparse: %v", err)
	}
	if claims.UserID != 42 || claims.ID != jti {
		t.Fatalf("claims salah: %+v", claims)
	}

	if _, err := ParseChallenge("secret-lain-yang-cukup-panjang-0123456789", token, now); err == nil {
		t.Error("signature salah harus ditolak")
	}
	if _, err := ParseChallenge(testJWT, token, now.Add(ChallengeTTL+time.Second)); err == nil {
		t.Error("challenge kedaluwarsa harus ditolak")
	}
}

// TestChallengeTokenIsNotAValidSessionToken memastikan token challenge tidak
// bisa dipakai sebagai sesi: purpose-nya beda dan middleware sesi memakai
// klaim user_id, bukan uid.
func TestChallengeTokenIsNotAValidSessionToken(t *testing.T) {
	now := time.Unix(fixedUnix, 0).UTC()
	token, _, _, err := IssueChallenge(testJWT, 7, now)
	if err != nil {
		t.Fatal(err)
	}
	claims, err := ParseChallenge(testJWT, token, now)
	if err != nil {
		t.Fatal(err)
	}
	if claims.Purpose == "" || claims.Purpose == "session" {
		t.Fatalf("purpose challenge harus khusus, dapat %q", claims.Purpose)
	}
}

func TestVerifyTOTPFactorHappyPathAndReplayRejection(t *testing.T) {
	db := newTestDB(t)
	user, secret := enrolledUser(t, db)
	now := time.Unix(fixedUnix, 0).UTC()

	code, err := security.GenerateTOTPCode(secret, security.TOTPStepAt(now))
	if err != nil {
		t.Fatal(err)
	}

	if err := VerifyTOTPFactor(db, testKey, user, code, "jti-happy", now); err != nil {
		t.Fatalf("kode benar harus lolos: %v", err)
	}

	// Kode sama pada challenge berbeda = replay, harus ditolak.
	if err := VerifyTOTPFactor(db, testKey, user, code, "jti-replay", now); err == nil {
		t.Fatal("replay kode TOTP harus ditolak")
	}
}

func TestVerifyTOTPFactorLockoutAfterMaxFailures(t *testing.T) {
	db := newTestDB(t)
	user, secret := enrolledUser(t, db)
	now := time.Unix(fixedUnix, 0).UTC()

	for i := 0; i < MaxFailedAttempts-1; i++ {
		err := VerifyTOTPFactor(db, testKey, user, "000000", "jti-fail-"+string(rune('a'+i)), now)
		if err != ErrFactorInvalid {
			t.Fatalf("percobaan %d: expected ErrFactorInvalid, dapat %v", i+1, err)
		}
	}

	// Pukulan terakhir mengunci akun.
	err := VerifyTOTPFactor(db, testKey, user, "000000", "jti-fail-last", now)
	if err != ErrFactorLocked {
		t.Fatalf("percobaan ke-%d harus mengunci, dapat %v", MaxFailedAttempts, err)
	}

	locked, until, err := LockoutState(db, user.ID, now)
	if err != nil || !locked {
		t.Fatalf("lockout harus tercatat durable: locked=%v err=%v", locked, err)
	}
	if !until.After(now) {
		t.Errorf("locked_until harus di masa depan, dapat %v", until)
	}

	// Selama terkunci, kode yang BENAR pun ditolak.
	code, _ := security.GenerateTOTPCode(secret, security.TOTPStepAt(now))
	if err := VerifyTOTPFactor(db, testKey, user, code, "jti-during-lock", now); err != ErrFactorLocked {
		t.Fatalf("kode benar saat terkunci harus ditolak dengan ErrFactorLocked, dapat %v", err)
	}
}

// TestRetrySameChallengeDoesNotDoubleCountLockout menguji idempotensi:
// retry dengan JTI yang sama tidak boleh menambah counter.
func TestRetrySameChallengeDoesNotDoubleCountLockout(t *testing.T) {
	db := newTestDB(t)
	user, _ := enrolledUser(t, db)
	now := time.Unix(fixedUnix, 0).UTC()

	for i := 0; i < 10; i++ {
		_ = VerifyTOTPFactor(db, testKey, user, "000000", "jti-sama", now)
	}

	var row models.MFAAccountLockout
	if err := db.Where("user_id = ?", user.ID).First(&row).Error; err != nil {
		t.Fatalf("lockout row harus ada: %v", err)
	}
	if row.FailedAttempts != 1 {
		t.Fatalf("retry JTI sama harus dihitung sekali, dapat %d", row.FailedAttempts)
	}

	var ledger int64
	db.Model(&models.MFAChallengeFailure{}).Where("user_id = ?", user.ID).Count(&ledger)
	if ledger != 1 {
		t.Fatalf("ledger harus 1 baris, dapat %d", ledger)
	}
}

func TestVerifyBackupCodeSingleUse(t *testing.T) {
	db := newTestDB(t)
	user, secret := enrolledUser(t, db)
	now := time.Unix(fixedUnix, 0).UTC()

	codes, hashes, err := security.GenerateBackupCodes(testKey, 3)
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := EncodeBackupCodeHashes(hashes)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Model(user).Update("two_factor_backup_codes_hash", encoded).Error; err != nil {
		t.Fatal(err)
	}
	user.TwoFactorBackupCodesHash = &encoded

	if err := VerifyBackupCodeFactor(db, testKey, user, codes[0], "jti-bc-1", now); err != nil {
		t.Fatalf("kode cadangan valid harus lolos: %v", err)
	}

	// Pemakaian kedua harus gagal — kode sudah dikonsumsi.
	if err := VerifyBackupCodeFactor(db, testKey, user, codes[0], "jti-bc-2", now); err != ErrFactorInvalid {
		t.Fatalf("kode cadangan bekas harus ditolak, dapat %v", err)
	}

	// Kode lain masih berlaku.
	if err := VerifyBackupCodeFactor(db, testKey, user, codes[1], "jti-bc-3", now); err != nil {
		t.Fatalf("kode cadangan kedua harus lolos: %v", err)
	}

	// TOTP tetap jalan setelah backup code dipakai (secret tidak berubah).
	totp, _ := security.GenerateTOTPCode(secret, security.TOTPStepAt(now))
	if err := VerifyTOTPFactor(db, testKey, user, totp, "jti-bc-totp", now); err != nil {
		t.Fatalf("TOTP harus tetap valid: %v", err)
	}
}

func TestVerifyTOTPFactorRejectsUnenrolledUser(t *testing.T) {
	db := newTestDB(t)
	user := models.User{Name: "No MFA", Email: "nomfa@example.test", Password: "x"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	now := time.Unix(fixedUnix, 0).UTC()
	if err := VerifyTOTPFactor(db, testKey, &user, "123456", "jti", now); err != ErrNotEnrolled {
		t.Fatalf("user tanpa MFA harus ErrNotEnrolled, dapat %v", err)
	}

	// Flag aktif tapi secret hilang: fail closed.
	user.TwoFactorEnabled = true
	if err := VerifyTOTPFactor(db, testKey, &user, "123456", "jti", now); err != ErrNotEnrolled {
		t.Fatalf("secret hilang harus fail closed, dapat %v", err)
	}
}

func TestLockoutExpiresAndResets(t *testing.T) {
	db := newTestDB(t)
	user, secret := enrolledUser(t, db)
	now := time.Unix(fixedUnix, 0).UTC()

	for i := 0; i < MaxFailedAttempts; i++ {
		_ = VerifyTOTPFactor(db, testKey, user, "000000", "jti-x-"+string(rune('a'+i)), now)
	}
	locked, _, _ := LockoutState(db, user.ID, now)
	if !locked {
		t.Fatal("harus terkunci setelah percobaan maksimum")
	}

	later := now.Add(LockoutDuration + time.Second)
	locked, _, err := LockoutState(db, user.ID, later)
	if err != nil {
		t.Fatal(err)
	}
	if locked {
		t.Fatal("lockout harus kedaluwarsa")
	}

	code, _ := security.GenerateTOTPCode(secret, security.TOTPStepAt(later))
	if err := VerifyTOTPFactor(db, testKey, user, code, "jti-after-lock", later); err != nil {
		t.Fatalf("setelah lockout berakhir kode benar harus lolos: %v", err)
	}
}

func TestSetupTokenAndPendingEnrollmentBinding(t *testing.T) {
	now := time.Unix(fixedUnix, 0).UTC()

	setupTok, setupJTI, _, err := IssueSetupToken(testJWT, 99, 2, now)
	if err != nil || setupJTI == "" {
		t.Fatalf("IssueSetupToken: %v", err)
	}
	// Token setup tidak boleh diterima sebagai challenge MFA dan sebaliknya.
	if _, err := ParseChallenge(testJWT, setupTok, now); err == nil {
		t.Fatal("setup_token tidak boleh lolos ParseChallenge (audience terpisah)")
	}
	chTok, _, _, err := IssueChallengeWithVersion(testJWT, 99, 2, now, "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ParseSetupToken(testJWT, chTok, now); err == nil {
		t.Fatal("challenge token tidak boleh lolos ParseSetupToken (audience terpisah)")
	}

	pending, _, err := NewPendingSetupJTI(99, now)
	if err != nil {
		t.Fatal(err)
	}
	if len(pending) > 64 {
		t.Fatalf("pending setup JTI melebihi VARCHAR(64): len=%d", len(pending))
	}
	if err := ValidatePendingSetupJTI(pending, 99, now); err != nil {
		t.Fatalf("pending setup valid ditolak: %v", err)
	}
	if err := ValidatePendingSetupJTI(pending, 100, now); err == nil {
		t.Fatal("pending setup milik user lain wajib ditolak")
	}
	if err := ValidatePendingSetupJTI(pending, 99, now.Add(PendingEnrollmentTTL+2*time.Second)); err == nil {
		t.Fatal("pending setup kedaluwarsa wajib ditolak")
	}
}

func TestRedeemChallengeCommitHookErrorRollsBackFactorConsumption(t *testing.T) {
	db := newTestDB(t)
	user, secret := enrolledUser(t, db)
	user.TokenVersion = 1
	db.Save(user)

	now := time.Unix(fixedUnix, 0).UTC()
	chTok, _, _, err := IssueChallengeWithVersion(testJWT, user.ID, 1, now, "toko-uji")
	if err != nil {
		t.Fatal(err)
	}
	claims, err := ParseChallenge(testJWT, chTok, now)
	if err != nil {
		t.Fatal(err)
	}
	code, _ := security.GenerateTOTPCode(secret, security.TOTPStepAt(now))

	// Simulasi kegagalan penyimpanan sesi di dalam commitHook -> faktor TIDAK boleh terbakar.
	_, _, err = RedeemChallenge(db, testKey, claims, FactorTOTP, code, now, func(tx *gorm.DB, lockedUser *models.User) (uint, string, error) {
		return 0, "", ErrStorageUnavailable
	})
	if err == nil {
		t.Fatal("RedeemChallenge wajib gagal bila commitHook gagal")
	}

	var reloaded models.User
	db.First(&reloaded, user.ID)
	if reloaded.TwoFactorLastTOTPStep != 0 {
		t.Fatalf("rollback gagal: TwoFactorLastTOTPStep berubah menjadi %d", reloaded.TwoFactorLastTOTPStep)
	}

	// Retry dengan kode & challenge yang sama ketika penyimpanan sesi pulih harus berhasil satu kali.
	_, _, err = RedeemChallenge(db, testKey, claims, FactorTOTP, code, now, func(tx *gorm.DB, lockedUser *models.User) (uint, string, error) {
		sess := models.UserSession{
			UserID:    lockedUser.ID,
			TokenID:   "tok-ok-1",
			ExpiresAt: now.Add(time.Hour),
			CreatedAt: now,
		}
		if err := tx.Create(&sess).Error; err != nil {
			return 0, "", err
		}
		return sess.ID, sess.TokenID, nil
	})
	if err != nil {
		t.Fatalf("RedeemChallenge seharusnya sukses setelah pulih: %v", err)
	}

	// Penukaran ulang JTI yang sama wajib ditolak ErrChallengeRedeemed.
	nextCode, _ := security.GenerateTOTPCode(secret, security.TOTPStepAt(now.Add(30*time.Second)))
	_, _, err = RedeemChallenge(db, testKey, claims, FactorTOTP, nextCode, now.Add(30*time.Second), func(tx *gorm.DB, lockedUser *models.User) (uint, string, error) {
		return 999, "tok-never", nil
	})
	if err == nil {
		t.Fatal("JTI challenge bekas tidak boleh ditukarkan ulang")
	}
}
