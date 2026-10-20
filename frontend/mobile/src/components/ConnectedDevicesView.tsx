import React, { useState, useEffect, useCallback, useRef } from 'react';
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

  // Drag-to-dismiss gesture state for Single Device Revoke Sheet
  const [targetSheetDragY, setTargetSheetDragY] = useState(0);
  const [isTargetSheetDragging, setIsTargetSheetDragging] = useState(false);
  const targetTouchStartY = useRef(0);

  const handleTargetDragStart = (clientY: number) => {
    targetTouchStartY.current = clientY;
    setIsTargetSheetDragging(true);
  };

  const handleTargetDragMove = (clientY: number) => {
    if (!isTargetSheetDragging) return;
    const delta = clientY - targetTouchStartY.current;
    if (delta > 0) {
      setTargetSheetDragY(delta);
    } else {
      setTargetSheetDragY(delta * 0.15);
    }
  };

  const handleTargetDragEnd = () => {
    if (!isTargetSheetDragging) return;
    setIsTargetSheetDragging(false);
    if (targetSheetDragY > 70) {
      setConfirmRevokeTarget(null);
    }
    setTargetSheetDragY(0);
  };

  // Drag-to-dismiss gesture state for Others Devices Revoke Sheet
  const [othersSheetDragY, setOthersSheetDragY] = useState(0);
  const [isOthersSheetDragging, setIsOthersSheetDragging] = useState(false);
  const othersTouchStartY = useRef(0);

  const handleOthersDragStart = (clientY: number) => {
    othersTouchStartY.current = clientY;
    setIsOthersSheetDragging(true);
  };

  const handleOthersDragMove = (clientY: number) => {
    if (!isOthersSheetDragging) return;
    const delta = clientY - othersTouchStartY.current;
    if (delta > 0) {
      setOthersSheetDragY(delta);
    } else {
      setOthersSheetDragY(delta * 0.15);
    }
  };

  const handleOthersDragEnd = () => {
    if (!isOthersSheetDragging) return;
    setIsOthersSheetDragging(false);
    if (othersSheetDragY > 70) {
      setConfirmRevokeOthers(false);
    }
    setOthersSheetDragY(0);
  };

  // Setup Back interceptor for confirmation bottom sheets / modals
  useEffect(() => {
    if (confirmRevokeTarget) {
      return setupModalBackInterceptor(() => setConfirmRevokeTarget(null));
    }
  }, [confirmRevokeTarget]);

  useEffect(() => {
    if (confirmRevokeOthers) {
      return setupModalBackInterceptor(() => setConfirmRevokeOthers(false));
    }
  }, [confirmRevokeOthers]);

  const fetchSessions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`${apiBase}/user/sessions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSessions(data.sessions || []);
      } else {
        if (showToast) showToast('error', data.message || 'Gagal memuat sesi terhubung');
      }
    } catch (err: any) {
      if (showToast) showToast('error', 'Koneksi gagal saat memuat sesi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiBase, token, showToast]);

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
          onLogoutCurrent();
          return;
        }
        setSessions(prev => prev.filter(s => s.id !== session.id));
        if (showToast) showToast('success', `Sesi perangkat ${session.device_name} berhasil dicabut`);
      } else {
        if (showToast) showToast('error', data.message || 'Gagal mencabut sesi perangkat');
      }
    } catch (err: any) {
      if (showToast) showToast('error', 'Terjadi kesalahan sistem saat mencabut sesi');
    } finally {
      setRevokingId(null);
      setConfirmRevokeTarget(null);
    }
  };

  const handleRevokeOthers = async () => {
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
        setSessions(prev => prev.filter(s => s.is_current));
        if (showToast) showToast('success', `Berhasil mengeluarkan ${data.revoked_count || 'semua'} perangkat lainnya.`);
      } else {
        if (showToast) showToast('error', data.message || 'Gagal mengeluarkan perangkat lain');
      }
    } catch (err: any) {
      if (showToast) showToast('error', 'Terjadi kesalahan saat mengeluarkan perangkat');
    } finally {
      setRevokingAll(false);
      setConfirmRevokeOthers(false);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'mobile':
      case 'phone':
        return <Smartphone size={20} />;
      case 'tablet':
        return <Tablet size={20} />;
      case 'desktop':
      case 'pc':
      case 'laptop':
        return <Laptop size={20} />;
      default:
        return <Monitor size={20} />;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return 'Baru saja';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
      if (diffSec < 60) return 'Aktif beberapa detik lalu';
      if (diffSec < 3600) return `Aktif ${Math.floor(diffSec / 60)} menit lalu`;
      if (diffSec < 86400) return `Aktif ${Math.floor(diffSec / 3600)} jam lalu`;
      return `Aktif ${Math.floor(diffSec / 86400)} hari lalu`;
    } catch {
      return dateStr;
    }
  };

  const currentSession = sessions.find(s => s.is_current);
  const otherSessions = sessions.filter(s => !s.is_current);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="animate-fade-in">
      {/* Header Banner */}
      <div className="glass-panel" style={{
        padding: '1rem',
        borderRadius: '0.85rem',
        border: '1px solid var(--border-light)',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 900, padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)' }}>
              KEAMANAN AKUN
            </span>
          </div>
          <button
            type="button"
            onClick={() => fetchSessions(true)}
            disabled={refreshing || loading}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Muat Ulang
          </button>
        </div>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0.4rem 0 0 0', color: 'var(--text-primary)' }}>
          Perangkat Terhubung &amp; Sesi Aktif
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', margin: '0.25rem 0 0 0', lineHeight: 1.45 }}>
          Lacak perangkat yang login ke akun Anda. Jika ada perangkat mencurigakan, segera cabut izin aksesnya.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto', color: 'var(--primary)' }} />
          Memeriksa sesi login aktif...
        </div>
      ) : (
        <>
          {/* Current Device Card */}
          {currentSession && (
            <div className="glass-panel" style={{
              padding: '1rem',
              borderRadius: '0.85rem',
              border: '1.5px solid var(--primary)',
              background: 'rgba(16, 185, 129, 0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  <CheckCircle2 size={11} /> Perangkat Saat Ini
                </span>
                <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                  Sedang Aktif
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--primary-glow)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {getDeviceIcon(currentSession.device_type)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {currentSession.device_name || 'Perangkat Ini'}
                  </h4>
                  <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {currentSession.browser || 'Browser'} • {currentSession.os || 'OS'}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <Globe size={11} /> IP: {currentSession.ip_address || '-'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <Clock size={11} /> {formatTimeAgo(currentSession.last_active_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Other Devices Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.2rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Perangkat Lain ({otherSessions.length})
              </h4>
              {otherSessions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmRevokeOthers(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <LogOut size={12} /> Keluarkan Semua
                </button>
              )}
            </div>

            {otherSessions.length === 0 ? (
              <div className="glass-panel" style={{
                padding: '1.25rem',
                borderRadius: '0.75rem',
                border: '1px solid var(--border-light)',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.78rem'
              }}>
                <ShieldCheck size={28} style={{ color: '#10b981', margin: '0 auto 0.4rem auto', opacity: 0.8 }} />
                <p style={{ margin: 0, fontWeight: 600 }}>Tidak ada sesi login dari perangkat lain</p>
                <span style={{ fontSize: '0.7rem' }}>Akun Anda saat ini hanya terhubung di perangkat ini saja.</span>
              </div>
            ) : (
              otherSessions.map(sess => (
                <div 
                  key={sess.id}
                  className="glass-panel"
                  style={{
                    padding: '0.9rem 1rem',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {getDeviceIcon(sess.device_type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h5 style={{ margin: '0 0 0.1rem 0', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sess.device_name || 'Perangkat Lain'}
                      </h5>
                      <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sess.browser} • {sess.os} • IP: {sess.ip_address}
                      </p>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.15rem' }}>
                        {formatTimeAgo(sess.last_active_at)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setConfirmRevokeTarget(sess)}
                    disabled={revokingId === sess.id}
                    style={{
                      padding: '0.45rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      color: '#ef4444',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    {revokingId === sess.id ? 'Memproses...' : 'Cabut'}
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Confirmation Bottom Sheet: Single Revoke */}
      {confirmRevokeTarget && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
          onClick={() => setConfirmRevokeTarget(null)}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'var(--bg-surface, #1e293b)',
              borderTopLeftRadius: '1.25rem',
              borderTopRightRadius: '1.25rem',
              padding: '0.75rem 1.25rem 2rem 1.25rem',
              border: '1px solid var(--border-light)',
              transform: `translateY(${Math.max(0, targetSheetDragY)}px)`,
              transition: isTargetSheetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Sheet Drag Handle Bar (Touch & Mouse Drag-Down to Dismiss) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '0.25rem 0 0.65rem 0',
                cursor: 'grab',
                touchAction: 'none'
              }}
              onTouchStart={(e) => handleTargetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleTargetDragMove(e.touches[0].clientY)}
              onTouchEnd={handleTargetDragEnd}
              onMouseDown={(e) => handleTargetDragStart(e.clientY)}
              onMouseMove={(e) => handleTargetDragMove(e.clientY)}
              onMouseUp={handleTargetDragEnd}
            >
              <div
                style={{
                  width: '44px',
                  height: '5px',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(255,255,255,0.25)'
                }}
              />
            </div>

            {/* Clean Header (Standard Mobile: No X button, dismiss via drag handle, backdrop, or footer Batal) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '1rem',
                cursor: 'grab',
                touchAction: 'none'
              }}
              onTouchStart={(e) => handleTargetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleTargetDragMove(e.touches[0].clientY)}
              onTouchEnd={handleTargetDragEnd}
              onMouseDown={(e) => handleTargetDragStart(e.clientY)}
              onMouseMove={(e) => handleTargetDragMove(e.clientY)}
              onMouseUp={handleTargetDragEnd}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Cabut Akses Perangkat?
                </h4>
              </div>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>
              Sesi login pada <strong>{confirmRevokeTarget.device_name}</strong> akan langsung dibatalkan. Pengguna pada perangkat tersebut harus login ulang.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setConfirmRevokeTarget(null)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '0.65rem',
                  border: '1px solid var(--border-light)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.82rem'
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleRevokeSingle(confirmRevokeTarget)}
                disabled={revokingId === confirmRevokeTarget.id}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '0.65rem',
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.82rem'
                }}
              >
                {revokingId === confirmRevokeTarget.id ? 'Mencabut...' : 'Ya, Cabut Sesi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Bottom Sheet: Revoke All Others */}
      {confirmRevokeOthers && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
          onClick={() => setConfirmRevokeOthers(false)}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'var(--bg-surface, #1e293b)',
              borderTopLeftRadius: '1.25rem',
              borderTopRightRadius: '1.25rem',
              padding: '0.75rem 1.25rem 2rem 1.25rem',
              border: '1px solid var(--border-light)',
              transform: `translateY(${Math.max(0, othersSheetDragY)}px)`,
              transition: isOthersSheetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Sheet Drag Handle Bar (Touch & Mouse Drag-Down to Dismiss) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '0.25rem 0 0.65rem 0',
                cursor: 'grab',
                touchAction: 'none'
              }}
              onTouchStart={(e) => handleOthersDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleOthersDragMove(e.touches[0].clientY)}
              onTouchEnd={handleOthersDragEnd}
              onMouseDown={(e) => handleOthersDragStart(e.clientY)}
              onMouseMove={(e) => handleOthersDragMove(e.clientY)}
              onMouseUp={handleOthersDragEnd}
            >
              <div
                style={{
                  width: '44px',
                  height: '5px',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(255,255,255,0.25)'
                }}
              />
            </div>

            {/* Clean Header (Standard Mobile: No X button, dismiss via drag handle, backdrop, or footer Batal) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '1rem',
                cursor: 'grab',
                touchAction: 'none'
              }}
              onTouchStart={(e) => handleOthersDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleOthersDragMove(e.touches[0].clientY)}
              onTouchEnd={handleOthersDragEnd}
              onMouseDown={(e) => handleOthersDragStart(e.clientY)}
              onMouseMove={(e) => handleOthersDragMove(e.clientY)}
              onMouseUp={handleOthersDragEnd}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Keluarkan Seluruh Perangkat Lain?
                </h4>
              </div>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>
              Semua {otherSessions.length} sesi perangkat lain akan langsung dicabut dan dikeluarkan dari akun Anda. Hanya perangkat saat ini yang tetap terhubung.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setConfirmRevokeOthers(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '0.65rem',
                  border: '1px solid var(--border-light)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.82rem'
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRevokeOthers}
                disabled={revokingAll}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '0.65rem',
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.82rem'
                }}
              >
                {revokingAll ? 'Mengeluarkan...' : 'Ya, Keluarkan Semua'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
