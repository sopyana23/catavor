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
  ArrowUpDown,
  RotateCcw,
  SlidersHorizontal,
  Globe,
  ArrowRightLeft
} from 'lucide-react';
import { useModalBackHandler } from '../utils/navigation';
import { DesktopCustomSelect } from './DesktopCustomSelect';

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

export const AdminStoresManagement: React.FC<AdminStoresManagementProps> = ({
  token,
  themeMode = 'dark',
  hideHeader = false
}) => {
  const isDark = themeMode === 'dark';

  // Sub-tab: strictly separated Active Profiles vs Banned/Suspended Profiles
  const [subTab, setSubTab] = useState<'active' | 'banned'>('active');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [planStatusFilter, setPlanStatusFilter] = useState('all');
  const [dormancyLevelFilter, setDormancyLevelFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [customDomainFilter, setCustomDomainFilter] = useState('all');
  const [violationTypeFilter, setViolationTypeFilter] = useState('all');
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
        plan: planFilter,
        plan_status: planStatusFilter,
        dormancy_level: dormancyLevelFilter,
        product_filter: productFilter,
        custom_domain: customDomainFilter,
        violation_type: violationTypeFilter
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
  }, [
    token,
    subTab,
    page,
    limit,
    sortFilter,
    planFilter,
    planStatusFilter,
    dormancyLevelFilter,
    productFilter,
    customDomainFilter,
    violationTypeFilter,
    debouncedSearch
  ]);

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
    setPlanFilter('all');
    setPlanStatusFilter('all');
    setDormancyLevelFilter('all');
    setProductFilter('all');
    setCustomDomainFilter('all');
    setViolationTypeFilter('all');
    setSortFilter('created_at_desc');
  };

  const clearAllFilters = () => {
    setPlanFilter('all');
    setPlanStatusFilter('all');
    setDormancyLevelFilter('all');
    setProductFilter('all');
    setCustomDomainFilter('all');
    setViolationTypeFilter('all');
    setSortFilter('created_at_desc');
    setPage(1);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (subTab === 'active') {
      if (planFilter !== 'all') count++;
      if (planStatusFilter !== 'all') count++;
      if (dormancyLevelFilter !== 'all') count++;
      if (productFilter !== 'all') count++;
      if (customDomainFilter !== 'all') count++;
      if (sortFilter !== 'created_at_desc') count++;
    } else {
      if (violationTypeFilter !== 'all') count++;
      if (planFilter !== 'all') count++;
      if (planStatusFilter !== 'all') count++;
      if (productFilter !== 'all') count++;
      if (customDomainFilter !== 'all') count++;
      if (sortFilter !== 'created_at_desc') count++;
    }
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

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
      {/* 1. Header & Summary Stats Bar (Only rendered when not embedded with a parent header) */}
      {!hideHeader && (
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
                Direktori Profil Merchant Terdaftar
              </h2>
            </div>
            <p
              style={{
                fontSize: '0.85rem',
                color: isDark ? '#9ca3af' : '#6b7280',
                margin: 0
              }}
            >
              Tata kelola dan inspeksi profil merchant aktif serta riwayat penegakan akun merchant Catavor.
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
      )}

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
          Profil Merchant Aktif
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
          flexDirection: 'column',
          gap: '0.75rem',
          padding: '1rem',
          borderRadius: '0.85rem',
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`
        }}
      >
        {/* Tier 1: Search Bar & Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.55rem 0.95rem',
              borderRadius: '0.65rem',
              backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
              flex: 1,
              minWidth: '280px',
              maxWidth: '480px'
            }}
          >
            <Search size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            <input
              type="text"
              placeholder="Cari nama merchant, slug, pemilik, WhatsApp..."
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

          {/* Quick Actions: Counter & Reset Filter Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                fontSize: '0.8rem',
                color: isDark ? '#9ca3af' : '#6b7280',
                fontWeight: 600
              }}
            >
              Total {pagination.total} merchant {subTab === 'active' ? 'aktif' : 'disanksi'}
            </div>

            <button
              type="button"
              onClick={clearAllFilters}
              disabled={activeFilterCount === 0}
              title={activeFilterCount > 0 ? "Atur ulang seluruh filter pencarian" : "Tidak ada filter aktif"}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.5rem 0.95rem',
                borderRadius: '0.6rem',
                backgroundColor: activeFilterCount > 0
                  ? (isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)')
                  : (isDark ? 'rgba(255,255,255,0.04)' : '#ffffff'),
                border: `1px solid ${activeFilterCount > 0
                  ? (isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)')
                  : (isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db')}`,
                color: activeFilterCount > 0 ? '#ef4444' : (isDark ? '#64748b' : '#9ca3af'),
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: activeFilterCount > 0 ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease'
              }}
            >
              <RotateCcw size={14} />
              <span>Reset Filter</span>
              {activeFilterCount > 0 && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '0.08rem 0.4rem',
                    borderRadius: '999px',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    fontWeight: 800
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tier 2: Symmetrical Multi-Filter Bar with Clean Grid Alignment */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
            gap: '0.65rem',
            paddingTop: '0.5rem',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`
          }}
        >
          {subTab === 'active' ? (
            <>
              {/* Filter 1: Plan */}
              <DesktopCustomSelect
                label="Paket"
                icon={<Sparkles size={14} />}
                value={planFilter}
                onChange={(val) => {
                  setPlanFilter(val);
                  setPage(1);
                }}
                highlight={planFilter !== 'all'}
                options={[
                  { value: 'all', label: 'Semua Paket' },
                  { value: 'free', label: 'Gratis (Free)' },
                  { value: 'pro_starter', label: 'Pro Starter' },
                  { value: 'pro_business', label: 'Pro Business' }
                ]}
                triggerStyle={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  borderColor: planFilter !== 'all' ? '#10b981' : isDark ? 'rgba(255,255,255,0.1)' : '#d1d5db'
                }}
                dropdownStyle={{ minWidth: '190px' }}
              />

              {/* Filter 2: Masa Aktif */}
              <DesktopCustomSelect
                label="Masa Aktif"
                icon={<Clock size={14} />}
                value={planStatusFilter}
                onChange={(val) => {
                  setPlanStatusFilter(val);
                  setPage(1);
                }}
                highlight={planStatusFilter !== 'all'}
                options={[
                  { value: 'all', label: 'Semua Status' },
                  { value: 'active', label: 'Aktif Normal' },
                  { value: 'grace_period', label: 'Masa Tenggang' },
                  { value: 'expired', label: 'Kedaluwarsa' }
                ]}
                triggerStyle={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  borderColor: planStatusFilter !== 'all' ? '#10b981' : isDark ? 'rgba(255,255,255,0.1)' : '#d1d5db'
                }}
                dropdownStyle={{ minWidth: '190px' }}
              />

              {/* Filter 3: Kesehatan */}
              <DesktopCustomSelect
                label="Kesehatan"
                icon={<ShieldCheck size={14} />}
                value={dormancyLevelFilter}
                onChange={(val) => {
                  setDormancyLevelFilter(val);
                  setPage(1);
                }}
                highlight={dormancyLevelFilter !== 'all'}
                options={[
                  { value: 'all', label: 'Semua Tingkat' },
                  { value: 'active', label: 'Sehat & Aktif' },
                  { value: 'warning_1', label: 'Peringatan 1 (30 Hari)' },
                  { value: 'warning_2', label: 'Peringatan 2 (60 Hari)' }
                ]}
                triggerStyle={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  borderColor: dormancyLevelFilter !== 'all' ? '#10b981' : isDark ? 'rgba(255,255,255,0.1)' : '#d1d5db'
                }}
                dropdownStyle={{ minWidth: '200px' }}
              />

              {/* Filter 4: Item */}
              <DesktopCustomSelect
                label="Item"
                icon={<Package size={14} />}
                value={productFilter}
                onChange={(val) => {
                  setProductFilter(val);
                  setPage(1);
                }}
                highlight={productFilter !== 'all'}
                options={[
                  { value: 'all', label: 'Semua Item' },
                  { value: 'has_products', label: 'Memiliki Item (>0)' },
                  { value: 'no_products', label: 'Tanpa Item (0)' }
                ]}
                triggerStyle={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  borderColor: productFilter !== 'all' ? '#10b981' : isDark ? 'rgba(255,255,255,0.1)' : '#d1d5db'
                }}
                dropdownStyle={{ minWidth: '190px' }}
              />

              {/* Filter 5: Domain */}
              <DesktopCustomSelect
                label="Domain"
                icon={<Globe size={14} />}
                value={customDomainFilter}
                onChange={(val) => {
                  setCustomDomainFilter(val);
                  setPage(1);
                }}
                highlight={customDomainFilter !== 'all'}
                options={[
                  { value: 'all', label: 'Semua Domain' },
                  { value: 'with_domain', label: 'Custom Domain' },
                  { value: 'no_domain', label: 'Subdomain' }
                ]}
                triggerStyle={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  borderColor: customDomainFilter !== 'all' ? '#10b981' : isDark ? 'rgba(255,255,255,0.1)' : '#d1d5db'
                }}
                dropdownStyle={{ minWidth: '190px' }}
              />

              {/* Filter 6: Urutan */}
              <DesktopCustomSelect
                label="Urutan"
                icon={<ArrowUpDown size={14} />}
                value={sortFilter}
                onChange={(val) => {
                  setSortFilter(val);
                  setPage(1);
                }}
                highlight={sortFilter !== 'created_at_desc'}
                options={[
                  { value: 'created_at_desc', label: 'Terbaru Terdaftar' },
                  { value: 'products_desc', label: 'Item Terbanyak' },
                  { value: 'activity_desc', label: 'Aktivitas Terakhir' },
                  { value: 'created_at_asc', label: 'Terlama Terdaftar' },
                  { value: 'title_asc', label: 'Nama Merchant (A - Z)' },
                  { value: 'title_desc', label: 'Nama Merchant (Z - A)' }
                ]}
                triggerStyle={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  borderColor: sortFilter !== 'created_at_desc' ? '#10b981' : isDark ? 'rgba(255,255,255,0.1)' : '#d1d5db'
                }}
                dropdownStyle={{ minWidth: '200px' }}
              />
            </>
          ) : (
            <>
              {/* Banned Filter 1: Kategori Sanksi */}
              <DesktopCustomSelect
                label="Kategori Sanksi"
                icon={<ShieldAlert size={14} />}
                value={violationTypeFilter}
                onChange={(val) => {
                  setViolationTypeFilter(val);
                  setPage(1);
                }}
                highlight={violationTypeFilter !== 'all'}
                options={[
                  { value: 'all', label: 'Semua Pelanggaran' },
                  { value: 'moderation', label: 'Moderasi Konten' },
                  { value: 'dormancy', label: 'Inaktif / Dormancy' },
                  { value: 'blacklisted', label: 'Blacklist Permanen' },
                  { value: 'suspended', label: 'Suspended Sementara' },
                  { value: 'purged', label: 'Dihapus Sistem' }
                ]}
                triggerStyle={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  borderColor: violationTypeFilter !== 'all' ? '#ef4444' : isDark ? 'rgba(255,255,255,0.1)' : '#d1d5db'
                }}
                dropdownStyle={{ minWidth: '210px' }}
              />

              {/* Banned Filter 2: Paket Terakhir */}
              <DesktopCustomSelect
                label="Paket Terakhir"
                icon={<Sparkles size={14} />}
                value={planFilter}
                onChange={(val) => {
                  setPlanFilter(val);
                  setPage(1);
                }}
                highlight={planFilter !== 'all'}
                options={[
                  { value: 'all', label: 'Semua Paket' },
                  { value: 'free', label: 'Gratis (Free)' },
                  { value: 'pro_starter', label: 'Pro Starter' },
                  { value: 'pro_business', label: 'Pro Business' }
                ]}
                triggerStyle={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  borderColor: planFilter !== 'all' ? '#ef4444' : isDark ? 'rgba(255,255,255,0.1)' : '#d1d5db'
                }}
                dropdownStyle={{ minWidth: '190px' }}
              />

              {/* Banned Filter 3: Masa Aktif */}
              <DesktopCustomSelect
                label="Masa Aktif"
                icon={<Clock size={14} />}
                value={planStatusFilter}
                onChange={(val) => {
                  setPlanStatusFilter(val);
                  setPage(1);
                }}
                highlight={planStatusFilter !== 'all'}
                options={[
                  { value: 'all', label: 'Semua Status' },
                  { value: 'active', label: 'Aktif Normal' },
                  { value: 'grace_period', label: 'Masa Tenggang' },
                  { value: 'expired', label: 'Kedaluwarsa' }
                ]}
                triggerStyle={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  borderColor: planStatusFilter !== 'all' ? '#ef4444' : isDark ? 'rgba(255,255,255,0.1)' : '#d1d5db'
                }}
                dropdownStyle={{ minWidth: '190px' }}
              />

              {/* Banned Filter 4: Riwayat Item */}
              <DesktopCustomSelect
                label="Riwayat Item"
                icon={<Package size={14} />}
                value={productFilter}
                onChange={(val) => {
                  setProductFilter(val);
                  setPage(1);
                }}
                highlight={productFilter !== 'all'}
                options={[
                  { value: 'all', label: 'Semua Item' },
                  { value: 'has_products', label: 'Memiliki Item (>0)' },
                  { value: 'no_products', label: 'Tanpa Item (0)' }
                ]}
                triggerStyle={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  borderColor: productFilter !== 'all' ? '#ef4444' : isDark ? 'rgba(255,255,255,0.1)' : '#d1d5db'
                }}
                dropdownStyle={{ minWidth: '190px' }}
              />

              {/* Banned Filter 5: Domain Sebelumnya */}
              <DesktopCustomSelect
                label="Domain Sebelumnya"
                icon={<Globe size={14} />}
                value={customDomainFilter}
                onChange={(val) => {
                  setCustomDomainFilter(val);
                  setPage(1);
                }}
                highlight={customDomainFilter !== 'all'}
                options={[
                  { value: 'all', label: 'Semua Domain' },
                  { value: 'with_domain', label: 'Custom Domain' },
                  { value: 'no_domain', label: 'Subdomain' }
                ]}
                triggerStyle={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  borderColor: customDomainFilter !== 'all' ? '#ef4444' : isDark ? 'rgba(255,255,255,0.1)' : '#d1d5db'
                }}
                dropdownStyle={{ minWidth: '200px' }}
              />

              {/* Banned Filter 6: Urutan Sanksi */}
              <DesktopCustomSelect
                label="Urutan Sanksi"
                icon={<ArrowUpDown size={14} />}
                value={sortFilter}
                onChange={(val) => {
                  setSortFilter(val);
                  setPage(1);
                }}
                highlight={sortFilter !== 'created_at_desc'}
                options={[
                  { value: 'created_at_desc', label: 'Terbaru Disanksi' },
                  { value: 'created_at_asc', label: 'Terlama Disanksi' },
                  { value: 'products_desc', label: 'Item Terbanyak' },
                  { value: 'title_asc', label: 'Nama Merchant (A - Z)' },
                  { value: 'title_desc', label: 'Nama Merchant (Z - A)' }
                ]}
                triggerStyle={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  borderColor: sortFilter !== 'created_at_desc' ? '#ef4444' : isDark ? 'rgba(255,255,255,0.1)' : '#d1d5db'
                }}
                dropdownStyle={{ minWidth: '200px' }}
              />
            </>
          )}
        </div>

        {/* Active Filter Chips Bar (Rule Parity with Mobile) */}
        {activeFilterCount > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
              paddingTop: '0.5rem',
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`
            }}
          >
            <button
              onClick={clearAllFilters}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.3rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <RotateCcw size={13} />
              Reset Semua ({activeFilterCount})
            </button>

            {planFilter !== 'all' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
                  color: isDark ? '#f3f4f6' : '#111827'
                }}
              >
                Paket: {planFilter === 'free' ? 'Gratis' : planFilter === 'pro_starter' ? 'Pro Starter' : 'Pro Business'}
                <button
                  type="button"
                  onClick={() => { setPlanFilter('all'); setPage(1); }}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={13} />
                </button>
              </span>
            )}

            {planStatusFilter !== 'all' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
                  color: isDark ? '#f3f4f6' : '#111827'
                }}
              >
                Masa Aktif: {planStatusFilter === 'active' ? 'Aktif Normal' : planStatusFilter === 'grace_period' ? 'Masa Tenggang' : 'Kedaluwarsa'}
                <button
                  type="button"
                  onClick={() => { setPlanStatusFilter('all'); setPage(1); }}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={13} />
                </button>
              </span>
            )}

            {dormancyLevelFilter !== 'all' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
                  color: isDark ? '#f3f4f6' : '#111827'
                }}
              >
                Kesehatan: {dormancyLevelFilter === 'active' ? 'Sehat' : dormancyLevelFilter === 'warning_1' ? 'Peringatan 1' : 'Peringatan 2'}
                <button
                  type="button"
                  onClick={() => { setDormancyLevelFilter('all'); setPage(1); }}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={13} />
                </button>
              </span>
            )}

            {productFilter !== 'all' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
                  color: isDark ? '#f3f4f6' : '#111827'
                }}
              >
                Item: {productFilter === 'has_products' ? 'Memiliki Item (>0)' : 'Tanpa Item (0)'}
                <button
                  type="button"
                  onClick={() => { setProductFilter('all'); setPage(1); }}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={13} />
                </button>
              </span>
            )}

            {customDomainFilter !== 'all' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
                  color: isDark ? '#f3f4f6' : '#111827'
                }}
              >
                Domain: {customDomainFilter === 'with_domain' ? 'Custom Domain' : 'Subdomain'}
                <button
                  type="button"
                  onClick={() => { setCustomDomainFilter('all'); setPage(1); }}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={13} />
                </button>
              </span>
            )}

            {violationTypeFilter !== 'all' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                  color: '#ef4444'
                }}
              >
                Sanksi: {violationTypeFilter === 'moderation' ? 'Moderasi Konten' : violationTypeFilter === 'dormancy' ? 'Dormancy' : violationTypeFilter === 'blacklisted' ? 'Blacklist Permanen' : violationTypeFilter === 'suspended' ? 'Suspended' : 'Dihapus'}
                <button
                  type="button"
                  onClick={() => { setViolationTypeFilter('all'); setPage(1); }}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={13} />
                </button>
              </span>
            )}

            {sortFilter !== 'created_at_desc' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
                  color: isDark ? '#f3f4f6' : '#111827'
                }}
              >
                Urut: {sortFilter === 'products_desc' ? 'Item Terbanyak' : sortFilter === 'title_asc' ? 'Nama Merchant A-Z' : sortFilter === 'title_desc' ? 'Nama Merchant Z-A' : sortFilter === 'activity_desc' ? 'Terakhir Aktif' : sortFilter === 'created_at_asc' ? 'Terlama' : 'Terbaru'}
                <button
                  type="button"
                  onClick={() => { setSortFilter('created_at_desc'); setPage(1); }}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={13} />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 4. Desktop Comprehensive Data Table with Sticky Columns & Elegant Scroll */}
      <div
        style={{
          borderRadius: '1rem',
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
          overflow: 'hidden',
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.03)'
        }}
      >
        {/* Horizontal Scroll Hint & Counter Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.65rem 1.25rem',
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
            fontSize: '0.78rem',
            color: isDark ? '#9ca3af' : '#64748b'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowRightLeft size={14} color="#10b981" />
            <span style={{ fontWeight: 600 }}>
              Geser tabel ke samping untuk melihat kolom kontak, kuota, aktivitas & status lengkap
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                display: 'inline-block'
              }}
            />
            <span>{stores.length} merchant dimuat</span>
          </div>
        </div>

        {/* Scroll Container with Custom Elegant Scrollbar */}
        <div
          className="catavor-table-scrollbar"
          style={{
            overflowX: 'auto',
            position: 'relative'
          }}
        >
          <table
            style={{
              width: '100%',
              minWidth: '1320px',
              borderCollapse: 'separate',
              borderSpacing: 0,
              textAlign: 'left',
              fontSize: '0.85rem'
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: isDark ? '#0d131f' : '#f8fafc'
                }}
              >
                {/* 1. Header: Profil Merchant (Sticky Left) */}
                <th
                  style={{
                    padding: '0.95rem 1.25rem',
                    fontWeight: 700,
                    color: isDark ? '#9ca3af' : '#475569',
                    fontSize: '0.78rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    position: 'sticky',
                    left: 0,
                    top: 0,
                    zIndex: 20,
                    backgroundColor: isDark ? '#0d131f' : '#f8fafc',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                    borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                    boxShadow: isDark ? '4px 0 10px rgba(0,0,0,0.3)' : '4px 0 10px rgba(0,0,0,0.05)',
                    width: '300px',
                    minWidth: '300px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Profil Merchant
                </th>

                {/* 2. Header: Pemilik & Kontak */}
                <th
                  style={{
                    padding: '0.95rem 1.25rem',
                    fontWeight: 700,
                    color: isDark ? '#9ca3af' : '#475569',
                    fontSize: '0.78rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                    width: '240px',
                    minWidth: '240px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Pemilik & Kontak
                </th>

                {/* 3. Header: Paket & Kuota */}
                <th
                  style={{
                    padding: '0.95rem 1.25rem',
                    fontWeight: 700,
                    color: isDark ? '#9ca3af' : '#475569',
                    fontSize: '0.78rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                    width: '200px',
                    minWidth: '200px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Paket & Kuota
                </th>

                {/* 4. Header: Item */}
                <th
                  style={{
                    padding: '0.95rem 1.25rem',
                    fontWeight: 700,
                    color: isDark ? '#9ca3af' : '#475569',
                    fontSize: '0.78rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    textAlign: 'center',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                    width: '130px',
                    minWidth: '130px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Item
                </th>

                {/* 5. Header: Terdaftar / Terakhir Aktif */}
                <th
                  style={{
                    padding: '0.95rem 1.25rem',
                    fontWeight: 700,
                    color: isDark ? '#9ca3af' : '#475569',
                    fontSize: '0.78rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                    width: '210px',
                    minWidth: '210px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Terdaftar / Terakhir Aktif
                </th>

                {/* 6. Header: Status */}
                <th
                  style={{
                    padding: '0.95rem 1.25rem',
                    fontWeight: 700,
                    color: isDark ? '#9ca3af' : '#475569',
                    fontSize: '0.78rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                    width: '190px',
                    minWidth: '190px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Status Kepatuhan
                </th>

                {/* 7. Header: Aksi (Sticky Right) */}
                <th
                  style={{
                    padding: '0.95rem 1.25rem',
                    fontWeight: 700,
                    color: isDark ? '#9ca3af' : '#475569',
                    fontSize: '0.78rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    textAlign: 'right',
                    position: 'sticky',
                    right: 0,
                    top: 0,
                    zIndex: 20,
                    backgroundColor: isDark ? '#0d131f' : '#f8fafc',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                    borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                    boxShadow: isDark ? '-4px 0 10px rgba(0,0,0,0.3)' : '-4px 0 10px rgba(0,0,0,0.05)',
                    width: '120px',
                    minWidth: '120px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '4rem 1rem', textAlign: 'center' }}>
                    <RefreshCw size={28} className="animate-spin" color="#10b981" style={{ margin: '0 auto 0.75rem auto' }} />
                    <div style={{ fontSize: '0.88rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
                      Memuat daftar profil merchant dari server...
                    </div>
                  </td>
                </tr>
              ) : stores.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '4rem 1rem', textAlign: 'center' }}>
                    <Store size={38} color={isDark ? 'rgba(255,255,255,0.2)' : '#d1d5db'} style={{ margin: '0 auto 0.75rem auto' }} />
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: isDark ? '#e5e7eb' : '#374151' }}>
                      Tidak Ada Profil Merchant
                    </div>
                    <div style={{ fontSize: '0.82rem', color: isDark ? '#9ca3af' : '#6b7280', marginTop: '0.25rem' }}>
                      {debouncedSearch
                        ? `Tidak ditemukan profil merchant yang cocok dengan kata kunci "${debouncedSearch}".`
                        : subTab === 'active'
                        ? 'Belum ada profil merchant aktif yang terdaftar.'
                        : 'Tidak ada merchant yang sedang ditangguhkan atau di-banned.'}
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
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}`,
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc';
                        const stickyCells = e.currentTarget.querySelectorAll('.sticky-merchant-cell');
                        stickyCells.forEach((c: any) => {
                          c.style.backgroundColor = isDark ? '#141d30' : '#f8fafc';
                        });
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        const stickyCells = e.currentTarget.querySelectorAll('.sticky-merchant-cell');
                        stickyCells.forEach((c: any) => {
                          c.style.backgroundColor = isDark ? '#0f172a' : '#ffffff';
                        });
                      }}
                    >
                      {/* 1. Profil Merchant (Sticky Left) */}
                      <td
                        className="sticky-merchant-cell"
                        style={{
                          padding: '1rem 1.25rem',
                          verticalAlign: 'middle',
                          position: 'sticky',
                          left: 0,
                          zIndex: 10,
                          backgroundColor: isDark ? '#0f172a' : '#ffffff',
                          borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}`,
                          boxShadow: isDark ? '4px 0 10px rgba(0,0,0,0.3)' : '4px 0 10px rgba(0,0,0,0.05)',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <div
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '0.75rem',
                              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
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
                              <Store size={22} color={isDark ? '#9ca3af' : '#6b7280'} />
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 700,
                                color: isDark ? '#f3f4f6' : '#0f172a',
                                fontSize: '0.92rem',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '210px'
                              }}
                              title={item.store_title}
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
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap'
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
                                  color: isDark ? '#9ca3af' : '#64748b',
                                  marginTop: '0.15rem',
                                  maxWidth: '210px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                                title={item.store_slogan}
                              >
                                {item.store_slogan}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Pemilik & Kontak */}
                      <td
                        style={{
                          padding: '1rem 1.25rem',
                          verticalAlign: 'middle',
                          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}`
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: isDark ? '#e5e7eb' : '#1e293b',
                              fontSize: '0.85rem',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {item.user_name || 'Tanpa Nama'}
                          </div>
                          <div
                            style={{
                              fontSize: '0.78rem',
                              color: isDark ? '#9ca3af' : '#64748b',
                              whiteSpace: 'nowrap'
                            }}
                          >
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
                                marginTop: '0.1rem',
                                fontWeight: 600,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <Phone size={12} />
                              +{item.whatsapp_number}
                            </a>
                          )}
                        </div>
                      </td>

                      {/* 3. Paket & Kuota */}
                      <td
                        style={{
                          padding: '1rem 1.25rem',
                          verticalAlign: 'middle',
                          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}`
                        }}
                      >
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
                                whiteSpace: 'nowrap',
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
                                    : '#f1f5f9',
                                color:
                                  item.plan === 'pro_business'
                                    ? '#a855f7'
                                    : item.plan === 'pro_starter'
                                    ? '#3b82f6'
                                    : isDark
                                    ? '#9ca3af'
                                    : '#64748b'
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
                                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
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
                                color: isDark ? '#9ca3af' : '#64748b',
                                marginTop: '0.2rem',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {formatBytes(item.storage_used_bytes)} / {formatBytes(quotaBytes)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 4. Item */}
                      <td
                        style={{
                          padding: '1rem 1.25rem',
                          verticalAlign: 'middle',
                          textAlign: 'center',
                          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}`
                        }}
                      >
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '0.55rem',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            color: isDark ? '#e5e7eb' : '#1e293b',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Package size={14} color="#10b981" />
                          {item.products_count || 0} Item
                        </div>
                      </td>

                      {/* 5. Terdaftar / Terakhir Aktif */}
                      <td
                        style={{
                          padding: '1rem 1.25rem',
                          verticalAlign: 'middle',
                          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}`
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                          <div
                            style={{
                              fontSize: '0.8rem',
                              color: isDark ? '#e5e7eb' : '#1e293b',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontWeight: 500
                            }}
                          >
                            <Calendar size={13} color={isDark ? '#9ca3af' : '#64748b'} />
                            {formatDate(item.created_at)}
                          </div>
                          <div
                            style={{
                              fontSize: '0.74rem',
                              color: isDark ? '#9ca3af' : '#64748b',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                          >
                            <Clock size={12} />
                            Aktif: {item.last_activity_at ? formatDate(item.last_activity_at) : 'Baru'}
                          </div>
                        </div>
                      </td>

                      {/* 6. Status */}
                      <td
                        style={{
                          padding: '1rem 1.25rem',
                          verticalAlign: 'middle',
                          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}`
                        }}
                      >
                        {subTab === 'active' ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.3rem 0.7rem',
                              borderRadius: '0.5rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}
                          >
                            <CheckCircle2 size={13} />
                            Aktif & Terdaftar
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.3rem 0.7rem',
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
                                title={item.suspension_reason}
                              >
                                {item.suspension_reason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 7. Aksi (Sticky Right) */}
                      <td
                        className="sticky-merchant-cell"
                        style={{
                          padding: '1rem 1.25rem',
                          verticalAlign: 'middle',
                          textAlign: 'right',
                          position: 'sticky',
                          right: 0,
                          zIndex: 10,
                          backgroundColor: isDark ? '#0f172a' : '#ffffff',
                          borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}`,
                          boxShadow: isDark ? '-4px 0 10px rgba(0,0,0,0.3)' : '-4px 0 10px rgba(0,0,0,0.05)',
                          transition: 'background-color 0.15s ease',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <button
                          onClick={() => fetchStoreDetail(item.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.5rem 0.95rem',
                            borderRadius: '0.6rem',
                            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            color: '#10b981',
                            fontSize: '0.82rem',
                            fontWeight: 700,
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '0.82rem', color: isDark ? '#9ca3af' : '#6b7280', whiteSpace: 'nowrap' }}>
                Tampilkan:
              </span>
              <DesktopCustomSelect
                value={String(limit)}
                onChange={(val) => {
                  setLimit(parseInt(val, 10));
                  setPage(1);
                }}
                options={[
                  { value: '10', label: '10' },
                  { value: '25', label: '25' },
                  { value: '50', label: '50' },
                  { value: '100', label: '100' }
                ]}
                direction="up"
                style={{ width: '80px', minWidth: '80px' }}
                triggerStyle={{
                  height: '34px',
                  padding: '0 0.55rem',
                  fontSize: '0.82rem',
                  backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'
                }}
                dropdownStyle={{ minWidth: '85px' }}
              />
              <span style={{ fontSize: '0.82rem', color: isDark ? '#9ca3af' : '#6b7280', whiteSpace: 'nowrap' }}>
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

      {/* 6. Centered Modal Inspeksi Detail Merchant (Rule 7.A: Centered Modal on Desktop) */}
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
                    Inspeksi Profil Merchant
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
                    Memuat data detail merchant...
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
                        {/* Box 1: Data Pemilik Merchant */}
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
                            Data Pemilik Merchant
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
                              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Total Item: </span>
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
                            Sampel Item Terdaftar ({storeDetail.top_products.length})
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
                  Gagal memuat detail merchant.
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
                  Buka Katalog Merchant
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
