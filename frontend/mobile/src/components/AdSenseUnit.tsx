import React, { useEffect, useRef } from 'react';
import { Sparkles, Megaphone, ArrowUpRight, ShieldCheck, Zap } from 'lucide-react';

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

export interface AdSenseUnitProps {
  storePlan?: string;
  slotType: 'header' | 'infeed' | 'product_detail' | 'bottom' | 'dashboard' | 'custom';
  slotId?: string;
  settings?: Record<string, any>;
  onUpgradeClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const AdSenseUnit: React.FC<AdSenseUnitProps> = ({
  storePlan = 'free',
  slotType,
  slotId,
  settings = {},
  onUpgradeClick,
  className = '',
  style = {},
}) => {
  const adRef = useRef<HTMLDivElement>(null);
  const isPushed = useRef(false);

  // 1. ISOLASI MUTLAK: Jika toko adalah Pro / Berbayar, jangan pernah render apapun (0% Iklan)
  const isPaidPlan =
    storePlan === 'pro_starter' ||
    storePlan === 'pro_business' ||
    storePlan === 'pro' ||
    storePlan === 'enterprise';

  if (isPaidPlan) {
    return null;
  }

  // 2. MASTER TOGGLE: Cek apakah fitur iklan diaktifkan secara global di platform
  const isAdsGloballyEnabled =
    settings.ads_enabled === '1' || settings.ads_enabled === 'true';

  if (!isAdsGloballyEnabled) {
    return null;
  }

  const clientId = settings.ads_client_id || '';
  const isTestMode =
    settings.ads_test_mode === '1' ||
    settings.ads_test_mode === 'true' ||
    !clientId;

  // Tentukan Slot ID berdasarkan tipe penempatan
  let activeSlot = slotId || '';
  if (!activeSlot) {
    if (slotType === 'header') activeSlot = settings.ads_slot_header || '';
    else if (slotType === 'infeed') activeSlot = settings.ads_slot_infeed || '';
    else if (slotType === 'product_detail') activeSlot = settings.ads_slot_product_detail || '';
    else if (slotType === 'bottom') activeSlot = settings.ads_slot_bottom || '';
    else if (slotType === 'dashboard') activeSlot = settings.ads_slot_dashboard || '';
  }

  // 3. Efek untuk memuat AdSense script & push iklan nyata saat di mode produksi
  useEffect(() => {
    if (isTestMode || !clientId || isPushed.current) return;

    // Load Google AdSense library if not yet in DOM
    const scriptId = 'google-adsense-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }

    try {
      if (typeof window !== 'undefined') {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        isPushed.current = true;
      }
    } catch (e) {
      console.warn('Catavor AdSense trigger handled:', e);
    }
  }, [isTestMode, clientId, activeSlot]);

  // 4. TEST MODE / PREVIEW PLACEHOLDER UNTUK DEV & SANDBOX
  if (isTestMode) {
    if (slotType === 'header') {
      return (
        <div
          className={`adsense-header-card ${className}`}
          style={{
            margin: '0.75rem 0',
            padding: '0.85rem 1rem',
            borderRadius: '1rem',
            border: '1px dashed rgba(245, 158, 11, 0.35)',
            backgroundColor: 'rgba(245, 158, 11, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            boxSizing: 'border-box',
            ...style,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Megaphone size={16} />
            </div>
            <div>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#f59e0b' }}>
                Ruang Sponsor Header (Versi Gratis)
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                Google AdSense Banner Placement Slot
              </div>
            </div>
          </div>

          {onUpgradeClick && (
            <button
              type="button"
              onClick={onUpgradeClick}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: '0.55rem',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: '#818cf8',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <Sparkles size={11} />
              <span>Hilangkan Iklan</span>
            </button>
          )}
        </div>
      );
    }

    if (slotType === 'infeed') {
      return (
        <div
          className={`adsense-infeed-card ${className}`}
          style={{
            margin: '1rem 0',
            padding: '1.25rem 1rem',
            borderRadius: '1rem',
            border: '1px dashed rgba(245, 158, 11, 0.35)',
            backgroundColor: 'rgba(245, 158, 11, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '0.5rem',
            boxSizing: 'border-box',
            ...style,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              fontSize: '0.65rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <Megaphone size={11} />
            <span>Iklan Sponsor (Versi Gratis)</span>
          </div>

          <p
            style={{
              fontSize: '0.78rem',
              color: '#94a3b8',
              margin: '0.25rem 0',
              lineHeight: 1.4,
            }}
          >
            Ruang iklan Google AdSense In-Feed Mitra Resmi Catavor.
          </p>

          {onUpgradeClick && (
            <button
              type="button"
              onClick={onUpgradeClick}
              style={{
                background: 'none',
                border: 'none',
                color: '#38bdf8',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '0.4rem',
              }}
            >
              <Sparkles size={12} />
              <span>Upgrade ke Paket Pro untuk Hapus Iklan</span>
              <ArrowUpRight size={12} />
            </button>
          )}
        </div>
      );
    }

    if (slotType === 'product_detail') {
      return (
        <div
          className={`adsense-detail-card ${className}`}
          style={{
            margin: '1.25rem 0',
            padding: '1rem',
            borderRadius: '1rem',
            border: '1px dashed rgba(245, 158, 11, 0.35)',
            backgroundColor: 'rgba(245, 158, 11, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '0.45rem',
            boxSizing: 'border-box',
            ...style,
          }}
        >
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Iklan Sponsor Produk
          </span>
          <p style={{ margin: 0, fontSize: '0.74rem', color: '#94a3b8' }}>
            Google AdSense Responsive Unit di Halaman Detail Produk
          </p>
          {onUpgradeClick && (
            <button
              onClick={onUpgradeClick}
              style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.2rem' }}
            >
              Bebas Iklan Selamanya dengan Paket Pro &rarr;
            </button>
          )}
        </div>
      );
    }

    // Default Bottom Banner Placeholder
    return (
      <div
        className={`adsense-bottom-card ${className}`}
        style={{
          margin: '1.5rem 0 1rem 0',
          padding: '0.85rem 1rem',
          borderRadius: '0.85rem',
          border: '1px dashed rgba(245, 158, 11, 0.35)',
          backgroundColor: 'rgba(245, 158, 11, 0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          boxSizing: 'border-box',
          ...style,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Megaphone size={14} color="#f59e0b" />
          <span style={{ fontSize: '0.74rem', color: '#cbd5e1', fontWeight: 600 }}>
            Iklan Sponsor Catavor &bull; Versi Gratis
          </span>
        </div>

        {onUpgradeClick && (
          <button
            type="button"
            onClick={onUpgradeClick}
            style={{
              background: 'none',
              border: 'none',
              color: '#38bdf8',
              fontSize: '0.7rem',
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Bebas Iklan &rarr;
          </button>
        )}
      </div>
    );
  }

  // 5. PRODUCTION MODE: RENDER AKTUAL GOOGLE ADSENSE
  return (
    <div
      ref={adRef}
      className={`adsense-wrapper ${className}`}
      style={{
        width: '100%',
        margin: '1rem 0',
        textAlign: 'center',
        overflow: 'hidden',
        minHeight: slotType === 'header' ? '60px' : slotType === 'infeed' ? '120px' : '90px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <ins
        className="adsbygoogle"
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'center',
        }}
        data-ad-client={clientId}
        data-ad-slot={activeSlot || undefined}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
};
