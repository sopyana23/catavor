import React from 'react';
import {
  Scale,
  ShieldAlert,
  Lock,
  CheckCircle2,
  CreditCard,
  FileText
} from 'lucide-react';
import { checkUrlSecurity } from './urlSecurity';

// The API serves SEVEN policy documents. 'acceptable_use' was missing from this
// union, which forced every consumer to fold it into 'prohibited' — so clicking
// Ketentuan Penggunaan rendered Barang Terlarang. Keep this in sync with
// GET /api/policies.
export type PolicyKey = 'terms' | 'privacy' | 'acceptable_use' | 'prohibited' | 'subscription' | 'transactions' | 'moderation';

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

export interface ApiPolicyRecord {
  type?: string;
  title?: string;
  version?: string;
  content?: string;
  sections?: unknown;
  summary_of_changes?: string;
  change_type?: string;
  effective_date?: string;
  requires_acceptance?: boolean;
}

export interface DraftPolicyOverride {
  key: PolicyKey;
  title: string;
  version: string;
  category: string;
  badge: string;
  summary: string;
  articles: PolicyArticle[];
}

export interface PolicyAuditLogItem {
  id: number;
  policy_type: string;
  action: string;
  old_version?: string;
  new_version?: string;
  change_summary?: string;
  admin_email?: string;
  admin_ip?: string;
  created_at: string;
}

export const FALLBACK_POLICY_SECTIONS: PolicyDoc[] = [
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
    key: 'acceptable_use',
    navLabel: 'Ketentuan Penggunaan',
    title: 'Ketentuan Penggunaan Layanan Platform Catavor',
    category: 'Aturan Penggunaan Layanan',
    badge: 'Wajib Dipatuhi Pengguna',
    version: 'v1.0',
    icon: FileText,
    summary: 'Aturan penggunaan layanan: larangan produk, standar konten, dan sanksi pelanggaran yang berlaku bagi seluruh pengguna Platform Catavor.',
    articles: [
      {
        number: 'Pasal 1',
        heading: 'Larangan Produk',
        content: 'Dilarang mengunggah satwa liar dilindungi tanpa izin BKSDA resmi, barang bajakan/ilegal, senjata, atau materi yang melanggar norma hukum.',
        highlights: []
      },
      {
        number: 'Pasal 2',
        heading: 'Sanksi Pelanggaran',
        content: 'Pelanggaran akan dikenakan sanksi mulai dari penutupan katalog, pemblokiran akun, hingga pelaporan ke pihak berwajib.',
        highlights: []
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
          'Kata sandi akun dienkripsi menggunakan algoritma hashing satu arah Bcrypt Cost 12 yang tahan serangan brute-force.',
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
          'Paket Free (Gratis Terbatas): Ditujukan untuk bisnis perintis dengan batas hingga 15 produk aktif dan kuota penyimpanan media 100 MB.',
          'Paket Pro Starter (Bisnis Berkembang): Menyediakan kapasitas hingga 150 produk aktif, kuota penyimpanan 2 GB, lencana Pro terverifikasi, dan bebas iklan sponsor.',
          'Paket Pro Bisnis (Skala Besar): Menawarkan kuota produk tanpa batas, kapasitas penyimpanan media 10 GB, integrasi Custom Domain, serta dukungan VIP prioritas.'
        ]
      },
      {
        number: 'Pasal 2',
        heading: 'Siklus Penagihan, Metode Pembayaran Resmi, & Kebijakan Non-Refundable',
        content: 'Langganan paket berbayar diaktifkan melalui sistem prabayar bulanan menggunakan saluran pembayaran resmi yang disediakan oleh platform.',
        highlights: [
          'Metode pembayaran sah mencakup integrasi Payment Gateway Aulaa (QRIS instan, Virtual Account, E-Wallet) atau verifikasi transfer bank/QRIS manual resmi platform.',
          'Kebijakan Non-Refundable: Biaya langganan paket yang telah dibayarkan dan telah aktif digunakan bersifat final dan tidak dapat dikembalikan (non-refundable) kecuali terjadi kesalahan penagihan ganda dari pihak platform.',
          'Pengelola bertanggung jawab menyelesaikan tagihan perpanjangan pada jendela H-3 atau masa tenggang guna menghindari penghentian otomatis fitur premium.'
        ]
      },
      {
        number: 'Pasal 3',
        heading: 'Berakhirnya Masa Langganan (Downgrade) & Perlindungan Over-Quota',
        content: 'Apabila masa langganan paket berbayar serta masa tenggang 7 hari berakhir tanpa pelunasan perpanjangan, status profil katalog akan otomatis disesuaikan ke Paket Gratis Terbatas.',
        highlights: [
          'Perlindungan Data: Produk yang telah diunggah sebelumnya tidak akan dihapus dari database, namun produk yang melebihi batas kuota Gratis Terbatas akan dipindahkan sementara ke arsip (draft).',
          'Pengelola tidak dapat menambah produk baru atau mengunggah media tambahan hingga kapasitas berada di bawah ambang batas paket aktif.',
          'Reaktivasi paket berbayar akan memungkinkan pengelola mengaktifkan kembali seluruh produk yang terarsip.'
        ]
      },
      {
        number: 'Pasal 4',
        heading: 'Mesin Keaktifan Toko (Store Dormancy Engine) & Perpanjangan Aktivitas',
        content: 'Guna menjaga kualitas direktori publik dari toko-toko mati yang tidak lagi melayani pembeli, Catavor menerapkan sistem Store Dormancy Engine otomatis.',
        highlights: [
          'Toko paket Free yang tidak memiliki aktivitas atau pembaruan katalog akan menerima Peringatan Awal pada hari ke-30 dan Peringatan Terakhir pada hari ke-38.',
          'Jika tetap tidak aktif sampai hari ke-45, katalog toko dinonaktifkan sementara (Dormant/Suspended) dan disembunyikan dari publik guna menjaga kualitas direktori.',
          'Pengelola memiliki masa tenggang 15 hari (hingga hari ke-60) untuk mengaktifkan kembali tokonya secara instan tanpa biaya melalui tautan reaktivasi email atau tombol Perpanjang Masa Aktif di dashboard admin sebelum data dan media dihapus permanen.'
        ]
      }
    ]
  }
];

export function normalizePolicyArticle(raw: unknown): PolicyArticle {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rawHighlights = Array.isArray(obj.highlights) ? obj.highlights : [];
  return {
    number: typeof obj.number === 'string' ? obj.number : String(obj.number ?? ''),
    heading: typeof obj.heading === 'string' ? obj.heading : String(obj.heading ?? ''),
    content: typeof obj.content === 'string' ? obj.content : String(obj.content ?? ''),
    highlights: rawHighlights
      .map((item) => (typeof item === 'string' ? item : String(item ?? '')))
      .filter((item) => item.trim().length > 0)
  };
}

// Audit finding A2: `policies.sections` is frequently NULL in the DB, which used to
// make admin edits to `content` (markdown) invisible on the public page. This parser
// turns the admin-authored markdown into structured articles so the published content
// is what actually renders. Pure string work only — renderers still sanitize links
// via checkUrlSecurity (SEC-FE-01), no HTML is produced here.
const POLICY_MD_HEADING_PATTERNS: RegExp[] = [
  /^#{2,4}\s+(.+)$/,
  /^\*\*(.+?)\*\*:?\s*$/,
  /^__(.+?)__:?\s*$/
];

const POLICY_MD_NUMBER_RE = /^(?:pasal|bab|bagian|artikel)\s+([0-9]+[a-z]?|[ivxlcdm]+)\b[\s.:-]*(.*)$/i;
// Admin editors commonly write "### 1. Judul" / "### 2) Judul" without the word "Pasal".
const POLICY_MD_LEADING_NUM_RE = /^([0-9]+[a-z]?|[ivxlcdm]+)[.)\]:-]\s*(.+)$/i;

export function parsePolicyMarkdownToArticles(markdown?: string | null): PolicyArticle[] {
  if (!markdown || typeof markdown !== 'string') return [];

  const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const articles: PolicyArticle[] = [];
  let current: PolicyArticle | null = null;
  let pendingParagraph: string[] = [];
  let pendingHighlights: string[] = [];

  const flushPending = () => {
    if (!current) {
      pendingParagraph = [];
      pendingHighlights = [];
      return;
    }
    const body = pendingParagraph.join('\n').trim();
    if (body) current.content = current.content ? `${current.content}\n\n${body}` : body;
    if (pendingHighlights.length > 0) {
      current.highlights = [...(current.highlights || []), ...pendingHighlights];
    }
    pendingParagraph = [];
    pendingHighlights = [];
  };

  const openArticle = (rawHeading: string) => {
    flushPending();
    let heading = rawHeading
      .replace(/^#{2,4}\s+/, '')
      .replace(/^\*\*(.+?)\*\*:?$/, '$1')
      .replace(/^__(.+?)__:?$/, '$1')
      .replace(/\*\*|__/g, '')
      .trim();
    if (!heading) return;

    let number = '';
    const numMatch = heading.match(POLICY_MD_NUMBER_RE);
    if (numMatch) {
      const label = numMatch[1].toLowerCase();
      const rest = (numMatch[2] || '').trim();
      number = /^[ivxlcdm]+$/.test(label) && !/^[0-9]/.test(label)
        ? `Pasal ${label.toUpperCase()}`
        : `Pasal ${label}`;
      heading = rest || heading;
    } else {
      const leadMatch = heading.match(POLICY_MD_LEADING_NUM_RE);
      if (leadMatch) {
        const label = leadMatch[1].toLowerCase();
        const rest = (leadMatch[2] || '').trim();
        if (rest) {
          number = /^[ivxlcdm]+$/.test(label) && !/^[0-9]/.test(label)
            ? `Pasal ${label.toUpperCase()}`
            : `Pasal ${label}`;
          heading = rest;
        }
      }
    }
    if (!heading) return;
    current = { number, heading, content: '', highlights: [] };
    articles.push(current);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushPending();
      continue;
    }

    // Horizontal rules / separators never start an article.
    if (/^[-*_]{3,}$/.test(line)) {
      flushPending();
      continue;
    }

    // Document title (#) is already rendered from the API `title` field — ignore it
    // so the page does not show a duplicated heading.
    if (/^#\s+/.test(line)) continue;

    const isHeading = POLICY_MD_HEADING_PATTERNS.some((re) => re.test(line));
    if (isHeading) {
      openArticle(line);
      continue;
    }

    const bulletMatch = line.match(/^(?:[-*•]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      const item = bulletMatch[1].trim();
      if (!item) continue;
      if (current) pendingHighlights.push(item);
      else pendingParagraph.push(item);
      continue;
    }

    pendingParagraph.push(line.startsWith('>') ? line.replace(/^>+\s*/, '') : line);
  }

  flushPending();

  const cleaned = articles.filter((a) => a.heading.trim().length > 0);
  if (cleaned.length === 0) return [];
  return cleaned.map((a) => ({
    ...a,
    content: a.content.trim(),
    highlights: (a.highlights || []).filter((h) => h.trim().length > 0)
  }));
}

export function hydratePolicyDocs(
  dynamicPolicies: Record<string, ApiPolicyRecord | undefined>,
  draftOverride?: DraftPolicyOverride | null
): PolicyDoc[] {
  return FALLBACK_POLICY_SECTIONS.map((fallback) => {
    if (draftOverride && draftOverride.key === fallback.key) {
      return {
        ...fallback,
        title: draftOverride.title || fallback.title,
        version: draftOverride.version || fallback.version,
        effectiveDate: 'Pratinjau Draf Langsung',
        badge: draftOverride.badge || fallback.badge,
        category: draftOverride.category || fallback.category,
        summary: draftOverride.summary || fallback.summary,
        articles: (draftOverride.articles || []).map(normalizePolicyArticle)
      };
    }

    const dbPolicy = dynamicPolicies[fallback.key];
    if (!dbPolicy) return fallback;

    let parsedArticles: PolicyArticle[] = fallback.articles;
    let summary = fallback.summary;
    let badge = fallback.badge;
    let category = fallback.category;

    if (dbPolicy.sections) {
      let secObj: unknown = dbPolicy.sections;
      if (typeof secObj === 'string') {
        try {
          secObj = JSON.parse(secObj);
        } catch {
          secObj = null;
        }
      }
      if (secObj && typeof secObj === 'object' && !Array.isArray(secObj)) {
        const rec = secObj as Record<string, unknown>;
        if (Array.isArray(rec.articles) && rec.articles.length > 0) {
          parsedArticles = rec.articles.map(normalizePolicyArticle);
        }
        if (typeof rec.summary === 'string' && rec.summary.trim()) summary = rec.summary;
        if (typeof rec.badge === 'string' && rec.badge.trim()) badge = rec.badge;
        if (typeof rec.category === 'string' && rec.category.trim()) category = rec.category;
      }
    }

    // Priority 3 (audit finding A2): when the admin has no structured `sections`,
    // publish the markdown they actually saved in `content`. Falls back to the
    // static articles when the markdown yields nothing parseable.
    if (parsedArticles === fallback.articles && dbPolicy.content) {
      const fromMarkdown = parsePolicyMarkdownToArticles(dbPolicy.content);
      if (fromMarkdown.length > 0) parsedArticles = fromMarkdown;
    }

    let formattedDate = '1 Januari 2025';
    if (dbPolicy.effective_date) {
      const d = new Date(dbPolicy.effective_date);
      if (!Number.isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    }

    return {
      ...fallback,
      title: dbPolicy.title || fallback.title,
      version: dbPolicy.version || fallback.version,
      effectiveDate: formattedDate,
      badge,
      category,
      summary,
      articles: parsedArticles
    };
  });
}

export function renderPolicyInlineMarkdown(
  text?: string,
  onPromptExternalUrl?: (url: string) => void
): React.ReactNode {
  if (!text) return null;
  const cleanText = String(text)
    .replace(/^>+\s*/gm, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^[ \t]*---+[ \t]*$/gm, '')
    .replace(/^[ \t]*--+[ \t]*$/gm, '')
    .replace(/(\s)--+(\s)/g, '$1—$2');

  const regex = /(\*\*([^*]+?)\*\*|__([^_]+?)__|(?<!\*)\*([^*]+?)\*(?!\*)|(?<!_)_([^_]+?)_(?!_)|`([^`]+?)`|\[([^\]]+)\]\(([^)]+)\))/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  const sanitizePlain = (str: string) =>
    str
      .replace(/\*\*/g, '')
      .replace(/^>+\s*/gm, '')
      .replace(/---+/g, '')
      .replace(/--+/g, '—');

  while ((match = regex.exec(cleanText)) !== null) {
    if (match.index > lastIndex) {
      const rawText = sanitizePlain(cleanText.substring(lastIndex, match.index));
      if (rawText) parts.push(rawText);
    }
    if (match[2] !== undefined) {
      parts.push(<strong key={`b-${idx++}`} style={{ fontWeight: 700, color: 'inherit' }}>{sanitizePlain(match[2])}</strong>);
    } else if (match[3] !== undefined) {
      parts.push(<strong key={`b2-${idx++}`} style={{ fontWeight: 700, color: 'inherit' }}>{sanitizePlain(match[3])}</strong>);
    } else if (match[4] !== undefined) {
      parts.push(<em key={`i-${idx++}`} style={{ fontStyle: 'italic', color: 'inherit' }}>{sanitizePlain(match[4])}</em>);
    } else if (match[5] !== undefined) {
      parts.push(<em key={`i2-${idx++}`} style={{ fontStyle: 'italic', color: 'inherit' }}>{sanitizePlain(match[5])}</em>);
    } else if (match[6] !== undefined) {
      parts.push(
        <code key={`c-${idx++}`} style={{ backgroundColor: 'var(--bg-inset)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.9em' }}>
          {match[6]}
        </code>
      );
    } else if (match[7] !== undefined && match[8] !== undefined) {
      const linkLabel = sanitizePlain(match[7]);
      const sec = checkUrlSecurity(match[8]);
      if (!sec.isSafe || sec.sanitizedUrl === '#') {
        parts.push(<span key={`blocked-${idx++}`}>{linkLabel}</span>);
      } else {
        parts.push(
          <a
            key={`l-${idx++}`}
            href={sec.sanitizedUrl}
            target={sec.isExternal ? '_blank' : undefined}
            rel={sec.isExternal ? 'noopener noreferrer' : undefined}
            onClick={(e) => {
              if (sec.requiresWarning) {
                e.preventDefault();
                if (onPromptExternalUrl) {
                  onPromptExternalUrl(sec.sanitizedUrl);
                } else if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('catavor_prompt_external_url', { detail: { url: sec.sanitizedUrl } }));
                }
              }
            }}
            style={{ color: 'var(--primary-strong)', textDecoration: 'underline' }}
          >
            {linkLabel}
          </a>
        );
      }
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < cleanText.length) {
    const rawTail = sanitizePlain(cleanText.substring(lastIndex));
    if (rawTail) parts.push(rawTail);
  }
  return parts.length > 0 ? parts : sanitizePlain(cleanText);
}

export function renderPolicyArticleContent(
  content?: string,
  onPromptExternalUrl?: (url: string) => void
): React.ReactNode {
  if (!content) return null;
  const lines = String(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      elements.push(<div key={`sp-${idx}`} style={{ height: '0.35rem' }} />);
      return;
    }

    if (/^[-*_]{2,}$/.test(trimmed)) {
      elements.push(
        <hr key={`hr-${idx}`} style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '0.65rem 0' }} />
      );
      return;
    }

    if (trimmed.startsWith('>')) {
      const qText = trimmed.replace(/^>+\s*/, '');
      elements.push(
        <blockquote key={`bq-${idx}`} style={{ margin: '0.35rem 0', padding: '0.45rem 0.75rem', borderRadius: '0.45rem', backgroundColor: 'var(--bg-inset)', borderLeft: '3px solid var(--primary)', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.84rem' }}>
          {renderPolicyInlineMarkdown(qText, onPromptExternalUrl)}
        </blockquote>
      );
      return;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('-- ')) {
      const itemText = trimmed.replace(/^(--|-|•)\s+/, '');
      elements.push(
        <div key={`li-${idx}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', paddingLeft: '0.5rem', margin: '0.15rem 0' }}>
          <span style={{ color: 'var(--primary)', fontSize: '0.85rem', lineHeight: '1.4', flexShrink: 0 }}>•</span>
          <span style={{ fontSize: '0.95rem', color: 'inherit', lineHeight: 1.7, maxWidth: '68ch' }}>{renderPolicyInlineMarkdown(itemText, onPromptExternalUrl)}</span>
        </div>
      );
      return;
    }

    elements.push(
      <p key={`p-${idx}`} style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem', color: 'inherit', lineHeight: 1.75, maxWidth: '68ch' }}>
        {renderPolicyInlineMarkdown(trimmed, onPromptExternalUrl)}
      </p>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      {elements}
    </div>
  );
}
