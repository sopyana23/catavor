// Package mfa mengimplementasikan verifikasi faktor kedua berbasis TOTP dan
// backup code untuk akun Catavor.
//
// Keputusan desain penting:
//   - PostgreSQL adalah otoritas lockout dan konsumsi backup code. Redis tidak
//     dipakai di jalur ini supaya lockout tetap benar saat Redis tidak tersedia
//     (mode fallback lokal) maupun saat instance di-restart.
//   - Challenge disimpan sebagai JWT berumur pendek dan TIDAK memberi akses API:
//     token itu hanya bisa ditukar di /api/auth/mfa/verify.
//   - Penghitungan percobaan faktor salah bersifat idempotent per JTI lewat
//     mfa_challenge_failures, sehingga retry dengan challenge yang sama tidak
//     menggandakan hitungan lockout.
package mfa

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"catavor-backend/internal/models"
	"catavor-backend/internal/security"

	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

const (
	// ChallengePurpose menandai token khusus MFA agar tidak pernah diterima
	// sebagai token sesi biasa.
	ChallengePurpose = "mfa_challenge"
	// ChallengeTTL membatasi usia challenge; pengguna hanya butuh beberapa detik
	// untuk mengetik kode.
	ChallengeTTL = 5 * time.Minute

	// MaxFailedAttempts dan LockoutDuration menentukan kebijakan lockout faktor
	// kedua. Nilainya sengaja lebih ketat dari login kata sandi (5/15 menit)
	// karena kode TOTP hanya 6 digit.
	MaxFailedAttempts = 5
	FailureWindow     = 15 * time.Minute
	LockoutDuration   = 15 * time.Minute

	FactorTOTP       = "totp"
	FactorBackupCode = "backup_code"
)

var (
	ErrChallengeInvalid = errors.New("mfa: challenge tidak valid atau kedaluwarsa")
	ErrFactorLocked     = errors.New("mfa: faktor kedua sementara dikunci")
	ErrFactorInvalid    = errors.New("mfa: kode faktor kedua salah")
	ErrReplay           = errors.New("mfa: kode sudah pernah dipakai")
	ErrNotEnrolled      = errors.New("mfa: akun belum mengaktifkan faktor kedua")
	ErrFactorDisabled   = errors.New("mfa: faktor tidak cocok dengan konfigurasi akun")
)

// ChallengeClaims adalah payload token MFA.
type ChallengeClaims struct {
	UserID    uint   `json:"uid"`
	Purpose   string `json:"purpose"`
	StoreSlug string `json:"store_slug,omitempty"`
	jwt.RegisteredClaims
}

// IssueChallenge membuat challenge JWT berumur pendek untuk satu user.
func IssueChallenge(secret string, userID uint, now time.Time, requestedStoreSlug ...string) (token, jti string, expiresAt time.Time, err error) {
	if userID == 0 {
		return "", "", time.Time{}, ErrChallengeInvalid
	}
	jti = fmt.Sprintf("mfa-%d-%d", userID, now.UnixNano())
	expiresAt = now.Add(ChallengeTTL)
	storeSlug := ""
	if len(requestedStoreSlug) > 0 {
		storeSlug = strings.TrimSpace(requestedStoreSlug[0])
	}
	claims := ChallengeClaims{
		UserID:    userID,
		Purpose:   ChallengePurpose,
		StoreSlug: storeSlug,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			Subject:   fmt.Sprintf("%d", userID),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now.Add(-30 * time.Second)),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}
	token, err = jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		return "", "", time.Time{}, err
	}
	return token, jti, expiresAt, nil
}

// ParseChallenge memvalidasi signature, umur, dan purpose token.
func ParseChallenge(secret, tokenString string, now time.Time) (*ChallengeClaims, error) {
	claims := &ChallengeClaims{}
	parsed, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("mfa: algoritma token tak didukung: %s", t.Method.Alg())
		}
		return []byte(secret), nil
	}, jwt.WithTimeFunc(func() time.Time { return now }))
	if err != nil || parsed == nil || !parsed.Valid {
		return nil, ErrChallengeInvalid
	}
	if claims.Purpose != ChallengePurpose {
		return nil, ErrChallengeInvalid
	}
	if claims.UserID == 0 {
		return nil, ErrChallengeInvalid
	}
	if claims.ID == "" {
		return nil, ErrChallengeInvalid
	}
	return claims, nil
}

// LockoutState membaca status lockout durable untuk seorang user.
func LockoutState(db *gorm.DB, userID uint, now time.Time) (locked bool, until time.Time, err error) {
	var row models.MFAAccountLockout
	res := db.Where("user_id = ?", userID).Limit(1).Find(&row)
	if res.Error != nil {
		return false, time.Time{}, res.Error
	}
	if res.RowsAffected == 0 || row.LockedUntil == nil {
		return false, time.Time{}, nil
	}
	if now.Before(*row.LockedUntil) {
		return true, *row.LockedUntil, nil
	}
	return false, time.Time{}, nil
}

// resetFailures menghapus state lockout setelah verifikasi sukses.
func resetFailures(db *gorm.DB, userID uint, now time.Time) {
	_ = db.Where("user_id = ?", userID).Delete(&models.MFAAccountLockout{}).Error
	_ = now
}

// recordFailure mencatat satu kegagalan untuk sebuah JTI secara idempotent lalu
// memperbarui lockout. Boolean kedua menandakan akun kini terkunci.
func recordFailure(db *gorm.DB, jti string, userID uint, now time.Time) (bool, error) {
	if jti == "" {
		return false, nil
	}
	// Idempotensi: hanya hitungan pertama untuk (jti, generasi) yang menambah
	// counter. Retry dengan challenge sama tidak menggandakan percobaan.
	entry := models.MFAChallengeFailure{TokenJTI: jti, LeaseGeneration: 1, UserID: userID, CreatedAt: now}
	res := db.Where("token_jti = ? AND lease_generation = ?", jti, int64(1)).FirstOrCreate(&entry)
	if res.Error != nil {
		return false, res.Error
	}
	created := res.RowsAffected > 0

	var lock models.MFAAccountLockout
	findRes := db.Where("user_id = ?", userID).Limit(1).Find(&lock)
	if findRes.Error != nil {
		return false, findRes.Error
	}

	if findRes.RowsAffected == 0 {
		lock = models.MFAAccountLockout{
			UserID:          userID,
			FailedAttempts:  0,
			WindowStartedAt: now,
			UpdatedAt:       now,
		}
	}

	// Jendela kedaluwarsa: mulai hitungan baru.
	if lock.WindowStartedAt.IsZero() || now.Sub(lock.WindowStartedAt) > FailureWindow {
		lock.WindowStartedAt = now
		lock.FailedAttempts = 0
		lock.LockedUntil = nil
	}

	if created {
		lock.FailedAttempts++
	}
	if lock.FailedAttempts >= MaxFailedAttempts {
		until := now.Add(LockoutDuration)
		lock.LockedUntil = &until
	}
	lock.UpdatedAt = now

	if findRes.RowsAffected == 0 {
		if err := db.Create(&lock).Error; err != nil {
			return false, err
		}
	} else if err := db.Save(&lock).Error; err != nil {
		return false, err
	}

	return lock.LockedUntil != nil && now.Before(*lock.LockedUntil), nil
}

// VerifyTOTPFactor memeriksa kode TOTP dan menolak replay langkah waktu yang
// sudah dipakai. Mengembalikan ErrFactorLocked bila akun terkunci.
func VerifyTOTPFactor(db *gorm.DB, keyMaterial string, user *models.User, code, jti string, now time.Time) error {
	if user == nil || !user.TwoFactorEnabled {
		return ErrNotEnrolled
	}
	if user.TwoFactorSecretEnc == nil || strings.TrimSpace(*user.TwoFactorSecretEnc) == "" {
		// Akun ditandai aktif tetapi rahasia tidak ada: jangan pernah lolos.
		return ErrNotEnrolled
	}

	locked, _, err := LockoutState(db, user.ID, now)
	if err != nil {
		return err
	}
	if locked {
		return ErrFactorLocked
	}

	secret, err := security.OpenMFASecret(keyMaterial, *user.TwoFactorSecretEnc)
	if err != nil {
		return err
	}

	step, err := security.VerifyTOTP(secret, code, now)
	if err != nil {
		lockedNow, recErr := recordFailure(db, jti, user.ID, now)
		if recErr != nil {
			return recErr
		}
		if lockedNow {
			return ErrFactorLocked
		}
		return ErrFactorInvalid
	}

	if step <= user.TwoFactorLastTOTPStep {
		lockedNow, recErr := recordFailure(db, jti, user.ID, now)
		if recErr != nil {
			return recErr
		}
		if lockedNow {
			return ErrFactorLocked
		}
		return ErrReplay
	}

	// Update kondisional: hanya satu request yang boleh memenangkan langkah ini.
	res := db.Model(&models.User{}).
		Where("id = ? AND two_factor_last_totp_step < ?", user.ID, step).
		Update("two_factor_last_totp_step", step)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrReplay
	}

	user.TwoFactorLastTOTPStep = step
	resetFailures(db, user.ID, now)
	return nil
}

// VerifyBackupCodeFactor mengonsumsi satu kode cadangan secara atomik.
func VerifyBackupCodeFactor(db *gorm.DB, keyMaterial string, user *models.User, code, jti string, now time.Time) error {
	if user == nil || !user.TwoFactorEnabled {
		return ErrNotEnrolled
	}
	if user.TwoFactorBackupCodesHash == nil || strings.TrimSpace(*user.TwoFactorBackupCodesHash) == "" {
		return ErrFactorDisabled
	}

	locked, _, err := LockoutState(db, user.ID, now)
	if err != nil {
		return err
	}
	if locked {
		return ErrFactorLocked
	}

	var hashes []string
	if err := json.Unmarshal([]byte(*user.TwoFactorBackupCodesHash), &hashes); err != nil {
		return fmt.Errorf("mfa: data kode cadangan rusak: %w", err)
	}

	idx := security.MatchBackupCodeHash(keyMaterial, code, hashes)
	if idx < 0 {
		lockedNow, recErr := recordFailure(db, jti, user.ID, now)
		if recErr != nil {
			return recErr
		}
		if lockedNow {
			return ErrFactorLocked
		}
		return ErrFactorInvalid
	}

	remaining := append(append([]string{}, hashes[:idx]...), hashes[idx+1:]...)
	encoded, err := json.Marshal(remaining)
	if err != nil {
		return err
	}

	// Konsumsi atomic: cocokkan pada nilai lama supaya dua request paralel
	// dengan kode yang sama tidak sama-sama berhasil.
	res := db.Model(&models.User{}).
		Where("id = ? AND two_factor_backup_codes_hash = ?", user.ID, *user.TwoFactorBackupCodesHash).
		Update("two_factor_backup_codes_hash", string(encoded))
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrFactorInvalid
	}

	updated := string(encoded)
	user.TwoFactorBackupCodesHash = &updated
	resetFailures(db, user.ID, now)
	return nil
}

// EncodeBackupCodeHashes menyimpan hash dalam bentuk JSON array agar konsisten
// dengan kolom TEXT dan mudah dikonsumsi ulang.
func EncodeBackupCodeHashes(hashes []string) (string, error) {
	b, err := json.Marshal(hashes)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
