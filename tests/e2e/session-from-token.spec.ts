import { test, expect } from '@playwright/test';

/**
 * Regresi untuk temuan lama "sesi dari token saja → store chooser".
 * Status: TIDAK lagi mereproduksi bug chooser (ditutup oleh fix refresh
 * multi-store commit 0fd2143). Test ini mengunci perilaku itu.
 *
 * Yang diuji:
 * 1. Token saja, catavor_stores KOSONG, buka /{slug}/admin → tetap di admin
 *    (dulu: terlempar ke /catalogs).
 * 2. Slug milik orang lain + stores kosong → backend tetap otoritatif menolak
 *    (defense-in-depth: 403, bukan 200).
 */
const EMAIL = process.env.CATAVOR_ADMIN_EMAIL || '';
const PASSWORD = process.env.CATAVOR_ADMIN_PASSWORD || '';

test.describe('Sesi dari token saja (refresh admin)', () => {
  test('refresh /{slug}/admin dengan stores kosong tidak melempar ke /catalogs', async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'kredensial uji tidak diset (CATAVOR_ADMIN_EMAIL/PASSWORD)');

    const login = await page.request.post('/api/auth/login', {
      data: { email: EMAIL, password: PASSWORD },
    });
    expect(login.status()).toBe(200);
    const body = await login.json();
    const token = body.token;
    expect(token).toBeTruthy();

    const storesRes = await page.request.get('/api/user/stores', {
      headers: { Authorization: `Bearer ${token}` },
    });
    let slug = '';
    if (storesRes.ok()) {
      const s = await storesRes.json();
      const list = s.stores || s.data || [];
      slug = Array.isArray(list) && list.length ? list[0].slug : '';
    }
    test.skip(!slug, 'user uji tidak punya store');

    // Tab baru: hanya token + user, TANPA catavor_stores / active_slug
    await page.goto('/');
    await page.evaluate(({ token, user }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('catavor_token', token);
      localStorage.setItem('catavor_user', JSON.stringify(user));
    }, { token, user: body.user });

    await page.goto(`/${slug}/admin`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const finalPath = new URL(page.url()).pathname.toLowerCase();
    expect(finalPath, 'harus tetap di admin, bukan terlempar ke chooser').not.toBe('/catalogs');
    expect(finalPath).toContain(slug.toLowerCase());
  });

  test('slug milik orang lain ditolak backend walau client lolos guard', async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'kredensial uji tidak diset');

    const login = await page.request.post('/api/auth/login', {
      data: { email: EMAIL, password: PASSWORD },
    });
    expect(login.status()).toBe(200);
    const token = (await login.json()).token;

    // shop66698 milik merchant lain (store uji lawan, sudah dibanned platform)
    const res = await page.request.get('/api/user/stores/shop66698/analytics', {
      headers: { Authorization: `Bearer ${token}`, 'X-Store-Slug': 'shop66698' },
    });
    // Harus 403/404, tidak boleh 200
    expect([403, 404]).toContain(res.status());
  });
});
