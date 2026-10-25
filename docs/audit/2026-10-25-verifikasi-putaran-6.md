# Verifikasi Putaran 6 — Penutupan P2 & Status Akhir

**Tanggal:** 25 Oktober 2026
**Sasaran:** klaim penyelesaian P2 (back interceptor) + perapian backend `isMerchantRequester`
**Metode:** baca kode final, hitung cakupan hook, jalankan `go vet`/`go test`/`tsc`.
**Sifat:** read-only.

---

## 1. Vonis

**P2 selesai dan benar.** Perapian backend juga benar dan aman terhadap empat pemanggil lain. Satu klaim pada uraian Anda perlu dikoreksi: **LIFO langkah ke-2 tidak dijamin oleh interceptor** — lihat §4.

---

## 2. Bukti perbaikan yang terverifikasi

| Klaim | Verdict | Bukti |
|---|---|---|
| `crud-dropdown-picker` & `rekber-explainer` terdaftar di `useModalBackHandler` | **BENAR** | `mobile/App.tsx:9822-9823`, berada dalam blok hook yang sama (`:9811-9843`), `modalId` unik. |
| Tanpa `history.back()` manual di jalur tutup | **BENAR** | Diff hanya menambah 2 baris hook; `closeSheetWithAnimation` (`:7081-7106`) dan handler backdrop/`onSelect` tidak disentuh. Auto-pop ditangani cleanup `utils/navigation.ts:215-232`. |
| 12 tipe bottom sheet tercakup | **BENAR** | 17 hook terdaftar, 16 `modalId` unik. Pemetaan lengkap: category `:9816`, sort `:9817`, filter `:9818`, admin-filter `:9819`, action_menu `:9813`, report `:9821`, rekber `:9822`, purchase_options `:9812`, crud_dropdown `:9823`, stores `:9814`, create_store `:9815`, discard_confirm `:9828`, archive_confirm `:9840`. Bonus: `rich-textarea-fullscreen-mobile` juga tercakup. |
| `isMerchantRequester` menerima claims pra-ekstraksi | **BENAR, aman** | Signature variadic `...*middleware.JWTClaims` (`store_handler.go:73`), dengan `if/else` yang benar (`:77-82`) → tidak ada ekstraksi ganda, dan **tidak** memaksa perubahan pada 4 pemanggil lain (`:426`, `:627`, `:840`). |
| Cache tidak lagi ekstrak claims dua kali | **BENAR** | `ShowStore` memakai satu `claims` (`:242-243`) lalu mengopernya (`:323`). |
| `go vet` / `go test` / `tsc` | **BENAR** | `go vet` exit 0; `go test ./internal/...` 9/9 `ok`; `tsc --noEmit` mobile exit 0 (desktop/tablet diverifikasi pada putaran sebelumnya dan tidak berubah). |

---

## 3. Yang benar-benar tertutup dari seluruh audit putaran 1-6

| Temuan awal | Status akhir |
|---|---|
| B-01/B-02 — PUT parsial menghapus `max_order`, harga bisa jadi 0 | **Tertutup** (`rawFields` + payload mobile) |
| Data loss atribut F&B via mobile | **Tertutup** (merge defensif + hidrasi spread + 4 input mobile) |
| F-01/F-04 — kebocoran settings & DTO toko | **Tertutup** (allowlist + DTO), dengan `plan`/`dormancy_status` dikembalikan secara sadar |
| F-02/F-03 — hapus toko & mutasi tenant oleh staf | **Tertutup** (superadmin-only + staf read-only) |
| Bug destruktif hapus toko/akun (kontrak body) | **Tertutup** (alias backend + field frontend + unit test) |
| B-03 — cabut staf 404 | **Tertutup** (route param + handler membaca `:id`) |
| B-04/B-05/B-06 — stok/unit tablet, field F&B desktop/tablet | **Tertutup** (+ paritas mobile pada putaran 4) |
| B-10 — escape wildcard `LIKE` | **Tertutup** (6 lokasi, helper tunggal) |
| Divergensi `storage_temp` | **Tertutup** (4 nilai kanonik + normalisasi legacy) |
| Cache requester-unaware (regresi putaran 4) | **Tertutup** (baca & tulis dipisah, terverifikasi 4 kombinasi peminta) |
| P2 — picker sheet tanpa back interceptor | **Tertutup** |
| Dead code `handleFaunaDelete` | **Tertutup** |
| Hardcode back `setAdminTab('items')` | **Tertutup** (`smartBack`) |
| `window.confirm` hapus item desktop | **Tertutup** (modal terdesain) |

---

## 4. Koreksi klaim: LIFO langkah ke-2 tidak dijamin

Uraian Anda menyatakan:

> Back #2 → membuka sheet konfirmasi discard/menutup form produk.

**Ini tidak berlaku.** Form produk **bukan overlay terdaftar** — tidak ada `useModalBackHandler` untuk form (16 `modalId` yang ada tidak memuat form). Dan `isFormDirty()` hanya dipakai di **satu** tempat, yaitu tombol tutup header form:

```
mobile/App.tsx:19362-19366
onClick={() => {
  if (isFormDirty()) { setShowDiscardConfirmSheet(true); return; }
  smartBack(...)
}}
```

Sementara `setShowDiscardConfirmSheet(true)` hanya dipicu dari baris `:19364` itu (satu-satunya), dan **tidak** dari `handlePopState` (`:10546`).

**Konsekuensi nyata:** saat form produk terbuka dengan isian yang belum disimpan, menekan back hardware/gesture akan menjalankan `handlePopState` → mengubah rute, **tanpa** menampilkan konfirmasi discard → input pengguna hilang.

**Perbaikan yang saya sarankan (rendah risiko):** jangan daftarkan form sebagai modal (akan mendorong entri history tambahan dan mengacaukan kedalaman navigasi). Tambahkan penjaga di awal `handlePopState`:

```tsx
// sebelum logika rute
if (isCrudFormOpen) {
  if (isFormDirty()) { setShowDiscardConfirmSheet(true); return; }
  resetCrudState(...); setView('tabs'); return;
}
```

Ini meniru perilaku tombol tutup yang sudah benar, tanpa menyentuh tumpukan history.

---

## 5. Sisa catatan kualitas (tidak memblokir)

1. **Cache-hit untuk pembeli login hilang** — baca cache digerbangi `!isAuthRequester`; semua pengguna login selalu `MISS`. Benar secara data, hanya soal performa. Bila perlu: gerbangi baca dengan `claims == nil || !strings.EqualFold(claims.StoreSlug, slug)`.
2. **Header `X-Cache`** memberi `MISS` pada pengguna login non-pemilik yang justru menulis cache. Kosmetik.
3. **`min_order` tidak bisa diturunkan ke 0** (`if req.MinOrder > 0`) — perilaku lama yang dipertahankan; pastikan memang disengaja.

---

## 6. Batas verifikasi

1. `npm run build` penuh tidak dapat saya jalankan (sesi tidak boleh menulis di `catavor`). Pengganti: `tsc --noEmit` 3/3 bersih.
2. **Uji LIFO di perangkat nyata** (back #1 menutup picker sementara form tetap) belum diuji oleh siapa pun. Secara kode jalurnya benar, tetapi harus dikonfirmasi di Android/iOS atau emulator.
3. Uji runtime `warning_1`/`warning_2` dan hapus toko/akun butuh data & akun uji; saya tidak mengubah data Anda.

---

## 7. Definition of done

- [x] Seluruh temuan P0/P1 audit putaran 1-4 tertutup dan diverifikasi ulang.
- [x] `go vet` / `go test` / `tsc` bersih.
- [x] Guard popstate untuk form dirty **dipasang** (lihat §8).
- [ ] Uji perangkat: back pada picker, back pada form dirty, back berlapis (form → picker → back).

---

## 8. Implementasi guard popstate (dikerjakan QA atas permintaan eksplisit)

Perubahan ini menyentuh `frontend/mobile` — dibolehkan karena pengguna meminta langsung ("Anda kerjakan saja"), dan sifatnya perbaikan navigasi, bukan perubahan tampilan (§7.B *mobile codebase freeze* tetap dihormati untuk desain).

**File:** `frontend/mobile/src/App.tsx`

**Tambahan 1 — ref "nilai terbaru" (baris 10546-10562).** Listener `popstate` dipasang dengan dependensi `[]` (baris 10595), sehingga closure-nya basi. Tanpa ref, guard akan selalu melihat `view` dari render pertama:

```tsx
const viewRef = useRef(view);              viewRef.current = view;
const isFormDirtyRef = useRef(isFormDirty); isFormDirtyRef.current = isFormDirty;
const showDiscardRef = useRef(showDiscardConfirmSheet); showDiscardRef.current = showDiscardConfirmSheet;
const formActiveUrlRef = useRef<string>('');

useEffect(() => {
  if (view === 'fauna-editor') formActiveUrlRef.current = window.location.href;
}, [view]);
```

**Tambahan 2 — guard (baris 10572-10585), tepat setelah early-return modal:**

```tsx
if (viewRef.current === 'fauna-editor' && isFormDirtyRef.current()) {
  if (!showDiscardRef.current) {
    setShowDiscardConfirmSheet(true);
    const formUrl = formActiveUrlRef.current;
    if (formUrl && window.location.href !== formUrl) {
      window.history.pushState({}, '', formUrl);
    }
  }
  return;
}
```

### Matriks perilaku yang dituju

| Kondisi saat back ditekan | Hasil |
|---|---|
| Form produk kotor, sheet konfirmasi belum terbuka | Sheet "buang perubahan?" muncul; URL dipulihkan ke URL form (anti desync) |
| Form produk kotor, sheet konfirmasi sudah terbuka | Guard `return` tanpa menambah entri history; modal-stack menutup sheet (LIFO tetap benar) |
| Form produk bersih | Guard dilewati → perilaku lama (navigasi rute) |
| Di luar form produk | Tidak berubah sama sekali |

Keputusan desain: selama form kotor, logika rute **tidak** dijalankan sama sekali, supaya tampilan tidak berubah di bawah sheet. Ini meniru perilaku tombol tutup header (`App.tsx:19393`) yang sudah benar.

### Verifikasi yang bisa saya lakukan

- `npx tsc -p tsconfig.app.json --noEmit` → **exit 0**.
- `npx oxlint src/App.tsx` → **0 error** (344 warning pra-ada: catatan React Compiler & ukuran berkas).
- `npm run build` penuh **tidak** dapat dijalankan: sesi tidak boleh menulis di `catavor` (dikonfirmasi ulang: `WRITE_DENIED`).

### Uji manual yang harus dilakukan di perangkat (belum bisa saya lakukan)

1. Buka form tambah item, isi nama, tekan back hardware → sheet konfirmasi harus muncul, form tetap utuh.
2. Tekan back lagi → sheet tertutup, form masih terbuka (bukan keluar aplikasi).
3. Pilih "Buang" → kembali ke daftar item, URL `/<slug>/admin/items`.
4. Buka form kosong (tanpa isi apa pun), tekan back → langsung keluar form tanpa sheet (form dianggap bersih).
5. Dari dalam form, buka picker suhu → back #1 menutup picker (form tetap), back #2 memunculkan sheet konfirmasi.

### Rollback

Hapus blok baris 10546-10562 dan 10572-10585. **Jangan** `git checkout` pada berkas ini — berkas yang sama memuat seluruh perbaikan putaran 2-5.

### Risiko yang saya sadari

- `formActiveUrlRef` menangkap URL saat `view` menjadi `fauna-editor`. Bila ada jalur yang membuka editor **tanpa** mengubah URL, URL yang dipulihkan akan sama dengan URL daftar (guard tetap aman, hanya pemulihan URL menjadi no-op).
- Penulisan ref saat render (`ref.current = state`) adalah pola "latest value" yang lazim; tidak menimbulkan efek samping render.
