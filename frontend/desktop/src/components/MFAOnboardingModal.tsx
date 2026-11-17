import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, Copy, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { useModalBackHandler } from '../utils/navigation';

type EnrollmentPayload = {
  secret: string;
  otpauth_url: string;
  qr_data_url?: string;
  setup_jti?: string;
  issuer?: string;
  account?: string;
};

type Props = {
  setupToken: string;
  email: string;
  apiBase: string;
  onCancel: () => void;
  onCompleted: (verifiedSessionPayload: any) => void;
};

/**
 * Dialog Onboarding Wajib MFA bagi Staf Pengelola Platform (Desktop Native Centered Modal).
 * Menggunakan setup_token terbatas (aud: catavor-mfa-enrollment) untuk menyelesaikan:
 *   1. POST /auth/mfa/enroll -> menampilkan QR SVG mandiri + secret manual
 *   2. POST /auth/mfa/confirm -> menerima sesi penuh MfaVerified=true + 10 kode cadangan sekali tampil
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

  useModalBackHandler({
    isOpen: true,
    onClose: () => {
      if (!busy && !completedPayload) onCancel();
    },
    modalId: 'desktop-mfa-onboarding',
    disabled: busy || Boolean(completedPayload),
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
        throw new Error(json.message || 'Gagal menyiapkan pendaftaran verifikasi dua langkah.');
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
      const codes: string[] = Array.isArray(json.data?.backup_codes) ? json.data.backup_codes : [];
      setBackupCodes(codes);
      setCompletedPayload(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengaktifkan verifikasi dua langkah.');
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
        if (e.target === e.currentTarget && !busy && !completedPayload) onCancel();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'rgba(2, 6, 23, 0.82)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.6rem 1.75rem',
          borderRadius: '0.95rem',
          border: '1px solid rgba(148, 163, 184, 0.24)',
          background: '#0f172a',
          color: '#f8fafc',
          boxShadow: '0 28px 70px -18px rgba(0, 0, 0, 0.8)',
        }}
      >
        {!completedPayload ? (
          <form onSubmit={handleConfirm} style={{ display: 'grid', gap: '1.05rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '0.65rem',
                  background: 'rgba(245, 158, 11, 0.14)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: '#fbbf24',
                }}
              >
                <ShieldAlert size={20} strokeWidth={1.75} />
              </div>
              <div>
                <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.12rem', fontWeight: 700 }}>
                  Aktivasi Wajib Verifikasi Dua Langkah (MFA)
                </h2>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.84rem', lineHeight: 1.5 }}>
                  Seluruh akun staf pengelola platform ({email}) wajib mengaktifkan autentikator TOTP sebelum mengakses konsol manajemen.
                </p>
              </div>
            </div>

            {loadingEnroll ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                Menyiapkan kunci kriptografi pendaftaran MFA...
              </div>
            ) : enrollment ? (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: enrollment.qr_data_url ? '164px 1fr' : '1fr',
                    gap: '1rem',
                    alignItems: 'center',
                    padding: '1rem',
                    borderRadius: '0.7rem',
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(148, 163, 184, 0.18)',
                  }}
                >
                  {enrollment.qr_data_url && (
                    <div
                      style={{
                        width: '164px',
                        height: '164px',
                        padding: '0.45rem',
                        borderRadius: '0.6rem',
                        background: '#ffffff',
                        boxSizing: 'border-box',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src={enrollment.qr_data_url}
                        alt="QR Code Pendaftaran MFA"
                        style={{ width: '100%', height: '100%', display: 'block' }}
                      />
                    </div>
                  )}
                  <div style={{ display: 'grid', gap: '0.55rem', minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.45 }}>
                      Pindai QR code di samping menggunakan Google Authenticator, Aegis, 1Password, atau Authy. Bila tidak dapat memindai, salin kunci manual berikut:
                    </div>
                    <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                      <input
                        readOnly
                        value={enrollment.secret}
                        onFocus={(e) => e.currentTarget.select()}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          padding: '0.5rem 0.65rem',
                          borderRadius: '0.45rem',
                          border: '1px solid rgba(148, 163, 184, 0.28)',
                          background: 'rgba(2, 6, 23, 0.7)',
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
                          width: 'auto',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.5rem 0.7rem',
                          borderRadius: '0.45rem',
                          border: '1px solid rgba(148, 163, 184, 0.28)',
                          background: '#1e293b',
                          color: '#e2e8f0',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {copiedSecret ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />}
                        {copiedSecret ? 'Disalin' : 'Salin'}
                      </button>
                    </div>
                  </div>
                </div>

                <label style={{ display: 'grid', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>
                  Masukkan Kode 6 Digit dari Aplikasi Authenticator
                  <input
                    autoFocus
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.75rem 0.85rem',
                      borderRadius: '0.55rem',
                      border: '1px solid rgba(148, 163, 184, 0.32)',
                      background: 'rgba(2, 6, 23, 0.65)',
                      color: '#f8fafc',
                      fontSize: '1.08rem',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      letterSpacing: '0.24em',
                    }}
                  />
                </label>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <button
                  type="button"
                  onClick={() => void startEnrollment()}
                  style={{
                    width: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.55rem 0.9rem',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    background: '#1e293b',
                    color: '#f8fafc',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={14} strokeWidth={1.75} />
                  Muat Ulang Pendaftaran
                </button>
              </div>
            )}

            {error && (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '0.5rem',
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.2rem' }}>
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                style={{
                  width: 'auto',
                  padding: '0.6rem 1rem',
                  borderRadius: '0.55rem',
                  border: '1px solid rgba(148, 163, 184, 0.28)',
                  background: 'transparent',
                  color: '#cbd5e1',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={busy || loadingEnroll || !enrollment || code.trim().length !== 6}
                style={{
                  width: 'auto',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '0.55rem',
                  border: 0,
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: busy ? 'wait' : 'pointer',
                  opacity: !enrollment || code.trim().length !== 6 ? 0.55 : 1,
                }}
              >
                {busy ? 'Mengaktifkan...' : 'Aktifkan & Verifikasi'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '0.65rem',
                  background: 'rgba(16, 185, 129, 0.14)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: '#34d399',
                }}
              >
                <ShieldCheck size={20} strokeWidth={1.75} />
              </div>
              <div>
                <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.12rem', fontWeight: 700 }}>
                  MFA Aktif — Simpan Kode Cadangan Anda
                </h2>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.84rem', lineHeight: 1.5 }}>
                  Kode cadangan berikut hanya ditampilkan satu kali ini saja. Simpan di pengelola kata sandi yang aman untuk pemulihan darurat.
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '0.45rem',
                padding: '0.9rem',
                borderRadius: '0.65rem',
                background: 'rgba(2, 6, 23, 0.7)',
                border: '1px solid rgba(245, 158, 11, 0.32)',
              }}
            >
              {backupCodes.map((c, idx) => (
                <code
                  key={`${idx}-${c}`}
                  style={{
                    padding: '0.45rem 0.6rem',
                    borderRadius: '0.4rem',
                    background: 'rgba(30, 41, 59, 0.75)',
                    color: '#f8fafc',
                    fontSize: '0.84rem',
                    textAlign: 'center',
                    letterSpacing: '0.06em',
                  }}
                >
                  {c}
                </code>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(backupCodes.join('\n'));
                  setCopiedBackup(true);
                  setTimeout(() => setCopiedBackup(false), 2000);
                }}
                style={{
                  width: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 0.9rem',
                  borderRadius: '0.5rem',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  background: '#1e293b',
                  color: '#f8fafc',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copiedBackup ? <Check size={15} strokeWidth={2} /> : <Copy size={15} strokeWidth={1.75} />}
                {copiedBackup ? 'Kode Cadangan Disalin' : 'Salin Semua Kode'}
              </button>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#cbd5e1', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={savedAck}
                  onChange={(e) => setSavedAck(e.target.checked)}
                />
                Saya sudah menyimpan kode cadangan ini
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <button
                type="button"
                disabled={!savedAck}
                onClick={() => onCompleted(completedPayload)}
                style={{
                  width: 'auto',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '0.55rem',
                  border: 0,
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: savedAck ? 'pointer' : 'not-allowed',
                  opacity: savedAck ? 1 : 0.5,
                }}
              >
                Lanjutkan ke Konsol Pengelola
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MFAOnboardingModal;
