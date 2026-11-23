#!/usr/bin/env node
/**
 * AUDIT v2 — which policy document does each route actually render?
 *
 * v1 was wrong: it matched keywords against the page h1, which is the generic
 * "Pedoman Legal..." shell title on every route. Here we read the active
 * document's own <h2>/<h3> headings plus its pill index, which are unique
 * per document.
 */
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8001';

const UA_M = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_T = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_D = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const DEVICES = {
  mobile:  { vp: { width: 390, height: 844 },  ua: UA_M, mobile: true },
  tablet:  { vp: { width: 1024, height: 1366 }, ua: UA_T, mobile: true },
  desktop: { vp: { width: 1440, height: 900 }, ua: UA_D, mobile: false },
};

// route -> the document it MUST open
const ROUTES = [
  { path: '/terms',                 want: 'terms',          marker: /Syarat & Ketentuan Layanan/i },
  { path: '/syarat-ketentuan',      want: 'terms',          marker: /Syarat & Ketentuan Layanan/i },
  { path: '/privacy',               want: 'privacy',        marker: /Kebijakan Privasi.*Pelindungan Data/i },
  { path: '/kebijakan-privasi',     want: 'privacy',        marker: /Kebijakan Privasi.*Pelindungan Data/i },
  { path: '/acceptable-use',        want: 'acceptable_use', marker: /Larangan Produk|Penggunaan yang Diperbolehkan/i },
  { path: '/ketentuan-penggunaan',  want: 'acceptable_use', marker: /Larangan Produk|Penggunaan yang Diperbolehkan/i },
  { path: '/prohibited',            want: 'prohibited',     marker: /Standar Komoditas Terlarang/i },
  { path: '/barang-terlarang',      want: 'prohibited',     marker: /Standar Komoditas Terlarang/i },
  { path: '/moderation',            want: 'moderation',     marker: /Standar Penegakan Moderasi/i },
  { path: '/standar-moderasi',      want: 'moderation',     marker: /Standar Penegakan Moderasi/i },
  { path: '/transactions',          want: 'transactions',   marker: /Pedoman Transaksi Aman.*Rekber Syariah/i },
  { path: '/pedoman-transaksi',     want: 'transactions',   marker: /Pedoman Transaksi Aman.*Rekber Syariah/i },
  { path: '/subscription',          want: 'subscription',   marker: /Ketentuan Langganan Merchant/i },
  { path: '/ketentuan-langganan',   want: 'subscription',   marker: /Ketentuan Langganan Merchant/i },
];

(async () => {
  const browser = await chromium.launch();
  let totalFail = 0;

  for (const devName of Object.keys(DEVICES)) {
    const dev = DEVICES[devName];
    const ctx = await browser.newContext({
      viewport: dev.vp, userAgent: dev.ua,
      hasTouch: dev.mobile, isMobile: dev.mobile,
    });
    await ctx.addCookies([{ name: 'catavor_device', value: devName, url: BASE }]);
    const page = await ctx.newPage();

    let ok = 0;
    const bad = [];
    for (const r of ROUTES) {
      await page.goto(BASE + r.path, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(700);

      const seen = await page.evaluate(() => {
        const txt = el => (el && el.textContent ? el.textContent.trim() : '');
        // Document titles are h2/h3 inside the reader, NOT the shell h1.
        const heads = Array.from(document.querySelectorAll('h2,h3')).map(txt).filter(Boolean);
        return { heads, bodyLen: (document.body.innerText || '').length };
      });

      const joined = seen.heads.join(' | ');
      const pass = r.marker.test(joined) && seen.bodyLen > 400;
      if (pass) ok++; else bad.push(`${r.path} want=${r.want} heads=${JSON.stringify(seen.heads.slice(0, 2))}`);
    }

    totalFail += bad.length;
    console.log(`\n${devName}: ${ok}/${ROUTES.length} correct`);
    bad.forEach(b => console.log('   FAIL ' + b));
    await ctx.close();
  }

  await browser.close();
  console.log(`\nTOTAL: ${ROUTES.length * 3 - totalFail}/${ROUTES.length * 3} routes render the right document`);
  process.exitCode = totalFail === 0 ? 0 : 1;
})();
