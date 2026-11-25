package middleware

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
	"catavor-backend/internal/mfa"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"
	"catavor-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SECURITY (N-30): satu sumber kebenaran untuk klaim iss/aud.
// Dipakai saat menerbitkan token DAN saat memverifikasinya, supaya nilai
// yang diset tidak pernah menyimpang dari yang divalidasi.
const (
	JWTIssuer   = "catavor-saas"
	JWTAudience = "catavor-web"
)

type JWTClaims struct {
	UserID            uint             `json:"user_id"`
	Email             string           `json:"email"`
	Name              string           `json:"name"`
	StoreSlug         string           `json:"store_slug"`
	StoreID           uint             `json:"store_id"`
	IsPasswordChanged bool             `json:"is_password_changed"`
	TokenVersion      int              `json:"token_version"`
	MfaVerified       bool             `json:"mfa_verified,omitempty"`
	AuthAt            *jwt.NumericDate `json:"auth_at,omitempty"`
	AbsoluteExpiresAt *jwt.NumericDate `json:"abs_exp,omitempty"`
	jwt.RegisteredClaims
}

// TokenOptions mengontrol klaim keamanan saat menerbitkan atau merotasi token sesi.
type TokenOptions struct {
	TokenID           string
	MFAVerified       bool
	AuthAt            time.Time
	AbsoluteExpiresAt time.Time
}

func (c *JWTClaims) GetAbsoluteExpiresAt() time.Time {
	if c != nil && c.AbsoluteExpiresAt != nil {
		return c.AbsoluteExpiresAt.Time
	}
	return time.Time{}
}

// GetAuthTime mengembalikan waktu autentikasi kredensial asli (bukan waktu rotasi sliding),
// digunakan untuk memeriksa kesegaran re-autentikasi (<= 10 menit).
func (c *JWTClaims) GetAuthTime() time.Time {
	if c == nil {
		return time.Time{}
	}
	if c.AuthAt != nil && !c.AuthAt.Time.IsZero() {
		return c.AuthAt.Time
	}
	if c.IssuedAt != nil && !c.IssuedAt.Time.IsZero() {
		return c.IssuedAt.Time
	}
	return time.Time{}
}

func (c *JWTClaims) IsAbsoluteExpired() bool {
	if c == nil || c.AbsoluteExpiresAt == nil {
		return false
	}
	return time.Now().After(c.AbsoluteExpiresAt.Time)
}

// GenerateTokenWithOptions menerbitkan JWT sesi penuh (audience catavor-web)
// dengan kontrol eksplisit atas status MFA, waktu autentikasi asli, dan JTI.
func GenerateTokenWithOptions(user *models.User, store *models.Store, cfg *config.Config, opts TokenOptions) (string, string, time.Time, error) {
	if user == nil || cfg == nil || strings.TrimSpace(cfg.JWTSecret) == "" {
		return "", "", time.Time{}, errors.New("invalid token parameters")
	}

	var storeSlug string
	var storeID uint
	if store != nil {
		storeSlug = store.Slug
		storeID = store.ID
	}

	tokenVersion := user.TokenVersion
	if tokenVersion <= 0 {
		tokenVersion = 1
	}

	now := time.Now().UTC()
	tokenID := strings.TrimSpace(opts.TokenID)
	if tokenID == "" {
		tokenID = uuid.New().String()
	}

	hours := cfg.JWTExpirationHours
	if hours <= 0 {
		hours = 12
	}
	expiresAt := now.Add(time.Duration(hours) * time.Hour)

	authAt := opts.AuthAt
	if authAt.IsZero() {
		authAt = now
	}

	absExp := opts.AbsoluteExpiresAt
	if absExp.IsZero() {
		absExp = now.Add(7 * 24 * time.Hour)
	}

	claims := JWTClaims{
		UserID:            user.ID,
		Email:             user.Email,
		Name:              user.Name,
		StoreSlug:         storeSlug,
		StoreID:           storeID,
		IsPasswordChanged: user.IsPasswordChanged,
		TokenVersion:      tokenVersion,
		MfaVerified:       opts.MFAVerified,
		AuthAt:            jwt.NewNumericDate(authAt),
		AbsoluteExpiresAt: jwt.NewNumericDate(absExp),
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        tokenID,
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now.Add(-30 * time.Second)),
			Issuer:    JWTIssuer,
			Audience:  jwt.ClaimStrings{JWTAudience},
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		return "", "", time.Time{}, err
	}
	return signedToken, tokenID, expiresAt, nil
}

// GenerateSlidingTokenWithID creates a cryptographically signed JWT token preserving user claims and absolute expiration.
func GenerateSlidingTokenWithID(user *models.User, store *models.Store, cfg *config.Config, absExp time.Time) (string, string, time.Time, error) {
	return GenerateTokenWithOptions(user, store, cfg, TokenOptions{
		MFAVerified:       false,
		AbsoluteExpiresAt: absExp,
	})
}

// GenerateSlidingTokenWithIDVerified menerbitkan token sliding dengan klaim mfa_verified=true.
func GenerateSlidingTokenWithIDVerified(user *models.User, store *models.Store, cfg *config.Config, absExp time.Time) (string, string, time.Time, error) {
	return GenerateTokenWithOptions(user, store, cfg, TokenOptions{
		MFAVerified:       true,
		AbsoluteExpiresAt: absExp,
	})
}

// GenerateTokenWithID creates a cryptographically signed JWT token with algorithm pinning and returns token string, jti UUID, and expiresAt.
func GenerateTokenWithID(user *models.User, store *models.Store, cfg *config.Config) (string, string, time.Time, error) {
	return GenerateTokenWithOptions(user, store, cfg, TokenOptions{
		MFAVerified: false,
	})
}

// GenerateTokenWithIDVerified menerbitkan JWT sesi penuh yang telah terverifikasi faktor kedua.
func GenerateTokenWithIDVerified(user *models.User, store *models.Store, cfg *config.Config) (string, string, time.Time, error) {
	return GenerateTokenWithOptions(user, store, cfg, TokenOptions{
		MFAVerified: true,
	})
}

// GenerateToken creates a cryptographically signed JWT token with algorithm pinning (backwards compatible)
func GenerateToken(user *models.User, store *models.Store, cfg *config.Config) (string, error) {
	token, _, _, err := GenerateTokenWithID(user, store, cfg)
	return token, err
}

// ParseJWTClaims safely validates and parses a token string with algorithm pinning and issuer/audience checks.
func ParseJWTClaims(tokenString, secret string) (*JWTClaims, error) {
	return parseJWTClaims(tokenString, secret)
}

// parseJWTClaims safely validates and parses a token string with algorithm pinning and issuer/audience checks.
func parseJWTClaims(tokenString, secret string) (*JWTClaims, error) {
	if tokenString == "" || secret == "" {
		return nil, errors.New("empty token or secret")
	}
	claims := &JWTClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing algorithm")
		}
		return []byte(secret), nil
	},
		jwt.WithValidMethods([]string{"HS256"}),
		jwt.WithIssuer(JWTIssuer),
		jwt.WithAudience(JWTAudience),
	)
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

// ExtractOptionalClaims safely parses a Bearer token or token query without throwing HTTP 401.
// Returns nil if token is missing or invalid.
func ExtractOptionalClaims(c *fiber.Ctx, cfg *config.Config) *JWTClaims {
	if cfg == nil || cfg.JWTSecret == "" {
		return nil
	}
	if cookieToken := strings.TrimSpace(c.Cookies(SessionCookieName)); cookieToken != "" {
		if claims, err := parseJWTClaims(cookieToken, cfg.JWTSecret); err == nil {
			return claims
		}
	}
	authHeader := c.Get("Authorization")
	if authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
			bearerToken := strings.TrimSpace(parts[1])
			if claims, err := parseJWTClaims(bearerToken, cfg.JWTSecret); err == nil {
				return claims
			}
		}
	}
	return nil
}

// ExtractVerifiedOptionalClaims safely extracts claims and verifies that the token
// is NOT blacklisted, has not been revoked, and matches the active user state.
// Returns nil if absent, expired, revoked, or untrusted.
func ExtractVerifiedOptionalClaims(c *fiber.Ctx, db *gorm.DB, cfg *config.Config) *JWTClaims {
	claims := ExtractOptionalClaims(c, cfg)
	if claims == nil || claims.ID == "" {
		return nil
	}
	if database.IsTokenBlacklisted(claims.ID) {
		return nil
	}
	if db != nil && claims.UserID > 0 {
		var user models.User
		if err := db.Select("id, token_version, is_blacklisted").First(&user, claims.UserID).Error; err != nil {
			return nil
		}
		if user.IsBlacklisted || user.TokenVersion != claims.TokenVersion {
			return nil
		}
	}
	return claims
}

// MfaGateDecision merepresentasikan putusan gerbang MFA terpusat pada middleware sesi.
type MfaGateDecision struct {
	RequireCode string
	Status      int
	Message     string
}

// MfaPolicyFor mengevaluasi kebijakan MFA tunggal untuk semua sesi yang masuk.
// Mengembalikan nil jika diizinkan, atau *MfaGateDecision jika wajib diblokir.
func MfaPolicyFor(user *models.User, claims *JWTClaims, cfg *config.Config) *MfaGateDecision {
	if user == nil {
		return &MfaGateDecision{
			RequireCode: "INTERNAL",
			Status:      fiber.StatusInternalServerError,
			Message:     "Pemeriksaan keamanan sesi gagal.",
		}
	}

	mandatory := mfa.IsMFAMandatory(user)
	mfaEnabled := cfg != nil && cfg.MFAEnabled
	hasMFAKey := cfg != nil && strings.TrimSpace(cfg.MFAEncryptionKey) != ""

	// Akun wajib-MFA (staf platform kanonik atau akun enforced) TIDAK boleh
	// lolos walau feature flag dimatikan atau konfigurasi kunci kosong.
	if mandatory && (!mfaEnabled || !hasMFAKey) {
		return &MfaGateDecision{
			RequireCode: "MFA_SERVICE_UNAVAILABLE",
			Status:      fiber.StatusServiceUnavailable,
			Message:     "Layanan verifikasi dua langkah wajib aktif bagi staf platform.",
		}
	}

	if mandatory && !user.TwoFactorEnabled {
		return &MfaGateDecision{
			RequireCode: "MFA_SETUP_REQUIRED",
			Status:      fiber.StatusForbidden,
			Message:     "Akun staf platform wajib mengaktifkan verifikasi dua langkah (MFA) sebelum mengakses sistem.",
		}
	}

	if user.TwoFactorEnabled && (mandatory || mfaEnabled) {
		if !hasMFAKey {
			return &MfaGateDecision{
				RequireCode: "MFA_SERVICE_UNAVAILABLE",
				Status:      fiber.StatusServiceUnavailable,
				Message:     "Konfigurasi keamanan verifikasi dua langkah belum tersedia.",
			}
		}
		if claims != nil && claims.MfaVerified {
			return nil
		}
		return &MfaGateDecision{
			RequireCode: "MFA_REQUIRED",
			Status:      fiber.StatusPreconditionRequired,
			Message:     "Kode verifikasi dua langkah dibutuhkan untuk melanjutkan sesi.",
		}
	}

	return nil
}

// SECURITY (M1): nama cookie sesi. HttpOnly + Secure + SameSite=Strict,
// sehingga JavaScript tidak bisa membacanya — token tidak lagi rentan dicuri XSS.
const SessionCookieName = "catavor_session"

// AuthRequired validates the JWT Bearer token.
// Urutan sumber kredensial:
//  1. HttpOnly cookie (cara yang benar, kebal XSS)
//  2. Authorization: Bearer header (fallback kompatibilitas klien lama)
//  3. ?ticket= sekali pakai (khusus EventSource/SSE yang tak bisa kirim header)
func AuthRequired(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if database.DB == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"success": false,
				"code":    "AUTH_STORAGE_UNAVAILABLE",
				"message": "Layanan autentikasi belum siap.",
			})
		}

		// SECURITY (M1/SSE): tiket sekali pakai untuk EventSource.
		if ticket := strings.TrimSpace(c.Query("ticket")); ticket != "" {
			meta, ok := security.ConsumeSSETicketWithMeta(ticket)
			if !ok || meta.UserID == 0 {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"success": false,
					"code":    "INVALID_TICKET",
					"message": "Tiket stream tidak valid atau sudah kedaluwarsa.",
				})
			}

			var user models.User
			if err := database.DB.Preload("Stores", func(db *gorm.DB) *gorm.DB {
				return db.Where("dormancy_status != 'banned' AND is_blacklisted = false")
			}).Preload("Store", func(db *gorm.DB) *gorm.DB {
				return db.Where("dormancy_status != 'banned' AND is_blacklisted = false")
			}).First(&user, meta.UserID).Error; err != nil {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"success": false,
					"code":    "USER_NOT_FOUND",
					"message": "Pengguna tidak ditemukan atau telah dinonaktifkan.",
				})
			}

			if meta.TokenVersion > 0 && meta.TokenVersion < user.TokenVersion {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"success": false,
					"code":    "PASSWORD_CHANGED",
					"message": "Sesi Anda telah dicabut. Silakan login kembali.",
				})
			}

			isTicketAdmin := user.IsPlatformStaff()
			if !isTicketAdmin && user.IsBlacklisted {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"success": false,
					"code":    "ACCOUNT_BANNED",
					"message": "Akun Anda telah dinonaktifkan.",
				})
			}

			ticketClaims := &JWTClaims{
				UserID:       user.ID,
				TokenVersion: user.TokenVersion,
				MfaVerified:  meta.MFAVerified,
			}
			if decision := MfaPolicyFor(&user, ticketClaims, cfg); decision != nil {
				return c.Status(decision.Status).JSON(fiber.Map{
					"success": false,
					"code":    decision.RequireCode,
					"message": decision.Message,
				})
			}

			c.Locals("user", &user)
			c.Locals("user_id", user.ID)
			c.Locals("claims", ticketClaims)
			c.Locals("sse_ticket_auth", true)

			var activeStore *models.Store
			if requestedSlug := strings.TrimSpace(c.Query("slug")); requestedSlug != "" {
				for i := range user.Stores {
					if strings.EqualFold(user.Stores[i].Slug, requestedSlug) {
						activeStore = &user.Stores[i]
						break
					}
				}
			}
			if activeStore == nil && len(user.Stores) > 0 {
				activeStore = &user.Stores[0]
			}
			if activeStore == nil {
				activeStore = user.Store
			}
			if activeStore != nil {
				c.Locals("store", activeStore)
				c.Locals("store_id", activeStore.ID)
				c.Locals("store_slug", activeStore.Slug)
			}

			return c.Next()
		}

		// Token extraction: Layer 1 (Cookie) & Layer 2 (Bearer Header)
		cookieToken := strings.TrimSpace(c.Cookies(SessionCookieName))
		var bearerToken string
		authHeader := c.Get("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
				bearerToken = strings.TrimSpace(parts[1])
			} else if cookieToken == "" {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"success": false,
					"code":    "INVALID_TOKEN_FORMAT",
					"message": "Invalid authorization token format.",
				})
			}
		}

		if cookieToken == "" && bearerToken == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "UNAUTHENTICATED",
				"message": "Unauthenticated.",
			})
		}

		// Validation with Layer 3 Fallback:
		// Try Bearer token first if supplied; if expired/invalid but Cookie is valid, fallback to Cookie!
		var claims *JWTClaims
		var tokenErr error

		if bearerToken != "" {
			claims, tokenErr = parseJWTClaims(bearerToken, cfg.JWTSecret)
			if (tokenErr != nil || claims == nil) && cookieToken != "" {
				if cClaims, cErr := parseJWTClaims(cookieToken, cfg.JWTSecret); cErr == nil && cClaims != nil {
					claims = cClaims
					tokenErr = nil
				}
			}
		} else if cookieToken != "" {
			claims, tokenErr = parseJWTClaims(cookieToken, cfg.JWTSecret)
		}

		if tokenErr != nil || claims == nil {
			errCode := "TOKEN_EXPIRED"
			errMsg := "Sesi login Anda telah berakhir. Silakan masuk kembali."
			if tokenErr != nil && strings.Contains(strings.ToLower(tokenErr.Error()), "malformed") {
				errCode = "INVALID_TOKEN"
				errMsg = "Token otentikasi tidak valid."
			}
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    errCode,
				"message": errMsg,
			})
		}

		// Absolute Session Expiration Enforcement (N-55 / REV-R3-05)
		if claims.IsAbsoluteExpired() {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "SESSION_ABSOLUTE_EXPIRED",
				"message": "Sesi login telah mencapai batas maksimum (7 hari). Silakan login kembali.",
			})
		}

		// Sesi penuh wajib memiliki JTI dan baris UserSession durable yang belum dicabut (fail-closed).
		if strings.TrimSpace(claims.ID) == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "INVALID_TOKEN",
				"message": "Identitas sesi tidak valid.",
			})
		}

		if database.IsTokenBlacklisted(claims.ID) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "SESSION_REVOKED",
				"message": "Sesi login telah dicabut atau Anda telah logout. Silakan masuk kembali.",
			})
		}

		var sess models.UserSession
		sessRes := database.DB.Select("id, user_id, is_revoked, expires_at").
			Where("token_id = ? AND user_id = ?", claims.ID, claims.UserID).
			Limit(1).
			Find(&sess)
		if sessRes.Error != nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"success": false,
				"code":    "AUTH_STORAGE_ERROR",
				"message": "Gagal memverifikasi status sesi pengguna.",
			})
		}
		if sessRes.RowsAffected == 0 || sess.IsRevoked || !time.Now().UTC().Before(sess.ExpiresAt) {
			if sessRes.RowsAffected > 0 && sess.IsRevoked {
				ttl := 72 * time.Hour
				if claims.ExpiresAt != nil {
					if remaining := time.Until(claims.ExpiresAt.Time); remaining > 0 {
						ttl = remaining
					}
				}
				database.BlacklistToken(claims.ID, ttl)
			}
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "SESSION_REVOKED",
				"message": "Sesi login telah dicabut atau tidak ditemukan. Silakan masuk kembali.",
			})
		}

		// Retrieve user and their stores from DB to guarantee freshest state
		var user models.User
		if err := database.DB.Preload("Stores", func(db *gorm.DB) *gorm.DB {
			return db.Where("dormancy_status != 'banned' AND is_blacklisted = false")
		}).Preload("Store", func(db *gorm.DB) *gorm.DB {
			return db.Where("dormancy_status != 'banned' AND is_blacklisted = false")
		}).First(&user, claims.UserID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"success": false,
					"code":    "USER_NOT_FOUND",
					"message": "Pengguna tidak ditemukan atau telah dinonaktifkan.",
				})
			}
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"success": false,
				"code":    "AUTH_STORAGE_ERROR",
				"message": "Gagal memuat profil keamanan pengguna.",
			})
		}

		// Security Check: Verify global token version (e.g. password reset or credential invalidation)
		if claims.TokenVersion <= 0 || claims.TokenVersion < user.TokenVersion {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "PASSWORD_CHANGED",
				"message": "Kata sandi atau hak akses akun Anda telah diperbarui. Silakan login kembali dengan kredensial terbaru.",
			})
		}

		// SECURITY (M1-mitigasi): deteksi token yang dipakai dari IP/UA berbeda
		CheckSessionFingerprint(c, claims.ID, user.ID)

		// SECURITY (N-05): gunakan whitelist terpusat (satu sumber kebenaran).
		isPlatformAdmin := user.IsPlatformStaff()

		if !isPlatformAdmin && user.IsBlacklisted {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "ACCOUNT_BANNED",
				"message": "Akun dan profil katalog Anda telah dinonaktifkan secara permanen karena pelanggaran pedoman platform. Sesi login telah dicabut.",
			})
		}

		if !isPlatformAdmin && len(user.Stores) == 0 && user.Store == nil {
			var totalStoresCount int64
			database.DB.Model(&models.Store{}).Where("user_id = ?", user.ID).Count(&totalStoresCount)
			if totalStoresCount > 0 {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"success": false,
					"code":    "ACCOUNT_BANNED",
					"message": "Seluruh profil katalog Anda telah dinonaktifkan secara permanen oleh platform karena pelanggaran kepatuhan. Sesi login telah dicabut.",
				})
			}
		}

		// MFA gate: satu kebijakan untuk semua jalur penerbitan sesi.
		// PENTING: kembalikan respons blokir secara eksplisit tanpa memanggil c.Next().
		if decision := MfaPolicyFor(&user, claims, cfg); decision != nil {
			return c.Status(decision.Status).JSON(fiber.Map{
				"success": false,
				"code":    decision.RequireCode,
				"message": decision.Message,
			})
		}

		c.Locals("user", &user)
		c.Locals("user_id", user.ID)
		c.Locals("claims", claims)

		// Determine initial store context
		var activeStore *models.Store
		if claims.StoreSlug != "" {
			for i := range user.Stores {
				if strings.EqualFold(user.Stores[i].Slug, claims.StoreSlug) {
					activeStore = &user.Stores[i]
					break
				}
			}
		}
		if activeStore == nil && len(user.Stores) > 0 {
			activeStore = &user.Stores[0]
		}
		if activeStore == nil {
			activeStore = user.Store
		}

		if activeStore != nil {
			c.Locals("store", activeStore)
			c.Locals("store_id", activeStore.ID)
			c.Locals("store_slug", activeStore.Slug)
		}

		// Silent Sliding Session Rotation (N-55)
		if claims.ID != "" && claims.ExpiresAt != nil {
			tokenHours := cfg.JWTExpirationHours
			if tokenHours <= 0 {
				tokenHours = 24
			}
			tokenDuration := time.Duration(tokenHours) * time.Hour
			halfLife := tokenDuration / 2
			remaining := time.Until(claims.ExpiresAt.Time)

			if remaining > 0 && remaining <= halfLife && !claims.IsAbsoluteExpired() {
				lockKey := "sec:slide_lock:" + claims.ID
				canRotate := true
				if database.IsRedisAvailable() && database.RedisClient != nil {
					acquired, err := database.RedisClient.SetNX(context.Background(), lockKey, "1", 60*time.Second).Result()
					if err != nil || !acquired {
						canRotate = false
					}
				}

				if canRotate {
					absExp := claims.GetAbsoluteExpiresAt()
					if absExp.IsZero() {
						absExp = time.Now().Add(7 * 24 * time.Hour)
					}
					newToken, newJTI, newExpiresAt, err := GenerateTokenWithOptions(&user, activeStore, cfg, TokenOptions{
						MFAVerified:       claims.MfaVerified,
						AuthAt:            claims.GetAuthTime(),
						AbsoluteExpiresAt: absExp,
					})
					if err == nil {
						// Persist rotasi di DB terlebih dahulu; bila DB gagal, pertahankan token aktif saat ini.
						if rotErr := services.RotateUserSessionTokenStrict(database.DB, user.ID, claims.ID, newJTI, newExpiresAt, c.IP()); rotErr == nil {
							SetSessionCookie(c, cfg, newToken)
							c.Set("X-Refreshed-Token", newToken)
							database.BlacklistTokenWithGracePeriod(claims.ID, 30*time.Second, remaining)
							RegisterSessionFingerprint(newJTI, c.IP(), c.Get("User-Agent"))
							claims.ID = newJTI
							c.Locals("claims", claims)
						}
					}
				}
			}
		}

		// Heartbeat / Last Seen Tracking (Throttled 5 menit di dalam TouchUserSession)
		if claims.ID != "" {
			clientIP := c.IP()
			go services.TouchUserSession(claims.ID, clientIP)
		}

		return c.Next()
	}
}

// isUnverifiedSetupToken memeriksa apakah token mentah membawa klaim audience/purpose
// setup MFA tanpa menerima validasinya, untuk mencegah fallback ke cookie basi
// ketika pemanggil sengaja mengirim setup_token yang rusak/kedaluwarsa.
func isUnverifiedSetupToken(tokenString string) bool {
	parser := jwt.NewParser()
	claims := &mfa.SetupClaims{}
	_, _, err := parser.ParseUnverified(tokenString, claims)
	if err != nil {
		return false
	}
	if claims.Purpose == mfa.SetupPurpose {
		return true
	}
	for _, aud := range claims.Audience {
		if aud == mfa.SetupAudience {
			return true
		}
	}
	return false
}

// AuthOrMFASetupRequired HANYA dipasang pada endpoint pendaftaran MFA
// (/api/auth/mfa/status, /enroll, /confirm). Middleware ini menerima:
//  1. setup_token berumur pendek milik staf wajib-MFA yang belum terdaftar, ATAU
//  2. sesi penuh yang valid melalui AuthRequired.
// setup_token tidak pernah diterima oleh AuthRequired pada rute bisnis/admin lainnya.
func AuthOrMFASetupRequired(cfg *config.Config) fiber.Handler {
	fullAuth := AuthRequired(cfg)
	return func(c *fiber.Ctx) error {
		authHeader := strings.TrimSpace(c.Get("Authorization"))
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
				rawBearer := strings.TrimSpace(parts[1])
				if rawBearer != "" && cfg != nil && strings.TrimSpace(cfg.JWTSecret) != "" {
					now := time.Now().UTC()
					if setupClaims, err := mfa.ParseSetupToken(cfg.JWTSecret, rawBearer, now); err == nil && setupClaims != nil {
						if !cfg.MFAEnabled || strings.TrimSpace(cfg.MFAEncryptionKey) == "" || database.DB == nil {
							return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
								"success": false,
								"code":    "MFA_SERVICE_UNAVAILABLE",
								"message": "Layanan pendaftaran MFA belum siap.",
							})
						}
						used, uErr := mfa.IsTokenJTIUsed(database.DB, mfa.SetupPurpose, setupClaims.ID)
						if uErr != nil {
							return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
								"success": false,
								"code":    "AUTH_STORAGE_ERROR",
								"message": "Gagal memeriksa status token pendaftaran MFA.",
							})
						}
						if used {
							return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
								"success": false,
								"code":    "MFA_SETUP_TOKEN_USED",
								"message": "Token pendaftaran MFA sudah pernah digunakan. Silakan login kembali.",
							})
						}

						var user models.User
						if err := database.DB.Preload("Stores", func(db *gorm.DB) *gorm.DB {
							return db.Where("dormancy_status != 'banned' AND is_blacklisted = false")
						}).Preload("Store", func(db *gorm.DB) *gorm.DB {
							return db.Where("dormancy_status != 'banned' AND is_blacklisted = false")
						}).First(&user, setupClaims.UserID).Error; err != nil {
							if errors.Is(err, gorm.ErrRecordNotFound) {
								return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
									"success": false,
									"code":    "USER_NOT_FOUND",
									"message": "Pengguna tidak ditemukan.",
								})
							}
							return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
								"success": false,
								"code":    "AUTH_STORAGE_ERROR",
								"message": "Gagal memuat akun pengguna.",
							})
						}

						if setupClaims.TokenVersion <= 0 || setupClaims.TokenVersion < user.TokenVersion {
							return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
								"success": false,
								"code":    "PASSWORD_CHANGED",
								"message": "Kredensial akun telah berubah. Silakan login ulang.",
							})
						}
						if !user.IsPlatformStaff() && user.IsBlacklisted {
							return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
								"success": false,
								"code":    "ACCOUNT_BANNED",
								"message": "Akun Anda telah dinonaktifkan.",
							})
						}
						if !mfa.IsMFAMandatory(&user) {
							return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
								"success": false,
								"code":    "MFA_SETUP_TOKEN_INVALID",
								"message": "Hak akses akun telah berubah. Silakan login kembali.",
							})
						}
						if user.TwoFactorEnabled {
							return c.Status(fiber.StatusConflict).JSON(fiber.Map{
								"success": false,
								"code":    "MFA_ALREADY_ENABLED",
								"message": "Verifikasi dua langkah sudah aktif. Silakan masuk dengan kode authenticator.",
							})
						}

						c.Locals("user", &user)
						c.Locals("user_id", user.ID)
						c.Locals("mfa_setup_claims", setupClaims)
						return c.Next()
					}
					if isUnverifiedSetupToken(rawBearer) {
						return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
							"success": false,
							"code":    "MFA_SETUP_TOKEN_INVALID",
							"message": "Token pendaftaran MFA tidak valid atau sudah kedaluwarsa.",
						})
					}
				}
			}
		}
		return fullAuth(c)
	}
}

func isSupportAppealPath(c *fiber.Ctx) bool {
	path := strings.ToLower(c.Path())
	if strings.Contains(path, "/support") {
		return true
	}
	if strings.Contains(path, "/storage/upload") {
		cat := strings.ToLower(strings.TrimSpace(c.Query("category", c.FormValue("category", ""))))
		return cat == "support" || cat == "tickets" || cat == "ticket" || cat == "screenshots" || cat == "screenshot"
	}
	return false
}

// StoreOwnerRequired enforces strict multi-tenant boundary checks (Zero-Trust Anti-IDOR)
func StoreOwnerRequired() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user, ok := c.Locals("user").(*models.User)
		if !ok || user == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"message": "Unauthenticated.",
			})
		}

		targetSlug := strings.TrimSpace(c.Get("X-Store-Slug"))
		if targetSlug == "" {
			targetSlug = strings.TrimSpace(c.Params("slug"))
		}
		if targetSlug == "" {
			targetSlug = strings.TrimSpace(c.Query("slug"))
		}

		var matchedStore *models.Store
		isPlatformAdminUser := user.IsPlatformStaff()

		if targetSlug != "" {
			// Check against user's owned stores
			for i := range user.Stores {
				if strings.EqualFold(user.Stores[i].Slug, targetSlug) {
					matchedStore = &user.Stores[i]
					break
				}
			}

			// If not found in preloaded slice, query database directly
			if matchedStore == nil && database.DB != nil {
				var dbStore models.Store
				if err := database.DB.Where("LOWER(slug) = ? AND user_id = ?", strings.ToLower(targetSlug), user.ID).First(&dbStore).Error; err == nil {
					matchedStore = &dbStore
				}
			}

			// Platform Admins: Superadmin has global oversight; other platform staff only have read-only inspection access via GET/HEAD
			if matchedStore == nil && isPlatformAdminUser && database.DB != nil {
				if user.IsSuperadmin() || c.Method() == fiber.MethodGet || c.Method() == fiber.MethodHead {
					var dbStore models.Store
					if err := database.DB.Where("LOWER(slug) = ?", strings.ToLower(targetSlug)).First(&dbStore).Error; err == nil {
						matchedStore = &dbStore
					}
				}
			}

			if matchedStore == nil {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"success": false,
					"message": "Akses Ditolak: Anda tidak memiliki otoritas atas profil katalog ini.",
				})
			}

			if !isPlatformAdminUser && (matchedStore.DormancyStatus == "banned" || matchedStore.IsBlacklisted) && !isSupportAppealPath(c) {
				hasOtherActiveStores := false
				for _, s := range user.Stores {
					if s.ID != matchedStore.ID && s.DormancyStatus != "banned" && !s.IsBlacklisted {
						hasOtherActiveStores = true
						break
					}
				}
				if hasOtherActiveStores {
					return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
						"success":     false,
						"code":        "STORE_BANNED_SWITCH_REQUIRED",
						"message":     fmt.Sprintf("Profil katalog '%s' telah dinonaktifkan secara permanen. Anda dapat beralih ke profil katalog Anda yang lain.", matchedStore.StoreTitle),
						"banned_slug": matchedStore.Slug,
					})
				}
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"success": false,
					"code":    "STORE_BANNED",
					"message": "Profil katalog ini telah dinonaktifkan secara permanen oleh platform.",
				})
			}
		} else {
			// Fallback to active store in context or first store
			if store, ok := c.Locals("store").(*models.Store); ok && store != nil {
				matchedStore = store
			} else if len(user.Stores) > 0 {
				matchedStore = &user.Stores[0]
			} else if user.Store != nil {
				matchedStore = user.Store
			}
		}

		// ARSITEKTUR (pemisahan bidang otorisasi, OWASP Multi-Tenant):
		// Staf platform (superadmin/support/compliance/finance/content) BUKAN
		// anggota tenant. Jalur admin platform punya grup route sendiri
		// (adminApi) yang tidak memuat middleware ini, sehingga staf tidak
		// pernah sampai di sini. Rem di bawah adalah jaring pengaman bila ada
		// rute tenant yang keliru dipanggil staf: jangan mencarikan toko
		// pengganti (dulu: hardcode slug 'catavor' lalu sembarang toko id
		// terkecil — itu menyuntikkan tenant acak ke konteks request).
		// Staf tanpa toko cukup diloloskan tanpa konteks store untuk metode inspeksi read-only (GET/HEAD);
		// operasi mutasi (POST/PUT/DELETE/PATCH) wajib ditolak agar staf tanpa toko tidak membobol state tenant.
		if matchedStore == nil {
			if isSupportAppealPath(c) {
				return c.Next()
			}
			if IsPlatformStaffRole(user.PlatformRole) {
				if c.Method() != fiber.MethodGet && c.Method() != fiber.MethodHead {
					return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
						"success": false,
						"code":    "STORE_CONTEXT_REQUIRED",
						"message": "Operasi ini memerlukan profil toko yang sah.",
					})
				}
				return c.Next()
			}
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "STORE_NOT_REGISTERED",
				"message": "Toko Anda belum terdaftar.",
			})
		}

		// Set the active matched store in request context
		c.Locals("store", matchedStore)
		c.Locals("store_id", matchedStore.ID)
		c.Locals("store_slug", matchedStore.Slug)
		if matchedStore.UserID != user.ID {
			c.Locals("is_staff_inspection", true)
		}

		return c.Next()
	}
}

// OperationalStoreRequired blocks mutation actions if store is suspended or banned
func OperationalStoreRequired() fiber.Handler {
	return func(c *fiber.Ctx) error {
		path := strings.ToLower(c.Path())
		category := strings.ToLower(c.Query("category", c.FormValue("category", "")))
		// Always allow support tickets, appeals, support attachments, and notifications even if store is suspended
		if strings.Contains(path, "/support") || strings.Contains(path, "/notifications") ||
			(strings.Contains(path, "/storage/upload") && (category == "support" || category == "billing")) {
			return c.Next()
		}

		user, _ := c.Locals("user").(*models.User)
		isStaff := user != nil && user.IsPlatformStaff()

		if isStaff && (user.IsSuperadmin() || c.Method() == fiber.MethodGet || c.Method() == fiber.MethodHead) {
			return c.Next()
		}

		store, ok := c.Locals("store").(*models.Store)
		if !ok || store == nil {
			return c.Next()
		}

		if store.DormancyStatus == "banned" || store.IsBlacklisted {
			hasOtherActiveStores := false
			if user != nil && len(user.Stores) > 0 {
				for _, s := range user.Stores {
					if s.ID != store.ID && s.DormancyStatus != "banned" && !s.IsBlacklisted {
						hasOtherActiveStores = true
						break
					}
				}
			}

			if hasOtherActiveStores {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"success":     false,
					"code":        "STORE_BANNED_SWITCH_REQUIRED",
					"message":     fmt.Sprintf("Profil katalog '%s' telah dinonaktifkan secara permanen. Anda dapat beralih ke profil katalog Anda yang lain.", store.StoreTitle),
					"banned_slug": store.Slug,
				})
			}

			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "STORE_BANNED",
				"message": "Operasional profil katalog ini telah ditangguhkan secara permanen (Banned) oleh Tim Kepatuhan. Perubahan data tidak diizinkan.",
			})
		}

		if store.DormancyStatus == "suspended" || store.IsSuspended {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"code":    "STORE_SUSPENDED",
				"message": "Operasional toko ini sedang dibekukan sementara oleh Tim Kepatuhan. Penambahan atau perubahan data katalog tidak diizinkan selama masa pembekuan. Silakan ajukan banding melalui Pusat Bantuan.",
			})
		}

		return c.Next()
	}
}
