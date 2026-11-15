# Catatan Verifikasi Independen — Hasil Eksekusi Fase 1 (P1 & Quick Wins)

**Tanggal Verifikasi:** 15 November 2026  
**Reviewer Independen:** Hermes Agent (Security Code Audit)  
**Dokumen Acuan:**  
- `security-audit/implementation-plan-fase-1-2026-11-15.md`  
- `security-audit/implementation-plan-putaran-8-2026-11-14.md`  
**Baseline Git:** `662c85c` + working tree Fase 1  
**Keputusan Akhir:** ✅ **LULUS VERIFIKASI PENUH (0 BLOCKER, 0 REGRESI)** — Siap di-commit & lanjut ke Fase 2  

---

## 1. Ringkasan Audit Silang (Klaim Agent vs Kode Aktual & Bukti Runtime)

Seluruh perubahan kode di `backend/`, `frontend/{desktop,tablet,mobile}/`, `public/{desktop,tablet,mobile}/`, serta catatan laporan eksekusi di bagian 5 `implementation-plan-fase-1-2026-11-15.md` telah diaudit baris demi baris dan diuji ulang secara independen.

| Paket | Kode Temuan | Verifikasi Implementasi Aktual | Verifikasi Test & Runtime Independen | Status |
|---|---|---|---|---|
| **1.1** | **N-47** (HIGH) | `storage_handler.go:154-179, 329`: PDF divalidasi magic bytes `%PDF-`, dikunci murni hanya `category == "support"` (`415` untuk `products`, `billing`, dll.), dipaksa prefix `private/`, `uploadSize` akurat (`buf = bytes.NewBuffer(fileBytes)`). `main.go:280-315` & `support_handler.go:2624-2638`: seluruh penyajian PDF dipaksa `Content-Disposition: attachment` + `Content-Security-Policy: sandbox; default-src 'none'`. | `TestPDFUploadGating_N47` (`storage_handler_test.go`) & `TestSupportServeAttachment_SQLite/lampiran_pdf_forced_attachment_dan_csp_sandbox` (`support_handler_test.go`) adalah HTTP runtime test nyata (`app.Test`), lulus 100%. | ✅ **LULUS** |
| **1.2** | **4 CVE Go** (HIGH/MED) | `backend/go.mod`: direktif `go 1.26.11`, `andybalholm/brotli v1.2.8`, `klauspost/compress v1.20.4`. | Eksekusi independen `GOTOOLCHAIN=auto govulncheck ./...` → **`No vulnerabilities found.`** (`0` affected). Build independen binary sementara + `go version -m` → terbukti dikompilasi dengan **`go1.26.11`**, `brotli v1.2.8`, `compress v1.20.4` (binary sementara dihapus bersih). | ✅ **LULUS** |
| **1.3** | **N-50** (MEDIUM) | `middleware/security.go:18-128`: helper `extractCSPOrigin` menolak wildcard/injeksi `;`; `img-src` non-local mencabut `http:`; `connect-src` mencabut wildcard global dan mem-whitelist eksplisit `https://api.qrserver.com` (Download PNG QR), `googleapis.com`, `accounts.google.com`, GA4, AdSense (`*.adtrafficquality.google`, `*.googletrafficquality.google`), serta origin valid dari `cfg.AppURL`, `cfg.StoragePublicURL`, dan `cfg.AllowedOrigins`. | `TestCSPTightening_ProductionVsLocal` & `TestExtractCSPOrigin` (`security_test.go`) lulus 100% tanpa merusak test CORS/CSP lama. | ✅ **LULUS** |
| **1.4** | **N-51** (LOW-MED) | `config.go:54-55, 169-170, 224-225` & `middleware/security.go:131-140`: `HSTSIncludeSubDomains` (default `true`) dan `HSTSPreload` (default `false`); `preload` hanya disisipkan bila `HSTSIncludeSubDomains == true`. | `TestHSTSOptions` (3 kombinasi flag) & `TestHSTSOnlyOverHTTPS` lulus 100%. | ✅ **LULUS** |
| **1.5** | **N-57** (LOW) | `cmd/server/main.go:452`: route duplikat `api.Post("/api/telemetry/search", ...)` dihapus bersih; route kanonik `POST /api/telemetry/search` tetap utuh. | `TestTelemetryRoute_N57` (`analytics_handler_test.go`) memakai router `fiber.New()` + `app.Test` runtime (`202` di `/api/telemetry/search` vs `404` di `/api/api/telemetry/search`). **0 tes baca teks statis (`os.ReadFile`) baru.** | ✅ **LULUS** |
| **1.6a** | **R4-L1** (LOW Defensif) | `frontend/{desktop,tablet,mobile}/src/components/DocumentPreviewModal.tsx`: patch terarah per file (jumlah baris tetap berbeda: `1209`, `1213`, `1207` — tidak terjadi copy-overwrite antar platform); parser WHATWG `new URL(trimmed, baseOrigin)` menolak `//`, `/\`, `\`, `data:`, `blob:`, non-`http(s):`, dan `origin === 'null'`; ketiga `fetch()` memakai `credentials: isSameOriginUrl(...) ? 'include' : 'omit'`. | `npx tsc --noEmit` (Node `v22.13.0` fnm) = **0 error** di ketiga SPA. Inspeksi langsung bundle terkompilasi `public/desktop/assets/index-C9ILLEDZ.js`, `public/tablet/assets/index-D0iT5E7h-t.js`, dan `public/mobile/assets/index-dk2hTSkB.js` membuktikan kode baru `isSameOriginUrl` sudah masuk ke seluruh bundle produksi. | ✅ **LULUS** |
| **1.6b** | **R4-L2** (LOW Integritas) | `auth_handler.go:674-815, 845, 899-907`: kalkulasi paket, validasi kupon (`ValidateCoupon` read-only), cek `payment_system_mode == "maintenance"`, dan `security.ValidatePaymentProofURL` dieksekusi **pre-flight** sebelum `ValidateAndConsumeToken` (`:845`) dan sebelum `Create(&newUser)` (`:877`), ditambah kompensasi `Unscoped().Delete(&models.User{}, targetUser.ID)` jika `Create(&newStore)` (`:899`) gagal. | `TestRegister_PreFlightPaymentProofValidation` (`auth_handler_test.go`) mengeksekusi `POST /api/register` runtime di SQLite in-memory → status `400`, `userCount == 0` (0 orphan user), dan token OTP terbukti masih hidup saat diuji ulang. | ✅ **LULUS** |

---

## 2. Catatan Observasi Non-Blocker (Minor Defense-in-Depth Opsional, Tidak Menghalangi Lulus Fase 1)

Dua detail kecil berikut **bukan kerentanan hidup** pada konfigurasi saat ini, dicatat murni sebagai referensi kebersihan ke depan:
1. **`cmd/server/main.go:240-245 & 325-332` (Cabang Offline `app.Static("/storage", ...)` saat non-cloud driver):** Saat `STORAGE_DRIVER=local`, berkas publik di `/storage/*` dilayani oleh `app.Static` (setelah middleware pemblokir `private/`, `support/`, `billing/`). Saat ini upload PDF baru sudah mustahil masuk ke pohon publik (ditolak `415` + dipaksa `private/`), dan di disk lokal terverifikasi `0` berkas `.pdf` publik. Bila suatu hari admin menaruh file `.pdf` manual ke folder `storage/` publik pada mode lokal, middleware `app.Use("/storage", ...)` di baris `234` bisa ikut menyetel header `Content-Disposition: attachment` + `CSP: sandbox` bila `strings.HasSuffix(rel, ".pdf")`.
2. **`middleware/security.go:51` (`X-XSS-Protection`):** Masih bernilai legacy `"1; mode=block"` (tidak masuk scope wajib `N-50`/`N-51` pada plan, dan test eksisting `security_test.go:116` masih menguji non-empty). Opsional di fase pembersihan header berikutnya bila ingin diselaraskan ke standar OWASP terbaru (`"0"`).

---

## 3. Rekap Bukti Eksekusi Verifikasi Independen

- **`GOTOOLCHAIN=auto go test -count=1 ./...`:** Seluruh 9 paket backend ber-test (`config`, `database`, `handlers`, `middleware`, `models`, `security`, `services`, `storage`, `utils`) **PASS 100%**.
- **`GOTOOLCHAIN=auto govulncheck ./...`:** **`No vulnerabilities found.`** (`Your code is affected by 0 vulnerabilities.`).
- **`go version -m` pada binary uji independen:** `go1.26.11`, `github.com/andybalholm/brotli v1.2.8`, `github.com/klauspost/compress v1.20.4`.
- **`npx tsc --noEmit` (Node `v22.13.0`) & Inspeksi Bundle `public/`:** Desktop, Tablet, dan Mobile **0 error**, bundle `public/{desktop,tablet,mobile}/assets/index-*.js` terverifikasi memuat patch `R4-L1`.
- **Kesehatan Server Live (`http://127.0.0.1:8000/healthz`):** Tetap **`200 OK`** tanpa gangguan.
