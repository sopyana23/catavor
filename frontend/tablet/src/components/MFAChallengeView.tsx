import React, { useState } from 'react';
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
 * Dialog verifikasi faktor kedua Tablet Native (Centered Medium Panel, seluruh touch target >= 46px).
 */
export function MFAChallengeView({
  challenge = '',
  email,
  apiBase,
  title = 'Verifikasi Dua Langkah',
  subtitle,
  submitLabel = 'Verifikasi & Masuk',
  cancelLabel = 'Kembali',
  onCancel,
  onVerified,
  onStepUpVerify,
}: Props) {
  const [code, setCode] = useState('');
  const [factorType, setFactorType] = useState<MFAChallengeFactor>('totp');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useModalBackHandler({
    isOpen: true,
    onClose: () => {
      if (!busy) onCancel();
    },
    modalId: 'tablet-mfa-challenge',
    disabled: busy,
  });

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
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'rgba(2, 6, 23, 0.8)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          display: 'grid',
          gap: '1.05rem',
          padding: '1.6rem',
          borderRadius: '1rem',
          border: '1px solid rgba(148, 163, 184, 0.24)',
          background: '#0f172a',
          color: '#f8fafc',
          boxShadow: '0 26px 64px -16px rgba(0, 0, 0, 0.78)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '0.7rem',
              background: 'rgba(37, 99, 235, 0.16)',
              border: '1px solid rgba(59, 130, 246, 0.32)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#60a5fa',
            }}
          >
            <ShieldCheck size={22} strokeWidth={1.75} />
          </div>
          <div>
            <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
              {title}
            </h2>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.5 }}>
              {subtitle ||
                `Masukkan kode 6 digit dari aplikasi authenticator atau salah satu kode cadangan untuk akun ${email}.`}
            </p>
          </div>
        </div>

        <div
          role="group"
          aria-label="Jenis faktor verifikasi"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem',
            padding: '0.3rem',
            borderRadius: '0.7rem',
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(148, 163, 184, 0.22)',
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
              gap: '0.5rem',
              padding: '0.55rem 0.85rem',
              borderRadius: '0.55rem',
              border: 0,
              background: factorType === 'totp' ? '#1e293b' : 'transparent',
              color: factorType === 'totp' ? '#f8fafc' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            <Smartphone size={17} strokeWidth={1.75} />
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
              gap: '0.5rem',
              padding: '0.55rem 0.85rem',
              borderRadius: '0.55rem',
              border: 0,
              background: factorType === 'backup_code' ? '#1e293b' : 'transparent',
              color: factorType === 'backup_code' ? '#f8fafc' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            <KeyRound size={17} strokeWidth={1.75} />
            Kode Cadangan
          </button>
        </div>

        <label style={{ display: 'grid', gap: '0.45rem', fontSize: '0.84rem', fontWeight: 600, color: '#cbd5e1' }}>
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
              padding: '0.75rem 0.9rem',
              borderRadius: '0.6rem',
              border: '1px solid rgba(148, 163, 184, 0.32)',
              background: 'rgba(2, 6, 23, 0.68)',
              color: '#f8fafc',
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
              padding: '0.7rem 0.85rem',
              borderRadius: '0.55rem',
              background: 'rgba(220, 38, 38, 0.12)',
              border: '1px solid rgba(248, 113, 113, 0.28)',
              color: '#fca5a5',
              fontSize: '0.85rem',
              lineHeight: 1.45,
            }}
          >
            <AlertCircle size={17} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            style={{
              minHeight: '46px',
              padding: '0 1.15rem',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '0.6rem',
              background: 'transparent',
              color: '#cbd5e1',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={busy || (factorType === 'totp' ? code.trim().length !== 6 : code.trim().length < 6)}
            style={{
              minHeight: '46px',
              padding: '0 1.35rem',
              border: 0,
              borderRadius: '0.6rem',
              background: busy ? '#1e40af' : '#2563eb',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: busy ? 'wait' : 'pointer',
              opacity: factorType === 'totp' ? (code.trim().length === 6 ? 1 : 0.55) : code.trim().length >= 6 ? 1 : 0.55,
            }}
          >
            {busy ? 'Memverifikasi...' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export default MFAChallengeView;
