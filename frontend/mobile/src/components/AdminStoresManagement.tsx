import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  HardDrive,
  SlidersHorizontal,
  Check,
  RotateCcw,
  Filter
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

  // Server-Side Filters
  const [planFilter, setPlanFilter] = useState('all');
  const [planStatusFilter, setPlanStatusFilter] = useState('all');
  const [dormancyLevelFilter, setDormancyLevelFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [customDomainFilter, setCustomDomainFilter] = useState('all');
  const [violationTypeFilter, setViolationTypeFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('created_at_desc');

  // Filter Bottom Sheet state
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

  useModalBackHandler({
    isOpen: isFilterSheetOpen,
    onClose: () => {
      setIsFilterSheetOpen(false);
    }
  });

  // Drag-to-dismiss gesture state for Filter Bottom Sheet
  const [filterSheetDragY, setFilterSheetDragY] = useState(0);
  const [isFilterSheetDragging, setIsFilterSheetDragging] = useState(false);
  const filterTouchStartY = useRef(0);

  const handleFilterDragStart = (clientY: number) => {
    filterTouchStartY.current = clientY;
    setIsFilterSheetDragging(true);
  };

  const handleFilterDragMove = (clientY: number) => {
    if (!isFilterSheetDragging) return;
    const delta = clientY - filterTouchStartY.current;
    if (delta > 0) {
      setFilterSheetDragY(delta);
    } else {
      setFilterSheetDragY(delta * 0.15);
    }
  };

  const handleFilterDragEnd = () => {
    if (!isFilterSheetDragging) return;
    setIsFilterSheetDragging(false);
    if (filterSheetDragY > 70) {
      setIsFilterSheetOpen(false);
    }
    setFilterSheetDragY(0);
  };

  // Drag-to-dismiss gesture state for Detail Bottom Sheet
  const [detailSheetDragY, setDetailSheetDragY] = useState(0);
  const [isDetailSheetDragging, setIsDetailSheetDragging] = useState(false);
  const detailTouchStartY = useRef(0);

  const handleDetailDragStart = (clientY: number) => {
    detailTouchStartY.current = clientY;
    setIsDetailSheetDragging(true);
  };

  const handleDetailDragMove = (clientY: number) => {
    if (!isDetailSheetDragging) return;
    const delta = clientY - detailTouchStartY.current;
    if (delta > 0) {
      setDetailSheetDragY(delta);
    } else {
      setDetailSheetDragY(delta * 0.15);
    }
  };

  const handleDetailDragEnd = () => {
    if (!isDetailSheetDragging) return;
    setIsDetailSheetDragging(false);
    if (detailSheetDragY > 70) {
      setSelectedStoreID(null);
      setStoreDetail(null);
    }
    setDetailSheetDragY(0);
  };

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

      {/* 4. Filter Action Bar & Detail Trigger */}
      <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center' }}>
        <button
          type="button"
          onClick={openFilterSheet}
          style={{
            flex: 1,
            minHeight: '44px',
            padding: '0 0.95rem',
            borderRadius: '0.65rem',
            border: activeFilterCount > 0
              ? `1.5px solid ${subTab === 'active' ? '#10b981' : '#ef4444'}`
              : `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
            backgroundColor: activeFilterCount > 0
              ? (subTab === 'active'
                  ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.08)')
                  : (isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)'))
              : (isDark ? 'rgba(0,0,0,0.25)' : '#ffffff'),
            color: activeFilterCount > 0
              ? (subTab === 'active' ? '#10b981' : '#ef4444')
              : (isDark ? '#f3f4f6' : '#111827'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <SlidersHorizontal size={17} />
            <span>
              {subTab === 'active' ? 'Filter Detail Katalog' : 'Filter Detail Pelanggaran'}
            </span>
          </div>
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

        <button
          type="button"
          onClick={fetchStores}
          disabled={loading}
          style={{
            minWidth: '44px',
            minHeight: '44px',
            borderRadius: '0.65rem',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
            backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
            color: isDark ? '#e5e7eb' : '#374151',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: loading ? 'not-allowed' : 'pointer',
            flexShrink: 0
          }}
          aria-label="Segarkan data"
        >
          <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 4.B Active Filter Chips Row (If filters are active) */}
      {activeFilterCount > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={clearAllFilters}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.3rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <RotateCcw size={12} />
            Reset Semua
          </button>

          {planFilter !== 'all' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.3rem 0.6rem',
                borderRadius: '9999px',
                fontSize: '0.72rem',
                fontWeight: 600,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
                color: isDark ? '#f3f4f6' : '#111827',
                flexShrink: 0
              }}
            >
              Paket: {planFilter}
              <button
                type="button"
                onClick={() => { setPlanFilter('all'); setPage(1); }}
                style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', display: 'flex' }}
              >
                <X size={12} />
              </button>
            </span>
          )}

          {planStatusFilter !== 'all' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.3rem 0.6rem',
                borderRadius: '9999px',
                fontSize: '0.72rem',
                fontWeight: 600,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
                color: isDark ? '#f3f4f6' : '#111827',
                flexShrink: 0
              }}
            >
              Status: {planStatusFilter}
              <button
                type="button"
                onClick={() => { setPlanStatusFilter('all'); setPage(1); }}
                style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', display: 'flex' }}
              >
                <X size={12} />
              </button>
            </span>
          )}

          {dormancyLevelFilter !== 'all' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.3rem 0.6rem',
                borderRadius: '9999px',
                fontSize: '0.72rem',
                fontWeight: 600,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
                color: isDark ? '#f3f4f6' : '#111827',
                flexShrink: 0
              }}
            >
              Dormancy: {dormancyLevelFilter}
              <button
                type="button"
                onClick={() => { setDormancyLevelFilter('all'); setPage(1); }}
                style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', display: 'flex' }}
              >
                <X size={12} />
              </button>
            </span>
          )}

          {productFilter !== 'all' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.3rem 0.6rem',
                borderRadius: '9999px',
                fontSize: '0.72rem',
                fontWeight: 600,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
                color: isDark ? '#f3f4f6' : '#111827',
                flexShrink: 0
              }}
            >
              {productFilter === 'has_products' ? 'Ada Produk' : 'Tanpa Produk'}
              <button
                type="button"
                onClick={() => { setProductFilter('all'); setPage(1); }}
                style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', display: 'flex' }}
              >
                <X size={12} />
              </button>
            </span>
          )}

          {customDomainFilter !== 'all' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.3rem 0.6rem',
                borderRadius: '9999px',
                fontSize: '0.72rem',
                fontWeight: 600,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
                color: isDark ? '#f3f4f6' : '#111827',
                flexShrink: 0
              }}
            >
              {customDomainFilter === 'with_domain' ? 'Custom Domain' : 'Subdomain'}
              <button
                type="button"
                onClick={() => { setCustomDomainFilter('all'); setPage(1); }}
                style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', display: 'flex' }}
              >
                <X size={12} />
              </button>
            </span>
          )}

          {violationTypeFilter !== 'all' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.3rem 0.6rem',
                borderRadius: '9999px',
                fontSize: '0.72rem',
                fontWeight: 600,
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                color: '#ef4444',
                flexShrink: 0
              }}
            >
              Sanksi: {violationTypeFilter}
              <button
                type="button"
                onClick={() => { setViolationTypeFilter('all'); setPage(1); }}
                style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', display: 'flex' }}
              >
                <X size={12} />
              </button>
            </span>
          )}

          {sortFilter !== 'created_at_desc' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.3rem 0.6rem',
                borderRadius: '9999px',
                fontSize: '0.72rem',
                fontWeight: 600,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
                color: isDark ? '#f3f4f6' : '#111827',
                flexShrink: 0
              }}
            >
              Urut: {sortFilter === 'products_desc' ? 'Produk Terbanyak' : sortFilter === 'title_asc' ? 'Nama A-Z' : sortFilter === 'title_desc' ? 'Nama Z-A' : sortFilter === 'activity_desc' ? 'Terakhir Aktif' : 'Terlama'}
              <button
                type="button"
                onClick={() => { setSortFilter('created_at_desc'); setPage(1); }}
                style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', display: 'flex' }}
              >
                <X size={12} />
              </button>
            </span>
          )}
        </div>
      )}

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

      {/* 7. Mobile Filter Detail Bottom Sheet (Rule 7.A.3 & Rule 2) */}
      {isFilterSheetOpen && (
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
          onClick={() => setIsFilterSheetOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxHeight: '88vh',
              borderTopLeftRadius: '1.25rem',
              borderTopRightRadius: '1.25rem',
              backgroundColor: isDark ? '#18181b' : '#ffffff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}`,
              borderBottom: 'none',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transform: `translateY(${Math.max(0, filterSheetDragY)}px)`,
              transition: isFilterSheetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Drag Handle Bar (Touch & Mouse Drag-Down to Dismiss) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '0.75rem 0 0.35rem 0',
                cursor: 'grab',
                touchAction: 'none'
              }}
              onTouchStart={(e) => handleFilterDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleFilterDragMove(e.touches[0].clientY)}
              onTouchEnd={handleFilterDragEnd}
              onMouseDown={(e) => handleFilterDragStart(e.clientY)}
              onMouseMove={(e) => handleFilterDragMove(e.clientY)}
              onMouseUp={handleFilterDragEnd}
            >
              <div
                style={{
                  width: '44px',
                  height: '5px',
                  borderRadius: '3px',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : '#cbd5e1'
                }}
              />
            </div>

            {/* Clean Header (Standard Mobile: No X button, dismiss via drag handle, backdrop, or footer actions) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.65rem 1.25rem 0.85rem 1.25rem',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
                cursor: 'grab',
                touchAction: 'none'
              }}
              onTouchStart={(e) => handleFilterDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleFilterDragMove(e.touches[0].clientY)}
              onTouchEnd={handleFilterDragEnd}
              onMouseDown={(e) => handleFilterDragStart(e.clientY)}
              onMouseMove={(e) => handleFilterDragMove(e.clientY)}
              onMouseUp={handleFilterDragEnd}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <SlidersHorizontal size={20} color={subTab === 'active' ? '#10b981' : '#ef4444'} style={{ flexShrink: 0 }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: isDark ? '#f3f4f6' : '#111827' }}>
                    {subTab === 'active' ? 'Filter Detail Profil Aktif' : 'Filter Detail Pelanggaran & Sanksi'}
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
                    Kriteria pencarian terinci berbasis atribut database
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable Filter Content */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.15rem'
              }}
            >
              {/* SECTION: URUTKAN */}
              <div>
                <span
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    color: isDark ? '#9ca3af' : '#4b5563',
                    display: 'block',
                    marginBottom: '0.5rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}
                >
                  Urutkan Berdasarkan
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.45rem' }}>
                  {(subTab === 'active'
                    ? [
                        { key: 'created_at_desc', label: 'Terbaru Terdaftar' },
                        { key: 'products_desc', label: 'Produk Terbanyak' },
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
                          padding: '0.5rem 0.65rem',
                          borderRadius: '0.65rem',
                          fontSize: '0.78rem',
                          fontWeight: isSelected ? 800 : 500,
                          minHeight: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          textAlign: 'left',
                          border: isSelected
                            ? `1.5px solid ${subTab === 'active' ? '#10b981' : '#ef4444'}`
                            : `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}`,
                          backgroundColor: isSelected
                            ? (subTab === 'active'
                                ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.08)')
                                : (isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)'))
                            : (isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb'),
                          color: isSelected
                            ? (subTab === 'active' ? '#10b981' : '#ef4444')
                            : (isDark ? '#e5e7eb' : '#374151'),
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
                        {isSelected && <Check size={14} strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* KHUSUS TAB AKTIF */}
              {subTab === 'active' ? (
                <>
                  {/* SECTION: PAKET LANGGANAN */}
                  <div>
                    <span
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        color: isDark ? '#9ca3af' : '#4b5563',
                        display: 'block',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Paket Langganan
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.45rem' }}>
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
                              padding: '0.5rem 0.65rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.78rem',
                              fontWeight: isSelected ? 800 : 500,
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: isSelected
                                ? '1.5px solid #10b981'
                                : `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}`,
                              backgroundColor: isSelected
                                ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.08)')
                                : (isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb'),
                              color: isSelected ? '#10b981' : (isDark ? '#e5e7eb' : '#374151'),
                              cursor: 'pointer'
                            }}
                          >
                            <span>{opt.label}</span>
                            {isSelected && <Check size={14} strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* SECTION: STATUS MASA AKTIF PAKET */}
                  <div>
                    <span
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        color: isDark ? '#9ca3af' : '#4b5563',
                        display: 'block',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Status Masa Aktif Akun (Plan Status)
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.45rem' }}>
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
                              padding: '0.5rem 0.65rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.78rem',
                              fontWeight: isSelected ? 800 : 500,
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: isSelected
                                ? '1.5px solid #10b981'
                                : `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}`,
                              backgroundColor: isSelected
                                ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.08)')
                                : (isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb'),
                              color: isSelected ? '#10b981' : (isDark ? '#e5e7eb' : '#374151'),
                              cursor: 'pointer'
                            }}
                          >
                            <span>{opt.label}</span>
                            {isSelected && <Check size={14} strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* SECTION: TINGKAT DORMANCY / KESEHATAN */}
                  <div>
                    <span
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        color: isDark ? '#9ca3af' : '#4b5563',
                        display: 'block',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Kesehatan Toko (Dormancy)
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.45rem' }}>
                      {[
                        { key: 'all', label: 'Semua Tingkat' },
                        { key: 'active', label: 'Sehat & Aktif' },
                        { key: 'warning_1', label: 'Peringatan 1 (30 Hari Inaktif)' },
                        { key: 'warning_2', label: 'Peringatan 2 (60 Hari Inaktif)' }
                      ].map((opt) => {
                        const isSelected = tempDormancyLevel === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setTempDormancyLevel(opt.key)}
                            style={{
                              padding: '0.5rem 0.65rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.78rem',
                              fontWeight: isSelected ? 800 : 500,
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: isSelected
                                ? '1.5px solid #10b981'
                                : `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}`,
                              backgroundColor: isSelected
                                ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.08)')
                                : (isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb'),
                              color: isSelected ? '#10b981' : (isDark ? '#e5e7eb' : '#374151'),
                              cursor: 'pointer'
                            }}
                          >
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
                            {isSelected && <Check size={14} strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* SECTION: KETERSEDIAAN PRODUK */}
                  <div>
                    <span
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        color: isDark ? '#9ca3af' : '#4b5563',
                        display: 'block',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Ketersediaan Produk
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem' }}>
                      {[
                        { key: 'all', label: 'Semua' },
                        { key: 'has_products', label: 'Ada Produk (>0)' },
                        { key: 'no_products', label: 'Belum Ada (0)' }
                      ].map((opt) => {
                        const isSelected = tempProductFilter === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setTempProductFilter(opt.key)}
                            style={{
                              padding: '0.5rem 0.5rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.76rem',
                              fontWeight: isSelected ? 800 : 500,
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              border: isSelected
                                ? '1.5px solid #10b981'
                                : `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}`,
                              backgroundColor: isSelected
                                ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.08)')
                                : (isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb'),
                              color: isSelected ? '#10b981' : (isDark ? '#e5e7eb' : '#374151'),
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
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        color: isDark ? '#9ca3af' : '#4b5563',
                        display: 'block',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Penggunaan Domain
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem' }}>
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
                              padding: '0.5rem 0.5rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.76rem',
                              fontWeight: isSelected ? 800 : 500,
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              border: isSelected
                                ? '1.5px solid #10b981'
                                : `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}`,
                              backgroundColor: isSelected
                                ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.08)')
                                : (isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb'),
                              color: isSelected ? '#10b981' : (isDark ? '#e5e7eb' : '#374151'),
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
                  {/* SECTION: JENIS PELANGGARAN / SANKSI */}
                  <div>
                    <span
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        color: isDark ? '#9ca3af' : '#4b5563',
                        display: 'block',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Jenis &amp; Kategori Pelanggaran
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.45rem' }}>
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
                              padding: '0.5rem 0.65rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.78rem',
                              fontWeight: isSelected ? 800 : 500,
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: isSelected
                                ? '1.5px solid #ef4444'
                                : `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}`,
                              backgroundColor: isSelected
                                ? (isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)')
                                : (isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb'),
                              color: isSelected ? '#ef4444' : (isDark ? '#e5e7eb' : '#374151'),
                              cursor: 'pointer'
                            }}
                          >
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
                            {isSelected && <Check size={14} strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* SECTION: PAKET SEBELUM SANKSI */}
                  <div>
                    <span
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        color: isDark ? '#9ca3af' : '#4b5563',
                        display: 'block',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Paket Akun Sebelum Disanksi
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.45rem' }}>
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
                              padding: '0.5rem 0.65rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.78rem',
                              fontWeight: isSelected ? 800 : 500,
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: isSelected
                                ? '1.5px solid #ef4444'
                                : `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}`,
                              backgroundColor: isSelected
                                ? (isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)')
                                : (isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb'),
                              color: isSelected ? '#ef4444' : (isDark ? '#e5e7eb' : '#374151'),
                              cursor: 'pointer'
                            }}
                          >
                            <span>{opt.label}</span>
                            {isSelected && <Check size={14} strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Sticky Sheet Action Footer */}
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                padding: '0.85rem 1.25rem',
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
                backgroundColor: isDark ? '#18181b' : '#ffffff'
              }}
            >
              <button
                type="button"
                onClick={resetTempFilters}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  borderRadius: '0.65rem',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#d1d5db'}`,
                  backgroundColor: 'transparent',
                  color: isDark ? '#e5e7eb' : '#374151',
                  fontWeight: 700,
                  fontSize: '0.82rem',
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
                  fontSize: '0.85rem',
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

      {/* 8. Mobile Bottom Sheet Detail Inspector (Rule 7.A.3 & Rule 2) */}
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
              overflow: 'hidden',
              transform: `translateY(${Math.max(0, detailSheetDragY)}px)`,
              transition: isDetailSheetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Drag Handle Bar (Touch & Mouse Drag-Down to Dismiss) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '0.75rem 0 0.35rem 0',
                cursor: 'grab',
                touchAction: 'none'
              }}
              onTouchStart={(e) => handleDetailDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleDetailDragMove(e.touches[0].clientY)}
              onTouchEnd={handleDetailDragEnd}
              onMouseDown={(e) => handleDetailDragStart(e.clientY)}
              onMouseMove={(e) => handleDetailDragMove(e.clientY)}
              onMouseUp={handleDetailDragEnd}
            >
              <div
                style={{
                  width: '44px',
                  height: '5px',
                  borderRadius: '3px',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : '#cbd5e1'
                }}
              />
            </div>

            {/* Clean Header (Standard Mobile: No X button, dismiss via drag handle, backdrop, back button, or footer close button) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.65rem 1.25rem 0.85rem 1.25rem',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
                cursor: 'grab',
                touchAction: 'none'
              }}
              onTouchStart={(e) => handleDetailDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleDetailDragMove(e.touches[0].clientY)}
              onTouchEnd={handleDetailDragEnd}
              onMouseDown={(e) => handleDetailDragStart(e.clientY)}
              onMouseMove={(e) => handleDetailDragMove(e.clientY)}
              onMouseUp={handleDetailDragEnd}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Store size={20} color="#10b981" style={{ flexShrink: 0 }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: isDark ? '#f3f4f6' : '#111827' }}>
                    Detail Profil Katalog
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
                    Informasi terpusat status dan kepemilikan
                  </div>
                </div>
              </div>
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
