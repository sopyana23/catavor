package database

import (
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"fmt"
	"io/fs"
	"os"
	"path"
	"sort"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/models"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// Migrasi SQL ditanam ke binary. Tanpa ini, deploy baru tidak punya folder
// migrations/ di samping binary — skema tidak pernah terbentuk dan server
// gagal dengan error yang tidak berhubungan.
//
//go:embed all:migrations/*.sql
var migrationFS embed.FS

const migrationDir = "migrations"

// schemaMigration adalah catatan migrasi yang sudah diterapkan.
type schemaMigration struct {
	Version   string    `gorm:"primaryKey;size:255"`
	Checksum  string    `gorm:"size:64;not null"`
	AppliedAt time.Time `gorm:"not null"`
}

func (schemaMigration) TableName() string { return "schema_migrations" }

type migrationFile struct {
	version  string
	checksum string
	body     string
}

// loadMigrations membaca berkas .sql yang ditanam, terurut menurut nama berkas.
func loadMigrations() ([]migrationFile, error) {
	entries, err := fs.ReadDir(migrationFS, migrationDir)
	if err != nil {
		return nil, fmt.Errorf("membaca folder migrasi: %w", err)
	}

	var out []migrationFile
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		raw, err := migrationFS.ReadFile(path.Join(migrationDir, e.Name()))
		if err != nil {
			return nil, fmt.Errorf("membaca %s: %w", e.Name(), err)
		}
		sum := sha256.Sum256(raw)
		out = append(out, migrationFile{
			version:  e.Name(),
			checksum: hex.EncodeToString(sum[:]),
			body:     string(raw),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].version < out[j].version })
	return out, nil
}

// RunMigrations menerapkan migrasi SQL yang belum tercatat di schema_migrations.
//
// Perilaku yang disengaja:
//   - Berkas yang sudah diterapkan TIDAK dijalankan ulang, tetapi checksum-nya
//     dibandingkan. Berkas yang diubah setelah diterapkan menghasilkan error,
//     karena produksi dan repo jadi tidak sinkron tanpa terlihat.
//   - Setiap berkas dijalankan dalam satu transaksi: PostgreSQL mendukung DDL
//     transaksional, sehingga migrasi yang gagal tidak meninggalkan skema separuh.
//   - Bila tabel migrasi belum ada sama sekali (instalasi lama yang skemanya
//     dibentuk AutoMigrate), seluruh migrasi yang ada dibaseline tanpa dijalankan,
//     lalu dicatat sebagai sudah diterapkan.
func RunMigrations(db *gorm.DB) error {
	files, err := loadMigrations()
	if err != nil {
		return err
	}
	return runMigrations(db, files)
}

// runMigrations adalah inti runner tanpa ketergantungan pada berkas tertanam,
// sehingga daftar migrasi bisa disuntikkan oleh uji (SQLite in-memory) dan
// logika pencatatan version/checksum terbukti dijalankan, bukan hanya dibaca.
func runMigrations(db *gorm.DB, files []migrationFile) error {
	if err := db.AutoMigrate(&schemaMigration{}); err != nil {
		return fmt.Errorf("membuat tabel schema_migrations: %w", err)
	}

	if len(files) == 0 {
		log.Warn().Msg("tidak ada berkas migrasi SQL yang ditanam ke binary")
		return nil
	}

	var applied []schemaMigration
	if err := db.Find(&applied).Error; err != nil {
		return fmt.Errorf("membaca schema_migrations: %w", err)
	}
	known := make(map[string]string, len(applied))
	for _, a := range applied {
		known[a.Version] = a.Checksum
	}

	// Berkas yang tercatat tetapi tidak lagi ada di binary (mis. diganti nama
	// karena isinya tidak bisa diperbaiki di tempat). Bukan error, tetapi harus
	// terlihat: riwayat migrasi tidak boleh hilang diam-diam.
	present := make(map[string]struct{}, len(files))
	for _, f := range files {
		present[f.version] = struct{}{}
	}
	for _, a := range applied {
		if _, ok := present[a.Version]; !ok {
			log.Warn().Str("migrasi", a.Version).
				Msg("tercatat di schema_migrations tetapi berkasnya tidak ada di binary (diganti nama?)")
		}
	}

	if len(known) == 0 {
		// Baseline HANYA sah untuk instalasi lama: skema sudah dibentuk
		// AutoMigrate sebelum migrasi SQL dikelola. Patokannya tidak bisa
		// "ada tabel" — database baru pun sudah punya tabel dari AutoMigrate
		// yang berjalan lebih dulu. Yang membedakan adalah ada/tidaknya tabel
		// aplikasi inti BERISI; instalasi baru belum punya baris apa pun.
		legacy, err := isLegacyInstallation(db)
		if err != nil {
			return err
		}
		if legacy {
			if err := baselineMigrations(db, files); err != nil {
				return err
			}
			log.Info().Int("dimigrasikan", len(files)).
				Msg("instalasi lama terdeteksi, migrasi dibaseline ke schema_migrations")
			return nil
		}
		log.Info().Int("diterapkan", len(files)).Msg("database baru, menerapkan seluruh migrasi")
	}

	count := 0
	for _, f := range files {
		if recorded, ok := known[f.version]; ok {
			if recorded != f.checksum {
				return fmt.Errorf("migrasi %s sudah diterapkan tetapi isinya berubah (checksum %s != %s); buat berkas migrasi baru, jangan mengubah yang lama", f.version, recorded, f.checksum)
			}
			continue
		}
		if err := applyMigration(db, f); err != nil {
			return err
		}
		count++
	}

	if count == 0 {
		log.Info().Int("total", len(files)).Msg("skema sudah mutakhir, tidak ada migrasi baru")
	} else {
		log.Info().Int("diterapkan", count).Int("total", len(files)).Msg("migrasi SQL diterapkan")
	}
	return nil
}

func applyMigration(db *gorm.DB, f migrationFile) error {
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(f.body).Error; err != nil {
			return err
		}
		return tx.Create(&schemaMigration{
			Version:   f.version,
			Checksum:  f.checksum,
			AppliedAt: time.Now(),
		}).Error
	})
	if err != nil {
		return fmt.Errorf("menerapkan migrasi %s: %w", f.version, err)
	}
	log.Info().Str("migrasi", f.version).Msg("migrasi diterapkan")
	return nil
}

// isLegacyInstallation melaporkan apakah database ini sudah dipakai sebelum
// migrasi SQL dikelola. Cirinya: tabel aplikasi inti sudah ada DAN berisi data.
// Instalasi baru selalu kosong pada titik migrasi dijalankan, karena
// RunMigrations dipanggil sebelum seeding.
func isLegacyInstallation(db *gorm.DB) (bool, error) {
	// Pakai Migrator().HasTable agar dialek-agnostik: query information_schema
	// hanya sah di PostgreSQL sehingga jalur ini tidak bisa diuji tanpa DB
	// nyata, dan itu membuat guard baseline tidak pernah terverifikasi.
	if !db.Migrator().HasTable("users") {
		return false, nil
	}

	var rows int64
	if err := db.Raw(`SELECT count(*) FROM users`).Scan(&rows).Error; err != nil {
		return false, fmt.Errorf("menghitung users: %w", err)
	}
	return rows > 0, nil
}

// baselineMigrations mencatat semua migrasi sebagai sudah diterapkan tanpa
// menjalankannya. Dipakai sekali saat tabel schema_migrations baru dibuat.
func baselineMigrations(db *gorm.DB, files []migrationFile) error {
	return db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		for _, f := range files {
			if err := tx.Create(&schemaMigration{
				Version:   f.version,
				Checksum:  f.checksum,
				AppliedAt: now,
			}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func isLocalDevMFAEnv() bool {
	appEnv := ""
	if config.AppConfig != nil {
		appEnv = strings.ToLower(strings.TrimSpace(config.AppConfig.AppEnv))
	}
	if appEnv == "" {
		appEnv = strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	}
	return appEnv == "local" || appEnv == "development"
}

// EnsureN60MFASchema memastikan tabel dan kolom prasyarat MFA (N-60) benar-benar
// terbentuk secara fisik di database, termasuk pada instalasi lama yang sebelumnya
// melalui jalur baselineMigrations, serta menyelaraskan two_factor_enforced untuk
// seluruh akun staf platform aktif di lingkungan non-lokal (staging/production).
func EnsureN60MFASchema(db *gorm.DB) error {
	const n60Version = "20261116_n60_user_two_factor_auth.sql"

	needApply := !db.Migrator().HasColumn(&models.User{}, "two_factor_enabled") ||
		!db.Migrator().HasTable("two_factor_recovery_tickets") ||
		!db.Migrator().HasTable("mfa_auth_completions") ||
		!db.Migrator().HasTable("mfa_account_lockouts") ||
		!db.Migrator().HasTable("mfa_challenge_failures")

	if needApply {
		files, err := loadMigrations()
		if err != nil {
			return err
		}
		var n60 *migrationFile
		for i := range files {
			if files[i].version == n60Version {
				n60 = &files[i]
				break
			}
		}
		if n60 == nil {
			return fmt.Errorf("berkas migrasi tertanam %s tidak ditemukan", n60Version)
		}
		if err := db.Transaction(func(tx *gorm.DB) error {
			return tx.Exec(n60.body).Error
		}); err != nil {
			return fmt.Errorf("menerapkan skema fisik %s: %w", n60Version, err)
		}
		log.Info().Str("migrasi", n60Version).Msg("skema fisik N-60 MFA dipastikan terbentuk")
	}

	// Backfill idempoten (fail-closed untuk staging/production/unset APP_ENV):
	// seluruh role staf platform wajib memiliki two_factor_enforced = true.
	// Di local/development, flag two_factor_enforced = false tetap dipertahankan
	// selaras dengan IsMFAMandatory agar developer/QA bisa memakai akun staf non-MFA.
	if !isLocalDevMFAEnv() {
		if err := db.Model(&models.User{}).
			Where("LOWER(TRIM(platform_role)) IN ? AND two_factor_enforced = ?",
				[]string{"superadmin", "admin", "compliance", "support", "finance", "content"}, false).
			Update("two_factor_enforced", true).Error; err != nil {
			return fmt.Errorf("backfill two_factor_enforced staf gagal: %w", err)
		}
	}

	return nil
}

// VerifyProductionSchema memeriksa secara read-only apakah seluruh migrasi SQL
// tertanam sudah tercatat dengan checksum yang sah DAN tabel/kolom kritis MFA
// serta sesi benar-benar ada di database.
func VerifyProductionSchema(db *gorm.DB) ([]string, error) {
	files, err := loadMigrations()
	if err != nil {
		return nil, err
	}

	var issues []string
	if !db.Migrator().HasTable("schema_migrations") {
		issues = append(issues, "tabel schema_migrations belum terbentuk (jalankan admin-cli -migrate atau -bootstrap-schema)")
	} else {
		var applied []schemaMigration
		if err := db.Find(&applied).Error; err != nil {
			return nil, fmt.Errorf("membaca schema_migrations: %w", err)
		}
		known := make(map[string]string, len(applied))
		for _, a := range applied {
			known[a.Version] = a.Checksum
		}
		for _, f := range files {
			sum, ok := known[f.version]
			if !ok {
				issues = append(issues, fmt.Sprintf("migrasi SQL belum diterapkan: %s", f.version))
			} else if sum != f.checksum {
				issues = append(issues, fmt.Sprintf("drift checksum migrasi SQL: %s", f.version))
			}
		}
	}

	requiredTables := []string{
		"users",
		"user_sessions",
		"activity_logs",
		"two_factor_recovery_tickets",
		"mfa_auth_completions",
		"mfa_account_lockouts",
		"mfa_challenge_failures",
	}
	for _, tbl := range requiredTables {
		if !db.Migrator().HasTable(tbl) {
			issues = append(issues, fmt.Sprintf("tabel wajib belum ditemukan: %s", tbl))
		}
	}

	requiredUserCols := []string{
		"two_factor_enabled",
		"two_factor_enforced",
		"two_factor_secret_enc",
		"two_factor_backup_codes_hash",
		"two_factor_setup_jti",
		"two_factor_last_totp_step",
	}
	if db.Migrator().HasTable("users") {
		for _, col := range requiredUserCols {
			if !db.Migrator().HasColumn(&models.User{}, col) {
				issues = append(issues, fmt.Sprintf("kolom wajib users.%s belum ditemukan", col))
			}
		}
	}

	return issues, nil
}
