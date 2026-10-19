// Telemetri crash sisi-klien untuk ErrorBoundary Tablet.
const ENDPOINT = '/api/client-logs';
const DEDUPE_KEY = 'catavor_tablet_client_err_sent';

function alreadySent(fingerprint: string): boolean {
  try {
    const raw = sessionStorage.getItem(DEDUPE_KEY);
    const seen: string[] = raw ? JSON.parse(raw) : [];
    if (seen.includes(fingerprint)) return true;
    seen.push(fingerprint);
    sessionStorage.setItem(DEDUPE_KEY, JSON.stringify(seen.slice(-50)));
  } catch {
    // sessionStorage diblokir
  }
  return false;
}

export interface CrashReport {
  message: string;
  stack?: string;
  section?: string;
  component?: string;
}

export function reportClientError(report: CrashReport): void {
  if (typeof window === 'undefined') return;

  const fingerprint = `${report.section || 'root'}::${report.message}`.slice(0, 200);
  if (alreadySent(fingerprint)) return;

  const payload = JSON.stringify({
    ...report,
    device: 'tablet',
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
      return;
    }
  } catch {
    // ignore
  }

  try {
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    }).catch(() => {});
  } catch {
    // ignore
  }
}
