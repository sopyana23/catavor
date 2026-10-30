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
  Archive
} from 'lucide-react';
import { createAuthFetch } from '../utils/auth';
import { useModalBackHandler } from '../utils/navigation';

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
  const [loading, setLoading] = useState<boolean>(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>('pro_starter');
  
  // Checkout & Payment step
  const [checkoutStep, setCheckoutStep] = useState<'plan_select' | 'payment_detail'>('plan_select');
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'bca' | 'mandiri'>('qris');
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [orderInvoice, setOrderInvoice] = useState<any | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);

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

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
      setCheckoutStep('plan_select');
      setOrderInvoice(null);
    }
  }, [isOpen, fetchPlans]);

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

  const handleProceedToPayment = () => {
    if (selectedPlan?.code === 'free') {
      showToast('Anda sudah berada pada paket Gratis atau pilih paket Pro', 'error');
      return;
    }
    setCheckoutStep('payment_detail');
  };

  const handleCreateOrder = async () => {
    if (!token || !selectedPlan) return;
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
          payment_method: paymentMethod,
          billing_cycle: billingCycle
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setOrderInvoice(json.data || json.order);
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
    showToast('Nomor rekening/virtual account disalin ke clipboard');
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
                  padding: '0.3rem',
                  backgroundColor: 'var(--bg-deep)',
                  borderRadius: '999px',
                  border: '1px solid var(--border-light)'
                }}>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    style={{
                      minHeight: '40px',
                      padding: '0.45rem 1.25rem',
                      borderRadius: '999px',
                      border: 'none',
                      backgroundColor: billingCycle === 'monthly' ? 'var(--primary)' : 'transparent',
                      color: billingCycle === 'monthly' ? '#ffffff' : 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Bulanan
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('annual')}
                    style={{
                      minHeight: '40px',
                      padding: '0.45rem 1.25rem',
                      borderRadius: '999px',
                      border: 'none',
                      backgroundColor: billingCycle === 'annual' ? 'var(--primary)' : 'transparent',
                      color: billingCycle === 'annual' ? '#ffffff' : 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Tahunan
                    <span style={{
                      fontSize: '0.7rem',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '999px',
                      fontWeight: 800
                    }}>
                      HEMAT 20%
                    </span>
                  </button>
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
              {orderInvoice ? (
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
                    Pesanan Langganan #{orderInvoice.invoice_number || orderInvoice.id} Dibuat
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                    Silakan selesaikan pembayaran sebesar <strong>Rp {(orderInvoice.total_amount || totalPrice).toLocaleString('id-ID')}</strong> untuk paket {selectedPlan?.name}.
                  </p>

                  {/* QRIS / Bank Transfer Details */}
                  <div style={{
                    maxWidth: '420px',
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
                      <strong style={{ textTransform: 'uppercase' }}>{paymentMethod}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Nomor Rekening / VA</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong>{paymentMethod === 'bca' ? '8271-9928-1002' : '137-00-9928-1002'}</strong>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(paymentMethod === 'bca' ? '827199281002' : '1370099281002')}
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
                      <strong>PT Catavor Digital Niaga</strong>
                    </div>
                  </div>

                  <div style={{ marginTop: '1.75rem' }}>
                    <button
                      type="button"
                      onClick={onClose}
                      style={{
                        minHeight: '44px',
                        padding: '0.65rem 2rem',
                        borderRadius: '0.65rem',
                        backgroundColor: 'var(--primary)',
                        color: '#ffffff',
                        border: 'none',
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
                          <strong>{selectedPlan?.max_items} Produk</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Kapasitas Cloud</span>
                          <strong>{Math.round((selectedPlan?.storage_limit_bytes || 0) / (1024 * 1024))} MB</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{
                      paddingTop: '1rem',
                      borderTop: '1px solid var(--border-light)',
                      marginTop: '1.5rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Pembayaran</span>
                        <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
                          Rp {totalPrice.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Payment Channels */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                      Pilih Metode Pembayaran
                    </h3>

                    {[
                      { id: 'qris', name: 'QRIS Instan (Gopay, OVO, Dana, ShopeePay)', icon: QrCode },
                      { id: 'bca', name: 'BCA Virtual Account / Transfer', icon: CreditCard },
                      { id: 'mandiri', name: 'Mandiri Virtual Account / Transfer', icon: CreditCard }
                    ].map(pm => {
                      const isSelected = paymentMethod === pm.id;
                      const Icon = pm.icon;
                      return (
                        <div
                          key={pm.id}
                          onClick={() => setPaymentMethod(pm.id as any)}
                          style={{
                            padding: '1rem',
                            borderRadius: '0.75rem',
                            backgroundColor: isSelected ? 'rgba(30, 58, 138, 0.08)' : 'var(--bg-deep)',
                            border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Icon size={20} color={isSelected ? 'var(--primary)' : 'var(--text-muted)'} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{pm.name}</span>
                          </div>
                          {isSelected && <Check size={18} color="var(--primary)" />}
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      disabled={submittingOrder}
                      onClick={handleCreateOrder}
                      style={{
                        marginTop: '1rem',
                        minHeight: '48px',
                        padding: '0.75rem',
                        borderRadius: '0.65rem',
                        backgroundColor: 'var(--primary)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.92rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        cursor: submittingOrder ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <Receipt size={18} />
                      {submittingOrder ? 'Memproses Pesanan...' : 'Bayar Sekarang & Aktifkan Paket'}
                    </button>
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
