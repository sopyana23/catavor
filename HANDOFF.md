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

### A. Sistem Notifikasi Enterprise (Dynamic Database, Paging & Real-Time)
- **Persistensi Database Penuh**:
  - Tabel `notifications` & `notification_reads` di PostgreSQL.
  - Status dibaca dicatat per-user dan **tetap persisten** saat browser di-refresh.
- **Server-Side Pagination & Infinite Scroll**:
  - Endpoint `GET /api/notifications?page=1&limit=10&filter=all|unread`.
  - Frontend Mobile & Desktop menggunakan `IntersectionObserver` sentinel untuk memuat data bertahap secara mulus (*infinite scroll*) tanpa flicker atau lonjakan scroll.
- **Superadmin Broadcast (Hybrid Pattern - Hemat Storage)**:
  - Superadmin dapat mengirim notifikasi broadcast ke target dinamis (`all`, `plan` dengan kode dinamis seperti `free`, `pro_starter`, `pro_business`, atau toko tertentu).
- **Real-Time Delivery (SSE Hub)**:
  - Endpoint `/api/notifications/stream` mengalirkan notifikasi baru secara langsung ke browser merchant aktif seketika tanpa refresh.
- **Auto-Cleanup Retention Worker**:
  - Background Goroutine Worker (`services.StartNotificationCleaner`) membersihkan notifikasi yang kedaluwarsa (`expires_at`) atau yang telah melewati masa retensi setelah dibaca (`retention_hours`).

### B. Inactivity Lifecycle & Store Dormancy Management
- **Background Dormancy Worker (`services.StartDormancyWorker`)**:
  - Memantau keaktifan toko Free Tier setiap 1 jam secara otomatis.
  - **H+30**: Peringatan awal (`warning_1`) via notifikasi & email.
  - **H+38**: Peringatan kritis 7 hari menjelang suspend (`warning_2`).
  - **H+45**: Katalog disuspend sementara (`suspended`) dan disembunyikan dari publik.
  - **H+60**: Pembersihan data otomatis jika tidak ada reaktivasi.
- **Reaktivasi Instan & Perpanjangan Masa Aktif**:
  - Tombol *"Perpanjang Masa Aktif Katalog"* di dashboard (`POST /api/stores/extend-activity`).
  - Magic link via email reaktivasi instan (`GET /api/auth/reactivate-store?token=...`).

### C. Rich Textarea Fullscreen Editor & Formatted Text
- **Form "Tentang Kami" (Deskripsi Profil Lengkap)**:
  - Komponen `<RichTextarea>` dengan mode layar penuh (*fullscreen with live split preview*), toolbar tebal, miring, heading, bullet list, numbered list, checklist, dan link.
- **Form "Kontak & Saluran Resmi" (Lokasi / Alamat Resmi)**:
  - Komponen `<RichTextarea>` yang sama persis, mempermudah merchant menyusun alamat multi-baris, instruksi rute, atau tautan peta.
- **Halaman Publik**:
  - Merender data menggunakan komponen `<FormattedText>` (berstandar markdown rapi).
- **Sanitasi Backend**:
  - Menggunakan `SanitizeRichText` untuk melindungi dari XSS tanpa merusak format teks.

---

## 🛡️ 3. Standar & Arsitektur Keamanan (Security Highlights)

1. **Autentikasi & Otorisasi Ketat**:
   - JWT Token dengan algoritma HMAC-SHA256.
   - Middleware `AuthRequired` dan `StoreOwnerRequired` memvalidasi kepemilikan toko di setiap permintaan admin/merchant.
2. **Proteksi Injeksi SQL & Parameterized Queries**:
   - Seluruh kueri backend menggunakan prepared statements & parameter GORM (`?` placeholders).
3. **XSS Sanitization**:
   - Modul `security.SanitizeRichText` dan `security.SanitizePlainText` membersihkan input berbahaya secara komprehensif.
4. **Rate Limiting**:
   - `AuthRateLimiter` pada endpoint login/register.
   - `PublicSubmissionRateLimiter` pada formulir publik.
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
go build -o ..\catavor-server.exe .\cmd\server\main.go
cd ..

# Jalankan server
.\catavor-server.exe
```

---

## 📌 5. Rekomendasi Langkah Selanjutnya untuk Agen Penerus

1. **Superadmin Broadcast GUI**:
   - Menambahkan visual modal/form di panel Superadmin untuk memicu broadcast notifikasi secara interaktif.
2. **Setup Checklist Widget**:
   - Melengkapi widget progress onboarding pada dashboard utama yang membaca data riil kelengkapan profil toko.
