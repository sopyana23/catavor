# 🛡️ Panduan & Checklist Standar Keamanan Sistem (Security Blueprint & Checklist)
### Proyek: Catavor (DFauna Multi-Channel SaaS Platform)
*Dokumen ini memuat panduan komprehensif kepatuhan keamanan industri (OWASP Top 10, SOC 2, ISO 27001) yang terbagi menjadi dua fase: Keamanan Tingkat Aplikasi Lokal (Sekarang) dan Keamanan Tingkat Server & Infrastruktur (Masa Depan).*

---

## 📋 DAFTAR ISI
1. [Ringkasan Eksekutif (*Executive Summary*)](#1-ringkasan-eksekutif)
2. [Fase 1: Checklist Keamanan Tingkat Aplikasi & Kode Lokal (Sekarang)](#2-fase-1-keamanan-tingkat-aplikasi--kode-lokal-sekarang)
   - [2.1 Validasi & Sanitasi Seluruh Isian Form (Input Defense)](#21-validasi--sanitasi-seluruh-isian-form-input-defense)
   - [2.2 Keamanan Render & Frontend React (Anti-XSS)](#22-keamanan-render--frontend-react-anti-xss)
   - [2.3 Keamanan Database & Parameterized Query (Anti-SQLi)](#23-keamanan-database--parameterized-query-anti-sqli)
   - [2.4 Keamanan Unggah Berkas & Gambar (File Upload Hardening)](#24-keamanan-unggah-berkas--gambar-file-upload-hardening)
   - [2.5 Keamanan Autentikasi, Password & Sesi (Auth Hardening)](#25-keamanan-autentikasi-password--sesi-auth-hardening)
   - [2.6 Middleware Keamanan HTTP & Rate Limiting](#26-middleware-keamanan-http--rate-limiting)
3. [Fase 2: Checklist Keamanan Tingkat Server & Infrastruktur Produksi (Masa Depan)](#3-fase-2-keamanan-tingkat-server--infrastruktur-produksi-masa-depan)
   - [3.1 Jaringan, Firewall & Reverse Proxy (Network & WAF)](#31-jaringan-firewall--reverse-proxy-network--waf)
   - [3.2 Enkripsi Komunikasi & Sertifikat SSL/TLS](#32-enkripsi-komunikasi--sertifikat-ssltls)
   - [3.3 Pengerasan Server & Akses SSH (Server Hardening)](#33-pengerasan-server--akses-ssh-server-hardening)
   - [3.4 Database Hardening & Disaster Recovery (Backup)](#34-database-hardening--disaster-recovery-backup)
   - [3.5 Manajemen Rahasia (*Secrets Management*) & Konfigurasi](#35-manajemen-rahasia-secrets-management--konfigurasi)
   - [3.6 Monitoring, Log Audit & Deteksi Ancaman (SIEM)](#36-monitoring-log-audit--deteksi-ancaman-siem)
   - [3.7 Pipeline CI/CD & Pemindaian Kerentanan (DevSecOps)](#37-pipeline-cicd--pemindaian-kerentanan-devsecops)
4. [Tabel Matriks Kesiapan Keamanan (*Security Readiness Matrix*)](#4-tabel-matriks-kesiapan-keamanan)

---

## 1. Ringkasan Eksekutif

Keamanan sistem informasi modern menganut prinsip **Defense-in-Depth** (pertahanan berlapis). Keamanan tidak hanya bergantung pada firewall server, melainkan harus dibangun secara solid dari baris kode aplikasi (tingkat lokal) hingga ke konfigurasi pusat data dan jaringan cloud (tingkat server).

```mermaid
graph TD
    subgraph "Fase 1: Tingkat Aplikasi & Kode (Diterapkan Sekarang)"
        A1[Sanitasi Input & Whitelist Protokol]
        A2[Safe React Rendering / Anti-XSS]
        A3[Parameterized SQL / Anti-SQLi]
        A4[Magic-Byte Upload & Image Re-encoding]
        A5[Bcrypt Password Hashing & JWT Auth]
        A6[Local Rate Limiter & HTTP Security Headers]
    end

    subgraph "Fase 2: Tingkat Server & Infrastruktur (Diterapkan Masa Depan)"
        B1[Cloudflare WAF / Anti-DDoS]
        B2[Nginx Reverse Proxy & TLS 1.3 / SSL]
        B3[SSH Key-Only & Fail2ban]
        B4[PostgreSQL Remote Hardening & Encrypted Backups]
        B5[Secrets Vault & Automated Environment Isolation]
        B6[Realtime Monitoring / Sentry / Audit Logs]
    end

    A1 --> A2 --> A3 --> A4 --> A5 --> A6
    A6 -.-> B1 --> B2 --> B3 --> B4 --> B5 --> B6
```

---

## 2. Fase 1: Keamanan Tingkat Aplikasi & Kode Lokal (Sekarang)

*Bagian ini dapat dieksekusi dan dipastikan langsung di dalam basis kode Go Backend dan React Frontend tanpa memerlukan infrastruktur server eksternal.*

### 2.1 Validasi & Sanitasi Seluruh Isian Form (Input Defense)
Setiap data yang masuk dari pengguna (*untrusted user input*) harus disanitasi sebelum disimpan ke database:

- [ ] **Sanitasi Teks Polos (*Plain Text Fields*)**:
  - Hapus semua tag HTML (`<...>` dan tag tak tertutup).
  - Hapus karakter kontrol biner dan null-bytes (`\x00`).
  - Lakukan pembatasan panjang karakter (*string length clamp*) untuk mencegah *buffer overflow* atau *database payload bloating*.
  - *Target Form*: Nama pengguna, judul artikel, nama fauna/produk, nama toko, slogan, lokasi penampakan, nama pengamat, catatan.
- [ ] **Sanitasi Rich Text / Markdown (*Rich Content Fields*)**:
  - Hapus tag skrip dan elemen eksekusi berbahaya: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `<form>`, `<input>`.
  - Hapus semua atribut inline JavaScript / Event Handlers (`onload`, `onerror`, `onclick`, `onmouseover`, `onfocus`, dsb.).
  - Pertahankan struktur markdown murni (`#`, `##`, `*`, `**`, `-`, `1.`, `>`) yang aman.
  - *Target Form*: Deskripsi artikel, deskripsi fauna/produk, *About Us* toko, konten kebijakan (*privacy/terms*).
- [ ] **Validasi & Whitelist Protokol URL (*URL Protocol Whitelist*)**:
  - Pastikan setiap input URL hanya menggunakan skema protokol resmi yang aman: `https://`, `http://`, `mailto:`, dan `tel:`.
  - Blokir secara mutlak skema berbahaya: `javascript:`, `data:`, `vbscript:`, `file:`.
  - Khusus URL Video: Batasi hanya pada domain video resmi terpercaya (`youtube.com`, `youtu.be`).
  - *Target Form*: Link media sosial toko (Instagram, Facebook, TikTok, WhatsApp, Tokopedia, Shopee), Website resmi, Video URL fauna.
- [ ] **Validasi Nomor Telepon & WhatsApp**:
  - Hanya izinkan karakter numerik (`0-9`), tanda plus (`+`), tanda minus (`-`), dan spasi.
  - Hapus karakter alfabetis dan simbol manipulasi URL.
  - *Target Form*: Nomor WhatsApp toko, nomor kontak aduan, kontak observer.
- [ ] **Validasi Numerik & Batasan Nilai (*Numeric Bounds*)**:
  - Validasi harga produk (`price >= 0` dan tidak `NaN` / `+Inf`).
  - Validasi koordinat peta (`-90 <= latitude <= 90`, `-180 <= longitude <= 180`).
  - *Target Form*: Harga fauna/produk, koordinat penampakan fauna.

---

### 2.2 Keamanan Render & Frontend React (Anti-XSS)
- [ ] **Eliminasi Penggunaan `dangerouslySetInnerHTML`**:
  - Ganti seluruh injeksi HTML mentah pada halaman artikel, preview artikel, dan deskripsi toko dengan komponen AST parser yang aman (`FormattedText`).
  - Komponen `FormattedText` merender teks menjadi elemen React JSX (`<strong>`, `<em>`, `<h3>`, `<ul>`) sehingga otomatis terlindungi oleh proteksi *React DOM Auto-Escaping*.
- [ ] **Sanitasi Link Eksternal (*Safe Link Protocol Handler*)**:
  - Bungkus semua tautan dinamis `<a>` dengan helper `safeHref()`.
  - Jika pengguna memasukkan link `javascript:alert(1)`, otomatis dinetralisir menjadi `#` atau `about:blank`.
  - Tambahkan atribut `rel="noopener noreferrer"` dan `target="_blank"` pada semua link keluar.

---

### 2.3 Keamanan Database & Parameterized Query (Anti-SQLi)
- [ ] **100% Parameterized Query via GORM**:
  - Pastikan tidak ada penggabungan string langsung (*string concatenation*) dalam klausa query SQL (`db.Where("name = '" + input + "'")` ❌).
  - Selalu gunakan placeholder terparameter (`db.Where("LOWER(name) LIKE ?", "%"+input+"%")` ✅).
- [ ] **Pemberian Indeks & Sanitasi Pengurutan (*Safe Order By Clause*)**:
  - Whitelist parameter `sort` (hanya terima opsi valid: `id asc`, `id desc`, `name_asc`, `price_asc`, dsb.).
  - Cegah *SQL Injection* via parameter query `sort` atau `order`.

---

### 2.4 Keamanan Unggah Berkas & Gambar (File Upload Hardening)
- [ ] **Pemeriksaan Magic-Byte (*Anti-MIME Spoofing*)**:
  - Gunakan `http.DetectContentType` pada header biner file (512 byte pertama) untuk memastikan file benar-benar berformat gambar (`image/jpeg`, `image/png`, `image/webp`), bukan file `.exe` atau skrip `.php` yang diganti ekstensinya.
- [ ] **Rekonstruksi & Pembersihan Metadata EXIF (*EXIF Stripping*)**:
  - Lakukan *decode* dan *re-encode* gambar secara penuh menggunakan library pemroses gambar (`imaging.Fit`).
  - Menghilangkan data metadata lokasi GPS sensitif dan skrip tersembunyi (*polyglot payload*).
- [ ] **Penamaan Acak UUID (*Anti-Path Traversal*)**:
  - Jangan gunakan nama file asli dari pengguna.
  - Buat nama file acak menggunakan UUID v4 (`uuid.New().String() + ".jpg"`).
- [ ] **Pembatasan Ukuran Maksimal (*Payload Size Limit*)**:
  - Batasi ukuran file unggahan maksimal 10MB per gambar.
  - Batasi body request global server Fiber maksimal 12MB.

---

### 2.5 Keamanan Autentikasi, Password & Sesi (Auth Hardening)
- [ ] **Algoritma Hashing Password Standar Industri**:
  - Gunakan **Bcrypt** dengan *cost factor* 12 untuk hashing password pengguna.
  - Terapkan validasi panjang password:
    - Minimum: 8 karakter (mencegah password lemah).
    - Maksimum: 72 karakter (mencegah *Bcrypt Length Truncation Vulnerability* & *CPU DoS Attack*).
- [ ] **Validasi Email Standar RFC 5322**:
  - Periksa format email dengan ekspresi reguler standar sebelum disimpan.
  - Konversi semua email ke huruf kecil (*lowercase normalization*) untuk mencegah duplikasi akun atau bypass filter.
- [ ] **Keamanan Token JWT**:
  - Simpan secret JWT dalam environment variable, bukan di *hardcode* pada file source code.
  - Berikan masa berlaku token yang wajar (*expiry time*, misal 7 hari).
  - Terapkan pengecekan `StoreOwnerRequired` pada rute admin untuk mencegah eskalasi hak akses (*Horizontal Privilege Escalation / IDOR*).
- [ ] **Pencegahan Timing Attack**:
  - Gunakan `crypto/subtle.ConstantTimeCompare` pada perbandingan string sensitif (token/password).

---

### 2.6 Middleware Keamanan HTTP & Rate Limiting
- [ ] **HTTP Security Headers Standar SaaS**:
  - `X-Content-Type-Options: nosniff` (Mencegah *MIME-sniffing*).
  - `X-Frame-Options: SAMEORIGIN` (Mencegah serangan *Clickjacking*).
  - `X-XSS-Protection: 1; mode=block` (Proteksi XSS browser warisan).
  - `Referrer-Policy: strict-origin-when-cross-origin` (Melindungi privasi referer).
  - `Permissions-Policy: geolocation=(), camera=(), microphone=()` (Menonaktifkan akses hardware tanpa izin).
  - `Content-Security-Policy (CSP)` (Membatasi domain sumber pemuatan skrip, gambar, font, dan iframe).
- [ ] **Rate Limiting Anti-Brute Force & Anti-Spam**:
  - **Auth Rate Limiter**: Maksimal 20 percobaan per menit pada `/api/login`, `/api/register`, `/api/auth/google`.
  - **Public Form Rate Limiter**: Maksimal 15 pengiriman per menit pada form posting komentar (`/api/articles/:id/comments`) dan pelaporan penampakan (`/api/sightings`).
- [ ] **Panic Recovery Middleware**:
  - Aktifkan `recover.New()` pada Fiber untuk mencegah server *crash* akibat request malformed yang tidak terduga.

---

## 3. Fase 2: Checklist Keamanan Tingkat Server & Infrastruktur Produksi (Masa Depan)

*Bagian ini wajib diterapkan saat aplikasi dideploy ke server VPS, Dedicated Server, atau Cloud Provider (AWS / GCP / DigitalOcean / Linode).*

```mermaid
graph LR
    User([Pengguna Internet]) --> Cloudflare[Cloudflare WAF / DDoS Shield]
    Cloudflare -->|HTTPS / Port 443| Nginx[Nginx Reverse Proxy & SSL TLS 1.3]
    Nginx -->|Port 8000| GoServer[Catavor Go Backend]
    GoServer -->|Internal Unix Socket / Encrypted| Postgres[(PostgreSQL Database)]
```

### 3.1 Jaringan, Firewall & Reverse Proxy (Network & WAF)
- [ ] **Web Application Firewall (WAF) & Anti-DDoS (Contoh: Cloudflare)**:
  - Lindungi domain di balik Cloudflare (Proxy Mode Aktif).
  - Aktifkan Cloudflare Bot Management & Managed Ruleset untuk memfilter bot jahat dan serangan SQLi/XSS otomatis.
  - Sembunyikan IP publik server asal (*Origin IP Masking*).
- [ ] **Nginx Reverse Proxy Hardening**:
  - Pasang Nginx di depan aplikasi Go (`reverse proxy` ke `http://127.0.0.1:8000`).
  - Nonaktifkan token server di Nginx (`server_tokens off;`).
  - Konfigurasikan batas ukuran body di Nginx (`client_max_body_size 12M;`).
  - Atur buffer request untuk mencegah serangan *Slowloris* / *Slow HTTP Read*.
- [ ] **Firewall Server (UFW / Iptables)**:
  - Tutup semua port kecuali yang diperlukan:
    - Izinkan Port `22` (SSH - ubah ke port non-standar misal `2222`).
    - Izinkan Port `80` (HTTP - redirect ke HTTPS).
    - Izinkan Port `443` (HTTPS).
    - Blokir akses publik ke Port `8000` (aplikasi Go hanya boleh diakses via `localhost` oleh Nginx).
    - Blokir akses publik ke Port `5432` (PostgreSQL hanya boleh diakses secara lokal).

---

### 3.2 Enkripsi Komunikasi & Sertifikat SSL/TLS
- [ ] **Sertifikat SSL/TLS Otomatis (Let's Encrypt / Certbot)**:
  - Pasang sertifikat SSL dengan perpanjangan otomatis (*auto-renewal cron*).
  - Redirect otomatis semua trafik HTTP (Port 80) ke HTTPS (Port 443).
- [ ] **Pengerasan Konfigurasi TLS**:
  - Hanya izinkan protokol modern: **TLSv1.2** dan **TLSv1.3** (nonaktifkan SSLv2, SSLv3, TLS 1.0, TLS 1.1).
  - Konfigurasikan Cipher Suites yang aman (misal ECDHE-ECDSA-AES128-GCM-SHA256).
  - Aktifkan header **HSTS** (*HTTP Strict Transport Security*): `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.

---

### 3.3 Pengerasan Server & Akses SSH (Server Hardening)
- [ ] **Akses SSH Berbasis Kunci Publik (*Key-Based Authentication*)**:
  - Nonaktifkan login SSH menggunakan kata sandi (`PasswordAuthentication no`).
  - Nonaktifkan login langsung akun root (`PermitRootLogin no`).
  - Buat user khusus (*non-root*) dengan hak `sudo`.
- [ ] **Proteksi Anti-Intrusi (*Fail2ban*)**:
  - Pasang dan aktifkan `fail2ban` untuk memblokir IP yang melakukan percobaan login SSH ilegal secara berulang.
  - Integrasikan fail2ban dengan log Nginx untuk memblokir IP penyerang web scanning (misal scan `/wp-admin` atau `/.env`).
- [ ] **Pembaruan Sistem Operasi Otomatis (*Unattended Upgrades*)**:
  - Aktifkan patch keamanan otomatis pada OS Linux (Ubuntu/Debian) untuk paket-paket keamanan kernel dan dependensi dasar.

---

### 3.4 Database Hardening & Disaster Recovery (Backup)
- [ ] **Pengerasan Akses PostgreSQL**:
  - Pastikan `pg_hba.conf` hanya mengizinkan koneksi dari `127.0.0.1` atau *internal private network*.
  - Gunakan kata sandi database yang kuat (>24 karakter alfanumerik acak).
  - Buat user database dengan hak akses terbatas (*least privilege*), bukan menggunakan superuser `postgres`.
- [ ] **Strategi Backup Data Otomatis & Terenkripsi (*Automated Backups*)**:
  - Buat cron job backup harian menggunakan `pg_dump`.
  - Enkripsi file backup (menggunakan GPG/OpenSSL) sebelum diunggah ke *Offsite Cloud Storage* (misal AWS S3, Cloudflare R2, Google Cloud Storage).
  - Terapkan kebijakan retensi backup:
    - Backup Harian (disimpan 7 hari).
    - Backup Mingguan (disimpan 4 minggu).
    - Backup Bulanan (disimpan 12 bulan).
  - Lakukan uji coba pemulihan data (*Disaster Recovery Drill*) secara berkala setiap 3 bulan.

---

### 3.5 Manajemen Rahasia (*Secrets Management*) & Konfigurasi
- [ ] **Isolasi Environment Variable**:
  - Jangan pernah menyimpan file `.env` di dalam repositori Git (`.gitignore` wajib mencantumkan `.env`).
  - Gunakan permissions file ketat pada server (`chmod 600 .env` dimiliki oleh user aplikasi).
  - Pada skala enterprise, gunakan secret manager (HashiCorp Vault, AWS Secrets Manager, atau Doppler).
- [ ] **Rotasi Kunci Berkala (*Key Rotation*)**:
  - Jadwalkan rotasi rutin untuk `JWT_SECRET`, database password, dan Google OAuth Client Secret (misal setiap 6 atau 12 bulan).

---

### 3.6 Monitoring, Log Audit & Deteksi Ancaman (SIEM)
- [ ] **Logging & Error Tracking Terpusat**:
  - Integrasikan error monitoring realtime (misal **Sentry** atau **Datadog**) untuk menangkap exception runtime aplikasi secara instan.
  - Pastikan log tidak merekam data sensitif (seperti password plain text, nomor kartu, atau token otentikasi).
- [ ] **Pemantauan Ketersediaan (*Uptime Monitoring*)**:
  - Pasang pemantau uptime eksternal (misal UptimeRobot / BetterStack) dengan notifikasi Telegram/Slack/Email jika server mengalami down.
- [ ] **Log Audit SOC 2**:
  - Rekam audit log setiap kali admin mengubah kebijakan privasi, mengubah role user, atau menghapus data katalog penting.

---

### 3.7 Pipeline CI/CD & Pemindaian Kerentanan (DevSecOps)
- [ ] **Automated Dependency Scanning**:
  - Aktifkan **GitHub Dependabot** untuk mendeteksi kerentanan dependensi Go (`go.sum`) dan Node.js (`package-lock.json`).
  - Pasang alat pemindai statis keamanan (*Static Application Security Testing / SAST*):
    - `gosec` untuk memindai celah keamanan pada kode Go.
    - `npm audit` / `eslint-plugin-security` untuk kode React.
- [ ] **Zero-Downtime Deployment**:
  - Gunakan systemd service atau Docker container dengan health check untuk memastikan deploy versi baru tidak mengganggu pengguna yang sedang aktif.

---

## 4. Tabel Matriks Kesiapan Keamanan

| Lapisan Keamanan (*Layer*) | Item Keamanan | Target Eksekusi | Status / Rekomendasi |
| :--- | :--- | :--- | :--- |
| **Input & Sanitasi** | Sanitasi Seluruh Form (XSS, Injection) | **Sekarang (Lokal)** | 🟢 Diterapkan di Go Backend |
| **Frontend UI** | Safe AST Rendering (Tanpa dangerous HTML) | **Sekarang (Lokal)** | 🟢 Diterapkan di React |
| **Database** | Parameterized Queries (Anti-SQLi) | **Sekarang (Lokal)** | 🟢 Aktif via GORM |
| **Media & File** | Magic-byte MIME & EXIF Stripping | **Sekarang (Lokal)** | 🟢 Aktif di `UploadImage` |
| **Autentikasi** | Bcrypt Cost 12 & Bounds Validation | **Sekarang (Lokal)** | 🟢 Diterapkan di Auth Handler |
| **Middleware** | HTTP Headers (CSP, Frame, Sniff) | **Sekarang (Lokal)** | 🟢 Diterapkan di Fiber |
| **Anti-Abuse** | Rate Limiting Login, Register, Comments | **Sekarang (Lokal)** | 🟢 Diterapkan di Fiber Limiter |
| **Jaringan & WAF** | Cloudflare DDoS Shield & Proxy | **Masa Depan (Server)** | 🟡 Wajib saat rilis domain publik |
| **Enkripsi Data** | SSL/TLS 1.3 & Auto Let's Encrypt | **Masa Depan (Server)** | 🟡 Wajib saat setup VPS / Nginx |
| **Akses Server** | SSH Key-Only & Fail2ban | **Masa Depan (Server)** | 🟡 Konfigurasi OS Linux |
| **Disaster Recovery** | Backup Database Harian Terenkripsi | **Masa Depan (Server)** | 🟡 Setup Cron + Cloud Storage |
| **DevSecOps** | Dependabot & Gosec CI/CD Scanner | **Masa Depan (Server)** | 🟡 Integrasi GitHub Actions |

---
*Dokumen ini dibuat sebagai standar operasional prosedur (SOP) keamanan pengembangan dan operasional sistem Catavor (DFauna).*
