# Implementation Plan — Remediasi Temuan Audit Keamanan Fase 1 (P1 & Quick Wins) [REVISI FINAL LULUS REVIEW]

**Tanggal Penyusunan:** 15 November 2026  
**Referensi Audit:**  
- `security-audit/audit-putaran-8-zero-change-2026-11-14.md` (Revisi 3 & 8c)  
- `security-audit/catatan-review-fase0-untuk-antigravity-2026-11-14.md` (Putaran 2, 3, dan Putaran 4 Bagian 8.2)  
- `security-audit/catatan-review-plan-fase1-2026-11-15.md` (Hasil Review Independen Fase 1 — Seluruh Koreksi Telah Diintegrasikan ke Dokumen Ini)  
- `security-audit/implementation-plan-putaran-8-2026-11-14.md` (Roadmap Induk)  
**Baseline Commit:** `662c85c` (`fix(security): remediate Fase 0 findings and review iterations`)  
**Status Dokumen:** ✅ **SELESAI DIEKSEKUSI & TERVERIFIKASI 100% (15 November 2026)**  

---

## 1. Ringkasan Eksekutif & Ruang Lingkup Fase 1

Fase 1 berfokus pada **Quick Wins Keamanan, Patch CVE Dependensi & Toolchain Go, Penutupan Celah HIGH PDF (`N-47`), Pengetatan Header CSP (`N-50`) & HSTS (`N-51`), Pembersihan Route Duplikat (`N-57`), serta 2 Catatan Hardening LOW Hasil Putaran 4 (`R4-L1` & `R4-L2`)**.

Seluruh item dirancang dengan prinsip **Zero Regression** terhadap sistem live di port `8000` (`/healthz = 200`, dilarang dimatikan/diganggu) dan tidak membutuhkan migrasi skema database (`DB_AUTO_MIGRATE=false`, `SKIP_DB_MIGRATE=true`).

### 1.1 Daftar Item yang Diremediasi pada Fase 1

| No | Kode Temuan | Severity | Lokasi File Aktual | Ringkasan Remediasi Terverifikasi |
|---|---|---|---|---|
| 1 | **N-47** | 🔴 **HIGH** | `backend/internal/handlers/storage_handler.go`<br>`backend/internal/handlers/support_handler.go`<br>`backend/cmd/server/main.go` | Gating kategori unggah PDF **hanya untuk `support`** (bukan `billing`, karena `GetOrderProof` & `ValidatePaymentProofURL` hanya menerima gambar), tolak kategori lain dengan `415`, paksa namespace `private/`, dan pasang `Content-Disposition: attachment` + `Content-Security-Policy: sandbox; default-src 'none'` pada seluruh penyajian PDF (`main.go` & `support_handler.go`). |
| 2 | **4 CVE Go** | 🔴 **HIGH / MED** | `backend/go.mod`<br>`backend/go.sum` | Naikkan direktif Go di `go.mod` ke `go 1.26.11` (`GOTOOLCHAIN=auto` untuk menutup `GO-2026-6859` & `GO-2026-6809` pada binary hasil kompilasi), serta upgrade `andybalholm/brotli` ke `v1.2.8+` (`GO-2026-6888`) dan `klauspost/compress` ke `v1.20.4+` (`GO-2026-6865`). |
| 3 | **N-50** | 🟠 **MEDIUM** | `backend/internal/middleware/security.go`<br>`backend/internal/middleware/security_test.go` | Cabut wildcard `http:` dari `img-src` dan wildcard penuh `https: http:` dari `connect-src` di non-local; whitelist eksplisit `https://api.qrserver.com` (fitur Download PNG QR), Google OAuth (`https://www.googleapis.com`), GA4, AdSense (`*.adtrafficquality.google`, `*.googletrafficquality.google`), serta origin valid dari `cfg.AllowedOrigins`, `cfg.AppURL`, & `cfg.StoragePublicURL`. |
| 4 | **N-51** | 🟡 **LOW-MED** | `backend/internal/config/config.go`<br>`backend/internal/middleware/security.go`<br>`backend/internal/middleware/security_test.go` | Kendalikan direktif `includeSubDomains` (`HSTS_INCLUDE_SUBDOMAINS`, default `true`) dan `preload` (`HSTS_PRELOAD`, default `false`, hanya aktif jika `includeSubDomains` juga `true`) pada header HSTS. |
| 5 | **N-57** | ⚪ **LOW (Info)** | `backend/cmd/server/main.go` | Hapus alias route ganda `api.Post("/api/telemetry/search", ...)` di baris `442` (terbukti 0 pemanggil di ke-3 frontend); uji secara runtime via router test (tanpa tes baca teks statis). |
| 6 | **R4-L1** | 🟡 **LOW (Defensif)** | `frontend/desktop/src/components/DocumentPreviewModal.tsx`<br>`frontend/tablet/src/components/DocumentPreviewModal.tsx`<br>`frontend/mobile/src/components/DocumentPreviewModal.tsx` | Perketat `isSameOriginUrl` (baris ~25–36 di ke-3 file) menggunakan parser WHATWG `new URL(trimmed, baseOrigin)` dengan penolakan eksplisit `//`, `/\`, `\`, `data:`, `blob:`, skema non-`http(s):`, dan `origin === 'null'`. Patch terarah per file + Tri-Build ke `public/{desktop,tablet,mobile}/`. |
| 7 | **R4-L2** | 🟡 **LOW (Integritas)** | `backend/internal/handlers/auth_handler.go` | Pindahkan perhitungan paket, cek maintenance pembayaran, dan validasi `req.PaymentProofURL` ke **sebelum konsumsi OTP (`ValidateAndConsumeToken` di baris `702`)** dan sebelum `h.db.Create(&newUser)` (baris `734`), plus kompensasi rollback `newUser` jika `h.db.Create(&newStore)` gagal agar tidak menyisakan *orphan user* maupun menghanguskan token verifikasi email. |

---

## 2. Spesifikasi Teknis Terperinci per Item (Wajib Diikuti Persis)

### 2.1 [N-47 — HIGH] Gating Kategori Upload PDF & Sandboxing Seluruh Jalur Penyajian PDF

#### A. Kondisi Kode Aktual & Temuan Review:
1. Di `backend/internal/handlers/storage_handler.go:154-166`, berkas `%PDF-` diizinkan di kategori apa pun (termasuk `products`), sementara pemetaan `storage.PrivateKeyPrefix` (`private/`) di baris `322` hanya berlaku untuk `support` dan `billing`.
2. **Kenapa `billing` TIDAK BOLEH menerima PDF:** Sejak Fase 0 (`N-59` & `N-61`), `ValidatePaymentProofURL` (`sanitizer.go:549-552`) hanya mengizinkan ekstensi `.jpg/.jpeg/.png/.webp` dan `GetOrderProof` (`subscription_handler.go:634-643`) menolak `application/pdf` dengan HTTP `415`. Mengizinkan upload PDF di `category=billing` akan membuat alur buntu (upload `200`, tapi gagal dipakai/dibuka admin dengan `415`). Hanya modul tiket bantuan (`category == "support"`) yang menggunakan PDF via `DocumentPreviewModal.tsx` (dirender aman ke `<canvas>` lewat PDF.js).
3. **Jalur penyajian `/storage/*` & `/api/support/attachments/:id`:**
   - Di `backend/cmd/server/main.go:256-312`, saat `storageService != nil` (mode normal produksi & lokal), route publik `/storage/*` dilayani oleh closure `app.Get("/storage/*", ...)` yang memiliki **2 cabang**: cabang Cloud Storage (`:275-285`) dan cabang Disk Lokal (`:288-309`), sedangkan `else` di `:313-321` adalah fallback `app.Static("/storage", ...)`.
   - Di `backend/internal/handlers/support_handler.go:2624-2639` (`ServeAttachment`), PDF saat ini masih dikirim dengan `Content-Disposition: inline` tanpa header `Content-Security-Policy: sandbox`! Padahal `DocumentPreviewModal.tsx` mengambil PDF via `fetch()` → `arrayBuffer()` → PDF.js canvas (tidak peduli `inline` vs `attachment`), namun jika user membuka URL `/api/support/attachments/:id` langsung di tab browser baru, `inline` tanpa sandbox akan mengeksekusi PDF viewer bawaan browser di origin aplikasi.

#### B. Implementasi Wajib:
1. **`backend/internal/handlers/storage_handler.go` (sekitar baris 154–179 & 322):**
   - Batasi unggahan PDF **hanya untuk `category == "support"`** dan pastikan `uploadSize` tercatat akurat (`buf = bytes.NewBuffer(fileBytes)` lalu `uploadSize := int64(buf.Len())` — perhatikan bagaimana `uploadSize` dihitung di baris ~265 agar ukuran PDF tidak `0`!):
     ```go
     isPDF := bytes.HasPrefix(fileBytes, []byte("%PDF-")) || strings.EqualFold(filepath.Ext(file.Filename), ".pdf")
     if isPDF {
         if !bytes.HasPrefix(fileBytes, []byte("%PDF-")) {
             return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
                 "success": false,
                 "message": "File PDF tidak valid atau rusak (header signature tidak cocok).",
             })
         }
         // SECURITY (N-47): Dokumen PDF hanya diizinkan pada kategori privat tiket bantuan (support).
         if category != "support" {
             return c.Status(fiber.StatusUnsupportedMediaType).JSON(fiber.Map{
                 "success": false,
                 "message": "Dokumen PDF hanya diizinkan untuk lampiran tiket bantuan.",
             })
         }
         contentType = "application/pdf"
         ext = ".pdf"
         buf = bytes.NewBuffer(fileBytes)
     }
     ```
   - Perbarui juga pesan error non-image di baris `177` agar tidak menyesatkan untuk kategori non-`support` (ubah `"Hanya file gambar asli (JPG, PNG, WEBP, GIF) atau dokumen PDF yang diperbolehkan."` menjadi `"Format file tidak valid. Hanya file gambar asli (JPG, PNG, WEBP, GIF) yang diperbolehkan."`).
   - Di baris `322` (defense-in-depth):
     ```go
     if category == "support" || category == "billing" || isPDF {
         if !strings.HasPrefix(objectKey, storage.PrivateKeyPrefix) {
             objectKey = storage.PrivateKeyPrefix + objectKey
         }
     }
     ```
2. **`backend/cmd/server/main.go` (sekitar baris 275–310 pada `app.Get("/storage/*", ...)`):**
   - Untuk berkas historis `.pdf` yang mungkin sudah terlanjur ada di pohon publik lama, baik pada cabang Cloud Storage (`:279-284`, cek `strings.EqualFold(filepath.Ext(cleanKey), ".pdf") || strings.EqualFold(contentType, "application/pdf")`) maupun cabang Disk Lokal (`:302-307`, `case ".pdf":`), paksa header anti-eksekusi:
     ```go
     safeBase := strings.ReplaceAll(filepath.Base(cleanKey), `"`, `_`)
     c.Set("Content-Type", "application/pdf")
     c.Set("Content-Disposition", `attachment; filename="`+safeBase+`"`)
     c.Set("Content-Security-Policy", "sandbox; default-src 'none'")
     c.Set("X-Content-Type-Options", "nosniff")
     ```
3. **`backend/internal/handlers/support_handler.go` (sekitar baris 2624–2639 pada `ServeAttachment`):**
   - Untuk lampiran PDF (`lowerType == "application/pdf"` atau `strings.EqualFold(filepath.Ext(safeFileName), ".pdf")`), paksa `dispositionType = "attachment"` (preview in-app `DocumentPreviewModal` menggunakan `fetch()` + PDF.js sehingga tetap jalan 100% tanpa regresi!) **DAN** tambahkan header `c.Set("Content-Security-Policy", "sandbox; default-src 'none'")`.

---

### 2.2 [4 CVE Go] Upgrade Toolchain `go 1.26.11` & Dependensi Kompresi (`brotli`, `compress`)

#### A. Kondisi Aktual Mesin & `go.mod`:
- Host lokal saat ini memiliki binary `go1.26.9` di PATH, sedangkan `backend/go.mod` masih mendeklarasikan `go 1.25.0`.
- Jika `go.mod` tidak dinaikkan ke `go 1.26.11`, perintah `go build` di host `go1.26.9` akan tetap menghasilkan binary dengan stdlib `go1.26.9` yang masih rentan `GO-2026-6859` (`net/http`, fix `go1.26.11`) dan `GO-2026-6809` (`crypto/x509`, fix `go1.26.10`). Dengan menaikkan direktif `go 1.26.11` di `backend/go.mod` dan memastikan `GOTOOLCHAIN=auto`, Go otomatis mengunduh dan mengompilasi binary menggunakan toolchain `go1.26.11`.

#### B. Perintah Eksekusi Wajib (di Git Bash / Terminal):
```bash
cd backend
GOTOOLCHAIN=auto go mod edit -go=1.26.11
GOTOOLCHAIN=auto go get github.com/andybalholm/brotli@v1.2.8
GOTOOLCHAIN=auto go get github.com/klauspost/compress@v1.20.4
GOTOOLCHAIN=auto go mod tidy
```
- Verifikasi wajib mencakup **dua bukti**:
  1. `GOTOOLCHAIN=auto go run golang.org/x/vuln/cmd/govulncheck@latest ./...` → wajib mencetak **`No vulnerabilities found.`**
  2. Build binary uji ke `$LOCALAPPDATA/Temp/catavor-fase1-check.exe`, jalankan `go version -m "$LOCALAPPDATA/Temp/catavor-fase1-check.exe"` → baris pertama wajib menunjukkan **`go1.26.11`** (atau lebih baru), `github.com/andybalholm/brotli v1.2.8`, dan `github.com/klauspost/compress v1.20.4`, lalu hapus binary sementara tersebut.

---

### 2.3 [N-50 — MEDIUM] Pengetatan Content-Security-Policy (`img-src` & `connect-src`) Tanpa Regresi Fitur

#### A. Kondisi Kode Aktual & Daftar Koneksi Klien yang Wajib Dijaga:
Di `backend/internal/middleware/security.go:31-65` (di dalam `SetupSecurityMiddlewares(app *fiber.App, cfg *config.Config)`), CSP saat ini memakai `img-src 'self' data: blob: https: http:;` dan `connect-src 'self' https: http: ...`.  
Audit penuh atas `frontend/{desktop,tablet,mobile}/src/` membuktikan aplikasi melakukan `fetch()` / XHR browser langsung ke endpoint eksternal berikut (tunduk pada `connect-src`):
1. **Unduh PNG QR Code Katalog (`fetch(qrImageUrl)`):** `https://api.qrserver.com` (`desktop/src/App.tsx:3313`, `DesktopShareCatalogView.tsx:54`, `mobile`, `tablet`). **WAJIB ADA di `connect-src`!**
2. **Google OAuth UserInfo (`fetch('https://www.googleapis.com/oauth2/v3/userinfo')`):** `https://www.googleapis.com` & `https://accounts.google.com` (`App.tsx:12214`).
3. **Google Analytics 4 & Google AdSense:** `https://*.google.com`, `https://*.google-analytics.com`, `https://*.analytics.google.com`, `https://*.googletagmanager.com`, `https://*.googlesyndication.com`, `https://*.doubleclick.net`, `https://*.adtrafficquality.google`, `https://*.googletrafficquality.google`.
4. **Embed Sosial Media:** `https://*.tiktok.com`, `https://*.instagram.com`.
5. **Origin Dinamis Konfigurasi (`cfg.AllowedOrigins`, `cfg.AppURL`, dan `cfg.StoragePublicURL`):** Ketika `STORAGE_PUBLIC_URL` menunjuk ke bucket R2/S3/CDN eksternal, fitur unduh gambar QRIS (`DesktopCheckoutView.tsx:559`, `SubscriptionModal.tsx:864`) dan `DocumentPreviewModal.tsx` melakukan `fetch()` ke origin tersebut.

#### B. Implementasi Wajib di `backend/internal/middleware/security.go`:
1. Buat helper murni `extractCSPOrigin(raw string, allowHTTP bool) string` menggunakan `net/url.Parse`:
   - Tolak string kosong, wildcard `*`, atau karakter `;` / spasi agar tidak bisa menyuntikkan direktif CSP liar.
   - Hanya izinkan `u.Scheme == "https"` (atau `u.Scheme == "http"` jika `allowHTTP == true`) dan `u.Host != ""`.
   - Kembalikan `u.Scheme + "://" + u.Host`.
2. Bentuk `imgSrc` dan `connectSrc` berdasarkan environment (`isLocal := cfg.AppEnv == "local" || cfg.AppEnv == "development" || cfg.AppEnv == ""`):
   ```go
   imgSrc := "'self' data: blob: https:"
   connectSources := []string{
       "'self'",
       "https://api.qrserver.com",
       "https://www.googleapis.com",
       "https://accounts.google.com",
       "https://*.tiktok.com",
       "https://*.instagram.com",
       "https://*.google.com",
       "https://*.adtrafficquality.google",
       "https://*.googletrafficquality.google",
       "https://*.google-analytics.com",
       "https://*.analytics.google.com",
       "https://*.googletagmanager.com",
       "https://*.googlesyndication.com",
       "https://*.doubleclick.net",
   }

   seenOrigin := map[string]bool{}
   for _, s := range connectSources {
       seenOrigin[s] = true
   }
   addOrigin := func(raw string) {
       if orig := extractCSPOrigin(raw, isLocal); orig != "" && !seenOrigin[orig] {
           seenOrigin[orig] = true
           connectSources = append(connectSources, orig)
       }
   }

   addOrigin(cfg.AppURL)
   addOrigin(cfg.StoragePublicURL)
   for _, origin := range cfg.AllowedOrigins {
       addOrigin(origin)
   }

   if isLocal {
       imgSrc += " http:"
       for _, devSrc := range []string{
           "http://localhost:*",
           "http://127.0.0.1:*",
           "ws://localhost:*",
           "ws://127.0.0.1:*",
       } {
           if !seenOrigin[devSrc] {
               seenOrigin[devSrc] = true
               connectSources = append(connectSources, devSrc)
           }
       }
   }
   connectSrc := strings.Join(connectSources, " ")
   ```
3. Rangkai `img-src ` + `imgSrc` + `; ` dan `connect-src ` + `connectSrc` + `; ` ke dalam header `Content-Security-Policy` di `SetupSecurityMiddlewares`.

---

### 2.4 [N-51 — MEDIUM] Pengendalian Flag `preload` & `includeSubDomains` pada HSTS

#### A. Implementasi Wajib:
1. **`backend/internal/config/config.go`:**
   Tambahkan 2 field boolean pada struct `Config`:
   ```go
   HSTSIncludeSubDomains bool
   HSTSPreload           bool
   ```
   Di `LoadConfig()`:
   ```go
   hstsIncludeSub := !strings.EqualFold(strings.TrimSpace(getEnv("HSTS_INCLUDE_SUBDOMAINS", "true")), "false")
   hstsPreload := strings.EqualFold(strings.TrimSpace(getEnv("HSTS_PRELOAD", "false")), "true")
   ```
   (Default: `HSTSIncludeSubDomains = true`, `HSTSPreload = false`. Perbarui juga `newTestApp` di `backend/internal/middleware/security_test.go:27` agar mengisi `HSTSIncludeSubDomains: true` sebagai default yang setara `LoadConfig()`, sehingga `TestHSTSOnlyOverHTTPS` di baris `183` tetap selaras!)
2. **`backend/internal/middleware/security.go` (baris 60–62):**
   Sesuai spesifikasi RFC 6797 & HSTS Preload List, direktif `preload` **hanya sah** bila `includeSubDomains` juga aktif:
   ```go
   if c.Secure() {
       hstsVal := "max-age=31536000"
       if cfg.HSTSIncludeSubDomains {
           hstsVal += "; includeSubDomains"
           if cfg.HSTSPreload {
               hstsVal += "; preload"
           }
       }
       c.Set("Strict-Transport-Security", hstsVal)
   }
   ```

---

### 2.5 [N-57 — LOW] Penghapusan Alias Route Ganda `/api/api/telemetry/search`

#### A. Implementasi Wajib:
1. Di `backend/cmd/server/main.go:442`, hapus baris:
   ```go
   api.Post("/api/telemetry/search", middleware.TelemetryRateLimiter(), analyticsHandler.TrackSearchEvent) // Defensive alias for double /api client prefix
   ```
   Pertahankan route kanonik di baris `441` (`api.Post("/telemetry/search", ...)`).
2. **CATATAN LARANGAN TES STATIS:** **JANGAN** membuat unit test yang membaca `main.go` pakai `os.ReadFile` + `strings.Contains`! Buat helper/test router runtime menggunakan `app.Test` yang menembak `POST /api/telemetry/search` (terdaftar / bukan `404` router) vs `POST /api/api/telemetry/search` (wajib `404 Not Found` atau tidak ter-mount ke handler telemetry).

---

### 2.6 [R4-L1 — LOW Hardening] Standardisasi WHATWG Parser pada `isSameOriginUrl` di 3 SPA

#### A. Lokasi File Aktual (Wajib Patch Terarah per File — DILARANG Copy-Overwrite Seluruh File!):
Ketiga file `DocumentPreviewModal.tsx` memiliki jumlah baris dan UI yang berbeda:
- `frontend/desktop/src/components/DocumentPreviewModal.tsx` (1.194 baris — `isSameOriginUrl` di baris **27–36**)
- `frontend/tablet/src/components/DocumentPreviewModal.tsx` (1.198 baris — `isSameOriginUrl` di baris **25–34**)
- `frontend/mobile/src/components/DocumentPreviewModal.tsx` (1.192 baris — `isSameOriginUrl` di baris **25–34**)

#### B. Implementasi Wajib di Masing-Masing dari 3 File:
Ganti fungsi `isSameOriginUrl` menjadi:
```ts
const isSameOriginUrl = (url?: string): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  if (
    !trimmed ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/\\') ||
    trimmed.startsWith('\\') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return false;
  }
  try {
    const baseOrigin = window.location.origin;
    if (!baseOrigin || baseOrigin === 'null') return false;
    const parsed = new URL(trimmed, baseOrigin);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.origin === baseOrigin
    );
  } catch {
    return false;
  }
};
```
Pastikan juga pada 3 pemanggilan `fetch(targetUrl, ...)` di masing-masing file (`docId`, `fileUrl`, dan download), `credentials` hanya dikirim ke same-origin (`credentials: isSameOriginUrl(targetUrl) ? 'include' : 'omit'`) sehingga cookie sesi tidak ikut bocor maupun memicu CORS error ketika `fileUrl` mengarah ke CDN lintas-origin (`STORAGE_PUBLIC_URL`), sementara request same-origin `/api/support/attachments/:id` selalu mengirim `credentials: 'include'`.

---

### 2.7 [R4-L2 — LOW Hardening] Validasi Pre-Flight Pembayaran Sebelum Konsumsi OTP & Pencegahan Orphan User pada `Register`

#### A. Kondisi Kode Aktual di `backend/internal/handlers/auth_handler.go`:
- Baris `702`: `services.GetOTPService().ValidateAndConsumeToken(req.Email, req.VerificationToken, "registration")` menghanguskan token verifikasi email satu-kali-pakai.
- Baris `734`: `h.db.Create(&newUser)` menyimpan baris `User` ke database.
- Baris `851-892`: pengecekan `payment_system_mode == "maintenance"`, validasi `req.PaymentProofURL` (`data:image/...` + `security.ValidatePaymentProofURL`), dan pengecekan wajib bukti bayar `manual_qris` **baru dijalankan SETELAH token verifikasi dikonsumsi dan `newUser` terlanjur di-insert**!
- Akibatnya, bila calon merchant mengirim `payment_proof_url` tidak valid atau mendaftar paket berbayar saat gateway `maintenance`: (1) token verifikasi emailnya hangus, dan (2) baris `newUser` tertinggal yatim tanpa `Store` di database sehingga percobaan ulang ditolak `"Alamat email ini sudah terdaftar"`.

#### B. Implementasi Wajib di `backend/internal/handlers/auth_handler.go`:
1. **Pindahkan seluruh blok kalkulasi paket, harga/kupon, cek `payment_system_mode == "maintenance"`, dan validasi `req.PaymentProofURL` (yang saat ini ada di baris `748–892`) ke ATAS sebelum blok `if userFound { ... } else { ... }` (sekitar baris `665`, SEBELUM `ValidateAndConsumeToken` di baris `702` dan SEBELUM `h.db.Create(&newUser)` di baris `734`)!**
   - Dengan urutan ini, bila `payment_proof_url` tidak valid (`400 Bad Request`) atau gateway sedang `maintenance` (`503 Service Unavailable`), fungsi langsung berhenti **tanpa menghanguskan `verification_token` pengguna** dan **tanpa menulis satu baris pun ke tabel `users`**.
2. **Jaga Atomisitas Pembuatan `newUser` + `newStore`:**
   - Lacak flag boolean `createdNewUser := false` saat `h.db.Create(&newUser)` dieksekusi di cabang `else`.
   - Jika `h.db.Create(&newStore)` di baris `894` gagal (`err != nil`), dan `createdNewUser == true`, jalankan kompensasi bersih `h.db.Unscoped().Delete(&models.User{}, targetUser.ID)` sebelum mengembalikan `500 Gagal membuat profil toko` (atau bungkus `Create(&newUser)` + `Create(&newStore)` dalam satu `h.db.Transaction` singkat **setelah** seluruh validasi pre-flight & konsumsi OTP sukses).

---

## 3. Matriks Lengkap File yang Dimodifikasi

| File | Paket | Perubahan |
|---|---|---|
| `backend/go.mod` & `backend/go.sum` | CVE Go | `go 1.26.11`, `andybalholm/brotli v1.2.8+`, `klauspost/compress v1.20.4+` |
| `backend/internal/handlers/storage_handler.go` | N-47 | Batasi upload PDF hanya `category == "support"` (`415` untuk lainnya termasuk `billing`), paksa prefix `private/` |
| `backend/internal/handlers/storage_handler_test.go` | N-47 | Unit test HTTP nyata (`app.Test`) upload PDF ditolak di `products` & `billing` (`415`), diterima & privat di `support` (`200`) |
| `backend/internal/handlers/support_handler.go` | N-47 | Paksa `Content-Disposition: attachment` + `Content-Security-Policy: sandbox; default-src 'none'` saat menyajikan PDF di `ServeAttachment` |
| `backend/cmd/server/main.go` | N-47, N-57 | Sandbox + attachment header untuk fallback `.pdf` di `/storage/*`; hapus route duplikat `/api/api/telemetry/search` di baris `442` |
| `backend/internal/config/config.go` | N-51 | Tambah `HSTSIncludeSubDomains` (default `true`) & `HSTSPreload` (default `false`) |
| `backend/internal/middleware/security.go` | N-50, N-51 | Helper `extractCSPOrigin`, perketat `img-src` & `connect-src` per `AppEnv` (termasuk `api.qrserver.com`, `googleapis.com`, `StoragePublicURL`, `AllowedOrigins`), kondisionalkan HSTS |
| `backend/internal/middleware/security_test.go` | N-50, N-51 | Update `newTestApp` + tambah test runtime CSP (`production` vs `local`, `AllowedOrigins`, `StoragePublicURL`, `api.qrserver.com`) & variasi HSTS (`preload` on/off, `includeSubDomains` off) |
| `backend/internal/handlers/auth_handler.go` | R4-L2 | Pindahkan validasi paket/maintenance/`PaymentProofURL` ke sebelum konsumsi OTP & `Create(&newUser)`; cegah orphan user jika `Create(&newStore)` gagal |
| `backend/internal/handlers/auth_handler_test.go` | R4-L2 | Unit test runtime `POST /api/register` dengan `payment_proof_url` tidak valid → `400`, `COUNT(users) == 0`, dan token OTP belum terpakai |
| `frontend/desktop/src/components/DocumentPreviewModal.tsx` | R4-L1 | Perketat `isSameOriginUrl` + scoping `credentials` |
| `frontend/tablet/src/components/DocumentPreviewModal.tsx` | R4-L1 | Perketat `isSameOriginUrl` + scoping `credentials` |
| `frontend/mobile/src/components/DocumentPreviewModal.tsx` | R4-L1 | Perketat `isSameOriginUrl` + scoping `credentials` |
| `public/{desktop,tablet,mobile}/` | R4-L1 | Hasil `npm run build` dari ketiga SPA (menggunakan Node 22 via fnm) |

---

## 4. Aturan Ketat Eksekusi & Standar Bukti Runtime (Mandatory Gate)

1. **DILARANG KERAS Tes Statis Semu:** Tidak boleh ada satu pun test baru yang menggunakan `os.ReadFile("...go")` + `strings.Contains`. Semua pengujian backend wajib menjalankan request HTTP nyata via `app.Test(...)` dan query database uji.
2. **Proteksi Kredensial & Server Produksi Port 8000:**
   - Jangan pernah mencetak atau menyalin isi secret dari `backend/.env` ke log/laporan.
   - Jangan mematikan server produksi yang sedang jalan di `http://127.0.0.1:8000` (`/healthz` wajib tetap `200`). Jika melakukan smoke test binary baru, jalankan sementara di port lain (mis. `PORT=8001 SKIP_DB_MIGRATE=true DB_AUTO_MIGRATE=false`), uji endpointnya, lalu matikan proses port `8001` dan hapus binary sementara.
3. **Node Toolchain untuk Tri-Build Frontend:**
   - Pastikan memakai **Node 22.13+** (aktif melalui fnm shim `%LOCALAPPDATA%\fnm_multishells` / `fnm exec --using=v22.13.1`), jangan Node 20 bawaan Laragon agar optional native dependency bundler tidak gagal.
   - Jalankan `npx tsc --noEmit` dan `npm run build` pada `frontend/desktop`, `frontend/tablet`, dan `frontend/mobile` hingga `0 error` dan bundel `public/{desktop,tablet,mobile}/` terbarui.
4. **Checklist Bukti yang Wajib Dilaporkan Setelah Selesai:**
   - Output `GOTOOLCHAIN=auto go test ./...` lulus 100% di seluruh paket `backend/`.
   - Output `GOTOOLCHAIN=auto go run golang.org/x/vuln/cmd/govulncheck@latest ./...` = `No vulnerabilities found.` + output `go version -m` pada binary uji yang membuktikan Go stdlib `go1.26.11`.
   - Output `npx tsc --noEmit` & `npm run build` sukses di ke-3 frontend.
   - Bukti `GET http://127.0.0.1:8000/healthz` tetap `200`.

---

## 5. Laporan Hasil Eksekusi & Bukti Runtime Fase 1 (15 November 2026)

### 5.1 Status Ringkasan Eksekusi per Item

| No | Kode Temuan | Status Eksekusi | Ringkasan Bukti Runtime |
|---|---|---|---|
| 1 | **N-47** | ✅ **SELESAI** | PDF hanya diterima untuk `category=support` (`200 OK`, `storage_key` namespace `private/`). Kategori produk & billing ditolak `415 Unsupported Media Type` (`storage_handler_test.go:TestPDFUploadGating_N47`). Seluruh penyajian PDF dipaksa `Content-Disposition: attachment` + `Content-Security-Policy: sandbox; default-src 'none'` (`support_handler_test.go:TestSupportServeAttachment_SQLite`). |
| 2 | **4 CVE Go** | ✅ **SELESAI** | `backend/go.mod` dinaikkan ke `go 1.26.11` + `toolchain go1.26.11` via `GOTOOLCHAIN=auto`. `andybalholm/brotli` di-upgrade ke `v1.2.8` (`GO-2026-6888`), `klauspost/compress` ke `v1.20.4` (`GO-2026-6865`). Binary uji membuktikan stdlib `go1.26.11` (`GO-2026-6859` & `GO-2026-6809` tertutup). `govulncheck ./...` menghasilkan 0 affected vulnerabilities. |
| 3 | **N-50** | ✅ **SELESAI** | Wildcard `http:` dicabut dari `img-src` dan wildcard mentah `https: http:` dicabut dari `connect-src` di non-local. Whitelist eksplisit `https://api.qrserver.com`, Google OAuth, GA4, AdSense, `cfg.AllowedOrigins`, `cfg.AppURL`, dan `cfg.StoragePublicURL` (`security_test.go:TestCSPTightening_ProductionVsLocal`). |
| 4 | **N-51** | ✅ **SELESAI** | `HSTSIncludeSubDomains` (default `true`) & `HSTSPreload` (default `false`) dikendalikan via config. Direktif `preload` hanya muncul bila `includeSubDomains` juga aktif (`security_test.go:TestHSTSOptions`). |
| 5 | **N-57** | ✅ **SELESAI** | Alias duplikat `POST /api/api/telemetry/search` dihapus dari `main.go`. Route kanonik `POST /api/telemetry/search` tetap aktif (`202 Accepted`), sedangkan route duplikat menghasilkan `404 Not Found` (`analytics_handler_test.go:TestTelemetryRoute_N57`). |
| 6 | **R4-L1** | ✅ **SELESAI** | Parser WHATWG `new URL(trimmed, baseOrigin)` dengan penolakan `//`, `/\`, `\`, `data:`, `blob:`, skema non-`http(s):`, dan `origin === 'null'` diimplementasikan pada ke-3 `DocumentPreviewModal.tsx`. Pemanggilan `fetch()` dibatasi `credentials: isSameOriginUrl(targetUrl) ? 'include' : 'omit'`. Tri-Build frontend sukses diperbarui ke `public/{desktop,tablet,mobile}/`. |
| 7 | **R4-L2** | ✅ **SELESAI** | Perhitungan paket, diskon, cek gateway `maintenance`, dan validasi `PaymentProofURL` dipindahkan ke sebelum `ValidateAndConsumeToken` dan sebelum `h.db.Create(&newUser)`. Bila proof tidak valid: request ditolak `400`, user baru tidak terbentuk (0 orphan user), dan token OTP tetap belum hangus (`auth_handler_test.go:TestRegister_PreFlightPaymentProofValidation`). Dilengkapi kompensasi rollback `newUser` jika `Create(&newStore)` gagal. |

### 5.2 Bukti Output Verifikasi Asli

#### A. `govulncheck ./...`
```text
=== Symbol Results ===

No vulnerabilities found.

Your code is affected by 0 vulnerabilities.
This scan also found 2 vulnerabilities in packages you import and 1
vulnerability in modules you require, but your code doesn't appear to call these
vulnerabilities.
```

#### B. `go version -m` pada Binary Uji Sementara
```text
C:\Users\hwtor\AppData\Local\Temp\catavor-fase1-check.exe: go1.26.11
	dep	github.com/andybalholm/brotli	v1.2.8	h1:H9F6r7RNwzSRsx/lytpIYkbjNFMt2yNBwsJ2+0gpx78=
	dep	github.com/klauspost/compress	v1.20.4	h1:dD0v/bvxtjCBqQu6sx1TNWkalEY5lNTIe+HY9w8TeNI=
```
*(Binary uji langsung dihapus permanen dari `$LOCALAPPDATA/Temp`)*

#### C. `go test ./...`
```text
ok  	catavor-backend/internal/config	1.335s
ok  	catavor-backend/internal/database	1.166s
ok  	catavor-backend/internal/handlers	8.858s
ok  	catavor-backend/internal/middleware	2.236s
ok  	catavor-backend/internal/models	1.045s
ok  	catavor-backend/internal/security	1.053s
ok  	catavor-backend/internal/services	1.603s
ok  	catavor-backend/internal/storage	1.107s
ok  	catavor-backend/internal/utils	1.040s
```

#### D. Tri-Build Frontend (`tsc --noEmit` & `npm run build`) via Node 22 (fnm)
- **Desktop**: `tsc --noEmit` 0 error; `vite build` 1.41s $\rightarrow$ `../../public/desktop` (output: `index-C9ILLEDZ.js`, `index-CMlcLM3H.css`).
- **Tablet**: `tsc --noEmit` 0 error; `vite build` 917ms $\rightarrow$ `../../public/tablet` (output: `index-D0iT5E7h-t.js`, `index-CTHIYdcs.css`).
- **Mobile**: `tsc --noEmit` 0 error; `vite build` 1.25s $\rightarrow$ `../../public/mobile` (output: `index-dk2hTSkB.js`, `index-Dbx7mlhg.css`).

#### E. Status Server Produksi Port 8000
```bash
curl.exe -s http://localhost:8000/healthz
# {"status":"ok","uptime":"8h28m52s"}
```
Server live di port 8000 tetap aman tanpa interupsi (`200 OK`).
