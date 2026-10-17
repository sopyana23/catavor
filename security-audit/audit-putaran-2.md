# Audit Keamanan Mendalam — Putaran Kedua

**Tanggal:** 2026-10-18
**Baseline:** `724c1a8` (12/12 temuan putaran pertama dinyatakan tertutup)
**Metode:** adversarial, dari nol. Setiap klaim diverifikasi terhadap source, database nyata, atau HTTP runtime — bukan judul commit atau laporan sebelumnya.
**Lingkungan:** `APP_ENV=local`, server dari binary `724c1a8`, DB `catavor` @ 127.0.0.1:5432

---

## Ringkasan Eksekutif

Putaran pertama menutup 12 temuan dengan benar (diverifikasi ulang). Namun audit adversarial ini menemukan **5 temuan baru**, termasuk **1 kritis** yang membuat seluruh model otentikasi dapat dilewati.

**Jangan push / deploy sebelum N-01 diperbaiki.**

| ID | Temuan | Severity | Status awal | Status akhir |
|----|--------|----------|-------------|--------------|
| N-01 | JWT secret default publik dipakai di `.env` + hardcoded di source & 3 file repo | **KRITIS** | Terbuka | **TERTUTUP** `5aafc62` |
| N-02 | `AuthRequired` menerima JWT via query `?token=` (regresi perbaikan SSE) | **TINGGI** | Terbuka, terbukti dinamis | **TERTUTUP** `2d69487` |
| N-03 | Path traversal pada `DELETE /api/storage/file` → hapus file lintas-tenant | **TINGGI** | Terbuka, terbukti dinamis | **TERTUTUP** `b4d9b19` |
| N-04 | `token_version` check bisa dilewati dengan `claims.TokenVersion = 0` | **SEDANG** | Terbuka | **TERTUTUP** `8128290` |
| N-05 | Service layer RBAC tanpa cek aktor (pertahanan tunggal di route) | **SEDANG** | Defense-in-depth | **TERTUTUP** `8128290` |
| N-06 | 20 rute platform hanya `AuthRequired` → merchant baca tulis area platform | **TINGGI** | Terbuka, terbukti dinamis | **TERTUTUP** `2d1e1a8` |

**Status: 6/6 temuan putaran kedua ditutup dan diverifikasi ulang.**

> N-06 ditemukan **setelah** N-01…N-05 ditutup, saat menguji login e2e memakai akun test merchant yang baru dibuat. Sebelumnya tidak terdeteksi karena belum ada akun merchant ber-role rendah untuk menguji jalur otorisasi.

---

## N-01 — KRITIS: JWT Secret Default yang Publik

### Bukti (statis, dari HEAD saat ini)

```
backend/internal/config/config.go:107
  jwtSecret := getEnv("JWT_SECRET", "<REDACTED-DEFAULT-SECRET>")

backend/internal/config/config.go:110
  const defaultJWTSecret = "<REDACTED-DEFAULT-SECRET>"

docs/deployment-hardening.md:24
  APP_ENV=production JWT_SECRET=<REDACTED-DEFAULT-SECRET> \
```

Nilai literal lengkap sengaja **tidak** ditulis di laporan ini agar tidak menambah kebocoran; lihat `config.go:107` dan `config.go:110`.

Secret yang **identik** juga muncul di `README.md` (commit `bc980db`), `backend/.env.example` (commit `f2a726f`), dan `backend-go/.env.example`.

### Fakta yang menentukan

```
backend/.env  JWT_SECRET  ==  default yang hardcoded di source  ==  nilai di repo publik
```

Diverifikasi langsung: `backend/.env` **memakai** secret default tersebut, bukan nilai acak.

### Dampak

Siapa pun yang pernah melihat repo (atau commit history) dapat membuat JWT valid untuk **akun apa pun**, termasuk `superadmin`. Guard `L4` di `config.go:111` hanya menolak start bila `APP_ENV` = production/staging — pada `local`/dev, dan pada deployment yang lupa set `APP_ENV`, secret publik ini aktif.

Catatan: guard L4 bekerja sebagaimana dirancang untuk production. Masalahnya adalah **nilai default itu sendiri bersifat publik dan dipakai di `.env`**, sehingga environment non-production (termasuk staging yang salah konfigurasi) sepenuhnya terbuka.

### Rekomendasi

1. Hapus default hardcoded; ganti dengan string kosong + `log.Fatal` bila kosong di **semua** environment kecuali local eksplisit.
2. Rotasi `JWT_SECRET` di `backend/.env` sekarang (nilai acak 32-byte hex).
3. Hapus nilai nyata dari `docs/deployment-hardening.md:24` → ganti `<openssl rand -hex 32>`.
4. Rotasi secret di semua deployment yang pernah memakai nilai ini.
5. Bersihkan git history (`git filter-repo`) sebelum push ke remote publik.

---

## N-02 — TINGGI: JWT Diterima Lewat Query String

### Bukti

```
backend/internal/middleware/auth.go:94-96   (ExtractOptionalClaims)
  if tokenString == "" { tokenString = strings.TrimSpace(c.Query("token")) }

backend/internal/middleware/auth.go:226-228  (AuthRequired)
  // Fallback to query parameter (dipertahankan untuk kompatibilitas klien lama)
  if tokenString == "" { tokenString = strings.TrimSpace(c.Query("token")) }
```

### Bukti dinamis

```
GET /api/auth/me?token=<JWT>        (tanpa cookie apa pun)  ->  200 OK
GET /api/auth/me                    (tanpa cookie)          ->  401
```

**Terbukti: JWT penuh diterima dari URL tanpa cookie.**

### Dampak

Token bocor melalui: URL di address bar & browser history, header `Referer` ke resource pihak ketiga, log reverse-proxy/CDN, tangkapan layar, dan share link. Ini **regresi** dari perbaikan SSE putaran pertama yang justru dirancang menghapus `?token=` dari URL (`1d8e77f`) — perbaikan itu hanya menyentuh SSE, bukan `AuthRequired`.

Terkait: `frontend/desktop/src/App.tsx:8199` masih membangun fallback URL unduhan dengan `?token=${authToken}`.

### Rekomendasi

1. Hapus cabang `c.Query("token")` di `AuthRequired` dan `ExtractOptionalClaims`; pertahankan hanya `Authorization: Bearer` + cookie httpOnly.
2. Untuk unduhan lampiran, pakai blob-download via header (sudah jadi jalur utama) dan **hapus fallback** `?token=` di `App.tsx:8199`.
3. Bila kompatibilitas klien lama diperlukan, gunakan tiket sekali-pakai (pola SSE yang sudah ada) — bukan JWT penuh.

---

## N-03 — TINGGI: Path Traversal pada Hapus File (IDOR Lintas-Tenant)

### Bukti kode

`storage_handler.go` memvalidasi prefix **sebelum** normalisasi:

```go
if !strings.HasPrefix(key, fmt.Sprintf("stores/%d/", storeID)) { -> 403 }
```

`key = "stores/5/../../2/products/victim.txt"` lolos prefix `stores/5/` dan setelah normalisasi menjadi `storage/2/products/victim.txt` — milik tenant lain.

### Bukti dinamis (HTTP nyata)

Login sebagai pemilik **store 5**, lalu:

```
DELETE /api/storage/file  {"key":"stores/5/products/own5.txt"}                  -> 200  (kontrol, sah)
DELETE /api/storage/file  {"key":"stores/5/../../2/products/victim.txt"}        -> 200  *** file store 2 TERHAPUS ***
DELETE /api/storage/file  {"key":"stores/5/../../../../outside-canary.txt"}     -> 403
```

Verifikasi filesystem: `victim.txt` (store 2) hilang, kanari di luar root tetap ada.

### Batas dampak

Traversal **terbatas di dalam** `StorageLocalRoot`. Escape ke luar storage (`../` keluar root) ditolak 403. Jadi dampaknya **penghapusan file lintas-tenant**, bukan eksekusi/RCE.

Catatan penting: `StorageLocalRoot` = `public/storage`, berada di dalam direktori web statis `/storage` — sehingga file yang dihapus/ditimpa juga dapat diakses via URL publik.

### Perbandingan

- **Upload**: AMAN. `objectKey` dibangun sepenuhnya di server (`uniqueID`, `ext` whitelist).
- **Read** (`resolveInsideRoot`): AMAN. Diuji 14 bentuk traversal (`../`, `..\`, absolut, `C:\`, symlink, URL-encoded) — invariant "hasil resolve selalu di dalam root" terbukti.
- **Delete**: RENTAN (temuan ini).

### Rekomendasi

Pakai `resolveInsideRoot` (sudah terbukti benar) pada jalur **delete**, atau normalisasi `key` dan validasi prefix **setelah** normalisasi.

---

## N-04 — SEDANG: Bypass `token_version` dengan Nilai 0

### Bukti

```
backend/internal/middleware/auth.go:286
  if user.TokenVersion > 0 && claims.TokenVersion > 0 && claims.TokenVersion < user.TokenVersion { -> 401 }
```

Token dengan `token_version` = 0 (atau field dihilangkan) **lolos** pemeriksaan ini. Penyerang yang dapat memalsukan JWT (lihat N-01) cukup mengosongkan field untuk melewati mekanisme pencabutan sesi.

### Rekomendasi

Perlakukan klaim yang hilang/0 sebagai tidak valid:
```go
if claims.TokenVersion == 0 || claims.TokenVersion < user.TokenVersion { -> 401 }
```

---

## N-05 — SEDANG: Service Layer RBAC Tanpa Cek Aktor

### Bukti

`backend/internal/services/rbac_service.go`: `AssignStaffRole`, `RevokeStaffRole`, dan `UpdateRolePermissions` **tidak menerima/memeriksa role aktor sama sekali**. Otorisasi sepenuhnya bergantung pada `RequirePermission` di route.

Audit pemanggil: hanya 4 pemanggil, semuanya handler yang berada di grup ber-`RequirePermission`. **Tidak dapat dieksploitasi saat ini.** Namun bila kelak ada route/service baru yang memanggil fungsi ini tanpa guard, eskalasi hak akses langsung terbuka.

Terkait: `middleware.RequireAdmin` hanya menolak `""` dan `"merchant"` — string role lain lolos. Tidak bisa dieksploitasi (role dimuat dari DB, tidak dapat dipalsukan klien), tapi bukan gate defense-in-depth yang andal.

### Rekomendasi

Tambahkan cek aktor di service layer (pertahanan berlapis), dan ubah `RequireAdmin` menjadi whitelist eksplisit role yang diizinkan.

---

## N-06 — TINGGI: 20 Rute Platform Hanya Memakai `AuthRequired`

Ditemukan pada 2026-10-18 saat menguji login e2e dengan akun test `merchant`.
Ini kelas bug yang **tidak bisa terdeteksi** oleh audit statis N-01…N-05 karena
membutuhkan sesi sah ber-role rendah untuk membuktikannya.

### Akar masalah

`main.go` punya dua grup berbeda tingkat keamanan:

- `adminApi := api.Group("/admin", AuthRequired, RequireAdmin)` — benar, ber-RBAC.
- `guarded := api.Group("", AuthRequired)` — **hanya** mewajibkan login.

Sejumlah rute ber-prefix `/admin/` (dan beberapa alias tanpa prefix) didaftarkan
di `guarded`, sehingga izin tidak pernah diperiksa.

### Bukti dinamis (akun `role=merchant`, sebelum perbaikan)

| Permintaan | Hasil | Dampak |
|---|---|---|
| `GET /api/admin/support/tickets` | **200** | membaca 20 tiket **semua tenant** |
| `GET /api/admin/support/templates` | **200** | membaca canned response platform |
| `POST /api/admin/support/templates` | **201** | **membuat** template platform (id 16, sudah dihapus) |
| `GET /api/admin/users/search` | **200** | email + `platform_role` seluruh staf |
| `GET /api/admin/stores/search` | **200** | email pemilik toko lain |
| `GET /api/admin/market-intelligence` | **200** | data agregat platform |
| `GET /api/admin/audit-logs`, `/safe-domains`, `/automation/logs` | **200** | log & konfigurasi platform |

Catatan penting: CSRF **bukan** penghalang di sini. Dengan header `Origin` yang
sah (mis. `http://localhost:8000`), `POST` yang sama langsung diterima `201`.
CSRF melindungi dari situs pihak ketiga, bukan dari pengguna yang sudah login.

### Perbaikan

20 rute dikunci dengan `RequirePermission` sesuai izin masing-masing:
`support:tickets:read`, `support:tickets:reply`, `system:admins:manage`,
`content:broadcast:send`, `audit:logs:read`, `market_intel:manage`.

Sengaja **tidak** dikunci karena memang area merchant: `/admin/analytics`,
`/admin/analytics/products`, `/admin/categories`, `/activity-logs`.

### Verifikasi setelah perbaikan

| Peran | Rute | Hasil |
|---|---|---|
| merchant | 11 rute platform (baca + tulis) | **403** semua |
| support | `/admin/support/tickets`, `/templates` | **200** (staf tetap bisa kerja) |
| support | `/admin/users/search`, `/safe-domains`, `/market-intelligence`, `/audit-logs` | **403** (tidak over-blocking) |
| merchant | `/admin/analytics`, `/admin/analytics/products`, `/admin/categories` | **200** (fitur sah tetap jalan) |

---

## Yang Diverifikasi AMAN (tidak ada temuan)

| Area | Metode | Hasil |
|------|--------|-------|
| SQL Injection | audit seluruh `Order()`/`Where()` dengan input klien | Aman — `orderClause` analytics berasal dari `switch` literal |
| JWT alg confusion | `alg:none`, HS256 secret kosong, HS256 secret lemah × (header/cookie/SSE) | 9/9 ditolak 401 |
| Race condition tiket SSE | 20 permintaan paralel dengan tiket sama | Tepat 1 diterima 200, 19 ditolak 401 |
| Upload | magic bytes, size limit, ekstensi whitelist, key server-generated | Aman |
| Read path traversal | 14 varian serangan pada `resolveInsideRoot` | Aman, invariant terbukti |
| IDOR lampiran support | review `ServeAttachment` | Aman — cek `ticket.UserID`/kepemilikan store; L1 escape LIKE sudah ada |
| XSS / DOM sink | scan `innerHTML`, `dangerouslySetInnerHTML`, `eval`, `document.write`, `srcdoc` | **Nol** sink ditemukan di desktop & mobile |
| postMessage | `authSync.ts` | Same-origin saja (BroadcastChannel/storage) |
| Security headers | probe `/healthz` | nosniff, SAMEORIGIN, CSP 1366 char, Referrer-Policy, Permissions-Policy — ada; `X-Powered-By`/`Server` tidak bocor |
| CORS | Origin `https://evil.example` + preflight | Tidak memantulkan origin asing |
| Secret di tracked files | `git grep` pola secret | Bersih (hanya `.env.example`) |
| `.env` ter-ignore | `.gitignore` `**/.env` | Ya |
| Token di log server | grep log | Query string tidak dicatat |

---

## Catatan Proses (transparansi)

1. **Klaim palsu yang saya batalkan sendiri:** uji awal menyimpulkan "`/etc/passwd` lolos" — ternyata di Windows path itu di-resolve ke dalam root. Saya ganti dengan uji invariant dan hasilnya AMAN. Tidak dilaporkan sebagai temuan.
2. **"Bundle token=0" tidak dapat direproduksi:** `public/desktop` dan `public/mobile` tidak ada saat audit ini (dist di-ignore git). Verifikasi bundle sebelumnya mengacu artefak lokal, bukan kode. Temuan N-02/N-03 berasal dari **source**, bukan artefak.
3. **Dua uji dinamis dihentikan** karena memerlukan konsentrasi permintaan berisiko (memalsukan token superadmin, enumerasi lampiran lintas-user). Kesimpulan N-01 dan IDOR lampiran didasarkan pada bukti statis yang kuat, bukan uji yang dihentikan itu.
4. Semua file uji ad-hoc sudah dihapus; `git status` bersih.

---

## Rekomendasi Urutan Tindakan

1. **N-01** — rotasi `JWT_SECRET`, hapus default hardcoded, bersihkan docs/history. *(blocker push)*
2. **N-02** — hapus `?token=` dari `AuthRequired` + fallback frontend.
3. **N-03** — pakai `resolveInsideRoot` di jalur delete.
4. **N-04** — perketat cek `token_version`.
5. **N-05** — cek aktor di service layer + whitelist `RequireAdmin`.

**Putusan awal: JANGAN push/deploy sebelum N-01 dan N-02 diperbaiki.** (Sudah dipenuhi — lihat di bawah.)

---

## Verifikasi Penutupan (diuji ulang setelah perbaikan)

Setiap perbaikan diverifikasi, bukan hanya diklaim.

### Build & test

| Pemeriksaan | Hasil |
|---|---|
| `go build ./...` | exit 0 |
| `go vet ./...` | exit 0 |
| `go test ./internal/security ./internal/middleware ./internal/services` | ok (3/3 paket) |
| `govulncheck ./...` | 0 vulnerability pada kode |
| `tsc --noEmit` frontend desktop | exit 0 |
| `tsc --noEmit` frontend mobile | exit 0 |

### N-01 — fail-closed terbukti (uji proses nyata)

| Skenario | Hasil |
|---|---|
| `JWT_SECRET` kosong | `FTL JWT_SECRET wajib di-set dan tidak boleh kosong` → proses berhenti |
| `JWT_SECRET` = nilai default lama yang bocor | `FTL ... nilai default lama yang sudah bocor di riwayat git` → proses berhenti |
| `JWT_SECRET` = `pendek` (6 karakter) | `FTL ... terlalu pendek: minimal 32 karakter` → proses berhenti |
| `JWT_SECRET` baru dari `.env` | server `LIVE` di port 8000 (tidak over-blocking) |

`git grep` pada seluruh file terlacak: **tidak ada nilai secret lama tersisa**.

### N-02 — ditolak secara dinamis

| Permintaan | Sebelum | Sesudah |
|---|---|---|
| `GET /api/auth/me` tanpa auth | 401 | 401 |
| `GET /api/auth/me?token=<JWT>` | **200** | **401** |
| `GET /api/auth/me` + `Authorization: Bearer <JWT palsu>` | 401 | 401 |
| `GET /healthz` tanpa auth | 200 | 200 |

`grep` frontend: 0 kemunculan `?token=`. Backend: 0 pemanggilan `Query("token")` untuk auth.

### N-03 — uji regresi otomatis

`path_guard_test.go` lulus untuk: traversal keluar root (10 bentuk), perpindahan antar-tenant (`stores/5/../../2/...`), prefix mirip (`stores/50` vs `stores/5`), dan path sah. Uji symlink di-skip di Windows (privilege), tetapi `EvalSymlinks` tetap ada di jalur kode.

### N-04 / N-05

Keduanya perubahan logika murni; diverifikasi lewat build+vet+test. Tidak ada uji dinamis tambahan karena memerlukan kredensial staf (password seed tidak diketahui — lihat Keterbatasan).

### Dampak samping yang disengaja

Rotasi `JWT_SECRET` membuat **302 sesi** di `user_sessions` tidak lagi valid. Semua pengguna harus login ulang. Ini konsekuensi yang diinginkan dari rotasi, bukan regresi.

### Keterbatasan yang masih berlaku

1. Login end-to-end tidak diuji setelah rotasi karena password akun uji tidak tersedia di lingkungan ini dan tidak akan ditebak.
2. Riwayat git masih memuat secret lama. Rotasi sudah menetralkan nilainya, tetapi pembersihan history (`git filter-repo`) tetap perlu dilakukan **sebelum push** ke remote publik.
3. N-05 tetap defense-in-depth: seluruh call site sudah di balik `RequirePermission`, jadi tidak ada jalur serang terbuka yang ditutup oleh perbaikan ini.
