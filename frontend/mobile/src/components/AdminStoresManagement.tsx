import React, { useState, useEffect, useCallback } from 'react';
import {
  Store,
  Search,
  RefreshCw,
  Eye,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  Phone,
  Calendar,
  Package,
  Sparkles,
  X,
  Clock,
  ArrowUpDown,
  User,
  HardDrive
} from 'lucide-react';
import { useModalBackHandler } from '../utils/navigation';

export interface AdminStoreItem {
  id: number;
  user_id: number;
  slug: string;
  store_title: string;
  store_slogan: string;
  store_logo_url: string;
  store_theme: string;
  whatsapp_number: string;
  official_website: string;
  custom_domain: string;
  custom_domain_status: string;
  plan: string;
  plan_status: string;
  plan_expires_at?: string;
  storage_used_bytes: number;
  dormancy_status: string;
  is_suspended: boolean;
  is_blacklisted: boolean;
  suspension_reason: string;
  last_activity_at?: string;
  created_at: string;
  updated_at: string;
  user_name: string;
  user_email: string;
  products_count: number;
}

export interface AdminStoresStats {
  total_active: number;
  total_banned: number;
  total_free: number;
  total_pro_starter: number;
  total_pro_business: number;
}

interface AdminStoresManagementProps {
  token: string;
  themeMode?: 'dark' | 'light';
  onNavigateToTab?: (tab: string) => void;
}

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val);
};

export const AdminStoresManagement: React.FC<AdminStoresManagementProps> = ({
  token,
  themeMode = 'dark'
}) => {
  const isDark = themeMode === 'dark';

  // Sub-tab: strictly separated Active Profiles vs Banned/Suspended Profiles
  const [subTab, setSubTab] = useState<'active' | 'banned'>('active');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('created_at_desc');

  // Server-Side Numbered Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Data states
  const [stores, setStores] = useState<AdminStoreItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 1
  });
  const [stats, setStats] = useState<AdminStoresStats>({
    total_active: 0,
    total_banned: 0,
    total_free: 0,
    total_pro_starter: 0,
    total_pro_business: 0
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Detail Bottom Sheet inspection
  const [selectedStoreID, setSelectedStoreID] = useState<number | null>(null);
  const [storeDetail, setStoreDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modal Back Navigation Interceptor (Rule 2) - Intercepts hardware & gesture back
  useModalBackHandler({
    isOpen: !!selectedStoreID,
    onClose: () => {
      setSelectedStoreID(null);
      setStoreDetail(null);
    }
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch store list from server-side endpoint
  const fetchStores = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const queryParams = new URLSearchParams({
        status: subTab,
        page: page.toString(),
        limit: limit.toString(),
        sort: sortFilter,
        plan: planFilter
      });
      if (debouncedSearch) {
        queryParams.set('q', debouncedSearch);
      }

      const res = await fetch(`/api/admin/stores?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`Server status ${res.status}`);
      }

      const json = await res.json();
      if (json.success) {
        setStores(json.data || []);
        if (json.pagination) {
          setPagination(json.pagination);
        }
        if (json.stats) {
          setStats(json.stats);
        }
      } else {
        setErrorMsg(json.message || 'Gagal memuat daftar profil katalog.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal tersambung ke server.');
    } finally {
      setLoading(false);
    }
  }, [token, subTab, page, limit, sortFilter, planFilter, debouncedSearch]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  // Fetch store detail for bottom sheet
  const fetchStoreDetail = async (id: number) => {
    setSelectedStoreID(id);
    setDetailLoading(true);
    setStoreDetail(null);
    try {
      const res = await fetch(`/api/admin/stores/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const json = await res.json();
      if (json.success) {
        setStoreDetail(json);
      }
    } catch {
      // Fail silently
    } finally {
      setDetailLoading(false);
    }
  };

  const handleTabChange = (newTab: 'active' | 'banned') => {
    if (newTab === subTab) return;
    setSubTab(newTab);
    setPage(1);
    setSearchQuery('');
  };

  const getStorageQuota = (plan: string): number => {
    switch (plan) {
      case 'pro_business':
        return 5 * 1024 * 1024 * 1024;
      case 'pro_starter':
        return 1 * 1024 * 1024 * 1024;
      default:
        return 100 * 1024 * 1024;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
      {/* 1. Mobile KPI Counter Pills */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
        <div
          style={{
            padding: '0.75rem',
            borderRadius: '0.75rem',
            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem'
          }}
        >
          <CheckCircle2 size={20} color="#10b981" />
          <div>
            <div style={{ fontSize: '0.72rem', color: isDark ? '#9ca3af' : '#6b7280', fontWeight: 600 }}>
              Profil Aktif
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>
              {stats.total_active}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '0.75rem',
            borderRadius: '0.75rem',
            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem'
          }}
        >
          <ShieldAlert size={20} color="#ef4444" />
          <div>
            <div style={{ fontSize: '0.72rem', color: isDark ? '#9ca3af' : '#6b7280', fontWeight: 600 }}>
              Banned / Suspend
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ef4444' }}>
              {stats.total_banned}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Sub-Tab Segmented Switcher (Rule: Strict Isolation) */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f3f4f6',
          padding: '0.3rem',
          borderRadius: '0.75rem'
        }}
      >
        <button
          onClick={() => handleTabChange('active')}
          style={{
            flex: 1,
            minHeight: '44px',
            borderRadius: '0.6rem',
            border: 'none',
            backgroundColor: subTab === 'active' ? '#10b981' : 'transparent',
            color: subTab === 'active' ? '#ffffff' : isDark ? '#9ca3af' : '#4b5563',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <CheckCircle2 size={16} />
          Aktif ({stats.total_active})
        </button>

        <button
          onClick={() => handleTabChange('banned')}
          style={{
            flex: 1,
            minHeight: '44px',
            borderRadius: '0.6rem',
            border: 'none',
            backgroundColor: subTab === 'banned' ? '#ef4444' : 'transparent',
            color: subTab === 'banned' ? '#ffffff' : isDark ? '#9ca3af' : '#4b5563',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <ShieldAlert size={16} />
          Pelanggaran ({stats.total_banned})
        </button>
      </div>

      {/* 3. Mobile Search Box */}
      <div
        style={{
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.55rem',
          padding: '0 0.85rem',
          borderRadius: '0.65rem',
          backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`
        }}
      >
        <Search size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
        <input
          type="text"
          placeholder="Cari nama toko, slug, pemilik..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: isDark ? '#f3f4f6' : '#111827',
            fontSize: '0.88rem'
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ background: 'none', border: 'none', color: isDark ? '#9ca3af' : '#6b7280', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* 4. Filter Pills Row */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
        <select
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value);
            setPage(1);
          }}
          style={{
            minHeight: '40px',
            padding: '0 0.75rem',
            borderRadius: '0.55rem',
            backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
            color: isDark ? '#f3f4f6' : '#111827',
            fontSize: '0.82rem',
            outline: 'none'
          }}
        >
          <option value="all">Semua Paket</option>
          <option value="free">Gratis</option>
          <option value="pro_starter">Pro Starter</option>
          <option value="pro_business">Pro Business</option>
        </select>

        <select
          value={sortFilter}
          onChange={(e) => {
            setSortFilter(e.target.value);
            setPage(1);
          }}
          style={{
            minHeight: '40px',
            padding: '0 0.75rem',
            borderRadius: '0.55rem',
            backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
            color: isDark ? '#f3f4f6' : '#111827',
            fontSize: '0.82rem',
            outline: 'none'
          }}
        >
          <option value="created_at_desc">Terbaru</option>
          <option value="products_desc">Produk Terbanyak</option>
          <option value="title_asc">Nama (A-Z)</option>
        </select>

        <button
          onClick={fetchStores}
          disabled={loading}
          style={{
            minWidth: '40px',
            minHeight: '40px',
            borderRadius: '0.55rem',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
            backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
            color: isDark ? '#e5e7eb' : '#374151',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 5. Mobile Single-Column Card List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {loading ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
            <RefreshCw size={28} className="animate-spin" color="#10b981" style={{ margin: '0 auto 0.75rem auto' }} />
            <div style={{ fontSize: '0.85rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
              Memuat profil katalog...
            </div>
          </div>
        ) : stores.length === 0 ? (
          <div
            style={{
              padding: '3rem 1rem',
              textAlign: 'center',
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
              borderRadius: '0.85rem',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`
            }}
          >
            <Store size={36} color={isDark ? 'rgba(255,255,255,0.2)' : '#d1d5db'} style={{ margin: '0 auto 0.5rem auto' }} />
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: isDark ? '#e5e7eb' : '#374151' }}>
              Tidak Ada Profil Katalog
            </div>
            <div style={{ fontSize: '0.8rem', color: isDark ? '#9ca3af' : '#6b7280', marginTop: '0.2rem' }}>
              {debouncedSearch
                ? `Tidak ditemukan profil cocok dengan "${debouncedSearch}".`
                : subTab === 'active'
                ? 'Belum ada profil toko aktif yang terdaftar.'
                : 'Tidak ada profil toko yang ditangguhkan.'}
            </div>
          </div>
        ) : (
          stores.map((item) => (
            <div
              key={item.id}
              style={{
                padding: '1rem',
                borderRadius: '0.85rem',
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.03)'
              }}
            >
              {/* Header: Logo, Title, Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '0.65rem',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}
                >
                  {item.store_logo_url ? (
                    <img src={item.store_logo_url} alt={item.store_title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Store size={20} color="#10b981" />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: '0.92rem',
                        color: isDark ? '#f3f4f6' : '#111827',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '160px'
                      }}
                    >
                      {item.store_title}
                    </div>
                    <span
                      style={{
                        padding: '0.12rem 0.45rem',
                        borderRadius: '0.35rem',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        backgroundColor:
                          item.plan === 'pro_business'
                            ? 'rgba(168, 85, 247, 0.15)'
                            : item.plan === 'pro_starter'
                            ? 'rgba(59, 130, 246, 0.15)'
                            : 'rgba(255,255,255,0.08)',
                        color:
                          item.plan === 'pro_business'
                            ? '#a855f7'
                            : item.plan === 'pro_starter'
                            ? '#3b82f6'
                            : isDark
                            ? '#9ca3af'
                            : '#6b7280'
                      }}
                    >
                      {item.plan || 'Free'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                    <a
                      href={`/${item.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '0.78rem',
                        color: '#10b981',
                        textDecoration: 'none',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      /{item.slug}
                      <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              </div>

              {/* Info Rows */}
              <div
                style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: '0.55rem',
                  backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#f9fafb',
                  fontSize: '0.78rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Pemilik:</span>
                  <strong style={{ color: isDark ? '#f3f4f6' : '#111827' }}>{item.user_name || '-'}</strong>
                </div>
                {item.whatsapp_number && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>WhatsApp:</span>
                    <a
                      href={`https://wa.me/${item.whatsapp_number.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#10b981', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <Phone size={11} />
                      +{item.whatsapp_number}
                    </a>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Produk Terdaftar:</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>
                    {item.products_count} Item
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Status:</span>
                  {subTab === 'active' ? (
                    <span style={{ color: '#10b981', fontWeight: 700 }}>Aktif Normal</span>
                  ) : (
                    <span style={{ color: '#ef4444', fontWeight: 700 }}>
                      {item.is_suspended ? 'Ditangguhkan' : 'Banned'}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Button (Min touch target 44px) */}
              <button
                onClick={() => fetchStoreDetail(item.id)}
                style={{
                  minHeight: '44px',
                  width: '100%',
                  borderRadius: '0.6rem',
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  color: '#10b981',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer'
                }}
              >
                <Eye size={16} />
                Detail Profil Katalog
              </button>
            </div>
          ))
        )}
      </div>

      {/* 6. Mobile Touch-Friendly Numbered Pagination Bar */}
      {pagination.total > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem',
            borderRadius: '0.75rem',
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            style={{
              minWidth: '44px',
              minHeight: '44px',
              borderRadius: '0.55rem',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
              color: isDark ? '#e5e7eb' : '#374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: page <= 1 || loading ? 'not-allowed' : 'pointer',
              opacity: page <= 1 || loading ? 0.35 : 1
            }}
          >
            <ChevronLeft size={18} />
          </button>

          <div style={{ textAlign: 'center', fontSize: '0.82rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
            Hal <strong style={{ color: isDark ? '#f3f4f6' : '#111827' }}>{page}</strong> dari{' '}
            <strong style={{ color: isDark ? '#f3f4f6' : '#111827' }}>{pagination.total_pages || 1}</strong>
            <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>({pagination.total} toko)</div>
          </div>

          <button
            onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
            disabled={page >= pagination.total_pages || loading}
            style={{
              minWidth: '44px',
              minHeight: '44px',
              borderRadius: '0.55rem',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
              color: isDark ? '#e5e7eb' : '#374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: page >= pagination.total_pages || loading ? 'not-allowed' : 'pointer',
              opacity: page >= pagination.total_pages || loading ? 0.35 : 1
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* 7. Mobile Bottom Sheet Detail Inspector (Rule 7.A.3 & Rule 2) */}
      {selectedStoreID !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setSelectedStoreID(null)}
        >
          <div
            style={{
              width: '100%',
              maxHeight: '85vh',
              borderTopLeftRadius: '1.25rem',
              borderTopRightRadius: '1.25rem',
              backgroundColor: isDark ? '#18181b' : '#ffffff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}`,
              borderBottom: 'none',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Drag Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '0.65rem 0 0.25rem 0' }}>
              <div
                style={{
                  width: '40px',
                  height: '4px',
                  borderRadius: '2px',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : '#d1d5db'
                }}
              />
            </div>

            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1.25rem',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Store size={20} color="#10b981" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: isDark ? '#f3f4f6' : '#111827' }}>
                  Detail Profil Katalog
                </h3>
              </div>
              <button
                onClick={() => setSelectedStoreID(null)}
                style={{
                  minWidth: '40px',
                  minHeight: '40px',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
                  color: isDark ? '#e5e7eb' : '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
              {detailLoading ? (
                <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                  <RefreshCw size={28} className="animate-spin" color="#10b981" style={{ margin: '0 auto 0.5rem auto' }} />
                  <div style={{ fontSize: '0.82rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
                    Memuat data...
                  </div>
                </div>
              ) : storeDetail?.data ? (
                (() => {
                  const s = storeDetail.data;
                  const owner = s.User || {};
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Brand Info */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.85rem',
                          borderRadius: '0.75rem',
                          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`
                        }}
                      >
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '0.65rem',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0
                          }}
                        >
                          {s.store_logo_url ? (
                            <img src={s.store_logo_url} alt={s.store_title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Store size={22} color="#10b981" />
                          )}
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{s.store_title}</h4>
                          <a
                            href={`/${s.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.8rem',
                              color: '#10b981',
                              textDecoration: 'none',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              marginTop: '0.15rem'
                            }}
                          >
                            /{s.slug}
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>

                      {/* Owner Info Box */}
                      <div
                        style={{
                          padding: '0.85rem',
                          borderRadius: '0.75rem',
                          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb',
                          fontSize: '0.82rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.4rem'
                        }}
                      >
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <User size={14} color="#3b82f6" />
                          Pemilik Akun
                        </div>
                        <div>Nama: <strong>{owner.name || '-'}</strong></div>
                        <div>Email: <strong>{owner.email || '-'}</strong></div>
                        <div>ID: #{s.user_id}</div>
                      </div>

                      {/* Metrics Box */}
                      <div
                        style={{
                          padding: '0.85rem',
                          borderRadius: '0.75rem',
                          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb',
                          fontSize: '0.82rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.4rem'
                        }}
                      >
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Package size={14} color="#10b981" />
                          Metrik & Kapasitas
                        </div>
                        <div>Total Produk: <strong style={{ color: '#10b981' }}>{storeDetail.products_count} Item</strong></div>
                        <div>Total Kategori: <strong>{storeDetail.categories_count}</strong></div>
                        <div>Storage: <strong>{formatBytes(s.storage_used_bytes)}</strong></div>
                        <div>Terdaftar: {formatDate(s.created_at)}</div>
                      </div>

                      {/* Top Products */}
                      {storeDetail.top_products && storeDetail.top_products.length > 0 && (
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                            Sampel Produk ({storeDetail.top_products.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {storeDetail.top_products.map((p: any) => (
                              <div
                                key={p.id}
                                style={{
                                  padding: '0.55rem 0.75rem',
                                  borderRadius: '0.5rem',
                                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontSize: '0.8rem'
                                }}
                              >
                                <span style={{ fontWeight: 600 }}>{p.name}</span>
                                <span style={{ color: '#10b981', fontWeight: 700 }}>
                                  {formatCurrency(p.price || 0)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: isDark ? '#9ca3af' : '#6b7280' }}>
                  Gagal memuat detail toko.
                </div>
              )}
            </div>

            {/* Bottom Sheet Sticky Action Bar (Min touch target 44px) */}
            <div
              style={{
                padding: '0.85rem 1.25rem',
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
                display: 'flex',
                gap: '0.65rem'
              }}
            >
              {storeDetail?.data?.slug && (
                <a
                  href={`/${storeDetail.data.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    borderRadius: '0.65rem',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    textDecoration: 'none'
                  }}
                >
                  Buka Katalog
                  <ExternalLink size={14} />
                </a>
              )}
              <button
                onClick={() => setSelectedStoreID(null)}
                style={{
                  minHeight: '44px',
                  padding: '0 1.25rem',
                  borderRadius: '0.65rem',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#d1d5db'}`,
                  backgroundColor: 'transparent',
                  color: isDark ? '#e5e7eb' : '#374151',
                  fontWeight: 600,
                  fontSize: '0.88rem',
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
