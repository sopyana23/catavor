package database

import (
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"fmt"
	"io/fs"
	"path"
	"sort"
	"strings"
	"time"

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
	if err := db.AutoMigrate(&schemaMigration{}); err != nil {
		return fmt.Errorf("membuat tabel schema_migrations: %w", err)
	}

	files, err := loadMigrations()
	if err != nil {
		return err
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
	var tableExists bool
	err := db.Raw(`SELECT EXISTS (SELECT 1 FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name = 'users')`).Scan(&tableExists).Error
	if err != nil {
		return false, fmt.Errorf("memeriksa tabel users: %w", err)
	}
	if !tableExists {
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
