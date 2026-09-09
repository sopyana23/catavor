# 📘 CATAVOR DEVELOPER & AI AGENT HANDOFF DOCUMENTATION

Dokumen ini adalah **panduan lengkap serah terima (handoff)** untuk developer atau agen AI penerus agar dapat langsung memahami seluruh arsitektur, fitur yang telah selesai, standar keamanan, alur kerja, dan cara melanjutkan pengembangan platform **Catavor**.

---

## 🏛️ 1. Identitas Proyek & Arsitektur Sistem

- **Nama Platform**: **Catavor** (Interactive Digital Catalog, Biolink, & Multi-Channel Commerce Engine).
- **Repositori Git**: `https://github.com/sopyana23/catavor.git`
- **Branch Utama**:
  - `dev`: Branch pengembangan aktif (*currently active*).
  - `main`: Branch produksi / rilis stabil.
- **Teknologi Utama**:
  - **Backend**: Golang 1.23+ dengan framework **Fiber v2**, ORM **GORM**, dan database **PostgreSQL**.
  - **Frontend**: React 18 + TypeScript + Vite.
    - `frontend/desktop/`: SPA khusus layar Desktop & Tablet (output build: `public/desktop/`).
    - `frontend/mobile/`: SPA khusus layar Mobile / Smartphone (output build: `public/mobile/`).
  - **Routing Multi-Tenant**: Dynamic Subdomain / Path (`/:slug/admin`, `/u/:slug`, `/u/:slug/products`, dsb).
  - **Real-Time Engine**: Server-Sent Events (SSE) Hub terintegrasi di Go backend.

---

## 📦 2. Status Fitur & Pekerjaan yang Telah Selesai (Completed Features)

### A. Sistem Notifikasi Enterprise (Dynamic Database & Real-Time)
- **Persistensi Database Penuh**:
  - Tabel `notifications` & `notification_reads` di PostgreSQL.
  - Sekali dibaca (`Mark as Read` atau `Tandai Semua Dibaca`), status baca dicatat di `notification_reads` dan **tetap persisten** saat browser di-refresh.
- **Superadmin Broadcast (Hybrid Pattern - Hemat Storage)**:
  - Superadmin dapat mengirim notifikasi broadcast ke target dinamis (`all`, `plan` dengan kode dinamis seperti `free`, `pro_starter`, `pro_business`, atau toko tertentu).
  - 1 pengumuman ke ribuan user hanya memakan **1 baris data**.
- **Real-Time Delivery (SSE Hub)**:
  - Endpoint `/api/notifications/stream` mengalirkan notifikasi baru secara langsung ke browser merchant aktif seketika tanpa refresh.
- **Auto-Cleanup Retention Worker**:
  - Background Goroutine Worker (`services.StartNotificationCleaner`) membersihkan notifikasi yang kedaluwarsa (`expires_at`) atau yang telah melewati masa retensi setelah dibaca (`retention_hours`).
- **UI/UX Notifikasi Premium**:
  - Judul lengkap tanpa pemotongan teks (*no ellipsis truncation*).
  - Desain elegan tanpa ikon kotak generik / emoji, diganti dengan *Category Badges* (`PANDUAN`, `PROMOSI`, `INVENTARIS`, `SISTEM`, `KEAMANAN`).
  - Halaman detail notifikasi penuh (*Full Page Detail View*) dengan tombol aksi langsung.

### B. Menu & Navigasi Admin Dashboard
- **Standardisasi Terminologi**: Mengganti kata generic `"Toko"` menjadi `"Katalog"` / `"Profil Katalog"` di menu pengguna.
- **Header Action Dropdown**: Menggabungkan tombol "Bagikan" dan "Keluar/Logout" ke dalam menu dropdown (`MoreVertical`).
- **Dynamic Type Switcher**: Badge kategori/tipe produk hanya muncul jika toko memiliki lebih dari 1 jenis produk (`distinctTypesCount > 1`).
- **Pembersihan Subtitle**: Subtitle profil menampilkan nama paket langganan aktif (misal `PRO BISNIS`) tanpa hitungan toko yang redundan.

### C. Manajemen Multi-Tenant & Subscription Plans
- Model dinamis `SubscriptionPlan` (`free`, `pro_starter`, `pro_business`).
- Kuota penyimpanan, batas jumlah produk, custom domain, dan badge verifikasi terintegrasi otomatis.
- Lifecycle worker otomatis untuk masa tenggang (*grace period*) dan kedaluwarsa langganan.

### D. Katalog Produk & Multi-Channel Sales
- Dukungan varian produk, multi-gambar, galeri foto, kategori bertingkat.
- Tombol integrasi pesanan WhatsApp Direct, Rekber, dan tautan Global Marketplace.

---

## 🛡️ 3. Standar & Arsitektur Keamanan (Security Highlights)

1. **Autentikasi & Otorisasi Ketat**:
   - JWT Token dengan algoritma HMAC-SHA256.
   - Middleware `AuthRequired` dan `StoreOwnerRequired` memvalidasi kepemilikan toko di setiap permintaan admin/merchant.
2. **Proteksi Injeksi SQL & Parameterized Queries**:
   - Seluruh kueri backend menggunakan prepared statements & parameter GORM (`?` placeholders).
3. **XSS Sanitization**:
   - Modul `security.SanitizeHTML` membersihkan input teks dan deskripsi dari script berbahaya.
4. **Rate Limiting**:
   - `AuthRateLimiter` pada endpoint login/register untuk mencegah *brute-force*.
   - `PublicSubmissionRateLimiter` pada formulir publik (komentar, laporan, analitik).
5. **Connection Pool Database**:
   - Batasan `MaxOpenConns(50)` dan `MaxIdleConns(10)` untuk menjaga stabilitas memori database server.

---

## 🚀 4. Panduan Menjalankan & Menguji Proyek (Quick Commands)

### Build Frontend (Desktop & Mobile)
```powershell
powershell -ExecutionPolicy Bypass -File .\build-all.ps1
```

### Build & Jalankan Backend Go
```powershell
# Build binary
cd backend
go build -o ..\catavor-server.exe .\cmd\server
cd ..

# Jalankan server
.\catavor-server.exe
```

### Konfigurasi Environment (`.env`)
Pastikan variabel database dan JWT terisi di file `.env`:
```env
APP_ENV=local
PORT=8000
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=catavor_db
JWT_SECRET=your_jwt_secret_key
DB_AUTO_MIGRATE=false
```

---

## 📌 5. Rekomendasi Langkah Selanjutnya untuk Agen Penerus

1. **Fitur Pengingat Setup Dinamis (Setup Checklist)**:
   - Membuat widget kartu progress di dashboard menu ("Langkah Menyiapkan Katalog: 2/4") yang dinamis membaca data riil toko (misal: jika alamat belum diisi, checklist belum centang; jika sudah diisi, otomatis centang selesai).
2. **Superadmin Broadcast GUI**:
   - Menyediakan form GUI visual di panel Superadmin untuk memicu `POST /api/admin/notifications/broadcast` dengan pemilihan target plan secara interaktif.
3. **Push to Main (Production Release)**:
   - Jika semua fitur di `dev` siap dirilis ke publik, merge `dev` ke `main` dan deploy binary `catavor-server.exe`.

---
*Dokumen ini dibuat otomatis sebagai panduan resmi serah terima sesi kerja platform Catavor.*
