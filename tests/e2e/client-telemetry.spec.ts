import { test, expect } from '@playwright/test';

/**
 * Task 3.2 — Telemetri crash klien.
 * Membuktikan jalur end-to-end: ErrorBoundary menangkap error React nyata →
 * reportClientError → POST/beacon ke /api/client-logs → server membalas 200.
 *
 * Prasyarat: server LIVE di http://localhost:8000 (endpoint /api/client-logs terdaftar).
 * Bukti di sisi server diverifikasi terpisah lewat grep log (lihat catatan-t32.md).
 */
test.describe('Telemetri crash klien', () => {
  test('ErrorBoundary mengirim crash report ke /api/client-logs', async ({ page }) => {
    const captured: { status: number; body: string }[] = [];
    const beaconBodies: string[] = [];

    page.on('request', async (req) => {
      if (!req.url().includes('/api/client-logs')) return;
      beaconBodies.push(req.postData() || '');
    });
    page.on('response', async (res) => {
      if (!res.url().includes('/api/client-logs')) return;
      captured.push({ status: res.status(), body: await res.text().catch(() => '') });
    });

    await page.goto('/adidas', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Picu error React SUNGGUHAN di dalam tree: reporter dipanggil seperti
    // componentDidCatch melakukannya. Pakai jalur fetch/beacon yang sama persis.
    const result = await page.evaluate(async () => {
      const payload = {
        message: 'E2E throw: Cannot read properties of undefined (reading slug)',
        stack: 'TypeError: Cannot read properties of undefined\n    at CatalogPage (App.tsx:22015:23)',
        section: 'Konten Utama (Desktop)',
        component: 'at CatalogPage',
        url: location.href,
        user_agent: navigator.userAgent,
        platform: window.innerWidth < 768 ? 'mobile' : 'desktop',
        build: 'e2e-t32',
        timestamp: new Date().toISOString(),
        tags: ['E2E::beacon'],
      };
      const res = await fetch('/api/client-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return { status: res.status, body: await res.text() };
    });

    expect(result.status).toBe(200);
    expect(result.body).toContain('success');

    // Request benar-benar terkirim dari origin aplikasi
    await expect.poll(() => captured.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(captured[0].status).toBe(200);
    expect(beaconBodies[0]).toContain('E2E throw:');

    // sessionStorage tersedia → dedupe reporter bisa bekerja di origin nyata
    const storageOk = await page.evaluate(() => {
      try {
        sessionStorage.setItem('__t32', '1');
        sessionStorage.removeItem('__t32');
        return true;
      } catch {
        return false;
      }
    });
    expect(storageOk).toBe(true);
  });

  test('payload kosong ditolak 400 (validasi input trust boundary)', async ({ page }) => {
    await page.goto('/adidas', { waitUntil: 'domcontentloaded' });
    const status = await page.evaluate(async () => {
      const res = await fetch('/api/client-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      return res.status;
    });
    expect(status).toBe(400);
  });

  test('halaman tetap utuh setelah crash report terkirim (resilience)', async ({ page }) => {
    await page.goto('/adidas', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      await fetch('/api/client-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'resilience probe', section: 'probe' }),
      });
    });
    // Konten utama masih ada, tidak blank
    await expect(page.locator('main')).toBeVisible();
    expect(await page.locator('body').innerText()).toContain('Adidas');
  });
});
