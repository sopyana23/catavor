import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  ShieldAlert,
  Lock,
  Scale,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  ExternalLink,
  Info,
  Building2,
  CreditCard,
  ArrowLeft,
  Search,
  Calendar,
  Sparkles
} from 'lucide-react';

export type PolicyKey = 'terms' | 'prohibited' | 'privacy' | 'moderation' | 'transactions' | 'subscription';

export interface PlatformPoliciesViewProps {
  onOpenHelpdesk?: () => void;
  initialKey?: PolicyKey;
  onBack?: () => void;
}

export interface PolicyArticle {
  number: string;
  heading: string;
  content: string;
  highlights?: string[];
}

export interface PolicyDoc {
  key: PolicyKey;
  navLabel: string;
  title: string;
  category: string;
  badge: string;
  version?: string;
  effectiveDate?: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
  summary: string;
  articles: PolicyArticle[];
}

const FALLBACK_POLICY_SECTIONS: PolicyDoc[] = [
  {
    key: 'terms',
    navLabel: 'Syarat & Ketentuan',
    title: 'Syarat & Ketentuan Layanan Platform Catavor',
    category: 'Ketentuan Umum & Kedudukan Hukum',
    badge: 'Dokumen Perjanjian Pengelola',
    version: 'v2.0',
    icon: Scale,
    summary: 'Dokumen hukum resmi dari PT Catavor Media Digital yang mengatur kedudukan hukum platform sebagai Penyelenggara Sistem Elektronik (PSE), hak, batasan, serta kewajiban seluruh pengelola profil katalog merchant dan pengguna platform.',
    articles: [
      {
        number: 'Pasal 1',
        heading: 'Kedudukan Hukum Platform & Ekosistem 7 Tipe Katalog',
        content: 'Platform Catavor bertindak semata-mata sebagai penyedia infrastruktur teknologi etalase katalog digital multi-tenant, manajemen inventaris, dan sarana komunikasi pemesanan mandiri. Catavor bukan merupakan penjual langsung, produsen, penyedia jasa, maupun perantara kepemilikan atas item yang dipublikasikan oleh masing-masing pengelola profil katalog.',
        highlights: [
          'Catavor menyediakan infrastruktur profil katalog dan biolink resmi bisnis mandiri tanpa campur tangan kepemilikan barang.',
          'Platform mendukung 7 karakteristik katalog unik: Produk Fisik (physical), Kuliner (food), Produk Digital (digital), Jasa (service), Tanaman Hias (plant), Satwa & Peliharaan (fauna), dan Properti (property).',
          'Hubungan jual-beli, akad jasa, serta perikatan perdata terjalin langsung antara pengelola profil katalog dengan pembeli/konsumen akhir.',
          'Catavor tidak bertanggung jawab atas sengketa perdata yang timbul akibat wanprestasi atau ingkar janji antar-pihak di luar sistem Rekber resmi mitra platform.'
        ]
      },
      {
        number: 'Pasal 2',
        heading: 'Registrasi Akun, Kredensial, RBAC, & Tanggung Jawab Keamanan',
        content: 'Setiap pengelola profil katalog wajib mendaftarkan akun menggunakan data identitas yang valid dan nomor WhatsApp aktif. Pengelola bertanggung jawab penuh atas kerahasiaan kata sandi, token autentikasi, serta hak akses staf (Role-Based Access Control) yang diberikan kepada tim internalnya.',
        highlights: [
          'Pengelola dilarang membagikan kredensial login utama kepada pihak luar tanpa otorisasi tertulis.',
          'Setiap tindakan yang dilakukan melalui akun terdaftar dianggap sah sebagai tindakan yang mewakili pemilik profil katalog.',
          'Pengelola wajib segera memberitahukan tim kepatuhan platform apabila mencurigai adanya peretasan atau akses tanpa hak atas akunnya.'
        ]
      },
      {
        number: 'Pasal 3',
        heading: 'Kewajiban Integritas Data & Aturan Khusus 7 Tipe Katalog',
        content: 'Pengelola profil katalog wajib menjamin bahwa seluruh data item—termasuk nama, spesifikasi, harga satuan Rupiah, status stok, foto dokumentasi, dan ketentuan garansi—adalah akurat, sah, dan tidak menyesatkan (anti-misleading). Pengelola wajib mematuhi ketentuan spesifik pada masing-masing domain katalog.',
        highlights: [
          'Kuliner (food): Wajib menjamin higienitas pangan, mencantumkan bahan pemicu alergi (allergen disclosure), masa kadaluwarsa, dan status kehalalan.',
          'Produk Digital (digital) & Jasa (service): Wajib menjamin keaslian lisensi perangkat lunak, hak kekayaan intelektual (HAKI), serta kejelasan ruang lingkup pengerjaan (Scope of Work).',
          'Tanaman (plant) & Fauna (fauna): Wajib memastikan komoditas non-dilindungi, kepemilikan dokumen karantina/BKSDA resmi, serta standar garansi hidup saat tiba (Live Arrival Guarantee / DOA).',
          'Properti (property): Wajib memastikan keabsahan sertifikat kepemilikan (SHM/SHGB/AJB) dan transparansi informasi perizinan mendirikan bangunan.'
        ]
      },
      {
        number: 'Pasal 4',
        heading: 'Hak Kekayaan Intelektual (HAKI) Konten Katalog & Lisensi Publikasi',
        content: 'Hak cipta atas seluruh materi visual, logo, foto dokumentasi, dan deskripsi produk yang diunggah tetap menjadi milik sah pengelola profil katalog atau pemilik lisensi aslinya. Dengan mengunggah konten ke Catavor, pengelola memberikan lisensi non-eksklusif dan bebas royalti kepada Catavor untuk menampilkan, mendistribusikan, dan mengoptimasi konten tersebut demi kelancaran operasional platform.',
        highlights: [
          'Dilarang mengunggah materi visual atau merek dagang terdaftar milik pihak ketiga tanpa izin resmi atau hak keagenan yang sah.',
          'Catavor berhak menghapus atau menyembunyikan konten yang dilaporkan melanggar HAKI berdasarkan aduan yang disertai bukti kepemilikan sah.'
        ]
      },
      {
        number: 'Pasal 5',
        heading: 'Batasan Tanggung Jawab Platform & Force Majeure',
        content: 'Platform Catavor disediakan dengan prinsip "sebagaimana adanya" (as-is). Dalam batas maksimum yang diizinkan oleh hukum Republik Indonesia, Catavor tidak bertanggung jawab atas kerugian tidak langsung, kehilangan keuntungan bisnis, maupun gangguan layanan yang disebabkan oleh keadaan kahar (force majeure) seperti bencana alam, gangguan infrastruktur telekomunikasi nasional, atau kebijakan pemblokiran pihak berwenang.',
        highlights: [
          'Catavor senantiasa mengupayakan ketersediaan infrastruktur layanan dengan target uptime 99.5% di luar pemeliharaan berkala terjadwal.',
          'Ganti rugi maksimal yang dapat dituntut oleh pengelola dibatasi sebesar biaya langganan paket aktif yang telah dibayarkan untuk bulan berjalan.'
        ]
      }
    ]
  },
  {
    key: 'prohibited',
    navLabel: 'Pedoman Konten & Barang Terlarang',
    title: 'Kebijakan Penggunaan & Standar Komoditas Terlarang',
    category: 'Kepatuhan Mutlak (Zero Tolerance)',
    badge: 'Wajib Dipatuhi Pengelola',
    version: 'v2.0',
    icon: ShieldAlert,
    summary: 'Daftar komoditas terlarang, ketentuan konservasi flora/fauna, materi visual ilegal, serta larangan manipulasi teknis yang dilarang keras di seluruh ekosistem Catavor demi kepatuhan hukum dan keselamatan publik.',
    articles: [
      {
        number: 'Pasal 1',
        heading: 'Komoditas Ilegal Mutlak & Zat Terlarang',
        content: 'Dilarang keras mempublikasikan, menawarkan, mengiklankan, atau memperdagangkan segala jenis barang atau zat yang dilarang oleh hukum pidana dan perundang-undangan khusus di Republik Indonesia.',
        highlights: [
          'Narkotika, psikotropika, prekursor, zat adiktif, serta obat-obatan keras golongan G tanpa izin apotek atau resep dokter berwenang.',
          'Senjata api, replika airsoft gun tanpa izin klub resmi, bahan peledak, amunisi, senjata tajam penyerang, dan racun berbahaya.',
          'Dokumen resmi negara palsu (KTP, ijazah, sertifikat, paspor) atau layanan jasa pembuatan dokumen ilegal.',
          'Konten pornografi, eksploitasi seksual di bawah umur, perjudian online, taruhan, dan skema piramida/Ponzi yang merugikan masyarakat.'
        ]
      },
      {
        number: 'Pasal 2',
        heading: 'Perlindungan Konservasi Satwa (Fauna) & Tanaman (Plant)',
        content: 'Catavor menjunjung tinggi etika konservasi lingkungan hidup dan keanekaragaman hayati nusantara. Dilarang keras mempublikasikan, menjual, atau memfasilitasi transaksi atas satwa liar dan tumbuhan yang dilindungi oleh undang-undang nasional maupun konvensi internasional.',
        highlights: [
          'Dilarang memperdagangkan seluruh satwa dan tumbuhan yang masuk dalam daftar dilindungi UU No. 5 Tahun 1990 dan Peraturan Menteri LHK No. P.106/2018 beserta perubahannya.',
          'Dilarang memperdagangkan flora/fauna yang masuk dalam lampiran CITES Appendiks I & II tanpa izin penangkaran F2 resmi dan kuota BKSDA sah.',
          'Fauna peliharaan non-lindung wajib memiliki keterangan asal-usul legal dan memenuhi standar kesejahteraan hewan (animal welfare).'
        ]
      },
      {
        number: 'Pasal 3',
        heading: 'Standar Keamanan Pangan, Hak Cipta Perangkat Lunak, & Larangan Penipuan Properti',
        content: 'Setiap domain katalog memiliki batasan integritas yang wajib ditaati untuk mencegah bahaya keracunan pangan, pelanggaran lisensi perangkat lunak, maupun sengketa kepemilikan aset bernilai tinggi.',
        highlights: [
          'Kuliner: Dilarang menjual makanan kadaluwarsa, pangan basi, obat tradisional tanpa nomor izin edar BPOM, atau pangan beracun.',
          'Produk Digital: Dilarang menjual software bajakan (cracked/nulled), akun curian/phishing, database privat tanpa hak, atau file bervirus.',
          'Properti: Dilarang memasang listing properti fiktif, sengketa tanah waris tanpa persetujuan ahli waris, atau menipu batas tanah/sertifikat.'
        ]
      },
      {
        number: 'Pasal 4',
        heading: 'Larangan Manipulasi Sistem, Scraping, & Penipuan Harga',
        content: 'Pengguna dilarang melakukan tindakan teknis maupun operasional yang merusak performa server, mengelabui algoritma katalog, atau memanipulasi interaksi pengguna lain.',
        highlights: [
          'Dilarang melakukan scraping data otomatis, Denial of Service (DoS/DDoS), atau reverse engineering atas infrastruktur Catavor.',
          'Dilarang melakukan mark-up harga fiktif, pesanan palsu (fake order), ulasan palsu, atau spamming keyword pada judul produk.',
          'Dilarang mengeksploitasi celah keamanan (bug/exploit); penemuan celah wajib dilaporkan langsung melalui kanal Responsible Disclosure platform.'
        ]
      },
      {
        number: 'Pasal 5',
        heading: 'Kebijakan Tautan Eksternal & Master Safe Domains Whitelist',
        content: 'Pengelola hanya diizinkan menyematkan tautan keluar (eksternal link) menuju marketplace, media sosial, atau penyedia video terpercaya yang telah terdaftar dalam Master Safe Domains Whitelist resmi Catavor.',
        highlights: [
          'Tautan menuju domain di luar whitelist akan memunculkan dialog konfirmasi perlindungan anti-phishing sebelum dibuka oleh pengguna.',
          'Dilarang keras menyematkan tautan penyingkat URL (URL shortener) yang menyembunyikan alamat tujuan asli (misal: bit.ly misterius).',
          'Penyematan link phishing, malware, atau situs penipuan akan berakibat pada pemblokiran permanen seketika (Tingkat 4 Blacklist).'
        ]
      }
    ]
  },
  {
    key: 'privacy',
    navLabel: 'Kebijakan Privasi & Data (UU PDP)',
    title: 'Kebijakan Privasi, Pelindungan Data (UU PDP) & Telemetri B2B',
    category: 'Kepatuhan UU No. 27 Tahun 2022 (PDP)',
    badge: 'Standar Perlindungan Privasi',
    version: 'v2.0',
    icon: Lock,
    summary: 'Pernyataan transparansi resmi mengenai klasifikasi data yang dikumpulkan, mekanisme enkripsi, batas pemrosesan data agregat pasar Zero-PII, hak subjek data, serta jaminan kerahasiaan data pengguna.',
    articles: [
      {
        number: 'Pasal 1',
        heading: 'Kepatuhan UU No. 27 Tahun 2022 & Klasifikasi Data yang Diproses',
        content: 'Catavor berkomitmen penuh melindungi hak privasi subjek data sesuai Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP). Platform mengumpulkan data yang diperlukan semata-mata untuk operasional akun dan penyajian katalog.',
        highlights: [
          'Data Akun: Nama lengkap/nama bisnis, alamat email aktif, nomor WhatsApp bisnis, dan preferensi tampilan toko.',
          'Data Katalog: Nama item, deskripsi, harga resmi Rupiah, atribut spesifikasi, foto produk, serta tautan video resmi.',
          'Data Transaksi & Pesanan: Rekam jejak checkout mandiri yang diteruskan ke WhatsApp merchant atau mitra Rekber Syariah.',
          'Data Teknis & Keamanan: Alamat IP, user-agent browser, dan stempel waktu sesi untuk audit keamanan dan pencegahan fraud.'
        ]
      },
      {
        number: 'Pasal 2',
        heading: 'Isolasi Multi-Tenant, Enkripsi Kriptografis, & Cookie Sesi',
        content: 'Setiap data merchant disimpan secara terisolasi (Tenant Isolation) guna mencegah kebocoran data antar-toko. Catavor menerapkan standar enkripsi industri terkini untuk melindungi data sensitif pengguna.',
        highlights: [
          'Kata sandi akun dienkripsi menggunakan algoritma hashing satu arah Argon2id / Bcrypt Cost 12 yang tahan serangan brute-force.',
          'Sesi login diamankan menggunakan JSON Web Token (JWT) dengan penandatanganan kriptografis aman dan atribut cookie HttpOnly/SameSite.',
          'Seluruh berkas media gambar yang diunggah diproses melalui kompresi cerdas dan dibersihkan dari metadata EXIF (termasuk koordinat GPS).'
        ]
      },
      {
        number: 'Pasal 3',
        heading: 'Transparansi Telemetri Agregat, Zero-PII, K-Anonymity, & Riset Pasar B2B',
        content: 'Platform Catavor berhak mencatat, mengolah, dan menyajikan data statistik dan tren pasar agregat tanpa identitas pribadi (Zero-PII Anonymized Aggregate Data) untuk keperluan riset industri, peningkatan fitur, optimasi ekosistem UMKM, serta kemitraan analitik pasar B2B.',
        highlights: [
          'Data yang diolah untuk riset pasar HANYA berupa tren agregat makro: kata kunci pencarian terpopuler, indeks kuartil harga (P25, P50, P75), demand gap, elastisitas harga, dan sebaran demografi perangkat/kota.',
          'Standar Zero-PII: Pemrosesan telemetri sama sekali TIDAK MEMUAT nama orang, nomor WhatsApp/telepon, alamat email, atau detail identitas privat konsumen.',
          'Penyamaran Sesi: Pelacakan klik/pencarian menggunakan HMAC-SHA256 dengan daily rotating salt acak sehingga riwayat penjelajahan tidak dapat dikaitkan dengan profil individu.',
          'Prinsip K-Anonymity: Laporan intelijen pasar B2B menerapkan ambang batas privasi (minimal 3 toko unik) sehingga data performa satu toko individual tidak pernah dapat diidentifikasi balik atau dijual secara mandiri.',
          'Jaminan Tegas: Data pribadi konsumen dan rahasia dagang internal toko TIDAK AKAN PERNAH DIJUAL kepada pihak ketiga mana pun.'
        ]
      },
      {
        number: 'Pasal 4',
        heading: 'Hak Subjek Data, Penghapusan Akun (Right to Erasure), & Retensi Bukti Hukum',
        content: 'Pengguna memiliki hak penuh atas data pribadinya, termasuk hak akses, koreksi data, serta permohonan penutupan akun dan penghapusan data (Right to Erasure) melalui menu Pengaturan Toko.',
        highlights: [
          'Penghapusan toko akan memicu penghapusan fisik berkas foto/media secara permanen dari penyimpanan server cloud.',
          'Pengecualian Retensi Hukum: Rekam jejak persetujuan kebijakan (User Policy Agreements) dan riwayat transaksi masa lalu tetap diretensi secara terisolasi sebagai alat bukti elektronik yang sah sesuai ketentuan UU ITE.',
          'Permintaan penarikan persetujuan atau konfirmasi data privasi dapat dilayangkan ke Petugas Kepatuhan Data melalui email resmi support@catavor.com.'
        ]
      }
    ]
  },
  {
    key: 'moderation',
    navLabel: 'Standar Moderasi & Sanksi Kepatuhan',
    title: 'Standar Penegakan Moderasi, Pembekuan Akun & Banding',
    category: 'Prosedur Disiplin Ekosistem',
    badge: 'Transparansi & Akuntabilitas',
    version: 'v2.0',
    icon: CheckCircle2,
    summary: 'Mekanisme pengawasan proaktif, investigasi laporan pelanggaran masyarakat, penerapan sanksi berjenjang 4 tingkat yang adil, serta prosedur banding kepatuhan resmi tanpa biaya.',
    articles: [
      {
        number: 'Pasal 1',
        heading: 'Sistem Pengawasan Berkelanjutan & Kanal Laporan Masyarakat',
        content: 'Tim Kepatuhan Platform Catavor melakukan pemantauan proaktif secara berkala serta memproses laporan aduan masyarakat atas konten yang melanggar hukum atau pedoman komunitas.',
        highlights: [
          'Pengawasan mencakup validitas harga, kesesuaian izin perdagangan satwa/tanaman, keaslian foto, dan nomor rekening penipuan.',
          'Masyarakat dapat melaporkan profil atau item mencurigakan melalui tombol Lapor Pelanggaran yang diverifikasi oleh tim kepatuhan.',
          'Laporan yang disertai bukti awal konkret (tangkapan layar, resi palsu, bukti transfer) diproses prioritas dalam kurun waktu 1x24 jam.'
        ]
      },
      {
        number: 'Pasal 2',
        heading: 'Matriks Sanksi 4 Tingkat Kepatuhan',
        content: 'Penindakan atas pelanggaran pedoman platform diterapkan secara proporsional dan transparan melalui matriks sanksi 4 tingkat:',
        highlights: [
          'Tingkat 1 - Peringatan Tertulis (Warning Notice): Diberikan kepada merchant untuk merevisi kesalahan administratif, foto tidak jelas, atau kekeliruan kategori dalam batas waktu 2x24 jam.',
          'Tingkat 2 - Penguncian/Penonaktifan Item (Item Hidden/Locked): Item yang melanggar pedoman ditarik dari etalase publik dan statusnya diubah menjadi read-only demi mencegah transaksi berbahaya.',
          'Tingkat 3 - Pembekuan Sementara Katalog (Store Suspension): Seluruh etalase publik dinonaktifkan sementara apabila pengelola mengabaikan peringatan berulang atau terindikasi sengketa serius.',
          'Tingkat 4 - Pemutusan Akun Permanen (Permanent Blacklist): Diterapkan pada pelanggaran fatal seperti penipuan terbukti, perdagangan satwa dilindungi, narkotika, atau kejahatan siber.'
        ]
      },
      {
        number: 'Pasal 3',
        heading: 'Status Penguncian Barang Bukti (Moderator Item Lock)',
        content: 'Untuk menjamin integritas penyelidikan hukum dan transparansi pembuktian, item katalog yang sedang berstatus Tingkat 2 (Item Locked) atau terlibat sengketa tidak dapat dihapus atau diubah oleh merchant.',
        highlights: [
          'Penguncian barang bukti mencegah pelaku pelanggaran menghilangkan jejak digital sebelum proses investigasi tuntas.',
          'Status penguncian hanya dapat dicabut oleh Petugas Kepatuhan Platform setelah permohonan banding diterima atau sanggahan terbukti sah.'
        ]
      },
      {
        number: 'Pasal 4',
        heading: 'Prosedur Pengajuan Banding Kepatuhan Resmi & SLA Peninjauan',
        content: 'Pengelola profil katalog berhak mengajukan permohonan peninjauan kembali (Banding Kepatuhan) atas sanksi Tingkat 2 atau Tingkat 3 tanpa dipungut biaya apa pun.',
        highlights: [
          'Permohonan banding diajukan resmi melalui menu Bantuan & Tiket (Helpdesk) dengan melampirkan bukti kepemilikan izin, sertifikat, atau klarifikasi kronologi.',
          'Tim Kepatuhan wajib memberikan tanggapan objektif dan keputusan tertulis dalam Service Level Agreement (SLA) maksimal 2x24 jam hari kerja.',
          'Keputusan atas banding tingkat kedua bersifat final dan mengikat secara administratif di lingkungan ekosistem Catavor.'
        ]
      }
    ]
  },
  {
    key: 'transactions',
    navLabel: 'Pedoman Transaksi & Rekber Syariah',
    title: 'Pedoman Transaksi Aman, Kejujuran & Rekber Syariah',
    category: 'Integritas Pembayaran & Sengketa',
    badge: 'Prosedur Keamanan Keuangan',
    version: 'v2.0',
    icon: CheckCircle2,
    summary: 'Tata kelola transaksi perniagaan mandiri, integrasi Rekber Syariah pihak ketiga, pengecualian transaksi properti, standar garansi pengiriman komoditas hidup, dan penanganan sengketa pembayaran.',
    articles: [
      {
        number: 'Pasal 1',
        heading: 'Prinsip Transaksi Komunikasi WhatsApp Langsung & Transparansi Rupiah',
        content: 'Platform Catavor memfasilitasi komunikasi pesanan langsung ke nomor WhatsApp resmi pengelola toko. Seluruh harga yang tertera wajib menggunakan mata uang Rupiah (IDR) secara transparan dan jujur.',
        highlights: [
          'Pengelola wajib menginformasikan rincian ongkos kirim, jasa ekspedisi terpercaya, serta estimasi waktu pengantaran barang secara transparan.',
          'Wajib memberikan nomor rekening bank resmi yang sesuai dengan identitas bisnis terdaftar guna mencegah penipuan transfer pihak ketiga.',
          'Wajib mengirimkan nomor resi pengiriman yang valid dan dapat dilacak kepada konsumen segera setelah paket diserahkan ke jasa kurir.'
        ]
      },
      {
        number: 'Pasal 2',
        heading: 'Integrasi Fasilitas Rekber Syariah Resmi Catavor',
        content: 'Untuk meningkatkan kepercayaan konsumen dan melindungi transaksi bernilai tinggi, Catavor mengintegrasikan layanan Rekening Bersama Syariah (rekbersyariah.com) sebagai mitra pihak ketiga resmi tepercaya.',
        highlights: [
          'Fasilitas Rekber Syariah berlaku untuk 6 tipe katalog transaksional: Produk Fisik (physical), Kuliner (food), Produk Digital (digital), Jasa (service), Tanaman Hias (plant), dan Fauna (fauna).',
          'Akad Muamalah: Dana pembeli ditampung secara aman pada rekening escrow resmi Rekber Syariah berdasarkan prinsip syariah yang adil (Wakalah bil Ujrah / Ju\'alah) dan baru dicairkan ke penjual setelah barang/layanan terkonfirmasi diterima dengan baik.',
          'Seluruh ketentuan biaya jasa rekber, pembuatan grup WhatsApp transaksi resmi, dan panduan validasi diatur oleh standar resmi mitra Rekber Syariah.'
        ]
      },
      {
        number: 'Pasal 3',
        heading: 'Pengecualian Khusus Katalog Properti dari Rekber Otomatis',
        content: 'Katalog Properti (property) berfungsi semata-mata sebagai media listing informasi, pemasaran etalase, dan sarana penjadwalan survei lokasi fisik secara langsung antara peminat dan pemilik properti/agen resmi.',
        highlights: [
          'Transaksi jual-beli, sewa-menyewa, atau peralihan hak atas tanah dan bangunan DIKECUALIKAN dari fasilitas Rekber Syariah otomatis.',
          'Segala bentuk perikatan pengalihan hak wajib dilakukan melalui prosedur hukum formal di hadapan Pejabat Pembuat Akta Tanah (PPAT) atau Notaris berwenang setelah melalui verifikasi fisik sertifikat asli (SHM/SHGB) dan lokasi objek.',
          'Dilarang keras mentransfer uang muka atau tanda jadi properti tanpa verifikasi fisik objek dan pemeriksaan legalitas kepemilikan yang sah.'
        ]
      },
      {
        number: 'Pasal 4',
        heading: 'Standar Pengiriman, Karantina Komoditas Hidup, & Klaim Dead on Arrival (DOA)',
        content: 'Khusus untuk transaksi Fauna (fauna) dan Tanaman (plant), pengelola profil katalog wajib menerapkan prosedur pengemasan khusus (packing berstandar keselamatan hidup) dan menyertakan dokumen karantina antar-pulau.',
        highlights: [
          'Garansi Hidup Saat Tiba (Live Arrival Guarantee / DOA): Penjual wajib memberikan jaminan penggantian komoditas atau pengembalian dana apabila pesanan tiba dalam keadaan mati atau rusak parah.',
          'Syarat Klaim Sah DOA: Pembeli wajib merekam video unboxing utuh tanpa jeda (no cut, no edit) yang memperlihatkan kondisi paket utuh hingga spesimen dikeluarkan dalam kurun waktu maksimal 2 jam sejak paket diterima menurut log kurir.',
          'Klaim tanpa bukti video unboxing utuh tidak dapat diproses dalam penyelesaian sengketa Rekber Syariah.'
        ]
      },
      {
        number: 'Pasal 5',
        heading: 'Mediasi Sengketa Transaksi & Prosedur Pencairan/Pengembalian Dana',
        content: 'Apabila terjadi perselisihan atas kondisi barang, keterlambatan pengiriman, atau ketidaksesuaian spesifikasi pada transaksi yang menggunakan Rekber Syariah, tim mediasi akan memproses penyelesaian secara adil dan objektif.',
        highlights: [
          'Dana escrow akan ditahan sementara sampai kedua belah pihak mencapai kesepakatan tertulis atau putusan mediasi ditetapkan.',
          'Jika terbukti penjual melakukan kelalaian atau pengiriman barang yang tidak sesuai, dana akan dikembalikan kepada pembeli (refund) sesuai prosedur escrow.'
        ]
      }
    ]
  },
  {
    key: 'subscription',
    navLabel: 'Ketentuan Langganan & Kuota Toko',
    title: 'Ketentuan Langganan Merchant, Kuota & Masa Aktif Toko',
    category: 'Model Layanan Bisnis & Kuota',
    badge: 'Ketentuan Komersial Merchant',
    version: 'v2.0',
    icon: CreditCard,
    summary: 'Ketentuan paket berlangganan merchant, batas kapasitas kuota produk dan media penyimpanan, mekanisme pembayaran resmi, kebijakan non-refundable, serta prosedur Store Dormancy bagi toko tidak aktif.',
    articles: [
      {
        number: 'Pasal 1',
        heading: 'Tingkatan Paket Langganan, Batas Produk, & Kuota Penyimpanan Media',
        content: 'Catavor menyediakan pilihan tingkatan paket langganan bagi pengelola profil katalog merchant guna mengakomodasi skala bisnis yang beragam.',
        highlights: [
          'Paket Free (Starter): Ditujukan untuk bisnis perintis dengan batas hingga 10 produk aktif dan kuota penyimpanan media 50 MB.',
          'Paket Pro (Bisnis Berkembang): Menyediakan kapasitas hingga 100 produk aktif, kuota penyimpanan 500 MB, fitur lencana Pro terverifikasi, analitik bisnis, dan prioritas dukungan.',
          'Paket Enterprise (Skala Besar): Menawarkan kuota produk tanpa batas, kapasitas penyimpanan media multi-gigabyte, integrasi domain kustom, serta akses telemetri pasar B2B lanjutan.'
        ]
      },
      {
        number: 'Pasal 2',
        heading: 'Siklus Penagihan, Metode Pembayaran Resmi, & Kebijakan Non-Refundable',
        content: 'Langganan paket berbayar diaktifkan melalui pembayaran berkala (bulanan atau tahunan) menggunakan saluran pembayaran resmi yang disediakan oleh platform.',
        highlights: [
          'Metode pembayaran sah mencakup integrasi Payment Gateway Aulaa (QRIS instan, Virtual Account, E-Wallet) atau verifikasi transfer bank manual resmi platform.',
          'Kebijakan Non-Refundable: Biaya langganan paket yang telah dibayarkan dan telah aktif digunakan bersifat final dan tidak dapat dikembalikan (non-refundable) kecuali terjadi kesalahan penagihan ganda dari pihak platform.',
          'Pengelola bertanggung jawab menyelesaikan tagihan perpanjangan sebelum tanggal jatuh tempo guna menghindari penghentian otomatis fitur premium.'
        ]
      },
      {
        number: 'Pasal 3',
        heading: 'Berakhirnya Masa Langganan (Downgrade) & Perlindungan Over-Quota',
        content: 'Apabila masa langganan paket berbayar berakhir dan tidak diperpanjang, status akun profil katalog akan otomatis disesuaikan ke Paket Free.',
        highlights: [
          'Perlindungan Data: Produk yang telah diunggah sebelumnya tidak akan dihapus seketika dari database, namun produk yang melebihi batas kuota Free akan disembunyikan sementara (draft/hidden) dari etalase publik.',
          'Pengelola tidak dapat menambah produk baru atau mengunggah media tambahan hingga kapasitas penyimpanan berada di bawah ambang batas paket aktif.',
          'Reaktivasi paket berbayar akan otomatis memulihkan kembali seluruh produk dan media yang tersembunyi.'
        ]
      },
      {
        number: 'Pasal 4',
        heading: 'Mesin Keaktifan Toko (Store Dormancy Engine) & Perpanjangan Aktivitas',
        content: 'Guna menjaga kualitas direktori publik dari toko-toko mati yang tidak lagi melayani pembeli, Catavor menerapkan sistem Store Dormancy Engine otomatis.',
        highlights: [
          'Toko yang tidak memiliki aktivitas login atau interaksi pembaruan katalog selama periode 90 hari kalender akan masuk ke status Tidak Aktif Sementara (Dormant).',
          'Katalog toko yang berstatus dormant akan disembunyikan dari hasil pencarian publik guna melindungi konsumen dari pengalaman berbelanja yang tidak terlayani.',
          'Pengelola dapat sewaktu-waktu mengaktifkan kembali tokonya secara instan cukup dengan login ke dashboard admin dan menekan tombol Perpanjang Masa Aktif Toko tanpa dikenakan biaya.'
        ]
      }
    ]
  }
];

export const PlatformPoliciesView: React.FC<PlatformPoliciesViewProps> = ({
  onOpenHelpdesk,
  initialKey,
  onBack
}) => {
  const [activeKey, setActiveKey] = useState<PolicyKey>(initialKey || 'terms');
  const [searchQuery, setSearchQuery] = useState('');
  const [dynamicPolicies, setDynamicPolicies] = useState<Record<string, any>>({});
  const [legalSettings, setLegalSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialKey) {
      setActiveKey(initialKey);
    }
  }, [initialKey]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [policiesRes, settingsRes] = await Promise.all([
        fetch('/api/policies').then(r => r.json()).catch(() => null),
        fetch('/api/settings').then(r => r.json()).catch(() => null)
      ]);

      if (policiesRes && policiesRes.success && policiesRes.data) {
        setDynamicPolicies(policiesRes.data);
      }
      if (settingsRes && settingsRes.success && settingsRes.data) {
        setLegalSettings(settingsRes.data);
      }
    } catch {
      // Graceful fallback to static definitions
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener('catavor_policies_updated', handleUpdate);
    return () => window.removeEventListener('catavor_policies_updated', handleUpdate);
  }, []);

  // Merge static definitions with dynamic database policies
  const policyDocs: PolicyDoc[] = useMemo(() => {
    return FALLBACK_POLICY_SECTIONS.map(fallback => {
      const dbPolicy = dynamicPolicies[fallback.key];
      if (!dbPolicy) return fallback;

      let parsedArticles = fallback.articles;
      let summary = fallback.summary;
      let badge = fallback.badge;
      let category = fallback.category;

      if (dbPolicy.sections) {
        let secObj = dbPolicy.sections;
        if (typeof secObj === 'string') {
          try {
            secObj = JSON.parse(secObj);
          } catch {}
        }
        if (secObj && typeof secObj === 'object') {
          if (Array.isArray(secObj.articles) && secObj.articles.length > 0) {
            parsedArticles = secObj.articles;
          }
          if (secObj.summary) summary = secObj.summary;
          if (secObj.badge) badge = secObj.badge;
          if (secObj.category) category = secObj.category;
        }
      }

      return {
        ...fallback,
        title: dbPolicy.title || fallback.title,
        version: dbPolicy.version || fallback.version,
        effectiveDate: dbPolicy.effective_date ? new Date(dbPolicy.effective_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '1 Januari 2025',
        badge,
        category,
        summary,
        articles: parsedArticles
      };
    });
  }, [dynamicPolicies]);

  const currentDoc = policyDocs.find(doc => doc.key === activeKey) || policyDocs[0];
  const ActiveIcon = currentDoc.icon;

  const legalEntity = legalSettings.legal_entity_name || 'PT Catavor Media Digital';
  const legalWarning = legalSettings.legal_warning_banner || 'Sebagai pengelola katalog, Anda bertanggung jawab penuh atas keabsahan hukum dari setiap item yang dipajang. Segala bentuk peredaran satwa liar dilindungi tanpa izin BKSDA, tanaman langka tanpa karantina, komoditas ilegal, penipuan harga, atau pelanggaran hak cipta berakibat pada penindakan tegas berupa penonaktifan seketika (Item Locked) hingga pembekuan profil katalog permanen.';
  const officialEmail = legalSettings.platform_official_email || 'support@catavor.com';
  const officialWa = legalSettings.platform_official_whatsapp || '62811220227';

  // Filtered articles based on search query
  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return currentDoc.articles;
    return currentDoc.articles.filter(art => {
      const inNum = art.number.toLowerCase().includes(q);
      const inHead = art.heading.toLowerCase().includes(q);
      const inContent = art.content.toLowerCase().includes(q);
      const inHighlights = art.highlights?.some(h => h.toLowerCase().includes(q));
      return inNum || inHead || inContent || inHighlights;
    });
  }, [currentDoc, searchQuery]);

  return (
    <div className="animate-fade-in" style={{ padding: '0 0.5rem 3rem 0.5rem', width: '100%', boxSizing: 'border-box' }}>
      {/* Top Executive Header Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '1.75rem 2rem',
          borderRadius: '1.25rem',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          backgroundColor: 'var(--bg-card, #0f172a)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '320px' }}>
            {onBack && (
              <div style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={onBack}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                    color: 'var(--text-secondary, #cbd5e1)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.color = 'var(--text-secondary, #cbd5e1)';
                  }}
                >
                  <ArrowLeft size={15} />
                  <span>Kembali</span>
                </button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--primary, #10b981)',
                  backgroundColor: 'var(--primary-glow, rgba(16, 185, 129, 0.15))',
                  border: '1px solid var(--primary, #10b981)',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px'
                }}
              >
                <ShieldCheck size={14} strokeWidth={2} />
                Dokumen Resmi Pengelola Platform
              </span>
              <span
                style={{
                  fontSize: '0.74rem',
                  color: 'var(--text-muted, #94a3b8)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Building2 size={13} />
                {legalEntity}
              </span>
              {isLoading && (
                <span style={{ fontSize: '0.72rem', color: 'var(--primary, #10b981)' }}>
                  Memuat data resmi...
                </span>
              )}
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.65rem',
                fontWeight: 800,
                color: 'var(--text-primary, #ffffff)',
                letterSpacing: '-0.02em',
                lineHeight: 1.25
              }}
            >
              Pedoman Legal, Ketentuan &amp; Kepatuhan Platform
            </h1>
            <p
              style={{
                margin: '0.65rem 0 0 0',
                fontSize: '0.88rem',
                color: 'var(--text-secondary, #cbd5e1)',
                lineHeight: 1.6,
                maxWidth: '900px'
              }}
            >
              Ketentuan resmi ini diterbitkan oleh pengelola Platform Catavor untuk dipelajari, dipahami, dan dipatuhi oleh seluruh pemilik serta pengelola profil katalog. Harap cermat dan bertanggung jawab dalam mempublikasikan setiap item komoditas demi menjaga integritas ekosistem bisnis serta melindungi akun Anda dari sanksi penonaktifan katalog.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            {onOpenHelpdesk && (
              <button
                type="button"
                onClick={onOpenHelpdesk}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.15rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <HelpCircle size={16} strokeWidth={1.75} />
                <span>Konsultasi Tim Kepatuhan</span>
              </button>
            )}
          </div>
        </div>

        {/* Compliance Warning Callout */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '0.85rem',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.28)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.85rem'
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '0.55rem',
              backgroundColor: 'rgba(245, 158, 11, 0.18)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b',
              flexShrink: 0,
              marginTop: '2px'
            }}
          >
            <AlertTriangle size={18} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: '#f59e0b', letterSpacing: '0.04em', display: 'block' }}>
              Peringatan Kehati-hatian Pengunggahan Item
            </span>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.55 }}>
              {legalWarning}
            </p>
          </div>
        </div>
      </div>

      {/* Main Two-Column Reader Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Left Column: Navigation Sidebar */}
        <div
          className="glass-panel"
          style={{
            borderRadius: '1.25rem',
            border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            backgroundColor: 'var(--bg-card, #0f172a)',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            position: 'sticky',
            top: '1rem'
          }}
        >
          <div style={{ padding: '0.5rem 0.75rem 0.35rem 0.75rem', borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #94a3b8)' }}>
              6 Pilar Kebijakan Platform
            </span>
          </div>

          {policyDocs.map((doc, idx) => {
            const isSelected = doc.key === activeKey;
            const DocIcon = doc.icon;

            return (
              <button
                key={doc.key}
                type="button"
                onClick={() => {
                  setActiveKey(doc.key);
                  setSearchQuery('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '0.75rem',
                  border: isSelected ? '1px solid var(--primary, #10b981)' : '1px solid transparent',
                  backgroundColor: isSelected ? 'var(--primary-glow, rgba(16, 185, 129, 0.15))' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.18s ease',
                  position: 'relative'
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '0.5rem',
                    backgroundColor: isSelected ? 'var(--primary, #10b981)' : 'rgba(255, 255, 255, 0.06)',
                    color: isSelected ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}
                >
                  <DocIcon size={16} strokeWidth={1.75} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.83rem',
                        fontWeight: isSelected ? 800 : 600,
                        color: isSelected ? '#ffffff' : 'var(--text-secondary, #cbd5e1)',
                        display: 'block',
                        lineHeight: 1.35
                      }}
                    >
                      {idx + 1}. {doc.navLabel}
                    </span>
                    {doc.version && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.4rem',
                          borderRadius: '0.35rem',
                          backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                          color: isSelected ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                          flexShrink: 0
                        }}
                      >
                        {doc.version}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: isSelected ? 'var(--primary, #10b981)' : 'var(--text-muted, #94a3b8)',
                      marginTop: '0.2rem',
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {doc.category}
                  </span>
                </div>
              </button>
            );
          })}

          {/* Quick Note about Immutability */}
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem 0.85rem',
              borderRadius: '0.65rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.06))',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Info size={14} style={{ color: 'var(--text-muted, #94a3b8)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.4 }}>
              Ketentuan ini berlaku mengikat seluruh profil katalog secara otomatis sejak tanggal efektif.
            </span>
          </div>
        </div>

        {/* Right Column: Active Document Content Reader */}
        <div
          className="glass-panel"
          style={{
            borderRadius: '1.25rem',
            border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            backgroundColor: 'var(--bg-card, #0f172a)',
            padding: '2rem 2.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.75rem'
          }}
        >
          {/* Document Header */}
          <div style={{ borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))', paddingBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: 'var(--primary, #10b981)',
                  backgroundColor: 'var(--primary-glow, rgba(16, 185, 129, 0.15))',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--primary, #10b981)'
                }}
              >
                {currentDoc.badge}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={13} />
                Versi: <strong>{currentDoc.version || 'v2.0'}</strong> • Berlaku: <strong>{currentDoc.effectiveDate || '1 Januari 2025'}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '0.75rem',
                  backgroundColor: 'var(--primary-glow, rgba(16, 185, 129, 0.15))',
                  border: '1px solid var(--border-light, rgba(16, 185, 129, 0.35))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary, #10b981)',
                  flexShrink: 0
                }}
              >
                <ActiveIcon size={22} strokeWidth={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', lineHeight: 1.3 }}>
                  {currentDoc.title}
                </h2>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)' }}>
                  Kategori Regulasi: <strong>{currentDoc.category}</strong>
                </span>
              </div>
            </div>

            {/* Document Summary Box */}
            <div
              style={{
                marginTop: '1.25rem',
                padding: '1rem 1.25rem',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
                fontSize: '0.86rem',
                color: 'var(--text-secondary, #cbd5e1)',
                lineHeight: 1.65
              }}
            >
              <strong style={{ color: 'var(--text-primary, #ffffff)', display: 'block', marginBottom: '0.25rem' }}>
                Ringkasan Eksekutif:
              </strong>
              {currentDoc.summary}
            </div>

            {/* Article Filter / Search Bar */}
            <div style={{ marginTop: '1rem', position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #94a3b8)' }} />
              <input
                type="text"
                placeholder={`Cari pasal atau topik dalam ${currentDoc.navLabel}...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 1rem 0.65rem 2.4rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted, #94a3b8)',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Bersihkan
                </button>
              )}
            </div>
          </div>

          {/* Articles Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {filteredArticles.length === 0 ? (
              <div
                style={{
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '0.85rem',
                  border: '1px dashed var(--border-light, rgba(255, 255, 255, 0.1))'
                }}
              >
                <Search size={28} style={{ color: 'var(--text-muted, #94a3b8)', margin: '0 auto 0.5rem auto' }} />
                <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary, #cbd5e1)' }}>
                  Tidak ada pasal yang cocok dengan kata kunci &quot;{searchQuery}&quot;.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  Tampilkan Seluruh Pasal
                </button>
              </div>
            ) : (
              filteredArticles.map((art, aIdx) => (
                <div
                  key={aIdx}
                  style={{
                    padding: '1.35rem 1.5rem',
                    borderRadius: '0.85rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.025)',
                    border: '1px solid var(--border-light, rgba(255, 255, 255, 0.07))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: 'var(--primary, #10b981)',
                        backgroundColor: 'var(--primary-glow, rgba(16, 185, 129, 0.12))',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '0.4rem',
                        border: '1px solid var(--primary, #10b981)'
                      }}
                    >
                      {art.number}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)' }}>
                      {art.heading}
                    </h3>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.65 }}>
                    {art.content}
                  </p>

                  {art.highlights && art.highlights.length > 0 && (
                    <div
                      style={{
                        marginTop: '0.25rem',
                        padding: '0.85rem 1rem',
                        borderRadius: '0.65rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.06))',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.45rem'
                      }}
                    >
                      {art.highlights.map((h, hIdx) => (
                        <div key={hIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem' }}>
                          <span style={{ color: 'var(--primary, #10b981)', fontSize: '0.85rem', lineHeight: '1.4', flexShrink: 0, fontWeight: 'bold' }}>
                            ✓
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.55 }}>
                            {h}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Legal Certification Footer */}
          <div
            style={{
              marginTop: '0.5rem',
              padding: '1.15rem 1.35rem',
              borderRadius: '0.85rem',
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <ShieldCheck size={22} style={{ color: 'var(--primary, #10b981)', flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ffffff', display: 'block' }}>
                  Dokumen Resmi Kepatuhan Platform Catavor
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>
                  Dikelola dan diawasi oleh Divisi Hukum &amp; Kepatuhan {legalEntity} • Kontak: {officialEmail} / +{officialWa}
                </span>
              </div>
            </div>

            {onOpenHelpdesk && (
              <button
                type="button"
                onClick={onOpenHelpdesk}
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--primary, #10b981)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: 0
                }}
              >
                <span>Ajukan Pertanyaan Kepatuhan</span>
                <ExternalLink size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default PlatformPoliciesView;
