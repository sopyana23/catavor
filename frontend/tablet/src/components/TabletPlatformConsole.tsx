import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutDashboard,
  Store as StoreIcon,
  AlertOctagon,
  LifeBuoy,
  CreditCard,
  Radio,
  Cpu,
  Flame,
  Layers,
  History,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  RefreshCw,
  Eye,
  Send,
  Lock,
  MessageSquare,
  Tag,
  ExternalLink,
  Plus,
  Trash2,
  Check,
  X,
  User,
  Zap,
  Globe,
  DollarSign
} from 'lucide-react';
import { TabletRailNav } from './TabletRailNav';
import { TabletMasterDetailView } from './TabletMasterDetailView';
import { TabletPlatformStoresView } from './TabletPlatformStoresView';
import { TabletSegmentedPagination } from './TabletSegmentedPagination';
import { type UserRBACInfo, getRoleBadge, isSuperAdmin } from '../utils/rbac';

export interface TabletPlatformConsoleProps {
  token: string;
  currentUser: UserRBACInfo | null;
  onLogout: () => void;
}

export const TabletPlatformConsole: React.FC<TabletPlatformConsoleProps> = ({
  token,
  currentUser,
  onLogout
}) => {
  // Navigation View State synced with URL (?tab=...)
  const [activeView, setActiveView] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') || params.get('view');
      if (tab) return tab;
    }
    return 'dashboard';
  });

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Switch View & sync URL
  const handleSwitchView = (newView: string) => {
    setActiveView(newView);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', newView);
      window.history.pushState({}, '', url.toString());
    }
  };

  // Header Title metadata
  const viewMetadata = useMemo(() => {
    switch (activeView) {
      case 'dashboard':
        return { title: 'Ringkasan Eksekutif Platform', subtitle: 'Pusat komando dan metrik operasional ekosistem' };
      case 'staff':
        return { title: 'Staf & Role RBAC', subtitle: 'Matriks izin akses dan penugasan staf pengelola' };
      case 'stores':
        return { title: 'Tata Kelola Profil Toko', subtitle: 'Direktori katalog terdaftar dan kepatuhan akun' };
      case 'reports':
        return { title: 'Kepatuhan & Laporan Masyarakat', subtitle: 'Antrean penertiban satwa dilindungi dan barang terlarang' };
      case 'support':
        return { title: 'Pusat Bantuan & Helpdesk CS', subtitle: 'Penanganan tiket kendala merchant dan percakapan' };
      case 'finance':
        return { title: 'Keuangan & Verifikasi Billing', subtitle: 'Verifikasi aktivasi paket Pro dan invoice langganan' };
      case 'broadcast':
        return { title: 'Siaran Broadcast Pengumuman', subtitle: 'Penyampaian notifikasi masal ke seluruh merchant' };
      case 'automation':
        return { title: 'Mesin Otomatisasi & Bot Worker', subtitle: 'Pemantauan status daemon dan background job' };
      case 'monetization':
        return { title: 'Monetisasi & Integrasi Google', subtitle: 'Pengaturan Google AdSense, ads.txt dan GA4' };
      case 'master-data':
        return { title: 'Master Data & Proteksi Rekber', subtitle: 'Whitelist domain aman, template CS, dan escrow syariah' };
      case 'audit':
        return { title: 'System-Wide Audit Trail', subtitle: 'Jejak rekaman forensik seluruh tindakan administratif' };
      default:
        return { title: 'Konsol Operasional Platform', subtitle: 'Sistem tata kelola terpadu Catavor' };
    }
  }, [activeView]);

  // Dynamic Badge Counters & Summary Metrics
  const [metrics, setMetrics] = useState({
    active_stores: 0,
    dormant_stores: 0,
    total_stores: 0
  });
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [urgentTicketsCount, setUrgentTicketsCount] = useState(0);
  const [actionRequiredTicketsCount, setActionRequiredTicketsCount] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  // Load metrics from backend
  const loadPlatformStats = useCallback(async () => {
    if (!token) return;
    try {
      // 1. Dormancy metrics
      const dormRes = await fetch('/api/admin/dormancy/metrics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (dormRes.ok) {
        const j = await dormRes.json();
        if (j.data) {
          setMetrics({
            active_stores: j.data.active_stores || 0,
            dormant_stores: j.data.dormant_stores || 0,
            total_stores: j.data.total_stores || 0
          });
        }
      }

      // 2. Pending reports count
      const repRes = await fetch('/api/admin/reports?status=pending&limit=1', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (repRes.ok) {
        const rj = await repRes.json();
        setPendingReportsCount(rj.pagination?.total || (rj.data ? rj.data.length : 0));
      }

      // 3. Support tickets
      const tckRes = await fetch('/api/admin/support/tickets?limit=50', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (tckRes.ok) {
        const tj = await tckRes.json();
        const list = tj.data || [];
        const urgent = list.filter((t: any) => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed').length;
        const actionReq = list.filter((t: any) => t.status === 'open' || t.status === 'in_progress').length;
        setUrgentTicketsCount(urgent);
        setActionRequiredTicketsCount(actionReq);
      }

      // 4. Pending billing orders
      const ordRes = await fetch('/api/admin/subscription/orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (ordRes.ok) {
        const oj = await ordRes.json();
        const olist = oj.data || [];
        const pending = olist.filter((o: any) => o.status === 'pending_payment' || o.status === 'pending_verification').length;
        setPendingOrdersCount(pending);
      }
    } catch {
      // Fail gracefully
    }
  }, [token]);

  useEffect(() => {
    loadPlatformStats();
  }, [loadPlatformStats]);

  // =========================================================================
  // SUB-VIEW: REPORTS (Kepatuhan & Laporan Pelanggaran)
  // =========================================================================
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [reportsFilter, setReportsFilter] = useState<'pending' | 'action_taken' | 'dismissed' | 'all'>('pending');
  const [actionReason, setActionReason] = useState('');

  const fetchReports = useCallback(async () => {
    if (!token) return;
    setReportsLoading(true);
    try {
      const q = reportsFilter === 'all' ? '' : `?status=${reportsFilter}`;
      const res = await fetch(`/api/admin/reports${q}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        setReports(j.data || []);
      }
    } catch {
      showToast('Gagal memuat antrean laporan', 'error');
    } finally {
      setReportsLoading(false);
    }
  }, [token, reportsFilter]);

  useEffect(() => {
    if (activeView === 'reports') {
      fetchReports();
    }
  }, [activeView, fetchReports]);

  const selectedReport = useMemo(() => {
    return reports.find(r => r.id === selectedReportId) || null;
  }, [reports, selectedReportId]);

  const handleUpdateReportStatus = async (reportId: number, status: string, notes?: string) => {
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, admin_notes: notes || actionReason || 'Tindakan penertiban oleh staf pengelola tablet' })
      });
      if (res.ok) {
        showToast(`Status laporan berhasil diubah ke: ${status}`);
        setActionReason('');
        fetchReports();
        loadPlatformStats();
      } else {
        showToast('Gagal memperbarui laporan', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan', 'error');
    }
  };

  // =========================================================================
  // SUB-VIEW: SUPPORT (Helpdesk CS)
  // =========================================================================
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [ticketDetail, setTicketDetail] = useState<any | null>(null);
  const [ticketReply, setTicketReply] = useState('');
  const [supportFilter, setSupportFilter] = useState<'all' | 'open' | 'resolved' | 'closed'>('open');

  const fetchTickets = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/support/tickets?limit=50', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        setTickets(j.data || []);
      }
    } catch {
      // Fail silently
    }
  }, [token]);

  useEffect(() => {
    if (activeView === 'support') {
      fetchTickets();
    }
  }, [activeView, fetchTickets]);

  const fetchTicketDetail = async (id: number) => {
    setSelectedTicketId(id);
    try {
      const res = await fetch(`/api/admin/support/tickets/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        setTicketDetail(j.data || j.ticket || j);
      }
    } catch {
      showToast('Gagal memuat rincian tiket', 'error');
    }
  };

  const handleSendTicketReply = async () => {
    if (!selectedTicketId || !ticketReply.trim()) return;
    try {
      const res = await fetch(`/api/admin/support/tickets/${selectedTicketId}/reply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: ticketReply })
      });
      if (res.ok) {
        showToast('Tanggapan berhasil dikirim');
        setTicketReply('');
        fetchTicketDetail(selectedTicketId);
        fetchTickets();
      } else {
        showToast('Gagal mengirim balasan', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan koneksi', 'error');
    }
  };

  const handleUpdateTicketStatus = async (status: string) => {
    if (!selectedTicketId) return;
    try {
      const res = await fetch(`/api/admin/support/tickets/${selectedTicketId}/status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        showToast(`Status tiket diperbarui ke ${status}`);
        fetchTicketDetail(selectedTicketId);
        fetchTickets();
        loadPlatformStats();
      }
    } catch {
      showToast('Gagal memperbarui status tiket', 'error');
    }
  };

  // =========================================================================
  // SUB-VIEW: FINANCE (Keuangan & Billing)
  // =========================================================================
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/subscription/orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        setOrders(j.data || []);
      }
    } catch {
      // Fail silently
    }
  }, [token]);

  useEffect(() => {
    if (activeView === 'finance') {
      fetchOrders();
    }
  }, [activeView, fetchOrders]);

  const selectedOrder = useMemo(() => {
    return orders.find(o => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  // =========================================================================
  // SUB-VIEW: STAFF & RBAC
  // =========================================================================
  const [staffList, setStaffList] = useState<any[]>([]);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('support');

  const fetchStaff = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/rbac/staff', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        setStaffList(j.data || []);
      }
    } catch {
      // Fail silently
    }
  }, [token]);

  useEffect(() => {
    if (activeView === 'staff') {
      fetchStaff();
    }
  }, [activeView, fetchStaff]);

  const handleAssignStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffEmail) return;
    try {
      const res = await fetch('/api/admin/rbac/staff', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: newStaffEmail, role: newStaffRole })
      });
      if (res.ok) {
        showToast('Staf berhasil ditugaskan');
        setNewStaffEmail('');
        fetchStaff();
      } else {
        const j = await res.json();
        showToast(j.message || 'Gagal menugaskan staf', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan', 'error');
    }
  };

  const handleRevokeStaff = async (staffId: number) => {
    try {
      const res = await fetch('/api/admin/rbac/staff/revoke', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ staff_id: staffId })
      });
      if (res.ok) {
        showToast('Akses staf berhasil dicabut');
        fetchStaff();
      }
    } catch {
      showToast('Gagal mencabut akses', 'error');
    }
  };

  // =========================================================================
  // SUB-VIEW: AUTOMATION & BOT DAEMONS
  // =========================================================================
  const [automationStatus, setAutomationStatus] = useState<any>(null);

  const fetchAutomation = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/automation/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        setAutomationStatus(j.data || null);
      }
    } catch {
      // Fail silently
    }
  }, [token]);

  useEffect(() => {
    if (activeView === 'automation') {
      fetchAutomation();
    }
  }, [activeView, fetchAutomation]);

  const handleTriggerBot = async () => {
    try {
      const res = await fetch('/api/admin/automation/trigger', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Daemon scheduler bot berhasil dipicu');
        fetchAutomation();
      }
    } catch {
      showToast('Gagal memicu bot', 'error');
    }
  };

  // =========================================================================
  // SUB-VIEW: AUDIT TRAIL
  // =========================================================================
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const fetchAuditLogs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/audit-logs?limit=40', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        setAuditLogs(j.data || []);
      }
    } catch {
      // Fail silently
    }
  }, [token]);

  useEffect(() => {
    if (activeView === 'audit') {
      fetchAuditLogs();
    }
  }, [activeView, fetchAuditLogs]);

  // Role info badge
  const roleInfo = getRoleBadge(currentUser?.platform_role || 'superadmin');

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: 'var(--bg-deep)',
      color: 'var(--text-primary)'
    }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999999,
          padding: '0.65rem 1.25rem',
          borderRadius: '999px',
          backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
          color: '#ffffff',
          fontSize: '0.85rem',
          fontWeight: 700,
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* 1. Tablet Rail Navigation */}
      <TabletRailNav
        activeView={activeView}
        onSwitchView={handleSwitchView}
        currentUser={currentUser}
        roleBadge={roleInfo.label}
        onLogout={onLogout}
        onRefresh={() => {
          loadPlatformStats();
          showToast('Data metrik platform disegarkan', 'success');
        }}
        isRefreshing={loading}
        pendingReportsCount={pendingReportsCount}
        urgentTicketsCount={urgentTicketsCount}
        actionRequiredTicketsCount={actionRequiredTicketsCount}
      />

      {/* 2. Main Executive Tablet Workspace */}
      <main style={{
        flex: 1,
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0
      }}>
        {/* Tablet Top Executive Header */}
        <header style={{
          height: '64px',
          padding: '0 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-light)',
          flexShrink: 0
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Tablet Executive Console &bull; {roleInfo.label}
            </div>
            <h1 style={{
              fontSize: '1.12rem',
              fontWeight: 800,
              margin: 0,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {viewMetadata.title}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => {
                loadPlatformStats();
                showToast('Data berhasil diperbarui');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '0.6rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-deep)',
                color: 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Segarkan Metrik"
            >
              <RefreshCw size={14} />
              <span>Segarkan</span>
            </button>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '999px',
              backgroundColor: roleInfo.bg,
              color: roleInfo.color,
              border: `1px solid ${roleInfo.border}`,
              fontSize: '0.72rem',
              fontWeight: 800,
              whiteSpace: 'nowrap'
            }}>
              <span>{roleInfo.label}</span>
            </div>
          </div>
        </header>

        {/* 3. Dynamic Module View Body */}
        <div style={{ flex: 1, height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
          {/* TAB 1: DASHBOARD (RINGKASAN EKSEKUTIF) */}
          {activeView === 'dashboard' && (
            <div style={{ padding: '1.5rem', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
              <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* 4 Primary KPI Cards */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem'
                }}>
                  {/* Card 1: Direktori Toko */}
                  <div
                    onClick={() => handleSwitchView('stores')}
                    style={{
                      padding: '1.25rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, border-color 0.15s ease',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Direktori Toko</span>
                      <div style={{ width: '36px', height: '36px', borderRadius: '0.6rem', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <StoreIcon size={18} />
                      </div>
                    </div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      {metrics.active_stores || metrics.total_stores || 1}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                      &bull; {metrics.dormant_stores || 0} Toko Terindikasi Dormansi
                    </div>
                  </div>

                  {/* Card 2: Laporan Kepatuhan */}
                  <div
                    onClick={() => handleSwitchView('reports')}
                    style={{
                      padding: '1.25rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Laporan Kepatuhan</span>
                      <div style={{ width: '36px', height: '36px', borderRadius: '0.6rem', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertOctagon size={18} />
                      </div>
                    </div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 900, color: pendingReportsCount > 0 ? '#ef4444' : 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      {pendingReportsCount}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: pendingReportsCount > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: 600 }}>
                      {pendingReportsCount > 0 ? 'Perlu Investigasi Staf' : 'Semua laporan tertangani'}
                    </div>
                  </div>

                  {/* Card 3: Tiket Helpdesk CS */}
                  <div
                    onClick={() => handleSwitchView('support')}
                    style={{
                      padding: '1.25rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Bantuan CS</span>
                      <div style={{ width: '36px', height: '36px', borderRadius: '0.6rem', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <LifeBuoy size={18} />
                      </div>
                    </div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 900, color: urgentTicketsCount > 0 ? '#f59e0b' : 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      {actionRequiredTicketsCount}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: urgentTicketsCount > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: 600 }}>
                      {urgentTicketsCount > 0 ? `${urgentTicketsCount} Tiket Prioritas Mendesak` : 'Antrean bantuan normal'}
                    </div>
                  </div>

                  {/* Card 4: Billing Langganan */}
                  <div
                    onClick={() => handleSwitchView('finance')}
                    style={{
                      padding: '1.25rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Order Billing</span>
                      <div style={{ width: '36px', height: '36px', borderRadius: '0.6rem', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CreditCard size={18} />
                      </div>
                    </div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 900, color: pendingOrdersCount > 0 ? '#10b981' : 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      {pendingOrdersCount}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: pendingOrdersCount > 0 ? '#f59e0b' : 'var(--text-muted)', fontWeight: 600 }}>
                      {pendingOrdersCount > 0 ? 'Menunggu Konfirmasi Aktivasi' : 'Tidak ada antrean tertunda'}
                    </div>
                  </div>
                </div>

                {/* Quick Nav Module Launcher Grid */}
                <div style={{
                  padding: '1.5rem',
                  borderRadius: '1.25rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)'
                }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0' }}>
                    Akses Cepat Modul Pengelola
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.85rem'
                  }}>
                    {[
                      { key: 'stores', label: 'Direktori Toko', desc: 'Audit & kepatuhan katalog', icon: StoreIcon, color: '#3b82f6' },
                      { key: 'reports', label: 'Kepatuhan & Laporan', desc: 'Investigasi satwa terlarang', icon: AlertOctagon, color: '#ef4444' },
                      { key: 'support', label: 'Bantuan CS', desc: 'Respon tiket merchant', icon: LifeBuoy, color: '#06b6d4' },
                      { key: 'finance', label: 'Keuangan & Billing', desc: 'Verifikasi aktivasi paket Pro', icon: CreditCard, color: '#10b981' },
                      { key: 'staff', label: 'Staf & Role RBAC', desc: 'Penugasan hak akses tim', icon: ShieldCheck, color: '#8b5cf6' },
                      { key: 'broadcast', label: 'Siaran Broadcast', desc: 'Kirim notifikasi masal', icon: Radio, color: '#ec4899' },
                      { key: 'automation', label: 'Mesin Otomatisasi', desc: 'Status bot & scheduler', icon: Cpu, color: '#f97316' },
                      { key: 'audit', label: 'Audit Trail', desc: 'Log aktivitas forensik sistem', icon: History, color: '#64748b' },
                    ].map(mod => {
                      const Icon = mod.icon;
                      return (
                        <div
                          key={mod.key}
                          onClick={() => handleSwitchView(mod.key)}
                          style={{
                            padding: '1rem',
                            borderRadius: '0.85rem',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.85rem',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '0.65rem',
                            backgroundColor: `${mod.color}18`,
                            color: mod.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Icon size={20} />
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                              {mod.label}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {mod.desc}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* System Telemetry & Integrity */}
                <div style={{
                  padding: '1.25rem 1.5rem',
                  borderRadius: '1rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <ShieldCheck size={24} color="#10b981" />
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Integritas Ekosistem Platform Terverifikasi
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        PostgreSQL Database, CSP Security & Granular RBAC Guards Beroperasi Normal
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981' }}>Live Online</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STORES (DIREKTORI TOKO & DORMANSI) */}
          {activeView === 'stores' && (
            <TabletPlatformStoresView
              token={token}
              onNavigateToTab={setActiveView}
              hideHeader={true}
            />
          )}

          {/* TAB 3: REPORTS (KEPATUHAN & LAPORAN MASYARAKAT) */}
          {activeView === 'reports' && (
            <TabletMasterDetailView
              title="Kepatuhan & Laporan Masuk"
              subtitle={`${reports.length} laporan dalam antrean`}
              hideHeaderTitle={true}
              selectedId={selectedReportId}
              onClearSelection={() => setSelectedReportId(null)}
              headerAction={
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {(['pending', 'action_taken', 'dismissed', 'all'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setReportsFilter(tab)}
                      style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        backgroundColor: reportsFilter === tab ? 'var(--primary)' : 'var(--bg-deep)',
                        color: reportsFilter === tab ? '#ffffff' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {tab === 'pending' ? 'Pending' : tab === 'action_taken' ? 'Ditindak' : tab === 'dismissed' ? 'Ditolak' : 'Semua'}
                    </button>
                  ))}
                </div>
              }
              masterPane={
                <div style={{ height: '100%', overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {reportsLoading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Memuat laporan...</div>
                  ) : reports.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={36} color="#10b981" style={{ marginBottom: '0.5rem' }} />
                      <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Tidak ada laporan</div>
                      <div style={{ fontSize: '0.78rem' }}>Semua penegakan kepatuhan bersih</div>
                    </div>
                  ) : (
                    reports.map(rep => {
                      const isSelected = selectedReportId === rep.id;
                      return (
                        <div
                          key={rep.id}
                          onClick={() => setSelectedReportId(rep.id)}
                          style={{
                            padding: '0.85rem',
                            borderRadius: '0.75rem',
                            backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-card)',
                            border: `1px solid ${isSelected ? '#3b82f6' : 'var(--border-light)'}`,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              backgroundColor: rep.target_type === 'catalog' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                              color: rep.target_type === 'catalog' ? '#a855f7' : '#0284c7'
                            }}>
                              {rep.target_type === 'catalog' ? 'TOKO' : 'ITEM'}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              #{rep.report_number || rep.id}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {rep.store_title || rep.item_name || 'Target Laporan'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{rep.reason_label || rep.reason_category || 'Pelanggaran'}</span>
                            <span>{new Date(rep.created_at).toLocaleDateString('id-ID')}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              }
              detailPane={
                selectedReport ? (
                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{
                      padding: '1.25rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)' }}>
                          Detail Laporan #{selectedReport.report_number || selectedReport.id}
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          backgroundColor: selectedReport.status === 'pending' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: selectedReport.status === 'pending' ? '#ef4444' : '#10b981'
                        }}>
                          {selectedReport.status?.toUpperCase()}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                        {selectedReport.store_title || selectedReport.item_name || 'Entitas Terlapor'}
                      </h3>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', fontSize: '0.8rem', marginTop: '1rem' }}>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Alasan Laporan</div>
                          <div style={{ fontWeight: 700 }}>{selectedReport.reason_label || selectedReport.reason_category || '-'}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Email Pelapor</div>
                          <div style={{ fontWeight: 700 }}>{selectedReport.reporter_email || 'Anonim'}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Tanggal Lapor</div>
                          <div style={{ fontWeight: 700 }}>{new Date(selectedReport.created_at).toLocaleString('id-ID')}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>IP Pelapor</div>
                          <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{selectedReport.reporter_ip || '-'}</div>
                        </div>
                      </div>

                      {selectedReport.description && (
                        <div style={{ marginTop: '1rem', padding: '0.85rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Deskripsi Pelapor:</div>
                          <div style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>"{selectedReport.description}"</div>
                        </div>
                      )}
                    </div>

                    {/* Enforcement Actions */}
                    <div style={{
                      padding: '1.25rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)'
                    }}>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 0.75rem 0' }}>
                        Tindakan Penertiban Staf Pengelola
                      </h4>
                      <input
                        type="text"
                        placeholder="Catatan penertiban internal (opsional)..."
                        value={actionReason}
                        onChange={(e) => setActionReason(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.55rem',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-deep)',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                          marginBottom: '0.85rem',
                          boxSizing: 'border-box'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleUpdateReportStatus(selectedReport.id, 'action_taken', 'Item/Konten dinonaktifkan oleh pengelola tablet')}
                          style={{
                            padding: '0.55rem 1rem',
                            borderRadius: '0.55rem',
                            border: 'none',
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer'
                          }}
                        >
                          Tindak Pelanggaran
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateReportStatus(selectedReport.id, 'dismissed', 'Laporan diabaikan/tidak cukup bukti')}
                          style={{
                            padding: '0.55rem 1rem',
                            borderRadius: '0.55rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'transparent',
                            color: 'var(--text-secondary)',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer'
                          }}
                        >
                          Tolak Laporan
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null
              }
            />
          )}

          {/* TAB 4: SUPPORT (PUSAT BANTUAN & HELPDESK) */}
          {activeView === 'support' && (
            <TabletMasterDetailView
              title="Helpdesk Tiket Bantuan CS"
              subtitle={`${tickets.length} total tiket percakapan`}
              hideHeaderTitle={true}
              selectedId={selectedTicketId}
              onClearSelection={() => {
                setSelectedTicketId(null);
                setTicketDetail(null);
              }}
              masterPane={
                <div style={{ height: '100%', overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {tickets.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      <LifeBuoy size={36} color="#06b6d4" style={{ marginBottom: '0.5rem' }} />
                      <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Tidak ada tiket aktif</div>
                    </div>
                  ) : (
                    tickets.map(tck => {
                      const isSelected = selectedTicketId === tck.id;
                      return (
                        <div
                          key={tck.id}
                          onClick={() => fetchTicketDetail(tck.id)}
                          style={{
                            padding: '0.85rem',
                            borderRadius: '0.75rem',
                            backgroundColor: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'var(--bg-card)',
                            border: `1px solid ${isSelected ? '#06b6d4' : 'var(--border-light)'}`,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              backgroundColor: tck.priority === 'urgent' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.12)',
                              color: tck.priority === 'urgent' ? '#ef4444' : '#3b82f6'
                            }}>
                              {tck.priority?.toUpperCase()}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              #{tck.ticket_number || tck.id}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {tck.subject || 'Kendala Merchant'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{tck.store_name || tck.user_email || 'Merchant'}</span>
                            <span>{new Date(tck.created_at).toLocaleDateString('id-ID')}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              }
              detailPane={
                ticketDetail ? (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {/* Ticket Header & Status bar */}
                    <div style={{
                      padding: '1rem 1.25rem',
                      borderBottom: '1px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'var(--bg-card)'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          #{ticketDetail.ticket_number || ticketDetail.id} &bull; {ticketDetail.user_email || 'Merchant'}
                        </div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0.2rem 0 0 0' }}>
                          {ticketDetail.subject}
                        </h3>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => handleUpdateTicketStatus('resolved')}
                          style={{
                            padding: '0.4rem 0.75rem',
                            borderRadius: '0.5rem',
                            border: 'none',
                            backgroundColor: '#10b981',
                            color: '#ffffff',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Selesai
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateTicketStatus('closed')}
                          style={{
                            padding: '0.4rem 0.75rem',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'transparent',
                            color: 'var(--text-muted)',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Tutup
                        </button>
                      </div>
                    </div>

                    {/* Messages Body */}
                    <div style={{ flex: 1, padding: '1rem 1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {ticketDetail.messages && ticketDetail.messages.map((m: any, idx: number) => {
                        const isAdmin = m.sender_type === 'admin' || m.is_admin;
                        return (
                          <div
                            key={idx}
                            style={{
                              alignSelf: isAdmin ? 'flex-end' : 'flex-start',
                              maxWidth: '75%',
                              padding: '0.75rem 1rem',
                              borderRadius: '0.85rem',
                              backgroundColor: isAdmin ? 'var(--primary)' : 'var(--bg-deep)',
                              color: isAdmin ? '#ffffff' : 'var(--text-primary)',
                              border: isAdmin ? 'none' : '1px solid var(--border-light)'
                            }}
                          >
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.8, marginBottom: '0.2rem' }}>
                              {isAdmin ? 'Admin CS' : (ticketDetail.user_email || 'Merchant')}
                            </div>
                            <div style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
                              {m.message || m.body}
                            </div>
                            <div style={{ fontSize: '0.65rem', opacity: 0.7, textAlign: 'right', marginTop: '0.25rem' }}>
                              {new Date(m.created_at || Date.now()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Reply Bar */}
                    <div style={{
                      padding: '0.75rem 1.25rem',
                      borderTop: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-card)',
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center'
                    }}>
                      <input
                        type="text"
                        placeholder="Ketik balasan untuk merchant..."
                        value={ticketReply}
                        onChange={(e) => setTicketReply(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendTicketReply()}
                        style={{
                          flex: 1,
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.55rem',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-deep)',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                          outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleSendTicketReply}
                        style={{
                          padding: '0.65rem 1rem',
                          borderRadius: '0.55rem',
                          border: 'none',
                          backgroundColor: 'var(--primary)',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Send size={15} />
                        <span>Kirim</span>
                      </button>
                    </div>
                  </div>
                ) : null
              }
            />
          )}

          {/* TAB 5: FINANCE (KEUANGAN & BILLING) */}
          {activeView === 'finance' && (
            <TabletMasterDetailView
              title="Billing Langganan Pro"
              subtitle={`${orders.length} order transaksi`}
              hideHeaderTitle={true}
              selectedId={selectedOrderId}
              onClearSelection={() => setSelectedOrderId(null)}
              masterPane={
                <div style={{ height: '100%', overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {orders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      <CreditCard size={36} color="#10b981" style={{ marginBottom: '0.5rem' }} />
                      <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Tidak ada transaksi billing</div>
                    </div>
                  ) : (
                    orders.map(ord => {
                      const isSelected = selectedOrderId === ord.id;
                      return (
                        <div
                          key={ord.id}
                          onClick={() => setSelectedOrderId(ord.id)}
                          style={{
                            padding: '0.85rem',
                            borderRadius: '0.75rem',
                            backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card)',
                            border: `1px solid ${isSelected ? '#10b981' : 'var(--border-light)'}`,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#10b981' }}>
                              {ord.plan_name || ord.plan?.toUpperCase() || 'PAKET PRO'}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              #{ord.invoice_number || ord.id}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {ord.store_name || `Store #${ord.store_id}`}
                          </div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Rp {(ord.amount || ord.price || 0).toLocaleString('id-ID')}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              }
              detailPane={
                selectedOrder ? (
                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{
                      padding: '1.25rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981' }}>
                          Invoice #{selectedOrder.invoice_number || selectedOrder.id}
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          backgroundColor: selectedOrder.status === 'active' || selectedOrder.status === 'paid' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: selectedOrder.status === 'active' || selectedOrder.status === 'paid' ? '#10b981' : '#f59e0b'
                        }}>
                          {selectedOrder.status?.toUpperCase() || 'PENDING'}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                        {selectedOrder.store_name || `Store #${selectedOrder.store_id}`}
                      </h3>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', fontSize: '0.82rem', marginTop: '1rem' }}>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Paket Langganan</div>
                          <div style={{ fontWeight: 800 }}>{selectedOrder.plan_name || selectedOrder.plan}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Nominal Pembayaran</div>
                          <div style={{ fontWeight: 800, color: '#10b981' }}>Rp {(selectedOrder.amount || selectedOrder.price || 0).toLocaleString('id-ID')}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Metode Bayar</div>
                          <div style={{ fontWeight: 700 }}>{selectedOrder.payment_method || 'Transfer Bank'}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Tanggal Pesanan</div>
                          <div style={{ fontWeight: 700 }}>{new Date(selectedOrder.created_at).toLocaleString('id-ID')}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null
              }
            />
          )}

          {/* TAB 6: STAFF & RBAC */}
          {activeView === 'staff' && (
            <div style={{ padding: '1.5rem', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
              <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{
                  padding: '1.25rem',
                  borderRadius: '1rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)'
                }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0' }}>
                    Tugaskan Staf Baru
                  </h3>
                  <form onSubmit={handleAssignStaff} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <input
                      type="email"
                      required
                      placeholder="email.staf@catavor.com"
                      value={newStaffEmail}
                      onChange={(e) => setNewStaffEmail(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: '220px',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '0.55rem',
                        border: '1px solid var(--border-light)',
                        backgroundColor: 'var(--bg-deep)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem'
                      }}
                    />
                    <select
                      value={newStaffRole}
                      onChange={(e) => setNewStaffRole(e.target.value)}
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: '0.55rem',
                        border: '1px solid var(--border-light)',
                        backgroundColor: 'var(--bg-deep)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem'
                      }}
                    >
                      <option value="support">Customer Support</option>
                      <option value="compliance">Compliance & Satwa</option>
                      <option value="finance">Finance & Billing</option>
                      <option value="content">Content & Marketing</option>
                      {isSuperAdmin(currentUser) && <option value="superadmin">Super Admin</option>}
                    </select>
                    <button
                      type="submit"
                      style={{
                        padding: '0.65rem 1.25rem',
                        borderRadius: '0.55rem',
                        border: 'none',
                        backgroundColor: 'var(--primary)',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      Tugaskan
                    </button>
                  </form>
                </div>

                {/* Staff List */}
                <div style={{
                  padding: '1.25rem',
                  borderRadius: '1rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)'
                }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0' }}>
                    Daftar Akun Staf Pengelola ({staffList.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {staffList.map((staf) => (
                      <div
                        key={staf.id}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '0.65rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '1rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <User size={18} color="var(--primary)" />
                          <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 800 }}>{staf.name || staf.email}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{staf.email}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '0.2rem 0.6rem',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(59, 130, 246, 0.12)',
                            color: '#3b82f6'
                          }}>
                            {staf.platform_role?.toUpperCase() || 'STAFF'}
                          </span>
                          {isSuperAdmin(currentUser) && staf.email !== currentUser?.email && (
                            <button
                              type="button"
                              onClick={() => handleRevokeStaff(staf.id)}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '0.45rem',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                color: '#ef4444',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Cabut
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: BROADCAST */}
          {activeView === 'broadcast' && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Radio size={40} color="#ec4899" style={{ marginBottom: '0.75rem' }} />
              <p style={{ fontSize: '0.88rem', maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
                Kirim pengumuman resmi ke seluruh merchant secara serentak melalui push notifikasi dan dashboard.
              </p>
            </div>
          )}

          {/* TAB 8: AUTOMATION */}
          {activeView === 'automation' && (
            <div style={{ padding: '1.5rem', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
              <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{
                  padding: '1.5rem',
                  borderRadius: '1rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
                      Status Bot Daemon & Background Sentinel
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                      Sentinel dormansi katalog, rotasi token, dan audit berkala
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTriggerBot}
                    style={{
                      padding: '0.55rem 1rem',
                      borderRadius: '0.6rem',
                      border: 'none',
                      backgroundColor: 'var(--primary)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    Jalankan Bot Sekarang
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: AUDIT TRAIL */}
          {activeView === 'audit' && (
            <div style={{ padding: '1.5rem', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <div style={{
                  padding: '1.25rem',
                  borderRadius: '1rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)'
                }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>
                    Riwayat Rekaman Audit Forensik ({auditLogs.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {auditLogs.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        Belum ada rekaman audit aktivitas baru
                      </div>
                    ) : (
                      auditLogs.map((log, i) => (
                        <div
                          key={i}
                          style={{
                            padding: '0.75rem 1rem',
                            borderRadius: '0.5rem',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.8rem'
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 800, color: 'var(--primary)', marginRight: '0.5rem' }}>
                              [{log.action || 'ACTION'}]
                            </span>
                            <span>{log.description || log.target || 'Tindakan sistem'}</span>
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                            {log.created_at ? new Date(log.created_at).toLocaleString('id-ID') : '-'}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* OTHER TABS FALLBACK */}
          {['monetization', 'master-data'].includes(activeView) && (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Layers size={48} color="#10b981" style={{ marginBottom: '1rem' }} />
              <p style={{ fontSize: '0.88rem', maxWidth: '480px', margin: '0 auto' }}>
                {viewMetadata.subtitle}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
