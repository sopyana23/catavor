# Audit Deep-Link Konsol Pengelola (Admin Pengelola Platform)

Dibuat: 2026-10-25T12:11:07.821Z
Login: 200 — Login berhasil. (e2e-admin@catavor.test)

## 1. Matriks alias ?tab= → view yang benar-benar dirender

Nilai "JATUH KE DASHBOARD" berarti alias diabaikan (bukan modulnya).

| ?tab= | Desktop | Tablet | Mobile | Selaras? |
|---|---|---|---|---|
| dashboard | *(dashboard)* | *(dashboard)* | *(dashboard)* | SERAGAM GAGAL |
| rbac | Staf & Role RBAC | Staf & Role RBAC | Staf & RBAC | **BEDA** |
| staff | Staf & Role RBAC | Staf & Role RBAC | Staf & RBAC | **BEDA** |
| roles | Staf & Role RBAC | Staf & Role RBAC | Staf & RBAC | **BEDA** |
| stores | Tata Kelola Merchant & Dormansi | Tata Kelola Profil Merchant | Tata Kelola Toko | **BEDA** |
| reports | Kepatuhan & Laporan Masyarakat | Kepatuhan & Laporan Masyarakat | Laporan Masuk | **BEDA** |
| support | Pusat Bantuan & Helpdesk | Pusat Bantuan & Helpdesk CS | Helpdesk Tiket | **BEDA** |
| helpdesk | Pusat Bantuan & Helpdesk | Pusat Bantuan & Helpdesk CS | Helpdesk Tiket | **BEDA** |
| finance | Keuangan & Billing Langganan | Keuangan & Verifikasi Billing | Keuangan & Order | **BEDA** |
| monetization | Monetisasi & Integrasi Google | Monetisasi & Integrasi Google | Monetisasi & Iklan | **BEDA** |
| broadcast | Siaran Broadcast Notifikasi | Siaran Broadcast Pengumuman | Siaran Broadcast | **BEDA** |
| automation | Mesin Otomatisasi & Cron Bot | Mesin Otomatisasi & Bot Worker | Mesin Otomatisasi | **BEDA** |
| bot | Mesin Otomatisasi & Cron Bot | Mesin Otomatisasi & Bot Worker | Mesin Otomatisasi | **BEDA** |
| master_data | Master Data, Domain & Rekber | Master Data & Proteksi Rekber | Data Master Platform | **BEDA** |
| master-data | Master Data, Domain & Rekber | Master Data & Proteksi Rekber | Data Master Platform | **BEDA** |
| domains | Master Data, Domain & Rekber | Master Data & Proteksi Rekber | Master Domain Aman | **BEDA** |
| audit | System-Wide Audit Trail | System-Wide Audit Trail | Audit Trail | **BEDA** |
| safe_domains | Master Data, Domain & Rekber | Master Data & Proteksi Rekber | Master Domain Aman | **BEDA** |
| tidak-ada-modul-ini | *(dashboard)* | *(dashboard)* | *(dashboard)* | OK (kontrol) |

## 2. Inventaris modul yang dapat dijangkau dari UI

### desktop

- Heading: Ringkasan Platform
- Nav aktif: (kosong)
- Label modul terdeteksi (14): Dashboard · Staf & RBAC · Direktori Merchant · Kepatuhan & Laporan · Tiket Bantuan · Keuangan & Billing · Siaran Broadcast · Mesin Otomatisasi · Monetisasi & Ads · Master Data & Rekber · Audit Trail Sistem · Mode Terang · Keluar Portal · Segarkan

### tablet

- Heading: Ringkasan Eksekutif Platform
- Nav aktif: (kosong)
- Label modul terdeteksi (1): Segarkan

### mobile

- Heading: Catavor Executive
- Nav aktif: (kosong)
- Label modul terdeteksi (4): Ringkasan · Laporan · Helpdesk · Keuangan

## 3. Detail per alias (heading + 120 karakter awal)

### ?tab=dashboard

- **desktop**: Ringkasan Platform — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: Ringkasan Eksekutif Platform — C Tablet Executive Console • Super Admin Ringkasan Eksekutif Platform Segarkan Super Admin Status Operasional 
- **mobile**: Catavor Executive — Catavor Executive Super Admin e2e-admin@catavor.test TOKO 1 ORDER 0 LAPORAN 0 TIKET 0 Perlu Tindakan Administr

### ?tab=rbac

- **desktop**: Staf & Role RBAC — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: Staf & Role RBAC — C Tablet Executive Console • Super Admin Staf & Role RBAC Segarkan Super Admin Daftar Staf Matriks Izin Buat R
- **mobile**: Staf & RBAC — Staf & RBAC Matriks & Izin Staf Daftar Staf Matriks Izin Buat Role Tugaskan E E2E Admin e2e-admin@catavor.test

### ?tab=staff

- **desktop**: Staf & Role RBAC — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: Staf & Role RBAC — C Tablet Executive Console • Super Admin Staf & Role RBAC Segarkan Super Admin Daftar Staf Matriks Izin Buat R
- **mobile**: Staf & RBAC — Staf & RBAC Matriks & Izin Staf Daftar Staf Matriks Izin Buat Role Tugaskan E E2E Admin e2e-admin@catavor.test

### ?tab=roles

- **desktop**: Staf & Role RBAC — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: Staf & Role RBAC — C Tablet Executive Console • Super Admin Staf & Role RBAC Segarkan Super Admin Daftar Staf Matriks Izin Buat R
- **mobile**: Staf & RBAC — Staf & RBAC Matriks & Izin Staf Daftar Staf Matriks Izin Buat Role Tugaskan E E2E Admin e2e-admin@catavor.test

### ?tab=stores

- **desktop**: Tata Kelola Merchant & Dormansi — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: Tata Kelola Profil Merchant — C Tablet Executive Console • Super Admin Tata Kelola Profil Merchant Segarkan Super Admin Profil Merchant Akti
- **mobile**: Tata Kelola Toko — Tata Kelola Toko 1 Toko Terdaftar Profil Aktif 5 Banned / Suspend 0 Aktif (5) Pelanggaran (0) Filter Detail Ka

### ?tab=reports

- **desktop**: Kepatuhan & Laporan Masyarakat — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: Kepatuhan & Laporan Masyarakat — C Tablet Executive Console • Super Admin Kepatuhan & Laporan Masyarakat Segarkan Super Admin Menunggu 0 Invest
- **mobile**: Laporan Masuk — Laporan Masuk 0 Laporan Pending Menunggu 0 Investigasi 0 Sanksi Aktif 0 Banned 0 Semua 0 Menunggu 0 Investigas

### ?tab=support

- **desktop**: Pusat Bantuan & Helpdesk — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: Pusat Bantuan & Helpdesk CS — C Tablet Executive Console • Super Admin Pusat Bantuan & Helpdesk CS Segarkan Super Admin Semua 0 Perlu Respon
- **mobile**: Helpdesk Tiket — Helpdesk Tiket 0 Total Tiket Semua 0 Perlu Respon 0 Diproses 0 Tunggu Merchant 0 Urgent 0 Selesai 0 Semua Kate

### ?tab=helpdesk

- **desktop**: Pusat Bantuan & Helpdesk — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: Pusat Bantuan & Helpdesk CS — C Tablet Executive Console • Super Admin Pusat Bantuan & Helpdesk CS Segarkan Super Admin Semua 0 Perlu Respon
- **mobile**: Helpdesk Tiket — Helpdesk Tiket 0 Total Tiket Semua 0 Perlu Respon 0 Diproses 0 Tunggu Merchant 0 Urgent 0 Selesai 0 Semua Kate

### ?tab=finance

- **desktop**: Keuangan & Billing Langganan — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: Keuangan & Verifikasi Billing — C Tablet Executive Console • Super Admin Keuangan & Verifikasi Billing Segarkan Super Admin Semua Verifikasi M
- **mobile**: Keuangan & Order — Keuangan & Order 0 Order Pending Semua Pending Aktif Ditolak Tidak Ada Pesanan Paket Semua transaksi paket lan

### ?tab=monetization

- **desktop**: Monetisasi & Integrasi Google — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: Monetisasi & Integrasi Google — C Tablet Executive Console • Super Admin Monetisasi & Integrasi Google Segarkan Super Admin Google AdSense Goo
- **mobile**: Monetisasi & Iklan — Monetisasi & Iklan Google AdSense & GA4 Google AdSense Google Analytics Google AdSense Monetization (Plan B): 

### ?tab=broadcast

- **desktop**: Siaran Broadcast Notifikasi — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: Siaran Broadcast Pengumuman — C Tablet Executive Console • Super Admin Siaran Broadcast Pengumuman Segarkan Super Admin Daftar & Riwayat Sia
- **mobile**: Siaran Broadcast — Siaran Broadcast 1 Siaran Aktif Siaran Pengumuman Kirim pengumuman massal & notifikasi merchant 1 Total Siaran

### ?tab=automation

- **desktop**: Mesin Otomatisasi & Cron Bot — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: Mesin Otomatisasi & Bot Worker — C Tablet Executive Console • Super Admin Mesin Otomatisasi & Bot Worker Segarkan Super Admin Ringkasan 11 Bot 
- **mobile**: Mesin Otomatisasi — Mesin Otomatisasi 11 Bot & Background Workers Ringkasan 11 Bot Platform 11 Riwayat & Audit 85 Sandbox Uji Coba

### ?tab=bot

- **desktop**: Mesin Otomatisasi & Cron Bot — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: Mesin Otomatisasi & Bot Worker — C Tablet Executive Console • Super Admin Mesin Otomatisasi & Bot Worker Segarkan Super Admin Ringkasan 11 Bot 
- **mobile**: Mesin Otomatisasi — Mesin Otomatisasi 11 Bot & Background Workers Ringkasan 11 Bot Platform 11 Riwayat & Audit 85 Sandbox Uji Coba

### ?tab=master_data

- **desktop**: Master Data, Domain & Rekber — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: Master Data & Proteksi Rekber — C Tablet Executive Console • Super Admin Master Data & Proteksi Rekber Segarkan Super Admin Proteksi Rekber Sy
- **mobile**: Data Master Platform — Data Master Platform Pusat Data Master Platform Pilihan Master Pilih entitas data acuan atau konfigurasi maste

### ?tab=master-data

- **desktop**: Master Data, Domain & Rekber — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: Master Data & Proteksi Rekber — C Tablet Executive Console • Super Admin Master Data & Proteksi Rekber Segarkan Super Admin Proteksi Rekber Sy
- **mobile**: Data Master Platform — Data Master Platform Pusat Data Master Platform Pilihan Master Pilih entitas data acuan atau konfigurasi maste

### ?tab=domains

- **desktop**: Master Data, Domain & Rekber — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: Master Data & Proteksi Rekber — C Tablet Executive Console • Super Admin Master Data & Proteksi Rekber Segarkan Super Admin Proteksi Rekber Sy
- **mobile**: Master Domain Aman — Master Domain Aman Whitelist URL Master Whitelist Domain Aman Konfigurasi domain resmi & mitra yang dibuka ins

### ?tab=audit

- **desktop**: System-Wide Audit Trail — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: System-Wide Audit Trail — C Tablet Executive Console • Super Admin System-Wide Audit Trail Segarkan Super Admin Jejak Audit Sistem Segar
- **mobile**: Audit Trail — Audit Trail 15 Log Aktivitas System-Wide Audit Trail Jejak forensik & kepatuhan seluruh tindakan administratif

### ?tab=safe_domains

- **desktop**: Master Data, Domain & Rekber — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: Master Data & Proteksi Rekber — C Tablet Executive Console • Super Admin Master Data & Proteksi Rekber Segarkan Super Admin Proteksi Rekber Sy
- **mobile**: Master Domain Aman — Master Domain Aman Whitelist URL Master Whitelist Domain Aman Konfigurasi domain resmi & mitra yang dibuka ins

### ?tab=tidak-ada-modul-ini

- **desktop**: Ringkasan Platform — CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Dir
- **tablet**: Ringkasan Eksekutif Platform — C Tablet Executive Console • Super Admin Ringkasan Eksekutif Platform Segarkan Super Admin Status Operasional 
- **mobile**: Catavor Executive — Catavor Executive Super Admin e2e-admin@catavor.test TOKO 1 ORDER 0 LAPORAN 0 TIKET 0 Perlu Tindakan Administr
