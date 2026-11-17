package handlers

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/mfa"
	"catavor-backend/internal/middleware"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// MFAHandler melayani endpoint faktor kedua. Handler ini sengaja terpisah dari
// AuthHandler agar jalur login yang sudah berjalan tidak berubah bentuk.
type MFAHandler struct {
	cfg     *config.Config
	db      *gorm.DB
	keyMat  string
	jwtKey  string
	enabled bool
}

// NewMFAHandler membuat handler MFA. enabled=false membuat semua endpoint
// mengembalikan 404 sehingga fitur bisa dimatikan lewat konfigurasi tanpa
// mengubah routing.
func NewMFAHandler(cfg *config.Config, db *gorm.DB, keyMaterial, jwtSecret string, enabled bool) *MFAHandler {
	return &MFAHandler{cfg: cfg, db: db, keyMat: keyMaterial, jwtKey: jwtSecret, enabled: enabled}
}

// guard memeriksa prasyarat handler. Nilai balik bool (bukan error) karena
// c.Status(x).JSON(...) mengembalikan nil — memakai pola "if err != nil" di sini
// membuat guard TIDAK PERNAH menghentikan eksekusi. Ditemukan lewat tes
// TestMFADisabledGuardReturns404 yang menerima 401 alih-alih 404.
func (h *MFAHandler) guard(c *fiber.Ctx) bool {
	if !h.enabled {
		_ = c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"code":    "MFA_DISABLED",
			"message": "Fitur verifikasi dua langkah tidak diaktifkan pada server ini.",
		})
		return false
	}
	if h.db == nil {
		_ = c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"message": "Database belum diinisialisasi.",
		})
		return false
	}
	return true
}

// currentUser mengambil user dari context middleware AuthRequired.
func currentUser(c *fiber.Ctx) (*models.User, bool) {
	u, ok := c.Locals("user").(*models.User)
	if !ok || u == nil || u.ID == 0 {
		return nil, false
	}
	return u, true
}

func (h *MFAHandler) fail(c *fiber.Ctx, status int, code, msg string) error {
	return c.Status(status).JSON(fiber.Map{
		"success": false,
		"code":    code,
		"message": msg,
	})
}

// StartEnrollment membuat secret baru dan mengembalikan otpauth URI. Secret
// BELUM aktif: two_factor_enabled tetap false sampai pengguna membuktikan
// bahwa authenticator-nya benar-benar menghasilkan kode yang cocok.
func (h *MFAHandler) StartEnrollment(c *fiber.Ctx) error {
	if !h.guard(c) {
		return nil
	}
	user, ok := currentUser(c)
	if !ok {
		return h.fail(c, fiber.StatusUnauthorized, "UNAUTHENTICATED", "Sesi tidak valid.")
	}
	if user.TwoFactorEnabled {
		return h.fail(c, fiber.StatusConflict, "MFA_ALREADY_ENABLED",
			"Verifikasi dua langkah sudah aktif. Nonaktifkan terlebih dahulu untuk mendaftar ulang.")
	}

	var req struct {
		// OtpChannel (opsional) hanya dicatat pada respons untuk memberi tahu
		// klien bahwa enrollment lewat aplikasi authenticator, bukan SMS.
		OtpChannel string `json:"otp_channel"`
	}
	_ = c.BodyParser(&req)

	secret, err := security.GenerateTOTPSecret()
	if err != nil {
		return h.fail(c, fiber.StatusInternalServerError, "MFA_SECRET_ERROR", "Gagal membuat secret.")
	}
	sealed, err := security.SealMFASecret(h.keyMat, secret)
	if err != nil {
		return h.fail(c, fiber.StatusInternalServerError, "MFA_SEAL_ERROR", "Gagal menyiapkan secret.")
	}

	now := time.Now().UTC()
	setupJTI := "setup-" + user.Email + "-" + now.Format("20060102150405")

	// Simpan sebagai "pending": secret tersimpan, flag aktif belum.
	if err := h.db.Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]interface{}{
		"two_factor_secret_enc":  sealed,
		"two_factor_enabled":     false,
		"two_factor_setup_jti":   setupJTI,
		"two_factor_enrolled_at": nil,
	}).Error; err != nil {
		return h.fail(c, fiber.StatusInternalServerError, "MFA_SAVE_ERROR", "Gagal menyimpan secret.")
	}

	issuer := "Catavor"
	return c.JSON(fiber.Map{
		"success": true,
		"message": "Pindai QR code dengan aplikasi authenticator, lalu kirim kode 6 digit untuk mengaktifkan.",
		"data": fiber.Map{
			"secret":      secret,
			"otpauth_url": security.BuildOTPAuthURL(issuer, user.Email, secret),
			"issuer":      issuer,
			"account":     user.Email,
			"digits":      security.TOTPDigits,
			"period":      int(security.TOTPStep.Seconds()),
			"algorithm":   "SHA1",
			"setup_jti":   setupJTI,
		},
	})
}

// ConfirmEnrollment memverifikasi kode pertama, mengaktifkan faktor kedua, dan
// menerbitkan kode cadangan. Kode cadangan dikembalikan SEKALI.
func (h *MFAHandler) ConfirmEnrollment(c *fiber.Ctx) error {
	if !h.guard(c) {
		return nil
	}
	user, ok := currentUser(c)
	if !ok {
		return h.fail(c, fiber.StatusUnauthorized, "UNAUTHENTICATED", "Sesi tidak valid.")
	}

	var req struct {
		Code string `json:"code"`
	}
	if err := c.BodyParser(&req); err != nil {
		return h.fail(c, fiber.StatusBadRequest, "INVALID_BODY", "Format data tidak valid.")
	}
	code := strings.TrimSpace(req.Code)
	if code == "" {
		return h.fail(c, fiber.StatusUnprocessableEntity, "CODE_REQUIRED", "Kode verifikasi wajib diisi.")
	}

	if user.TwoFactorEnabled {
		return h.fail(c, fiber.StatusConflict, "MFA_ALREADY_ENABLED", "Verifikasi dua langkah sudah aktif.")
	}
	if user.TwoFactorSecretEnc == nil || strings.TrimSpace(*user.TwoFactorSecretEnc) == "" {
		return h.fail(c, fiber.StatusConflict, "MFA_NOT_STARTED", "Mulai pendaftaran faktor kedua terlebih dahulu.")
	}

	secret, err := security.OpenMFASecret(h.keyMat, *user.TwoFactorSecretEnc)
	if err != nil {
		return h.fail(c, fiber.StatusInternalServerError, "MFA_SECRET_CORRUPT", "Secret tidak bisa dibaca. Ulangi pendaftaran.")
	}
	step, err := security.VerifyTOTP(secret, code, time.Now().UTC())
	if err != nil {
		return h.fail(c, fiber.StatusUnauthorized, "MFA_CODE_INVALID", "Kode verifikasi salah atau sudah kedaluwarsa.")
	}

	codes, hashes, err := security.GenerateBackupCodes(h.keyMat, 10)
	if err != nil {
		return h.fail(c, fiber.StatusInternalServerError, "MFA_BACKUP_ERROR", "Gagal membuat kode cadangan.")
	}
	encoded, err := mfa.EncodeBackupCodeHashes(hashes)
	if err != nil {
		return h.fail(c, fiber.StatusInternalServerError, "MFA_BACKUP_ERROR", "Gagal menyimpan kode cadangan.")
	}

	now := time.Now().UTC()
	if err := h.db.Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]interface{}{
		"two_factor_enabled":           true,
		"two_factor_backup_codes_hash": encoded,
		"two_factor_enrolled_at":       now,
		"two_factor_last_totp_step":    step,
		"two_factor_setup_jti":         nil,
	}).Error; err != nil {
		return h.fail(c, fiber.StatusInternalServerError, "MFA_SAVE_ERROR", "Gagal mengaktifkan faktor kedua.")
	}

	// Kode cadangan tidak pernah dikirim ulang; pengguna harus menyimpannya.
	return c.JSON(fiber.Map{
		"success": true,
		"message": "Verifikasi dua langkah aktif. Simpan kode cadangan berikut di tempat aman — kode ini tidak bisa ditampilkan lagi.",
		"data": fiber.Map{
			"backup_codes": codes,
			"enabled_at":   now,
		},
	})
}

// VerifyChallenge menukar challenge MFA (dari login) menjadi sesi penuh.
func (h *MFAHandler) VerifyChallenge(c *fiber.Ctx) error {
	if !h.guard(c) {
		return nil
	}

	var req struct {
		Challenge  string `json:"challenge"`
		Code       string `json:"code"`
		FactorType string `json:"factor_type"`
	}
	if err := c.BodyParser(&req); err != nil {
		return h.fail(c, fiber.StatusBadRequest, "INVALID_BODY", "Format data tidak valid.")
	}
	if strings.TrimSpace(req.Challenge) == "" {
		return h.fail(c, fiber.StatusUnprocessableEntity, "CHALLENGE_REQUIRED", "Challenge wajib diisi.")
	}

	now := time.Now().UTC()
	claims, err := mfa.ParseChallenge(h.jwtKey, strings.TrimSpace(req.Challenge), now)
	if err != nil {
		return h.fail(c, fiber.StatusUnauthorized, "MFA_CHALLENGE_INVALID", "Sesi verifikasi tidak valid atau sudah kedaluwarsa. Silakan login ulang.")
	}

	var user models.User
	if err := h.db.First(&user, claims.UserID).Error; err != nil {
		return h.fail(c, fiber.StatusUnauthorized, "MFA_CHALLENGE_INVALID", "Sesi verifikasi tidak valid. Silakan login ulang.")
	}
	if !user.TwoFactorEnabled {
		return h.fail(c, fiber.StatusConflict, "MFA_NOT_ENROLLED", "Akun ini tidak mengaktifkan verifikasi dua langkah.")
	}

	factor := strings.ToLower(strings.TrimSpace(req.FactorType))
	code := strings.TrimSpace(req.Code)
	if code == "" {
		return h.fail(c, fiber.StatusUnprocessableEntity, "CODE_REQUIRED", "Kode verifikasi wajib diisi.")
	}

	switch factor {
	case "", mfa.FactorTOTP:
		err = mfa.VerifyTOTPFactor(h.db, h.keyMat, &user, code, claims.ID, now)
	case mfa.FactorBackupCode:
		err = mfa.VerifyBackupCodeFactor(h.db, h.keyMat, &user, code, claims.ID, now)
	default:
		return h.fail(c, fiber.StatusUnprocessableEntity, "FACTOR_UNSUPPORTED", "Jenis faktor tidak didukung.")
	}

	switch {
	case err == nil:
	case errors.Is(err, mfa.ErrFactorLocked):
		logAuthEvent(h.db, c, "AUTH_MFA_LOCKED", "Verifikasi faktor kedua ditolak: akun terkunci sementara", &user, map[string]interface{}{
			"jti": claims.ID,
		})
		return h.fail(c, fiber.StatusTooManyRequests, "MFA_LOCKED",
			"Terlalu banyak kode salah. Verifikasi faktor kedua dikunci sementara.")
	case errors.Is(err, mfa.ErrReplay):
		logAuthEvent(h.db, c, "AUTH_MFA_REPLAY", "Verifikasi faktor kedua ditolak: kode sudah dipakai", &user, map[string]interface{}{
			"jti": claims.ID,
		})
		return h.fail(c, fiber.StatusUnauthorized, "MFA_CODE_REUSED", "Kode ini sudah dipakai. Tunggu kode berikutnya.")
	case errors.Is(err, mfa.ErrFactorInvalid):
		logAuthEvent(h.db, c, "AUTH_MFA_FAILED", "Verifikasi faktor kedua ditolak: kode salah", &user, map[string]interface{}{
			"jti":    claims.ID,
			"factor": factor,
		})
		return h.fail(c, fiber.StatusUnauthorized, "MFA_CODE_INVALID", "Kode verifikasi salah.")
	default:
		return h.fail(c, fiber.StatusInternalServerError, "MFA_ERROR", "Verifikasi faktor kedua gagal diproses.")
	}

	// Buat sesi penuh hanya setelah faktor kedua terbukti. Preload store
	// diperlukan agar klaim sesi membawa konteks toko seperti jalur login biasa.
	var full models.User
	if err := preloadUserStores(h.db.Preload("Store")).First(&full, user.ID).Error; err != nil {
		return h.fail(c, fiber.StatusUnauthorized, "MFA_CHALLENGE_INVALID", "Akun tidak ditemukan. Silakan login ulang.")
	}

	var primaryStore *models.Store
	if len(full.Stores) > 0 {
		primaryStore = &full.Stores[0]
	} else {
		primaryStore = full.Store
	}

	token, tokenID, expiresAt, err := middleware.GenerateTokenWithID(&full, primaryStore, h.cfg)
	if err != nil {
		return h.fail(c, fiber.StatusInternalServerError, "SESSION_ERROR", "Gagal membuat sesi login.")
	}
	go services.RecordUserSession(full.ID, tokenID, expiresAt, c.IP(), c.Get("User-Agent"))
	middleware.RegisterSessionFingerprint(tokenID, c.IP(), c.Get("User-Agent"))

	logAuthEvent(h.db, c, "AUTH_MFA_SUCCESS", "Verifikasi faktor kedua berhasil", &full, map[string]interface{}{
		"jti":    claims.ID,
		"factor": factor,
	})

	// SECURITY (M1): sesi tetap disimpan di cookie HttpOnly, sama seperti login.
	setSessionCookie(c, h.cfg, token)
	return c.JSON(fiber.Map{
		"success": true,
		"message": "Verifikasi berhasil.",
		"token":   token,
		"user": fiber.Map{
			"id":                 full.ID,
			"name":               full.Name,
			"email":              full.Email,
			"two_factor_enabled": true,
		},
	})
}

// Disable menonaktifkan faktor kedua. Wajib menyertakan kode TOTP yang valid
// agar sesi yang dibajak tidak bisa mematikan proteksi tanpa bukti faktor.
func (h *MFAHandler) Disable(c *fiber.Ctx) error {
	if !h.guard(c) {
		return nil
	}
	user, ok := currentUser(c)
	if !ok {
		return h.fail(c, fiber.StatusUnauthorized, "UNAUTHENTICATED", "Sesi tidak valid.")
	}
	if !user.TwoFactorEnabled {
		return h.fail(c, fiber.StatusConflict, "MFA_NOT_ENROLLED", "Verifikasi dua langkah belum aktif.")
	}

	var req struct {
		Code string `json:"code"`
	}
	if err := c.BodyParser(&req); err != nil {
		return h.fail(c, fiber.StatusBadRequest, "INVALID_BODY", "Format data tidak valid.")
	}
	now := time.Now().UTC()

	// Terima TOTP atau kode cadangan.
	err := mfa.VerifyTOTPFactor(h.db, h.keyMat, user, strings.TrimSpace(req.Code), "", now)
	if err != nil {
		if bcErr := mfa.VerifyBackupCodeFactor(h.db, h.keyMat, user, strings.TrimSpace(req.Code), "", now); bcErr != nil {
			return h.fail(c, fiber.StatusUnauthorized, "MFA_CODE_INVALID", "Kode verifikasi salah.")
		}
	}

	if err := h.db.Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]interface{}{
		"two_factor_enabled":           false,
		"two_factor_secret_enc":        nil,
		"two_factor_backup_codes_hash": nil,
		"two_factor_enrolled_at":       nil,
		"two_factor_last_totp_step":    int64(0),
	}).Error; err != nil {
		return h.fail(c, fiber.StatusInternalServerError, "MFA_SAVE_ERROR", "Gagal menonaktifkan faktor kedua.")
	}
	_ = h.db.Where("user_id = ?", user.ID).Delete(&models.MFAAccountLockout{}).Error

	logAuthEvent(h.db, c, "AUTH_MFA_DISABLED", "Verifikasi dua langkah dinonaktifkan oleh pengguna", user, map[string]interface{}{
		"factor": "user_request",
	})

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Verifikasi dua langkah telah dinonaktifkan.",
	})
}

// Status mengembalikan konfigurasi MFA akun saat ini.
func (h *MFAHandler) Status(c *fiber.Ctx) error {
	if !h.guard(c) {
		return nil
	}
	user, ok := currentUser(c)
	if !ok {
		return h.fail(c, fiber.StatusUnauthorized, "UNAUTHENTICATED", "Sesi tidak valid.")
	}

	var backupCodes int
	if user.TwoFactorBackupCodesHash != nil && *user.TwoFactorBackupCodesHash != "" {
		var hashes []string
		if json.Unmarshal([]byte(*user.TwoFactorBackupCodesHash), &hashes) == nil {
			backupCodes = len(hashes)
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"enabled":           user.TwoFactorEnabled,
			"enforced":          user.TwoFactorEnforced,
			"backup_codes_left": backupCodes,
			"enrolled_at":       user.TwoFactorEnrolledAt,
		},
	})
}
