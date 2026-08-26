package database

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/models"

	"github.com/glebarez/sqlite"
	"github.com/rs/zerolog/log"
	"gorm.io/datatypes"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB(cfg *config.Config) (*gorm.DB, error) {
	dsn := cfg.GetPostgresDSN()

	gormLogLevel := logger.Warn
	if cfg.AppEnv == "local" {
		gormLogLevel = logger.Info
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(gormLogLevel),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to PostgreSQL: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get generic database object: %w", err)
	}

	// Industrial SaaS Connection Pool Configuration
	sqlDB.SetMaxOpenConns(50)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)

	// Auto-Migrate Schemas to PostgreSQL
	err = db.AutoMigrate(
		&models.User{},
		&models.Store{},
		&models.Fauna{},
		&models.Sighting{},
		&models.Article{},
		&models.Comment{},
		&models.Setting{},
		&models.PolicyVersion{},
		&models.PolicyAuditLog{},
		&models.UserPolicyAgreement{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to auto-migrate PostgreSQL tables: %w", err)
	}

	DB = db
	log.Info().Msg("PostgreSQL connected and schemas auto-migrated successfully")

	// Seed or Import Data from SQLite
	seedOrImportFromSQLite(db, cfg.SQLiteSourcePath)

	return db, nil
}

func seedOrImportFromSQLite(db *gorm.DB, sqlitePath string) {
	var userCount int64
	db.Model(&models.User{}).Count(&userCount)

	if userCount > 0 {
		log.Info().Int64("users", userCount).Msg("PostgreSQL database already initialized with data")
		return
	}

	// Try to import from SQLite if exists
	if _, err := os.Stat(sqlitePath); err == nil {
		log.Info().Str("sqlite_path", sqlitePath).Msg("Importing existing data from SQLite to PostgreSQL...")
		if err := importFromSQLite(db, sqlitePath); err == nil {
			log.Info().Msg("Data imported from SQLite to PostgreSQL successfully!")
			return
		} else {
			log.Warn().Err(err).Msg("SQLite import encountered an issue, falling back to default seeders")
		}
	}

	// Default fallback seeder
	seedDefaultData(db)
}

func importFromSQLite(pgDB *gorm.DB, sqlitePath string) error {
	sqliteDB, err := gorm.Open(sqlite.Open(sqlitePath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return err
	}

	// 1. Import Users
	var sqliteUsers []struct {
		ID                uint
		Name              string
		Email             string
		Password          string
		GoogleID          *string
		IsPasswordChanged bool
		CreatedAt         time.Time
		UpdatedAt         time.Time
	}
	if err := sqliteDB.Table("users").Find(&sqliteUsers).Error; err == nil {
		for _, u := range sqliteUsers {
			user := models.User{
				ID:                u.ID,
				Name:              u.Name,
				Email:             u.Email,
				Password:          u.Password,
				GoogleID:          u.GoogleID,
				IsPasswordChanged: u.IsPasswordChanged,
				CreatedAt:         u.CreatedAt,
				UpdatedAt:         u.UpdatedAt,
			}
			pgDB.Save(&user)
		}
	}

	// 2. Import Stores
	var sqliteStores []struct {
		ID                      uint
		UserID                  uint
		Slug                    string
		StoreTitle              string
		StoreSlogan             string
		PromoBanner             string
		WhatsappNumber          string
		OfficialWebsite         string
		StoreLogoURL            string
		StoreTheme              string
		AboutTitle              string
		AboutSlogan             string
		AboutDescription        string
		AboutCards              string
		AboutLocation           string
		AboutHours              string
		ShowHours               bool
		AboutDisclaimer         string
		SocialLinks             string
		Plan                    string
		PaymentStatus           string
		EnableWADirect          bool
		EnableWARekber          bool
		RegistrationTimezone    string
		MasterClasses           string
		MasterHabitats          string
		MasterStatuses          string
		MasterShippingCoverages string
		CreatedAt               time.Time
		UpdatedAt               time.Time
	}
	if err := sqliteDB.Table("stores").Find(&sqliteStores).Error; err == nil {
		for _, s := range sqliteStores {
			store := models.Store{
				ID:                      s.ID,
				UserID:                  s.UserID,
				Slug:                    s.Slug,
				StoreTitle:              s.StoreTitle,
				StoreSlogan:             s.StoreSlogan,
				PromoBanner:             s.PromoBanner,
				WhatsappNumber:          s.WhatsappNumber,
				OfficialWebsite:         s.OfficialWebsite,
				StoreLogoURL:            s.StoreLogoURL,
				StoreTheme:              s.StoreTheme,
				AboutTitle:              s.AboutTitle,
				AboutSlogan:             s.AboutSlogan,
				AboutDescription:        s.AboutDescription,
				AboutCards:              datatypes.JSON([]byte(s.AboutCards)),
				AboutLocation:           s.AboutLocation,
				AboutHours:              s.AboutHours,
				ShowHours:               s.ShowHours,
				AboutDisclaimer:         s.AboutDisclaimer,
				SocialLinks:             datatypes.JSON([]byte(s.SocialLinks)),
				Plan:                    s.Plan,
				PaymentStatus:           s.PaymentStatus,
				EnableWADirect:          s.EnableWADirect,
				EnableWARekber:          s.EnableWARekber,
				RegistrationTimezone:    s.RegistrationTimezone,
				MasterClasses:           datatypes.JSON([]byte(s.MasterClasses)),
				MasterHabitats:          datatypes.JSON([]byte(s.MasterHabitats)),
				MasterStatuses:          datatypes.JSON([]byte(s.MasterStatuses)),
				MasterShippingCoverages: datatypes.JSON([]byte(s.MasterShippingCoverages)),
				CreatedAt:               s.CreatedAt,
				UpdatedAt:               s.UpdatedAt,
			}
			pgDB.Save(&store)
		}
	}

	// 3. Import Faunas (Items)
	var sqliteFaunas []struct {
		ID                  uint
		StoreID             uint
		Name                string
		ScientificName      string
		Class               string
		Habitat             string
		Diet                string
		ConservationStatus  string
		Price               float64
		VideoURL            string
		IsShippingAvailable bool
		Description         string
		ImageURL            string
		DetailedInfo        string
		ProductType         string
		Attributes          string
		CreatedAt           time.Time
		UpdatedAt           time.Time
	}
	if err := sqliteDB.Table("faunas").Find(&sqliteFaunas).Error; err == nil {
		for _, f := range sqliteFaunas {
			pType := f.ProductType
			if pType == "" {
				pType = "physical"
			}
			fauna := models.Fauna{
				ID:                  f.ID,
				StoreID:             f.StoreID,
				Name:                f.Name,
				ScientificName:      f.ScientificName,
				Class:               f.Class,
				Habitat:             f.Habitat,
				Diet:                f.Diet,
				ConservationStatus:  f.ConservationStatus,
				Price:               f.Price,
				VideoURL:            f.VideoURL,
				IsShippingAvailable: f.IsShippingAvailable,
				Description:         f.Description,
				ImageURL:            f.ImageURL,
				DetailedInfo:        datatypes.JSON([]byte(f.DetailedInfo)),
				ProductType:         pType,
				Attributes:          datatypes.JSON([]byte(f.Attributes)),
				CreatedAt:           f.CreatedAt,
				UpdatedAt:           f.UpdatedAt,
			}
			pgDB.Save(&fauna)
		}
	}

	// 4. Import Articles, Comments, Settings
	var sqliteSettings []models.Setting
	if err := sqliteDB.Table("settings").Find(&sqliteSettings).Error; err == nil {
		for _, st := range sqliteSettings {
			pgDB.Save(&st)
		}
	}

	var sqliteArticles []models.Article
	if err := sqliteDB.Table("articles").Find(&sqliteArticles).Error; err == nil {
		for _, art := range sqliteArticles {
			pgDB.Save(&art)
		}
	}

	// Reset PostgreSQL auto-increment sequences
	resetSequences(pgDB)

	return nil
}

func resetSequences(db *gorm.DB) {
	tables := []string{"users", "stores", "faunas", "articles", "comments", "settings", "policy_versions", "policy_audit_logs"}
	for _, tbl := range tables {
		_ = db.Exec(fmt.Sprintf("SELECT setval(pg_get_serial_sequence('%s', 'id'), coalesce(max(id),0) + 1, false) FROM %s;", tbl, tbl)).Error
	}
}

func seedDefaultData(db *gorm.DB) {
	adminUser := models.User{
		Name:              "Administrator",
		Email:             "admin@catavor.com",
		IsPasswordChanged: true,
	}
	_ = adminUser.SetPassword("password")
	db.Create(&adminUser)

	defaultClasses, _ := json.Marshal([]string{"Pakaian & Busana", "Aksesoris & Fashion", "Gadget & Elektronik", "Kebutuhan Rumah Tangga", "Kerajinan Tangan"})
	defaultHabitats, _ := json.Marshal([]string{"Item Baru (Ready Stock)", "Pre-Order (PO)", "Varian Koleksi Khusus"})
	defaultStatuses, _ := json.Marshal([]string{"Tersedia (Ready Stock)", "Habis (Sold Out)", "Stok Terbatas (Limited)"})
	defaultShipping, _ := json.Marshal([]string{"Bisa Kirim Seluruh Indonesia", "Jabodetabek Saja", "Ambil Sendiri di Toko"})

	store := models.Store{
		UserID:                  adminUser.ID,
		Slug:                    "adidas",
		StoreTitle:              "Adidas Store",
		StoreSlogan:             "Official Digital Catalog & Multi-Channel Commerce",
		WhatsappNumber:          "081234567890",
		Plan:                    "pro",
		PaymentStatus:           "paid",
		StoreTheme:              "emerald",
		MasterClasses:           datatypes.JSON(defaultClasses),
		MasterHabitats:          datatypes.JSON(defaultHabitats),
		MasterStatuses:          datatypes.JSON(defaultStatuses),
		MasterShippingCoverages: datatypes.JSON(defaultShipping),
	}
	db.Create(&store)

	log.Info().Msg("Default Catavor admin and adidas store created")
}
