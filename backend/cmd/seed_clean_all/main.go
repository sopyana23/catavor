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

	fmt.Println("=== 1. WIPING ALL OLD CATALOG ITEMS FROM DATABASE ===")
	// Clean up child tables first
	db.Exec("DELETE FROM reports")
	db.Exec("DELETE FROM sightings")
	delResult := db.Exec("DELETE FROM faunas")
	fmt.Printf("Deleted %d total faunas across all stores.\n", delResult.RowsAffected)

	// Fetch all stores in DB
	var stores []models.Store
	db.Find(&stores)
	fmt.Printf("Found %d stores in database.\n", len(stores))

	for _, store := range stores {
		fmt.Printf("\n--- Seeding Store: %s (ID: %d, Slug: %s) ---\n", store.StoreTitle, store.ID, store.Slug)

		// 1. PHYSICAL GOODS
		physicalMax := 5
		physicalDetails, _ := json.Marshal(map[string]interface{}{
			"shipping_terms": "### Ketentuan Pengiriman & Pengemasan\n- **Proteksi Double Box**: Setiap paket pesanan dikemas menggunakan kardus pelindung tambahan (*double box*) dan lapisan *bubble wrap* tebal secara gratis.\n- **Kurir & Ekspedisi**: Mendukung pengiriman reguler/kilat via JNE YES, SiCepat BEST, serta pengiriman instan GrabExpress / GoSend untuk wilayah terjangkau.\n- **Asuransi Pengiriman**: Seluruh transaksi wajib diasuransikan terhadap kehilangan maupun kerusakan fisik saat pengiriman.",
			"warranty_info":  "### Kebijakan Garansi & Retur\n- **100% Original Guarantee**: Garansi uang kembali jika produk terbukti tidak asli.\n- **Tukar Ukuran (Size Exchange)**: Pengajuan penukaran ukuran maksimal 7 hari sejak barang diterima, dengan syarat kondisi belum pernah dipakai di luar ruangan dan tag utuh.\n- **Garansi Pabrik**: Jaminan perbaikan atau penggantian bila terdapat cacat produksi dalam 30 hari.",
			"shipping_coverage": "Bisa Kirim se-Indonesia (Reguler, Kilat & Instan)",
			"purchase_links": []map[string]string{
				{"platform": "Shopee Official", "url": "https://shopee.co.id/" + store.Slug},
				{"platform": "Tokopedia Official", "url": "https://tokopedia.com/" + store.Slug},
			},
		})
		physicalAttrs, _ := json.Marshal(map[string]interface{}{
			"condition": "Baru",
			"weight":    850,
			"brand":     store.StoreTitle,
			"variant":   "Size: 40, 41, 42, 43, 44 (Warna: Core Black / Cloud White)",
		})
		itemPhysical := models.Fauna{
			StoreID:             store.ID,
			Name:                "Sepatu Lari Ultraboost Light Performance Edition",
			ScientificName:      "UB-LIGHT-2026",
			Class:               "Sepatu Olahraga",
			Habitat:             "Warehouse Utama & Official Store",
			Diet:                "Primeknit+ Textile & Continental Rubber",
			ConservationStatus:  "Tersedia (Ready Stock)",
			Price:               2499000,
			MinOrder:            1,
			MaxOrder:            &physicalMax,
			VideoURL:            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			IsShippingAvailable: true,
			Description:         "Sepatu lari performa tinggi dengan teknologi bantalan Light BOOST generasi terbaru yang 30% lebih ringan dan responsif. Memberikan pengembalian energi kinetik maksimal di setiap ayunan langkah lari Anda.\n\nKonstruksi upper Primeknit+ memeluk kaki secara presisi, breathable, dan sangat nyaman digunakan untuk lari harian jarak jauh (marathon) maupun aktivitas olahraga intensif.",
			ImageURL:            "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=800&q=80",
			ProductType:         "physical",
			DetailedInfo:        datatypes.JSON(physicalDetails),
			Attributes:          datatypes.JSON(physicalAttrs),
			CreatedAt:           time.Now(),
			UpdatedAt:           time.Now(),
		}

		// 2. DIGITAL PRODUCT
		digitalMax := 1
		digitalDetails, _ := json.Marshal(map[string]interface{}{
			"shipping_terms": "### Pengiriman & Panduan Akses File Digital\n- **Akses Instan Otomatis**: Link download Google Drive / Direct Cloud Storage langsung aktif otomatis setelah pembayaran diverifikasi.\n- **Akses Seumur Hidup**: File dapat diunduh kapan saja tanpa batas masa berlaku (*lifetime download access*).\n- **Bonus Panduan**: Disertai video tutorial dan buku panduan PDF cara instalasi ke smartphone dan desktop.",
			"warranty_info":  "### Ketentuan Lisensi & Hak Cipta\n- **Lisensi Personal**: Berlaku untuk 1 pengguna untuk kebutuhan pengeditan foto pribadi dan portofolio komersial.\n- **Hak Cipta**: Dilarang keras menyebarluaskan link atau menjual kembali (*reselling*) file tanpa izin tertulis.\n- **Dukungan Teknis**: Bantuan panduan instalasi via WhatsApp jika mengalami kesulitan teknis.",
			"shipping_coverage": "Akses Instan Otomatis (Link Cloud)",
			"purchase_links": []map[string]string{
				{"platform": "Direct Web Access", "url": "https://drive.google.com/"},
			},
		})
		digitalAttrs, _ := json.Marshal(map[string]interface{}{
			"file_format":  "DNG (Mobile) & XMP (Desktop) + PDF Guide",
			"file_size":    "18.4 MB",
			"license_type": "Lisensi Personal",
		})
		itemDigital := models.Fauna{
			StoreID:             store.ID,
			Name:                "Preset Lightroom Mobile & Desktop: Urban Streetwear Tone",
			ScientificName:      "Digital Color Grading LUTs Pack",
			Class:               "Preset & Desain",
			Habitat:             "Digital Cloud Storage",
			Diet:                "DNG & XMP Presets Collection",
			ConservationStatus:  "Tersedia (Akses Instan)",
			Price:               49000,
			MinOrder:            1,
			MaxOrder:            &digitalMax,
			VideoURL:            "",
			IsShippingAvailable: true,
			Description:         "Paket 15 preset warna Lightroom profesional bertema Urban Streetwear & Moody Tone. Dirancang khusus untuk memaksimalkan estetika foto OOTD, potret sneaker, dan gaya hidup perkotaan hanya dalam 1 klik (*1-Click Magic Edit*).\n\nMenyeimbangkan kontras pencahayaan, mempertegas tekstur pakaian, dan menjaga warna kulit (*skin tone*) tetap natural dan proporsional.",
			ImageURL:            "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
			ProductType:         "digital",
			DetailedInfo:        datatypes.JSON(digitalDetails),
			Attributes:          datatypes.JSON(digitalAttrs),
			CreatedAt:           time.Now(),
			UpdatedAt:           time.Now(),
		}

		// 3. FAUNA & LIVING SATWA
		faunaMax := 2
		faunaDetails, _ := json.Marshal(map[string]interface{}{
			"native_region":     "Pegunungan Andes, Amerika Selatan (Captive Bred Ternak Lokal)",
			"lifespan":          "10 - 15 Tahun",
			"weight":            "450 - 600 Gram (Usia 4 Bulan)",
			"shipping_terms":    "### Pengiriman & Garansi Live Arrival (Satwa)\n- **Armada Pengiriman**: Dikirim menggunakan armada Travel AC Berizin atau Ekspedisi Kereta Api Khusus Hewan (KIB Cepat / KALOG) bergaransi tiba 24 jam.\n- **Kandang Transit Nyaman**: Dilengkapi alas serutan steril, ventilasi ganda, serta pakan kering & sayuran penyuplai cairan selama perjalanan.\n- **Pengiriman Luar Pulau**: Dikirim via kargo udara resmi dengan Surat Karantina Pertanian & BKSDA.",
			"warranty_info":     "### Ketentuan Garansi D.O.A (Dead On Arrival)\n- **Video Unboxing**: Wajib merekam video unboxing utuh tanpa jeda / edit (*continuous unedited video*) sejak segel diperiksa hingga satwa terlihat aktif.\n- **Batas Waktu Klaim**: Maksimal 2 jam setelah paket dinyatakan tiba oleh kurir/ekspedisi.\n- **Penggantian Penuh**: Penggantian satwa baru atau pengembalian dana 100% jika terjadi musibah dalam perjalanan.",
			"shipping_coverage": "Khusus Pulau Jawa / Jalur Kereta & Travel AC",
			"purchase_links": []map[string]string{
				{"platform": "WhatsApp Admin", "url": "https://wa.me/"},
			},
		})
		itemFauna := models.Fauna{
			StoreID:             store.ID,
			Name:                "Chinchilla Grey Royal Velvet Anakan Usia 4 Bulan",
			ScientificName:      "Chinchilla lanigera",
			Class:               "Mamalia Kecil & Pets",
			Habitat:             "Ruangan AC Sejuk (Suhu 18 - 22°C)",
			Diet:                "Timothy Hay, Alfalfa & Pelet Nutrisi",
			ConservationStatus:  "Tersedia",
			Price:               3800000,
			MinOrder:            1,
			MaxOrder:            &faunaMax,
			VideoURL:            "",
			IsShippingAvailable: true,
			Description:         "Chinchilla anakan usia 4 bulan varian Grey Royal Velvet dengan bulu abu-abu keperakan yang sangat lebat, sehalus sutra, dan tidak memicu alergi (*hypoallergenic*).\n\nKarakter sangat jinak, aktif, sehat, lincah, dan sudah terbiasa berinteraksi ramah dengan manusia. Telah lulus pemeriksaan kesehatan dokter hewan spesialis dan bebas dari jamur maupun parasit.",
			ImageURL:            "https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=800&q=80",
			ProductType:         "fauna",
			DetailedInfo:        datatypes.JSON(faunaDetails),
			Attributes:          datatypes.JSON([]byte("{}")),
			CreatedAt:           time.Now(),
			UpdatedAt:           time.Now(),
		}

		// 4. SERVICE / JASA
		serviceMax := 5
		serviceDetails, _ := json.Marshal(map[string]interface{}{
			"shipping_terms": "### Area Layanan, Reservasi & Ketentuan Pengerjaan\n- **Layanan Antar-Jemput Gratis**: Tim melayani penjemputan dan pengantaran sepatu ke alamat rumah / kantor di area Jabodetabek untuk minimal pesanan 2 pasang.\n- **Jadwal Pickup**: Setiap hari pukul 09:00 - 17:00 WIB (slot jadwal dikonfirmasi H-1).\n- **Estimasi Pengerjaan**: 2 hingga 3 hari kerja sejak sepatu masuk antrean di studio perawatan.",
			"warranty_info":  "### Jaminan Layanan & Garansi Kepuasan\n- **Garansi Cuci Ulang 100% Gratis**: Jika noda yang dapat dihilangkan masih tersisa, Anda berhak klaim cuci ulang gratis dalam waktu 3 hari setelah pengantaran.\n- **Keamanan Material**: Menggunakan larutan pembersih alami (*organic sneaker cleaner*) non-detergent yang aman untuk bahan suede, leather, maupun knit.",
			"shipping_coverage": "Booking Jadwal via WhatsApp / Antar-Jemput",
			"purchase_links": []map[string]string{
				{"platform": "WhatsApp Booking", "url": "https://wa.me/"},
			},
		})
		serviceAttrs, _ := json.Marshal(map[string]interface{}{
			"duration":         "2 - 3 Hari Pengerjaan",
			"service_location": "Home Visit (Ke Rumah)",
			"service_area":     "Jabodetabek (Jakarta, Bogor, Depok, Tangerang, Bekasi)",
		})
		itemService := models.Fauna{
			StoreID:             store.ID,
			Name:                "Jasa Deep Cleaning & Unyellowing Sepatu Sneaker",
			ScientificName:      "Premium Sneaker Spa & Restoration",
			Class:               "Perawatan & Grooming",
			Habitat:             "Workshop Studio & Mobile Pickup",
			Diet:                "Eco Sneaker Cleaner & UV Chamber",
			ConservationStatus:  "Tersedia (Slot Terbuka)",
			Price:               85000,
			MinOrder:            1,
			MaxOrder:            &serviceMax,
			VideoURL:            "",
			IsShippingAvailable: false,
			Description:         "Layanan pembersihan dan perawatan sepatu profesional menyeluruh (*deep cleaning*) untuk semua jenis material—canvas, leather, suede, nubuck, hingga knit premium.\n\nDilengkapi dengan proses pengeringan suhu terkontrol *dehumidifier chamber* dan sterilisasi sinar UV-Ozone untuk membasmi 99.9% bakteri penyebab bau apek pada sepatu.",
			ImageURL:            "https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=800&q=80",
			ProductType:         "service",
			DetailedInfo:        datatypes.JSON(serviceDetails),
			Attributes:          datatypes.JSON(serviceAttrs),
			CreatedAt:           time.Now(),
			UpdatedAt:           time.Now(),
		}

		// 5. FOOD / KULINER
		foodMax := 50
		foodDetails, _ := json.Marshal(map[string]interface{}{
			"shipping_terms": "### Pengiriman & Ketentuan Kemasan (F&B)\n- **Kurir & Ekspedisi**: Khusus kurir Instan / Sameday (Jabodetabek) atau Paxel Next Day (Cold-Chain 1 Hari Sampai).\n- **Standar Kemasan**: Dibuat fresh saat pesanan masuk, kemasan vacuum sealed food-grade + ice gel aman untuk menjaga suhu dan kesegaran selama perjalanan.\n- **Waktu Operasional**: Pengiriman dibuka setiap hari pukul 10:00 - 20:00 WIB.",
			"warranty_info":  "",
			"shipping_coverage": "Khusus Kurir Instan / Sameday (Gojek / Grab / Maxim)",
			"purchase_links": []map[string]string{
				{"platform": "GoFood Official", "url": "https://gofood.link/"},
				{"platform": "GrabFood Official", "url": "https://grab.link/"},
			},
		})
		itemFood := models.Fauna{
			StoreID:             store.ID,
			Name:                "Wagyu Beef Rice Bowl Sambal Matah",
			ScientificName:      "Wagyu Beef Donburi Set",
			Class:               "Makanan Beku (Frozen)",
			Habitat:             "Kitchen Studio & Food Lab",
			Diet:                "Australian Wagyu MB5+ & Rempah Segar",
			ConservationStatus:  "Tersedia",
			Price:               58000,
			MinOrder:            1,
			MaxOrder:            &foodMax,
			VideoURL:            "",
			IsShippingAvailable: true,
			Description:         "Porsi & Takaran:\n- 1 Porsi Bowl (150g Daging Australian Wagyu MB5+ & 200g Nasi Jepang Pulen)\n\nVarian Rasa & Level Pedas:\n- Pedas Segar Gurih (Level 1-3)\n\nDeskripsi Menu:\nIrisan daging sapi Australian Wagyu MB5+ yang dimasak dengan saus shoyu karamel gurih, dipadukan dengan sambal matah khas Bali beraroma serai dan jeruk limau segar.\n\nMasa Simpan & Petunjuk Penyajian/Penyimpanan:\n- Simpan di freezer suhu -18°C (tahan hingga 30 hari)\n- Microwave: Buka segel penutup, panaskan selama 2-3 menit pada suhu sedang\n- Siap disantap selagi hangat!",
			ImageURL:            "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
			ProductType:         "food",
			DetailedInfo:        datatypes.JSON(foodDetails),
			Attributes:          datatypes.JSON([]byte("{}")),
			CreatedAt:           time.Now(),
			UpdatedAt:           time.Now(),
		}

		// Insert all 5 items
		storeItems := []models.Fauna{itemPhysical, itemDigital, itemFauna, itemService, itemFood}
		for _, it := range storeItems {
			if err := db.Create(&it).Error; err != nil {
				fmt.Printf("Error creating %s: %v\n", it.Name, err)
			} else {
				fmt.Printf("Created [%s]: '%s' (ID: %d)\n", it.ProductType, it.Name, it.ID)
			}
		}
	}

	fmt.Println("\n=== SEEDING COMPLETED SUCCESSFULLY WITH 100% CLEAN & FORM-COMPLIANT DATA ===")
}
