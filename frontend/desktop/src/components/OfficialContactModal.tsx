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
  Clock,
  X
} from 'lucide-react';

export interface OfficialContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const OfficialContactModal: React.FC<OfficialContactModalProps> = ({
  isOpen,
  onClose,
  showToast
}) => {
  const [copiedType, setCopiedType] = useState<'wa' | 'email' | null>(null);

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

  if (!isOpen) return null;

  const WA_NUMBER = '+62 812-3456-7890';
  const WA_CLEAN = '6281234567890';
  const EMAIL_ADDRESS = 'bantuan@catavor.com';

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
    window.open(`https://wa.me/${WA_CLEAN}?text=Halo%20Tim%20Bantuan%20Catavor,%20saya%20memerlukan%20informasi%20layanan%20katalog`, '_blank', 'noopener,noreferrer');
  };

  const handleOpenEmail = () => {
    window.open(`mailto:${EMAIL_ADDRESS}?subject=Permintaan%20Bantuan%20Pengelolaan%20Katalog%20Catavor`, '_blank', 'noopener,noreferrer');
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
          padding: '1.75rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          position: 'relative',
          color: 'var(--text-primary, #ffffff)',
          overflowY: 'auto',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '1rem',
            borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))'
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
                Saluran bantuan & komunikasi resmi platform terverifikasi
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

        {/* Channel 1: WhatsApp Resmi */}
        <div
          style={{
            padding: '1.2rem 1.35rem',
            borderRadius: '1rem',
            backgroundColor: 'var(--bg-deep, rgba(0, 0, 0, 0.2))',
            border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '0.7rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.14)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                  flexShrink: 0
                }}
              >
                <MessageSquare size={20} strokeWidth={1.75} />
              </div>
              <div>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', display: 'block' }}>
                  WhatsApp CS Resmi
                </span>
                <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.1rem' }}>
                  <Clock size={12} /> Respon Cepat Operasional &bull; 08.00 - 22.00 WIB
                </span>
              </div>
            </div>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                whiteSpace: 'nowrap'
              }}
            >
              Terverifikasi
            </span>
          </div>

          <div
            style={{
              padding: '0.7rem 0.95rem',
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

        {/* Channel 2: Email Resmi */}
        <div
          style={{
            padding: '1.2rem 1.35rem',
            borderRadius: '1rem',
            backgroundColor: 'var(--bg-deep, rgba(0, 0, 0, 0.2))',
            border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '0.7rem',
                  backgroundColor: 'var(--primary-glow, rgba(2, 132, 199, 0.14))',
                  border: '1px solid var(--border-light, rgba(2, 132, 199, 0.35))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary, #0284c7)',
                  flexShrink: 0
                }}
              >
                <Mail size={20} strokeWidth={1.75} />
              </div>
              <div>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', display: 'block' }}>
                  Email Bantuan & Layanan
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--primary, #0284c7)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.1rem' }}>
                  <Clock size={12} /> Kendala Formal & Laporan &bull; Estimasi Balasan 1x24 Jam Kerja
                </span>
              </div>
            </div>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                backgroundColor: 'var(--primary-glow, rgba(2, 132, 199, 0.15))',
                color: 'var(--primary, #0284c7)',
                border: '1px solid var(--border-light, rgba(2, 132, 199, 0.35))',
                whiteSpace: 'nowrap'
              }}
            >
              Resmi
            </span>
          </div>

          <div
            style={{
              padding: '0.7rem 0.95rem',
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

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
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
