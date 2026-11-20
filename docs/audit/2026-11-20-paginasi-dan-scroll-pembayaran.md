# Audit gulir, paginasi, dan filter pembayaran admin

20 November 2026 · Portal Pengelola Catavor · Transaksi, Pengaturan, dan Kupon

Pada tablet, daftar kupon sebelumnya terpotong sehingga pengelola tidak bisa mencapai kupon terakhir. Transaksi dan kupon juga diunduh seluruhnya agar browser bisa mencari, menghitung, dan menyaring. Implementasi sekarang menyediakan area gulir dan mengambil satu halaman dari API Go yang sama pada ketiga frontend. Pengaturan tetap berupa formulir yang dapat digulir sampai informasi webhook.

## Temuan sebelum perbaikan

Pengukuran browser menggunakan 137 invoice dan 137 kupon sintetis. Semua lebar mengakses data uji yang sama.

| Tampilan | Bukti awal | Dampak |
| --- | --- | --- |
| Tablet 800 × 1024 | Isi daftar kupon setinggi 26.293 px terpotong dalam panel 696 px. Di 960 × 800, isi 9.935 px terpotong dalam panel 520 px. | Pengelola tidak bisa mencapai bagian akhir dengan menggulir. |
| Tablet, tab Pengaturan | Pembukaan tab memicu dua pembacaan daftar invoice penuh. | Membuka konfigurasi ikut membebani jalur transaksi. |
| Mobile 375 px dan laptop 1280 px | Pada data uji, tinggi konten transaksi mencapai sekitar 56 ribu px di mobile dan 45 ribu px di laptop. | Jumlah elemen, kerja tata letak, dan volume respons ikut tumbuh dengan jumlah invoice. |
| Filter transaksi dan kupon | Pencarian dan penyaringan bergantung pada koleksi yang sudah diterima browser. | Membatasi jumlah baris tanpa memindahkan logika filter ke server akan menyembunyikan hasil di halaman lain. |

## Rencana dan hasil implementasi

| Urutan | Keputusan | Implementasi |
| --- | --- | --- |
| 1 | Pisahkan daftar operasional dari ringkasan | Tab Transaksi mengambil satu halaman beserta ringkasannya. Untuk tampilan yang hanya membutuhkan penghitung, API mendukung `summary=1` tanpa baris invoice. Pengaturan admin dapat mengecualikan `master_coupons` dan pengaturan publik hanya membaca kunci yang diizinkan. |
| 2 | Batasi pekerjaan pada setiap interaksi | Transaksi dan Kupon mulai dengan 10 baris. API menolak batas di luar 1–100. Tanggal pembuatan dan ID mengurutkan invoice secara deterministik. Kupon mempertahankan urutan katalog yang tersimpan. Jumlah, facet filter, dan halaman dibaca dalam satu snapshot PostgreSQL. |
| 3 | Sesuaikan kontrol dengan ukuran layar | Mobile memiliki Sebelumnya/Selanjutnya. Tablet menyediakan posisi halaman dan lompat langsung. Pada tablet lebar, daftar transaksi memiliki area gulir sendiri di samping panel detail. Laptop/desktop menyediakan pilihan 10, 25, 50, atau 100 baris, nomor halaman, Awal/Akhir, dan lompat langsung. |
| 4 | Sinkronkan filter dan navigasi | Perubahan filter kembali ke halaman pertama. Kata kunci, filter, jumlah baris, dan halaman tersimpan di URL. Pemilih mobile/tablet menutup lapisan pilihan sebelum menerapkan filter ke riwayat halaman. Opsi dengan nol hasil disembunyikan dan pilihan yang kehilangan seluruh hasil direset setelah respons server diterima. |

## Cara pengambilan data per tab

| Tab | Pengambilan data | Perilaku filter |
| --- | --- | --- |
| Transaksi | `GET /api/admin/subscription/orders` menerima `page`, `limit`, `q`, `status`, dan `channel`. Relasi toko, pelanggan, dan pemeriksa dimuat untuk baris di halaman yang diminta. | Pencarian mencakup antara lain nomor invoice, toko, pelanggan, pengirim, referensi gateway, dan kode kupon. Status dan metode dapat digabungkan. Jumlah per opsi mencakup hasil di seluruh halaman dengan mempertimbangkan filter lainnya. |
| Kupon | `GET /api/admin/coupons` menerima `page`, `limit`, `q`, `status`, dan `type`. | Kode atau label, status aktif/nonaktif, dan jenis gratis/potongan diproses di server. Ketiga frontend menggunakan opsi dan hitungan dari respons yang sama. |
| Pengaturan | Membaca konfigurasi formulir. Pembukaan tab tidak meminta baris invoice atau kupon. | Pilihan mode checkout merupakan draf lokal. Pengelola dapat membandingkan mode dan menggulir ke informasi webhook sebelum menekan Simpan. |

Untuk pencarian teks, frontend menunggu 300 ms sejak ketikan terakhir. Permintaan yang sudah digantikan dibatalkan pada browser dan respons lama tidak dapat menimpa hasil terbaru. Pilihan status dan jenis dikirim segera. Server membatasi waktu kueri hingga 10 detik dan panjang kata kunci hingga 150 karakter. Karakter pencarian seperti `%` dan `_` diperlakukan secara literal.

## Bukti verifikasi

| Pengujian | Hasil |
| --- | --- |
| Build | `npm run build` lulus di desktop, tablet, dan mobile. Vite masih memperingatkan ukuran sebagian bundle portal. |
| Browser Chromium | Diuji pada 375 × 812, 390 × 844, 800 × 1024, 960 × 800, 1280 × 800, dan 1600 × 900. Transaksi dan Kupon dapat digulir ke baris terakhir halaman, berpindah halaman, lalu menemukan data ke-136 melalui pencarian. Bagian webhook Pengaturan terjangkau di enam ukuran. |
| Jaringan dan interaksi | Membuka Transaksi menghasilkan satu permintaan daftar yang juga memuat ringkasan. Pengaturan tidak meminta baris daftar. Seluruh 44 kasus browser lulus, termasuk debounce, respons terlambat, kombinasi kata kunci dan filter kupon, opsi metode yang datanya baru muncul setelah invoice ke-120, pemulihan filter melalui Back, dan detail invoice yang tetap terbuka saat berganti halaman pada tablet lebar. |
| PostgreSQL lokal terisolasi | Handler Go dan migrasi indeks diuji pada basis data sementara. Tes memeriksa batas ukuran, koreksi halaman yang terlalu tinggi, pencarian lintas halaman, filter gabungan, perhitungan pendapatan, dan ringkasan tanpa baris. |

**Uji volume.** Pada basis data berisi 10.037 transaksi dan 10.000 kupon, halaman ke-500 mengembalikan tepat 10 baris. Satu pengukuran lokal menghasilkan 26 ms untuk transaksi dan 34 ms untuk kupon. Pencarian kode spesifik dengan filter menghasilkan satu baris dalam 41 ms dan 30 ms. Angka mencakup handler lokal dan pembacaan respons. Respons invoice menyertakan lima atribut toko dan tiga atribut pengguna yang dibutuhkan portal. Latensi jaringan produksi, banyak pengguna serentak, dan variasi distribusi data belum diukur. Pengujian browser memakai respons API sintetis, sedangkan pengujian handler menjalankan PostgreSQL sesungguhnya.

[Bukti tampilan transaksi tablet pada halaman 14](bukti/pembayaran-2026-11-20/finance-pager-orders-960.png) · [Bukti tampilan kupon tablet pada halaman 14](bukti/pembayaran-2026-11-20/finance-pager-coupons-800.png)

## Batas skala dan tindak lanjut

- Katalog kupon masih disimpan dalam satu nilai JSON `master_coupons`. PostgreSQL menguraikannya untuk menghitung kecocokan walaupun hanya satu halaman dikirim. Jika waktu kueri kupon meningkat, pindahkan kupon ke tabel tersendiri dengan indeks kode, status, dan jenis, berikut migrasi alur validasi dan pemakaian kupon.
- Pencarian transaksi sebagian kata pada beberapa kolom dan hitungan filter yang presisi tetap membutuhkan pemindaian kandidat. Halaman bernomor juga menggunakan offset. Pantau waktu kueri dan rencana eksekusi pada distribusi data produksi sebelum menambah indeks pencarian atau mengganti navigasi ke model kursor.
- Ketiga bundle perlu dirilis bersama backend berkontrak paginasi dan migrasi `20261120_n63_finance_order_paging.sql`. Pengujian ini berlangsung di lingkungan lokal.

## Reproduksi

1. Jalankan `npm run build` dari masing-masing direktori `frontend/desktop`, `frontend/tablet`, dan `frontend/mobile`.
2. Dari akar repositori, jalankan `node --test tests/audit/finance-paging.test.cjs tests/audit/payment-admin.test.cjs`.
3. Dari `backend`, jalankan `go test -tags automationqa ./internal/handlers -run '^TestFinancePagesPostgres$' -count=1 -v` dengan binari PostgreSQL lokal tersedia bagi pengujian.
