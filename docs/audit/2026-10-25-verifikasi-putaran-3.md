# Verifikasi Putaran 3 — Tindak Lanjut atas Laporan Verifikasi

**Tanggal:** 25 Oktober 2026
**Sasaran:** klaim perbaikan atas [2026-10-25-verifikasi-perbaikan.md](file:///c:/MyProject/agentA/catavor/docs/audit/2026-10-25-verifikasi-perbaikan.md)
**Metode:** baca diff, jalankan ulang `go vet`/`go test`/`tsc`, uji runtime ke `localhost:8001`, dan telusuri dampak ke kode pemanggil.
**Sifat:** read-only.

---

## 1. Vonis

**Kelima butir yang saya minta sudah dikerjakan dengan benar.** Tidak ada regresi dari perbaikan sebelumnya. Namun verifikasi ini menemukan **satu bug kehilangan data lintas-device yang masih hidup**, yang justru menjadi lebih mudah terpicu karena perbaikan B-05/B-06.

---

## 2. Verifikasi klaim (bukti saya sendiri)

| Klaim | Verdict | Bukti |
|---|---|---|
| `plan`, `dormancy_status`, `dormancy_suspended_at` kembali ke DTO | **BENAR** | Diff `PublicStoreDTO` + mapping. Runtime `GET /api/u/adidas` → `plan=free`, `dormancy_status=active`, 28 field; `user_id`, `storage_used_bytes`, `payment_status`, `suspension_reason`, `plan_status` **tetap absen**. |
| Kontrak hapus toko & hapus akun (backend alias) | **BENAR** | `DeleteStoreRequest.Slug` + fallback di `cleanSlug`; `DeleteAccountRequest.Confirmation` + fallback di `phrase`. Urutan prioritas benar: `confirm_slug`/`confirm_phrase` didahulukan, alias hanya bila kosong. |
| Ketiga frontend mengirim nama field yang benar | **BENAR** | Desktop, tablet, mobile masing-masing menambah `confirm_slug` dan `confirm_phrase` di samping nama lama. Konsisten di tiga device. |
| Test kontrak `TestDestructiveContractCompatibility` | **BENAR** | Saya jalankan sendiri: `ok catavor-backend/internal/handlers 0.039s`. |
| Opsi `storage_temp` diseragamkan | **BENAR** | Desktop & tablet kini memakai 4 value identik: `Suhu Ruang`, `Chiller (2°C - 8°C)`, `Freezer (-18°C)`, `Hangat` (label boleh beda). |
| `handleFaunaDelete` dihapus | **BENAR** | 0 kemunculan di `desktop/App.tsx`. |
| Escape `LIKE` di 5 titik | **BENAR** | Urutan benar (escape dulu, baru bungkus `%`), sehingga tidak terjadi escape ganda. Lokasi: `analytics_handler.go:995`, `activity_log_handler.go:82` & `:168`, `store_handler.go:415` & `:656`, `support_handler.go:179` & `:836`. |
| Backend 9/9 test lulus | **BENAR** | `go vet` exit 0; `go test ./internal/...` → 9 paket `ok`. |
| Tri-build 0 error | **Terbukti sebagian** | `tsc -p tsconfig.app.json --noEmit` desktop/tablet/mobile → exit 0 semua. `8001` menyajikan `index-X-dXoE48.js` yang identik dengan bundel baru di `public/desktop/assets`. `npm run build` penuh tetap tidak dapat saya jalankan (lihat §4). |

**Catatan proses:** pada percobaan pertama, `go test` tampak menggantung >2 menit. Setelah saya hentikan dan jalankan tunggal, selesai 0.039s. Penyebabnya **dua proses `go test` paralel saya sendiri** yang berebut build-cache — bukan cacat pada test baru. Saya catat agar tidak menjadi alarm palsu.

---

## 3. TEMUAN BARU (P1): edit dari mobile menghapus 4 atribut F&B

### Rantai penyebab (semua terverifikasi)

1. Desktop dan tablet sekarang punya input untuk `portion_size`, `prep_time`, `storage_temp`, `expired_info` — dan backend menyimpannya (`ProductAttributeSchema["food"]` memuat keempatnya).
2. **Mobile tidak punya input untuk keempatnya, dan hidrasinya tidak menyertakannya**:
   ```
   mobile/App.tsx:13743-13775  attributes: { condition, weight, brand, variant,
       file_format, file_size, license_type, duration, ..., halal_status, sunlight, ...
   }   // tanpa storage_temp / expired_info / portion_size / prep_time
   ```
3. Saat menyimpan, mobile mengirim `attributes: { ...crudForm.attributes, ... }` (`mobile/App.tsx:13926-13936`) — jadi keempat key itu **tidak ada** di payload.
4. Backend **mengganti** objek atribut secara utuh, bukan merge:
   ```
   product_handler.go:770-774
   if req.Attributes != nil {
       b, _ := json.Marshal(models.FilterProductAttributes(product.ProductType, req.Attributes))
       product.Attributes = datatypes.JSON(b)
   }
   ```

**Akibat:** merchant mengisi "Masa Simpan: 3 hari" dan "Suhu: Chiller" dari desktop, lalu mengedit hal lain (mis. harga) dari **mobile** — dua field itu **hilang tanpa peringatan**, karena `expired_info` juga dipakai pada label "Exp:" di kartu item (`mobile/App.tsx:923`, `:23279`) yang akan kembali ke nilai default `'7 Hari'`.

Ini kelas bug yang sama dengan `B-01` (PUT parsial menghapus `max_order`), tetapi pada `attributes` — dan lolos karena kedua perbaikan sebelumnya hanya menyentuh kolom produk, bukan sub-objek atribut.

### Rekomendasi (pilih satu, keduanya sah)

- **Opsi A (benar sesuai standar):** tambahkan keempat input ke form mobile. Mobile adalah *golden reference* (AGENTS.md §7.B); saat ini justru device dengan kemampuan paling rendah untuk F&B — paritas terbalik.
- **Opsi B (jangka pendek):** ubah hidrasi mobile menjadi `attributes: { ...item.attributes, ... }` sehingga key yang tidak diedit tetap terbawa. Backend sudah memfilter lewat `FilterProductAttributes`, jadi key asing tetap aman.

Saya menyarankan **A + B**: B menutup kebocoran data sekarang, A menuntaskan paritas.

---

## 4. Catatan kecil (bukan blocker)

1. **Normalisasi nilai lama `storage_temp` hanya ada di desktop.** `App.tsx:13496` dan `:30767` memetakan `'Suhu Ruang (Kering & Sejuk)'` → `'Suhu Ruang'`, tetapi tablet tidak memetakannya. Data lama (dibuat desktop sebelum perbaikan) akan tampil tanpa opsi terpilih di tablet. Tambahkan pemetaan yang sama, atau migrasi data sekali jalan.
2. **Duplikasi logika escape.** Ada helper teruji `escapeLikePattern` di `sql_like.go:14`, tetapi empat handler baru memakai `strings.NewReplacer` inline. Fungsinya benar, tetapi kini ada dua sumber kebenaran untuk aturan yang sama. Sebaiknya semua memakai satu helper.
3. **Payload danger zone mengirim dua nama field sekaligus** (`confirm_slug` + `slug`). Sah sebagai masa transisi; setelah semua klien diperbarui, sisakan satu nama agar tidak ada dua sumber kebenaran.
4. **`plan` dan `dormancy_status` kembali publik.** Itu keputusan trade-off yang wajar karena UI membutuhkannya. Namun `dormancy_status` mengekspos status seperti `warning_1`/`warning_2` ke publik; bila tidak diinginkan, petakan `warning_*` → `active` di DTO dan biarkan pemilik melihat status sebenarnya lewat `/api/subscription/my-quota`.

---

## 5. Yang belum dapat saya buktikan

1. **`npm run build` penuh** — sesi saya masih tidak bisa menulis di dalam `catavor`. Bukti pengganti: `tsc --noEmit` 3/3 bersih + bundel baru tersaji oleh server.
2. **Uji nyata hapus toko / hapus akun** — butuh akun uji dan akan merusak data. Verifikasi berhenti pada level kontrak (diff + unit test + logika handler).
3. **Uji otorisasi runtime** `F-02`/`F-03` (superadmin-only hapus toko, staf read-only) — masih berbasis jalur kode.

---

## 6. Status akhir

| Area | Status |
|---|---|
| Regresi `plan`/`dormancy_status` | Selesai & terverifikasi |
| Bugs destruktif (hapus toko & akun) | Selesai & terverifikasi pada level kontrak |
| `LIKE` escaping | Selesai & terverifikasi (urutan benar) |
| `storage_temp` paritas nilai | Selesai; sisa normalisasi data lama di tablet |
| Dead code `handleFaunaDelete` | Selesai |
| **Data loss atribut F&B via mobile** | **Terbuka (P1, §3)** |
