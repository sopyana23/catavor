import React, { useState, useEffect } from 'react';
import {
  Globe,
  TrendingUp,
  Download,
  ShieldCheck,
  Zap,
  MessageCircle,
  ShoppingBag,
  CreditCard,
  Layers,
  Sparkles,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  Search,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Lock,
  Clock
} from 'lucide-react';

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

export interface PlatformMarketIntelViewProps {
  token: string;
  isDark: boolean;
  theme: any;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
}

export const PlatformMarketIntelView: React.FC<PlatformMarketIntelViewProps> = ({
  token,
  isDark,
  theme,
  showToast
}) => {
  const [data, setData] = useState<MarketIntelligenceData | null>(null);
  const [trendingKeywords, setTrendingKeywords] = useState<TrendingKeywordItem[]>([]);
  const [demandGaps, setDemandGaps] = useState<DemandGapItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);
  const [isTriggeringBot, setIsTriggeringBot] = useState<boolean>(false);
  const [lastAggregatedAt, setLastAggregatedAt] = useState<string>('');

  const fetchMarketIntel = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const [mainRes, trendRes, gapRes] = await Promise.all([
        fetch('/api/admin/market-intelligence', { headers }),
        fetch('/api/admin/market-intelligence/trending-keywords', { headers }),
        fetch('/api/admin/market-intelligence/demand-gaps', { headers })
      ]);

      const mainJson = await mainRes.json();
      if (mainJson.success && mainJson.data) {
        setData(mainJson.data);
        if (mainJson.data.generated_at) {
          setLastAggregatedAt(mainJson.data.generated_at);
        }
      } else {
        // Fallback to public route if admin route requires different scope
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
      setError(err.message || 'Koneksi ke backend analytics gagal.');
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
        setTimeout(() => {
          fetchMarketIntel();
        }, 1500);
      } else {
        showToast?.(json.error || 'Gagal memicu bot agregasi.', 'error');
      }
    } catch (err: any) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
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
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: theme.textPrimary, margin: 0 }}>
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
                K-ANONYMITY &ge; 50
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: theme.textSecondary, margin: '0.25rem 0 0 0', lineHeight: 1.4 }}>
              Analisis tren belanja konsumen nasional, lonjakan kata kunci pencarian, kesenjangan pasokan (*demand gap*), dan benchmark harga industri.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
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
              gap: '0.45rem',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={14} className={isTriggeringBot ? 'animate-spin' : ''} />
            <span>{isTriggeringBot ? 'Memproses...' : 'Picu Agregasi Sekarang'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={isExportingCsv || !data}
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
              boxShadow: '0 4px 14px rgba(5, 150, 105, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <FileSpreadsheet size={15} />
            <span>{isExportingCsv ? 'Mengunduh...' : 'Unduh Laporan CSV Riset'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: theme.textSecondary }}>
          <RefreshCw size={32} className="animate-spin" style={{ color: '#10b981', margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '0.92rem', fontWeight: 600 }}>Mengompilasi dataset intelijen pasar nasional...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '1.25rem', borderRadius: '0.85rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <AlertCircle size={20} />
          <div>
            <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: 800, fontSize: '0.9rem' }}>Gagal Mengambil Data Riset</h4>
            <span style={{ fontSize: '0.8rem' }}>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchMarketIntel}
            style={{ marginLeft: 'auto', padding: '0.4rem 0.85rem', borderRadius: '0.5rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
          >
            Coba Lagi
          </button>
        </div>
      ) : data ? (
        <>
          {/* 4-Column Macro Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {/* Metric 1: Total Active Catalogs */}
            <div
              style={{
                padding: '1.15rem 1.35rem',
                borderRadius: '0.85rem',
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.55)' : '#ffffff',
                border: `1px solid ${theme.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary }}>Basis Data Katalog Aktif</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: theme.textPrimary, letterSpacing: '-0.02em' }}>
                {data.total_active_products.toLocaleString('id-ID')}
              </div>
              <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>
                Tersebar di {data.total_active_stores} profil merchant terdaftar
              </span>
            </div>

            {/* Metric 2: Total 30D Views */}
            <div
              style={{
                padding: '1.15rem 1.35rem',
                borderRadius: '0.85rem',
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.55)' : '#ffffff',
                border: `1px solid ${theme.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary }}>Interaksi Konsumen 30 Hari</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#10b981', letterSpacing: '-0.02em' }}>
                {data.total_views_30d.toLocaleString('id-ID')}
              </div>
              <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>
                Menghasilkan {data.total_actions_30d.toLocaleString('id-ID')} klik tindakan transaksi
              </span>
            </div>

            {/* Metric 3: Overall Conversion Rate */}
            <div
              style={{
                padding: '1.15rem 1.35rem',
                borderRadius: '0.85rem',
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.55)' : '#ffffff',
                border: `1px solid ${theme.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary }}>Rasio Konversi Rata-rata</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#f59e0b', letterSpacing: '-0.02em' }}>
                {data.overall_conversion_rate}%
              </div>
              <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>
                Efektivitas etalase mengubah pengunjung menjadi pembeli
              </span>
            </div>

            {/* Metric 4: Demand Gaps Count */}
            <div
              style={{
                padding: '1.15rem 1.35rem',
                borderRadius: '0.85rem',
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.55)' : '#ffffff',
                border: `1px solid ${theme.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary }}>Peluang Pasokan (Demand Gap)</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowUpRight size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#ef4444', letterSpacing: '-0.02em' }}>
                {demandGaps.length} Tren
              </div>
              <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>
                Kata kunci pencarian konsumen dengan stok saat ini nihil
              </span>
            </div>
          </div>

          {/* Saluran Minat Konsumen (Channel Breakdown) */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderRadius: '0.85rem',
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.55)' : '#ffffff',
              border: `1px solid ${theme.border}`
            }}
          >
            <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: theme.textPrimary, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={17} style={{ color: '#3b82f6' }} />
              Distribusi Preferensi Transaksi Konsumen (Saluran Minat Belanja)
            </h4>

            {/* Visual Multi-Segment Bar */}
            <div
              style={{
                height: '14px',
                borderRadius: '9999px',
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
                display: 'flex',
                overflow: 'hidden',
                marginBottom: '1.1rem'
              }}
            >
              <div style={{ width: `${data.channel_breakdown.direct_wa_percent}%`, backgroundColor: '#10b981', transition: 'width 0.4s ease' }} title={`WA Direct: ${data.channel_breakdown.direct_wa_percent}%`} />
              <div style={{ width: `${data.channel_breakdown.rekber_percent}%`, backgroundColor: '#3b82f6', transition: 'width 0.4s ease' }} title={`Rekber Catavor: ${data.channel_breakdown.rekber_percent}%`} />
              <div style={{ width: `${data.channel_breakdown.marketplace_percent}%`, backgroundColor: '#f59e0b', transition: 'width 0.4s ease' }} title={`Marketplace: ${data.channel_breakdown.marketplace_percent}%`} />
              <div style={{ width: `${data.channel_breakdown.video_views_percent}%`, backgroundColor: '#8b5cf6', transition: 'width 0.4s ease' }} title={`Video Product: ${data.channel_breakdown.video_views_percent}%`} />
            </div>

            {/* Legend Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
              <div style={{ padding: '0.75rem', borderRadius: '0.65rem', backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc', border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>Chat WhatsApp Langsung</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textPrimary }}>
                    {data.channel_breakdown.direct_wa_clicks.toLocaleString('id-ID')} <span style={{ fontSize: '0.72rem', color: '#10b981' }}>({data.channel_breakdown.direct_wa_percent}%)</span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '0.75rem', borderRadius: '0.65rem', backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc', border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>Escrow Rekber Aman</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textPrimary }}>
                    {data.channel_breakdown.rekber_clicks.toLocaleString('id-ID')} <span style={{ fontSize: '0.72rem', color: '#3b82f6' }}>({data.channel_breakdown.rekber_percent}%)</span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '0.75rem', borderRadius: '0.65rem', backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc', border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>Tautan Marketplace Luar</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textPrimary }}>
                    {data.channel_breakdown.marketplace_clicks.toLocaleString('id-ID')} <span style={{ fontSize: '0.72rem', color: '#f59e0b' }}>({data.channel_breakdown.marketplace_percent}%)</span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '0.75rem', borderRadius: '0.65rem', backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc', border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#8b5cf6', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>Tontonan Video Review</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textPrimary }}>
                    {data.channel_breakdown.video_views.toLocaleString('id-ID')} <span style={{ fontSize: '0.72rem', color: '#8b5cf6' }}>({data.channel_breakdown.video_views_percent}%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2-Column Split: Trending Hype vs Demand Gap */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.25rem' }}>
            {/* Column 1: Trending Hype Keywords */}
            <div
              style={{
                padding: '1.35rem',
                borderRadius: '0.85rem',
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.55)' : '#ffffff',
                border: `1px solid ${theme.border}`,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Search size={17} style={{ color: '#3b82f6' }} />
                  Kata Kunci Paling Dicari (Tren Hype Pasar)
                </h4>
                <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>Top 12 Pencarian</span>
              </div>
              <p style={{ fontSize: '0.72rem', color: theme.textSecondary, margin: '0 0 1rem 0', lineHeight: 1.45 }}>
                Kata kunci dengan frekuensi pencarian tertinggi di seluruh katalog publik. Menunjukkan komoditas yang sedang ramai diminati masyarakat.
              </p>

              {trendingKeywords.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
                  {trendingKeywords.slice(0, 12).map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: '0.65rem',
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.65)' : '#f8fafc',
                        border: `1px solid ${theme.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: theme.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.keyword}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: theme.textMuted }}>
                          {item.product_type || 'Umum'}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '0.4rem',
                          backgroundColor: 'rgba(59, 130, 246, 0.12)',
                          color: '#3b82f6',
                          flexShrink: 0
                        }}
                      >
                        {item.search_volume}x cari
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: theme.textMuted, fontSize: '0.8rem' }}>
                  Belum ada kata kunci pencarian terkumpul.
                </div>
              )}
            </div>

            {/* Column 2: Demand Gap Explorer (Zero Result Searches) */}
            <div
              style={{
                padding: '1.35rem',
                borderRadius: '0.85rem',
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.55)' : '#ffffff',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ArrowUpRight size={17} style={{ color: '#f59e0b' }} />
                  Peluang Pasokan Baru (Demand Gap - Nihil Hasil)
                </h4>
                <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700 }}>Zero-Result Sensor</span>
              </div>
              <p style={{ fontSize: '0.72rem', color: theme.textSecondary, margin: '0 0 1rem 0', lineHeight: 1.45 }}>
                Konsumen berulang kali mencari produk berikut tetapi etalase toko saat ini belum menyediakannya. Data bernilai tinggi bagi prinsipal dan distributor untuk memasok varian baru.
              </p>

              {demandGaps.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
                  {demandGaps.slice(0, 12).map((gap, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: '0.65rem',
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.65)' : '#f8fafc',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: theme.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {gap.keyword}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: '#f59e0b' }}>
                          Peluang supplier masuk
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '0.4rem',
                          backgroundColor: 'rgba(245, 158, 11, 0.12)',
                          color: '#f59e0b',
                          flexShrink: 0
                        }}
                      >
                        {gap.zero_result_count}x nihil
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: theme.textMuted, fontSize: '0.8rem' }}>
                  Tidak ada pencarian kosong dalam periode saat ini. Seluruh pencarian terpenuhi.
                </div>
              )}
            </div>
          </div>

          {/* Benchmark Sebaran Harga Pasar Wajar per Kategori */}
          {data.price_benchmarks && data.price_benchmarks.length > 0 && (
            <div
              style={{
                padding: '1.35rem 1.65rem',
                borderRadius: '0.85rem',
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.55)' : '#ffffff',
                border: `1px solid ${theme.border}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={17} style={{ color: '#10b981' }} />
                  Benchmark Sebaran Rentang Harga Pasar Wajar per Kategori
                </h4>
                <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>K-Anonymity &ge; 50 Sampel</span>
              </div>
              <p style={{ fontSize: '0.72rem', color: theme.textSecondary, margin: '0 0 1.1rem 0' }}>
                Distribusi nilai harga minimum, rata-rata industri, median, dan maksimum untuk mencegah predatory pricing dan memberikan acuan harga kompetitif bagi merchant.
              </p>

              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${theme.border}`, color: theme.textSecondary, textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Kategori Komoditas</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Harga Minimum</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Rata-rata Pasar</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Nilai Median</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Harga Maksimum</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Ukuran Sampel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.price_benchmarks.map((pb, idx) => (
                      <tr key={idx} style={{ borderBottom: `1px dashed ${theme.border}` }}>
                        <td style={{ padding: '0.75rem 0.85rem', fontWeight: 700, color: theme.textPrimary }}>
                          {pb.category_name}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', color: theme.textSecondary }}>
                          {formatPrice(pb.min_price)}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', fontWeight: 800, color: '#10b981' }}>
                          {formatPrice(pb.avg_price)}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', color: theme.textSecondary }}>
                          {formatPrice(pb.median_price)}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', color: theme.textSecondary }}>
                          {formatPrice(pb.max_price)}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', color: theme.textMuted }}>
                          <span style={{ padding: '0.15rem 0.45rem', borderRadius: '0.35rem', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', fontWeight: 700 }}>
                            {pb.sample_count} item
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
              <strong style={{ color: '#10b981' }}>Kepatuhan UU No. 27 Tahun 2022 (UU PDP):</strong> Seluruh dataset intelijen pasar diolah secara agregat murni tanpa memuat nama, nomor kontak, alamat, atau identitas pribadi konsumen. Data dilindungi pengaman privasi K-Anonymity (&ge;50 sampel) guna menjamin kemustahilan re-identifikasi subjek data.
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

