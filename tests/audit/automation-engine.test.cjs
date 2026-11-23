/**
 * Uji regresi Mesin Otomasi terhadap bundle public/ dengan API dalam memori.
 * Jalankan setelah membangun ketiga frontend: node --test tests/audit/automation-engine.test.cjs
 * Memerlukan dependensi tests/ dan Chromium Playwright. Tidak memerlukan server atau akun.
 */
const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { isAbsolute, relative, resolve } = path;
const { chromium } = require('playwright');

const origin = 'https://automation-fixture.invalid';
const publicRoot = resolve(__dirname, '../../public');
const adminURL = origin + '/admin?tab=automation';
const widths = [
  ['mobile', 375, 812], ['mobile', 390, 844],
  ['tablet', 800, 1024], ['tablet', 960, 800],
  ['desktop', 1280, 800], ['desktop', 1600, 900],
];
const workerNames = [
  'store_expiry', 'dormancy_worker', 'promo_expiry', 'flash_sale',
  'support_lifecycle', 'cleaner_worker', 'storage_sweeper', 'weekly_summary',
  'onboarding_engine', 'sse_hub', 'item_retention_worker',
  'ticket_retention_worker', 'market_intel_worker', 'subscription_lifecycle', 'moderation_escalator',
  'moderation_media_cleanup', 'activity_log_cleaner', 'email_queue', 'search_ingest', 'search_click',
  'store_ingest', 'store_flush', 'visitor_retention', 'ad_flush', 'trending',
];
const logEntry = {
  id: 'fixture-run', bot_name: 'store_expiry', bot_title: 'Worker audit',
  details: 'Hasil audit manual', status: 'error', trigger_type: 'manual_admin',
  triggered_by: 'Operator QA', error_message: 'Kesalahan audit simulasi', duration_ms: 23,
  affected_count: 2, created_at: '2026-11-19T03:00:00Z',
};

function snapshot(scenario) {
  const workers = scenario === 'zero' ? [] : workerNames.map((name, index) => ({
    name, title: 'Pekerjaan uji ' + String(index + 1).padStart(2, '0'),
    category: 'system', interval_desc: 'Harian', manual: index === 0, conditions: 'Data contoh yang memenuhi syarat.',
    status: index === 0 ? 'warning' : 'idle', is_executing: false,
    last_error: index === 0 ? 'Koneksi worker terputus' : '',
    last_run_at: '2026-11-19T03:00:00Z', execution_count: 1, total_processed: 0,
  }));
  return {
    total_workers: workers.length, healthy_workers: Math.max(0, workers.length - 1),
    workers, system_healthy: false, errors_24h: workers.length ? 1 : 0,
    executions_24h: workers.length ? 1 : 0, success_rate_24h: '0.0%',
    sse_clients_count: 0, redis_available: false, server_time: '2026-11-19T03:00:00Z',
  };
}

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function openFixture(t, bundle, width, height, scenario = 'catalog', manage = true) {
  const context = await browser.newContext({
    viewport: { width, height }, hasTouch: bundle !== 'desktop', serviceWorkers: 'block',
  });
  t.after(() => context.close());
  const permissions = ['support:tickets:read', 'system:automation:view'];
  if (manage) permissions.push('system:automation:manage');
  const user = { id: 123, name: 'Operator QA', email: 'operator@example.invalid',
    platform_role: 'support', is_admin: true, permissions };
  const calls = [];
  const state = snapshot(scenario);
  await context.addInitScript(user => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem('catavor_token', 'fixture.' + payload + '.fixture');
    localStorage.setItem('catavor_user', JSON.stringify(user));
  }, user);

  await context.route('**/*', async route => {
    const request = route.request();
    const { origin: host, pathname, search } = new URL(request.url());
    if (host !== origin) return route.abort();
    if (pathname.startsWith('/api/')) {
      calls.push({ method: request.method(), pathname, search });
      if (pathname === '/api/admin/automation/status') {
        if (scenario === 'unavailable') return route.fulfill({ status: 503, json: { error: 'Statistik tidak tersedia' } });
        return route.fulfill({ json: { success: true, data: state } });
      }
      if (pathname === '/api/admin/automation/logs') {
        const params = new URLSearchParams(search);
        const data = scenario === 'catalog' ? [logEntry] : scenario === 'paged' ? [
          { ...logEntry, details: 'Entri halaman ' + params.get('page') }
        ] : [];
        if (scenario === 'paged') return route.fulfill({ json: { data, total: 51 } });
        return route.fulfill({ json: { success: true, data, total: data.length,
          pagination: { page: 1, limit: 50, total: data.length, total_pages: 1 } } });
      }
      if (pathname === '/api/admin/automation/preview') {
        return route.fulfill({ json: { eligible: 1, message: '1 dari 2 tiket contoh memenuhi retensi.' } });
      }
      if (pathname === '/api/admin/automation/trigger') {
        return route.fulfill({ json: { message: 'Permintaan operator diterima.' } });
      }
      if (pathname.includes('/stream')) return route.abort();
      return route.fulfill({ json: { success: true, valid: true, user, data: [], stores: [] } });
    }
    const asset = pathname === '/admin' ? resolve(publicRoot, bundle, 'index.html')
      : resolve(publicRoot, '.' + decodeURIComponent(pathname));
    const suffix = relative(publicRoot, asset);
    if (suffix.startsWith('..') || isAbsolute(suffix)) return route.abort();
    try { await route.fulfill({ path: asset }); } catch { await route.abort(); }
  });

  const page = await context.newPage();
  await page.goto(adminURL, { waitUntil: 'networkidle' });
  assert.ok(calls.some(c => c.pathname === '/api/admin/automation/status'), 'bundle tidak meminta status');
  assert.ok(calls.some(c => c.pathname === '/api/admin/automation/logs'), 'bundle tidak meminta log');
  return { page, calls, state };
}

const catalogTab = /Bot Platform|Daftar (?:Bot|Pekerjaan)|Katalog (?:Bot|Worker|Pekerjaan)/i;
const logsTab = /^Riwayat/i;
const sandboxTab = /^Sandbox|^Simulasi$/i;

async function openTab(page, name) {
  const control = page.getByRole('button', { name }).or(page.getByRole('tab', { name }));
  await control.first().click({ timeout: 3000 });
}

async function enabledActions(page, name) {
  const buttons = await page.getByRole('button', { name }).all();
  const states = await Promise.all(buttons.map(async b => await b.isVisible() && await b.isEnabled()));
  return buttons.filter((_, i) => states[i]);
}

for (const [bundle, width, height] of widths) {
  describe(bundle + ' ' + width + '×' + height, () => {
    const open = (t, scenario, manage) => openFixture(t, bundle, width, height, scenario, manage);

    it('mempertahankan kontras teks, kartu, dan navigasi pada kedua tema portal', async t => {
      const { page } = await open(t);
      const surfaces = [];
      for (const theme of ['light', 'dark']) {
        await page.evaluate(mode => localStorage.setItem('catavor_admin_theme_mode', mode), theme);
        await page.reload({ waitUntil: 'networkidle' });
        const panel = page.locator('.automation-console');
        await panel.locator('dd').first().waitFor();
        const result = await panel.evaluate(el => {
          const ctx = document.createElement('canvas').getContext('2d');
          const luminance = color => {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 1, 1);
            const rgb = Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).map(component => {
              const value = component / 255;
              return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
            });
            return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
          };
          const contrast = (fg, bg) => {
            const a = luminance(fg), b = luminance(bg);
            return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
          };
          const surface = getComputedStyle(el.querySelector('.auto-metrics > div')).backgroundColor;
          const tab = getComputedStyle(el.querySelector('nav [aria-current]'));
          const shell = el.closest('[data-platform-theme]');
          return { theme: el.dataset.theme, surface,
            headingContrast: shell && contrast(getComputedStyle(el.querySelector('h2')).color, getComputedStyle(shell).backgroundColor),
            labelContrast: contrast(getComputedStyle(el.querySelector('dt')).color, surface),
            tabContrast: contrast(tab.color, tab.backgroundColor) };
        });
        assert.equal(result.theme, theme);
        assert.ok(result.labelContrast >= 4.5 && result.tabContrast >= 4.5, JSON.stringify(result));
        if (bundle === 'tablet') assert.ok(result.headingContrast >= 4.5, JSON.stringify(result));
        surfaces.push(result.surface);
      }
      assert.notEqual(surfaces[0], surfaces[1], 'warna kartu menetap saat tema portal berubah');
    });

    if (bundle === 'tablet') {
      it('dapat menggulir dan memilih pekerjaan terakhir dari panel tablet', async t => {
        const { page, state } = await open(t);
        await openTab(page, catalogTab);
        const panel = page.locator('.automation-console');
        const last = state.workers.at(-1);
        await panel.hover({ position: { x: 20, y: 90 } });
        await page.mouse.wheel(0, 3000);
        await page.waitForFunction(title => {
          const row = [...document.querySelectorAll('.auto-master button')].find(el => el.textContent === title);
          const box = row?.getBoundingClientRect();
          return box && box.top >= 0 && box.bottom <= innerHeight;
        }, last.title, { timeout: 3000 });
        await panel.getByRole('button', { name: last.title, exact: true }).click();
        assert.equal(await panel.locator('.auto-detail strong').first().innerText(), last.title);
      });
    }

    it('menampilkan nol worker sehat sesuai status API', async t => {
      const { page } = await open(t, 'zero');
      const text = await page.locator('body').innerText();
      assert.match(text, /\b0\s+(?:sehat|normal)|(?:worker|pekerjaan|bot) sehat\s*0\b/i, 'nilai nol untuk worker sehat hilang');
      assert.doesNotMatch(text, /11\s+sehat|[1-9]\d* worker aktif/i, 'ringkasan menampilkan worker sehat/aktif fiktif');
    });

    it('menampilkan kegagalan API status tanpa menyatakan daemon sehat', async t => {
      const { page } = await open(t, 'unavailable');
      const text = await page.locator('body').innerText();
      assert.match(text, /(?:gagal|tidak tersedia|belum tersedia|belum diketahui|tidak dapat dimuat)/i, 'status 503 tersembunyi');
      assert.doesNotMatch(text, /11 sehat|daemon berjalan normal|[1-9]\d* worker aktif/i, 'angka sehat ditampilkan setelah 503');
    });

    it('merender seluruh 25 entri dari katalog server', async t => {
      const { page, state } = await open(t);
      await openTab(page, catalogTab);
      const text = await page.locator('body').innerText();
      const missing = state.workers.filter(w => !text.includes(w.title));
      assert.deepEqual(missing.map(w => w.name), [], 'identitas pekerjaan server tidak muncul di katalog');
    });

    it('memperlihatkan gangguan yang dilaporkan worker', async t => {
      const { page, state } = await open(t);
      await openTab(page, catalogTab);
      const worker = state.workers[0];
      const workerTitle = page.getByText(worker.title, { exact: true }).first();
      if (await workerTitle.isVisible()) await workerTitle.click();
      const body = await page.locator('body').innerText();
      assert.ok(body.includes(worker.last_error), 'last_error worker tidak dapat dibaca dari katalog/detail');
    });

    it('peran view hanya memperoleh kontrol baca', async t => {
      const { page } = await open(t, 'catalog', false);
      await openTab(page, catalogTab);
      assert.equal((await enabledActions(page, /^Jalankan(?: sekarang)?$/i)).length, 0, 'pemilik izin baca dapat menekan Jalankan');
    });

    it('peran manage memperoleh kontrol operasi di katalog', async t => {
      const { page } = await open(t);
      await openTab(page, catalogTab);
      assert.ok((await enabledActions(page, /^Jalankan(?: sekarang)?$/i)).length > 0, 'pengelola tidak dapat memulai operasi');
    });

    it('kontrol sandbox tidak meminta eksekusi produksi', async t => {
      const { page, calls } = await open(t);
      await openTab(page, sandboxTab);
      const actions = await enabledActions(page, /simulasi|uji transmisi|pembersih notifikasi|dry.run|pratinjau/i);
      const candidates = [];
      for (const action of actions) {
        const name = (await action.innerText()).trim();
        if (/^(?:sandbox uji coba|simulasi)$/i.test(name)) continue;
        candidates.push(action);
      }
      if (candidates.length === 0) {
        assert.match(await page.locator('body').innerText(), /belum tersedia|dinonaktifkan|tidak tersedia/i, 'status sandbox kosong');
      }
      const start = calls.length;
      for (const action of candidates) await action.click();
      await page.waitForLoadState('networkidle');
      const unexpectedWrites = calls.slice(start).filter(call =>
        !['GET', 'HEAD', 'OPTIONS'].includes(call.method) &&
        !/^\/api\/admin\/automation\/(?:sandbox|dry-run|preview)(?:\/|$)/.test(call.pathname)
      );
      assert.deepEqual(unexpectedWrites.map(call => call.pathname), [],
        unexpectedWrites.length + ' permintaan di luar API simulasi dari area latihan');
    });

    it('Riwayat membedakan entri manual dan menampilkan kesalahan', async t => {
      const { page } = await open(t);
      await openTab(page, logsTab);
      const result = page.getByText(logEntry.details, { exact: true });
      await result.waitFor({ state: 'visible', timeout: 3000 });
      const text = await page.locator('body').innerText();
      assert.ok(text.includes(logEntry.error_message), 'pesan kesalahan hilang');
      assert.match(text, /(?:pemicu manual|manual admin|manual_admin|oleh admin)/i, 'label eksekusi manual hilang');
      assert.doesNotMatch(text, /Cron Otomatis/i, 'entri manual dilabeli cron');
    });

    it('meminta halaman lanjutan dari server', async t => {
      const { page, calls } = await open(t, 'paged');
      await openTab(page, logsTab);
      await page.getByRole('button', {name:'Selanjutnya'}).click();
      await page.getByText('Entri halaman 2', {exact:true}).waitFor();
      assert.ok(calls.some(c => c.pathname.endsWith('/logs') && new URLSearchParams(c.search).get('page') === '2'));
    });

    it('konfirmasi eksplisit mengirim satu permintaan manual', async t => {
      const { page, calls } = await open(t);
      await openTab(page, catalogTab);
      await page.getByRole('button', {name:'Jalankan', exact:true}).first().click();
      assert.equal(calls.filter(c => c.pathname.endsWith('/trigger')).length, 0);
      await page.getByRole('button', {name:'Konfirmasi eksekusi',exact:true}).click();
      await page.getByText('Permintaan operator diterima.',{exact:true}).waitFor();
      assert.equal(calls.filter(c => c.pathname.endsWith('/trigger') && c.method === 'POST').length, 1);
    });

    it('hasil simulasi dapat dibaca dan konten sesuai lebar panel', async t => {
      const { page } = await open(t);
      await openTab(page, sandboxTab);
      await page.getByRole('button', {name:'Jalankan simulasi'}).click();
      await page.getByText('1 dari 2 tiket contoh memenuhi retensi.',{exact:true}).waitFor();
      const bounds = await page.locator('.automation-console').evaluate(el => ({content:el.scrollWidth,panel:el.clientWidth}));
      assert.ok(bounds.content <= bounds.panel + 1, JSON.stringify(bounds));
    });

    it('Back dari Riwayat mengembalikan katalog', async t => {
      const { page } = await open(t);
      await openTab(page, catalogTab);
      const catalogURL = page.url();
      await openTab(page, logsTab);
      const logsURL = page.url();
      await page.goBack({ waitUntil: 'commit' });
      assert.notEqual(catalogURL, logsURL, 'URL subtab identik');
      assert.equal(page.url(), catalogURL, 'navigasi kembali meninggalkan katalog');
      assert.ok((await enabledActions(page, /^Jalankan(?: sekarang)?$/i)).length > 0, 'konten katalog belum kembali');
    });
  });
}

