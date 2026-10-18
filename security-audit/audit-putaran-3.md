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
Anonim `GET /api/products/217` → 200. Relasi `Store` mentah **tidak lagi terkirim**:
`models.Product.Store` bertag `json:"store,omitempty"`, sehingga kuncinya hilang
sepenuhnya dari `data` (bukan `null` — koreksi terhadap versi awal laporan ini, yang
keliru menulis "`data.store` = `null`"). Respons memuat kunci `store` terpisah berisi
21 field storefront (`store_title`, `slug`, `whatsapp_number`,`store_theme`,
`about_*`, `enable_wa_*`, `created_at`, …). Pemindaian field sensitif
(`is_blacklisted`, `is_suspended`, `suspension_reason`, `plan`, `plan_status`,
`storage_used_bytes`, `dormancy_status`, `last_activity_at`, `user_id`,
`payment_status`) → **tidak ada yang tersisa**.

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

---

## Cakupan Penyisiran — Angka Sebenarnya

Laporan ini **tidak** mengklaim seluruh permukaan API sudah diuji. Angka diukur
dengan memetakan setiap `x.Get/Post/Put/Patch/Delete(...)` di
`cmd/server/main.go` ke prefix grupnya (`api` → `/api`, `guarded`/`authOnly` →
`/api`, `adminApi` → `/api/admin`), lalu dicocokkan dengan daftar path yang
benar-benar diprobe runtime:

| Ukuran | Jumlah |
|--------|--------|
| Rute terdaftar (path+method unik, dengan prefix) | **195** |
| Dibuktikan runtime (putaran 1–3) | **32** (16,4 %) |
| Belum diuji sama sekali | **163** (83,6 %) |

Rincian per kelas proteksi: `PUBLIC` 58, `ADMIN` 47, `MERCHANT(+op)` 33,
`AUTH-ONLY` 29, `MERCHANT` 28. Sebanyak **19 rute PUBLIC bersifat menulis**
(`analytics/track`, `client-logs`, `reports`, `policies/agree`,
`articles/:id/comments`, `help/articles/:id/helpful`, seluruh `auth/*`,
`forgot-password`, `reset-password`).

Catatan metodologi: hitungan pertama saya (168) salah karena regex `\.` tidak
menangkap semua bentuk registrasi; hitungan kedua (230) juga salah karena
memetakan grup bersarang secara keliru. Angka 195 berasal dari pemetaan
`var := parent.Group("segmen")` + klasifikasi dari middleware asli grup
(`RequireAdmin` → ADMIN, `StoreOwnerRequired` → MERCHANT,
`OperationalStoreRequired` → MERCHANT(+op)). Pemetaan yang salah sempat
melabeli `/api/products` dan `/api/storage/upload` sebagai PUBLIC padahal
keduanya ada di `guardedMutations` — bukti bahwa label rute harus dibaca dari
deklarasi grup, bukan dari nama variabel.

Probe runtime adalah satu-satunya metode yang terbukti menemukan kelas temuan
ini: N-06 lolos dari audit statis, N-07 lolos dari satu putaran audit penuh.
Karena itu angka "belum diuji" harus dibaca sebagai **permukaan yang belum
terbukti**, bukan sebagai "dianggap aman".

### Rute berisiko (write/administratif) — hasil penyisiran manual

Sembilan rute yang dinilai paling berisiko dan belum pernah diuji, kini
seluruhnya lulus uji runtime dua-peran (path ditulis tanpa prefix `/api`;
`/api/admin/*` ada di grup `adminApi`):

| Rute | merchant | anonim | pengelola | Catatan |
|------|----------|--------|-----------|---------|
| `GET /analytics/export` | 200 (toko sendiri) | 401 | 200 (toko sendiri) | terisolasi per `store_id` |
| `GET /admin/analytics/export` | 200 (toko sendiri) | 401 | 200 | alias; tetap terisolasi |
| `GET /market-intelligence/export` | 200 | 200 | 200 | **publik by design** — lihat di bawah |
| `GET /admin/market-intelligence/export` | 200 (publik) | 200 | 200 | idem |
| `GET /admin/rbac/roles` \| `/matrix` \| `/staff` | 403 | 401 | 200 | `system:admins:manage` |
| `POST /admin/rbac/staff/assign` | 403 | 401 | — | eskalasi peran diblokir |
| `POST /stores/update` | 200 (toko sendiri) | 401 | — | tidak ada mass assignment |
| `POST /stores/delete-master-option` | 200 (toko sendiri) | 401 | — | `store_id = ?` di semua query |
| `POST /subscription/orders/:id/approve` | 403 | 401 | 200 | `finance:orders:manage` |
| `DELETE /user/account` | 200 (akun sendiri) | 401 | — | butuh frasa + password |

Catatan penting per rute:

- **`/market-intelligence/export` sengaja publik.** Isi CSV diperiksa baris per
  baris: hanya agregat (`Total Active Products`, benchmark harga per kategori,
  conversion rate). `grep` untuk `email`, `@`, `user_id`, `phone`, `whatsapp`,
  `owner`, nama toko → **0 hasil** dari 1.103 byte keluaran. Sesuai UU PDP/GDPR
  sebagaimana disertakan di header berkas. Bukan temuan.
- **`/stores/update`** memakai allowlist 20 field; `plan`, `is_blacklisted`,
  `is_suspended`, `user_id`, kuota **tidak** dapat ditulis. Perubahan `slug`
  dicegah menabrak toko lain (`LOWER(slug) = ? AND id != ?`) dan melewati daftar
  hitam kata cadangan.
- **`/user/account/delete`** mengambil identitas dari sesi (`Locals("user")`),
  bukan parameter; tanpa IDOR.
- **CSRF** terkonfirmasi aktif pada rute mutasi: `POST /api/stores/update` tanpa
  header `Origin` → `403 CSRF_REJECTED`.
- Ketiga rute `guarded`/`guardedMutations` di atas semuanya `401` untuk anonim.

### Temuan non-keamanan (dicatat, tidak diperbaiki)

1. **`DeleteMasterOption` melaporkan sukses palsu.** `field` yang tidak dikenal
   (mis. `{"field":"apa_saja"}`) lolos `switch` tanpa `default`, lalu membalas
   `200 {"success":true,"message":"Opsi master data berhasil dihapus."}` padahal
   tidak ada yang dihapus. Bukan celah keamanan — murni kualitas API.
2. **`/api/admin/rbac/me` terblokir untuk merchant.** Rute ini konseptual
   *self-service* (mengetahui izin sendiri), tetapi berada di grup `adminApi`
   (`RequireAdmin`), sehingga merchant → `403`. Tidak berdampak saat ini karena
   frontend tidak memanggilnya; jika kelak dipakai, sebagai merchant rute ini
   perlu dipindah keluar `adminApi`.
3. **`ApproveSubscriptionOrder` tidak menulis activity log.** Hanya menulis log
   aplikasi (`log.Info`). Aksi keuangan yang mengubah paket toko idealnya
   meninggalkan jejak audit di `activity_logs` — jalur `RBAC_ACCESS_DENIED` dan
   `auth.login` sudah tercatat, sedangkan approval tidak.

### Insiden selama penyisiran (sudah dipulihkan)

Saat menguji `/subscription/orders/:id/approve`, probe `POST` dengan pengelola
**sempat menyetujui order id 1 milik toko 23** (data non-uji, pemilik asli).
Dampak: `subscription_orders.payment_status` → `paid` + `paid_at` terisi, dan
`stores.plan` → `pro_starter` + `plan_expires_at` +1 bulan.

Pemulihan dilakukan dengan merekonstruksi nilai asli dari kode, bukan menebak:
`payment_status = 'pending_verification'` pada sebuah toko **hanya** diproduksi
oleh jalur registrasi berbayar (`auth_handler.go:691-694`), yang sekaligus
memaksa `plan = 'free'` dan `plan_expires_at = NULL`; order berbayar pada jalur
yang sama lahir dengan `payment_status = 'pending'` dan `paid_at = NULL`
(`auth_handler.go:746-751`). Bukti pendukung: `stores.payment_status` toko 23
masih `pending_verification` (approval tidak pernah menyentuh field ini), dan
`stores.updated_at` sama persis dengan timestamp approval saya.

```sql
UPDATE subscription_orders SET payment_status='pending', paid_at=NULL WHERE id=1;
UPDATE stores SET plan='free', plan_status='active', plan_expires_at=NULL WHERE id=23;
```

Terverifikasi setelah pemulihan: order `pending` / `paid_at` kosong; toko
`free` / `plan_expires_at` kosong / `payment_status` tetap
`pending_verification`. Tidak ada backup DB tersedia, sehingga pemulihan
mengandalkan rekonstruksi dari kode — risiko sisa: `stores.updated_at` toko 23
kini mencerminkan waktu pemulihan, bukan waktu aslinya.

**Pelajaran:** probe tulis berbahaya tidak boleh diarahkan ke ID yang tidak
dikontrol penuh. ID tersebut diambil dari hasil enumerasi, bukan dari data uji
yang dibuat sendiri.

---

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
   build, vet, uji paket terarah, dan probe runtime ad-hoc. Satu verifier ad-hoc
   yang saya tulis pun awalnya salah (mengasumsikan `data.store = null` dan
   memakai PNG korup), dan kesalahan itu menutupi hasil yang sebenarnya benar —
   verifier ad-hoc harus selalu disertai kontrol positif.
5. **163 dari 195 rute (83,6 %) belum pernah diprobe runtime.** Ini permukaan
   yang *belum terbukti*, bukan permukaan yang *terbukti aman*. Lihat bagian
   "Cakupan Penyisiran — Angka Sebenarnya".

---

## N-11 (KRITIS) — Verifikasi email bisa dilewati total

**Ditemukan saat menyisir 19 rute PUBLIC yang menulis.**

`ValidateAndConsumeToken` mengembalikan `bool`, tetapi hasilnya diabaikan di
tiga lokasi dengan `_ =` (`auth_handler.go`). Akibatnya pemeriksaan token tidak
pernah berpengaruh pada hasil.

### Registrasi (`Register`)
Token hanya dicek `req.VerificationToken != ""`; `VerifyOTP` **tidak pernah
dipanggil** pada alur ini. Siapa pun dapat mendaftar tanpa pernah menerima
email verifikasi.

Bukti runtime (sebelum perbaikan):

| Uji | Hasil |
|-----|-------|
| `POST /api/auth/register` dengan `verification_token: "vt_palsu..."` | **200**, toko id 26 dibuat |
| `POST /api/auth/register` tanpa field `verification_token` | **200**, toko id 27 dibuat |
| `POST /api/login` ke akun hasil bypass | **200**, JWT diterbitkan |
| `SELECT count(*) FROM email_verification_otps` untuk email tersebut | **0** |

`email_verified_at` tetap terisi padahal tidak ada satu pun OTP yang pernah
dibuat — verifikasi email sepenuhnya kosmetik.

### Reset password (`ForgotPasswordReset`, `ResetPassword`)
Token yang gagal dikonsumsi tidak menghentikan penggantian password. Karena
`VerifyOTP` sudah dijalankan lebih dulu, ini **bukan** bypass autentikasi —
penyerang tetap butuh OTP yang benar. Dampak nyata: token yang sudah
kedaluwarsa/dipakai masih meloloskan reset, dan satu token bisa dipakai
berulang selama record OTP belum terhapus.

Urutan juga salah: token dikonsumsi **sebelum** user dicek, sehingga token
hangus hanya karena email tidak terdaftar.

### Perbaikan (`8c7a78d`)
- Registrasi: `verification_token` wajib ada dan wajib lolos
  `ValidateAndConsumeToken` (alur Google SSO dikecualikan, diverifikasi lewat
  `GoogleID`).
- Reset password: token wajib lolos konsumsi.
- Cek user dipindah ke sebelum konsumsi token.

### Verifikasi pasca-perbaikan
| Uji | Hasil |
|-----|-------|
| register tanpa token | **422** |
| register dengan token palsu | **422** |
| reset password dengan OTP palsu | **422** |
| alur sah: OTP benar → `verification_token` → register | **200** (toko dibuat) |
| replay token yang sudah terpakai | **422** |

Alur sah tetap berfungsi, sehingga perbaikan tidak mematahkan registrasi.

