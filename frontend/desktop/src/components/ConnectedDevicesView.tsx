import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  Laptop, 
  Smartphone, 
  Tablet, 
  Globe, 
  LogOut, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Clock, 
  MapPin, 
  X, 
  Monitor
} from 'lucide-react';
import { setupModalBackInterceptor } from '../utils/navigation';

export interface UserSessionItem {
  id: number;
  device_name: string;
  device_type: string;
  browser: string;
  os: string;
  ip_address: string;
  location?: string;
  last_active_at: string;
  created_at: string;
  is_current: boolean;
}

interface ConnectedDevicesViewProps {
  token: string;
  apiBase?: string;
  onLogoutCurrent?: () => void;
  showToast?: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const ConnectedDevicesView: React.FC<ConnectedDevicesViewProps> = ({
  token,
  apiBase = '/api',
  onLogoutCurrent,
  showToast
}) => {
  const [sessions, setSessions] = useState<UserSessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [revokingAll, setRevokingAll] = useState<boolean>(false);
  const [confirmRevokeTarget, setConfirmRevokeTarget] = useState<UserSessionItem | null>(null);
  const [confirmRevokeOthers, setConfirmRevokeOthers] = useState<boolean>(false);

  // Setup Back interceptor for confirmation modals
  useEffect(() => {
    if (confirmRevokeTarget) {
      return setupModalBackInterceptor(() => setConfirmRevokeTarget(null));
    }
  }, [confirmRevokeTarget]);

  useEffect(() => {
    if (confirmRevokeOthers) {
      return setupModalBackInterceptor(() => setConfirmRevokeOthers(null as any));
    }
  }, [confirmRevokeOthers]);

  const fetchSessions = useCallback(async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch(`${apiBase}/user/sessions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data)) {
        setSessions(data.data);
      } else {
        if (!isSilent && showToast) {
          showToast('error', data.message || 'Gagal mengambil data sesi perangkat.');
        }
      }
    } catch {
      if (!isSilent && showToast) {
        showToast('error', 'Koneksi ke server gagal saat memuat sesi perangkat.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiBase, showToast]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevokeSingle = async (session: UserSessionItem) => {
    setRevokingId(session.id);
    try {
      const res = await fetch(`${apiBase}/user/sessions/${session.id}/revoke`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (session.is_current && onLogoutCurrent) {
          if (showToast) showToast('info', 'Sesi saat ini telah dicabut. Anda akan dialihkan keluar.');
          setTimeout(() => onLogoutCurrent(), 800);
          return;
        }
        if (showToast) showToast('success', `Akses perangkat "${session.device_name}" berhasil dicabut.`);
        setSessions(prev => prev.filter(s => s.id !== session.id));
      } else {
        if (showToast) showToast('error', data.message || 'Gagal mencabut sesi perangkat.');
      }
    } catch {
      if (showToast) showToast('error', 'Terjadi kesalahan jaringan.');
    } finally {
      setRevokingId(null);
      setConfirmRevokeTarget(null);
    }
  };

  const handleRevokeAllOthers = async () => {
    setRevokingAll(true);
    try {
      const res = await fetch(`${apiBase}/user/sessions/revoke-others`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (showToast) showToast('success', 'Seluruh perangkat lain berhasil dikeluarkan dengan aman.');
        setSessions(prev => prev.filter(s => s.is_current));
      } else {
        if (showToast) showToast('error', data.message || 'Gagal mengeluarkan perangkat lain.');
      }
    } catch {
      if (showToast) showToast('error', 'Terjadi kesalahan jaringan.');
    } finally {
      setRevokingAll(false);
      setConfirmRevokeOthers(false);
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Baru saja';
      const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diffSec < 60) return 'Baru saja';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} menit yang lalu`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam yang lalu`;
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Baru saja';
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType.toLowerCase()) {
      case 'mobile':
        return <Smartphone size={22} style={{ color: 'var(--primary)' }} />;
      case 'tablet':
        return <Tablet size={22} style={{ color: 'var(--primary)' }} />;
      default:
        return <Laptop size={22} style={{ color: 'var(--primary)' }} />;
    }
  };

  const currentSession = sessions.find(s => s.is_current);
  const otherSessions = sessions.filter(s => !s.is_current);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header Card */}
      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'var(--card-bg-gradient)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'var(--primary-glow)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
            <ShieldCheck size={26} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Perangkat Terhubung &amp; Sesi Login
              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '999px', background: 'var(--primary-glow)', color: 'var(--primary)', border: '1px solid var(--primary-glow)' }}>
                NIST SP 800-63B SECURE
              </span>
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Pantau seluruh browser dan perangkat yang sedang aktif menggunakan akun Anda. Cabut akses perangkat yang tidak Anda kenali sewaktu-waktu.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchSessions(true)}
          disabled={loading || refreshing}
          className="btn-secondary"
          style={{ padding: '0.5rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.45rem', borderRadius: '0.6rem' }}
          title="Segarkan daftar perangkat"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Menyinkronkan...' : 'Perbarui Sesi'}</span>
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 0.75rem auto', color: 'var(--primary)' }} />
          <p style={{ fontSize: '0.88rem', margin: 0 }}>Memuat daftar perangkat terhubung...</p>
        </div>
      ) : (
        <>
          {/* Section: Sesi Saat Ini (Perangkat Ini) */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Monitor size={15} style={{ color: 'var(--primary)' }} />
              <span>Sesi Saat Ini (Perangkat Ini)</span>
            </div>

            {currentSession ? (
              <div 
                className="glass-panel" 
                style={{ 
                  padding: '1.25rem 1.5rem', 
                  borderRadius: '1rem', 
                  border: '1.5px solid var(--primary)', 
                  background: 'linear-gradient(135deg, var(--primary-glow) 0%, var(--card-bg-gradient, var(--bg-card)) 100%)', 
                  boxShadow: '0 8px 24px var(--primary-glow)', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  flexWrap: 'wrap', 
                  gap: '1rem' 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'var(--primary-glow)',
                    border: '1.5px solid var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)',
                    flexShrink: 0
                  }}>
                    {getDeviceIcon(currentSession.device_type)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {currentSession.device_name}
                      </span>
                      <span style={{ 
                        fontSize: '0.68rem', 
                        fontWeight: 800, 
                        color: 'var(--primary)', 
                        background: 'var(--primary-glow)', 
                        padding: '0.18rem 0.6rem', 
                        borderRadius: '999px', 
                        border: '1px solid var(--primary)', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.4rem',
                        letterSpacing: '0.02em'
                      }}>
                        <span style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: 'var(--primary)',
                          boxShadow: '0 0 8px var(--primary)',
                          display: 'inline-block'
                        }} />
                        Aktif Sekarang &bull; Perangkat Ini
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Globe size={13} style={{ color: 'var(--primary)' }} />
                        Alamat IP: <strong style={{ color: 'var(--text-primary)' }}>{currentSession.ip_address}</strong>
                      </span>
                      <span>&bull;</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                        Login: {formatRelativeTime(currentSession.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  color: 'var(--primary)',
                  background: 'var(--primary-glow)',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '0.65rem',
                  border: '1px solid var(--primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 8px var(--primary-glow)'
                }}>
                  <ShieldCheck size={14} style={{ color: 'var(--primary)' }} />
                  <span>Perangkat Terverifikasi</span>
                </div>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '0.85rem', color: 'var(--text-secondary)', fontSize: '0.82rem', border: '1px solid var(--border-light)' }}>
                Sesi saat ini sedang aktif secara lokal.
              </div>
            )}
          </div>

          {/* Section: Perangkat Lain yang Aktif */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Globe size={15} style={{ color: 'var(--primary)' }} />
                <span>Perangkat Lain yang Terhubung ({otherSessions.length})</span>
              </div>

              {otherSessions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmRevokeOthers(true)}
                  disabled={revokingAll}
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <LogOut size={13} />
                  <span>{revokingAll ? 'Memproses...' : 'Keluarkan dari Semua Perangkat Lain'}</span>
                </button>
              )}
            </div>

            {otherSessions.length === 0 ? (
              <div 
                className="glass-panel" 
                style={{ 
                  padding: '2.5rem 1.5rem', 
                  borderRadius: '1rem', 
                  border: '1px dashed var(--border-light)', 
                  textAlign: 'center', 
                  color: 'var(--text-muted)' 
                }}
              >
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto' }}>
                  <CheckCircle2 size={22} style={{ color: '#10b981' }} />
                </div>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Tidak Ada Sesi Lain yang Aktif
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '420px', marginInline: 'auto' }}>
                  Akun Anda saat ini hanya terhubung dan aktif pada browser/perangkat ini. Tidak ada riwayat login terbuka di tempat lain.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {otherSessions.map(session => {
                  const isRevokingThis = revokingId === session.id;
                  return (
                    <div
                      key={session.id}
                      className="glass-panel"
                      style={{
                        padding: '1.15rem 1.35rem',
                        borderRadius: '0.85rem',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        transition: 'border-color 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {getDeviceIcon(session.device_type)}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {session.device_name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginTop: '0.25rem', fontSize: '0.76rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Globe size={12} />
                              {session.ip_address}
                            </span>
                            <span>•</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Clock size={12} />
                              Aktif: {formatRelativeTime(session.last_active_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setConfirmRevokeTarget(session)}
                        disabled={isRevokingThis}
                        style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          color: '#f87171',
                          padding: '0.45rem 0.85rem',
                          borderRadius: '0.55rem',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: isRevokingThis ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <LogOut size={13} />
                        <span>{isRevokingThis ? 'Mencabut...' : 'Cabut Sesi'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirmation Modal: Revoke Single Session */}
      {confirmRevokeTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel animate-scale-up" style={{ width: '100%', maxWidth: '440px', padding: '1.5rem', borderRadius: '1.15rem', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(9, 14, 26, 0.99) 100%)', boxShadow: '0 25px 60px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                    Cabut Sesi Perangkat?
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Konfirmasi Pengeluaran Akun</span>
                </div>
              </div>
              <button type="button" onClick={() => setConfirmRevokeTarget(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 1.25rem 0' }}>
              Perangkat <strong>{confirmRevokeTarget.device_name}</strong> (IP: {confirmRevokeTarget.ip_address}) akan langsung dikeluarkan dari akun Anda. Sesi token di perangkat tersebut akan dibatalkan secara permanen.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmRevokeTarget(null)}
                style={{ padding: '0.55rem 1.15rem', fontSize: '0.82rem', borderRadius: '0.6rem' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleRevokeSingle(confirmRevokeTarget)}
                disabled={revokingId === confirmRevokeTarget.id}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '0.6rem',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 4px 15px rgba(220, 38, 38, 0.35)'
                }}
              >
                <LogOut size={14} />
                <span>{revokingId === confirmRevokeTarget.id ? 'Mencabut...' : 'Ya, Cabut Sesi'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Revoke All Other Sessions */}
      {confirmRevokeOthers && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel animate-scale-up" style={{ width: '100%', maxWidth: '460px', padding: '1.5rem', borderRadius: '1.15rem', border: '1px solid rgba(239, 68, 68, 0.35)', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(9, 14, 26, 0.99) 100%)', boxShadow: '0 25px 60px rgba(0,0,0,0.85)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                    Keluarkan Semua Perangkat Lain?
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Tindakan Pengamanan Akun Massal</span>
                </div>
              </div>
              <button type="button" onClick={() => setConfirmRevokeOthers(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 1.25rem 0' }}>
              Seluruh perangkat dan browser lain yang saat ini sedang login dengan akun Anda akan langsung dikeluarkan seketika. Hanya sesi di browser saat ini yang akan tetap aktif.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmRevokeOthers(false)}
                style={{ padding: '0.55rem 1.15rem', fontSize: '0.82rem', borderRadius: '0.6rem' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRevokeAllOthers}
                disabled={revokingAll}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.55rem 1.35rem',
                  borderRadius: '0.6rem',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 4px 15px rgba(220, 38, 38, 0.35)'
                }}
              >
                <LogOut size={14} />
                <span>{revokingAll ? 'Memproses...' : 'Keluarkan Semua Perangkat Lain'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
