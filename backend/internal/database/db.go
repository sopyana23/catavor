package database

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
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

	if !cfg.DBAutoMigrate {
		runPostMigrationOptimizations(db)
		DB = db
		log.Info().Msg("PostgreSQL connected successfully (DB auto-migration and seeders SKIPPED, idempotent schema columns verified)")
		return db, nil
	}

	// 1. Run Pre-Migration Checks (Safe table renaming faunas -> products)
	runPreMigrationRenames(db)

	// 2. Auto-Migrate Schemas to PostgreSQL
	err = db.AutoMigrate(
		&models.User{},
		&models.Store{},
		&models.SubscriptionPlan{},
		&models.SubscriptionOrder{},
		&models.Category{},
		&models.Product{},
		&models.ProductImage{},
		&models.ProductVariant{},
		&models.Sighting{},
		&models.Article{},
		&models.Comment{},
		&models.Setting{},
		&models.PolicyVersion{},
		&models.PolicyAuditLog{},
		&models.UserPolicyAgreement{},
		&models.Report{},
		&models.SupportTicket{},
		&models.SupportMessage{},
		&models.SupportAttachment{},
		&models.HelpArticle{},
		&models.StoreDailyAnalytics{},
		&models.ProductDailyAnalytics{},
		&models.Notification{},
		&models.NotificationRead{},
		&models.ActivityLog{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to auto-migrate PostgreSQL tables: %w", err)
	}

	// 3. Post-Migration Optimizations & Compatibility VIEWs
	runPostMigrationOptimizations(db)

	DB = db
	log.Info().Msg("PostgreSQL connected, normalized schemas auto-migrated, and GIN indexes verified successfully")

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

func runPreMigrationRenames(db *gorm.DB) {
	// Check if 'faunas' is a base table and 'products' does not exist yet
	var faunasTableCount int64
	_ = db.Raw("SELECT count(*) FROM information_schema.tables WHERE table_name = 'faunas' AND table_type = 'BASE TABLE'").Scan(&faunasTableCount).Error

	var productsTableCount int64
	_ = db.Raw("SELECT count(*) FROM information_schema.tables WHERE table_name = 'products'").Scan(&productsTableCount).Error

	if faunasTableCount > 0 && productsTableCount == 0 {
		log.Info().Msg("Executing zero-downtime database migration: Renaming 'faunas' table to 'products'...")
		if err := db.Exec("ALTER TABLE faunas RENAME TO products;").Error; err != nil {
			log.Warn().Err(err).Msg("Failed to rename 'faunas' to 'products'")
		} else {
			log.Info().Msg("Database table 'faunas' successfully renamed to 'products'")
		}
	}
}

func runPostMigrationOptimizations(db *gorm.DB) {
	// 1. Create Compatibility VIEW 'faunas' pointing to 'products'
	_ = db.Exec("CREATE OR REPLACE VIEW faunas AS SELECT * FROM products;").Error

	// 2. Create High-Performance Indexes on products table
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_products_store_active ON products(store_id, is_active);").Error
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);").Error
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);").Error
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_products_price ON products(store_id, price);").Error
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_products_attributes_gin ON products USING GIN (attributes);").Error

	// 3. Create Support & Help Center Indexes
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON support_tickets(user_id, status);").Error
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_tickets_status_prio ON support_tickets(status, priority, last_message_at DESC);").Error
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_messages_ticket_date ON support_messages(ticket_id, created_at ASC);").Error
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON support_attachments(message_id);").Error

	// 4. Ensure Dormancy Tracking Columns & Indexes on Stores Table
	_ = db.Exec("ALTER TABLE stores ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;").Error
	_ = db.Exec("ALTER TABLE stores ADD COLUMN IF NOT EXISTS dormancy_status VARCHAR(50) DEFAULT 'active';").Error
	_ = db.Exec("ALTER TABLE stores ADD COLUMN IF NOT EXISTS dormancy_warning1_sent_at TIMESTAMP WITH TIME ZONE;").Error
	_ = db.Exec("ALTER TABLE stores ADD COLUMN IF NOT EXISTS dormancy_warning2_sent_at TIMESTAMP WITH TIME ZONE;").Error
	_ = db.Exec("ALTER TABLE stores ADD COLUMN IF NOT EXISTS dormancy_suspended_at TIMESTAMP WITH TIME ZONE;").Error
	_ = db.Exec("ALTER TABLE stores ADD COLUMN IF NOT EXISTS reactivation_token VARCHAR(128);").Error
	_ = db.Exec("ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_exempt_from_dormancy BOOLEAN DEFAULT FALSE;").Error
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_stores_dormancy ON stores(plan, dormancy_status, is_exempt_from_dormancy, last_activity_at);").Error
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_stores_reactivation_token ON stores(reactivation_token);").Error
	// 5. Ensure ActivityLog Table & Indexes
	_ = db.AutoMigrate(&models.ActivityLog{})
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_activity_store_created ON activity_logs(store_id, created_at DESC);").Error
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);").Error
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs(action);").Error
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_activity_category ON activity_logs(category);").Error
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_activity_role ON activity_logs(actor_role);").Error

	// 6. Ensure RBAC Schema, Permissions & Roles
	_ = db.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_role VARCHAR(50) DEFAULT 'merchant';").Error
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_users_platform_role ON users(platform_role);").Error
	_ = db.Exec("UPDATE users SET platform_role = 'superadmin', is_password_changed = true WHERE email = 'admin@catavor.com';").Error
	_ = db.AutoMigrate(&models.PlatformRole{}, &models.PlatformPermission{}, &models.PlatformRolePermission{})
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_platform_roles_slug ON platform_roles(slug);").Error
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_platform_permissions_key ON platform_permissions(key);").Error
	_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_platform_permissions_group ON platform_permissions(\"group\");").Error

	// Seed Default RBAC Matrix & Roles
	seedDefaultRBAC(db)

	// 7. Auto-populate categories from store master_classes if categories table is empty
	var catCount int64
	db.Model(&models.Category{}).Count(&catCount)
	if catCount == 0 {
		var stores []models.Store
		if err := db.Find(&stores).Error; err == nil {
			for _, st := range stores {
				if len(st.MasterClasses) > 0 {
					var classNames []string
					if err := json.Unmarshal(st.MasterClasses, &classNames); err == nil {
						for idx, cName := range classNames {
							cName = strings.TrimSpace(cName)
							if cName != "" {
								slug := strings.ToLower(cName)
								slug = strings.ReplaceAll(slug, " & ", "-")
								slug = strings.ReplaceAll(slug, " ", "-")
								cat := models.Category{
									StoreID:     st.ID,
									Name:        cName,
									Slug:        slug,
									ProductType: "physical",
									SortOrder:   idx,
									IsActive:    true,
								}
								db.Create(&cat)
							}
						}
					}
				}
			}
			log.Info().Msg("Auto-populated categories table from store master_classes")
		}
	}

	// 8. Seed Default Help Center Articles if table is empty
	var helpCount int64
	db.Model(&models.HelpArticle{}).Count(&helpCount)
	if helpCount == 0 {
		defaultHelpArticles := []models.HelpArticle{
			{
				Category:    "Memulai Toko",
				Title:       "Panduan Lengkap Membuat & Mengaktifkan Katalog Digital",
				Slug:        "panduan-lengkap-membuat-katalog-digital",
				Content:     "Langkah mudah memulai bisnis di Catavor: 1. Daftar akun merchant gratis. 2. Atur nama toko dan slug unik Anda. 3. Masukkan nomor WhatsApp bisnis untuk menerima pesanan. 4. Unggah produk pertama Anda lengkap dengan foto dan harga promo.",
				SortOrder:   1,
				IsPublished: true,
			},
			{
				Category:    "Pesanan & WhatsApp",
				Title:       "Cara Kerja Fitur Pesan Direct WhatsApp & Rekber",
				Slug:        "cara-kerja-pesan-direct-whatsapp-rekber",
				Content:     "Catavor menyediakan integrasi WhatsApp checkout otomatis. Ketika pembeli menekan tombol 'Pesan via WhatsApp', sistem secara otomatis menyusun format pesan lengkap dengan nama produk, jumlah, varian, dan total harga ke nomor WhatsApp Anda.",
				SortOrder:   2,
				IsPublished: true,
			},
			{
				Category:    "Paket & Pembayaran",
				Title:       "Keuntungan Upgrade ke Akun Pro & Metode Pembayaran",
				Slug:        "keuntungan-upgrade-akun-pro",
				Content:     "Paket Pro Catavor membuka kapasitas posting tanpa batas (unlimited items), custom tema toko eksklusif, prioritas pencarian, dan verifikasi lencana centang resmi.",
				SortOrder:   3,
				IsPublished: true,
			},
		}
		for _, art := range defaultHelpArticles {
			db.Create(&art)
		}
		log.Info().Msg("Default Help Center articles seeded successfully")
	}
}

func seedDefaultRBAC(db *gorm.DB) {
	// 1. Seed Granular Permissions if not exists
	defaultPermissions := []models.PlatformPermission{
		// Compliance & Trust
		{Key: "compliance:reports:manage", Group: "compliance", Name: "Kelola Laporan Toko", Description: "Meninjau laporan penipuan, pelanggaran toko, dan satwa ilegal"},
		{Key: "compliance:stores:suspend", Group: "compliance", Name: "Bekukan / Pulihkan Toko", Description: "Membekukan toko yang melanggar atau memulihkan toko yang ditangguhkan"},
		{Key: "compliance:dormancy:manage", Group: "compliance", Name: "Kelola Dormansi Toko", Description: "Meninjau metrik dormansi dan memicu sanksi atau perpanjangan akun"},

		// Support & Helpdesk
		{Key: "support:tickets:read", Group: "support", Name: "Lihat Tiket Bantuan", Description: "Melihat daftar antrean tiket dan riwayat percakapan pelanggan"},
		{Key: "support:tickets:reply", Group: "support", Name: "Balas Tiket Bantuan", Description: "Mengirimkan jawaban tiket atau menambahkan catatan internal CS"},
		{Key: "support:help_articles:manage", Group: "support", Name: "Kelola Pusat Bantuan / FAQ", Description: "Menulis, mengedit, dan mempublikasikan artikel Pusat Bantuan"},

		// Finance & Billing
		{Key: "finance:orders:read", Group: "finance", Name: "Lihat Order Langganan", Description: "Melihat daftar pesanan langganan dan status invoice"},
		{Key: "finance:orders:manage", Group: "finance", Name: "Validasi Pembayaran Langganan", Description: "Mengonfirmasi aktivasi langganan manual dan memproses refund"},
		{Key: "finance:revenue:read", Group: "finance", Name: "Lihat Laporan Finansial", Description: "Melihat analitik omzet platform, MRR, dan konversi paket Pro"},

		// Content & Marketing
		{Key: "content:articles:manage", Group: "content", Name: "Kelola Artikel Edukasi", Description: "Menulis, mengubah, dan mempublikasikan artikel blog platform"},
		{Key: "content:broadcast:send", Group: "content", Name: "Kirim Siaran Notifikasi", Description: "Mengirim notifikasi broadcast sistem ke seluruh merchant"},

		// Monetization & Analytics Integration
		{Key: "monetization:google:manage", Group: "monetization", Name: "Kelola Monetisasi & Integrasi Google", Description: "Mengatur Google AdSense (Slot & ads.txt) dan Google Analytics (GA4) platform"},

		// Audit & Market Intelligence
		{Key: "audit:logs:read", Group: "audit", Name: "Lihat System Audit Logs", Description: "Melihat jejak audit trail seluruh aktivitas platform"},
		{Key: "market_intel:manage", Group: "audit", Name: "Kelola Riset Pasar & DaaS", Description: "Mengonfigurasi dan mengekspor dataset makro riset pasar"},

		// System Administration
		{Key: "system:admins:manage", Group: "system", Name: "Kelola Staf & Role RBAC", Description: "Mengatur akun staf admin, penugasan role, dan matriks izin dinamis"},
		{Key: "system:settings:manage", Group: "system", Name: "Kelola Master Pengaturan", Description: "Mengubah konfigurasi platform, integrasi pihak ketiga, dan Google AdSense"},
	}

	permMap := make(map[string]uint)
	for _, p := range defaultPermissions {
		var existing models.PlatformPermission
		if err := db.Where("key = ?", p.Key).First(&existing).Error; err != nil {
			db.Create(&p)
			permMap[p.Key] = p.ID
		} else {
			existing.Name = p.Name
			existing.Group = p.Group
			existing.Description = p.Description
			db.Save(&existing)
			permMap[p.Key] = existing.ID
		}
	}

	// 8. Seed Standard Platform Roles with Default Permissions
	defaultRoles := []struct {
		Slug        string
		Name        string
		Description string
		IsSystem    bool
		PermKeys    []string
	}{
		{
			Slug:        "superadmin",
			Name:        "Super Administrator",
			Description: "Akses penuh tanpa batas ke seluruh modul, konfigurasi keamanan, dan data platform",
			IsSystem:    true,
			PermKeys:    []string{}, // Superadmin bypasses check automatically
		},
		{
			Slug:        "compliance",
			Name:        "Trust & Compliance Officer",
			Description: "Penegakan hukum satwa, investigasi laporan masyarakat, dan audit kepatuhan toko",
			IsSystem:    true,
			PermKeys: []string{
				"compliance:reports:manage",
				"compliance:dormancy:manage",
			},
		},
		{
			Slug:        "support",
			Name:        "Customer Support Specialist",
			Description: "Penanganan tiket merchant, mediasi pembeli, dan artikel Pusat Bantuan",
			IsSystem:    true,
			PermKeys: []string{
				"support:tickets:read",
				"support:tickets:reply",
				"support:help_articles:manage",
			},
		},
		{
			Slug:        "finance",
			Name:        "Finance & Billing Administrator",
			Description: "Verifikasi pembayaran langganan, aktivasi paket, dan laporan omzet",
			IsSystem:    true,
			PermKeys: []string{
				"finance:orders:read",
				"finance:orders:manage",
				"finance:revenue:read",
			},
		},
		{
			Slug:        "content",
			Name:        "Content & Monetization Specialist",
			Description: "Siaran notifikasi massal, pengelolaan Google AdSense dan integrasi analitik",
			IsSystem:    true,
			PermKeys: []string{
				"content:articles:manage",
				"content:broadcast:send",
				"monetization:google:manage",
			},
		},
	}

	for _, rc := range defaultRoles {
		var role models.PlatformRole
		if err := db.Where("slug = ?", rc.Slug).First(&role).Error; err != nil {
			role = models.PlatformRole{
				Slug:        rc.Slug,
				Name:        rc.Name,
				Description: rc.Description,
				IsSystem:    rc.IsSystem,
			}
			db.Create(&role)

			// Seed Initial Role-Permission mappings
			for _, pk := range rc.PermKeys {
				if permID, ok := permMap[pk]; ok {
					rp := models.PlatformRolePermission{
						RoleID:       role.ID,
						PermissionID: permID,
					}
					db.Create(&rp)
				}
			}
		}
	}

	log.Info().Msg("Default RBAC Roles, Permissions, and Mappings verified successfully")
}

func resetSequences(db *gorm.DB) {
	tables := []string{
		"users", "stores", "subscription_plans", "subscription_orders", "products", "categories", "product_images", "product_variants",
		"articles", "comments", "settings", "policy_versions", "policy_audit_logs", "reports",
		"support_tickets", "support_messages", "support_attachments", "help_articles",
	}
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
		StoreTheme:              "navy",
		MasterClasses:           datatypes.JSON(defaultClasses),
		MasterHabitats:          datatypes.JSON(defaultHabitats),
		MasterStatuses:          datatypes.JSON(defaultStatuses),
		MasterShippingCoverages: datatypes.JSON(defaultShipping),
	}
	db.Create(&store)

	log.Info().Msg("Default Catavor admin and adidas store created")
}

