# Catavor Platform — Master Audit Registry & Log Temuan

Dokumen ini menjadi **Single Source of Truth (SSOT)** lintas sesi untuk melacak status audit mendalam seluruh modul Platform Catavor (`Backend Go`, `PostgreSQL`, `Background Workers`, serta `Tri-Frontend: Desktop, Tablet, Mobile`), lengkap dengan sub-catatan temuan, akar masalah berbasis bukti kode aktual, dan rencana remediasi terstruktur.

---

## 0. Standar Tata Kelola & Klasifikasi Audit

### 0.1 Status Modul
| Status | Arti |
| :--- | :--- |
| **AUDITED & VERIFIED** | Audit mendalam lintas BE + DB + Security + Tri-Frontend sudah selesai, perbaikan tuntas, dan terverifikasi runtime/test. |
| **AUDITED (REMEDIASI PENDING)** | Audit kode & UI lintas device sudah selesai dan temuan tercatat; menunggu fase implementasi perbaikan & verifikasi. |
| **PARTIAL / LAMA** | Pernah disentuh audit umum / perbaikan parsial pada siklus lama; belum diaudit khusus secara menyeluruh dengan standar saat ini. |
| **NOT YET AUDITED** | Belum memiliki audit fitur khusus lintas peran (Public, Merchant, Admin Pengelola) & Tri-Frontend. |

### 0.2 Tingkat Keparahan Temuan (Severity)
- **P0 — Critical**: Kerusakan alur inti (*deadlock* fungsi bisnis), celah otorisasi/isolasi tenant, atau kehilangan data. Wajib diperbaiki lebih dulu.
- **P1 — High**: Kegagalan paritas Tri-Frontend yang memblokir pengguna suatu device, mismatch kontrak API, atau race/edge case penghapusan data.
- **P2 — Medium**: Kelemahan defensif, error silent, ketidaksinkronan filter/kebijakan, atau *hardening* keamanan operasional.
- **P3 — Low**: Konsistensi microcopy, estetika standar enterprise (termasuk kepatuhan anti-emoji), dan dokumentasi teknis.

---

## 1. Peta Status Audit Seluruh Modul Platform

### 1.1 Modul Sudah Diaudit & Terverifikasi (`18` Modul)

| No | Modul / Fitur | Cakupan Audit | Referensi Commit & Dokumen | Status |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Pelaporan & Moderasi (`Reports & Compliance`)** | Alur Public (7 tipe katalog), Admin Pengelola (Desktop/Tablet/Mobile), Admin Merchant (`needs_fix`, banding, retensi FK, rate-limit `429`) | `cc03c786`, `b3c9fb56`, `c1b265af`, `71542e86`, `8ebc3acc`, `880e6f70`, `929d45e1`, `61641cab` | **AUDITED & VERIFIED** |
| 2 | **Audit Trail & Kepatuhan (`Activity Logs`)** | Append-only immutability, rantai hash HMAC, filter kepatuhan, ekspor, serta paritas tampilan Merchant & Pengelola (Desktop/Tablet/Mobile) | `2cf7e740`, `0bc993e8` | **AUDITED & VERIFIED** |
| 3 | **Analytics & B2B Market Intelligence** | Timezone WIB, metrik produk period-scoped, *k-anonymity*, anti-CSV injection/BOM, ZIP/CSV export, serta paritas Desktop/Tablet/Mobile | `4f290779`, `820ef08b`, `e8c4fc1e`, `6a82b4bf`, `1f58db95`, `92304676`, `cb6ec85d`, `3d765246`, `6528dab8` | **AUDITED & VERIFIED** |
| 4 | **Monetisasi, AdSense & Sponsored Ads** | Rotator HMAC, anti-fraud impresi/klik, kebijakan AdSense toko Free vs Pro, zero-empty guard, feature flag iklan internal | `b90342b5`, `f8061822`, `7fdbb911`, `36b1791` / `acbd3d5b`, `82d62dd1`, `dd74a35e` | **AUDITED & VERIFIED** |
| 5 | **Langganan, Kupon & Gateway Aulaa (`Billing`)** | State machine subscription, mid-cycle proration, relasional kupon, single in-flight order guard, audit finansial, UI banner & pending lock | `b2031e02`, `0cf98938`, `c701c4e2`, `a8dd0d02`, `d81ba57b`, `a4643589`; `docs/AULAA_PAYMENT_GATEWAY_AUDIT_REPORT.md`, `docs/audit/2026-11-20-pembayaran-admin-audit-dan-rencana.md` | **AUDITED & VERIFIED** |
| 6 | **Helpdesk, Tiket & SLA (`Support`)** | Agent ownership, business-hours SLA (`pro_starter`/`pro_business`), idempotency, SSE real-time & presence, lampiran aman, KB deflection | `c6280720`, `717ee095`, `758ee958`, `ccbea812`, `0b24174b`, `54abae59`, `c78162a1` | **AUDITED & VERIFIED** |
| 7 | **Broadcast Platform & SSE Hub** | Otorisasi rute admin, penjadwal broadcast, SSE hub & fallback polling, dirty-form guard, paritas konsol 3 device | `f8b5ef73`, `881ebd9c`, `605df1d5`, `3e744778`, `b06f755e` | **AUDITED & VERIFIED** |
| 8 | **RBAC & Custom Roles** | Fail-closed custom role permissions, governance staf, isolasi middleware grup route Fiber v2, matriks Tri-Frontend | `a46436e2`, `0edf687e`, `4d0a547b`, `ff2d9957`, `603c7f45` | **AUDITED & VERIFIED** |
| 9 | **Custom Domain** | Verifikasi DNS enterprise, host routing, Caddy On-Demand TLS, invalidasi cache Redis saat rename/hapus/dormancy | `06eacbf3`, `264d6649`, `33d1776e` | **AUDITED & VERIFIED** |
| 10 | **Kebijakan & Dokumen Hukum (`Policies`)** | Pengelolaan kebijakan dinamis dari DB, audit log persetujuan, rendering markdown lintas device, navigasi halaman vs sheet | `22f146e6`, `947b9dd5`, `50e6bb64`, `c6da39fe`, `b537205a`; `docs/policy-redesign-implementation-plan.md` | **AUDITED & VERIFIED** |
| 11 | **MFA, Auth Token & Edge Hardening** | TOTP & backup codes, lockout durable, mandatory MFA staf, session completion atomik, XFF & nonce OAuth Google | `f024bd90`, `3b69a626`, `81ab0e13`, `63c7910a`, `7c91dfe8`, `25ce0bdb` | **AUDITED & VERIFIED** |
| 12 | **Mesin Otomasi Platform (`Automation Engine`)** | Pemisahan 25 katalog worker & 11 kontrol manual, RBAC trigger, preview simulasi tanpa mutasi | `1b650405`, `932900b2`, `76ed14fb`; `docs/audit/2026-11-19-audit-mesin-otomasi-platform.md` | **AUDITED & VERIFIED** |
| 13 | **Storage S3/Lokal & Catalog Export** | Kebijakan retensi file, driver S3 & factory coverage, RBAC ekspor katalog & produk, sanitasi path | `d1982d39`, `1ec786e5`, `a9927421`, `3c9dc628`; `docs/audit/2026-10-31-audit-merchant-admin-triple-device-storage-s3.md` | **AUDITED & VERIFIED** |
| 14 (**A1**) | **Dormancy Toko, Reaktivasi & Retensi Item/File** | Siklus 30/38/45/60 hari, 2-step Magic Link, self-reactivation dormant vs moderasi block, retensi H-7/H-30/H-90 & 72j, worker banned 90h, metrics & paritas Desktop/Tablet/Mobile | Audit & Remediasi `2026-11-28` (`c9abd10f`, `6400264d`; test baru: `dormancy_handler_test.go`, `item_retention_service_test.go`, Playwright E2E `12/12` pass) | **AUDITED & VERIFIED** |
| 15 (**A2**) | **Registrasi Merchant, OTP, Google SSO & Checkout Paket Awal** | Transaksi atomik `Register` + `GoogleAuth` Case B, `BlacklistedSlug`, OTP UTC + outbox + cooldown lock + no-emoji, `CheckEmail` anti-enumeration `N-17`, rate-limit `CheckSlug`, fallback `gateway_aulaa`, harga paket dinamis `/subscription/plans`, paritas Desktop/Tablet/Mobile + modal back/drag | Audit & Remediasi `2026-11-28` (`34479b6b`, `922e8d29`; test baru di `auth_handler_test.go`, `otp_service_test.go`; Playwright + HTTP `6/6` pass) | **AUDITED & VERIFIED** |
| 16 (**A3**) | **Direktori Toko Pengelola & Pengaturan Global Platform** | `store_handler.go` (`AdminListStores`, `AdminGetStoreDetail`), `setting_handler.go` (key allowlist + sanitasi secret lossless + isolasi `master_coupons`), `AdminStoresManagement.tsx`, `TabletPlatformConsole.tsx`, `PlatformRolePortal.tsx`, `TabletOfficialContactModal.tsx` | Audit & Remediasi `2026-11-28` (`211a735b`, `75aed896`; test regresi di `rbac_handler_test.go`, `store_handler_test.go`; Playwright + HTTP `18/18` pass) | **AUDITED & VERIFIED** |
| 17 (**A4**) | **Pusat Notifikasi In-App & Siklus Hidup SSE** | `notification_handler.go`, `notification_hub.go`, `notification_cleaner.go`, `notification.go`, `middleware/auth.go`, `NotificationHeaderPopover.tsx`, `MerchantAdminShell.tsx`, `Desktop/Mobile App.tsx`, `TabletMerchantAdmin.tsx`, `TabletHelpdeskView.tsx`, `PlatformRolePortal.tsx`, `TabletPlatformConsole.tsx` | Audit & Remediasi `2026-11-28` (`96977723`, `cb8a9939`; test baru di `notification_handler_test.go` & `notification_hub_test.go`; HTTP + SSE + Playwright `7/7` pass) | **AUDITED & VERIFIED** |
| 18 (**A5**) | **Safe Domains & Peringatan Tautan Eksternal** | `safe_domain_handler.go`, `models/safe_domain.go`, `database/redis.go`, `urlSecurity.ts` (`3` device), `ExternalLinkWarningModal.tsx` (`3` device), `AdminSafeDomainsManagement.tsx` (`3` device), `PlatformRolePortal.tsx` (`Mobile`), `Desktop/Mobile App.tsx`, `TabletStoreCatalog.tsx` | Audit & Remediasi `2026-11-28` (lihat [Bagian A5](#a5-audit-mendalam-safe-domains--peringatan-tautan-eksternal-2026-11-28); suite baru `safe_domain_handler_test.go`; HTTP + Playwright `5/5` pass) | **AUDITED & VERIFIED** |

---

### 1.2 Modul Sedang Diaudit / Menunggu Remediasi (`0` Modul)

*Tidak ada modul berstatus pending remediasi saat ini.*

---

### 1.3 Antrean Modul Tersisa Untuk Audit Berikutnya (`3` Modul)

| Urutan | Modul / Fitur Tersisa | Area Kode Utama | Alasan / Indikasi Risiko Awal | Status |
| :--- | :--- | :--- | :--- | :--- |
| **A6** | **Connected Devices & Manajemen Sesi Aktif** | `session_handler.go`, `ConnectedDevicesView.tsx`, `TabletConnectedDevicesView.tsx` | Tidak memiliki `session_handler_test.go`; perlu audit akurasi parsing User-Agent/IP di balik proxy, efek pencabutan sesi real-time (token/cookie/SSE), dan paritas UI 3 device. | **NOT YET AUDITED** |
| **A7** | **Share Catalog, QR Code & Etalase Discovery Publik (7 Tipe Katalog)** | `DesktopShareCatalogView.tsx`, `TabletShareCatalogView.tsx`, `TabletQRCodeModal.tsx`, `TabletPublicLanding.tsx`, `product_handler.go` | Share & QR Code (`21dce314`) serta etalase publik 7 tipe katalog pasca banyak update besar perlu dicek ulang untuk memastikan nol *drift* antar 3 device (termasuk dukungan custom domain & OpenGraph). | **PARTIAL / LAMA** |
| **A8** | **Artikel (`article_handler.go`) & Master Kategori (`category_handler.go`)** | `article_handler.go`, `category_handler.go` | `article_handler.go` belum punya unit test dan terakhir disentuh saat refactor DI (`2a36e96e`). Perlu verifikasi apakah masih rute aktif atau jalur mati (*dead path*). | **NOT YET AUDITED** |

---

## 2. Log & Sub-Catatan Audit Mendalam Per Modul

---

### A1. Audit Mendalam: Dormancy Toko, Reaktivasi & Retensi Item/File (`2026-11-28`)

#### A1.1 Ruang Lingkup & File Terinspeksi
Audit dilakukan dengan membaca langsung kode sumber backend, middleware, template email, dan seluruh tiga antarmuka frontend:
- **Backend & Routing**:
  - `backend/cmd/server/main.go` (L139–191, L456–458, L573–577, L706–708, L742–743)
  - `backend/internal/middleware/auth.go` (L926–1019 — `StoreOwnerRequired` & `OperationalStoreRequired`)
  - `backend/internal/handlers/dormancy_handler.go` (full L1–176)
  - `backend/internal/handlers/store_handler.go` (`ShowStore` L239–330, `AdminListStores` L2480–2585)
  - `backend/internal/services/dormancy_service.go` (full L1–935)
  - `backend/internal/services/item_retention_service.go` (full L1–660)
  - `backend/internal/services/store_deletion.go` (full L1–234)
  - `backend/internal/services/email_templates.go` (`BuildItemRetention*` L832–892)
- **Test Terkait**:
  - `backend/internal/handlers/cloudflare_audit_remediation_test.go` (L292–315)
  - `backend/internal/services/item_retention_service_test.go` (L1–120)
  - `backend/internal/handlers/automation_runtime_test.go` (L380–520)
- **Frontend (Desktop, Tablet, Mobile)**:
  - Desktop: `frontend/desktop/src/App.tsx` (L4545–4593, L6080–6215, L21838–21950, L22520–22800), `frontend/desktop/src/components/PlatformRolePortal.tsx` (L2212–2223, L3583, L3640, L3693, L4212, L5145), `frontend/desktop/src/components/AdminStoresManagement.tsx` (L896–897, L2935–2936)
  - Tablet: `frontend/tablet/src/components/TabletSuspendedLockView.tsx` (full L1–454), `frontend/tablet/src/components/TabletMerchantAdmin.tsx` (cek banner & extend handler), `frontend/tablet/src/components/TabletPlatformConsole.tsx` (L441–466), `frontend/tablet/src/components/TabletPlatformStoresView.tsx` (L932, L2226–2227)
  - Mobile: `frontend/mobile/src/App.tsx` (L6161–6195, L26243–26480, L26575–26682), `frontend/mobile/src/components/PlatformRolePortal.tsx` (L2286–2297, L3624, L3681, L3741, L4225, L5208), `frontend/mobile/src/components/AdminStoresManagement.tsx` (L1415–1420)
  - Policy Copy: `frontend/{desktop,tablet,mobile}/src/utils/policyShared.tsx` (L432–437)

#### A1.2 Baseline Test Saat Audit (`2026-11-28`)
| Pemeriksaan | Hasil | Catatan |
| :--- | :--- | :--- |
| `go test -count=1 -v ./internal/handlers -run "TestCloudflareAudit_DormancyReactivationBlocksModerationSuspended"` | **PASS** (`0.02s`) | Fixture hanya mensimulasikan `IsSuspended: true` tanpa membedakan `SuspensionReason`. |
| `go test -count=1 -v ./internal/services -run "TestProcessItemRetentionCycle_PurgeBannedStorePreservesReportsWithoutFKError"` | **PASS** (`0.01s`) | Menguji Phase 5 SQLite purge FK safety; mencatat log error `no such table: activity_logs` pada fixture SQLite. |
| `go test -count=1 -v ./internal/handlers -run "TestAutomationRuntime"` | **SKIP / NO TESTS RUN** (`0.053s`) | Terikat build constraint (`postgres` / disposable env), tidak jalan di default `go test`. |
| `backend/internal/handlers/dormancy_handler_test.go` | **TIDAK ADA** | Belum ada test unit khusus HTTP handler untuk `HandlePublicReactivateStore`, `HandleExtendStoreActivity`, maupun `HandleGetDormancyMetrics`. |

---

#### A1.3 Ringkasan Eksekutif Temuan Audit A1 (`10` Kelompok Temuan — Seluruhnya Selesai & Terverifikasi)

| ID | Severity | Layer | Judul Singkat | Target File | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DORM-P0-01** | P0-Critical | BE / Middleware | **Double Deadlock Reaktivasi Mandiri Toko Dormant** | `main.go:456-459,709-712`, `dormancy_service.go:95-210` | **FIXED & VERIFIED** |
| **DORM-P0-02** | P0-Critical | BE Worker / Handler | **Stage 3 Tidak Set `suspension_reason="dormancy"` & `ShowStore` Memaksa Status ke `moderation_violation`** | `dormancy_service.go`, `store_handler.go:307` | **FIXED & VERIFIED** |
| **DORM-P1-01** | P1-High | BE + Tri-Frontend Admin | **Contract Key Mismatch `/api/admin/dormancy/metrics`** (`active_stores`/`dormant_stores`/`total_stores` + unwrap `res.data`) | `dormancy_service.go`, Desktop/Tablet/Mobile Portals | **FIXED & VERIFIED** |
| **DORM-P1-02** | P1-High | Tri-Frontend Merchant | **Tablet Banner Warning & `extend-activity` + Tombol 1-Klik Saat Suspended Dormancy Lintas 3 Device** | `TabletMerchantAdmin.tsx`, `TabletSuspendedLockView.tsx`, Desktop/Mobile `App.tsx` | **FIXED & VERIFIED** |
| **DORM-P1-03** | P1-High | BE Worker / Atomicity | **Guard `activeDisputes` di `RunModerationEscalationCycle` & `ActivityLog` Phase 2 Setelah Commit DB** | `dormancy_service.go`, `item_retention_service.go` | **FIXED & VERIFIED** |
| **DORM-P1-04** | P1-High | BE Retention Worker | **`filterUnreferencedMedia` Phase 2–4, Guard `needs_fix`/`suspended` di Phase 4, & Exact Boundary `#id` di `hasActiveTicket`** | `item_retention_service.go` | **FIXED & VERIFIED** |
| **DORM-P2-01** | P2-Medium | Security / Email UX | **Absolute URL `getAppBaseURL()` di Email CTA & 2-Step Confirmation (`GET` Read-Only -> `POST` Mutasi) Anti-Scanner** | `dormancy_handler.go`, `dormancy_service.go`, `email_templates.go` | **FIXED & VERIFIED** |
| **DORM-P2-02** | P2-Medium | BE Handler / Logic | **Explicit Multi-Store Slug Context & Pembatasan Auto-Resolve Tiket Hanya untuk Dormancy** | `dormancy_handler.go`, `dormancy_service.go` | **FIXED & VERIFIED** |
| **DORM-P2-03** | P2-Medium | BE Reliability | **Fail-Closed Token Kosong & Pengecekan Error DB `Updates` di Stage 1–3** | `dormancy_service.go` | **FIXED & VERIFIED** |
| **DORM-P2-04** | P2-Medium | Copy / Filter / UI Hygiene | **Sinkronisasi Kebijakan 30/38/45/60 Hari, Filter `Peringatan 2 (38 Hari)`, & Pembersihan Emoji Backend** | `policyShared.tsx`, `policy_defaults.go`, `AdminStoresManagement.tsx`, `TabletPlatformStoresView.tsx` | **FIXED & VERIFIED** |

---

#### A1.4 Sub-Catatan Detail Temuan & Rekomendasi Perbaikan

##### 1. [DORM-P0-01] Double Deadlock Reaktivasi Mandiri Toko Suspended Dormancy
- **Lokasi**:
  - `backend/cmd/server/main.go` L576 & L707–708
  - `backend/internal/services/dormancy_service.go` L107–120 & L165–178
  - `backend/internal/handlers/cloudflare_audit_remediation_test.go` L297–304
- **Bukti Kode**:
  1. Saat toko Free inaktif 45 hari, `RunDormancyCycle` Stage 3 (`dormancy_service.go:334–339`) meng-set `dormancy_status = "suspended"` dan `is_suspended = true`, lalu mengirim email menjanjikan *"masa tenggang 15 hari... aktifkan kembali kapan saja melalui tautan"*.
  2. **Lapis Block 1 (Middleware)**: Rute `POST /api/stores/extend-activity` dan `POST /api/store/extend-activity` didaftarkan pada `guardedMutations` (`main.go:707–708`), yang mewajibkan `middleware.OperationalStoreRequired()` (`auth.go:1009`). Middleware ini menolak semua store dengan `DormancyStatus == "suspended" || IsSuspended` dengan HTTP `403 STORE_SUSPENDED` sebelum handler sempat dijalankan.
  3. **Lapis Block 2 (Service)**: Baik `ReactivateStoreByToken` (`dormancy_service.go:107`) maupun `ReactivateStoreByID` (`dormancy_service.go:165`) menulis:
     ```go
     if store.DormancyStatus == "banned" || store.IsBlacklisted || store.IsSuspended {
         return nil, fmt.Errorf("toko ini telah ditangguhkan atau dibekukan oleh tim kepatuhan...")
     }
     ```
     Karena Stage 3 sudah menyetel `is_suspended = true`, kedua jalur (Magic Link & Tombol Dashboard) **selalu gagal** untuk toko yang sudah memasuki Stage 3!
  4. **Lapis Block 3 (State Partial Reset)**: `ReactivateStoreByToken` (`dormancy_service.go:111–118`) lupa me-reset `store.IsSuspended = false` dan `store.SuspensionReason = "none"` (berbeda dengan `ReactivateStoreByID` L172–173).
- **Dampak**: Toko Free yang sudah masuk Stage 3 (hari ke-45 s/d ke-59) **mustahil** mereaktivasi dirinya sendiri lewat Magic Link maupun Dashboard, lalu otomatis terkena **Hard Purge (penghapusan permanen)** pada hari ke-60.
- **Rekomendasi Perbaikan**:
  1. Pindahkan route `extend-activity` dari `guardedMutations` ke `guarded` (cukup `AuthRequired` + `StoreOwnerRequired`), atau berikan pengecualian di handler hanya jika `dormancy_status` tidak melarang reaktivasi mandiri.
  2. Buat helper tunggal `canSelfReactivateDormancy(store *models.Store) bool`: izinkan bila `!store.IsBlacklisted && store.DormancyStatus != "banned" && store.DormancyStatus != "purged" && store.SuspensionReason != "moderation_violation" && !(store.IsSuspended && store.SuspensionReason != "dormancy" && store.DormancyStatus != "suspended")`. Pastikan blokir mutlak berlaku untuk `moderation_violation`, `banned`, `purged`, dan `is_blacklisted`.
  3. Sinkronkan `ReactivateStoreByToken` dan `ReactivateStoreByID` untuk memakai satu transaksi atomik bersama (`reactivateStoreTX`) yang mereset `DormancyStatus = "active"`, `IsSuspended = false`, `SuspensionReason = "none"`, `ReactivationToken = ""`, `DormancySuspendedAt = nil`, `DormancyWarning1SentAt = nil`, `DormancyWarning2SentAt = nil`.
  4. Perbarui fixture test `TestCloudflareAudit_DormancyReactivationBlocksModerationSuspended` agar eksplisit menguji skenario moderasi (`SuspensionReason: "moderation_violation"`) vs dormancy (`DormancyStatus: "suspended", SuspensionReason: "dormancy"`).

##### 2. [DORM-P0-02] Stage 3 Tidak Mengisi `suspension_reason` & `ShowStore` Memaksa Jadi `moderation_violation`
- **Lokasi**:
  - `backend/internal/services/dormancy_service.go` L334–339
  - `backend/internal/handlers/store_handler.go` L307–312
- **Bukti Kode**:
  - Stage 3 (`dormancy_service.go:334–339`) meng-update `dormancy_status`, `is_suspended`, `dormancy_suspended_at`, dan `reactivation_token`, tetapi **tidak mengisi** `"suspension_reason": "dormancy"` (padahal broadcast SSE L370 mengirim `"suspension_reason": "dormancy"` dan Stage 4 L381 mencarinya).
  - Pada `store_handler.go:308–311`, jika `store.SuspensionReason` bernilai `""` atau `"none"`, kode langsung memaksa `reason = "moderation_violation"`.
- **Dampak**: Toko yang hanya tidak aktif 45 hari dilabeli oleh API publik/dashboard sebagai **Pelanggaran Kebijakan Komunitas (`moderation_violation`)**, memblokir mekanisme UI reaktivasi mandiri dan membingungkan merchant serta CS.
- **Rekomendasi Perbaikan**:
  1. Set `"suspension_reason": "dormancy"` pada Stage 3 (`dormancy_service.go:334`).
  2. Pada `ShowStore` (`store_handler.go:308–311`), jika `reason == "" || reason == "none"`, lihat konteks: bila `store.DormancyStatus == "suspended"` tanpa `moderation_violation`, fallback aman ke `"dormancy"` (jika memang penangguhan dormancy) atau `"moderation_violation"` hanya bila status/laporan memang moderasi; pastikan seluruh jalur moderasi (`report_handler.go`, admin sanction) selalu menulis `suspension_reason = "moderation_violation"` secara eksplisit.

##### 3. [DORM-P1-01] Contract Mismatch `/api/admin/dormancy/metrics` di Desktop, Tablet & Mobile Admin Pengelola
- **Lokasi**:
  - Backend: `backend/internal/services/dormancy_service.go` L776–800
  - Desktop: `frontend/desktop/src/components/PlatformRolePortal.tsx` L2218–2222, L3583, L3640, L3693, L4212, L5145
  - Tablet: `frontend/tablet/src/components/TabletPlatformConsole.tsx` L448–460
  - Mobile: `frontend/mobile/src/components/PlatformRolePortal.tsx` L2292–2295, L3624, L3681, L3741, L4225, L5208
- **Bukti Kode**:
  - `GetDormancyMetrics(db)` mengembalikan `active_free`, `warning_1_free`, `warning_2_free`, `suspended_free`, `total_free` (dan saat `db == nil`, return keys yang berbeda lagi: `active`, `warning_1`, `warning_2`, `suspended`, `total`).
  - Ketiga frontend Admin Pengelola membaca `dormancyMetrics.active_stores`, `dormant_stores`, dan `total_stores` — field yang **tidak pernah dikirim** backend!
  - Khusus Mobile (`PlatformRolePortal.tsx:2295`), `setDormancyMetrics(dormData)` langsung menyimpan root object `{status, data}`, bukan `dormData.data`.
- **Dampak**: Badge peringatan dan angka statistik kesehatan merchant di konsol Admin Pengelola Desktop, Tablet, maupun Mobile selalu `0` / fallback statis `1`.
- **Rekomendasi Perbaikan**:
  1. Seragamkan respons `GetDormancyMetrics` dengan field lengkap yang backward-compatible sekaligus akurat: `active_free`, `warning_1_free`, `warning_2_free`, `suspended_free`, `total_free`, PLUS `active_stores` (total store aktif bukan banned/suspended/purged), `dormant_stores` (`warning_1_free + warning_2_free + suspended_free`), dan `total_stores`.
  2. Perbaiki pembacaan di Desktop, Tablet, dan Mobile agar selalu membaca `res.data` secara seragam.

##### 4. [DORM-P1-02] Ketimpangan Tri-Frontend Merchant (Tablet Hilang Banner & Ketiga Device Hilang CTA Reaktivasi saat Suspended Dormancy)
- **Lokasi**:
  - Tablet: `frontend/tablet/src/components/TabletMerchantAdmin.tsx` (absen `handleExtendStoreActivity`, absen penanganan `?reactivated=true`, absen banner `warning_1`/`warning_2`), `frontend/tablet/src/components/TabletSuspendedLockView.tsx` (L320–433)
  - Desktop: `frontend/desktop/src/App.tsx` (L21839–21944, L22520–22780)
  - Mobile: `frontend/mobile/src/App.tsx` (L26578–26682, L26243–26480)
- **Bukti Kode**:
  - Banner Warning (`warning_1` / `warning_2`) dengan tombol 1-klik `Perpanjang Masa Aktif Katalog` hanya ada di Desktop (`App.tsx:21839`) dan Mobile (`App.tsx:26578`), tetapi **tidak ada di `TabletMerchantAdmin.tsx`**.
  - Ketika store sudah masuk status `suspended` karena dormancy (`suspension_reason === 'dormancy'`), Desktop, Tablet (`TabletSuspendedLockView`), dan Mobile semuanya **hanya menampilkan tombol "Ajukan Banding Kepatuhan"**, tanpa opsi tombol **"Perpanjang Masa Aktif Gratis (1-Klik)"** seperti yang dijanjikan dokumen kebijakan.
- **Dampak**: Pengguna Tablet tidak pernah melihat banner peringatan maupun tombol perpanjang di dashboard sebelum toko disuspend; semua pengguna lintas device yang tokonya disuspend karena dormancy dipaksa membuat tiket CS banding manual (yang juga tetap butuh admin karena deadlock P0-01).
- **Rekomendasi Perbaikan**:
  1. Tambahkan banner dormancy `warning_1`/`warning_2` (ergonomi Tablet native, touch target >= 44px), handler `handleExtendStoreActivity`, dan feedback `?reactivated=true` ke `TabletMerchantAdmin.tsx`.
  2. Pada layar Suspended Hub di **Desktop, Tablet, dan Mobile**, bedakan rendering saat `suspension_reason === 'dormancy'` vs `moderation_violation`: bila `dormancy`, tampilkan CTA utama **"Aktifkan Kembali Katalog Gratis (1-Klik)"** yang memanggil `POST /api/stores/extend-activity` lalu refresh status store; bila `moderation_violation`, tampilkan tombol Banding Kepatuhan.

##### 5. [DORM-P1-03] Konflik 2 Worker Banned 90 Hari & Urutan `ActivityLog` di Phase 2 Retensi
- **Lokasi**:
  - `backend/internal/services/dormancy_service.go` L689–772 (`RunModerationEscalationCycle` bag. 2 — jalan tiap **1 jam**)
  - `backend/internal/services/item_retention_service.go` L182–232 (Phase 2) & L524–627 (Phase 5 — jalan tiap **24 jam**)
- **Bukti Kode**:
  1. Kedua fungsi menargetkan kondisi yang identik: `dormancy_status = 'banned' AND dormancy_banned_at <= now - 90d`. `RunModerationEscalationCycle` (1-jam) berjalan tanpa memeriksa `activeDisputes` (`reports` berstatus `pending`/`investigating`/`re_review`), sedangkan Phase 5 (24-jam) mengeceknya (L534–541). Artinya worker 1-jam bisa menghapus media bukti toko banned sebelum Phase 5 sempat menahannya.
  2. Pada Phase 2 `item_retention_service.go:182–232`, `RecordActivity` (`product.auto_purge_soft_deleted`) ditulis **sebelum** transaksi soft-delete (L211). Jika `txErr != nil`, log audit mencatat produk sudah dihapus padahal gagal.
- **Rekomendasi Perbaikan**:
  1. Konsolidasikan pembersihan toko banned >= 90 hari ke satu fungsi otoritatif (atau tambahkan guard `activeDisputes` yang sama + skip bila `dormancy_status = 'purged'` ke `RunModerationEscalationCycle`).
  2. Pindahkan `RecordActivity` di Phase 2 ke **setelah** transaksi DB soft-delete berhasil (`txErr == nil`), selaras dengan pola di Phase 3 dan Phase 4.

##### 6. [DORM-P1-04] Celah Keamanan Data & Logika di `item_retention_service.go` (Ref-Count, Phase 4 Filter, `hasActiveTicket`, Symlink)
- **Lokasi**: `backend/internal/services/item_retention_service.go` L235–242, L361–368, L401, L603–607, L644–651
- **Bukti Kode**:
  1. **Hilang Ref-Count Media**: Phase 4 (L436–448) mengecek apakah URL gambar masih dipakai produk aktif lain sebelum hapus fisik, namun Phase 2 (L235–242) dan Phase 3 (L361–368) langsung memanggil `HardDeleteLocalStorageFile` & `strg.Delete` tanpa pengecekan ref-count.
  2. **Phase 4 Bypass `needs_fix` & `suspended`**: Query L401 mengecualikan `NOT IN ('hidden', 'locked', 'banned')`, berbeda dengan Phase 1–3 (`'hidden', 'locked', 'banned', 'needs_fix', 'suspended'`). Item berstatus `needs_fix`/`suspended` yang ter-soft-delete bisa terhapus permanen dalam 72 jam.
  3. **`hasActiveTicket` Over-broad**: Query L648 memakai `subject LIKE '%#12%' OR category = 'compliance'`. Substring `#12` cocok ke `#120`/`#1234`, dan `OR category = 'compliance'` memblokir retensi item lain di toko yang kebetulan memiliki 1 tiket kepatuhan terbuka untuk item berbeda.
  4. **Hardcoded `os.RemoveAll` tanpa Symlink Guard**: Phase 5 L603–607 menghapus folder fisik langsung via `os.RemoveAll`, tidak mengguna-ulang guard symlink `os.Lstat` seperti `RemoveStoreMedia` di `store_deletion.go:122–131`.
- **Rekomendasi Perbaikan**:
  1. Ekstrak helper ref-count bersama (`filterUnreferencedImages`) dan gunakan di Phase 2, 3, dan 4.
  2. Samakan daftar status moderasi di Phase 4 L401 menjadi `NOT IN ('hidden', 'locked', 'banned', 'needs_fix', 'suspended')`.
  3. Perketat pencocokan `hasActiveTicket` (regex/boundary di SQL atau `entity_id`/nomor item presisi, serta batasi `category = 'compliance'` hanya jika memang banding umum toko bukan item spesifik lain).
  4. Re-use helper aman berpenjaga symlink saat membersihkan folder lokal store pada Phase 5.

##### 7. [DORM-P2-01] Link Email CTA Relatif & Kerentanan Scanner Prefetch pada Magic Link `GET`
- **Lokasi**:
  - `backend/internal/handlers/dormancy_handler.go` L27–93
  - `backend/internal/services/dormancy_service.go` L423 & L924
  - `backend/internal/services/email_templates.go` L838–841, L870–873
- **Bukti Kode**:
  - `sendDormancyEmail` case 4 mengirim `ctaURL = "/"` (path relatif) meski `actionURL` sudah dipassing `baseURL`; `BuildItemRetentionReminderEmail` & `BuildItemRetentionSoftDeletedEmail` juga memakai `/slug/admin/help` dan `/slug/admin/items` tanpa domain `getAppBaseURL()`. Di email client eksternal, tautan CTA tersebut menjadi tautan relatif rusak.
  - `GET /api/public/stores/reactivate?token=...` langsung melakukan mutasi state dan menghanguskan token saat di-`GET`. Email security scanner (*SafeLinks*, anti-phishing link pre-fetcher) sering melakukan `GET` otomatis sebelum email dibuka user.
- **Rekomendasi Perbaikan**:
  1. Selalu prefiks seluruh `ctaURL` di template email dengan `getAppBaseURL()`.
  2. Terapkan pola konfirmasi dua langkah pada endpoint reaktivasi: `GET` hanya memvalidasi token tanpa memutasi lalu merender form/tombol `POST` (dengan token tersembunyi) untuk mengeksekusi reaktivasi aktual.

##### 8. [DORM-P2-02] Fallback Multi-Store Ambigu & Auto-Resolve Tiket Terlalu Luas pada `HandleExtendStoreActivity`
- **Lokasi**:
  - `backend/internal/handlers/dormancy_handler.go` L111–126
  - `backend/internal/services/dormancy_service.go` L188–193
- **Bukti Kode**:
  - Jika `c.Locals("store")` kosong, `HandleExtendStoreActivity` mengambil `First(&s)` berdasar `user_id` — berisiko memilih toko yang salah jika merchant memiliki beberapa katalog sekaligus.
  - `ReactivateStoreByID` (L188–193) otomatis menandai `resolved` seluruh tiket `open`/`in_progress`/`waiting_*` dengan `category = 'compliance' OR category = 'catalog_help' OR subject LIKE '%Banding%' OR subject LIKE '%Pembekuan%'`. Tiket banding pelanggaran produk atau pertanyaan katalog biasa yang masih berlangsung bisa ikut tertutup otomatis.
- **Rekomendasi Perbaikan**:
  1. Hormati header/param `X-Store-Slug` / `store_id` yang eksplisit (dan karena rute nantinya dipindah ke `guarded` dengan `StoreOwnerRequired()`, `c.Locals("store")` akan selalu terisi sesuai tenant aktif).
  2. Persempit kondisi auto-resolve di `ReactivateStoreByID` hanya ke tiket penangguhan dormancy (atau jangan menutup tiket moderasi/bantuan umum secara otomatis).

##### 9. [DORM-P2-03] Error DB `Updates` Diabaikan & Risiko Kirim Email Token Kosong di Stage 1–3
- **Lokasi**: `backend/internal/services/dormancy_service.go` L238–373
- **Bukti Kode**:
  - `db.Model(&store).Updates(...)` pada Stage 1 (L242), Stage 2 (L289), dan Stage 3 (L334) tidak memeriksa `.Error`.
  - Jika `generateSecureToken()` mengembalikan `""` (fail-closed) atau `.Updates()` gagal, worker tetap membuat notifikasi in-app dan mengirim email berisi `?token=` kosong serta mencatat log info sukses.
- **Rekomendasi Perbaikan**:
  - Tolak stage update jika `token == ""` dan periksa `if err := db.Model(&store).Updates(...).Error; err != nil { log & cycleErr = errors.Join(...); continue }` sebelum mengirim email/notifikasi.

##### 10. [DORM-P2-04] Ketidaksinkronan Copy Kebijakan, Filter `warning_2 (60 Hari)` & Emoji di Backend
- **Lokasi**:
  - `frontend/{desktop,tablet,mobile}/src/utils/policyShared.tsx` L435 ("90 hari kalender" vs implementasi aktual BE: W1 30h, W2 38h, Suspend 45h, Purge 60h)
  - `frontend/{desktop,tablet,mobile}/src/components/AdminStoresManagement.tsx` & `TabletPlatformStoresView.tsx` (`{ key: 'warning_2', label: 'Peringatan 2 (60 Hari)' }` vs BE `38 Hari`)
  - `backend/internal/services/dormancy_service.go` L298, L307 (emoji `⚠️`) & `item_retention_service.go` L102, L109, L268 (emoji `⚠️`, `🗑️`)
- **Rekomendasi Perbaikan**:
  1. Selaraskan copy `policyShared.tsx` di ketiga frontend agar akurat dengan siklus aktual (`30 / 38 / 45 / 60` hari).
  2. Perbaiki label filter `warning_2` di ketiga frontend menjadi `'Peringatan 2 (38 Hari)'`.
  3. Hapus emoji `⚠️` dan `🗑️` pada string judul notifikasi & subjek email backend sesuai standar anti-emoji `AGENTS.md`.

---

#### A1.5 Status Remediasi & Bukti Verifikasi Final (`2026-11-28`)
Seluruh perbaikan Gelombang 1 & Gelombang 2 telah selesai diimplementasikan dan diverifikasi setelah edit terakhir:
- **Backend Go Tests (`go test -count=1 ./...`)**: Seluruh paket ber-test di `backend/` lulus (`exit code 0`), termasuk unit test baru di `backend/internal/handlers/dormancy_handler_test.go` (`TestDormancyHandler_GETDoesNotConsumeToken_POSTReactivatesSuspendedDormancyStore`, `TestDormancyHandler_ExtendActivity_AllowsDormantSuspended_BlocksModeration_RequiresContextMultiStore`, `TestDormancyHandler_MetricsAndShowStoreReasonSeparation`), `backend/internal/services/item_retention_service_test.go` (`TestProcessItemRetentionCycle_GuardsNeedsFixAndExactTicketIDBoundary`), dan penyelarasan fixture di `backend/internal/handlers/cloudflare_audit_remediation_test.go`.
- **Tri-Build SPA (0 error)**:
  - `frontend/desktop`: built in `2.77s` (`2009 modules`).
  - `frontend/tablet`: built in `1.50s` (`2020 modules`).
  - `frontend/mobile`: built in `1.80s` (`2004 modules`).
- **Playwright + HTTP E2E Runtime (`12/12 passed`)**:
  - `ShowStore` memisahkan historical suspended dormancy tanpa report menjadi `"dormancy"`, bukan `"moderation_violation"`.
  - Toko `moderation_violation` tetap ditolak `403` pada `/api/stores/extend-activity`, ditolak `400` pada magic link, dan hanya menampilkan CTA Banding (0 tombol 1-klik bypass).
  - Magic Link 2-step `GET` render form `POST` tanpa mengkonsumsi token, dan `POST` mengaktifkan toko (`suspended:true -> active:false`) lalu redirect ke `/{slug}/admin/items` (`?reactivated=true`).
  - Desktop (`1280x800`), Tablet (`768x1024`), dan Mobile (`390x844`) Merchant Suspended Hub berhasil reaktivasi mandiri 1-klik (`HTTP 200`, `btnGone=true`).
  - Tablet `warning_2` banner (`tablet-dormancy-warning-banner`) & touch target tombol `44px` berfungsi dan hilang setelah extend activity.
  - Admin Pengelola Desktop, Tablet, & Mobile menerima `active_stores` & `dormant_stores` non-zero dari `/api/admin/dormancy/metrics` serta menampilkan filter `'Peringatan 2 (38 Hari)'` (`old60=false`).

---

### A2. Audit Mendalam: Registrasi Merchant, OTP, Google SSO & Checkout Paket Awal (`2026-11-28`)

#### A2.1 Ruang Lingkup & File Terinspeksi
Audit dilakukan dengan membaca langsung kode sumber backend, model database, layanan OTP, utilitas shared frontend, serta komponen & orkestrasi ketiga antarmuka frontend (tanpa mengubah kode produksi):
- **Backend, Model & Routing**:
  - `backend/cmd/server/main.go` (L491–529 — rute auth, OTP, register, `check-email`, `check-slug`)
  - `backend/internal/handlers/auth_handler.go` (`Register` L725–1445, `GoogleAuth` L1445–2020, `CheckEmail`/`SendRegistrationOTP`/`VerifyRegistrationOTP` L2705–2925)
  - `backend/internal/handlers/store_handler.go` (`CheckSlug` L954–997)
  - `backend/internal/handlers/subscription_handler.go` (`GetPlans` L57–84, `VerifyCoupon` L1568–1635)
  - `backend/internal/services/otp_service.go` (L1–298)
  - `backend/internal/models/otp.go` (L1–15), `backend/internal/models/blacklisted_slug.go` (L1–16), `backend/internal/models/user.go` (L1–54)
- **Test Baseline Terkait**:
  - `backend/internal/handlers/google_auth_hardening_test.go` (L1–100), `backend/internal/services/otp_service_test.go`, `backend/internal/handlers/payment_coupon_hardening_test.go`
- **Shared & Tri-Frontend**:
  - Shared: `frontend/shared/auth/registrationOtp.ts` (L1–153), `frontend/shared/auth/SharedRegistrationOtpModal.tsx` (L1–334)
  - Desktop: `frontend/desktop/src/App.tsx` (L12110–12360, L12617–12715, L15290–15325, L16515–16580, L16975–17115), `frontend/desktop/src/components/DesktopCheckoutView.tsx` (L1–620, L2460–2560)
  - Tablet: `frontend/tablet/src/App.tsx` (L855–935), `frontend/tablet/src/components/TabletRegisterView.tsx` (L1–1270), `frontend/tablet/src/components/TabletCheckoutView.tsx` (L1–620, L2405–2505)
  - Mobile: `frontend/mobile/src/App.tsx` (L9404, L12735–12945, L13221–13510, L13780–13835, L16020–16055, L17055–17120, L17520–17670, L17980–18050), `frontend/mobile/src/components/MobileCancelRegistrationModal.tsx` (L1–366)

#### A2.2 Ringkasan Pengukuran Baseline (Sebelum Remediasi)
| Pemeriksaan | Hasil Pengukuran Aktual (`go test -count=1`) | Catatan Audit |
| :--- | :--- | :--- |
| `./internal/handlers` (`Test.*Google\|Test.*Register\|Test.*OTP\|Test.*Auth\|TestStoreCheckSlug\|TestVerifyCoupon`) | **15 test top-level (termasuk 33 subtest) PASS** (`3.977s`) | Tidak ada test yang memeriksa atomisitas `GoogleAuth` Case B, `BlacklistedSlug` pada `GoogleAuth`, `CheckEmail` anti-enumeration, atau retry OTP token saat `tx` register gagal. |
| `./internal/services` (`Test.*OTP\|Test.*Coupon\|Test.*Upgrade`) | **27 test top-level PASS** (`0.394s`) | Tidak ada test yang menguji race cooldown `GenerateAndSendOTP`, konversi UTC, atau kegagalan kirim SMTP latar belakang. |

#### A2.3 Matriks Temuan Audit (`0` P0, `4` P1, `4` P2, `1` P3)
| ID | Severity | Area | Ringkasan Temuan | Bukti Lokasi Kode |
| :--- | :--- | :--- | :--- | :--- |
| **REG-P1-01** | **P1** | BE / Security / DB | `GoogleAuth` Case B (registrasi toko baru via Google) melewatkan cek `models.BlacklistedSlug`, membuat `User` & `Store` di luar transaksi tanpa rollback jika `newStore` gagal (orphan user), memakai waktu lokal `time.Now()`, serta tidak mengembalikan `stores`, `active_store`, maupun memicu `DispatchRegistrationOnboarding`. | `auth_handler.go` L1728–1894 |
| **REG-P1-02** | **P1** | BE / DB Transaction | `Register` menghanguskan `verification_token` (`ValidateAndConsumeToken`) **sebelum** membuat `User` dan sebelum transaksi `Store` + `SubscriptionOrder` + kupon. Jika `tx` gagal (konflik kupon / slug race / DB error), `newUser` dihapus manual namun token OTP sudah musnah (user dipaksa OTP ulang); selain itu `h.db.Create(&newUser)` berada di luar `h.db.Transaction` sehingga crash di tengah berisiko menyisakan orphan `User`. | `auth_handler.go` L1112, L1144–1152, L1195–1334 |
| **REG-P1-03** | **P1** | BE / Security / FE | `CheckEmail` (`/api/auth/check-email`) melanggar kebijakan anti-enumerasi `N-17` dengan mengembalikan `available: false` dan pesan eksplisit akun sudah terdaftar; ketiga frontend juga memanggil `GET /api/auth/check-email?email=...` saat Google SSO sehingga email PII masuk ke log proxy/akses HTTP. | `auth_handler.go` L2711–2757; `main.go` L523–526; Desktop `App.tsx` L12124, L16525; Tablet `App.tsx` L865, `TabletRegisterView.tsx` L231; Mobile `App.tsx` L12748, L17065 |
| **REG-P1-04** | **P1** | FE / Billing Gateway | Saat mode `gateway_aulaa` aktif dan `CreateAulaaPayment` gagal (`payment_url: ""`), `Register` tetap mengembalikan `201 Created`. Mobile langsung redirect ke `/${slug}/admin` tanpa membayar (silent bypass); Desktop & Tablet sudah menyimpan token + menghapus draft tetapi menampilkan error pada form checkout yang jika diklik ulang menembak `POST /register` kedua kalinya (ditolak `409`/duplikat). | `auth_handler.go` L1336–1365; Mobile `App.tsx` L13425–13432; `DesktopCheckoutView.tsx` L531–558; `TabletCheckoutView.tsx` L527–554 |
| **REG-P2-01** | **P2** | FE Tablet SSO | Pada alur Google SSO Tablet saat `isRegisterFlow === true`, handler langsung melangkah ke `/register/step-2` **tanpa memeriksa** `res.ok && data.success`, status MFA, atau validitas `google_registration_token`. Kegagalan backend Google SSO tetap meloloskan user ke Step 2 dengan token kosong. | `frontend/tablet/src/App.tsx` L857–904 |
| **REG-P2-02** | **P2** | BE + Tri-FE Parity | Daftar kode paket di `Register` (`free`, `pro`, `pro_starter`, `pro_business`) dan harga fallback (`30000` / `129000`) masih di-hardcode di BE dan ketiga FE (`Step 3` & `Checkout`), tidak mengambil harga aktual dari `/api/subscription/plans`; `DesktopCheckoutView` & `TabletCheckoutView` masih menyimpan state/query `'annual'` walau BE mengunci bulanan; kartu Free di Tablet masih menampilkan copy `"Iklan Sponsor"` yang tidak ada di Desktop & Mobile. | `auth_handler.go` L954–982; `subscription_handler.go` L1592–1609; Desktop `App.tsx` L17041, L17086; `DesktopCheckoutView.tsx` L85, L306–307; `TabletRegisterView.tsx` L1008, L1054, L1106; `TabletCheckoutView.tsx` L113, L303–304; Mobile `App.tsx` L17584, L17629 |
| **REG-P2-03** | **P2** | BE OTP Service | `otp_service.go` menggunakan waktu lokal `time.Now()` (bukan `.UTC()`) di 7 titik, menyisipkan karakter emoji stopwatch pada HTML email OTP (`L165`, melanggar aturan anti-emoji `AGENTS.md`), mengirim email via goroutine `runBackground` tanpa outbox retry persisten, serta membiarkan race cooldown (`TOCTOU` antar query & delete/insert) plus truncation `(60 - int(elapsed.Seconds()))` yang bisa mencetak `Tunggu 0 detik`. Pembuatan `orderNumber` di `auth_handler.go` L1268 juga memakai waktu lokal & modulo 4-digit nanosecond. | `otp_service.go` L76–116, L165, L191, L225–289; `auth_handler.go` L1268 |
| **REG-P2-04** | **P2** | Tri-FE UX & Modal Back | `TabletCheckoutView` & Mobile memakai `alert(...)` bawaan browser; modal konfirmasi batal checkout (`showCancelModal`) di Desktop & Tablet tidak dipasangi `useModalBackHandler` / `setupModalBackInterceptor`; `SharedRegistrationOtpModal` pada mode `device="mobile"` menampilkan drag handle bar dekoratif tanpa fisika drag-down maupun internal `useModalBackHandler`. | `TabletCheckoutView.tsx` L395, L2430; `DesktopCheckoutView.tsx` L2486; Mobile `App.tsx` L13341, L13451–13458; `SharedRegistrationOtpModal.tsx` L52–61, L137–141 |
| **REG-P3-01** | **P3** | BE Security & State Clean | Endpoint publik `GET /api/check-slug` dan `/api/auth/check-slug` belum memiliki `AuthRateLimiter()` / rate limiter publik (berbeda dengan `/check-email`). Selain itu, pembatalan pendaftaran (`handleConfirmCancel` / `handleConfirmMobileCancel`) menghapus sebagian kunci `sessionStorage` tanpa menghapus `catavor_reg_otp_verified` (`clearStoredRegistrationToken`) dan `catavor_aulaa_channel`. | `main.go` L519–520, L527–528; `DesktopCheckoutView.tsx` L594–602; `TabletCheckoutView.tsx` L589–597; Mobile `App.tsx` L13794–13802 |

#### A2.4 Sub-Catatan Audit Mendalam Per Masalah
1. **Orphan Account & Hilangnya Token OTP (`REG-P1-01` & `REG-P1-02`)**:
   - Pada `Register` (`auth_handler.go:1112–1334`), penghapusan token verifikasi di awal membuat kegagalan transaksi kupon/slug mengharuskan merchant meminta ulang OTP 60 detik kemudian. Pemindahan `ValidateAndConsumeToken` **atau** konsumsi OTP ke dalam satu transaksi atomik yang membungkus `User + Store + SubscriptionOrder + Kupon` (bersama cek `BlacklistedSlug` dan `IsBlacklisted` di `GoogleAuth` Case B) mencegah akun tanpa toko sekaligus menjaga pengalaman user saat terjadi error sementara.
2. **Kontradiksi Anti-Enumeration vs UX Step 1 (`REG-P1-03`)**:
   - `SendRegistrationOTP` sudah menerapkan `responsSeragam` (`N-17`), tetapi `CheckEmail` membocorkan status terdaftarnya email secara langsung. Alternatif standar industri:
     - Opsi A (Strict Anti-Enumeration): Hapus pengungkapan eksplisit di `/check-email` dan delegasikan validasi akun duplikat ke email pemberitahuan saat OTP dikirim (*"Jika email belum terdaftar, kode OTP telah dikirim..."*).
     - Opsi B (Rate-Limited UX Check + POST Only): Hapus seluruh rute `GET` ber-query string (`?email=...`), batasi per-IP/fingerprint ketat, dan tetap samakan pesan untuk email blacklisted.
3. **Kegagalan Gateway Aulaa Saat Registrasi (`REG-P1-04`)**:
   - Jika `payment_mode == "gateway_aulaa"` gagal menghasilkan `payment_url` dari Aulaa, frontend seharusnya tidak menyimpan state seolah checkout gagal sebelum registrasi (memicu double-submit) atau melempar merchant Mobile ke `/admin` tanpa pembayaran; backend dan ketiga frontend wajib mengarahkan merchant dengan sesi baru tersebut ke halaman **Tagihan / Pending Order** (`/{slug}/admin/subscription?order=...`) agar pembayaran bisa dicoba ulang secara idempoten tanpa registrasi ulang.
4. **Matriks Paritas Tri-Frontend A2**:
   - **OTP Modal**: Ketiganya memakai `SharedRegistrationOtpModal`, namun Mobile perlu fisika drag-down + konsistensi back handler internal/parent, sementara Tablet sudah memakai `setupModalBackInterceptor` pada `showOtpModal`.
   - **Cancel Modal**: Mobile sudah memiliki komponen khusus `MobileCancelRegistrationModal.tsx` (drag handle + `useModalBackHandler` + header bersih tanpa X); Desktop & Tablet masih memakai inline dialog di CheckoutView tanpa back-handler.
   - **Step 3 Plan & Harga**: Ketiga frontend masih menaruh harga statis `Rp 30.000` / `Rp 129.000`; Tablet juga masih menyisakan label `"Iklan Sponsor"` pada paket Free.

#### A2.5 Rencana Remediasi Terstruktur (Menunggu Persetujuan / Eksekusi)
- **Gelombang 1 — Backend Atomicity, Keamanan Google SSO & OTP Hardening**:
  1. Bungkus `User` + `Store` + `SubscriptionOrder` + konsumsi token OTP ke dalam satu `h.db.Transaction` pada `Register`, serta tambahkan transaksi atomik, cek `BlacklistedSlug` + `users.is_blacklisted`, waktu `.UTC()`, payload `stores`/`active_store`, dan `DispatchRegistrationOnboarding` pada `GoogleAuth` Case B.
  2. Putuskan kebijakan final `CheckEmail` (hapus endpoint `GET` query `?email=...` + selaraskan anti-enumeration `N-17` atau throttling ketat), tambahkan rate limiter pada `/check-slug` & `/auth/check-slug`.
  3. Ubah `otp_service.go` agar seluruh timestamp menggunakan `.UTC()`, hapus emoji stopwatch pada HTML email OTP (`L165`), perbaiki pembulatan cooldown (`math.Ceil`), tutup race cooldown dengan row-lock/transaksi, dan migrasi dispatch email OTP ke mekanisme outbox/retry yang andal (atau tangani kegagalan sinkron/queue tanpa mengunci user).
  4. Perkuat validasi paket dinamis dari tabel `subscription_plans` pada `Register` & `VerifyCoupon` (menghapus ketergantungan daftar paket hardcode serta memakai integer minor unit/decimal yang presisi).
  5. Tambah unit test regresi di `backend/internal/handlers/` dan `backend/internal/services/` yang mencakup seluruh kasus `REG-P1` & `REG-P2` di atas.
- **Gelombang 2 — Paritas Tri-Frontend (Desktop, Tablet, Mobile) & Verifikasi E2E**:
  1. Perbaiki alur fallback `gateway_aulaa` tanpa `payment_url` di Desktop, Tablet, dan Mobile agar mengarahkan user yang sudah terbentuk akunnya ke halaman pembayaran order tertunda (anti double-submit `409` & anti silent bypass Mobile).
  2. Perbaiki `frontend/tablet/src/App.tsx` Google SSO `isRegisterFlow` agar memvalidasi `res.ok && data.success` dan meneruskan status MFA/error dengan benar.
  3. Hidrasi harga & kuota Step 3 serta Checkout dari `GET /api/subscription/plans`, bersihkan state `annual` usang pada Checkout Desktop/Tablet, samakan copy paket Free Tablet (hapus `"Iklan Sponsor"`), serta ganti seluruh native `alert(...)` di Tablet & Mobile dengan inline/toast UI.
  4. Pasang `useModalBackHandler` / `setupModalBackInterceptor` pada `showCancelModal` Desktop & Tablet, lengkapi `clearStoredRegistrationToken()` pada seluruh alur batal registrasi, dan tingkatkan fisika bottom-sheet `SharedRegistrationOtpModal` untuk `device="mobile"`.
  5. Verifikasi penuh: `go test -count=1 ./...`, Tri-Build (`desktop` + `tablet` + `mobile`), dan uji alur registrasi/checkout/cancel E2E via Playwright.

#### A2.6 Status Remediasi & Bukti Verifikasi Final (`2026-11-28`)
Seluruh perbaikan **Gelombang 1 (Backend & DB/OTP)** dan **Gelombang 2 (Tri-Frontend & Shared OTP Modal)** telah diimplementasikan dan diverifikasi setelah edit kode terakhir:
- **Backend Go Tests (`go test -count=1 ./...`)**: Seluruh 13 paket ber-test di `backend/` lulus (`exit code 0`), mencakup:
  - `catavor-backend/cmd/admin-cli` (`1.541s`), `cmd/server` (`0.068s`), `internal/config` (`0.623s`), `internal/database` (`1.032s`), `internal/handlers` (`29.557s`), `internal/logutil` (`0.101s`), `internal/mfa` (`0.275s`), `internal/middleware` (`0.445s`), `internal/models` (`0.223s`), `internal/security` (`0.145s`), `internal/services` (`18.932s`), `internal/storage` (`0.265s`), `internal/utils` (`0.098s`).
  - Test baru yang ditambahkan: `TestCheckEmail_AntiEnumeration`, `TestRegister_TxRollbackPreservesUserAndOTPToken`, `TestVerifyCoupon_RejectsFreeAndResolvesDynamicPlan`, `TestRegister_GatewayAulaaFallbackSetsRequiresPaymentAction`, `TestSlugCheckRateLimiter_AndGoogleCaseBHardening` di `backend/internal/handlers/auth_handler_test.go`, serta `TestGenerateAndSendOTP_UTCCeilingCooldownAndNoEmoji` di `backend/internal/services/otp_service_test.go` (plus perbaikan UTC `NowFunc` fixture di `otpTestDB`).
- **Tri-Build SPA (0 error TypeScript & Vite)**:
  - `frontend/desktop`: built in `1.83s` (`2009 modules`).
  - `frontend/tablet`: built in `1.55s` (`2020 modules`).
  - `frontend/mobile`: built in `2.05s` (`2004 modules`).
- **Playwright + HTTP Live Runtime (`6/6 passed` pada server `catavor_audit` port `8199` & PostgreSQL terisolasi `catavor_audit_tmp`)**:
  - `GET /api/auth/check-email?email=...` ditolak `404` (route GET PII Query String dihapus).
  - `POST /api/auth/check-email` mengembalikan respons netral `200 { available: true }` sesuai kebijakan anti-enumerasi `N-17`.
  - `GET /api/subscription/plans` aktif (`3 plans`, `pro_starter=30000`) dan dihidrasi oleh ketiga frontend.
  - Desktop (`1280x800`): OTP modal terbuka dan menutup via `goBack()`, halaman Checkout `?billing=annual` menampilkan Cancel confirmation dialog dengan back-handler yang aman tanpa keluar halaman dan 0 native `alert()`.
  - Tablet (`768x1024`): OTP modal back-handler bekerja, Step 3 bersih dari copy `"Iklan Sponsor"`, Checkout Cancel modal menutup via `goBack()` dan 0 native `alert()`.
  - Mobile (`390x844`): OTP bottom sheet aktif dengan `touch-action: none` pada drag header + `goBack()` close, serta submit Checkout tanpa bukti mengaktifkan inline/toast error dengan 0 native browser `alert()`.

---

### A3. Audit Mendalam: Direktori Toko Pengelola & Pengaturan Global Platform (`2026-11-28`)

#### A3.1 Ruang Lingkup & File Terinspeksi
Audit dilakukan dengan membaca langsung kode sumber backend (handlers, sanitizer, model, routes), unit test terkait, dan komponen UI lintas 3 device (tanpa mengubah kode produksi pada fase audit ini):
- **Backend, Model & Keamanan**:
  - `backend/cmd/server/main.go` (L417, L444–446, L673–680, L773–797)
  - `backend/internal/handlers/store_handler.go` (`AdminListStores` L2471–2664, `AdminGetStoreDetail` L2667–2706)
  - `backend/internal/handlers/setting_handler.go` (`PublicIndex` L57–142, `resolveActor` & `Index` L163–270, `applyFallbacks` L272–410, `Store` & `validateAndPrepareMonetizationSettings` L552–690, `persistPlatformSettings` L770–896, `ResetRekberDefaults` L899–970)
  - `backend/internal/security/sanitizer.go` (`SanitizeRichText` L97–120)
  - `backend/internal/models/store.go` (L1–73)
- **Test Baseline Terkait**:
  - `backend/internal/handlers/store_handler_test.go` (`TestAdminListStores_IsolationAndPagination_SQLite`)
  - `backend/internal/handlers/setting_handler_policy_test.go`, `payment_coupon_hardening_test.go`, `di_handler_test.go`
- **Tri-Frontend (Desktop, Tablet, Mobile)**:
  - Direktori Toko: `frontend/desktop/src/components/AdminStoresManagement.tsx` (L1–120, L185–310, L2040–2180), `frontend/mobile/src/components/AdminStoresManagement.tsx` (L1–120, L175–310, L1050–1195, L1905–1985), `frontend/tablet/src/components/TabletPlatformStoresView.tsx` (L1–120, L225–360, L1895–2035, L2680–2765)
  - Pengaturan Global & Kontak Resmi: `frontend/desktop/src/components/PlatformRolePortal.tsx` (L3175–3360, L14535–14645), `frontend/mobile/src/components/PlatformRolePortal.tsx` (L3255–3390, L13100–13215), `frontend/tablet/src/components/TabletPlatformConsole.tsx` (L2015–2085, L2365–2545, L10435–10560)
  - Modal/Sheet Kontak Resmi: `frontend/desktop/src/components/OfficialContactModal.tsx` (L1–120), `frontend/tablet/src/components/TabletOfficialContactModal.tsx` (L1–120), `frontend/mobile/src/components/OfficialContactSheet.tsx` (L1–120)

#### A3.2 Ringkasan Pengukuran Baseline (Sebelum Remediasi)
| Pemeriksaan | Hasil Pengukuran Aktual (`go test -count=1`) | Catatan Audit |
| :--- | :--- | :--- |
| `./internal/handlers` (`TestAdminListStores\|TestSettingHandler\|TestPublicSettings\|TestStoreHandler`) | **8 fungsi test top-level (termasuk 7 subtest) PASS** (`0.141s`) | Belum ada test yang menguji keutuhan karakter khusus (`&`, `<`, `>`) pada `smtp_password` / `aulaa_api_key` saat `persistPlatformSettings`, penolakan key liar oleh superadmin di `Store`, pengecualian wajib `master_coupons` di `Index`, atau penyembunyian `custom_domain_verification_token` pada `AdminGetStoreDetail`. |

#### A3.3 Matriks Temuan Audit (`0` P0, `3` P1, `4` P2, `1` P3)
| ID | Severity | Area | Ringkasan Temuan | Bukti Lokasi Kode | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SET-P1-01** | **P1** | BE / Security / DB | `persistPlatformSettings` memakai `SanitizeRichText` (`bluemonday`) untuk seluruh nilai setting selain `ads_txt_content`, yang meng-HTML-escape `&`/`'`/`<`/`>` dan merusak secret (`smtp_password`, `aulaa_api_key`, `aulaa_webhook_secret`) maupun URL/JSON; selain itu `Store` tidak menerapkan key allowlist saat caller ber-izin `system:settings:manage`, dan `Index` hanya mengecualikan `master_coupons` bila query `?exclude=master_coupons` dikirim. | `setting_handler.go` L236–265, L597–637, L786–799; `sanitizer.go` L97–120 | **FIXED & VERIFIED** |
| **SET-P1-02** | **P1** | FE Tablet Console | `TabletPlatformConsole.handleSavePaymentSettings` menyebar seluruh state `{ ...googleSettings }` (membuat staf ber-izin `finance:settings:manage` ditolak `403` oleh backend bila ada key domain lain, atau menimpa setting tidak terkait), dan baik `handleSavePaymentSettings` maupun `handleSaveRekberSettings` masih menembak `/api/settings` yang mensyaratkan kepemilikan toko (`StoreOwnerRequired`) terlebih dahulu alih-alih langsung `/api/admin/settings` via `authFetch`. | `TabletPlatformConsole.tsx` L2038–2078, L2513–2530; `main.go` L673 | **FIXED & VERIFIED** |
| **SET-P1-03** | **P1** | FE Mobile Contact | `Mobile PlatformRolePortal.handleSaveContactSettings` hanya mengirim `platform_official_whatsapp` & `platform_official_email` tanpa menyinkronkan `contact_whatsapp` & `contact_email` (berbeda dengan Desktop & Tablet), serta inputnya tidak fallback membaca `contact_*`, berisiko meninggalkan nilai kontak lama di DB tetap terbaca komponen lain. | Mobile `PlatformRolePortal.tsx` L3263–3267, L13116–13151; Desktop `L3231–3236`; Tablet `L2383–2388` | **FIXED & VERIFIED** |
| **DIR-P2-01** | **P2** | BE / Security PII | `AdminGetStoreDetail` melakukan serialisasi entitas mentah `models.Store` ke seluruh staf ber-izin baca (`support:tickets:read`, `finance:orders:read`, dll.), sehingga ikut mengekspos `custom_domain_verification_token` (secret verifikasi DNS TXT toko) padahal `ReactivationToken` sudah memakai `json:"-"`. | `store_handler.go` L2677–2705; `models/store.go` L42; `main.go` L775 | **FIXED & VERIFIED** |
| **DIR-P2-02** | **P2** | BE SQL & Metrics | Query agregat `stats.TotalActive` dan `stats.TotalBanned` di `AdminListStores` belum membungkus `COALESCE(dormancy_status, 'active')` terhadap kemungkinan baris legacy bernilai `NULL`, dan mencampur status `suspended`, `purged`, serta `banned` ke dalam satu angka `total_banned` tanpa rincian `total_suspended`. | `store_handler.go` L2631–2644 | **FIXED & VERIFIED** |
| **DIR-P2-03** | **P2** | Tri-FE Parity | Desktop & Mobile `AdminStoresManagement` melempar error generik pada status `401`/`403` tanpa memicu `onLogout?.()` (berbeda dengan Tablet), dan `fetchStoreDetail` pada Desktop & Mobile menelan error (`catch {}`) sehingga modal/sheet detail toko tampil kosong tanpa pesan gagal. | Desktop `AdminStoresManagement.tsx` L221–281; Mobile `L268–335`; Tablet `TabletPlatformStoresView.tsx` L253–330 | **FIXED & VERIFIED** |
| **SET-P2-04** | **P2** | FE Modal Back & Confirm | `TabletOfficialContactModal` hanya mendengar tombol `Escape` tanpa `useModalBackHandler` / `setupModalBackInterceptor` (melanggar `AGENTS.md` Rule 2; Desktop `OfficialContactModal` pun bergantung penuh pada parent), dan aksi reset default Rekber di ketiga frontend masih memakai `window.confirm(...)` bawaan browser. | `TabletOfficialContactModal.tsx` L30–40; Desktop `PlatformRolePortal.tsx` L3253; Mobile `L3324`; Tablet `TabletPlatformConsole.tsx` L2465 | **FIXED & VERIFIED** |
| **DIR-P3-01** | **P3** | Code Hygiene & UX | `TabletPlatformConsole` menampilkan dua tombol *"Simpan Kontak"* terpisah di panel Kontak Resmi (`L10445` di header dan `L10559` di footer form), sementara `OfficialContactModal.tsx` dan `TabletOfficialContactModal.tsx` menduplikasi ~500 baris komponen hampir identik alih-alih berbagi komponen di `frontend/shared/`. | `TabletPlatformConsole.tsx` L10445–10560; `OfficialContactModal.tsx`; `TabletOfficialContactModal.tsx` | **FIXED (partial — tombol duplikat dihapus; modal per-SPA dipisah)** |

#### A3.4 Sub-Catatan Audit Mendalam Per Masalah
1. **Integritas Secret Konfigurasi & Guard `POST /api/admin/settings` (`SET-P1-01`)**:
   - `setting_handler.go` sudah melindungi key rahasia saat `GET` lewat `maskSecretValue` (`"****xxxx"`) dan menolak menimpa nilai lama bila dikirim `"****..."` saat `POST`. Namun karena `persistPlatformSettings` memakai `SanitizeRichText`, karakter simbol valid pada `smtp_password` atau token API seperti `&` atau `<` akan diubah menjadi `&amp;` / dihapus sebelum disimpan ke PostgreSQL. Pemisahan sanitasi per kategori key (`plainSecretSettingKeys`, `plainTextSettingKeys`, vs `richTextSettingKeys` seperti banner/template) bersama allowlist key untuk admin & pengecualian permanen `master_coupons` di `Index` menutup celah korupsi & over-posting sekaligus.
2. **Isolasi Endpoint Admin vs Merchant (`SET-P1-02`)**:
   - Meskipun `POST /api/settings` sudah dikunci dengan `RequirePermission("system:settings:manage")`, ia masih berada di grup `guardedMutations` (`StoreOwnerRequired`), sehingga admin platform tanpa toko pasti terkena `403` terlebih dahulu sebelum Tablet beralih ke `/api/admin/settings`. Menghapus fallback ke `/api/settings` di Tablet dan membatasi payload `handleSavePaymentSettings` hanya pada `payment_*` & `aulaa_*` memastikan staf keuangan bisa menyimpan konfigurasi tanpa error RBAC.

#### A3.5 Rencana Remediasi Terstruktur (Selesai Dieksekusi)
- **Gelombang 1 — Backend Setting Sanitizer, Key Allowlist & Store Detail DTO**:
  1. Pisahkan sanitasi di `persistPlatformSettings` ([setting_handler.go](file:///c:/MyProject/DFauna/backend/internal/handlers/setting_handler.go)): key secret (`smtp_password`, `aulaa_api_key`, `aulaa_webhook_secret`) memakai `sanitizeSecretSettingValue` lossless tanpa HTML entity escaping, key rich HTML (`terms_conditions`, `privacy_policy`, `legal_warning_banner`) memakai `SanitizeRichText`, key plain/template/URL/ads memakai `SanitizePlainText`, `Store` menerapkan allowlist eksplisit `allowedAdminSettingKeys`, dan `Index` selalu mengecualikan `master_coupons`.
  2. Hapus `CustomDomainVerificationToken` dan `ReactivationToken` sebelum serialisasi pada `AdminGetStoreDetail` ([store_handler.go](file:///c:/MyProject/DFauna/backend/internal/handlers/store_handler.go)), serta perbaiki `COALESCE(NULLIF(dormancy_status, ''), 'active')` di filter & statistik `AdminListStores` + tambah rincian `total_suspended`.
  3. Tambah unit test regresi di [rbac_handler_test.go](file:///c:/MyProject/DFauna/backend/internal/handlers/rbac_handler_test.go) dan [store_handler_test.go](file:///c:/MyProject/DFauna/backend/internal/handlers/store_handler_test.go) (`TestAdminListStores_NullDormancyAndDetailRedaction_SQLite`).
- **Gelombang 2 — Paritas Tri-Frontend & Verifikasi E2E**:
  1. Perbaiki `TabletPlatformConsole.handleSavePaymentSettings` agar hanya mengirim 15 field `payment_*` + `aulaa_*` melalui `authFetch('/api/admin/settings')`, hapus fallback `/api/settings` dari `handleSavePaymentSettings` dan `handleSaveRekberSettings`, serta hilangkan tombol duplikat `"Simpan Kontak"` pada header Kontak Resmi Tablet.
  2. Sinkronkan `contact_whatsapp` & `contact_email` di `Mobile PlatformRolePortal.handleSaveContactSettings` (serta fallback pembacaan input) agar 100% paritas dengan Desktop & Tablet.
  3. Tambahkan penanganan `401`/`403` (`onLogout?.()`) dan `detailError` di [AdminStoresManagement.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/components/AdminStoresManagement.tsx) (Desktop) serta [AdminStoresManagement.tsx](file:///c:/MyProject/DFauna/frontend/mobile/src/components/AdminStoresManagement.tsx) (Mobile), pindahkan `useModalBackHandler` menjadi *self-contained* di [TabletOfficialContactModal.tsx](file:///c:/MyProject/DFauna/frontend/tablet/src/components/TabletOfficialContactModal.tsx) (tanpa duplikasi di [TabletHelpdeskView.tsx](file:///c:/MyProject/DFauna/frontend/tablet/src/components/TabletHelpdeskView.tsx)), dan ganti seluruh `window.confirm` Reset Rekber dengan modal konfirmasi kustom di Desktop & Tablet serta Bottom Sheet drag-to-dismiss bersih tanpa tombol silang di Mobile.

#### A3.6 Status Remediasi & Bukti Verifikasi Final (`2026-11-28`)
| Pemeriksaan | Hasil Pengukuran Pasca-Edit Terakhir | Rincian Teramati |
| :--- | :--- | :--- |
| `cd backend; go test -count=1 ./...` | **PASS** (`exit 0`, **13** paket teruji lulus) | Seluruh paket backend lolos setelah edit backend final, termasuk `internal/handlers` (`42.797s`) dan test regresi A3 baru di `rbac_handler_test.go` & `store_handler_test.go`. |
| **Tri-Build Verification** (`frontend/desktop`, `frontend/tablet`, `frontend/mobile`) | **PASS** (`0` error TypeScript & Vite build) | Desktop `2.59s` (`2009 modules`), Tablet rebuild final pasca `TabletHelpdeskView.tsx` `1.55s` (`2020 modules`), Mobile `1.81s` (`2004 modules`). |
| **Runtime HTTP API + PostgreSQL (`catavor_audit_tmp`)** | **6/6 PASS** (`exit 0`) | Login MFA admin (`role=superadmin`); `GET /api/admin/stores?status=active` menyertakan toko `dormancy_status NULL` (`toko-null-e2e`) + `total_suspended=1, total_banned=2`; `AdminGetStoreDetail` menyembunyikan token verifikasi domain; `GET /api/admin/settings` menyingkirkan `master_coupons` tanpa `?exclude`; `POST /api/admin/settings` menolak key non-allowlist (`400`); PostgreSQL menyimpan `Smtp<Pass>&'123` dan `Aulaa<Key>&'XYZ` secara utuh tanpa HTML escaping sementara `GET` tetap melakukan masking (`****'123`). |
| **Playwright Headless E2E (Desktop `1280x800`, Tablet `768x1024`, Mobile `390x844`)** | **12/12 UI Checks PASS** (**Total 18/18 PASS**, `0` uncaught `pageerror`, `0` native `window.confirm` dialog) | Desktop: error detail toko tampil eksplisit + modal Reset Rekber kustom; Tablet: tombol kontak tunggal (`submitCount=1, dupCount=0`), simpan pembayaran strictly `15` key `payment_*/aulaa_*` (`0` hit `/api/settings`), modal Reset Rekber kustom, & `TabletOfficialContactModal` menutup mulus pada `page.goBack()` tanpa keluar dari helpdesk; Mobile: error detail sheet, sinkronisasi `4` key kontak ke PostgreSQL (`6281234567890` / `official-a3@catavor.com`), & Bottom Sheet Reset Rekber tanpa `X` header (`headerButtons=0`). |

*Catatan residu `DIR-P3-01`: duplikasi kode terisolasi antara `OfficialContactModal.tsx` (Desktop) & `TabletOfficialContactModal.tsx` (Tablet) dipertahankan terpisah agar batas bundle Vite per form-factor tetap independen sementara tombol duplikat Kontak Tablet sudah dihapus (`FIXED`).*

---

### A4. Audit Mendalam: Pusat Notifikasi In-App & Siklus Hidup SSE (`2026-11-28`)

#### A4.1 Ruang Lingkup & File Terinspeksi
Audit dilakukan dengan membaca langsung kode sumber backend, middleware SSE ticket, worker pembersih, model DB, unit test terkait, dan komponen UI lintas 3 device (fase audit tanpa mengubah kode produksi):
- **Backend, Model, Security & Workers**:
  - [main.go](file:///c:/MyProject/DFauna/backend/cmd/server/main.go#L45-L130) & [main.go](file:///c:/MyProject/DFauna/backend/cmd/server/main.go#L559-L572) (mounting `authOnly` `/notifications/*` & `/v1/notifications/*`)
  - [notification.go](file:///c:/MyProject/DFauna/backend/internal/models/notification.go#L1-L89) (`Notification`, `NotificationRecipient`, `NotificationRead`)
  - [notification_handler.go](file:///c:/MyProject/DFauna/backend/internal/handlers/notification_handler.go#L26-L990) & [notification_handler.go](file:///c:/MyProject/DFauna/backend/internal/handlers/notification_handler.go#L2080-L2332) (`GetNotifications`, `GetNotificationByID`, `MarkAsRead`, `TrackClick`, `MarkAllAsRead`, `Dismiss`, `ClearReadNotifications`, `IssueStreamTicket`, `Stream`)
  - [notification_hub.go](file:///c:/MyProject/DFauna/backend/internal/services/notification_hub.go#L1-L583) (`Register`, `Unregister`, `StartRedisPubSubBridge`, `Broadcast`, `BroadcastRemoval`, `BroadcastTicketEvent`, `BroadcastStoreEvent`, `BroadcastQuotaEvent`, `isClientTargetMatch`)
  - [notification_cleaner.go](file:///c:/MyProject/DFauna/backend/internal/services/notification_cleaner.go#L1-L330) (`StartNotificationCleaner`, `StartBroadcastScheduler`, `PublishDueScheduledBroadcasts`, `runCleanup`)
  - [sse_ticket.go](file:///c:/MyProject/DFauna/backend/internal/security/sse_ticket.go#L1-L190), [sse_ticket_redis.go](file:///c:/MyProject/DFauna/backend/internal/services/sse_ticket_redis.go#L1-L46), [auth.go](file:///c:/MyProject/DFauna/backend/internal/middleware/auth.go#L330-L420)
- **Tri-Frontend (Desktop, Tablet, Mobile)**:
  - Desktop: [NotificationHeaderPopover.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/components/NotificationHeaderPopover.tsx#L1-L619), [MerchantAdminShell.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/components/MerchantAdminShell.tsx#L1250-L1305), [App.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/App.tsx#L4305-L5035), [App.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/App.tsx#L5930-L6050), [App.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/App.tsx#L27235-L27510), [PlatformRolePortal.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/components/PlatformRolePortal.tsx#L2100-L2215)
  - Tablet: [TabletMerchantAdmin.tsx](file:///c:/MyProject/DFauna/frontend/tablet/src/components/TabletMerchantAdmin.tsx#L2735-L2915), [TabletMerchantAdmin.tsx](file:///c:/MyProject/DFauna/frontend/tablet/src/components/TabletMerchantAdmin.tsx#L3285-L3415), [TabletMerchantAdmin.tsx](file:///c:/MyProject/DFauna/frontend/tablet/src/components/TabletMerchantAdmin.tsx#L4045-L4075), [TabletMerchantAdmin.tsx](file:///c:/MyProject/DFauna/frontend/tablet/src/components/TabletMerchantAdmin.tsx#L12180-L13215), [TabletHelpdeskView.tsx](file:///c:/MyProject/DFauna/frontend/tablet/src/components/TabletHelpdeskView.tsx#L505-L560), [TabletPlatformConsole.tsx](file:///c:/MyProject/DFauna/frontend/tablet/src/components/TabletPlatformConsole.tsx#L1375-L1440)
  - Mobile: [App.tsx](file:///c:/MyProject/DFauna/frontend/mobile/src/App.tsx#L4405-L5005), [App.tsx](file:///c:/MyProject/DFauna/frontend/mobile/src/App.tsx#L5995-L6060), [App.tsx](file:///c:/MyProject/DFauna/frontend/mobile/src/App.tsx#L30875-L31135), [PlatformRolePortal.tsx](file:///c:/MyProject/DFauna/frontend/mobile/src/components/PlatformRolePortal.tsx#L2170-L2290)

#### A4.2 Ringkasan Pengukuran Baseline (Sebelum Remediasi)
| Pemeriksaan | Hasil Pengukuran Aktual (`go test -count=1`) | Catatan Audit |
| :--- | :--- | :--- |
| `./internal/handlers` (`TestNotification\|TestBroadcastEnterprise\|TestCloudflareAudit_SSENotification`) | **PASS** (`0.805s`) | Test handler memakai rute tiruan lama (`PATCH .../read`, `DELETE .../read/clear`, `/notifications/stream-ticket`); belum menguji kebocoran `target_name` broadcast `specific` di SSE/JSON, `BroadcastStoreEvent`/`BroadcastQuotaEvent` Redis bridge, `total_filtered` pada filter aktif, atau loop reconnect tiket hangus. |
| `./internal/security` (`TestSSETicket`) | **PASS** (`0.032s`) | Memverifikasi tiket single-use 32-byte, isolasi user, per-user cap `8`, dan konkurensi. |

#### A4.3 Matriks Temuan Audit (`0` P0, `4` P1, `3` P2, `0` P3 — Seluruhnya Selesai & Terverifikasi)
| ID | Severity | Area | Ringkasan Temuan | Bukti Lokasi Kode | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **NOTIF-P1-01** | **P1** | BE / SSE Security & Multi-Node | Payload `NotificationHub.dispatchLocalBroadcast` serta `GetNotifications`/`GetNotificationByID` mengirim entitas mentah `*models.Notification` yang memuat `target_name` (`"N Penerima Terpilih (Toko X, Toko Y, ...)"`) dan `created_by`/`target_audience_count` ke penerima broadcast `specific`, membocorkan identitas penerima lain; selain itu `BroadcastStoreEvent` dan `BroadcastQuotaEvent` tidak mem-publish ke Redis Pub/Sub sehingga tidak terkirim ke klien pada instance lain saat horizontal scaling. | `notification_hub.go` L257–260, L439–537; `notification.go` L10–19; `notification_handler.go` L430, L580 | **FIXED & VERIFIED** |
| **NOTIF-P1-02** | **P1** | BE / DB Multi-Store Receipts | Pada konteks akun (`storeID == 0`, mis. pemilik multi-toko), `GetNotifications` me-`LEFT JOIN` `notification_reads` dengan `store_id IS NULL OR store_id IN (...)` secara non-deterministik lalu membuang duplikat via `seenNotifIDs`, sedangkan `MarkAllAsRead` mengecek `WHERE notification_reads.id IS NULL` (melewati notif jika toko lain punya receipt atau bila ada receipt tanpa `read_at`) serta melakukan loop N+1 serial di luar transaksi; `ClearReadNotifications` juga tidak menangani read receipt lintas toko konsisten saat `storeID == 0`. | `notification_handler.go` L442–444, L467, L791–808, L859–868 | **FIXED & VERIFIED** |
| **NOTIF-P1-03** | **P1** | FE Desktop & Mobile SSE Lifecycle | Handler `eventSource.onerror` pada Desktop & Mobile hanya menutup `EventSource` bila `readyState === EventSource.CLOSED`. Padahal saat jaringan putus atau idle timeout proxy, `EventSource` masuk ke state `CONNECTING` (`0`) dan langsung me-replay GET `/api/notifications/stream?ticket=<consumed>` dengan tiket sekali pakai yang sudah hangus, memicu penolakan `401 INVALID_TICKET` berulang (berbeda dengan Tablet yang langsung menutup tanpa syarat & mengambil tiket baru). | Desktop `App.tsx` L4999–5010; Mobile `App.tsx` L4948–4961; bandingkan Tablet `TabletMerchantAdmin.tsx` L3374–3386 | **FIXED & VERIFIED** |
| **NOTIF-P1-04** | **P1** | FE Tablet & Admin SSE Contract | `TabletHelpdeskView` mengirim query `?store_slug=` (alih-alih `?slug=`) ke `/api/notifications/stream`, padahal `middleware/auth.go` & `notification_handler.go` hanya membaca `slug` atau `X-Store-Slug`, sehingga stream helpdesk pemilik multi-toko selalu jatuh ke toko pertama; selain itu `PlatformRolePortal` (Desktop/Mobile), `TabletPlatformConsole`, dan `TabletHelpdeskView` memanggil `POST /api/notifications/ticket` tanpa header `Authorization`, sedangkan Desktop/Mobile `App.tsx` keluar dini bila token `localStorage` kosong (tidak mendukung sesi murni cookie `HttpOnly`). | `TabletHelpdeskView.tsx` L512–525; `auth.go` L405; `notification_handler.go` L270; Desktop `App.tsx` L4669; Mobile `App.tsx` L4717; `PlatformRolePortal.tsx` L2109/L2181; `TabletPlatformConsole.tsx` L1384 | **FIXED & VERIFIED** |
| **NOTIF-P2-01** | **P2** | Tri-FE Event & Popover Parity | `TabletMerchantAdmin` menangani `notification`, `notification_deleted`, dan `quota_updated`, namun tidak memproses event real-time `store_status_updated` maupun `ticket_*` saat merchant berada di tab selain `help` (berbeda dengan Desktop & Mobile); di Desktop, `NotificationHeaderPopover` berbagi state `notifications` yang ter-overwrite oleh filter aktif (`unread`/`security`/`page > 1`) di tab Pusat Notifikasi serta memakai tombol `<X>` tanpa `useModalBackHandler` & tanpa `handleTrackNotifClick`. | `TabletMerchantAdmin.tsx` L3326–3372; `NotificationHeaderPopover.tsx` L252–272, L409–415; Desktop `MerchantAdminShell.tsx` L1279–1298 | **FIXED & VERIFIED** |
| **NOTIF-P2-02** | **P2** | FE Tablet Paging & Non-Vector Close | `TabletMerchantAdmin` selalu mengisi `notifTotal` dari `json.total_all` alih-alih `json.total_filtered` pada `TabletSegmentedPagination`, sehingga saat filter `unread`/`security`/`system` atau pencarian aktif, jumlah halaman yang ditampilkan tetap sebesar total global dan memungkinkan klik halaman kosong; tombol reset input pencarian di Desktop, Tablet, dan Mobile masih memakai karakter teks `✕` alih-alih ikon Lucide `<X />`. | `TabletMerchantAdmin.tsx` L2760–2765, L12797, L13204–13210; Desktop `App.tsx` L27462; Mobile `App.tsx` L31038 | **FIXED & VERIFIED** |
| **NOTIF-P2-03** | **P2** | BE / FE Resilience | Mutasi optimistis `handleMarkAsRead`, `handleMarkAllAsRead`, `handleClearReadNotifications`, dan `handleDismissNotification` di ketiga frontend tidak memiliki rollback apabila respons server gagal (`!res.ok`) dan langsung menampilkan toast sukses; di backend, `GetNotifications` memuat seluruh histori 30 hari ke memori Go sebelum slicing paginasi sementara `MarkAllAsRead` menulis DB satu per satu di luar transaksi. | Desktop `App.tsx` L4392–4472; Mobile `App.tsx` L4494–4599; `TabletMerchantAdmin.tsx` L2815–2898; `notification_handler.go` L451, L803–808 | **FIXED & VERIFIED** |

#### A4.4 Sub-Catatan Audit Mendalam Per Masalah
1. **Kebocoran Metadata `specific` & Redis Pub/Sub Gap (`NOTIF-P1-01`)**:
   - Pada model `Notification`, kolom `TargetRecipients` sudah dianotasi `json:"-"`, namun field `TargetName` dan `TargetAudienceCount` ikut di-marshal utuh ke setiap SSE frame & listing merchant. Untuk target non-global (`specific`, `single_store`, `single_user`), sanitasi DTO proyeksi respons merchant/SSE harus mengosongkan `TargetName` berantai dan metadata internal admin (`CreatedBy`, `RevokedBy`, `TargetAudienceCount`) agar privasi antar-tenant tetap tertutup.
   - Menambahkan amplop Redis Pub/Sub `store_event` dan `quota_event` di `NotificationHub` (matching `BroadcastTicketEvent`) menjamin eviksi akun `banned`/`suspended` dan pembaruan kuota `pro_*` instan walau klien & worker berada di node backend yang berbeda.
2. **Tiket Sekali Pakai `EventSource` di Desktop/Mobile (`NOTIF-P1-03` & `NOTIF-P1-04`)**:
   - Arsitektur tiket 30 detik single-use di `sse_ticket.go` & `sse_ticket_redis.go` sudah kuat di sisi server. Celahnya ada di klien: Desktop & Mobile memeriksa `readyState === EventSource.CLOSED` padahal `EventSource` HTML5 menyetel `readyState = CONNECTING` (`0`) pada kegagalan jaringan biasa dan mengulang URL bertiket sama hingga dibatalkan `.close()`. Menyamakan seluruh handler `onerror` agar **selalu** memanggil `eventSource.close()` + menjadwalkan `connectSSE()` dengan exponential backoff + mengganti `?store_slug=` menjadi `?slug=` di `TabletHelpdeskView` menutup gap reliabilitas ini tuntas.

#### A4.5 Rencana Remediasi Terstruktur (Selesai Dieksekusi)
- **Gelombang 1 — Backend DTO Redaction, Redis Pub/Sub Parity & Transaction Tests**:
  1. Tambah `Notification.SanitizedForRecipient()` ([notification.go](file:///c:/MyProject/DFauna/backend/internal/models/notification.go)) yang menghapus `TargetRecipients`, `CreatedBy`, `RevokedBy`, `RevokedAt`, `TargetAudienceCount`, `IdempotencyKey`, dan `TargetName` (untuk `specific`) pada respons HTTP `GetNotifications`/`GetNotificationByID` maupun siaran SSE `NotificationHub.dispatchLocalBroadcast`.
  2. Tambah propagasi Redis Pub/Sub `store_event` dan `quota_event` di `BroadcastStoreEvent` dan `BroadcastQuotaEvent` ([notification_hub.go](file:///c:/MyProject/DFauna/backend/internal/services/notification_hub.go)) plus dukungan cakupan staf platform (`IsPlatformStaffRole`).
  3. Perbaiki `GetNotifications` (deterministik ordering untuk `storeID == 0`), ekstrak `upsertNotificationReadWithDB`, bungkus `MarkAllAsRead` dalam `h.DB.Transaction(...)`, dan selaraskan `ClearReadNotifications` multi-toko ([notification_handler.go](file:///c:/MyProject/DFauna/backend/internal/handlers/notification_handler.go)), serta tambah tes regresi di [notification_handler_test.go](file:///c:/MyProject/DFauna/backend/internal/handlers/notification_handler_test.go) dan [notification_hub_test.go](file:///c:/MyProject/DFauna/backend/internal/services/notification_hub_test.go).
- **Gelombang 2 — Tri-Frontend SSE Lifecycle, Paging & Optimistic Rollback + Verifikasi E2E**:
  1. Perbaiki `eventSource.onerror` di Desktop & Mobile [App.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/App.tsx) / [Mobile App.tsx](file:///c:/MyProject/DFauna/frontend/mobile/src/App.tsx) agar selalu memanggil `eventSource.close()` sebelum exponential backoff retry, perbaiki `?store_slug=` -> `?slug=` di [TabletHelpdeskView.tsx](file:///c:/MyProject/DFauna/frontend/tablet/src/components/TabletHelpdeskView.tsx), serta selaraskan pengiriman `Authorization` & dukungan cookie session di Portal & SSE ticket requester.
  2. Gunakan `notifFilteredTotal` dari `json.total_filtered` pada `TabletSegmentedPagination`, tambah handler SSE `store_status_updated` & ticket events di [TabletMerchantAdmin.tsx](file:///c:/MyProject/DFauna/frontend/tablet/src/components/TabletMerchantAdmin.tsx), isolasikan `popoverNotifications` + `useModalBackHandler` (`showNotifPopover`) + `handleTrackNotifClick` pada [MerchantAdminShell.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/components/MerchantAdminShell.tsx) & Desktop [App.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/App.tsx), ganti ikon tutup pencarian `✕` -> `<X size={14} />`, dan lengkapi rollback optimistis + toast error di 3 frontend.

#### A4.6 Status Remediasi & Bukti Verifikasi Final (`2026-11-28`)
| Pemeriksaan | Hasil Pengukuran Pasca-Edit Terakhir | Rincian Teramati |
| :--- | :--- | :--- |
| `cd backend; go test -count=1 ./...` | **PASS** (`exit 0`, **13** paket teruji lulus) | Seluruh paket backend lulus pasca-edit terakhir (`internal/handlers` `26.467s`, `internal/services` `19.076s`, `internal/security` `0.116s`, `internal/middleware` `2.391s`, dst.), mencakup `TestNotificationRecipientPrivacyAndFilteredTotal` serta `notification_hub_test.go`. |
| **Tri-Build Verification** (`frontend/desktop`, `frontend/tablet`, `frontend/mobile`) | **PASS** (`0` error TypeScript & Vite build) | Desktop `1.29s` (`2009 modules`), Tablet `1.18s` (`2020 modules`), Mobile `1.88s` (`2004 modules`). |
| **Runtime HTTP, SSE & Playwright Tri-Frontend E2E (`catavor_audit_tmp`, port `8199`)** | **7/7 Checks PASS** (`exit 0`, `0` uncaught `pageerror`) | `admin_mfa_login` (Superadmin TOTP MFA); `sse_ticket_single_use` (`200` stream lalu replay tiket ditolak `401`); `sse_specific_privacy` (broadcast `specific` ter-sanitasi tanpa membocorkan target Store B `Adidas` di frame SSE); `http_privacy_and_total_filtered` (`total_all=26`, `security total_filtered=12`, redaksi HTTP list & detail); Desktop `1280x800` (back-close `NotificationHeaderPopover`, isolasi popover saat daftar utama 0 hasil, clear `<X />`, rollback optimistis `/dismiss` `500`, `ticketCalls=2`); Tablet `768x1024` (paginasi terfilter menyembunyikan hal. 2 palsu untuk `12 < 15` item, clear `<X />`, rollback + toast); Mobile `390x844` (halaman notifikasi bersih, clear `<X />`, rollback optimistis `/read-all` `500`). |

---

### A5. Audit Mendalam: Safe Domains & Peringatan Tautan Eksternal (`2026-11-28`)

#### A5.1 Ruang Lingkup & File Terinspeksi
Audit dilakukan dengan membaca langsung kode sumber backend, cache Redis, model DB, seeder, unit test terkait, utilitas keamanan URL klien, dan komponen UI lintas 3 device (fase audit tanpa mengubah kode produksi):
- **Backend, Model, Cache & Seeding**:
  - [main.go](file:///c:/MyProject/DFauna/backend/cmd/server/main.go#L478-L479) & [main.go](file:///c:/MyProject/DFauna/backend/cmd/server/main.go#L808-L812) (rute publik `/safe-domains`, `/public/safe-domains` & 5 rute admin `system:settings:manage`)
  - [safe_domain_handler.go](file:///c:/MyProject/DFauna/backend/internal/handlers/safe_domain_handler.go#L1-L510) (`GetPublicSafeDomains`, `GetAdminSafeDomains`, `CreateSafeDomain`, `UpdateSafeDomain`, `DeleteSafeDomain`, `ResetDefaultSafeDomains`)
  - [safe_domain.go](file:///c:/MyProject/DFauna/backend/internal/models/safe_domain.go#L1-L15) (`SafeDomain`), [db.go](file:///c:/MyProject/DFauna/backend/internal/database/db.go#L978-L995) (`seedDefaultSafeDomains`), [redis.go](file:///c:/MyProject/DFauna/backend/internal/database/redis.go#L210-L242) (`GetSafeDomainsCache`, `SetSafeDomainsCache`, `InvalidateSafeDomainsCache`)
- **Tri-Frontend Utilities, Modal & Admin UI**:
  - URL Security: [Desktop urlSecurity.ts](file:///c:/MyProject/DFauna/frontend/desktop/src/utils/urlSecurity.ts#L1-L464), [Tablet urlSecurity.ts](file:///c:/MyProject/DFauna/frontend/tablet/src/utils/urlSecurity.ts#L1-L464), [Mobile urlSecurity.ts](file:///c:/MyProject/DFauna/frontend/mobile/src/utils/urlSecurity.ts#L1-L464)
  - Warning Modal: [Desktop ExternalLinkWarningModal.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/components/ExternalLinkWarningModal.tsx#L1-L344), [Tablet ExternalLinkWarningModal.tsx](file:///c:/MyProject/DFauna/frontend/tablet/src/components/ExternalLinkWarningModal.tsx#L1-L346), [Mobile ExternalLinkWarningModal.tsx](file:///c:/MyProject/DFauna/frontend/mobile/src/components/ExternalLinkWarningModal.tsx#L1-L398)
  - Redirect & Modal Mount Callers: [Desktop App.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/App.tsx#L4224-L4252), [Desktop App.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/App.tsx#L35071-L35076), [Mobile App.tsx](file:///c:/MyProject/DFauna/frontend/mobile/src/App.tsx#L4271-L4299), [Mobile App.tsx](file:///c:/MyProject/DFauna/frontend/mobile/src/App.tsx#L36841-L36846), [Tablet App.tsx](file:///c:/MyProject/DFauna/frontend/tablet/src/App.tsx#L81-L96), [TabletStoreCatalog.tsx](file:///c:/MyProject/DFauna/frontend/tablet/src/components/TabletStoreCatalog.tsx#L647-L669), [RichTextarea.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/components/RichTextarea.tsx#L59-L87), [TabletMerchantAdmin.tsx](file:///c:/MyProject/DFauna/frontend/tablet/src/components/TabletMerchantAdmin.tsx#L12742-L13295)
  - Admin Console CRUD: [Desktop AdminSafeDomainsManagement.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/components/AdminSafeDomainsManagement.tsx#L1-L1030), [Tablet AdminSafeDomainsManagement.tsx](file:///c:/MyProject/DFauna/frontend/tablet/src/components/AdminSafeDomainsManagement.tsx#L1-L1107), [Mobile AdminSafeDomainsManagement.tsx](file:///c:/MyProject/DFauna/frontend/mobile/src/components/AdminSafeDomainsManagement.tsx#L1-L1107), [Desktop PlatformRolePortal.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/components/PlatformRolePortal.tsx#L3856-L3883), [Desktop PlatformRolePortal.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/components/PlatformRolePortal.tsx#L13069-L13077), [Mobile PlatformRolePortal.tsx](file:///c:/MyProject/DFauna/frontend/mobile/src/components/PlatformRolePortal.tsx#L3906-L3933), [Mobile PlatformRolePortal.tsx](file:///c:/MyProject/DFauna/frontend/mobile/src/components/PlatformRolePortal.tsx#L11983-L11991), [TabletPlatformConsole.tsx](file:///c:/MyProject/DFauna/frontend/tablet/src/components/TabletPlatformConsole.tsx#L9949-L9956)

#### A5.2 Ringkasan Pengukuran Baseline (Sebelum Remediasi)
| Pemeriksaan | Hasil Pengukuran Aktual (`go test -count=1`) | Catatan Audit |
| :--- | :--- | :--- |
| `./internal/handlers -run "SafeDomain\|TestAdminAuditTrail"` | **2 fungsi test PASS** (`0.086s`: `TestHardening_SafeDomainSessionAndRetentionArchival` `0.02s`, `TestSafeDomainHandler_NilDB_NotPanic` `0.00s`) | Hanya menguji Smoke CRUD + audit log & nil-DB panic. Tidak ada `safe_domain_handler_test.go`, tidak ada uji validasi sintaks host / punycode IDN / userinfo spoof / query strip, tidak ada uji proteksi `DELETE` domain sistem (`is_system=true`), `is_active: false` saat create, maupun konflik `409` saat update. |

#### A5.3 Matriks Temuan Audit (`0` P0, `4` P1, `3` P2, `1` P3 — Seluruhnya Selesai & Terverifikasi)
| ID | Severity | Area | Ringkasan Temuan | Bukti Lokasi Kode | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SAFE-P1-01** | **P1** | BE / Validation, Integrity & System Guard | `CreateSafeDomain` dan `UpdateSafeDomain` hanya memangkas `https://`, `http://`, `www.`, `/`, dan `:` tanpa memvalidasi sintaks host/domain, IDNA/punycode, karakter spasi/wildcard, query `?`/`#`, maupun userinfo (`@`, misal `catavor.com@evil.com`); `CreateSafeDomain` juga mengabaikan `req.IsActive` dan menanamkan `IsActive: true` secara statis; `UpdateSafeDomain` tidak mengecek duplikasi domain lain (memicu `500` PostgreSQL `uniqueIndex` alih-alih `409`) serta mengabaikan domain kosong; dan `DeleteSafeDomain` tidak memblokir penghapusan domain ber-flag `IsSystem: true` meski UI dan docstring melarangnya. | `safe_domain_handler.go` L210–266, L327–373, L410–432 | **FIXED & VERIFIED** |
| **SAFE-P1-02** | **P1** | Tri-FE URL Security & Cache Lock | `handleSafeExternalRedirect` di Desktop, Mobile, dan Tablet Storefront menempelkan prefix `https://` secara membabi-buta **sebelum** `checkUrlSecurity()`, sehingga skema berbahaya `javascript:alert(1)` lolos sebagai hostname `'javascript'`, URL protocol-relative `//evil.com` melewati guard `urlSecurity.ts:281`, dan `mailto:`/`tel:` maupun path internal `/` rusak. Selain itu, [urlSecurity.ts](file:///c:/MyProject/DFauna/frontend/desktop/src/utils/urlSecurity.ts#L36-L69) mengisi `dynamicSafeDomainsCache` secara sinkron dari `localStorage` lalu `loadDynamicSafeDomains` (`L43`) langsung return apabila `length > 0 && !forceRefresh` — membuat cek TTL 30 menit (`L67`) tidak pernah tercapai dan whitelist yang diubah/dinonaktifkan admin tidak pernah terefresh ke browser pengguna setelah kunjungan pertama; sementara `isSameHost` (`L358`) mencocokkan hostname tanpa port sehingga beda origin port tetap dianggap rute internal. *(Tambahan teramati saat E2E: `ExternalLinkWarningModal` sebelumnya tidak ikut ter-mount di early return `/admin` `<PlatformRolePortal>` Desktop & Mobile, serta `Mobile PlatformRolePortal.handlePopState` tidak membaca `?sub=` sehingga modal close memulangkan admin ke menu.)* | Desktop `App.tsx` L4224–4230, L15100; Mobile `App.tsx` L4271–4277, L15652; `Mobile PlatformRolePortal.tsx` L2461; `TabletStoreCatalog.tsx` L647–657; 3x `urlSecurity.ts` L36–69, L281, L358 | **FIXED & VERIFIED** |
| **SAFE-P1-03** | **P1** | FE Mobile Standards & Modal Back | [Mobile AdminSafeDomainsManagement.tsx](file:///c:/MyProject/DFauna/frontend/mobile/src/components/AdminSafeDomainsManagement.tsx) melanggar standar wajib `AGENTS.md`: masih memuat karakter emoji lampu (`U+1F4A1`) pada teks bantuan input domain (`L993`), memakai HTML native `<select>` untuk kategori (`L1001–1025`) alih-alih `<MobileCustomSelect>` + in-sheet drill-down `<MobileSheetStack>`, dan `Math.max(0, formSheetDragY)` (`L899`) meniadakan elastisitas rubber-band (`L145`). Di sisi Desktop, `AdminSafeDomainsManagement.tsx` (`L831`) tidak memasang `useModalBackHandler`, dan ketiga frontend masih memakai `window.confirm(...)` bawaan browser saat menghapus domain. | Mobile `AdminSafeDomainsManagement.tsx` L145, L316, L899, L993, L1001–1025; Tablet `L324`; Desktop `L112, L279, L831` | **FIXED & VERIFIED** |
| **SAFE-P1-04** | **P1** | FE Tablet Console Action Gap | [TabletPlatformConsole.tsx:9949](file:///c:/MyProject/DFauna/frontend/tablet/src/components/TabletPlatformConsole.tsx#L9949) merender `<AdminSafeDomainsManagement>` tanpa tombol kontrol `+ Tambah Domain`, `Segarkan`, maupun `Sinkronkan Default` (berbeda dengan Desktop `PlatformRolePortal.tsx:3862` dan Mobile `L3912`), sedangkan `AdminSafeDomainsManagement` hanya menaruh tombol `+ Tambah Domain` di blok empty-state (`domains.length === 0`). Karena DB selalu melakukan seeding 3 domain sistem dasar, pengelola Tablet **sama sekali tidak memiliki cara menambah domain baru**. | `TabletPlatformConsole.tsx` L9949–9955; Tablet `AdminSafeDomainsManagement.tsx` L422–458, L568; bandingkan Desktop `PlatformRolePortal.tsx` L3856–3883 | **FIXED & VERIFIED** |
| **SAFE-P2-01** | **P2** | BE Redis Cache & Search Wildcard | `InvalidateSafeDomainsCache` ([redis.go:238](file:///c:/MyProject/DFauna/backend/internal/database/redis.go#L238)) memanggil `RedisClient.Keys("safe_domains:*")` (blocking `O(N)` di Redis produksi) dan `GetAdminSafeDomains` (`L122`) membuat key cache tanpa batas untuk setiap kombinasi query `?q=...`, selain belum meng-escape wildcard `%`/`_` di klausa `LIKE`. | `redis.go` L233–242; `safe_domain_handler.go` L122, L135–138 | **FIXED & VERIFIED** |
| **SAFE-P2-02** | **P2** | FE Warning Modal Reset & Touch Parity | `ExternalLinkWarningModal.tsx` (Desktop `L29`, Tablet `L35`, Mobile `L28`) tidak me-reset state `dontRemind` dan `copied` ketika prop `url` berganti domain target atau ditutup kembali, sehingga centang *"Jangan ingatkan lagi"* dapat terbawa ke domain eksternal berikutnya. Pada Mobile `ExternalLinkWarningModal.tsx`, tombol `Batal`, `Buka Tautan`, dan `Salin` belum menjamin `minHeight: 44px`, dan `useEffect` `Escape` (`L85`) menyimpan referensi `closeWithAnimation` tanpa memperbarui deps/timer aman. | Desktop `ExternalLinkWarningModal.tsx` L29–48; Tablet `L35–48`; Mobile `L28–86, L294–393` | **FIXED & VERIFIED** |
| **SAFE-P2-03** | **P2** | FE Stats & Unwired Reset Endpoint | Kartu metrik `STATUS AKTIF`, `DEFAULT SISTEM`, dan `KUSTOM ADMIN` pada ketiga `AdminSafeDomainsManagement.tsx` dihitung dari array halaman aktif `domains.filter(...)` sementara `TOTAL DOMAIN` memakai `pagination.total` global, menghasilkan angka yang tidak konsisten saat total > `limit` (10); selain itu endpoint backend `POST /api/admin/safe-domains/reset-defaults` (`main.go:812`) belum terhubung ke tombol UI mana pun. | Desktop `L216–222`; Tablet `L261–267`; Mobile `L253–259`; `main.go:812` | **FIXED & VERIFIED** |
| **SAFE-P3-01** | **P3** | FE Accessibility & Clipboard Guard | Tombol clear pencarian & tombol tutup modal `X` di `AdminSafeDomainsManagement` belum dilengkapi `aria-label`, serta `navigator.clipboard.writeText(...)` dipanggil tanpa blok `try/catch` atau fallback jika izin clipboard ditolak browser. | Desktop/Tablet/Mobile `AdminSafeDomainsManagement.tsx` & `ExternalLinkWarningModal.tsx` | **FIXED & VERIFIED** |

#### A5.4 Sub-Catatan Audit Mendalam Per Masalah
1. **Mutasi `https://` Sebelum `checkUrlSecurity` & TTL 30 Menit yang Terkunci (`SAFE-P1-02`)**:
   - Arsitektur `urlSecurity.ts` sebenarnya sudah cukup komprehensif — menolak skema `javascript:`/`data:`/`vbscript:`/`file:`/`blob:`, menolak `//evil.com`, menormalisasi naked domain dengan `isDomainLike()`, dan mempertahankan daftar `catavor_user_trusted_domains`. Tetapi bug urutan di caller `handleSafeExternalRedirect` mengubah `'javascript:alert(1)'` menjadi `'https://javascript:alert(1)'` sebelum diperiksa, sehingga parser `URL` memandangnya sebagai hostname `'javascript'` dengan protokol `'https:'`! Membiarkan `checkUrlSecurity(rawUrl)` langsung menjadi sumber kebenaran tunggal — lalu membersihkan `urlSecurity.ts` sendiri agar mendukung punycode (`URL.hostname`), origin/port strict comparison (`targetHost === currentHost`), serta early return TTL yang benar (`if (!forceRefresh && dynamicSafeDomainsCache.length > 0 && now - lastFetchTime < 30 * 60 * 1000)`) — menyelesaikan kedua masalah secara tuntas.
2. **Aksi Admin di Tablet & Konformitas Mobile Sheet (`SAFE-P1-03` & `SAFE-P1-04`)**:
   - Memindahkan kontrol primer *Tambah Domain*, *Segarkan*, dan *Sinkronkan Default* langsung ke header toolbar terintegrasi di dalam `AdminSafeDomainsManagement.tsx` (selain tetap mendengarkan event `catavor:open-add-domain` dari Portal Desktop/Mobile agar backward-compatible) memastikan admin Desktop, Tablet, dan Mobile memiliki akses penuh ke seluruh fitur CRUD dan `reset-defaults`. Di Mobile, form modal wajib dibungkus `<MobileSheetStack>` dengan `<MobileCustomSelect variant="drilldown">` sehingga tidak memakai `<select>` native maupun nested sheet berlapis.

#### A5.5 Rencana Remediasi Terstruktur (Selesai Dieksekusi)
- **Gelombang 1 — Backend Hardening, Redis SCAN & `safe_domain_handler_test.go`**:
  1. Ekstrak helper `normalizeAndValidateSafeDomain(raw string) (string, error)` ([safe_domain_handler.go](file:///c:/MyProject/DFauna/backend/internal/handlers/safe_domain_handler.go)): strip skema `http(s)://`, `www.`, path/query/fragment, tolak userinfo `@`, wildcard `*`, IPv6, skema berbahaya, spasi/kontrol karakter, serta normalisasi IDN via `golang.org/x/net/idna` (`ToASCII`) agar domain punycode maupun ASCII tervalidasi RFC host yang ketat.
  2. Hormati `req.IsActive *bool` secara atomik via transaksi GORM (`CreateSafeDomain`), tolak domain kosong (`400`) & duplikat (`409 Conflict`) di `UpdateSafeDomain`, blokir penghapusan baris `IsSystem == true` (`403 Forbidden`) di `DeleteSafeDomain`, serta tambahkan `stats` global di respons `GetAdminSafeDomains` + escape wildcard `%`/`_` (`escapeLikePattern`).
  3. Ubah `InvalidateSafeDomainsCache` ([redis.go](file:///c:/MyProject/DFauna/backend/internal/database/redis.go)) agar memakai `SCAN` iteratif (non-blocking), serta tambah suite [safe_domain_handler_test.go](file:///c:/MyProject/DFauna/backend/internal/handlers/safe_domain_handler_test.go).
- **Gelombang 2 — Tri-Frontend URL Security, External Modal & Admin Console + Verifikasi E2E**:
  1. Perbaiki `loadDynamicSafeDomains` (cek TTL 30 menit sebelum short-circuit cache) & strict origin `targetHost === currentHost` + kontrol karakter + userinfo `@` strip pada 3 `urlSecurity.ts`, hapus prefix `https://` paksa di `handleSafeExternalRedirect` ([Desktop App.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/App.tsx), [Mobile App.tsx](file:///c:/MyProject/DFauna/frontend/mobile/src/App.tsx), [TabletStoreCatalog.tsx](file:///c:/MyProject/DFauna/frontend/tablet/src/components/TabletStoreCatalog.tsx)), pasang `<ExternalLinkWarningModal>` pada early return `/admin` (`PlatformRolePortal`) Desktop & Mobile, serta tambahkan `?sub=` pada `handlePopState` ([Mobile PlatformRolePortal.tsx](file:///c:/MyProject/DFauna/frontend/mobile/src/components/PlatformRolePortal.tsx#L2461)).
  2. Reset state `dontRemind` & `copied` saat `url` berubah + amankan `clipboard` pada ketiga [ExternalLinkWarningModal.tsx](file:///c:/MyProject/DFauna/frontend/desktop/src/components/ExternalLinkWarningModal.tsx); lengkapi touch target `>= 44px` & timer cleanup pada Mobile/Tablet.
  3. Selaraskan `AdminSafeDomainsManagement.tsx` di Desktop, Tablet, & Mobile: tombol aksi `+ Tambah Domain`, `Sinkronkan Default`, & `Segarkan` (menyelesaikan blokir Tablet Console), statistik global akurat, modal/bottom-sheet konfirmasi tanpa `window.confirm`, `useModalBackHandler` di Desktop, hapus emoji `U+1F4A1`, dan ganti native `<select>` dengan `<MobileCustomSelect>` di dalam `<MobileSheetStack>` pada Mobile.

#### A5.6 Status Remediasi & Bukti Verifikasi Final (`2026-11-28`)
| Pemeriksaan | Hasil Pengukuran Pasca-Edit Terakhir | Rincian Teramati |
| :--- | :--- | :--- |
| `cd backend; go test -count=1 ./...` | **PASS** (`exit 0`, **13** paket teruji lulus) | Seluruh paket backend lulus (`internal/handlers` `22.473s` mencakup `safe_domain_handler_test.go`, `internal/database` `0.999s` mencakup `TestSafeDomainsCache_RoundTripAndInvalidate`, dst.). |
| **Tri-Build Verification** (`frontend/desktop`, `frontend/tablet`, `frontend/mobile`) | **PASS** (`0` error TypeScript & Vite build) | Desktop `1.21s` (`2009 modules`), Tablet `835ms` (`2020 modules`), Mobile `1.02s` (`2004 modules`). |
| **Runtime HTTP & Playwright Tri-Frontend E2E (`catavor_audit_tmp`, port `8199`)** | **5/5 Checks PASS** (`exit 0`, `0` `window.confirm`, `0` uncaught `pageerror`) | `admin_mfa_login` (Superadmin TOTP MFA); `http_api_hardening` (host invalid/skema `400`, `is_active=false`, punycode `xn--bcher-kva.example`, konflik `409`, blokir hapus sistem `403`, stats global & cache `/api/public/safe-domains`); Desktop `1280x800` (refresh cache TTL >30m, reset checkbox `dontRemind`, modal back-close, hapus kustom non-`window.confirm`); Tablet `768x1024` (header tombol terlihat, tambah & hapus via custom dialog); Mobile `390x844` (bottom sheet 0 emoji & 0 native `<select>`, tambah & hapus via bottom sheet dengan URL tetap di `?sub=domains`). |

---

*(Gunakan format sub-section `### A6`, `### A7`, dst. di bawah garis ini saat melaksanakan audit modul berikutnya secara berurutan.)*
