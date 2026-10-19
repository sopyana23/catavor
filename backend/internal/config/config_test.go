package config

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// getEnv
// ---------------------------------------------------------------------------

func TestGetEnv(t *testing.T) {
	t.Run("memakai_nilai_env", func(t *testing.T) {
		t.Setenv("HERMES_TEST_KEY", "dari-env")
		if got := getEnv("HERMES_TEST_KEY", "fallback"); got != "dari-env" {
			t.Errorf("got %q, want dari-env", got)
		}
	})

	t.Run("env_kosong_dianggap_tidak_diset", func(t *testing.T) {
		t.Setenv("HERMES_TEST_KEY", "")
		if got := getEnv("HERMES_TEST_KEY", "fallback"); got != "fallback" {
			t.Errorf("got %q, want fallback", got)
		}
	})

	t.Run("tidak_diset_pakai_fallback", func(t *testing.T) {
		if got := getEnv("HERMES_TEST_KEY_TIDAK_ADA", "fallback"); got != "fallback" {
			t.Errorf("got %q, want fallback", got)
		}
	})
}

// ---------------------------------------------------------------------------
// resolveDir
// ---------------------------------------------------------------------------

func TestResolveDir(t *testing.T) {
	t.Run("direktori_ada_menghasilkan_path_absolut", func(t *testing.T) {
		dir := t.TempDir()
		t.Setenv("HERMES_TEST_DIR", dir)
		got := resolveDir("HERMES_TEST_DIR", "public/storage")
		if !filepath.IsAbs(got) {
			t.Errorf("ingin path absolut, dapat %q", got)
		}
		if filepath.Clean(got) != filepath.Clean(dir) {
			t.Errorf("got %q, want %q", got, dir)
		}
	})

	t.Run("direktori_tidak_ada_kembalikan_raw", func(t *testing.T) {
		t.Setenv("HERMES_TEST_DIR", "tidak/ada/direktori/ini")
		if got := resolveDir("HERMES_TEST_DIR", "public/storage"); got != "tidak/ada/direktori/ini" {
			t.Errorf("got %q, want raw path", got)
		}
	})

	t.Run("fallback_tidak_ada_tetap_raw", func(t *testing.T) {
		os.Unsetenv("HERMES_TEST_DIR")
		if got := resolveDir("HERMES_TEST_DIR", "path/yang/tidak/ada"); got != "path/yang/tidak/ada" {
			t.Errorf("got %q, want fallback raw", got)
		}
	})
}

// ---------------------------------------------------------------------------
// GetPostgresDSN
// ---------------------------------------------------------------------------

func TestGetPostgresDSN(t *testing.T) {
	t.Run("tanpa_password", func(t *testing.T) {
		c := &Config{DBHost: "h", DBPort: "1", DBUser: "u", DBName: "d", DBSSLMode: "disable"}
		want := "host=h port=1 user=u dbname=d sslmode=disable"
		if got := c.GetPostgresDSN(); got != want {
			t.Errorf("got %q, want %q", got, want)
		}
		if strings.Contains(c.GetPostgresDSN(), "password=") {
			t.Error("DSN tanpa password tidak boleh memuat password=")
		}
	})

	t.Run("dengan_password", func(t *testing.T) {
		c := &Config{DBHost: "h", DBPort: "1", DBUser: "u", DBPassword: "p", DBName: "d", DBSSLMode: "require"}
		want := "host=h port=1 user=u password=p dbname=d sslmode=require"
		if got := c.GetPostgresDSN(); got != want {
			t.Errorf("got %q, want %q", got, want)
		}
	})
}

// ---------------------------------------------------------------------------
// LoadConfig — jalur sukses (tanpa fatal)
// ---------------------------------------------------------------------------

const validSecret = "0123456789abcdef0123456789abcdef" // 32 karakter

func TestLoadConfig_DefaultLocal(t *testing.T) {
	t.Setenv("JWT_SECRET", validSecret)
	t.Setenv("APP_ENV", "local")
	t.Setenv("DB_SSLMODE", "disable")

	// pastikan variabel lain tidak bocor dari environment shell
	for _, k := range []string{"PORT", "DB_HOST", "DB_PORT", "DB_USER", "DB_NAME", "DB_AUTO_MIGRATE",
		"SKIP_DB_MIGRATE", "JWT_EXPIRATION_HOURS", "ALLOWED_ORIGINS", "TRUSTED_PROXIES",
		"S3_USE_PATH_STYLE", "S3_SSL", "STORAGE_DRIVER", "APP_URL", "STORAGE_PUBLIC_URL"} {
		os.Unsetenv(k)
	}

	cfg := LoadConfig()
	if cfg == nil {
		t.Fatal("LoadConfig mengembalikan nil")
	}
	if cfg.Port != "8000" {
		t.Errorf("Port = %q, want 8000", cfg.Port)
	}
	if cfg.AppEnv != "local" {
		t.Errorf("AppEnv = %q, want local", cfg.AppEnv)
	}
	if cfg.DBHost != "127.0.0.1" || cfg.DBPort != "5432" || cfg.DBUser != "postgres" || cfg.DBName != "catavor" {
		t.Errorf("default DB tidak sesuai: %+v", cfg)
	}
	if cfg.JWTExpirationHours != 12 {
		t.Errorf("JWTExpirationHours = %d, want 12", cfg.JWTExpirationHours)
	}
	if !cfg.DBAutoMigrate {
		t.Error("DBAutoMigrate default harus true")
	}
	if cfg.StorageDriver != "local" {
		t.Errorf("StorageDriver = %q, want local", cfg.StorageDriver)
	}
	if !cfg.S3UsePathStyle {
		t.Error("S3_USE_PATH_STYLE default harus true")
	}
	if cfg.S3SSL {
		t.Error("S3_SSL default harus false")
	}
	// Default trusted proxies: hanya loopback (mitigasi N-15).
	if len(cfg.TrustedProxies) != 2 || cfg.TrustedProxies[0] != "127.0.0.1" || cfg.TrustedProxies[1] != "::1" {
		t.Errorf("TrustedProxies default = %v, want [127.0.0.1 ::1]", cfg.TrustedProxies)
	}
	// Default CORS: 4 origin lokal, tanpa spasi.
	if len(cfg.AllowedOrigins) != 4 {
		t.Errorf("AllowedOrigins = %v, want 4 entri", cfg.AllowedOrigins)
	}
	for _, o := range cfg.AllowedOrigins {
		if strings.TrimSpace(o) != o {
			t.Errorf("origin %q masih punya spasi", o)
		}
	}
	if AppConfig != cfg {
		t.Error("AppConfig harus menunjuk hasil LoadConfig terakhir")
	}
}

func TestLoadConfig_ParsingVariabel(t *testing.T) {
	t.Setenv("JWT_SECRET", validSecret)
	t.Setenv("APP_ENV", "local")
	t.Setenv("DB_SSLMODE", "disable")
	t.Setenv("PORT", "9090")
	t.Setenv("DB_HOST", "db.internal")
	t.Setenv("DB_NAME", "catavor_test")
	t.Setenv("JWT_EXPIRATION_HOURS", "6")
	t.Setenv("ALLOWED_ORIGINS", " https://a.test , , https://b.test ")
	t.Setenv("TRUSTED_PROXIES", "10.0.0.5, 10.0.0.0/24 ,")
	t.Setenv("S3_USE_PATH_STYLE", "false")
	t.Setenv("S3_SSL", "true")
	t.Setenv("STORAGE_PUBLIC_URL", "https://cdn.test/storage/")

	cfg := LoadConfig()

	if cfg.Port != "9090" || cfg.DBHost != "db.internal" || cfg.DBName != "catavor_test" {
		t.Errorf("nilai env tidak terpakai: %+v", cfg)
	}
	if cfg.JWTExpirationHours != 6 {
		t.Errorf("JWTExpirationHours = %d, want 6", cfg.JWTExpirationHours)
	}
	if len(cfg.AllowedOrigins) != 2 || cfg.AllowedOrigins[0] != "https://a.test" || cfg.AllowedOrigins[1] != "https://b.test" {
		t.Errorf("AllowedOrigins = %v, want 2 entri ter-trim", cfg.AllowedOrigins)
	}
	if len(cfg.TrustedProxies) != 2 || cfg.TrustedProxies[0] != "10.0.0.5" || cfg.TrustedProxies[1] != "10.0.0.0/24" {
		t.Errorf("TrustedProxies = %v, want 2 entri ter-trim", cfg.TrustedProxies)
	}
	if cfg.S3UsePathStyle {
		t.Error("S3_USE_PATH_STYLE=false harus menghasilkan false")
	}
	if !cfg.S3SSL {
		t.Error("S3_SSL=true harus menghasilkan true")
	}
	if strings.HasSuffix(cfg.StoragePublicURL, "/") {
		t.Errorf("StoragePublicURL harus tanpa trailing slash: %q", cfg.StoragePublicURL)
	}
	// APP_URL default ikut PORT.
	if cfg.AppURL != "http://localhost:9090" {
		t.Errorf("AppURL = %q, want http://localhost:9090", cfg.AppURL)
	}
}

func TestLoadConfig_JWTExpirationTidakValid(t *testing.T) {
	cases := map[string]int{
		"bukan_angka": 12,
		"nol":         12,
		"negatif":     12,
		"25":          25, // > 24 tapi local: hanya warning, tidak fatal
	}
	for name, want := range cases {
		t.Run(name, func(t *testing.T) {
			raw := name
			switch name {
			case "bukan_angka":
				raw = "abc"
			case "nol":
				raw = "0"
			case "negatif":
				raw = "-5"
			}
			t.Setenv("JWT_SECRET", validSecret)
			t.Setenv("APP_ENV", "local")
			t.Setenv("DB_SSLMODE", "disable")
			t.Setenv("JWT_EXPIRATION_HOURS", raw)
			if got := LoadConfig().JWTExpirationHours; got != want {
				t.Errorf("JWT_EXPIRATION_HOURS=%q -> %d, want %d", raw, got, want)
			}
		})
	}
}

func TestLoadConfig_DBAutoMigrateFlags(t *testing.T) {
	cases := []struct {
		autoMigrate string
		skip        string
		want        bool
	}{
		{"true", "false", true},
		{"1", "false", true},
		{"", "false", true},
		{"false", "false", false},
		{"0", "false", false},
		{"no", "false", false},
		{"TRUE", "FALSE", true},
		{"true", "true", false},
		{"true", "1", false},
		{"true", "yes", false},
		{"true", "TRUE", false},
	}
	for _, tc := range cases {
		t.Run(tc.autoMigrate+"_"+tc.skip, func(t *testing.T) {
			t.Setenv("JWT_SECRET", validSecret)
			t.Setenv("APP_ENV", "local")
			t.Setenv("DB_SSLMODE", "disable")
			t.Setenv("DB_AUTO_MIGRATE", tc.autoMigrate)
			t.Setenv("SKIP_DB_MIGRATE", tc.skip)
			if got := LoadConfig().DBAutoMigrate; got != tc.want {
				t.Errorf("DB_AUTO_MIGRATE=%q SKIP_DB_MIGRATE=%q -> %v, want %v",
					tc.autoMigrate, tc.skip, got, tc.want)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// LoadConfig — jalur fatal (log.Fatal -> os.Exit(1))
//
// log.Fatal memanggil os.Exit sehingga tidak bisa ditangkap di proses yang sama.
// Pola standar: jalankan ulang binary test sebagai subprocess dengan env khusus,
// lalu periksa exit code dan pesan stderr.
// ---------------------------------------------------------------------------

const fatalHelperEnv = "CONFIG_FATAL_HELPER"

// TestMain menjadi gerbang subprocess: bila CONFIG_FATAL_HELPER diset, proses
// ini HANYA menjalankan LoadConfig lalu keluar. Bila tidak, jalankan test biasa.
func TestMain(m *testing.M) {
	if os.Getenv(fatalHelperEnv) == "1" {
		LoadConfig()
		// Tidak seharusnya sampai sini: berarti validasi gagal bekerja.
		os.Stderr.WriteString("NO_FATAL")
		os.Exit(0)
	}
	os.Exit(m.Run())
}

// envBersih membuang variabel config dari environment induk agar tiap kasus
// fatal deterministik, lalu menambahkan nilai kasus.
func envBersih(extra map[string]string) []string {
	blocked := map[string]bool{
		"JWT_SECRET": true, "DB_SSLMODE": true, "ALLOWED_ORIGINS": true,
		"APP_ENV": true, "JWT_EXPIRATION_HOURS": true, "TRUSTED_PROXIES": true,
		"PORT": true, "DB_HOST": true, "DB_PORT": true, "DB_USER": true,
		"DB_NAME": true, "DB_PASSWORD": true, "DB_AUTO_MIGRATE": true,
		"SKIP_DB_MIGRATE": true, "STORAGE_DIR": true, "APP_URL": true,
		"STORAGE_PUBLIC_URL": true, fatalHelperEnv: true,
	}
	var out []string
	for _, kv := range os.Environ() {
		k := strings.SplitN(kv, "=", 2)[0]
		if blocked[k] {
			continue
		}
		out = append(out, kv)
	}
	for k, v := range extra {
		out = append(out, k+"="+v)
	}
	return out
}

func jalankanKasusFatal(t *testing.T, env map[string]string, wantPesan string) {
	t.Helper()
	cmd := exec.Command(os.Args[0], "-test.run=^$")
	cmd.Env = envBersih(env)
	out, err := cmd.CombinedOutput()
	if err == nil {
		t.Fatalf("LoadConfig seharusnya fatal, tapi sukses. output=%s", out)
	}
	var exitErr *exec.ExitError
	if !errors.As(err, &exitErr) {
		t.Fatalf("error bukan ExitError: %v", err)
	}
	if code := exitErr.ExitCode(); code != 1 {
		t.Errorf("exit code = %d, want 1", code)
	}
	if strings.Contains(string(out), "NO_FATAL") {
		t.Fatalf("LoadConfig tidak memanggil log.Fatal. output=%s", out)
	}
	if !strings.Contains(string(out), wantPesan) {
		t.Errorf("pesan fatal tidak memuat %q. output=%s", wantPesan, out)
	}
}

func TestLoadConfig_Fatal(t *testing.T) {
	base := func(extra map[string]string) map[string]string {
		m := map[string]string{
			fatalHelperEnv: "1",
			"JWT_SECRET":   validSecret,
			"APP_ENV":      "local",
			"DB_SSLMODE":   "disable",
		}
		for k, v := range extra {
			m[k] = v
		}
		return m
	}

	t.Run("jwt_secret_kosong", func(t *testing.T) {
		jalankanKasusFatal(t, base(map[string]string{"JWT_SECRET": " "}), "JWT_SECRET wajib di-set")
	})
	t.Run("jwt_secret_terlalu_pendek", func(t *testing.T) {
		jalankanKasusFatal(t, base(map[string]string{"JWT_SECRET": "pendek"}), "JWT_SECRET terlalu pendek")
	})
	t.Run("production_sslmode_disable", func(t *testing.T) {
		jalankanKasusFatal(t, base(map[string]string{
			"APP_ENV": "production", "DB_SSLMODE": "disable",
			"ALLOWED_ORIGINS": "https://catavor.id",
		}), "DB_SSLMODE=disable tidak diizinkan")
	})
	t.Run("production_sslmode_kosong", func(t *testing.T) {
		jalankanKasusFatal(t, base(map[string]string{
			"APP_ENV": "prod", "DB_SSLMODE": "",
			"ALLOWED_ORIGINS": "https://catavor.id",
		}), "DB_SSLMODE=disable tidak diizinkan")
	})
	t.Run("production_origin_localhost", func(t *testing.T) {
		jalankanKasusFatal(t, base(map[string]string{
			"APP_ENV": "production", "DB_SSLMODE": "require",
			"ALLOWED_ORIGINS": "https://catavor.id,http://localhost:5173",
		}), "ALLOWED_ORIGINS memuat alamat lokal")
	})
	t.Run("production_origin_127", func(t *testing.T) {
		jalankanKasusFatal(t, base(map[string]string{
			"APP_ENV": "staging", "DB_SSLMODE": "require",
			"ALLOWED_ORIGINS": "https://staging.catavor.id,http://127.0.0.1:8000",
		}), "ALLOWED_ORIGINS memuat alamat lokal")
	})
	t.Run("production_origin_http", func(t *testing.T) {
		jalankanKasusFatal(t, base(map[string]string{
			"APP_ENV": "production", "DB_SSLMODE": "require",
			"ALLOWED_ORIGINS": "http://catavor.id",
		}), "wajib memakai https://")
	})
	t.Run("production_jwt_lebih_24_jam", func(t *testing.T) {
		jalankanKasusFatal(t, base(map[string]string{
			"APP_ENV": "production", "DB_SSLMODE": "require",
			"ALLOWED_ORIGINS": "https://catavor.id", "JWT_EXPIRATION_HOURS": "72",
		}), "JWT_EXPIRATION_HOURS > 24 jam tidak diizinkan")
	})
}

func TestLoadConfig_ProductionValid(t *testing.T) {
	// Konfigurasi produksi yang benar harus lolos semua guard.
	cmd := exec.Command(os.Args[0], "-test.run=^$")
	cmd.Env = envBersih(map[string]string{
		fatalHelperEnv:        "1",
		"JWT_SECRET":          validSecret,
		"APP_ENV":             "production",
		"DB_SSLMODE":          "require",
		"ALLOWED_ORIGINS":     "https://catavor.id",
		"JWT_EXPIRATION_HOURS": "12",
	})
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("konfigurasi produksi valid seharusnya tidak fatal: %v\noutput=%s", err, out)
	}
	if !strings.Contains(string(out), "NO_FATAL") {
		t.Errorf("helper seharusnya menyelesaikan LoadConfig tanpa fatal: %s", out)
	}
}
