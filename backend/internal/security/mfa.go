package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"

	"golang.org/x/crypto/hkdf"
)

// Nilai parameter TOTP mengikuti RFC 6238 dengan SHA-1/6 digit/30 detik —
// kombinasi yang paling luas didukung aplikasi authenticator (Google
// Authenticator, Aegis, 1Password, Authy).
const (
	TOTPDigits = 6
	TOTPStep   = 30 * time.Second
	// TOTPSkew mengizinkan satu langkah sebelum/sesudah untuk toleransi jam.
	TOTPSkew = 1
)

var (
	// ErrInvalidTOTPSecret menandai secret yang tidak bisa dipakai.
	ErrInvalidTOTPSecret = errors.New("mfa: secret TOTP tidak valid")
	// ErrInvalidTOTPCode menandai kode yang tidak cocok pada jendela mana pun.
	ErrInvalidTOTPCode = errors.New("mfa: kode TOTP tidak cocok")
	// ErrMFADecrypt menandai ciphertext yang gagal diautentikasi.
	ErrMFADecrypt = errors.New("mfa: gagal mendekripsi secret (kunci salah atau data rusak)")
)

var totpBase32 = base32.StdEncoding.WithPadding(base32.NoPadding)

var base64Std = base64.StdEncoding

// GenerateTOTPSecret membuat secret acak 160-bit (20 byte) dalam base32 tanpa
// padding, format yang dipakai authenticator.
func GenerateTOTPSecret() (string, error) {
	buf := make([]byte, 20)
	if _, err := io.ReadFull(rand.Reader, buf); err != nil {
		return "", err
	}
	return totpBase32.EncodeToString(buf), nil
}

// BuildOTPAuthURL menyusun URI otpauth:// yang bisa dirender menjadi QR code.
func BuildOTPAuthURL(issuer, account, secret string) string {
	label := url.PathEscape(issuer + ":" + account)
	q := url.Values{}
	q.Set("secret", secret)
	q.Set("issuer", issuer)
	q.Set("algorithm", "SHA1")
	q.Set("digits", fmt.Sprintf("%d", TOTPDigits))
	q.Set("period", fmt.Sprintf("%d", int(TOTPStep.Seconds())))
	return "otpauth://totp/" + label + "?" + q.Encode()
}

// TOTPStepAt mengembalikan nomor langkah waktu untuk sebuah instant.
func TOTPStepAt(t time.Time) int64 {
	return t.Unix() / int64(TOTPStep.Seconds())
}

// GenerateTOTPCode menghitung kode HOTP/TOTP untuk sebuah langkah waktu.
func GenerateTOTPCode(secret string, step int64) (string, error) {
	key, err := totpBase32.DecodeString(strings.ToUpper(strings.TrimSpace(secret)))
	if err != nil || len(key) == 0 {
		return "", ErrInvalidTOTPSecret
	}
	var counter [8]byte
	binary.BigEndian.PutUint64(counter[:], uint64(step))

	mac := hmac.New(sha1.New, key)
	mac.Write(counter[:])
	sum := mac.Sum(nil)

	offset := sum[len(sum)-1] & 0x0f
	truncated := binary.BigEndian.Uint32(sum[offset:offset+4]) & 0x7fffffff
	mod := uint32(1)
	for i := 0; i < TOTPDigits; i++ {
		mod *= 10
	}
	return fmt.Sprintf("%0*d", TOTPDigits, truncated%mod), nil
}

// VerifyTOTP memeriksa kode pada jendela ±TOTPSkew dan mengembalikan langkah
// waktu yang cocok. Pemanggil WAJIB menyimpan langkah itu untuk mencegah
// replay kode yang sama (RFC 6238 §5.2).
func VerifyTOTP(secret, code string, now time.Time) (int64, error) {
	code = strings.TrimSpace(code)
	if len(code) != TOTPDigits {
		return 0, ErrInvalidTOTPCode
	}
	for _, r := range code {
		if r < '0' || r > '9' {
			return 0, ErrInvalidTOTPCode
		}
	}

	current := TOTPStepAt(now)
	// Iterasi dari langkah terlama agar pemakaian kode "sekarang" lebih dulu
	// menang ketika beberapa langkah kebetulan cocok.
	for delta := -TOTPSkew; delta <= TOTPSkew; delta++ {
		step := current + int64(delta)
		candidate, err := GenerateTOTPCode(secret, step)
		if err != nil {
			return 0, err
		}
		if subtle.ConstantTimeCompare([]byte(candidate), []byte(code)) == 1 {
			return step, nil
		}
	}
	return 0, ErrInvalidTOTPCode
}

// deriveKey menurunkan kunci 32 byte dari material kunci apa pun (kompatibilitas v1).
func deriveKey(material string) []byte {
	sum := sha256.Sum256([]byte(material))
	return sum[:]
}

// deriveHKDFKey menurunkan kunci 32 byte via RFC 5869 HKDF-SHA256 dengan info domain terisolasi.
func deriveHKDFKey(material, info string) ([]byte, error) {
	r := hkdf.New(sha256.New, []byte(material), []byte("catavor-mfa-aead-salt-v2"), []byte(info))
	key := make([]byte, 32)
	if _, err := io.ReadFull(r, key); err != nil {
		return nil, err
	}
	return key, nil
}

// SealMFASecretForUser mengenkripsi secret TOTP menggunakan kunci turunan HKDF-SHA256
// dan mengikat userID ke dalam AES-256-GCM Additional Authenticated Data (AAD) ("v2:...").
// Penyalinan ciphertext antar-baris pengguna di database akan langsung gagal autentikasi tag GCM.
func SealMFASecretForUser(keyMaterial string, userID uint, plaintext string) (string, error) {
	if userID == 0 {
		return SealMFASecret(keyMaterial, plaintext)
	}
	key, err := deriveHKDFKey(keyMaterial, "catavor-mfa-totp-secret-v2")
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	aad := []byte(fmt.Sprintf("catavor-mfa-v2|uid:%d", userID))
	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), aad)
	return "v2:" + base64Std.EncodeToString(sealed), nil
}

// OpenMFASecretForUser mendekripsi output SealMFASecretForUser ("v2:...") dengan verifikasi AAD userID,
// serta mendukung pembacaan mundur ("v1:...") agar secret yang sudah terenkripsi sebelumnya tetap valid.
func OpenMFASecretForUser(keyMaterial string, userID uint, stored string) (string, error) {
	if rawV2, ok := strings.CutPrefix(stored, "v2:"); ok {
		if userID == 0 {
			return "", ErrMFADecrypt
		}
		sealed, err := base64Std.DecodeString(rawV2)
		if err != nil {
			return "", ErrMFADecrypt
		}
		key, err := deriveHKDFKey(keyMaterial, "catavor-mfa-totp-secret-v2")
		if err != nil {
			return "", ErrMFADecrypt
		}
		block, err := aes.NewCipher(key)
		if err != nil {
			return "", ErrMFADecrypt
		}
		gcm, err := cipher.NewGCM(block)
		if err != nil {
			return "", ErrMFADecrypt
		}
		if len(sealed) < gcm.NonceSize() {
			return "", ErrMFADecrypt
		}
		nonce, ciphertext := sealed[:gcm.NonceSize()], sealed[gcm.NonceSize():]
		aad := []byte(fmt.Sprintf("catavor-mfa-v2|uid:%d", userID))
		plain, err := gcm.Open(nil, nonce, ciphertext, aad)
		if err != nil {
			return "", ErrMFADecrypt
		}
		return string(plain), nil
	}
	return OpenMFASecret(keyMaterial, stored)
}

// SealMFASecret mengenkripsi secret TOTP dengan AES-256-GCM. Output berbentuk
// "v1:<base64 nonce+ciphertext>" sehingga versi format bisa dirotasi nanti.
func SealMFASecret(keyMaterial, plaintext string) (string, error) {
	block, err := aes.NewCipher(deriveKey(keyMaterial))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), []byte("catavor-mfa-v1"))
	return "v1:" + base64Std.EncodeToString(sealed), nil
}

// OpenMFASecret mendekripsi output SealMFASecret dan memverifikasi tag GCM.
func OpenMFASecret(keyMaterial, stored string) (string, error) {
	raw, ok := strings.CutPrefix(stored, "v1:")
	if !ok {
		return "", ErrMFADecrypt
	}
	sealed, err := base64Std.DecodeString(raw)
	if err != nil {
		return "", ErrMFADecrypt
	}
	block, err := aes.NewCipher(deriveKey(keyMaterial))
	if err != nil {
		return "", ErrMFADecrypt
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", ErrMFADecrypt
	}
	if len(sealed) < gcm.NonceSize() {
		return "", ErrMFADecrypt
	}
	nonce, ciphertext := sealed[:gcm.NonceSize()], sealed[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, ciphertext, []byte("catavor-mfa-v1"))
	if err != nil {
		return "", ErrMFADecrypt
	}
	return string(plain), nil
}

// GenerateBackupCodes membuat n kode sekali-pakai. Kode dikembalikan dalam
// bentuk terang SEKALI (untuk ditampilkan) dan hash HMAC untuk disimpan.
func GenerateBackupCodes(keyMaterial string, n int) (codes []string, hashes []string, err error) {
	if n <= 0 {
		n = 10
	}
	codes = make([]string, 0, n)
	hashes = make([]string, 0, n)
	for i := 0; i < n; i++ {
		buf := make([]byte, 10)
		if _, err = io.ReadFull(rand.Reader, buf); err != nil {
			return nil, nil, err
		}
		raw := strings.ToUpper(totpBase32.EncodeToString(buf))[:10]
		code := raw[0:5] + "-" + raw[5:10]
		codes = append(codes, code)
		hashes = append(hashes, HashBackupCode(keyMaterial, code))
	}
	return codes, hashes, nil
}

// normalizeBackupCode menyamakan format input pengguna (dengan/tanpa strip,
// huruf kecil) sebelum hashing.
func normalizeBackupCode(code string) string {
	code = strings.ToUpper(strings.TrimSpace(code))
	return strings.ReplaceAll(code, "-", "")
}

// HashBackupCode menghasilkan HMAC-SHA256 atas kode yang sudah dinormalisasi.
// Kode punya entropi 50 bit dan hanya valid sekali, sehingga HMAC ber-kunci
// cukup; bcrypt untuk 10 kode per login akan menambah latensi tanpa manfaat
// berarti pada ancaman ini.
func HashBackupCode(keyMaterial, code string) string {
	mac := hmac.New(sha256.New, deriveKey("backup-codes|"+keyMaterial))
	mac.Write([]byte(normalizeBackupCode(code)))
	return hex.EncodeToString(mac.Sum(nil))
}

// MatchBackupCodeHash mencari indeks hash yang cocok (perbandingan konstan
// waktu) dan mengembalikan -1 bila tidak ada.
func MatchBackupCodeHash(keyMaterial, code string, hashes []string) int {
	target := HashBackupCode(keyMaterial, code)
	for i, h := range hashes {
		if subtle.ConstantTimeCompare([]byte(h), []byte(target)) == 1 {
			return i
		}
	}
	return -1
}
