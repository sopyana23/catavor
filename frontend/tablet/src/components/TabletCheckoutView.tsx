import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ShieldAlert,
  CreditCard,
  QrCode,
  Copy,
  Check,
  CheckCircle,
  Upload,
  Download,
  Send,
  ArrowLeft,
  ArrowRight,
  Lock,
  Mail,
  Store,
  Zap,
  AlertTriangle,
  Loader2,
  Building,
  User,
  Tag,
  Calendar,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  MessageCircle,
  Trash2,
  LogIn
} from 'lucide-react';
import { smartBack } from '../utils/navigation';
import { hasValidSessionToken, clearRegistrationDrafts, resolveAuthenticatedRedirect } from '../utils/authSync';

export interface TabletCheckoutViewProps {
  initialPlan?: 'pro_starter' | 'pro_business' | 'free';
  initialBilling?: 'monthly' | 'annual';
  onBack?: () => void;
  onCancel?: () => void;
  onSuccess?: (registeredUser: any) => void;
  onNavigateToLogin?: () => void;
  platformSettings?: Record<string, string>;
}

export const TabletCheckoutView: React.FC<TabletCheckoutViewProps> = ({
  initialPlan = 'pro_starter',
  initialBilling = 'monthly',
  onBack,
  onCancel,
  onSuccess,
  onNavigateToLogin,
  platformSettings: propSettings
}) => {
  // 1. Dual-Form-Factor Viewport Detection (Tablet Mini < 880px vs Wide Tablet >= 880px)
  const [isMiniTablet, setIsMiniTablet] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 880 : false;
  });

  useEffect(() => {
    if (hasValidSessionToken()) {
      clearRegistrationDrafts();
      const dest = resolveAuthenticatedRedirect();
      window.location.replace(dest);
    }
  }, []);

  useEffect(() => {
    if (!hasValidSessionToken()) {
      const saved = sessionStorage.getItem('catavor_register_form');
      let parsed: any = {};
      if (saved) {
        try { parsed = JSON.parse(saved); } catch {}
      }
      if (!parsed.email || !parsed.store_slug) {
        if (onBack) onBack();
      }
    }
  }, [onBack]);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setIsMiniTablet(window.innerWidth < 880);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 2. Hydrate URL & Session Storage State
  const [registerPlan, setRegisterPlan] = useState<'pro_starter' | 'pro_business' | 'free'>(() => {
    if (typeof window !== 'undefined') {
      const qPlan = new URLSearchParams(window.location.search).get('plan');
      if (qPlan === 'pro_business') return 'pro_business';
      if (qPlan === 'pro_starter') return 'pro_starter';
      if (qPlan === 'free') return 'free';
      const savedPlan = sessionStorage.getItem('catavor_register_plan');
      if (savedPlan === 'pro_business') return 'pro_business';
      if (savedPlan === 'pro_starter') return 'pro_starter';
      if (savedPlan === 'free') return 'free';
    }
    return (initialPlan === 'pro_business' ? 'pro_business' : (initialPlan === 'free' ? 'free' : 'pro_starter'));
  });

  // Billing Cycle State (Preserve URL billing query param)
  const [registerBillingCycle, setRegisterBillingCycle] = useState<'monthly' | 'annual'>(() => {
    if (typeof window !== 'undefined') {
      const qBilling = new URLSearchParams(window.location.search).get('billing');
      if (qBilling === 'annual' || qBilling === 'monthly') return qBilling;
      const savedBilling = sessionStorage.getItem('catavor_register_billing');
      if (savedBilling === 'annual' || savedBilling === 'monthly') return savedBilling as 'monthly' | 'annual';
    }
    return initialBilling === 'annual' ? 'annual' : 'monthly';
  });

  // Registration Form State (Account & Store Info)
  const [registerForm, setRegisterForm] = useState<{
    name: string;
    email: string;
    password: string;
    store_name: string;
    store_slug: string;
    google_id?: string;
    avatar?: string;
  }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('catavor_register_form');
        let parsed: any = {};
        if (saved) {
          parsed = JSON.parse(saved);
        }

        return {
          name: parsed.name || '',
          email: parsed.email || '',
          password: parsed.password || '',
          store_name: parsed.store_name || '',
          store_slug: parsed.store_slug || '',
          google_id: parsed.google_id || '',
          avatar: parsed.avatar || ''
        };
      } catch {}
    }
    return { name: '', email: '', password: '', store_name: '', store_slug: '', google_id: '', avatar: '' };
  });

  const isGoogleAuth = Boolean(
    registerForm.google_id ||
    (() => {
      try {
        const u = localStorage.getItem('catavor_user');
        if (u) {
          const parsed = JSON.parse(u);
          return Boolean(parsed.google_id);
        }
      } catch {}
      return false;
    })()
  );

  const [showAccountFormEdit, setShowAccountFormEdit] = useState<boolean>(() => {
    return !registerForm.name || !registerForm.email || !registerForm.store_name;
  });

  // Payment Method & Settings State
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'qris'>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('catavor_payment_method');
      if (saved === 'qris') return 'qris';
    }
    return 'bank';
  });

  const [aulaaChannel, setAulaaChannel] = useState<'qris' | 'va' | 'ewallet' | 'cc'>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('catavor_aulaa_channel') as any;
      if (['qris', 'va', 'ewallet', 'cc'].includes(saved)) return saved;
    }
    return 'qris';
  });

  const handleSelectAulaaChannel = (channel: 'qris' | 'va' | 'ewallet' | 'cc') => {
    setAulaaChannel(channel);
    try {
      sessionStorage.setItem('catavor_aulaa_channel', channel);
    } catch {}
    if (channel === 'qris' || channel === 'ewallet') {
      setPaymentMethod('qris');
    } else {
      setPaymentMethod('bank');
    }
  };

  const [platformSettings, setPlatformSettings] = useState<Record<string, string>>(() => {
    return propSettings || {};
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          const s = json.data || json;
          if (s && typeof s === 'object') {
            setPlatformSettings(prev => ({ ...prev, ...s }));
          }
        }
      } catch (err) {
        console.warn('Failed to fetch settings in TabletCheckoutView:', err);
      }
    };
    fetchSettings();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'catavor_platform_settings_updated') {
        fetchSettings();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchSettings();
      }
    };
    window.addEventListener('focus', fetchSettings);
    window.addEventListener('catavor_platform_settings_updated', fetchSettings);
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', fetchSettings);
      window.removeEventListener('catavor_platform_settings_updated', fetchSettings);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const isCancelledRef = useRef<boolean>(false);

  // Sync state changes to Session Storage & URL params
  useEffect(() => {
    if (isCancelledRef.current) return;
    try {
      sessionStorage.setItem('catavor_register_plan', registerPlan);
      sessionStorage.setItem('catavor_register_billing', registerBillingCycle);
      sessionStorage.setItem('catavor_payment_method', paymentMethod);
      sessionStorage.setItem('catavor_register_form', JSON.stringify(registerForm));
      
      const newUrl = `/checkout?plan=${registerPlan}&billing=${registerBillingCycle}`;
      if (window.location.pathname + window.location.search !== newUrl) {
        window.history.replaceState({}, '', newUrl);
      }
    } catch {}
  }, [registerPlan, registerBillingCycle, paymentMethod, registerForm]);

  // Coupon State
  const [couponInput, setCouponInput] = useState<string>('');
  const [couponValidating, setCouponValidating] = useState<boolean>(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    type: 'free' | 'discount';
    discount: number;
    label: string;
  } | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('catavor_applied_coupon');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return null;
  });
  const [couponMsg, setCouponMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Upload Proof of Payment State
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null);
  const [paymentProofNote, setPaymentProofNote] = useState<string>('');
  const [copiedAccountToast, setCopiedAccountToast] = useState<boolean>(false);
  const [registerLoading, setRegisterLoading] = useState<boolean>(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [createdUserData, setCreatedUserData] = useState<any>(null);

  // Strict Monthly Price Calculations (1 Month)
  const originalPrice = registerPlan === 'free' ? 0 : (registerPlan === 'pro_business' ? 129000 : 30000);
  const normalPrice = registerPlan === 'free' ? 0 : (registerPlan === 'pro_business' ? 150000 : 65000);

  const discountAmount = appliedCoupon
    ? (appliedCoupon.type === 'free' ? originalPrice : Number(appliedCoupon.discount || (appliedCoupon as any).discount_amount || (appliedCoupon as any).discount_value || 0))
    : 0;

  const finalPrice = Math.max(0, originalPrice - discountAmount);

  // Auto-slugify helper
  const handleStoreNameChange = (name: string) => {
    const slugified = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setRegisterForm(prev => ({
      ...prev,
      store_name: name,
      store_slug: prev.store_slug === '' || prev.store_slug === prev.store_name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        ? slugified
        : prev.store_slug
    }));
  };

  // Coupon Verification Handler
  const handleApplyCoupon = async () => {
    const cleanCode = couponInput.trim().toUpperCase();
    if (!cleanCode) {
      setCouponMsg({ type: 'error', text: 'Masukkan kode kupon terlebih dahulu.' });
      return;
    }
    setCouponValidating(true);
    setCouponMsg(null);
    try {
      const res = await fetch('/api/subscription/verify-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          plan: registerPlan,
          amount: originalPrice
        })
      });
      const data = await res.json();
      const couponObj = data.coupon || data.data;
      if (res.ok && (data.valid || data.success) && couponObj) {
        setAppliedCoupon(couponObj);
        try {
          sessionStorage.setItem('catavor_applied_coupon', JSON.stringify(couponObj));
        } catch {}
        setCouponMsg({
          type: 'success',
          text: `Kupon ${couponObj.code} Berhasil! (${couponObj.label || 'Diskon diterapkan'})`
        });
      } else {
        setCouponMsg({
          type: 'error',
          text: data.message || `Kode kupon "${cleanCode}" tidak berlaku atau telah kadaluarsa.`
        });
      }
    } catch {
      setCouponMsg({ type: 'error', text: 'Gagal memverifikasi kupon. Periksa koneksi Anda.' });
    } finally {
      setCouponValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponMsg(null);
    setCouponInput('');
    try {
      sessionStorage.removeItem('catavor_applied_coupon');
    } catch {}
  };

  // Copy Account Number
  const handleCopyAccount = () => {
    const rawAcc = (platformSettings.payment_bank_account || '8830-1928-3920').replace(/[^0-9]/g, '');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(rawAcc);
      setCopiedAccountToast(true);
      setTimeout(() => setCopiedAccountToast(false), 2500);
    }
  };

  // File Upload Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Ukuran berkas bukti maksimal 5 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentProofPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submission Handler
  const handleSubmitCheckout = async (isFreeBypass: boolean = false, planOverride?: 'free' | 'pro_starter' | 'pro_business') => {
    setRegisterError(null);

    // Validation
    if (!registerForm.name.trim()) {
      setRegisterError('Nama lengkap pendaftar wajib diisi.');
      setShowAccountFormEdit(true);
      return;
    }
    if (!registerForm.email.trim() || !registerForm.email.includes('@')) {
      setRegisterError('Alamat email valid wajib diisi.');
      setShowAccountFormEdit(true);
      return;
    }
    if (!isGoogleAuth && (!registerForm.password || registerForm.password.length < 6)) {
      setRegisterError('Kata sandi minimal 6 karakter.');
      setShowAccountFormEdit(true);
      return;
    }
    if (!registerForm.store_name.trim()) {
      setRegisterError('Nama toko atau katalog wajib diisi.');
      setShowAccountFormEdit(true);
      return;
    }
    if (!registerForm.store_slug.trim()) {
      setRegisterError('Link URL domain toko wajib diisi.');
      setShowAccountFormEdit(true);
      return;
    }

    const effectivePlan = planOverride || (isFreeBypass && registerPlan === 'free' ? 'free' : registerPlan);
    if (planOverride === 'free') {
      setRegisterPlan('free');
    }

    const paymentSystemMode = platformSettings.payment_system_mode || 'manual_qris';
    if (!isFreeBypass && paymentSystemMode === 'manual_qris' && !paymentProofPreview) {
      setRegisterError('Bukti transfer / scan QRIS wajib diunggah sebelum mengirim konfirmasi.');
      return;
    }

    setRegisterLoading(true);
    try {
      let effectiveGoogleId = registerForm.google_id;
      if (!effectiveGoogleId) {
        try {
          const u = localStorage.getItem('catavor_user');
          if (u) {
            const parsed = JSON.parse(u);
            if (parsed.google_id) effectiveGoogleId = parsed.google_id;
          }
        } catch {}
      }

      const isAulaa = paymentSystemMode === 'gateway_aulaa';
      const effectivePaymentMethod = isFreeBypass
        ? 'free'
        : isAulaa
          ? aulaaChannel
          : paymentMethod;

      const payload = {
        name: registerForm.name.trim(),
        email: registerForm.email.trim().toLowerCase(),
        password: isGoogleAuth ? undefined : registerForm.password,
        google_id: effectiveGoogleId || undefined,
        store_name: registerForm.store_name.trim(),
        store_slug: registerForm.store_slug.trim().toLowerCase(),
        plan: effectivePlan,
        billing_cycle: registerBillingCycle,
        coupon_code: appliedCoupon?.code || '',
        payment_method: effectivePaymentMethod,
        payment_mode: isFreeBypass ? 'free' : (isAulaa ? 'gateway_aulaa' : (paymentMethod === 'qris' ? 'manual_qris' : 'manual_bank')),
        payment_status: isFreeBypass ? 'approved' : 'pending_approval',
        payment_proof_url: isFreeBypass ? null : paymentProofPreview,
        payment_note: paymentProofNote ? paymentProofNote.trim() : undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta'
      };

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Clear registration drafts
        try {
          sessionStorage.removeItem('catavor_register_form');
          sessionStorage.removeItem('catavor_register_plan');
          sessionStorage.removeItem('catavor_register_billing');
          sessionStorage.removeItem('catavor_applied_coupon');
          sessionStorage.removeItem('catavor_payment_method');
          sessionStorage.removeItem('catavor_aulaa_channel');
        } catch {}

        if (data.token) {
          localStorage.setItem('catavor_token', data.token);
        }
        if (data.user) {
          localStorage.setItem('catavor_user', JSON.stringify(data.user));
          setCreatedUserData(data.user);
        }
        if (data.stores && Array.isArray(data.stores)) {
          localStorage.setItem('catavor_stores', JSON.stringify(data.stores));
        }
        if (data.user?.store_slug) {
          localStorage.setItem('catavor_active_slug', data.user.store_slug);
        }
        localStorage.setItem('catavor_password_changed', 'true');

        if (data.payment_url) {
          window.location.href = data.payment_url;
          return;
        }

        if (isAulaa && !isFreeBypass && finalPrice > 0) {
          setRegisterError('Gagal mendapatkan tautan pembayaran Aulaa. Silakan periksa koneksi atau hubungi admin.');
          return;
        }

        setShowSuccessModal(true);
        if (onSuccess) {
          onSuccess(data.user);
        }
      } else {
        setRegisterError(data.message || 'Pendaftaran gagal. Silakan periksa kembali data Anda.');
      }
    } catch {
      setRegisterError('Gagal menghubungkan ke server. Silakan coba beberapa saat lagi.');
    } finally {
      setRegisterLoading(false);
    }
  };

  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);

  const handleCancelRegistration = () => {
    setShowCancelModal(true);
  };

  const handleConfirmCancel = () => {
    isCancelledRef.current = true;
    try {
      sessionStorage.removeItem('catavor_register_form');
      sessionStorage.removeItem('catavor_register_plan');
      sessionStorage.removeItem('catavor_register_billing');
      sessionStorage.removeItem('catavor_applied_coupon');
      sessionStorage.removeItem('catavor_payment_method');
      sessionStorage.removeItem('catavor_portal_tab');
      sessionStorage.removeItem('catavor_register_step');
    } catch {}
    setShowCancelModal(false);
    if (onCancel) {
      onCancel();
    } else {
      smartBack('/');
    }
  };

  const handleDownloadQRIS = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const qrisTarget = platformSettings.payment_qris_manual_image || platformSettings.payment_qris_image || '/img/qris_demo.svg';
    if (!qrisTarget) return;
    try {
      const res = await fetch(qrisTarget);
      if (!res.ok) throw new Error('File tidak dapat diakses');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const ext = qrisTarget.endsWith('.jpg') || qrisTarget.endsWith('.jpeg') ? '.jpg' : (qrisTarget.endsWith('.svg') ? '.svg' : '.png');
      a.download = `QRIS_Catavor_Payment${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(qrisTarget, '_blank');
    }
  };

  const officialWa = platformSettings.platform_official_whatsapp || platformSettings.contact_whatsapp || platformSettings.rekber_wa_number || '62811220227';
  const officialEmail = platformSettings.platform_official_email || platformSettings.contact_email || 'support@catavor.com';
  const cleanWaNumber = officialWa.replace(/[^0-9]/g, '');
  const waUrl = `https://wa.me/${cleanWaNumber}?text=${encodeURIComponent('Halo Tim Support Catavor, saya membutuhkan bantuan terkait proses checkout pembayaran pendaftaran toko.')}`;

  const paymentSystemMode = platformSettings.payment_system_mode || 'manual_qris';
  const isMaintenance = paymentSystemMode === 'maintenance';
  const isAulaa = paymentSystemMode === 'gateway_aulaa';

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-deep, #f8fafc)',
      color: 'var(--text-primary, #0f172a)',
      padding: isMiniTablet ? '1.25rem 1rem 3.5rem 1rem' : '2rem 1.5rem 4rem 1.5rem',
      fontFamily: 'inherit'
    }}>
      <div style={{
        maxWidth: isMiniTablet ? '680px' : '980px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        {/* Top Header & Smart Back Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid var(--border-light, #e2e8f0)'
        }}>
          <button
            type="button"
            onClick={onBack || (() => { window.location.href = '/register/step-3'; })}
            style={{
              minHeight: '44px',
              padding: '0.45rem 0.95rem',
              borderRadius: '0.65rem',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <ArrowLeft size={16} />
            <span>Kembali ke Pilihan Paket</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>Sudah punya akun?</span>
              <button
                type="button"
                onClick={() => {
                  if (onNavigateToLogin) onNavigateToLogin();
                  else window.location.href = '/login';
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontWeight: 800,
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  textDecoration: 'underline'
                }}
              >
                <span>Masuk</span>
                <LogIn size={13} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleCancelRegistration}
              style={{
                minHeight: '44px',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.82rem',
                fontWeight: 600,
                textDecoration: 'underline',
                cursor: 'pointer'
              }}
            >
              Batalkan Pendaftaran
            </button>
          </div>
        </div>

        {/* Hero Title Section */}
        <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '9999px',
            backgroundColor: registerPlan === 'pro_business' ? '#fef3c7' : '#e0f2fe',
            color: registerPlan === 'pro_business' ? '#b45309' : '#0369a1',
            fontSize: '0.74rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '0.65rem'
          }}>
            <Sparkles size={13} />
            <span>Aktivasi Paket {registerPlan === 'pro_business' ? 'Pro Bisnis' : 'Pro Starter'}</span>
          </div>

          <h1 style={{
            fontSize: isMiniTablet ? '1.5rem' : '1.85rem',
            fontWeight: 900,
            color: '#0f172a',
            margin: '0 0 0.35rem 0',
            letterSpacing: '-0.02em'
          }}>
            Selesaikan Pembayaran Aktivasi
          </h1>
          <p style={{
            fontSize: isMiniTablet ? '0.82rem' : '0.88rem',
            color: '#64748b',
            margin: 0,
            lineHeight: 1.5,
            maxWidth: '560px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            Transfer sesuai nominal tertera untuk langsung mempublikasikan katalog produk dan mengaktifkan fitur premium toko Anda.
          </p>
        </div>

        {/* Error Alert Banner */}
        {registerError && (
          <div style={{
            padding: '0.85rem 1.15rem',
            borderRadius: '0.75rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem'
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>{registerError}</span>
          </div>
        )}

        {/* Responsive Grid Layout (Mini Tablet: 1 Column Stacked, Wide Tablet: 2 Column Split) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMiniTablet ? '1fr' : 'minmax(330px, 1fr) minmax(390px, 1.25fr)',
          gap: '1.25rem',
          alignItems: 'start'
        }}>
          {/* LEFT COLUMN: Rincian Pesanan, Kupon & Data Akun Toko */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            {/* Card 1: Rincian Pesanan (Order Summary) */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              border: '1px solid #e2e8f0',
              padding: '1.35rem',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '0.75rem'
              }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                  Rincian Pesanan
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  backgroundColor: registerPlan === 'pro_business' ? '#fef3c7' : '#eff6ff',
                  color: registerPlan === 'pro_business' ? '#b45309' : '#1d4ed8',
                  border: registerPlan === 'pro_business' ? '1px solid #fde68a' : '1px solid #bfdbfe'
                }}>
                  {registerPlan === 'pro_business' ? 'PRO BISNIS' : 'PRO STARTER'}
                </span>
              </div>

              {/* Interactive Plan & Billing Cycle Switchers */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                  Pilih Paket:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setRegisterPlan('pro_starter')}
                    style={{
                      minHeight: '44px',
                      padding: '0.5rem 0.65rem',
                      borderRadius: '0.55rem',
                      border: registerPlan === 'pro_starter' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      backgroundColor: registerPlan === 'pro_starter' ? '#eff6ff' : '#ffffff',
                      color: registerPlan === 'pro_starter' ? '#1d4ed8' : '#475569',
                      fontWeight: 700,
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    Pro Starter (150 Item)
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegisterPlan('pro_business')}
                    style={{
                      minHeight: '44px',
                      padding: '0.5rem 0.65rem',
                      borderRadius: '0.55rem',
                      border: registerPlan === 'pro_business' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      backgroundColor: registerPlan === 'pro_business' ? '#eff6ff' : '#ffffff',
                      color: registerPlan === 'pro_business' ? '#1d4ed8' : '#475569',
                      fontWeight: 700,
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    Pro Bisnis (Unlimited)
                  </button>
                </div>
              </div>

              {/* Billing Cycle Indicator (Monthly Only) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                  Periode Sewa / Langganan:
                </label>
                <div style={{
                  padding: '0.75rem 0.95rem',
                  borderRadius: '0.65rem',
                  backgroundColor: '#eff6ff',
                  border: '1.5px solid #bfdbfe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#dbeafe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#2563eb',
                      flexShrink: 0
                    }}>
                      <Calendar size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1e40af' }}>
                        Bulanan (1 Bulan)
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Tagihan dibayarkan per bulan (30 hari). Fleksibel dan tanpa komitmen panjang.
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '999px',
                    backgroundColor: '#dbeafe',
                    color: '#1d4ed8',
                    whiteSpace: 'nowrap'
                  }}>
                    Aktif 30 Hari
                  </span>
                </div>
              </div>

              {/* Price Breakdown */}
              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: '0.75rem',
                border: '1px solid #e2e8f0',
                padding: '0.85rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                fontSize: '0.8rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Periode Sewa:</span>
                  <strong style={{ color: '#0f172a' }}>1 Bulan (30 Hari)</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Harga Normal:</span>
                  <span style={{ textDecoration: 'line-through' }}>
                    Rp {normalPrice.toLocaleString('id-ID')}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                  <span>Diskon Paket:</span>
                  <strong>- Rp {(normalPrice - originalPrice).toLocaleString('id-ID')}</strong>
                </div>

                {appliedCoupon && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '0.5rem',
                    color: '#15803d'
                  }}>
                    <div>
                      <span style={{ fontWeight: 800 }}>Kupon ({appliedCoupon.code}):</span>
                      <div style={{ fontSize: '0.7rem', color: '#166534' }}>{appliedCoupon.label}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <strong>- Rp {discountAmount.toLocaleString('id-ID')}</strong>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.65rem',
                  borderTop: '1px solid #e2e8f0',
                  fontSize: '0.92rem',
                  fontWeight: 900,
                  color: '#0f172a'
                }}>
                  <span>Total Tagihan:</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: '1.25rem',
                      color: finalPrice === 0 ? '#16a34a' : '#2563eb'
                    }}>
                      Rp {finalPrice.toLocaleString('id-ID')}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500, marginLeft: '0.25rem' }}>
                      / bulan
                    </span>
                    {finalPrice === 0 && (
                      <span style={{
                        fontSize: '0.74rem',
                        color: '#16a34a',
                        marginLeft: '0.35rem',
                        fontWeight: 800
                      }}>
                        (GRATIS)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Coupon Box */}
              <div style={{
                paddingTop: '0.85rem',
                borderTop: '1px dashed #cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem'
              }}>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#334155' }}>
                  Punya Kode Kupon / Diskon?
                </label>
                <div style={{ display: 'flex', gap: '0.45rem' }}>
                  <input
                    type="text"
                    placeholder="Contoh: POTONG5, CATAVOR100"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      if (couponMsg) setCouponMsg(null);
                    }}
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      padding: '0.55rem 0.85rem',
                      fontSize: '0.84rem',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '0.55rem',
                      color: '#0f172a',
                      textTransform: 'uppercase',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    disabled={couponValidating}
                    onClick={handleApplyCoupon}
                    style={{
                      minHeight: '44px',
                      padding: '0.55rem 1rem',
                      borderRadius: '0.55rem',
                      backgroundColor: couponValidating ? '#94a3b8' : '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: couponValidating ? '#ffffff' : '#1d4ed8',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: couponValidating ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {couponValidating ? <Loader2 size={16} className="animate-spin" /> : 'Terapkan'}
                  </button>
                </div>

                {couponMsg && (
                  <div style={{
                    fontSize: '0.74rem',
                    color: couponMsg.type === 'success' ? '#16a34a' : '#dc2626',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    marginTop: '0.25rem'
                  }}>
                    {couponMsg.type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
                    <span>{couponMsg.text}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Data Akun & Toko Pendaftar */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              border: '1px solid #e2e8f0',
              padding: '1.35rem',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '0.65rem'
              }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                  Data Akun &amp; Toko Baru
                </span>
                {registerForm.email && registerForm.store_name && (
                  <button
                    type="button"
                    onClick={() => setShowAccountFormEdit(!showAccountFormEdit)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {showAccountFormEdit ? 'Selesai Edit' : 'Ubah Data'}
                  </button>
                )}
              </div>

              {!showAccountFormEdit && registerForm.email ? (
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '0.65rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.78rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Pemilik:</span>
                    <strong style={{ color: '#0f172a' }}>{registerForm.name} ({registerForm.email})</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Toko:</span>
                    <strong style={{ color: '#0f172a' }}>{registerForm.store_name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Domain:</span>
                    <span style={{ color: '#2563eb', fontWeight: 700 }}>catavor.com/{registerForm.store_slug}</span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                      Nama Lengkap Anda *
                    </label>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.55rem',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff'
                    }}>
                      <User size={16} color="#64748b" />
                      <input
                        type="text"
                        placeholder="Nama pemilik toko"
                        value={registerForm.name}
                        onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                        style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.85rem', color: '#0f172a' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                      Alamat Email Aktif *
                    </label>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.55rem',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff'
                    }}>
                      <Mail size={16} color="#64748b" />
                      <input
                        type="email"
                        placeholder="nama@email.com"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                        style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.85rem', color: '#0f172a' }}
                      />
                    </div>
                  </div>

                  {isGoogleAuth ? (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                        Autentikasi Akun
                      </label>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '0.55rem',
                        border: '1px solid #bfdbfe',
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        fontSize: '0.8rem',
                        fontWeight: 600
                      }}>
                        <Check size={16} style={{ flexShrink: 0, color: '#2563eb' }} />
                        <span>Terotentikasi via Akun Google. Kata sandi tidak diperlukan.</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                        Kata Sandi Baru * (Min. 6 Karakter)
                      </label>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '0.55rem',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff'
                      }}>
                        <Lock size={16} color="#64748b" />
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={registerForm.password}
                          onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                          style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.85rem', color: '#0f172a' }}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                      Nama Toko / Usaha *
                    </label>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.55rem',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff'
                    }}>
                      <Store size={16} color="#64748b" />
                      <input
                        type="text"
                        placeholder="Contoh: Galeri Anggrek Nusantara"
                        value={registerForm.store_name}
                        onChange={(e) => handleStoreNameChange(e.target.value)}
                        style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.85rem', color: '#0f172a' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                      Domain Slug Katalog *
                    </label>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.55rem',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc'
                    }}>
                      <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>catavor.com/</span>
                      <input
                        type="text"
                        placeholder="galeri-anggrek"
                        value={registerForm.store_slug}
                        onChange={(e) => setRegisterForm({
                          ...registerForm,
                          store_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                        })}
                        style={{
                          flex: 1,
                          border: 'none',
                          outline: 'none',
                          fontSize: '0.85rem',
                          color: '#0f172a',
                          fontWeight: 700,
                          backgroundColor: 'transparent'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Pembayaran, Upload Bukti & Tombol Konfirmasi */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              border: '1px solid #e2e8f0',
              padding: '1.35rem',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.15rem'
            }}>
              {/* Scenario 1: Final Price = 0 (100% Free Coupon Bypass) */}
              {finalPrice === 0 ? (
                <div style={{
                  padding: '1.5rem 1rem',
                  borderRadius: '0.85rem',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: '#dcfce7',
                    color: '#16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.15)'
                  }}>
                    <Sparkles size={28} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#14532d', margin: '0 0 0.35rem 0' }}>
                      Aktivasi 100% Gratis!
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: '#166534', margin: 0, lineHeight: 1.5 }}>
                      Kupon pendaftaran Anda berhasil membebaskan seluruh biaya aktivasi paket {registerPlan === 'pro_business' ? 'Pro Bisnis' : 'Pro Starter'}. Klik tombol di bawah ini untuk langsung membuat akun dan membuka dashboard.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={registerLoading}
                    onClick={() => handleSubmitCheckout(true)}
                    style={{
                      width: '100%',
                      minHeight: '48px',
                      padding: '0.85rem',
                      borderRadius: '0.65rem',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      cursor: registerLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)'
                    }}
                  >
                    {registerLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Mengaktifkan Akun...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        <span>Aktifkan Paket Sekarang (Gratis)</span>
                      </>
                    )}
                  </button>
                </div>
              ) : isMaintenance ? (
                /* Scenario 2: Payment Maintenance Mode with Best-Practice Tablet Guidance & Action CTAs */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                  {/* Alert Box: Maintenance Status */}
                  <div style={{
                    padding: '1.15rem 1.25rem',
                    borderRadius: '0.85rem',
                    backgroundColor: '#fffbeb',
                    border: '1.5px solid #fde68a',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.9rem'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: '#fef3c7',
                      color: '#d97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <ShieldAlert size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#92400e', margin: '0 0 0.3rem 0' }}>
                        {platformSettings.payment_maintenance_title || 'Sistem Pembayaran Sedang Dalam Pemeliharaan'}
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: '#b45309', margin: 0, lineHeight: 1.5 }}>
                        {platformSettings.payment_maintenance_message || 'Layanan transaksi pembayaran pendaftaran dan langganan paket saat ini sedang dinonaktifkan sementara untuk peningkatan kualitas layanan berkala.'}
                      </p>
                    </div>
                  </div>

                  {/* Recommendation & Solution Card: Start with Free Tier */}
                  <div style={{
                    padding: '1.25rem',
                    borderRadius: '0.85rem',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.95rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '0.5rem',
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Sparkles size={17} />
                      </div>
                      <div>
                        <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                          Tetap Dapat Membuka Toko Hari Ini (Paket Gratis)
                        </h5>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Akses langsung ke dashboard katalog toko tanpa kendala pembayaran
                        </span>
                      </div>
                    </div>

                    <div style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '0.65rem',
                      backgroundColor: '#ffffff',
                      border: '1px solid #f1f5f9',
                      fontSize: '0.8rem',
                      color: '#334155',
                      lineHeight: 1.55,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <Check size={16} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
                        <span>
                          Anda dapat melanjutkan pendaftaran menggunakan <strong>Paket Gratis (Free Tier - Rp 0)</strong> sekarang juga untuk mulai mengamankan link domain, mengatur profil toko, dan mengunggah produk.
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <Check size={16} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
                        <span>
                          Setelah pemeliharaan sistem pembayaran selesai, Anda dapat melakukan <strong>upgrade ke paket berbayar ({registerPlan === 'pro_business' ? 'Pro Bisnis' : 'Pro Starter'}) kapan saja</strong> langsung dari menu Langganan di dalam Dashboard Toko Anda.
                        </span>
                      </div>
                    </div>

                    {/* Primary Action Button: Lanjut dengan Paket Gratis (Touch target >= 44px) */}
                    <button
                      type="button"
                      disabled={registerLoading}
                      onClick={() => handleSubmitCheckout(true, 'free')}
                      style={{
                        width: '100%',
                        minHeight: '48px',
                        padding: '0.8rem 1.25rem',
                        borderRadius: '0.65rem',
                        backgroundColor: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        cursor: registerLoading ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        boxShadow: '0 4px 14px rgba(22, 163, 74, 0.25)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {registerLoading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>Mengaktifkan Toko Gratis...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={18} />
                          <span>Daftar / Beralih ke Paket Gratis (Rp 0)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Dedicated Account Login Card for Existing Users */}
                  <div style={{
                    padding: '1.15rem 1.25rem',
                    borderRadius: '0.85rem',
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
                    display: 'flex',
                    flexDirection: isMiniTablet ? 'column' : 'row',
                    alignItems: isMiniTablet ? 'flex-start' : 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '0.65rem',
                        backgroundColor: '#eff6ff',
                        border: '1.5px solid #dbeafe',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <LogIn size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>
                          Sudah Memiliki Akun Toko?
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.15rem', lineHeight: 1.4 }}>
                          Masuk langsung ke dashboard untuk mengelola katalog tanpa daftar ulang
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigateToLogin) {
                          onNavigateToLogin();
                        } else {
                          window.location.href = '/login';
                        }
                      }}
                      style={{
                        minHeight: '44px',
                        width: isMiniTablet ? '100%' : 'auto',
                        padding: '0.55rem 1.25rem',
                        borderRadius: '0.6rem',
                        backgroundColor: '#eff6ff',
                        border: '1.5px solid #2563eb',
                        color: '#1d4ed8',
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 6px rgba(37, 99, 235, 0.1)',
                        transition: 'all 0.15s ease',
                        flexShrink: 0
                      }}
                      title="Masuk ke portal dashboard menggunakan akun terdaftar"
                    >
                      <span>Masuk ke Akun</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              ) : isAulaa ? (
                /* Scenario 3: Aulaa Payment Gateway Mode */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{
                    padding: '0.95rem 1.15rem',
                    borderRadius: '0.75rem',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#166534' }}>
                        Gerbang Pembayaran Instan
                      </span>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '9999px',
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        <Zap size={12} /> Otomatis &amp; Terenkripsi
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#14532d', margin: 0, lineHeight: 1.45 }}>
                      Pembayaran diproses otomatis melalui Aulaa Gateway. Akun toko langsung aktif seketika setelah pembayaran terkonfirmasi.
                    </p>
                  </div>

                  {(() => {
                    const showQRIS = platformSettings.payment_aulaa_channel_qris !== '0';
                    const showVA = platformSettings.payment_aulaa_channel_va !== '0';
                    const showEWallet = platformSettings.payment_aulaa_channel_ewallet !== '0';
                    const showCC = platformSettings.payment_aulaa_channel_cc === '1';

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>Pilih Kanal Pembayaran Aulaa:</span>
                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>Tap untuk memilih</span>
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                            {showQRIS && (
                              <button
                                type="button"
                                onClick={() => handleSelectAulaaChannel('qris')}
                                style={{
                                  minHeight: '48px',
                                  padding: '0.7rem 0.85rem',
                                  borderRadius: '0.6rem',
                                  border: aulaaChannel === 'qris' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                  backgroundColor: aulaaChannel === 'qris' ? '#eff6ff' : '#ffffff',
                                  boxShadow: aulaaChannel === 'qris' ? '0 3px 10px rgba(37, 99, 235, 0.12)' : 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                                  <QrCode size={20} color={aulaaChannel === 'qris' ? '#2563eb' : '#059669'} />
                                  <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: aulaaChannel === 'qris' ? '#1d4ed8' : '#0f172a' }}>QRIS Instan</div>
                                    <div style={{ fontSize: '0.66rem', color: '#64748b' }}>GoPay, OVO, ShopeePay</div>
                                  </div>
                                </div>
                                {aulaaChannel === 'qris' && <CheckCircle2 size={16} color="#2563eb" style={{ flexShrink: 0 }} />}
                              </button>
                            )}

                            {showVA && (
                              <button
                                type="button"
                                onClick={() => handleSelectAulaaChannel('va')}
                                style={{
                                  minHeight: '48px',
                                  padding: '0.7rem 0.85rem',
                                  borderRadius: '0.6rem',
                                  border: aulaaChannel === 'va' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                  backgroundColor: aulaaChannel === 'va' ? '#eff6ff' : '#ffffff',
                                  boxShadow: aulaaChannel === 'va' ? '0 3px 10px rgba(37, 99, 235, 0.12)' : 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                                  <CreditCard size={20} color={aulaaChannel === 'va' ? '#2563eb' : '#0284c7'} />
                                  <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: aulaaChannel === 'va' ? '#1d4ed8' : '#0f172a' }}>Virtual Account</div>
                                    <div style={{ fontSize: '0.66rem', color: '#64748b' }}>BCA, Mandiri, BRI, BNI</div>
                                  </div>
                                </div>
                                {aulaaChannel === 'va' && <CheckCircle2 size={16} color="#2563eb" style={{ flexShrink: 0 }} />}
                              </button>
                            )}

                            {showEWallet && (
                              <button
                                type="button"
                                onClick={() => handleSelectAulaaChannel('ewallet')}
                                style={{
                                  minHeight: '48px',
                                  padding: '0.7rem 0.85rem',
                                  borderRadius: '0.6rem',
                                  border: aulaaChannel === 'ewallet' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                  backgroundColor: aulaaChannel === 'ewallet' ? '#eff6ff' : '#ffffff',
                                  boxShadow: aulaaChannel === 'ewallet' ? '0 3px 10px rgba(37, 99, 235, 0.12)' : 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                                  <Zap size={20} color={aulaaChannel === 'ewallet' ? '#2563eb' : '#d97706'} />
                                  <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: aulaaChannel === 'ewallet' ? '#1d4ed8' : '#0f172a' }}>Dompet Digital</div>
                                    <div style={{ fontSize: '0.66rem', color: '#64748b' }}>DANA, LinkAja, AstraPay</div>
                                  </div>
                                </div>
                                {aulaaChannel === 'ewallet' && <CheckCircle2 size={16} color="#2563eb" style={{ flexShrink: 0 }} />}
                              </button>
                            )}

                            {showCC && (
                              <button
                                type="button"
                                onClick={() => handleSelectAulaaChannel('cc')}
                                style={{
                                  minHeight: '48px',
                                  padding: '0.7rem 0.85rem',
                                  borderRadius: '0.6rem',
                                  border: aulaaChannel === 'cc' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                  backgroundColor: aulaaChannel === 'cc' ? '#eff6ff' : '#ffffff',
                                  boxShadow: aulaaChannel === 'cc' ? '0 3px 10px rgba(37, 99, 235, 0.12)' : 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                                  <CreditCard size={20} color={aulaaChannel === 'cc' ? '#2563eb' : '#7c3aed'} />
                                  <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: aulaaChannel === 'cc' ? '#1d4ed8' : '#0f172a' }}>Kartu Kredit / Debit</div>
                                    <div style={{ fontSize: '0.66rem', color: '#64748b' }}>Visa &amp; Mastercard</div>
                                  </div>
                                </div>
                                {aulaaChannel === 'cc' && <CheckCircle2 size={16} color="#2563eb" style={{ flexShrink: 0 }} />}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Dynamic Guidance Feedback */}
                        <div style={{
                          padding: '0.75rem 0.95rem',
                          borderRadius: '0.6rem',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.55rem'
                        }}>
                          <Zap size={15} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div style={{ fontSize: '0.76rem', color: '#334155', lineHeight: 1.5 }}>
                            {aulaaChannel === 'qris' ? (
                              <span>
                                Kanal <strong>QRIS Instan</strong> aktif. Klik tombol bayar di bawah untuk langsung membuka kode QRIS resmi dan scan melalui GoPay, OVO, ShopeePay, BCA, atau aplikasi perbankan lainnya.
                              </span>
                            ) : aulaaChannel === 'va' ? (
                              <span>
                                Kanal <strong>Virtual Account</strong> aktif. Invoice akan langsung diarahkan ke nomor VA bank pilihan (BCA, Mandiri, BRI, BNI) dengan verifikasi otomatis 24/7.
                              </span>
                            ) : aulaaChannel === 'ewallet' ? (
                              <span>
                                Kanal <strong>Dompet Digital</strong> aktif. Anda akan langsung diarahkan ke aplikasi e-wallet pilihan untuk otorisasi pembayaran langsung.
                              </span>
                            ) : (
                              <span>
                                Kanal <strong>Kartu Kredit / Debit</strong> aktif. Pembayaran diamankan dengan protokol 3D-Secure Visa &amp; Mastercard.
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <button
                    type="button"
                    disabled={registerLoading}
                    onClick={() => handleSubmitCheckout(false)}
                    style={{
                      width: '100%',
                      minHeight: '48px',
                      padding: '0.85rem',
                      borderRadius: '0.65rem',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      cursor: registerLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
                    }}
                  >
                    {registerLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Menghubungkan ke Gerbang Aulaa...</span>
                      </>
                    ) : (
                      <>
                        <Zap size={18} />
                        <span>
                          {aulaaChannel === 'qris'
                            ? `Bayar Rp ${finalPrice.toLocaleString('id-ID')} via QRIS Instan`
                            : aulaaChannel === 'va'
                            ? `Bayar Rp ${finalPrice.toLocaleString('id-ID')} via Virtual Account`
                            : aulaaChannel === 'ewallet'
                            ? `Bayar Rp ${finalPrice.toLocaleString('id-ID')} via E-Wallet`
                            : aulaaChannel === 'cc'
                            ? `Bayar Rp ${finalPrice.toLocaleString('id-ID')} via Kartu Kredit`
                            : `Lanjutkan ke Pembayaran Aman (Rp ${finalPrice.toLocaleString('id-ID')})`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Scenario 4: Manual QRIS & Bank Transfer (Default Standard Mode) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Method Selector */}
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem', display: 'block' }}>
                      Pilih Metode Pembayaran Manual:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('bank')}
                        style={{
                          minHeight: '46px',
                          padding: '0.65rem',
                          borderRadius: '0.6rem',
                          border: paymentMethod === 'bank' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: paymentMethod === 'bank' ? '#eff6ff' : '#ffffff',
                          color: paymentMethod === 'bank' ? '#1d4ed8' : '#475569',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.45rem',
                          cursor: 'pointer'
                        }}
                      >
                        <CreditCard size={18} />
                        <span>Transfer Bank</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('qris')}
                        style={{
                          minHeight: '46px',
                          padding: '0.65rem',
                          borderRadius: '0.6rem',
                          border: paymentMethod === 'qris' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: paymentMethod === 'qris' ? '#eff6ff' : '#ffffff',
                          color: paymentMethod === 'qris' ? '#1d4ed8' : '#475569',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.45rem',
                          cursor: 'pointer'
                        }}
                      >
                        <QrCode size={18} />
                        <span>Scan QRIS</span>
                      </button>
                    </div>
                  </div>

                  {/* Bank Transfer Details */}
                  {paymentMethod === 'bank' && (
                    <div style={{
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                        <span style={{ color: '#64748b' }}>Bank Tujuan:</span>
                        <strong style={{ color: '#0f172a' }}>
                          {platformSettings.payment_bank_name || 'BCA (Bank Central Asia)'}
                        </strong>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: '#ffffff',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '0.55rem',
                        border: '1px solid #cbd5e1'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Nomor Rekening:</div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                            {platformSettings.payment_bank_account || '8830-1928-3920'}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleCopyAccount}
                          style={{
                            minHeight: '38px',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '0.5rem',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#1d4ed8',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            cursor: 'pointer'
                          }}
                        >
                          {copiedAccountToast ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedAccountToast ? 'Disalin!' : 'Salin'}</span>
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                        <span style={{ color: '#64748b' }}>Atas Nama Rekening:</span>
                        <strong style={{ color: '#0f172a' }}>
                          {platformSettings.payment_bank_holder || 'PT Catavor Media Digital'}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* QRIS Scan Details */}
                  {paymentMethod === 'qris' && (
                    <div style={{
                      padding: '1.15rem',
                      borderRadius: '0.75rem',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.75rem',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
                        {platformSettings.payment_qris_manual_merchant || 'Catavor Official Store'}
                      </div>

                      <div style={{
                        width: '180px',
                        height: '180px',
                        borderRadius: '12px',
                        backgroundColor: '#ffffff',
                        padding: '8px',
                        border: '2px solid #2563eb',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.1)'
                      }}>
                        <img
                          src={platformSettings.payment_qris_manual_image || platformSettings.payment_qris_image || '/img/qris_demo.svg'}
                          alt="QRIS Catavor"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      </div>

                      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                        Scan QRIS dengan GoPay, OVO, ShopeePay, DANA, BCA Mobile, atau aplikasi m-banking lainnya.
                      </p>

                      <button
                        type="button"
                        onClick={handleDownloadQRIS}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          minHeight: '38px',
                          padding: '0.45rem 0.95rem',
                          borderRadius: '0.5rem',
                          backgroundColor: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          color: '#1d4ed8',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <Download size={15} />
                        <span>Download Gambar QRIS</span>
                      </button>
                    </div>
                  )}

                  {/* Unique Code Info (Hanya untuk Transfer Bank Manual) */}
                  {paymentMethod === 'bank' && (
                    <div style={{
                      padding: '0.75rem 0.85rem',
                      borderRadius: '0.6rem',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      fontSize: '0.76rem',
                      color: '#1e40af',
                      lineHeight: 1.45
                    }}>
                      <strong>Kode Unik Otomatis:</strong> Sistem akan mengalokasikan kode unik nominal acak pada nomor tagihan untuk mempermudah verifikasi mutasi transfer bank.
                    </div>
                  )}

                  {/* Form Upload Bukti Transfer (MANDATORY GATE) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                        Unggah Bukti Transfer / Scan * <span style={{ color: '#dc2626' }}>(Wajib)</span>
                      </label>
                      <div
                        style={{
                          border: paymentProofPreview ? '2px solid #2563eb' : '2px dashed #cbd5e1',
                          borderRadius: '0.75rem',
                          padding: '1.15rem',
                          textAlign: 'center',
                          position: 'relative',
                          backgroundColor: paymentProofPreview ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            cursor: 'pointer'
                          }}
                        />
                        {paymentProofPreview ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.85rem' }}>
                            <img
                              src={paymentProofPreview}
                              alt="Bukti Transfer"
                              style={{ width: '54px', height: '54px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #2563eb' }}
                            />
                            <div style={{ textAlign: 'left' }}>
                              <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 800, display: 'block' }}>
                                Foto Bukti Berhasil Dipilih
                              </span>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                Klik untuk mengganti foto bukti pembayaran
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                            <Upload size={24} style={{ color: '#2563eb' }} />
                            <span style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 700 }}>
                              Pilih Berkas Foto Bukti Transfer
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                              Format JPG, PNG, WEBP (Maksimal 5 MB)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                        Nomor WA / Catatan Pengirim (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: WA 08123456789 - a.n Budi"
                        value={paymentProofNote}
                        onChange={(e) => setPaymentProofNote(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '44px',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.55rem',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.82rem',
                          color: '#0f172a',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* Gated Submit Button: Strictly Disabled until proof is uploaded! */}
                    <button
                      type="button"
                      disabled={registerLoading || !paymentProofPreview}
                      onClick={() => handleSubmitCheckout(false)}
                      style={{
                        width: '100%',
                        minHeight: '48px',
                        padding: '0.85rem',
                        borderRadius: '0.65rem',
                        backgroundColor: !paymentProofPreview ? '#94a3b8' : '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 800,
                        fontSize: '0.92rem',
                        cursor: !paymentProofPreview ? 'not-allowed' : (registerLoading ? 'wait' : 'pointer'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        boxShadow: paymentProofPreview ? '0 4px 14px rgba(37, 99, 235, 0.3)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {registerLoading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>Mengirim Konfirmasi...</span>
                        </>
                      ) : !paymentProofPreview ? (
                        <>
                          <Upload size={18} />
                          <span>Unggah Bukti Pembayaran Terlebih Dahulu</span>
                        </>
                      ) : (
                        <>
                          <Send size={18} />
                          <span>Kirim Konfirmasi Pembayaran</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Support & Assistance Card */}
        <div style={{
          marginTop: '1.25rem',
          padding: '1.25rem 1.5rem',
          borderRadius: '1rem',
          backgroundColor: '#ffffff',
          border: '1.5px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: isMiniTablet ? 'column' : 'row',
          alignItems: isMiniTablet ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '0.75rem',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <HelpCircle size={22} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800, color: '#0f172a' }}>
                Butuh Bantuan Teknis atau Kendala Pembayaran?
              </h4>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }}>
                Tim support resmi Catavor siap membantu jika Anda mengalami masalah transfer atau konfirmasi.
              </p>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            flexWrap: 'wrap',
            width: isMiniTablet ? '100%' : 'auto'
          }}>
            {cleanWaNumber && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.6rem 1rem',
                  borderRadius: '0.65rem',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  minHeight: '44px',
                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
                  flex: isMiniTablet ? 1 : 'none',
                  justifyContent: 'center'
                }}
              >
                <MessageCircle size={16} />
                <span>WhatsApp Resmi</span>
              </a>
            )}

            {officialEmail && (
              <a
                href={`mailto:${officialEmail}?subject=${encodeURIComponent('Bantuan Pembayaran Catavor')}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.6rem 1rem',
                  borderRadius: '0.65rem',
                  backgroundColor: '#f8fafc',
                  color: '#334155',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  minHeight: '44px',
                  flex: isMiniTablet ? 1 : 'none',
                  justifyContent: 'center'
                }}
              >
                <Mail size={16} />
                <span>Email Resmi</span>
              </a>
            )}
          </div>
        </div>

        {/* Modal Sukses Konfirmasi Pembayaran */}
        {showSuccessModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#ffffff',
              borderRadius: '1.25rem',
              padding: '2rem 1.75rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
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
                backgroundColor: '#dcfce7',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckCircle size={36} />
              </div>

              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.45rem 0' }}>
                  Konfirmasi Pembayaran Berhasil!
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#64748b', lineHeight: 1.55, margin: 0 }}>
                  Terima kasih telah mendaftar. Tim Admin Catavor akan memverifikasi mutasi transfer Anda. Akses paket <strong>{registerPlan === 'pro_business' ? 'Pro Bisnis' : 'Pro Starter'}</strong> akan aktif maksimal dalam <strong>1x24 Jam</strong>.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    const userSlug = createdUserData?.store_slug || registerForm.store_slug;
                    if (userSlug) {
                      window.location.href = `/${userSlug}/admin`;
                    } else {
                      window.location.href = '/login';
                    }
                  }}
                  style={{
                    width: '100%',
                    minHeight: '46px',
                    padding: '0.75rem',
                    borderRadius: '0.65rem',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  <span>Lanjut ke Dashboard Toko</span>
                  <ArrowRight size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    smartBack('/');
                  }}
                  style={{
                    width: '100%',
                    minHeight: '40px',
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Kembali ke Halaman Utama
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Confirmation Modal Batalkan Pendaftaran */}
        {showCancelModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: '#ffffff',
              borderRadius: '1.25rem',
              padding: '1.75rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertTriangle size={28} />
              </div>

              <div>
                <h3 style={{ fontSize: '1.18rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem 0' }}>
                  Batalkan Checkout Pendaftaran?
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                  Seluruh draf informasi usaha dan pilihan paket yang telah diisi akan dibatalkan serta dihapus dari memori formulir.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    padding: '0.65rem 1rem',
                    borderRadius: '0.65rem',
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Lanjut Checkout
                </button>

                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    padding: '0.65rem 1rem',
                    borderRadius: '0.65rem',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)'
                  }}
                >
                  Ya, Batalkan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TabletCheckoutView;

