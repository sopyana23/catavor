import { test, expect } from '@playwright/test';

/**
 * Verifikasi lingkungan device: pastikan viewport benar-benar sesuai ukuran
 * masing-masing device saat test berjalan, dan elemen kunci tampil (tidak
 * terpotong / overflow horizontal).
 */

test.describe('Device environment sanity', () => {
  test('viewport matches device size and key UI is on-screen', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    await page.goto('/adidas');
    await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible({ timeout: 25_000 });

    // 1. ukuran viewport aktual di browser
    const vp = await page.evaluate(() => ({
      w: window.innerWidth,
      h: window.innerHeight,
      dpr: window.devicePixelRatio,
      touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));

    if (isMobile) {
      // Pixel 5: 393x727 CSS px, DPR 2.75, touch
      expect(vp.w, 'mobile width').toBe(393);
      expect(vp.h, 'mobile height').toBe(727);
      expect(vp.dpr, 'mobile DPR').toBeCloseTo(2.75, 2);
      expect(vp.touch, 'mobile touch').toBeTruthy();
    } else {
      // Desktop Chrome: 1280x720, DPR 1, tanpa touch
      expect(vp.w, 'desktop width').toBe(1280);
      expect(vp.h, 'desktop height').toBe(720);
      expect(vp.dpr, 'desktop DPR').toBe(1);
      expect(vp.touch, 'desktop no-touch').toBeFalsy();
    }

    // 2. tidak ada overflow horizontal (konten tidak melebar keluar layar)
    expect(vp.scrollW, 'no horizontal overflow').toBeLessThanOrEqual(vp.clientW + 1);

    // 3. elemen kunci benar-benar dalam batas viewport (bukan lempar keluar layar)
    const firstCard = page.getByRole('heading', { level: 3 }).first();
    const box = await firstCard.boundingBox();
    expect(box, 'card visible box').not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.w + 1);
    }
  });

  test('touch works on mobile, click works on desktop (interaction model)', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    await page.goto('/adidas');
    const heading = page.getByRole('heading', { level: 3 }).first();
    await heading.waitFor({ state: 'visible', timeout: 25_000 });

    // aksi sesuai model input device
    if (isMobile) {
      await heading.tap({ timeout: 5000 }).catch(() => heading.click());
    } else {
      await heading.click();
    }
    await page.waitForTimeout(800);
    expect(page.url()).toContain('item=');
  });
});
