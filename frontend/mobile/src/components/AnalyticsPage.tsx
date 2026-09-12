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
  Sparkles,
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Check,
  X,
  ArrowUpDown,
  PackageSearch,
  Filter,
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
  isMobile = true,
  onBackToMenu,
  onViewProduct
}) => {
  const [productSearch, setProductSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedProductType, setSelectedProductType] = useState<string>('all');
  const [productSort, setProductSort] = useState<'views' | 'actions' | 'ctr' | 'price_desc' | 'price_asc'>('views');
  const [showSortModal, setShowSortModal] = useState<boolean>(false);
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

  // Mobile Drag-to-Dismiss Gesture for Bottom Sheet Modal
  const [sheetDragY, setSheetDragY] = useState<number>(0);
  const [isSheetDragging, setIsSheetDragging] = useState<boolean>(false);
  const touchStartY = useRef<number>(0);

  const handleSheetDragStart = (clientY: number) => {
    touchStartY.current = clientY;
    setIsSheetDragging(true);
  };

  const handleSheetDragMove = (clientY: number) => {
    if (!isSheetDragging) return;
    const delta = clientY - touchStartY.current;
    if (delta > 0) {
      setSheetDragY(delta);
    } else {
      setSheetDragY(delta * 0.15);
    }
  };

  const handleSheetDragEnd = () => {
    if (!isSheetDragging) return;
    setIsSheetDragging(false);
    if (sheetDragY > 75) {
      setShowSortModal(false);
    }
    setSheetDragY(0);
  };

  // Reset page when filter or sort changes
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

  const formatMobileChartDate = (dateStr: string, periodType: '7d' | '30d' | '90d') => {
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
        const isToday =
          d.getDate() === today.getDate() &&
          d.getMonth() === today.getMonth() &&
          d.getFullYear() === today.getFullYear();

        if (isToday) {
          return 'Hari Ini';
        }

        if (periodType === '7d') {
          return dayNames[d.getDay()] || '';
        }

        if (periodType === '30d') {
          return `${day}`;
        }

        return `${day} ${monthNames[month] || ''}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

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

  const daysCount = period === '90d' ? 90 : period === '30d' ? 30 : 7;
  const storeViews = analyticsData?.total_store_views ?? 0;
  const productViews = analyticsData?.total_product_views ?? 0;
  const directWa = analyticsData?.total_direct_wa ?? analyticsData?.total_wa_clicks ?? 0;
  const marketplaceClicks = analyticsData?.total_marketplace_clicks ?? 0;
  const rekberClicks = analyticsData?.total_rekber_clicks ?? 0;
  const videoViews = analyticsData?.total_video_views ?? 0;
  const totalActions = analyticsData?.total_actions ?? (directWa + marketplaceClicks + rekberClicks + videoViews);
  const conversionRate = analyticsData?.conversion_rate_percent ?? 0;

  const avgViewsPerDay = (storeViews / daysCount).toFixed(1);
  const avgActionsPerDay = (totalActions / daysCount).toFixed(1);
  const viewsPerVisitor = storeViews > 0 ? (productViews / storeViews).toFixed(1) : '0';

  // Trends calculation
  const trends = analyticsData?.trends || [];

  // Disparity & Spike Analysis (Detects extreme single-day outliers e.g. 100 views vs 2-3 views normal)
  const peakInfo = useMemo(() => {
    if (!trends.length) return { peakVal: 0, nonPeakMedian: 0, peakRatio: 1, isDisparityHigh: false, peakDay: null, peakIndex: -1 };
    
    let maxVal = 0;
    let maxIdx = -1;
    let peakDayObj: AnalyticsTrendPoint | null = null;
    const values: number[] = [];

    trends.forEach((t, idx) => {
      const v = Math.max(t.store_views || 0, (t.total_actions || t.wa_clicks || 0));
      values.push(v);
      if (v > maxVal) {
        maxVal = v;
        maxIdx = idx;
        peakDayObj = t;
      }
    });

    if (maxVal <= 5 || values.length < 3) {
      return { peakVal: maxVal, nonPeakMedian: maxVal, peakRatio: 1, isDisparityHigh: false, peakDay: peakDayObj, peakIndex: maxIdx };
    }

    // Calculate median of non-zero baseline
    const nonZeroValues = values.filter(v => v > 0).sort((a, b) => a - b);
    const median = nonZeroValues.length > 0 ? nonZeroValues[Math.floor(nonZeroValues.length / 2)] : 1;
    const ratio = median > 0 ? maxVal / median : maxVal;
    
    // Disparity is high if single peak is >= 4x the typical baseline
    const isDisparityHigh = ratio >= 4 && maxVal >= 10;

    return {
      peakVal: maxVal,
      nonPeakMedian: median,
      peakRatio: ratio,
      isDisparityHigh,
      peakDay: peakDayObj,
      peakIndex: maxIdx
    };
  }, [trends]);

  // Dynamic scale calculation with clean step & nice numbers algorithm for extreme spikes / disparities
  const chartMaxVal = useMemo(() => {
    if (!trends.length) return 4;
    const maxVal = Math.max(...trends.map(t => {
      if (metricFocus === 'views') return t.store_views || 0;
      if (metricFocus === 'actions') return t.total_actions || t.wa_clicks || 0;
      return Math.max(t.store_views || 0, (t.total_actions || t.wa_clicks || 0));
    }));
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
  }, [trends, metricFocus]);

  // Y-Axis reference grid ticks (3 tiers: 0, mid, max)
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

  // Scale normalization helper (supports Linear and Adaptive Log-Scaled Compression)
  const getNormalizedRatio = (val: number): number => {
    if (val <= 0 || chartMaxVal <= 0) return 0;
    if (scaleMode === 'linear') {
      return Math.min(1, val / chartMaxVal);
    }
    // Adaptive mode: Logarithmic compression preserves visibility for small daily numbers while capping huge peaks
    const logVal = Math.log1p(val);
    const logMax = Math.log1p(chartMaxVal);
    return Math.min(1, logVal / logMax);
  };

  // Point coordinates for compact SVG chart (Mobile: 340x120) with strict boundary clamping & disparity normalization
  const { viewsPoints, actionsPoints } = useMemo(() => {
    const vPts: { x: number; y: number }[] = [];
    const aPts: { x: number; y: number }[] = [];
    const N = trends.length;
    if (N === 0) return { viewsPoints: vPts, actionsPoints: aPts };

    const padLeft = 20;
    const innerW = 306;
    const padTop = 10;
    const innerH = 82;
    const bottomY = padTop + innerH;

    trends.forEach((t, i) => {
      const x = N === 1 ? padLeft + innerW / 2 : padLeft + (i / (N - 1)) * innerW;
      const vRatio = getNormalizedRatio(t.store_views || 0);
      const rawVY = padTop + innerH - (vRatio * innerH);

      const act = t.total_actions ?? t.wa_clicks ?? 0;
      const aRatio = getNormalizedRatio(act);
      const rawAY = padTop + innerH - (aRatio * innerH);

      // Safe clamp inside chart box to prevent any coordinate overflow
      const vY = Math.max(padTop, Math.min(bottomY, rawVY));
      const aY = Math.max(padTop, Math.min(bottomY, rawAY));

      vPts.push({ x, y: vY });
      aPts.push({ x, y: aY });
    });

    return { viewsPoints: vPts, actionsPoints: aPts };
  }, [trends, chartMaxVal, scaleMode, metricFocus]);

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

  // Product count by type for badges
  const fallbackProductTypeCounts = useMemo(() => {
    const list = analyticsData?.top_products || [];
    const counts: Record<string, number> = { all: list.length };
    list.forEach(p => {
      const t = p.product_type || 'physical';
      counts[t] = (counts[t] || 0) + 1;
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

  // Filtered and sorted products (used for local fallback when server-side data is loading or offline)
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
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedProducts = useMemo(() => {
    if (isUsingServerData) {
      return serverProducts;
    }
    return filteredProducts.slice(startIndex, endIndex);
  }, [isUsingServerData, serverProducts, filteredProducts, startIndex, endIndex]);

  // Dynamic label for product actions based on type
  const getActionTypeLabel = (pType?: string) => {
    switch (pType) {
      case 'service':
        return 'Booking / Konsultasi WA';
      case 'property':
        return 'Janji Survey WA';
      case 'digital':
        return 'Akses / Lisensi';
      case 'food':
        return 'Pesan Antar WA';
      case 'fauna':
        return 'Adopsi / Chat WA';
      default:
        return 'Pemesanan WA';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }} className="animate-fade-in">
      
      {/* 1. Header & Timeframe Controls Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '1.1rem 1.15rem',
          borderRadius: '0.85rem',
          border: '1px solid var(--border-light)',
          background: 'var(--card-bg-gradient)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--primary-glow)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-light)',
                flexShrink: 0
              }}
            >
              <BarChart3 size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Analitika & Konversi Multi-Katalog
              </h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Performa katalog <strong style={{ color: 'var(--text-primary)' }}>{storeTitle || 'Catavor'}</strong> • Semua Tipe Bisnis
              </span>
            </div>
          </div>

          {/* Bot Defense Shield Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.65rem',
              borderRadius: '999px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#10b981',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
              alignSelf: 'flex-start'
            }}
          >
            <ShieldCheck size={13} style={{ flexShrink: 0 }} />
            <span>Anti-Bot Aktif: Data Kunjungan Asli & Akurat</span>
          </div>
        </div>

        {/* Period Selector & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--bg-deep)', padding: '0.2rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
            {(['7d', '30d', '90d'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => onPeriodChange(p)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: period === p ? 700 : 500,
                  borderRadius: '0.4rem',
                  border: 'none',
                  backgroundColor: period === p ? 'var(--primary)' : 'transparent',
                  color: period === p ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
              >
                {p === '7d' ? '7 Hari' : p === '30d' ? '30 Hari' : '90 Hari'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => setShowMarketIntel(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.4rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '0.5rem',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                cursor: 'pointer'
              }}
            >
              <Globe size={13} />
              <span>Tren Pasar</span>
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.4rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Segarkan</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Summary Grid (4 Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
        
        {/* Total Kunjungan Toko */}
        <div
          className="glass-panel"
          style={{
            padding: '0.9rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Kunjungan Katalog</span>
            <div style={{ width: '24px', height: '24px', borderRadius: '0.4rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={14} />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {storeViews.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
            Rata-rata {avgViewsPerDay}/hari
          </span>
        </div>

        {/* Total Eksplorasi Produk */}
        <div
          className="glass-panel"
          style={{
            padding: '0.9rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Tayangan Produk</span>
            <div style={{ width: '24px', height: '24px', borderRadius: '0.4rem', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Eye size={14} />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {productViews.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
            ~{viewsPerVisitor} item per pengunjung
          </span>
        </div>

        {/* Total Aksi & Leads (WA + Marketplace + Rekber) */}
        <div
          className="glass-panel"
          style={{
            padding: '0.9rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Peminat & Aksi</span>
            <div style={{ width: '24px', height: '24px', borderRadius: '0.4rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={14} />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#10b981', letterSpacing: '-0.02em' }}>
            {totalActions.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
            WA, Rekber & Marketplace
          </span>
        </div>

        {/* Rasio Konversi Keseluruhan */}
        <div
          className="glass-panel"
          style={{
            padding: '0.9rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Rasio Konversi</span>
            <div style={{ width: '24px', height: '24px', borderRadius: '0.4rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={14} />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
            {conversionRate.toFixed(1)}%
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
            {conversionRate >= 5 ? 'Tingkat Tinggi' : conversionRate >= 2 ? 'Standar Sehat' : 'Peluang Optimasi'}
          </span>
        </div>
      </div>

      {/* 3. Multi-Channel Conversion Distribution Cards */}
      <div
        className="glass-panel"
        style={{
          padding: '1rem 1.15rem',
          borderRadius: '0.85rem',
          border: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-card)'
        }}
      >
        <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.85rem 0' }}>
          Distribusi Kanal Konversi Pembeli
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
          {/* Direct WA */}
          <div style={{ padding: '0.75rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', marginBottom: '0.25rem' }}>
              <MessageCircle size={14} />
              <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>WhatsApp Langsung</span>
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {directWa} <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-secondary)' }}>chat</span>
            </div>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>Order, booking & survey</span>
          </div>

          {/* Marketplace */}
          <div style={{ padding: '0.75rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f97316', marginBottom: '0.25rem' }}>
              <ShoppingBag size={14} />
              <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Marketplace Pihak ke-3</span>
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {marketplaceClicks} <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-secondary)' }}>klik</span>
            </div>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>Global marketplace</span>
          </div>

          {/* Rekber Syariah */}
          <div style={{ padding: '0.75rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#3b82f6', marginBottom: '0.25rem' }}>
              <ShieldCheck size={14} />
              <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Rekber Syariah</span>
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {rekberClicks} <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-secondary)' }}>peminat</span>
            </div>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>Escrow & transaksi bernilai</span>
          </div>

          {/* Video Engagement */}
          <div style={{ padding: '0.75rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#a855f7', marginBottom: '0.25rem' }}>
              <Video size={14} />
              <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Video / Tour Clicks</span>
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {videoViews} <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-secondary)' }}>tonton</span>
            </div>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>Virtual tour & demo produk</span>
          </div>
        </div>
      </div>

      {/* 4. Daily Trends Chart (Mobile Proportions with Disparity Handling) */}
      <div
        className="glass-panel"
        style={{
          padding: '0.9rem 1rem 0.65rem',
          borderRadius: '0.85rem',
          border: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-card)'
        }}
      >
        {/* Header Row: Title & View/Scale Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            Tren Harian
            {peakInfo.isDisparityHigh && (
              <span style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 700 }}>
                Spike
              </span>
            )}
          </h3>

          {/* Controls: Scale mode & Chart Type */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {/* Scale mode toggle */}
            <button
              type="button"
              onClick={() => setScaleMode(scaleMode === 'linear' ? 'adaptive' : 'linear')}
              title={scaleMode === 'linear' ? 'Aktifkan Skala Adaptif untuk menyeimbangkan spike' : 'Kembali ke Skala Linier'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                padding: '0.2rem 0.45rem',
                fontSize: '0.62rem',
                fontWeight: 700,
                borderRadius: '0.35rem',
                border: scaleMode === 'adaptive' ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-light)',
                backgroundColor: scaleMode === 'adaptive' ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-deep)',
                color: scaleMode === 'adaptive' ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
            >
              <Activity size={10} />
              <span>{scaleMode === 'adaptive' ? 'Adaptif' : 'Linier'}</span>
            </button>

            {/* Chart View Toggle: Line/Area vs Bar */}
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-deep)', padding: '0.12rem', borderRadius: '0.4rem', border: '1px solid var(--border-light)' }}>
              <button
                type="button"
                onClick={() => setChartType('area')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  padding: '0.2rem 0.45rem',
                  fontSize: '0.62rem',
                  fontWeight: chartType === 'area' ? 700 : 500,
                  borderRadius: '0.25rem',
                  border: 'none',
                  backgroundColor: chartType === 'area' ? 'var(--primary)' : 'transparent',
                  color: chartType === 'area' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
              >
                <TrendingUp size={10} />
                <span>Garis</span>
              </button>
              <button
                type="button"
                onClick={() => setChartType('bar')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  padding: '0.2rem 0.45rem',
                  fontSize: '0.62rem',
                  fontWeight: chartType === 'bar' ? 700 : 500,
                  borderRadius: '0.25rem',
                  border: 'none',
                  backgroundColor: chartType === 'bar' ? 'var(--primary)' : 'transparent',
                  color: chartType === 'bar' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
              >
                <BarChart3 size={10} />
                <span>Batang</span>
              </button>
            </div>
          </div>
        </div>

        {/* Metric Focus & Legend Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.35rem' }}>
          {/* Metric Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <button
              type="button"
              onClick={() => setMetricFocus('all')}
              style={{
                padding: '0.15rem 0.4rem',
                fontSize: '0.62rem',
                fontWeight: metricFocus === 'all' ? 700 : 500,
                borderRadius: '0.25rem',
                border: 'none',
                backgroundColor: metricFocus === 'all' ? 'var(--bg-deep)' : 'transparent',
                color: metricFocus === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setMetricFocus('views')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.15rem 0.4rem',
                fontSize: '0.62rem',
                fontWeight: metricFocus === 'views' ? 700 : 500,
                borderRadius: '0.25rem',
                border: 'none',
                backgroundColor: metricFocus === 'views' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                color: metricFocus === 'views' ? '#3b82f6' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
              Kunjungan
            </button>
            <button
              type="button"
              onClick={() => setMetricFocus('actions')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.15rem 0.4rem',
                fontSize: '0.62rem',
                fontWeight: metricFocus === 'actions' ? 700 : 500,
                borderRadius: '0.25rem',
                border: 'none',
                backgroundColor: metricFocus === 'actions' ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                color: metricFocus === 'actions' ? '#10b981' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              Aksi
            </button>
          </div>

          {/* Inline Active Day Metric Pill */}
          {trends.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, fontSize: '0.62rem', color: 'var(--text-primary)', backgroundColor: 'var(--bg-deep)', padding: '0.12rem 0.4rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)' }}>
              {(metricFocus === 'all' || metricFocus === 'views') && (
                <span style={{ color: '#3b82f6' }}>
                  {(hoveredPointIndex !== null ? trends[hoveredPointIndex]?.store_views : trends[trends.length - 1]?.store_views) || 0} Kunjungan
                </span>
              )}
              {metricFocus === 'all' && <span style={{ color: 'var(--border-light)' }}>•</span>}
              {(metricFocus === 'all' || metricFocus === 'actions') && (
                <span style={{ color: '#10b981' }}>
                  {(hoveredPointIndex !== null ? (trends[hoveredPointIndex]?.total_actions ?? trends[hoveredPointIndex]?.wa_clicks) : (trends[trends.length - 1]?.total_actions ?? trends[trends.length - 1]?.wa_clicks)) || 0} Aksi
                </span>
              )}
            </div>
          )}
        </div>

        {/* Spike / Disparity Intelligent Notification Banner */}
        {peakInfo.isDisparityHigh && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.4rem',
              padding: '0.35rem 0.6rem',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              marginBottom: '0.5rem',
              fontSize: '0.65rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-primary)' }}>
              <Sparkles size={11} style={{ color: '#3b82f6', flexShrink: 0 }} />
              <span>
                Puncak tertinggi <strong>{peakInfo.peakVal}</strong> ({peakInfo.peakRatio.toFixed(1)}x rata-rata).
              </span>
            </div>
            <button
              type="button"
              onClick={() => setScaleMode(scaleMode === 'linear' ? 'adaptive' : 'linear')}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--primary)',
                fontWeight: 700,
                fontSize: '0.65rem',
                cursor: 'pointer',
                padding: '0 0.2rem',
                textDecoration: 'underline',
                whiteSpace: 'nowrap'
              }}
            >
              {scaleMode === 'linear' ? 'Skala Adaptif' : 'Skala Normal'}
            </button>
          </div>
        )}

        {/* Standard Mobile Chart Container */}
        <div style={{ position: 'relative', width: '100%', height: '140px', minHeight: '140px' }}>
          {chartType === 'area' ? (
            /* Compact SVG Area & Curve Line Chart for Mobile */
            <svg
              viewBox={`0 0 340 120`}
              style={{ width: '100%', height: '100%', overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="viewsGradientMobile" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="actionsGradientMobile" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <filter id="glowLineMobile" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#3b82f6" floodOpacity="0.3" />
                </filter>
              </defs>

              {/* Grid Lines & Y-Axis Labels */}
              {yGridTicks.map(tick => {
                const yPos = 10 + 82 - (getNormalizedRatio(tick) * 82);
                const isBase = tick === 0;
                return (
                  <g key={tick}>
                    <line
                      x1={20}
                      y1={yPos}
                      x2={326}
                      y2={yPos}
                      stroke={isBase ? 'var(--border-light)' : 'var(--border-light)'}
                      strokeDasharray={isBase ? 'none' : '3 3'}
                      strokeWidth={isBase ? 1.2 : 0.8}
                      strokeOpacity={isBase ? 0.85 : 0.5}
                    />
                    <text
                      x={16}
                      y={yPos + 3}
                      textAnchor="end"
                      fontSize="8"
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
                  {(metricFocus === 'all' || metricFocus === 'views') && (
                    <path
                      d={getAreaPath(viewsPoints, 92)}
                      fill="url(#viewsGradientMobile)"
                    />
                  )}
                  {(metricFocus === 'all' || metricFocus === 'actions') && (
                    <path
                      d={getAreaPath(actionsPoints, 92)}
                      fill="url(#actionsGradientMobile)"
                    />
                  )}
                  
                  {/* Lines */}
                  {(metricFocus === 'all' || metricFocus === 'views') && (
                    <path
                      d={getBezierPath(viewsPoints)}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#glowLineMobile)"
                    />
                  )}
                  {(metricFocus === 'all' || metricFocus === 'actions') && (
                    <path
                      d={getBezierPath(actionsPoints)}
                      fill="none"
                      stroke="#059669"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </>
              )}

              {/* Data Points & Touch Targets */}
              {trends.map((t, idx) => {
                const ptV = viewsPoints[idx];
                const ptA = actionsPoints[idx];
                const isHovered = hoveredPointIndex === idx;
                const isLatest = idx === trends.length - 1;
                const isPeak = peakInfo.isDisparityHigh && peakInfo.peakIndex === idx;
                if (!ptV || !ptA) return null;

                const showDateLabel = period === '7d' || (period === '30d' && idx % 5 === 0) || (period === '90d' && idx % 15 === 0) || isLatest;
                const labelAnchor = idx === 0 ? 'start' : isLatest ? 'end' : 'middle';

                return (
                  <g key={t.date}>
                    {/* Hover vertical reference line */}
                    {isHovered && (
                      <line
                        x1={ptV.x}
                        y1={10}
                        x2={ptV.x}
                        y2={92}
                        stroke="var(--primary)"
                        strokeDasharray="2 2"
                        strokeWidth="1.2"
                        strokeOpacity={0.8}
                      />
                    )}

                    {/* Peak Beacon Halo (Mobile) */}
                    {isPeak && (
                      <circle
                        cx={ptV.x}
                        cy={ptV.y}
                        r="8"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1.2"
                        strokeDasharray="2 2"
                        opacity="0.9"
                      />
                    )}

                    {/* Point circles */}
                    {(metricFocus === 'all' || metricFocus === 'views') && (
                      <circle
                        cx={ptV.x}
                        cy={ptV.y}
                        r={isHovered ? 5 : isPeak ? 4.5 : 3}
                        fill={isPeak ? '#f59e0b' : '#3b82f6'}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    )}
                    {(metricFocus === 'all' || metricFocus === 'actions') && (
                      <circle
                        cx={ptA.x}
                        cy={ptA.y}
                        r={isHovered ? 5 : 3}
                        fill="#10b981"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    )}

                    {/* X-Axis Date Label */}
                    {showDateLabel && (
                      <text
                        x={ptV.x}
                        y={110}
                        textAnchor={labelAnchor}
                        fontSize="8.5"
                        fill={isHovered ? 'var(--primary)' : isLatest ? 'var(--text-primary)' : 'var(--text-secondary)'}
                        fontWeight={isLatest || isHovered ? '700' : '500'}
                        fontFamily="inherit"
                      >
                        {formatMobileChartDate(t.date, period)}
                      </text>
                    )}

                    {/* Transparent touch/click trigger area */}
                    <rect
                      x={ptV.x - (306 / Math.max(1, trends.length)) / 2}
                      y={0}
                      width={306 / Math.max(1, trends.length)}
                      height={120}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredPointIndex(idx)}
                      onMouseLeave={() => setHoveredPointIndex(null)}
                      onClick={() => setHoveredPointIndex(hoveredPointIndex === idx ? null : idx)}
                    />
                  </g>
                );
              })}
            </svg>
          ) : (
            /* Bar Chart Visualization for Mobile */
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Background Grid Lines */}
              <div style={{ position: 'absolute', top: '10px', left: '24px', right: '10px', bottom: '24px', pointerEvents: 'none' }}>
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
                      <span style={{ position: 'absolute', right: '100%', marginRight: '5px', fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-secondary)', transform: 'translateY(50%)' }}>
                        {formatCompactNumber(tick)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Bars Row */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.25rem', height: 'calc(100% - 24px)', paddingLeft: '24px', paddingRight: '10px' }}>
                {trends.map((t, idx) => {
                  const vHeight = t.store_views > 0
                    ? Math.max(3, Math.min(85, Math.round(getNormalizedRatio(t.store_views) * 85)))
                    : 0;
                  const actCount = t.total_actions ?? t.wa_clicks ?? 0;
                  const aHeight = actCount > 0
                    ? Math.max(3, Math.min(85, Math.round(getNormalizedRatio(actCount) * 85)))
                    : 0;
                  const isHovered = hoveredPointIndex === idx;
                  const isPeak = peakInfo.isDisparityHigh && peakInfo.peakIndex === idx;

                  return (
                    <div
                      key={t.date}
                      onMouseEnter={() => setHoveredPointIndex(idx)}
                      onMouseLeave={() => setHoveredPointIndex(null)}
                      onClick={() => setHoveredPointIndex(hoveredPointIndex === idx ? null : idx)}
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
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', width: '100%', justifyContent: 'center' }}>
                        {/* Views Bar */}
                        {(metricFocus === 'all' || metricFocus === 'views') && (
                          <div
                            style={{
                              width: metricFocus === 'all' ? '45%' : '80%',
                              maxWidth: '14px',
                              height: `${vHeight}px`,
                              background: isPeak
                                ? 'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)'
                                : isHovered
                                  ? 'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)'
                                  : 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)',
                              borderRadius: '3px 3px 0 0',
                              transition: 'height 0.25s ease'
                            }}
                          />
                        )}
                        {/* Actions Bar */}
                        {(metricFocus === 'all' || metricFocus === 'actions') && (
                          <div
                            style={{
                              width: metricFocus === 'all' ? '45%' : '80%',
                              maxWidth: '14px',
                              height: `${aHeight}px`,
                              background: isHovered ? 'linear-gradient(180deg, #34d399 0%, #059669 100%)' : 'linear-gradient(180deg, #10b981 0%, #047857 100%)',
                              borderRadius: '3px 3px 0 0',
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
              <div style={{ display: 'flex', paddingLeft: '24px', paddingRight: '10px', height: '22px', alignItems: 'center' }}>
                {trends.map((t, idx) => {
                  const isLatest = idx === trends.length - 1;
                  const showDateLabel = period === '7d' || (period === '30d' && idx % 5 === 0) || (period === '90d' && idx % 15 === 0) || isLatest;
                  const isHovered = hoveredPointIndex === idx;

                  return (
                    <div key={t.date} style={{ flex: 1, textAlign: idx === 0 ? 'left' : isLatest ? 'right' : 'center' }}>
                      {showDateLabel && (
                        <span style={{ fontSize: '0.62rem', color: isHovered ? 'var(--primary)' : isLatest ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isLatest || isHovered ? 700 : 500, whiteSpace: 'nowrap' }}>
                          {formatMobileChartDate(t.date, period)}
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
                top: '5px',
                left: `${Math.min(75, Math.max(25, ((hoveredPointIndex + 0.5) / Math.max(1, trends.length)) * 100))}%`,
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(15, 23, 42, 0.96)',
                color: '#ffffff',
                padding: '0.45rem 0.7rem',
                borderRadius: '0.5rem',
                fontSize: '0.7rem',
                zIndex: 30,
                boxShadow: '0 6px 16px -3px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.15)',
                pointerEvents: 'none',
                backdropFilter: 'blur(8px)',
                minWidth: '150px'
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: '0.2rem', color: '#f8fafc', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '0.15rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{formatDetailedDate(trends[hoveredPointIndex].date)}</span>
                {peakInfo.isDisparityHigh && peakInfo.peakIndex === hoveredPointIndex && (
                  <span style={{ fontSize: '0.58rem', padding: '0.1rem 0.3rem', borderRadius: '3px', backgroundColor: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24', fontWeight: 700 }}>
                    Puncak
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', margin: '0.15rem 0' }}>
                <span style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                  Kunjungan:
                </span>
                <strong style={{ color: '#60a5fa', fontSize: '0.78rem' }}>{trends[hoveredPointIndex].store_views}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', margin: '0.15rem 0' }}>
                <span style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  Total Aksi:
                </span>
                <strong style={{ color: '#34d399', fontSize: '0.78rem' }}>{trends[hoveredPointIndex].total_actions ?? trends[hoveredPointIndex].wa_clicks ?? 0}</strong>
              </div>
              {trends[hoveredPointIndex].store_views > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', margin: '0.15rem 0', paddingTop: '0.15rem', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.62rem' }}>Konversi Harian:</span>
                  <strong style={{ color: '#f59e0b', fontSize: '0.68rem' }}>
                    {(((trends[hoveredPointIndex].total_actions ?? trends[hoveredPointIndex].wa_clicks ?? 0) / trends[hoveredPointIndex].store_views) * 100).toFixed(1)}%
                  </strong>
                </div>
              )}
            </div>
          )}

          {/* Zero Data Indicator Watermark (when total store views in selected period is 0) */}
          {storeViews === 0 && (
            <div
              style={{
                position: 'absolute',
                top: '40%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: 'var(--bg-deep)',
                border: '1px solid var(--border-light)',
                padding: '0.45rem 0.9rem',
                borderRadius: '20px',
                pointerEvents: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 10,
                maxWidth: '90%',
                textAlign: 'center'
              }}
            >
              <TrendingUp size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Menunggu Kunjungan Pertama • Bagikan link katalog Anda
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 5. Product Type Filter Tabs & Top Performing Products */}
      <div
        className="glass-panel"
        style={{
          padding: '1.1rem 1.15rem',
          borderRadius: '0.85rem',
          border: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem' }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Performa Item per Tipe Katalog
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              {totalItems} item ditemukan • Urutkan dan telusuri konversi aksi
            </span>
          </div>

          {/* Search & Sort Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
            {/* Search Box */}
            <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Cari nama, kelas..."
                value={productSearch}
                onChange={e => {
                  setProductSearch(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '0.42rem 1.8rem 0.42rem 2rem',
                  fontSize: '0.75rem',
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
                  onClick={() => {
                    setProductSearch('');
                    setCurrentPage(1);
                  }}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Standard Dropdown Modal Trigger Button */}
            <button
              type="button"
              onClick={() => setShowSortModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.42rem 0.75rem',
                fontSize: '0.72rem',
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
              <ArrowUpDown size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span>{sortOptions.find(o => o.id === productSort)?.label || 'Terbanyak Dilihat'}</span>
              <ChevronDown size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            </button>
          </div>
        </div>

        {/* Product Type Switcher Pills - only shown if store has multiple catalog types */}
        {distinctTypesCount > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              overflowX: 'auto',
              paddingBottom: '0.35rem',
              scrollbarWidth: 'none'
            }}
          >
            {productTypeTabs
              .filter(tab => tab.key === 'all' || (productTypeCounts[tab.key] ?? 0) > 0)
              .map(tab => {
                const TabIcon = tab.icon;
                const isSelected = selectedProductType === tab.key;
                const count = productTypeCounts[tab.key] ?? 0;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setSelectedProductType(tab.key);
                      setCurrentPage(1);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.7rem',
                      fontSize: '0.72rem',
                      fontWeight: isSelected ? 700 : 500,
                      borderRadius: '20px',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                      backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-deep)',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'var(--transition-fast)'
                    }}
                  >
                    <TabIcon size={13} />
                    <span>{tab.label}</span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        padding: '0.05rem 0.35rem',
                        borderRadius: '10px',
                        backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--bg-card)',
                        color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                        fontWeight: 700
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
          </div>
        )}

        {/* Top Products Table / Card List */}
        {filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
            <PackageSearch size={28} style={{ opacity: 0.4 }} />
            <span>Tidak ada produk yang cocok dengan pencarian atau filter ini.</span>
            {(productSearch || selectedProductType !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setProductSearch('');
                  setSelectedProductType('all');
                  setCurrentPage(1);
                }}
                style={{
                  padding: '0.3rem 0.75rem',
                  fontSize: '0.72rem',
                  borderRadius: '0.45rem',
                  border: '1px solid var(--primary)',
                  backgroundColor: 'var(--primary-glow)',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Reset Filter
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {paginatedProducts.map((prod, index) => {
              const globalIndex = startIndex + index;
              const itemActions = prod.total_actions_count ?? prod.wa_clicks_count ?? 0;
              const ctr = prod.conversion_rate_percent ?? 0;

              return (
                <div
                  key={prod.id}
                  onClick={() => onViewProduct?.(prod.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.55rem',
                    padding: '0.8rem 0.95rem',
                    borderRadius: '0.75rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    cursor: onViewProduct ? 'pointer' : 'default',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  {/* Top Section: Rank, Image, Title & Conversion Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                      {/* Rank Badge */}
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          backgroundColor: globalIndex < 3 ? 'var(--primary-glow)' : 'var(--bg-card)',
                          color: globalIndex < 3 ? 'var(--primary)' : 'var(--text-secondary)',
                          border: '1px solid var(--border-light)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          flexShrink: 0
                        }}
                      >
                        #{globalIndex + 1}
                      </div>

                      {/* Thumbnail */}
                      {prod.image_url ? (
                        <img
                          src={prod.image_url}
                          alt={prod.name}
                          style={{ width: '38px', height: '38px', borderRadius: '0.45rem', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-light)' }}
                        />
                      ) : (
                        <div style={{ width: '38px', height: '38px', borderRadius: '0.45rem', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0, border: '1px solid var(--border-light)' }}>
                          <ShoppingBag size={16} />
                        </div>
                      )}

                      {/* Title & Price */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prod.name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>
                          {formatPrice(prod.price)}
                        </span>
                      </div>
                    </div>

                    {/* Conversion Badge */}
                    <div style={{ flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          color: ctr >= 5 ? '#10b981' : ctr >= 2 ? 'var(--primary)' : '#f59e0b',
                          backgroundColor: ctr >= 5 ? 'rgba(16, 185, 129, 0.12)' : ctr >= 2 ? 'var(--primary-glow)' : 'rgba(245, 158, 11, 0.12)',
                          border: ctr >= 5 ? '1px solid rgba(16, 185, 129, 0.3)' : ctr >= 2 ? '1px solid var(--border-light)' : '1px solid rgba(245, 158, 11, 0.3)',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '20px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <Target size={11} />
                        <span>{ctr.toFixed(1)}%</span>
                      </span>
                    </div>
                  </div>

                  {/* Bottom Section: Category Tag + Metrics Stats */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', flexWrap: 'wrap', paddingTop: '0.4rem', borderTop: '1px solid var(--border-light)' }}>
                    {/* Category badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {prod.class ? (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            color: 'var(--text-secondary)',
                            backgroundColor: 'var(--bg-card)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '5px',
                            border: '1px solid var(--border-light)',
                            fontWeight: 500
                          }}
                        >
                          {prod.class}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Umum</span>
                      )}
                    </div>

                    {/* Metrics: Views & Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)', padding: '0.15rem 0.45rem', borderRadius: '5px', border: '1px solid var(--border-light)' }}>
                        <Eye size={11} style={{ color: '#3b82f6' }} />
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{prod.view_count.toLocaleString()}</span>
                        <span>views</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)', padding: '0.15rem 0.45rem', borderRadius: '5px', border: '1px solid var(--border-light)' }}>
                        <Zap size={11} style={{ color: '#10b981' }} />
                        <span style={{ fontWeight: 700, color: '#10b981' }}>{itemActions.toLocaleString()}</span>
                        <span>aksi</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Pagination Controls */}
            {totalItems > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.65rem',
                  paddingTop: '0.65rem',
                  borderTop: '1px solid var(--border-light)',
                  marginTop: '0.25rem'
                }}
              >
                {/* Page Info & Page Size */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  <span>
                    {startIndex + 1}–{endIndex} dari {totalItems}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    {[10, 25, 50].map(sz => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => {
                          setPageSize(sz);
                          setCurrentPage(1);
                        }}
                        style={{
                          padding: '0.15rem 0.4rem',
                          fontSize: '0.68rem',
                          fontWeight: pageSize === sz ? 700 : 500,
                          borderRadius: '4px',
                          border: pageSize === sz ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                          backgroundColor: pageSize === sz ? 'var(--primary-glow)' : 'var(--bg-deep)',
                          color: pageSize === sz ? 'var(--primary)' : 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Page Navigation Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={validCurrentPage <= 1}
                    style={{
                      padding: '0.3rem',
                      borderRadius: '0.35rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-deep)',
                      color: validCurrentPage <= 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
                      cursor: validCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                      opacity: validCurrentPage <= 1 ? 0.4 : 1,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Halaman Pertama"
                  >
                    <ChevronsLeft size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={validCurrentPage <= 1}
                    style={{
                      padding: '0.3rem',
                      borderRadius: '0.35rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-deep)',
                      color: validCurrentPage <= 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
                      cursor: validCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                      opacity: validCurrentPage <= 1 ? 0.4 : 1,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Sebelumnya"
                  >
                    <ChevronLeft size={13} />
                  </button>

                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)', padding: '0 0.35rem' }}>
                    Hal {validCurrentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={validCurrentPage >= totalPages}
                    style={{
                      padding: '0.3rem',
                      borderRadius: '0.35rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-deep)',
                      color: validCurrentPage >= totalPages ? 'var(--text-secondary)' : 'var(--text-primary)',
                      cursor: validCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                      opacity: validCurrentPage >= totalPages ? 0.4 : 1,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Berikutnya"
                  >
                    <ChevronRight size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={validCurrentPage >= totalPages}
                    style={{
                      padding: '0.3rem',
                      borderRadius: '0.35rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-deep)',
                      color: validCurrentPage >= totalPages ? 'var(--text-secondary)' : 'var(--text-primary)',
                      cursor: validCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                      opacity: validCurrentPage >= totalPages ? 0.4 : 1,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Halaman Terakhir"
                  >
                    <ChevronsRight size={13} />
                  </button>
                </div>
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
            padding: '1.1rem 1.15rem',
            borderRadius: '0.85rem',
            border: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Lightbulb size={16} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Wawasan & Rekomendasi Pintar
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {analyticsData.insights.map((ins, i) => (
              <div
                key={i}
                style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: '0.65rem',
                  backgroundColor: ins.type === 'success' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-deep)',
                  border: ins.type === 'success' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem'
                }}
              >
                {ins.type === 'success' ? (
                  <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                ) : (
                  <AlertCircle size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                )}
                <div>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.15rem 0' }}>
                    {ins.title}
                  </h4>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    {ins.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LUXURY MOBILE BOTTOM SHEET: SORT OPTIONS MODAL PICKER */}
      {showSortModal && (
        <div 
          className="bottom-sheet-backdrop" 
          style={{ zIndex: 11000 }}
          onClick={() => {
            setShowSortModal(false);
            setSheetDragY(0);
          }}
        >
          <div 
            className="bottom-sheet-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translateY(${Math.max(0, sheetDragY)}px)`,
              transition: isSheetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Smooth Drag Handle Area (Touch & Mouse Drag to Dismiss) */}
            <div 
              className="bottom-sheet-handle-bar"
              onTouchStart={(e) => handleSheetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleSheetDragMove(e.touches[0].clientY)}
              onTouchEnd={handleSheetDragEnd}
              onMouseDown={(e) => handleSheetDragStart(e.clientY)}
              onMouseMove={(e) => handleSheetDragMove(e.clientY)}
              onMouseUp={handleSheetDragEnd}
            >
              <div className="bottom-sheet-handle" />
            </div>

            {/* Header with Drag Listeners */}
            <div 
              className="bottom-sheet-header"
              onTouchStart={(e) => handleSheetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleSheetDragMove(e.touches[0].clientY)}
              onTouchEnd={handleSheetDragEnd}
              onMouseDown={(e) => handleSheetDragStart(e.clientY)}
              onMouseMove={(e) => handleSheetDragMove(e.clientY)}
              onMouseUp={handleSheetDragEnd}
            >
              <div className="bottom-sheet-title-box">
                <ArrowUpDown size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <h3 className="bottom-sheet-title">Urutkan Performa Item</h3>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="bottom-sheet-scrollable-body" style={{ maxHeight: '60vh' }}>
              {sortOptions.map((opt) => {
                const isSelected = productSort === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`bottom-sheet-item ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      setProductSort(opt.id as any);
                      setCurrentPage(1);
                      setShowSortModal(false);
                      setSheetDragY(0);
                    }}
                  >
                    <div className="bottom-sheet-item-left">
                      <div className="bottom-sheet-item-col">
                        <span className="bottom-sheet-item-name">
                          {opt.label}
                        </span>
                        {opt.desc && (
                          <span className="bottom-sheet-item-desc">{opt.desc}</span>
                        )}
                      </div>
                    </div>
                    <div className={`bottom-sheet-radio ${isSelected ? 'selected' : ''}`}>
                      {isSelected && (
                        <Check size={12} strokeWidth={3.5} style={{ display: 'block', margin: 'auto' }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
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
