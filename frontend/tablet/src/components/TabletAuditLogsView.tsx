import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  Search,
  RefreshCw,
  Package,
  Store,
  CreditCard,
  ShieldCheck,
  Flag,
  FileText,
  User,
  Globe,
  Clock,
  Eye,
  X,
  Copy,
  Check,
  Loader,
  Code,
  Download
} from 'lucide-react';
import { TabletSegmentedPagination } from './TabletSegmentedPagination';
import { createAuthFetch } from '../utils/auth';
import { useModalBackHandler } from '../utils/navigation';
import {
  MERCHANT_AUDIT_CATEGORIES,
  exportAuditLogsFile,
  formatAuditDateTimeWIB,
} from '../../../shared/audit/auditHelpers';

export interface ActivityLogItem {
  id: number;
  store_id?: number;
  user_id?: number;
  actor_name: string;
  actor_role?: string;
  action: string;
  category: string;
  entity_type?: string;
  entity_id?: number;
  entity_title?: string;
  description: string;
  changes?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface TabletAuditLogsViewProps {
  token: string;
  currentUser?: any;
  storeSlug: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onLogout?: () => void;
  onUnauthorized?: (msg?: string) => void;
}

export const TabletAuditLogsView: React.FC<TabletAuditLogsViewProps> = ({
  token,
  storeSlug,
  showToast,
  onLogout,
  onUnauthorized
}) => {
  // Centralized authenticated fetch with automatic 401/403 session eviction
  const authFetch = React.useMemo(() => {
    return createAuthFetch({
      getToken: () => token,
      onUnauthorized: (msg) => {
        if (onUnauthorized) {
          onUnauthorized(msg);
        } else if (onLogout) {
          onLogout();
        }
      }
    });
  }, [token, onUnauthorized, onLogout]);

  // Component states
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(15);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<ActivityLogItem | null>(null);
  const [copiedDiff, setCopiedDiff] = useState<boolean>(false);

  // Modal Back Interceptor (Rule 2: Hardware/browser back safely closes modal)
  useModalBackHandler({
    isOpen: Boolean(selectedLog),
    onClose: () => setSelectedLog(null),
    modalId: 'tablet-audit-diff-modal'
  });

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Fetch store-scoped activity logs from backend API
  const fetchLogs = useCallback(
    async (
      targetPage = page,
      category = categoryFilter,
      query = searchQuery,
      limit = pageSize
    ) => {
      if (!token) return;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: String(limit),
          category: category,
          q: query
        });

        const res = await authFetch(`/api/activity-logs?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            ...(storeSlug ? { 'X-Store-Slug': storeSlug } : {})
          }
        });

        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json.data) ? json.data : [];
          setLogs(items);
          setTotalRecords(typeof json.total === 'number' ? json.total : items.length);
          setPage(json.page || targetPage);
        } else {
          const errData = await res.json().catch(() => ({}));
          showToast(errData.message || 'Gagal memuat jejak aktivitas toko', 'error');
        }
      } catch {
        showToast('Terjadi kesalahan jaringan saat memuat audit log', 'error');
      } finally {
        setLoading(false);
      }
    },
    [token, storeSlug, page, categoryFilter, searchQuery, pageSize, authFetch, showToast]
  );

  // Synchronize on page, category, or debounced search changes
  useEffect(() => {
    fetchLogs(page, categoryFilter, searchQuery, pageSize);
  }, [page, categoryFilter, searchQuery, pageSize, fetchLogs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setPage(1);
  };

  const handleExportCsv = async () => {
    if (!token) return;
    setIsExporting(true);
    try {
      const filename = await exportAuditLogsFile({
        endpoint: '/api/activity-logs/export',
        token,
        format: 'csv',
        category: categoryFilter,
        q: searchQuery,
        storeSlug,
        fetcher: authFetch,
      });
      showToast(`Berhasil mengekspor ${filename}`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Gagal mengekspor log aktivitas CSV', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyDiff = (changes: any) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(changes, null, 2));
      setCopiedDiff(true);
      showToast('Snapshot JSON berhasil disalin ke clipboard', 'success');
      setTimeout(() => setCopiedDiff(false), 2000);
    } catch {
      showToast('Gagal menyalin snapshot JSON', 'error');
    }
  };

  // Category visual mapping: Lucide vector icons & curated colors
  const getCategoryMeta = (category: string) => {
    switch ((category || '').toLowerCase()) {
      case 'security':
        return {
          icon: ShieldCheck,
          label: 'Autentikasi',
          color: '#10b981',
          bg: 'rgba(16, 185, 129, 0.15)',
          border: 'rgba(16, 185, 129, 0.3)'
        };
      case 'catalog':
      case 'product':
        return {
          icon: Package,
          label: 'Produk',
          color: '#60a5fa',
          bg: 'rgba(59, 130, 246, 0.15)',
          border: 'rgba(59, 130, 246, 0.3)'
        };
      case 'store':
      case 'category':
        return {
          icon: Store,
          label: 'Katalog',
          color: '#a855f7',
          bg: 'rgba(168, 85, 247, 0.15)',
          border: 'rgba(168, 85, 247, 0.3)'
        };
      case 'billing':
      case 'settings':
        return {
          icon: CreditCard,
          label: 'Paket',
          color: '#f59e0b',
          bg: 'rgba(245, 158, 11, 0.15)',
          border: 'rgba(245, 158, 11, 0.3)'
        };
      case 'moderation':
        return {
          icon: Flag,
          label: 'Moderasi',
          color: '#f43f5e',
          bg: 'rgba(244, 63, 94, 0.15)',
          border: 'rgba(244, 63, 94, 0.3)'
        };
      default:
        return {
          icon: FileText,
          label: category || 'Aktivitas',
          color: '#64748b',
          bg: 'rgba(148, 163, 184, 0.15)',
          border: 'rgba(148, 163, 184, 0.3)'
        };
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  return (
    <div
      className="glass-panel animate-fade-in"
      style={{
        padding: '1.5rem',
        borderRadius: '1.1rem',
        border: '1px solid var(--border-light)',
        background: 'var(--card-bg-gradient)',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Toolbar & Filter Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.85rem',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
          paddingBottom: '1.1rem',
          borderBottom: '1px solid var(--border-light)'
        }}
      >
        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {MERCHANT_AUDIT_CATEGORIES.map((cat) => {
            const isActive = categoryFilter === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  setCategoryFilter(cat.key);
                  setPage(1);
                }}
                style={{
                  minHeight: '44px',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '0.65rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: isActive ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                  backgroundColor: isActive ? 'var(--primary)' : 'var(--bg-deep)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: isActive ? '0 2px 8px var(--primary-glow)' : 'none',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Search Toolbar, Export & Refresh */}
        <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <form onSubmit={handleSearchSubmit} style={{ position: 'relative', width: '220px', margin: 0 }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Cari aksi, produk, IP..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                paddingLeft: '2.2rem',
                paddingRight: searchInput ? '2rem' : '0.75rem',
                paddingTop: '0.45rem',
                paddingBottom: '0.45rem',
                fontSize: '0.78rem',
                borderRadius: '0.55rem',
                minHeight: '44px'
              }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                style={{
                  position: 'absolute',
                  right: '0.4rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.35rem',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={14} />
              </button>
            )}
          </form>

          <span
            style={{
              fontSize: '0.76rem',
              fontWeight: 800,
              color: 'var(--primary)',
              backgroundColor: 'var(--primary-glow)',
              padding: '0.45rem 0.85rem',
              borderRadius: '999px',
              border: '1px solid var(--border-light)',
              whiteSpace: 'nowrap'
            }}
          >
            {totalRecords.toLocaleString('id-ID')} Rekaman
          </span>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="btn-secondary"
            style={{
              minHeight: '44px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
            title="Ekspor CSV"
          >
            <Download size={14} />
            <span>{isExporting ? 'Ekspor...' : 'Ekspor CSV'}</span>
          </button>

          <button
            type="button"
            onClick={() => fetchLogs(page, categoryFilter, searchQuery, pageSize)}
            disabled={loading}
            className="btn-secondary"
            style={{
              minHeight: '44px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
            title="Segarkan Log"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Logs Card List Section */}
      {loading && logs.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: '3.5rem 2rem',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1rem',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem'
          }}
        >
          <Loader size={30} className="animate-spin" style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Memuat riwayat log aktivitas...</span>
        </div>
      ) : logs.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: '3.5rem 1.5rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1rem',
            border: '1px solid var(--border-light)'
          }}
        >
          <History size={42} style={{ margin: '0 auto 0.85rem auto', opacity: 0.45, color: 'var(--text-muted)' }} />
          <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>
            Belum Ada Log Aktivitas
          </h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
            Setiap aksi perubahan katalog, login keamanan, dan pembaruan paket akan tercatat rapi di sini.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {logs.map((log) => {
            const catMeta = getCategoryMeta(log.category);
            const IconComp = catMeta.icon;

            return (
              <div
                key={log.id || log.created_at}
                className="glass-panel"
                style={{
                  padding: '1.15rem 1.25rem',
                  borderRadius: '0.9rem',
                  border: '1px solid var(--border-light)',
                  background: 'var(--card-bg-gradient)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.85rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '0.55rem',
                        backgroundColor: catMeta.bg,
                        color: catMeta.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${catMeta.border}`,
                        flexShrink: 0
                      }}
                    >
                      <IconComp size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '0.15rem 0.55rem',
                            borderRadius: '4px',
                            backgroundColor: catMeta.bg,
                            color: catMeta.color,
                            border: `1px solid ${catMeta.border}`,
                            letterSpacing: '0.02em'
                          }}
                        >
                          {log.action}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <User size={13} color="var(--text-muted)" />
                          <strong style={{ color: 'var(--text-primary)' }}>{log.actor_name || 'Sistem'}</strong>
                          {log.actor_role && log.actor_role !== 'merchant' ? ` (${log.actor_role})` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.76rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    {log.ip_address && (
                      <span
                        style={{
                          fontFamily: 'monospace',
                          backgroundColor: 'var(--bg-deep)',
                          color: 'var(--text-secondary)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          border: '1px solid var(--border-light)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <Globe size={12} />
                        {log.ip_address}
                      </span>
                    )}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={12} />
                      {formatAuditDateTimeWIB(log.created_at)}
                    </span>
                  </div>
                </div>

                {/* Narrative Description */}
                <p
                  style={{
                    fontSize: '0.86rem',
                    color: 'var(--text-primary)',
                    margin: 0,
                    lineHeight: 1.5,
                    fontWeight: 500
                  }}
                >
                  {log.description}
                </p>

                {/* Footer Row: Target Entity & Inspection Trigger (always available) */}
                <div
                  style={{
                    borderTop: '1px dashed var(--border-light)',
                    paddingTop: '0.55rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '0.15rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    {log.entity_title || log.entity_type ? (
                      <span>
                        Target Entitas:{' '}
                        <strong style={{ color: 'var(--text-secondary)' }}>{log.entity_title || log.entity_type}</strong>
                        {log.entity_id ? ` (#${log.entity_id})` : ''}
                      </span>
                    ) : (
                      <span>Rekaman audit aktivitas toko</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedLog(log)}
                    style={{
                      minHeight: '44px',
                      background: 'none',
                      border: '1px solid var(--border-light)',
                      color: 'var(--primary)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.55rem',
                      backgroundColor: 'var(--primary-glow)'
                    }}
                    title="Lihat Detail Snapshot & Metadata Audit"
                  >
                    <Eye size={15} />
                    <span>{log.changes ? 'Inspeksi Diff' : 'Inspeksi'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Segmented Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0 1.5rem 0' }}>
          <TabletSegmentedPagination
            currentPage={page}
            totalPages={totalPages}
            totalRecords={totalRecords}
            onPageChange={(newPage) => setPage(newPage)}
            isLoading={loading}
          />
        </div>
      )}

      {/* Snapshot Diff Modal (Tablet Native Parity with Back Interceptor) */}
      {selectedLog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedLog(null);
            }
          }}
        >
          <div
            className="glass-panel animate-scale-up"
            style={{
              width: '100%',
              maxWidth: '640px',
              borderRadius: '1.25rem',
              border: '1px solid var(--border-light)',
              background: 'var(--card-bg-gradient, var(--bg-card))',
              boxShadow: 'var(--shadow-premium, 0 20px 48px rgba(0,0,0,0.6))',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-deep)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '0.55rem',
                    backgroundColor: 'var(--primary-glow)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Code size={18} />
                </div>
                <div>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: 'var(--primary)',
                      letterSpacing: '0.04em'
                    }}
                  >
                    Detail Rekaman &amp; Diff Audit
                  </span>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.15rem 0 0 0', fontFamily: 'monospace' }}>
                    {selectedLog.action}
                  </h3>
                </div>
              </div>

              {/* Close Button (Min 44x44px Touch Target) */}
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                style={{
                  minWidth: '44px',
                  minHeight: '44px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '0.5rem'
                }}
                title="Tutup Modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                maxHeight: '460px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.9rem'
              }}
            >
              <p style={{ fontSize: '0.86rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                {selectedLog.description}
              </p>

              {/* Forensic Metadata Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                <div style={{ padding: '0.75rem 0.9rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>Aktor Pelaksana</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                    {selectedLog.actor_name || 'Sistem'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Role: {selectedLog.actor_role || 'merchant'}
                  </div>
                </div>
                <div style={{ padding: '0.75rem 0.9rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>Alamat IP</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: '0.15rem' }}>
                    {selectedLog.ip_address || '-'}
                  </div>
                  {selectedLog.entity_title && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Target: {selectedLog.entity_title}
                    </div>
                  )}
                </div>
              </div>

              {selectedLog.user_agent && (
                <div style={{ padding: '0.65rem 0.85rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                  UA: {selectedLog.user_agent}
                </div>
              )}

              {/* JSON Preformatted Code Box */}
              {selectedLog.changes ? (
                <div
                  style={{
                    position: 'relative',
                    backgroundColor: 'var(--bg-deep)',
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--border-light)'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem',
                      borderBottom: '1px solid var(--border-light)',
                      paddingBottom: '0.35rem'
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Payload Snapshot (JSON):
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyDiff(selectedLog.changes)}
                      style={{
                        minHeight: '36px',
                        background: 'none',
                        border: 'none',
                        color: copiedDiff ? '#10b981' : 'var(--primary)',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.2rem 0.5rem'
                      }}
                    >
                      {copiedDiff ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedDiff ? 'Tersalin' : 'Salin JSON'}</span>
                    </button>
                  </div>

                  <pre
                    style={{
                      margin: 0,
                      fontFamily: 'monospace',
                      fontSize: '0.78rem',
                      color: 'var(--primary)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      overflowX: 'auto',
                      lineHeight: 1.5
                    }}
                  >
                    {typeof selectedLog.changes === 'string'
                      ? selectedLog.changes
                      : JSON.stringify(selectedLog.changes, null, 2)}
                  </pre>
                </div>
              ) : (
                <div style={{ padding: '0.85rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)', border: '1px dashed var(--border-light)', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Rekaman ini mencatat peristiwa operasional tanpa payload diff perubahan field.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-deep)'
              }}
            >
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Tercatat pada {formatAuditDateTimeWIB(selectedLog.created_at)}
              </span>

              <button
                type="button"
                className="btn-primary"
                onClick={() => setSelectedLog(null)}
                style={{
                  minHeight: '44px',
                  padding: '0.5rem 1.5rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  borderRadius: '0.65rem',
                  cursor: 'pointer'
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
