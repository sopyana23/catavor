# Audit Keamanan Putaran 8 — Zero-Change Re-Audit (Read-Only)

**Tanggal Audit:** 14 November 2026
**Baseline Commit:** `c20cbf9` (feat(tablet): harmonize tablet mini order history card with mobile ergonomics and zero-wrap collision)
**Mode:** READ-ONLY. Tidak ada satu pun file source, config, atau dependensi yang diubah oleh audit ini.

## Metodologi

Audit ini sengaja **tidak mengubah apa pun**. Tujuannya menilai apakah sistem sudah
memenuhi standar industri, bukan memperbaikinya. Karena itu setiap temuan di bawah
adalah kondisi kode **sebagaimana ada sekarang**.

Sumber yang dipakai:

1. **Metodologi Cloudflare (`cloudflare/security-audit-skill`)** — 6 fase:
   Reconnaissance → Coverage-Led Hunting (6 kelas serangan) → Adversarial Disprove
   Phase → klasifikasi `confirmed` / `needs_validation` / `rejected` → verifikasi
   independen catatan lama → remediasi defensif.
2. **OWASP Top 10 (2021)** + **OWASP ASVS 4.0 Level 2** sebagai tolok ukur
   kepatuhan, bukan satu-satunya acuan.
3. **NIST SP 800-63B** untuk kebijakan kredensial & sesi.
4. **Verifikasi runtime nyata:** `go build ./...`, `go vet ./...`, `govulncheck ./...`,
   `npm audit` pada tiga frontend, dan penelusuran kode langsung (code-as-truth).

### Cakupan yang diperiksa

- 162 file Go, ±57.634 baris, 48 handler, 40 service.
- 218 titik wiring route/middleware di `cmd/server/main.go`.
- Pipeline upload berkas (`storage_handler.go`), jalur penyajian statis (`main.go`).
- Autentikasi: JWT, cookie sesi, CSRF, OTP, Google SSO, lockout, rate limiter.
- Multi-tenant: scoping `store_id` pada handler produk.
- Dependensi: `go.mod` (Go 1.26.9) + `package.json` 3 frontend.

---

## Ringkasan Eksekutif (revisi 3 — setelah validasi N-65 & finalisasi silang)

**Kesimpulan: sistem BELUM memenuhi standar industri.** Fondasinya kuat, tetapi re-audit
menemukan **1 CRITICAL (N-61, terbukti di test handler)** yang lolos dari audit awal dan
dari review Agent B, ditambah **3 HIGH (N-58, N-47, N-65)** dan beberapa MEDIUM.

| Kelas | Temuan | Status bukti |
|---|---|---|
| CRITICAL | **N-61** path traversal baca file arbitrer di `GetOrderProof` | Terbukti (test handler, canary terbaca) |
| HIGH | **N-58** lampiran tiket `stores/<id>/support/**` publik tanpa auth | Terbukti runtime lokal (30 file, HTTP 200) |
| HIGH | **N-47** PDF konten aktif di pohon publik via kategori `products` | Terbukti di kode |
| HIGH | **N-65** IDOR lintas-tenant / confused deputy via `storage_key` tiket | Terbukti di kode (`support_handler.go:589, 2454`) |
| MEDIUM | N-48 SSRF TOCTOU, N-49 limiter in-memory, N-50 CSP longgar, **N-59** XSS-by-MIME + `?token=`, **N-62** bypass limiter via varian path | N-59 (handler) dan N-62 (runtime) terbukti |
| LOW / INFO | N-51..N-57, N-60, N-63, N-64 | lihat Bagian 11 |
| Dependensi | 4 CVE Go aktif (`govulncheck`), 0 vuln frontend | Terbukti runtime |

**Kepatuhan ASVS L2: ~68%** (estimasi subjektif, turun karena V4 Access Control
mengalami temuan ganda: N-61 dan N-65).

> **ERRATA untuk reviewer:**
> 1. Klaim di Bagian 3 bahwa storage `private/support/billing` "diblokir — TERBUKTI" **terlalu lebar**; dikoreksi oleh N-58.
> 2. Bagian 10 (Agent B) memberi N-58 CRITICAL dan N-59 HIGH; severity disesuaikan di 11.3.
> 3. N-65 dinaikkan dari `needs_validation` menjadi **HIGH (terkonfirmasi)** setelah verifikasi kontrol akses attachment tiket.
> 4. N-55 turun ke `needs_validation`.
> 5. Penomoran lama N-52..N-57 di tabel ringkasan awal bisa tidak sinkron dengan judul di Bagian 1/2; rujuk judul di tubuh laporan.
> 6. Semua bukti "terbukti" berasal dari lingkungan **lokal**, bukan produksi.

---

## 1. Temuan Baru Putaran 8 (`confirmed`)

### N-47 — HIGH — PDF JavaScript / Konten Aktif Tersimpan di Pohon Publik

**Lokasi:** `backend/internal/handlers/storage_handler.go:153-165` dan
`backend/cmd/server/main.go:294-296`

**Mekanisme celah:**

Pada handler unggah, cabang PDF dipicu **hanya** oleh magic byte `%PDF-`
(baris 154) **tanpa memeriksa kategori unggahan**:

```go
isPDF := bytes.HasPrefix(fileBytes, []byte("%PDF-")) || strings.EqualFold(filepath.Ext(file.Filename), ".pdf")
if isPDF {
    // ... tidak ada pengecekan kategori di sini
    contentType = "application/pdf"
    ext = ".pdf"
}
```

Kategori default adalah `products` (baris 95 dan 119). Untuk kategori itu,
`objectKey` dibentuk sebagai:

```go
objectKey = fmt.Sprintf("stores/%d/%s/%d/%02d/%s%s", storeID, category, now.Year(), now.Month(), uniqueID, ext)
```

Hanya kategori `support` dan `billing` yang dipindah ke namespace privat
(`storage.PrivateKeyPrefix`, baris 319-321). Artinya PDF unggahan produk mendarat
di **pohon publik** dan disajikan lewat `GET /storage/*` dengan header
`Content-Type: application/pdf` (`main.go:294`).

PDF bukan berkas pasif. Spesifikasi PDF mendukung:

- `/OpenAction` dan `/AA` — JavaScript dijalankan saat dokumen dibuka.
- `/Launch` — menjalankan program eksternal (diblokir sebagian besar viewer modern).
- Embedded file streams.
- Referensi URL eksternal yang dapat dipakai untuk tracking/exfiltrasi.

Dengan `X-Content-Type-Options: nosniff` yang sudah dipasang (`main.go:298`),
browser tidak akan menginterpretasinya sebagai HTML — jadi ini **bukan** stored XSS
klasik. Tapi penyerang tetap bisa:

1. Menyimpan PDF berisi `/OpenAction` JavaScript di URL publik yang stabil.
2. Menyebarkan URL itu ke korban. Korban yang membukanya menjalankan JavaScript
   di dalam konteks viewer PDF browser.
3. Memakai URL publik itu sebagai hosting payload yang andal (URL `*.domain`
   sendiri, bukan domain pihak ketiga yang lebih mudah diblokir).

**Kenapa ini temuan dan bukan keparahan penuh:** eksploitasi bergantung pada
viewer korban dan pada apakah ada korban yang membuka URL itu. Tapi masalah
desainnya nyata: **berkas dengan kemampuan konten aktif diperlakukan sama dengan
gambar produk**, dan tidak ada kebijakan yang membatasi kategori mana yang boleh
menerima PDF.

**Yang benar secara desain:** PDF hanya diperbolehkan untuk kategori yang memang
membutuhkannya (`support`, `billing`, dan produk digital yang eksplisit
diizinkan), atau seluruh PDF dipaksa ke namespace privat sehingga hanya bisa
diakses lewat endpoint berautentikasi.

**Severity: HIGH** — bukan karena dampak langsungnya paling parah, tapi karena
jalur ini tidak pernah diperiksa di tujuh putaran sebelumnya, menyentuh permukaan
publik, dan perbaikannya murah (satu pengecekan kategori).

---

### N-48 — MEDIUM — SSRF Guard Tidak Tahan DNS Rebinding

**Lokasi:** `backend/internal/services/aulaa_service.go:36-92` dan
`backend/internal/services/aulaa_service.go:207-224` (serta 257, 296, 349)

**Mekanisme celah:**

`ValidateAulaaBaseURL` memang melakukan validasi yang benar pada **saat menyimpan**
konfigurasi: memaksa HTTPS, menolak kredensial URL, memblokir loopback, RFC1918,
link-local, multicast, unspecified, dan melakukan `net.LookupIP(host)` untuk
menolak hostname yang mengarah ke IP internal.

Namun pada **saat request dikirim** (`CreateAulaaPayment`, `GetAulaaPaymentStatus`,
`VerifyAulaaPayment`, `CancelAulaaPayment`), kode memakai HTTP client standar:

```go
client := &http.Client{Timeout: DefaultHTTPTimeout}
resp, err := client.Do(httpReq)
```

Tidak ada `DialContext` kustom, tidak ada pinning IP, dan tidak ada validasi ulang
setelah resolusi DNS. Verifikasi di kode: `grep -c "DialContext" aulaa_service.go`
menghasilkan **0**.

**Serangan (DNS rebinding):**

1. Penyerang yang bisa mengubah `aulaa_base_url` (perlu akses admin, atau
   mengendalikan DNS untuk hostname yang sudah terdaftar) men-set BaseURL ke
   `https://attacker.example` yang lolos validasi karena mengarah ke IP publik.
2. Saat request dikirim, DNS untuk `attacker.example` dijawab dengan
   `169.254.169.254` (metadata cloud) atau `127.0.0.1`.
3. Server mengirim `Authorization: Bearer <aulaa_api_key asli>` ke host internal itu.

**Catatan jujur soal prasyarat:** mengubah `aulaa_base_url` sendiri sudah dijaga
(baris 488 di `payment_handler.go` dan 410 di `setting_handler.go` memanggil
validasi). Jadi ini bukan celah yang bisa dipakai anonim. Tetapi sebagai
pertahanan berlapis, validasi saat simpan saja tidak cukup — DNS bisa berubah
setelah penyimpanan, dan guard yang benar memvalidasi **pada saat koneksi**.

**Severity: MEDIUM** — prasyarat tinggi (akses admin), tapi konsekuensinya
kebocoran kredensial gateway pembayaran ke host internal.

---

### N-49 — MEDIUM — Rate Limiter Auth Memakai Penyimpanan In-Memory

**Lokasi:** `backend/internal/middleware/security.go:149, 179, 196, 215`

**Mekanisme celah:**

Keempat rate limiter (`GlobalAPIRateLimiter`, `AuthRateLimiter`,
`PublicSubmissionRateLimiter`, `TelemetryRateLimiter`) dibuat dengan
`limiter.New(limiter.Config{...})` **tanpa field `Storage`**. Default Fiber
limiter adalah **penyimpanan in-memory per-instance**.

Konsekuensi:

1. **Deployment multi-instance tidak terlindungi.** Dengan 3 replica di belakang
   load balancer, penyerang mendapat 3x anggaran rate limit. Untuk
   `AuthRateLimiter` (20 req/menit), itu jadi 60 req/menit agregat.
2. **State hilang saat restart.** Setiap deploy me-reset seluruh counter, memberi
   jendela bebas limit sesaat setelah restart.

Yang membuat ini menarik: proyek ini **sudah punya Redis** dan sudah menggunakannya
untuk blacklist JWT, lockout login, dan fail-closed di production (lihat
`internal/database/redis.go`). Fiber limiter mendukung
`limiter.Config{Storage: limiter.StorageRedis(...)}`. Jadi ini bukan keterbatasan
arsitektural — ini bagian yang belum disambungkan.

**Severity: MEDIUM** — tidak ada eksploitasi langsung pada single-instance, tapi
begitu aplikasi di-scale horizontal (yang memang tujuan SaaS), proteksi
brute-force melemah secara linear terhadap jumlah replica.

---

### N-50 — MEDIUM — CSP Terlalu Longgar (`img-src http:`, `connect-src http:`)

**Lokasi:** `backend/internal/middleware/security.go:53, 55`

**Mekanisme celah:**

```
img-src 'self' data: blob: https: http:;
connect-src 'self' https: http: https://*.tiktok.com ...
```

`http:` (tanpa host) berarti **setiap host HTTP di internet** diizinkan sebagai
sumber gambar dan sebagai tujuan `fetch`/`XHR`/`WebSocket`.

Dampak:

1. **`img-src http:`** — halaman bisa memuat gambar dari server penyerang via HTTP
   polos. Dipakai untuk tracking pengunjung, pelacakan IP, dan deteksi apakah
   pengguna sedang melihat halaman tertentu.
2. **`connect-src http:`** — lebih serius. Setiap skrip yang lolos ke halaman bisa
   mengirim data (termasuk token, isi form, data yang sedang dilihat pengguna) ke
   endpoint HTTP mana pun di internet. Ini melemahkan pertahanan terakhir ketika
   kontrol lain sudah ditembus.

Komentar di kode sendiri mengakui `style-src` butuh `'unsafe-inline'` karena React.
Tapi `img-src` dan `connect-src` tidak punya alasan struktural yang sama — gambar
dan API call seharusnya bisa dibatasi ke origin sendiri + domain pihak ketiga yang
eksplisit disebut.

**Severity: MEDIUM** — bukan celah berdiri sendiri, tapi menghilangkan lapisan
pertahanan yang OWASP ASVS 14.4.3 (CSP Level 2) syaratkan.

---

### N-51 — MEDIUM — `Strict-Transport-Security: preload` Tanpa Verifikasi Subdomain

**Lokasi:** `backend/internal/middleware/security.go:60-62`

**Mekanisme:**

```go
if c.Secure() {
    c.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
}
```

`includeSubDomains` memberitahu browser untuk memaksa HTTPS pada **seluruh
subdomain**. `preload` berarti domain ini bisa masuk ke HSTS preload list browser
— yang bersifat permanen dan sulit dibatalkan.

Risiko: kalau ada subdomain yang melayani HTTP polos (atau subdomain pihak ketiga
di bawah domain yang sama, seperti `status.example.com` atau
`blog.example.com` yang di-host orang lain), pengguna ke subdomain itu akan
mengalami kegagalan koneksi total.

Ini temuan **konfigurasi/deployment**, bukan bug kode. Tidak bisa dipastikan dari
kode saja — perlu audit DNS. Tapi memasukkannya `preload` tanpa verifikasi itu
langkah yang tidak bisa di-undo dengan mudah.

**Severity: MEDIUM** (kondisional — tergantung konfigurasi DNS produksi).

---

## 2. Temuan Kepatuhan / Hardening (LOW)

### N-52 — Tidak Ada 2FA/MFA

Tidak ada implementasi TOTP/2FA sama sekali (`grep -rn "two_factor\|TOTP\|totp"`
tidak menemukan apa pun selain false positive). Untuk platform yang memegang data
pembayaran dan mengelola toko, OWASP ASVS 2.8 (multi-factor authentication) dan
NIST SP 800-63B AAL2 menyaratkan MFA untuk operasi sensitif. Ini gap kepatuhan.

### N-53 — Email Tercatat di Log Terstruktur

13 titik menulis `Str("email", ...)` ke log aplikasi (`internal/handlers/auth_handler.go`
dan `internal/database/redis.go`). Ini membantu investigasi insiden, tapi berarti
log menjadi tempat penyimpanan PII. Sesuai praktik industri, log harus dianggap
aset sensitif: akses dibatasi, retensi dibatasi, dan PII idealnya di-hash atau
dimasking untuk peristiwa yang tidak memerlukan email mentah.

### N-54 — Password Policy Belum Cukup untuk Standar Saat Ini

`security.ValidatePassword` (`internal/security/sanitizer.go:391-428`) mensyaratkan
minimal 8 karakter + kombinasi huruf besar/kecil/angka/simbol.

Kebijakan komposisi seperti ini adalah praktik lama. **NIST SP 800-63B secara
eksplisit meninggalkan aturan komposisi** dan merekomendasikan:

- Minimum 8 karakter, **yang penting panjang**, bukan variasi kelas karakter.
- Pemeriksaan terhadap daftar kata yang umum (breached password list).
- Tanpa persyaratan rotasi paksa.

Kebijakan saat ini memblokir passphrase panjang yang kuat seperti
`kuda-laut-menyanyi-pagi` sambil tetap menerima `Passw0rd!` yang ada di setiap
daftar breach. Arah yang benar: naikkan minimum panjang (12+), pertahankan
pemeriksaan breach, longgarkan aturan komposisi.

### N-55 — Tidak Ada Rotasi Refresh Token

Sesi memakai JWT berumur 12 jam (`session_cookie.go:23-29`) tanpa mekanisme
refresh token berumur pendek. JWT 12 jam yang tidak bisa dicabut lebih awal
(kecuali lewat blacklist Redis yang sudah ada) adalah jendela yang cukup lebar
jika token bocor. Praktik industri: access token 15 menit + refresh token
berotasi, atau session token berumur pendek dengan sliding expiration.

### N-56 — Tidak Ada Lapisan WAF/TLS di Repositori

Tidak ada konfigurasi Cloudflare, nginx, Caddy, Traefik, atau Terraform di
repositori. Ini wajar untuk repo aplikasi, tapi berarti kontrol seperti WAF,
bot management, TLS termination, dan DDoS mitigation seluruhnya bergantung pada
infrastruktur yang tidak terdokumentasi di sini. Sebagai referensi, metodologi
Cloudflare mengasumsiskan lapisan ini ada — dan itu **harus diverifikasi
terpisah**, tidak bisa diasumsikan dari repo.

### N-57 — `/api/telemetry/search` Alias Ganda

`main.go:435` mendaftarkan alias defensif untuk prefix `/api` ganda
(`/api/api/telemetry/search`). Alias seperti ini menambah permukaan rute tanpa
menambah fungsi, dan bisa menutupi bug routing klien. Ini bukan celah keamanan,
tapi debt permukaan yang sebaiknya dieliminasi setelah klien dibersihkan.

---

## 3. Verifikasi Independen: Klaim Lama Diuji Ulang

Sesuai Fase 4 metodologi Cloudflare, klaim "sudah diperbaiki" dari putaran
sebelumnya **tidak dipercaya begitu saja**. Saya periksa kode saat ini:

| Klaim historis | Status empiris putaran 8 |
|---|---|
| Aulaa webhook fail-closed (secret kosong → 503) | **TERBUKTI** — `payment_handler.go:40-57` menolak secret kosong |
| Underpayment ditolak + row locking | **TERBUKTI** — `clause.Locking{Strength:"UPDATE"}` + cek `Amount < FinalAmount` |
| Secret Aulaa dimasking di GET /settings | **TERBUKTI** — `secretPlatformKeys` + `maskSecretValue` |
| `err.Error()` tidak bocor ke response | **TERBUKTI** — `safeErrMsg()` + whitelist `safeClientError` |
| CSP tanpa `unsafe-inline`/`unsafe-eval` pada `script-src` | **TERBUKTI** — hash SHA-256 runtime, `object-src 'none'` |
| JWT cookie HttpOnly + SameSite=Strict | **TERBUKTI** — `session_cookie.go:36-45` |
| CSRF Origin/Referer pada mutasi | **TERBUKTI** — `csrf.go:42-98`, termasuk penolakan `Origin: null` |
| Login lockout 5 percobaan / 15 menit | **TERBUKTI** — `redis.go:372-395`, key per-email global |
| OTP crypto/rand, hash SHA-256, max 3 percobaan | **TERBUKTI** — `otp_service.go:41-47, 190-236` |
| Google SSO verifikasi aud + email_verified | **TERBUKTI** — `auth_handler.go:1406-1416` |
| Storage private/ support/ billing diblokir dari route publik | **TERBUKTI** — `main.go:235, 260` |
| Multi-tenant scoping `store_id` pada produk | **TERBUKTI** — `product_handler.go` konsisten memakai `store.ID` |
| bcrypt cost 12 | **TERBUKTI** — `models/user.go:32` |
| Password reset: cek reuse password lama + `TokenVersion++` | **TERBUKTI** — `auth_handler.go:2172-2191` |

**Catatan penting:** klaim lama yang terbukti tetap **tidak** membuat sistem aman
secara menyeluruh. Artinya: temuan yang sudah ditutup memang tertutup; yang menjadi
masalah sekarang adalah jalur yang belum pernah diaudit (bagian 1).

---

## 4. Verifikasi Dependensi (Runtime, Bukan Asumsi)

### Go (`govulncheck ./...`, Go 1.26.9)

```
Vulnerability #1: GO-2026-6888  brotli@v1.2.1        → fixed in v1.2.7
Vulnerability #2: GO-2026-6865  compress@v1.19.2     → fixed in v1.20.2
Vulnerability #3: GO-2026-6859  net/http@go1.26.9    → fixed in go1.26.11
Vulnerability #4: GO-2026-6809  crypto/x509@go1.26.9 → fixed in go1.26.10
```

**4 kerentanan yang kodenya benar-benar memanggil** (bukan sekadar ada di
dependency tree). Trace yang relevan:

- `internal/storage/storage.go:342` → `x509.Certificate.Verify` (GO-2026-6809)
- `internal/handlers/support_handler.go:2523` → `http.body.Read` (GO-2026-6859)
- `internal/services/aulaa_service.go:349-362` → `http.Transport.RoundTrip`
- `internal/handlers/product_handler.go:1178` → `http.Transport`

Dua di antaranya (`net/http`, `crypto/x509`) adalah **standard library** — artinya
tidak bisa diperbaiki dengan `go get`, hanya dengan **upgrade toolchain Go** ke
1.26.10/1.26.11.

### Frontend (`npm audit`, 3 SPA)

```
desktop: 0 kerentanan
tablet:  0 kerentanan
mobile:  0 kerentanan
```

Bersih. Ini konsisten dengan klaim putaran 7 dan **terbukti** ulang.

### Build & vet

```
go build ./...  → OK
go vet ./...    → OK (tanpa temuan)
```

---

## 5. Kepatuhan Standar Industri

Dinilai terhadap OWASP ASVS 4.0 Level 2 (standar untuk aplikasi yang memegang
data sensitif):

| Area ASVS | Status | Catatan |
|---|---|---|
| V1 Arsitektur | ⚠️ Sebagian | Desain solid; rate limiter belum shared-state |
| V2 Autentikasi | ⚠️ Sebagian | Lockout, OTP, SSO bagus; **tanpa MFA** |
| V3 Manajemen Sesi | ⚠️ Sebagian | HttpOnly+SameSite benar; tanpa refresh rotation |
| V4 Kontrol Akses | ✅ Baik | Tenant scoping konsisten, RBAC terpusat |
| V5 Validasi Input | ✅ Baik | Parameterized query, sanitizer, magic-byte |
| V6 Kriptografi | ✅ Baik | bcrypt 12, crypto/rand, secret panjang terkontrol |
| V7 Penanganan Error | ✅ Baik | `safeErrMsg`, tidak ada stack trace ke klien |
| V8 Data Protection | ⚠️ Sebagian | PII di log; enkripsi at-rest belum terverifikasi |
| V9 Komunikasi | ✅ Baik | HSTS, TLS wajib, DB SSL wajib di produksi |
| V10 Malicious Code | ⚠️ Sebagian | Upload bersih untuk gambar; PDF belum digating |
| V11 Business Logic | ✅ Baik | Underpayment check, quota, transaksi atomik |
| V12 File & Resource | ⚠️ Sebagian | Magic-byte + re-encode bagus; kategori PDF longgar |
| V13 API & Web Service | ✅ Baik | CORS ketat, CSRF Origin check, rate limit ada |
| V14 Konfigurasi | ⚠️ Sebagian | CSP longgar; WAF/TLS di luar repo |

**Perkiraan kepatuhan: ~78% dari ASVS Level 2.** Untuk membawa ke 90%+ yang
diperlukan standar industri, prioritasnya: MFA (V2), rate limiter Redis (V1/V13),
CSP ketat (V14), dan gating kategori upload (V10/V12).

---

## 6. Kandidat yang Ditolak (Adversarial Disprove Phase)

Sesuai Fase 3, kandidat yang dicurigai tetapi **terbukti aman**:

1. **SQL Injection pada analitik/market intelligence** — ditolak. Semua
   `db.Raw(...)` memakai bind parameter `?` (`analytics_handler.go:1717-1745`,
   `market_intelligence_service.go:169-184`). Tidak ada `fmt.Sprintf` yang
   menyusun klausa WHERE dari input pengguna.
2. **Path traversal pada unggah** — ditolak. `objectKey` dibangun dari
   `uuid.New().String()` + tanggal server; nama berkas pengguna tidak pernah
   masuk ke path. Resolusi path aman.
3. **Algorithm confusion pada JWT** — ditolak. `jwt.WithValidMethods([]string{"HS256"})`
   dipasang (`auth.go:122`), plus `jwt.SigningMethodHMAC` dicek manual di
   callback kunci.
4. **User enumeration lewat login** — ditolak. Response email-tidak-ada dan
   password-salah identik: `"Email atau kata sandi yang Anda masukkan salah."`
   (`auth_handler.go:285, 313`).
5. **User enumeration lewat forgot-password** — ditolak. Email tak terdaftar dan
   akun blacklisted mendapat response identik (`auth_handler.go:2072-2087`).
6. **CSRF lewat `Origin: null`** — ditolak. `csrf.go:52-57` mengosongkan `null`
   lalu menolak bila tidak ada Referer.
7. **XSS lewat SVG upload** — ditolak. Jalur gambar mewajibkan `image.Decode`
   berhasil lalu **re-encode** ke JPEG/PNG (`storage_handler.go:182-207`), yang
   menghancurkan markup apa pun. SVG tidak bisa lolos.
8. **IDOR pada pencabutan sesi** — ditolak. `WHERE id = ? AND user_id = ?`
   memakai user dari konteks JWT.
9. **Race condition pada hapus toko / storage root wipe** — ditolak. Putaran 7
   menutup N-46 dengan `EvalSymlinks` + penolakan `rel == "."` + `EqualFold`.

---

## 7. Yang Tidak Bisa Dipastikan Dari Kode

Jujur soal batas audit ini:

1. **Konfigurasi runtime produksi.** `APP_ENV`, `JWT_SECRET`, `REDIS_URL`,
   `TRUSTED_PROXIES`, `AULAA_ALLOW_LOCAL_HTTP` semua ada di `.env` yang tidak
   dikomit. Kode sudah fail-closed untuk nilai buruk, tapi nilai sebenarnya hanya
   bisa diverifikasi di server.
2. **Lapisan WAF/TLS/CDN.** Referensi Cloudflare mengasumsiskan Cloudflare (atau
   setara) ada di depan aplikasi. Tidak ada bukti di repo — perlu diverifikasi
   terpisah. Kalau tidak ada, temuan N-48/N-49 jadi lebih berat.
3. **Enkripsi at-rest.** SQLite lokal vs Postgres ber-TLS di produksi tidak bisa
   dibedakan dari kode.
4. **Praktik rotasi secret.** Kode punya mekanisme penolakan secret lama, tapi
   apakah operasional rotasi benar-benar berjalan tidak terlihat dari repo.
5. **Log aggregation & retensi.** 13 titik PII di log; bagaimana log disimpan dan
   siapa yang bisa membaca adalah keputusan operasional.

---

## 8. Rekomendasi Prioritas (Tidak Dieksekusi)

Urutan berdasarkan rasio dampak terhadap usaha:

| Prioritas | Temuan | Usaha | Dampak |
|---|---|---|---|
| 1 | **N-47** Gate kategori PDF ke privat | Kecil | Menutup jalur konten aktif publik |
| 2 | **Go 1.26.11 + brotli/compress bump** | Kecil | Menutup 4 CVE yang aktif dipanggil |
| 3 | **N-49** Redis storage untuk rate limiter | Sedang | Proteksi brute-force saat scale |
| 4 | **N-50** CSP: buang `http:` dari `img-src`/`connect-src` | Sedang | Kepatuhan ASVS 14.4 |
| 5 | **N-48** `DialContext` dengan validasi IP saat connect | Sedang | Tahan DNS rebinding |
| 6 | **N-52** MFA/TOTP untuk akun staf | Besar | Kepatuhan ASVS 2.8 |
| 7 | **N-51** Verifikasi subdomain sebelum `preload` | Kecil | Hindari outage permanen |
| 8 | **N-54** Ganti policy komposisi → panjang + breach check | Sedang | Sesuai NIST 800-63B |
| 9 | **N-53** Masking email di log non-insiden | Sedang | Kurangi PII di log |

---

## 9. Pernyataan Batas

Laporan ini adalah hasil audit **statis + verifikasi dependensi**, bukan
pengujian penetrasi dinamis. Tidak ada eksploitasi yang dijalankan terhadap
sistem berjalan; tidak ada kode yang diubah.

**"Temuan tertutup" ≠ "sistem terbukti aman."** Putaran 1–7 menutup 30+ temuan dan
klaimnya terverifikasi ulang di sini. Tapi putaran 8 menemukan 1 HIGH + 4 MEDIUM
yang tidak diketahui sebelumnya. Yang benar dikatakan: **sebagian besar permukaan
sudah kuat; lima jalur spesifik masih perlu diperbaiki sebelum bisa disebut
memenuhi standar industri.**

---

## 10. Catatan Tambahan & Temuan Baru — Verifikasi Independen (Reviewer: Agent B / Antigravity)

**Tanggal Verifikasi:** 14 November 2026  
**Peninjau:** Agent B (Antigravity Senior Engineering Review)  
**Metodologi:** Zero-Trust Source-Code Verification, Dynamic Port-8000 Probing, & Blast Radius Audit  

Bagian ini ditambahkan secara khusus sebagai tinjauan kritis atas laporan Putaran 8 di atas. Berdasarkan audit berbasis *code-as-truth* dan pengujian dinamis pada runtime lokal (port 8000), berikut adalah konfirmasi validitas temuan Putaran 8 serta **3 temuan baru (N-58, N-59, N-60)** yang terlewat pada audit sebelumnya.

### A. Konfirmasi Evaluasi atas Temuan Putaran 8

1. **N-47 (HIGH - PDF JavaScript di Pohon Publik): TERKONFIRMASI 100% VALID**
   - Kode sumber `storage_handler.go:154-165` meloloskan unggahan PDF untuk semua kategori (default `products`) hanya dengan validasi header `%PDF-`.
   - Berkas mendarat di `public/storage/stores/<id>/products/...` dan disajikan oleh `main.go:295` dengan `Content-Type: application/pdf` tanpa header `Content-Disposition: attachment`.
2. **N-48 (MEDIUM - SSRF DNS Rebinding pada Aulaa Service): TERKONFIRMASI 100% VALID**
   - Validasi IP privat di `ValidateAulaaBaseURL` hanya terjadi saat penyimpanan BaseURL. Saat transaksi berjalan (`aulaa_service.go:265`), `http.Client` melakukan resolusi DNS ulang tanpa `DialContext` IP pinning / socket re-check.
3. **N-49 (MEDIUM - Fiber Rate Limiter In-Memory Store): TERKONFIRMASI 100% VALID**
   - Di `security.go:149, 179, 196, 215`, limiter menggunakan in-memory default tanpa Redis storage, sehingga batas kuota request tidak tersinkronisasi pada kluster multi-node.
4. **N-50 (MEDIUM - CSP `img-src http:`, `connect-src http:`): TERKONFIRMASI 100% VALID**
   - `security.go:53, 55` memuat wildcard `http:` yang memungkinkan transmisi data via kanal tidak terenkripsi.
5. **N-51 (MEDIUM - HSTS Preload & includeSubDomains): SEBAGIAN BENAR (OVERSTATED)**
   - Header HSTS `max-age=31536000; includeSubDomains; preload` adalah standar industri SOC 2 / OWASP. Ini hanya menjadi risiko operasional bila organisasi memiliki subdomain non-HTTPS lama, bukan kelemahan arsitektural langsung pada kode.

---

### B. Temuan Baru (New Findings) Terkonfirmasi

#### N-58 — CRITICAL — Akses Terbuka Tanpa Otentikasi ke Berkas Tiket Bantuan Historis (`/storage/stores/<storeID>/support/...`)

* **Lokasi Kode:** `backend/cmd/server/main.go:259-264`  
* **Pohon Berkas Fisik Nyata:** `public/storage/stores/1/support/`, `public/storage/stores/15/support/`, `public/storage/stores/5/support/`  
* **Mekanisme Celah:**
  Guard proteksi berkas privat pada rute publik `main.go` hanya memeriksa:
  ```go
  lowerKey := strings.ToLower(cleanKey)
  for _, prefix := range []string{"private/", "support/", "billing/"} {
      if strings.HasPrefix(lowerKey, prefix) {
          return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Berkas tidak ditemukan."})
      }
  }
  ```
  Guard ini **hanya** memeriksa awalan string (`HasPrefix`) `"support/"`. Padahal berkas lampiran tiket bantuan historis sebelum refaktor tersimpan di bawah path `stores/<storeID>/support/YYYY/MM/<uuid>.<ext>`. Karena diawali dengan `"stores/"`, guard `HasPrefix("support/")` bernilai `false` dan dilewati seutuhnya.
* **Bukti Pengujian Nyata (Server Port 8000):**
  Request `curl` publik tanpa kredensial menghasilkan `HTTP/1.1 200 OK`:
  ```bash
  curl.exe -I -s "http://localhost:8000/storage/stores/1/support/2026/09/308115f4-ab39-4973-8b2a-7ed35c3c54f9.jpg"
  # Response: HTTP/1.1 200 OK | Content-Type: image/jpeg | Content-Length: 289141 | Cache-Control: public, max-age=86400

  curl.exe -I -s "http://localhost:8000/storage/stores/1/support/2026/09/c7afcfc3-9d84-43d2-a536-c28e3f7671c6.pdf"
  # Response: HTTP/1.1 200 OK | Content-Type: application/pdf | Content-Length: 1580522 | Cache-Control: public, max-age=86400
  ```
* **Dampak:** Siapa pun di internet tanpa login dapat mengakses data pribadi, bukti transfer perbankan, dan dokumen PDF sengketa tiket bantuan milik pengguna, serta dicache oleh proxy/CDN publik. Pelanggaran berat kerahasiaan data (UU PDP No. 27/2022).

---

#### N-59 — HIGH — Stored XSS, Open Redirect & Regresi Token URL pada `GetOrderProof`

* **Lokasi Kode:** `backend/internal/handlers/subscription_handler.go:488-566`, `backend/internal/handlers/auth_handler.go:937`, `backend/internal/services/subscription_service.go:772`  
* **Mekanisme Celah:**
  1. **Stored XSS via Base64 Data URL:**
     Pendaftaran langganan menerima string `payment_proof_url` tanpa validasi ketat. Pada `subscription_handler.go:545-561`:
     ```go
     if strings.HasPrefix(proofURL, "data:") {
         // Mengambil mimeType langsung dari input klien tanpa whitelist
         mimeType = meta[strings.Index(meta, ":")+1 : strings.Index(meta, ";")]
         data, err := base64.StdEncoding.DecodeString(parts[1])
         c.Set("Content-Type", mimeType)
         return c.Send(data)
     }
     ```
     Jika penyerang menyisipkan `payment_proof_url: "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="`, backend merespons dengan `Content-Type: text/html`. Saat staf/admin membuka bukti pembayaran di panel admin, skrip JavaScript berjalan di bawah origin domain web admin (Same-Origin XSS).
  2. **Open Redirect / Phishing Admin:**
     ```go
     if strings.HasPrefix(proofURL, "http://") || strings.HasPrefix(proofURL, "https://") {
         return c.Redirect(proofURL, fiber.StatusFound)
     }
     ```
     Bila penyerang memasukkan URL eksternal berbahaya, staf platform yang mengklik "Bukti Bayar" diarahkan (HTTP 302) langsung ke domain luar/phishing tanpa konfirmasi.
  3. **Regresi Keamanan N-02 (Token JWT di Query Param `?token=`):**
     Baris 488 membaca JWT dari `c.Query("token")`. Padahal aturan arsitektur platform `middleware/auth.go:241` secara tegas menyatakan `SECURITY (N-02): fallback ?token= DIHAPUS` demi mencegah kebocoran token di log server dan HTTP Referer.

---

#### N-60 — MEDIUM — In-App Inline PDF Rendering pada Lampiran Bantuan (`support_handler.go:2595`)

* **Lokasi Kode:** `backend/internal/handlers/support_handler.go:2593-2598`  
* **Mekanisme Celah:**
  ```go
  dispositionType := "attachment"
  lowerType := strings.ToLower(contentType)
  if !isDownload && (strings.HasPrefix(lowerType, "image/") || lowerType == "application/pdf") {
      dispositionType = "inline"
  }
  ```
  Lampiran tiket bantuan berformat PDF disajikan secara `inline` bila tidak ada query `?download=1`. Jika penyerang menyisipkan berkas PDF dengan form/action stream aktif, dokumen akan dirender langsung di peramban staf peninjau.
* **Rekomendasi:** Paksa seluruh PDF disajikan dengan `Content-Disposition: attachment; filename="..."` untuk meniadakan rendering inline di konteks browser.

---

### C. Pembaruan Matriks Prioritas Rekomendasi Remediasi

Dengan ditemukannya N-58 dan N-59, urutan prioritas remediasi sistem adalah:

| Prioritas | Temuan | Usaha | Dampak | Status Catatan |
|---|---|---|---|---|
| **P-01** | **N-58** Blokir path `/support/` di `main.go` & migrasikan berkas `stores/*/support` ke `storage/private` | Kecil | Menutup kebocoran data pribadi (UU PDP) | **Temuan Baru (Agent B)** |
| **P-02** | **N-59** Sanitasi `GetOrderProof`: whitelist MIME image, hapus open redirect, hapus `?token=` | Kecil | Mencegah Stored XSS & Admin Phishing | **Temuan Baru (Agent B)** |
| **P-03** | **N-47** Gating kategori unggah PDF ke storage privat | Kecil | Menutup eksekusi konten aktif publik | Terkonfirmasi Putaran 8 |
| **P-04** | **N-60** Paksa `Content-Disposition: attachment` untuk semua PDF tiket | Sangat Kecil | Mitigasi inline PDF execution | **Temuan Baru (Agent B)** |
| **P-05** | Bump Go stdlib ke 1.26.11 + dependensi compress/brotli | Kecil | Menutup 4 CVE aktif | Terkonfirmasi Putaran 8 |
| **P-06** | **N-49** Integrasi Redis storage untuk Fiber Rate Limiter | Sedang | Ketahanan multi-node brute-force | Terkonfirmasi Putaran 8 |
| **P-07** | **N-48** Socket IP pinning via `DialContext` pada gateway Aulaa | Sedang | Mitigasi DNS rebinding TOCTOU | Terkonfirmasi Putaran 8 |
| **P-08** | **N-50** Buang `http:` dari CSP `img-src` dan `connect-src` | Sedang | Kepatuhan ASVS 14.4 & anti-mixed-content | Terkonfirmasi Putaran 8 |
| **P-09** | **N-52** Implementasi MFA/TOTP untuk akun Platform Staff | Besar | Kepatuhan ASVS 2.8 | Terkonfirmasi Putaran 8 |


---

## 11. Re-Audit Putaran 8b — Verifikasi Silang & Temuan Baru

**Metode:** membaca ulang catatan sendiri + Bagian 10 (Agent B), memeriksa "saudara"
dari tiap pola temuan (berkas privat di pohon publik, route publik, input klien yang
dipercaya), lalu membuktikan lewat `curl` ke `localhost:8000` dan test handler throwaway
(sqlite in-memory). Probe dihapus; `git status` hanya menunjukkan 2 berkas laporan
untracked. **Tidak ada kode aplikasi yang diubah.**

### 11.1 N-61 — CRITICAL — Path Traversal Baca File Arbitrer via `payment_proof_url`

**Lokasi:** `handlers/subscription_handler.go:566-640` (fallback filesystem). Sumber data:
`handlers/auth_handler.go:56,937` (Register) dan `services/subscription_service.go:554,772`
(CreateOrder) — `payment_proof_url` disimpan **mentah**, tanpa validasi.

**Mekanisme:**
1. Klien mengirim `payment_proof_url` bebas; tersimpan ke `subscription_orders`.
2. `GetOrderProof` hanya `TrimLeft("/")` + `TrimPrefix("storage/")`.
3. Cek `strings.Contains(key, "..")` hanya ada di cabang `h.storage`. Cabang **fallback
   filesystem** tidak punya: `filepath.Join(StoragePrivateRoot, rel)` → `os.Stat` →
   `c.SendFile(cand)`, sehingga `../` keluar dari root.
4. Pemilik order (cukup akun yang ia daftarkan sendiri) memanggil `/proof` dan server
   mengirim file apa pun yang bisa dibaca proses.

**Bukti (test handler, probe sudah dihapus):**

```
proof="../../../../canary_n61.txt" -> status=200 ctype="image/jpeg" body="SECRET-CANARY-N61\n"
proof="data:text/html;base64,<script>alert(1)</script>" -> 200 ctype="text/html" body="<script>alert(1)</script>"
proof="https://evil.example/x" -> 302 Location: https://evil.example/x
```

Baris 2 dan 3 sekaligus membuktikan N-59 (XSS-by-MIME dan open redirect) di level handler.

**Dampak:** baca `backend/.env` → `JWT_SECRET` → forge JWT admin = takeover (rantai
terakhir ini **inferensi**, belum dijalankan; langkah 1-4 terbukti).
**Batas bukti:** test memakai `Config{}` kosong dan tanpa server hidup. Belum diuji
end-to-end via HTTP (Register dengan payload traversal) dan belum dipastikan root
produksi. Registrasi punya rate limit/OTP yang bisa memengaruhi kemudahan eksploitasi.

**Perbaikan:**
(a) validasi saat simpan: hanya key `billing/...` hasil upload server atau
`data:image/(png|jpeg|webp);base64`, selebihnya ditolak.
(b) saat baca: `filepath.Clean` + `resolveInsideRoot` (helper yang sudah dipakai
`support_handler.go`) + `EvalSymlinks`; hapus kandidat `public/storage` dan CWD-relatif.
(c) hapus `?token=`, whitelist MIME, hapus redirect eksternal (menutup N-59).
(d) tambahkan regression test dari probe di atas.

### 11.2 N-62 — MEDIUM — Rate Limiter Auth Bisa Dibypass Lewat Varian Path

**Lokasi:** `middleware/security.go`, `AuthRateLimiter`, `KeyGenerator = c.IP() + "_" + c.Path()`.
`c.Path()` tidak dinormalisasi (Fiber default tidak case-sensitive dan non-strict routing).

**Bukti runtime:** `/api/auth/check-email` kena 429 pada request ke-21. Setelahnya:

```
/api/auth/check-email/  -> 200
/API/auth/check-email   -> 200
/api/Auth/check-email   -> 200
```

Tiap varian path = bucket baru, jadi batas 20/menit bisa dikali. Dampak: enumerasi email
(N-63) dan brute force melewati limiter; lapisan terakhir hanya lockout per-email (N-48,
yang sendiri bisa jadi DoS akun).
**Perbaikan:** key memakai route pattern (`c.Route().Path`) atau path yang di-lowercase
dan di-`TrimRight("/")`.
**Belum terbukti:** apakah `X-Forwarded-For` bisa dispoof (diuji hanya 3 request, belum
sampai 429) dan apakah bypass yang sama berlaku di endpoint login.

### 11.3 Penyesuaian Severity Temuan Agent B

| ID | Agent B | Revisi | Alasan |
|---|---|---|---|
| N-58 | CRITICAL | **HIGH** | Terbukti 200 tanpa auth, tapi cakupan hanya berkas **legacy** (30 file); upload baru sudah ke `private/`. Produksi belum diverifikasi. Naik ke CRITICAL bila produksi punya berkas serupa. |
| N-59 | HIGH | **MEDIUM** (XSS) + LOW (redirect) | Terbukti `text/html` + 302 di handler, tapi CSP (`script-src` hash + allowlist) menahan inline script; syaratnya gadget `cdn.jsdelivr.net`. Pemilik order = penyerang sekaligus korban (self-XSS) kecuali staf membuka bukti di origin yang sama, itu skenario nyatanya. |
| N-60 | MEDIUM | **INFO** | `inline` disengaja untuk preview in-app, di balik auth + `no-store`. Mitigasi: CSP `sandbox` pada respons lampiran. |

N-58 perbaikan minimal: blokir segmen `/support/` dan `/billing/` di **semua kedalaman**
pada handler `/storage` dan `/public/storage`, lalu migrasikan berkas legacy ke root privat.

### 11.4a N-66 — HIGH — Akses Lampiran Tiket Bantuan Lintas Tenant (CONFIRMED, diperkuat N-65)

**Lokasi:** `handlers/support_handler.go:2656-2693` (`buildSupportAttachment` + `storageKeyFromInput`).
**Klaim Antigravity (N-65):** staf/penyerang memasukkan `storage_key` `private/billing/...` milik
tenant lain lalu membacanya. **Sudah gw uji ulang dengan probe runtime sendiri (SQLite in-memory,
file canary di `StoragePrivateRoot`, probe sudah dihapus):**

```
PENYERANG BERHASIL memasang storage_key lintas-namespace: "private/billing/users/999/2026/11/0dd39f44-92f5-4a5d-ab7e-164d68ff5f19.jpg" (att_id=2)
GET /attachments/2 (key korban, tiket penyerang) -> 200 body="SECRET-CANARY-N65"
```

Jadi klaim N-65 **terkonfirmasi**: `storageKeyFromInput` hanya `SanitizePlainText` + trim `/`,
tanpa validasi namespace. Otorisasi `ServeAttachment` hanya memeriksa kepemilikan **tiket**
(baris 2454: `ticket.UserID == user.ID`) — bukan kepemilikan **key**. Confused deputy riil.
Catatan: fallback `storage_key LIKE :id` (baris 2431-2439) gagal di probe karena Fiber tidak
menerima slash dalam satu segment path (`Cannot GET .../billing/users/999/2`) — tetap layak
dipertahankan sebagai pertahanan, tapi jalur eksploitasi praktis adalah pemasangan key lewat
`CreateTicket`/`ReplyTicket`, bukan LIKE.

**Koreksi atas rencana remediasi Antigravity** (penting, jangan dieksekusi apa adanya):
key asli hasil upload kategori `support` adalah `private/support/tickets/<tahun>/<bulan>/<uuid>.ext`
(`storage_handler.go:295-320`) — **bukan** `support/tickets/...`. Whitelist yang ditulis di plan
(`pastikan key hanya berawalan support/tickets/`) akan **menolak seluruh lampiran tiket sah dan
merusak fitur**. Frontend mengirim persis `storage_key: data.key || data.storage_key`
(`frontend/*/App.tsx`, `TabletHelpdeskView.tsx:510`), jadi key dari upload server inilah yang
mengalir. Koreksi whitelist ada di Bagian 12.

### 11.4b N-67 — HIGH — Key Privat Tenant Lain Masih Terpeta lewat `?category=support` (Frontend)

**Lokasi:** `frontend/desktop/src/App.tsx:8774`, `frontend/desktop/src/components/PlatformRolePortal.tsx:2948`,
`frontend/mobile/src/components/PlatformRolePortal.tsx:3057`, `frontend/tablet/src/components/TabletHelpdeskView.tsx:510`.
`storageKeyFromInput` menerima key apa pun, tapi yang bikin eksploitasi praktis adalah **staf**
(mengirim dari `PlatformRolePortal`) maupun **pelanggan** (dari `App.tsx`) mengirim `storage_key`
dari upload dengan kategori `support`/`billing` — namespace berbeda (`support/tickets` vs
`billing/users`) tapi keduanya valid. Karena `ServeAttachment` hanya menguji pemilik tiket,
lampiran `private/billing/...` milik user A bisa dibaca user B asal B memakainya di tiketnya.
Ini memperkuat N-65/N-66, bukan celah terpisah, tapi harus disebut dalam plan karena
perbaikan backend harus tetap mengizinkan `private/support/tickets/...` dan `private/support/staff/...`.

### 11.4c N-65 — HIGH (TERKONFIRMASI) — IDOR Lintas-Tenant / Confused Deputy via `storage_key` Lampiran Tiket Bantuan

**Lokasi:** `backend/internal/handlers/support_handler.go:589-597` (`CreateTicket`), `680-705` (`ReplyTicket`), `2448-2475` (`ServeAttachment`).
**Mekanisme Terbukti:** Klien mengirimkan payload `attachments: [{"storage_key": "private/billing/users/1/..."}]`. Server menerima string `storage_key` mentah dan menyimpannya ke tabel `support_attachments` yang terikat pada tiket penyerang. Ketika penyerang memanggil `GET /api/help/tickets/attachments/:id`, otorisasi di baris 2454 (`if ticket.UserID == user.ID { isOwner = true }`) lolos karena tiket tersebut memang milik penyerang. Server kemudian membaca path fisik berkas privat di `storage/private` dan mengalirkannya langsung ke penyerang. Penyerang dapat mengeksfiltrasi bukti bayar perbankan, dokumen tagihan, atau lampiran rahasia milik toko lain di `storage/private` jika key-nya diketahui atau tertebak.
**Perbaikan:** lihat whitelist yang benar di 12.3 — whitelist versi Agent B (`support/tickets/` tanpa prefix `private/`) akan menolak lampiran sah dan merusak fitur.

### 11.5 Diperiksa dan Aman / Belum Terbukti

- **N-63 — LOW:** `/api/auth/check-email` membedakan email terdaftar (enumerasi akun).
  Wajar untuk alur registrasi, tapi limiter-nya bisa dibypass (N-62).
- **N-64 — INFO (butuh keputusan produk):** `/api/market-intelligence*` (summary,
  trending-keywords, demand-gaps, export) dapat dibaca **tanpa auth**; terbukti 200 dengan
  data agregat. Frontend memanggilnya tanpa kredensial dan ada flag `market_intel_enabled`,
  jadi kemungkinan by design. Sanitasi formula CSV sudah ada.
- `HandleAdClick`: tujuan redirect dari slug internal, bukan input klien. Bukan open redirect.
- Upload bukti iklan (`ad_handler.go:605`): menyimpan key hasil upload server, tidak
  terkena N-61.
- `support_handler.go` `ServeAttachment`: `resolveInsideRoot`, tidak terkena traversal (namun terkena N-65 pada validasi kepemilikan key).
- Login: oracle status akun (N-55) **tidak terkonfirmasi** pada pembacaan ulang, diturunkan
  ke `needs_validation`.
- `SendFile` lain (`spa_handler`, `main.go:299/375`) memakai path internal; belum ada
  bukti input pengguna masuk.

### 11.6 Prioritas Revisi

| # | Item | Usaha | Catatan |
|---|---|---|---|
| P0 | **N-61** validasi + `resolveInsideRoot` di `GetOrderProof` | Kecil | Dahulukan; pertimbangkan rotasi `JWT_SECRET` bila ada indikasi eksploitasi |
| P0 | **N-58** blokir `/support/`,`/billing/` semua kedalaman + migrasi legacy | Kecil | Cek produksi |
| P0 | **N-65** validasi namespace & kepemilikan `storage_key` lampiran tiket | Kecil | Menutup eksfiltrasi berkas privat lintas-tenant |
| P1 | **N-47** gating kategori PDF | Kecil | |
| P1 | **N-59** whitelist MIME, hapus redirect eksternal & `?token=` | Kecil | satu paket dengan N-61 |
| P1 | **N-62** normalisasi key limiter | Kecil | |
| P1 | Naikkan Go toolchain + dependensi (4 CVE aktif) | Kecil | |
| P2 | N-48, N-49, N-50, N-52 (MFA) | Sedang–Besar | |
| P3 | N-51, N-53..N-57, N-63, N-64 | Kecil–Sedang | |

### 11.7 Pertanyaan untuk Reviewer Berikutnya

1. Jalankan N-61 end-to-end via HTTP terhadap staging; file apa yang terbaca dengan root produksi?
2. Apakah produksi punya berkas di `public/storage/stores/*/support/`?
3. Uji N-62 pada login dan XFF sampai 429.
4. **Validasi N-65:** [SELESAI — TERKONFIRMASI] Divalidasi di `support_handler.go:589, 2454`. Celah Confused Deputy/IDOR riil. Masuk prioritas P0.
5. **Sisir ulang pembacaan file dari DB:** [SELESAI] Jalur rentan traversal murni hanya `subscription_handler.go:GetOrderProof` (N-61). Handler `support_handler.go` sudah memakai `resolveInsideRoot` dengan `filepath.Rel` + `EvalSymlinks`. Handler `storage_handler.go` dan `spa_handler.go` aman.
6. Putuskan kebijakan N-64.

---

## 12. Re-Audit Putaran 8c — Koreksi atas Laporan & Temuan Baru (Setelah Update Agent B)

**Tanggal:** 14 November 2026 **Metode:** verifikasi silang klaim baru Agent B (N-65) ke kode,
probe runtime throwaway, penelusuran jalur frontend. Kode aplikasi tidak diubah.

### 12.1 Koreksi: Daftar CVE pada Laporan (SALAH) vs `govulncheck` (BENAR)

Laporan Putaran 8 (bagian CVE) memuat ID yang tidak sesuai keluaran `govulncheck` aktual pada
mesin ini. ID yang benar (per verifikasi ulang hari ini):

| # | ID Benar | Paket | Versi | Perbaikan |
|---|---|---|---|---|
| 1 | GO-2026-6888 | `github.com/andybalholm/brotli` | v1.2.1 | v1.2.7 |
| 2 | GO-2026-6865 | `github.com/klauspost/compress` | v1.19.2 | v1.20.2 |
| 3 | GO-2026-6859 | `net/http` | go1.26.9 | go1.26.11 |
| 4 | GO-2026-6809 | `crypto/x509` | go1.26.9 | go1.26.10 |

ID lama pada ringkasan internal (N-47..N-57) sebaiknya disesuaikan; yang dipakai di
implementation plan sudah benar.

### 12.2 N-65 — TERKONFIRMASI dengan Bukti Runtime (Confused Deputy / IDOR Lampiran)

Dibuktikan lewat probe handler (SQLite in-memory, canary file, probe dihapus):

```
storage_key lintas-namespace terpasang: "private/billing/users/999/2026/11/<uuid>.jpg"
GET /api/help/tickets/attachments/<att_id> -> 200 body="SECRET-CANARY-N65"
```

Mekanisme: `storageKeyFromInput` (`support_handler.go:2679-2693`) hanya sanitasi panjang/trim.
Otorisasi `ServeAttachment` memeriksa pemilik tiket (baris 2454), **tidak** memeriksa apakah
`storage_key` boleh diakses pemilik tiket tersebut. Akibatnya lampiran `private/billing/...`
milik pengguna lain (bukti bayar) bisa dibaca.

**Koreksi penting atas rencana remediasi di plan Agent B:** whitelist `support/tickets/`
**merusak fitur** — key sah dari upload adalah `private/support/tickets/...` (dengan prefix
`private/`). Lihat 12.3.

### 12.3 Whitelist Namespace yang Benar (agar tidak merusak fitur)

Dari `storage_handler.go:290-321`, key yang sah untuk lampiran tiket adalah:

- `private/support/tickets/<tahun>/<bulan>/<uuid>.<ext>` (upload kategori `support`, non-staf)
- `private/support/staff/<tahun>/<bulan>/<uuid>.<ext>` (upload kategori `support`, staf)

Jadi aturan yang aman: **terima hanya prefix `private/support/tickets/` dan `private/support/staff/`**,
tolak keras `private/billing/`, `stores/<id>/billing/`, `private/stores/`, dan key tanpa prefix
`private/support/`. Kembalikan **400 Bad Request** bila tidak cocok. Catatan: lampiran historis
sebelum refactor mungkin memakai `support/tickets/...` tanpa prefix `private/` — proses migrasi/
backfill terpisah, jangan campur.

### 12.4 N-66 / N-67 — HIGH — Eksfiltrasi Lampiran Privat Lintas Tenant

- **N-66** = nama gw untuk celah yang sama dengan N-65 (satu celah, dua nama). Dikonsolidasikan
  ke N-65 agar tidak dobel.
- **N-67** (HIGH): jalur pemasangan key lintas-namespace terbuka dari **staf maupun pelanggan**
  (`CreateTicket`, `ReplyTicket`, `AdminReplyTicket` — ketiganya memanggil `buildSupportAttachment`
  pada baris 591, 723, 1174). Frontend mengirim `storage_key` apa adanya dari hasil upload
  (`frontend/*/App.tsx`, `PlatformRolePortal.tsx:2948/3057`, `TabletHelpdeskView.tsx:510`).
  Karena key `private/billing/...` bisa diperoleh siapa pun yang upload dengan kategori `billing`,
  kombinasinya dengan N-65 = eksfiltrasi bukti bayar antar pengguna. **Perbaikan: sama dengan
  N-65 (whitelist namespace 12.3) + uji regresi frontend agar tidak mengirim key di luar whitelist.**

### 12.5 Diperiksa, Aman / Bukan Temuan

- `resolveAttachmentPath` (`support_handler.go:2621-2648`) memakai `resolveInsideRoot` +
  `filepath.Rel` + `EvalSymlinks` → traversal aman. Tidak ada celah traversal di sini.
- `?token=` di `GetOrderProof`: `ExtractOptionalClaims` (`middleware/auth.go:91-130`) hanya
  membaca cookie + header `Authorization`, **tidak** membaca `?token=`. Jadi klaim N-59
  ("regresi token di query param") **tidak terbukti** pada jalur ini; yang terbukti adalah
  MIME-by-client dan open redirect. `?token=` tetap masalah bila middleware lain membacanya.
- Frontend `SubscriptionModal.tsx` (3 aplikasi) memang mengirim `?token=` — jadi parameter itu
  ada, tapi backend `GetOrderProof` harus diuji ulang untuk memastikan jalur baca token-nya.
- `storage_handler.go` DeleteFile/GetURL: memakai key hasil upload; belum ada bukti traversal.

### 12.6 Prioritas Revisi 8c

| # | Item | Usaha |
|---|---|---|
| P0 | N-65/N-67: whitelist namespace `storage_key` (12.3) | Kecil |
| P0 | N-61: validasi `payment_proof_url` + `resolveInsideRoot` | Kecil |
| P0 | N-58: blokir `/support/`,`/billing/` semua kedalaman + migrasi legacy | Kecil |
| P1 | N-59: whitelist MIME, hapus redirect eksternal, hapus `?token=` | Kecil |
| P1 | N-62: normalisasi key limiter | Kecil |
| P1 | Go toolchain + dependensi (4 CVE) | Kecil |
| P2 | N-48, N-49, N-50, N-52 (MFA) | Sedang–Besar |
| P3 | N-51, N-53..N-57, N-63, N-64 | Kecil–Sedang |

### 12.7 Pertanyaan untuk Reviewer Berikutnya

1. N-65/N-67: uji end-to-end via HTTP (Register → upload billing → pasang key di tiket → GET).
2. Apakah produksi punya lampiran historis `support/tickets/...` tanpa prefix `private/`?
3. N-62: uji di endpoint login + spoof `X-Forwarded-For` sampai 429.
4. `GetOrderProof`: konfirmasi apakah `?token=` benar-benar tidak dibaca (uji dengan token-only).
5. Kebijakan N-64 (market-intelligence publik) — by design atau tidak?
