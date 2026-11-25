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
  Tag,
  Settings2,
  Clock,
  RotateCcw,
  Info,
  Lock
} from 'lucide-react';
import { createAuthFetch } from '../utils/auth';
import { useModalBackHandler } from '../utils/navigation';
import { SafeImage } from './SafeImage';
import { AuthenticatedProofImage } from '../../../shared/finance/AuthenticatedProofImage';
import { SubscriptionPendingStatusCard } from '../../../shared/finance/SubscriptionPendingStatusCard';

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
  remaining_credit_amount?: number;
  pending_order?: any;
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
  onViewOrders?: () => void;
  onOpenHelp?: () => void;
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
  onViewOrders,
  onOpenHelp,
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
  const billingCycle: 'monthly' = 'monthly';
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>(() => {
    const cur = currentQuota?.plan?.code || 'free';
    if (cur === 'pro_business') return 'pro_business';
    if (cur === 'pro_starter') return 'pro_business';
    return 'pro_starter';
  });
  const [restoringArchived, setRestoringArchived] = useState<boolean>(false);
  const [activeMiniTabPlan, setActiveMiniTabPlan] = useState<string>('pro_starter');
  const [isTabletMini, setIsTabletMini] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 880 : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsTabletMini(window.innerWidth < 880);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  
  // Checkout & Payment step
  const [checkoutStep, setCheckoutStep] = useState<'plan_select' | 'payment_detail' | 'downgrade_confirm'>('plan_select');
  const [selectedTargetPlan, setSelectedTargetPlan] = useState<SubscriptionPlanData | null>(null);
  const [internalLoading, setInternalLoading] = useState<boolean>(false);
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
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);

  const activePendingOrder = currentQuota?.pending_order || null;
  const hasActivePendingOrder = Boolean(
    activePendingOrder &&
    ['pending', 'pending_verification'].includes(String(activePendingOrder.payment_status || '').toLowerCase())
  );
  const isPendingVerifying = String(activePendingOrder?.payment_status || '').toLowerCase() === 'pending_verification';
  const pendingTargetPlanCode = String(activePendingOrder?.plan_code || '').toLowerCase();

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
      const res = await window.fetch('/api/settings', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        if (data && typeof data === 'object') {
          setPlatformSettings((prev: Record<string, string>) => ({ ...prev, ...data }));
        }
      }
    } catch {
      // Abaikan kegagalan jaringan sementara pada refresh pengaturan latar belakang
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchPlatformSettings();
    }
  }, [isOpen, checkoutStep, fetchPlatformSettings]);

  useEffect(() => {
    if (!isOpen) return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'catavor_platform_settings_updated') {
        fetchPlatformSettings();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchPlatformSettings();
      }
    };
    window.addEventListener('focus', fetchPlatformSettings);
    window.addEventListener('catavor_platform_settings_updated', fetchPlatformSettings);
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', fetchPlatformSettings);
      window.removeEventListener('catavor_platform_settings_updated', fetchPlatformSettings);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isOpen, fetchPlatformSettings]);

  useEffect(() => {
    const showQRIS = platformSettings?.payment_aulaa_channel_qris !== '0';
    const showVA = platformSettings?.payment_aulaa_channel_va !== '0';
    const showEWallet = platformSettings?.payment_aulaa_channel_ewallet !== '0';
    const showCC = platformSettings?.payment_aulaa_channel_cc === '1';
    const channelMap: Record<string, boolean> = {
      qris: showQRIS,
      va: showVA,
      ewallet: showEWallet,
      cc: showCC
    };
    if (!channelMap[aulaaChannel]) {
      if (showQRIS) setAulaaChannel('qris');
      else if (showVA) setAulaaChannel('va');
      else if (showEWallet) setAulaaChannel('ewallet');
      else if (showCC) setAulaaChannel('cc');
    }
  }, [
    platformSettings?.payment_aulaa_channel_qris,
    platformSettings?.payment_aulaa_channel_va,
    platformSettings?.payment_aulaa_channel_ewallet,
    platformSettings?.payment_aulaa_channel_cc,
    aulaaChannel
  ]);

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
      fetchPlatformSettings();
      setCheckoutStep('plan_select');
      setOrderInvoice(null);
      setPaymentProofUrl('');
      setProofPreview((prev) => {
        if (prev && prev.startsWith('blob:')) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      setSenderAccountName('');
      setSenderPhone('');
      setCouponCode('');
      setAppliedCoupon(null);
      setCouponError(null);
      setCouponSuccessMsg(null);
      setAulaaChannel('qris');
      const cur = currentQuota?.plan?.code || 'free';
      setSelectedPlanCode(cur === 'free' ? 'pro_starter' : 'pro_business');

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const planParam = params.get('plan');
        if (!hasActivePendingOrder && planParam && (planParam === 'pro_starter' || planParam === 'pro_business')) {
          setSelectedPlanCode(planParam);
          setCheckoutStep('payment_detail');
          const url = new URL(window.location.href);
          url.searchParams.delete('plan');
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
        }
      }
    }
  }, [isOpen, fetchPlans, fetchPlatformSettings]);

  // LIFO Back button interception for nested checkout / downgrade steps (AGENTS.md Rule 2)
  useModalBackHandler({
    isOpen: isOpen && checkoutStep !== 'plan_select',
    onClose: () => setCheckoutStep('plan_select'),
    modalId: 'tablet-subscription-substep'
  });

  useEffect(() => {
    return () => {
      if (proofPreview && proofPreview.startsWith('blob:')) {
        URL.revokeObjectURL(proofPreview);
      }
    };
  }, [proofPreview]);

  if (!isOpen) return null;

  const selectedPlan = plans.find(p => p.code === selectedPlanCode) || plans[1] || plans[0];
  const months = 1;
  const unitPrice = Number(selectedPlan?.price_monthly || 0);
  const totalPrice = unitPrice * months;
  const rankMap: Record<string, number> = { free: 0, pro_starter: 1, pro_business: 2 };
  const curPlanCode = currentQuota?.plan?.code || 'free';
  const prorationCredit =
    selectedPlan &&
    (rankMap[selectedPlan.code] || 0) > (rankMap[curPlanCode] || 0)
      ? Math.min(totalPrice, Number(currentQuota?.remaining_credit_amount || 0))
      : 0;
  const netBeforeCoupon = Math.max(0, totalPrice - prorationCredit);

  // Calculate discount from applied coupon
  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'free') {
      discountAmount = netBeforeCoupon;
    } else if (appliedCoupon.discount !== undefined && appliedCoupon.discount !== null) {
      discountAmount = Number(appliedCoupon.discount) || 0;
    } else if (appliedCoupon.discount_amount !== undefined && appliedCoupon.discount_amount !== null) {
      discountAmount = Number(appliedCoupon.discount_amount) || 0;
    } else if (appliedCoupon.discount_value !== undefined && appliedCoupon.discount_value !== null) {
      discountAmount = Number(appliedCoupon.discount_value) || 0;
    } else if (appliedCoupon.discount_percent !== undefined && appliedCoupon.discount_percent !== null) {
      discountAmount = Math.round((netBeforeCoupon * Number(appliedCoupon.discount_percent)) / 100);
    } else if (appliedCoupon.discount_type === 'percentage') {
      discountAmount = Math.round((netBeforeCoupon * (appliedCoupon.discount_value || 0)) / 100);
      if (appliedCoupon.max_discount && appliedCoupon.max_discount > 0) {
        discountAmount = Math.min(discountAmount, appliedCoupon.max_discount);
      }
    }
  }
  if (discountAmount > netBeforeCoupon) {
    discountAmount = netBeforeCoupon;
  }
  const finalPrice = Math.max(0, netBeforeCoupon - discountAmount);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponValidating(true);
    setCouponError(null);
    setCouponSuccessMsg(null);
    try {
      const res = await fetch('/api/subscription/verify-coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(storeSlug ? { 'X-Store-Slug': storeSlug } : {})
        },
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

  const handleDownloadQRIS = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!manualQrisImage) return;
    try {
      const res = await fetch(manualQrisImage);
      if (!res.ok) throw new Error('File tidak dapat diakses');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const ext = manualQrisImage.endsWith('.jpg') || manualQrisImage.endsWith('.jpeg') ? '.jpg' : (manualQrisImage.endsWith('.svg') ? '.svg' : '.png');
      a.download = `qris_${(manualQrisMerchant || 'catavor').toLowerCase().replace(/[^a-z0-9]/g, '_')}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      const win = window.open(manualQrisImage, '_blank', 'noopener,noreferrer');
      if (win) win.opener = null;
    }
  };

  const handleCancelPendingOrder = async (orderId: number) => {
    setCancellingOrderId(orderId);
    try {
      const res = await fetch(`/api/subscription/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(storeSlug ? { 'X-Store-Slug': storeSlug } : {})
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal membatalkan tagihan langganan.');
      }
      showToast(data.message || 'Tagihan berhasil dibatalkan. Anda kini dapat memilih paket lain.', 'success');
      if (onSuccessUpgrade) onSuccessUpgrade();
    } catch (err: any) {
      showToast(err.message || 'Gagal membatalkan tagihan.', 'error');
    } finally {
      setCancellingOrderId(null);
    }
  };

  const canRenewCurrentPlan = Boolean(
    currentQuota?.is_in_grace_period ||
    currentQuota?.plan_status === 'grace_period' ||
    currentQuota?.plan_status === 'expired' ||
    (currentQuota?.days_remaining !== undefined && currentQuota.days_remaining <= 3) ||
    (currentQuota?.plan_expires_at && (new Date(currentQuota.plan_expires_at).getTime() - Date.now() <= 3 * 24 * 60 * 60 * 1000))
  );

  const handleProceedToPayment = () => {
    if (hasActivePendingOrder) {
      showToast(`Tagihan ${activePendingOrder?.order_number || ''} masih aktif (${isPendingVerifying ? 'dalam verifikasi' : 'menunggu pembayaran'}). Harap selesaikan atau tunggu verifikasi selesai.`, 'error');
      return;
    }
    if (selectedPlan?.code === 'free') {
      showToast('Anda sudah berada pada paket Gratis atau pilih paket Pro', 'error');
      return;
    }
    const currentCode = currentQuota?.plan?.code || 'free';
    if (selectedPlan?.code === currentCode && currentCode !== 'free' && !canRenewCurrentPlan) {
      showToast(`Paket Anda masih aktif (${currentQuota?.days_remaining || 0} hari tersisa). Perpanjangan baru dapat dilakukan saat memasuki masa kedaluwarsa (H-3).`, 'error');
      return;
    }
    setCheckoutStep('payment_detail');
  };

  const handleConfirmDowngrade = async () => {
    if (!selectedTargetPlan) return;
    setInternalLoading(true);
    try {
      const res = await fetch('/api/subscription/schedule-downgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(storeSlug ? { 'X-Store-Slug': storeSlug } : {})
        },
        body: JSON.stringify({ target_plan_code: selectedTargetPlan.code })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menjadwalkan penurunan paket.');
      }
      showToast(data.message || 'Jadwal penurunan paket berhasil disimpan.', 'success');
      setCheckoutStep('plan_select');
      if (onSuccessUpgrade) onSuccessUpgrade();
    } catch (err: any) {
      showToast(err.message || 'Gagal memproses penurunan paket.', 'error');
    } finally {
      setInternalLoading(false);
    }
  };

  const handleCancelDowngradeSchedule = async () => {
    setInternalLoading(true);
    try {
      const res = await fetch('/api/subscription/cancel-downgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(storeSlug ? { 'X-Store-Slug': storeSlug } : {})
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal membatalkan jadwal downgrade.');
      }
      showToast('Jadwal downgrade berhasil dibatalkan. Langganan Anda tetap berlanjut.', 'success');
      if (onSuccessUpgrade) onSuccessUpgrade();
    } catch (err: any) {
      showToast(err.message || 'Gagal membatalkan jadwal downgrade.', 'error');
    } finally {
      setInternalLoading(false);
    }
  };

  const handleRestoreArchived = async () => {
    setRestoringArchived(true);
    try {
      const res = await fetch('/api/products/restore-archived', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(storeSlug ? { 'X-Store-Slug': storeSlug } : {})
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal memulihkan produk terarsip.');
      }
      showToast(data.message || `${data.restored_count || 0} produk terarsip berhasil dipulihkan.`, 'success');
      if (onSuccessUpgrade) onSuccessUpgrade();
    } catch (err: any) {
      showToast(err.message || 'Gagal memulihkan produk terarsip.', 'error');
    } finally {
      setRestoringArchived(false);
    }
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
          'Authorization': `Bearer ${token}`,
          ...(storeSlug ? { 'X-Store-Slug': storeSlug } : {})
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success && data.url) {
        setPaymentProofUrl(data.url);
        const nextBlobUrl = URL.createObjectURL(file);
        setProofPreview((prev) => {
          if (prev && prev.startsWith('blob:')) {
            URL.revokeObjectURL(prev);
          }
          return nextBlobUrl;
        });
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
          type: (currentQuota?.plan?.code === selectedPlan.code && selectedPlan.code !== 'free') ? 'renewal' : 'upgrade',
          order_type: (currentQuota?.plan?.code === selectedPlan.code && selectedPlan.code !== 'free') ? 'renewal' : 'upgrade'
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
            {checkoutStep !== 'plan_select' && (
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
                {checkoutStep === 'plan_select' ? 'Upgrade & Kelola Paket Langganan' : checkoutStep === 'downgrade_confirm' ? 'Jadwal Penyesuaian Paket' : 'Konfirmasi & Instruksi Pembayaran'}
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                {checkoutStep === 'plan_select'
                  ? 'Tingkatkan kuota produk dan kapasitas penyimpanan media toko Anda'
                  : checkoutStep === 'downgrade_confirm'
                  ? 'Atur penyesuaian paket prabayar pada siklus jatuh tempo berikutnya'
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
              {hasActivePendingOrder && (
                <div style={{ marginBottom: '1.15rem' }}>
                  <SubscriptionPendingStatusCard
                    device="tablet"
                    compact={isTabletMini}
                    pendingOrder={activePendingOrder}
                    currentPlanCode={currentQuota?.plan?.code || 'free'}
                    currentPlanName={currentQuota?.plan?.name}
                    onViewOrderDetail={() => {
                      onClose();
                      if (onViewOrders) onViewOrders();
                    }}
                    onContactSupport={onOpenHelp ? () => {
                      onClose();
                      onOpenHelp();
                    } : undefined}
                    onCancelPendingOrder={handleCancelPendingOrder}
                    cancelling={cancellingOrderId === activePendingOrder?.id}
                  />
                </div>
              )}

              {/* Scheduled Downgrade Notice in Tablet Plans View */}
              {currentQuota?.next_plan && (
                <div style={{
                  marginBottom: '1.25rem',
                  padding: '1rem 1.25rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Clock size={22} style={{ color: '#d97706', flexShrink: 0 }} />
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                        Jadwal Penurunan Paket Aktif ({currentQuota.next_plan.name})
                      </strong>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Paket Anda akan berganti ke {currentQuota.next_plan.name} saat periode masa aktif saat ini berakhir.
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
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      color: '#ef4444',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: internalLoading ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {internalLoading ? 'Membatalkan...' : 'Batalkan Jadwal'}
                  </button>
                </div>
              )}

              {/* Grace Period Alert in Tablet Plans View */}
              {currentQuota?.is_in_grace_period && (() => {
                const graceDaysLeft = currentQuota.grace_period_until
                  ? Math.max(0, Math.ceil((new Date(currentQuota.grace_period_until).getTime() - Date.now()) / 86400000))
                  : 0;
                return (
                <div style={{
                  marginBottom: '1.25rem',
                  padding: '1rem 1.25rem',
                  borderRadius: '0.75rem',
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(245, 158, 11, 0.16) 100%)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1 1 280px' }}>
                    <AlertTriangle size={22} style={{ color: '#ef4444', flexShrink: 0 }} />
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                        Akun Dalam Masa Tenggang {graceDaysLeft > 0 ? `(Sisa ${graceDaysLeft} Hari)` : '(Berakhir Hari Ini)'}
                      </strong>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Segera perpanjang agar domain kustom tidak dinonaktifkan dan item berlebih tidak terarsip otomatis.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (hasActivePendingOrder) {
                        onClose();
                        if (onViewOrders) onViewOrders();
                        return;
                      }
                      setSelectedPlanCode(currentQuota.plan.code);
                      setCheckoutStep('payment_detail');
                    }}
                    style={{
                      minHeight: '44px',
                      padding: '0.5rem 1.15rem',
                      borderRadius: '0.55rem',
                      backgroundColor: hasActivePendingOrder ? '#d97706' : '#ef4444',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {hasActivePendingOrder ? 'Lihat Tagihan Aktif' : 'Perpanjang Sekarang'}
                  </button>
                </div>
                );
              })()}

              {/* Bulk Restore Archived Products Banner */}
              {(currentQuota?.archived_items_count || 0) > 0 && !currentQuota?.is_items_over_limit && (
                <div style={{
                  marginBottom: '1.25rem',
                  padding: '0.95rem 1.25rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1 1 280px' }}>
                    <Archive size={20} style={{ color: '#10b981', flexShrink: 0 }} />
                    <div>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {currentQuota?.archived_items_count} Produk Terarsip Siap Dipulihkan
                      </strong>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Kuota paket aktif mencukupi untuk mengaktifkan kembali produk yang terarsip sistem.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={restoringArchived}
                    onClick={handleRestoreArchived}
                    style={{
                      minHeight: '44px',
                      padding: '0.5rem 1.1rem',
                      borderRadius: '0.55rem',
                      backgroundColor: '#10b981',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: restoringArchived ? 'wait' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {restoringArchived ? 'Memulihkan...' : `Pulihkan ${currentQuota?.archived_items_count} Produk`}
                  </button>
                </div>
              )}

              {/* Prepaid Manual Education Banner */}
              <div style={{
                marginBottom: '1.25rem',
                padding: '0.85rem 1.15rem',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <Info size={18} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.15rem' }}>
                    Sistem Langganan Prabayar Manual Catavor (Bebas Auto-Debit)
                  </strong>
                  Platform beroperasi secara murni prabayar bulanan manual. Kami tidak pernah menyimpan nomor kartu kredit dan tidak membebankan auto-debit otomatis tanpa persetujuan Anda.
                </div>
              </div>

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

              {/* Interactive Segmented Tab Switcher khusus Tablet Mini (768px - 879px, AGENTS.md Rule 7.A.2) */}
              {isTabletMini && plans.length > 0 && (
                <div
                  role="tablist"
                  aria-label="Pilih paket langganan"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${plans.length}, 1fr)`,
                    gap: '0.4rem',
                    padding: '0.35rem',
                    borderRadius: '0.85rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    marginBottom: '1rem'
                  }}
                >
                  {plans.map((tp) => {
                    const active = activeMiniTabPlan === tp.code;
                    return (
                      <button
                        key={`tab-${tp.code}`}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          setActiveMiniTabPlan(tp.code);
                          if (tp.code !== 'free') {
                            setSelectedPlanCode(tp.code);
                          }
                        }}
                        style={{
                          minHeight: '44px',
                          padding: '0.45rem 0.65rem',
                          borderRadius: '0.6rem',
                          border: active ? '1px solid var(--primary)' : '1px solid transparent',
                          backgroundColor: active ? 'var(--primary)' : 'transparent',
                          color: active ? '#ffffff' : 'var(--text-secondary)',
                          fontWeight: active ? 800 : 600,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          transition: 'all 0.16s ease'
                        }}
                      >
                        {tp.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Plans Grid (1 kolom lapang di Tablet Mini, 3 kolom simetris di Tablet Lebar >= 880px) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isTabletMini ? '1fr' : 'repeat(3, 1fr)',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                {(() => {
                  const planRank: Record<string, number> = {
                    free: 0,
                    pro_starter: 1,
                    pro_business: 2
                  };
                  const currentPlanCode = currentQuota?.plan?.code || 'free';
                  const currentRank = planRank[currentPlanCode] || 0;
                  const visiblePlans = isTabletMini
                    ? plans.filter(pl => pl.code === activeMiniTabPlan || (!plans.some(x => x.code === activeMiniTabPlan) && pl.code === plans[0]?.code))
                    : plans;

                  return visiblePlans.map(p => {
                    const isSelected = selectedPlanCode === p.code;
                    const isCurrent = currentPlanCode === p.code;
                    const targetRank = planRank[p.code] || 0;
                    const isDowngrade = targetRank < currentRank;
                    const isPendingTarget = hasActivePendingOrder && p.code.toLowerCase() === pendingTargetPlanCode;
                    const isSoftLocked = hasActivePendingOrder && !isPendingTarget && !(p.code === 'free' && isCurrent);
                    const price = p.price_monthly;
                    const storageMB = Math.round(p.storage_limit_bytes / (1024 * 1024));

                    return (
                      <div
                        key={p.code}
                        onClick={() => {
                          if (hasActivePendingOrder) return;
                          if (p.code === 'free' && currentRank > 0) return;
                          if (isDowngrade && p.code !== 'free') {
                            setSelectedTargetPlan(p);
                            setCheckoutStep('downgrade_confirm');
                            return;
                          }
                          if (isCurrent && !canRenewCurrentPlan) return;
                          setSelectedPlanCode(p.code);
                        }}
                        style={{
                          borderRadius: '1rem',
                          border: isPendingTarget
                            ? `2px solid ${isPendingVerifying ? '#d97706' : '#3b82f6'}`
                            : isSelected && !hasActivePendingOrder
                            ? '2px solid var(--primary)'
                            : '1px solid var(--border-light)',
                          backgroundColor: isPendingTarget
                            ? (isPendingVerifying ? 'rgba(217, 119, 6, 0.06)' : 'rgba(59, 130, 246, 0.06)')
                            : isSelected && !hasActivePendingOrder
                            ? 'rgba(30, 58, 138, 0.08)'
                            : 'var(--bg-deep)',
                          padding: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          cursor: hasActivePendingOrder || (p.code === 'free' && currentRank > 0) || (isCurrent && !canRenewCurrentPlan) ? 'default' : 'pointer',
                          position: 'relative',
                          opacity: isSoftLocked && !isCurrent ? 0.72 : 1,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {(isPendingTarget || p.badge_label) && (
                          <div style={{
                            position: 'absolute',
                            top: '-10px',
                            right: '12px',
                            backgroundColor: isPendingTarget
                              ? (isPendingVerifying ? '#d97706' : '#2563eb')
                              : (p.code === 'pro_business' ? '#a855f7' : 'var(--primary)'),
                            color: '#ffffff',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.55rem',
                            borderRadius: '999px',
                            textTransform: 'uppercase'
                          }}>
                            {isPendingTarget
                              ? (isPendingVerifying ? 'Sedang Diverifikasi' : 'Menunggu Pembayaran')
                              : p.badge_label}
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
                                / bulan (ditagih bulanan)
                              </span>
                            )}
                          </div>

                          {/* Features List */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <Package size={15} color="var(--primary)" />
                              <span>{p.max_items === -1 ? <strong>Unlimited Item Produk</strong> : <>Maksimal <strong>{p.max_items} Item</strong> Produk</>}</span>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: p.has_custom_domain ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              <Crown size={15} color={p.has_custom_domain ? '#d97706' : 'var(--text-muted)'} />
                              <span style={{ fontWeight: p.has_custom_domain ? 700 : 500 }}>
                                Custom Domain: {p.has_custom_domain ? 'Didukung (brand.com)' : 'Eksklusif Pro Bisnis'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: '1.25rem' }}>
                          {isPendingTarget ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                                if (onViewOrders) onViewOrders();
                              }}
                              style={{
                                width: '100%',
                                minHeight: '44px',
                                textAlign: 'center',
                                padding: '0.5rem',
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                borderRadius: '0.5rem',
                                backgroundColor: isPendingVerifying ? '#d97706' : '#2563eb',
                                color: '#ffffff',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              <Clock size={14} />
                              <span>{isPendingVerifying ? 'Lihat Detail Tagihan' : 'Lanjutkan Pembayaran'}</span>
                            </button>
                          ) : (hasActivePendingOrder && isCurrent && p.code === 'free') ? (
                            <div style={{
                              textAlign: 'center',
                              padding: '0.5rem',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              color: '#10b981',
                              backgroundColor: 'rgba(16, 185, 129, 0.12)',
                              borderRadius: '0.5rem'
                            }}>
                              Aktif Sementara
                            </div>
                          ) : (hasActivePendingOrder && !(p.code === 'free' && currentRank > 0)) ? (
                            <button
                              type="button"
                              disabled={true}
                              style={{
                                width: '100%',
                                minHeight: '44px',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                                color: 'var(--text-muted)',
                                border: '1px solid var(--border-light)',
                                fontWeight: 700,
                                fontSize: '0.76rem',
                                cursor: 'not-allowed',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem',
                                opacity: 0.75
                              }}
                              title={isPendingVerifying ? 'Menunggu tim finance memverifikasi tagihan aktif.' : 'Selesaikan atau batalkan tagihan aktif terlebih dahulu.'}
                            >
                              <Lock size={14} style={{ flexShrink: 0 }} />
                              <span>{isPendingVerifying ? 'Terkunci Selama Verifikasi' : 'Selesaikan / Batalkan Tagihan Aktif'}</span>
                            </button>
                          ) : isCurrent ? (
                            p.code !== 'free' ? (
                              canRenewCurrentPlan ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPlanCode(p.code);
                                    setCheckoutStep('payment_detail');
                                  }}
                                  style={{
                                    width: '100%',
                                    minHeight: '44px',
                                    padding: '0.55rem 0.75rem',
                                    borderRadius: '0.55rem',
                                    fontWeight: 800,
                                    fontSize: '0.82rem',
                                    backgroundColor: 'var(--primary)',
                                    color: '#ffffff',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.15rem'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <RotateCcw size={14} />
                                    <span>Perpanjang Paket Ini</span>
                                  </div>
                                  <span style={{ fontSize: '0.68rem', opacity: 0.9 }}>
                                    {currentQuota?.is_in_grace_period ? 'Masa Tenggang' : `Sisa ${currentQuota?.days_remaining || 0} hari`}
                                  </span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={true}
                                  style={{
                                    width: '100%',
                                    minHeight: '44px',
                                    padding: '0.55rem 0.75rem',
                                    borderRadius: '0.55rem',
                                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                                    color: 'var(--text-muted)',
                                    border: '1px solid var(--border-light)',
                                    fontWeight: 700,
                                    fontSize: '0.82rem',
                                    cursor: 'not-allowed',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.15rem',
                                    opacity: 0.75
                                  }}
                                  title={`Paket masih aktif (${currentQuota?.days_remaining || 0} hari tersisa). Perpanjangan baru dapat dilakukan saat memasuki masa kedaluwarsa (H-3).`}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                                    <span>Perpanjang Paket Ini</span>
                                  </div>
                                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                    Tersedia saat H-3 ({currentQuota?.days_remaining || 0} hari tersisa)
                                  </span>
                                </button>
                              )
                            ) : (
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
                            )
                          ) : (p.code === 'free' && currentRank > 0) ? (
                            <div style={{
                              textAlign: 'center',
                              padding: '0.5rem',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              color: 'var(--text-muted)',
                              backgroundColor: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid var(--border-light)',
                              borderRadius: '0.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.35rem'
                            }}>
                              <CheckCircle2 size={14} style={{ color: 'var(--text-muted)' }} />
                              <span>Status Dasar Otomatis</span>
                            </div>
                          ) : (isDowngrade && p.code !== 'free') ? (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTargetPlan(p);
                                setCheckoutStep('downgrade_confirm');
                              }}
                              style={{
                                textAlign: 'center',
                                padding: '0.5rem',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                borderRadius: '0.5rem',
                                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                color: '#f59e0b',
                                border: '1px solid rgba(245, 158, 11, 0.4)',
                                cursor: 'pointer'
                              }}
                            >
                              Pilih untuk Siklus Berikutnya
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPlanCode(p.code);
                                setCheckoutStep('payment_detail');
                              }}
                              style={{
                                width: '100%',
                                minHeight: '44px',
                                textAlign: 'center',
                                padding: '0.5rem',
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--primary)',
                                color: '#ffffff',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              {currentRank === 0 ? `Upgrade ke ${p.name}` : `Pindah ke ${p.name}`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          ) : checkoutStep === 'downgrade_confirm' && selectedTargetPlan ? (
            /* Billing Transition Sheet (Downgrade Antar-Tier) */
            (() => {
              const activeItemsCount = currentQuota?.active_items_count || 0;
              const targetMaxItems = selectedTargetPlan.max_items;
              const isUnlimited = targetMaxItems === -1;
              const isOverQuota = !isUnlimited && activeItemsCount > targetMaxItems;
              const overQuotaCount = isOverQuota ? activeItemsCount - targetMaxItems : 0;
              const targetPriceStr = selectedTargetPlan.price_monthly > 0
                ? `Rp ${selectedTargetPlan.price_monthly.toLocaleString('id-ID')} / bulan`
                : 'Gratis';
              const expirationDateStr = currentQuota?.plan_expires_at
                ? new Date(currentQuota.plan_expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'akhir periode aktif';

              return (
                <div style={{ padding: '1rem 0.5rem', maxWidth: '640px', margin: '0 auto' }}>
                  <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      background: 'rgba(37, 99, 235, 0.12)',
                      border: '2px solid #3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 0.75rem',
                      color: '#3b82f6'
                    }}>
                      <Calendar size={28} />
                    </div>

                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem' }}>
                      Pemesanan Siklus Berikutnya: {selectedTargetPlan.name}
                    </h3>

                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
                      Penyesuaian paket ke <strong>{selectedTargetPlan.name}</strong> akan dijadwalkan dan mulai berlaku saat masa aktif paket Anda saat ini berakhir pada <strong>{expirationDateStr}</strong>.
                    </p>
                  </div>

                  {/* Live Product Quota Impact Calculator Card */}
                  <div style={{
                    background: isOverQuota ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                    border: isOverQuota ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '0.85rem',
                    padding: '1.15rem',
                    marginBottom: '1.15rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      {isOverQuota ? (
                        <AlertTriangle size={20} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                      ) : (
                        <CheckCircle2 size={20} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                      )}
                      <div>
                        <strong style={{ fontSize: '0.88rem', color: isOverQuota ? '#f59e0b' : '#10b981', display: 'block', marginBottom: '0.25rem' }}>
                          {isOverQuota ? 'Perhatian: Penyesuaian Kuota Produk' : 'Kalkulator Kuota: Aman 100%'}
                        </strong>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                          {isOverQuota ? (
                            <>
                              Toko Anda saat ini memiliki <strong>{activeItemsCount} produk aktif</strong>, sedangkan batas kuota paket {selectedTargetPlan.name} adalah <strong>{targetMaxItems} item</strong>. Sebanyak <strong>{overQuotaCount} produk terlama</strong> akan diarsipkan otomatis saat transisi {expirationDateStr}. Foto &amp; spesifikasi produk tetap tersimpan aman di database dan dapat dipulihkan sewaktu-waktu saat Anda melakukan upgrade.
                            </>
                          ) : (
                            <>
                              Toko Anda memiliki <strong>{activeItemsCount} produk aktif</strong>. Seluruh produk berada di dalam batas kuota <strong>{isUnlimited ? 'Unlimited' : targetMaxItems} item</strong> pada paket {selectedTargetPlan.name}. <strong>Tidak ada produk yang akan diarsipkan.</strong>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Rights and Financial Details */}
                  <div style={{
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '0.85rem',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    marginBottom: '1.25rem',
                    fontSize: '0.8rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                      <Check size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                      <span><strong>Sisa Hari Penuh:</strong> Fitur paket {currentQuota?.plan?.name} Anda ({currentQuota?.days_remaining || 0} hari tersisa) tetap aktif 100% hingga {expirationDateStr} tanpa diputus di tengah jalan.</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                      <CreditCard size={16} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
                      <span><strong>Biaya Siklus Depan:</strong> {targetPriceStr}. Pembayaran perpanjangan dilakukan secara manual melalui QRIS / Transfer Bank saat jatuh tempo (tanpa auto-debit).</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                      <RotateCcw size={16} style={{ color: '#a855f7', flexShrink: 0, marginTop: '2px' }} />
                      <span><strong>Bisa Dibatalkan Kapan Saja:</strong> Jadwal perubahan paket ini dapat Anda batalkan sewaktu-waktu sebelum tanggal {expirationDateStr} melalui dashboard langganan.</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setCheckoutStep('plan_select')}
                      style={{
                        flex: 1,
                        minHeight: '44px',
                        padding: '0.75rem',
                        borderRadius: '0.65rem',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        border: '1px solid var(--border-light)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      Kembali
                    </button>
                    <button
                      type="button"
                      disabled={internalLoading}
                      onClick={handleConfirmDowngrade}
                      style={{
                        flex: 1.3,
                        minHeight: '44px',
                        padding: '0.75rem',
                        borderRadius: '0.65rem',
                        fontWeight: 800,
                        fontSize: '0.84rem',
                        backgroundColor: 'var(--primary)',
                        color: '#ffffff',
                        border: 'none',
                        cursor: internalLoading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {internalLoading ? 'Menyimpan Jadwal...' : 'Konfirmasi Jadwal Penyesuaian'}
                    </button>
                  </div>
                </div>
              );
            })()
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
                          <strong>Bulanan (1 Bulan)</strong>
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

                    {/* Coupon Input Section (hidden during maintenance) */}
                    {!isMaintenance && (
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
                    )}

                    <div style={{
                      paddingTop: '0.85rem',
                      borderTop: '1px solid var(--border-light)',
                      marginTop: '1rem'
                    }}>
                      {(appliedCoupon || prorationCredit > 0) && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                            <span>Subtotal Normal</span>
                            <span>Rp {totalPrice.toLocaleString('id-ID')}</span>
                          </div>
                          {prorationCredit > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#0284c7', fontWeight: 700, marginBottom: '0.35rem' }}>
                              <span>Kredit Prorata Sisa Paket</span>
                              <span>- Rp {prorationCredit.toLocaleString('id-ID')}</span>
                            </div>
                          )}
                          {appliedCoupon && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#10b981', fontWeight: 700, marginBottom: '0.5rem' }}>
                              <span>Diskon Promo ({appliedCoupon.code})</span>
                              <span>- Rp {discountAmount.toLocaleString('id-ID')}</span>
                            </div>
                          )}
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
                                <div style={{
                                  padding: '0.45rem 0.65rem',
                                  borderRadius: '0.45rem',
                                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                                  border: '1px solid rgba(59, 130, 246, 0.25)',
                                  fontSize: '0.72rem',
                                  color: 'var(--text-secondary)',
                                  marginTop: '0.25rem'
                                }}>
                                  Kode unik nominal akan ditambahkan pada tagihan untuk mempermudah verifikasi mutasi transfer rekening.
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
                                <div style={{ width: '120px', height: '120px', background: '#ffffff', borderRadius: '8px', padding: '6px', border: '1px solid var(--primary)', overflow: 'hidden' }}>
                                  <img
                                    src={manualQrisImage}
                                    alt="QRIS"
                                    onError={(e: any) => { e.currentTarget.src = '/img/qris_demo.svg'; }}
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={handleDownloadQRIS}
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
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Download size={13} />
                                  <span>Unduh QRIS</span>
                                </button>
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                                  <strong style={{ color: 'var(--text-primary)', display: 'block', fontSize: '0.82rem' }}>{manualQrisMerchant}</strong>
                                  <span>Buka aplikasi m-banking atau e-wallet Anda dan scan QRIS resmi di atas.</span>
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
            {hasActivePendingOrder ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                <Lock size={14} style={{ color: isPendingVerifying ? '#d97706' : '#2563eb', flexShrink: 0 }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tagihan aktif:</span>
                <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  {activePendingOrder?.order_number || 'Menunggu Proses'}
                </strong>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: isPendingVerifying ? '#d97706' : '#2563eb'
                }}>
                  ({isPendingVerifying ? 'Sedang Diverifikasi' : 'Menunggu Pembayaran'})
                </span>
              </div>
            ) : (
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Paket dipilih: </span>
                <strong style={{ fontSize: '0.88rem' }}>{selectedPlan?.name}</strong>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--primary)', marginLeft: '0.5rem' }}>
                  (Rp {totalPrice.toLocaleString('id-ID')} / bulan)
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
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
                {hasActivePendingOrder ? 'Tutup' : 'Batal'}
              </button>
              {hasActivePendingOrder ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onViewOrders) onViewOrders();
                  }}
                  style={{
                    minHeight: '44px',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    backgroundColor: isPendingVerifying ? '#d97706' : '#2563eb',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    cursor: 'pointer'
                  }}
                >
                  <Clock size={15} />
                  <span>{isPendingVerifying ? 'Lihat Detail Tagihan' : 'Lanjutkan Pembayaran'}</span>
                </button>
              ) : (() => {
                const currentCode = currentQuota?.plan?.code || 'free';
                const isSelectedCurrent = selectedPlan?.code === currentCode && currentCode !== 'free';
                const isRenewalDisabled = isSelectedCurrent && !canRenewCurrentPlan;

                return (
                  <button
                    type="button"
                    disabled={isRenewalDisabled}
                    onClick={handleProceedToPayment}
                    style={{
                      minHeight: '44px',
                      padding: '0.5rem 1.5rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      backgroundColor: isRenewalDisabled ? 'rgba(255, 255, 255, 0.05)' : 'var(--primary)',
                      color: isRenewalDisabled ? 'var(--text-muted)' : '#ffffff',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: isRenewalDisabled ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isRenewalDisabled ? 'Paket Masih Aktif' : 'Lanjutkan ke Pembayaran'}
                    {!isRenewalDisabled && <ArrowRight size={16} />}
                  </button>
                );
              })()}
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
  const hasPendingOrder = Boolean(
    quota?.pending_order &&
    ['pending', 'pending_verification'].includes(String(quota.pending_order.payment_status || '').toLowerCase())
  );
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
          title={hasPendingOrder ? 'Lihat Status Tagihan Langganan' : (isFree ? 'Upgrade ke Paket Pro' : 'Kelola Paket Langganan')}
          style={{
            minHeight: '34px',
            padding: '0.35rem 0.75rem',
            borderRadius: '0.5rem',
            border: hasPendingOrder ? '1px solid rgba(217,119,6,0.45)' : (isFree ? 'none' : '1px solid var(--border-light)'),
            backgroundColor: hasPendingOrder ? 'rgba(217,119,6,0.12)' : (isFree ? 'var(--primary)' : 'var(--bg-deep)'),
            color: hasPendingOrder ? '#d97706' : (isFree ? '#ffffff' : 'var(--text-primary)'),
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            flexShrink: 0,
            boxShadow: (!hasPendingOrder && isFree) ? '0 2px 6px var(--primary-glow)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          {hasPendingOrder ? (
            <>
              <Clock size={13} style={{ flexShrink: 0 }} />
              <span>Cek Status Tagihan</span>
            </>
          ) : isFree ? (
            <>
              <Sparkles size={13} style={{ flexShrink: 0 }} />
              <span>Upgrade ke Pro</span>
            </>
          ) : (
            <>
              <Settings2 size={13} style={{ flexShrink: 0 }} />
              <span>Kelola Paket</span>
            </>
          )}
        </button>
      </div>

      {quota?.next_plan && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: '0.7rem',
          color: '#d97706',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          padding: '0.3rem 0.55rem',
          borderRadius: '0.45rem'
        }}>
          <Clock size={12} style={{ flexShrink: 0 }} />
          <span>Jadwal downgrade aktif: <strong>{quota.next_plan.name}</strong></span>
        </div>
      )}

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
