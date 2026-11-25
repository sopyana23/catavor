import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Eye,
  Info,
  Layers,
  Megaphone,
  Minus,
  MousePointerClick,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Store,
  TrendingUp,
  Upload,
} from 'lucide-react';
import {
  formatRupiah,
  getAuthHeaders,
  resolveActiveStoreSlugFromEnv,
} from './adsenseRuntime';

export interface MerchantAdsProductItem {
  id: number;
  name: string;
  price?: number;
  product_type?: string;
  is_active?: boolean;
}

export interface MerchantAdsViewProps {
  token?: string | null;
  storeSlug?: string | null;
  products?: MerchantAdsProductItem[];
  isDark?: boolean;
  device?: 'desktop' | 'tablet' | 'mobile';
  compact?: boolean;
  settings?: Record<string, any>;
  onToast?: (msg: string, type?: 'success' | 'error') => void;
}

interface AdSlotOption {
  id: number;
  slot_code: string;
  name: string;
  description: string;
  target_entity: string;
  allowed_product_types: string;
  default_rate_per_day: number;
  min_duration_days: number;
}

interface MerchantOrder {
  id: number;
  order_number: string;
  duration_days: number;
  final_amount: number;
  unique_code: number;
  payment_method: string;
  payment_status: string;
  payment_proof_url?: string;
  rejection_reason?: string;
}

interface MerchantCampaign {
  id: number;
  campaign_code: string;
  campaign_name: string;
  target_type: string;
  status: string;
  budget_amount: number;
  start_at?: string;
  end_at?: string;
  rejection_reason?: string;
  ad_slot?: { id: number; slot_code: string; name: string };
  target_product?: { id: number; name: string };
  orders?: MerchantOrder[];
}

interface DailyMetric {
  date: string;
  impressions_count: number;
  clicks_count: number;
  wa_clicks_count: number;
  ctr_percentage: number;
}

type CampaignFilter = 'all' | 'active' | 'pending' | 'closed';

function getCampaignStatusMeta(status?: string): {
  label: string;
  bg: string;
  color: string;
  border: string;
  group: CampaignFilter;
} {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'active') {
    return {
      label: 'Aktif Tayang',
      bg: 'rgba(16, 185, 129, 0.14)',
      color: '#059669',
      border: 'rgba(16, 185, 129, 0.35)',
      group: 'active',
    };
  }
  if (s === 'pending_payment') {
    return {
      label: 'Menunggu Pembayaran',
      bg: 'rgba(37, 99, 235, 0.12)',
      color: '#2563eb',
      border: 'rgba(37, 99, 235, 0.3)',
      group: 'pending',
    };
  }
  if (s === 'in_review' || s === 'pending_verification') {
    return {
      label: 'Dalam Verifikasi',
      bg: 'rgba(217, 119, 6, 0.14)',
      color: '#d97706',
      border: 'rgba(217, 119, 6, 0.35)',
      group: 'pending',
    };
  }
  if (s === 'paused') {
    return {
      label: 'Dijeda',
      bg: 'rgba(100, 116, 139, 0.14)',
      color: '#64748b',
      border: 'rgba(100, 116, 139, 0.3)',
      group: 'closed',
    };
  }
  if (s === 'completed') {
    return {
      label: 'Selesai',
      bg: 'rgba(14, 165, 233, 0.14)',
      color: '#0284c7',
      border: 'rgba(14, 165, 233, 0.3)',
      group: 'closed',
    };
  }
  if (s === 'rejected') {
    return {
      label: 'Ditolak',
      bg: 'rgba(220, 38, 38, 0.12)',
      color: '#dc2626',
      border: 'rgba(220, 38, 38, 0.3)',
      group: 'closed',
    };
  }
  if (s === 'cancelled') {
    return {
      label: 'Dibatalkan',
      bg: 'rgba(100, 116, 139, 0.14)',
      color: '#64748b',
      border: 'rgba(100, 116, 139, 0.3)',
      group: 'closed',
    };
  }
  return {
    label: status || 'Draft',
    bg: 'rgba(148, 163, 184, 0.16)',
    color: '#64748b',
    border: 'rgba(148, 163, 184, 0.3)',
    group: 'pending',
  };
}

function getOrderStatusLabel(status?: string): string {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'pending') return 'Belum Dibayar';
  if (s === 'pending_verification') return 'Menunggu Verifikasi Admin';
  if (s === 'paid') return 'Lunas';
  if (s === 'rejected') return 'Bukti Ditolak';
  if (s === 'expired') return 'Kedaluwarsa';
  if (s === 'refunded') return 'Dikembalikan';
  return status || 'Menunggu';
}

function formatDateShort(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const MerchantAdsView: React.FC<MerchantAdsViewProps> = ({
  token,
  storeSlug,
  products = [],
  isDark = false,
  device = 'desktop',
  compact = false,
  settings,
  onToast,
}) => {
  const effectiveSlug = storeSlug || resolveActiveStoreSlugFromEnv();
  const [slots, setSlots] = useState<AdSlotOption[]>([]);
  const [campaigns, setCampaigns] = useState<MerchantCampaign[]>([]);
  const [fetchedProducts, setFetchedProducts] = useState<MerchantAdsProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showSlotCatalog, setShowSlotCatalog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<CampaignFilter>('all');

  // Create form state
  const [selectedSlotCode, setSelectedSlotCode] = useState<string>('');
  const [targetType, setTargetType] = useState<'store' | 'product'>('store');
  const [targetProductId, setTargetProductId] = useState<number>(0);
  const [productSearch, setProductSearch] = useState<string>('');
  const [campaignName, setCampaignName] = useState<string>('');
  const [durationDays, setDurationDays] = useState<number>(3);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'qris'>('bank_transfer');

  // Proof upload state
  const [uploadingOrderId, setUploadingOrderId] = useState<number | null>(null);
  const [senderName, setSenderName] = useState<string>('');
  const [senderBank, setSenderBank] = useState<string>('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [activeUploadOrderId, setActiveUploadOrderId] = useState<number | null>(null);
  const [copiedAmountOrderId, setCopiedAmountOrderId] = useState<number | null>(null);

  // Analytics & Proof preview state
  const [analyticsCampId, setAnalyticsCampId] = useState<number | null>(null);
  const [analyticsData, setAnalyticsData] = useState<DailyMetric[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string>('');

  const notify = useCallback(
    (text: string, type: 'success' | 'error' = 'success') => {
      setBanner({ type, text });
      if (onToast) onToast(text, type);
    },
    [onToast]
  );

  const loadAdsData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders(token, effectiveSlug);
      const [slotsRes, campsRes] = await Promise.all([
        fetch('/api/ads/slots', { credentials: 'include', headers }),
        fetch('/api/ads/campaigns', { credentials: 'include', headers }),
      ]);
      if (slotsRes.ok) {
        const sJson = await slotsRes.json();
        const list: AdSlotOption[] = Array.isArray(sJson?.data) ? sJson.data : [];
        setSlots(list);
        if (list.length > 0 && !selectedSlotCode) {
          setSelectedSlotCode(list[0].slot_code);
          setDurationDays(Math.max(1, list[0].min_duration_days || 1));
          setTargetType(list[0].target_entity === 'product' ? 'product' : 'store');
        }
      }
      if (campsRes.ok) {
        const cJson = await campsRes.json();
        setCampaigns(Array.isArray(cJson?.data) ? cJson.data : []);
      }
      if (!products || products.length === 0) {
        const prodRes = await fetch('/api/products?limit=100', { credentials: 'include', headers });
        if (prodRes.ok) {
          const pJson = await prodRes.json();
          const pList = Array.isArray(pJson?.data) ? pJson.data : Array.isArray(pJson) ? pJson : [];
          setFetchedProducts(pList);
        }
      }
    } catch {
      // silent load fallback
    } finally {
      setLoading(false);
    }
  }, [token, effectiveSlug, selectedSlotCode, products]);

  useEffect(() => {
    loadAdsData();
  }, [loadAdsData]);

  useEffect(() => {
    return () => {
      if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
    };
  }, [proofPreviewUrl]);

  const activeProducts = useMemo(() => {
    const source = products && products.length > 0 ? products : fetchedProducts;
    return source.filter((p) => p.is_active !== false);
  }, [products, fetchedProducts]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return activeProducts;
    return activeProducts.filter((p) => String(p.name || '').toLowerCase().includes(q));
  }, [activeProducts, productSearch]);

  const currentSlot = slots.find((s) => s.slot_code === selectedSlotCode) || slots[0];
  const minSlotDays = Math.max(1, currentSlot?.min_duration_days || 1);
  const estimatedCost = currentSlot ? Math.round((currentSlot.default_rate_per_day || 0) * Math.max(minSlotDays, durationDays)) : 0;

  const kpiStats = useMemo(() => {
    let activeCount = 0;
    let pendingCount = 0;
    let totalBudget = 0;
    for (const camp of campaigns) {
      const meta = getCampaignStatusMeta(camp.status);
      if (meta.group === 'active') activeCount += 1;
      if (meta.group === 'pending') pendingCount += 1;
      if (camp.status !== 'cancelled' && camp.status !== 'rejected') {
        totalBudget += Number(camp.budget_amount || 0);
      }
    }
    return { activeCount, pendingCount, totalBudget, slotCount: slots.length };
  }, [campaigns, slots.length]);

  const filteredCampaigns = useMemo(() => {
    if (statusFilter === 'all') return campaigns;
    return campaigns.filter((c) => getCampaignStatusMeta(c.status).group === statusFilter);
  }, [campaigns, statusFilter]);

  const handleSelectSlotForForm = (slot: AdSlotOption) => {
    setSelectedSlotCode(slot.slot_code);
    setDurationDays((prev) => Math.max(slot.min_duration_days || 1, prev || 3));
    if (slot.target_entity === 'store') {
      setTargetType('store');
    } else if (slot.target_entity === 'product') {
      setTargetType('product');
    }
    setShowCreateForm(true);
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSlot) return;
    if (!campaignName.trim()) {
      notify('Nama kampanye promosi wajib diisi.', 'error');
      return;
    }
    if (targetType === 'product' && !targetProductId) {
      notify('Pilih produk katalog yang ingin dipromosikan.', 'error');
      return;
    }

    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch('/api/ads/campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeaders(token, effectiveSlug),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slot_code: currentSlot.slot_code,
          target_type: targetType,
          target_product_id: targetType === 'product' ? targetProductId : null,
          campaign_name: campaignName.trim(),
          duration_days: Math.max(minSlotDays, Number(durationDays) || minSlotDays),
          payment_method: paymentMethod,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        notify(json?.message || 'Gagal mengajukan kampanye iklan.', 'error');
        return;
      }
      notify(json.message || 'Kampanye berhasil dibuat. Silakan unggah bukti pembayaran.', 'success');
      setCampaignName('');
      setShowCreateForm(false);
      setStatusFilter('all');
      await loadAdsData();
    } catch {
      notify('Gagal menghubungi server saat membuat kampanye.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadProof = async (orderId: number) => {
    if (!proofFile) {
      notify('Pilih berkas gambar bukti transfer terlebih dahulu.', 'error');
      return;
    }
    setUploadingOrderId(orderId);
    try {
      const form = new FormData();
      form.append('proof', proofFile);
      if (senderName.trim()) form.append('sender_name', senderName.trim());
      if (senderBank.trim()) form.append('sender_bank', senderBank.trim());

      const res = await fetch(`/api/ads/orders/${orderId}/proof`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(token, effectiveSlug),
        body: form,
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        notify(json?.message || 'Gagal mengunggah bukti pembayaran.', 'error');
        return;
      }
      notify(json.message || 'Bukti pembayaran berhasil diunggah.', 'success');
      setProofFile(null);
      setSenderName('');
      setSenderBank('');
      setActiveUploadOrderId(null);
      await loadAdsData();
    } catch {
      notify('Gagal mengunggah bukti pembayaran iklan.', 'error');
    } finally {
      setUploadingOrderId(null);
    }
  };

  const handleToggleAnalytics = async (campId: number) => {
    if (analyticsCampId === campId) {
      setAnalyticsCampId(null);
      return;
    }
    setAnalyticsCampId(campId);
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`/api/ads/campaigns/${campId}/analytics`, {
        credentials: 'include',
        headers: getAuthHeaders(token, effectiveSlug),
      });
      const json = await res.json();
      const rows: DailyMetric[] = Array.isArray(json?.daily_metrics)
        ? json.daily_metrics
        : Array.isArray(json?.metrics)
          ? json.metrics
          : Array.isArray(json?.data)
            ? json.data
            : [];
      setAnalyticsData(rows);
    } catch {
      setAnalyticsData([]);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handlePreviewMyProof = async (orderId: number) => {
    if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
    try {
      const res = await fetch(`/api/ads/orders/${orderId}/proof`, {
        credentials: 'include',
        headers: getAuthHeaders(token, effectiveSlug),
      });
      if (!res.ok) {
        notify('Bukti pembayaran belum dapat ditampilkan.', 'error');
        return;
      }
      const blob = await res.blob();
      setProofPreviewUrl(URL.createObjectURL(blob));
    } catch {
      notify('Gagal memuat pratinjau bukti pembayaran.', 'error');
    }
  };

  const copyNominal = (orderId: number, amount: number) => {
    try {
      navigator.clipboard.writeText(String(Math.round(amount)));
      setCopiedAmountOrderId(orderId);
      setTimeout(() => setCopiedAmountOrderId(null), 2000);
      notify('Nominal transfer disalin ke clipboard.', 'success');
    } catch {
      // ignore clipboard restriction
    }
  };

  // Theme tokens: explicitly calibrated so light mode buttons never inherit dark surfaces
  const surface = `var(--bg-card, ${isDark ? '#0f172a' : '#ffffff'})`;
  const surfaceSubtle = `var(--bg-deep, ${isDark ? '#1e293b' : '#f8fafc'})`;
  const border = `var(--border-light, ${isDark ? 'rgba(148, 163, 184, 0.22)' : '#e2e8f0'})`;
  const textPrimary = `var(--text-primary, ${isDark ? '#f8fafc' : '#0f172a'})`;
  const textSecondary = `var(--text-secondary, ${isDark ? '#cbd5e1' : '#475569'})`;
  const textMuted = `var(--text-muted, ${isDark ? '#94a3b8' : '#64748b'})`;
  const primaryBrand = 'var(--primary, #1e3a8a)';
  const isStacked = device === 'mobile' || compact;
  const btnH = device === 'desktop' ? '38px' : '44px';

  const bankInfoLabel = settings?.payment_bank_name
    ? `${settings.payment_bank_name}${settings.payment_bank_account ? ` • ${settings.payment_bank_account}` : ''}`
    : 'Transfer Bank / QRIS Resmi Catavor';

  return (
    <section
      data-testid="merchant-ads-view"
      style={{
        padding: device === 'mobile' ? '0.95rem' : '1.4rem',
        borderRadius: '1rem',
        backgroundColor: surface,
        border: `1px solid ${border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '1.1rem',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isStacked ? 'flex-start' : 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: '1 1 280px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.75rem',
              backgroundColor: isDark ? 'rgba(37, 99, 235, 0.18)' : '#eff6ff',
              border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.35)' : '#bfdbfe'}`,
              color: isDark ? '#60a5fa' : '#1d4ed8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Megaphone size={19} strokeWidth={1.75} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: device === 'mobile' ? '1.05rem' : '1.15rem', fontWeight: 800, color: textPrimary }}>
                Promosi &amp; Iklan Etalase
              </h2>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.55rem',
                  borderRadius: '999px',
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ecfdf5',
                  color: '#059669',
                  border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0'}`,
                }}
              >
                Tersedia Untuk Semua Paket
              </span>
            </div>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: textSecondary, lineHeight: 1.45 }}>
              Tingkatkan eksposur toko maupun produk unggulan di halaman utama Catavor. Penagihan iklan terpisah dari paket langganan bulanan.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', alignSelf: isStacked ? 'flex-start' : 'center', width: device === 'mobile' ? '100%' : 'auto' }}>
          <button
            type="button"
            onClick={() => loadAdsData()}
            disabled={loading}
            style={{
              minHeight: btnH,
              padding: '0.45rem 0.85rem',
              borderRadius: '0.6rem',
              border: `1px solid ${border}`,
              backgroundColor: surfaceSubtle,
              color: textPrimary,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              flex: device === 'mobile' ? '1 1 auto' : '0 0 auto',
            }}
          >
            <RefreshCw size={14} strokeWidth={1.75} />
            <span>Segarkan</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            style={{
              minHeight: btnH,
              padding: '0.45rem 1rem',
              borderRadius: '0.6rem',
              border: 'none',
              backgroundColor: primaryBrand,
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              flex: device === 'mobile' ? '1 1 auto' : '0 0 auto',
            }}
          >
            <Plus size={15} strokeWidth={2} />
            <span>{showCreateForm ? 'Tutup Formulir' : 'Buat Kampanye Iklan'}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div
        data-testid="ads-kpi-strip"
        style={{
          display: 'grid',
          gridTemplateColumns: device === 'desktop' ? 'repeat(4, minmax(0, 1fr))' : isStacked ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
          gap: '0.7rem',
        }}
      >
        {[
          {
            label: 'Kampanye Aktif',
            value: String(kpiStats.activeCount),
            hint: 'Sedang tayang di beranda',
            icon: <Activity size={15} strokeWidth={1.75} />,
            accent: '#059669',
            accentBg: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ecfdf5',
          },
          {
            label: 'Menunggu Proses',
            value: String(kpiStats.pendingCount),
            hint: 'Tagihan atau verifikasi',
            icon: <Clock size={15} strokeWidth={1.75} />,
            accent: '#d97706',
            accentBg: isDark ? 'rgba(217, 119, 6, 0.14)' : '#fffbeb',
          },
          {
            label: 'Total Anggaran',
            value: formatRupiah(kpiStats.totalBudget),
            hint: 'Akumulasi kampanye aktif/lunas',
            icon: <CreditCard size={15} strokeWidth={1.75} />,
            accent: isDark ? '#60a5fa' : '#1d4ed8',
            accentBg: isDark ? 'rgba(37, 99, 235, 0.16)' : '#eff6ff',
          },
          {
            label: 'Slot Etalase',
            value: `${kpiStats.slotCount} Slot`,
            hint: 'Penempatan tersedia saat ini',
            icon: <Layers size={15} strokeWidth={1.75} />,
            accent: '#7c3aed',
            accentBg: isDark ? 'rgba(124, 58, 237, 0.16)' : '#f5f3ff',
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              padding: '0.8rem 0.9rem',
              borderRadius: '0.8rem',
              backgroundColor: surfaceSubtle,
              border: `1px solid ${border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: textSecondary }}>{kpi.label}</span>
              <span
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '0.5rem',
                  backgroundColor: kpi.accentBg,
                  color: kpi.accent,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {kpi.icon}
              </span>
            </div>
            <div style={{ fontSize: device === 'mobile' ? '1.02rem' : '1.12rem', fontWeight: 800, color: textPrimary, lineHeight: 1.2 }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: '0.68rem', color: textMuted }}>{kpi.hint}</div>
          </div>
        ))}
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          style={{
            padding: '0.75rem 0.95rem',
            borderRadius: '0.75rem',
            backgroundColor: banner.type === 'error'
              ? (isDark ? 'rgba(220, 38, 38, 0.14)' : '#fef2f2')
              : (isDark ? 'rgba(16, 185, 129, 0.14)' : '#ecfdf5'),
            border: `1px solid ${banner.type === 'error'
              ? (isDark ? 'rgba(248, 113, 113, 0.35)' : '#fecaca')
              : (isDark ? 'rgba(52, 211, 153, 0.35)' : '#a7f3d0')}`,
            color: banner.type === 'error' ? (isDark ? '#fca5a5' : '#b91c1c') : (isDark ? '#6ee7b7' : '#047857'),
            fontSize: '0.78rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {banner.type === 'error' ? <ShieldAlert size={15} /> : <CheckCircle2 size={15} />}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Campaign Creation Form (Zero native <select>) */}
      {showCreateForm && (
        <form
          data-testid="ads-create-form"
          onSubmit={handleCreateCampaign}
          style={{
            padding: device === 'mobile' ? '0.9rem' : '1.15rem',
            borderRadius: '0.9rem',
            backgroundColor: surfaceSubtle,
            border: `1px solid ${border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: textPrimary }}>
                Ajukan Kampanye Promosi Baru
              </h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.74rem', color: textSecondary }}>
                Pilih slot beranda, tentukan target dan durasi tayang, lalu selesaikan invoice manual.
              </p>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: textSecondary }}>
              {slots.length} slot tersedia
            </span>
          </div>

          {/* 1. Slot Selector Cards */}
          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.45rem' }}>
              1. Pilih Slot Penempatan Beranda
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: device === 'desktop' ? 'repeat(3, minmax(0, 1fr))' : isStacked ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                gap: '0.55rem',
              }}
            >
              {slots.map((s) => {
                const selected = currentSlot?.slot_code === s.slot_code;
                const isStoreTarget = s.target_entity === 'store';
                return (
                  <button
                    key={s.slot_code}
                    type="button"
                    onClick={() => handleSelectSlotForForm(s)}
                    style={{
                      textAlign: 'left',
                      padding: '0.7rem 0.8rem',
                      borderRadius: '0.7rem',
                      border: selected ? `2px solid ${primaryBrand}` : `1px solid ${border}`,
                      backgroundColor: selected
                        ? (isDark ? 'rgba(37, 99, 235, 0.14)' : '#eff6ff')
                        : surface,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.3rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem' }}>
                      <strong style={{ fontSize: '0.78rem', color: textPrimary, lineHeight: 1.3 }}>{s.name}</strong>
                      {selected && <CheckCircle2 size={15} style={{ color: isDark ? '#60a5fa' : '#1d4ed8', flexShrink: 0 }} />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.45rem',
                          borderRadius: '999px',
                          backgroundColor: isStoreTarget ? 'rgba(37, 99, 235, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          color: isStoreTarget ? '#2563eb' : '#059669',
                        }}
                      >
                        {isStoreTarget ? 'Profil Toko' : 'Produk Katalog'}
                      </span>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: textPrimary }}>
                        {formatRupiah(s.default_rate_per_day)}/hari
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Campaign Name + Target Type + Payment Method */}
          <div style={{ display: 'grid', gridTemplateColumns: isStacked ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.35rem' }}>
                2. Judul Kampanye Promosi
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Promo Koleksi Akhir Pekan"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: btnH,
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.6rem',
                  border: `1px solid ${border}`,
                  backgroundColor: surface,
                  color: textPrimary,
                  fontSize: '0.8rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.35rem' }}>
                3. Durasi Tayang (Min {minSlotDays} Hari)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  aria-label="Kurangi durasi"
                  onClick={() => setDurationDays((d) => Math.max(minSlotDays, d - 1))}
                  style={{
                    minHeight: btnH,
                    minWidth: btnH,
                    borderRadius: '0.6rem',
                    border: `1px solid ${border}`,
                    backgroundColor: surface,
                    color: textPrimary,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  min={minSlotDays}
                  max={90}
                  value={durationDays}
                  onChange={(e) => setDurationDays(Math.max(minSlotDays, Math.min(90, Number(e.target.value) || minSlotDays)))}
                  style={{
                    width: '74px',
                    minHeight: btnH,
                    padding: '0.45rem 0.55rem',
                    borderRadius: '0.6rem',
                    border: `1px solid ${border}`,
                    backgroundColor: surface,
                    color: textPrimary,
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  aria-label="Tambah durasi"
                  onClick={() => setDurationDays((d) => Math.min(90, d + 1))}
                  style={{
                    minHeight: btnH,
                    minWidth: btnH,
                    borderRadius: '0.6rem',
                    border: `1px solid ${border}`,
                    backgroundColor: surface,
                    color: textPrimary,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Plus size={14} />
                </button>
                {[3, 7, 14, 30].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDurationDays(Math.max(minSlotDays, preset))}
                    style={{
                      minHeight: btnH,
                      padding: '0.35rem 0.65rem',
                      borderRadius: '0.6rem',
                      border: durationDays === preset ? `1px solid ${primaryBrand}` : `1px solid ${border}`,
                      backgroundColor: durationDays === preset ? primaryBrand : surface,
                      color: durationDays === preset ? '#ffffff' : textSecondary,
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {preset} Hari
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isStacked ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.35rem' }}>
                Tipe Target Promosi
              </label>
              <div style={{ display: 'flex', gap: '0.45rem' }}>
                {(['store', 'product'] as const).map((tp) => {
                  const lockedBySlot =
                    (currentSlot?.target_entity === 'store' && tp !== 'store') ||
                    (currentSlot?.target_entity === 'product' && tp !== 'product');
                  const active = targetType === tp;
                  return (
                    <button
                      key={tp}
                      type="button"
                      disabled={lockedBySlot}
                      onClick={() => setTargetType(tp)}
                      style={{
                        flex: 1,
                        minHeight: btnH,
                        padding: '0.45rem 0.7rem',
                        borderRadius: '0.6rem',
                        border: active ? `1.5px solid ${primaryBrand}` : `1px solid ${border}`,
                        backgroundColor: active ? (isDark ? 'rgba(37, 99, 235, 0.16)' : '#eff6ff') : surface,
                        color: lockedBySlot ? textMuted : textPrimary,
                        opacity: lockedBySlot ? 0.55 : 1,
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: lockedBySlot ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      {tp === 'store' ? <Store size={14} /> : <Package size={14} />}
                      <span>{tp === 'store' ? 'Profil Katalog Toko' : 'Produk Spesifik'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.35rem' }}>
                Metode Pembayaran Invoice
              </label>
              <div style={{ display: 'flex', gap: '0.45rem' }}>
                {([
                  { id: 'bank_transfer' as const, label: 'Transfer Bank' },
                  { id: 'qris' as const, label: 'QRIS Manual' },
                ]).map((pm) => {
                  const active = paymentMethod === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      style={{
                        flex: 1,
                        minHeight: btnH,
                        padding: '0.45rem 0.7rem',
                        borderRadius: '0.6rem',
                        border: active ? `1.5px solid ${primaryBrand}` : `1px solid ${border}`,
                        backgroundColor: active ? (isDark ? 'rgba(37, 99, 235, 0.16)' : '#eff6ff') : surface,
                        color: textPrimary,
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <CreditCard size={14} />
                      <span>{pm.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Touch-friendly Product Picker when targetType === 'product' */}
          {targetType === 'product' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: textSecondary }}>
                Pilih Produk yang Diiklankan
              </label>
              {activeProducts.length === 0 ? (
                <div
                  style={{
                    padding: '0.75rem 0.9rem',
                    borderRadius: '0.65rem',
                    border: `1px solid ${border}`,
                    backgroundColor: surface,
                    fontSize: '0.76rem',
                    color: textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                  }}
                >
                  <Info size={15} style={{ color: '#d97706', flexShrink: 0 }} />
                  <span>Toko Anda belum memiliki produk aktif. Tambahkan item di menu Daftar Item atau pilih slot khusus Profil Toko.</span>
                </div>
              ) : (
                <>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: textMuted }} />
                    <input
                      type="text"
                      placeholder="Cari nama produk katalog..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: btnH,
                        padding: '0.45rem 0.75rem 0.45rem 2.15rem',
                        borderRadius: '0.6rem',
                        border: `1px solid ${border}`,
                        backgroundColor: surface,
                        color: textPrimary,
                        fontSize: '0.78rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      maxHeight: '190px',
                      overflowY: 'auto',
                      display: 'grid',
                      gridTemplateColumns: isStacked ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                      gap: '0.45rem',
                      paddingRight: '0.15rem',
                    }}
                  >
                    {filteredProducts.map((p) => {
                      const picked = Number(targetProductId) === Number(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setTargetProductId(Number(p.id))}
                          style={{
                            minHeight: '42px',
                            padding: '0.45rem 0.7rem',
                            borderRadius: '0.6rem',
                            border: picked ? `1.5px solid ${primaryBrand}` : `1px solid ${border}`,
                            backgroundColor: picked ? (isDark ? 'rgba(37, 99, 235, 0.16)' : '#eff6ff') : surface,
                            color: textPrimary,
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.45rem',
                          }}
                        >
                          <span style={{ fontSize: '0.76rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: textSecondary, flexShrink: 0 }}>
                            {p.price ? formatRupiah(p.price) : 'Terpilih'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Cost Summary + Submit */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: isStacked ? 'stretch' : 'center',
              flexDirection: isStacked ? 'column' : 'row',
              gap: '0.75rem',
              paddingTop: '0.6rem',
              borderTop: `1px solid ${border}`,
            }}
          >
            <div>
              <div style={{ fontSize: '0.74rem', color: textSecondary }}>
                Estimasi Biaya Sewa ({currentSlot ? `${formatRupiah(currentSlot.default_rate_per_day)}/hari x ${durationDays} hari` : '-'}):{' '}
                <strong style={{ color: textPrimary, fontSize: '0.98rem', marginLeft: '0.2rem' }}>{formatRupiah(estimatedCost)}</strong>
              </div>
              <div style={{ fontSize: '0.69rem', color: textMuted, marginTop: '0.15rem' }}>
                Pembayaran melalui {bankInfoLabel} (kode unik otomatis ditambahkan pada faktur).
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting || (targetType === 'product' && activeProducts.length === 0)}
              style={{
                minHeight: btnH,
                padding: '0.55rem 1.25rem',
                borderRadius: '0.65rem',
                border: 'none',
                backgroundColor: primaryBrand,
                color: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: submitting ? 'wait' : 'pointer',
                opacity: submitting || (targetType === 'product' && activeProducts.length === 0) ? 0.6 : 1,
              }}
            >
              {submitting ? 'Memproses...' : 'Ajukan & Buat Invoice Iklan'}
            </button>
          </div>
        </form>
      )}

      {/* Main Content Area: Skeleton / Empty State / Populated Campaigns */}
      {loading && campaigns.length === 0 ? (
        <div
          data-testid="ads-loading-state"
          style={{
            padding: '1.5rem',
            borderRadius: '0.85rem',
            backgroundColor: surfaceSubtle,
            border: `1px solid ${border}`,
            fontSize: '0.8rem',
            color: textSecondary,
            textAlign: 'center',
          }}
        >
          Memuat daftar slot iklan dan kampanye promosi toko...
        </div>
      ) : campaigns.length === 0 ? (
        <div data-testid="ads-empty-state" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Onboarding Hero Card */}
          <div
            style={{
              padding: device === 'mobile' ? '1rem' : '1.25rem',
              borderRadius: '0.9rem',
              backgroundColor: surfaceSubtle,
              border: `1px solid ${border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.9rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isStacked ? 'flex-start' : 'center', flexDirection: isStacked ? 'column' : 'row', gap: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: textPrimary }}>
                  Mulai Promosi Terukur di Halaman Utama Catavor
                </h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: textSecondary, lineHeight: 1.5 }}>
                  Toko Anda belum memiliki kampanye aktif. Pilih penempatan etalase di bawah untuk menarik lebih banyak pengunjung tertarget ke katalog Anda.
                </p>
              </div>
              {!showCreateForm && (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  style={{
                    minHeight: btnH,
                    padding: '0.5rem 1.05rem',
                    borderRadius: '0.65rem',
                    border: 'none',
                    backgroundColor: primaryBrand,
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    flexShrink: 0,
                  }}
                >
                  <Sparkles size={15} />
                  <span>Buat Kampanye Pertama</span>
                </button>
              )}
            </div>

            {/* 3-Step Workflow Strip */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: device === 'mobile' ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                gap: '0.6rem',
              }}
            >
              {[
                { step: '1', title: 'Pilih Slot & Durasi', desc: 'Tentukan slot beranda toko/produk serta lama tayang harian.' },
                { step: '2', title: 'Unggah Bukti Bayar', desc: 'Selesaikan faktur dengan kode unik agar cepat diverifikasi finance.' },
                { step: '3', title: 'Tayang & Pantau Metrik', desc: 'Lihat impresi, klik katalog, klik WhatsApp, dan CTR harian.' },
              ].map((item) => (
                <div
                  key={item.step}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.75rem',
                    backgroundColor: surface,
                    border: `1px solid ${border}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                  }}
                >
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '999px',
                      backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#dbeafe',
                      color: isDark ? '#60a5fa' : '#1d4ed8',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {item.step}
                  </span>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: textPrimary }}>{item.title}</div>
                    <div style={{ fontSize: '0.71rem', color: textSecondary, lineHeight: 1.4, marginTop: '0.15rem' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Slot Catalog Grid */}
          {slots.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.86rem', fontWeight: 800, color: textPrimary }}>
                  Katalog Slot Etalase Tersedia ({slots.length})
                </h4>
                <span style={{ fontSize: '0.72rem', color: textMuted }}>Tarif transparan per hari</span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: device === 'desktop' ? 'repeat(3, minmax(0, 1fr))' : isStacked ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                  gap: '0.75rem',
                }}
              >
                {slots.map((slot) => {
                  const isStoreTarget = slot.target_entity === 'store';
                  return (
                    <div
                      key={slot.id || slot.slot_code}
                      style={{
                        padding: '0.9rem',
                        borderRadius: '0.8rem',
                        backgroundColor: surfaceSubtle,
                        border: `1px solid ${border}`,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                          <span
                            style={{
                              fontSize: '0.66rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '999px',
                              backgroundColor: isStoreTarget ? 'rgba(37, 99, 235, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                              color: isStoreTarget ? '#2563eb' : '#059669',
                            }}
                          >
                            {isStoreTarget ? 'Profil Toko' : 'Produk Katalog'}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: textMuted }}>Min. {slot.min_duration_days || 1} hari</span>
                        </div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 800, color: textPrimary }}>{slot.name}</div>
                        <div style={{ fontSize: '0.73rem', color: textSecondary, lineHeight: 1.45 }}>
                          {slot.description || 'Penempatan strategis di etalase utama Catavor.'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', paddingTop: '0.55rem', borderTop: `1px solid ${border}` }}>
                        <div>
                          <div style={{ fontSize: '0.66rem', color: textMuted }}>Tarif Mulai</div>
                          <div style={{ fontSize: '0.86rem', fontWeight: 800, color: textPrimary }}>
                            {formatRupiah(slot.default_rate_per_day)}
                            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: textMuted }}>/hari</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectSlotForForm(slot)}
                          style={{
                            minHeight: btnH,
                            padding: '0.4rem 0.85rem',
                            borderRadius: '0.55rem',
                            border: `1px solid ${primaryBrand}`,
                            backgroundColor: surface,
                            color: isDark ? '#93c5fd' : primaryBrand,
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Pilih Slot Ini
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div data-testid="ads-campaigns-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Filter Tabs + Slot Catalog Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {([
                { id: 'all' as const, label: `Semua (${campaigns.length})` },
                { id: 'active' as const, label: `Aktif Tayang (${kpiStats.activeCount})` },
                { id: 'pending' as const, label: `Menunggu Proses (${kpiStats.pendingCount})` },
                {
                  id: 'closed' as const,
                  label: `Selesai / Lainnya (${campaigns.length - kpiStats.activeCount - kpiStats.pendingCount})`,
                },
              ]).map((tab) => {
                const active = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    style={{
                      minHeight: device === 'desktop' ? '34px' : '40px',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '999px',
                      border: active ? `1px solid ${primaryBrand}` : `1px solid ${border}`,
                      backgroundColor: active ? primaryBrand : surfaceSubtle,
                      color: active ? '#ffffff' : textSecondary,
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {slots.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSlotCatalog((prev) => !prev)}
                style={{
                  minHeight: device === 'desktop' ? '34px' : '40px',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '0.55rem',
                  border: `1px solid ${border}`,
                  backgroundColor: surfaceSubtle,
                  color: textPrimary,
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Layers size={13} />
                <span>{showSlotCatalog ? 'Tutup Katalog Slot' : `Lihat Katalog Slot (${slots.length})`}</span>
              </button>
            )}
          </div>

          {showSlotCatalog && slots.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: device === 'desktop' ? 'repeat(3, minmax(0, 1fr))' : isStacked ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                gap: '0.65rem',
                padding: '0.85rem',
                borderRadius: '0.85rem',
                backgroundColor: surfaceSubtle,
                border: `1px solid ${border}`,
              }}
            >
              {slots.map((slot) => (
                <div
                  key={slot.slot_code}
                  style={{
                    padding: '0.7rem 0.8rem',
                    borderRadius: '0.65rem',
                    backgroundColor: surface,
                    border: `1px solid ${border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.77rem', fontWeight: 800, color: textPrimary }}>{slot.name}</div>
                    <div style={{ fontSize: '0.7rem', color: textSecondary }}>
                      {formatRupiah(slot.default_rate_per_day)}/hari · Min {slot.min_duration_days} hari
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectSlotForForm(slot)}
                    style={{
                      minHeight: '34px',
                      padding: '0.3rem 0.6rem',
                      borderRadius: '0.5rem',
                      border: `1px solid ${primaryBrand}`,
                      backgroundColor: 'transparent',
                      color: isDark ? '#93c5fd' : primaryBrand,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Pakai
                  </button>
                </div>
              ))}
            </div>
          )}

          {filteredCampaigns.length === 0 ? (
            <div
              style={{
                padding: '1.25rem',
                borderRadius: '0.8rem',
                backgroundColor: surfaceSubtle,
                border: `1px solid ${border}`,
                fontSize: '0.78rem',
                color: textSecondary,
                textAlign: 'center',
              }}
            >
              Tidak ada kampanye promosi pada filter status ini.
            </div>
          ) : (
            filteredCampaigns.map((camp) => {
              const latestOrder = Array.isArray(camp.orders) && camp.orders.length > 0 ? camp.orders[0] : undefined;
              const canUpload = Boolean(latestOrder && (latestOrder.payment_status === 'pending' || latestOrder.payment_status === 'rejected'));
              const effectiveStatus = (camp.status === 'pending_payment' && latestOrder?.payment_status === 'pending_verification')
                ? 'pending_verification'
                : camp.status;
              const statusMeta = getCampaignStatusMeta(effectiveStatus);

              // Compute analytics totals when expanded
              const metricTotals = analyticsData.reduce(
                (acc, row) => {
                  acc.impressions += Number(row.impressions_count || 0);
                  acc.clicks += Number(row.clicks_count || 0);
                  acc.wa += Number(row.wa_clicks_count || 0);
                  return acc;
                },
                { impressions: 0, clicks: 0, wa: 0 }
              );
              const avgCtr = metricTotals.impressions > 0
                ? ((metricTotals.clicks / metricTotals.impressions) * 100).toFixed(2)
                : '0.00';
              const chartRows = [...analyticsData].slice(0, 14).reverse();
              const maxImpressions = Math.max(1, ...chartRows.map((r) => Number(r.impressions_count || 0)));

              return (
                <div
                  key={camp.id}
                  data-testid={`ad-campaign-card-${camp.id}`}
                  style={{
                    padding: device === 'mobile' ? '0.9rem' : '1.05rem',
                    borderRadius: '0.85rem',
                    backgroundColor: surfaceSubtle,
                    border: `1px solid ${border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  {/* Card Top Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.65rem' }}>
                    <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.9rem', color: textPrimary }}>{camp.campaign_name}</strong>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.55rem',
                            borderRadius: '999px',
                            backgroundColor: statusMeta.bg,
                            color: statusMeta.color,
                            border: `1px solid ${statusMeta.border}`,
                          }}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.71rem', color: textMuted, marginTop: '0.15rem' }}>
                        Kode Kampanye: {camp.campaign_code}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleAnalytics(camp.id)}
                        style={{
                          minHeight: device === 'desktop' ? '36px' : '40px',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.55rem',
                          border: `1px solid ${analyticsCampId === camp.id ? primaryBrand : border}`,
                          backgroundColor: analyticsCampId === camp.id ? primaryBrand : surface,
                          color: analyticsCampId === camp.id ? '#ffffff' : textPrimary,
                          fontSize: '0.73rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <BarChart3 size={14} />
                        <span>{analyticsCampId === camp.id ? 'Tutup Metrik' : 'Metrik'}</span>
                      </button>

                      {latestOrder?.payment_proof_url && (
                        <button
                          type="button"
                          onClick={() => handlePreviewMyProof(latestOrder.id)}
                          style={{
                            minHeight: device === 'desktop' ? '36px' : '40px',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '0.55rem',
                            border: `1px solid ${border}`,
                            backgroundColor: surface,
                            color: textPrimary,
                            fontSize: '0.73rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <Eye size={14} />
                          <span>Lihat Bukti</span>
                        </button>
                      )}

                      {canUpload && latestOrder && (
                        <button
                          type="button"
                          onClick={() => setActiveUploadOrderId(activeUploadOrderId === latestOrder.id ? null : latestOrder.id)}
                          style={{
                            minHeight: device === 'desktop' ? '36px' : '40px',
                            padding: '0.35rem 0.85rem',
                            borderRadius: '0.55rem',
                            border: 'none',
                            backgroundColor: primaryBrand,
                            color: '#ffffff',
                            fontSize: '0.73rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <Upload size={14} />
                          <span>{activeUploadOrderId === latestOrder.id ? 'Batal Unggah' : 'Unggah Bukti'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4-Cell Metadata Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: device === 'mobile' ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
                      gap: '0.55rem',
                      padding: '0.65rem 0.75rem',
                      borderRadius: '0.7rem',
                      backgroundColor: surface,
                      border: `1px solid ${border}`,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.67rem', color: textMuted }}>Slot Penempatan</div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: textPrimary, marginTop: '0.1rem' }}>
                        {camp.ad_slot?.name || '-'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.67rem', color: textMuted }}>Target Promosi</div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: textPrimary, marginTop: '0.1rem' }}>
                        {camp.target_type === 'product' ? (camp.target_product?.name || 'Produk Katalog') : 'Profil Toko'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.67rem', color: textMuted }}>Periode Tayang</div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: textPrimary, marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Calendar size={12} style={{ color: textMuted, flexShrink: 0 }} />
                        <span>{formatDateShort(camp.start_at)} - {formatDateShort(camp.end_at)}</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.67rem', color: textMuted }}>Tagihan &amp; Pembayaran</div>
                      {latestOrder ? (
                        <div style={{ marginTop: '0.1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.76rem', color: textPrimary }}>{formatRupiah(latestOrder.final_amount)}</strong>
                            {latestOrder.payment_status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => copyNominal(latestOrder.id, latestOrder.final_amount)}
                                title="Salin nominal transfer"
                                style={{
                                  border: `1px solid ${border}`,
                                  backgroundColor: surfaceSubtle,
                                  color: textSecondary,
                                  borderRadius: '0.35rem',
                                  padding: '0.1rem 0.35rem',
                                  fontSize: '0.64rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                }}
                              >
                                {copiedAmountOrderId === latestOrder.id ? <Check size={10} /> : <Copy size={10} />}
                                <span>{copiedAmountOrderId === latestOrder.id ? 'Disalin' : 'Salin'}</span>
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: '0.67rem', color: textSecondary }}>
                            {latestOrder.order_number} · {getOrderStatusLabel(latestOrder.payment_status)}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: textPrimary, marginTop: '0.1rem' }}>
                          {formatRupiah(camp.budget_amount)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rejection Reason */}
                  {(camp.rejection_reason || latestOrder?.rejection_reason) && (
                    <div
                      style={{
                        padding: '0.55rem 0.75rem',
                        borderRadius: '0.6rem',
                        backgroundColor: isDark ? 'rgba(220, 38, 38, 0.14)' : '#fef2f2',
                        border: `1px solid ${isDark ? 'rgba(248, 113, 113, 0.35)' : '#fecaca'}`,
                        color: isDark ? '#fca5a5' : '#b91c1c',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                      }}
                    >
                      Catatan Admin: {camp.rejection_reason || latestOrder?.rejection_reason}
                    </div>
                  )}

                  {/* Inline Proof Upload Panel */}
                  {latestOrder && activeUploadOrderId === latestOrder.id && (
                    <div
                      style={{
                        padding: '0.85rem',
                        borderRadius: '0.7rem',
                        backgroundColor: surface,
                        border: `1px solid ${border}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                      }}
                    >
                      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: textPrimary }}>
                        Unggah Bukti Pembayaran ({latestOrder.order_number} · {formatRupiah(latestOrder.final_amount)})
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: isStacked ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '0.55rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Nama Rekening Pengirim"
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          style={{
                            minHeight: btnH,
                            padding: '0.4rem 0.65rem',
                            borderRadius: '0.55rem',
                            border: `1px solid ${border}`,
                            backgroundColor: surfaceSubtle,
                            color: textPrimary,
                            fontSize: '0.76rem',
                            boxSizing: 'border-box',
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Nama Bank / E-Wallet"
                          value={senderBank}
                          onChange={(e) => setSenderBank(e.target.value)}
                          style={{
                            minHeight: btnH,
                            padding: '0.4rem 0.65rem',
                            borderRadius: '0.55rem',
                            border: `1px solid ${border}`,
                            backgroundColor: surfaceSubtle,
                            color: textPrimary,
                            fontSize: '0.76rem',
                            boxSizing: 'border-box',
                          }}
                        />
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                          style={{ fontSize: '0.74rem', color: textSecondary }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          disabled={uploadingOrderId === latestOrder.id}
                          onClick={() => handleUploadProof(latestOrder.id)}
                          style={{
                            minHeight: btnH,
                            padding: '0.45rem 1rem',
                            borderRadius: '0.55rem',
                            border: 'none',
                            backgroundColor: '#059669',
                            color: '#ffffff',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            cursor: uploadingOrderId === latestOrder.id ? 'wait' : 'pointer',
                          }}
                        >
                          {uploadingOrderId === latestOrder.id ? 'Mengunggah...' : 'Kirim Bukti Transfer'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expanded Daily Analytics & Chart Panel */}
                  {analyticsCampId === camp.id && (
                    <div
                      data-testid={`ad-analytics-panel-${camp.id}`}
                      style={{
                        padding: '0.85rem',
                        borderRadius: '0.75rem',
                        backgroundColor: surface,
                        border: `1px solid ${border}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                      }}
                    >
                      {loadingAnalytics ? (
                        <div style={{ fontSize: '0.76rem', color: textSecondary }}>Memuat metrik performa harian...</div>
                      ) : analyticsData.length === 0 ? (
                        <div style={{ fontSize: '0.76rem', color: textSecondary, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <TrendingUp size={15} style={{ color: textMuted }} />
                          <span>Belum ada rekaman impresi atau klik harian untuk kampanye ini.</span>
                        </div>
                      ) : (
                        <>
                          {/* 4 Summary Tiles */}
                          <div style={{ display: 'grid', gridTemplateColumns: device === 'mobile' ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: '0.55rem' }}>
                            {[
                              { label: 'Total Impresi', val: metricTotals.impressions.toLocaleString('id-ID'), icon: <Eye size={13} /> },
                              { label: 'Total Klik', val: metricTotals.clicks.toLocaleString('id-ID'), icon: <MousePointerClick size={13} /> },
                              { label: 'Klik WhatsApp', val: metricTotals.wa.toLocaleString('id-ID'), icon: <Activity size={13} /> },
                              { label: 'Rata-rata CTR', val: `${avgCtr}%`, icon: <TrendingUp size={13} /> },
                            ].map((mKpi) => (
                              <div
                                key={mKpi.label}
                                style={{
                                  padding: '0.55rem 0.65rem',
                                  borderRadius: '0.6rem',
                                  backgroundColor: surfaceSubtle,
                                  border: `1px solid ${border}`,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem', color: textMuted }}>
                                  <span>{mKpi.label}</span>
                                  {mKpi.icon}
                                </div>
                                <div style={{ fontSize: '0.94rem', fontWeight: 800, color: textPrimary, marginTop: '0.15rem' }}>{mKpi.val}</div>
                              </div>
                            ))}
                          </div>

                          {/* Daily Bar Chart (Pure CSS Flex Bars) */}
                          <div style={{ padding: '0.65rem 0.75rem', borderRadius: '0.65rem', backgroundColor: surfaceSubtle, border: `1px solid ${border}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.55rem', fontSize: '0.72rem' }}>
                              <strong style={{ color: textPrimary }}>Tren Impresi &amp; Klik Harian</strong>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: textSecondary }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#3b82f6' }} />
                                  Impresi
                                </span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#10b981' }} />
                                  Klik
                                </span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', height: '96px', paddingTop: '0.4rem' }}>
                              {chartRows.map((row) => {
                                const impH = Math.max(6, Math.round((Number(row.impressions_count || 0) / maxImpressions) * 76));
                                const clkH = Number(row.clicks_count || 0) > 0
                                  ? Math.max(4, Math.round((Number(row.clicks_count || 0) / maxImpressions) * 76))
                                  : 0;
                                return (
                                  <div
                                    key={row.date}
                                    title={`${String(row.date).slice(0, 10)}: ${row.impressions_count} impresi, ${row.clicks_count} klik (${row.ctr_percentage}% CTR)`}
                                    style={{
                                      flex: 1,
                                      minWidth: 0,
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '76px' }}>
                                      <div style={{ width: device === 'mobile' ? '8px' : '12px', height: `${impH}px`, borderRadius: '3px 3px 0 0', backgroundColor: '#3b82f6' }} />
                                      {clkH > 0 && (
                                        <div style={{ width: device === 'mobile' ? '6px' : '8px', height: `${clkH}px`, borderRadius: '3px 3px 0 0', backgroundColor: '#10b981' }} />
                                      )}
                                    </div>
                                    <span style={{ fontSize: '0.62rem', color: textMuted, whiteSpace: 'nowrap' }}>
                                      {String(row.date).slice(5, 10)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Daily Breakdown Rows */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.73rem', color: textSecondary }}>
                            {analyticsData.slice(0, 7).map((m) => (
                              <div
                                key={m.date}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: '0.5rem',
                                  padding: '0.35rem 0.5rem',
                                  borderRadius: '0.45rem',
                                  backgroundColor: surfaceSubtle,
                                }}
                              >
                                <strong style={{ color: textPrimary }}>{String(m.date).slice(0, 10)}</strong>
                                <span>
                                  Impresi: <strong>{m.impressions_count}</strong> · Klik: <strong>{m.clicks_count}</strong> · WA: <strong>{m.wa_clicks_count}</strong> · CTR: <strong>{Number(m.ctr_percentage || 0).toFixed(2)}%</strong>
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Proof Lightbox */}
      {proofPreviewUrl && (
        <div
          onClick={() => setProofPreviewUrl('')}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: surface,
              borderRadius: '0.85rem',
              padding: '1rem',
              maxWidth: '460px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <img src={proofPreviewUrl} alt="Bukti Transfer Iklan" style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '0.5rem' }} />
            <button
              type="button"
              onClick={() => setProofPreviewUrl('')}
              style={{
                minHeight: '44px',
                borderRadius: '0.6rem',
                border: `1px solid ${border}`,
                backgroundColor: surfaceSubtle,
                color: textPrimary,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Tutup Pratinjau
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
