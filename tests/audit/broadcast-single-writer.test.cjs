// Regresi BC-6: satu penulis state daftar siaran per aplikasi.
//
// Sebelum perbaikan, portal induk (desktop & mobile) memanggil
// /api/admin/notifications TANPA parameter saat inisialisasi. Server menjawab
// default 15 baris (SuperadminIndex, notification_handler.go:896), lalu hasilnya
// ditimpakan ke state `broadcasts` — state yang sama yang diisi halaman siaran
// dengan page/limit/status/q. Dua penulis pada satu state:
//   - siaran yang sedang difilter bisa tertimpa daftar tanpa filter, dan
//   - server menerima dua request ke endpoint yang sama.
//
// Tablet sudah bersih lebih dulu (commit 3813a5c) karena tidak punya fetch
// telanjang itu; desktop dan mobile masih memilikinya sampai perbaikan ini.
//
// Jalankan: node --test tests/audit/broadcast-single-writer.test.cjs
// Prasyarat: public/{desktop,mobile,tablet} sudah dibangun (npm run build).

const { before, after, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const origin = 'https://broadcast-writer.invalid';
const publicRoot = path.resolve(__dirname, '../../public');

// 60 siaran: cukup untuk membedakan "default 15 baris" dari "limit halaman".
const broadcasts = Array.from({ length: 60 }, (_, index) => {
  const id = index + 1;
  return {
    id,
    title: 'Siaran ' + String(id).padStart(3, '0'),
    message: 'Isi pengumuman nomor ' + id,
    target_type: 'all',
    is_active: true,
    category: 'INFO',
    created_at: '2026-11-01T00:00:00Z',
    expires_at: null,
    read_count: 0,
  };
});

function pageOf(params) {
  const page = Number(params.get('page') || 1);
  const limit = Number(params.get('limit') || 15);
  const offset = (page - 1) * limit;
  const data = broadcasts.slice(offset, offset + limit);
  return {
    success: true,
    data,
    metrics: {
      total_broadcasts: broadcasts.length,
      active_broadcasts: broadcasts.length,
      global_broadcasts: broadcasts.length,
      targeted_broadcasts: 0,
      total_reads: 0,
    },
    pagination: {
      page,
      limit,
      total_items: broadcasts.length,
      total_pages: Math.ceil(broadcasts.length / limit),
      has_more: page * limit < broadcasts.length,
    },
  };
}

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

const user = {
  id: 42,
  name: 'Staf QA',
  platform_role: 'superadmin',
  is_admin: true,
  is_super_admin: true,
  permissions: ['content:broadcast:send'],
};

async function openPanel(bundle, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: bundle !== 'desktop',
    serviceWorkers: 'block',
  });
  await context.addInitScript(user => {
    localStorage.setItem('catavor_token', 'fixture.' + btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 })) + '.fixture');
    localStorage.setItem('catavor_user', JSON.stringify(user));
  }, user);

  const reads = [];
  await context.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) {
      if (req.method() !== 'GET') return route.fulfill({ status: 405, json: { error: 'Fixture baca saja' } });
      if (url.pathname.includes('/stream') || url.pathname.includes('/ticket')) return route.abort();
      if (url.pathname === '/api/admin/notifications') {
        reads.push(Object.fromEntries(url.searchParams));
        return route.fulfill({ json: pageOf(url.searchParams) });
      }
      const data = ['/api/settings', '/api/admin/settings'].includes(url.pathname)
        ? { payment_system_mode: 'manual' } : [];
      return route.fulfill({ json: { success: true, valid: true, user, data, stores: [], summary: {} } });
    }
    const asset = url.pathname === '/admin'
      ? path.join(publicRoot, bundle, 'index.html')
      : path.resolve(publicRoot, '.' + decodeURIComponent(url.pathname));
    const relative = path.relative(publicRoot, asset);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return route.abort();
    try { return await route.fulfill({ path: asset }); } catch { return route.abort(); }
  });

  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  return { context, page, reads };
}

for (const [bundle, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844], ['tablet', 1024, 768]]) {
  it(`${bundle}: tidak ada request daftar siaran tanpa parameter saat portal dimuat`, async () => {
    const { context, page, reads } = await openPanel(bundle, width, height);
    try {
      await page.goto(origin + '/admin?tab=broadcast', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const bare = reads.filter(params => !('limit' in params) && !('page' in params));
      assert.deepEqual(
        bare, [],
        `${bundle}: ditemukan request /api/admin/notifications tanpa page/limit -> ${JSON.stringify(bare)}`
      );
    } finally {
      await context.close();
    }
  });

  it(`${bundle}: halaman siaran meminta satu halaman ber-limit, bukan default 15`, async () => {
    const { context, page, reads } = await openPanel(bundle, width, height);
    try {
      await page.goto(origin + '/admin?tab=broadcast', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      assert.ok(reads.length > 0, `${bundle}: tidak ada request daftar siaran sama sekali`);
      for (const params of reads) {
        assert.ok('limit' in params, `${bundle}: request tanpa limit -> ${JSON.stringify(params)}`);
      }
      const limits = [...new Set(reads.map(p => p.limit))];

      assert.ok(
        limits.some(l => Number(l) !== 15),
        `${bundle}: semua request memakai limit default server (15); halaman siaran tidak mengirim limit sendiri -> ${JSON.stringify(limits)}`
      );
    } finally {
      await context.close();
    }
  });

  it(`${bundle}: daftar siaran tetap dirender setelah preload dihapus`, async () => {
    // Menjaga agar perbaikan BC-6 tidak berubah menjadi "tidak ada request,
    // tidak ada data". Halaman harus tetap memuat dan menampilkan siaran.
    const { context, page } = await openPanel(bundle, width, height);
    try {
      await page.goto(origin + '/admin?tab=broadcast', { waitUntil: 'networkidle' });
      await page.getByText('Siaran 001').first().waitFor({ timeout: 10000 });
      const visible = await page.getByText(/^Siaran \d{3}$/).count();
      assert.ok(visible > 0, `${bundle}: tidak ada kartu siaran yang dirender (${visible})`);
    } finally {
      await context.close();
    }
  });
}

// Regresi BC-5: riwayat siaran tablet harus bisa diakses melewati halaman pertama.
//
// Temuan semula: tablet menarik limit=50 tanpa kontrol halaman, sehingga siaran
// ke-51 dan seterusnya tidak terjangkau sama sekali dari tablet. Paginasi
// diperbaiki di commit 3813a5c (TabletSegmentedPagination, broadcastPageSize=10).
// Test ini menjaga perbaikan itu: dengan 60 siaran (6 halaman), klik "Halaman
// Selanjutnya" harus benar-benar meminta page=2 dan merender isinya.
it('tablet: paginasi siaran menjangkau halaman berikutnya', async () => {
  const { context, page, reads } = await openPanel('tablet', 1024, 768);
  try {
    await page.goto(origin + '/admin?tab=broadcast', { waitUntil: 'networkidle' });
    await page.getByText('Siaran 001').first().waitFor({ timeout: 10000 });

    const controls = page.locator('[title="Halaman Selanjutnya"]');
    assert.equal(await controls.count(), 1,
      'tablet: kontrol halaman "Selanjutnya" tidak dirender — riwayat >1 halaman tidak terjangkau');

    await controls.click();
    await page.getByText('Siaran 011').first().waitFor({ timeout: 10000 });

    const pages = reads.map(p => p.page).filter(Boolean);
    assert.ok(pages.includes('2'),
      `tablet: klik halaman berikutnya tidak mengirim page=2 -> ${JSON.stringify(reads)}`);
  } finally {
    await context.close();
  }
});
