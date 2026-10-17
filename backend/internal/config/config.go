package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
	"github.com/rs/zerolog/log"
)

type Config struct {
	Port               string
	AppEnv             string
	AppURL             string
	DBHost             string
	DBPort             string
	DBUser             string
	DBPassword         string
	DBName             string
	DBSSLMode          string
	DBAutoMigrate      bool
	JWTSecret          string
	JWTExpirationHours int
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURI  string
	SQLiteSourcePath   string
	StorageDir         string
	StorageDriver      string
	StorageLocalRoot   string
	StoragePublicURL   string
	S3Endpoint         string
	S3Region           string
	S3Bucket           string
	S3AccessKeyID      string
	S3SecretAccessKey  string
	S3UsePathStyle     bool
	S3SSL              bool
	DesktopDistDir     string
	TabletDistDir      string
	MobileDistDir      string
	AllowedOrigins     []string
}

var AppConfig *Config

func LoadConfig() *Config {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("backend/.env")
	_ = godotenv.Load("../backend/.env")

	port := getEnv("PORT", "8000")
	jwtHours, err := strconv.Atoi(getEnv("JWT_EXPIRATION_HOURS", "12"))
	if err != nil {
		jwtHours = 12
	}
	if jwtHours <= 0 {
		jwtHours = 12
	}

	originsRaw := getEnv("ALLOWED_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000,http://localhost:5173,http://localhost:3000")
	var origins []string
	for _, o := range strings.Split(originsRaw, ",") {
		trimmed := strings.TrimSpace(o)
		if trimmed != "" {
			origins = append(origins, trimmed)
		}
	}

	storageDir := resolveDir("STORAGE_DIR", "public/storage")
	storageLocalRoot := resolveDir("STORAGE_LOCAL_ROOT", storageDir)
	appURL := getEnv("APP_URL", "http://localhost:"+port)
	storagePublicURL := getEnv("STORAGE_PUBLIC_URL", appURL+"/storage")

	s3UsePathStyle := getEnv("S3_USE_PATH_STYLE", "true") == "true"
	s3SSL := getEnv("S3_SSL", "false") == "true"

	dbAutoMigrateStr := strings.ToLower(getEnv("DB_AUTO_MIGRATE", getEnv("AUTO_MIGRATE", "true")))
	skipDBMigrateStr := strings.ToLower(getEnv("SKIP_DB_MIGRATE", "false"))
	dbAutoMigrate := (dbAutoMigrateStr != "false" && dbAutoMigrateStr != "0" && dbAutoMigrateStr != "no") && (skipDBMigrateStr != "true" && skipDBMigrateStr != "1" && skipDBMigrateStr != "yes")

	appEnv := strings.ToLower(strings.TrimSpace(getEnv("APP_ENV", "local")))

	// SECURITY (M1-mitigasi): JWT disimpan di localStorage, sehingga token yang
	// tercuri (via XSS) berlaku selama sisa masa hidupnya. Batasi agar dampak
	// pencurian tidak berlangsung berhari-hari. Frontend sudah menangani 401
	// dengan redirect login yang jelas, jadi sesi lebih pendek tetap wajar.
	if jwtHours > 24 {
		if appEnv == "production" || appEnv == "prod" || appEnv == "staging" {
			log.Fatal().
				Int("jwt_expiration_hours", jwtHours).
				Msg("JWT_EXPIRATION_HOURS > 24 jam tidak diizinkan di production/staging: " +
					"token di localStorage, masa hidup panjang memperbesar dampak bila tercuri. Gunakan <= 24 (disarankan 12).")
		}
		log.Warn().
			Int("jwt_expiration_hours", jwtHours).
			Msg("JWT_EXPIRATION_HOURS > 24 jam: tidak aman untuk production (hanya wajar untuk local/dev).")
	}
	jwtSecret := getEnv("JWT_SECRET", "***REMOVED***")

	// OWASP ASVS / NIST SP 800-63B: Audit validation for JWT secret key in production/staging
	const defaultJWTSecret = "***REMOVED***"
	if appEnv == "production" || appEnv == "staging" || appEnv == "prod" {
		if jwtSecret == defaultJWTSecret || len(jwtSecret) < 32 {
			// SECURITY (L4): SECRET DEFAULT = siapa pun bisa memalsukan JWT
			// (ambil alih akun apa pun, termasuk superadmin). Dulu hanya warning,
			// kini FAIL CLOSED di production/staging: tolak start.
			log.Fatal().
				Str("environment", strings.ToUpper(appEnv)).
				Int("secret_length", len(jwtSecret)).
				Msg("JWT_SECRET tidak aman: jangan pakai default dan minimal 32 karakter (256-bit). " +
					"Generate dengan 'openssl rand -hex 32' lalu set JWT_SECRET.")
		}
	}

	// SECURITY (L6): koneksi DB tanpa TLS memungkinkan penyadapan kredensial /
	// data di jaringan. Di production/staging, wajib sslmode selain "disable".
	dbSSLMode := strings.ToLower(strings.TrimSpace(getEnv("DB_SSLMODE", "disable")))
	if appEnv == "production" || appEnv == "prod" || appEnv == "staging" {
		if dbSSLMode == "disable" || dbSSLMode == "" {
			log.Fatal().
				Str("environment", strings.ToUpper(appEnv)).
				Str("db_sslmode", dbSSLMode).
				Msg("DB_SSLMODE=disable tidak diizinkan di production/staging: koneksi database " +
					"harus terenkripsi. Set DB_SSLMODE=require (atau verify-full bila CA tersedia).")
		}
	}

	AppConfig = &Config{
		Port:               port,
		AppEnv:             appEnv,
		AppURL:             appURL,
		DBHost:             getEnv("DB_HOST", "127.0.0.1"),
		DBPort:             getEnv("DB_PORT", "5432"),
		DBUser:             getEnv("DB_USER", "postgres"),
		DBPassword:         getEnv("DB_PASSWORD", ""),
		DBName:             getEnv("DB_NAME", "catavor"),
		DBSSLMode:          dbSSLMode,
		DBAutoMigrate:      dbAutoMigrate,
		JWTSecret:          jwtSecret,
		JWTExpirationHours: jwtHours,
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURI:  getEnv("GOOGLE_REDIRECT_URI", "http://localhost:"+port),
		SQLiteSourcePath:   getEnv("SQLITE_SOURCE_PATH", "../legacy/laravel/database/database.sqlite"),
		StorageDir:         storageDir,
		StorageDriver:      getEnv("STORAGE_DRIVER", "local"),
		StorageLocalRoot:   storageLocalRoot,
		StoragePublicURL:   strings.TrimRight(storagePublicURL, "/"),
		S3Endpoint:         getEnv("S3_ENDPOINT", "http://localhost:9000"),
		S3Region:           getEnv("S3_REGION", "us-east-1"),
		S3Bucket:           getEnv("S3_BUCKET", "catavor-uploads"),
		S3AccessKeyID:      getEnv("S3_ACCESS_KEY_ID", ""),
		S3SecretAccessKey:  getEnv("S3_SECRET_ACCESS_KEY", ""),
		S3UsePathStyle:     s3UsePathStyle,
		S3SSL:              s3SSL,
		DesktopDistDir:     resolveDir("DESKTOP_DIST_DIR", "public/desktop"),
		TabletDistDir:      resolveDir("TABLET_DIST_DIR", "public/tablet"),
		MobileDistDir:      resolveDir("MOBILE_DIST_DIR", "public/mobile"),
		AllowedOrigins:     origins,
	}

	return AppConfig
}

func (c *Config) GetPostgresDSN() string {
	if c.DBPassword == "" {
		return fmt.Sprintf("host=%s port=%s user=%s dbname=%s sslmode=%s",
			c.DBHost, c.DBPort, c.DBUser, c.DBName, c.DBSSLMode)
	}
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName, c.DBSSLMode)
}

func resolveDir(key, fallbackPath string) string {
	raw := getEnv(key, fallbackPath)
	candidates := []string{
		raw,
		strings.TrimPrefix(raw, "../"),
		filepath.Join(".", strings.TrimPrefix(raw, "../")),
		filepath.Join("..", raw),
		fallbackPath,
		filepath.Join("..", fallbackPath),
	}

	for _, cand := range candidates {
		if fi, err := os.Stat(cand); err == nil && fi.IsDir() {
			abs, err := filepath.Abs(cand)
			if err == nil {
				return abs
			}
			return cand
		}
	}
	return raw
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}
