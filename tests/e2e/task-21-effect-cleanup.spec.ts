/**
 * Guard regresi Task 2.1 — kebocoran resource di useEffect.
 *
 * Klaim audit awal: "~41 useEffect mobile & ~39 desktop kurang cleanup".
 * Pengukuran terhadap kode aktual: 0 kebocoran. Semua effect yang mendaftarkan
 * listener/interval/EventSource/observer/subscription punya pembersihnya.
 *
 * Test ini menjaga agar regresi baru (effect ber-resource tanpa cleanup)
 * langsung gagal di CI. Dijalankan lewat `npx playwright test task-21...`
 * karena test sudah punya runner — tidak perlu framework tambahan.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

function lineOf(s: string, i: number): number {
  let n = 1;
  for (let k = 0; k < i; k++) if (s[k] === '\n') n++;
  return n;
}

function findEffects(src: string): { line: number; body: string }[] {
  const out: { line: number; body: string }[] = [];
  const re = /useEffect\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const start = m.index;
    let i = re.lastIndex;
    let depth = 1;
    let quote: string | null = null;
    let tpl = 0;
    while (i < src.length && depth > 0) {
      const c = src[i];
      const p = src[i - 1];
      if (quote) {
        if (c === quote && p !== '\\') quote = null;
      } else if (tpl > 0) {
        if (c === '`' && p !== '\\') tpl--;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '`') tpl++;
      else if (c === '/' && src[i + 1] === '/') {
        while (i < src.length && src[i] !== '\n') i++;
      } else if (c === '/' && src[i + 1] === '*') {
        i += 2;
        while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
        i++;
      } else if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    out.push({ line: lineOf(src, start), body: src.slice(start, i) });
  }
  return out;
}

const RULES = [
  { name: 'event-listener', add: /addEventListener\s*\(/, clean: /removeEventListener\s*\(/ },
  { name: 'interval', add: /setInterval\s*\(/, clean: /clearInterval\s*\(/ },
  { name: 'reconnect-timer', add: /reconnectTimer\s*=/, clean: /clearTimeout\s*\(\s*reconnectTimer/ },
  { name: 'event-source', add: /new\s+EventSource\s*\(/, clean: /\.close\s*\(\s*\)/ },
  { name: 'websocket', add: /new\s+WebSocket\s*\(/, clean: /\.close\s*\(\s*\)/ },
  { name: 'observer', add: /new\s+(Intersection|Resize|Mutation)Observer\s*\(/, clean: /\.disconnect\s*\(\s*\)/ },
  { name: 'auth-sync-sub', add: /subscribeAuthSync\s*\(/, clean: /unsubscribe\s*\(\s*\)/ },
  { name: 'raf', add: /requestAnimationFrame\s*\(/, clean: /cancelAnimationFrame\s*\(/ },
];

for (const platform of ['mobile', 'desktop'] as const) {
  test(`${platform}/App.tsx: tidak ada useEffect ber-resource tanpa cleanup`, () => {
    const file = path.join(ROOT, 'frontend', platform, 'src', 'App.tsx');
    const src = fs.readFileSync(file, 'utf8');

    const leaks: string[] = [];
    let checked = 0;

    for (const block of findEffects(src)) {
      const code = block.body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      const hits = RULES.filter((r) => r.add.test(code));
      if (!hits.length) continue;
      checked++;
      const missing = hits.filter((r) => !r.clean.test(code));
      if (missing.length) {
        leaks.push(`L${block.line}: ${missing.map((r) => r.name).join(', ')}`);
      }
    }

    expect(checked, 'harus ada effect ber-resource untuk diperiksa').toBeGreaterThan(10);
    expect(leaks, `effect ber-resource tanpa cleanup:\n${leaks.join('\n')}`).toEqual([]);
  });
}
