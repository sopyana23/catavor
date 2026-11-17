# Implementation Plan — Remediasi Temuan Audit Keamanan Fase 4 (Kepatuhan Enterprise: MFA/TOTP & Standarisasi Infrastruktur Edge WAF)

**Tanggal Penyusunan:** 16 November 2026
**Status Riwayat Dokumen:** 📝 **DRAF REVISI PUTARAN 14 — LOCKOUT DURABLE PG; HASIL PROBE CLONE SKEMA ASLI DICATAT; BELUM DISETUJUI, BELUM ADA KODE**
**Referensi Audit & Kolaborasi:**
- `security-audit/audit-putaran-8-zero-change-2026-11-14.md` (Temuan `N-52` & `N-56`)
- `security-audit/implementation-plan-putaran-8-2026-11-14.md` (Roadmap Induk Fase 4, baris 355–385)
- `security-audit/catatan-review-plan-fase4-2026-11-16.md` (catatan review lintas-putaran + matriks pelacakan lintas-agent; lihat catatan integritas di dalamnya)
- Commit Baseline: `1f75c97` (`feat(security): remediate Fase 3 findings (N-53, N-54, N-55) and audit documentation`)
**Baseline Commit:** `1f75c97`
**Status Eksekusi:** 🔴 **DRAF RENCANA KERJA — BELUM DISETUJUI; tidak ada otorisasi kode (gate approval masih pending)**

> **Fakta audit Putaran 14:** desain challenge/onboarding/completion disatukan; DDL N-60 yang tertanam di plan berhasil diaplikasikan dua kali pada clone PostgreSQL 17 dari DB `catavor` (51 tabel awal), tanpa mengubah DB asli. Ini hanya membuktikan kecocokan DDL/idempotensi pada clone tersebut, bukan migrator, model/handler, fresh/legacy bootstrap, Redis, atau flow MFA. N-60 belum ada sebagai file di checkout; tidak ada implementasi MFA atau persetujuan reviewer.

---

## 1. Ringkasan Eksekutif & Ruang Lingkup Fase 4

Fase 4 merupakan fase pemungkas dari **Roadmap Induk Audit Keamanan Putaran 8**. Fase ini berfokus pada **dua pilar kepatuhan enterprise**:

1. **`N-52` [LOW / Standar Kepatuhan OWASP ASVS v4.0.3 V2.8.4 One Time Verifier & NIST SP 800-63B-4 §3.1.5 Multi-Factor OTP Authenticator] — Multi-Factor Authentication (MFA / 2FA) Berbasis TOTP (RFC 6238)**:
   - **Tujuan Keamanan:** Memberikan perlindungan lapisan kedua (*two-factor authentication*) untuk mencegah pengambilalihan akun akibat pencurian kata sandi (*credential stuffing*, *brute-force*, phishing kata sandi, atau kebocoran data).
   - **Kebijakan & Ruang Lingkup Peran Kanonik (Platform Staff Roles vs Merchant):**
     - **Staf Pengelola Platform Kanonik (`models.IsPlatformStaffRole(user.PlatformRole)`):**
       MFA adalah **WAJIB (MANDATORY)** bagi seluruh role staf platform kanonik (`superadmin`, `support`, `compliance`, `finance`, `content`).
       *Catatan Arsitektur:* Sesuai `backend/internal/models/platform_role.go`, string `'admin'` **bukan role sah** di database Catavor. Bidang otorisasi staf diperiksa melalui `user.PlatformRole` dan `user.IsPlatformStaff()`.
       Jika staf platform yang belum mengaktifkan 2FA melakukan login, sistem mengintersep dengan respon `{requires_2fa_setup: true, setup_token: "..."}`.
       Seluruh grup rute `/api/admin/*` (yang diproteksi oleh `AuthRequired` + `RequireAdmin`) dipasangi guard wajib 2FA: jika `user.TwoFactorEnabled == false`, request langsung ditolak dengan `403 Forbidden` (`code: "MFA_ENROLLMENT_REQUIRED"`), memblokir akses ke konsol manajemen sampai proses setup 2FA selesai.
     - **Merchant & Pemilik Toko (`PlatformRole == 'merchant'` atau kosong):** MFA bersifat **OPSIONAL / SANGAT DIREKOMENDASIKAN (OPT-IN)**. Merchant dapat mengaktifkan dan mengelola 2FA secara mandiri melalui menu Pengaturan Profil / Keamanan Akun toko.
   - **Batasan Normatif Standar:** Mengadopsi spesifikasi **RFC 6238** (TOTP) dan **RFC 4226** (HOTP) yang selaras dengan **OWASP ASVS v4.0.3 Bab 2 V2.8.4 (*One Time Verifier*)** dan **NIST SP 800-63B-4 Seksi 3.1.5 (*Multi-Factor OTP Authenticators*)**. Secara tegas dan objektif diakui bahwa TOTP **tidak memiliki sifat phishing resistance** (berbeda dengan FIDO2/WebAuthn yang mengikat origin domain secara kriptografis). Fitur ini diposisikan sebagai penguatan *defense-in-depth*, dan tidak diklaim secara sepihak sebagai kepatuhan penuh AAL2 tanpa pengesahan audit independen dan penegakan phishing-resistant credentials.
   - **Zero-Dependency Core Engine:** Mengembangkan engine TOTP (RFC 6238) mandiri berbasis Go standard library (`crypto/hmac`, `crypto/sha1`, `encoding/base32`, `crypto/subtle`, `crypto/rand`) serta implementasi RFC 5869 HKDF-SHA256 internal berbasis standard library `crypto/hmac` + `crypto/sha256` yang diverifikasi terhadap official RFC 5869 Test Vectors pada unit test `crypto_test.go`, guna menjamin kompatibilitas penuh lintas toolchain (`go1.23` s.d. `go1.26+`) tanpa menambah dependensi eksternal baru (`govulncheck` 0 affected).
   - **Siklus Challenge & Completion — belum diimplementasi:** PostgreSQL mengotorisasi konsumsi faktor dan menyimpan `pending_redis`; Redis lease/settlement hanyalah projection/cache. Desain saga belum dibuktikan lewat implementasi/fault injection.
     - **Keputusan desain Putaran 14 — lockout akun durable:** `mfa_account_lockouts` PostgreSQL adalah sumber kebenaran. Fixed window 15 menit dimulai pada kegagalan kode faktor pertama; kegagalan kelima dalam window mengunci akun 15 menit. Sukses tidak menghapus counter atau lock aktif; setelah `locked_until` lewat, attempt berikutnya menginisiasi window baru secara atomik. Redis hanya counter per-challenge/lease, bukan account lock.
     - TOTP anti-replay authoritative memakai `two_factor_last_totp_step` monotonic dalam transaksi PostgreSQL; Redis `SET NX` hanya cache. Recovery sesudah PG commit wajib memakai completion terenkripsi dan saga/reconciler; jangan memakai ulang faktor atau menerbitkan bearer plaintext dari payload tak terlindungi.

   - **Onboarding JTI — status saat ini belum memberi durable retry:**
     - `active` → `consumed` di Redis bukan sumber kebenaran tahan kehilangan. DB commit yang mengaktifkan 2FA harus menyimpan binding durable ke `setup_jti`; key/receipt Redis yang hilang tidak boleh memicu sesi/backup codes baru.
     - Jika DB menunjukkan setup committed tetapi Redis receipt hilang, fail closed; jangan klaim backup codes/sesi yang sama dapat dikembalikan hanya dari Redis. User login dengan TOTP untuk regenerate codes; emergency recovery bila faktor hilang. Tidak ada jaminan retry identik.
   - **Migrasi & prasyarat skema (N-60 belum tersedia):**
     - `20261116_n60_user_two_factor_auth.sql` belum ada pada checkout dan tidak boleh dianggap sudah dibuat. Tambahkan field user, `TwoFactorRecoveryTicket`, `mfa_auth_completions`, `mfa_account_lockouts`, dan `mfa_challenge_failures` dengan DDL/model konsisten, FK/unique/status/index dan retention eksplisit.
     - `DB_AUTO_MIGRATE=true`: AutoMigrate skema dasar, lalu N-60. `DB_AUTO_MIGRATE=false`: runner tetap berjalan; wajib validasi prerequisite schema (`users`, `user_sessions`, `activity_logs`) dan fail-fast bila kurang. `SKIP_DB_MIGRATE=true`: tidak ada migrasi/AutoMigrate; layanan MFA harus tetap nonaktif/fail-closed kecuali schema version telah diverifikasi.
     - Legacy DB dengan `users` berisi data tetapi `schema_migrations` kosong dibaseline tanpa menjalankan SQL migration yang ada. N-60 tidak boleh dianggap diterapkan di jalur ini; implementasikan prosedur upgrade/backfill eksplisit atau ubah runner lebih dulu, kemudian uji tanpa menyentuh DB operasional.
     - `activity_logs` adalah model nyata yang dibuat AutoMigrate; N-60 tidak boleh menduplikasi DDL secara ambigu. Mode manual wajib memiliki DDL kompatibel dan validasi schema.
   - **Audit:** `activity_logs` adalah audit aplikasi transaksional (retention berjalan), bukan immutable/tamper-evident terhadap role DB berprivilege. `services.RecordActivity` saat ini menelan insert error; operasi MFA wajib menggunakan insert tx langsung yang error-propagating, uji rollback, dan SIEM/WORM bila tamper-evidence dibutuhkan.

   - **Recovery & break-glass (rencana, belum diimplementasi):**
     - Disediakan model tabel `TwoFactorRecoveryTicket` dengan formal state machine (`REQUESTED` -> `IDENTITY_VERIFIED` -> `COOLING_OFF` -> `READY_FOR_APPROVAL` -> `PENDING_SECOND_APPROVAL` -> `EXECUTED`).
     - **Kebijakan Multi-Admin ($\ge 2$ Superadmin):** Formal 2-phase state machine di Web Portal dengan verifikasi one-time nonce atomik per approver (`approver_1 != approver_2` dan `approver != target_user_id`).
     - **Kebijakan Single-Admin (Break-Glass Host CLI):** Jika hanya ada 1 akun Superadmin di database, pemulihan darurat dieksekusi melalui perintah CLI root server (`./catavor-server admin emergency-reset-mfa --confirm-break-glass`).
     - **Serialisasi terbatas, bukan perlindungan global:** `LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE` hanya melindungi transaksi terhadap writer yang menyentuh tabel; wajib urutan lock tiket→users→target-user, `SET LOCAL lock_timeout`, dan uji concurrent role mutation/deadlock. Semua jalur internal perubahan role harus memakai protokol yang sama; jalur eksternal tetap berada di luar jaminan DB ini.
     - **Audit Trail (acceptance criteria, belum terverifikasi):** recovery wajib insert `ActivityLog` langsung melalui transaksi dan propagate error; `activity_logs` adalah audit aplikasi dengan retention, bukan immutable/tamper-evident terhadap privileged DB/OS. SIEM/WORM diperlukan bila tamper-evidence menjadi requirement.
   - **Penyelarasan Tri-Frontend Parity:**

2. **`N-56` [LOW] — Standarisasi Infrastruktur Edge (Cloudflare / Reverse Proxy & WAF Teruji)**:
   - **Tujuan Keamanan:** Melengkapi repositori dengan artefak infrastruktur produksi resmi di direktori `deploy/` yang dapat divalidasi secara sintaksis dan operasional.
   - **Artefak Deliverables:**
     - `deploy/nginx.conf`: Konfigurasi referensi Nginx reverse proxy yang dapat diuji via `nginx -t`, memuat konfigurasi `set_real_ip_from` dari 15 subnet IPv4 dan 7 subnet IPv6 resmi Cloudflare terkini, origin isolation via header rahasia dan firewall, rate limiting zona `/api/auth/` (10r/m), client body limit (15MB), dan HTTP/1.1 keepalive upstream.
     - `deploy/Caddyfile`: Konfigurasi referensi Caddy reverse proxy modern yang dapat diuji via `caddy validate`, mendukung automatic TLS, trust proxy Cloudflare, dan header sanitization.
     - `deploy/update-cloudflare-ips.sh` & `deploy/update-cloudflare-ips.ps1`: Skrip otomatisasi sinkronisasi subnet Cloudflare dengan **sumber resmi Cloudflare terverifikasi** (`https://www.cloudflare.com/ips-v4` & `ips-v6`), **validasi semantik IP/CIDR, pemeriksaan batas host bit nol, dan deduplikasi** (IPv4 unik $12-20$ dan IPv6 unik $5-10$). Penulisan atomik ke `.tmp` pada filesystem yang sama, test harness konfigurasi proxy yang benar-benar memuat snippet target (`PROXY_TYPE="nginx"|"caddy"|"none"` di mana `none` strictly terisolasi untuk unit test dan dilarang menyentuh path proxy sistem aktif), mekanisme backup otomatis (`.bak`), atomic reload dengan timeout 10 detik, post-swap smoke test, serta safe quarantine state jika reload gagal berulang.
     - `deploy/cloudflare-waf-rules.md`: Panduan aturan Cloudflare Edge WAF dengan pemetaan tier vendor resmi yang faktual dan akurat (Free Managed Ruleset di Free; Custom WAF Rules: Free 5, Pro 20, Business 100, Enterprise 1000+; Cloudflare Managed Ruleset & OWASP Core Ruleset di Pro/Business/Enterprise), arsitektur TLS **Full (Strict)** wajib dengan Cloudflare Origin CA certificate, proteksi origin direct IP via firewall OS/security group, dan panduan HSTS `preload`. Catatan transparansi: daftar CIDR dan aturan WAF dalam dokumen diverifikasi terhadap dokumentasi resmi yang dipublikasikan Cloudflare; verifikasi langsung saat audit dihalangi oleh restriksi alat web/jaringan eksternal.

---

### 1.1 Matriks Ruang Lingkup & Pemetaan Berkas

| Kode Temuan | Severity | Referensi Standar | Lokasi Berkas Target | Rencana Remediasi Komprehensif |
| :--- | :---: | :--- | :--- | :--- |
Bangun engine RFC 6238 TOTP, AES-256-GCM cipher berversi
| **N-56** | 🟡 **LOW** | CIS Benchmark v1.1.0<br>Cloudflare Security Best Practices | `deploy/nginx.conf` *(File Baru)*<br>`deploy/Caddyfile` *(File Baru)*<br>`deploy/update-cloudflare-ips.sh` *(File Baru)*<br>`deploy/update-cloudflare-ips.ps1` *(File Baru)*<br>`deploy/cloudflare-waf-rules.md` *(File Baru)* | Sediakan konfigurasi referensi edge proxy produksi (`deploy/nginx.conf` dan `Caddyfile`) dengan 15 IPv4 dan 7 IPv6 subnet Cloudflare terverifikasi, origin firewall isolation, mode Full (Strict) TLS, skrip otomatisasi update CIDR yang tahan gagal (unduh resmi Cloudflare `ips-v4` & `ips-v6`, validasi semantik IP/CIDR dual-stack, host-bits zero check, deduplikasi, atomic swap pada filesystem yang sama, syntax check target proxy aktual, isolasi mode zero-proxy `none` agar tidak menyentuh path sistem aktif, reload ber-timeout 10s, post-swap smoke test, auto-rollback, safe quarantine state), panduan tier vendor WAF resmi yang faktual, dan panduan validasi sintaks (`nginx -t`, `caddy validate`). |

---

### 1.2 Batasan Ketat & Jaminan Zero-Regression (Guardrails)

1. **Dilarang Menulis Kode Sebelum Plan Disetujui:**
   Dokumen ini dipublikasikan untuk tahap audit arsitektur independen. Tidak ada kode aplikasi atau migrasi yang diubah sebelum ada persetujuan resmi dari Reviewer (`LULUS / APPROVED — SIAP EKSEKUSI KODE`).
2. **Server Daemon Port 8000 Wajib Tetap Berjalan:**
   Daemon backend di port 8000 (`/healthz` uptime stabil >37h) tidak boleh dimatikan atau terganggu selama penyusunan maupun pengujian.
3. **Ketertiban Arsitektur Skema Database (Prinsip Kejujuran Intelektual):**
   Catavor secara tunggal mengandalkan GORM `AutoMigrate` pada mode `DB_AUTO_MIGRATE=true` untuk pembentukan skema dasar 30+ tabel master domain saat inisialisasi awal cluster database baru. Berkas di `backend/internal/database/migrations/*.sql` adalah migrasi SQL bertahap (*incremental migrations*) yang dieksekusi oleh `RunMigrations` di atas skema master tersebut (misalnya migrasi `20261018_n26` yang mereferensikan `stores(id)`).
   Oleh karena itu, skenario deployment produksi untuk cluster baru **mensyaratkan startup perdana dengan `DB_AUTO_MIGRATE=true`** agar skema inti terbentuk sempurna. Mode `DB_AUTO_MIGRATE=false` adalah mode runtime operasional untuk menerapkan migrasi SQL incremental pada database yang skema dasarnya sudah terbentuk.
4. **Zero-Dependency Bloat (Anti-Vulnerability):**
   Engine TOTP, HKDF-SHA256, dan AES-256-GCM cipher **WAJIB** menggunakan Go Standard Library murni (`crypto/hmac`, `crypto/sha256`, `crypto/sha1`, `crypto/aes`, `crypto/cipher`, `crypto/rand`, `encoding/base32`, `crypto/subtle`) dan pustaka internal proyek yang sudah ada (`golang.org/x/crypto/bcrypt`). Dilarang menambahkan dependensi eksternal pihak ketiga baru ke `backend/go.mod` guna mempertahankan `govulncheck` 0 affected.
5. **Mandat Tri-Frontend Parity across Form-Factors:**
   - **Desktop Native:** Modal centered box untuk aktivasi 2FA, QR code lapang, tombol copy key, input 6 digit berurutan, dan tombol cetak/salin backup codes.
   - **Tablet Native:** Medium panel / modal proporsional dengan target sentuh $\ge 44$px.
   - **Mobile Native:** Slide-up bottom sheet ramah jangkauan jempol (*Thumb Zone*), tanpa tombol silang 'X' di header (penutupan via drag handle/backdrop/batal), input angka ramah keypad virtual sentuh.
   - **Anti-Emoji:** Haram menggunakan karakter emoji pada judul modal, status badge, atau tombol aksi di seluruh antarmuka bisnis. Wajib menggunakan ikon vektor profesional Lucide React.
6. **Verifikasi Build Tri-Frontend:**
   Setiap perubahan frontend wajib diverifikasi dengan `npm run build` menggunakan Node 22 via `fnm` pada `desktop`, `tablet`, dan `mobile` dengan 0 error kompilasi.

---

## 2. Spesifikasi Teknis Terperinci per Paket Remediasi

---

### 2.1 [N-52 — LOW] Multi-Factor Authentication (MFA / 2FA) Berbasis TOTP (RFC 6238)

#### A. Analisis Kebutuhan Kepatuhan, Scoping, & Arsitektur Kriptografi:

1. **Pemetaan Standar Normatif & Batasan Phishing Resistance:**
   - **Rujukan Normatif Resmi:** NIST SP 800-63B-4 Seksi 3.1.5 (*Multi-Factor OTP Authenticators*) dan OWASP ASVS v4.0.3 Bab 2 Seksi V2.8.4 (*One Time Verifier*).
   - **Batasan Normatif (Transparansi Objektif):** Berdasarkan NIST SP 800-63B-4 §3.1.5, autentikator berbasis TOTP (OTP yang dimasukkan secara manual oleh pengguna) diklasifikasikan sebagai *Multi-Factor OTP Authenticator*. TOTP **tidak memiliki sifat phishing resistance** (berbeda dengan FIDO2/WebAuthn yang mengikat origin domain secara kriptografis). Fitur ini diposisikan sebagai penguatan *defense-in-depth*, dan tidak diklaim secara sepihak sebagai kepatuhan penuh AAL2 tanpa pengesahan audit independen dan penegakan phishing-resistant credentials.
   - **Kebijakan & Penegakan Berdasarkan Peran Kanonik (Platform Staff vs Merchant):**
     - **Staf Pengelola Platform Kanonik (`models.IsPlatformStaffRole(user.PlatformRole)`):**
       MFA adalah **WAJIB (MANDATORY)** bagi seluruh role staf platform kanonik (`superadmin`, `support`, `compliance`, `finance`, `content`).
       - *Alur Login:* Saat staf platform login kata sandi dan memiliki `user.TwoFactorEnabled == false`, endpoint `POST /api/auth/login` mengembalikan respon khusus:
         `{"success": true, "requires_2fa_setup": true, "setup_token": "<jwt_enrollment_token>", "message": "Seluruh staf pengelola platform wajib mengaktifkan 2FA sebelum dapat mengakses sistem."}`
       - *Guard Rute Admin:* Seluruh rute pada grup `adminApi := api.Group("/admin", middleware.AuthRequired(cfg), middleware.RequireAdmin(cfg))` di `backend/cmd/server/main.go` dipasangi pemeriksaan mandatory 2FA. Jika `user.TwoFactorEnabled == false`, request langsung dihentikan dengan status `403 Forbidden` (`code: "MFA_ENROLLMENT_REQUIRED"`), mencegah staf mengakses konsol manajemen sampai proses setup selesai.
     - **Merchant & Pemilik Toko (`PlatformRole == 'merchant'` atau string kosong):**
       MFA bersifat opsional (*opt-in*). Merchant didorong untuk mengaktifkan 2FA melalui banner pengingat keamanan di dashboard toko.

2. **Parameter Protokol Kriptografi RFC 6238 & RFC 4226:**
   - Algoritma: HMAC-SHA1 (sesuai kompatibilitas universal Google Authenticator, Microsoft Authenticator, 1Password, Bitwarden, dan Apple Keychain).
   - Panjang Secret: 160-bit (20 bytes) cryptographically random bytes yang dihasilkan melalui `crypto/rand.Read`, di-encode ke RFC 4648 Base32 tanpa padding (string 32 karakter).
   - Time Step ($X$): 30 detik.
   - Epoch ($T_0$): 0 (Unix epoch).
   - Digit: 6 digit angka ($000000$ s.d. $999999$).
   - Skew Tolerance: $\pm 1$ step ($T-1$, $T$, dan $T+1$), memberikan jendela validasi total 90 detik untuk mengantisipasi deviasi waktu jam perangkat klien hingga $\pm 30$ detik.

3. **Manajemen Kunci Enkripsi Terisolasi
   - **Isolasi Kunci & Validasi Startup Formal
     Kunci enkripsi TOTP diisolasi secara mutlak dari `JWT_SECRET`. Kunci dibaca dari environment variable terdedikasi:
     `MFA_ENCRYPTION_KEY` (string 64-karakter hex / 32 bytes binary untuk AES-256).
     *Validasi Startup Ketat:*
     1. Validasi format: wajib tepat 64 karakter heksadesimal yang valid (`[0-9a-fA-F]{64}`).
     2. Validasi decoding: wajib berhasil di-decode ke slice `[]byte` tepat 32 bytes (256-bit).
     3. Anti-Trivial Check: menolak kunci yang bernilai all-zeros (`0000...`), all-ones, atau string karakter berulang.
     4. Provisioning Mandat: kunci diwajibkan dibangkitkan dari CSPRNG sistem (`crypto/rand.Read` via `openssl rand -hex 32`) atau disuntikkan dari KMS.
     5. Fail-Closed Mode Produksi: jika `MFA_ENCRYPTION_KEY` tidak dikonfigurasi atau tidak lolos validasi di lingkungan produksi, server **menolak menyala** (*fail-closed*).
     6. Mode Dev/Test: file `.env.example` dan helper unit test menyediakan kunci mock statis terdedikasi, tanpa pernah menyentuh `JWT_SECRET`.
   - **Domain Binding via AES-256-GCM Additional Authenticated Data (AAD):**
     Untuk mencegah serangan transplantasi ciphertext antar-baris database:
     ```go
     aad := []byte(fmt.Sprintf("%s:%d:totp_secret", keyVersion, userID))
     ```
     Jika ciphertext dicoba didekripsi untuk user ID yang berbeda, verifikasi tag otentikasi AES-GCM otomatis gagal.
   - **Format Ciphertext Terversi & Keyring Multi-Version:**
     Format ciphertext:
     `<key_version>:<hex_nonce_12bytes>:<hex_ciphertext_and_tag>`
     Contoh: `v1:e8a3b1...:9f4c2...` atau `v2:a1b2c3...:4d5e6...`.
     - Parser membelah string berdasarkan pembatas `:` menjadi 3 bagian: `keyVersion`, `nonceHex` (24 hex char = 12 bytes), dan `ciphertextAndTagHex` (minimal 32 hex char = minimal 16 bytes tag + ciphertext).
     - Keyring Multi-Version didukung melalui konfigurasi:
       - `MFA_PRIMARY_KEY_VERSION="v2"` (versi yang digunakan untuk enkripsi baru).
       - `MFA_KEY_RING="v1:<hexkey1>,v2:<hexkey2>"` (daftar versi kunci aktif untuk dekripsi).
   - **Prosedur Operasional Rotasi Kunci & Rollback:**
     1. Tambahkan kunci baru `v2` ke `MFA_KEY_RING` dan tetapkan `MFA_PRIMARY_KEY_VERSION="v2"`.
     2. Server baru langsung mengenkripsi data baru dengan `v2`, dan tetap dapat mendekripsi data lama ber-prefix `v1:` tanpa downtime.
     3. Jalankan sub-command batch re-encryption CLI:
        `catavor-server admin rotate-mfa-keys --from v1 --to v2`
        Perintah ini membaca seluruh baris `users WHERE two_factor_secret_enc LIKE 'v1:%'`, mendekripsi dengan `v1`, mengenkripsi ulang dengan `v2` beserta AAD terkait, dan memperbarui basis data secara transaksional per batch.
     4. Rollback dapat dilakukan seketika dengan mengembalikan `MFA_PRIMARY_KEY_VERSION="v1"` selama kunci `v1` masih tersimpan di keyring.
   - **Verifikasi RFC 5869 Test Vectors:** Modul HKDF-SHA256 internal berbasis Go standard library (`crypto/hmac` + `crypto/sha256`) diverifikasi kelulusannya terhadap Test Case 1, 2, dan 3 dari RFC 5869 pada unit test `crypto_test.go`.

4. **Anti-Replay TOTP — PostgreSQL otoritatif, Redis cache saja:**
   - Dalam transaksi yang sama dengan verifikasi faktor, lock baris user (`FOR UPDATE`), verifikasi matched step dan pastikan `step > two_factor_last_totp_step`; update step monotonik sebelum commit. Dua request bersamaan untuk step yang sama hanya satu yang dapat sukses. Redis `SET NX` opsional sebagai cache percepatan, bukan security boundary; Redis restart/eviction tidak mengizinkan replay.

5. **Kode Pemulihan Cadangan (Backup Recovery Codes) via Bcrypt:**
   - **Format & Entropi:** Menghasilkan 8 kode cadangan sekali pakai. Setiap kode terdiri dari 12 karakter alfanumerik yang dibagi ke dalam 3 kelompok 4 karakter (misalnya: `K7P2-9M4X-3W8R`), menggunakan set karakter non-ambigu `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (tanpa `0`, `O`, `1`, `I`). Entropi: $32^{12} \approx 1.15 \times 10^{18}$ kombinasi ($\approx 60$-bit entropi per kode).
   - **Penyimpanan Tahan Offline Attack:**
     Kode cadangan disimpan menggunakan **`bcrypt` (work factor 10)**. Format: JSON array of strings di kolom `two_factor_backup_codes_hash`: `["$2a$10$...", "$2a$10$..."]`.
   - **Konsumsi sekali pakai:** backup-code hashing/consumption tetap PostgreSQL `FOR UPDATE`; sukses harus menjadi faktor dalam transaksi completion PG→Redis di §2.1.D.3. Tidak ada klaim rollback lintas-store atau sukses sesi sebelum CAS kedua; lihat kontrak tunggal tersebut.

6. **Model Pemulihan Darurat Terstruktur (Dual-Admin State Machine vs Single-Admin Break-Glass CLI dengan PostgreSQL Table Lock):**
   - **Model Data Baru (`backend/internal/models/two_factor_recovery.go`):**
     ```go
     type TwoFactorRecoveryTicket struct {
         ID                    uint       `gorm:"primaryKey" json:"id"`
         UserID                uint       `gorm:"not null;index" json:"user_id"`
         State                 string     `gorm:"size:50;not null;index" json:"state"` // REQUESTED, IDENTITY_VERIFIED, COOLING_OFF, READY_FOR_APPROVAL, PENDING_SECOND_APPROVAL, EXECUTED, CANCELLED
         RequestedAt           time.Time  `gorm:"not null" json:"requested_at"`
         VerifiedByStaffID     *uint      `json:"verified_by_staff_id,omitempty"`
         VerifiedAt            *time.Time `json:"verified_at,omitempty"`
         CoolingOffExpiresAt   *time.Time `json:"cooling_off_expires_at,omitempty"`
         CancellationTokenHash string     `gorm:"size:255;not null" json:"-"`
         Approver1StaffID      *uint      `json:"approver_1_staff_id,omitempty"`
         Approver1Nonce        string     `gorm:"size:64" json:"-"`
         Approver1Signature    string     `gorm:"size:255" json:"-"`
         Approver1At           *time.Time `json:"approver_1_at,omitempty"`
         Approver2StaffID      *uint      `json:"approver_2_staff_id,omitempty"`
         Approver2Nonce        string     `gorm:"size:64" json:"-"`
         Approver2Signature    string     `gorm:"size:255" json:"-"`
         Approver2At           *time.Time `json:"approver_2_at,omitempty"`
         ExecutionMethod       string     `gorm:"size:50" json:"execution_method,omitempty"` // "dual_admin_portal" atau "root_cli_break_glass"
         BreakGlassNonce       string     `gorm:"size:64" json:"-"`
         BreakGlassActor       string     `gorm:"size:100" json:"-"`
         ExecutedAt            *time.Time `json:"executed_at,omitempty"`
         CreatedAt             time.Time  `json:"created_at"`
         UpdatedAt             time.Time  `json:"updated_at"`
     }
     ```
   - **Siklus Hidup Transisi Status yang Konsisten:**
     ```
     [REQUESTED]
          │
      (Staf Kepatuhan verifikasi dokumen identitas resmi)
          v
     [IDENTITY_VERIFIED]
          │
      (Seketika menetapkan cooling_off_expires_at = now + 24h & kirim email alert)
          v
     [COOLING_OFF] ──(Batal oleh Pemilik Akun via Token Email)──> [CANCELLED]
          │
      (Waktu sekarang > CoolingOffExpiresAt tanpa pembatalan)
          v
     [READY_FOR_APPROVAL]
          │
      (Kebijakan Eksekusi Berdasarkan Jumlah Admin)
          ├───────────────────────────────────────────────────────┐
          │                                                       │
     (Kasus 1: Multi-Admin >= 2)                         (Kasus 2: Single-Admin == 1)
     Dual-Admin Consensus di Web Portal                  Host Server Root CLI Break-Glass
          │                                                       │
          v (Approver 1 menyetujui, one-time nonce)               v (LOCK TABLE users IN SHARE ROW EXCLUSIVE)
     [PENDING_SECOND_APPROVAL]                               [EXECUTED]
          │
          v (Approver 2 menyetujui, approver_2 != approver_1)
     [EXECUTED]
     ```
   - **Dua Kebijakan Eksekusi Otorisasi Terpisah:**
     1. **Kebijakan Multi-Admin ($\ge 2$ Superadmin aktif di database):**
        - Formal 2-Phase State Machine di Web Portal:
          - **Tahap 1 — First Approval (`POST /api/admin/2fa-recovery/:id/approve`):**
            - Transaksi atomik: `tx := db.Begin()`.
            - `SELECT * FROM two_factor_recovery_tickets WHERE id = ? FOR UPDATE;`
            - Validasi ketat: `state == 'READY_FOR_APPROVAL'`, `cooling_off_expires_at <= now()`.
            - Validasi aktor: `actor.PlatformRole == 'superadmin'`, `actor.ID != ticket.UserID` (anti self-approval).
            - Verifikasi & konsumsi one-time nonce `approver_1_nonce` (32-byte hex) untuk mencegah replay.
            - Update tiket: `approver_1_staff_id = actor.ID`, `approver_1_nonce = nonce`, `approver_1_signature = sig`, `approver_1_at = now()`, `state = 'PENDING_SECOND_APPROVAL'`.
            - Catat audit di `activity_logs`: `action = "security.mfa_recovery_first_approval"`, `category = "security"`, `actor_role = actor.PlatformRole`, `actor_name = actor.Name`, `actor_email = actor.Email`, `description = "Persetujuan tahap 1 pemulihan darurat 2FA disetujui"`.
            - `tx.Commit()`.
          - **Tahap 2 — Final Approval (`POST /api/admin/2fa-recovery/:id/finalize`):**
            - Transaksi atomik: `tx := db.Begin()`.
            - `SELECT * FROM two_factor_recovery_tickets WHERE id = ? FOR UPDATE;`
            - Validasi ketat: `state == 'PENDING_SECOND_APPROVAL'`, `approver_1_staff_id IS NOT NULL`.
Dual-Control wajib
            - Verifikasi & konsumsi one-time nonce `approver_2_nonce`.
            - Update tiket: `approver_2_staff_id = actor.ID`, `approver_2_nonce = nonce`, `approver_2_signature = sig`, `approver_2_at = now()`, `state = 'EXECUTED'`, `execution_method = 'dual_admin_portal'`, `executed_at = now()`.
            - Update user target: `two_factor_enabled = false, two_factor_enforced = false, two_factor_secret_enc = NULL, two_factor_backup_codes_hash = NULL, two_factor_setup_jti = NULL`.
            - Catat audit langsung di database tabel `activity_logs`: `action = "security.mfa_emergency_reset_dual_admin"`, `category = "security"`, `actor_role = actor.PlatformRole`, `actor_name = actor.Name`, `actor_email = actor.Email`, `description = "Persetujuan final pemulihan darurat 2FA dieksekusi via konsol web"`.
            - `tx.Commit()`.
     2. **Kebijakan Single-Admin (Break-Glass Protocol via Host Server CLI):**
        - Jika hanya ada 1 Superadmin di database, persetujuan dual-admin di web portal tidak dapat dipenuhi secara fisik.
        - Eksekusi dialihkan secara eksklusif ke antarmuka terminal server host:
          `./catavor-server admin emergency-reset-mfa --ticket-id <id> --operator-note "<reason>" --confirm-break-glass`
   - **Serialisasi transaksi terbatas (bukan jaminan global; status akun target juga dikunci/validasi):**
          1. Buka transaksi PostgreSQL: `tx := db.Begin()`.
          2. Kunci baris tiket: `SELECT * FROM two_factor_recovery_tickets WHERE id = ? FOR UPDATE;`.
          3. Validasi status: jika state bukan `READY_FOR_APPROVAL` atau masa cooling-off belum berakhir, `tx.Rollback()` dan abort.
           4. **Table Lock untuk Serialisasi Terbatas Perubahan Superadmin (bukan jaminan global):**
              Eksekusi `LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE` dengan `SET LOCAL lock_timeout`. Lock ini menserialisasi penulis yang menyentuh tabel `users` selama transaksi saja; ia tidak menutup penulis role dari jalur eksternal, dan tidak menjamin himpunan superadmin tidak berubah di luar lock. Tetapkan urutan lock (tiket → users → akun target `FOR UPDATE`) untuk menghindari deadlock.
           5. **Kunci akun target dan hitung superadmin di dalam transaksi sesudah lock:**
              `SELECT ... FROM users WHERE id = ? FOR UPDATE;` lalu `SELECT COUNT(*) FROM users WHERE platform_role = 'superadmin' AND is_blacklisted = FALSE;`
              Jika jumlah Superadmin $\ge 2$, CLI **ROLLBACK DAN MENOLAK** (`"Multi-admin deployment terdeteksi. Eksekusi wajib via Dual-Admin Web Console."`).
              Jika jumlah Superadmin $\ne 1$, CLI rollback dan menolak dengan error inkonsistensi. Semua jalur mutasi role platform wajib memakai transaksi/lock kompatibel agar keputusan count konsisten; ini prasyarat implementasi, bukan bukti.
           6. Update status tiket menjadi `EXECUTED`, update data 2FA pengguna target, dan insert audit di transaksi yang sama; periksa error insert (`if err := tx.Create(...).Error; err != nil { tx.Rollback(); return err }`) agar audit gagal membatalkan operasi:
             ```go
             if err := tx.Create(&models.ActivityLog{
                 UserID:      &ticket.UserID,
                 ActorRole:   "system",
                 ActorName:   ticket.BreakGlassActor,
                 ActorEmail:  osUser + "@" + hostname,
                 Action:      "security.mfa_emergency_reset_cli",
                 Category:    "security",
                 EntityType:  "user",
                 EntityID:    &ticket.UserID,
                 EntityTitle: targetUser.Email,
                 Description: fmt.Sprintf("MFA emergency reset via CLI break-glass. Note: %s, Nonce: %s", operatorNote, breakGlassNonce),
                 CreatedAt:   now,
             }).Error; err != nil {
                 tx.Rollback()
                 return fmt.Errorf("audit insert gagal: %w", err)
             }
             ```
          7. **COMMIT TRANSAKSI DATABASE.**
          8. **Audit Trail Faktual & Batasan Transparansi:**
             - **Primary Transactional Audit Record:** `activity_logs` mengikuti transaksi dan retention (cleaner saat ini 90/365 hari), bukan permanen. Helper `services.RecordActivity` menelan error insert dengan warning; jangan gunakan untuk operasi yang wajib atomic dengan audit. Gunakan `tx.Create(&models.ActivityLog{...})` dan periksa error, lalu uji rollback.
             - **Auxiliary Local Operational Log:** Menulis log terstruktur ke berkas lokal `logs/mfa-break-glass.jsonl` dengan permission file `0600` (hanya dapat dibaca/ditulis oleh OS service owner / root), memuat timestamp, PID, OS user, hostname, operator note, dan ticket ID.
             - **Catatan Transparansi Standar Keamanan:** Diakui secara terbuka bahwa izin berkas OS `0600` pada disk lokal bukan merupakan jaminan matematis "tamper-evident" atau "immutable append-only" terhadap aktor yang memiliki akses root fisik/OS. Immutabilitas audit tingkat enterprise sesungguhnya mensyaratkan integrasi log forwarding ke external SIEM/WORM storage (seperti AWS CloudWatch dengan Object Lock atau remote central syslog).

---

#### B. Spesifikasi Skema Database & Migrasi SQL Idempotent:

1. **Berkas Migrasi SQL (`backend/internal/database/migrations/20261116_n60_user_two_factor_auth.sql`):**
   > **Kontrak rollout N-60.** Fresh DB didukung hanya dengan `DB_AUTO_MIGRATE=true` (bootstrap model inti, lalu SQL N-60). `DB_AUTO_MIGRATE=false` hanya untuk schema yang sudah bootstrap dan migration ledger tracked; jangan klaim fresh DB didukung karena runner memerlukan tabel prerequisite dan migrasi awal. `SKIP_DB_MIGRATE=true` melewati semuanya dan wajib menonaktifkan/fail-closed MFA lewat pemeriksaan versi/schema. Legacy DB berisi data dengan `schema_migrations` kosong akan dibaseline dan N-60 tidak jalan: rollout legacy harus memakai prosedur operator terpisah yang memeriksa backup/schema, menerapkan DDL ekuivalen N-60 satu kali, memvalidasi semua tabel/kolom termasuk `users`, `user_sessions`, `activity_logs`, lalu merekam/menetapkan versi secara eksplisit sesuai tooling migrator; jangan mengubah migration terdahulu atau menganggap baseline sebagai upgrade. DDL N-60 jangan membuat/menyalin `activity_logs`; gunakan model nyata dan fail-fast bila tabel/kolom wajib tidak tersedia. Uji semua path di PostgreSQL disposable sebelum menyatakan didukung.
   ```sql
   -- 20261116_n60_user_two_factor_auth.sql
   -- Migrasi Idempotent N-60: Dukungan Multi-Factor Authentication (MFA / 2FA) & Recovery Tickets
   -- Sesuai konvensi README migrations Catavor (melanjutkan sequence n59)

   ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enforced BOOLEAN NOT NULL DEFAULT FALSE;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret_enc TEXT;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_backup_codes_hash TEXT;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enrolled_at TIMESTAMP WITH TIME ZONE;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_setup_jti VARCHAR(64);
   ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_last_totp_step BIGINT NOT NULL DEFAULT 0;

   -- 2. Indeks Parsial Pendukung Kueri Status 2FA
   CREATE INDEX IF NOT EXISTS idx_users_two_factor_enabled ON users(two_factor_enabled) WHERE two_factor_enabled = TRUE;
   CREATE INDEX IF NOT EXISTS idx_users_two_factor_enforced ON users(two_factor_enforced) WHERE two_factor_enforced = TRUE;
   CREATE INDEX IF NOT EXISTS idx_users_platform_role_2fa ON users(platform_role, two_factor_enabled);
   CREATE INDEX IF NOT EXISTS idx_users_two_factor_setup_jti ON users(two_factor_setup_jti) WHERE two_factor_setup_jti IS NOT NULL;

   -- 3. Tabel Siklus Hidup Pemulihan Darurat 2FA
   CREATE TABLE IF NOT EXISTS two_factor_recovery_tickets (
       id                      BIGSERIAL PRIMARY KEY,
       user_id                 BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       state                   VARCHAR(50) NOT NULL DEFAULT 'REQUESTED',
       requested_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
       verified_by_staff_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
       verified_at             TIMESTAMP WITH TIME ZONE,
       cooling_off_expires_at  TIMESTAMP WITH TIME ZONE,
       cancellation_token_hash VARCHAR(255) NOT NULL,
       approver_1_staff_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
       approver_1_nonce        VARCHAR(64),
       approver_1_signature    VARCHAR(255),
       approver_1_at          TIMESTAMP WITH TIME ZONE,
       approver_2_staff_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
       approver_2_nonce        VARCHAR(64),
       approver_2_signature    VARCHAR(255),
       approver_2_at          TIMESTAMP WITH TIME ZONE,
       execution_method        VARCHAR(50),
       break_glass_nonce       VARCHAR(64),
       break_glass_actor       VARCHAR(100),
       executed_at             TIMESTAMP WITH TIME ZONE,
       created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
       updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );

   CREATE INDEX IF NOT EXISTS idx_2fa_recovery_user_state ON two_factor_recovery_tickets(user_id, state);

   -- 4. Durable MFA completion untuk TOTP dan backup-code (PG adalah sumber kebenaran)
   CREATE TABLE IF NOT EXISTS mfa_auth_completions (
       id                 BIGSERIAL PRIMARY KEY,
       purpose            VARCHAR(50) NOT NULL,
       token_jti          VARCHAR(64) NOT NULL,
       user_id            BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       factor_type        VARCHAR(20) NOT NULL CHECK (factor_type IN ('totp','backup_code')),
       consumed_hash_ref  VARCHAR(64),
       session_id         BIGINT NOT NULL REFERENCES user_sessions(id),
       payload_enc        TEXT NOT NULL,
       status             VARCHAR(20) NOT NULL DEFAULT 'pending_redis' CHECK (status IN ('pending_redis','redis_committed','manual_recovery')),
       redis_committed_at TIMESTAMP WITH TIME ZONE,
       created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
       expires_at         TIMESTAMP WITH TIME ZONE NOT NULL
   );
   -- Unique key (purpose, token_jti) mengunci satu completion; payload bearer/session dienkripsi dengan key terkelola dan retensi terbatas.
   CREATE UNIQUE INDEX IF NOT EXISTS uq_mfa_bcc_purpose_jti ON mfa_auth_completions(purpose, token_jti);
   CREATE INDEX IF NOT EXISTS idx_mfa_bcc_status ON mfa_auth_completions(status) WHERE status <> 'redis_committed';
   CREATE INDEX IF NOT EXISTS idx_mfa_bcc_user ON mfa_auth_completions(user_id);

   -- Durable account lockout: survives Redis restart/eviction.
   CREATE TABLE IF NOT EXISTS mfa_account_lockouts (
       user_id           BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
       failed_attempts   INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
       window_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
       locked_until      TIMESTAMP WITH TIME ZONE,
       updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
   );

   -- Idempotent durable accounting of an incorrect factor before Redis challenge settlement.
   -- Unique (token_jti, lease_generation) prevents a retry after ambiguous Redis timeout from double-counting.
   CREATE TABLE IF NOT EXISTS mfa_challenge_failures (
       token_jti       VARCHAR(64) NOT NULL,
       lease_generation BIGINT NOT NULL CHECK (lease_generation > 0),
       user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (token_jti, lease_generation)
   );
   CREATE INDEX IF NOT EXISTS idx_mfa_challenge_failures_created_at ON mfa_challenge_failures(created_at);
   ```

2. **Pembaruan Model Go (`backend/internal/models/user.go`):**
   ```go
   type User struct {
       // ... kolom eksisting tetap utuh ...
       TwoFactorEnabled         bool       `gorm:"default:false;index" json:"two_factor_enabled"`
       TwoFactorEnforced        bool       `gorm:"default:false;index" json:"two_factor_enforced"`
       TwoFactorSecretEnc       *string    `gorm:"type:text" json:"-"`
       TwoFactorBackupCodesHash *string    `gorm:"type:text" json:"-"`
       TwoFactorEnrolledAt      *time.Time `json:"two_factor_enrolled_at,omitempty"`
       TwoFactorSetupJTI        *string    `gorm:"size:64;index" json:"-"`
   }
   ```

---

#### C. Detail Spesifikasi Kriptografi Internal (Zero-Dependency Engine):

1. **`backend/internal/security/crypto.go` (Enkripsi AES-256-GCM & HKDF RFC 5869):**
   - **RFC 5869 HKDF-SHA256 (Go Stdlib Murni):**
     - `Extract(salt []byte, ikm []byte) []byte` (menggunakan `crypto/hmac` + `crypto/sha256`).
     - `Expand(prk []byte, info []byte, length int) []byte`
     - `DeriveKey(masterKey []byte, salt []byte, info []byte, keyLen int) []byte`
     - Diverifikasi terhadap Test Case 1, 2, dan 3 dari RFC 5869 pada unit test `crypto_test.go`.
   - **Enkripsi AES-256-GCM Terversi dengan Domain Binding (AAD):**
     - `EncryptTOTPSecret(secret string, keyVersion string, key []byte, userID uint) (string, error)`:
       Membangkitkan nonce 12-byte acak via `crypto/rand.Read`, menetapkan AAD `fmt.Sprintf("%s:%d:totp_secret", keyVersion, userID)`, mengenkripsi secret, dan mengembalikan format:
       `fmt.Sprintf("%s:%x:%x", keyVersion, nonce, ciphertextWithTag)`.
     - `DecryptTOTPSecret(payload string, keys map[string][]byte, userID uint) (string, error)`:
       Membedah payload berdasarkan `:`, mengambil kunci versi terkait, menetapkan AAD verifikasi, memvalidasi tag otentikasi, dan mendekripsi. Mengembalikan error jika tag gagal (tamper-detected) atau user ID mismatch.

2. **`backend/internal/security/totp.go` (RFC 6238 & RFC 4226 Engine):**
   - `GenerateTOTPSecret() (string, error)`: Membangkitkan 20 bytes kriptografis acak (`crypto/rand.Read`), menghasilkan 32 karakter RFC 4648 Base32 tanpa padding.
   - `BuildTOTPAuthURL(issuer, accountName, secret string) string`: Menghasilkan URI standar `otpauth://totp/...`.
   - `CalculateTOTPCode(secret string, timestamp int64) (string, error)`: Menghitung counter $T = timestamp / 30$, HMAC-SHA1, dynamic truncation, dan memformat 6 digit dengan padding nol (`%06d`).
   - `ValidateTOTPCode(secret string, userInputCode string, t time.Time) (bool, int64)`: Memeriksa kode terhadap counter step $T-1$, $T$, dan $T+1$ menggunakan `crypto/subtle.ConstantTimeCompare`.
   - `GenerateBackupCodes(count int) (rawCodes []string, hashedCodes []string, err error)`: Menghasilkan 8 kode alfanumerik 12 karakter non-ambigu dan hash bcrypt (work factor 10).

3. **`backend/internal/security/qrcode.go` (Generator SVG QR Code Mandiri):**
   - Menghasilkan matriks QR Code langsung ke string `<svg ...>` berbasis ISO/IEC 18004 tanpa modul eksternal.

---

#### D. Spesifikasi Isolasi Token, Matriks Alur Login & Atomic Challenge Lease Fencing:

1. **Matriks Kondisi Login Lengkap & Rinci (`POST /api/auth/login`):**

   | Kondisi Pengguna | Status 2FA | Respons HTTP `POST /api/auth/login` | Efek Sesi & Kuki | Akses Route Sesi & Admin |
   | :--- | :---: | :--- | :--- | :--- |
   | **Staf Platform Kanonik** | `TwoFactorEnabled == true` | HTTP 200: `{success: true, requires_2fa: true, challenge_token: "..."}` (Masa berlaku 5m, `aud: catavor-mfa-challenge`, JTI di Redis; account lock PostgreSQL checked before issuance). | **TIDAK ADA** cookie sesi atau JWT sesi yang dibuat. | Seluruh rute terproteksi menolak challenge token (`401 Unauthorized`). |
   | **Staf Platform Kanonik** | `TwoFactorEnabled == false` | HTTP 200: `{success: true, requires_2fa_setup: true, setup_token: "...", message: "Wajib onboarding 2FA"}` (Masa berlaku 15m, `aud: catavor-mfa-enrollment`, JTI single-use; PostgreSQL remains durable authority and Redis is transient state). | **TIDAK ADA** cookie sesi atau JWT sesi yang dibuat. | Rute `/api/admin/*` menolak dengan `403 MFA_ENROLLMENT_REQUIRED`. Rute sesi umum menolak dengan `401`. Hanya boleh akses `/api/auth/2fa/onboarding/*`. |
   | **Merchant / Toko** | `TwoFactorEnabled == true` | HTTP 200: `{success: true, requires_2fa: true, challenge_token: "..."}` (Masa berlaku 5m, `aud: catavor-mfa-challenge`, JTI di Redis; account lock PostgreSQL checked before issuance). | **TIDAK ADA** cookie sesi atau JWT sesi yang dibuat. | Seluruh rute terproteksi menolak challenge token (`401 Unauthorized`). |
   | **Merchant / Toko** | `TwoFactorEnabled == false` | HTTP 200: `{success: true, token: "...", user: {...}}` | Sesi penuh dibuat: cookie HttpOnly `catavor_session` dipasang, session token & fingerprint terdaftar. | Akses penuh sesuai hak akses toko normal. |

2. **Pemisahan Tegas Validator Sesi vs Validator Onboarding (`middleware/auth.go`):**
   - **`AuthRequired` (Sesi Penuh):** Dipin secara ketat hanya pada `jwt.WithAudience("catavor-web")`. `AuthRequired` **TIDAK PERNAH** menerima token challenge maupun token onboarding. Setiap token selain `"catavor-web"` otomatis ditolak 401.
   - **`MFAEnrollmentAuth` (Validator Onboarding Mandiri dengan Fresh DB Check & JTI State Lifecycle):**
     Middleware terdedikasi di `middleware/auth.go` yang dipin ke `jwt.WithAudience("catavor-mfa-enrollment")` dan memvalidasi `claims.Purpose == "mfa_enrollment"`.
     *Siklus Hidup Status Setup JTI & Fresh DB Check:*
     1. `MFAEnrollmentAuth` memvalidasi audience/purpose token dan status akun dari DB, lalu memeriksa state Redis bila tersedia.
      2. JTI enrollment hanya dapat dipakai satu kali: reserve/consume atomik di Redis sebelum transaksi. `consumed` tidak membuka jalur re-mint; token terpakai ditolak dan pengguna diarahkan ke login TOTP.
     3. Jika DB menunjukkan `two_factor_setup_jti` sudah committed tetapi Redis key/receipt hilang atau Redis tidak tersedia: **fail closed**. Jangan buat session, backup code, atau completion baru. Kembalikan error service/recovery yang jelas.
      4. Redis hanya cache/anti-replay aid. Response awal (8 backup codes) tidak disimpan untuk diputar ulang; kehilangannya ditangani dengan regenerate ber-step-up atau emergency recovery. Tidak ada klaim retry yang mengembalikan response identik.

3. **State machine verifikasi challenge dan completion durable PostgreSQL→Redis (kontrak tunggal):**
   - Redis keys hanya untuk challenge/lease/settlement: `sec:mfa_ch:<jti>` (TTL absolut ≤300s), `sec:mfa_ch_fail:<jti>` (maks 3, TTL ≤ challenge), `sec:mfa_ch_lease:<jti>` (owner acak 32-byte + fencing generation, TTL 10s), `sec:mfa_settled:<completion_id>` (marker idempoten), `sec:totp_used:<user_id>:<step>` (cache saja; PG `two_factor_last_totp_step` otoritatif). Account lockout **bukan Redis state**: `mfa_account_lockouts` di PostgreSQL adalah sumber kebenaran; cek sebelum reserve Redis dan ulangi di transaksi PG sebelum faktor diterima.
   - `challenge_verify_begin.lua` atomik untuk state challenge saja: expiry/JTI, exhaustion, serta lease reservation. Account lock dicek dari PostgreSQL sebelum skrip ini, dan dicek ulang saat transaksi verifikasi PG; pembuatan challenge/login juga menolak akun yang masih locked. Rate-limit transport/IP terpisah tidak menaikkan counter faktor akun. Kode faktor tidak dibaca sebelum reservation berhasil. Challenge tetap aktif setelah kegagalan faktor 1–2; kegagalan ke-3 menghanguskan JTI. Bila lease habis, worker lama tidak boleh finalize; request baru boleh mengambil generation baru. Semua finalizer membandingkan owner+generation.
   - **Jalur sukses (TOTP maupun backup code):** validasi faktor di bawah lease. Dalam satu transaksi PostgreSQL kunci user (`FOR UPDATE`), cek status/blacklist, verifikasi faktor; untuk TOTP wajib `step > two_factor_last_totp_step` dan update kolom step pada transaksi yang sama; untuk backup code hapus satu hash compare-and-set dari himpunan hash aktif dalam transaksi yang sama. Simpan `ActivityLog`, insert session row tidak aktif (`is_revoked = TRUE`, seluruh kolom NOT NULL terisi), dan satu `mfa_auth_completions` unik `(purpose, token_jti)` dengan `factor_type`, `session_id`, payload sesi terenkripsi berversi, `pending_redis`, `created_at`, `expires_at`. Commit PG adalah titik durable konsumsi faktor; Redis tidak dapat me-rollback-nya.
   - Setelah commit, `challenge_verify_finalize.lua` idempoten berdasarkan completion ID: memvalidasi lease/generation bila lease masih berlaku, menulis settlement marker Redis berisi completion ID, membersihkan lease/counter secara aman, lalu mengembalikan `ALREADY_FINALIZED` untuk ID sama. Marker 60 detik tidak cukup; TTL harus sekurangnya sepanjang retention pending completion. Jika Redis kehilangan marker/volatile state, reconciler hanya boleh membangunnya ulang dari row `pending_redis` tervalidasi di PG; uniqueness completion dan step TOTP/hash backup di PG mencegah reuse faktor.
   - Setelah settlement marker berisi completion ID terbukti, transaksi PostgreSQL kedua CAS completion `pending_redis` → `redis_committed` dan session `is_revoked = TRUE` → `FALSE`. Hanya setelah commit kedua cookie/session response diterbitkan. Jika response hilang atau CAS gagal, retry/reconciler membaca completion pending, memastikan marker idempoten (bangun ulang jika hilang), lalu CAS tanpa mengevaluasi faktor lagi. Redis gagal/ambigu atau lease habis sesudah commit pertama → jawab 503/408, tanpa response; completion tetap pending. Payload terenkripsi wajib mencakup versi kunci, nonce AEAD, ciphertext/metadata session yang dibatasi, audience/purpose/JTI/user/session binding sebagai AAD, dan expiry; plaintext bearer tidak boleh tersimpan/logged. Reconciler wajib polling bounded-backoff, max age, metrik/alert, lalu jalur operator `manual_recovery` yang mengunci completion/session, mencabut sesi pending, dan menghapus payload terenkripsi sesuai retensi. Retry client harus mengikat completion ID; setelah cookie hilang, pemulihan tidak boleh melewati autentikasi baru kecuali rancangan aman dan ber-approval menyatakan sebaliknya. Jangan terbitkan sesi untuk state expired/ambigu.
   - **Faktor salah / lockout durable:** setelah faktor TOTP/backup code salah, transaksi PG mengunci user→`mfa_account_lockouts`, lalu insert event idempotent `(token_jti, lease_generation)` ke `mfa_challenge_failures`; hanya event baru menambah counter. Window tetap 15 menit dimulai pada kegagalan pertama; kegagalan kelima menetapkan `locked_until=now()+15m`. Sukses tidak menghapus counter atau lock aktif; setelah lock berakhir, counter/window reset atomik. Commit PG mendahului Lua challenge settlement. Redis timeout setelah commit: retry generation yang sama membaca event tersimpan tanpa double-count lalu menyelesaikan Lua; PG failure: challenge Redis tidak bertambah. Lua menambah counter per-challenge sekali untuk event itu, melepas lease, dan menghanguskan JTI pada percobaan challenge ke-3. Lock PG aktif → 429 login/verify; salah kode ke-1–4 → 401/sisa challenge. Retensi event sekurangnya TTL challenge + batas reconciliation; uji ambiguity/retry, cross-JTI, concurrency, N/N+1 dan crash.
   - Persyaratan runtime: minimum Redis yang didukung adalah 6.2+ (meski kontrak tidak menggunakan `GETDEL`); startup/health readiness harus menolak versi lebih rendah. Redis tidak tersedia berarti operasi MFA fail-closed; dilarang fallback in-memory.

4. **Fail-Closed saat Redis Unavailable:**
   - Jika Redis mengalami timeout, error koneksi, atau down pada operasi 2FA:
   - Sistem **WAJIB FAIL-CLOSED**: segera mengembalikan HTTP `503 Service Unavailable` (`code: "AUTH_SERVICE_UNAVAILABLE"`). Dilarang keras fallback in-memory di lingkungan produksi.

---

#### E. Endpoint Manajemen 2FA di Pengaturan Profil & Transisi Onboarding & Recovery Fail-Closed:

- **Onboarding staf: transaction/recovery contract (tanpa klaim retry yang tak teruji):**
  1. Enrollment token 15m hanya untuk onboarding; validasi signature/audience/purpose, JTI, fresh role/blacklist, secret pending, dan kode TOTP. `AuthRequired` tetap hanya menerima `catavor-web`.
  2. Dalam satu transaksi PostgreSQL kunci user, pastikan belum aktif dan role masih staf, aktifkan MFA, simpan binding JTI dan hash backup codes, insert session row belum aktif (`is_revoked = TRUE`, semua kolom NOT NULL terisi), serta `ActivityLog`; periksa semua error dan commit. Jangan simpan plaintext backup codes.
  3. Prasyarat session middleware: sebelum implementasi, ubah `AuthRequired` agar lookup membedakan row-found dari not-found dan fail-closed pada row hilang, query error, atau DB tidak tersedia. Source (`backend/internal/middleware/auth.go:322-344`) hanya menolak bila `Scan` sukses dan `is_revoked` true; belum memeriksa `RowsAffected`/error sebagai penolakan. Session row dari langkah 2 tetap revoked sampai transaksi kedua CAS setelah Redis settlement; cookie baru terbit setelah commit. Rollout harus menyatakan token lama tanpa session row ditolak dan perlu login ulang.
  4. Receipt Redis 15m bukan recovery durable. Jika response awal hilang, jangan re-mint sesi atau backup codes dari binding saja. Recovery normal: login TOTP, lalu regenerate backup codes dengan step-up (mengganti seluruh hash lama dan mencatat audit); jika faktor tak tersedia, gunakan state machine emergency recovery yang berotorisasi. Nyatakan batas ini pada UI dan jangan menjanjikan response identik/retry penuh.
  5. Uji crash DB commit/Redis finalize/session insert/response loss serta privilege dicabut. Session persistence dan finalization idempotency keys wajib diuji sebelum menyebut flow selesai.

2. **Jalur Merchant di Pengaturan Profil (Opt-In):**
   - **Kredensial Akses:** Merchant sudah berada dalam sesi aktif yang valid (`AuthRequired`).
   - **`POST /api/auth/2fa/setup` (Step-Up Re-Authentication Wajib):**
     - Payload: `{"password": "<current-password>"}`.
     - Memvalidasi kata sandi saat ini via `bcrypt.CompareHashAndPassword`.
     - Jika valid, simpan secret pending di Redis (TTL 10m) dan kirimkan Base32 secret + SVG QR code.
   - **`POST /api/auth/2fa/enable`:**
     - Payload: `{"code": "<6-digit-code>"}`.
     - Memverifikasi kode terhadap secret pending yang aman dan berumur pendek; cek akun masih tidak terkunci dan lakukan verifikasi TOTP di transaksi PostgreSQL dengan row lock/anti-replay.
     - Jika valid: dalam satu transaksi PG aktifkan 2FA, simpan hash backup codes, setup binding, session pending revoked, dan ActivityLog error-propagating; ikuti settlement/cookie contract di §2.1.D.3. Email keamanan/backup codes dikirim setelah commit yang diperlukan; jangan mengembalikan plaintext codes lagi pada retry/receipt hilang.
   - **`POST /api/auth/2fa/disable` (Step-Up Ganda Wajib):**
     - Payload: `{"password": "<current-password>", "code": "<6-digit-code>"}`.
     - Jika `user.IsPlatformStaff()`: **DITOLAK KERAS** (`403 MFA_CANNOT_BE_DISABLED_FOR_ADMIN`).
     - Untuk Merchant: Wajib memverifikasi kata sandi DAN kode TOTP aktif (atau backup code).
     - Jika valid: dalam transaksi PG verifikasi faktor TOTP monotonic/backup-code consumption, nonaktifkan MFA, cabut/rotasi sesi sesuai kebijakan, dan tulis ActivityLog error-propagating; response/email hanya setelah commit. Failure Redis tidak boleh membuat hasil ambigu atau mengeluarkan sesi.
   - **`POST /api/auth/2fa/regenerate-backup-codes` (Step-Up Ganda Wajib):**
     - Step-up memakai password dan faktor valid; konsumsi anti-replay/backup-code serta penyimpanan hash dan ActivityLog wajib transaksional PostgreSQL. Kembalikan plaintext hanya sekali pada response setelah commit dan jangan simpan untuk retry.
     - Payload: `{"password": "<current-password>", "code": "<6-digit-code>"}`.
     - Wajib memverifikasi kata sandi DAN faktor kedua aktif.
     - Jika valid: dalam satu transaksi PG konsumsi faktor, simpan hanya hash bcrypt backup codes baru, dan tulis ActivityLog; kembalikan plaintext satu kali setelah commit dan kirim email peringatan. Tidak ada retry yang dapat membaca ulang plaintext.

---

#### F. Penyelarasan Frontend Tri-Device (Ergonomi Form-Factor Native):

1. **Alur Login Klien (`desktop/src/App.tsx`, `tablet/src/App.tsx`, `mobile/src/App.tsx`):**
   - Jika respons login `requires_2fa === true`:
     - Simpan `challenge_token` di memory state sementara (bukan localStorage).
     - Transisi ke Step 2: Form Input 6 digit angka otomatis fokus (`inputmode="numeric"`).
     - Opsi alternatif: input backup code 12 karakter alfanumerik.
     - Tampilkan sisa percobaan jika menerima respons 401: *"Kode salah. Sisa percobaan: X"*.
   - Jika respons login `requires_2fa_setup === true`:
     - Tampilkan modal/layar penegakan wajib onboarding staf platform.
     - Buka alur onboarding terpandu (QR code -> input kode verifikasi -> simpan backup code -> redirect hanya setelah sesi aktif terverifikasi).

2. **Alur Manajemen Pengaturan Profil Akun:**
   - **Desktop (`frontend/desktop/src/App.tsx`):** Centered modal box, tombol copy key, input 6 digit berurutan, modal serah-terima backup codes (`Salin Semua`, `Unduh .txt`).
   - **Tablet (`frontend/tablet/src/components/TabletMerchantAdmin.tsx` & `src/App.tsx`):** Medium modal proporsional, touch target $\ge 44$px.
   - **Mobile (`frontend/mobile/src/App.tsx`):** Slide-up bottom sheet dengan drag handle, integrasi `useModalBackHandler`, dan **bebas tombol silang 'X' di header**. Penutupan hanya melalui swipe-down, backdrop tap, atau tombol "Batal".
   - **Anti-Emoji:** 100% menggunakan ikon vektor Lucide React (`ShieldCheck`, `KeyRound`, `QrCode`, `Copy`, `Download`, `AlertCircle`).

---

### 2.2 [N-56 — LOW] Standarisasi Infrastruktur Edge (Cloudflare / Reverse Proxy & WAF Teruji)

#### A. Analisis Masalah & Kebutuhan Standarisasi:
Pada audit keamanan Putaran 8 (`audit-putaran-8-zero-change-2026-11-14.md` Seksi 2, item `N-56`), repositori belum memiliki artefak konfigurasi edge proxy resmi. Pengamanan level jaringan (WAF, edge rate limiting, terminasi TLS, mitigasi DDoS, dan proteksi origin isolation) wajib tersedia sebagai template acuan yang dapat direproduksi dan divalidasi secara sintaksis.

#### B. Spesifikasi Artefak Deliverables (`deploy/`):

1. **`deploy/nginx.conf` (Referensi Produksi Reverse Proxy Nginx):**
   - **Daftar Lengkap Subnet Resmi Cloudflare (IPv4 & IPv6 Terkini):**
     Mengonfigurasi `include deploy/cloudflare-ips.conf;` yang memuat blok `set_real_ip_from` lengkap per November 2026 (15 blok IPv4 dan 7 blok IPv6 terverifikasi):
     - IPv4: `173.245.48.0/20`, `103.21.244.0/22`, `103.22.200.0/22`, `103.31.4.0/22`, `141.101.64.0/18`, `108.162.192.0/18`, `190.93.240.0/20`, `188.114.96.0/20`, `197.234.240.0/22`, `198.41.128.0/17`, `162.158.0.0/15`, `104.16.0.0/13`, `104.24.0.0/14`, `172.64.0.0/13`, `131.0.72.0/22`.
     - IPv6: `2400:cb00::/32`, `2606:4700::/32`, `2803:f800::/32`, `2405:b500::/32`, `2405:8100::/32`, `2a06:98c0::/29`, `2c0f:f248::/32`.
   - **Restriksi Header & Kepercayaan Real IP:**
     - `real_ip_header CF-Connecting-IP;`
     - `real_ip_recursive on;`
     - Header `CF-Connecting-IP` **hanya dipercayai** jika koneksi TCP berasal langsung dari subnet Cloudflare yang terdaftar di `set_real_ip_from`.
   - **Origin Isolation (Anti-Bypass Protection):**
     - Blok server memvalidasi header rahasia khusus (*Custom Origin Request Header* `X-Origin-Verify: <secret>`) atau memblokir koneksi dari IP non-Cloudflare pada port 80/443 dengan HTTP 403 Forbidden.
   - **Rate Limiting Zones:**
     - Zona auth: `limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/m;`
     - Zona api umum: `limit_req_zone $binary_remote_addr zone=api_limit:10m rate=60r/m;`
   - **Security Headers & HSTS:**
     - `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;` (arahan `preload` hanya diaktifkan jika seluruh subdomain terverifikasi mendukung HTTPS).
     - `add_header X-Content-Type-Options "nosniff" always;`
     - `add_header X-Frame-Options "SAMEORIGIN" always;`
     - `add_header Referrer-Policy "strict-origin-when-cross-origin" always;`
   - **Payload Limits & Upstream Keepalive:**
     - `client_max_body_size 15M;`
     - `proxy_http_version 1.1;`
     - `proxy_set_header Connection "";` (upstream keepalive ke backend Go port 8000).

2. **`deploy/Caddyfile` (Referensi Produksi Reverse Proxy Caddy):**
   - Template konfigurasi Caddy modern dengan automatic TLS.
   - Meng-import range subnet Cloudflare dari `deploy/cloudflare-ips.caddy`.
   - Reverse proxy ke backend Go `127.0.0.1:8000` dengan pembatasan request body 15MB dan header security lengkap.

3. **Skrip Otomatisasi Sinkronisasi Subnet Cloudflare yang Resilien & Tahan Gagal:**
   - `deploy/update-cloudflare-ips.sh` (Bash) dan `deploy/update-cloudflare-ips.ps1` (PowerShell):
     1. *Pengunduhan Eksklusif dari Sumber Resmi Cloudflare:*
        - Mengunduh daftar subnet hanya dari endpoint resmi kanonik: `https://www.cloudflare.com/ips-v4` dan `https://www.cloudflare.com/ips-v6`.
        - Memvalidasi HTTP status code 200 dan memastikan konten bukan HTML challenge/block page.
     2. *Validasi Semantik IP/CIDR, Strict Host-Bits Zero, & Deduplikasi:*
        - Setiap baris diparse secara semantik menggunakan parser IP/CIDR bawaan sistem (`python3 -c "import ipaddress; ..."` di Bash; `[System.Net.IPNetwork]::Parse` di PowerShell).
        - **Pemeriksaan Batas Network Strict (Host Bits Zero):** Menolak baris di mana bit host tidak nol (misal menolak `173.245.48.1/20`, hanya menerima `173.245.48.0/20`), menjamin tidak ada subnet salah format yang lolos.
        - Subnet di-deduplikasi (*deduped*) dan diurutkan secara kanonik.
     3. *Ambang Batas Kelengkapan Dual-Stack Terikat Bounds:*
        - Subnet IPv4 unik valid **WAJIB dalam rentang $12 \le \text{count} \le 20$** (saat ini 15).
        - Subnet IPv6 unik valid **WAJIB dalam rentang $5 \le \text{count} \le 10$** (saat ini 7).
        - Jika response HTTP bukan 200 atau jumlah subnet di luar batas rentang: **SEKETIKA ABORT**, pertahankan konfigurasi aktif utuh, dan keluar dengan exit code 1.
     4. *Penulisan Berkas Sementara pada Filesystem yang Sama:*
        Snippet ditulis ke berkas sementara di direktori target konfigurasi yang sama:
        `deploy/cloudflare-ips.conf.tmp` (untuk Nginx) dan `deploy/cloudflare-ips.caddy.tmp` (untuk Caddy).
     5. *Test Harness Target Proxy Aktual (`PROXY_TYPE`):*
        Skrip menerima parameter lingkungan `PROXY_TYPE` (`"nginx"`, `"caddy"`, atau `"none"`):
        - Jika `PROXY_TYPE="nginx"`: Skrip menyalin konfigurasi pengujian `deploy/nginx.conf` dengan include sementara `.tmp`, lalu mengeksekusi `nginx -t -c <path>`.
        - Jika `PROXY_TYPE="caddy"`: Skrip menguji Caddyfile yang meng-import `.caddy.tmp` via `caddy validate --config <path>`.
        - **Isolasi Penuh Mode `PROXY_TYPE="none"` (Anti-Production Mutation):**
          Mode `PROXY_TYPE="none"` secara ketat dibatasi hanya untuk lingkungan CI/unit-test terisolasi di container yang tidak memiliki Nginx/Caddy terpasang. Mode ini **DILARANG KERAS** menyentuh, menulis, atau memodifikasi direktori proxy sistem aktif (`/etc/nginx`, `/etc/caddy`, dll.). Skrip hanya menulis snippet ke direktori kerja pengujian lokal `./deploy/test-output/cloudflare-ips.test.conf`, memverifikasi validitas parser semantik, dan exit 0. Di lingkungan produksi riil, nilai `PROXY_TYPE` wajib `"nginx"` atau `"caddy"`.
     6. *Atomic Swap, Backup, Reload Timeout & Post-Swap Smoke Test:*
        - Hanya jika pengujian sintaks harness sukses 100%: salin `cloudflare-ips.conf` aktif ke `cloudflare-ips.conf.bak`.
        - Lakukan atomic swap: pindahkan `cloudflare-ips.conf.tmp` menggantikan `cloudflare-ips.conf` via `mv -f`.
        - **Reload Ber-Timeout 10 Detik:**
          Jalankan reload proxy dengan batas waktu ketat: `timeout 10s nginx -s reload` (atau `timeout 10s systemctl reload nginx`).
        - **Post-Swap Smoke Test (Verifikasi Operasional 5 Detik):**
          Setelah reload selesai, jalankan HTTP smoke test: `curl -s -f -m 5 http://127.0.0.1:8000/healthz`.
        - **Prosedur Pemulihan Kegagalan Ambigu / Timeout / Error:**
          - Jika reload mengalami timeout (>10s), proses proxy crash/unresponsive, atau smoke test gagal:
            - Seketika inisiasi rollback: `mv -f <snippet>.bak <snippet>`.
            - Paksa reload dengan konfigurasi backup: `timeout 10s nginx -s reload`.
            - Pindahkan snippet yang bermasalah ke berkas karantina: `<snippet>.quarantine.<timestamp>`.
            - Keluar dengan exit code 2 (Reload Failure, Rolled Back).
          - Jika reload rollback juga gagal:
            - Sistem masuk ke **Safe Quarantine State**, menulis alert file `deploy/PROXY_CONFIG_ERROR.alert`, memicu alert log kritis, dan keluar dengan exit code 3 tanpa flapping loop.
          - Jika reload dan smoke test sukses:
            - Hapus berkas backup `.bak` dan keluar dengan exit code 0.

4. **`deploy/cloudflare-waf-rules.md` (Panduan Edge WAF & Pemetaan Tier Vendor Resmi):**
   - **Pemetaan Kemampuan Tier Cloudflare (Berdasarkan Dokumentasi Resmi Cloudflare Managed Rules):**

     | Fitur Cloudflare Edge WAF | Paket Free | Paket Pro | Paket Business | Paket Enterprise |
     | :--- | :---: | :---: | :---: | :---: |
     | **DDoS Protection L3/L4/L7** | ✅ Termasuk | ✅ Termasuk | ✅ Termasuk | ✅ Termasuk |
     | **Cloudflare Free Managed Ruleset** | ✅ Termasuk | ✅ Termasuk | ✅ Termasuk | ✅ Termasuk |
     | **Custom WAF Rules (Rate Limiting / IP Block)** | 5 aturan | 20 aturan | 100 aturan | 1000+ aturan |
     | **Cloudflare Managed Ruleset (CVE & App Protections)** | ❌ Tidak Tersedia | ✅ Termasuk | ✅ Termasuk | ✅ Termasuk |
     | **OWASP Core Security Ruleset** | ❌ Tidak Tersedia | ✅ Termasuk | ✅ Termasuk | ✅ Termasuk |
     | **Bot Management / Advanced Anomaly** | ❌ Heuristic Saja | Super Bot Fight Mode | Super Bot Fight Mode | ✅ Full Bot Management |

   - **Arsitektur TLS Cloudflare $\rightarrow$ Origin:**
     - Wajib menggunakan mode **Full (Strict)** di Cloudflare SSL/TLS Settings.
     - Origin server wajib memasang **Cloudflare Origin CA Certificate** (gratis dengan validasi hingga 15 tahun) atau sertifikat publik yang valid (Let's Encrypt). Mode *Flexible* dilarang keras karena trafik Cloudflare $\rightarrow$ origin tidak terenkripsi.
   - **Origin Firewall Isolation (Defense-in-Depth):**
     - Pengamanan port 80/443 di origin server tidak boleh hanya mengandalkan pemeriksaan header HTTP.
     - Wajib menerapkan restriksi firewall level jaringan pada host origin (Linux UFW / iptables) dan Cloud Provider Security Groups (AWS SG / GCP Firewall Rules):
       `ufw default deny incoming`
       `ufw allow from <cloudflare_cidrs> to any port 443 proto tcp`
       `ufw allow from <cloudflare_cidrs> to any port 80 proto tcp`
       Menjamin seluruh trafik dari IP non-Cloudflare langsung di-drop pada level TCP sebelum mencapai reverse proxy.
   - **Catatan Transparansi Vendor & Batasan Verifikasi:**
     Daftar subnet 15 IPv4 dan 7 IPv6 serta pemetaan tier WAF dalam dokumen ini didasarkan pada dokumentasi resmi Cloudflare yang dipublikasikan. Pada saat pelaksanaan review audit, akses verifikasi langsung ke server vendor terhalang oleh restriksi alat jaringan/web eksternal (HTTP 403 / unconfigured web tools). Skrip updater produksi dirancang secara mandiri untuk mengambil langsung data resmi dari Cloudflare dengan guardrails dan validasi semantik di atas saat dijalankan di lingkungan produksi.

---

## 3. Matriks Perubahan Berkas Lengkap (File Change Breakdown)

| Berkas | Aksi | Deskripsi Perubahan |
| :--- | :---: | :--- |
| `backend/internal/security/totp.go` | **Buat Baru** | Implementasi RFC 6238 TOTP murni Go stdlib (Base32 secret generator, code calculator HMAC-SHA1, dynamic truncation, skew validator $\pm 1$ step, backup codes generator 12 alfanumerik berkekuatan $\approx 60$-bit dengan hash bcrypt). |
| `backend/internal/security/totp_test.go` | **Buat Baru** | Unit test TOTP: RFC 6238 official test vectors, base32 decoding, validation window $\pm 30$ detik, dan backup code generation. |
| `backend/internal/security/crypto.go` | **Buat Baru** | Rencana implementasi AES-256-GCM cipher berversi (`<version>:<nonce>:<ciphertext>`) dengan AAD domain binding, RFC 5869 HKDF-SHA256 stdlib internal, modul manajemen kunci terdedikasi `MFA_ENCRYPTION_KEY` (0 fallback ke `JWT_SECRET`), validasi startup formal fail-closed, multi-version keyring, dan sub-command rotasi kunci; seluruhnya belum diimplementasi/diuji. |
| `backend/internal/security/crypto_test.go` | **Buat Baru** | Unit test enkripsi/dekripsi AES-256-GCM, verifikasi tamper-resistance (auth tag failure), AAD user binding mismatch rejection, roundtrip terversi, validasi startup key, dan RFC 5869 official test vectors. |
| `backend/internal/security/qrcode.go` | **Buat Baru** | Generator SVG QR code mandiri berbasis ISO/IEC 18004 bebas dependensi eksternal. |
| `backend/internal/security/qrcode_test.go` | **Buat Baru** | Unit test verifikasi output SVG QR code yang valid dan dapat di-parse peramban. |
| `backend/internal/models/user.go` | Modifikasi | Tambahkan field `TwoFactorEnabled`, `TwoFactorEnforced`, `TwoFactorSecretEnc`, `TwoFactorBackupCodesHash`, `TwoFactorEnrolledAt`, dan `TwoFactorSetupJTI` dengan tag `json:"-"` pada seluruh field sensitif. |
| `backend/internal/models/two_factor_recovery.go` | **Buat Baru** | Model struct `TwoFactorRecoveryTicket` untuk siklus hidup pemulihan akun darurat dengan kolom nonce dan signature lengkap. |
| `backend/internal/database/migrations/20261116_n60_user_two_factor_auth.sql` | **Buat Baru** | DDL migration terisolasi: `ALTER TABLE users ADD COLUMN IF NOT EXISTS ...` dan pembuatan tabel `two_factor_recovery_tickets` (sequence migrasi n60). |
| `backend/internal/middleware/auth.go` | Modifikasi | Definisikan `MFAChallengeClaims` (aud: `catavor-mfa-challenge`) dan `MFAEnrollmentClaims` (aud: `catavor-mfa-enrollment`). Buat validator onboarding terdedikasi `MFAEnrollmentAuth` dengan fresh DB check. Pertahankan `AuthRequired` dipin ketat ke `"catavor-web"`. |
| `backend/internal/middleware/rbac.go` | Modifikasi | Tambahkan guard mandatory 2FA pada `RequireAdmin`: jika `models.IsPlatformStaffRole(user.PlatformRole)` dan `!user.TwoFactorEnabled`, tolak dengan `403 MFA_ENROLLMENT_REQUIRED`. |
| `backend/internal/handlers/auth_handler.go` | Modifikasi | Intersepsi `Login`: 4-kondisi login matrix (staf 2FA aktif $\rightarrow$ challenge; staf belum 2FA $\rightarrow$ `requires_2fa_setup`; merchant 2FA aktif $\rightarrow$ challenge; merchant belum 2FA $\rightarrow$ normal). Tahan sesi, cookie, dan fingerprint jika 2FA aktif atau onboarding belum selesai. |
| `backend/internal/handlers/two_factor_handler.go` | **Buat Baru** | Challenge/enrollment handlers wajib mengikuti completion durable PostgreSQL→Redis dan onboarding recovery §§2.1.D–E; schema/runtime contracts are pending. |
| `backend/internal/handlers/two_factor_test.go` | **Buat Baru** | Unit test komprehensif alur 2FA: validasi challenge token, atomic reservation lease dan fencing token, retry hingga 3x salah sebelum JTI hangus, single-use JTI burn saat kode sukses, penolakan challenge token di endpoint terproteksi (negative test), penolakan onboarding token di endpoint sesi umum (negative test), expiry challenge token, replay attack rejection, fail-closed Redis unavailable test, rate limiting anti-DoS test, onboarding fail-closed saat receipt/response hilang dan login ulang TOTP, konkurensi konsumsi backup code, step-up password validation, dan mandatory admin enforcement di `/api/admin/*`. |
| `backend/cmd/server/main.go` | Modifikasi | Registrasi grup rute baru 2FA di `/api/auth/2fa` dan grup onboarding di `/api/auth/2fa/onboarding` dengan `MFAEnrollmentAuth`. Pasang guard mandatory 2FA pada `adminApi`. Registrasi sub-command CLI root pemulihan darurat break-glass. |
| `frontend/desktop/src/App.tsx` | Modifikasi | Step 2 Login (Input 6 digit TOTP / backup code + counter sisa percobaan) + Mandatory Admin Setup Banner + redirect setelah sesi aktif diverifikasi + Kartu & Modal Manajemen 2FA di Pengaturan Profil (Desktop centered modal). |
| `frontend/tablet/src/App.tsx` | Modifikasi | Step 2 Login di antarmuka tablet. |
| `frontend/tablet/src/components/TabletMerchantAdmin.tsx` | Modifikasi | Manajemen 2FA di antarmuka admin merchant tablet (Medium panel modal, touch target $\ge 44$px). |
| `frontend/mobile/src/App.tsx` | Modifikasi | Step 2 Login + Slide-Up Bottom Sheet Manajemen 2FA di antarmuka mobile native (drag handle, bebas tombol close 'X' header, `useModalBackHandler`). |
| `deploy/nginx.conf` | **Buat Baru** | Konfigurasi acuan reverse proxy Nginx (Real IP Cloudflare IPv4 & IPv6 terkini, origin isolation, TLS, body limit 15MB, rate limit zone). |
| `deploy/Caddyfile` | **Buat Baru** | Konfigurasi acuan reverse proxy Caddy (Automatic TLS, Cloudflare trusted proxies). |
| `deploy/update-cloudflare-ips.sh` | **Buat Baru** | Skrip Bash otomatisasi sinkronisasi subnet Cloudflare dengan validasi semantik IP/CIDR dual-stack (IPv4 $\ge 12$, IPv6 $\ge 5$), deduplikasi, atomic swap pada filesystem yang sama, syntax check target proxy, dan safe quarantine. |
| `deploy/update-cloudflare-ips.ps1` | **Buat Baru** | Skrip PowerShell otomatisasi sinkronisasi subnet Cloudflare untuk lingkungan Windows dengan validasi semantik dual-stack dan auto-rollback. |
| `deploy/cloudflare-waf-rules.md` | **Buat Baru** | Panduan resmi aturan Cloudflare Edge WAF, pemetaan tier fitur vendor resmi yang faktual, arsitektur Full (Strict) TLS, origin firewall isolation, dan panduan HSTS. |

---

## 4. Rencana Tahapan Eksekusi Pengerjaan (Step-by-Step Execution Plan)

### Tahap 1: Core Engine Kriptografi, TOTP & Manajemen Kunci (Leaf Packages)
1. Buat `backend/internal/security/crypto.go` dan `crypto_test.go`:
   - Implementasikan RFC 5869 HKDF-SHA256 (Go stdlib murni).
   - Implementasikan AES-256-GCM terversi (`<version>:<nonce>:<ciphertext>`) dengan AAD domain binding (`keyVersion:userID:totp_secret`).
   - Implementasikan modul validasi formal startup `MFA_ENCRYPTION_KEY` (format hex 64-karakter, decoding tepat 32 bytes, anti-trivial key reject, fail-closed di produksi).
   - Jalankan `go test -v ./internal/security -run TestCrypto` (uji RFC 5869 test vectors, tamper tag failure, AAD user mismatch rejection, version roundtrip, dan startup validation).
2. Buat `backend/internal/security/totp.go` dan `totp_test.go`:
   - Implementasikan pembangkit secret Base32, kalkulator TOTP RFC 6238, skew validator $\pm 30$ detik, dan generator backup codes berentropi tinggi ($\approx 60$-bit) dengan hash bcrypt.
   - Jalankan `go test -v ./internal/security -run TestTOTP` (uji RFC 6238 test vectors, skew rejection).
3. Buat `backend/internal/security/qrcode.go` dan `qrcode_test.go`:
   - Implementasikan generator SVG QR code mandiri berbasis ISO/IEC 18004.
   - Jalankan `go test -v ./internal/security -run TestQRCode`.
4. Jalankan `go test -v ./internal/security/...` $\rightarrow$ wajib lulus seluruh tes yang didefinisikan (hasil belum tersedia).

### Tahap 2: Skema Database, Verifikasi Migrasi SQL Incremental & Model Go
1. Buat berkas migrasi `backend/internal/database/migrations/20261116_n60_user_two_factor_auth.sql`.
2. Perbarui `backend/internal/models/user.go` dengan field 2FA ber-tag `json:"-"`.
3. Buat `backend/internal/models/two_factor_recovery.go` untuk model tiket pemulihan darurat lengkap dengan field nonce dan signature.
4. **Uji Matriks Migrasi Database:**
   - *Skenario A (Bootstrap DB baru yang telah diverifikasi kosong, `DB_AUTO_MIGRATE=true`):* AutoMigrate membentuk skema inti (`users`, `user_sessions`, `activity_logs`), lalu runner menerapkan SQL berurutan. Verifikasi tabel/kolom/index/FK N-60 dan ledger/checksum; gunakan DB scratch terisolasi, bukan `catavor` dev.
   - *Skenario B (Cluster terisi, `DB_AUTO_MIGRATE=true`):* DDL penambahan kolom pada data eksisting. Kriteria: data lama utuh pada fixture, `two_factor_enabled` default `false` untuk seluruh baris, backfill idempoten bila dijalankan ulang.
   - *Skenario C (Schema tracked, `DB_AUTO_MIGRATE=false`):* schema inti sudah ada dan `schema_migrations` berisi versi lama. Pastikan hanya N-60 diterapkan dan ledger/checksum dicatat; periksa prerequisite aktual (`users`, `user_sessions`, `activity_logs` beserta kolom NOT NULL yang dipakai) sebelum DDL, fail-fast bila kurang. Migrator saat ini belum melakukan pemeriksaan tersebut; implementasikan dan uji.
   - **Gap terverifikasi pada sesi:** `models.UserSession` mensyaratkan `user_id`, `token_id`, `ip_address`, `device_name`, `device_type`, `last_active_at`, dan `expires_at`; FK ke `user_sessions(id)` saja tidak menjamin kolom tersebut untuk `DB_AUTO_MIGRATE=false`. DDL/readiness harus memeriksa semua prerequisite dan insert sesi harus diuji.
   - **Blocker skema sesi terverifikasi:** `models.UserSession` mewajibkan `user_id`, `token_id`, `ip_address`, `device_name`, `device_type`, `last_active_at`, `expires_at`; FK `mfa_auth_completions.session_id REFERENCES user_sessions(id)` tidak menjamin kolom tersebut pada mode `DB_AUTO_MIGRATE=false`. DDL/schema prerequisite dan uji insert wajib memastikan semuanya ada.
   - *Skenario D (`DB_AUTO_MIGRATE=false` pada DB kosong):* Kriteria: startup **gagal jelas** karena prerequisite tidak ada, bukan membuat tabel parsial. Fresh DB hanya didukung `true`.
   - *Skenario E (Legacy: `users` berisi data, `schema_migrations` kosong):* runner saat ini membaseline semua file sehingga N-60 tidak berjalan. Dukungan harus melalui prosedur operator terotomasi/terverifikasi (backup+restore drill → inspeksi schema → DDL N-60 → validasi model/constraints/index → catat versi/checksum tanpa memalsukan history); selain itu MFA fail-closed dan deployment dinyatakan unsupported. Paragraf instruksi manual bukan bukti upgrade.
   - *Skenario F (`SKIP_DB_MIGRATE=true`):* tidak ada DDL; schema-readiness MFA harus memeriksa versi N-60 dan kolom wajib serta fail-closed sebelum endpoint dapat membuat challenge/session. Readiness check belum ada.
   - Jalankan tes migrator; perintah dan hasil belum ada. Tambahkan test fresh tracked, populated tracked, legacy-baseline upgrade, AutoMigrate=true/false, SKIP_DB_MIGRATE=true, rollback/checksum, dan insert `UserSession` dengan setiap kolom NOT NULL.

### Tahap 3: Handlers, Middleware Onboarding & Alur Otentikasi Backend
1. Perbarui `backend/internal/middleware/auth.go`:
   - Tambahkan field model `User.TwoFactorLastTOTPStep` bertipe `int64` (DB BIGINT NOT NULL DEFAULT 0) serta kolom schema. Definisikan `MFAChallengeClaims` (`aud: catavor-mfa-challenge`) dan `MFAEnrollmentClaims` (`aud: catavor-mfa-enrollment`).
   - Buat `MFAEnrollmentAuth(cfg)` dengan fresh DB role/status check. Redis JTI state/receipt hanya cache; jika DB menunjukkan setup committed tapi receipt hilang, fail closed dan jangan buat sesi/backup codes baru. Tidak ada janji retry yang mengembalikan response identik; pemulihan lewat login TOTP atau emergency recovery.
   - Pertahankan `AuthRequired` dipin ketat hanya ke `catavor-web`.
2. Perbarui `backend/internal/middleware/rbac.go`: tambahkan `RequireMFACompleted` untuk grup `/admin` dan endpoint MFA-sensitif sehingga sesi yang belum melewati challenge/finalisasi ditolak; jangan mengubah `RequireAdmin` agar tetap kompatibel dengan sesi merchant.
   - Catatan sumber terverifikasi Putaran 14: `backend/internal/middleware/auth.go:322-344` menjalankan `Select("is_revoked").Where("token_id = ?", claims.ID).Scan(&isRevoked)` dan hanya menolak pada `err == nil && isRevoked`. Kode tidak memeriksa `RowsAffected` dan tidak menolak query error/DB nil pada blok ini; oleh sebab itu desain MFA mensyaratkan perubahan fail-closed. Belum ada request runtime yang membuktikan dampak missing-row.
3. Modifikasi `backend/internal/handlers/auth_handler.go`:
   - Terapkan matriks 4-kondisi login:
     - Staf platform dengan 2FA aktif $\rightarrow$ `requires_2fa: true`, `challenge_token` (5m, aud: `catavor-mfa-challenge`). Tahan sesi/kuki.
     - Staf platform tanpa 2FA $\rightarrow$ `requires_2fa_setup: true`, `setup_token` (15m, aud: `catavor-mfa-enrollment`). Tahan sesi/kuki.
     - Merchant dengan 2FA aktif $\rightarrow$ `requires_2fa: true`, `challenge_token` (5m). Tahan sesi/kuki.
     - Merchant tanpa 2FA $\rightarrow$ Sesi penuh normal.
4. Buat `backend/internal/handlers/two_factor_handler.go`:
   - Handler `POST /api/auth/2fa/verify`:
     - Verifikasi challenge claims (`aud: catavor-mfa-challenge`).
     - Implementasikan lease, lockout dan receipt sesuai kontrak §2.1.D.3; Redis receipt tidak menggantikan completion durable.
     - Backup code mengikuti completion PostgreSQL→Redis di §2.1.D.3; tidak ada rollback lintas-store, kegagalan Redis menyisakan pending, sesi tertahan sampai recovery.
     - Tangani status lease/error eksplisit, fail-closed 503 saat Redis unavailable, dan tambah counter hanya pada kode faktor salah.
     - Terbitkan sesi hanya setelah hasil completion durable dapat dipulihkan; jangan menyimpan plaintext token dalam log.
   - Handler onboarding: ikuti §2.1.E.1 recovery durable/fail-closed; receipt Redis TTL bukan bukti tahan kehilangan. Isi kolom sesi NOT NULL dan periksa seluruh error DB.

     - `POST /api/auth/2fa/setup`: Mewajibkan verifikasi kata sandi (step-up).
     - `POST /api/auth/2fa/enable`: Konfirmasi kode pertama dan kirim notifikasi email.
     - `POST /api/auth/2fa/disable`: Step-up kata sandi + kode faktor kedua (staf dilarang disable / 403).
     - `POST /api/auth/2fa/regenerate-backup-codes`: Step-up kata sandi + kode faktor kedua.
   - Handler & Sub-Command Pemulihan Darurat:
     - Implementasikan 2-phase state machine `TwoFactorRecoveryTicket` (`READY_FOR_APPROVAL` -> `PENDING_SECOND_APPROVAL` -> `EXECUTED`) dengan verifikasi one-time nonce atomik per approver di web portal.
     - Implementasikan sub-command CLI root server break-glass dengan transaksi PostgreSQL yang mengeksekusi `LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE;` sebelum kueri penghitungan superadmin (`is_blacklisted = FALSE`) untuk serialisasi selama durasi lock; uji konkurensi, `lock_timeout`, dan interaksi dengan row-lock di transaksi yang sama.
     - Catat audit transaksional di `activity_logs` (`models.ActivityLog`) dengan insert yang memeriksa error, dan auxiliary log lokal `logs/mfa-break-glass.jsonl` (0600). Keduanya bukan tamper-evident: retention 90/365 hari dan akses OS privileged berlaku.
5. Daftarkan rute di `backend/cmd/server/main.go`.
6. Buat `backend/internal/handlers/two_factor_test.go`:
   - Uji login dengan 2FA aktif $\rightarrow$ menerima `challenge_token`.
   - Uji alur atomic reservation lease & fencing token: request paralel dengan fencing token berbeda tertahan; request terlambat dengan lease kedaluwarsa ditolak (`CHALLENGE_LEASE_EXPIRED`).
   - Uji alur retry challenge: percobaan 1 dan 2 yang salah mengembalikan 401 dengan sisa percobaan dan JTI TETAP BISA DIGUNAKAN; percobaan ke-3 yang salah menghanguskan JTI; percobaan ke-4 ditolak karena challenge exhausted / invalid.
   - Uji completion durable: DB commit mendahului Redis finalize; retry menggunakan completion ID yang sama, anti-replay TOTP atomik, dan tidak ada klaim transaksi lintas-store.
   - Uji login staf platform tanpa 2FA $\rightarrow$ menerima `requires_2fa_setup: true` dan akses ke `/api/admin/*` terblokir 403.
   - Negative test: coba gunakan `challenge_token` untuk mengakses `GET /api/me` atau `/api/admin/overview` $\rightarrow$ Wajib 401 Unauthorized.
   - Negative test: coba gunakan `setup_token` (onboarding) untuk mengakses `GET /api/me` atau `/api/admin/overview` $\rightarrow$ Wajib 401 Unauthorized.
   - Uji onboarding saga dua-transaksi: onboarding selesai tidak mengembalikan cookie sebelum transaksi kedua CAS `is_revoked` TRUE→FALSE; cookie hanya valid untuk `/api/admin/*` setelah commit kedua. Crash di antara keduanya wajib fail-closed tanpa meminta verifikasi faktor ulang.
   - Uji idempotent retry onboarding: receipt hilang setelah DB commit tidak pernah me-mint sesi/backup codes; staf dapat login ulang dengan TOTP dan melakukan regenerate backup codes step-up.
   - Uji fresh DB check onboarding: pencabutan privilege staf di DB seketika membatalkan token onboarding.
   - Uji fail-closed Redis: simulasi Redis timeout / mati saat verify $\rightarrow$ wajib mengembalikan HTTP 503 `AUTH_SERVICE_UNAVAILABLE`.
   - Uji anti-DoS rate limit: spam token challenge invalid TIDAK menaikkan counter kegagalan akun pengguna sah; hanya input kode salah yang menaikkan counter.
   - Uji replay attack TOTP $\rightarrow$ pengiriman kedua dengan step yang sama wajib ditolak 401.
   - Uji konkurensi backup code $\rightarrow$ dua request paralel dengan backup code yang sama hanya 1 yang sukses, 1 lainnya ditolak.
   - Uji seluruh role staf platform (`superadmin`, `support`, `compliance`, `finance`, `content`) terikat wajib 2FA, sedangkan merchant tetap opt-in.
   - Uji dual-admin 2-phase recovery authorization (`PENDING_SECOND_APPROVAL`) dan mitigasi self-approval.
   - Uji CLI break-glass: transaksi DB dengan table lock + lock timeout membatalkan eksekusi bila superadmin $\ge 2$; uji race dua CLI/recovery dan mutasi role paralel. Lock hanya serialisasi terbatas durasi transaksi.
7. Jalankan `go test -p 1 -count=1 ./...` $\rightarrow$ wajib lulus seluruh tes yang didefinisikan (hasil belum tersedia).

### Tahap 4: Penyelarasan Frontend Tri-Device
1. Selaraskan alur login 2-tahap di `frontend/desktop/src/App.tsx`, `frontend/tablet/src/App.tsx`, dan `frontend/mobile/src/App.tsx` (termasuk visualisasi sisa percobaan kode salah).
2. Implementasikan UI onboarding wajib admin dan pengaturan profil 2FA:
   - Desktop: modal aktivasi QR code centered, tabel kode cadangan.
   - Tablet: medium modal dengan target sentuh $\ge 44$px.
   - Mobile: slide-up bottom sheet ramah jempol bebas tombol close header 'X'.
3. Jalankan typecheck TypeScript:
   - `frontend/desktop`: `fnm use 22; npx tsc -b` $\rightarrow$ 0 error.
   - `frontend/tablet`: `fnm use 22; npx tsc -b` $\rightarrow$ 0 error.
   - `frontend/mobile`: `fnm use 22; npx tsc -b` $\rightarrow$ 0 error.
4. Jalankan build produksi ke `public/`:
   - `npm run build` di ketiga direktori frontend $\rightarrow$ 3/3 Sukses.

### Tahap 5: Standarisasi Infrastruktur Edge (`deploy/`) & Validasi Sintaks
1. Buat direktori `deploy/`.
2. Tulis `deploy/nginx.conf`, `deploy/Caddyfile`, `deploy/update-cloudflare-ips.sh`, `deploy/update-cloudflare-ips.ps1`, dan `deploy/cloudflare-waf-rules.md`.
3. Skrip updater dikonfigurasi untuk mengunduh resmi dari `https://www.cloudflare.com/ips-v4` & `ips-v6`, memvalidasi semantik IP/CIDR, memverifikasi host bits nol, rentang bounds $12-20$ IPv4 dan $5-10$ IPv6, atomic swap `.tmp` ke live file, reload dengan timeout 10s, post-swap smoke test, auto-rollback, dan karantina jika gagal. Mode `PROXY_TYPE="none"` terisolasi ketat ke direktori test dan dilarang menyentuh konfigurasi sistem.
4. Jalankan validasi sintaks nyata:
   - `nginx -t -c <absolute_path>/deploy/nginx.conf` $\rightarrow$ Wajib `syntax is ok` dan `test is successful`.
   - `caddy validate --config <absolute_path>/deploy/Caddyfile` $\rightarrow$ Wajib konfigurasi valid.
   - Uji eksekusi skrip updater Cloudflare IPs pada mode dry-run/syntax check semantik.

### Tahap 6: Verifikasi Menyeluruh & Uji Regresi
1. Jalankan `govulncheck ./...`; target 0 vulnerability — hasil aktual dilaporkan dari eksekusi.
2. Jalankan `go vet ./...`; target 0 warning — hasil aktual dilaporkan dari eksekusi.
3. Target suite Playwright E2E lulus penuh; jumlah dan status aktual harus dilaporkan dari eksekusi nyata, bukan angka yang diasumsikan.

---

## 5. Blocker Reaudit & Gate Eksekusi

> Checklist berikut menjelaskan mengapa plan **belum siap dieksekusi**. Butir `[ ]` adalah pekerjaan/disain atau tes mendatang, bukan hasil runtime. Tidak ada otorisasi implementasi sampai blocker ditutup dan review independen menyetujui.

- [ ] **Migration N-60:** DDL tervalidasi pada clone saja; file migrasi belum ada. Buat model/constraint dan sinkronkan AutoMigrate/manual path. Runner membaseline SEMUA file bila `schema_migrations` kosong dan `users` sudah berisi data, tanpa mengeksekusi DDL. Sediakan prosedur upgrade legacy eksplisit, jangan ubah migration lama/checksum. `DB_AUTO_MIGRATE=false` tetap menjalankan SQL runner; `SKIP_DB_MIGRATE=true` melewati AutoMigrate dan runner. Fail-closed bila schema/version belum valid.

- [ ] **Challenge/completion verifikasi (TOTP & backup code):** PostgreSQL adalah otoritas faktor dan event salah; transaksi `SELECT ... FOR UPDATE` mengonsumsi faktor, menyimpan audit, session row revoked, dan satu completion pending dengan payload terenkripsi. Redis finalize adalah settlement projection idempotent; PG kedua CAS pending→committed dan revoked→active; cookie hanya sesudah commit kedua. Tabel `mfa_challenge_failures` idempotent `(token_jti, lease_generation)` mencegah hit lockout ganda saat retry. Reconciler, expiry, retention/cleanup, ambiguous timeout, manual recovery dan fault injection belum diimplementasi.

- [ ] **Onboarding/merchant/backup-code receipt:** Aktivasi MFA, binding JTI, hash backup codes, audit dan session pending berada dalam transaksi PG; settlement mengikuti kontrak completion. Receipt Redis bukan recovery source. Kehilangan response/receipt tidak boleh mem-mint ulang sesi atau plaintext codes; login TOTP untuk regenerate dengan step-up, atau emergency recovery berotorisasi. Disable/regenerate juga perlu consume factor, audit tx, revocation/rotation yang konsisten.

- [ ] **Audit dan break-glass:** `activity_logs` bukan tamper-evident terhadap DB privileged. MFA/recovery wajib insert tx dengan error propagation. Break-glass menghitung superadmin di transaksi dengan lock_timeout dan urutan tiket→users→target; table lock hanya melindungi writer yang patuh protokol sama. Uji dua CLI konkuren dan mutasi role.

- [ ] **Middleware & runtime gate:** `AuthRequired` perlu menolak row session hilang/query error secara fail-closed; readiness schema dan Redis ≥6.2+ belum ada. Redis unavailable fail-closed.
- [ ] Jalankan verifikasi migrasi/tes hanya pada DB disposable; tidak ada bukti tes runtime pada review ini. Persetujuan reviewer independen tetap wajib.

### Tes wajib sebelum perubahan kode dinyatakan selesai
- [ ] Isolasi DB disposable; tes migrasi fresh AutoMigrate, legacy tanpa `schema_migrations`, fresh/upgrade `DB_AUTO_MIGRATE=false`, dan `SKIP_DB_MIGRATE=true` fail-closed. Jangan sentuh DB operasional.
- [ ] Redis integrasi versi 6.2+; uji startup menolak versi lebih rendah, Redis unavailable fail-closed, replay, counter lockout durable PG + idempotent per-generation failure event, Lua lease expiry, dan fault injection di tiap batas PostgreSQL–Redis.
- [ ] Uji race retry onboarding, receipt hilang, response hilang, privilege dicabut, serta setiap kegagalan write audit/session/ticket.
- [ ] Verifikasi semua tes/migrasi/health runtime dengan output nyata; typecheck/build saja bukan bukti runtime.
- [ ] Reviewer independen memberi persetujuan tertulis sebelum agent implementasi mengubah kode.

> **Status revisi saat ini:** plan tetap **NOT APPROVED / NO CODE AUTHORIZATION**. Desain durable lockout PG, idempotent failure-event, minimum Redis, fail-closed session lookup, backup-code completion, onboarding recovery, transactional audit, serta batas table-lock break-glass kini disatukan. Belum diimplementasi/diuji runtime. DDL N-60 yang tertanam lulus apply/repeat pada clone skema `catavor`; fresh/legacy migrator, GORM model/insert, Redis 6.2+, reconciler/cookie recovery, concurrency, ActivityLog rollback, break-glass dan approval independen masih blocker. N-60 belum ada sebagai file.
