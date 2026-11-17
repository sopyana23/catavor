import React, { useCallback, useEffect, useState } from 'react';

type Props = { token: string; apiBase: string; showToast: (type: 'success' | 'error', message: string) => void };
type MFAStatus = { enabled: boolean; enforced: boolean; backup_codes_left: number; enrolled_at?: string | null };
type Enrollment = { secret: string; otpauth_url: string; issuer?: string; account?: string };

export function MFASettingsView({ token, apiBase, showToast }: Props) {
  const [status, setStatus] = useState<MFAStatus | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const request = useCallback(async (path: string, method = 'GET', body?: object) => {
    const res = await fetch(`${apiBase}/auth/mfa/${path}`, {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Permintaan MFA gagal.');
    return json;
  }, [apiBase, token]);

  const refresh = useCallback(async () => {
    try {
      const json = await request('status');
      setStatus(json.data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat status MFA.');
    }
  }, [request]);

  useEffect(() => { void refresh(); }, [refresh]);

  const start = async () => {
    setBusy(true); setError('');
    try {
      const json = await request('enroll', 'POST', {});
      setEnrollment(json.data); setCode(''); setBackupCodes([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memulai pendaftaran MFA.');
    } finally { setBusy(false); }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const json = await request('confirm', 'POST', { code: code.trim() });
      setBackupCodes(json.data?.backup_codes || []); setEnrollment(null); setCode(''); await refresh();
      showToast('success', 'Verifikasi dua langkah berhasil diaktifkan. Simpan kode cadangan dengan aman.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kode verifikasi tidak valid.');
    } finally { setBusy(false); }
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await request('disable', 'POST', { code: code.trim() });
      setCode(''); setBackupCodes([]); await refresh();
      showToast('success', 'Verifikasi dua langkah dinonaktifkan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menonaktifkan MFA.');
    } finally { setBusy(false); }
  };

  const card: React.CSSProperties = { padding: '1rem', borderRadius: '0.8rem', border: '1px solid var(--border-light)', background: 'var(--surface, rgba(148,163,184,0.04))', marginBottom: '1rem' };
  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '0.7rem 0.8rem', borderRadius: '0.55rem', border: '1px solid var(--border-light)', background: 'var(--background, transparent)', color: 'var(--text-primary)', fontSize: '1rem', letterSpacing: '0.12em' };
  const button: React.CSSProperties = { border: 0, borderRadius: '0.55rem', padding: '0.65rem 0.9rem', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', background: 'var(--primary)', color: '#fff' };

  return <section aria-label="Verifikasi dua langkah" style={{ display: 'grid', gap: '0.6rem' }}>
    <div style={card}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Verifikasi dua langkah (MFA)</h3>
      <p style={{ margin: '0 0 0.75rem', color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: 1.5 }}>Gunakan aplikasi authenticator berbasis TOTP untuk melindungi akun. Kode cadangan hanya ditampilkan sekali setelah aktivasi.</p>
      {status === null ? <p role="status">Memuat status MFA…</p> : <p style={{ margin: '0 0 0.8rem', fontWeight: 700 }}>{status.enabled ? `Aktif${status.enforced ? ' (wajib)' : ''} · ${status.backup_codes_left} kode cadangan tersisa` : 'Belum aktif'}</p>}
      {status && !status.enabled && !enrollment && <button type="button" disabled={busy} style={button} onClick={() => void start()}>{busy ? 'Memproses…' : 'Aktifkan MFA'}</button>}
      {enrollment && <form onSubmit={confirm} style={{ display: 'grid', gap: '0.65rem', marginTop: '0.8rem' }}>
        <p style={{ margin: 0, fontSize: '0.84rem' }}>Tambahkan akun ini di aplikasi authenticator dengan memindai URL atau memasukkan secret secara manual.</p>
        <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Secret setup (jangan dibagikan)<input readOnly value={enrollment.secret} style={{ ...input, letterSpacing: '0.04em', marginTop: '0.35rem' }} onFocus={e => e.currentTarget.select()} /></label>
        <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>otpauth URL<input readOnly value={enrollment.otpauth_url} style={{ ...input, fontSize: '0.72rem', letterSpacing: 0, marginTop: '0.35rem' }} onFocus={e => e.currentTarget.select()} /></label>
        <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Kode 6 digit dari aplikasi<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} style={{ ...input, marginTop: '0.35rem' }} /></label>
        <button type="submit" disabled={busy || code.length !== 6} style={button}>{busy ? 'Memverifikasi…' : 'Konfirmasi & aktifkan'}</button>
        <button type="button" disabled={busy} onClick={() => { setEnrollment(null); setCode(''); }} style={{ ...button, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>Batal</button>
      </form>}
      {status?.enabled && <form onSubmit={disable} style={{ display: 'grid', gap: '0.65rem', marginTop: '0.8rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Kode authenticator atau kode cadangan untuk menonaktifkan<input autoComplete="one-time-code" inputMode="text" required value={code} onChange={e => setCode(e.target.value)} style={{ ...input, marginTop: '0.35rem' }} /></label>
        <button type="submit" disabled={busy || !code.trim()} style={{ ...button, background: '#dc2626' }}>{busy ? 'Memproses…' : 'Nonaktifkan MFA'}</button>
      </form>}
      {error && <p role="alert" style={{ color: '#dc2626', margin: '0.7rem 0 0', fontSize: '0.84rem' }}>{error}</p>}
    </div>
    {backupCodes.length > 0 && <div style={{ ...card, borderColor: '#f59e0b' }}>
      <h4 style={{ margin: '0 0 0.45rem' }}>Kode cadangan — tampil sekali</h4>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem' }}>Simpan di tempat aman. Setiap kode hanya dapat digunakan satu kali.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: '0.45rem' }}>{backupCodes.map((item, i) => <code key={`${i}-${item}`} style={{ padding: '0.45rem', background: 'rgba(148,163,184,0.12)', borderRadius: '0.35rem', textAlign: 'center' }}>{item}</code>)}</div>
      <button type="button" style={{ ...button, marginTop: '0.8rem' }} onClick={() => { void navigator.clipboard?.writeText(backupCodes.join('\n')); showToast('success', 'Kode cadangan disalin.'); }}>Salin kode</button>
    </div>}
  </section>;
}
