import React, { useRef, useState } from 'react';
import { ShieldCheck, Smartphone, KeyRound, AlertCircle } from 'lucide-react';
import { useModalBackHandler } from '../utils/navigation';

export type MFAChallengeFactor = 'totp' | 'backup_code';

type Props = {
  challenge?: string;
  email: string;
  apiBase: string;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onVerified?: (data: any) => void;
  onStepUpVerify?: (code: string, factorType: MFAChallengeFactor) => Promise<void>;
};

/**
 * Slide-Up Bottom Sheet Verifikasi Faktor Kedua Mobile Native.
 * Mematuhi standar fisika pegas Apple-style, touchAction isolation, bebas tombol 'X' di header,
 * dan intersepsi tombol Back via useModalBackHandler.
 */
export function MFAChallengeView({
  challenge = '',
  email,
  apiBase,
  title = 'Verifikasi Dua Langkah',
  subtitle,
  submitLabel = 'Verifikasi & Masuk',
  cancelLabel = 'Batal',
  onCancel,
  onVerified,
  onStepUpVerify,
}: Props) {
  const [code, setCode] = useState('');
  const [factorType, setFactorType] = useState<MFAChallengeFactor>('totp');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef(0);
  const closingRef = useRef(false);

  const triggerSmoothClose = () => {
    if (busy || closingRef.current) return;
    closingRef.current = true;
    setIsDragging(false);
    setDragOffset(560);
    setTimeout(() => {
      onCancel();
    }, 240);
  };

  useModalBackHandler({
    isOpen: true,
    onClose: triggerSmoothClose,
    modalId: 'mobile-mfa-challenge',
    disabled: busy,
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    if (busy || closingRef.current) return;
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || busy || closingRef.current) return;
    const delta = e.touches[0].clientY - startYRef.current;
    setDragOffset(delta < 0 ? delta * 0.18 : delta);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragOffset >= 70) {
      triggerSmoothClose();
    } else {
      setDragOffset(0);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = code.trim();
    if (cleaned.length < 6) return;
    setBusy(true);
    setError('');
    try {
      if (onStepUpVerify) {
        await onStepUpVerify(cleaned, factorType);
        return;
      }
      const res = await fetch(`${apiBase}/auth/mfa/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ challenge, code: cleaned, factor_type: factorType }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.token) {
        throw new Error(data.message || 'Verifikasi dua langkah gagal.');
      }
      onVerified?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Koneksi terputus ke server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) triggerSmoothClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '1.25rem 1.25rem 0 0',
          borderTop: '1px solid rgba(148, 163, 184, 0.24)',
          background: '#0f172a',
          color: '#f8fafc',
          boxShadow: '0 -18px 48px rgba(0, 0, 0, 0.65)',
          transform: `translate3d(0, ${dragOffset}px, 0)`,
          transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform',
        }}
      >
        {/* Drag Handle + Clean Header (TANPA tombol X) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            touchAction: 'none',
            padding: '0.65rem 1.15rem 0.85rem',
            borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '4px',
              borderRadius: '999px',
              background: 'rgba(148, 163, 184, 0.45)',
              margin: '0 auto 0.85rem',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '0.65rem',
                background: 'rgba(37, 99, 235, 0.16)',
                border: '1px solid rgba(59, 130, 246, 0.32)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#60a5fa',
              }}
            >
              <ShieldCheck size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.06rem', fontWeight: 700, color: '#f8fafc' }}>
                {title}
              </h2>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.45 }}>
                {subtitle || `Masukkan kode 6 digit authenticator atau kode cadangan untuk ${email}.`}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Isolated Body */}
        <form
          onSubmit={submit}
          style={{
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            padding: '1rem 1.15rem calc(1.2rem + env(safe-area-inset-bottom, 0px))',
            display: 'grid',
            gap: '0.95rem',
          }}
        >
          <div
            role="group"
            aria-label="Jenis faktor verifikasi"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.4rem',
              padding: '0.25rem',
              borderRadius: '0.65rem',
              background: 'rgba(2, 6, 23, 0.65)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
            }}
          >
            <button
              type="button"
              aria-pressed={factorType === 'totp'}
              onClick={() => {
                setFactorType('totp');
                setCode('');
                setError('');
              }}
              style={{
                minHeight: '46px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                border: 0,
                background: factorType === 'totp' ? '#1e293b' : 'transparent',
                color: factorType === 'totp' ? '#f8fafc' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.84rem',
                cursor: 'pointer',
              }}
            >
              <Smartphone size={16} strokeWidth={1.75} />
              Authenticator
            </button>
            <button
              type="button"
              aria-pressed={factorType === 'backup_code'}
              onClick={() => {
                setFactorType('backup_code');
                setCode('');
                setError('');
              }}
              style={{
                minHeight: '46px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                border: 0,
                background: factorType === 'backup_code' ? '#1e293b' : 'transparent',
                color: factorType === 'backup_code' ? '#f8fafc' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.84rem',
                cursor: 'pointer',
              }}
            >
              <KeyRound size={16} strokeWidth={1.75} />
              Kode Cadangan
            </button>
          </div>

          <label style={{ display: 'grid', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1' }}>
            {factorType === 'totp' ? 'Kode 6 Digit Authenticator' : 'Kode Cadangan Sekali Pakai'}
            <input
              autoFocus
              required
              autoComplete="one-time-code"
              inputMode={factorType === 'totp' ? 'numeric' : 'text'}
              placeholder={factorType === 'totp' ? '000000' : 'XXXX-XXXX'}
              value={code}
              onChange={(e) => {
                const raw = e.target.value;
                setCode(
                  factorType === 'totp'
                    ? raw.replace(/\D/g, '').slice(0, 6)
                    : raw.replace(/[^0-9A-Za-z-]/g, '').toUpperCase().slice(0, 20)
                );
              }}
              style={{
                width: '100%',
                minHeight: '48px',
                boxSizing: 'border-box',
                padding: '0.75rem 0.85rem',
                borderRadius: '0.6rem',
                border: '1px solid rgba(148, 163, 184, 0.35)',
                background: 'rgba(2, 6, 23, 0.72)',
                color: '#ffffff',
                fontSize: '1.1rem',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                letterSpacing: factorType === 'totp' ? '0.22em' : '0.1em',
                outline: 'none',
              }}
            />
          </label>

          {error && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                padding: '0.65rem 0.8rem',
                borderRadius: '0.55rem',
                background: 'rgba(220, 38, 38, 0.12)',
                border: '1px solid rgba(248, 113, 113, 0.28)',
                color: '#fca5a5',
                fontSize: '0.82rem',
                lineHeight: 1.45,
              }}
            >
              <AlertCircle size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'grid', gap: '0.55rem', marginTop: '0.15rem' }}>
            <button
              type="submit"
              disabled={busy || (factorType === 'totp' ? code.trim().length !== 6 : code.trim().length < 6)}
              style={{
                minHeight: '48px',
                border: 0,
                borderRadius: '0.65rem',
                background: busy ? '#1e40af' : '#2563eb',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: busy ? 'wait' : 'pointer',
                opacity: factorType === 'totp' ? (code.trim().length === 6 ? 1 : 0.55) : code.trim().length >= 6 ? 1 : 0.55,
              }}
            >
              {busy ? 'Memverifikasi...' : submitLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={triggerSmoothClose}
              style={{
                minHeight: '46px',
                border: '1px solid rgba(148, 163, 184, 0.28)',
                borderRadius: '0.65rem',
                background: 'transparent',
                color: '#cbd5e1',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
              }}
            >
              {cancelLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MFAChallengeView;
