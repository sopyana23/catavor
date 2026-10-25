/* eslint-disable */
/**
 * Audit terfokus: KONSOL PENGELOLA PLATFORM (/admin?tab=...)
 * Tujuan: membuktikan apakah ketiga device punya KONTRAK DEEP-LINK & INVENTARIS
 * MODUL yang sama, dengan mobile sebagai acuan.
 *
 * Untuk setiap alias tab, catat view yang benar-benar dirender (heading + label
 * nav aktif). Alias yang diabaikan akan jatuh ke dashboard -> terlihat sebagai
 * "MELESET" pada matriks.
 *
 * Output: qa-report/console-deeplink.md + console-deeplink.json
 * Jalankan: node tests/audit/console-parity.cjs
 */
const { chromium, request } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8000';
const OUTDIR = path.join('C:', 'MyProject', 'DFauna', 'qa-report');
const ADMIN = {
  email: process.env.QA_EMAIL || 'e2e-admin@catavor.test',
  password: process.env.QA_PASSWORD || 'E2eTest!2026',
  portal: 'admin',
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

// Alias = nilai ?tab= yang mungkin dipakai tautan bersama (WA/email/bookmark).
const ALIASES = [
  'dashboard',
  'rbac',
  'staff',
  'roles',
  'stores',
  'reports',
  'support',
  'helpdesk',
  'finance',
  'monetization',
  'broadcast',
  'automation',
  'bot',
  'master_data',
  'master-data',
  'domains',
  'audit',
  'safe_domains',
  'tidak-ada-modul-ini', // kontrol: wajib jatuh ke dashboard
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readView(page) {
  return page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const txt = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();

    const headings = [...document.querySelectorAll('h1,h2')].filter(vis).map(txt).slice(0, 4);

    // Label nav aktif (aria-current / aria-selected / class aktif)
    const activeNav = [
      ...document.querySelectorAll(
        '[aria-current="page"],[aria-current="true"],[aria-selected="true"],[class*="active"],[class*="Active"]'
      ),
    ]
      .filter(vis)
      .map(txt)
      .filter((t) => t && t.length < 45)
      .slice(0, 6);

    // Inventaris modul yang bisa dijangkau dari UI
    const navPool = [
      ...document.querySelectorAll('nav,header,aside,footer,[class*="sidebar"],[class*="Sidebar"],[class*="rail"],[class*="Rail"],[class*="Nav"],[class*="nav"]'),
    ]
      .filter(vis)
      .flatMap((c) => [...c.querySelectorAll('button,a[role="button"],a')].filter(vis));

    const moduleLabels = [...new Set(navPool.map(txt).filter((t) => t && t.length > 1 && t.length < 45))].slice(0, 40);

    return {
      url: location.href,
      headings,
      activeNav,
      moduleLabels,
      hasLoginForm: !!document.querySelector('input[type="password"]'),
      bodyStart: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 160),
    };
  });
}

async function main() {
  const apiCtx = await request.newContext({ baseURL: BASE });
  const loginRes = await apiCtx.post('/api/auth/login', {
    data: { email: ADMIN.email, password: ADMIN.password, portal: ADMIN.portal },
    timeout: 25000,
  });
  const loginBody = await loginRes.json();
  const state = await apiCtx.storageState();
  state.origins = [
    {
      origin: BASE,
      localStorage: [
        { name: 'catavor_token', value: loginBody.token || '' },
        { name: 'catavor_user', value: JSON.stringify(loginBody.user || {}) },
      ],
    },
  ];

  const results = [];
  const inventory = {};

  for (const dev of DEVICES) {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({
      viewport: dev.viewport,
      hasTouch: dev.hasTouch,
      isMobile: dev.touch,
      userAgent: dev.ua,
      deviceScaleFactor: 1,
      storageState: state,
    });
    const page = await ctx.newPage();

    // 1. Dashboard awal -> inventaris modul
    await page.goto(`${BASE}/admin?view=${dev.name}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(3500);
    inventory[dev.name] = await readView(page);

    // 2. Uji setiap alias
    for (const alias of ALIASES) {
      const url = `${BASE}/admin?tab=${alias}&view=${dev.name}`;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await sleep(2200);
        const v = await readView(page);
        results.push({ device: dev.name, alias, ok: true, ...v });
      } catch (e) {
        results.push({ device: dev.name, alias, ok: false, error: String(e).slice(0, 200) });
      }
    }
    await ctx.close();
    await browser.close();
  }
  await apiCtx.dispose();

  // --- Bangun matriks: view yang dirender per alias per device ---
  const byAlias = {};
  for (const r of results) {
    byAlias[r.alias] = byAlias[r.alias] || {};
    byAlias[r.alias][r.device] = r;
  }

  const sig = (r) => (r && r.ok ? (r.headings[0] || '(tanpa heading)') : 'ERROR');
  const isFallback = (r) => {
    if (!r || !r.ok) return true;
    const h = (r.headings[0] || '').toLowerCase();
    return h.includes('ringkasan eksekutif') || h.includes('ringkasan platform') || h.includes('catavor executive');
  };

  const lines = [];
  const P = (s = '') => lines.push(s);
  P('# Audit Deep-Link Konsol Pengelola (Admin Pengelola Platform)');
  P('');
  P(`Dibuat: ${new Date().toISOString()}`);
  P(`Login: ${loginRes.status()} — ${loginBody.message || ''} (${ADMIN.email})`);
  P('');
  P('## 1. Matriks alias ?tab= → view yang benar-benar dirender');
  P('');
  P('Nilai "JATUH KE DASHBOARD" berarti alias diabaikan (bukan modulnya).');
  P('');
  P('| ?tab= | Desktop | Tablet | Mobile | Selaras? |');
  P('|---|---|---|---|---|');
  for (const alias of ALIASES) {
    const d = byAlias[alias].desktop;
    const t = byAlias[alias].tablet;
    const m = byAlias[alias].mobile;
    const vals = [sig(d), sig(t), sig(m)].map((s) => s.replace(/\|/g, '/'));
    const fallbacks = [isFallback(d), isFallback(t), isFallback(m)];
    const allSame = vals[0] === vals[1] && vals[1] === vals[2];
    const sameFallback = fallbacks.every((x) => x === fallbacks[0]);
    let verdict;
    if (alias === 'tidak-ada-modul-ini') verdict = fallbacks.every(Boolean) ? 'OK (kontrol)' : 'TIDAK KONSISTEN';
    else if (allSame) verdict = 'selaras';
    else if (sameFallback && fallbacks[0]) verdict = 'SERAGAM GAGAL';
    else verdict = '**BEDA**';
    const cell = (v, fb) => (fb ? '*(dashboard)*' : v);
    P(`| ${alias} | ${cell(vals[0], fallbacks[0])} | ${cell(vals[1], fallbacks[1])} | ${cell(vals[2], fallbacks[2])} | ${verdict} |`);
  }
  P('');

  P('## 2. Inventaris modul yang dapat dijangkau dari UI');
  P('');
  for (const dev of DEVICES) {
    const inv = inventory[dev.name] || {};
    P(`### ${dev.name}`);
    P('');
    P(`- Heading: ${(inv.headings || []).join(' | ') || '(kosong)'}`);
    P(`- Nav aktif: ${(inv.activeNav || []).join(' · ') || '(kosong)'}`);
    P(`- Label modul terdeteksi (${(inv.moduleLabels || []).length}): ${(inv.moduleLabels || []).join(' · ') || '(kosong)'}`);
    P('');
  }

  P('## 3. Detail per alias (heading + 120 karakter awal)');
  P('');
  for (const alias of ALIASES) {
    P(`### ?tab=${alias}`);
    P('');
    for (const dev of DEVICES) {
      const r = byAlias[alias][dev.name];
      if (!r) continue;
      P(`- **${dev.name}**: ${r.ok ? (r.headings[0] || '(kosong)') + ' — ' + r.bodyStart.slice(0, 110) : 'ERROR ' + r.error}`);
    }
    P('');
  }

  fs.mkdirSync(OUTDIR, { recursive: true });
  fs.writeFileSync(path.join(OUTDIR, 'console-deeplink.md'), lines.join('\n'), 'utf8');
  fs.writeFileSync(path.join(OUTDIR, 'console-deeplink.json'), JSON.stringify({ login: loginRes.status(), inventory, results }, null, 2), 'utf8');

  console.log('OUT=' + path.join(OUTDIR, 'console-deeplink.md'));
  for (const alias of ALIASES) {
    const d = byAlias[alias].desktop, t = byAlias[alias].tablet, m = byAlias[alias].mobile;
    console.log(
      `${alias.padEnd(22)} D:${(sig(d) || '').slice(0, 26).padEnd(28)} T:${(sig(t) || '').slice(0, 26).padEnd(28)} M:${(sig(m) || '').slice(0, 26)}`
    );
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
