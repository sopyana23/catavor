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
  Building2,
  ExternalLink,
  Check
} from 'lucide-react';

export interface MobilePoliciesViewProps {
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
    navLabel: 'Syarat & Ketentuan',
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
    navLabel: 'Barang Terlarang & Konten',
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
        content: 'Dilarang memperdagangkan senjata api, amunisi, replika senjata yang menyerupai aslinya, bahan peledak, racun berbahaya, dan senjata tajam ilegal yang tidak diperuntukkan bagi alat pertanian/kerajinan tradisional berizin.',
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
    navLabel: 'Privasi & Data (UU PDP)',
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
      }
    ]
  },
  {
    key: 'moderation',
    navLabel: 'Moderasi & Sanksi',
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
          'Tingkat 4 - Pemutusan Akun Permanen (Blacklist): Pelanggaran fatal berujung pada penutupan total dan pencabutan hak akses sistem.'
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
    navLabel: 'Transaksi & Rekber',
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

export const MobilePoliciesView: React.FC<MobilePoliciesViewProps> = ({ onOpenHelpdesk }) => {
  const [activeKey, setActiveKey] = useState<PolicyKey>('terms');

  const currentDoc = POLICY_SECTIONS.find(doc => doc.key === activeKey) || POLICY_SECTIONS[0];
  const ActiveIcon = currentDoc.icon;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', width: '100%', boxSizing: 'border-box' }}>
      {/* Top Mobile Hero Card */}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
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
            PT Catavor Media Digital
          </span>
        </div>

        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', lineHeight: 1.3 }}>
            Pedoman Legal &amp; Kebijakan Platform
          </h2>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.5 }}>
            Standar kepatuhan resmi untuk seluruh pengelola katalog guna memastikan item yang diunggah mematuhi hukum Republik Indonesia dan pedoman komunitas.
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
            <strong>Peringatan Pengunggahan:</strong> Dilarang keras memajang satwa dilindungi tanpa izin BKSDA, tanaman tanpa karantina, maupun materi terlarang. Pelanggaran memicu penonaktifan item hingga pembekuan katalog.
          </p>
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
            <span>Butuh Konsultasi Kepatuhan? Buka Tiket Dukungan</span>
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
        {POLICY_SECTIONS.map((doc, idx) => {
          const isSelected = doc.key === activeKey;
          const DocIcon = doc.icon;

          return (
            <button
              key={doc.key}
              type="button"
              onClick={() => setActiveKey(doc.key)}
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
              Versi: <strong>v2.4</strong> • Berlaku: <strong>1 Jan 2025</strong>
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
            &ldquo;{currentDoc.summary}&rdquo;
          </p>
        </div>

        {/* Articles List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {currentDoc.articles.map((art, aIdx) => (
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
                  {art.heading}
                </h4>
              </div>

              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.55 }}>
                {art.content}
              </p>

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
                        {h}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
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
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#ffffff' }}>
              Diterbitkan secara sah oleh Divisi Hukum &amp; Kepatuhan PT Catavor Media Digital
            </span>
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

