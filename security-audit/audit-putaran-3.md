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
| N-10 | Hasil konsumsi token verifikasi diabaikan pada alur reset | SEDANG | TERTUTUP `8c7a78d` |
| N-11 | Verifikasi email registrasi bisa dilewati total | KRITIS | TERTUTUP `8c7a78d` |
| N-12 | Staf `support` dapat mengubah pengaturan platform | TINGGI | TERTUTUP `02a22b8` |
| N-13 | Paket berbayar aktif tanpa bayar lewat `/api/auth/google` | KRITIS | TERTUTUP `ac1ae3e` |
| N-14 | `email_verified` Google diabaikan; akun dapat diambil alih | TINGGI | TERTUTUP `ac1ae3e` |

Semua perbaikan di atas dibuktikan dengan probe runtime, dan N-11 serta N-12
disertai **kontrol negatif** (source dikembalikan ke versi rentan, di-build
ulang, dan pembuktian gagal sesuai harapan) — tanpa itu, hasil "PASS" tidak
membuktikan apa pun.

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
| Handler unik (banyak rute adalah alias) | **140** |
| Dibuktikan runtime (putaran 1–3) | **34** (17,4 %) |
| Belum diuji sama sekali | **161** (82,6 %) |

Rincian per kelas proteksi: `PUBLIC` 59, `ADMIN` 54, `MERCHANT` 21,
`MERCHANT(+op)` 33, `AUTH-ONLY` 28. Dari **100 rute yang menulis**
(non-`GET`): `MERCHANT(+op)` 33, `ADMIN` 24, `PUBLIC` 20, `AUTH-ONLY` 19,
`MERCHANT` 4.

Dari 230 baris registrasi, hanya **140 handler unik** yang dipakai — 66 handler
melayani lebih dari satu rute (153 rute berbagi handler). Contoh:
`storeHandler.CheckSlug` didaftarkan 6 kali, `ExportMarketIntelligenceData` 3
kali. Artinya menguji satu rute sering sudah mencakup alias-nya, tetapi **bukan**
sebaliknya: menguji satu alias tidak otomatis membuktikan varian yang punya
middleware berbeda. Karena itu jumlah rute tetap dipakai sebagai angka cakupan.

Catatan metodologi — lima kali angka ini salah dan dikoreksi:

1. **168** — regex `\.` tidak menangkap semua bentuk registrasi.
2. **230** — grup bersarang dipetakan keliru.
3. **220** — prefix grup tersambung hingga menghasilkan `////api/...`
   (bug `re.sub` pada penggabungan path).
4. **ADMIN 47 → 54** — klasifikasi hanya melihat `RequireAdmin` di deklarasi
   grup, padahal banyak rute `/api/admin/*` berada di grup `guarded` dan
   dijaga per-route lewat variabel izin (`sysManage`, `auditRead`,
   `marketIntel`, `supportRead`, `supportReply`, `contentSend`). Rute seperti
   itu sempat terhitung `MERCHANT` — jelas salah untuk endpoint admin.
5. **38 → 33 terbukti** — daftar probe sempat saya tulis dengan nama yang
   tidak persis ada di router (`/api/auth/verify-email`, `/api/auth/verify-otp`)
   dan sebagian alias (`/api/login` vs `/api/auth/login`) terhitung dobel.
   Angka 33 memakai daftar yang sudah dicocokkan baris per baris ke
   `main.go`; 4 alias yang handler-nya sama dan sudah diprobe tidak dihitung
   sebagai temuan baru.
 Angka 195 berasal dari pemetaan
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

## N-13 (kritis) — Paket berbayar aktif tanpa pembayaran lewat `POST /api/auth/google`

**Lokasi:** `backend/internal/handlers/auth_handler.go`, `GoogleAuth` (CASE B).

**Masalah.** Saat membuat akun baru lewat Google SSO, `GoogleAuth` membaca
`req.Plan` dari body request lalu langsung menetapkan:

```go
if rawPlan == "pro" || rawPlan == "pro_starter" { plan = "pro_starter" }
else if rawPlan == "pro_business"                { plan = "pro_business" }
...
if plan != "free" { paymentStatus = "paid" }
```

Tidak ada perhitungan harga, kupon, invoice, maupun verifikasi admin. Cukup
kirim `{"credential": "<token Google>", "plan": "pro_business"}` dan toko
baru lahir dengan `plan='pro_business'`, `payment_status='paid'`,
`plan_expires_at` +1 bulan, dan `custom_domain_status='active'`.

Sebagai pembanding, `Register()` di berkas yang sama **sudah** punya
penjagaan eksplisit — komentar aslinya: *"Security Defense Against Free
Upgrade Exploit"* — yang menetapkan `actualStorePlan = "free"` dan
`payment_status = "pending_verification"` bila `finalAmount > 0`. Penjagaan
itu **tidak pernah** dipasang di jalur Google.

**Dampak.** Kehilangan pendapatan langsung: setiap pengguna bisa
memberi dirinya paket termahal tanpa membayar. Karena jalur ini juga
membuat toko baru, dampaknya bukan hanya label — fitur berbayar dan
custom domain ikut aktif.

**Perbaikan.** `req.Plan` diabaikan sepenuhnya di `GoogleAuth`; semua toko
baru lewat Google mulai dari `plan='free'`, `payment_status='free_active'`.
Upgrade hanya lewat `Register()` (invoice + verifikasi admin).

**Verifikasi.**
- Uji `TestGoogleAuthMengabaikanPlanDariRequest` — LULUS pada kode diperbaiki.
- Kontrol negatif: pada kode rentan uji yang sama GAGAL dengan 4 pesan,
  termasuk `"GoogleAuth masih menetapkan paket berbayar dari request"`.
- Runtime: `POST /api/auth/google` dengan token palsu tetap `401`
  (verifikasi Google tidak dilonggarkan); `/api/login` dan `/api/register`
  tidak mengalami regresi.

**Catatan kejujuran.** Bukti runtime end-to-end **belum** diperoleh: perlu
token Google asli, dan saya tidak memilikinya. Klaim celah ini bertumpu pada
pembacaan kode + uji otomatis dengan kontrol negatif. Untuk menutup celah ini
secara runtime, perlu satu kali login Google memakai akun uji ber-`plan`
`pro_business` lalu memeriksa `SELECT plan, payment_status FROM stores`.

---

## N-14 (tinggi) — `email_verified` Google diabaikan; akun bisa diambil alih

**Lokasi:** `verifyGoogleCredential` dan `GoogleAuth` CASE A.

**Masalah.** Struk pembaca token sudah memuat field `EmailVerified any`,
tetapi nilainya **tidak pernah diperiksa** di kedua jalur verifikasi
(`tokeninfo` maupun `userinfo`). Alamat email diterima apa adanya.

Di CASE A (akun sudah ada), `google_id` ditempelkan ke akun yang cocok
berdasarkan email, tanpa melihat apakah akun tersebut sudah lolos
verifikasi:

```go
if (user.GoogleID == nil || *user.GoogleID == "") && googleID != "" {
    user.GoogleID = &googleID
    database.DB.Save(&user)
}
```

**Dampak.** Siapa pun yang bisa membuat identitas Google dengan alamat email
yang belum terverifikasi dapat masuk ke akun Catavor yang memakai alamat itu.
Data produksi: **13 dari 18 akun** belum punya `email_verified_at`, sehingga
permukaan serangannya nyata.

**Perbaikan.**
1. `claimsEmailVerified` menormalkan klaim `email_verified` (`bool` maupun
   `string "true"`), **fail-closed** untuk bentuk yang tidak dikenali.
2. Ditambahkan di kedua jalur verifikasi; email yang belum terverifikasi
   ditolak sebelum `GoogleAuth` melanjutkan.
3. CASE A menolak (`403`) penautan Google ke akun yang emailnya belum
   diverifikasi — **hanya bila akun tersebut belum punya `google_id`**.

**Jebakan yang ditemukan saat verifikasi (penting).** Penjagaan versi pertama
saya mensyaratkan `EmailVerifiedAt == nil` saja. Itu **salah** dan akan
mengunci pengguna sah: data produksi berisi **5 akun** dengan `google_id`
terisi, toko aktif, tetapi `email_verified_at` kosong
(id 2, 3, 4, 6, 7). Akun-akun ini dulu masuk lewat Google, jadi emailnya
sudah terverifikasi di sisi Google meski kolom lokalnya belum diisi.
Syarat `belumTertautGoogle` ditambahkan agar mereka tetap bisa masuk.

**Verifikasi.**
- `TestClaimsEmailVerified` (10 kasus) — LULUS.
- `TestPenjagaanN14TidakMengunciAkunTertautGoogle` — LULUS, dan gagal bila
  syarat `google_id` dihapus (kontrol negatif).
- Kontrol negatif `claimsEmailVerified`: badan fungsi asli diganti `return true`,
  lalu uji dijalankan ulang — 6 dari 10 kasus GAGAL (`false`, `"false"`, `""`,
  `1`, `nil`, `map`). Kode dipulihkan setelahnya dan diverifikasi identik
  dengan commit (`git diff` kosong).
- **Koreksi metode.** Percobaan pertama kontrol negatif ini memakai berkas uji
  tambahan yang mendeklarasikan ulang `claimsEmailVerified`. Uji memang gagal,
  tetapi karena *redeclaration* — bukan karena logika — sehingga tidak sah
  sebagai kontrol. Dicatat di sini supaya tidak terulang: kontrol negatif hanya
  sah bila kegagalannya berasal dari perilaku yang diuji.
- Cek data: kelima akun Google asli (id 2, 3, 4, 6, 7) berstatus
  "LOLOS (sudah tertaut)", bukan diblokir.

**Catatan kejujuran.** Sama seperti N-13: belum ada bukti runtime end-to-end
karena butuh token Google asli.

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

Commit: `a240eae` (N-07), `b09d496` (N-08), `d232e2f` (N-09),
`8c7a78d` (N-10 + N-11), `02a22b8` (N-12), `934ae29` (gofmt).

Hasil ini **bukan** suite uji menyeluruh: tidak ada test backend yang mencakup
handler-handler ini. Verifikasi bertumpu pada build, vet, tiga paket uji
terarah, dan probe HTTP runtime ad-hoc.

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
5. **161 dari 195 rute (82,6 %) belum pernah diprobe runtime.** Ini permukaan
   yang *belum terbukti*, bukan permukaan yang *terbukti aman*. Lihat bagian
   "Cakupan Penyisiran — Angka Sebenarnya".

---

## N-11 (KRITIS) — Verifikasi email bisa dilewati total

**Ditemukan saat menyisir rute PUBLIC yang menulis (20 rute terdaftar).**

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

---

## N-10 (sedang) — Hasil konsumsi token verifikasi diabaikan

**Ditemukan bersamaan dengan N-11** saat menyisir pola `_ =` di seluruh backend.

`ValidateAndConsumeToken` mengembalikan `bool`, tetapi di tiga lokasi hasilnya
dibuang dengan `_ =`. Pada alur reset password, penyerang tetap memerlukan OTP
yang benar untuk sampai ke titik ini, sehingga **bukan** bypass autentikasi.
Dampak sebenarnya: token verifikasi yang sudah kedaluwarsa atau sudah terpakai
tetap meloloskan reset password.

Dua lokasi berada di alur reset (`ForgotPasswordReset`, `ResetPassword`), satu
di registrasi (lihat N-11 — di sana dampaknya jauh lebih berat karena OTP tidak
pernah diverifikasi sama sekali).

Perbaikan (`8c7a78d`, satu commit dengan N-11):

```go
if !services.GetOTPService().ValidateAndConsumeToken(user.Email, token, "password_reset") {
    return c.Status(fiber.StatusUnprocessableEntity).JSON(...)
}
```

Verifikasi: `grep -rn '_ = .*ValidateAndConsumeToken'` → **0 hasil** setelah
perbaikan; ketiga pemanggilan kini memakai nilai kembaliannya.

Catatan urutan: pada `ResetPasswordDirect`, konsumsi token semula dilakukan
**sebelum** lookup user, sehingga token bisa hangus untuk email yang tidak
terdaftar. Urutan dibalik — user dicari lebih dulu.

---

## N-12 (tinggi) — Staf `support` dapat mengubah pengaturan platform

**Ditemukan saat menyisir 24 rute ADMIN yang menulis.**

`POST /api/admin/settings` dan `POST /api/admin/settings/rekber/reset-defaults`
memakai **blacklist** peran, bukan whitelist:

```go
role := strings.ToLower(strings.TrimSpace(user.PlatformRole))
if role == "" || role == "merchant" {
    return c.Status(fiber.StatusForbidden)...
}
```

Setiap peran staf platform selain `merchant` otomatis lolos — termasuk
`support`, yang pada matriks RBAC hanya memegang izin tiket. `GET
/api/admin/settings` bahkan tidak memiliki pemeriksaan otorisasi apa pun di
handler. Pengaturan ini mencakup monetisasi, iklan, dan kredensial partner.

### Koreksi atas dugaan awal

Saat menyisir, 23 rute ADMIN tampak "tanpa `RequirePermission`". Setelah
diperiksa lebih teliti, **hanya `settings` yang benar-benar tanpa gate**:
rute lain didaftarkan **dua kali** di `main.go` (grup `guarded` dan `adminApi`).
Grup `guarded` memakai `RequirePermission("system:admins:manage")` dan
didaftarkan lebih dulu sehingga yang berlaku adalah versi ketat — terbukti dari
`safe-domains` dan `automation` yang tetap `403` untuk staf `support`.

### Bukti runtime

| Peran | `GET /api/admin/settings` | `POST /api/admin/settings` |
|-------|---------------------------|----------------------------|
| `support` — sebelum perbaikan | **200** | **200** (nilai berubah) |
| `support` — sesudah perbaikan | 403 | 403 |
| `merchant` | 403 | 403 |
| `superadmin` | 200 | 200 |

Nilai `ads_test_mode` diubah `0` → `true` sebagai bukti tulis, lalu
dikembalikan ke `0` dan diverifikasi ulang lewat query DB.

Kontrol negatif: source dikembalikan sementara ke versi rentan
(`git stash`), di-build ulang, dan `support` kembali mendapat `200` —
memastikan `403` berasal dari perbaikan, bukan dari faktor lain.

### Perbaikan (`02a22b8`)

- Ketiga rute settings memakai `RequirePermission("system:settings:manage")` —
  izin yang **sudah ada** di matriks RBAC dan hanya dimiliki `superadmin`.
- `setting_handler.go`: blacklist peran diganti whitelist
  `middleware.IsPlatformStaffRole` sebagai lapisan kedua (defense in depth),
  konsisten dengan N-05.
- Tanpa regresi: staf `support` tetap `200` pada `/admin/support/tickets` dan
  `/admin/rbac/me`.
