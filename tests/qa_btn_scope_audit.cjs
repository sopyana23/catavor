#!/usr/bin/env node
/**
 * The other five .btn-back-circle call sites (product detail, admin item,
 * product type selector, about, misc) must keep their 44x44 visual size.
 * They cannot be reached without auth/slug setup, so this probe asserts the
 * CSS contract instead: the --policy modifier exists ONLY on the policy node.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/MyProject/agentA/catavor';
const SRC = path.join(ROOT, 'frontend/mobile/src/App.tsx');
const PUBLIC = path.join(ROOT, 'public/mobile');

(async () => {
  let pass = 0, fail = 0;
  const ok = m => { console.log('  PASS ' + m); pass++; };
  const no = m => { console.log('  FAIL ' + m); fail++; };

  const src = fs.readFileSync(SRC, 'utf8');
  const lines = src.split('\n');
  const backSites = lines.map((l, i) => ({ n: i + 1, l })).filter(x => x.l.includes('className="btn-back-circle'));
  console.log(`\n=== call site btn-back-circle di source: ${backSites.length} ===`);
  let scoped = 0;
  for (const s of backSites) {
    const isScoped = s.l.includes('btn-back-circle--policy');
    console.log(`  line ${s.n}: ${isScoped ? '--policy' : 'polos (44x44)'}`);
    if (isScoped) scoped++;
  }
  scoped === 1 ? ok('tepat 1 call site pakai --policy') : no(`${scoped} call site pakai --policy, harusnya 1`);
  (backSites.length - scoped) === 5 ? ok('5 call site lain tidak tersentuh') : no(`sisa ${backSites.length - scoped}, harusnya 5`);

  // CSS contract: --policy rule must be scoped, never a bare override.
  const css = fs.readFileSync(path.join(ROOT, 'frontend/mobile/src/App.css'), 'utf8');
  const hasVariant = /\.btn-back-circle--policy\s*\{/.test(css);
  const hasHeaderVariant = /\.portal-mobile-header--policy\s*\{/.test(css);
  hasVariant ? ok('.btn-back-circle--policy terdefinisi') : no('.btn-back-circle--policy TIDAK ada');
  hasHeaderVariant ? ok('.portal-mobile-header--policy terdefinisi') : no('.portal-mobile-header--policy TIDAK ada');

  // The base rule must still be 44x44 — the compact size must not have been
  // written into .btn-back-circle itself.
  const baseBlock = css.slice(css.indexOf('.btn-back-circle {'), css.indexOf('.btn-back-circle {') + 400);
  baseBlock.includes('44px') ? ok('.btn-back-circle dasar tetap 44px') : no('.btn-back-circle dasar BUKAN 44px');

  // Served bundle must contain both variants.
  const files = fs.readdirSync(path.join(PUBLIC, 'assets')).filter(f => f.endsWith('.js'));
  const bundle = fs.readFileSync(path.join(PUBLIC, 'assets', files[0]), 'utf8');
  bundle.includes('btn-back-circle--policy') ? ok('variant ada di bundle served') : no('variant TIDAK ada di bundle');
  bundle.includes('portal-mobile-header--policy') ? ok('header variant ada di bundle served') : no('header variant TIDAK ada');

  console.log(`\nTOTAL: ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e.message); process.exit(2); });
