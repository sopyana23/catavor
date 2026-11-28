export interface CatalogReportReason {
  id: string;
  title: string;
  desc: string;
}

export type ReportingSectorKey =
  | 'store'
  | 'service'
  | 'food'
  | 'digital'
  | 'property'
  | 'fauna'
  | 'plant'
  | 'physical';

export interface ReportingSectorMeta {
  key: ReportingSectorKey;
  label: string;
  color: string;
}

export function getCatalogReportReasons(
  targetType: 'store' | 'item',
  item?: any,
): CatalogReportReason[] {
  if (targetType === 'store') {
    return [
      {
        id: 'illegal_commodities',
        title: 'Konten, Komoditas, atau Layanan Terlarang Hukum',
        desc: 'Menawarkan barang/jasa terlarang undang-undang, zat berbahaya, satwa dilindungi, atau konten ilegal',
      },
      {
        id: 'copyright_brand',
        title: 'Pelanggaran Hak Cipta, Merek Dagang & Lisensi',
        desc: 'Menggunakan nama brand, logo, foto portofolio, karya digital, atau identitas pihak lain tanpa izin sah',
      },
      {
        id: 'fraud_scam',
        title: 'Indikasi Penipuan Transaksi, Usaha Fiktif, atau Scam',
        desc: 'Profil usaha fiktif, pesanan tidak diproses pasca pembayaran, kontak palsu, atau penipuan uang muka',
      },
      {
        id: 'misleading_profile',
        title: 'Profil Bisnis, Lokasi, atau Legalitas Menyesatkan',
        desc: 'Alamat operasional palsu, izin usaha/sertifikasi bodong, atau klaim garansi yang manipulatif',
      },
      {
        id: 'community_violation',
        title: 'Pelanggaran Ketentuan Komunitas & Etika Berbisnis',
        desc: 'Perilaku kasar, diskriminasi, spamming, atau pelanggaran tata tertib platform lainnya',
      },
    ];
  }

  const pType = String(
    item?.product_type || item?.type || item?.attributes?.product_type || 'physical',
  )
    .trim()
    .toLowerCase();

  if (pType === 'digital') {
    return [
      {
        id: 'pirated_license',
        title: 'Lisensi Bajakan / Akun Curian / Pelanggaran Hak Cipta',
        desc: 'Penjualan lisensi tidak sah, akun crack/curian, atau pembajakan software/karya digital',
      },
      {
        id: 'malware_virus',
        title: 'Mengandung Malware, Virus, atau Skrip Berbahaya',
        desc: 'File unduhan memuat virus, ransomware, trojan, atau script berbahaya bagi sistem/perangkat',
      },
      {
        id: 'broken_link',
        title: 'Tautan Unduhan Rusak / File Rusak (Corrupted)',
        desc: 'Link download mati, file corrupt tidak bisa dibuka, atau file tidak pernah dikirimkan',
      },
      {
        id: 'misleading_features',
        title: 'Fitur atau Format File Tidak Sesuai Deskripsi',
        desc: 'Format file, resolusi, kompatibilitas, atau kelengkapan fitur digital fiktif dan menipu',
      },
      {
        id: 'phishing_scam',
        title: 'Indikasi Phishing / Akses Akun Pribadi Ilegal',
        desc: 'Meminta kredensial akun pribadi pengguna atau metode pengiriman file mencurigakan',
      },
      {
        id: 'other',
        title: 'Pelanggaran Lainnya pada Produk Digital',
        desc: 'Pelanggaran ketentuan produk digital lainnya yang tidak tercantum di atas',
      },
    ];
  }

  if (pType === 'service') {
    return [
      {
        id: 'fraud_service',
        title: 'Layanan Fiktif / Tidak Dikerjakan Pasca Pembayaran',
        desc: 'Penyedia jasa tidak mengerjakan order, kabur setelah menerima pembayaran (ghosting), atau order fiktif',
      },
      {
        id: 'unlicensed_practice',
        title: 'Praktik Tanpa Izin Resmi / Keahlian Palsu',
        desc: 'Layanan mewajibkan sertifikasi/izin profesional resmi namun tidak memiliki legalitas valid',
      },
      {
        id: 'misleading_scope',
        title: 'Lingkup Kerja Menyesatkan / Tarif Jebakan',
        desc: 'Janji lingkup pekerjaan tidak sesuai realita atau ada biaya tambahan tersembunyi di luar kesepakatan',
      },
      {
        id: 'safety_violation',
        title: 'Pelanggaran Standar Keselamatan & Etika Profesi',
        desc: 'Pengerjaan membahayakan keselamatan klien/properti, perlakuan tidak etis, atau malpraktik teknis',
      },
      {
        id: 'breach_warranty',
        title: 'Ingkar Garansi / Menolak Revisi Sesuai Perjanjian',
        desc: 'Mengabaikan komitmen purnajual, revisi kerja yang dijanjikan, atau menolak pertanggungjawaban garansi',
      },
      {
        id: 'other',
        title: 'Pelanggaran Lainnya pada Layanan Jasa',
        desc: 'Pelanggaran ketentuan layanan jasa lainnya yang tidak tercantum di atas',
      },
    ];
  }

  if (pType === 'food') {
    return [
      {
        id: 'expired_spoiled',
        title: 'Makanan Basi, Kadaluwarsa, atau Tidak Layak Konsumsi',
        desc: 'Makanan sudah melewati masa kedaluwarsa, basi, berjamur, atau membusuk saat disajikan/diterima',
      },
      {
        id: 'hygiene_hazard',
        title: 'Masalah Kebersihan Ekstrem / Kontaminasi Benda Asing',
        desc: 'Ditemukan benda asing berbahaya, pengolahan kotor, atau fasilitas dapur tidak higienis',
      },
      {
        id: 'hidden_ingredients',
        title: 'Bahan Berbahaya / Keterangan Alergen & Non-Halal Ditutupi',
        desc: 'Mengandung zat berbahaya dilarang, atau menyembunyikan status non-halal/alergen kritis',
      },
      {
        id: 'misleading_portion',
        title: 'Porsi Sangat Memanipulasi / Kemasan Rusak Parah',
        desc: 'Porsi dan komposisi makanan jauh berbeda dari iklan, atau kemasan bocor/hancur membahayakan',
      },
      {
        id: 'unregistered_food',
        title: 'Tanpa Izin Edar P-IRT / BPOM pada Produk Tertentu',
        desc: 'Produk olahan kemasan/pabrikan yang diedarkan tanpa sertifikasi izin kesehatan wajib',
      },
      {
        id: 'other',
        title: 'Pelanggaran Lainnya pada Menu Kuliner',
        desc: 'Pelanggaran ketentuan kuliner lainnya yang tidak tercantum di atas',
      },
    ];
  }

  if (pType === 'property') {
    return [
      {
        id: 'disputed_ownership',
        title: 'Sengketa Kepemilikan / Sertifikat Bodong',
        desc: 'Properti dalam sengketa hukum, sertifikat ganda, atau status kepemilikan tanah tidak sah',
      },
      {
        id: 'fictitious_listing',
        title: 'Listing Fiktif / Menggunakan Foto Milik Pihak Lain',
        desc: 'Properti tidak ada di lokasi tertera, mencuri foto milik pihak lain, atau klaim agen palsu',
      },
      {
        id: 'spec_mismatch',
        title: 'Lokasi, Luas Tanah, atau Kondisi Bangunan Palsu',
        desc: 'Alamat/pin lokasi palsu, luas tanah/bangunan manipulasi, atau kondisi rusak fatal disembunyikan',
      },
      {
        id: 'hidden_hazard',
        title: 'Cacat Lingkungan Ekstrem / Tanpa Legalitas Izin (PBG/IMB)',
        desc: 'Daerah rawan bencana fatal ditutupi, atau bangunan dibangun tanpa izin konstruksi resmi',
      },
      {
        id: 'deposit_scam',
        title: 'Indikasi Penipuan Uang Muka (DP) / Booking Fee',
        desc: 'Memaksa transfer DP sebelum survey lokasi fisik atau skema pembayaran mencurigakan',
      },
      {
        id: 'other',
        title: 'Pelanggaran Lainnya pada Listing Properti',
        desc: 'Pelanggaran ketentuan listing properti lainnya yang tidak tercantum di atas',
      },
    ];
  }

  if (pType === 'fauna') {
    return [
      {
        id: 'protected_species',
        title: 'Satwa / Hewan Langka Dilindungi Undang-Undang',
        desc: 'Menawarkan hewan yang masuk daftar dilindungi (Apendiks CITES / regulasi KSDAE)',
      },
      {
        id: 'animal_cruelty',
        title: 'Indikasi Kekejaman / Kondisi Hewan Sakit atau Terlantar',
        desc: 'Hewan dipelihara dalam kondisi mengenaskan, sakit parah, stres berat, atau dieksploitasi',
      },
      {
        id: 'illegal_wildlife',
        title: 'Hasil Tangkapan Liar Ilegal / Tanpa Izin Tangkar (BKSDA)',
        desc: 'Hasil perburuan liar ilegal tanpa legalitas izin penangkaran atau dokumen resmi asal-usul',
      },
      {
        id: 'false_pedigree',
        title: 'Manipulasi Trah/Ras, Silsilah Bodong, atau Riwayat Palsu',
        desc: 'Pemalsuan silsilah (pedigree/stambum), buku vaksin palsu, atau foto indukan manipulatif',
      },
      {
        id: 'transit_cruelty',
        title: 'Metode Pengiriman Membahayakan Keselamatan Hidup',
        desc: 'Pengiriman lewat kurir non-khusus tanpa standar keselamatan hewan hidup',
      },
      {
        id: 'other',
        title: 'Pelanggaran Lainnya pada Hewan Peliharaan',
        desc: 'Pelanggaran ketentuan hewan lainnya yang tidak tercantum di atas',
      },
    ];
  }

  if (pType === 'plant') {
    return [
      {
        id: 'protected_flora',
        title: 'Tanaman Langka / Dilindungi Tanpa Izin Legal',
        desc: 'Menawarkan tanaman yang dilindungi undang-undang / Apendiks CITES tanpa sertifikat legalitas karantina sah',
      },
      {
        id: 'dead_withered',
        title: 'Tanaman Mati, Layu Parah, atau Rusak Saat Tiba',
        desc: 'Tanaman tiba dalam kondisi busuk akar parah, kering mati total, atau tidak ada penanganan garansi',
      },
      {
        id: 'pest_disease',
        title: 'Terinfeksi Hama / Penyakit Tanaman Menular Berbahaya',
        desc: 'Tanaman terbukti membawa kutu, jamur parasit, atau penyakit tumbuhan yang dapat menular luas',
      },
      {
        id: 'false_species',
        title: 'Spesies / Varietas Palsu (ID Tanaman Manipulatif)',
        desc: 'ID jenis bibit/varietas tidak sesuai, manipulasi varigata buatan, atau foto tanaman palsu',
      },
      {
        id: 'unsafe_packaging',
        title: 'Metode Packing Sembarangan / Tanpa Pelindung',
        desc: 'Pengiriman bibit hidup tanpa pengaman batang/akar memadai sehingga tanaman hancur',
      },
      {
        id: 'other',
        title: 'Pelanggaran Lainnya pada Tanaman',
        desc: 'Pelanggaran ketentuan tanaman lainnya yang tidak tercantum di atas',
      },
    ];
  }

  return [
    {
      id: 'counterfeit',
      title: 'Barang Tiruan / Tiruan Merek Resmi (KW)',
      desc: 'Produk tiruan, pemalsuan merek dagang resmi, atau pelanggaran hak cipta desain fisik',
    },
    {
      id: 'illegal_item',
      title: 'Komoditas Terlarang atau Ilegal Hukum',
      desc: 'Barang terlarang undang-undang, obat tanpa izin edar, atau barang sitaan/pasar gelap',
    },
    {
      id: 'misleading_info',
      title: 'Spesifikasi atau Kondisi Barang Tidak Sesuai',
      desc: 'Foto, merk, kondisi fisik (baru/bekas), atau kelengkapan barang manipulatif dan tidak akurat',
    },
    {
      id: 'price_manipulation',
      title: 'Manipulasi Harga atau Biaya Tersembunyi',
      desc: 'Harga jebakan tidak wajar, biaya fiktif yang memaksa, atau mark-up di luar kesepakatan',
    },
    {
      id: 'defective_hazard',
      title: 'Barang Cacat Fatal, Rekondisi Diam-diam, atau Berbahaya',
      desc: 'Produk rusak parah, barang rekondisi dijual sebagai baru, atau membahayakan keselamatan',
    },
    {
      id: 'other',
      title: 'Pelanggaran Lainnya pada Item Fisik',
      desc: 'Pelanggaran pada item produk fisik lainnya yang tidak tercantum di atas',
    },
  ];
}

export function getReportingSectorMeta(
  targetType: 'store' | 'item',
  item?: any,
): ReportingSectorMeta {
  if (targetType === 'store') {
    return { key: 'store', label: 'Profil & Identitas Katalog', color: '#6366f1' };
  }
  const pType = String(
    item?.product_type || item?.type || item?.attributes?.product_type || 'physical',
  )
    .trim()
    .toLowerCase();
  switch (pType) {
    case 'service':
      return { key: 'service', label: 'Layanan Jasa', color: '#0284c7' };
    case 'food':
      return { key: 'food', label: 'Kuliner & F&B', color: '#ea580c' };
    case 'digital':
      return { key: 'digital', label: 'Produk Digital', color: '#8b5cf6' };
    case 'property':
      return { key: 'property', label: 'Properti & Real Estate', color: '#0d9488' };
    case 'fauna':
      return { key: 'fauna', label: 'Hewan', color: 'var(--primary)' };
    case 'plant':
      return { key: 'plant', label: 'Tanaman', color: 'var(--primary)' };
    default:
      return { key: 'physical', label: 'Produk Fisik', color: '#e11d48' };
  }
}
