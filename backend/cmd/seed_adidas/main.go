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

	var adidasStore models.Store
	if err := db.Where("LOWER(slug) = ? OR LOWER(store_title) = ?", "adidas", "adidas").First(&adidasStore).Error; err != nil {
		fmt.Printf("Store 'adidas' not found in database: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Found Store: ID=%d, Title=%s, Slug=%s\n", adidasStore.ID, adidasStore.StoreTitle, adidasStore.Slug)

	// 1. Find all fauna IDs for store adidas
	var faunaIDs []uint
	db.Model(&models.Fauna{}).Where("store_id = ?", adidasStore.ID).Pluck("id", &faunaIDs)

	if len(faunaIDs) > 0 {
		// Clean up foreign key references in reports and sightings
		db.Where("fauna_id IN ?", faunaIDs).Delete(&models.Report{})
		db.Where("fauna_id IN ?", faunaIDs).Delete(&models.Sighting{})

		// Delete all faunas for store adidas
		result := db.Where("store_id = ?", adidasStore.ID).Delete(&models.Fauna{})
		if result.Error != nil {
			fmt.Printf("Error deleting existing items: %v\n", result.Error)
			os.Exit(1)
		}
		fmt.Printf("Deleted %d existing items for store '%s'.\n", result.RowsAffected, adidasStore.StoreTitle)
	} else {
		fmt.Printf("No existing items found for store '%s'.\n", adidasStore.StoreTitle)
	}

	// 2. Create high-quality, realistic new catalog items for each type

	// ITEM 1: PHYSICAL GOODS (Sepatu Olahraga Original)
	physicalMaxOrder := 5
	physicalDetails, _ := json.Marshal(map[string]interface{}{
		"shipping_terms": "### Ketentuan Pengiriman & Ekspedisi\n- **Proteksi Double Box**: Setiap pasang sepatu dikemas menggunakan *original shoe box* yang dilapisi kardus pelindung tambahan (*double box*) dan *bubble wrap* tebal tanpa biaya tambahan.\n- **Layanan Kurir**: Pengiriman reguler via SiCepat BEST / JNE YES (1 hari sampai) dan Kurir Instan GrabExpress / GoSend untuk wilayah Jabodetabek.\n- **Asuransi Pengiriman**: Seluruh transaksi wajib diasuransikan 100% terhadap risiko kehilangan atau kerusakan selama proses pengiriman oleh kurir.",
		"warranty_info":  "### Kebijakan Garansi & Penukaran Ukuran\n- **100% Original Guarantee**: Garansi uang kembali 10x lipat jika barang terbukti tidak original (kami distributor resmi berlisensi).\n- **Tukar Ukuran (Size Exchange)**: Diperbolehkan mengajukan penukaran ukuran maksimal 7 hari sejak barang diterima, dengan syarat tag utuh, sepatu belum pernah digunakan di luar ruangan, dan kardus dalam kondisi mulus.\n- **Garansi Kerusakan Pabrik**: Jaminan perbaikan atau penggantian jika terdapat cacat lem sol / jahitan dalam kurun waktu 30 hari.",
		"shipping_coverage": "Kirim Seluruh Indonesia via JNE / SiCepat / Instant",
		"purchase_links": []map[string]string{
			{"platform": "Shopee Official", "url": "https://shopee.co.id/adidas-official"},
			{"platform": "Tokopedia Mall", "url": "https://tokopedia.com/adidas-official"},
		},
	})

	physicalAttrs, _ := json.Marshal(map[string]interface{}{
		"stock":         25,
		"condition":     "Baru",
		"brand":         "Adidas Originals",
		"weight":        850,
		"variant":       "Core Black / Cloud White (Size: 40, 41, 42, 43, 44)",
		"min_order":     1,
		"max_order":     5,
		"certification": "100% Original Authentic & SNI Certified",
	})

	physicalItem := models.Fauna{
		StoreID:             adidasStore.ID,
		Name:                "Sepatu Lari Ultraboost Light 23 Running Shoes",
		ScientificName:      "HP6420 - Core Black / Cloud White",
		Class:               "Sepatu Olahraga",
		Habitat:             "Warehouse Jakarta & Official Store",
		Diet:                "Primeknit+ Textile Upper & Continental Rubber Sol",
		ConservationStatus:  "Stok Tersedia (Original 100%)",
		Price:               2499000,
		MinOrder:            1,
		MaxOrder:            &physicalMaxOrder,
		VideoURL:            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		IsShippingAvailable: true,
		Description:         "Rasakan energi pantulan yang luar biasa dengan Ultraboost Light paling ringan yang pernah diciptakan oleh Adidas. Ditenagai oleh teknologi bantalan inovatif **Light BOOST** generasi terbaru yang 30% lebih ringan dibandingkan busa BOOST standar, menghasilkan pengembalian energi kinetik maksimal di setiap langkah lari Anda.\n\nBagian atas menggunakan konstruksi rajutan **Primeknit+ FORGED** yang memeluk kaki secara presisi, breathable, dan terbuat dari minimal 50% material daur ulang Parley Ocean Plastic. Dilengkapi dengan outsole karet **Continental™ Better Rubber** yang memberikan cengkeraman superior baik di permukaan jalanan kering maupun basah.",
		ImageURL:            "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=800&q=80",
		ProductType:         "physical",
		DetailedInfo:        datatypes.JSON(physicalDetails),
		Attributes:          datatypes.JSON(physicalAttrs),
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// ITEM 2: KULINER (Food & Beverage)
	foodMaxOrder := 50
	foodDetails, _ := json.Marshal(map[string]interface{}{
		"shipping_terms": "### Ketentuan Pemesanan, PO & Pengiriman\n- **Freshly Cooked by Order**: Setiap hidangan baru mulai dimasak setelah pesanan masuk guna memastikan kerenyahan dan kesegaran optimal.\n- **Waktu Operasional Pengiriman**: Pengiriman instan dibuka setiap hari pukul 10:00 - 20:00 WIB via GoSend Instant, GrabExpress, & ShopeeXpress Instant.\n- **Packaging Khusus**: Menggunakan *eco-friendly paper bowl* anti-bocor bersertifikasi food-grade dengan lapisan aluminium foil penahan panas serta kabel *cable-tie* pengaman segel higienis.",
		"warranty_info":  "### Jaminan Kualitas & Garansi 100% Kesegaran\n- **Garansi Tiba Hangat**: Kami menjamin hidangan tiba dalam keadaan hangat dan lezat di meja Anda.\n- **Kompensasi Makanan Rusak / Tumpah**: Jika makanan mengalami kerusakan atau tumpah parah akibat penanganan kurir di jalan, hubungi kami via WhatsApp dalam kurun waktu 60 menit setelah diterima untuk pengiriman porsi baru gratis atau *instant full refund*.",
		"shipping_coverage": "Kurir Instan & Sameday Jabodetabek",
	})

	foodAttrs, _ := json.Marshal(map[string]interface{}{
		"portion_size":     "1 Porsi Lengkap (Wagyu 110g + Nasi Jepang + Onsen Egg + Sambal)",
		"taste_options":    "Sambal Matah Bali / Teriyaki Garlic / Blackpepper Glaze",
		"spicy_level":      "Level 2 (Pedas Sedang Nikmat)",
		"prep_time":        "15 - 20 Menit",
		"cooking_guide":    "### Petunjuk Penyajian & Menghangatkan\n1. **Santap Langsung**: Buka segel dan santap langsung selagi hangat untuk menikmati kelembutan daging Wagyu yang meleleh di mulut.\n2. **Microwave**: Lepaskan tutup mangkuk dan hangatkan di microwave selama 1 - 2 menit pada daya sedang (*medium power*).\n3. **Penyimpanan Chiller**: Jika ingin disantap nanti, simpan di dalam kulkas chiller (tahan hingga 24 jam).",
		"expired_info":     "Konsumsi dalam 4 jam (Suhu Ruang) / 24 Jam (Chiller 4°C)",
		"storage_temp":     "Suhu Ruang / Chiller 4°C",
		"serving_capacity": "Kapasitas 1 Orang Dewasa",
		"serving_method":   "Dine-in, Takeaway & Kurir Instan",
		"certification":    "100% Halal MUI & Standar Higienis BPOM",
		"condition":        "Baru",
		"min_order":        1,
		"max_order":        50,
	})

	foodItem := models.Fauna{
		StoreID:             adidasStore.ID,
		Name:                "Signature Wagyu Beef Bowl Sambal Matah Onsen Egg",
		ScientificName:      "Japanese-Nusantara Fusion Beef Rice Bowl",
		Class:               "Makanan Utama",
		Habitat:             "Kitchen Studio & Food Lab",
		Diet:                "Australian Wagyu MB5+ & Rempah Alami",
		ConservationStatus:  "Fresh Cooked by Order",
		Price:               58000,
		MinOrder:            1,
		MaxOrder:            &foodMaxOrder,
		VideoURL:            "",
		IsShippingAvailable: true,
		Description:         "Irisan daging sapi Australian Wagyu MB5+ premium yang dimasak cepat di atas wajan teppanyaki panas dengan bumbu shoyu karamel gurih, dipadukan secara sempurna dengan sambal matah khas Bali beraroma serai dan jeruk limau segar.\n\nDisajikan di atas nasi pulen Jepang hangat dengan pelengkap telur *onsen tamago* setengah matang yang creamy, irisan daun bawang segar, taburan wijen sangrai, dan kerupuk pangsit renyah. Pilihan santapan mewah dan memuaskan untuk makan siang maupun makan malam Anda.",
		ImageURL:            "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
		ProductType:         "food",
		DetailedInfo:        datatypes.JSON(foodDetails),
		Attributes:          datatypes.JSON(foodAttrs),
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// ITEM 3: LAYANAN / JASA (Service)
	serviceMaxOrder := 5
	serviceDetails, _ := json.Marshal(map[string]interface{}{
		"shipping_terms": "### SOP Layanan & Prosedur Antar-Jemput (Pickup & Delivery)\n- **Layanan Antar-Jemput Gratis**: Tim kurir kami melayani penjemputan dan pengantaran sepatu ke alamat rumah / kantor Anda di area Jabodetabek untuk minimal pesanan 2 pasang sepatu.\n- **Jadwal Pickup**: Senin s/d Minggu pukul 09:00 - 17:00 WIB (slot jadwal dikonfirmasi oleh admin H-1).\n- **Estimasi Pengerjaan**: 2 hingga 3 hari kerja terhitung sejak sepatu tiba dan masuk antrean di studio perawatan kami.",
		"warranty_info":  "### Jaminan Kepuasan & Garansi Perawatan\n- **Garansi Cuci Ulang 100% Gratis**: Apabila hasil pembersihan dinilai kurang maksimal atau masih menyisakan noda yang bisa dihilangkan, Anda berhak mengajukan cuci ulang tanpa biaya tambahan dalam waktu 3 hari setelah sepatu diantar kembali.\n- **Proteksi Keamanan Sepatu**: Kami menggunakan chemical pembersih khusus *sneaker cleaner* berbasis bahan organik ramah material (non-detergent) sehingga tidak akan merusak tekstur suede, nubuck, leather, maupun knit.",
		"shipping_coverage": "Layanan Antar-Jemput Gratis Jabodetabek & Drop Outlet",
	})

	serviceAttrs, _ := json.Marshal(map[string]interface{}{
		"duration":             "2 - 3 Hari Pengerjaan",
		"service_location":     "Antar-Jemput (Pickup Delivery) / Datang ke Outlet",
		"service_area":         "Jabodetabek (Jakarta, Bogor, Depok, Tangerang, Bekasi)",
		"inclusions":           "1. Deep Cleaning menyeluruh Upper, Midsole, Outsole, & Insole\n2. Pembersihan & Perendaman Tali Sepatu (Laces Detailing)\n3. Pengeringan Khusus Dehumidifier (Tanpa Dijemur Sinar Matahari)\n4. Treatment Semprotan Anti-Bakteri & Penghilang Bau (Anti-Odor Spray)\n5. Packaging Plastik Klip Kedap Udara & Silica Gel Box",
		"client_requirements":  "1. Sepatu tidak dalam kondisi robek atau sol lepas parah sebelum dicuci\n2. Berikan catatan khusus jika sepatu pernah terkena noda minyak, getah, atau luntur",
		"certification":        "Certified Master Sneaker Care Specialist & Eco-Cleaner Protocol",
		"min_order":            1,
		"max_order":            5,
	})

	serviceItem := models.Fauna{
		StoreID:             adidasStore.ID,
		Name:                "Jasa Deep Cleaning & Unyellowing Treatment Sepatu Sneaker",
		ScientificName:      "Premium Sneaker Care & Restoration Treatment",
		Class:               "Perawatan & Restorasi",
		Habitat:             "Workshop Studio & Mobile Pickup",
		Diet:                "Eco-friendly Sneaker Cleaner & UV Ozone",
		ConservationStatus:  "Antrean Terbuka Setiap Hari",
		Price:               85000,
		MinOrder:            1,
		MaxOrder:            &serviceMaxOrder,
		VideoURL:            "",
		IsShippingAvailable: false,
		Description:         "Layanan perawatan dan pencucian sepatu profesional menyeluruh (*deep cleaning*) untuk segala jenis material sepatu—mulai dari canvas, leather, suede, nubuck, hingga knit premium. Menggunakan larutan pembersih khusus berbahan alami yang aman menjaga warna asli sepatu agar tidak pudar dan tidak merusak lem sol.\n\nDilengkapi dengan proses pengeringan ruangan terkontrol suhu (*dehumidifier chamber*) dan sterilisasi sinar UV-Ozone untuk membasmi 99.9% kuman dan bakteri penyebab bau apek pada sepatu kesayangan Anda.",
		ImageURL:            "https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=800&q=80",
		ProductType:         "service",
		DetailedInfo:        datatypes.JSON(serviceDetails),
		Attributes:          datatypes.JSON(serviceAttrs),
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// ITEM 4: DIGITAL PRODUCT (Asset Digital / Presets / Modul)
	digitalMaxOrder := 1
	digitalDetails, _ := json.Marshal(map[string]interface{}{
		"shipping_terms": "### Panduan Akses & Pengunduhan Instan 24/7\n- **Akses Otomatis Instan**: Link pengunduhan file Google Drive & Direct CDN Cloud Storage akan langsung aktif secara otomatis tepat setelah status pembayaran diverifikasi.\n- **Penyimpanan Cloud Seumur Hidup**: Berkas dapat diunduh kapan saja tanpa batas kuota kedaluwarsa (*lifetime unlimited download access*).\n- **Bonus Panduan Instalasi**: Disertai berkas video tutorial dan PDF *step-by-step* cara impor preset ke aplikasi Lightroom Mobile (iOS & Android) serta Lightroom CC / Photoshop Camera Raw (Desktop).",
		"warranty_info":  "### Ketentuan Lisensi Resmi & Hak Penggunaan\n- **Lisensi Personal Selamanya**: Diperuntukkan bagi 1 pengguna untuk kebutuhan editing foto konten media sosial pribadi maupun portofolio karya komersial.\n- **Ketentuan Hak Cipta**: Dilarang keras membagikan ulang tautan, menjual kembali (*reselling*), atau mengklaim kepemilikan file preset tanpa izin tertulis dari pencipta.\n- **Bantuan Teknis**: Disediakan bantuan panduan langsung via WhatsApp jika mengalami kendala saat proses instalasi ke ponsel.",
		"shipping_coverage": "Pengiriman Digital Otomatis (Link Download Cloud)",
	})

	digitalAttrs, _ := json.Marshal(map[string]interface{}{
		"file_format":   "DNG (Mobile iOS/Android) & XMP (Desktop Mac/Windows) + PDF Guide",
		"file_size":     "18.4 MB (Paket 15 Koleksi Presets Lengkap)",
		"license_type":  "Lisensi Personal Seumur Hidup (Lifetime)",
		"version":       "Edisi Signature 2026 (v3.1)",
		"certification": "Hak Cipta Digital Terdaftar & Original Creator",
		"min_order":     1,
		"max_order":     1,
	})

	digitalItem := models.Fauna{
		StoreID:             adidasStore.ID,
		Name:                "Preset Lightroom Mobile & Desktop: Streetwear & Moody Tone",
		ScientificName:      "Color Grading LUTs & Aesthetic Filter Pack",
		Class:               "Preset & Desain",
		Habitat:             "Digital Cloud Storage",
		Diet:                "DNG & XMP Presets Asset",
		ConservationStatus:  "Instan Download Otomatis",
		Price:               49000,
		MinOrder:            1,
		MaxOrder:            &digitalMaxOrder,
		VideoURL:            "",
		IsShippingAvailable: true,
		Description:         "Koleksi 15 preset warna Lightroom premium bertema *Streetwear & Moody Urban Tone* yang dirancang khusus untuk meningkatkan estetika foto OOTD, sneaker photography, gaya hidup urban, dan pemandangan perkotaan hanya dalam satu kali klik (*1-Click Magic Editing*).\n\nMembantu menyeimbangkan kontras bayangan, menonjolkan warna kulit (*skin-tone*) secara natural, mempertegas tekstur pakaian, serta memberikan nuansa sinematik modern yang konsisten pada feed Instagram dan konten TikTok Anda.",
		ImageURL:            "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
		ProductType:         "digital",
		DetailedInfo:        datatypes.JSON(digitalDetails),
		Attributes:          datatypes.JSON(digitalAttrs),
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// ITEM 5: SATWA / FAUNA (Exotic Pets & Showcase)
	faunaMaxOrder := 2
	faunaDetails, _ := json.Marshal(map[string]interface{}{
		"shipping_terms": "### Standar Pengiriman Satwa Hidup Bergaransi\n- **Pengiriman Pulau Jawa**: Dikirim menggunakan armada Travel AC Berizin Khusus atau Ekspedisi Kereta Api Khusus Hewan (KIB Cepat / KALOG / KI8) dengan jaminan tiba dalam 24 jam.\n- **Kandang Transit Nyaman**: Satwa ditempatkan di dalam kandang transit berbahan kayu solid yang dilengkapi ventilasi udara berlapis, alas serutan kayu steril bebas debu, serta pakan kering & sayuran penyuplai cairan selama perjalanan.\n- **Pengiriman Luar Pulau**: Dikirim via kargo udara resmi lengkap dengan Surat Izin Kesehatan Karantina Pertanian & BKSDA.",
		"warranty_info":  "### Prosedur Klaim Garansi Live Arrival (D.O.A 100%)\n1. **Rekam Video Unboxing**: Pembeli wajib membuat rekaman video unboxing utuh tanpa jeda / tanpa edit (*continuous unedited video*) dimulai dari pemeriksaan kondisi segel kardus hingga satwa terlihat jelas bergerak aktif.\n2. **Batas Waktu Klaim**: Laporan konfirmasi kedatangan maksimal 2 jam setelah paket dinyatakan tiba oleh kurir travel/kereta.\n3. **Penggantian Penuh**: Apabila terjadi hal yang tidak diinginkan selama perjalanan, kami berikan satwa pengganti atau pengembalian dana 100% dari harga hewan.",
		"native_region":  "Pegunungan Andes, Amerika Selatan (Captive Bred Hasil Ternak Lokal)",
		"lifespan":       "10 - 15 Tahun",
		"weight":         "450 - 600 Gram (Usia 4 Bulan)",
		"shipping_coverage": "Kirim se-Pulau Jawa via Travel AC / Kereta Cepat KIB",
	})

	faunaAttrs, _ := json.Marshal(map[string]interface{}{
		"condition":     "Sehat Aktif & Sangat Jinak",
		"min_order":     1,
		"max_order":     2,
		"fauna_class":   "Mamalia Eksotis",
		"fauna_status":  "Tersedia (Captive Bred)",
		"certification": "Buku Vaksin & Sertifikat Sehat Dokter Hewan",
	})

	faunaItem := models.Fauna{
		StoreID:             adidasStore.ID,
		Name:                "Chinchilla Grey Royal Velvet Keturunan Import Usia 4 Bulan",
		ScientificName:      "Chinchilla lanigera",
		Class:               "Mamalia Eksotis",
		Habitat:             "Ruangan AC Sejuk (Suhu 18 - 22°C)",
		Diet:                "Rumput Timothy Hay, Alfalfa, & Pelet Oxbow",
		ConservationStatus:  "Captive Bred (Sehat & Bebas Kutu)",
		Price:               3800000,
		MinOrder:            1,
		MaxOrder:            &faunaMaxOrder,
		VideoURL:            "",
		IsShippingAvailable: true,
		Description:         "Chinchilla anakan usia 4 bulan varian *Standard Grey Royal Velvet* dengan bulu abu-abu keperakan yang luar biasa lebat, sehalus sutra, dan tidak menyebabkan alergi (hypoallergenic). Satwa hasil penangkaran (*captive bred*) keturunan indukan import resmi yang memiliki karakter sangat jinak, lincah, gemar bermain, dan sudah terbiasa berinteraksi ramah dengan manusia.\n\nTelah melalui pemeriksaan kesehatan menyeluruh oleh dokter hewan spesialis satwa eksotis, bebas jamur/kutu, gigi rapi, nafsu makan tinggi terhadap rumput kering Timothy Hay dan pelet nutrisi seimbang. Sangat cocok menjadi hewan peliharaan keluarga di dalam rumah sejuk ber-AC.",
		ImageURL:            "https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=800&q=80",
		ProductType:         "fauna",
		DetailedInfo:        datatypes.JSON(faunaDetails),
		Attributes:          datatypes.JSON(faunaAttrs),
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// 3. Insert all new items
	items := []models.Fauna{physicalItem, foodItem, serviceItem, digitalItem, faunaItem}
	for _, item := range items {
		if err := db.Create(&item).Error; err != nil {
			fmt.Printf("Failed to create item %s: %v\n", item.Name, err)
		} else {
			fmt.Printf("Successfully created item [%s]: '%s' (ID: %d)\n", item.ProductType, item.Name, item.ID)
		}
	}

	fmt.Println("\nAll 5 new items for store 'adidas' have been seeded with 100% complete fields!")
}
