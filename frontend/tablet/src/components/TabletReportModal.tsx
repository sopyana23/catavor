import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  X, 
  Store, 
  Briefcase, 
  Utensils, 
  Smartphone, 
  Building2, 
  PawPrint, 
  Sprout, 
  Package, 
  Check, 
  Mail, 
  ShieldCheck, 
  Send 
} from 'lucide-react';
import { API_BASE } from '../utils/apiClient';

export function getCatalogReportReasons(targetType: 'store' | 'item', item?: any): { id: string; title: string; desc: string }[] {
  if (targetType === 'store') {
    return [
      { 
        id: 'illegal_commodities', 
        title: 'Konten, Komoditas, atau Layanan Terlarang Hukum', 
        desc: 'Menawarkan barang/jasa terlarang undang-undang, zat berbahaya, satwa dilindungi, atau konten ilegal' 
      },
      { 
        id: 'copyright_brand', 
        title: 'Pelanggaran Hak Cipta, Merek Dagang & Lisensi', 
        desc: 'Menggunakan nama brand, logo, foto portofolio, karya digital, atau identitas pihak lain tanpa izin sah' 
      },
      { 
        id: 'fraud_scam', 
        title: 'Indikasi Penipuan Transaksi, Usaha Fiktif, atau Scam', 
        desc: 'Profil usaha fiktif, pesanan tidak diproses pasca pembayaran, kontak palsu, atau penipuan uang muka' 
      },
      { 
        id: 'misleading_profile', 
        title: 'Profil Bisnis, Lokasi, atau Legalitas Menyesatkan', 
        desc: 'Alamat operasional palsu, izin usaha/sertifikasi bodong, atau klaim garansi yang manipulatif' 
      },
      { 
        id: 'community_violation', 
        title: 'Pelanggaran Ketentuan Komunitas & Etika Berbisnis', 
        desc: 'Perilaku kasar, diskriminasi, spamming, atau pelanggaran tata tertib platform lainnya' 
      }
    ];
  }

  // Target type: 'item'
  const pType = String(item?.product_type || item?.type || item?.attributes?.product_type || 'physical').trim().toLowerCase();

  if (pType === 'digital') {
    return [
      { id: 'pirated_license', title: 'Lisensi Bajakan / Akun Curian / Pelanggaran Hak Cipta', desc: 'Penjualan lisensi tidak sah, akun crack/curian, atau pembajakan software/karya digital' },
      { id: 'malware_virus', title: 'Mengandung Malware, Virus, atau Skrip Berbahaya', desc: 'File unduhan memuat virus, ransomware, trojan, atau script berbahaya bagi sistem/perangkat' },
      { id: 'broken_link', title: 'Tautan Unduhan Rusak / File Rusak (Corrupted)', desc: 'Link download mati, file corrupt tidak bisa dibuka, atau file tidak pernah dikirimkan' },
      { id: 'misleading_features', title: 'Fitur atau Format File Tidak Sesuai Deskripsi', desc: 'Format file, resolusi, kompatibilitas, atau kelengkapan fitur digital fiktif dan menipu' },
      { id: 'phishing_scam', title: 'Indikasi Phishing / Akses Akun Pribadi Ilegal', desc: 'Meminta kredensial akun pribadi pengguna atau metode pengiriman file mencurigakan' },
      { id: 'other', title: 'Pelanggaran Lainnya pada Produk Digital', desc: 'Pelanggaran ketentuan produk digital lainnya yang tidak tercantum di atas' }
    ];
  }

  if (pType === 'service') {
    return [
      { id: 'fraud_service', title: 'Layanan Fiktif / Tidak Dikerjakan Pasca Pembayaran', desc: 'Penyedia jasa tidak mengerjakan order, kabur setelah menerima pembayaran (ghosting), atau order fiktif' },
      { id: 'unlicensed_practice', title: 'Praktik Tanpa Izin Resmi / Keahlian Palsu', desc: 'Layanan mewajibkan sertifikasi/izin profesional resmi namun tidak memiliki legalitas valid' },
      { id: 'misleading_scope', title: 'Lingkup Kerja Menyesatkan / Tarif Jebakan', desc: 'Janji lingkup pekerjaan tidak sesuai realita atau ada biaya tambahan tersembunyi di luar kesepakatan' },
      { id: 'safety_violation', title: 'Pelanggaran Standar Keselamatan & Etika Profesi', desc: 'Pengerjaan membahayakan keselamatan klien/properti, perlakuan tidak etis, atau malpraktik teknis' },
      { id: 'breach_warranty', title: 'Ingkar Garansi / Menolak Revisi Sesuai Perjanjian', desc: 'Mengabaikan komitmen purnajual, revisi kerja yang dijanjikan, atau menolak pertanggungjawaban garansi' },
      { id: 'other', title: 'Pelanggaran Lainnya pada Layanan Jasa', desc: 'Pelanggaran ketentuan layanan jasa lainnya yang tidak tercantum di atas' }
    ];
  }

  if (pType === 'food') {
    return [
      { id: 'expired_spoiled', title: 'Makanan Basi, Kadaluwarsa, atau Tidak Layak Konsumsi', desc: 'Makanan sudah melewati masa kedaluwarsa, basi, berjamur, atau membusuk saat disajikan/diterima' },
      { id: 'hygiene_hazard', title: 'Masalah Kebersihan Ekstrem / Kontaminasi Benda Asing', desc: 'Ditemukan benda asing berbahaya, pengolahan kotor, atau fasilitas dapur tidak higienis' },
      { id: 'hidden_ingredients', title: 'Bahan Berbahaya / Keterangan Alergen & Non-Halal Ditutupi', desc: 'Mengandung zat berbahaya dilarang, atau menyembunyikan status non-halal/alergen kritis' },
      { id: 'misleading_portion', title: 'Porsi Sangat Memanipulasi / Kemasan Rusak Parah', desc: 'Porsi dan komposisi makanan jauh berbeda dari iklan, atau kemasan bocor/hancur membahayakan' },
      { id: 'unregistered_food', title: 'Tanpa Izin Edar P-IRT / BPOM pada Produk Tertentu', desc: 'Produk olahan kemasan/pabrikan yang diedarkan tanpa sertifikasi izin kesehatan wajib' },
      { id: 'other', title: 'Pelanggaran Lainnya pada Menu Kuliner', desc: 'Pelanggaran ketentuan kuliner lainnya yang tidak tercantum di atas' }
    ];
  }

  if (pType === 'property') {
    return [
      { id: 'disputed_ownership', title: 'Sengketa Kepemilikan / Sertifikat Bodong', desc: 'Properti dalam sengketa hukum, sertifikat ganda, atau status kepemilikan tanah tidak sah' },
      { id: 'fictitious_listing', title: 'Listing Fiktif / Menggunakan Foto Milik Pihak Lain', desc: 'Properti tidak ada di lokasi tertera, mencuri foto milik pihak lain, atau klaim agen palsu' },
      { id: 'spec_mismatch', title: 'Lokasi, Luas Tanah, atau Kondisi Bangunan Palsu', desc: 'Alamat/pin lokasi palsu, luas tanah/bangunan manipulasi, atau kondisi rusak fatal disembunyikan' },
      { id: 'hidden_hazard', title: 'Cacat Lingkungan Ekstrem / Tanpa Legalitas Izin (PBG/IMB)', desc: 'Daerah rawan bencana fatal ditutupi, atau bangunan dibangun tanpa izin konstruksi resmi' },
      { id: 'deposit_scam', title: 'Indikasi Penipuan Uang Muka (DP) / Booking Fee', desc: 'Memaksa transfer DP sebelum survey lokasi fisik atau skema pembayaran mencurigakan' },
      { id: 'other', title: 'Pelanggaran Lainnya pada Listing Properti', desc: 'Pelanggaran ketentuan listing properti lainnya yang tidak tercantum di atas' }
    ];
  }

  if (pType === 'fauna') {
    return [
      { id: 'protected_species', title: 'Satwa / Hewan Langka Dilindungi Undang-Undang', desc: 'Menawarkan hewan yang masuk daftar dilindungi (Apendiks CITES / regulasi KSDAE)' },
      { id: 'animal_cruelty', title: 'Indikasi Kekejaman / Kondisi Hewan Sakit atau Terlantar', desc: 'Hewan dipelihara dalam kondisi mengenaskan, sakit parah, stres berat, atau dieksploitasi' },
      { id: 'illegal_wildlife', title: 'Hasil Tangkapan Liar Ilegal / Tanpa Izin Tangkar (BKSDA)', desc: 'Hasil perburuan liar ilegal tanpa legalitas izin penangkaran atau dokumen resmi asal-usul' },
      { id: 'false_pedigree', title: 'Manipulasi Trah/Ras, Silsilah Bodong, atau Riwayat Palsu', desc: 'Pemalsuan silsilah (pedigree/stambum), buku vaksin palsu, atau foto indukan manipulatif' },
      { id: 'transit_cruelty', title: 'Metode Pengiriman Membahayakan Keselamatan Hidup', desc: 'Pengiriman lewat kurir non-khusus tanpa standar keselamatan hewan hidup' },
      { id: 'other', title: 'Pelanggaran Lainnya pada Hewan Peliharaan', desc: 'Pelanggaran ketentuan hewan lainnya yang tidak tercantum di atas' }
    ];
  }

  if (pType === 'plant') {
    return [
      { id: 'protected_flora', title: 'Tanaman Langka / Dilindungi Tanpa Izin Legal', desc: 'Menawarkan tanaman yang dilindungi undang-undang / Apendiks CITES tanpa sertifikat legalitas karantina sah' },
      { id: 'dead_withered', title: 'Tanaman Mati, Layu Parah, atau Rusak Saat Tiba', desc: 'Tanaman tiba dalam kondisi busuk akar parah, kering mati total, atau tidak ada penanganan garansi' },
      { id: 'pest_disease', title: 'Terinfeksi Hama / Penyakit Tanaman Menular Berbahaya', desc: 'Tanaman terbukti membawa kutu, jamur parasit, atau penyakit tumbuhan yang dapat menular luas' },
      { id: 'false_species', title: 'Spesies / Varietas Palsu (ID Tanaman Manipulatif)', desc: 'ID jenis bibit/varietas tidak sesuai, manipulasi varigata buatan, atau foto tanaman palsu' },
      { id: 'unsafe_packaging', title: 'Metode Packing Sembarangan / Tanpa Pelindung', desc: 'Pengiriman bibit hidup tanpa pengaman batang/akar memadai sehingga tanaman hancur' },
      { id: 'other', title: 'Pelanggaran Lainnya pada Tanaman', desc: 'Pelanggaran ketentuan tanaman lainnya yang tidak tercantum di atas' }
    ];
  }

  // Default: physical
  return [
    { id: 'counterfeit', title: 'Barang Tiruan / Tiruan Merek Resmi (KW)', desc: 'Produk tiruan, pemalsuan merek dagang resmi, atau pelanggaran hak cipta desain fisik' },
    { id: 'illegal_item', title: 'Komoditas Terlarang atau Ilegal Hukum', desc: 'Barang terlarang undang-undang, obat tanpa izin edar, atau barang sitaan/pasar gelap' },
    { id: 'misleading_info', title: 'Spesifikasi atau Kondisi Barang Tidak Sesuai', desc: 'Foto, merk, kondisi fisik (baru/bekas), atau kelengkapan barang manipulatif dan tidak akurat' },
    { id: 'price_manipulation', title: 'Manipulasi Harga atau Biaya Tersembunyi', desc: 'Harga jebakan tidak wajar, biaya fiktif yang memaksa, atau mark-up di luar kesepakatan' },
    { id: 'defective_hazard', title: 'Barang Cacat Fatal, Rekondisi Diam-diam, atau Berbahaya', desc: 'Produk rusak parah, barang rekondisi dijual sebagai baru, atau membahayakan keselamatan' },
    { id: 'other', title: 'Pelanggaran Lainnya pada Item Fisik', desc: 'Pelanggaran pada item produk fisik lainnya yang tidak tercantum di atas' }
  ];
}

export function getReportingSectorInfo(targetType: 'store' | 'item', item?: any): { label: string; color: string; icon: any } {
  if (targetType === 'store') {
    return { label: 'Profil & Identitas Katalog', color: '#6366f1', icon: Store };
  }
  const pType = String(item?.product_type || item?.type || item?.attributes?.product_type || 'physical').trim().toLowerCase();
  switch (pType) {
    case 'service': return { label: 'Layanan Jasa', color: '#0284c7', icon: Briefcase };
    case 'food': return { label: 'Kuliner & F&B', color: '#ea580c', icon: Utensils };
    case 'digital': return { label: 'Produk Digital', color: '#8b5cf6', icon: Smartphone };
    case 'property': return { label: 'Properti & Real Estate', color: '#0d9488', icon: Building2 };
    case 'fauna': return { label: 'Hewan', color: 'var(--primary)', icon: PawPrint };
    case 'plant': return { label: 'Tanaman', color: 'var(--primary)', icon: Sprout };
    default: return { label: 'Produk Fisik', color: '#e11d48', icon: Package };
  }
}

export interface TabletReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: { type: 'store' | 'item'; item?: any } | null;
  storeSettings: any;
  storeSlug: string;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const TabletReportModal: React.FC<TabletReportModalProps> = ({
  isOpen,
  onClose,
  reportData,
  storeSettings,
  storeSlug,
  onToast
}) => {
  const [reportReason, setReportReason] = useState<string>('');
  const [reportNotes, setReportNotes] = useState<string>('');
  const [reportEmail, setReportEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const reasonList = useMemo(() => {
    if (!reportData) return [];
    return getCatalogReportReasons(reportData.type, reportData.item);
  }, [reportData]);

  const sectorInfo = useMemo(() => {
    if (!reportData) return { label: 'Profil', color: '#6366f1', icon: Store };
    return getReportingSectorInfo(reportData.type, reportData.item);
  }, [reportData]);

  const SectorIcon = sectorInfo.icon;

  const targetTitle = useMemo(() => {
    if (!reportData) return '';
    return reportData.type === 'store'
      ? (storeSettings?.store_title ? `Katalog ${storeSettings.store_title}` : 'Profil Katalog Toko Ini')
      : (reportData.item?.name || 'Item Katalog');
  }, [reportData, storeSettings]);

  // Set default reason when reportData changes
  useEffect(() => {
    if (reasonList.length > 0) {
      setReportReason(reasonList[0].id);
    }
    setReportNotes('');
    setReportEmail('');
  }, [reportData, reasonList]);

  if (!isOpen || !reportData) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentReasonObj = reasonList.find(r => r.id === reportReason);
    const reasonLabel = currentReasonObj ? currentReasonObj.title : 'Pelanggaran Ketentuan';

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: reportData.type === 'store' ? 'catalog' : 'item',
          store_id: storeSettings?.id || 0,
          store_slug: storeSlug || '',
          store_title: storeSettings?.store_title || 'Katalog Digital',
          fauna_id: reportData.type === 'item' ? reportData.item?.id : null,
          item_name: reportData.type === 'item' ? reportData.item?.name : null,
          reason_category: reportReason,
          reason_label: reasonLabel,
          description: reportNotes.trim(),
          reporter_email: reportEmail.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        onClose();
        setReportNotes('');
        setReportEmail('');
        onToast(`Terima kasih. Laporan #${data.data?.report_number || ''} untuk "${targetTitle}" telah berhasil dikirim ke tim kepatuhan.`, 'success');
      } else {
        onToast(data.message || 'Gagal mengirim laporan. Silakan coba lagi.', 'error');
      }
    } catch (err) {
      onToast('Terjadi gangguan jaringan saat mengirim laporan. Silakan coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{ 
        position: 'fixed',
        inset: 0,
        zIndex: 1000, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '1.25rem'
      }}
    >
      <div 
        className="animate-scale-up" 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          height: 'auto',
          maxHeight: 'min(90vh, 760px)',
          borderRadius: '16px',
          border: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-card)',
          boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.28), 0 8px 24px -6px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Pinned Fixed Header */}
        <div style={{
          flexShrink: 0,
          padding: '1.2rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-card)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
              flexShrink: 0
            }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main, var(--text-primary))', margin: 0, letterSpacing: '-0.01em' }}>
                {reportData.type === 'store' ? 'Laporkan Profil Katalog' : 'Laporkan Item Katalog'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                Pilih alasan pelanggaran yang paling relevan untuk ditinjau Tim Kepatuhan
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            aria-label="Tutup Modal"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-card-hover)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div 
          className="modal-content-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}
        >
          {/* Target Entity Summary Card */}
          <div style={{
            padding: '0.75rem 0.95rem',
            backgroundColor: 'var(--bg-card-hover)',
            borderRadius: '10px',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            {reportData.type === 'item' ? (
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                flexShrink: 0
              }}>
                <img 
                  src={reportData.item?.image_url || '/placeholder.png'} 
                  alt={reportData.item?.name || ''} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ) : (
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6366f1',
                flexShrink: 0
              }}>
                <Store size={22} />
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.15rem' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444'
                }}>
                  <SectorIcon size={12} />
                  <span>{sectorInfo.label}</span>
                </span>
                {reportData.item?.class && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    • {reportData.item.class}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: 'var(--text-main, var(--text-primary))',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {targetTitle}
              </div>
            </div>
          </div>

          {/* Section: Alasan Pelaporan */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.55rem' }}>
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--text-main, var(--text-primary))',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                Alasan Pelaporan *
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                Disesuaikan untuk {sectorInfo.label}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {reasonList.map((reason) => {
                const isSelected = reportReason === reason.id;
                return (
                  <div
                    key={reason.id}
                    onClick={() => setReportReason(reason.id)}
                    style={{
                      minHeight: '44px',
                      padding: '0.85rem 1rem',
                      borderRadius: '10px',
                      border: isSelected ? '1.5px solid #ef4444' : '1px solid var(--border-light)',
                      backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.04)' : 'var(--bg-card)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 2px 8px rgba(239, 68, 68, 0.08)' : 'none'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.86rem',
                        fontWeight: 600,
                        color: isSelected ? '#ef4444' : 'var(--text-main, var(--text-primary))',
                        lineHeight: 1.35
                      }}>
                        {reason.title}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        marginTop: '0.2rem',
                        lineHeight: 1.35
                      }}>
                        {reason.desc}
                      </div>
                    </div>

                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: isSelected ? 'none' : '1.5px solid var(--border-focus, #94a3b8)',
                      backgroundColor: isSelected ? '#ef4444' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                      transition: 'all 0.15s ease'
                    }}>
                      {isSelected && <Check size={12} strokeWidth={3.5} color="#fff" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Keterangan Tambahan */}
          <div>
            <label style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--text-main, var(--text-primary))',
              display: 'block',
              marginBottom: '0.45rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              Keterangan Tambahan (Opsional)
            </label>
            <textarea
              placeholder="Jelaskan rincian atau bukti pelanggaran yang Anda temukan untuk mempermudah investigasi..."
              value={reportNotes}
              onChange={(e) => setReportNotes(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-deep, var(--bg-card))',
                color: 'var(--text-main, var(--text-primary))',
                resize: 'none',
                fontSize: '0.84rem',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease'
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
            />
          </div>

          {/* Section: Email Pelapor */}
          <div>
            <label style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--text-main, var(--text-primary))',
              display: 'block',
              marginBottom: '0.45rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              Email Pelapor (Opsional)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                placeholder="email@anda.com"
                value={reportEmail}
                onChange={(e) => setReportEmail(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  padding: '0.65rem 0.75rem 0.65rem 2.4rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-deep, var(--bg-card))',
                  color: 'var(--text-main, var(--text-primary))',
                  fontSize: '0.84rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease'
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
              />
              <Mail size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0 0' }}>
              Digunakan tim kepatuhan untuk mengirimkan notifikasi status tindak lanjut penanganan laporan.
            </p>
          </div>
        </div>

        {/* Pinned Sticky Footer */}
        <div style={{
          flexShrink: 0,
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            <ShieldCheck size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
            <span>Laporan dijamin kerahasiaannya dan ditinjau secara objektif oleh Tim Kepatuhan.</span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                flex: 1,
                minHeight: '44px',
                padding: '0 1rem',
                fontSize: '0.86rem',
                fontWeight: 600,
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-card-hover)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Batal
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              style={{
                flex: 2,
                minHeight: '44px',
                padding: '0 1.25rem',
                fontSize: '0.88rem',
                fontWeight: 700,
                borderRadius: '8px',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 2px 10px rgba(239, 68, 68, 0.3)',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                transition: 'all 0.15s ease'
              }}
            >
              <Send size={15} />
              <span>{isSubmitting ? 'Mengirim...' : 'Kirim Laporan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TabletReportModal;

