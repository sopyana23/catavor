import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Eye,
  MessageCircle,
  Calendar,
  ArrowUpRight,
  Search,
  RefreshCw,
  Layers,
  HelpCircle,
  CheckCircle,
  ExternalLink,
  ShoppingBag,
  Flame,
  Zap,
  Target,
  Shield,
  Briefcase,
  Download,
  UtensilsCrossed,
  Home,
  Heart,
  ShieldCheck,
  Video,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  Activity,
  SlidersHorizontal,
  Sparkles,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Check,
  X,
  PackageSearch,
  ArrowUpDown,
  Globe
} from 'lucide-react';
import { MarketIntelligenceModal } from './MarketIntelligenceModal';

export interface AnalyticsTrendPoint {
  date: string;
  store_views: number;
  wa_clicks?: number;
  direct_wa_clicks?: number;
  marketplace_clicks?: number;
  rekber_clicks?: number;
  video_views?: number;
  total_actions?: number;
}

export interface AnalyticsProductSummary {
  id: number;
  name: string;
  image_url?: string;
  price: number;
  class?: string;
  view_count: number;
  wa_clicks_count: number;
  marketplace_clicks_count?: number;
  rekber_clicks_count?: number;
  video_views_count?: number;
  total_actions_count?: number;
  conversion_rate_percent?: number;
  product_type?: string;
}

export interface ProductTypeMetricSummary {
  product_type: string;
  type_name: string;
  item_count: number;
  views: number;
  direct_wa_clicks: number;
  marketplace_clicks: number;
  rekber_clicks: number;
  video_views: number;
  total_actions: number;
  conversion_rate_percent: number;
}

export interface CategoryMetricSummary {
  category: string;
  views: number;
  total_actions?: number;
  wa_clicks?: number;
  items: number;
}

export interface SmartInsight {
  type: 'success' | 'tip' | 'warning';
  title: string;
  description: string;
}

export interface DetailedAnalyticsData {
  period: '7d' | '30d' | '90d';
  days: number;
  total_store_views: number;
  total_product_views: number;
  total_wa_clicks: number;
  total_direct_wa?: number;
  total_marketplace_clicks?: number;
  total_rekber_clicks?: number;
  total_video_views?: number;
  total_actions?: number;
  conversion_rate_percent: number;
  peak_date?: string;
  peak_views?: number;
  trends: AnalyticsTrendPoint[];
  top_products: AnalyticsProductSummary[];
  categories?: CategoryMetricSummary[];
  product_types?: ProductTypeMetricSummary[];
  channels?: {
    direct_wa: number;
    marketplace: number;
    rekber: number;
    video: number;
  };
  insights?: SmartInsight[];
  bot_defense_active?: boolean;
}

interface AnalyticsPageProps {
  analyticsData: DetailedAnalyticsData | null;
  loading: boolean;
  period: '7d' | '30d' | '90d';
  onPeriodChange: (period: '7d' | '30d' | '90d') => void;
  onRefresh: () => void;
  storeSlug?: string;
  storeTitle?: string;
  isMobile?: boolean;
  onBackToMenu?: () => void;
  onViewProduct?: (productId: number) => void;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  analyticsData,
  loading,
  period,
  onPeriodChange,
  onRefresh,
  storeSlug,
  storeTitle,
  isMobile = false,
  onBackToMenu,
  onViewProduct
}) => {
  const [productSearch, setProductSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedProductType, setSelectedProductType] = useState<string>('all');
  const [productSort, setProductSort] = useState<'views' | 'actions' | 'ctr' | 'price_desc' | 'price_asc'>('views');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState<boolean>(false);
  const sortDropdownRef = useRef<HTMLDivElement | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [serverProducts, setServerProducts] = useState<AnalyticsProductSummary[] | null>(null);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [serverTotalPages, setServerTotalPages] = useState<number>(1);
  const [serverTypeCounts, setServerTypeCounts] = useState<Record<string, number> | null>(null);
  const [productsLoading, setProductsLoading] = useState<boolean>(false);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [metricFocus, setMetricFocus] = useState<'all' | 'views' | 'actions'>('all');
  const [scaleMode, setScaleMode] = useState<'linear' | 'adaptive'>('linear');
  const [showMarketIntel, setShowMarketIntel] = useState<boolean>(false);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(productSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setIsSortDropdownOpen(false);
      }
    };
    if (isSortDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSortDropdownOpen]);

  // Reset page to 1 when filters or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProductType, debouncedSearch, productSort, pageSize]);

  // Server-side paginated products fetch
  useEffect(() => {
    let isMounted = true;
    const fetchServerProducts = async () => {
      try {
        setProductsLoading(true);
        const token = localStorage.getItem('catavor_token');
        const params = new URLSearchParams({
          page: currentPage.toString(),
          per_page: pageSize.toString(),
          search: debouncedSearch,
          product_type: selectedProductType,
          sort: productSort
        });
        const res = await fetch(`http://localhost:8000/api/admin/analytics/products?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error('Failed to fetch analytics products');
        const json = await res.json();
        if (isMounted && json.success && json.data) {
          setServerProducts(json.data.products || []);
          setServerTotal(json.data.total ?? 0);
          setServerTotalPages(json.data.total_pages ?? 1);
          if (json.data.type_counts) {
            setServerTypeCounts(json.data.type_counts);
          }
        }
      } catch (err) {
        console.warn('Server-side analytics pagination fallback to local:', err);
      } finally {
        if (isMounted) setProductsLoading(false);
      }
    };

    fetchServerProducts();
    return () => {
      isMounted = false;
    };
  }, [debouncedSearch, selectedProductType, productSort, currentPage, pageSize, analyticsData]);

  useEffect(() => {
    if (!analyticsData && !loading) {
      onRefresh();
    }
  }, [analyticsData, loading, onRefresh]);

  const formatPrice = (num?: number) => {
    if (!num && num !== 0) return 'Rp 0';
    return 'Rp ' + Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const formatShortDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);

        const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

        const today = new Date();
        if (
          d.getDate() === today.getDate() &&
          d.getMonth() === today.getMonth() &&
          d.getFullYear() === today.getFullYear()
        ) {
          return 'Hari Ini';
        }

        const dayName = dayNames[d.getDay()] || '';
        const monthName = monthNames[month] || '';
        return `${dayName}, ${day} ${monthName}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const formatDetailedDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);

        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        const today = new Date();
        const isToday =
          d.getDate() === today.getDate() &&
          d.getMonth() === today.getMonth() &&
          d.getFullYear() === today.getFullYear();

        const dayName = dayNames[d.getDay()] || '';
        const monthName = monthNames[month] || '';
        return `${dayName}, ${day} ${monthName} ${year}${isToday ? ' (Hari Ini)' : ''}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const daysCount = period === '90d' ? 90 : period === '30d' ? 30 : 7;
  const storeViews = analyticsData?.total_store_views ?? 0;
  const productViews = analyticsData?.total_product_views ?? 0;
  const directWa = analyticsData?.total_direct_wa ?? analyticsData?.total_wa_clicks ?? 0;
  const marketplaceClicks = analyticsData?.total_marketplace_clicks ?? 0;
  const rekberClicks = analyticsData?.total_rekber_clicks ?? 0;
  const videoViews = analyticsData?.total_video_views ?? 0;
  const totalActions = analyticsData?.total_actions ?? (directWa + marketplaceClicks + rekberClicks + videoViews);
  const conversionRate = analyticsData?.conversion_rate_percent ?? 0;

  // Format compact number for large numbers (1.2k, 15k, 1.5M)
  const formatCompactNumber = (num: number): string => {
    if (num === 0) return '0';
    if (num < 1000) return num.toString();
    if (num < 1000000) {
      const k = num / 1000;
      return k % 1 === 0 ? `${k}k` : `${k.toFixed(1).replace(/\.0$/, '')}k`;
    }
    const m = num / 1000000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1).replace(/\.0$/, '')}M`;
  };

  const avgViewsPerDay = (storeViews / daysCount).toFixed(1);
  const avgActionsPerDay = (totalActions / daysCount).toFixed(1);
  const viewsPerVisitor = storeViews > 0 ? (productViews / storeViews).toFixed(1) : '0';

  // Trends calculation
  const trends = analyticsData?.trends || [];

  // Smart Outlier & Disparity Detection across trend periods
  const { isDisparityHigh, peakDay, peakRatio, peakIndex, maxValViews, maxValActions } = useMemo(() => {
    if (!trends.length) {
      return { isDisparityHigh: false, peakDay: null, peakRatio: 1, peakIndex: -1, maxValViews: 0, maxValActions: 0 };
    }
    
    let maxV = 0;
    let maxA = 0;
    let peakIdx = 0;
    let sumV = 0;
    let nonZeroViews: number[] = [];

    trends.forEach((t, idx) => {
      const v = t.store_views || 0;
      const a = t.total_actions ?? t.wa_clicks ?? 0;
      sumV += v;
      if (v > 0) nonZeroViews.push(v);
      if (v > maxV) {
        maxV = v;
        peakIdx = idx;
      }
      if (a > maxA) {
        maxA = a;
      }
    });

    const avgV = trends.length ? sumV / trends.length : 0;
    const ratio = avgV > 0 ? maxV / avgV : 1;
    const minNonZero = nonZeroViews.length ? Math.min(...nonZeroViews) : 0;
    
    // Detect high disparity: peak is > 3x average and max >= 15, or massive disparity between high and low days
    const isHigh = maxV >= 15 && (ratio >= 3 || (minNonZero > 0 && maxV / minNonZero >= 15));

    return {
      isDisparityHigh: isHigh,
      peakDay: trends[peakIdx] || null,
      peakRatio: ratio,
      peakIndex: peakIdx,
      maxValViews: maxV,
      maxValActions: maxA
    };
  }, [trends]);
  
  // Calculate dynamic max scale with clean step & nice numbers algorithm for extreme spikes / disparities
  const chartMaxVal = useMemo(() => {
    if (!trends.length) return 4;
    let maxVal = 0;
    if (metricFocus === 'views') {
      maxVal = maxValViews;
    } else if (metricFocus === 'actions') {
      maxVal = maxValActions;
    } else {
      maxVal = Math.max(maxValViews, maxValActions);
    }

    if (maxVal <= 0) return 4;
    if (maxVal <= 2) return 4;
    if (maxVal <= 4) return 6;
    if (maxVal <= 8) return 10;
    if (maxVal <= 15) return 20;
    if (maxVal <= 30) return 40;
    if (maxVal <= 60) return 80;
    if (maxVal <= 100) return 120;

    // Nice numbers step for large spikes (Wilkinson / Heckbert)
    const exponent = Math.floor(Math.log10(maxVal));
    const fraction = maxVal / Math.pow(10, exponent);
    let niceFraction: number;
    if (fraction <= 1.2) niceFraction = 1.5;
    else if (fraction <= 2) niceFraction = 2.5;
    else if (fraction <= 3) niceFraction = 4;
    else if (fraction <= 5) niceFraction = 6;
    else if (fraction <= 8) niceFraction = 10;
    else niceFraction = 12;

    return Math.ceil(niceFraction * Math.pow(10, exponent));
  }, [trends, metricFocus, maxValViews, maxValActions]);

  // Normalized value to height ratio [0, 1] with soft-log adaptive scaling support for extreme disparities
  const getNormalizedRatio = (val: number): number => {
    if (!val || val <= 0 || chartMaxVal <= 0) return 0;
    const clamped = Math.min(chartMaxVal, Math.max(0, val));
    
    if (scaleMode === 'adaptive' && chartMaxVal > 10) {
      // Bi-symmetric pseudo-log: log10(1 + 9 * (clamped / chartMaxVal))
      return Math.log10(1 + 9 * (clamped / chartMaxVal));
    }
    
    return clamped / chartMaxVal;
  };

  // Y-Axis reference grid ticks with clean integer levels
  const yGridTicks = useMemo(() => {
    if (chartMaxVal === 4) return [0, 2, 4];
    if (chartMaxVal === 6) return [0, 3, 6];
    if (chartMaxVal <= 10) return [0, 5, 10];
    const half = Math.round(chartMaxVal / 2);
    return [
      0,
      half,
      chartMaxVal
    ];
  }, [chartMaxVal]);

  // Point coordinates for SVG Area / Line chart (720x150) with strict boundary clamping & min elevation for small values
  const { viewsPoints, actionsPoints } = useMemo(() => {
    const vPts: { x: number; y: number; val: number }[] = [];
    const aPts: { x: number; y: number; val: number }[] = [];
    const N = trends.length;
    if (N === 0) return { viewsPoints: vPts, actionsPoints: aPts };

    const padLeft = 32;
    const innerW = 668;
    const padTop = 12;
    const innerH = 100;
    const bottomY = padTop + innerH;
    const minElevation = 4; // Guaranteed visible clearance above baseline for any non-zero point

    trends.forEach((t, i) => {
      const x = N === 1 ? padLeft + innerW / 2 : padLeft + (i / (N - 1)) * innerW;
      
      const vVal = t.store_views || 0;
      const vRatio = getNormalizedRatio(vVal);
      const vY = vVal <= 0 
        ? bottomY 
        : Math.max(padTop, bottomY - minElevation - (vRatio * (innerH - minElevation)));

      const aVal = t.total_actions ?? t.wa_clicks ?? 0;
      const aRatio = getNormalizedRatio(aVal);
      const aY = aVal <= 0 
        ? bottomY 
        : Math.max(padTop, bottomY - minElevation - (aRatio * (innerH - minElevation)));

      vPts.push({ x, y: vY, val: vVal });
      aPts.push({ x, y: aY, val: aVal });
    });

    return { viewsPoints: vPts, actionsPoints: aPts };
  }, [trends, chartMaxVal, scaleMode]);

  // Monotone Cubic Spline Path Generator (Fritsch-Carlson) - strictly avoids overshoot/undershoot on extreme data disparities
  const getBezierPath = (points: { x: number; y: number }[]): string => {
    const n = points.length;
    if (n === 0) return '';
    if (n === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    if (n === 2) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;

    // 1. Calculate secant slopes (delta)
    const deltas: number[] = [];
    const dxs: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      dxs.push(dx);
      deltas.push(dx === 0 ? 0 : dy / dx);
    }

    // 2. Calculate initial tangent slopes (m)
    const m: number[] = new Array(n).fill(0);
    m[0] = deltas[0];
    m[n - 1] = deltas[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (deltas[i - 1] * deltas[i] <= 0) {
        m[i] = 0; // Local extremum (peak/valley): tangent is 0 to prevent overshoot
      } else {
        m[i] = (deltas[i - 1] + deltas[i]) / 2;
      }
    }

    // 3. Fritsch-Carlson monotonicity check & correction
    for (let i = 0; i < n - 1; i++) {
      if (deltas[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
      } else {
        const alpha = m[i] / deltas[i];
        const beta = m[i + 1] / deltas[i];
        const dist = alpha * alpha + beta * beta;
        if (dist > 9) {
          const tau = 3 / Math.sqrt(dist);
          m[i] = tau * alpha * deltas[i];
          m[i + 1] = tau * beta * deltas[i];
        }
      }
    }

    // 4. Build smooth cubic bezier SVG path string
    let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dx = dxs[i] / 3;

      let cp1x = p1.x + dx;
      let cp1y = p1.y + m[i] * dx;
      let cp2x = p2.x - dx;
      let cp2y = p2.y - m[i + 1] * dx;

      // Strict clamping against local bounds to prevent any overshoot/undershoot below baseline
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      cp1y = Math.max(minY, Math.min(maxY, cp1y));
      cp2y = Math.max(minY, Math.min(maxY, cp2y));

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    return path;
  };

  // Closed Area Path Generator
  const getAreaPath = (points: { x: number; y: number }[], bottomY: number): string => {
    if (points.length === 0) return '';
    const linePath = getBezierPath(points);
    const first = points[0];
    const last = points[points.length - 1];
    return `${linePath} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
  };

  // Product type tabs definitions
  const productTypeTabs = [
    { key: 'all', label: 'Semua Tipe', icon: Layers },
    { key: 'physical', label: 'Produk Fisik', icon: ShoppingBag },
    { key: 'service', label: 'Layanan / Jasa', icon: Briefcase },
    { key: 'digital', label: 'File Digital', icon: Download },
    { key: 'food', label: 'Kuliner & FnB', icon: UtensilsCrossed },
    { key: 'property', label: 'Properti', icon: Home },
    { key: 'fauna', label: 'Satwa & Fauna', icon: Heart }
  ];

  // Standard sort options for item performance (no emojis)
  const sortOptions = [
    { id: 'views', label: 'Terbanyak Dilihat', desc: 'Urutan item berdasarkan jumlah tayangan terbanyak' },
    { id: 'actions', label: 'Aksi Terbanyak', desc: 'Urutan berdasarkan total klik pesan & aksi peminat' },
    { id: 'ctr', label: 'Rasio Konversi (CTR)', desc: 'Urutan berdasarkan persentase konversi peminat tertinggi' },
    { id: 'price_desc', label: 'Harga Tertinggi', desc: 'Urutan dari harga paling tinggi ke rendah' },
    { id: 'price_asc', label: 'Harga Terendah', desc: 'Urutan dari harga paling hemat' }
  ];

  // Dynamic count of products per type (server-side with fallback)
  const fallbackProductTypeCounts = useMemo(() => {
    const list = analyticsData?.top_products || [];
    const counts: Record<string, number> = { all: list.length };
    list.forEach(p => {
      const pType = p.product_type || 'physical';
      counts[pType] = (counts[pType] || 0) + 1;
    });
    return counts;
  }, [analyticsData?.top_products]);

  const productTypeCounts = serverTypeCounts || fallbackProductTypeCounts;

  // Number of distinct product types with > 0 items in the catalog
  const distinctTypesCount = useMemo(() => {
    if (!productTypeCounts) return 0;
    return Object.entries(productTypeCounts).filter(
      ([key, count]) => key !== 'all' && typeof count === 'number' && count > 0
    ).length;
  }, [productTypeCounts]);

  // Auto-reset filter if only 1 or 0 distinct types exist
  useEffect(() => {
    if (distinctTypesCount <= 1 && selectedProductType !== 'all') {
      setSelectedProductType('all');
    }
  }, [distinctTypesCount, selectedProductType]);

  // Helper for product type badge styling
  const getProductTypeBadge = (type?: string) => {
    switch (type) {
      case 'service':
        return { label: 'Layanan', bg: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', border: 'rgba(139, 92, 246, 0.25)' };
      case 'digital':
        return { label: 'Digital', bg: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4', border: 'rgba(6, 182, 212, 0.25)' };
      case 'food':
        return { label: 'Kuliner', bg: 'rgba(249, 115, 22, 0.12)', color: '#f97316', border: 'rgba(249, 115, 22, 0.25)' };
      case 'property':
        return { label: 'Properti', bg: 'rgba(236, 72, 153, 0.12)', color: '#ec4899', border: 'rgba(236, 72, 153, 0.25)' };
      case 'fauna':
        return { label: 'Fauna', bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: 'rgba(16, 185, 129, 0.25)' };
      case 'physical':
      default:
        return { label: 'Fisik', bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.25)' };
    }
  };

  // Filtered and sorted products for local fallback
  const filteredProducts = useMemo(() => {
    const list = analyticsData?.top_products || [];
    let res = list.filter(p => {
      // Filter by product type
      if (selectedProductType !== 'all') {
        const pType = p.product_type || 'physical';
        if (pType !== selectedProductType) return false;
      }
      // Filter by search query
      if (!productSearch.trim()) return true;
      const q = productSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.class && p.class.toLowerCase().includes(q)) ||
        (p.product_type && p.product_type.toLowerCase().includes(q))
      );
    });

    res = [...res].sort((a, b) => {
      const actA = a.total_actions_count ?? a.wa_clicks_count ?? 0;
      const actB = b.total_actions_count ?? b.wa_clicks_count ?? 0;

      if (productSort === 'views') return (b.view_count || 0) - (a.view_count || 0);
      if (productSort === 'actions') return actB - actA;
      if (productSort === 'ctr') return (b.conversion_rate_percent || 0) - (a.conversion_rate_percent || 0);
      if (productSort === 'price_desc') return (b.price || 0) - (a.price || 0);
      if (productSort === 'price_asc') return (a.price || 0) - (b.price || 0);
      return 0;
    });

    return res;
  }, [analyticsData?.top_products, selectedProductType, productSearch, productSort]);

  // Server-side + Client fallback pagination calculations
  const isUsingServerData = serverProducts !== null;
  const totalItems = isUsingServerData ? (serverTotal ?? 0) : filteredProducts.length;
  const totalPages = isUsingServerData ? Math.max(1, serverTotalPages) : Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    if (isUsingServerData) {
      return serverProducts;
    }
    const start = (safePage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [isUsingServerData, serverProducts, filteredProducts, safePage, pageSize]);

  // Helper for pagination numbers with ellipsis
  const getPaginationRange = (current: number, total: number) => {
    if (total <= 5) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 3) {
      return [1, 2, 3, 4, '...', total];
    }
    if (current >= total - 2) {
      return [1, '...', total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }} className="animate-fade-in">
      
      {/* 1. Header & Timeframe Controls Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem 1.5rem',
          borderRadius: '0.85rem',
          border: '1px solid var(--border-light)',
          background: 'var(--card-bg-gradient)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '0.75rem',
                backgroundColor: 'var(--primary-glow)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-light)',
                flexShrink: 0
              }}
            >
              <BarChart3 size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Analitika & Konversi Multi-Katalog
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Performa katalog <strong style={{ color: 'var(--text-primary)' }}>{storeTitle || 'Catavor'}</strong> • Terpadu Seluruh Model Bisnis
              </span>
            </div>
          </div>

          {/* Bot Defense Shield Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '20px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#10b981'
            }}
            title="Sistem secara otomatis mendeteksi dan memblokir bot web scraper, crawler mesin pencari, serta spam refresh agar data kunjungan Anda 100% murni manusia."
          >
            <ShieldCheck size={14} />
            <span>Anti-Bot & Anti-Spam Aktif</span>
          </div>
        </div>

        {/* Period Selector & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--bg-deep)', padding: '0.25rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
            {(['7d', '30d', '90d'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => onPeriodChange(p)}
                style={{
                  padding: '0.4rem 0.9rem',
                  fontSize: '0.78rem',
                  fontWeight: period === p ? 700 : 500,
                  borderRadius: '0.4rem',
                  border: 'none',
                  backgroundColor: period === p ? 'var(--primary)' : 'transparent',
                  color: period === p ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
              >
                {p === '7d' ? '7 Hari Terakhir' : p === '30d' ? '30 Hari Terakhir' : '90 Hari Terakhir'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setShowMarketIntel(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 1rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                borderRadius: '0.5rem',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                cursor: 'pointer'
              }}
            >
              <Globe size={15} />
              <span>Tren Pasar Nasional</span>
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.9rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Segarkan Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Summary Grid (4 Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        
        {/* Total Kunjungan Toko */}
        <div
          className="glass-panel"
          style={{
            padding: '1.1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Kunjungan Katalog</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '0.4rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {storeViews.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            Rata-rata {avgViewsPerDay} pengunjung/hari
          </span>
        </div>

        {/* Total Eksplorasi Produk */}
        <div
          className="glass-panel"
          style={{
            padding: '1.1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Tayangan Produk</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '0.4rem', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Eye size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {productViews.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            ~{viewsPerVisitor} produk per pengunjung
          </span>
        </div>

        {/* Total Aksi & Leads (WA + Marketplace + Rekber) */}
        <div
          className="glass-panel"
          style={{
            padding: '1.1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Peminat & Aksi</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '0.4rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', letterSpacing: '-0.02em' }}>
            {totalActions.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            Rata-rata {avgActionsPerDay} aksi/hari
          </span>
        </div>

        {/* Rasio Konversi Keseluruhan */}
        <div
          className="glass-panel"
          style={{
            padding: '1.1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Rasio Konversi</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '0.4rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
            {conversionRate.toFixed(1)}%
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            {conversionRate >= 5 ? 'Tingkat Sangat Optimal' : conversionRate >= 2 ? 'Standar Sehat Retail' : 'Peluang Optimasi'}
          </span>
        </div>
      </div>

      {/* 3. Multi-Channel Conversion Distribution Cards */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem 1.5rem',
          borderRadius: '0.85rem',
          border: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-card)'
        }}
      >
        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 1rem 0' }}>
          Distribusi Kanal Konversi Pembeli
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {/* Direct WA */}
          <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', marginBottom: '0.35rem' }}>
              <MessageCircle size={16} />
              <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>WhatsApp Langsung</span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {directWa} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>chat leads</span>
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Order retail, booking jasa & janji survey</span>
          </div>

          {/* Marketplace */}
          <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f97316', marginBottom: '0.35rem' }}>
              <ShoppingBag size={16} />
              <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Marketplace Pihak ke-3</span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {marketplaceClicks} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>klik</span>
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Global marketplace</span>
          </div>

          {/* Rekber Syariah */}
          <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6', marginBottom: '0.35rem' }}>
              <ShieldCheck size={16} />
              <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Rekber Syariah</span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {rekberClicks} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>peminat</span>
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Escrow & transaksi bernilai tinggi</span>
          </div>

          {/* Video Engagement */}
          <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a855f7', marginBottom: '0.35rem' }}>
              <Video size={16} />
              <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Video / Tour Clicks</span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {videoViews} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>tonton</span>
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Virtual tour properti, demo & unboxing</span>
          </div>
        </div>
      </div>

      {/* 4. Daily Trends Chart */}
      <div
        className="glass-panel"
        style={{
          padding: '1rem 1.25rem 0.75rem',
          borderRadius: '0.85rem',
          border: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-card)'
        }}
      >
        {/* Header Row: Title, Subtitle, Metric Focus, Scale Mode & Chart Type Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Activity size={17} style={{ color: 'var(--primary)' }} />
              Tren Kunjungan & Aksi Harian
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              ({period === '7d' ? '7 hari terakhir' : period === '30d' ? '30 hari terakhir' : '90 hari terakhir'})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Metric Focus Filter Tabs (Crucial for high disparity between Views and Actions) */}
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-deep)', padding: '0.15rem', borderRadius: '0.45rem', border: '1px solid var(--border-light)' }}>
              <button
                type="button"
                onClick={() => setMetricFocus('all')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.22rem 0.55rem',
                  fontSize: '0.72rem',
                  fontWeight: metricFocus === 'all' ? 700 : 500,
                  borderRadius: '0.35rem',
                  border: 'none',
                  backgroundColor: metricFocus === 'all' ? 'var(--bg-card)' : 'transparent',
                  color: metricFocus === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: metricFocus === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
              >
                <span>Semua</span>
              </button>
              <button
                type="button"
                onClick={() => setMetricFocus('views')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.22rem 0.55rem',
                  fontSize: '0.72rem',
                  fontWeight: metricFocus === 'views' ? 700 : 500,
                  borderRadius: '0.35rem',
                  border: 'none',
                  backgroundColor: metricFocus === 'views' ? 'var(--bg-card)' : 'transparent',
                  color: metricFocus === 'views' ? '#3b82f6' : 'var(--text-secondary)',
                  boxShadow: metricFocus === 'views' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                <span>Kunjungan</span>
              </button>
              <button
                type="button"
                onClick={() => setMetricFocus('actions')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.22rem 0.55rem',
                  fontSize: '0.72rem',
                  fontWeight: metricFocus === 'actions' ? 700 : 500,
                  borderRadius: '0.35rem',
                  border: 'none',
                  backgroundColor: metricFocus === 'actions' ? 'var(--bg-card)' : 'transparent',
                  color: metricFocus === 'actions' ? '#10b981' : 'var(--text-secondary)',
                  boxShadow: metricFocus === 'actions' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                <span>Aksi / Leads</span>
              </button>
            </div>

            {/* Smart Adaptive Scale Mode Toggle (Soft-log prevents needle spikes from flattening low-volume days) */}
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-deep)', padding: '0.15rem', borderRadius: '0.45rem', border: '1px solid var(--border-light)' }}>
              <button
                type="button"
                onClick={() => setScaleMode('linear')}
                title="Skala Linier: Proporsional riil matematis"
                style={{
                  padding: '0.22rem 0.5rem',
                  fontSize: '0.7rem',
                  fontWeight: scaleMode === 'linear' ? 700 : 500,
                  borderRadius: '0.35rem',
                  border: 'none',
                  backgroundColor: scaleMode === 'linear' ? 'var(--bg-card)' : 'transparent',
                  color: scaleMode === 'linear' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: scaleMode === 'linear' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
              >
                Linier
              </button>
              <button
                type="button"
                onClick={() => setScaleMode('adaptive')}
                title="Skala Adaptif: Mengoptimalkan fluktuasi hari normal saat terjadi lonjakan masif"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.22rem 0.5rem',
                  fontSize: '0.7rem',
                  fontWeight: scaleMode === 'adaptive' ? 700 : 500,
                  borderRadius: '0.35rem',
                  border: 'none',
                  backgroundColor: scaleMode === 'adaptive' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: scaleMode === 'adaptive' ? 'var(--primary)' : 'var(--text-secondary)',
                  boxShadow: scaleMode === 'adaptive' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
              >
                <Sparkles size={11} />
                <span>Adaptif</span>
              </button>
            </div>

            {/* Chart View Toggle: Line/Area vs Bar */}
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-deep)', padding: '0.15rem', borderRadius: '0.45rem', border: '1px solid var(--border-light)' }}>
              <button
                type="button"
                onClick={() => setChartType('area')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.22rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: chartType === 'area' ? 700 : 500,
                  borderRadius: '0.35rem',
                  border: 'none',
                  backgroundColor: chartType === 'area' ? 'var(--primary)' : 'transparent',
                  color: chartType === 'area' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
              >
                <TrendingUp size={12} />
                <span>Garis</span>
              </button>
              <button
                type="button"
                onClick={() => setChartType('bar')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.22rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: chartType === 'bar' ? 700 : 500,
                  borderRadius: '0.35rem',
                  border: 'none',
                  backgroundColor: chartType === 'bar' ? 'var(--primary)' : 'transparent',
                  color: chartType === 'bar' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
              >
                <BarChart3 size={12} />
                <span>Batang</span>
              </button>
            </div>
          </div>
        </div>

        {/* High Disparity Insight Notification Pill (Non-intrusive) */}
        {isDisparityHigh && peakDay && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              padding: '0.35rem 0.75rem',
              marginBottom: '0.65rem',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              fontSize: '0.72rem',
              color: 'var(--text-primary)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Sparkles size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span>
                <strong>Lonjakan Trafik:</strong> Terjadi puncak <strong>{peakDay.store_views.toLocaleString('id-ID')} kunjungan</strong> ({peakRatio.toFixed(1)}x rata-rata) pada {formatShortDate(peakDay.date)}.
              </span>
            </div>
            {scaleMode === 'linear' && (
              <button
                type="button"
                onClick={() => setScaleMode('adaptive')}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                  whiteSpace: 'nowrap'
                }}
              >
                Aktifkan Skala Adaptif →
              </button>
            )}
          </div>
        )}

        {/* Desktop Chart Container */}
        <div style={{ position: 'relative', width: '100%', height: '170px', minHeight: '170px' }}>
          {chartType === 'area' ? (
            /* SVG Area & Smooth Curve Line Chart */
            <svg
              viewBox={`0 0 720 150`}
              style={{ width: '100%', height: '100%', overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="viewsGradientDesktop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="actionsGradientDesktop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <filter id="glowLine" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="#3b82f6" floodOpacity="0.3" />
                </filter>
              </defs>

              {/* Grid Lines & Y-Axis Labels */}
              {yGridTicks.map(tick => {
                const ratio = getNormalizedRatio(tick);
                const yPos = 12 + 100 - (ratio * 100);
                const isBase = tick === 0;
                return (
                  <g key={tick}>
                    <line
                      x1={32}
                      y1={yPos}
                      x2={700}
                      y2={yPos}
                      stroke={isBase ? 'var(--border-light)' : 'var(--border-light)'}
                      strokeDasharray={isBase ? 'none' : '3 3'}
                      strokeWidth={isBase ? 1.2 : 0.8}
                      strokeOpacity={isBase ? 0.85 : 0.5}
                    />
                    <text
                      x={26}
                      y={yPos + 3.5}
                      textAnchor="end"
                      fontSize="9.5"
                      fontWeight="600"
                      fill="var(--text-secondary)"
                      fontFamily="inherit"
                    >
                      {formatCompactNumber(tick)}
                    </text>
                  </g>
                );
              })}

              {/* Area Fills */}
              {trends.length > 0 && (
                <>
                  {metricFocus !== 'actions' && (
                    <path
                      d={getAreaPath(viewsPoints, 112)}
                      fill="url(#viewsGradientDesktop)"
                    />
                  )}
                  {metricFocus !== 'views' && (
                    <path
                      d={getAreaPath(actionsPoints, 112)}
                      fill="url(#actionsGradientDesktop)"
                    />
                  )}
                  
                  {/* Curves */}
                  {metricFocus !== 'actions' && (
                    <path
                      d={getBezierPath(viewsPoints)}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#glowLine)"
                    />
                  )}
                  {metricFocus !== 'views' && (
                    <path
                      d={getBezierPath(actionsPoints)}
                      fill="none"
                      stroke="#059669"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </>
              )}

              {/* Data Points & Interactive Triggers */}
              {trends.map((t, idx) => {
                const ptV = viewsPoints[idx];
                const ptA = actionsPoints[idx];
                const isHovered = hoveredPointIndex === idx;
                const isLatest = idx === trends.length - 1;
                const isPeak = idx === peakIndex && isDisparityHigh;
                if (!ptV || !ptA) return null;

                const showDateLabel = period === '7d' || (period === '30d' && idx % 4 === 0) || (period === '90d' && idx % 10 === 0) || isLatest;
                const labelAnchor = idx === 0 ? 'start' : isLatest ? 'end' : 'middle';

                return (
                  <g key={t.date}>
                    {/* Hover vertical reference line */}
                    {isHovered && (
                      <line
                        x1={ptV.x}
                        y1={12}
                        x2={ptV.x}
                        y2={112}
                        stroke="var(--primary)"
                        strokeDasharray="2 2"
                        strokeWidth="1.4"
                        strokeOpacity={0.8}
                      />
                    )}

                    {/* Peak Outlier Beacon Halo */}
                    {isPeak && metricFocus !== 'actions' && (
                      <circle
                        cx={ptV.x}
                        cy={ptV.y}
                        r={isHovered ? 10 : 8}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1.6"
                        strokeDasharray="3 2"
                      />
                    )}

                    {/* Point circles */}
                    {metricFocus !== 'actions' && (
                      <circle
                        cx={ptV.x}
                        cy={ptV.y}
                        r={isHovered ? 6 : isPeak ? 5 : 4}
                        fill={isPeak ? '#f59e0b' : '#3b82f6'}
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                    )}
                    {metricFocus !== 'views' && (
                      <circle
                        cx={ptA.x}
                        cy={ptA.y}
                        r={isHovered ? 6 : 4}
                        fill="#10b981"
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                    )}

                    {/* X-Axis Date Label */}
                    {showDateLabel && (
                      <text
                        x={ptV.x}
                        y={134}
                        textAnchor={labelAnchor}
                        fontSize="9.5"
                        fill={isHovered ? 'var(--primary)' : isLatest ? 'var(--text-primary)' : 'var(--text-secondary)'}
                        fontWeight={isLatest || isHovered ? '700' : '500'}
                        fontFamily="inherit"
                      >
                        {formatShortDate(t.date)}
                      </text>
                    )}

                    {/* Transparent touch/click trigger area */}
                    <rect
                      x={ptV.x - (668 / Math.max(1, trends.length)) / 2}
                      y={0}
                      width={668 / Math.max(1, trends.length)}
                      height={150}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredPointIndex(idx)}
                      onMouseLeave={() => setHoveredPointIndex(null)}
                    />
                  </g>
                );
              })}
            </svg>
          ) : (
            /* Bar Chart Visualization */
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Background Grid Lines */}
              <div style={{ position: 'absolute', top: '12px', left: '32px', right: '15px', bottom: '30px', pointerEvents: 'none' }}>
                {yGridTicks.map(tick => {
                  const bottomPct = getNormalizedRatio(tick) * 100;
                  return (
                    <div
                      key={tick}
                      style={{
                        position: 'absolute',
                        bottom: `${bottomPct}%`,
                        left: 0,
                        right: 0,
                        borderBottom: '1px dashed var(--border-light)',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ position: 'absolute', right: '100%', marginRight: '6px', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)', transform: 'translateY(50%)' }}>
                        {formatCompactNumber(tick)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Bars Row */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', height: 'calc(100% - 30px)', paddingLeft: '32px', paddingRight: '15px' }}>
                {trends.map((t, idx) => {
                  const vRatio = getNormalizedRatio(t.store_views || 0);
                  const vHeight = t.store_views > 0
                    ? Math.max(4, Math.min(105, Math.round(vRatio * 105)))
                    : 0;
                  const actCount = t.total_actions ?? t.wa_clicks ?? 0;
                  const aRatio = getNormalizedRatio(actCount);
                  const aHeight = actCount > 0
                    ? Math.max(4, Math.min(105, Math.round(aRatio * 105)))
                    : 0;
                  const isHovered = hoveredPointIndex === idx;

                  return (
                    <div
                      key={t.date}
                      onMouseEnter={() => setHoveredPointIndex(idx)}
                      onMouseLeave={() => setHoveredPointIndex(null)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        height: '100%',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', width: '100%', justifyContent: 'center' }}>
                        {/* Views Bar */}
                        {metricFocus !== 'actions' && (
                          <div
                            style={{
                              width: metricFocus === 'views' ? '80%' : '44%',
                              maxWidth: '18px',
                              height: `${vHeight}px`,
                              background: isHovered ? 'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)' : 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)',
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.25s ease'
                            }}
                          />
                        )}
                        {/* Actions Bar */}
                        {metricFocus !== 'views' && (
                          <div
                            style={{
                              width: metricFocus === 'actions' ? '80%' : '44%',
                              maxWidth: '18px',
                              height: `${aHeight}px`,
                              background: isHovered ? 'linear-gradient(180deg, #34d399 0%, #059669 100%)' : 'linear-gradient(180deg, #10b981 0%, #047857 100%)',
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.25s ease'
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* X-Axis Date Labels Row */}
              <div style={{ display: 'flex', paddingLeft: '32px', paddingRight: '15px', height: '26px', alignItems: 'center' }}>
                {trends.map((t, idx) => {
                  const isLatest = idx === trends.length - 1;
                  const showDateLabel = period === '7d' || (period === '30d' && idx % 4 === 0) || (period === '90d' && idx % 10 === 0) || isLatest;
                  const isHovered = hoveredPointIndex === idx;

                  return (
                    <div key={t.date} style={{ flex: 1, textAlign: idx === 0 ? 'left' : isLatest ? 'right' : 'center' }}>
                      {showDateLabel && (
                        <span style={{ fontSize: '0.68rem', color: isHovered ? 'var(--primary)' : isLatest ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isLatest || isHovered ? 700 : 500, whiteSpace: 'nowrap' }}>
                          {formatShortDate(t.date)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Floating Glass Tooltip when Hovered */}
          {hoveredPointIndex !== null && trends[hoveredPointIndex] && (
            <div
              style={{
                position: 'absolute',
                top: '8px',
                left: `${Math.min(78, Math.max(16, ((hoveredPointIndex + 0.5) / Math.max(1, trends.length)) * 100))}%`,
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(15, 23, 42, 0.96)',
                color: '#ffffff',
                padding: '0.6rem 0.9rem',
                borderRadius: '0.65rem',
                fontSize: '0.75rem',
                zIndex: 30,
                boxShadow: '0 8px 22px -4px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.15)',
                pointerEvents: 'none',
                backdropFilter: 'blur(10px)',
                minWidth: '185px'
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: '0.35rem', color: '#f8fafc', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '0.25rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{formatDetailedDate(trends[hoveredPointIndex].date)}</span>
                {hoveredPointIndex === peakIndex && isDisparityHigh && (
                  <span style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: 800, backgroundColor: 'rgba(245, 158, 11, 0.15)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                    ★ Puncak
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', margin: '0.25rem 0' }}>
                <span style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                  Kunjungan:
                </span>
                <strong style={{ color: '#60a5fa', fontSize: '0.82rem' }}>
                  {trends[hoveredPointIndex].store_views.toLocaleString('id-ID')}
                </strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', margin: '0.25rem 0' }}>
                <span style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  Total Aksi:
                </span>
                <strong style={{ color: '#34d399', fontSize: '0.82rem' }}>
                  {(trends[hoveredPointIndex].total_actions ?? trends[hoveredPointIndex].wa_clicks ?? 0).toLocaleString('id-ID')}
                </strong>
              </div>
              {/* Day Conversion Rate */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginTop: '0.3rem', paddingTop: '0.25rem', borderTop: '1px dashed rgba(255,255,255,0.1)', fontSize: '0.7rem', color: '#94a3b8' }}>
                <span>Konversi Hari Ini:</span>
                <span style={{ color: '#e2e8f0', fontWeight: 700 }}>
                  {trends[hoveredPointIndex].store_views > 0
                    ? `${(((trends[hoveredPointIndex].total_actions ?? trends[hoveredPointIndex].wa_clicks ?? 0) / trends[hoveredPointIndex].store_views) * 100).toFixed(1)}%`
                    : '0%'}
                </span>
              </div>
            </div>
          )}

          {/* Zero Data Indicator Watermark (when total store views in selected period is 0) */}
          {storeViews === 0 && (
            <div
              style={{
                position: 'absolute',
                top: '42%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'var(--bg-deep)',
                border: '1px solid var(--border-light)',
                padding: '0.55rem 1.15rem',
                borderRadius: '25px',
                pointerEvents: 'none',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                zIndex: 10
              }}
            >
              <TrendingUp size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Menunggu Data Kunjungan • Bagikan link katalog Anda untuk mencatat grafik real-time
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 5. Product Type Filter Tabs & Top Performing Products */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem 1.5rem',
          borderRadius: '0.85rem',
          border: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        {/* Header with Title, Count Badge & Search / Sort Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Performa Item per Tipe Katalog
              </h3>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.55rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--primary-glow)',
                  color: 'var(--primary)',
                  border: '1px solid var(--border-light)'
                }}
              >
                {totalItems} item
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Analisa item paling diminati calon pembeli dan efisiensi konversinya
            </span>
          </div>

          {/* Search Box & Sort Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Cari item katalog..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 2rem 0.45rem 2.1rem',
                  fontSize: '0.78rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-deep)',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
              {productSearch && (
                <button
                  type="button"
                  onClick={() => setProductSearch('')}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px'
                  }}
                  title="Hapus pencarian"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Standard Dropdown Menu Popover */}
            <div ref={sortDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
              <button
                type="button"
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-deep)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                  whiteSpace: 'nowrap'
                }}
              >
                <ArrowUpDown size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span>{sortOptions.find(o => o.id === productSort)?.label || 'Terbanyak Dilihat'}</span>
                <ChevronDown size={13} style={{ color: 'var(--text-secondary)', transform: isSortDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }} />
              </button>

              {isSortDropdownOpen && (
                <div
                  className="glass-panel"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: '280px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '0.75rem',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
                    zIndex: 1000,
                    padding: '0.4rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    animation: 'fadeIn 0.15s ease'
                  }}
                >
                  <div style={{ padding: '0.4rem 0.6rem 0.25rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Urutkan Item Berdasarkan
                  </div>
                  {sortOptions.map((opt) => {
                    const isSelected = productSort === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setProductSort(opt.id as any);
                          setCurrentPage(1);
                          setIsSortDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          padding: '0.55rem 0.65rem',
                          borderRadius: '0.5rem',
                          border: 'none',
                          backgroundColor: isSelected ? 'var(--primary-glow)' : 'transparent',
                          color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'var(--transition-fast)'
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-deep)';
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: isSelected ? 700 : 500 }}>
                            {opt.label}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: isSelected ? 'var(--primary)' : 'var(--text-secondary)', opacity: 0.85 }}>
                            {opt.desc}
                          </span>
                        </div>
                        {isSelected && (
                          <Check size={14} strokeWidth={3} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Product Type Switcher Pills with Dynamic Item Counts - only shown if store has multiple catalog types */}
        {distinctTypesCount > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              overflowX: 'auto',
              paddingBottom: '0.35rem',
              scrollbarWidth: 'none'
            }}
          >
            {productTypeTabs
              .filter(tab => tab.key === 'all' || (productTypeCounts[tab.key] || 0) > 0)
              .map(tab => {
                const TabIcon = tab.icon;
                const isSelected = selectedProductType === tab.key;
                const count = productTypeCounts[tab.key] || 0;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSelectedProductType(tab.key)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 700 : 500,
                      borderRadius: '20px',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                      backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-deep)',
                      color: isSelected ? '#ffffff' : count > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'var(--transition-fast)'
                    }}
                  >
                    <TabIcon size={14} />
                    <span>{tab.label}</span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.05rem 0.45rem',
                        borderRadius: '10px',
                        backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-card)',
                        color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                        border: isSelected ? 'none' : '1px solid var(--border-light)'
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
          </div>
        )}

        {/* Active Filter Notice Banner (if filtered or searched) */}
        {(selectedProductType !== 'all' || productSearch.trim()) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.45rem 0.85rem',
              borderRadius: '0.5rem',
              backgroundColor: 'var(--bg-deep)',
              border: '1px solid var(--border-light)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span>Menampilkan filter:</span>
              {selectedProductType !== 'all' && (
                <span style={{ fontWeight: 700, color: 'var(--primary)', backgroundColor: 'var(--primary-glow)', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                  Tipe: {productTypeTabs.find(t => t.key === selectedProductType)?.label}
                </span>
              )}
              {productSearch.trim() && (
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                  Kata Kunci: "{productSearch.trim()}"
                </span>
              )}
              <span>({totalItems} ditemukan)</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedProductType('all');
                setProductSearch('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <X size={12} />
              <span>Reset Filter</span>
            </button>
          </div>
        )}

        {/* Top Products Table / Card List */}
        {totalItems === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3rem 1.5rem',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--bg-deep)',
              border: '1px dashed var(--border-light)',
              textAlign: 'center',
              gap: '0.75rem'
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-light)'
              }}
            >
              <PackageSearch size={22} />
            </div>
            <div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>
                Tidak Ada Item Ditemukan
              </h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '340px' }}>
                {productSearch.trim() || selectedProductType !== 'all'
                  ? `Tidak ditemukan item yang cocok dengan kriteria pencarian "${productSearch}" atau filter tipe saat ini.`
                  : 'Belum ada data aktivitas item pada katalog ini.'}
              </p>
            </div>
            {(productSearch.trim() || selectedProductType !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setProductSearch('');
                  setSelectedProductType('all');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.9rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  borderRadius: '0.5rem',
                  border: '1px solid var(--primary)',
                  backgroundColor: 'var(--primary-glow)',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  marginTop: '0.35rem'
                }}
              >
                <RefreshCw size={13} />
                <span>Reset Filter & Pencarian</span>
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {paginatedProducts.map((prod, index) => {
              const itemActions = prod.total_actions_count ?? prod.wa_clicks_count ?? 0;
              const ctr = prod.conversion_rate_percent ?? 0;
              const globalRank = (safePage - 1) * pageSize + index + 1;
              const typeBadge = getProductTypeBadge(prod.product_type);

              // Rank medal style
              const getRankBadgeStyle = (rank: number) => {
                if (rank === 1) {
                  return {
                    bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.22), rgba(217, 119, 6, 0.1))',
                    border: '1px solid rgba(245, 158, 11, 0.45)',
                    color: '#d97706',
                    text: '#1'
                  };
                }
                if (rank === 2) {
                  return {
                    bg: 'linear-gradient(135deg, rgba(148, 163, 184, 0.22), rgba(100, 116, 139, 0.1))',
                    border: '1px solid rgba(148, 163, 184, 0.45)',
                    color: '#64748b',
                    text: '#2'
                  };
                }
                if (rank === 3) {
                  return {
                    bg: 'linear-gradient(135deg, rgba(217, 119, 6, 0.18), rgba(180, 83, 9, 0.08))',
                    border: '1px solid rgba(217, 119, 6, 0.35)',
                    color: '#b45309',
                    text: '#3'
                  };
                }
                return {
                  bg: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  text: `#${rank}`
                };
              };

              const rankStyle = getRankBadgeStyle(globalRank);

              return (
                <div
                  key={prod.id}
                  onClick={() => onViewProduct?.(prod.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    padding: '0.9rem 1.1rem',
                    borderRadius: '0.75rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    cursor: onViewProduct ? 'pointer' : 'default',
                    transition: 'var(--transition-fast)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-light)';
                  }}
                >
                  {/* Top Section: Rank, Image, Title & Conversion Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                      {/* Rank Badge */}
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '7px',
                          background: rankStyle.bg,
                          color: rankStyle.color,
                          border: rankStyle.border,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          flexShrink: 0
                        }}
                      >
                        {rankStyle.text}
                      </div>

                      {/* Thumbnail */}
                      {prod.image_url ? (
                        <img
                          src={prod.image_url}
                          alt={prod.name}
                          style={{ width: '42px', height: '42px', borderRadius: '0.5rem', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-light)' }}
                        />
                      ) : (
                        <div style={{ width: '42px', height: '42px', borderRadius: '0.5rem', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0, border: '1px solid var(--border-light)' }}>
                          <ShoppingBag size={18} />
                        </div>
                      )}

                      {/* Title, Price & Type Badge */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {prod.name}
                          </span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              color: typeBadge.color,
                              backgroundColor: typeBadge.bg,
                              border: `1px solid ${typeBadge.border}`,
                              padding: '0.1rem 0.45rem',
                              borderRadius: '4px',
                              flexShrink: 0
                            }}
                          >
                            {typeBadge.label}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700 }}>
                          {formatPrice(prod.price)}
                        </span>
                      </div>
                    </div>

                    {/* Conversion Badge */}
                    <div style={{ flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          color: ctr >= 5 ? '#10b981' : ctr >= 2 ? 'var(--primary)' : '#f59e0b',
                          backgroundColor: ctr >= 5 ? 'rgba(16, 185, 129, 0.12)' : ctr >= 2 ? 'var(--primary-glow)' : 'rgba(245, 158, 11, 0.12)',
                          border: ctr >= 5 ? '1px solid rgba(16, 185, 129, 0.3)' : ctr >= 2 ? '1px solid var(--border-light)' : '1px solid rgba(245, 158, 11, 0.3)',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '20px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <Target size={12} />
                        <span>{ctr.toFixed(1)}% CTR</span>
                      </span>
                    </div>
                  </div>

                  {/* Bottom Section: Category Tag + Metrics Stats Pills */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.45rem', borderTop: '1px solid var(--border-light)' }}>
                    {/* Category badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {prod.class ? (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--text-secondary)',
                            backgroundColor: 'var(--bg-card)',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-light)',
                            fontWeight: 500
                          }}
                        >
                          {prod.class}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Umum</span>
                      )}
                    </div>

                    {/* Metrics: Views & Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)', padding: '0.2rem 0.55rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                        <Eye size={13} style={{ color: '#3b82f6' }} />
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{prod.view_count.toLocaleString()}</span>
                        <span>tayangan</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)', padding: '0.2rem 0.55rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                        <Zap size={13} style={{ color: '#10b981' }} />
                        <span style={{ fontWeight: 700, color: '#10b981' }}>{itemActions.toLocaleString()}</span>
                        <span>aksi peminat</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 5.1 Pagination Navigation Bar */}
        {totalItems > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border-light)'
            }}
          >
            {/* Page status & Page size selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <span>
                Menampilkan <strong style={{ color: 'var(--text-primary)' }}>{(safePage - 1) * pageSize + 1}</strong> - <strong style={{ color: 'var(--text-primary)' }}>{Math.min(safePage * pageSize, totalItems)}</strong> dari <strong style={{ color: 'var(--text-primary)' }}>{totalItems}</strong> item
              </span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>Tampilkan:</span>
                <select
                  value={pageSize}
                  onChange={e => setPageSize(Number(e.target.value))}
                  style={{
                    padding: '0.2rem 0.45rem',
                    fontSize: '0.75rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'var(--bg-deep)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value={5}>5 / hal</option>
                  <option value={6}>6 / hal</option>
                  <option value={10}>10 / hal</option>
                  <option value={20}>20 / hal</option>
                  <option value={50}>50 / hal</option>
                </select>
              </div>
            </div>

            {/* Page Navigation Buttons */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <button
                  type="button"
                  disabled={safePage === 1}
                  onClick={() => setCurrentPage(1)}
                  title="Halaman Pertama"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'var(--bg-deep)',
                    color: safePage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: safePage === 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: safePage === 1 ? 0.35 : 1
                  }}
                >
                  <ChevronsLeft size={14} />
                </button>

                <button
                  type="button"
                  disabled={safePage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  title="Halaman Sebelumnya"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'var(--bg-deep)',
                    color: safePage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: safePage === 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: safePage === 1 ? 0.35 : 1
                  }}
                >
                  <ChevronLeft size={14} />
                </button>

                {getPaginationRange(safePage, totalPages).map((pNum, pIdx) => {
                  if (pNum === '...') {
                    return (
                      <span key={`ellipsis-${pIdx}`} style={{ padding: '0 0.3rem', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                        ...
                      </span>
                    );
                  }
                  const isCurrent = pNum === safePage;
                  return (
                    <button
                      key={`page-${pNum}`}
                      type="button"
                      onClick={() => setCurrentPage(pNum as number)}
                      style={{
                        minWidth: '28px',
                        height: '28px',
                        padding: '0 0.35rem',
                        borderRadius: '6px',
                        border: isCurrent ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                        backgroundColor: isCurrent ? 'var(--primary)' : 'var(--bg-deep)',
                        color: isCurrent ? '#ffffff' : 'var(--text-primary)',
                        fontWeight: isCurrent ? 700 : 500,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'var(--transition-fast)'
                      }}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={safePage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  title="Halaman Berikutnya"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'var(--bg-deep)',
                    color: safePage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: safePage === totalPages ? 0.35 : 1
                  }}
                >
                  <ChevronRight size={14} />
                </button>

                <button
                  type="button"
                  disabled={safePage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  title="Halaman Terakhir"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'var(--bg-deep)',
                    color: safePage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: safePage === totalPages ? 0.35 : 1
                  }}
                >
                  <ChevronsRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. Smart Actionable Insights Panel */}
      {analyticsData?.insights && analyticsData.insights.length > 0 && (
        <div
          className="glass-panel"
          style={{
            padding: '1.25rem 1.5rem',
            borderRadius: '0.85rem',
            border: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
            <Lightbulb size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Wawasan & Rekomendasi Pintar Bisnis
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {analyticsData.insights.map((ins, i) => (
              <div
                key={i}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '0.75rem',
                  backgroundColor: ins.type === 'success' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-deep)',
                  border: ins.type === 'success' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}
              >
                {ins.type === 'success' ? (
                  <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                ) : (
                  <AlertCircle size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                )}
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.2rem 0' }}>
                    {ins.title}
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    {ins.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market Intelligence Anonymized Macro Trends Modal */}
      <MarketIntelligenceModal
        isOpen={showMarketIntel}
        onClose={() => setShowMarketIntel(false)}
        apiBase=""
      />
    </div>
  );
};
