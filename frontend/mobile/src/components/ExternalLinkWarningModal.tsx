import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldAlert,
  ExternalLink,
  Copy,
  Check,
  Globe,
  AlertTriangle
} from 'lucide-react';
import { cleanDomainString, addUserTrustedDomain } from '../utils/urlSecurity';
import { useModalBackHandler } from '../utils/navigation';

export interface ExternalLinkWarningModalProps {
  url: string | null;
  onClose: () => void;
  onProceed?: (url: string) => void;
  theme?: any;
  isDark?: boolean;
}

export const ExternalLinkWarningModal: React.FC<ExternalLinkWarningModalProps> = ({
  url,
  onClose,
  onProceed,
  theme
}) => {
  const [dontRemind, setDontRemind] = useState(false);
  const [copied, setCopied] = useState(false);

  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dragStartY = React.useRef(0);

  const closeWithAnimation = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setDragY(0);
      onClose();
    }, 280);
  };

  useModalBackHandler({
    isOpen: Boolean(url),
    onClose: closeWithAnimation,
    modalId: 'external-link-warning-modal-mobile'
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
      setDragY(delta * 0.15);
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
    if (!url) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeWithAnimation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [url]);

  if (!url) return null;

  const domain = cleanDomainString(url);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmProceed = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (dontRemind && domain) {
      addUserTrustedDomain(domain);
    }

    const newWin = window.open(url, '_blank', 'noopener,noreferrer');
    if (newWin) newWin.opener = null;

    if (onProceed) {
      onProceed(url);
    }
    closeWithAnimation();
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.68)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: 0
      }}
      onClick={(e) => {
        e.stopPropagation();
        closeWithAnimation();
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          width: '100%',
          backgroundColor: theme?.surface || 'var(--bg-card, #0f172a)',
          backgroundImage: theme?.cardGradient || 'var(--card-bg-gradient, none)',
          borderTopLeftRadius: '1.5rem',
          borderTopRightRadius: '1.5rem',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          border: `1px solid ${theme?.border || 'var(--border-light, rgba(255, 255, 255, 0.12))'}`,
          borderBottom: 'none',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.45)',
          padding: '0.85rem 1.4rem 1.4rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.1rem',
          position: 'relative',
          color: 'var(--text-primary, #ffffff)',
          transform: isClosing ? 'translateY(100%)' : `translateY(${Math.max(0, dragY)}px)`,
          transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          boxSizing: 'border-box'
        }}
      >
        {/* Sheet Drag Handle Bar (Touch & Mouse Drag-Down to Dismiss) */}
        <div
          onMouseDown={e => handleDragStart(e.clientY)}
          onMouseMove={e => handleDragMove(e.clientY)}
          onMouseUp={handleDragEnd}
          onTouchStart={e => handleDragStart(e.touches[0].clientY)}
          onTouchMove={e => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
          style={{
            padding: '0 0 0.5rem',
            display: 'flex',
            justifyContent: 'center',
            cursor: 'grab',
            touchAction: 'none'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '4px',
              backgroundColor: theme?.border || 'var(--border-light, rgba(255, 255, 255, 0.2))',
              borderRadius: '9999px'
            }}
          />
        </div>

        {/* Modal Header */}
        <div
          onMouseDown={e => handleDragStart(e.clientY)}
          onMouseMove={e => handleDragMove(e.clientY)}
          onMouseUp={handleDragEnd}
          onTouchStart={e => handleDragStart(e.touches[0].clientY)}
          onTouchMove={e => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
          style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', touchAction: 'none' }}
        >
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '1rem',
            backgroundColor: 'rgba(245, 158, 11, 0.14)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f59e0b',
            flexShrink: 0
          }}>
            <ShieldAlert size={24} />
          </div>
          <div style={{ minWidth: 0, paddingRight: '2rem' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', letterSpacing: '-0.02em' }}>
              Peringatan Tautan Eksternal
            </h4>
            <div style={{ fontSize: '0.74rem', color: '#f59e0b', fontWeight: 700, marginTop: '0.15rem' }}>
              Meninggalkan Ekosistem Catavor
            </div>
          </div>
        </div>

        {/* Body Description & Security Guidance */}
        <div style={{
          padding: '0.85rem 1rem',
          borderRadius: '0.85rem',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.22)',
          color: 'var(--text-primary, #ffffff)',
          fontSize: '0.76rem',
          lineHeight: 1.5,
          display: 'flex',
          gap: '0.65rem'
        }}>
          <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: '2px', color: '#f59e0b' }} />
          <div>
            Anda akan diarahkan ke situs eksternal pihak ketiga. Pastikan Anda mempercayai tautan ini dan <strong style={{ color: 'var(--text-primary, #ffffff)' }}>jangan pernah membagikan kata sandi</strong> atau data rahasia akun Catavor Anda di situs luar.
          </div>
        </div>

        {/* Target URL Preview Box */}
        <div style={{
          borderRadius: '0.95rem',
          backgroundColor: 'var(--bg-deep, rgba(0, 0, 0, 0.05))',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
              <Globe size={14} style={{ color: 'var(--primary, #3b82f6)' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {domain || 'Domain Eksternal'}
              </span>
            </div>
            <span style={{
              fontSize: '0.66rem',
              fontWeight: 700,
              padding: '0.15rem 0.5rem',
              borderRadius: '999px',
              backgroundColor: 'rgba(245, 158, 11, 0.14)',
              color: '#d97706',
              border: '1px solid rgba(245, 158, 11, 0.28)',
              flexShrink: 0
            }}>
              Pihak Ketiga
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.6rem',
            backgroundColor: 'var(--bg-card, rgba(0, 0, 0, 0.2))',
            borderRadius: '0.65rem',
            padding: '0.45rem 0.75rem',
            border: '1px solid var(--border-light, rgba(255, 255, 255, 0.06))'
          }}>
            <span style={{
              fontSize: '0.72rem',
              color: 'var(--primary, #3b82f6)',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1
            }}>
              {url}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                background: 'none',
                border: 'none',
                color: copied ? '#10b981' : 'var(--text-secondary, #94a3b8)',
                cursor: 'pointer',
                padding: '0.2rem 0.4rem',
                borderRadius: '0.4rem',
                fontSize: '0.68rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                flexShrink: 0
              }}
              title="Salin URL Lengkap"
            >
              {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              <span>{copied ? 'Tersalin' : 'Salin'}</span>
            </button>
          </div>
        </div>

        {/* Checkbox: Jangan Ingatkan Lagi */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            cursor: 'pointer',
            userSelect: 'none',
            padding: '0.2rem 0.1rem'
          }}
        >
          <input
            type="checkbox"
            checked={dontRemind}
            onChange={e => setDontRemind(e.target.checked)}
            style={{
              width: '16px',
              height: '16px',
              accentColor: 'var(--primary, #2563eb)',
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', fontWeight: 600 }}>
            Jangan ingatkan saya lagi untuk domain <strong style={{ color: 'var(--text-primary, #ffffff)' }}>{domain}</strong>
          </span>
        </label>

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '0.65rem', marginTop: '0.2rem' }}>
          <button
            type="button"
            onClick={closeWithAnimation}
            style={{
              padding: '0.68rem 1rem',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.06))',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
              color: 'var(--text-primary, #ffffff)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleConfirmProceed}
            style={{
              padding: '0.68rem 1.15rem',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--primary, #2563eb)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              boxShadow: '0 4px 14px var(--primary-glow, rgba(37, 99, 235, 0.3))',
              transition: 'all 0.15s ease'
            }}
          >
            <span>Buka Tautan</span>
            <ExternalLink size={14} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
