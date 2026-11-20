// Jalankan pada bundle lokal hasil tri-build dengan node --test tests/audit/payment-admin.test.cjs
const { before, after, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { financePage } = require('./fixtures/finance-pages.cjs');

const origin = 'https://payment-admin.invalid';
const publicRoot = path.resolve(__dirname, '../../public');
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function openFinance(t, bundle, width, height, permissions, section, invoices = []) {
  const user = { id: 9, name: 'Staf QA', platform_role: 'finance', is_admin: true, permissions };
  const writes = [];
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
  t.after(() => context.close());
  await context.addInitScript(user => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem('catavor_token', 'fixture.' + payload + '.fixture');
    localStorage.setItem('catavor_user', JSON.stringify(user));
  }, user);
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) {
      if (request.method() !== 'GET') {
        writes.push([request.method(), url.pathname]);
        return route.fulfill({ status: 405, json: { error: 'Fixture baca saja' } });
      }
      if (url.pathname.includes('/stream')) return route.abort();
      let data = [];
      if (url.pathname === '/api/admin/subscription/orders') {
        return route.fulfill({ json: financePage('orders', invoices, url.searchParams) });
      }
      if (url.pathname === '/api/admin/coupons') return route.fulfill({ json: financePage('coupons', [], url.searchParams) });
      if (['/api/admin/settings', '/api/settings'].includes(url.pathname)) data = { payment_system_mode: 'gateway_aulaa' };
      return route.fulfill({ json: { success: true, valid: true, user, data, stores: [] } });
    }
    const asset = url.pathname === '/admin' ? path.resolve(publicRoot, bundle, 'index.html')
      : path.resolve(publicRoot, '.' + decodeURIComponent(url.pathname));
    const relative = path.relative(publicRoot, asset);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return route.abort();
    try { await route.fulfill({ path: asset }); } catch { await route.abort(); }
  });
  const page = await context.newPage();
  await page.goto(origin + '/admin?tab=finance&sub=' + section, { waitUntil: 'networkidle' });
  const nav = page.getByRole('navigation', { name: 'Bagian pembayaran' });
  await nav.waitFor();
  return { page, nav, writes };
}

for (const [bundle, width, height] of [['mobile', 375, 812], ['tablet', 800, 1024], ['desktop', 1280, 800]]) {
  it(bundle + ' membuka tautan subtab, mendukung keyboard, dan hanya menyimpan atas perintah', async t => {
    const { page, nav, writes } = await openFinance(t, bundle, width, height,
      ['finance:orders:read', 'finance:orders:manage', 'system:settings:manage'], 'settings');
    const gateway = page.getByRole('radio', { name: /Gateway Aulaa/i });
    const manual = page.getByRole('radio', { name: /QRIS dan transfer/i });
    assert.equal(await gateway.isChecked(), true);
    const before = writes.length;
    await gateway.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await manual.isChecked(), true);
    await nav.getByRole('button', { name: 'Kupon' }).click();
    assert.equal(new URL(page.url()).searchParams.get('sub'), 'coupons');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await nav.getByRole('button', { name: 'Kupon' }).getAttribute('aria-current'), 'page');
    await page.goBack({ waitUntil: 'commit' });
    await gateway.waitFor();
    assert.equal(await nav.getByRole('button', { name: 'Pengaturan' }).getAttribute('aria-current'), 'page');
    assert.deepEqual(writes.slice(before).filter(([, url]) => url.includes('settings') || url.includes('payments')), []);
  });
  it(bundle + ' membatasi tautan pengaturan untuk staf baca transaksi', async t => {
    const { nav } = await openFinance(t, bundle, width, height, ['finance:orders:read'], 'settings');
    assert.equal(await nav.getByRole('button', { name: 'Pengaturan' }).count(), 0);
    assert.equal(await nav.getByRole('button', { name: /Transaksi/ }).getAttribute('aria-current'), 'page');
  });
  it(bundle + ' mengenali QRIS gateway sebelum referensi diterima dan menerima respons JSON', async t => {
    const invoice = { id: 11, order_number: 'INV-QA-11', original_amount: 99000, final_amount: 99000,
      payment_mode: 'gateway_aulaa', payment_method: 'qris', payment_status: 'pending',
      gateway_raw_response: { status: 'pending' }, created_at: '2026-11-01T00:00:00Z' };
    const { page } = await openFinance(t, bundle, width, height, ['finance:orders:read'], 'orders', [invoice]);
    const selector = page.getByRole('button', { name: 'Metode pembayaran', exact: true });
    await selector.click();
    const options = page.getByRole('listbox').or(page.getByRole('dialog')).last();
    assert.match(await options.innerText(), /Gateway Aulaa/i);
    assert.doesNotMatch(await options.innerText(), /QRIS manual|Kupon gratis/i);
  });
}
