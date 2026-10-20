import React, { useState, useEffect, useCallback } from 'react';
import {
  Store,
  Search,
  RefreshCw,
  Eye,
  ExternalLink,
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
import { TabletSegmentedPagination } from './TabletSegmentedPagination';
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

interface TabletPlatformStoresViewProps {
  token: string;
  onNavigateToTab?: (tab: string) => void;
  hideHeader?: boolean;
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

export const TabletPlatformStoresView: React.FC<TabletPlatformStoresViewProps> = ({
  token,
  hideHeader = false
}) => {
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

  // Detail Side Sheet inspection
  const [selectedStoreID, setSelectedStoreID] = useState<number | null>(null);
  const [storeDetail, setStoreDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modal Back Navigation Interceptor (Rule 2)
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

  // Fetch store detail for side sheet
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 1. Tablet Header & KPI Bar - Only rendered when not embedded with a parent header */}
      {!hideHeader && (
        <div
          style={{
            padding: '1.25rem 1.5rem',
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            flexShrink: 0
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <Store size={20} color="#10b981" />
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Direktori Profil Toko
              </h2>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Daftar profil katalog terdaftar dan tata kelola akun kepatuhan.
            </div>
          </div>

          {/* Status Counters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '0.6rem',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <CheckCircle2 size={16} color="#10b981" />
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981' }}>
                {stats.total_active} Aktif
              </div>
            </div>

            <div
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '0.6rem',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <ShieldAlert size={16} color="#ef4444" />
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ef4444' }}>
                {stats.total_banned} Banned
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Sub-Tab Segmented Switcher & Search Bar */}
      <div
        style={{
          padding: '0.85rem 1.5rem',
          backgroundColor: 'var(--bg-deep)',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          flexShrink: 0
        }}
      >
        {/* Segmented Sub-Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => handleTabChange('active')}
            style={{
              minHeight: '44px',
              padding: '0 1.25rem',
              borderRadius: '0.65rem',
              border: 'none',
              backgroundColor: subTab === 'active' ? '#10b981' : 'var(--bg-card)',
              color: subTab === 'active' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.88rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <CheckCircle2 size={17} />
            Profil Katalog Aktif ({stats.total_active})
          </button>

          <button
            onClick={() => handleTabChange('banned')}
            style={{
              minHeight: '44px',
              padding: '0 1.25rem',
              borderRadius: '0.65rem',
              border: 'none',
              backgroundColor: subTab === 'banned' ? '#ef4444' : 'var(--bg-card)',
              color: subTab === 'banned' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.88rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <ShieldAlert size={17} />
            Pelanggaran & Banned ({stats.total_banned})
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div
            style={{
              flex: 1,
              minWidth: '240px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0 0.85rem',
              borderRadius: '0.65rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)'
            }}
          >
            <Search size={18} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Cari toko, slug, pemilik, WhatsApp..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.88rem'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Plan Filter */}
          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setPage(1);
            }}
            style={{
              minHeight: '44px',
              padding: '0 0.85rem',
              borderRadius: '0.65rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">Semua Paket</option>
            <option value="free">Gratis</option>
            <option value="pro_starter">Pro Starter</option>
            <option value="pro_business">Pro Business</option>
          </select>

          {/* Sort Filter */}
          <select
            value={sortFilter}
            onChange={(e) => {
              setSortFilter(e.target.value);
              setPage(1);
            }}
            style={{
              minHeight: '44px',
              padding: '0 0.85rem',
              borderRadius: '0.65rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="created_at_desc">Terbaru</option>
            <option value="created_at_asc">Terlama</option>
            <option value="products_desc">Produk Terbanyak</option>
            <option value="title_asc">Nama (A-Z)</option>
            <option value="activity_desc">Aktivitas Terakhir</option>
          </select>

          {/* Refresh button */}
          <button
            onClick={fetchStores}
            disabled={loading}
            title="Muat Ulang"
            style={{
              minWidth: '44px',
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '0.65rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-primary)',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 3. Tablet Content Area: Adaptive Touch Card Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
        {loading ? (
          <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
            <RefreshCw size={32} className="animate-spin" color="#10b981" style={{ margin: '0 auto 1rem auto' }} />
            <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
              Memuat profil katalog...
            </div>
          </div>
        ) : stores.length === 0 ? (
          <div
            style={{
              padding: '4rem 1rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1rem',
              border: '1px solid var(--border-light)'
            }}
          >
            <Store size={44} color="var(--text-muted)" style={{ margin: '0 auto 1rem auto' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.4rem 0' }}>
              Tidak Ada Profil Katalog
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
              {debouncedSearch
                ? `Tidak ditemukan profil yang sesuai dengan "${debouncedSearch}".`
                : subTab === 'active'
                ? 'Belum ada profil toko aktif yang terdaftar.'
                : 'Tidak ada profil toko yang sedang ditangguhkan.'}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '1rem'
            }}
          >
            {stores.map((item) => {
              const quotaBytes = getStorageQuota(item.plan);
              const storagePercent = Math.min(
                100,
                Math.round(((item.storage_used_bytes || 0) / quotaBytes) * 100)
              );

              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '1rem',
                    border: '1px solid var(--border-light)',
                    padding: '1.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.95rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                  }}
                >
                  {/* Card Header: Logo, Title, Badges */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '0.75rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          flexShrink: 0
                        }}
                      >
                        {item.store_logo_url ? (
                          <img
                            src={item.store_logo_url}
                            alt={item.store_title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Store size={22} color="var(--text-muted)" />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <h4
                            style={{
                              margin: 0,
                              fontSize: '0.98rem',
                              fontWeight: 800,
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '180px'
                            }}
                          >
                            {item.store_title}
                          </h4>
                          <span
                            style={{
                              padding: '0.15rem 0.5rem',
                              borderRadius: '0.4rem',
                              fontSize: '0.7rem',
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
                                  : 'var(--text-muted)'
                            }}
                          >
                            {item.plan || 'Free'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                          <a
                            href={`/${item.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.8rem',
                              color: '#10b981',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontWeight: 600
                            }}
                          >
                            /{item.slug}
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Metadata Rows */}
                    <div
                      style={{
                        marginTop: '0.85rem',
                        padding: '0.75rem',
                        borderRadius: '0.65rem',
                        backgroundColor: 'var(--bg-deep)',
                        fontSize: '0.8rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Pemilik:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{item.user_name || '-'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{item.user_email}</span>
                      </div>
                      {item.whatsapp_number && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted)' }}>WhatsApp:</span>
                          <a
                            href={`https://wa.me/${item.whatsapp_number.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#10b981', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <Phone size={12} />
                            +{item.whatsapp_number}
                          </a>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Katalog:</span>
                        <span style={{ color: '#10b981', fontWeight: 700 }}>
                          {item.products_count} Produk
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Status & Action Button */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '0.65rem',
                      borderTop: '1px solid var(--border-light)'
                    }}
                  >
                    <div>
                      {subTab === 'active' ? (
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: '#10b981',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <CheckCircle2 size={13} />
                          Aktif Normal
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: '#ef4444',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <ShieldAlert size={13} />
                          {item.is_suspended ? 'Ditangguhkan' : 'Banned'}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => fetchStoreDetail(item.id)}
                      style={{
                        minHeight: '40px',
                        padding: '0 0.95rem',
                        borderRadius: '0.55rem',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        color: '#10b981',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        cursor: 'pointer'
                      }}
                    >
                      <Eye size={15} />
                      Detail Profil
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Numbered Segmented Pagination Bar (Tablet Native) */}
      <div style={{ flexShrink: 0 }}>
        <TabletSegmentedPagination
          currentPage={page}
          totalPages={pagination.total_pages || 1}
          totalRecords={pagination.total}
          onPageChange={(newPage) => setPage(newPage)}
          isLoading={loading}
        />
      </div>

      {/* 5. Tablet Side Sheet for Detailed Store Inspection (Rule 7.A: Side Sheet on Tablet) */}
      {selectedStoreID !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setSelectedStoreID(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '540px',
              height: '100%',
              backgroundColor: 'var(--bg-card)',
              borderLeft: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Store size={22} color="#10b981" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Detail Profil Katalog
                </h3>
              </div>
              <button
                onClick={() => setSelectedStoreID(null)}
                style={{
                  minWidth: '40px',
                  minHeight: '40px',
                  borderRadius: '0.55rem',
                  border: 'none',
                  backgroundColor: 'var(--bg-deep)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Sheet Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {detailLoading ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                  <RefreshCw size={28} className="animate-spin" color="#10b981" style={{ margin: '0 auto 0.75rem auto' }} />
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Memuat data detail profil...
                  </div>
                </div>
              ) : storeDetail?.data ? (
                (() => {
                  const s = storeDetail.data;
                  const owner = s.User || {};
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Identity Card */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          padding: '1.15rem',
                          borderRadius: '0.85rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)'
                        }}
                      >
                        <div
                          style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '0.75rem',
                            backgroundColor: 'var(--bg-card)',
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
                            <Store size={26} color="#10b981" />
                          )}
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                            {s.store_title}
                          </h4>
                          <a
                            href={`/${s.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.82rem',
                              color: '#10b981',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              marginTop: '0.25rem',
                              fontWeight: 600
                            }}
                          >
                            /{s.slug}
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>

                      {/* Owner Details */}
                      <div
                        style={{
                          padding: '1rem',
                          borderRadius: '0.85rem',
                          backgroundColor: 'var(--bg-deep)',
                          fontSize: '0.85rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <User size={15} color="#3b82f6" />
                          Informasi Pemilik Akun
                        </div>
                        <div>Nama: <strong>{owner.name || '-'}</strong></div>
                        <div>Email: <strong>{owner.email || '-'}</strong></div>
                        <div>User ID: #{s.user_id}</div>
                      </div>

                      {/* Store Metrics */}
                      <div
                        style={{
                          padding: '1rem',
                          borderRadius: '0.85rem',
                          backgroundColor: 'var(--bg-deep)',
                          fontSize: '0.85rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Package size={15} color="#10b981" />
                          Metrik & Kapasitas
                        </div>
                        <div>Total Produk: <strong style={{ color: '#10b981' }}>{storeDetail.products_count} Item</strong></div>
                        <div>Total Kategori: <strong>{storeDetail.categories_count}</strong></div>
                        <div>Storage Digunakan: <strong>{formatBytes(s.storage_used_bytes)}</strong></div>
                        <div>Terdaftar: {formatDate(s.created_at)}</div>
                      </div>

                      {/* Top Products */}
                      {storeDetail.top_products && storeDetail.top_products.length > 0 && (
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                            Produk Teratas ({storeDetail.top_products.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                            {storeDetail.top_products.map((p: any) => (
                              <div
                                key={p.id}
                                style={{
                                  padding: '0.65rem 0.85rem',
                                  borderRadius: '0.55rem',
                                  backgroundColor: 'var(--bg-deep)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontSize: '0.82rem'
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
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Gagal memuat detail toko.
                </div>
              )}
            </div>

            {/* Sheet Footer */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '0.75rem',
                flexShrink: 0
              }}
            >
              {storeDetail?.data?.slug && (
                <a
                  href={`/${storeDetail.data.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    minHeight: '44px',
                    padding: '0 1.25rem',
                    borderRadius: '0.65rem',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
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
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-deep)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
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
