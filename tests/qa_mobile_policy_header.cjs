#!/usr/bin/env node
/**
 * Policy-only header compaction — verification.
 *
 * A previous version of this probe reported a false leak on "/" because the
 * home header legitimately has NO back button; the probe read querySelector's
 * null as "still 36px" and blamed the CSS. This version enumerates every
 * header and every back button explicitly and never infers from a stale value.
 *
 * Measures two independent things:
 *  - VISUAL size   : the painted circle
 *  - TOUCH TARGET  : the ::before overlay (WCAG 2.5.5/2.5.8 wants 44x44)
 */
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8001';
const UA_M = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const POLICY = ['/terms', '/privacy', '/acceptable-use'];
const OTHER = [{ url: '/', expectBack: false }];

(async () => {
  const browser = await chromium.launch();
  let pass = 0, fail = 0;
  const ok = m => { console.log('  PASS ' + m); pass++; };
  const no = m => { console.log('  FAIL ' + m); fail++; };

  const measure = async (url) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA_M, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1600);
    const d = await page.evaluate(() => {
      const hdr = [...document.querySelectorAll('.portal-mobile-header')][0] || null;
      const btns = [...document.querySelectorAll('.btn-back-circle')];
      const btn = btns[0] || null;
      let visual = null, pseudo = null, edge = null;
      if (btn) {
        const bb = btn.getBoundingClientRect();
        visual = { w: Math.round(bb.width), h: Math.round(bb.height) };
        const cs = getComputedStyle(btn, '::before');
        pseudo = { w: Math.round(parseFloat(cs.width) || 0), h: Math.round(parseFloat(cs.height) || 0) };
        // Hit-test the outer ring of the supposed 44px overlay.
        const cx = bb.left + bb.width / 2, cy = bb.top + bb.height / 2;
        const top = document.elementFromPoint(cx, cy - 21);
        const left = document.elementFromPoint(cx - 21, cy);
        edge = {
          top: !!(top && (top === btn || btn.contains(top) || top.closest('.btn-back-circle'))),
          left: !!(left && (left === btn || btn.contains(left) || left.closest('.btn-back-circle'))),
        };
      }
      return {
        headerCount: document.querySelectorAll('.portal-mobile-header').length,
        headerCls: hdr ? hdr.className : null,
        headerH: hdr ? Math.round(hdr.getBoundingClientRect().height) : null,
        backCount: btns.length,
        btnCls: btn ? btn.className : null,
        visual, pseudo, edge,
        usable: hdr ? Math.round(innerHeight - hdr.getBoundingClientRect().height) : null,
      };
    });
    await ctx.close();
    return d;
  };

  console.log('\n=== HALAMAN POLICY: ringkas, ter-scope, aksesibel ===');
  for (const url of POLICY) {
    const d = await measure(url);
    console.log(`\n-- ${url}   header=${d.headerH}px  usable=${d.usable}px`);
    if (d.headerCount !== 1) { no(`header count ${d.headerCount}, harusnya 1`); continue; }
    (d.headerCls || '').includes('portal-mobile-header--policy') ? ok('header pakai --policy') : no('header TANPA --policy');
    d.backCount === 1 ? ok('1 tombol back') : no(`tombol back ${d.backCount}`);
    if (d.visual) {
      d.visual.w === 36 && d.visual.h === 36 ? ok('visual 36x36') : no(`visual ${d.visual.w}x${d.visual.h}`);
      d.pseudo && d.pseudo.w === 44 && d.pseudo.h === 44 ? ok('touch target 44x44') : no(`touch ${JSON.stringify(d.pseudo)}`);
      d.edge && d.edge.top && d.edge.left ? ok('hit-test 44px lulus (atas + kiri)') : no(`hit-test gagal ${JSON.stringify(d.edge)}`);
    } else no('tombol back tidak ditemukan');
    d.headerH <= 56 ? ok(`header ringkas (${d.headerH}px <= 56)`) : no(`header ${d.headerH}px, target <=56`);
  }

  console.log('\n=== HALAMAN LAIN: tidak boleh berubah ===');
  for (const { url, expectBack } of OTHER) {
    const d = await measure(url);
    console.log(`\n-- ${url}   header=${d.headerH}px`);
    if (d.headerCount !== 1) { no(`header count ${d.headerCount}`); continue; }
    !(d.headerCls || '').includes('--policy') ? ok('header TANPA --policy (tidak bocor)') : no('header BOCOR --policy');
    expectBack ? null : (d.backCount === 0 ? ok('memang tidak punya tombol back') : no(`ada ${d.backCount} tombol back tak terduga`));
    d.headerH === 54 ? ok('header tetap 54px') : no(`header berubah jadi ${d.headerH}px`);
  }

  console.log(`\nTOTAL: ${pass}/${pass + fail}`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e.message); process.exit(2); });
