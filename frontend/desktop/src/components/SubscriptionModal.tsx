import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Infinity,
  Archive,
  ShieldAlert,
  ExternalLink,
  RefreshCw,
  Settings2,
  Tag,
  Building2,
  Eye,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { SafeImage } from './SafeImage';
import { ProofLightbox } from './ProofLightbox';
import { useModalBackHandler } from '../utils/navigation';

export const resolveProofImageUrl = (order: any, token?: string | null): string => {
  if (!order) return '';
  const raw = order.payment_proof_url || order.proof_url || '';
  if (raw && (raw.startsWith('data:') || raw.startsWith('blob:'))) {
    return raw;
  }
  if (raw && (raw.startsWith('http://') || raw.startsWith('https://'))) {
    return raw;
  }
  const identifier = order.id || order.order_number;
  if (identifier) {
    const t = token ? `?token=${encodeURIComponent(token)}` : '';
    return `/api/subscription/orders/${encodeURIComponent(String(identifier))}/proof${t}`;
  }
  if (!raw) return '';
  return raw.startsWith('/') ? raw : `/storage/${raw}`;
};

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
  initialOrders?: any[];
  initialSelectedOrder?: any;
  initialProofUrl?: string | null;
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
  isLoading = false,
  initialOrders,
  initialSelectedOrder,
  initialProofUrl
}) => {
  const effectiveQuota = currentQuota || quota;
  const [modalView, setModalView] = useState<'plans' | 'checkout' | 'downgrade_confirm' | 'orders'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const v = (params.get('view') || params.get('sub') || '').toLowerCase();
      if (['orders', 'riwayat', 'tagihan', 'billing'].includes(v) || params.get('order') || params.get('proof')) {
        return 'orders';
      }
    }
    return 'plans';
  });
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedTargetPlan, setSelectedTargetPlan] = useState<SubscriptionPlanData | null>(null);
  const [checkoutType, setCheckoutType] = useState<'upgrade' | 'renewal'>('upgrade');
  
  // Checkout Form State
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'qris'>('qris');
  const [aulaaChannel, setAulaaChannel] = useState<'qris' | 'va' | 'ewallet' | 'cc'>('qris');
  const [senderAccountName, setSenderAccountName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [copiedAccountToast, setCopiedAccountToast] = useState(false);

  // Invoices / Orders State
  const [orders, setOrders] = useState<any[]>(() => initialOrders || []);
  const ordersRef = useRef<any[]>([]);
  ordersRef.current = orders;
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [syncingOrderId, setSyncingOrderId] = useState<number | null>(null);
  const [selectedDesktopOrder, setSelectedDesktopOrder] = useState<any | null>(() => {
    // Only initialize if explicitly provided and NOT viewing proof on reload
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('proof')) return null;
    }
    return initialSelectedOrder || null;
  });
  const [copiedDesktopRefToast, setCopiedDesktopRefToast] = useState(false);
  const [previewDesktopProofImg, setPreviewDesktopProofImg] = useState<string | null>(() => initialProofUrl || null);

  // Clean standalone ?order= param on reload/mount if not viewing proof
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('order') && !params.has('proof')) {
        params.delete('order');
        const q = params.toString();
        window.history.replaceState(
          { ...window.history.state, subView: 'orders', orderId: undefined },
          '',
          `${window.location.pathname}${q ? '?' + q : ''}`
        );
      }
    }
  }, []);

  // Action Feedback
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);

  // Live Platform Payment Settings (dynamically synced with /api/settings)
  const [livePlatformSettings, setLivePlatformSettings] = useState<Record<string, any>>({});

  const fetchFreshPlatformSettings = async () => {
    try {
      const res = await fetch(`${apiBase}/settings`, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        if (data && typeof data === 'object') {
          setLivePlatformSettings(data);
        }
      }
    } catch {
      // Fallback to prop settings if offline
    }
  };

  useEffect(() => {
    if (isOpen || isPage) {
      fetchFreshPlatformSettings();
    }
  }, [isOpen, isPage, modalView]);

  useEffect(() => {
    if (!isOpen && !isPage) return;
    const handleSyncSettings = () => {
      fetchFreshPlatformSettings();
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'catavor_platform_settings_updated') {
        fetchFreshPlatformSettings();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchFreshPlatformSettings();
      }
    };
    window.addEventListener('focus', handleSyncSettings);
    window.addEventListener('catavor_platform_settings_updated', handleSyncSettings);
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleSyncSettings);
      window.removeEventListener('catavor_platform_settings_updated', handleSyncSettings);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isOpen, isPage, apiBase]);

  const effectiveSettings = { ...settings, ...livePlatformSettings };

  useEffect(() => {
    const showQRIS = effectiveSettings?.payment_aulaa_channel_qris !== '0';
    const showVA = effectiveSettings?.payment_aulaa_channel_va !== '0';
    const showEWallet = effectiveSettings?.payment_aulaa_channel_ewallet !== '0';
    const showCC = effectiveSettings?.payment_aulaa_channel_cc === '1';
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
    effectiveSettings?.payment_aulaa_channel_qris,
    effectiveSettings?.payment_aulaa_channel_va,
    effectiveSettings?.payment_aulaa_channel_ewallet,
    effectiveSettings?.payment_aulaa_channel_cc,
    aulaaChannel
  ]);

  useEffect(() => {
    if (isOpen) {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const v = (params?.get('view') || params?.get('sub') || '').toLowerCase();
      const isOrdersUrl = ['orders', 'riwayat', 'tagihan', 'billing'].includes(v) || Boolean(params?.get('order')) || Boolean(params?.get('proof'));
      if (!isOrdersUrl) {
        setModalView('plans');
      }
      setActionSuccess(null);
      setActionError(null);
      setAppliedCoupon(null);
      setCouponInput('');
      setCouponMsg(null);
      setPaymentProofUrl('');
      setProofPreview(null);
      setSenderAccountName('');
      setSenderPhone('');
      setAulaaChannel('qris');
    }
  }, [isOpen]);

  useEffect(() => {
    // Detect ?plan= query param to auto-open checkout
    if (typeof window !== 'undefined' && plans && plans.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const planParam = params.get('plan');
      if (planParam) {
        const matched = plans.find(p => p.code?.toLowerCase() === planParam.toLowerCase());
        if (matched && matched.code !== 'free') {
          openCheckout(matched, 'upgrade');
          const url = new URL(window.location.href);
          url.searchParams.delete('plan');
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
        }
      }
    }
  }, [plans]);

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

  const changeView = (nextView: 'plans' | 'checkout' | 'downgrade_confirm' | 'orders') => {
    setModalView(nextView);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (nextView === 'orders') {
        url.searchParams.set('view', 'orders');
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length >= 2 && parts[1] === 'admin') {
          url.pathname = `/${parts[0]}/admin/subscription`;
        }
      } else {
        url.searchParams.delete('view');
        url.searchParams.delete('order');
        url.searchParams.delete('proof');
      }
      window.history.pushState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
    }
  };

  const handleOpenDesktopOrder = (ord: any) => {
    setSelectedDesktopOrder(ord);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'orders');
      url.searchParams.delete('order');
      url.searchParams.delete('proof');
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && parts[1] === 'admin') {
        url.pathname = `/${parts[0]}/admin/subscription`;
      }
      window.history.pushState(
        { subView: 'order_detail', orderId: ord.order_number || ord.id },
        '',
        url.pathname + (url.search ? url.search : '') + url.hash
      );
    }
  };

  const handleCloseDesktopOrder = () => {
    setSelectedDesktopOrder(null);
    setPreviewDesktopProofImg(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('order');
      url.searchParams.delete('proof');
      if (window.history.state?.subView === 'order_detail' && window.history.length > 1) {
        window.history.back();
        return;
      }
      window.history.pushState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
    }
  };

  const handleOpenDesktopProof = (rawUrl?: string, ord?: any) => {
    const targetOrd = ord || selectedDesktopOrder;
    const finalUrl = resolveProofImageUrl(targetOrd, token) || rawUrl || '';
    if (!finalUrl) return;

    setPreviewDesktopProofImg(finalUrl);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'orders');
      if (targetOrd) {
        url.searchParams.set('order', String(targetOrd.order_number || targetOrd.id));
      }
      url.searchParams.set('proof', '1');
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && parts[1] === 'admin') {
        url.pathname = `/${parts[0]}/admin/subscription`;
      }
      window.history.pushState(
        { subView: 'order_proof', orderId: targetOrd?.order_number || targetOrd?.id },
        '',
        url.pathname + (url.search ? url.search : '') + url.hash
      );
    }
  };

  const handleCloseDesktopProof = () => {
    setPreviewDesktopProofImg(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (window.history.state?.subView === 'order_proof' && window.history.length > 1) {
        window.history.back();
        return;
      }
      url.searchParams.delete('proof');
      url.searchParams.delete('order');
      window.history.pushState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
    }
  };

  useModalBackHandler({
    isOpen: previewDesktopProofImg !== null,
    onClose: handleCloseDesktopProof,
    modalId: 'desktop_subscription_proof_lightbox'
  });

  useModalBackHandler({
    isOpen: selectedDesktopOrder !== null,
    onClose: handleCloseDesktopOrder,
    modalId: 'desktop_subscription_order_detail'
  });

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === 'undefined' || window.__catavor_is_modal_popping) return;
      const params = new URLSearchParams(window.location.search);
      const v = (params.get('view') || params.get('sub') || '').toLowerCase();
      const isOrdersUrl = ['orders', 'riwayat', 'tagihan', 'billing'].includes(v) || Boolean(params.get('order')) || Boolean(params.get('proof'));
      if (isOrdersUrl) {
        setModalView('orders');
        const orderParam = params.get('order');
        const proofParam = params.get('proof');
        if (!proofParam) {
          setPreviewDesktopProofImg(null);
        }
        if (window.history.state?.subView !== 'order_detail' && !proofParam) {
          setSelectedDesktopOrder(null);
        }
      } else if (modalView === 'orders') {
        setModalView('plans');
        setSelectedDesktopOrder(null);
        setPreviewDesktopProofImg(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [modalView]);

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
        body: JSON.stringify({
          code: couponInput.trim(),
          plan: selectedTargetPlan?.code,
          billing_cycle: billingCycle
        })
      });
      const data = await res.json();
      const couponObj = data.coupon || data.data;
      if (res.ok && (data.success || data.valid) && couponObj) {
        setAppliedCoupon(couponObj);
        const discountVal = Number(couponObj.discount || couponObj.discount_amount || couponObj.discount_value || 0);
        const discountLabel = couponObj.type === 'free' ? 'Gratis 100%' : `Potongan Rp ${discountVal.toLocaleString('id-ID')}`;
        setCouponMsg({ type: 'success', text: `Kupon "${couponObj.code}" aktif! (${couponObj.label || discountLabel})` });
      } else {
        setAppliedCoupon(null);
        setCouponMsg({ type: 'error', text: data.message || 'Kode promo/kupon tidak valid atau telah kedaluwarsa.' });
      }
    } catch (err) {
      setAppliedCoupon(null);
      setCouponMsg({ type: 'error', text: 'Gagal memverifikasi kupon. Periksa koneksi internet.' });
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponMsg(null);
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
      formData.append('category', 'billing');

      const res = await fetch(`${apiBase}/storage/upload?category=billing`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      });

      const data = await res.json();
      const uploadedUrl = data.url || data.storage_key || data.key || (data.data && (data.data.url || data.data.storage_key || data.data.key));
      if (res.ok && data.success && uploadedUrl) {
        setPaymentProofUrl(uploadedUrl);
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
    let discountAmount = 0;

    if (appliedCoupon) {
      if (appliedCoupon.type === 'free') {
        discountAmount = originalPrice;
      } else if (appliedCoupon.discount !== undefined && appliedCoupon.discount !== null) {
        discountAmount = Number(appliedCoupon.discount) || 0;
      } else if (appliedCoupon.discount_amount !== undefined && appliedCoupon.discount_amount !== null) {
        discountAmount = Number(appliedCoupon.discount_amount) || 0;
      } else if (appliedCoupon.discount_value !== undefined && appliedCoupon.discount_value !== null) {
        discountAmount = Number(appliedCoupon.discount_value) || 0;
      } else if (appliedCoupon.discount_percent !== undefined && appliedCoupon.discount_percent !== null) {
        discountAmount = Math.round((originalPrice * Number(appliedCoupon.discount_percent)) / 100);
      }
    }

    if (discountAmount > originalPrice) {
      discountAmount = originalPrice;
    }
    const finalAmount = Math.max(0, originalPrice - discountAmount);
    const discountPercent = originalPrice > 0 ? Math.round((discountAmount / originalPrice) * 100) : 0;

    return { originalPrice, discountPercent, discountAmount, finalAmount };
  };

  const calculateFinalCheckoutPrice = () => {
    if (!selectedTargetPlan) return { originalPrice: 0, discountPercent: 0, discountAmount: 0, finalPrice: 0 };
    const { originalPrice, discountPercent, discountAmount, finalAmount } = calculateFinalPrice(selectedTargetPlan, billingCycle);
    return { originalPrice, discountPercent, discountAmount, finalPrice: finalAmount };
  };

  const handleSubmitOrder = async () => {
    if (!selectedTargetPlan) return;
    
    const systemPaymentMode = (effectiveSettings?.payment_system_mode || 'gateway_aulaa').toLowerCase();
    if (systemPaymentMode === 'maintenance') {
      setActionError('Sistem transaksi pembayaran sedang dalam masa pemeliharaan berkala.');
      return;
    }

    const { finalPrice } = calculateFinalCheckoutPrice();
    const isGateway = finalPrice > 0 && systemPaymentMode === 'gateway_aulaa';

    // For manual methods, proof is mandatory
    if (finalPrice > 0 && !isGateway && !paymentProofUrl) {
      setActionError('Harap unggah bukti transfer pembayaran sebelum mengirim pesanan.');
      return;
    }

    if (finalPrice > 0 && systemPaymentMode === 'manual_qris' && !senderAccountName.trim()) {
      setActionError('Harap cantumkan nama akun rekening/e-wallet pengirim untuk mempermudah verifikasi mutasi.');
      return;
    }

    setActionError(null);
    setInternalLoading(true);

    try {
      const durationMonths = billingCycle === 'monthly' ? 1 : 12;
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
          type: checkoutType,
          duration_months: durationMonths,
          billing_cycle: billingCycle,
          payment_method: orderPaymentMethod,
          payment_mode: orderPaymentMode,
          sender_account_name: senderAccountName.trim(),
          sender_phone: senderPhone.trim(),
          payment_proof_url: paymentProofUrl,
          redirect_url: window.location.href,
          coupon_code: appliedCoupon?.code || undefined,
          notes: `Checkout ${checkoutType} ke ${selectedTargetPlan.name} (${billingCycle}) via Web Dashboard`
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal mengirim pesanan langganan.');
      }

      // If gateway payment link returned, redirect directly
      if (data.order?.gateway_payment_link) {
        window.location.href = data.order.gateway_payment_link;
        return;
      }

      // If gateway order with non-zero price, but no gateway payment link was generated
      if (isGateway && finalPrice > 0) {
        throw new Error('Gagal mendapatkan tautan pembayaran Aulaa. Saluran pembayaran sedang tidak tersedia atau hubungi admin.');
      }

      const ordNumber = data.order?.order_number || data.order?.invoice_number || '';
      const uniqueMsg = data.order?.unique_code ? ` (termasuk kode unik transfer Rp ${data.order.unique_code})` : '';
      setActionSuccess(`Pesanan #${ordNumber} berhasil dibuat!${uniqueMsg} Verifikator akan memproses aktivasi paket Anda segera.`);
      setModalView('orders');
      fetchOrders();
      if (onSuccessUpgrade && finalPrice === 0) onSuccessUpgrade();
    } catch (err: any) {
      setActionError(err.message || 'Gagal memproses pesanan.');
    } finally {
      setInternalLoading(false);
    }
  };

  const handleProcessCheckout = handleSubmitOrder;

  const handleSyncOrder = async (orderId: number) => {
    setSyncingOrderId(orderId);
    setActionError(null);
    try {
      const res = await fetch(`${apiBase}/subscription/orders/${orderId}/sync`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const currentSt = data.order?.payment_status?.toUpperCase() || 'UNKNOWN';
        setActionSuccess(`Sinkronisasi berhasil: Status pesanan #${data.order?.order_number || orderId} adalah ${currentSt}.`);
        fetchOrders();
        if (data.order?.payment_status === 'paid' && onSuccessUpgrade) {
          onSuccessUpgrade();
        }
      } else {
        setActionError(data.message || 'Gagal menyinkronkan status pesanan.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Gagal menghubungi server sinkronisasi.');
    } finally {
      setSyncingOrderId(null);
    }
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
        const orderList = data.data || data.orders || [];
        setOrders(orderList);

        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const orderParam = params.get('order');
          const proofParam = params.get('proof');
          if (orderParam && orderList.length > 0) {
            const matched = orderList.find((o: any) => 
              String(o.order_number).toLowerCase() === orderParam.toLowerCase() || 
              String(o.id) === orderParam
            );
            if (matched) {
              if (proofParam) {
                setPreviewDesktopProofImg(resolveProofImageUrl(matched, token));
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed fetching subscription orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (modalView === 'orders') {
      fetchOrders();
    }
  }, [modalView]);

  const handleConfirmDowngrade = async () => {
    if (!selectedTargetPlan) return;
    setActionError(null);
    setInternalLoading(true);

    try {
      const res = await fetch(`${apiBase}/subscription/schedule-downgrade`, {
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

  const systemPaymentMode = (effectiveSettings?.payment_system_mode || 'gateway_aulaa').toLowerCase();
  const isMaintenance = systemPaymentMode === 'maintenance';
  const maintenanceTitle = effectiveSettings?.payment_maintenance_title || 'Sistem Pembayaran Dalam Pemeliharaan';
  const maintenanceMessage = effectiveSettings?.payment_maintenance_message || 'Layanan transaksi pembayaran sedang dalam pemeliharaan berkala untuk peningkatan keandalan jaringan. Silakan hubungi admin atau coba beberapa saat lagi.';
  const manualQrisMerchant = effectiveSettings?.payment_qris_manual_merchant || 'Catavor Official Store';
  const manualQrisImage = effectiveSettings?.payment_qris_manual_image || effectiveSettings?.payment_qris_image || '/img/qris_demo.svg';
  const bankName = effectiveSettings?.payment_bank_name || 'Bank Central Asia (BCA)';
  const bankAccount = effectiveSettings?.payment_bank_account || '8830-1928-3920';
  const bankHolder = effectiveSettings?.payment_bank_holder || 'PT Catavor Media Digital';
  const qrisImage = effectiveSettings?.payment_qris_image || '/img/qris_demo.svg';

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
      window.open(manualQrisImage, '_blank');
    }
  };

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
              onClick={() => changeView('plans')}
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
                {modalView === 'plans' && 'Paket & Langganan Katalog'}
                {modalView === 'checkout' && (checkoutType === 'renewal' ? 'Checkout Perpanjangan Paket' : `Upgrade ke ${selectedTargetPlan?.name}`)}
                {modalView === 'downgrade_confirm' && 'Konfirmasi Penjadwalan Penurunan Paket'}
                {modalView === 'orders' && 'Riwayat Tagihan & Transaksi Langganan'}
              </h2>
            </div>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)' }}>
              {modalView === 'plans' && 'Pilih paket sesuai skala bisnis. Tingkatkan kuota produk, kapasitas storage, & fitur domain kustom.'}
              {modalView === 'checkout' && 'Selesaikan pembayaran untuk mengaktifkan kapasitas dan fitur eksklusif paket pilihan Anda.'}
              {modalView === 'downgrade_confirm' && 'Pelajari rincian perlindungan masa aktif dan penyesuaian kuota katalog Anda.'}
              {modalView === 'orders' && 'Daftar invoice, status pembayaran, dan riwayat aktivasi paket katalog Anda.'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {modalView === 'plans' && (
            <button
              type="button"
              onClick={() => {
                fetchOrders();
                changeView('orders');
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

          {modalView === 'orders' && (
            <button
              type="button"
              onClick={() => changeView('plans')}
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
              <Crown size={15} />
              <span>Pilihan Paket</span>
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'var(--btn-secondary-bg)',
                padding: '0.45rem 1.25rem',
                borderRadius: '0.65rem',
                border: '1px solid var(--btn-secondary-border)',
                color: 'var(--text-primary)',
                fontSize: '0.84rem',
                fontWeight: 700
              }}>
                <Calendar size={15} style={{ color: 'var(--primary)' }} />
                <span>Tagihan Bulanan (1 Bulan)</span>
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
                          <span><strong>{plan.max_items === -1 ? 'Unlimited' : `${plan.max_items}`}</strong> Item Katalog Aktif</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                          <HardDrive size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span><strong>{formatBytes(plan.storage_limit_bytes)}</strong> Kuota Cloud Storage</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                          <ImageIcon size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span>Hingga <strong>10</strong> Foto HD per Item</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                          <Film size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span>Video Embed Bebas Kuota (YouTube, Reels, TikTok)</span>
                        </div>

                        {plan.has_verified_badge && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                            <ShieldCheck size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                            <span>Lencana Katalog Terverifikasi (Centang Biru)</span>
                          </div>
                        )}

                        {plan.has_custom_domain && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                            <Globe size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                            <span><strong>Custom Domain Sendiri</strong> (brand.com)</span>
                          </div>
                        )}

                        {plan.has_priority_support && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                            <LifeBuoy size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                            <span>Prioritas Bantuan VIP Support Khusus</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: plan.code !== 'free' ? '#10b981' : 'var(--text-muted)' }}>
                          <Sparkles size={16} style={{ color: plan.code !== 'free' ? '#10b981' : 'var(--text-muted)', flexShrink: 0 }} />
                          <span>Iklan Sponsor: <strong>{plan.code !== 'free' ? '100% Bebas Iklan (Ad-Free)' : 'Didukung Iklan Sponsor'}</strong></span>
                        </div>
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
                  {(() => {
                    const { discountAmount } = calculateFinalCheckoutPrice();
                    if (appliedCoupon) {
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <Check size={16} color="#10b981" />
                            <div>
                              <strong style={{ fontSize: '0.84rem', color: '#10b981' }}>{appliedCoupon.code}</strong>
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginLeft: '0.4rem' }}>
                                (Hemat Rp {discountAmount.toLocaleString('id-ID')})
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveCoupon}
                            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', padding: '0.2rem 0.45rem' }}
                          >
                            Hapus
                          </button>
                        </div>
                      );
                    }
                    return (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      type="text"
                      placeholder="Contoh: CATAVOR100, DISKON10K"
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase());
                        if (couponMsg) setCouponMsg(null);
                      }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleApplyCoupon();
                            }
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
                    );
                  })()}
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

                  // Scenario 1: Maintenance Mode
                  if (isMaintenance) {
                    return (
                      <div style={{
                        padding: '1.75rem',
                        borderRadius: '1rem',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1.5px solid rgba(239, 68, 68, 0.35)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        gap: '1rem'
                      }}>
                        <div style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '50%',
                          background: 'rgba(239, 68, 68, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ef4444'
                        }}>
                          <ShieldAlert size={32} />
                        </div>
                        <div>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem' }}>
                            {maintenanceTitle}
                          </h4>
                          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
                            {maintenanceMessage}
                          </p>
                        </div>
                        <div style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '0.65rem',
                          background: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)'
                        }}>
                          Transaksi pembayaran checkout langganan ditangguhkan sementara demi keamanan dan peningkatan infrastruktur server.
                        </div>
                        <button
                          type="button"
                          disabled={true}
                          style={{
                            width: '100%',
                            padding: '0.85rem',
                            borderRadius: '0.65rem',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-light)',
                            fontWeight: 800,
                            fontSize: '0.86rem',
                            cursor: 'not-allowed'
                          }}
                        >
                          Pembayaran Sementara Ditangguhkan
                        </button>
                      </div>
                    );
                  }

                  // Scenario 2: 100% Free via Coupon
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
                          {internalLoading ? 'Mengaktifkan Paket...' : 'Aktifkan Paket Sekarang'}
                        </button>
                      </div>
                    );
                  }

                  const isGateway = systemPaymentMode === 'gateway_aulaa';
                  const isManualQris = systemPaymentMode === 'manual_qris';

                  if (isGateway) {
                    const showQRIS = effectiveSettings?.payment_aulaa_channel_qris !== '0';
                    const showVA = effectiveSettings?.payment_aulaa_channel_va !== '0';
                    const showEWallet = effectiveSettings?.payment_aulaa_channel_ewallet !== '0';
                    const showCC = effectiveSettings?.payment_aulaa_channel_cc === '1';

                    return (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem'
                      }}>
                        <div style={{
                          padding: '1.25rem',
                          borderRadius: '0.85rem',
                          background: 'var(--bg-deep, #0f172a)',
                          border: '1px solid var(--border-light, #334155)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                                <Zap size={20} />
                              </div>
                              <div>
                                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary, #f8fafc)', display: 'block' }}>
                                  Gerbang Pembayaran Instan (Aulaa)
                                </strong>
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>
                                  Aktivasi otomatis &amp; terenkripsi 256-bit
                                </span>
                              </div>
                            </div>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.25rem 0.6rem', borderRadius: '9999px', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                              <CheckCircle2 size={12} /> Otomatis &amp; Real-time
                            </span>
                          </div>

                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #cbd5e1)', margin: 0, lineHeight: 1.5 }}>
                            Pilih salah satu saluran pembayaran di bawah. Anda akan diarahkan ke halaman gerbang pembayaran resmi Aulaa. Paket toko Anda akan langsung aktif otomatis seketika setelah pembayaran berhasil tanpa perlu konfirmasi atau unggah bukti manual.
                          </p>

                          {/* Interactive Sub-channel Selector */}
                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)', marginBottom: '0.5rem', display: 'block' }}>
                              Pilih Saluran Pembayaran:
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                              {showQRIS && (
                                <button
                                  type="button"
                                  onClick={() => setAulaaChannel('qris')}
                                  style={{
                                    padding: '0.75rem 0.85rem',
                                    borderRadius: '0.65rem',
                                    backgroundColor: aulaaChannel === 'qris' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                    border: aulaaChannel === 'qris' ? '2px solid #10b981' : '1px solid var(--border-light, #334155)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.5rem',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <QrCode size={18} color="#10b981" />
                                    <div>
                                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)' }}>QRIS Instan</div>
                                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)' }}>GoPay, OVO, Dana, Shopee, BCA</div>
                                    </div>
                                  </div>
                                  {aulaaChannel === 'qris' && <Check size={16} color="#10b981" style={{ flexShrink: 0 }} />}
                                </button>
                              )}

                              {showVA && (
                                <button
                                  type="button"
                                  onClick={() => setAulaaChannel('va')}
                                  style={{
                                    padding: '0.75rem 0.85rem',
                                    borderRadius: '0.65rem',
                                    backgroundColor: aulaaChannel === 'va' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                    border: aulaaChannel === 'va' ? '2px solid #38bdf8' : '1px solid var(--border-light, #334155)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.5rem',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <CreditCard size={18} color="#38bdf8" />
                                    <div>
                                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)' }}>Virtual Account</div>
                                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)' }}>BCA, Mandiri, BRI, BNI, Permata</div>
                                    </div>
                                  </div>
                                  {aulaaChannel === 'va' && <Check size={16} color="#38bdf8" style={{ flexShrink: 0 }} />}
                                </button>
                              )}

                              {showEWallet && (
                                <button
                                  type="button"
                                  onClick={() => setAulaaChannel('ewallet')}
                                  style={{
                                    padding: '0.75rem 0.85rem',
                                    borderRadius: '0.65rem',
                                    backgroundColor: aulaaChannel === 'ewallet' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                    border: aulaaChannel === 'ewallet' ? '2px solid #f59e0b' : '1px solid var(--border-light, #334155)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.5rem',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <Zap size={18} color="#f59e0b" />
                                    <div>
                                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)' }}>Dompet Digital</div>
                                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)' }}>DANA, LinkAja, AstraPay</div>
                                    </div>
                                  </div>
                                  {aulaaChannel === 'ewallet' && <Check size={16} color="#f59e0b" style={{ flexShrink: 0 }} />}
                                </button>
                              )}

                              {showCC && (
                                <button
                                  type="button"
                                  onClick={() => setAulaaChannel('cc')}
                                  style={{
                                    padding: '0.75rem 0.85rem',
                                    borderRadius: '0.65rem',
                                    backgroundColor: aulaaChannel === 'cc' ? 'rgba(192, 132, 252, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                    border: aulaaChannel === 'cc' ? '2px solid #c084fc' : '1px solid var(--border-light, #334155)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.5rem',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <CreditCard size={18} color="#c084fc" />
                                    <div>
                                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)' }}>Kartu Kredit / Debit</div>
                                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)' }}>Visa, Mastercard, JCB</div>
                                    </div>
                                  </div>
                                  {aulaaChannel === 'cc' && <Check size={16} color="#c084fc" style={{ flexShrink: 0 }} />}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Submit Button for Aulaa Gateway */}
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
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                          }}
                        >
                          <span>{internalLoading ? 'Menyiapkan Pembayaran...' : `Lanjut ke Pembayaran Aulaa (Rp ${finalPrice.toLocaleString('id-ID')})`}</span>
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    );
                  }

                  // Non-gateway manual mode (manual_qris or manual_bank)
                  return (
                    <>
                      {/* Payment Method Selector */}
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          Pilih Jalur Pembayaran:
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
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
                            <span>QRIS Merchant</span>
                          </button>

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
                        </div>
                      </div>

                      {/* QRIS MANUAL DETAILS */}
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
                            border: '2px solid var(--primary)',
                            overflow: 'hidden'
                          }}>
                            <SafeImage
                              src={manualQrisImage}
                              fallbackSrc="/img/qris_demo.svg"
                              alt="QRIS Merchant"
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

                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={handleDownloadQRIS}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.4rem 0.8rem',
                                borderRadius: '0.5rem',
                                background: 'var(--btn-secondary-bg)',
                                border: '1px solid var(--btn-secondary-border)',
                                color: 'var(--text-primary)',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textDecoration: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              <Download size={14} />
                              <span>Unduh Gambar QRIS</span>
                            </button>
                          </div>

                          <div>
                            <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)', display: 'block' }}>
                              {manualQrisMerchant}
                            </strong>
                            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
                              Buka aplikasi m-banking atau e-wallet Anda dan scan QRIS resmi di atas.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* TRANSFER BANK MANUAL DETAILS */}
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

                          <div style={{
                            padding: '0.55rem 0.85rem',
                            borderRadius: '0.5rem',
                            background: 'rgba(59, 130, 246, 0.08)',
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                            fontSize: '0.74rem',
                            color: 'var(--text-secondary)',
                            textAlign: 'left'
                          }}>
                            Kode unik nominal akan ditambahkan pada tagihan untuk mempermudah pengecekan mutasi transfer rekening oleh admin verifikator.
                          </div>
                        </div>
                      )}

                      {/* Manual Verification Form: Sender Name, Phone & Proof Upload */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div>
                            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem', display: 'block' }}>
                              Nama Akun / Rekening Pengirim: <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="Contoh: Budi Santoso / Akun ShopeePay"
                              value={senderAccountName}
                              onChange={(e) => setSenderAccountName(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.55rem 0.75rem',
                                fontSize: '0.82rem',
                                borderRadius: '0.5rem',
                                background: 'var(--bg-deep)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem', display: 'block' }}>
                              Nomor WhatsApp Pengirim:
                            </label>
                            <input
                              type="tel"
                              placeholder="Contoh: 081234567890"
                              value={senderPhone}
                              onChange={(e) => setSenderPhone(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.55rem 0.75rem',
                                fontSize: '0.82rem',
                                borderRadius: '0.5rem',
                                background: 'var(--bg-deep)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>

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
                                      Bukti Berhasil Dipilih
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
                        </div>

                      {/* Submit Button for Manual Payment */}
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
                        <span>{internalLoading ? 'Memproses Aktivasi...' : `Kirim Bukti Pembayaran (Rp ${finalPrice.toLocaleString('id-ID')})`}</span>
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
                onClick={() => changeView('plans')}
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
                <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 0.6rem', display: 'block', opacity: 0.7 }} />
                Memuat riwayat transaksi langganan...
              </div>
            ) : orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}>
                <Receipt size={38} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Belum Ada Riwayat Transaksi</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Transaksi invoice dan bukti pembayaran langganan Anda akan tercatat di sini.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {orders.map((ord: any) => {
                  const status = ord.payment_status || ord.status || 'pending';
                  const isPaid = status === 'paid';
                  const isPending = status === 'pending';
                  const isPendingVerification = status === 'pending_verification';
                  const isRejected = status === 'rejected';
                  const isExpired = status === 'expired';

                  const statusBg = isPaid ? 'rgba(16, 185, 129, 0.12)' : isPending ? 'rgba(245, 158, 11, 0.12)' : isPendingVerification ? 'rgba(59, 130, 246, 0.12)' : isRejected ? 'rgba(239, 68, 68, 0.12)' : 'rgba(100, 116, 139, 0.12)';
                  const statusColor = isPaid ? '#10b981' : isPending ? '#f59e0b' : isPendingVerification ? '#3b82f6' : isRejected ? '#ef4444' : '#64748b';
                  const statusLabel = isPaid ? 'Lunas / Aktif' : isPending ? 'Menunggu Pembayaran' : isPendingVerification ? 'Verifikasi Admin' : isRejected ? 'Ditolak' : isExpired ? 'Kedaluwarsa' : status;

                  const mode = ord.payment_mode || (ord.final_amount === 0 ? 'coupon_free' : 'gateway_aulaa');
                  const isCoupon = mode === 'coupon_free' || ord.final_amount === 0;
                  const isGateway = mode === 'gateway_aulaa';
                  const isManualBank = mode === 'manual_bank' || ord.payment_method === 'bank';

                  let modeLabel = 'Manual QRIS';
                  let ModeIcon = QrCode;
                  let modeColor = '#10b981';
                  let modeBg = 'rgba(16, 185, 129, 0.12)';

                  if (isCoupon) {
                    modeLabel = 'Kupon Promo';
                    ModeIcon = Tag;
                    modeColor = '#a855f7';
                    modeBg = 'rgba(168, 85, 247, 0.12)';
                  } else if (isGateway) {
                    modeLabel = 'Gateway Aulaa';
                    ModeIcon = Zap;
                    modeColor = '#0284c7';
                    modeBg = 'rgba(14, 165, 233, 0.12)';
                  } else if (isManualBank) {
                    modeLabel = 'Transfer Bank';
                    ModeIcon = Building2;
                    modeColor = '#64748b';
                    modeBg = 'rgba(100, 116, 139, 0.12)';
                  }

                  const planName = (() => {
                    switch (ord.plan_code) {
                      case 'free': return 'Gratis Terbatas';
                      case 'pro_starter': return 'Pro Starter';
                      case 'pro_business': return 'Pro Bisnis';
                      default: return ord.plan_code || 'Paket Langganan';
                    }
                  })();

                  return (
                    <div
                      key={ord.id || ord.order_number}
                      style={{
                        padding: '1.15rem 1.35rem',
                        borderRadius: '0.85rem',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1.25rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '0.6rem',
                          background: modeBg,
                          color: modeColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <ModeIcon size={20} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.94rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                              {ord.order_number}
                            </strong>
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: statusBg,
                              color: statusColor,
                              border: `1px solid ${statusColor}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}>
                              {isPaid && <CheckCircle2 size={11} />}
                              {isPendingVerification && <Clock size={11} />}
                              {isPending && <AlertCircle size={11} />}
                              {isRejected && <XCircle size={11} />}
                              <span>{statusLabel}</span>
                            </span>
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background: modeBg,
                              color: modeColor,
                              border: `1px solid ${modeColor}`
                            }}>
                              {modeLabel}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Paket: <strong style={{ color: 'var(--text-primary)' }}>{planName}</strong> ({ord.billing_cycle === 'annual' ? 'Tahunan' : 'Bulanan'}) • Dipesan: {new Date(ord.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                          {isRejected && ord.rejection_reason && (
                            <div style={{ fontSize: '0.74rem', color: '#ef4444', marginTop: '0.25rem', fontWeight: 700 }}>
                              Alasan Penolakan: {ord.rejection_reason}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.45rem' }}>
                        <div>
                          <div style={{ fontSize: '1.08rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                            {ord.final_amount === 0 ? 'Rp 0 (Gratis)' : `Rp ${ord.final_amount?.toLocaleString('id-ID')}`}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenDesktopOrder(ord)}
                            style={{
                              minHeight: '34px',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '0.45rem',
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid var(--border-light)',
                              color: 'var(--text-primary)',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                          >
                            <FileText size={13} />
                            <span>Rincian Transaksi</span>
                          </button>

                          {isPending && isGateway && ord.gateway_payment_link && (
                            <a
                              href={ord.gateway_payment_link}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                minHeight: '34px',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '0.45rem',
                                background: 'var(--primary)',
                                color: '#ffffff',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              <ExternalLink size={13} />
                              <span>Bayar Online</span>
                            </a>
                          )}

                          {isPending && isGateway && ord.gateway_reference && (
                            <button
                              type="button"
                              disabled={syncingOrderId === ord.id}
                              onClick={() => handleSyncOrder(ord.id)}
                              style={{
                                minHeight: '34px',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '0.45rem',
                                background: 'var(--btn-secondary-bg)',
                                border: '1px solid var(--btn-secondary-border)',
                                color: 'var(--btn-secondary-text)',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              <RefreshCw size={13} className={syncingOrderId === ord.id ? 'animate-spin' : ''} />
                              <span>{syncingOrderId === ord.id ? 'Sinkron...' : 'Cek Status'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* DESKTOP DETAIL INSPECTOR MODAL */}
            {selectedDesktopOrder && !previewDesktopProofImg && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(5px)',
                  zIndex: 999999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2rem',
                  animation: 'fadeIn 0.2s ease'
                }}
                onClick={handleCloseDesktopOrder}
              >
                <div
                  style={{
                    width: '100%',
                    maxWidth: '680px',
                    maxHeight: '90vh',
                    backgroundColor: 'var(--bg-card, #1e293b)',
                    borderRadius: '1rem',
                    border: '1px solid var(--border-light, #334155)',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                    overflow: 'hidden'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* MODAL HEADER */}
                  <div style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid var(--border-light, #334155)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '0.5rem',
                        background: 'var(--primary-glow, rgba(16, 185, 129, 0.15))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary, #10b981)'
                      }}>
                        <Receipt size={22} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Rincian Transaksi Langganan
                        </h4>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          #{selectedDesktopOrder.order_number}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseDesktopOrder}
                      style={{
                        padding: '0.4rem',
                        borderRadius: '0.4rem',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* MODAL BODY */}
                  <div style={{
                    padding: '1.35rem 1.5rem',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.1rem'
                  }}>
                    {selectedDesktopOrder._isHydrating ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
                        <div style={{ height: '90px', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s infinite' }} />
                        <div style={{ height: '120px', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s infinite' }} />
                        <div style={{ height: '150px', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s infinite' }} />
                      </div>
                    ) : (
                      <>
                        {/* FINANCIAL SUMMARY */}
                    <div style={{
                      padding: '1.1rem',
                      borderRadius: '0.75rem',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-light, #334155)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Paket Langganan</span>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                          {(() => {
                            switch (selectedDesktopOrder.plan_code) {
                              case 'free': return 'Gratis Terbatas';
                              case 'pro_starter': return 'Pro Starter';
                              case 'pro_business': return 'Pro Bisnis';
                              default: return selectedDesktopOrder.plan_code || 'Paket Langganan';
                            }
                          })()}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Siklus Penagihan</span>
                        <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                          {selectedDesktopOrder.billing_cycle === 'annual' ? 'Tahunan (12 Bulan)' : 'Bulanan (1 Bulan)'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Waktu Pemesanan</span>
                        <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                          {new Date(selectedDesktopOrder.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {selectedDesktopOrder.paid_at && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Waktu Lunas</span>
                          <span style={{ fontSize: '0.84rem', color: '#10b981', fontWeight: 700 }}>
                            {new Date(selectedDesktopOrder.paid_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      )}
                      <div style={{ height: '1px', backgroundColor: 'var(--border-light, #334155)', margin: '0.25rem 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Harga Paket Asli</span>
                        <span style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                          Rp {Number(selectedDesktopOrder.original_amount || selectedDesktopOrder.final_amount || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      {selectedDesktopOrder.discount_amount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.82rem', color: '#a855f7' }}>Potongan Diskon Kupon</span>
                          <span style={{ fontSize: '0.86rem', color: '#a855f7', fontWeight: 700 }}>
                            -Rp {Number(selectedDesktopOrder.discount_amount).toLocaleString('id-ID')}
                          </span>
                        </div>
                      )}
                      {selectedDesktopOrder.unique_code > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--primary)' }}>Kode Unik Transfer</span>
                          <span style={{ fontSize: '0.86rem', color: 'var(--primary)', fontWeight: 700 }}>
                            +Rp {selectedDesktopOrder.unique_code}
                          </span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                        <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>Total Pembayaran</strong>
                        <strong style={{ fontSize: '1.15rem', color: 'var(--primary)', fontWeight: 900 }}>
                          {selectedDesktopOrder.final_amount === 0 ? 'Rp 0' : `Rp ${Number(selectedDesktopOrder.final_amount || 0).toLocaleString('id-ID')}`}
                        </strong>
                      </div>
                    </div>

                    {/* CONTEXTUAL BLOCK */}
                    {(() => {
                      const mode = selectedDesktopOrder.payment_mode || (selectedDesktopOrder.final_amount === 0 ? 'coupon_free' : 'gateway_aulaa');
                      const isGateway = mode === 'gateway_aulaa';
                      const isCoupon = mode === 'coupon_free' || selectedDesktopOrder.final_amount === 0;
                      const isManual = !isGateway && !isCoupon;

                      const st = selectedDesktopOrder.payment_status || selectedDesktopOrder.status;
                      const isPending = st === 'pending';
                      const isPaid = st === 'paid';
                      const isPendingVerif = st === 'pending_verification';
                      const isRejected = st === 'rejected';

                      if (isGateway) {
                        return (
                          <div style={{
                            padding: '1.1rem',
                            borderRadius: '0.75rem',
                            background: 'rgba(14, 165, 233, 0.04)',
                            border: '1px solid rgba(14, 165, 233, 0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.85rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Zap size={18} color="#0284c7" />
                              <strong style={{ fontSize: '0.88rem', color: '#0284c7' }}>
                                Saluran Gateway: Aulaa.co Payment Gateway
                              </strong>
                            </div>

                            {selectedDesktopOrder.gateway_reference && (
                              <div style={{
                                padding: '0.75rem 1rem',
                                borderRadius: '0.5rem',
                                background: 'rgba(0,0,0,0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}>
                                <div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID Transaksi Gateway Aulaa</div>
                                  <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 700 }}>
                                    {selectedDesktopOrder.gateway_reference}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (navigator.clipboard) {
                                      navigator.clipboard.writeText(selectedDesktopOrder.gateway_reference);
                                      setCopiedDesktopRefToast(true);
                                      setTimeout(() => setCopiedDesktopRefToast(false), 2000);
                                    }
                                  }}
                                  style={{
                                    padding: '0.4rem 0.8rem',
                                    borderRadius: '0.45rem',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(255,255,255,0.06)',
                                    color: copiedDesktopRefToast ? '#10b981' : 'var(--text-primary)',
                                    fontSize: '0.76rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                  }}
                                >
                                  {copiedDesktopRefToast ? <Check size={13} /> : <Copy size={13} />}
                                  <span>{copiedDesktopRefToast ? 'Tersalin' : 'Salin ID'}</span>
                                </button>
                              </div>
                            )}

                            {isPending && (
                              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.2rem' }}>
                                {selectedDesktopOrder.gateway_payment_link && (
                                  <a
                                    href={selectedDesktopOrder.gateway_payment_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      flex: 1,
                                      minHeight: '42px',
                                      padding: '0.5rem 1rem',
                                      borderRadius: '0.5rem',
                                      background: 'var(--primary)',
                                      color: '#ffffff',
                                      fontSize: '0.84rem',
                                      fontWeight: 800,
                                      textDecoration: 'none',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '0.4rem'
                                    }}
                                  >
                                    <ExternalLink size={15} />
                                    <span>Buka Halaman Pembayaran Aulaa</span>
                                  </a>
                                )}
                                <button
                                  type="button"
                                  disabled={syncingOrderId === selectedDesktopOrder.id}
                                  onClick={() => handleSyncOrder(selectedDesktopOrder.id)}
                                  style={{
                                    minHeight: '42px',
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: '0.5rem',
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                  }}
                                >
                                  <RefreshCw size={14} className={syncingOrderId === selectedDesktopOrder.id ? 'animate-spin' : ''} />
                                  <span>{syncingOrderId === selectedDesktopOrder.id ? 'Menyinkronkan...' : 'Sinkronkan Status Gateway'}</span>
                                </button>
                              </div>
                            )}

                            {isPaid && (
                              <div style={{
                                padding: '0.75rem 1rem',
                                borderRadius: '0.5rem',
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                color: '#10b981',
                                fontSize: '0.82rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem'
                              }}>
                                <CheckCircle2 size={16} />
                                <span>Pembayaran telah berhasil diverifikasi oleh sistem gateway Aulaa.</span>
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (isManual) {
                        const isBank = mode === 'manual_bank' || selectedDesktopOrder.payment_method === 'bank';
                        return (
                          <div style={{
                            padding: '1.1rem',
                            borderRadius: '0.75rem',
                            background: 'rgba(16, 185, 129, 0.04)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.85rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {isBank ? <Building2 size={18} color="var(--primary)" /> : <QrCode size={18} color="var(--primary)" />}
                              <strong style={{ fontSize: '0.88rem', color: 'var(--primary)' }}>
                                Metode: {isBank ? 'Transfer Bank' : 'Manual QRIS'} (Verifikasi Tim Catavor)
                              </strong>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.82rem' }}>
                              <div>
                                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.76rem' }}>Nama Pemilik Rekening / Akun:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>{selectedDesktopOrder.sender_account_name || '-'}</strong>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.76rem' }}>No. WhatsApp / Kontak:</span>
                                <span style={{ color: 'var(--text-primary)' }}>{selectedDesktopOrder.sender_phone || '-'}</span>
                              </div>
                            </div>

                            {/* PROOF PREVIEW */}
                            {(() => {
                              const resolvedProof = resolveProofImageUrl(selectedDesktopOrder, token);
                              return (
                                <div>
                                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>
                                    Foto Bukti Pembayaran:
                                  </span>
                                  {resolvedProof ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                      <div
                                        onClick={() => handleOpenDesktopProof(resolvedProof)}
                                        style={{
                                          width: '90px',
                                          height: '90px',
                                          borderRadius: '0.5rem',
                                          overflow: 'hidden',
                                          border: '1px solid var(--border-light, #334155)',
                                          cursor: 'pointer',
                                          backgroundColor: '#000000',
                                          position: 'relative'
                                        }}
                                      >
                                        <SafeImage
                                          src={resolvedProof}
                                          alt="Bukti Transfer"
                                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                          Bukti Transfer Tersimpan
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenDesktopProof(resolvedProof)}
                                          style={{
                                            minHeight: '34px',
                                            padding: '0.35rem 0.85rem',
                                            borderRadius: '0.45rem',
                                            background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid var(--border-light, #334155)',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.76rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.4rem'
                                          }}
                                        >
                                          <Eye size={13} />
                                          <span>Perbesar Foto Bukti</span>
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{
                                      padding: '0.75rem',
                                      borderRadius: '0.5rem',
                                      background: 'rgba(245, 158, 11, 0.08)',
                                      border: '1px dashed rgba(245, 158, 11, 0.3)',
                                      color: '#f59e0b',
                                      fontSize: '0.78rem'
                                    }}>
                                      Belum ada foto bukti pembayaran yang diunggah.
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* STATUS CALLOUTS */}
                            {isPendingVerif && (
                              <div style={{
                                padding: '0.75rem 1rem',
                                borderRadius: '0.5rem',
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                color: '#3b82f6',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem'
                              }}>
                                <Clock size={16} />
                                <span>Bukti transfer sedang dalam antrean verifikasi staf keuangan Catavor (1x24 jam kerja).</span>
                              </div>
                            )}

                            {isRejected && (
                              <div style={{
                                padding: '0.75rem 1rem',
                                borderRadius: '0.5rem',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: '#ef4444',
                                fontSize: '0.8rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800 }}>
                                  <XCircle size={16} />
                                  <span>Pembayaran Ditolak Admin</span>
                                </div>
                                <div style={{ fontSize: '0.76rem', marginTop: '0.2rem' }}>
                                  Alasan: <strong>{selectedDesktopOrder.rejection_reason || 'Bukti transfer tidak valid atau dana belum masuk mutasi.'}</strong>
                                </div>
                              </div>
                            )}

                            {isPaid && (
                              <div style={{
                                padding: '0.75rem 1rem',
                                borderRadius: '0.5rem',
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                color: '#10b981',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem'
                              }}>
                                <CheckCircle2 size={16} />
                                <span>Pembayaran telah diverifikasi sah oleh admin dan paket toko aktif.</span>
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (isCoupon) {
                        return (
                          <div style={{
                            padding: '1.1rem',
                            borderRadius: '0.75rem',
                            background: 'rgba(168, 85, 247, 0.05)',
                            border: '1px solid rgba(168, 85, 247, 0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.7rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Tag size={18} color="#a855f7" />
                              <strong style={{ fontSize: '0.88rem', color: '#a855f7' }}>
                                Promosi Kupon Diskon 100%
                              </strong>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                              Kode Voucher: <strong style={{ color: '#a855f7' }}>{selectedDesktopOrder.coupon_code || 'PROMO100'}</strong>
                            </div>
                            <div style={{
                              padding: '0.65rem 0.85rem',
                              borderRadius: '0.5rem',
                              background: 'rgba(16, 185, 129, 0.1)',
                              color: '#10b981',
                              fontSize: '0.78rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}>
                              <CheckCircle2 size={15} />
                              <span>Paket langganan aktif seketika tanpa pembayaran tunai.</span>
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })()}
                    </>
                  )}
                  </div>

                  {/* MODAL FOOTER */}
                  <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid var(--border-light, #334155)',
                    backgroundColor: 'var(--bg-deep, #0f172a)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem'
                  }}>
                    <button
                      type="button"
                      onClick={handleCloseDesktopOrder}
                      style={{
                        minHeight: '40px',
                        padding: '0.5rem 1.85rem',
                        borderRadius: '0.55rem',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a',
                        fontSize: '0.86rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* INTERACTIVE LIGHTBOX MODAL WITH ZOOM / PAN */}
            {previewDesktopProofImg && createPortal(
              <ProofLightbox
                imageUrl={previewDesktopProofImg}
                onClose={handleCloseDesktopProof}
                isMobile={false}
              />,
              document.body
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
            gap: '0.4rem'
          }}
        >
          {isFree ? (
            <>
              <Sparkles size={14} style={{ flexShrink: 0 }} />
              <span>Upgrade ke Pro</span>
            </>
          ) : (
            <>
              <Settings2 size={14} style={{ flexShrink: 0 }} />
              <span>Kelola Langganan</span>
            </>
          )}
        </button>
      </div>

      {/* Progress Bars (Items & Storage) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', paddingTop: '0.25rem' }}>
        {/* Items Quota */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
              <Package size={14} style={{ color: 'var(--primary)' }} /> Kuota Item Aktif
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
          {quota.archived_items_count > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: '#f59e0b', marginTop: '0.15rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                <Archive size={11} strokeWidth={2.2} /> Item Diarsipkan
              </span>
              <strong style={{ fontWeight: 800 }}>{quota.archived_items_count.toLocaleString('id-ID')} Item</strong>
            </div>
          )}
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
