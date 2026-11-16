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
  Building2,
  ExternalLink,
  CreditCard,
  Check,
  Search,
  ArrowLeft,
  X
} from 'lucide-react';

export type PolicyKey = 'terms' | 'prohibited' | 'privacy' | 'moderation' | 'transactions' | 'subscription';

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

export interface MobilePoliciesViewProps {
  onOpenHelpdesk?: () => void;
  initialKey?: PolicyKey;
  onBack?: () => void;
}

const FALLBACK_POLICY_SECTIONS: PolicyDoc[] = [
  {
    key: 'terms',
    navLabel: 'Syarat & Ketentuan',
    title: 'Syarat & Ketentuan Layanan Platform Catavor',
    category: 'Ketentuan Umum & Kedudukan Hukum',
    badge: 'Dokumen Perjanjian Pengelola',
    version: 'v2.0',
    icon: FileText,
    summary: 'Dokumen hukum resmi dari PT Catavor Media Digital yang mengatur kedudukan hukum platform sebagai PSE, hak, batasan, serta kewajiban seluruh pengelola profil katalog.',
    articles: [
      {
        number: 'Pasal 1',
        heading: 'Kedudukan Platform & Batasan Operasional',
        content: 'Platform Catavor bertindak semata-mata sebagai penyedia infrastruktur teknologi etalase katalog digital, manajemen inventaris, dan sarana komunikasi pemesanan. Catavor bukan merupakan penjual langsung, produsen, penyedia jasa, maupun perantara kepemilikan atas item yang dipublikasikan oleh masing-masing pengelola profil katalog.',
        highlights: [
          'Catavor menyediakan media katalog digital dan biolink resmi bisnis mandiri tanpa campur tangan kepemilikan barang.',
          'Mendukung 7 tipe katalog: Produk Fisik, Kuliner, Produk Digital, Jasa, Tanaman Hias, Satwa & Fauna, serta Properti.',
          'Hubungan jual-beli terjalin langsung antara pengelola profil katalog dengan pembeli/konsumen akhir.',
          'Catavor tidak bertanggung jawab atas sengketa perdata yang timbul akibat wanprestasi atau ingkar janji antar-pihak di luar sistem Rekber resmi.'
        ]
      },
      {
        number: 'Pasal 2',
        heading: 'Akun, Hak Akses Staf (RBAC), & Kredensial',
        content: 'Pengelola bertanggung jawab penuh atas kerahasiaan kata sandi, token autentikasi, serta hak akses staf (RBAC) yang diberikan kepada tim internalnya.',
        highlights: [
          'Pengelola wajib menggunakan nomor WhatsApp aktif dan data identitas yang valid.',
          'Dilarang membagikan kredensial login utama kepada pihak luar tanpa otorisasi tertulis.',
          'Segala transaksi atau perubahan data melalui akun terdaftar dianggap sah sebagai tindakan pemilik katalog.'
        ]
      },
      {
        number: 'Pasal 3',
        heading: 'Integritas Informasi & Aturan Khusus 7 Tipe Katalog',
        content: 'Seluruh data item—termasuk spesifikasi, harga satuan Rupiah, stok, foto dokumentasi, dan ketentuan garansi—wajib akurat, jujur, dan tidak menyesatkan.',
        highlights: [
          'Kuliner: Wajib higienis, mencantumkan bahan alergi, masa kadaluwarsa, dan sertifikasi halal bila relevan.',
          'Digital & Jasa: Wajib menjamin keaslian lisensi perangkat lunak, HAKI, dan kejelasan ruang lingkup (Scope of Work).',
          'Tanaman & Fauna: Wajib non-dilindungi, disertai dokumen karantina/BKSDA resmi, serta garansi hidup tiba (DOA).',
          'Properti: Wajib memastikan keabsahan sertifikat kepemilikan (SHM/SHGB/AJB) dan transparansi izin lokasi.'
        ]
      },
      {
        number: 'Pasal 4',
        heading: 'Hak Kekayaan Intelektual (HAKI) Konten Katalog',
        content: 'Hak cipta atas materi visual, logo, foto dokumentasi, dan deskripsi produk tetap milik sah pengelola atau pemilik aslinya. Pengelola memberi lisensi publikasi kepada Catavor demi kelancaran operasional katalog.',
        highlights: [
          'Dilarang mengunggah materi visual atau merek terdaftar pihak ketiga tanpa izin resmi.',
          'Catavor berhak menghapus konten yang terbukti melanggar HAKI berdasarkan aduan pemilik sah.'
        ]
      },
      {
        number: 'Pasal 5',
        heading: 'Batasan Tanggung Jawab Platform',
        content: 'Platform Catavor disediakan dalam kondisi sebagaimana adanya (as-is). Platform dibebaskan dari tuntutan kerugian langsung maupun tidak langsung akibat kelalaian merchant, sengketa transaksi luar sistem, atau gangguan jaringan pihak ketiga.',
        highlights: [
          'Keberlangsungan operasional tunduk pada pemeliharaan berkala infrastruktur server.',
          'Force Majeure membebaskan platform dari kewajiban ganti rugi atas kendala di luar kendali wajar.'
        ]
      }
    ]
  },
  {
    key: 'prohibited',
    navLabel: 'Komoditas Terlarang',
    title: 'Standar Komoditas & Konten yang Dilarang Keras',
    category: 'Kepatuhan Hukum Pidana & Konservasi',
    badge: 'Kepatuhan Hukum Wajib',
    version: 'v2.0',
    icon: ShieldAlert,
    summary: 'Daftar komoditas terlarang, konservasi satwa/tumbuhan langka, larangan materi pornografi/perjudian, dan sanksi pemutusan akun permanen.',
    articles: [
      {
        number: 'Pasal 1',
        heading: 'Komoditas Ilegal Mutlak & Zat Terlarang',
        content: 'Dilarang keras mempublikasikan atau memperdagangkan segala jenis barang atau zat yang dilarang oleh undang-undang Republik Indonesia.',
        highlights: [
          'Narkotika, psikotropika, prekursor, obat keras golongan G tanpa resep atau izin BPOM.',
          'Senjata api, replika airsoft tanpa izin resmi, bahan peledak, amunisi, dan racun berbahaya.',
          'Dokumen identitas palsu (KTP, paspor, ijazah) atau layanan jasa pembuatan identitas bodong.',
          'Materi pornografi, eksploitasi seksual anak, perjudian, taruhan, dan skema Ponzi.'
        ]
      },
      {
        number: 'Pasal 2',
        heading: 'Konservasi Satwa (Fauna) & Tanaman (Plant) Dilindungi',
        content: 'Catavor menjunjung tinggi kelestarian hayati nusantara. Dilarang keras memperdagangkan satwa dan tanaman yang dilindungi oleh undang-undang nasional maupun konvensi CITES.',
        highlights: [
          'Dilarang memperdagangkan satwa/flora yang masuk dalam daftar dilindungi UU No. 5/1990 dan Permen LHK P.106/2018.',
          'Dilarang menjual spesimen CITES Appendiks I & II tanpa sertifikat penangkaran F2 dan izin BKSDA resmi.',
          'Fauna non-lindung wajib memiliki bukti asal-usul legal dan memenuhi standar kesejahteraan hewan (animal welfare).'
        ]
      },
      {
        number: 'Pasal 3',
        heading: 'Software Bajakan, Data Pribadi, & Listing Fiktif',
        content: 'Dilarang mempublikasikan perangkat lunak bajakan (cracked/nulled), akun curian, basis data pribadi pihak ketiga, atau listing properti fiktif.',
        highlights: [
          'Produk digital wajib memiliki izin lisensi redistribusi sah atau hak cipta pencipta asli.',
          'Dilarang menyebarkan akun berlangganan bajakan, bot spamming, atau eksploitasi malware.',
          'Listing properti sengketa atau tanpa persetujuan ahli waris dilarang keras.'
        ]
      },
      {
        number: 'Pasal 4',
        heading: 'Manipulasi Teknis & Phishing Tautan Eksternal',
        content: 'Dilarang keras melakukan manipulasi sistem katalog, scraping ilegal, Denial of Service (DoS), atau penyematan tautan phishing berbahaya.',
        highlights: [
          'Tautan eksternal wajib mengarah ke domain resmi terpercaya (Safe Domains Whitelist).',
          'Dilarang memakai tautan penyingkat URL misterius (URL shortener anonim).',
          'Pelanggaran manipulasi sistem memicu pemblokiran akun permanen seketika (Tingkat 4 Blacklist).'
        ]
      }
    ]
  },
  {
    key: 'privacy',
    navLabel: 'Kebijakan Privasi',
    title: 'Kebijakan Privasi & Pelindungan Data Pribadi (UU PDP)',
    category: 'Perlindungan Data & Transparansi Telemetri',
    badge: 'Standar UU PDP No. 27/2022',
    version: 'v2.0',
    icon: Lock,
    summary: 'Komitmen perlindungan data pribadi pengguna, enkripsi kata sandi, transparansi telemetri agregat Zero-PII, dan hak penghapusan data (Right to Erasure).',
    articles: [
      {
        number: 'Pasal 1',
        heading: 'Ruang Lingkup Data Pribadi yang Diproses',
        content: 'Platform Catavor memproses data identitas akun berupa nama, alamat email terverifikasi, nomor WhatsApp bisnis, dan nama profil katalog.',
        highlights: [
          'Data identitas dikumpulkan secara sadar atas persetujuan pengguna saat proses registrasi.',
          'Catavor tidak menyimpan atau memproses data keuangan sensitif (nomor CVV atau PIN kartu kredit).',
          'Nomor WhatsApp pengelola digunakan untuk komunikasi pesanan katalog dan otorisasi sistem.'
        ]
      },
      {
        number: 'Pasal 2',
        heading: 'Standar Keamanan Kriptografi & Penyimpanan Data',
        content: 'Data kredensial dan media katalog diamankan menggunakan enkripsi industri berstandar tinggi.',
        highlights: [
          'Kata sandi akun dienkripsi menggunakan algoritma hashing satu arah Argon2id / Bcrypt Cost 12.',
          'Sesi login dilindungi token JWT dengan atribut pengaman HttpOnly dan SameSite.',
          'Foto komoditas diproses kompresi cerdas dan dibersihkan dari metadata koordinat GPS (EXIF).'
        ]
      },
      {
        number: 'Pasal 3',
        heading: 'Transparansi Telemetri Agregat & Zero-PII B2B',
        content: 'Catavor mencatat tren pasar agregat tanpa identitas pribadi (Zero-PII) untuk riset ekosistem UMKM dan optimasi katalog.',
        highlights: [
          'Data statistik makro hanya mencakup kata kunci terpopuler dan rentang harga agregat pasar.',
          'Sama sekali TIDAK MEMUAT nama orang, nomor telepon privat, atau detail pembeli individu.',
          'Data pribadi konsumen dan rahasia dagang toko TIDAK PERNAH DIJUAL ke pihak mana pun.'
        ]
      },
      {
        number: 'Pasal 4',
        heading: 'Hak Subjek Data & Penghapusan Akun',
        content: 'Pengguna berhak mengajukan penutupan akun dan penghapusan data (Right to Erasure) sesuai ketentuan UU PDP.',
        highlights: [
          'Penutupan profil toko akan menghapus seluruh foto dan media fisik secara permanen dari server.',
          'Retensi hukum terbatas tetap diberlakukan untuk rekam jejak persetujuan regulasi sesuai UU ITE.'
        ]
      }
    ]
  },
  {
    key: 'moderation',
    navLabel: 'Standar Moderasi',
    title: 'Standar Moderasi, Investigasi & Penegakan Sanksi Berjenjang',
    category: 'Prosedur Disiplin Ekosistem',
    badge: 'Transparansi & Akuntabilitas',
    version: 'v2.0',
    icon: CheckCircle2,
    summary: 'Mekanisme pengawasan konten proaktif, penanganan aduan masyarakat, matriks sanksi 4 tingkat, dan hak banding resmi tanpa biaya.',
    articles: [
      {
        number: 'Pasal 1',
        heading: 'Pengawasan Berkelanjutan & Kanal Aduan',
        content: 'Tim Kepatuhan memantau kesesuaian izin perdagangan komoditas, keaslian foto, dan memproses laporan aduan masyarakat.',
        highlights: [
          'Masyarakat dapat melaporkan indikasi penipuan atau barang terlarang melalui kanal laporan resmi.',
          'Aduan dengan bukti awal konkret diverifikasi dalam kurun waktu 1x24 jam.'
        ]
      },
      {
        number: 'Pasal 2',
        heading: 'Matriks Sanksi 4 Tingkat Kepatuhan',
        content: 'Penindakan atas pelanggaran pedoman platform diterapkan secara terukur melalui matriks sanksi 4 tingkat:',
        highlights: [
          'Tingkat 1 - Peringatan Tertulis (Warning): Pengelola diberi waktu 2x24 jam untuk merevisi kekeliruan data.',
          'Tingkat 2 - Penguncian Item (Item Locked): Item yang melanggar disembunyikan dari etalase publik (read-only).',
          'Tingkat 3 - Pembekuan Profil Katalog (Store Suspension): Etalase dinonaktifkan sementara akibat pelanggaran berulang.',
          'Tingkat 4 - Pemutusan Permanen (Blacklist): Diterapkan pada pelanggaran fatal seperti penipuan terbukti atau barang ilegal.'
        ]
      },
      {
        number: 'Pasal 3',
        heading: 'Status Penguncian Barang Bukti (Moderator Item Lock)',
        content: 'Item katalog yang berstatus Tingkat 2 (Item Locked) tidak dapat diubah atau dihapus guna melindungi bukti penyelidikan.',
        highlights: [
          'Penguncian barang bukti menjaga integritas digital selama proses peninjauan sengketa berlangsung.',
          'Status penguncian hanya dicabut setelah klarifikasi sah diterima oleh tim kepatuhan.'
        ]
      },
      {
        number: 'Pasal 4',
        heading: 'Prosedur Banding Kepatuhan Resmi Tanpa Biaya',
        content: 'Pengelola berhak mengajukan peninjauan kembali atas sanksi Tingkat 2 atau Tingkat 3 melalui Helpdesk resmi tanpa biaya.',
        highlights: [
          'Banding diajukan dengan melampirkan izin komoditas, sertifikat keaslian, atau kronologi tertulis.',
          'Tim Kepatuhan memberikan jawaban dan verifikasi berkas maksimal dalam 2x24 jam hari kerja.'
        ]
      }
    ]
  },
  {
    key: 'transactions',
    navLabel: 'Pedoman Transaksi',
    title: 'Pedoman Transaksi Aman, Kejujuran & Rekber Syariah',
    category: 'Integritas Pembayaran & Escrow',
    badge: 'Prosedur Keamanan Keuangan',
    version: 'v2.0',
    icon: CreditCard,
    summary: 'Tata kelola transaksi perniagaan mandiri, integrasi Rekber Syariah pihak ketiga, pengecualian transaksi properti, dan garansi Live Arrival (DOA).',
    articles: [
      {
        number: 'Pasal 1',
        heading: 'Prinsip Transaksi Transparan & Mata Uang Rupiah',
        content: 'Seluruh harga item yang tertera di katalog wajib menggunakan Rupiah (IDR) secara transparan dan jujur.',
        highlights: [
          'Pengelola wajib menginformasikan rincian ongkos kirim dan estimasi waktu ekspedisi terpercaya.',
          'Wajib memberikan nomor rekening bank resmi yang sesuai dengan identitas bisnis terdaftar.',
          'Wajib memberikan resi pelacakan pengiriman segera setelah barang diserahkan ke jasa kurir.'
        ]
      },
      {
        number: 'Pasal 2',
        heading: 'Fasilitas Rekening Bersama Syariah Resmi (Escrow)',
        content: 'Catavor mengintegrasikan layanan pihak ketiga resmi Rekber Syariah (rekbersyariah.com) untuk mengamankan transaksi bernilai tinggi.',
        highlights: [
          'Berlaku untuk 6 tipe katalog transaksional: Fisik, Kuliner, Digital, Jasa, Tanaman, dan Fauna.',
          'Akad Syariah: Dana ditampung di rekening penampung pihak ketiga dan dicairkan setelah barang diterima baik.',
          'Seluruh panduan validasi grup WhatsApp transaksi diatur oleh standar resmi mitra Rekber Syariah.'
        ]
      },
      {
        number: 'Pasal 3',
        heading: 'Pengecualian Khusus Katalog Properti',
        content: 'Katalog Properti berfungsi semata-mata sebagai media etalase informasi dan jadwal survei lokasi fisik secara langsung.',
        highlights: [
          'Transaksi properti DIKECUALIKAN dari fasilitas Rekber Syariah otomatis.',
          'Peralihan hak wajib dilakukan melalui prosedur formal di hadapan Notaris / PPAT berwenang.',
          'Dilarang mentransfer uang muka properti tanpa verifikasi fisik objek dan sertifikat asli.'
        ]
      },
      {
        number: 'Pasal 4',
        heading: 'Standar Garansi Live Arrival (DOA) Tanaman & Fauna',
        content: 'Pengelola kategori Fauna dan Tanaman wajib menggunakan kemasan standar beroksigen dan menjamin komoditas tiba dalam kondisi hidup.',
        highlights: [
          'Garansi DOA: Penjual wajib mengganti komoditas atau refund jika spesimen tiba dalam keadaan mati.',
          'Syarat Sah Klaim: Pembeli wajib merekam video unboxing utuh tanpa jeda (no-cut) maksimal 2 jam sejak paket tiba.'
        ]
      }
    ]
  },
  {
    key: 'subscription',
    navLabel: 'Paket & Kuota',
    title: 'Ketentuan Langganan Merchant, Kuota & Masa Aktif Toko',
    category: 'Skema Komersial & Siklus Hidup Akun',
    badge: 'Transparansi Biaya & Kuota',
    version: 'v2.0',
    icon: Scale,
    summary: 'Kebijakan paket Gratis vs Pro, kapasitas penyimpanan media isolated, proteksi over-quota saat penurunan paket, dan mesin Store Dormancy otomatis.',
    articles: [
      {
        number: 'Pasal 1',
        heading: 'Skema Paket Layanan & Batasan Kapasitas',
        content: 'Catavor menyediakan paket keanggotaan Free, Pro Starter, dan Pro Bisnis dengan batasan kuota item dan media terukur.',
        highlights: [
          'Paket Free: Pintu masuk pengenalan platform dengan kuota 5 item dan media dasar.',
          'Paket Berbayar: Akses fitur multi-gambar, video player, dan kuota katalog yang lebih besar.',
          'Penyimpanan dihitung transparan berdasarkan akumulasi berkas fisik aktif di direktori server.'
        ]
      },
      {
        number: 'Pasal 2',
        heading: 'Faktur, Pembayaran, & Penyesuaian Paket (Downgrade)',
        content: 'Pembayaran langganan dilakukan di muka. Jika masa aktif paket berakhir tanpa perpanjangan, profil akan otomatis disesuaikan ke Paket Free.',
        highlights: [
          'Perlindungan Over-Quota: Item yang melebihi kuota Free tidak dihapus, melainkan disembunyikan sementara (draft).',
          'Reaktivasi paket berbayar akan otomatis memulihkan kembali seluruh produk dan media yang tersembunyi.'
        ]
      },
      {
        number: 'Pasal 3',
        heading: 'Mesin Keaktifan Toko (Store Dormancy Engine)',
        content: 'Toko yang tidak memiliki aktivitas login atau pembaruan katalog selama 90 hari kalender akan masuk ke status dormant (disembunyikan dari pencarian).',
        highlights: [
          'Tujuan dormancy adalah melindungi konsumen dari toko tidak aktif yang tidak melayani pesanan.',
          'Pengelola dapat mengaktifkan kembali tokonya seketika cukup dengan login ke dashboard admin tanpa biaya.'
        ]
      }
    ]
  }
];

// Defensive helper to parse inline markdown (bold, italic, code, links) and eliminate raw **, >, and -- tokens
export const renderInlineMarkdown = (text?: string): React.ReactNode => {
  if (!text) return null;
  // 1. Clean leading/stray blockquote markers and horizontal dividers
  let cleanText = text
    .replace(/^>+\s*/gm, '') // Remove leading blockquote markers on any line
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Remove standalone horizontal rules / hyphens
  cleanText = cleanText.replace(/^[ \t]*---+[ \t]*$/gm, '');
  cleanText = cleanText.replace(/^[ \t]*--+[ \t]*$/gm, '');

  // Convert mid-sentence double hyphens (e.g. "item -- termasuk") to em-dash "—"
  cleanText = cleanText.replace(/(\s)--+(\s)/g, '$1—$2');

  const regex = /(\*\*([^*]+?)\*\*|__([^_]+?)__|(?<!\*)\*([^*]+?)\*(?!\*)|(?<!_)_([^_]+?)_(?!_)|`([^`]+?)`|\[([^\]]+)\]\(([^)]+)\))/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let idx = 0;

  const sanitizePlain = (str: string) => {
    return str
      .replace(/\*\*/g, '')
      .replace(/^>+\s*/gm, '')
      .replace(/---+/g, '')
      .replace(/--+/g, '—');
  };

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
        <code key={`c-${idx++}`} style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.9em' }}>
          {match[6]}
        </code>
      );
    } else if (match[7] !== undefined && match[8] !== undefined) {
      parts.push(
        <a key={`l-${idx++}`} href={match[8]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary, #10b981)', textDecoration: 'underline' }}>
          {match[7]}
        </a>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < cleanText.length) {
    const rawTail = sanitizePlain(cleanText.substring(lastIndex));
    if (rawTail) parts.push(rawTail);
  }
  return parts.length > 0 ? parts : sanitizePlain(cleanText);
};

const renderArticleContent = (content: string) => {
  if (!content) return null;
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      elements.push(<div key={`sp-${idx}`} style={{ height: '0.35rem' }} />);
      return;
    }

    // Horizontal divider --- or --
    if (/^[-*_]{2,}$/.test(trimmed)) {
      elements.push(
        <hr key={`hr-${idx}`} style={{ border: 'none', borderTop: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))', margin: '0.65rem 0' }} />
      );
      return;
    }

    // Blockquote starting with >
    if (trimmed.startsWith('>')) {
      const qText = trimmed.replace(/^>+\s*/, '');
      elements.push(
        <blockquote key={`bq-${idx}`} style={{ margin: '0.35rem 0', padding: '0.45rem 0.75rem', borderRadius: '0.45rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderLeft: '3px solid var(--primary, #10b981)', color: 'var(--text-secondary, #cbd5e1)', fontStyle: 'italic', fontSize: '0.78rem' }}>
          {renderInlineMarkdown(qText)}
        </blockquote>
      );
      return;
    }

    // Bullet item starting with - or • or --
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('-- ')) {
      const itemText = trimmed.replace(/^(--|-|•)\s+/, '');
      elements.push(
        <div key={`li-${idx}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', paddingLeft: '0.35rem', margin: '0.12rem 0' }}>
          <span style={{ color: 'var(--primary, #10b981)', fontSize: '0.8rem', lineHeight: '1.4', flexShrink: 0 }}>•</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.55 }}>{renderInlineMarkdown(itemText)}</span>
        </div>
      );
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${idx}`} style={{ margin: '0 0 0.35rem 0', fontSize: '0.78rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.55 }}>
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      {elements}
    </div>
  );
};

export const MobilePoliciesView: React.FC<MobilePoliciesViewProps> = ({
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
        effectiveDate: dbPolicy.effective_date
          ? new Date(dbPolicy.effective_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
          : '1 Jan 2025',
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
  const legalJurisdiction = legalSettings.legal_jurisdiction || 'Hukum Republik Indonesia';
  const legalWarning = legalSettings.legal_warning_banner || 'Pengelola wajib memastikan keabsahan hukum seluruh item. Dilarang keras memajang satwa dilindungi tanpa izin BKSDA, tanaman langka tanpa karantina, maupun komoditas terlarang. Pelanggaran memicu penonaktifan item (Item Locked) hingga pembekuan katalog.';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', width: '100%', boxSizing: 'border-box' }}>
      {/* Top Mobile Executive Card */}
      <div
        className="glass-panel"
        style={{
          padding: '1rem',
          borderRadius: '0.9rem',
          backgroundColor: 'var(--bg-card, #0f172a)',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}
      >
        {onBack && (
          <div>
            <button
              type="button"
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.8rem',
                borderRadius: '0.55rem',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                color: 'var(--text-secondary, #cbd5e1)',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={14} />
              <span>Kembali</span>
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.45rem', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.66rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              color: 'var(--primary, #10b981)',
              backgroundColor: 'var(--primary-glow, rgba(16, 185, 129, 0.15))',
              border: '1px solid var(--primary, #10b981)',
              padding: '0.2rem 0.55rem',
              borderRadius: '9999px'
            }}
          >
            <ShieldCheck size={12} strokeWidth={2} />
            Dokumen Resmi Platform
          </span>

          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <Building2 size={11} />
            {legalEntity}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.66rem',
              color: 'var(--text-muted, #94a3b8)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              padding: '0.15rem 0.5rem',
              borderRadius: '0.35rem',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <Scale size={11} style={{ color: 'var(--primary, #10b981)' }} />
            Yurisdiksi: {legalJurisdiction}
          </span>

          {isLoading && (
            <span style={{ fontSize: '0.68rem', color: 'var(--primary, #10b981)' }}>
              Memuat data...
            </span>
          )}
        </div>

        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', lineHeight: 1.3 }}>
            Pedoman Legal, Ketentuan &amp; Kepatuhan
          </h2>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.5 }}>
            Standar kepatuhan resmi untuk seluruh pengelola katalog guna memastikan item yang diunggah mematuhi {legalJurisdiction} dan pedoman komunitas.
          </p>
        </div>

        {/* Warning Callout */}
        <div
          style={{
            padding: '0.75rem 0.85rem',
            borderRadius: '0.65rem',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem'
          }}
        >
          <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} strokeWidth={2} />
          <p style={{ margin: 0, fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.45 }}>
            <strong>Peringatan Pengunggahan:</strong> {renderInlineMarkdown(legalWarning)}
          </p>
        </div>

        {/* Search Bar for Articles */}
        <div style={{ position: 'relative', marginTop: '0.15rem' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #94a3b8)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder={`Cari pasal / klausul di ${currentDoc.navLabel}...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 2.2rem 0.55rem 2.2rem',
              borderRadius: '0.55rem',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
              color: '#ffffff',
              fontSize: '0.78rem',
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
                right: '0.6rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                padding: '0.2rem',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {onOpenHelpdesk && (
          <button
            type="button"
            onClick={onOpenHelpdesk}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.55rem 0.85rem',
              borderRadius: '0.6rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--text-primary, #ffffff)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
              cursor: 'pointer',
              minHeight: '44px',
              width: '100%'
            }}
          >
            <HelpCircle size={15} strokeWidth={1.75} />
            <span>Butuh Konsultasi Kepatuhan? Buka Bantuan</span>
          </button>
        )}
      </div>

      {/* Horizontal Scrollable Policy Pills (Touch Targets >= 44px) */}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          overflowX: 'auto',
          paddingBottom: '0.4rem',
          WebkitOverflowScrolling: 'touch',
          msOverflowStyle: 'none'
        }}
      >
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 0.9rem',
                borderRadius: '0.65rem',
                border: isSelected ? '1px solid var(--primary, #10b981)' : '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                backgroundColor: isSelected ? 'var(--primary-glow, rgba(16, 185, 129, 0.18))' : 'var(--bg-card, #0f172a)',
                color: isSelected ? 'var(--primary, #10b981)' : 'var(--text-secondary, #cbd5e1)',
                fontWeight: isSelected ? 800 : 600,
                fontSize: '0.76rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                minHeight: '44px',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
            >
              <DocIcon size={15} strokeWidth={1.75} />
              <span>{idx + 1}. {doc.navLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Document Content Card */}
      <div
        className="glass-panel"
        style={{
          padding: '1.15rem 1rem',
          borderRadius: '0.9rem',
          backgroundColor: 'var(--bg-card, #0f172a)',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.15rem'
        }}
      >
        {/* Document Header */}
        <div style={{ borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))', paddingBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                color: 'var(--primary, #10b981)',
                backgroundColor: 'var(--primary-glow, rgba(16, 185, 129, 0.15))',
                padding: '0.18rem 0.5rem',
                borderRadius: '0.35rem',
                border: '1px solid var(--primary, #10b981)'
              }}
            >
              {currentDoc.badge}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)' }}>
              Versi: <strong>{currentDoc.version || 'v2.0'}</strong> • Berlaku: <strong>{currentDoc.effectiveDate || '1 Jan 2025'}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '0.55rem',
                backgroundColor: 'var(--primary-glow, rgba(16, 185, 129, 0.15))',
                border: '1px solid var(--border-light, rgba(16, 185, 129, 0.35))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary, #10b981)',
                flexShrink: 0
              }}
            >
              <ActiveIcon size={18} strokeWidth={1.75} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', lineHeight: 1.3 }}>
                {currentDoc.title}
              </h3>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.1rem', display: 'block' }}>
                Klasifikasi: {currentDoc.category}
              </span>
            </div>
          </div>

          <p style={{ margin: '0.65rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.5, fontStyle: 'italic' }}>
            &ldquo;{renderInlineMarkdown(
              currentDoc.summary
                .replace(/^>+\s*/gm, '')
                .replace(/^\*\*Ringkasan Eksekutif:\*\*\s*/i, '')
                .replace(/^[ \t]*---+[ \t]*$/gm, '')
                .replace(/^[ \t]*--+[ \t]*$/gm, '')
            )}&rdquo;
          </p>
        </div>

        {/* Search match stats */}
        {searchQuery && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.65rem', borderRadius: '0.45rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>
            <span>Menemukan <strong>{filteredArticles.length}</strong> pasal cocok</span>
            <button type="button" onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--primary, #10b981)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>Reset Pencarian</button>
          </div>
        )}

        {/* Articles List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredArticles.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted, #94a3b8)', fontSize: '0.8rem' }}>
              Tidak ada pasal yang cocok dengan kata kunci &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            filteredArticles.map((art, aIdx) => (
              <div
                key={aIdx}
                style={{
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: '#ffffff',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      padding: '0.12rem 0.45rem',
                      borderRadius: '0.3rem'
                    }}
                  >
                    {art.number}
                  </span>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)' }}>
                    {renderInlineMarkdown(art.heading.replace(/^#+\s*/, ''))}
                  </h4>
                </div>

                {renderArticleContent(art.content)}

                {art.highlights && art.highlights.length > 0 && (
                  <div
                    style={{
                      marginTop: '0.15rem',
                      padding: '0.65rem 0.75rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid var(--border-light, rgba(255, 255, 255, 0.06))',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem'
                    }}
                  >
                    {art.highlights.map((h, hIdx) => (
                      <div key={hIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                        <Check size={13} style={{ color: 'var(--primary, #10b981)', flexShrink: 0, marginTop: '2px' }} strokeWidth={2.5} />
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.45 }}>
                          {renderInlineMarkdown(h)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer Seal */}
        <div
          style={{
            marginTop: '0.25rem',
            padding: '0.85rem',
            borderRadius: '0.65rem',
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} style={{ color: 'var(--primary, #10b981)', flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#ffffff', display: 'block' }}>
                Diterbitkan secara sah oleh Divisi Hukum &amp; Kepatuhan {legalEntity}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)' }}>
                Yurisdiksi: {legalJurisdiction} • Kontak: {officialEmail} / +{officialWa}
              </span>
            </div>
          </div>

          {onOpenHelpdesk && (
            <button
              type="button"
              onClick={onOpenHelpdesk}
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                color: 'var(--primary, #10b981)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.25rem 0',
                alignSelf: 'flex-start'
              }}
            >
              <span>Ajukan Pertanyaan Kepatuhan via Helpdesk</span>
              <ExternalLink size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
