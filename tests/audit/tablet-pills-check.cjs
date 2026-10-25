/* eslint-disable */
/**
 * Pemeriksaan terarah baris pill filter tablet.
 * Mendeteksi TIGA mode kegagalan yang lolos dari pengukuran ukuran kotak:
 *   1. TEKS MELUBER  : scrollWidth > clientWidth (teks tidak muat di kotaknya)
 *   2. TUMPANG TINDIH: dua saudara sekontainer saling beririsan
 *   3. TERPOTONG     : tombol melewati batas kontainer yang memotong luapan
 * Hasil + screenshot: qa-report/evidence/verify-<tab>.png
 *
 * Jalankan: node tests/audit/tablet-pills-check.cjs
 */
const { chromium, request } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8000';
const OUT = path.join('C:', 'MyProject', 'DFauna', 'qa-report', 'evidence');
const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const TABS = ['reports', 'support', 'finance', 'audit'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function inspect(page) {
  return page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const label = (el) => (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30);
    const buttons = [...document.querySelectorAll('button,[role="button"]')].filter(vis);

    // 1. teks meluber keluar kotak
    const textOverflow = buttons
      .filter((el) => el.scrollWidth > el.clientWidth + 2)
      .map((el) => ({ label: label(el), scrollW: el.scrollWidth, clientW: el.clientWidth }));

    // 2. saudara sekontainer saling beririsan
    const byParent = new Map();
    for (const b of buttons) {
      const p = b.parentElement;
      if (!p) continue;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p).push(b);
    }
    const overlaps = [];
    for (const group of byParent.values()) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i].getBoundingClientRect();
          const b = group[j].getBoundingClientRect();
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 1 && oy > 1) {
            overlaps.push({
              a: label(group[i]),
              b: label(group[j]),
              overlapPx: Math.round(Math.min(ox, oy)),
            });
          }
        }
      }
    }

    // 3. Uji behavioral: dapatkah elemen benar-benar disentuh?
    //    Geometri saja ambigu (baris bisa digeser vs terpotong). Jadi: scroll ke
    //    elemen, lalu hit-test titik tengahnya. Bila elemen lain yang tertangkap,
    //    berarti ia tertutup/terpotong dan TIDAK bisa dipakai.
    const unreachable = [];
    const scrollableRows = [...document.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el);
      return vis(el) && s.overflowX === 'auto';
    }).length;

    for (const b of buttons) {
      b.scrollIntoView({ block: 'nearest', inline: 'center' });
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const inView = cx >= 0 && cx <= window.innerWidth && cy >= 0 && cy <= window.innerHeight;
      const hit = inView ? document.elementFromPoint(cx, cy) : null;
      const ok = !!hit && (hit === b || b.contains(hit) || hit.contains(b));
      if (!ok) unreachable.push({ label: label(b), w: Math.round(r.width), h: Math.round(r.height), inView, hitTag: hit ? hit.tagName : null });
    }

    const scrollRows = [...document.querySelectorAll('*')]
      .filter((el) => {
        const s = getComputedStyle(el);
        return vis(el) && s.overflowX === 'auto' && el.scrollWidth > el.clientWidth + 2;
      })
      .map((el) => ({ scrollW: el.scrollWidth, clientW: el.clientWidth, scrollable: true }));

    return {
      url: location.href,
      headings: [...document.querySelectorAll('h1,h2')].filter(vis).map(label).slice(0, 2),
      textOverflow,
      overlaps,
      unreachable,
      scrollableRows,
      scrollRows,
      pillLabels: buttons.filter((b) => b.getBoundingClientRect().height >= 44).map(label).slice(0, 20),
    };
  });
}

async function main() {
  const api = await request.newContext({ baseURL: BASE });
  const res = await api.post('/api/auth/login', {
    data: { email: 'e2e-admin@catavor.test', password: 'E2eTest!2026', portal: 'admin' },
    timeout: 25000,
  });
  const body = await res.json();
  if (!body.token) {
    console.error('LOGIN GAGAL', res.status(), body.message);
    process.exit(1);
  }
  const state = await api.storageState();
  state.origins = [
    {
      origin: BASE,
      localStorage: [
        { name: 'catavor_token', value: body.token },
        { name: 'catavor_user', value: JSON.stringify(body.user || {}) },
      ],
    },
  ];

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 900, height: 1180 },
    hasTouch: true,
    isMobile: true,
    userAgent: IPAD_UA,
    deviceScaleFactor: 1,
    storageState: state,
  });
  const page = await ctx.newPage();
  fs.mkdirSync(OUT, { recursive: true });

  let fail = 0;
  for (const tab of TABS) {
    await page.goto(`${BASE}/admin?tab=${tab}&view=tablet`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(3200);
    // Screenshot HARUS sebelum inspect(): inspect() memanggil scrollIntoView
    // yang menggeser baris, sehingga tangkapan layar tidak lagi mewakili
    // posisi awal halaman.
    await page.screenshot({ path: path.join(OUT, `verify-${tab}.png`), timeout: 20000 });
    const r = await inspect(page);
    const bad = r.textOverflow.length + r.overlaps.length + r.unreachable.length;
    if (bad > 0) fail++;
    console.log(`\n=== ${tab} :: ${r.headings.join(' | ')}`);
    console.log(`  teks meluber  : ${r.textOverflow.length} ${r.textOverflow.map((x) => `${x.label}(${x.scrollW}>${x.clientW})`).join(', ')}`);
    console.log(`  tumpang tindih: ${r.overlaps.length} ${r.overlaps.map((x) => `${x.a} X ${x.b}(${x.overlapPx}px)`).join(', ')}`);
    console.log(`  TIDAK tersentuh: ${r.unreachable.length} ${r.unreachable.map((x) => `${x.label}[${x.w}x${x.h}]${x.inView ? '' : '(luar viewport)'}`).join(', ')}`);
    console.log(`  baris geser horizontal: ${r.scrollRows.length}`);
  }
  await ctx.close();
  await browser.close();
  await api.dispose();
  console.log(`\nRINGKASAN: ${fail === 0 ? 'BERSIH (0 kegagalan tata letak)' : fail + ' tab masih bermasalah'}`);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
