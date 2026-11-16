package middleware

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/database"
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
	UserID            uint              `json:"user_id"`
	Email             string            `json:"email"`
	Name              string            `json:"name"`
	StoreSlug         string            `json:"store_slug"`
	StoreID           uint              `json:"store_id"`
	IsPasswordChanged bool              `json:"is_password_changed"`
	TokenVersion      int               `json:"token_version"`
	AbsoluteExpiresAt *jwt.NumericDate  `json:"abs_exp,omitempty"`
	jwt.RegisteredClaims
}

func (c *JWTClaims) GetAbsoluteExpiresAt() time.Time {
	if c != nil && c.AbsoluteExpiresAt != nil {
		return c.AbsoluteExpiresAt.Time
	}
	return time.Time{}
}

func (c *JWTClaims) IsAbsoluteExpired() bool {
	if c == nil || c.AbsoluteExpiresAt == nil {
		return false
	}
	return time.Now().After(c.AbsoluteExpiresAt.Time)
}

// GenerateSlidingTokenWithID creates a cryptographically signed JWT token preserving user claims and absolute expiration.
func GenerateSlidingTokenWithID(user *models.User, store *models.Store, cfg *config.Config, absExp time.Time) (string, string, time.Time, error) {
	var storeSlug string
	var storeID uint
	if store != nil {
		storeSlug = store.Slug
		storeID = store.ID
	}

	tokenVersion := user.TokenVersion
	if tokenVersion == 0 {
		tokenVersion = 1
	}

	tokenID := uuid.New().String()
	expiresAt := time.Now().Add(time.Duration(cfg.JWTExpirationHours) * time.Hour)

	var absNumericDate *jwt.NumericDate
	if !absExp.IsZero() {
		absNumericDate = jwt.NewNumericDate(absExp)
	} else {
		absNumericDate = jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour))
	}

	claims := JWTClaims{
		UserID:            user.ID,
		Email:             user.Email,
		Name:              user.Name,
		StoreSlug:         storeSlug,
		StoreID:           storeID,
		IsPasswordChanged: user.IsPasswordChanged,
		TokenVersion:      tokenVersion,
		AbsoluteExpiresAt: absNumericDate,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        tokenID,
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
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

// GenerateTokenWithID creates a cryptographically signed JWT token with algorithm pinning and returns token string, jti UUID, and expiresAt.
func GenerateTokenWithID(user *models.User, store *models.Store, cfg *config.Config) (string, string, time.Time, error) {
	return GenerateSlidingTokenWithID(user, store, cfg, time.Now().Add(7*24*time.Hour))
}

// GenerateToken creates a cryptographically signed JWT token with algorithm pinning (backwards compatible)
func GenerateToken(user *models.User, store *models.Store, cfg *config.Config) (string, error) {
	token, _, _, err := GenerateTokenWithID(user, store, cfg)
	return token, err
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

// SECURITY (M1): nama cookie sesi. HttpOnly + Secure + SameSite=Strict,
// sehingga JavaScript tidak bisa membacanya — token tidak lagi rentan dicuri XSS.
const SessionCookieName = "catavor_session"

// AuthRequired validates the JWT Bearer token.
// Urutan sumber kredensial:
//  1. HttpOnly cookie (cara yang benar, kebal XSS)
//  2. Authorization: Bearer header (fallback kompatibilitas klien lama)
//  3. ?token= query param (hanya untuk EventSource/SSE yang tak bisa kirim header)
func AuthRequired(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// SECURITY (M1/SSE): tiket sekali pakai untuk EventSource.
		// EventSource tak bisa mengirim header, jadi JWT dulu ditaruh di
		// ?token= — URL mudah bocor ke access log/Referer. Sekarang klien
		// menukar sesi dengan tiket berumur 30 detik lewat
		// POST /api/notifications/ticket, lalu memakai ?ticket=.
		if ticket := strings.TrimSpace(c.Query("ticket")); ticket != "" {
			uid, ok := security.ConsumeSSETicket(ticket)
			if !ok {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"success": false,
					"code":    "INVALID_TICKET",
					"message": "Tiket stream tidak valid atau sudah kedaluwarsa.",
				})
			}

			// Tahap 2: bangun konteks user dari DB dengan aturan yang sama
			// seperti jalur JWT (akun bisa saja diblokir setelah tiket terbit).
			var user models.User
			if err := database.DB.Preload("Stores", func(db *gorm.DB) *gorm.DB {
				return db.Where("dormancy_status != 'banned' AND is_blacklisted = false")
			}).Preload("Store", func(db *gorm.DB) *gorm.DB {
				return db.Where("dormancy_status != 'banned' AND is_blacklisted = false")
			}).First(&user, uid).Error; err != nil {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"success": false,
					"code":    "USER_NOT_FOUND",
					"message": "Pengguna tidak ditemukan atau telah dinonaktifkan.",
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

			c.Locals("user", &user)
			c.Locals("user_id", user.ID)
			c.Locals("claims", &JWTClaims{UserID: user.ID})
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
				// Fallback to cookie
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

		// Security Check: Verify if token has been revoked via Logout or Blacklist
		if claims.ID != "" {
			if database.IsTokenBlacklisted(claims.ID) {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"success": false,
					"code":    "SESSION_REVOKED",
					"message": "Sesi login telah dicabut atau Anda telah logout. Silakan masuk kembali.",
				})
			}

			// Anti-Zombie Session Check: Persistent revocation check in database
			if database.DB != nil {
				var isRevoked bool
				err := database.DB.Model(&models.UserSession{}).
					Select("is_revoked").
					Where("token_id = ?", claims.ID).
					Scan(&isRevoked).Error
				if err == nil && isRevoked {
					ttl := 72 * time.Hour
					if claims.ExpiresAt != nil {
						remaining := time.Until(claims.ExpiresAt.Time)
						if remaining > 0 {
							ttl = remaining
						}
					}
					database.BlacklistToken(claims.ID, ttl)
					return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
						"success": false,
						"code":    "SESSION_REVOKED",
						"message": "Sesi login telah dicabut atau Anda telah logout. Silakan masuk kembali.",
					})
				}
			}
		}

		// Retrieve user and their stores from DB to guarantee freshest state
		var user models.User
		if err := database.DB.Preload("Stores", func(db *gorm.DB) *gorm.DB {
			return db.Where("dormancy_status != 'banned' AND is_blacklisted = false")
		}).Preload("Store", func(db *gorm.DB) *gorm.DB {
			return db.Where("dormancy_status != 'banned' AND is_blacklisted = false")
		}).First(&user, claims.UserID).Error; err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"code":    "USER_NOT_FOUND",
				"message": "Pengguna tidak ditemukan atau telah dinonaktifkan.",
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
		// Check if token has passed half-life, not absolute expired, and has a valid ID
		if claims.ID != "" && claims.ExpiresAt != nil {
			tokenHours := cfg.JWTExpirationHours
			if tokenHours <= 0 {
				tokenHours = 24
			}
			tokenDuration := time.Duration(tokenHours) * time.Hour
			halfLife := tokenDuration / 2
			remaining := time.Until(claims.ExpiresAt.Time)

			if remaining > 0 && remaining <= halfLife && !claims.IsAbsoluteExpired() {
				// Single-winner lock via Redis SETNX (cooldown 60s)
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

					newToken, newJTI, newExpiresAt, err := GenerateSlidingTokenWithID(&user, activeStore, cfg, absExp)
					if err == nil {
						// 1. Update session cookie
						SetSessionCookie(c, cfg, newToken)
						// 2. Set client response header
						c.Set("X-Refreshed-Token", newToken)
						// 3. Blacklist old token with 30s grace period for in-flight requests
						database.BlacklistTokenWithGracePeriod(claims.ID, 30*time.Second, remaining)
						// 4. Synchronous light update on models.UserSession before c.Next() (POLISH-R3-01)
						_ = services.RotateUserSessionToken(database.DB, claims.ID, newJTI, newExpiresAt, c.IP())
						// 5. Register session fingerprint for new JTI (POLISH-R3-03)
						RegisterSessionFingerprint(newJTI, c.IP(), c.Get("User-Agent"))
						// 6. Mutate claims.ID = newJTI in c.Locals("claims") (POLISH-R3-01)
						claims.ID = newJTI
						c.Locals("claims", claims)
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
			if matchedStore == nil {
				var dbStore models.Store
				if err := database.DB.Where("LOWER(slug) = ? AND user_id = ?", strings.ToLower(targetSlug), user.ID).First(&dbStore).Error; err == nil {
					matchedStore = &dbStore
				}
			}

			// Platform Admins: Superadmin has global oversight; other platform staff only have read-only inspection access via GET/HEAD
			if matchedStore == nil && isPlatformAdminUser {
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

			if !isPlatformAdminUser && (matchedStore.DormancyStatus == "banned" || matchedStore.IsBlacklisted) {
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
		// Staf tanpa toko cukup diloloskan tanpa konteks store; handler yang
		// memang butuh store_id tetap akan menolak sendiri.
		if matchedStore == nil {
			if IsPlatformStaffRole(user.PlatformRole) {
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
