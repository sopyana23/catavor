# Catatan Review Independen — Implementation Plan Fase 1 (P1 & Quick Wins)

**Tanggal Review:** 15 November 2026  
**Dokumen yang Direview:** `security-audit/implementation-plan-fase-1-2026-11-15.md`  
**Baseline Pembanding:**  
- `security-audit/implementation-plan-putaran-8-2026-11-14.md` (Seksi Fase 1, baris 110–228)  
- `security-audit/audit-putaran-8-zero-change-2026-11-14.md` & `security-audit/findings.json`  
- `security-audit/catatan-review-fase0-untuk-antigravity-2026-11-14.md` (Bagian 8.2 — `R4-L1` & `R4-L2`)  
- Kode aktual `backend/` dan `frontend/{desktop,tablet,mobile}/src/` pasca-Fase 0  
**Status Verdict:** ⚠️ **LULUS BERSYARAT — WAJIB REVISI 3 BLOCKER REGRESI & 4 KOREKSI TEKNIS SEBELUM EKSEKUSI**

---

## Ringkasan Eksekutif

Secara cakupan (*scope*), seluruh **6 paket kerja Fase 1** (`N-47`, `4 CVE Go`, `N-50`, `N-51`, `N-57`, serta carryover `R4-L1` & `R4-L2`) **sudah tercantum lengkap** di `implementation-plan-fase-1-2026-11-15.md`. Nomor baris referensi kode pasca-Fase 0 sebagian besar akurat.

Namun, verifikasi silang terhadap **kode aktual backend & ketiga frontend (`desktop`, `tablet`, `mobile`)** menemukan **3 Blocker Regresi Produksi** (yang akan mematahkan fitur aktif bila cuplikan kode di plan dieksekusi mentah-mentah) serta **4 Koreksi Teknis & Standar Pengujian** yang wajib diperbaiki oleh agent pelaksana saat mengeksekusi Fase 1.

| Paket | Item | Kesesuaian Master Plan | Status Review Plan | Catatan Kunci |
|---|---|---|---|---|
| **1.1** | `N-47` (HIGH — Gating Upload PDF) | Sesuai tujuan | ❌ **Perlu Koreksi Kontrak (`billing` vs `support`)** | Mengizinkan PDF di `billing` justru membuat dead-end UX karena `GetOrderProof` menolak PDF (`415` pasca N-59); hanya `support` yang punya jalur baca PDF aman |
| **1.2** | `4 CVE Go` (`brotli`, `compress`, stdlib Go) | Sesuai | ⚠️ **Perlu Koreksi Mekanisme Toolchain** | Upgrade `go 1.26.11` di `go.mod` saja tidak meng-upgrade Go host (`go1.26.9`) bila `GOTOOLCHAIN=local`; pastikan `GOTOOLCHAIN=auto` / upgrade SDK host agar binary produksi & `govulncheck` bersih |
| **1.3** | `N-50` (MEDIUM — CSP `img-src` & `connect-src`) | Sesuai tujuan | ❌ **BLOCKER REGRESI FITUR** | Daftar `connect-src` di plan melewatkan `https://api.qrserver.com` (mematahkan fitur **Unduh PNG QR Katalog** di ke-3 SPA) dan salah membaca env var CORS (`ALLOWED_ORIGINS`, bukan `CORS_ALLOWED_ORIGINS`) + lupa origin `STORAGE_PUBLIC_URL` (mode S3/CDN) |
| **1.4** | `N-51` (MEDIUM — HSTS `preload` & `includeSubDomains`) | Lebih baik dari master plan | ✅ **Siap Eksekusi (dengan 1 catatan test)** | Dua toggle (`HSTS_INCLUDE_SUBDOMAINS` default `true`, `HSTS_PRELOAD` default `false`) lebih fleksibel daripada master plan; pastikan update `middleware/security_test.go` |
| **1.5** | `N-57` (LOW — Hapus `/api/api/telemetry/search`) | Sesuai | ✅ **Siap Eksekusi (Terverifikasi 0 Pemanggil)** | Hasil grep di `desktop`, `tablet`, `mobile`, dan `backend`: **0 referensi** ke `/api/api/telemetry/search` |
| **1.6a** | `R4-L1` (LOW — `isSameOriginUrl` di `DocumentPreviewModal.tsx`) | Sesuai tujuan | ⚠️ **Perlu Koreksi Protokol & Klaim Identik** | Wajib batasi `parsed.protocol === 'http:' \|\| parsed.protocol === 'https:'`; ketiga file **tidak identik byte-for-byte** (wajib patch masing-masing, jangan copy-overwrite buta) |
| **1.6b** | `R4-L2` (LOW — Atomisitas `Register` & `PaymentProofURL`) | Sesuai tujuan | ❌ **BLOCKER REGRESI DATA / SIDE-EFFECT** | Membungkus `Register` penuh dalam `db.Transaction` tidak membatalkan `DeleteVerificationCode` di Redis saat rollback, serta berisiko rollback akun baru hanya karena gagal auto-create `SubscriptionOrder` opsional |

---

## Temuan Blocker (Wajib Diperbaiki Sebelum / Saat Eksekusi)

### BLOCKER-1 [Paket 1.3 / N-50]: Regresi Fitur Unduh QR Katalog, Salah Nama Env `CORS_ALLOWED_ORIGINS`, & Absennya `STORAGE_PUBLIC_URL` pada `connect-src`

1. **`https://api.qrserver.com` wajib masuk `connect-src` (bukan cuma `img-src`):**  
   Di ketiga SPA, fitur **Download QR Code Katalog (PNG HD)** memanggil `await fetch(qrImageUrl)` via JavaScript Fetch API (yang tunduk pada `connect-src`, bukan `img-src`) ke `https://api.qrserver.com/v1/create-qr-code/...`:
   - `frontend/desktop/src/App.tsx:3301, 3313`
   - `frontend/desktop/src/components/DesktopShareCatalogView.tsx:42, 54`
   - `frontend/mobile/src/App.tsx` & `frontend/tablet/src/...` (komponen QR serupa)  
   Cuplikan kode di plan baris `140–149` **tidak menyertakan `https://api.qrserver.com`** di `connectSources`. Jika dieksekusi apa adanya di `APP_ENV=production`, `fetch(qrImageUrl)` langsung diblokir browser karena melanggar CSP `connect-src`.

2. **Salah nama variabel environment CORS (`CORS_ALLOWED_ORIGINS` tidak ada di codebase):**  
   Plan baris `151` menulis:
   ```go
   for _, origin := range strings.Split(os.Getenv("CORS_ALLOWED_ORIGINS"), ",")
   ```
   Faktanya di `backend/internal/config/config.go:53` dan seluruh codebase (23 lokasi), variabel resmi yang dipakai adalah **`ALLOWED_ORIGINS`** (yang sudah di-parse rapi ke `cfg.AllowedOrigins []string`), **bukan** `CORS_ALLOWED_ORIGINS`. Membaca `os.Getenv("CORS_ALLOWED_ORIGINS")` akan selalu menghasilkan string kosong `""` di produksi!

3. **Origin `cfg.StoragePublicURL` (S3 / CDN eksternal) & `cfg.AppURL` belum dimasukkan ke `connect-src`:**  
   Saat aplikasi dideploy dengan `STORAGE_DRIVER=s3` atau `STORAGE_PUBLIC_URL=https://cdn.domain.com/storage` (`config.go:96`), beberapa fitur frontend melakukan `fetch(...)` langsung ke URL gambar publik untuk diunduh sebagai `Blob`:
   - `DesktopCheckoutView.tsx:559` (`fetch(qrisTarget)`)
   - `SubscriptionModal.tsx:864` (`fetch(manualQrisImage)`)
   - `DocumentPreviewModal.tsx:419, 616` (`fetch(targetUrl)` untuk gambar publik saat `fileUrl` memakai `STORAGE_PUBLIC_URL`)  
   Jika origin dari `cfg.StoragePublicURL` berbeda dari `'self'`, `fetch()` tersebut akan gagal terkena blokir `connect-src`.

4. **Perbaikan Wajib pada Paket 1.3 (`security.go`):**
   - Terima parameter `cfg *config.Config` pada `SecurityHeaders(cfg *config.Config) fiber.Handler` (atau ekstrak origin dari `cfg.AllowedOrigins`, `cfg.AppURL`, dan `cfg.StoragePublicURL` melalui helper `extractCSPOrigin(rawURL string) string` berbasis `net/url.Parse` yang hanya meloloskan skema `https://` di non-local, dan menolak wildcard `*`).
   - Tambahkan `https://api.qrserver.com` ke `connectSources`, plus domain Google AdSense/FundingChoices (`https://ep1.googletrafficquality.google`, `https://ep2.adtrafficquality.google`) karena `googleAdSense.ts` & `AdSenseUnit.tsx` aktif di ketiga SPA.
   - Pada mode `local` (`cfg.AppEnv == "local"`), selain `http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*`, pastikan dev di jaringan LAN lokal (mis. akses dari HP ke IP laptop) atau port custom tetap aman sesuai `cfg.AllowedOrigins`.
   - **Periksa & perbarui unit test CSP yang sudah ada:** `backend/internal/middleware/csp_test.go` dan `backend/internal/middleware/security_test.go` memanggil `middleware.SecurityHeaders()` tanpa argumen! Mengubah signature menjadi `SecurityHeaders(cfg)` tanpa meng-update `csp_test.go` & `security_test.go` akan membuat **`go test ./internal/middleware/...` gagal kompilasi**. (Detail ini terlewat sama sekali di daftar file terdampak plan).

---

### BLOCKER-2 [Paket 1.1 / N-47]: Kontradiksi Kategori `billing` untuk PDF vs Penolakan PDF di `GetOrderProof` & `Register`

1. **Bukti ketidakcocokan kontrak di kode aktual:**
   - Di Fase 0 (`N-59` & `N-61`), seluruh pipeline bukti bayar (`billing`) secara eksplisit **hanya mengizinkan gambar (`image/jpeg`, `image/png`, `image/webp`)**:
     - `backend/internal/handlers/subscription_handler.go:634-643` (`GetOrderProof`): melakukan `http.DetectContentType` dan **menolak semua non-image (termasuk `application/pdf`) dengan HTTP `415 Unsupported Media Type`** (`"Format berkas bukti pembayaran tidak didukung"`).
     - `frontend/{desktop,mobile,tablet}` pada seluruh komponen pembayaran (`SubscriptionModal.tsx:551`, `App.tsx:22146, 28674, 29248`, `PlatformRolePortal.tsx:8621`, `TabletPlatformConsole.tsx:7200`) sudah memvalidasi `['image/jpeg', 'image/png', 'image/webp']` dan menolak PDF di sisi klien.
     - Satu-satunya sisa usang hanya atribut kosmetik `accept="image/*,.pdf"` di `frontend/desktop/src/components/SubscriptionPage.tsx:168` (komponen dead code — 0 tempat me-render `<SubscriptionPage` di seluruh `frontend/`).
   - Jika `UploadFile` mengizinkan PDF pada `category == "billing"` seperti tertulis di plan baris `57`:
     1. User/penyerang dapat mengunggah `bukti.pdf` ke `POST /api/storage/upload?category=billing` → sukses `200` dan menghasilkan `storage_key: "billing/.../xxx.pdf"`.
     2. `ValidatePaymentProofInput` di `sanitizer.go:539-550` **meloloskan** key `.pdf` karena hanya mengecek prefix `billing/`!
     3. Saat Superadmin membuka bukti pembayaran order tersebut di dashboard (`GET /api/admin/subscriptions/orders/:id/proof`), server justru meledak **`415 Unsupported Media Type`** karena `GetOrderProof` menolak `application/pdf`! Ini menciptakan *broken workflow* / DoS verifikasi pembayaran bagi admin.

2. **Perbaikan Wajib pada Paket 1.1 (`storage_handler.go` & `sanitizer.go`):**
   - **Batasi unggahan PDF di `UploadFile` HANYA untuk `category == "support"`** (`if category != "support" { return 415 }`), karena hanya modul tiket bantuan (`GET /api/support/attachments/:id` via `DocumentPreviewModal.tsx` berbasis PDF.js canvas) yang memang dirancang membaca dan me-render PDF secara aman!
   - Sekalian perketat `ValidatePaymentProofInput` di `backend/internal/security/sanitizer.go:539-550` agar hanya mengizinkan ekstensi gambar sah (`.jpg`, `.jpeg`, `.png`, `.webp`) pada storage key `billing/...` sehingga konsisten 100% dari hulu ke hilir.
   - **Cek juga `ServeLocalFile` (`storage_handler.go:453`):** Di `cmd/server/main.go:292-298`, static server `app.Static("/storage", ...)` sebenarnya **hanya jalan di fallback legacy** ketika `storageService == nil`! Pada mode normal (`STORAGE_DRIVER=local`), `GET /storage/*` dilayani oleh **`storageHandler.ServeLocalFile`** (`main.go:290` → `storage_handler.go:453`). Plan baris `47 & 85` hanya menaruh header `Content-Security-Policy: sandbox` & `Content-Disposition: attachment` di `main.go:294` (cabang mati saat `storageService != nil`), dan **lupa menaruhnya di `storage_handler.go:ServeLocalFile` (`:453-485`)**! Wajib pasang pengaman `.pdf` (atau blokir langsung penyajian `.pdf` dari pohon publik di `ServeLocalFile`) pada `storage_handler.go:ServeLocalFile` DAN `main.go:294`.

---

### BLOCKER-3 [Paket 1.6b / R4-L2]: Risiko Side-Effect Redis OTP & Kegagalan Order Opsional Jika Seluruh `Register` Dibungkus Satu `db.Transaction` Besar

1. **Bukti alur aktual `POST /api/register` di `backend/internal/handlers/auth_handler.go:580-1010`:**
   - Baris `627`: ketika OTP valid, kode memanggil `database.DeleteVerificationCode(emailClean, "register")` ke **Redis** (di luar PostgreSQL). Jika transaksi DB di bawahnya gagal/rollback karena input `payment_proof_url` tidak valid, OTP user di Redis **sudah terlanjur terhapus** sehingga user tidak bisa submit ulang form tanpa meminta kirim ulang email OTP!
   - Baris `860-960`: pembuatan `SubscriptionOrder` di dalam `Register` bersifat **best-effort / opsional** (`if req.PlanID != ""` dan `if err == nil && plan.ID != uuid.Nil`). Saat ini, jika `Create(&order)` gagal karena glitch ringan, kode hanya mencatat `log.Error()` (baris `950`) tanpa membatalkan akun & toko yang baru dibuat. Jika seluruh blok dimasukkan ke `db.Transaction` dan me-`return err`, error minor pada pembuatan order opsional atau kupon akan me-rollback akun user setelah OTP-nya hangus.
   - Selain itu, di baris `757-766`, pembuatan `Store` sudah memiliki retry loop 5x untuk menangani collision `slug` unik; di PostgreSQL, satu `UNIQUE constraint violation` di tengah `BEGIN ... COMMIT` langsung membuat seluruh transaksi berstatus **`current transaction is aborted, commands ignored until end of transaction block` (`SQLSTATE 25P02`)**, sehingga retry loop slug di baris `758` **pasti gagal total** bila berada di dalam transaksi tanpa `SAVEPOINT`!

2. **Perbaikan Wajib pada Paket 1.6b (`auth_handler.go`):**
   - **Langkah 1 (Fail-Fast Murni Sebelum Menyentuh Redis & DB):** Jalankan `security.ValidatePaymentProofInput(req.PaymentProofURL)` di bagian **paling awal validasi input `Register`** (sekitar baris `605`, **sebelum** `database.VerifyCode` / `DeleteVerificationCode` di baris `615-627` dan jauh sebelum `h.db.Create(&newUser)` di baris `734`)! Dengan begitu, `payment_proof_url` jahat langsung ditolak `400 Bad Request` tanpa menghanguskan OTP user dan tanpa menyentuh DB.
   - **Langkah 2 (Transaksi DB dengan Savepoint atau Cleanup Eksplisit untuk `User` + `Store`):** Jika ingin menjaga atomisitas `newUser` + `newStore`, gunakan `SAVEPOINT` (nested `tx.Transaction(...)` di GORM) pada percobaan insert `newStore` agar retry slug tidak memicu `SQLSTATE 25P02` di PostgreSQL, **atau** lakukan kompensasi eksplisit `h.db.Unscoped().Delete(&newUser)` bila seluruh 5 percobaan insert `newStore` gagal (serta simpan nilai tervalidasi `validatedProof` untuk dipakai langsung di baris `865`). Jangan biarkan validasi input terjadi sesudah `DeleteVerificationCode`.

---

## Koreksi Teknis Penting Lainnya (Non-Blocker tapi Wajib Diikuti)

### KOREKSI-4 [Paket 1.2 / 4 CVE Go]: Perilaku `GOTOOLCHAIN` pada Host `go1.26.9`

- Hasil pengecekan langsung di mesin ini:
  - Binary Go yang terpasang di PATH host saat ini adalah **`go1.26.9 windows/amd64`**, sedangkan `backend/go.mod` mendeklarasikan `go 1.25.0`.
  - Saat `govulncheck ./...` dijalankan dengan `GOTOOLCHAIN=auto` (default Go), Go otomatis mengunduh/memakai toolchain terbaru untuk analisis; namun bila server produksi dibuild dengan `GOTOOLCHAIN=local` atau menggunakan `go build` pada host `go1.26.9` tanpa kenaikan versi `go` di `go.mod`, binary hasil kompilasi tetap memakai stdlib `go1.26.9` yang rentan **`GO-2026-6859` (`net/http`, fix `go1.26.11`)** dan **`GO-2026-6809` (`crypto/x509`, fix `go1.26.10`)**.
- **Instruksi Eksekusi Paket 1.2:**
  1. Set direktif `go 1.26.11` (atau `toolchain go1.26.11`) di `backend/go.mod` sehingga Go `1.21+` dengan `GOTOOLCHAIN=auto` **secara deterministik** mengunduh dan mem-build binary menggunakan stdlib `go1.26.11` (bukan `go1.26.9`).
  2. Upgrade paket kompresi ke versi rilis stabil terbaru yang sudah diverifikasi tersedia di proxy Go:
     - `github.com/andybalholm/brotli` → **`v1.2.1` ke `v1.2.8`** (menutup `GO-2026-6888`, fix `>= v1.2.7`)
     - `github.com/klauspost/compress` → **`v1.19.2` ke `v1.20.4`** (menutup `GO-2026-6865`, fix `>= v1.20.2`)
  3. Verifikasi wajib memeriksa versi Go yang tertanam di binary hasil build dengan **`go version -m <binary>`** (harus tercetak `go1.26.11` atau lebih tinggi, bukan `go1.26.9`) SERTA `govulncheck ./...` = `No vulnerabilities found.`

---

### KOREKSI-5 [Paket 1.6a / R4-L1]: Pembatasan Skema Protokol di `isSameOriginUrl` & Perbedaan Kode Antar-Platform

1. **Tambahkan filter protokol eksplisit di `isSameOriginUrl`:**  
   Cuplikan di plan baris `222-233`:
   ```ts
   const parsed = new URL(trimmed, window.location.origin);
   return parsed.origin === window.location.origin;
   ```
   Meskipun di browser standar `javascript:` atau `data:` memiliki `origin === "null"` sedangkan `window.location.origin` adalah `"https://..."`, pada beberapa konteks WebView / `file://` / sandboxed iframe kedua nilainya sama-sama bisa bernilai string `"null"` (`"null" === "null"` → `true`!).  
   **Wajib perketat menjadi:**
   ```ts
   function isSameOriginUrl(url: string): boolean {
     const trimmed = url.trim();
     if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return false;
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
   }
   ```
2. **JANGAN copy-paste seluruh file `DocumentPreviewModal.tsx` antar `desktop`, `mobile`, dan `tablet`:**  
   Hasil pembacaan langsung membuktikan ketiga file **berbeda ukuran dan isi UI-nya**:
   - `frontend/desktop/src/components/DocumentPreviewModal.tsx` = **1.194 baris** (layout desktop)
   - `frontend/mobile/src/components/DocumentPreviewModal.tsx` = **1.167 baris** (layout mobile)
   - `frontend/tablet/src/components/DocumentPreviewModal.tsx` = **1.179 baris** (layout tablet, baris `isSameOriginUrl` ada di `:276`)  
   Agent pelaksana wajib melakukan **patch terarah hanya pada fungsi `isSameOriginUrl`** di masing-masing dari 3 file tersebut, lalu menjalankan `npx tsc --noEmit` dan `npm run build` di ketiga direktori sehingga bundel terkompilasi di `public/{desktop,tablet,mobile}/` ikut terbarui.

---

### KOREKSI-6 [Paket 1.4 / N-51]: Sinkronisasi Unit Test Existing `security_test.go` & `csp_test.go`

- File `backend/internal/middleware/security_test.go:100-140` (`TestSecurityHeaders_HSTSOnlyWhenSecure`) saat ini menguji ekspektasi lama (`strings.Contains(hsts, "max-age=31536000")` tanpa argumen `cfg`).
- Selain membuat test baru, agent pelaksana wajib memperbarui pemanggilan `SecurityHeaders(cfg)` di `backend/internal/middleware/security_test.go` dan `backend/internal/middleware/csp_test.go`, serta menambahkan asersi eksplisit bahwa:
  1. Default (`HSTSPreload: false`, `HSTSIncludeSubDomains: true`) pada koneksi HTTPS menghasilkan persis `max-age=31536000; includeSubDomains` (**tanpa** kata `preload`).
  2. Saat `HSTSPreload: true` dan `HSTSIncludeSubDomains: false`, direktif `preload` **tetap tidak boleh ditambahkan** karena spesifikasi HSTS Preload List (hstspreload.org) mewajibkan `includeSubDomains` sebagai prasyarat mutlak `preload` (`if cfg.HSTSPreload && cfg.HSTSIncludeSubDomains { hstsVal += "; preload" }`). Detail kecil ini mencegah header HSTS cacat standar RFC/preload list.

---

### KOREKSI-7 [Standar Verification Plan]: Larangan Keras Tes Grep Statis (`os.ReadFile`)

Mengingat temuan pada review Fase 0 sebelumnya (di mana sempat ditemukan unit test semu yang hanya memanggil `os.ReadFile("...go")` + `strings.Contains`), **seluruh unit test Fase 1 DILARANG KERAS menggunakan pembacaan teks kode sumber**. Setiap item wajib diuji secara **runtime HTTP nyata (`app.Test` / PostgreSQL/SQLite test DB)**:

1. **`N-47` (`storage_handler_test.go`):** Kirim multipart `POST /api/storage/upload` berisi byte `%PDF-1.4...` menggunakan `app.Test`:
   - `category=products`, `category=store`, `category=avatars`, `category=banners`, `category=articles`, **dan `category=billing`** → wajib HTTP `415`.
   - `category=support` → wajib HTTP `200`, `url == ""`, dan `storage_key` tersimpan di bawah pohon privat (`private/support/...` / di dalam `StoragePrivateRoot`), serta percobaan akses `GET /storage/<key>` pada `ServeLocalFile` mengembalikan `404`.
2. **`4 CVE Go`:** Jalankan `govulncheck ./...` (output `No vulnerabilities found.`) **dan** `go version -m` pada binary hasil `go build ./cmd/server` (memastikan stdlib Go `>= go1.26.11`, `brotli >= v1.2.7`, `compress >= v1.20.2`).
3. **`N-50` & `N-51` (`middleware/security_test.go` & `csp_test.go`):** Uji lewat `app.Test` dengan variasi `cfg.AppEnv` (`production` vs `local`), `cfg.AllowedOrigins`, `cfg.StoragePublicURL`, `cfg.HSTSPreload`, dan `X-Forwarded-Proto: https`:
   - Pastikan di `APP_ENV=production` token `http:` berdiri sendiri **tidak ada** di `img-src` maupun `connect-src`, sementara `https://api.qrserver.com` dan origin `AllowedOrigins`/`StoragePublicURL` hadir di `connect-src`.
4. **`N-57`:** Uji runtime pada router utama/test route bahwa `POST /api/api/telemetry/search` tidak lagi cocok ke handler telemetry (`404`/`405`), sedangkan `POST /api/telemetry/search` tetap aktif.
5. **`R4-L1`:** Build penuh `npx tsc --noEmit` + `npm run build` pada `frontend/desktop`, `frontend/tablet`, dan `frontend/mobile`; verifikasi file bundel baru di `public/{desktop,tablet,mobile}/assets/` ter-update dan uji kasus URL `isSameOriginUrl('/\\evil.com') === false`, `isSameOriginUrl('//evil.com') === false`, `isSameOriginUrl('https://evil.com/a.pdf') === false`, `isSameOriginUrl('/api/support/attachments/1') === true`.
6. **`R4-L2`:** Uji runtime `POST /api/register` dengan `payment_proof_url: "https://evil.example/x.png"` dan `payment_proof_url: "support/1/a.pdf"` → wajib HTTP `400`, jumlah baris di tabel `users` tetap `0` (tidak ada akun yatim), dan OTP registrasi (bila diuji bersama kode OTP valid) **tidak hangus** sebelum validasi format `payment_proof_url` lulus.
7. **Proteksi Server Live:** Jangan matikan atau menimpa proses produksi yang sedang berjalan di port `8000` (`GET http://127.0.0.1:8000/healthz` wajib tetap `200`). Jika perlu uji binary live, jalankan di port terpisah (mis. `8001` dengan `SKIP_DB_MIGRATE=true DB_AUTO_MIGRATE=false`) lalu matikan dan bersihkan binary sementara setelah selesai.

---

## Kesimpulan & Lampu Hijau Bersyarat untuk Agent Pelaksana

Dokumen `security-audit/implementation-plan-fase-1-2026-11-15.md` **BOLEH DIEKSEKUSI** oleh agent pelaksana **asalkan** revisi pada **BLOCKER-1, BLOCKER-2, BLOCKER-3** serta **KOREKSI-4 s/d KOREKSI-7** di atas langsung diterapkan dalam implementasinya (atau plan diperbarui terlebih dahulu mengacu ke dokumen review ini).
