# Implementation Plan — Remediasi Temuan Audit Keamanan Putaran 8 (N-47 s/d N-67 & CVE)

**Tanggal Penyusunan:** 14 November 2026  
**Referensi Audit:** `security-audit/audit-putaran-8-zero-change-2026-11-14.md` (Revisi 3 & 8c)  
**Baseline Commit:** `c20cbf9`  
**Status:** Rencana Implementasi Terintegrasi (Dokumen Teknis — **Zero Code Changes Applied**)  

---

## Ringkasan Strategi Eksekusi (Revisi 3 — Mengintegrasikan Fase 0 P0 Darurat)

Rencana implementasi ini dibagi menjadi **5 Fase Berurutan (dimulai dari Fase 0 Darurat)** berdasarkan tingkat keparahan risiko (*severity*), ketergantungan arsitektur, dan jaminan *zero-regression* terhadap sistem yang sudah berjalan:

| Fase | Fokus Utama | Item yang Ditutup | Status / Estimasi | Risiko Regresi |
|---|---|---|---|---|
| **Fase 0 (P0 Darurat)** | Hotfix Celah Kritis, Path Traversal & IDOR Berkas | **N-61** (CRITICAL), **N-58** (HIGH), **N-65/N-67** (HIGH), **N-59** (MED/LOW), **N-62** (MED) | ✅ **SELESAI & TERVERIFIKASI** | Sangat Rendah |
| **Fase 1 (P1)** | Quick Wins, Patch CVE & Penutupan Celah HIGH PDF | **N-47**, **4 CVE Go**, **N-50**, **N-51**, **N-57**, **R4-L1/L2** | ✅ **SELESAI & TERVERIFIKASI** | Sangat Rendah |
| **Fase 2 (P2)** | Pertahanan Jaringan, Anti-Rebinding & Distributed Rate Limit | **N-48**, **N-49** | ✅ **SELESAI & TERVERIFIKASI** | Rendah |
| **Fase 3 (P3)** | Privasi Log, Standar Password NIST & Rotasi Sesi | **N-53**, **N-54**, **N-55** | ⏳ **SIAP DIKERJAKAN (Next Priority)** | Sedang |
| **Fase 4 (P4)** | Kepatuhan Enterprise (MFA/TOTP & Dokumentasi Edge WAF) | **N-52**, **N-56** | Antrean (1–2 Hari) | Sedang |

---

## Fase 0 — Hotfix Celah Kritis P0 (Mendahului Seluruh Fase Lain) — [STATUS: ✅ SELESAI]

> [!NOTE]
> **Status Eksekusi (15 November 2026):**
> Seluruh item Fase 0 (N-61, N-58, N-65, N-67, N-59, N-62) serta temuan review Putaran 2 (A, B, C, D) dan Putaran 3 (R3-1 s/d R3-4) telah selesai diimplementasikan, diverifikasi dengan test suite `go test ./...` 100% lulus, dan Tri-Build frontend 0 error. Server produksi port 8000 beroperasi normal. Rincian review tercatat di `catatan-review-fase0-untuk-antigravity-2026-11-14.md`.

### 0.1. [N-61 — CRITICAL & N-59 — MED/LOW] Sanitasi Path Traversal, MIME, Open Redirect & Token URL pada `GetOrderProof`

- **Masalah Saat Ini:**  
  1. `handlers/subscription_handler.go:607-635` (fallback filesystem) tidak memeriksa `..` pada `candidateKeys`, sehingga `filepath.Join("public", "storage", rel)` dapat membaca berkas di luar web root (misal `../../../../backend/.env`).
  2. `payment_proof_url` disimpan mentah tanpa validasi saat pendaftaran/pembuatan order langganan (`handlers/auth_handler.go:56, 937` dan `services/subscription_service.go:554, 772`).
  3. Mengizinkan `data:text/html;base64,...` memicu respons `Content-Type: text/html` (Stored XSS).
  4. Mengizinkan `http://` / `https://` memicu `c.Redirect(proofURL, 302)` ke situs phishing (Open Redirect).
  5. Membaca `c.Query("token")` pada baris 488 (regresi N-02).
- **Target Perbaikan:**
  1. **Validasi Saat Simpan:** Pada pendaftaran (`auth_handler.go`) dan `CreateOrder` (`subscription_service.go`), tolak `payment_proof_url` kecuali berupa storage key sah berawalan `billing/` atau data URL gambar valid `data:image/(png|jpeg|webp);base64,...`.
  2. **Gunakan Path Resolver Aman Saat Baca:** Pada `GetOrderProof` (`subscription_handler.go`), buang kandidat `public/storage` dan CWD relatif. Gunakan fungsi aman `resolveInsideRoot(cfg.StoragePrivateRoot, relKey)` yang membungkus `filepath.Rel` dan `EvalSymlinks`. Tolak keras path yang memuat `..`.
  3. **Tutup Vektor N-59:** Whitelist `Content-Type` hanya untuk gambar (`image/jpeg`, `image/png`, `image/webp`), tolak `text/html`. Hapus `c.Redirect` eksternal sembarangan. Hapus pembacaan token URL query param `?token=`.
- **File yang Akan Diubah:**
  - `backend/internal/handlers/subscription_handler.go`
  - `backend/internal/handlers/auth_handler.go`
  - `backend/internal/services/subscription_service.go`
- **Langkah Verifikasi:**
  - Uji canary traversal: `proofURL = "../../../../canary_n61.txt"` wajib menghasilkan `404 Not Found` (gagal dibaca).
  - Uji data URL: `data:text/html;base64,...` wajib ditolak saat simpan dan tidak pernah disajikan sebagai `text/html`.
  - Uji query param: request tanpa cookie/header auth hanya membawa `?token=...` wajib menghasilkan `401 Unauthorized`.

---

### 0.2. [N-58 — HIGH] Pemblokiran Segmen Path Privat (`/support/` & `/billing/`) di Semua Kedalaman & Migrasi Legacy

- **Masalah Saat Ini:**  
  `backend/cmd/server/main.go:260` hanya memeriksa awalan string `HasPrefix(lowerKey, "support/")`. Berkas lampiran tiket bantuan historis di `public/storage/stores/*/support/**` lolos dari filter dan dapat diunduh publik tanpa otentikasi (`HTTP 200 OK`, `Cache-Control: public`).
- **Target Perbaikan:**
  1. Perbarui guard rute statis di `cmd/server/main.go` agar memblokir segmen sensitif di **seluruh kedalaman path**:
     ```go
     lowerKey := strings.ToLower(cleanKey)
     if strings.Contains(lowerKey, "/support/") || strings.HasPrefix(lowerKey, "support/") ||
        strings.Contains(lowerKey, "/billing/") || strings.HasPrefix(lowerKey, "billing/") ||
        strings.Contains(lowerKey, "/private/") || strings.HasPrefix(lowerKey, "private/") {
         return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Berkas tidak ditemukan."})
     }
     ```
  2. Pindahkan secara aman 30 berkas historis dari `public/storage/stores/*/support/` ke `storage/private/support/legacy/` agar tidak ada dokumen pribadi pengguna yang tertinggal di pohon direktori publik.
- **File yang Akan Diubah:**
  - `backend/cmd/server/main.go` (sekitar baris 259–265)
  - Struktur fisik direktori `public/storage/stores/*/support/`
- **Langkah Verifikasi:**
  - `curl.exe -I -s "http://localhost:8000/storage/stores/1/support/2026/09/308115f4-ab39-4973-8b2a-7ed35c3c54f9.jpg"` wajib menghasilkan `HTTP/1.1 404 Not Found`.

---

### 0.3. [N-65 & N-67 — HIGH] Whitelist Presisi Namespace `storage_key` Lampiran Tiket Bantuan

- **Masalah Saat Ini:**  
  `support_handler.go:2679-2693` (`storageKeyFromInput`) menerima string `storage_key` sembarangan dari payload JSON `attachments`. Penyerang dapat menyematkan key milik tenant lain (seperti `private/billing/users/999/...`) ke tiket bantuan miliknya, lalu mengunduhnya secara legal lewat `GET /api/help/tickets/attachments/:id` karena pengecekan kepemilikan tiket (`ticket.UserID == user.ID`) lolos. Terbuka dari pemanggil staf maupun pelanggan (`CreateTicket`, `ReplyTicket`, `AdminReplyTicket`).
- **Target Perbaikan:**
  1. Pada `buildSupportAttachment` (`support_handler.go`), terapkan whitelist namespace presisi sesuai arsitektur penyimpanan Catavor:
     - **HANYA terima prefix:** `private/support/tickets/` dan `private/support/staff/`.
     - **TOLAK KERAS (400 Bad Request):** bila mengandung `billing`, `private/billing`, `private/stores/`, `stores/`, atau tidak diawali `private/support/`.
  2. Pastikan ketiga handler pemanggil (`CreateTicket` baris 591, `ReplyTicket` baris 723, `AdminReplyTicket` baris 1174) menerapkan validasi ini secara seragam.
  3. Frontend hardening (N-67): pastikan frontend (`App.tsx`, `PlatformRolePortal.tsx`, `TabletHelpdeskView.tsx`) hanya mengirimkan `storage_key` sah hasil upload kategori `support`.
- **File yang Akan Diubah:**
  - `backend/internal/handlers/support_handler.go`
  - Frontend calling components jika diperlukan
- **Langkah Verifikasi:**
  - Uji pembuatan tiket baru dengan lampiran `{"storage_key": "private/billing/users/1/secret.jpg"}` wajib mengembalikan `400 Bad Request`.
  - Uji pembuatan tiket dengan lampiran sah `private/support/tickets/...` wajib `200 OK`.

---

### 0.4. [N-62 — MEDIUM] Normalisasi Path KeyGenerator pada Rate Limiter Auth

- **Masalah Saat Ini:**  
  `backend/internal/middleware/security.go:183` memakai `c.IP() + "_" + c.Path()`. Varian path seperti `/api/auth/login/` atau `/API/auth/login` menghasilkan bucket terpisah, menggandakan kuota percobaan brute force.
- **Target Perbaikan:**
  - Normalisasi `c.Path()` sebelum dijadikan key: gunakan huruf kecil (`strings.ToLower`) dan pangkas trailing slash (`strings.TrimRight(path, "/")`), atau gunakan route pattern `c.Route().Path`.
- **File yang Akan Diubah:**
  - `backend/internal/middleware/security.go` (baris 182–184)
- **Langkah Verifikasi:**
  - Uji varian `/api/auth/check-email`, `/api/auth/check-email/`, `/API/auth/check-email` berbagi bucket 20 request/menit yang sama.

---

---

## Fase 1 — Penutupan Celah HIGH, Patch CVE & Hardening Header (Prioritas 1) — [STATUS: ✅ SELESAI & TERVERIFIKASI]

> [!NOTE]
> **Status Eksekusi (15 November 2026):**
> Seluruh item Fase 1 (N-47, 4 CVE Go via toolchain go1.26.11, N-50, N-51, N-57, serta hardening R4-L1 dan R4-L2) telah selesai dieksekusi 100% dan diverifikasi runtime:
> - Test suite `go test ./...` 100% lulus di seluruh paket backend (`config`, `database`, `handlers`, `middleware`, `models`, `security`, `services`, `storage`, `utils`).
> - `govulncheck ./...` menghasilkan 0 affected vulnerabilities.
> - `go version -m` membuktikan Go stdlib `go1.26.11`, `andybalholm/brotli v1.2.8`, dan `klauspost/compress v1.20.4`.
> - Tri-Build frontend desktop, tablet, dan mobile sukses 0 error via Node 22 (`public/{desktop,tablet,mobile}/` terbarui).
> - Server live di port 8000 tetap stabil dan sehat (`/healthz` 200 OK).
> - Rincian eksekusi dan bukti log runtime tercatat di `security-audit/implementation-plan-fase-1-2026-11-15.md`.

### 1.1. [N-47 — HIGH] Gating Kategori Upload PDF & Isolasi dari Pohon Publik

- **Masalah Saat Ini:**  
  Di `backend/internal/handlers/storage_handler.go:154-165`, deteksi `isPDF` (`%PDF-`) mengizinkan unggahan dokumen PDF pada kategori apa pun (termasuk default `products`). Akibatnya, file PDF dapat disimpan di pohon publik `stores/{id}/products/...` dan disajikan langsung via `GET /storage/*` dengan `Content-Type: application/pdf`.
- **Target Perbaikan (Selaras Hasil Review Fase 1):**
  1. **Whitelist Kategori PDF Hanya `support`:** Batasi unggahan PDF **hanya** untuk kategori `support` (bukan `billing`, karena sejak `N-59` endpoint `GetOrderProof` & `ValidatePaymentProofURL` hanya mengizinkan gambar `.jpg/.jpeg/.png/.webp` dan menolak PDF dengan `415`). Tolak dengan `415 Unsupported Media Type` bila `isPDF == true` dan `category != "support"`.
  2. **Paksa Namespace Privat (Defense-in-Depth):** Pastikan setiap objek dengan `isPDF == true` atau `contentType == "application/pdf"` **selalu** diprefiks dengan `storage.PrivateKeyPrefix` (`private/`), sehingga tidak pernah bisa disajikan oleh route statis publik `/storage/*`.
  3. **Header Sandboxing pada Seluruh Penyajian PDF:** Pada fallback `/storage/*` (`cmd/server/main.go:275-309`) dan `ServeAttachment` (`handlers/support_handler.go:2624-2639`), paksa `Content-Disposition: attachment` dan `Content-Security-Policy: sandbox; default-src 'none'` untuk `.pdf` agar PDF viewer bawaan browser tidak pernah mengeksekusi script `/OpenAction` di origin aplikasi (preview in-app `DocumentPreviewModal` berbasis `fetch` + PDF.js canvas tetap berjalan normal).
- **File yang Akan Diubah:**
  - `backend/internal/handlers/storage_handler.go` (sekitar baris 153–179 dan 322)
  - `backend/internal/handlers/support_handler.go` (sekitar baris 2624–2639)
  - `backend/cmd/server/main.go` (sekitar baris 275–309)
- **Cuplikan Implementasi Target (`storage_handler.go`):**
  ```go
  isPDF := bytes.HasPrefix(fileBytes, []byte("%PDF-")) || strings.EqualFold(filepath.Ext(file.Filename), ".pdf")
  if isPDF {
      if !bytes.HasPrefix(fileBytes, []byte("%PDF-")) {
          return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
              "success": false,
              "message": "File PDF tidak valid atau rusak (header signature tidak cocok).",
          })
      }
      // SECURITY (N-47): PDF hanya diizinkan pada kategori privat tiket bantuan (support).
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
- **Langkah Verifikasi:**
  - Buat unit test `TestUploadFile_PDFRejectedOnNonSupportCategories` (`products` & `billing`) → harus mengembalikan `415`.
  - Buat unit test `TestUploadFile_PDFAllowedAndPrivateOnSupport` → harus mengembalikan `200` dengan `storage_key` berawalan `private/` dan `url: ""`.

---

### 1.2. [CVE Go] Pembaruan Toolchain Go & Dependensi Kompresi

- **Masalah Saat Ini:**  
  Hasil `govulncheck ./...` menunjukkan 4 kerentanan yang fungsi-fungsinya aktif dipanggil:
  - `GO-2026-6888`: `github.com/andybalholm/brotli@v1.2.1` (perbaikan: `v1.2.7+`)
  - `GO-2026-6865`: `github.com/klauspost/compress@v1.19.2` (perbaikan: `v1.20.2+`)
  - `GO-2026-6859`: `net/http@go1.26.9` (perbaikan: `go1.26.11+`)
  - `GO-2026-6809`: `crypto/x509@go1.26.9` (perbaikan: `go1.26.10+`)
- **File yang Akan Diubah:**
  - `backend/go.mod` & `backend/go.sum`
  - Lingkungan runtime Go host / CI menuju `go1.26.11+`
- **Perintah Eksekusi Target:**
  ```bash
  cd backend
  go get github.com/andybalholm/brotli@latest
  go get github.com/klauspost/compress@latest
  go mod tidy
  govulncheck ./...
  ```
- **Langkah Verifikasi:**
  - `govulncheck ./...` melaporkan `No vulnerabilities found.`
  - `go test ./...` seluruh paket lulus tanpa regresi.

---

### 1.3. [N-50 — MEDIUM] Pengetatan Content-Security-Policy (`img-src` & `connect-src`)

- **Masalah Saat Ini:**  
  Di `backend/internal/middleware/security.go:53, 55`, direktif `img-src` dan `connect-src` menyertakan skema wildcard `http:` polos di semua environment. Di production, ini mengizinkan skrip atau elemen gambar mengirim data ke server HTTP tak terenkripsi mana pun.
- **Target Perbaikan:**
  - Pisahkan kebijakan berdasarkan `cfg.AppEnv`:
    - **Production / Staging (`cfg.AppEnv != "local"`):** Hapus `http:` dari `img-src` dan hapus `https: http:` wildcard penuh dari `connect-src` (gunakan `'self'` + daftar origin `cfg.AllowedOrigins` + domain analitik/SSO/sosmed yang di-whitelist secara eksplisit). Untuk `img-src`, pertahankan `'self' data: blob: https:` (hanya HTTPS untuk gambar eksternal).
    - **Local Development (`cfg.AppEnv == "local"`):** Izinkan `http://localhost:* http://127.0.0.1:* ws://localhost:*` agar *hot-reload* Vite dan pengembangan lokal tidak terganggu.
- **File yang Akan Diubah:**
  - `backend/internal/middleware/security.go` (baris 48–58)
- **Langkah Verifikasi:**
  - Test header response dengan `APP_ENV=production` → pastikan tidak ada token ` http:` bebas di dalam header `Content-Security-Policy`.
  - Uji pemuatan halaman di ketiga SPA (desktop, tablet, mobile) dan pastikan tidak ada pelanggaran CSP di console browser.

---

### 1.4. [N-51 — MEDIUM] Pengendalian Flag `preload` dan `includeSubDomains` pada HSTS

- **Masalah Saat Ini:**  
  `backend/internal/middleware/security.go:61` mengirim `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` secara *hardcoded* setiap kali `c.Secure()` bernilai `true`.
- **Target Perbaikan:**
  - Default-kan HSTS ke nilai yang aman untuk produksi umum: `max-age=31536000; includeSubDomains`.
  - Jadikan direktif `; preload` opsional melalui variabel environment `HSTS_PRELOAD=true` di `config.go` setelah seluruh subdomain produksi diverifikasi mendukung HTTPS.
- **File yang Akan Diubah:**
  - `backend/internal/config/config.go`
  - `backend/internal/middleware/security.go`

---

### 1.5. [N-57 — LOW] Pembersihan Alias Route Ganda `/api/api/telemetry/search`

- **Masalah Saat Ini:**  
  `backend/cmd/server/main.go:435` mendaftarkan route duplikat `/api/api/telemetry/search`.
- **Target Perbaikan:**
  - Periksa seluruh pemanggil di `frontend/desktop`, `frontend/tablet`, dan `frontend/mobile` untuk memastikan klien memanggil `/telemetry/search` (di atas baseURL `/api`).
  - Hapus baris alias `/api/api/telemetry/search` di `cmd/server/main.go:435`.

---

### 1.6. [R4-L1 & R4-L2 — LOW Hardening Sisa Audit Putaran 4 Fase 0]

- **Sumber:** `security-audit/catatan-review-fase0-untuk-antigravity-2026-11-14.md` Bagian 8.2 (non-blocker Fase 0, disekaliankan di Fase 1).
- **Target Perbaikan:**
  1. **`R4-L1` (`DocumentPreviewModal.tsx` di `desktop`, `tablet`, `mobile` baris ~270):** Sederhanakan `isSameOriginUrl` menjadi satu sumber kebenaran berbasis WHATWG parser: `try { return new URL(url.trim(), window.location.origin).origin === window.location.origin; } catch { return false; }` agar kebal terhadap variasi backslash `/\attacker.example` (jalur tidak hidup saat ini, hardening defensif) dan sertakan `credentials: 'include'` pada cabang same-origin.
  2. **`R4-L2` (`backend/internal/handlers/auth_handler.go` pada `Register`):** Pindahkan validasi `req.PaymentProofURL` ke sebelum `h.db.Create(&newUser)` (atau bungkus pembuatan `User` + `Store` + `SubscriptionOrder` dalam `db.Transaction`) agar kegagalan validasi bukti bayar tidak menyisakan baris `User` yatim di database.

---

## Fase 2 — Anti-DNS Rebinding & Distributed Rate Limiter (Prioritas 2) — [STATUS: ✅ SELESAI & TERVERIFIKASI]

> [!NOTE]
> **Status Eksekusi (15 November 2026):**
> Seluruh item Fase 2 (N-48 dan N-49) serta perbaikan 2 Blocker (resource leak & memory eviction anti-OOM) dan 4 Koreksi (IP khusus `0.0.0.0/8`, NAT64, multi-IP failover, test multi-instance 2-replica Fiber) telah selesai diimplementasikan dan diverifikasi 100% lulus pada `GOTOOLCHAIN=auto go test -p 1 -count=1 ./...` dan `govulncheck ./...` (0 kerentanan). Server produksi port 8000 tetap stabil dan sehat (/healthz 200 OK). Rincian implementasi dan bukti runtime tercatat di `security-audit/implementation-plan-fase-2-2026-11-15.md`.

### 2.1. [N-48 — MEDIUM] Custom `DialContext` Anti-DNS Rebinding pada Klien HTTP Aulaa

- **Masalah Saat Ini:**  
  `ValidateAulaaBaseURL` (`backend/internal/services/aulaa_service.go:40-83`) memvalidasi IP hasil resolusi DNS hanya pada saat konfigurasi disimpan atau dibaca. Saat request dikirim (`CreateAulaaPayment`, `CheckAulaaPaymentStatus`, `GetAulaaPaymentMethods`, `TestAulaaConnection`), `http.Client` standar melakukan resolusi DNS ulang tanpa memeriksa apakah IP hasil resolusi baru mengarah ke loopback/RFC1918/link-local (`169.254.169.254`).
- **Target Perbaikan:**
  - Buat fungsi pembuat HTTP client khusus `newSafeAulaaHTTPClient()` di `aulaa_service.go` yang memasang `http.Transport` dengan custom `DialContext` dan `CheckRedirect` (menolak redirect lintas host atau ke IP internal):
  ```go
  func newSafeAulaaHTTPClient() *http.Client {
      allowLocal := strings.EqualFold(strings.TrimSpace(os.Getenv("AULAA_ALLOW_LOCAL_HTTP")), "true")
      dialer := &net.Dialer{
          Timeout:   10 * time.Second,
          KeepAlive: 30 * time.Second,
      }
      transport := &http.Transport{
          TLSHandshakeTimeout: 10 * time.Second,
          DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
              host, port, err := net.SplitHostPort(addr)
              if err != nil {
                  return nil, err
              }
              ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
              if err != nil {
                  return nil, err
              }
              for _, ipAddr := range ips {
                  if !allowLocal && isDisallowedAulaaIP(ipAddr.IP) {
                      return nil, fmt.Errorf("SSRF guard: koneksi ke IP internal/metadata (%s) diblokir saat dial", ipAddr.IP.String())
                  }
              }
              if len(ips) == 0 {
                  return nil, fmt.Errorf("tidak ada alamat IP yang valid untuk host %s", host)
              }
              // Pin koneksi langsung ke IP pertama yang sudah tervalidasi aman
              targetAddr := net.JoinHostPort(ips[0].IP.String(), port)
              return dialer.DialContext(ctx, network, targetAddr)
          },
      }
      return &http.Client{
          Timeout:   DefaultHTTPTimeout,
          Transport: transport,
          CheckRedirect: func(req *http.Request, via []*http.Request) error {
              return http.ErrUseLastResponse // Tolak auto-redirect untuk mencegah open-redirect SSRF
          },
      }
  }
  ```
  - Ganti seluruh `&http.Client{Timeout: DefaultHTTPTimeout}` di `aulaa_service.go` (baris 222, 265, 305, 355) dengan `newSafeAulaaHTTPClient()`.
- **File yang Akan Diubah:**
  - `backend/internal/services/aulaa_service.go`
- **Langkah Verifikasi:**
  - Buat unit test yang menyimulasikan resolver mengembalikan `127.0.0.1` / `169.254.169.254` saat `AULAA_ALLOW_LOCAL_HTTP` tidak di-set → pastikan koneksi diblokir pada fase `DialContext` sebelum paket TCP keluar.

---

### 2.2. [N-49 — MEDIUM] Backing Redis Terdistribusi untuk Fiber Rate Limiter

- **Masalah Saat Ini:**  
  Di `backend/internal/middleware/security.go:148-234`, keempat rate limiter (`GlobalAPIRateLimiter`, `AuthRateLimiter`, `PublicSubmissionRateLimiter`, `TelemetryRateLimiter`) tidak mengisi field `Storage` pada `limiter.Config`, sehingga memakai memori lokal per-proses.
- **Target Perbaikan:**
  - Buat adapter `fiber.Storage` ringan di atas `database.RedisClient` (yang sudah terinisialisasi di `backend/internal/database/redis.go`) dengan *graceful fallback* ke in-memory saat berjalan di `APP_ENV=local` tanpa Redis:
    - Implementasikan interface `fiber.Storage`: `Get(key string) ([]byte, error)`, `Set(key string, val []byte, exp time.Duration) error`, `Delete(key string) error`, `Reset() error`, `Close() error` di `backend/internal/database/redis_fiber_storage.go`.
  - Pasang `Storage: database.NewRedisFiberStorage("ratelimit:")` pada keempat `limiter.Config` di `backend/internal/middleware/security.go`.
- **File yang Akan Diubah:**
  - `backend/internal/database/redis_fiber_storage.go` (file baru, tanpa perlu menambah dependensi eksternal baru karena langsung membungkus `github.com/redis/go-redis/v9` yang sudah ada)
  - `backend/internal/middleware/security.go`
- **Langkah Verifikasi:**
  - Unit test adapter `RedisFiberStorage` untuk operasi `Get`/`Set`/`Delete` dengan TTL.
  - Uji endpoint `/api/auth/login` melebihi 20 request/menit dan pastikan status `429 Too Many Requests` tetap konsisten.

---

## Fase 3 — Privasi Log, Standar Password NIST & Rotasi Sesi (Prioritas 3)

### 3.1. [N-53 — LOW] Masking PII (Alamat Email) pada Log Aplikasi Standar

- **Masalah Saat Ini:**  
  Terdapat 13 titik penulisan `.Str("email", ...)` secara mentah pada log aplikasi (`auth_handler.go` dan `redis.go`).
- **Target Perbaikan:**
  - Tambahkan helper `security.MaskEmailForLog(email string) string` di `backend/internal/security/sanitizer.go` (contoh: `dzikri@domain.com` → `dz***i@domain.com` atau prefix + hash pendek SHA-256 8-karakter agar korelasi insiden tetap bisa dilakukan tanpa mengekspos PII mentah di stdout/file log).
  - Catatan: Audit log di database (`ActivityLog`) yang memang diakses khusus oleh Superadmin tetap menyimpan data aktor sesuai kebutuhan *forensic trail*, namun log stdout/file (`zerolog`) memakai `MaskEmailForLog`.
- **File yang Akan Diubah:**
  - `backend/internal/security/sanitizer.go`
  - `backend/internal/handlers/auth_handler.go`
  - `backend/internal/database/redis.go`

---

### 3.2. [N-54 — LOW] Modernisasi Kebijakan Password Sesuai NIST SP 800-63B

- **Masalah Saat Ini:**  
  `ValidatePassword` di `backend/internal/security/sanitizer.go:391-428` mewajibkan aturan komposisi kaku (1 huruf besar, 1 huruf kecil, 1 angka, 1 simbol) yang menolak *passphrase* panjang namun menerima password umum seperti `Password123!`.
- **Target Perbaikan:**
  1. **Dukungan Passphrase Panjang:** Jika panjang password **≥ 15 karakter** (misal passphrase kalimat), bebaskan dari keharusan simbol/angka kaku selama bukan karakter berulang (`aaaaaa...`). Untuk password pendek (8–14 karakter), aturan kompleksitas tetap boleh dipertahankan agar kompatibel dengan pengujian yang sudah ada.
  2. **Blocklist Password Umum (Breached Password Check):** Tambahkan pengecekan terhadap daftar password yang paling sering bocor (mis. `password`, `qwerty`, `admin123`, `catavor`, `dfauna`, `indonesia`, pola `123456`, dsb. dengan normalisasi leetspeak `0->o, 1->i, @->a, $->s`).
- **File yang Akan Diubah:**
  - `backend/internal/security/sanitizer.go`
  - `backend/internal/security/sanitizer_test.go`

---

### 3.3. [N-55 — LOW] Sliding Session / Rotasi Token Berumur Pendek

- **Masalah Saat Ini:**  
  Cookie sesi `catavor_session` (`backend/internal/handlers/session_cookie.go`) memiliki masa berlaku statis 12 jam tanpa rotasi `jti` berkala.
- **Target Perbaikan:**
  - Terapkan mekanisme **Silent Sliding Token Rotation** di middleware `AuthRequired` (`backend/internal/middleware/auth.go`):
    - Masa aktif JWT diperpendek menjadi **2 jam** (atau tetap membawa klaim `iat`), dan apabila token yang valid sudah melewati paruh umur (mis. > 30 menit sejak diterbitkan) serta user masih aktif, server menerbitkan JWT baru dengan `jti` baru via `setSessionCookie` dan mem-blacklist `jti` lama setelah *grace period* 60 detik (agar request paralel dari tab yang sama tidak batal).
    - Dengan pendekatan ini, **kontrak API dengan ketiga frontend (desktop, tablet, mobile) tidak berubah sama sekali** karena browser otomatis memperbarui cookie `HttpOnly` `catavor_session`.
- **File yang Akan Diubah:**
  - `backend/internal/handlers/session_cookie.go`
  - `backend/internal/middleware/auth.go`

---

## Fase 4 — Kepatuhan Enterprise: MFA/TOTP & Konfigurasi Edge WAF (Prioritas 4)

### 4.1. [N-52 — LOW/ASVS V2.8] Implementasi 2FA / TOTP untuk Akun Staf & Merchant

- **Target Arsitektur:**
  1. **Model Database (`models/user.go`):**
     - Tambahkan kolom `TwoFactorEnabled bool`, `TwoFactorSecretEnc string` (dienkripsi AES-256-GCM menggunakan kunci turunan HKDF dari `JWT_SECRET` atau `ENCRYPTION_KEY`), dan `TwoFactorBackupCodesHash string`.
  2. **Endpoint Setup & Verifikasi (`handlers/auth_handler.go`):**
     - `POST /api/auth/2fa/setup` → menghasilkan secret TOTP (RFC 6238, kompatibel Google Authenticator / Authy) + QR URI `otpauth://totp/...`.
     - `POST /api/auth/2fa/enable` → memverifikasi kode 6 digit pertama dan mengaktifkan `TwoFactorEnabled = true` + mengembalikan 8 backup code sekali pakai.
     - `POST /api/auth/2fa/disable` → memerlukan verifikasi password + kode TOTP aktif.
  3. **Alur Login Dua Tahap:**
     - Jika `user.TwoFactorEnabled == true` saat `Login`, jangan langsung menerbitkan cookie sesi penuh; kembalikan `{"requires_2fa": true, "challenge_token": "<short-lived-5m-token>"}` dan selesaikan di `POST /api/auth/2fa/verify`.

---

### 4.2. [N-56 — LOW] Standarisasi Infrastruktur Edge (Cloudflare / Reverse Proxy)

- **Target Deliverables (Infrastruktur/Deployment):**
  - Tambahkan direktori `deploy/` berisi konfigurasi referensi standar produksi:
    - `deploy/Caddyfile` atau `deploy/nginx.conf` dengan konfigurasi `X-Forwarded-For` dari daftar IP Cloudflare resmi, batas ukuran body di level proxy, dan TLS 1.2/1.3 ketat.
    - `deploy/cloudflare-waf-rules.md` berisi daftar aturan WAF yang direkomendasikan (Managed Ruleset OWASP, rate limit di edge untuk `/api/auth/*`, dan blokir akses langsung ke IP origin di luar rentang IP Cloudflare).

---

## Checklist Verifikasi Akhir (Definition of Done)

Sebelum setiap fase dinyatakan selesai ketika nanti dieksekusi:

- [ ] `go build ./...` dan `go vet ./...` lulus tanpa *warning*.
- [ ] `go test -race ./...` seluruh paket backend lulus 100%.
- [ ] `govulncheck ./...` menghasilkan **0 kerentanan**.
- [ ] `npm audit` pada `frontend/desktop`, `frontend/tablet`, dan `frontend/mobile` tetap **0 kerentanan**.
- [ ] Uji regresi kontrak API untuk login, upload gambar produk, upload lampiran tiket bantuan (PDF & gambar), serta checkout pembayaran Aulaa.
- [ ] Uji regresi khusus Fase 0 P0: canary path traversal 404, file support legacy 404, validasi storage key tiket 400 saat disisipi namespace billing.
