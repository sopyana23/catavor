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
  BarChart3
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
  const [activeSegment, setActiveSegment] = useState<'overview' | 'demand_gap' | 'benchmarks'>('overview');

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

  const handleDownloadCsv = () => {
    setIsExportingCsv(true);
    try {
      const downloadUrl = `/api/admin/market-intelligence/export?format=csv`;
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `catavor-market-intelligence-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast?.('Laporan data riset pasar CSV berhasil diunduh.', 'success');
    } catch {
      showToast?.('Gagal mengunduh laporan CSV.', 'error');
    } finally {
      setTimeout(() => setIsExportingCsv(false), 1200);
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
          gridTemplateColumns: 'repeat(3, 1fr)',
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
      </div>

      {loading ? (
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
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem 0.6rem' }}>Kategori</th>
                      <th style={{ padding: '0.5rem 0.6rem' }}>Min</th>
                      <th style={{ padding: '0.5rem 0.6rem' }}>Rata-rata</th>
                      <th style={{ padding: '0.5rem 0.6rem' }}>Maks</th>
                      <th style={{ padding: '0.5rem 0.6rem' }}>Sampel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.price_benchmarks.map((pb, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px dashed var(--border-light)' }}>
                        <td style={{ padding: '0.55rem 0.6rem', fontWeight: 700 }}>{pb.category_name}</td>
                        <td style={{ padding: '0.55rem 0.6rem', color: 'var(--text-secondary)' }}>{formatPrice(pb.min_price)}</td>
                        <td style={{ padding: '0.55rem 0.6rem', fontWeight: 800, color: '#10b981' }}>{formatPrice(pb.avg_price)}</td>
                        <td style={{ padding: '0.55rem 0.6rem', color: 'var(--text-secondary)' }}>{formatPrice(pb.max_price)}</td>
                        <td style={{ padding: '0.55rem 0.6rem', color: 'var(--text-muted)' }}>{pb.sample_count} item</td>
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
    </div>
  );
};

