# Verifikasi Putaran 4 — Tindak Lanjut atas Verifikasi Putaran 3

**Tanggal:** 25 Oktober 2026
**Sasaran:** klaim perbaikan atas [2026-10-25-verifikasi-putaran-3.md](file:///c:/MyProject/agentA/catavor/docs/audit/2026-10-25-verifikasi-putaran-3.md)
**Metode:** baca diff, jalankan `go vet`/`go test`/`tsc`, telusuri jalur cache & back-handler.
**Sifat:** read-only.

---

## 1. Vonis

**Keempat butir dikerjakan dengan benar, termasuk bagian tersulitnya** (semantik merge yang tidak mengunci field). Saya menemukan **satu bug baru yang lahir justru dari perbaikan D** — payload `/api/u/:slug` kini bergantung pada siapa yang meminta, tetapi cache-nya tidak.

---

## 2. Verifikasi klaim

| Klaim | Verdict | Bukti |
|---|---|---|
| Merge defensif atribut (`product_handler.go`) | **BENAR, semantik tepat** | `mergedAttrs` = atribut lama, lalu di-overlay payload baru. Key yang **absen** dipulihkan dari lama; key yang dikirim **kosong** (`""`) tetap menang → pengguna masih bisa mengosongkan field. Ini desain yang benar, bukan merge "buta" yang mengunci nilai. `FilterProductAttributes` tetap dijalankan setelah merge, jadi key asing masih dibuang. |
| Hidrasi mobile spread `...(item.attributes \|\| {})` | **BENAR, urutan tepat** | Spread diletakkan **sebelum** key eksplisit, sehingga nilai ternormalisasi menang atas nilai mentah. |
| Mobile punya 4 input F&B + bottom sheet picker | **BENAR** | Default (4 field), hidrasi, 2 input teks + 2 picker + 1 input teks. Picker memakai pola sheet standar: drag handle, `transition: none` saat drag, pegas `0.28s cubic-bezier(0.16,1,0.3,1)`, ambang tutup 70px, backdrop tap, **tanpa tombol X** — patuh §7. |
| Normalisasi nilai lama `storage_temp` di tablet | **BENAR** | Dua pemetaan: `'Suhu Ruang (Kering & Sejuk)' → 'Suhu Ruang'`, `'Hangat / Siap Santap' → 'Hangat'`, plus spread `...rawAttrs` saat hidrasi. |
| Konsolidasi `escapeLikePattern` | **BENAR** | 6 lokasi kini memakai helper di `sql_like.go:14`; tidak ada lagi `strings.NewReplacer` inline; urutan escape→bungkus `%` tetap benar. |
| DTO mask `warning_1`/`warning_2` untuk publik | **BENAR logikanya** | `isMerchantRequester` ternyata **memverifikasi kepemilikan di DB** (`store_handler.go:84-95`), bukan sekadar percaya klaim JWT — lebih baik dari dugaan saya. |
| Test `partial_update_attributes_preservation` | **BENAR** | Subtest ada di `product_crud_test.go`; suite `./internal/...` 9/9 `ok`. |
| `go vet` + tri-typecheck | **BENAR** | `go vet` exit 0; `tsc -p tsconfig.app.json --noEmit` desktop/tablet/mobile exit 0 semua. |

---

## 3. BUG BARU (P1): cache tidak sadar-peminta pada payload yang kini berbeda per peminta

**Perbaikan D membuat `dormancy_status` bergantung pada siapa yang meminta.** Namun cache tetap memakai **satu kunci** untuk semua:

```go
store_handler.go:240   profileCacheKey := fmt.Sprintf("catavor:store:%s:profile", slug)
store_handler.go:242   // dibaca tanpa melihat siapa pemintanya
store_handler.go:352   // ditulis tanpa melihat siapa pemintanya, TTL 300s
```

**Dua arah kerusakan (jendela 5 menit):**

1. **Pengunjung publik request lebih dulu** → cache menyimpan `dormancy_status: "active"` (hasil masking) → **dasbor merchant sendiri** ikut membaca `"active"` → spanduk peringatan inaktivitas yang baru dipulihkan di putaran 3 **hilang sebentar-sebentar**. Ini regresi berulang yang sulit direproduksi karena bergantung urutan request.
2. **Merchant/staf request lebih dulu** → cache menyimpan `"warning_1"` → **pengunjung publik** melihat status peringatan internal → tujuan masking (perlindungan reputasi) gagal persis pada kasus yang ingin dicegah.

**Catatan penting:** sebelum putaran 4, payload ini tidak bergantung peminta, sehingga cache tunggal sah. Bug ini **diperkenalkan oleh perbaikan D**, bukan cacat lama.

**Perbaikan yang disarankan (pilih salah satu):**

- **Paling sederhana:** hanya cache varian publik. Bila `isMerchantRequester(c, &store)` benar, lewati baca **dan** tulis cache sepenuhnya.
- **Alternatif:** variasi kunci — `...:profile:public` untuk publik (masked) dan `...:profile:staff` untuk merchant/staf (asli).

Saya menyarankan yang pertama: lebih sedikit kunci, tidak ada risiko dua varian saling tertukar, dan jalur merchant memang bukan jalur panas yang perlu cache.

---

## 4. Sisa celah (P2, bukan regresi): picker sheet tidak terdaftar di back interceptor

`crudDropdownPicker` — yang kini dipakai **19 tempat**, termasuk picker `storage_temp` yang baru — **tidak** terdaftar pada `useModalBackHandler` (daftar di `mobile/App.tsx:9811-9839` tidak memuatnya; `crud_dropdown` hanya muncul di `closeSheetWithAnimation` untuk drag-close, `:7096`).

Akibatnya, saat sheet picker terbuka, tombol **back hardware/browser** tidak menutup sheet, melainkan menjalankan `handlePopState` (`:10546`) yang memulihkan rute — pengguna terlempar keluar dari form produk. Ini melanggar AGENTS.md §2 (LIFO: back harus menutup overlay teratas lebih dulu).

Bukan regresi dari putaran ini, tetapi **permukaan terdampaknya bertambah** dengan picker baru. Perbaikan: daftarkan `crudDropdownPicker` pada `useModalBackHandler` seperti overlay lain.

---

## 5. Tidak dapat saya buktikan

1. `npm run build` penuh — sesi saya masih tidak bisa menulis di `catavor`. Pengganti: `tsc --noEmit` 3/3 bersih.
2. Perilaku runtime masking `warning_*` — data lokal tidak punya toko berstatus warning, dan saya tidak akan mengubah data Anda untuk mengujinya.
3. Perilaku nyata hapus toko/akun (butuh akun uji; berisiko merusak data).

---

## 6. Status

| Item | Status |
|---|---|
| Data loss atribut F&B via mobile | **Selesai** (merge + hidrasi + input mobile) |
| Normalisasi `storage_temp` tablet | **Selesai** |
| Konsolidasi helper escape | **Selesai** |
| Masking status dormansi | **Cache: sudah aman secara kebenaran (lihat §7)** |
| Back interceptor picker sheet | **Terbuka (P2, sisa lama)** |

---

## 7. Tindak lanjut P1 — verifikasi bypass cache yang sedang dipasang

Kode saat ini (`store_handler.go:240-254`, `:356-366`) memakai dua predikat berbeda: **baca** cache digerbangi `!isAuthRequester` (siapa pun yang login melewati cache), **tulis** cache digerbangi `!isMerchant`. Saya telusuri keempat kombinasi:

| Peminta | Baca cache | Status yang dikirim | Tulis cache | Hasil |
|---|---|---|---|---|
| Anonim | ya | masked (`active`) | ya | benar — cache berisi varian publik |
| Merchant/staf pemilik | **dilewati** | asli (`warning_1`) | **tidak** | benar — status asli tidak pernah masuk cache |
| Pengguna login lain (pembeli) | dilewati | masked | ya (masked) | benar secara data; hanya kehilangan cache-hit |
| Staf platform non-superadmin | dilewati | asli | tidak | benar |

**Kesimpulan: kebocoran dua arah yang saya laporkan sudah tertutup.** Vargan cache hanya pernah berisi payload masked, dan merchant tidak pernah membaca cache.

Yang tersisa hanyalah kualitas implementasi, bukan kebenaran:

1. **Hit-rate turun** untuk semua pengguna login (mereka selalu `MISS`), walau hanya pemilik toko yang butuh status asli. Bila nanti terasa di beban server, gerbangi baca dengan `claims == nil || !strings.EqualFold(claims.StoreSlug, slug)` — slug tersedia dari klaim tanpa query DB, jadi cache-hit untuk pembeli login kembali tanpa membocorkan status pemilik.
2. **Dua predikat berbeda** (`isAuthRequester` untuk baca, `isMerchant` untuk tulis) benar secara perilaku, tetapi membingungkan pembaca berikutnya. Beri komentar alasannya, atau satukan lewat satu fungsi keputusan.
3. **`ExtractOptionalClaims` dipanggil dua kali** per request (di sini dan di dalam `isMerchantRequester`). Operasi murah, tetapi sebaiknya claims dioper sebagai parameter.
4. **Semantik header `X-Cache`** untuk pengguna login non-pemilik kini `MISS` padahal ia menulis cache. Kosmetik, tidak berdampak.
