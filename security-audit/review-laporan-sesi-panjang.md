# Review Relevansi — Laporan Master Sesi Panjang (versi agent lain)

**Tanggal review**: 2026-10-16
**Metode**: verifikasi independen setiap klaim (nomor baris, potongan kode, statistik) terhadap kode aktual. Tidak mengubah file laporan.
**Status**: read-only.

## Kesimpulan

**Sebagian besar RELEVAN dan akurat — jauh lebih detail dari versi awal.** Struktur, severity ranking, dan phased plan sehat. Tapi ada **beberapa klaim spesifik yang salah/overstated** dan **1 instruksi uji fabricated**. Perlu koreksi agar dokumen bisa dipercaya sebagai basis eksekusi.

---

## ✅ Klaim TERVERIFIKASI BENAR

| ID | Klaim | Status | Bukti |
|---|---|---|---|
| CRIT-1 | `isBottomNavVisible` terikat `!error` → bottom nav hilang saat error | ✅ benar | `mobile/App.tsx:17529` persis seperti dikutip, `!error` ada di ekspresi |
| CRIT-2 | Nol Error Boundary di seluruh app | ✅ benar | grep `ErrorBoundary\|componentDidCatch` = 0 hasil (kedua platform) |
| CRIT-3 | Race 150ms `isPopStateRef` + `pushState` menjebak | ✅ benar | `mobile:10311-10313`, `desktop:10243-10245`; `desktop:11303` `if (isPopStateRef.current) replaceState else pushState` |
| CRIT-4 | Ketidakseimbangan cleanup hook (73/34 desktop, 71/30 mobile) | ✅ benar | angka persis cocok |
| HIGH-1 | 6 bottom sheet tanpa `useModalBackHandler` | ✅ benar | `showCategorySheet`(6850) `showSortSheet`(6851) `showFilterSheet`(6852) `showAdminFilterSheet`(7116) `showProductTypeSelector`(6854) `reportModalData`(6858) — tidak ada di 9 call-site yang terpasang |
| HIGH-2 | SWR cache tanpa eviction + risiko QuotaExceededError | ✅ benar | `apiClient.ts` `memoryCache.set` + `localStorage.setItem` tanpa cap/TTL, `catch {}` menelan exception |
| HIGH-3 | SSE depend `[storeSlug, portalTab]`, `onerror` kosong, token di query | ✅ benar | `desktop:5754` (`onerror` = komentar "SSE will auto-retry"), URL `?token=` |
| HIGH-4 | Scroll listener tanpa `requestAnimationFrame` | ✅ benar (parsial — lihat koreksi) | `mobile:11645` handler murni, tanpa rAF |
| MED-1..4 | Idle resync, Set/Map tumbuh, sessionStorage sekali-pakai, no telemetry | ✅ benar | sesuai temuan versi awal |
| §4 | Backend SSE hub solid, dedupe in-flight, observer disconnect | ✅ benar | terverifikasi |

---

## ⚠️ KLAIM YANG PERLU DIKOREKSI

### K1. CRIT-1 — penyebab `error` salah disebut
- **Laporan**: error ter-set dari "background polling (tiket/notifikasi/kuota) yang gagal karena sinyal putus sesaat".
- **Fakta**: 5 call-site `setError` (mobile) **semua dari fetch katalog utama** — `fetchFaunas`/`fetchSettings` gagal muat (baris 11042, 11210, 11237, 11321, 11323). **Tidak ada** polling tiket/notif yang memanggil `setError`.
- **Implikasi**: gejala footer hilang tetap nyata, tapi **pemicunya "gagal load katalog/toko"** (mis. 404 saat slug banned, network drop saat buka katalog), **bukan** "sinyal putus sesaat saat sedang di menu". Koreksi ini penting supaya orang tidak mencari bug di tempat yang salah.

### K2. HIGH-4 — "tiap pixel memicu re-render" overstated
- **Fakta**: `handleSmartFilterScroll` memakai **akumulator** (`accumulatedDown > 10`, `accumulatedUp > 5`) sebelum `setIsFilterHidden`. Jadi tidak tiap pixel memicu setState; ada batching kasar.
- **Yang benar**: handler tetap dieksekusi tiap event scroll (bisa puluhan/detik), tidak di-throttle rAF, jadi `setState` bisa terpanggil beberapa kali/detik pada scroll cepat → masih layak diperbaiki, tapi bukan "tiap pixel".

### K3. ">260 useState" → aktual 308/282
- Laporan menyebut ">260 useState". Aktual: **308 (mobile)**, **282 (desktop)**. Laporan understated — tidak salah arah, tapi angka harus diperbaiki (memperkuat argumen monolith, bukan melemahkan).

### K4. HIGH-1 — "melanggar AGENTS.md Rule 2" benar, tapi konteks impor perlu ditambah
- `useModalBackHandler` **sudah dipakai 9×** di mobile (2599, 2601, 9596-9600, 9605, 9617). Jadi bukan "belum ada mekanisme" — mekanisme ada, hanya **6 sheet spesifik** yang lolos. Sudah disampaikan benar di laporan, tapi rumusan "6 Bottom Sheet Mobile Belum Dilindungi" harus dibaca sebagai "belum, meski hook tersedia".

---

## ❌ KLAIM FABRICATED / TIDAK VALID

### F1. `window.__triggerNetworkFailure()` tidak ada
- **Lokasi**: §8 Protokol Pengujian, poin 1.
- **Fakta**: grep `__triggerNetworkFailure` di seluruh `frontend/` = **0 hasil**. Fungsi ini tidak ada di kode. Instruksi uji ini **tidak bisa dijalankan**.
- **Ganti dengan**: DevTools > Network > block request `*/api/subscription/my-quota` atau `*/api/u/*` (offline via Network throttling), lalu cek apakah bottom nav bertahan.

---

## Catatan tambahan (bukan klaim salah, tapi perlu ditandai)

- **N1.** Laporan menyebut komponen `ActionMenu`/`BottomSheet` dengan nama generik, padahal di kode ini modal/sheet adalah state boolean di `App.tsx`, bukan komponen terpisah. Rencana Fase 1 Task 1.4 (`closeAllTransientModals()`) bagus, tapi harus reset ~11 flag boolean (lihat ekspresi `isBottomNavVisible`), bukan sekadar `actionMenuData`/`isDetailActive`/`selectedFauna` (laporan hanya menyebut 3).
- **N2.** Nomor baris di laporan akurat pada saat pembuatan, tapi `App.tsx` 34k baris = sangat volatil. Semua nomor baris di dokumen ini sebaiknya dianggap "snapshot", bukan anchor permanen. Saat eksekusi, cari via symbol/grep, jangan hardcode baris.
- **N3.** Fase 1 Task 1.5 ("ganti timer 150ms dengan Synchronous Navigation Lock") — arahnya benar, tapi perlu spesifik: **solusi kanonik (lihat StackOverflow Chrome-only case) = pisahkan popstate dari effect sync URL, dan jangan pernah panggil `pushState` sebagai reaksi atas popstate**. Flag/lock saja tidak cukup jika effect masih memanggil pushState karena race.

---

## Verdict review

| Aspek | Penilaian |
|---|---|
| Akurasi temuan kode | 🟢 85% akurat (CRIT-1..4, HIGH-1..3, MED semua valid) |
| Akurasi statistik | 🟡 1 salah (useState count), 1 overstated (scroll) |
| Kelayakan eksekusi plan | 🟢 3 fase sehat dan berurutan benar |
| Instruksi uji | 🟠 1 fabricated (`__triggerNetworkFailure`), sisanya valid |
| Kesiapan dipakai sebagai basis fix | 🟡 **Setelah 4 koreksi (K1-K4) + 1 hapus (F1)** → siap |

**Rekomendasi**: dokumen ini **layak dipakai** sebagai basis penyempurnaan setelah koreksi K1 (pemicu error), F1 (hapus fungsi uji palsu), K3 (angka useState), dan penajaman N1/N3. Tanpa koreksi, tim berisiko salah diagnosis CRIT-1 dan menjalankan test yang mustahil.
