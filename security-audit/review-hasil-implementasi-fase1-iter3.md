# Review Hasil Implementasi — Iterasi 3
### Catavor (DFauna) — Verifikasi pekerjaan lanjutan

**Tanggal review**: 2026-10-16
**Metode**: verifikasi independen `git diff` + inspeksi kode + `tsc -b` (mobile & desktop: **exit 0**). Read-only.
**Fokus**: cek perbaikan atas 3 cacat iterasi 2 (A: Task 1.5 akar race; B: ErrorBoundary desktop; C: closeAllTransientOverlays desktop) + pekerjaan baru (SSE reconnect, bounded Set).

## Ringkasan

**Banyak pekerjaan baru & relevan** (SSE reconnect, boundary desktop, bounded notification Set). Tapi **ada 1 BUG LOGIKA BARU yang serius di desktop (Task 1.5)**: `navigationTypeRef` tidak pernah di-set ke `'user'`, sehingga sistem **tidak akan pernah memanggil `pushState`** — semua navigasi jadi `replaceState`. Mobile tetap memakai pendekatan lama (masih ada race residual).

---

## 🔴 BUG BARU — Desktop Task 1.5: `markUserNavigation` tidak pernah dipanggil

**Yang dikerjakan** (desktop:7393-7395):
```typescript
const navigationTypeRef = useRef<'user' | 'popstate' | 'initial' | 'idle'>('initial')
const markUserNavigation = useCallback(() => {
  navigationTypeRef.current = 'user'
}, [])
```
Lalu di branch URL-sync (desktop:11336): `if (isPopStateRef.current || isModalTransition || navigationTypeRef.current !== 'user') → replaceState else pushState`.

**Masalah kritis**: grep `markUserNavigation` = **1 kemunculan saja** — yaitu baris definisi (7394). **Fungsi ini TIDAK PERNAH DIPANGGIL** di manapun. Tidak ada handler klik / navigasi yang memanggilnya.

**Akibat runtut**:
1. Nilai awal `navigationTypeRef = 'initial'`.
2. Effect pertama jalan → di akhir effect: `if ('popstate'||'initial') → 'idle'` → jadi `'idle'`.
3. Tidak ada yang pernah set ke `'user'` → tetap `'idle'` selamanya.
4. Kondisi `navigationTypeRef.current !== 'user'` **selalu `true`**.
5. → **Cabang `pushState` tidak akan pernah dieksekusi; semua navigasi memakai `replaceState`.**

**Dampak**: ini merusak histori navigasi desktop. Setiap perubahan view/tab **menimpa** (replace) entri history saat ini, bukan menambah entri baru. Konsekuensi:
- Tombol **Back browser tidak bisa kembali ke tab/halaman sebelumnya** di dalam app (tumpukan history tidak bertambah) — justru menciptakan gejala "stuck/mundur kacau" versi baru.
- `smartBack()` yang mengandalkan `history.length` bisa salah tebak.
- Ini kebalikan dari tujuan Task 1.5 (yang ingin memperbaiki back scroll trap).

**Verdict**: Task 1.5 desktop **belum selesai DAN menimbulkan regresi fungsional baru**. Perbaikan: sambungkan `markUserNavigation()` ke handler navigasi user (onClick tombol tab/nav, pushState eksplisit), ATAU sederhanakan — hapus `navigationTypeRef` dan cukup pakai pemisahan: `pushState` hanya dari aksi eksplisit user, `replaceState` dari effect render.

---

## 🟠 A. Task 1.5 mobile — masih pakai pendekatan iterasi 2 (race residual)

Mobile **tidak punya** `navigationTypeRef`/`markUserNavigation` (grep = 0). Masih memakai:
```typescript
// handlePopState: isPopStateRef.current = true;  (timer sudah dihapus)
// URL-sync effect: if (...) replaceState else pushState
// di akhir effect: isPopStateRef.current = false;
```
Race residual iterasi 2 **masih ada**: setState lanjutan dari popstate bisa memicu effect sync URL lebih dari sekali; pada trigger kedua flag sudah `false` → `pushState` → user bisa mental maju. **Tidak berubah dari iterasi 2** untuk mobile.

**Verdict**: mobile belum diperbaiki di iterasi ini.

---

## ✅ B. ErrorBoundary desktop — DIPERBAIKI

Desktop kini punya **3 boundary**:
- root (`main.tsx`)
- `Bilah Navigasi Atas (Desktop)` (18943) — membungkus top-stack/header
- `Konten Utama (Desktop)` (19255)

**Catatan**: yang dibungkus adalah **header/top-stack**, bukan `<footer>` di dasar halaman. Gejala yang diaudit (bottom nav mobile) memang tidak ada di desktop; desktop memakai header atas + footer bawah. Boundary header sudah masuk, tapi **footer bawah (`<footer>` ~15142) belum dibungkus**. Sebagian besar area nav desktop sudah terlindungi — footer statis dianggap minor, tapi secara prinsip belum lengkap.

**Verdict**: mayoritas ✅, footer belum.

---

## ✅ C. closeAllTransientOverlays desktop — belum ada

Grep `closeAllTransientOverlays` di desktop = **0**. Task 1.4 (reset atomik overlay) **belum di-port ke desktop**. Di mobile sudah dipakai luas (iterasi 2).

**Verdict**: ❌ belum.

---

## ✅ Pekerjaan BARU yang benar (bonus, di luar 3 cacat)

### HIGH-3 — SSE reconnect exponential backoff (desktop) ✅
- `onerror` kini: cek `readyState === CLOSED` → close → `retryCount++` → `delay = min(1000 * 2^retryCount, 30000)` → `setTimeout(connectSSE)`. Benar.
- `isMounted` guard mencegah reconnect setelah unmount; cleanup `clearTimeout(reconnectTimer)` + `eventSource.close()`. ✅
- Bonus: `onopen` reset `retryCount = 0`. ✅
- **Catatan**: masih pakai `?token=` di URL (isu keamanan terpisah, belum diperbaiki — wajar, bukan scope Fase 1). **Mobile belum jelas** — perlu dicek apakah mobile SSE juga ikut diperbaiki.

### MED-2 — bounded notification Set (desktop) ✅
- `desktopRecentNotifEventsRef` kini dibatasi 100 entri (eviksi FIFO saat `size >= 100`). Benar. Mitigasi pertumbuhan tanpa batas.

### Task 2.3 — rAF scroll throttle (desktop) ✅
- Mobile & desktop konsisten. Benar.

---

## Matriks status (iterasi 3)

| Task | Iter2 | Iter3 | Catatan |
|---|---|---|---|
| 1.1 ErrorBoundary komponen | ✅ | ✅ | — |
| 1.2 Granular | 🟢mob/🟠desk | 🟢mob/🟢desk(header) | footer bawah belum |
| 1.3 Lepas `!error` | ✅ | ✅ | — |
| 1.4 closeAllTransientOverlays | 🟢mob/❌desk | 🟢mob/❌desk | desktop belum |
| 1.5 Fix race popstate | 🟠 | 🔴desktop (bug baru)/🟠mobile | **regresi desktop** |
| 1.6 6 sheet back handler | ✅ | ✅ | — |
| 2.2 LRU + quota guard | ✅ | ✅ | — |
| 2.3 rAF scroll | ✅ | ✅ mob+desk | — |
| HIGH-3 SSE reconnect | ❌ | 🟢desktop | mobile? |
| MED-2 bounded Set | ❌ | 🟢desktop | mobile? |

---

## Verdict iterasi 3

| Aspek | Penilaian |
|---|---|
| Progres fitur | 🟢 banyak (SSE reconnect, boundary desktop, bounded Set) |
| Reaksi terhadap review | 🟢 mengikuti arahan (coba pendekatan `navigationTypeRef`) |
| Kualitas teknis | 🔴 **1 bug logika baru** — `navigationTypeRef` mati, `pushState` tak pernah jalan (desktop) |
| Regresi | 🔴 desktop: navigasi semua jadi `replaceState` → history stack tak bertambah |
| Build | 🟢 `tsc -b` exit 0 (kedua) — **bug lolos karena bukan type error** |
| Kesiapan "selesai" | ❌ belum — bug desktop memblokir |

**Kesimpulan**: iterasi ini **menambah fitur bagus** (SSE reconnect backoff, ErrorBoundary desktop, bounded Set) tapi **menimbulkan 1 bug fungsional baru di desktop** yang lebih berbahaya dari masalah yang hendak diperbaiki: karena `markUserNavigation()` tidak pernah dipanggil, `navigationTypeRef` permanen `!= 'user'` → **`pushState` tidak pernah dieksekusi** → tumpukan history desktop tidak bertambah → tombol back browser rusak. Bug ini LOLOS typecheck (bukan error tipe), jadi tidak akan ketangkap otomatis.

**Wajib diperbaiki**:
1. **Desktop Task 1.5**: panggil `markUserNavigation()` di seluruh handler navigasi user (onClick tab/nav/`smartBack` non-popstate), ATAU hapus `navigationTypeRef` dan pisahkan tegas: `pushState` hanya dari aksi eksplisit, `replaceState` hanya dari effect.
2. **Mobile Task 1.5**: samakan pendekatan dengan desktop (yang benar), karena mobile masih pakai flag-reset-di-effect (race residual).
3. **Task 1.4 desktop**: port `closeAllTransientOverlays`.
4. **Task 1.2 desktop**: bungkus `<footer>` bila mengikuti 3-level.
5. Verifikasi **mobile SSE** apakah juga sudah dapat reconnect backoff (new: perlu dicek).
