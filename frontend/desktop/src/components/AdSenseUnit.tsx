import React, { useEffect, useRef } from 'react';
import { Sparkles, Megaphone, ArrowUpRight } from 'lucide-react';

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

  // 4. TEST MODE / PREVIEW PLACEHOLDER
  if (isTestMode) {
    return (
      <div
        className={`adsense-preview-card ${className}`}
        style={{
          margin: '1rem 0',
          padding: '1rem 1.25rem',
          borderRadius: '1rem',
          border: '1px dashed rgba(245, 158, 11, 0.35)',
          backgroundColor: 'rgba(245, 158, 11, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          boxSizing: 'border-box',
          ...style,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '0.6rem',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Megaphone size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f59e0b' }}>
              Iklan Sponsor Google AdSense ({slotType.toUpperCase()})
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Tampil khusus pada katalog toko versi Gratis
            </div>
          </div>
        </div>

        {onUpgradeClick && (
          <button
            type="button"
            onClick={onUpgradeClick}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '0.65rem',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#818cf8',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              whiteSpace: 'nowrap'
            }}
          >
            <Sparkles size={13} />
            <span>Bebas Iklan dengan Pro</span>
            <ArrowUpRight size={13} />
          </button>
        )}
      </div>
    );
  }

  // 5. PRODUCTION MODE
  return (
    <div
      ref={adRef}
      className={`adsense-wrapper ${className}`}
      style={{
        width: '100%',
        margin: '1rem 0',
        textAlign: 'center',
        overflow: 'hidden',
        minHeight: '90px',
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
