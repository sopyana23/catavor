# Review Hasil Implementasi — Iterasi 4
### Catavor (DFauna) — Verifikasi pekerjaan lanjutan

**Tanggal review**: 2026-10-16
**Metode**: verifikasi independen `git diff` + inspeksi kode + `tsc -b` (mobile & desktop: **exit 0**). Read-only.
**Fokus**: cek perbaikan atas bug iterasi 3 (desktop `navigationTypeRef` mati) + port mobile (SSE reconnect, bounded Set, Task 1.5).

## Ringkasan

**Mobile maju pesat** (SSE reconnect backoff + bounded Set kini ada di mobile juga). **Tapi desktop Task 1.5 di-ROLLBACK / dibongkar jadi lebih buruk**: `navigationTypeRef` dihapus, diganti dua ref (`isPopStateRef` + `isInitialLoadRef`) yang **salah satunya tidak pernah dibaca** dan **satunya lagi (`markUserNavigation`) tidak pernah dipanggil**. Alhasil desktop kembali ke bentuk iterasi 1/2 (race residual) DAN menambah dead code.

---

## 🔴 Desktop Task 1.5 — mundur, ada dead code baru

**Desktop:7392-7409** sekarang:
```typescript
const isPopStateRef = useRef<boolean>(false)
const isInitialLoadRef = useRef<boolean>(true)

// Canonical User Interaction Tracker
useEffect(() => {
  const handleUserInteraction = () => {
    isPopStateRef.current = false;
    isInitialLoadRef.current = false;
  };
  window.addEventListener('pointerdown', handleUserInteraction, { capture: true, passive: true });
  window.addEventListener('keydown', handleUserInteraction, { capture: true, passive: true });
  return () => { /* removeEventListener ... */ };
}, []);

const markUserNavigation = useCallback(() => {
  isPopStateRef.current = false;
  isInitialLoadRef.current = false;
}, [])
```

**Masalah 1 — `isInitialLoadRef` ditulis tapi TIDAK PERNAH DIBACA.**
Grep `isInitialLoadRef` = 4 kemunculan: deklarasi (7393), tulis di listener (7399), tulis di `markUserNavigation` (7411), dan — **tidak ada satupun di kondisi `if`**. Cabang URL-sync (11351) tetap:
```typescript
if (isPopStateRef.current || isModalTransition) { replaceState } else { pushState }
```
→ `isInitialLoadRef` **dead flag**. Menambah state yang tidak berpengaruh apa pun. Ini menandakan perbaikan iterasi 3 **tidak diganti dengan padanan fungsional** — hanya ditambah variabel yang lupa dipakai.

**Masalah 2 — `markUserNavigation` masih ORPHAN.**
Grep = 1 kemunculan (definisi 7409). Tidak pernah dipanggil. Meski isinya sekarang benar (clear flag), tidak ada yang memicunya.

**Masalah 3 — kembali ke akar race iterasi 1/2.**
Karena cabang `if` hanya bergantung `isPopStateRef || isModalTransition`, pola race lama **kembali utuh**: setState lanjutan pasca-popstate bisa memicu effect sync URL lagi; reset `isPopStateRef=false` di akhir effect (11367) membuat trigger kedua masuk `else → pushState` → user bisa mental maju. **Tidak lebih baik dari iterasi 2.**

**Yang benar**: tidak ada timer/rAF menggantung lagi (bagus), dan global `pointerdown`/`keydown` capture listener **secara teori** bisa menandai niat user — **tapi karena `isInitialLoadRef` tak dibaca dan `markUserNavigation` tak dipanggil, mekanisme itu tidak terhubung ke keputusan pushState/replaceState apa pun.** Alat dipasang, kabel tidak disambung.

**Verdict**: Desktop Task 1.5 **regresi + dead code**. Perlu: (a) baca `isInitialLoadRef` di cabang (mis. `if (isPopStateRef.current || isInitialLoadRef.current || isModalTransition) → replaceState`), atau lebih tegas — (b) gunakan flag "niat user" (`markUserNavigation`) yang di-reset setelah dipakai, dan panggil di handler navigasi eksplisit.

---

## ✅ Mobile — Task 1.5 masih bentuk lama (belum diperbaiki, konsisten dengan iterasi 2)

Grep mobile: hanya `isPopStateRef` (6314, set 10353, baca 11543/11594, reset 11560/11611). Tidak ada `isInitialLoadRef`/`navigationTypeRef`. Race residual iterasi 2 tetap ada. Tidak berubah.

---

## ✅ Pekerjaan BARU yang benar di iterasi ini

### SSE reconnect exponential backoff — sekarang ADA DI MOBILE juga ✅
- `mobile:5320-5543`: `reconnectTimer`, `retryCount`, `connectSSE()`, `onopen` reset retry, backoff `min(1000*2^n, 30000)`, `isMounted` guard, cleanup `clearTimeout` + `close`. **Konsisten dengan desktop.** ✅

### Bounded notification Set — sekarang ADA DI MOBILE juga ✅
- `mobileRecentNotifEventsRef` dibatasi 100 entri (mobile:5479-5481), sama pola dengan desktop. ✅

### ErrorBoundary desktop — 2 section (+ root) ✅
- `Bilah Navigasi Atas (Desktop)` (18952) & `Konten Utama (Desktop)` (19264). (Footer bawah masih belum dibungkus.)

### Mobile ErrorBoundary — 2 section (+ root) ✅ (dari iterasi 2)
- `Konten Utama (Mobile)` (22120) & `Bilah Navigasi Bawah (Mobile)` (31035).

---

## Matriks status (iterasi 4)

| Task | Iter3 | Iter4 | Catatan |
|---|---|---|---|
| 1.1 ErrorBoundary | ✅ | ✅ | — |
| 1.2 Granular | 🟢mob/🟢desk(header) | 🟢mob/🟢desk(header) | footer bawah belum |
| 1.3 Lepas `!error` | ✅ | ✅ | — |
| 1.4 closeAllTransientOverlays | 🟢mob/❌desk | 🟢mob/❌desk | desktop belum (grep=0) |
| 1.5 Fix race popstate | 🔴bug baru | 🔴desk mundur+deadcode / 🟠mob | belum tuntas |
| 1.6 6 sheet back handler | ✅ | ✅ | — |
| 2.2 LRU + quota guard | ✅ | ✅ | — |
| 2.3 rAF scroll | ✅ | ✅ | — |
| HIGH-3 SSE reconnect | 🟢desk | 🟢mob+desk | tuntas |
| MED-2 bounded Set | 🟢desk | 🟢mob+desk | tuntas |

---

## Verdict iterasi 4

| Aspek | Penilaian |
|---|---|
| Progres | 🟢 mobile SSE reconnect + bounded Set (tuntas 2 platform) |
| Task 1.5 desktop | 🔴 **mundur** — dead flag (`isInitialLoadRef`) + orphan (`markUserNavigation`) + race residual kembali |
| Task 1.5 mobile | 🟠 tidak berubah (race residual) |
| Regresi fungsional | 🟢 tidak (tidak seperti iterasi 3 yang merusak pushState) — tapi juga tidak memperbaiki |
| Build | 🟢 `tsc -b` exit 0 (kedua) |
| Kesiapan "selesai" | ❌ belum — Task 1.5 inti belum tuntas di kedua platform |

**Kesimpulan**: iterasi ini **menuntaskan pekerjaan sampingan** (SSE reconnect & bounded Set kini di mobile+desktop — bagus), tapi **Task 1.5 — inti perbaikan back-button trap — tidak maju, malah desktop mundur**: `navigationTypeRef` (pendekatan iterasi 3 yang arahnya benar meski belum disambungkan) dibongkar, diganti `isInitialLoadRef` yang **tidak pernah dibaca** dan `markUserNavigation` yang **tidak pernah dipanggil**. Kabel tidak tersambung ke keputusan `pushState`/`replaceState`.

**Wajib diperbaiki (Task 1.5, kedua platform)**:
1. **Desktop**: sambungkan mekanisme niat-user. Minimal: baca `isInitialLoadRef` di cabang → `if (isPopStateRef.current || isInitialLoadRef.current || isModalTransition) replaceState else pushState`; lalu set `markUserNavigation()` (clear flag) di setiap handler navigasi user (onClick tab/`smartBack`/nav). Hapus yang tidak terpakai.
2. **Mobile**: terapkan mekanisme yang sama (saat ini belum ada).
3. Prinsip akhir: **`pushState` hanya dipicu aksi eksplisit user; `replaceState` untuk semua reaksi render/popstate/initial-load.** Verifikasi dengan skenario "Back 5× cepat" (uji §8.2 dokumen audit).
4. Sisa pending: Task 1.4 desktop (`closeAllTransientOverlays`) & `<footer>` bawah desktop (opsional).
