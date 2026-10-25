/* eslint-disable */
/**
 * Meringkas report.json hasil parity-audit.cjs menjadi qa-report/summary.md
 * yang ringkas dan bisa dibaca langsung (tanpa membuka JSON 4 MB).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const SRC = path.join(os.tmpdir(), 'catavor-qa', 'report.json');
const OUTDIR = path.join('C:', 'MyProject', 'DFauna', 'qa-report');
const OUT = path.join(OUTDIR, 'summary.md');

const r = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const L = [];
const P = (s = '') => L.push(s);

const devs = ['desktop', 'tablet', 'mobile'];
const byDev = (d) => r.pages.filter((p) => p.device === d);

P('# Ringkasan Audit Paritas Form-Factor');
P('');
P(`Dibuat: ${r.generatedAt}`);
P(`Target: ${r.base}`);
P(`Login admin: ${r.logins.admin.status} — ${r.logins.admin.message}`);
P(`Login merchant: ${r.logins.merchant.status} — ${r.logins.merchant.message}`);
P(`Store: admin=${(r.stores.admin || []).join(',')} merchant=${(r.stores.merchant || []).join(',')}`);
P('');

P('## 1. Matriks halaman × device');
P('');
P('| Device | Rute | URL akhir | Form login? | Overflow X | Teks meluber | Tombol | Target <44px | <select> | Emoji | Console error |');
P('|---|---|---|---|---|---|---|---|---|---|---|');
for (const d of devs) {
  for (const p of byDev(d)) {
    const q = p.probe || {};
    P(
      `| ${d} | ${p.route} | ${(p.finalUrl || (p.requested || '')).replace(r.base, '')} | ${
        q.hasLoginForm ? 'YA' : '-'
      } | ${q.overflowX ?? '?'} | ${q.textOverflowCount ?? 0} | ${q.buttonCount ?? '?'} | ${q.smallTargetCount ?? '?'} | ${q.nativeSelects ?? '?'} | ${
        q.emojiFound ? q.emojiFound.length : '?'
      } | ${p.consoleErrors.length} |`
    );
  }
}
P('');

P('## 2. Emoji pada teks terlihat (pelanggaran §6)');
P('');
let anyEmoji = false;
for (const p of r.pages) {
  const e = (p.probe && p.probe.emojiFound) || [];
  if (e.length) {
    anyEmoji = true;
    P(`- **${p.device} / ${p.route}**: ${e.map((c) => '`' + c + '`').join(' ')}`);
  }
}
if (!anyEmoji) P('- Tidak ditemukan.');
P('');

P('## 3. `<select>` native pada device sentuh (pelanggaran §7.A.2/§7.A.3)');
P('');
let anySel = false;
for (const p of r.pages) {
  const n = (p.probe && p.probe.nativeSelects) || 0;
  if (p.device !== 'desktop' && n > 0) {
    anySel = true;
    P(`- **${p.device} / ${p.route}**: ${n} elemen`);
  }
}
for (const p of r.pages) {
  const n = (p.probe && p.probe.nativeSelects) || 0;
  if (p.device === 'desktop' && n > 0) P(`- (info desktop, wajar) ${p.route}: ${n}`);
}
if (!anySel) P('- Tidak ditemukan pada tablet/mobile.');
P('');

P('## 4. Target sentuh < 44px (tablet & mobile wajib ≥44px)');
P('');
for (const d of ['tablet', 'mobile']) {
  P(`### ${d}`);
  P('');
  for (const p of byDev(d)) {
    const st = (p.probe && p.probe.smallTargets) || [];
    if (!st.length) continue;
    P(`- **${p.route}** (${st.length} contoh):`);
    for (const s of st.slice(0, 6)) P(`  - ${s.w}×${s.h} px — "${s.t}"`);
  }
  P('');
}

P('## 4b. Luapan teks pada tombol / pill (textOverflows)');
P('');
let anyOverflow = false;
for (const p of r.pages) {
  const to = (p.probe && p.probe.textOverflows) || [];
  if (to.length) {
    anyOverflow = true;
    P(`- **${p.device} / ${p.route}** (${to.length} elemen):`);
    for (const o of to) P(`  - "${o.t}" (scrollWidth=${o.scrollW}px > clientWidth=${o.clientW}px)`);
  }
}
if (!anyOverflow) P('- Tidak ditemukan (0 luapan teks di seluruh rute).');
P('');

P('## 5. Pola navigasi/paginasi data (paritas §7.C)');
P('');
P('| Device | Rute | Load More | "Menampilkan X–Y" | Nomor halaman | Baris/halaman | Prev-Next |');
P('|---|---|---|---|---|---|---|');
for (const p of r.pages) {
  const s = (p.probe && p.probe.signals) || {};
  P(
    `| ${p.device} | ${p.route} | ${s.loadMore ? 'ya' : '-'} | ${s.showingRange ? 'ya' : '-'} | ${
      s.pageNumbers ? 'ya' : '-'
    } | ${s.rowsPerPage ? 'ya' : '-'} | ${s.prevNext ? 'ya' : '-'} |`
  );
}
P('');

P('## 6. Inventaris label navigasi per device (konsol pengelola)');
P('');
for (const p of r.pages) {
  if (!p.route.startsWith('console-')) continue;
  const q = p.probe || {};
  P(`### ${p.device} / ${p.route} — heading: ${(q.headings || []).slice(0, 3).join(' | ') || '(kosong)'}`);
  P('');
  P(`nav: ${(q.navLabels || []).slice(0, 24).join(' · ') || '(kosong)'}`);
  P('');
  P(`tabs: ${(q.tabs || []).slice(0, 24).join(' · ') || '(kosong)'}`);
  P('');
}

P('## 7. Cuplikan teks halaman (untuk verifikasi isi)');
P('');
for (const p of r.pages) {
  if (!p.route.startsWith('console-') && !p.route.includes('admin')) continue;
  const q = p.probe || {};
  P(`- **${p.device} / ${p.route}**: ${(q.bodyPreview || '').slice(0, 220)}`);
}
P('');

fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(OUT, L.join('\n'), 'utf8');

// Ringkasan angka ke stdout supaya bisa dibaca tanpa membuka file.
console.log('SUMMARY=' + OUT);
console.log('LINES=' + L.length);
for (const d of devs) {
  const pages = byDev(d);
  const small = pages.reduce((a, p) => a + ((p.probe && p.probe.smallTargetCount) || 0), 0);
  const over = pages.reduce((a, p) => a + ((p.probe && p.probe.textOverflowCount) || 0), 0);
  const sel = pages.reduce((a, p) => a + ((p.probe && p.probe.nativeSelects) || 0), 0);
  const emo = pages.reduce((a, p) => a + (((p.probe && p.probe.emojiFound) || []).length), 0);
  const err = pages.reduce((a, p) => a + p.consoleErrors.length, 0);
  console.log(`${d}: routes=${pages.length} smallTargets=${small} textOverflows=${over} nativeSelects=${sel} emoji=${emo} consoleErrors=${err}`);
}
