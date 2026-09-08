import React, { useState, useMemo, useEffect } from 'react';
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
  AlertCircle
} from 'lucide-react';

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
  const [selectedProductType, setSelectedProductType] = useState<string>('all');
  const [productSort, setProductSort] = useState<'views' | 'actions' | 'ctr' | 'price'>('views');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

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

  const avgViewsPerDay = (storeViews / daysCount).toFixed(1);
  const avgActionsPerDay = (totalActions / daysCount).toFixed(1);
  const viewsPerVisitor = storeViews > 0 ? (productViews / storeViews).toFixed(1) : '0';

  // Trends calculation
  const trends = analyticsData?.trends || [];
  
  // Calculate dynamic max scale with clean step for optimal visual balance
  const chartMaxVal = useMemo(() => {
    if (!trends.length) return 2;
    const maxVal = Math.max(...trends.map(t => Math.max(t.store_views || 0, (t.total_actions || t.wa_clicks || 0))));
    if (maxVal <= 0) return 2;
    if (maxVal === 1) return 2;
    if (maxVal === 2) return 3;
    if (maxVal <= 4) return 5;
    if (maxVal <= 8) return 10;
    if (maxVal <= 15) return 20;
    if (maxVal <= 30) return 40;
    if (maxVal <= 60) return 80;
    if (maxVal <= 100) return 120;
    return Math.ceil(maxVal * 1.25);
  }, [trends]);

  // Y-Axis reference grid ticks with clean integer levels
  const yGridTicks = useMemo(() => {
    if (chartMaxVal === 2) return [0, 1, 2];
    if (chartMaxVal === 3) return [0, 1, 2, 3];
    if (chartMaxVal === 4) return [0, 2, 4];
    if (chartMaxVal === 5) return [0, 1, 2, 3, 4, 5];
    if (chartMaxVal <= 10) return [0, Math.round(chartMaxVal / 2), chartMaxVal];
    return [
      0,
      Math.round(chartMaxVal * 0.33),
      Math.round(chartMaxVal * 0.66),
      chartMaxVal
    ];
  }, [chartMaxVal]);

  // Point coordinates for SVG Area / Line chart (840x280)
  const { viewsPoints, actionsPoints } = useMemo(() => {
    const vPts: { x: number; y: number }[] = [];
    const aPts: { x: number; y: number }[] = [];
    const N = trends.length;
    if (N === 0) return { viewsPoints: vPts, actionsPoints: aPts };

    const padLeft = 45;
    const innerW = 750;
    const padTop = 25;
    const innerH = 190;

    trends.forEach((t, i) => {
      const x = N === 1 ? padLeft + innerW / 2 : padLeft + (i / (N - 1)) * innerW;
      const vY = padTop + innerH - ((t.store_views / chartMaxVal) * innerH);
      const act = t.total_actions ?? t.wa_clicks ?? 0;
      const aY = padTop + innerH - ((act / chartMaxVal) * innerH);

      vPts.push({ x, y: vY });
      aPts.push({ x, y: aY });
    });

    return { viewsPoints: vPts, actionsPoints: aPts };
  }, [trends, chartMaxVal]);

  // Cubic Bezier Spline Path Generator
  const getBezierPath = (points: { x: number; y: number }[]): string => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
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

  // Filtered and sorted products
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
      if (productSort === 'price') return (b.price || 0) - (a.price || 0);
      return 0;
    });

    return res;
  }, [analyticsData?.top_products, selectedProductType, productSearch, productSort]);

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
                Performa toko <strong style={{ color: 'var(--text-primary)' }}>{storeTitle || 'Catavor'}</strong> • Terpadu Seluruh Model Bisnis
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
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Kunjungan Toko</span>
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
            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Shopee, Tokopedia, Fastwork, Lynk.id</span>
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
          padding: '1.25rem 1.5rem',
          borderRadius: '0.85rem',
          border: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-card)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Tren Kunjungan & Aksi Harian
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {period === '7d' ? '7 hari terakhir' : period === '30d' ? '30 hari terakhir' : '90 hari terakhir'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            {/* Chart View Toggle: Line/Area vs Bar */}
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-deep)', padding: '0.2rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
              <button
                type="button"
                onClick={() => setChartType('area')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: chartType === 'area' ? 700 : 500,
                  borderRadius: '0.35rem',
                  border: 'none',
                  backgroundColor: chartType === 'area' ? 'var(--primary)' : 'transparent',
                  color: chartType === 'area' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
              >
                <TrendingUp size={13} />
                <span>Garis Area</span>
              </button>
              <button
                type="button"
                onClick={() => setChartType('bar')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: chartType === 'bar' ? 700 : 500,
                  borderRadius: '0.35rem',
                  border: 'none',
                  backgroundColor: chartType === 'bar' ? 'var(--primary)' : 'transparent',
                  color: chartType === 'bar' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
              >
                <BarChart3 size={13} />
                <span>Batang</span>
              </button>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.78rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Kunjungan Toko</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Total Aksi / Leads</span>
              </div>
            </div>
          </div>
        </div>

        {/* Active / Hovered Day Live Metric Summary Bar */}
        {trends.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-deep)',
            border: '1px solid var(--border-light)',
            borderRadius: '0.65rem',
            padding: '0.55rem 0.9rem',
            marginBottom: '1rem',
            fontSize: '0.8rem',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'inline-block' }} />
              <span>
                {hoveredPointIndex !== null && trends[hoveredPointIndex]
                  ? formatDetailedDate(trends[hoveredPointIndex].date)
                  : `Ringkasan Terkini: ${formatDetailedDate(trends[trends.length - 1].date)}`}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontWeight: 800 }}>
              <span style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Eye size={14} />
                <span>
                  {(hoveredPointIndex !== null ? trends[hoveredPointIndex]?.store_views : trends[trends.length - 1]?.store_views) || 0} Kunjungan
                </span>
              </span>
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Zap size={14} />
                <span>
                  {(hoveredPointIndex !== null ? (trends[hoveredPointIndex]?.total_actions ?? trends[hoveredPointIndex]?.wa_clicks) : (trends[trends.length - 1]?.total_actions ?? trends[trends.length - 1]?.wa_clicks)) || 0} Aksi / Leads
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Chart Container */}
        <div style={{ position: 'relative', width: '100%', height: '280px', minHeight: '280px' }}>
          {chartType === 'area' ? (
            /* SVG Area & Smooth Curve Line Chart */
            <svg
              viewBox={`0 0 840 280`}
              style={{ width: '100%', height: '100%', overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="viewsGradientDesktop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.48" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
                </linearGradient>
                <linearGradient id="actionsGradientDesktop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
                </linearGradient>
                <filter id="glowLine" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#3b82f6" floodOpacity="0.35" />
                </filter>
              </defs>

              {/* Grid Lines & Y-Axis Labels */}
              {yGridTicks.map(tick => {
                const yPos = 25 + 190 - ((tick / chartMaxVal) * 190);
                const isBase = tick === 0;
                return (
                  <g key={tick}>
                    <line
                      x1={45}
                      y1={yPos}
                      x2={795}
                      y2={yPos}
                      stroke={isBase ? 'var(--border-light)' : 'var(--border-light)'}
                      strokeDasharray={isBase ? 'none' : '4 4'}
                      strokeWidth={isBase ? 1.5 : 1}
                      strokeOpacity={isBase ? 0.9 : 0.65}
                    />
                    <text
                      x={38}
                      y={yPos + 4.5}
                      textAnchor="end"
                      fontSize="12"
                      fontWeight="700"
                      fill="var(--text-secondary)"
                      fontFamily="inherit"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* Area Fills */}
              {trends.length > 0 && (
                <>
                  <path
                    d={getAreaPath(viewsPoints, 215)}
                    fill="url(#viewsGradientDesktop)"
                  />
                  <path
                    d={getAreaPath(actionsPoints, 215)}
                    fill="url(#actionsGradientDesktop)"
                  />
                  
                  {/* High Visibility Curves */}
                  <path
                    d={getBezierPath(viewsPoints)}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glowLine)"
                  />
                  <path
                    d={getBezierPath(actionsPoints)}
                    fill="none"
                    stroke="#059669"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}

              {/* Data Points & Interactive Triggers */}
              {trends.map((t, idx) => {
                const ptV = viewsPoints[idx];
                const ptA = actionsPoints[idx];
                const isHovered = hoveredPointIndex === idx;
                const isLatest = idx === trends.length - 1;
                if (!ptV || !ptA) return null;

                const showDateLabel = period === '7d' || (period === '30d' && idx % 4 === 0) || (period === '90d' && idx % 10 === 0) || isLatest;
                const labelAnchor = idx === 0 ? 'start' : isLatest ? 'end' : 'middle';

                return (
                  <g key={t.date}>
                    {/* Hover vertical reference line */}
                    {isHovered && (
                      <line
                        x1={ptV.x}
                        y1={25}
                        x2={ptV.x}
                        y2={215}
                        stroke="var(--primary)"
                        strokeDasharray="3 3"
                        strokeWidth="1.8"
                        strokeOpacity={0.85}
                      />
                    )}

                    {/* Point circles with outer ring */}
                    <circle
                      cx={ptV.x}
                      cy={ptV.y}
                      r={isHovered ? 7.5 : (isLatest && t.store_views > 0 ? 6 : 4.5)}
                      fill="#3b82f6"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />
                    <circle
                      cx={ptA.x}
                      cy={ptA.y}
                      r={isHovered ? 7.5 : 4.5}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />

                    {/* Latest / Peak Value Pill Badge */}
                    {(isHovered || (isLatest && t.store_views > 0)) && (
                      <g transform={`translate(${ptV.x}, ${Math.max(16, ptV.y - 14)})`}>
                        <rect
                          x="-14"
                          y="-13"
                          width="28"
                          height="16"
                          rx="8"
                          fill="#1d4ed8"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                        <text
                          x="0"
                          y="-2"
                          textAnchor="middle"
                          fontSize="9.5"
                          fontWeight="800"
                          fill="#ffffff"
                          fontFamily="inherit"
                        >
                          {t.store_views}
                        </text>
                      </g>
                    )}

                    {/* X-Axis Date Label with Safe Alignment */}
                    {showDateLabel && (
                      <text
                        x={ptV.x}
                        y={248}
                        textAnchor={labelAnchor}
                        fontSize="11.5"
                        fill={isHovered ? 'var(--primary)' : isLatest ? 'var(--text-primary)' : 'var(--text-secondary)'}
                        fontWeight={isLatest || isHovered ? '800' : '600'}
                        fontFamily="inherit"
                      >
                        {formatShortDate(t.date)}
                      </text>
                    )}

                    {/* Transparent touch/click trigger area */}
                    <rect
                      x={ptV.x - (750 / Math.max(1, trends.length)) / 2}
                      y={0}
                      width={750 / Math.max(1, trends.length)}
                      height={270}
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
            /* Bar Chart Visualization with High Contrast */
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Background Grid Lines */}
              <div style={{ position: 'absolute', top: '15px', left: '45px', right: '15px', bottom: '45px', pointerEvents: 'none' }}>
                {yGridTicks.map(tick => {
                  const bottomPct = (tick / chartMaxVal) * 100;
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
                      <span style={{ position: 'absolute', right: '100%', marginRight: '8px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', transform: 'translateY(50%)' }}>
                        {tick}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Bars Row */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: 'calc(100% - 45px)', paddingLeft: '45px', paddingRight: '15px' }}>
                {trends.map((t, idx) => {
                  const vHeight = Math.max(4, Math.round((t.store_views / chartMaxVal) * 200));
                  const actCount = t.total_actions ?? t.wa_clicks ?? 0;
                  const aHeight = Math.max(4, Math.round((actCount / chartMaxVal) * 200));
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
                      {/* Bar Value Indicator */}
                      {(isHovered || t.store_views > 0) && (
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#3b82f6', marginBottom: '3px' }}>
                          {t.store_views}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', width: '100%', justifyContent: 'center' }}>
                        {/* Views Bar */}
                        <div
                          style={{
                            width: '44%',
                            maxWidth: '22px',
                            height: `${vHeight}px`,
                            background: isHovered ? 'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)' : 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)',
                            borderRadius: '5px 5px 0 0',
                            transition: 'height 0.3s ease, background 0.2s ease',
                            boxShadow: isHovered ? '0 0 12px rgba(59, 130, 246, 0.6)' : 'none'
                          }}
                        />
                        {/* Actions Bar */}
                        <div
                          style={{
                            width: '44%',
                            maxWidth: '22px',
                            height: `${aHeight}px`,
                            background: isHovered ? 'linear-gradient(180deg, #34d399 0%, #059669 100%)' : 'linear-gradient(180deg, #10b981 0%, #047857 100%)',
                            borderRadius: '5px 5px 0 0',
                            transition: 'height 0.3s ease, background 0.2s ease',
                            boxShadow: isHovered ? '0 0 12px rgba(16, 185, 129, 0.6)' : 'none'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* X-Axis Date Labels Row with Safe Alignment */}
              <div style={{ display: 'flex', paddingLeft: '45px', paddingRight: '15px', height: '40px', alignItems: 'center' }}>
                {trends.map((t, idx) => {
                  const isLatest = idx === trends.length - 1;
                  const showDateLabel = period === '7d' || (period === '30d' && idx % 4 === 0) || (period === '90d' && idx % 10 === 0) || isLatest;
                  const isHovered = hoveredPointIndex === idx;

                  return (
                    <div key={t.date} style={{ flex: 1, textAlign: idx === 0 ? 'left' : isLatest ? 'right' : 'center' }}>
                      {showDateLabel && (
                        <span style={{ fontSize: '0.75rem', color: isHovered ? 'var(--primary)' : isLatest ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isLatest || isHovered ? 800 : 600, whiteSpace: 'nowrap' }}>
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
                top: '15px',
                left: `${Math.min(78, Math.max(16, ((hoveredPointIndex + 0.5) / Math.max(1, trends.length)) * 100))}%`,
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(15, 23, 42, 0.96)',
                color: '#ffffff',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                fontSize: '0.8rem',
                zIndex: 30,
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.15)',
                pointerEvents: 'none',
                backdropFilter: 'blur(10px)',
                minWidth: '185px'
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: '0.4rem', color: '#f8fafc', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '0.3rem', fontSize: '0.82rem' }}>
                {formatDetailedDate(trends[hoveredPointIndex].date)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', margin: '0.25rem 0' }}>
                <span style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                  Kunjungan:
                </span>
                <strong style={{ color: '#60a5fa', fontSize: '0.88rem' }}>{trends[hoveredPointIndex].store_views}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', margin: '0.25rem 0' }}>
                <span style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  Total Aksi:
                </span>
                <strong style={{ color: '#34d399', fontSize: '0.88rem' }}>{trends[hoveredPointIndex].total_actions ?? trends[hoveredPointIndex].wa_clicks ?? 0}</strong>
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
                Menunggu Data Kunjungan • Bagikan link katalog toko Anda untuk mencatat grafik real-time
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Performa Item per Tipe Katalog
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Analisa item paling diminati calon pembeli dan efisiensi konversinya
            </span>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Cari item katalog..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.75rem 0.45rem 2.25rem',
                fontSize: '0.78rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-deep)',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Product Type Switcher Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            overflowX: 'auto',
            paddingBottom: '0.35rem',
            scrollbarWidth: 'none'
          }}
        >
          {productTypeTabs.map(tab => {
            const TabIcon = tab.icon;
            const isSelected = selectedProductType === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedProductType(tab.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.9rem',
                  fontSize: '0.78rem',
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
                <TabIcon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Top Products Table / Card List */}
        {filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Belum ada data aktivitas untuk tipe item yang dipilih.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {filteredProducts.map((prod, index) => {
              const itemActions = prod.total_actions_count ?? prod.wa_clicks_count ?? 0;
              const ctr = prod.conversion_rate_percent ?? 0;

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
                >
                  {/* Top Section: Rank, Image, Title & Conversion Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                      {/* Rank Badge */}
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          backgroundColor: index < 3 ? 'var(--primary-glow)' : 'var(--bg-card)',
                          color: index < 3 ? 'var(--primary)' : 'var(--text-secondary)',
                          border: '1px solid var(--border-light)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          flexShrink: 0
                        }}
                      >
                        #{index + 1}
                      </div>

                      {/* Thumbnail */}
                      {prod.image_url ? (
                        <img
                          src={prod.image_url}
                          alt={prod.name}
                          style={{ width: '40px', height: '40px', borderRadius: '0.5rem', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-light)' }}
                        />
                      ) : (
                        <div style={{ width: '40px', height: '40px', borderRadius: '0.5rem', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0, border: '1px solid var(--border-light)' }}>
                          <ShoppingBag size={18} />
                        </div>
                      )}

                      {/* Title & Price */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prod.name}
                        </span>
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
    </div>
  );
};
