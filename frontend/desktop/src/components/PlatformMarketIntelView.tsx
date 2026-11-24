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
  Clock,
  Users,
  Activity,
  Smartphone,
  Compass,
  Radio,
  Store,
  AlertTriangle
} from 'lucide-react';
import { AnalyticsDimensionModal } from './AnalyticsDimensionModal';
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

export interface PlatformMarketIntelViewProps {
  token: string;
  isDark: boolean;
  theme: Record<string, string>;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
  canTriggerBot?: boolean;
  revision?: number;
}

export const PlatformMarketIntelView: React.FC<PlatformMarketIntelViewProps> = ({
  token,
  isDark,
  theme,
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

  const [activeSection, setActiveSection] = useState<'market_intel' | 'global_telemetry'>('market_intel');
  const [telemetryPeriod, setTelemetryPeriod] = useState<TelemetryPeriod>('7d');
  const [telemetryData, setTelemetryData] = useState<GlobalAnalyticsOverview | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState<boolean>(false);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);

  const [dimensionModalOpen, setDimensionModalOpen] = useState(false);
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
      setError(err instanceof Error ? err.message : 'Koneksi ke backend analytics gagal.');
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
    loadGlobalTelemetry(telemetryPeriod, controller.signal);
    return () => controller.abort();
  }, [loadMarketIntel, loadGlobalTelemetry, telemetryPeriod, revision]);

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
        loadGlobalTelemetry(telemetryPeriod);
      }, 1200);
    } catch (err: unknown) {
      showToast?.(err instanceof Error ? err.message : 'Gagal memicu bot agregasi riset pasar.', 'error');
    } finally {
      setIsTriggeringBot(false);
    }
  };

  const surfaceBg = isDark ? 'rgba(30, 41, 59, 0.55)' : '#ffffff';
  const subSurfaceBg = isDark ? 'rgba(15, 23, 42, 0.65)' : '#f8fafc';
  const kMinStores = data?.k_anonymity_min_stores || 3;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
      {/* Top Header Card */}
      <div
        style={{
          padding: '1.35rem 1.65rem',
          borderRadius: '1rem',
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.75)' : '#ffffff',
          border: `1px solid ${theme.border}`,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 10px rgba(0,0,0,0.04)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0, flex: '1 1 360px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Globe size={24} strokeWidth={1.75} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: theme.textPrimary, margin: 0 }}>
                Riset Pasar &amp; Intelijen Permintaan B2B
              </h2>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '0.35rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  letterSpacing: '0.04em'
                }}
              >
                UU PDP LEGAL (ZERO-PII)
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '0.35rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59, 130, 246, 0.2)'
                }}
              >
                {PRIVACY_BADGE_LABEL}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: theme.textSecondary, margin: '0.25rem 0 0 0', lineHeight: 1.45 }}>
              Analisis tren belanja konsumen nasional, kata kunci populer, kesenjangan pasokan (<em>demand gap</em>), dan kuartil harga industri.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              loadMarketIntel();
              loadGlobalTelemetry(telemetryPeriod);
            }}
            disabled={loading || telemetryLoading}
            style={{
              padding: '0.55rem 0.9rem',
              borderRadius: '0.65rem',
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#f8fafc',
              color: theme.textPrimary,
              border: `1px solid ${theme.border}`,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <RefreshCw size={14} className={loading || telemetryLoading ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>

          {canTriggerBot && (
            <button
              type="button"
              onClick={handleTriggerAggregation}
              disabled={isTriggeringBot || loading}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '0.65rem',
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#f1f5f9',
                color: theme.textPrimary,
                border: `1px solid ${theme.border}`,
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem'
              }}
            >
              <Zap size={14} style={{ color: '#f59e0b' }} className={isTriggeringBot ? 'animate-spin' : ''} />
              <span>{isTriggeringBot ? 'Memproses...' : 'Picu Agregasi Sekarang'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleDownloadExport('json')}
            disabled={exportingFormat !== null || !data}
            style={{
              padding: '0.55rem 0.9rem',
              borderRadius: '0.65rem',
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff',
              color: theme.textPrimary,
              border: `1px solid ${theme.border}`,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Download size={14} />
            <span>{exportingFormat === 'json' ? 'Mengunduh...' : 'Unduh JSON'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadExport('csv')}
            disabled={exportingFormat !== null || !data}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: '0.65rem',
              backgroundColor: '#059669',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 4px 14px rgba(5, 150, 105, 0.25)'
            }}
          >
            <FileSpreadsheet size={15} />
            <span>{exportingFormat === 'csv' ? 'Mengunduh...' : 'Unduh Laporan CSV'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div
          role="tablist"
          aria-label="Bagian Riset Pasar B2B"
          style={{
            display: 'inline-flex',
            padding: '0.25rem',
            borderRadius: '0.65rem',
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.7)' : '#e2e8f0',
            border: `1px solid ${theme.border}`,
            gap: '0.25rem'
          }}
        >
          <button
            type="button"
            role="tab"
            id="desktop-tab-market-intel"
            aria-selected={activeSection === 'market_intel'}
            onClick={() => setActiveSection('market_intel')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              borderBottom: activeSection === 'market_intel' ? '3px solid #047857' : '3px solid transparent',
              backgroundColor: activeSection === 'market_intel' ? '#10b981' : 'transparent',
              color: activeSection === 'market_intel' ? '#ffffff' : theme.textSecondary,
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            <TrendingUp size={15} />
            <span>Riset Pasar &amp; Demand Gap B2B</span>
          </button>
          <button
            type="button"
            role="tab"
            id="desktop-tab-global-telemetry"
            aria-selected={activeSection === 'global_telemetry'}
            onClick={() => {
              setActiveSection('global_telemetry');
              if (!telemetryData && !telemetryLoading) {
                loadGlobalTelemetry(telemetryPeriod);
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              borderBottom: activeSection === 'global_telemetry' ? '3px solid #1d4ed8' : '3px solid transparent',
              backgroundColor: activeSection === 'global_telemetry' ? '#3b82f6' : 'transparent',
              color: activeSection === 'global_telemetry' ? '#ffffff' : theme.textSecondary,
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            <Radio size={15} />
            <span>Pusat Telemetri &amp; Audiens Global</span>
          </button>
        </div>

        {activeSection === 'global_telemetry' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ display: 'inline-flex', padding: '0.2rem', borderRadius: '0.5rem', backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#f1f5f9', border: `1px solid ${theme.border}` }}>
              {(['7d', '30d', '90d'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTelemetryPeriod(p)}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '0.4rem',
                    border: 'none',
                    borderBottom: telemetryPeriod === p ? '2px solid #1d4ed8' : '2px solid transparent',
                    backgroundColor: telemetryPeriod === p ? '#3b82f6' : 'transparent',
                    color: telemetryPeriod === p ? '#ffffff' : theme.textSecondary,
                    fontSize: '0.72rem',
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
                padding: '0.42rem 0.75rem',
                borderRadius: '0.5rem',
                border: `1px solid ${theme.border}`,
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff',
                color: theme.textPrimary,
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <RefreshCw size={12} className={telemetryLoading ? 'animate-spin' : ''} />
              <span>Segarkan Telemetri</span>
            </button>
          </div>
        )}
      </div>

      {partialWarning && activeSection === 'market_intel' && (
        <div
          role="status"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: isDark ? '#fbbf24' : '#b45309',
            display: 'flex',
            alignItems: 'center',
            gap: '0.55rem',
            fontSize: '0.78rem',
            fontWeight: 600
          }}
        >
          <AlertTriangle size={16} />
          <span>{partialWarning}</span>
        </div>
      )}

      {activeSection === 'global_telemetry' ? (
        <div role="tabpanel" aria-labelledby="desktop-tab-global-telemetry" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {telemetryError && (
            <div
              role="alert"
              style={{
                padding: '1rem 1.25rem',
                borderRadius: '0.85rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <AlertCircle size={18} />
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '0.85rem', display: 'block' }}>Gagal Memuat Telemetri Audiens Global</strong>
                <span style={{ fontSize: '0.78rem' }}>{telemetryError}</span>
              </div>
              <button
                type="button"
                onClick={() => loadGlobalTelemetry(telemetryPeriod)}
                style={{ padding: '0.45rem 0.9rem', borderRadius: '0.5rem', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
              >
                Muat Ulang
              </button>
            </div>
          )}

          {telemetryLoading && !telemetryData ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: theme.textSecondary }}>
              <RefreshCw size={28} className="animate-spin" style={{ color: '#3b82f6', margin: '0 auto 0.75rem' }} />
              <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>Memuat telemetri audiens global...</p>
            </div>
          ) : telemetryData ? (
            <>
              {/* 4 KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '1.15rem 1.35rem', borderRadius: '0.85rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary }}>Total Tayangan Platform</span>
                    <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Globe size={16} />
                    </div>
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: theme.textPrimary, letterSpacing: '-0.02em' }}>
                    {formatNumber(telemetryData.total_views)}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>
                    {formatNumber(telemetryData.total_product_views)} tayangan item spesifik
                  </span>
                </div>

                <div style={{ padding: '1.15rem 1.35rem', borderRadius: '0.85rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary }}>Pengunjung Unik Global</span>
                    <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={16} />
                    </div>
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#10b981', letterSpacing: '-0.02em' }}>
                    {formatNumber(telemetryData.total_unique_visitors)}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>
                    Perangkat terverifikasi harian (HMAC Zero-PII)
                  </span>
                </div>

                <div style={{ padding: '1.15rem 1.35rem', borderRadius: '0.85rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary }}>Rasio Pentalan (Bounce Rate)</span>
                    <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Activity size={16} />
                    </div>
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: telemetryData.bounce_rate_percent > 50 ? '#f59e0b' : '#10b981', letterSpacing: '-0.02em' }}>
                    {formatPercent(telemetryData.bounce_rate_percent, 1)}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>
                    {formatNumber(telemetryData.total_bounces)} sesi langsung keluar
                  </span>
                </div>

                <div style={{ padding: '1.15rem 1.35rem', borderRadius: '0.85rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary }}>Total Tindakan / Leads</span>
                    <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Zap size={16} />
                    </div>
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: theme.textPrimary, letterSpacing: '-0.02em' }}>
                    {formatNumber(telemetryData.total_actions)}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700 }}>
                    {formatPercent(telemetryData.conversion_rate, 1)} Rasio Konversi Platform
                  </span>
                </div>
              </div>

              {/* Top Stores Leaderboard */}
              <div style={{ padding: '1.35rem 1.65rem', borderRadius: '0.85rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Store size={17} style={{ color: '#3b82f6' }} />
                    <span>Toko Terpopuler Berdasarkan Lalu Lintas Kunjungan</span>
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {[5, 10].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setTopStoresLimit(cnt)}
                        style={{
                          padding: '0.3rem 0.65rem',
                          borderRadius: '0.4rem',
                          border: `1px solid ${topStoresLimit === cnt ? '#3b82f6' : theme.border}`,
                          backgroundColor: topStoresLimit === cnt ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)') : 'transparent',
                          color: topStoresLimit === cnt ? (isDark ? '#60a5fa' : '#2563eb') : theme.textSecondary,
                          fontSize: '0.72rem',
                          fontWeight: topStoresLimit === cnt ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        Top {cnt}
                      </button>
                    ))}
                  </div>
                </div>

                <div tabIndex={0} role="region" aria-label="Tabel Toko Terpopuler" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${theme.border}`, color: theme.textSecondary, textAlign: 'left' }}>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Peringkat</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Nama Toko / Katalog</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Slug Toko</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Total Kunjungan</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Total Aksi Pembeli</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Rasio Konversi CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {telemetryData.top_stores.length > 0 ? (
                        telemetryData.top_stores.slice(0, topStoresLimit).map((st, idx) => {
                          const ctr = st.views > 0 ? Math.min(100, (st.total_actions / st.views) * 100) : 0;
                          return (
                            <tr key={st.store_id || idx} style={{ borderBottom: `1px dashed ${theme.border}` }}>
                              <td style={{ padding: '0.75rem 0.85rem', fontWeight: 800, color: idx < 3 ? '#10b981' : theme.textSecondary }}>
                                #{idx + 1}
                              </td>
                              <td style={{ padding: '0.75rem 0.85rem', fontWeight: 700, color: theme.textPrimary }}>
                                {st.store_title || st.slug}
                              </td>
                              <td style={{ padding: '0.75rem 0.85rem', color: theme.textSecondary }}>
                                <code>/{st.slug}</code>
                              </td>
                              <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', fontWeight: 800, color: '#3b82f6' }}>
                                {formatNumber(st.views)}
                              </td>
                              <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                                {formatNumber(st.total_actions)}
                              </td>
                              <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', fontWeight: 700, color: ctr > 0 ? '#10b981' : theme.textSecondary }}>
                                {formatPercent(ctr, 1)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: theme.textMuted }}>
                            Belum ada aktivitas toko terdaftar dalam periode ini.
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
                const maxHViews = Math.max(1, ...telemetryData.hourly_heatmap.map((p) => p.views));

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    {/* Card 1: Devices & OS */}
                    <div style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '340px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Smartphone size={15} style={{ color: '#3b82f6' }} />
                          <span>Sebaran Perangkat Platform</span>
                        </span>
                        <span style={{ fontSize: '0.68rem', color: theme.textMuted }}>
                          {devicesResult.totalItemsCount} perangkat
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1 }}>
                        {devicesResult.displayItems.length > 0 ? (
                          devicesResult.displayItems.map((dev) => (
                            <div key={dev.dimension_value} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                <span style={{ color: theme.textPrimary, fontWeight: 600 }}>{dev.name || dev.dimension_value}</span>
                                <span style={{ color: theme.textSecondary }}>{formatNumber(dev.views)} ({dev.percentage.toFixed(0)}%)</span>
                              </div>
                              <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.max(4, Math.min(100, dev.percentage))}%`, height: '100%', backgroundColor: '#3b82f6', borderRadius: '3px' }} />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ margin: 'auto 0', textAlign: 'center', fontSize: '0.75rem', color: theme.textMuted }}>
                            Belum ada data perangkat pada periode ini.
                          </div>
                        )}
                      </div>

                      {allOs.length > 0 && (
                        <div style={{ paddingTop: '0.5rem', borderTop: `1px solid ${theme.border}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: theme.textMuted }}>
                              Sistem Operasi ({allOs.length})
                            </span>
                            {allOs.length > 4 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDimension({
                                    type: 'operating_systems',
                                    title: 'Sebaran Sistem Operasi Pengunjung Platform',
                                    items: allOs
                                  });
                                  setDimensionModalOpen(true);
                                }}
                                style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                              >
                                Lihat Semua
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {visibleOs.map((os) => (
                              <span key={os.dimension_value} style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '6px', backgroundColor: subSurfaceBg, border: `1px solid ${theme.border}`, color: theme.textSecondary }}>
                                <strong style={{ color: theme.textPrimary }}>{os.name}</strong>: {os.percentage.toFixed(0)}%
                              </span>
                            ))}
                            {!isOsExpanded && remainingOsCount > 0 && (
                              <button
                                type="button"
                                onClick={() => setIsOsExpanded(true)}
                                style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '6px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', color: '#3b82f6', fontWeight: 700, cursor: 'pointer' }}
                              >
                                +{remainingOsCount} Lainnya
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card 2: Browsers & Social In-App */}
                    <div style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '340px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Globe size={15} style={{ color: '#10b981' }} />
                          <span>Peramban &amp; Webview In-App Sosial</span>
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
                              setDimensionModalOpen(true);
                            }}
                            style={{ padding: '0.15rem 0.5rem', borderRadius: '6px', border: `1px solid ${theme.border}`, backgroundColor: subSurfaceBg, color: '#10b981', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Lihat Semua ({browsersResult.totalItemsCount})
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.68rem', color: theme.textMuted }}>Instagram / TikTok</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1 }}>
                        {browsersResult.displayItems.length > 0 ? (
                          browsersResult.displayItems.map((br) => {
                            const isInApp = br.dimension_value.includes('in-app') || br.name.toLowerCase().includes('in-app');
                            const isOthers = br.dimension_value === '__others__';
                            return (
                              <div
                                key={br.dimension_value}
                                style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', cursor: isOthers ? 'pointer' : 'default' }}
                                onClick={() => {
                                  if (isOthers) {
                                    setSelectedDimension({
                                      type: 'browsers',
                                      title: 'Peramban & Webview In-App Sosial Platform',
                                      items: telemetryData.browsers
                                    });
                                    setDimensionModalOpen(true);
                                  }
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                  <span style={{ color: isOthers ? '#10b981' : theme.textPrimary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <span>{br.name || br.dimension_value}</span>
                                    {isInApp && (
                                      <span style={{ fontSize: '0.6rem', padding: '0.05rem 0.35rem', borderRadius: '4px', backgroundColor: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', fontWeight: 700 }}>
                                        In-App
                                      </span>
                                    )}
                                  </span>
                                  <span style={{ color: theme.textSecondary }}>{formatNumber(br.views)} ({br.percentage.toFixed(0)}%)</span>
                                </div>
                                <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0', overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.max(4, Math.min(100, br.percentage))}%`, height: '100%', backgroundColor: isInApp ? '#ec4899' : '#10b981', borderRadius: '3px' }} />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ margin: 'auto 0', textAlign: 'center', fontSize: '0.75rem', color: theme.textMuted }}>
                            Belum ada data peramban pada periode ini.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card 3: Top Cities */}
                    <div style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '340px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Compass size={15} style={{ color: '#f59e0b' }} />
                          <span>Sebaran Kota Konsumen</span>
                        </span>
                        {locationsResult.totalItemsCount > 5 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDimension({
                                type: 'locations',
                                title: 'Sebaran Kota Konsumen Nasional (Coarse Geo)',
                                items: telemetryData.locations
                              });
                              setDimensionModalOpen(true);
                            }}
                            style={{ padding: '0.15rem 0.5rem', borderRadius: '6px', border: `1px solid ${theme.border}`, backgroundColor: subSurfaceBg, color: '#f59e0b', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Lihat Semua ({locationsResult.totalItemsCount})
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.68rem', color: theme.textMuted }}>Coarse Geo Zero-PII</span>
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
                                      title: 'Sebaran Kota Konsumen Nasional (Coarse Geo)',
                                      items: telemetryData.locations
                                    });
                                    setDimensionModalOpen(true);
                                  }
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                  <span style={{ color: isOthers ? '#f59e0b' : theme.textPrimary, fontWeight: 600 }}>
                                    {loc.name || loc.dimension_value}
                                  </span>
                                  <span style={{ color: theme.textSecondary }}>{formatNumber(loc.views)} ({loc.percentage.toFixed(0)}%)</span>
                                </div>
                                <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0', overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.max(4, Math.min(100, loc.percentage))}%`, height: '100%', backgroundColor: '#f59e0b', borderRadius: '3px' }} />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ margin: 'auto 0', textAlign: 'center', fontSize: '0.75rem', color: theme.textMuted }}>
                            Belum ada data lokasi pada periode ini.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card 4: 24-Hour Peak Heatmap */}
                    <div style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '340px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Clock size={15} style={{ color: '#8b5cf6' }} />
                          <span>Puncak Beban Server 24-Jam</span>
                        </span>
                        <div style={{ display: 'inline-flex', padding: '2px', borderRadius: '6px', backgroundColor: subSurfaceBg, border: `1px solid ${theme.border}` }}>
                          <button
                            type="button"
                            onClick={() => setHeatmapViewMode('24h')}
                            style={{ padding: '0.15rem 0.45rem', fontSize: '0.65rem', fontWeight: 700, border: 'none', borderRadius: '4px', backgroundColor: heatmapViewMode === '24h' ? 'rgba(139, 92, 246, 0.2)' : 'transparent', color: heatmapViewMode === '24h' ? '#8b5cf6' : theme.textSecondary, cursor: 'pointer' }}
                          >
                            24 Jam
                          </button>
                          <button
                            type="button"
                            onClick={() => setHeatmapViewMode('time_bands')}
                            style={{ padding: '0.15rem 0.45rem', fontSize: '0.65rem', fontWeight: 700, border: 'none', borderRadius: '4px', backgroundColor: heatmapViewMode === 'time_bands' ? 'rgba(139, 92, 246, 0.2)' : 'transparent', color: heatmapViewMode === 'time_bands' ? '#8b5cf6' : theme.textSecondary, cursor: 'pointer' }}
                          >
                            4 Blok
                          </button>
                        </div>
                      </div>

                      {heatmapViewMode === '24h' ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '180px', paddingTop: '1rem', flex: 1 }}>
                            {telemetryData.hourly_heatmap.map((hPoint) => {
                              const heightPercent = Math.max(8, Math.min(100, (hPoint.views / maxHViews) * 100));
                              return (
                                <div
                                  key={hPoint.hour}
                                  title={`Jam ${hPoint.hour}:00 UTC - ${hPoint.views} tayangan`}
                                  style={{
                                    flex: 1,
                                    height: `${heightPercent}%`,
                                    backgroundColor: hPoint.views === maxHViews && hPoint.views > 0 ? '#8b5cf6' : hPoint.views > 0 ? 'rgba(139, 92, 246, 0.45)' : isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
                                    borderRadius: '3px 3px 0 0'
                                  }}
                                />
                              );
                            })}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: theme.textSecondary }}>
                            <span>00:00</span>
                            <span>06:00</span>
                            <span>12:00</span>
                            <span>18:00</span>
                            <span>23:00</span>
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', flex: 1, alignContent: 'center' }}>
                          {timeBands.bands.map((band) => (
                            <div key={band.key} style={{ padding: '0.6rem', borderRadius: '0.55rem', backgroundColor: subSurfaceBg, border: `1px solid ${theme.border}` }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, color: theme.textPrimary }}>
                                <span>{band.label}</span>
                                <span style={{ color: '#8b5cf6' }}>{band.percentage.toFixed(0)}%</span>
                              </div>
                              <div style={{ fontSize: '0.65rem', color: theme.textMuted, marginTop: '0.15rem' }}>
                                {band.range} &bull; {formatNumber(band.views)} tayangan
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Real-time Global Live Visitors Feed */}
              <div style={{ padding: '1.25rem 1.5rem', borderRadius: '0.85rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Radio size={16} style={{ color: '#10b981' }} />
                      <span>Aktivitas Pengunjung Platform Terkini (Live Stream)</span>
                    </span>
                    <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700 }}>
                      Ring Buffer 50 Event
                    </span>
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
                          padding: '0.28rem 0.65rem',
                          borderRadius: '0.4rem',
                          border: `1px solid ${liveEventFilter === f.key ? '#10b981' : theme.border}`,
                          backgroundColor: liveEventFilter === f.key ? 'rgba(16, 185, 129, 0.15)' : subSurfaceBg,
                          color: liveEventFilter === f.key ? '#10b981' : theme.textSecondary,
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

                <div className="catavor-custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '0.3rem' }}>
                  {telemetryData.recent_visitors.length > 0 ? (
                    telemetryData.recent_visitors
                      .filter((rv) => {
                        if (liveEventFilter === 'all') return true;
                        if (liveEventFilter === 'action_wa') return rv.event === 'action_wa' || rv.event === 'direct_wa_click';
                        return rv.event === liveEventFilter;
                      })
                      .slice(0, 30)
                      .map((rv) => (
                        <div key={rv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.85rem', borderRadius: '0.55rem', backgroundColor: subSurfaceBg, border: `1px solid ${theme.border}`, fontSize: '0.78rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: rv.event.includes('click') || rv.event.includes('action') ? '#10b981' : '#3b82f6', flexShrink: 0 }} />
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span style={{ color: theme.textPrimary, fontWeight: 700 }}>
                                [{rv.store_slug}] {formatTelemetryEventLabel(rv.event, rv.product_name)}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: theme.textSecondary, display: 'block' }}>
                                {rv.device_type} &bull; {rv.browser || rv.os} &bull; {rv.city} &bull; via {rv.source}
                              </span>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: theme.textSecondary, fontWeight: 600, whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                            {rv.time_ago}
                          </span>
                        </div>
                      ))
                  ) : (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: theme.textMuted, fontSize: '0.8rem' }}>
                      Belum ada aliran aktivitas pengunjung terkini yang tercatat dalam periode ini.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: '1rem 1.35rem', borderRadius: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ShieldCheck size={20} style={{ color: '#3b82f6', flexShrink: 0 }} />
                <div style={{ fontSize: '0.72rem', color: theme.textSecondary, lineHeight: 1.45 }}>
                  {TELEMETRY_PRIVACY_SUMMARY}
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: theme.textSecondary }}>
          <RefreshCw size={32} className="animate-spin" style={{ color: '#10b981', margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '0.92rem', fontWeight: 600 }}>Mengompilasi dataset intelijen pasar nasional...</p>
        </div>
      ) : error ? (
        <div role="alert" style={{ padding: '1.25rem', borderRadius: '0.85rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <AlertCircle size={20} />
          <div>
            <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: 800, fontSize: '0.9rem' }}>Gagal Mengambil Data Riset</h4>
            <span style={{ fontSize: '0.8rem' }}>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadMarketIntel()}
            style={{ marginLeft: 'auto', padding: '0.45rem 0.9rem', borderRadius: '0.5rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
          >
            Coba Lagi
          </button>
        </div>
      ) : data ? (
        <div role="tabpanel" aria-labelledby="desktop-tab-market-intel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* 4-Column Macro Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1.15rem 1.35rem', borderRadius: '0.85rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary }}>Basis Data Katalog Aktif</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: theme.textPrimary, letterSpacing: '-0.02em' }}>
                {formatNumber(data.total_active_products)}
              </div>
              <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>
                Tersebar di {formatNumber(data.total_active_stores)} toko merchant aktif
              </span>
            </div>

            <div style={{ padding: '1.15rem 1.35rem', borderRadius: '0.85rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary }}>Interaksi Konsumen 30 Hari</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#10b981', letterSpacing: '-0.02em' }}>
                {formatNumber(data.total_views_30d)}
              </div>
              <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>
                Menghasilkan {formatNumber(data.total_actions_30d)} klik tindakan pembeli
              </span>
            </div>

            <div style={{ padding: '1.15rem 1.35rem', borderRadius: '0.85rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary }}>Rasio Konversi Rata-rata</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#f59e0b', letterSpacing: '-0.02em' }}>
                {formatPercent(data.overall_conversion_rate, 1)}
              </div>
              <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>
                Efektivitas etalase mengubah kunjungan menjadi minat beli
              </span>
            </div>

            <div style={{ padding: '1.15rem 1.35rem', borderRadius: '0.85rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary }}>Peluang Pasokan (Demand Gap)</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowUpRight size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#ef4444', letterSpacing: '-0.02em' }}>
                {formatNumber(demandGaps.length)} Tren
              </div>
              <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>
                Kata kunci pencarian konsumen dengan hasil nihil
              </span>
            </div>
          </div>

          {/* Saluran Minat Konsumen (Channel Breakdown) */}
          <div style={{ padding: '1.25rem 1.5rem', borderRadius: '0.85rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}` }}>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: theme.textPrimary, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={17} style={{ color: '#3b82f6' }} />
              <span>Distribusi Preferensi Transaksi Konsumen (Saluran Minat Belanja)</span>
            </h4>

            <div style={{ height: '14px', borderRadius: '9999px', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0', display: 'flex', overflow: 'hidden', marginBottom: '1.1rem' }}>
              <div style={{ width: `${data.channel_breakdown.direct_wa_percent}%`, backgroundColor: '#10b981' }} title={`WA Direct: ${formatPercent(data.channel_breakdown.direct_wa_percent)}`} />
              <div style={{ width: `${data.channel_breakdown.rekber_percent}%`, backgroundColor: '#3b82f6' }} title={`Rekber Syariah: ${formatPercent(data.channel_breakdown.rekber_percent)}`} />
              <div style={{ width: `${data.channel_breakdown.marketplace_percent}%`, backgroundColor: '#f59e0b' }} title={`Marketplace: ${formatPercent(data.channel_breakdown.marketplace_percent)}`} />
              <div style={{ width: `${data.channel_breakdown.video_views_percent}%`, backgroundColor: '#8b5cf6' }} title={`Video Produk: ${formatPercent(data.channel_breakdown.video_views_percent)}`} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
              {[
                { label: 'Chat WhatsApp Langsung', count: data.channel_breakdown.direct_wa_clicks, pct: data.channel_breakdown.direct_wa_percent, color: '#10b981' },
                { label: 'Escrow Rekber Syariah', count: data.channel_breakdown.rekber_clicks, pct: data.channel_breakdown.rekber_percent, color: '#3b82f6' },
                { label: 'Tautan Marketplace Luar', count: data.channel_breakdown.marketplace_clicks, pct: data.channel_breakdown.marketplace_percent, color: '#f59e0b' },
                { label: 'Tontonan Video Katalog', count: data.channel_breakdown.video_views, pct: data.channel_breakdown.video_views_percent, color: '#8b5cf6' }
              ].map((ch) => (
                <div key={ch.label} style={{ padding: '0.75rem', borderRadius: '0.65rem', backgroundColor: subSurfaceBg, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: ch.color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>{ch.label}</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textPrimary }}>
                      {formatNumber(ch.count)} <span style={{ fontSize: '0.72rem', color: ch.color }}>({formatPercent(ch.pct, 1)})</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2-Column Split: Top Categories + Catalog Quality & Supply Dynamics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.25rem' }}>
            {/* Top Categories (K-Anonymity >= 3 unique stores) */}
            <div style={{ padding: '1.35rem', borderRadius: '0.85rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={17} style={{ color: '#8b5cf6' }} />
                  <span>Kategori Paling Diminati</span>
                </h4>
                <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>K-Anonymity &ge; {kMinStores} toko</span>
              </div>

              {data.top_categories.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {data.top_categories.slice(0, 8).map((cat) => (
                    <div key={`${cat.category_id}-${cat.category_name}`} style={{ padding: '0.75rem 0.9rem', borderRadius: '0.65rem', backgroundColor: subSurfaceBg, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: theme.textPrimary }}>{cat.category_name}</div>
                        <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
                          {formatNumber(cat.product_count)} produk &bull; {formatNumber(cat.unique_store_count)} toko &bull; {formatNumber(cat.total_views)} tayangan
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#10b981' }}>
                          {formatPercent(cat.conversion_rate, 1)} CTR
                        </div>
                        <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
                          Rerata {formatIDR(cat.average_price)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: theme.textMuted, fontSize: '0.8rem' }}>
                  Belum ada kategori yang memenuhi ambang privasi K-Anonymity (minimal {kMinStores} toko unik dengan katalog aktif).
                </div>
              )}
            </div>

            {/* Catalog Quality & Supply Dynamics */}
            <div style={{ padding: '1.35rem', borderRadius: '0.85rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={17} style={{ color: '#10b981' }} />
                  <span>Wawasan Kualitas Katalog &amp; Dinamika Suplai</span>
                </h4>
                <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>Periode 30 Hari</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem' }}>
                <div style={{ padding: '0.8rem', borderRadius: '0.65rem', backgroundColor: subSurfaceBg, border: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Konversi 4+ Foto vs 1 Foto</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>
                    {formatPercent(data.catalog_quality_benchmarks.multi_photo_conversion_rate)} vs {formatPercent(data.catalog_quality_benchmarks.single_photo_conversion_rate)}
                  </div>
                </div>
                <div style={{ padding: '0.8rem', borderRadius: '0.65rem', backgroundColor: subSurfaceBg, border: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Multiplier Video Produk</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#3b82f6', marginTop: '0.2rem' }}>
                    {data.catalog_quality_benchmarks.video_boost_multiplier.toFixed(2)}x konversi
                  </div>
                </div>
                <div style={{ padding: '0.8rem', borderRadius: '0.65rem', backgroundColor: subSurfaceBg, border: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Adopsi Rekber Syariah</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#6366f1', marginTop: '0.2rem' }}>
                    {formatPercent(data.catalog_quality_benchmarks.rekber_trust_adoption_rate)} produk aktif
                  </div>
                </div>
                <div style={{ padding: '0.8rem', borderRadius: '0.65rem', backgroundColor: subSurfaceBg, border: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Listing Baru (30 Hari)</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textPrimary, marginTop: '0.2rem' }}>
                    {formatNumber(data.supply_side_dynamics.new_listings_30d)} item
                  </div>
                </div>
                <div style={{ padding: '0.8rem', borderRadius: '0.65rem', backgroundColor: subSurfaceBg, border: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Dinamika Perubahan Harga</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: theme.textPrimary, marginTop: '0.2rem' }}>
                    Naik {formatPercent(data.supply_side_dynamics.price_increase_ratio)} &bull; Turun {formatPercent(data.supply_side_dynamics.price_decrease_ratio)}
                  </div>
                </div>
                <div style={{ padding: '0.8rem', borderRadius: '0.65rem', backgroundColor: subSurfaceBg, border: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Rata-rata Laku Terjual</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>
                    {data.supply_side_dynamics.sold_out_velocity_avg_days > 0
                      ? `${data.supply_side_dynamics.sold_out_velocity_avg_days.toFixed(1)} hari`
                      : 'Belum ada sampel'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2-Column Split: Trending Hype vs Demand Gap */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.25rem' }}>
            <div style={{ padding: '1.35rem', borderRadius: '0.85rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Search size={17} style={{ color: '#3b82f6' }} />
                  <span>Kata Kunci Paling Dicari (Tren Hype Pasar)</span>
                </h4>
                <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>Top 12 Pencarian</span>
              </div>
              <p style={{ fontSize: '0.72rem', color: theme.textSecondary, margin: '0 0 1rem 0', lineHeight: 1.45 }}>
                Kata kunci organik dengan frekuensi pencarian tertinggi di seluruh katalog publik.
              </p>

              {trendingKeywords.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
                  {trendingKeywords.slice(0, 12).map((item, idx) => (
                    <div key={`${item.keyword}-${idx}`} style={{ padding: '0.65rem 0.85rem', borderRadius: '0.65rem', backgroundColor: subSurfaceBg, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: theme.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.keyword}
                        </span>
                        <span style={{ fontSize: '0.66rem', color: theme.textMuted }}>
                          {formatProductTypeLabel(item.product_type)} &bull; CTR {formatPercent(item.ctr, 1)}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: '0.4rem', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', flexShrink: 0 }}>
                        {formatNumber(item.search_volume)}x
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: theme.textMuted, fontSize: '0.8rem' }}>
                  Belum ada kata kunci pencarian terkumpul dalam periode 30 hari terakhir.
                </div>
              )}
            </div>

            <div style={{ padding: '1.35rem', borderRadius: '0.85rem', backgroundColor: surfaceBg, border: '1px solid rgba(245, 158, 11, 0.25)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ArrowUpRight size={17} style={{ color: '#f59e0b' }} />
                  <span>Peluang Pasokan Baru (Demand Gap Nihil Hasil)</span>
                </h4>
                <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700 }}>Zero-Result Sensor</span>
              </div>
              <p style={{ fontSize: '0.72rem', color: theme.textSecondary, margin: '0 0 1rem 0', lineHeight: 1.45 }}>
                Pencarian konsumen yang belum terpenuhi oleh stok katalog merchant saat ini.
              </p>

              {demandGaps.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
                  {demandGaps.slice(0, 12).map((gap, idx) => (
                    <div key={`${gap.keyword}-${idx}`} style={{ padding: '0.65rem 0.85rem', borderRadius: '0.65rem', backgroundColor: subSurfaceBg, border: '1px solid rgba(245, 158, 11, 0.22)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: theme.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {gap.keyword}
                        </span>
                        <span style={{ fontSize: '0.66rem', color: '#f59e0b' }}>
                          {formatProductTypeLabel(gap.product_type)} &bull; {formatPercent(computeGapRatio(gap.zero_result_count, gap.total_searches), 0)} nihil
                        </span>
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: '0.4rem', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', flexShrink: 0 }}>
                        {formatNumber(gap.zero_result_count)}x
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: theme.textMuted, fontSize: '0.8rem' }}>
                  Tidak ada pencarian nihil hasil dalam periode saat ini.
                </div>
              )}
            </div>
          </div>

          {/* Benchmark Sebaran & Kuartil Harga Pasar */}
          <div style={{ padding: '1.35rem 1.65rem', borderRadius: '0.85rem', backgroundColor: surfaceBg, border: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={17} style={{ color: '#10b981' }} />
                <span>Benchmark Kuartil Harga Pasar per Kategori</span>
              </h4>
              <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>K-Anonymity &ge; {kMinStores} Toko Unik</span>
            </div>
            <p style={{ fontSize: '0.72rem', color: theme.textSecondary, margin: '0 0 1rem 0' }}>
              Distribusi minimum, kuartil bawah (P25), median (P50), rata-rata, kuartil atas (P75), dan maksimum sebagai acuan harga wajar lintas merchant.
            </p>

            {data.price_benchmarks.length > 0 ? (
              <div tabIndex={0} role="region" aria-label="Tabel Benchmark Kuartil Harga Pasar" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${theme.border}`, color: theme.textSecondary, textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem 0.75rem' }}>Industri</th>
                      <th style={{ padding: '0.65rem 0.75rem' }}>Kategori</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Minimum</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>P25</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Median</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Rata-rata</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>P75</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Maksimum</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Sampel &amp; Toko</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.price_benchmarks.map((pb, idx) => (
                      <tr key={`${pb.product_type}-${pb.category_name}-${idx}`} style={{ borderBottom: `1px dashed ${theme.border}` }}>
                        <td style={{ padding: '0.7rem 0.75rem', color: theme.textSecondary, whiteSpace: 'nowrap' }}>
                          {formatProductTypeLabel(pb.product_type)}
                        </td>
                        <td style={{ padding: '0.7rem 0.75rem', fontWeight: 700, color: theme.textPrimary }}>
                          {pb.category_name}
                        </td>
                        <td style={{ padding: '0.7rem 0.75rem', textAlign: 'right', color: theme.textSecondary, whiteSpace: 'nowrap' }}>
                          {formatIDR(pb.min_price)}
                        </td>
                        <td style={{ padding: '0.7rem 0.75rem', textAlign: 'right', color: theme.textSecondary, whiteSpace: 'nowrap' }}>
                          {formatIDR(pb.p25_price)}
                        </td>
                        <td style={{ padding: '0.7rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#3b82f6', whiteSpace: 'nowrap' }}>
                          {formatIDR(pb.median_price)}
                        </td>
                        <td style={{ padding: '0.7rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#10b981', whiteSpace: 'nowrap' }}>
                          {formatIDR(pb.avg_price)}
                        </td>
                        <td style={{ padding: '0.7rem 0.75rem', textAlign: 'right', color: theme.textSecondary, whiteSpace: 'nowrap' }}>
                          {formatIDR(pb.p75_price)}
                        </td>
                        <td style={{ padding: '0.7rem 0.75rem', textAlign: 'right', color: theme.textSecondary, whiteSpace: 'nowrap' }}>
                          {formatIDR(pb.max_price)}
                        </td>
                        <td style={{ padding: '0.7rem 0.75rem', textAlign: 'right', color: theme.textMuted, whiteSpace: 'nowrap' }}>
                          <span style={{ padding: '0.15rem 0.45rem', borderRadius: '0.35rem', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', fontWeight: 700 }}>
                            {formatNumber(pb.sample_count)} item / {formatNumber(pb.unique_store_count)} toko
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: theme.textMuted, fontSize: '0.8rem' }}>
                Benchmark harga otomatis muncul setelah kategori memiliki minimal {kMinStores} toko unik dengan harga aktif (&gt; Rp 0).
              </div>
            )}
          </div>

          {/* Legal Compliance Footer Notice */}
          <div
            style={{
              padding: '1rem 1.35rem',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(16, 185, 129, 0.06)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}
          >
            <ShieldCheck size={20} style={{ color: '#10b981', flexShrink: 0 }} />
            <div style={{ fontSize: '0.72rem', color: theme.textSecondary, lineHeight: 1.45 }}>
              <strong style={{ color: '#10b981' }}>Kepatuhan UU No. 27 Tahun 2022 (UU PDP):</strong>{' '}
              {data.data_privacy_notice || PRIVACY_COMPLIANCE_SUMMARY}
            </div>
          </div>
        </div>
      ) : null}

      <AnalyticsDimensionModal
        isOpen={dimensionModalOpen}
        onClose={() => setDimensionModalOpen(false)}
        dimensionType={selectedDimension?.type || 'locations'}
        title={selectedDimension?.title || ''}
        items={selectedDimension?.items || []}
        themeMode={isDark ? 'dark' : 'light'}
      />
    </div>
  );
};
