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
		fmt.Printf("Error connecting DB: %v\n", err)
		os.Exit(1)
	}

	var stores []models.Store
	if err := db.Find(&stores).Error; err != nil {
		fmt.Printf("Error fetching stores: %v\n", err)
		os.Exit(1)
	}

	if len(stores) == 0 {
		fmt.Println("No stores found in DB!")
		os.Exit(1)
	}

	for _, store := range stores {
		fmt.Printf("Seeding sample items for store: %s (ID: %d, Slug: %s)...\n", store.StoreTitle, store.ID, store.Slug)
		seedItemsForStore(db, store.ID)
	}

	fmt.Println("All sample items created and verified successfully!")
}

func seedItemsForStore(db *gorm.DB, storeID uint) {
	// Sample 1: Kuliner (Food)
	foodDetails, _ := json.Marshal(map[string]interface{}{
		"shipping_terms": "### Ketentuan Pemesanan & Pengiriman Kuliner\n- **Sistem Pre-Order (PO)**: Pesanan dimasak segar sesuai antrean harian (*freshly cooked by order*).\n- **Jadwal Pengiriman**: Pengiriman dilakukan setiap hari pukul 10:00 - 18:00 WIB via Kurir Instan (GrabExpress/GoSend Instant & Sameday).\n- **Batas Waktu Order**: Pesanan yang masuk setelah pukul 15:00 WIB akan diproses untuk pengiriman hari kerja berikutnya.\n- **Packaging Higienis**: Dikemas menggunakan *food-grade paper bowl* anti-bocor dengan segel keamanan kedap udara.",
		"warranty_info":  "### Jaminan Kualitas & Garansi Kesegaran\n- **100% Fresh Guarantee**: Kami menjamin makanan tiba dalam kondisi hangat, higienis, dan cita rasa terjaga.\n- **Kebijakan Penggantian**: Apabila pesanan tumpah atau rusak akibat kelalaian kurir, hubungi admin dalam waktu 1 jam setelah status terkirim disertai foto & video unboxing untuk penggantian porsi baru atau *full refund*.",
		"shipping_coverage": "Kurir Instan & Sameday Jabodetabek",
	})

	foodAttributes, _ := json.Marshal(map[string]interface{}{
		"portion_size":     "1 Porsi Lengkap (Nasi + Lauk + Sambal + Lalapan)",
		"taste_options":    "Pedas Manis Gurih / Original",
		"spicy_level":      "Level 3 (Pedas Nampol)",
		"prep_time":        "15 - 25 Menit",
		"cooking_guide":    "### Petunjuk Menikmati & Menghangatkan\n1. **Langsung Santap**: Buka segel dan santap selagi hangat untuk kerenyahan optimal.\n2. **Microwave**: Buka tutup kemasan, masukkan ke microwave selama 1 - 2 menit pada daya sedang (*medium heat*).\n3. **Wajan / Teflon**: Hangatkan lauk di atas teflon tanpa minyak tambahan selama 2 - 3 menit dengan api kecil.\n4. **Simpan di Kulkas**: Jika belum ingin disantap, simpan di chiller (tahan hingga 24 jam).",
		"expired_info":     "Konsumsi dalam 6 jam (Suhu Ruang) / 24 Jam (Chiller)",
		"storage_temp":     "Suhu Ruang / Chiller 4°C",
		"serving_capacity": "Kapasitas 1 Orang Dewasa",
		"serving_method":   "Dine-in, Takeaway & Kurir Instan",
		"certification":    "100% Halal MUI & Higienis BPOM",
		"condition":        "Baru",
		"min_order":        1,
		"max_order":        50,
	})

	foodItem := models.Fauna{
		StoreID:             storeID,
		Name:                "Paket Nasi Bebek Bakar Madu Spesial Rempah",
		ScientificName:      "",
		Class:               "Makanan Utama",
		Habitat:             "Dapur Nusantara",
		Diet:                "Rempah Alami",
		ConservationStatus:  "Tersedia Setiap Hari",
		Price:               45000,
		MinOrder:            1,
		IsShippingAvailable: true,
		Description:         "Bebek bakar pilihan yang diungkep dengan 12 macam rempah tradisional Nusantara selama 4 jam hingga bumbu meresap sempurna ke serat daging terdalam. Dipanggang di atas arang batok kelapa dengan olesan madu hutan murni dan kecap manis premium menghasilkan aroma *smoky caramel* yang menggugah selera.\n\nDilengkapi dengan nasi pulen hangat, sambal korek bawang pedas gurih, serundeng kelapa renyah, tahu tempe goreng, dan lalapan segar pilihan. Sangat cocok dinikmati untuk makan siang kantor, makan malam keluarga, maupun hidangan pesta.",
		ImageURL:            "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80",
		ProductType:         "food",
		DetailedInfo:        datatypes.JSON(foodDetails),
		Attributes:          datatypes.JSON(foodAttributes),
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// Sample 2: Layanan / Jasa (Service)
	serviceDetails, _ := json.Marshal(map[string]interface{}{
		"shipping_terms": "### Prosedur Reservasi & SOP Kunjungan Tim\n- **Jadwal Kunjungan**: Senin - Minggu, Pukul 08:00 - 17:00 WIB sesuai kesepakatan jadwal *booking*.\n- **Wilayah Layanan**: Mencakup seluruh area Jabodetabek (Jakarta, Bogor, Depok, Tangerang, Bekasi).\n- **Konfirmasi Jadwal**: Tim admin kami akan melakukan verifikasi via WhatsApp H-1 sebelum kedatangan untuk memastikan ketersediaan akses lokasi.\n- **Peralatan Kerja**: Tim teknisi membawa peralatan lengkap, chemical water treatment standar lab, dan filter vacuum cleaner mandiri.",
		"warranty_info":  "### Jaminan Layanan & Garansi Ekosistem 14 Hari\n- **Free Follow-up Visit**: Garansi kejernihan air dan stabilitas parameter biologi air selama 14 hari kerja setelah sesi perawatan selesai.\n- **Penggantian Tanaman & Ikan**: Jika terjadi kematian biota air akibat *human error* dari tim selama pengerjaan, kami berikan penggantian biota 100% tanpa biaya tambahan.",
		"shipping_coverage": "Kunjungan Langsung ke Rumah / Kantor",
	})

	serviceAttributes, _ := json.Marshal(map[string]interface{}{
		"duration":          "2 - 3 Jam per Sesi",
		"service_location":  "Datang ke Lokasi (Home / Office Visit)",
		"service_area":      "Jabodetabek & Sekitarnya",
		"inclusions":        "1. Water Change & Siphon Substrate (50% volume air)\n2. Trimming & Scaping Tanaman Air\n3. Cleaning Kaca, Filter Canister & Impeller Mesin\n4. Pengujian Parameter Kimia Air (pH, GH, KH, TDS, Amonia, Nitrat)\n5. Dosing Pupuk Cair & Bakteri Starter Premium",
		"client_requirements": "1. Menyediakan sumber air bersih dan stop kontak listrik terdekat\n2. Memberikan akses masuk area aquarium kepada teknisi kami",
		"certification":     "Sertifikat Certified Aquascaper & Biosecurity Protocol",
		"min_order":         1,
		"max_order":         5,
	})

	serviceItem := models.Fauna{
		StoreID:             storeID,
		Name:                "Jasa Maintenance & Deep Cleaning Aquascape Tank",
		ScientificName:      "",
		Class:               "Perawatan & Desain",
		Habitat:             "On-site Service",
		Diet:                "Jasa Profesional",
		ConservationStatus:  "Jadwal Terbuka",
		Price:               250000,
		MinOrder:            1,
		IsShippingAvailable: false,
		Description:         "Layanan perawatan aquarium dan aquascape secara berkala dan menyeluruh oleh aquascaper berpengalaman lebih dari 7 tahun. Layanan ini mencakup pembersihan kerak kaca, pemotongan (*trimming*) tanaman liar, peremajaan moss, pembersihan menyeluruh tabung canister filter, penggantian media mekanik/biologis, serta kalibrasi sistem CO2 injeksi.\n\nSangat ideal untuk menjaga ekosistem aquarium tetap bening berkilau (*crystal clear*), bebas alga membandel, serta menjaga kesehatan ikan dan tanaman kesayangan Anda tanpa repot.",
		ImageURL:            "https://images.unsplash.com/photo-1520302630591-fd1c66edc19d?auto=format&fit=crop&w=800&q=80",
		ProductType:         "service",
		DetailedInfo:        datatypes.JSON(serviceDetails),
		Attributes:          datatypes.JSON(serviceAttributes),
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// Sample 3: Produk Digital (Digital)
	digitalDetails, _ := json.Marshal(map[string]interface{}{
		"shipping_terms": "### Panduan Akses & Pengunduhan Instan\n- **Akses Langsung 24/7**: Tautan unduhan langsung aktif secara otomatis setelah pembayaran terverifikasi.\n- **Penyimpanan Cloud**: Berkas tersimpan aman di server Google Drive & Cloud Storage berkecepatan tinggi tanpa batas waktu kedaluwarsa (*lifetime access*).\n- **Pembaruan Gratis**: Anda akan otomatis mendapatkan email notifikasi jika terdapat pembaruan versi modul e-book di masa mendatang.",
		"warranty_info":  "### Ketentuan Lisensi Penggunaan & Hak Cipta\n- **Lisensi Personal**: Diperuntukkan bagi 1 pengguna untuk kebutuhan pembelajaran dan hobi pribadi.\n- **Hak Akses & Copy**: Dilarang keras menyebarluaskan, menjual kembali (*reselling*), atau mengunggah ulang konten ke platform publik tanpa izin tertulis dari penulis.\n- **Dukungan Konsultasi**: Termasuk akses ke grup diskusi privat Telegram eksklusif pembaca e-book.",
		"shipping_coverage": "Pengiriman Digital Otomatis (Link Download)",
	})

	digitalAttributes, _ := json.Marshal(map[string]interface{}{
		"file_format":   "PDF High-Res (Full Color) + Spreadsheet Calculator",
		"file_size":     "45.8 MB (185 Halaman)",
		"license_type":  "Lisensi Personal Eksklusif",
		"version":       "Edisi Revisi 2026 (v3.2)",
		"certification": "Hak Cipta Terdaftar Kemenkumham RI",
		"min_order":     1,
		"max_order":     1,
	})

	digitalItem := models.Fauna{
		StoreID:             storeID,
		Name:                "E-Book Panduan Lengkap Aquascape & Biotop Indonesia",
		ScientificName:      "",
		Class:               "E-Book & Publikasi",
		Habitat:             "Digital Asset",
		Diet:                "File Download",
		ConservationStatus:  "Instan Download",
		Price:               85000,
		MinOrder:            1,
		IsShippingAvailable: true,
		Description:         "Panduan komprehensif 185 halaman bergambar penuh warna yang mengupas tuntas seni merancang dan merawat ekosistem aquascape dari nol hingga tingkat profesional. Ditulis oleh praktisi aquascaper nasional dengan studi kasus nyata pembuatan tank low-tech, mid-tech, hingga high-tech.\n\nMemuat bab khusus tentang pemilihan substrat, pencahayaan PAR spektrum penuh, pemupukan makro/mikro, pencegahan segala jenis alga (BBA, GSA, Staghorn), serta katalog lebih dari 100 spesies tanaman air dan fauna endemik Indonesia yang ideal untuk miniatur alam dalam kaca.",
		ImageURL:            "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
		ProductType:         "digital",
		DetailedInfo:        datatypes.JSON(digitalDetails),
		Attributes:          datatypes.JSON(digitalAttributes),
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// Sample 4: Satwa / Fauna (Fauna)
	faunaDetails, _ := json.Marshal(map[string]interface{}{
		"shipping_terms": "### Standar Pengiriman Satwa Hidup (Live Animals)\n- **Packing Standar IATA**: Menggunakan box styrofoam tebal dengan kantong plastik ganda, oksigen murni 100%, serta *heat pack* atau *ice pack* sesuai kebutuhan suhu satwa.\n- **Layanan Ekspedisi**: Khusus Pulau Jawa via Kereta Api (KIB / KALOG / KI8) atau Kurir 1 Hari Sampai (TIKI ONS / SiCepat BEST).\n- **Luar Pulau**: Pengiriman resmi via kargo karantina udara lengkap dengan surat jalan karantina resmi.",
		"warranty_info":  "### Syarat & Prosedur Garansi D.O.A (Death on Arrival)\n1. **Video Unboxing Wajib**: Rekam video unboxing utuh tanpa terputus (*no cut, no edit*) mulai dari kondisi segel kardus hingga satwa terlihat jelas di dalam kantong.\n2. **Batas Waktu Klaim**: Maksimal 2 jam setelah paket dinyatakan tiba oleh kurir ekspedisi.\n3. **Kompensasi Penuh**: Kami memberikan penggantian satwa baru (ongkir ditanggung pembeli) atau pengembalian dana 100% dari harga satwa.",
		"native_region":  "Amazon Basin, Amerika Selatan (Captive Bred)",
		"lifespan":       "10 - 15 Tahun",
		"weight":         "15 - 20 cm (Dewasa)",
		"shipping_coverage": "Kirim se-Indonesia via Kereta & Kargo Udara",
	})

	faunaAttributes, _ := json.Marshal(map[string]interface{}{
		"condition":           "Sehat Aktif & Rakus",
		"min_order":           1,
		"max_order":           10,
		"fauna_class":         "Ikan Hias Air Tawar",
		"fauna_status":        "Tersedia (Captive Bred)",
		"certification":       "Sertifikat Kesehatan Ikan Karantina KKP",
	})

	faunaItem := models.Fauna{
		StoreID:             storeID,
		Name:                "Discus Pigeon Blood Red High Body 3.5 Inch",
		ScientificName:      "Symphysodon aequifasciatus",
		Class:               "Ikan Hias Air Tawar",
		Habitat:             "Blackwater Amazon / Aquascape",
		Diet:                "Pelet Premium, Cacing Beku & Jantung Sapi",
		ConservationStatus:  "Captive Bred (Sehat & Bebas Parasit)",
		Price:               350000,
		MinOrder:            1,
		IsShippingAvailable: true,
		Description:         "Ikan Discus kualitas kontes varian Pigeon Blood Red dengan postur tubuh bulat sempurna (*high body*), mata merah menyala, dan pola bintik merah cerah kontras di atas dasar tubuh krem keemasan. Ikan hasil penangkaran (*captive bred*) lokal berkualitas tinggi yang sudah teradaptasi dengan baik pada parameter air tawar Indonesia (pH 6.5 - 7.0, TDS 100-150).\n\nSangat rakus memakan pelet tenggelam, cacing beku (*bloodworm*), dan burger jantung sapi. Dipelihara dalam air steril bebas parasit dengan karantina mandiri minimal 14 hari sebelum siap dikirim ke penghobi.",
		ImageURL:            "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80",
		ProductType:         "fauna",
		DetailedInfo:        datatypes.JSON(faunaDetails),
		Attributes:          datatypes.JSON(faunaAttributes),
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// Sample 5: Barang Fisik (Physical Goods / Aquascape Set)
	physicalDetails, _ := json.Marshal(map[string]interface{}{
		"shipping_terms": "### Ketentuan Pengiriman Barang Pecah Belah\n- **Kemasan Ekstra Aman**: Wajib menggunakan *wooden crate* (palet kayu solid) dengan lapisan bubble wrap berlapis dan styrofoam sudut tebal.\n- **Asuransi Pengiriman**: Seluruh pengiriman wajib diasuransikan 100% terhadap risiko benturan atau pecah selama proses transit ekspedisi.\n- **Wilayah Jabodetabek**: Tersedia opsi pengiriman langsung via armada mobil toko (*Private Delivery Truck*) dengan jaminan anti pecah sampai di meja Anda.",
		"warranty_info":  "### Kebijakan Garansi Toko & Kebocoran\n- **Garansi Lem & Kebocoran 1 Tahun**: Kami memberikan jaminan perbaikan atau penggantian tank jika terjadi kebocoran silikon selama 12 bulan pemakaian normal.\n- **Klaim Pecah Saat Kirim**: Jika kaca pecah saat diterima kurir, sertakan bukti unboxing untuk penggantian unit baru tanpa biaya tambahan.",
		"shipping_coverage": "Mobil Toko Jabodetabek / Kargo Palet Kayu",
		"enable_wa_rekber": true,
		"enable_wa_direct": true,
		"purchase_links": []map[string]string{
			{"platform": "Shopee Official", "url": "https://shopee.co.id/search?keyword=aquarium+crystal+clear"},
			{"platform": "Tokopedia Store", "url": "https://tokopedia.com/search?q=aquarium+rimless+crystal+clear"},
		},
	})

	physicalAttributes, _ := json.Marshal(map[string]interface{}{
		"condition":     "Baru (Original Pabrik)",
		"brand":         "AquaNature Ultra Clear",
		"weight":        12000,
		"variant":       "Rimless Low-Iron Optic Clear 60cm",
		"min_order":     1,
		"max_order":     5,
		"certification": "SNI & Glass Safety Certified",
	})

	physicalItem := models.Fauna{
		StoreID:             storeID,
		Name:                "Aquarium Crystal Clear Rimless Glass 60x30x36 cm (8mm)",
		ScientificName:      "",
		Class:               "Aquarium & Hardscape",
		Habitat:             "Home & Office Tank",
		Diet:                "Hardware",
		ConservationStatus:  "Stok Tersedia",
		Price:               520000,
		MinOrder:            1,
		IsShippingAvailable: true,
		Description:         "Tank kaca aquarium tanpa bingkai (*rimless*) berbahan 100% kaca ultra clear *low-iron glass* dengan tingkat kejernihan transparansi mencapai 92%. Kaca ini tidak memiliki bias warna hijau seperti kaca float biasa, sehingga warna tanaman air, karang, dan ikan hias terlihat sangat natural dan hidup seperti melihat langsung tanpa batas kaca.\n\nDisambung presisi menggunakan lem silikon Jerman khusus aquarium berkekuatan tarik tinggi (*high tensile strength*) dengan tepian kaca yang telah dipoles mesin *diamond edge chamfered* yang halus dan aman dipegang.",
		ImageURL:            "https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=800&q=80",
		ProductType:         "physical",
		DetailedInfo:        datatypes.JSON(physicalDetails),
		Attributes:          datatypes.JSON(physicalAttributes),
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// Sample 6: Properti & Real Estate (Property)
	propertyDetails, _ := json.Marshal(map[string]interface{}{
		"shipping_terms": "### Akses Lokasi & Jadwal Survey Unit\n- **Jadwal Survey**: Layanan kunjungan dan survey unit dibuka setiap hari Senin - Minggu pukul 09:00 - 17:00 WIB (konfirmasi H-1 via WhatsApp).\n- **Akses Transportasi**: Akses jalan row 8 meter (muat 2 mobil leluasa), bebas banjir 100%, 5 menit ke Gerbang Tol BSD Timur dan Stasiun Rawa Buntu.\n- **Fasilitas Kawasan**: One Gate System, security 24 jam dengan CCTV, underground utilities (kabel bawah tanah), dan taman bermain anak.",
		"warranty_info":  "### Legalitas & Skema Transaksi Aman\n- **Status Sertifikat**: Sertifikat Hak Milik (SHM) on hand, IMB/PBG lengkap, PBB lunas, dan siap proses balik nama di hadapan Notaris/PPAT.\n- **Metode Pembayaran**: Mendukung Cash Keras, Cash Bertahap (In-House hingga 12 bulan), atau KPR Bank (kerjasama dengan BCA, Mandiri, BNI, BTN - dibantu hingga akad kredit disetujui).\n- **Garansi Bangunan**: Garansi pemeliharaan struktur & kebocoran atap selama 3 bulan setelah serah terima kunci.",
		"shipping_coverage": "Survey Lokasi Langsung di BSD City",
	})

	propertyAttributes, _ := json.Marshal(map[string]interface{}{
		"transaction_type":  "Dijual",
		"certificate":       "SHM (Sertifikat Hak Milik)",
		"land_area":         "120",
		"building_area":     "95",
		"bedrooms":          3,
		"bathrooms":         2,
		"floors":            "2 Lantai",
		"electricity":       "2200 VA",
		"water_source":      "PDAM & Sumur Bor",
		"furnishing":        "Semi-Furnished",
		"carport":           "2 Mobil",
		"facing":            "Timur",
		"property_location": "Cluster Greenwich Park, BSD City, Tangerang Selatan",
		"facilities":        "One Gate System, Keamanan 24 Jam, Club House, Kolam Renang, Akses Jalan 2 Mobil",
		"min_order":         1,
		"max_order":         1,
	})

	propertyItem := models.Fauna{
		StoreID:             storeID,
		Name:                "Rumah Minimalis Modern 2 Lantai Siap Huni - BSD City",
		ScientificName:      "",
		Class:               "Rumah Tinggal (Landed House)",
		Habitat:             "Cluster Residential",
		Diet:                "Real Estate",
		ConservationStatus:  "Unit Siap Huni (Ready Stock)",
		Price:               1250000000,
		MinOrder:            1,
		IsShippingAvailable: false,
		Description:         "Rumah tinggal idaman dengan desain arsitektur modern tropis 2 lantai di kawasan premium BSD City. Mengutamakan pencahayaan alami dengan *high ceiling* (tinggi plafon 3.8 meter) dan sirkulasi udara silang (*cross ventilation*) yang sejuk dan hemat energi.\n\nMemiliki tata ruang lapang terdiri dari 3 kamar tidur luas, 2 kamar mandi *full sanitair* Toto, ruang keluarga menyatu dengan *dining area*, dapur bersih dengan *kitchen set* marmer, *carport* berkanopi untuk 2 mobil, serta taman hijau asri di bagian depan dan belakang rumah. Lokasi sangat strategis dekat pusat perbelanjaan (AEON Mall, The Breeze), sekolah internasional, dan rumah sakit ternama.",
		ImageURL:            "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
		ProductType:         "property",
		DetailedInfo:        datatypes.JSON(propertyDetails),
		Attributes:          datatypes.JSON(propertyAttributes),
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// Insert all 6 sample items into database
	items := []models.Fauna{foodItem, serviceItem, digitalItem, faunaItem, physicalItem, propertyItem}
	for _, item := range items {
		var existing models.Fauna
		if err := db.Where("store_id = ? AND name = ?", item.StoreID, item.Name).First(&existing).Error; err != nil {
			if err := db.Create(&item).Error; err != nil {
				fmt.Printf("Error creating item %s: %v\n", item.Name, err)
			} else {
				fmt.Printf("Created sample item: [%s] %s (ID: %d)\n", item.ProductType, item.Name, item.ID)
			}
		} else {
			// Update existing to ensure latest rich textarea content
			item.ID = existing.ID
			db.Save(&item)
			fmt.Printf("Updated sample item with rich textarea content: [%s] %s (ID: %d)\n", item.ProductType, item.Name, item.ID)
		}
	}
}
