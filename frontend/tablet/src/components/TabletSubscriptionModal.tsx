import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Sparkles,
  ShieldCheck,
  Crown,
  HardDrive,
  Package,
  CheckCircle2,
  ArrowRight,
  ChevronLeft,
  CreditCard,
  QrCode,
  Copy,
  Calendar,
  Zap,
  Check,
  AlertTriangle,
  Receipt,
  Archive,
  ShieldAlert,
  Upload,
  Download,
  ExternalLink,
  Tag
} from 'lucide-react';
import { createAuthFetch } from '../utils/auth';
import { useModalBackHandler } from '../utils/navigation';
import { SafeImage } from './SafeImage';

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
  is_storage_over_limit?: boolean;
  is_items_over_limit?: boolean;
  custom_domain?: string | null;
  custom_domain_status: string;
}

export interface TabletSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  storeSlug: string;
  currentQuota?: StoreQuotaData | null;
  settings?: any;
  onSuccessUpgrade?: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onLogout?: () => void;
  onUnauthorized?: (msg?: string) => void;
}

export const TabletSubscriptionModal: React.FC<TabletSubscriptionModalProps> = ({
  isOpen,
  onClose,
  token,
  storeSlug,
  currentQuota,
  settings,
  onSuccessUpgrade,
  showToast,
  onLogout,
  onUnauthorized
}) => {
  useModalBackHandler({
    isOpen,
    onClose,
    modalId: 'tablet-subscription-modal'
  });

  // Centralized authenticated fetch with automatic 401/403 session eviction
  const fetch = useMemo(() => {
    return createAuthFetch({
      getToken: () => token,
      onUnauthorized: (msg) => {
        if (onUnauthorized) {
          onUnauthorized(msg);
        } else if (onLogout) {
          onLogout();
        }
      }
    });
  }, [token, onUnauthorized, onLogout]);

  const [plans, setPlans] = useState<SubscriptionPlanData[]>([]);
  const [platformSettings, setPlatformSettings] = useState<any>(settings || {});
  const [loading, setLoading] = useState<boolean>(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>('pro_starter');
  
  // Checkout & Payment step
  const [checkoutStep, setCheckoutStep] = useState<'plan_select' | 'payment_detail'>('plan_select');
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'bank'>('qris');
  const [aulaaChannel, setAulaaChannel] = useState<'qris' | 'va' | 'ewallet' | 'cc'>('qris');
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [orderInvoice, setOrderInvoice] = useState<any | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);

  // Manual payment inputs
  const [senderAccountName, setSenderAccountName] = useState<string>('');
  const [senderPhone, setSenderPhone] = useState<string>('');
  const [paymentProofUrl, setPaymentProofUrl] = useState<string>('');
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState<boolean>(false);

  // Coupon promo state
  const [couponCode, setCouponCode] = useState<string>('');
  const [couponValidating, setCouponValidating] = useState<boolean>(false);
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccessMsg, setCouponSuccessMsg] = useState<string | null>(null);

  // Load plans from API
  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/subscription/plans');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setPlans(json.data);
        }
      }
    } catch {
      showToast('Gagal memuat daftar paket langganan', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Load platform payment settings
  const fetchPlatformSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/public');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setPlatformSettings(json.data);
        }
      }
    } catch (err) {
      console.error('Failed fetching platform settings in tablet modal:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
      fetchPlatformSettings();
      setCheckoutStep('plan_select');
      setOrderInvoice(null);
      setPaymentProofUrl('');
      setProofPreview(null);
      setSenderAccountName('');
      setSenderPhone('');
      setCouponCode('');
      setAppliedCoupon(null);
      setCouponError(null);
      setCouponSuccessMsg(null);
      setAulaaChannel('qris');

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const planParam = params.get('plan');
        if (planParam && (planParam === 'pro_starter' || planParam === 'pro_business')) {
          setSelectedPlanCode(planParam);
          setCheckoutStep('payment_detail');
          const url = new URL(window.location.href);
          url.searchParams.delete('plan');
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
        }
      }
    }
  }, [isOpen, fetchPlans, fetchPlatformSettings]);

  // Back button interception
  useEffect(() => {
    if (!isOpen) return;
    const handlePopState = () => {
      if (checkoutStep === 'payment_detail') {
        setCheckoutStep('plan_select');
      } else {
        onClose();
      }
    };
    window.history.pushState({ modal: 'tablet_subscription' }, '');
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, checkoutStep, onClose]);

  if (!isOpen) return null;

  const selectedPlan = plans.find(p => p.code === selectedPlanCode) || plans[1] || plans[0];
  const months = billingCycle === 'annual' ? 12 : 1;
  const unitPrice = billingCycle === 'annual' ? (selectedPlan?.price_annual || 0) : (selectedPlan?.price_monthly || 0);
  const totalPrice = unitPrice * months;

  // Calculate discount from applied coupon
  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'free') {
      discountAmount = totalPrice;
    } else if (appliedCoupon.discount !== undefined && appliedCoupon.discount !== null) {
      discountAmount = Number(appliedCoupon.discount) || 0;
    } else if (appliedCoupon.discount_amount !== undefined && appliedCoupon.discount_amount !== null) {
      discountAmount = Number(appliedCoupon.discount_amount) || 0;
    } else if (appliedCoupon.discount_value !== undefined && appliedCoupon.discount_value !== null) {
      discountAmount = Number(appliedCoupon.discount_value) || 0;
    } else if (appliedCoupon.discount_percent !== undefined && appliedCoupon.discount_percent !== null) {
      discountAmount = Math.round((totalPrice * Number(appliedCoupon.discount_percent)) / 100);
    } else if (appliedCoupon.discount_type === 'percentage') {
      discountAmount = Math.round((totalPrice * (appliedCoupon.discount_value || 0)) / 100);
      if (appliedCoupon.max_discount && appliedCoupon.max_discount > 0) {
        discountAmount = Math.min(discountAmount, appliedCoupon.max_discount);
      }
    }
  }
  if (discountAmount > totalPrice) {
    discountAmount = totalPrice;
  }
  const finalPrice = Math.max(0, totalPrice - discountAmount);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponValidating(true);
    setCouponError(null);
    setCouponSuccessMsg(null);
    try {
      const res = await fetch('/api/subscription/verify-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode.trim(),
          plan_code: selectedPlan?.code || '',
          billing_cycle: billingCycle,
          amount: totalPrice
        })
      });
      const data = await res.json();
      const couponObj = data.coupon || data.data;
      if (res.ok && (data.success || data.valid) && couponObj) {
        setAppliedCoupon(couponObj);
        const discountVal = Number(couponObj.discount || couponObj.discount_amount || couponObj.discount_value || 0);
        const discountLabel = couponObj.type === 'free' ? 'Gratis 100%' : `Potongan Rp ${discountVal.toLocaleString('id-ID')}`;
        setCouponSuccessMsg(couponObj.label || couponObj.description || `Kupon ${couponObj.code} berhasil diterapkan! (${discountLabel})`);
        showToast('Kupon promo berhasil diterapkan!', 'success');
      } else {
        setCouponError(data.message || 'Kupon tidak valid atau sudah kedaluwarsa');
        setAppliedCoupon(null);
      }
    } catch {
      setCouponError('Gagal memverifikasi kupon. Periksa koneksi internet.');
    } finally {
      setCouponValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError(null);
    setCouponSuccessMsg(null);
  };

  const systemPaymentMode = (platformSettings?.payment_system_mode || 'gateway_aulaa').toLowerCase();
  const isMaintenance = systemPaymentMode === 'maintenance';
  const maintenanceTitle = platformSettings?.payment_maintenance_title || 'Sistem Pembayaran Dalam Pemeliharaan';
  const maintenanceMessage = platformSettings?.payment_maintenance_message || 'Layanan transaksi pembayaran sedang dalam masa pemeliharaan berkala untuk peningkatan keandalan jaringan. Silakan hubungi admin atau coba beberapa saat lagi.';
  const manualQrisMerchant = platformSettings?.payment_qris_manual_merchant || 'Catavor Official Store';
  const manualQrisImage = platformSettings?.payment_qris_manual_image || platformSettings?.payment_qris_image || '/img/qris_demo.svg';
  const bankName = platformSettings?.payment_bank_name || 'Bank Central Asia (BCA)';
  const bankAccount = platformSettings?.payment_bank_account || '8830-1928-3920';
  const bankHolder = platformSettings?.payment_bank_holder || 'PT Catavor Media Digital';

  const handleProceedToPayment = () => {
    if (selectedPlan?.code === 'free') {
      showToast('Anda sudah berada pada paket Gratis atau pilih paket Pro', 'error');
      return;
    }
    setCheckoutStep('payment_detail');
  };

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran file maksimal bukti transfer adalah 5 MB.', 'error');
      return;
    }

    setIsUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('category', 'billing');

      const res = await fetch('/api/storage/upload?category=billing', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success && data.url) {
        setPaymentProofUrl(data.url);
        setProofPreview(URL.createObjectURL(file));
        showToast('Bukti transfer berhasil diunggah', 'success');
      } else {
        throw new Error(data.message || 'Gagal mengupload bukti pembayaran.');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal mengunggah berkas bukti pembayaran.', 'error');
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!token || !selectedPlan) return;

    if (isMaintenance) {
      showToast('Sistem pembayaran sedang dalam masa pemeliharaan.', 'error');
      return;
    }

    const isGateway = systemPaymentMode === 'gateway_aulaa';

    if (finalPrice > 0 && !isGateway && !paymentProofUrl) {
      showToast('Harap unggah bukti transfer pembayaran terlebih dahulu', 'error');
      return;
    }

    if (finalPrice > 0 && systemPaymentMode === 'manual_qris' && !senderAccountName.trim()) {
      showToast('Harap cantumkan nama akun pengirim untuk verifikasi mutasi', 'error');
      return;
    }

    const orderPaymentMode = finalPrice === 0
      ? 'coupon_free'
      : isGateway 
        ? 'gateway_aulaa' 
        : systemPaymentMode === 'manual_qris' 
          ? 'manual_qris' 
          : 'manual_bank';

    const orderPaymentMethod = finalPrice === 0
      ? 'coupon_free'
      : isGateway
        ? aulaaChannel
        : paymentMethod;

    setSubmittingOrder(true);
    try {
      const res = await fetch('/api/subscription/order', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': storeSlug,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan_code: selectedPlan.code,
          duration_months: months,
          billing_cycle: billingCycle,
          payment_method: orderPaymentMethod,
          payment_mode: orderPaymentMode,
          sender_account_name: senderAccountName.trim(),
          sender_phone: senderPhone.trim(),
          payment_proof_url: (finalPrice === 0 || isGateway) ? '' : paymentProofUrl,
          coupon_code: appliedCoupon ? appliedCoupon.code : '',
          redirect_url: window.location.href,
          type: 'upgrade',
          order_type: 'upgrade'
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const ord = json.data || json.order;
        if (ord?.gateway_payment_link) {
          window.location.href = ord.gateway_payment_link;
          return;
        }
        if (isGateway && finalPrice > 0) {
          showToast('Gagal mendapatkan tautan pembayaran Aulaa. Saluran pembayaran sedang tidak tersedia atau hubungi admin.', 'error');
          return;
        }
        setOrderInvoice(ord);
        showToast('Pesanan langganan berhasil dibuat!', 'success');
        if (onSuccessUpgrade) onSuccessUpgrade();
      } else {
        showToast(json.message || 'Gagal memproses pesanan langganan', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat memproses pesanan', 'error');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
    showToast('Nomor rekening/nominal disalin ke clipboard');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      boxSizing: 'border-box'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '1.25rem',
        border: '1px solid var(--border-light)',
        width: '100%',
        maxWidth: '880px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-deep)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {checkoutStep === 'payment_detail' && (
              <button
                type="button"
                onClick={() => setCheckoutStep('plan_select')}
                style={{
                  minHeight: '44px',
                  minWidth: '44px',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                {checkoutStep === 'plan_select' ? 'Upgrade & Kelola Paket Langganan' : 'Konfirmasi & Instruksi Pembayaran'}
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                {checkoutStep === 'plan_select'
                  ? 'Tingkatkan kuota produk dan kapasitas penyimpanan media toko Anda'
                  : 'Selesaikan transaksi untuk mengaktifkan paket secara otomatis'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              minHeight: '44px',
              minWidth: '44px',
              borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.75rem' }}>
          {checkoutStep === 'plan_select' ? (
            <div>
              {/* Billing Cycle Switcher */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                marginBottom: '1.75rem'
              }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.45rem 1.25rem',
                  backgroundColor: 'var(--bg-deep)',
                  borderRadius: '999px',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 700
                }}>
                  <Calendar size={15} style={{ color: 'var(--primary)' }} />
                  <span>Tagihan Bulanan (1 Bulan)</span>
                </div>
              </div>

              {/* Plans Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                {plans.map(p => {
                  const isSelected = selectedPlanCode === p.code;
                  const isCurrent = currentQuota?.plan?.code === p.code;
                  const price = billingCycle === 'annual' ? p.price_annual : p.price_monthly;
                  const storageMB = Math.round(p.storage_limit_bytes / (1024 * 1024));

                  return (
                    <div
                      key={p.code}
                      onClick={() => setSelectedPlanCode(p.code)}
                      style={{
                        borderRadius: '1rem',
                        border: isSelected
                          ? '2px solid var(--primary)'
                          : '1px solid var(--border-light)',
                        backgroundColor: isSelected ? 'rgba(30, 58, 138, 0.08)' : 'var(--bg-deep)',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {p.badge_label && (
                        <div style={{
                          position: 'absolute',
                          top: '-10px',
                          right: '12px',
                          backgroundColor: p.code === 'pro_business' ? '#a855f7' : 'var(--primary)',
                          color: '#ffffff',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '0.15rem 0.55rem',
                          borderRadius: '999px',
                          textTransform: 'uppercase'
                        }}>
                          {p.badge_label}
                        </div>
                      )}

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                            {p.name}
                          </h3>
                          {isSelected && <CheckCircle2 size={18} color="var(--primary)" />}
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: '0 0 1rem 0' }}>
                          {p.description}
                        </p>

                        <div style={{ marginBottom: '1.25rem' }}>
                          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {price === 0 ? 'Gratis' : `Rp ${price.toLocaleString('id-ID')}`}
                          </div>
                          {price > 0 && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              / bulan (ditagih {billingCycle === 'annual' ? 'tahunan' : 'bulanan'})
                            </span>
                          )}
                        </div>

                        {/* Features List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <Package size={15} color="var(--primary)" />
                            <span>Maksimal <strong>{p.max_items} Item</strong> Produk</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <HardDrive size={15} color="var(--primary)" />
                            <span>Kapasitas <strong>{storageMB >= 1024 ? `${(storageMB / 1024).toFixed(1)} GB` : `${storageMB} MB`}</strong></span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <Sparkles size={15} color={p.has_verified_badge ? 'var(--primary)' : 'var(--text-muted)'} />
                            <span style={{ color: p.has_verified_badge ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {p.has_verified_badge ? 'Centang Profil Resmi' : 'Tanpa Badge Verifikasi'}
                            </span>
                          </div>
                          {p.has_custom_domain && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <Crown size={15} color="#a855f7" />
                              <span style={{ fontWeight: 600 }}>Dukungan Custom Domain</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ marginTop: '1.25rem' }}>
                        {isCurrent ? (
                          <div style={{
                            textAlign: 'center',
                            padding: '0.5rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            borderRadius: '0.5rem'
                          }}>
                            Paket Saat Ini
                          </div>
                        ) : (
                          <div style={{
                            textAlign: 'center',
                            padding: '0.5rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            borderRadius: '0.5rem',
                            backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-card)',
                            color: isSelected ? '#ffffff' : 'var(--text-primary)',
                            border: isSelected ? 'none' : '1px solid var(--border-light)'
                          }}>
                            {isSelected ? 'Paket Terpilih' : 'Pilih Paket Ini'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Payment & Confirmation Step */
            <div>
              {isMaintenance ? (
                /* Maintenance State */
                <div style={{
                  padding: '2.5rem 1.5rem',
                  borderRadius: '1rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1.5px solid rgba(239, 68, 68, 0.35)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <ShieldAlert size={36} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: 'var(--text-primary)' }}>
                      {maintenanceTitle}
                    </h3>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '580px', lineHeight: 1.55 }}>
                      {maintenanceMessage}
                    </p>
                  </div>
                  <div style={{
                    padding: '0.75rem 1.25rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)'
                  }}>
                    Layanan pembayaran ditangguhkan sementara demi keamanan jaringan server dan rekonsiliasi data.
                  </div>
                  <button
                    type="button"
                    disabled={true}
                    style={{
                      minHeight: '48px',
                      padding: '0.75rem 2rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border-light)',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'not-allowed'
                    }}
                  >
                    Pembayaran Sementara Ditangguhkan
                  </button>
                </div>
              ) : orderInvoice ? (
                /* Order Success / Instructions View */
                <div style={{
                  padding: '1.5rem',
                  borderRadius: '1rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  textAlign: 'center'
                }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem'
                  }}>
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.4rem 0' }}>
                    Pesanan #{orderInvoice.order_number || orderInvoice.invoice_number || orderInvoice.id} Dibuat
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                    Total tagihan: <strong>Rp {(orderInvoice.final_amount || orderInvoice.total_amount || totalPrice).toLocaleString('id-ID')}</strong> untuk paket {selectedPlan?.name}.
                  </p>

                  {orderInvoice.unique_code > 0 && (
                    <div style={{
                      padding: '0.65rem 1rem',
                      borderRadius: '0.55rem',
                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      color: '#d97706',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      maxWidth: '460px',
                      margin: '0 auto 1.25rem',
                      textAlign: 'center'
                    }}>
                      Termasuk kode unik transfer 3-digit: +Rp {orderInvoice.unique_code}
                    </div>
                  )}

                  {/* QRIS / Bank Transfer Details */}
                  <div style={{
                    maxWidth: '460px',
                    margin: '0 auto',
                    padding: '1.25rem',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--border-light)',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Metode Pembayaran</span>
                      <strong style={{ textTransform: 'uppercase' }}>{orderInvoice.payment_method || paymentMethod}</strong>
                    </div>

                    {paymentMethod === 'bank' ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Bank Tujuan</span>
                          <strong>{bankName}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Nomor Rekening</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <strong style={{ letterSpacing: '0.04em' }}>{bankAccount}</strong>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(bankAccount.replace(/[^0-9]/g, ''))}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                color: 'var(--primary)',
                                padding: '0.2rem'
                              }}
                            >
                              <Copy size={16} />
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Atas Nama</span>
                          <strong>{bankHolder}</strong>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem', padding: '0.5rem 0' }}>
                        <div style={{ width: '140px', height: '140px', background: '#ffffff', borderRadius: '10px', padding: '6px', border: '2px solid var(--primary)', overflow: 'hidden' }}>
                          <SafeImage
                            src={manualQrisImage}
                            fallbackSrc="/img/qris_demo.svg"
                            alt="QRIS"
                            objectFit="contain"
                            emptyLabel="QRIS Belum Diunggah"
                            emptySubLabel="Hubungi admin platform"
                            errorLabel="QRIS Rusak"
                            errorSubLabel="Gagal memuat berkas"
                            isDark={false}
                            compact={true}
                            wrapperStyle={{ width: '100%', height: '100%' }}
                          />
                        </div>
                        <strong style={{ fontSize: '0.86rem' }}>{manualQrisMerchant}</strong>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: '1.75rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                    {orderInvoice.gateway_payment_link && (
                      <a
                        href={orderInvoice.gateway_payment_link}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          minHeight: '44px',
                          padding: '0.65rem 1.75rem',
                          borderRadius: '0.65rem',
                          backgroundColor: 'var(--primary)',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}
                      >
                        <ExternalLink size={16} />
                        <span>Bayar Online Sekarang</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={onClose}
                      style={{
                        minHeight: '44px',
                        padding: '0.65rem 2rem',
                        borderRadius: '0.65rem',
                        backgroundColor: orderInvoice.gateway_payment_link ? 'var(--bg-card)' : 'var(--primary)',
                        color: orderInvoice.gateway_payment_link ? 'var(--text-primary)' : '#ffffff',
                        border: orderInvoice.gateway_payment_link ? '1px solid var(--border-light)' : 'none',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                      }}
                    >
                      Selesai &amp; Kembali ke Konsol
                    </button>
                  </div>
                </div>
              ) : (
                /* Payment Method Selection & Summary */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                  {/* Left: Summary */}
                  <div style={{
                    padding: '1.5rem',
                    borderRadius: '1rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0' }}>
                        Ringkasan Pesanan
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Paket Pilihan</span>
                          <strong>{selectedPlan?.name}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Siklus Penagihan</span>
                          <strong>{billingCycle === 'annual' ? 'Tahunan (12 Bulan)' : 'Bulanan (1 Bulan)'}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Kapasitas Item</span>
                          <strong>{selectedPlan?.max_items === -1 ? 'Unlimited' : `${selectedPlan?.max_items} Produk`}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Kapasitas Cloud</span>
                          <strong>{Math.round((selectedPlan?.storage_limit_bytes || 0) / (1024 * 1024))} MB</strong>
                        </div>
                      </div>
                    </div>

                    {/* Coupon Input Section */}
                    <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-light)' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
                        <Tag size={13} color="var(--primary)" />
                        <span>Punya Kode Kupon Promo?</span>
                      </label>
                      {appliedCoupon ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.65rem', borderRadius: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <CheckCircle2 size={15} color="#10b981" />
                            <div>
                              <strong style={{ fontSize: '0.82rem', color: '#10b981' }}>{appliedCoupon.code}</strong>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: '0.4rem' }}>
                                (Hemat Rp {discountAmount.toLocaleString('id-ID')})
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveCoupon}
                            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', padding: '0.2rem 0.4rem' }}
                          >
                            Hapus
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <input
                            type="text"
                            placeholder="Masukkan kupon"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyCoupon(); } }}
                            style={{
                              flex: 1,
                              minHeight: '38px',
                              padding: '0.4rem 0.65rem',
                              borderRadius: '0.5rem',
                              border: '1px solid var(--border-light)',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              textTransform: 'uppercase'
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleApplyCoupon}
                            disabled={couponValidating || !couponCode.trim()}
                            style={{
                              minHeight: '38px',
                              padding: '0 0.85rem',
                              borderRadius: '0.5rem',
                              backgroundColor: 'var(--primary)',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: (couponValidating || !couponCode.trim()) ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {couponValidating ? '...' : 'Terapkan'}
                          </button>
                        </div>
                      )}
                      {couponError && (
                        <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: '0.3rem', fontWeight: 600 }}>
                          {couponError}
                        </div>
                      )}
                      {couponSuccessMsg && (
                        <div style={{ color: '#10b981', fontSize: '0.72rem', marginTop: '0.3rem', fontWeight: 600 }}>
                          {couponSuccessMsg}
                        </div>
                      )}
                    </div>

                    <div style={{
                      paddingTop: '0.85rem',
                      borderTop: '1px solid var(--border-light)',
                      marginTop: '1rem'
                    }}>
                      {appliedCoupon && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                            <span>Subtotal Normal</span>
                            <span>Rp {totalPrice.toLocaleString('id-ID')}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#10b981', fontWeight: 700, marginBottom: '0.5rem' }}>
                            <span>Diskon Promo ({appliedCoupon.code})</span>
                            <span>- Rp {discountAmount.toLocaleString('id-ID')}</span>
                          </div>
                        </>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Pembayaran</span>
                        <span style={{ fontSize: '1.35rem', fontWeight: 800, color: finalPrice === 0 ? '#10b981' : 'var(--primary)' }}>
                          {finalPrice === 0 ? 'GRATIS (100% Diskon)' : `Rp ${finalPrice.toLocaleString('id-ID')}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Payment Channels & Inputs */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {finalPrice === 0 ? (
                      <div style={{
                        padding: '1.5rem',
                        borderRadius: '0.85rem',
                        backgroundColor: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem',
                        textAlign: 'center',
                        flex: 1
                      }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle2 size={28} color="#10b981" />
                        </div>
                        <div>
                          <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>
                            Biaya Langganan Rp 0 (Gratis)
                          </h4>
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                            Kupon promosi <strong>{appliedCoupon?.code}</strong> menggratiskan seluruh biaya paket ini. Klik tombol di bawah untuk langsung mengaktifkan paket tanpa perlu pembayaran atau transfer.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* SYSTEM PAYMENT MODES */}
                        {systemPaymentMode === 'gateway_aulaa' ? (() => {
                          const showQRIS = platformSettings?.payment_aulaa_channel_qris !== '0';
                          const showVA = platformSettings?.payment_aulaa_channel_va !== '0';
                          const showEWallet = platformSettings?.payment_aulaa_channel_ewallet !== '0';
                          const showCC = platformSettings?.payment_aulaa_channel_cc === '1';

                          return (
                            <div style={{
                              padding: '1rem',
                              borderRadius: '0.75rem',
                              backgroundColor: 'var(--bg-deep)',
                              border: '1px solid var(--border-light)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.85rem'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: 800 }}>
                                  <Zap size={16} />
                                  <span style={{ fontSize: '0.9rem' }}>Gerbang Pembayaran Instan (Aulaa)</span>
                                </div>
                                <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '9999px', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <CheckCircle2 size={12} /> Otomatis &amp; Real-time
                                </span>
                              </div>
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                                Pilih saluran pembayaran di bawah. Setelah menekan tombol bayar, Anda akan dialihkan ke antarmuka aman Aulaa. Paket toko Anda akan langsung aktif otomatis seketika setelah pembayaran terkonfirmasi tanpa verifikasi manual.
                              </p>

                              {/* Sub-channel Buttons Tablet */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                                {showQRIS && (
                                  <button
                                    type="button"
                                    onClick={() => setAulaaChannel('qris')}
                                    style={{
                                      padding: '0.65rem 0.75rem',
                                      borderRadius: '0.55rem',
                                      backgroundColor: aulaaChannel === 'qris' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                      border: aulaaChannel === 'qris' ? '2px solid #10b981' : '1px solid var(--border-light)',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '0.4rem'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <QrCode size={16} color="#10b981" />
                                      <div>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>QRIS Instan</div>
                                        <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>GoPay, OVO, Shopee, BCA</div>
                                      </div>
                                    </div>
                                    {aulaaChannel === 'qris' && <Check size={14} color="#10b981" />}
                                  </button>
                                )}
                                {showVA && (
                                  <button
                                    type="button"
                                    onClick={() => setAulaaChannel('va')}
                                    style={{
                                      padding: '0.65rem 0.75rem',
                                      borderRadius: '0.55rem',
                                      backgroundColor: aulaaChannel === 'va' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                      border: aulaaChannel === 'va' ? '2px solid #38bdf8' : '1px solid var(--border-light)',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '0.4rem'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <CreditCard size={16} color="#38bdf8" />
                                      <div>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>Virtual Account</div>
                                        <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>BCA, Mandiri, BRI, BNI</div>
                                      </div>
                                    </div>
                                    {aulaaChannel === 'va' && <Check size={14} color="#38bdf8" />}
                                  </button>
                                )}
                                {showEWallet && (
                                  <button
                                    type="button"
                                    onClick={() => setAulaaChannel('ewallet')}
                                    style={{
                                      padding: '0.65rem 0.75rem',
                                      borderRadius: '0.55rem',
                                      backgroundColor: aulaaChannel === 'ewallet' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                      border: aulaaChannel === 'ewallet' ? '2px solid #f59e0b' : '1px solid var(--border-light)',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '0.4rem'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <Zap size={16} color="#f59e0b" />
                                      <div>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>Dompet Digital</div>
                                        <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>DANA, LinkAja, AstraPay</div>
                                      </div>
                                    </div>
                                    {aulaaChannel === 'ewallet' && <Check size={14} color="#f59e0b" />}
                                  </button>
                                )}
                                {showCC && (
                                  <button
                                    type="button"
                                    onClick={() => setAulaaChannel('cc')}
                                    style={{
                                      padding: '0.65rem 0.75rem',
                                      borderRadius: '0.55rem',
                                      backgroundColor: aulaaChannel === 'cc' ? 'rgba(192, 132, 252, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                      border: aulaaChannel === 'cc' ? '2px solid #c084fc' : '1px solid var(--border-light)',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '0.4rem'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <CreditCard size={16} color="#c084fc" />
                                      <div>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>Kartu Kredit</div>
                                        <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>Visa &amp; Mastercard</div>
                                      </div>
                                    </div>
                                    {aulaaChannel === 'cc' && <Check size={14} color="#c084fc" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })() : (
                          /* Manual QRIS or Bank Mode */
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {/* Channel Selector */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                              <div
                                onClick={() => setPaymentMethod('qris')}
                                style={{
                                  minHeight: '44px',
                                  padding: '0.75rem',
                                  borderRadius: '0.65rem',
                                  backgroundColor: paymentMethod === 'qris' ? 'rgba(30, 58, 138, 0.15)' : 'var(--bg-deep)',
                                  border: paymentMethod === 'qris' ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <QrCode size={18} color={paymentMethod === 'qris' ? 'var(--primary)' : 'var(--text-muted)'} />
                                <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>QRIS Merchant</span>
                              </div>

                              <div
                                onClick={() => setPaymentMethod('bank')}
                                style={{
                                  minHeight: '44px',
                                  padding: '0.75rem',
                                  borderRadius: '0.65rem',
                                  backgroundColor: paymentMethod === 'bank' ? 'rgba(30, 58, 138, 0.15)' : 'var(--bg-deep)',
                                  border: paymentMethod === 'bank' ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <CreditCard size={18} color={paymentMethod === 'bank' ? 'var(--primary)' : 'var(--text-muted)'} />
                                <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Transfer Bank</span>
                              </div>
                            </div>

                            {paymentMethod === 'bank' ? (
                              <div style={{
                                padding: '0.85rem',
                                borderRadius: '0.65rem',
                                backgroundColor: 'var(--bg-deep)',
                                border: '1px solid var(--border-light)',
                                fontSize: '0.8rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.35rem'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>Bank Tujuan:</span>
                                  <strong>{bankName}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>No. Rekening:</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <strong style={{ letterSpacing: '0.04em' }}>{bankAccount}</strong>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        copyToClipboard(bankAccount.replace(/[^0-9]/g, ''));
                                        showToast('Nomor rekening berhasil disalin', 'success');
                                      }}
                                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--primary)', padding: '0.2rem' }}
                                    >
                                      <Copy size={14} />
                                    </button>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>Atas Nama:</span>
                                  <strong>{bankHolder}</strong>
                                </div>
                              </div>
                            ) : (
                              <div style={{
                                padding: '0.85rem',
                                borderRadius: '0.65rem',
                                backgroundColor: 'var(--bg-deep)',
                                border: '1px solid var(--border-light)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.65rem',
                                textAlign: 'center'
                              }}>
                                <div style={{ width: '120px', height: '120px', background: '#ffffff', borderRadius: '8px', padding: '6px', border: '1px solid var(--primary)' }}>
                                  <img src={manualQrisImage} alt="QRIS" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                </div>
                                <a
                                  href={manualQrisImage}
                                  download="qris_catavor.png"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '0.5rem',
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border-light)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    textDecoration: 'none'
                                  }}
                                >
                                  <Download size={13} />
                                  <span>Unduh QRIS</span>
                                </a>
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                                  <strong style={{ color: 'var(--text-primary)', display: 'block', fontSize: '0.82rem' }}>{manualQrisMerchant}</strong>
                                  <span>Scan menggunakan ShopeePay / BCA / E-Wallet. Kode unik 3 digit akan ditambahkan pada tagihan.</span>
                                </div>
                              </div>
                            )}

                            {/* Input Sender Name */}
                            <div>
                              <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>
                                Nama Akun / Rekening Pengirim: <span style={{ color: '#ef4444' }}>*</span>
                              </label>
                              <input
                                type="text"
                                placeholder="Contoh: Budi Santoso / ShopeePay"
                                value={senderAccountName}
                                onChange={(e) => setSenderAccountName(e.target.value)}
                                style={{
                                  width: '100%',
                                  minHeight: '44px',
                                  padding: '0.5rem 0.75rem',
                                  borderRadius: '0.5rem',
                                  backgroundColor: 'var(--bg-deep)',
                                  border: '1px solid var(--border-light)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.82rem',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </div>

                            {/* Upload Proof */}
                            <div>
                              <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>
                                Unggah Bukti Transfer: <span style={{ color: '#ef4444' }}>*</span>
                              </label>
                              <label style={{
                                minHeight: '44px',
                                padding: '0.65rem',
                                borderRadius: '0.5rem',
                                border: '1px dashed var(--border-light)',
                                backgroundColor: 'var(--bg-deep)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                              }}>
                                <input type="file" accept="image/*" onChange={handleProofUpload} style={{ display: 'none' }} />
                                {proofPreview ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <img src={proofPreview} alt="Bukti" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }} />
                                    <span style={{ fontSize: '0.76rem', color: '#10b981', fontWeight: 700 }}>Bukti Berhasil Dipilih (Klik ganti)</span>
                                  </div>
                                ) : (
                                  <>
                                    <Upload size={16} color="var(--primary)" />
                                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                      {isUploadingProof ? 'Mengunggah...' : 'Pilih Berkas Foto / Struk'}
                                    </span>
                                  </>
                                )}
                              </label>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {(() => {
                      const isGateway = systemPaymentMode === 'gateway_aulaa';
                      const isProofRequired = !isGateway && finalPrice > 0;
                      const isSubmitDisabled = submittingOrder || isUploadingProof || (isProofRequired && !paymentProofUrl);

                      return (
                        <button
                          type="button"
                          disabled={isSubmitDisabled}
                          onClick={handleCreateOrder}
                          style={{
                            marginTop: '0.5rem',
                            minHeight: '48px',
                            padding: '0.75rem',
                            borderRadius: '0.65rem',
                            backgroundColor: isSubmitDisabled ? '#94a3b8' : 'var(--primary)',
                            color: '#ffffff',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '0.92rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            cursor: isSubmitDisabled ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {finalPrice === 0 ? (
                            <>
                              <Sparkles size={18} />
                              <span>{submittingOrder ? 'Memproses Aktivasi...' : 'Aktifkan Paket Sekarang (Gratis)'}</span>
                            </>
                          ) : isGateway ? (
                            <>
                              <Zap size={18} />
                              <span>{submittingOrder ? 'Menyiapkan Sesi...' : `Lanjut ke Pembayaran Aulaa (Rp ${finalPrice.toLocaleString('id-ID')})`}</span>
                              <ArrowRight size={16} />
                            </>
                          ) : (
                            <>
                              <Receipt size={18} />
                              <span>{submittingOrder ? 'Memproses Pesanan...' : (!paymentProofUrl ? 'Unggah Bukti Transfer untuk Melanjutkan' : `Kirim Bukti Pembayaran (Rp ${finalPrice.toLocaleString('id-ID')})`)}</span>
                            </>
                          )}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer (for Step 1) */}
        {checkoutStep === 'plan_select' && (
          <div style={{
            padding: '1rem 1.75rem',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-deep)'
          }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Paket dipilih: </span>
              <strong style={{ fontSize: '0.88rem' }}>{selectedPlan?.name}</strong>
              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--primary)', marginLeft: '0.5rem' }}>
                (Rp {totalPrice.toLocaleString('id-ID')} / {billingCycle === 'annual' ? 'tahun' : 'bulan'})
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  minHeight: '44px',
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleProceedToPayment}
                style={{
                  minHeight: '44px',
                  padding: '0.5rem 1.5rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                Lanjutkan ke Pembayaran
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const TabletQuotaWidget: React.FC<{
  quota: StoreQuotaData | null;
  onOpenUpgrade: () => void;
  isNavExpanded?: boolean;
}> = ({ quota, onOpenUpgrade, isNavExpanded = false }) => {
  const isFree = !quota || quota.plan?.code === 'free';
  const rawPlanName = quota?.plan?.name || (isFree ? 'Gratis Terbatas' : 'Paket Toko');
  // Adaptive plan title: when sidebar is expanded, masterPane is narrower, so use concise "Gratis" to prevent any clipping
  const planName = (isNavExpanded && isFree) ? 'Gratis' : rawPlanName;

  const isUnlimited = quota?.max_items === -1;
  const activeItems = quota?.active_items_count ?? 0;
  const maxItems = quota?.max_items ?? 15;
  const itemsUsagePercent = isUnlimited ? 0 : Math.min(quota?.items_usage_percent ?? (maxItems > 0 ? (activeItems / maxItems) * 100 : 0), 100);
  const storageUsed = quota?.storage_used_bytes ?? 0;
  const storageLimit = quota?.storage_limit_bytes ?? (50 * 1024 * 1024);
  const storageUsagePercent = Math.min(quota?.storage_usage_percent ?? (storageLimit > 0 ? (storageUsed / storageLimit) * 100 : 0), 100);

  const isItemsOverLimit = Boolean(quota?.is_items_over_limit || (!isUnlimited && activeItems > maxItems));
  const isStorageOverLimit = Boolean(quota?.is_storage_over_limit || (storageLimit > 0 && storageUsed > storageLimit));

  const formatStorageShort = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) {
      const kb = Math.round(bytes / 1024);
      return `${kb} KB`;
    }
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) {
      return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
    }
    const gb = mb / 1024;
    return gb % 1 === 0 ? `${gb.toFixed(0)} GB` : `${gb.toFixed(1)} GB`;
  };

  return (
    <div style={{
      margin: '0.85rem 0.85rem 0.5rem 0.85rem',
      padding: '0.85rem 1rem',
      backgroundColor: 'var(--bg-card)',
      borderRadius: '0.85rem',
      border: '1px solid var(--border-light)',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem'
    }}>
      {/* Top Row: Plan & Upgrade Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flex: 1 }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '0.45rem',
            background: isFree ? 'rgba(245, 158, 11, 0.12)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isFree ? '#f59e0b' : '#ffffff',
            flexShrink: 0
          }}>
            <Crown size={15} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0, flexWrap: 'nowrap' }}>
            <span style={{
              fontSize: '0.85rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap'
            }}>
              {planName}
            </span>
            {quota?.plan?.has_verified_badge && (
              <span
                title="Merchant Terverifikasi Resmi"
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: '#3b82f6',
                  color: '#fff',
                  flexShrink: 0
                }}
              >
                {isNavExpanded ? '✓' : '✓ Resmi'}
              </span>
            )}
            {!isFree && quota?.days_remaining !== undefined && quota.days_remaining > 0 && (
              <span
                title={`Sisa masa aktif: ${quota.days_remaining} hari`}
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  color: '#d97706',
                  flexShrink: 0,
                  whiteSpace: 'nowrap'
                }}
              >
                {quota.days_remaining}h
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenUpgrade}
          title={isFree ? 'Upgrade ke Paket Pro' : 'Kelola Paket Langganan'}
          style={{
            minHeight: '32px',
            padding: '0.3rem 0.65rem',
            borderRadius: '0.5rem',
            border: isFree ? 'none' : '1px solid var(--border-light)',
            backgroundColor: isFree ? 'var(--primary)' : 'var(--bg-deep)',
            color: isFree ? '#ffffff' : 'var(--text-primary)',
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            flexShrink: 0,
            boxShadow: isFree ? '0 2px 6px var(--primary-glow)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          {isFree ? <Sparkles size={12} /> : null}
          <span>{isFree ? 'Upgrade' : 'Kelola'}</span>
        </button>
      </div>

      {/* Progress Indicators: Items Quota & Cloud Storage */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
        {/* Items Quota */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.72rem' }}>
            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
              <Package size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} /> Item
            </span>
            <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.74rem' }}>
              {activeItems.toLocaleString('id-ID')} / {isUnlimited ? '∞' : maxItems.toLocaleString('id-ID')}
            </span>
          </div>
          <div style={{ height: '5px', borderRadius: '3px', backgroundColor: 'var(--border-light)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: isUnlimited ? '100%' : `${itemsUsagePercent}%`,
              backgroundColor: isItemsOverLimit ? '#ef4444' : itemsUsagePercent > 80 ? '#f59e0b' : 'var(--primary)',
              borderRadius: '3px',
              transition: 'width 0.3s ease'
            }} />
          </div>
          {Boolean(quota?.archived_items_count && quota.archived_items_count > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.65rem', color: '#f59e0b', marginTop: '0.05rem' }}>
              <Archive size={10} />
              <span>{quota?.archived_items_count} Diarsipkan</span>
            </div>
          )}
        </div>

        {/* Cloud Storage */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.72rem' }}>
            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
              <HardDrive size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} /> Storage
            </span>
            <span style={{ fontWeight: 800, color: isStorageOverLimit ? '#ef4444' : 'var(--text-primary)', fontSize: '0.74rem' }}>
              {formatStorageShort(storageUsed)} / {formatStorageShort(storageLimit)}
            </span>
          </div>
          <div style={{ height: '5px', borderRadius: '3px', backgroundColor: 'var(--border-light)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${storageUsagePercent}%`,
              backgroundColor: isStorageOverLimit ? '#ef4444' : storageUsagePercent > 80 ? '#f59e0b' : 'var(--primary)',
              borderRadius: '3px',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      </div>
    </div>
  );
};
