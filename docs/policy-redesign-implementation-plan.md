# Rencana Implementasi — Redesign Halaman Publik Kebijakan (Terms / Privacy / Acceptable Use)

**Repo:** `C:\MyProject\agentA\catavor` (branch `agentA`, worktree bersih, HEAD `a54a91b`)
**Server uji:** `http://127.0.0.1:8001` (DB `catavor` — **jangan** ubah skema)
**Tanggal audit:** 19 Nov 2026
**Status:** PLAN — belum ada perubahan kode

---

## 1. Ringkasan Eksekutif

Halaman kebijakan publik **sudah dinamis** (data dari `GET /api/policies`), tetapi punya **tiga cacat struktural** yang membuatnya terlihat tidak profesional dan tidak konsisten di semua device:

1. **Tema tidak mengikuti platform.** Halaman publik aktif memakai tema `navy` (biru `#1e3a8a` + putih `#f8fafc`), tetapi ketiga komponen kebijakan **hardcode emerald `#10b981`** dan **navy gelap `#0f172a`** sebagai card background. Hasilnya: panel gelap-emerald di atas halaman putih-biru.
2. **Data admin tidak tampil.** Kolom `policies.sections` di DB bernilai `null`; frontend jatuh ke fallback artikel hardcoded. Admin yang mengedit `content` (markdown) **tidak akan melihat perubahannya** di halaman publik.
3. **Layout bukan responsif secara nyata.** Grid sidebar `290px minmax(0,1fr)` bersifat fixed tanpa media query; di viewport 390px konten tersisa ~70px. `h1` tidak ada di jalur mobile. Tidak ada tap target 44px.

Rencana ini memperbaiki ketiganya dengan **satu sumber data**, **satu sumber warna (design token)**, dan **tiga breakpoint bertingkat** — lalu membuktikannya lewat screenshot + DOM probe di 3 device.

---

## 2. Audit Kondisi Sekarang (bukti runtime)

### 2.1 Backend — endpoint publik

| Item | Bukti |
|---|---|
| Route | `backend/cmd/server/main.go:454` → `api.Get("/policies", settingHandler.GetPolicies)` (publik, tanpa auth) |
| Handler | `backend/internal/handlers/setting_handler.go:640-700` |
| Respons | `{"success":true,"data":{...}}` dengan **7 kunci**: `terms, privacy, prohibited, acceptable_use, moderation, transactions, subscription` |
| Field per dokumen | `id, type, title, version, content, sections, summary_of_changes, change_type, effective_date, is_active, requires_acceptance, created_by, created_at, updated_at` |
| Kondisi data live | **`sections === null` untuk SEMUA 7 dokumen** (diverifikasi `curl` ke `:8001/api/policies`) |
| Catatan | `GetPolicies` men-hydrate dokumen yang belum ada di DB secara in-memory (`setting_handler.go:662-679`), jadi endpoint selalu balikin 7 kunci |

**Implikasi:** `sections: null` → `hydratePolicyDocs()` (`frontend/*/src/utils/policyShared.tsx:454`) tidak menemukan `rec.articles`, sehingga `parsedArticles = fallback.articles` (konten hardcoded). Judul & versi dinamis, **isi pasal tidak**.

### 2.2 Frontend — tiga komponen terpisah

| File | Baris | Catatan |
|---|---|---|
| `frontend/desktop/src/components/PlatformPoliciesView.tsx` | 730 | Layout 2 kolom, sidebar 290px |
| `frontend/mobile/src/components/MobilePoliciesView.tsx` | 578 | **(belum pernah di-screenshot — gap audit)** |
| `frontend/tablet/src/components/TabletPoliciesView.tsx` | 641 | **(belum pernah di-screenshot — gap audit)** |
| `frontend/*/src/utils/policyShared.tsx` | 636 / 634 / 634 | `hydratePolicyDocs`, `renderPolicyInlineMarkdown`, `renderPolicyArticleContent`, `FALLBACK_POLICY_SECTIONS` |
| `frontend/*/src/components/*PolicyManager.tsx` | 1366 / 1713 / ? | Panel admin — **di luar scope**, tapi memakai `PlatformPoliciesView` sebagai pratinjau (baris 1366) → perubahan komponen ikut terlihat di pratinjau admin |

**Warna hardcoded (bukti `grep`):**

| File | Emerald `#10b981` | Navy `#0f172a` | Putih `#ffffff` | Muted `#94a3b8` |
|---|---|---|---|---|
| Desktop | 15 | 3 | 10 | 14 |
| Mobile | 11 | 2 | 7 | 9 |
| Tablet | 14 | 3 | 9 | 12 |

### 2.3 Design token platform (sumber kebenaran warna)

Tema aktif halaman publik = **`navy`** (`App.tsx:4910`), didefinisikan di `frontend/desktop/src/index.css`:

```css
[data-theme="navy"] {
  --bg-deep: #f8fafc;      /* putih kebiruan */
  --bg-card: #ffffff;
  --border-light: rgba(30, 58, 138, 0.14);
  --primary: #1e3a8a;      /* biru */
  --primary-glow: rgba(30, 58, 138, 0.20);
  --text-primary: #0f172a;
  --text-secondary: #334155;
  --text-muted: #64748b;
}
```

**Kesimpulan:** komponen kebijakan **tidak memakai token ini**. Semua `#10b981` (emerald) dan `#0f172a` sebagai `backgroundColor` harus diganti token.

### 2.4 Bukti runtime (screenshot + DOM, `:8001`, 3 device × 3 route)

| Device | Route | `h1` | `h3` (pasal) | `overflowX` | `scrollH` | Body bg |
|---|---|---|---|---|---|---|
| desktop 1440 | /terms | **ada** | 5 | false | 2661 | `rgb(248,250,252)` |
| desktop 1440 | /privacy | ada | 5 | false | — | sama |
| desktop 1440 | /acceptable-use | ada | 5 | false | — | sama |
| tablet 834 | /terms, /privacy, /acceptable-use | ada | 5 | false | — | sama |
| mobile 390 | /terms | **`[]` KOSONG** | **1** | false | 4478 | sama |
| mobile 390 | /privacy | **`[]` KOSONG** | **1** | false | 3713 | sama |
| mobile 390 | /acceptable-use | **`[]` KOSONG** | **1** | false | 3946 | sama |

- **Console error: 0** di semua kombinasi (tidak ada regresi JS).
- `overflowX:false` di mobile **bukan bukti layout sehat** — teks membungkus paksa karena kolom konten hanya ~70px; perlu diukur ulang setelah perbaikan.
- Screenshot tersimpan: `C:\Users\hwtor\Pictures\hermes\policy-before-{desktop,tablet,mobile}-{terms,privacy,acceptable-use}.png`

### 2.5 Temuan (dengan tingkat keyakinan)

| # | Temuan | Bukti | Tingkat |
|---|---|---|---|
| A1 | Warna emerald/navy-gelap hardcoded, tidak ikut tema platform | `grep` 15/11/14 kemunculan `#10b981`; `index.css` tema aktif `navy` | **Terbukti (kode)** |
| A2 | Edit admin pada `content` markdown tidak tampil sebagai pasal | `sections=null` di `/api/policies` + logika fallback `policyShared.tsx:454-472` | **Terbukti (runtime + kode)** |
| A3 | Tidak ada `<h1>` di jalur mobile | DOM probe `h1: []` di 3 route mobile | **Terbukti (runtime)** |
| A4 | Jumlah pasal beda antar device (5 vs 1) | DOM probe `h3` count | **Terbukti (runtime)** — penyebab belum dipastikan (dugaan: mobile render collapsed/accordion); **perlu dibaca ulang `MobilePoliciesView.tsx` sebelum klaim** |
| A5 | Grid sidebar 290px fixed tanpa media query | `PlatformPoliciesView.tsx:314` `gridTemplateColumns: '290px minmax(0, 1fr)'` | **Terbukti (kode)** |
| A6 | Tidak ada `focus-visible`, tap target < 44px | Belum diukur → **hipotesis**, harus diukur di tahap verifikasi | Hipotesis |
| A7 | Lebar baca dokumen > 90ch di desktop lebar | Belum diukur → **hipotesis** | Hipotesis |

**Aturan pelaporan:** A6/A7 **tidak boleh** dilaporkan sebagai temuan sampai diukur. A4 butuh verifikasi ulang sebelum disimpulkan.

---

## 3. Prinsip Desain (anti-slop)

Aturan yang mengikat implementasi — kalau tidak ada di daftar ini, jangan ditambahkan:

**DILARANG**
- Gradient dekoratif, glassmorphism, `backdrop-filter`, glow/neon
- Emoji sebagai ikon; ikon dekoratif tanpa fungsi
- Kartu-di-dalam-kartu, border radius berbeda-beda tanpa alasan (satu skala: `8 / 12 / 16`)
- Shadow tebal; cukup `0 1px 2px` / `0 1px 3px`
- Animasi selain transisi 150–200ms pada warna/border
- Warna hardcode baru — **semua** lewat `var(--…)` token tema
- Teks paragraf full-width > 75ch

**WAJIB**
- Satu `<h1>` per halaman, hierarki heading tanpa lompatan (`h1 → h2 → h3`)
- Kontras ≥ 4.5:1 untuk teks normal, ≥ 3:1 untuk teks ≥ 24px dan batas UI
- Tap target ≥ 44×44px (mobile/tablet)
- `:focus-visible` outline 2px `var(--primary)` + offset 2px
- Breakpoint bertingkat: `<768` mobile, `768–1023` tablet, `≥1024` desktop
- Lebar baca konten dokumen: `max-width: 72ch` desktop, full-width di mobile
- Tipografi: `clamp()` untuk heading, `line-height: 1.65` untuk body pasal
- Setiap klaim "sudah bagus" harus punya screenshot + DOM probe pendukung

---

## 4. Rancangan UI/UX Baru

### 4.1 Struktur halaman

```
┌──────────────────────────────────────────────────────────┐
│  Breadcrumb: Beranda / Kebijakan                          │
│  h1  Kebijakan & Ketentuan Platform                       │
│  p   Ringkasan 1 kalimat + badge versi & tanggal efektif   │
├──────────────────────────────────────────────────────────┤
│  [Tabs / Sidebar]        │  Konten Dokumen (72ch)         │
│  • Syarat & Ketentuan    │  h2 Judul Dokumen              │
│  • Kebijakan Privasi     │  meta: versi • berlaku • ubah  │
│  • Ketentuan Penggunaan  │  Ringkasan (1 blok, tanpa kartu│
│  • Barang Terlarang      │  berlebih)                      │
│  • Moderasi              │  Daftar Isi (anchor)            │
│  • Transaksi             │  ──────────────────────────     │
│  • Langganan             │  h3 Pasal 1 …                   │
│                          │  h3 Pasal 2 …                   │
├──────────────────────────────────────────────────────────┤
│  Footer: entitas hukum • yurisdiksi • kontak • back-to-top │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Perilaku per device

| Breakpoint | Navigasi dokumen | Layout | Catatan |
|---|---|---|---|
| `≥1024` desktop | Sidebar sticky kiri 280px | 2 kolom, konten `max-width: 72ch` | Daftar isi opsional di kanan hanya jika ≥1440px |
| `768–1023` tablet | Tab horizontal scroll (sticky top) | 1 kolom, konten `max-width: 68ch`, padding 24px | Sidebar disembunyikan |
| `<768` mobile | Tab horizontal scroll (sticky top) + satu `<h1>` | 1 kolom, padding 16px, `font-size` body 16px | Pasal jadi accordion **terbuka semua secara default** (bukan collapsed) agar konten terbaca penuh |

### 4.3 Peta perubahan warna (emerald/navy-gelap → token)

| Sekarang | Ganti jadi | Kenapa |
|---|---|---|
| `#10b981` (primary emerald) | `var(--primary)` | ikut tema aktif (`navy` = biru) |
| `rgba(16,185,129,.15)` | `var(--primary-glow)` | konsisten |
| `#0f172a` sebagai `backgroundColor` card | `var(--bg-card)` | putih di tema navy |
| `#0f172a` sebagai teks di atas putih | `var(--text-primary)` | tetap aman |
| `#ffffff` teks di atas card | `var(--text-primary)` | hindari teks putih di card putih |
| `#cbd5e1` teks sekunder | `var(--text-secondary)` | kontras terukur |
| `#94a3b8` teks muted | `var(--text-muted)` | kontras `#64748b` di navy lebih baik |
| `#f59e0b` warning | `var(--secondary)` | token tema |
| `rgba(255,255,255,.04)` panel | `var(--bg-card-hover)` | hapus "kartu gelap transparan" |

**Aturan tambahan:** semua inline `style={{color:'#...'}}` diganti token. Setelah selesai, `grep -c '#[0-9a-fA-F]\{6\}'` pada ketiga file harus **0** (kecuali komentar).

---

## 5. Perbaikan Data-Flow (agar edit admin benar-benar tampil)

### 5.1 Masalah

`sections` di DB `null` → artikel dari hardcoded fallback → admin edit `content` markdown tidak berujung ke UI pasal.

### 5.2 Solusi (urutan prioritas di `hydratePolicyDocs`)

`frontend/*/src/utils/policyShared.tsx`:

```
1. draftOverride            (pratinjau admin)      — tetap paling tinggi
2. sections.articles (JSON)  (bila ada & length>0)
3. BARU: parse dbPolicy.content (markdown) → articles
4. fallback.articles         (statis, terakhir)
```

### 5.3 Parser markdown → pasal (baru, fungsi murni)

Tambahkan `parsePolicyMarkdownToArticles(markdown: string): PolicyArticle[]`:

- Heading `### 1. Judul` / `## 1. Judul` / `**1. Judul**` → pasal baru; ambil nomor bila ada, sisanya jadi `heading`
- Paragraf di bawah heading → `content`
- Baris `- ` / `* ` di bawah heading → `highlights[]`
- Baris `> ` **pertama** sebelum heading pertama → `summary`
- Heading level 1 (`#`) di awal dokumen → **diabaikan** sebagai judul dokumen (sudah dipakai `title`), agar tidak dobel
- Kalau hasil parse < 1 pasal → kembalikan `[]` (biar jatuh ke fallback)
- **Tanpa** dependency baru; murni string ops (`split`, regex). Tidak boleh merusak `renderPolicyArticleContent` yang sudah ada.

### 5.4 Test unit (wajib, tanpa dependency baru)

File baru `frontend/desktop/src/utils/policyShared.parse.test.ts` (Vitest):

| Kasus | Ekspektasi |
|---|---|
| Markdown 3 heading `###` | 3 artikel, `heading` benar, nomor terbaca |
| Markdown heading `**1. X**` | terdeteksi |
| Markdown tanpa heading | `[]` → fallback dipakai |
| `content` kosong / `null` | `[]` (tidak crash) |
| `sections` ada | markdown **tidak** dipakai (prioritas 2 menang) |
| Highlight `- butir` | masuk `highlights[]` |
| Link markdown `[x](https://…)` | tetap utuh di `content`, disanitasi oleh renderer yang ada |

### 5.5 Catatan keamanan (tidak boleh regresi)

- Markdown tetap dirender oleh `renderPolicyInlineMarkdown` / `renderPolicyArticleContent` yang **sudah** memvalidasi URL via `checkUrlSecurity` (SEC-FE-01). Parser baru **tidak** boleh menghasilkan HTML mentah.
- Tidak menambah `dangerouslySetInnerHTML`.

---

## 6. File yang Akan Diubah

| File | Aksi | Perkiraan diff |
|---|---|---|
| `frontend/desktop/src/components/PlatformPoliciesView.tsx` | Tulis ulang presentasi (token, grid responsif, `h1`, daftar isi) | ±250 baris |
| `frontend/tablet/src/components/TabletPoliciesView.tsx` | Sama, breakpoint tablet | ±220 baris |
| `frontend/mobile/src/components/MobilePoliciesView.tsx` | Sama, tab scroll + accordion terbuka + `h1` | ±200 baris |
| `frontend/*/src/utils/policyShared.tsx` (×3) | Tambah `parsePolicyMarkdownToArticles` + urutan hidrasi baru | ±80 baris/file |
| `frontend/desktop/src/utils/policyShared.parse.test.ts` | **Baru** — test parser | ±90 baris |
| `frontend/*/src/index.css` | **(opsional)** tambah `.policy-prose` untuk tipografi pasal | ±30 baris |

**Tidak diubah:** backend (Go), route, URL publik, `*PolicyManager.tsx`, skema DB, `.env`.

---

## 7. Urutan Eksekusi

1. **Baseline tersimpan** — screenshot + DOM probe 3 device × 3 route sudah ada (§2.4); simpan juga probe mobile/tablet yang belum diambil.
2. **Parser + test dulu** (TDD ringan): tulis `parsePolicyMarkdownToArticles` + 7 kasus test, jalankan `npx vitest run`, **hijau sebelum** menyentuh UI.
3. **Desktop** — terapkan token + grid responsif + `h1` + daftar isi. `tsc -b` bersih.
4. **Tablet** — sama, verifikasi breakpoint 834px.
5. **Mobile** — tab scroll + accordion terbuka + `h1`.
6. **Build** — `npm run build` di ketiga app.
7. **Verifikasi runtime** dari **bundel hasil build** (`vite preview`), bukan dev server.
8. **Screenshot after** 3 device × 3 route, bandingkan berdampingan dengan baseline.
9. **Ukur kontras piksel** pada: tombol CTA, badge versi, teks muted, tab aktif.
10. **Laporan** dengan tabel before/after + temuan yang **gagal diverifikasi** disebut eksplisit.

---

## 8. Kriteria Selesai (harus terbukti, bukan diklaim)

| # | Kriteria | Cara bukti |
|---|---|---|
| C1 | `grep -c '#[0-9a-fA-F]\{6\}'` = **0** di 3 komponen | perintah grep |
| C2 | Tepat **1** `<h1>` per route per device | DOM probe |
| C3 | `h3` (pasal) count **sama** di 3 device untuk dokumen yang sama | DOM probe |
| C4 | `overflowX === false` di 390/834/1440 | DOM probe |
| C5 | Tidak ada elemen interaktif < 44×44px di mobile | DOM probe (ukur `getBoundingClientRect`) |
| C6 | Kontras teks ≥ 4.5:1 (≥3:1 untuk ≥24px) | `contrast-pixel.py` pada crop |
| C7 | `content` markdown dari DB **muncul** sebagai pasal (uji dengan data uji, bukan data produksi) | ubah 1 nilai di DB uji → muat ulang → pasal berubah |
| C8 | `npx vitest run` parser: 7/7 hijau | output test |
| C9 | `tsc -b` + `npm run build` ketiga app exit 0 | output build |
| C10 | Console error **0** di 9 kombinasi device × route | DOM probe |
| C11 | Pratinjau admin (`*PolicyManager.tsx:1366`) tidak rusak | screenshot panel admin |

**Kalau ada kriteria gagal:** dilaporkan sebagai gagal. Tidak ada klaim "aman semua".

---

## 9. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Parser salah memecah pasal → konten berantakan | Fallback berlapis: kalau parse < 1 pasal, pakai `fallback.articles`. Test 7 kasus sebelum UI disentuh. |
| Pratinjau admin ikut berubah tampilan | C11 — screenshot panel admin sebelum/sesudah |
| Tiga file `policyShared.tsx` divergen | Terapkan patch identik; `diff` ketiga file setelah selesai, perbedaan hanya boleh pada import/nama |
| `navy` bukan satu-satunya tema aktif | Semua warna lewat token, jadi tema lain (`cream`, `sage`) otomatis ikut benar |
| Build dist basi ter-commit | Patuh urutan: patch → `tsc -b` → `npm run build` → **grep bundel untuk marker** → `git add` → commit |
| Server `:8001` memakai DB bersama `catavor` | Semua uji data-flow memakai **nilai uji yang dikembalikan**, tidak meninggalkan perubahan; tidak menjalankan migrasi (`DB_AUTO_MIGRATE=false`) |

---

## 10. Di Luar Scope

- Perubahan skema DB / migrasi
- Perubahan endpoint backend
- Redesign halaman admin pengelola kebijakan
- Perubahan route/URL publik (`/terms`, `/privacy`, `/acceptable-use`, dll.)
- Penggantian library markdown
- Multi-bahasa (i18n)

---

## 11. Lampiran — Perintah Verifikasi

```bash
# baseline DOM probe (sudah dijalankan)
node /c/MyProject/DFauna/tests/qa-policy-before.cjs

# cek warna hardcode hilang
grep -c '#[0-9a-fA-F]\{6\}' frontend/*/src/components/*PoliciesView.tsx

# test parser
cd frontend/desktop && npx vitest run src/utils/policyShared.parse.test.ts

# build ketiga app
cd frontend/desktop && npm run build
cd frontend/tablet  && npm run build
cd frontend/mobile  && npm run build

# verifikasi bundel hasil build (bukan dev server)
cd frontend/desktop && npm run preview -- --port 5199 --host 127.0.0.1
```

---

**Berhenti di sini.** Dokumen ini rencana — belum ada file kode yang diubah. Eksekusi menunggu persetujuan.
