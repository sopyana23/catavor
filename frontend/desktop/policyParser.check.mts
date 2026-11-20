import { parsePolicyMarkdownToArticles } from './src/utils/policyShared.tsx';

let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name} -> ${JSON.stringify(detail)}`);
  }
}

const mdThreeHeadings = `# Syarat & Ketentuan

> Ringkasan eksekutif dokumen.

### Pasal 1: Definisi
Catavor adalah platform katalog digital.

- Platform menyediakan etalase
- Pengelola wajib jujur

### Pasal 2: Kewajiban
Pengelola wajib mematuhi hukum.

### Pasal 3: Sanksi
Pelanggaran berakibat penonaktifan.`;

const a1 = parsePolicyMarkdownToArticles(mdThreeHeadings);
check('(1) three ### headings -> 3 articles', a1.length === 3, a1.length);
check('(1b) heading text stripped of numbering', a1[0]?.heading === 'Definisi', a1[0]?.heading);
check('(1c) number label normalised', a1[0]?.number === 'Pasal 1', a1[0]?.number);
check('(1d) bullets captured as highlights', (a1[0]?.highlights || []).length === 2, a1[0]?.highlights);
check('(1e) body paragraph captured', (a1[0]?.content || '').includes('platform katalog digital'), a1[0]?.content);

const mdBold = `**Pasal 1. Ruang Lingkup**
Berlaku untuk seluruh pengguna.`;
const a2 = parsePolicyMarkdownToArticles(mdBold);
check('(2) bold **1. X** heading detected', a2.length === 1 && a2[0].heading === 'Ruang Lingkup', a2);

const a3 = parsePolicyMarkdownToArticles('Hanya paragraf biasa tanpa heading sama sekali.');
check('(3) no heading -> [] (falls back to static articles)', a3.length === 0, a3);

check('(4a) null content -> []', parsePolicyMarkdownToArticles(null).length === 0);
check('(4b) empty content -> []', parsePolicyMarkdownToArticles('').length === 0);
check('(4c) undefined -> []', parsePolicyMarkdownToArticles(undefined).length === 0);

const mdMixed = `# Judul Dokumen Yang Sudah Ditampilkan API

## Ketentuan Umum
Isi pasal satu.

## Larangan
Isi pasal dua.

- Tidak boleh memajang satwa dilindungi`;

const a5 = parsePolicyMarkdownToArticles(mdMixed);
check('(5a) level-1 doc title not treated as article', a5.length === 2, a5.length);
check('(5b) level-2 headings detected', a5[0].heading === 'Ketentuan Umum', a5[0].heading);
check('(5c) trailing bullet becomes highlight', (a5[1].highlights || []).length === 1, a5[1].highlights);

const mdLinks = `### Pasal 1: Tautan
Baca [panduan resmi](https://example.com/panduan) sebelum mengunggah.`;
const a6 = parsePolicyMarkdownToArticles(mdLinks);
check('(6) markdown link preserved verbatim in content (sanitised later by renderer)', (a6[0]?.content || '').includes('https://example.com/panduan'), a6[0]?.content);

const mdRule = `### Pasal 1: A
Isi A.

---

### Pasal 2: B
Isi B.`;
const a7 = parsePolicyMarkdownToArticles(mdRule);
check('(7a) horizontal rule does not create a phantom article', a7.length === 2, a7.length);
check('(7b) content split cleanly across rule', !(a7[0].content || '').includes('Isi B'), a7[0].content);

const mdIndo = `Pasal 1
Definisi

Pasal 2
Kewajiban`;
const a8 = parsePolicyMarkdownToArticles(mdIndo);
check('(8) bare "Pasal N" lines handled without crash', Array.isArray(a8), a8.length);

// Regression: real DB row `acceptable_use` uses "### 1. Judul" without the word "Pasal".
const mdRealDb = `### 1. Larangan Produk
Dilarang mengunggah satwa liar dilindungi tanpa izin BKSDA resmi, barang bajakan/ilegal, senjata, atau materi yang melanggar norma hukum.

### 2. Sanksi Pelanggaran
Pelanggaran akan dikenakan sanksi mulai dari penutupan katalog, pemblokiran akun, hingga pelaporan ke pihak berwajib.`;
const a9 = parsePolicyMarkdownToArticles(mdRealDb);
check('(9a) real DB "### 1. Judul" -> 2 articles', a9.length === 2, a9.length);
check('(9b) number parsed as "Pasal 1"', a9[0]?.number === 'Pasal 1', a9[0]?.number);
check('(9c) heading without numeric prefix', a9[0]?.heading === 'Larangan Produk', a9[0]?.heading);
check('(9d) body text preserved', (a9[0]?.content || '').includes('BKSDA'), a9[0]?.content);

console.log(`\nRESULT pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
