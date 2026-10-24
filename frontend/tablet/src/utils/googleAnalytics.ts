declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

let initializedMeasurementId: string | null = null;

/**
 * Initializes Google Analytics 4 (GA4) dynamically at runtime on Tablet using the measurement ID
 * configured from the Platform Management Console.
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
  } catch (err) {
    console.warn('[Catavor Tablet GA4] Failed to initialize Google Analytics:', err);
  }
};
