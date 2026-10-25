# Verifikasi Independen atas Laporan Perbaikan Audit

**Tanggal:** 25 Oktober 2026
**Sasaran:** klaim "seluruh temuan audit sudah diperbaiki & diverifikasi" atas [2026-10-25-audit-keselarasan-admin-merchant.md](file:///c:/MyProject/agentA/catavor/docs/audit/2026-10-25-audit-keselarasan-admin-merchant.md)
**Metode:** baca diff `git` baris demi baris, jalankan ulang kompilasi/typecheck, uji runtime ke `http://localhost:8001`, dan telusuri dampak tiap perubahan ke kode pemanggil.
**Sifat:** read-only. Tidak ada file kode diubah oleh verifikasi ini.

---

## 1. Vonis ringkas

**Mayoritas klaim benar.** Dari 12 klaim perbaikan: **9 terverifikasi**, **1 benar sebagian**, **1 menimbulkan regresi**, **1 tidak dapat saya jalankan** (build menulis file). Selain itu ditemukan:

- **2 bug destruktif yang sudah ada sebelumnya dan belum tersentuh** (hapus toko & hapus akun selalu gagal di ketiga device),
- **1 dead code baru**,
- **1 divergensi baru** antar device (opsi `storage_temp`).

Kelebihan yang harus diakui: perbaikan P0 data-loss (`B-01`/`B-02`) dikerjakan dengan pendekatan yang benar (deteksi field mentah), bukan tambalan satu field — itu sesuai rekomendasi audit.

---

## 2. Verdict per klaim

| # | Klaim | Verdict | Bukti yang saya periksa |
|---|---|---|---|
| 1 | `B-01`/`B-02` — `price`, `min_order`, `max_order`, `video_url`, `is_shipping_available` hanya diubah bila dikirim eksplisit | **BENAR** | `product_handler.go` menambah `rawFields map[string]json.RawMessage` lalu `if _, ok := rawFields["max_order"]`. Mobile juga mengirim `min_order`/`max_order`/`is_shipping_available` di payload arsip (`mobile/App.tsx:9875-9877`). |
| 2 | `F-01`/`R-01` — `/api/settings` publik pakai allowlist | **BENAR** | Runtime `GET /api/settings` → 27 key; `master_coupons` tidak ada; `PublicIndex` memfilter lewat map `publicKeys`. |
| 3 | `F-04`/`R-02` — DTO publik membersihkan field internal | **BENAR SEBAGIAN — ada regresi** | Runtime `/api/u/adidas`: `user_id`, `storage_used_bytes`, `payment_status`, `suspension_reason` hilang (bagus). Tetapi `plan` dan `dormancy_status` juga hilang, padahal UI membutuhkannya. Lihat §3. |
| 4 | `F-02` — hapus toko hanya pemilik/superadmin | **BENAR secara kode** | `store_handler.go` `isSuperadmin := user.IsSuperadmin()`; cek password tidak lagi dilewati. |
| 5 | `F-03` — staf non-superadmin hanya read-only di rute tenant | **BENAR** | `auth.go`: cabang staf kini `user.IsSuperadmin() \|\| GET \|\| HEAD`; `OperationalStoreRequired` sejalan. |
| 6 | `F-07` — `category_id` divalidasi kepemilikannya | **BENAR** | Tiga titik (`Store` + dua di `Update`) memakai `Where("id = ? AND store_id = ?")`. Catatan: kategori asing diabaikan **diam-diam**, bukan 400. |
| 7 | `B-10` — escape wildcard `LIKE` | **BENAR SEBAGIAN (1 dari 6 lokasi)** | Hanya `product_handler.go:145`. Masih mentah: `analytics_handler.go:996`, `activity_log_handler.go:83` & `:168`, `store_handler.go:413` & `:650`. |
| 8 | `B-03` — route cabut staf 404 | **BENAR** | `main.go` menambah `POST /rbac/staff/:id/revoke` + `DELETE /rbac/staff/:id`; `rbac_handler.go:211-217` membaca `c.Params("id")`, jadi route baru benar-benar berfungsi. |
| 9 | `B-04` — input stok & satuan di tablet | **BENAR** | Dua input baru; terikat ke `productForm.stock`/`productForm.unit`; payload memang mengirim `stock` (`:1570`) dan `unit` (`:1578`). |
| 10 | `B-05`/`B-06` — field F&B di desktop & tablet | **BENAR**, dengan divergensi baru | Desktop: input + hidrasi + default. Tablet: input + `updateProductAttribute`. Backend `ProductAttributeSchema["food"]` sudah memuat `portion_size`, `prep_time`, `storage_temp`, `expired_info` → tidak dibuang saat simpan. Lihat §5. |
| 11 | Rule 1 — smart back menggantikan `setAdminTab('items')` | **BENAR** | Memakai `smartBack` dari `utils/navigation.ts:123` (sudah ada, punya fallback), dipanggil di 3 titik. |
| 12 | Rule 6 — `window.confirm` diganti modal terdesain | **BENAR**, menyisakan dead code | Modal terpusat + `useModalBackHandler` + state `isDeletingItem`. Tetapi `handleFaunaDelete` kini **tanpa pemanggil**. Lihat §6. |
| 13 | Tri-build 0 error | **Terbukti sebagian** | Saya jalankan `tsc -p tsconfig.app.json --noEmit` pada ketiga app: **exit 0 semua**. Bundel baru ada di `public/{desktop,tablet,mobile}/assets` dan `8001` menyajikan `index-BPanM8SL.js` yang sama. `npm run build` penuh tidak bisa saya jalankan (lihat §7). |
| 14 | Backend kompilasi & test | **BENAR** | `go vet ./...` exit 0, `go build ./...` exit 0, `go test ./internal/...` 9/9 paket `ok`. |

---

## 3. REGRESI: `plan` dan status peringatan hilang dari respons publik

**Akar masalah.** `PublicStoreDTO` membuang dua field yang **bukan** data privat, melainkan data yang dipakai UI:

1. **`plan`** — dipakai 25 kali di desktop (`App.tsx` + `MerchantAdminShell.tsx`) dan 12 kali di mobile. Sumbernya satu-satunya adalah `/u/:slug`:
   ```
   desktop/App.tsx:11086   plan: store.plan || 'free',
   desktop/App.tsx:11135   plan: store.plan || 'free',
   ```
   Karena DTO tidak lagi mengirim `plan`, **setiap toko kini terbaca sebagai `free`**:
   - Badge paket di sidebar (`MerchantAdminShell.tsx:217-219`, `:406-411`) → selalu "GRATIS" / "FREE" untuk merchant berbayar.
   - Fallback kuota `maxItems = storeQuota?.max_items ?? (settings?.plan === 'free' ? 15 : -1)` (`:307`) → 15 bila fetch kuota gagal.
   - Gating UI berbasis paket (`desktop/App.tsx:20022`, `:21250`; mobile 12 titik).
   Tablet tidak terpengaruh (0 pemakaian; memakai objek `quota`).

2. **`dormancy_status` (status `warning_1`/`warning_2`)** — hilang untuk toko aktif, sehingga spanduk peringatan inaktivitas tidak pernah muncul lagi (`desktop/App.tsx:21250-21347`). `is_suspended`/`suspension_reason` untuk toko tersuspend **aman**, karena `ShowStore` punya cabang khusus (baris 279-299) yang tetap mengembalikan status penangguhan.

**Perbaikan yang disarankan.** Tambahkan kembali ke DTO: `plan`, `dormancy_status`, `dormancy_suspended_at`. Yang tetap dibuang: `user_id`, `storage_used_bytes`, `payment_status`, `is_exempt_from_dormancy`, `registration_timezone`, `is_blacklisted`, `plan_status`. Bila `plan` dianggap terlalu sensitif untuk publik, maka jangan dipakai sebagai basis badge — ambil dari `/api/subscription/my-quota` untuk pemilik, dan sembunyikan badge untuk pengunjung.

---

## 4. Bug destruktif yang belum tersentuh (ketiga device konsisten salah)

Kontrak body antara frontend dan backend tidak cocok pada **dua aksi paling berbahaya**:

| Aksi | Frontend mengirim | Backend membaca | Akibat |
|---|---|---|---|
| Hapus toko | `{ slug, password }` — `desktop/DangerZoneSettingsView.tsx:122-125`, `mobile/…:175-179`, `tablet/TabletDangerZoneView.tsx` | `DeleteStoreRequest.ConfirmSlug` = `json:"confirm_slug"` (`store_handler.go:2045-2046`) | `confirm_slug` kosong → selalu 400 "Konfirmasi tautan tidak cocok". **Merchant tidak bisa menghapus tokonya sendiri dari device mana pun.** |
| Hapus akun | `{ confirmation, password }` | `DeleteAccountRequest.ConfirmPhrase` = `json:"confirm_phrase"` (`auth_handler.go`) | Frasa kosong → gagal validasi. **Hapus akun tidak pernah berhasil.** |

Ini ironi yang layak dicatat: **keselarasan lintas device tercapai justru pada bug** — ketiganya salah dengan cara identik. Dampak sampingan: karena route hapus toko tidak pernah berhasil dari UI, temuan `F-02` (staf bisa menghapus toko) hanya dapat dieksploitasi lewat pemanggilan API langsung, bukan lewat aplikasi.

**Rekomendasi:** samakan nama field (`confirm_slug` / `confirm_phrase`) di ketiga frontend, atau buat backend menerima alias. Tambahkan test kontrak agar tidak berulang.

---

## 5. Divergensi baru: opsi `storage_temp` berbeda antar device

Untuk satu field yang sama, tiga daftar nilai berbeda:

| Device | Opsi |
|---|---|
| Desktop (`App.tsx`, food grid) | `Suhu Ruang (Kering & Sejuk)`, `Dingin (Kulkas / Chiller 2-8°C)`, `Beku (Freezer -18°C)`, `Hangat (Warmer / Segera Santap)` |
| Tablet (`TabletMerchantAdmin.tsx`) | `Suhu Ruang (25°C)`, `Chiller (2°C - 8°C)`, `Freezer Beku (-18°C)`, `Hangat / Siap Santap` |
| Standar skill `selaras-frontend-parity` | `Suhu Ruang`, `Chiller (2°C-8°C)`, `Freezer (-18°C)`, `Hangat` |

Default desktop `'Suhu Ruang (Kering & Sejuk)'` tidak ada di daftar tablet. Akibatnya nilai tersimpan tidak seragam untuk makna yang sama, dan filter/analitik berbasis nilai ini akan pecah. Ini **regresi keselarasan** yang lahir dari perbaikan itu sendiri.

---

## 6. Dead code & catatan kualitas

1. `handleFaunaDelete` (`desktop/App.tsx:13985`) kini **tidak punya pemanggil** — ketiga call site diganti `setItemToDelete(...)`. Fungsi 20 baris ini masih berisi alur penghapusan lama dan mengembalikan `Promise<boolean>` yang tidak dipakai. Melanggar §5.3 AGENTS.md (dilarang meninggalkan dead code).
2. `handleFaunaDelete` juga menyisakan cabang `if (targetItem) { ... } return false;` — bila item tidak ditemukan, tidak ada umpan balik ke pengguna.
3. Route baru `DELETE /rbac/staff/:id` memakai handler yang sama; aman, tetapi `c.Locals("user").(*models.User)` di `rbac_handler.go:200` masih type-assert tanpa guard (bergantung pada `RequireAdmin` di depannya).

---

## 7. Yang tidak dapat saya verifikasi

1. **`npm run build` penuh** — sesi saya masih ditolak menulis di dalam `catavor` (token sandbox tanpa entri izin `S-1-4-*`). Saya menggantinya dengan `tsc --noEmit` (3/3 exit 0) + pemeriksaan bundel & aset yang disajikan. Kesimpulannya kuat, tetapi bukan bukti `vite build`.
2. **Uji otorisasi runtime** (`F-02`, `F-03`, `B-03`) — butuh akun `superadmin` dan `support`. Semua verdict di atas berasal dari jalur kode.
3. **Efek `PublicIndex` terhadap key non-allowlist** — `whatsapp_number` dan `store_slogan` tidak lagi muncul di `/api/settings`; dari penelusuran, frontend membacanya dari objek **toko** (`/u/:slug`), bukan dari settings global, jadi saya tidak menemukan regresi. Tetap layak dicek bila ada integrasi eksternal yang membaca dua key itu.
4. **Perilaku DB nyata** untuk field F&B baru — `product_attribute_schema.go` mengizinkan, tetapi penulisan ke PostgreSQL tidak saya uji langsung.

---

## 8. Rekomendasi berurutan

| Prioritas | Tindakan | Effort |
|---|---|---|
| P0 | Kembalikan `plan`, `dormancy_status`, `dormancy_suspended_at` ke `PublicStoreDTO` | S |
| P0 | Perbaiki nama field `confirm_slug` (hapus toko) & `confirm_phrase` (hapus akun) di 3 frontend | S |
| P1 | Samakan opsi `storage_temp` sesuai standar skill (satu sumber konstanta) | S |
| P1 | Hapus `handleFaunaDelete` yang kini mati | S |
| P1 | Escape wildcard `LIKE` di 5 lokasi yang tersisa | S |
| P2 | Tambah test kontrak API frontend↔backend untuk body destruktif | M |
| P2 | Kembalikan umpan balik saat item gagal ditemukan pada alur hapus | S |

---

## 9. Kesimpulan

Perbaikan yang diklaim **tidak sekadar laporan**: kode memang berubah, backend lulus vet/build/test, ketiga app lulus typecheck, dan dua endpoint publik yang saya uji runtime benar-benar sudah bersih dari data sensitif.

Namun klaim "seluruh temuan diperbaiki **dan diverifikasi secara menyeluruh**" belum akurat pada tiga hal: (a) satu perbaikan menimbulkan regresi fungsional (`plan` & status peringatan), (b) satu perbaikan hanya menyentuh 1 dari 6 lokasi (`LIKE`), dan (c) dua bug destruktif yang lebih berbahaya daripada temuan aslinya justru lolos tanpa disentuh — hapus toko dan hapus akun tidak pernah berhasil di device mana pun.
