# Audit Putaran 4 — Pemisahan Bidang Otorisasi (Staf Platform vs Merchant)

Tanggal: 2026-10-18
Cakupan: routing & otorisasi jalur admin platform (`/api/admin/*`)
Sifat: read + perbaikan kode (bukan read-only); sudah diverifikasi runtime

---

## Latar belakang

Kebijakan yang diminta pemilik platform:

> Karyawan/staf platform **tidak punya toko**. Saat meng-hit endpoint super
> admin, toko **tidak boleh diwajibkan**. Email perusahaan menandai staf;
> staf boleh punya email pribadi dan membuka toko, tetapi peran karyawan dan
> peran merchant harus tetap dibedakan.

## Temuan

### N-23 (High) — Route admin terdaftar di grup merchant + duplikasi route

`backend/cmd/server/main.go` mendefinisikan tiga grup:

| Grup | Middleware | Peruntukan |
|---|---|---|
| `guarded` | `AuthRequired` + **`StoreOwnerRequired`** | merchant |
| `guardedMutations` | + `OperationalStoreRequired` | merchant (tulis) |
| `adminApi` (`/admin`) | `AuthRequired` + `RequireAdmin` — **tanpa cek toko** | staf platform |

`adminApi` **sudah benar**. Masalahnya: **28 route `/admin/*` terdaftar dua kali**
— sekali di `adminApi`, sekali di `guarded`. Fiber memakai handler yang
terdaftar lebih dulu, sehingga versi merchant yang menang:

- `/admin/notifications` (5 route)
- `/admin/users/search`, `/admin/stores/search` (+ alias tanpa prefix)
- `/admin/automation/*` (3)
- `/admin/audit-logs`, `/admin/superadmin/dormancy/metrics`
- `/admin/market-intelligence*` (2)
- `/admin/safe-domains*` (5)
- `/admin/support/tickets*` & `/admin/support/templates*` (11)

**Dampak:** superadmin/staf platform tanpa toko katalog tertolak
`403 "Toko Anda belum terdaftar."` walaupun Role sudah memegang izin. Ini juga
melanggar prinsip OWASP Multi-Tenant Security Cheat Sheet:

> make any cross-tenant administrative path **explicit, separately
> authorized, and auditable**

### N-24 (Medium) — Middleware tenant menyuntikkan store acak ke staf

`backend/internal/middleware/auth.go` (sebelum perbaikan):

```go
} else if isPlatformAdminUser {
    var defaultStore models.Store
    if err := database.DB.Where("LOWER(slug) = 'catavor'").First(&defaultStore).Error; err == nil {
        matchedStore = &defaultStore
    } else if err := database.DB.Order("id ASC").First(&defaultStore).Error; err == nil {
        matchedStore = &defaultStore
    }
}
```

Dua masalah:

1. **Hardcode slug `catavor`** — nama platform yang justru dilarang dipakai toko
   mana pun (lihat N-21).
2. **Fallback ke toko id terkecil** — staf memperoleh konteks tenant **sembarang
   yang bukan miliknya**. Query ber-scope `store_id` bisa membaca data tenant lain.

## Perbaikan

| Item | Tindakan |
|---|---|
| 28 route duplikat | Dihapus dari grup `guarded`; sumber kebenaran tunggal = `adminApi` |
| `/admin/comments*` (3 route) | **Dipindah** ke `adminApi` (tidak memakai `store_id` konteks) |
| `/admin/categories`, `/admin/analytics*` | **Dipertahankan** di grup merchant — memang memakai `store_id` konteks (dikonfirmasi komentar kode & uji runtime) |
| Hardcode `catavor` + fallback toko | Dihapus total |
| Staf tanpa toko | Diloloskan **tanpa konteks store** (`c.Next()`); handler yang butuh `store_id` tetap menolak sendiri |
| Merchant tanpa toko | Tetap `403 STORE_NOT_REGISTERED` |

Hasil: 4 rute `/admin/*` yang tersisa di grup merchant
(`categories`, `analytics`, `analytics/products`, `analytics/export`) — semuanya
memang ber-scope toko.

## Bukti runtime

Server dibangun ulang dan **diverifikasi PID-nya berganti** sebelum uji
(pelajaran: `taskkill //F` gagal diam-diam di MSYS; gunakan
`MSYS_NO_PATHCONV=1 taskkill /F /PID`).

Kontrol: DB `stores = 0` — akun benar-benar tanpa toko.

### A. Superadmin tanpa toko → jalur admin (16/16 = 200)

`/admin/users/search`, `/admin/stores/search`, `/admin/safe-domains`,
`/admin/automation/status`, `/admin/audit-logs`, `/admin/market-intelligence`,
`/admin/support/tickets`, `/admin/support/templates`, `/admin/notifications`,
`/admin/comments`, `/admin/rbac/me`, `/admin/rbac/matrix`, `/admin/rbac/staff`,
`/admin/settings`, `/admin/reports`, `/admin/dormancy/metrics`

### B. Pemisahan dua arah (13/13 PASS)

| Aktor | Jalur admin platform | Jalur merchant |
|---|---|---|
| Superadmin tanpa toko | 200 | 403 / 400 |
| Merchant dengan toko | 403 | 200 |

Merchant diuji pada `/auth/me`, `/products`, `/admin/analytics`,
`/admin/categories`, `/activity-logs` → semua **200** (tidak ada regresi).

### C. Autentikasi masih menegakkan

Tanpa token → **401** pada `/admin/users/search` dan `/admin/rbac/me`.

### D. Alias yang dihapus

`/api/users/search`, `/api/stores/search`, `/api/automation/status` → **404**.
Dipastikan tidak dipakai frontend: `PlatformRolePortal.tsx` (desktop & mobile)
hanya memanggil `/api/admin/*`.

## Catatan metodologi

Dua kegagalan uji di awal **bukan** karena kode salah, tetapi karena:

1. Pola `grep` penghapusan duplikat tidak menangkap
   `guarded.Get("/admin/support/...` → 11 route terlewat. Diperbaiki dengan
   menyapu seluruh `/admin` di grup merchant, bukan per pola.
2. **Proses lama masih memegang port 8000** karena `taskkill //F` tidak valid di
   shell ini. Seluruh uji pertama mengenai binary lama. Kini setiap uji
   memverifikasi PID listener berubah lebih dulu.

## Status

N-23, N-24: **fixed** dan terverifikasi runtime.
N-21 tetap `open` (temuan data — sudah tidak relevan karena DB di-wipe).

## Rekomendasi lanjutan (belum dikerjakan)

1. **Penanda staf berbasis penugasan, bukan email hardcode.** Saat ini masih ada
   sisa `user.Email == "admin@catavor.com"` di `auth.go` & `rbac.go`. Standar
   industri: staf ditandai lewat `platform_role` yang ditetapkan dinamis oleh
   superadmin (`POST /api/admin/rbac/staff`) — sudah tersedia. Sisa hardcode
   email sebaiknya dihapus.
2. **`AssignStaffRole` belum membedakan karyawan vs merchant.** Belum ada
   penanda/pemeriksaan saat penugasan. Perlu keputusan: apakah akun yang sudah
   punya toko boleh ditugaskan sebagai staf (kebijakan pemilik: **boleh**, karena
   staf ber-email pribadi boleh berjualan) — sehingga yang perlu ditegaskan
   adalah `platform_role` dan kepemilikan toko sebagai **dua dimensi independen**.
3. **Prefix matching untuk slug merek.** `IsReservedSlug` masih exact-match,
   sehingga `catavor-xyz` lolos saat registrasi.
