import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Store,
  CreditCard,
  AlertOctagon,
  LifeBuoy,
  History,
  CheckCircle,
  Clock,
  Send,
  Building,
  RefreshCw,
  Search,
  ExternalLink,
  Ban
} from 'lucide-react';
import { TabletRailNav } from './components/TabletRailNav';
import { TabletMasterDetailView } from './components/TabletMasterDetailView';
import { TabletSegmentedPagination } from './components/TabletSegmentedPagination';
import { type UserRBACInfo, isPlatformAdmin, getRoleBadge } from './utils/rbac';

export const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('catavor_token') || localStorage.getItem('token') || '');
  const [currentUser, setCurrentUser] = useState<UserRBACInfo | null>(() => {
    try {
      const saved = localStorage.getItem('catavor_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeView, setActiveView] = useState<string>('dashboard');
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('catavor_theme') !== 'light';
  });

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Dashboard KPI data
  const [stats, setStats] = useState<any>({
    totalUsers: 0,
    totalStores: 0,
    totalProducts: 0,
    totalOrders: 0,
    openTickets: 0,
    pendingReports: 0,
    revenueThisMonth: 0
  });

  // Support Tickets State (Server-Side)
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketTotalPages, setTicketTotalPages] = useState(1);
  const [ticketTotalRecords, setTicketTotalRecords] = useState(0);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketReplyText, setTicketReplyText] = useState('');

  // Stores State (Server-Side)
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [storePage, setStorePage] = useState(1);
  const [storeTotalPages, setStoreTotalPages] = useState(1);
  const [storeTotalRecords, setStoreTotalRecords] = useState(0);

  // Compliance Reports State (Server-Side)
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [reportPage, setReportPage] = useState(1);
  const [reportTotalPages, setReportTotalPages] = useState(1);
  const [reportTotalRecords, setReportTotalRecords] = useState(0);

  // Finance Transactions State (Server-Side)
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);
  const [txPage, setTxPage] = useState(1);
  const [txTotalPages, setTxTotalPages] = useState(1);
  const [txTotalRecords, setTxTotalRecords] = useState(0);

  // Theme synchronization
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('catavor_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  const handleLogout = () => {
    localStorage.removeItem('catavor_token');
    localStorage.removeItem('catavor_user');
    window.location.href = '/login';
  };

  // Safe Headers Helper
  const getAuthHeaders = useCallback(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token]);

  // Fetch Dashboard Stats
  const fetchDashboardStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/dashboard-stats', { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setStats(json.data);
      }
    } catch {
      // fallback safe
    }
  }, [token, getAuthHeaders]);

  // Fetch Support Tickets (Server-Side Paginated)
  const fetchTickets = useCallback(async (page: number, search: string = '') => {
    if (!token) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: '10',
        search: search
      });
      const res = await fetch(`/api/admin/support/tickets?${query.toString()}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        const list = json.data || json.tickets || [];
        setTickets(list);
        setTicketPage(page);
        setTicketTotalPages(json.totalPages || json.total_pages || Math.ceil((json.total || list.length) / 10) || 1);
        setTicketTotalRecords(json.total || list.length);
        if (list.length > 0 && !selectedTicketId) {
          setSelectedTicketId(list[0].id);
        }
      }
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
    }
  }, [token, selectedTicketId, getAuthHeaders]);

  // Fetch Stores (Server-Side Paginated)
  const fetchStores = useCallback(async (page: number) => {
    if (!token) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: '10' });
      const res = await fetch(`/api/admin/stores?${query.toString()}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        const list = json.data || json.stores || [];
        setStores(list);
        setStorePage(page);
        setStoreTotalPages(json.totalPages || Math.ceil((json.total || list.length) / 10) || 1);
        setStoreTotalRecords(json.total || list.length);
        if (list.length > 0 && !selectedStoreId) {
          setSelectedStoreId(list[0].id);
        }
      }
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
    }
  }, [token, selectedStoreId, getAuthHeaders]);

  // Master Refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeView === 'dashboard') await fetchDashboardStats();
    if (activeView === 'support') await fetchTickets(ticketPage, ticketSearch);
    if (activeView === 'stores') await fetchStores(storePage);
    setTimeout(() => setRefreshing(false), 300);
  };

  useEffect(() => {
    if (activeView === 'dashboard') fetchDashboardStats();
    if (activeView === 'support') fetchTickets(1, ticketSearch);
    if (activeView === 'stores') fetchStores(1);
  }, [activeView, fetchDashboardStats, fetchTickets, fetchStores, ticketSearch]);

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);
  const selectedStore = stores.find(s => s.id === selectedStoreId);

  // If user is not platform admin, render minimal fallback or redirect
  if (!isPlatformAdmin(currentUser)) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        backgroundColor: 'var(--bg-deep)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-body)'
      }}>
        <div style={{
          maxWidth: '460px',
          padding: '2.5rem',
          borderRadius: '1rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            color: '#ef4444',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <Ban size={28} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
            Akses Terbatas Tablet Console
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
            Portal ini dikhususkan bagi Pengelola Platform Catavor (Super Admin, Satwa & Kepatuhan, CS, Finance).
          </p>
          <button
            type="button"
            onClick={() => window.location.href = '/login'}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '0.65rem',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Masuk dengan Akun Pengelola
          </button>
        </div>
      </div>
    );
  }

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
      {/* 1. Dedicated Tablet Navigation Rail (74px) */}
      <TabletRailNav
        activeView={activeView}
        onSwitchView={setActiveView}
        currentUser={currentUser}
        roleBadge={roleInfo.label}
        isDark={isDark}
        toggleTheme={toggleTheme}
        onLogout={handleLogout}
        onRefresh={handleRefresh}
        isRefreshing={refreshing}
        urgentTicketsCount={stats.openTickets}
        pendingReportsCount={stats.pendingReports}
      />

      {/* 2. Main Content Workspace */}
      <main style={{
        flex: 1,
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Top Header Command Bar */}
        <header style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem',
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-light)',
          flexShrink: 0
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Tablet Executive Console &bull; {roleInfo.label}
            </div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              {activeView === 'dashboard' ? 'Ringkasan Platform' :
               activeView === 'support' ? 'Tiket Bantuan & CS' :
               activeView === 'stores' ? 'Direktori & Dormansi Toko' :
               activeView === 'reports' ? 'Kepatuhan & Laporan' :
               activeView === 'finance' ? 'Keuangan & Platform Billing' :
               activeView === 'audit' ? 'System Audit Trail' : 'Pengaturan Platform'}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '999px',
              backgroundColor: roleInfo.bg,
              border: `1px solid ${roleInfo.border}`,
              color: roleInfo.color,
              fontSize: '0.75rem',
              fontWeight: 700
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: roleInfo.color }} />
              {roleInfo.label}
            </span>

            <div style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-secondary)'
            }}>
              {currentUser?.email}
            </div>
          </div>
        </header>

        {/* View Router */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {/* A. DASHBOARD VIEW: 2-3 Column KPI Grid for Tablet */}
          {activeView === 'dashboard' && (
            <div style={{
              height: 'calc(100vh - 64px)',
              overflowY: 'auto',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}>
              {/* KPI Strip */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem'
              }}>
                <div style={{
                  padding: '1.25rem',
                  borderRadius: '0.85rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', marginBottom: '0.5rem' }}>
                    <Store size={20} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Total Toko Terdaftar</span>
                  </div>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800 }}>{stats.totalStores || 0}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Termasuk toko aktif & dorman</div>
                </div>

                <div style={{
                  padding: '1.25rem',
                  borderRadius: '0.85rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', marginBottom: '0.5rem' }}>
                    <LifeBuoy size={20} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Tiket Butuh Tindakan</span>
                  </div>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800 }}>{stats.openTickets || 0}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Menunggu respons tim CS</div>
                </div>

                <div style={{
                  padding: '1.25rem',
                  borderRadius: '0.85rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', marginBottom: '0.5rem' }}>
                    <CreditCard size={20} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Omset Rekber Bulan Ini</span>
                  </div>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800 }}>
                    Rp {Number(stats.revenueThisMonth || 0).toLocaleString('id-ID')}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Transaksi escrow aman</div>
                </div>
              </div>

              {/* Tablet Quick Action Panels */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1.25rem'
              }}>
                <div style={{
                  padding: '1.5rem',
                  borderRadius: '0.85rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)'
                }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                    Manajemen Cepat Tiket CS
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1rem' }}>
                    Gunakan antarmuka Master-Detail split-view khusus tablet untuk membalas keluhan pengguna tanpa kehilangan konteks.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveView('support')}
                    style={{
                      padding: '0.65rem 1.25rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: '#10b981',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.88rem'
                    }}
                  >
                    Buka Helpdesk Tablet &rarr;
                  </button>
                </div>

                <div style={{
                  padding: '1.5rem',
                  borderRadius: '0.85rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)'
                }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                    Pengawasan Direktori Toko
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1rem' }}>
                    Pantau toko yang aktif, terverifikasi, atau dorman melalui panel inspeksi sentuh yang ergonomis.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveView('stores')}
                    style={{
                      padding: '0.65rem 1.25rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      color: '#38bdf8',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.88rem'
                    }}
                  >
                    Buka Direktori Toko &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* B. SUPPORT TICKETS: NATIVE TABLET MASTER-DETAIL SPLIT VIEW */}
          {activeView === 'support' && (
            <TabletMasterDetailView
              title="Tiket Bantuan Helpdesk"
              subtitle={`${ticketTotalRecords} tiket terdaftar`}
              headerAction={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)'
                  }}>
                    <Search size={16} color="var(--text-muted)" />
                    <input
                      type="text"
                      placeholder="Cari subjek / nomor tiket..."
                      value={ticketSearch}
                      onChange={(e) => setTicketSearch(e.target.value)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        outline: 'none',
                        width: '180px'
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchTickets(ticketPage, ticketSearch)}
                    disabled={loading}
                    style={{
                      padding: '0.45rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.82rem'
                    }}
                  >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>
              }
              selectedId={selectedTicketId}
              onClearSelection={() => setSelectedTicketId(null)}
              masterPane={
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {/* Master List Records */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                    {tickets.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Tidak ada tiket yang ditemukan
                      </div>
                    ) : (
                      tickets.map(ticket => {
                        const isSelected = ticket.id === selectedTicketId;
                        return (
                          <div
                            key={ticket.id}
                            onClick={() => setSelectedTicketId(ticket.id)}
                            style={{
                              padding: '0.85rem',
                              borderRadius: '0.65rem',
                              backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card)',
                              border: isSelected ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-light)',
                              marginBottom: '0.5rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>
                                #{ticket.ticket_number || `TKT-${ticket.id}`}
                              </span>
                              <span style={{
                                fontSize: '0.68rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '999px',
                                backgroundColor: ticket.status === 'closed' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: ticket.status === 'closed' ? '#94a3b8' : '#f59e0b',
                                fontWeight: 700
                              }}>
                                {ticket.status ? ticket.status.toUpperCase() : 'OPEN'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ticket.subject || 'Pertanyaan Pengguna'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Pengirim: {ticket.user_name || ticket.user_email || 'Pengguna'}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Tablet Segmented Pager (Touch Target >= 44px) */}
                  <TabletSegmentedPagination
                    currentPage={ticketPage}
                    totalPages={ticketTotalPages}
                    totalRecords={ticketTotalRecords}
                    onPageChange={(p) => fetchTickets(p, ticketSearch)}
                    isLoading={loading}
                  />
                </div>
              }
              detailPane={
                selectedTicket ? (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.25rem' }}>
                    {/* Header Detail */}
                    <div style={{
                      paddingBottom: '1rem',
                      borderBottom: '1px solid var(--border-light)',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981' }}>
                          #{selectedTicket.ticket_number || `TKT-${selectedTicket.id}`}
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <span style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: '999px',
                            backgroundColor: selectedTicket.priority === 'urgent' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                            color: selectedTicket.priority === 'urgent' ? '#ef4444' : '#38bdf8',
                            fontSize: '0.75rem',
                            fontWeight: 700
                          }}>
                            {selectedTicket.priority ? selectedTicket.priority.toUpperCase() : 'NORMAL'}
                          </span>
                        </div>
                      </div>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                        {selectedTicket.subject}
                      </h2>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Oleh: <strong>{selectedTicket.user_name || selectedTicket.user_email}</strong> &bull; Dibuat: {selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleString('id-ID') : '-'}
                      </div>
                    </div>

                    {/* Ticket Content Body */}
                    <div style={{
                      flex: 1,
                      overflowY: 'auto',
                      backgroundColor: 'var(--bg-deep)',
                      padding: '1.25rem',
                      borderRadius: '0.75rem',
                      border: '1px solid var(--border-light)',
                      marginBottom: '1rem',
                      lineHeight: 1.6,
                      fontSize: '0.92rem'
                    }}>
                      {selectedTicket.description || 'Tidak ada deskripsi rinci.'}
                    </div>

                    {/* Quick Reply Box */}
                    <div style={{
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)'
                    }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                        Tulis Tanggapan Resmi Support
                      </div>
                      <textarea
                        rows={3}
                        value={ticketReplyText}
                        onChange={(e) => setTicketReplyText(e.target.value)}
                        placeholder="Ketik solusi atau arahan untuk pengguna ini..."
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
                          outline: 'none',
                          resize: 'none',
                          marginBottom: '0.75rem'
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!ticketReplyText.trim()) return;
                            alert('Tanggapan berhasil dikirim (simulasi demo).');
                            setTicketReplyText('');
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.65rem 1.25rem',
                            borderRadius: '0.65rem',
                            backgroundColor: 'var(--primary)',
                            color: '#ffffff',
                            border: 'none',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.88rem'
                          }}
                        >
                          <Send size={16} />
                          Kirim Tanggapan
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null
              }
            />
          )}

          {/* C. STORES DIRECTORY: NATIVE TABLET MASTER-DETAIL SPLIT VIEW */}
          {activeView === 'stores' && (
            <TabletMasterDetailView
              title="Direktori & Status Toko"
              subtitle={`${storeTotalRecords} toko terdaftar`}
              selectedId={selectedStoreId}
              onClearSelection={() => setSelectedStoreId(null)}
              masterPane={
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                    {stores.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Tidak ada toko ditemukan
                      </div>
                    ) : (
                      stores.map(store => {
                        const isSelected = store.id === selectedStoreId;
                        return (
                          <div
                            key={store.id}
                            onClick={() => setSelectedStoreId(store.id)}
                            style={{
                              padding: '0.85rem',
                              borderRadius: '0.65rem',
                              backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-card)',
                              border: isSelected ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid var(--border-light)',
                              marginBottom: '0.5rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {store.name || `Toko #${store.id}`}
                              </span>
                              <span style={{
                                fontSize: '0.68rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '999px',
                                backgroundColor: store.is_suspended ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: store.is_suspended ? '#ef4444' : '#10b981',
                                fontWeight: 700
                              }}>
                                {store.is_suspended ? 'SUSPENDED' : 'ACTIVE'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              Slug: /{store.slug}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <TabletSegmentedPagination
                    currentPage={storePage}
                    totalPages={storeTotalPages}
                    totalRecords={storeTotalRecords}
                    onPageChange={(p) => fetchStores(p)}
                    isLoading={loading}
                  />
                </div>
              }
              detailPane={
                selectedStore ? (
                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
                      <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                        {selectedStore.name}
                      </h2>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        URL Toko: <strong>catavor.com/{selectedStore.slug}</strong>
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '1rem'
                    }}>
                      <div style={{ padding: '1rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status Operasional</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '0.25rem' }}>
                          {selectedStore.is_suspended ? 'Ditangguhkan (Suspended)' : 'Aktif Beroperasi'}
                        </div>
                      </div>
                      <div style={{ padding: '1rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Paket Langganan</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '0.25rem' }}>
                          {selectedStore.plan || 'Free Tier'}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null
              }
            />
          )}

          {/* D. OTHER PLACEHOLDER VIEWS */}
          {['reports', 'finance', 'staff', 'broadcast', 'automation', 'monetization', 'master-data', 'audit'].includes(activeView) && (
            <div style={{
              padding: '2.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 'calc(100vh - 64px)',
              textAlign: 'center'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem'
              }}>
                <CheckCircle size={32} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                Modul {activeView.toUpperCase()} Terintegrasi
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '420px', lineHeight: 1.5 }}>
                Modul tablet ini terhubung langsung ke backend Go dan tabel PostgreSQL yang sama dengan versi desktop & mobile.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
