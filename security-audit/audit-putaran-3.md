# Audit Keamanan — Putaran Ketiga

Lingkup: inventaris rute & middleware, otorisasi lintas-peran runtime, IDOR
lintas-tenant, validasi input / unggahan / SSRF / injeksi.

Metode: pembacaan kode **dan** pembuktian runtime memakai dua akun uji nyata
(merchant & staf platform superadmin). Laporan putaran sebelumnya tidak dipakai
sebagai bukti — N-06 lolos dari audit statis, sehingga setiap klaim di sini
diverifikasi dengan request nyata.

Baseline commit: `2fb1d9f`.

## Ringkasan Temuan

| ID | Judul | Tingkat | Status |
|----|-------|---------|--------|
| N-07 | Kebocoran lintas-tenant pada laporan & komentar platform | KRITIS | TERTUTUP `a240eae` |
| N-08 | Data internal toko bocor di endpoint publik `/api/products/:id` | TINGGI | TERTUTUP `b09d496` |
| N-09 | Merchant bisa mengunggah ke namespace platform (bypass kuota) | TINGGI | TERTUTUP `d232e2f` |

---

## N-07 — Kebocoran lintas-tenant pada laporan & komentar platform

### Akar masalah
Tujuh rute moderasi platform terdaftar pada grup `guarded`
(hanya `AuthRequired` + `StoreOwnerRequired`), tanpa `RequirePermission`:

```
GET    /api/reports
GET    /api/reports/:id
PUT    /api/reports/:id
POST   /api/reports/review-item
GET    /api/admin/comments
POST   /api/admin/comments/:id/approve
DELETE /api/admin/comments/:id
```

`ReportHandler.Index` memakai query dasar `Model(&models.Report{})` tanpa
filter tenant sama sekali.

### Bukti runtime (akun merchant, toko sendiri)
- `GET /api/reports` → **200**, mengembalikan **26 laporan dari seluruh toko**,
  termasuk `reporter_email`, `reporter_ip`, `reporter_user_agent`, `admin_notes`.
- `GET /api/reports/:id` → **200**, memuat `Store.User` sehingga **email pemilik
  toko lain** ikut terbaca.
- `PUT /api/reports/:id` → **200**, berhasil mengubah laporan milik toko lain
  menjadi `dismissed` — mematikan penegakan moderasi.
- `POST /api/admin/comments/:id/approve` → **200** untuk merchant.

### Perbaikan
Seluruh rute dipindahkan ke grup `adminApi` dengan permission
`compliance:reports:manage` (laporan) dan `content:articles:manage` (komentar).

### Verifikasi pasca-perbaikan
| Rute | merchant | pengelola |
|------|----------|-----------|
| `GET /api/reports` | 404 | 404 (rute lama dihapus) |
| `GET /api/reports/:id` | 404 | 404 |
| `PUT /api/reports/:id` | 405 | 405 |
| `GET /api/admin/comments` | 403 | 200 |
| `POST /api/admin/comments/:id/approve` | 403 | 200 |
| `GET /api/admin/reports` | — | 200 |

---

## N-08 — Data internal toko bocor di endpoint publik

### Akar masalah
`GET /api/products/:id` bersifat publik (tanpa autentikasi) dan mengirim
`models.Store` mentah melalui relasi `Preload("Store")`.

### Bukti runtime (anonim, tanpa login)
```json
"store": { "user_id": …, "is_blacklisted": false, "suspension_reason": "none",
           "plan": …, "plan_status": …, "payment_status": …,
           "storage_used_bytes": …, "dormancy_status": …, "last_activity_at": … }
```
Data ini adalah informasi operasional internal (status moderasi, penagihan,
kuota, umur aktivitas) yang tidak boleh dibaca pengunjung anonim.

### Perbaikan
DTO whitelist eksplisit `models.PublicStoreView` (`internal/models/store_public.go`).
Respons kini memuat kunci `store` terpisah berisi field storefront saja;
relasi mentah pada `data` di-nil-kan.

### Verifikasi pasca-perbaikan
Anonim `GET /api/products/217` → 200; `data.store` = `null`; kunci `store`
berisi 21 field storefront (`store_title`, `slug`, `whatsapp_number`,
`store_theme`, `about_*`, `enable_wa_*`, `created_at`, …). Pemindaian field
sensitif (`is_blacklisted`, `is_suspended`, `suspension_reason`, `plan`,
`plan_status`, `storage_used_bytes`, `dormancy_status`, `last_activity_at`,
`user_id`, `payment_status`) → **tidak ada yang tersisa**.

Regresi dicek: `grep` `.store` pada `frontend/desktop` dan `frontend/mobile`
→ 0 pemakaian, jadi storefront tidak rusak. `/api/products`,
`/api/products/:id/recommendations`, `/api/public/safe-domains` tetap 200.

---

## N-09 — Merchant bisa mengunggah ke namespace platform

### Akar masalah
`POST /api/storage/upload` menentukan `isPlatformScope` dari kategori, tetapi
**tidak pernah memeriksa peran** sebelum menulis. Deteksi staf memakai daftar
string manual (`superadmin`, `support`, `admin`, plus satu email hardcoded).

### Bukti runtime
| category | merchant (sebelum) | merchant (sesudah) | pengelola |
|----------|--------------------|--------------------|-----------|
| `products` | 200 | 200 | 200 |
| `platform_branding` | **200** → `platform/branding/…` | **403** | 200 |
| `platform_partners` | **200** → `platform/partners/rekber/…` | **403** | 200 |

Karena `isPlatformScope` juga mengecualikan berkas dari perhitungan kuota
(`isQuotaCounted`), jalur ini berfungsi sebagai **bypass kuota penyimpanan**.
Asimetri terkonfirmasi: `DELETE` untuk key tersebut sudah 403, sedangkan
`POST` diizinkan.

### Perbaikan
- Tolak unggahan platform-scope untuk non-staf → `403 PLATFORM_SCOPE_FORBIDDEN`.
- Deteksi staf memakai whitelist terpusat `middleware.IsPlatformStaffRole`,
  konsisten dengan `RequireAdmin`; staf `compliance`/`finance`/`content` tidak
  lagi salah kelas.

### Verifikasi pasca-perbaikan
Lihat tabel di atas. Seluruh berkas uji yang dibuat selama audit dihapus dari
`public/storage` (termasuk berkas di `platform/branding` dan
`platform/partners/rekber`), dan status git terkait direktori tersebut bersih.

---

## Area yang Diaudit dan Hasilnya Bersih

Diperiksa, tidak ditemukan masalah — bukan karena asumsi, tetapi karena diuji:

1. **IDOR produk lintas-tenant** — merchant mengakses produk toko lain:
   `GET /api/products/217` (217 milik toko lain) → data tidak terekspos;
   `PUT` dan `DELETE` → **404** (query `First`/`Delete` memakai `store_id = ?`).
   Data diverifikasi utuh setelah uji.
2. **Tiket dukungan** — merchant `GET /api/support/tickets` → 200 dengan
   `count: 0` (hanya milik sendiri); tiket milik user lain → **404**.
3. **Pencarian & metrik platform** — `/api/stores/search`, `/api/users/search`,
   `/api/superadmin/dormancy/metrics`, `/api/automation/status`,
   `/api/automation/logs`, `/api/admin/notifications` → **403** untuk merchant,
   200 untuk pengelola.
4. **Log aktivitas** — merchant hanya melihat log dengan `store_id` miliknya
   (semua 11 baris `store_id: 25`); filter toko ada di kode
   (`GetStoreActivityLogs`).
5. **`/api/admin/categories`** — membaca kategori toko sendiri (area sah
   merchant), bukan data platform.
6. **SSRF** — hanya satu request keluar di seluruh `internal/`
   (`auth_handler.go`, `googleapis.com`), URL hardcoded, bukan input pengguna.
7. **Injeksi SQL** — 148 pemakaian `Raw`/`Exec` ditinjau; satu-satunya yang
   memakai `fmt.Sprintf` adalah `resetSequences` dengan slice literal internal,
   tidak ada input pengguna. `Order(` non-literal: 0. Semua `Where` memakai
   placeholder parameter.
8. **Validasi unggahan** — batas 10 MB, validasi magic bytes, PDF wajib
   `%PDF-`; gambar di-decode ulang lalu di-encode ulang (EXIF/webshell
   stripping) dan resize maks 1920px; ekstensi & content-type ditentukan
   server, bukan dari nama file klien.
9. **Penghapusan berkas** — `DeleteFile` memakai path guard dengan konfirmasi
   prefix `stores/{id}/` (N-03).
10. **Model `User`** — `password` dan `remember_token` bertanda `json:"-"`;
    `/api/auth/me` tidak mengembalikan `token_version`/`google_id`;
    `/api/admin/users/search` hanya mengembalikan `id`, `name`, `email`,
    `platform_role`.
11. **Login** — hanya mengembalikan data milik sendiri, tanpa field kredensial.

## Verifikasi Suite

```
go build ./...                                  exit 0
go vet ./...                                    exit 0
go test ./internal/security/ ./internal/middleware/ ./internal/services/ -count=1
  ok catavor-backend/internal/security    0.037s
  ok catavor-backend/internal/middleware  1.045s
  ok catavor-backend/internal/services    1.041s
```

Commit: `a240eae` (N-07), `b09d496` (N-08), `d232e2f` (N-09).

## Sisa Risiko (di luar lingkup perbaikan ini)

1. **Secret lama masih ada di riwayat publik** — nilai default JWT lama pernah
   ter-push. Nilai tersebut kini inert (fail-closed + penolakan via fingerprint
   SHA-256, secret aktif berbeda), tetapi untuk menghapusnya dari riwayat
   diperlukan `git filter-repo` + force-push yang menulis ulang seluruh riwayat.
   Ini keputusan pemilik repo, belum dilakukan.
2. **Sesi lama tidak berlaku** — rotasi JWT_SECRET membuat sesi lama tidak valid;
   seluruh pengguna harus login ulang.
3. **`user.Stores[0]` non-deterministik** — `auth.go:277` memuat `Preload("Store")`
   tanpa `ORDER BY`; pada akun multi-toko, toko aktif bisa tidak deterministik.
   Bukan celah eskalasi, tetapi sumber perilaku tak terduga.
4. **Tidak ada suite uji backend menyeluruh** — verifikasi bertumpu pada
   build, vet, uji paket terarah, dan probe runtime ad-hoc.
