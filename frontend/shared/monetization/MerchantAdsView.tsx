import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Eye,
  Megaphone,
  Plus,
  RefreshCw,
  ShieldAlert,
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

export const MerchantAdsView: React.FC<MerchantAdsViewProps> = ({
  token,
  storeSlug,
  products = [],
  isDark = false,
  device = 'desktop',
  onToast,
}) => {
  const effectiveSlug = storeSlug || resolveActiveStoreSlugFromEnv();
  const [slots, setSlots] = useState<AdSlotOption[]>([]);
  const [campaigns, setCampaigns] = useState<MerchantCampaign[]>([]);
  const [fetchedProducts, setFetchedProducts] = useState<MerchantAdsProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create form state
  const [selectedSlotCode, setSelectedSlotCode] = useState<string>('');
  const [targetType, setTargetType] = useState<'store' | 'product'>('store');
  const [targetProductId, setTargetProductId] = useState<number>(0);
  const [campaignName, setCampaignName] = useState<string>('');
  const [durationDays, setDurationDays] = useState<number>(3);
  const [paymentMethod, setPaymentMethod] = useState<'manual_transfer' | 'qris'>('manual_transfer');

  // Proof upload state
  const [uploadingOrderId, setUploadingOrderId] = useState<number | null>(null);
  const [senderName, setSenderName] = useState<string>('');
  const [senderBank, setSenderBank] = useState<string>('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [activeUploadOrderId, setActiveUploadOrderId] = useState<number | null>(null);

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
  }, [token, effectiveSlug, selectedSlotCode]);

  useEffect(() => {
    loadAdsData();
  }, [loadAdsData]);

  useEffect(() => {
    return () => {
      if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
    };
  }, [proofPreviewUrl]);

  const currentSlot = slots.find((s) => s.slot_code === selectedSlotCode) || slots[0];
  const estimatedCost = currentSlot ? Math.round((currentSlot.default_rate_per_day || 0) * Math.max(1, durationDays)) : 0;

  const handleSlotChange = (code: string) => {
    setSelectedSlotCode(code);
    const found = slots.find((s) => s.slot_code === code);
    if (found) {
      setDurationDays(Math.max(found.min_duration_days || 1, durationDays));
      if (found.target_entity === 'store') setTargetType('store');
      if (found.target_entity === 'product') setTargetType('product');
    }
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
          duration_days: Number(durationDays) || 1,
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
      form.append('proof_image', proofFile);
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

  const surface = `var(--bg-card, ${isDark ? '#0f172a' : '#ffffff'})`;
  const cardAlt = `var(--bg-secondary, ${isDark ? '#1e293b' : '#f8fafc'})`;
  const border = `var(--border-light, ${isDark ? 'rgba(148, 163, 184, 0.22)' : '#e2e8f0'})`;
  const textPrimary = `var(--text-primary, ${isDark ? '#f8fafc' : '#0f172a'})`;
  const textSecondary = `var(--text-secondary, ${isDark ? '#cbd5e1' : '#475569'})`;
  const btnH = device === 'desktop' ? '38px' : '44px';

  return (
    <section
      style={{
        marginTop: '1.5rem',
        padding: device === 'mobile' ? '1rem' : '1.35rem',
        borderRadius: '1rem',
        backgroundColor: surface,
        border: `1px solid ${border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '0.65rem',
              backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Megaphone size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: textPrimary }}>
              Promosi &amp; Slot Etalase Unggulan (Sponsored Ads)
            </h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: textSecondary }}>
              Tampilkan toko atau produk Anda di halaman utama Catavor dengan penargetan kategori terukur.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => loadAdsData()}
            disabled={loading}
            style={{
              minHeight: btnH,
              padding: '0.45rem 0.8rem',
              borderRadius: '0.6rem',
              border: `1px solid ${border}`,
              backgroundColor: cardAlt,
              color: textPrimary,
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <RefreshCw size={14} />
            <span>Segarkan</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{
              minHeight: btnH,
              padding: '0.45rem 0.95rem',
              borderRadius: '0.6rem',
              border: 'none',
              backgroundColor: '#1e3a8a',
              color: '#ffffff',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <Plus size={15} />
            <span>{showCreateForm ? 'Tutup Formulir' : 'Buat Kampanye Iklan'}</span>
          </button>
        </div>
      </div>

      {banner && (
        <div
          style={{
            padding: '0.7rem 0.9rem',
            borderRadius: '0.7rem',
            backgroundColor: banner.type === 'error' ? '#fef2f2' : '#ecfdf5',
            border: `1px solid ${banner.type === 'error' ? '#fecaca' : '#a7f3d0'}`,
            color: banner.type === 'error' ? '#b91c1c' : '#047857',
            fontSize: '0.78rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          {banner.type === 'error' ? <ShieldAlert size={15} /> : <CheckCircle2 size={15} />}
          <span>{banner.text}</span>
        </div>
      )}

      {showCreateForm && (
        <form
          onSubmit={handleCreateCampaign}
          style={{
            padding: '1rem',
            borderRadius: '0.85rem',
            backgroundColor: cardAlt,
            border: `1px solid ${border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: device === 'mobile' ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.3rem' }}>
                Pilih Slot Penempatan Beranda
              </label>
              <select
                value={selectedSlotCode}
                onChange={(e) => handleSlotChange(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: btnH,
                  padding: '0.5rem 0.7rem',
                  borderRadius: '0.6rem',
                  border: `1px solid ${border}`,
                  backgroundColor: surface,
                  color: textPrimary,
                  fontSize: '0.8rem',
                }}
              >
                {slots.map((s) => (
                  <option key={s.slot_code} value={s.slot_code}>
                    {s.name} ({formatRupiah(s.default_rate_per_day)}/hari)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.3rem' }}>
                Judul Kampanye Promosi
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Promo Unggulan Akhir Pekan"
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: device === 'mobile' ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.3rem' }}>
                Tipe Target Promosi
              </label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as 'store' | 'product')}
                disabled={currentSlot?.target_entity === 'store' || currentSlot?.target_entity === 'product'}
                style={{
                  width: '100%',
                  minHeight: btnH,
                  padding: '0.5rem 0.7rem',
                  borderRadius: '0.6rem',
                  border: `1px solid ${border}`,
                  backgroundColor: surface,
                  color: textPrimary,
                  fontSize: '0.8rem',
                }}
              >
                <option value="store">Profil Katalog Toko</option>
                <option value="product">Item Produk Spesifik</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.3rem' }}>
                Durasi Tayang (Min {currentSlot?.min_duration_days || 1} Hari)
              </label>
              <input
                type="number"
                min={currentSlot?.min_duration_days || 1}
                max={90}
                value={durationDays}
                onChange={(e) => setDurationDays(Math.max(1, Number(e.target.value) || 1))}
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
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.3rem' }}>
                Metode Pembayaran
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'manual_transfer' | 'qris')}
                style={{
                  width: '100%',
                  minHeight: btnH,
                  padding: '0.5rem 0.7rem',
                  borderRadius: '0.6rem',
                  border: `1px solid ${border}`,
                  backgroundColor: surface,
                  color: textPrimary,
                  fontSize: '0.8rem',
                }}
              >
                <option value="manual_transfer">Transfer Bank (Kode Unik)</option>
                <option value="qris">QRIS Manual</option>
              </select>
            </div>
          </div>

          {targetType === 'product' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.3rem' }}>
                Pilih Produk yang Diiklankan
              </label>
              <select
                value={targetProductId}
                onChange={(e) => setTargetProductId(Number(e.target.value))}
                style={{
                  width: '100%',
                  minHeight: btnH,
                  padding: '0.5rem 0.7rem',
                  borderRadius: '0.6rem',
                  border: `1px solid ${border}`,
                  backgroundColor: surface,
                  color: textPrimary,
                  fontSize: '0.8rem',
                }}
              >
                <option value={0}>-- Pilih Produk Katalog --</option>
                {(products && products.length > 0 ? products : fetchedProducts)
                  .filter((p) => p.is_active !== false)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.price ? `(${formatRupiah(p.price)})` : ''}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem', paddingTop: '0.35rem' }}>
            <div style={{ fontSize: '0.8rem', color: textSecondary }}>
              Estimasi Biaya Sewa: <strong style={{ color: textPrimary, fontSize: '0.92rem' }}>{formatRupiah(estimatedCost)}</strong>
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                minHeight: btnH,
                padding: '0.55rem 1.2rem',
                borderRadius: '0.65rem',
                border: 'none',
                backgroundColor: '#1e3a8a',
                color: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Memproses...' : 'Ajukan & Buat Invoice Iklan'}
            </button>
          </div>
        </form>
      )}

      {/* Existing Campaigns List */}
      {campaigns.length === 0 ? (
        <div style={{ fontSize: '0.78rem', color: textSecondary, padding: '0.35rem 0' }}>
          {loading ? 'Memuat daftar kampanye promosi...' : 'Belum ada kampanye iklan internal yang diajukan oleh toko ini.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {campaigns.map((camp) => {
            const latestOrder = Array.isArray(camp.orders) && camp.orders.length > 0 ? camp.orders[0] : undefined;
            const canUpload = latestOrder && (latestOrder.payment_status === 'pending' || latestOrder.payment_status === 'rejected');
            return (
              <div
                key={camp.id}
                style={{
                  padding: '0.85rem 0.95rem',
                  borderRadius: '0.8rem',
                  backgroundColor: cardAlt,
                  border: `1px solid ${border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 800, color: textPrimary }}>
                      {camp.campaign_name} <span style={{ fontSize: '0.7rem', color: textSecondary }}>({camp.campaign_code})</span>
                    </div>
                    <div style={{ fontSize: '0.73rem', color: textSecondary }}>
                      Slot: {camp.ad_slot?.name || '-'} · Target: {camp.target_type === 'product' ? camp.target_product?.name || 'Produk' : 'Profil Toko'}
                    </div>
                    {latestOrder && (
                      <div style={{ fontSize: '0.72rem', color: textSecondary, marginTop: '0.15rem' }}>
                        Invoice: <strong>{latestOrder.order_number}</strong> · Tagihan: <strong>{formatRupiah(latestOrder.final_amount)}</strong> ({latestOrder.payment_status})
                      </div>
                    )}
                    {camp.rejection_reason && (
                      <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '0.2rem' }}>
                        Catatan: {camp.rejection_reason}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '999px',
                        backgroundColor: camp.status === 'active' ? 'rgba(16, 185, 129, 0.16)' : 'rgba(148, 163, 184, 0.2)',
                        color: camp.status === 'active' ? '#059669' : textSecondary,
                      }}
                    >
                      {camp.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleAnalytics(camp.id)}
                      style={{
                        minHeight: '36px',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '0.5rem',
                        border: `1px solid ${border}`,
                        backgroundColor: surface,
                        color: textPrimary,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <BarChart3 size={13} />
                      <span>Metrik</span>
                    </button>
                    {latestOrder?.payment_proof_url && (
                      <button
                        type="button"
                        onClick={() => handlePreviewMyProof(latestOrder.id)}
                        style={{
                          minHeight: '36px',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.5rem',
                          border: `1px solid ${border}`,
                          backgroundColor: surface,
                          color: textPrimary,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <Eye size={13} />
                        <span>Bukti</span>
                      </button>
                    )}
                    {canUpload && latestOrder && (
                      <button
                        type="button"
                        onClick={() => setActiveUploadOrderId(activeUploadOrderId === latestOrder.id ? null : latestOrder.id)}
                        style={{
                          minHeight: '36px',
                          padding: '0.35rem 0.7rem',
                          borderRadius: '0.5rem',
                          border: 'none',
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <Upload size={13} />
                        <span>Unggah Bukti</span>
                      </button>
                    )}
                  </div>
                </div>

                {latestOrder && activeUploadOrderId === latestOrder.id && (
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: '0.65rem',
                      backgroundColor: surface,
                      border: `1px solid ${border}`,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Nama Rekening Pengirim"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      style={{
                        minHeight: '38px',
                        padding: '0.4rem 0.65rem',
                        borderRadius: '0.5rem',
                        border: `1px solid ${border}`,
                        fontSize: '0.75rem',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Nama Bank / E-Wallet"
                      value={senderBank}
                      onChange={(e) => setSenderBank(e.target.value)}
                      style={{
                        minHeight: '38px',
                        padding: '0.4rem 0.65rem',
                        borderRadius: '0.5rem',
                        border: `1px solid ${border}`,
                        fontSize: '0.75rem',
                      }}
                    />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                      style={{ fontSize: '0.74rem' }}
                    />
                    <button
                      type="button"
                      disabled={uploadingOrderId === latestOrder.id}
                      onClick={() => handleUploadProof(latestOrder.id)}
                      style={{
                        minHeight: '38px',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        backgroundColor: '#059669',
                        color: '#ffffff',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {uploadingOrderId === latestOrder.id ? 'Mengunggah...' : 'Kirim Bukti Transfer'}
                    </button>
                  </div>
                )}

                {analyticsCampId === camp.id && (
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: '0.65rem',
                      backgroundColor: surface,
                      border: `1px solid ${border}`,
                      fontSize: '0.74rem',
                      color: textSecondary,
                    }}
                  >
                    {loadingAnalytics ? (
                      <div>Memuat metrik harian...</div>
                    ) : analyticsData.length === 0 ? (
                      <div>Belum ada rekaman impresi atau klik harian untuk kampanye ini.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {analyticsData.slice(0, 7).map((m) => (
                          <div key={m.date} style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <strong>{String(m.date).slice(0, 10)}</strong>
                            <span>
                              Impresi: {m.impressions_count} · Klik: {m.clicks_count} · WA: {m.wa_clicks_count} · CTR: {m.ctr_percentage}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
                backgroundColor: cardAlt,
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
