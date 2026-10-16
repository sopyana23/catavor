# Review Hasil Implementasi — Iterasi 5
### Catavor (DFauna) — Verifikasi pekerjaan lanjutan

**Tanggal review**: 2026-10-16
**Metode**: verifikasi independen `git diff` + inspeksi kode + `tsc -b` (mobile & desktop: **exit 0**). Read-only.
**Fokus**: apakah bug Task 1.5 desktop (dead `isInitialLoadRef`/orphan `markUserNavigation`) diperbaiki.

## Ringkasan

**Tidak ada perbaikan substantif pada Task 1.5.** Iterasi 5 menambah **ref ketiga (`isUserNavRef`)** dan menyambungkan `markUserNavigation` ke listener `pointerdown` — tapi **ketiga ref tetap tidak menghubungkan apa pun ke keputusan `pushState`/`replaceState`**. Cabang kritis di desktop **tidak berubah sedikit pun**. Sekarang ada **2 ref mati** + 1 ref yang berfungsi tapi tidak lengkap.

Ini iterasi ke-4 berturut-turut Task 1.5 tidak lolos.

---

## 🔴 Desktop Task 1.5 — bertambah lapisan, akar tetap tidak tersambung

**Keadaan sekarang (desktop:7392-7403):**
```typescript
const isPopStateRef  = useRef<boolean>(false)
const isInitialLoadRef = useRef<boolean>(true)
const isUserNavRef   = useRef<boolean>(false)   // BARU di iterasi 5

const markUserNavigation = useCallback(() => {
  isPopStateRef.current = false;
  isInitialLoadRef.current = false;
  isUserNavRef.current = true;      // set true
}, [])
```
`markUserNavigation` **kini benar-benar dipanggil** (listener `pointerdown` capture, filter `button, a, .nav-item, .fauna-card, [role=button], [data-nav]`, kecualikan back-btn) — 3 kemunculan (7398 def, 7411 call, 7419 deps). ✅ Progres kecil.

**TAPI masalah inti tetap:**

**Status baca tiap ref (desktop, diverifikasi grep penuh):**
| Ref | Ditulis | Dibaca di kondisi keputusan `pushState`? |
|---|---|---|
| `isPopStateRef` | ✅ (7399, 10301) | ✅ **ya** (11358) |
| `isInitialLoadRef` | ✅ (7400) | ❌ **TIDAK PERNAH** |
| `isUserNavRef` | ✅ (7401, set `true`) | ❌ **TIDAK PERNAH** |

**Baris keputusan (desktop:11358) — TIDAK BERUBAH sejak iterasi 2:**
```typescript
if (isPopStateRef.current || isModalTransition) {
  window.history.replaceState(...)
} else {
  window.history.pushState(...)
}
```

**Kesimpulan mekanis**: `isInitialLoadRef` dan `isUserNavRef` **ditulis tapi tidak pernah dibaca** → dua dead ref. `markUserNavigation()` menyetel `isUserNavRef=true`, tapi karena `isUserNavRef` tidak pernah dibaca di `if`, efeknya **nol**. Listener `pointerdown` berjalan sia-sia.

**Akibat**: logika keputusan `pushState` desktop **tetap identik dengan iterasi 2** — race residual belum tersentuh. Tidak ada perbaikan, hanya penambahan variabel yang lupa disambungkan.

**Verdict**: Task 1.5 desktop **masih gagal**. Iterasi ke-3 gagal (default `!= 'user'` → pushState mati), iterasi ke-4 gagal (dead flag), iterasi ke-5 gagal (dua dead flag + listener sia-sia). Pola berulang: menambah ref, tetapi **cabang `if` tidak pernah diperbarui untuk membacanya**.

**Perbaikan pasti (bukan lagi tambah ref)**: ubah baris 11358 agar membaca niat user, mis.:
```typescript
if (isPopStateRef.current || isModalTransition || isInitialLoadRef.current || !isUserNavRef.current) {
  replaceState
} else {
  pushState    // hanya jika murni user-initiated
}
```
Dan reset `isUserNavRef.current = false` + `isInitialLoadRef.current = true` setelah dipakai / saat popstate, agar tidak nyangkut. **Inti**: cabang `if` harus benar-benar membaca flag-nya. Saat ini tidak.

---

## 🟠 Mobile Task 1.5 — tidak berubah sama sekali

Grep mobile: hanya `isPopStateRef` (6314, 10353, 11543/11559/11594/11610). Tidak ada `isInitialLoadRef`/`isUserNavRef`/`markUserNavigation` (semua 0). Race residual iterasi 2 tetap. Tidak ada progres.

---

## Matriks status (iterasi 5)

| Task | Iter4 | Iter5 | Catatan |
|---|---|---|---|
| 1.1 ErrorBoundary | ✅ | ✅ | — |
| 1.2 Granular | 🟢mob/🟢desk(header) | 🟢mob/🟢desk(header) | footer bawah belum |
| 1.3 Lepas `!error` | ✅ | ✅ | — |
| 1.4 closeAllTransientOverlays | 🟢mob/❌desk | 🟢mob/❌desk | desktop masih 0 |
| 1.5 Fix race popstate | 🔴 | 🔴 | **2 dead ref, cabang tak diubah** |
| 1.6 6 sheet back handler | ✅ | ✅ | — |
| 2.2 LRU + quota guard | ✅ | ✅ | — |
| 2.3 rAF scroll | ✅ | ✅ | — |
| HIGH-3 SSE reconnect | 🟢mob+desk | 🟢mob+desk | tuntas |
| MED-2 bounded Set | 🟢mob+desk | 🟢mob+desk | tuntas |

---

## Verdict iterasi 5

| Aspek | Penilaian |
|---|---|
| Progres Task 1.5 | 🔴 **stagnan** — tambah ref, cabang keputusan tidak diubah |
| Dead code | 🔴 naik: `isInitialLoadRef` + `isUserNavRef` (2 dead ref) |
| Fungsional | 🟡 tidak merusak (kembali ke perilaku iterasi 2), tapi tidak memperbaiki |
| Build | 🟢 `tsc -b` exit 0 (kedua) |
| Kesiapan "selesai" | ❌ belum — Task 1.5 inti belum tuntas, 5 iterasi |

**Kesimpulan**: iterasi 5 **tidak menyelesaikan Task 1.5**. Upayanya (global `pointerdown` listener memanggil `markUserNavigation`) sebenarnya **arah yang masuk akal**, tetapi **gagal disambungkan**: `isUserNavRef`/`isInitialLoadRef` tidak pernah dibaca di baris keputusan (11358), sehingga mekanisme itu tidak memengaruhi `pushState`/`replaceState` sama sekali. Hasilnya: 2 ref mati + kode sia-sia; perilaku runtime sama dengan iterasi 2.

**Instruksi perbaikan yang tegas (hentikan menambah ref pada iterasi berikutnya):**
1. **Ubah baris 11358** (desktop) agar benar-benar membaca `isInitialLoadRef`/`isUserNavRef` (contoh di atas). Tanpa mengubah baris ini, ref apa pun yang ditambah tidak akan berdampak.
2. **Reset flag setelah dipakai** (`isUserNavRef.current=false`, `isInitialLoadRef.current=true` di popstate & setelah effect) agar tidak nyangkut.
3. **Terapkan pola yang sama di mobile** (saat ini nol).
4. **Verifikasi wajib dengan uji §8.2**: "buka produk → opsi pembelian → Back 5× cepat" → user mulus kembali tanpa mental maju. Kalau uji ini tidak dijalankan, klaim "selesai" tidak sah — 4 iterasi terakhir membuktikan tambah-kode tanpa uji tidak menyelesaikan masalah.
5. Ingat: `tsc -b` exit 0 **bukan** bukti benar — bug logika ini lolos typecheck sejak iterasi 3.
