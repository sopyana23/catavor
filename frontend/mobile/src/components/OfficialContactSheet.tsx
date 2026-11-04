import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Headphones,
  MessageSquare,
  Mail,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { useModalBackHandler } from '../utils/navigation';

export interface OfficialContactSheetProps {
  isOpen: boolean;
  onClose: () => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  platformSettings?: Record<string, string>;
}

export const OfficialContactSheet: React.FC<OfficialContactSheetProps> = ({
  isOpen,
  onClose,
  showToast,
  platformSettings
}) => {
  const [copiedType, setCopiedType] = useState<'wa' | 'email' | null>(null);
  const [internalSettings, setInternalSettings] = useState<Record<string, string>>({});

  // Gesture drag physics states
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dragStartY = useRef(0);

  const closeWithAnimation = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setDragY(0);
      onClose();
    }, 280);
  };

  useModalBackHandler({
    isOpen,
    onClose: closeWithAnimation,
    modalId: 'mobile-official-contact-sheet'
  });

  const handleDragStart = (clientY: number) => {
    dragStartY.current = clientY;
    setIsDragging(true);
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return;
    const delta = clientY - dragStartY.current;
    if (delta > 0) {
      setDragY(delta);
    } else {
      setDragY(delta * 0.15); // Rubber banding
    }
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragY > 70) {
      closeWithAnimation();
    } else {
      setDragY(0);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeWithAnimation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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

  if (!isOpen && !isClosing) return null;

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
        flexDirection: 'column',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        opacity: isClosing ? 0 : 1,
        transition: 'opacity 0.28s ease',
        touchAction: 'none'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeWithAnimation();
        }
      }}
    >
      <div
        style={{
          width: '100%',
          maxHeight: '88vh',
          backgroundColor: 'var(--bg-card, #1e293b)',
          borderRadius: '1.25rem 1.25rem 0 0',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
          borderBottom: 'none',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          color: 'var(--text-primary, #ffffff)',
          transform: isClosing ? 'translateY(100%)' : `translateY(${Math.max(0, dragY)}px)`,
          transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Top Header (Always Floating / Mengambang - Bebas Tenggelam) */}
        <div
          onMouseDown={e => handleDragStart(e.clientY)}
          onMouseMove={e => handleDragMove(e.clientY)}
          onMouseUp={handleDragEnd}
          onTouchStart={e => handleDragStart(e.touches[0].clientY)}
          onTouchMove={e => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
          style={{
            flexShrink: 0,
            padding: '0.65rem 1.25rem 0.85rem',
            backgroundColor: 'var(--bg-card, #1e293b)',
            borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            touchAction: 'none',
            zIndex: 10,
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.18)'
          }}
        >
          {/* Drag Handle Bar */}
          <div
            style={{
              padding: '0.15rem 0 0.35rem',
              display: 'flex',
              justifyContent: 'center',
              cursor: 'grab'
            }}
          >
            <div
              style={{
                width: '44px',
                height: '4px',
                backgroundColor: 'var(--border-light, rgba(255, 255, 255, 0.25))',
                borderRadius: '9999px'
              }}
            />
          </div>

          {/* Header Row (Clean: Icon + Title + Subtitle, No "X" Button as per Rule 7.A) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem'
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '0.75rem',
                backgroundColor: 'var(--primary-glow, rgba(2, 132, 199, 0.15))',
                border: '1px solid var(--border-light, rgba(2, 132, 199, 0.3))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary, #0284c7)',
                flexShrink: 0
              }}
            >
              <Headphones size={22} strokeWidth={1.75} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  color: 'var(--text-primary, #ffffff)',
                  letterSpacing: '-0.01em'
                }}
              >
                Kontak Resmi Catavor
              </h3>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary, #94a3b8)',
                  marginTop: '0.15rem',
                  display: 'block'
                }}
              >
                Saluran bantuan &amp; komunikasi resmi terverifikasi
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body (Content scrolls underneath the floating header) */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            padding: '1.15rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxSizing: 'border-box'
          }}
        >
          {/* Channel 1: WhatsApp CS */}
          <div
            style={{
              padding: '0.9rem 1rem',
              borderRadius: '0.85rem',
              backgroundColor: 'var(--bg-deep, rgba(0, 0, 0, 0.2))',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '0.6rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.14)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                  flexShrink: 0
                }}
              >
                <MessageSquare size={18} strokeWidth={1.75} />
              </div>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)' }}>
                WhatsApp CS
              </span>
            </div>

          <div
            style={{
              padding: '0.55rem 0.75rem',
              borderRadius: '0.55rem',
              backgroundColor: 'var(--bg-card, rgba(255, 255, 255, 0.04))',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'monospace',
              fontSize: '0.88rem',
              fontWeight: 700,
              color: 'var(--text-primary, #ffffff)'
            }}
          >
            <span>{WA_NUMBER}</span>
          </div>

          {/* Action Buttons Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleOpenWA}
              style={{
                minHeight: '44px',
                padding: '0.6rem 1rem',
                borderRadius: '0.65rem',
                backgroundColor: '#16a34a',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)',
                transition: 'all 0.15s ease'
              }}
            >
              <ExternalLink size={15} />
              <span>Buka WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopy(WA_NUMBER, 'wa')}
              style={{
                minHeight: '44px',
                padding: '0.6rem 0.85rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--bg-card, rgba(255, 255, 255, 0.06))',
                color: 'var(--text-primary, #ffffff)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Salin Nomor WhatsApp"
            >
              {copiedType === 'wa' ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
              <span>{copiedType === 'wa' ? 'Tersalin' : 'Salin'}</span>
            </button>
          </div>
        </div>

        {/* Channel 2: Email Layanan */}
        <div
          style={{
            padding: '0.9rem 1rem',
            borderRadius: '0.85rem',
            backgroundColor: 'var(--bg-deep, rgba(0, 0, 0, 0.2))',
            border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '0.6rem',
                backgroundColor: 'var(--primary-glow, rgba(2, 132, 199, 0.14))',
                border: '1px solid var(--border-light, rgba(2, 132, 199, 0.35))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary, #0284c7)',
                flexShrink: 0
              }}
            >
              <Mail size={18} strokeWidth={1.75} />
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)' }}>
              Email Layanan
            </span>
          </div>

          <div
            style={{
              padding: '0.55rem 0.75rem',
              borderRadius: '0.55rem',
              backgroundColor: 'var(--bg-card, rgba(255, 255, 255, 0.04))',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'monospace',
              fontSize: '0.88rem',
              fontWeight: 700,
              color: 'var(--text-primary, #ffffff)'
            }}
          >
            <span>{EMAIL_ADDRESS}</span>
          </div>

          {/* Action Buttons Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleOpenEmail}
              style={{
                minHeight: '44px',
                padding: '0.6rem 1rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--primary, #0284c7)',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px var(--primary-glow, rgba(2, 132, 199, 0.3))',
                transition: 'all 0.15s ease'
              }}
            >
              <ExternalLink size={15} />
              <span>Kirim Email</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopy(EMAIL_ADDRESS, 'email')}
              style={{
                minHeight: '44px',
                padding: '0.6rem 0.85rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--bg-card, rgba(255, 255, 255, 0.06))',
                color: 'var(--text-primary, #ffffff)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Salin Alamat Email"
            >
              {copiedType === 'email' ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
              <span>{copiedType === 'email' ? 'Tersalin' : 'Salin'}</span>
            </button>
          </div>
        </div>

        {/* Security Assurance Notice */}
        <div
          style={{
            padding: '0.75rem 0.85rem',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(2, 132, 199, 0.06)',
            border: '1px solid var(--border-light, rgba(2, 132, 199, 0.2))',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.55rem'
          }}
        >
          <ShieldCheck size={17} style={{ color: 'var(--primary, #0284c7)', flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '0.71rem', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.45 }}>
            <strong style={{ color: 'var(--text-primary, #ffffff)' }}>Perlindungan Keamanan:</strong> Tim Catavor tidak pernah meminta kata sandi akun Anda. Pastikan selalu berkomunikasi hanya melalui kontak terverifikasi di atas.
          </p>
        </div>
        </div>

        {/* Floating / Pinned Bottom Action Bar */}
        <div
          style={{
            flexShrink: 0,
            padding: '0.75rem 1.25rem 1.15rem',
            backgroundColor: 'var(--bg-card, #1e293b)',
            borderTop: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.15)',
            zIndex: 10
          }}
        >
          <button
            type="button"
            onClick={closeWithAnimation}
            style={{
              minHeight: '44px',
              width: '100%',
              padding: '0.65rem 1rem',
              borderRadius: '0.65rem',
              backgroundColor: 'var(--bg-deep, rgba(255, 255, 255, 0.06))',
              color: 'var(--text-primary, #ffffff)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
              fontSize: '0.84rem',
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
