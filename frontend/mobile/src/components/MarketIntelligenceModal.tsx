import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  ArrowUpRight
} from 'lucide-react';
import { useModalBackHandler } from '../utils/navigation';

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

export interface MarketIntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiBase?: string;
}

export const MarketIntelligenceModal: React.FC<MarketIntelligenceModalProps> = ({
  isOpen,
  onClose,
  apiBase = ''
}) => {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dragStartY = React.useRef(0);

  const closeWithAnimation = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setDragY(0);
      onClose();
    }, 280);
  };

  useModalBackHandler({
    isOpen,
    onClose: closeWithAnimation,
    modalId: 'market-intel-modal-mobile'
  });

  const handleDragStart = (clientY: number) => {
    dragStartY.current = clientY;
    setIsDragging(true);
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return;
    const delta = clientY - dragStartY.current;
    if (delta > 0) {
      setDragY(delta);
    } else {
      setDragY(delta * 0.15);
    }
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragY > 70) {
      closeWithAnimation();
    } else {
      setDragY(0);
    }
  };

  const [data, setData] = useState<MarketIntelligenceData | null>(null);
  const [trendingKeywords, setTrendingKeywords] = useState<TrendingKeywordItem[]>([]);
  const [demandGaps, setDemandGaps] = useState<DemandGapItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  const fetchMarketIntel = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mainRes, trendRes, gapRes] = await Promise.all([
        fetch(`${apiBase}/api/market-intelligence`),
        fetch(`${apiBase}/api/market-intelligence/trending-keywords`),
        fetch(`${apiBase}/api/market-intelligence/demand-gaps`)
      ]);
      const json = await mainRes.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        setError(json.message || 'Gagal memuat data riset pasar.');
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
    if (isOpen) {
      fetchMarketIntel();
    }
  }, [isOpen]);

  const handleDownloadCsv = () => {
    setDownloadingCsv(true);
    const downloadUrl = `${apiBase}/api/market-intelligence/export?format=csv`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `catavor-market-intelligence-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloadingCsv(false), 1000);
  };

  if (!isOpen) return null;

  const formatPrice = (num?: number) => {
    if (!num && num !== 0) return 'Rp 0';
    return 'Rp ' + Math.round(num).toLocaleString('id-ID');
  };

  return typeof document !== 'undefined' ? createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 12000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: 0,
        boxSizing: 'border-box'
      }}
      onClick={closeWithAnimation}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-card)',
          borderTopLeftRadius: '1.5rem',
          borderTopRightRadius: '1.5rem',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          border: '1px solid var(--border-light)',
          borderBottom: 'none',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
          transform: isClosing ? 'translateY(100%)' : `translateY(${Math.max(0, dragY)}px)`,
          transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Sheet Drag Handle Bar (Touch & Mouse Drag-Down to Dismiss) */}
        <div
          onMouseDown={e => handleDragStart(e.clientY)}
          onMouseMove={e => handleDragMove(e.clientY)}
          onMouseUp={handleDragEnd}
          onTouchStart={e => handleDragStart(e.touches[0].clientY)}
          onTouchMove={e => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
          style={{
            padding: '0.65rem 0 0.35rem',
            display: 'flex',
            justifyContent: 'center',
            cursor: 'grab',
            touchAction: 'none'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '4px',
              backgroundColor: 'var(--border-light)',
              borderRadius: '9999px'
            }}
          />
        </div>

        {/* Header Bar */}
        <div
          onMouseDown={e => handleDragStart(e.clientY)}
          onMouseMove={e => handleDragMove(e.clientY)}
          onMouseUp={handleDragEnd}
          onTouchStart={e => handleDragStart(e.touches[0].clientY)}
          onTouchMove={e => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
          style={{
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)',
            touchAction: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--primary-glow)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Globe size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Market Intelligence
                </h3>
                <span
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    textTransform: 'uppercase'
                  }}
                >
                  UU PDP LEGAL
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Wawasan Tren Industri &amp; Preferensi Belanja Nasional
              </span>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--primary)', margin: '0 auto 0.75rem' }} />
              <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Mengagregasi data tren ekosistem...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={18} />
              <span style={{ fontSize: '0.8rem' }}>{error}</span>
            </div>
          ) : data ? (
            <>
              {/* Privacy Notice Banner */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem'
                }}
              >
                <ShieldCheck size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Kepatuhan Hukum UU PDP No. 27/2022:</strong> {data.data_privacy_notice}
                </div>
              </div>

              {/* Macro Summary 4 Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
                <div className="glass-panel" style={{ padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Toko Terdata</span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.2rem 0' }}>
                    {data.total_active_stores.toLocaleString()}
                  </div>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Sampel aktif</span>
                </div>

                <div className="glass-panel" style={{ padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Katalog Produk</span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.2rem 0' }}>
                    {data.total_active_products.toLocaleString()}
                  </div>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Item terindeks</span>
                </div>

                <div className="glass-panel" style={{ padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Views (30H)</span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#3b82f6', margin: '0.2rem 0' }}>
                    {data.total_views_30d.toLocaleString()}
                  </div>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Interaksi publik</span>
                </div>

                <div className="glass-panel" style={{ padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Konversi Aksi</span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#10b981', margin: '0.2rem 0' }}>
                    {data.overall_conversion_rate}%
                  </div>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Rata-rata industri</span>
                </div>
              </div>

              {/* Multi-Channel Purchase Intent Breakdown */}
              <div className="glass-panel" style={{ padding: '1rem', borderRadius: '0.85rem', border: '1px solid var(--border-light)' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.65rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Zap size={15} style={{ color: 'var(--primary)' }} />
                  Preferensi Kanal Konversi Konsumen
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
                  <div style={{ padding: '0.7rem', borderRadius: '0.6rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#10b981', fontSize: '0.7rem', fontWeight: 700 }}>
                      <MessageCircle size={13} />
                      <span>WhatsApp Langsung</span>
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                      {data.channel_breakdown.direct_wa_percent}%
                    </div>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{data.channel_breakdown.direct_wa_clicks} aksi klik</span>
                  </div>

                  <div style={{ padding: '0.7rem', borderRadius: '0.6rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f59e0b', fontSize: '0.7rem', fontWeight: 700 }}>
                      <ShoppingBag size={13} />
                      <span>Marketplace</span>
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                      {data.channel_breakdown.marketplace_percent}%
                    </div>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{data.channel_breakdown.marketplace_clicks} aksi klik</span>
                  </div>

                  <div style={{ padding: '0.7rem', borderRadius: '0.6rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#3b82f6', fontSize: '0.7rem', fontWeight: 700 }}>
                      <CreditCard size={13} />
                      <span>Rekber Escrow</span>
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                      {data.channel_breakdown.rekber_percent}%
                    </div>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{data.channel_breakdown.rekber_clicks} aksi klik</span>
                  </div>
                </div>
              </div>

              {/* Price Benchmarks by Category */}
              {data.price_benchmarks && data.price_benchmarks.length > 0 && (
                <div className="glass-panel" style={{ padding: '1rem', borderRadius: '0.85rem', border: '1px solid var(--border-light)' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.65rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Layers size={15} style={{ color: 'var(--primary)' }} />
                    Benchmark Rentang Harga Pasar Wajar per Kategori
                  </h4>
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                          <th style={{ padding: '0.4rem 0.5rem' }}>Kategori</th>
                          <th style={{ padding: '0.4rem 0.5rem' }}>Harga Min</th>
                          <th style={{ padding: '0.4rem 0.5rem' }}>Rata-rata</th>
                          <th style={{ padding: '0.4rem 0.5rem' }}>Harga Maks</th>
                          <th style={{ padding: '0.4rem 0.5rem' }}>Sampel</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.price_benchmarks.map((pb, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px dashed var(--border-light)' }}>
                            <td style={{ padding: '0.45rem 0.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{pb.category_name}</td>
                            <td style={{ padding: '0.45rem 0.5rem', color: 'var(--text-secondary)' }}>{formatPrice(pb.min_price)}</td>
                            <td style={{ padding: '0.45rem 0.5rem', fontWeight: 800, color: 'var(--primary)' }}>{formatPrice(pb.avg_price)}</td>
                            <td style={{ padding: '0.45rem 0.5rem', color: 'var(--text-secondary)' }}>{formatPrice(pb.max_price)}</td>
                            <td style={{ padding: '0.45rem 0.5rem', color: 'var(--text-muted)' }}>{pb.sample_count} item</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.65rem',
            backgroundColor: 'var(--bg-deep)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={closeWithAnimation}
              className="btn-secondary"
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.75rem',
                borderRadius: '0.5rem',
                fontWeight: 700
              }}
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={fetchMarketIntel}
              disabled={loading}
              className="btn-secondary"
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.75rem',
                borderRadius: '0.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Muat Ulang</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={downloadingCsv || !data}
            className="btn-primary"
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.75rem',
              borderRadius: '0.5rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <FileSpreadsheet size={14} />
            <span>{downloadingCsv ? 'Mengunduh...' : 'Unduh Laporan CSV Riset'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
};
