import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  type CookieConsentChoice,
  getStoredConsent,
  isPublicCatalogAdAllowed,
  isRestrictedAdRoute,
  setStoredConsent,
} from './adsenseRuntime';

export interface CookieConsentBannerProps {
  settings?: Record<string, any> | null;
  storePlan?: string | null;
  isAdminView?: boolean;
  isPublicCatalog?: boolean;
  itemCount?: number | null;
  isSuspended?: boolean;
  dormancyStatus?: string | null;
  isBlacklisted?: boolean;
  isDark?: boolean;
  onChoiceSaved?: (choice: CookieConsentChoice) => void;
}

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({
  settings,
  storePlan,
  isAdminView = false,
  isPublicCatalog = false,
  itemCount,
  isSuspended = false,
  dormancyStatus,
  isBlacklisted = false,
  isDark = false,
  onChoiceSaved,
}) => {
  const [choice, setChoice] = useState<CookieConsentChoice | null>(() => getStoredConsent());

  useEffect(() => {
    const sync = () => setChoice(getStoredConsent());
    window.addEventListener('catavor:consent-updated', sync);
    return () => window.removeEventListener('catavor:consent-updated', sync);
  }, []);

  const effectiveSettings =
    settings && Object.keys(settings).length > 0
      ? settings
      : typeof window !== 'undefined'
        ? (window as unknown as Record<string, any>).__catavorPlatformSettings
        : null;
  const adsOn = effectiveSettings?.ads_enabled === '1' || effectiveSettings?.ads_enabled === 'true';
  const gaOn = effectiveSettings?.ga_enabled === '1' || effectiveSettings?.ga_enabled === 'true';
  const adsAllowedHere =
    adsOn &&
    isPublicCatalogAdAllowed({
      storePlan,
      isAdminView,
      isPublicCatalog,
      itemCount,
      isSuspended,
      dormancyStatus,
      isBlacklisted,
    });

  if ((!adsAllowedHere && !gaOn) || choice !== null) {
    return null;
  }
  if (isAdminView || (typeof window !== 'undefined' && isRestrictedAdRoute(window.location.pathname))) {
    return null;
  }

  const handleChoose = (next: CookieConsentChoice) => {
    setStoredConsent(next);
    setChoice(next);
    if (onChoiceSaved) onChoiceSaved(next);
  };

  const bg = isDark ? '#0f172a' : '#ffffff';
  const border = isDark ? '1px solid rgba(148, 163, 184, 0.28)' : '1px solid #cbd5e1';
  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#cbd5e1' : '#475569';

  return (
    <div
      role="dialog"
      aria-label="Preferensi Cookie dan Analitik"
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 1.5rem)',
        maxWidth: '580px',
        backgroundColor: bg,
        border,
        borderRadius: '0.85rem',
        boxShadow: isDark
          ? '0 18px 40px rgba(0, 0, 0, 0.55)'
          : '0 14px 36px rgba(15, 23, 42, 0.14)',
        padding: '0.95rem 1.1rem',
        zIndex: 9990,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '0.6rem',
            backgroundColor: isDark ? 'rgba(56, 189, 248, 0.14)' : '#eff6ff',
            color: isDark ? '#38bdf8' : '#1d4ed8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ShieldCheck size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: textPrimary, marginBottom: '0.2rem' }}>
            Privasi &amp; Preferensi Cookie
          </div>
          <p style={{ margin: 0, fontSize: '0.75rem', lineHeight: 1.5, color: textSecondary }}>
            Catavor menggunakan cookie esensial agar layanan berjalan aman serta cookie analitik dan penayangan iklan yang relevan di etalase paket gratis.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => handleChoose('essential_only')}
          style={{
            minHeight: '44px',
            padding: '0.55rem 0.9rem',
            borderRadius: '0.6rem',
            border: isDark ? '1px solid rgba(148, 163, 184, 0.32)' : '1px solid #cbd5e1',
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#f8fafc',
            color: textPrimary,
            fontSize: '0.76rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Hanya Cookie Esensial
        </button>
        <button
          type="button"
          onClick={() => handleChoose('accepted')}
          style={{
            minHeight: '44px',
            padding: '0.55rem 1rem',
            borderRadius: '0.6rem',
            border: 'none',
            backgroundColor: '#1d4ed8',
            color: '#ffffff',
            fontSize: '0.76rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Terima Semua
        </button>
      </div>
    </div>
  );
};
