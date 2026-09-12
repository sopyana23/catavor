/**
 * Google AdSense Dynamic Verification & Head Script Injector
 * 
 * Injeksi dinamis kode verifikasi Google AdSense ke dalam <head> dokumen:
 * 1. <meta name="google-adsense-account" content="ca-pub-XXXXXXXXXXXXXXXX">
 * 2. <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
 * 
 * Hal ini memungkinkan Google AdSense mendeteksi dan memverifikasi domain platform Catavor
 * secara instan tanpa perlu melakukan hardcode di file HTML atau build ulang aplikasi.
 */

let initializedAdSenseClient: string | null = null;

export const initGoogleAdSense = (
  clientId?: string,
  isEnabled: boolean = true,
  autoAdsEnabled: boolean = true
) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (!clientId || !clientId.trim()) {
    return;
  }

  // Format client ID to ensure ca-pub- prefix
  let formattedClient = clientId.trim();
  if (formattedClient.startsWith('pub-')) {
    formattedClient = `ca-${formattedClient}`;
  } else if (!formattedClient.startsWith('ca-pub-')) {
    formattedClient = `ca-pub-${formattedClient}`;
  }

  // If disabled, remove previous meta / script if any
  if (!isEnabled) {
    const existingScript = document.getElementById('google-adsense-head-script');
    if (existingScript) existingScript.remove();
    const existingMeta = document.querySelector('meta[name="google-adsense-account"]');
    if (existingMeta) existingMeta.remove();
    initializedAdSenseClient = null;
    return;
  }

  // If already initialized with the same client ID, do not duplicate
  if (initializedAdSenseClient === formattedClient) {
    return;
  }

  try {
    // 1. Injeksi Meta Tag Verifikasi Akun AdSense: <meta name="google-adsense-account" content="ca-pub-...">
    let metaTag = document.querySelector('meta[name="google-adsense-account"]') as HTMLMetaElement | null;
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'google-adsense-account';
      metaTag.content = formattedClient;
      document.head.appendChild(metaTag);
    } else {
      metaTag.content = formattedClient;
    }

    // 2. Injeksi Tag Script Resmi Google AdSense di <head>
    let scriptTag = document.getElementById('google-adsense-head-script') as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = 'google-adsense-head-script';
      scriptTag.async = true;
      scriptTag.crossOrigin = 'anonymous';
      scriptTag.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(formattedClient)}`;
      if (autoAdsEnabled) {
        scriptTag.setAttribute('data-ad-client', formattedClient);
      }
      document.head.appendChild(scriptTag);
    } else {
      scriptTag.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(formattedClient)}`;
      if (autoAdsEnabled) {
        scriptTag.setAttribute('data-ad-client', formattedClient);
      }
    }

    initializedAdSenseClient = formattedClient;
    console.log(`[Catavor AdSense] Dynamic verification & script injected into <head> for ${formattedClient}`);
  } catch (err) {
    console.warn('[Catavor AdSense] Failed to inject head verification script:', err);
  }
};
