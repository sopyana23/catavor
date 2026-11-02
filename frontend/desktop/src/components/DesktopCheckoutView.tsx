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
  ChevronLeft,
  Lock,
  Mail,
  Store,
  Zap,
  AlertTriangle,
  Loader2,
  User,
  Home,
  CheckCircle2,
  ExternalLink,
  X,
  Calendar
} from 'lucide-react';

export interface DesktopCheckoutViewProps {
  initialPlan?: 'pro_starter' | 'pro_business' | 'free';
  initialBilling?: 'monthly' | 'annual';
  onBack?: () => void;
  onCancel?: () => void;
  onSuccess?: (registeredUser: any) => void;
  platformSettings?: Record<string, string>;
}

export const DesktopCheckoutView: React.FC<DesktopCheckoutViewProps> = ({
  initialPlan = 'pro_starter',
  initialBilling = 'monthly',
  onBack,
  onCancel,
  onSuccess,
  platformSettings: propSettings
}) => {
  // 1. Plan State (Locked to Monthly Subscription Cycle)
  const [registerPlan, setRegisterPlan] = useState<'pro_starter' | 'pro_business'>(() => {
    if (typeof window !== 'undefined') {
      const qPlan = new URLSearchParams(window.location.search).get('plan');
      if (qPlan === 'pro_business') return 'pro_business';
      if (qPlan === 'pro_starter') return 'pro_starter';
      const savedPlan = sessionStorage.getItem('catavor_register_plan');
      if (savedPlan === 'pro_business') return 'pro_business';
      if (savedPlan === 'pro_starter') return 'pro_starter';
    }
    return (initialPlan === 'pro_business' ? 'pro_business' : 'pro_starter');
  });

  // Strict Policy: Payments & Leases are ONLY Monthly (1 Month)
  const registerBillingCycle = 'monthly';

  // 2. Registration Form State (Account & Store Info)
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
        let localUser: any = null;
        try {
          const u = localStorage.getItem('catavor_user');
          if (u) localUser = JSON.parse(u);
        } catch {}

        return {
          name: parsed.name || localUser?.name || '',
          email: parsed.email || localUser?.email || '',
          password: parsed.password || '',
          store_name: parsed.store_name || localUser?.store_title || '',
          store_slug: parsed.store_slug || localUser?.store_slug || '',
          google_id: parsed.google_id || localUser?.google_id || '',
          avatar: parsed.avatar || localUser?.avatar || ''
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

  // 3. Payment Method & Settings State
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'qris'>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('catavor_payment_method');
      if (saved === 'qris') return 'qris';
    }
    return 'bank';
  });

  const [platformSettings, setPlatformSettings] = useState<Record<string, string>>(() => {
    return propSettings || {};
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const json = await res.json();
          const s = json.data || json;
          if (s) {
            setPlatformSettings(prev => ({ ...prev, ...s }));
          }
        }
      } catch {
        // Fallback silently if offline
      }
    };
    fetchSettings();
  }, []);

  const isCancelledRef = useRef<boolean>(false);

  // Update sessionStorage on state changes
  useEffect(() => {
    if (isCancelledRef.current) return;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('catavor_register_plan', registerPlan);
      sessionStorage.setItem('catavor_register_billing', registerBillingCycle);
      sessionStorage.setItem('catavor_register_form', JSON.stringify(registerForm));
      sessionStorage.setItem('catavor_payment_method', paymentMethod);
    }
  }, [registerPlan, registerBillingCycle, registerForm, paymentMethod]);

  // 4. Coupon Code State
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

  // 5. Upload Proof of Payment State
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null);
  const [paymentProofNote, setPaymentProofNote] = useState<string>('');
  const [copiedAccountToast, setCopiedAccountToast] = useState<boolean>(false);
  const [registerLoading, setRegisterLoading] = useState<boolean>(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [createdUserData, setCreatedUserData] = useState<any>(null);

  // Strict Monthly Price Calculations (1 Month)
  const originalPrice = registerPlan === 'pro_business' ? 129000 : 30000;
  const normalPrice = registerPlan === 'pro_business' ? 150000 : 65000;

  const discountAmount = appliedCoupon
    ? (appliedCoupon.type === 'free' ? originalPrice : appliedCoupon.discount)
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

  // Proof Image Upload Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setRegisterError('Ukuran berkas bukti transfer maksimal 5 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setPaymentProofPreview(reader.result as string);
        setRegisterError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submission Handler
  const handleSubmitCheckout = async (isFreeBypass: boolean = false) => {
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

      const payload = {
        name: registerForm.name.trim(),
        email: registerForm.email.trim().toLowerCase(),
        password: isGoogleAuth ? undefined : registerForm.password,
        google_id: effectiveGoogleId || undefined,
        store_name: registerForm.store_name.trim(),
        store_slug: registerForm.store_slug.trim().toLowerCase(),
        plan: registerPlan,
        billing_cycle: registerBillingCycle,
        coupon_code: appliedCoupon?.code || '',
        payment_method: paymentMethod,
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
        } catch {}

        if (data.token) {
          localStorage.setItem('catavor_token', data.token);
        }
        if (data.user) {
          localStorage.setItem('catavor_user', JSON.stringify(data.user));
          setCreatedUserData(data.user);
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

  const handleCancelRegistration = () => {
    if (window.confirm('Batalkan checkout pendaftaran dan hapus draf yang telah diisi?')) {
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
      if (onCancel) {
        onCancel();
      } else {
        window.location.href = '/';
      }
    }
  };

  const paymentSystemMode = platformSettings.payment_system_mode || 'manual_qris';
  const isMaintenance = paymentSystemMode === 'maintenance';
  const isAulaa = paymentSystemMode === 'gateway_aulaa';

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-deep, #f8fafc)',
      color: 'var(--text-primary, #0f172a)',
      padding: '2.5rem 2rem 5rem 2rem',
      fontFamily: 'inherit'
    }}>
      <div style={{
        maxWidth: '1180px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        {/* Top Header & Deterministic Back Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border-light, #e2e8f0)'
        }}>
          <button
            type="button"
            onClick={onBack || (() => { window.location.href = '/register/step-3'; })}
            style={{
              minHeight: '42px',
              padding: '0.45rem 1rem',
              borderRadius: '0.65rem',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease'
            }}
          >
            <ArrowLeft size={16} />
            <span>Kembali ke Pilihan Paket</span>
          </button>

          <button
            type="button"
            onClick={handleCancelRegistration}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Batalkan Pendaftaran
          </button>
        </div>

        {/* Page Hero Header */}
        <div style={{ textAlign: 'center', margin: '0.5rem 0 1rem 0' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.9rem',
            borderRadius: '9999px',
            backgroundColor: registerPlan === 'pro_business' ? '#fef3c7' : '#eff6ff',
            color: registerPlan === 'pro_business' ? '#b45309' : '#1d4ed8',
            border: registerPlan === 'pro_business' ? '1px solid #fde68a' : '1px solid #bfdbfe',
            fontSize: '0.75rem',
            fontWeight: 800,
            marginBottom: '0.75rem'
          }}>
            <Sparkles size={14} />
            <span>CHECKOUT AKTIVASI {registerPlan === 'pro_business' ? 'PRO BISNIS' : 'PRO STARTER'}</span>
          </div>
          <h1 style={{
            fontSize: '1.85rem',
            fontWeight: 900,
            color: '#0f172a',
            margin: '0 0 0.45rem 0',
            letterSpacing: '-0.025em'
          }}>
            Selesaikan Konfirmasi &amp; Aktivasi Toko
          </h1>
          <p style={{
            color: '#64748b',
            fontSize: '0.88rem',
            margin: 0,
            maxWidth: '640px',
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: 1.5
          }}>
            Transfer sesuai nominal tertera untuk langsung mempublikasikan katalog produk dan mengaktifkan seluruh fitur premium toko Anda.
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
            fontSize: '0.84rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem'
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>{registerError}</span>
          </div>
        )}

        {/* 2-Column Responsive Desktop Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(380px, 1fr) minmax(480px, 1.35fr)',
          gap: '1.75rem',
          alignItems: 'start'
        }}>
          {/* LEFT COLUMN: Rincian Pesanan, Kupon & Data Akun Toko */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Card 1: Rincian Pesanan (Order Summary) */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '1.15rem',
              border: '1px solid #e2e8f0',
              padding: '1.5rem',
              boxShadow: '0 4px 18px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.1rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '0.85rem'
              }}>
                <span style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>
                  Rincian Pesanan
                </span>
                <span style={{
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  backgroundColor: registerPlan === 'pro_business' ? '#fef3c7' : '#eff6ff',
                  color: registerPlan === 'pro_business' ? '#b45309' : '#1d4ed8',
                  border: registerPlan === 'pro_business' ? '1px solid #fde68a' : '1px solid #bfdbfe'
                }}>
                  {registerPlan === 'pro_business' ? 'PRO BISNIS' : 'PRO STARTER'}
                </span>
              </div>

              {/* Interactive Plan & Billing Cycle Switchers */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                  Pilih Paket:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setRegisterPlan('pro_starter')}
                    style={{
                      minHeight: '44px',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.65rem',
                      border: registerPlan === 'pro_starter' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      backgroundColor: registerPlan === 'pro_starter' ? '#eff6ff' : '#ffffff',
                      color: registerPlan === 'pro_starter' ? '#1d4ed8' : '#334155',
                      fontWeight: registerPlan === 'pro_starter' ? 800 : 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>Pro Starter</span>
                    <span style={{ fontSize: '0.7rem', color: registerPlan === 'pro_starter' ? '#2563eb' : '#64748b' }}>
                      Maks. 150 Produk
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegisterPlan('pro_business')}
                    style={{
                      minHeight: '44px',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.65rem',
                      border: registerPlan === 'pro_business' ? '2px solid #b45309' : '1px solid #cbd5e1',
                      backgroundColor: registerPlan === 'pro_business' ? '#fef3c7' : '#ffffff',
                      color: registerPlan === 'pro_business' ? '#92400e' : '#334155',
                      fontWeight: registerPlan === 'pro_business' ? 800 : 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>Pro Bisnis</span>
                    <span style={{ fontSize: '0.7rem', color: registerPlan === 'pro_business' ? '#b45309' : '#64748b' }}>
                      Unlimited &amp; Domain
                    </span>
                  </button>
                </div>
              </div>

              {/* Billing Cycle Indicator (Monthly Only) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
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

              {/* Breakdown Pricing */}
              <div style={{
                padding: '1rem',
                borderRadius: '0.75rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.55rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b' }}>
                  <span>Periode Sewa:</span>
                  <strong style={{ color: '#0f172a' }}>1 Bulan (30 Hari)</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b' }}>
                  <span>Harga Normal:</span>
                  <span style={{ textDecoration: 'line-through' }}>
                    Rp {normalPrice.toLocaleString('id-ID')}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#16a34a' }}>
                  <span>Diskon Paket:</span>
                  <strong>- Rp {(normalPrice - originalPrice).toLocaleString('id-ID')}</strong>
                </div>

                {appliedCoupon && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.82rem',
                    color: '#16a34a',
                    backgroundColor: '#f0fdf4',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '0.45rem',
                    border: '1px solid #bbf7d0'
                  }}>
                    <div>
                      <span style={{ fontWeight: 800 }}>Kupon ({appliedCoupon.code}):</span>
                      <div style={{ fontSize: '0.72rem', color: '#15803d' }}>{appliedCoupon.label}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong>- Rp {discountAmount.toLocaleString('id-ID')}</strong>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          fontSize: '0.74rem',
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
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #e2e8f0',
                  fontSize: '0.94rem',
                  fontWeight: 900,
                  color: '#0f172a'
                }}>
                  <span>Total Tagihan:</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: '1.35rem',
                      color: finalPrice === 0 ? '#16a34a' : '#2563eb'
                    }}>
                      Rp {finalPrice.toLocaleString('id-ID')}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginLeft: '0.25rem' }}>
                      / bulan
                    </span>
                    {finalPrice === 0 && (
                      <span style={{
                        fontSize: '0.76rem',
                        color: '#16a34a',
                        marginLeft: '0.4rem',
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
                gap: '0.45rem'
              }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                  Punya Kode Kupon / Diskon?
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                      minHeight: '42px',
                      padding: '0.55rem 0.85rem',
                      fontSize: '0.85rem',
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
                      minHeight: '42px',
                      padding: '0.55rem 1.15rem',
                      borderRadius: '0.55rem',
                      backgroundColor: couponValidating ? '#94a3b8' : '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: couponValidating ? '#ffffff' : '#1d4ed8',
                      fontSize: '0.84rem',
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
                    fontSize: '0.76rem',
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
              borderRadius: '1.15rem',
              border: '1px solid #e2e8f0',
              padding: '1.5rem',
              boxShadow: '0 4px 18px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.95rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '0.75rem'
              }}>
                <span style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>
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
                      fontSize: '0.78rem',
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
                  padding: '0.85rem',
                  borderRadius: '0.75rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.82rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem'
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
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
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
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
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
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
                        fontSize: '0.82rem',
                        fontWeight: 600
                      }}>
                        <Check size={16} style={{ flexShrink: 0, color: '#2563eb' }} />
                        <span>Terotentikasi via Akun Google. Kata sandi tidak diperlukan.</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
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
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
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
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
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
                          backgroundColor: 'transparent'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Sistem Pembayaran Dinamis & Upload Bukti Transfer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '1.15rem',
              border: '1px solid #e2e8f0',
              padding: '1.75rem',
              boxShadow: '0 4px 18px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.35rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '0.85rem'
              }}>
                <span style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>
                  Metode &amp; Konfirmasi Pembayaran
                </span>
                <span style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  backgroundColor: finalPrice === 0 ? '#dcfce7' : isMaintenance ? '#fee2e2' : '#f1f5f9',
                  color: finalPrice === 0 ? '#15803d' : isMaintenance ? '#dc2626' : '#475569'
                }}>
                  {finalPrice === 0 ? 'Gratis Kupon' : isMaintenance ? 'Pemeliharaan' : isAulaa ? 'Gateway Aulaa' : 'Transfer Manual / QRIS'}
                </span>
              </div>

              {/* Dynamic Payment Scenarios */}
              {finalPrice === 0 ? (
                /* Scenario 1: 100% Free Coupon */
                <div style={{
                  padding: '1.75rem 1rem',
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
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: '#dcfce7',
                    color: '#16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Sparkles size={30} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#15803d', margin: '0 0 0.35rem 0' }}>
                      Tagihan Rp 0 (Diskon 100%)
                    </h3>
                    <p style={{ fontSize: '0.84rem', color: '#166534', margin: 0, lineHeight: 1.5, maxWidth: '420px' }}>
                      Kupon diskon Anda berhasil menggratiskan seluruh biaya paket ini. Klik tombol di bawah untuk langsung mengaktifkan toko Anda tanpa transfer.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={registerLoading}
                    onClick={() => handleSubmitCheckout(true)}
                    style={{
                      minHeight: '46px',
                      padding: '0.75rem 2rem',
                      borderRadius: '0.65rem',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      cursor: registerLoading ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
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
                /* Scenario 2: Maintenance Mode */
                <div style={{
                  padding: '1.75rem 1.25rem',
                  borderRadius: '0.85rem',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.95rem'
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <ShieldAlert size={30} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#991b1b', margin: '0 0 0.45rem 0' }}>
                      {platformSettings.payment_maintenance_title || 'Sistem Pembayaran Sedang Dalam Pemeliharaan'}
                    </h4>
                    <p style={{ fontSize: '0.84rem', color: '#b91c1c', margin: 0, lineHeight: 1.5, maxWidth: '440px' }}>
                      {platformSettings.payment_maintenance_message || 'Mohon maaf, saat ini sistem pembayaran pendaftaran dan langganan sedang dinonaktifkan sementara untuk peningkatan kualitas layanan. Silakan hubungi admin atau coba beberapa saat lagi.'}
                    </p>
                  </div>
                </div>
              ) : isAulaa ? (
                /* Scenario 3: Aulaa Payment Gateway Mode */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                  <div style={{
                    padding: '1rem 1.25rem',
                    borderRadius: '0.75rem',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#166534' }}>
                        Gerbang Pembayaran Instan
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.6rem',
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
                    <p style={{ fontSize: '0.8rem', color: '#14532d', margin: 0, lineHeight: 1.45 }}>
                      Pembayaran diproses otomatis melalui Aulaa Gateway. Akun toko langsung aktif seketika setelah pembayaran terkonfirmasi.
                    </p>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.6rem', display: 'block' }}>
                      Kanal Pembayaran yang Didukung:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div style={{ padding: '0.75rem 1rem', borderRadius: '0.65rem', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <QrCode size={20} color="#059669" />
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>QRIS Instan</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>GoPay, OVO, ShopeePay, DANA</div>
                        </div>
                      </div>

                      <div style={{ padding: '0.75rem 1rem', borderRadius: '0.65rem', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <CreditCard size={20} color="#0284c7" />
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>Virtual Account</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>BCA, Mandiri, BRI, BNI</div>
                        </div>
                      </div>
                    </div>
                  </div>

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
                    {registerLoading ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                    <span>{registerLoading ? 'Memproses Pendaftaran...' : 'Lanjutkan ke Pembayaran Aman'}</span>
                  </button>
                </div>
              ) : (
                /* Scenario 4: Manual QRIS & Bank Transfer (Default Standard Mode) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                  {/* Method Selector */}
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.55rem', display: 'block' }}>
                      Pilih Metode Pembayaran Manual:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('bank')}
                        style={{
                          minHeight: '48px',
                          padding: '0.65rem',
                          borderRadius: '0.65rem',
                          border: paymentMethod === 'bank' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: paymentMethod === 'bank' ? '#eff6ff' : '#ffffff',
                          color: paymentMethod === 'bank' ? '#1d4ed8' : '#475569',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <CreditCard size={18} />
                        <span>Transfer Bank</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('qris')}
                        style={{
                          minHeight: '48px',
                          padding: '0.65rem',
                          borderRadius: '0.65rem',
                          border: paymentMethod === 'qris' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: paymentMethod === 'qris' ? '#eff6ff' : '#ffffff',
                          color: paymentMethod === 'qris' ? '#1d4ed8' : '#475569',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
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
                      padding: '1.15rem',
                      borderRadius: '0.75rem',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
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
                        padding: '0.75rem 1rem',
                        borderRadius: '0.65rem',
                        border: '1px solid #cbd5e1'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Nomor Rekening:</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', letterSpacing: '0.02em' }}>
                            {platformSettings.payment_bank_account || '8830-1928-3920'}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleCopyAccount}
                          style={{
                            minHeight: '38px',
                            padding: '0.45rem 0.95rem',
                            borderRadius: '0.5rem',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#1d4ed8',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            cursor: 'pointer'
                          }}
                        >
                          {copiedAccountToast ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedAccountToast ? 'Disalin!' : 'Salin'}</span>
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
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
                      padding: '1.25rem',
                      borderRadius: '0.75rem',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.85rem',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                        {platformSettings.payment_qris_manual_merchant || 'Catavor Official Store'}
                      </div>

                      <div style={{
                        width: '200px',
                        height: '200px',
                        borderRadius: '12px',
                        backgroundColor: '#ffffff',
                        padding: '10px',
                        border: '2px solid #2563eb',
                        boxShadow: '0 4px 14px rgba(37, 99, 235, 0.12)'
                      }}>
                        <img
                          src={platformSettings.payment_qris_manual_image || platformSettings.payment_qris_image || '/img/qris_demo.svg'}
                          alt="QRIS Catavor"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      </div>

                      <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0, maxWidth: '380px', lineHeight: 1.4 }}>
                        Scan QRIS dengan GoPay, OVO, ShopeePay, DANA, BCA Mobile, Mandiri Livin, atau aplikasi m-banking lainnya.
                      </p>

                      <a
                        href={platformSettings.payment_qris_manual_image || platformSettings.payment_qris_image || '/img/qris_demo.svg'}
                        download="QRIS_Catavor_Payment.svg"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          minHeight: '38px',
                          padding: '0.45rem 1rem',
                          borderRadius: '0.5rem',
                          backgroundColor: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          color: '#1d4ed8',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          textDecoration: 'none'
                        }}
                      >
                        <Download size={15} />
                        <span>Download Gambar QRIS</span>
                      </a>
                    </div>
                  )}

                  {/* Unique Code Info */}
                  <div style={{
                    padding: '0.75rem 0.95rem',
                    borderRadius: '0.65rem',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    fontSize: '0.78rem',
                    color: '#1e40af',
                    lineHeight: 1.45
                  }}>
                    <strong>Kode Unik Otomatis:</strong> Sistem akan mengalokasikan kode unik pada nomor tagihan untuk mempermudah verifikasi mutasi cepat oleh tim operasional.
                  </div>

                  {/* Form Upload Bukti Transfer (MANDATORY GATE) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                        Unggah Bukti Transfer / Scan * <span style={{ color: '#dc2626' }}>(Wajib)</span>
                      </label>
                      <div
                        style={{
                          border: paymentProofPreview ? '2px solid #2563eb' : '2px dashed #cbd5e1',
                          borderRadius: '0.75rem',
                          padding: '1.35rem',
                          textAlign: 'center',
                          position: 'relative',
                          backgroundColor: paymentProofPreview ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
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
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                            <img
                              src={paymentProofPreview}
                              alt="Bukti Transfer"
                              style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px', border: '1.5px solid #2563eb' }}
                            />
                            <div style={{ textAlign: 'left' }}>
                              <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 800, display: 'block' }}>
                                Foto Bukti Berhasil Dipilih
                              </span>
                              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                Klik untuk mengganti foto bukti pembayaran
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                            <Upload size={26} style={{ color: '#2563eb' }} />
                            <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 700 }}>
                              Pilih Berkas Foto Bukti Transfer
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                              Format JPG, PNG, WEBP (Maksimal 5 MB)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
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
                          fontSize: '0.85rem',
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
                        fontSize: '0.94rem',
                        cursor: !paymentProofPreview ? 'not-allowed' : (registerLoading ? 'wait' : 'pointer'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        boxShadow: !paymentProofPreview ? 'none' : '0 4px 14px rgba(37, 99, 235, 0.3)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {registerLoading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>Mengirim Konfirmasi Pembayaran...</span>
                        </>
                      ) : (
                        <>
                          <Send size={18} />
                          <span>
                            {!paymentProofPreview
                              ? 'Unggah Bukti Transfer untuk Melanjutkan'
                              : 'Kirim Konfirmasi Pembayaran'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '1.25rem',
            padding: '2.5rem 2rem',
            maxWidth: '520px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.15rem'
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
              <h3 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.45rem 0' }}>
                Pendaftaran Berhasil!
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                Selamat! Akun toko Anda telah terdaftar. Bukti transfer pembayaran Anda sedang dalam antrean verifikasi otomatis oleh tim kami.
              </p>
            </div>

            {createdUserData && (
              <div style={{
                width: '100%',
                padding: '1rem',
                borderRadius: '0.75rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                fontSize: '0.82rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Nama Pemilik:</span>
                  <strong style={{ color: '#0f172a' }}>{createdUserData.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Alamat Email:</span>
                  <strong style={{ color: '#0f172a' }}>{createdUserData.email}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Domain Toko:</span>
                  <span style={{ color: '#2563eb', fontWeight: 700 }}>catavor.com/{createdUserData.store_slug}</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setShowSuccessModal(false);
                if (createdUserData?.store_slug) {
                  window.location.href = `/${createdUserData.store_slug}/admin/items`;
                } else {
                  window.location.href = '/';
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
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
              }}
            >
              <span>Buka Dashboard Toko Sekarang</span>
              <ExternalLink size={16} />
            </button>

            <button
              type="button"
              onClick={() => {
                setShowSuccessModal(false);
                window.location.href = '/';
              }}
              style={{
                width: '100%',
                minHeight: '40px',
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              Kembali ke Halaman Utama
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
