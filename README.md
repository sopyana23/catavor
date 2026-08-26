# 🌟 Catavor - Enterprise Multi-Tenant SaaS Digital Catalog & Commerce Platform

![Go Version](https://img.shields.io/badge/Go-1.23+-00ADD8?style=for-the-badge&logo=go&logoColor=white)
![Fiber v2](https://img.shields.io/badge/Framework-Fiber%20v2-00ACD7?style=for-the-badge&logo=gofiber&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2017-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Bundler-Vite%208-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**Catavor** (sebelumnya DFauna) adalah platform katalog usaha digital interaktif berbasis web (*Multi-Tenant SaaS*) generasi baru. Dirancang dengan antarmuka modern, elegan, dan berfokus pada foto beresolusi tinggi layaknya *online shop* modern berstandar enterprise.

Aplikasi ini ditenagai oleh backend berperforma tinggi **Golang 1.23+ (Go-Fiber v2)** dengan database **PostgreSQL 17** yang menerapkan arsitektur keamanan *Zero-Trust Isolation*, serta antarmuka reaktif **React 19 & TypeScript** dalam versi **Desktop & Mobile** menggunakan struktur **Clean Monorepo Standar Industri**.

---

## 🚀 Fitur Utama & Keunggulan

### 🏢 1. Arsitektur Multi-Tenant SaaS & Zero-Trust Isolation
* **Store Slug Mandiri**: Setiap toko/tenant memiliki URL publik tersendiri (misal: `/u/adidas`), profil bisnis, slogan, banner promosi, dan logo kustom.
* **Zero-Trust Multi-Tenant Isolation (Anti-IDOR)**: Setiap modifikasi produk, pengaturan toko, dan master kategori dilindungi validasi kepemilikan ketat berbasis JWT.
* **Two-Tier Master Data**: Pengelolaan kategori & sub-kategori kustom per toko (Kelas, Habitat/Varian, Status Ketersediaan, Jangkauan Pengiriman) dengan dukungan *master preset* instan.
* **5 Dynamic Product Types**: Mendukung katalog multi-sektor (`fauna`, `physical`, `digital`, `service`, `food`) dengan atribut dinamis tersimpan pada kolom native PostgreSQL `JSONB`.

### 💎 2. Sistem Berlangganan SaaS (Plan Free & Plan Pro)
* **Plan Free**: Gratis selamanya, batas hingga 10 postingan produk dengan *Floating SaaS Promotional Banner* otomatis.
* **Plan Pro**: Produk *unlimited*, verifikasi toko resmi, integrasi multi-channel CS WhatsApp (Direct & Rekber), tautan sosial media lengkap, serta akses penuh ke halaman **Tentang Kami (About Us)** kustom interaktif (Multi-card grid, jam operasional toko, peta lokasi, dan *disclaimer*).

### 🎟️ 3. Kupon Dinamis & Aktivasi Instan (Anti-Abandoned Account)
* **Kupon 100% Gratis** (seperti `CATAVOR100` / `GRATISPRO`): Prosedur transfer/pembayaran otomatis di-bypass, dan akun Plan Pro langsung aktif instan 1-klik tanpa menunggu verifikasi admin.
* **Kupon Diskon** (seperti `DISKON10K`): Potongan harga otomatis dihitung secara real-time pada halaman checkout.
* **Perlindungan Pembatalan Checkout**: Pembuatan akun Plan Pro ditahan (*deferred*) hingga checkout selesai, mencegah *orphan accounts* di database jika pendaftaran dibatalkan.

### 🛡️ 4. Keamanan Enterprise & Autentikasi Modern
* **JWT Algorithm Pinning**: Token JWT ditandatangani dengan algoritma aman (HMAC-SHA256) dan diproteksi dari serangan *algorithm confusion*.
* **Bcrypt Cost 12**: Hashing password dengan *constant-time comparison* untuk memitigasi *timing attacks*.
* **Anti-Brute-Force Rate Limiting**: Pembatasan request ketat pada endpoint sensitif (login, register, OAuth).
* **Google Single Sign-On (SSO)**: Pendaftaran dan login 1-klik menggunakan Google OAuth 2.0 dengan auto-provisioning profil dan toko.
* **Magic-Byte Image Validation & EXIF Stripping**: Validasi konten biner file saat upload untuk mencegah eksploitasi file berbahaya, dilengkapi kompresi otomatis WEBP/JPG kualitas 80% (maksimal lebar 1200px).

### 🎨 5. Tampilan Reaktif Desktop & Mobile (Executive Dark Slate)
* **Responsive Layouts**: Aplikasi Desktop lebar dengan panel navigasi kaca (*glassmorphism*) dan aplikasi Mobile berdesain *Executive Dark Slate* yang ramah ibu jari (*thumb-friendly*).
* **6 Glowing Theme Presets**: Preset tema visual bercahaya (Emerald, Sapphire, Amber, Ruby, Violet, Slate) dengan ikon Lucide.
* **Direct Modal Category URL Routing**: Navigasi filter kategori langsung terhubung dengan query URL peramban (`?category=...`).

### 💬 6. Integrasi Chat Multi-Channel WhatsApp
* **Automated Inquiry Message**: Tombol CTA WhatsApp secara otomatis menyusun pesan order yang memuat nama produk, harga, dan tautan katalog produk terkait.
* **Multi-CS Channel**: Pilihan saluran chat WhatsApp langsung (*Direct CS*) maupun Rekening Bersama (*Rekber*).

### 📜 7. Manajemen Kebijakan, Audit Log & Komunitas
* **Policy Versioning & Agreement Audit**: Manajemen versi Kebijakan Privasi & Syarat Ketentuan lengkap dengan pencatatan log audit persetujuan pengguna.
* **Artikel & Moderasi Komentar**: Modul artikel edukasi serta pelaporan sighting dengan sistem moderasi komentar oleh admin.

---

## 🛠️ Tech Stack

| Layer | Teknologi Utama | Keterangan |
| :--- | :--- | :--- |
| **Primary Backend** | **Golang 1.23+**, Fiber v2 | High-concurrency, low-latency, Zero-Trust architecture |
| **ORM & Database** | **GORM**, **PostgreSQL 17** | Connection pooling (50 max open), Native JSONB |
| **Auth & Security** | Golang JWT v5, Bcrypt (Cost 12), Google OAuth | Rate limiter, Magic-byte image sanitization |
| **Frontend (Desktop)** | React 19, TypeScript, Vite 8 | Lucide Icons, Executive Dark Slate CSS |
| **Frontend (Mobile)** | React 19, TypeScript, Vite 8 | Lucide Icons, Touch-optimized UX |
| **Legacy Archive** | Laravel 12, SQLite/MySQL | Diarsipkan di `legacy/laravel/` sebagai referensi |

---

## 📁 Struktur Direktori Monorepo (Industry Standard Layout)

```text
catavor/
├── backend/                      # [UTAMA] Backend Golang 1.23+ (Go-Fiber v2 + GORM + PostgreSQL)
│   ├── cmd/
│   │   └── server/               # Entrypoint aplikasi server (main.go)
│   ├── internal/                 # Package private aplikasi (Standard Go Layout)
│   │   ├── config/               # Parsing environment & konfigurasi
│   │   ├── database/             # Koneksi DB PostgreSQL, GORM migration & auto-importer
│   │   ├── handlers/             # REST API Handlers (Auth, Store, Fauna, Setting, SPA)
│   │   ├── middleware/           # Security headers, JWT Auth, Tenant isolation, Rate limiter
│   │   └── models/               # GORM struct models & JSONB data types
│   ├── storage/                  # Direktori penyimpanan mandiri file uploads
│   │   └── uploads/
│   ├── .env.example              # Template environment backend
│   ├── go.mod
│   └── go.sum
├── frontend/                     # Monorepo Aplikasi Web Frontend (React 19 + TypeScript + Vite)
│   ├── desktop/                  # Web App Frontend Desktop
│   │   ├── src/
│   │   ├── package.json
│   │   └── vite.config.ts
│   └── mobile/                   # Web App Frontend Mobile
│       ├── src/
│       ├── package.json
│       └── vite.config.ts
├── public/                       # Direktori aset statis & hasil kompilasi frontend terpusat
│   ├── desktop/                  # Bundle statis frontend desktop
│   ├── mobile/                   # Bundle statis frontend mobile
│   └── storage/                  # File gambar produk & logo katalog
├── scripts/                      # Script otomatisasi DevOps & Build
│   ├── build-all.ps1             # Kompilasi frontend desktop & mobile ke public/
│   └── build-backend.ps1         # Kompilasi binary Go standalone untuk produksi
├── legacy/                       # Arsip cadangan (Diabaikan oleh GitHub Linguist)
│   └── laravel/                  # Backend Laravel 12 versi terdahulu
├── .gitattributes                # Konfigurasi Linguist (100% Go & TypeScript)
├── .gitignore                    # Standard ignore file
└── README.md                     # Dokumentasi resmi repositori
```

---

## 💻 Panduan Instalasi & Menjalankan (Golang + PostgreSQL)

### 1. Prasyarat Sistem
* **Go** >= 1.23 (`go version`)
* **PostgreSQL** >= 16/17 (Pastikan service PostgreSQL berjalan)
* **Node.js** >= 20.x & **npm**
* **Git**

---

### 2. Kloning Repositori
```bash
git clone https://github.com/sopyana23/catavor.git
cd catavor
```

---

### 3. Setup Database PostgreSQL
Buat database baru di PostgreSQL Anda (misalnya melalui `psql` atau pgAdmin):
```sql
CREATE DATABASE catavor;
```

---

### 4. Konfigurasi Environment Backend Go
Masuk ke folder `backend` dan salin file `.env.example`:
```bash
cd backend
cp .env.example .env
```
Sesuaikan konfigurasi pada file `backend/.env`:
```env
APP_ENV=local
PORT=8000
APP_URL=http://localhost:8000
ALLOWED_ORIGINS=*

DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=catavor
DB_SSLMODE=disable

JWT_SECRET=catavor_super_secret_jwt_key_2026_enterprise_saas

STORAGE_DIR=../public/storage
DESKTOP_DIST_DIR=../public/desktop
MOBILE_DIST_DIR=../public/mobile

GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

---

### 5. Kompilasi Bundle Frontend (Desktop & Mobile)
Jalankan script otomatis dari root folder proyek:
```powershell
# Windows PowerShell
powershell -ExecutionPolicy Bypass -File .\scripts\build-all.ps1
```
*Script ini akan mem-build `frontend/desktop` dan `frontend/mobile`, lalu menempatkan bundle statisnya ke dalam folder `public/desktop` dan `public/mobile`.*

---

### 6. Jalankan Server Backend Golang
Masuk ke folder `backend` dan jalankan:
```bash
cd backend
go run ./cmd/server/main.go
```

> [!NOTE]
> **Otomatisasi Database**: Saat pertama kali server Golang dijalankan:
> 1. GORM akan otomatis melakukan **Auto-Migration** untuk seluruh tabel PostgreSQL.
> 2. Jika terdapat file database SQLite lama di `legacy/laravel/database/database.sqlite`, sistem akan **mengimpor data secara otomatis** ke PostgreSQL.
> 3. Jika database kosong, sistem akan menginisialisasi akun admin & toko contoh (*Adidas Store*) secara otomatis.

---

### 7. Akses Aplikasi
* **Toko Demo**: [http://localhost:8000/u/adidas](http://localhost:8000/u/adidas)
* **Katalog Utama**: [http://localhost:8000](http://localhost:8000)
* **Dashboard Admin**: [http://localhost:8000/admin](http://localhost:8000/admin)

#### Kredensial Default Admin:
* **Email**: `admin@catavor.com`
* **Password**: `password`

---

## ⚡ Mode Development (Live Hot-Reload)

Jika Anda ingin melakukan pengembangan antarmuka secara langsung dengan fitur Vite Hot Module Replacement (HMR):

1. **Jalankan Backend Go**:
   ```bash
   cd backend
   go run ./cmd/server/main.go
   ```
2. **Jalankan Frontend Desktop**:
   ```bash
   cd frontend/desktop
   npm install
   npm run dev
   ```
3. **Jalankan Frontend Mobile**:
   ```bash
   cd frontend/mobile
   npm install
   npm run dev
   ```

---

## 📦 Build Binary Produksi (Golang)

Untuk mengompilasi server Go menjadi satu file *binary standalone* berperforma tinggi:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-backend.ps1
```
Hasil kompilasi berupa file `backend/catavor-server.exe` (atau binary Linux untuk server target) yang siap dijalankan dengan konsumsi memori sangat hemat (< 30 MB RAM).

---

## 🌐 Panduan Deployment Server (VPS / Docker)
1. Build binary untuk OS target (misal Linux: `cd backend && GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o catavor-server ./cmd/server/main.go`).
2. Build frontend dengan `.\scripts\build-all.ps1`.
3. Upload binary `catavor-server`, folder `public/`, dan file `.env` ke server VPS.
4. Pasang `systemd` service atau Docker container untuk menjalankan `catavor-server` di belakang reverse proxy **Nginx / Caddy** (dengan SSL HTTPS).

---

## 🔌 Ringkasan API Endpoints

| Metode | Endpoint | Akses | Deskripsi |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/fauna` | Publik | Mengambil semua item katalog produk |
| `GET` | `/api/fauna/:id` | Publik | Mengambil detail spesifik satu item |
| `GET` | `/api/stores/featured` | Publik | Mengambil daftar toko unggulan |
| `GET` | `/api/check-slug/:slug` | Publik | Memeriksa ketersediaan slug toko |
| `GET` | `/api/u/:slug` | Publik | Mengambil profil dan data toko berdasarkan slug |
| `GET` | `/api/u/:slug/fauna` | Publik | Mengambil daftar item katalog milik toko tertentu |
| `POST` | `/api/login` | Publik (Rate-limited) | Autentikasi user & generate JWT Token |
| `POST` | `/api/register` | Publik (Rate-limited) | Registrasi pengguna & toko baru |
| `POST` | `/api/auth/google` | Publik (Rate-limited) | Google Single Sign-On OAuth |
| `POST` | `/api/logout` | Guarded (JWT) | Invalidate sesi user |
| `POST` | `/api/profile` | Guarded (JWT) | Memperbarui profil dan password user |
| `POST` | `/api/upload-image` | Guarded (JWT) | Upload & sanitasi gambar katalog |
| `POST` | `/api/fauna` | Guarded (JWT) | Menambah produk baru ke katalog toko |
| `PUT` | `/api/fauna/:id` | Guarded (JWT) | Memperbarui data produk |
| `DELETE` | `/api/fauna/:id` | Guarded (JWT) | Menghapus produk dari katalog |
| `POST` | `/api/stores/update` | Guarded (JWT) | Memperbarui identitas, tema, & info toko |
| `POST` | `/api/stores/upgrade-plan` | Guarded (JWT) | Upgrade paket langganan (Free/Pro/Kupon) |
| `POST` | `/api/stores/apply-master-preset` | Guarded (JWT) | Menerapkan preset kategori master |
| `GET` | `/api/settings/policies` | Publik | Mengambil versi kebijakan dan ketentuan |
| `POST` | `/api/policies/agree` | Publik | Mencatat persetujuan user terhadap kebijakan |

---

## 📝 Lisensi

Proyek ini dirilis di bawah lisensi [MIT License](LICENSE).
Dikembangkan untuk mendukung digitalisasi UMKM dan bisnis modern di Indonesia.
