import React, { useState } from 'react';
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
  BookOpen
} from 'lucide-react';

export interface PlatformPoliciesViewProps {
  onOpenHelpdesk?: () => void;
}

type PolicyKey = 'terms' | 'prohibited' | 'privacy' | 'moderation' | 'transactions';

interface PolicyDoc {
  key: PolicyKey;
  navLabel: string;
  title: string;
  category: string;
  badge: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
  summary: string;
  articles: Array<{
    number: string;
    heading: string;
    content: string;
    highlights?: string[];
  }>;
}

const POLICY_SECTIONS: PolicyDoc[] = [
  {
    key: 'terms',
    navLabel: 'Syarat & Ketentuan Layanan',
    title: 'Syarat & Ketentuan Layanan Platform Catavor',
    category: 'Ketentuan Umum & Kedudukan Hukum',
    badge: 'Dokumen Perjanjian Pengelola',
    icon: FileText,
    summary: 'Dokumen hukum resmi dari PT Catavor Media Digital yang mengatur kedudukan hukum platform, hak, batasan, serta kewajiban seluruh pengelola profil katalog.',
    articles: [
      {
        number: 'Pasal 1',
        heading: 'Kedudukan Platform & Batasan Operasional',
        content: 'Platform Catavor bertindak semata-mata sebagai penyedia infrastruktur teknologi etalase katalog digital, manajemen inventaris, dan sarana komunikasi pemesanan. Catavor bukan merupakan penjual langsung, produsen, penyedia jasa, maupun perantara kepemilikan atas item yang dipublikasikan oleh masing-masing pengelola profil katalog.',
        highlights: [
          'Catavor menyediakan media katalog digital dan biolink resmi bisnis mandiri.',
          'Hubungan jual-beli terjalin langsung antara pengelola profil katalog dengan pembeli/konsumen akhir.',
          'Catavor tidak bertanggung jawab atas sengketa perdata yang timbul akibat wanprestasi atau ingkar janji antar-pihak di luar sistem Rekber resmi.'
        ]
      },
      {
        number: 'Pasal 2',
        heading: 'Kewajiban Integritas Data & Keaslian Item',
        content: 'Pengelola profil katalog wajib menjamin bahwa seluruh data yang diunggah—termasuk nama item, spesifikasi, harga satuan, status ketersediaan, foto dokumentasi, dan ketentuan garansi—adalah akurat, sah, dan dapat dipertanggungjawabkan di hadapan hukum Republik Indonesia.',
        highlights: [
          'Dilarang melakukan manipulasi harga (mark-up fiktif) atau menyembunyikan biaya wajib tambahan yang merugikan konsumen.',
          'Foto dan video media item wajib merupakan dokumentasi riil milik toko atau materi yang memiliki izin lisensi publikasi sah.',
          'Dilarang membuat deskripsi menyesatkan (misleading information) yang berpotensi menimbulkan kerugian materiil bagi publik.'
        ]
      },
      {
        number: 'Pasal 3',
        heading: 'Kepatuhan Hukum & Legalitas Usaha',
        content: 'Seluruh pengelola katalog wajib mematuhi ketentuan perundang-undangan yang berlaku di wilayah hukum Republik Indonesia, termasuk Undang-Undang Perlindungan Konsumen (UU No. 8 Tahun 1999) dan regulasi perdagangan elektronik (PP No. 80 Tahun 2019).',
        highlights: [
          'Pengelola bertanggung jawab penuh atas perizinan komersial dari instansi berwenang sesuai klasifikasi usaha.',
          'Catavor berhak sewaktu-waktu meminta bukti verifikasi legalitas atau sertifikasi resmi terkait item yang diperdagangkan.'
        ]
      }
    ]
  },
  {
    key: 'prohibited',
    navLabel: 'Pedoman Konten & Barang Terlarang',
    title: 'Pedoman Standar Konten & Larangan Barang/Jasa (AUP)',
    category: 'Kepatuhan Mutlak (Zero Tolerance)',
    badge: 'Wajib Dipatuhi Pengelola',
    icon: ShieldAlert,
    summary: 'Daftar komoditas, satwa, materi visual, dan praktik usaha yang dilarang keras dipublikasikan di seluruh ekosistem Catavor demi keamanan publik dan kepatuhan undang-undang.',
    articles: [
      {
        number: 'Pasal 1',
        heading: 'Perlindungan Satwa Liar & Tumbuhan Dilindungi',
        content: 'Catavor menjunjung tinggi etika konservasi keanekaragaman hayati. Dilarang keras mempublikasikan, menawarkan, menjual, atau memfasilitasi transaksi atas satwa liar yang dilindungi oleh undang-undang nasional maupun konvensi internasional.',
        highlights: [
          'Dilarang memperdagangkan seluruh satwa dan bagian tubuhnya yang masuk dalam daftar dilindungi UU No. 5 Tahun 1990 dan Permen LHK No. P.106/2018.',
          'Dilarang memperdagangkan flora/fauna yang terdaftar pada CITES Appendiks I & II tanpa dokumen izin penangkaran/kuota resmi BKSDA yang terverifikasi sah.',
          'Fauna non-lindung wajib memiliki keterangan asal-usul legal dan memenuhi standar kesejahteraan hewan (animal welfare).'
        ]
      },
      {
        number: 'Pasal 2',
        heading: 'Narkotika, Psikotropika & Obat-Obatan Tanpa Izin',
        content: 'Dilarang keras mempublikasikan zat adiktif, narkotika, psikotropika, obat-obatan keras golongan G yang memerlukan resep dokter, suplemen ilegal tanpa izin edar BPOM, serta zat terlarang lainnya sesuai UU Narkotika dan UU Kesehatan.',
        highlights: [
          'Kategori obat tradisional, jamu, dan kosmetik wajib memiliki nomor izin edar resmi BPOM yang sah.',
          'Dilarang mengklaim efek medis tidak berdasar (overclaim) yang membahayakan keselamatan kesehatan pembeli.'
        ]
      },
      {
        number: 'Pasal 3',
        heading: 'Senjata Api, Bahan Peledak & Senjata Berbahaya',
        content: 'Dilarang memperdagangkan senjata api, amunisi, replika senjata yang menyerupai aslinya (airsoft gun tanpa izin klub resmi), bahan peledak, racun berbahaya, dan senjata tajam ilegal yang tidak diperuntukkan bagi alat pertanian/kerajinan tradisional berizin.',
        highlights: [
          'Peralatan tajam hanya diizinkan untuk alat dapur, pertamanan, atau kerajinan dengan deskripsi fungsi yang jelas dan bertanggung jawab.'
        ]
      },
      {
        number: 'Pasal 4',
        heading: 'Pelanggaran Hak Cipta, Merek & Barang Bajakan',
        content: 'Pengelola dilarang menjual barang tiruan (KW, replika palsu, produk bajakan), akun software curian, lisensi perangkat lunak ilegal, atau materi digital yang melanggar Hak Kekayaan Intelektual (HAKI) pihak ketiga.',
        highlights: [
          'Penggunaan nama brand/merek dagang terkenal tanpa hak keagenan atau distributor resmi merupakan pelanggaran fatal.',
          'Catavor memproses laporan DMCA / sengketa merek dari pemilik hak cipta dan dapat langsung menghapus item terkait.'
        ]
      },
      {
        number: 'Pasal 5',
        heading: 'Konten Pornografi, Kekerasan & Ujaran Kebencian',
        content: 'Dilarang mengunggah materi visual atau teks bermuatan asusila, pornografi, eksploitasi anak, penganiayaan hewan/manusia, perjudian daring, skema piramida/Ponzi, atau konten provokatif yang menghina suku, agama, ras, dan antargolongan (SARA).',
        highlights: [
          'Pelanggaran kategori ini berakibat pada pembekuan permanen dan pelaporan ke pihak aparat penegak hukum.'
        ]
      }
    ]
  },
  {
    key: 'privacy',
    navLabel: 'Kebijakan Privasi & Data (UU PDP)',
    title: 'Kebijakan Privasi & Perlindungan Data Pribadi Pengguna',
    category: 'Kepatuhan UU No. 27 Tahun 2022 (PDP)',
    badge: 'Standar Perlindungan Privasi',
    icon: Lock,
    summary: 'Kewajiban hukum pengelola profil katalog dalam menjaga kerahasiaan data pembeli serta komitmen keamanan data dari platform Catavor.',
    articles: [
      {
        number: 'Pasal 1',
        heading: 'Perlindungan Data Pribadi Konsumen',
        content: 'Saat calon pembeli menghubungi nomor kontak WhatsApp toko atau melakukan pesanan, pengelola profil katalog berstatus sebagai Pengendali Data Pribadi Mandiri yang wajib mematuhi ketentuan UU Perlindungan Data Pribadi.',
        highlights: [
          'Dilarang keras menyebarluaskan, memperjualbelikan, atau menyerahkan nomor telepon, nama, atau alamat pembeli kepada pihak ketiga mana pun.',
          'Dilarang memasukkan kontak pembeli ke dalam database broadcast spam tanpa izin persetujuan eksplisit (opt-in) dari konsumen.',
          'Pengelola wajib menghapus data pribadi konsumen apabila diminta oleh yang bersangkutan sesuai hak subjek data.'
        ]
      },
      {
        number: 'Pasal 2',
        heading: 'Keamanan Data Platform Catavor',
        content: 'Catavor menerapkan standar enkripsi SSL/TLS 256-bit untuk seluruh lalu lintas jaringan dan basis data cloud terisolasi guna mencegah akses tanpa wewenang.',
        highlights: [
          'Catavor tidak pernah meminta kata sandi akun profil Anda melalui saluran apa pun.',
          'Seluruh riwayat audit log aktivitas merchant dicatat secara permanen untuk keperluan pembuktian hukum dan transparansi operasional.'
        ]
      },
      {
        number: 'Pasal 3',
        heading: 'Pengolahan Data Statistik Tren Pasar Agregat (Zero-PII)',
        content: 'Platform Catavor berhak mencatat, mengolah, dan mempublikasikan data statistik dan tren pasar agregat tanpa identitas pribadi (anonymized aggregate data) untuk keperluan riset industri, peningkatan ekosistem katalog, analitik tren pasar, dan kemitraan intelijen bisnis sesuai ketentuan UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.',
        highlights: [
          'Seluruh data tren pasar (kata kunci populer, volume pencarian, indeks harga rata-rata, demand gap) diolah secara anonim murni tanpa memuat nama, nomor kontak, alamat, atau identitas pribadi konsumen.',
          'Pencatatan telemetri pencarian tidak merekam data identitas pribadi dan menerapkan ambang batas privasi (K-Anonymity) guna mencegah re-identifikasi subjek data.',
          'Hasil riset pasar disajikan dalam wawasan tren makro industri untuk membantu ekosistem UMKM dan pengelola katalog memahami dinamika permintaan pasar.'
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
    icon: Scale,
    summary: 'Mekanisme pengawasan otomatis dan sanksi bertingkat oleh Tim Kepatuhan Catavor, serta hak pembelaan melalui permohonan banding resmi.',
    articles: [
      {
        number: 'Pasal 1',
        heading: 'Sistem Pengawasan Berkelanjutan',
        content: 'Tim Kepatuhan Platform Catavor melakukan audit integritas berkala dan memverifikasi laporan masyarakat atas indikasi ketidaksesuaian konten katalog terhadap pedoman komunitas.',
        highlights: [
          'Pemeriksaan meliputi kepatuhan foto, keaslian klaim, nomor rekening toko, serta izin perdagangan komoditas khusus.',
          'Laporan masyarakat yang disertai bukti otentik diprioritaskan untuk peninjauan langsung dalam waktu 1x24 jam.'
        ]
      },
      {
        number: 'Pasal 2',
        heading: 'Tingkatan Tindakan & Sanksi Kepatuhan',
        content: 'Pelanggaran terhadap syarat dan kebijakan platform ditindak melalui sanksi berjenjang yang adil:',
        highlights: [
          'Tingkat 1 - Teguran & Peringatan: Pengelola diberikan waktu untuk merevisi foto atau deskripsi item yang kurang akurat.',
          'Tingkat 2 - Penguncian/Penonaktifan Item (Item Hidden/Locked): Item yang terbukti melanggar pedoman ditarik dari etalase publik dan statusnya menjadi read-only.',
          'Tingkat 3 - Pembekuan Sementara Katalog (Store Suspension): Akses publik ke profil katalog ditutup sementara sehubungan dengan peninjauan menyeluruh.',
          'Tingkat 4 - Pemutusan Akun Permanen (Blacklist): Pelanggaran fatal (penipuan, satwa dilindungi, narkotika) berujung pada penutupan total dan pencabutan hak akses sistem.'
        ]
      },
      {
        number: 'Pasal 3',
        heading: 'Hak Pengajuan Banding Kepatuhan Resmi',
        content: 'Pengelola profil katalog yang terkena penonaktifan item atau pembekuan akun memiliki hak penuh untuk mengajukan permohonan peninjauan kembali (Banding Kepatuhan) tanpa dipungut biaya apa pun.',
        highlights: [
          'Banding diajukan melalui tab Bantuan (Helpdesk) dengan menyertakan kronologi jelas dan bukti sertifikat/izin kepatuhan.',
          'Tim Kepatuhan akan memberikan keputusan objektif paling lambat 2x24 jam hari kerja.'
        ]
      }
    ]
  },
  {
    key: 'transactions',
    navLabel: 'Pedoman Transaksi & Rekber Syariah',
    title: 'Pedoman Transaksi Aman, Kejujuran & Rekber Syariah',
    category: 'Integritas Pembayaran Konsumen',
    badge: 'Prosedur Keamanan Keuangan',
    icon: CheckCircle2,
    summary: 'Petunjuk operasional penerimaan pembayaran, pengiriman pesanan konsumen, dan pemanfaatan fasilitas Rekber Syariah resmi.',
    articles: [
      {
        number: 'Pasal 1',
        heading: 'Prinsip Transaksi Langsung WhatsApp',
        content: 'Untuk transaksi yang diselesaikan langsung melalui chat WhatsApp antara pembeli dan toko, pengelola wajib menjunjung tinggi etika kejujuran perniagaan.',
        highlights: [
          'Wajib memberikan nomor rekening bank resmi toko dan memastikan nama pemilik rekening sesuai dengan identitas bisnis terdaftar.',
          'Wajib mengirimkan nomor resi kurir pengiriman yang valid dan dapat dilacak segera setelah barang dikirimkan.',
          'Wajib menerapkan kebijakan garansi retur/klaim yang telah dicantumkan pada informasi item secara konsisten.'
        ]
      },
      {
        number: 'Pasal 2',
        heading: 'Fasilitas Rekber Syariah Resmi Catavor',
        content: 'Platform Catavor menyediakan integrasi opsional Rekber Syariah sebagai pihak ketiga tepercaya guna mengamankan dana transaksi bernilai tinggi, fauna bergaransi hidup (Live Arrival Guarantee), atau tanaman langka.',
        highlights: [
          'Dana pembeli dipegang aman di rekening penampung resmi Rekber Syariah dan baru diteruskan ke pengelola setelah pesanan diterima sesuai standar.',
          'Catavor dan Rekber Syariah menerapkan akad muamalah yang transparan, bebas riba, dan bebas manipulasi biaya.'
        ]
      }
    ]
  }
];

export const PlatformPoliciesView: React.FC<PlatformPoliciesViewProps> = ({ onOpenHelpdesk }) => {
  const [activeKey, setActiveKey] = useState<PolicyKey>('terms');

  const currentDoc = POLICY_SECTIONS.find(doc => doc.key === activeKey) || POLICY_SECTIONS[0];
  const ActiveIcon = currentDoc.icon;

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.65rem' }}>
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
                PT Catavor Media Digital
              </span>
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
              Sebagai pengelola katalog, Anda bertanggung jawab penuh atas keabsahan hukum dari setiap item yang dipajang. Segala bentuk peredaran satwa liar dilindungi tanpa izin BKSDA, tanaman langka tanpa karantina, komoditas ilegal, penipuan harga, atau pelanggaran hak cipta berakibat pada penindakan tegas berupa <strong>penonaktifan seketika (*Item Locked*)</strong> hingga <strong>pembekuan profil katalog permanen</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Main Two-Column Reader Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
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
              Daftar Dokumen Kebijakan
            </span>
          </div>

          {POLICY_SECTIONS.map((doc, idx) => {
            const isSelected = doc.key === activeKey;
            const DocIcon = doc.icon;

            return (
              <button
                key={doc.key}
                type="button"
                onClick={() => setActiveKey(doc.key)}
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
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: isSelected ? 'var(--primary, #10b981)' : 'var(--text-muted, #94a3b8)',
                      marginTop: '0.2rem',
                      display: 'block'
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
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                Versi Dokumen: <strong>v2.4 (Terikat UU RI)</strong> • Berlaku: <strong>1 Januari 2025</strong>
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
                <ActiveIcon size={22} strokeWidth={1.75} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', letterSpacing: '-0.01em' }}>
                  {currentDoc.title}
                </h2>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.15rem', display: 'block' }}>
                  Klasifikasi: {currentDoc.category}
                </span>
              </div>
            </div>

            <p style={{ margin: '1rem 0 0 0', fontSize: '0.86rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.6, fontStyle: 'italic' }}>
              &ldquo;{currentDoc.summary}&rdquo;
            </p>
          </div>

          {/* Articles List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {currentDoc.articles.map((art, aIdx) => (
              <div
                key={aIdx}
                style={{
                  padding: '1.35rem 1.5rem',
                  borderRadius: '1rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: '#ffffff',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '0.4rem',
                      letterSpacing: '0.04em'
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
            ))}
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
                  Dikelola dan diawasi oleh Divisi Hukum &amp; Kepatuhan PT Catavor Media Digital
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
