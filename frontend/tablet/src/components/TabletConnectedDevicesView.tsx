import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  Laptop,
  Smartphone,
  Tablet,
  Globe,
  LogOut,
  AlertTriangle,
  RefreshCw,
  Clock,
  MapPin,
  Monitor,
  CheckCircle2
} from 'lucide-react';
import { useModalBackHandler } from '../utils/navigation';
import { createAuthFetch } from '../utils/auth';

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

export interface TabletConnectedDevicesViewProps {
  token: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onLogoutCurrent?: () => void;
  onLogout?: () => void;
  onUnauthorized?: (msg?: string) => void;
}

export const TabletConnectedDevicesView: React.FC<TabletConnectedDevicesViewProps> = ({
  token,
  showToast,
  onLogoutCurrent,
  onLogout,
  onUnauthorized
}) => {
  // Centralized authenticated fetch with automatic 401/403 session eviction
  const fetch = useMemo(() => {
    return createAuthFetch({
      getToken: () => token,
      onUnauthorized: (msg) => {
        if (onUnauthorized) {
          onUnauthorized(msg);
        } else if (onLogoutCurrent) {
          onLogoutCurrent();
        } else if (onLogout) {
          onLogout();
        }
      }
    });
  }, [token, onUnauthorized, onLogoutCurrent, onLogout]);
  const [sessions, setSessions] = useState<UserSessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [revokingAll, setRevokingAll] = useState<boolean>(false);
  const [confirmRevokeTarget, setConfirmRevokeTarget] = useState<UserSessionItem | null>(null);
  const [confirmRevokeOthers, setConfirmRevokeOthers] = useState<boolean>(false);

  // Modal Back Interceptors
  useModalBackHandler({
    isOpen: confirmRevokeTarget !== null,
    onClose: () => setConfirmRevokeTarget(null),
    modalId: 'confirm_revoke_single'
  });

  useModalBackHandler({
    isOpen: confirmRevokeOthers,
    onClose: () => setConfirmRevokeOthers(false),
    modalId: 'confirm_revoke_all'
  });

  const fetchSessions = useCallback(async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setLoading(true);

    try {
      const res = await fetch('/api/user/sessions', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data)) {
        setSessions(data.data);
      } else {
        if (!isSilent) showToast(data.message || 'Gagal memuat daftar sesi perangkat', 'error');
      }
    } catch {
      if (!isSilent) showToast('Terjadi kesalahan jaringan saat memuat sesi', 'error');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevokeSingle = async () => {
    if (!confirmRevokeTarget || !token) return;
    setRevokingId(confirmRevokeTarget.id);
    try {
      const res = await fetch(`/api/user/sessions/${confirmRevokeTarget.id}/revoke`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Sesi perangkat berhasil dicabut.');
        if (confirmRevokeTarget.is_current && onLogoutCurrent) {
          onLogoutCurrent();
        } else {
          setSessions(prev => prev.filter(s => s.id !== confirmRevokeTarget.id));
        }
      } else {
        showToast(data.message || 'Gagal mencabut sesi perangkat', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server saat mencabut sesi', 'error');
    } finally {
      setRevokingId(null);
      setConfirmRevokeTarget(null);
    }
  };

  const handleRevokeOthers = async () => {
    if (!token) return;
    setRevokingAll(true);
    try {
      const res = await fetch('/api/user/sessions/revoke-others', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Seluruh sesi perangkat lain berhasil dicabut.');
        setSessions(prev => prev.filter(s => s.is_current));
      } else {
        showToast(data.message || 'Gagal mencabut sesi lain', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server', 'error');
    } finally {
      setRevokingAll(false);
      setConfirmRevokeOthers(false);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    const type = deviceType.toLowerCase();
    if (type.includes('mobile') || type.includes('phone') || type.includes('android') || type.includes('ios')) {
      return Smartphone;
    }
    if (type.includes('tablet') || type.includes('ipad')) {
      return Tablet;
    }
    if (type.includes('desktop') || type.includes('pc') || type.includes('mac') || type.includes('windows')) {
      return Monitor;
    }
    return Laptop;
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const currentSession = sessions.find(s => s.is_current);
  const otherSessions = sessions.filter(s => !s.is_current);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
      {/* Top Header Card */}
      <div className="glass-panel" style={{
        padding: '1.5rem',
        borderRadius: '1rem',
        border: '1px solid var(--border-light)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        background: 'var(--card-bg-gradient)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10b981',
            flexShrink: 0
          }}>
            <ShieldCheck size={26} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              Perangkat Terhubung &amp; Sesi Login
              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
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
          onClick={() => fetchSessions(false)}
          disabled={loading}
          className="btn-secondary"
          style={{ minHeight: '44px', padding: '0.5rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.45rem', borderRadius: '0.6rem' }}
          title="Segarkan daftar perangkat"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Menyinkronkan...' : 'Perbarui Sesi'}</span>
        </button>
      </div>

      {loading && sessions.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 0.75rem auto', color: 'var(--primary)' }} />
          <p style={{ fontSize: '0.88rem', margin: 0 }}>Memuat daftar perangkat terhubung...</p>
        </div>
      ) : (
        <>
          {/* Section 1: Sesi Saat Ini (Perangkat Ini) */}
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
                  border: '1.5px solid rgba(16, 185, 129, 0.4)',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(15, 23, 42, 0.8) 100%)',
                  boxShadow: '0 8px 25px rgba(16, 185, 129, 0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {(() => {
                    const DevIcon = getDeviceIcon(currentSession.device_type || currentSession.device_name || '');
                    return (
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                        <DevIcon size={24} />
                      </div>
                    );
                  })()}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {currentSession.device_name || `${currentSession.browser || 'Browser'} di ${currentSession.os || 'Perangkat'}`}
                      </span>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: '#10b981',
                        background: 'rgba(16, 185, 129, 0.15)',
                        padding: '0.15rem 0.55rem',
                        borderRadius: '999px',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                        Aktif Sekarang &bull; Perangkat Ini
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Globe size={13} style={{ color: 'var(--primary)' }} />
                        Alamat IP: <strong style={{ color: 'var(--text-primary)' }}>{currentSession.ip_address || 'Lokal'}</strong>
                      </span>
                      {currentSession.location && (
                        <>
                          <span>&bull;</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <MapPin size={13} />
                            {currentSession.location}
                          </span>
                        </>
                      )}
                      <span>&bull;</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={13} />
                        Login: {formatDateTime(currentSession.created_at || currentSession.last_active_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 600, background: 'rgba(16, 185, 129, 0.08)', padding: '0.35rem 0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  Perangkat Terverifikasi
                </div>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '0.85rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                Sesi saat ini sedang aktif secara lokal.
              </div>
            )}
          </div>

          {/* Section 2: Perangkat Lain yang Terhubung */}
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
                  const DevIcon = getDeviceIcon(session.device_type || session.device_name || '');
                  const isRevokingThis = revokingId === session.id;
                  return (
                    <div
                      key={session.id}
                      className="glass-panel"
                      style={{
                        padding: '1.15rem 1.25rem',
                        borderRadius: '0.85rem',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.85rem',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-secondary)',
                          flexShrink: 0
                        }}>
                          <DevIcon size={20} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                            {session.device_name || `${session.browser || 'Browser'} di ${session.os || 'Perangkat'}`}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Globe size={12} />
                              IP: {session.ip_address || 'Lokal'}
                            </span>
                            {session.location && (
                              <>
                                <span>&bull;</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <MapPin size={12} />
                                  {session.location}
                                </span>
                              </>
                            )}
                            <span>&bull;</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Clock size={12} />
                              Aktif: {formatDateTime(session.last_active_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setConfirmRevokeTarget(session)}
                        disabled={isRevokingThis}
                        style={{
                          minHeight: '40px',
                          padding: '0.45rem 0.9rem',
                          borderRadius: '0.5rem',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          color: '#ef4444',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: isRevokingThis ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <LogOut size={14} />
                        <span>{isRevokingThis ? 'Mencabut...' : 'Cabut Akses'}</span>
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1rem',
            border: '1px solid var(--border-light)',
            padding: '1.5rem',
            maxWidth: '440px',
            width: '100%',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertTriangle size={20} />
              </div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                Cabut Sesi Perangkat?
              </h4>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
              Perangkat <strong>{confirmRevokeTarget.device_name || confirmRevokeTarget.browser}</strong> akan dikeluarkan secara otomatis dan memerlukan login ulang untuk mengakses katalog.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setConfirmRevokeTarget(null)}
                style={{
                  minHeight: '44px',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={revokingId !== null}
                onClick={handleRevokeSingle}
                style={{
                  minHeight: '44px',
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: revokingId !== null ? 'not-allowed' : 'pointer'
                }}
              >
                {revokingId !== null ? 'Mencabut...' : 'Ya, Cabut Sesi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Revoke All Other Sessions */}
      {confirmRevokeOthers && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1rem',
            border: '1px solid var(--border-light)',
            padding: '1.5rem',
            maxWidth: '440px',
            width: '100%',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <LogOut size={20} />
              </div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                Cabut Seluruh Sesi Lain?
              </h4>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
              Tindakan ini akan mengeluarkan <strong>{otherSessions.length} perangkat lain</strong> secara seketika. Hanya sesi browser tablet saat ini yang akan tetap aktif.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setConfirmRevokeOthers(false)}
                style={{
                  minHeight: '44px',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={revokingAll}
                onClick={handleRevokeOthers}
                style={{
                  minHeight: '44px',
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: revokingAll ? 'not-allowed' : 'pointer'
                }}
              >
                {revokingAll ? 'Mencabut Semua...' : 'Ya, Cabut Semua'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
