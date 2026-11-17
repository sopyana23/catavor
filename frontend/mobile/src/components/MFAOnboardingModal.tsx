import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldAlert, ShieldCheck, Copy, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { useModalBackHandler } from '../utils/navigation';

type EnrollmentPayload = {
  secret: string;
  otpauth_url: string;
  qr_data_url?: string;
  setup_jti?: string;
};

type Props = {
  setupToken: string;
  email: string;
  apiBase: string;
  onCancel: () => void;
  onCompleted: (verifiedSessionPayload: any) => void;
};

/**
 * Slide-Up Bottom Sheet Onboarding Wajib MFA Staf Platform (Mobile Native).
 * Mematuhi standar fisika pegas Apple-style, touchAction isolation, bebas tombol 'X' di header,
 * dan intersepsi tombol Back via useModalBackHandler.
 */
export function MFAOnboardingModal({ setupToken, email, apiBase, onCancel, onCompleted }: Props) {
  const [enrollment, setEnrollment] = useState<EnrollmentPayload | null>(null);
  const [loadingEnroll, setLoadingEnroll] = useState(true);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [savedAck, setSavedAck] = useState(false);
  const [completedPayload, setCompletedPayload] = useState<any | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef(0);
  const closingRef = useRef(false);

  const canDismiss = !busy && !completedPayload;

  const triggerSmoothClose = () => {
    if (!canDismiss || closingRef.current) return;
    closingRef.current = true;
    setIsDragging(false);
    setDragOffset(640);
    setTimeout(() => {
      onCancel();
    }, 240);
  };

  useModalBackHandler({
    isOpen: true,
    onClose: triggerSmoothClose,
    modalId: 'mobile-mfa-onboarding',
    disabled: !canDismiss,
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!canDismiss || closingRef.current) return;
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !canDismiss || closingRef.current) return;
    const delta = e.touches[0].clientY - startYRef.current;
    setDragOffset(delta < 0 ? delta * 0.18 : delta);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragOffset >= 70 && canDismiss) {
      triggerSmoothClose();
    } else {
      setDragOffset(0);
    }
  };

  const startEnrollment = useCallback(async () => {
    setLoadingEnroll(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/auth/mfa/enroll`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${setupToken}`,
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.data?.secret) {
        throw new Error(json.message || 'Gagal menyiapkan pendaftaran MFA.');
      }
      setEnrollment(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghubungi server pendaftaran MFA.');
    } finally {
      setLoadingEnroll(false);
    }
  }, [apiBase, setupToken]);

  useEffect(() => {
    void startEnrollment();
  }, [startEnrollment]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6 || !enrollment) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/auth/mfa/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${setupToken}`,
        },
        body: JSON.stringify({
          code: code.trim(),
          setup_jti: enrollment.setup_jti || '',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.token) {
        throw new Error(json.message || 'Kode verifikasi salah atau kedaluwarsa.');
      }
      setBackupCodes(Array.isArray(json.data?.backup_codes) ? json.data.backup_codes : []);
      setCompletedPayload(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengaktifkan MFA.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aktivasi Wajib Verifikasi Dua Langkah"
      onClick={(e) => {
        if (e.target === e.currentTarget && canDismiss) triggerSmoothClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(2, 6, 23, 0.82)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '92dvh',
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
            padding: '0.65rem 1.1rem 0.85rem',
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
                background: completedPayload ? 'rgba(16, 185, 129, 0.16)' : 'rgba(245, 158, 11, 0.16)',
                border: `1px solid ${completedPayload ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: completedPayload ? '#34d399' : '#fbbf24',
              }}
            >
              {completedPayload ? <ShieldCheck size={20} strokeWidth={1.75} /> : <ShieldAlert size={20} strokeWidth={1.75} />}
            </div>
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.05rem', fontWeight: 700 }}>
                {completedPayload ? 'MFA Aktif — Simpan Kode Cadangan' : 'Aktivasi Wajib MFA Staf'}
              </h2>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.45 }}>
                {completedPayload
                  ? 'Kode cadangan ini hanya tampil satu kali. Simpan di tempat aman sebelum melanjutkan.'
                  : `Akun staf (${email}) wajib mengaktifkan autentikator TOTP untuk mengakses konsol pengelola.`}
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            padding: '1rem 1.1rem calc(1.2rem + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {!completedPayload ? (
            <form onSubmit={handleConfirm} style={{ display: 'grid', gap: '0.95rem' }}>
              {loadingEnroll ? (
                <div style={{ padding: '1.8rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.86rem' }}>
                  Menyiapkan kunci pendaftaran MFA...
                </div>
              ) : enrollment ? (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gap: '0.75rem',
                      justifyItems: 'center',
                      padding: '0.9rem',
                      borderRadius: '0.75rem',
                      background: 'rgba(2, 6, 23, 0.65)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                    }}
                  >
                    {enrollment.qr_data_url && (
                      <div style={{ width: '164px', height: '164px', padding: '0.45rem', borderRadius: '0.6rem', background: '#ffffff', boxSizing: 'border-box' }}>
                        <img src={enrollment.qr_data_url} alt="QR Code Pendaftaran MFA" style={{ width: '100%', height: '100%', display: 'block' }} />
                      </div>
                    )}
                    <div style={{ width: '100%', display: 'grid', gap: '0.45rem' }}>
                      <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                        Atau salin kunci secret manual ke aplikasi authenticator:
                      </span>
                      <div style={{ display: 'flex', gap: '0.45rem' }}>
                        <input
                          readOnly
                          value={enrollment.secret}
                          onFocus={(e) => e.currentTarget.select()}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            minHeight: '46px',
                            padding: '0 0.7rem',
                            borderRadius: '0.55rem',
                            border: '1px solid rgba(148, 163, 184, 0.3)',
                            background: 'rgba(15, 23, 42, 0.9)',
                            color: '#f8fafc',
                            fontSize: '0.8rem',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard?.writeText(enrollment.secret);
                            setCopiedSecret(true);
                            setTimeout(() => setCopiedSecret(false), 1800);
                          }}
                          style={{
                            minHeight: '46px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0 0.85rem',
                            borderRadius: '0.55rem',
                            border: '1px solid rgba(148, 163, 184, 0.3)',
                            background: '#1e293b',
                            color: '#f8fafc',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {copiedSecret ? <Check size={15} strokeWidth={2} /> : <Copy size={15} strokeWidth={1.75} />}
                          {copiedSecret ? 'Disalin' : 'Salin'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <label style={{ display: 'grid', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1' }}>
                    Kode 6 Digit dari Aplikasi Authenticator
                    <input
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="000000"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
                        letterSpacing: '0.24em',
                      }}
                    />
                  </label>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void startEnrollment()}
                  style={{
                    minHeight: '46px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    borderRadius: '0.6rem',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    background: '#1e293b',
                    color: '#f8fafc',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={16} strokeWidth={1.75} />
                  Muat Ulang Pendaftaran
                </button>
              )}

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
                  }}
                >
                  <AlertCircle size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{error}</span>
                </div>
              )}

              <div style={{ display: 'grid', gap: '0.55rem' }}>
                <button
                  type="submit"
                  disabled={busy || loadingEnroll || !enrollment || code.trim().length !== 6}
                  style={{
                    minHeight: '48px',
                    border: 0,
                    borderRadius: '0.65rem',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    cursor: busy ? 'wait' : 'pointer',
                    opacity: !enrollment || code.trim().length !== 6 ? 0.55 : 1,
                  }}
                >
                  {busy ? 'Mengaktifkan...' : 'Aktifkan & Verifikasi'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={triggerSmoothClose}
                  style={{
                    minHeight: '46px',
                    borderRadius: '0.65rem',
                    border: '1px solid rgba(148, 163, 184, 0.28)',
                    background: 'transparent',
                    color: '#cbd5e1',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Batal
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'grid', gap: '0.95rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '0.45rem',
                  padding: '0.85rem',
                  borderRadius: '0.65rem',
                  background: 'rgba(2, 6, 23, 0.72)',
                  border: '1px solid rgba(245, 158, 11, 0.32)',
                }}
              >
                {backupCodes.map((c, idx) => (
                  <code
                    key={`${idx}-${c}`}
                    style={{
                      padding: '0.45rem 0.5rem',
                      borderRadius: '0.4rem',
                      background: 'rgba(30, 41, 59, 0.78)',
                      color: '#f8fafc',
                      fontSize: '0.82rem',
                      textAlign: 'center',
                    }}
                  >
                    {c}
                  </code>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(backupCodes.join('\n'));
                  setCopiedBackup(true);
                  setTimeout(() => setCopiedBackup(false), 2000);
                }}
                style={{
                  minHeight: '46px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  borderRadius: '0.6rem',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  background: '#1e293b',
                  color: '#f8fafc',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copiedBackup ? <Check size={16} strokeWidth={2} /> : <Copy size={16} strokeWidth={1.75} />}
                {copiedBackup ? 'Kode Cadangan Disalin' : 'Salin Semua Kode'}
              </button>

              <label style={{ minHeight: '44px', display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.84rem', color: '#cbd5e1' }}>
                <input
                  type="checkbox"
                  checked={savedAck}
                  onChange={(e) => setSavedAck(e.target.checked)}
                  style={{ width: '18px', height: '18px', flexShrink: 0 }}
                />
                <span>Saya sudah menyimpan kode cadangan ini</span>
              </label>

              <button
                type="button"
                disabled={!savedAck}
                onClick={() => onCompleted(completedPayload)}
                style={{
                  minHeight: '48px',
                  border: 0,
                  borderRadius: '0.65rem',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  cursor: savedAck ? 'pointer' : 'not-allowed',
                  opacity: savedAck ? 1 : 0.5,
                }}
              >
                Lanjutkan ke Konsol Pengelola
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MFAOnboardingModal;
