import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  Sparkles, 
  ShieldCheck, 
  Crown, 
  Globe, 
  HardDrive, 
  Package, 
  Image as ImageIcon, 
  Film, 
  Clock, 
  AlertTriangle, 
  LifeBuoy, 
  CheckCircle2, 
  ArrowRight,
  ChevronLeft,
  CreditCard,
  QrCode,
  Copy,
  Upload,
  Download,
  Receipt,
  FileText,
  HelpCircle,
  Zap,
  Calendar,
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
  // Aliases for compatibility
  plan_name?: string;
  max_active_products?: number;
  active_products_count?: number;
  archived_products_count?: number;
  max_images_per_product?: number;
}

export interface SubscriptionModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onBack?: () => void;
  isPage?: boolean;
  quota?: StoreQuotaData | null;
  currentQuota?: StoreQuotaData | null;
  plans: SubscriptionPlanData[];
  settings?: any;
  onUpgradeOrRenew?: (planCode: string, durationMonths: number) => Promise<void>;
  onScheduleDowngrade?: (planCode: string) => Promise<void>;
  onUpdateDomain?: (domain: string) => Promise<void>;
  onSuccessUpgrade?: () => void;
  apiBase?: string;
  token?: string | null;
  isLoading?: boolean;
}

export const getPlanLevel = (code?: string): number => {
  if (code === 'pro_business') return 3;
  if (code === 'pro_starter') return 2;
  return 1;
};

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen = true,
  onClose,
  onBack,
  isPage = false,
  quota,
  currentQuota,
  plans,
  settings = {},
  onUpgradeOrRenew,
  onScheduleDowngrade,
  onUpdateDomain,
  onSuccessUpgrade,
  apiBase = 'http://localhost:8000/api',
  token,
  isLoading = false
}) => {
  const effectiveQuota = currentQuota || quota;
  const [modalView, setModalView] = useState<'plans' | 'checkout' | 'downgrade_confirm' | 'orders'>('plans');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedTargetPlan, setSelectedTargetPlan] = useState<SubscriptionPlanData | null>(null);
  const [checkoutType, setCheckoutType] = useState<'upgrade' | 'renewal'>('upgrade');
  
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
    if (isOpen) {
      setModalView('plans');
      setActionSuccess(null);
      setActionError(null);
      setAppliedCoupon(null);
      setCouponInput('');
      setCouponMsg(null);
      setPaymentProofUrl('');
      setProofPreview(null);
    }
  }, [isOpen]);

  if (!isOpen && !isPage) return null;

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
    setModalView('checkout');
    setActionSuccess(null);
    setActionError(null);
  };

  const openDowngradeConfirm = (targetPlan: SubscriptionPlanData) => {
    setSelectedTargetPlan(targetPlan);
    setModalView('downgrade_confirm');
    setActionSuccess(null);
    setActionError(null);
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponMsg(null);
    try {
      const res = await fetch(`${apiBase}/subscription/verify-coupon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ code: couponInput.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAppliedCoupon(data.coupon);
        setCouponMsg({ type: 'success', text: `Kupon "${data.coupon.code}" aktif! Diskon ${data.coupon.discount_percent}% diterapkan.` });
      } else {
        setAppliedCoupon(null);
        setCouponMsg({ type: 'error', text: data.message || 'Kode promo/kupon tidak valid atau telah kedaluwarsa.' });
      }
    } catch (err) {
      setAppliedCoupon(null);
      setCouponMsg({ type: 'error', text: 'Gagal memverifikasi kupon. Periksa koneksi internet.' });
    }
  };

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setActionError('Ukuran file maksimal bukti transfer adalah 5 MB.');
      return;
    }

    setIsUploadingProof(true);
    setActionError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('folder', 'subscription_proofs');

      const res = await fetch(`${apiBase}/upload`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success && data.url) {
        setPaymentProofUrl(data.url);
        setProofPreview(URL.createObjectURL(file));
      } else {
        throw new Error(data.message || 'Gagal mengupload bukti pembayaran.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Gagal mengupload gambar bukti transfer.');
    } finally {
      setIsUploadingProof(false);
    }
  };

  const calculateFinalPrice = (plan: SubscriptionPlanData, cycle: 'monthly' | 'annual') => {
    const originalPrice = cycle === 'monthly' ? plan.price_monthly : (plan.price_annual > 0 ? plan.price_annual : plan.price_monthly * 12);
    let discountPercent = 0;

    if (appliedCoupon && appliedCoupon.discount_percent) {
      discountPercent = appliedCoupon.discount_percent;
    }

    const discountAmount = Math.round((originalPrice * discountPercent) / 100);
    const finalAmount = Math.max(0, originalPrice - discountAmount);

    return { originalPrice, discountPercent, discountAmount, finalAmount };
  };

  const calculateFinalCheckoutPrice = () => {
    if (!selectedTargetPlan) return { originalPrice: 0, discountPercent: 0, discountAmount: 0, finalPrice: 0 };
    const { originalPrice, discountPercent, discountAmount, finalAmount } = calculateFinalPrice(selectedTargetPlan, billingCycle);
    return { originalPrice, discountPercent, discountAmount, finalPrice: finalAmount };
  };

  const handleSubmitOrder = async () => {
    if (!selectedTargetPlan) return;
    if (!paymentProofUrl) {
      setActionError('Harap upload bukti transfer pembayaran sebelum mengirim pesanan.');
      return;
    }

    setActionError(null);
    setInternalLoading(true);

    try {
      const durationMonths = billingCycle === 'monthly' ? 1 : 12;
      const calc = calculateFinalPrice(selectedTargetPlan, billingCycle);

      const res = await fetch(`${apiBase}/subscription/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          plan_code: selectedTargetPlan.code,
          order_type: checkoutType,
          duration_months: durationMonths,
          billing_cycle: billingCycle,
          payment_method: paymentMethod,
          payment_proof_url: paymentProofUrl,
          coupon_code: appliedCoupon?.code || undefined,
          notes: `Checkout ${checkoutType} ke ${selectedTargetPlan.name} (${billingCycle}) via Web Dashboard`
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal mengirim konfirmasi pembayaran.');
      }

      setActionSuccess(`Pesanan #${data.order?.invoice_number || ''} berhasil dibuat! Admin akan memverifikasi bukti transfer Anda segera.`);
      setModalView('orders');
      fetchOrders();
      if (onSuccessUpgrade) onSuccessUpgrade();
    } catch (err: any) {
      setActionError(err.message || 'Gagal memproses pesanan.');
    } finally {
      setInternalLoading(false);
    }
  };

  const handleProcessCheckout = handleSubmitOrder;

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
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed fetching subscription orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleConfirmDowngrade = async () => {
    if (!selectedTargetPlan) return;
    setActionError(null);
    setInternalLoading(true);

    try {
      const res = await fetch(`${apiBase}/subscription/downgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          target_plan_code: selectedTargetPlan.code
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menjadwalkan penurunan paket.');
      }

      setActionSuccess(data.message || 'Jadwal penurunan paket berhasil disimpan.');
      setModalView('plans');
      if (onSuccessUpgrade) onSuccessUpgrade();
    } catch (err: any) {
      setActionError(err.message || 'Gagal memproses penurunan paket.');
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

  const innerModalContent = (
    <div style={{
      backgroundColor: 'var(--bg-card, #0f172a)',
      border: '1px solid var(--border-light, rgba(255,255,255,0.1))',
      borderRadius: '1.25rem',
      maxWidth: isPage ? '100%' : (modalView === 'plans' ? '1120px' : '880px'),
      width: '100%',
      maxHeight: isPage ? 'none' : '90vh',
      overflowY: isPage ? 'visible' : 'auto',
      boxShadow: isPage ? '0 8px 30px rgba(0,0,0,0.15)' : '0 25px 60px rgba(0,0,0,0.6)',
      color: 'var(--text-primary, #ffffff)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'max-width 0.3s ease'
    }}>
      {/* Header */}
      <div style={{
        padding: '1.25rem 2rem',
        borderBottom: '1px solid var(--border-light, rgba(255,255,255,0.1))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {modalView !== 'plans' && (
            <button
              type="button"
              onClick={() => setModalView('plans')}
              style={{
                background: 'var(--btn-secondary-bg)',
                border: '1px solid var(--btn-secondary-border)',
                color: 'var(--btn-secondary-text)',
                borderRadius: '0.5rem',
                padding: '0.35rem 0.65rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <ChevronLeft size={16} />
              <span>Kembali</span>
            </button>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Crown size={20} style={{ color: 'var(--primary, #3b82f6)' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                {modalView === 'plans' && 'Paket & Langganan Toko'}
                {modalView === 'checkout' && (checkoutType === 'renewal' ? 'Checkout Perpanjangan Paket' : `Upgrade ke ${selectedTargetPlan?.name}`)}
                {modalView === 'downgrade_confirm' && 'Konfirmasi Penjadwalan Penurunan Paket'}
                {modalView === 'orders' && 'Riwayat Tagihan & Transaksi Langganan'}
              </h2>
            </div>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)' }}>
              {modalView === 'plans' && 'Pilih paket sesuai skala bisnis. Tingkatkan kuota produk, kapasitas storage, & fitur domain kustom.'}
              {modalView === 'checkout' && 'Selesaikan pembayaran untuk mengaktifkan kapasitas dan fitur eksklusif paket pilihan Anda.'}
              {modalView === 'downgrade_confirm' && 'Pelajari rincian perlindungan masa aktif dan penyesuaian kuota katalog Anda.'}
              {modalView === 'orders' && 'Daftar invoice, status pembayaran, dan riwayat aktivasi paket toko Anda.'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {modalView === 'plans' && (
            <button
              type="button"
              onClick={() => {
                fetchOrders();
                setModalView('orders');
              }}
              style={{
                background: 'var(--btn-secondary-bg)',
                border: '1px solid var(--btn-secondary-border)',
                color: 'var(--btn-secondary-text)',
                borderRadius: '0.55rem',
                padding: '0.45rem 0.85rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer'
              }}
            >
              <Receipt size={15} />
              <span>Riwayat Tagihan</span>
            </button>
          )}

          {!isPage && onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                color: 'var(--text-secondary, #94a3b8)',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

        {/* Action Success Toast */}
        {actionSuccess && (
          <div style={{
            margin: '1rem 2rem 0',
            padding: '0.85rem 1.25rem',
            borderRadius: '0.75rem',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            color: '#10b981',
            fontSize: '0.86rem',
            fontWeight: 700
          }}>
            <CheckCircle2 size={18} />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Action Error Alert */}
        {actionError && (
          <div style={{
            margin: '1rem 2rem 0',
            padding: '0.85rem 1.25rem',
            borderRadius: '0.75rem',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            color: '#ef4444',
            fontSize: '0.86rem',
            fontWeight: 700
          }}>
            <AlertTriangle size={18} />
            <span>{actionError}</span>
          </div>
        )}

        {/* Scheduled Downgrade Notice in Plans View */}
        {modalView === 'plans' && effectiveQuota?.next_plan && (
          <div style={{
            margin: '1rem 2rem 0',
            padding: '1rem 1.35rem',
            borderRadius: '0.75rem',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <Clock size={22} style={{ color: '#d97706', flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                  Jadwal Penurunan Paket Aktif ({effectiveQuota.next_plan.name})
                </strong>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Paket Anda akan berganti ke {effectiveQuota.next_plan.name} saat periode masa aktif saat ini berakhir.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={internalLoading}
              onClick={handleCancelDowngradeSchedule}
              style={{
                padding: '0.5rem 1.15rem',
                borderRadius: '0.55rem',
                background: 'var(--bg-card)',
                border: '1px solid rgba(245, 158, 11, 0.5)',
                color: 'var(--text-primary)',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
              }}
            >
              <RotateCcw size={14} style={{ color: '#d97706' }} />
              <span>{internalLoading ? 'Memproses...' : 'Batalkan Jadwal'}</span>
            </button>
          </div>
        )}

        {/* Grace Period Alert */}
        {modalView === 'plans' && quota?.is_in_grace_period && (
          <div style={{
            margin: '1rem 2rem 0',
            padding: '1rem 1.25rem',
            borderRadius: '0.75rem',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(245, 158, 11, 0.18) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <AlertTriangle size={24} style={{ color: '#ef4444', flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>Akun Dalam Masa Tenggang (Grace Period 7 Hari)</strong>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Masa aktif langganan Anda telah berakhir. Segera lakukan perpanjangan agar katalog Anda tidak diarsipkan otomatis.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openCheckout(quota.plan, 'renewal')}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '0.5rem',
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                fontSize: '0.84rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Perpanjang Sekarang
            </button>
          </div>
        )}

        {/* VIEW 1: PLANS GRID */}
        {modalView === 'plans' && (
          <>
            {/* Billing Cycle Switcher */}
            <div style={{
              padding: '1.25rem 2rem 0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--btn-secondary-bg)',
                padding: '4px',
                borderRadius: '0.65rem',
                border: '1px solid var(--btn-secondary-border)'
              }}>
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  style={{
                    padding: '0.45rem 1.25rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    border: 'none',
                    background: billingCycle === 'monthly' ? 'var(--primary)' : 'transparent',
                    color: billingCycle === 'monthly' ? 'var(--btn-primary-text, #ffffff)' : 'var(--btn-secondary-text)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Tagihan Bulanan
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  style={{
                    padding: '0.45rem 1.25rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    border: 'none',
                    background: billingCycle === 'annual' ? 'var(--primary)' : 'transparent',
                    color: billingCycle === 'annual' ? 'var(--btn-primary-text, #ffffff)' : 'var(--btn-secondary-text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>Tagihan Tahunan</span>
                  <span style={{ fontSize: '0.68rem', background: '#10b981', color: '#ffffff', padding: '1px 6px', borderRadius: '4px', fontWeight: 900 }}>Hemat 20%</span>
                </button>
              </div>
            </div>

            {/* Plans Grid */}
            <div style={{
              padding: '1.25rem 2rem 2.5rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
              gap: '1.5rem',
              alignItems: 'stretch'
            }}>
              {plans.map((plan) => {
                const isCurrent = plan.code === currentPlanCode;
                const isProBusiness = plan.code === 'pro_business';
                const price = billingCycle === 'annual' ? (plan.price_annual / 12) : plan.price_monthly;

                return (
                  <div
                    key={plan.code}
                    style={{
                      borderRadius: '1rem',
                      padding: '1.5rem',
                      backgroundColor: isCurrent ? 'var(--primary-glow, rgba(16, 185, 129, 0.08))' : 'var(--card-bg, rgba(255, 255, 255, 0.02))',
                      border: isCurrent ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                      boxShadow: isCurrent ? '0 10px 30px var(--primary-glow)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                      transition: 'all 0.25s ease'
                    }}
                  >
                    {/* Top Badge */}
                    {isProBusiness && (
                      <div style={{
                        position: 'absolute',
                        top: '-12px',
                        right: '1.25rem',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: '#000000',
                        fontSize: '0.68rem',
                        fontWeight: 900,
                        padding: '2px 10px',
                        borderRadius: '20px',
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)'
                      }}>
                        ★ REKOMENDASI UTAMA
                      </div>
                    )}

                    <div>
                      {/* Plan Name & Active Tag */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                            {plan.name}
                          </h3>
                          {plan.has_verified_badge && (
                            <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#3b82f6', color: '#fff' }}>
                              ✓ Verified
                            </span>
                          )}
                        </div>
                        {isCurrent && (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'var(--primary)',
                            color: 'var(--btn-primary-text, #ffffff)'
                          }}>
                            Paket Aktif
                          </span>
                        )}
                      </div>

                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem', minHeight: '36px', lineHeight: 1.45 }}>
                        {plan.description}
                      </p>

                      {/* Price */}
                      <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                          <span style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                            {formatRupiah(price)}
                          </span>
                          {plan.price_monthly > 0 && (
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                              /bulan
                            </span>
                          )}
                        </div>
                        {billingCycle === 'annual' && plan.price_annual > 0 && (
                          <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 700 }}>
                            Ditagih tahunan Rp {plan.price_annual.toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>

                      {/* Feature Checklist */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                        borderTop: '1px solid var(--border-light)',
                        paddingTop: '1.25rem',
                        marginBottom: '1.5rem',
                        fontSize: '0.82rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                          <Package size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span><strong>{plan.max_items === -1 ? 'Unlimited' : `${plan.max_items}`}</strong> Item Produk Aktif</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                          <HardDrive size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span><strong>{formatBytes(plan.storage_limit_bytes)}</strong> Kuota Cloud Storage</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                          <ImageIcon size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span>Maks. <strong>{plan.max_images_per_item}</strong> Foto per Item</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                          <Film size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span>Video Embed Bebas Kuota (YouTube, Reels, TikTok)</span>
                        </div>

                        {plan.has_verified_badge && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                            <ShieldCheck size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                            <span>Lencana Toko Terverifikasi (Centang Biru)</span>
                          </div>
                        )}

                        {plan.has_custom_domain && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                            <Globe size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                            <span><strong>Custom Domain Sendiri</strong> (toko.com)</span>
                          </div>
                        )}

                        {plan.has_priority_support && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                            <LifeBuoy size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                            <span>Prioritas Bantuan VIP Support Khusus</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action CTA Button */}
                    <div>
                      {isCurrent ? (
                        plan.code !== 'free' ? (
                          <button
                            type="button"
                            disabled={isLoading || internalLoading}
                            onClick={() => openCheckout(plan, 'renewal')}
                            className="btn-primary"
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              borderRadius: '0.55rem',
                              fontWeight: 800,
                              fontSize: '0.86rem',
                              cursor: 'pointer'
                            }}
                          >
                            Perpanjang Paket Ini
                          </button>
                        ) : (
                          <div style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '0.55rem',
                            background: 'var(--btn-secondary-bg)',
                            color: 'var(--btn-secondary-text)',
                            border: '1px solid var(--btn-secondary-border)',
                            fontWeight: 800,
                            fontSize: '0.84rem',
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
                            padding: '0.75rem',
                            borderRadius: '0.55rem',
                            fontWeight: 800,
                            fontSize: '0.86rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            background: isProBusiness ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : undefined
                          }}
                        >
                          <Sparkles size={16} />
                          <span>Upgrade ke {plan.name}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isLoading || internalLoading}
                          onClick={() => openDowngradeConfirm(plan)}
                          className="btn-secondary"
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '0.55rem',
                            fontWeight: 800,
                            fontSize: '0.84rem',
                            cursor: 'pointer'
                          }}
                        >
                          Pilih di Akhir Periode
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* VIEW 2: CHECKOUT (BAYAR & AKTIFKAN) */}
        {modalView === 'checkout' && selectedTargetPlan && (
          <div style={{ padding: '1.75rem 2rem 2.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '1.75rem', alignItems: 'start' }}>
              {/* Left Column: Order Summary & Coupon */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-light)',
                borderRadius: '1rem',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>Ringkasan Tagihan</span>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'var(--primary-glow)',
                    color: 'var(--primary)',
                    border: '1px solid var(--border-light)'
                  }}>
                    {checkoutType === 'renewal' ? 'PERPANJANGAN' : 'UPGRADE'}
                  </span>
                </div>

                {/* Plan Info Card */}
                <div style={{
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  background: 'var(--btn-secondary-bg)',
                  border: '1px solid var(--btn-secondary-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '0.5rem',
                    background: selectedTargetPlan.code === 'pro_business' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    flexShrink: 0
                  }}>
                    <Crown size={22} />
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block' }}>{selectedTargetPlan.name}</strong>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Durasi: {billingCycle === 'annual' ? '12 Bulan (Tahunan)' : '1 Bulan'}
                    </span>
                  </div>
                </div>

                {/* Calculations */}
                {(() => {
                  const { originalPrice, discountAmount, finalPrice } = calculateFinalCheckoutPrice();

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Harga Paket:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>Rp {originalPrice.toLocaleString('id-ID')}</strong>
                      </div>

                      {discountAmount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.45rem 0.65rem', borderRadius: '0.45rem', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                          <span>Diskon Kupon ({appliedCoupon?.code}):</span>
                          <strong>- Rp {discountAmount.toLocaleString('id-ID')}</strong>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Biaya Transaksi / Admin:</span>
                        <span style={{ color: '#10b981', fontWeight: 700 }}>Rp 0 (Gratis)</span>
                      </div>

                      <div style={{
                        borderTop: '1px dashed var(--border-light)',
                        paddingTop: '0.85rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline'
                      }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>Total Pembayaran:</span>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: finalPrice === 0 ? '#10b981' : 'var(--primary)' }}>
                          Rp {finalPrice.toLocaleString('id-ID')}
                          {finalPrice === 0 && <span style={{ fontSize: '0.74rem', color: '#10b981', marginLeft: '0.35rem' }}>(100% GRATIS)</span>}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Coupon Code Input */}
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'block' }}>
                    Punya Kode Kupon / Diskon?
                  </label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
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
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.8rem',
                        borderRadius: '0.5rem',
                        background: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        textTransform: 'uppercase'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      style={{
                        padding: '0.5rem 0.85rem',
                        borderRadius: '0.5rem',
                        background: 'var(--primary-glow)',
                        border: '1px solid var(--primary)',
                        color: 'var(--primary)',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      Terapkan
                    </button>
                  </div>
                  {couponMsg && (
                    <div style={{
                      fontSize: '0.74rem',
                      color: couponMsg.type === 'success' ? '#10b981' : '#ef4444',
                      marginTop: '0.4rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}>
                      {couponMsg.type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
                      <span>{couponMsg.text}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Payment Instructions & Proof Upload */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-light)',
                borderRadius: '1rem',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem'
              }}>
                {(() => {
                  const { finalPrice } = calculateFinalCheckoutPrice();

                  if (finalPrice === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Sparkles size={32} style={{ color: '#10b981' }} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 0.4rem' }}>
                            Aktivasi Langganan 100% Bebas Biaya!
                          </h3>
                          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                            Kupon diskon Anda menanggung penuh biaya paket. Tidak perlu melakukan transfer pembayaran.
                          </p>
                        </div>
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
                            borderRadius: '0.65rem',
                            marginTop: '0.5rem',
                            cursor: 'pointer'
                          }}
                        >
                          {internalLoading ? 'Mengaktifkan Paket...' : '⚡ Aktifkan Paket Sekarang'}
                        </button>
                      </div>
                    );
                  }

                  return (
                    <>
                      {/* Payment Method Selector */}
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          Pilih Metode Pembayaran:
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('bank')}
                            style={{
                              padding: '0.65rem 0.5rem',
                              borderRadius: '0.6rem',
                              border: paymentMethod === 'bank' ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                              backgroundColor: paymentMethod === 'bank' ? 'var(--primary-glow)' : 'transparent',
                              color: paymentMethod === 'bank' ? 'var(--text-primary)' : 'var(--text-muted)',
                              fontWeight: 800,
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.4rem',
                              cursor: 'pointer'
                            }}
                          >
                            <CreditCard size={16} style={{ color: paymentMethod === 'bank' ? 'var(--primary)' : 'currentColor' }} />
                            <span>Transfer Bank</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPaymentMethod('qris')}
                            style={{
                              padding: '0.65rem 0.5rem',
                              borderRadius: '0.6rem',
                              border: paymentMethod === 'qris' ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                              backgroundColor: paymentMethod === 'qris' ? 'var(--primary-glow)' : 'transparent',
                              color: paymentMethod === 'qris' ? 'var(--text-primary)' : 'var(--text-muted)',
                              fontWeight: 800,
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.4rem',
                              cursor: 'pointer'
                            }}
                          >
                            <QrCode size={16} style={{ color: paymentMethod === 'qris' ? 'var(--primary)' : 'currentColor' }} />
                            <span>Scan QRIS</span>
                          </button>
                        </div>
                      </div>

                      {/* Bank Details */}
                      {paymentMethod === 'bank' && (
                        <div style={{
                          padding: '1rem',
                          borderRadius: '0.75rem',
                          background: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Bank Tujuan:</span>
                            <strong style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{bankName}</strong>
                          </div>

                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--bg-card)',
                            padding: '0.6rem 0.85rem',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--border-light)'
                          }}>
                            <div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Nomor Rekening:</div>
                              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>{bankAccount}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(bankAccount.replace(/[^0-9]/g, ''));
                                setCopiedAccountToast(true);
                                setTimeout(() => setCopiedAccountToast(false), 2500);
                              }}
                              style={{
                                padding: '0.4rem 0.75rem',
                                borderRadius: '0.4rem',
                                backgroundColor: copiedAccountToast ? '#10b981' : 'var(--primary-glow)',
                                border: '1px solid var(--primary)',
                                color: copiedAccountToast ? '#000' : 'var(--primary)',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              {copiedAccountToast ? <Check size={13} /> : <Copy size={13} />}
                              <span>{copiedAccountToast ? 'Tersalin!' : 'Salin Rekening'}</span>
                            </button>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Atas Nama Rekening:</span>
                            <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{bankHolder}</strong>
                          </div>
                        </div>
                      )}

                      {/* QRIS Details */}
                      {paymentMethod === 'qris' && (
                        <div style={{
                          padding: '1rem',
                          borderRadius: '0.75rem',
                          background: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.75rem',
                          textAlign: 'center'
                        }}>
                          <div style={{
                            width: '160px',
                            height: '160px',
                            borderRadius: '12px',
                            background: '#ffffff',
                            padding: '8px',
                            border: '2px solid var(--primary)'
                          }}>
                            <img
                              src={qrisImage}
                              alt="QRIS Catavor"
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                          </div>
                          <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0 }}>
                            Buka BCA, Mandiri, BRI, BNI, GoPay, OVO, DANA, atau ShopeePay dan scan kode QRIS di atas.
                          </p>
                          <a
                            href={qrisImage}
                            download="QRIS_Catavor_Payment.svg"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.4rem 0.85rem',
                              borderRadius: '0.4rem',
                              backgroundColor: 'var(--btn-secondary-bg)',
                              border: '1px solid var(--btn-secondary-border)',
                              color: 'var(--btn-secondary-text)',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              textDecoration: 'none'
                            }}
                          >
                            <Download size={13} />
                            <span>Unduh Gambar QRIS</span>
                          </a>
                        </div>
                      )}

                      {/* Upload Proof */}
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'block' }}>
                          Unggah Bukti Transfer: <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <label style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '1rem',
                          borderRadius: '0.65rem',
                          border: '2px dashed var(--border-light)',
                          background: 'var(--bg-deep)',
                          cursor: 'pointer',
                          gap: '0.4rem'
                        }}>
                          <input type="file" accept="image/*" onChange={handleProofUpload} style={{ display: 'none' }} />
                          {proofPreview ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <img src={proofPreview} alt="Bukti" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px' }} />
                              <div style={{ textAlign: 'left' }}>
                                <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700, display: 'block' }}>
                                  ✓ Bukti Berhasil Dipilih
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Klik untuk mengganti gambar</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Upload size={20} style={{ color: 'var(--primary)' }} />
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {isUploadingProof ? 'Mengunggah...' : 'Klik untuk Pilih File Foto / Struk'}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Format JPG, PNG, atau WebP (Maks. 5MB)</span>
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
                          borderRadius: '0.65rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.45rem'
                        }}
                      >
                        <Sparkles size={16} />
                        <span>{internalLoading ? 'Memproses Aktivasi...' : 'Bayar & Aktifkan Paket'}</span>
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: DOWNGRADE CONFIRMATION DIALOG */}
        {modalView === 'downgrade_confirm' && selectedTargetPlan && (
          <div style={{ padding: '2rem 2.5rem 2.5rem', maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '2px solid #f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              color: '#f59e0b'
            }}>
              <AlertTriangle size={30} />
            </div>

            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
              Jadwalkan Turun ke Paket {selectedTargetPlan.name}?
            </h3>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem', lineHeight: 1.55 }}>
              Paket aktif Anda saat ini tidak akan langsung diputus. Anda tetap dapat menikmati seluruh fitur paket saat ini sampai masa langganan berakhir.
            </p>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-light)',
              borderRadius: '0.85rem',
              padding: '1.25rem',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              marginBottom: '1.75rem',
              fontSize: '0.82rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                <Check size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Sisa Hari Aman:</strong> Sisa masa aktif Anda ({effectiveQuota?.days_remaining || 0} hari) tidak akan hangus dan tetap aktif 100%.</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                <Check size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Proteksi Produk Katalog:</strong> Produk yang melebihi kuota {selectedTargetPlan.name} ({selectedTargetPlan.max_items === -1 ? 'Unlimited' : selectedTargetPlan.max_items} item) akan tetap tersimpan aman di database dan diarsipkan secara otomatis tanpa kehilangan data.</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                <Check size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Bisa Dibatalkan Kapan Saja:</strong> Anda dapat membatalkan jadwal penurunan paket ini kapan saja sebelum masa aktif berakhir.</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.85rem' }}>
              <button
                type="button"
                onClick={() => setModalView('plans')}
                className="btn-secondary"
                style={{ flex: 1, padding: '0.75rem', borderRadius: '0.55rem', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer' }}
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={internalLoading}
                onClick={handleConfirmDowngrade}
                className="btn-primary"
                style={{
                  flex: 1.3,
                  padding: '0.75rem',
                  borderRadius: '0.55rem',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  cursor: 'pointer'
                }}
              >
                {internalLoading ? 'Menjadwalkan...' : 'Konfirmasi Jadwalkan Downgrade'}
              </button>
            </div>
          </div>
        )}

        {/* VIEW 4: ORDER HISTORY / RIWAYAT TAGIHAN */}
        {modalView === 'orders' && (
          <div style={{ padding: '1.5rem 2rem 2.5rem' }}>
            {loadingOrders ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                Memuat riwayat transaksi langganan...
              </div>
            ) : orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}>
                <Receipt size={36} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Belum Ada Riwayat Transaksi</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Transaksi invoice dan bukti pembayaran langganan Anda akan tercatat di sini.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {orders.map((ord: any) => (
                  <div
                    key={ord.id || ord.order_number}
                    style={{
                      padding: '1.15rem 1.25rem',
                      borderRadius: '0.85rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{ord.order_number}</strong>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: ord.payment_status === 'paid' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: ord.payment_status === 'paid' ? '#10b981' : '#f59e0b',
                          border: '1px solid currentColor'
                        }}>
                          {ord.payment_status === 'paid' ? 'LUNAS / AKTIF' : ord.payment_status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Paket: <strong style={{ color: 'var(--text-primary)' }}>{ord.plan_code}</strong> ({ord.billing_cycle}) • Tanggal: {new Date(ord.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                        Rp {ord.final_amount?.toLocaleString('id-ID')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Metode: {ord.payment_method?.toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
    </div>
  );

  if (isPage) {
    return (
      <div style={{
        width: '100%',
        maxWidth: modalView === 'plans' ? '1240px' : '960px',
        margin: '0 auto',
        padding: '0.25rem 0 3rem',
        animation: 'fadeIn 0.25s ease',
        transition: 'max-width 0.3s ease'
      }}>
        {innerModalContent}
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.82)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      padding: '1.25rem'
    }}>
      {innerModalContent}
    </div>
  );
};

export const SubscriptionPage: React.FC<Omit<SubscriptionModalProps, 'isOpen'> & { isOpen?: boolean }> = (props) => {
  return <SubscriptionModal {...props} isOpen={true} isPage={true} />;
};

export const QuotaDashboardWidget: React.FC<{
  quota: StoreQuotaData | null;
  onOpenUpgrade: () => void;
}> = ({ quota, onOpenUpgrade }) => {
  if (!quota) return null;

  const planName = quota.plan?.name || 'Gratis Terbatas';
  const isFree = quota.plan?.code === 'free';
  const isUnlimited = quota.max_items === -1;

  const formatStorageShort = (bytes: number): string => {
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
      padding: '1.25rem 1.5rem',
      borderRadius: '1rem',
      background: 'var(--card-bg, var(--bg-card, rgba(255, 255, 255, 0.03)))',
      border: '1px solid var(--border-light)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      {/* Top row: Plan Badge & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '0.6rem',
            background: isFree ? 'var(--btn-secondary-bg, rgba(255,255,255,0.06))' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isFree ? 'var(--text-secondary)' : '#ffffff'
          }}>
            <Crown size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <strong style={{ fontSize: '0.98rem', color: 'var(--text-primary)' }}>{planName}</strong>
              {quota.plan?.has_verified_badge && (
                <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: '#3b82f6', color: '#fff' }}>
                  ✓ Terverifikasi
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              {isFree ? 'Katalog digital esensial kuota 15 item' : (quota.days_remaining > 0 ? `Sisa masa aktif: ${quota.days_remaining} hari` : 'Perlu diperpanjang')}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenUpgrade}
          className={isFree ? "btn-primary" : "btn-secondary"}
          style={{
            padding: '0.45rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.82rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          {isFree ? <Sparkles size={14} /> : null}
          <span>{isFree ? '⚡ Upgrade ke Pro' : 'Kelola Langganan'}</span>
        </button>
      </div>

      {/* Progress Bars (Items & Storage) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', paddingTop: '0.25rem' }}>
        {/* Items Quota */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
              <Package size={14} style={{ color: 'var(--primary)' }} /> Kuota Produk Aktif
            </span>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '3px' }}>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 800 }}>
                {quota.active_items_count.toLocaleString('id-ID')}
              </strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
                / {isUnlimited ? '∞' : `${quota.max_items.toLocaleString('id-ID')} Item`}
              </span>
            </div>
          </div>
          <div style={{ height: '6px', borderRadius: '3px', background: 'var(--border-light, rgba(0,0,0,0.06))', overflow: 'hidden' }}>
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
                background: quota.is_items_over_limit ? '#ef4444' : quota.items_usage_percent > 80 ? '#f59e0b' : 'var(--primary)',
                borderRadius: '3px',
                transition: 'width 0.3s ease'
              }} />
            )}
          </div>
        </div>

        {/* Storage Quota */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
              <HardDrive size={14} style={{ color: 'var(--primary)' }} /> Cloud Storage
            </span>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '3px' }}>
              <strong style={{ color: quota.is_storage_over_limit ? '#ef4444' : 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 800 }}>
                {formatStorageShort(quota.storage_used_bytes)}
              </strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
                / {formatStorageShort(quota.storage_limit_bytes)}
              </span>
            </div>
          </div>
          <div style={{ height: '6px', borderRadius: '3px', background: 'var(--border-light, rgba(0,0,0,0.06))', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(quota.storage_usage_percent, 100)}%`,
              background: quota.is_storage_over_limit ? '#ef4444' : quota.storage_usage_percent > 80 ? '#f59e0b' : 'var(--primary)',
              borderRadius: '3px',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      </div>
    </div>
  );
};
