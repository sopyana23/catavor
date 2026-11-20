// Build public/{mobile,tablet,desktop} sebelum menjalankan node --test tests/audit/finance-paging.test.cjs.
const { before, after, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { financePage } = require('./fixtures/finance-pages.cjs');

const origin = 'https://finance-paging.invalid';
const publicRoot = path.resolve(__dirname, '../../public');
const routes = { orders: '/api/admin/subscription/orders', coupons: '/api/admin/coupons' };
const date = '2026-11-01T00:00:00Z';
const key = id => String(id).padStart(3, '0');
const orders = Array.from({ length: 137 }, (_, index) => {
  const id = index + 1;
  const gateway = id > 120;
  return {
    id, store_id: id, user_id: id, order_number: 'INV-PAGING-' + key(id),
    store: { id, store_title: 'Toko ' + key(id), slug: 'toko-' + id },
    user: { id, name: 'Merchant ' + id }, original_amount: 50000, final_amount: 50000,
    payment_method: gateway ? 'qris' : 'bank', payment_mode: gateway ? 'gateway_aulaa' : 'manual_qris',
    payment_status: gateway ? 'paid' : 'pending', plan_code: 'pro_starter', created_at: date,
  };
});
const coupons = orders.map(({ id }) => ({
  id: String(id), code: 'KUPON-' + key(id), label: 'Kupon ' + id, discount: 5000,
  type: id > 120 ? 'free' : 'discount', is_active: id > 120, usage_limit: 10, used_count: 0, created_at: date,
}));

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function visit(t, bundle, width, height, section) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: bundle !== 'desktop', serviceWorkers: 'block' });
  t.after(() => context.close());
  const user = { id: 42, name: 'Staf QA', platform_role: 'finance', is_admin: true,
    permissions: ['finance:orders:read', 'finance:orders:manage', 'finance:settings:manage', 'system:settings:manage'] };
  await context.addInitScript(user => {
    localStorage.setItem('catavor_token', 'fixture.' + btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 })) + '.fixture');
    localStorage.setItem('catavor_user', JSON.stringify(user));
  }, user);
  const reads = [];
  const settingsReads = [];
  await context.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) {
      if (req.method() !== 'GET') return route.fulfill({ status: 405, json: { error: 'Fixture baca saja' } });
      if (url.pathname.includes('/stream')) return route.abort();
      const entry = Object.entries(routes).find(([, endpoint]) => url.pathname === endpoint);
      if (entry) {
        reads.push({ section: entry[0], params: Object.fromEntries(url.searchParams) });
        return route.fulfill({ json: financePage(entry[0], entry[0] === 'orders' ? orders : coupons, url.searchParams) });
      }
      if (url.pathname === '/api/admin/settings') settingsReads.push(Object.fromEntries(url.searchParams));
      const data = ['/api/settings', '/api/admin/settings'].includes(url.pathname) ? { payment_system_mode: 'gateway_aulaa' } : [];
      return route.fulfill({ json: { success: true, valid: true, user, data, stores: [] } });
    }
    const asset = url.pathname === '/admin' ? path.join(publicRoot, bundle, 'index.html') : path.resolve(publicRoot, '.' + decodeURIComponent(url.pathname));
    const relative = path.relative(publicRoot, asset);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return route.abort();
    try { return await route.fulfill({ path: asset }); } catch { return route.abort(); }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.goto(origin + '/admin?tab=finance&sub=' + section, { waitUntil: 'networkidle' });
  await page.getByRole('navigation', { name: 'Bagian pembayaran' }).waitFor();
  return { page, reads, settingsReads };
}

function isListRead(call) {
  return !(call.params.summary || call.params.summary_only || call.params.view === 'summary');
}

async function queryByUI(page, section, changes, act) {
  const response = page.waitForResponse(res => {
    const url = new URL(res.url());
    return url.pathname === routes[section] && Object.entries(changes).every(([k, v]) => url.searchParams.get(k) === v);
  });
  await Promise.all([response, act()]);
}

// Gunakan roda atau sapuan sungguhan di panel yang menaungi sasaran (master list pada tablet).
// click()/scrollIntoViewIfNeeded() dapat melewati kesalahan CSS overflow:hidden.
async function reachByScrolling(page, target, touch) {
  const inspect = () => target.evaluate(el => {
    const rect = el.getBoundingClientRect();
    let clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    let scrollBox;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const overflow = getComputedStyle(p).overflowY;
      if (overflow === 'visible') continue;
      const b = p.getBoundingClientRect();
      clip = { left: Math.max(clip.left, b.left), right: Math.min(clip.right, b.right),
        top: Math.max(clip.top, b.top), bottom: Math.min(clip.bottom, b.bottom) };
      if (!scrollBox && /auto|scroll/.test(overflow) && p.scrollHeight > p.clientHeight + 2) scrollBox = b;
    }
    const area = scrollBox || { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const y = rect.top + rect.height / 2;
    const x = Math.min(innerWidth - 8, Math.max(8, rect.left + rect.width / 2));
    const hit = y > clip.top && y < clip.bottom ? document.elementFromPoint(x, y) : null;
    return { visible: !!hit && (el.contains(hit) || hit.contains(el)), up: rect.bottom < clip.top,
      x: Math.max(8, (Math.max(0, area.left) + Math.min(innerWidth, area.right)) / 2),
      top: Math.max(0, area.top), bottom: Math.min(innerHeight, area.bottom) };
  });
  const session = touch ? await page.context().newCDPSession(page) : null;
  try {
    for (let i = 0; i < 24; i++) {
      const b = await inspect();
      if (b.visible) return;
      const low = b.top + (b.bottom - b.top) * .35;
      const high = b.top + (b.bottom - b.top) * .75;
      if (touch) {
        const start = b.up ? low : high, end = b.up ? high : low;
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x, y: start }] });
        for (let step = 1; step <= 5; step++) await session.send('Input.dispatchTouchEvent',
          { type: 'touchMove', touchPoints: [{ x: b.x, y: start + (end - start) * step / 5 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(b.x, high);
        await page.mouse.wheel(0, (b.up ? -1 : 1) * 1700);
      }
      await page.waitForTimeout(90); // tunggu compositor menerapkan scroll sebelum mengukur
    }
    assert.fail('Sasaran tidak terjangkau dengan scroll: ' + (await target.innerText()).slice(0, 80));
  } finally { await session?.detach(); }
}

const widths = [['mobile', 375, 812], ['mobile', 390, 844], ['tablet', 800, 1024], ['tablet', 960, 800], ['desktop', 1280, 800], ['desktop', 1600, 900]];
for (const [bundle, width, height] of widths) {
  for (const section of ['orders', 'coupons']) {
    it(width + ' ' + section + ' menggulir, berpindah halaman, lalu mencari di seluruh data', async t => {
      const { page, reads } = await visit(t, bundle, width, height, section);
      const initial = reads.filter(call => call.section === section && isListRead(call));
      assert.equal(initial.length, 1, 'Satu kunjungan hanya memerlukan satu pembacaan daftar aktif');
      if (section === 'orders') assert.equal(reads.length, 1, 'Ringkasan sudah tersedia di respons transaksi');
      assert.deepEqual(reads.filter(isListRead).filter(c => !c.params.limit), [],
        'Membuka tab tidak boleh memuat koleksi penuh, termasuk koleksi milik tab lain');
      assert.ok(initial.length > 0 && initial.every(c => Number(c.params.limit) >= 1 && Number(c.params.limit) <= 100),
        'Daftar harus selalu meminta limit terukur: ' + JSON.stringify(initial));
      const limit = Number(initial.at(-1).params.limit);
      const prefix = section === 'orders' ? 'INV-PAGING-' : 'KUPON-';
      const item = id => page.getByText(new RegExp('^#?' + prefix + key(id) + '$')).first();
      await item(limit).waitFor();
      assert.equal(await item(limit + 1).count(), 0);
      await reachByScrolling(page, item(limit), width === 800);
      const next = page.getByRole('button', { name: /berikut|selanjutnya|muat lebih banyak/i }).last();
      await queryByUI(page, section, { page: '2' }, () => next.click());
      await item(limit + 1).waitFor();
      const search = page.getByPlaceholder(section === 'orders' ? /cari.*(?:invoice|transaksi)/i : /cari.*kupon/i).first();
      const beforeSearch = reads.length;
      await queryByUI(page, section, { q: prefix + '136' }, async () => {
        await search.fill(prefix);
        await search.pressSequentially('136', { delay: 20 });
      });
      await item(136).waitFor();
      const requested = reads.slice(beforeSearch).filter(c => c.section === section && c.params.q);
      assert.deepEqual(requested.map(c => c.params.q), [prefix + '136']);
      assert.equal(Number(requested[0].params.page || 1), 1);
      assert.equal(await item(137).count(), 0);
      assert.equal(await item(limit + 1).count(), 0);
      assert.ok(!await next.count() || await next.isDisabled(), 'Satu hasil tidak mempunyai halaman berikutnya');
    });
  }
  it(width + ' filter metode mencapai data di luar halaman dan memakai facet server', async t => {
    const { page } = await visit(t, bundle, width, height, 'orders');
    await page.getByRole('button', { name: 'Metode pembayaran', exact: true }).click();
    const menu = page.getByRole('listbox').or(page.getByRole('dialog')).last();
    const gateway = menu.getByText('Gateway Aulaa', { exact: true });
    await gateway.waitFor({ state: 'visible' });
    assert.doesNotMatch(await menu.innerText(), /Kupon gratis/);
    await queryByUI(page, 'orders', { channel: 'gateway_aulaa' }, () => gateway.click());
    await page.getByText(/^#?INV-PAGING-121$/).first().waitFor();
    assert.equal(await page.getByText(/^#?INV-PAGING-001$/).count(), 0);
  });
  it(width + ' pengaturan dapat digulir sampai webhook tanpa mengambil koleksi utuh', async t => {
    const { page, reads, settingsReads } = await visit(t, bundle, width, height, 'settings');
    const webhook = page.getByText('/api/payments/webhook/aulaa', { exact: false }).first();
    await webhook.waitFor();
    await reachByScrolling(page, webhook, width === 800);
    assert.deepEqual(reads.filter(isListRead), [], 'Pengaturan tidak memerlukan baris transaksi atau kupon');
    assert.ok(settingsReads.every(query => query.exclude?.split(',').includes('master_coupons')),
      'Respons pengaturan admin tidak boleh mengunduh koleksi kupon');
  });
}

for (const [device, width, height] of widths) it('kupon ' + width + ' menggabungkan status, jenis, dan keyword dalam satu query server', async t => {
  const { page, reads } = await visit(t, device, width, height, 'coupons');
  async function setFilter(name, option, changes) {
    await page.getByRole('button', { name, exact: true }).click();
    const popup = page.getByRole('listbox').or(page.getByRole('dialog')).last();
    await queryByUI(page, 'coupons', changes, () => popup.getByText(option, { exact: true }).click());
  }
  await setFilter('Status kupon', 'Aktif', { status: 'active' });
  await page.getByText('KUPON-121', { exact: true }).first().waitFor();
  await setFilter('Jenis kupon', 'Gratis', { status: 'active', type: 'free' });
  const query = { status: 'active', type: 'free', q: 'KUPON-136' };
  await queryByUI(page, 'coupons', query, () => page.getByPlaceholder(/cari.*kupon/i).fill(query.q));
  await page.getByText(query.q, { exact: true }).first().waitFor();
  assert.equal(await page.getByText('KUPON-121', { exact: true }).count(), 0);
  const last = reads.filter(call => call.section === 'coupons').at(-1);
  for (const [k, v] of Object.entries(query)) assert.equal(last.params[k], v);
});

it('laptop meminta limit baru serta halaman akhir dari server, lalu memulihkan halaman lewat Back', async t => {
  const { page } = await visit(t, 'desktop', 1280, 800, 'coupons');
  const pager = page.getByRole('navigation', { name: 'Paginasi daftar' });
  const size = pager.getByLabel('Baris per halaman');
  await queryByUI(page, 'coupons', { page: '1', limit: '50' }, () => size.selectOption('50'));
  await page.getByText('KUPON-050', { exact: true }).first().waitFor();
  await queryByUI(page, 'coupons', { page: '3', limit: '50' }, () => pager.getByRole('button', { name: 'Akhir' }).click());
  await page.getByText('KUPON-137', { exact: true }).first().waitFor();
  assert.match(await pager.innerText(), /101\s*[–-]\s*137 dari 137/);
  await page.goBack({ waitUntil: 'commit' });
  await page.getByText('KUPON-001', { exact: true }).first().waitFor();
  assert.equal(await size.inputValue(), '50');
});

it('tablet mengabaikan respons pencarian lama yang tiba sesudah hasil terbaru', async t => {
  const { page } = await visit(t, 'tablet', 960, 800, 'orders');
  const search = page.getByPlaceholder(/cari.*(?:invoice|transaksi)/i).first();
  let unlock;
  const held = new Promise(resolve => { unlock = resolve; });
  let finished;
  const delivered = new Promise(resolve => { finished = resolve; });
  await page.route('**/api/admin/subscription/orders?*', async route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get('q') !== 'INV-PAGING-01') return route.fallback();
    try {
      await held;
      await route.fulfill({ json: financePage('orders', orders, params) });
    } finally { finished(); }
  });
  try {
    await Promise.all([
      page.waitForRequest(req => new URL(req.url()).searchParams.get('q') === 'INV-PAGING-01'),
      search.fill('INV-PAGING-01'),
    ]);
    await queryByUI(page, 'orders', { q: 'INV-PAGING-136' }, () => search.fill('INV-PAGING-136'));
    await page.getByText(/^#?INV-PAGING-136$/).first().waitFor();
  } finally { unlock(); }
  await delivered;
  await page.waitForLoadState('networkidle');
  assert.equal(await page.getByText(/^#?INV-PAGING-010$/).count(), 0);
  assert.ok(await page.getByText(/^#?INV-PAGING-136$/).first().isVisible());
});

for (const [bundle, width] of [['mobile', 390], ['tablet', 960]]) {
  it(bundle + ' Back menutup pemilih dan dapat memulihkan filter sebelumnya', async t => {
    const { page } = await visit(t, bundle, width, 800, 'orders');
    const filter = page.getByRole('button', { name: 'Metode pembayaran', exact: true });
    const menu = page.getByRole('dialog').or(page.getByRole('listbox')).last();
    await filter.click();
    await menu.waitFor();
    await page.evaluate(() => history.back());
    await menu.waitFor({ state: 'hidden' });
    assert.equal(new URL(page.url()).searchParams.get('sub'), 'orders');
    await filter.click();
    await queryByUI(page, 'orders', { channel: 'gateway_aulaa' }, () => menu.getByText('Gateway Aulaa', { exact: true }).click());
    await page.getByText(/^#?INV-PAGING-121$/).first().waitFor();
    await page.evaluate(() => history.back());
    await page.getByText(/^#?INV-PAGING-001$/).first().waitFor();
    assert.equal(new URL(page.url()).searchParams.get('channel'), null);
  });
}

it('tablet lebar mempertahankan detail invoice ketika daftar berpindah halaman', async t => {
  const { page } = await visit(t, 'tablet', 960, 800, 'orders');
  const invoice = page.getByText(/^#?INV-PAGING-001$/);
  await invoice.first().click();
  const detail = page.getByText('Invoice #INV-PAGING-001', { exact: true });
  await detail.waitFor();
  await queryByUI(page, 'orders', { page: '2' }, () => page.getByRole('button', { name: 'Selanjutnya' }).click());
  await page.getByText(/^#?INV-PAGING-011$/).first().waitFor();
  await detail.waitFor();
});
