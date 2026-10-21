import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Eye,
  MessageCircle,
  RefreshCw,
  Download,
  ShoppingBag,
  ExternalLink,
  Layers,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Calendar
} from 'lucide-react';

export interface TabletAnalyticsViewProps {
  token: string;
  storeSlug: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const TabletAnalyticsView: React.FC<TabletAnalyticsViewProps> = ({
  token,
  storeSlug,
  showToast
}) => {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<any | null>(null);
  const cacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());

  const fetchAnalytics = useCallback(async (selectedPeriod: '7d' | '30d' | '90d' = period, force = false) => {
    if (!token || !storeSlug) return;
    const cacheKey = `${storeSlug}:${selectedPeriod}`;
    const cached = cacheRef.current.get(cacheKey);
    const now = Date.now();

    if (!force && cached && (now - cached.timestamp < 60_000)) {
      setData(cached.data);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?period=${selectedPeriod}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': storeSlug,
          'Accept': 'application/json'
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          cacheRef.current.set(cacheKey, { data: json.data, timestamp: Date.now() });
          setData(json.data);
        }
      } else {
        showToast('Gagal memuat data analitik toko', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat memuat analitik', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, storeSlug, period, showToast]);

  useEffect(() => {
    fetchAnalytics(period);
  }, [fetchAnalytics, period]);

  const handleExportCSV = () => {
    const url = `/api/admin/analytics/export?period=${period}`;
    window.open(url, '_blank');
  };

  const totalStoreViews = data?.total_store_views ?? data?.store_views ?? 0;
  const totalProductViews = data?.total_product_views ?? data?.product_views ?? 0;
  const totalWaClicks = data?.total_wa_clicks ?? data?.wa_clicks ?? 0;
  const totalActions = data?.total_actions ?? (totalWaClicks + (data?.channels?.marketplace || 0));
  const conversionRate = data?.conversion_rate_percent ?? (totalStoreViews > 0 ? ((totalActions / totalStoreViews) * 100) : 0);
  const topProducts = data?.top_products || [];

  return (
    <div style={{
      padding: '1.75rem',
      maxWidth: '1050px',
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box',
      overflowY: 'auto',
      height: '100vh',
      color: 'var(--text-primary)'
    }}>
      {/* Header Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid var(--border-light)',
        paddingBottom: '1.25rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '0.65rem',
              backgroundColor: 'rgba(30, 58, 138, 0.12)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <BarChart3 size={20} />
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>
              Statistik Kunjungan & Interaksi Toko
            </h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.35rem 0 0 0' }}>
            Pantau trafik aktual, tingkat interaksi calon pembeli, serta efektivitas katalog produk Anda.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* Period Segmented Switcher */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-card)',
            padding: '0.25rem',
            borderRadius: '0.65rem',
            border: '1px solid var(--border-light)'
          }}>
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                style={{
                  minHeight: '38px',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: period === p ? 'var(--primary)' : 'transparent',
                  color: period === p ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {p === '7d' ? '7 Hari' : p === '30d' ? '30 Hari' : '90 Hari'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => fetchAnalytics(period, true)}
            title="Segarkan Data"
            disabled={loading}
            style={{
              minHeight: '40px',
              minWidth: '40px',
              padding: '0.5rem',
              borderRadius: '0.65rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={16} className={loading ? 'spin-animation' : ''} />
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              minHeight: '40px',
              padding: '0.5rem 1rem',
              borderRadius: '0.65rem',
              backgroundColor: 'rgba(30, 58, 138, 0.12)',
              border: '1px solid var(--border-light)',
              color: 'var(--primary)',
              fontWeight: 700,
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              cursor: 'pointer'
            }}
          >
            <Download size={15} />
            Unduh CSV
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          padding: '1.25rem',
          borderRadius: '0.85rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Pengunjung Toko</span>
            <Users size={18} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {Number(totalStoreViews).toLocaleString('id-ID')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Total sesi kunjungan katalog
          </div>
        </div>

        <div style={{
          padding: '1.25rem',
          borderRadius: '0.85rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Dilihat Produk</span>
            <Eye size={18} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#3b82f6' }}>
            {Number(totalProductViews).toLocaleString('id-ID')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Tayangan rincian item
          </div>
        </div>

        <div style={{
          padding: '1.25rem',
          borderRadius: '0.85rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Klik Order WhatsApp</span>
            <MessageCircle size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#10b981' }}>
            {Number(totalWaClicks).toLocaleString('id-ID')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Pelanggan memulai chat pesan
          </div>
        </div>

        <div style={{
          padding: '1.25rem',
          borderRadius: '0.85rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Tingkat Konversi</span>
            <TrendingUp size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#f59e0b' }}>
            {Number(conversionRate).toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Rasio tayang ke aksi order
          </div>
        </div>
      </div>

      {/* Channel Breakdown Row */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '0.85rem',
        border: '1px solid var(--border-light)',
        padding: '1.25rem',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>
          Distribusi Kanal Konversi Pelanggan
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <div style={{ padding: '0.85rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>WhatsApp Langsung</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
              {Number(data?.channels?.direct_wa ?? totalWaClicks).toLocaleString('id-ID')}
            </div>
          </div>
          <div style={{ padding: '0.85rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Marketplace External</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {Number(data?.channels?.marketplace ?? 0).toLocaleString('id-ID')}
            </div>
          </div>
          <div style={{ padding: '0.85rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Rekber / Escrow</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {Number(data?.channels?.rekber ?? 0).toLocaleString('id-ID')}
            </div>
          </div>
          <div style={{ padding: '0.85rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Video Produk Ditonton</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {Number(data?.channels?.video ?? 0).toLocaleString('id-ID')}
            </div>
          </div>
        </div>
      </div>

      {/* Top Products Table */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '0.85rem',
        border: '1px solid var(--border-light)',
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
              Produk Paling Banyak Diminati
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
              Urutan produk berdasarkan interaksi calon pembeli pada periode {period === '7d' ? '7 hari terakhir' : period === '30d' ? '30 hari terakhir' : '90 hari terakhir'}.
            </p>
          </div>
        </div>

        {topProducts.length === 0 ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Belum ada interaksi produk yang tercatat pada rentang waktu ini.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {topProducts.slice(0, 8).map((prod: any, idx: number) => {
              const itemCtr = Number(prod.conversion_rate_percent ?? 0).toFixed(1);
              return (
                <div
                  key={prod.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'rgba(0,0,0,0.1)',
                      color: idx < 3 ? '#ffffff' : 'var(--text-muted)',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {idx + 1}
                    </div>

                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '0.5rem',
                      backgroundColor: 'var(--bg-card)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-light)',
                      flexShrink: 0
                    }}>
                      {prod.image_url ? (
                        <img src={prod.image_url} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <ShoppingBag size={18} color="var(--text-muted)" />
                      )}
                    </div>

                    <div style={{ overflow: 'hidden', minWidth: 0 }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {prod.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Harga: Rp {Number(prod.price || 0).toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {Number(prod.view_count || 0).toLocaleString('id-ID')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Dilihat</div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#10b981' }}>
                        {Number(prod.wa_clicks_count || 0).toLocaleString('id-ID')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Klik WA</div>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '70px' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f59e0b' }}>
                        {itemCtr}%
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Konversi</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
