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

### 1.1 Modul Sudah Diaudit & Terverifikasi (`15` Modul)

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
| 15 (**A2**) | **Registrasi Merchant, OTP, Google SSO & Checkout Paket Awal** | Transaksi atomik `Register` + `GoogleAuth` Case B, `BlacklistedSlug`, OTP UTC + outbox + cooldown lock + no-emoji, `CheckEmail` anti-enumeration `N-17`, rate-limit `CheckSlug`, fallback `gateway_aulaa`, harga paket dinamis `/subscription/plans`, paritas Desktop/Tablet/Mobile + modal back/drag | Audit & Remediasi `2026-11-28` (lihat [Bagian A2](#a2-audit-mendalam-registrasi-merchant-otp-google-sso--checkout-paket-awal-2026-11-28); test baru di `auth_handler_test.go`, `otp_service_test.go`; Playwright + HTTP `6/6` pass) | **AUDITED & VERIFIED** |

---

### 1.2 Modul Sedang Diaudit / Menunggu Remediasi (`0` Modul)

*Tidak ada modul berstatus pending saat ini; seluruh temuan A1 dan A2 telah selesai diperbaiki dan diverifikasi.*

---

### 1.3 Antrean Modul Tersisa Untuk Audit Berikutnya (`6` Modul)

| Urutan | Modul / Fitur Tersisa | Area Kode Utama | Alasan / Indikasi Risiko Awal | Status |
| :--- | :--- | :--- | :--- | :--- |
| **A3** | **Direktori Toko Pengelola & Pengaturan Global Platform** | `store_handler.go` (`AdminListStores`, `AdminGetStoreDetail`), `setting_handler.go`, `AdminStoresManagement.tsx`, `TabletPlatformStoresView.tsx`, `OfficialContactModal.tsx` | Pengelolaan merchant oleh Admin Pengelola (filter, paginasi, suspend/unsuspend, verifikasi/lencana, kuota storage, kontak resmi) belum diaudit lintas peran Pengelola di 3 device. | **NOT YET AUDITED** |
| **A4** | **Pusat Notifikasi In-App & Siklus Hidup SSE** | `notification_handler.go`, `notification_hub.go`, `notification_cleaner.go`, `NotificationHeaderPopover.tsx` | Komponen popover notifikasi khusus hanya terlihat di Desktop; perlu cek paritas UX Tablet/Mobile, isolasi SSE multi-tenant, read/dismiss state, dan cleaner. | **NOT YET AUDITED** |
| **A5** | **Safe Domains & Peringatan Tautan Eksternal** | `safe_domain_handler.go`, `AdminSafeDomainsManagement.tsx`, `ExternalLinkWarningModal.tsx` | Tidak memiliki `safe_domain_handler_test.go`; perlu audit validasi domain (IDN/punycode, subdomain bypass, open redirect) dan konsistensi modal peringatan eksternal di 3 device. | **NOT YET AUDITED** |
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

*(Gunakan format sub-section `### A3`, `### A4`, dst. di bawah garis ini saat melaksanakan audit modul berikutnya secara berurutan.)*
