import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck2,
  LifeBuoy,
  Loader2,
  Lock,
  XCircle,
} from 'lucide-react';
import type { PendingOrderSummary } from './PendingPaymentBanner';

export interface SubscriptionPendingStatusCardProps {
  pendingOrder?: PendingOrderSummary | null;
  currentPlanCode?: string;
  currentPlanName?: string;
  device: 'desktop' | 'tablet' | 'mobile';
  compact?: boolean;
  onViewOrderDetail: () => void;
  onContactSupport?: () => void;
  onCancelPendingOrder?: (orderId: number) => Promise<void>;
  cancelling?: boolean;
}

function formatRupiah(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  return `Rp ${rounded.toLocaleString('id-ID')}`;
}

function resolvePlanLabel(planCode?: string, planName?: string): string {
  if (planName && planName.trim()) return planName.trim();
  const clean = String(planCode || '').toLowerCase().trim();
  if (clean === 'pro_business') return 'Pro Bisnis';
  if (clean === 'pro_starter' || clean === 'pro') return 'Pro Starter';
  if (clean === 'free') return 'Gratis Terbatas';
  return 'Paket Berbayar';
}

export const SubscriptionPendingStatusCard: React.FC<SubscriptionPendingStatusCardProps> = ({
  pendingOrder,
  currentPlanCode = 'free',
  currentPlanName,
  device,
  compact = false,
  onViewOrderDetail,
  onContactSupport,
  onCancelPendingOrder,
  cancelling = false,
}) => {
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  if (!pendingOrder) return null;

  const status = String(pendingOrder.payment_status || '').toLowerCase().trim();
  if (status !== 'pending' && status !== 'pending_verification') {
    return null;
  }

  const isVerifying = status === 'pending_verification';
  const targetPlanLabel = resolvePlanLabel(pendingOrder.plan_code, pendingOrder.plan_name);
  const currentCodeClean = String(currentPlanCode || 'free').toLowerCase().trim();
  const isCurrentlyFree = currentCodeClean === 'free';
  const currentPlanLabel = isCurrentlyFree
    ? 'Gratis Terbatas (Sementara)'
    : currentPlanName?.trim() || resolvePlanLabel(currentCodeClean);

  const isStacked = device === 'mobile' || Boolean(compact);
  const touchMinH = device === 'desktop' ? '40px' : '44px';

  const accentColor = isVerifying ? '#d97706' : '#2563eb';
  const accentBg = isVerifying ? 'rgba(245, 158, 11, 0.14)' : 'rgba(37, 99, 235, 0.12)';
  const accentBorder = isVerifying ? 'rgba(245, 158, 11, 0.35)' : 'rgba(37, 99, 235, 0.32)';

  const title = isVerifying
    ? `Pembayaran Paket ${targetPlanLabel} Sedang Diverifikasi`
    : `Tagihan Paket ${targetPlanLabel} Menunggu Pembayaran`;

  const description = isVerifying
    ? `Bukti transfer Anda sedang ditinjau Tim Finance (estimasi maks. 1x24 jam). Pemilihan atau perubahan paket lain dikunci sementara guna mencegah duplikasi tagihan${isCurrentlyFree ? ', sementara katalog tetap dapat dioperasikan pada paket Gratis Terbatas' : ''}.`
    : `Anda masih memiliki tagihan aktif yang belum diselesaikan. Selesaikan pembayaran di bawah ini atau batalkan tagihan terlebih dahulu jika ingin memilih paket lain.`;

  const step2Label = isVerifying ? 'Verifikasi Finance' : 'Menunggu Bayar';

  const outerMargin =
    device === 'desktop'
      ? '1.25rem 2rem 0'
      : device === 'tablet'
        ? '0 0 1.25rem 0'
        : '0';

  const handleConfirmCancelClick = async () => {
    if (!onCancelPendingOrder || !pendingOrder.id || cancelling) return;
    await onCancelPendingOrder(pendingOrder.id);
    setConfirmingCancel(false);
  };

  return (
    <section
      role="status"
      aria-live="polite"
      data-testid="subscription-pending-status-card"
      style={{
        margin: outerMargin,
        padding: isStacked ? '1rem' : '1.25rem 1.35rem',
        borderRadius: isStacked ? '0.95rem' : '1rem',
        background: 'var(--card-bg-gradient, var(--bg-card, #ffffff))',
        border: `1.5px solid ${accentBorder}`,
        borderLeft: `4px solid ${accentColor}`,
        display: 'flex',
        flexDirection: 'column',
        gap: isStacked ? '0.85rem' : '1rem',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      {/* 1. Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
          flex: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: isStacked ? '36px' : '42px',
              height: isStacked ? '36px' : '42px',
              borderRadius: '10px',
              backgroundColor: accentBg,
              border: `1px solid ${accentBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: accentColor,
              flexShrink: 0,
            }}
          >
            {isVerifying ? <FileCheck2 size={isStacked ? 18 : 20} /> : <Clock size={isStacked ? 18 : 20} />}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <strong
                style={{
                  color: 'var(--text-primary, #0f172a)',
                  fontSize: isStacked ? '0.92rem' : '1.02rem',
                  fontWeight: 800,
                  lineHeight: 1.3,
                }}
              >
                {title}
              </strong>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '0.18rem 0.55rem',
                  borderRadius: '999px',
                  backgroundColor: accentBg,
                  color: accentColor,
                  border: `1px solid ${accentBorder}`,
                  whiteSpace: 'nowrap',
                }}
              >
                <Lock size={11} />
                <span>{isVerifying ? 'Dalam Verifikasi' : 'Belum Dibayar'}</span>
              </span>
            </div>
            <p
              style={{
                margin: '0.35rem 0 0',
                color: 'var(--text-secondary, #475569)',
                fontSize: isStacked ? '0.77rem' : '0.82rem',
                lineHeight: 1.5,
              }}
            >
              {description}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Compact 3-Step Verification Progress Stepper */}
      <div
        aria-label="Tahapan verifikasi paket"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isStacked ? '0.35rem' : '0.65rem',
          padding: isStacked ? '0.65rem 0.7rem' : '0.75rem 1rem',
          borderRadius: '0.75rem',
          backgroundColor: 'var(--bg-deep, rgba(15, 23, 42, 0.04))',
          border: '1px solid var(--border-light, #e2e8f0)',
          flex: 'none',
          minWidth: 0,
        }}
      >
        {/* Step 1: Done */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
          <CheckCircle2 size={15} style={{ color: '#10b981', flexShrink: 0 }} />
          <span style={{ fontSize: isStacked ? '0.7rem' : '0.76rem', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>
            {isStacked ? '1. Dibuat' : '1. Pesanan Dibuat'}
          </span>
        </div>

        <div style={{ flex: 1, height: '2px', backgroundColor: accentColor, opacity: 0.45, minWidth: '10px' }} />

        {/* Step 2: Current */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
          <span
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '999px',
              backgroundColor: accentColor,
              color: '#ffffff',
              fontSize: '0.64rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            2
          </span>
          <span style={{ fontSize: isStacked ? '0.7rem' : '0.76rem', fontWeight: 800, color: accentColor, whiteSpace: 'nowrap' }}>
            {step2Label}
          </span>
        </div>

        <div style={{ flex: 1, height: '2px', backgroundColor: 'var(--border-light, #cbd5e1)', minWidth: '10px' }} />

        {/* Step 3: Upcoming */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
          <span
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '999px',
              border: '1.5px solid var(--text-muted, #94a3b8)',
              color: 'var(--text-muted, #64748b)',
              fontSize: '0.64rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            3
          </span>
          <span style={{ fontSize: isStacked ? '0.7rem' : '0.76rem', fontWeight: 600, color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap' }}>
            {isStacked ? '3. Aktif' : '3. Paket Aktif'}
          </span>
        </div>
      </div>

      {/* 3. Invoice Metadata Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isStacked ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
          gap: '0.65rem',
          padding: isStacked ? '0.7rem 0.75rem' : '0.75rem 1rem',
          borderRadius: '0.75rem',
          backgroundColor: 'var(--bg-deep, rgba(15, 23, 42, 0.03))',
          border: '1px solid var(--border-light, #e2e8f0)',
          flex: 'none',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)', fontWeight: 600, marginBottom: '0.15rem' }}>
            Nomor Invoice
          </div>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', overflowWrap: 'anywhere' }}>
            {pendingOrder.order_number}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)', fontWeight: 600, marginBottom: '0.15rem' }}>
            Paket Tujuan
          </div>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: accentColor }}>
            {targetPlanLabel}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)', fontWeight: 600, marginBottom: '0.15rem' }}>
            Total Tagihan
          </div>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
            {formatRupiah(pendingOrder.final_amount)}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)', fontWeight: 600, marginBottom: '0.15rem' }}>
            Status Katalog Saat Ini
          </div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
            {currentPlanLabel}
          </div>
        </div>
      </div>

      {/* 4. Action Buttons */}
      <div
        style={{
          display: 'flex',
          flexDirection: isStacked ? 'column' : 'row',
          alignItems: isStacked ? 'stretch' : 'center',
          gap: '0.6rem',
          flexWrap: isStacked ? 'nowrap' : 'wrap',
          flex: 'none',
        }}
      >
        <button
          type="button"
          onClick={onViewOrderDetail}
          className="btn-primary"
          style={{
            flex: 'none',
            minHeight: touchMinH,
            width: isStacked ? '100%' : 'auto',
            padding: '0.55rem 1.05rem',
            borderRadius: '0.65rem',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            boxSizing: 'border-box',
          }}
        >
          <CreditCard size={15} />
          <span>{isVerifying ? 'Lihat Detail & Bukti Tagihan' : 'Lanjutkan Pembayaran'}</span>
        </button>

        {isVerifying && onContactSupport && (
          <button
            type="button"
            onClick={onContactSupport}
            className="btn-secondary"
            style={{
              flex: 'none',
              minHeight: touchMinH,
              width: isStacked ? '100%' : 'auto',
              padding: '0.55rem 1rem',
              borderRadius: '0.65rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              boxSizing: 'border-box',
            }}
          >
            <LifeBuoy size={15} />
            <span>Hubungi Admin / Ajukan Perubahan</span>
          </button>
        )}

        {!isVerifying && onCancelPendingOrder && !confirmingCancel && (
          <button
            type="button"
            disabled={cancelling}
            onClick={() => setConfirmingCancel(true)}
            className="btn-secondary"
            style={{
              flex: 'none',
              minHeight: touchMinH,
              width: isStacked ? '100%' : 'auto',
              padding: '0.55rem 1rem',
              borderRadius: '0.65rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: cancelling ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              borderColor: 'rgba(239, 68, 68, 0.35)',
              color: '#dc2626',
              boxSizing: 'border-box',
            }}
          >
            <XCircle size={15} />
            <span>Batalkan Tagihan &amp; Ganti Paket</span>
          </button>
        )}
      </div>

      {/* Inline Cancel Confirmation Strip (anti-nested-modal, anti-window.confirm) */}
      {!isVerifying && confirmingCancel && onCancelPendingOrder && (
        <div
          style={{
            flex: 'none',
            padding: '0.75rem 0.9rem',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            flexDirection: isStacked ? 'column' : 'row',
            alignItems: isStacked ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: '0.65rem',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--text-primary, #0f172a)', lineHeight: 1.45 }}>
            Batalkan tagihan <strong>{pendingOrder.order_number}</strong>? Anda dapat langsung memilih paket lain setelah dibatalkan.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <button
              type="button"
              disabled={cancelling}
              onClick={handleConfirmCancelClick}
              style={{
                minHeight: device === 'desktop' ? '36px' : '44px',
                padding: '0.45rem 0.85rem',
                borderRadius: '0.55rem',
                border: 'none',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: cancelling ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                flex: isStacked ? 1 : 'none',
              }}
            >
              {cancelling ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
              <span>{cancelling ? 'Membatalkan...' : 'Ya, Batalkan'}</span>
            </button>
            <button
              type="button"
              disabled={cancelling}
              onClick={() => setConfirmingCancel(false)}
              className="btn-secondary"
              style={{
                minHeight: device === 'desktop' ? '36px' : '44px',
                padding: '0.45rem 0.85rem',
                borderRadius: '0.55rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                flex: isStacked ? 1 : 'none',
              }}
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
