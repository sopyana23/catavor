import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ShieldAlert, ShieldCheck, Copy, Check, AlertCircle, RefreshCw } from 'lucide-react';
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

const srOnlyStyle: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

function formatSecretGroups(secret: string): string {
  const clean = secret.replace(/\s+/g, '');
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

function legacyCopyText(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;inset-block-start:0;opacity:0';
  document.body.append(field);
  field.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to synchronous selection copy when Clipboard API is unavailable or denied.
  }
  return legacyCopyText(text);
}

/**
 * Halaman Penuh Onboarding Wajib MFA Staf Platform (Mobile Native).
 * Selaras dengan tata letak halaman penuh /admin (#0b0f19 / #0f172a), dilengkapi
 * top app bar dengan tombol kembali, area konten scrollable terisolasi, sticky footer CTA,
 * dan intersepsi hardware/browser Back via useModalBackHandler.
 */
export function MFAOnboardingModal({ setupToken, email, apiBase, onCancel, onCompleted }: Props) {
  const titleId = useId();
  const descId = useId();
  const otpInputId = useId();
  const otpHintId = useId();
  const formId = useId();

  const [enrollment, setEnrollment] = useState<EnrollmentPayload | null>(null);
  const [loadingEnroll, setLoadingEnroll] = useState(true);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [secretCopyState, setSecretCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [backupCopyState, setBackupCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [savedAck, setSavedAck] = useState(false);
  const [completedPayload, setCompletedPayload] = useState<any | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const secretCopyTimerRef = useRef<number | null>(null);
  const backupCopyTimerRef = useRef<number | null>(null);

  const canDismiss = !busy && !completedPayload;

  const handleCancel = useCallback(() => {
    if (!canDismiss) return;
    onCancel();
  }, [canDismiss, onCancel]);

  useEffect(() => {
    return () => {
      if (secretCopyTimerRef.current !== null) window.clearTimeout(secretCopyTimerRef.current);
      if (backupCopyTimerRef.current !== null) window.clearTimeout(backupCopyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && canDismiss) {
        event.preventDefault();
        handleCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canDismiss, handleCancel]);

  useModalBackHandler({
    isOpen: true,
    onClose: handleCancel,
    modalId: 'mobile-mfa-onboarding',
    disabled: !canDismiss,
  });

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

  const handleCopySecret = async () => {
    if (!enrollment?.secret) return;
    const ok = await copyTextToClipboard(enrollment.secret);
    if (secretCopyTimerRef.current !== null) window.clearTimeout(secretCopyTimerRef.current);
    setSecretCopyState(ok ? 'copied' : 'failed');
    secretCopyTimerRef.current = window.setTimeout(() => {
      setSecretCopyState('idle');
    }, 1800);
  };

  const handleCopyBackupCodes = async () => {
    const ok = await copyTextToClipboard(backupCodes.join('\n'));
    if (backupCopyTimerRef.current !== null) window.clearTimeout(backupCopyTimerRef.current);
    setBackupCopyState(ok ? 'copied' : 'failed');
    backupCopyTimerRef.current = window.setTimeout(() => {
      setBackupCopyState('idle');
    }, 2000);
  };

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

  const canSubmitOtp = !busy && !loadingEnroll && Boolean(enrollment) && code.trim().length === 6;

  return (
    <div
      data-mfa-view="page"
      role="region"
      aria-labelledby={titleId}
      aria-describedby={descId}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20000,
        width: '100%',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#0b0f19',
        color: '#f8fafc',
        colorScheme: 'dark',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        overscrollBehavior: 'contain',
      }}
    >
      {/* Zona 1: Top App Bar Halaman Penuh */}
      <header
        style={{
          flexShrink: 0,
          background: '#0f172a',
          borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
          padding: 'calc(env(safe-area-inset-top, 0px) + 0.45rem) 0.75rem 0.45rem',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            width: '100%',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            minHeight: '44px',
          }}
        >
          {!completedPayload ? (
            <button
              type="button"
              aria-label="Kembali ke halaman login"
              disabled={busy}
              onClick={handleCancel}
              style={{
                minWidth: '44px',
                minHeight: '44px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                borderRadius: '0.6rem',
                border: '1px solid rgba(148, 163, 184, 0.22)',
                background: 'rgba(30, 41, 59, 0.55)',
                color: '#f8fafc',
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : (
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '0.55rem',
                background: 'rgba(16, 185, 129, 0.16)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#34d399',
              }}
            >
              <ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" />
            </div>
          )}
          <h1
            id={titleId}
            style={{
              margin: 0,
              fontSize: '1rem',
              lineHeight: 1.3,
              fontWeight: 700,
              color: '#f8fafc',
              minWidth: 0,
            }}
          >
            {completedPayload ? 'Simpan Kode Cadangan MFA' : 'Aktivasi Wajib MFA Staf'}
          </h1>
        </div>
      </header>

      {/* Zona 2: Area Konten Scrollable Terisolasi */}
      <main
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          padding: '0.75rem 1rem 0.85rem',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            width: '100%',
            margin: '0 auto',
            display: 'grid',
            gap: '0.65rem',
          }}
        >
          {/* Banner Konteks Ringkas */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              padding: '0.55rem 0.75rem',
              borderRadius: '0.65rem',
              background: completedPayload ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              border: `1px solid ${completedPayload ? 'rgba(16, 185, 129, 0.28)' : 'rgba(245, 158, 11, 0.28)'}`,
            }}
          >
            <div
              style={{
                flexShrink: 0,
                marginTop: '1px',
                color: completedPayload ? '#34d399' : '#fbbf24',
              }}
            >
              {completedPayload ? (
                <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <ShieldAlert size={16} strokeWidth={1.75} aria-hidden="true" />
              )}
            </div>
            <p
              id={descId}
              style={{
                margin: 0,
                fontSize: '0.76rem',
                lineHeight: 1.4,
                color: '#cbd5e1',
                overflowWrap: 'anywhere',
                minWidth: 0,
              }}
            >
              {completedPayload
                ? 'Kode cadangan ini hanya tampil satu kali. Simpan di tempat aman sebelum melanjutkan.'
                : `Akun staf (${email}) wajib mengaktifkan autentikator TOTP sebelum mengakses konsol pengelola.`}
            </p>
          </div>

          {!completedPayload ? (
            <form id={formId} onSubmit={handleConfirm} style={{ display: 'grid', gap: '0.65rem' }}>
              {loadingEnroll ? (
                <div
                  aria-busy="true"
                  style={{
                    display: 'grid',
                    justifyItems: 'center',
                    gap: '0.7rem',
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    background: '#0f172a',
                    border: '1px solid rgba(148, 163, 184, 0.18)',
                  }}
                >
                  <style>{`
                    @keyframes mfaSkeletonPulse {
                      0%, 100% { opacity: 0.45; }
                      50% { opacity: 0.9; }
                    }
                  `}</style>
                  <div
                    style={{
                      width: '132px',
                      height: '132px',
                      borderRadius: '0.6rem',
                      background: 'rgba(148, 163, 184, 0.16)',
                      animation: 'mfaSkeletonPulse 1.4s ease-in-out infinite',
                    }}
                  />
                  <div
                    style={{
                      width: '100%',
                      height: '44px',
                      borderRadius: '0.55rem',
                      background: 'rgba(148, 163, 184, 0.14)',
                      animation: 'mfaSkeletonPulse 1.4s ease-in-out infinite',
                    }}
                  />
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                    Menyiapkan kunci pendaftaran MFA...
                  </span>
                </div>
              ) : enrollment ? (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gap: '0.55rem',
                      padding: '0.75rem',
                      borderRadius: '0.75rem',
                      background: '#0f172a',
                      border: '1px solid rgba(148, 163, 184, 0.18)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: '#e2e8f0',
                        textAlign: 'center',
                      }}
                    >
                      1. Pindai QR code dengan aplikasi authenticator
                    </div>

                    {enrollment.qr_data_url && (
                      <div
                        style={{
                          width: 'clamp(124px, 34vw, 152px)',
                          height: 'clamp(124px, 34vw, 152px)',
                          margin: '0 auto',
                          padding: '0.4rem',
                          borderRadius: '0.6rem',
                          background: '#ffffff',
                          boxSizing: 'border-box',
                        }}
                      >
                        <img
                          src={enrollment.qr_data_url}
                          alt="QR Code Pendaftaran MFA"
                          style={{ width: '100%', height: '100%', display: 'block' }}
                        />
                      </div>
                    )}

                    <div style={{ width: '100%', display: 'grid', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                        Atau salin kunci manual:
                      </span>
                      <div style={{ display: 'flex', alignItems: 'stretch', gap: '0.5rem' }}>
                        <code
                          style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0.5rem 0.65rem',
                            borderRadius: '0.55rem',
                            border: '1px solid rgba(148, 163, 184, 0.24)',
                            background: 'rgba(2, 6, 23, 0.72)',
                            color: '#f8fafc',
                            fontSize: '0.76rem',
                            lineHeight: 1.4,
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                            wordBreak: 'normal',
                            overflowWrap: 'break-word',
                            userSelect: 'all',
                          }}
                        >
                          {formatSecretGroups(enrollment.secret)}
                        </code>
                        <button
                          type="button"
                          onClick={() => void handleCopySecret()}
                          style={{
                            minHeight: '44px',
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            padding: '0 0.85rem',
                            borderRadius: '0.55rem',
                            border: '1px solid rgba(148, 163, 184, 0.28)',
                            background: '#1e293b',
                            color: '#f8fafc',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {secretCopyState === 'copied' ? (
                            <Check size={15} strokeWidth={2} aria-hidden="true" />
                          ) : (
                            <Copy size={15} strokeWidth={1.75} aria-hidden="true" />
                          )}
                          <span>
                            {secretCopyState === 'copied'
                              ? 'Disalin'
                              : secretCopyState === 'failed'
                                ? 'Gagal'
                                : 'Salin'}
                          </span>
                        </button>
                        <span role="status" style={srOnlyStyle}>
                          {secretCopyState === 'copied'
                            ? 'Kunci secret disalin'
                            : secretCopyState === 'failed'
                              ? 'Gagal menyalin kunci secret'
                              : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '0.3rem' }}>
                    <label
                      htmlFor={otpInputId}
                      style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0' }}
                    >
                      2. Masukkan Kode 6 Digit
                    </label>
                    <p
                      id={otpHintId}
                      style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.38 }}
                    >
                      Buka Google Authenticator, Aegis, atau Authy lalu masukkan 6 angka yang tampil.
                    </p>
                    <input
                      id={otpInputId}
                      type="text"
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="\d{6}"
                      maxLength={6}
                      aria-describedby={otpHintId}
                      placeholder="000000"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      style={{
                        width: '100%',
                        minHeight: '48px',
                        boxSizing: 'border-box',
                        padding: '0.6rem 0.85rem',
                        paddingInlineStart: 'calc(0.85rem + 0.35em)',
                        textAlign: 'center',
                        borderRadius: '0.6rem',
                        border: '1px solid rgba(148, 163, 184, 0.32)',
                        background: '#0f172a',
                        color: '#ffffff',
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        letterSpacing: '0.35em',
                      }}
                    />
                  </div>
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
                  <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span>Muat Ulang Pendaftaran</span>
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
                    background: 'rgba(220, 38, 38, 0.14)',
                    border: '1px solid rgba(248, 113, 113, 0.32)',
                    color: '#fecaca',
                    fontSize: '0.82rem',
                    lineHeight: 1.45,
                  }}
                >
                  <AlertCircle size={16} strokeWidth={1.75} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{error}</span>
                </div>
              )}
            </form>
          ) : (
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '0.45rem',
                  padding: '0.85rem',
                  borderRadius: '0.65rem',
                  background: '#0f172a',
                  border: '1px solid rgba(245, 158, 11, 0.32)',
                }}
              >
                {backupCodes.map((c, idx) => (
                  <code
                    key={`${idx}-${c}`}
                    style={{
                      padding: '0.45rem 0.5rem',
                      borderRadius: '0.4rem',
                      background: 'rgba(30, 41, 59, 0.82)',
                      color: '#f8fafc',
                      fontSize: '0.82rem',
                      textAlign: 'center',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    }}
                  >
                    {c}
                  </code>
                ))}
              </div>

              <div style={{ display: 'grid' }}>
                <button
                  type="button"
                  onClick={() => void handleCopyBackupCodes()}
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
                  {backupCopyState === 'copied' ? (
                    <Check size={16} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
                  )}
                  <span>
                    {backupCopyState === 'copied'
                      ? 'Kode Cadangan Disalin'
                      : backupCopyState === 'failed'
                        ? 'Gagal Menyalin Kode'
                        : 'Salin Semua Kode'}
                  </span>
                </button>
                <span role="status" style={srOnlyStyle}>
                  {backupCopyState === 'copied'
                    ? 'Semua kode cadangan disalin'
                    : backupCopyState === 'failed'
                      ? 'Gagal menyalin kode cadangan'
                      : ''}
                </span>
              </div>

              <label
                style={{
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  fontSize: '0.84rem',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={savedAck}
                  onChange={(e) => setSavedAck(e.target.checked)}
                  style={{
                    width: '18px',
                    height: '18px',
                    flexShrink: 0,
                    accentColor: '#3b82f6',
                  }}
                />
                <span>Saya sudah menyimpan kode cadangan ini</span>
              </label>
            </div>
          )}
        </div>
      </main>

      {/* Zona 3: Sticky Bottom Action Bar */}
      <footer
        style={{
          flexShrink: 0,
          background: '#0f172a',
          borderTop: '1px solid rgba(148, 163, 184, 0.14)',
          padding: '0.65rem 1rem calc(0.75rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div style={{ maxWidth: '480px', width: '100%', margin: '0 auto' }}>
          {!completedPayload ? (
            <button
              type="submit"
              form={formId}
              disabled={!canSubmitOtp}
              style={{
                width: '100%',
                minHeight: '48px',
                padding: '0 1rem',
                border: 0,
                borderRadius: '0.65rem',
                background: canSubmitOtp ? '#2563eb' : '#1e3a8a',
                color: canSubmitOtp ? '#ffffff' : '#bfdbfe',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: busy ? 'wait' : canSubmitOtp ? 'pointer' : 'not-allowed',
              }}
            >
              {busy ? 'Mengaktifkan...' : 'Aktifkan & Verifikasi'}
            </button>
          ) : (
            <button
              type="button"
              disabled={!savedAck}
              onClick={() => onCompleted(completedPayload)}
              style={{
                width: '100%',
                minHeight: '48px',
                padding: '0 1rem',
                border: 0,
                borderRadius: '0.65rem',
                background: savedAck ? '#2563eb' : '#1e3a8a',
                color: savedAck ? '#ffffff' : '#bfdbfe',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: savedAck ? 'pointer' : 'not-allowed',
              }}
            >
              Ke Konsol Admin
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default MFAOnboardingModal;
