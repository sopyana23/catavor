# Laporan Implementasi & Verifikasi Tuntas Fase 4 (`N-52` MFA End-to-End & `N-56` Edge WAF)

- **Tanggal:** 2026-11-18
- **Branch & Baseline Awal:** `agent-B` pada `HEAD = aae215a1e97172fa7243905ebdad0a1b8a628eba`
- **Cakupan Tuntas Fase 4:**
  1. **`N-52` Backend Hardening & Pure-Go QR SVG (`internal/security`, `internal/mfa`, `internal/middleware`, `internal/handlers`, `internal/services`, `internal/database`)**
  2. **`N-52` Tri-Frontend Native Parity (`frontend/desktop`, `frontend/tablet`, `frontend/mobile` + artefak produksi `public/`)**
  3. **`N-56` Standarisasi Infrastruktur Edge Reverse Proxy & Cloudflare WAF (`deploy/`)**
- **Rujukan Otoritatif:**
  - `security-audit/mfa-implementation-handoff-2026-11-17.md`
  - `security-audit/implementation-plan-fase-4-baseline-2026-11-17.md`
  - `security-audit/implementation-plan-fase-4-2026-11-16.md`
  - `security-audit/catatan-review-plan-fase4-2026-11-16.md`
- **Batas Otorisasi yang Dipatuhi:**
  - Seluruh pengujian database dilakukan terisolasi pada SQLite in-memory dan PostgreSQL 17 disposable `catavor_mfa_disp_test` yang langsung dihapus setelah uji.
  - **Tidak menyentuh** database lokal `catavor`, **tidak me-restart** daemon port `8000`, **tidak mengubah** secret `.env`, dan **tidak melakukan `git push`**.
  - Perubahan pada `AGENTS.md` dan keempat dokumen audit pra-eksisting dipertahankan secara non-destruktif.

---

## 1. Pemetaan Seluruh Jalur Penerbitan Sesi & Mutasi Staf

Seluruh jalur kode di `backend/` yang menerbitkan JWT/cookie sesi, merotasi sesi, atau mengubah status staf telah diaudit dan disatukan ke satu kebijakan terpusat (`mfa.IsMFAMandatory`, `mfa.RequiresMFA`, `mfa.EvaluateLoginGate`, dan `middleware.MfaPolicyFor`):

| No | Jalur / Endpoint | Berkas & Fungsi | Temuan Baseline (`aae215a`) | Perbaikan yang Diterapkan |
|---|---|---|---|---|
| 1 | `POST /api/login` (`POST /api/auth/login`) | `internal/handlers/auth_handler.go` (`Login`) | Hanya menantang akun dengan `TwoFactorEnabled=true`; staf tanpa MFA langsung mendapat sesi penuh; penyimpanan `UserSession` asinkron (`go RecordUserSession`). | Dipasang `evaluateMFASessionGate` + `mintDurableSession` sinkron. Staf tanpa MFA hanya mendapat `setup_token` terbatas (`aud: catavor-mfa-enrollment`), tanpa `token` sesi, tanpa cookie, dan `0` baris `user_sessions`. |
| 2 | `POST /api/auth/google` (CASE A user lama & CASE B user baru) | `internal/handlers/auth_handler.go` (`GoogleAuth`) | Sama sekali tidak memeriksa MFA; staf maupun merchant ber-MFA langsung memperoleh sesi penuh via SSO Google. | Dipasang pemisahan portal admin/merchant + `evaluateMFASessionGate` + `mintDurableSession`. Verifikator Google dapat di-stub pada tes unit melalui field `googleVerifier`. |
| 3 | `POST /api/auth/register` | `internal/handlers/auth_handler.go` (`Register`) | Akun Google terverifikasi yang belum punya toko tetapi sudah ber-MFA/enforced langsung mendapat sesi penuh saat membuat toko pertama. | Pembuatan sesi diarahkan melalui `evaluateMFASessionGate` + `mintDurableSession`. |
| 4 | `POST /api/auth/forgot-password-reset` | `internal/handlers/auth_handler.go` (`ForgotPasswordReset`) | Setelah verifikasi OTP email, langsung menerbitkan JWT + cookie sesi penuh (bypass faktor kedua) dan tidak mencabut baris `user_sessions` lama secara sinkron. | Mencabut seluruh `user_sessions` lama secara sinkron, menaikkan `token_version`, lalu mengevaluasi `evaluateMFASessionGate` (akun ber-MFA menerima `challenge`, staf belum enroll menerima `setup_token`, tanpa membocorkan sesi penuh). |
| 5 | `POST /api/auth/mfa/verify` | `internal/handlers/mfa_handler.go` (`VerifyChallenge`) + `internal/mfa/service.go` (`RedeemChallenge`) | JTI challenge tidak pernah disimpan ke `mfa_auth_completions` (bisa ditukar ulang paralel/serial dengan backup code berbeda); sesi disimpan asinkron; token diterbitkan dengan `MfaVerified=false`. | Satu transaksi PostgreSQL (`SELECT ... FOR UPDATE` pada `users` + cek `mfa_auth_completions` + kuota gagal JTI + cek `mfa_account_lockouts` + CAS faktor + `CreateUserSessionTx` + `ActivityLog` + insert unik `uq_mfa_bcc_purpose_jti` dengan `payload_enc` AEAD). JWT (`MfaVerified=true`) dan cookie diterbitkan **hanya setelah transaksi commit**. |
| 6 | `GET /api/auth/mfa/status`, `POST /api/auth/mfa/enroll`, `POST /api/auth/mfa/confirm` | `cmd/server/main.go`, `internal/middleware/auth.go` (`AuthOrMFASetupRequired`), `internal/handlers/mfa_handler.go` | `setupJTI` memakai email user (berisiko melampaui `VARCHAR(64)`), tanpa pengikatan kedaluwarsa, tanpa re-auth $\le 10$ menit, dan tanpa pencabutan sesi pra-MFA saat aktivasi. | Rute didaftarkan dengan `AuthOrMFASetupRequired` sebelum grup kosong `AuthRequired`. Wajib re-auth $\le 10$ menit (`AuthAt` atau sandi inline), `NewPendingSetupJTI` (`enr:<uid>:<exp>:<hex>`, $\le 64$ karakter), CAS satu kali pada `ConfirmEnrollment`, membakar `setup_token` di `mfa_auth_completions`, mencabut semua sesi pra-MFA, dan menerbitkan sesi `MfaVerified=true` baru. |
| 7 | `POST /api/auth/mfa/disable` | `internal/handlers/mfa_handler.go` (`Disable`) + `internal/mfa/service.go` (`VerifyStepUpAndMutate`) | Staf dapat menonaktifkan MFA; memanggil `Verify*Factor` dengan `jti=""` (melewati akuntansi lockout); tidak mencabut sesi perangkat lain. | Diblokir keras untuk seluruh staf kanonik & akun `TwoFactorEnforced` (`403 MFA_MANDATORY_FOR_STAFF`). Untuk merchant opt-in: wajib re-auth $\le 10$ menit + faktor kedua aktif via `VerifyStepUpAndMutate` (dengan akuntansi lockout penuh), reset `two_factor_last_totp_step=0`, naikkan `token_version`, dan cabut semua sesi lama. |
| 8 | `POST /api/auth/refresh` & rotasi sliding `AuthRequired` | `internal/handlers/auth_handler.go` (`RefreshToken`), `internal/middleware/auth.go` (`AuthRequired`) | `AuthRequired` memiliki edit terputus yang memanggil `c.Next()` dua kali, fail-open bila baris `user_sessions` hilang/error DB, dan menghapus klaim `MfaVerified` saat rotasi sliding/refresh. | `MfaPolicyFor` murni (tanpa `c.Next()` ganda), `AuthRequired` fail-closed (`503`/`401`) bila DB nil/error atau baris `user_sessions` tidak ada/revoked/expired, serta mempertahankan `MfaVerified` dan `AuthAt` asli melalui `RotateUserSessionTokenStrict` sebelum mengirim token baru. |
| 9 | `PUT /api/profile` (ganti email / kata sandi) | `internal/handlers/auth_handler.go` (`UpdateProfile`) | Mengganti sandi/email tanpa wajib step-up MFA bagi akun ber-MFA, dapat membakar OTP sebelum cek MFA, dan menerbitkan token baru tanpa `MfaVerified`. | Validasi awal `MFA_STEP_UP_REQUIRED` (`428`) sebelum konsumsi OTP sekali pakai; wajib re-auth $\le 10$ menit + faktor kedua aktif (`VerifyStepUpAndMutate`), mencabut seluruh sesi lama, dan menerbitkan sesi durable baru dengan `MfaVerified` terjaga. |
| 10 | `POST /api/user/stores`, `/stores/switch`, `DELETE /stores/:id` | `internal/handlers/store_handler.go` (`rotateStoreContextSession`) | Rotasi token konteks toko menjatuhkan `MfaVerified` menjadi `false` dan tidak merotasi `token_id` secara sinkron di `user_sessions`. | Helper `rotateStoreContextSession` mempertahankan `MfaVerified` & `AuthAt` serta merotasi `UserSession` secara sinkron (`RotateUserSessionTokenStrict`). |
| 11 | `POST /api/notifications/stream-ticket` & `?ticket=` SSE | `internal/security/sse_ticket.go`, `internal/handlers/notification_handler.go`, `internal/middleware/auth.go` | Tiket SSE hanya menyimpan `userID` tanpa status `MfaVerified` dan `TokenVersion`, dan tidak ditolak oleh operasi sensitif MFA/profil. | `IssueSSETicketWithMeta` membawa `MfaVerified` & `TokenVersion`; `AuthRequired` mengevaluasi `MfaPolicyFor` pada tiket SSE dan menandai `c.Locals("sse_ticket_auth", true)` sehingga mutasi MFA/kredensial menolak autentikasi asal tiket stream. |
| 12 | Pembuatan & penugasan role staf RBAC + guard `/api/admin/*` | `internal/services/rbac_service.go`, `internal/middleware/rbac.go`, `cmd/server/main.go` | `CreateStaffUser` & `AssignStaffRole` belum menyetel `TwoFactorEnforced=true` atau mencabut sesi aktif; grup `/api/admin` belum memiliki guard berlapis `RequireMFACompleted`. | `CreateStaffUser` & `AssignStaffRole` menyetel `TwoFactorEnforced=true`, `AssignStaffRole` memanggil `RevokeAllSessionsForUser`, dan grup `adminApi` dipasangi `RequireMFACompleted(cfg)` sebagai *defense-in-depth*. |

---

## 2. Perbaikan Urutan Challenge -> Faktor -> Sesi & Lockout Atomik

1. **Pemisahan Kriptografis Kelas Token:**
   - Sesi penuh: `iss = "catavor-saas"`, `aud = "catavor-web"`.
   - Challenge MFA: `iss = "catavor-saas"`, `aud = "catavor-mfa-challenge"`, `purpose = "mfa_challenge"`, TTL `5m`.
   - Setup onboarding staf: `iss = "catavor-saas"`, `aud = "catavor-mfa-enrollment"`, `purpose = "mfa_setup"`, TTL `10m`.
   - Ketiganya memakai audience yang saling eksklusif sehingga tidak dapat dipertukarkan lintas endpoint.
2. **Transaksi Tunggal Penukaran Challenge (`mfa.RedeemChallenge`):**
   - Mengunci baris `users` dengan `SELECT ... FOR UPDATE`.
   - Memeriksa versi token, status aktif MFA, ketiadaan JTI di `mfa_auth_completions`, kuota gagal per-JTI (`< 3`), dan status `mfa_account_lockouts`.
   - Mengonsumsi faktor (`two_factor_last_totp_step < step` untuk TOTP, atau CAS nilai `two_factor_backup_codes_hash` untuk kode cadangan).
   - Menulis `UserSession` (`services.CreateUserSessionTx`) dan `ActivityLog` di dalam transaksi yang sama.
   - Menyimpan rekaman `mfa_auth_completions` (`UNIQUE(purpose, token_jti)`) dengan `payload_enc` terenkripsi AEAD (`v1:...`) yang hanya berisi metadata non-bearer (tanpa JWT mentah).
   - Apabila terjadi kegagalan DB pada langkah mana pun sebelum commit, seluruh mutasi faktor dan sesi di-*rollback* utuh dan handler mengembalikan `503` tanpa token dan tanpa `Set-Cookie`.
3. **Akuntansi Kegagalan & Lockout Durable (`mfa.recordFailureAtomic`):**
   - Menurunkan `lease_generation > 0` secara deterministik lewat HMAC-SHA256 atas `(factorType, normalizedCode)`.
   - Retry jaringan dengan pasangan `(token_jti, kode salah)` yang identik bersifat idempotent (`ON CONFLICT DO NOTHING`, dihitung 1 kali).
   - Kode salah berbeda pada JTI yang sama dibatasi maksimum `3` kali (`MaxChallengeFailures = 3` -> `MFA_CHALLENGE_EXHAUSTED`), dan akumulasi `5` kode salah dalam jendela `15` menit lintas JTI mana pun mengunci akun selama `15` menit (`429 MFA_LOCKED`).
4. **Sinkronisasi Skema Bootstrap & Uji Migrasi (`internal/database`):**
   - Menambahkan model `MFAAuthCompletion`, `MFAAccountLockout`, `MFAChallengeFailure`, dan `TwoFactorRecoveryTicket` ke daftar `AutoMigrate` di `internal/database/db.go` tanpa mengubah berkas migrasi immutable `20261116_n60_user_two_factor_auth.sql` (checksum tetap utuh).
   - Memperbarui prasyarat tabel inti pada `internal/database/migrator_test.go` agar mencerminkan `AutoMigrate` aktual sebelum eksekusi `RunMigrations` pada PostgreSQL disposable.

---

## 3. Bukti Eksekusi Verifikasi Aktual

Seluruh pengujian dijalankan secara lokal tanpa menyentuh database target `catavor` maupun daemon port `8000`. Tidak ada secret, token, atau kode OTP yang dicetak ke dokumen ini.

### 3.1 Pemeriksaan Statis & Kompilasi Server
- Perintah: `go vet ./...` (di `backend/`) -> **LULUS (`exit code 0`)**.
- Perintah: `go build -o %TEMP%\catavor-server-mfa-check.exe ./cmd/server` (di `backend/`, binary sementara langsung dihapus) -> **LULUS (`exit code 0`)**.
- Pemeriksaan `go test -race`: compiler C (`gcc` / MinGW) tidak terpasang pada host Windows ini (`gcc_not_installed_on_windows_host`), sehingga flag `-race` berbasis CGO tidak dapat dieksekusi di mesin ini. Sebagai gantinya, skenario balapan konkurensi diuji langsung terhadap **PostgreSQL 17 nyata** menggunakan goroutine paralel tersinkronisasi (`sync.WaitGroup` + channel start-gate) di bawah `SELECT ... FOR UPDATE` dan constraint unik DB.

### 3.2 Suite Unit & Regresi Backend Penuh (Tanpa Cache, SQLite In-Memory)
- Perintah: `go test -count=1 ./...` (di `backend/`) -> **LULUS (`exit code 0`)**
  - `catavor-backend/internal/config` — `ok` (`0.455s`)
  - `catavor-backend/internal/database` — `ok` (`0.885s`)
  - `catavor-backend/internal/handlers` — `ok` (`17.094s`)
  - `catavor-backend/internal/logutil` — `ok` (`0.063s`)
  - `catavor-backend/internal/mfa` — `ok` (`0.185s`)
  - `catavor-backend/internal/middleware` — `ok` (`2.237s`)
  - `catavor-backend/internal/models` — `ok` (`1.145s`)
  - `catavor-backend/internal/security` — `ok` (`0.356s`)
  - `catavor-backend/internal/services` — `ok` (`1.555s`)
  - `catavor-backend/internal/storage` — `ok` (`0.405s`)
  - `catavor-backend/internal/utils` — `ok` (`0.036s`)

### 3.3 Suite Migrasi, Transaksi, Rollback, & Konkurensi pada PostgreSQL 17 Disposable
- Database sementara: `catavor_mfa_disp_test` (dibuat dengan `createdb.exe`, diverifikasi dengan safety guard `current_database() != 'catavor'`, dan dihapus bersih dengan `dropdb.exe`; hasil kueri `pg_database` pasca-uji memastikan tidak ada DB uji tersisa).
- Perintah 1 (`CATAVOR_MIGTEST_DSN` aktif): `go test -v -count=1 ./internal/database/...` -> **LULUS (`exit code 0`, `2.536s`)**
  - Membuktikan `TestN60MigrationOnDisposablePostgres` (apply + rerun idempotent `20261116_n60_user_two_factor_auth.sql`), `TestRunMigrationsAppliesAll` (11 berkas migrasi tertanam), `TestRunMigrationsIdempotent`, `TestRunMigrationsDetectsChecksumDrift`, dan `TestRunMigrationsBaselinesExistingSchema`.
- Perintah 2 (`CATAVOR_PGTEST_DSN` aktif): `go test -v -count=1 -run "TestMFAPostgresConcurrencyRollbackAndSingleUse|TestCanonicalStaffRolesMandatoryMFA|TestAllSessionIssuersEnforceSharedMFAPolicy|TestMFAFailClosedOnDisabledFlagMissingConfigAndSchemaFault|TestChallengeReplayDuplicateJTIAndBruteForceLockout|TestSensitiveMutationsReauthStepUpDisableAndSessionRevocation" ./internal/handlers/...` -> **LULUS (`exit code 0`, `14.036s`)**:
  - `TestMFAPostgresConcurrencyRollbackAndSingleUse/parallel_same_challenge_jti_allows_at_most_one_session` (`PASS`, `0.49s`): 8 goroutine paralel menukarkan JTI challenge yang sama dengan 8 backup code sah berbeda -> tepat `1` HTTP `200`, `7` HTTP `401`, `1` baris `user_sessions`, `1` baris `mfa_auth_completions` (`v1:` AEAD tanpa bearer plaintext), dan `9` dari `10` backup code tetap utuh.
  - `TestMFAPostgresConcurrencyRollbackAndSingleUse/parallel_distinct_challenges_same_totp_and_same_backup_code` (`PASS`, `2.65s`): 6 goroutine paralel dengan 6 challenge berbeda memakai step TOTP yang sama -> tepat `1` HTTP `200`; 6 goroutine paralel memakai backup code yang sama -> tepat `1` HTTP `200`.
  - `TestMFAPostgresConcurrencyRollbackAndSingleUse/parallel_confirm_enrollment_race` (`PASS`, `0.42s`): 6 goroutine paralel memanggil `/api/auth/mfa/confirm` -> tepat `1` HTTP `200` dan tepat `1` sesi aktif.
  - `TestMFAPostgresConcurrencyRollbackAndSingleUse/db_session_failure_rolls_back_totp_and_backup_code_consumption` (`PASS`, `0.43s`): injeksi kegagalan `BEFORE INSERT ON user_sessions` di PostgreSQL memicu HTTP `503` tanpa token/cookie, `two_factor_last_totp_step` tetap `0`, jumlah backup code utuh, `0` baris `mfa_auth_completions`; setelah trigger dilepas, retry challenge dan TOTP yang sama berhasil (`200 OK`).
  - `TestMFAPostgresConcurrencyRollbackAndSingleUse/parallel_fresh_jti_bruteforce_locks_account_deterministically` (`PASS`, `1.85s`): 8 percobaan salah paralel pada 8 challenge segar mengunci akun secara deterministik (`429 MFA_LOCKED` bahkan terhadap backup code sah berikutnya).

### 3.4 Generator QR SVG Mandiri, Penyelarasan Tri-Frontend MFA, & Paket Infrastruktur `N-56` (`deploy/`)
- **Generator QR SVG ISO/IEC 18004 Mandiri (`backend/internal/security/qrcode.go` & `qrcode_test.go`):**
  - Mengodekan URI `otpauth://` ke matriks QR Versi 1–12 EC Level M secara murni dengan Go standard library (`0` dependensi baru, `0` pengiriman secret ke API eksternal), dikemas sebagai `qr_svg` dan `qr_data_url` (`data:image/svg+xml;base64,...`) pada `MFAHandler.StartEnrollment`.
- **Tri-Frontend MFA Parity (`Desktop`, `Tablet`, `Mobile`) & Tri-Build Verification:**
  - Memutakhirkan `MFAChallengeView.tsx`, `MFASettingsView.tsx`, dan menambahkan `MFAOnboardingModal.tsx` di ketiga codebase sesuai ergonomi form-factor masing-masing (Centered Modal di Desktop, Medium Touch Panel $\ge 46\text{px}$ di Tablet, Slide-Up Bottom Sheet berfisika pegas Apple-style bebas tombol `'X'` di Mobile, seluruhnya memakai ikon vektor Lucide React dan `useModalBackHandler`).
  - Menyambungkan alur `mfa_required` & `mfa_setup_required` pada Password Login dan Google SSO, sinkronisasi rotasi token pasca-`confirm`/`disable` (mencegah `401 SESSION_REVOKED`), penyembunyian form Disable untuk staf wajib-MFA, re-auth kata sandi saat sesi $> 10$ menit, serta intersep `428 MFA_STEP_UP_REQUIRED` pada pembaruan kata sandi profil.
  - Hasil kompilasi produksi **3/3 LULUS (`exit code 0`)**:
    - `frontend/desktop`: `npm run build` (`tsc -b && vite build`) -> `public/desktop` selesai dalam `2.43s`.
    - `frontend/tablet`: `npm run build` (`tsc -b && vite build`) -> `public/tablet` selesai dalam `1.90s`.
    - `frontend/mobile`: `npm run build` (`tsc -b && vite build`) -> `public/mobile` selesai dalam `2.14s`.
- **Pemindaian Kerentanan Dependensi (`govulncheck` & `npm audit`):**
  - `govulncheck ./...` di `backend/` -> **`0` kerentanan memengaruhi kode (`exit code 0`)**.
  - `npm audit --omit=dev` di `frontend/desktop`, `frontend/tablet`, dan `frontend/mobile` -> **`found 0 vulnerabilities` (`exit code 0`)** pada seluruh dependensi produksi (catatan: `npm audit` penuh termasuk `devDependencies` melaporkan advisory ReDoS build-time `picomatch` pada `vite`).
- **Paket Infrastruktur Edge Reverse Proxy & WAF (`N-56` di `deploy/`):**
  - Dibuat `deploy/nginx.conf`, `deploy/Caddyfile`, `deploy/cloudflare-ips.conf`, `deploy/cloudflare-ips.caddy`, `deploy/update-cloudflare-ips.sh`, `deploy/update-cloudflare-ips.ps1`, dan `deploy/cloudflare-waf-rules.md`.
  - Uji eksekusi `deploy/update-cloudflare-ips.ps1 -ProxyType none`: input resmi 15 IPv4 + 7 IPv6 lulus (`exit 0`), input cacat host-bit non-zero (`173.245.48.1/20`) ditolak (`exit 1`), dan input jumlah subnet kurang dari ambang batas ditolak (`exit 1`).

---

## 4. Matriks Status Temuan & Batas Ketidakpastian

| Area / Item | Status | Bukti / Penjelasan Faktual |
|---|---|---|
| Kebijakan wajib MFA untuk seluruh 5 role staf kanonik (`superadmin`, `support`, `compliance`, `finance`, `content`) & opt-in merchant | `runtime-proven` | Diuji end-to-end di `TestCanonicalStaffRolesMandatoryMFA_UnenrolledOnlyGetsSetupCapability` dan `TestLoginWithoutMFABehaviourUnchanged`. |
| Penyatuan gerbang MFA di seluruh jalur penerbitan sesi (`Login`, `GoogleAuth`, `Register`, `ForgotPasswordReset`, `RefreshToken`, sliding `AuthRequired`, `SwitchStore`/`CreateStore`/`DeleteStore`, tiket SSE, mutasi role RBAC) | `runtime-proven` | Diuji di `TestAllSessionIssuersEnforceSharedMFAPolicy` dan `TestSensitiveMutationsReauthStepUpDisableAndSessionRevocation`. |
| Isolasi `setup_token` (ditolak `401` di rute admin/bisnis/profil/refresh/disable; hangus sekali pakai setelah `confirm`) | `runtime-proven` | Diuji pada seluruh 5 role staf kanonik beserta uji reuse pasca-konfirmasi (`401 MFA_SETUP_TOKEN_USED`). |
| Konsumsi challenge JTI & faktor (`totp` / `backup_code`) sekali pakai secara atomik + sesi durable sebelum cookie/token | `runtime-proven` | Dibuktikan baik secara serial maupun konkurensi paralel 8-worker dan injeksi rollback trigger pada PostgreSQL 17 disposable. |
| Fail-closed saat `MFA_2FA_ENABLED=false` (bagi staf wajib), `MFA_ENCRYPTION_KEY` kosong, DB `nil`, baris `user_sessions` hilang/revoked, atau tabel MFA belum tersedia | `runtime-proven` | Dibuktikan di `TestMFAFailClosedOnDisabledFlagMissingConfigAndSchemaFault` dan `internal/middleware/auth_test.go`. |
| Re-autentikasi segar ($\le 10$ menit), larangan disable MFA bagi staf (`403`), step-up MFA pada perubahan sandi/email, dan pencabutan seluruh sesi lama | `runtime-proven` | Dibuktikan di `TestSensitiveMutationsReauthStepUpDisableAndSessionRevocation`. |
| Validasi migrasi `20261116_n60_user_two_factor_auth.sql` pada PostgreSQL 17 disposable | `runtime-proven` | Lulus `TestN60MigrationOnDisposablePostgres` dan `TestRunMigrationsAppliesAll` pada `catavor_mfa_disp_test`. |
| Generator QR SVG ISO/IEC 18004 mandiri + Tri-Frontend MFA UI (`Desktop`, `Tablet`, `Mobile`) + artefak `public/` | `code-closed` & `build-proven` | Lulus `TestQRCodeAllSupportedVersionsBitPlacementExact`, `TestGenerateQRCodeSVGAndDataURLForOTPAuth`, serta `npm run build` 3/3 (`0` error TS/Vite). |
| Paket konfigurasi referensi & skrip updater `N-56` (`deploy/`) | `code-closed` & `runtime-proven` (mode `none`) | Berkas referensi tersedia lengkap; skrip updater teruji menolak host-bits non-zero dan out-of-bounds CIDR. |
| Eksekusi `go test -race` berbasis CGO | `pending` (lingkungan host) | Host Windows saat ini belum memiliki `gcc`/MinGW sehingga `-race` belum dapat dijalankan di mesin ini; disarankan dijalankan pada runner CI Linux sebelum rilis produksi. |
| Runbook organisasi & mekanisme pemulihan dual-control / break-glass MFA | `pending` (di luar cakupan) | Tidak ada endpoint bypass/recovery mandiri di aplikasi; prosedur operasional dual-control disiapkan terpisah sebelum rollout produksi. |
| Status migrasi `N-60` pada database target `catavor`, kesiapan `MFA_ENCRYPTION_KEY` produksi terpisah dari `JWT_SECRET`, serta penerapan live `N-56` di server produksi | `unknown` / `pending rollout` | Sesuai pilihan pengguna, database lokal `catavor` dan daemon port `8000` dibiarkan tidak tersentuh; penerapan dilakukan saat rilis terjadwal. |

---

## 5. Rekomendasi Pemisahan Commit (Bila Nanti Diminta)

Sesuai arahan, **belum ada commit yang dibuat**. Apabila pengguna menginstruksikan pembuatan commit pada tahap berikutnya, perubahan siap dipisahkan secara bersih menjadi dua commit:

1. `fix(auth): enforce MFA for platform staff`
   - `backend/cmd/server/main.go`
   - `backend/internal/database/db.go`
   - `backend/internal/handlers/auth_handler.go`
   - `backend/internal/handlers/mfa_handler.go`
   - `backend/internal/handlers/notification_handler.go`
   - `backend/internal/handlers/store_handler.go`
   - `backend/internal/mfa/service.go`
   - `backend/internal/middleware/auth.go`
   - `backend/internal/middleware/rbac.go`
   - `backend/internal/security/sse_ticket.go`
   - `backend/internal/services/rbac_service.go`
   - `backend/internal/services/session_service.go`
2. `test(auth): cover MFA session enforcement`
   - `backend/internal/database/migrator_test.go`
   - `backend/internal/handlers/handlers_sqlite_test.go`
   - `backend/internal/handlers/mfa_handler_test.go`
   - `backend/internal/handlers/mfa_postgres_disposable_test.go`
   - `backend/internal/handlers/mfa_session_enforcement_test.go`
   - `backend/internal/mfa/service_test.go`
   - `backend/internal/middleware/auth_test.go`
