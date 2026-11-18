# Panduan Operasional Cutover & Kesiapan Produksi Catavor (Go-Live Runbook)

Dokumen ini memandu eksekusi **5 Gerbang Operasional Go-Live** untuk peluncuran produksi Catavor pada dua arsitektur resmi:
- **Jalur A — VPS Linux Native** (`systemd` + `PostgreSQL 17` + `Redis 7` + `Nginx`/`Caddy` + `UFW` + `Cloudflare Full Strict`)
- **Jalur B — Docker Compose Produksi Terisolasi** (`deploy/docker-compose.prod.yml`)

---

## Ringkasan 5 Gerbang Wajib Pra-Peluncuran

| Gerbang | Komponen | Verifikasi Lulus |
| :--- | :--- | :--- |
| **Gate #1** | Rahasia `.env.production` & Pemisahan Kunci MFA | `JWT_SECRET` != `MFA_ENCRYPTION_KEY` (masing-masing 256-bit CSPRNG), `REQUIRE_SEPARATE_MFA_KEY=true`, izin berkas `0600` |
| **Gate #2** | Persistensi Keamanan Redis (Fail-Closed) | `REDIS_ADDR` + `REDIS_PASSWORD` aktif (`PONG`), mode AOF menyala (`appendonly yes`) |
| **Gate #3** | Backup Database & Migrasi Skema N-60 | Snapshot `pg_dump -Fc` terverifikasi + SHA-256 sebelum migrasi; `catavor-admin-cli -migrate` lulus |
| **Gate #4** | Edge WAF Cloudflare, TLS Strict, & Firewall Origin | SSL/TLS Cloudflare `Full (Strict)` + Origin CA, UFW hanya mengizinkan CIDR Cloudflare pada `80`/`443` & menolak `8000` langsung, timer mingguan aktif |
| **Gate #5** | Kuorum >= 2 Superadmin & SOP Break-Glass MFA | Minimal **2 akun Superadmin terpisah** aktif & menuntaskan aktivasi MFA TOTP (`catavor-admin-cli -check-go-live -require-mfa-enrolled`) |

---

## Jalur A — Deployment VPS Linux Native (Ubuntu 22.04 / 24.04 / Debian 12)

### 1. Siapkan Pengguna Sistem & Direktori Terisolasi
```bash
sudo useradd --system --user-group --home-dir /opt/catavor --shell /usr/sbin/nologin catavor || true
sudo mkdir -p /etc/catavor /opt/catavor/{bin,public,deploy} /var/lib/catavor/{storage,private_storage} /var/backups/catavor
sudo chmod 0750 /etc/catavor /var/lib/catavor/storage
sudo chmod 0700 /var/lib/catavor/private_storage /var/backups/catavor
sudo chown -R catavor:catavor /opt/catavor /var/lib/catavor
```

### 2. Gate #1 — Bangkitkan Rahasia Produksi (CSPRNG 256-bit)
```bash
sudo OUT_FILE=/etc/catavor/.env.production bash deploy/generate-prod-secrets.sh
sudo chown root:catavor /etc/catavor/.env.production
sudo chmod 0640 /etc/catavor/.env.production
# Catatan: untuk preflight ketat single-owner root sebelum systemd membaca EnvironmentFile, gunakan 0600 bila unit dibaca oleh systemd master process (PID 1 berjalan sebagai root):
sudo chmod 0600 /etc/catavor/.env.production
```
Edit `/etc/catavor/.env.production` untuk menyesuaikan:
- `CATAVOR_DOMAIN`, `APP_URL`, dan `ALLOWED_ORIGINS` (wajib `https://`, tanpa `localhost`)
- `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE=require`
- `REDIS_ADDR=127.0.0.1:6379` dan `REDIS_PASSWORD` (selaraskan dengan `/etc/redis/redis.conf` -> `requirepass` & `appendonly yes`)
- `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, dan `SMTP_*`

> **PERINGATAN KRITIS**: Simpan salinan terenkripsi `MFA_ENCRYPTION_KEY` di brankas rahasia perusahaan (Vault / 1Password Ops). Mengubah `MFA_ENCRYPTION_KEY` tanpa prosedur migrasi akan membuat seluruh secret TOTP pengguna tidak dapat didekripsi.

### 3. Gate #4 — Kunci Firewall Origin UFW & Reverse Proxy + Cloudflare Timer
1. Pasang sertifikat Cloudflare Origin CA di `/etc/ssl/catavor/origin-cert.pem` (`0644`) dan `/etc/ssl/catavor/origin-key.pem` (`0600`). Set mode SSL/TLS di dashboard Cloudflare ke **Full (Strict)** dan terapkan aturan WAF dari `deploy/cloudflare-waf-rules.md`.
2. Uji lalu aktifkan firewall UFW khusus subnet resmi Cloudflare:
   ```bash
   # Uji kering terlebih dahulu (ganti CIDR IP SSH bastion/kantor Anda):
   DRY_RUN=1 ADMIN_SSH_CIDR="203.0.113.10/32" bash deploy/setup-ufw-cloudflare.sh
   # Terapkan aturan:
   sudo ADMIN_SSH_CIDR="203.0.113.10/32" bash deploy/setup-ufw-cloudflare.sh
   ```
3. Salin skrip & unit systemd termasuk pembaru mingguan CIDR Cloudflare:
   ```bash
   sudo cp -a deploy/* /opt/catavor/deploy/
   sudo cp deploy/catavor.service /etc/systemd/system/
   sudo cp deploy/catavor-cloudflare-ips.{service,timer} /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable catavor.service
   sudo systemctl enable --now catavor-cloudflare-ips.timer
   ```

### 4. Gate #2 & #3 — Eksekusi Preflight, Backup `pg_dump`, Migrasi, & Cutover
- **Untuk upgrade / cutover database eksisting** (otomatis membuat backup `pg_dump -Fc` + verifikasi SHA-256 sebelum migrasi):
  ```bash
  sudo ENV_FILE=/etc/catavor/.env.production PROXY_TYPE=nginx bash deploy/backup-and-cutover.sh
  ```
- **Untuk instalasi perdana pada database PostgreSQL kosong** (menginisialisasi skema penuh + matriks RBAC + paket dasar tanpa akun/toko demo):
  ```bash
  sudo BOOTSTRAP_EMPTY_DB=1 ENV_FILE=/etc/catavor/.env.production PROXY_TYPE=nginx bash deploy/backup-and-cutover.sh
  ```

### 5. Gate #5 — Onboarding Minimal 2 Akun Superadmin & Verifikasi Akhir
Jangan pernah mengoperasikan produksi hanya dengan 1 akun Superadmin (mencegah lockout tunggal):
```bash
# Buat Superadmin #1 dan #2 secara aman melalui STDIN (tanpa membocorkan password di ps aux):
sudo systemd-run --pipe --wait -p EnvironmentFile=/etc/catavor/.env.production -p Environment=SKIP_DOTENV=true \
  /opt/catavor/bin/catavor-admin-cli -email "ops-primary@domainanda.com" -name "Primary Superadmin" -password-stdin
# (Ketik passphrase kuat >= 12 karakter lalu tekan Enter & Ctrl+D)

sudo systemd-run --pipe --wait -p EnvironmentFile=/etc/catavor/.env.production -p Environment=SKIP_DOTENV=true \
  /opt/catavor/bin/catavor-admin-cli -email "ops-secondary@domainanda.com" -name "Secondary Superadmin" -password-stdin
```
Selanjutnya:
1. Kedua Superadmin login melalui browser produksi -> sistem otomatis menahan penerbitan sesi dan mengarahkan ke pendaftaran wajib MFA TOTP -> pindai QR pada dua perangkat fisik terpisah dan simpan **10 Backup Codes** di brankas terpisah.
2. Jalankan audit final Go-Live (wajib keluar dengan kode `0` / `[SIAP GO-LIVE]`):
   ```bash
   sudo systemd-run --pipe --wait -p EnvironmentFile=/etc/catavor/.env.production -p Environment=SKIP_DOTENV=true \
     /opt/catavor/bin/catavor-admin-cli -check-go-live -require-mfa-enrolled
   ```

---

## Jalur B — Deployment Docker Compose Produksi

1. Bangkitkan rahasia produksi `deploy/.env.production` (`0600`):
   ```bash
   bash deploy/generate-prod-secrets.sh
   ```
   Sesuaikan `CATAVOR_DOMAIN`, `APP_URL`, `ALLOWED_ORIGINS`, `GOOGLE_CLIENT_*`, dan `SMTP_*` di `deploy/.env.production`.
2. Validasi konfigurasi statis sebelum build:
   ```bash
   SKIP_LIVE_PROBES=1 ENV_FILE=deploy/.env.production bash deploy/preflight-check.sh
   ```
3. Bangun image produksi Tri-Frontend + Distroless dan nyalakan stack:
   ```bash
   docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml up -d --build
   ```
4. Inisialisasi skema (instalasi baru) atau jalankan migrasi SQL:
   ```bash
   # Instalasi perdana DB kosong (tanpa data demo):
   docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml \
     exec catavor /app/catavor-admin-cli -bootstrap-schema

   # Upgrade database eksisting:
   docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml \
     exec catavor /app/catavor-admin-cli -migrate
   ```
5. Buat minimal 2 akun Superadmin dan verifikasi kesiapan akhir:
   ```bash
   printf '%s\n' '<PASSPHRASE_KUAT_ADMIN_1>' | docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml \
     exec -T catavor /app/catavor-admin-cli -email "ops-primary@domainanda.com" -name "Primary Superadmin" -password-stdin

   printf '%s\n' '<PASSPHRASE_KUAT_ADMIN_2>' | docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml \
     exec -T catavor /app/catavor-admin-cli -email "ops-secondary@domainanda.com" -name "Secondary Superadmin" -password-stdin

   # Setelah kedua Superadmin login & mengaktifkan TOTP MFA:
   docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml \
     exec catavor /app/catavor-admin-cli -check-go-live -require-mfa-enrolled
   ```

---

## SOP Pemulihan Darurat Break-Glass MFA (Dual-Control)

Gunakan prosedur ini **hanya** apabila seorang staf/Superadmin kehilangan perangkat autentikator **sekaligus** seluruh kode cadangan (Backup Codes):
1. Verifikasi identitas pemohon secara out-of-band (panggilan video + tiket insiden resmi, misal `INC-2026-042`).
2. Minta persetujuan dari **Superadmin aktif kedua** yang sudah memiliki MFA aktif (`-approved-by`). Sistem menolak *self-approval*.
3. Eksekusi reset teraudit:
   ```bash
   # VPS Systemd:
   sudo systemd-run --pipe --wait -p EnvironmentFile=/etc/catavor/.env.production -p Environment=SKIP_DOTENV=true \
     /opt/catavor/bin/catavor-admin-cli \
     -reset-mfa \
     -email "staf-terkunci@domainanda.com" \
     -ticket "INC-2026-042" \
     -approved-by "ops-secondary@domainanda.com"

   # Atau Docker Compose:
   docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml \
     exec catavor /app/catavor-admin-cli \
     -reset-mfa \
     -email "staf-terkunci@domainanda.com" \
     -ticket "INC-2026-042" \
     -approved-by "ops-secondary@domainanda.com"
   ```
4. Dampak otomatis:
   - Seluruh secret TOTP lama, backup codes lama, dan status lockout dibersihkan;
   - Seluruh sesi aktif (`user_sessions`) dicabut + `token_version` dinaikkan + JTI di-blacklist di Redis;
   - Rekaman jejak audit permanen ditulis ke `two_factor_recovery_tickets` dan `activity_logs` (`SECURITY_BREAK_GLASS_MFA_RESET`);
   - `two_factor_enforced` tetap `true`, sehingga pada login berikutnya akun tersebut wajib mendaftarkan ulang TOTP baru sebelum memperoleh sesi.

---

## Prosedur Rollback Darurat Database

Apabila diperlukan pemulihan ke titik tepat sebelum cutover:
```bash
sudo systemctl stop catavor.service
sha256sum -c /var/backups/catavor/<NAMA_BERKAS_BACKUP>.dump.sha256
PGPASSWORD="<DB_PASSWORD>" PGSSLMODE=require pg_restore \
  --clean --if-exists --no-owner --no-acl \
  -h 127.0.0.1 -p 5432 -U catavor_app -d catavor \
  /var/backups/catavor/<NAMA_BERKAS_BACKUP>.dump
sudo systemctl start catavor.service
```
