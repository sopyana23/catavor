import React, { useState, useEffect, useCallback } from 'react';
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
}

export const TabletConnectedDevicesView: React.FC<TabletConnectedDevicesViewProps> = ({
  token,
  showToast,
  onLogoutCurrent
}) => {
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

  const otherSessionsCount = sessions.filter(s => !s.is_current).length;

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      borderRadius: '1rem',
      border: '1px solid var(--border-light)',
      padding: '1.5rem',
      marginBottom: '1.5rem'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
              Sesi Perangkat Terhubung
            </h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Pantau dan amankan seluruh akses login ke akun katalog Anda di berbagai perangkat.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => fetchSessions(false)}
            disabled={loading}
            style={{
              minHeight: '40px',
              minWidth: '40px',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-deep)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          {otherSessionsCount > 0 && (
            <button
              type="button"
              onClick={() => setConfirmRevokeOthers(true)}
              style={{
                minHeight: '40px',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                color: '#ef4444',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer'
              }}
            >
              <LogOut size={15} />
              Cabut {otherSessionsCount} Sesi Lain
            </button>
          )}
        </div>
      </div>

      {/* Sessions List */}
      {loading && sessions.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Memuat sesi perangkat...
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Tidak ada sesi aktif terdeteksi.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sessions.map(s => {
            const Icon = getDeviceIcon(s.device_type || s.device_name || '');
            return (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  backgroundColor: s.is_current ? 'rgba(30, 58, 138, 0.08)' : 'var(--bg-deep)',
                  border: s.is_current ? '1.5px solid var(--primary)' : '1px solid var(--border-light)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '0.65rem',
                    backgroundColor: s.is_current ? 'rgba(30, 58, 138, 0.15)' : 'var(--bg-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: s.is_current ? 'var(--primary)' : 'var(--text-secondary)'
                  }}>
                    <Icon size={22} />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>
                        {s.device_name || `${s.browser || 'Browser'} di ${s.os || 'Perangkat'}`}
                      </span>
                      {s.is_current && (
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          padding: '0.1rem 0.45rem',
                          borderRadius: '999px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          <CheckCircle2 size={12} />
                          Perangkat Ini
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Globe size={13} />
                        IP: {s.ip_address || 'Lokal'}
                      </span>
                      {s.location && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <MapPin size={13} />
                          {s.location}
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={13} />
                        Aktif: {formatDateTime(s.last_active_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  {!s.is_current && (
                    <button
                      type="button"
                      onClick={() => setConfirmRevokeTarget(s)}
                      style={{
                        minHeight: '40px',
                        padding: '0.45rem 0.85rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-light)',
                        backgroundColor: 'var(--bg-card)',
                        color: '#ef4444',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Cabut Sesi
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
              Tindakan ini akan mengeluarkan <strong>{otherSessionsCount} perangkat lain</strong> secara seketika. Hanya sesi browser tablet saat ini yang akan tetap aktif.
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
