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

export interface TabletShareCatalogViewProps {
  storeSlug: string;
  storeTitle?: string;
  storeLogoUrl?: string;
  storeSlogan?: string;
  whatsappNumber?: string;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info' | any) => void;
}

export const TabletShareCatalogView: React.FC<TabletShareCatalogViewProps> = ({
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
    ? `https://api.qrserver.com/v1/create-qr-code/?size=380x380&data=${encodeURIComponent(fullUrl)}&color=0b0e0c&bgcolor=ffffff&margin=12`
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
        // User cancelled dialog
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div 
      className="animate-fade-in"
      style={{
        padding: '1.75rem',
        maxWidth: '1000px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        overflowY: 'auto',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        paddingBottom: '5rem'
      }}
    >
      {/* Header Info */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '1rem',
          padding: '1.25rem 1.5rem'
        }}
      >
        <div 
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '0.65rem',
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Bagikan Profil Katalog Digital
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
            Promosikan etalase bisnis Anda dengan tautan langsung atau unduh QR Code resmi siap cetak.
          </p>
        </div>
      </div>

      {/* Main Grid: Card QR & Card Promotional */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
          alignItems: 'start'
        }}
      >
        {/* Pass Card with QR Code */}
        <div 
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1.25rem',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
            boxShadow: 'var(--shadow-premium)'
          }}
        >
          {/* Store Brand */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.35rem' }}>
            {storeLogoUrl ? (
              <img 
                src={storeLogoUrl} 
                alt={storeTitle} 
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--primary)',
                  boxShadow: '0 4px 12px var(--primary-glow)'
                }}
              />
            ) : (
              <div 
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-glow)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1.3rem',
                  border: '1px solid var(--border-light)'
                }}
              >
                {(storeTitle || 'C').charAt(0).toUpperCase()}
              </div>
            )}

            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.15rem 0 0 0' }}>
              {storeTitle || 'Katalog Digital'}
            </h3>

            {storeSlogan && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4, maxWidth: '280px' }}>
                {storeSlogan}
              </p>
            )}
          </div>

          {/* QR Code Container */}
          <div 
            style={{
              padding: '1rem',
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <img 
              src={qrImageUrl} 
              alt={`QR Code Katalog ${storeTitle || ''}`}
              style={{ width: '190px', height: '190px', borderRadius: '0.4rem', display: 'block' }}
            />
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginTop: '0.5rem' }}>
              Pindai kamera untuk membuka etalase
            </span>
          </div>

          {/* Public Link Pill */}
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.76rem',
              color: 'var(--primary)',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.95rem',
              backgroundColor: 'var(--primary-glow)',
              border: '1px solid var(--border-light)',
              borderRadius: '999px',
              wordBreak: 'break-all',
              maxWidth: '100%'
            }}
          >
            <span>{fullUrl.replace(/^https?:\/\//, '')}</span>
            <ExternalLink size={12} />
          </a>

          {/* Action Buttons: Touch Friendly (Min Height 44px) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', width: '100%', marginTop: '0.2rem' }}>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              style={{
                minHeight: '44px',
                padding: '0.6rem 0.4rem',
                fontSize: '0.76rem',
                fontWeight: 800,
                borderRadius: '0.6rem',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                cursor: 'pointer'
              }}
              title="Unduh QR Code HD"
            >
              <Download size={15} />
              <span>{downloading ? '...' : 'Unduh QR'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              style={{
                minHeight: '44px',
                padding: '0.6rem 0.4rem',
                fontSize: '0.76rem',
                fontWeight: 800,
                borderRadius: '0.6rem',
                backgroundColor: 'var(--bg-card-hover)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                cursor: 'pointer'
              }}
              title="Salin Tautan"
            >
              {copied ? <Check size={15} style={{ color: '#10b981' }} /> : <Copy size={15} />}
              <span>{copied ? 'Tersalin' : 'Salin'}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              style={{
                minHeight: '44px',
                padding: '0.6rem 0.4rem',
                fontSize: '0.76rem',
                fontWeight: 800,
                borderRadius: '0.6rem',
                backgroundColor: 'var(--bg-card-hover)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                cursor: 'pointer'
              }}
              title="Bagikan"
            >
              <Share2 size={15} />
              <span>Bagikan</span>
            </button>
          </div>
        </div>

        {/* Right Side: Digital & Offline Placement Guides */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Card: Digital & Offline Guides */}
          <div 
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '1.25rem',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div 
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '0.6rem',
                  backgroundColor: 'var(--primary-glow)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-light)'
                }}
              >
                <Globe size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Saluran Rekomendasi
                </h4>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Saran penempatan tautan & poster QR Code
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div 
                style={{
                  padding: '0.75rem 0.95rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem'
                }}
              >
                <Smartphone size={16} style={{ color: 'var(--primary)', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>Bio Instagram & TikTok</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Sematkan link ini di bio media sosial agar pelanggan bisa langsung belanja.
                  </div>
                </div>
              </div>

              <div 
                style={{
                  padding: '0.75rem 0.95rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem'
                }}
              >
                <Store size={16} style={{ color: 'var(--primary)', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>Google Profil Bisnis (GBP)</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Cantumkan URL ini sebagai situs web resmi di profil Google Maps bisnis Anda.
                  </div>
                </div>
              </div>

              <div 
                style={{
                  padding: '0.75rem 0.95rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem'
                }}
              >
                <Printer size={16} style={{ color: '#3b82f6', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>Meja Kasir & Kemasan Cetak</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Pajang QR Code di kasir (tent card) atau cetak stiker pada kemasan pengiriman.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TabletShareCatalogView;
