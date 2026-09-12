declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

let initializedMeasurementId: string | null = null;

/**
 * Initializes Google Analytics 4 (GA4) dynamically at runtime using the measurement ID
 * configured from the Super Admin panel without requiring hardcoded scripts or app rebuilds.
 */
export const initGoogleAnalytics = (measurementId?: string, isEnabled: boolean = true) => {
  if (typeof window === 'undefined') return;

  const cleanId = measurementId?.trim().toUpperCase();

  // If disabled or empty ID, do not initialize
  if (!isEnabled || !cleanId || !cleanId.startsWith('G-')) {
    return;
  }

  // If already initialized with the same ID, don't re-insert script
  if (initializedMeasurementId === cleanId && window.gtag) {
    return;
  }

  try {
    // 1. Check if script tag already exists
    let scriptTag = document.getElementById('ga-gtag-script') as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = 'ga-gtag-script';
      scriptTag.async = true;
      scriptTag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cleanId)}`;
      document.head.appendChild(scriptTag);
    } else {
      scriptTag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cleanId)}`;
    }

    // 2. Initialize dataLayer and gtag
    window.dataLayer = window.dataLayer || [];
    function gtag(...args: any[]) {
      window.dataLayer?.push(args);
    }
    window.gtag = gtag;

    gtag('js', new Date());
    gtag('config', cleanId, {
      send_page_view: true,
      cookie_flags: 'SameSite=None;Secure'
    });

    initializedMeasurementId = cleanId;
    console.log(`[Catavor GA4] Successfully initialized runtime tracking for ${cleanId}`);
  } catch (err) {
    console.warn('[Catavor GA4] Failed to initialize Google Analytics:', err);
  }
};

export const trackPageView = (url: string, title?: string) => {
  if (typeof window === 'undefined' || !window.gtag || !initializedMeasurementId) return;
  try {
    window.gtag('config', initializedMeasurementId, {
      page_path: url,
      page_title: title || document.title,
    });
  } catch (err) {
    // silent fallback
  }
};

export const trackEvent = (action: string, category: string, label?: string, value?: number) => {
  if (typeof window === 'undefined' || !window.gtag) return;
  try {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  } catch (err) {
    // silent fallback
  }
};
