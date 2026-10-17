# Blueprint Modularisasi `App.tsx` — Catavor (Task 3.3)

**Tanggal**: 2026-10-17
**Status**: rencana. **Tidak ada kode yang diubah** pada task ini.
**Basis**: pengukuran aktual pada `mobile/src/App.tsx` (34.723 baris) dan
`desktop/src/App.tsx` (34.004 baris) di commit `7d24605`.

---

## 1. Diagnosis — masalahnya bukan "34.000 baris"

Kalau masalahnya panjang file, jawabannya cuma "pecah jadi banyak file". Itu
tidak akan menolong. Yang menimbulkan biaya nyata ada tiga, dan semuanya bisa
diukur:

### 1.1 Satu blok render raksasa

| Platform | Blok | Baris |
|---|---|---|
| mobile | `activeTab === 'admin' && (...)` di L23435 | **7.579** |
| desktop | `view === 'admin' ? (...)` di L20849 | **8.375** |
| mobile | `activeTab === 'catalog' && (...)` di L22451 | 796 |
| desktop | blok katalog publik (L19222 + L19485) | ~165 |

Total blok `return` JSX utama: **16.877 baris (mobile)**, **16.612 baris (desktop)** —
sekitar setengah dari seluruh file hanya untuk satu pohon JSX.

Konsekuensinya: setiap perubahan satu panel admin menyentuh file yang sama dengan
setiap perubahan katalog, auth, dan notifikasi. Diff review jadi susah, merge
conflict hampir pasti, dan tidak ada batas modul yang bisa diuji terpisah.

### 1.2 Kepemilikan state yang menyebar

| Platform | `useState` | `useRef` | `useEffect` | handler top-level |
|---|---|---|---|---|
| mobile | **306** | 41 | 72 | 202 |
| desktop | **280** | 37 | 74 | 179 |

Sebaran per area (mobile / desktop, jumlah state):

| Area | mobile | desktop |
|---|---|---|
| auth / login / SSO / OTP | 43 | 43 |
| katalog / produk / filter | 41 | 34 |
| admin / store / kuota / langganan | 20 | 24 |
| support / tiket / appeal | 18 | 17 |
| notifikasi | 12 | 13 |
| keranjang / checkout | 11 | 10 |
| artikel | 8 | 0 |
| moderasi / compliance | 5 | 5 |
| analytics | 4 | 4 |
| UI murni (modal/sheet/tab/theme) | 53 | 44 |
| tidak terklasifikasi | 91 | 86 |

`useState` di satu komponen berarti setiap `setState` me-render ulang **seluruh**
pohon, termasuk 7.500 baris panel admin yang tidak berubah. Inilah penyebab
"UI terasa berat setelah dipakai lama" yang lebih mungkin daripada kebocoran
listener (yang sudah dibuktikan nol di Task 2.1).

### 1.3 Handler gemuk

Fungsi terbesar (mobile): `parseModerationCase` 319 baris, `loadData` 303,
`processGoogleUserPayload` 206, `handleFaunaSubmit` 199, `fetchSupportTickets` 184.
Desktop serupa (`renderCategoryTaxonomyManager` 333, `loadData` 295).
Ini logika domain yang menumpang di lapisan komponen — tidak bisa diuji tanpa
me-render UI.

---

## 2. Prinsip ekstraksi (urutan yang dipakai)

1. **Pecah render dulu, state kemudian.** Memindahkan JSX 7.500 baris ke
   komponen anak memberi 80% manfaat dengan risiko paling kecil: props eksplisit,
   tidak ada perubahan perilaku, mudah direview.
2. **Jangan sentuh state global dulu.** 306 `useState` dipindah sekaligus =
   refactor mustahil & tidak bisa diverifikasi. State ikut pindah **hanya** untuk
   modul yang diekstrak.
3. **Satu modul per commit**, dengan E2E yang sudah ada sebagai jaring pengaman
   (30 test, 2 device).
4. **Tidak memperkenalkan state library** (Redux/Zustand) di tahap ini. Context
   lokal per fitur cukup; menambah dependency sebelum perlu = tepat apa yang
   dihindari.

---

## 3. Sasaran modul — urut berdasarkan angka, bukan selera

### Tahap A — Panel Admin (dampak terbesar, 7.579 / 8.375 baris)

Target: `modules/admin/`

| Modul | Isi (dari render saat ini) | state terkait (perkiraan) |
|---|---|---|
| `AdminItemsPanel` | daftar item, filter, bulk action, modal hapus | ~15 |
| `AdminOrdersPanel` | pesanan, status, checkout view | ~8 |
| `AdminStoreSettings` | profil toko, tema, jam operasional | ~10 |
| `AdminSubscription` | kuota, langganan, invoice | ~6 |
| `AdminHelpdesk` | tiket, percakapan, lampiran | ~18 (modul support digabung) |
| `AdminCompliance` | moderasi, banding, laporan | ~5 |

Cara ekstrak: buat komponen menerima `storeSlug`, `token`, `onUnauthorized`
sebagai props, dan **pindahkan JSX apa adanya** lebih dulu. Refactor internal
menyusul per modul, bukan bersamaan.

Prasyarat verifikasi: `history-back.spec.ts` + panel admin manual checklist
(login → tiap sub-tab → back), karena E2E admin otomatis sudah dihapus (flaky
akibat `AuthRateLimiter`).

### Tahap B — Katalog & Editor (796 + 165 baris render, 41/34 state)

Target: `modules/catalog/`

- `CatalogList` — grid, filter, sort, infinite scroll (pakai ulang
  `fetchServerCatalog` yang sudah `useCallback`)
- `ProductEditor` — `view === 'fauna-editor'` (199 baris handler submit)
- `ProductTypeSelector` — layar pilih tipe produk

Risiko sedang: katalog adalah jalur yang diuji E2E (`history-back`,
`device-sanity`), jadi regresi langsung ketahuan.

### Tahap C — Auth & Onboarding (43 state, 4 handler besar)

Target: `modules/auth/`

- `LoginView`, `RegisterView`, `OtpView`, `GoogleSsoHandler`
- `processGoogleUserPayload` (206) dan `handleGoogleSSO` (144) pindah ke
  `services/auth/` sebagai fungsi murni — bisa diuji tanpa render.

Ini modul paling sensitif. **Dikerjakan setelah A dan B stabil**, dan butuh
E2E login yang tidak kena rate limit (pakai `storageState` per-worker atau
naikkan batas limiter di env test).

### Tahap D — Support/Notifikasi/Artikel

- `modules/support/` — tiket, appeal, lampiran
- `modules/notifications/` — list, detail, SSE consumer (SSE sudah punya
  backoff + cleanup, tinggal dipindah)
- `modules/articles/` — sudah sebagian di `components/`, sisanya

---

## 4. Yang **tidak** dilakukan

- **Tidak** memecah `App.tsx` jadi 50 file sekaligus. Satu modul per commit.
- **Tidak** menambah state library.
- **Tidak** menulis ulang logika saat memindahkan. Pindah dulu, rapikan nanti —
  kalau digabung, tidak ada yang bisa dibedakan antara "perilaku berubah" dan
  "kode dipindah".
- **Tidak** menyentuh `parseModerationCase` (319 baris) di Tahap A. Fungsi itu
  perlu test karakterisasi dulu; tanpa itu, memindahkannya = menebak.

---

## 5. Definition of done per tahap

| Cek | Alat |
|---|---|
| Perilaku tidak berubah | `npx playwright test` (30 test, 2 device) |
| Tidak ada kebocoran baru | `task-21-effect-cleanup.spec.ts` |
| Typecheck | `tsc -b` kedua platform, exit 0 |
| Bundle tetap tersaji | `index.html` menunjuk bundle yang ada, nol orphan |
| Ukuran file turun | hitung ulang `wc -l` App.tsx per commit |
| Tidak ada dead code | `grep` simbol yang ditulis tapi tidak dibaca (audit sebelumnya menemukan pola ini di kerja agent lain) |

---

## 6. Estimasi realistis

| Tahap | Baris render dipindah | Sesi kerja |
|---|---|---|
| A — Admin | ~15.900 (2 platform) | 4–6, satu sub-panel per sesi |
| B — Katalog & editor | ~960 | 2 |
| C — Auth | ~2.000 + 4 handler | 3 (butuh E2E login dulu) |
| D — Support/notif/artikel | ~2.500 | 3 |

App.tsx perkiraan turun dari 34.000 ke ~8.000–10.000 baris setelah Tahap A+B,
dan ke bawah 5.000 setelah semua tahap.

---

## 7. Rekomendasi

Kerjakan **Tahap A sub-panel pertama (`AdminItemsPanel`)** sebagai pilot: blok
terbesar, jalur yang tidak diuji E2E otomatis (jadi tidak akan menutupi regresi),
dan hasilnya langsung terasa di ukuran file. Kalau pilot itu lolos semua cek di
§5, polanya dipakai untuk sisa sub-panel.

Kalau prioritas sebenarnya adalah performa render (bukan maintainability),
ekstraksi komponen saja tidak cukup — perlu `useMemo`/`React.memo` per panel
atau memindahkan state ke context per fitur. Itu keputusan terpisah yang perlu
diukur dulu dengan React Profiler, bukan diasumsikan.
