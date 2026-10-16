# Review Relevansi — Laporan Master Sesi Panjang v1.1 (Post-Review)

**Tanggal review**: 2026-10-16
**Target**: `security-audit/long-session-resilience-audit.md` (Revisi v1.1 - Verified & Corrected)
**Metode**: verifikasi independen klaim baru + klaim yang dikoreksi, terhadap kode aktual. Read-only.

## Kesimpulan

**v1.1 SUDAH MEMPERBAIKI hampir semua temuan review sebelumnya. Relevan dan akurat.** Koreksi K1-K4 diterapkan, F1 (fungsi uji fabricated) dihapus. Tersisa **2 cacat kecil** yang belum diperbaiki dan **1 klaim baru yang salah**.

**Status: layak dipakai sebagai basis eksekusi** setelah 2 perbaikan minor di bawah.

---

## ✅ Koreksi yang BERHASIL diterapkan (terverifikasi)

| Item | Sebelumnya | v1.1 | Verifikasi |
|---|---|---|---|
| **K1** pemicu `error` | diklaim dari polling tiket/notif | dikoreksi → 5 `setError` semua dari `fetchFaunas`/`fetchSettings`, sebut baris 11042/11210/11237/11321/11323 | ✅ akurat, cocok dgn kode |
| **K2** scroll | "tiap pixel memicu setState" | dikoreksi → akumulator ada (10px/5px), tapi listener tetap mentah tanpa rAF | ✅ akurat |
| **K3** useState | ">260" | → **308 mobile / 282 desktop** | ✅ akurat |
| **K4** HIGH-1 | "6 sheet belum dilindungi" (ambigu) | ditambah konteks: hook **sudah ada di 9 tempat**, 6 sheet spesifik terlewat | ✅ akurat |
| **F1** uji fabricated | `window.__triggerNetworkFailure()` | dihapus → diganti DevTools Request Blocking / Offline | ✅ terverifikasi fungsi palsu sudah hilang dari §8 |
| **N1** task 1.4 | reset 3 flag | → reset ~11 flag, disertai daftar | ✅ ekspresi memang punya 16 kondisi boolean |
| **N2** volatilitas baris | tidak ada | ditambah disclaimer "snapshot, cari via grep" | ✅ ditambahkan |
| **N3** task 1.5 | "lock sinkron" saja | → ditambah aturan kanonis: jangan pernah `pushState` saat respons `popstate` | ✅ ditambahkan |

Referensi §2.3 juga ditambah solusi kanonis (memisahkan popstate dari effect sync URL) — sesuai temuan review. Bagus.

---

## ⚠️ CACAT MINOR YANG BELUM DIPERBAIKI

### C1. Nomor baris `useModalBackHandler` di HIGH-1 SALAH
- **Laporan v1.1 (baris 122)**: klaim hook terpasang di "baris 2599, 2601, 9596–9600, 9605, 9617".
- **Fakta** (grep aktual): baris 2581, 9596, 9597, 9598, 9599, 9600, 9605, 9617 — **plus import di 157**.
- **Salah**: baris **2599 & 2601 tidak ada** `useModalBackHandler` sama sekali (itu kode penyisipan teks editor: `prefix`, `selectionStart`, `substring`). Yang benar adalah **2581** (satu call), bukan 2599+2601.
- **Total call-site sebenarnya**: 8 (2581, 9596-9600, 9605, 9617) + 1 import. Laporan bilang "9 tempat" dengan angka baris keliru.

### C2. Klaim baru §5 matriks — "Token kedaluwarsa tanpa refresh flow"
- **Baris 211**: "Admin ter-logout tiba-tiba tanpa auto-refresh token ... Token kedaluwarsa tanpa refresh flow".
- **Fakta**: ada endpoint `POST /api/auth/refresh` (`main.go:260` → `authHandler.RefreshToken`) **dan** fungsi `RefreshToken` di `auth-handler.go:1260`. Jadi "tanpa refresh flow" **tidak akurat** — flow-nya ada di backend.
- **Klaim yang valid**: apakah frontend **proaktif memanggil** refresh sebelum exp (client-side silent-renew) — itu yang perlu diverifikasi, bukan "tidak ada flow". Rumusan harus diperbaiki agar tidak menyesatkan.

---

## Catatan tambahan (opsional)

- **O1.** §8 uji endpoint menyebut `*/api/faunas*`. Route aktual yang ada: `/api/fauna` (singular, `main.go:192`) dan `/api/u/:slug/fauna`. `/api/faunas` (plural) **tidak ada**. Perbaiki agar test tidak salah block target.
- **O2.** Task 1.4 daftar flag sekarang mencakup `selectedArticle` & `aboutSubView` — terverifikasi ada di mobile (6812, 6316) dan memang bagian dari ekspresi `isBottomNavVisible`. Bagus, konsisten.
- **O3.** Angka "~11 flag" masih understated terhadap realita (16 kondisi boolean di ekspresi, walau beberapa bukan "flag modal"). Minor, tidak fatal.

---

## Verdict review v1.1

| Aspek | Penilaian |
|---|---|
| Akurasi temuan kode | 🟢 ~95% akurat (naik dari 85%) |
| Akurasi statistik | 🟢 useState & hook count benar; 🟡 1 baris salah (C1) |
| Kelayakan eksekusi plan | 🟢 3 fase sehat, urutan benar |
| Instruksi uji | 🟢 F1 diperbaiki; 🟡 1 endpoint salah tulis (O1) |
| Kesiapan dipakai sebagai basis fix | 🟢 **SIAP** setelah koreksi C1 + C2 |

**Rekomendasi akhir**: v1.1 **relevan dan siap dipakai**. Cukup perbaiki C1 (nomor baris `useModalBackHandler` → 2581, 9596-9600, 9605, 9617) dan C2 (rumusan "tanpa refresh flow" → "refresh endpoint ada, perlu verifikasi apakah frontend memanggilnya proaktif"). O1 opsional. Setelah itu dokumen solid.
