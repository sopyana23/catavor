import React, { useState, useEffect } from 'react';
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
  ArrowUpRight,
  BarChart3,
  Tag,
  AlertTriangle,
  FileSpreadsheet
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

export interface MobileMarketIntelViewProps {
  token: string;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
  themeMode?: 'dark' | 'light';
}

export const MobileMarketIntelView: React.FC<MobileMarketIntelViewProps> = ({
  token,
  showToast,
  themeMode
}) => {
  const isDark = themeMode === 'dark' || document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');

  const [data, setData] = useState<MarketIntelligenceData | null>(null);
  const [trendingKeywords, setTrendingKeywords] = useState<TrendingKeywordItem[]>([]);
  const [demandGaps, setDemandGaps] = useState<DemandGapItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);
  const [isTriggeringBot, setIsTriggeringBot] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'keywords' | 'demand_gaps' | 'benchmarks'>('overview');

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
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(num);
  };

  const theme = {
    surface: isDark ? 'rgba(30, 41, 59, 0.7)' : '#ffffff',
    cardAlt: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
    border: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    accent: '#0284c7'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '3rem', animation: 'fadeIn 0.25s ease-out' }}>
      {/* 1. Header Hero Banner */}
      <div style={{
        backgroundColor: theme.surface,
        borderRadius: '1rem',
        border: `1px solid ${theme.border}`,
        padding: '1rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.75rem',
              backgroundColor: isDark ? 'rgba(2, 132, 199, 0.2)' : 'rgba(2, 132, 199, 0.1)',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <TrendingUp size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: theme.textPrimary, letterSpacing: '-0.01em' }}>
                Riset Pasar B2B
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: theme.textSecondary }}>
                Data agregat tren & peluang bernilai komersial
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchMarketIntel}
            disabled={loading}
            style={{
              width: '36px',
              height: '36px',
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
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Legal & Privacy Compliance Badge */}
        <div style={{
          marginTop: '0.85rem',
          padding: '0.55rem 0.75rem',
          borderRadius: '0.65rem',
          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <ShieldCheck size={16} style={{ color: '#10b981', flexShrink: 0 }} />
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: isDark ? '#6ee7b7' : '#047857', lineHeight: 1.3 }}>
            Legalitas Terjamin UU No. 27/2022 (UU PDP). Privasi K-Anonymity (k $\ge$ 50) tanpa PII pedagang atau pembeli.
          </span>
        </div>
      </div>

      {/* 2. Key Metrics Grid (2x2 Grid) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '0.65rem'
      }}>
        {/* Metric 1: Total Listing Produk */}
        <div style={{
          backgroundColor: theme.surface,
          borderRadius: '0.85rem',
          padding: '0.85rem',
          border: `1px solid ${theme.border}`
        }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>
            Produk Aktif
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: theme.textPrimary }}>
              {data ? data.total_active_products.toLocaleString('id-ID') : '-'}
            </span>
            <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>unit</span>
          </div>
        </div>

        {/* Metric 2: Total Views 30 Hari */}
        <div style={{
          backgroundColor: theme.surface,
          borderRadius: '0.85rem',
          padding: '0.85rem',
          border: `1px solid ${theme.border}`
        }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>
            Views (30 Hari)
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0284c7' }}>
              {data ? data.total_views_30d.toLocaleString('id-ID') : '-'}
            </span>
            <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>tayangan</span>
          </div>
        </div>

        {/* Metric 3: Rasio Konversi */}
        <div style={{
          backgroundColor: theme.surface,
          borderRadius: '0.85rem',
          padding: '0.85rem',
          border: `1px solid ${theme.border}`
        }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>
            Rerata Konversi (CTR)
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981' }}>
              {data ? `${data.overall_conversion_rate.toFixed(1)}%` : '-'}
            </span>
            <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>dari views</span>
          </div>
        </div>

        {/* Metric 4: Demand Gaps (Pencarian Nihil) */}
        <div style={{
          backgroundColor: theme.surface,
          borderRadius: '0.85rem',
          padding: '0.85rem',
          border: `1px solid ${demandGaps.length > 0 ? (isDark ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.25)') : theme.border}`
        }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>
            Demand Gap Kritis
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: demandGaps.length > 0 ? '#ef4444' : theme.textPrimary }}>
              {demandGaps.length}
            </span>
            <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>pencarian 0 hasil</span>
          </div>
        </div>
      </div>

      {/* 3. Action Buttons (Picu Bot & Unduh CSV) - Touch Targets >= 44px */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '0.65rem'
      }}>
        <button
          type="button"
          onClick={handleTriggerAggregation}
          disabled={isTriggeringBot}
          style={{
            minHeight: '44px',
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
            padding: '0.5rem 0.75rem'
          }}
        >
          <Zap size={16} className={isTriggeringBot ? 'animate-spin' : ''} style={{ color: '#f59e0b' }} />
          <span>{isTriggeringBot ? 'Memproses...' : 'Picu Bot Agregasi'}</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadCsv}
          disabled={isExportingCsv}
          style={{
            minHeight: '44px',
            borderRadius: '0.75rem',
            border: 'none',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            fontSize: '0.78rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            cursor: 'pointer',
            padding: '0.5rem 0.75rem',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
          }}
        >
          <Download size={16} />
          <span>{isExportingCsv ? 'Menyiapkan...' : 'Unduh CSV Riset'}</span>
        </button>
      </div>

      {/* 4. Touch Segmented Tabs (Horizontal Scroll / Grid) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '0.35rem',
        backgroundColor: theme.cardAlt,
        padding: '0.25rem',
        borderRadius: '0.85rem',
        border: `1px solid ${theme.border}`
      }}>
        {[
          { key: 'overview', label: 'Ringkasan' },
          { key: 'keywords', label: 'Hype' },
          { key: 'demand_gaps', label: 'Gap Nihil' },
          { key: 'benchmarks', label: 'Harga' }
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                minHeight: '44px',
                borderRadius: '0.65rem',
                border: 'none',
                backgroundColor: isActive ? (isDark ? '#0284c7' : '#0284c7') : 'transparent',
                color: isActive ? '#ffffff' : theme.textSecondary,
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.74rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.25rem 0.4rem'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 5. Tab Content Sections */}
      {loading && !data && (
        <div style={{
          padding: '2.5rem 1rem',
          textAlign: 'center',
          backgroundColor: theme.surface,
          borderRadius: '1rem',
          border: `1px solid ${theme.border}`
        }}>
          <RefreshCw size={24} className="animate-spin" style={{ color: '#0284c7', margin: '0 auto 0.75rem auto' }} />
          <p style={{ margin: 0, fontSize: '0.82rem', color: theme.textSecondary }}>
            Menghubungkan ke pusat intelijen pasar...
          </p>
        </div>
      )}

      {error && (
        <div style={{
          padding: '1.25rem',
          borderRadius: '0.85rem',
          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.65rem'
        }}>
          <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ef4444', display: 'block' }}>
              Gagal Memuat Riset
            </span>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.74rem', color: theme.textSecondary }}>
              {error}
            </p>
          </div>
        </div>
      )}

      {/* TAB A: OVERVIEW */}
      {activeTab === 'overview' && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Traffic Channel Breakdown Card */}
          <div style={{
            backgroundColor: theme.surface,
            borderRadius: '1rem',
            border: `1px solid ${theme.border}`,
            padding: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <BarChart3 size={18} style={{ color: '#0284c7' }} />
              <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                Distribusi Kanal Aksi Pengguna
              </h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { label: 'Klik WhatsApp Direct', percent: data.channel_breakdown.direct_wa_percent, count: data.channel_breakdown.direct_wa_clicks, color: '#10b981' },
                { label: 'Kunjungan Marketplace', percent: data.channel_breakdown.marketplace_percent, count: data.channel_breakdown.marketplace_clicks, color: '#f59e0b' },
                { label: 'Eksplorasi Rekber Syariah', percent: data.channel_breakdown.rekber_percent, count: data.channel_breakdown.rekber_clicks, color: '#6366f1' },
                { label: 'Pemutaran Video Katalog', percent: data.channel_breakdown.video_views_percent, count: data.channel_breakdown.video_views, color: '#ec4899' }
              ].map((ch, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                    <span style={{ fontWeight: 600, color: theme.textPrimary }}>{ch.label}</span>
                    <span style={{ fontWeight: 800, color: ch.color }}>{ch.percent.toFixed(1)}% ({ch.count})</span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '6px',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    borderRadius: '999px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${Math.min(100, Math.max(0, ch.percent))}%`,
                      height: '100%',
                      backgroundColor: ch.color,
                      borderRadius: '999px'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Categories Card */}
          <div style={{
            backgroundColor: theme.surface,
            borderRadius: '1rem',
            border: `1px solid ${theme.border}`,
            padding: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <Layers size={18} style={{ color: '#8b5cf6' }} />
              <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                Kategori Paling Diminati
              </h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {data.top_categories.slice(0, 5).map((cat, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.75rem',
                    backgroundColor: theme.cardAlt,
                    border: `1px solid ${theme.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: theme.textPrimary, display: 'block' }}>
                      {cat.category_name}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: theme.textSecondary }}>
                      {cat.product_count} produk · {cat.total_views} views
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#10b981', display: 'block' }}>
                      {cat.conversion_rate.toFixed(1)}% CTR
                    </span>
                    <span style={{ fontSize: '0.68rem', color: theme.textSecondary }}>
                      Rerata {formatPrice(cat.average_price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB B: HYPE KEYWORDS */}
      {activeTab === 'keywords' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{
            backgroundColor: theme.surface,
            borderRadius: '1rem',
            border: `1px solid ${theme.border}`,
            padding: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Search size={18} style={{ color: '#0284c7' }} />
              <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                Kata Kunci Paling Dicari ({trendingKeywords.length})
              </h4>
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: theme.textSecondary }}>
              Kata kunci organik dengan volume pencarian tertinggi dari calon pembeli.
            </p>
          </div>

          {trendingKeywords.length === 0 ? (
            <div style={{
              padding: '2.5rem 1rem',
              textAlign: 'center',
              backgroundColor: theme.surface,
              borderRadius: '1rem',
              border: `1px solid ${theme.border}`
            }}>
              <p style={{ margin: 0, fontSize: '0.82rem', color: theme.textSecondary }}>
                Belum ada data kata kunci yang terkumpul dalam periode ini.
              </p>
            </div>
          ) : (
            trendingKeywords.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.85rem',
                  borderRadius: '0.85rem',
                  backgroundColor: theme.surface,
                  border: `1px solid ${theme.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Tag size={15} style={{ color: '#0284c7' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: theme.textPrimary }}>
                      {item.keyword}
                    </span>
                  </div>
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    backgroundColor: isDark ? 'rgba(2, 132, 199, 0.2)' : 'rgba(2, 132, 199, 0.1)',
                    color: '#0284c7'
                  }}>
                    {item.product_type || 'Umum'}
                  </span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.35rem',
                  marginTop: '0.2rem',
                  paddingTop: '0.45rem',
                  borderTop: `1px dashed ${theme.border}`
                }}>
                  <div>
                    <span style={{ fontSize: '0.62rem', color: theme.textSecondary, display: 'block' }}>Pencarian</span>
                    <strong style={{ fontSize: '0.78rem', color: theme.textPrimary }}>{item.search_volume}x</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.62rem', color: theme.textSecondary, display: 'block' }}>Nihil (0)</span>
                    <strong style={{ fontSize: '0.78rem', color: item.zero_count > 0 ? '#ef4444' : theme.textPrimary }}>
                      {item.zero_count}x
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.62rem', color: theme.textSecondary, display: 'block' }}>CTR Estimasi</span>
                    <strong style={{ fontSize: '0.78rem', color: '#10b981' }}>{item.ctr.toFixed(1)}%</strong>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB C: DEMAND GAPS */}
      {activeTab === 'demand_gaps' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{
            backgroundColor: theme.surface,
            borderRadius: '1rem',
            border: `1px solid ${theme.border}`,
            padding: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <AlertTriangle size={18} style={{ color: '#ef4444' }} />
              <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                Demand Gap: Pencarian Tanpa Hasil ({demandGaps.length})
              </h4>
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: theme.textSecondary }}>
              Permintaan pasar nyata yang belum dapat dipenuhi oleh katalog merchant saat ini.
            </p>
          </div>

          {demandGaps.length === 0 ? (
            <div style={{
              padding: '2.5rem 1rem',
              textAlign: 'center',
              backgroundColor: theme.surface,
              borderRadius: '1rem',
              border: `1px solid ${theme.border}`
            }}>
              <ShieldCheck size={28} style={{ color: '#10b981', margin: '0 auto 0.5rem auto' }} />
              <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: theme.textPrimary }}>
                Katalog Optimal!
              </p>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.72rem', color: theme.textSecondary }}>
                Tidak ditemukan kata kunci bernilai tinggi yang menghasilkan 0 hasil.
              </p>
            </div>
          ) : (
            demandGaps.map((gap, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.85rem',
                  borderRadius: '0.85rem',
                  backgroundColor: theme.surface,
                  border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.2)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                    "{gap.keyword}"
                  </span>
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444'
                  }}>
                    {gap.zero_result_count}x Nihil
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '0.35rem',
                  borderTop: `1px dashed ${theme.border}`,
                  fontSize: '0.72rem'
                }}>
                  <span style={{ color: theme.textSecondary }}>Rekomendasi Tipe:</span>
                  <span style={{ fontWeight: 700, color: '#0284c7' }}>
                    {gap.product_type || 'Kategori Baru'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB D: PRICE BENCHMARKS */}
      {activeTab === 'benchmarks' && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{
            backgroundColor: theme.surface,
            borderRadius: '1rem',
            border: `1px solid ${theme.border}`,
            padding: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <FileSpreadsheet size={18} style={{ color: '#10b981' }} />
              <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                Benchmark Rentang Harga
              </h4>
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: theme.textSecondary }}>
              Rerata dan rentang harga pasar riil berdasarkan katalog aktif.
            </p>
          </div>

          {data.price_benchmarks.map((b, idx) => (
            <div
              key={idx}
              style={{
                padding: '0.85rem',
                borderRadius: '0.85rem',
                backgroundColor: theme.surface,
                border: `1px solid ${theme.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                  {b.category_name}
                </span>
                <span style={{ fontSize: '0.68rem', color: theme.textSecondary }}>
                  {b.sample_count} sampel listing
                </span>
              </div>

              <div style={{
                padding: '0.65rem',
                borderRadius: '0.65rem',
                backgroundColor: theme.cardAlt,
                border: `1px solid ${theme.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <span style={{ fontSize: '0.65rem', color: theme.textSecondary, display: 'block' }}>Rerata Harga</span>
                  <strong style={{ fontSize: '0.92rem', color: '#10b981', fontWeight: 900 }}>
                    {formatPrice(b.avg_price)}
                  </strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.65rem', color: theme.textSecondary, display: 'block' }}>Median Pasar</span>
                  <strong style={{ fontSize: '0.92rem', color: theme.textPrimary, fontWeight: 800 }}>
                    {formatPrice(b.median_price)}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: theme.textSecondary }}>
                <span>Min: {formatPrice(b.min_price)}</span>
                <span>Maks: {formatPrice(b.max_price)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MobileMarketIntelView;

