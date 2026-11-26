import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Megaphone, Sparkles, X } from 'lucide-react';
import {
  isPublicCatalogAdAllowed,
  isValidAdSenseSlotId,
  normalizeAdSenseClientId,
} from './adsenseRuntime';

export type AdSenseSlotType = 'header' | 'infeed' | 'product_detail' | 'bottom' | 'dashboard';

export interface SharedAdSenseUnitProps {
  settings: Record<string, any>;
  storePlan?: string;
  slotType: AdSenseSlotType;
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal';
  style?: React.CSSProperties;
  className?: string;
  isDark?: boolean;
  device?: 'desktop' | 'tablet' | 'mobile';
  isAdminView?: boolean;
  isPublicCatalog?: boolean;
  itemCount?: number | null;
  isSuspended?: boolean;
  dormancyStatus?: string | null;
  isBlacklisted?: boolean;
  onUpgradeClick?: () => void;
}

const MIN_HEIGHT_BY_SLOT: Record<string, string> = {
  header: '90px',
  infeed: '120px',
  product_detail: '110px',
  bottom: '68px',
};

const LABEL_BY_SLOT: Record<string, string> = {
  header: 'Slot Banner Atas Katalog (Header)',
  infeed: 'Slot Katalog In-Feed (Sela Produk)',
  product_detail: 'Slot Detail Produk',
  bottom: 'Slot Banner Bawah Layar',
};

export const SharedAdSenseUnit: React.FC<SharedAdSenseUnitProps> = ({
  settings,
  storePlan,
  slotType,
  format = 'auto',
  style,
  className,
  isDark = false,
  device = 'desktop',
  isAdminView = false,
  isPublicCatalog = true,
  itemCount,
  isSuspended = false,
  dormancyStatus,
  isBlacklisted = false,
}) => {
  const insRef = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);
  const [unfilled, setUnfilled] = useState(false);
  const [bottomDismissed, setBottomDismissed] = useState(() => {
    if (slotType !== 'bottom' || typeof window === 'undefined') return false;
    try {
      return window.sessionStorage.getItem('catavor_dismiss_bottom_ad') === '1';
    } catch {
      return false;
    }
  });

  // Strict Policy Enforcement: No dashboard ads, no Paid Tier ads, no restricted/admin/empty/suspended routes,
  // and enforce balanced ad-to-content density when catalog has <= 1 item.
  const meetsDensityRule =
    slotType !== 'bottom' ||
    itemCount === undefined ||
    itemCount === null ||
    itemCount >= 2;
  const policyAllowed =
    slotType !== 'dashboard' &&
    meetsDensityRule &&
    isPublicCatalogAdAllowed({
      storePlan,
      isAdminView,
      isPublicCatalog,
      itemCount,
      isSuspended,
      dormancyStatus,
      isBlacklisted,
    });

  const adsEnabled = settings?.ads_enabled === '1' || settings?.ads_enabled === 'true';
  const isTestMode = settings?.ads_test_mode === '1' || settings?.ads_test_mode === 'true';
  const clientId = normalizeAdSenseClientId(settings?.ads_client_id);
  const rawSlotId = String(settings?.[`ads_slot_${slotType}`] || '').trim();
  const hasValidSlot = isValidAdSenseSlotId(rawSlotId);

  const shouldRenderLive = policyAllowed && adsEnabled && !isTestMode && clientId !== '' && hasValidSlot && !unfilled && !(slotType === 'bottom' && bottomDismissed);
  const shouldRenderSandbox = policyAllowed && adsEnabled && isTestMode && !(slotType === 'bottom' && bottomDismissed);

  useEffect(() => {
    setUnfilled(false);
    pushedRef.current = false;
  }, [clientId, rawSlotId, slotType, isTestMode]);

  useEffect(() => {
    if (!shouldRenderLive || !insRef.current || pushedRef.current) return;

    const el = insRef.current;
    const observer = new MutationObserver(() => {
      if (el.getAttribute('data-ad-status') === 'unfilled') {
        setUnfilled(true);
      }
    });
    observer.observe(el, { attributes: true, attributeFilter: ['data-ad-status'] });

    try {
      const w = window as unknown as { adsbygoogle?: any[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
      pushedRef.current = true;
    } catch {
      // Ignore AdSense runtime push errors (e.g. adblockers)
    }

    return () => observer.disconnect();
  }, [shouldRenderLive, clientId, rawSlotId]);

  if (!shouldRenderLive && !shouldRenderSandbox) {
    return null;
  }

  const handleDismissBottom = () => {
    setBottomDismissed(true);
    try {
      window.sessionStorage.setItem('catavor_dismiss_bottom_ad', '1');
    } catch {
      // ignore
    }
  };

  if (shouldRenderSandbox) {
    const borderCol = isDark ? 'rgba(148, 163, 184, 0.25)' : '#cbd5e1';
    const bg = isDark ? 'rgba(30, 41, 59, 0.55)' : '#f8fafc';
    const titleCol = isDark ? '#f1f5f9' : '#1e293b';
    const subCol = isDark ? '#94a3b8' : '#64748b';
    const minHeight = MIN_HEIGHT_BY_SLOT[slotType] || '90px';
    const touchCloseSize = device === 'desktop' ? '28px' : '44px';

    return (
      <div
        data-testid={`adsense-unit-${slotType}`}
        className={className}
        style={{
          position: 'relative',
          width: '100%',
          minHeight,
          margin: slotType === 'bottom' ? (device === 'desktop' ? '1.35rem 0 0 0' : '0.85rem 0 0 0') : '0.65rem 0',
          padding: device === 'mobile' ? '0.65rem 0.75rem' : '0.75rem 1rem',
          borderRadius: '0.75rem',
          backgroundColor: bg,
          border: `1px dashed ${borderCol}`,
          display: 'flex',
          alignItems: device === 'mobile' ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          flexDirection: device === 'mobile' ? 'column' : 'row',
          gap: device === 'mobile' ? '0.5rem' : '0.65rem',
          boxSizing: 'border-box',
          ...style,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, width: device === 'mobile' ? '100%' : 'auto', flex: 1 }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '0.55rem',
              backgroundColor: isDark ? 'rgba(234, 179, 8, 0.14)' : '#fef9c3',
              color: isDark ? '#facc15' : '#a16207',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {slotType === 'product_detail' ? <Sparkles size={16} /> : <Megaphone size={16} />}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: titleCol, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span>Mode Sandbox AdSense</span>
              <span
                style={{
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.45rem',
                  borderRadius: '999px',
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                  color: isDark ? '#7dd3fc' : '#0369a1',
                }}
              >
                {slotType}
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', color: subCol, marginTop: '0.15rem', lineHeight: 1.35, whiteSpace: device === 'mobile' ? 'normal' : 'nowrap', overflow: device === 'mobile' ? 'visible' : 'hidden', textOverflow: device === 'mobile' ? 'clip' : 'ellipsis' }}>
              {LABEL_BY_SLOT[slotType] || slotType} {hasValidSlot ? `(#${rawSlotId})` : '(Belum ada Slot ID manual)'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: device === 'mobile' ? 'space-between' : 'flex-end', width: device === 'mobile' ? '100%' : 'auto', gap: '0.35rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.65rem', color: subCol, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
            <ExternalLink size={12} /> Gratis Iklan di Pro
          </span>
          {slotType === 'bottom' && (
            <button
              type="button"
              onClick={handleDismissBottom}
              aria-label="Tutup pratinjau banner bawah"
              style={{
                minWidth: touchCloseSize,
                minHeight: touchCloseSize,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '0.5rem',
                border: `1px solid ${borderCol}`,
                backgroundColor: 'transparent',
                color: subCol,
                cursor: 'pointer',
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={`adsense-unit-${slotType}`}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: MIN_HEIGHT_BY_SLOT[slotType] || '90px',
        margin: slotType === 'bottom' ? (device === 'desktop' ? '1.35rem 0 0 0' : '0.85rem 0 0 0') : '0.65rem 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: isDark ? '#94a3b8' : '#64748b' }}>
          Iklan
        </span>
        {slotType === 'bottom' && (
          <button
            type="button"
            onClick={handleDismissBottom}
            aria-label="Tutup banner iklan"
            style={{
              minWidth: device === 'desktop' ? '28px' : '44px',
              minHeight: device === 'desktop' ? '28px' : '44px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '0.45rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: isDark ? '#94a3b8' : '#64748b',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', minHeight: MIN_HEIGHT_BY_SLOT[slotType] || '90px' }}
        data-ad-client={clientId}
        data-ad-slot={rawSlotId}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
};
