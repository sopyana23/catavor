// Package mfa mengimplementasikan kebijakan terpusat, penerbitan token
// berumur pendek (challenge & onboarding setup), lockout durable, serta
// penukaran faktor kedua yang atomik dan sekali pakai di atas PostgreSQL.
package mfa

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"catavor-backend/internal/models"
	"catavor-backend/internal/security"

	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	TokenIssuer = "catavor-saas"

	// ChallengePurpose dan ChallengeAudience memisahkan token challenge dari
	// sesi penuh (catavor-web) maupun token setup onboarding.
	ChallengePurpose  = "mfa_challenge"
	ChallengeAudience = "catavor-mfa-challenge"
	ChallengeTTL      = 5 * time.Minute

	// SetupPurpose dan SetupAudience membatasi kredensial staf yang belum
	// mengaktifkan MFA agar HANYA dapat mengakses endpoint pendaftaran 2FA.
	SetupPurpose          = "mfa_setup"
	SetupAudience         = "catavor-mfa-enrollment"
	SetupTTL              = 10 * time.Minute
	PendingEnrollmentTTL  = 10 * time.Minute
	FreshReauthMaxAge     = 10 * time.Minute
	MaxChallengeFailures  = 3
	MaxFailedAttempts     = 5
	FailureWindow         = 15 * time.Minute
	LockoutDuration       = 15 * time.Minute

	FactorTOTP       = "totp"
	FactorBackupCode = "backup_code"
)

var (
	ErrChallengeInvalid    = errors.New("mfa: challenge tidak valid atau kedaluwarsa")
	ErrChallengeRedeemed   = fmt.Errorf("%w: challenge sudah pernah digunakan", ErrChallengeInvalid)
	ErrChallengeExhausted  = fmt.Errorf("%w: batas percobaan challenge terlampaui", ErrChallengeInvalid)
	ErrSetupTokenInvalid   = errors.New("mfa: token pendaftaran MFA tidak valid atau kedaluwarsa")
	ErrPendingSetupInvalid = errors.New("mfa: sesi pendaftaran MFA tidak valid atau sudah kedaluwarsa")
	ErrFactorLocked        = errors.New("mfa: faktor kedua sementara dikunci")
	ErrFactorInvalid       = errors.New("mfa: kode faktor kedua salah")
	ErrReplay              = errors.New("mfa: kode sudah pernah dipakai")
	ErrNotEnrolled         = errors.New("mfa: akun belum mengaktifkan faktor kedua")
	ErrFactorDisabled      = errors.New("mfa: faktor tidak cocok dengan konfigurasi akun")
	ErrStorageUnavailable  = errors.New("mfa: penyimpanan atau konfigurasi MFA tidak tersedia")
	ErrAccountBanned       = errors.New("mfa: akun dinonaktifkan")
)

// IsMFAMandatory melaporkan apakah akun wajib menggunakan MFA berdasarkan role
// staf platform kanonik atau flag penegakan eksplisit pada akun.
func IsMFAMandatory(user *models.User) bool {
	if user == nil {
		return false
	}
	return user.IsPlatformStaff() || user.TwoFactorEnforced
}

// RequiresMFA melaporkan apakah akun harus melewati verifikasi faktor kedua
// sebelum sesi penuh diterbitkan. Untuk akun wajib-MFA (staf platform),
// kewajiban ini TIDAK pernah dimatikan oleh feature flag.
func RequiresMFA(user *models.User, mfaFeatureEnabled bool) bool {
	if user == nil {
		return false
	}
	if IsMFAMandatory(user) {
		return true
	}
	return user.TwoFactorEnabled && mfaFeatureEnabled
}

// GateAction merepresentasikan keputusan terpusat sebelum sesi penuh diterbitkan.
type GateAction int

const (
	GateAllowSession GateAction = iota
	GateRequireChallenge
	GateRequireSetup
	GateRejectLocked
	GateFailClosed
)

// LoginGateResult memuat hasil evaluasi kebijakan MFA pada jalur penerbitan sesi.
type LoginGateResult struct {
	Action      GateAction
	Token       string
	JTI         string
	ExpiresAt   time.Time
	LockedUntil time.Time
	Err         error
}

// EvaluateLoginGate menerapkan satu kebijakan MFA berbasis role untuk seluruh
// jalur penerbitan sesi (password, Google SSO, registrasi, reset sandi).
// Kegagalan konfigurasi, flag mati bagi akun wajib-MFA, atau kegagalan DB
// selalu menghasilkan GateFailClosed (tidak pernah menerbitkan sesi).
func EvaluateLoginGate(
	db *gorm.DB,
	user *models.User,
	mfaFeatureEnabled bool,
	keyMaterial string,
	jwtSecret string,
	now time.Time,
	requestedStoreSlug string,
) LoginGateResult {
	if user == nil || user.ID == 0 {
		return LoginGateResult{Action: GateFailClosed, Err: ErrStorageUnavailable}
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}

	mandatory := IsMFAMandatory(user)
	if !mandatory && (!user.TwoFactorEnabled || !mfaFeatureEnabled) {
		return LoginGateResult{Action: GateAllowSession}
	}

	// Mulai titik ini akun membutuhkan MFA (staf wajib, enforced, atau merchant opt-in aktif).
	if !mfaFeatureEnabled || db == nil || strings.TrimSpace(keyMaterial) == "" || strings.TrimSpace(jwtSecret) == "" {
		return LoginGateResult{Action: GateFailClosed, Err: ErrStorageUnavailable}
	}

	locked, until, err := LockoutState(db, user.ID, now)
	if err != nil {
		return LoginGateResult{Action: GateFailClosed, Err: err}
	}
	if locked {
		return LoginGateResult{Action: GateRejectLocked, LockedUntil: until, Err: ErrFactorLocked}
	}

	// Akun wajib-MFA (staf platform) yang belum terdaftar hanya mendapat
	// kapabilitas setup berumur pendek, bukan sesi penuh.
	if !user.TwoFactorEnabled {
		setupTok, setupJTI, exp, sErr := IssueSetupToken(jwtSecret, user.ID, user.TokenVersion, now)
		if sErr != nil {
			return LoginGateResult{Action: GateFailClosed, Err: sErr}
		}
		return LoginGateResult{
			Action:    GateRequireSetup,
			Token:     setupTok,
			JTI:       setupJTI,
			ExpiresAt: exp,
		}
	}

	// Akun ditandai aktif tetapi rahasia terenkripsi hilang: fail closed.
	if user.TwoFactorSecretEnc == nil || strings.TrimSpace(*user.TwoFactorSecretEnc) == "" {
		return LoginGateResult{Action: GateFailClosed, Err: ErrNotEnrolled}
	}

	challengeTok, jti, exp, cErr := IssueChallengeWithVersion(jwtSecret, user.ID, user.TokenVersion, now, requestedStoreSlug)
	if cErr != nil {
		return LoginGateResult{Action: GateFailClosed, Err: cErr}
	}
	return LoginGateResult{
		Action:    GateRequireChallenge,
		Token:     challengeTok,
		JTI:       jti,
		ExpiresAt: exp,
	}
}

// ChallengeClaims adalah payload token challenge MFA.
type ChallengeClaims struct {
	UserID       uint   `json:"uid"`
	Purpose      string `json:"purpose"`
	TokenVersion int    `json:"tv,omitempty"`
	StoreSlug    string `json:"store_slug,omitempty"`
	jwt.RegisteredClaims
}

// SetupClaims adalah payload token onboarding terbatas untuk staf tanpa MFA.
type SetupClaims struct {
	UserID       uint   `json:"uid"`
	Purpose      string `json:"purpose"`
	TokenVersion int    `json:"tv,omitempty"`
	jwt.RegisteredClaims
}

func randomHex(nBytes int) (string, error) {
	buf := make([]byte, nBytes)
	if _, err := io.ReadFull(rand.Reader, buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// IssueChallenge membuat challenge JWT berumur pendek untuk satu user.
func IssueChallenge(secret string, userID uint, now time.Time, requestedStoreSlug ...string) (token, jti string, expiresAt time.Time, err error) {
	return IssueChallengeWithVersion(secret, userID, 0, now, requestedStoreSlug...)
}

// IssueChallengeWithVersion membuat challenge JWT yang mengikat versi token akun.
func IssueChallengeWithVersion(secret string, userID uint, tokenVersion int, now time.Time, requestedStoreSlug ...string) (token, jti string, expiresAt time.Time, err error) {
	if userID == 0 || strings.TrimSpace(secret) == "" {
		return "", "", time.Time{}, ErrChallengeInvalid
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}
	rnd, err := randomHex(12)
	if err != nil {
		return "", "", time.Time{}, err
	}
	jti = fmt.Sprintf("mfa-%d-%s", userID, rnd)
	expiresAt = now.Add(ChallengeTTL)
	storeSlug := ""
	if len(requestedStoreSlug) > 0 {
		storeSlug = strings.TrimSpace(requestedStoreSlug[0])
	}
	claims := ChallengeClaims{
		UserID:       userID,
		Purpose:      ChallengePurpose,
		TokenVersion: tokenVersion,
		StoreSlug:    storeSlug,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			Issuer:    TokenIssuer,
			Audience:  jwt.ClaimStrings{ChallengeAudience},
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

// ParseChallenge memvalidasi signature, audience/issuer, umur, dan purpose token challenge.
func ParseChallenge(secret, tokenString string, now time.Time) (*ChallengeClaims, error) {
	if strings.TrimSpace(secret) == "" || strings.TrimSpace(tokenString) == "" {
		return nil, ErrChallengeInvalid
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}
	claims := &ChallengeClaims{}
	parsed, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("mfa: algoritma token tak didukung: %s", t.Method.Alg())
		}
		return []byte(secret), nil
	},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(TokenIssuer),
		jwt.WithAudience(ChallengeAudience),
		jwt.WithTimeFunc(func() time.Time { return now }),
	)
	if err != nil || parsed == nil || !parsed.Valid {
		return nil, ErrChallengeInvalid
	}
	if claims.Purpose != ChallengePurpose || claims.UserID == 0 || strings.TrimSpace(claims.ID) == "" {
		return nil, ErrChallengeInvalid
	}
	return claims, nil
}

// IssueSetupToken membuat token onboarding berumur pendek khusus untuk pendaftaran MFA staf.
func IssueSetupToken(secret string, userID uint, tokenVersion int, now time.Time) (token, jti string, expiresAt time.Time, err error) {
	if userID == 0 || strings.TrimSpace(secret) == "" {
		return "", "", time.Time{}, ErrSetupTokenInvalid
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}
	rnd, err := randomHex(12)
	if err != nil {
		return "", "", time.Time{}, err
	}
	if tokenVersion <= 0 {
		tokenVersion = 1
	}
	jti = fmt.Sprintf("setup-%d-%s", userID, rnd)
	expiresAt = now.Add(SetupTTL)
	claims := SetupClaims{
		UserID:       userID,
		Purpose:      SetupPurpose,
		TokenVersion: tokenVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			Issuer:    TokenIssuer,
			Audience:  jwt.ClaimStrings{SetupAudience},
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

// ParseSetupToken memvalidasi token onboarding staf secara ketat pada audience khusus.
func ParseSetupToken(secret, tokenString string, now time.Time) (*SetupClaims, error) {
	if strings.TrimSpace(secret) == "" || strings.TrimSpace(tokenString) == "" {
		return nil, ErrSetupTokenInvalid
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}
	claims := &SetupClaims{}
	parsed, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("mfa: algoritma setup token tak didukung: %s", t.Method.Alg())
		}
		return []byte(secret), nil
	},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(TokenIssuer),
		jwt.WithAudience(SetupAudience),
		jwt.WithTimeFunc(func() time.Time { return now }),
	)
	if err != nil || parsed == nil || !parsed.Valid {
		return nil, ErrSetupTokenInvalid
	}
	if claims.Purpose != SetupPurpose || claims.UserID == 0 || strings.TrimSpace(claims.ID) == "" {
		return nil, ErrSetupTokenInvalid
	}
	return claims, nil
}

// NewPendingSetupJTI membuat pengikat enrollment pending yang terikat ke userID,
// berumur pendek (10 menit), dan muat di kolom VARCHAR(64).
func NewPendingSetupJTI(userID uint, now time.Time) (string, time.Time, error) {
	if userID == 0 {
		return "", time.Time{}, ErrPendingSetupInvalid
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}
	rnd, err := randomHex(8)
	if err != nil {
		return "", time.Time{}, err
	}
	exp := now.Add(PendingEnrollmentTTL)
	jti := fmt.Sprintf("enr:%d:%d:%s", userID, exp.Unix(), rnd)
	return jti, exp, nil
}

// ValidatePendingSetupJTI memverifikasi bahwa pending enrollment milik userID
// yang sama dan belum melewati masa kedaluwarsa.
func ValidatePendingSetupJTI(stored string, userID uint, now time.Time) error {
	stored = strings.TrimSpace(stored)
	if stored == "" || userID == 0 {
		return ErrPendingSetupInvalid
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}
	parts := strings.Split(stored, ":")
	if len(parts) != 4 || parts[0] != "enr" || parts[3] == "" {
		return ErrPendingSetupInvalid
	}
	uid, err := strconv.ParseUint(parts[1], 10, 64)
	if err != nil || uint(uid) != userID {
		return ErrPendingSetupInvalid
	}
	expUnix, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil || now.Unix() > expUnix {
		return ErrPendingSetupInvalid
	}
	return nil
}

// IsTokenJTIUsed memeriksa apakah JTI sudah dikonsumsi di tabel mfa_auth_completions.
func IsTokenJTIUsed(db *gorm.DB, purpose, jti string) (bool, error) {
	if db == nil {
		return false, ErrStorageUnavailable
	}
	if strings.TrimSpace(purpose) == "" || strings.TrimSpace(jti) == "" {
		return false, nil
	}
	var existing models.MFAAuthCompletion
	res := db.Select("id").Where("purpose = ? AND token_jti = ?", purpose, jti).Limit(1).Find(&existing)
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected > 0, nil
}

// LockoutState membaca status lockout durable untuk seorang user.
func LockoutState(db *gorm.DB, userID uint, now time.Time) (locked bool, until time.Time, err error) {
	if db == nil {
		return false, time.Time{}, ErrStorageUnavailable
	}
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

// resetFailuresTx menghapus counter percobaan gagal yang belum mengunci akun
// di dalam transaksi yang sama dengan verifikasi sukses. Lock aktif tidak
// pernah dihapus (verifikasi sudah ditolak lebih dulu saat akun terkunci).
func resetFailuresTx(tx *gorm.DB, userID uint, now time.Time) error {
	return tx.Where("user_id = ? AND (locked_until IS NULL OR locked_until <= ?)", userID, now).
		Delete(&models.MFAAccountLockout{}).Error
}

// failureGeneration menurunkan kunci generasi positif deterministik dari
// pasangan (factorType, normalizedCode). Dengan skema ini:
//   - Retry jaringan untuk pasangan (JTI, kode salah) yang persis sama bersifat
//     idempotent (tidak menggandakan counter).
//   - Brute-force dengan kode berbeda pada JTI yang sama ATAU lintas JTI baru
//     menghasilkan generasi unik sehingga menaikkan counter lockout secara akurat.
func failureGeneration(keyMaterial, factorType, code string) int64 {
	norm := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(code), "-", ""))
	mac := hmac.New(sha256.New, []byte("mfa-fail-gen|"+keyMaterial))
	mac.Write([]byte(strings.ToLower(strings.TrimSpace(factorType)) + ":" + norm))
	sum := mac.Sum(nil)
	gen := int64(binary.BigEndian.Uint64(sum[:8]) & 0x7fffffffffffffff)
	if gen <= 0 {
		gen = 1
	}
	return gen
}

// recordFailureAtomic mencatat kegagalan faktor secara transaksional, race-safe,
// dan tahan restart Redis/server. Mengembalikan error bila DB gagal (fail-closed).
func recordFailureAtomic(db *gorm.DB, keyMaterial, jti, factorType, code string, userID uint, now time.Time) (locked bool, jtiExhausted bool, err error) {
	if db == nil {
		return false, false, ErrStorageUnavailable
	}
	jti = strings.TrimSpace(jti)
	if jti == "" || userID == 0 {
		return false, false, ErrChallengeInvalid
	}
	if len(jti) > 64 {
		sum := sha256.Sum256([]byte(jti))
		jti = "h-" + hex.EncodeToString(sum[:24])
	}
	gen := failureGeneration(keyMaterial, factorType, code)

	err = db.Transaction(func(tx *gorm.DB) error {
		// Kunci baris user terlebih dahulu untuk menserialisasi mutasi lockout paralel.
		var u models.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Select("id").First(&u, userID).Error; err != nil {
			return err
		}

		entry := models.MFAChallengeFailure{
			TokenJTI:        jti,
			LeaseGeneration: gen,
			UserID:          userID,
			CreatedAt:       now,
		}
		ins := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "token_jti"}, {Name: "lease_generation"}},
			DoNothing: true,
		}).Create(&entry)
		if ins.Error != nil {
			return ins.Error
		}
		created := ins.RowsAffected > 0

		var jtiFailures int64
		if err := tx.Model(&models.MFAChallengeFailure{}).Where("token_jti = ?", jti).Count(&jtiFailures).Error; err != nil {
			return err
		}
		jtiExhausted = jtiFailures >= MaxChallengeFailures

		var lock models.MFAAccountLockout
		findRes := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("user_id = ?", userID).Limit(1).Find(&lock)
		if findRes.Error != nil {
			return findRes.Error
		}

		if findRes.RowsAffected == 0 {
			lock = models.MFAAccountLockout{
				UserID:          userID,
				FailedAttempts:  0,
				WindowStartedAt: now,
				UpdatedAt:       now,
			}
		}

		// Jika sedang terkunci aktif, pertahankan lock tanpa mereset window.
		if lock.LockedUntil != nil && now.Before(*lock.LockedUntil) {
			locked = true
			return nil
		}

		// Jendela kedaluwarsa atau bekas lock yang sudah lewat: mulai window baru.
		if lock.WindowStartedAt.IsZero() || now.Sub(lock.WindowStartedAt) > FailureWindow || (lock.LockedUntil != nil && !now.Before(*lock.LockedUntil)) {
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
			if err := tx.Create(&lock).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Save(&lock).Error; err != nil {
				return err
			}
		}

		locked = lock.LockedUntil != nil && now.Before(*lock.LockedUntil)
		return nil
	})
	if err != nil {
		return false, false, err
	}
	return locked, jtiExhausted, nil
}

// SealCompletionPayload mengenkripsi metadata non-bearer untuk rekaman mfa_auth_completions.
// Bearer JWT mentah DILARANG disimpan di kolom ini.
func SealCompletionPayload(keyMaterial string, sessionID uint, tokenID string, userID uint, factor string, now time.Time) (string, error) {
	meta := map[string]interface{}{
		"session_id": sessionID,
		"token_id":   tokenID,
		"uid":        userID,
		"factor":     factor,
		"iat":        now.Unix(),
	}
	raw, err := json.Marshal(meta)
	if err != nil {
		return "", err
	}
	return security.SealMFASecret("completion|"+keyMaterial, string(raw))
}

type factorFailureSentinel struct {
	cause error
}

func (e factorFailureSentinel) Error() string { return e.cause.Error() }
func (e factorFailureSentinel) Unwrap() error { return e.cause }

// SessionCommitHook dipanggil di dalam transaksi verifikasi MFA setelah faktor
// kedua tervalidasi & di-CAS, untuk menulis UserSession dan ActivityLog secara
// atomik sebelum transaksi di-commit.
type SessionCommitHook func(tx *gorm.DB, lockedUser *models.User) (sessionID uint, tokenID string, err error)

// RedeemChallenge memverifikasi challenge MFA, mengonsumsi faktor kedua (TOTP
// atau backup code), mencatat completion unik per-JTI, dan menyimpan sesi
// pengguna dalam SATU transaksi database.
//
// Properti keamanan:
//   - Challenge JTI hanya dapat menghasilkan paling banyak SATU sesi meskipun
//     dieksekusi secara paralel.
//   - Kegagalan DB pada tahap mana pun sebelum commit membatalkan konsumsi
//     faktor dan pembuatan sesi (fail-closed, tidak ada sesi bocor maupun
//     faktor yang hilang separuh).
func RedeemChallenge(
	db *gorm.DB,
	keyMaterial string,
	claims *ChallengeClaims,
	factorType string,
	code string,
	now time.Time,
	commitHook SessionCommitHook,
) (*models.User, string, error) {
	if db == nil || strings.TrimSpace(keyMaterial) == "" || commitHook == nil {
		return nil, "", ErrStorageUnavailable
	}
	if claims == nil || claims.UserID == 0 || strings.TrimSpace(claims.ID) == "" {
		return nil, "", ErrChallengeInvalid
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}

	factor := strings.ToLower(strings.TrimSpace(factorType))
	if factor == "" {
		factor = FactorTOTP
	}
	if factor != FactorTOTP && factor != FactorBackupCode {
		return nil, "", ErrFactorDisabled
	}

	trimmedCode := strings.TrimSpace(code)
	if trimmedCode == "" {
		return nil, "", ErrFactorInvalid
	}

	var verifiedUser models.User
	txErr := db.Transaction(func(tx *gorm.DB) error {
		// 1. Kunci baris user untuk serialisasi konkurensi per-akun di PostgreSQL.
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&verifiedUser, claims.UserID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrChallengeInvalid
			}
			return err
		}

		if claims.TokenVersion > 0 && verifiedUser.TokenVersion != claims.TokenVersion {
			return ErrChallengeInvalid
		}
		if !verifiedUser.IsPlatformStaff() && verifiedUser.IsBlacklisted {
			return ErrAccountBanned
		}
		if !verifiedUser.TwoFactorEnabled {
			return ErrNotEnrolled
		}

		// 2. Pastikan challenge JTI belum pernah ditukarkan sebelumnya.
		var existingComp models.MFAAuthCompletion
		compRes := tx.Select("id").
			Where("purpose = ? AND token_jti = ?", ChallengePurpose, claims.ID).
			Limit(1).
			Find(&existingComp)
		if compRes.Error != nil {
			return compRes.Error
		}
		if compRes.RowsAffected > 0 {
			return ErrChallengeRedeemed
		}

		// 3. Pastikan challenge JTI belum melebihi kuota kegagalan per-challenge.
		var jtiFails int64
		if err := tx.Model(&models.MFAChallengeFailure{}).Where("token_jti = ?", claims.ID).Count(&jtiFails).Error; err != nil {
			return err
		}
		if jtiFails >= MaxChallengeFailures {
			return ErrChallengeExhausted
		}

		// 4. Periksa lockout akun durable di bawah lock.
		var lockRow models.MFAAccountLockout
		lockRes := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ?", verifiedUser.ID).
			Limit(1).
			Find(&lockRow)
		if lockRes.Error != nil {
			return lockRes.Error
		}
		if lockRes.RowsAffected > 0 && lockRow.LockedUntil != nil && now.Before(*lockRow.LockedUntil) {
			return ErrFactorLocked
		}

		// 5. Verifikasi dan konsumsi faktor secara CAS di dalam transaksi.
		var consumedHashRef *string
		switch factor {
		case FactorTOTP:
			if verifiedUser.TwoFactorSecretEnc == nil || strings.TrimSpace(*verifiedUser.TwoFactorSecretEnc) == "" {
				return ErrNotEnrolled
			}
			secret, err := security.OpenMFASecret(keyMaterial, *verifiedUser.TwoFactorSecretEnc)
			if err != nil {
				return err
			}
			step, err := security.VerifyTOTP(secret, trimmedCode, now)
			if err != nil {
				return factorFailureSentinel{cause: ErrFactorInvalid}
			}
			if step <= verifiedUser.TwoFactorLastTOTPStep {
				return factorFailureSentinel{cause: ErrReplay}
			}
			upd := tx.Model(&models.User{}).
				Where("id = ? AND two_factor_enabled = ? AND two_factor_last_totp_step < ?", verifiedUser.ID, true, step).
				Update("two_factor_last_totp_step", step)
			if upd.Error != nil {
				return upd.Error
			}
			if upd.RowsAffected == 0 {
				return factorFailureSentinel{cause: ErrReplay}
			}
			verifiedUser.TwoFactorLastTOTPStep = step

		case FactorBackupCode:
			if verifiedUser.TwoFactorBackupCodesHash == nil || strings.TrimSpace(*verifiedUser.TwoFactorBackupCodesHash) == "" {
				return ErrFactorDisabled
			}
			oldRaw := *verifiedUser.TwoFactorBackupCodesHash
			var hashes []string
			if err := json.Unmarshal([]byte(oldRaw), &hashes); err != nil {
				return fmt.Errorf("mfa: data kode cadangan rusak: %w", err)
			}
			idx := security.MatchBackupCodeHash(keyMaterial, trimmedCode, hashes)
			if idx < 0 {
				return factorFailureSentinel{cause: ErrFactorInvalid}
			}
			matchedHash := hashes[idx]
			if len(matchedHash) > 64 {
				matchedHash = matchedHash[:64]
			}
			consumedHashRef = &matchedHash

			remaining := append(append([]string{}, hashes[:idx]...), hashes[idx+1:]...)
			encoded, err := json.Marshal(remaining)
			if err != nil {
				return err
			}
			upd := tx.Model(&models.User{}).
				Where("id = ? AND two_factor_enabled = ? AND two_factor_backup_codes_hash = ?", verifiedUser.ID, true, oldRaw).
				Update("two_factor_backup_codes_hash", string(encoded))
			if upd.Error != nil {
				return upd.Error
			}
			if upd.RowsAffected == 0 {
				return factorFailureSentinel{cause: ErrFactorInvalid}
			}
			updatedStr := string(encoded)
			verifiedUser.TwoFactorBackupCodesHash = &updatedStr
		}

		if err := resetFailuresTx(tx, verifiedUser.ID, now); err != nil {
			return err
		}

		// 6. Buat sesi durable & audit di transaksi yang sama.
		sessionID, tokenID, err := commitHook(tx, &verifiedUser)
		if err != nil {
			return err
		}
		if sessionID == 0 || strings.TrimSpace(tokenID) == "" {
			return ErrStorageUnavailable
		}

		// 7. Rekam completion sekali-pakai (UNIQUE purpose + token_jti).
		sealedPayload, err := SealCompletionPayload(keyMaterial, sessionID, tokenID, verifiedUser.ID, factor, now)
		if err != nil {
			return err
		}
		expAt := now.Add(ChallengeTTL)
		if claims.ExpiresAt != nil && !claims.ExpiresAt.Time.IsZero() {
			expAt = claims.ExpiresAt.Time
		}
		comp := models.MFAAuthCompletion{
			Purpose:          ChallengePurpose,
			TokenJTI:         claims.ID,
			UserID:           verifiedUser.ID,
			FactorType:       factor,
			ConsumedHashRef:  consumedHashRef,
			SessionID:        sessionID,
			PayloadEnc:       sealedPayload,
			Status:           "redis_committed",
			RedisCommittedAt: &now,
			CreatedAt:        now,
			UpdatedAt:        now,
			ExpiresAt:        expAt,
		}
		if err := tx.Create(&comp).Error; err != nil {
			if isUniqueViolation(err) {
				return ErrChallengeRedeemed
			}
			return err
		}
		return nil
	})

	if txErr != nil {
		var sentinel factorFailureSentinel
		if errors.As(txErr, &sentinel) {
			lockedNow, _, recErr := recordFailureAtomic(db, keyMaterial, claims.ID, factor, trimmedCode, claims.UserID, now)
			if recErr != nil {
				return nil, factor, recErr
			}
			if lockedNow {
				return nil, factor, ErrFactorLocked
			}
			return nil, factor, sentinel.cause
		}
		return nil, factor, txErr
	}

	return &verifiedUser, factor, nil
}

// VerifyStepUpAndMutate memverifikasi faktor kedua aktif (TOTP atau backup code)
// untuk operasi sensitif (disable MFA, ganti kredensial) dan menjalankan mutateFn
// di dalam transaksi database yang sama. Kegagalan kode dicatat secara atomik ke lockout.
func VerifyStepUpAndMutate(
	db *gorm.DB,
	keyMaterial string,
	userID uint,
	code string,
	factorHint string,
	failureContextJTI string,
	now time.Time,
	mutateFn func(tx *gorm.DB, lockedUser *models.User, usedFactor string) error,
) (string, error) {
	if db == nil || strings.TrimSpace(keyMaterial) == "" || mutateFn == nil {
		return "", ErrStorageUnavailable
	}
	if userID == 0 {
		return "", ErrNotEnrolled
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}
	trimmedCode := strings.TrimSpace(code)
	if trimmedCode == "" {
		return "", ErrFactorInvalid
	}
	if strings.TrimSpace(failureContextJTI) == "" {
		rnd, rErr := randomHex(8)
		if rErr != nil {
			return "", rErr
		}
		failureContextJTI = fmt.Sprintf("stepup-%d-%s", userID, rnd)
	}

	var usedFactor string
	txErr := db.Transaction(func(tx *gorm.DB) error {
		var u models.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&u, userID).Error; err != nil {
			return err
		}
		if !u.TwoFactorEnabled {
			return ErrNotEnrolled
		}

		var lockRow models.MFAAccountLockout
		lockRes := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ?", u.ID).
			Limit(1).
			Find(&lockRow)
		if lockRes.Error != nil {
			return lockRes.Error
		}
		if lockRes.RowsAffected > 0 && lockRow.LockedUntil != nil && now.Before(*lockRow.LockedUntil) {
			return ErrFactorLocked
		}

		hint := strings.ToLower(strings.TrimSpace(factorHint))
		tryTOTP := hint == "" || hint == FactorTOTP
		tryBackup := hint == "" || hint == FactorBackupCode
		if !tryTOTP && !tryBackup {
			return ErrFactorDisabled
		}

		totpMatched := false
		var totpReplay bool
		if tryTOTP && u.TwoFactorSecretEnc != nil && strings.TrimSpace(*u.TwoFactorSecretEnc) != "" {
			secret, err := security.OpenMFASecret(keyMaterial, *u.TwoFactorSecretEnc)
			if err != nil {
				return err
			}
			if step, vErr := security.VerifyTOTP(secret, trimmedCode, now); vErr == nil {
				if step <= u.TwoFactorLastTOTPStep {
					totpReplay = true
				} else {
					upd := tx.Model(&models.User{}).
						Where("id = ? AND two_factor_enabled = ? AND two_factor_last_totp_step < ?", u.ID, true, step).
						Update("two_factor_last_totp_step", step)
					if upd.Error != nil {
						return upd.Error
					}
					if upd.RowsAffected == 0 {
						totpReplay = true
					} else {
						u.TwoFactorLastTOTPStep = step
						usedFactor = FactorTOTP
						totpMatched = true
					}
				}
			}
		}

		if !totpMatched && !totpReplay && tryBackup && u.TwoFactorBackupCodesHash != nil && strings.TrimSpace(*u.TwoFactorBackupCodesHash) != "" {
			oldRaw := *u.TwoFactorBackupCodesHash
			var hashes []string
			if err := json.Unmarshal([]byte(oldRaw), &hashes); err != nil {
				return fmt.Errorf("mfa: data kode cadangan rusak: %w", err)
			}
			if idx := security.MatchBackupCodeHash(keyMaterial, trimmedCode, hashes); idx >= 0 {
				remaining := append(append([]string{}, hashes[:idx]...), hashes[idx+1:]...)
				encoded, err := json.Marshal(remaining)
				if err != nil {
					return err
				}
				upd := tx.Model(&models.User{}).
					Where("id = ? AND two_factor_enabled = ? AND two_factor_backup_codes_hash = ?", u.ID, true, oldRaw).
					Update("two_factor_backup_codes_hash", string(encoded))
				if upd.Error != nil {
					return upd.Error
				}
				if upd.RowsAffected > 0 {
					updatedStr := string(encoded)
					u.TwoFactorBackupCodesHash = &updatedStr
					usedFactor = FactorBackupCode
				}
			}
		}

		if usedFactor == "" {
			if totpReplay {
				return factorFailureSentinel{cause: ErrReplay}
			}
			return factorFailureSentinel{cause: ErrFactorInvalid}
		}

		if err := resetFailuresTx(tx, u.ID, now); err != nil {
			return err
		}
		return mutateFn(tx, &u, usedFactor)
	})

	if txErr != nil {
		var sentinel factorFailureSentinel
		if errors.As(txErr, &sentinel) {
			recFactor := strings.ToLower(strings.TrimSpace(factorHint))
			if recFactor == "" {
				recFactor = FactorTOTP
			}
			lockedNow, _, recErr := recordFailureAtomic(db, keyMaterial, failureContextJTI, recFactor, trimmedCode, userID, now)
			if recErr != nil {
				return "", recErr
			}
			if lockedNow {
				return "", ErrFactorLocked
			}
			return "", sentinel.cause
		}
		return "", txErr
	}

	return usedFactor, nil
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "duplicate key") ||
		strings.Contains(msg, "23505")
}

// VerifyTOTPFactor memeriksa kode TOTP dan menolak replay langkah waktu yang
// sudah dipakai. Mengembalikan ErrFactorLocked bila akun terkunci.
func VerifyTOTPFactor(db *gorm.DB, keyMaterial string, user *models.User, code, jti string, now time.Time) error {
	if user == nil || !user.TwoFactorEnabled {
		return ErrNotEnrolled
	}
	if user.TwoFactorSecretEnc == nil || strings.TrimSpace(*user.TwoFactorSecretEnc) == "" {
		return ErrNotEnrolled
	}
	if db == nil || strings.TrimSpace(keyMaterial) == "" {
		return ErrStorageUnavailable
	}
	if strings.TrimSpace(jti) == "" {
		rnd, err := randomHex(8)
		if err != nil {
			return err
		}
		jti = fmt.Sprintf("totp-%d-%s", user.ID, rnd)
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
		lockedNow, _, recErr := recordFailureAtomic(db, keyMaterial, jti, FactorTOTP, code, user.ID, now)
		if recErr != nil {
			return recErr
		}
		if lockedNow {
			return ErrFactorLocked
		}
		return ErrFactorInvalid
	}

	if step <= user.TwoFactorLastTOTPStep {
		lockedNow, _, recErr := recordFailureAtomic(db, keyMaterial, jti, FactorTOTP, code, user.ID, now)
		if recErr != nil {
			return recErr
		}
		if lockedNow {
			return ErrFactorLocked
		}
		return ErrReplay
	}

	var casOK bool
	txErr := db.Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&models.User{}).
			Where("id = ? AND two_factor_enabled = ? AND two_factor_last_totp_step < ?", user.ID, true, step).
			Update("two_factor_last_totp_step", step)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return nil
		}
		casOK = true
		return resetFailuresTx(tx, user.ID, now)
	})
	if txErr != nil {
		return txErr
	}
	if !casOK {
		return ErrReplay
	}

	user.TwoFactorLastTOTPStep = step
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
	if db == nil || strings.TrimSpace(keyMaterial) == "" {
		return ErrStorageUnavailable
	}
	if strings.TrimSpace(jti) == "" {
		rnd, err := randomHex(8)
		if err != nil {
			return err
		}
		jti = fmt.Sprintf("bc-%d-%s", user.ID, rnd)
	}

	locked, _, err := LockoutState(db, user.ID, now)
	if err != nil {
		return err
	}
	if locked {
		return ErrFactorLocked
	}

	oldRaw := *user.TwoFactorBackupCodesHash
	var hashes []string
	if err := json.Unmarshal([]byte(oldRaw), &hashes); err != nil {
		return fmt.Errorf("mfa: data kode cadangan rusak: %w", err)
	}

	idx := security.MatchBackupCodeHash(keyMaterial, code, hashes)
	if idx < 0 {
		lockedNow, _, recErr := recordFailureAtomic(db, keyMaterial, jti, FactorBackupCode, code, user.ID, now)
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

	var casOK bool
	txErr := db.Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&models.User{}).
			Where("id = ? AND two_factor_enabled = ? AND two_factor_backup_codes_hash = ?", user.ID, true, oldRaw).
			Update("two_factor_backup_codes_hash", string(encoded))
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return nil
		}
		casOK = true
		return resetFailuresTx(tx, user.ID, now)
	})
	if txErr != nil {
		return txErr
	}
	if !casOK {
		return ErrFactorInvalid
	}

	updated := string(encoded)
	user.TwoFactorBackupCodesHash = &updated
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
