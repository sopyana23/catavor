import { test, expect, type Page } from '@playwright/test';

/**
 * Verifikasi runtime back-button trap (Audit §8.2) — setelah fix Task 1.5.
 *
 * Klaim: `pushState` HANYA untuk navigasi user eksplisit; popstate traversal
 * tidak boleh memicu pushState (penyebab lama: user "mental maju"/trapped).
 *
 * Store uji: adidas (12 item, publik). Server harus LIVE di :8000.
 * Catatan DOM: desktop pakai kartu `div[onclick]`; mobile memakai handler
 * `openDetailsSheet` pada wrapper berbeda — klik lewat heading `h3` yang
 * membubbling ke ancestor ber-onClick (bekerja di kedua platform).
 */

const SLUG = 'adidas';

/** Buka halaman katalog & tunggu kartu render. */
async function openCatalog(page: Page) {
  await page.goto(`/${SLUG}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible({ timeout: 25_000 });
}

/** Klik kartu produk ke-index untuk membuka detail (retry sampai URL berubah). */
async function openItem(page: Page, index = 0) {
  const heading = page.getByRole('heading', { level: 3 }).nth(index);
  await heading.waitFor({ state: 'visible', timeout: 20_000 });
  // klik berulang: React onClick mungkin belum ter-attach tepat setelah mount.
  for (let attempt = 0; attempt < 6; attempt++) {
    await heading.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    if (page.url().includes('item=')) return;
    // fallback: klik container kartu (div[onclick] pembungkus heading)
    const card = page.locator('main div[onclick]')
      .filter({ has: page.getByRole('heading', { level: 3 }) })
      .nth(index);
    if (await card.count() > index) {
      await card.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
      if (page.url().includes('item=')) return;
    }
  }
}

test.describe(`History-stack integrity @${SLUG}`, () => {
  test('user click opens detail with item param', async ({ page }) => {
    await openCatalog(page);
    await openItem(page, 0);
    expect(page.url()).toContain('item=');
  });

  test('back button returns to catalog without bouncing forward (trap test)', async ({ page }) => {
    await openCatalog(page);
    await openItem(page, 0);
    expect(page.url()).toContain('item=');

    await page.goBack();
    await page.waitForTimeout(700);

    // KRITIS (bug lama): URL tidak boleh mental-maju kembali ke detail.
    expect(page.url()).not.toContain('item=');
    expect(page.url()).toContain(`/${SLUG}`);
  });

  test('rapid Back x5 does not oscillate forward into detail', async ({ page }) => {
    await openCatalog(page);
    for (let i = 0; i < 3; i++) {
      await openItem(page, i);
      if (page.url().includes('item=')) {
        await page.goBack();
        await page.waitForTimeout(400);
      }
    }

    // Back cepat 5x (boleh overshoot keluar app -> about:blank; itu OK)
    for (let i = 0; i < 5; i++) {
      await page.goBack().catch(() => {});
    }
    await page.waitForTimeout(700);

    // Yang dilarang: berakhir di halaman DETAIL (tanda mental maju).
    expect(page.url()).not.toContain('item=');
  });

  test('repeated back/forward keeps history stack stable (no forward-bounce)', async ({ page }) => {
    await openCatalog(page);
    await openItem(page, 0);
    expect(page.url()).toContain('item=');

    // back lalu forward: harus kembali ke detail (stack utuh, tidak korup)
    await page.goBack();
    await page.waitForTimeout(600);
    expect(page.url()).not.toContain('item=');

    await page.goForward();
    await page.waitForTimeout(600);
    expect(page.url()).toContain('item=');

    // kembali lagi harus mulus
    await page.goBack();
    await page.waitForTimeout(600);
    expect(page.url()).not.toContain('item=');
  });

  test('bottom navigation remains present after interactions (footer resilience)', async ({ page }, testInfo) => {
    await openCatalog(page);
    await openItem(page, 0);
    await page.goBack();
    await page.waitForTimeout(600);

    const isMobile = testInfo.project.name.includes('mobile');
    if (isMobile) {
      const nav = page.getByRole('navigation');
      await expect(nav).toBeVisible();
      await expect(nav.getByRole('button').first()).toBeVisible();
    } else {
      // desktop: katalog masih render (app tidak blank / header tidak hilang)
      await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible();
    }
  });
});
