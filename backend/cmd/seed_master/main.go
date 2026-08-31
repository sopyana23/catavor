package main

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/models"

	"gorm.io/datatypes"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	cfg := config.LoadConfig()
	dsn := cfg.GetPostgresDSN()
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		fmt.Printf("❌ Gagal terhubung ke database: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("==================================================")
	fmt.Println("🚀 CATAVOR MASTER DATABASE RESET & COMPREHENSIVE SEEDER")
	fmt.Println("==================================================")

	// 1. TRUNCATE ALL TABLES WITH CASCADE & RESET SEQUENCES
	fmt.Println("\n🧹 1. Membersihkan seluruh tabel database...")
	tables := []string{
		"reports",
		"sightings",
		"comments",
		"articles",
		"user_policy_agreements",
		"policy_audit_logs",
		"policy_versions",
		"settings",
		"faunas",
		"stores",
		"users",
	}

	for _, tbl := range tables {
		if err := db.Exec(fmt.Sprintf("TRUNCATE TABLE %s RESTART IDENTITY CASCADE;", tbl)).Error; err != nil {
			// Fallback to simple DELETE if truncate fails
			db.Exec(fmt.Sprintf("DELETE FROM %s;", tbl))
		}
	}
	fmt.Println("✅ Seluruh data lama berhasil dibersihkan!")

	// 2. SEED SYSTEM SETTINGS
	fmt.Println("\n⚙️ 2. Membuat Pengaturan Sistem...")
	settings := []models.Setting{
		{Key: "store_title", Value: "Catavor"},
		{Key: "store_slogan", Value: "Enterprise Multi-Tenant SaaS Digital Catalog & Multi-Channel Commerce"},
		{Key: "whatsapp_number", Value: "628123456789"},
		{Key: "articles_enabled", Value: "1"},
	}
	for _, s := range settings {
		db.Create(&s)
	}

	// 3. SEED POLICY VERSIONS
	fmt.Println("\n📜 3. Membuat Versi Kebijakan & Ketentuan Layanan...")
	now := time.Now()
	policies := []models.PolicyVersion{
		{
			Type:               "terms",
			Title:              "Syarat dan Ketentuan Layanan Catavor",
			Version:            "v2.1.0",
			Content:            "### 1. Ketentuan Umum Layanan\nPengguna platform Catavor wajib mematuhi seluruh hukum yang berlaku di Republik Indonesia. Setiap toko/tenant bertanggung jawab penuh atas keabsahan, orisinalitas, dan legalitas produk yang ditampilkan.\n\n### 2. Transaksi & Keamanan\nPlatform memfasilitasi komunikasi katalog langsung ke WhatsApp merchant dan penyedia rekening bersama. Pengguna dihimbau selalu memverifikasi toko resmi berstatus Pro Plan.",
			SummaryOfChanges:   "Pembaruan klausul Zero-Trust Tenant Isolation dan verifikasi pembayaran instan kupon.",
			ChangeType:         "major",
			EffectiveDate:      now.AddDate(0, -1, 0),
			IsActive:           true,
			RequiresAcceptance: true,
			CreatedBy:          1,
		},
		{
			Type:               "privacy",
			Title:              "Kebijakan Privasi & Perlindungan Data",
			Version:            "v2.0.0",
			Content:            "### 1. Pengumpulan Data\nKami mengumpulkan data yang diperlukan untuk pembuatan akun, toko digital, dan personalisasi tema visual. Seluruh password dienkripsi dengan standar Bcrypt Cost 12.\n\n### 2. Penggunaan Data\nData tidak akan pernah diperjualbelikan kepada pihak ketiga. Gambar produk dioptimasi dan dibersihkan dari metadata EXIF sensitif.",
			SummaryOfChanges:   "Penyesuaian GDPR & UU Perlindungan Data Pribadi (UU PDP).",
			ChangeType:         "minor",
			EffectiveDate:      now.AddDate(0, -2, 0),
			IsActive:           true,
			RequiresAcceptance: false,
			CreatedBy:          1,
		},
		{
			Type:               "acceptable_use",
			Title:              "Panduan Konten & Penggunaan yang Diperbolehkan",
			Version:            "v1.5.0",
			Content:            "### 1. Larangan Produk\nDilarang mengunggah satwa dilindungi tanpa izin BKSDA resmi, barang bajakan/ilegal, senjata, atau materi yang melanggar norma hukum.\n\n### 2. Sanksi Pelanggaran\nPelanggaran akan dikenakan sanksi mulai dari penutupan katalog, pemblokiran akun, hingga pelaporan ke pihak berwajib.",
			SummaryOfChanges:   "Penambahan panduan untuk kategori Properti dan Satwa Terdaftar.",
			ChangeType:         "minor",
			EffectiveDate:      now.AddDate(0, -3, 0),
			IsActive:           true,
			RequiresAcceptance: false,
			CreatedBy:          1,
		},
	}
	for _, p := range policies {
		db.Create(&p)
	}

	// 4. USERS & STORES SEEDING
	fmt.Println("\n👥 4. Membuat Akun Pengguna & Toko Tenant...")

	type StoreSeedData struct {
		UserEmail      string
		UserName       string
		Password       string
		Slug           string
		StoreTitle     string
		StoreSlogan    string
		PromoBanner    string
		Theme          string
		Plan           string
		LogoURL        string
		WhatsAppJSON   string
		SocialJSON     string
		AboutTitle     string
		AboutSlogan    string
		AboutDesc      string
		AboutCardsJSON string
		AboutLocation  string
		AboutHours     string
		Classes        []string
		Habitats       []string
		Statuses       []string
		Shippings      []string
	}

	storesData := []StoreSeedData{
		// 1. CATAVOR MAIN SHOWCASE HUB (Multi-Sector Showcase)
		{
			UserEmail:    "admin@catavor.com",
			UserName:     "Super Admin Catavor",
			Password:     "password",
			Slug:         "catavor",
			StoreTitle:   "Catavor Official Showcase",
			StoreSlogan:  "Pusat Katalog Digital Multi-Sektor Terlengkap & Terpercaya",
			PromoBanner:  "🎉 Gunakan Kupon GRATISPRO untuk Uji Coba Paket Pro 100% Bebas Biaya!",
			Theme:        "emerald",
			Plan:         "pro",
			LogoURL:      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80",
			WhatsAppJSON: `[{"label":"Customer Support Utama","number":"08123456789"},{"label":"CS 2 • Konsultasi Bisnis","number":"08986160715"},{"label":"CS 3 • Rekber & Verifikasi","number":"0811220227"}]`,
			SocialJSON:   `{"instagram":"https://instagram.com/catavor.id","tiktok":"https://tiktok.com/@catavor","youtube":"https://youtube.com/@catavor","website":"https://catavor.com","facebook":"https://facebook.com/catavor"}`,
			AboutTitle:   "Tentang Catavor Official Hub",
			AboutSlogan:  "Membantu Ribuan Pelaku Usaha Naik Kelas dengan Katalog Digital Modern",
			AboutDesc:    "Catavor adalah platform katalog digital interaktif generasi baru yang dirancang untuk mendukung berbagai industri bisnis mulai dari Fashion, Kuliner, Produk Digital, Satwa & Tanaman Hias, Jasa Profesional, hingga Properti.",
			AboutCardsJSON: `[
				{"title":"Zero-Trust Security","description":"Proteksi isolasi multi-tenant dengan JWT Algorithm Pinning dan Bcrypt Cost 12."},
				{"title":"Multi-Channel WhatsApp","description":"Pemesanan otomatis terintegrasi langsung dengan CS WhatsApp merchant & Rekber."},
				{"title":"Dynamic Multi-Sector","description":"Mendukung 6 kategori sektor produk dengan atribut dinamis berbasis JSONB PostgreSQL."},
				{"title":"High Performance","description":"Dibangun dengan Golang Fiber v2 dan React 19 untuk pengalaman pengguna super cepat."}
			]`,
			AboutLocation: "Sudirman Central Business District (SCBD), Tower 2 Lt. 18, Jakarta Selatan",
			AboutHours:    "Senin - Minggu: 08:00 - 21:00 WIB",
			Classes:       []string{"Pakaian & Fashion", "Gadget & Elektronik", "E-Book & Preset", "Kuliner & Makanan", "Satwa & Tanaman", "Jasa & Layanan", "Properti"},
			Habitats:      []string{"Ready Stock", "Pre-Order (PO)", "Instant Download", "Jadwal Survey", "Live Fauna"},
			Statuses:      []string{"Tersedia (Ready Stock)", "Stok Terbatas (Limited)", "Pre-Order", "Promo Spesial"},
			Shippings:     []string{"Bisa Kirim se-Indonesia", "Kurir Instan Jabodetabek", "Akses Cloud Instan", "Kunjungan ke Lokasi", "Survey Lokasi"},
		},

		// 2. ADIDAS STORE (Physical Sporting Goods)
		{
			UserEmail:    "adidas@catavor.com",
			UserName:     "Adidas Indonesia Official",
			Password:     "password",
			Slug:         "adidas",
			StoreTitle:   "Adidas Official Store",
			StoreSlogan:  "Through sport, we have the power to change lives. 100% Original Authentic.",
			PromoBanner:  "⚡ Flash Sale Diskon hingga 40% untuk Koleksi Ultraboost & Running Gear!",
			Theme:        "sapphire",
			Plan:         "pro",
			LogoURL:      "https://images.unsplash.com/photo-1518002171953-a080ee817e1f?auto=format&fit=crop&w=300&q=80",
			WhatsAppJSON: `[{"label":"WhatsApp Sales Official","number":"08123456789"},{"label":"CS Customer Service","number":"08986160715"}]`,
			SocialJSON:   `{"instagram":"https://instagram.com/adidasindonesia","website":"https://adidas.co.id","youtube":"https://youtube.com/adidas"}`,
			AboutTitle:   "Official Adidas Flagship Catalog",
			AboutSlogan:  "Performa Maksimal, Desain Ikonik, dan Kenyamanan Tanpa Kompromi",
			AboutDesc:    "Selamat datang di katalog resmi Adidas Indonesia. Temukan koleksi sepatu olahraga, pakaian performa lari, apparel streetwear, dan aksesoris original bergaransi resmi.",
			AboutCardsJSON: `[
				{"title":"100% Original Guaranteed","description":"Semua produk bersumber langsung dari distributor resmi PT Adidas Indonesia."},
				{"title":"Garansi Tukar Ukuran","description":"Fasilitas tukar ukuran gratis dalam 7 hari jika ukuran tidak pas."},
				{"title":"Proteksi Double Box","description":"Setiap pengiriman menggunakan kardus pelindung tambahan dan bubble wrap tebal."},
				{"title":"Same Day Delivery","description":"Layanan pengiriman di hari yang sama untuk area Jabodetabek."}
			]`,
			AboutLocation: "Grand Indonesia Mall, East Mall Level 3, Jl. M.H. Thamrin No.1, Jakarta Pusat",
			AboutHours:    "Setiap Hari: 10:00 - 22:00 WIB",
			Classes:       []string{"Sepatu Lari (Running)", "Sepatu Lifestyle & Sneakers", "Pakaian Olahraga & Jersey", "Jaket & Hoodie", "Aksesoris & Tas Gym"},
			Habitats:      []string{"Warehouse Jakarta", "Official Flagship Store", "Special Limited Drop"},
			Statuses:      []string{"Tersedia (Ready Stock)", "Stok Menipis", "Pre-Order Drop"},
			Shippings:     []string{"Kirim Seluruh Indonesia via JNE/SiCepat", "Kurir Instan Grab/Gojek (Jabodetabek)", "Ambil di Toko (Store Pickup)"},
		},

		// 3. DAPUR NUSANTARA (Food & Beverages)
		{
			UserEmail:    "dapur@catavor.com",
			UserName:     "Chef Budi Santoso",
			Password:     "password",
			Slug:         "dapurnusantara",
			StoreTitle:   "Dapur Nusantara Resto & Catering",
			StoreSlogan:  "Cita Rasa Tradisional Otentik dengan Bahan Segar Berkualitas Premium",
			PromoBanner:  "🍲 Paket Katering & Nasi Box Mulai Rp 25.000 / Porsi (Free Ongkir min. 20 Box)",
			Theme:        "amber",
			Plan:         "pro",
			LogoURL:      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80",
			WhatsAppJSON: `[{"label":"Order Harian & Meja","number":"08123456789"},{"label":"Katering & Acara Kantor","number":"08986160715"}]`,
			SocialJSON:   `{"instagram":"https://instagram.com/dapurnusantara.id","tiktok":"https://tiktok.com/@dapurnusantara"}`,
			AboutTitle:   "Tentang Dapur Nusantara",
			AboutSlogan:  "Merawat Warisan Kuliner Nusantara dengan Kelezatan Istimewa",
			AboutDesc:    "Dapur Nusantara menyajikan hidangan tradisional Indonesia yang dimasak dengan rempah-rempah segar pilihan tanpa pengawet buatan. Melayani makan di tempat, pesan-antar, hingga katering pesta.",
			AboutCardsJSON: `[
				{"title":"100% Halal MUI","description":"Seluruh bahan baku dan proses pengolahan bersertifikat Halal resmi."},
				{"title":"Freshly Cooked","description":"Dimasak segar saat pesanan masuk untuk menjaga cita rasa dan kehangatan hidangan."},
				{"title":"Kemasan Food-Grade","description":"Menggunakan wadah ramah lingkungan tahan panas yang aman dan higienis."},
				{"title":"Kapasitas Katering Besar","description":"Sanggup melayani pesanan katering hingga 1.000 porsi per hari."}
			]`,
			AboutLocation: "Jl. Senopati No. 42, Kebayoran Baru, Jakarta Selatan",
			AboutHours:    "Senin - Minggu: 09:00 - 21:30 WIB",
			Classes:       []string{"Makanan Utama (Main Course)", "Paket Nasi Box & Katering", "Camilan & Kudapan", "Minuman & Kopi Nusantara", "Frozen Food & Bumbu Siap Pakai"},
			Habitats:      []string{"Dapur Utama Senopati", "Dapur Cabang BSD", "Frozen Pack Warehouse"},
			Statuses:      []string{"Tersedia Setiap Hari", "Pre-Order H-1 (Katering)", "Stok Terbatas Harian"},
			Shippings:     []string{"Kurir Instan (GoSend / GrabExpress)", "Paxel Next Day (Frozen Cold-Chain)", "Dine-in & Takeaway Only"},
		},

		// 4. PIXELLAB DIGITAL STUDIO (Digital Goods & Creative Services)
		{
			UserEmail:    "pixellab@catavor.com",
			UserName:     "PixelLab Creative Studio",
			Password:     "password",
			Slug:         "pixellab",
			StoreTitle:   "PixelLab Digital Assets & Studio",
			StoreSlogan:  "Premium Digital Assets, Lightroom Presets & Creative Professional Services",
			PromoBanner:  "🚀 Diskon 50% Bundling All-In-One Lightroom Presets & Notion Templates!",
			Theme:        "violet",
			Plan:         "pro",
			LogoURL:      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=300&q=80",
			WhatsAppJSON: `[{"label":"Support & Konsultasi Desain","number":"08123456789"}]`,
			SocialJSON:   `{"instagram":"https://instagram.com/pixellab.studio","youtube":"https://youtube.com/@pixellab","website":"https://pixellab.dev"}`,
			AboutTitle:   "PixelLab Creative & Digital Hub",
			AboutSlogan:  "Membantu Kreator & Pebisnis Tampil Lebih Menarik dan Produktif",
			AboutDesc:    "PixelLab adalah studio kreatif independen yang memproduksi aset digital siap pakai, template produktivitas, serta menyediakan layanan desain grafis dan video editing profesional.",
			AboutCardsJSON: `[
				{"title":"Instant Cloud Delivery","description":"Tautan download Google Drive berkecepatan tinggi aktif otomatis saat pembayaran."},
				{"title":"Lifetime Updates","description":"Pembaruan versi aset digital gratis selamanya untuk seluruh pembeli terdaftar."},
				{"title":"Commercial License","description":"Aset dapat digunakan untuk proyek komersial klien dan media sosial bisnis."},
				{"title":"Dedicated Support","description":"Bantuan teknis instalasi via WhatsApp jika mengalami kendala file."}
			]`,
			AboutLocation: "Green Office Park 9, BSD City, Tangerang Selatan (Online Studio)",
			AboutHours:    "Senin - Sabtu: 08:30 - 20:00 WIB",
			Classes:       []string{"Preset & Color Grading", "Template & Notion Dashboard", "Source Code & Web Templates", "Jasa Desain Grafis & Branding", "Jasa Video Editing & Motion"},
			Habitats:      []string{"Cloud Storage (Drive)", "Online Service (Remote)", "Studio Visit"},
			Statuses:      []string{"Instant Download Ready", "Slot Reservasi Tersedia", "Pre-Launch Bundle"},
			Shippings:     []string{"Akses Instan Otomatis (Link Cloud)", "Kirim via Email & WhatsApp", "Online Remote Collaboration"},
		},

		// 5. EXOPETS & FLORA (Living Fauna & Aquatic)
		{
			UserEmail:    "exopets@catavor.com",
			UserName:     "Indra Exotics",
			Password:     "password",
			Slug:         "exopets",
			StoreTitle:   "ExoPets & Aquatic Living",
			StoreSlogan:  "Katalog Satwa Peliharaan Eksotis, Ikan Hias Kontes & Tanaman Aquascape",
			PromoBanner:  "🐠 Garansi Live Arrival D.O.A 100% dengan Packing Beroksigen Khusus!",
			Theme:        "ruby",
			Plan:         "free",
			LogoURL:      "https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=300&q=80",
			WhatsAppJSON: `[{"label":"Admin Reptil & Ikan","number":"08123456789"}]`,
			SocialJSON:   `{"instagram":"https://instagram.com/exopets.id","tiktok":"https://tiktok.com/@exopets"}`,
			AboutTitle:   "Tentang ExoPets & Aquatic",
			AboutSlogan:  "Pecinta Satwa Eksotis Terpercaya dengan Perawatan Berstandar Tinggi",
			AboutDesc:    "ExoPets menyediakan aneka satwa peliharaan eksotis legal (reptil, gecko, ikan hias aquascape) yang sehat, lincah, dan terawat dengan nutrisi terbaik.",
			AboutCardsJSON: `[
				{"title":"Garansi D.O.A 100%","description":"Jaminan hidup sampai tujuan dengan melampirkan video unboxing paket utuh."},
				{"title":"Karantina Ketat","description":"Semua satwa telah melewati masa karantina dan adaptasi pakan sebelum dikirim."},
				{"title":"Konsultasi Perawatan","description":"Bimbingan gratis seputar setup kandang/aquarium dan nutrisi satwa."},
				{"title":"Legal & Berizin","description":"Hanya menjual jenis satwa yang tidak dilindungi dan aman dipelihara."}
			]`,
			AboutLocation: "Jl. Margonda Raya No. 128, Depok, Jawa Barat",
			AboutHours:    "Selasa - Minggu: 10:00 - 20:00 WIB (Senin Tutup)",
			Classes:       []string{"Ikan Hias & Aquascape", "Reptil & Gecko", "Mamalia Kecil (Sugar Glider)", "Tanaman Hias & Flora", "Pakan & Perlengkapan Kandang"},
			Habitats:      []string{"Fasilitas Breeding Depok", "Aquarium Display", "Greenhouse Tanaman"},
			Statuses:      []string{"Tersedia (Lolos Karantina)", "Stok Terbatas", "Sedang Masa Adaptasi"},
			Shippings:     []string{"Kurir Hewan Instan (Jabodetabek)", "Kereta Api Express (Pulau Jawa)", "Ambil Langsung di Toko"},
		},

		// 6. URBAN PROPERTY (Real Estate & Living)
		{
			UserEmail:    "property@catavor.com",
			UserName:     "Mega Property Group",
			Password:     "password",
			Slug:         "urbanproperty",
			StoreTitle:   "Urban Living & Properti Indonesia",
			StoreSlogan:  "Listing Rumah Cluster Minimalis, Apartemen Modern & Properti Investasi Terbaik",
			PromoBanner:  "🏡 Promo DP 0% + Free Biaya BPHTB & KPR Bank untuk Cluster Sapphire BSD!",
			Theme:        "slate",
			Plan:         "pro",
			LogoURL:      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=300&q=80",
			WhatsAppJSON: `[{"label":"Konsultan Properti & KPR","number":"08123456789"},{"label":"Jadwal Survey Lokasi","number":"08986160715"}]`,
			SocialJSON:   `{"instagram":"https://instagram.com/urbanliving.property","website":"https://urbanproperty.id","youtube":"https://youtube.com/@urbanproperty"}`,
			AboutTitle:   "Urban Living Property Advisory",
			AboutSlogan:  "Membantu Anda Menemukan Rumah Impian dan Investasi Masa Depan",
			AboutDesc:    "Kami adalah agensi konsultan properti terpercaya yang menghubungkan pembeli dengan hunian berkualitas, legalitas SHM aman, dan akses transportasi strategis di Jabodetabek.",
			AboutCardsJSON: `[
				{"title":"Legalitas SHM Aman","description":"Seluruh listing telah diverifikasi sertifikat, IMB/PBG, dan riwayat PBB lunas."},
				{"title":"Dibantu KPR Sampai Akad","description":"Kerjasama dengan bank BUMN & Swasta terkemuka untuk proses approval cepat."},
				{"title":"Free Survey Lokasi","description":"Layanan antar-jemput dan pendampingan survey lokasi tanpa dipungut biaya."},
				{"title":"Nilai Investasi Tinggi","description":"Lokasi strategis dekat stasiun MRT/KRL, pintu tol, dan pusat perbelanjaan."}
			]`,
			AboutLocation: "The Breeze BSD City, Unit L-28, Tangerang Selatan",
			AboutHours:    "Setiap Hari: 08:30 - 18:00 WIB (Survey Lokasi by Appointment)",
			Classes:       []string{"Rumah Tinggal (Landed House)", "Apartemen & Kondominium", "Ruko Komersial & Usaha", "Tanah & Kavling Siap Bangun", "Villa & Resort"},
			Habitats:      []string{"BSD City", "Gading Serpong", "Jakarta Selatan", "Bintaro", "Bekasi Barat"},
			Statuses:      []string{"Siap Huni (Ready Unit)", "Indent / Tahap Pembangunan", "Disewakan (Tahunan)", "Promo Spesial Launching"},
			Shippings:     []string{"Jadwalkan Survey via WhatsApp", "Kunjungan ke Marketing Gallery", "Konsultasi KPR Online"},
		},
	}

	// Create stores and store their IDs
	createdStores := make(map[string]models.Store)

	for _, sd := range storesData {
		user := models.User{
			Name:              sd.UserName,
			Email:             sd.UserEmail,
			IsPasswordChanged: true,
		}
		_ = user.SetPassword(sd.Password)
		if err := db.Create(&user).Error; err != nil {
			fmt.Printf("Gagal membuat user %s: %v\n", sd.UserEmail, err)
			continue
		}

		classesJSON, _ := json.Marshal(sd.Classes)
		habitatsJSON, _ := json.Marshal(sd.Habitats)
		statusesJSON, _ := json.Marshal(sd.Statuses)
		shippingsJSON, _ := json.Marshal(sd.Shippings)

		store := models.Store{
			UserID:                  user.ID,
			Slug:                    sd.Slug,
			StoreTitle:              sd.StoreTitle,
			StoreSlogan:             sd.StoreSlogan,
			PromoBanner:             sd.PromoBanner,
			WhatsappNumber:          sd.WhatsAppJSON,
			OfficialWebsite:         "https://" + sd.Slug + ".catavor.com",
			StoreLogoURL:            sd.LogoURL,
			StoreTheme:              sd.Theme,
			AboutTitle:              sd.AboutTitle,
			AboutSlogan:             sd.AboutSlogan,
			AboutDescription:        sd.AboutDesc,
			AboutCards:              datatypes.JSON([]byte(sd.AboutCardsJSON)),
			AboutLocation:           sd.AboutLocation,
			AboutHours:              sd.AboutHours,
			ShowHours:               true,
			AboutDisclaimer:         "Informasi harga, ketersediaan stok, dan spesifikasi produk dapat berubah sewaktu-waktu sesuai kebijakan merchant.",
			SocialLinks:             datatypes.JSON([]byte(sd.SocialJSON)),
			Plan:                    sd.Plan,
			PaymentStatus:           "paid",
			EnableWADirect:          true,
			EnableWARekber:          true,
			RegistrationTimezone:    "Asia/Jakarta",
			MasterClasses:           datatypes.JSON(classesJSON),
			MasterHabitats:          datatypes.JSON(habitatsJSON),
			MasterStatuses:          datatypes.JSON(statusesJSON),
			MasterShippingCoverages: datatypes.JSON(shippingsJSON),
		}

		if err := db.Create(&store).Error; err != nil {
			fmt.Printf("Gagal membuat store %s: %v\n", sd.Slug, err)
			continue
		}

		createdStores[sd.Slug] = store
		fmt.Printf("  ✨ Store created: [%s] %s (Owner: %s)\n", store.Slug, store.StoreTitle, user.Email)
	}

	// 5. SEED COMPREHENSIVE PRODUCT ITEMS ACROSS ALL SECTORS
	fmt.Println("\n📦 5. Membuat Item Katalog Lengkap untuk Seluruh Kategori...")

	seedCatalogItems(db, createdStores)

	// 6. SEED ARTICLES AND COMMENTS
	fmt.Println("\n📰 6. Membuat Artikel Blog & Komentar Diskusi...")
	seedArticlesAndComments(db, createdStores["catavor"].ID)

	// 7. SEED SAMPLE COMPLAINT/VIOLATION REPORT
	fmt.Println("\n🛡️ 7. Membuat Sample Audit Report...")
	seedSampleReports(db, createdStores)

	fmt.Println("\n==================================================")
	fmt.Println("🎉 MASTER SEEDER SELESAI DENGAN SUKSES!")
	fmt.Println("==================================================")
	fmt.Println("Kredensial Default Login:")
	fmt.Println("  - Super Admin : admin@catavor.com / password (Toko: /u/catavor)")
	fmt.Println("  - Adidas Store: adidas@catavor.com / password (Toko: /u/adidas)")
	fmt.Println("  - Kuliner     : dapur@catavor.com / password (Toko: /u/dapurnusantara)")
	fmt.Println("  - Digital Hub : pixellab@catavor.com / password (Toko: /u/pixellab)")
	fmt.Println("  - Satwa/Flora : exopets@catavor.com / password (Toko: /u/exopets)")
	fmt.Println("  - Properti    : property@catavor.com / password (Toko: /u/urbanproperty)")
}

func seedCatalogItems(db *gorm.DB, stores map[string]models.Store) {
	catavorStore := stores["catavor"]
	adidasStore := stores["adidas"]
	dapurStore := stores["dapurnusantara"]
	pixellabStore := stores["pixellab"]
	exopetsStore := stores["exopets"]
	propertyStore := stores["urbanproperty"]

	// Helper for max order
	makeMaxOrder := func(n int) *int {
		return &n
	}

	type ItemSeed struct {
		StoreID             uint
		Name                string
		ScientificName      string
		Class               string
		Habitat             string
		Diet                string
		ConservationStatus  string
		Price               float64
		MinOrder            int
		MaxOrder            *int
		VideoURL            string
		IsShippingAvailable bool
		Description         string
		ImageURL            string
		ProductType         string
		Attributes          map[string]interface{}
		DetailedInfo        map[string]interface{}
		Sightings           []models.Sighting
	}

	items := []ItemSeed{
		// =========================================================================
		// 1. PHYSICAL GOODS (Fashion, Sepatu, Gadget)
		// =========================================================================
		{
			StoreID:             adidasStore.ID,
			Name:                "Sepatu Lari Ultraboost Light 23 Running Shoes",
			ScientificName:      "HP6420 - Core Black / Cloud White",
			Class:               "Sepatu Lari (Running)",
			Habitat:             "Warehouse Jakarta & Official Store",
			Diet:                "Primeknit+ Textile Upper & Continental Rubber Sol",
			ConservationStatus:  "Tersedia (Ready Stock)",
			Price:               2499000,
			MinOrder:            1,
			MaxOrder:            makeMaxOrder(5),
			VideoURL:            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			IsShippingAvailable: true,
			Description:         "Rasakan energi pantulan yang luar biasa dengan Ultraboost Light paling ringan yang pernah diciptakan oleh Adidas. Ditenagai oleh inovasi bantalan **Light BOOST** generasi terbaru yang 30% lebih ringan dibandingkan busa BOOST standar, menghasilkan responsivitas dan pengembalian energi kinetik maksimal di setiap ayunan langkah lari Anda.\n\nBagian atas menggunakan konstruksi rajutan **Primeknit+ FORGED** yang memeluk kaki secara presisi, breathable, dan terbuat dari material ramah lingkungan. Outsole karet **Continental™ Better Rubber** menjamin cengkeraman superior baik di permukaan jalanan kering maupun basah.",
			ImageURL:            "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=800&q=80",
			ProductType:         "physical",
			Attributes: map[string]interface{}{
				"condition": "Baru",
				"brand":     "Adidas Originals",
				"weight":    850,
				"variant":   "Core Black / Cloud White (Size: 40, 41, 42, 43, 44)",
			},
			DetailedInfo: map[string]interface{}{
				"shipping_terms": "### Ketentuan Pengiriman & Pengemasan\n- **Proteksi Double Box**: Setiap pasang sepatu dikemas menggunakan *original shoe box* yang dilapisi kardus pelindung tambahan (*double box*) dan *bubble wrap* tebal secara gratis.\n- **Layanan Kurir**: Pengiriman reguler via SiCepat BEST / JNE YES (1 hari sampai) dan Kurir Instan GrabExpress / GoSend untuk wilayah Jabodetabek.\n- **Asuransi Pengiriman**: Seluruh transaksi wajib diasuransikan 100% terhadap risiko kehilangan atau kerusakan selama proses pengiriman.",
				"warranty_info":  "### Kebijakan Garansi & Penukaran Ukuran\n- **100% Original Guarantee**: Garansi uang kembali 10x lipat jika barang terbukti tidak original.\n- **Tukar Ukuran (Size Exchange)**: Diperbolehkan mengajukan penukaran ukuran maksimal 7 hari sejak barang diterima dengan syarat tag utuh dan belum dipakai di luar ruangan.\n- **Garansi Pabrik**: Jaminan perbaikan atau penggantian jika terdapat cacat lem sol / jahitan dalam kurun waktu 30 hari.",
				"shipping_coverage": "Kirim Seluruh Indonesia via JNE / SiCepat / Instant",
				"purchase_links": []map[string]string{
					{"platform": "Shopee Official", "url": "https://shopee.co.id/adidas-official"},
					{"platform": "Tokopedia Mall", "url": "https://tokopedia.com/adidas-official"},
				},
			},
		},
		{
			StoreID:             adidasStore.ID,
			Name:                "Jaket Windbreaker Essentials 3-Stripes Waterproof",
			ScientificName:      "AD-WB-3STRIPES-NAVY",
			Class:               "Jaket & Hoodie",
			Habitat:             "Warehouse Jakarta",
			Diet:                "100% Recycled Polyester Dobby Water-Repellent",
			ConservationStatus:  "Tersedia (Ready Stock)",
			Price:               950000,
			MinOrder:            1,
			MaxOrder:            makeMaxOrder(10),
			VideoURL:            "",
			IsShippingAvailable: true,
			Description:         "Jaket pelindung angin dan gerimis ringan yang dirancang untuk kenyamanan aktivitas harian maupun olahraga luar ruangan. Dilengkapi lapisan *water-repellent finish* yang membuat tetesan air meluncur tanpa meresap, tudung kepala elastis yang pas, dan saku samping beritsleting untuk menyimpan ponsel dengan aman.",
			ImageURL:            "https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80",
			ProductType:         "physical",
			Attributes: map[string]interface{}{
				"condition": "Baru",
				"brand":     "Adidas Athletic",
				"weight":    420,
				"variant":   "Navy Blue / Cloud White (Size: S, M, L, XL)",
			},
			DetailedInfo: map[string]interface{}{
				"shipping_terms":    "Pengiriman setiap hari kerja pukul 15:00 WIB dengan kemasan polymailer tebal tahan air.",
				"warranty_info":     "Garansi tukar size 7 hari dan garansi retur jika terdapat cacat ritsleting pabrik.",
				"shipping_coverage": "Kirim Seluruh Indonesia via JNE / SiCepat / Instant",
			},
		},
		{
			StoreID:             catavorStore.ID,
			Name:                "Keyboard Mechanical Wireless RGB Triple-Mode Hot-Swappable",
			ScientificName:      "MK-RGB-TRI-PRO",
			Class:               "Gadget & Elektronik",
			Habitat:             "Ready Stock",
			Diet:                "PBT Doubleshot Keycaps & Gateron Yellow Pro",
			ConservationStatus:  "Tersedia (Ready Stock)",
			Price:               875000,
			MinOrder:            1,
			MaxOrder:            makeMaxOrder(3),
			VideoURL:            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			IsShippingAvailable: true,
			Description:         "Keyboard mechanical 75% compact layout dengan konektivitas Bluetooth 5.0, Wireless 2.4GHz, dan Type-C Wired. Dilengkapi gasket mount structure dengan sound dampening foam 5-layer untuk suara ketikan thocky yang empuk dan memuaskan. PCB universal 5-pin hot-swappable memudahkan penggantian switch sesuka hati.",
			ImageURL:            "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
			ProductType:         "physical",
			Attributes: map[string]interface{}{
				"condition": "Baru",
				"brand":     "TechCraft Mechanical",
				"weight":    920,
				"variant":   "Retro Grey-White (Pre-lubed Gateron Yellow Switch)",
			},
			DetailedInfo: map[string]interface{}{
				"shipping_terms":    "Dikemas dengan foam tebal dan bubble wrap berlapis. Pengiriman instant Gojek/Grab ready setiap hari.",
				"warranty_info":     "Garansi resmi distributor 1 tahun ganti unit baru untuk kerusakan PCB atau konektivitas nirkabel.",
				"shipping_coverage": "Bisa Kirim se-Indonesia (Reguler & Instant)",
			},
		},

		// =========================================================================
		// 2. DIGITAL PRODUCTS (Presets, Templates, Source Code)
		// =========================================================================
		{
			StoreID:             pixellabStore.ID,
			Name:                "Lightroom Master Presets Pack: Urban Streetwear & Cinematic Tones",
			ScientificName:      "LUTs & Color Profile Pack v4.2",
			Class:               "Preset & Color Grading",
			Habitat:             "Cloud Storage (Drive)",
			Diet:                "Adobe DNG (Mobile) & XMP (Desktop) Profiles",
			ConservationStatus:  "Instant Download Ready",
			Price:               89000,
			MinOrder:            1,
			MaxOrder:            makeMaxOrder(1),
			VideoURL:            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			IsShippingAvailable: true,
			Description:         "Koleksi 25 preset Lightroom profesional yang dirancang khusus untuk fotografi fashion, potret jalanan (*street photography*), dan konten media sosial bernuansa modern sinematik. Memberikan kontras tegas, warna kulit (*skin tone*) natural, dan gradasi warna moody hanya dengan 1-klik.\n\nTermasuk panduan PDF lengkap cara impor ke aplikasi Lightroom Mobile gratis (tanpa langganan Adobe CC) dan Lightroom CC Desktop.",
			ImageURL:            "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80",
			ProductType:         "digital",
			Attributes: map[string]interface{}{
				"file_format":  "DNG (Mobile), XMP (Desktop), PDF Guide",
				"file_size":    "28.5 MB",
				"license_type": "Lisensi Personal & Komersial Kreator",
			},
			DetailedInfo: map[string]interface{}{
				"shipping_terms": "### Pengiriman & Panduan Akses File Digital\n- **Akses Instan Otomatis**: Link download Google Drive langsung dikirim via WhatsApp & Email begitu pembayaran diverifikasi.\n- **Akses Seumur Hidup**: File dapat diunduh kapan saja tanpa batas masa berlaku (*lifetime access*).\n- **Bonus Update**: Gratis pembaruan jika terdapat tambahan preset baru di masa mendatang.",
				"warranty_info":  "### Ketentuan Lisensi\n- Boleh digunakan untuk mengedit foto klien komersial.\n- Dilarang keras menjual ulang atau membagikan file mentah (*reselling prohibited*).",
				"shipping_coverage": "Akses Instan Otomatis (Link Cloud)",
				"purchase_links": []map[string]string{
					{"platform": "Google Drive Cloud Link", "url": "https://drive.google.com"},
				},
			},
		},
		{
			StoreID:             pixellabStore.ID,
			Name:                "Notion Ultimate Life & Business OS 2026 Template",
			ScientificName:      "NTN-OS-2026-PRO",
			Class:               "Template & Notion Dashboard",
			Habitat:             "Cloud Storage (Drive)",
			Diet:                "Notion Template Link (1-Click Duplicate)",
			ConservationStatus:  "Instant Download Ready",
			Price:               129000,
			MinOrder:            1,
			MaxOrder:            makeMaxOrder(1),
			VideoURL:            "",
			IsShippingAvailable: true,
			Description:         "Template sistem manajemen hidup dan bisnis all-in-one di Notion. Mengintegrasikan pelacakan keuangan (income/expense), manajemen proyek tim (Kanban & Gantt Chart), pelacak kebiasaan harian (habit tracker), catatan rapat, dan CRM klien dalam satu dasbor terpadu yang estetis dan mudah digunakan.",
			ImageURL:            "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80",
			ProductType:         "digital",
			Attributes: map[string]interface{}{
				"file_format":  "Notion Page Link & Video Walkthrough",
				"file_size":    "Cloud Based (0 MB)",
				"license_type": "Lisensi Personal All-in-One",
			},
			DetailedInfo: map[string]interface{}{
				"shipping_terms":    "Tautan duplikasi Notion instan dikirim otomatis ke email dan WhatsApp pembeli.",
				"warranty_info":     "Bantuan panduan setup via WhatsApp jika pengguna baru pertama kali menggunakan Notion.",
				"shipping_coverage": "Akses Instan Otomatis (Link Cloud)",
			},
		},
		{
			StoreID:             catavorStore.ID,
			Name:                "Fullstack SaaS Boilerplate (Go-Fiber + React 19 + PostgreSQL)",
			ScientificName:      "CATAVOR-STARTER-KIT-V2",
			Class:               "Source Code & Web Templates",
			Habitat:             "Instant Download",
			Diet:                "Clean Architecture Go 1.23+ & Vite 8 React",
			ConservationStatus:  "Promo Spesial",
			Price:               499000,
			MinOrder:            1,
			MaxOrder:            makeMaxOrder(1),
			VideoURL:            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			IsShippingAvailable: true,
			Description:         "Source code lengkap platform SaaS multi-tenant enterprise siap pakai. Dilengkapi fitur autentikasi JWT, multi-channel WhatsApp CTA, integrasi Google OAuth, sanitasi upload gambar otomatis, database pooling GORM PostgreSQL 17, dan arsitektur Clean Monorepo standar industri.",
			ImageURL:            "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
			ProductType:         "digital",
			Attributes: map[string]interface{}{
				"file_format":  "Git Repository Access & ZIP Archive",
				"file_size":    "14.2 MB",
				"license_type": "Commercial Developer License",
			},
			DetailedInfo: map[string]interface{}{
				"shipping_terms":    "Akses repository GitHub pribadi dan link download ZIP dikirim seketika.",
				"warranty_info":     "Dokumentasi lengkap panduan setup lokal dan deploy ke VPS Linux / Docker.",
				"shipping_coverage": "Akses Instan Otomatis (Link Cloud)",
			},
		},

		// =========================================================================
		// 3. CULINARY / FOOD & BEVERAGES
		// =========================================================================
		{
			StoreID:             dapurStore.ID,
			Name:                "Paket Nasi Bebek Bakar Madu Spesial Rempah",
			ScientificName:      "Bebek Madu Rempah Wangi",
			Class:               "Makanan Utama (Main Course)",
			Habitat:             "Dapur Utama Senopati",
			Diet:                "12 Rempah Tradisional & Madu Hutan Asli",
			ConservationStatus:  "Tersedia Setiap Hari",
			Price:               48000,
			MinOrder:            1,
			MaxOrder:            makeMaxOrder(50),
			VideoURL:            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			IsShippingAvailable: true,
			Description:         "Daging bebek muda pilihan yang diungkep dengan 12 rempah Nusantara selama 4 jam hingga empuk meresap sampai ke tulang. Dipanggang di atas arang batok kelapa dengan olesan madu hutan murni dan kecap manis premium menghasilkan aroma *smoky caramel* yang lezat menggoda.\n\nSatu paket lengkap berisi: Nasi pulen daun pisang, 1 potong bebek bakar madu (paha/dada), sambal korek pedas gurih, kremesan renyah, tahu tempe goreng, dan lalapan segar timun kemangi.",
			ImageURL:            "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80",
			ProductType:         "food",
			Attributes: map[string]interface{}{
				"portion_size":     "1 Porsi Lengkap (Nasi + Lauk + Sambal + Lalapan)",
				"taste_options":    "Pedas Manis Gurih / Original Rempah",
				"spicy_level":      "Level 2 (Sedang) / Level 4 (Pedas Nampol)",
				"prep_time":        "15 - 20 Menit",
				"cooking_guide":    "Nikmati selagi hangat. Jika disimpan, hangatkan di microwave selama 1-2 menit.",
				"expired_info":     "Konsumsi dalam 6 jam (Suhu Ruang) / 24 Jam (Chiller Kulkas)",
				"storage_temp":     "Suhu Ruang / Chiller 4°C",
				"serving_capacity": "Kapasitas 1 Orang",
				"serving_method":   "Dine-in, Takeaway & Kurir Instan",
				"certification":    "100% Halal MUI & Higienis BPOM",
			},
			DetailedInfo: map[string]interface{}{
				"shipping_terms": "### Ketentuan Pemesanan & Pengiriman Makanan\n- **Dimasak Segar (Freshly Cooked)**: Makanan baru dimasak setelah pesanan dikonfirmasi.\n- **Kurir Instan & Sameday**: Dikirim menggunakan GrabExpress / GoSend Instant & Sameday untuk menjaga kesegaran.\n- **Kemasan Higienis**: Dikemas menggunakan *food-grade paper bowl* anti-bocor dengan segel keamanan kedap udara.",
				"warranty_info":  "### Garansi Kesegaran Makanan\n- Jika makanan rusak atau tumpah karena kelalaian kurir, hubungi CS kami dalam 1 jam disertai foto unboxing untuk penggantian porsi baru 100% gratis.",
				"shipping_coverage": "Kurir Instan (GoSend / GrabExpress)",
			},
		},
		{
			StoreID:             dapurStore.ID,
			Name:                "Cold Brew Artisan Coffee 1 Liter (Single Origin Arabica Gayo)",
			ScientificName:      "Cold Brew 1000ml Bottle",
			Class:               "Minuman & Kopi Nusantara",
			Habitat:             "Dapur Utama Senopati",
			Diet:                "100% Arabica Gayo Wine Processed",
			ConservationStatus:  "Tersedia Setiap Hari",
			Price:               85000,
			MinOrder:            1,
			MaxOrder:            makeMaxOrder(10),
			VideoURL:            "",
			IsShippingAvailable: true,
			Description:         "Kopi cold brew artisan yang diseduh dingin selama 16 jam menggunakan biji kopi Arabica Aceh Gayo pilihan. Menghasilkan cita rasa kopi yang halus (*smooth*), rendah asam (*low acidity*), dengan aroma buah dan cokelat hitam yang menyegarkan. Kemasan botol kaca bersegel 1 Liter dapat disajikan hingga 5-6 gelas.",
			ImageURL:            "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=800&q=80",
			ProductType:         "food",
			Attributes: map[string]interface{}{
				"portion_size":     "Botol Kaca 1000ml (5-6 Serving)",
				"taste_options":    "Black Coffee (Tanpa Gula) / Brown Sugar Latte",
				"spicy_level":      "Non-Spicy",
				"prep_time":        "Ready to Drink (Sajikan Dingin)",
				"expired_info":     "7 Hari di Kulkas / Chiller",
				"storage_temp":     "Wajib disimpan di Kulkas 2°C - 6°C",
				"serving_capacity": "5-6 Orang",
				"certification":    "100% Halal MUI",
			},
			DetailedInfo: map[string]interface{}{
				"shipping_terms":    "Wajib menggunakan Kurir Instan / Sameday dengan tambahan ice gel pack pelindung dingin.",
				"warranty_info":     "Garansi penggantian jika botol pecah saat perjalanan kurir.",
				"shipping_coverage": "Kurir Instan (GoSend / GrabExpress)",
			},
		},
		{
			StoreID:             dapurStore.ID,
			Name:                "Frozen Dimsum Ayam Udang Premium Isi 20 Pcs (Free Saus Mentai & Chili Oil)",
			ScientificName:      "Dimsum Frozen Pack 20s",
			Class:               "Frozen Food & Bumbu Siap Pakai",
			Habitat:             "Frozen Pack Warehouse",
			Diet:                "Daging Ayam Paha Segar & Udang Cincang",
			ConservationStatus:  "Tersedia Setiap Hari",
			Price:               65000,
			MinOrder:            1,
			MaxOrder:            makeMaxOrder(20),
			VideoURL:            "",
			IsShippingAvailable: true,
			Description:         "Dimsum ayam udang premium dengan tekstur daging kenyal, padat, dan *juicy*. Dibuat dari 80% daging ayam dan udang segar tanpa banyak tepung. Dilengkapi saus mentai gurih dan chili oil pedas wangi rempah.",
			ImageURL:            "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=800&q=80",
			ProductType:         "food",
			Attributes: map[string]interface{}{
				"portion_size":     "1 Pack Isi 20 Pcs + 2 Jenis Saus",
				"prep_time":        "Kukus / Goreng 8 - 10 Menit",
				"cooking_guide":    "Kukus di atas air mendidih selama 8-10 menit hingga kulit mengkilap dan daging panas merata.",
				"expired_info":     "1 Bulan di Freezer (-18°C)",
				"storage_temp":     "Freezer Beku -18°C",
				"certification":    "100% Halal MUI",
			},
			DetailedInfo: map[string]interface{}{
				"shipping_terms":    "Bisa dikirim via Paxel Next Day Cold-Chain atau Kurir Instan Jabodetabek dengan thermal pouch.",
				"warranty_info":     "Garansi retur jika produk tiba dalam kondisi asam/basi.",
				"shipping_coverage": "Paxel Next Day (Frozen Cold-Chain)",
			},
		},

		// =========================================================================
		// 4. CREATIVE & PROFESSIONAL SERVICES
		// =========================================================================
		{
			StoreID:             pixellabStore.ID,
			Name:                "Jasa Desain Brand Identity & Logo Bisnis Profesional",
			ScientificName:      "Brand Identity Design Package",
			Class:               "Jasa Desain Grafis & Branding",
			Habitat:             "Online Service (Remote)",
			Diet:                "Adobe Illustrator, Photoshop & Figma",
			ConservationStatus:  "Slot Reservasi Tersedia",
			Price:               1500000,
			MinOrder:            1,
			MaxOrder:            makeMaxOrder(1),
			VideoURL:            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			IsShippingAvailable: true,
			Description:         "Layanan perancangan identitas visual merek secara menyeluruh untuk UMKM, startup, dan korporat. Termasuk 3 konsep logo original, panduan warna (*color palette*), tipografi font, desain kartu nama, kop surat, mockup merchandise, dan *Brand Guidelines Book* format PDF.\n\nTermasuk revisi minor hingga 3x dan penyerahan seluruh file master vector (AI, EPS, SVG, PNG transparan, PDF cetak).",
			ImageURL:            "https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=800&q=80",
			ProductType:         "service",
			Attributes: map[string]interface{}{
				"duration":         "5 - 7 Hari Kerja",
				"service_location": "Online / Remote via Zoom & WhatsApp",
				"service_area":     "Seluruh Indonesia & Luar Negeri",
			},
			DetailedInfo: map[string]interface{}{
				"shipping_terms": "### Alur Pengerjaan & Reservasi Layanan\n1. **Briefing & Konsultasi**: Klien mengisi form kuesioner visi merek via Google Form / WhatsApp.\n2. **Pembayaran DP 50%**: Pengerjaan dimulai setelah DP dikonfirmasi.\n3. **Presentasi Konsep**: 3 opsi konsep logo dikirimkan dalam 4 hari kerja.\n4. **Revisi & Finalisasi**: Klien memilih 1 konsep untuk disempurnakan.\n5. **Pengiriman File Master**: Seluruh master file diunggah ke Google Drive setelah pelunasan.",
				"warranty_info":  "### Jaminan Kepuasan & Orisinalitas\n- Garansi 100% orisinalitas logo (bukan hasil jiplakan template stock).\n- Revisi minor gratis selama 14 hari setelah penyerahan file akhir.",
				"shipping_coverage": "Online Remote Collaboration",
			},
		},
		{
			StoreID:             catavorStore.ID,
			Name:                "Executive Pet Grooming & Spa Treatment (Home Visit)",
			ScientificName:      "Mobile Pet Spa Service",
			Class:               "Jasa & Layanan",
			Habitat:             "Jadwal Survey",
			Diet:                "Hypoallergenic Shampoo & Herbal Spa Conditioner",
			ConservationStatus:  "Tersedia (Ready Stock)",
			Price:               185000,
			MinOrder:            1,
			MaxOrder:            makeMaxOrder(5),
			VideoURL:            "",
			IsShippingAvailable: true,
			Description:         "Layanan grooming dan salon hewan peliharaan (kucing & anjing) panggilan langsung ke rumah Anda. Tim groomer profesional kami membawa peralatan lengkap, air hangat, shampoo anti-kutu/jamur organik, blower pengering berbulu lembut, dan gunting kuku steril.\n\nTermasuk: Mandi spa herbal, pembersihan telinga, potong kuku, cukur bulu telapak kaki & sanitasi, blow dry, dan parfum wangi tahan lama.",
			ImageURL:            "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=800&q=80",
			ProductType:         "service",
			Attributes: map[string]interface{}{
				"duration":         "60 - 90 Menit per Ekor",
				"service_location": "Datang ke Rumah Klien (Home Visit)",
				"service_area":     "Jabodetabek (Jakarta, Depok, Tangerang, Bekasi)",
			},
			DetailedInfo: map[string]interface{}{
				"shipping_terms":    "Harap melakukan booking jadwal minimal H-1 sebelum jadwal pengerjaan via WhatsApp.",
				"warranty_info":     "Groomer tersertifikasi ramah hewan tanpa pembiusan (*stress-free grooming*).",
				"shipping_coverage": "Kunjungan ke Lokasi",
			},
		},

		// =========================================================================
		// 5. LIVING FAUNA & AQUATIC LIVING
		// =========================================================================
		{
			StoreID:             exopetsStore.ID,
			Name:                "Ikan Arwana Super Red Joey Grade A+ (Sertifikat & Microchip)",
			ScientificName:      "Scleropages formosus (Super Red Papua)",
			Class:               "Ikan Hias & Aquascape",
			Habitat:             "Fasilitas Breeding Depok",
			Diet:                "Jangkrik, Udang Pasar, Ulat Jerman & Kelabang",
			ConservationStatus:  "Stok Terbatas",
			Price:               4200000,
			MinOrder:            1,
			MaxOrder:            makeMaxOrder(2),
			VideoURL:            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			IsShippingAvailable: true,
			Description:         "Ikan Arwana Super Red ukuran 14-16 cm dengan potensi anatomi kepala *spoon head* sempurna, dayung lebar samurai, ekor rapat *close tail*, dan ring sisik yang mulai berkilau merah tegas. Ikan sehat, sangat lincah, rakus makan, dan tidak memiliki minus cacat fisik.\n\nDilengkapi sertifikat silsilah resmi dan nomor Microchip RFID yang tertanam aman di tubuh ikan.",
			ImageURL:            "https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=800&q=80",
			ProductType:         "fauna",
			Attributes: map[string]interface{}{
				"condition":     "Sehat & Lincah",
				"weight":        350,
				"variant":       "Size 15cm (Spoonhead Samarinda Bloodline)",
				"certification": "Sertifikat BKSDA & Microchip RFID",
			},
			DetailedInfo: map[string]interface{}{
				"native_region":     "Kapuas Hulu, Kalimantan Barat (Breeding Farm)",
				"lifespan":          "15 - 20 Tahun",
				"weight":            "Ukuran saat ini 15 cm",
				"shipping_terms":    "### Ketentuan Pengiriman Satwa & Packing Khusus\n- **Packing Oksigen Murni**: Menggunakan kantong plastik 4 lapis beroksigen murni dan boks styrofoam tebal tahan benturan.\n- **Jalur Kereta Api / Bus**: Pengiriman via Kereta Api KIB / Herona Express 1 hari sampai untuk Pulau Jawa.\n- **Karantina Legal**: Dilengkapi surat jalan karantina resmi.",
				"warranty_info":     "### Garansi Live Arrival D.O.A 100%\n- Garansi ikan hidup sampai tujuan berlaku wajib menyertakan video unboxing utuh tanpa jeda/potongan maksimal 2 jam setelah paket tiba di alamat pembeli.",
				"shipping_coverage": "Kereta Api Express (Pulau Jawa)",
			},
			Sightings: []models.Sighting{
				{
					Location:  "Fasilitas Karantina Depok",
					Latitude:  -6.402484,
					Longitude: 106.794243,
					Notes:     "Ikan lolos karantina dan adaptasi pakan pelet/udang dengan sangat baik.",
				},
			},
		},
		{
			StoreID:             exopetsStore.ID,
			Name:                "Leopard Gecko Sunglow Tremper Albino High Quality",
			ScientificName:      "Eublepharis macularius (Sunglow Morph)",
			Class:               "Reptil & Gecko",
			Habitat:             "Fasilitas Breeding Depok",
			Diet:                "Ulat Hongkong, Jangkrik & Kalsium D3",
			ConservationStatus:  "Tersedia (Lolos Karantina)",
			Price:               350000,
			MinOrder:            1,
			MaxOrder:            makeMaxOrder(4),
			VideoURL:            "",
			IsShippingAvailable: true,
			Description:         "Leopard Gecko morph Sunglow Tremper Albino dengan warna tubuh oranye cerah merata tanpa spot hitam di badan, ekor montok wortel (*carrot tail 40%*), mata jernih, dan kuku lengkap. Karakter sangat jinak, tenang saat di-handle, dan cocok untuk pemula.",
			ImageURL:            "https://images.unsplash.com/photo-1574781330855-d0db8cc6a79c?auto=format&fit=crop&w=800&q=80",
			ProductType:         "fauna",
			Attributes: map[string]interface{}{
				"condition": "Sehat, Ekor Gemuk (No Defect)",
				"weight":    45,
				"variant":   "Male / Female Ready (Umur 4 Bulan)",
			},
			DetailedInfo: map[string]interface{}{
				"native_region":     "Captive Bred (CB) Indonesia",
				"lifespan":          "10 - 15 Tahun",
				"shipping_terms":    "Dikemas dalam boks plastik berventilasi + kardus berisolasi tebal.",
				"warranty_info":     "Garansi hidup sampai tujuan (D.O.A 100%) dengan video unboxing lengkap.",
				"shipping_coverage": "Kurir Hewan Instan (Jabodetabek)",
			},
		},
		{
			StoreID:             exopetsStore.ID,
			Name:                "Cupang Halfmoon Fancy Red Dragon Champion Bloodline",
			ScientificName:      "Betta splendens (HM Fancy Dragon)",
			Class:               "Ikan Hias & Aquascape",
			Habitat:             "Aquarium Display",
			Diet:                "Jentik Nyamuk, Pelet Micro & Artemia",
			ConservationStatus:  "Tersedia (Lolos Karantina)",
			Price:               175000,
			MinOrder:            1,
			MaxOrder:            makeMaxOrder(5),
			VideoURL:            "",
			IsShippingAvailable: true,
			Description:         "Ikan Cupang jantan varian Halfmoon Fancy Dragon dengan bukaan ekor 180 derajat sempurna, sirip dorsal lebar, sisik naga tebal berkilau, dan form mental petarung (*flaring*) yang agresif dan anggun.",
			ImageURL:            "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80",
			ProductType:         "fauna",
			Attributes: map[string]interface{}{
				"condition": "Sehat, Form Rapi 180 Derajat",
				"weight":    15,
				"variant":   "Size M (Umur 4.5 Bulan)",
			},
			DetailedInfo: map[string]interface{}{
				"native_region":     "Indonesia Betta Breeding Center",
				"lifespan":          "2 - 3 Tahun",
				"shipping_terms":    "Bisa kirim se-Indonesia via ekspedisi kilat Paxel / TIKI ONS dengan packing boks styrofoam.",
				"warranty_info":     "Garansi D.O.A penggantian ikan baru jika terjadi kematian saat perjalanan.",
				"shipping_coverage": "Kurir Hewan Instan (Jabodetabek)",
			},
		},

		// =========================================================================
		// 6. REAL ESTATE & PROPERTIES
		// =========================================================================
		{
			StoreID:             propertyStore.ID,
			Name:                "Rumah Cluster Modern Minimalis 2 Lantai SHM di BSD City",
			ScientificName:      "Cluster Sapphire Residence - Type 90/120",
			Class:               "Rumah Tinggal (Landed House)",
			Habitat:             "BSD City",
			Diet:                "Spesifikasi Bata Merah, Granit 60x60, Rangka Baja Ringan",
			ConservationStatus:  "Siap Huni (Ready Unit)",
			Price:               1250000000,
			MinOrder:            1,
			MaxOrder:            makeMaxOrder(1),
			VideoURL:            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			IsShippingAvailable: true,
			Description:         "Hunian eksklusif bergaya arsitektur Tropis Modern Minimalis di kawasan prestisius BSD City. Desain *high ceiling* (tinggi plafon 3.8m) memberikan sirkulasi udara segar alami dan pencahayaan optimal sepanjang hari.\n\nFasilitas Cluster: One Gate System dengan Access Card RFID, Keamanan 24 Jam CCTV, Club House & Kolam Renang, Children Playground, serta Jogging Track teduh. Akses hanya 5 menit ke Pintu Tol BSD Barat dan Stasiun KRL Cisauk.",
			ImageURL:            "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80",
			ProductType:         "property",
			Attributes: map[string]interface{}{
				"transaction_type":  "Dijual",
				"certificate":       "SHM (Sertifikat Hak Milik On Hand)",
				"land_area":         120,
				"building_area":     90,
				"bedrooms":          3,
				"bathrooms":         2,
				"floors":            "2 Lantai",
				"electricity":       "2200 VA",
				"water_source":      "PDAM & Sumur Bor Jetpump",
				"furnishing":        "Semi-Furnished (Kitchen Set + AC 2 Unit)",
				"carport":           "2 Mobil (Canopy Tempered Glass)",
				"facing":            "Utara",
				"property_location": "BSD City, Tangerang Selatan",
				"facilities":        "One Gate System, Security 24 Jam, Swimming Pool, Taman Bermain, Akses Jalan 2 Mobil",
			},
			DetailedInfo: map[string]interface{}{
				"shipping_terms": "### Akses & Jadwal Survey Lokasi\n- **Survey Lokasi**: Buka setiap hari pukul 09:00 - 17:00 WIB (harap konfirmasi H-1 via WhatsApp).\n- **Kemudahan Akses**: 5 Menit ke Gerbang Tol BSD, 7 Menit ke AEON Mall BSD, 10 Menit ke Stasiun KRL Cisauk.\n- **Jalan Lingkungan**: ROW Jalan 8 meter muat 2 mobil leluasa.",
				"warranty_info":  "### Legalitas & Jaminan Dokumen\n- Sertifikat Hak Milik (SHM) on hand, IMB/PBG lengkap, PBB lunas.\n- Pembayaran: Cash Keras, Cash Bertahap (Inhouse 12x), atau KPR Bank (kerjasama BCA, Mandiri, BNI - dibantu proses hingga akad).",
				"shipping_coverage": "Jadwalkan Survey via WhatsApp",
			},
			Sightings: []models.Sighting{
				{
					Location:  "Cluster Sapphire Residence, BSD City",
					Latitude:  -6.301234,
					Longitude: 106.652345,
					Notes:     "Lokasi strategis dekat dengan pusat perkantoran dan sekolah internasional.",
				},
			},
		},
		{
			StoreID:             propertyStore.ID,
			Name:                "Studio Apartemen Mewah Full-Furnished View Kolam Renang",
			ScientificName:      "Urban Sky Residences - Tower B Lt. 15",
			Class:               "Apartemen & Kondominium",
			Habitat:             "Gading Serpong",
			Diet:                "Interior Custom Minimalis Skandinavia",
			ConservationStatus:  "Disewakan (Tahunan)",
			Price:               42000000,
			MinOrder:            1,
			MaxOrder:            makeMaxOrder(1),
			VideoURL:            "",
			IsShippingAvailable: true,
			Description:         "Unit apartemen tipe studio luas 28 m² dengan perabot lengkap (*full-furnished*) siap huni. Dilengkapi ranjang Queen Size King Koil, Smart TV 43 inch, kulkas inverter 2 pintu, kompor induksi tanam, microwave, water heater, dan balkon pribadi menghadap pemandangan kolam renang infinity.",
			ImageURL:            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80",
			ProductType:         "property",
			Attributes: map[string]interface{}{
				"transaction_type":  "Disewakan (Tahunan)",
				"certificate":       "Strata Title (PPJB)",
				"land_area":         28,
				"building_area":     28,
				"bedrooms":          1,
				"bathrooms":         1,
				"floors":            "Lantai 15",
				"electricity":       "1300 VA",
				"water_source":      "PDAM Gedung",
				"furnishing":        "Full-Furnished",
				"carport":           "Dedicated Basement Parking",
				"facing":            "Selatan (Pool View)",
				"property_location": "Gading Serpong, Tangerang",
				"facilities":        "Infinity Pool, Gym & Fitness Center, Sky Lounge, Mini Market 24 Jam, Laundry Service",
			},
			DetailedInfo: map[string]interface{}{
				"shipping_terms":    "Kunci dan kartu akses diserahkan langsung setelah penandatanganan perjanjian sewa.",
				"warranty_info":     "Deposit sewa 1 bulan dikembalikan penuh saat masa sewa berakhir jika unit terawat baik.",
				"shipping_coverage": "Jadwalkan Survey via WhatsApp",
			},
		},
	}

	for _, item := range items {
		attrsJSON, _ := json.Marshal(item.Attributes)
		detailsJSON, _ := json.Marshal(item.DetailedInfo)

		fauna := models.Fauna{
			StoreID:             item.StoreID,
			Name:                item.Name,
			ScientificName:      item.ScientificName,
			Class:               item.Class,
			Habitat:             item.Habitat,
			Diet:                item.Diet,
			ConservationStatus:  item.ConservationStatus,
			Price:               item.Price,
			MinOrder:            item.MinOrder,
			MaxOrder:            item.MaxOrder,
			VideoURL:            item.VideoURL,
			IsShippingAvailable: item.IsShippingAvailable,
			Description:         item.Description,
			ImageURL:            item.ImageURL,
			ProductType:         item.ProductType,
			Attributes:          datatypes.JSON(attrsJSON),
			DetailedInfo:        datatypes.JSON(detailsJSON),
		}

		if err := db.Create(&fauna).Error; err != nil {
			fmt.Printf("Gagal membuat item %s: %v\n", item.Name, err)
			continue
		}

		// Create sightings if present
		for _, s := range item.Sightings {
			sighting := models.Sighting{
				FaunaID:   fauna.ID,
				Location:  s.Location,
				Latitude:  s.Latitude,
				Longitude: s.Longitude,
				Notes:     s.Notes,
			}
			db.Create(&sighting)
		}

		fmt.Printf("    + [%s] %s (Rp %.0f)\n", fauna.ProductType, fauna.Name, fauna.Price)
	}
}

func seedArticlesAndComments(db *gorm.DB, storeID uint) {
	articles := []models.Article{
		{
			StoreID:                  storeID,
			Title:                    "Panduan Memulai Katalog Digital Multi-Sektor di Era SaaS Modern",
			Slug:                     "panduan-memulai-katalog-digital-multi-sektor-2026",
			Content:                  "Di era perdagangan digital serba cepat saat ini, memiliki katalog online yang cepat, responsif, dan terintegrasi langsung dengan saluran komunikasi pelanggan (seperti WhatsApp) adalah kunci meningkatkan konversi penjualan.\n\n### 1. Keunggulan Single URL Catalog\nSetiap tenant bisnis memiliki identitas toko unik (slug URL) yang dapat dibagikan di bio Instagram, status WhatsApp, maupun kartu nama digital. Pelanggan tidak perlu mengunduh aplikasi tambahan untuk menjelajahi seluruh varian produk.\n\n### 2. Integrasi Multi-Channel WhatsApp\nFitur order generator otomatis merangkum detail nama produk, harga, dan tautan katalog ke dalam pesan WhatsApp siap kirim, memangkas waktu tanya-jawab berulang antara pembeli dan admin toko.",
			ImageURL:                 "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
			Author:                   "Admin Catavor",
			ReadTime:                 "4 mnt baca",
			MetaDescription:          "Pelajari cara mengoptimalkan katalog online digital bisnis Anda untuk melipatgandakan omset penjualan.",
			IsCommentsEnabled:        true,
			RequireCommentApproval:   false,
			RequireCommentEmail:      false,
			VerifyCommentEmailDomain: false,
		},
		{
			StoreID:                  storeID,
			Title:                    "5 Tips Memilih Sepatu Lari yang Tepat untuk Menghindari Cedera",
			Slug:                     "5-tips-memilih-sepatu-lari-yang-tepat",
			Content:                  "Memilih sepatu lari bukan sekadar melihat warna atau model yang keren. Bentuk telapak kaki (pronation) dan jenis lintasan yang Anda tempuh sangat menentukan kenyamanan serta keselamatan sendi kaki Anda.\n\n### 1. Kenali Tipe Pronasi Kaki\nApakah kaki Anda bertipe Normal Arch, Flat Feet (Overpronation), atau High Arch (Underpronation)? Untuk pelari jarak jauh, bantalan empuk dan fleksibel seperti teknologi Ultraboost sangat disarankan.",
			ImageURL:                 "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=800&q=80",
			Author:                   "Tim Runner Pro",
			ReadTime:                 "5 mnt baca",
			MetaDescription:          "Panduan praktis memilih sepatu lari terbaik sesuai postur dan jenis telapak kaki.",
			IsCommentsEnabled:        true,
			RequireCommentApproval:   false,
			RequireCommentEmail:      false,
			VerifyCommentEmailDomain: false,
		},
	}

	for _, art := range articles {
		if err := db.Create(&art).Error; err != nil {
			fmt.Printf("Gagal membuat artikel %s: %v\n", art.Title, err)
			continue
		}

		// Add sample comment
		comment := models.Comment{
			ArticleID:   art.ID,
			AuthorName:  "Rian Pratama",
			AuthorEmail: "rian@gmail.com",
			Content:     "Artikel yang sangat bermanfaat! Fitur katalog multi-sektor ini sangat cocok untuk usaha kuliner dan aksesoris saya.",
			IsApproved:  true,
		}
		db.Create(&comment)

		reply := models.Comment{
			ArticleID:   art.ID,
			ParentID:    &comment.ID,
			AuthorName:  "Admin Catavor",
			AuthorEmail: "support@catavor.com",
			Content:     "Terima kasih Kak Rian! Sukses selalu untuk pengembangan katalog usahanya.",
			IsApproved:  true,
			ReplyToName: "Rian Pratama",
		}
		db.Create(&reply)

		fmt.Printf("  📰 Artikel created: %s (dengan 2 komentar diskusi)\n", art.Title)
	}
}

func seedSampleReports(db *gorm.DB, stores map[string]models.Store) {
	catavorStore := stores["catavor"]
	adidasStore := stores["adidas"]

	report := models.Report{
		ReportNumber:      "RPT-20260831-001",
		TargetType:        "catalog",
		StoreID:           adidasStore.ID,
		StoreSlug:         adidasStore.Slug,
		StoreTitle:        adidasStore.StoreTitle,
		ReasonCategory:    "copyright_inquiry",
		ReasonLabel:       "Pemeriksaan Lisensi Brand Resmi",
		Description:       "Pengecekan rutin keabsahan izin display katalog brand resmi Adidas Indonesia.",
		ReporterEmail:     "audit@catavor.com",
		ReporterIP:        "127.0.0.1",
		ReporterUserAgent: "Catavor Internal Audit Bot v2.0",
		Status:            "resolved",
		AdminNotes:        "Verifikasi dokumen lisensi distributor resmi PT Adidas Indonesia telah valid dan disetujui.",
		ActionTaken:       "none",
	}
	db.Create(&report)
	_ = catavorStore
	fmt.Printf("  🛡️ Sample Audit Report created: %s (%s)\n", report.ReportNumber, report.Status)
}
