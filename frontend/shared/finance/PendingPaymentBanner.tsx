import React from 'react';
import { ArrowRight, Clock, CreditCard, FileCheck2 } from 'lucide-react';

export interface PendingOrderSummary {
  id: number;
  order_number: string;
  plan_code: string;
  plan_name?: string;
  final_amount: number;
  unique_code?: number;
  payment_method?: string;
  payment_mode?: string;
  payment_status: string;
  created_at?: string;
  expires_at?: string;
}

export interface PendingPaymentBannerProps {
  pendingOrder?: PendingOrderSummary | null;
  currentPlanCode?: string;
  device: 'desktop' | 'tablet' | 'mobile';
  onOpenSubscription: () => void;
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
  return 'Paket Berbayar';
}

export const PendingPaymentBanner: React.FC<PendingPaymentBannerProps> = ({
  pendingOrder,
  currentPlanCode = 'free',
  device,
  onOpenSubscription,
}) => {
  if (!pendingOrder) return null;

  const status = String(pendingOrder.payment_status || '').toLowerCase().trim();
  if (status !== 'pending' && status !== 'pending_verification') {
    return null;
  }

  const isVerifying = status === 'pending_verification';
  const targetPlanLabel = resolvePlanLabel(pendingOrder.plan_code, pendingOrder.plan_name);
  const isCurrentlyFree = String(currentPlanCode || 'free').toLowerCase().trim() === 'free';
  const isCompact = device === 'mobile';
  const touchMinH = device === 'desktop' ? '38px' : '44px';

  const accentColor = isVerifying ? '#d97706' : '#2563eb';
  const accentBg = isVerifying ? 'rgba(245, 158, 11, 0.14)' : 'rgba(37, 99, 235, 0.12)';
  const accentBorder = isVerifying ? 'rgba(245, 158, 11, 0.35)' : 'rgba(37, 99, 235, 0.32)';

  const title = isVerifying
    ? `Pembayaran Paket ${targetPlanLabel} Sedang Diverifikasi`
    : `Menunggu Pembayaran Paket ${targetPlanLabel}`;

  const description = isVerifying
    ? isCurrentlyFree
      ? `Invoice ${pendingOrder.order_number} (${formatRupiah(pendingOrder.final_amount)}) telah kami terima dan sedang ditinjau Tim Finance (est. 1x24 jam). Selama verifikasi berjalan, katalog aktif sementara pada paket Gratis Terbatas dan otomatis beralih setelah disetujui.`
      : `Bukti pembayaran invoice ${pendingOrder.order_number} (${formatRupiah(pendingOrder.final_amount)}) sedang ditinjau Tim Finance (est. 1x24 jam). Paket saat ini tetap aktif normal selama proses konfirmasi.`
    : isCurrentlyFree
      ? `Invoice ${pendingOrder.order_number} sebesar ${formatRupiah(pendingOrder.final_amount)} masih menunggu penyelesaian pembayaran. Selesaikan transaksi agar paket ${targetPlanLabel} segera aktif di katalog Anda.`
      : `Invoice perpanjangan/upgrade ${pendingOrder.order_number} sebesar ${formatRupiah(pendingOrder.final_amount)} masih menunggu penyelesaian pembayaran.`;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: isCompact ? '0.9rem 1rem' : '1rem 1.25rem',
        borderRadius: isCompact ? '0.85rem' : '1rem',
        background: 'var(--card-bg-gradient, var(--bg-card, #ffffff))',
        border: `1px solid ${accentBorder}`,
        borderLeft: `4px solid ${accentColor}`,
        display: 'flex',
        flexDirection: isCompact ? 'column' : 'row',
        alignItems: isCompact ? 'stretch' : 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: isCompact ? '0.75rem' : '1rem',
        marginBottom: isCompact ? '0.25rem' : '1rem',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', flex: '1 1 280px', minWidth: 0 }}>
        <div
          style={{
            width: isCompact ? '38px' : '42px',
            height: isCompact ? '38px' : '42px',
            borderRadius: '10px',
            backgroundColor: accentBg,
            border: `1px solid ${accentBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accentColor,
            flexShrink: 0,
            marginTop: '0.1rem',
          }}
        >
          {isVerifying ? <FileCheck2 size={20} /> : <Clock size={20} />}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            <strong style={{ color: 'var(--text-primary, #0f172a)', fontSize: isCompact ? '0.86rem' : '0.94rem', fontWeight: 800, lineHeight: 1.3 }}>
              {title}
            </strong>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                backgroundColor: accentBg,
                color: accentColor,
                border: `1px solid ${accentBorder}`,
                whiteSpace: 'nowrap',
              }}
            >
              {isVerifying ? 'Dalam Verifikasi' : 'Belum Dibayar'}
            </span>
          </div>

          <p style={{ margin: 0, color: 'var(--text-secondary, #475569)', fontSize: isCompact ? '0.76rem' : '0.8rem', lineHeight: 1.48 }}>
            {description}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenSubscription}
        className="btn-secondary"
        style={{
          minHeight: touchMinH,
          width: isCompact ? '100%' : 'auto',
          padding: isCompact ? '0.6rem 1rem' : '0.55rem 1.05rem',
          borderRadius: '0.65rem',
          fontSize: isCompact ? '0.8rem' : '0.82rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.45rem',
          flexShrink: 0,
          borderColor: accentBorder,
          color: 'var(--text-primary, #0f172a)',
        }}
      >
        <CreditCard size={15} />
        <span>{isVerifying ? 'Lihat Status Tagihan' : 'Selesaikan Pembayaran'}</span>
        <ArrowRight size={14} />
      </button>
    </div>
  );
};
