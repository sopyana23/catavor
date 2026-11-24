import React, { useState, useEffect, useCallback } from 'react';
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
  AlertTriangle
} from 'lucide-react';
import { TabletDimensionSheet } from './TabletDimensionSheet';
import { aggregateTopNDimensions, computeHourlyTimeBands, type DimensionalMetric } from '../utils/telemetryHelpers';
import {
  type TelemetryPeriod,
  type GlobalAnalyticsOverview,
  type TrendingKeywordItem,
  type DemandGapItem,
  type MarketIntelligenceData,
  PRIVACY_BADGE_LABEL,
  PRIVACY_COMPLIANCE_SUMMARY,
  TELEMETRY_PRIVACY_SUMMARY,
  fetchAdminMarketIntelBundle,
  fetchAdminGlobalTelemetry,
  triggerMarketIntelAggregationBot,
  downloadAdminMarketIntelExport,
  formatIDR,
  formatNumber,
  formatPercent,
  formatProductTypeLabel,
  formatTelemetryEventLabel,
  computeGapRatio
} from '../../../shared/marketIntel/model';

export type {
  TelemetryPeriod,
  GlobalAnalyticsOverview,
  TrendingKeywordItem,
  DemandGapItem,
  MarketIntelligenceData
};

export interface TabletMarketIntelViewProps {
  token: string;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
  canTriggerBot?: boolean;
  revision?: number;
}

export const TabletMarketIntelView: React.FC<TabletMarketIntelViewProps> = ({
  token,
  showToast,
  canTriggerBot = false,
  revision = 0
}) => {
  const [data, setData] = useState<MarketIntelligenceData | null>(null);
  const [trendingKeywords, setTrendingKeywords] = useState<TrendingKeywordItem[]>([]);
  const [demandGaps, setDemandGaps] = useState<DemandGapItem[]>([]);
  const [partialWarning, setPartialWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<'csv' | 'json' | null>(null);
  const [isTriggeringBot, setIsTriggeringBot] = useState<boolean>(false);
  const [activeSegment, setActiveSegment] = useState<'overview' | 'demand_gap' | 'benchmarks' | 'telemetry'>('overview');

  const [telemetryData, setTelemetryData] = useState<GlobalAnalyticsOverview | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState<boolean>(false);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const [telemetryPeriod, setTelemetryPeriod] = useState<TelemetryPeriod>('7d');

  const [dimensionSheetOpen, setDimensionSheetOpen] = useState(false);
  const [selectedDimension, setSelectedDimension] = useState<{
    type: 'locations' | 'browsers' | 'operating_systems' | 'devices';
    title: string;
    items: DimensionalMetric[];
  } | null>(null);
  const [topStoresLimit, setTopStoresLimit] = useState<number>(5);
  const [liveEventFilter, setLiveEventFilter] = useState<'all' | 'store_view' | 'product_view' | 'action_wa' | 'rekber_click'>('all');
  const [isOsExpanded, setIsOsExpanded] = useState(false);
  const [heatmapViewMode, setHeatmapViewMode] = useState<'24h' | 'time_bands'>('24h');

  const loadMarketIntel = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setPartialWarning(null);
    try {
      const bundle = await fetchAdminMarketIntelBundle(token, signal);
      setData(bundle.summary);
      setTrendingKeywords(bundle.trendingKeywords);
      setDemandGaps(bundle.demandGaps);
      setPartialWarning(bundle.partialWarning);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Koneksi ke server gagal.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadGlobalTelemetry = useCallback(async (period: TelemetryPeriod, signal?: AbortSignal) => {
    setTelemetryLoading(true);
    setTelemetryError(null);
    try {
      const overview = await fetchAdminGlobalTelemetry(token, period, signal);
      setTelemetryData(overview);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setTelemetryError(err instanceof Error ? err.message : 'Gagal memuat telemetri audiens global.');
    } finally {
      setTelemetryLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    loadMarketIntel(controller.signal);
    return () => controller.abort();
  }, [loadMarketIntel, revision]);

  useEffect(() => {
    if (activeSegment !== 'telemetry') return;
    const controller = new AbortController();
    loadGlobalTelemetry(telemetryPeriod, controller.signal);
    return () => controller.abort();
  }, [activeSegment, telemetryPeriod, revision, loadGlobalTelemetry]);

  const handleDownloadExport = async (format: 'csv' | 'json') => {
    setExportingFormat(format);
    try {
      await downloadAdminMarketIntelExport(token, format);
      showToast?.(`Laporan data riset pasar ${format.toUpperCase()} berhasil diunduh.`, 'success');
    } catch (err: unknown) {
      showToast?.(err instanceof Error ? err.message : `Gagal mengunduh laporan ${format.toUpperCase()}.`, 'error');
    } finally {
      setExportingFormat(null);
    }
  };

  const handleTriggerAggregation = async () => {
    if (!canTriggerBot) return;
    setIsTriggeringBot(true);
    try {
      const msg = await triggerMarketIntelAggregationBot(token);
      showToast?.(msg, 'success');
      setTimeout(() => {
        loadMarketIntel();
        if (activeSegment === 'telemetry') {
          loadGlobalTelemetry(telemetryPeriod);
        }
      }, 1200);
    } catch (err: unknown) {
      showToast?.(err instanceof Error ? err.message : 'Gagal memicu bot agregasi.', 'error');
    } finally {
      setIsTriggeringBot(false);
    }
  };

  const kMinStores = data?.k_anonymity_min_stores || 3;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '1.15rem', gap: '1rem', boxSizing: 'border-box' }}>
      {/* Header Bar */}
      <div
        style={{
          padding: '1.05rem 1.25rem',
          borderRadius: '0.85rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.85rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: '1 1 260px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
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
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Riset Pasar B2B
              </h3>
              <span style={{ fontSize: '0.64rem', fontWeight: 800, padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                UU PDP ZERO-PII
              </span>
              <span style={{ fontSize: '0.64rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
                {PRIVACY_BADGE_LABEL}
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.15rem' }}>
              Tren Hype, Demand Gap, dan Kuartil Harga Nasional
            </span>
          </div>
        </div>

        {/* Action Buttons (All >= 44px touch target) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              loadMarketIntel();
              if (activeSegment === 'telemetry') {
                loadGlobalTelemetry(telemetryPeriod);
              }
            }}
            disabled={loading || telemetryLoading}
            style={{
              minWidth: '44px',
              minHeight: '44px',
              padding: '0 0.8rem',
              borderRadius: '0.6rem',
              backgroundColor: 'var(--bg-deep)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-primary)',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
            title="Segarkan Data"
          >
            <RefreshCw size={15} className={loading || telemetryLoading ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>

          {canTriggerBot && (
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
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Zap size={15} style={{ color: '#f59e0b' }} className={isTriggeringBot ? 'animate-spin' : ''} />
              <span>{isTriggeringBot ? 'Memproses...' : 'Picu Bot'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleDownloadExport('json')}
            disabled={exportingFormat !== null || !data}
            style={{
              minHeight: '44px',
              padding: '0 0.85rem',
              borderRadius: '0.6rem',
              backgroundColor: 'var(--bg-deep)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-primary)',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Download size={15} />
            <span>{exportingFormat === 'json' ? '...' : 'JSON'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadExport('csv')}
            disabled={exportingFormat !== null || !data}
            style={{
              minHeight: '44px',
              padding: '0 1rem',
              borderRadius: '0.6rem',
              backgroundColor: '#059669',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <FileSpreadsheet size={15} />
            <span>{exportingFormat === 'csv' ? 'Mengunduh...' : 'Unduh CSV'}</span>
          </button>
        </div>
      </div>

      {/* Accessible Touch-Friendly Segmented Switcher (>= 44px) */}
      <div
        role="tablist"
        aria-label="Navigasi Segmen Riset Pasar Tablet"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.35rem',
          padding: '0.3rem',
          borderRadius: '0.75rem',
          backgroundColor: 'var(--bg-deep)',
          border: '1px solid var(--border-light)'
        }}
      >
        {([
          { key: 'overview', label: 'Ringkasan & Tren', color: 'var(--primary)' },
          { key: 'demand_gap', label: `Hype & Gap (${demandGaps.length})`, color: '#f59e0b' },
          { key: 'benchmarks', label: 'Harga Pasar', color: '#10b981' },
          { key: 'telemetry', label: 'Telemetri Global', color: '#3b82f6' }
        ] as const).map((tab) => {
          const isActive = activeSegment === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`tablet-tab-${tab.key}`}
              aria-selected={isActive}
              onClick={() => setActiveSegment(tab.key)}
              style={{
                minHeight: '44px',
                padding: '0 0.5rem',
                borderRadius: '0.55rem',
                border: 'none',
                borderBottom: isActive ? `3px solid ${tab.color}` : '3px solid transparent',
                backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                color: isActive ? tab.color : 'var(--text-secondary)',
                fontWeight: 800,
                fontSize: '0.76rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              {tab.key === 'telemetry' && <Radio size={14} />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {partialWarning && activeSegment !== 'telemetry' && (
        <div
          role="status"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#d97706',
            display: 'flex',
            alignItems: 'center',
            gap: '0.55rem',
            fontSize: '0.76rem',
            fontWeight: 600
          }}
        >
          <AlertTriangle size={16} />
          <span>{partialWarning}</span>
        </div>
      )}

      {activeSegment === 'telemetry' ? (
        <div role="tabpanel" aria-labelledby="tablet-tab-telemetry" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Telemetry Control Bar */}
          <div
            style={{
              padding: '0.95rem 1.15rem',
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
              <div style={{ width: '40px', height: '40px', borderRadius: '0.6rem', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Radio size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Pusat Telemetri Audiens Global
                </h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  Pemantauan agregat platform &bull; Zero-PII UU PDP Legal
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', padding: '0.2rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                {(['7d', '30d', '90d'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setTelemetryPeriod(p)}
                    style={{
                      minHeight: '44px',
                      padding: '0 0.85rem',
                      borderRadius: '0.45rem',
                      border: 'none',
                      borderBottom: telemetryPeriod === p ? '3px solid #1d4ed8' : '3px solid transparent',
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
                onClick={() => loadGlobalTelemetry(telemetryPeriod)}
                disabled={telemetryLoading}
                style={{
                  minHeight: '44px',
                  padding: '0 0.9rem',
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

          {telemetryError && (
            <div role="alert" style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <AlertCircle size={18} />
              <span style={{ fontSize: '0.8rem', flex: 1 }}>{telemetryError}</span>
              <button
                type="button"
                onClick={() => loadGlobalTelemetry(telemetryPeriod)}
                style={{ minHeight: '44px', padding: '0 0.9rem', borderRadius: '0.5rem', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
              >
                Coba Lagi
              </button>
            </div>
          )}

          {telemetryLoading && !telemetryData ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <RefreshCw size={28} className="animate-spin" style={{ color: '#3b82f6', margin: '0 auto 0.75rem' }} />
              <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Memuat telemetri audiens global...</p>
            </div>
          ) : telemetryData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* 4 KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Total Kunjungan Platform</span>
                    <Activity size={16} style={{ color: '#3b82f6' }} />
                  </div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.3rem' }}>
                    {formatNumber(telemetryData.total_views)}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {formatNumber(telemetryData.total_product_views)} tayangan produk katalog
                  </span>
                </div>

                <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Pengunjung Unik Terverifikasi</span>
                    <Users size={16} style={{ color: '#10b981' }} />
                  </div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#10b981', marginTop: '0.3rem' }}>
                    {formatNumber(telemetryData.total_unique_visitors)}
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
                    {formatPercent(telemetryData.bounce_rate_percent, 1)}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {formatNumber(telemetryData.total_bounces)} sesi kunjungan tunggal
                  </span>
                </div>

                <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Tindakan &amp; Konversi</span>
                    <CheckCircle2 size={16} style={{ color: '#8b5cf6' }} />
                  </div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#8b5cf6', marginTop: '0.3rem' }}>
                    {formatNumber(telemetryData.total_actions)}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Rasio konversi {formatPercent(telemetryData.conversion_rate, 1)}
                  </span>
                </div>
              </div>

              {/* Top Stores with CTR column */}
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Store size={15} style={{ color: '#3b82f6' }} />
                    <span>Toko Terpopuler Nasional</span>
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: 'var(--bg-deep)', padding: '3px', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
                    {[5, 10].map((lim) => (
                      <button
                        key={lim}
                        type="button"
                        onClick={() => setTopStoresLimit(lim)}
                        style={{
                          minHeight: '44px',
                          padding: '0 0.75rem',
                          fontSize: '0.72rem',
                          fontWeight: topStoresLimit === lim ? 700 : 500,
                          borderRadius: '0.4rem',
                          border: 'none',
                          backgroundColor: topStoresLimit === lim ? 'var(--bg-card)' : 'transparent',
                          color: topStoresLimit === lim ? 'var(--text-primary)' : 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                      >
                        Top {lim}
                      </button>
                    ))}
                  </div>
                </div>
                <div tabIndex={0} role="region" aria-label="Toko Terpopuler Nasional" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '0.55rem 0.65rem' }}>Peringkat</th>
                        <th style={{ padding: '0.55rem 0.65rem' }}>Nama Toko &amp; Slug</th>
                        <th style={{ padding: '0.55rem 0.65rem', textAlign: 'right' }}>Kunjungan</th>
                        <th style={{ padding: '0.55rem 0.65rem', textAlign: 'right' }}>Aksi</th>
                        <th style={{ padding: '0.55rem 0.65rem', textAlign: 'right' }}>CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {telemetryData.top_stores.length > 0 ? (
                        telemetryData.top_stores.slice(0, topStoresLimit).map((st, idx) => {
                          const ctr = st.views > 0 ? Math.min(100, (st.total_actions / st.views) * 100) : 0;
                          return (
                            <tr key={st.store_id || idx} style={{ borderBottom: '1px dashed var(--border-light)' }}>
                              <td style={{ padding: '0.55rem 0.65rem', fontWeight: 800, color: idx < 3 ? '#10b981' : 'var(--text-secondary)' }}>
                                #{idx + 1}
                              </td>
                              <td style={{ padding: '0.55rem 0.65rem' }}>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>{st.store_title}</span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>/{st.slug}</span>
                              </td>
                              <td style={{ padding: '0.55rem 0.65rem', textAlign: 'right', fontWeight: 800, color: '#3b82f6' }}>
                                {formatNumber(st.views)}
                              </td>
                              <td style={{ padding: '0.55rem 0.65rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                {formatNumber(st.total_actions)}
                              </td>
                              <td style={{ padding: '0.55rem 0.65rem', textAlign: 'right', fontWeight: 700, color: ctr > 0 ? '#10b981' : 'var(--text-secondary)' }}>
                                {formatPercent(ctr, 1)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            Belum ada riwayat aktivitas toko pada periode ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4-Card Global Audience Dimensions */}
              {(() => {
                const devicesResult = aggregateTopNDimensions(telemetryData.devices, 4, 'Perangkat Lainnya');
                const browsersResult = aggregateTopNDimensions(telemetryData.browsers, 5, 'Peramban Lainnya');
                const locationsResult = aggregateTopNDimensions(telemetryData.locations, 5, 'Kota Lainnya');
                const allOs = telemetryData.operating_systems;
                const visibleOs = isOsExpanded ? allOs : allOs.slice(0, 4);
                const remainingOsCount = Math.max(0, allOs.length - 4);
                const timeBands = computeHourlyTimeBands(telemetryData.hourly_heatmap);
                const maxViews = Math.max(...telemetryData.hourly_heatmap.map((item) => item.views), 1);

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                    {/* Devices & OS */}
                    <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '320px' }}>
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
                        {devicesResult.displayItems.length > 0 ? (
                          devicesResult.displayItems.map((d) => (
                            <div key={d.dimension_value} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                <span style={{ fontWeight: 600 }}>{d.name}</span>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.percentage.toFixed(0)}% ({formatNumber(d.views)})</span>
                              </div>
                              <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: 'var(--bg-deep)', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.max(4, Math.min(100, d.percentage))}%`, height: '100%', backgroundColor: '#10b981', borderRadius: '3px' }} />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ margin: 'auto 0', textAlign: 'center', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            Belum ada data perangkat pada periode ini.
                          </div>
                        )}
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
                                style={{ minHeight: '44px', padding: '0 0.65rem', borderRadius: '6px', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', color: '#3b82f6', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                              >
                                Lihat Semua
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {visibleOs.map((os) => (
                              <span key={os.dimension_value} style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '0.4rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
                                {os.name}: {os.percentage.toFixed(0)}%
                              </span>
                            ))}
                            {!isOsExpanded && remainingOsCount > 0 && (
                              <button
                                type="button"
                                onClick={() => setIsOsExpanded(true)}
                                style={{ minHeight: '44px', fontSize: '0.7rem', padding: '0 0.75rem', borderRadius: '6px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', color: '#3b82f6', fontWeight: 700, cursor: 'pointer' }}
                              >
                                +{remainingOsCount} Lainnya
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Browsers */}
                    <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '320px' }}>
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
                                items: telemetryData.browsers
                              });
                              setDimensionSheetOpen(true);
                            }}
                            style={{ minHeight: '44px', padding: '0 0.65rem', borderRadius: '6px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-deep)', color: '#3b82f6', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Lihat Semua ({browsersResult.totalItemsCount})
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Instagram / TikTok</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1 }}>
                        {browsersResult.displayItems.length > 0 ? (
                          browsersResult.displayItems.map((b) => {
                            const isInApp = b.dimension_value.includes('in-app') || b.name.toLowerCase().includes('in-app');
                            const isOthers = b.dimension_value === '__others__';
                            return (
                              <div
                                key={b.dimension_value}
                                style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', cursor: isOthers ? 'pointer' : 'default' }}
                                onClick={() => {
                                  if (isOthers) {
                                    setSelectedDimension({
                                      type: 'browsers',
                                      title: 'Peramban & Webview In-App Sosial Platform',
                                      items: telemetryData.browsers
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
                                  </span>
                                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{b.percentage.toFixed(0)}% ({formatNumber(b.views)})</span>
                                </div>
                                <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: 'var(--bg-deep)', overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.max(4, Math.min(100, b.percentage))}%`, height: '100%', backgroundColor: isInApp ? '#ec4899' : '#3b82f6', borderRadius: '3px' }} />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ margin: 'auto 0', textAlign: 'center', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            Belum ada data browser pada periode ini.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Top Visitor Cities */}
                    <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '320px' }}>
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
                                items: telemetryData.locations
                              });
                              setDimensionSheetOpen(true);
                            }}
                            style={{ minHeight: '44px', padding: '0 0.65rem', borderRadius: '6px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-deep)', color: '#f59e0b', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Lihat Semua ({locationsResult.totalItemsCount})
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Coarse Geo Zero-PII</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1 }}>
                        {locationsResult.displayItems.length > 0 ? (
                          locationsResult.displayItems.map((loc) => {
                            const isOthers = loc.dimension_value === '__others__';
                            return (
                              <div
                                key={loc.dimension_value}
                                style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', cursor: isOthers ? 'pointer' : 'default' }}
                                onClick={() => {
                                  if (isOthers) {
                                    setSelectedDimension({
                                      type: 'locations',
                                      title: 'Sebaran Kota Pengunjung Nasional (Coarse Geo)',
                                      items: telemetryData.locations
                                    });
                                    setDimensionSheetOpen(true);
                                  }
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                  <span style={{ fontWeight: 600, color: isOthers ? '#f59e0b' : 'var(--text-primary)' }}>
                                    {loc.name}
                                  </span>
                                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{loc.percentage.toFixed(0)}% ({formatNumber(loc.views)})</span>
                                </div>
                                <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: 'var(--bg-deep)', overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.max(4, Math.min(100, loc.percentage))}%`, height: '100%', backgroundColor: '#f59e0b', borderRadius: '3px' }} />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ margin: 'auto 0', textAlign: 'center', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            Belum ada data kota pengunjung pada periode ini.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 24-Hour Peak Heatmap */}
                    <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '320px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Clock size={15} style={{ color: '#8b5cf6' }} />
                          <span>Kurva Jam Sibuk Pengunjung</span>
                        </span>
                        <div style={{ display: 'inline-flex', padding: '2px', borderRadius: '6px', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                          <button
                            type="button"
                            onClick={() => setHeatmapViewMode('24h')}
                            style={{ minHeight: '44px', padding: '0 0.6rem', fontSize: '0.68rem', fontWeight: 700, border: 'none', borderRadius: '4px', backgroundColor: heatmapViewMode === '24h' ? 'rgba(139, 92, 246, 0.2)' : 'transparent', color: heatmapViewMode === '24h' ? '#8b5cf6' : 'var(--text-secondary)', cursor: 'pointer' }}
                          >
                            24 Jam
                          </button>
                          <button
                            type="button"
                            onClick={() => setHeatmapViewMode('time_bands')}
                            style={{ minHeight: '44px', padding: '0 0.6rem', fontSize: '0.68rem', fontWeight: 700, border: 'none', borderRadius: '4px', backgroundColor: heatmapViewMode === 'time_bands' ? 'rgba(139, 92, 246, 0.2)' : 'transparent', color: heatmapViewMode === 'time_bands' ? '#8b5cf6' : 'var(--text-secondary)', cursor: 'pointer' }}
                          >
                            4 Blok
                          </button>
                        </div>
                      </div>

                      {heatmapViewMode === '24h' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0.35rem', alignItems: 'end', height: '180px', flex: 1, paddingBottom: '0.5rem' }}>
                          {telemetryData.hourly_heatmap.map((h, idx) => {
                            const heightPercent = Math.max(12, Math.round((h.views / maxViews) * 100));
                            return (
                              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', height: '100%', justifyContent: 'flex-end' }}>
                                <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{h.views}</span>
                                <div
                                  title={`Pukul ${h.hour}:00 UTC - ${h.views} tayangan`}
                                  style={{
                                    width: '100%',
                                    height: `${heightPercent}%`,
                                    maxHeight: '140px',
                                    borderRadius: '3px',
                                    backgroundColor: h.views === maxViews && h.views > 0 ? '#8b5cf6' : h.views > 0 ? 'rgba(139, 92, 246, 0.45)' : 'var(--bg-deep)'
                                  }}
                                />
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{h.hour}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', flex: 1, alignContent: 'center' }}>
                          {timeBands.bands.map((band) => (
                            <div key={band.key} style={{ padding: '0.6rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                <span>{band.label}</span>
                                <span style={{ color: '#8b5cf6' }}>{band.percentage.toFixed(0)}%</span>
                              </div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                {band.range} &bull; {formatNumber(band.views)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Real-Time Live Feed */}
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Activity size={15} style={{ color: '#10b981' }} />
                      <span>Live Stream Telemetri Real-Time</span>
                    </h4>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {([
                      { key: 'all', label: `Semua (${telemetryData.recent_visitors.length})` },
                      { key: 'store_view', label: 'Katalog' },
                      { key: 'product_view', label: 'Item Produk' },
                      { key: 'action_wa', label: 'WhatsApp' },
                      { key: 'rekber_click', label: 'Rekber' }
                    ] as const).map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setLiveEventFilter(f.key)}
                        style={{
                          minHeight: '44px',
                          padding: '0 0.75rem',
                          borderRadius: '0.45rem',
                          border: `1px solid ${liveEventFilter === f.key ? '#10b981' : 'var(--border-light)'}`,
                          backgroundColor: liveEventFilter === f.key ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-deep)',
                          color: liveEventFilter === f.key ? '#10b981' : 'var(--text-secondary)',
                          fontSize: '0.72rem',
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
                  {telemetryData.recent_visitors.length > 0 ? (
                    telemetryData.recent_visitors
                      .filter((ev) => {
                        if (liveEventFilter === 'all') return true;
                        if (liveEventFilter === 'action_wa') return ev.event === 'action_wa' || ev.event === 'direct_wa_click';
                        return ev.event === liveEventFilter;
                      })
                      .map((ev, idx) => (
                        <div key={ev.id || idx} style={{ padding: '0.55rem 0.75rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.74rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              [{ev.store_slug}] {formatTelemetryEventLabel(ev.event, ev.product_name)}
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

              <div style={{ padding: '0.75rem 1rem', borderRadius: '0.65rem', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {TELEMETRY_PRIVACY_SUMMARY}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      ) : loading && !data ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--primary)', margin: '0 auto 0.75rem' }} />
          <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Memuat intelijen pasar B2B...</p>
        </div>
      ) : error ? (
        <div role="alert" style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <AlertCircle size={18} />
          <span style={{ fontSize: '0.8rem', flex: 1 }}>{error}</span>
          <button
            type="button"
            onClick={() => loadMarketIntel()}
            style={{ minHeight: '44px', padding: '0 0.9rem', borderRadius: '0.5rem', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
          >
            Coba Lagi
          </button>
        </div>
      ) : data ? (
        <div role="tabpanel" aria-labelledby={`tablet-tab-${activeSegment}`} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {activeSegment === 'overview' && (
            <>
              {/* 4 Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Total Produk Aktif</span>
                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                    {formatNumber(data.total_active_products)}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{formatNumber(data.total_active_stores)} Toko</span>
                </div>

                <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Interaksi 30 Hari</span>
                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#10b981', marginTop: '0.2rem' }}>
                    {formatNumber(data.total_views_30d)}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{formatNumber(data.total_actions_30d)} Tindakan</span>
                </div>

                <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Rasio Konversi</span>
                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#f59e0b', marginTop: '0.2rem' }}>
                    {formatPercent(data.overall_conversion_rate, 1)}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Kunjungan ke transaksi</span>
                </div>

                <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Demand Gaps</span>
                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#ef4444', marginTop: '0.2rem' }}>
                    {formatNumber(demandGaps.length)} Tren
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Pencarian nihil hasil</span>
                </div>
              </div>

              {/* Channel Breakdown */}
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <BarChart3 size={15} style={{ color: '#3b82f6' }} />
                  <span>Saluran Minat Belanja Konsumen</span>
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  <div style={{ padding: '0.65rem 0.75rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>WA Direct ({formatNumber(data.channel_breakdown.direct_wa_clicks)})</span>
                    <strong style={{ fontSize: '0.78rem', color: '#10b981' }}>{formatPercent(data.channel_breakdown.direct_wa_percent, 1)}</strong>
                  </div>
                  <div style={{ padding: '0.65rem 0.75rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Rekber ({formatNumber(data.channel_breakdown.rekber_clicks)})</span>
                    <strong style={{ fontSize: '0.78rem', color: '#3b82f6' }}>{formatPercent(data.channel_breakdown.rekber_percent, 1)}</strong>
                  </div>
                  <div style={{ padding: '0.65rem 0.75rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Marketplace ({formatNumber(data.channel_breakdown.marketplace_clicks)})</span>
                    <strong style={{ fontSize: '0.78rem', color: '#f59e0b' }}>{formatPercent(data.channel_breakdown.marketplace_percent, 1)}</strong>
                  </div>
                  <div style={{ padding: '0.65rem 0.75rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Video Review ({formatNumber(data.channel_breakdown.video_views)})</span>
                    <strong style={{ fontSize: '0.78rem', color: '#8b5cf6' }}>{formatPercent(data.channel_breakdown.video_views_percent, 1)}</strong>
                  </div>
                </div>
              </div>

              {/* Top Categories */}
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Layers size={15} style={{ color: '#8b5cf6' }} />
                    <span>Kategori Paling Diminati</span>
                  </h4>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>K-Anonymity &ge; {kMinStores} toko</span>
                </div>
                {data.top_categories.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    {data.top_categories.slice(0, 6).map((cat, idx) => (
                      <div key={idx} style={{ padding: '0.65rem 0.75rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>{cat.category_name}</div>
                          <div style={{ fontSize: '0.66rem', color: 'var(--text-secondary)' }}>
                            {formatNumber(cat.product_count)} produk &bull; {formatNumber(cat.unique_store_count)} toko
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#10b981' }}>{formatPercent(cat.conversion_rate, 1)}</div>
                          <div style={{ fontSize: '0.66rem', color: 'var(--text-secondary)' }}>{formatIDR(cat.average_price)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.76rem' }}>
                    Belum ada kategori dengan minimal {kMinStores} toko unik aktif.
                  </div>
                )}
              </div>

              {/* Catalog Quality & Supply Dynamics */}
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: '0 0 0.65rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={15} style={{ color: '#10b981' }} />
                  <span>Wawasan Kualitas Katalog &amp; Dinamika Suplai</span>
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  <div style={{ padding: '0.6rem 0.75rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Konversi 4+ Foto vs 1 Foto</div>
                    <strong style={{ fontSize: '0.82rem', color: '#10b981' }}>
                      {formatPercent(data.catalog_quality_benchmarks.multi_photo_conversion_rate)} vs {formatPercent(data.catalog_quality_benchmarks.single_photo_conversion_rate)}
                    </strong>
                  </div>
                  <div style={{ padding: '0.6rem 0.75rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Multiplier Video &amp; Rekber</div>
                    <strong style={{ fontSize: '0.82rem', color: '#3b82f6' }}>
                      {data.catalog_quality_benchmarks.video_boost_multiplier.toFixed(2)}x video &bull; {formatPercent(data.catalog_quality_benchmarks.rekber_trust_adoption_rate)} rekber
                    </strong>
                  </div>
                  <div style={{ padding: '0.6rem 0.75rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Dinamika Harga</div>
                    <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      Naik {formatPercent(data.supply_side_dynamics.price_increase_ratio)} / Turun {formatPercent(data.supply_side_dynamics.price_decrease_ratio)}
                    </strong>
                  </div>
                  <div style={{ padding: '0.6rem 0.75rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Listing Baru 30H</div>
                    <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      {formatNumber(data.supply_side_dynamics.new_listings_30d)} item
                    </strong>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Section 2: Hype & Demand Gap */}
          {activeSegment === 'demand_gap' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 0.45rem 0', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Search size={16} style={{ color: '#3b82f6' }} />
                  <span>Kata Kunci Paling Dicari ({trendingKeywords.length})</span>
                </h4>
                {trendingKeywords.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    {trendingKeywords.slice(0, 12).map((item, idx) => (
                      <div key={idx} style={{ padding: '0.6rem 0.8rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.keyword}</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                            {formatProductTypeLabel(item.product_type)} &bull; CTR {formatPercent(item.ctr, 1)}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.18rem 0.45rem', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', flexShrink: 0 }}>
                          {formatNumber(item.search_volume)}x
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                    Belum ada kata kunci pencarian terkumpul dalam periode 30 hari terakhir.
                  </div>
                )}
              </div>

              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 0.45rem 0', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <ArrowUpRight size={17} style={{ color: '#f59e0b' }} />
                  <span>Peluang Pasokan Baru (Demand Gap - Nihil Hasil)</span>
                </h4>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem 0', lineHeight: 1.45 }}>
                  Konsumen mencari produk berikut tetapi etalase toko belum menyediakannya.
                </p>
                {demandGaps.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    {demandGaps.map((gap, idx) => (
                      <div key={idx} style={{ padding: '0.65rem 0.85rem', borderRadius: '0.55rem', backgroundColor: 'var(--bg-deep)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gap.keyword}</span>
                          <span style={{ fontSize: '0.65rem', color: '#f59e0b' }}>
                            {formatProductTypeLabel(gap.product_type)} &bull; {formatPercent(computeGapRatio(gap.zero_result_count, gap.total_searches), 0)} nihil
                          </span>
                        </div>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '0.18rem 0.45rem', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', flexShrink: 0 }}>
                          {formatNumber(gap.zero_result_count)}x nihil
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                    Tidak ada pencarian nihil hasil dalam periode saat ini.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 3: Price Benchmarks with P25, Median, Avg, P75, Min, Max */}
          {activeSegment === 'benchmarks' && (
            <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Layers size={16} style={{ color: '#10b981' }} />
                  <span>Benchmark Kuartil Harga Pasar per Kategori</span>
                </h4>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>K-Anonymity &ge; {kMinStores} Toko</span>
              </div>

              {data.price_benchmarks.length > 0 ? (
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Tabel Benchmark Kuartil Harga Pasar Tablet"
                  className="tablet-sticky-table-container catavor-table-scrollbar"
                  style={{
                    maxHeight: 'min(48vh, 440px)',
                    overflowY: 'auto',
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    borderRadius: '0.65rem',
                    border: '1px solid var(--border-light)'
                  }}
                >
                  <table className="tablet-sticky-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.74rem' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)', textAlign: 'left', backgroundColor: 'var(--bg-deep)' }}>
                        <th className="sticky-col" style={{ padding: '0.6rem 0.75rem', position: 'sticky', left: 0, top: 0, zIndex: 20, backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', borderRight: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                          Kategori
                        </th>
                        <th style={{ padding: '0.6rem 0.65rem', position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>Industri</th>
                        <th style={{ padding: '0.6rem 0.65rem', position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap', textAlign: 'right' }}>Min</th>
                        <th style={{ padding: '0.6rem 0.65rem', position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap', textAlign: 'right' }}>P25</th>
                        <th style={{ padding: '0.6rem 0.65rem', position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap', textAlign: 'right' }}>Median</th>
                        <th style={{ padding: '0.6rem 0.65rem', position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap', textAlign: 'right' }}>Rata-rata</th>
                        <th style={{ padding: '0.6rem 0.65rem', position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap', textAlign: 'right' }}>P75</th>
                        <th style={{ padding: '0.6rem 0.65rem', position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap', textAlign: 'right' }}>Maks</th>
                        <th style={{ padding: '0.6rem 0.65rem', position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap', textAlign: 'right' }}>Sampel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.price_benchmarks.map((pb, idx) => (
                        <tr key={idx}>
                          <td className="sticky-col" style={{ padding: '0.55rem 0.75rem', fontWeight: 700, position: 'sticky', left: 0, zIndex: 5, backgroundColor: 'var(--bg-card)', borderBottom: '1px dashed var(--border-light)', borderRight: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                            {pb.category_name}
                          </td>
                          <td style={{ padding: '0.55rem 0.65rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-light)', whiteSpace: 'nowrap' }}>{formatProductTypeLabel(pb.product_type)}</td>
                          <td style={{ padding: '0.55rem 0.65rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-light)', whiteSpace: 'nowrap', textAlign: 'right' }}>{formatIDR(pb.min_price)}</td>
                          <td style={{ padding: '0.55rem 0.65rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-light)', whiteSpace: 'nowrap', textAlign: 'right' }}>{formatIDR(pb.p25_price)}</td>
                          <td style={{ padding: '0.55rem 0.65rem', fontWeight: 700, color: '#3b82f6', borderBottom: '1px dashed var(--border-light)', whiteSpace: 'nowrap', textAlign: 'right' }}>{formatIDR(pb.median_price)}</td>
                          <td style={{ padding: '0.55rem 0.65rem', fontWeight: 800, color: '#10b981', borderBottom: '1px dashed var(--border-light)', whiteSpace: 'nowrap', textAlign: 'right' }}>{formatIDR(pb.avg_price)}</td>
                          <td style={{ padding: '0.55rem 0.65rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-light)', whiteSpace: 'nowrap', textAlign: 'right' }}>{formatIDR(pb.p75_price)}</td>
                          <td style={{ padding: '0.55rem 0.65rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-light)', whiteSpace: 'nowrap', textAlign: 'right' }}>{formatIDR(pb.max_price)}</td>
                          <td style={{ padding: '0.55rem 0.65rem', color: 'var(--text-muted)', borderBottom: '1px dashed var(--border-light)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                            {formatNumber(pb.sample_count)} item / {formatNumber(pb.unique_store_count)} toko
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                  Belum ada benchmark harga yang memenuhi ambang privasi K-Anonymity (minimal {kMinStores} toko unik dengan harga aktif).
                </div>
              )}
            </div>
          )}

          {/* Legal PDP Notice */}
          <div style={{ padding: '0.75rem 1rem', borderRadius: '0.65rem', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} style={{ color: '#10b981', flexShrink: 0 }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {data.data_privacy_notice || PRIVACY_COMPLIANCE_SUMMARY}
            </span>
          </div>
        </div>
      ) : null}

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
