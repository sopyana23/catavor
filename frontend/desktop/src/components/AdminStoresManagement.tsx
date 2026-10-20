import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Store,
  Search,
  Filter,
  RefreshCw,
  Eye,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  User,
  Mail,
  Phone,
  Calendar,
  HardDrive,
  Package,
  Sparkles,
  X,
  ArrowUpRight,
  Layers,
  Clock,
  ArrowUpDown
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
  const [jumpPage, setJumpPage] = useState('');

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

  // Detail Modal inspection
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
      setPage(1); // Reset to page 1 on search change
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

  // Fetch store detail for inspection modal
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
      // Fail silently or keep basic view
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

  const handleJumpPage = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(jumpPage, 10);
    if (!isNaN(target) && target >= 1 && target <= pagination.total_pages) {
      setPage(target);
      setJumpPage('');
    }
  };

  // Generate numbered pagination buttons
  const renderPaginationButtons = () => {
    const totalPages = pagination.total_pages || 1;
    const current = page;
    const delta = 2;
    const range: (number | string)[] = [];

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      } else if (range[range.length - 1] !== '...') {
        range.push('...');
      }
    }

    return range.map((item, idx) => {
      if (item === '...') {
        return (
          <span
            key={`dots-${idx}`}
            style={{
              padding: '0 0.5rem',
              color: isDark ? 'rgba(255,255,255,0.4)' : '#9ca3af',
              fontSize: '0.85rem'
            }}
          >
            ...
          </span>
        );
      }
      const pageNum = item as number;
      const isSelected = pageNum === current;
      return (
        <button
          key={`page-${pageNum}`}
          onClick={() => setPage(pageNum)}
          style={{
            minWidth: '36px',
            height: '36px',
            padding: '0 0.65rem',
            borderRadius: '0.5rem',
            border: isSelected
              ? '1px solid #10b981'
              : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
            backgroundColor: isSelected
              ? '#10b981'
              : isDark
              ? 'rgba(255,255,255,0.04)'
              : '#ffffff',
            color: isSelected ? '#ffffff' : isDark ? '#e5e7eb' : '#374151',
            fontSize: '0.85rem',
            fontWeight: isSelected ? 700 : 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {pageNum}
        </button>
      );
    });
  };

  // Quota calculation helper
  const getStorageQuota = (plan: string): number => {
    switch (plan) {
      case 'pro_business':
        return 5 * 1024 * 1024 * 1024; // 5 GB
      case 'pro_starter':
        return 1 * 1024 * 1024 * 1024; // 1 GB
      default:
        return 100 * 1024 * 1024; // 100 MB
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Header & Summary Stats Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.25rem 1.5rem',
          borderRadius: '1rem',
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
          boxShadow: isDark
            ? '0 4px 20px rgba(0,0,0,0.2)'
            : '0 2px 8px rgba(0,0,0,0.04)'
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.25rem'
            }}
          >
            <Store size={22} color="#10b981" />
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: isDark ? '#f3f4f6' : '#111827',
                margin: 0
              }}
            >
              Direktori Profil Katalog Terdaftar
            </h2>
          </div>
          <p
            style={{
              fontSize: '0.85rem',
              color: isDark ? '#9ca3af' : '#6b7280',
              margin: 0
            }}
          >
            Tata kelola dan inspeksi profil katalog aktif serta riwayat pelanggaran akun toko Catavor.
          </p>
        </div>

        {/* Global Stats Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '0.65rem',
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <CheckCircle2 size={16} color="#10b981" />
            <div>
              <div style={{ fontSize: '0.7rem', color: isDark ? '#9ca3af' : '#6b7280', fontWeight: 600 }}>
                Aktif
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#10b981' }}>
                {stats.total_active}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '0.65rem',
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <ShieldAlert size={16} color="#ef4444" />
            <div>
              <div style={{ fontSize: '0.7rem', color: isDark ? '#9ca3af' : '#6b7280', fontWeight: 600 }}>
                Banned / Suspend
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ef4444' }}>
                {stats.total_banned}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '0.65rem',
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#eff6ff',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Sparkles size={16} color="#3b82f6" />
            <div>
              <div style={{ fontSize: '0.7rem', color: isDark ? '#9ca3af' : '#6b7280', fontWeight: 600 }}>
                Pro Tier
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#3b82f6' }}>
                {stats.total_pro_starter + stats.total_pro_business}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Strict Sub-Tab Navigation (Active Only vs Violations/Banned Only) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
          paddingBottom: '0.5rem'
        }}
      >
        <button
          onClick={() => handleTabChange('active')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            borderRadius: '0.65rem',
            border: 'none',
            backgroundColor:
              subTab === 'active'
                ? isDark
                  ? 'rgba(16, 185, 129, 0.15)'
                  : '#ecfdf5'
                : 'transparent',
            color:
              subTab === 'active'
                ? '#10b981'
                : isDark
                ? '#9ca3af'
                : '#6b7280',
            fontWeight: subTab === 'active' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <CheckCircle2 size={18} />
          Profil Katalog Aktif
          <span
            style={{
              padding: '0.15rem 0.55rem',
              borderRadius: '1rem',
              backgroundColor: subTab === 'active' ? '#10b981' : isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb',
              color: subTab === 'active' ? '#ffffff' : isDark ? '#9ca3af' : '#4b5563',
              fontSize: '0.75rem',
              fontWeight: 700
            }}
          >
            {stats.total_active}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('banned')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            borderRadius: '0.65rem',
            border: 'none',
            backgroundColor:
              subTab === 'banned'
                ? isDark
                  ? 'rgba(239, 68, 68, 0.15)'
                  : '#fef2f2'
                : 'transparent',
            color:
              subTab === 'banned'
                ? '#ef4444'
                : isDark
                ? '#9ca3af'
                : '#6b7280',
            fontWeight: subTab === 'banned' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <ShieldAlert size={18} />
          Pelanggaran & Banned
          <span
            style={{
              padding: '0.15rem 0.55rem',
              borderRadius: '1rem',
              backgroundColor: subTab === 'banned' ? '#ef4444' : isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb',
              color: subTab === 'banned' ? '#ffffff' : isDark ? '#9ca3af' : '#4b5563',
              fontSize: '0.75rem',
              fontWeight: 700
            }}
          >
            {stats.total_banned}
          </span>
        </button>
      </div>

      {/* 3. Server-Side Filter & Search Command Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem',
          padding: '1rem',
          borderRadius: '0.85rem',
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.55rem 0.85rem',
              borderRadius: '0.65rem',
              backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
              flex: 1,
              maxWidth: '420px'
            }}
          >
            <Search size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            <input
              type="text"
              placeholder="Cari nama toko, slug, pemilik, WhatsApp..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: isDark ? '#f3f4f6' : '#111827',
                fontSize: '0.85rem'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isDark ? '#9ca3af' : '#6b7280',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Plan Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.8rem', color: isDark ? '#9ca3af' : '#6b7280', fontWeight: 600 }}>
              Paket:
            </span>
            <select
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.6rem',
                backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
                color: isDark ? '#f3f4f6' : '#111827',
                fontSize: '0.82rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Semua Paket</option>
              <option value="free">Gratis (Free)</option>
              <option value="pro_starter">Pro Starter</option>
              <option value="pro_business">Pro Business</option>
            </select>
          </div>

          {/* Sort Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ArrowUpDown size={15} color={isDark ? '#9ca3af' : '#6b7280'} />
            <select
              value={sortFilter}
              onChange={(e) => {
                setSortFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.6rem',
                backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
                color: isDark ? '#f3f4f6' : '#111827',
                fontSize: '0.82rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="created_at_desc">Terbaru Terdaftar</option>
              <option value="created_at_asc">Terlama Terdaftar</option>
              <option value="products_desc">Produk Terbanyak</option>
              <option value="title_asc">Nama Toko (A-Z)</option>
              <option value="activity_desc">Aktivitas Terakhir</option>
            </select>
          </div>
        </div>

        {/* Refresh Action */}
        <button
          onClick={fetchStores}
          disabled={loading}
          title="Muat ulang data terkini"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.5rem 0.95rem',
            borderRadius: '0.6rem',
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
            color: isDark ? '#e5e7eb' : '#374151',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* 4. Desktop Comprehensive Data Table */}
      <div
        style={{
          borderRadius: '1rem',
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
          overflow: 'hidden',
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '0.85rem'
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`
                }}
              >
                <th style={{ padding: '0.9rem 1rem', fontWeight: 700, color: isDark ? '#9ca3af' : '#6b7280' }}>
                  Profil Katalog
                </th>
                <th style={{ padding: '0.9rem 1rem', fontWeight: 700, color: isDark ? '#9ca3af' : '#6b7280' }}>
                  Pemilik & Kontak
                </th>
                <th style={{ padding: '0.9rem 1rem', fontWeight: 700, color: isDark ? '#9ca3af' : '#6b7280' }}>
                  Paket & Kuota
                </th>
                <th style={{ padding: '0.9rem 1rem', fontWeight: 700, color: isDark ? '#9ca3af' : '#6b7280', textAlign: 'center' }}>
                  Produk
                </th>
                <th style={{ padding: '0.9rem 1rem', fontWeight: 700, color: isDark ? '#9ca3af' : '#6b7280' }}>
                  Terdaftar / Terakhir Aktif
                </th>
                <th style={{ padding: '0.9rem 1rem', fontWeight: 700, color: isDark ? '#9ca3af' : '#6b7280' }}>
                  Status
                </th>
                <th style={{ padding: '0.9rem 1rem', fontWeight: 700, color: isDark ? '#9ca3af' : '#6b7280', textAlign: 'right' }}>
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
                    <RefreshCw size={28} className="animate-spin" color="#10b981" style={{ margin: '0 auto 0.75rem auto' }} />
                    <div style={{ fontSize: '0.88rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
                      Memuat daftar profil katalog dari server...
                    </div>
                  </td>
                </tr>
              ) : stores.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
                    <Store size={36} color={isDark ? 'rgba(255,255,255,0.2)' : '#d1d5db'} style={{ margin: '0 auto 0.75rem auto' }} />
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: isDark ? '#e5e7eb' : '#374151' }}>
                      Tidak Ada Profil Katalog
                    </div>
                    <div style={{ fontSize: '0.82rem', color: isDark ? '#9ca3af' : '#6b7280', marginTop: '0.25rem' }}>
                      {debouncedSearch
                        ? `Tidak ditemukan profil yang cocok dengan kata kunci "${debouncedSearch}".`
                        : subTab === 'active'
                        ? 'Belum ada profil toko aktif yang terdaftar.'
                        : 'Tidak ada toko yang sedang ditangguhkan atau di-banned.'}
                    </div>
                  </td>
                </tr>
              ) : (
                stores.map((item) => {
                  const quotaBytes = getStorageQuota(item.plan);
                  const storagePercent = Math.min(
                    100,
                    Math.round(((item.storage_used_bytes || 0) / quotaBytes) * 100)
                  );

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6'}`,
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isDark
                          ? 'rgba(255,255,255,0.03)'
                          : '#f9fafb';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* 1. Profil Katalog */}
                      <td style={{ padding: '0.9rem 1rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '0.65rem',
                              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
                              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
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
                              <Store size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
                            )}
                          </div>
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                color: isDark ? '#f3f4f6' : '#111827',
                                fontSize: '0.9rem'
                              }}
                            >
                              {item.store_title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                              <a
                                href={`/${item.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: '0.78rem',
                                  color: '#10b981',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  fontWeight: 600
                                }}
                              >
                                /{item.slug}
                                <ExternalLink size={12} />
                              </a>
                            </div>
                            {item.store_slogan && (
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color: isDark ? '#9ca3af' : '#6b7280',
                                  marginTop: '0.15rem',
                                  maxWidth: '220px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {item.store_slogan}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Pemilik & Kontak */}
                      <td style={{ padding: '0.9rem 1rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div style={{ fontWeight: 600, color: isDark ? '#e5e7eb' : '#374151' }}>
                            {item.user_name || 'Tanpa Nama'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
                            {item.user_email}
                          </div>
                          {item.whatsapp_number && (
                            <a
                              href={`https://wa.me/${item.whatsapp_number.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: '0.75rem',
                                color: '#10b981',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                marginTop: '0.1rem'
                              }}
                            >
                              <Phone size={12} />
                              +{item.whatsapp_number}
                            </a>
                          )}
                        </div>
                      </td>

                      {/* 3. Paket & Kuota */}
                      <td style={{ padding: '0.9rem 1rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <div>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '0.45rem',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                backgroundColor:
                                  item.plan === 'pro_business'
                                    ? isDark
                                      ? 'rgba(168, 85, 247, 0.2)'
                                      : '#f3e8ff'
                                    : item.plan === 'pro_starter'
                                    ? isDark
                                      ? 'rgba(59, 130, 246, 0.2)'
                                      : '#eff6ff'
                                    : isDark
                                    ? 'rgba(255,255,255,0.08)'
                                    : '#f3f4f6',
                                color:
                                  item.plan === 'pro_business'
                                    ? '#a855f7'
                                    : item.plan === 'pro_starter'
                                    ? '#3b82f6'
                                    : isDark
                                    ? '#9ca3af'
                                    : '#4b5563'
                              }}
                            >
                              {item.plan === 'pro_business'
                                ? 'Pro Business'
                                : item.plan === 'pro_starter'
                                ? 'Pro Starter'
                                : 'Gratis'}
                            </span>
                          </div>
                          {/* Storage meter */}
                          <div style={{ width: '130px' }}>
                            <div
                              style={{
                                height: '5px',
                                borderRadius: '3px',
                                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb',
                                overflow: 'hidden'
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${storagePercent}%`,
                                  backgroundColor:
                                    storagePercent > 85 ? '#ef4444' : '#10b981'
                                }}
                              />
                            </div>
                            <div
                              style={{
                                fontSize: '0.7rem',
                                color: isDark ? '#9ca3af' : '#6b7280',
                                marginTop: '0.2rem'
                              }}
                            >
                              {formatBytes(item.storage_used_bytes)} / {formatBytes(quotaBytes)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 4. Produk */}
                      <td style={{ padding: '0.9rem 1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '0.5rem',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
                            fontWeight: 700,
                            color: isDark ? '#e5e7eb' : '#374151'
                          }}
                        >
                          <Package size={14} color="#10b981" />
                          {item.products_count || 0}
                        </div>
                      </td>

                      {/* 5. Terdaftar / Terakhir Aktif */}
                      <td style={{ padding: '0.9rem 1rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div
                            style={{
                              fontSize: '0.78rem',
                              color: isDark ? '#e5e7eb' : '#374151',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <Calendar size={13} color={isDark ? '#9ca3af' : '#6b7280'} />
                            {formatDate(item.created_at)}
                          </div>
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: isDark ? '#9ca3af' : '#6b7280',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <Clock size={12} />
                            Aktif: {item.last_activity_at ? formatDate(item.last_activity_at) : 'Baru'}
                          </div>
                        </div>
                      </td>

                      {/* 6. Status */}
                      <td style={{ padding: '0.9rem 1rem', verticalAlign: 'middle' }}>
                        {subTab === 'active' ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '0.5rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}
                          >
                            <CheckCircle2 size={13} />
                            Aktif & Terdaftar
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.3)'
                              }}
                            >
                              <ShieldAlert size={13} />
                              {item.is_suspended ? 'Ditangguhkan' : 'Banned / Dorman'}
                            </span>
                            {item.suspension_reason && (
                              <div
                                style={{
                                  fontSize: '0.72rem',
                                  color: isDark ? '#f87171' : '#dc2626',
                                  maxWidth: '180px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {item.suspension_reason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 7. Aksi */}
                      <td style={{ padding: '0.9rem 1rem', verticalAlign: 'middle', textAlign: 'right' }}>
                        <button
                          onClick={() => fetchStoreDetail(item.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.45rem 0.85rem',
                            borderRadius: '0.55rem',
                            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            color: '#10b981',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Eye size={14} />
                          Inspeksi
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Enterprise Desktop Pagination Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '0.95rem 1.25rem',
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`
          }}
        >
          {/* Rows per page & Counter summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.82rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
                Tampilkan:
              </span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value, 10));
                  setPage(1);
                }}
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: '0.5rem',
                  backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
                  color: isDark ? '#f3f4f6' : '#111827',
                  fontSize: '0.82rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span style={{ fontSize: '0.82rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
                baris
              </span>
            </div>

            <div style={{ fontSize: '0.82rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
              Menampilkan{' '}
              <strong style={{ color: isDark ? '#f3f4f6' : '#111827' }}>
                {pagination.total > 0 ? (page - 1) * limit + 1 : 0}
              </strong>{' '}
              –{' '}
              <strong style={{ color: isDark ? '#f3f4f6' : '#111827' }}>
                {Math.min(page * limit, pagination.total)}
              </strong>{' '}
              dari{' '}
              <strong style={{ color: isDark ? '#f3f4f6' : '#111827' }}>
                {pagination.total}
              </strong>{' '}
              profil katalog
            </div>
          </div>

          {/* Numbered Pagination & Navigation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1 || loading}
              title="Halaman Pertama"
              style={{
                width: '36px',
                height: '36px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '0.5rem',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                color: isDark ? '#e5e7eb' : '#374151',
                cursor: page <= 1 || loading ? 'not-allowed' : 'pointer',
                opacity: page <= 1 || loading ? 0.35 : 1
              }}
            >
              <ChevronsLeft size={16} />
            </button>

            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loading}
              title="Halaman Sebelumnya"
              style={{
                width: '36px',
                height: '36px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '0.5rem',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                color: isDark ? '#e5e7eb' : '#374151',
                cursor: page <= 1 || loading ? 'not-allowed' : 'pointer',
                opacity: page <= 1 || loading ? 0.35 : 1
              }}
            >
              <ChevronLeft size={16} />
            </button>

            {/* Numbered buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {renderPaginationButtons()}
            </div>

            <button
              onClick={() => setPage((prev) => Math.min(pagination.total_pages, prev + 1))}
              disabled={page >= pagination.total_pages || loading}
              title="Halaman Selanjutnya"
              style={{
                width: '36px',
                height: '36px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '0.5rem',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                color: isDark ? '#e5e7eb' : '#374151',
                cursor: page >= pagination.total_pages || loading ? 'not-allowed' : 'pointer',
                opacity: page >= pagination.total_pages || loading ? 0.35 : 1
              }}
            >
              <ChevronRight size={16} />
            </button>

            <button
              onClick={() => setPage(pagination.total_pages)}
              disabled={page >= pagination.total_pages || loading}
              title="Halaman Terakhir"
              style={{
                width: '36px',
                height: '36px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '0.5rem',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                color: isDark ? '#e5e7eb' : '#374151',
                cursor: page >= pagination.total_pages || loading ? 'not-allowed' : 'pointer',
                opacity: page >= pagination.total_pages || loading ? 0.35 : 1
              }}
            >
              <ChevronsRight size={16} />
            </button>

            {/* Quick jump to page */}
            <form onSubmit={handleJumpPage} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.5rem' }}>
              <input
                type="number"
                min={1}
                max={pagination.total_pages || 1}
                placeholder="Hal"
                value={jumpPage}
                onChange={(e) => setJumpPage(e.target.value)}
                style={{
                  width: '54px',
                  height: '36px',
                  padding: '0 0.4rem',
                  borderRadius: '0.5rem',
                  backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
                  color: isDark ? '#f3f4f6' : '#111827',
                  fontSize: '0.82rem',
                  textAlign: 'center',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                style={{
                  height: '36px',
                  padding: '0 0.65rem',
                  borderRadius: '0.5rem',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
                  border: 'none',
                  color: isDark ? '#e5e7eb' : '#374151',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Go
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 6. Centered Modal Inspeksi Detail Toko (Rule 7.A: Centered Modal on Desktop) */}
      {selectedStoreID !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.5rem'
          }}
          onClick={() => setSelectedStoreID(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              borderRadius: '1.25rem',
              backgroundColor: isDark ? '#18181b' : '#ffffff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}`,
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
                backgroundColor: isDark ? '#1f1f23' : '#f9fafb'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Store size={22} color="#10b981" />
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      color: isDark ? '#f3f4f6' : '#111827'
                    }}
                  >
                    Inspeksi Profil Katalog
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
                    ID: #{selectedStoreID}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedStoreID(null)}
                style={{
                  width: '32px',
                  height: '32px',
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

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {detailLoading ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                  <RefreshCw size={28} className="animate-spin" color="#10b981" style={{ margin: '0 auto 0.75rem auto' }} />
                  <div style={{ fontSize: '0.85rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
                    Memuat data detail toko...
                  </div>
                </div>
              ) : storeDetail?.data ? (
                (() => {
                  const s = storeDetail.data;
                  const owner = s.User || {};
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Brand Hero Card */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          padding: '1.25rem',
                          borderRadius: '1rem',
                          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`
                        }}
                      >
                        <div
                          style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '0.85rem',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0
                          }}
                        >
                          {s.store_logo_url ? (
                            <img
                              src={s.store_logo_url}
                              alt={s.store_title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <Store size={28} color="#10b981" />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <h4
                              style={{
                                margin: 0,
                                fontSize: '1.15rem',
                                fontWeight: 800,
                                color: isDark ? '#f3f4f6' : '#111827'
                              }}
                            >
                              {s.store_title}
                            </h4>
                            <span
                              style={{
                                padding: '0.2rem 0.55rem',
                                borderRadius: '0.45rem',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.3)'
                              }}
                            >
                              {s.dormancy_status === 'active' ? 'Aktif' : s.dormancy_status}
                            </span>
                            <span
                              style={{
                                padding: '0.2rem 0.55rem',
                                borderRadius: '0.45rem',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
                                color: '#3b82f6',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                textTransform: 'uppercase'
                              }}
                            >
                              {s.plan || 'Free'}
                            </span>
                          </div>
                          {s.store_slogan && (
                            <p
                              style={{
                                margin: '0.25rem 0 0.5rem 0',
                                fontSize: '0.85rem',
                                color: isDark ? '#9ca3af' : '#6b7280'
                              }}
                            >
                              {s.store_slogan}
                            </p>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginTop: '0.35rem' }}>
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
                                fontWeight: 600
                              }}
                            >
                              Kunjungi /{s.slug}
                              <ExternalLink size={13} />
                            </a>
                            {s.whatsapp_number && (
                              <a
                                href={`https://wa.me/${s.whatsapp_number.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: '0.82rem',
                                  color: isDark ? '#9ca3af' : '#6b7280',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}
                              >
                                <Phone size={13} />
                                +{s.whatsapp_number}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 2-Column Grid: Owner Details & Metrics */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* Box 1: Data Pemilik Toko */}
                        <div
                          style={{
                            padding: '1rem',
                            borderRadius: '0.85rem',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              marginBottom: '0.75rem',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              color: isDark ? '#e5e7eb' : '#374151'
                            }}
                          >
                            <User size={16} color="#3b82f6" />
                            Data Pemilik Akun
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.82rem' }}>
                            <div>
                              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Nama: </span>
                              <strong style={{ color: isDark ? '#f3f4f6' : '#111827' }}>
                                {owner.name || '-'}
                              </strong>
                            </div>
                            <div>
                              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Email: </span>
                              <strong style={{ color: isDark ? '#f3f4f6' : '#111827' }}>
                                {owner.email || '-'}
                              </strong>
                            </div>
                            <div>
                              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>User ID: </span>
                              <span style={{ color: isDark ? '#e5e7eb' : '#374151' }}>
                                #{s.user_id}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Peran Platform: </span>
                              <span style={{ color: isDark ? '#e5e7eb' : '#374151', textTransform: 'capitalize' }}>
                                {owner.platform_role || 'Merchant'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Box 2: Metrik Katalog & Kapasitas */}
                        <div
                          style={{
                            padding: '1rem',
                            borderRadius: '0.85rem',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              marginBottom: '0.75rem',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              color: isDark ? '#e5e7eb' : '#374151'
                            }}
                          >
                            <Package size={16} color="#10b981" />
                            Metrik & Kapasitas
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.82rem' }}>
                            <div>
                              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Total Produk: </span>
                              <strong style={{ color: '#10b981' }}>
                                {storeDetail.products_count || 0} Item
                              </strong>
                            </div>
                            <div>
                              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Total Kategori: </span>
                              <strong style={{ color: isDark ? '#f3f4f6' : '#111827' }}>
                                {storeDetail.categories_count || 0} Kategori
                              </strong>
                            </div>
                            <div>
                              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Storage Terpakai: </span>
                              <strong style={{ color: isDark ? '#f3f4f6' : '#111827' }}>
                                {formatBytes(s.storage_used_bytes)}
                              </strong>
                            </div>
                            <div>
                              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Terdaftar Sejak: </span>
                              <span style={{ color: isDark ? '#e5e7eb' : '#374151' }}>
                                {formatDate(s.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Top Products Preview */}
                      {storeDetail.top_products && storeDetail.top_products.length > 0 && (
                        <div>
                          <div
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              color: isDark ? '#e5e7eb' : '#374151',
                              marginBottom: '0.65rem'
                            }}
                          >
                            Sampel Produk Terdaftar ({storeDetail.top_products.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {storeDetail.top_products.map((p: any) => (
                              <div
                                key={p.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.65rem 0.85rem',
                                  borderRadius: '0.6rem',
                                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
                                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`,
                                  fontSize: '0.82rem'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                  <Package size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                                  <span style={{ fontWeight: 600, color: isDark ? '#f3f4f6' : '#111827' }}>
                                    {p.name}
                                  </span>
                                </div>
                                <div style={{ fontWeight: 700, color: '#10b981' }}>
                                  {formatCurrency(p.price || 0)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: isDark ? '#9ca3af' : '#6b7280' }}>
                  Gagal memuat detail toko.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                padding: '1rem 1.5rem',
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
                backgroundColor: isDark ? '#1f1f23' : '#f9fafb'
              }}
            >
              {storeDetail?.data?.slug && (
                <a
                  href={`/${storeDetail.data.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.55rem 1rem',
                    borderRadius: '0.6rem',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                >
                  Buka Katalog Publik
                  <ExternalLink size={14} />
                </a>
              )}
              <button
                onClick={() => setSelectedStoreID(null)}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '0.6rem',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#d1d5db'}`,
                  backgroundColor: 'transparent',
                  color: isDark ? '#e5e7eb' : '#374151',
                  fontSize: '0.85rem',
                  fontWeight: 600,
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
