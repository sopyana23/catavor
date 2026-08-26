package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
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
	JWTSecret          string
	JWTExpirationHours int
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURI  string
	SQLiteSourcePath   string
	StorageDir         string
	DesktopDistDir     string
	MobileDistDir      string
	AllowedOrigins     []string
}

var AppConfig *Config

func LoadConfig() *Config {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../backend/.env")

	port := getEnv("PORT", "8000")
	jwtHours, err := strconv.Atoi(getEnv("JWT_EXPIRATION_HOURS", "72"))
	if err != nil {
		jwtHours = 72
	}

	originsRaw := getEnv("ALLOWED_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000,http://localhost:5173,http://localhost:3000")
	var origins []string
	for _, o := range strings.Split(originsRaw, ",") {
		trimmed := strings.TrimSpace(o)
		if trimmed != "" {
			origins = append(origins, trimmed)
		}
	}

	AppConfig = &Config{
		Port:               port,
		AppEnv:             getEnv("APP_ENV", "local"),
		AppURL:             getEnv("APP_URL", "http://localhost:"+port),
		DBHost:             getEnv("DB_HOST", "127.0.0.1"),
		DBPort:             getEnv("DB_PORT", "5432"),
		DBUser:             getEnv("DB_USER", "postgres"),
		DBPassword:         getEnv("DB_PASSWORD", ""),
		DBName:             getEnv("DB_NAME", "catavor"),
		DBSSLMode:          getEnv("DB_SSLMODE", "disable"),
		JWTSecret:          getEnv("JWT_SECRET", "catavor_super_secure_jwt_secret_key_2026_industrial_saas"),
		JWTExpirationHours: jwtHours,
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURI:  getEnv("GOOGLE_REDIRECT_URI", "http://localhost:"+port),
		SQLiteSourcePath:   getEnv("SQLITE_SOURCE_PATH", "../legacy/laravel/database/database.sqlite"),
		StorageDir:         getEnv("STORAGE_DIR", "../public/storage"),
		DesktopDistDir:     getEnv("DESKTOP_DIST_DIR", "../public/desktop"),
		MobileDistDir:      getEnv("MOBILE_DIST_DIR", "../public/mobile"),
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

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}
