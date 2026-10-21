import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  Search,
  RefreshCw,
  Package,
  FolderTree,
  Sliders,
  Shield,
  Key,
  Globe,
  Clock,
  User,
  Filter
} from 'lucide-react';
import { TabletSegmentedPagination } from './TabletSegmentedPagination';

export interface ActivityLogItem {
  id: number;
  store_id: number;
  user_id: number;
  actor_name: string;
  action: string;
  category: string;
  entity_type?: string;
  entity_id?: number;
  entity_title?: string;
  description: string;
  ip_address: string;
  user_agent?: string;
  created_at: string;
}

export interface TabletAuditLogsViewProps {
  token: string;
  storeSlug: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const TabletAuditLogsView: React.FC<TabletAuditLogsViewProps> = ({
  token,
  storeSlug,
  showToast
}) => {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const limit = 12;

  const fetchLogs = useCallback(async (targetPage = page, category = categoryFilter, query = searchQuery) => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(limit),
        category: category,
        q: query
      });

      const res = await fetch(`/api/activity-logs?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': storeSlug,
          'Accept': 'application/json'
        }
      });

      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data)) {
        setLogs(data.data);
        setTotalRecords(data.total || data.data.length);
        setPage(data.page || targetPage);
      } else {
        showToast(data.message || 'Gagal memuat jejak aktivitas toko', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat memuat audit log', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, storeSlug, page, categoryFilter, searchQuery, showToast]);

  useEffect(() => {
    fetchLogs(page, categoryFilter, searchQuery);
  }, [page, categoryFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs(1, categoryFilter, searchQuery);
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'product':
        return Package;
      case 'category':
        return FolderTree;
      case 'settings':
        return Sliders;
      case 'security':
        return Shield;
      case 'auth':
        return Key;
      default:
        return History;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'product':
        return { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6' };
      case 'category':
        return { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981' };
      case 'settings':
        return { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b' };
      case 'security':
      case 'auth':
        return { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444' };
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', text: '#64748b' };
    }
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

  const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

  return (
    <div style={{
      height: '100vh',
      overflowY: 'auto',
      padding: '2rem',
      maxWidth: '1000px',
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Header & Subtitle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <History size={24} color="var(--primary)" />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>
              Log Aktivitas &amp; Jejak Audit Toko
            </h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.35rem 0 0 0' }}>
            Rekam jejak seluruh perubahan inventaris produk, kategori, pengaturan, dan riwayat login pengelola.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchLogs(page, categoryFilter, searchQuery)}
          disabled={loading}
          style={{
            minHeight: '44px',
            padding: '0.6rem 1.15rem',
            borderRadius: '0.65rem',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Segarkan Data
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        marginBottom: '1.5rem',
        backgroundColor: 'var(--bg-card)',
        padding: '1.25rem',
        borderRadius: '1rem',
        border: '1px solid var(--border-light)'
      }}>
        {/* Search */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.65rem 1rem',
            backgroundColor: 'var(--bg-deep)',
            borderRadius: '0.65rem',
            border: '1px solid var(--border-light)'
          }}>
            <Search size={18} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Cari aktivitas, judul entitas, nama aksi, atau kata kunci..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                outline: 'none'
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              minHeight: '44px',
              padding: '0.65rem 1.25rem',
              borderRadius: '0.65rem',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
            Cari
          </button>
        </form>

        {/* Category Pills */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '0.25rem' }}>
            Kategori:
          </span>
          {[
            { key: 'all', label: 'Semua Aktivitas' },
            { key: 'product', label: 'Produk & Inventaris' },
            { key: 'category', label: 'Kategori' },
            { key: 'settings', label: 'Pengaturan Toko' },
            { key: 'security', label: 'Keamanan' },
            { key: 'auth', label: 'Autentikasi' }
          ].map(cat => {
            const isSelected = categoryFilter === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  setCategoryFilter(cat.key);
                  setPage(1);
                }}
                style={{
                  minHeight: '38px',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '999px',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                  backgroundColor: isSelected ? 'rgba(30, 58, 138, 0.12)' : 'var(--bg-deep)',
                  color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Logs Card List */}
      {loading && logs.length === 0 ? (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '1rem',
          border: '1px solid var(--border-light)'
        }}>
          Memuat riwayat log aktivitas...
        </div>
      ) : logs.length === 0 ? (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '1rem',
          border: '1px solid var(--border-light)'
        }}>
          Tidak ada jejak log aktivitas yang sesuai dengan filter pencarian.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {logs.map(log => {
            const Icon = getCategoryIcon(log.category);
            const badgeStyle = getCategoryColor(log.category);

            return (
              <div
                key={log.id}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '0.85rem',
                  border: '1px solid var(--border-light)',
                  padding: '1.15rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '0.65rem',
                    backgroundColor: badgeStyle.bg,
                    color: badgeStyle.text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon size={20} />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        backgroundColor: badgeStyle.bg,
                        color: badgeStyle.text,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '999px',
                        textTransform: 'uppercase'
                      }}>
                        {log.category}
                      </span>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {log.action}
                      </strong>
                      {log.entity_title && (
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          &bull; {log.entity_title}
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0', lineHeight: 1.45 }}>
                      {log.description}
                    </p>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <User size={13} />
                        {log.actor_name || 'Sistem'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Globe size={13} />
                        IP: {log.ip_address || 'Lokal'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={13} />
                        {formatDateTime(log.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Segmented Pager */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0 2rem 0' }}>
          <TabletSegmentedPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      )}
    </div>
  );
};
