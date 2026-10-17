import { test, expect } from '@playwright/test';

/**
 * Task 3.1 — resync saat tab kembali aktif setelah idle.
 *
 * Mengukur RESYNC (lapisan berat), bukan semua request /api/*:
 * - kuota boleh disegarkan sejak idle > 60 detik
 * - validasi token + notifikasi hanya pada idle > 5 menit
 *
 * `checkTokenValidity` punya throttle internal (60 detik, sama di kedua
 * platform setelah disamakan), jadi pada idle pendek ia tidak boleh jalan.
 */
const EMAIL = process.env.CATAVOR_ADMIN_EMAIL || '';
const PASSWORD = process.env.CATAVOR_ADMIN_PASSWORD || '';

async function bootstrap(page: any) {
  const login = await page.request.post('/api/auth/login', {
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(login.status()).toBe(200);
  const body = await login.json();

  const storesRes = await page.request.get('/api/user/stores', {
    headers: { Authorization: `Bearer ${body.token}` },
  });
  const s = await storesRes.json();
  const slug = (s.stores || s.data || [])[0]?.slug || '';
  expect(slug).toBeTruthy();

  return { token: body.token as string, user: body.user, slug: slug as string };
}

test.describe('Task 3.1 idle resync', () => {
  test('idle pendek tidak resync, idle >5 menit resync penuh', async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'kredensial uji tidak diset');

    const { token, user, slug } = await bootstrap(page);

    const hits: string[] = [];
    page.on('request', (req: any) => {
      const u = req.url();
      if (!u.includes('/api/')) return;
      if (u.includes('/auth/verify') || u.includes('/notifications') || u.includes('/quota')) {
        hits.push(u.replace('http://localhost:8000', ''));
      }
    });

    await page.goto('/');
    await page.evaluate(({ token, user, slug }: any) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('catavor_token', token);
      localStorage.setItem('catavor_user', JSON.stringify(user));
      localStorage.setItem('catavor_active_slug', slug);
      sessionStorage.setItem('catavor_active_slug_selected', slug);
    }, { token, user, slug });

    await page.goto(`/${slug}/admin`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    hits.length = 0; // buang request boot

    // --- 1. idle 30 detik: tidak boleh ada resync apa pun ---
    await page.evaluate(() => {
      const realNow = Date.now;
      (window as any).__nowOffset = 30 * 1000;
      Date.now = () => realNow() + (window as any).__nowOffset;
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(1500);
    const shortIdleUrls = [...hits];

    // --- 2. idle 6 menit: resync penuh ---
    hits.length = 0;
    await page.evaluate(() => {
      (window as any).__nowOffset = 6 * 60 * 1000;
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(3000);
    const deepIdleUrls = [...hits];

    console.log(JSON.stringify({
      shortIdleUrls,
      deepIdleUrls,
      shortIdleCount: shortIdleUrls.length,
      deepHasVerify: deepIdleUrls.some((u) => u.includes('/auth/verify')),
      deepHasNotif: deepIdleUrls.some((u) => u.includes('/notifications')),
    }, null, 2));

    expect(shortIdleUrls, 'idle 30 detik tidak boleh memicu resync').toEqual([]);
    expect(deepIdleUrls.length, 'idle 6 menit harus memicu resync').toBeGreaterThan(0);
    expect(deepIdleUrls.some((u) => u.includes('/auth/verify')), 'token harus divalidasi ulang').toBe(true);
    expect(deepIdleUrls.some((u) => u.includes('/notifications')), 'notifikasi harus disegarkan').toBe(true);
  });
});
