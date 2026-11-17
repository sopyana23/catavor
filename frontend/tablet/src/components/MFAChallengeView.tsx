import React, { useState } from 'react';

type Props = { challenge: string; email: string; apiBase: string; onCancel: () => void; onVerified: (data: any) => void };

export function MFAChallengeView({ challenge, email, apiBase, onCancel, onVerified }: Props) {
  const [code, setCode] = useState('');
  const [factorType, setFactorType] = useState<'totp' | 'backup_code'>('totp');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/auth/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ challenge, code: code.trim(), factor_type: factorType })
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.token) throw new Error(data.message || 'Verifikasi dua langkah gagal.');
      onVerified(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Koneksi terputus ke server.');
    } finally {
      setBusy(false);
    }
  };

  return <div role="dialog" aria-modal="true" aria-label="Verifikasi dua langkah" style={{ position: 'fixed', inset: 0, zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', background: 'rgba(2, 6, 23, 0.82)', backdropFilter: 'blur(10px)' }}>
    <form onSubmit={submit} style={{ width: '100%', maxWidth: '420px', display: 'grid', gap: '0.9rem', padding: '1.5rem', borderRadius: '1.15rem', border: '1px solid rgba(148, 163, 184, 0.28)', background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.99) 100%)', boxShadow: '0 30px 70px -20px rgba(0, 0, 0, 0.8)' }}>
      <div><h2 style={{ margin: '0 0 0.35rem', fontSize: '1.2rem', color: '#f8fafc' }}>Verifikasi dua langkah</h2><p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.5 }}>Masukkan kode dari aplikasi authenticator, atau kode cadangan, untuk {email}.</p></div>
      <div role="group" aria-label="Jenis kode" style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" aria-pressed={factorType === 'totp'} onClick={() => { setFactorType('totp'); setCode(''); }} style={{ flex: 1, padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid rgba(148, 163, 184, 0.4)', background: factorType === 'totp' ? '#1d4ed8' : 'transparent', color: '#fff' }}>Authenticator</button>
        <button type="button" aria-pressed={factorType === 'backup_code'} onClick={() => { setFactorType('backup_code'); setCode(''); }} style={{ flex: 1, padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid rgba(148, 163, 184, 0.4)', background: factorType === 'backup_code' ? '#1d4ed8' : 'transparent', color: '#fff' }}>Kode cadangan</button>
      </div>
      <label style={{ display: 'grid', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1' }}>Kode verifikasi<input autoFocus required autoComplete="one-time-code" inputMode={factorType === 'totp' ? 'numeric' : 'text'} value={code} onChange={e => setCode(e.target.value.replace(/[^0-9A-Za-z-]/g, '').slice(0, 20))} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', borderRadius: '0.6rem', border: '1px solid rgba(148, 163, 184, 0.4)', background: 'rgba(2, 6, 23, 0.7)', color: '#fff', fontSize: '1.05rem', letterSpacing: '0.16em' }} /></label>
      {error && <p role="alert" style={{ margin: 0, color: '#fca5a5', fontSize: '0.84rem' }}>{error}</p>}
      <button type="submit" disabled={busy || code.trim().length < 6} style={{ padding: '0.8rem', border: 0, borderRadius: '0.6rem', background: '#2563eb', color: '#fff', fontWeight: 800, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Memverifikasi…' : 'Verifikasi & masuk'}</button>
      <button type="button" disabled={busy} onClick={onCancel} style={{ padding: '0.65rem', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '0.6rem', background: 'transparent', color: '#cbd5e1', cursor: 'pointer' }}>Kembali ke login</button>
    </form>
  </div>;
}

export default MFAChallengeView;
