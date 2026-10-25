/* eslint-disable */
/**
 * Harness audit paritas form-factor Catavor.
 * Menjalankan aplikasi LIVE di :8000 untuk 3 device, merekam:
 *  - console error / pageerror
 *  - overflow horizontal
 *  - target sentuh < 44px (khusus tablet & mobile)
 *  - <select> native (dilarang di mobile)
 *  - karakter emoji pada teks yang terlihat (dilarang di UI bisnis)
 *  - inventaris landmark: heading, tab, tombol, filter, paginasi
 * Output: %TEMP%\catavor-qa\{report.json, *.png}
 *
 * Jalankan: node tests/audit/parity-audit.cjs
 */
const { chromium, request } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE = 'http://localhost:8000';
const OUT = path.join(os.tmpdir(), 'catavor-qa');
fs.mkdirSync(OUT, { recursive: true });

const ADMIN = {
  email: process.env.QA_EMAIL || 'e2e-admin@catavor.test',
  password: process.env.QA_PASSWORD || 'E2eTest!2026',
  portal: 'admin',
};
const MERCHANT = {
  email: process.env.QA_MERCHANT_EMAIL || 'fixture-owner@catavor.test',
  password: process.env.QA_MERCHANT_PASSWORD || 'FixtureOwner!E2eTest!2026',
  portal: undefined,
};

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const DEVICES = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, hasTouch: false, ua: undefined, touch: false },
  { name: 'tablet', viewport: { width: 900, height: 1180 }, hasTouch: true, ua: IPAD_UA, touch: true },
  { name: 'mobile', viewport: { width: 390, height: 844 }, hasTouch: true, ua: IPHONE_UA, touch: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(page) {
  return page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
    };
    const txt = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    const uniq = (a) => [...new Set(a.filter(Boolean))];

    const emojiRe = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/u;

    const headings = uniq([...document.querySelectorAll('h1,h2,h3')].filter(vis).map(txt)).slice(0, 30);
    const buttons = [...document.querySelectorAll('button,[role="button"],a[href]')].filter(vis);
    const buttonTexts = uniq(buttons.map(txt)).slice(0, 80);

    const smallTargets = buttons
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { t: txt(el).slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((x) => x.t && (x.w < 44 || x.h < 44))
      .slice(0, 40);

    const textOverflows = buttons
      .filter((el) => {
        const t = txt(el);
        if (!t || t.length > 50) return false;
        // Text overflows width if scrollWidth > clientWidth + 2
        return el.scrollWidth > el.clientWidth + 2;
      })
      .map((el) => ({
        t: txt(el).slice(0, 40),
        scrollW: Math.round(el.scrollWidth),
        clientW: Math.round(el.clientWidth)
      }))
      .slice(0, 20);

    const selects = [...document.querySelectorAll('select')].filter(vis).length;
    const inputs = [...document.querySelectorAll('input,textarea')].filter(vis).length;

    const bodyText = document.body.innerText || '';
    const emojiFound = uniq(bodyText.match(new RegExp(emojiRe.source, 'gu')) || []).slice(0, 20);

    const signals = {
      loadMore: /muat lebih|load more/i.test(bodyText),
      showingRange: /menampilkan\s+\d+\s*[–-]\s*\d+/i.test(bodyText),
      pageNumbers: /\bhal(aman)?\.?\s*\d+\s*(dari|\/)\s*\d+/i.test(bodyText),
      rowsPerPage: /baris per halaman|per halaman/i.test(bodyText),
      prevNext: /sebelumnya|selanjutnya|berikutnya/i.test(bodyText),
      stickyAction: [...document.querySelectorAll('*')].some((el) => {
        const s = getComputedStyle(el);
        return s.position === 'fixed' && el.getBoundingClientRect().bottom > window.innerHeight - 120;
      }),
    };

    const tabs = uniq(
      [...document.querySelectorAll('[role="tab"],[aria-selected],nav a,nav button,[role="tablist"] *')]
        .filter(vis)
        .filter((el) => el.children.length === 0)
        .map(txt)
    ).slice(0, 50);

    // Label navigasi utama: elemen dalam <nav> atau container ber-class nav/rail/sidebar
    const navLabels = uniq(
      [...document.querySelectorAll('nav,header,footer,[class*="sidebar"],[class*="Sidebar"],[class*="rail"],[class*="Rail"],[class*="bottom"]')]
        .filter(vis)
        .flatMap((c) => [...c.querySelectorAll('button,a[role="button"],a')].filter(vis))
        .filter((el) => el.children.length === 0 || (el.innerText || '').length < 40)
        .map(txt)
        .filter((t) => t && t.length < 40)
    ).slice(0, 60);

    const de = document.documentElement;
    return {
      url: location.href,
      title: document.title,
      hasLoginForm: !!document.querySelector('input[type="password"]'),
      loginHeading: (document.querySelector('h1,h2')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      viewport: { w: innerWidth, h: innerHeight },
      overflowX: de.scrollWidth > de.clientWidth + 1 ? de.scrollWidth - de.clientWidth : 0,
      headings,
      tabs,
      navLabels,
      buttonsSample: buttonTexts,
      buttonCount: buttons.length,
      smallTargets,
      smallTargetCount: smallTargets.length,
      textOverflows,
      textOverflowCount: textOverflows.length,
      nativeSelects: selects,
      inputCount: inputs,
      emojiFound,
      signals,
      bodyPreview: bodyText.replace(/\s+/g, ' ').slice(0, 600),
    };
  });
}

async function login(apiCtx, acct) {
  const res = await apiCtx.post('/api/auth/login', {
    data: { email: acct.email, password: acct.password, ...(acct.portal ? { portal: acct.portal } : {}) },
    timeout: 25000,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), token: body.token, user: body.user, message: body.message || body.error || null };
}

async function storesOf(apiCtx, token) {
  if (!token) return [];
  const r = await apiCtx.get('/api/user/stores', { headers: { Authorization: `Bearer ${token}` }, timeout: 25000 });
  const b = await r.json().catch(() => ({}));
  const list = b.stores || b.data || [];
  return Array.isArray(list) ? list : [];
}

/**
 * Bangun storageState = cookie sesi (dari login API) + localStorage token/user,
 * supaya browser benar-benar memakai sesi yang sama dengan login.
 */
async function storageStateFor(apiCtx, auth) {
  const state = await apiCtx.storageState();
  state.origins = [
    {
      origin: BASE,
      localStorage: [
        { name: 'catavor_token', value: auth.token || '' },
        { name: 'catavor_user', value: JSON.stringify(auth.user || {}) },
      ],
    },
  ];
  return state;
}

/** Probe dengan retry: navigasi SPA bisa menghancurkan execution context. */
async function probeStable(page) {
  let lastErr = null;
  for (let i = 0; i < 3; i++) {
    try {
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      return await probe(page);
    } catch (e) {
      lastErr = e;
      await sleep(1500);
    }
  }
  throw lastErr;
}

async function main() {
  const report = { generatedAt: new Date().toISOString(), base: BASE, logins: {}, pages: [] };
  // Konteks terpisah per akun: cookie sesi dari login pertama memicu
  // penolakan CSRF pada login kedua (mutasi + cookie tanpa Origin).
  const adminCtx = await request.newContext({ baseURL: BASE });
  const merchantCtx = await request.newContext({ baseURL: BASE });

  const adminAuth = await login(adminCtx, ADMIN);
  adminAuth._ctx = adminCtx;
  report.logins.admin = { email: ADMIN.email, status: adminAuth.status, message: adminAuth.message };
  const merchantAuth = await login(merchantCtx, MERCHANT);
  merchantAuth._ctx = merchantCtx;
  report.logins.merchant = { email: MERCHANT.email, status: merchantAuth.status, message: merchantAuth.message };

  const adminStores = await storesOf(adminCtx, adminAuth.token);
  const merchantStores = await storesOf(merchantCtx, merchantAuth.token);
  report.stores = {
    admin: adminStores.map((s) => s.slug),
    merchant: merchantStores.map((s) => s.slug),
  };

  const merchantSlug = merchantStores[0] ? merchantStores[0].slug : 'adidas';

  // Rute kanonik konsol pengelola: /admin?tab=... (bukan /{slug}/admin/portal).
  const CONSOLE_TABS = ['dashboard', 'reports', 'support', 'finance', 'stores', 'rbac', 'audit'];

  const ROUTES = [
    { key: 'public-home', path: '/', label: 'Landing publik', auth: null },
    { key: 'store-catalog', path: `/${merchantSlug}`, label: 'Etalase toko', auth: null },
    { key: 'merchant-admin', path: `/${merchantSlug}/admin`, label: 'Admin merchant', auth: merchantAuth },
    ...CONSOLE_TABS.map((t) => ({
      key: 'console-' + t,
      path: `/admin?tab=${t}`,
      label: 'Konsol pengelola: ' + t,
      auth: adminAuth,
    })),
  ];

  for (const dev of DEVICES) {
    const browser = await chromium.launch();
    // storageState sudah memuat cookie sesi + localStorage; dipakai ulang per rute.
    const stateCache = new Map();
    for (const route of ROUTES) {
      // Kunci cache WAJIB token, bukan email: objek auth tidak membawa email,
      // sehingga sesi merchant sempat dipakai ulang untuk konsol pengelola.
      const authKey = route.auth ? route.auth.token : 'anon';
      let storageState;
      if (route.auth && route.auth.token) {
        if (!stateCache.has(authKey)) stateCache.set(authKey, await storageStateFor(route.auth._ctx, route.auth));
        storageState = stateCache.get(authKey);
      }
      const ctx = await browser.newContext({
        viewport: dev.viewport,
        hasTouch: dev.hasTouch,
        isMobile: dev.touch,
        userAgent: dev.ua,
        deviceScaleFactor: 1,
        ...(storageState ? { storageState } : {}),
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text().slice(0, 300));
      });
      page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 300)));

      const url = `${BASE}${route.path}${route.path.includes('?') ? '&' : '?'}view=${dev.name}`;
      const rec = { device: dev.name, route: route.key, label: route.label, requested: url };
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await sleep(3000);
        rec.probe = await probeStable(page);
        rec.finalUrl = rec.probe.url;
        const file = `${dev.name}__${route.key}.png`;
        try {
          await page.screenshot({ path: path.join(OUT, file), fullPage: false, timeout: 20000 });
          rec.screenshot = path.join(OUT, file);
        } catch (se) {
          rec.screenshotError = String(se).slice(0, 160);
        }
      } catch (e) {
        rec.error = String(e).slice(0, 400);
      }
      rec.consoleErrors = [...new Set(errors)].slice(0, 15);
      report.pages.push(rec);
      await ctx.close();
      await sleep(300);
    }
    await browser.close();
  }

  await adminCtx.dispose();
  await merchantCtx.dispose();
  const outFile = path.join(OUT, 'report.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log('REPORT=' + outFile);
  console.log('LOGIN_ADMIN=' + JSON.stringify(report.logins.admin));
  console.log('LOGIN_MERCHANT=' + JSON.stringify(report.logins.merchant));
  console.log('STORES=' + JSON.stringify(report.stores));
  for (const p of report.pages) {
    const pr = p.probe || {};
    console.log(
      [
        p.device.padEnd(8),
        p.route.padEnd(17),
        p.error ? 'ERR:' + p.error.slice(0, 50) : 'ok',
        'ovf=' + (pr.overflowX ?? '?'),
        'btn=' + (pr.buttonCount ?? '?'),
        'small=' + (pr.smallTargetCount ?? '?'),
        'sel=' + (pr.nativeSelects ?? '?'),
        'emoji=' + (pr.emojiFound ? pr.emojiFound.length : '?'),
        'err=' + p.consoleErrors.length,
        (p.finalUrl || '').replace(BASE, ''),
      ].join('  ')
    );
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
