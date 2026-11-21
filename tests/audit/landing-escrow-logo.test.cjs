// Regresi paritas: kartu mitra escrow di landing publik harus menampilkan
// LOGO MITRA dari setelan platform di ketiga form-factor.
//
// Sebelum perbaikan, tablet hanya merender ikon generik <BadgeCheck> dan tidak
// pernah membaca rekber_logo_url — sementara desktop (App.tsx:15881) dan mobile
// (App.tsx:16440) merender logo yang diunggah admin. Hasilnya landing tablet
// tidak menampilkan mitra resmi yang sama dengan dua form-factor lain, dan
// jumlah <img> di landing tablet 0 sementara desktop/mobile 1.
//
// Jalankan: node --test tests/audit/landing-escrow-logo.test.cjs
// Prasyarat: public/{desktop,mobile,tablet} sudah dibangun (npm run build).

const { before, after, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const origin = 'https://landing-escrow.invalid';
const publicRoot = path.resolve(__dirname, '../../public');

// PNG 1x1 transparan — cukup untuk membuktikan <img> memuat sumber nyata
// (naturalWidth > 0) tanpa bergantung pada berkas di disk atau server.
const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const PARTNER = 'Rekber Syariah Uji';

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

const settings = {
  rekber_logo_url: LOGO,
  rekber_partner_name: PARTNER,
  rekber_website_url: 'https://rekbersyariah.com',
  rekber_enabled: '1',
  ga_enabled: '0',
  ads_enabled: '0',
};

async function openLanding(bundle, width, height) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    hasTouch: bundle !== 'desktop',
    serviceWorkers: 'block',
  });
  await ctx.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) {
      if (req.method() !== 'GET') return route.fulfill({ status: 405, json: {} });
      if (url.pathname.includes('/stream') || url.pathname.includes('/ticket')) return route.abort();
      if (['/api/settings', '/api/admin/settings'].includes(url.pathname)) {
        return route.fulfill({ json: { success: true, data: settings } });
      }
      return route.fulfill({ json: { success: true, data: [], stores: [], summary: {} } });
    }
    const asset = url.pathname === '/' || url.pathname === '/index.html'
      ? path.join(publicRoot, bundle, 'index.html')
      : path.resolve(publicRoot, '.' + decodeURIComponent(url.pathname));
    const rel = path.relative(publicRoot, asset);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return route.abort();
    try { return await route.fulfill({ path: asset }); } catch { return route.abort(); }
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  return { ctx, page };
}

for (const [bundle, width, height] of [['desktop', 1440, 900], ['tablet', 1024, 768], ['mobile', 390, 844]]) {
  it(`${bundle}: landing menampilkan logo mitra escrow dari setelan platform`, async () => {
    const { ctx, page } = await openLanding(bundle, width, height);
    try {
      await page.goto(origin + '/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);

      const result = await page.evaluate(() => {
        const imgs = [...document.querySelectorAll('img')];
        const logo = imgs.find(i =>
          (i.getAttribute('src') || '').startsWith('data:image/png;base64')
        );
        const body = document.body.innerText;
        return {
          totalImg: imgs.length,
          logoFound: !!logo,
          naturalWidth: logo ? logo.naturalWidth : 0,
          escrowSection: /rekber|escrow/i.test(body),
        };
      });

      assert.ok(result.escrowSection, `${bundle}: section escrow tidak ditemukan di landing`);
      assert.ok(
        result.logoFound,
        `${bundle}: logo mitra tidak dirender (total <img> = ${result.totalImg}); ` +
        `landing memakai ikon generik alih-alih logo dari setelan platform`
      );
      assert.ok(
        result.naturalWidth > 0,
        `${bundle}: elemen <img> logo ada tetapi tidak memuat gambar (naturalWidth=0)`
      );
    } finally {
      await ctx.close();
    }
  });
}
