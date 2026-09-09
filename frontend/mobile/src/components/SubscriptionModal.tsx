import React, { useState, useEffect, useRef } from 'react';
import { 
  Crown, 
  Globe, 
  HardDrive, 
  Package, 
  Image as ImageIcon, 
  Film, 
  AlertTriangle, 
  LifeBuoy, 
  CheckCircle2, 
  Sparkles,
  ShieldCheck,
  Check,
  X,
  ChevronLeft,
  CreditCard,
  QrCode,
  Copy,
  Upload,
  Download,
  Receipt,
  Clock,
  RotateCcw,
  Infinity
} from 'lucide-react';

export interface SubscriptionPlanData {
  id: number;
  code: string;
  name: string;
  badge_label: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  storage_limit_bytes: number;
  max_items: number;
  max_images_per_item: number;
  has_custom_domain: boolean;
  has_verified_badge: boolean;
  has_priority_search: boolean;
  has_priority_support: boolean;
  sort_order?: number;
}

export interface StoreQuotaData {
  store_id: number;
  store_slug: string;
  store_title: string;
  plan: SubscriptionPlanData;
  next_plan?: SubscriptionPlanData | null;
  plan_status: string;
  plan_expires_at?: string | null;
  grace_period_until?: string | null;
  days_remaining: number;
  is_in_grace_period: boolean;
  active_items_count: number;
  archived_items_count: number;
  max_items: number;
  storage_used_bytes: number;
  storage_limit_bytes: number;
  storage_usage_percent: number;
  items_usage_percent: number;
  is_storage_over_limit: boolean;
  is_items_over_limit: boolean;
  custom_domain?: string | null;
  custom_domain_status: string;
  // Compatibility aliases
  plan_name?: string;
  max_active_products?: number;
  active_products_count?: number;
  archived_products_count?: number;
  max_images_per_product?: number;
}

export interface SubscriptionPageProps {
  quota?: StoreQuotaData | null;
  currentQuota?: StoreQuotaData | null;
  plans: SubscriptionPlanData[];
  settings?: any;
  onUpgradeOrRenew?: (planCode: string, durationMonths: number) => Promise<void>;
  onScheduleDowngrade?: (planCode: string) => Promise<void>;
  onUpdateDomain?: (domain: string) => Promise<void>;
  onSuccessUpgrade?: () => void;
  onBack?: () => void;
  activeView?: 'plans' | 'checkout' | 'downgrade_confirm' | 'orders';
  onViewChange?: (view: 'plans' | 'checkout' | 'downgrade_confirm' | 'orders') => void;
  apiBase?: string;
  token?: string | null;
  isLoading?: boolean;
}

export interface SubscriptionModalProps extends SubscriptionPageProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const getPlanLevel = (code?: string): number => {
  if (code === 'pro_business') return 3;
  if (code === 'pro_starter') return 2;
  return 1;
};

export const SubscriptionPage: React.FC<SubscriptionPageProps> = ({
  quota,
  currentQuota,
  plans,
  settings = {},
  onUpgradeOrRenew,
  onScheduleDowngrade,
  onUpdateDomain,
  onSuccessUpgrade,
  onBack,
  activeView,
  onViewChange,
  apiBase = 'http://localhost:8000/api',
  token,
  isLoading = false
}) => {
  const effectiveQuota = currentQuota || quota;
  const [modalView, setModalView] = useState<'plans' | 'checkout' | 'downgrade_confirm' | 'orders'>(activeView || 'plans');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedTargetPlan, setSelectedTargetPlan] = useState<SubscriptionPlanData | null>(null);
  const [checkoutType, setCheckoutType] = useState<'upgrade' | 'renewal'>('upgrade');

  // Sync external activeView changes
  useEffect(() => {
    if (activeView && activeView !== modalView) {
      setModalView(activeView);
    }
  }, [activeView]);

  const changeView = (nextView: 'plans' | 'checkout' | 'downgrade_confirm' | 'orders') => {
    setModalView(nextView);
    if (onViewChange) {
      onViewChange(nextView);
    }
  };

  // Checkout Form State
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'qris'>('bank');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [copiedAccountToast, setCopiedAccountToast] = useState(false);

  // Invoices / Orders State
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Action Feedback
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);

  useEffect(() => {
    if (!activeView) {
      setModalView('plans');
    }
    setActionSuccess(null);
    setActionError(null);
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponMsg(null);
    setPaymentProofUrl('');
    setProofPreview(null);
  }, []);

  const currentPlanCode = effectiveQuota?.plan?.code || 'free';

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 MB';
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  const formatRupiah = (amount: number): string => {
    if (amount === 0) return 'Gratis';
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  const openCheckout = (targetPlan: SubscriptionPlanData, type: 'upgrade' | 'renewal') => {
    setSelectedTargetPlan(targetPlan);
    setCheckoutType(type);
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponMsg(null);
    setPaymentProofUrl('');
    setProofPreview(null);
    setActionError(null);
    changeView('checkout');
  };

  const openDowngradeConfirm = (targetPlan: SubscriptionPlanData) => {
    setSelectedTargetPlan(targetPlan);
    setActionError(null);
    changeView('downgrade_confirm');
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch(`${apiBase}/subscription/orders`, {
        headers: {
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOrders(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch subscription orders', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setActionError('File bukti transfer harus berupa gambar (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setActionError('Ukuran file maksimal 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProofPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploadingProof(true);
    setActionError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${apiBase}/storage/upload`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success && data.data?.url) {
        setPaymentProofUrl(data.data.url);
      } else {
        setPaymentProofUrl(proofPreview || '');
      }
    } catch (err) {
      setPaymentProofUrl(proofPreview || '');
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleApplyCoupon = () => {
    const cleanCode = couponInput.trim().toUpperCase();
    if (!cleanCode) {
      setCouponMsg({ type: 'error', text: 'Masukkan kode kupon terlebih dahulu.' });
      return;
    }

    if (!selectedTargetPlan) return;

    const baseAmount = billingCycle === 'annual' ? selectedTargetPlan.price_annual : selectedTargetPlan.price_monthly;

    let masterCoupons = [];
    try {
      if (settings?.master_coupons) {
        masterCoupons = typeof settings.master_coupons === 'string' ? JSON.parse(settings.master_coupons) : settings.master_coupons;
      }
    } catch {}

    if (!masterCoupons || !masterCoupons.length) {
      masterCoupons = [
        { code: 'CATAVOR100', type: 'free', discount: baseAmount, label: 'Gratis 100% Seluruh Paket' },
        { code: 'GRATISPRO', type: 'free', discount: baseAmount, label: 'Gratis Uji Coba Paket Pro' },
        { code: 'DISKON50K', type: 'discount', discount: 50000, label: 'Potongan Harga Rp 50.000' },
        { code: 'DISKON10K', type: 'discount', discount: 10000, label: 'Potongan Harga Rp 10.000' }
      ];
    }

    const found = masterCoupons.find((c: any) => c.code.toUpperCase() === cleanCode);
    if (found) {
      setAppliedCoupon(found);
      setCouponMsg({ type: 'success', text: `Kupon "${found.code}" berhasil diterapkan! (${found.label || 'Diskon aktif'})` });
    } else {
      setCouponMsg({ type: 'error', text: `Kode kupon "${cleanCode}" tidak valid atau telah kedaluwarsa.` });
    }
  };

  const calculateFinalCheckoutPrice = () => {
    if (!selectedTargetPlan) return { originalPrice: 0, discountAmount: 0, finalPrice: 0 };

    const originalPrice = billingCycle === 'annual' ? selectedTargetPlan.price_annual : selectedTargetPlan.price_monthly;
    let discountAmount = 0;

    if (appliedCoupon) {
      if (appliedCoupon.type === 'free') {
        discountAmount = originalPrice;
      } else {
        discountAmount = appliedCoupon.discount || 0;
      }
    }

    if (discountAmount > originalPrice) discountAmount = originalPrice;
    const finalPrice = Math.max(0, originalPrice - discountAmount);

    return { originalPrice, discountAmount, finalPrice };
  };

  const handleProcessCheckout = async () => {
    if (!selectedTargetPlan) return;

    setActionError(null);
    setInternalLoading(true);

    const { finalPrice } = calculateFinalCheckoutPrice();

    if (finalPrice > 0 && !paymentProofUrl && !proofPreview) {
      setActionError('Mohon unggah bukti transfer pembayaran terlebih dahulu.');
      setInternalLoading(false);
      return;
    }

    try {
      const res = await fetch(`${apiBase}/subscription/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          plan_code: selectedTargetPlan.code,
          billing_cycle: billingCycle,
          coupon_code: appliedCoupon ? appliedCoupon.code : '',
          payment_method: finalPrice === 0 ? 'coupon_free' : paymentMethod,
          payment_proof_url: paymentProofUrl || proofPreview || '',
          type: checkoutType
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal memproses transaksi langganan.');
      }

      setActionSuccess(
        checkoutType === 'renewal'
          ? `Selamat! Paket ${selectedTargetPlan.name} berhasil diperpanjang.`
          : `Selamat! Katalog Anda kini telah aktif pada paket ${selectedTargetPlan.name}.`
      );
      setModalView('plans');
      if (onSuccessUpgrade) onSuccessUpgrade();
    } catch (err: any) {
      setActionError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setInternalLoading(false);
    }
  };

  const handleConfirmDowngrade = async () => {
    if (!selectedTargetPlan) return;

    setActionError(null);
    setInternalLoading(true);
    try {
      if (onScheduleDowngrade) {
        await onScheduleDowngrade(selectedTargetPlan.code);
      } else {
        const res = await fetch(`${apiBase}/subscription/schedule-downgrade`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ target_plan_code: selectedTargetPlan.code })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Gagal menjadwalkan penurunan paket.');
        }
      }

      setActionSuccess(`Perubahan ke paket ${selectedTargetPlan.name} berhasil dijadwalkan pada akhir periode langganan.`);
      setModalView('plans');
      if (onSuccessUpgrade) onSuccessUpgrade();
    } catch (err: any) {
      setActionError(err.message || 'Terjadi kesalahan saat menjadwalkan downgrade.');
    } finally {
      setInternalLoading(false);
    }
  };

  const handleCancelDowngradeSchedule = async () => {
    setActionError(null);
    setInternalLoading(true);
    try {
      const res = await fetch(`${apiBase}/subscription/cancel-downgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal membatalkan jadwal downgrade.');
      }

      setActionSuccess('Jadwal downgrade berhasil dibatalkan. Langganan Anda tetap berlanjut.');
      if (onSuccessUpgrade) onSuccessUpgrade();
    } catch (err: any) {
      setActionError(err.message || 'Gagal membatalkan jadwal downgrade.');
    } finally {
      setInternalLoading(false);
    }
  };

  const bankName = settings?.payment_bank_name || 'Bank Central Asia (BCA)';
  const bankAccount = settings?.payment_bank_account || '8830-1928-3920';
  const bankHolder = settings?.payment_bank_holder || 'PT Catavor Media Digital';
  const qrisImage = settings?.payment_qris_image || '/img/qris_demo.svg';

  return (
    <div 
      className="subscription-page-container animate-fade-in"
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        paddingBottom: '2.5rem'
      }}
    >
      {/* Top Segmented Navigation Tabs (Pilihan Paket vs Riwayat Tagihan) - Only displayed in Plans & Orders view */}
      {(modalView === 'plans' || modalView === 'orders') && (
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr',
            gap: '0.35rem',
            padding: '0.3rem', 
            background: 'var(--card-bg-gradient, var(--bg-card))',
            border: '1px solid var(--border-light)',
            borderRadius: '0.85rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
          }}
        >
          <button
            type="button"
            onClick={() => setModalView('plans')}
            style={{
              padding: '0.55rem 0.75rem',
              borderRadius: '0.65rem',
              border: modalView === 'plans' ? '1px solid var(--primary)' : '1px solid transparent',
              background: modalView === 'plans' ? 'var(--primary-glow)' : 'transparent',
              color: modalView === 'plans' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 800,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Crown size={16} />
            <span>Pilihan Paket</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchOrders();
              setModalView('orders');
            }}
            style={{
              padding: '0.55rem 0.75rem',
              borderRadius: '0.65rem',
              border: modalView === 'orders' ? '1px solid var(--primary)' : '1px solid transparent',
              background: modalView === 'orders' ? 'var(--primary-glow)' : 'transparent',
              color: modalView === 'orders' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 800,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Receipt size={16} />
            <span>Riwayat Tagihan</span>
          </button>
        </div>
      )}

      {/* Main Page Content Body */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}>
          {/* Action Success Toast */}
          {actionSuccess && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.6rem',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#10b981',
              fontSize: '0.8rem',
              fontWeight: 700
            }}>
              <CheckCircle2 size={16} />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Action Error Alert */}
          {actionError && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.6rem',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#ef4444',
              fontSize: '0.8rem',
              fontWeight: 700
            }}>
              <AlertTriangle size={16} />
              <span>{actionError}</span>
            </div>
          )}

          {/* Scheduled Downgrade Notice */}
          {modalView === 'plans' && effectiveQuota?.next_plan && (
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '0.75rem',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} style={{ color: '#d97706', flexShrink: 0 }} />
                <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                  Jadwal Turun Paket Aktif
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Katalog akan beralih ke <strong>{effectiveQuota.next_plan.name}</strong> setelah masa aktif saat ini berakhir.
              </p>
              <button
                type="button"
                disabled={internalLoading}
                onClick={handleCancelDowngradeSchedule}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: '0.25rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '0.45rem',
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid rgba(245, 158, 11, 0.5)',
                  color: '#d97706',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <RotateCcw size={13} />
                <span>Batalkan Penurunan Paket</span>
              </button>
            </div>
          )}

          {/* Grace Period Alert */}
          {modalView === 'plans' && quota?.is_in_grace_period && (
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '0.65rem',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(245, 158, 11, 0.18) 100%)',
              border: '1px solid rgba(239, 68, 68, 0.4)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <AlertTriangle size={17} style={{ color: '#ef4444' }} />
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Masa Tenggang Aktif (7 Hari)</strong>
              </div>
              <p style={{ margin: '0 0 0.65rem', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Masa langganan telah berakhir. Segera perpanjang agar produk katalog tidak diarsipkan otomatis.
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => openCheckout(quota.plan, 'renewal')}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  borderRadius: '0.45rem',
                  fontWeight: 800,
                  fontSize: '0.8rem'
                }}
              >
                Perpanjang Sekarang
              </button>
            </div>
          )}

          {/* VIEW 1: PLANS */}
          {modalView === 'plans' && (
            <>
              {/* Billing Cycle Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.3rem',
                background: 'var(--card-bg-gradient, var(--bg-card))',
                border: '1px solid var(--border-light)',
                borderRadius: '0.75rem',
                width: '100%'
              }}>
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.55rem',
                    border: 'none',
                    background: billingCycle === 'monthly' ? 'var(--primary)' : 'transparent',
                    color: billingCycle === 'monthly' ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: billingCycle === 'monthly' ? '0 2px 8px var(--primary-glow)' : 'none'
                  }}
                >
                  Bulanan
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  style={{
                    flex: 1.2,
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.55rem',
                    border: 'none',
                    background: billingCycle === 'annual' ? 'var(--primary)' : 'transparent',
                    color: billingCycle === 'annual' ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: billingCycle === 'annual' ? '0 2px 8px var(--primary-glow)' : 'none'
                  }}
                >
                  <span>Tahunan</span>
                  <span style={{
                    fontSize: '0.66rem',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '9999px',
                    background: billingCycle === 'annual' ? 'rgba(255,255,255,0.25)' : 'rgba(16, 185, 129, 0.15)',
                    color: billingCycle === 'annual' ? '#ffffff' : '#10b981',
                    fontWeight: 800
                  }}>
                    Hemat 20%
                  </span>
                </button>
              </div>

              {/* Plan Cards List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {plans.map((plan) => {
                  const isCurrent = currentPlanCode === plan.code;
                  const isProBusiness = plan.code === 'pro_business';
                  const isProStarter = plan.code === 'pro_starter';
                  const price = billingCycle === 'annual' ? plan.price_annual : plan.price_monthly;
                  const monthlyEquivalent = billingCycle === 'annual' ? Math.round(plan.price_annual / 12) : plan.price_monthly;

                  return (
                    <div
                      key={plan.code}
                      className="glass-panel"
                      style={{
                        padding: '1.1rem',
                        borderRadius: '0.95rem',
                        border: isCurrent ? '2px solid var(--primary)' : isProBusiness ? '1.5px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-light)',
                        background: isProBusiness ? 'linear-gradient(180deg, rgba(245, 158, 11, 0.05) 0%, var(--card-bg-gradient, var(--bg-card)) 100%)' : 'var(--card-bg-gradient, var(--bg-card))',
                        position: 'relative',
                        boxShadow: isCurrent ? '0 4px 16px var(--primary-glow)' : '0 2px 8px rgba(0,0,0,0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                      }}
                    >
                      {/* Top Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '0.5rem',
                            background: isProBusiness ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : isProStarter ? 'var(--primary)' : 'var(--bg-deep)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isProBusiness || isProStarter ? '#ffffff' : 'var(--text-secondary)'
                          }}>
                            {isProBusiness ? <Crown size={18} /> : isProStarter ? <Sparkles size={18} /> : <Package size={18} />}
                          </div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              {plan.name}
                            </h4>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                              {plan.badge_label || (plan.code === 'free' ? 'Pemula' : 'Bisnis')}
                            </span>
                          </div>
                        </div>

                        {isCurrent && (
                          <span style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '9999px',
                            background: 'var(--primary-glow)',
                            color: 'var(--primary)',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            border: '1px solid var(--primary)'
                          }}>
                            Aktif
                          </span>
                        )}
                      </div>

                      {/* Price Section */}
                      <div style={{ padding: '0.4rem 0', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                          <span style={{ fontSize: '1.3rem', fontWeight: 900, color: isProBusiness ? '#d97706' : 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                            {formatRupiah(price)}
                          </span>
                          {price > 0 && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              /{billingCycle === 'annual' ? 'tahun' : 'bulan'}
                            </span>
                          )}
                        </div>
                        {billingCycle === 'annual' && price > 0 && (
                          <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 700, display: 'block', marginTop: '0.1rem' }}>
                            Setara {formatRupiah(monthlyEquivalent)}/bulan (hemat 20%)
                          </span>
                        )}
                      </div>

                      {/* Quota Highlights */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.74rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
                          <Package size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span>Kapasitas: <strong>{plan.max_items === -1 ? 'Item Tak Terbatas' : `${plan.max_items} Item Produk`}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
                          <HardDrive size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span>Penyimpanan Media: <strong>{formatBytes(plan.storage_limit_bytes)}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
                          <ImageIcon size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span>Foto per Item: <strong>{plan.max_images_per_item === -1 ? 'Tak Terbatas' : `Hingga ${plan.max_images_per_item} Foto`}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: plan.has_custom_domain ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          <Globe size={13} style={{ color: plan.has_custom_domain ? '#10b981' : 'var(--text-muted)', flexShrink: 0 }} />
                          <span>Domain Kustom Sendiri (.com/.id): <strong>{plan.has_custom_domain ? 'Didukung' : 'Tidak Tersedia'}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: plan.has_verified_badge ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          <ShieldCheck size={13} style={{ color: plan.has_verified_badge ? '#3b82f6' : 'var(--text-muted)', flexShrink: 0 }} />
                          <span>Badge Katalog Terverifikasi: <strong>{plan.has_verified_badge ? 'Ya (Centang Biru)' : 'Tidak'}</strong></span>
                        </div>
                      </div>

                      {/* Action CTA Button */}
                      {isCurrent ? (
                        plan.code !== 'free' ? (
                          <button
                            type="button"
                            disabled={isLoading || internalLoading}
                            onClick={() => openCheckout(plan, 'renewal')}
                            className="btn-primary"
                            style={{
                              width: '100%',
                              padding: '0.65rem',
                              borderRadius: '0.55rem',
                              fontWeight: 800,
                              fontSize: '0.82rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.35rem',
                              cursor: 'pointer'
                            }}
                          >
                            <RotateCcw size={14} />
                            <span>Perpanjang Masa Aktif</span>
                          </button>
                        ) : (
                          <div style={{
                            width: '100%',
                            padding: '0.6rem',
                            borderRadius: '0.55rem',
                            background: 'var(--btn-secondary-bg)',
                            color: 'var(--btn-secondary-text)',
                            border: '1px solid var(--btn-secondary-border)',
                            fontWeight: 800,
                            fontSize: '0.78rem',
                            textAlign: 'center'
                          }}>
                            ✓ Paket Aktif Saat Ini
                          </div>
                        )
                      ) : getPlanLevel(plan.code) > getPlanLevel(currentPlanCode) ? (
                        <button
                          type="button"
                          disabled={isLoading || internalLoading}
                          onClick={() => openCheckout(plan, 'upgrade')}
                          className="btn-primary"
                          style={{
                            width: '100%',
                            padding: '0.65rem',
                            borderRadius: '0.55rem',
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            cursor: 'pointer',
                            background: isProBusiness ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : undefined,
                            boxShadow: isProBusiness ? '0 4px 14px rgba(245, 158, 11, 0.35)' : undefined
                          }}
                        >
                          <Sparkles size={14} />
                          <span>⚡ Upgrade ke {plan.name}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isLoading || internalLoading}
                          onClick={() => openDowngradeConfirm(plan)}
                          className="btn-secondary"
                          style={{
                            width: '100%',
                            padding: '0.65rem',
                            borderRadius: '0.55rem',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                        >
                          Jadwalkan Turun ke {plan.name}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* VIEW 2: CHECKOUT */}
          {modalView === 'checkout' && selectedTargetPlan && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              
              {/* 1. Selected Plan Banner Card */}
              <div 
                className="glass-panel" 
                style={{
                  padding: '1.1rem',
                  borderRadius: '0.85rem',
                  background: 'var(--card-bg-gradient, var(--bg-card))',
                  border: '1px solid var(--border-light)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem'
                }}
              >
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '0.75rem',
                  background: selectedTargetPlan.code === 'pro_business' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: selectedTargetPlan.code === 'pro_business' ? '0 4px 12px rgba(245, 158, 11, 0.35)' : '0 4px 12px var(--primary-glow)',
                  flexShrink: 0
                }}>
                  <Crown size={22} />
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      {selectedTargetPlan.name}
                    </h3>
                    <span style={{ 
                      fontSize: '0.68rem', 
                      fontWeight: 800, 
                      color: selectedTargetPlan.code === 'pro_business' ? '#d97706' : 'var(--primary)',
                      background: selectedTargetPlan.code === 'pro_business' ? 'rgba(245, 158, 11, 0.12)' : 'var(--primary-glow)',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '9999px',
                      border: '1px solid var(--border-light)'
                    }}>
                      {checkoutType === 'renewal' ? 'PERPANJANGAN' : 'UPGRADE'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    Durasi: {billingCycle === 'annual' ? '12 Bulan (Tahunan Diskon 20%)' : '1 Bulan (Bulanan)'}
                  </span>
                </div>
              </div>

              {/* 2. Price Breakdown & Order Summary */}
              {(() => {
                const { originalPrice, discountAmount, finalPrice } = calculateFinalCheckoutPrice();

                return (
                  <div 
                    className="glass-panel" 
                    style={{
                      padding: '1.1rem',
                      borderRadius: '0.85rem',
                      background: 'var(--card-bg-gradient, var(--bg-card))',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.15rem' }}>
                      <Receipt size={14} style={{ color: 'var(--primary)' }} />
                      <span>Rincian Biaya Tagihan</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span>Harga Paket:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>Rp {originalPrice.toLocaleString('id-ID')}</strong>
                    </div>

                    {discountAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.4rem 0.6rem', borderRadius: '0.5rem', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <CheckCircle2 size={13} />
                          <span>Kupon ({appliedCoupon?.code}):</span>
                        </span>
                        <strong>- Rp {discountAmount.toLocaleString('id-ID')}</strong>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <span>Biaya Layanan &amp; Verifikasi:</span>
                      <span style={{ color: '#10b981', fontWeight: 700 }}>Gratis</span>
                    </div>

                    <div style={{
                      borderTop: '1px dashed var(--border-light)',
                      paddingTop: '0.75rem',
                      marginTop: '0.2rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)', display: 'block' }}>Total Pembayaran:</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Termasuk aktivasi instan</span>
                      </div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 900, color: finalPrice === 0 ? '#10b981' : 'var(--primary)', letterSpacing: '-0.02em' }}>
                        Rp {finalPrice.toLocaleString('id-ID')}
                        {finalPrice === 0 && <span style={{ fontSize: '0.72rem', color: '#10b981', marginLeft: '0.35rem' }}>(100% GRATIS)</span>}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 3. Kupon Diskon Voucher */}
              <div 
                className="glass-panel" 
                style={{
                  padding: '1rem 1.1rem',
                  borderRadius: '0.85rem',
                  background: 'var(--card-bg-gradient, var(--bg-card))',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)'
                }}
              >
                <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Sparkles size={14} style={{ color: 'var(--primary)' }} />
                  <span>Punya Kode Kupon Promo?</span>
                </label>
                <div style={{ display: 'flex', gap: '0.45rem' }}>
                  <input
                    type="text"
                    placeholder="Contoh: CATAVOR100, DISKON10K"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      if (couponMsg) setCouponMsg(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '0.55rem 0.75rem',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      borderRadius: '0.6rem',
                      background: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="btn-primary"
                    style={{
                      padding: '0.55rem 0.9rem',
                      borderRadius: '0.6rem',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Terapkan
                  </button>
                </div>
                {couponMsg && (
                  <div style={{ 
                    fontSize: '0.74rem', 
                    color: couponMsg.type === 'success' ? '#10b981' : '#ef4444', 
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    marginTop: '0.15rem'
                  }}>
                    {couponMsg.type === 'success' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                    <span>{couponMsg.text}</span>
                  </div>
                )}
              </div>

              {/* 4. Payment Method & Instructions */}
              {(() => {
                const { finalPrice } = calculateFinalCheckoutPrice();

                if (finalPrice === 0) {
                  return (
                    <button
                      type="button"
                      disabled={internalLoading}
                      onClick={handleProcessCheckout}
                      className="btn-primary"
                      style={{
                        width: '100%',
                        padding: '0.85rem',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        borderRadius: '0.75rem',
                        marginTop: '0.35rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px var(--primary-glow)'
                      }}
                    >
                      {internalLoading ? 'Mengaktifkan...' : '⚡ Aktifkan Paket Gratis Sekarang'}
                    </button>
                  );
                }

                return (
                  <div 
                    className="glass-panel" 
                    style={{
                      padding: '1.1rem',
                      borderRadius: '0.85rem',
                      background: 'var(--card-bg-gradient, var(--bg-card))',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)'
                    }}
                  >
                    <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)', display: 'block' }}>
                      Pilih Metode Pembayaran
                    </label>

                    {/* Method Switcher Tabs */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('bank')}
                        style={{
                          padding: '0.65rem 0.5rem',
                          borderRadius: '0.65rem',
                          border: paymentMethod === 'bank' ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                          background: paymentMethod === 'bank' ? 'var(--primary-glow)' : 'var(--bg-deep)',
                          color: paymentMethod === 'bank' ? 'var(--primary)' : 'var(--text-secondary)',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.45rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <CreditCard size={15} />
                        <span>Transfer Bank</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('qris')}
                        style={{
                          padding: '0.65rem 0.5rem',
                          borderRadius: '0.65rem',
                          border: paymentMethod === 'qris' ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                          background: paymentMethod === 'qris' ? 'var(--primary-glow)' : 'var(--bg-deep)',
                          color: paymentMethod === 'qris' ? 'var(--primary)' : 'var(--text-secondary)',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.45rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <QrCode size={15} />
                        <span>Scan QRIS</span>
                      </button>
                    </div>

                    {/* Bank Transfer Info Box */}
                    {paymentMethod === 'bank' && (
                      <div style={{ 
                        padding: '1rem', 
                        borderRadius: '0.75rem', 
                        background: 'var(--bg-deep)', 
                        border: '1px solid var(--border-light)', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '0.75rem', 
                        fontSize: '0.78rem' 
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Tujuan Bank:</span>
                          <strong style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.84rem' }}>{bankName}</strong>
                        </div>
                        
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          background: 'var(--bg-card)', 
                          padding: '0.65rem 0.85rem', 
                          borderRadius: '0.6rem', 
                          border: '1px solid var(--border-light)' 
                        }}>
                          <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nomor Rekening:</div>
                            <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontFamily: 'monospace', letterSpacing: '0.04em' }}>{bankAccount}</strong>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(bankAccount.replace(/[^0-9]/g, ''));
                              setCopiedAccountToast(true);
                              setTimeout(() => setCopiedAccountToast(false), 2000);
                            }}
                            style={{
                              padding: '0.35rem 0.75rem',
                              borderRadius: '0.5rem',
                              background: copiedAccountToast ? '#10b981' : 'var(--primary)',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {copiedAccountToast ? <Check size={12} strokeWidth={3} /> : <Copy size={12} />}
                            <span>{copiedAccountToast ? 'Tersalin!' : 'Salin'}</span>
                          </button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Atas Nama Rekening:</span>
                          <strong style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{bankHolder}</strong>
                        </div>
                      </div>
                    )}

                    {/* QRIS Info Box */}
                    {paymentMethod === 'qris' && (
                      <div style={{ 
                        padding: '1.25rem 1rem', 
                        borderRadius: '0.75rem', 
                        background: 'var(--bg-deep)', 
                        border: '1px solid var(--border-light)', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        gap: '0.75rem', 
                        textAlign: 'center' 
                      }}>
                        <div style={{ width: '150px', height: '150px', borderRadius: '12px', background: '#ffffff', padding: '8px', border: '2px solid var(--primary)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                          <img src={qrisImage} alt="QRIS" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          Mendukung <strong>GoPay, OVO, BCA Mobile, Dana, LinkAja, &amp; ShopeePay</strong>
                        </span>
                      </div>
                    )}

                    {/* Proof Upload Dropzone */}
                    <div>
                      <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: '0.45rem' }}>
                        Unggah Bukti Transfer: <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <label style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        padding: '1rem',
                        borderRadius: '0.75rem',
                        border: '2px dashed var(--border-light)',
                        background: 'var(--bg-deep)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}>
                        <input type="file" accept="image/*" onChange={handleProofUpload} style={{ display: 'none' }} />
                        {proofPreview ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <img src={proofPreview} alt="Bukti" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-light)' }} />
                            <div style={{ textAlign: 'left' }}>
                              <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 800, display: 'block' }}>✓ Foto Bukti Dipilih</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--primary)', textDecoration: 'underline' }}>Klik untuk mengganti foto</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <Upload size={22} style={{ color: 'var(--primary)' }} />
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {isUploadingProof ? 'Mengunggah...' : 'Klik untuk Unggah Struk / Screenshot'}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Format JPG, PNG, WebP (Maks. 5MB)</span>
                          </>
                        )}
                      </label>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="button"
                      disabled={internalLoading || isUploadingProof}
                      onClick={handleProcessCheckout}
                      className="btn-primary"
                      style={{
                        width: '100%',
                        padding: '0.85rem',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        borderRadius: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        marginTop: '0.25rem',
                        boxShadow: '0 4px 16px var(--primary-glow)'
                      }}
                    >
                      <Sparkles size={16} />
                      <span>{internalLoading ? 'Memproses Transaksi...' : `Konfirmasi Pembayaran (Rp ${finalPrice.toLocaleString('id-ID')})`}</span>
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* VIEW 3: DOWNGRADE CONFIRMATION */}
          {modalView === 'downgrade_confirm' && selectedTargetPlan && (
            <div 
              className="glass-panel"
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1.25rem', 
                textAlign: 'center', 
                padding: '1.5rem 1.25rem',
                borderRadius: '0.85rem',
                background: 'var(--card-bg-gradient, var(--bg-card))',
                border: '1px solid var(--border-light)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)'
              }}
            >
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '2px solid #f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                color: '#f59e0b',
                boxShadow: '0 0 20px rgba(245, 158, 11, 0.25)'
              }}>
                <AlertTriangle size={28} />
              </div>

              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.45rem' }}>
                  Jadwalkan Turun ke {selectedTargetPlan.name}?
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Paket aktif Anda tidak langsung diputus. Masa aktif saat ini (<strong>{effectiveQuota?.days_remaining || 0} hari</strong>) tetap berjalan penuh sampai tanggal kedaluwarsa.
                </p>
              </div>

              {/* Guarantees Checklist Card */}
              <div style={{
                background: 'var(--bg-deep)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.75rem',
                padding: '1rem',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                fontSize: '0.78rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem' }}>
                  <Check size={16} strokeWidth={2.5} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ color: 'var(--text-primary)' }}>Sisa hari aktif (<strong>{effectiveQuota?.days_remaining || 0} hari</strong>) tidak akan hangus.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem' }}>
                  <Check size={16} strokeWidth={2.5} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ color: 'var(--text-primary)' }}>Seluruh katalog produk &amp; data Anda tetap tersimpan aman (diarsipkan tanpa hapus data).</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem' }}>
                  <Check size={16} strokeWidth={2.5} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ color: 'var(--text-primary)' }}>Penjadwalan penurunan ini dapat Anda batalkan sewaktu-waktu.</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '0.65rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => setModalView('plans')}
                  className="btn-secondary"
                  style={{ padding: '0.75rem', borderRadius: '0.65rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={internalLoading}
                  onClick={handleConfirmDowngrade}
                  className="btn-primary"
                  style={{ 
                    padding: '0.75rem', 
                    borderRadius: '0.65rem', 
                    fontSize: '0.82rem', 
                    fontWeight: 800, 
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                    cursor: 'pointer'
                  }}
                >
                  {internalLoading ? 'Menjadwalkan...' : 'Konfirmasi Jadwal'}
                </button>
              </div>
            </div>
          )}

          {/* VIEW 4: ORDERS HISTORY */}
          {modalView === 'orders' && (
            <div>
              {loadingOrders ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Memuat riwayat transaksi...
                </div>
              ) : orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Belum ada riwayat transaksi langganan.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {orders.map((ord: any) => (
                    <div
                      key={ord.id || ord.order_number}
                      style={{
                        padding: '0.85rem',
                        borderRadius: '0.65rem',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.76rem'
                      }}
                    >
                      <div>
                        <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{ord.order_number}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                          {ord.plan_code} ({ord.billing_cycle}) • {new Date(ord.created_at).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ color: 'var(--primary)', fontSize: '0.88rem' }}>
                          Rp {ord.final_amount?.toLocaleString('id-ID')}
                        </strong>
                        <span style={{ display: 'block', fontSize: '0.68rem', color: ord.payment_status === 'paid' ? '#10b981' : '#f59e0b' }}>
                          {ord.payment_status === 'paid' ? 'LUNAS' : ord.payment_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
    </div>
  );
};

export const SubscriptionModal: React.FC<SubscriptionModalProps> = (props) => {
  if (props.isOpen === false) return null;
  return <SubscriptionPage {...props} onBack={props.onClose} />;
};

export const MobileQuotaWidget: React.FC<{
  quota: StoreQuotaData | null;
  onOpenUpgrade: () => void;
}> = ({ quota, onOpenUpgrade }) => {
  if (!quota) return null;

  const planName = quota.plan?.name || 'Gratis Terbatas';
  const isFree = quota.plan?.code === 'free';
  const isUnlimited = quota.max_items === -1;

  const formatStorage = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 MB';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return gb % 1 === 0 ? `${gb.toFixed(0)} GB` : `${gb.toFixed(1)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return mb % 1 === 0 ? `${mb.toFixed(0)} MB` : `${mb.toFixed(1)} MB`;
  };

  return (
    <div style={{
      padding: '0.85rem 1.05rem',
      borderRadius: '0.85rem',
      background: 'var(--card-bg, var(--bg-card, rgba(255, 255, 255, 0.03)))',
      border: '1px solid var(--border-light)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      margin: '0 0 0.5rem 0'
    }}>
      {/* Top row: Plan Identity & CTA Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            background: isFree ? 'var(--primary-glow)' : 'rgba(245, 158, 11, 0.15)',
            border: isFree ? '1px solid var(--border-light)' : '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isFree ? 'var(--primary)' : '#f59e0b',
            flexShrink: 0
          }}>
            <Crown size={14} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
            <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {planName}
            </strong>
            {quota.plan?.has_verified_badge && (
              <span style={{
                fontSize: '0.58rem',
                fontWeight: 900,
                padding: '1px 5px',
                borderRadius: '3px',
                background: 'var(--primary)',
                color: '#ffffff',
                lineHeight: 1.3,
                flexShrink: 0
              }}>
                PRO
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenUpgrade}
          className={isFree ? "btn-primary" : "btn-secondary"}
          style={{
            padding: '0.3rem 0.75rem',
            borderRadius: '0.45rem',
            fontSize: '0.74rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}
        >
          {isFree ? '⚡ Upgrade' : 'Kelola Paket'}
        </button>
      </div>

      {/* Metrics Row: 2 Clean Balanced Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
        {/* Metric 1: Produk */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.74rem', gap: '0.35rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Produk</span>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '2px', flexShrink: 0 }}>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 800 }}>
                {quota.active_items_count.toLocaleString('id-ID')}
              </strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>
                / {isUnlimited ? '∞' : quota.max_items.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
          <div style={{ height: '5px', borderRadius: '3px', background: 'var(--border-light, rgba(0,0,0,0.06))', overflow: 'hidden' }}>
            {isUnlimited ? (
              <div style={{
                height: '100%',
                width: '100%',
                background: 'var(--primary)',
                borderRadius: '3px',
                opacity: 0.85
              }} />
            ) : (
              <div style={{
                height: '100%',
                width: `${Math.min(quota.items_usage_percent, 100)}%`,
                background: quota.is_items_over_limit ? '#ef4444' : quota.items_usage_percent > 85 ? '#f59e0b' : 'var(--primary)',
                borderRadius: '3px',
                transition: 'width 0.3s ease'
              }} />
            )}
          </div>
        </div>

        {/* Metric 2: Storage */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.74rem', gap: '0.35rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Storage</span>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '2px', flexShrink: 0 }}>
              <strong style={{ color: quota.is_storage_over_limit ? '#ef4444' : 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 800 }}>
                {formatStorage(quota.storage_used_bytes)}
              </strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>
                / {formatStorage(quota.storage_limit_bytes)}
              </span>
            </div>
          </div>
          <div style={{ height: '5px', borderRadius: '3px', background: 'var(--border-light, rgba(0,0,0,0.06))', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(quota.storage_usage_percent, 100)}%`,
              background: quota.is_storage_over_limit ? '#ef4444' : quota.storage_usage_percent > 85 ? '#f59e0b' : 'var(--primary)',
              borderRadius: '3px',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      </div>
    </div>
  );
};
