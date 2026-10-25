import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  History,
  Search,
  RefreshCw,
  Package,
  Store,
  CreditCard,
  ShieldCheck,
  ShieldAlert,
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
  Code
} from 'lucide-react';
import { TabletSegmentedPagination } from './TabletSegmentedPagination';
import { createAuthFetch } from '../utils/auth';
import { isSuperAdmin } from '../utils/rbac';
import { useModalBackHandler } from '../utils/navigation';

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
  currentUser,
  storeSlug,
  showToast,
  onLogout,
  onUnauthorized
}) => {
  // Determine if viewer is Superadmin
  const isSuper = useMemo(() => isSuperAdmin(currentUser), [currentUser]);

  // Centralized authenticated fetch with automatic 401/403 session eviction
  const fetch = useMemo(() => {
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
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
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

  // Fetch activity logs from backend API
  const fetchLogs = useCallback(
    async (
      targetPage = page,
      category = categoryFilter,
      query = searchQuery,
      role = roleFilter,
      limit = pageSize
    ) => {
      if (!token) return;
      setLoading(true);
      try {
        const endpoint = isSuper ? '/api/admin/audit-logs' : '/api/activity-logs';
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: String(limit),
          category: category,
          q: query
        });

        if (isSuper && role !== 'all') {
          params.append('role', role);
        }

        const res = await fetch(`${endpoint}?${params.toString()}`, {
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
    [token, storeSlug, isSuper, page, categoryFilter, searchQuery, roleFilter, pageSize, fetch, showToast]
  );

  // Synchronize on page, category, role, or pageSize changes
  useEffect(() => {
    fetchLogs(page, categoryFilter, searchQuery, roleFilter, pageSize);
  }, [page, categoryFilter, roleFilter, pageSize]);

  // Handle search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
    fetchLogs(1, categoryFilter, searchInput, roleFilter, pageSize);
  };

  // Clear search input
  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setPage(1);
    fetchLogs(1, categoryFilter, '', roleFilter, pageSize);
  };

  // Copy snapshot JSON to clipboard
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
    switch (category.toLowerCase()) {
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
      case 'superadmin':
        return {
          icon: ShieldAlert,
          label: 'Superadmin',
          color: '#ef4444',
          bg: 'rgba(239, 68, 68, 0.15)',
          border: 'rgba(239, 68, 68, 0.3)'
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
          label: category,
          color: '#64748b',
          bg: 'rgba(148, 163, 184, 0.15)',
          border: 'rgba(148, 163, 184, 0.3)'
        };
    }
  };

  // Formatted date string
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

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  // Category filter definitions aligned across Desktop and Mobile
  const categoryOptions = useMemo(() => {
    const base = [
      { key: 'all', label: 'Semua Kategori' },
      { key: 'security', label: 'Autentikasi' },
      { key: 'catalog', label: 'Item Produk' },
      { key: 'store', label: 'Profil & Katalog' },
      { key: 'billing', label: 'Paket & Langganan' }
    ];
    if (isSuper) {
      base.push(
        { key: 'superadmin', label: 'Aksi Superadmin' },
        { key: 'moderation', label: 'Moderasi' }
      );
    }
    return base;
  }, [isSuper]);

  return (
    <div
      style={{
        height: '100vh',
        overflowY: 'auto',
        padding: '1.75rem',
        maxWidth: '1040px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Top Header & Stats Banner */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          padding: '1.25rem 1.5rem',
          borderRadius: '1rem',
          border: '1px solid var(--border-light)',
          background: 'var(--card-bg-gradient, var(--bg-card))',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--primary-glow)',
              border: '1px solid var(--primary)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <History size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {isSuper ? 'System-Wide Audit Trail (Superadmin)' : 'Riwayat Aktivitas & Log Audit Toko'}
              </h2>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: 'var(--primary)',
                  backgroundColor: 'var(--primary-glow)',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '999px',
                  border: '1px solid var(--border-light)'
                }}
              >
                {totalRecords.toLocaleString('id-ID')} Rekaman
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
              {isSuper
                ? 'Jejak audit menyeluruh atas seluruh perubahan konfigurasi, mutasi data, dan keamanan multi-toko.'
                : 'Rekam jejak seluruh aksi operasional, autentikasi sesi, dan pembaruan katalog toko Anda.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchLogs(1, categoryFilter, searchQuery, roleFilter, pageSize)}
          disabled={loading}
          className="btn-secondary"
          style={{
            minHeight: '44px',
            padding: '0.6rem 1.15rem',
            borderRadius: '0.65rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
          title="Segarkan Data Log"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Filter Tabs & Search Controls Box */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '1.5rem',
          backgroundColor: 'var(--bg-card)',
          padding: '1.25rem',
          borderRadius: '1rem',
          border: '1px solid var(--border-light)'
        }}
      >
        {/* Top Controls Row: Search Input & Actor Role Filter */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Form */}
          <form
            onSubmit={handleSearchSubmit}
            style={{
              flex: 1,
              minWidth: '260px',
              display: 'flex',
              alignItems: 'center',
              position: 'relative'
            }}
          >
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '0.9rem',
                color: 'var(--text-muted)',
                pointerEvents: 'none'
              }}
            />
            <input
              type="text"
              placeholder="Cari aksi, produk, entitas, atau alamat IP..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                width: '100%',
                minHeight: '44px',
                paddingLeft: '2.5rem',
                paddingRight: searchInput ? '2.5rem' : '1rem',
                backgroundColor: 'var(--bg-deep)',
                borderRadius: '0.65rem',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Hapus Pencarian"
              >
                <X size={16} />
              </button>
            )}
          </form>

          {/* Search Submit Button */}
          <button
            type="button"
            onClick={handleSearchSubmit}
            style={{
              minHeight: '44px',
              padding: '0.6rem 1.25rem',
              borderRadius: '0.65rem',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Cari
          </button>

          {/* Superadmin Actor Role Dropdown */}
          {isSuper && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <select
                value={roleFilter}
                onChange={(e) => {
                  const newRole = e.target.value;
                  setRoleFilter(newRole);
                  setPage(1);
                  fetchLogs(1, categoryFilter, searchQuery, newRole, pageSize);
                }}
                style={{
                  minHeight: '44px',
                  padding: '0.55rem 0.95rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all">Semua Aktor</option>
                <option value="superadmin">Superadmin</option>
                <option value="merchant">Merchant</option>
                <option value="system">System Worker</option>
              </select>
            </div>
          )}

          {/* Page Size Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                setPageSize(newSize);
                setPage(1);
              }}
              style={{
                minHeight: '44px',
                padding: '0.55rem 0.75rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--bg-deep)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value={10}>10 Baris</option>
              <option value={15}>15 Baris</option>
              <option value={25}>25 Baris</option>
              <option value={50}>50 Baris</option>
            </select>
          </div>
        </div>

        {/* Category Pills Row */}
        <div
          style={{
            display: 'flex',
            gap: '0.45rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            paddingTop: '0.35rem',
            borderTop: '1px solid var(--border-light)'
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '0.25rem' }}>
            Kategori:
          </span>
          {categoryOptions.map((cat) => {
            const isSelected = categoryFilter === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  setCategoryFilter(cat.key);
                  setPage(1);
                  fetchLogs(1, cat.key, searchQuery, roleFilter, pageSize);
                }}
                style={{
                  minHeight: '40px',
                  padding: '0.45rem 0.95rem',
                  borderRadius: '999px',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                  backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-deep)',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  boxShadow: isSelected ? '0 2px 8px var(--primary-glow)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {cat.label}
              </button>
            );
          })}
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
          <History size={44} style={{ marginBottom: '0.75rem', opacity: 0.5, color: 'var(--text-muted)' }} />
          <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>
            Tidak Ada Log Aktivitas Ditemukan
          </h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
            {searchQuery || categoryFilter !== 'all' || roleFilter !== 'all'
              ? 'Tidak ada rekaman log yang sesuai dengan kata kunci atau filter yang Anda pilih. Coba atur ulang filter pencarian Anda.'
              : 'Setiap aksi perubahan inventaris, data toko, dan riwayat sesi login pengelola akan tercatat rapi di sini.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
          {logs.map((log) => {
            const meta = getCategoryMeta(log.category);
            const IconComp = meta.icon;

            return (
              <div
                key={log.id}
                className="glass-panel animate-fade-in"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '0.95rem',
                  border: '1px solid var(--border-light)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}
              >
                {/* Header Row: Icon, Action Badge, Actor Name, Timestamp, IP Badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '0.65rem',
                        backgroundColor: meta.bg,
                        color: meta.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <IconComp size={18} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '0.35rem',
                          backgroundColor: meta.bg,
                          color: meta.color,
                          letterSpacing: '0.03em'
                        }}
                      >
                        {log.action}
                      </span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        oleh{' '}
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {log.actor_name || 'Sistem'}
                        </strong>{' '}
                        {log.actor_role && log.actor_role !== 'merchant' ? `(${log.actor_role})` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Metadata: IP Address & Timestamp */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)'
                    }}
                  >
                    {log.ip_address && (
                      <span
                        style={{
                          fontFamily: 'monospace',
                          backgroundColor: 'var(--bg-deep)',
                          color: 'var(--text-secondary)',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '0.35rem',
                          border: '1px solid var(--border-light)',
                          fontSize: '0.74rem'
                        }}
                      >
                        IP: {log.ip_address}
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={13} />
                      {formatDateTime(log.created_at)}
                    </span>
                  </div>
                </div>

                {/* Body Row: Description */}
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

                {/* Footer Row: Target Entity & Diff Inspection Trigger */}
                {(log.changes || log.entity_title) && (
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
                      {log.entity_title ? (
                        <span>
                          Target Entitas:{' '}
                          <strong style={{ color: 'var(--text-secondary)' }}>{log.entity_title}</strong>
                        </span>
                      ) : (
                        <span>Detail snapshot mutasi data tersimpan</span>
                      )}
                    </div>

                    {log.changes && (
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        style={{
                          minHeight: '44px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--primary-glow)'
                        }}
                        title="Lihat Detail Snapshot Perubahan Data"
                      >
                        <Eye size={15} />
                        <span>Lihat Snapshot Diff</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Segmented Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0 2rem 0' }}>
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
                    Snapshot Perubahan Data (Diff)
                  </span>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.15rem 0 0 0' }}>
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
                maxHeight: '420px',
                overflowY: 'auto'
              }}
            >
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '0.85rem', lineHeight: 1.5 }}>
                {selectedLog.description}
              </p>

              {/* JSON Preformatted Code Box */}
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
                  {JSON.stringify(selectedLog.changes, null, 2)}
                </pre>
              </div>
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
                Tercatat pada {formatDateTime(selectedLog.created_at)}
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
