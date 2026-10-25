# Ringkasan Audit Paritas Form-Factor

Dibuat: 2026-10-25T12:11:08.239Z
Target: http://localhost:8000
Login admin: 200 — Login berhasil.
Login merchant: 200 — Login berhasil.
Store: admin=e2e-store merchant=adidas

## 1. Matriks halaman × device

| Device | Rute | URL akhir | Form login? | Overflow X | Teks meluber | Tombol | Target <44px | <select> | Emoji | Console error |
|---|---|---|---|---|---|---|---|---|---|---|
| desktop | public-home | / | - | 0 | 0 | 24 | 16 | 0 | 2 | 0 |
| desktop | store-catalog | /adidas | - | 0 | 0 | 20 | 15 | 0 | 1 | 0 |
| desktop | merchant-admin | /adidas/admin/items | - | 0 | 0 | 41 | 38 | 0 | 3 | 0 |
| desktop | console-dashboard | /admin?tab=dashboard&view=desktop | - | 0 | 0 | 22 | 14 | 0 | 0 | 0 |
| desktop | console-reports | /admin?tab=reports&view=desktop | - | 0 | 0 | 26 | 25 | 0 | 0 | 0 |
| desktop | console-support | /admin?tab=support&view=desktop | - | 0 | 0 | 23 | 22 | 0 | 0 | 0 |
| desktop | console-finance | /admin?tab=finance&view=desktop | - | 0 | 0 | 19 | 18 | 0 | 0 | 0 |
| desktop | console-stores | /admin?tab=stores&view=desktop | - | 0 | 0 | 42 | 31 | 0 | 0 | 0 |
| desktop | console-rbac | /admin?tab=rbac&view=desktop | - | 0 | 0 | 25 | 24 | 0 | 0 | 0 |
| desktop | console-audit | /admin?tab=audit&view=desktop | - | 0 | 0 | 38 | 33 | 3 | 0 | 0 |
| tablet | public-home | /?view=tablet | - | 0 | 0 | 22 | 1 | 0 | 0 | 0 |
| tablet | store-catalog | /adidas?view=tablet | - | 0 | 0 | 4 | 2 | 0 | 0 | 0 |
| tablet | merchant-admin | /adidas/admin?view=tablet | - | 0 | 0 | 35 | 4 | 1 | 1 | 0 |
| tablet | console-dashboard | /admin?tab=dashboard&view=tablet | - | 0 | 0 | 15 | 0 | 0 | 0 | 0 |
| tablet | console-reports | /admin?tab=reports&view=tablet | - | 0 | 0 | 26 | 0 | 0 | 0 | 0 |
| tablet | console-support | /admin?tab=support&view=tablet | - | 0 | 0 | 24 | 0 | 0 | 0 | 0 |
| tablet | console-finance | /admin?tab=finance&view=tablet | - | 0 | 0 | 20 | 0 | 0 | 0 | 0 |
| tablet | console-stores | /admin?tab=stores&view=tablet | - | 0 | 0 | 37 | 0 | 0 | 0 | 0 |
| tablet | console-rbac | /admin?tab=rbac&view=tablet | - | 0 | 0 | 28 | 0 | 0 | 0 | 0 |
| tablet | console-audit | /admin?tab=audit&view=tablet | - | 0 | 0 | 31 | 0 | 0 | 0 | 0 |
| mobile | public-home | / | - | 0 | 0 | 17 | 14 | 0 | 4 | 0 |
| mobile | store-catalog | /adidas | - | 0 | 0 | 16 | 8 | 0 | 1 | 0 |
| mobile | merchant-admin | /adidas/admin | - | 0 | 0 | 20 | 6 | 0 | 1 | 0 |
| mobile | console-dashboard | /admin?tab=dashboard&view=mobile | - | 0 | 0 | 12 | 0 | 0 | 0 | 0 |
| mobile | console-reports | /admin?tab=reports&view=mobile | - | 0 | 0 | 16 | 11 | 0 | 0 | 0 |
| mobile | console-support | /admin?tab=support&view=mobile | - | 0 | 0 | 14 | 9 | 0 | 0 | 0 |
| mobile | console-finance | /admin?tab=finance&view=mobile | - | 0 | 0 | 9 | 4 | 0 | 0 | 0 |
| mobile | console-stores | /admin?tab=stores&view=mobile | - | 0 | 0 | 18 | 5 | 0 | 0 | 0 |
| mobile | console-rbac | /admin?tab=rbac&view=mobile | - | 0 | 0 | 15 | 10 | 0 | 0 | 0 |
| mobile | console-audit | /admin?tab=audit&view=mobile | - | 0 | 0 | 30 | 13 | 0 | 0 | 0 |

## 2. Emoji pada teks terlihat (pelanggaran §6)

- **desktop / public-home**: `💡` `👑`
- **desktop / store-catalog**: `⚡`
- **desktop / merchant-admin**: `⚡` `✓` `🔒`
- **tablet / merchant-admin**: `⚡`
- **mobile / public-home**: `💡` `✅` `⚡` `👑`
- **mobile / store-catalog**: `⚡`
- **mobile / merchant-admin**: `⚡`

## 3. `<select>` native pada device sentuh (pelanggaran §7.A.2/§7.A.3)

- **tablet / merchant-admin**: 1 elemen
- (info desktop, wajar) console-audit: 3

## 4. Target sentuh < 44px (tablet & mobile wajib ≥44px)

### tablet

- **public-home** (1 contoh):
  - 139×19 px — "rekbersyariah.com"
- **store-catalog** (2 contoh):
  - 167×35 px — "Jelajahi Toko Lain"
  - 154×40 px — "Semua Produk (5)"
- **merchant-admin** (4 contoh):
  - 65×34 px — "Semua"
  - 51×34 px — "Aktif"
  - 53×34 px — "Arsip"
  - 60×31 px — "Batal"

### mobile

- **public-home** (14 contoh):
  - 54×25 px — "Masuk"
  - 102×29 px — "Buat Katalog"
  - 128×18 px — "rekbersyariah.com"
  - 101×18 px — "+62811220227"
  - 150×38 px — "Situs Web"
  - 150×38 px — "Chat Rekber"
- **store-catalog** (8 contoh):
  - 149×28 px — "Buat Katalog Gratis ⚡"
  - 84×38 px — "Filter"
  - 83×27 px — "Semua (5)"
  - 81×27 px — "Barang (1)"
  - 80×27 px — "Kuliner (1)"
  - 65×27 px — "Jasa (1)"
- **merchant-admin** (6 contoh):
  - 264×41 px — "A Adidas GRATIS TERBATAS"
  - 77×25 px — "Ganti ▾"
  - 117×33 px — "Kelola Paket"
  - 41×17 px — "7 Hari"
  - 48×17 px — "30 Hari"
  - 42×15 px — "Detail ↗"
- **console-reports** (11 contoh):
  - 88×28 px — "Semua 0"
  - 109×28 px — "Menunggu 0"
  - 109×28 px — "Investigasi 0"
  - 120×28 px — "Revisi Masuk 0"
  - 96×28 px — "Ditindak 0"
  - 92×28 px — "Banned 0"
- **console-support** (9 contoh):
  - 85×29 px — "Semua 0"
  - 120×29 px — "Perlu Respon 0"
  - 97×29 px — "Diproses 0"
  - 145×29 px — "Tunggu Merchant 0"
  - 86×29 px — "Urgent 0"
  - 87×29 px — "Selesai 0"
- **console-finance** (4 contoh):
  - 65×28 px — "Semua"
  - 72×28 px — "Pending"
  - 53×28 px — "Aktif"
  - 66×28 px — "Ditolak"
- **console-stores** (5 contoh):
  - 39×19 px — "/tes"
  - 40×19 px — "/lop"
  - 82×19 px — "/e2e-store"
  - 61×19 px — "/adidas"
  - 124×19 px — "/test-verify-store"
- **console-rbac** (10 contoh):
  - 113×34 px — "Daftar Staf"
  - 113×34 px — "Matriks Izin"
  - 113×34 px — "Buat Role"
  - 106×37 px — "Tugaskan"
  - 79×28 px — "Ubah Role"
  - 58×28 px — "Cabut"
- **console-audit** (13 contoh):
  - 98×31 px — "Segarkan"
  - 134×30 px — "Semua Kategori"
  - 103×30 px — "Keamanan"
  - 88×30 px — "Katalog"
  - 71×30 px — "Toko"
  - 93×30 px — "Finansial"

## 4b. Luapan teks pada tombol / pill (textOverflows)

- Tidak ditemukan (0 luapan teks di seluruh rute).

## 5. Pola navigasi/paginasi data (paritas §7.C)

| Device | Rute | Load More | "Menampilkan X–Y" | Nomor halaman | Baris/halaman | Prev-Next |
|---|---|---|---|---|---|---|
| desktop | public-home | - | - | - | - | - |
| desktop | store-catalog | - | - | - | - | - |
| desktop | merchant-admin | - | - | - | - | - |
| desktop | console-dashboard | - | - | - | - | - |
| desktop | console-reports | - | - | - | - | - |
| desktop | console-support | - | - | - | - | - |
| desktop | console-finance | - | - | - | - | - |
| desktop | console-stores | - | ya | - | - | - |
| desktop | console-rbac | - | - | - | - | - |
| desktop | console-audit | - | ya | - | - | - |
| tablet | public-home | - | - | - | - | - |
| tablet | store-catalog | - | - | - | - | - |
| tablet | merchant-admin | - | - | ya | - | - |
| tablet | console-dashboard | - | - | - | - | - |
| tablet | console-reports | - | - | - | - | - |
| tablet | console-support | - | - | - | - | - |
| tablet | console-finance | - | - | - | - | - |
| tablet | console-stores | - | - | ya | - | - |
| tablet | console-rbac | - | - | - | - | - |
| tablet | console-audit | - | - | ya | - | - |
| mobile | public-home | - | - | - | - | - |
| mobile | store-catalog | - | - | - | - | - |
| mobile | merchant-admin | - | - | - | - | - |
| mobile | console-dashboard | - | - | - | - | - |
| mobile | console-reports | - | - | - | - | - |
| mobile | console-support | - | - | - | - | - |
| mobile | console-finance | - | - | - | - | - |
| mobile | console-stores | - | - | ya | - | - |
| mobile | console-rbac | - | - | - | - | - |
| mobile | console-audit | - | - | - | - | ya |

## 6. Inventaris label navigasi per device (konsol pengelola)

### desktop / console-dashboard — heading: Ringkasan Platform | Kelola Platform & Sistem

nav: Segarkan

tabs: (kosong)

### desktop / console-reports — heading: Kepatuhan & Laporan Masyarakat

nav: Segarkan

tabs: (kosong)

### desktop / console-support — heading: Pusat Bantuan & Helpdesk

nav: Segarkan

tabs: (kosong)

### desktop / console-finance — heading: Keuangan & Billing Langganan

nav: Segarkan

tabs: (kosong)

### desktop / console-stores — heading: Tata Kelola Merchant & Dormansi

nav: Segarkan

tabs: (kosong)

### desktop / console-rbac — heading: Staf & Role RBAC

nav: Segarkan

tabs: (kosong)

### desktop / console-audit — heading: System-Wide Audit Trail

nav: Segarkan

tabs: (kosong)

### tablet / console-dashboard — heading: Ringkasan Eksekutif Platform | Akses Cepat Modul Pengelola

nav: Segarkan

tabs: (kosong)

### tablet / console-reports — heading: Kepatuhan & Laporan Masyarakat | Pilih Laporan untuk Moderasi

nav: Segarkan

tabs: (kosong)

### tablet / console-support — heading: Pusat Bantuan & Helpdesk CS

nav: Segarkan

tabs: (kosong)

### tablet / console-finance — heading: Keuangan & Verifikasi Billing

nav: Segarkan

tabs: (kosong)

### tablet / console-stores — heading: Tata Kelola Profil Merchant

nav: Segarkan

tabs: (kosong)

### tablet / console-rbac — heading: Staf & Role RBAC

nav: Segarkan

tabs: (kosong)

### tablet / console-audit — heading: System-Wide Audit Trail | Pengguna Fixture Owner (fixture-owner@catavor.test) berhasil login ke sistem.

nav: Segarkan

tabs: (kosong)

### mobile / console-dashboard — heading: Catavor Executive | Kelola Platform & Sistem

nav: Ringkasan · Laporan · Helpdesk · Keuangan

tabs: (kosong)

### mobile / console-reports — heading: Laporan Masuk

nav: Ringkasan · Laporan · Helpdesk · Keuangan

tabs: (kosong)

### mobile / console-support — heading: Helpdesk Tiket

nav: Ringkasan · Laporan · Helpdesk · Keuangan

tabs: (kosong)

### mobile / console-finance — heading: Keuangan & Order

nav: Ringkasan · Laporan · Helpdesk · Keuangan

tabs: (kosong)

### mobile / console-stores — heading: Tata Kelola Toko

nav: (kosong)

tabs: (kosong)

### mobile / console-rbac — heading: Staf & RBAC

nav: (kosong)

tabs: (kosong)

### mobile / console-audit — heading: Audit Trail

nav: (kosong)

tabs: (kosong)

## 7. Cuplikan teks halaman (untuk verifikasi isi)

- **desktop / merchant-admin**: A Adidas @adidas FREE KATALOG & INVENTARIS Daftar Item Katalog 5 Kategori Etalase PERFORMA & BISNIS Statistik & Trafik PENGATURAN & AKUN Pengaturan Katalog Paket & Kuota GRATIS Akun & Keamanan BANTUAN & LAYANAN Pusat Ban
- **desktop / console-dashboard**: CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Direktori Merchant OPERASIONAL Kepatuhan & Laporan Tiket Bantuan Keuangan & Billing Siaran Broadcast SISTEM & KON
- **desktop / console-reports**: CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Direktori Merchant OPERASIONAL Kepatuhan & Laporan Tiket Bantuan Keuangan & Billing Siaran Broadcast SISTEM & KON
- **desktop / console-support**: CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Direktori Merchant OPERASIONAL Kepatuhan & Laporan Tiket Bantuan Keuangan & Billing Siaran Broadcast SISTEM & KON
- **desktop / console-finance**: CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Direktori Merchant OPERASIONAL Kepatuhan & Laporan Tiket Bantuan Keuangan & Billing Siaran Broadcast SISTEM & KON
- **desktop / console-stores**: CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Direktori Merchant OPERASIONAL Kepatuhan & Laporan Tiket Bantuan Keuangan & Billing Siaran Broadcast SISTEM & KON
- **desktop / console-rbac**: CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Direktori Merchant OPERASIONAL Kepatuhan & Laporan Tiket Bantuan Keuangan & Billing Siaran Broadcast SISTEM & KON
- **desktop / console-audit**: CATAVOR PLATFORM CONSOLE E E2E Admin e2e-admin@catavor.test SUPER ADMIN Online UTAMA Dashboard Staf & RBAC Direktori Merchant OPERASIONAL Kepatuhan & Laporan Tiket Bantuan Keuangan & Billing Siaran Broadcast SISTEM & KON
- **tablet / merchant-admin**: Katalog Produk & Inventaris 5 total item Reset Form Semua Aktif Arsip Semua Kategori Chinchilla Grey Royal Velvet Keturunan Import Usia 4 Bulan Aktif Rp 3.800.000 Stok: 1 Pcs Preset Lightroom Mobile & Desktop: Streetwear
- **tablet / console-dashboard**: C Tablet Executive Console • Super Admin Ringkasan Eksekutif Platform Segarkan Super Admin Status Operasional Prima: Seluruh laporan kepatuhan, tiket bantuan CS, dan aktivasi billing tertangani dengan baik. Direktori Mer
- **tablet / console-reports**: C Tablet Executive Console • Super Admin Kepatuhan & Laporan Masyarakat Segarkan Super Admin Menunggu 0 Investigasi 0 Sanksi Aktif 0 Banned 0 Semua 0 Menunggu 0 Investigasi 0 Revisi Masuk 0 Ditindak 0 Banned 0 Ditolak 0 
- **tablet / console-support**: C Tablet Executive Console • Super Admin Pusat Bantuan & Helpdesk CS Segarkan Super Admin Semua 0 Perlu Respon 0 Diproses 0 Tunggu Merchant 0 Urgent 0 Selesai 0 Semua Kategori Semua Prioritas SLA Lewat Tidak Ada Tiket Ti
- **tablet / console-finance**: C Tablet Executive Console • Super Admin Keuangan & Verifikasi Billing Segarkan Super Admin Semua Verifikasi Menunggu Bayar Lunas Ditolak Tidak ada transaksi billing Tidak Ada Item Terpilih Pilih salah satu item dari daf
- **tablet / console-stores**: C Tablet Executive Console • Super Admin Tata Kelola Profil Merchant Segarkan Super Admin Profil Merchant Aktif (5) Pelanggaran & Banned (0) Tabel Kartu Filter Detail Semua Paket Semua Item Terbaru Terdaftar Geser tabel 
- **tablet / console-rbac**: C Tablet Executive Console • Super Admin Staf & Role RBAC Segarkan Super Admin Daftar Staf Matriks Izin Buat Role Tugaskan E E2E Admin e2e-admin@catavor.test Super Admin ID #29 • Staf Platform Ubah Role Cabut P Platform 
- **tablet / console-audit**: C Tablet Executive Console • Super Admin System-Wide Audit Trail Segarkan Super Admin Jejak Audit Sistem Segarkan SEMUA KEAMANAN KATALOG TOKO FINANSIAL MODERASI SISTEM Semua Aktor Superadmin Merchant Sistem security auth
- **mobile / merchant-admin**: A Adidas GRATIS TERBATAS SELAMAT DATANG Halo, Fixture Ganti ▾ Item: 5 / 15 Storage: 0 KB ⚡ Buka Fitur Unlimited (Plan Pro) Item tanpa batas & Lencana Terverifikasi Kelola Paket Performa Katalog 7 Hari 30 Hari Detail ↗ Pe
- **mobile / console-dashboard**: Catavor Executive Super Admin e2e-admin@catavor.test TOKO 1 ORDER 0 LAPORAN 0 TIKET 0 Perlu Tindakan Administrator Semua antrean operasional telah ditangani Terkendali Semua tiket dan laporan operasional telah selesai di
- **mobile / console-reports**: Laporan Masuk 0 Laporan Pending Menunggu 0 Investigasi 0 Sanksi Aktif 0 Banned 0 Semua 0 Menunggu 0 Investigasi 0 Revisi Masuk 0 Ditindak 0 Banned 0 Ditolak 0 Selesai 0 Target: Semua Target Hanya Item Katalog Toko Tidak 
- **mobile / console-support**: Helpdesk Tiket 0 Total Tiket Semua 0 Perlu Respon 0 Diproses 0 Tunggu Merchant 0 Urgent 0 Selesai 0 Semua Kategori Semua Prioritas SLA Lewat Tidak Ada Tiket Tidak ada tiket bantuan yang cocok dengan filter saat ini. Ring
- **mobile / console-finance**: Keuangan & Order 0 Order Pending Semua Pending Aktif Ditolak Tidak Ada Pesanan Paket Semua transaksi paket langganan telah terverifikasi. Ringkasan Laporan Helpdesk Keuangan
- **mobile / console-stores**: Tata Kelola Toko 1 Toko Terdaftar Profil Aktif 5 Banned / Suspend 0 Aktif (5) Pelanggaran (0) Filter Detail Katalog tes FREE /tes Pemilik: Dzikri Muhammad Sopyana Item Terdaftar: 0 Item Status: Aktif Normal Detail Profil
- **mobile / console-rbac**: Staf & RBAC Matriks & Izin Staf Daftar Staf Matriks Izin Buat Role Tugaskan E E2E Admin e2e-admin@catavor.test Super Admin ID #29 • Staf Platform Ubah Role Cabut P Platform Owner owner@catavor.local Super Admin ID #1 • S
- **mobile / console-audit**: Audit Trail 15 Log Aktivitas System-Wide Audit Trail Jejak forensik & kepatuhan seluruh tindakan administratif Segarkan Semua Kategori Keamanan Katalog Toko Finansial Moderasi Sistem Aktor: Semua Aktor Superadmin Merchan
