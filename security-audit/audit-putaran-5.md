# Audit Putaran 5 — Penanda Staf Platform & Hapus Toko

Lanjutan dari [audit-putaran-4.md](audit-putaran-4.md). Putaran 4 memisahkan
jalur otorisasi staf platform dari tenant merchant, tetapi **cara menandai
"apakah seseorang staf"** belum disentuh. Putaran ini menutup celah tersebut,
dan menemukan satu bug produksi serius secara tidak sengaja saat menguji regresi.

Hasil: **N-25** dan **N-26**, keduanya `high`, keduanya diperbaiki dan
diverifikasi runtime.

---

## N-25 — Penanda staf platform berbasis string email (HIGH)

### Temuan

Otorisasi staf ditentukan dengan membandingkan email ke literal
`admin@catavor.com` di **34 titik**:

| Lokasi | Jumlah | Fungsi |
|---|---|---|
| `middleware/auth.go` | 4 | bypass status akun, penanda staf |
| `handlers/auth_handler.go` | 11 | `actorRole`, payload `is_admin`/`is_superadmin` |
| `handlers/support_handler.go` | 5 | akses lintas-toko |
| `handlers/notification_handler.go` | 3 | visibilitas notifikasi |
| `handlers/analytics_handler.go` | 2 | cakupan analitik |
| `handlers/activity_log_handler.go` | 1 | ringkasan audit |
| `handlers/store_handler.go` | 1 | wewenang hapus toko |
| `services/rbac_service.go` | 2 | anti-lockout |

Akun `admin@catavor.com` **tidak ada** di database. Nilainya murni string
magic: tidak dapat dikelola lewat role assignment, tidak muncul di UI RBAC,
dan tidak dapat diaudit.

### Masalah turunan yang ikut ditemukan

1. **Role fiktif.** Beberapa blok memakai daftar role yang tidak ada di tabel
   `platform_roles` (isi nyata: `superadmin`, `support`, `finance`,
   `compliance`, `content`):
   - `store_handler.go` — `platform_admin`, `super_admin`, `moderator`
   - `store_handler.go` (DeleteStore) — `platform_admin`, `admin`
   - `product_handler.go` — `investigator`
2. **Staf sah tidak diakui.** Karena daftar manual tidak memuat `support`,
   `finance`, `compliance`, atau `content`, staf dengan role tersebut gagal
   pada jalur yang memakai daftar manual — padahal pada jalur lain (via
   `RequirePermission`) mereka berhak. Contoh: `DeleteStore` menolak staf
   `support`.
3. **Anti-lockout rapuh.** `RevokeStaffRole` melindungi akun berdasarkan email
   hardcode. Bila email pemilik diganti (alur normal), perlindungan hilang.

### Perbaikan

Satu sumber kebenaran di `backend/internal/models/platform_role.go` (baru):

```go
var PlatformStaffRoles = map[string]struct{}{ /* 5 role nyata */ }
func NormalizePlatformRole(role string) string
func IsPlatformStaffRole(role string) bool      // varian string (SSE)
func (u *User) IsPlatformStaff() bool           // nil-safe
func (u *User) IsSuperadmin() bool              // nil-safe
```

- `middleware.PlatformStaffRoles` kini **alias** ke `models` — tidak lagi
  menduplikasi daftar.
- 34 titik hardcode email → helper. Role fiktif dihapus.
- `HasPermission` menolak role di luar whitelist (sebelumnya menolak hanya
  `""` dan `"merchant"`, sehingga string sampah dianggap staf).
- `RevokeStaffRole`: anti-lockout dihitung dari **jumlah superadmin di DB**.
- `AssignStaffRole`: menolak role yang tidak dikenal (mencegah salah ketik
  menjadi role liar).
- Seeder instalasi-baru tidak lagi membuat akun berpassword literal
  `"password"`; password diacak, akun dilewati bila env seed tidak diisi.

Dua titik `PlatformRole == "superadmin"` di `notification_hub.go`
**dipertahankan** — itu memang niat khusus superadmin (pengawasan lintas-toko),
bukan penanda staf umum.

### Verifikasi

`hermes-verify-n25.sh` — **30 PASS / 0 FAIL**, mencakup:

- staf role `support` → 200 pada endpoint `support:*`, 403 pada `audit:logs:read`
  (sesuai permission DB — bukan regresi);
- staf role `finance` → 200 pada endpoint `finance:*`, 403 pada `support:*`;
- role sampah lewat SQL (`investigator`) → **403**, membuktikan whitelist
  ditegakkan;
- superadmin tanpa toko → jalur admin 200, jalur merchant 403 "Akses toko
  tidak valid" (perilaku benar);
- cabut role → akses admin hilang (403) **tanpa** menghapus toko;
- akun `admin@catavor.com` dan `admin@catavor.local` tidak ada di DB.

Cabang anti-lockout diuji terpisah lewat `cmd/hermes_verify_lockout` dengan
**kontrol positif**: superadmin=1 → pencabutan **ditolak**; superadmin=2 →
pencabutan **diizinkan** dan role benar-benar berubah.

---

## N-26 — `DeleteStore` selalu 500 (HIGH)

### Temuan

Ditemukan saat regresi N-25: `POST /api/stores/:id/delete` mengembalikan
**500** untuk semua kasus, termasuk toko milik sendiri.

Log awal hanya menunjukkan:

```
ERROR: current transaction is aborted, commands ignored until end of
transaction block (SQLSTATE 25P02)
```

Akar masalahnya tiga lapis:

1. **Error diabaikan.** Sepuluh penghapusan memakai `_ = ....Error`. Di
   PostgreSQL satu perintah gagal membuat transaksi `aborted`; semua perintah
   berikutnya ikut gagal — termasuk `DELETE` toko. Akar masalah tersembunyi.
2. **Kolom salah.** `product_variants` dan `product_images` **tidak punya**
   kolom `store_id` (relasi lewat `product_id`). `WHERE store_id = ?` selalu
   error `42703`.
3. **Tabel tidak ada.** `store_daily_traffic_sources` tidak pernah dibuat
   karena `.env` berisi `DB_AUTO_MIGRATE=false` dan `SKIP_DB_MIGRATE=true`,
   sehingga model di `AutoMigrate` tidak dieksekusi.

### Perbaikan

- Setiap error ditangani: `Rollback()` + log nama tabel + pesan spesifik ke
  klien. Kegagalan sekarang **menyebut tabel penyebabnya**, tidak lagi 500 bisu.
- Purge mengikuti relasi sebenarnya: `product_variants`/`product_images` lewat
  sub-query `product_id IN (SELECT id FROM products WHERE store_id = ?)`;
  sisanya `store_id`.
- Migrasi idempoten masuk repo: `backend/migrations/` + README berisi cara
  pakai dan peringatan soal relasi `product_id`.

### Verifikasi

Siklus penuh pada data nyata: buat toko (`POST /api/user/stores`) → ada di DB →
hapus dengan `confirm_slug` → **200** → baris **hilang dari DB**.

Regresi penuh: **26 PASS / 0 FAIL**.

---

## Catatan metodologi

Tiga kegagalan verifikasi awal ternyata **bukan regresi kode**, melainkan
kesalahan uji — dicatat agar tidak terulang:

| Gejala | Sebab sebenarnya |
|---|---|
| `/admin/analytics` 403 | Endpoint itu jalur **merchant** (grup `guarded`), butuh toko. Superadmin tanpa toko → 403 itu **benar**. |
| Login mengembalikan token kosong | Respons `/auth/login` bersifat **datar** (`token` di root, bukan `data.token`). |
| Toko uji tertinggal di DB | Ekstraksi ID salah (`data` berupa array); jaring pengaman kini menghapus lewat DB. |
| `/admin/support/help-articles` 404 | Rute tidak pernah ada; yang benar `/admin/support/templates`. |

Satu temuan tambahan: `DELETE` butuh body `{"confirm_slug": "...", "password": "..."}`.
Tanpa itu → 400 "Format data konfirmasi tidak valid" — bukan bug.

## Sisa

- **N-21** — fungsional, menunggu keputusan produk.
- Residu frontend: redirect `/catavor` (`App.tsx` desktop:9920 / mobile:9969)
  dan fallback `storeSlug || 'catavor'` (desktop:4056, 4131).
- `IsReservedSlug` masih exact-match (lubang awalan `catavor-x`).

---

## N-27 — Landing page crash total saat `/stores/featured` mengembalikan `null` (HIGH)

### Temuan

Ditemukan saat verifikasi runtime residu frontend, **bukan** saat membaca kode.
Landing page desktop menampilkan ErrorBoundary "Kendala Memuat Aplikasi Catavor
Desktop"; konsol: `TypeError: Cannot read properties of null (reading 'filter')`.

Bukti langsung dari API:

```
$ curl -s http://127.0.0.1:8000/api/stores/featured
{"data":null,"success":true}
```

Alurnya:

1. `setFeaturedStores(featuredData.data)` dipanggil tanpa cek tipe
   (`App.tsx:11258`). Jalur `onFresh` di atasnya **sudah** memakai
   `Array.isArray`, jalur data cache tidak.
2. State menjadi `null` → `featuredStores.filter(...)` (`App.tsx:14503`)
   melempar TypeError.
3. ErrorBoundary menangkapnya dan menggantikan **seluruh** halaman.

Pola identik ada pada `faunas` (`setFaunas(faunaData.data)`).

Dampak: seluruh halaman depan tidak dapat diakses setiap kali basis data tidak
punya toko unggulan — termasuk **instalasi baru** dan kondisi DB saat ini.
Di mobile, bug yang sama ada di `App.tsx:11444`.

### Perbaikan

- `setFeaturedStores` / `setFaunas`: `Array.isArray(x) ? x : []` (desktop + mobile).
- Titik pemakaian: `(featuredStores || []).filter(...)` sebagai lapisan kedua.

### Verifikasi

| Uji | Sebelum | Sesudah |
|---|---|---|
| Desktop `GET /` | ErrorBoundary aktif, 2 console error | Render penuh, **0 error** |
| Mobile `GET /mobile/` | crash yang sama | Render penuh, **0 error** |

Verifikasi juga memakai bukti negatif: build dari kode **sebelum** perubahan
(`git stash`) tetap crash — membuktikan bug ini bukan regresi dari perubahan
residu slug.

### Residu slug `catavor`

Fallback `storeSlug || 'catavor'` (8 titik) dihapus. `IsReservedSlug` menolak
semua varian (`catavor`, `catavor-x`, `c4t4v0r`, `cat-avor`, …) — diuji runtime
via helper Go, semuanya `reserved=true`, sedangkan `tokosaya`/`bunga` lolos.
Artinya `catavor.id/catavor` **tidak pernah** menunjuk toko nyata: pengunjung
yang memindai QR akan mendarat di landing page. Kini tanpa slug tidak ada URL
atau QR yang dibuat, dan aksi salin ditolak dengan pesan jelas.

Redirect `/catavor` → `/` **dipertahankan** — itu perilaku yang benar karena
`catavor` adalah nama platform.
