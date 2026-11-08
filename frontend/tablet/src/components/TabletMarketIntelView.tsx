import React, { useState, useEffect } from 'react';
import {
  Globe,
  TrendingUp,
  Download,
  ShieldCheck,
  Zap,
  Layers,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  Search,
  ArrowUpRight,
  BarChart3,
  Users,
  Activity,
  Radio,
  Smartphone,
  Compass,
  Clock,
  CheckCircle2,
  Store,
  Lock
} from 'lucide-react';
import { TabletDimensionSheet } from './TabletDimensionSheet';
import { aggregateTopNDimensions, type DimensionalMetric } from '../utils/telemetryHelpers';

export interface GlobalAnalyticsOverview {
  period: string;
  days: number;
  total_views: number;
  total_unique_visitors: number;
  total_product_views: number;
  total_bounces: number;
  bounce_rate_percent: number;
  total_actions: number;
  conversion_rate: number;
  channels: {
    direct_wa: number;
    marketplace: number;
    rekber: number;
    video: number;
  };
  trends: Array<{
    date: string;
    store_views: number;
    unique_visitors: number;
    total_actions: number;
  }>;
  top_stores: Array<{
    store_id: number;
    slug: string;
    store_title: string;
    views: number;
    total_actions: number;
  }>;
  devices: Array<{
    dimension_value: string;
    name: string;
    views: number;
    percentage: number;
    conversion_rate_percent: number;
  }>;
  operating_systems: Array<{
    dimension_value: string;
    name: string;
    views: number;
    percentage: number;
  }>;
  browsers: Array<{
    dimension_value: string;
    name: string;
    views: number;
    percentage: number;
    conversion_rate_percent: number;
  }>;
  locations: Array<{
    dimension_value: string;
    name: string;
    views: number;
    percentage: number;
  }>;
  hourly_heatmap: Array<{
    hour: string;
    views: number;
  }>;
  recent_visitors: Array<{
    id: number;
    store_id: number;
    store_slug: string;
    event: string;
    product_name?: string;
    source: string;
    device_type: string;
    browser: string;
    os: string;
    city: string;
    time_ago: string;
  }>;
}

export interface TrendingKeywordItem {
  keyword: string;
  product_type: string;
  search_volume: number;
  zero_count: number;
  ctr: number;
}

export interface DemandGapItem {
  keyword: string;
  product_type: string;
  zero_result_count: number;
  total_searches: number;
}

export interface MarketIntelligenceData {
  total_active_stores: number;
  total_active_products: number;
  total_views_30d: number;
  total_actions_30d: number;
  overall_conversion_rate: number;
  channel_breakdown: {
    direct_wa_clicks: number;
    direct_wa_percent: number;
    marketplace_clicks: number;
    marketplace_percent: number;
    rekber_clicks: number;
    rekber_percent: number;
    video_views: number;
    video_views_percent: number;
    total_actions: number;
  };
  top_categories: Array<{
    category_id: number;
    category_name: string;
    product_count: number;
    total_views: number;
    total_actions: number;
    conversion_rate: number;
    average_price: number;
  }>;
  price_benchmarks: Array<{
    category_name: string;
    min_price: number;
    avg_price: number;
    median_price: number;
    max_price: number;
    sample_count: number;
  }>;
  trend_timeline: Array<{
    date: string;
    store_views: number;
    product_views: number;
    total_actions: number;
  }>;
  generated_at: string;
  data_privacy_notice: string;
}

export interface TabletMarketIntelViewProps {
  token: string;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
}

export const TabletMarketIntelView: React.FC<TabletMarketIntelViewProps> = ({
  token,
  showToast
}) => {
  const [data, setData] = useState<MarketIntelligenceData | null>(null);
  const [trendingKeywords, setTrendingKeywords] = useState<TrendingKeywordItem[]>([]);
  const [demandGaps, setDemandGaps] = useState<DemandGapItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);
  const [isTriggeringBot, setIsTriggeringBot] = useState<boolean>(false);
  const [activeSegment, setActiveSegment] = useState<'overview' | 'demand_gap' | 'benchmarks' | 'telemetry'>('overview');

  // Global Telemetry State
  const [telemetryData, setTelemetryData] = useState<GlobalAnalyticsOverview | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState<boolean>(false);
  const [telemetryPeriod, setTelemetryPeriod] = useState<'7d' | '30d' | '90d'>('7d');

  // Scalable Dimensional Sheet & Filter State
  const [dimensionSheetOpen, setDimensionSheetOpen] = useState(false);
  const [selectedDimension, setSelectedDimension] = useState<{
    type: 'locations' | 'browsers' | 'operating_systems' | 'devices';
    title: string;
    items: DimensionalMetric[];
  } | null>(null);
  const [topStoresLimit, setTopStoresLimit] = useState<number>(5);
  const [liveEventFilter, setLiveEventFilter] = useState<'all' | 'store_view' | 'product_view' | 'action_wa' | 'rekber_click'>('all');
  const [isOsExpanded, setIsOsExpanded] = useState(false);

  const fetchGlobalTelemetry = async (period: '7d' | '30d' | '90d' = telemetryPeriod) => {
    setTelemetryLoading(true);
    try {
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/admin/analytics/overview?period=${period}`, { headers });
      const json = await res.json();
      if (json.success && json.data) {
        setTelemetryData(json.data);
      }
    } catch (err: any) {
      console.error('Failed to load global telemetry:', err);
    } finally {
      setTelemetryLoading(false);
    }
  };

  const fetchMarketIntel = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [mainRes, trendRes, gapRes] = await Promise.all([
        fetch('/api/admin/market-intelligence', { headers }),
        fetch('/api/admin/market-intelligence/trending-keywords', { headers }),
        fetch('/api/admin/market-intelligence/demand-gaps', { headers })
      ]);

      const mainJson = await mainRes.json();
      if (mainJson.success && mainJson.data) {
        setData(mainJson.data);
      } else {
        const pubRes = await fetch('/api/market-intelligence');
        const pubJson = await pubRes.json();
        if (pubJson.success && pubJson.data) {
          setData(pubJson.data);
        } else {
          setError(mainJson.message || 'Gagal memuat data riset pasar.');
        }
      }

      try {
        const trendJson = await trendRes.json();
        if (trendJson.success && Array.isArray(trendJson.data)) {
          setTrendingKeywords(trendJson.data);
        }
      } catch {}

      try {
        const gapJson = await gapRes.json();
        if (gapJson.success && Array.isArray(gapJson.data)) {
          setDemandGaps(gapJson.data);
        }
      } catch {}
    } catch (err: any) {
      setError(err.message || 'Koneksi ke server gagal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketIntel();
  }, [token]);

  const handleDownloadCsv = async () => {
    setIsExportingCsv(true);
    try {
      const downloadUrl = `/api/admin/market-intelligence/export?format=csv`;
      const res = await fetch(downloadUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        throw new Error('Gagal mengunduh data riset pasar dari server.');
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `catavor-market-intelligence-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      showToast?.('Laporan data riset pasar CSV berhasil diunduh.', 'success');
    } catch (err: any) {
      showToast?.(err.message || 'Gagal mengunduh laporan CSV.', 'error');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleTriggerAggregation = async () => {
    setIsTriggeringBot(true);
    try {
      const res = await fetch('/api/notifications/automation/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'market_intel_worker' })
      });
      const json = await res.json();
      if (json.success) {
        showToast?.('Bot Agregasi Riset Pasar berhasil dipicu di latar belakang.', 'success');
        setTimeout(() => fetchMarketIntel(), 1500);
      } else {
        showToast?.(json.error || 'Gagal memicu bot agregasi.', 'error');
      }
    } catch {
      showToast?.('Koneksi server gagal memicu otomatisasi.', 'error');
    } finally {
      setIsTriggeringBot(false);
    }
  };

  const formatPrice = (num?: number) => {
    if (!num && num !== 0) return 'Rp 0';
    return 'Rp ' + Math.round(num).toLocaleString('id-ID');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '1.25rem' }}>
      {/* Header Bar */}
      <div
        style={{
          padding: '1.15rem 1.35rem',
          borderRadius: '0.85rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '0.65rem',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Globe size={22} strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Riset Pasar B2B</h3>
              <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                UU PDP LEGAL
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Tren Hype, Demand Gap, dan Benchmark Harga Nasional
            </span>
          </div>
        </div>

        {/* Action Buttons (Touch Target >= 44px) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleTriggerAggregation}
            disabled={isTriggeringBot || loading}
            style={{
              minHeight: '44px',
              padding: '0 0.85rem',
              borderRadius: '0.6rem',
              backgroundColor: 'var(--bg-deep)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-primary)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <RefreshCw size={14} className={isTriggeringBot ? 'animate-spin' : ''} />
            <span>Picu Bot</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={isExportingCsv || !data}
            style={{
              minHeight: '44px',
              padding: '0 1rem',
              borderRadius: '0.6rem',
              backgroundColor: '#059669',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <FileSpreadsheet size={15} />
            <span>{isExportingCsv ? 'Mengunduh...' : 'Unduh CSV'}</span>
          </button>
        </div>
      </div>

      {/* Segmented Switcher for Tablet Thumb Zone */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.35rem',
          padding: '0.3rem',
          borderRadius: '0.75rem',
          backgroundColor: 'var(--bg-deep)',
          border: '1px solid var(--border-light)',
          marginBottom: '1rem'
        }}
      >
        <button
          type="button"
          onClick={() => setActiveSegment('overview')}
          style={{
            minHeight: '42px',
            borderRadius: '0.55rem',
            border: 'none',
            backgroundColor: activeSegment === 'overview' ? 'var(--bg-card)' : 'transparent',
            color: activeSegment === 'overview' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: 800,
            fontSize: '0.78rem',
            cursor: 'pointer',
            boxShadow: activeSegment === 'overview' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          Ringkasan &amp; Hype
        </button>
        <button
          type="button"
          onClick={() => setActiveSegment('demand_gap')}
          style={{
            minHeight: '42px',
            borderRadius: '0.55rem',
            border: 'none',
            backgroundColor: activeSegment === 'demand_gap' ? 'var(--bg-card)' : 'transparent',
            color: activeSegment === 'demand_gap' ? '#f59e0b' : 'var(--text-secondary)',
            fontWeight: 800,
            fontSize: '0.78rem',
            cursor: 'pointer',
            boxShadow: activeSegment === 'demand_gap' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          Demand Gap ({demandGaps.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSegment('benchmarks')}
          style={{
            minHeight: '42px',
            borderRadius: '0.55rem',
            border: 'none',
            backgroundColor: activeSegment === 'benchmarks' ? 'var(--bg-card)' : 'transparent',
            color: activeSegment === 'benchmarks' ? '#10b981' : 'var(--text-secondary)',
            fontWeight: 800,
            fontSize: '0.78rem',
            cursor: 'pointer',
            boxShadow: activeSegment === 'benchmarks' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          Harga Pasar
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveSegment('telemetry');
            if (!telemetryData) fetchGlobalTelemetry(telemetryPeriod);
          }}
          style={{
            minHeight: '42px',
            borderRadius: '0.55rem',
            border: 'none',
            backgroundColor: activeSegment === 'telemetry' ? 'var(--bg-card)' : 'transparent',
            color: activeSegment === 'telemetry' ? '#3b82f6' : 'var(--text-secondary)',
            fontWeight: 800,
            fontSize: '0.78rem',
            cursor: 'pointer',
            boxShadow: activeSegment === 'telemetry' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem'
          }}
        >
          <Radio size={14} style={{ color: activeSegment === 'telemetry' ? '#3b82f6' : 'inherit' }} />
          <span>Telemetri Audiens</span>
        </button>
      </div>

      {activeSegment === 'telemetry' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Telemetry Control Bar */}
          <div
            style={{
              padding: '1rem 1.25rem',
              borderRadius: '0.85rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '0.6rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Radio size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Pusat Telemetri Audiens Global
                </h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  Pemantauan real-time agregat platform &bull; Zero-PII UU PDP Legal
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  display: 'inline-flex',
                  padding: '0.2rem',
                  borderRadius: '0.55rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)'
                }}
              >
                {(['7d', '30d', '90d'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setTelemetryPeriod(p);
                      fetchGlobalTelemetry(p);
                    }}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.45rem',
                      border: 'none',
                      backgroundColor: telemetryPeriod === p ? '#3b82f6' : 'transparent',
                      color: telemetryPeriod === p ? '#ffffff' : 'var(--text-secondary)',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {p === '7d' ? '7 Hari' : p === '30d' ? '30 Hari' : '90 Hari'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => fetchGlobalTelemetry(telemetryPeriod)}
                disabled={telemetryLoading}
                style={{
                  minHeight: '40px',
                  padding: '0 0.85rem',
                  borderRadius: '0.55rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <RefreshCw size={14} className={telemetryLoading ? 'animate-spin' : ''} />
                <span>Segarkan</span>
              </button>
            </div>
          </div>

          {telemetryLoading && !telemetryData ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <RefreshCw size={28} className="animate-spin" style={{ color: '#3b82f6', margin: '0 auto 0.75rem' }} />
              <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Memuat telemetri audiens global...</p>
            </div>
          ) : telemetryData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* 4 KPI Cards for Tablet */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Total Kunjungan Platform</span>
                    <Activity size={16} style={{ color: '#3b82f6' }} />
                  </div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.3rem' }}>
                    {telemetryData.total_views.toLocaleString('id-ID')}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {telemetryData.total_product_views.toLocaleString('id-ID')} tayangan produk katalog
                  </span>
                </div>

                <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Pengunjung Unik Terverifikasi</span>
                    <Users size={16} style={{ color: '#10b981' }} />
                  </div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#10b981', marginTop: '0.3rem' }}>
                    {telemetryData.total_unique_visitors.toLocaleString('id-ID')}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Zero-PII Hashing harian &bull; Anonim murni
                  </span>
                </div>

                <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Rasio Pantulan (Bounce Rate)</span>
                    <TrendingUp size={16} style={{ color: '#f59e0b' }} />
                  </div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#f59e0b', marginTop: '0.3rem' }}>
                    {telemetryData.bounce_rate_percent}%
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {telemetryData.total_bounces.toLocaleString('id-ID')} sesi kunjungan 1 halaman
                  </span>
                </div>

                <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Tindakan &amp; Konversi</span>
                    <CheckCircle2 size={16} style={{ color: '#8b5cf6' }} />
                  </div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#8b5cf6', marginTop: '0.3rem' }}>
                    {telemetryData.total_actions.toLocaleString('id-ID')}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Rasio konversi {telemetryData.conversion_rate}% (WA/Rekber/MP)
                  </span>
                </div>
              </div>

              {/* Top Toko Terpopuler with Top 5 / Top 10 Toggle */}
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Store size={15} style={{ color: '#3b82f6' }} />
                    <span>Toko Terpopuler Nasional</span>
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: 'var(--bg-deep)', padding: '2px', borderRadius: '0.45rem', border: '1px solid var(--border-light)' }}>
                    <button
                      type="button"
                      onClick={() => setTopStoresLimit(5)}
                      style={{
                        padding: '0.2rem 0.55rem',
                        fontSize: '0.7rem',
                        fontWeight: topStoresLimit === 5 ? 700 : 500,
                        borderRadius: '0.35rem',
                        border: 'none',
                        backgroundColor: topStoresLimit === 5 ? 'var(--bg-card)' : 'transparent',
                        color: topStoresLimit === 5 ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      Top 5
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopStoresLimit(10)}
                      style={{
                        padding: '0.2rem 0.55rem',
                        fontSize: '0.7rem',
                        fontWeight: topStoresLimit === 10 ? 700 : 500,
                        borderRadius: '0.35rem',
                        border: 'none',
                        backgroundColor: topStoresLimit === 10 ? 'var(--bg-card)' : 'transparent',
                        color: topStoresLimit === 10 ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      Top 10
                    </button>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem 0.65rem' }}>Peringkat</th>
                        <th style={{ padding: '0.5rem 0.65rem' }}>Nama Toko &amp; Slug</th>
                        <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right' }}>Total Kunjungan</th>
                        <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right' }}>Aksi Pembeli</th>
                      </tr>
                    </thead>
                    <tbody>
                      {telemetryData.top_stores && telemetryData.top_stores.length > 0 ? (
                        telemetryData.top_stores.slice(0, topStoresLimit).map((st, idx) => (
                          <tr key={st.store_id || idx} style={{ borderBottom: '1px dashed var(--border-light)' }}>
                            <td style={{ padding: '0.55rem 0.65rem', fontWeight: 800, color: idx < 3 ? '#10b981' : 'var(--text-secondary)' }}>
                              #{idx + 1}
                            </td>
                            <td style={{ padding: '0.55rem 0.65rem' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>{st.store_title}</span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>/{st.slug}</span>
                            </td>
                            <td style={{ padding: '0.55rem 0.65rem', textAlign: 'right', fontWeight: 800, color: '#3b82f6' }}>
                              {st.views.toLocaleString('id-ID')}
                            </td>
                            <td style={{ padding: '0.55rem 0.65rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                              {st.total_actions.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            Belum ada riwayat aktivitas toko pada periode ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4-Card Global Audience Dimensions (Equal Height Clamped) */}
              {(() => {
                const devicesResult = aggregateTopNDimensions(telemetryData?.devices || [], 4, 'Perangkat Lainnya');
                const browsersResult = aggregateTopNDimensions(telemetryData?.browsers || [], 5, 'Peramban Lainnya');
                const locationsResult = aggregateTopNDimensions(telemetryData?.locations || [], 5, 'Kota Lainnya');
                const allOs = telemetryData?.operating_systems || [];
                const visibleOs = isOsExpanded ? allOs : allOs.slice(0, 4);
                const remainingOsCount = Math.max(0, allOs.length - 4);

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                    {/* Card 1: Perangkat & OS */}
                    <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '340px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Smartphone size={15} style={{ color: '#10b981' }} />
                          <span>Distribusi Perangkat</span>
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                          {devicesResult.totalItemsCount} perangkat
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1 }}>
                        {devicesResult.displayItems.map((d) => (
                          <div key={d.dimension_value} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                              <span style={{ fontWeight: 600 }}>{d.name}</span>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.percentage.toFixed(0)}% ({d.views})</span>
                            </div>
                            <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: 'var(--bg-deep)', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.max(4, Math.min(100, d.percentage))}%`, height: '100%', backgroundColor: '#10b981', borderRadius: '3px' }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {allOs.length > 0 && (
                        <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                              Sistem Operasi ({allOs.length})
                            </span>
                            {allOs.length > 4 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDimension({
                                    type: 'operating_systems',
                                    title: 'Sebaran Sistem Operasi Platform',
                                    items: allOs
                                  });
                                  setDimensionSheetOpen(true);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#3b82f6',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  padding: 0
                                }}
                              >
                                Lihat Semua ↗
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {visibleOs.map((os) => (
                              <span
                                key={os.dimension_value}
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '0.4rem',
                                  backgroundColor: 'var(--bg-deep)',
                                  border: '1px solid var(--border-light)',
                                  color: 'var(--text-primary)'
                                }}
                              >
                                {os.name}: {os.percentage.toFixed(0)}%
                              </span>
                            ))}
                            {!isOsExpanded && remainingOsCount > 0 && (
                              <button
                                type="button"
                                onClick={() => setIsOsExpanded(true)}
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                  border: '1px solid rgba(59, 130, 246, 0.25)',
                                  color: '#3b82f6',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                +{remainingOsCount} Lainnya
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card 2: Browser & In-App Social */}
                    <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '340px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Globe size={15} style={{ color: '#3b82f6' }} />
                          <span>Browser &amp; In-App Social</span>
                        </span>
                        {browsersResult.totalItemsCount > 5 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDimension({
                                type: 'browsers',
                                title: 'Peramban & Webview In-App Sosial Platform',
                                items: telemetryData?.browsers || []
                              });
                              setDimensionSheetOpen(true);
                            }}
                            style={{
                              padding: '0.15rem 0.5rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border-light)',
                              backgroundColor: 'var(--bg-deep)',
                              color: '#3b82f6',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Lihat Semua ({browsersResult.totalItemsCount}) ↗
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Instagram / TikTok</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1 }}>
                        {browsersResult.displayItems.map((b) => {
                          const isInApp = b.dimension_value.includes('in-app') || b.name.toLowerCase().includes('in-app');
                          const isOthers = b.dimension_value === '__others__';
                          return (
                            <div
                              key={b.dimension_value}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.2rem',
                                cursor: isOthers ? 'pointer' : 'default'
                              }}
                              onClick={() => {
                                if (isOthers) {
                                  setSelectedDimension({
                                    type: 'browsers',
                                    title: 'Peramban & Webview In-App Sosial Platform',
                                    items: telemetryData?.browsers || []
                                  });
                                  setDimensionSheetOpen(true);
                                }
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                <span style={{ fontWeight: 600, color: isOthers ? '#3b82f6' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <span>{b.name}</span>
                                  {isInApp && (
                                    <span style={{ fontSize: '0.6rem', padding: '0.05rem 0.35rem', borderRadius: '4px', backgroundColor: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', fontWeight: 700 }}>
                                      In-App
                                    </span>
                                  )}
                                  {isOthers && <span style={{ fontSize: '0.65rem', textDecoration: 'underline' }}>↗</span>}
                                </span>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{b.percentage.toFixed(0)}% ({b.views})</span>
                              </div>
                              <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: 'var(--bg-deep)', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.max(4, Math.min(100, b.percentage))}%`, height: '100%', backgroundColor: isInApp ? '#ec4899' : '#3b82f6', borderRadius: '3px' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Card 3: Top Visitor Cities */}
                    <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '340px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Compass size={15} style={{ color: '#f59e0b' }} />
                          <span>Kota Pengunjung Platform</span>
                        </span>
                        {locationsResult.totalItemsCount > 5 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDimension({
                                type: 'locations',
                                title: 'Sebaran Kota Pengunjung Nasional (Coarse Geo)',
                                items: telemetryData?.locations || []
                              });
                              setDimensionSheetOpen(true);
                            }}
                            style={{
                              padding: '0.15rem 0.5rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border-light)',
                              backgroundColor: 'var(--bg-deep)',
                              color: '#f59e0b',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Lihat Semua ({locationsResult.totalItemsCount}) ↗
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Coarse Geo Zero-PII</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1 }}>
                        {locationsResult.displayItems.map((loc) => {
                          const isOthers = loc.dimension_value === '__others__';
                          return (
                            <div
                              key={loc.dimension_value}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.2rem',
                                cursor: isOthers ? 'pointer' : 'default'
                              }}
                              onClick={() => {
                                if (isOthers) {
                                  setSelectedDimension({
                                    type: 'locations',
                                    title: 'Sebaran Kota Pengunjung Nasional (Coarse Geo)',
                                    items: telemetryData?.locations || []
                                  });
                                  setDimensionSheetOpen(true);
                                }
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                <span style={{ fontWeight: 600, color: isOthers ? '#f59e0b' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <span>{loc.name}</span>
                                  {isOthers && <span style={{ fontSize: '0.65rem', textDecoration: 'underline' }}>↗</span>}
                                </span>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{loc.percentage.toFixed(0)}% ({loc.views})</span>
                              </div>
                              <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: 'var(--bg-deep)', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.max(4, Math.min(100, loc.percentage))}%`, height: '100%', backgroundColor: '#f59e0b', borderRadius: '3px' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Card 4: 24-Hour Peak Activity Heatmap */}
                    <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '340px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Clock size={15} style={{ color: '#8b5cf6' }} />
                          <span>Kurva Jam Sibuk Pengunjung (24 Jam)</span>
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>WIB</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0.35rem', alignItems: 'end', height: '180px', flex: 1, paddingBottom: '0.5rem' }}>
                        {telemetryData.hourly_heatmap && telemetryData.hourly_heatmap.map((h, idx) => {
                          const maxViews = Math.max(...telemetryData.hourly_heatmap.map((item) => item.views), 1);
                          const heightPercent = Math.max(12, Math.round((h.views / maxViews) * 100));
                          return (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', height: '100%', justifyContent: 'flex-end' }}>
                              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{h.views}</span>
                              <div
                                title={`Pukul ${h.hour}:00 - ${h.views} tayangan`}
                                style={{
                                  width: '100%',
                                  height: `${heightPercent}%`,
                                  maxHeight: '140px',
                                  borderRadius: '3px',
                                  backgroundColor: h.views === maxViews && h.views > 0 ? '#8b5cf6' : h.views > 0 ? 'rgba(139, 92, 246, 0.45)' : 'var(--bg-deep)',
                                  transition: 'height 0.2s ease'
                                }}
                              />
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{h.hour}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Real-Time Live Feed with Event Type Filter */}
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Activity size={15} style={{ color: '#10b981' }} />
                      <span>Live Stream Telemetri Real-Time</span>
                    </h4>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                      AKTIF
                    </span>
                  </div>

                  {/* In-Stream Quick Filter Pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {[
                      { key: 'all', label: `Semua (${(telemetryData.recent_visitors || []).length})` },
                      { key: 'store_view', label: 'Katalog' },
                      { key: 'product_view', label: 'Item Produk' },
                      { key: 'action_wa', label: 'WhatsApp' },
                      { key: 'rekber_click', label: 'Rekber' }
                    ].map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setLiveEventFilter(f.key as any)}
                        style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '0.4rem',
                          border: `1px solid ${liveEventFilter === f.key ? '#10b981' : 'var(--border-light)'}`,
                          backgroundColor: liveEventFilter === f.key ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-deep)',
                          color: liveEventFilter === f.key ? '#10b981' : 'var(--text-secondary)',
                          fontSize: '0.7rem',
                          fontWeight: liveEventFilter === f.key ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="catavor-custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '320px', overflowY: 'auto' }}>
                  {telemetryData.recent_visitors && telemetryData.recent_visitors.length > 0 ? (
                    telemetryData.recent_visitors
                      .filter(ev => {
                        if (liveEventFilter === 'all') return true;
                        if (liveEventFilter === 'action_wa') return ev.event === 'action_wa' || ev.event === 'direct_wa_click';
                        return ev.event === liveEventFilter;
                      })
                      .map((ev, idx) => (
                        <div
                          key={ev.id || idx}
                          style={{
                            padding: '0.55rem 0.75rem',
                            borderRadius: '0.55rem',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            fontSize: '0.74rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            <span
                              style={{
                                padding: '0.15rem 0.45rem',
                                borderRadius: '0.35rem',
                                backgroundColor: ev.event.includes('click') || ev.event.includes('action') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                color: ev.event.includes('click') || ev.event.includes('action') ? '#10b981' : '#3b82f6',
                                fontWeight: 800,
                                fontSize: '0.65rem',
                                flexShrink: 0
                              }}
                            >
                              {ev.event === 'store_view' ? 'TOKO' : ev.event === 'product_view' ? 'PRODUK' : ev.event.toUpperCase()}
                            </span>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ev.product_name ? `${ev.product_name} (${ev.store_slug})` : `/${ev.store_slug}`}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0, fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                            <span>{ev.device_type} &bull; {ev.browser}</span>
                            <span>&bull; {ev.city}</span>
                            <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{ev.time_ago}</span>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                      Belum ada aliran event real-time yang tercatat dalam ring buffer memori.
                    </div>
                  )}
                </div>
              </div>

              {/* PDP Notice */}
              <div style={{ padding: '0.75rem 1rem', borderRadius: '0.65rem', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Kepatuhan UU PDP No. 27/2022: Sistem telemetri menggunakan zero-PII daily rotating HMAC salt. IP dan data identitas pribadi tidak disimpan ke database permanen.
                </span>
              </div>
            </div>
          ) : null}
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--primary)', margin: '0 auto 0.75rem' }} />
          <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Memuat intelijen pasar tablet...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          <span style={{ fontSize: '0.8rem' }}>{error}</span>
        </div>
      ) : data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Section 1: Overview & Hype */}
          {activeSegment === 'overview' && (
            <>
              {/* 4 Metric Cards in 2x2 grid for tablet */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Total Produk Aktif</span>
                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                    {data.total_active_products.toLocaleString('id-ID')}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{data.total_active_stores} Toko</span>
                </div>

                <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Interaksi 30 Hari</span>
                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#10b981', marginTop: '0.2rem' }}>
                    {data.total_views_30d.toLocaleString('id-ID')}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{data.total_actions_30d} Tindakan</span>
                </div>

                <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Rasio Konversi</span>
                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#f59e0b', marginTop: '0.2rem' }}>
                    {data.overall_conversion_rate}%
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Kunjungan ke transaksi</span>
                </div>

                <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Demand Gaps</span>
                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#ef4444', marginTop: '0.2rem' }}>
                    {demandGaps.length} Tren
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Pencarian nihil stok</span>
                </div>
              </div>

              {/* Channel Breakdown */}
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <BarChart3 size={15} style={{ color: '#3b82f6' }} />
                  Saluran Minat Belanja Konsumen
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  <div style={{ padding: '0.6rem 0.75rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>WA Direct</span>
                    <strong style={{ fontSize: '0.78rem', color: '#10b981' }}>{data.channel_breakdown.direct_wa_percent}%</strong>
                  </div>
                  <div style={{ padding: '0.6rem 0.75rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Rekber</span>
                    <strong style={{ fontSize: '0.78rem', color: '#3b82f6' }}>{data.channel_breakdown.rekber_percent}%</strong>
                  </div>
                  <div style={{ padding: '0.6rem 0.75rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Marketplace</span>
                    <strong style={{ fontSize: '0.78rem', color: '#f59e0b' }}>{data.channel_breakdown.marketplace_percent}%</strong>
                  </div>
                  <div style={{ padding: '0.6rem 0.75rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Video Review</span>
                    <strong style={{ fontSize: '0.78rem', color: '#8b5cf6' }}>{data.channel_breakdown.video_views_percent}%</strong>
                  </div>
                </div>
              </div>

              {/* Trending Hype Keywords */}
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: '0 0 0.65rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Search size={15} style={{ color: '#3b82f6' }} />
                  Kata Kunci Paling Dicari (Tren Hype)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {trendingKeywords.slice(0, 8).map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.55rem 0.75rem',
                        borderRadius: '0.55rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.4rem'
                      }}
                    >
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.keyword}
                      </span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', flexShrink: 0 }}>
                        {item.search_volume}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Section 2: Demand Gap */}
          {activeSegment === 'demand_gap' && (
            <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 0.45rem 0', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <ArrowUpRight size={17} style={{ color: '#f59e0b' }} />
                Peluang Pasokan Baru (Pencarian Nihil Stok / Demand Gap)
              </h4>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem 0', lineHeight: 1.45 }}>
                Konsumen mencari produk berikut tetapi etalase toko saat ini belum tersedia. Peluang emas bagi supplier baru.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                {demandGaps.map((gap, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.55rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem'
                    }}
                  >
                    <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{gap.keyword}</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '0.18rem 0.45rem', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', flexShrink: 0 }}>
                      {gap.zero_result_count}x nihil
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Price Benchmarks */}
          {activeSegment === 'benchmarks' && (
            <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 0.65rem 0', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Layers size={16} style={{ color: '#10b981' }} />
                Benchmark Rentang Harga Wajar per Kategori
              </h4>
              <div
                className="tablet-sticky-table-container catavor-table-scrollbar"
                style={{
                  maxHeight: 'min(45vh, 420px)',
                  overflowY: 'auto',
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  borderRadius: '0.65rem',
                  border: '1px solid var(--border-light)'
                }}
              >
                <table
                  className="tablet-sticky-table"
                  style={{
                    width: '100%',
                    borderCollapse: 'separate',
                    borderSpacing: 0,
                    fontSize: '0.74rem'
                  }}
                >
                  <thead>
                    <tr style={{ color: 'var(--text-secondary)', textAlign: 'left', backgroundColor: 'var(--bg-deep)' }}>
                      <th
                        className="sticky-col"
                        style={{
                          padding: '0.6rem 0.75rem',
                          position: 'sticky',
                          left: 0,
                          top: 0,
                          zIndex: 20,
                          backgroundColor: 'var(--bg-deep)',
                          borderBottom: '1px solid var(--border-light)',
                          borderRight: '1px solid var(--border-light)',
                          boxShadow: '3px 0 8px rgba(0,0,0,0.04)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Kategori
                      </th>
                      <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>Min</th>
                      <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>Rata-rata</th>
                      <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>Maks</th>
                      <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>Sampel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.price_benchmarks.map((pb, idx) => (
                      <tr
                        key={idx}
                        style={{ transition: 'background-color 0.15s ease' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-card-hover, rgba(255,255,255,0.02))';
                          const stickyTd = e.currentTarget.querySelector('.sticky-col') as HTMLElement;
                          if (stickyTd) stickyTd.style.backgroundColor = 'var(--bg-card-hover, rgba(255,255,255,0.02))';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          const stickyTd = e.currentTarget.querySelector('.sticky-col') as HTMLElement;
                          if (stickyTd) stickyTd.style.backgroundColor = 'var(--bg-card)';
                        }}
                      >
                        <td
                          className="sticky-col"
                          style={{
                            padding: '0.55rem 0.75rem',
                            fontWeight: 700,
                            position: 'sticky',
                            left: 0,
                            zIndex: 5,
                            backgroundColor: 'var(--bg-card)',
                            borderBottom: '1px dashed var(--border-light)',
                            borderRight: '1px solid var(--border-light)',
                            boxShadow: '3px 0 8px rgba(0,0,0,0.04)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {pb.category_name}
                        </td>
                        <td style={{ padding: '0.55rem 0.75rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-light)', whiteSpace: 'nowrap' }}>{formatPrice(pb.min_price)}</td>
                        <td style={{ padding: '0.55rem 0.75rem', fontWeight: 800, color: '#10b981', borderBottom: '1px dashed var(--border-light)', whiteSpace: 'nowrap' }}>{formatPrice(pb.avg_price)}</td>
                        <td style={{ padding: '0.55rem 0.75rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-light)', whiteSpace: 'nowrap' }}>{formatPrice(pb.max_price)}</td>
                        <td style={{ padding: '0.55rem 0.75rem', color: 'var(--text-muted)', borderBottom: '1px dashed var(--border-light)', whiteSpace: 'nowrap' }}>{pb.sample_count} item</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Legal PDP notice */}
          <div style={{ padding: '0.75rem 1rem', borderRadius: '0.65rem', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} style={{ color: '#10b981', flexShrink: 0 }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              Kepatuhan UU PDP No. 27/2022: Data statistik tren makro anonim murni (Zero-PII) dengan pengaman privasi K-Anonymity &ge; 50.
            </span>
          </div>
        </div>
      ) : null}

      {/* Scalable Dimension Detail Sheet */}
      {selectedDimension && (
        <TabletDimensionSheet
          isOpen={dimensionSheetOpen}
          onClose={() => setDimensionSheetOpen(false)}
          title={selectedDimension.title}
          dimensionType={selectedDimension.type}
          items={selectedDimension.items}
        />
      )}
    </div>
  );
};

