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
  HardDrive,
  RotateCcw,
  SlidersHorizontal,
  Check,
  Globe,
  ArrowRightLeft,
  LayoutGrid,
  List
} from 'lucide-react';
import { TabletSegmentedPagination } from './TabletSegmentedPagination';
import { TabletCustomSelect, type TabletSelectOption } from './TabletCustomSelect';
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
  onLogout?: () => void;
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

const STORE_PLAN_OPTIONS: TabletSelectOption[] = [
  { value: 'all', label: 'Semua Paket' },
  { value: 'free', label: 'Paket Gratis', description: 'Fitur standar katalog merchant' },
  { value: 'pro_starter', label: 'Pro Starter', badge: 'Starter', description: 'Paket bertumbuh' },
  { value: 'pro_business', label: 'Pro Business', badge: 'Business', description: 'Paket kapasitas penuh & domain' },
];

const STORE_VIOLATION_OPTIONS: TabletSelectOption[] = [
  { value: 'all', label: 'Semua Sanksi' },
  { value: 'moderation', label: 'Moderasi Konten', description: 'Pelanggaran pedoman listing' },
  { value: 'dormancy', label: 'Inaktif / Dormancy', description: 'Merchant lama tidak aktif' },
  { value: 'blacklisted', label: 'Blacklist Permanen', description: 'Sanksi keras pelanggaran berat' },
  { value: 'suspended', label: 'Suspended Sementara', description: 'Penangguhan akses profil' },
  { value: 'purged', label: 'Dihapus Sistem', description: 'Data telah dibersihkan' },
];

const STORE_PRODUCT_OPTIONS: TabletSelectOption[] = [
  { value: 'all', label: 'Semua Item' },
  { value: 'has_products', label: 'Ada Item (>0)', description: 'Merchant sudah upload item' },
  { value: 'no_products', label: 'Belum Ada Item (0)', description: 'Merchant belum memiliki item' },
];

const STORE_SORT_ACTIVE_OPTIONS: TabletSelectOption[] = [
  { value: 'created_at_desc', label: 'Terbaru Terdaftar' },
  { value: 'products_desc', label: 'Item Terbanyak' },
  { value: 'activity_desc', label: 'Aktivitas Terakhir' },
  { value: 'created_at_asc', label: 'Terlama Terdaftar' },
  { value: 'title_asc', label: 'Nama (A - Z)' },
  { value: 'title_desc', label: 'Nama (Z - A)' },
];

const STORE_SORT_BANNED_OPTIONS: TabletSelectOption[] = [
  { value: 'created_at_desc', label: 'Terbaru Disanksi' },
  { value: 'created_at_asc', label: 'Terlama Disanksi' },
  { value: 'products_desc', label: 'Item Terbanyak' },
  { value: 'title_asc', label: 'Nama (A - Z)' },
  { value: 'title_desc', label: 'Nama (Z - A)' },
];

export const TabletPlatformStoresView: React.FC<TabletPlatformStoresViewProps> = ({
  token,
  hideHeader = true,
  onLogout
}) => {
  // Sub-tab: strictly separated Active Profiles vs Banned/Suspended Profiles
  const [subTab, setSubTab] = useState<'active' | 'banned'>('active');

  // View mode: Table List (default) vs Card Grid (Tablet Native)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

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

  // Filter Side Sheet state (Tablet Native)
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [tempPlan, setTempPlan] = useState('all');
  const [tempPlanStatus, setTempPlanStatus] = useState('all');
  const [tempDormancyLevel, setTempDormancyLevel] = useState('all');
  const [tempProductFilter, setTempProductFilter] = useState('all');
  const [tempCustomDomain, setTempCustomDomain] = useState('all');
  const [tempViolationType, setTempViolationType] = useState('all');
  const [tempSort, setTempSort] = useState('created_at_desc');

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

  useModalBackHandler({
    isOpen: isFilterSheetOpen,
    onClose: () => {
      setIsFilterSheetOpen(false);
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

      if (res.status === 401 || res.status === 403) {
        onLogout?.();
        return;
      }

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

  // Listen to platform-wide refresh trigger from Top Header
  useEffect(() => {
    const handleRefresh = () => {
      fetchStores();
    };
    window.addEventListener('catavor:refresh-stores', handleRefresh);
    return () => {
      window.removeEventListener('catavor:refresh-stores', handleRefresh);
    };
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
      if (res.status === 401 || res.status === 403) {
        onLogout?.();
        return;
      }
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
    setPlanFilter('all');
    setPlanStatusFilter('all');
    setDormancyLevelFilter('all');
    setProductFilter('all');
    setCustomDomainFilter('all');
    setViolationTypeFilter('all');
    setSortFilter('created_at_desc');
  };

  const openFilterSheet = () => {
    setTempPlan(planFilter);
    setTempPlanStatus(planStatusFilter);
    setTempDormancyLevel(dormancyLevelFilter);
    setTempProductFilter(productFilter);
    setTempCustomDomain(customDomainFilter);
    setTempViolationType(violationTypeFilter);
    setTempSort(sortFilter);
    setIsFilterSheetOpen(true);
  };

  const applyFilters = () => {
    setPlanFilter(tempPlan);
    setPlanStatusFilter(tempPlanStatus);
    setDormancyLevelFilter(tempDormancyLevel);
    setProductFilter(tempProductFilter);
    setCustomDomainFilter(tempCustomDomain);
    setViolationTypeFilter(tempViolationType);
    setSortFilter(tempSort);
    setPage(1);
    setIsFilterSheetOpen(false);
  };

  const resetTempFilters = () => {
    setTempPlan('all');
    setTempPlanStatus('all');
    setTempDormancyLevel('all');
    setTempProductFilter('all');
    setTempCustomDomain('all');
    setTempViolationType('all');
    setTempSort('created_at_desc');
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
                Direktori Profil Merchant
              </h2>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Daftar profil merchant terdaftar dan tata kelola akun kepatuhan.
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
        {/* Segmented Sub-Tabs & View Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem' }}>
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
              Profil Merchant Aktif ({stats.total_active})
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

          {/* View Mode Toggle: Table List vs Card Grid */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '0.65rem',
              padding: '3px'
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Tampilan Tabel Data"
              style={{
                minHeight: '44px',
                padding: '0 0.85rem',
                borderRadius: '0.5rem',
                border: 'none',
                backgroundColor: viewMode === 'table' ? (subTab === 'active' ? '#10b981' : '#ef4444') : 'transparent',
                color: viewMode === 'table' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <List size={16} />
              <span>Tabel</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Tampilan Kartu Grid"
              style={{
                minHeight: '44px',
                padding: '0 0.85rem',
                borderRadius: '0.5rem',
                border: 'none',
                backgroundColor: viewMode === 'grid' ? (subTab === 'active' ? '#10b981' : '#ef4444') : 'transparent',
                color: viewMode === 'grid' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <LayoutGrid size={16} />
              <span>Kartu</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {/* Top Line: Search Bar + Filter Detail Trigger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                flex: 1,
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
                placeholder="Cari nama merchant, slug, pemilik, WhatsApp..."
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
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Filter Detail Trigger Button */}
            <button
              type="button"
              onClick={openFilterSheet}
              style={{
                minHeight: '44px',
                padding: '0 1rem',
                borderRadius: '0.65rem',
                border: activeFilterCount > 0
                  ? `1px solid ${subTab === 'active' ? '#10b981' : '#ef4444'}`
                  : '1px solid var(--border-light)',
                backgroundColor: activeFilterCount > 0
                  ? (subTab === 'active' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)')
                  : 'var(--bg-card)',
                color: activeFilterCount > 0
                  ? (subTab === 'active' ? '#10b981' : '#ef4444')
                  : 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
            >
              <SlidersHorizontal size={16} />
              <span>Filter Detail</span>
              {activeFilterCount > 0 && (
                <span
                  style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    backgroundColor: subTab === 'active' ? '#10b981' : '#ef4444',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    fontWeight: 800
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Bottom Line: Quick Filter Dropdowns Side-by-Side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
            {subTab === 'active' ? (
              <TabletCustomSelect
                value={planFilter}
                onChange={(val) => {
                  setPlanFilter(val);
                  setPage(1);
                }}
                options={STORE_PLAN_OPTIONS}
                variant="filter"
                highlight={planFilter !== 'all'}
                highlightColor="#10b981"
                highlightBg="rgba(16, 185, 129, 0.10)"
                triggerStyle={{
                  minHeight: '44px',
                  width: 'auto',
                  minWidth: '135px'
                }}
                menuWidth={230}
                ariaLabel="Filter Paket Merchant"
              />
            ) : (
              <TabletCustomSelect
                value={violationTypeFilter}
                onChange={(val) => {
                  setViolationTypeFilter(val);
                  setPage(1);
                }}
                options={STORE_VIOLATION_OPTIONS}
                variant="filter"
                highlight={violationTypeFilter !== 'all'}
                highlightColor="#ef4444"
                highlightBg="rgba(239, 68, 68, 0.10)"
                triggerStyle={{
                  minHeight: '44px',
                  width: 'auto',
                  minWidth: '145px'
                }}
                menuWidth={250}
                ariaLabel="Filter Kategori Sanksi"
              />
            )}

            <TabletCustomSelect
              value={productFilter}
              onChange={(val) => {
                setProductFilter(val);
                setPage(1);
              }}
              options={STORE_PRODUCT_OPTIONS}
              variant="filter"
              highlight={productFilter !== 'all'}
              highlightColor={subTab === 'active' ? '#10b981' : '#ef4444'}
              highlightBg={subTab === 'active' ? 'rgba(16, 185, 129, 0.10)' : 'rgba(239, 68, 68, 0.10)'}
              triggerStyle={{
                minHeight: '44px',
                width: 'auto',
                minWidth: '128px'
              }}
              menuWidth={200}
              ariaLabel="Filter Status Item Merchant"
            />

            <TabletCustomSelect
              value={sortFilter}
              onChange={(val) => {
                setSortFilter(val);
                setPage(1);
              }}
              options={subTab === 'active' ? STORE_SORT_ACTIVE_OPTIONS : STORE_SORT_BANNED_OPTIONS}
              variant="filter"
              highlight={sortFilter !== 'created_at_desc'}
              highlightColor={subTab === 'active' ? '#10b981' : '#ef4444'}
              highlightBg={subTab === 'active' ? 'rgba(16, 185, 129, 0.10)' : 'rgba(239, 68, 68, 0.10)'}
              triggerStyle={{
                minHeight: '44px',
                width: 'auto',
                minWidth: '155px'
              }}
              menuWidth={220}
              ariaLabel="Urutkan Profil Merchant"
            />

            {/* Reset Filter Button (Only when filters active) */}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                title="Atur ulang seluruh filter"
                style={{
                  minHeight: '44px',
                  padding: '0 0.85rem',
                  borderRadius: '0.65rem',
                  border: `1px solid ${subTab === 'active' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                  backgroundColor: subTab === 'active' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  color: subTab === 'active' ? '#10b981' : '#ef4444',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
              >
                <RotateCcw size={14} />
                <span>Reset</span>
                <span
                  style={{
                    padding: '0.1rem 0.45rem',
                    borderRadius: '999px',
                    backgroundColor: subTab === 'active' ? '#10b981' : '#ef4444',
                    color: '#ffffff',
                    fontSize: '0.7rem',
                    fontWeight: 800
                  }}
                >
                  {activeFilterCount}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Chips Row (Rule Parity with Mobile & Desktop) */}
        {activeFilterCount > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
              paddingTop: '0.25rem'
            }}
          >
            <button
              onClick={clearAllFilters}
              style={{
                minHeight: '44px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.78rem',
                fontWeight: 700,
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={13} />
              Reset Semua ({activeFilterCount})
            </button>

            {planFilter !== 'all' && (
              <span
                style={{
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)'
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
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)'
                }}
              >
                Status: {planStatusFilter === 'active' ? 'Aktif Normal' : planStatusFilter === 'grace_period' ? 'Masa Tenggang' : 'Kedaluwarsa'}
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
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)'
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
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)'
                }}
              >
                Item: {productFilter === 'has_products' ? 'Ada Item (>0)' : 'Belum Ada Item (0)'}
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
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)'
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
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
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
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)'
                }}
              >
                Urut: {sortFilter === 'products_desc' ? 'Item Terbanyak' : sortFilter === 'title_asc' ? 'Nama A-Z' : sortFilter === 'title_desc' ? 'Nama Z-A' : sortFilter === 'activity_desc' ? 'Terakhir Aktif' : 'Terlama'}
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

      {/* 3. Tablet Content Area: Table List View vs Touch Card Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
        {loading ? (
          <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
            <RefreshCw size={32} className="animate-spin" color="#10b981" style={{ margin: '0 auto 1rem auto' }} />
            <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
              Memuat profil merchant...
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
              Tidak Ada Profil Merchant
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
              {debouncedSearch
                ? `Tidak ditemukan profil yang sesuai dengan "${debouncedSearch}".`
                : subTab === 'active'
                ? 'Belum ada profil merchant aktif yang terdaftar.'
                : 'Tidak ada profil merchant yang sedang ditangguhkan.'}
            </p>
          </div>
        ) : viewMode === 'table' ? (
          /* TABLE LIST VIEW (TABLET NATIVE WITH HORIZONTAL SCROLL) */
          <div>
            {/* Scroll Hint Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 1rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                marginBottom: '0.85rem',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowRightLeft size={14} color={subTab === 'active' ? '#10b981' : '#ef4444'} />
                <span>
                  Geser tabel ke samping untuk melihat kolom kontak, kuota, aktivitas & status lengkap
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {pagination.total} merchant
              </span>
            </div>

            {/* Scrollable Container with Custom Elegant Scrollbar */}
            <div
              className="catavor-table-scrollbar"
              style={{
                width: '100%',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                borderRadius: '0.85rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-card)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
              }}
            >
              <table
                style={{
                  width: '100%',
                  minWidth: '1240px',
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  textAlign: 'left',
                  fontSize: '0.85rem'
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-deep)' }}>
                    {/* Sticky Left Header: Profil Merchant */}
                    <th
                      style={{
                        padding: '0.95rem 1.25rem',
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        position: 'sticky',
                        left: 0,
                        top: 0,
                        zIndex: 20,
                        backgroundColor: 'var(--bg-deep)',
                        borderBottom: '1px solid var(--border-light)',
                        borderRight: '1px solid var(--border-light)',
                        boxShadow: '4px 0 10px rgba(0,0,0,0.06)',
                        width: '280px',
                        minWidth: '280px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Profil Merchant
                    </th>

                    {/* Pemilik & Kontak */}
                    <th
                      style={{
                        padding: '0.95rem 1.25rem',
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        borderBottom: '1px solid var(--border-light)',
                        width: '230px',
                        minWidth: '230px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Pemilik & Kontak
                    </th>

                    {/* Paket & Kuota */}
                    <th
                      style={{
                        padding: '0.95rem 1.25rem',
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        borderBottom: '1px solid var(--border-light)',
                        width: '190px',
                        minWidth: '190px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Paket & Kuota
                    </th>

                    {/* Item */}
                    <th
                      style={{
                        padding: '0.95rem 1.25rem',
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid var(--border-light)',
                        width: '120px',
                        minWidth: '120px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Item
                    </th>

                    {/* Terdaftar / Terakhir Aktif */}
                    <th
                      style={{
                        padding: '0.95rem 1.25rem',
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        borderBottom: '1px solid var(--border-light)',
                        width: '200px',
                        minWidth: '200px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Terdaftar / Terakhir Aktif
                    </th>

                    {/* Status Kepatuhan */}
                    <th
                      style={{
                        padding: '0.95rem 1.25rem',
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        borderBottom: '1px solid var(--border-light)',
                        width: '190px',
                        minWidth: '190px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Status Kepatuhan
                    </th>

                    {/* Sticky Right Header: Aksi */}
                    <th
                      style={{
                        padding: '0.95rem 1.25rem',
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        textAlign: 'right',
                        position: 'sticky',
                        right: 0,
                        top: 0,
                        zIndex: 20,
                        backgroundColor: 'var(--bg-deep)',
                        borderBottom: '1px solid var(--border-light)',
                        borderLeft: '1px solid var(--border-light)',
                        boxShadow: '-4px 0 10px rgba(0,0,0,0.06)',
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
                  {stores.map((item) => {
                    const quotaBytes = getStorageQuota(item.plan);
                    const storagePercent = Math.min(
                      100,
                      Math.round(((item.storage_used_bytes || 0) / quotaBytes) * 100)
                    );

                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid var(--border-light)',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        {/* 1. Profil Merchant (Sticky Left) */}
                        <td
                          style={{
                            padding: '1rem 1.25rem',
                            verticalAlign: 'middle',
                            position: 'sticky',
                            left: 0,
                            zIndex: 10,
                            backgroundColor: 'var(--bg-card)',
                            borderRight: '1px solid var(--border-light)',
                            borderBottom: '1px solid var(--border-light)',
                            boxShadow: '4px 0 10px rgba(0,0,0,0.05)',
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                            <div
                              style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '0.75rem',
                                backgroundColor: 'var(--bg-deep)',
                                border: '1px solid var(--border-light)',
                                display: 'flex',
                                alignItems: 'center',
                                justifySelf: 'center',
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
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: 700,
                                  color: 'var(--text-primary)',
                                  fontSize: '0.92rem',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '200px'
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
                                    whiteSpace: 'nowrap',
                                    minHeight: '44px',
                                    minWidth: '44px'
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
                                    color: 'var(--text-muted)',
                                    marginTop: '0.15rem',
                                    maxWidth: '200px',
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
                            borderBottom: '1px solid var(--border-light)'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div
                              style={{
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {item.user_name || 'Tanpa Nama'}
                            </div>
                            <div
                              style={{
                                fontSize: '0.78rem',
                                color: 'var(--text-muted)',
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
                                  fontSize: '0.78rem',
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
                            borderBottom: '1px solid var(--border-light)'
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
                                      ? 'rgba(168, 85, 247, 0.15)'
                                      : item.plan === 'pro_starter'
                                      ? 'rgba(59, 130, 246, 0.15)'
                                      : 'var(--bg-deep)',
                                  color:
                                    item.plan === 'pro_business'
                                      ? '#a855f7'
                                      : item.plan === 'pro_starter'
                                      ? '#3b82f6'
                                      : 'var(--text-muted)'
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
                                  backgroundColor: 'var(--bg-deep)',
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
                                  color: 'var(--text-muted)',
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
                            borderBottom: '1px solid var(--border-light)'
                          }}
                        >
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '0.55rem',
                              backgroundColor: 'var(--bg-deep)',
                              fontWeight: 700,
                              fontSize: '0.82rem',
                              color: 'var(--text-primary)',
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
                            borderBottom: '1px solid var(--border-light)'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                            <div
                              style={{
                                fontSize: '0.8rem',
                                color: 'var(--text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontWeight: 500
                              }}
                            >
                              <Calendar size={13} color="var(--text-muted)" />
                              {formatDate(item.created_at)}
                            </div>
                            <div
                              style={{
                                fontSize: '0.74rem',
                                color: 'var(--text-muted)',
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

                        {/* 6. Status Kepatuhan */}
                        <td
                          style={{
                            padding: '1rem 1.25rem',
                            verticalAlign: 'middle',
                            borderBottom: '1px solid var(--border-light)'
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
                                backgroundColor: 'rgba(16, 185, 129, 0.12)',
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
                                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
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
                                    color: '#ef4444',
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
                          style={{
                            padding: '1rem 1.25rem',
                            verticalAlign: 'middle',
                            textAlign: 'right',
                            position: 'sticky',
                            right: 0,
                            zIndex: 10,
                            backgroundColor: 'var(--bg-card)',
                            borderLeft: '1px solid var(--border-light)',
                            borderBottom: '1px solid var(--border-light)',
                            boxShadow: '-4px 0 10px rgba(0,0,0,0.05)',
                            transition: 'background-color 0.15s ease',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <button
                            onClick={() => fetchStoreDetail(item.id)}
                            style={{
                              minHeight: '44px',
                              minWidth: '44px',
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
                            <Eye size={16} />
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* TOUCH CARD GRID VIEW (ALTERNATIVE VIEW) */
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
                                  : 'var(--bg-deep)',
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
                              fontWeight: 600,
                              minHeight: '44px',
                              minWidth: '44px'
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
                          {item.products_count} Item
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
                        minHeight: '44px',
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

      {/* 4.5 Tablet Filter Side Sheet (Rule 7.A: Side Sheet on Tablet, Rule 2: Modal Back Interceptor) */}
      {isFilterSheetOpen && (
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
          onClick={() => setIsFilterSheetOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
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
                <SlidersHorizontal size={20} color={subTab === 'active' ? '#10b981' : '#ef4444'} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {subTab === 'active' ? 'Filter Detail Katalog' : 'Filter Detail Pelanggaran'}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Pilih kriteria penyaringan data merchant terdaftar
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsFilterSheetOpen(false)}
                style={{
                  minWidth: '44px',
                  minHeight: '44px',
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

            {/* Sheet Body with Options */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem'
              }}
            >
              {/* SECTION: URUTKAN BERDASARKAN */}
              <div>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: '0.5rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}
                >
                  Urutkan Berdasarkan
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {(subTab === 'active'
                    ? [
                        { key: 'created_at_desc', label: 'Terbaru Terdaftar' },
                        { key: 'products_desc', label: 'Item Terbanyak' },
                        { key: 'activity_desc', label: 'Terakhir Aktif' },
                        { key: 'created_at_asc', label: 'Terlama Terdaftar' },
                        { key: 'title_asc', label: 'Nama (A - Z)' },
                        { key: 'title_desc', label: 'Nama (Z - A)' }
                      ]
                    : [
                        { key: 'created_at_desc', label: 'Terbaru Disanksi' },
                        { key: 'created_at_asc', label: 'Terlama Disanksi' },
                        { key: 'title_asc', label: 'Nama (A - Z)' },
                        { key: 'title_desc', label: 'Nama (Z - A)' }
                      ]
                  ).map((opt) => {
                    const isSelected = tempSort === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setTempSort(opt.key)}
                        style={{
                          padding: '0.55rem 0.75rem',
                          borderRadius: '0.65rem',
                          fontSize: '0.82rem',
                          fontWeight: isSelected ? 800 : 500,
                          minHeight: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          textAlign: 'left',
                          border: isSelected
                            ? `1.5px solid ${subTab === 'active' ? '#10b981' : '#ef4444'}`
                            : '1px solid var(--border-light)',
                          backgroundColor: isSelected
                            ? (subTab === 'active' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)')
                            : 'var(--bg-deep)',
                          color: isSelected
                            ? (subTab === 'active' ? '#10b981' : '#ef4444')
                            : 'var(--text-primary)',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
                        {isSelected && <Check size={15} strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {subTab === 'active' ? (
                <>
                  {/* SECTION: PAKET LANGGANAN */}
                  <div>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Paket Langganan
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      {[
                        { key: 'all', label: 'Semua Paket' },
                        { key: 'free', label: 'Gratis (Free)' },
                        { key: 'pro_starter', label: 'Pro Starter' },
                        { key: 'pro_business', label: 'Pro Business' }
                      ].map((opt) => {
                        const isSelected = tempPlan === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setTempPlan(opt.key)}
                            style={{
                              padding: '0.55rem 0.75rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.82rem',
                              fontWeight: isSelected ? 800 : 500,
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: isSelected ? '1.5px solid #10b981' : '1px solid var(--border-light)',
                              backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-deep)',
                              color: isSelected ? '#10b981' : 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                          >
                            <span>{opt.label}</span>
                            {isSelected && <Check size={15} strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* SECTION: STATUS MASA AKTIF PAKET */}
                  <div>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Status Masa Aktif Akun (Plan Status)
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      {[
                        { key: 'all', label: 'Semua Status' },
                        { key: 'active', label: 'Aktif Normal' },
                        { key: 'grace_period', label: 'Masa Tenggang' },
                        { key: 'expired', label: 'Kedaluwarsa' }
                      ].map((opt) => {
                        const isSelected = tempPlanStatus === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setTempPlanStatus(opt.key)}
                            style={{
                              padding: '0.55rem 0.75rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.82rem',
                              fontWeight: isSelected ? 800 : 500,
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: isSelected ? '1.5px solid #10b981' : '1px solid var(--border-light)',
                              backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-deep)',
                              color: isSelected ? '#10b981' : 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                          >
                            <span>{opt.label}</span>
                            {isSelected && <Check size={15} strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* SECTION: TINGKAT DORMANCY */}
                  <div>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Kesehatan Merchant (Dormancy)
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      {[
                        { key: 'all', label: 'Semua Tingkat' },
                        { key: 'active', label: 'Sehat & Aktif' },
                        { key: 'warning_1', label: 'Peringatan 1 (30 Hari)' },
                        { key: 'warning_2', label: 'Peringatan 2 (60 Hari)' }
                      ].map((opt) => {
                        const isSelected = tempDormancyLevel === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setTempDormancyLevel(opt.key)}
                            style={{
                              padding: '0.55rem 0.75rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.82rem',
                              fontWeight: isSelected ? 800 : 500,
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: isSelected ? '1.5px solid #10b981' : '1px solid var(--border-light)',
                              backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-deep)',
                              color: isSelected ? '#10b981' : 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                          >
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
                            {isSelected && <Check size={15} strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* SECTION: KETERSEDIAAN ITEM */}
                  <div>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Ketersediaan Item
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                      {[
                        { key: 'all', label: 'Semua' },
                        { key: 'has_products', label: 'Ada Item (>0)' },
                        { key: 'no_products', label: 'Belum Ada (0)' }
                      ].map((opt) => {
                        const isSelected = tempProductFilter === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setTempProductFilter(opt.key)}
                            style={{
                              padding: '0.55rem 0.5rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.8rem',
                              fontWeight: isSelected ? 800 : 500,
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              border: isSelected ? '1.5px solid #10b981' : '1px solid var(--border-light)',
                              backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-deep)',
                              color: isSelected ? '#10b981' : 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                          >
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* SECTION: CUSTOM DOMAIN */}
                  <div>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Penggunaan Domain
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                      {[
                        { key: 'all', label: 'Semua' },
                        { key: 'with_domain', label: 'Custom Domain' },
                        { key: 'no_domain', label: 'Subdomain' }
                      ].map((opt) => {
                        const isSelected = tempCustomDomain === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setTempCustomDomain(opt.key)}
                            style={{
                              padding: '0.55rem 0.5rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.8rem',
                              fontWeight: isSelected ? 800 : 500,
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              border: isSelected ? '1.5px solid #10b981' : '1px solid var(--border-light)',
                              backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-deep)',
                              color: isSelected ? '#10b981' : 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                          >
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* KHUSUS TAB PELANGGARAN & BANNED */}
                  <div>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Jenis & Kategori Pelanggaran
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      {[
                        { key: 'all', label: 'Semua Pelanggaran' },
                        { key: 'moderation', label: 'Moderasi Konten' },
                        { key: 'dormancy', label: 'Inaktif / Dormancy' },
                        { key: 'blacklisted', label: 'Blacklist Permanen' },
                        { key: 'suspended', label: 'Suspended Sementara' },
                        { key: 'purged', label: 'Dihapus Sistem' }
                      ].map((opt) => {
                        const isSelected = tempViolationType === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setTempViolationType(opt.key)}
                            style={{
                              padding: '0.55rem 0.75rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.82rem',
                              fontWeight: isSelected ? 800 : 500,
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: isSelected ? '1.5px solid #ef4444' : '1px solid var(--border-light)',
                              backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-deep)',
                              color: isSelected ? '#ef4444' : 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                          >
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
                            {isSelected && <Check size={15} strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Paket Akun Terakhir
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      {[
                        { key: 'all', label: 'Semua Paket' },
                        { key: 'free', label: 'Gratis (Free)' },
                        { key: 'pro_starter', label: 'Pro Starter' },
                        { key: 'pro_business', label: 'Pro Business' }
                      ].map((opt) => {
                        const isSelected = tempPlan === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setTempPlan(opt.key)}
                            style={{
                              padding: '0.55rem 0.75rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.82rem',
                              fontWeight: isSelected ? 800 : 500,
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: isSelected ? '1.5px solid #ef4444' : '1px solid var(--border-light)',
                              backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-deep)',
                              color: isSelected ? '#ef4444' : 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                          >
                            <span>{opt.label}</span>
                            {isSelected && <Check size={15} strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* BANNED: STATUS MASA AKTIF TERAKHIR */}
                  <div>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Masa Aktif Akun Terakhir
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      {[
                        { key: 'all', label: 'Semua Status' },
                        { key: 'active', label: 'Aktif Normal' },
                        { key: 'grace_period', label: 'Masa Tenggang' },
                        { key: 'expired', label: 'Kedaluwarsa' }
                      ].map((opt) => {
                        const isSelected = tempPlanStatus === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setTempPlanStatus(opt.key)}
                            style={{
                              padding: '0.55rem 0.75rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.82rem',
                              fontWeight: isSelected ? 800 : 500,
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: isSelected ? '1.5px solid #ef4444' : '1px solid var(--border-light)',
                              backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-deep)',
                              color: isSelected ? '#ef4444' : 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                          >
                            <span>{opt.label}</span>
                            {isSelected && <Check size={15} strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* BANNED: RIWAYAT KATALOG ITEM */}
                  <div>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Riwayat Item Katalog
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                      {[
                        { key: 'all', label: 'Semua' },
                        { key: 'has_products', label: 'Ada Item (>0)' },
                        { key: 'no_products', label: 'Belum Ada (0)' }
                      ].map((opt) => {
                        const isSelected = tempProductFilter === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setTempProductFilter(opt.key)}
                            style={{
                              padding: '0.55rem 0.5rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.8rem',
                              fontWeight: isSelected ? 800 : 500,
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              border: isSelected ? '1.5px solid #ef4444' : '1px solid var(--border-light)',
                              backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-deep)',
                              color: isSelected ? '#ef4444' : 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                          >
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* BANNED: DOMAIN SEBELUMNYA */}
                  <div>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Domain Sebelumnya
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                      {[
                        { key: 'all', label: 'Semua' },
                        { key: 'with_domain', label: 'Custom Domain' },
                        { key: 'no_domain', label: 'Subdomain' }
                      ].map((opt) => {
                        const isSelected = tempCustomDomain === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setTempCustomDomain(opt.key)}
                            style={{
                              padding: '0.55rem 0.5rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.8rem',
                              fontWeight: isSelected ? 800 : 500,
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              border: isSelected ? '1.5px solid #ef4444' : '1px solid var(--border-light)',
                              backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-deep)',
                              color: isSelected ? '#ef4444' : 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                          >
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Sticky Sheet Footer */}
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-card)',
                flexShrink: 0
              }}
            >
              <button
                type="button"
                onClick={resetTempFilters}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  borderRadius: '0.65rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-deep)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer'
                }}
              >
                <RotateCcw size={15} />
                Reset
              </button>
              <button
                type="button"
                onClick={applyFilters}
                style={{
                  flex: 2,
                  minHeight: '44px',
                  borderRadius: '0.65rem',
                  border: 'none',
                  backgroundColor: subTab === 'active' ? '#10b981' : '#ef4444',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  boxShadow: subTab === 'active'
                    ? '0 4px 14px rgba(16, 185, 129, 0.35)'
                    : '0 4px 14px rgba(239, 68, 68, 0.35)'
                }}
              >
                <Check size={16} strokeWidth={3} />
                Terapkan Filter
              </button>
            </div>
          </div>
        </div>
      )}

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
                  minWidth: '44px',
                  minHeight: '44px',
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
                              fontWeight: 600,
                              minHeight: '44px',
                              minWidth: '44px'
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
                        <div>Total Item: <strong style={{ color: '#10b981' }}>{storeDetail.products_count} Item</strong></div>
                        <div>Total Kategori: <strong>{storeDetail.categories_count}</strong></div>
                        <div>Storage Digunakan: <strong>{formatBytes(s.storage_used_bytes)}</strong></div>
                        <div>Terdaftar: {formatDate(s.created_at)}</div>
                      </div>

                      {/* Top Products */}
                      {storeDetail.top_products && storeDetail.top_products.length > 0 && (
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                            Item Teratas ({storeDetail.top_products.length})
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
                  Gagal memuat detail merchant.
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
