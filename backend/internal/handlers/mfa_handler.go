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
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// MFAHandler melayani endpoint faktor kedua dengan jaminan fail-closed,
// konsumsi faktor dan challenge sekali pakai di PostgreSQL, serta pencabutan
// sesi lama pada transisi sensitif.
type MFAHandler struct {
	cfg     *config.Config
	db      *gorm.DB
	keyMat  string
	jwtKey  string
	enabled bool
}

// NewMFAHandler membuat handler MFA.
func NewMFAHandler(cfg *config.Config, db *gorm.DB, keyMaterial, jwtSecret string, enabled bool) *MFAHandler {
	return &MFAHandler{cfg: cfg, db: db, keyMat: keyMaterial, jwtKey: jwtSecret, enabled: enabled}
}

// guard memeriksa prasyarat handler. Nilai balik bool (bukan error) karena
// c.Status(x).JSON(...) mengembalikan nil pada Fiber.
func (h *MFAHandler) guard(c *fiber.Ctx) bool {
	if !h.enabled {
		_ = c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"code":    "MFA_DISABLED",
			"message": "Fitur verifikasi dua langkah tidak diaktifkan pada server ini.",
		})
		return false
	}
	if h.db == nil || h.cfg == nil || strings.TrimSpace(h.keyMat) == "" || strings.TrimSpace(h.jwtKey) == "" {
		_ = c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"code":    "MFA_SERVICE_UNAVAILABLE",
			"message": "Layanan verifikasi dua langkah belum siap.",
		})
		return false
	}
	return true
}

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

// requireFreshAuth memastikan operasi sensitif MFA (enroll/confirm/disable)
// didahului autentikasi segar <= 10 menit (lewat sesi segar, setup_token segar,
// atau verifikasi ulang kata sandi inline). Tiket SSE selalu ditolak.
func (h *MFAHandler) requireFreshAuth(c *fiber.Ctx, user *models.User, inlinePassword string, now time.Time) bool {
	if sseAuth, _ := c.Locals("sse_ticket_auth").(bool); sseAuth {
		_ = h.fail(c, fiber.StatusUnauthorized, "REAUTH_REQUIRED", "Tiket stream tidak dapat dipakai untuk mengubah pengaturan keamanan.")
		return false
	}

	if setupClaims, ok := c.Locals("mfa_setup_claims").(*mfa.SetupClaims); ok && setupClaims != nil {
		if setupClaims.IssuedAt != nil && now.Sub(setupClaims.IssuedAt.Time) <= mfa.FreshReauthMaxAge &&
			setupClaims.ExpiresAt != nil && now.Before(setupClaims.ExpiresAt.Time) {
			return true
		}
		_ = h.fail(c, fiber.StatusUnauthorized, "REAUTH_REQUIRED", "Token pendaftaran MFA sudah kedaluwarsa. Silakan login kembali.")
		return false
	}

	if claims, ok := c.Locals("claims").(*middleware.JWTClaims); ok && claims != nil {
		authAt := claims.GetAuthTime()
		if !authAt.IsZero() && now.Sub(authAt) <= mfa.FreshReauthMaxAge {
			return true
		}
	}

	pwd := strings.TrimSpace(inlinePassword)
	if pwd != "" && user != nil && (user.HasCustomPassword || user.Password != "") && user.CheckPassword(pwd) {
		return true
	}

	_ = h.fail(c, fiber.StatusUnauthorized, "REAUTH_REQUIRED",
		"Sesi autentikasi sudah melebihi 10 menit. Masukkan kata sandi saat ini atau login ulang untuk melanjutkan.")
	return false
}

func createSecurityAuditTx(tx *gorm.DB, c *fiber.Ctx, user *models.User, action, description string, extra map[string]interface{}, now time.Time) error {
	if tx == nil || user == nil {
		return mfa.ErrStorageUnavailable
	}
	payload := map[string]interface{}{}
	for k, v := range extra {
		payload[k] = v
	}
	rawChanges, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	uid := user.ID
	actorName := strings.TrimSpace(user.Name)
	if actorName == "" {
		actorName = user.Email
	}
	entry := models.ActivityLog{
		UserID:      &uid,
		EntityID:    &uid,
		EntityType:  "user",
		EntityTitle: user.Email,
		ActorRole:   user.PlatformStaffRoleLabel(),
		ActorName:   actorName,
		ActorEmail:  user.Email,
		Action:      action,
		Category:    "security",
		Description: description,
		Changes:     datatypes.JSON(rawChanges),
		IPAddress:   c.IP(),
		UserAgent:   c.Get("User-Agent"),
		CreatedAt:   now,
	}
	return tx.Create(&entry).Error
}

func resolvePrimaryStoreForSession(db *gorm.DB, full *models.User, preferredSlug string) ([]StoreSummary, StoreSummary, *models.Store) {
	storeList, activeStore := buildStoreSummaries(db, full.Stores, full.Store, preferredSlug)
	var primaryStore *models.Store
	if activeStore.ID > 0 {
		for i := range full.Stores {
			if full.Stores[i].ID == activeStore.ID {
				primaryStore = &full.Stores[i]
				break
			}
		}
		if primaryStore == nil && full.Store != nil && full.Store.ID == activeStore.ID {
			primaryStore = full.Store
		}
	} else if len(full.Stores) > 0 {
		primaryStore = &full.Stores[0]
	} else {
		primaryStore = full.Store
	}
	return storeList, activeStore, primaryStore
}

// StartEnrollment membuat secret baru yang terikat user + masa berlaku 10 menit
// dan mengembalikan otpauth URI. Faktor kedua belum aktif sebelum ConfirmEnrollment.
func (h *MFAHandler) StartEnrollment(c *fiber.Ctx) error {
	if !h.guard(c) {
		return nil
	}
	user, ok := currentUser(c)
	if !ok {
		return h.fail(c, fiber.StatusUnauthorized, "UNAUTHENTICATED", "Sesi tidak valid.")
	}

	var req struct {
		OtpChannel      string `json:"otp_channel"`
		Password        string `json:"password"`
		CurrentPassword string `json:"current_password"`
	}
	_ = c.BodyParser(&req)

	now := time.Now().UTC()
	inlinePwd := req.Password
	if strings.TrimSpace(inlinePwd) == "" {
		inlinePwd = req.CurrentPassword
	}
	if !h.requireFreshAuth(c, user, inlinePwd, now) {
		return nil
	}

	if user.TwoFactorEnabled {
		return h.fail(c, fiber.StatusConflict, "MFA_ALREADY_ENABLED",
			"Verifikasi dua langkah sudah aktif. Nonaktifkan terlebih dahulu untuk mendaftar ulang.")
	}

	secret, err := security.GenerateTOTPSecret()
	if err != nil {
		return h.fail(c, fiber.StatusInternalServerError, "MFA_SECRET_ERROR", "Gagal membuat secret.")
	}
	sealed, err := security.SealMFASecret(h.keyMat, secret)
	if err != nil {
		return h.fail(c, fiber.StatusInternalServerError, "MFA_SEAL_ERROR", "Gagal menyiapkan secret.")
	}

	setupJTI, setupExp, err := mfa.NewPendingSetupJTI(user.ID, now)
	if err != nil {
		return h.fail(c, fiber.StatusInternalServerError, "MFA_SECRET_ERROR", "Gagal menyiapkan identitas pendaftaran.")
	}

	res := h.db.Model(&models.User{}).
		Where("id = ? AND two_factor_enabled = ?", user.ID, false).
		Updates(map[string]interface{}{
			"two_factor_secret_enc":  sealed,
			"two_factor_enabled":     false,
			"two_factor_setup_jti":   setupJTI,
			"two_factor_enrolled_at": nil,
		})
	if res.Error != nil {
		return h.fail(c, fiber.StatusServiceUnavailable, "MFA_SAVE_ERROR", "Gagal menyimpan pendaftaran faktor kedua.")
	}
	if res.RowsAffected == 0 {
		return h.fail(c, fiber.StatusConflict, "MFA_ALREADY_ENABLED", "Verifikasi dua langkah sudah aktif.")
	}

	issuer := "Catavor"
	otpAuthURL := security.BuildOTPAuthURL(issuer, user.Email, secret)
	qrSVG, _ := security.GenerateQRCodeSVG(otpAuthURL, 4)
	qrDataURL, _ := security.GenerateQRCodeDataURL(otpAuthURL)
	return c.JSON(fiber.Map{
		"success": true,
		"message": "Pindai QR code dengan aplikasi authenticator, lalu kirim kode 6 digit untuk mengaktifkan.",
		"data": fiber.Map{
			"secret":       secret,
			"otpauth_url":  otpAuthURL,
			"qr_svg":       qrSVG,
			"qr_data_url":  qrDataURL,
			"issuer":       issuer,
			"account":      user.Email,
			"digits":       security.TOTPDigits,
			"period":       int(security.TOTPStep.Seconds()),
			"algorithm":    "SHA1",
			"setup_jti":    setupJTI,
			"expires_at":   setupExp,
		},
	})
}

// ConfirmEnrollment memverifikasi kode pertama di bawah row lock + CAS satu kali,
// mencabut seluruh sesi pra-MFA, menerbitkan sesi terverifikasi durable, dan
// mengembalikan kode cadangan satu kali.
func (h *MFAHandler) ConfirmEnrollment(c *fiber.Ctx) error {
	if !h.guard(c) {
		return nil
	}
	user, ok := currentUser(c)
	if !ok {
		return h.fail(c, fiber.StatusUnauthorized, "UNAUTHENTICATED", "Sesi tidak valid.")
	}

	var req struct {
		Code            string `json:"code"`
		SetupJTI        string `json:"setup_jti"`
		Password        string `json:"password"`
		CurrentPassword string `json:"current_password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return h.fail(c, fiber.StatusBadRequest, "INVALID_BODY", "Format data tidak valid.")
	}

	now := time.Now().UTC()
	inlinePwd := req.Password
	if strings.TrimSpace(inlinePwd) == "" {
		inlinePwd = req.CurrentPassword
	}
	if !h.requireFreshAuth(c, user, inlinePwd, now) {
		return nil
	}

	code := strings.TrimSpace(req.Code)
	if code == "" {
		return h.fail(c, fiber.StatusUnprocessableEntity, "CODE_REQUIRED", "Kode verifikasi wajib diisi.")
	}

	codes, hashes, err := security.GenerateBackupCodes(h.keyMat, 10)
	if err != nil {
		return h.fail(c, fiber.StatusInternalServerError, "MFA_BACKUP_ERROR", "Gagal membuat kode cadangan.")
	}
	encodedHashes, err := mfa.EncodeBackupCodeHashes(hashes)
	if err != nil {
		return h.fail(c, fiber.StatusInternalServerError, "MFA_BACKUP_ERROR", "Gagal menyimpan kode cadangan.")
	}

	setupClaims, _ := c.Locals("mfa_setup_claims").(*mfa.SetupClaims)
	existingClaims, _ := c.Locals("claims").(*middleware.JWTClaims)

	candidateTokenID := uuid.New().String()
	hours := h.cfg.JWTExpirationHours
	if hours <= 0 {
		hours = 12
	}
	newExpiresAt := now.Add(time.Duration(hours) * time.Hour)
	absExp := now.Add(7 * 24 * time.Hour)
	if existingClaims != nil && !existingClaims.GetAbsoluteExpiresAt().IsZero() {
		absExp = existingClaims.GetAbsoluteExpiresAt()
	}

	var (
		errStatus int
		errCode   string
		errMsg    string
		revoked   []string
		evicted   []string
		finalUser models.User
	)

	txErr := h.db.Transaction(func(tx *gorm.DB) error {
		var locked models.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&locked, user.ID).Error; err != nil {
			return err
		}

		if locked.TwoFactorEnabled {
			errStatus, errCode, errMsg = fiber.StatusConflict, "MFA_ALREADY_ENABLED", "Verifikasi dua langkah sudah aktif."
			return errors.New(errCode)
		}
		if locked.TwoFactorSecretEnc == nil || strings.TrimSpace(*locked.TwoFactorSecretEnc) == "" ||
			locked.TwoFactorSetupJTI == nil || strings.TrimSpace(*locked.TwoFactorSetupJTI) == "" {
			errStatus, errCode, errMsg = fiber.StatusConflict, "MFA_NOT_STARTED", "Mulai pendaftaran faktor kedua terlebih dahulu."
			return errors.New(errCode)
		}

		pendingJTI := strings.TrimSpace(*locked.TwoFactorSetupJTI)
		if strings.TrimSpace(req.SetupJTI) != "" && strings.TrimSpace(req.SetupJTI) != pendingJTI {
			errStatus, errCode, errMsg = fiber.StatusConflict, "MFA_SETUP_MISMATCH", "Identitas pendaftaran faktor kedua sudah tidak berlaku. Mulai ulang pendaftaran."
			return errors.New(errCode)
		}
		if vErr := mfa.ValidatePendingSetupJTI(pendingJTI, locked.ID, now); vErr != nil {
			errStatus, errCode, errMsg = fiber.StatusUnauthorized, "MFA_SETUP_EXPIRED", "Sesi pendaftaran faktor kedua telah kedaluwarsa. Silakan ulangi pendaftaran."
			return errors.New(errCode)
		}

		completionJTI := pendingJTI
		if setupClaims != nil {
			if setupClaims.TokenVersion <= 0 || setupClaims.TokenVersion < locked.TokenVersion {
				errStatus, errCode, errMsg = fiber.StatusUnauthorized, "PASSWORD_CHANGED", "Kredensial akun telah berubah. Silakan login ulang."
				return errors.New(errCode)
			}
			if !mfa.IsMFAMandatory(&locked) {
				errStatus, errCode, errMsg = fiber.StatusUnauthorized, "MFA_SETUP_TOKEN_INVALID", "Hak akses akun telah berubah. Silakan login ulang."
				return errors.New(errCode)
			}
			var existingComp models.MFAAuthCompletion
			cRes := tx.Select("id").Where("purpose = ? AND token_jti = ?", mfa.SetupPurpose, setupClaims.ID).Limit(1).Find(&existingComp)
			if cRes.Error != nil {
				return cRes.Error
			}
			if cRes.RowsAffected > 0 {
				errStatus, errCode, errMsg = fiber.StatusUnauthorized, "MFA_SETUP_TOKEN_USED", "Token pendaftaran MFA sudah pernah digunakan."
				return errors.New(errCode)
			}
			completionJTI = setupClaims.ID
		}

		secret, err := security.OpenMFASecret(h.keyMat, *locked.TwoFactorSecretEnc)
		if err != nil {
			errStatus, errCode, errMsg = fiber.StatusInternalServerError, "MFA_SECRET_CORRUPT", "Secret tidak bisa dibaca. Ulangi pendaftaran."
			return errors.New(errCode)
		}
		step, err := security.VerifyTOTP(secret, code, now)
		if err != nil || step <= locked.TwoFactorLastTOTPStep {
			errStatus, errCode, errMsg = fiber.StatusUnauthorized, "MFA_CODE_INVALID", "Kode verifikasi salah atau sudah kedaluwarsa."
			return errors.New(errCode)
		}

		enforced := locked.TwoFactorEnforced || locked.IsPlatformStaff()
		cas := tx.Model(&models.User{}).
			Where("id = ? AND two_factor_enabled = ? AND two_factor_setup_jti = ?", locked.ID, false, pendingJTI).
			Updates(map[string]interface{}{
				"two_factor_enabled":           true,
				"two_factor_enforced":          enforced,
				"two_factor_backup_codes_hash": encodedHashes,
				"two_factor_enrolled_at":       now,
				"two_factor_last_totp_step":    step,
				"two_factor_setup_jti":         nil,
				"token_version":                gorm.Expr("token_version + 1"),
			})
		if cas.Error != nil {
			return cas.Error
		}
		if cas.RowsAffected == 0 {
			errStatus, errCode, errMsg = fiber.StatusConflict, "MFA_ALREADY_ENABLED", "Verifikasi dua langkah sudah diaktifkan oleh permintaan lain."
			return errors.New(errCode)
		}

		if err := preloadUserStores(tx.Preload("Store")).First(&finalUser, locked.ID).Error; err != nil {
			return err
		}

		// Cabut seluruh sesi lama agar token pra-MFA tidak dapat dipakai kembali.
		var revErr error
		revoked, revErr = services.RevokeUserSessionsTx(tx, finalUser.ID, "", now)
		if revErr != nil {
			return revErr
		}

		sess, ev, sessErr := services.CreateUserSessionTx(tx, finalUser.ID, candidateTokenID, newExpiresAt, c.IP(), c.Get("User-Agent"), now)
		if sessErr != nil {
			return sessErr
		}
		evicted = ev

		sealedMeta, err := mfa.SealCompletionPayload(h.keyMat, sess.ID, candidateTokenID, finalUser.ID, mfa.FactorTOTP, now)
		if err != nil {
			return err
		}
		comp := models.MFAAuthCompletion{
			Purpose:          mfa.SetupPurpose,
			TokenJTI:         completionJTI,
			UserID:           finalUser.ID,
			FactorType:       mfa.FactorTOTP,
			SessionID:        sess.ID,
			PayloadEnc:       sealedMeta,
			Status:           "redis_committed",
			RedisCommittedAt: &now,
			CreatedAt:        now,
			UpdatedAt:        now,
			ExpiresAt:        now.Add(mfa.SetupTTL),
		}
		if err := tx.Create(&comp).Error; err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "unique") || strings.Contains(strings.ToLower(err.Error()), "duplicate") {
				errStatus, errCode, errMsg = fiber.StatusConflict, "MFA_ALREADY_ENABLED", "Pendaftaran MFA ini sudah pernah dikonfirmasi."
				return errors.New(errCode)
			}
			return err
		}

		return createSecurityAuditTx(tx, c, &finalUser, "AUTH_MFA_ENABLED", "Verifikasi dua langkah berhasil diaktifkan", map[string]interface{}{
			"enforced": finalUser.TwoFactorEnforced,
		}, now)
	})

	if txErr != nil {
		if errStatus != 0 {
			return h.fail(c, errStatus, errCode, errMsg)
		}
		return h.fail(c, fiber.StatusServiceUnavailable, "MFA_SAVE_ERROR", "Gagal mengaktifkan faktor kedua.")
	}

	services.BlacklistTokenIDs(revoked, 72*time.Hour)
	services.BlacklistTokenIDs(evicted, 72*time.Hour)

	preferredSlug := ""
	if existingClaims != nil {
		preferredSlug = existingClaims.StoreSlug
	}
	storeList, activeStore, primaryStore := resolvePrimaryStoreForSession(h.db, &finalUser, preferredSlug)

	newToken, _, _, signErr := middleware.GenerateTokenWithOptions(&finalUser, primaryStore, h.cfg, middleware.TokenOptions{
		TokenID:           candidateTokenID,
		MFAVerified:       true,
		AuthAt:            now,
		AbsoluteExpiresAt: absExp,
	})
	if signErr != nil {
		_ = services.RevokeSessionByTokenID(h.db, candidateTokenID)
		return h.fail(c, fiber.StatusInternalServerError, "SESSION_ERROR", "Gagal menerbitkan sesi terverifikasi.")
	}

	middleware.RegisterSessionFingerprint(candidateTokenID, c.IP(), c.Get("User-Agent"))
	setSessionCookie(c, h.cfg, newToken)
	c.Set("X-Refreshed-Token", newToken)

	return c.JSON(fiber.Map{
		"success":                  true,
		"message":                  "Verifikasi dua langkah aktif. Simpan kode cadangan berikut di tempat aman — kode ini tidak bisa ditampilkan lagi.",
		"token":                    newToken,
		"stores":                   storeList,
		"stores_count":             len(storeList),
		"active_store":             activeStore,
		"requires_store_selection": activeStore.ID == 0 && len(storeList) > 0,
		"is_password_changed":      finalUser.IsPasswordChanged,
		"has_custom_password":      finalUser.HasCustomPassword,
		"user": fiber.Map{
			"id":                  finalUser.ID,
			"name":                finalUser.Name,
			"email":               finalUser.Email,
			"platform_role":       finalUser.PlatformRole,
			"is_superadmin":       finalUser.IsSuperadmin(),
			"is_admin":            finalUser.IsPlatformStaff(),
			"permissions":         services.GetRBACService().GetUserPermissions(&finalUser),
			"is_password_changed": finalUser.IsPasswordChanged,
			"has_custom_password": finalUser.HasCustomPassword,
			"store_slug":          activeStore.Slug,
			"store_title":         activeStore.StoreTitle,
			"store_theme":         activeStore.StoreTheme,
			"store_plan":          activeStore.Plan,
			"payment_status":      activeStore.PaymentStatus,
			"dormancy_status":     activeStore.DormancyStatus,
			"suspension_reason":   activeStore.SuspensionReason,
			"is_blacklisted":      finalUser.IsBlacklisted || activeStore.IsBlacklisted,
		},
		"data": fiber.Map{
			"backup_codes": codes,
			"enabled_at":   now,
			"token":        newToken,
		},
	})
}

// VerifyChallenge menukar challenge MFA satu kali secara atomik menjadi sesi
// penuh durable. Cookie dan token HANYA dikirim setelah transaksi PostgreSQL berhasil commit.
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

	factor := strings.ToLower(strings.TrimSpace(req.FactorType))
	if factor != "" && factor != mfa.FactorTOTP && factor != mfa.FactorBackupCode {
		return h.fail(c, fiber.StatusUnprocessableEntity, "FACTOR_UNSUPPORTED", "Jenis faktor tidak didukung.")
	}
	if strings.TrimSpace(req.Code) == "" {
		return h.fail(c, fiber.StatusUnprocessableEntity, "CODE_REQUIRED", "Kode verifikasi wajib diisi.")
	}

	candidateTokenID := uuid.New().String()
	hours := h.cfg.JWTExpirationHours
	if hours <= 0 {
		hours = 12
	}
	expiresAt := now.Add(time.Duration(hours) * time.Hour)

	var evicted []string
	verifiedUser, usedFactor, redeemErr := mfa.RedeemChallenge(
		h.db,
		h.keyMat,
		claims,
		factor,
		req.Code,
		now,
		func(tx *gorm.DB, lockedUser *models.User) (uint, string, error) {
			sess, ev, sErr := services.CreateUserSessionTx(tx, lockedUser.ID, candidateTokenID, expiresAt, c.IP(), c.Get("User-Agent"), now)
			if sErr != nil {
				return 0, "", sErr
			}
			evicted = ev
			if aErr := createSecurityAuditTx(tx, c, lockedUser, "AUTH_MFA_SUCCESS", "Verifikasi faktor kedua berhasil", map[string]interface{}{
				"jti":    claims.ID,
				"factor": factor,
			}, now); aErr != nil {
				return 0, "", aErr
			}
			return sess.ID, candidateTokenID, nil
		},
	)

	if redeemErr != nil {
		switch {
		case errors.Is(redeemErr, mfa.ErrFactorLocked):
			return h.fail(c, fiber.StatusTooManyRequests, "MFA_LOCKED",
				"Terlalu banyak kode salah. Verifikasi faktor kedua dikunci sementara.")
		case errors.Is(redeemErr, mfa.ErrReplay):
			return h.fail(c, fiber.StatusUnauthorized, "MFA_CODE_REUSED", "Kode ini sudah dipakai. Tunggu kode berikutnya.")
		case errors.Is(redeemErr, mfa.ErrFactorInvalid):
			return h.fail(c, fiber.StatusUnauthorized, "MFA_CODE_INVALID", "Kode verifikasi salah.")
		case errors.Is(redeemErr, mfa.ErrChallengeRedeemed):
			return h.fail(c, fiber.StatusUnauthorized, "MFA_CHALLENGE_USED", "Challenge verifikasi ini sudah digunakan. Silakan login ulang.")
		case errors.Is(redeemErr, mfa.ErrChallengeExhausted):
			return h.fail(c, fiber.StatusUnauthorized, "MFA_CHALLENGE_EXHAUSTED", "Batas percobaan untuk sesi verifikasi ini telah habis. Silakan login ulang.")
		case errors.Is(redeemErr, mfa.ErrChallengeInvalid):
			return h.fail(c, fiber.StatusUnauthorized, "MFA_CHALLENGE_INVALID", "Sesi verifikasi tidak valid atau sudah kedaluwarsa. Silakan login ulang.")
		case errors.Is(redeemErr, mfa.ErrAccountBanned):
			return h.fail(c, fiber.StatusForbidden, "USER_BLACKLISTED", "Akun Anda telah dinonaktifkan.")
		case errors.Is(redeemErr, mfa.ErrNotEnrolled):
			return h.fail(c, fiber.StatusConflict, "MFA_NOT_ENROLLED", "Akun ini tidak mengaktifkan verifikasi dua langkah.")
		case errors.Is(redeemErr, mfa.ErrFactorDisabled):
			return h.fail(c, fiber.StatusUnprocessableEntity, "FACTOR_UNSUPPORTED", "Jenis faktor tidak tersedia untuk akun ini.")
		default:
			return h.fail(c, fiber.StatusServiceUnavailable, "MFA_STORAGE_ERROR", "Verifikasi faktor kedua gagal diproses.")
		}
	}
	_ = usedFactor

	var full models.User
	if err := preloadUserStores(h.db.Preload("Store")).First(&full, verifiedUser.ID).Error; err != nil {
		_ = services.RevokeSessionByTokenID(h.db, candidateTokenID)
		return h.fail(c, fiber.StatusServiceUnavailable, "MFA_STORAGE_ERROR", "Gagal memuat konteks sesi pengguna.")
	}

	storeList, activeStore, primaryStore := resolvePrimaryStoreForSession(h.db, &full, claims.StoreSlug)

	token, _, _, signErr := middleware.GenerateTokenWithOptions(&full, primaryStore, h.cfg, middleware.TokenOptions{
		TokenID:     candidateTokenID,
		MFAVerified: true,
		AuthAt:      now,
	})
	if signErr != nil {
		_ = services.RevokeSessionByTokenID(h.db, candidateTokenID)
		return h.fail(c, fiber.StatusInternalServerError, "SESSION_ERROR", "Gagal membuat sesi login.")
	}

	services.BlacklistTokenIDs(evicted, 72*time.Hour)
	middleware.RegisterSessionFingerprint(candidateTokenID, c.IP(), c.Get("User-Agent"))
	setSessionCookie(c, h.cfg, token)

	return c.JSON(fiber.Map{
		"success":                  true,
		"message":                  "Verifikasi berhasil.",
		"token":                    token,
		"stores":                   storeList,
		"stores_count":             len(storeList),
		"active_store":             activeStore,
		"requires_store_selection": activeStore.ID == 0 && len(storeList) > 0,
		"is_password_changed":      full.IsPasswordChanged,
		"has_custom_password":      full.HasCustomPassword,
		"user": fiber.Map{
			"id":                  full.ID,
			"name":                full.Name,
			"email":               full.Email,
			"platform_role":       full.PlatformRole,
			"is_superadmin":       full.IsSuperadmin(),
			"is_admin":            full.IsPlatformStaff(),
			"permissions":         services.GetRBACService().GetUserPermissions(&full),
			"is_password_changed": full.IsPasswordChanged,
			"has_custom_password": full.HasCustomPassword,
			"store_slug":          activeStore.Slug,
			"store_title":         activeStore.StoreTitle,
			"store_theme":         activeStore.StoreTheme,
			"store_plan":          activeStore.Plan,
			"payment_status":      activeStore.PaymentStatus,
			"dormancy_status":     activeStore.DormancyStatus,
			"suspension_reason":   activeStore.SuspensionReason,
			"is_blacklisted":      full.IsBlacklisted || activeStore.IsBlacklisted,
		},
	})
}

// Disable menonaktifkan faktor kedua bagi merchant opt-in setelah re-autentikasi
// segar <= 10 menit dan pembuktian faktor kedua aktif, lalu mencabut seluruh sesi lama.
// Akun staf platform kanonik dan akun enforced DILARANG menonaktifkan MFA.
func (h *MFAHandler) Disable(c *fiber.Ctx) error {
	if !h.guard(c) {
		return nil
	}
	user, ok := currentUser(c)
	if !ok {
		return h.fail(c, fiber.StatusUnauthorized, "UNAUTHENTICATED", "Sesi tidak valid.")
	}

	if mfa.IsMFAMandatory(user) {
		return h.fail(c, fiber.StatusForbidden, "MFA_MANDATORY_FOR_STAFF",
			"Akun staf platform wajib menggunakan verifikasi dua langkah dan tidak dapat menonaktifkannya.")
	}
	if !user.TwoFactorEnabled {
		return h.fail(c, fiber.StatusConflict, "MFA_NOT_ENROLLED", "Verifikasi dua langkah belum aktif.")
	}

	var req struct {
		Code            string `json:"code"`
		FactorType      string `json:"factor_type"`
		Password        string `json:"password"`
		CurrentPassword string `json:"current_password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return h.fail(c, fiber.StatusBadRequest, "INVALID_BODY", "Format data tidak valid.")
	}

	now := time.Now().UTC()
	inlinePwd := req.Password
	if strings.TrimSpace(inlinePwd) == "" {
		inlinePwd = req.CurrentPassword
	}
	if !h.requireFreshAuth(c, user, inlinePwd, now) {
		return nil
	}
	if strings.TrimSpace(req.Code) == "" {
		return h.fail(c, fiber.StatusUnprocessableEntity, "CODE_REQUIRED", "Kode verifikasi wajib diisi.")
	}

	existingClaims, _ := c.Locals("claims").(*middleware.JWTClaims)
	failureCtx := "disable-u"
	if existingClaims != nil && existingClaims.ID != "" {
		failureCtx = "disable:" + existingClaims.ID
	}

	candidateTokenID := uuid.New().String()
	hours := h.cfg.JWTExpirationHours
	if hours <= 0 {
		hours = 12
	}
	newExpiresAt := now.Add(time.Duration(hours) * time.Hour)
	absExp := now.Add(7 * 24 * time.Hour)
	if existingClaims != nil && !existingClaims.GetAbsoluteExpiresAt().IsZero() {
		absExp = existingClaims.GetAbsoluteExpiresAt()
	}

	var (
		staffBlocked bool
		notEnrolled  bool
		revoked      []string
		evicted      []string
		updatedUser  models.User
	)

	_, stepErr := mfa.VerifyStepUpAndMutate(
		h.db,
		h.keyMat,
		user.ID,
		req.Code,
		req.FactorType,
		failureCtx,
		now,
		func(tx *gorm.DB, lockedUser *models.User, usedFactor string) error {
			if mfa.IsMFAMandatory(lockedUser) {
				staffBlocked = true
				return errors.New("MFA_MANDATORY_FOR_STAFF")
			}

			cas := tx.Model(&models.User{}).
				Where("id = ? AND two_factor_enabled = ? AND two_factor_enforced = ?", lockedUser.ID, true, false).
				Updates(map[string]interface{}{
					"two_factor_enabled":           false,
					"two_factor_secret_enc":        nil,
					"two_factor_backup_codes_hash": nil,
					"two_factor_enrolled_at":       nil,
					"two_factor_setup_jti":         nil,
					"two_factor_last_totp_step":    0,
					"token_version":                gorm.Expr("token_version + 1"),
				})
			if cas.Error != nil {
				return cas.Error
			}
			if cas.RowsAffected == 0 {
				notEnrolled = true
				return errors.New("MFA_NOT_ENROLLED")
			}

			if err := preloadUserStores(tx.Preload("Store")).First(&updatedUser, lockedUser.ID).Error; err != nil {
				return err
			}

			var revErr error
			revoked, revErr = services.RevokeUserSessionsTx(tx, updatedUser.ID, "", now)
			if revErr != nil {
				return revErr
			}

			_, ev, sErr := services.CreateUserSessionTx(tx, updatedUser.ID, candidateTokenID, newExpiresAt, c.IP(), c.Get("User-Agent"), now)
			if sErr != nil {
				return sErr
			}
			evicted = ev

			return createSecurityAuditTx(tx, c, &updatedUser, "AUTH_MFA_DISABLED", "Verifikasi dua langkah dinonaktifkan oleh pengguna", map[string]interface{}{
				"factor": usedFactor,
			}, now)
		},
	)

	if stepErr != nil {
		switch {
		case staffBlocked:
			return h.fail(c, fiber.StatusForbidden, "MFA_MANDATORY_FOR_STAFF",
				"Akun staf platform wajib menggunakan verifikasi dua langkah dan tidak dapat menonaktifkannya.")
		case notEnrolled || errors.Is(stepErr, mfa.ErrNotEnrolled):
			return h.fail(c, fiber.StatusConflict, "MFA_NOT_ENROLLED", "Verifikasi dua langkah belum aktif.")
		case errors.Is(stepErr, mfa.ErrFactorLocked):
			return h.fail(c, fiber.StatusTooManyRequests, "MFA_LOCKED",
				"Terlalu banyak kode salah. Verifikasi faktor kedua dikunci sementara.")
		case errors.Is(stepErr, mfa.ErrReplay):
			return h.fail(c, fiber.StatusUnauthorized, "MFA_CODE_REUSED", "Kode ini sudah dipakai. Tunggu kode berikutnya.")
		case errors.Is(stepErr, mfa.ErrFactorInvalid):
			return h.fail(c, fiber.StatusUnauthorized, "MFA_CODE_INVALID", "Kode verifikasi salah.")
		case errors.Is(stepErr, mfa.ErrFactorDisabled):
			return h.fail(c, fiber.StatusUnprocessableEntity, "FACTOR_UNSUPPORTED", "Jenis faktor tidak didukung.")
		default:
			return h.fail(c, fiber.StatusServiceUnavailable, "MFA_SAVE_ERROR", "Gagal menonaktifkan faktor kedua.")
		}
	}

	services.BlacklistTokenIDs(revoked, 72*time.Hour)
	services.BlacklistTokenIDs(evicted, 72*time.Hour)

	preferredSlug := ""
	if existingClaims != nil {
		preferredSlug = existingClaims.StoreSlug
	}
	_, _, primaryStore := resolvePrimaryStoreForSession(h.db, &updatedUser, preferredSlug)

	newToken, _, _, signErr := middleware.GenerateTokenWithOptions(&updatedUser, primaryStore, h.cfg, middleware.TokenOptions{
		TokenID:           candidateTokenID,
		MFAVerified:       false,
		AuthAt:            now,
		AbsoluteExpiresAt: absExp,
	})
	if signErr != nil {
		_ = services.RevokeSessionByTokenID(h.db, candidateTokenID)
		return h.fail(c, fiber.StatusInternalServerError, "SESSION_ERROR", "Gagal memperbarui sesi setelah penonaktifan MFA.")
	}

	middleware.RegisterSessionFingerprint(candidateTokenID, c.IP(), c.Get("User-Agent"))
	setSessionCookie(c, h.cfg, newToken)
	c.Set("X-Refreshed-Token", newToken)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Verifikasi dua langkah telah dinonaktifkan.",
		"token":   newToken,
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
			"enabled":            user.TwoFactorEnabled,
			"enforced":           mfa.IsMFAMandatory(user),
			"mandatory_for_role": user.IsPlatformStaff(),
			"backup_codes_left":  backupCodes,
			"enrolled_at":        user.TwoFactorEnrolledAt,
		},
	})
}
