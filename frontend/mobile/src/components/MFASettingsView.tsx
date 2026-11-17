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
};

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
        throw new Error(json.message || 'Permintaan MFA gagal.');
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
    padding: '1rem',
    borderRadius: '0.85rem',
    border: '1px solid var(--border-light)',
    background: 'var(--surface, rgba(148,163,184,0.04))',
    marginBottom: '0.9rem',
  };
  const input: React.CSSProperties = {
    width: '100%',
    minHeight: '46px',
    boxSizing: 'border-box',
    padding: '0.68rem 0.8rem',
    borderRadius: '0.55rem',
    border: '1px solid var(--border-light)',
    background: 'var(--background, transparent)',
    color: 'var(--text-primary)',
    fontSize: '0.96rem',
  };
  const button: React.CSSProperties = {
    width: '100%',
    minHeight: '46px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.45rem',
    border: 0,
    borderRadius: '0.6rem',
    padding: '0 0.95rem',
    fontWeight: 700,
    fontSize: '0.88rem',
    cursor: busy ? 'wait' : 'pointer',
    background: 'var(--primary, #2563eb)',
    color: '#fff',
  };

  return (
    <section aria-label="Verifikasi dua langkah" style={{ display: 'grid', gap: '0.6rem' }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={19} strokeWidth={1.75} style={{ color: status?.enabled ? '#10b981' : 'var(--text-secondary)' }} />
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>Verifikasi Dua Langkah (MFA)</h3>
          </div>
          {status !== null && (
            <span
              style={{
                padding: '0.22rem 0.6rem',
                borderRadius: '999px',
                fontSize: '0.72rem',
                fontWeight: 700,
                background: status.enabled ? 'rgba(16, 185, 129, 0.14)' : 'rgba(148, 163, 184, 0.15)',
                color: status.enabled ? '#10b981' : 'var(--text-secondary)',
              }}
            >
              {status.enabled ? `Aktif${status.enforced ? ' · Wajib' : ''} (${status.backup_codes_left})` : 'Belum Aktif'}
            </span>
          )}
        </div>

        <p style={{ margin: '0 0 0.8rem', color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.5 }}>
          Gunakan aplikasi authenticator berbasis TOTP untuk melindungi akun. Kode cadangan hanya ditampilkan satu kali setelah aktivasi.
        </p>

        {needsReauth && (
          <div style={{ marginBottom: '0.8rem' }}>
            <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 700 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Lock size={14} strokeWidth={1.75} />
                Kata Sandi Saat Ini
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

        {status === null && <p role="status">Memuat status MFA...</p>}

        {status && !status.enabled && !enrollment && (
          <button type="button" disabled={busy} style={button} onClick={() => void start()}>
            <ShieldCheck size={17} strokeWidth={1.75} />
            {busy ? 'Memproses...' : 'Aktifkan MFA'}
          </button>
        )}

        {enrollment && (
          <form onSubmit={confirm} style={{ display: 'grid', gap: '0.75rem', marginTop: '0.6rem' }}>
            {enrollment.qr_data_url && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '164px', height: '164px', padding: '0.45rem', background: '#ffffff', borderRadius: '0.6rem', boxSizing: 'border-box' }}>
                  <img src={enrollment.qr_data_url} alt="QR Code Authenticator" style={{ width: '100%', height: '100%', display: 'block' }} />
                </div>
              </div>
            )}
            <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'grid', gap: '0.35rem' }}>
              Kunci Secret Setup (jangan dibagikan)
              <div style={{ display: 'flex', gap: '0.45rem' }}>
                <input
                  readOnly
                  value={enrollment.secret}
                  style={{ ...input, flex: 1, minWidth: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.8rem' }}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(enrollment.secret);
                    setCopiedSecret(true);
                    setTimeout(() => setCopiedSecret(false), 1800);
                  }}
                  style={{ ...button, width: 'auto', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
                >
                  {copiedSecret ? <Check size={15} strokeWidth={2} /> : <Copy size={15} strokeWidth={1.75} />}
                  {copiedSecret ? 'Disalin' : 'Salin'}
                </button>
              </div>
            </label>

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
                style={{ ...input, letterSpacing: '0.2em', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
              />
            </label>

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
          </form>
        )}

        {status?.enabled && status.enforced && (
          <div
            style={{
              padding: '0.65rem 0.75rem',
              borderRadius: '0.55rem',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
            }}
          >
            MFA wajib aktif untuk staf pengelola platform dan tidak dapat dinonaktifkan.
          </div>
        )}

        {status?.enabled && !status.enforced && (
          <form onSubmit={disable} style={{ display: 'grid', gap: '0.65rem', marginTop: '0.6rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'grid', gap: '0.35rem' }}>
              Kode Authenticator atau Kode Cadangan untuk Menonaktifkan
              <input
                autoComplete="one-time-code"
                inputMode="text"
                placeholder="6 digit TOTP atau kode cadangan"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={input}
              />
            </label>
            <button type="submit" disabled={busy || !code.trim()} style={{ ...button, background: '#dc2626' }}>
              <ShieldOff size={16} strokeWidth={1.75} />
              {busy ? 'Memproses...' : 'Nonaktifkan MFA'}
            </button>
          </form>
        )}

        {error && (
          <p role="alert" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#dc2626', margin: '0.7rem 0 0', fontSize: '0.82rem' }}>
            <AlertCircle size={15} strokeWidth={1.75} />
            <span>{error}</span>
          </p>
        )}
      </div>

      {backupCodes.length > 0 && (
        <div style={{ ...card, borderColor: '#f59e0b' }}>
          <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.92rem' }}>Kode Cadangan — Tampil Sekali</h4>
          <p style={{ margin: '0 0 0.7rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Simpan di tempat aman. Setiap kode hanya dapat digunakan satu kali.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.4rem' }}>
            {backupCodes.map((item, i) => (
              <code
                key={`${i}-${item}`}
                style={{ padding: '0.45rem', background: 'rgba(148,163,184,0.12)', borderRadius: '0.35rem', textAlign: 'center', fontSize: '0.82rem' }}
              >
                {item}
              </code>
            ))}
          </div>
          <button
            type="button"
            style={{ ...button, marginTop: '0.75rem' }}
            onClick={() => {
              void navigator.clipboard?.writeText(backupCodes.join('\n'));
              showToast('success', 'Kode cadangan disalin.');
            }}
          >
            <Copy size={16} strokeWidth={1.75} />
            Salin Semua Kode
          </button>
        </div>
      )}
    </section>
  );
}
