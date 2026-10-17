// Telemetri crash sisi-klien untuk ErrorBoundary.
// Tujuan: saat user lapangan kena error, stack trace sampai ke server log
// tanpa harus minta user buka DevTools.
//
// Batasan yang disengaja:
// - Dedupe per (message+section) sekali per sesi tab → cegah banjir log saat
//   satu error memicu render-error berulang.
// - Fail-silent total: reporter tidak boleh pernah melempar error sendiri.
// - Kirim pakai sendBeacon bila ada (aman saat halaman mau unload), fallback fetch keepalive.

const ENDPOINT = '/api/client-logs';
const DEDUPE_KEY = 'catavor_client_err_sent';

function alreadySent(fingerprint: string): boolean {
  try {
    const raw = sessionStorage.getItem(DEDUPE_KEY);
    const seen: string[] = raw ? JSON.parse(raw) : [];
    if (seen.includes(fingerprint)) return true;
    seen.push(fingerprint);
    // ponytail: cap 50 fingerprint/sesi. Naikkan bila butuh jejak lebih panjang.
    sessionStorage.setItem(DEDUPE_KEY, JSON.stringify(seen.slice(-50)));
  } catch {
    // sessionStorage diblokir (private mode ketat) → tetap kirim, tanpa dedupe.
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
    message: String(report.message || '').slice(0, 2000),
    stack: String(report.stack || '').slice(0, 8000),
    section: String(report.section || '').slice(0, 300),
    component: String(report.component || '').slice(0, 300),
    url: String(window.location.href).slice(0, 300),
    user_agent: String(navigator.userAgent || '').slice(0, 300),
    platform: window.innerWidth < 768 ? 'mobile' : 'desktop',
    build: String((import.meta as any)?.env?.VITE_BUILD_ID || '').slice(0, 80),
    timestamp: new Date().toISOString(),
    tags: [fingerprint],
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
  } catch {
    // lanjut ke fetch
  }

  try {
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // fail-silent
  }
}

export default reportClientError;
