import React, { useState, useMemo } from 'react';
import { 
  Share2, 
  Download, 
  Copy, 
  Check, 
  ExternalLink, 
  Globe, 
  Printer, 
  Smartphone,
  Store
} from 'lucide-react';

export interface DesktopShareCatalogViewProps {
  storeSlug: string;
  storeTitle?: string;
  storeLogoUrl?: string;
  storeSlogan?: string;
  whatsappNumber?: string;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info' | any) => void;
}

export const DesktopShareCatalogView: React.FC<DesktopShareCatalogViewProps> = ({
  storeSlug,
  storeTitle,
  storeLogoUrl,
  storeSlogan,
  whatsappNumber,
  onToast
}) => {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fullUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      if (!storeSlug) return '';
      return `${window.location.origin}/${storeSlug}`;
    }
    if (!storeSlug) return '';
    return `https://catavor.id/${storeSlug}`;
  }, [storeSlug]);

  const qrImageUrl = fullUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(fullUrl)}&color=0b0e0c&bgcolor=ffffff&margin=12`
    : '';

  const handleDownload = async () => {
    if (!qrImageUrl) {
      if (onToast) onToast('Slug katalog belum tersedia, QR tidak dapat dibuat.', 'error');
      return;
    }
    setDownloading(true);
    try {
      const res = await fetch(qrImageUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `qrcode-${(storeSlug || 'katalog').toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      if (onToast) onToast('Gambar QR Code berhasil diunduh (PNG HD)!', 'success');
    } catch (err) {
      window.open(qrImageUrl, '_blank');
      if (onToast) onToast('Membuka QR Code di tab baru...', 'info');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = () => {
    if (!fullUrl) {
      if (onToast) onToast('Slug katalog belum tersedia, tautan tidak dapat disalin.', 'error');
      return;
    }
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    if (onToast) onToast('Tautan katalog berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: storeTitle || 'Katalog Digital',
          text: `Scan atau buka katalog ${storeTitle || 'Catavor'} secara digital:`,
          url: fullUrl
        });
      } catch (e) {
        // User cancelled share dialog
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div 
      className="animate-fade-in"
      style={{
        width: '100%',
        maxWidth: '1240px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.75rem',
        paddingBottom: '3rem'
      }}
    >
      {/* Header Banner */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '1rem',
          padding: '1.25rem 1.75rem',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div 
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '0.75rem',
            backgroundColor: 'var(--primary-glow)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-light)',
            flexShrink: 0
          }}
        >
          <Share2 size={22} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Bagikan Profil & QR Code Katalog
          </h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0', lineHeight: 1.5 }}>
            Promosikan etalase bisnis Anda kepada pelanggan melalui tautan resmi langsung, poster QR Code siap cetak, dan saluran digital.
          </p>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(360px, 420px) 1fr',
          gap: '1.75rem',
          alignItems: 'start'
        }}
      >
        {/* Left Column: Official Poster Pass Card */}
        <div 
          className="glass-panel"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1.25rem',
            padding: '2rem 1.75rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.4rem',
            boxShadow: '0 12px 35px rgba(0, 0, 0, 0.25)',
            position: 'sticky',
            top: '80px'
          }}
        >
          {/* Brand Info */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.4rem', width: '100%' }}>
            {storeLogoUrl ? (
              <img 
                src={storeLogoUrl} 
                alt={storeTitle} 
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2.5px solid var(--primary)',
                  boxShadow: '0 4px 14px var(--primary-glow)'
                }}
              />
            ) : (
              <div 
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-glow)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1.4rem',
                  border: '1px solid var(--border-light)'
                }}
              >
                {(storeTitle || 'C').charAt(0).toUpperCase()}
              </div>
            )}

            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.2rem 0 0 0' }}>
              {storeTitle || 'Katalog Digital'}
            </h3>

            {storeSlogan && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4, maxWidth: '320px' }}>
                {storeSlogan}
              </p>
            )}
          </div>

          {/* QR Code Canvas Frame */}
          <div 
            style={{
              padding: '1.15rem',
              backgroundColor: '#ffffff',
              borderRadius: '1.1rem',
              boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
              border: '1px solid rgba(255,255,255,0.6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            {qrImageUrl ? (
              <img 
                src={qrImageUrl} 
                alt={`QR Code Katalog ${storeTitle || ''}`}
                style={{ width: '220px', height: '220px', borderRadius: '0.5rem', display: 'block' }}
              />
            ) : (
              <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                Memuat QR Code...
              </div>
            )}
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginTop: '0.65rem' }}>
              Arahkan kamera ponsel untuk memindai
            </span>
          </div>

          {/* URL Pill Badge */}
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.78rem',
              color: 'var(--primary)',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 1rem',
              backgroundColor: 'var(--primary-glow)',
              border: '1px solid var(--border-light)',
              borderRadius: '999px',
              wordBreak: 'break-all',
              maxWidth: '100%',
              transition: 'all 0.15s ease'
            }}
          >
            <span>{fullUrl.replace(/^https?:\/\//, '')}</span>
            <ExternalLink size={13} />
          </a>

          {/* Action Buttons Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.55rem', width: '100%', marginTop: '0.25rem' }}>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="btn-primary"
              style={{
                padding: '0.65rem 0.5rem',
                fontSize: '0.78rem',
                fontWeight: 800,
                borderRadius: '0.6rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                cursor: 'pointer'
              }}
              title="Unduh berkas gambar QR Code PNG resolusi tinggi"
            >
              <Download size={15} />
              <span>{downloading ? 'Mengunduh...' : 'Unduh QR'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="btn-secondary"
              style={{
                padding: '0.65rem 0.5rem',
                fontSize: '0.78rem',
                fontWeight: 800,
                borderRadius: '0.6rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                cursor: 'pointer'
              }}
              title="Salin alamat link toko ke clipboard"
            >
              {copied ? <Check size={15} style={{ color: '#10b981' }} /> : <Copy size={15} />}
              <span>{copied ? 'Tersalin!' : 'Salin Link'}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="btn-secondary"
              style={{
                padding: '0.65rem 0.5rem',
                fontSize: '0.78rem',
                fontWeight: 800,
                borderRadius: '0.6rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                cursor: 'pointer'
              }}
              title="Buka dialog bagikan sistem operasi"
            >
              <Share2 size={15} />
              <span>Bagikan</span>
            </button>
          </div>
        </div>

        {/* Right Column: Promotional Channels & Publication Guide */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Card 1: Digital Channels Best Practices */}
          <div 
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '1.25rem',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div 
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--primary-glow)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-light)'
                }}
              >
                <Globe size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Optimalisasi Saluran Pemasaran Digital
                </h3>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Maksimalkan jangkauan pelanggan dengan menyematkan tautan katalog di media sosial
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div 
                style={{
                  padding: '1rem',
                  borderRadius: '0.85rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  <Smartphone size={16} style={{ color: 'var(--primary)' }} />
                  <span>Bio Instagram & TikTok</span>
                </div>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                  Ganti tautan bio akun profil bisnis Anda dengan tautan katalog resmi. Pengunjung profil dapat langsung melihat daftar item & harga tanpa bertanya manual.
                </p>
              </div>

              <div 
                style={{
                  padding: '1rem',
                  borderRadius: '0.85rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  <Store size={16} style={{ color: 'var(--primary)' }} />
                  <span>Google Profil Bisnis (GBP)</span>
                </div>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                  Cantumkan URL ini sebagai situs web resmi di listing Google Maps Anda untuk mendatangkan pencarian lokal dari pelanggan di sekitar Anda.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Offline Physical Placement Guide */}
          <div 
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '1.25rem',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div 
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '0.65rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(59, 130, 246, 0.25)'
                }}
              >
                <Printer size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Panduan Media Cetak & Lokasi Fisik
                </h3>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Gunakan berkas unduhan QR Code PNG HD untuk berbagai media cetak promosi
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem' }}>
              <div 
                style={{
                  padding: '0.95rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Meja Kasir & Akrilik
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Cetak ukuran A5/A6 dan pajang di atas meja kasir atau etalase toko untuk scan langsung.
                </span>
              </div>

              <div 
                style={{
                  padding: '0.95rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Stiker Kemasan Produk
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Tempelkan pada box paket pengiriman, paper bag, atau kartu ucapan terima kasih (*Thank You Card*).
                </span>
              </div>

              <div 
                style={{
                  padding: '0.95rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Kartu Nama & Brosur
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Sertakan QR Code di bagian belakang kartu nama atau pojok brosur promo mingguan Anda.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopShareCatalogView;
