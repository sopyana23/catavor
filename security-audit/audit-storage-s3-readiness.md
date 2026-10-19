# Audit Penyimpanan File (Storage) — Kesiapan S3 & Keamanan per Fitur

Tanggal: 2026-10-19
Lingkup: `backend/internal/storage`, `backend/internal/handlers/storage_handler.go`, `backend/internal/config`, jalur baca/tulis file di handler & service, `cmd/migrate-storage`, `cmd/server/main.go`
Metode: pembacaan kode + probe HTTP runtime terhadap server hidup (`localhost:8000`)
Status: **belum ada perubahan kode** — laporan saja

---

## 1. Jawaban singkat

| Pertanyaan | Jawaban |
|---|---|
| Apakah penyimpanan sudah "standar S3"? | **Struktur key-nya ya, implementasinya belum.** Skema key sudah S3-shaped (prefix, partisi tahun/bulan, UUID, tanpa ekstensi aneh). Tapi ada **5 blocker** yang membuat pemindahan ke S3 sekarang akan merusak fitur, bukan "gampang". Kesiapan realistis: **±60%**. |
| Apakah cara penyimpanan sudah aman sesuai best practice? | **Kontrol tulis (upload) di atas rata-rata. Kontrol baca (akses file) belum ada sama sekali.** Satu isu **kritis**: berkas privat (bukti bayar, lampiran tiket) dapat diakses publik tanpa autentikasi. |

Bukti kritis (dijalankan sekarang, bukan asumsi):

```
$ curl -o /dev/null -w "%{http_code}" \
   http://localhost:8000/storage/support/tickets/2026/10/qa-private-probe.pdf
200        <-- tanpa token, tanpa login
Content-Type: application/pdf
Cache-Control: public, max-age=2592000
```

---

## 2. Arsitektur penyimpanan saat ini (fakta kode)

**Abstraksi.** `internal/storage/storage.go` mendefinisikan interface `StorageService`:

```go
type StorageService interface {
    Upload(ctx, key string, r io.Reader, size int64, contentType string) (string, error)
    Delete(ctx, key string) error
    DeletePrefix(ctx, prefix string) error
    GetURL(key string) string
    GetDriverName() string
}
```

Dua implementasi: `LocalStorageService` (disk, default) dan `S3StorageService` (minio-go, kompatibel S3/MinIO/R2). Driver dipilih via `STORAGE_DRIVER`.

**Konfigurasi aktif (`.env`):**

```
STORAGE_DRIVER=local
STORAGE_LOCAL_ROOT=public/storage
STORAGE_PUBLIC_URL=http://localhost:8000/storage
```

**Titik masuk tunggal.** Hanya ada **satu** handler upload: `POST /api/storage/upload` (`storage_handler.go`), di belakang `AuthRequired` + `StoreOwnerRequired` + `OperationalStoreRequired` + rate limiter global. Semua fitur (produk, branding, billing, support, artikel, platform) memakai endpoint yang sama dengan parameter `category`. Ini pilihan desain yang bagus: satu tempat validasi.

**Skema key (dari `storage_handler.go:265-300`):**

| Category | Key |
|---|---|
| produk/branding | `stores/{store_id}/{category}/{YYYY}/{MM}/{uuid}.{ext}` |
| billing | `stores/{store_id}/billing/{YYYY}/{MM}/{uuid}.pdf` |
| billing (tanpa toko) | `billing/users/{user_id}/{YYYY}/{MM}/{uuid}.pdf` |
| support (merchant) | `support/tickets/{YYYY}/{MM}/{uuid}.pdf` |
| support (staf) | `support/staff/{YYYY}/{MM}/{uuid}.pdf` |
| platform | `platform/{branding,partners/rekber}/{YYYY}/{MM}/{uuid}.{ext}` |
| artikel | `articles/{YYYY}/{MM}/{uuid}.{ext}` |

Ini **persis** bentuk key S3 yang baik: hierarkis, tenant di depan, partisi waktu untuk menghindari hotspot, nama file UUID (tidak bisa ditebak, tidak ada PII di key).

---

## 3. Pertanyaan 1 — Kesiapan migrasi ke S3

### 3.1 Yang sudah benar (jangan diubah)

- Key hierarkis + UUID + partisi tahun/bulan — siap dipakai apa adanya sebagai object key.
- Driver terabstraksi; tidak ada `os.Create` berserakan di handler.
- `cmd/migrate-storage/main.go` sudah ada: walk direktori lokal, deteksi MIME dari 512 byte pertama, `PutObject` per file dengan progress counter.
- `StorageService.Upload` mengembalikan URL dari satu titik (`GetURL`), jadi penggantian base URL terpusat.

### 3.2 Blocker — ini yang membuat migrasi "tidak gampang"

**ST-03 (TINGGI) — Database menyimpan URL absolut, bukan key.**

`Upload` mengembalikan `url = STORAGE_PUBLIC_URL + "/" + key`, dan frontend menyimpan **`data.url`** itu ke kolom DB (`App.tsx:9286` → `file_url: data.url`; pola sama untuk `products.image_url`, `stores.store_logo_url`, `product_images.image_url`).

Model `ProductImage` **punya** kolom `storage_key`, tapi **tidak ada satu baris pun** di handler/service yang menulisnya (`grep StorageKey` hanya menemukan pembacaan). Jadi kolom itu mati.

Konsekuensi: begitu `STORAGE_PUBLIC_URL` berubah (mis. ke `https://cdn.catavor.id`), **seluruh baris lama menunjuk ke URL yang mati**. Migrasi butuh salah satu dari:
1. Rewrite massal kolom `image_url`/`store_logo_url`/`file_url`/`promo_banner`/`avatar_url` (berisiko, harus ada backup + dry-run), **atau**
2. Pertahankan `STORAGE_PUBLIC_URL` tetap sama dan arahkan domain itu ke S3/CDN di lapisan proxy — **tapi ini tidak bisa dilakukan sekarang**, karena `/storage` dilayani `app.Static` dari disk lokal, bukan dari S3 (lihat ST-04).

**ST-04 (TINGGI) — Interface tidak punya operasi baca objek.**

`StorageService` hanya punya `Upload/Delete/DeletePrefix/GetURL/GetDriverName`. Tidak ada `Get`/`Stat`/`Presign`.

Akibatnya ada jalur yang **membaca langsung dari disk** dan akan mati total saat `STORAGE_DRIVER=s3`:

- `support_handler.go:2427-2443` — download lampiran tiket: resolve `cfg.StorageLocalRoot` + `os.Stat` → jika bukan file lokal, jatuh ke redirect. Di S3, **semua lampiran tiket jadi tidak bisa diunduh**.
- `store_handler.go:2147`, `auth_handler.go:2124`, `item_retention_service.go:483` — `os.RemoveAll(StorageLocalRoot/...)` → di S3 tidak menghapus apa pun (lihat ST-06).
- `subscription_service.go:759` — sync kuota menghitung dari disk.

**ST-05 (TINGGI) — Kunci hasil parsing URL salah → objek tidak pernah terhapus di S3.**

`extractStorageKeyFromURL` (`dormancy_service.go:874`, disalin juga di `report_handler.go:1455`) mencari `"/uploads/"`. Key kita tidak pernah memakai `/uploads/`, jadi fallback-nya:

```go
return strings.TrimLeft(clean, "/")
```

Untuk URL `http://localhost:8000/storage/stores/1/products/2026/10/x.jpg` fungsi ini mengembalikan **URL penuh sebagai "key"**. Lalu `strg.Delete(ctx, k)` dipanggil dengan `_ =` (error dibuang). Di driver lokal, `resolveSafeKey` menolak key bertanda `:` → gagal, tapi `HardDeleteLocalStorageFile` menyelamatkan (parsing `/storage/` benar). Di **driver S3**, `RemoveObject(bucket, "http://localhost:8000/...")` **tidak error** — S3 menerima key apa pun. Hasilnya: **laporan sukses, objek tetap ada, tagihan storage terus naik tanpa batas.** Ini bug senyap yang paling mahal.

**ST-06 (TINGGI) — Penghapusan massal masih hardcoded ke filesystem.**

`os.RemoveAll(filepath.Join(cfg.StorageLocalRoot, "stores", id))` ada di `auth_handler.go:2125`, `store_handler.go:2148`, `item_retention_service.go:484`. Saat di S3, hapus toko / purge retensi **tidak menghapus objek apa pun** → pelanggaran janji retensi data (dan biaya).

**ST-07 (SEDANG) — `S3_USE_PATH_STYLE` tidak disambungkan.**

Config membaca `S3UsePathStyle` dan memakainya saat menyusun URL, tapi `minio.Options` di `NewS3StorageService` hanya mengisi `Creds`, `Secure`, `Region`. `BucketLookup` tidak diset. Untuk MinIO on-prem dan sebagian setup R2, path-style **wajib** — sekarang akan gagal connect/salah alamat.

**ST-08 (SEDANG) — `DeletePrefix` S3 menelan error.**

Implementasi S3 mengembalikan `nil` apa pun hasilnya (channel error tidak dikumpulkan). Pemanggil menganggap berhasil padahal bisa 0 objek terhapus.

**ST-09 (RENDAH) — Tool migrasi tidak punya jaminan.**

`migrate-storage` tidak: rewrite DB, verifikasi checksum setelah upload, mode `--dry-run`, resume/incremental, atau hapus-sumber-setelah-verifikasi. Untuk 226 file / 44 MB sekarang aman dijalankan manual sambil diawasi; untuk 100 GB nanti tidak.

### 3.3 Skor kesiapan

| Kriteria | Status |
|---|---|
| Skema key S3-compatible | ✅ siap |
| Driver terabstraksi | ✅ siap |
| Kode tidak menyimpan key (hanya URL) | ❌ blocker |
| Ada operasi baca objek (Get/Presign) | ❌ blocker |
| Hapus via driver (bukan `os.RemoveAll`) | ❌ blocker |
| Parsing URL → key benar | ❌ blocker (bug senyap) |
| Path-style MinIO/R2 | ❌ tidak tersambung |
| Tool migrasi + verifikasi + rollback | ⚠️ minimal |
| Private bucket + presigned URL | ❌ belum ada konsepnya |

**Kesimpulan Q1:** struktur sudah "S3-minded", tapi sistemnya belum **portabel**. Pindah ke S3 hari ini = lampiran tiket mati, file yatim menumpuk, hapus toko tidak bersih.

---

## 4. Pertanyaan 2 — Keamanan per konteks fitur

### 4.1 Matriks fitur

| Fitur | Key | Sensitivitas | Upload oleh | Baca oleh (desain) | Baca oleh (realita) |
|---|---|---|---|---|---|
| Foto produk | `stores/{id}/products/...` | Publik | Pemilik toko | Siapa saja | Siapa saja ✅ wajar |
| Logo/banner toko | `stores/{id}/branding/...` | Publik | Pemilik toko | Siapa saja | Siapa saja ✅ wajar |
| Bukti bayar / invoice | `stores/{id}/billing/...` | **Privat** | Pemilik toko | Pemilik + staf | **Siapa saja** 🔴 |
| Lampiran tiket bantuan | `support/tickets/...` | **Privat** | Merchant | Pemilik tiket + staf | **Siapa saja** 🔴 |
| Lampiran tiket (staf) | `support/staff/...` | **Privat** | Staf | Staf | **Siapa saja** 🔴 |
| Branding platform / partner | `platform/...` | Publik | Staf saja | Siapa saja | Siapa saja ✅ wajar |
| Gambar artikel | `articles/...` | Publik | Staf | Siapa saja | Siapa saja ✅ wajar |

### 4.2 Temuan

**ST-01 (KRITIS) — Tidak ada pemisahan public/private; seluruh storage root dilayani tanpa auth.**

```go
app.Static("/storage", cfg.StorageLocalRoot, fiber.Static{ Browse: false, MaxAge: 86400 * 30 })
```

Satu direktori, satu route, tanpa middleware auth, tanpa pemeriksaan kepemilikan. Semua yang ada di dalamnya publik. Dibuktikan runtime: `200` untuk PDF di `support/tickets/`.

Mitigasi yang ada sekarang hanya **UUIDv4 sebagai kapabilitas rahasia** (128 bit, tidak bisa ditebak). Itu bukan kontrol akses — itu security by obscurity. Masalahnya nyata karena:
- `support_handler.go` **mengembalikan `attachment.FileURL` ke klien**; URL itu lalu ada di respons API, log proxy, riwayat browser, layar share, dan screenshot.
- Satu kebocoran URL = akses permanen (tidak ada expiry, tidak ada revoke, `Cache-Control` 30 hari).

Ini yang paling harus diperbaiki.

**ST-02 (TINGGI) — `Cache-Control: public, max-age=2592000` pada berkas privat.**

Bukti header di atas. Artinya: proxy/CDN/browser boleh menyimpan bukti transfer bank selama 30 hari dan menyajikannya ke pengguna lain yang memakai cache yang sama. Untuk berkas privat, seharusnya `private, no-store`.

**ST-09b (SEDANG) — PDF diterima di semua kategori dan disajikan inline same-origin.**

```go
isPDF := bytes.HasPrefix(fileBytes, []byte("%PDF-")) || strings.EqualFold(filepath.Ext(...), ".pdf")
// komentar: "or any valid PDF upload"
```

Komentar kode sendiri menyebut "digital products", tapi implementasinya menerima PDF untuk **kategori apa pun**, termasuk `products` dan `branding`. PDF dikirim byte-per-byte tanpa sanitasi (tidak seperti gambar yang di-re-encode), lalu disajikan `Content-Type: application/pdf` **inline, tanpa `Content-Disposition: attachment`, dari origin yang sama dengan aplikasi**. Vektor: PDF ber-JS, atau content-sniffing di klien lama. `CSP object-src 'none'` + `nosniff` mengurangi dampak, tapi best practice tetap: berkas user **wajib** `attachment` atau disajikan dari domain terpisah.

**ST-10 (SEDANG) — Decompression bomb.**

```go
img, _, err := image.Decode(bytes.NewReader(fileBytes))   // decode PENUH
bounds := img.Bounds()
if bounds.Dx() > 1920 || bounds.Dy() > 1920 { ... }
```

Batas 10 MB berlaku untuk **byte terkompresi**, bukan hasil decode. PNG 10 MB bisa berisi 30.000×30.000 piksel → ±3,6 GB alokasi memori sebelum pengecekan dimensi dijalankan. Satu request bisa menjatuhkan proses. Perbaikan: `image.DecodeConfig` dulu, tolak jika `W*H` melebihi ambang (mis. 40 MP), baru decode.

**ST-11 (RENDAH) — Kuota: angka tidak konsisten + race.**

`uploadSize` = ukuran **hasil re-encode**, dan itu yang masuk kuota (bagus). Tapi respons mengembalikan `"file_size": file.Size` (ukuran **asli**). Pengguna melihat angka berbeda dari yang dipotong dari kuota. Selain itu `CanUploadStorage` (cek) dan `UpdateColumn(... + uploadSize)` (tambah) bukan satu transaksi — dua upload paralel bisa melewati batas sedikit. Dampak kecil, tapi mudah dirapikan.

**ST-12 (RENDAH) — Tidak ada turunan gambar.**

Gambar disimpan maksimal 1920×1920 dan dipakai apa adanya untuk grid produk. Grid 20 produk = 20 gambar penuh. Bukan celah keamanan, tapi biaya bandwidth/egress di S3 nanti (dan egress S3 itu berbayar).

### 4.3 Yang sudah benar dan jangan dirusak

Ini di atas rata-rata untuk aplikasi sekelas ini:

- **Magic-byte validation** (`http.DetectContentType` 512 byte) — bukan percaya `Content-Type` dari klien.
- **Re-encode gambar** ke JPEG/PNG bersih → EXIF, GPS, dan payload webshell di metadata **hilang**. Ini mitigasi polyglot file yang sering dilewatkan.
- **PDF diverifikasi magic bytes** `%PDF-`, bukan hanya ekstensi.
- **Nama file tidak dipakai** untuk path — selalu UUID. `filepath.Base` hanya untuk ditampilkan. Path traversal lewat nama file tidak mungkin.
- **Otorisasi upload** per toko: slug diverifikasi kepemilikannya (`user_id = ?`) kecuali staf.
- **Otorisasi hapus** dengan `ResolveInsidePrefix` — menutup `../` dan perpindahan antar-tenant (perbaikan N-03/N-40 sebelumnya, terverifikasi ada di kode).
- **Namespace platform dilindungi RBAC** (`IsPlatformStaffRole`) — merchant tidak bisa menulis `platform/*` dan tidak bisa bypass kuota lewat sana (N-09).
- **Gating status toko**: banned = semua ditolak; suspended = produk/branding ditolak, support/billing tetap boleh (keputusan desain yang tepat — merchant yang dibekukan masih harus bisa bayar dan mengajukan banding).
- **Kuota per toko** + rekonsiliasi dari disk (`SyncStoreStorageUsed`) — ada self-healing.
- **Batas ukuran berlapis**: `BodyLimit` 12 MB di Fiber, 10 MB per file di handler.
- **Header keamanan** pada respons statis: `nosniff`, `X-Frame-Options: SAMEORIGIN`, CSP, `Referrer-Policy`.
- **Rate limiter** pada seluruh `/api`.
- **`Browse: false`** — directory listing mati.

---

## 5. Rekomendasi berurutan

### P0 — sebelum produksi (keamanan data pengguna)

1. **Pisahkan storage publik dan privat.**
   - `public/storage` tetap dilayani `app.Static` (produk, branding, artikel, platform).
   - Berkas privat (`billing`, `support`) pindah ke root terpisah yang **tidak** punya route statis.
   - Akses privat lewat endpoint ber-auth yang sudah ada (`support_handler` download) yang memeriksa kepemilikan, lalu streaming dari driver storage.
2. **Perbaiki header cache**: publik → `public, max-age=2592000, immutable`; privat → `private, no-store`.
3. **Tambahkan `Content-Disposition: attachment`** untuk semua PDF/berkas non-gambar.

### P1 — sebelum migrasi S3

4. **Tambahkan `Get(ctx, key) (io.ReadCloser, Stat, error)` ke `StorageService`** dan pakai di download lampiran, supaya tidak ada lagi jalur yang mengasumsikan disk lokal.
5. **Ganti semua `os.RemoveAll(StorageLocalRoot/...)` dengan `storage.DeletePrefix(ctx, "stores/{id}/")`.**
6. **Perbaiki `extractStorageKeyFromURL`** — satu implementasi saja, parsing `"/storage/"`, dan **jangan buang error** `Delete`. Tambahkan test yang gagal jika key masih berbentuk URL.
7. **Sambungkan `S3_USE_PATH_STYLE` ke `minio.Options{BucketLookup}`**; kumpulkan error di `DeletePrefix` S3.
8. **Konsep private bucket + presigned URL.** Untuk S3 produksi, bucket sebaiknya **privat** dan URL dibuat on-demand (`PresignGetObject`, masa berlaku pendek). `GetURL` statis tidak cocok untuk bucket privat.
9. **Mulai menulis `storage_key` ke DB** untuk record baru (kolomnya sudah ada, tinggal diisi), sambil `image_url` tetap diisi untuk kompatibilitas. Ini membuat migrasi berikutnya cukup mengubah satu sisi.

### P2 — kualitas

10. `image.DecodeConfig` sebelum decode penuh (anti decompression bomb).
11. Thumbnail 320px/640px untuk grid; simpan `{uuid}_thumb.jpg` di key yang sama.
12. Samakan `file_size` di respons dengan yang dipotong dari kuota.
13. `migrate-storage`: tambah `--dry-run`, verifikasi ukuran/checksum setelah upload, dan mode resume.

---

## 6. Catatan penting soal strategi migrasi

Ada dua jalan, dan pilihannya menentukan pekerjaan:

**Jalan A — pertahankan URL (paling murah).**
`STORAGE_PUBLIC_URL` tidak diubah; domain itu diarahkan ke S3/CDN lewat reverse proxy. **Syarat:** tidak boleh ada `app.Static("/storage")` yang menangani path itu lagi, dan seluruh key harus identik. Ini **tidak butuh rewrite DB**. Cocok kalau tujuannya CDN di depan domain sendiri. Kelemahannya: berkas privat tetap harus dipisah (P0), karena proxy akan meneruskan apa pun.

**Jalan B — URL berubah (paling bersih).**
Pindah ke `cdn.catavor.id` atau endpoint S3 langsung. **Wajib** rewrite DB, dan itu hanya aman kalau `storage_key` sudah terisi (P1 no. 9) atau ada skrip rewrite dengan dry-run + backup. Butuh masa transisi: layani dari dua tempat sampai semua baris termigrasi.

Rekomendasi saya: **P0 dulu, lalu P1 no. 4–9, baru pilih jalan A atau B.** Melakukan migrasi sebelum P0 = memindahkan masalah ke tempat yang lebih mahal.

---

## 7. Kesimpulan

- **Sudah standar S3?** Belum. Fondasinya benar (key hierarkis, driver terabstraksi, UUID, partisi waktu), tapi ada 5 blocker yang membuat migrasi hari ini akan memutus fitur dan meninggalkan file yatim. Perlu ±9 perubahan terarah sebelum "gampang".
- **Sudah aman?** Jalur **tulis** sudah baik — validasi magic byte, re-encode, otorisasi per tenant, RBAC platform, kuota. Jalur **baca** belum ada: satu route statis tanpa auth melayani seluruh storage, termasuk bukti bayar dan lampiran tiket. Itu satu temuan kritis yang harus ditutup sebelum produksi.
- **Cukup?** Tidak cukup, tapi tidak perlu dibongkar. Yang perlu ditambah adalah **pemisahan public/private** dan **operasi baca lewat driver**. Sisanya perbaikan kecil.

---

## 8. Status perbaikan — P0 (2026-10-19)

P0 dieksekusi dan diverifikasi runtime. Ini menutup temuan, **bukan** berarti sistem terbukti aman secara keseluruhan — P1 masih terbuka.

| Temuan | Status | Bukti runtime |
| --- | --- | --- |
| ST-01 route statis tanpa auth melayani berkas privat | **Tertutup** | `GET /storage/support/...` → 404 · `/storage/private/...` → 404 · `/storage/billing/...` → 404 · lampiran tanpa sesi → 401 |
| ST-02 root statis salah resolve (aset branding 404) | **Tertutup** | URL branding yang dulu 404 → `200 image/jpeg 24571B`; render di browser (avatar toko, naturalWidth 64) |
| ST-03 `storage_key` tidak ditulis untuk lampiran | **Tertutup (lampiran)** | Respons upload mengembalikan `storage_key`; baris `support_attachments` menyimpan key, `file_url` kosong |
| ST-04 baca berkas tanpa abstraksi driver | **Sebagian** | Lampiran support kini lewat endpoint ber-RBAC + `Content-Disposition` + `Cache-Control: private, no-store`; `Get()`/`Presign()` masih P1 |
| ST-05 `extractStorageKeyFromURL` cari `/uploads/` | **Terbuka** | P1 |
| ST-06 `os.RemoveAll` hardcoded | **Terbuka** | P1 |
| ST-07 `S3_USE_PATH_STYLE` tidak tersambung | **Tertutup** | `minio.Options{BucketLookup: minio.BucketLookupPath}` |

Bukti tambahan:

- Upload `category=support` → key `private/support/tickets/2026/10/<uuid>.jpg`, `url: ""`.
- Upload `category=branding` → key `stores/47/branding/...`, URL publik `http://localhost:8000/storage/...` → 200.
- Tiket uji dibuat lewat API, lampiran id 5: tanpa sesi **401**, dengan sesi **200 `image/jpeg` `inline`**, `?download=1` → **`attachment; filename="p0probe.png"`**.
- `go build ./...` bersih, `go vet ./...` bersih, `go test -count=1` pada config/storage/handlers/services semuanya `ok`.
- Playwright E2E: **24 passed, 6 skipped, 0 failed**.
- Artefak uji dibersihkan: `support_tickets=0`, `support_messages=0`, `support_attachments=0`, `storage_used_bytes` store 47 dikembalikan ke 0, file uji dihapus.

Catatan: `file_type` hasil re-encode PNG masih tercatat `image/jpeg` (perilaku lama re-encoder, bukan regresi P0).
