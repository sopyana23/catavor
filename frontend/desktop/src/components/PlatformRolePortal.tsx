import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Send,
  CreditCard,
  FileText,
  Layers,
  Activity,
  Sparkles,
  TrendingUp,
  Users,
  Search,
  Filter,
  Eye,
  Check,
  Trash2,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Megaphone,
  DollarSign,
  AlertCircle,
  HelpCircle,
  BarChart3,
  Calendar,
  Lock,
  Tag,
  LogOut
} from 'lucide-react';
import { type UserRBACInfo, hasPermission, isSuperAdmin, getRoleBadge } from '../utils/rbac';
import { AdminRBACManagement } from './AdminRBACManagement';

interface PlatformRolePortalProps {
  token: string;
  currentUser: UserRBACInfo | null;
  onNavigateToTab?: (tab: string) => void;
  onClose?: () => void;
  onLogout?: () => void;
}

export const PlatformRolePortal: React.FC<PlatformRolePortalProps> = ({
  token,
  currentUser,
  onNavigateToTab,
  onClose,
  onLogout
}) => {
  const roleSlug = currentUser?.platform_role || (currentUser?.is_superadmin ? 'superadmin' : 'merchant');
  const roleBadge = getRoleBadge(roleSlug);

  // Available division tabs based on permissions / role
  const canAccessRBAC = isSuperAdmin(currentUser) || hasPermission(currentUser, 'system:admins:manage');
  const canAccessCompliance = hasPermission(currentUser, 'compliance:reports:manage') || hasPermission(currentUser, 'compliance:dormancy:manage') || isSuperAdmin(currentUser);
  const canAccessSupport = hasPermission(currentUser, 'support:tickets:read') || hasPermission(currentUser, 'support:tickets:reply') || isSuperAdmin(currentUser);
  const canAccessFinance = hasPermission(currentUser, 'finance:orders:read') || isSuperAdmin(currentUser);
  const canAccessContent = hasPermission(currentUser, 'monetization:google:manage') || hasPermission(currentUser, 'content:broadcast:send') || isSuperAdmin(currentUser);

  // Default active division
  const getDefaultDivision = (): 'overview' | 'rbac' | 'compliance' | 'support' | 'finance' | 'content' => {
    if (isSuperAdmin(currentUser)) return 'overview';
    if (roleSlug === 'compliance' && canAccessCompliance) return 'compliance';
    if (roleSlug === 'support' && canAccessSupport) return 'support';
    if (roleSlug === 'finance' && canAccessFinance) return 'finance';
    if (roleSlug === 'content' && canAccessContent) return 'content';
    if (canAccessCompliance) return 'compliance';
    if (canAccessSupport) return 'support';
    if (canAccessFinance) return 'finance';
    if (canAccessContent) return 'content';
    return 'overview';
  };

  const [activeDivision, setActiveDivision] = useState<'overview' | 'rbac' | 'compliance' | 'support' | 'finance' | 'content'>(getDefaultDivision());
  const [loading, setLoading] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // State: Compliance
  const [reports, setReports] = useState<any[]>([]);
  const [reportsFilter, setReportsFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [dormancyMetrics, setDormancyMetrics] = useState<any | null>(null);

  // State: Support
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsFilter, setTicketsFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [ticketActionLoading, setTicketActionLoading] = useState(false);

  // State: Finance
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersFilter, setOrdersFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // State: Content
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', type: 'info', target_role: 'all' });

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setNotificationMsg({ text, type });
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  // Fetch data per division
  const fetchDivisionData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (activeDivision === 'compliance' || activeDivision === 'overview') {
        if (canAccessCompliance) {
          const res = await fetch('/api/admin/reports', { credentials: 'omit', headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            setReports(Array.isArray(data) ? data : data.data || []);
          }
          const dormRes = await fetch('/api/admin/dormancy/metrics', { credentials: 'omit', headers: { Authorization: `Bearer ${token}` } });
          if (dormRes.ok) {
            const dData = await dormRes.json();
            setDormancyMetrics(dData);
          }
        }
      }

      if (activeDivision === 'support' || activeDivision === 'overview') {
        if (canAccessSupport) {
          const res = await fetch('/api/admin/support/tickets', { credentials: 'omit', headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            setTickets(Array.isArray(data) ? data : data.data || data.tickets || []);
          }
        }
      }

      if (activeDivision === 'finance' || activeDivision === 'overview') {
        if (canAccessFinance) {
          const res = await fetch('/api/admin/subscription/orders', { credentials: 'omit', headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            setOrders(Array.isArray(data) ? data : data.data || data.orders || []);
          }
        }
      }

      if (activeDivision === 'content' || activeDivision === 'overview') {
        if (canAccessContent) {
          const broadRes = await fetch('/api/admin/notifications', { credentials: 'omit', headers: { Authorization: `Bearer ${token}` } });
          if (broadRes.ok) {
            const bData = await broadRes.json();
            setBroadcasts(Array.isArray(bData) ? bData : bData.data || []);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load division data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDivisionData();
  }, [activeDivision, token]);

  // Support Reply Action
  const handleReplyTicket = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    setTicketActionLoading(true);
    try {
      const res = await fetch(`/api/admin/support/tickets/${selectedTicket.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: replyMessage })
      });
      if (res.ok) {
        showToast('Balasan staf berhasil terkirim!', 'success');
        setReplyMessage('');
        fetchDivisionData();
      } else {
        showToast('Gagal mengirim balasan tiket', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setTicketActionLoading(false);
    }
  };

  // Support Status Update
  const handleUpdateTicketStatus = async (ticketId: number | string, status: string) => {
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        showToast(`Status tiket berhasil diubah menjadi ${status.toUpperCase()}`, 'success');
        fetchDivisionData();
        if (selectedTicket && selectedTicket.id === ticketId) {
          setSelectedTicket({ ...selectedTicket, status });
        }
      }
    } catch (e) {
      showToast('Gagal mengubah status tiket', 'error');
    }
  };

  // Compliance Report Status Update
  const handleUpdateReportStatus = async (reportId: number, status: string) => {
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        showToast(`Laporan #${reportId} berhasil diupdate ke ${status}`, 'success');
        fetchDivisionData();
        setSelectedReport(null);
      } else {
        showToast('Gagal memperbarui status laporan', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan koneksi', 'error');
    }
  };

  // Content Broadcast Send
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) return;
    try {
      const res = await fetch('/api/admin/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(broadcastForm)
      });
      if (res.ok) {
        showToast('Siaran notifikasi platform berhasil disebarkan!', 'success');
        setShowBroadcastModal(false);
        setBroadcastForm({ title: '', message: '', type: 'info', target_role: 'all' });
        fetchDivisionData();
      } else {
        showToast('Gagal mengirim siaran notifikasi', 'error');
      }
    } catch (e) {
      showToast('Kesalahan jaringan pengiriman siaran', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Toast */}
      {notificationMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '0.85rem 1.4rem',
          borderRadius: '0.75rem',
          backgroundColor: notificationMsg.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(244, 63, 94, 0.95)',
          color: '#fff',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontWeight: 600,
          backdropFilter: 'blur(8px)',
          animation: 'fadeInDown 0.3s ease-out'
        }}>
          {notificationMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{notificationMsg.text}</span>
        </div>
      )}

      {/* Hero Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
        border: '1px solid var(--border-light)',
        borderRadius: '1.25rem',
        padding: '1.75rem 2rem',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        backdropFilter: 'blur(16px)'
      }}>
        <div style={{
          position: 'absolute',
          top: '-30px',
          right: '-30px',
          width: '180px',
          height: '180px',
          background: `radial-gradient(circle, ${roleBadge.color}25 0%, transparent 70%)`,
          filter: 'blur(20px)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '1rem',
              backgroundColor: roleBadge.bg,
              border: `1px solid ${roleBadge.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: roleBadge.color,
              boxShadow: `0 0 20px ${roleBadge.color}30`
            }}>
              {roleSlug === 'compliance' ? <ShieldAlert size={28} /> :
               roleSlug === 'support' ? <HelpCircle size={28} /> :
               roleSlug === 'finance' ? <CreditCard size={28} /> :
               roleSlug === 'content' ? <Megaphone size={28} /> :
               <Shield size={28} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  Portal Operasional Platform
                </h1>
                <span style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: roleBadge.bg,
                  color: roleBadge.color,
                  border: `1px solid ${roleBadge.border}`,
                  letterSpacing: '0.02em'
                }}>
                  {roleBadge.label}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Akun Staf: <strong>{currentUser?.email || 'admin@catavor.com'}</strong> &bull; {currentUser?.permissions?.length || (isSuperAdmin(currentUser) ? 'Seluruh' : 0)} Izin Akses Aktif
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={fetchDivisionData}
              disabled={loading}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>Segarkan Data</span>
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                style={{
                  padding: '0.6rem 1rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#ef4444',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                title="Keluar Sesi"
              >
                <LogOut size={15} />
                <span>Keluar</span>
              </button>
            )}
          </div>
        </div>

        {/* Division Switcher Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginTop: '1.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          overflowX: 'auto'
        }}>
          <button
            onClick={() => setActiveDivision('overview')}
            style={{
              padding: '0.55rem 1.1rem',
              borderRadius: '0.65rem',
              backgroundColor: activeDivision === 'overview' ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
              border: 'none',
              color: activeDivision === 'overview' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              transition: 'all 0.2s'
            }}
          >
            <Layers size={16} />
            <span>Ringkasan Eksekutif</span>
          </button>

          {canAccessRBAC && (
            <button
              onClick={() => setActiveDivision('rbac')}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '0.65rem',
                backgroundColor: activeDivision === 'rbac' ? '#f43f5e' : 'rgba(255,255,255,0.04)',
                border: 'none',
                color: activeDivision === 'rbac' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                transition: 'all 0.2s'
              }}
            >
              <Shield size={16} />
              <span>Staf &amp; Hak Akses RBAC</span>
            </button>
          )}

          {canAccessCompliance && (
            <button
              onClick={() => setActiveDivision('compliance')}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '0.65rem',
                backgroundColor: activeDivision === 'compliance' ? '#f59e0b' : 'rgba(255,255,255,0.04)',
                border: 'none',
                color: activeDivision === 'compliance' ? '#000' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                transition: 'all 0.2s'
              }}
            >
              <ShieldAlert size={16} />
              <span>Kepatuhan &amp; Satwa</span>
              {reports.filter(r => r.status === 'pending').length > 0 && (
                <span style={{
                  padding: '0.15rem 0.45rem',
                  borderRadius: '999px',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  fontSize: '0.7rem',
                  fontWeight: 800
                }}>
                  {reports.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
          )}

          {canAccessSupport && (
            <button
              onClick={() => setActiveDivision('support')}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '0.65rem',
                backgroundColor: activeDivision === 'support' ? '#0ea5e9' : 'rgba(255,255,255,0.04)',
                border: 'none',
                color: activeDivision === 'support' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                transition: 'all 0.2s'
              }}
            >
              <HelpCircle size={16} />
              <span>Customer Support</span>
              {tickets.filter(t => t.status === 'open').length > 0 && (
                <span style={{
                  padding: '0.15rem 0.45rem',
                  borderRadius: '999px',
                  backgroundColor: '#38bdf8',
                  color: '#000',
                  fontSize: '0.7rem',
                  fontWeight: 800
                }}>
                  {tickets.filter(t => t.status === 'open').length}
                </span>
              )}
            </button>
          )}

          {canAccessFinance && (
            <button
              onClick={() => setActiveDivision('finance')}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '0.65rem',
                backgroundColor: activeDivision === 'finance' ? '#10b981' : 'rgba(255,255,255,0.04)',
                border: 'none',
                color: activeDivision === 'finance' ? '#000' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                transition: 'all 0.2s'
              }}
            >
              <CreditCard size={16} />
              <span>Keuangan &amp; Billing</span>
              {orders.filter(o => o.status === 'pending').length > 0 && (
                <span style={{
                  padding: '0.15rem 0.45rem',
                  borderRadius: '999px',
                  backgroundColor: '#34d399',
                  color: '#000',
                  fontSize: '0.7rem',
                  fontWeight: 800
                }}>
                  {orders.filter(o => o.status === 'pending').length}
                </span>
              )}
            </button>
          )}

          {canAccessContent && (
            <button
              type="button"
              onClick={() => setActiveDivision('content')}
              style={{
                padding: '0.65rem 1.15rem',
                borderRadius: '0.75rem',
                backgroundColor: activeDivision === 'content' ? '#8b5cf6' : 'rgba(255,255,255,0.04)',
                border: 'none',
                color: activeDivision === 'content' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                transition: 'all 0.2s'
              }}
            >
              <Megaphone size={16} />
              <span>Konten &amp; Siaran</span>
              {broadcasts.length > 0 && (
                <span style={{
                  padding: '0.15rem 0.45rem',
                  borderRadius: '999px',
                  backgroundColor: '#c084fc',
                  color: '#000',
                  fontSize: '0.7rem',
                  fontWeight: 800
                }}>
                  {broadcasts.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 0. STAF & RBAC MANAGEMENT VIEW                                            */}
      {/* ========================================================================= */}
      {activeDivision === 'rbac' && canAccessRBAC && (
        <AdminRBACManagement token={token} currentUserEmail={currentUser?.email} />
      )}

      {/* ========================================================================= */}
      {/* 1. OVERVIEW / EXECUTIVE DASHBOARD                                         */}
      {/* ========================================================================= */}
      {activeDivision === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: '1rem',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }} onClick={() => setActiveDivision('compliance')}>
              <div>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Laporan Kepatuhan</p>
                <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b' }}>{reports.length}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{reports.filter(r => r.status === 'pending').length} butuh tindakan</span>
              </div>
              <div style={{ width: '48px', height: '48px', borderRadius: '0.75rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                <ShieldAlert size={24} />
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid rgba(14, 165, 233, 0.2)',
              borderRadius: '1rem',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }} onClick={() => setActiveDivision('support')}>
              <div>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Tiket Dukungan</p>
                <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#0ea5e9' }}>{tickets.length}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{tickets.filter(t => t.status === 'open').length} belum dijawab</span>
              </div>
              <div style={{ width: '48px', height: '48px', borderRadius: '0.75rem', backgroundColor: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}>
                <HelpCircle size={24} />
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '1rem',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }} onClick={() => setActiveDivision('finance')}>
              <div>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Pesanan Langganan</p>
                <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>{orders.length}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{orders.filter(o => o.status === 'pending').length} pending</span>
              </div>
              <div style={{ width: '48px', height: '48px', borderRadius: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                <CreditCard size={24} />
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '1rem',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }} onClick={() => setActiveDivision('content')}>
              <div>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Siaran Platform</p>
                <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#8b5cf6' }}>{broadcasts.length}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Pengumuman Aktif</span>
              </div>
              <div style={{ width: '48px', height: '48px', borderRadius: '0.75rem', backgroundColor: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                <Megaphone size={24} />
              </div>
            </div>
          </div>

          {/* Quick Action Hub */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1rem',
            padding: '1.5rem'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem', color: 'var(--text-primary)' }}>
              Pusat Kendali Divisi Operasional
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem' }}>
              Pilih divisi di atas untuk mulai meninjau laporan, tiket dukungan pelanggan, pembayaran langganan toko, atau moderasi artikel.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                <h4 style={{ margin: '0 0 0.5rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <ShieldAlert size={16} /> Divisi Kepatuhan
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Memverifikasi kepatuhan satwa dilindungi, menindaklanjuti laporan sengketa pembeli, dan mengelola toko inaktif.
                </p>
              </div>
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                <h4 style={{ margin: '0 0 0.5rem', color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <HelpCircle size={16} /> Divisi Customer Support
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Menjawab tiket kendala teknis merchant, live response chat, dan eskalasi penanganan masalah transaksi.
                </p>
              </div>
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                <h4 style={{ margin: '0 0 0.5rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <CreditCard size={16} /> Divisi Keuangan &amp; Billing
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Konfirmasi pembayaran langganan paket Pro/Enterprise dan verifikasi bukti transfer manual merchant.
                </p>
              </div>
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                <h4 style={{ margin: '0 0 0.5rem', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Megaphone size={16} /> Divisi Konten &amp; Editorial
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Moderasi komentar publik pada blog komunitas dan penyiaran broadcast notifikasi massal platform.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. COMPLIANCE & SATWA DIVISION                                            */}
      {/* ========================================================================= */}
      {activeDivision === 'compliance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header & Filter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text-primary)' }}>
                Pengawasan Kepatuhan &amp; Satwa
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Moderasi laporan pengaduan pelanggaran etalase, satwa terlarang, dan metrik toko inaktif.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['all', 'pending', 'investigating', 'resolved', 'dismissed'].map(status => (
                <button
                  key={status}
                  onClick={() => setReportsFilter(status)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '0.5rem',
                    backgroundColor: reportsFilter === status ? '#f59e0b' : 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    color: reportsFilter === status ? '#000' : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {status === 'all' ? 'Semua' : status}
                </button>
              ))}
            </div>
          </div>

          {/* Reports Table Card */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1rem',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.85rem 1.25rem' }}>ID &amp; Tanggal</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Subjek / Tipe</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Toko / Item Terlapor</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Pelapor</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {reports
                    .filter(r => reportsFilter === 'all' || r.status === reportsFilter)
                    .map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                          #{r.id}
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                            {r.created_at ? new Date(r.created_at).toLocaleDateString('id-ID') : '-'}
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.subject || r.reason || 'Laporan Pengaduan'}</span>
                          <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>{r.type || 'Etalase'}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                          {r.store_name || r.store_slug || r.target_title || '-'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                          {r.reporter_name || r.reporter_email || 'Anonim'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor:
                              r.status === 'resolved' ? 'rgba(16, 185, 129, 0.15)' :
                              r.status === 'investigating' ? 'rgba(245, 158, 11, 0.15)' :
                              r.status === 'dismissed' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color:
                              r.status === 'resolved' ? '#10b981' :
                              r.status === 'investigating' ? '#f59e0b' :
                              r.status === 'dismissed' ? '#94a3b8' : '#ef4444',
                            border: `1px solid ${
                              r.status === 'resolved' ? 'rgba(16, 185, 129, 0.3)' :
                              r.status === 'investigating' ? 'rgba(245, 158, 11, 0.3)' :
                              r.status === 'dismissed' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                            }`
                          }}>
                            {r.status?.toUpperCase() || 'PENDING'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedReport(r)}
                            style={{
                              padding: '0.4rem 0.8rem',
                              borderRadius: '0.5rem',
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              color: '#f59e0b',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Tinjau &amp; Aksi
                          </button>
                        </td>
                      </tr>
                    ))}
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <ShieldCheck size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5, display: 'block', color: '#10b981' }} />
                        Tidak ada laporan pelanggaran aktif saat ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Report Action Modal */}
      {selectedReport && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1.25rem',
            width: '100%',
            maxWidth: '560px',
            padding: '1.75rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={20} color="#f59e0b" /> Tinjau Laporan #{selectedReport.id}
              </h3>
              <button onClick={() => setSelectedReport(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <XCircle size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
              <div style={{ padding: '0.85rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                <p style={{ margin: '0 0 0.25rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Deskripsi / Alasan Laporan:</p>
                <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {selectedReport.description || selectedReport.reason || 'Tidak ada keterangan tambahan.'}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Pelapor:</span>
                  <p style={{ margin: '0.2rem 0 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedReport.reporter_name || selectedReport.reporter_email || 'Anonim'}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Target Toko/Item:</span>
                  <p style={{ margin: '0.2rem 0 0', fontWeight: 600, color: '#f59e0b' }}>
                    {selectedReport.store_name || selectedReport.store_slug || '-'}
                  </p>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.6rem' }}>
                  Tetapkan Status Penanganan Kepatuhan:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleUpdateReportStatus(selectedReport.id, 'investigating')}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      color: '#f59e0b',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Investigasi
                  </button>
                  <button
                    onClick={() => handleUpdateReportStatus(selectedReport.id, 'resolved')}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      color: '#10b981',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Selesai / Ditindak
                  </button>
                  <button
                    onClick={() => handleUpdateReportStatus(selectedReport.id, 'dismissed')}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'rgba(148, 163, 184, 0.15)',
                      border: '1px solid rgba(148, 163, 184, 0.4)',
                      color: '#94a3b8',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Tolak Laporan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CUSTOMER SUPPORT DIVISION                                              */}
      {/* ========================================================================= */}
      {activeDivision === 'support' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text-primary)' }}>
                Pusat Bantuan &amp; Tiket Pengguna
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Kelola pertanyaan dan eskalasi teknis dari seluruh pemilik toko dan pengunjung platform.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['all', 'open', 'in_progress', 'resolved', 'closed'].map(status => (
                <button
                  key={status}
                  onClick={() => setTicketsFilter(status)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '0.5rem',
                    backgroundColor: ticketsFilter === status ? '#0ea5e9' : 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    color: ticketsFilter === status ? '#fff' : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {status === 'all' ? 'Semua' : status}
                </button>
              ))}
            </div>
          </div>

          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1rem',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.85rem 1.25rem' }}>Tiket ID</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Subjek &amp; Toko</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Pengguna / Email</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Prioritas</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets
                    .filter(t => ticketsFilter === 'all' || t.status === ticketsFilter)
                    .map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                          #{t.id}
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                            {t.created_at ? new Date(t.created_at).toLocaleDateString('id-ID') : '-'}
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.subject || t.title || 'Pertanyaan Pengguna'}</span>
                          <div style={{ fontSize: '0.75rem', color: '#0ea5e9' }}>{t.store_slug || t.store_name || 'Umum'}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                          {t.user_email || t.email || t.user_name || '-'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            padding: '0.15rem 0.5rem',
                            borderRadius: '0.35rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            backgroundColor: t.priority === 'urgent' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                            color: t.priority === 'urgent' ? '#ef4444' : '#0ea5e9',
                            textTransform: 'uppercase'
                          }}>
                            {t.priority || 'NORMAL'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor:
                              t.status === 'resolved' || t.status === 'closed' ? 'rgba(16, 185, 129, 0.15)' :
                              t.status === 'in_progress' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                            color:
                              t.status === 'resolved' || t.status === 'closed' ? '#10b981' :
                              t.status === 'in_progress' ? '#f59e0b' : '#0ea5e9'
                          }}>
                            {t.status?.toUpperCase() || 'OPEN'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedTicket(t)}
                            style={{
                              padding: '0.4rem 0.8rem',
                              borderRadius: '0.5rem',
                              backgroundColor: 'rgba(14, 165, 233, 0.15)',
                              border: '1px solid rgba(14, 165, 233, 0.3)',
                              color: '#0ea5e9',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                          >
                            <MessageSquare size={14} />
                            <span>Balas &amp; Detail</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  {tickets.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <CheckCircle2 size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5, display: 'block', color: '#10b981' }} />
                        Tidak ada antrian tiket bantuan aktif saat ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Reply Modal */}
      {selectedTicket && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1.25rem',
            width: '100%',
            maxWidth: '650px',
            padding: '1.75rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <HelpCircle size={20} color="#0ea5e9" /> Tiket #{selectedTicket.id}: {selectedTicket.subject || 'Support'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Dari: {selectedTicket.user_email || selectedTicket.email || 'Pengguna'} &bull; Toko: {selectedTicket.store_slug || '-'}
                </span>
              </div>
              <button onClick={() => setSelectedTicket(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <XCircle size={20} />
              </button>
            </div>

            {/* Ticket Messages History */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                <p style={{ margin: '0 0 0.35rem', fontSize: '0.75rem', color: '#0ea5e9', fontWeight: 700 }}>PESAN AWAL PENGGUNA:</p>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {selectedTicket.description || selectedTicket.message || 'Tidak ada pesan tertulis.'}
                </p>
              </div>

              {selectedTicket.messages && selectedTicket.messages.map((m: any, idx: number) => (
                <div key={idx} style={{
                  padding: '0.85rem',
                  borderRadius: '0.75rem',
                  backgroundColor: m.is_admin ? 'rgba(14, 165, 233, 0.1)' : 'var(--bg-deep)',
                  border: `1px solid ${m.is_admin ? 'rgba(14, 165, 233, 0.25)' : 'var(--border-light)'}`,
                  alignSelf: m.is_admin ? 'flex-end' : 'flex-start',
                  maxWidth: '85%'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.25rem', fontSize: '0.75rem' }}>
                    <strong style={{ color: m.is_admin ? '#0ea5e9' : 'var(--text-primary)' }}>
                      {m.is_admin ? 'Staf CS Catavor' : (m.sender_name || 'Pengguna')}
                    </strong>
                    <span style={{ color: 'var(--text-secondary)' }}>{m.created_at ? new Date(m.created_at).toLocaleTimeString() : ''}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{m.message}</p>
                </div>
              ))}
            </div>

            {/* Quick Reply Form */}
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                Tulis Balasan Staf CS:
              </label>
              <textarea
                value={replyMessage}
                onChange={e => setReplyMessage(e.target.value)}
                placeholder="Tuliskan solusi atau respons resmi kepada pemilik toko/pengguna..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  marginBottom: '0.75rem'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'in_progress')}
                    style={{ padding: '0.4rem 0.75rem', borderRadius: '0.4rem', backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Set In Progress
                  </button>
                  <button
                    onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'resolved')}
                    style={{ padding: '0.4rem 0.75rem', borderRadius: '0.4rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Set Selesai
                  </button>
                </div>
                <button
                  onClick={handleReplyTicket}
                  disabled={ticketActionLoading || !replyMessage.trim()}
                  style={{
                    padding: '0.55rem 1.25rem',
                    borderRadius: '0.65rem',
                    backgroundColor: '#0ea5e9',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                  }}
                >
                  <Send size={15} />
                  <span>{ticketActionLoading ? 'Mengirim...' : 'Kirim Balasan'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. FINANCE & BILLING DIVISION                                             */}
      {/* ========================================================================= */}
      {activeDivision === 'finance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text-primary)' }}>
                Manajemen Keuangan &amp; Langganan Toko
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Pantau pesanan paket langganan merchant, verifikasi pembayaran, dan laporan pendapatan.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['all', 'pending', 'paid', 'cancelled'].map(status => (
                <button
                  key={status}
                  onClick={() => setOrdersFilter(status)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '0.5rem',
                    backgroundColor: ordersFilter === status ? '#10b981' : 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    color: ordersFilter === status ? '#000' : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {status === 'all' ? 'Semua' : status}
                </button>
              ))}
            </div>
          </div>

          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1rem',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.85rem 1.25rem' }}>No. Pesanan</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Toko &amp; Pemilik</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Paket Langganan</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Nominal</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Status Pembayaran</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {orders
                    .filter(o => ordersFilter === 'all' || o.status === ordersFilter)
                    .map(o => (
                      <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                          #{o.order_number || o.id}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{o.store_name || o.store_slug || '-'}</span>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{o.user_email || o.email || '-'}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            padding: '0.15rem 0.55rem',
                            borderRadius: '0.35rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            textTransform: 'uppercase'
                          }}>
                            {o.plan_code || o.plan_name || 'PRO'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                          Rp {(o.amount || o.price || 0).toLocaleString('id-ID')}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor:
                              o.status === 'paid' ? 'rgba(16, 185, 129, 0.15)' :
                              o.status === 'cancelled' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color:
                              o.status === 'paid' ? '#10b981' :
                              o.status === 'cancelled' ? '#ef4444' : '#f59e0b'
                          }}>
                            {o.status?.toUpperCase() || 'PENDING'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {o.created_at ? new Date(o.created_at).toLocaleDateString('id-ID') : '-'}
                        </td>
                      </tr>
                    ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <DollarSign size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5, display: 'block', color: '#10b981' }} />
                        Belum ada data transaksi pesanan paket langganan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CONTENT & EDITORIAL DIVISION                                           */}
      {/* ========================================================================= */}
      {activeDivision === 'content' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section 1: Broadcast Notifications */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text-primary)' }}>
                  Siaran Notifikasi Global Platform
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Kirim pengumuman penting kepada seluruh merchant dan pengunjung platform secara real-time.
                </p>
              </div>
              <button
                onClick={() => setShowBroadcastModal(true)}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '0.65rem',
                  backgroundColor: '#8b5cf6',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem'
                }}
              >
                <Plus size={16} />
                <span>Buat Siaran Baru</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {broadcasts.map(b => (
                <div key={b.id} style={{
                  padding: '1.25rem',
                  borderRadius: '0.85rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <span style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '0.35rem',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(139, 92, 246, 0.15)',
                      color: '#8b5cf6',
                      textTransform: 'uppercase'
                    }}>
                      {b.type || 'INFO'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {b.created_at ? new Date(b.created_at).toLocaleDateString('id-ID') : ''}
                    </span>
                  </div>
                  <h4 style={{ margin: '0 0 0.35rem', fontSize: '1rem', color: 'var(--text-primary)' }}>{b.title}</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{b.message}</p>
                </div>
              ))}
              {broadcasts.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', gridColumn: '1 / -1', backgroundColor: 'var(--bg-card)', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
                  Belum ada siaran broadcast aktif. Klik tombol "Buat Siaran Baru" di atas.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Create Modal */}
      {showBroadcastModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1.25rem',
            width: '100%',
            maxWidth: '520px',
            padding: '1.75rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Megaphone size={20} color="#8b5cf6" /> Buat Siaran Notifikasi Global
              </h3>
              <button onClick={() => setShowBroadcastModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                  Judul Siaran:
                </label>
                <input
                  type="text"
                  required
                  value={broadcastForm.title}
                  onChange={e => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                  placeholder="Contoh: Pemeliharaan Server Terjadwal"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                  Pesan Notifikasi:
                </label>
                <textarea
                  required
                  rows={4}
                  value={broadcastForm.message}
                  onChange={e => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                  placeholder="Tuliskan rincian pengumuman yang akan diterima seluruh pemilik toko..."
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                    Tipe Pengumuman:
                  </label>
                  <select
                    value={broadcastForm.type}
                    onChange={e => setBroadcastForm({ ...broadcastForm, type: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                      outline: 'none'
                    }}
                  >
                    <option value="info">Informasi Umum</option>
                    <option value="warning">Peringatan / Urgent</option>
                    <option value="success">Promo &amp; Update Baru</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                    Target Audiens:
                  </label>
                  <select
                    value={broadcastForm.target_role}
                    onChange={e => setBroadcastForm({ ...broadcastForm, target_role: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                      outline: 'none'
                    }}
                  >
                    <option value="all">Semua Merchant &amp; Pengunjung</option>
                    <option value="pro">Hanya Toko Pro &amp; Enterprise</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  style={{
                    padding: '0.6rem 1.1rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.6rem 1.3rem',
                    borderRadius: '0.65rem',
                    backgroundColor: '#8b5cf6',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                  }}
                >
                  <Send size={15} />
                  <span>Kirim Siaran</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
