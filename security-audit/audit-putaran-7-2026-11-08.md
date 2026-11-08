# Laporan Audit Keamanan Putaran 7 — Hybrid Adversarial Audit (Agent Native + Cloudflare Methodology)

**Tanggal Audit**: 8 November 2026  
**Baseline Commit**: `0f56b8a` (pasca-sinkronisasi `dev` & `agent-A` mencakup Analytics/Telemetry, Aulaa Payment Gateway & Auto-Login, Sponsored Ads/Showcase, dan Multi-Device Sessions)  
**Metodologi**:
1. **Disiplin Bawaan Agen (`flash-developer-discipline` & `SECURITY_CHECKLIST.md`)**: Zero-Trust code audit dari nol, isolasi multi-tenant (`store_id`), transaksi finansial atomik (`SELECT ... FOR UPDATE`), anti-err-leakage, dan paritas keamanan lintas Tri-Frontend (Desktop, Tablet, Mobile).
2. **Referensi Pelengkap Cloudflare (`cloudflare/security-audit-skill` — [`.agents/skills/security-audit/SKILL.md`](../../.agents/skills/security-audit/SKILL.md))**: Pendekatan 6 fase *"Every Finding Must Survive a Fight"* (Reconnaissance, Coverage-Led Hunting lintas 6 kelas serangan, Adversarial Disprove Phase, Klasifikasi Terstruktur `confirmed`/`needs_validation`/`rejected`, Verifikasi Independen Catatan Lama, dan Remediasi Defensif).

---

## 1. Verifikasi Independen Temuan Historis (Putaran 1–6 & Audit Aulaa)

Seluruh temuan dari putaran sebelumnya telah diaudit ulang secara langsung pada kode sumber (*code-as-truth*):

| ID / Referensi | Deskripsi Celah Historis | Lokasi Kode Terkini | Status Empiris |
| :--- | :--- | :--- | :--- |
| **Aulaa Gap #1** | `HandleAulaaWebhook` bersifat *fail-open* saat `WebhookSecret` kosong atau header `X-Webhook-Signature` absen. | `backend/internal/handlers/payment_handler.go:40-57` | **CLOSED** — *Fail-closed* (`503` jika secret kosong, `401` jika signature kosong/tidak cocok via `subtle.ConstantTimeCompare`). |
| **Aulaa Gap #2** | Tidak ada validasi kecocokan nominal (`payload.Amount < order.FinalAmount`) dan tidak ada row-locking pada webhook. | `backend/internal/handlers/payment_handler.go:92-110, 194-212` | **CLOSED** — Menggunakan `clause.Locking{Strength: "UPDATE"}` dan menolak *underpayment* dengan `400 Bad Request`. |
| **Aulaa Gap #3** | `aulaa_api_key` dan `aulaa_webhook_secret` berpotensi terekspos mentah di `GET /api/settings`. | `backend/internal/handlers/setting_handler.go:34-40, 260-264` | **CLOSED** — Terdaftar di `secretPlatformKeys` dan disensor dengan `maskSecretValue` (`****xxxx`). |
| **H1 / M4 / N-34** | Kebocoran pesan error internal (`err.Error()`) pada response HTTP JSON. | `backend/internal/handlers/errors.go`, `auth_handler.go` | **CLOSED** — Menggunakan `safeErrMsg()` yang hanya meneruskan `safeClientError` terwhitelist. |
| **H2 / N-31** | Kerentanan dependensi (`golang-jwt`, `fiber`, `pdfjs-dist` CVE-2024-4367). | `go.mod`, `frontend/*/package.json` (`pdfjs-dist@^6.4.299`) | **CLOSED** — `npm audit` = 0 kerentanan pada Desktop, Tablet, dan Mobile. |
| **M1 / N-33** | Sesi JWT tetap hidup setelah logout, ganti password, atau pencabutan role staf. | `backend/internal/middleware/auth.go`, `role_handler.go:361` | **CLOSED** — Cookie `httpOnly` + pencabutan sesi instan di DB & Redis (`RevokeAllSessionsForUser`). |
| **M2** | Penggunaan `'unsafe-inline'` dan `'unsafe-eval'` pada `script-src` di Content-Security-Policy (CSP). | `backend/internal/middleware/security.go:40-65` | **CLOSED** — `script-src 'self'` ditambah hash SHA-256 runtime untuk inline script sah; bebas `unsafe-eval`/`unsafe-inline`. |
| **ST-01 / N-40** | Akses publik ke berkas privat (`/storage/private/*`) dan potensi *path traversal* pada `Delete`/`DeletePrefix`. | `backend/cmd/server/main.go:258-264`, `backend/internal/storage/storage.go:122-153` | **CLOSED** — Blokir keras `/storage/private|support|billing` (`403`) dan validasi `resolveSafeKey` + `filepath.Rel`. |
| **N-29** | Endpoint `/api/admin/security/safe-domains` tidak memiliki guard permission spesifik. | `backend/cmd/server/main.go:734-738` | **CLOSED** — Dijaga oleh `middleware.RequirePermission(cfg, "system:settings:manage")`. |

---

## 2. Temuan Celah Baru Putaran 7 (`confirmed`) & Remediasi Langsung

Melalui penyisiran Fase 2 (*Coverage-Led Hunting*) dan Fase 3 (*Adversarial Validation*) terhadap fitur-fitur terbaru, ditemukan **5 celah keamanan baru** yang seluruhnya telah **langsung diperbaiki dan diverifikasi** pada putaran ini:

| ID | Keparahan | Kelas Serangan | Lokasi & Mekanisme Celah | Remediasi yang Diterapkan | Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **N-41** | **HIGH** | Tenant Isolation (IDOR / BOLA) & Financial Race Condition | `backend/internal/handlers/payment_handler.go:284-380` (`SyncOrderStatus`). Endpoint dipasang di rute merchant (`POST /api/subscription/orders/:id/sync`) dan admin, namun melakukan lookup `SubscriptionOrder` berdasarkan `:id` / `order_number` tanpa memeriksa `order.StoreID == c.Locals("store_id")`. Merchant dapat mengintip detail pesanan dan kuota toko lain. Selain itu, transisi status `"paid"` belum memakai `SELECT ... FOR UPDATE` dan belum memvalidasi `statusResp.Amount >= order.FinalAmount`, serta membocorkan `err` mentah di pesan error. | 1. Memeriksa apakah pemanggil adalah `IsPlatformStaff()`; jika bukan, wajibkan `order.StoreID == callerStoreID` (kembalikan `404` bila tidak cocok).<br>2. Memvalidasi `statusResp.Amount >= order.FinalAmount`.<br>3. Membungkus pembaruan status & `UpgradeStorePlan` dalam transaksi DB dengan `clause.Locking{Strength: "UPDATE"}`.<br>4. Menyensor error upstream Aulaa. | **FIXED** |
| **N-42** | **HIGH** | SSRF & Stored API Key Exfiltration | `backend/internal/handlers/payment_handler.go:383-420` (`TestAulaaConnection`) & `backend/internal/services/aulaa_service.go:34-62`. `TestAulaaConnection` memuat `cfg.APIKey` asli dari DB lalu mengizinkan override `req.BaseURL` tanpa validasi skema/IP dan tanpa mewajibkan input ulang `APIKey`. Jika `req.BaseURL` diarahkan ke host eksternal atau IP internal/metadata (`169.254.169.254`, `127.0.0.1`), server mengirimkan header `Authorization: Bearer <SAVED_API_KEY>` ke host tersebut dan memantulkan body respons mentah. | 1. Menambahkan `services.ValidateAulaaBaseURL()` yang mewajibkan `https://`, menolak kredensial URL, dan memblokir loopback, RFC1918 private IP, serta link-local metadata IP baik pada literal maupun hasil resolusi DNS.<br>2. Menolak pengiriman `APIKey` tersimpan ke `BaseURL` baru kecuali admin memasukkan `APIKey` secara eksplisit.<br>3. Memvalidasi `aulaa_base_url` saat disimpan di `SettingHandler.Store` dan mencegah nilai masking `****` menimpa secret asli. | **FIXED** |
| **N-43** | **MEDIUM** | Broken Access Control & Admin PII Disclosure | `backend/cmd/server/main.go:623` & `backend/internal/handlers/setting_handler.go:625-639` (`GET /api/settings/policy-audit-logs`). Rute `POST /settings` dan `POST /settings/policies` dilindungi `RequirePermission(cfg, "system:settings:manage")`, tetapi `GET /settings/policy-audit-logs` hanya berada di grup `guarded` (`StoreOwnerRequired`), sehingga merchant biasa dapat membaca `AdminEmail` dan `AdminIP` milik Superadmin. | Memasang middleware `middleware.RequirePermission(cfg, "system:settings:manage")` pada `GET /api/settings/policy-audit-logs` di `main.go` serta menambahkan pengecekan `middleware.IsPlatformStaffRole(user.PlatformRole)` di dalam handler `GetPolicyAuditLogs`. | **FIXED** |
| **N-44** | **MEDIUM** | Telemetry Amplification & Signature Bypass | `backend/internal/handlers/ad_handler.go:187-226, 742`.<br>1. Pada `HandleAdClick`, hasil boolean `services.VerifyClickSignature(...)` dibuang (`_ = ...`) sehingga klik tanpa signature valid tetap memicu `RecordClick`.<br>2. Pada `RecordImpressionBatch`, slice `[]ImpressionPayload` tidak dibatasi ukurannya dan tidak dideduplikasi per request.<br>3. Pada `VerifyAdPayment` baris 742, `err.Error()` dikembalikan mentah. | 1. Hanya memanggil `RecordClick` apabila `sigValid == true` dan `camp.Status == "active"` (redirect 302 tetap berjalan normal bagi pengunjung).<br>2. Membatasi `RecordImpressionBatch` maksimal 50 item per request dan mendeduplikasi pasangan `(campaign_id, ad_slot_id)`.<br>3. Mengganti `err.Error()` di `VerifyAdPayment` dengan `safeErrMsg`. | **FIXED** |
| **N-45** | **LOW / MEDIUM** | Feature-Toggle Bypass & CSV Formula Injection | `backend/internal/handlers/analytics_handler.go:1526-1800` & `backend/internal/services/market_intelligence_service.go:290-346`. Toggle `market_intel_enabled` hanya diperiksa pada `GetMarketIntelligenceSummary`, namun dilewati pada sub-endpoint `ExportMarketIntelligenceData`, `GetTrendingKeywords`, `GetDemandGaps`, dan `GetCategoryPriceBenchmarks`. Selain itu, nama kategori pada `GenerateMarketIntelligenceCSV` belum disanitasi terhadap CSV formula injection (`=`, `+`, `-`, `@`). | 1. Membuat helper `isMarketIntelAllowed(c)` yang mengizinkan staf platform setiap saat dan menegakkan toggle `market_intel_enabled` secara konsisten di kelima endpoint Market Intelligence.<br>2. Menambahkan `sanitizeMarketCSVCell()` pada `GenerateMarketIntelligenceCSV`. | **FIXED** |
| **N-46** | **HIGH** | Storage Root Wipe via `DeletePrefix(".")` Canonicalization Mismatch | `backend/internal/storage/storage.go:122-184` (`resolveSafeKey` & `DeletePrefix`). Pada `resolveSafeKey`, `candidate` dinormalisasi dengan `filepath.EvalSymlinks` sementara `absRoot` hanya menggunakan `filepath.Abs` tanpa `EvalSymlinks`, dan `rel == "."` tidak ditolak di `resolveSafeKey`. Ketika `root` memiliki perbedaan kapitalisasi drive atau symlink/junction (misal `c:\...` vs `C:\...`), perbandingan `filepath.Clean(targetDir) == filepath.Clean(absRoot)` di `DeletePrefix(".")` bernilai `false` dan mengeksekusi `os.RemoveAll` pada root storage itu sendiri. | 1. Menormalisasi `absRoot` dengan `filepath.EvalSymlinks(absRoot)` di `resolveSafeKey` dan `DeletePrefix`.<br>2. Menolak `rel == "."` secara eksplisit di `resolveSafeKey`.<br>3. Menambahkan `strings.EqualFold` pada pengecekan root guard di `DeletePrefix`. Terverifikasi lulus `TestDeletePrefix_RefusesRootItself`. | **FIXED** |

---

## 3. Kandidat yang Ditolak melalui Uji Sanggah Adversarial (`rejected` / False Positives)

Sesuai Fase 3 metodologi Cloudflare (*Adversarial Candidate Validation*), kandidat berikut sempat dicurigai namun terbukti **aman (guarded)** setelah ditelusuri dari hulu ke hilir:

1. **Kandidat: Manipulasi Kuota / Plan via Auto-Login Registrasi Baru (`auth_handler.go:883-1010`)**
   - *Sanggahan*: Walaupun `Register` langsung mengembalikan token sesi (`setSessionCookie`) agar pengguna tidak perlu login ulang, apabila `requestedPlan != "free"` dan `finalAmount > 0`, kolom `newStore.Plan` tetap diinisialisasi sebagai `"free"` dengan `PaymentStatus = "pending"` (`auth_handler.go:793-815`). Paket berbayar baru diaktifkan setelah webhook terverifikasi HMAC (`HandleAulaaWebhook`) atau sinkronisasi ber-otorisasi (`SyncOrderStatus`) menerima konfirmasi lunas dari Aulaa.
2. **Kandidat: IDOR pada Pencabutan Sesi Perangkat (`session_handler.go:84-135`)**
   - *Sanggahan*: `RevokeSession` memfilter kueri berdasarkan `WHERE id = ? AND user_id = ?` menggunakan `user.ID` dari konteks JWT terautentikasi (`session_handler.go:100-104`). Pengguna tidak dapat mencabut sesi milik pengguna lain.
3. **Kandidat: SQL Injection pada Filter Analitik & Market Intelligence (`analytics_handler.go`)**
   - *Sanggahan*: Seluruh parameter rentang tanggal (`startDate`, `endDate`), `storeID`, dan kata kunci pencarian dikirim sebagai *parameterized bind variables* (`?`) pada GORM `db.Raw(...)` serta melewati `CleanSearchKeyword` dan validasi panjang karakter.

---

## 4. Item Konfigurasi Lingkungan Produksi (`needs_validation` saat Deployment)

Item berikut bersih di level kode aplikasi, namun wajib dipastikan oleh tim DevOps/Infrastruktur pada lingkungan produksi:
1. **Variabel Lingkungan Wajib Produksi**: Pastikan `APP_ENV=production`, `JWT_SECRET` minimal 32 byte acak kriptografis, `REDIS_URL` aktif dan terhubung, serta `AULAA_ALLOW_LOCAL_HTTP` **tidak** disetel ke `true`.
2. **Konfigurasi Proxy & Trusted Headers**: Pastikan `ENABLE_TRUST_PROXY=true` dan `TRUSTED_PROXIES` hanya berisi CIDR Cloudflare / Reverse Proxy internal agar header `X-Forwarded-For` (`c.IP()`) tidak dapat dipalsukan untuk melewati *rate limiter*.
3. **Kredensial Gateway Aulaa**: Pastikan `aulaa_api_key` dan `aulaa_webhook_secret` telah diisi di panel Superadmin sebelum mengaktifkan mode pembayaran `gateway_aulaa`.
