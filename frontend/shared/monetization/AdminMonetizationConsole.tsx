import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Check,
  CheckCheck,
  CheckCircle2,
  Code,
  Copy,
  DollarSign,
  Eye,
  Megaphone,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  Sliders,
  XCircle,
} from 'lucide-react';
import {
  formatRupiah,
  getAuthHeaders,
  isValidAdSenseClientId,
  isValidAdSenseSlotId,
  isValidGaMeasurementId,
  normalizeAdSenseClientId,
} from './adsenseRuntime';
import { FEATURE_MERCHANT_SPONSORED_ADS_ENABLED } from './featureFlags';

export interface AdminMonetizationConsoleProps {
  token?: string | null;
  isDark?: boolean;
  theme?: Record<string, string>;
  device?: 'desktop' | 'tablet' | 'mobile';
  onToast?: (msg: string, type?: 'success' | 'error') => void;
}

interface GoogleMonetizationSettings {
  ads_enabled: string;
  ads_client_id: string;
  ads_auto_enabled: string;
  ads_test_mode: string;
  ads_slot_header: string;
  ads_slot_infeed: string;
  ads_slot_product_detail: string;
  ads_slot_bottom: string;
  ads_txt_content: string;
  ga_enabled: string;
  ga_measurement_id: string;
}

interface AdSlotRecord {
  id: number;
  slot_code: string;
  name: string;
  description: string;
  target_entity: string;
  allowed_product_types: string;
  max_items_displayed: number;
  pricing_model: string;
  default_rate_per_day: number;
  min_duration_days: number;
  is_active: boolean;
}

interface AdOrderRecord {
  id: number;
  order_number: string;
  campaign_id: number;
  store_id: number;
  duration_days: number;
  final_amount: number;
  unique_code: number;
  payment_method: string;
  payment_status: string;
  payment_proof_url?: string;
  sender_account_name?: string;
  sender_bank_name?: string;
  rejection_reason?: string;
  created_at?: string;
  store?: { id: number; slug: string; store_title: string };
  campaign?: { id: number; campaign_code: string; campaign_name: string; target_type: string; status: string };
}

interface AdCampaignRecord {
  id: number;
  campaign_code: string;
  campaign_name: string;
  target_type: string;
  status: string;
  budget_amount: number;
  start_at?: string;
  end_at?: string;
  rejection_reason?: string;
  store?: { id: number; slug: string; store_title: string };
  ad_slot?: { id: number; slot_code: string; name: string };
  target_product?: { id: number; name: string };
}

interface OverviewSummary {
  active_campaigns: number;
  pending_verifications: number;
  paused_campaigns: number;
  total_campaigns: number;
  total_revenue_paid: number;
  impressions_30d: number;
  clicks_30d: number;
  wa_clicks_30d: number;
}

const DEFAULT_GOOGLE_SETTINGS: GoogleMonetizationSettings = {
  ads_enabled: '0',
  ads_client_id: '',
  ads_auto_enabled: '0',
  ads_test_mode: '1',
  ads_slot_header: '',
  ads_slot_infeed: '',
  ads_slot_product_detail: '',
  ads_slot_bottom: '',
  ads_txt_content: '',
  ga_enabled: '0',
  ga_measurement_id: '',
};

export const AdminMonetizationConsole: React.FC<AdminMonetizationConsoleProps> = ({
  token,
  isDark = false,
  theme,
  device = 'desktop',
  onToast,
}) => {
  const [subTab, setSubTab] = useState<'adsense' | 'analytics' | 'sponsored'>('adsense');
  const [settings, setSettings] = useState<GoogleMonetizationSettings>(DEFAULT_GOOGLE_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [copiedTxt, setCopiedTxt] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sponsored Ops state
  const [loadingOps, setLoadingOps] = useState(false);
  const [summary, setSummary] = useState<OverviewSummary>({
    active_campaigns: 0,
    pending_verifications: 0,
    paused_campaigns: 0,
    total_campaigns: 0,
    total_revenue_paid: 0,
    impressions_30d: 0,
    clicks_30d: 0,
    wa_clicks_30d: 0,
  });
  const [slots, setSlots] = useState<AdSlotRecord[]>([]);
  const [slotDrafts, setSlotDrafts] = useState<Record<number, { rate: string; minDays: string; maxItems: string; active: boolean }>>({});
  const [savingSlotId, setSavingSlotId] = useState<number | null>(null);
  const [pendingOrders, setPendingOrders] = useState<AdOrderRecord[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaignRecord[]>([]);
  const [campStatusFilter, setCampStatusFilter] = useState<string>('all');
  const [campQuery, setCampQuery] = useState<string>('');
  const [campPage, setCampPage] = useState<number>(1);
  const [campTotalPages, setCampTotalPages] = useState<number>(1);
  const [rejectTargetOrderId, setRejectTargetOrderId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [proofModal, setProofModal] = useState<{ open: boolean; url: string; title: string; error?: string }>({
    open: false,
    url: '',
    title: '',
  });

  const ui = {
    surface: theme?.surface || (isDark ? '#0f172a' : '#ffffff'),
    cardAlt: theme?.cardAlt || (isDark ? '#1e293b' : '#f8fafc'),
    border: theme?.border || (isDark ? 'rgba(148, 163, 184, 0.22)' : '#e2e8f0'),
    inputBg: theme?.inputBg || (isDark ? '#0b1220' : '#ffffff'),
    inputBorder: theme?.inputBorder || (isDark ? 'rgba(148, 163, 184, 0.3)' : '#cbd5e1'),
    textPrimary: theme?.textPrimary || (isDark ? '#f8fafc' : '#0f172a'),
    textSecondary: theme?.textSecondary || (isDark ? '#cbd5e1' : '#475569'),
    textMuted: theme?.textMuted || (isDark ? '#94a3b8' : '#64748b'),
  };

  const notify = useCallback(
    (text: string, type: 'success' | 'error' = 'success') => {
      setStatusBanner({ type, text });
      if (onToast) onToast(text, type);
    },
    [onToast]
  );

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const res = await fetch('/api/admin/monetization/settings', {
        credentials: 'include',
        headers: getAuthHeaders(token),
      });
      const json = await res.json();
      if (res.ok && json?.success && json.data) {
        setSettings({
          ...DEFAULT_GOOGLE_SETTINGS,
          ...json.data,
        });
      }
    } catch {
      notify('Gagal memuat pengaturan monetisasi platform.', 'error');
    } finally {
      setLoadingSettings(false);
    }
  }, [token, notify]);

  const loadSponsoredOps = useCallback(
    async (pageOverride?: number, statusOverride?: string, queryOverride?: string) => {
      setLoadingOps(true);
      const targetPage = pageOverride ?? campPage;
      const targetStatus = statusOverride ?? campStatusFilter;
      const targetQ = queryOverride ?? campQuery;
      try {
        const params = new URLSearchParams();
        params.set('page', String(targetPage));
        params.set('per_page', device === 'mobile' ? '8' : '15');
        if (targetStatus && targetStatus !== 'all') params.set('status', targetStatus);
        if (targetQ.trim()) params.set('q', targetQ.trim());

        const [ovRes, pendRes] = await Promise.all([
          fetch(`/api/admin/ads/overview?${params.toString()}`, {
            credentials: 'include',
            headers: getAuthHeaders(token),
          }),
          fetch('/api/admin/ads/campaigns/pending', {
            credentials: 'include',
            headers: getAuthHeaders(token),
          }),
        ]);

        if (ovRes.ok) {
          const ovJson = await ovRes.json();
          if (ovJson?.success && ovJson.data) {
            if (ovJson.data.summary) setSummary(ovJson.data.summary);
            const loadedSlots: AdSlotRecord[] = Array.isArray(ovJson.data.slots) ? ovJson.data.slots : [];
            setSlots(loadedSlots);
            const nextDrafts: Record<number, { rate: string; minDays: string; maxItems: string; active: boolean }> = {};
            loadedSlots.forEach((s) => {
              nextDrafts[s.id] = {
                rate: String(Math.round(s.default_rate_per_day || 0)),
                minDays: String(s.min_duration_days || 1),
                maxItems: String(s.max_items_displayed || 4),
                active: Boolean(s.is_active),
              };
            });
            setSlotDrafts(nextDrafts);
            setCampaigns(Array.isArray(ovJson.data.campaigns) ? ovJson.data.campaigns : []);
            if (ovJson.data.pagination) {
              setCampTotalPages(Math.max(1, ovJson.data.pagination.total_pages || 1));
            }
          }
        }
        if (pendRes.ok) {
          const pendJson = await pendRes.json();
          if (pendJson?.success && Array.isArray(pendJson.data)) {
            setPendingOrders(pendJson.data);
          }
        }
      } catch {
        notify('Gagal memuat data operasional Sponsored Ads.', 'error');
      } finally {
        setLoadingOps(false);
      }
    },
    [token, campPage, campStatusFilter, campQuery, device, notify]
  );

  useEffect(() => {
    loadSettings();
    if (FEATURE_MERCHANT_SPONSORED_ADS_ENABLED) {
      loadSponsoredOps(1, 'all', '');
    }
  }, [loadSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (proofModal.url) {
        URL.revokeObjectURL(proofModal.url);
      }
    };
  }, [proofModal.url]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusBanner(null);

    if (settings.ads_client_id.trim() !== '' && !isValidAdSenseClientId(settings.ads_client_id)) {
      notify('Format Publisher ID tidak valid. Gunakan format ca-pub-XXXXXXXXXXXXXXXX (16 digit angka non-nol).', 'error');
      return;
    }
    if (settings.ads_enabled === '1' && !isValidAdSenseClientId(settings.ads_client_id)) {
      notify('Publisher ID AdSense yang valid wajib diisi sebelum mengaktifkan penayangan iklan.', 'error');
      return;
    }
    for (const [key, label] of [
      ['ads_slot_header', 'Slot ID Header'],
      ['ads_slot_infeed', 'Slot ID In-Feed'],
      ['ads_slot_product_detail', 'Slot ID Detail Produk'],
      ['ads_slot_bottom', 'Slot ID Banner Bawah'],
    ] as const) {
      const val = settings[key].trim();
      if (val !== '' && !isValidAdSenseSlotId(val)) {
        notify(`${label} tidak valid (harus 8-12 digit angka).`, 'error');
        return;
      }
    }
    if (settings.ga_measurement_id.trim() !== '' && !isValidGaMeasurementId(settings.ga_measurement_id)) {
      notify('Format GA4 Measurement ID tidak valid (wajib G-XXXXXXXXXX).', 'error');
      return;
    }
    if (settings.ga_enabled === '1' && !isValidGaMeasurementId(settings.ga_measurement_id)) {
      notify('Measurement ID Google Analytics 4 wajib diisi sebelum mengaktifkan GA4.', 'error');
      return;
    }

    setSavingSettings(true);
    try {
      const normalizedClient = settings.ads_client_id.trim()
        ? normalizeAdSenseClientId(settings.ads_client_id)
        : '';
      const payload: Record<string, string> = {
        ...settings,
        ads_client_id: normalizedClient,
        ga_measurement_id: settings.ga_measurement_id.trim().toUpperCase(),
      };
      const res = await fetch('/api/admin/monetization/settings', {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        notify(json?.message || 'Gagal menyimpan pengaturan monetisasi.', 'error');
        return;
      }
      notify(json?.message || 'Pengaturan monetisasi dan analitik berhasil disimpan.', 'success');
      await loadSettings();
    } catch {
      notify('Terjadi kesalahan koneksi saat menyimpan pengaturan monetisasi.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleGenerateAdsTxt = () => {
    const norm = normalizeAdSenseClientId(settings.ads_client_id);
    if (!norm) {
      notify('Isi Publisher ID AdSense yang valid terlebih dahulu untuk membuat baris ads.txt.', 'error');
      return;
    }
    const pubOnly = norm.replace(/^ca-/, '');
    setSettings((prev) => ({
      ...prev,
      ads_client_id: norm,
      ads_txt_content: `google.com, ${pubOnly}, DIRECT, f08c47fec0942fa0`,
    }));
  };

  const handleCopyAdsTxt = async () => {
    if (!settings.ads_txt_content.trim()) return;
    try {
      await navigator.clipboard.writeText(settings.ads_txt_content);
      setCopiedTxt(true);
      setTimeout(() => setCopiedTxt(false), 1800);
    } catch {
      notify('Gagal menyalin konten ads.txt ke clipboard.', 'error');
    }
  };

  const handleSaveSlot = async (slotId: number) => {
    const draft = slotDrafts[slotId];
    if (!draft) return;
    setSavingSlotId(slotId);
    try {
      const res = await fetch(`/api/admin/ads/slots/${slotId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          ...getAuthHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          default_rate_per_day: Number(draft.rate) || 0,
          min_duration_days: Number(draft.minDays) || 1,
          max_items_displayed: Number(draft.maxItems) || 4,
          is_active: draft.active,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        notify(json?.message || 'Gagal memperbarui slot iklan.', 'error');
        return;
      }
      notify('Konfigurasi tarif dan kapasitas slot diperbarui.', 'success');
      await loadSponsoredOps();
    } catch {
      notify('Gagal terhubung ke server saat memperbarui slot.', 'error');
    } finally {
      setSavingSlotId(null);
    }
  };

  const handleVerifyOrder = async (orderId: number, action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectReason.trim()) {
      notify('Cantumkan alasan penolakan pembayaran iklan.', 'error');
      return;
    }
    setBusyActionId(`verify-${orderId}`);
    try {
      const res = await fetch(`/api/admin/ads/orders/${orderId}/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          rejection_reason: action === 'reject' ? rejectReason.trim() : '',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        notify(json?.message || 'Gagal memverifikasi pembayaran iklan.', 'error');
        return;
      }
      notify(json.message || 'Status pembayaran iklan berhasil diperbarui.', 'success');
      setRejectTargetOrderId(null);
      setRejectReason('');
      await loadSponsoredOps();
    } catch {
      notify('Gagal terhubung saat memverifikasi pembayaran iklan.', 'error');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleModerateCampaign = async (campId: number, action: 'pause' | 'resume' | 'reject') => {
    setBusyActionId(`mod-${campId}`);
    try {
      const res = await fetch(`/api/admin/ads/campaigns/${campId}/moderate`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        notify(json?.message || 'Gagal memoderasi kampanye.', 'error');
        return;
      }
      notify(json.message || 'Status kampanye berhasil diperbarui.', 'success');
      await loadSponsoredOps();
    } catch {
      notify('Gagal terhubung saat memoderasi kampanye.', 'error');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleOpenProofPreview = async (order: AdOrderRecord) => {
    if (proofModal.url) {
      URL.revokeObjectURL(proofModal.url);
    }
    setProofModal({ open: true, url: '', title: `Bukti Transfer ${order.order_number}` });
    try {
      const res = await fetch(`/api/admin/ads/orders/${order.id}/proof`, {
        credentials: 'include',
        headers: getAuthHeaders(token),
      });
      if (!res.ok) {
        setProofModal({ open: true, url: '', title: `Bukti Transfer ${order.order_number}`, error: 'Bukti pembayaran belum tersedia atau gagal dimuat.' });
        return;
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      setProofModal({ open: true, url: objUrl, title: `Bukti Transfer ${order.order_number}` });
    } catch {
      setProofModal({ open: true, url: '', title: `Bukti Transfer ${order.order_number}`, error: 'Gagal memuat berkas bukti transfer.' });
    }
  };

  const clientValid = settings.ads_client_id.trim() !== '' && isValidAdSenseClientId(settings.ads_client_id);
  const gaValid = settings.ga_measurement_id.trim() !== '' && isValidGaMeasurementId(settings.ga_measurement_id);
  const touchBtnH = device === 'desktop' ? '38px' : '44px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
      {/* Sub-navigation tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: device === 'mobile'
            ? '1fr'
            : FEATURE_MERCHANT_SPONSORED_ADS_ENABLED
              ? 'repeat(3, minmax(0, 1fr))'
              : 'repeat(2, minmax(0, 1fr))',
          gap: '0.45rem',
          padding: '0.35rem',
          borderRadius: '0.85rem',
          backgroundColor: ui.cardAlt,
          border: `1px solid ${ui.border}`,
        }}
      >
        {[
          { id: 'adsense', label: 'Google AdSense', Icon: DollarSign },
          { id: 'analytics', label: 'Google Analytics 4', Icon: BarChart3 },
          ...(FEATURE_MERCHANT_SPONSORED_ADS_ENABLED
            ? [{ id: 'sponsored', label: `Iklan Internal${pendingOrders.length > 0 ? ` (${pendingOrders.length})` : ''}`, Icon: Megaphone }]
            : []),
        ].map(({ id, label, Icon }) => {
          const active = subTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id as typeof subTab)}
              style={{
                minHeight: touchBtnH,
                padding: '0.55rem 0.85rem',
                borderRadius: '0.65rem',
                border: active ? 'none' : '1px solid transparent',
                backgroundColor: active ? '#1e3a8a' : 'transparent',
                color: active ? '#ffffff' : ui.textSecondary,
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
              }}
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {statusBanner && (
        <div
          style={{
            padding: '0.75rem 0.95rem',
            borderRadius: '0.75rem',
            backgroundColor: statusBanner.type === 'error' ? (isDark ? 'rgba(239, 68, 68, 0.14)' : '#fef2f2') : (isDark ? 'rgba(16, 185, 129, 0.14)' : '#ecfdf5'),
            border: `1px solid ${statusBanner.type === 'error' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
            color: statusBanner.type === 'error' ? (isDark ? '#fca5a5' : '#b91c1c') : (isDark ? '#6ee7b7' : '#047857'),
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {statusBanner.type === 'error' ? <ShieldAlert size={16} /> : <CheckCircle2 size={16} />}
          <span>{statusBanner.text}</span>
        </div>
      )}

      {/* TAB 1: GOOGLE ADSENSE */}
      {subTab === 'adsense' && (
        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              padding: '0.9rem 1rem',
              borderRadius: '0.85rem',
              backgroundColor: isDark ? 'rgba(234, 179, 8, 0.08)' : '#fffbeb',
              border: '1px solid rgba(234, 179, 8, 0.32)',
              fontSize: '0.77rem',
              color: ui.textSecondary,
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: isDark ? '#fde047' : '#92400e', display: 'block', marginBottom: '0.2rem' }}>
              Kebijakan Isolasi Penayangan Iklan Publik
            </strong>
            Skrip dan slot iklan hanya aktif pada etalase publik <strong>Paket Gratis (Free Tier)</strong>. Toko berbayar, halaman otentikasi, admin panel, checkout, dan dashboard merchant 100% bebas iklan.
          </div>

          <div
            style={{
              padding: '1.1rem',
              borderRadius: '0.95rem',
              backgroundColor: ui.surface,
              border: `1px solid ${ui.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.9rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: ui.textPrimary }}>Aktifkan Google AdSense Platform</div>
                <div style={{ fontSize: '0.73rem', color: ui.textSecondary }}>Menyalakan penayangan iklan pada katalog publik paket gratis</div>
              </div>
              <button
                type="button"
                aria-label="Toggle Google AdSense"
                onClick={() => setSettings((p) => ({ ...p, ads_enabled: p.ads_enabled === '1' ? '0' : '1' }))}
                style={{
                  width: '48px',
                  height: '26px',
                  borderRadius: '999px',
                  backgroundColor: settings.ads_enabled === '1' ? '#10b981' : '#94a3b8',
                  border: 'none',
                  position: 'relative',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '3px',
                    left: settings.ads_enabled === '1' ? '24px' : '3px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    transition: 'left 0.15s ease',
                  }}
                />
              </button>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: ui.textSecondary }}>
                  Publisher ID Google AdSense (Client ID)
                </label>
                {settings.ads_client_id.trim() !== '' && (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: clientValid ? '#10b981' : '#ef4444' }}>
                    {clientValid ? 'Format Valid' : 'Format Tidak Valid'}
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="ca-pub-1234567890123456"
                value={settings.ads_client_id}
                onChange={(e) => setSettings((p) => ({ ...p, ads_client_id: e.target.value.trim() }))}
                disabled={loadingSettings}
                style={{
                  width: '100%',
                  minHeight: touchBtnH,
                  padding: '0.6rem 0.8rem',
                  borderRadius: '0.65rem',
                  backgroundColor: ui.inputBg,
                  border: `1px solid ${ui.inputBorder}`,
                  color: ui.textPrimary,
                  fontSize: '0.82rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: device === 'mobile' ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.75rem 0.9rem',
                  borderRadius: '0.75rem',
                  backgroundColor: ui.cardAlt,
                  border: `1px solid ${ui.border}`,
                  cursor: 'pointer',
                  minHeight: touchBtnH,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: ui.textPrimary }}>Auto Ads Google</div>
                  <div style={{ fontSize: '0.69rem', color: ui.textMuted }}>Penempatan otomatis oleh AdSense</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.ads_auto_enabled === '1'}
                  onChange={(e) => setSettings((p) => ({ ...p, ads_auto_enabled: e.target.checked ? '1' : '0' }))}
                />
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.75rem 0.9rem',
                  borderRadius: '0.75rem',
                  backgroundColor: ui.cardAlt,
                  border: `1px solid ${ui.border}`,
                  cursor: 'pointer',
                  minHeight: touchBtnH,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: ui.textPrimary }}>Mode Sandbox / Pratinjau</div>
                  <div style={{ fontSize: '0.69rem', color: ui.textMuted }}>Simulasi tata letak tanpa skrip iklan asli</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.ads_test_mode === '1'}
                  onChange={(e) => setSettings((p) => ({ ...p, ads_test_mode: e.target.checked ? '1' : '0' }))}
                />
              </label>
            </div>
          </div>

          <div
            style={{
              padding: '1.1rem',
              borderRadius: '0.95rem',
              backgroundColor: ui.surface,
              border: `1px solid ${ui.border}`,
              display: 'grid',
              gridTemplateColumns: device === 'mobile' ? '1fr' : 'repeat(2, minmax(0, 1fr))',
              gap: '0.85rem',
            }}
          >
            {[
              { key: 'ads_slot_header', label: '1. Header Katalog (Bawah Search)', placeholder: 'Contoh: 1234567890' },
              { key: 'ads_slot_infeed', label: '2. In-Feed Katalog (Sela Produk)', placeholder: 'Contoh: 2345678901' },
              { key: 'ads_slot_product_detail', label: '3. Detail Produk Publik', placeholder: 'Contoh: 3456789012' },
              { key: 'ads_slot_bottom', label: '4. Sticky Banner Bawah Katalog', placeholder: 'Contoh: 4567890123' },
            ].map((slot) => (
              <div key={slot.key}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: ui.textSecondary, marginBottom: '0.3rem' }}>
                  {slot.label}
                </label>
                <input
                  type="text"
                  placeholder={slot.placeholder}
                  value={settings[slot.key as keyof GoogleMonetizationSettings]}
                  onChange={(e) => setSettings((p) => ({ ...p, [slot.key]: e.target.value.trim() }))}
                  style={{
                    width: '100%',
                    minHeight: touchBtnH,
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.65rem',
                    backgroundColor: ui.inputBg,
                    border: `1px solid ${ui.inputBorder}`,
                    color: ui.textPrimary,
                    fontSize: '0.8rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>

          <div
            style={{
              padding: '1.1rem',
              borderRadius: '0.95rem',
              backgroundColor: ui.surface,
              border: `1px solid ${ui.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Code size={16} color="#10b981" />
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: ui.textPrimary }}>File Verifikasi Domain /ads.txt</span>
              </div>
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleGenerateAdsTxt}
                  style={{
                    minHeight: '36px',
                    padding: '0.35rem 0.7rem',
                    borderRadius: '0.55rem',
                    border: `1px solid ${ui.border}`,
                    backgroundColor: ui.cardAlt,
                    color: ui.textPrimary,
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Generate dari Publisher ID
                </button>
                <button
                  type="button"
                  onClick={handleCopyAdsTxt}
                  style={{
                    minHeight: '36px',
                    padding: '0.35rem 0.7rem',
                    borderRadius: '0.55rem',
                    border: `1px solid ${ui.border}`,
                    backgroundColor: ui.cardAlt,
                    color: copiedTxt ? '#10b981' : ui.textSecondary,
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  {copiedTxt ? <CheckCheck size={13} /> : <Copy size={13} />}
                  <span>{copiedTxt ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: ui.textSecondary }}>
              Jika kosong, server mengembalikan 404 (tidak membocorkan ID placeholder). Tersedia di{' '}
              <a href="/ads.txt" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
                /ads.txt
              </a>
              .
            </p>
            <textarea
              rows={2}
              placeholder="google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0"
              value={settings.ads_txt_content}
              onChange={(e) => setSettings((p) => ({ ...p, ads_txt_content: e.target.value }))}
              style={{
                width: '100%',
                padding: '0.65rem 0.8rem',
                borderRadius: '0.65rem',
                backgroundColor: ui.inputBg,
                border: `1px solid ${ui.inputBorder}`,
                color: isDark ? '#34d399' : '#047857',
                fontFamily: 'monospace',
                fontSize: '0.76rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: device === 'desktop' ? 'flex-end' : 'stretch' }}>
            <button
              type="submit"
              disabled={savingSettings}
              style={{
                width: device === 'desktop' ? 'auto' : '100%',
                minHeight: touchBtnH,
                padding: '0.65rem 1.35rem',
                borderRadius: '0.7rem',
                border: 'none',
                backgroundColor: '#1e3a8a',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: savingSettings ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
              }}
            >
              <Check size={16} />
              <span>{savingSettings ? 'Menyimpan...' : 'Simpan Konfigurasi AdSense'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: GOOGLE ANALYTICS 4 */}
      {subTab === 'analytics' && (
        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              padding: '1.1rem',
              borderRadius: '0.95rem',
              backgroundColor: ui.surface,
              border: `1px solid ${ui.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.9rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: ui.textPrimary }}>Aktifkan Google Analytics 4 (GA4)</div>
                <div style={{ fontSize: '0.73rem', color: ui.textSecondary }}>
                  Mengaktifkan pelacakan SPA page_view &amp; Consent Mode v2 pada etalase dan beranda
                </div>
              </div>
              <button
                type="button"
                aria-label="Toggle GA4"
                onClick={() => setSettings((p) => ({ ...p, ga_enabled: p.ga_enabled === '1' ? '0' : '1' }))}
                style={{
                  width: '48px',
                  height: '26px',
                  borderRadius: '999px',
                  backgroundColor: settings.ga_enabled === '1' ? '#0284c7' : '#94a3b8',
                  border: 'none',
                  position: 'relative',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '3px',
                    left: settings.ga_enabled === '1' ? '24px' : '3px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    transition: 'left 0.15s ease',
                  }}
                />
              </button>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: ui.textSecondary }}>
                  GA4 Measurement ID
                </label>
                {settings.ga_measurement_id.trim() !== '' && (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: gaValid ? '#10b981' : '#ef4444' }}>
                    {gaValid ? 'Format Valid' : 'Harus G-XXXXXXXXXX'}
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="G-4K89Z1X234"
                value={settings.ga_measurement_id}
                onChange={(e) => setSettings((p) => ({ ...p, ga_measurement_id: e.target.value.trim().toUpperCase() }))}
                style={{
                  width: '100%',
                  minHeight: touchBtnH,
                  padding: '0.6rem 0.8rem',
                  borderRadius: '0.65rem',
                  backgroundColor: ui.inputBg,
                  border: `1px solid ${ui.inputBorder}`,
                  color: ui.textPrimary,
                  fontSize: '0.82rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div
              style={{
                padding: '0.8rem 0.95rem',
                borderRadius: '0.75rem',
                backgroundColor: ui.cardAlt,
                border: `1px solid ${ui.border}`,
                fontSize: '0.74rem',
                color: ui.textSecondary,
                lineHeight: 1.55,
              }}
            >
              <strong style={{ color: ui.textPrimary, display: 'block', marginBottom: '0.25rem' }}>Event Otomatis &amp; Privasi:</strong>
              <div>1. Menunggu preferensi banner cookie (Consent Mode v2) sebelum mengaktifkan storage analitik penuh.</div>
              <div>2. Mengirim event `page_view` saat navigasi SPA halaman utama maupun etalase toko publik.</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: device === 'desktop' ? 'flex-end' : 'stretch' }}>
            <button
              type="submit"
              disabled={savingSettings}
              style={{
                width: device === 'desktop' ? 'auto' : '100%',
                minHeight: touchBtnH,
                padding: '0.65rem 1.35rem',
                borderRadius: '0.7rem',
                border: 'none',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: savingSettings ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
              }}
            >
              <Check size={16} />
              <span>{savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan GA4'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: INTERNAL SPONSORED ADS OPS */}
      {subTab === 'sponsored' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: ui.textPrimary }}>
              Operasional Iklan Internal &amp; Featured Showcase
            </div>
            <button
              type="button"
              onClick={() => loadSponsoredOps()}
              disabled={loadingOps}
              style={{
                minHeight: '38px',
                padding: '0.45rem 0.85rem',
                borderRadius: '0.6rem',
                border: `1px solid ${ui.border}`,
                backgroundColor: ui.surface,
                color: ui.textPrimary,
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <RefreshCw size={14} />
              <span>{loadingOps ? 'Memuat...' : 'Segarkan Data'}</span>
            </button>
          </div>

          {/* Summary KPI */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: device === 'mobile' ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
              gap: '0.75rem',
            }}
          >
            {[
              { label: 'Kampanye Aktif', val: String(summary.active_campaigns) },
              { label: 'Antrean Verifikasi', val: String(summary.pending_verifications) },
              { label: 'Pendapatan Iklan', val: formatRupiah(summary.total_revenue_paid) },
              { label: 'Impresi / Klik (30h)', val: `${summary.impressions_30d.toLocaleString('id-ID')} / ${summary.clicks_30d.toLocaleString('id-ID')}` },
            ].map((kpi) => (
              <div
                key={kpi.label}
                style={{
                  padding: '0.85rem 0.95rem',
                  borderRadius: '0.85rem',
                  backgroundColor: ui.surface,
                  border: `1px solid ${ui.border}`,
                }}
              >
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: ui.textMuted }}>{kpi.label}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: ui.textPrimary, marginTop: '0.2rem' }}>{kpi.val}</div>
              </div>
            ))}
          </div>

          {/* Pending Payment Queue */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '0.95rem',
              backgroundColor: ui.surface,
              border: `1px solid ${ui.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: ui.textPrimary }}>
              Antrean Verifikasi Pembayaran ({pendingOrders.length})
            </div>
            {pendingOrders.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: ui.textMuted, padding: '0.65rem 0' }}>
                Tidak ada pesanan iklan yang menunggu verifikasi saat ini.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {pendingOrders.map((ord) => (
                  <div
                    key={ord.id}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '0.75rem',
                      backgroundColor: ui.cardAlt,
                      border: `1px solid ${ui.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: ui.textPrimary }}>
                          {ord.campaign?.campaign_name || ord.order_number}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: ui.textSecondary }}>
                          {ord.order_number} · Toko: {ord.store?.store_title || `#${ord.store_id}`} · {ord.duration_days} hari
                        </div>
                        {(ord.sender_account_name || ord.sender_bank_name) && (
                          <div style={{ fontSize: '0.7rem', color: ui.textMuted }}>
                            Pengirim: {ord.sender_account_name || '-'} ({ord.sender_bank_name || '-'})
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#10b981' }}>
                          {formatRupiah(ord.final_amount)}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: ui.textMuted }}>
                          Status: {ord.payment_status}
                        </div>
                      </div>
                    </div>

                    {rejectTargetOrderId === ord.id && (
                      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          placeholder="Alasan penolakan transfer..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          style={{
                            flex: 1,
                            minWidth: '180px',
                            minHeight: '40px',
                            padding: '0.45rem 0.7rem',
                            borderRadius: '0.55rem',
                            backgroundColor: ui.inputBg,
                            border: `1px solid ${ui.inputBorder}`,
                            color: ui.textPrimary,
                            fontSize: '0.76rem',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleVerifyOrder(ord.id, 'reject')}
                          disabled={busyActionId === `verify-${ord.id}`}
                          style={{
                            minHeight: '40px',
                            padding: '0.4rem 0.85rem',
                            borderRadius: '0.55rem',
                            border: 'none',
                            backgroundColor: '#dc2626',
                            color: '#ffffff',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Konfirmasi Tolak
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                      {ord.payment_proof_url && (
                        <button
                          type="button"
                          onClick={() => handleOpenProofPreview(ord)}
                          style={{
                            minHeight: touchBtnH,
                            padding: '0.45rem 0.8rem',
                            borderRadius: '0.55rem',
                            border: `1px solid ${ui.border}`,
                            backgroundColor: ui.surface,
                            color: ui.textPrimary,
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}
                        >
                          <Eye size={14} />
                          <span>Lihat Bukti</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleVerifyOrder(ord.id, 'approve')}
                        disabled={busyActionId === `verify-${ord.id}`}
                        style={{
                          minHeight: touchBtnH,
                          padding: '0.45rem 0.85rem',
                          borderRadius: '0.55rem',
                          border: 'none',
                          backgroundColor: '#059669',
                          color: '#ffffff',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <Check size={14} />
                        <span>Setujui &amp; Aktifkan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectTargetOrderId(rejectTargetOrderId === ord.id ? null : ord.id)}
                        style={{
                          minHeight: touchBtnH,
                          padding: '0.45rem 0.85rem',
                          borderRadius: '0.55rem',
                          border: '1px solid rgba(220, 38, 38, 0.35)',
                          backgroundColor: 'transparent',
                          color: '#ef4444',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <XCircle size={14} />
                        <span>Tolak</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 9 Ad Slots Management */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '0.95rem',
              backgroundColor: ui.surface,
              border: `1px solid ${ui.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.86rem', fontWeight: 800, color: ui.textPrimary }}>
              <Sliders size={16} />
              <span>Tarif &amp; Kapasitas Slot Penempatan Iklan ({slots.length})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: device === 'desktop' ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: '0.75rem' }}>
              {slots.map((slot) => {
                const draft = slotDrafts[slot.id] || {
                  rate: String(Math.round(slot.default_rate_per_day || 0)),
                  minDays: String(slot.min_duration_days || 1),
                  maxItems: String(slot.max_items_displayed || 4),
                  active: slot.is_active,
                };
                return (
                  <div
                    key={slot.id}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '0.75rem',
                      backgroundColor: ui.cardAlt,
                      border: `1px solid ${ui.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.55rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: ui.textPrimary }}>{slot.name}</div>
                        <div style={{ fontSize: '0.68rem', color: ui.textMuted }}>
                          {slot.slot_code} · Target: {slot.target_entity}
                        </div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: ui.textSecondary, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={draft.active}
                          onChange={(e) =>
                            setSlotDrafts((p) => ({ ...p, [slot.id]: { ...draft, active: e.target.checked } }))
                          }
                        />
                        <span>Aktif</span>
                      </label>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.45rem' }}>
                      <div>
                        <span style={{ fontSize: '0.66rem', color: ui.textMuted, display: 'block' }}>Tarif/Hari (Rp)</span>
                        <input
                          type="number"
                          min={0}
                          value={draft.rate}
                          onChange={(e) => setSlotDrafts((p) => ({ ...p, [slot.id]: { ...draft, rate: e.target.value } }))}
                          style={{
                            width: '100%',
                            minHeight: '38px',
                            padding: '0.35rem 0.5rem',
                            borderRadius: '0.5rem',
                            backgroundColor: ui.inputBg,
                            border: `1px solid ${ui.inputBorder}`,
                            color: ui.textPrimary,
                            fontSize: '0.76rem',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div>
                        <span style={{ fontSize: '0.66rem', color: ui.textMuted, display: 'block' }}>Min Hari</span>
                        <input
                          type="number"
                          min={1}
                          max={90}
                          value={draft.minDays}
                          onChange={(e) => setSlotDrafts((p) => ({ ...p, [slot.id]: { ...draft, minDays: e.target.value } }))}
                          style={{
                            width: '100%',
                            minHeight: '38px',
                            padding: '0.35rem 0.5rem',
                            borderRadius: '0.5rem',
                            backgroundColor: ui.inputBg,
                            border: `1px solid ${ui.inputBorder}`,
                            color: ui.textPrimary,
                            fontSize: '0.76rem',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div>
                        <span style={{ fontSize: '0.66rem', color: ui.textMuted, display: 'block' }}>Maks Item</span>
                        <input
                          type="number"
                          min={1}
                          max={24}
                          value={draft.maxItems}
                          onChange={(e) => setSlotDrafts((p) => ({ ...p, [slot.id]: { ...draft, maxItems: e.target.value } }))}
                          style={{
                            width: '100%',
                            minHeight: '38px',
                            padding: '0.35rem 0.5rem',
                            borderRadius: '0.5rem',
                            backgroundColor: ui.inputBg,
                            border: `1px solid ${ui.inputBorder}`,
                            color: ui.textPrimary,
                            fontSize: '0.76rem',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveSlot(slot.id)}
                      disabled={savingSlotId === slot.id}
                      style={{
                        minHeight: '38px',
                        padding: '0.4rem 0.75rem',
                        borderRadius: '0.55rem',
                        border: 'none',
                        backgroundColor: '#1e3a8a',
                        color: '#ffffff',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {savingSlotId === slot.id ? 'Menyimpan...' : 'Simpan Tarif Slot'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Campaigns Moderation & Pagination */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '0.95rem',
              backgroundColor: ui.surface,
              border: `1px solid ${ui.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: ui.textPrimary }}>
                Daftar &amp; Moderasi Kampanye Iklan
              </div>
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', width: device === 'mobile' ? '100%' : 'auto' }}>
                <div style={{ position: 'relative', flex: device === 'mobile' ? '1 1 140px' : 'none' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: ui.textMuted }} />
                  <input
                    type="text"
                    placeholder="Cari kampanye / toko..."
                    value={campQuery}
                    onChange={(e) => setCampQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setCampPage(1);
                        loadSponsoredOps(1, campStatusFilter, campQuery);
                      }
                    }}
                    style={{
                      minHeight: '38px',
                      padding: '0.4rem 0.65rem 0.4rem 1.9rem',
                      borderRadius: '0.55rem',
                      backgroundColor: ui.inputBg,
                      border: `1px solid ${ui.inputBorder}`,
                      color: ui.textPrimary,
                      fontSize: '0.76rem',
                    }}
                  />
                </div>
                <select
                  value={campStatusFilter}
                  onChange={(e) => {
                    const nextStatus = e.target.value;
                    setCampStatusFilter(nextStatus);
                    setCampPage(1);
                    loadSponsoredOps(1, nextStatus, campQuery);
                  }}
                  style={{
                    minHeight: '38px',
                    padding: '0.4rem 0.65rem',
                    borderRadius: '0.55rem',
                    backgroundColor: ui.inputBg,
                    border: `1px solid ${ui.inputBorder}`,
                    color: ui.textPrimary,
                    fontSize: '0.76rem',
                  }}
                >
                  <option value="all">Semua Status</option>
                  <option value="active">Aktif</option>
                  <option value="pending_payment">Menunggu Bayar</option>
                  <option value="paused">Dijeda</option>
                  <option value="rejected">Ditolak</option>
                  <option value="completed">Selesai</option>
                </select>
              </div>
            </div>

            {campaigns.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: ui.textMuted, padding: '0.5rem 0' }}>
                Belum ada kampanye yang sesuai filter.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {campaigns.map((camp) => (
                  <div
                    key={camp.id}
                    style={{
                      padding: '0.75rem 0.9rem',
                      borderRadius: '0.7rem',
                      backgroundColor: ui.cardAlt,
                      border: `1px solid ${ui.border}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.6rem',
                    }}
                  >
                    <div style={{ minWidth: '180px', flex: 1 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: ui.textPrimary }}>
                        {camp.campaign_name} <span style={{ fontSize: '0.7rem', color: ui.textMuted }}>({camp.campaign_code})</span>
                      </div>
                      <div style={{ fontSize: '0.71rem', color: ui.textSecondary }}>
                        Toko: {camp.store?.store_title || '-'} · Slot: {camp.ad_slot?.name || '-'} · Budget: {formatRupiah(camp.budget_amount)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '999px',
                          backgroundColor: camp.status === 'active' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(148, 163, 184, 0.2)',
                          color: camp.status === 'active' ? '#10b981' : ui.textSecondary,
                        }}
                      >
                        {camp.status}
                      </span>
                      {camp.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleModerateCampaign(camp.id, 'pause')}
                          disabled={busyActionId === `mod-${camp.id}`}
                          style={{
                            minHeight: '36px',
                            padding: '0.35rem 0.65rem',
                            borderRadius: '0.5rem',
                            border: `1px solid ${ui.border}`,
                            backgroundColor: ui.surface,
                            color: ui.textPrimary,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <Pause size={12} /> Jeda
                        </button>
                      )}
                      {camp.status === 'paused' && (
                        <button
                          type="button"
                          onClick={() => handleModerateCampaign(camp.id, 'resume')}
                          disabled={busyActionId === `mod-${camp.id}`}
                          style={{
                            minHeight: '36px',
                            padding: '0.35rem 0.65rem',
                            borderRadius: '0.5rem',
                            border: 'none',
                            backgroundColor: '#059669',
                            color: '#ffffff',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <Play size={12} /> Aktifkan
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {campTotalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.35rem' }}>
                <button
                  type="button"
                  disabled={campPage <= 1}
                  onClick={() => {
                    const p = Math.max(1, campPage - 1);
                    setCampPage(p);
                    loadSponsoredOps(p, campStatusFilter, campQuery);
                  }}
                  style={{
                    minHeight: '38px',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '0.55rem',
                    border: `1px solid ${ui.border}`,
                    backgroundColor: ui.cardAlt,
                    color: ui.textPrimary,
                    fontSize: '0.74rem',
                    cursor: campPage <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Sebelumnya
                </button>
                <span style={{ fontSize: '0.74rem', color: ui.textSecondary }}>
                  Halaman {campPage} / {campTotalPages}
                </span>
                <button
                  type="button"
                  disabled={campPage >= campTotalPages}
                  onClick={() => {
                    const p = Math.min(campTotalPages, campPage + 1);
                    setCampPage(p);
                    loadSponsoredOps(p, campStatusFilter, campQuery);
                  }}
                  style={{
                    minHeight: '38px',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '0.55rem',
                    border: `1px solid ${ui.border}`,
                    backgroundColor: ui.cardAlt,
                    color: ui.textPrimary,
                    fontSize: '0.74rem',
                    cursor: campPage >= campTotalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  Berikutnya
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Proof Preview Modal (Compliant: backdrop tap + footer close button, no header X on mobile) */}
      {proofModal.open && (
        <div
          onClick={() => setProofModal({ open: false, url: '', title: '' })}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.72)',
            display: 'flex',
            alignItems: device === 'mobile' ? 'flex-end' : 'center',
            justifyContent: 'center',
            padding: device === 'mobile' ? 0 : '1rem',
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: device === 'mobile' ? '100%' : '520px',
              backgroundColor: ui.surface,
              borderRadius: device === 'mobile' ? '1rem 1rem 0 0' : '0.95rem',
              border: `1px solid ${ui.border}`,
              padding: '1.1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: ui.textPrimary }}>{proofModal.title}</div>
            {proofModal.error ? (
              <div style={{ fontSize: '0.8rem', color: '#ef4444' }}>{proofModal.error}</div>
            ) : proofModal.url ? (
              <img src={proofModal.url} alt={proofModal.title} style={{ width: '100%', borderRadius: '0.65rem', objectFit: 'contain', maxHeight: '55vh' }} />
            ) : (
              <div style={{ fontSize: '0.8rem', color: ui.textMuted }}>Memuat gambar bukti pembayaran...</div>
            )}
            <button
              type="button"
              onClick={() => setProofModal({ open: false, url: '', title: '' })}
              style={{
                minHeight: '44px',
                width: '100%',
                borderRadius: '0.65rem',
                border: `1px solid ${ui.border}`,
                backgroundColor: ui.cardAlt,
                color: ui.textPrimary,
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Tutup Pratinjau
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
