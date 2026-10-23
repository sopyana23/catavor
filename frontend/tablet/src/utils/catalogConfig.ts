import {
  Package,
  FileCode,
  PawPrint,
  Wrench,
  Utensils,
  Building2,
  Sprout
} from 'lucide-react';

export type ItemCategoryType = 'physical' | 'digital' | 'fauna' | 'service' | 'food' | 'property' | 'plant';

export interface ItemTypeConfig {
  type: ItemCategoryType;
  typeName: string;
  badgeName: string;
  icon: any;
  color: string;
  gradientBg: string;
  modalTitle: (mode: 'create' | 'edit') => string;
  modalSubtitle: string;
  nameLabel: string;
  namePlaceholder: string;
  categoryLabel: string;
  defaultCategory: string;
  categoryOptions: string[];
  priceLabel: string;
  pricePlaceholder: string;
  photoLabel: string;
  photoHelper: string;
  videoLabel: string;
  videoPlaceholder: string;
  deliveryLabel: string;
  deliveryOptions: string[];
  deliveryTermsLabel: string;
  deliveryTermsPlaceholder: string;
  warrantyLabel?: string;
  warrantyPlaceholder?: string;
  descLabel: string;
  descPlaceholder: string;
  minOrderLabel?: string;
  minOrderPlaceholder?: string;
  maxOrderLabel?: string;
  maxOrderPlaceholder?: string;
}

export const DEFAULT_MASTER_CATEGORIES: Record<ItemCategoryType, string[]> = {
  physical: ['Pakaian & Fashion', 'Aksesoris & Gadget', 'Elektronik & Komputer', 'Perlengkapan Rumah', 'Kerajinan & Kriya', 'Koleksi & Hobi', 'Lainnya'],
  food: ['Makanan Utama (Main Course)', 'Dessert & Manisan', 'Minuman & Olahan Kopi', 'Camilan & Kudapan (Appetizer)', 'Bakery, Roti & Pastry', 'Makanan Beku (Frozen)', 'Paket Hemat & Bundling', 'Lainnya'],
  service: ['Perawatan & Grooming', 'Servis & Reparasi', 'Desain Grafis & Kreatif', 'Fotografi & Videografi', 'Kursus & Pelatihan', 'Konsultasi & Jasa Ahli', 'Kebersihan & Maintenance', 'Lainnya'],
  digital: ['E-Book & PDF', 'Template Dokumen & Notion', 'Desain Grafis & UI Kit', 'Source Code & Script', 'Audio & Musik', 'Preset & Filter', 'Video & Aset 3D', 'Lisensi Software', 'Lainnya'],
  fauna: ['Ikan Hias', 'Reptil & Amfibi', 'Burung & Unggas', 'Mamalia Kecil', 'Kucing & Anjing', 'Invertebrata & Serangga', 'Lainnya'],
  property: ['Rumah Tinggal (Landed House)', 'Apartemen & Kondominium', 'Tanah & Kavling', 'Ruko & Komersial', 'Villa & Resort', 'Gudang & Pabrik', 'Kost & Kontrakan', 'Lainnya'],
  plant: ['Tanaman Hias Daun', 'Tanaman Bunga & Anggrek', 'Bibit Buah & Pohon', 'Kaktus & Sukulen', 'Bonsai & Tanaman Seni', 'Tanaman Herbal & Rempah', 'Aquascape & Tanaman Air', 'Lainnya']
};

export function getItemTypeFormConfig(type: ItemCategoryType = 'physical'): ItemTypeConfig {
  switch (type) {
    case 'physical':
      return {
        type: 'physical',
        typeName: 'Barang Fisik',
        badgeName: 'Barang Fisik',
        icon: Package,
        color: '#2563eb',
        gradientBg: 'radial-gradient(circle at top left, rgba(37, 99, 235, 0.15) 0%, transparent 70%)',
        modalTitle: (mode) => mode === 'create' ? 'Tambah Barang Fisik' : 'Edit Barang Fisik',
        modalSubtitle: 'Lengkapi spesifikasi barang fisik, merek, varian, dan opsi pengiriman.',
        nameLabel: 'Nama Barang *',
        namePlaceholder: 'Contoh: Kaos Oversize Cotton Combed 24s / Keyboard Mechanical...',
        categoryLabel: 'Kategori / Jenis Barang *',
        defaultCategory: 'Pakaian & Fashion',
        categoryOptions: ['Pakaian & Fashion', 'Aksesoris & Gadget', 'Elektronik & Komputer', 'Perlengkapan Rumah', 'Kerajinan & Kriya', 'Koleksi & Hobi', 'Lainnya'],
        priceLabel: 'Harga Satuan (IDR) *',
        pricePlaceholder: 'Contoh: 150.000',
        photoLabel: 'Foto Barang (1-10 Foto) *',
        photoHelper: 'Unggah 1 hingga 10 foto barang fisik beresolusi jelas.',
        videoLabel: 'Video Review / Unboxing (Opsional)',
        videoPlaceholder: 'Tempel tautan video YouTube, Shorts, TikTok, atau Instagram Reels...',
        deliveryLabel: 'Pengiriman & Ketentuan Packing (Ekspedisi / Kurir)',
        deliveryOptions: ['Bisa Kirim se-Indonesia', 'Khusus Pulau Jawa / Satu Wilayah', 'Ambil Sendiri di Toko (No Shipping)', 'Kurir Instan / Sameday Only'],
        deliveryTermsLabel: 'Pengiriman & Ketentuan Packing (Ekspedisi / Kurir)',
        deliveryTermsPlaceholder: 'Contoh: Bisa kirim ke seluruh Indonesia via JNE / J&T / SiCepat atau Kurir Instan (Jabodetabek). Packing aman bubble wrap tebal + kardus gratis...',
        warrantyLabel: 'Kebijakan Garansi / Retur Barang',
        warrantyPlaceholder: 'Contoh: Garansi tukar baru 7 hari jika barang cacat produksi dengan melampirkan video unboxing...',
        descLabel: 'Deskripsi Lengkap Barang *',
        descPlaceholder: 'Jelaskan detail spesifikasi bahan/material, dimensi ukuran, kelengkapan isi kemasan, dan fitur unggulan barang ini...',
        minOrderLabel: 'Minimal Beli (Pcs) *',
        minOrderPlaceholder: '1',
        maxOrderLabel: 'Maksimal Beli per Transaksi (Opsional)',
        maxOrderPlaceholder: 'Kosongkan jika tanpa batas'
      };
    case 'digital':
      return {
        type: 'digital',
        typeName: 'Item Digital',
        badgeName: 'Item Digital',
        icon: FileCode,
        color: '#8b5cf6',
        gradientBg: 'radial-gradient(circle at top left, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
        modalTitle: (mode) => mode === 'create' ? 'Tambah Item Digital' : 'Edit Item Digital',
        modalSubtitle: 'Lengkapi tautan unduhan, format file, dan lisensi penggunaan item digital.',
        nameLabel: 'Nama File / Item Digital *',
        namePlaceholder: 'Contoh: E-Book Panduan Bisnis Kuliner / Template Notion 2026 / Source Code...',
        categoryLabel: 'Kategori Item Digital *',
        defaultCategory: 'E-Book & Publikasi',
        categoryOptions: ['E-Book & Publikasi', 'Template & Dokumen', 'Desain Grafis & UI Kit', 'Source Code & Skrip', 'Audio, Musik & SFX', 'Preset, Filter & LUTs', 'Video & Aset 3D', 'Software & Tool', 'Kursus & Modul', 'Lainnya'],
        priceLabel: 'Harga Lisensi (IDR) *',
        pricePlaceholder: 'Contoh: 75.000 (Ketik 0 jika Gratis)',
        photoLabel: 'Banner / Mockup File (1-10 Gambar) *',
        photoHelper: 'Unggah cover mockup, screenshot preview, atau banner item digital.',
        videoLabel: 'Video Preview / Demo Item Digital (Opsional)',
        videoPlaceholder: 'Tempel tautan video YouTube, Shorts, TikTok, atau Instagram Reels...',
        deliveryLabel: 'Pengiriman & Panduan Akses File Digital',
        deliveryOptions: ['Akses Instan Otomatis (Link Cloud)', 'Kirim via Email Pembeli', 'Kirim via WhatsApp Admin', 'Akses Member Area'],
        deliveryTermsLabel: 'Pengiriman & Panduan Akses File Digital',
        deliveryTermsPlaceholder: 'Contoh: Link akses Google Drive / Dropbox otomatis dikirim via WhatsApp & Email setelah transaksi berhasil diverifikasi...',
        warrantyLabel: 'Ketentuan Lisensi & Hak Cipta',
        warrantyPlaceholder: 'Contoh: Pembelian mencakup lisensi personal. Dilarang keras membagikan ulang, menjual kembali, atau mendistribusikan tanpa izin...',
        descLabel: 'Deskripsi & Isi Materi Digital *',
        descPlaceholder: 'Jelaskan daftar isi bab/file yang didapat, software yang dibutuhkan untuk membuka file, dan manfaat materi digital ini...',
        minOrderLabel: 'Minimal Beli (Lisensi/Seat) *',
        minOrderPlaceholder: '1',
        maxOrderLabel: 'Maksimal Beli per Akun (Opsional)',
        maxOrderPlaceholder: 'Kosongkan jika tanpa batas'
      };
    case 'fauna':
      return {
        type: 'fauna',
        typeName: 'Satwa',
        badgeName: 'Satwa',
        icon: PawPrint,
        color: '#059669',
        gradientBg: 'radial-gradient(circle at top left, rgba(5, 150, 105, 0.15) 0%, transparent 70%)',
        modalTitle: (mode) => mode === 'create' ? 'Tambah Data Satwa' : 'Edit Data Satwa',
        modalSubtitle: 'Lengkapi taksonomi ilmiah, kondisi satwa, masa hidup, dan garansi pengiriman hidup.',
        nameLabel: 'Nama Satwa *',
        namePlaceholder: 'Contoh: Arwana Super Red / Gecko Sunglow / Sugar Glider...',
        categoryLabel: 'Kategori Satwa *',
        defaultCategory: 'Ikan Hias',
        categoryOptions: ['Ikan Hias', 'Reptil & Amfibi', 'Burung & Unggas', 'Mamalia Kecil', 'Kucing & Anjing', 'Invertebrata & Serangga', 'Lainnya'],
        priceLabel: 'Harga Satuan (IDR) *',
        pricePlaceholder: 'Contoh: 350.000',
        photoLabel: 'Foto Satwa & Kondisi Nyata (1-10 Foto) *',
        photoHelper: 'Unggah foto asli satwa tampak depan, samping, dan detail motif/anatomi.',
        videoLabel: 'Video Satwa / Feeding Video (Opsional)',
        videoPlaceholder: 'Tempel tautan video YouTube, Shorts, TikTok, atau Instagram Reels...',
        deliveryLabel: 'Pengiriman & Garansi Live Arrival (Satwa)',
        deliveryOptions: ['Bisa Kirim se-Indonesia (Legal & Berizin)', 'Khusus Pulau Jawa / Jalur Kereta', 'Ambil Sendiri di Toko (Pickup Only)', 'Kurir Instan Hewan (Gojek/Grab)'],
        deliveryTermsLabel: 'Pengiriman & Garansi Live Arrival (Satwa)',
        deliveryTermsPlaceholder: 'Contoh: Pengiriman via Kereta Api Express (KIB/Herona) atau Bus se-Pulau Jawa. Packing boks styrofoam beroksigen, garansi D.O.A 100% dengan video unboxing full...',
        warrantyLabel: 'Ketentuan Garansi D.O.A (Dead On Arrival)',
        warrantyPlaceholder: 'Contoh: Garansi hidup sampai tujuan (D.O.A 100%) berlaku dengan menyertakan video unboxing full tanpa jeda/cut maksimal 2 jam setelah paket diterima...',
        descLabel: 'Deskripsi & Kondisi Satwa *',
        descPlaceholder: 'Jelaskan riwayat kesehatan, pola makan, keaktifan, minus (jika ada), umur/size, dan petunjuk perawatan harian...',
        minOrderLabel: 'Minimal Beli (Ekor/Pack) *',
        minOrderPlaceholder: '1',
        maxOrderLabel: 'Maksimal Beli per Kiriman (Opsional)',
        maxOrderPlaceholder: 'Contoh: 10 (Batas aman packing)'
      };
    case 'service':
      return {
        type: 'service',
        typeName: 'Jasa & Layanan',
        badgeName: 'Jasa & Layanan',
        icon: Wrench,
        color: '#d97706',
        gradientBg: 'radial-gradient(circle at top left, rgba(217, 119, 6, 0.15) 0%, transparent 70%)',
        modalTitle: (mode) => mode === 'create' ? 'Tambah Jasa & Layanan' : 'Edit Jasa & Layanan',
        modalSubtitle: 'Lengkapi estimasi durasi, metode layanan, wilayah operasional, dan jaminan pengerjaan.',
        nameLabel: 'Nama Jasa / Layanan *',
        namePlaceholder: 'Contoh: Executive Pet Grooming / Servis Laptop & PC / Sesi Foto Studio...',
        categoryLabel: 'Kategori Bidang Jasa *',
        defaultCategory: 'Perawatan & Grooming',
        categoryOptions: ['Perawatan & Grooming', 'Servis & Reparasi', 'Desain Grafis & Kreatif', 'Fotografi & Videografi', 'Kursus & Pelatihan', 'Konsultasi & Jasa Ahli', 'Kebersihan & Maintenance', 'Lainnya'],
        priceLabel: 'Tarif Layanan (IDR) *',
        pricePlaceholder: 'Contoh: 120.000 / Mulai dari Rp 100.000',
        photoLabel: 'Foto Portofolio / Dokumentasi Layanan (1-10 Foto) *',
        photoHelper: 'Unggah foto dokumentasi hasil kerja, portofolio tim, atau fasilitas peralatan.',
        videoLabel: 'Video Dokumentasi / Hasil Kerja (Opsional)',
        videoPlaceholder: 'Tempel tautan video YouTube, Shorts, TikTok, atau Instagram Reels...',
        deliveryLabel: 'Area Layanan, Reservasi & Ketentuan Pengerjaan',
        deliveryOptions: ['Booking Jadwal via WhatsApp', 'Datang Langsung ke Toko (Walk-in)', 'Reservasi DP 50% di Awal', 'Konsultasi Online Terlebih Dahulu'],
        deliveryTermsLabel: 'Area Layanan, Reservasi & Ketentuan Pengerjaan',
        deliveryTermsPlaceholder: 'Contoh: Melayani area Jabodetabek (visit) atau seluruh Indonesia (online). Harap booking minimal H-1 sebelum jadwal pengerjaan...',
        descLabel: 'Deskripsi Cakupan Layanan *',
        descPlaceholder: 'Jelaskan tahapan pengerjaan, apa saja yang termasuk dalam layanan, dan ketentuan lainnya...'
      };
    case 'food':
      return {
        type: 'food',
        typeName: 'Kuliner & F&B',
        badgeName: 'Kuliner & F&B',
        icon: Utensils,
        color: '#dc2626',
        gradientBg: 'radial-gradient(circle at top left, rgba(220, 38, 38, 0.15) 0%, transparent 70%)',
        modalTitle: (mode) => mode === 'create' ? 'Tambah Item Kuliner' : 'Edit Item Kuliner',
        modalSubtitle: 'Lengkapi takaran porsi/kemasan, masa simpan, suhu penyimpanan, dan metode pengiriman.',
        nameLabel: 'Nama Item Kuliner / Menu *',
        namePlaceholder: 'Contoh: Wagyu Beef Rice Bowl / Cold Brew Coffee / Frozen Dimsum 20pcs / Bumbu Rendang...',
        categoryLabel: 'Kategori Menu / Katalog *',
        defaultCategory: 'Makanan Utama (Main Course)',
        categoryOptions: [
          'Makanan Utama (Main Course)',
          'Dessert & Manisan',
          'Minuman & Olahan Kopi',
          'Camilan & Kudapan (Appetizer)',
          'Bakery, Roti & Pastry',
          'Makanan Beku (Frozen)',
          'Paket Hemat & Bundling',
          'Lainnya'
        ],
        priceLabel: 'Harga Satuan (IDR) *',
        pricePlaceholder: 'Contoh: 35.000',
        photoLabel: 'Foto Item / Penyajian (1-10 Foto) *',
        photoHelper: 'Unggah 1 hingga 10 foto makanan, minuman, kemasan item, atau bahan kuliner.',
        videoLabel: 'Video Item / Penyajian (Opsional)',
        videoPlaceholder: 'Tempel tautan video YouTube, Shorts, TikTok, atau Instagram Reels...',
        deliveryLabel: 'Pengiriman & Ketentuan Kemasan (F&B)',
        deliveryOptions: [
          'Khusus Kurir Instan / Sameday (Gojek / Grab / Maxim)',
          'Ekspedisi Cold-Chain / Paxel 1 Hari Sampai (Frozen / Makanan Segar)',
          'Bisa Kirim Seluruh Indonesia (Ekspedisi Reguler / Makanan Kering)',
          'Dine-in & Takeaway Only (Makan di Tempat / Bawa Pulang)',
          'Pre-Order Khusus (Katering / Acara)'
        ],
        deliveryTermsLabel: 'Pengiriman & Ketentuan Kemasan (F&B)',
        deliveryTermsPlaceholder: 'Contoh: Khusus kurir Instan / Sameday (Jabodetabek) atau Paxel Next Day. Dibuat fresh saat pesanan masuk, kemasan vacuum sealed food-grade + ice gel aman...',
        descLabel: 'Deskripsi & Detail Menu Kuliner *',
        descPlaceholder: 'Jelaskan porsi/takaran, varian rasa/level pedas, masa simpan, petunjuk penyajian/penyimpanan, dan detail lainnya...',
        minOrderLabel: 'Minimal Pesanan (Porsi/Pack) *',
        minOrderPlaceholder: '1',
        maxOrderLabel: 'Maksimal Pesanan per Order (Opsional)',
        maxOrderPlaceholder: 'Contoh: 50 (Batas kapasitas dapur)'
      };
    case 'property':
      return {
        type: 'property',
        typeName: 'Properti & Real Estate',
        badgeName: 'Properti & Real Estate',
        icon: Building2,
        color: '#0284c7',
        gradientBg: 'radial-gradient(circle at top left, rgba(2, 132, 199, 0.15) 0%, transparent 70%)',
        modalTitle: (mode) => mode === 'create' ? 'Tambah Listing Properti' : 'Edit Listing Properti',
        modalSubtitle: 'Lengkapi spesifikasi luas tanah/bangunan, legalitas SHM, kamar tidur, dan jadwal survey.',
        nameLabel: 'Judul / Nama Listing Properti *',
        namePlaceholder: 'Contoh: Rumah Cluster Minimalis 2 Lantai SHM Siap Huni di BSD City...',
        categoryLabel: 'Tipe / Jenis Properti *',
        defaultCategory: 'Rumah Tinggal (Landed House)',
        categoryOptions: [
          'Rumah Tinggal (Landed House)',
          'Apartemen & Kondominium',
          'Tanah & Kavling',
          'Ruko & Komersial',
          'Villa & Resort',
          'Gudang & Pabrik',
          'Kost & Kontrakan',
          'Lainnya'
        ],
        priceLabel: 'Harga Properti (IDR) *',
        pricePlaceholder: 'Contoh: 850.000.000 (Jual) / 35.000.000 (Sewa/Tahun)',
        photoLabel: 'Foto Properti & Interior (1-10 Foto) *',
        photoHelper: 'Unggah 1 hingga 10 foto fasad depan, ruang keluarga, kamar tidur, dapur, dan lingkungan.',
        videoLabel: 'Video Virtual Tour / Showcase Properti (Opsional)',
        videoPlaceholder: 'Tempel tautan video YouTube, Shorts, TikTok, atau Instagram Reels...',
        deliveryLabel: 'Akses & Ketentuan Booking / Survey Lokasi',
        deliveryOptions: [
          'Jadwalkan Survey via WhatsApp',
          'Siap Huni (Ready Unit)',
          'Pre-Launch / Indent',
          'Disewakan (Bulanan / Tahunan)',
          'Cash Keras / KPR Bank'
        ],
        deliveryTermsLabel: 'Akses & Ketentuan Booking / Survey Lokasi',
        deliveryTermsPlaceholder: 'Contoh: Layanan survey lokasi dibuka setiap hari pukul 09:00 - 17:00 WIB (konfirmasi H-1). Akses jalan lebar 2 mobil, bebas banjir, 5 menit ke gerbang tol...',
        warrantyLabel: 'Legalitas & Kelengkapan Dokumen',
        warrantyPlaceholder: 'Contoh: Sertifikat Hak Milik (SHM) on hand, IMB/PBG lengkap, PBB lunas. Pembayaran bisa Cash Keras, Cash Bertahap, atau KPR Bank (dibantu hingga akad)...',
        descLabel: 'Deskripsi Lengkap & Keunggulan Properti *',
        descPlaceholder: 'Jelaskan fasilitas cluster (one gate, security 24 jam), akses transportasi terdekat (stasiun/tol), spesifikasi pondasi/kusen, dan nilai investasi properti ini...'
      };
    case 'plant':
      return {
        type: 'plant',
        typeName: 'Tanaman',
        badgeName: 'Tanaman',
        icon: Sprout,
        color: 'var(--primary)',
        gradientBg: 'radial-gradient(circle at top left, var(--primary-glow) 0%, transparent 70%)',
        modalTitle: (mode) => mode === 'create' ? 'Tambah Data Tanaman' : 'Edit Data Tanaman',
        modalSubtitle: 'Lengkapi nama botani, kebutuhan cahaya, penyiraman, dan media tanam.',
        nameLabel: 'Nama Tanaman *',
        namePlaceholder: 'Contoh: Monstera Deliciosa King / Bonsai Kimeng / Bibit Mangga Kiojay...',
        categoryLabel: 'Kategori / Golongan Tanaman *',
        defaultCategory: 'Tanaman Hias Daun',
        categoryOptions: ['Tanaman Hias Daun', 'Tanaman Bunga & Anggrek', 'Bibit Buah & Pohon', 'Kaktus & Sukulen', 'Bonsai & Tanaman Seni', 'Tanaman Herbal & Rempah', 'Aquascape & Tanaman Air', 'Lainnya'],
        priceLabel: 'Harga Satuan (IDR) *',
        pricePlaceholder: 'Contoh: 125.000',
        photoLabel: 'Foto Tanaman & Kondisi Segar (1-10 Foto) *',
        photoHelper: 'Unggah hingga 10 foto asli tanaman tampak tajuk, daun, akar/batang, dan pot.',
        videoLabel: 'Video Tanaman / Review Kondisi (Opsional)',
        videoPlaceholder: 'Tempel tautan video YouTube, Shorts, TikTok, atau Instagram Reels...',
        deliveryLabel: 'Pengiriman & Ketentuan Packing Tanaman',
        deliveryOptions: [
          'Kirim Bersama Pot & Media Tanam',
          'Kirim Bare Root (Kurangi Media Tanam agar Hemat Ongkir)',
          'Khusus Kurir Instan / Sameday (Siap Pajang)',
          'Bisa Kirim se-Indonesia (Packing Paralon / Kardus Tebal)'
        ],
        deliveryTermsLabel: 'Pengiriman & Ketentuan Packing Tanaman',
        deliveryTermsPlaceholder: 'Contoh: Dikirim dengan pot dan media tanam terbungkus plastik rapat / pipa paralon kuat. Pengiriman se-Indonesia aman dengan kurir reguler atau kilat...',
        warrantyLabel: 'Kebijakan Garansi Segar Sampai Tujuan',
        warrantyPlaceholder: 'Contoh: Garansi tanaman hidup & segar sampai tujuan maksimal 3 hari ekspedisi. Penggantian bibit baru jika rusak parah/mati saat unboxing...',
        descLabel: 'Deskripsi Lengkap Tanaman *',
        descPlaceholder: 'Jelaskan karakteristik tanaman, tips penempatan, rekomendasi pupuk, dan panduan perawatan bagi pemula...',
        minOrderLabel: 'Minimal Beli (Pot/Bibit) *',
        minOrderPlaceholder: '1',
        maxOrderLabel: 'Maksimal Beli per Kiriman (Opsional)',
        maxOrderPlaceholder: 'Kosongkan jika tanpa batas'
      };
    default:
      return {
        type: 'physical',
        typeName: 'Barang Fisik',
        badgeName: 'Barang Fisik',
        icon: Package,
        color: '#2563eb',
        gradientBg: 'radial-gradient(circle at top left, rgba(37, 99, 235, 0.15) 0%, transparent 70%)',
        modalTitle: (mode) => mode === 'create' ? 'Tambah Barang Fisik' : 'Edit Barang Fisik',
        modalSubtitle: 'Lengkapi spesifikasi barang fisik, merek, varian, dan opsi pengiriman.',
        nameLabel: 'Nama Barang *',
        namePlaceholder: 'Contoh: Kaos Oversize Cotton Combed 24s / Keyboard Mechanical...',
        categoryLabel: 'Kategori / Jenis Barang *',
        defaultCategory: 'Pakaian & Fashion',
        categoryOptions: ['Pakaian & Fashion', 'Aksesoris & Gadget', 'Elektronik & Komputer', 'Perlengkapan Rumah', 'Kerajinan & Kriya', 'Koleksi & Hobi', 'Lainnya'],
        priceLabel: 'Harga Satuan (IDR) *',
        pricePlaceholder: 'Contoh: 150.000',
        photoLabel: 'Foto Barang (1-10 Foto) *',
        photoHelper: 'Unggah 1 hingga 10 foto barang fisik beresolusi jelas.',
        videoLabel: 'Video Review / Unboxing (Opsional)',
        videoPlaceholder: 'Tempel tautan video YouTube, Shorts, TikTok, atau Instagram Reels...',
        deliveryLabel: 'Pengiriman & Ketentuan Packing (Ekspedisi / Kurir)',
        deliveryOptions: ['Bisa Kirim se-Indonesia', 'Khusus Pulau Jawa / Satu Wilayah', 'Ambil Sendiri di Toko (No Shipping)', 'Kurir Instan / Sameday Only'],
        deliveryTermsLabel: 'Pengiriman & Ketentuan Packing (Ekspedisi / Kurir)',
        deliveryTermsPlaceholder: 'Contoh: Bisa kirim ke seluruh Indonesia via JNE / J&T / SiCepat atau Kurir Instan (Jabodetabek). Packing aman bubble wrap tebal + kardus gratis...',
        warrantyLabel: 'Kebijakan Garansi / Retur Barang',
        warrantyPlaceholder: 'Contoh: Garansi tukar baru 7 hari jika barang cacat produksi dengan melampirkan video unboxing...',
        descLabel: 'Deskripsi Lengkap Barang *',
        descPlaceholder: 'Jelaskan detail spesifikasi bahan/material, dimensi ukuran, kelengkapan isi kemasan, dan fitur unggulan barang ini...',
        minOrderLabel: 'Minimal Beli (Pcs) *',
        minOrderPlaceholder: '1',
        maxOrderLabel: 'Maksimal Beli per Transaksi (Opsional)',
        maxOrderPlaceholder: 'Kosongkan jika tanpa batas'
      };
  }
}

export const formatRupiahInput = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '';
  const num = typeof val === 'number' ? val : parseInt(val.toString().replace(/\D/g, ''), 10);
  if (isNaN(num)) return '';
  return num.toLocaleString('id-ID');
};

export const parseRupiahInput = (val: string): number => {
  const clean = val.replace(/\D/g, '');
  return clean ? parseInt(clean, 10) : 0;
};

export interface WAContactItem {
  id: string;
  label: string;
  number: string;
  is_default?: boolean;
  use_for_storefront?: boolean;
}

export function parseWAContacts(raw: string | null | undefined): WAContactItem[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .map((item: any, idx: number) => ({
            id: String(item.id || `wa_${idx + 1}`),
            label: item.label || item.name || (idx === 0 ? 'WhatsApp Utama' : `WhatsApp CS ${idx + 1}`),
            number: String(item?.number ?? item?.phone ?? item?.whatsapp ?? '').trim(),
            is_default: Boolean(item.is_default ?? (idx === 0)),
            use_for_storefront: Boolean(item.use_for_storefront ?? (idx === 0))
          }))
          .filter(item => item.number !== '');
      }
    } catch {}
  }

  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
    return parts.map((num, idx) => ({
      id: `wa_${idx + 1}`,
      label: idx === 0 ? 'WhatsApp Utama' : `WhatsApp CS ${idx + 1}`,
      number: num,
      is_default: idx === 0,
      use_for_storefront: idx === 0
    }));
  }

  return [
    {
      id: 'wa_1',
      label: 'WhatsApp Utama',
      number: trimmed,
      is_default: true,
      use_for_storefront: true
    }
  ];
}

export function formatPhoneNumber(num: string | null | undefined): string {
  if (!num) return '-';
  const clean = num.replace(/\D/g, '');
  if (clean.startsWith('62')) {
    return '+62 ' + clean.slice(2).replace(/(\d{3,4})(\d{4})(\d{0,4})/, '$1-$2-$3').replace(/-$/, '');
  }
  if (clean.startsWith('08')) {
    return '08' + clean.slice(2).replace(/(\d{2})(\d{4})(\d{0,4})/, '$1-$2-$3').replace(/-$/, '');
  }
  return num;
}

