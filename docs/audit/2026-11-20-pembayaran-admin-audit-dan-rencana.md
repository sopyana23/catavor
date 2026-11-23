# Pembayaran admin pengelola Catavor

## Keputusan desain

Redesign ringan pada ketiga tab Keuangan & Billing. Pertahankan alur verifikasi invoice, formulir tiap metode pembayaran, dan pengelolaan kupon. Prioritaskan tiga pertanyaan operator ketika halaman terbuka. Transaksi mana yang perlu diperiksa? Apakah pilihan metode baru sudah berlaku di checkout? Di mana mencari atau membuat kupon?

## Bukti sebelum perubahan

Chromium membuka bundle lokal melalui `/admin?tab=finance`. Fixture menggunakan identitas staf keuangan, enam invoice sintetis serta respons API yang diatur untuk inspeksi tampilan. Audit mencakup tema terang dan gelap pada 375×812, 390×844, 800×1024, 960×800, 1280×800, dan 1600×900. Inspeksi mencakup perpindahan ketiga tab serta pemilihan mode gateway dan manual. Pengukuran DOM dibedakan dari pembacaan source. Fixture memberikan respons baca agar UI bisa diperiksa. Otorisasi efektif disimpulkan dari middleware Go, bukan dari keberhasilan fixture.

| Temuan | Dampak operasional dan bukti |
| --- | --- |
| Tinggi · Mode pilihan diberi label aktif sebelum disimpan | Klik gateway → manual mengganti panel dan label “MODE AKTIF” tanpa request simpan. Di laptop bahkan ada instruksi bahwa pilihan langsung aktif. Operator dapat meninggalkan halaman dengan kesan metode checkout sudah berubah. Pilihan berupa `div` dengan handler klik di ketiga frontend. |
| Tinggi · Kontrak pengaturan berbeda di tablet | Desktop dan mobile membaca dan menyimpan melalui `/api/admin/settings`. Tablet membaca `/api/settings` publik dan mencoba menyimpan seluruh state pengaturan ke `/api/settings` lalu ke rute admin jika gagal. Respons publik mengecualikan kredensial. Ada risiko menyimpan nilai pengaturan di luar pembayaran. Audit ini tidak menguji dampak tulis pada data riil. |
| Tinggi · Izin tombol dan rute berbeda | Desktop/mobile mempertimbangkan `finance:settings:manage`, tablet mempertimbangkan `finance:orders:manage`. Rute admin untuk pengaturan dan uji koneksi mensyaratkan `system:settings:manage`. Akun dapat melihat kontrol yang tidak sesuai dengan kewenangannya di server. |
| Sedang · Filter transaksi memakan ruang | Di mobile deret filter metode berukuran 722 px dalam panel 345–360 px. Pada tablet deret 425–479 px masuk ke panel daftar 240 px. Filter kupon gratis tetap terlihat meski tidak ada invoice demikian di fixture. Desktop memakai dua kelompok tombol dengan fungsi yang sama. |
| Sedang · Hierarki tindakan dan kontras | Label putih pada hijau `#10b981` menghasilkan kontras sekitar 2,54:1. Tombol Simpan bersaing dengan tab dan tanda pilihan. Pada laptop, kontrol “Tampilkan” sekitar 13 px tinggi dan “Salin” 26 px. Pada tablet mini tiga kartu mode dan formulir dua kolom mengambil lebar dari label kanal. |
| Sedang · Kupon | Desktop menyajikan tabel, pencarian serta filter jenis/status, mobile memiliki daftar kartu dan pencarian. Pencarian dan tindakan buat perlu mudah dikenali di setiap ukuran. Kode, jenis diskon, kuota, masa berlaku serta status perlu tetap terlihat saat tampilan dirapikan. |
| Sedang · Navigasi dan skala | URL tetap `?tab=finance` saat beralih di antara ketiga tab. GET daftar invoice mengambil semua transaksi dari DB dengan `Find`; pencarian dan filter bekerja di klien. Perubahan jumlah baris tidak disimulasikan sebagai paginasi server. |

Referensi visual konfigurasi pembayaran sebelum redesign. [Mobile](bukti/pembayaran-2026-11-20/baseline-mobile-390-light-settings.png) · [Tablet mini](bukti/pembayaran-2026-11-20/baseline-tablet-800-light-settings.png) · [Tablet lebar](bukti/pembayaran-2026-11-20/baseline-tablet-960-dark-settings.png) · [Laptop](bukti/pembayaran-2026-11-20/baseline-desktop-1280-light-settings.png) · [Desktop](bukti/pembayaran-2026-11-20/baseline-desktop-1600-dark-settings.png)

Sumber kontrak transaksi, akses, dan penyimpanan pengaturan. [Rute Go](../../backend/cmd/server/main.go) · [Daftar invoice dan kupon](../../backend/internal/handlers/subscription_handler.go) · [Pengaturan publik, masking dan penyimpanan](../../backend/internal/handlers/setting_handler.go)

## Rencana implementasi

| Urutan | Perubahan | Kriteria penerimaan |
| --- | --- | --- |
| 1 · Navigasi | Gunakan nama ringkas Transaksi, Pengaturan, dan Kupon. Tampilkan pilihan aktif dengan kontras jelas. Simpan subtab pada URL dan pertahankan akses berdasarkan peran. | Buka tautan langsung, muat ulang, kemudian Back. Subtab yang diizinkan sesuai URL; subtab yang tak dapat diakses jatuh ke Transaksi. |
| 2 · Transaksi | Ganti deret panjang dengan pemilih status dan metode bawaan masing-masing perangkat. Sertakan jumlah, sembunyikan opsi kosong, pertahankan pencarian dan detail. | Semua opsi terlihat tanpa menggeser filter horizontal; memilihnya memperbarui daftar. Ringkasan dan inspeksi invoice tetap berfungsi. |
| 3 · Pengaturan | Gunakan kelompok pilihan mode yang ringkas dan dapat dioperasikan dengan keyboard. Bedakan tindakan memilih dari menyimpan. Pakai satu kolom di layar sempit, beri ruang lebih untuk konfigurasi terpilih. Gunakan warna portal dan satu penekanan utama untuk Simpan. | Pergantiannya hanya mengubah draf, keterangan biaya membedakan QRIS nominal pas dari transfer berkode unik, dan kontrol terlihat di dua tema. |
| 4 · Kupon | Rapikan judul, pencarian, dan tombol buat pada daftar; sesuaikan kepadatan dengan ukuran layar. Pertahankan tabel desktop, kartu mobile, serta aksi kelola yang memiliki izin. | Operator dapat mencari kupon, membedakan status dan membuka form tanpa mengubah data saat bernavigasi. |
| 5 · Verifikasi | Bangun tiga bundle, uji perjalanan ketiga tab dan kedua tema dengan data sintetis, baca ulang tangkapan layar per perangkat. | Catat ukuran, hasil, keterbatasan dan bukti pada laporan ini. |

### Pekerjaan lanjutan yang menyentuh kontrak produk

1. Tentukan apakah pengelola keuangan boleh mengubah kredensial gateway. Jika ya, sediakan kontrak khusus pembayaran dengan daftar field yang diizinkan. Pertahankan masking dan uji nilai kosong, konfigurasi lama, serta kegagalan baca sebelum menyimpan. Jangan memperluas akses ke seluruh pengaturan sistem untuk menyelesaikan perbedaan satu tab.
2. Tambahkan paginasi dan agregasi server untuk invoice setelah kontrak jumlah, urutan, pencarian, serta filter disepakati. Uji jumlah lintas halaman dan peran baca/kelola pada database sekali pakai.

### Batas verifikasi

Audit visual dilakukan di Chromium dengan ukuran layar emulasi. Pembayaran sungguhan, persetujuan invoice, publikasi kupon, perubahan rekening, dan koneksi gateway produksi berada di luar pengujian redesign.

## Hasil implementasi

| Tab | Perubahan yang terlihat oleh operator |
| --- | --- |
| Transaksi | Dua pemilih menampilkan status dan metode yang memiliki data, lengkap dengan jumlahnya. Pada ponsel, pilihan dibuka lewat bottom sheet. Satu aturan mengelompokkan metode invoice untuk ketiga frontend. QRIS gateway yang belum menerima nomor referensi tetap masuk ke kelompok Gateway Aulaa. Detail di desktop dan tablet juga dapat membaca respons gateway berbentuk objek JSON. |
| Pengaturan | Gateway Aulaa, QRIS dan transfer, serta pemeliharaan ditampilkan sebagai satu kelompok radio berlabel. Teks menjelaskan kapan draf berlaku. Di tablet mini, kanal dan kredensial ditata satu kolom. Pada ponsel, tombol Simpan mengikuti area bawah saat operator menggulir. |
| Kupon | Pencarian dan aksi buat lebih mudah ditemukan. Desktop memakai pemilih jenis dan status dengan hitungan. Di tablet mini, informasi kupon ditata per kartu agar aksi dapat dijangkau. Pada tablet lebar dan desktop, tabel tetap tersedia. Back dari form tambah mengembalikan operator ke daftar kupon. |

### Kesetaraan informasi dan tindakan

| Informasi | Pemeriksaan |
| --- | --- |
| Invoice | Enam contoh mencakup pembayaran tertunda, verifikasi, lunas, kedaluwarsa, dan ditolak. Periksa pengelompokan metode, nomor invoice, nama toko, nominal, detail serta filter. Status lunas tetap dibedakan dari mode gateway. |
| Gateway | Kanal QRIS, virtual account, dompet elektronik, kartu, URL dasar, API key, webhook secret, dan alamat webhook diperiksa pada source. Uji koneksi tersedia di desktop/tablet; paritas uji koneksi di mobile dan otorisasinya merupakan tindak lanjut fungsional. |
| Manual dan pemeliharaan | Form mempertahankan unggahan QRIS, nama merchant, identitas rekening, serta judul dan isi pengumuman. Memilih mode manual atau pemeliharaan hanya mengganti draf di browser. |
| Kupon | Dua kupon sintetis dengan jenis dan status berbeda mengisi daftar. Operator dapat mencari kode, melihat nominal/jenis, penggunaan dan masa berlaku, kemudian membuka dan menutup form tambah. |

Dua temuan tambahan muncul ketika daftar kupon diisi. Pada 375 px, navigasi lama membutuhkan 367 px dalam ruang 345 px. Pada tablet mini, tujuh kolom mendorong aksi kupon ke luar area awal. Back dari form kupon juga meninggalkan tab pada tablet atau membiarkan form terbuka pada desktop. Navigasi baru memakai tiga label ringkas; desktop dan tablet memakai intersepsi Back yang digunakan portal. [Kupon tablet sebelum](bukti/pembayaran-2026-11-20/baseline-tablet-800-light-coupons.png) · [Kupon tablet sesudah](bukti/pembayaran-2026-11-20/final-tablet-800-light-coupons.png)

Alur kode yang dapat ditinjau. [Navigasi, filter, dan formulir bersama](../../frontend/shared/finance/FinanceControls.tsx) · [Klasifikasi pembayaran](../../frontend/shared/finance/paymentChannel.ts) · [Model invoice Go](../../backend/internal/models/subscription_order.go) · [Tes regresi](../../tests/audit/payment-admin.test.cjs)

## Verifikasi hasil

| Pemeriksaan | Hasil lokal |
| --- | --- |
| Build dan regresi | `npm run build` berhasil untuk mobile, tablet, dan desktop. Sembilan tes pada `node --test tests/audit/payment-admin.test.cjs` lulus. Vite masih memberi peringatan ukuran bundle masing-masing portal. |
| Navigasi | Muat ulang mempertahankan Kupon. Back dari form tambah menutup form; Back antar-tab memulihkan Pengaturan. Pada 24 pembukaan tautan Pengaturan/Kupon dengan fixture staf baca transaksi, UI hanya menampilkan Transaksi. |
| Klasifikasi invoice | Di setiap lebar dan tema, filter Gateway Aulaa mengembalikan tiga nomor invoice yang sama, termasuk invoice dengan respons gateway berbentuk objek. Transfer bank menampilkan tiga invoice lainnya. Opsi kupon gratis tidak muncul pada dataset ini. |
| Draf dan tindakan | Tombol panah keyboard memindahkan pilihan mode; memilih mode tidak mengirim perubahan konfigurasi. Di mobile 390×844, tombol Simpan berada pada posisi vertikal 731–775 px sebelum dan sesudah menggulir, di atas navigasi bawah. |
| Keterbacaan | Kontras tab aktif dan tombol Simpan masing-masing 5,95:1 dan 7,05:1 di tema terang; 7,38:1 dan 11,05:1 di tema gelap. Ketiga tab memiliki tinggi 44 px di mobile/tablet. Angka ini merupakan pengukuran pada kontrol tersebut. |

**Perbandingan visual.** [Transaksi mobile sebelum](bukti/pembayaran-2026-11-20/baseline-mobile-390-light-orders.png) · [Transaksi mobile sesudah](bukti/pembayaran-2026-11-20/final-mobile-390-light-orders.png) · [Pengaturan mobile](bukti/pembayaran-2026-11-20/final-mobile-390-light-settings.png) · [Pengaturan tablet](bukti/pembayaran-2026-11-20/final-tablet-800-light-settings.png) · [Transaksi laptop](bukti/pembayaran-2026-11-20/final-desktop-1280-light-orders.png) · [Kupon desktop gelap](bukti/pembayaran-2026-11-20/final-desktop-1600-dark-coupons.png)
