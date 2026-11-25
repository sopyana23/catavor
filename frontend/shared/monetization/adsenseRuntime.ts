export type CookieConsentChoice = 'accepted' | 'essential_only';

export const CONSENT_STORAGE_KEY = 'catavor_cookie_consent_v1';
const ADSENSE_SCRIPT_ID = 'catavor-adsense-script';
const LEGACY_ADSENSE_SCRIPT_ID = 'google-adsense-script';
const GA_SCRIPT_ID = 'catavor-ga4-script';

const CLIENT_ID_REGEX = /^(?:ca-)?pub-(\d{16})$/i;
const SLOT_ID_REGEX = /^\d{8,12}$/;
const GA_ID_REGEX = /^G-[A-Z0-9]{6,16}$/i;

const RESTRICTED_PATH_PREFIXES = [
  '/login',
  '/register',
  '/admin',
  '/dashboard',
  '/portal',
  '/system',
  '/ops',
  '/checkout',
  '/terms',
  '/privacy',
  '/acceptable-use',
  '/acceptable_use',
  '/syarat-ketentuan',
  '/kebijakan-privasi',
  '/ketentuan-penggunaan',
  '/kebijakan',
  '/policies',
  '/legal',
  '/prohibited',
  '/barang-terlarang',
  '/moderation',
  '/standar-moderasi',
  '/subscription',
  '/ketentuan-langganan',
  '/transactions',
  '/pedoman-transaksi',
  '/catalogs',
  '/select-catalog',
  '/billing',
  '/sandbox',
];

let lastGaPath = '';
let lastGaTimestamp = 0;

export function normalizeAdSenseClientId(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = String(raw).trim().toLowerCase();
  const match = CLIENT_ID_REGEX.exec(trimmed);
  if (!match) return '';
  if (match[1] === '0000000000000000') return '';
  return `ca-pub-${match[1]}`;
}

export function isValidAdSenseClientId(raw?: string | null): boolean {
  return normalizeAdSenseClientId(raw) !== '';
}

export function isValidAdSenseSlotId(raw?: string | null): boolean {
  if (!raw) return false;
  return SLOT_ID_REGEX.test(String(raw).trim());
}

export function isValidGaMeasurementId(raw?: string | null): boolean {
  if (!raw) return false;
  return GA_ID_REGEX.test(String(raw).trim().toUpperCase());
}

export function isRestrictedAdRoute(pathname?: string): boolean {
  const rawPath = (pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '')).toLowerCase().trim();
  if (!rawPath) return true;
  if (rawPath === '/ads.txt') return true;
  return RESTRICTED_PATH_PREFIXES.some((prefix) => rawPath === prefix || rawPath.startsWith(`${prefix}/`)) ||
    rawPath.includes('/admin') ||
    rawPath.includes('/dashboard');
}

export function isPublicCatalogAdAllowed(options?: {
  storePlan?: string | null;
  isAdminView?: boolean;
  pathname?: string;
  isPublicCatalog?: boolean;
}): boolean {
  if (options?.isAdminView) return false;
  // Fail-closed: hanya katalog publik eksplisit & paket 'free' yang terverifikasi.
  // Plan yang belum termuat ('') maupun paket berbayar (pro_starter / pro_business) dilarang menampilkan iklan.
  if (options?.isPublicCatalog !== true) {
    return false;
  }
  const plan = String(options?.storePlan ?? '').trim().toLowerCase();
  if (plan !== 'free') {
    return false;
  }
  const path = options?.pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  if (isRestrictedAdRoute(path)) {
    return false;
  }
  if (path === '/' || path === '') {
    return false;
  }
  return true;
}

export function getStoredConsent(): CookieConsentChoice | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (val === 'accepted' || val === 'essential_only') {
      return val;
    }
  } catch {
    // Ignore storage read failures in private mode
  }
  return null;
}

function getGtagFn(): ((...args: any[]) => void) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { dataLayer?: any[]; gtag?: (...args: any[]) => void };
  w.dataLayer = w.dataLayer || [];
  if (typeof w.gtag !== 'function') {
    w.gtag = (...args: any[]) => {
      w.dataLayer!.push(args);
    };
  }
  return w.gtag;
}

export function ensureConsentDefaultsInitialized(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as {
    __catavorConsentInit?: boolean;
    adsbygoogle?: any[] & { requestNonPersonalizedAds?: number };
  };
  const choice = getStoredConsent();
  const isAccepted = choice === 'accepted';
  const gtag = getGtagFn();
  if (!w.__catavorConsentInit && gtag) {
    gtag('consent', 'default', {
      ad_storage: isAccepted ? 'granted' : 'denied',
      ad_user_data: isAccepted ? 'granted' : 'denied',
      ad_personalization: isAccepted ? 'granted' : 'denied',
      analytics_storage: isAccepted ? 'granted' : 'denied',
      wait_for_update: 500,
    });
    w.__catavorConsentInit = true;
  }
  w.adsbygoogle = w.adsbygoogle || [];
  w.adsbygoogle.requestNonPersonalizedAds = isAccepted ? 0 : 1;
}

export function setStoredConsent(choice: CookieConsentChoice): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Ignore quota errors
  }
  const isAccepted = choice === 'accepted';
  ensureConsentDefaultsInitialized();
  const gtag = getGtagFn();
  if (gtag) {
    gtag('consent', 'update', {
      ad_storage: isAccepted ? 'granted' : 'denied',
      ad_user_data: isAccepted ? 'granted' : 'denied',
      ad_personalization: isAccepted ? 'granted' : 'denied',
      analytics_storage: isAccepted ? 'granted' : 'denied',
    });
  }
  const w = window as unknown as { adsbygoogle?: any[] & { requestNonPersonalizedAds?: number } };
  w.adsbygoogle = w.adsbygoogle || [];
  w.adsbygoogle.requestNonPersonalizedAds = isAccepted ? 0 : 1;
  window.dispatchEvent(new CustomEvent('catavor:consent-updated', { detail: choice }));
}

function removeAdSenseFromHead(): void {
  if (typeof document === 'undefined') return;
  [ADSENSE_SCRIPT_ID, LEGACY_ADSENSE_SCRIPT_ID].forEach((id) => {
    const node = document.getElementById(id);
    if (node && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  });
  const metas = document.querySelectorAll('meta[name="google-adsense-account"]');
  metas.forEach((m) => m.parentNode?.removeChild(m));
  // Bersihkan wadah iklan Auto Ads Google jika user berpindah SPA ke admin atau paket Pro
  const autoAdsNodes = document.querySelectorAll('ins.adsbygoogle-noablate, .google-auto-placed');
  autoAdsNodes.forEach((n) => n.parentNode?.removeChild(n));
}

export function syncGoogleAdSenseHead(
  settings: Record<string, any> | null | undefined,
  context?: {
    storePlan?: string | null;
    isAdminView?: boolean;
    isPublicCatalog?: boolean;
    pathname?: string;
  }
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (settings && typeof settings === 'object') {
    const win = window as unknown as Record<string, any>;
    win.__catavorPlatformSettings = { ...(win.__catavorPlatformSettings || {}), ...settings };
  }
  const adsEnabled = settings?.ads_enabled === '1' || settings?.ads_enabled === 'true';
  const testMode = settings?.ads_test_mode === '1' || settings?.ads_test_mode === 'true';
  const clientId = normalizeAdSenseClientId(settings?.ads_client_id);
  const allowed = isPublicCatalogAdAllowed({
    storePlan: context?.storePlan,
    isAdminView: context?.isAdminView,
    isPublicCatalog: context?.isPublicCatalog,
    pathname: context?.pathname,
  });

  if (!adsEnabled || testMode || !clientId || !allowed) {
    removeAdSenseFromHead();
    return;
  }

  ensureConsentDefaultsInitialized();

  // Cleanup legacy duplicate script tag id if any
  const legacy = document.getElementById(LEGACY_ADSENSE_SCRIPT_ID);
  if (legacy && legacy.parentNode) {
    legacy.parentNode.removeChild(legacy);
  }

  let meta = document.querySelector('meta[name="google-adsense-account"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'google-adsense-account';
    document.head.appendChild(meta);
  }
  if (meta.content !== clientId) {
    meta.content = clientId;
  }

  const existing = document.getElementById(ADSENSE_SCRIPT_ID) as HTMLScriptElement | null;
  const targetSrc = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
  if (existing && existing.src === targetSrc) {
    return;
  }
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }

  const script = document.createElement('script');
  script.id = ADSENSE_SCRIPT_ID;
  script.async = true;
  script.src = targetSrc;
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}

export function initGoogleAdSense(
  settingsOrClientId: Record<string, any> | string | null | undefined,
  storePlanOrEnabled?: string | boolean | null,
  isAdminViewOrAuto?: boolean
): void {
  if (typeof settingsOrClientId === 'string') {
    const enabled = Boolean(storePlanOrEnabled);
    syncGoogleAdSenseHead(
      {
        ads_client_id: settingsOrClientId,
        ads_enabled: enabled ? '1' : '0',
        ads_auto_enabled: isAdminViewOrAuto ? '1' : '0',
        ads_test_mode: '0',
      },
      {
        isPublicCatalog:
          typeof window !== 'undefined'
            ? !isRestrictedAdRoute(window.location.pathname) && window.location.pathname !== '/'
            : false,
      }
    );
    return;
  }
  syncGoogleAdSenseHead(settingsOrClientId, {
    storePlan: typeof storePlanOrEnabled === 'string' ? storePlanOrEnabled : undefined,
    isAdminView: isAdminViewOrAuto,
    isPublicCatalog:
      typeof window !== 'undefined'
        ? !isRestrictedAdRoute(window.location.pathname) && window.location.pathname !== '/'
        : false,
  });
}

export function initGoogleAnalytics(
  settingsOrMeasurementId: Record<string, any> | string | null | undefined,
  isEnabled?: boolean
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const settings =
    typeof settingsOrMeasurementId === 'string'
      ? {
          ga_measurement_id: settingsOrMeasurementId,
          ga_enabled: isEnabled !== false ? '1' : '0',
        }
      : settingsOrMeasurementId;
  const gaEnabled = settings?.ga_enabled === '1' || settings?.ga_enabled === 'true';
  const measurementId = String(settings?.ga_measurement_id || '').trim().toUpperCase();
  const w = window as unknown as Record<string, any>;

  if (!gaEnabled || !isValidGaMeasurementId(measurementId)) {
    if (measurementId && isValidGaMeasurementId(measurementId)) {
      w[`ga-disable-${measurementId}`] = true;
    }
    const oldScript = document.getElementById(GA_SCRIPT_ID);
    if (oldScript && oldScript.parentNode) {
      oldScript.parentNode.removeChild(oldScript);
    }
    return;
  }

  w[`ga-disable-${measurementId}`] = false;
  ensureConsentDefaultsInitialized();
  const gtag = getGtagFn();
  if (!gtag) return;

  if (!document.getElementById(GA_SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = GA_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
  }

  if (w.__catavorGaConfiguredId !== measurementId) {
    gtag('js', new Date());
    gtag('config', measurementId, {
      anonymize_ip: true,
      send_page_view: true,
    });
    w.__catavorGaConfiguredId = measurementId;
  }
}

export function trackPageView(path: string, title?: string): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, any>;
  if (!w.__catavorGaConfiguredId || typeof w.gtag !== 'function') return;

  const cleanPath = String(path || window.location.pathname || '/');
  const now = Date.now();
  if (lastGaPath === cleanPath && now - lastGaTimestamp < 500) {
    return;
  }
  lastGaPath = cleanPath;
  lastGaTimestamp = now;

  w.gtag('event', 'page_view', {
    page_path: cleanPath,
    page_title: title || document.title || 'Catavor',
    page_location: window.location.href,
  });
}

export function trackEvent(eventName: string, params?: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, any>;
  if (!w.__catavorGaConfiguredId || typeof w.gtag !== 'function') return;
  if (!eventName) return;
  w.gtag('event', eventName, params || {});
}

export function getAuthHeaders(token?: string | null, storeSlug?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  const resolvedToken = token || (typeof window !== 'undefined' ? window.localStorage.getItem('catavor_token') : null);
  if (resolvedToken && resolvedToken !== 'session_cookie') {
    headers['Authorization'] = `Bearer ${resolvedToken}`;
  }
  if (storeSlug) {
    headers['X-Store-Slug'] = storeSlug;
  }
  return headers;
}

export function resolveActiveStoreSlugFromEnv(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const reserved = new Set([
      'api', 'sanctum', 'desktop', 'tablet', 'mobile', 'assets', 'login', 'register',
      'checkout', 'admin', 'platform', 'system', 'ops', 'dashboard', 'terms', 'privacy',
      'acceptable-use', 'acceptable_use', 'syarat-ketentuan', 'kebijakan-privasi',
      'ketentuan-penggunaan', 'policies', 'kebijakan', 'legal', 'prohibited', 'barang-terlarang',
      'subscription', 'ketentuan-langganan', 'transactions', 'pedoman-transaksi',
      'moderation', 'standar-moderasi', 'catalogs', 'select-catalog', 'stores',
    ]);
    if (parts.length > 0 && !reserved.has(parts[0].toLowerCase())) {
      return parts[0];
    }
    const rawUser = window.localStorage.getItem('catavor_user');
    if (rawUser) {
      const user = JSON.parse(rawUser);
      if (user?.id) {
        const scoped = window.localStorage.getItem(`catavor_active_slug_${user.id}`);
        if (scoped) return scoped;
      }
    }
    return window.localStorage.getItem('catavor_active_slug');
  } catch {
    return null;
  }
}

export function formatRupiah(amount: number | string | null | undefined): string {
  const num = Number(amount || 0);
  if (!Number.isFinite(num)) return 'Rp 0';
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}
