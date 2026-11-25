package config

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/hkdf"
)

type Config struct {
	Port     string
	BindAddr string
	AppEnv   string
	// TrustedProxies: daftar peer yang boleh menetapkan X-Forwarded-For.
	// Lihat catatan N-15 di LoadConfig.
	TrustedProxies []string
	AppURL         string
	// TLS opsional: bila keduanya diisi, server listen HTTPS langsung
	// (berguna untuk deploy tanpa reverse proxy). Bila kosong, TLS
	// diterminasi di reverse proxy/LB dan server tetap HTTP.
	TLSCertFile        string
	TLSKeyFile         string
	DBHost             string
	DBPort             string
	DBUser             string
	DBPassword         string
	DBName             string
	DBSSLMode          string
	DBAutoMigrate      bool
	SkipDBMigrate      bool
	JWTSecret          string
	JWTExpirationHours int
	// MFAEncryptionKey adalah material kunci untuk mengenkripsi secret TOTP dan
	// meng-hash kode cadangan. Bila MFA_ENCRYPTION_KEY tidak diset, nilainya
	// diturunkan dari JWT_SECRET dengan domain separation (lihat resolveMFAKey).
	// Konsekuensinya: rotasi JWT_SECRET membuat secret MFA lama tidak bisa
	// dibuka sehingga user harus mendaftar ulang. Set MFA_ENCRYPTION_KEY secara
	// eksplisit bila ingin merotasi JWT tanpa memutus MFA.
	MFAEncryptionKey string
	// MFAEnabled adalah saklar rilis fitur faktor kedua. Ketika false, login
	// TIDAK boleh menantang MFA (kalau menantang sementara /verify mati, akun
	// yang sudah mendaftar jadi terkunci permanen) dan endpoint MFA balas 404.
	MFAEnabled         bool
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURI  string
	SQLiteSourcePath   string
	StorageDir         string
	StorageDriver      string
	StorageLocalRoot   string
	// StoragePrivateRoot menampung object privat (bukti bayar, lampiran tiket
	// bantuan). Direktori ini SENGAJA berada di luar pohon yang dilayani
	// route statis /storage sehingga tidak mungkin bocor lewat HTTP tanpa
	// otorisasi. Key privat selalu berawalan "private/".
	StoragePrivateRoot    string
	StoragePublicURL      string
	S3Endpoint            string
	S3Region              string
	S3Bucket              string
	S3AccessKeyID         string
	S3SecretAccessKey     string
	S3UsePathStyle        bool
	S3SSL                 bool
	DesktopDistDir        string
	TabletDistDir         string
	MobileDistDir         string
	AllowedOrigins             []string
	HSTSIncludeSubDomains      bool
	HSTSPreload                bool
	PlatformDomains            []string
	CustomDomainCNAMETarget    string
	CustomDomainEdgeIP         string
	CustomDomainTLSAskSecret   string
}

var AppConfig *Config

func LoadConfig() *Config {
	if os.Getenv("SKIP_DOTENV") != "true" {
		_ = godotenv.Load(".env")
		_ = godotenv.Load("backend/.env")
		_ = godotenv.Load("../backend/.env")
		_ = godotenv.Load("../../.env")
		_ = godotenv.Load("../../backend/.env")
	}

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
	storagePrivateRoot := resolveDir("STORAGE_PRIVATE_ROOT", "storage/private")
	appURL := getEnv("APP_URL", "http://localhost:"+port)
	storagePublicURL := getEnv("STORAGE_PUBLIC_URL", appURL+"/storage")

	s3UsePathStyle := getEnv("S3_USE_PATH_STYLE", "true") == "true"
	s3SSL := getEnv("S3_SSL", "false") == "true"

	dbAutoMigrateStr := strings.ToLower(getEnv("DB_AUTO_MIGRATE", getEnv("AUTO_MIGRATE", "true")))
	skipDBMigrateStr := strings.ToLower(getEnv("SKIP_DB_MIGRATE", "false"))
	skipDBMigrate := (skipDBMigrateStr == "true" || skipDBMigrateStr == "1" || skipDBMigrateStr == "yes")
	dbAutoMigrate := (dbAutoMigrateStr != "false" && dbAutoMigrateStr != "0" && dbAutoMigrateStr != "no") && !skipDBMigrate

	appEnv := strings.ToLower(strings.TrimSpace(getEnv("APP_ENV", "local")))

	// SECURITY (N-15): daftar proxy yang dipercaya menentukan apakah header
	// X-Forwarded-For dipakai untuk menentukan IP klien. Sebelumnya daftar ini
	// di-hardcode mencakup 127.0.0.1, ::1, dan SELURUH RFC1918 (10/8, 172.16/12,
	// 192.168/16). Akibatnya siapa pun yang bisa menjangkau server dari jaringan
	// lokal — atau dari localhost — dapat memalsukan X-Forwarded-For dan lolos
	// dari rate limiter maupun dedup berbasis IP. Terbukti di runtime: setelah
	// kuota habis (429), 8 permintaan dengan XFF berputar kembali dijawab 200.
	//
	// Default sekarang hanya loopback, cukup untuk reverse proxy di host yang
	// sama. Deployment lain WAJIB menyetel TRUSTED_PROXIES secara eksplisit,
	// mis. TRUSTED_PROXIES=10.0.0.5 (IP Nginx) atau "10.0.0.0/24".
	trustedProxiesRaw := getEnv("TRUSTED_PROXIES", "127.0.0.1,::1")
	var trustedProxies []string
	for _, p := range strings.Split(trustedProxiesRaw, ",") {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			trustedProxies = append(trustedProxies, trimmed)
		}
	}
	if len(trustedProxies) == 0 {
		trustedProxies = []string{"127.0.0.1", "::1"}
	}

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
	// SECURITY (N-01): TIDAK ADA default secret lagi.
	// Sebelumnya nilai fallback hardcoded ini ikut commit ke repo (.env.example,
	// README, docs) sehingga siapa pun bisa memalsukan JWT superadmin. Default
	// yang diketahui publik = tidak ada autentikasi sama sekali.
	// Kini JWT_SECRET WAJIB di-set eksplisit di semua environment.
	jwtSecret := strings.TrimSpace(getEnv("JWT_SECRET", ""))
	if jwtSecret == "" {
		log.Fatal().
			Str("environment", strings.ToUpper(appEnv)).
			Msg("JWT_SECRET wajib di-set dan tidak boleh kosong. " +
				"Generate dengan 'openssl rand -hex 32' lalu set JWT_SECRET di file .env.")
	}
	if len(jwtSecret) < 32 {
		log.Fatal().
			Str("environment", strings.ToUpper(appEnv)).
			Int("secret_length", len(jwtSecret)).
			Msg("JWT_SECRET terlalu pendek: minimal 32 karakter (256-bit). " +
				"Generate dengan 'openssl rand -hex 32' lalu set JWT_SECRET.")
	}

	// Nilai default lama yang sudah bocor di riwayat git. Tetap ditolak walau
	// operator menyalinnya kembali, karena nilainya harus dianggap kompromi.
	// Dicocokkan lewat SHA-256 agar string secret-nya sendiri TIDAK ditulis ulang
	// di source (menulis nilai bocor di kode = leak baru, dan memicu scanner).
	leakedLegacyJWTSecrets := []string{
		"ce44cdfdb3832af3da3e29ca1e2d8abf0e4d882faa4205dbc8e2888c9b1ab9a0",
		"7b247fda216a97b4b91649247db133fde5a5e7b9bf0ec6175a81eeeb710a7d91",
	}
	secretHash := fmt.Sprintf("%x", sha256.Sum256([]byte(jwtSecret)))
	for _, leaked := range leakedLegacyJWTSecrets {
		if secretHash == leaked {
			log.Fatal().
				Str("environment", strings.ToUpper(appEnv)).
				Msg("JWT_SECRET memakai nilai default lama yang sudah bocor di riwayat git. " +
					"Rotasi ke nilai acak baru: 'openssl rand -hex 32'.")
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

		// SECURITY: CORS yang masih mengarah ke localhost di production berarti
		// frontend produksi tidak akan bisa memanggil API, dan lebih buruk lagi
		// menunjukkan konfigurasi belum disesuaikan. Gagalkan lebih awal daripada
		// men-deploy konfigurasi default.
		for _, origin := range strings.Split(originsRaw, ",") {
			trimmed := strings.ToLower(strings.TrimSpace(origin))
			if trimmed == "" {
				continue
			}
			if strings.Contains(trimmed, "localhost") ||
				strings.Contains(trimmed, "127.0.0.1") ||
				strings.Contains(trimmed, "0.0.0.0") {
				log.Fatal().
					Str("environment", strings.ToUpper(appEnv)).
					Str("origin", trimmed).
					Msg("ALLOWED_ORIGINS memuat alamat lokal di production/staging. " +
						"Set ke domain publik, mis. https://catavor.id.")
			}
			if !strings.HasPrefix(trimmed, "https://") {
				log.Fatal().
					Str("environment", strings.ToUpper(appEnv)).
					Str("origin", trimmed).
					Msg("ALLOWED_ORIGINS di production/staging wajib memakai https://.")
			}
		}
	}

	hstsIncludeSub := !strings.EqualFold(strings.TrimSpace(getEnv("HSTS_INCLUDE_SUBDOMAINS", "true")), "false")
	hstsPreload := strings.EqualFold(strings.TrimSpace(getEnv("HSTS_PRELOAD", "false")), "true")

	defaultBindAddr := "0.0.0.0"
	if appEnv == "production" || appEnv == "prod" || appEnv == "staging" {
		// SECURITY (N-56): di production/staging proses Go secara default hanya listen
		// pada loopback 127.0.0.1 agar trafik luar wajib melewati reverse proxy / WAF edge.
		defaultBindAddr = "127.0.0.1"
	}
	bindAddr := strings.TrimSpace(getEnv("BIND_ADDR", defaultBindAddr))

	mfaKey := resolveMFAKey(jwtSecret, appEnv)

	platformDomainsRaw := getEnv("PLATFORM_DOMAINS", "")
	var platformDomains []string
	for _, d := range strings.Split(platformDomainsRaw, ",") {
		if trimmed := strings.TrimSpace(d); trimmed != "" {
			platformDomains = append(platformDomains, trimmed)
		}
	}

	AppConfig = &Config{
		Port:               port,
		BindAddr:           bindAddr,
		AppEnv:             appEnv,
		TrustedProxies:     trustedProxies,
		AppURL:             appURL,
		TLSCertFile:        strings.TrimSpace(getEnv("TLS_CERT_FILE", "")),
		TLSKeyFile:         strings.TrimSpace(getEnv("TLS_KEY_FILE", "")),
		DBHost:             getEnv("DB_HOST", "127.0.0.1"),
		DBPort:             getEnv("DB_PORT", "5432"),
		DBUser:             getEnv("DB_USER", "postgres"),
		DBPassword:         getEnv("DB_PASSWORD", ""),
		DBName:             getEnv("DB_NAME", "catavor"),
		DBSSLMode:          dbSSLMode,
		DBAutoMigrate:      dbAutoMigrate,
		SkipDBMigrate:      skipDBMigrate,
		JWTSecret:          jwtSecret,
		JWTExpirationHours: jwtHours,
		MFAEncryptionKey:   mfaKey,
		// Default aktif. Endpoint MFA hanya berguna bagi akun yang mendaftar
		// sendiri, jadi menyalakannya tidak memaksa siapa pun.
		MFAEnabled:            resolveMFAEnabled(),
		GoogleClientID:        getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret:    getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURI:     getEnv("GOOGLE_REDIRECT_URI", "http://localhost:"+port),
		SQLiteSourcePath:      getEnv("SQLITE_SOURCE_PATH", "../legacy/laravel/database/database.sqlite"),
		StorageDir:            storageDir,
		StorageDriver:         getEnv("STORAGE_DRIVER", "local"),
		StorageLocalRoot:      storageLocalRoot,
		StoragePrivateRoot:    storagePrivateRoot,
		StoragePublicURL:      strings.TrimRight(storagePublicURL, "/"),
		S3Endpoint:            getEnv("S3_ENDPOINT", "http://localhost:9000"),
		S3Region:              getEnv("S3_REGION", "us-east-1"),
		S3Bucket:              getEnv("S3_BUCKET", "catavor-uploads"),
		S3AccessKeyID:         getEnv("S3_ACCESS_KEY_ID", ""),
		S3SecretAccessKey:     getEnv("S3_SECRET_ACCESS_KEY", ""),
		S3UsePathStyle:        s3UsePathStyle,
		S3SSL:                 s3SSL,
		DesktopDistDir:        resolveDir("DESKTOP_DIST_DIR", "public/desktop"),
		TabletDistDir:         resolveDir("TABLET_DIST_DIR", "public/tablet"),
		MobileDistDir:         resolveDir("MOBILE_DIST_DIR", "public/mobile"),
		AllowedOrigins:             origins,
		HSTSIncludeSubDomains:      hstsIncludeSub,
		HSTSPreload:                hstsPreload,
		PlatformDomains:            platformDomains,
		CustomDomainCNAMETarget:    strings.TrimSpace(getEnv("CUSTOM_DOMAIN_CNAME_TARGET", "cname.catavor.com")),
		CustomDomainEdgeIP:         strings.TrimSpace(getEnv("CUSTOM_DOMAIN_EDGE_IP", "")),
		CustomDomainTLSAskSecret:   strings.TrimSpace(getEnv("CUSTOM_DOMAIN_TLS_ASK_SECRET", "")),
	}

	return AppConfig
}

// resolveMFAKey menentukan material kunci enkripsi MFA. Prioritas: env
// MFA_ENCRYPTION_KEY (wajib >= 32 karakter dan tidak boleh identik dengan JWT_SECRET),
// lalu turunan kriptografis RFC 5869 HKDF-SHA256 dengan domain separation.
func resolveMFAKey(jwtSecret, appEnv string) string {
	if explicit := strings.TrimSpace(os.Getenv("MFA_ENCRYPTION_KEY")); explicit != "" {
		if len(explicit) < 32 {
			log.Fatal().
				Int("length", len(explicit)).
				Msg("MFA_ENCRYPTION_KEY terlalu pendek (minimal 32 karakter / 256-bit). Gunakan 'openssl rand -hex 32'.")
		}
		if explicit == jwtSecret {
			log.Fatal().
				Msg("MFA_ENCRYPTION_KEY tidak boleh identik dengan JWT_SECRET (wajib pemisahan kunci kriptografis).")
		}
		return explicit
	}
	if strings.EqualFold(strings.TrimSpace(os.Getenv("REQUIRE_SEPARATE_MFA_KEY")), "true") {
		log.Fatal().
			Str("environment", strings.ToUpper(appEnv)).
			Msg("MFA_ENCRYPTION_KEY wajib di-set secara terpisah dari JWT_SECRET ketika REQUIRE_SEPARATE_MFA_KEY=true.")
	}
	if appEnv == "production" || appEnv == "prod" || appEnv == "staging" {
		log.Warn().
			Str("environment", strings.ToUpper(appEnv)).
			Msg("MFA_ENCRYPTION_KEY belum di-set terpisah; menurunkan kunci via HKDF-SHA256. Disarankan set MFA_ENCRYPTION_KEY mandiri untuk rotasi kunci terisolasi.")
	}
	reader := hkdf.New(sha256.New, []byte(jwtSecret), []byte("catavor-mfa-hkdf-salt-v1"), []byte("catavor-mfa-envelope"))
	derived := make([]byte, 32)
	if _, err := io.ReadFull(reader, derived); err == nil {
		return hex.EncodeToString(derived)
	}
	sum := sha256.Sum256([]byte("catavor-mfa-envelope|" + jwtSecret))
	return hex.EncodeToString(sum[:])
}

func (c *Config) GetPostgresDSN() string {
	if c.DBPassword == "" {
		return fmt.Sprintf("host=%s port=%s user=%s dbname=%s sslmode=%s",
			c.DBHost, c.DBPort, c.DBUser, c.DBName, c.DBSSLMode)
	}
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName, c.DBSSLMode)
}

// resolveMFAEnabled membaca saklar rilis fitur faktor kedua. Kosong berarti
// AKTIF — endpoint MFA hanya berguna untuk akun yang mendaftar sendiri.
func resolveMFAEnabled() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("MFA_2FA_ENABLED"))) {
	case "", "true", "1", "yes", "on":
		return true
	default:
		return false
	}
}

// projectRoot mengembalikan direktori yang memuat go.mod — acuan resolusi path
// relatif.
//
// Sebelumnya resolusi bergantung pada cwd proses, sehingga hasilnya berbeda
// antara "go run dari backend/" dan binary yang dijalankan dari root project.
// Perbedaan itulah yang menyebabkan bug 404 aset storage: direktori KOSONG
// backend/public/storage menang atas public/storage yang berisi 226 berkas.
func projectRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}

// hasAnyEntry melaporkan apakah direktori berisi data nyata.
//
// Entri tersembunyi/placeholder (.gitkeep, .DS_Store, dst) SENGAJA diabaikan:
// direktori yang hanya berisi .gitkeep adalah direktori kosong secara
// fungsional. Tanpa pengecualian ini, backend/public/storage yang hanya punya
// .gitkeep tetap dianggap "berisi" dan terus menutupi public/storage yang
// memuat data upload sebenarnya — akar bug 404 aset.
func hasAnyEntry(dir string) bool {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return false
	}
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".") {
			continue
		}
		return true
	}
	return false
}

// resolveDir menentukan direktori absolut untuk key konfigurasi.
//
// Urutan pencarian: relatif terhadap project root, lalu relatif terhadap cwd,
// lalu nilai fallback. Direktori yang ADA tetapi KOSONG hanya dipakai sebagai
// upaya terakhir: direktori kosong tidak boleh menutupi direktori lain yang
// benar-benar berisi berkas (akar bug 404 aset storage).
func resolveDir(key, fallbackPath string) string {
	raw := getEnv(key, fallbackPath)
	root := projectRoot()

	var candidates []string
	add := func(base, p string) {
		if p == "" {
			return
		}
		if filepath.IsAbs(p) {
			candidates = append(candidates, p)
			return
		}
		if base != "" {
			candidates = append(candidates, filepath.Join(base, p))
		}
		// Relatif terhadap cwd proses (cadangan bila go.mod tidak ditemukan).
		candidates = append(candidates, p)
	}

	add(root, raw)
	add(root, strings.TrimPrefix(raw, "../"))
	// Path relatif terhadap root project lewat satu level ke atas: kasus
	// STORAGE_LOCAL_ROOT=public/storage sementara berkas sebenarnya berada di
	// <project>/public/storage, bukan <project>/backend/public/storage.
	if !filepath.IsAbs(raw) {
		add(root, filepath.Join("..", raw))
	}

	seen := map[string]bool{}
	emptyDir := ""
	for _, cand := range candidates {
		abs, err := filepath.Abs(cand)
		if err != nil {
			continue
		}
		abs = filepath.Clean(abs)
		if seen[abs] {
			continue
		}
		seen[abs] = true

		fi, err := os.Stat(abs)
		if err != nil || !fi.IsDir() {
			continue
		}
		if hasAnyEntry(abs) {
			return abs
		}
		if emptyDir == "" {
			emptyDir = abs
		}
	}

	if emptyDir != "" {
		return emptyDir
	}
	// Tidak ada kandidat yang ada di disk: kembalikan nilai konfigurasi apa
	// adanya (bisa relatif) agar pemanggil yang membuat direktorinya.
	return raw
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}
