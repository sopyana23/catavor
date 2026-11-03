import React, { useState, useEffect } from 'react';
import {
  Store,
  User,
  Mail,
  Lock,
  Tag,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Check,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Crown,
  Sparkles,
  Calendar,
  Home
} from 'lucide-react';

export interface TabletRegisterViewProps {
  initialStep?: 1 | 2 | 3;
  initialPlan?: 'free' | 'pro_starter' | 'pro_business';
  onNavigateStep: (step: 1 | 2 | 3) => void;
  onProceedToCheckout: (plan: 'pro_starter' | 'pro_business') => void;
  onCancel: () => void;
  onLoginClick: () => void;
  onSuccess: (userData: any) => void;
  onGoogleSSO?: () => void;
  onOpenPolicy?: (type: 'terms' | 'privacy') => void;
}

export const TabletRegisterView: React.FC<TabletRegisterViewProps> = ({
  initialStep = 1,
  initialPlan = 'free',
  onNavigateStep,
  onProceedToCheckout,
  onCancel,
  onLoginClick,
  onSuccess,
  onGoogleSSO,
  onOpenPolicy
}) => {
  const [registerStep, setRegisterStep] = useState<1 | 2 | 3>(initialStep);
  const [registerPlan, setRegisterPlan] = useState<'free' | 'pro_starter' | 'pro_business'>(() => {
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
    return initialPlan;
  });

  const [registerForm, setRegisterForm] = useState<{
    name: string;
    email: string;
    password: string;
    store_name: string;
    store_slug: string;
    google_id?: string;
  }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('catavor_register_form');
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            name: parsed.name || '',
            email: parsed.email || '',
            password: parsed.password || '',
            store_name: parsed.store_name || '',
            store_slug: parsed.store_slug || '',
            google_id: parsed.google_id || ''
          };
        }
      } catch {}
    }
    return { name: '', email: '', password: '', store_name: '', store_slug: '', google_id: '' };
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerLoading, setRegisterLoading] = useState<boolean>(false);
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);
  const [agreeTermsError, setAgreeTermsError] = useState<boolean>(false);

  // Sync step prop changes & re-sync draft when step changes
  useEffect(() => {
    if (initialStep !== registerStep) {
      setRegisterStep(initialStep);
    }
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('catavor_register_form');
        if (saved) {
          const parsed = JSON.parse(saved);
          setRegisterForm(prev => ({
            ...prev,
            name: parsed.name !== undefined ? parsed.name : prev.name,
            email: parsed.email !== undefined ? parsed.email : prev.email,
            password: parsed.password !== undefined ? parsed.password : prev.password,
            store_name: parsed.store_name !== undefined ? parsed.store_name : prev.store_name,
            store_slug: parsed.store_slug !== undefined ? parsed.store_slug : prev.store_slug,
            google_id: parsed.google_id !== undefined ? parsed.google_id : prev.google_id
          }));
        }
      } catch {}
    }
  }, [initialStep]);

  // Listen for Google SSO updates & external register errors
  useEffect(() => {
    const handleFormUpdate = (e: any) => {
      if (e.detail) {
        setRegisterForm(prev => ({ ...prev, ...e.detail }));
      }
    };
    const handleRegisterError = (e: any) => {
      if (e.detail?.message) {
        if (e.detail.email) {
          setRegisterForm(prev => ({
            ...prev,
            email: e.detail.email,
            name: e.detail.name || prev.name
          }));
        }
        setFieldErrors(prev => ({ ...prev, email: e.detail.message }));
        setRegisterError(null);
        setTimeout(() => {
          const el = document.getElementById('tablet-register-email-input');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.focus();
          }
        }, 50);
      }
    };
    window.addEventListener('catavor:register-form-updated', handleFormUpdate);
    window.addEventListener('catavor:register-error', handleRegisterError);
    return () => {
      window.removeEventListener('catavor:register-form-updated', handleFormUpdate);
      window.removeEventListener('catavor:register-error', handleRegisterError);
    };
  }, []);

  // Save drafts to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('catavor_register_form', JSON.stringify(registerForm));
        sessionStorage.setItem('catavor_register_plan', registerPlan);
        sessionStorage.setItem('catavor_register_billing', 'monthly');
        sessionStorage.setItem('catavor_register_step', String(registerStep));
      } catch {}
    }
  }, [registerForm, registerPlan, registerStep]);

  // Slug auto-generator helper
  const handleStoreNameChange = (name: string) => {
    const slugified = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    setRegisterForm(prev => {
      const prevAutoSlug = prev.store_name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const shouldUpdateSlug = prev.store_slug === '' || prev.store_slug === prevAutoSlug;
      return {
        ...prev,
        store_name: name,
        store_slug: shouldUpdateSlug ? slugified : prev.store_slug
      };
    });
    if (fieldErrors.store_name) setFieldErrors(prev => ({ ...prev, store_name: '' }));
  };

  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!registerForm.name.trim()) errors.name = 'Nama lengkap wajib diisi.';
    if (!registerForm.email.trim() || !registerForm.email.includes('@')) errors.email = 'Alamat email valid wajib diisi.';
    if (!registerForm.google_id && (!registerForm.password || registerForm.password.length < 6)) {
      errors.password = 'Kata sandi minimal 6 karakter.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1()) {
      setRegisterError(null);
      return;
    }
    setRegisterLoading(true);
    setRegisterError(null);
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registerForm.email.trim().toLowerCase() })
      });
      const data = await res.json();
      if (!data.available) {
        const errorMsg = data.message || 'Alamat email ini sudah terdaftar dalam sistem. Silakan gunakan alamat email lain atau masuk ke akun yang sudah terdaftar.';
        setFieldErrors(prev => ({ ...prev, email: errorMsg }));
        setRegisterError(null);
        setTimeout(() => {
          const el = document.getElementById('tablet-register-email-input');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.focus();
          }
        }, 50);
        return;
      }
      setRegisterError(null);
      setFieldErrors({});
      try {
        sessionStorage.setItem('catavor_register_form', JSON.stringify(registerForm));
      } catch {}
      onNavigateStep(2);
    } catch {
      setRegisterError('Gagal memverifikasi ketersediaan alamat email. Periksa koneksi internet Anda.');
    } finally {
      setRegisterLoading(false);
    }
  };

  const validateStep2 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!registerForm.store_name.trim()) errors.store_name = 'Nama toko / usaha wajib diisi.';
    if (!registerForm.store_slug.trim()) errors.store_slug = 'Username link toko wajib diisi.';
    else if (registerForm.store_slug.length < 3) errors.store_slug = 'Username minimal 3 karakter.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Free Plan Registration directly
  const handleFreeSubmit = async () => {
    if (!agreeTerms) {
      setAgreeTermsError(true);
      return;
    }

    setRegisterLoading(true);
    setRegisterError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerForm.name.trim(),
          email: registerForm.email.trim().toLowerCase(),
          password: registerForm.password,
          google_id: registerForm.google_id || undefined,
          store_name: registerForm.store_name.trim(),
          store_title: registerForm.store_name.trim(),
          store_slug: registerForm.store_slug.trim().toLowerCase(),
          plan: 'free',
          billing_cycle: 'monthly',
          duration_months: 1,
          payment_status: 'none'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Clear drafts upon successful registration
        try {
          sessionStorage.removeItem('catavor_register_form');
          sessionStorage.removeItem('catavor_register_plan');
          sessionStorage.removeItem('catavor_register_billing');
          sessionStorage.removeItem('catavor_applied_coupon');
          sessionStorage.removeItem('catavor_payment_method');
        } catch {}

        if (data.token) {
          localStorage.setItem('catavor_token', data.token);
          if (data.user) {
            localStorage.setItem('catavor_user', JSON.stringify(data.user));
          }
        }
        onSuccess(data.user || { store_slug: registerForm.store_slug });
      } else {
        setRegisterError(data.message || 'Pendaftaran gagal diproses. Silakan periksa kembali data Anda.');
      }
    } catch {
      setRegisterError('Terjadi kesalahan koneksi saat mengirim formulir pendaftaran.');
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-deep, #f8fafc)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2.5rem 1.5rem',
      color: 'var(--text-primary, #0f172a)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '560px',
        backgroundColor: '#ffffff',
        borderRadius: '1.25rem',
        border: '1px solid #e2e8f0',
        padding: '2.5rem 2rem',
        boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.1), 0 0 1px rgba(15, 23, 42, 0.08)'
      }}>
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            border: '1px solid #dbeafe',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.85rem',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.12)'
          }}>
            <Store size={26} />
          </div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            margin: '0 0 0.35rem 0',
            letterSpacing: '-0.02em',
            color: '#0f172a'
          }}>
            Buat Katalog Bisnis
          </h1>
          <p style={{
            fontSize: '0.85rem',
            color: '#64748b',
            margin: 0,
            lineHeight: 1.5
          }}>
            Katalog online &amp; biolink profesional terhubung langsung ke WhatsApp
          </p>
        </div>

        {/* 3-Step Progress Indicator */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem',
            padding: '0 0.25rem'
          }}>
            <span style={{
              fontSize: '0.78rem',
              fontWeight: registerStep >= 1 ? 800 : 600,
              color: registerStep >= 1 ? '#2563eb' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}>
              <span style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                backgroundColor: registerStep >= 1 ? '#2563eb' : '#f1f5f9',
                color: registerStep >= 1 ? '#ffffff' : '#64748b',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.72rem',
                fontWeight: 800
              }}>1</span>
              Akun Pengelola
            </span>

            <span style={{
              fontSize: '0.78rem',
              fontWeight: registerStep >= 2 ? 800 : 600,
              color: registerStep >= 2 ? '#2563eb' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}>
              <span style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                backgroundColor: registerStep >= 2 ? '#2563eb' : '#f1f5f9',
                color: registerStep >= 2 ? '#ffffff' : '#64748b',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.72rem',
                fontWeight: 800
              }}>2</span>
              Profil Toko
            </span>

            <span style={{
              fontSize: '0.78rem',
              fontWeight: registerStep === 3 ? 800 : 600,
              color: registerStep === 3 ? '#2563eb' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}>
              <span style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                backgroundColor: registerStep === 3 ? '#2563eb' : '#f1f5f9',
                color: registerStep === 3 ? '#ffffff' : '#64748b',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.72rem',
                fontWeight: 800
              }}>3</span>
              Pilih Paket
            </span>
          </div>

          <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{
              width: registerStep === 1 ? '33.3%' : registerStep === 2 ? '66.6%' : '100%',
              height: '100%',
              backgroundColor: '#2563eb',
              borderRadius: '999px',
              transition: 'all 0.3s ease-in-out'
            }} />
          </div>
        </div>

        {/* Global Error Banner */}
        {registerError && !fieldErrors.email && (
          <div style={{
            marginBottom: '1.25rem',
            padding: '0.85rem 1rem',
            borderRadius: '0.75rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem'
          }}>
            <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
            <span style={{ lineHeight: 1.45 }}>{registerError}</span>
          </div>
        )}

        {/* STEP 1: Akun Pengelola */}
        {registerStep === 1 && (
          <div>
            {/* Google SSO Button */}
            {onGoogleSSO && (
              <>
                <button
                  type="button"
                  onClick={onGoogleSSO}
                  style={{
                    width: '100%',
                    minHeight: '46px',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.75rem',
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    color: '#1e293b',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.65rem',
                    marginBottom: '1.25rem',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Daftar Cepat dengan Google</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.25rem', gap: '0.75rem' }}>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800, letterSpacing: '0.04em' }}>ATAU DAFTAR MANUAL</span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                </div>
              </>
            )}

            <form
              onSubmit={handleStep1Submit}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}
            >
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem', display: 'block' }}>
                  Nama Lengkap Pemilik *
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  backgroundColor: '#ffffff',
                  border: fieldErrors.name ? '1.5px solid #dc2626' : '1.5px solid #cbd5e1'
                }}>
                  <User size={18} color="#64748b" />
                  <input
                    type="text"
                    placeholder="Contoh: Dzikri Muhammad"
                    value={registerForm.name}
                    onChange={(e) => {
                      setRegisterForm({ ...registerForm, name: e.target.value });
                      if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: '' }));
                    }}
                    style={{ flex: 1, background: 'transparent', border: 'none', color: '#0f172a', fontSize: '0.92rem', outline: 'none' }}
                  />
                </div>
                {fieldErrors.name && (
                  <span style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '0.25rem', display: 'block', fontWeight: 600 }}>
                    {fieldErrors.name}
                  </span>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem', display: 'block' }}>
                  Alamat Email *
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  backgroundColor: '#ffffff',
                  border: fieldErrors.email ? '1.5px solid #dc2626' : '1.5px solid #cbd5e1',
                  boxShadow: fieldErrors.email ? '0 0 0 3px rgba(220, 38, 38, 0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}>
                  <Mail size={18} color="#64748b" />
                  <input
                    id="tablet-register-email-input"
                    type="email"
                    placeholder="nama@domain.com"
                    value={registerForm.email}
                    onChange={(e) => {
                      setRegisterForm({ ...registerForm, email: e.target.value });
                      if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
                    }}
                    style={{ flex: 1, background: 'transparent', border: 'none', color: '#0f172a', fontSize: '0.92rem', outline: 'none' }}
                  />
                </div>
                {fieldErrors.email && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.45rem',
                    marginTop: '0.45rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.65rem',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fee2e2',
                    color: '#b91c1c',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    lineHeight: 1.45,
                    animation: 'fadeIn 0.2s ease-in-out'
                  }}>
                    <AlertCircle size={15} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
                    <span>{fieldErrors.email}</span>
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem', display: 'block' }}>
                  Kata Sandi Akun *
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  backgroundColor: '#ffffff',
                  border: fieldErrors.password ? '1.5px solid #dc2626' : '1.5px solid #cbd5e1'
                }}>
                  <Lock size={18} color="#64748b" />
                  <input
                    type="password"
                    placeholder="Minimal 6 karakter"
                    value={registerForm.password}
                    onChange={(e) => {
                      setRegisterForm({ ...registerForm, password: e.target.value });
                      if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                    }}
                    style={{ flex: 1, background: 'transparent', border: 'none', color: '#0f172a', fontSize: '0.92rem', outline: 'none' }}
                  />
                </div>
                {fieldErrors.password && (
                  <span style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '0.25rem', display: 'block', fontWeight: 600 }}>
                    {fieldErrors.password}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={registerLoading}
                style={{
                  width: '100%',
                  minHeight: '48px',
                  marginTop: '0.5rem',
                  padding: '0.85rem',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  borderRadius: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  backgroundColor: registerLoading ? '#94a3b8' : '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  cursor: registerLoading ? 'wait' : 'pointer',
                  boxShadow: registerLoading ? 'none' : '0 4px 14px rgba(37, 99, 235, 0.35)',
                  transition: 'all 0.18s ease'
                }}
              >
                {registerLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Memverifikasi Akun...</span>
                  </>
                ) : (
                  <>
                    <span>Lanjut ke Informasi Usaha</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onCancel}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  padding: '0.75rem',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  borderRadius: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                <Home size={16} />
                <span>Kembali ke Halaman Utama</span>
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: Informasi Toko & Slug */}
        {registerStep === 2 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!validateStep2()) {
                setRegisterError('Mohon lengkapi nama dan link username toko Anda.');
                return;
              }
              setRegisterError(null);
              setFieldErrors({});
              onNavigateStep(3);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}
          >
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem', display: 'block' }}>
                Nama Toko / Usaha / Brand *
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                backgroundColor: '#ffffff',
                border: fieldErrors.store_name ? '1.5px solid #dc2626' : '1.5px solid #cbd5e1'
              }}>
                <Store size={18} color="#64748b" />
                <input
                  type="text"
                  placeholder="Contoh: Kopi Nusantara Jaya"
                  value={registerForm.store_name}
                  onChange={(e) => handleStoreNameChange(e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#0f172a', fontSize: '0.92rem', outline: 'none' }}
                />
              </div>
              {fieldErrors.store_name && (
                <span style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '0.25rem', display: 'block', fontWeight: 600 }}>
                  {fieldErrors.store_name}
                </span>
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem', display: 'block' }}>
                Username Link Domain Toko (Slug) *
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                backgroundColor: '#ffffff',
                border: fieldErrors.store_slug ? '1.5px solid #dc2626' : '1.5px solid #cbd5e1'
              }}>
                <span style={{ color: '#64748b', fontSize: '0.86rem', fontWeight: 700 }}>catavor.com/</span>
                <input
                  type="text"
                  placeholder="kopi-nusantara"
                  value={registerForm.store_slug}
                  onChange={(e) => {
                    const clean = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                    setRegisterForm({ ...registerForm, store_slug: clean });
                    if (fieldErrors.store_slug) setFieldErrors(prev => ({ ...prev, store_slug: '' }));
                  }}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#0f172a', fontSize: '0.92rem', fontWeight: 700, outline: 'none' }}
                />
              </div>
              {fieldErrors.store_slug && (
                <span style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '0.25rem', display: 'block', fontWeight: 600 }}>
                  {fieldErrors.store_slug}
                </span>
              )}
              <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.35rem', display: 'block', lineHeight: 1.4 }}>
                Link website resmi toko Anda yang dapat dibagikan langsung ke WhatsApp &amp; Instagram.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => onNavigateStep(1)}
                style={{
                  minHeight: '48px',
                  padding: '0.8rem 1.25rem',
                  fontSize: '0.85rem',
                  borderRadius: '0.75rem',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                <ChevronLeft size={16} />
                <span>Kembali</span>
              </button>

              <button
                type="submit"
                style={{
                  flex: 1,
                  minHeight: '48px',
                  padding: '0.85rem',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  borderRadius: '0.75rem',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
                }}
              >
                <span>Lanjut Pilih Paket</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Pilih Paket */}
        {registerStep === 3 && (
          <div>
            {/* Locked Billing Cycle Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '0.75rem',
              color: '#1d4ed8',
              fontSize: '0.82rem',
              fontWeight: 800,
              marginBottom: '1.25rem'
            }}>
              <Calendar size={15} style={{ color: '#2563eb' }} />
              <span>Periode Sewa / Langganan: Bulanan (1 Bulan)</span>
              <span style={{
                fontSize: '0.68rem',
                padding: '0.12rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontWeight: 800,
                marginLeft: '0.25rem'
              }}>
                30 Hari
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
              {/* Option 1: Gratis Terbatas */}
              <div
                onClick={() => setRegisterPlan('free')}
                style={{
                  padding: '1rem 1.15rem',
                  borderRadius: '0.85rem',
                  border: registerPlan === 'free' ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
                  backgroundColor: registerPlan === 'free' ? '#f0fdf4' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: registerPlan === 'free' ? '5px solid #2563eb' : '2px solid #94a3b8',
                      backgroundColor: '#ffffff'
                    }} />
                    <span style={{ fontSize: '0.92rem', fontWeight: 800, color: registerPlan === 'free' ? '#2563eb' : '#0f172a' }}>
                      Gratis Terbatas
                    </span>
                  </div>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#16a34a' }}>
                    Rp 0
                  </span>
                </div>
                <div style={{ paddingLeft: '1.65rem', fontSize: '0.76rem', color: '#475569', display: 'flex', gap: '1rem' }}>
                  <span>15 Item Katalog</span>
                  <span>100 MB Media</span>
                  <span>Iklan Sponsor</span>
                </div>
              </div>

              {/* Option 2: Pro Starter */}
              <div
                onClick={() => setRegisterPlan('pro_starter')}
                style={{
                  padding: '1rem 1.15rem',
                  borderRadius: '0.85rem',
                  border: registerPlan === 'pro_starter' ? '2px solid #0284c7' : '1.5px solid #e2e8f0',
                  backgroundColor: registerPlan === 'pro_starter' ? '#f0f9ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
              >
                <div style={{ position: 'absolute', top: '-10px', right: '14px' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    padding: '0.15rem 0.55rem',
                    borderRadius: '999px'
                  }}>
                    <Sparkles size={10} /> PRO STARTER
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: registerPlan === 'pro_starter' ? '5px solid #0284c7' : '2px solid #94a3b8',
                      backgroundColor: '#ffffff'
                    }} />
                    <span style={{ fontSize: '0.92rem', fontWeight: 800, color: registerPlan === 'pro_starter' ? '#0284c7' : '#0f172a' }}>
                      Pro Starter
                    </span>
                  </div>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0284c7' }}>
                    Rp 30.000 <small style={{ fontSize: '0.7rem', color: '#64748b' }}>/bulan</small>
                  </span>
                </div>
                <div style={{ paddingLeft: '1.65rem', fontSize: '0.76rem', color: '#475569', display: 'flex', gap: '0.85rem' }}>
                  <span>150 Item Katalog</span>
                  <span>2 GB Media</span>
                  <span>100% Bebas Iklan</span>
                </div>
              </div>

              {/* Option 3: Pro Bisnis */}
              <div
                onClick={() => setRegisterPlan('pro_business')}
                style={{
                  padding: '1rem 1.15rem',
                  borderRadius: '0.85rem',
                  border: registerPlan === 'pro_business' ? '2px solid #d97706' : '1.5px solid #e2e8f0',
                  backgroundColor: registerPlan === 'pro_business' ? '#fffbeb' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
              >
                <div style={{ position: 'absolute', top: '-10px', right: '14px' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    backgroundColor: '#d97706',
                    color: '#ffffff',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    padding: '0.15rem 0.55rem',
                    borderRadius: '999px'
                  }}>
                    <Crown size={10} /> PRO BISNIS
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: registerPlan === 'pro_business' ? '5px solid #d97706' : '2px solid #94a3b8',
                      backgroundColor: '#ffffff'
                    }} />
                    <span style={{ fontSize: '0.92rem', fontWeight: 800, color: registerPlan === 'pro_business' ? '#d97706' : '#0f172a' }}>
                      Pro Bisnis
                    </span>
                  </div>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#d97706' }}>
                    Rp 129.000 <small style={{ fontSize: '0.7rem', color: '#64748b' }}>/bulan</small>
                  </span>
                </div>
                <div style={{ paddingLeft: '1.65rem', fontSize: '0.76rem', color: '#475569', display: 'flex', gap: '0.85rem' }}>
                  <span>Unlimited Item</span>
                  <span>10 GB Media</span>
                  <span>Custom Domain</span>
                </div>
              </div>
            </div>

            {/* Terms Agreement Checkbox */}
            <div style={{ margin: '0.5rem 0 1.25rem 0', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                fontSize: '0.8rem',
                color: agreeTermsError && !agreeTerms ? '#991b1b' : '#334155',
                lineHeight: 1.5,
                backgroundColor: agreeTermsError && !agreeTerms ? '#fef2f2' : '#f8fafc',
                padding: '0.85rem 1rem',
                borderRadius: '0.85rem',
                border: agreeTermsError && !agreeTerms ? '1.5px solid #ef4444' : '1px solid #e2e8f0',
                boxShadow: agreeTermsError && !agreeTerms ? '0 0 0 3px rgba(239, 68, 68, 0.12)' : 'none',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}>
                <input
                  type="checkbox"
                  id="tablet-register-agree"
                  checked={agreeTerms}
                  onChange={(e) => {
                    setAgreeTerms(e.target.checked);
                    if (e.target.checked) setAgreeTermsError(false);
                  }}
                  style={{ marginTop: '0.15rem', accentColor: '#2563eb', cursor: 'pointer', flexShrink: 0, width: '18px', height: '18px' }}
                />
                <label htmlFor="tablet-register-agree" style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Saya menyetujui <span style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'underline' }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenPolicy ? onOpenPolicy('terms') : (window.location.href = '/terms'); }}>Syarat &amp; Ketentuan</span> serta <span style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'underline' }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenPolicy ? onOpenPolicy('privacy') : (window.location.href = '/privacy'); }}>Kebijakan Privasi</span> platform Catavor.
                </label>
              </div>

              {agreeTermsError && !agreeTerms && (
                <div style={{
                  fontSize: '0.76rem',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: 700,
                  padding: '0.35rem 0.65rem',
                  borderRadius: '0.5rem',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fee2e2',
                  animation: 'fadeIn 0.2s ease-in-out'
                }}>
                  <AlertCircle size={15} style={{ color: '#dc2626', flexShrink: 0 }} />
                  <span>Harap centang persetujuan Syarat &amp; Ketentuan di atas untuk melanjutkan ke pembayaran.</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => onNavigateStep(2)}
                style={{
                  minHeight: '48px',
                  padding: '0.8rem 1.15rem',
                  fontSize: '0.85rem',
                  borderRadius: '0.75rem',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                <ChevronLeft size={16} />
                <span>Edit Info Toko</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!agreeTerms) {
                    setAgreeTermsError(true);
                    return;
                  }
                  setAgreeTermsError(false);
                  if (registerPlan === 'free') {
                    handleFreeSubmit();
                  } else {
                    onProceedToCheckout(registerPlan);
                  }
                }}
                disabled={registerLoading}
                style={{
                  flex: 1,
                  minHeight: '48px',
                  padding: '0.85rem',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  cursor: registerLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
                }}
              >
                <span>
                  {registerLoading
                    ? 'Mendaftarkan Toko...'
                    : (registerPlan === 'free' ? 'Selesaikan & Buka Toko' : 'Lanjut ke Pembayaran')}
                </span>
                <CheckCircle size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Footer Login Link */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.82rem', color: '#64748b' }}>
          Sudah punya akun?{' '}
          <span
            style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 800 }}
            onClick={onLoginClick}
          >
            Login Admin
          </span>
        </div>
      </div>
    </div>
  );
};

