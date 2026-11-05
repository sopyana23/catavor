import React, { useState, useMemo } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  Share2, 
  ExternalLink 
} from 'lucide-react';

export interface TabletQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeSlug: string;
  storeTitle?: string;
  storeLogoUrl?: string;
  storeSlogan?: string;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const TabletQRCodeModal: React.FC<TabletQRCodeModalProps> = ({
  isOpen,
  onClose,
  storeSlug,
  storeTitle,
  storeLogoUrl,
  storeSlogan,
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

  // Tanpa slug tidak ada URL sah, jadi QR tidak dibuat sama sekali
  const qrImageUrl = fullUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(fullUrl)}&color=0b0e0c&bgcolor=ffffff&margin=12`
    : '';

  if (!isOpen) return null;

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
      if (onToast) onToast('Slug katalog belum tersedia, link tidak dapat disalin.', 'error');
      return;
    }
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    if (onToast) onToast('Link katalog berhasil disalin ke clipboard!', 'success');
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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div 
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '1.25rem',
          padding: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
          position: 'relative',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'var(--bg-card-hover)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-secondary)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <X size={18} />
        </button>

        {/* Store Header Info */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
          {storeLogoUrl ? (
            <img 
              src={storeLogoUrl} 
              alt={storeTitle} 
              style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
            />
          ) : (
            <div style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', border: '1px solid var(--border-light)' }}>
              {(storeTitle || 'C').charAt(0).toUpperCase()}
            </div>
          )}
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            {storeTitle || 'Katalog Digital'}
          </h3>
          {storeSlogan && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {storeSlogan}
            </span>
          )}
        </div>

        {/* QR Code Frame */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.25rem', backgroundColor: '#ffffff', borderRadius: '1rem', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', border: '1px solid var(--border-light)' }}>
          <img 
            src={qrImageUrl} 
            alt={`QR Code Katalog ${storeTitle || ''}`}
            style={{ width: '210px', height: '210px', borderRadius: '0.5rem', display: 'block' }}
          />
        </div>

        {/* Catalog Link */}
        <a 
          href={fullUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{ 
            fontSize: '0.82rem', 
            color: 'var(--primary)', 
            fontWeight: 700, 
            textDecoration: 'none', 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.35rem', 
            padding: '0.45rem 1rem',
            backgroundColor: 'var(--primary-glow)',
            border: '1px solid var(--border-light)',
            borderRadius: '2rem',
            wordBreak: 'break-all', 
            textAlign: 'center',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fullUrl.replace(/^https?:\/\//, '')}
          </span>
          <ExternalLink size={13} style={{ flexShrink: 0 }} />
        </a>

        {/* Action Buttons - minHeight 44px for Tablet Touch Standard */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', width: '100%' }}>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="btn-primary"
            style={{ minHeight: '44px', padding: '0.65rem 0.5rem', fontSize: '0.8rem', fontWeight: 800, borderRadius: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', cursor: 'pointer' }}
          >
            <Download size={15} />
            <span>{downloading ? 'Unduh...' : 'Unduh QR'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="btn-secondary"
            style={{ minHeight: '44px', padding: '0.65rem 0.5rem', fontSize: '0.8rem', fontWeight: 800, borderRadius: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', cursor: 'pointer' }}
          >
            {copied ? <Check size={15} style={{ color: '#10b981' }} /> : <Copy size={15} />}
            <span>{copied ? 'Tersalin!' : 'Salin Link'}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="btn-secondary"
            style={{ minHeight: '44px', padding: '0.65rem 0.5rem', fontSize: '0.8rem', fontWeight: 800, borderRadius: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', cursor: 'pointer' }}
          >
            <Share2 size={15} />
            <span>Bagikan</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TabletQRCodeModal;

