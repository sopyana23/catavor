import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, Copy, Check, AlertCircle, Lock } from 'lucide-react';
import { broadcastAuthEvent } from '../utils/authSync';

type Props = {
  token: string;
  apiBase: string;
  showToast: (type: 'success' | 'error', message: string) => void;
  onTokenUpdate?: (newToken: string) => void;
};

type MFAStatus = {
  enabled: boolean;
  enforced: boolean;
  mandatory_for_role?: boolean;
  backup_codes_left: number;
  enrolled_at?: string | null;
};

type Enrollment = {
  secret: string;
  otpauth_url: string;
  qr_data_url?: string;
  setup_jti?: string;
  issuer?: string;
  account?: string;
};

class MFARequestError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export function MFASettingsView({ token, apiBase, showToast, onTokenUpdate }: Props) {
  const [activeToken, setActiveToken] = useState(token);
  const [status, setStatus] = useState<MFAStatus | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [needsReauth, setNeedsReauth] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) setActiveToken(token);
  }, [token]);

  const syncRotatedToken = useCallback(
    (nextToken?: string | null) => {
      const cleaned = (nextToken || '').trim();
      if (!cleaned) return;
      setActiveToken(cleaned);
      try {
        localStorage.setItem('catavor_token', cleaned);
        broadcastAuthEvent({ type: 'LOGIN_SUCCESS', token: cleaned });
      } catch {}
      onTokenUpdate?.(cleaned);
    },
    [onTokenUpdate]
  );

  const request = useCallback(
    async (path: string, method = 'GET', body?: object, overrideToken?: string) => {
      const bearer = overrideToken || activeToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('catavor_token') || '' : '');
      const res = await fetch(`${apiBase}/auth/mfa/${path}`, {
        method,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const headerTok = res.headers.get('X-Refreshed-Token');
      const json = await res.json().catch(() => ({}));
      if (headerTok) {
        syncRotatedToken(headerTok);
      } else if (res.ok && typeof json.token === 'string' && json.token) {
        syncRotatedToken(json.token);
      }
      if (!res.ok || !json.success) {
        if (json.code === 'REAUTH_REQUIRED') {
          setNeedsReauth(true);
        }
        throw new MFARequestError(json.message || 'Permintaan MFA gagal.', json.code);
      }
      return json;
    },
    [apiBase, activeToken, syncRotatedToken]
  );

  const refresh = useCallback(
    async (overrideToken?: string) => {
      try {
        const json = await request('status', 'GET', undefined, overrideToken);
        setStatus(json.data);
        setError('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal memuat status MFA.');
      }
    },
    [request]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = currentPassword.trim() ? { current_password: currentPassword } : {};
      const json = await request('enroll', 'POST', payload);
      setEnrollment(json.data);
      setCode('');
      setBackupCodes([]);
      setNeedsReauth(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memulai pendaftaran MFA.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload: Record<string, string> = {
        code: code.trim(),
        ...(enrollment?.setup_jti ? { setup_jti: enrollment.setup_jti } : {}),
        ...(currentPassword.trim() ? { current_password: currentPassword } : {}),
      };
      const json = await request('confirm', 'POST', payload);
      const nextTok = typeof json.token === 'string' ? json.token : undefined;
      if (nextTok) syncRotatedToken(nextTok);
      setBackupCodes(json.data?.backup_codes || []);
      setEnrollment(null);
      setCode('');
      setCurrentPassword('');
      setNeedsReauth(false);
      await refresh(nextTok);
      showToast('success', 'Verifikasi dua langkah berhasil diaktifkan. Simpan kode cadangan dengan aman.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kode verifikasi tidak valid.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload: Record<string, string> = {
        code: code.trim(),
        ...(currentPassword.trim() ? { current_password: currentPassword } : {}),
      };
      const json = await request('disable', 'POST', payload);
      const nextTok = typeof json.token === 'string' ? json.token : undefined;
      if (nextTok) syncRotatedToken(nextTok);
      setCode('');
      setCurrentPassword('');
      setNeedsReauth(false);
      setBackupCodes([]);
      await refresh(nextTok);
      showToast('success', 'Verifikasi dua langkah dinonaktifkan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menonaktifkan MFA.');
    } finally {
      setBusy(false);
    }
  };

  const card: React.CSSProperties = {
    padding: '1.15rem 1.25rem',
    borderRadius: '0.8rem',
    border: '1px solid var(--border-light)',
    background: 'var(--surface, rgba(148,163,184,0.04))',
    marginBottom: '1rem',
  };
  const input: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.68rem 0.8rem',
    borderRadius: '0.55rem',
    border: '1px solid var(--border-light)',
    background: 'var(--background, transparent)',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
  };
  const button: React.CSSProperties = {
    width: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    border: 0,
    borderRadius: '0.55rem',
    padding: '0.62rem 1rem',
    fontWeight: 700,
    fontSize: '0.84rem',
    cursor: busy ? 'wait' : 'pointer',
    background: 'var(--primary, #2563eb)',
    color: '#fff',
  };

  return (
    <section aria-label="Verifikasi dua langkah" style={{ display: 'grid', gap: '0.6rem' }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <ShieldCheck size={19} strokeWidth={1.75} style={{ color: status?.enabled ? '#10b981' : 'var(--text-secondary)' }} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Verifikasi Dua Langkah (MFA / TOTP)</h3>
          </div>
          {status !== null && (
            <span
              style={{
                padding: '0.25rem 0.65rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: status.enabled ? 'rgba(16, 185, 129, 0.14)' : 'rgba(148, 163, 184, 0.15)',
                color: status.enabled ? '#10b981' : 'var(--text-secondary)',
              }}
            >
              {status.enabled ? `Aktif${status.enforced ? ' · Wajib' : ''} (${status.backup_codes_left} kode cadangan)` : 'Belum Aktif'}
            </span>
          )}
        </div>

        <p style={{ margin: '0 0 0.85rem', color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: 1.5 }}>
          Gunakan aplikasi authenticator berbasis TOTP (Google Authenticator, Aegis, 1Password, Authy) untuk melindungi akun dari pengambilalihan kata sandi.
        </p>

        {needsReauth && (
          <div style={{ marginBottom: '0.85rem' }}>
            <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 700 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Lock size={14} strokeWidth={1.75} />
                Konfirmasi Kata Sandi Saat Ini (sesi lebih dari 10 menit)
              </span>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Masukkan kata sandi akun saat ini"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={input}
              />
            </label>
          </div>
        )}

        {status === null ? (
          <p role="status" style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            Memuat status MFA...
          </p>
        ) : null}

        {status && !status.enabled && !enrollment && (
          <button type="button" disabled={busy} style={button} onClick={() => void start()}>
            <ShieldCheck size={16} strokeWidth={1.75} />
            {busy ? 'Memproses...' : 'Aktifkan MFA Sekarang'}
          </button>
        )}

        {enrollment && (
          <form onSubmit={confirm} style={{ display: 'grid', gap: '0.85rem', marginTop: '0.6rem' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: enrollment.qr_data_url ? '156px 1fr' : '1fr',
                gap: '1rem',
                alignItems: 'center',
                padding: '0.9rem',
                borderRadius: '0.65rem',
                border: '1px solid var(--border-light)',
              }}
            >
              {enrollment.qr_data_url && (
                <div style={{ width: '156px', height: '156px', padding: '0.4rem', background: '#ffffff', borderRadius: '0.55rem', boxSizing: 'border-box' }}>
                  <img src={enrollment.qr_data_url} alt="QR Code Authenticator" style={{ width: '100%', height: '100%', display: 'block' }} />
                </div>
              )}
              <div style={{ display: 'grid', gap: '0.55rem', minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '0.83rem', lineHeight: 1.45 }}>
                  Pindai QR code di samping dengan aplikasi authenticator atau salin kunci secret manual di bawah ini:
                </p>
                <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                  <input
                    readOnly
                    value={enrollment.secret}
                    style={{ ...input, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.82rem' }}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(enrollment.secret);
                      setCopiedSecret(true);
                      setTimeout(() => setCopiedSecret(false), 1800);
                    }}
                    style={{ ...button, background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
                  >
                    {copiedSecret ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />}
                    {copiedSecret ? 'Disalin' : 'Salin'}
                  </button>
                </div>
              </div>
            </div>

            <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'grid', gap: '0.35rem' }}>
              Kode 6 Digit dari Aplikasi Authenticator
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ ...input, maxWidth: '240px', letterSpacing: '0.2em', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
              />
            </label>

            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <button type="submit" disabled={busy || code.length !== 6} style={button}>
                {busy ? 'Memverifikasi...' : 'Konfirmasi & Aktifkan'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEnrollment(null);
                  setCode('');
                  setError('');
                }}
                style={{ ...button, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
              >
                Batal
              </button>
            </div>
          </form>
        )}

        {status?.enabled && status.enforced && (
          <div
            style={{
              padding: '0.65rem 0.8rem',
              borderRadius: '0.55rem',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
            }}
          >
            Kebijakan keamanan platform mewajibkan MFA selalu aktif bagi akun pengelola dan tidak dapat dinonaktifkan.
          </div>
        )}

        {status?.enabled && !status.enforced && (
          <form onSubmit={disable} style={{ display: 'grid', gap: '0.65rem', marginTop: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'grid', gap: '0.35rem' }}>
              Kode Authenticator atau Kode Cadangan untuk Menonaktifkan MFA
              <input
                autoComplete="one-time-code"
                inputMode="text"
                placeholder="6 digit TOTP atau kode cadangan"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={{ ...input, maxWidth: '320px', letterSpacing: '0.08em' }}
              />
            </label>
            <div>
              <button type="submit" disabled={busy || !code.trim()} style={{ ...button, background: '#dc2626' }}>
                <ShieldOff size={15} strokeWidth={1.75} />
                {busy ? 'Memproses...' : 'Nonaktifkan MFA'}
              </button>
            </div>
          </form>
        )}

        {error && (
          <p role="alert" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#dc2626', margin: '0.75rem 0 0', fontSize: '0.83rem' }}>
            <AlertCircle size={15} strokeWidth={1.75} />
            <span>{error}</span>
          </p>
        )}
      </div>

      {backupCodes.length > 0 && (
        <div style={{ ...card, borderColor: '#f59e0b' }}>
          <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem' }}>Kode Cadangan Darurat — Hanya Ditampilkan Sekali</h4>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Simpan kode berikut di tempat aman. Setiap kode hanya berlaku satu kali pemakaian.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '0.45rem' }}>
            {backupCodes.map((item, i) => (
              <code
                key={`${i}-${item}`}
                style={{ padding: '0.45rem', background: 'rgba(148,163,184,0.12)', borderRadius: '0.35rem', textAlign: 'center', fontSize: '0.84rem' }}
              >
                {item}
              </code>
            ))}
          </div>
          <div style={{ marginTop: '0.8rem' }}>
            <button
              type="button"
              style={button}
              onClick={() => {
                void navigator.clipboard?.writeText(backupCodes.join('\n'));
                showToast('success', 'Kode cadangan berhasil disalin.');
              }}
            >
              <Copy size={15} strokeWidth={1.75} />
              Salin Semua Kode
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
