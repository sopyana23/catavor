import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  TrendingUp,
  Download,
  ShieldCheck,
  Zap,
  Layers,
  RefreshCw,
  AlertCircle,
  Search,
  BarChart3,
  Tag,
  AlertTriangle,
  FileSpreadsheet,
  Users,
  Activity,
  Radio,
  Smartphone,
  Compass,
  Clock,
  CheckCircle2,
  Store
} from 'lucide-react';
import { MobileDimensionSheet } from './MobileDimensionSheet';
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

export interface MobileMarketIntelViewProps {
  token: string;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
  themeMode?: 'dark' | 'light';
  canTriggerBot?: boolean;
  revision?: number;
}

export const MobileMarketIntelView: React.FC<MobileMarketIntelViewProps> = ({
  token,
  showToast,
  themeMode,
  canTriggerBot = false,
  revision = 0
}) => {
  const isDark = themeMode
    ? themeMode === 'dark'
    : document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');

  const [data, setData] = useState<MarketIntelligenceData | null>(null);
  const [trendingKeywords, setTrendingKeywords] = useState<TrendingKeywordItem[]>([]);
  const [demandGaps, setDemandGaps] = useState<DemandGapItem[]>([]);
  const [partialWarning, setPartialWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<'csv' | 'json' | null>(null);
  const [isTriggeringBot, setIsTriggeringBot] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'keywords' | 'demand_gaps' | 'benchmarks' | 'telemetry'>('overview');

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
    if (activeTab !== 'telemetry') return;
    const controller = new AbortController();
    loadGlobalTelemetry(telemetryPeriod, controller.signal);
    return () => controller.abort();
  }, [activeTab, telemetryPeriod, revision, loadGlobalTelemetry]);

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
        if (activeTab === 'telemetry') {
          loadGlobalTelemetry(telemetryPeriod);
        }
      }, 1200);
    } catch (err: unknown) {
      showToast?.(err instanceof Error ? err.message : 'Gagal memicu bot agregasi.', 'error');
    } finally {
      setIsTriggeringBot(false);
    }
  };

  const theme = {
    surface: isDark ? 'rgba(30, 41, 59, 0.7)' : '#ffffff',
    cardAlt: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
    border: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    accent: '#0284c7'
  };

  const kMinStores = data?.k_anonymity_min_stores || 3;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', paddingBottom: '3rem', maxWidth: '100%', overflowX: 'hidden', animation: 'fadeIn 0.25s ease-out' }}>
      {/* 1. Header Hero Banner */}
      <div style={{ backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}`, padding: '0.95rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '0.75rem', backgroundColor: isDark ? 'rgba(2, 132, 199, 0.2)' : 'rgba(2, 132, 199, 0.1)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <TrendingUp size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: theme.textPrimary, letterSpacing: '-0.01em' }}>
                Riset Pasar B2B
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: theme.textSecondary }}>
                Data agregat tren &amp; benchmark harga ({PRIVACY_BADGE_LABEL})
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Segarkan Data Riset Pasar"
            onClick={() => {
              loadMarketIntel();
              if (activeTab === 'telemetry') {
                loadGlobalTelemetry(telemetryPeriod);
              }
            }}
            disabled={loading || telemetryLoading}
            style={{
              minWidth: '44px',
              minHeight: '44px',
              borderRadius: '0.65rem',
              border: `1px solid ${theme.border}`,
              backgroundColor: theme.cardAlt,
              color: theme.textPrimary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
            title="Segarkan Data"
          >
            <RefreshCw size={17} className={loading || telemetryLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Legal & Privacy Compliance Badge */}
        <div style={{ marginTop: '0.8rem', padding: '0.6rem 0.75rem', borderRadius: '0.65rem', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <ShieldCheck size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isDark ? '#6ee7b7' : '#047857', lineHeight: 1.35 }}>
            {PRIVACY_COMPLIANCE_SUMMARY}
          </span>
        </div>
      </div>

      {/* 2. Key Metrics Grid (2x2 Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.65rem' }}>
        <div style={{ backgroundColor: theme.surface, borderRadius: '0.85rem', padding: '0.85rem', border: `1px solid ${theme.border}` }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: theme.textSecondary, display: 'block', marginBottom: '0.2rem' }}>
            Produk Aktif
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: theme.textPrimary }}>
              {data ? formatNumber(data.total_active_products) : '-'}
            </span>
            <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>
              ({data ? formatNumber(data.total_active_stores) : 0} toko)
            </span>
          </div>
        </div>

        <div style={{ backgroundColor: theme.surface, borderRadius: '0.85rem', padding: '0.85rem', border: `1px solid ${theme.border}` }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: theme.textSecondary, display: 'block', marginBottom: '0.2rem' }}>
            Interaksi (30 Hari)
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0284c7' }}>
              {data ? formatNumber(data.total_views_30d) : '-'}
            </span>
            <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>
              {data ? formatNumber(data.total_actions_30d) : 0} aksi
            </span>
          </div>
        </div>

        <div style={{ backgroundColor: theme.surface, borderRadius: '0.85rem', padding: '0.85rem', border: `1px solid ${theme.border}` }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: theme.textSecondary, display: 'block', marginBottom: '0.2rem' }}>
            Rerata Konversi
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>
              {data ? formatPercent(data.overall_conversion_rate, 1) : '-'}
            </span>
            <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>dari views</span>
          </div>
        </div>

        <div style={{ backgroundColor: theme.surface, borderRadius: '0.85rem', padding: '0.85rem', border: `1px solid ${demandGaps.length > 0 ? (isDark ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.25)') : theme.border}` }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: theme.textSecondary, display: 'block', marginBottom: '0.2rem' }}>
            Demand Gap Nihil
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: demandGaps.length > 0 ? '#ef4444' : theme.textPrimary }}>
              {formatNumber(demandGaps.length)}
            </span>
            <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>kata kunci</span>
          </div>
        </div>
      </div>

      {/* 3. Action Buttons (Touch Targets >= 44px) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.55rem' }}>
          <button
            type="button"
            onClick={() => handleDownloadExport('csv')}
            disabled={exportingFormat !== null || !data}
            style={{
              minHeight: '44px',
              borderRadius: '0.75rem',
              border: 'none',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontSize: '0.76rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
              padding: '0 0.65rem',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)'
            }}
          >
            <Download size={16} />
            <span>{exportingFormat === 'csv' ? 'Menyiapkan...' : 'Unduh CSV Riset'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadExport('json')}
            disabled={exportingFormat !== null || !data}
            style={{
              minHeight: '44px',
              borderRadius: '0.75rem',
              border: `1px solid ${theme.border}`,
              backgroundColor: theme.surface,
              color: theme.textPrimary,
              fontSize: '0.76rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
              padding: '0 0.65rem'
            }}
          >
            <FileSpreadsheet size={16} />
            <span>{exportingFormat === 'json' ? 'Menyiapkan...' : 'Unduh JSON'}</span>
          </button>
        </div>

        {canTriggerBot && (
          <button
            type="button"
            onClick={handleTriggerAggregation}
            disabled={isTriggeringBot || loading}
            style={{
              minHeight: '44px',
              width: '100%',
              borderRadius: '0.75rem',
              border: `1px solid ${theme.border}`,
              backgroundColor: theme.surface,
              color: theme.textPrimary,
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              cursor: 'pointer',
              padding: '0 0.75rem'
            }}
          >
            <Zap size={16} className={isTriggeringBot ? 'animate-spin' : ''} style={{ color: '#f59e0b' }} />
            <span>{isTriggeringBot ? 'Memproses Agregasi...' : 'Picu Bot Agregasi'}</span>
          </button>
        )}
      </div>

      {/* 4. Single-Row Horizontally Scrollable Accessible Tablist */}
      <div
        role="tablist"
        aria-label="Navigasi Riset Pasar Mobile"
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          scrollSnapType: 'inline proximity',
          gap: '0.35rem',
          backgroundColor: theme.cardAlt,
          padding: '0.25rem',
          borderRadius: '0.85rem',
          border: `1px solid ${theme.border}`,
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {([
          { key: 'overview', label: 'Ringkasan' },
          { key: 'keywords', label: 'Hype' },
          { key: 'demand_gaps', label: 'Gap Nihil' },
          { key: 'benchmarks', label: 'Harga' },
          { key: 'telemetry', label: 'Telemetri' }
        ] as const).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`mobile-tab-${tab.key}`}
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              style={{
                minHeight: '44px',
                scrollSnapAlign: 'start',
                borderRadius: '0.65rem',
                border: 'none',
                borderBottom: isActive ? '3px solid #0369a1' : '3px solid transparent',
                backgroundColor: isActive ? '#0284c7' : 'transparent',
                color: isActive ? '#ffffff' : theme.textSecondary,
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.74rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 0.75rem',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              {tab.key === 'telemetry' && <Radio size={13} style={{ marginRight: '0.3rem' }} />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {partialWarning && activeTab !== 'telemetry' && (
        <div
          role="status"
          style={{
            padding: '0.75rem',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: isDark ? '#fbbf24' : '#b45309',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.74rem',
            fontWeight: 600
          }}
        >
          <AlertTriangle size={16} />
          <span>{partialWarning}</span>
        </div>
      )}

      {/* 5. Loading & Error States */}
      {activeTab !== 'telemetry' && loading && !data && (
        <div style={{ padding: '2.5rem 1rem', textAlign: 'center', backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}` }}>
          <RefreshCw size={24} className="animate-spin" style={{ color: '#0284c7', margin: '0 auto 0.75rem auto' }} />
          <p style={{ margin: 0, fontSize: '0.82rem', color: theme.textSecondary }}>
            Menghubungkan ke pusat intelijen pasar...
          </p>
        </div>
      )}

      {activeTab !== 'telemetry' && error && (
        <div role="alert" style={{ padding: '1rem', borderRadius: '0.85rem', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
            <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ef4444', display: 'block' }}>
                Gagal Memuat Riset
              </span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.74rem', color: theme.textSecondary }}>
                {error}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadMarketIntel()}
            style={{ minHeight: '44px', width: '100%', borderRadius: '0.65rem', border: 'none', backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
          >
            Muat Ulang Data Riset
          </button>
        </div>
      )}

      {/* TAB A: OVERVIEW */}
      {activeTab === 'overview' && data && (
        <div role="tabpanel" aria-labelledby="mobile-tab-overview" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {/* Channel Breakdown */}
          <div style={{ backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}`, padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <BarChart3 size={18} style={{ color: '#0284c7' }} />
              <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                Distribusi Kanal Aksi Pengguna
              </h4>
            </div>

            {data.channel_breakdown.total_actions > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { label: 'Klik WhatsApp Direct', percent: data.channel_breakdown.direct_wa_percent, count: data.channel_breakdown.direct_wa_clicks, color: '#10b981' },
                  { label: 'Kunjungan Marketplace', percent: data.channel_breakdown.marketplace_percent, count: data.channel_breakdown.marketplace_clicks, color: '#f59e0b' },
                  { label: 'Eksplorasi Rekber Syariah', percent: data.channel_breakdown.rekber_percent, count: data.channel_breakdown.rekber_clicks, color: '#6366f1' },
                  { label: 'Pemutaran Video Katalog', percent: data.channel_breakdown.video_views_percent, count: data.channel_breakdown.video_views, color: '#ec4899' }
                ].map((ch) => (
                  <div key={ch.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                      <span style={{ fontWeight: 600, color: theme.textPrimary }}>{ch.label}</span>
                      <span style={{ fontWeight: 800, color: ch.color }}>{formatPercent(ch.percent, 1)} ({formatNumber(ch.count)})</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, Math.max(0, ch.percent))}%`, height: '100%', backgroundColor: ch.color, borderRadius: '999px' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.76rem', color: theme.textSecondary, backgroundColor: theme.cardAlt, borderRadius: '0.75rem' }}>
                Belum ada interaksi kanal pembelian tercatat dalam 30 hari terakhir.
              </div>
            )}
          </div>

          {/* Top Categories */}
          <div style={{ backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}`, padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} style={{ color: '#8b5cf6' }} />
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                  Kategori Paling Diminati
                </h4>
              </div>
              <span style={{ fontSize: '0.66rem', color: theme.textSecondary }}>&ge; {kMinStores} toko</span>
            </div>

            {data.top_categories.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {data.top_categories.slice(0, 6).map((cat, idx) => (
                  <div key={idx} style={{ padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: theme.cardAlt, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: theme.textPrimary, display: 'block' }}>
                        {cat.category_name}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: theme.textSecondary }}>
                        {formatNumber(cat.product_count)} produk &bull; {formatNumber(cat.unique_store_count)} toko &bull; {formatNumber(cat.total_views)} views
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#10b981', display: 'block' }}>
                        {formatPercent(cat.conversion_rate, 1)} CTR
                      </span>
                      <span style={{ fontSize: '0.68rem', color: theme.textSecondary }}>
                        Rerata {formatIDR(cat.average_price)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.76rem', color: theme.textSecondary, backgroundColor: theme.cardAlt, borderRadius: '0.75rem' }}>
                Belum ada kategori yang memenuhi ambang privasi K-Anonymity (minimal {kMinStores} toko unik aktif).
              </div>
            )}
          </div>

          {/* Catalog Quality & Supply Dynamics */}
          <div style={{ backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}`, padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <ShieldCheck size={18} style={{ color: '#10b981' }} />
              <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                Kualitas Katalog &amp; Dinamika Suplai
              </h4>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.55rem' }}>
              <div style={{ padding: '0.7rem', borderRadius: '0.75rem', backgroundColor: theme.cardAlt, border: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: '0.66rem', color: theme.textSecondary, display: 'block' }}>4+ Foto vs 1 Foto</span>
                <strong style={{ fontSize: '0.8rem', color: '#10b981' }}>
                  {formatPercent(data.catalog_quality_benchmarks.multi_photo_conversion_rate)} vs {formatPercent(data.catalog_quality_benchmarks.single_photo_conversion_rate)}
                </strong>
              </div>
              <div style={{ padding: '0.7rem', borderRadius: '0.75rem', backgroundColor: theme.cardAlt, border: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: '0.66rem', color: theme.textSecondary, display: 'block' }}>Video Boost &amp; Rekber</span>
                <strong style={{ fontSize: '0.8rem', color: '#0284c7' }}>
                  {data.catalog_quality_benchmarks.video_boost_multiplier.toFixed(2)}x &bull; {formatPercent(data.catalog_quality_benchmarks.rekber_trust_adoption_rate)}
                </strong>
              </div>
              <div style={{ padding: '0.7rem', borderRadius: '0.75rem', backgroundColor: theme.cardAlt, border: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: '0.66rem', color: theme.textSecondary, display: 'block' }}>Naik / Turun Harga</span>
                <strong style={{ fontSize: '0.8rem', color: theme.textPrimary }}>
                  {formatPercent(data.supply_side_dynamics.price_increase_ratio)} / {formatPercent(data.supply_side_dynamics.price_decrease_ratio)}
                </strong>
              </div>
              <div style={{ padding: '0.7rem', borderRadius: '0.75rem', backgroundColor: theme.cardAlt, border: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: '0.66rem', color: theme.textSecondary, display: 'block' }}>Listing Baru (30H)</span>
                <strong style={{ fontSize: '0.8rem', color: theme.textPrimary }}>
                  {formatNumber(data.supply_side_dynamics.new_listings_30d)} item
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB B: HYPE KEYWORDS */}
      {activeTab === 'keywords' && (
        <div role="tabpanel" aria-labelledby="mobile-tab-keywords" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}`, padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <Search size={18} style={{ color: '#0284c7' }} />
              <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                Kata Kunci Paling Dicari ({formatNumber(trendingKeywords.length)})
              </h4>
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: theme.textSecondary }}>
              Kata kunci organik dengan volume pencarian tertinggi dari calon pembeli.
            </p>
          </div>

          {trendingKeywords.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}` }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: theme.textSecondary }}>
                Belum ada data kata kunci yang terkumpul dalam periode 30 hari terakhir.
              </p>
            </div>
          ) : (
            trendingKeywords.map((item, idx) => (
              <div key={idx} style={{ padding: '0.85rem', borderRadius: '0.85rem', backgroundColor: theme.surface, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                    <Tag size={15} style={{ color: '#0284c7', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.keyword}
                    </span>
                  </div>
                  <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.64rem', fontWeight: 700, backgroundColor: isDark ? 'rgba(2, 132, 199, 0.2)' : 'rgba(2, 132, 199, 0.1)', color: '#0284c7', flexShrink: 0 }}>
                    {formatProductTypeLabel(item.product_type)}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', marginTop: '0.2rem', paddingTop: '0.45rem', borderTop: `1px dashed ${theme.border}` }}>
                  <div>
                    <span style={{ fontSize: '0.64rem', color: theme.textSecondary, display: 'block' }}>Pencarian</span>
                    <strong style={{ fontSize: '0.78rem', color: theme.textPrimary }}>{formatNumber(item.search_volume)}x</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.64rem', color: theme.textSecondary, display: 'block' }}>Nihil (0)</span>
                    <strong style={{ fontSize: '0.78rem', color: item.zero_count > 0 ? '#ef4444' : theme.textPrimary }}>
                      {formatNumber(item.zero_count)}x
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.64rem', color: theme.textSecondary, display: 'block' }}>CTR Estimasi</span>
                    <strong style={{ fontSize: '0.78rem', color: '#10b981' }}>{formatPercent(item.ctr, 1)}</strong>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB C: DEMAND GAPS */}
      {activeTab === 'demand_gaps' && (
        <div role="tabpanel" aria-labelledby="mobile-tab-demand_gaps" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}`, padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <AlertTriangle size={18} style={{ color: '#ef4444' }} />
              <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                Demand Gap: Pencarian Tanpa Hasil ({formatNumber(demandGaps.length)})
              </h4>
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: theme.textSecondary }}>
              Permintaan pasar nyata yang belum terpenuhi oleh katalog merchant saat ini.
            </p>
          </div>

          {demandGaps.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}` }}>
              <ShieldCheck size={28} style={{ color: '#10b981', margin: '0 auto 0.5rem auto' }} />
              <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: theme.textPrimary }}>
                Katalog Optimal
              </p>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.72rem', color: theme.textSecondary }}>
                Tidak ditemukan kata kunci yang menghasilkan pencarian 0 hasil pada periode ini.
              </p>
            </div>
          ) : (
            demandGaps.map((gap, idx) => (
              <div key={idx} style={{ padding: '0.85rem', borderRadius: '0.85rem', backgroundColor: theme.surface, border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.2)'}`, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {gap.keyword}
                  </span>
                  <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.64rem', fontWeight: 700, backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)', color: '#ef4444', flexShrink: 0 }}>
                    {formatNumber(gap.zero_result_count)}x nihil ({formatPercent(computeGapRatio(gap.zero_result_count, gap.total_searches), 0)})
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.35rem', borderTop: `1px dashed ${theme.border}`, fontSize: '0.72rem' }}>
                  <span style={{ color: theme.textSecondary }}>Industri:</span>
                  <span style={{ fontWeight: 700, color: '#0284c7' }}>
                    {formatProductTypeLabel(gap.product_type)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB D: PRICE BENCHMARKS */}
      {activeTab === 'benchmarks' && data && (
        <div role="tabpanel" aria-labelledby="mobile-tab-benchmarks" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}`, padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <FileSpreadsheet size={18} style={{ color: '#10b981' }} />
              <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                Benchmark Kuartil Harga Pasar
              </h4>
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: theme.textSecondary }}>
              Kuartil harga wajar P25, Median, Rata-rata, dan P75 (K-Anonymity &ge; {kMinStores} toko unik).
            </p>
          </div>

          {data.price_benchmarks.length > 0 ? (
            data.price_benchmarks.map((b, idx) => (
              <div key={idx} style={{ padding: '0.85rem', borderRadius: '0.85rem', backgroundColor: theme.surface, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.86rem', fontWeight: 800, color: theme.textPrimary, display: 'block' }}>
                      {b.category_name}
                    </span>
                    <span style={{ fontSize: '0.66rem', color: theme.textSecondary }}>
                      {formatProductTypeLabel(b.product_type)}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: theme.textSecondary, fontWeight: 600 }}>
                    {formatNumber(b.sample_count)} item &bull; {formatNumber(b.unique_store_count)} toko
                  </span>
                </div>

                <div style={{ padding: '0.65rem', borderRadius: '0.65rem', backgroundColor: theme.cardAlt, border: `1px solid ${theme.border}`, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.64rem', color: theme.textSecondary, display: 'block' }}>Rerata Pasar</span>
                    <strong style={{ fontSize: '0.88rem', color: '#10b981', fontWeight: 900 }}>{formatIDR(b.avg_price)}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.64rem', color: theme.textSecondary, display: 'block' }}>Median (P50)</span>
                    <strong style={{ fontSize: '0.88rem', color: '#3b82f6', fontWeight: 800 }}>{formatIDR(b.median_price)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.64rem', color: theme.textSecondary, display: 'block' }}>Kuartil Bawah (P25)</span>
                    <strong style={{ fontSize: '0.78rem', color: theme.textPrimary }}>{formatIDR(b.p25_price)}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.64rem', color: theme.textSecondary, display: 'block' }}>Kuartil Atas (P75)</span>
                    <strong style={{ fontSize: '0.78rem', color: theme.textPrimary }}>{formatIDR(b.p75_price)}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: theme.textSecondary }}>
                  <span>Min: {formatIDR(b.min_price)}</span>
                  <span>Maks: {formatIDR(b.max_price)}</span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}` }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: theme.textSecondary }}>
                Belum ada benchmark harga yang memenuhi ambang privasi K-Anonymity (minimal {kMinStores} toko unik dengan harga aktif).
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB E: TELEMETRY */}
      {activeTab === 'telemetry' && (
        <div role="tabpanel" aria-labelledby="mobile-tab-telemetry" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div style={{ backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}`, padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '0.65rem', backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Radio size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: theme.textPrimary }}>
                    Telemetri Audiens Global
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.68rem', color: theme.textSecondary }}>
                    Zero-PII HMAC Hashing &bull; UU PDP No. 27/2022
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Segarkan Telemetri"
                onClick={() => loadGlobalTelemetry(telemetryPeriod)}
                disabled={telemetryLoading}
                style={{ minWidth: '44px', minHeight: '44px', borderRadius: '0.65rem', border: `1px solid ${theme.border}`, backgroundColor: theme.cardAlt, color: theme.textPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <RefreshCw size={15} className={telemetryLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {(['7d', '30d', '90d'] as const).map((p) => {
                const isActive = telemetryPeriod === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setTelemetryPeriod(p)}
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      borderRadius: '0.65rem',
                      border: 'none',
                      borderBottom: isActive ? '3px solid #1d4ed8' : '3px solid transparent',
                      backgroundColor: isActive ? '#3b82f6' : theme.cardAlt,
                      color: isActive ? '#ffffff' : theme.textSecondary,
                      fontSize: '0.74rem',
                      fontWeight: isActive ? 800 : 600,
                      cursor: 'pointer'
                    }}
                  >
                    {p === '7d' ? '7 Hari' : p === '30d' ? '30 Hari' : '90 Hari'}
                  </button>
                );
              })}
            </div>
          </div>

          {telemetryError && (
            <div role="alert" style={{ padding: '1rem', borderRadius: '0.85rem', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444' }}>{telemetryError}</span>
              <button
                type="button"
                onClick={() => loadGlobalTelemetry(telemetryPeriod)}
                style={{ minHeight: '44px', width: '100%', borderRadius: '0.65rem', border: 'none', backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' }}
              >
                Muat Ulang Telemetri
              </button>
            </div>
          )}

          {telemetryLoading && !telemetryData ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}` }}>
              <RefreshCw size={24} className="animate-spin" style={{ color: '#3b82f6', margin: '0 auto 0.75rem auto' }} />
              <p style={{ margin: 0, fontSize: '0.82rem', color: theme.textSecondary }}>
                Memuat data telemetri platform global...
              </p>
            </div>
          ) : telemetryData ? (
            <>
              {/* 4 KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.65rem' }}>
                <div style={{ backgroundColor: theme.surface, borderRadius: '0.85rem', padding: '0.85rem', border: `1px solid ${theme.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: theme.textSecondary }}>Total Kunjungan</span>
                    <Activity size={14} style={{ color: '#3b82f6' }} />
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: theme.textPrimary, marginTop: '0.2rem' }}>
                    {formatNumber(telemetryData.total_views)}
                  </div>
                  <span style={{ fontSize: '0.64rem', color: theme.textSecondary }}>
                    {formatNumber(telemetryData.total_product_views)} tayangan produk
                  </span>
                </div>

                <div style={{ backgroundColor: theme.surface, borderRadius: '0.85rem', padding: '0.85rem', border: `1px solid ${theme.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: theme.textSecondary }}>Pengunjung Unik</span>
                    <Users size={14} style={{ color: '#10b981' }} />
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981', marginTop: '0.2rem' }}>
                    {formatNumber(telemetryData.total_unique_visitors)}
                  </div>
                  <span style={{ fontSize: '0.64rem', color: theme.textSecondary }}>Zero-PII daily salt</span>
                </div>

                <div style={{ backgroundColor: theme.surface, borderRadius: '0.85rem', padding: '0.85rem', border: `1px solid ${theme.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: theme.textSecondary }}>Bounce Rate</span>
                    <TrendingUp size={14} style={{ color: '#f59e0b' }} />
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f59e0b', marginTop: '0.2rem' }}>
                    {formatPercent(telemetryData.bounce_rate_percent, 1)}
                  </div>
                  <span style={{ fontSize: '0.64rem', color: theme.textSecondary }}>
                    {formatNumber(telemetryData.total_bounces)} sesi tunggal
                  </span>
                </div>

                <div style={{ backgroundColor: theme.surface, borderRadius: '0.85rem', padding: '0.85rem', border: `1px solid ${theme.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: theme.textSecondary }}>Aksi Konversi</span>
                    <CheckCircle2 size={14} style={{ color: '#8b5cf6' }} />
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#8b5cf6', marginTop: '0.2rem' }}>
                    {formatNumber(telemetryData.total_actions)}
                  </div>
                  <span style={{ fontSize: '0.64rem', color: theme.textSecondary }}>
                    Rasio konversi {formatPercent(telemetryData.conversion_rate, 1)}
                  </span>
                </div>
              </div>

              {/* Top Stores Card List with CTR% */}
              <div style={{ backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}`, padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Store size={16} style={{ color: '#3b82f6' }} />
                    <h4 style={{ margin: 0, fontSize: '0.86rem', fontWeight: 800, color: theme.textPrimary }}>
                      Toko Terpopuler
                    </h4>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', backgroundColor: theme.cardAlt, padding: '2px', borderRadius: '8px', border: `1px solid ${theme.border}` }}>
                    {[5, 10].map((lim) => (
                      <button
                        key={lim}
                        type="button"
                        onClick={() => setTopStoresLimit(lim)}
                        style={{
                          minHeight: '44px',
                          padding: '0 0.65rem',
                          fontSize: '0.7rem',
                          fontWeight: topStoresLimit === lim ? 700 : 500,
                          border: 'none',
                          borderRadius: '6px',
                          backgroundColor: topStoresLimit === lim ? theme.surface : 'transparent',
                          color: topStoresLimit === lim ? theme.textPrimary : theme.textSecondary,
                          cursor: 'pointer'
                        }}
                      >
                        Top {lim}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {telemetryData.top_stores.length > 0 ? (
                    telemetryData.top_stores.slice(0, topStoresLimit).map((st, idx) => {
                      const ctr = st.views > 0 ? Math.min(100, (st.total_actions / st.views) * 100) : 0;
                      return (
                        <div key={st.store_id || idx} style={{ padding: '0.65rem 0.85rem', borderRadius: '0.65rem', backgroundColor: theme.cardAlt, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                            <span style={{ width: '26px', height: '26px', borderRadius: '0.45rem', backgroundColor: idx < 3 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)', color: idx < 3 ? '#10b981' : theme.textSecondary, fontWeight: 900, fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              #{idx + 1}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: theme.textPrimary, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {st.store_title}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: theme.textSecondary }}>
                                /{st.slug}
                              </span>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#3b82f6', display: 'block' }}>
                              {formatNumber(st.views)} views
                            </span>
                            <span style={{ fontSize: '0.66rem', color: '#10b981', fontWeight: 700 }}>
                              {formatNumber(st.total_actions)} aksi &bull; {formatPercent(ctr, 1)} CTR
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '1rem', textAlign: 'center', color: theme.textSecondary, fontSize: '0.75rem' }}>
                      Belum ada data kunjungan toko pada periode ini.
                    </div>
                  )}
                </div>
              </div>

              {/* 4-Card Global Audience Dimensions */}
              {(() => {
                const devicesResult = aggregateTopNDimensions(telemetryData.devices, 3, 'Perangkat Lainnya');
                const browsersResult = aggregateTopNDimensions(telemetryData.browsers, 5, 'Peramban Lainnya');
                const locationsResult = aggregateTopNDimensions(telemetryData.locations, 5, 'Kota Lainnya');
                const allOs = telemetryData.operating_systems;
                const visibleOs = isOsExpanded ? allOs : allOs.slice(0, 3);
                const remainingOsCount = Math.max(0, allOs.length - 3);
                const timeBands = computeHourlyTimeBands(telemetryData.hourly_heatmap);
                const maxViews = Math.max(...telemetryData.hourly_heatmap.map((item) => item.views), 1);

                return (
                  <>
                    {/* Devices & OS */}
                    <div style={{ backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}`, padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Smartphone size={16} style={{ color: '#10b981' }} />
                          <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                            Perangkat &amp; Sistem Operasi
                          </h4>
                        </div>
                        <span style={{ fontSize: '0.66rem', color: theme.textSecondary }}>
                          {devicesResult.totalItemsCount} perangkat
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                        {devicesResult.displayItems.length > 0 ? (
                          devicesResult.displayItems.map((d) => (
                            <div key={d.dimension_value} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                <span style={{ fontWeight: 700, color: theme.textPrimary }}>{d.name}</span>
                                <span style={{ fontWeight: 800, color: '#10b981' }}>{d.percentage.toFixed(0)}% ({formatNumber(d.views)})</span>
                              </div>
                              <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: theme.cardAlt, overflow: 'hidden' }}>
                                <div style={{ width: `${Math.max(4, Math.min(100, d.percentage))}%`, height: '100%', backgroundColor: '#10b981', borderRadius: '3px' }} />
                              </div>
                            </div>
                          ))
                        ) : (
                          <p style={{ margin: 0, fontSize: '0.74rem', color: theme.textSecondary }}>Belum ada data perangkat.</p>
                        )}
                      </div>

                      {allOs.length > 0 && (
                        <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: `1px solid ${theme.border}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: theme.textSecondary }}>
                              Sistem Operasi ({allOs.length})
                            </span>
                            {allOs.length > 3 && (
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
                                style={{ minHeight: '44px', padding: '0 0.65rem', borderRadius: '6px', backgroundColor: theme.cardAlt, border: `1px solid ${theme.border}`, color: '#3b82f6', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                              >
                                Lihat Semua
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {visibleOs.map((os) => (
                              <span key={os.dimension_value} style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '0.45rem', backgroundColor: theme.cardAlt, border: `1px solid ${theme.border}`, color: theme.textPrimary }}>
                                {os.name}: {os.percentage.toFixed(0)}%
                              </span>
                            ))}
                            {!isOsExpanded && remainingOsCount > 0 && (
                              <button
                                type="button"
                                onClick={() => setIsOsExpanded(true)}
                                style={{ minHeight: '44px', fontSize: '0.7rem', padding: '0 0.7rem', borderRadius: '6px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', color: '#3b82f6', fontWeight: 700, cursor: 'pointer' }}
                              >
                                +{remainingOsCount} Lainnya
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Browsers */}
                    <div style={{ backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}`, padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Compass size={16} style={{ color: '#3b82f6' }} />
                          <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                            Browser &amp; In-App Social
                          </h4>
                        </div>
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
                            style={{ minHeight: '44px', padding: '0 0.65rem', borderRadius: '6px', border: `1px solid ${theme.border}`, backgroundColor: theme.cardAlt, color: '#3b82f6', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Lihat ({browsersResult.totalItemsCount})
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.66rem', color: theme.textSecondary }}>Instagram / TikTok</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
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
                                  <span style={{ fontWeight: 700, color: isOthers ? '#3b82f6' : theme.textPrimary, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <span>{b.name}</span>
                                    {isInApp && (
                                      <span style={{ fontSize: '0.58rem', padding: '0.05rem 0.3rem', borderRadius: '4px', backgroundColor: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', fontWeight: 700 }}>
                                        In-App
                                      </span>
                                    )}
                                  </span>
                                  <span style={{ fontWeight: 800, color: '#3b82f6' }}>{b.percentage.toFixed(0)}% ({formatNumber(b.views)})</span>
                                </div>
                                <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: theme.cardAlt, overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.max(4, Math.min(100, b.percentage))}%`, height: '100%', backgroundColor: isInApp ? '#ec4899' : '#3b82f6', borderRadius: '3px' }} />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p style={{ margin: 0, fontSize: '0.74rem', color: theme.textSecondary }}>Belum ada data peramban.</p>
                        )}
                      </div>
                    </div>

                    {/* Cities */}
                    <div style={{ backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}`, padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Globe size={16} style={{ color: '#f59e0b' }} />
                          <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                            Kota Pengunjung Platform
                          </h4>
                        </div>
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
                            style={{ minHeight: '44px', padding: '0 0.65rem', borderRadius: '6px', border: `1px solid ${theme.border}`, backgroundColor: theme.cardAlt, color: '#f59e0b', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Lihat ({locationsResult.totalItemsCount})
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.66rem', color: theme.textSecondary }}>Zero-PII Geo</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
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
                                  <span style={{ fontWeight: 700, color: isOthers ? '#f59e0b' : theme.textPrimary }}>
                                    {loc.name}
                                  </span>
                                  <span style={{ fontWeight: 800, color: '#f59e0b' }}>{loc.percentage.toFixed(0)}% ({formatNumber(loc.views)})</span>
                                </div>
                                <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: theme.cardAlt, overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.max(4, Math.min(100, loc.percentage))}%`, height: '100%', backgroundColor: '#f59e0b', borderRadius: '3px' }} />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p style={{ margin: 0, fontSize: '0.74rem', color: theme.textSecondary }}>Belum ada data kota pengunjung.</p>
                        )}
                      </div>
                    </div>

                    {/* 24h Heatmap / 4-Block Time Bands */}
                    <div style={{ backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}`, padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <Clock size={16} style={{ color: '#8b5cf6' }} />
                          <div>
                            <h4 style={{ margin: 0, fontSize: '0.86rem', fontWeight: 800, color: theme.textPrimary }}>
                              Kurva Jam Sibuk
                            </h4>
                            <span style={{ fontSize: '0.62rem', color: theme.textSecondary }}>Waktu Server (WIB)</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: theme.cardAlt, padding: '2px', borderRadius: '8px', border: `1px solid ${theme.border}` }}>
                          {(['24h', 'time_bands'] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setHeatmapViewMode(m)}
                              style={{
                                minHeight: '44px',
                                padding: '0 0.55rem',
                                fontSize: '0.68rem',
                                fontWeight: heatmapViewMode === m ? 700 : 500,
                                border: 'none',
                                borderRadius: '6px',
                                backgroundColor: heatmapViewMode === m ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                                color: heatmapViewMode === m ? '#8b5cf6' : theme.textSecondary,
                                cursor: 'pointer'
                              }}
                            >
                              {m === '24h' ? '24 Jam' : '4 Blok'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {!(telemetryData.hourly_heatmap || []).some((h) => (h.views || 0) > 0) ? (
                        <p style={{ margin: 0, fontSize: '0.74rem', color: theme.textSecondary }}>
                          Belum ada data distribusi jam sibuk pengunjung pada periode ini.
                        </p>
                      ) : heatmapViewMode === '24h' ? (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0.25rem', alignItems: 'end', minHeight: '80px' }}>
                            {telemetryData.hourly_heatmap.map((h, idx) => {
                              const heightPercent = Math.max(12, Math.round((h.views / maxViews) * 100));
                              return (
                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', height: '100%', justifyContent: 'flex-end' }}>
                                  <div
                                    title={`Jam ${h.hour}:00 WIB - ${h.views} kunjungan`}
                                    style={{ width: '100%', height: `${heightPercent}%`, maxHeight: '55px', borderRadius: '2px', backgroundColor: h.views === maxViews && h.views > 0 ? '#8b5cf6' : h.views > 0 ? 'rgba(139, 92, 246, 0.45)' : theme.cardAlt }}
                                  />
                                  <span style={{ fontSize: '0.58rem', color: theme.textSecondary }}>{h.hour}</span>
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: theme.textSecondary, marginTop: '0.35rem' }}>
                            <span>00:00</span>
                            <span>06:00</span>
                            <span>12:00</span>
                            <span>18:00</span>
                            <span>23:00</span>
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.45rem' }}>
                          {timeBands.bands.map((band) => (
                            <div key={band.key} style={{ padding: '0.55rem', borderRadius: '0.55rem', backgroundColor: theme.cardAlt, border: `1px solid ${theme.border}` }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 700, color: theme.textPrimary }}>
                                <span>{band.label}</span>
                                <span style={{ color: '#8b5cf6' }}>{band.percentage.toFixed(0)}%</span>
                              </div>
                              <div style={{ fontSize: '0.62rem', color: theme.textSecondary, marginTop: '0.15rem' }}>
                                {band.range} &bull; {formatNumber(band.views)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* Real-Time Live Feed */}
              <div style={{ backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}`, padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={16} style={{ color: '#10b981' }} />
                    <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                      Live Stream Telemetri
                    </h4>
                  </div>
                  <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#10b981' }}>LIVE</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.35rem', marginBottom: '0.45rem' }}>
                  {([
                    { key: 'all', label: `Semua (${telemetryData.recent_visitors.length})` },
                    { key: 'store_view', label: 'Katalog' },
                    { key: 'product_view', label: 'Item' },
                    { key: 'action_wa', label: 'WhatsApp' },
                    { key: 'rekber_click', label: 'Rekber' }
                  ] as const).map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setLiveEventFilter(f.key)}
                      style={{
                        minHeight: '44px',
                        padding: '0 0.7rem',
                        borderRadius: '0.5rem',
                        border: `1px solid ${liveEventFilter === f.key ? '#10b981' : theme.border}`,
                        backgroundColor: liveEventFilter === f.key ? 'rgba(16, 185, 129, 0.15)' : theme.cardAlt,
                        color: liveEventFilter === f.key ? '#10b981' : theme.textSecondary,
                        fontSize: '0.7rem',
                        fontWeight: liveEventFilter === f.key ? 700 : 500,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="catavor-custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '280px', overflowY: 'auto' }}>
                  {telemetryData.recent_visitors.length > 0 ? (
                    telemetryData.recent_visitors
                      .filter((ev) => {
                        if (liveEventFilter === 'all') return true;
                        if (liveEventFilter === 'action_wa') return ev.event === 'action_wa' || ev.event === 'direct_wa_click';
                        return ev.event === liveEventFilter;
                      })
                      .map((ev, idx) => (
                        <div key={ev.id || idx} style={{ padding: '0.55rem 0.65rem', borderRadius: '0.55rem', backgroundColor: theme.cardAlt, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.45rem', fontSize: '0.72rem' }}>
                          <span style={{ fontWeight: 700, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            [{ev.store_slug}] {formatTelemetryEventLabel(ev.event, ev.product_name)}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0, fontSize: '0.66rem', color: theme.textSecondary }}>
                            <span>{ev.device_type} &bull; {ev.city}</span>
                            <span style={{ fontWeight: 700 }}>{ev.time_ago}</span>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div style={{ padding: '1rem', textAlign: 'center', color: theme.textSecondary, fontSize: '0.74rem' }}>
                      Belum ada aliran event real-time yang tercatat.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: '0.75rem 0.85rem', borderRadius: '0.75rem', backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <ShieldCheck size={18} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '1px' }} />
                <span style={{ fontSize: '0.7rem', color: theme.textSecondary, lineHeight: 1.35 }}>
                  {TELEMETRY_PRIVACY_SUMMARY}
                </span>
              </div>
            </>
          ) : null}
        </div>
      )}

      {selectedDimension && (
        <MobileDimensionSheet
          isOpen={dimensionSheetOpen}
          onClose={() => setDimensionSheetOpen(false)}
          title={selectedDimension.title}
          dimensionType={selectedDimension.type}
          items={selectedDimension.items}
          themeMode={isDark ? 'dark' : 'light'}
        />
      )}
    </div>
  );
};

export default MobileMarketIntelView;
