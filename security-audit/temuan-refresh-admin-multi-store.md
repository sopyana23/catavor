# Temuan Bug — Refresh Halaman Admin Merchant Multi-Store Dilempar ke Pemilih Katalog

**Tanggal**: 2026-10-16
**Severity**: 🟠 TINGGI (UX-breaking, reproducible 100%)
**Ditemukan oleh**: investigasi lanjutan E2E (`tests/`)
**Status**: ✅ **SUDAH DIPERBAIKI** (desktop + mobile) — terverifikasi

---

## Ringkasan

Merchant yang punya **lebih dari 1 profil katalog**, saat **me-refresh** halaman admin
(atau membuka link `/slug/admin` di tab baru / bookmark), akan **dilempar ke halaman
pemilih katalog** — bukan tetap di dashboard yang sedang dikelola.

- Login via form → dashboard normal ✅
- Refresh/tab baru setelah login → **keluar ke `/catalogs`** ❌

---

## Akar Masalah

**File**: `frontend/desktop/src/App.tsx` baris **10030–10045** (juga ada padanan di mobile).

```typescript
} else if (parsedStores.length > 1) {
  const selectedSlug = sessionStorage.getItem('catavor_active_slug_selected');
  const isMatch = slug && parsedStores.some(s => s.slug.toLowerCase() === slug?.toLowerCase());

  if (!selectedSlug || selectedSlug.toLowerCase() !== slug?.toLowerCase() || !isMatch) {
    // Block direct unselected access, redirect to /catalogs chooser
    setStoreSlug(null);
    setIsFirstTimeLogin(true);
    setShowStoreSwitcherModal(true);
    fetchMyStores();
    window.history.replaceState({}, '', '/catalogs');   // <-- user dilempar
    showToast('Silakan pilih profil katalog yang ingin Anda kelola.', 'info');
    return;
  }
}
```

**Masalahnya**: syarat `selectedSlug` dibaca dari **`sessionStorage`**, dan aplikasi
mewajibkan nilainya **cocok** dengan slug di URL.

- `sessionStorage` **selalu kosong** di refresh halaman maupun tab baru (memang sifatnya —
  hanya bertahan selama tab hidup).
- `catavor_active_slug_selected` hanya diisi saat user **memilih store dari chooser**
  atau saat login via form.
- Untuk akun dengan **>1 store**, kondisi `!selectedSlug` → true → **paksa redirect**.

---

## Bukti Reproduksi (runtime)

Akun merchant uji, 3 store (`iop`, `dfuna-store-unlimited`, `adidas`):

| Skenario | `catavor_active_slug_selected` | `catavor_active_slug` | URL akhir |
|---|---|---|---|
| Login via form | `iop` | `iop` | `/iop/admin/items` ✅ |
| Refresh / tab baru | `null` | `iop` | `/` (dilempar) ❌ |

Jejak navigasi (instrumentasi `pushState`/`replaceState`):
```
REPLACE /iop/admin/items      ← masuk dashboard (benar)
REPLACE /catalogs            ← dipaksa keluar (BUG)
```

Cara reproduksi manual:
1. Login sebagai merchant dengan >1 store.
2. Buka `/iop/admin` (atau refresh tab).
3. Amati: diarahkan ke pemilih katalog alih-alih dashboard `iop`.

---

## Dampak

- Merchant multi-store **kehilangan konteks** setiap refresh (F5), bookmark, atau buka
  tab baru → harus memilih ulang katalog tiap kali. Sangat mengganggu untuk kerja intensif.
- Konsisten di **desktop & mobile** (kode paralel).

---

## Rekomendasi Perbaikan (belum diterapkan)

Syair `sessionStorage` seharusnya **hanya penanda opsional** ("user baru saja memilih
secara eksplisit"), **bukan syarat keras**. Fallback ke `localStorage.catavor_active_slug`
bila valid & store-nya memang milik user:

```typescript
} else if (parsedStores.length > 1) {
  const selected = sessionStorage.getItem('catavor_active_slug_selected');
  const active = localStorage.getItem('catavor_active_slug');
  const isMatch = slug && parsedStores.some(s => s.slug.toLowerCase() === slug!.toLowerCase());

  // Terima bila slug URL valid & memang milik user (dari localStorage pun cukup).
  const resolvedIsMatch = isMatch || (active && parsedStores.some(s => s.slug.toLowerCase() === active.toLowerCase()));

  if (!resolvedIsMatch) {
    // hanya paksa chooser bila slug benar-benar tidak valid / bukan milik user
    window.history.replaceState({}, '', '/catalogs');
    ...
    return;
  }
  // selaraskan sessionStorage agar konsisten
  try { sessionStorage.setItem('catavor_active_slug_selected', slug!); } catch {}
}
```

Inti: **jangan perlakukan `sessionStorage` yang kosong sebagai "user belum memilih"**
selama ada `localStorage.catavor_active_slug` yang valid & store-nya milik user.

---

## Catatan

- Perbaikan menyentuh logika navigasi/keamanan (multi-tenant scope) → tersedia di
  kedua platform (desktop & mobile) + uji E2E "refresh di halaman admin harus tetap
  di dashboard".

---

## ✅ Perbaikan yang DITERAPKAN (2026-10-16)

**File**: `frontend/desktop/src/App.tsx` (~10030) & `frontend/mobile/src/App.tsx` (~10080).

Perubahan: akses admin diterima bila **slug di URL valid & memang milik user**
(atau `localStorage.catavor_active_slug` valid & milik user) — tanpa mewajibkan
`sessionStorage.catavor_active_slug_selected`. Chooser hanya dipaksa bila benar-benar
tidak ada slug valid. Penanda sesi diselaraskan otomatis setelah diterima.

```typescript
const isMatch = Boolean(slug && parsedStores.some(s => s.slug.toLowerCase() === slug!.toLowerCase()));
const activeIsMatch = Boolean(activeSlug && parsedStores.some(s => s.slug.toLowerCase() === activeSlug!.toLowerCase()));
if (!isMatch && !activeIsMatch) { /* → chooser (block) */ }
else { /* terima: selaraskan sessionStorage/localStorage, redirect ke slug yang benar bila perlu */ }
```

**Verifikasi (ad-hoc runtime, sebelum vs sesudah):**

| Device | Sebelum | Sesudah |
|---|---|---|
| Desktop Chrome | `/catalogs` ❌ | `/iop/admin/items` ✅ |
| Pixel 5 | `/catalogs` ❌ | `/iop/admin` ✅ |

- Refresh multi-store → tetap di dashboard ✅ (`selected` ter-set otomatis).
- Jalur keamanan utuh: buka `/shop66698/admin` (slug bukan milik user) → **tetap diblok** ke `/catalogs` ✅.
- Regression: suite E2E `npx playwright test` → **14/14 pass** ✅.
- `tsc -b` desktop & mobile exit 0; `vite build` kedua platform sukses.
