import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Infinity,
  Archive,
  ShieldAlert,
  Zap,
  ExternalLink,
  RefreshCw,
  Calendar,
  Settings2,
  Tag,
  Building2,
  FileText,
  AlertCircle,
  XCircle,
  Eye
} from 'lucide-react';
import { SafeImage } from './SafeImage';
import { ProofLightbox } from './ProofLightbox';

export const resolveProofImageUrl = (order: any, token?: string | null): string => {
  if (!order) return '';
  const raw = order.payment_proof_url || order.proof_url || '';
  if (raw && (raw.startsWith('data:') || raw.startsWith('blob:'))) {
    return raw;
  }
  if (raw && (raw.startsWith('http://') || raw.startsWith('https://'))) {
    return raw;
  }
  // Only route to authenticated proof streaming endpoint if proof exists or if hydrating from URL
  if (raw || order._isHydrating) {
    const identifier = order.id || order.order_number;
    if (identifier) {
      const effectiveToken = token || (typeof window !== 'undefined' ? (localStorage.getItem('catavor_token') || localStorage.getItem('token')) : null);
      const t = effectiveToken ? `?token=${encodeURIComponent(effectiveToken)}` : '';
      return `/api/subscription/orders/${encodeURIComponent(String(identifier))}/proof${t}`;
    }
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
  initialOrders?: any[];
  initialSelectedOrder?: any;
  initialProofUrl?: string | null;
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
      if (['orders', 'riwayat', 'tagihan', 'billing'].includes(v) || params.has('order') || params.has('proof')) return 'orders';
      if (['checkout', 'bayar'].includes(v)) return 'checkout';
      if (['downgrade', 'downgrade_confirm'].includes(v)) return 'downgrade_confirm';
    }
    return activeView || 'plans';
  });
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedTargetPlan, setSelectedTargetPlan] = useState<SubscriptionPlanData | null>(null);
  const [checkoutType, setCheckoutType] = useState<'upgrade' | 'renewal'>('upgrade');

  // Invoices / Orders State
  const [orders, setOrders] = useState<any[]>(() => initialOrders || []);
  const ordersRef = useRef<any[]>([]);
  ordersRef.current = orders;
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [syncingOrderId, setSyncingOrderId] = useState<number | null>(null);

  // Detail Inspector & LightBox State (Mobile Order History)
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<any | null>(() => initialSelectedOrder || null);
  const [copiedRefToast, setCopiedRefToast] = useState(false);
  const [previewProofImg, setPreviewProofImg] = useState<string | null>(() => initialProofUrl || null);
  const [isHydratingInitialOrder, setIsHydratingInitialOrder] = useState<boolean>(() => {
    if (initialProofUrl) return false;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return Boolean(params.get('order') && params.get('proof') && !initialProofUrl);
    }
    return false;
  });

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

  const fetchOrdersRef = useRef<() => void>(() => {});

  // Sync external activeView changes
  useEffect(() => {
    if (activeView && activeView !== modalView) {
      setModalView(activeView);
    }
  }, [activeView]);

  const changeView = (
    nextView: 'plans' | 'checkout' | 'downgrade_confirm' | 'orders',
    targetPlan?: SubscriptionPlanData | null,
    checkoutMode?: 'upgrade' | 'renewal'
  ) => {
    setModalView(nextView);
    if (onViewChange) {
      onViewChange(nextView);
    }

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (nextView === 'plans') {
        params.delete('view');
        params.delete('plan');
        params.delete('type');
        params.delete('order');
        params.delete('proof');
        const q = params.toString();
        const targetUrl = `${window.location.pathname}${q ? '?' + q : ''}`;
        if (window.history.state?.subView) {
          window.history.replaceState({ ...window.history.state, subView: null }, '', targetUrl);
        }
      } else {
        params.set('view', nextView === 'downgrade_confirm' ? 'downgrade' : nextView);
        if (nextView !== 'orders') {
          params.delete('order');
          params.delete('proof');
        }
        const activePlan = targetPlan || selectedTargetPlan;
        if (activePlan?.code) {
          params.set('plan', activePlan.code);
        }
        if (checkoutMode) {
          params.set('type', checkoutMode);
        } else if (nextView === 'checkout' && checkoutType) {
          params.set('type', checkoutType);
        }
        const q = params.toString();
        const targetUrl = `${window.location.pathname}?${q}`;
        window.history.pushState(
          {
            subView: nextView,
            plan: activePlan?.code,
            type: checkoutMode || checkoutType
          },
          '',
          targetUrl
        );
      }
    }
  };

  const handleBackToPlans = () => {
    if (typeof window !== 'undefined' && window.history.state?.subView) {
      window.history.back();
    } else {
      changeView('plans');
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        params.delete('view');
        params.delete('plan');
        params.delete('type');
        params.delete('order');
        params.delete('proof');
        const q = params.toString();
        const targetUrl = `${window.location.pathname}${q ? '?' + q : ''}`;
        window.history.replaceState({}, '', targetUrl);
      }
    }
  };

  // Real-time synchronization on browser Back / gesture navigation
  useEffect(() => {
    const handleSubPopState = () => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      const planParam = params.get('plan');
      const typeParam = params.get('type') as 'upgrade' | 'renewal' | null;
      const orderParam = params.get('order');
      const proofParam = params.get('proof');

      if (viewParam === 'checkout') {
        setModalView('checkout');
        if (onViewChange) onViewChange('checkout');
        if (planParam && plans && plans.length > 0) {
          const matched = plans.find(p => p.code?.toLowerCase() === planParam.toLowerCase());
          if (matched) setSelectedTargetPlan(matched);
        }
        if (typeParam) setCheckoutType(typeParam);
      } else if (viewParam === 'downgrade' || viewParam === 'downgrade_confirm') {
        setModalView('downgrade_confirm');
        if (onViewChange) onViewChange('downgrade_confirm');
        if (planParam && plans && plans.length > 0) {
          const matched = plans.find(p => p.code?.toLowerCase() === planParam.toLowerCase());
          if (matched) setSelectedTargetPlan(matched);
        }
      } else if (viewParam === 'orders') {
        setModalView('orders');
        if (onViewChange) onViewChange('orders');
        if (!proofParam) {
          setPreviewProofImg(null);
        }
        if (window.history.state?.subView !== 'order_detail' && !proofParam) {
          setSelectedDetailOrder(null);
        }
        if (orders.length === 0) {
          fetchOrdersRef.current();
        }
      } else {
        setModalView('plans');
        if (onViewChange) onViewChange('plans');
        setSelectedDetailOrder(null);
        setPreviewProofImg(null);
        setActionError(null);
      }
    };

    window.addEventListener('popstate', handleSubPopState);
    return () => window.removeEventListener('popstate', handleSubPopState);
  }, [plans, onViewChange, orders.length]);

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

  // Lock body scroll when overlay/modal is open
  useEffect(() => {
    if (previewProofImg !== null || selectedDetailOrder !== null || isHydratingInitialOrder) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [previewProofImg, selectedDetailOrder, isHydratingInitialOrder]);

  // Gesture physics for Apple-Style Bottom Sheet Detail
  const [detailSheetDragY, setDetailSheetDragY] = useState(0);
  const [isDetailSheetDragging, setIsDetailSheetDragging] = useState(false);
  const detailDragStartYRef = useRef(0);

  // URL State Synced Modal & LightBox Navigation Handlers
  const handleOpenOrderDetail = (ord: any) => {
    setSelectedDetailOrder(ord);
    setDetailSheetDragY(0);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'orders');
      params.delete('order');
      params.delete('proof');
      const q = params.toString();
      window.history.pushState(
        { subView: 'order_detail', orderId: ord.order_number || ord.id },
        '',
        `${window.location.pathname}?${q}`
      );
    }
  };

  const handleCloseOrderDetail = () => {
    setSelectedDetailOrder(null);
    setPreviewProofImg(null);
    setDetailSheetDragY(0);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (window.history.state?.subView === 'order_detail' && window.history.length > 1) {
        window.history.back();
        return;
      }
      if (params.has('order') || params.has('proof')) {
        params.delete('order');
        params.delete('proof');
        const q = params.toString();
        window.history.replaceState(
          { ...window.history.state, subView: 'orders' },
          '',
          `${window.location.pathname}${q ? '?' + q : ''}`
        );
      }
    }
  };

  const handleOpenProofLightbox = (rawUrl?: string, ord?: any) => {
    const targetOrd = ord || selectedDetailOrder;
    const finalUrl = resolveProofImageUrl(targetOrd, token) || rawUrl || '';
    if (!finalUrl) return;

    setPreviewProofImg(finalUrl);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'orders');
      if (targetOrd) {
        params.set('order', targetOrd.order_number || String(targetOrd.id));
      }
      params.set('proof', '1');
      const q = params.toString();
      window.history.pushState(
        { subView: 'order_proof', orderId: targetOrd?.order_number || targetOrd?.id },
        '',
        `${window.location.pathname}?${q}`
      );
    }
  };

  const handleCloseProofLightbox = () => {
    setPreviewProofImg(null);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (window.history.state?.subView === 'order_proof' && window.history.length > 1) {
        window.history.back();
        return;
      }
      params.delete('proof');
      params.delete('order');
      const q = params.toString();
      window.history.replaceState(
        { ...window.history.state, subView: 'orders' },
        '',
        `${window.location.pathname}${q ? '?' + q : ''}`
      );
      setSelectedDetailOrder(null);
    }
  };

  const handleDetailTouchStart = (e: React.TouchEvent) => {
    detailDragStartYRef.current = e.touches[0].clientY;
    setIsDetailSheetDragging(true);
  };

  const handleDetailTouchMove = (e: React.TouchEvent) => {
    if (!isDetailSheetDragging) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - detailDragStartYRef.current;
    if (delta > 0) {
      setDetailSheetDragY(delta);
    } else {
      setDetailSheetDragY(delta * 0.18);
    }
  };

  const handleDetailTouchEnd = () => {
    setIsDetailSheetDragging(false);
    if (detailSheetDragY >= 70) {
      handleCloseOrderDetail();
    } else {
      setDetailSheetDragY(0);
    }
  };

  const handleCopyGatewayRef = (refId: string) => {
    if (!refId) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(refId);
      setCopiedRefToast(true);
      setTimeout(() => setCopiedRefToast(false), 2000);
    }
  };

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
    fetchFreshPlatformSettings();
  }, [modalView, activeView, apiBase]);

  useEffect(() => {
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
  }, [apiBase]);

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
    setSenderAccountName('');
    setSenderPhone('');
    setAulaaChannel('qris');
  }, []);

  useEffect(() => {
    // Detect ?plan= query param to auto-open checkout
    if (typeof window !== 'undefined' && plans && plans.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const planParam = params.get('plan');
      if (planParam) {
        const matched = plans.find(p => p.code?.toLowerCase() === planParam.toLowerCase());
        if (matched) {
          openCheckout(matched, 'upgrade');
          try {
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, '', cleanUrl);
          } catch {}
        }
      }
    }
  }, [plans]);

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
        const orderList = data.data || data.orders || [];
        setOrders(orderList);

        // Re-hydrate proof lightbox on load / refresh ONLY if viewing proof detail
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const orderParam = params.get('order');
          const proofParam = params.get('proof');
          if (orderParam && proofParam && orderList.length > 0) {
            const matched = orderList.find((o: any) =>
              String(o.order_number).toLowerCase() === orderParam.toLowerCase() ||
              String(o.id) === orderParam
            );
            if (matched) {
              setSelectedDetailOrder(matched);
              setPreviewProofImg(resolveProofImageUrl(matched, token));
            } else {
              setSelectedDetailOrder(null);
              setPreviewProofImg(null);
            }
          } else if (orderParam && !proofParam) {
            params.delete('order');
            const q = params.toString();
            window.history.replaceState(
              { ...window.history.state, subView: 'orders' },
              '',
              `${window.location.pathname}${q ? '?' + q : ''}`
            );
            setSelectedDetailOrder(null);
            setPreviewProofImg(null);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch subscription orders', err);
    } finally {
      setLoadingOrders(false);
      setIsHydratingInitialOrder(false);
    }
  };
  fetchOrdersRef.current = fetchOrders;

  // Auto-fetch orders on mount or when switching to 'orders' view or when hydrating from URL
  useEffect(() => {
    if (modalView === 'orders' || activeView === 'orders' || isHydratingInitialOrder) {
      if (ordersRef.current.length === 0) {
        fetchOrders();
      }
    }
  }, [modalView, activeView]);

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
      } else {
        setPaymentProofUrl(proofPreview || '');
      }
    } catch (err) {
      setPaymentProofUrl(proofPreview || '');
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleApplyCoupon = async () => {
    const cleanCode = couponInput.trim().toUpperCase();
    if (!cleanCode) {
      setCouponMsg({ type: 'error', text: 'Masukkan kode kupon terlebih dahulu.' });
      return;
    }

    if (!selectedTargetPlan) return;

    try {
      const res = await fetch(`${apiBase}/subscription/verify-coupon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          code: cleanCode,
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
        return;
      }
    } catch {}

    // Fallback checking against database settings without hardcoded dummy free coupons
    let masterCoupons = [];
    try {
      if (settings?.master_coupons) {
        masterCoupons = typeof settings.master_coupons === 'string' ? JSON.parse(settings.master_coupons) : settings.master_coupons;
      }
    } catch {}

    const found = Array.isArray(masterCoupons) ? masterCoupons.find((c: any) => c.code.toUpperCase() === cleanCode) : null;
    if (found) {
      setAppliedCoupon(found);
      setCouponMsg({ type: 'success', text: `Kupon "${found.code}" berhasil diterapkan!` });
    } else {
      setAppliedCoupon(null);
      setCouponMsg({ type: 'error', text: `Kode kupon "${cleanCode}" tidak valid atau telah kedaluwarsa.` });
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponMsg(null);
  };

  const calculateFinalCheckoutPrice = () => {
    if (!selectedTargetPlan) return { originalPrice: 0, discountAmount: 0, finalPrice: 0 };

    const originalPrice = billingCycle === 'annual' ? selectedTargetPlan.price_annual : selectedTargetPlan.price_monthly;
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

    if (discountAmount > originalPrice) discountAmount = originalPrice;
    const finalPrice = Math.max(0, originalPrice - discountAmount);

    return { originalPrice, discountAmount, finalPrice };
  };

  const handleProcessCheckout = async () => {
    if (!selectedTargetPlan) return;

    const systemPaymentMode = (effectiveSettings?.payment_system_mode || 'gateway_aulaa').toLowerCase();
    if (systemPaymentMode === 'maintenance') {
      setActionError('Sistem transaksi pembayaran sedang dalam masa pemeliharaan berkala.');
      return;
    }

    setActionError(null);
    setInternalLoading(true);

    const { finalPrice } = calculateFinalCheckoutPrice();
    const isGateway = finalPrice > 0 && systemPaymentMode === 'gateway_aulaa';

    if (finalPrice > 0 && !isGateway && !paymentProofUrl && !proofPreview) {
      setActionError('Mohon unggah bukti transfer pembayaran terlebih dahulu.');
      setInternalLoading(false);
      return;
    }

    if (finalPrice > 0 && systemPaymentMode === 'manual_qris' && !senderAccountName.trim()) {
      setActionError('Mohon isi nama akun pengirim untuk verifikasi mutasi.');
      setInternalLoading(false);
      return;
    }

    try {
      const orderPaymentMode = finalPrice === 0 
        ? 'coupon_free' 
        : isGateway 
          ? 'gateway_aulaa' 
          : systemPaymentMode === 'manual_qris' 
            ? 'manual_qris' 
            : 'manual_bank';

      const durationMonths = billingCycle === 'annual' ? 12 : 1;

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
          coupon_code: appliedCoupon ? appliedCoupon.code : '',
          payment_method: finalPrice === 0 ? 'coupon_free' : (isGateway ? aulaaChannel : paymentMethod),
          payment_mode: finalPrice === 0 ? 'coupon_free' : orderPaymentMode,
          sender_account_name: senderAccountName.trim(),
          sender_phone: senderPhone.trim(),
          payment_proof_url: paymentProofUrl || proofPreview || '',
          redirect_url: window.location.href
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal memproses transaksi langganan.');
      }

      if (data.order?.gateway_payment_link) {
        window.location.href = data.order.gateway_payment_link;
        return;
      }

      if (isGateway && finalPrice > 0) {
        setActionError('Gagal mendapatkan tautan pembayaran Aulaa. Saluran pembayaran sedang tidak tersedia atau hubungi admin.');
        return;
      }

      if (finalPrice === 0) {
        setActionSuccess(
          checkoutType === 'renewal'
            ? `Paket ${selectedTargetPlan.name} berhasil diperpanjang.`
            : `Katalog Anda kini aktif pada paket ${selectedTargetPlan.name}.`
        );
        setModalView('plans');
        if (onSuccessUpgrade) onSuccessUpgrade();
      } else {
        const ordNum = data.order?.order_number || data.order?.invoice_number || '';
        const uniqueMsg = data.order?.unique_code ? ` (termasuk kode unik +Rp ${data.order.unique_code})` : '';
        setActionSuccess(`Pesanan #${ordNum} berhasil dibuat!${uniqueMsg} Verifikator akan memproses aktivasi paket Anda.`);
        setModalView('orders');
        fetchOrders();
      }
    } catch (err: any) {
      setActionError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setInternalLoading(false);
    }
  };

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
        setActionSuccess(`Sinkronisasi status berhasil.`);
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

  if (isHydratingInitialOrder) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        color: '#f8fafc',
        fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif"
      }}>
        <div style={{
          width: '54px',
          height: '54px',
          borderRadius: '1rem',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(56, 189, 248, 0.16) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}>
          <Receipt size={26} className="animate-pulse" style={{ color: '#10b981' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: '0 0 0.3rem 0', color: '#f8fafc' }}>
            Memuat Bukti Pembayaran...
          </h3>
          <p style={{ fontSize: '0.76rem', color: '#94a3b8', margin: 0 }}>
            Menyiapkan informasi bukti transfer transaksi
          </p>
        </div>
        <div style={{
          width: '160px',
          height: '3px',
          borderRadius: '999px',
          backgroundColor: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            width: '40%',
            borderRadius: '999px',
            background: 'linear-gradient(90deg, #10b981, #38bdf8)',
            animation: 'loaderSlide 1.2s infinite ease-in-out'
          }} />
        </div>
        <style>{`
          @keyframes loaderSlide {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(350%); }
          }
        `}</style>
      </div>
    );
  }

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
            onClick={() => changeView('plans')}
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
              changeView('orders');
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
              {/* Billing Cycle Locked Badge */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                padding: '0.5rem 1rem',
                background: 'var(--card-bg-gradient, var(--bg-card))',
                border: '1px solid var(--border-light)',
                borderRadius: '0.75rem',
                width: '100%',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                fontWeight: 700
              }}>
                <Calendar size={14} style={{ color: 'var(--primary)' }} />
                <span>Tagihan Bulanan (1 Bulan)</span>
                <span style={{
                  fontSize: '0.66rem',
                  padding: '0.12rem 0.5rem',
                  borderRadius: '9999px',
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--primary)',
                  fontWeight: 800,
                  marginLeft: '0.25rem'
                }}>
                  30 Hari
                </span>
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
                              /bulan
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quota Highlights */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.74rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
                          <Package size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span>Kapasitas: <strong>{plan.max_items === -1 ? 'Item Tak Terbatas' : `${plan.max_items} Item Katalog`}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
                          <HardDrive size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span>Penyimpanan Media: <strong>{formatBytes(plan.storage_limit_bytes)}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
                          <ImageIcon size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span>Foto per Item: <strong>Hingga 10 Foto HD</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: plan.has_custom_domain ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          <Globe size={13} style={{ color: plan.has_custom_domain ? '#10b981' : 'var(--text-muted)', flexShrink: 0 }} />
                          <span>Domain Kustom Sendiri (.com/.id): <strong>{plan.has_custom_domain ? 'Didukung' : 'Tidak Tersedia'}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: plan.code !== 'free' ? '#10b981' : 'var(--text-muted)' }}>
                          <Sparkles size={13} style={{ color: plan.code !== 'free' ? '#10b981' : 'var(--text-muted)', flexShrink: 0 }} />
                          <span>Iklan Sponsor: <strong>{plan.code !== 'free' ? '100% Bebas Iklan (Ad-Free)' : 'Didukung Iklan Sponsor'}</strong></span>
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
                          <Sparkles size={14} style={{ flexShrink: 0 }} />
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
                    Periode Sewa: 1 Bulan (30 Hari)
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
              {(() => {
                const { discountAmount } = calculateFinalCheckoutPrice();
                return (
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
                    {appliedCoupon ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: '0.55rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
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
                <div style={{ display: 'flex', gap: '0.45rem' }}>
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
                    )}
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
                );
              })()}

              {/* 4. Payment Method & Instructions */}
              {(() => {
                const { finalPrice } = calculateFinalCheckoutPrice();

                // 1. Maintenance Mode Box
                if (isMaintenance) {
                  return (
                    <div 
                      className="glass-panel" 
                      style={{
                        padding: '1.25rem',
                        borderRadius: '0.85rem',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1.5px solid rgba(239, 68, 68, 0.35)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        gap: '0.75rem'
                      }}
                    >
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <ShieldAlert size={26} />
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block', marginBottom: '0.2rem' }}>
                          {maintenanceTitle}
                        </strong>
                        <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                          {maintenanceMessage}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={true}
                        style={{
                          width: '100%',
                          minHeight: '44px',
                          padding: '0.75rem',
                          borderRadius: '0.65rem',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-light)',
                          fontWeight: 700,
                          fontSize: '0.84rem',
                          cursor: 'not-allowed',
                          marginTop: '0.25rem'
                        }}
                      >
                        Pembayaran Ditangguhkan
                      </button>
                    </div>
                  );
                }

                // 2. 100% Free Coupon Activation
                if (finalPrice === 0) {
                  return (
                    <button
                      type="button"
                      disabled={internalLoading}
                      onClick={handleProcessCheckout}
                      className="btn-primary"
                      style={{
                        width: '100%',
                        minHeight: '46px',
                        padding: '0.85rem',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        borderRadius: '0.75rem',
                        marginTop: '0.35rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px var(--primary-glow)'
                      }}
                    >
                      {internalLoading ? 'Mengaktifkan...' : 'Aktifkan Paket Gratis Sekarang'}
                    </button>
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
                      gap: '0.95rem'
                    }}>
                      <div style={{
                        padding: '1.1rem',
                        borderRadius: '0.85rem',
                        background: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                              <Zap size={18} />
                            </div>
                            <div>
                              <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)', display: 'block' }}>
                                Gerbang Pembayaran Instan (Aulaa)
                              </strong>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Aktivasi otomatis &amp; terenkripsi 256-bit
                              </span>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '9999px', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle2 size={11} /> Otomatis
                          </span>
                        </div>

                        <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                          Pilih saluran pembayaran di bawah. Anda akan dialihkan ke halaman resmi Aulaa. Paket toko aktif otomatis seketika setelah pembayaran berhasil tanpa unggah bukti manual.
                        </p>

                        {/* Interactive Channel Selector */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Pilih Saluran Pembayaran:
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                            {showQRIS && (
                              <button
                                type="button"
                                onClick={() => setAulaaChannel('qris')}
                                style={{
                                  padding: '0.65rem 0.75rem',
                                  borderRadius: '0.65rem',
                                  backgroundColor: aulaaChannel === 'qris' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                  border: aulaaChannel === 'qris' ? '2px solid #10b981' : '1px solid var(--border-light)',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '0.4rem',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                  <QrCode size={15} color="#10b981" />
                                  <div>
                                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)' }}>QRIS Instan</div>
                                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>GoPay, OVO, Shopee</div>
                                  </div>
                                </div>
                                {aulaaChannel === 'qris' && <Check size={14} color="#10b981" style={{ flexShrink: 0 }} />}
                              </button>
                            )}

                            {showVA && (
                              <button
                                type="button"
                                onClick={() => setAulaaChannel('va')}
                                style={{
                                  padding: '0.65rem 0.75rem',
                                  borderRadius: '0.65rem',
                                  backgroundColor: aulaaChannel === 'va' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                  border: aulaaChannel === 'va' ? '2px solid #38bdf8' : '1px solid var(--border-light)',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '0.4rem',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                  <CreditCard size={15} color="#38bdf8" />
                                  <div>
                                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)' }}>Virtual Account</div>
                                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>BCA, Mandiri, BRI</div>
                                  </div>
                                </div>
                                {aulaaChannel === 'va' && <Check size={14} color="#38bdf8" style={{ flexShrink: 0 }} />}
                              </button>
                            )}

                            {showEWallet && (
                              <button
                                type="button"
                                onClick={() => setAulaaChannel('ewallet')}
                                style={{
                                  padding: '0.65rem 0.75rem',
                                  borderRadius: '0.65rem',
                                  backgroundColor: aulaaChannel === 'ewallet' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                  border: aulaaChannel === 'ewallet' ? '2px solid #f59e0b' : '1px solid var(--border-light)',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '0.4rem',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                  <Zap size={15} color="#f59e0b" />
                                  <div>
                                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)' }}>Dompet Digital</div>
                                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>DANA, LinkAja</div>
                                  </div>
                                </div>
                                {aulaaChannel === 'ewallet' && <Check size={14} color="#f59e0b" style={{ flexShrink: 0 }} />}
                              </button>
                            )}

                            {showCC && (
                              <button
                                type="button"
                                onClick={() => setAulaaChannel('cc')}
                                style={{
                                  padding: '0.65rem 0.75rem',
                                  borderRadius: '0.65rem',
                                  backgroundColor: aulaaChannel === 'cc' ? 'rgba(192, 132, 252, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                  border: aulaaChannel === 'cc' ? '2px solid #c084fc' : '1px solid var(--border-light)',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '0.4rem',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                  <CreditCard size={15} color="#c084fc" />
                                  <div>
                                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)' }}>Kartu Kredit</div>
                                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Visa, Mastercard</div>
                                  </div>
                                </div>
                                {aulaaChannel === 'cc' && <Check size={14} color="#c084fc" style={{ flexShrink: 0 }} />}
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
                          minHeight: '48px',
                          padding: '0.85rem',
                          fontWeight: 800,
                          fontSize: '0.88rem',
                          borderRadius: '0.75rem',
                          cursor: internalLoading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.45rem',
                          boxShadow: '0 4px 16px var(--primary-glow)'
                        }}
                      >
                        <Zap size={16} />
                        <span>{internalLoading ? 'Menyiapkan Transaksi...' : `Lanjut ke Pembayaran Aulaa (${formatRupiah(finalPrice)})`}</span>
                      </button>
                    </div>
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
                        onClick={() => setPaymentMethod('qris')}
                        style={{
                          minHeight: '44px',
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
                        <span>QRIS Merchant</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('bank')}
                        style={{
                          minHeight: '44px',
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
                    </div>

                    {/* MANUAL BANK DETAILS */}
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
                              minHeight: '38px',
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
                            <span>{copiedAccountToast ? 'Tersalin!' : 'Salin Rekening'}</span>
                          </button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Atas Nama:</span>
                          <strong style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{bankHolder}</strong>
                        </div>
                        <div style={{
                          padding: '0.45rem 0.65rem',
                          borderRadius: '0.45rem',
                          backgroundColor: 'rgba(59, 130, 246, 0.08)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          fontSize: '0.7rem',
                          color: 'var(--text-secondary)',
                          marginTop: '0.2rem'
                        }}>
                          Kode unik nominal akan ditambahkan pada tagihan untuk mempermudah pengecekan mutasi transfer rekening oleh admin verifikator.
                        </div>
                      </div>
                    )}

                    {/* MANUAL QRIS DETAILS */}
                    {paymentMethod === 'qris' && (
                      <div style={{ 
                        padding: '1.1rem 1rem', 
                        borderRadius: '0.75rem', 
                        background: 'var(--bg-deep)', 
                        border: '1px solid var(--border-light)', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        gap: '0.65rem', 
                        textAlign: 'center' 
                      }}>
                        <div style={{ width: '140px', height: '140px', borderRadius: '12px', background: '#ffffff', padding: '8px', border: '2px solid var(--primary)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
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
                        <button
                          type="button"
                          onClick={handleDownloadQRIS}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.4rem 0.85rem',
                            borderRadius: '0.5rem',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-primary)',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Download size={14} />
                          <span>Unduh QRIS</span>
                        </button>
                        <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>{manualQrisMerchant}</strong>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          Buka aplikasi m-banking atau e-wallet Anda dan scan QRIS resmi di atas.
                        </span>
                      </div>
                    )}

                    {/* SENDER INPUTS & PROOF UPLOAD (For manual methods) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        <div>
                          <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>
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
                              borderRadius: '0.55rem',
                              background: 'var(--bg-deep)',
                              border: '1px solid var(--border-light)',
                              color: 'var(--text-primary)',
                              fontSize: '0.8rem',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        {/* Proof Upload Dropzone */}
                        <div>
                          <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>
                            Unggah Bukti Transfer: <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <label style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            minHeight: '52px',
                            padding: '0.85rem',
                            borderRadius: '0.75rem',
                            border: '2px dashed var(--border-light)',
                            background: 'var(--bg-deep)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}>
                            <input type="file" accept="image/*" onChange={handleProofUpload} style={{ display: 'none' }} />
                            {proofPreview ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <img src={proofPreview} alt="Bukti" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-light)' }} />
                                <div style={{ textAlign: 'left' }}>
                                  <span style={{ fontSize: '0.76rem', color: '#10b981', fontWeight: 800, display: 'block' }}>Foto Bukti Dipilih</span>
                                  <span style={{ fontSize: '0.68rem', color: 'var(--primary)', textDecoration: 'underline' }}>Klik ganti foto</span>
                                </div>
                              </div>
                            ) : (
                              <>
                                <Upload size={20} style={{ color: 'var(--primary)' }} />
                                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {isUploadingProof ? 'Mengunggah...' : 'Pilih Foto Bukti / Struk'}
                                </span>
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
                        minHeight: '48px',
                        padding: '0.85rem',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        borderRadius: '0.75rem',
                        cursor: (internalLoading || isUploadingProof) ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        marginTop: '0.25rem',
                        boxShadow: '0 4px 16px var(--primary-glow)'
                      }}
                    >
                          <Sparkles size={16} />
                      <span>{internalLoading ? 'Memproses...' : `Kirim Konfirmasi Pembayaran (${formatRupiah(finalPrice)})`}</span>
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
                  {orders.map((ord: any) => {
                    const status = ord.payment_status || ord.status || 'pending';
                    const isPaid = status === 'paid';
                    const isPendingVerification = status === 'pending_verification';
                    const isPending = status === 'pending';
                    const isRejected = status === 'rejected';
                    const isExpired = status === 'expired';

                    let badgeColor = '#f59e0b';
                    let badgeBg = 'rgba(245, 158, 11, 0.12)';
                    let badgeLabel = 'Menunggu';

                    if (isPaid) {
                      badgeColor = '#10b981';
                      badgeBg = 'rgba(16, 185, 129, 0.12)';
                      badgeLabel = 'Lunas';
                    } else if (isPendingVerification) {
                      badgeColor = '#3b82f6';
                      badgeBg = 'rgba(59, 130, 246, 0.12)';
                      badgeLabel = 'Verifikasi';
                    } else if (isRejected) {
                      badgeColor = '#ef4444';
                      badgeBg = 'rgba(239, 68, 68, 0.12)';
                      badgeLabel = 'Ditolak';
                    } else if (isExpired) {
                      badgeColor = '#64748b';
                      badgeBg = 'rgba(100, 116, 139, 0.12)';
                      badgeLabel = 'Kedaluwarsa';
                    }

                    const planTitle = (() => {
                      switch (ord.plan_code?.toLowerCase()) {
                        case 'free': return 'Gratis Terbatas';
                        case 'pro_starter': return 'Pro Starter';
                        case 'pro_business': return 'Pro Bisnis';
                        default: return ord.plan_code ? ord.plan_code.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Paket Langganan';
                      }
                    })();

                    const cycleTitle = ord.billing_cycle === 'annual' ? 'Tahunan (Hemat 20%)' : 'Bulanan';

                    const paymentMethodLabel = (() => {
                      if (ord.payment_mode === 'coupon_free' || ord.final_amount === 0) return 'Kupon 100%';
                      if (ord.payment_mode === 'gateway_aulaa') return 'Gateway Aulaa';
                      if (ord.payment_method === 'bank') return 'Transfer Bank';
                      if (ord.payment_method === 'qris') return 'QRIS';
                      return ord.payment_method ? ord.payment_method.toUpperCase() : 'Manual';
                    })();

                    return (
                      <div
                        key={ord.id || ord.order_number}
                        style={{
                          padding: '0.95rem 1rem',
                          borderRadius: '0.75rem',
                          background: 'var(--bg-card, rgba(255,255,255,0.03))',
                          border: '1px solid var(--border-light, rgba(255,255,255,0.1))',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.7rem',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
                        }}
                      >
                        {/* ROW 1: PLAN NAME & STATUS BADGE */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, flex: 1 }}>
                            <div style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '0.5rem',
                              background: 'var(--primary-glow, rgba(16, 185, 129, 0.12))',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--primary, #10b981)',
                              flexShrink: 0
                            }}>
                              <Crown size={16} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{
                                fontSize: '0.88rem',
                                fontWeight: 800,
                                color: 'var(--text-primary, #f8fafc)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {planTitle}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>
                                {cycleTitle}
                              </div>
                            </div>
                          </div>

                          {/* Dedicated Status Badge with zero overlap risk */}
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: badgeBg,
                            color: badgeColor,
                            border: `1px solid ${badgeColor}`,
                            flexShrink: 0,
                            letterSpacing: '0.02em'
                          }}>
                            {badgeLabel}
                          </span>
                        </div>

                        {/* ROW 2: INVOICE IDENTIFIER & DATE SUB-BAR */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.45rem 0.65rem',
                          borderRadius: '0.5rem',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          gap: '0.5rem',
                          flexWrap: 'wrap'
                        }}>
                          <span style={{
                            fontSize: '0.72rem',
                            color: 'var(--text-secondary, #cbd5e1)',
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            wordBreak: 'break-all'
                          }}>
                            #{ord.order_number}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', whiteSpace: 'nowrap' }}>
                            {ord.created_at ? new Date(ord.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                          </span>
                        </div>

                        {/* ROW 3: PAYMENT METHOD & NOMINAL AMOUNT */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)' }}>Metode Pembayaran</span>
                            <span style={{
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              color: 'var(--text-primary, #f8fafc)',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '0.35rem',
                              background: 'rgba(255, 255, 255, 0.06)',
                              display: 'inline-block',
                              width: 'fit-content'
                            }}>
                              {paymentMethodLabel}
                            </span>
                          </div>

                          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)' }}>Total Tagihan</span>
                            <strong style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--primary, #10b981)' }}>
                              Rp {Number(ord.final_amount ?? ord.total_amount ?? ord.amount ?? 0).toLocaleString('id-ID')}
                            </strong>
                          </div>
                        </div>

                        {/* ROW 4: UNIQUE CODE NOTE (IF ANY) */}
                        {ord.unique_code > 0 && (
                          <div style={{
                            fontSize: '0.7rem',
                            color: 'var(--primary, #10b981)',
                            fontWeight: 600,
                            background: 'rgba(16, 185, 129, 0.06)',
                            padding: '0.35rem 0.6rem',
                            borderRadius: '0.4rem',
                            border: '1px solid rgba(16, 185, 129, 0.15)'
                          }}>
                            Termasuk kode unik transfer: <strong>+Rp {ord.unique_code}</strong>
                          </div>
                        )}

                        {/* REJECTION REASON (IF REJECTED) */}
                        {isRejected && ord.rejection_reason && (
                          <div style={{
                            fontSize: '0.7rem',
                            color: '#ef4444',
                            fontWeight: 700,
                            background: 'rgba(239, 68, 68, 0.08)',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '0.4rem',
                            border: '1px solid rgba(239, 68, 68, 0.2)'
                          }}>
                            Alasan Penolakan: {ord.rejection_reason}
                          </div>
                        )}

                        {/* ROW 5: ACTION BUTTONS FOOTER */}
                        <div style={{
                          display: 'flex',
                          gap: '0.45rem',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          paddingTop: '0.5rem',
                          borderTop: '1px solid var(--border-light, #1e293b)',
                          flexWrap: 'wrap'
                        }}>
                          <button
                            type="button"
                            onClick={() => handleOpenOrderDetail(ord)}
                            style={{
                              minHeight: '36px',
                              padding: '0.35rem 0.85rem',
                              borderRadius: '0.5rem',
                              background: 'rgba(255, 255, 255, 0.08)',
                              border: '1px solid var(--border-light, #334155)',
                              color: 'var(--text-primary, #f8fafc)',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                          >
                            <Receipt size={14} />
                            <span>Rincian</span>
                          </button>

                          {(ord.payment_proof_url || ord.proof_url) && (
                            <button
                              type="button"
                              onClick={() => handleOpenProofLightbox(resolveProofImageUrl(ord, token), ord)}
                              style={{
                                minHeight: '36px',
                                padding: '0.35rem 0.85rem',
                                borderRadius: '0.5rem',
                                background: 'rgba(59, 130, 246, 0.12)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                color: '#60a5fa',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              <Eye size={14} />
                              <span>Bukti Bayar</span>
                            </button>
                          )}

                          {isPending && ord.gateway_payment_link && (
                            <a
                              href={ord.gateway_payment_link}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                minHeight: '36px',
                                padding: '0.35rem 0.85rem',
                                borderRadius: '0.5rem',
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
                              <ExternalLink size={14} />
                              <span>Bayar Online</span>
                            </a>
                          )}

                          {(isPending || isPendingVerification) && (
                            <button
                              type="button"
                              disabled={syncingOrderId === ord.id}
                              onClick={() => handleSyncOrder(ord.id)}
                              style={{
                                minHeight: '36px',
                                padding: '0.35rem 0.85rem',
                                borderRadius: '0.5rem',
                                background: 'var(--btn-secondary-bg, rgba(255,255,255,0.08))',
                                border: '1px solid var(--btn-secondary-border, var(--border-light))',
                                color: 'var(--btn-secondary-text, var(--text-primary))',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              <RefreshCw size={14} className={syncingOrderId === ord.id ? 'animate-spin' : ''} />
                              <span>{syncingOrderId === ord.id ? 'Sinkron...' : 'Cek Status'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* MOBILE ORDER DETAIL BOTTOM SHEET (Zero 'X' in Header, High Contrast Footer, Apple-style Drag Physics) */}
          {selectedDetailOrder && !previewProofImg && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 999998,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(4px)',
                touchAction: 'none'
              }}
              onClick={handleCloseOrderDetail}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  maxHeight: '90vh',
                  backgroundColor: 'var(--bg-card, #0f172a)',
                  borderTopLeftRadius: '1.25rem',
                  borderTopRightRadius: '1.25rem',
                  borderTop: '1px solid var(--border-light, #334155)',
                  boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transform: `translateY(${Math.max(0, detailSheetDragY)}px)`,
                  transition: isDetailSheetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                {/* DRAG HANDLE BAR */}
                <div
                  onTouchStart={handleDetailTouchStart}
                  onTouchMove={handleDetailTouchMove}
                  onTouchEnd={handleDetailTouchEnd}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0 0.25rem',
                    display: 'flex',
                    justifyContent: 'center',
                    touchAction: 'none',
                    cursor: 'grab'
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '4px',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(255,255,255,0.25)'
                    }}
                  />
                </div>

                {/* HEADER (CLEAN, NO 'X' BUTTON) */}
                <div
                  onTouchStart={handleDetailTouchStart}
                  onTouchMove={handleDetailTouchMove}
                  onTouchEnd={handleDetailTouchEnd}
                  style={{
                    padding: '0.2rem 1.25rem 0.85rem',
                    borderBottom: '1px solid var(--border-light, #334155)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    touchAction: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '0.5rem',
                      background: 'var(--primary-glow, rgba(16, 185, 129, 0.15))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary, #10b981)'
                    }}>
                      <Receipt size={18} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)' }}>
                        Rincian Transaksi
                      </h4>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', fontFamily: 'monospace' }}>
                        {selectedDetailOrder.order_number}
                      </span>
                    </div>
                  </div>

                  {(() => {
                    const status = selectedDetailOrder.payment_status || selectedDetailOrder.status || 'pending';
                    const isPaid = status === 'paid';
                    const isPendingVerif = status === 'pending_verification';
                    const isPending = status === 'pending';
                    const isRejected = status === 'rejected';

                    if (isPaid) {
                      return (
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '999px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          border: '1px solid #10b981'
                        }}>
                          Lunas
                        </span>
                      );
                    }
                    if (isPendingVerif) {
                      return (
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '999px',
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: '#3b82f6',
                          border: '1px solid #3b82f6'
                        }}>
                          Verifikasi
                        </span>
                      );
                    }
                    if (isRejected) {
                      return (
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '999px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                          border: '1px solid #ef4444'
                        }}>
                          Ditolak
                        </span>
                      );
                    }
                    return (
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: '999px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#f59e0b',
                        border: '1px solid #f59e0b'
                      }}>
                        Menunggu
                      </span>
                    );
                  })()}
                </div>

                {/* SCROLLABLE BODY */}
                <div style={{
                  padding: '1rem 1.25rem',
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehavior: 'contain',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  flex: 1
                }}>
                  {/* FINANCIAL BREAKDOWN */}
                  <div style={{
                    padding: '0.9rem 1rem',
                    borderRadius: '0.75rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-light, #334155)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.55rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)' }}>Paket Langganan</span>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary, #f8fafc)' }}>
                        {(() => {
                          switch (selectedDetailOrder.plan_code) {
                            case 'free': return 'Gratis Terbatas';
                            case 'pro_starter': return 'Pro Starter';
                            case 'pro_business': return 'Pro Bisnis';
                            default: return selectedDetailOrder.plan_code || 'Paket Langganan';
                          }
                        })()}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)' }}>Siklus Penagihan</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #cbd5e1)' }}>
                        {selectedDetailOrder.billing_cycle === 'annual' ? 'Tahunan (12 Bulan)' : 'Bulanan (1 Bulan)'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)' }}>Waktu Pemesanan</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #cbd5e1)' }}>
                        {selectedDetailOrder.created_at ? new Date(selectedDetailOrder.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '-'}
                      </span>
                    </div>
                    {selectedDetailOrder.paid_at && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)' }}>Waktu Pelunasan</span>
                        <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700 }}>
                          {new Date(selectedDetailOrder.paid_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )}
                    <div style={{
                      height: '1px',
                      backgroundColor: 'var(--border-light, #334155)',
                      margin: '0.2rem 0'
                    }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)' }}>Harga Paket</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #cbd5e1)' }}>
                        Rp {Number(selectedDetailOrder.original_amount || selectedDetailOrder.final_amount || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                    {selectedDetailOrder.discount_amount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.76rem', color: '#a855f7' }}>Potongan Diskon Kupon</span>
                        <span style={{ fontSize: '0.8rem', color: '#a855f7', fontWeight: 700 }}>
                          -Rp {Number(selectedDetailOrder.discount_amount).toLocaleString('id-ID')}
                        </span>
                      </div>
                    )}
                    {selectedDetailOrder.unique_code > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.76rem', color: 'var(--primary, #10b981)' }}>Kode Unik Transfer</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--primary, #10b981)', fontWeight: 700 }}>
                          +Rp {selectedDetailOrder.unique_code}
                        </span>
                      </div>
                    )}
                    <div style={{
                      height: '1px',
                      backgroundColor: 'var(--border-light, #334155)',
                      margin: '0.2rem 0'
                    }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary, #f8fafc)' }}>Total Tagihan</strong>
                      <strong style={{ fontSize: '1rem', color: 'var(--primary, #10b981)' }}>
                        Rp {Number(selectedDetailOrder.final_amount || 0).toLocaleString('id-ID')}
                      </strong>
                    </div>
                  </div>

                  {/* CONTEXTUAL PAYMENT MODE BLOCK */}
                  {(() => {
                    const mode = selectedDetailOrder.payment_mode || (selectedDetailOrder.final_amount === 0 ? 'coupon_free' : 'gateway_aulaa');
                    const isAulaa = mode === 'gateway_aulaa' || mode === 'aulaa';
                    const isManual = mode === 'manual_qris' || mode === 'manual_bank';
                    const isCoupon = mode === 'coupon_free' || selectedDetailOrder.final_amount === 0;
                    const st = selectedDetailOrder.payment_status || selectedDetailOrder.status;
                    const isPending = st === 'pending';
                    const isPaid = st === 'paid';
                    const isPendingVerif = st === 'pending_verification';

                    if (isAulaa) {
                      return (
                        <div style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '0.75rem',
                          background: 'rgba(56, 189, 248, 0.04)',
                          border: '1px solid rgba(56, 189, 248, 0.2)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CreditCard size={16} color="#38bdf8" />
                            <strong style={{ fontSize: '0.82rem', color: '#38bdf8' }}>
                              Metode: Pembayaran Online Aulaa ({selectedDetailOrder.payment_method?.toUpperCase() || 'QRIS / VA'})
                            </strong>
                          </div>

                          {selectedDetailOrder.gateway_reference && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: 'rgba(0,0,0,0.25)',
                              padding: '0.45rem 0.65rem',
                              borderRadius: '0.45rem',
                              border: '1px solid rgba(255,255,255,0.06)'
                            }}>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>
                                Ref Gateway: <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{selectedDetailOrder.gateway_reference}</strong>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopyGatewayRef(selectedDetailOrder.gateway_reference)}
                                style={{
                                  padding: '0.35rem 0.6rem',
                                  borderRadius: '0.4rem',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  background: 'rgba(255,255,255,0.06)',
                                  color: copiedRefToast ? '#10b981' : 'var(--text-primary, #f8fafc)',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  minHeight: '34px'
                                }}
                              >
                                {copiedRefToast ? <Check size={12} /> : <Copy size={12} />}
                                <span>{copiedRefToast ? 'Tersalin' : 'Salin'}</span>
                              </button>
                            </div>
                          )}

                          {isPending && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.2rem' }}>
                              {selectedDetailOrder.gateway_payment_link && (
                                <a
                                  href={selectedDetailOrder.gateway_payment_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    minHeight: '44px',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '0.5rem',
                                    background: 'var(--primary, #10b981)',
                                    color: '#ffffff',
                                    fontSize: '0.82rem',
                                    fontWeight: 800,
                                    textDecoration: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem'
                                  }}
                                >
                                  <ExternalLink size={15} />
                                  <span>Buka Pembayaran Online Aulaa</span>
                                </a>
                              )}
                              <button
                                type="button"
                                disabled={syncingOrderId === selectedDetailOrder.id}
                                onClick={() => handleSyncOrder(selectedDetailOrder.id)}
                                style={{
                                  minHeight: '44px',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '0.5rem',
                                  background: 'var(--btn-secondary-bg, rgba(255,255,255,0.08))',
                                  border: '1px solid var(--btn-secondary-border, rgba(255,255,255,0.15))',
                                  color: 'var(--btn-secondary-text, var(--text-primary))',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.4rem'
                                }}
                              >
                                <RefreshCw size={14} className={syncingOrderId === selectedDetailOrder.id ? 'animate-spin' : ''} />
                                <span>{syncingOrderId === selectedDetailOrder.id ? 'Menyinkronkan...' : 'Sinkronkan / Periksa Status Gateway'}</span>
                              </button>
                            </div>
                          )}

                          {isPaid && (
                            <div style={{
                              padding: '0.65rem 0.85rem',
                              borderRadius: '0.5rem',
                              background: 'rgba(16, 185, 129, 0.1)',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              color: '#10b981',
                              fontSize: '0.76rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}>
                              <CheckCircle2 size={15} />
                              <span>Pembayaran terverifikasi otomatis oleh gateway Aulaa dan paket telah aktif.</span>
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (isManual) {
                      const isBank = mode === 'manual_bank' || selectedDetailOrder.payment_method === 'bank';
                      return (
                        <div style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '0.75rem',
                          background: 'rgba(16, 185, 129, 0.04)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {isBank ? <Building2 size={16} color="var(--primary)" /> : <QrCode size={16} color="var(--primary)" />}
                            <strong style={{ fontSize: '0.82rem', color: 'var(--primary)' }}>
                              Metode: {isBank ? 'Transfer Bank' : 'Manual QRIS'} (Verifikasi Tim Catavor)
                            </strong>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Nama Pengirim / Pemilik:</span>
                              <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>
                                {selectedDetailOrder.sender_account_name || '-'}
                              </strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted, #94a3b8)' }}>No. WhatsApp / HP:</span>
                              <span style={{ color: 'var(--text-primary, #f8fafc)' }}>
                                {selectedDetailOrder.sender_phone || '-'}
                              </span>
                            </div>
                          </div>

                          {/* PROOF THUMBNAIL */}
                          {(() => {
                            const resolvedProof = resolveProofImageUrl(selectedDetailOrder, token);
                            return (
                              <div>
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '0.4rem' }}>
                                  Bukti Pembayaran:
                                </span>
                                {resolvedProof ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div
                                      onClick={() => handleOpenProofLightbox(resolvedProof, selectedDetailOrder)}
                                      style={{
                                        width: '74px',
                                        height: '74px',
                                        borderRadius: '0.5rem',
                                        overflow: 'hidden',
                                        border: '1px solid var(--border-light, #334155)',
                                        cursor: 'pointer',
                                        backgroundColor: '#000000',
                                        flexShrink: 0
                                      }}
                                    >
                                      <SafeImage
                                        src={resolvedProof}
                                        alt="Bukti Transfer"
                                        isDark={true}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                      <span style={{ fontSize: '0.76rem', color: 'var(--text-primary, #f8fafc)', fontWeight: 600 }}>
                                        Foto Bukti Transfer
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenProofLightbox(resolvedProof, selectedDetailOrder)}
                                        style={{
                                          minHeight: '34px',
                                          padding: '0.3rem 0.65rem',
                                          borderRadius: '0.4rem',
                                          background: 'rgba(255,255,255,0.06)',
                                          border: '1px solid var(--border-light, #334155)',
                                          color: 'var(--text-primary, #f8fafc)',
                                          fontSize: '0.72rem',
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.3rem'
                                        }}
                                      >
                                        <Eye size={12} />
                                        <span>Perbesar Foto</span>
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{
                                    padding: '0.65rem',
                                    borderRadius: '0.5rem',
                                    background: 'rgba(245, 158, 11, 0.08)',
                                    border: '1px dashed rgba(245, 158, 11, 0.3)',
                                    color: '#f59e0b',
                                    fontSize: '0.74rem'
                                  }}>
                                    Belum ada foto bukti pembayaran yang diunggah.
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* VERIFICATION STATUS CALLOUT */}
                          {isPendingVerif && (
                            <div style={{
                              padding: '0.65rem 0.85rem',
                              borderRadius: '0.5rem',
                              background: 'rgba(59, 130, 246, 0.1)',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                              color: '#3b82f6',
                              fontSize: '0.74rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}>
                              <Clock size={15} />
                              <span>Bukti transfer sedang diverifikasi oleh tim Catavor (estimasi 10–30 menit kerja).</span>
                            </div>
                          )}

                          {isPaid && (
                            <div style={{
                              padding: '0.65rem 0.85rem',
                              borderRadius: '0.5rem',
                              background: 'rgba(16, 185, 129, 0.1)',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              color: '#10b981',
                              fontSize: '0.74rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}>
                              <CheckCircle2 size={15} />
                              <span>Pembayaran telah disetujui sah oleh staf platform dan paket toko aktif.</span>
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (isCoupon) {
                      return (
                        <div style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '0.75rem',
                          background: 'rgba(168, 85, 247, 0.05)',
                          border: '1px solid rgba(168, 85, 247, 0.2)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.6rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Tag size={16} color="#a855f7" />
                            <strong style={{ fontSize: '0.82rem', color: '#a855f7' }}>
                              Aktivasi Kupon Promosi 100%
                            </strong>
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary, #cbd5e1)' }}>
                            Kode Kupon: <strong style={{ color: '#a855f7' }}>{selectedDetailOrder.coupon_code || 'PROMO100'}</strong>
                          </div>
                          <div style={{
                            padding: '0.55rem 0.75rem',
                            borderRadius: '0.5rem',
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            color: '#10b981',
                            fontSize: '0.74rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                          }}>
                            <CheckCircle2 size={15} />
                            <span>Paket aktif tanpa tagihan tunai melalui kupon diskon 100%.</span>
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })()}
                </div>

                {/* FOOTER (NO 'X' IN HEADER, HIGH CONTRAST BUTTON IN FOOTER) */}
                <div style={{
                  padding: '0.85rem 1.25rem 1.15rem',
                  borderTop: '1px solid var(--border-light, #334155)',
                  backgroundColor: 'var(--bg-deep, #0f172a)'
                }}>
                  <button
                    type="button"
                    onClick={handleCloseOrderDetail}
                    style={{
                      width: '100%',
                      minHeight: '46px',
                      borderRadius: '0.65rem',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      fontSize: '0.88rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <span>Tutup Rincian</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* LIGHTBOX FOR TRANSFER PROOF */}
          {previewProofImg && createPortal(
            <ProofLightbox
              imageUrl={previewProofImg}
              onClose={handleCloseProofLightbox}
              isMobile={true}
            />,
            document.body
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
            padding: '0.35rem 0.75rem',
            borderRadius: '0.45rem',
            fontSize: '0.74rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}
        >
          {isFree ? (
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

      {/* Metrics Row: 2 Clean Balanced Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
        {/* Metric 1: Item */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.74rem', gap: '0.35rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Item</span>
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
          {quota.archived_items_count > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.66rem', color: '#f59e0b', fontWeight: 700, marginTop: '0.1rem' }}>
              <Archive size={9} strokeWidth={2.4} />
              <span>{quota.archived_items_count} Diarsipkan</span>
            </div>
          )}
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
