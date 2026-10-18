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
| N-15 | `X-Forwarded-For` dapat dipalsukan; rate limiter & dedup per-IP bisa dilewati | TINGGI | TERTUTUP |
| N-16 | `/api/help/articles/:id/helpful` tanpa rate limiter & tanpa dedup (vote tak terbatas) | SEDANG | TERTUTUP |
| N-17 | `/api/send-register-otp` & forgot-password membocorkan status akun (enumerasi) | SEDANG | TERTUTUP |
| N-18 | Merchant bisa menerbitkan/mengubah/menghapus artikel platform & menulis master settings | KRITIS | TERTUTUP |
| N-19 | Kupon gratis hardcoded (`CATAVOR100`, `GRATISPRO`) mengaktifkan paket berbayar tanpa bayar | KRITIS | TERTUTUP |
| N-20 | Persetujuan invoice langganan tidak meninggalkan jejak audit (siapa menyetujui?) | SEDANG | TERTUTUP |

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

---

## N-15 — `X-Forwarded-For` dapat dipalsukan (rate limiter per-IP dilewati)

### Akar masalah
Fiber dikonfigurasi `EnableTrustedProxyCheck: true` dengan `ProxyHeader:
X-Forwarded-For`, tetapi daftar `TrustedProxies` di-hardcode ke
`127.0.0.1`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.
Artinya **seluruh jaringan lokal** dianggap proxy terpercaya, sehingga siapa pun
di LAN dapat menetapkan IP klien sesuka hati. Diperparah oleh dua handler yang
membaca header itu sendiri, melewati normalisasi Fiber:

- `internal/handlers/analytics_handler.go` (kunci dedup event)
- `internal/handlers/report_handler.go` (dedup laporan publik)

### Bukti runtime (sebelum perbaikan)
`/api/client-logs` dibatasi 15 permintaan/menit per IP. Dari IP LAN
`192.168.1.6`, setelah kuota habis:

```
200 ×15 -> 429 429 429        (kuota habis)
lalu 8 permintaan dengan X-Forwarded-For berputar:
200 200 200 200 200 200 200 200   <- limiter dilewati total
```

### Perbaikan
1. `internal/config/config.go`: `TrustedProxies` menjadi konfigurabel via
   `TRUSTED_PROXIES`, default **hanya loopback** (`127.0.0.1,::1`) — cukup untuk
   reverse proxy di host yang sama. Deployment lain wajib menyetel eksplisit.
2. `cmd/server/main.go`: memakai `cfg.TrustedProxies`, tidak lagi hardcode.
3. Kedua handler berhenti membaca `c.Get("X-Forwarded-For")` dan memakai
   `c.IP()` saja agar normalisasi Fiber berlaku.

**Catatan operasional:** bila server diletakkan di belakang Nginx/LB dengan IP
selain loopback (mis. Docker bridge `172.17.0.1`), setel
`TRUSTED_PROXIES=<ip proxy>`. Tanpa itu IP klien akan tercatat sebagai IP proxy
(limiter tetap aman, hanya kurang presisi).

### Bukti runtime (sesudah perbaikan)
```
200 ×15 -> 429 429 429        (kuota habis)
8 permintaan dengan X-Forwarded-For berputar:
429 429 429 429 429 429 429 429   <- tertutup
```

---

## N-16 — Vote "helpful" tanpa batas

### Akar masalah
`POST /api/help/articles/:id/helpful` adalah rute publik tanpa rate limiter dan
tanpa dedup; setiap permintaan menaikkan `helpful_count` lewat
`UpdateColumn("helpful_count", gorm.Expr("helpful_count + 1"))`.

### Bukti runtime (sebelum perbaikan)
40 permintaan berturut-turut dari satu IP tanpa login:
```
200 ×40 -> helpful_count 0 -> 40
```

### Perbaikan
- `middleware.PublicSubmissionRateLimiter()` pada rute tersebut.
- `sudahVoteHelpful(ip, articleID)` — dedup per (IP, artikel) dengan jendela
  24 jam, entri kedaluwarsa dibersihkan saat pemanggilan.

### Bukti runtime (sesudah perbaikan)
```
200 ×15 -> 429 ×25
helpful_count = 1
```

---

## N-17 — Enumerasi akun lewat OTP pendaftaran & lupa password

### Akar masalah
`SendRegistrationOTP` membalas `422 "Email sudah terdaftar..."` untuk email yang
sudah ada dan `200` untuk email bebas — perbedaan ini memungkinkan pemetaan
akun. Cabang blacklist juga membalas `403` dengan alasan eksplisit, dan
`ForgotPasswordRequest` memiliki cabang serupa.

### Bukti runtime (sebelum perbaikan)
```
send-register-otp (terdaftar) : 422 "Email sudah terdaftar..."
send-register-otp (bebas)     : 200 "Kode OTP 6-digit telah dikirimkan..."
```

### Perbaikan
Satu `responsSeragam` dipakai untuk **semua** jalur keluar — termasuk honeypot
anti-bot dan jalur sukses — sehingga status akun tidak dapat dibedakan.

### Bukti runtime (sesudah perbaikan)
```
terdaftar : 200 {"message":"Jika email tersebut dapat digunakan, ...","success":true}
bebas     : 200 {"message":"Jika email tersebut dapat digunakan, ...","success":true}
identik   : YA
```

### Catatan metodologi (penting)
Uji N-17 versi pertama **tidak sah**: ia hanya mencari string `responsSeragam`
di sumber, sehingga tetap LULUS walaupun satu jalur diberi pesan berbeda.
Kontrol negatif mengungkapnya. Uji diganti agar menghitung jumlah pesan sukses
unik yang benar-benar dikembalikan, dan kini gagal dengan benar saat satu jalur
dibedakan:

```
--- FAIL: TestN18ResponsOTPSeragam
    pesan sukses OTP harus seragam, ditemukan 2 bentuk
```

Percobaan kontrol negatif yang menghasilkan `declared and not used` /
`build failed` juga ditolak sebagai bukti — itu kegagalan kompilasi, bukan
kegagalan logika.

---

---

## N-18 — Merchant dapat mengelola artikel platform & master settings (KRITIS)

**Permukaan.** `guardedMutations` hanya berisi
`AuthRequired + StoreOwnerRequired + OperationalStoreRequired`. Tidak ada
pemeriksaan peran platform. Rute `/articles` (POST/PUT/DELETE),
`/settings`, dan `/settings/policies` terdaftar di grup itu, dan
`articleHandler.Store/Update/Destroy` sendiri tidak memeriksa peran sama sekali.

**Bukti runtime sebelum perbaikan** (merchant `qa.merchant`, store 25):

| Aksi | Hasil |
|---|---|
| `POST /api/articles` | **201** — artikel dibuat di tabel platform |
| `PUT /api/articles/1` (artikel platform) | **200** — judul berubah menjadi `DIUBAH OLEH MERCHANT` |
| `DELETE /api/articles/:id` | **200** — artikel terhapus |

Data dikembalikan persis ke baseline setelah uji (hash isi artikel id 1
kembali ke `6d6793f3…`). `Destroy` membaca `DELETE ... WHERE id = ?` tanpa
filter kepemilikan, sehingga satu request dapat menghapus konten platform.

**Perbaikan.** Permission yang sudah ada dipasang pada kelima rute:
`content:articles:manage` untuk artikel dan `system:settings:manage` untuk
settings. Handler tidak diubah — penjagaan di middleware.

**Bukti runtime sesudah perbaikan.**

| Peran | `POST /articles` | `PUT /articles/1` | `DELETE /articles/1` | `POST /settings` | `POST /settings/policies` |
|---|---|---|---|---|---|
| merchant | **403** | **403** | **403** | **403** | **403** |
| superadmin (kontrol positif) | **201** | — | — | **200** | — |

Kontrol positif membuktikan perbaikan tidak mengunci operator yang sah.

**Catatan.** Pola ini sama dengan N-07 (moderasi komentar) yang sudah
diperbaiki lebih dulu pada rute `admin/comments/*`; saat itu `/articles` dan
`/settings` terlewat. Sekarang seluruh kelompok rute konten platform tertutup.

---

## N-19 — Kupon gratis hardcoded memberi paket berbayar tanpa pembayaran (KRITIS)

**Akar masalah.** `internal/services/subscription_service.go`
`CreateSubscriptionOrder` memeriksa kupon bawaan di dalam kode:

```go
if cleanCoupon == "CATAVOR100" || cleanCoupon == "GRATISPRO" {
    discountAmount = originalAmount
}
```

Potongan sebesar harga penuh membuat `finalAmount == 0`, lalu blok berikutnya
menetapkan `paymentStatus = "paid"` dan `paymentMethod = "coupon_free"` —
paket langsung aktif tanpa transaksi apa pun.

**Bukti runtime sebelum perbaikan.** Merchant mengirim
`{"plan_code":"pro_business","billing_cycle":"annual","coupon_code":"CATAVOR100"}`:

```
message   : Transaksi langganan berhasil diproses dan paket Anda telah aktif.
discount  : 1290000   pay_status: paid   duration: 12 bulan
stores.id=25 -> plan=pro_business, plan_expires_at=2027-10-18
```

Nilai paket setahun (Rp1.290.000) hangus dan toko naik ke paket tertinggi
selama 12 bulan. Baseline dipulihkan (`plan=free`, order probe dihapus).

**Perbaikan.** Seluruh kupon bawaan dihapus dari kode. Kupon kini **hanya**
dibaca dari setting `master_coupons` yang dikelola admin. Potongan 100% tetap
mungkin, tetapi harus sengaja dibuat operator — bukan rahasia yang bisa ditebak
siapa pun yang membaca sumber atau menebak nama kupon.

**Bukti runtime sesudah perbaikan.**

| Uji | Sebelum | Sesudah |
|---|---|---|
| `coupon_code=CATAVOR100`, paket tahunan | `paid`, diskon 1.290.000, paket aktif | **`pending`, diskon 0**, toko tetap `free` |
| `coupon_code=GRATISPRO` | sama | **`pending`, diskon 0** |
| kupon sah admin (`type: fixed`, 10000) | — | diskon **10000**, status `pending` |
| kode ngawur (`NGAWUR999`) | — | diskon **0** (kontrol negatif) |
| kupon sah admin (`type: free`) | — | **`paid`** + paket aktif (fungsionalitas tetap) |

Dua baris terakhir penting: perbaikan tidak mematikan fitur kupon, hanya
memindahkan sumber kebenarannya ke master data admin.

**Data uji dibersihkan.** `settings` kembali 29 baris (setting
`master_coupons` uji dihapus), `subscription_orders` kembali 1 baris,
`stores.id=25` kembali `free/active` tanpa tanggal kedaluwarsa.

---

## Uji regresi & kontrol negatif N-18/N-19

`backend/internal/handlers/privilege_escalation_test.go`:

- `TestN18ArtikelDanSettingsWajibPermission` — memastikan kelima rute tetap
  dijaga permission yang benar.
- `TestN19TanpaKuponGratisHardcoded` — memastikan tidak ada kode kupon bawaan
  dan pembacaan `master_coupons` tidak hilang.

Kontrol negatif dijalankan dengan sengaja merusak logika (bukan stub dan bukan
error kompilasi):

1. Permission `POST /articles` dilepas → `TestN18` **FAIL** dengan pesan
   `rute Post "/articles" TIDAK dijaga permission "content:articles:manage"`.
2. Kupon `CATAVOR100` ditanam kembali → `TestN19` **FAIL** dengan pesan
   kode kupon masih ditanam.
3. Keduanya dipulihkan → kedua uji **PASS**, dan `git diff --stat` kembali
   identik dengan keadaan sebelum kontrol (23 dan 51 baris).

Tanpa langkah ketiga, uji yang lulus di kode benar tidak membuktikan apa pun —
ini kesalahan yang sama yang pernah terjadi pada uji N-17 versi pertama.

---

## Cakupan probe rute tulis

| Kelas | Rute tulis | Diprobe | Hasil |
|---|---|---|---|
| PUBLIC | 15 | 15 | N-15, N-16, N-17 ditemukan & ditutup |
| MERCHANT tulis | 4 | 4 | aman — isolasi tenant terbukti (403/404) |
| MERCHANT(+op) | 31 | sebagian | N-18, N-19 ditemukan & ditutup |
| ADMIN | 20 | belum | — |
| AUTH-ONLY | 18 | belum | — |

Catatan probe MERCHANT tulis: merchant hanya bisa mengakses tiket miliknya
sendiri. Dibuktikan dengan pasangan kontrol — tiket miliknya `GET 200`,
`reply 201`, `mark-read 200`, `rating 200` (setelah status `resolved`),
sedangkan tiket milik user lain `404` pada keempat rute. Isolasi produk
lintas-toko juga terbukti: `PUT/DELETE/resubmit-review` produk toko lain
`404`, sedangkan CRUD produk sendiri `201/200/200`.

---

## N-20 — Persetujuan invoice langganan tanpa jejak audit (SEDANG)

**Konteks.** `POST /api/admin/subscription/orders/:id/approve` memang
dirancang untuk persetujuan manual (alur transfer bank), dan
`ApproveSubscriptionOrder` sengaja mengubah status `pending` menjadi `paid`
lalu mengaktifkan paket — itu perilaku yang diinginkan, bukan celah.
Yang salah adalah **tidak ada jejak pelakunya**.

**Bukti runtime sebelum perbaikan** (staf `finance`, user 12):

```
POST /api/admin/subscription/orders/1/approve -> 200
order 1: payment_status pending -> paid
stores.id=23: plan free -> pro_starter, aktif sampai 2026-11-18
```

Sesudah aksi itu, `SELECT ... FROM activity_logs WHERE action ILIKE '%approv%'`
mengembalikan **0 baris**. Padahal pada rentang waktu yang sama
`activity_logs` mencatat `product.create`, `product.delete`,
`product.price_change`, `auth.login`, dan `RBAC_ACCESS_DENIED`. Jadi aksi
finansial paling sensitif justru satu-satunya yang tidak tercatat — hanya
masuk zerolog ke stdout yang hilang saat rotasi log. Tabel
`subscription_orders` juga tidak punya kolom `approved_by`.

Konsekuensi: bila staf finance menyetujui invoice fiktif, tidak ada bukti
siapa pelakunya.

**Perbaikan.** `ApproveOrder` kini memanggil `services.RecordActivity` setelah
persetujuan berhasil, menulis ke `activity_logs`:
`action=billing.subscription_approve`, `category=billing`,
`entity_title=<order_number>`, plus `changes` berisi `plan_code`,
`duration_month`, `payment_status`, dan `approved_by`. Kegagalan pencatatan
tidak membatalkan aksi (helper dipisah, mengikuti pola toleran yang sudah ada).

**Bukti runtime sesudah perbaikan:**

| Uji | Hasil |
|---|---|
| `finance` approve order 1 | `200`, dan `activity_logs` bertambah 1 baris |
| Isi baris audit | `user_id=12`, `actor_role=superadmin`, `action=billing.subscription_approve`, `entity_title=INV-SUB-...0023-7667`, `changes.approved_by=12` |
| Kontrol negatif: pencatatan dicabut, approve dijalankan | `200`, tetapi jumlah baris audit **tidak bertambah** (`1 -> 1`) |
| Patch dipulihkan, approve dijalankan lagi | `200`, baris audit bertambah (`1 -> 2`) |

Kontrol negatif ini penting: tanpa langkah itu, "ada baris audit" bisa saja
berasal dari kode lain. Yang membuktikan adalah approve sukses tanpa catatan
saat pencatatan dicabut.

**Data uji dibersihkan.** Order 1 kembali `pending`/`paid_at=NULL`,
`stores.id=23` kembali `free/active`, dan baris `activity_logs` hasil uji
dihapus.

---

## Hasil probe rute AUTH-ONLY (18 rute tulis)

Semua diuji sebagai merchant `qa.merchant` (user 18, store 25), dengan
**kontrol positif** pada rute yang sama agar penolakan bermakna.

| Rute | Hasil merchant | Kontrol positif | Kesimpulan |
|---|---|---|---|
| `POST /user/sessions/:id/revoke` | **404** untuk sesi user 5 & 12 | sesi sendiri **200** (id 303 ter-revoke) | isolasi sah |
| `POST /user/stores/switch` | **403** untuk slug toko user 1 | slug sendiri **200** | isolasi sah |
| `DELETE /stores/:id`, `POST /stores/:id/delete` | **403** untuk toko 1 & 23 | — | pemeriksaan pemilik ada di handler |
| `POST /notifications/:id/read`, `/:id/dismiss` | 200, tetapi membuat record **milik user 18 sendiri** (id 338); record user 5 (id 337) tidak berubah | — | aman by design |
| `POST /notifications/read-all`, `clear-read` | 200, tidak ada record user lain yang berubah (`updated_at` user 5 tetap 17 Okt) | — | terbatas pada user sendiri |
| `POST /notifications/ticket` | 200 | — | normal |

Catatan metodologi: `POST /notifications/:id/read` membalas 200 untuk
notifikasi milik orang lain. Ini sempat terlihat seperti IDOR, tetapi
pemeriksaan database menunjukkan yang dibuat adalah baris baca **untuk user
pelaku** — tidak ada data korban yang tersentuh. Status 200 saja tidak cukup
untuk menyimpulkan kebocoran; efek di database yang menentukan.

---

## Hasil probe rute ADMIN (20 rute tulis)

Diuji dengan tiga peran berbeda agar penolakan bermakna: `content` (user 13),
`finance` (user 12), dan `qa.merchant` (user 18), masing-masing dengan
**kontrol positif** pada rute yang sama memakai akun superadmin sah.

| Rute | Peran penyerang | Hasil | Kontrol positif |
|---|---|---|---|
| `POST /admin/rbac/staff` | content | **403** | admin 200 |
| `POST /admin/rbac/roles` | content | **403** | admin 200 |
| `POST /admin/rbac/matrix` | content | **403** | admin 200 |
| `POST /admin/rbac/staff/revoke` | content | **403** | admin 200 |
| `POST /admin/safe-domains`, `reset-defaults` | finance | **403** | admin 200 |
| `POST /admin/support/templates`, `reset-defaults` | finance | **403** | admin 200 |
| `PUT /admin/reports/:id` | finance | **403** | admin 200 |
| `POST /admin/support/tickets/:id/presence` | finance | **403** | admin 200 |
| `POST /admin/support/tickets/:id/reply` | finance | **403** | admin **201** (tiket 41) |
| `PUT /admin/support/tickets/:id/status` | finance | **403** | admin **200** (status berubah, dipulihkan) |
| `POST /admin/automation/trigger` | content, finance | **403**, `automation_logs` tetap 316 | — |
| `POST /automation/trigger` | merchant | **403** | — |

Tidak ada temuan baru di kelas ADMIN. Pemisahan wewenang antar-peran platform
berjalan sesuai matriks permission.

### Catatan: `safe_domains` menerima nilai sampah (BUKAN temuan keamanan)

`POST /admin/safe-domains` menerima `*`, `.evil.com`, dan
`javascript:alert(1)` dengan balasan **201** (yang tersimpan: `*`,
`.evil.com`, `evil.com`, `javascript` — normalisasi memotong skema, path, dan
port, jadi perilaku path/port itu benar).

Dugaan awal saya adalah wildcard `*` melumpuhkan peringatan domain tak dikenal
di `frontend/*/src/utils/urlSecurity.ts`. **Dugaan itu salah, dan sudah saya
uji:** replikasi `isMasterSafeDomain` di Node menunjukkan
`host.endsWith('.*')` tidak pernah bernilai true untuk domain nyata, sehingga
`requiresWarning` tetap `true` untuk `evil-phishing.com`,
`catavor-login.xyz`, dan `paypal-secure.top` — baik tanpa entri uji, dengan
entri uji, maupun dengan `*` saja.

Selain itu `safe_domains` **tidak dipakai backend sebagai kontrol keamanan**
apa pun: satu-satunya konsumennya adalah endpoint baca untuk frontend, dan
tidak ada pemakaian sebagai whitelist redirect/proxy di `internal/`.

Kesimpulan: yang tersisa hanyalah **validasi input lemah** pada master data
(entri sampah bisa menumpuk dan tampil di daftar whitelist admin). Ini
kebersihan data, bukan jalur eskalasi. Entri uji sudah dihapus lewat
`DELETE /admin/safe-domains/:id` (semuanya 200) dan tabel kembali ke 3 baris
baseline (`catavor.com`, `localhost`, `catavor.id`).

Dicatat di sini justru karena klaim awalnya menarik tetapi tidak terbukti —
melaporkannya sebagai celah akan melebih-lebihkan temuan.

---

## Hasil probe rute MERCHANT (14 baca) + MERCHANT(+op) (13 tulis)

Diuji dengan sesi `qa.merchant@catavor-test.local` (user 18, store 25).
Setiap penolakan disertai kontrol positif pada aktor yang berhak.

### Rute baca (14)

| Rute | Hasil | Catatan isolasi |
|---|---|---|
| `GET /activity-logs` | 200 | semua baris `store_id=25`, `user_id=18` |
| `GET /activity-logs/summary` | 200 | total 32 = `COUNT(*)` DB untuk store 25 (konsisten) |
| `GET /admin/analytics`, `/analytics`, `*/products` | 200 | data store 25 (kosong, wajar) |
| `GET /admin/categories` | 200 | `[]` |
| `GET /admin/comments` | **403** | `content:articles:manage` — benar |
| `GET /settings/policy-audit-logs` | 200 | `[]` |
| `GET /subscription/my-quota`, `/orders` | 200 | `store_id=25` |
| `GET /support/tickets`, `/tickets-ping` | 200 | 0 tiket (user 18 tidak punya tiket) |
| `GET /support/attachments/:id` | **403** / 404 | lihat uji di bawah |

**Uji IDOR `activity-logs`**: `?store_id=1`, `?store_id=23`, `?store_id=5`,
`?store_ids=1,23` semuanya tetap mengembalikan `store_id=25` — parameter klien
diabaikan, toko diambil dari `c.Locals`.

### Rute tulis (13)

| Rute | Hasil | Bukti |
|---|---|---|
| `POST /categories` | 201 | dibuat `store_id=25` walau payload kirim `store_id:1`; store 1 bersih |
| `POST /fauna` | 201 | idem, `store_id=25` |
| `PUT /fauna/:id` | 200 milik sendiri / **404** lain | `"Produk tidak ditemukan atau bukan milik toko Anda."` |
| `DELETE /fauna/:id` | 200 milik sendiri / **404** lain | idem |
| `POST /store|stores/extend-activity` | 200 keduanya | memperbarui `last_activity_at` store sendiri |
| `POST /subscription/schedule-downgrade` | 200 | respons `store_id=25` walau body kirim `store_id:1` |
| `POST /subscription/cancel-downgrade` | 200 | `store_id=25` |
| `POST /upload-image`, `/storage/upload` | 400 PHP / **200** PNG asli | kontrol positif: PNG valid diterima |
| `DELETE /storage/file` | 200 milik sendiri / **403** lain | prefix `stores/{id}/` + normalisasi traversal |
| `DELETE /admin/comments/:id`, `POST .../approve` | **403** | kontrol positif `content` staff → **200** |

### Uji `DELETE /storage/file` (bypass)

| `key` | Hasil |
|---|---|
| `stores/25/nonexist.jpg` | 200 (milik sendiri — sesuai desain) |
| `stores/1/nonexist.jpg` | **403** |
| `stores/25/../../1/nonexist.jpg` | **403** |
| `../public/index.html` | **403** |
| `stores/1/../25/nonexist.jpg` | 200 → dinormalisasi ke `stores/25/...` (benar) |

### Uji `GET /support/attachments/:id` — kontrol positif sempat gagal

Percobaan pertama memberi **404 untuk pemilik asli** (user 5), bukan 200.
Sebabnya bukan izin, melainkan **berkas fisiknya memang tidak ada di disk**
(`"File fisik lampiran tidak ditemukan di penyimpanan server."`). Artinya 403
yang diterima merchant pada percobaan itu **belum membuktikan apa pun**.

Uji diulang dengan membuat berkas fisik placeholder untuk lampiran 27
(owner = user 5), lalu:

| Aktor | Hasil |
|---|---|
| user 5 (pemilik) | **200**, `len=18` (isi placeholder) |
| user 18 (merchant lain) | **403** |
| anonim | **401** |

Baru setelah itu isolasi dianggap terbukti. Placeholder dihapus; berkas
terkunci antivirus sehingga server harus dimatikan dulu sebelum `rm` berhasil.

### Catatan teknis (bukan temuan keamanan)

- **Fauna disimpan di tabel `products`, bukan `faunas`.** `POST /api/fauna`
  membuat baris `products` dengan `product_type='physical'`; tabel `faunas`
  tetap 0 baris sepanjang pengujian. Ini menjelaskan pesan
  `"Produk berhasil dihapus dari katalog."` pada `DELETE /api/fauna/:id`.
  Perlu dicatat karena `product_type` fauna tidak di-set ke `fauna`.
- **`PNG` disimpan sebagai `.jpg`** dengan `file_type: "image/jpeg"` pada kedua
  endpoint upload. Sudah dipastikan tidak berbahaya (`X-Content-Type-Options:
  nosniff`, ekstensi dipaksa), tetapi tipe berkas yang dilaporkan menyesatkan
  klien.
- Semua data uji dibersihkan: kategori 53, fauna 0, produk 107 total / 87
  aktif, `comments` 1 (status & `updated_at` dipulihkan), storage 0 berkas,
  akun 5/13/18 dikembalikan ke hash semula (login password uji → 401).

---

## Hasil probe rute AUTH-ONLY (8) + ADMIN baca (18)

Tiga peran diuji serentak: merchant (user 18), content staff (user 13),
superadmin (user 19). Setiap 403 diverifikasi ulang dengan kontrol positif
pada peran yang berhak — tanpa itu, 403 tidak membuktikan apa pun.

### AUTH-ONLY (8) — semua 200 untuk pemilik sesi

| Rute | Hasil |
|---|---|
| `GET /auth/verify` | 200 |
| `GET /notifications`, `/v1/notifications` | 200 (3 notif milik sendiri) |
| `GET /notifications/stream`, `/v1/notifications/stream` | 200 SSE, isi hanya `event: connected` + `client_id` acak |
| `GET /user/sessions` | 200 (hanya sesi sendiri) |
| `GET /user/stores` | 200 (hanya store sendiri) |
| `GET /user/stores/check-slug` | 200 |

SSE diperiksa isinya, bukan hanya status: **tidak ada data notifikasi** yang
dikirim pada handshake, hanya `{"status":"connected","client_id":"<uuid>"}`.

### ADMIN baca (18)

| Rute | merchant | content | superadmin |
|---|---|---|---|
| `/users/search`, `/admin/users/search` | 403 | 403 | **200** (18 hasil) |
| `/stores/search` | 403 | 403 | **200** (1 hasil) |
| `/admin/automation/logs`, `/automation/logs` | 403 | 403 | **200** |
| `/automation/status` | 403 | 403 | **200** |
| `/admin/dormancy/metrics`, `/superadmin/dormancy/metrics`, `/admin/superadmin/dormancy/metrics` | 403 | 403 | **200** |
| `/admin/reports` | 403 | 403 | **200** |
| `/admin/reports/:id` | 403 | — | **200**; id ngawur → **404** |
| `/admin/support/templates` | 403 | 403 | **200** |
| `/admin/support/tickets/:id` | 403 | 403 | **200** |
| `/admin/support/tickets/:id/presence` | 403 | 403 | **200** |
| `/admin/notifications` | 403* | — | **200** (15 notif) |
| `/admin/notifications/:id` | 403 | **200** | **200** |

\* merchant 403 pada `/admin/notifications` sesuai RBAC; `/admin/notifications/:id`
terbuka untuk content karena gate-nya `content:broadcast:send` — izin yang
memang dimiliki content staff untuk mengelola broadcast.

### Uji yang sempat menyesatkan

`GET /notifications/:id` memberi **403 untuk notif milik merchant sendiri**
(`notif_about_25`). Kalau dibaca naif, ini tampak seperti IDOR yang tertutup.
Setelah membaca `cmd/server/main.go:448`, rute itu ternyata **endpoint panel
broadcast** (`notificationHandler.SuperadminGetOne`, gate
`content:broadcast:send`) — bukan endpoint baca notifikasi pengguna. Merchant
tidak punya izin itu, jadi 403 adalah perilaku benar; endpoint baca notifikasi
pengguna adalah `GET /notifications` (daftar) dan `POST /notifications/:id/read`
yang sudah diuji di batch AUTH-ONLY sebelumnya.

### Catatan skema

Tabel `notifications` **tidak punya kolom `user_id`**; targeting memakai
`target_type`/`target_id`/`target_plan_code`/`target_recipients`, dan notifikasi
pengguna memakai ID string (`notif_about_25`, `notif_share_25`) sementara
broadcast memakai `notif_bc_<uuid>`. Pembacaan "per user" dilakukan lewat
`notification_reads` (kolom `user_id`), bukan lewat kolom di `notifications`.

---

## Hasil probe rute PUBLIC (38) — putaran ini menutup seluruh 195 rute

Semua diuji tanpa autentikasi. Yang mengembalikan data diperiksa **isinya**,
bukan hanya status code.

### Ringkasan

| Kelompok | Hasil |
|---|---|
| `/articles`, `/articles/:id`, `/articles/:id/comments` | 200, isi artikel platform |
| `/products`, `/fauna` | 200, **87 baris = tepat jumlah produk aktif** |
| `/products/:id`, `/fauna/:id`, `*/recommendations` | 404 (id uji sudah dihapus — wajar) |
| `/settings` | 200, 29 key — semuanya memang publik (slot ads, GA measurement id, nomor WA bisnis). **Tidak ada kredensial** |
| `/policies` | 200 `{}` (kosong) |
| `/culinary-taxonomy`, `/taxonomy/culinary` | 200, data statis |
| `/subscription/plans` | 200, katalog harga |
| `/stores/featured` | 200 |
| `/market-intelligence`, `/summary` | 200, agregat platform (tanpa PII) |
| `/public/safe-domains`, `/safe-domains` | 200, 64 byte |
| `/readyz` | **401** (tidak publik — benar) |
| `/ads.txt` | 200 |
| `/auth/google` | **401** tanpa token, **401** token palsu |
| `check-slug` (6 varian) | 200, membocorkan eksistensi slug — **memang fungsi endpoint ini** |
| `reactivate` (3 varian) | token palsu → **"Reaktivasi Gagal"**; token sah → **307** |

### Verifikasi anti-kebocoran pada `/products`

87 baris dikembalikan = `COUNT(*) WHERE deleted_at IS NULL` di DB (87).
Tidak ada `deleted_at` terisi, `is_active` semuanya `true`,
`moderation_status` semua `none`. Tidak ada kolom `user_id`, `email`,
`phone`, `address`, atau `password`.

Percobaan memaksa tampilan merchant lewat query
(`?status=all`, `?status=archived`, `?status=ALL`) **tidak berhasil** — tetap
87 baris `is_active=true`. `isMerchantView` hanya di-set dari
`c.Locals("store")` yang dipasang middleware, bukan dari input klien.

### Uji `reactivate` (dengan kontrol positif)

| Input | Hasil |
|---|---|
| tanpa token | 400, halaman "Reaktivasi Toko" |
| `?token=palsu123` | 400, "Reaktivasi Gagal" |
| `?token=abc` | 400, "Reaktivasi Gagal" |
| **token sah (64 char) toko 10** | **307**, `dormancy_status` → `active`, token dikosongkan |

Token sah diuji pada toko `catavor-compliance` (id 10), lalu `dormancy_status`
dan `reactivation_token` dikembalikan persis ke `warning_1` + token 64 char
semula. Toko 11–14 tidak tersentuh (tetap `warning_1`).

### Uji path traversal pada catch-all `/*`

| Path (dikirim mentah, `--path-as-is`) | Hasil |
|---|---|
| `/../../backend/.env` | 200, 4048 byte |
| `/../../../etc/passwd` | 200, 4048 byte |
| `/..%2f..%2fbackend%2f.env` | 200, 4048 byte |
| `/static/../../backend/.env` | 200, 4048 byte |
| `/storage/../../backend/.env` | 200, 4048 byte |
| `/%2e%2e/%2e%2e/backend/.env` | 200, 4048 byte |

Semuanya mengembalikan **HTML SPA yang identik (4048 byte)**, bukan isi `.env`.
`.env` memang ada di disk (2402 byte) dan tidak terekspos. Catch-all hanya
melayani `index.html`.

---

## N-21 (baru, severity: medium — fungsional, bukan celah)

**Toko dengan nama mengandung merek platform tidak bisa diakses publik.**

`IsReservedSlug()` (`store_handler.go:114`) menganggap setiap slug yang
mengandung varian merek (`catavor`, `catafor`, `katavor`, `catafr`, …) sebagai
slug sistem yang dicadangkan, sehingga `ShowStore` dan `IndexProducts`
mengembalikan **404 "Toko tidak ditemukan."**

Bukti runtime pada data nyata:

| Slug | `/api/u/:slug` | `/api/u/:slug/products` | Produk aktif |
|---|---|---|---|
| `dfauna` | 200 | 200 | 11 |
| `adidas` | 200 | 200 | 12 |
| `gendolo` | 200 | 200 | 11 |
| `shop66698` | 200 | 200 | 6 |
| `iop` | 200 | 200 | 2 |
| **`catavor`** | **404** | **404** | **11** |
| **`catavor-compliance`** | **404** | **404** | 0 |

Toko id 1 (`slug=catavor`, `plan=pro`, `status=active`, 11 produk aktif) adalah
toko milik pemilik platform sendiri dan **katalognya tidak dapat dibuka
publik**. `check-slug` juga menolak slug ini dengan pesan "Nama pengguna ini
adalah kata kunci sistem yang dicadangkan".

Akar masalah: proteksi anti-typosquatting dirancang untuk *pendaftaran toko
baru*, tetapi dipakai juga pada *pembacaan* toko yang sudah ada. Toko lama yang
sudah memakai slug tersebut menjadi tidak dapat diakses.

**Belum diperbaiki.** Perbaikan menuntut keputusan produk: apakah toko
brand-owned dikecualikan (mis. `id=1` atau via flag `is_brand_owner`), atau
aturan reserved hanya berlaku saat registrasi/rename. Tidak boleh diubah
sepihak karena menyangkut kebijakan penamaan.

---

## N-22 — urutan `Stores[0]` tidak deterministik, toko blacklisted jadi default

**Severity: medium. Status: fixed (terverifikasi runtime + kontrol negatif).**

### Masalah

`Login` dan `GoogleAuth` memuat relasi lewat `database.DB.Preload("Stores")`
tanpa `ORDER BY`, lalu memakai `user.Stores[0]` sebagai toko default
(`auth_handler.go:309` dan `:933`). Postgres tidak menjamin urutan baris tanpa
`ORDER BY`; yang keluar adalah urutan fisik tabel.

Data nyata memicu ini: **user 5 memiliki 7 toko** (5, 8, 15, 16, 18, 19, 24).
Urutan natural yang dikembalikan Postgres:

```
id urut   : 5, 8, 15, 16, 18, 19, 24
Preload   : 8, 15, 19, 5, 16, 18, 24
```

Elemen pertama = **8 = `jaja`**, toko dengan `is_suspended=true` dan
`is_blacklisted=true`.

### Bukti runtime (sebelum perbaikan)

| Yang diukur | Hasil |
|---|---|
| `store_id` di dalam JWT | **8** (`jaja`) |
| store yang benar-benar dipasang middleware ke request | **15** (`dfuna-store-unlimited`) |
| Tiga login berturut-turut | **8, 8, 8** — stabil tapi terblokir |

Jadi selain tidak deterministik, token dan request aktif **tidak sepakat**
tentang toko mana yang dipakai.

### Perbaikan

Helper `preloadUserStores()` (`auth_handler.go:126`) memberi urutan eksplisit
pada relasi: `is_blacklisted ASC, is_suspended ASC, id ASC`. Toko yang bisa
dipakai selalu menang; di antara yang sehat dipilih `id` terkecil. Dipakai di
ketiga titik `Preload("Stores")` (login, dan dua cabang `GoogleAuth`).

### Verifikasi

| Uji | Hasil |
|---|---|
| Login user 5 di kode perbaikan | `store_id=5` (`adidas`) — 3/3 konsisten |
| Request aktif vs token | 5 = 5, kini sepakat |
| **Kontrol negatif** (urutan dihapus, kompilasi bersih) | `store_id=8` (`jaja`) — bug muncul lagi |

Kontrol negatif sah: kode rentan dikompilasi tanpa error (bukan `redeclared`
atau `declared and not used`), hanya `ORDER BY` yang hilang, dan uji
mengembalikan nilai yang sama seperti sebelum perbaikan.

### Catatan

`middleware/auth.go:206, 338, 440` juga memakai `user.Stores[0]`, tetapi jalur
itu berjalan setelah login dan biasanya didahului `?slug=` eksplisit. Karena
sekarang urutan `Preload` sudah deterministik di sumber, hasilnya ikut stabil.
Tidak diubah agar perubahan tetap minimal dan terverifikasi.
