# 🚀 Catavor (DFauna) — Comprehensive AI & Developer Handoff Document

> **Dokumen Transisi Proyek untuk AI Assistant & Pengembang**  
> *Terakhir diperbarui: 13 September 2026*  
> *Cabang Aktif:* `dev`

---

## 📌 1. Ringkasan Eksekutif & Tujuan Proyek

**Catavor** (nama internal repositori: `DFauna`) adalah platform direktori katalog bisnis, usaha, fauna/flora, dan produk merchant multi-tenant terpadu. Sistem ini menyediakan antarmuka terpisah untuk:
1. **Publik & Pengunjung**: Menjelajah direktori toko, fauna, produk, serta mengirimkan tiket keluhan/bantuan.
2. **Admin Katalog (Merchant / Owner Toko)**: Mengelola katalog produk, jam buka, galeri, order, serta ruang percakapan tiket bantuan (Helpdesk) dengan staf platform.
3. **Admin Pengelola Platform / Super Admin**: Portal internal multi-divisi berbasis RBAC (Role-Based Access Control) yang mengelola:
   - **Overview & Statistik**: Metrik transaksi, dormancy toko, laporan kepatuhan, tiket support.
   - **RBAC Management**: Pengaturan izin staf (*Role & Permission Management*).
   - **Kepatuhan & Laporan (*Compliance*)**: Moderasi laporan toko bermasalah dan metrik toko pasif.
   - **Helpdesk & Tiket (*Support*)**: Ruang chat thread real-time dua arah antara staf CS dan merchant/user, lengkap dengan catatan internal (*Internal Note*) dan lampiran foto.
   - **Keuangan & Order (*Finance*)**: Verifikasi bukti pembayaran (*proof of payment*) paket langganan toko (*PRO/Enterprise*).
   - **Konten & Editorial (*Content*)**: Pengiriman siaran (*Broadcast Notification*) global ke seluruh pengguna.

---

## 🛠️ 2. Tech Stack & Arsitektur Sistem

| Layer | Teknologi | Keterangan |
|---|---|---|
| **Backend** | Go (Golang) + Fiber Framework | REST API berperforma tinggi, GORM ORM, JWT Auth, static file serving. |
| **Database** | SQLite (Dev) / PostgreSQL (Prod) | Auto-migrasi skema melalui GORM. |
| **Frontend Mobile** | React 18 + TypeScript + Vite | Dibangun di `frontend/mobile`, output build ke `public/mobile`. |
| **Frontend Desktop** | React 18 + TypeScript + Vite | Dibangun di `frontend/desktop`, output build ke `public/desktop`. |
| **Styling** | Vanilla CSS + CSS Variables + Glassmorphism | Dark & Light mode adaptif, HSL dynamic palettes, no heavy UI framework. |
| **Icons** | Lucide React | Ikon modern, seragam, dan elegan. |

---

## 🔑 3. Kredensial Pengujian & Akun Standar

- **Super Admin Platform**:
  - URL: `http://localhost:8000/catavor/admin`
  - Email: `admin@catavor.com`
  - Password: `password123`
- **Merchant Demo**:
  - URL: `http://localhost:8000/catavor/login` atau `http://localhost:8000/`
  - Toko / Store Slug: `catavor-official` atau toko hasil registrasi baru.

---

## 🌟 4. Fitur & Pembaruan Terkini yang Baru Selesai

### A. Perbaikan Header Sticky Shaking / Jitter
- **Masalah**: Header di halaman admin platform mengalami getar saat di-scroll pada posisi tertentu karena konflik `sticky` dengan wrapper layout.
- **Solusi**: Diterapkan `position: sticky; top: 0; zIndex: 100; backdrop-filter: blur(12px); transform: translateZ(0); will-change: transform` pada kontainer utama tanpa nested overflow glitch.

### B. Ruang Percakapan Chat Interaktif Helpdesk Platform Admin
- Staf CS / Super Admin kini dapat membuka ruang chat detail dari setiap tiket (`selectedTicket`).
- **Sistem Dual-Mode Composer**:
  - **Mode Balas Merchant**: Mengirim balasan resmi langsung ke pengguna/merchant.
  - **Mode Catatan Internal CS**: Catatan rahasia bergaris putus-putus kuning yang hanya terlihat oleh staf admin internal dan tidak dikirimkan ke merchant.
- **Pembersihan Tombol Komposer**: Tombol "Kirim & Selesaikan" dihapus sesuai permintaan user agar tampilan rapi, bersih, dan profesional dengan hanya 1 tombol kirim adaptif.

### C. Penekanan Footer Navigasi pada Sub-Halaman
- Pada portal mobile (`PlatformRolePortal.tsx`), variabel `isSubPage` mendeteksi jika admin sedang masuk ke sub-modul atau room chat (`selectedTicket !== null` atau `selectedProofOrder !== null`).
- `<nav className="bottom-nav">` secara otomatis disembunyikan saat berada di sub-halaman agar ruang baca maksimal dan fokus.

### D. Kesetaraan Tampilan Lightbox Galeri Foto (Identik dengan Admin Katalog)
- Tampilan detail foto/lampiran saat diklik di Admin Platform kini **100% identik** dengan `App.tsx` (Admin Katalog):
  - **Header Bar Atas**: Badge counter `{currentIdx + 1} / {total} Foto`, nama lampiran, tombol download (`Download`), tombol buka file asli tab baru (`ExternalLink`), dan tombol tutup (`X`).
  - **Kanvas Tengah Interaktif**: Dukungan **Zoom & Pan**, geser mouse/touch, double-click untuk zoom in/out, tombol prev/next navigasi.
  - **Toolbar Bawah**: Pill zoom controls (`ZoomOut`, persentase `%`, `ZoomIn`, `Reset`) dan filmstrip bar preview gambar berjejer di bagian bawah.
  - **Aksesibilitas**: Keyboard navigation (`Enter`, `Space`, `Esc`, `tabIndex={0}`, `role="button"`).
  - Terpasang pada lampiran pertanyaan tiket, lampiran bubble chat, serta bukti pembayaran transfer (*payment proof*).

---

## 📂 5. Peta File Kunci & Struktur Repositori

```text
DFauna/
├── backend/
│   ├── cmd/server/main.go                     # Entry point server Go & routing registrasi API
│   ├── internal/
│   │   ├── handlers/
│   │   │   ├── support_handler.go             # Handler tiket support, chat thread, reply, status, attachment upload
│   │   │   ├── rbac_handler.go                # Handler RBAC & manajemen hak akses pengguna
│   │   │   ├── compliance_handler.go          # Handler pelaporan toko & dormancy
│   │   │   └── finance_handler.go             # Handler pesanan paket & verifikasi bukti transfer
│   │   └── models/
│   │       ├── support.go                     # Model SupportTicket, SupportMessage, TicketAttachment
│   │       ├── rbac.go                        # Model PlatformRole, Permission, RolePermission
│   │       └── subscription.go                # Model SubscriptionOrder
├── frontend/
│   ├── mobile/
│   │   └── src/
│   │       ├── App.tsx                        # Aplikasi Utama Mobile & Admin Katalog Merchant
│   │       └── components/
│   │           ├── PlatformRolePortal.tsx     # Portal Super Admin & Staf Divisi Mobile (Helpdesk, Compliance, Finance, RBAC)
│   │           └── AdminRBACManagement.tsx    # Manajemen RBAC Mobile
│   └── desktop/
│       └── src/
│           ├── App.tsx                        # Aplikasi Utama Desktop & Admin Katalog Merchant
│           └── components/
│               ├── PlatformRolePortal.tsx     # Portal Super Admin & Staf Divisi Desktop
│               └── AdminRBACManagement.tsx    # Manajemen RBAC Desktop
├── public/                                    # Static bundle output yang disajikan oleh Go backend
│   ├── mobile/
│   └── desktop/
└── HANDOFF.md                                 # Dokumen ini
```

---

## ⚙️ 6. Cara Menjalankan & Membangun Proyek

### 1. Menjalankan Backend (Go Server)
```bash
cd c:/MyProject/DFauna/backend
go run cmd/server/main.go
# Server berjalan di port 8000 (http://localhost:8000)
```

### 2. Membangun Frontend Mobile & Desktop
```bash
# Build Mobile Frontend
cd c:/MyProject/DFauna/frontend/mobile
npm run build

# Build Desktop Frontend
cd c:/MyProject/DFauna/frontend/desktop
npm run build
```

---

## 🛡️ 7. Panduan & Aturan untuk AI / Pengembang Selanjutnya

1. **Jaga Konsistensi Desain**:
   - Pertahankan estetika premium, elegan, clean, dan profesional.
   - Hindari icon/komponen dekoratif yang berlebihan (*avoid AI-generated looking clutters*).
   - Selalu pertahankan keselarasan antara versi Mobile (`frontend/mobile`) dan Desktop (`frontend/desktop`).
2. **Kustomisasi & RBAC**:
   - Cek permission user menggunakan helper `hasPermission(currentUser, 'permission_name')` dan `isSuperAdmin(currentUser)`.
3. **Build Verifikasi**:
   - Selalu pastikan `npm run build` berhasil (exit code 0) di kedua direktori frontend sebelum menyelesaikan task.
