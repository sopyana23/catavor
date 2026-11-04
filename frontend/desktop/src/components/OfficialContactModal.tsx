import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Headphones,
  MessageSquare,
  Mail,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  X
} from 'lucide-react';

export interface OfficialContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  platformSettings?: Record<string, string>;
}

export const OfficialContactModal: React.FC<OfficialContactModalProps> = ({
  isOpen,
  onClose,
  showToast,
  platformSettings
}) => {
  const [copiedType, setCopiedType] = useState<'wa' | 'email' | null>(null);
  const [internalSettings, setInternalSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Dynamically fetch platform contact settings if not provided by parent
  useEffect(() => {
    if (!isOpen) return;
    if (platformSettings && (platformSettings.platform_official_whatsapp || platformSettings.contact_whatsapp || platformSettings.platform_official_email || platformSettings.contact_email)) {
      return;
    }

    let isMounted = true;
    fetch('/api/settings')
      .then(res => res.json())
      .then(json => {
        if (isMounted && json && json.success && json.data) {
          setInternalSettings(json.data);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isOpen, platformSettings]);

  if (!isOpen) return null;

  const activeSettings = platformSettings && (platformSettings.platform_official_whatsapp || platformSettings.contact_whatsapp || platformSettings.platform_official_email)
    ? platformSettings
    : { ...internalSettings, ...platformSettings };

  const rawWa = (activeSettings.platform_official_whatsapp || activeSettings.contact_whatsapp || activeSettings.rekber_wa_number || '62811220227').trim();
  const digitsOnly = rawWa.replace(/\D/g, '');
  const cleanDigits = digitsOnly.startsWith('0') ? '62' + digitsOnly.slice(1) : digitsOnly.startsWith('8') ? '62' + digitsOnly : digitsOnly || '62811220227';
  const WA_CLEAN = cleanDigits;

  const formatWaNumber = (digits: string): string => {
    if (!digits) return '+62 811-2202-27';
    if (digits.startsWith('62')) {
      const national = digits.slice(2);
      if (national.length <= 4) return `+62 ${national}`;
      if (national.length <= 8) return `+62 ${national.slice(0, 3)}-${national.slice(3)}`;
      return `+62 ${national.slice(0, 3)}-${national.slice(3, 7)}-${national.slice(7)}`;
    }
    return `+${digits}`;
  };

  const WA_NUMBER = formatWaNumber(cleanDigits);
  const EMAIL_ADDRESS = (activeSettings.platform_official_email || activeSettings.contact_email || 'support@catavor.com').trim().toLowerCase();

  const handleCopy = (text: string, type: 'wa' | 'email') => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedType(type);
      if (showToast) {
        showToast(type === 'wa' ? 'Nomor WhatsApp resmi berhasil disalin.' : 'Alamat email resmi berhasil disalin.', 'success');
      }
      setTimeout(() => setCopiedType(null), 2200);
    } catch {
      if (showToast) showToast('Gagal menyalin ke clipboard.', 'error');
    }
  };

  const handleOpenWA = () => {
    window.open(`https://wa.me/${WA_CLEAN}?text=${encodeURIComponent('Halo Tim Bantuan Catavor, saya memerlukan informasi layanan katalog.')}`, '_blank', 'noopener,noreferrer');
  };

  const handleOpenEmail = () => {
    window.open(`mailto:${EMAIL_ADDRESS}?subject=${encodeURIComponent('Permintaan Bantuan Pengelolaan Katalog Catavor')}`, '_blank', 'noopener,noreferrer');
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '2rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="glass-panel animate-scale-up"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-card, #1e293b)',
          borderRadius: '1.25rem',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          color: 'var(--text-primary, #ffffff)',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Top Header (Pinned at top - Never sinks on scroll) */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 2rem',
            backgroundColor: 'var(--bg-card, #1e293b)',
            borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.18)',
            zIndex: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '0.9rem',
                backgroundColor: 'var(--primary-glow, rgba(2, 132, 199, 0.15))',
                border: '1px solid var(--border-light, rgba(2, 132, 199, 0.35))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary, #0284c7)',
                flexShrink: 0
              }}
            >
              <Headphones size={24} strokeWidth={1.75} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  color: 'var(--text-primary, #ffffff)',
                  letterSpacing: '-0.01em'
                }}
              >
                Kontak Resmi Catavor
              </h3>
              <span
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary, #94a3b8)',
                  marginTop: '0.15rem',
                  display: 'block'
                }}
              >
                Saluran bantuan &amp; komunikasi resmi platform terverifikasi
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '0.55rem',
              border: 'none',
              backgroundColor: 'var(--bg-deep, rgba(255, 255, 255, 0.05))',
              color: 'var(--text-secondary, #94a3b8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Tutup (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content Body (Content scrolls underneath the floating header) */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            padding: '1.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxSizing: 'border-box'
          }}
        >

        {/* Channel 1: WhatsApp */}
        <div
          style={{
            padding: '1.05rem 1.25rem',
            borderRadius: '0.95rem',
            backgroundColor: 'var(--bg-deep, rgba(0, 0, 0, 0.2))',
            border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '0.65rem',
                backgroundColor: 'rgba(16, 185, 129, 0.14)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
                flexShrink: 0
              }}
            >
              <MessageSquare size={19} strokeWidth={1.75} />
            </div>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)' }}>
              WhatsApp CS
            </span>
          </div>

          <div
            style={{
              padding: '0.65rem 0.95rem',
              borderRadius: '0.65rem',
              backgroundColor: 'var(--bg-card, rgba(255, 255, 255, 0.04))',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'monospace',
              fontSize: '0.95rem',
              fontWeight: 700,
              color: 'var(--text-primary, #ffffff)'
            }}
          >
            <span>{WA_NUMBER}</span>
          </div>

          {/* Action Buttons Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handleOpenWA}
              style={{
                minHeight: '44px',
                padding: '0.65rem 1.25rem',
                borderRadius: '0.65rem',
                backgroundColor: '#16a34a',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.86rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(22, 163, 74, 0.3)',
                transition: 'all 0.15s ease'
              }}
            >
              <ExternalLink size={16} />
              <span>Buka WhatsApp Web / Aplikasi</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopy(WA_NUMBER, 'wa')}
              style={{
                minHeight: '44px',
                padding: '0.65rem 1.15rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--bg-card, rgba(255, 255, 255, 0.06))',
                color: 'var(--text-primary, #ffffff)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Salin Nomor WhatsApp"
            >
              {copiedType === 'wa' ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
              <span>{copiedType === 'wa' ? 'Tersalin!' : 'Salin Nomor'}</span>
            </button>
          </div>
        </div>

        {/* Channel 2: Email */}
        <div
          style={{
            padding: '1.05rem 1.25rem',
            borderRadius: '0.95rem',
            backgroundColor: 'var(--bg-deep, rgba(0, 0, 0, 0.2))',
            border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--primary-glow, rgba(2, 132, 199, 0.14))',
                border: '1px solid var(--border-light, rgba(2, 132, 199, 0.35))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary, #0284c7)',
                flexShrink: 0
              }}
            >
              <Mail size={19} strokeWidth={1.75} />
            </div>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)' }}>
              Email Layanan
            </span>
          </div>

          <div
            style={{
              padding: '0.65rem 0.95rem',
              borderRadius: '0.65rem',
              backgroundColor: 'var(--bg-card, rgba(255, 255, 255, 0.04))',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'monospace',
              fontSize: '0.95rem',
              fontWeight: 700,
              color: 'var(--text-primary, #ffffff)'
            }}
          >
            <span>{EMAIL_ADDRESS}</span>
          </div>

          {/* Action Buttons Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handleOpenEmail}
              style={{
                minHeight: '44px',
                padding: '0.65rem 1.25rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--primary, #0284c7)',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.86rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                boxShadow: '0 2px 10px var(--primary-glow, rgba(2, 132, 199, 0.3))',
                transition: 'all 0.15s ease'
              }}
            >
              <ExternalLink size={16} />
              <span>Buka Aplikasi Email</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopy(EMAIL_ADDRESS, 'email')}
              style={{
                minHeight: '44px',
                padding: '0.65rem 1.15rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--bg-card, rgba(255, 255, 255, 0.06))',
                color: 'var(--text-primary, #ffffff)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Salin Alamat Email"
            >
              {copiedType === 'email' ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
              <span>{copiedType === 'email' ? 'Tersalin!' : 'Salin Email'}</span>
            </button>
          </div>
        </div>

        {/* Security Assurance Notice */}
        <div
          style={{
            padding: '0.9rem 1.15rem',
            borderRadius: '0.85rem',
            backgroundColor: 'rgba(2, 132, 199, 0.06)',
            border: '1px solid var(--border-light, rgba(2, 132, 199, 0.2))',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem'
          }}
        >
          <ShieldCheck size={20} style={{ color: 'var(--primary, #0284c7)', flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary, #ffffff)' }}>Perlindungan Keamanan:</strong> Tim Catavor tidak pernah meminta kata sandi akun Anda atau pengiriman pembayaran di luar invoice resmi. Pastikan selalu berkomunikasi hanya melalui kontak terverifikasi di atas.
          </p>
        </div>

        </div>

        {/* Floating / Pinned Bottom Footer Bar */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '1rem 2rem 1.25rem',
            backgroundColor: 'var(--bg-card, #1e293b)',
            borderTop: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.15)',
            zIndex: 10
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              minHeight: '44px',
              padding: '0.65rem 1.75rem',
              borderRadius: '0.65rem',
              backgroundColor: 'var(--bg-deep, rgba(255, 255, 255, 0.06))',
              color: 'var(--text-primary, #ffffff)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
