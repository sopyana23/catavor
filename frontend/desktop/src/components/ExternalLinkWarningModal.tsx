import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldAlert,
  ExternalLink,
  Copy,
  Check,
  X,
  Globe,
  AlertTriangle
} from 'lucide-react';
import { cleanDomainString, addUserTrustedDomain } from '../utils/urlSecurity';

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

  useEffect(() => {
    if (!url) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [url, onClose]);

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
    onClose();
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
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '460px',
          width: '100%',
          backgroundColor: theme?.surface || 'var(--bg-card, #0f172a)',
          backgroundImage: theme?.cardGradient || 'var(--card-bg-gradient, none)',
          borderRadius: '1.25rem',
          border: `1px solid ${theme?.border || 'var(--border-light, rgba(255, 255, 255, 0.12))'}`,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.15rem',
          position: 'relative',
          color: 'var(--text-primary, #ffffff)'
        }}
      >
        {/* Close Top-Right Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.1rem',
            right: '1.1rem',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-deep, rgba(255, 255, 255, 0.06))',
            border: '1px solid var(--border-light, transparent)',
            color: 'var(--text-muted, #94a3b8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="Tutup Dialog"
        >
          <X size={16} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
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
          fontSize: '0.78rem',
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
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
              fontSize: '0.74rem',
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
                fontSize: '0.7rem',
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
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)', fontWeight: 600 }}>
            Jangan ingatkan saya lagi untuk domain <strong style={{ color: 'var(--text-primary, #ffffff)' }}>{domain}</strong>
          </span>
        </label>

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '0.75rem', marginTop: '0.2rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.68rem 1rem',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.06))',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
              color: 'var(--text-primary, #ffffff)',
              fontSize: '0.84rem',
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
              fontSize: '0.84rem',
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
