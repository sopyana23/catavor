# Rencana implementasi dan verifikasi Mesin Otomasi

**Pemilik keputusan produk:** pengelola Catavor. **Baseline:** [audit atas sumber 7c91dfe dan enam viewport](2026-11-19-audit-mesin-otomasi-platform.md).

Pengelola mengonfirmasi bahwa pemeriksaan banner promo dan jumlah produk aktif tetap menjadi diagnostik manual. Kontraknya adalah hasil hitung pada saat permintaan. Fitur harga terjadwal berada di luar lingkup. Ringkasan platform yang tersedia saat ini juga dapat dijalankan manual dengan penjelasan periode data yang sebenarnya.

## Urutan pekerjaan dan syarat kelulusan

| Fase | Hasil yang harus tersedia | Bukti untuk melanjutkan |
|---|---|---|
| 1. QA sebelum perubahan aplikasi | Fixture PostgreSQL sekali pakai, storage temporer, target email lokal, data yang memenuhi syarat dan data pembanding. Uji handler, perubahan tabel, efek media, pengiriman ke pelanggan SSE serta loop yang relevan. | Catat untuk setiap bot apakah eksekusi menghasilkan perubahan yang dijanjikan, melewati kandidat yang dilindungi, atau gagal. Respons HTTP 200 dan log “success” saja belum cukup. Simpan perbedaan antara uji fungsi siklus, pemicu manual dan jadwal. |
| 2. Betulkan mesin | Satukan definisi kondisi dan fungsi siklus yang dipakai jadwal dan pemicu admin. Kelompokkan alias dormansi. Pulihkan kegagalan yang dibuktikan fixture. Pertahankan tenggat retensi dan aturan bisnis yang telah disepakati. | Ulangi fixture yang gagal. Dua kali pemanggilan atas kandidat yang sama memberikan efek bisnis yang semestinya. Verifikasi khusus toko kedua milik pengguna yang sama, tiket banding, dan kegagalan storage. |
| 3. Kontrak operasi | Backend menyediakan katalog beserta jenis, jadwal efektif, syarat, risiko, kemampuan run/preview, serta hasil terakhir. Pertahankan endpoint lama bagi klien yang sudah terpasang. GET memeriksa hak lihat/kelola, POST memeriksa hak kelola. | Uji matriks izin melalui router. Katalog menautkan semua pekerja, termasuk pekerjaan pantau-saja. Klien tidak perlu menebak hak eksekusi atau jadwal. |
| 4. Keselamatan eksekusi dan pemantauan | Pisahkan dry-run tanpa efek samping, pengiriman notifikasi nyata ke akun penguji, dan eksekusi produksi. Untuk operasi destruktif tampilkan pratinjau kandidat, batas tenant, pengecualian dan konfirmasi. Simpan identitas run, aktor, fase dan hasil. Gunakan klaim atomik bersama untuk manual/jadwal yang dapat bertabrakan. | Jalankan dua pemicu bersamaan dengan fixture. Verifikasi batas tenant, satu efek per kandidat, rollback dan kegagalan parsial. Simulasi harus meninggalkan tabel bisnis, file dan antrean operasional identik. Status awal “Belum terukur”, nol tetap nol. |
| 5. Perbaikan UI tiga frontend | Mobile memakai daftar dan sheet; tablet mini daftar/detail dan tablet lebar panel berdampingan; laptop tabel kompak, desktop tabel lengkap. Gunakan API katalog yang sama, filter dari jumlah riil, pagination server, URL subtab/filter/halaman dan Smart Back. | Log ke-51 dapat dibuka. Uji akses baca, izin ditolak, nol data, last_error, run aktif dan konflik. Uji enam viewport audit awal, keyboard, target 44 px pada perangkat sentuh, tiga build produksi. |
| 6. Rilis bertahap | Pasang dukungan baca backend terlebih dahulu. Aktifkan runner pada data terbatas setelah fixture lulus. Rilis UI sesudah kontrak stabil. | Pantau keterlambatan terjadwal, umur antrean, jumlah kandidat dipindai/diubah/dilewati/gagal, identitas operator, serta dampak media. Bila hasil salah, hentikan pemicu baru dan pertahankan riwayat untuk rekonsiliasi. |

Pengiriman berkala dapat terjadi lebih dari sekali. Desain eksekusi mengandalkan identitas pekerjaan dan perubahan yang dapat diulang dengan aman. Referensi pola operasional tersedia di [dokumentasi Cloud Scheduler](https://docs.cloud.google.com/scheduler/docs/overview).

## Matriks sampel

| Area | Data contoh | Bukti yang dicari |
|---|---|---|
| Dormansi, alias, eskalasi | Free melewati 30/38/45/60 hari, toko pengecualian, saudara aktif, toko moderasi dengan/tanpa banding | Tahap yang tepat, identitas pemilik tetap konsisten, perubahan terbatas pada target, file dan notifikasi dapat direkonsiliasi |
| Billing | Invoice pending lewat batas, paket berbayar habis dan memasuki tenggang, toko Free pembanding | Status invoice/toko serta pengingat sesuai tahap dan tidak ganda |
| Promo, produk aktif, ringkasan | Satu banner, satu toko tanpa banner, produk aktif dan nonaktif, tiket terbuka/selesai | Jumlah sesuai query, label diagnostik manual, periode dan hasil jelas |
| Support, tiket dan item | Tiket menunggu 72 jam, resolusi, billing closed 31 hari dan teknis 31 hari, produk terhapus lunak lebih dari 72 jam, kandidat dilindungi | Pengingat, perubahan status/SLA, purge selektif serta kesesuaian hasil DB dan storage |
| Cleaner, sweeper, log aktivitas | Notifikasi kedaluwarsa dan valid, file draft muda/yatim tua serta file terpakai, log 91 hari Free dan berbayar | Data yang harus tinggal tetap ada, kuota aktual, riwayat retensi yang benar |
| Email, onboarding, SSE | Email ke penampung lokal, dua klien sintetis berbeda, toko baru meminta notifikasi dua kali | Antrean diproses, tiga panduan tanpa duplikasi, satu uji hanya sampai ke akun tujuan |
| Pasar, pencarian, audiens, iklan, trending | Kata kunci/klik, pengunjung lama dan baru, satu impresi/klik, produk dengan aktivitas tujuh hari | Baris mentah, agregat, atribusi, retensi, hitungan dan skor yang dapat diperiksa ulang |
| Host dan CI/CD | Bukti timer, cadangan, restore dan hasil workflow di deployment | Diperiksa terpisah dari worker aplikasi; fixture lokal tidak membuktikan status host produksi |

## Hasil eksekusi di workspace

**Lingkungan pengujian.** Suite Go membuat cluster PostgreSQL baru di direktori temporer dengan port loopback, menjalankan bootstrap skema, menyiapkan direktori media sementara, dan menghentikan cluster setelah tes. Data toko, tiket, notifikasi, kampanye, dan pelanggan SSE dibuat oleh fixture. Pengujian Chromium memuat bundle produksi dari disk dengan respons API terkontrol. Pengujian izin pada router Go memakai pemeriksaan RBAC asli. Penerapan ke server produksi berada di luar pengujian ini.

**Urutan hasil.** Pada baseline awal yang sudah memiliki fixture valid, 17 dari 19 skenario lulus. Satu impresi gagal disimpan karena PostgreSQL tidak menemukan indeks unik untuk target konflik kampanye dan tanggal. Di Windows, satu berkas produk tanpa referensi yang sudah melewati masa tunggu tetap berada di disk. Setelah perbaikan, seluruh 19 skenario lulus sebelum penggantian halaman admin. Suite kemudian diperluas untuk memeriksa pengiriman SMTP yang berhasil, pemusnahan media toko banned, izin, dan batas waktu simulasi.

**Hasil QA backend sebelum keputusan dormansi.** Seluruh 22 skenario awal lulus. Respons katalog Go berisi 25 identitas dan 11 kemampuan pemicu manual, termasuk alias dormansi. Dua eksekusi helpdesk serentak pada tiket yang sama menghasilkan satu pesan resolusi. Percobaan flush iklan yang sengaja diberi transaksi tertutup menghasilkan error. Pada percobaan berikutnya satu impresi tersimpan, dan flush ulang mempertahankan hitungan satu.

| Pekerjaan pada katalog backend | Data dan hasil yang dibuktikan |
|---|---|
| `store_expiry`, `dormancy_worker` | Dua nama pemicu memanggil siklus yang sama. Toko Free yang tidak aktif 31 hari menerima peringatan pertama. Toko pembanding tetap aktif. Kasus ini menguji tahap peringatan. |
| `promo_expiry`, `flash_sale`, `weekly_summary` | Diagnostik mengembalikan hitungan aktual, menyimpan hasil dan identitas operator. Fixture menghasilkan satu toko dengan banner, satu produk aktif, dan nol tiket terbuka. |
| `onboarding_engine`, `sse_hub` | Permintaan ulang mempertahankan tiga panduan awal. Uji pengiriman nyata membuat notifikasi khusus penerima dan menghasilkan frame SSE pada klien tujuan. Klien pembanding tidak menerima frame itu. |
| `support_lifecycle`, `ticket_retention_worker` | Tiket yang menunggu memperoleh pengingat. Tiket billing tertutup 31 hari dimusnahkan dan tiket teknis seusia tetap tersimpan. Jadwal dan pemicu helpdesk menggunakan fungsi transisi yang sama. |
| `item_retention_worker`, `cleaner_worker`, `storage_sweeper` | Produk melewati retensi 72 jam, notifikasi kedaluwarsa, serta berkas yatim tua dibersihkan. Fixture membandingkan produk aktif, notifikasi berlaku, dan berkas draft muda. |
| `search_ingest`, `search_click`, `market_intel_worker` | Event pencarian masuk ke tabel mentah. Klik memperbarui agregat kata kunci. Pemicu pasar membuat hasil agregasi pencarian dan pasar tanggal UTC sebelumnya. |
| `store_ingest`, `store_flush`, `visitor_retention`, `trending` | Antrean dan flush lima detik menghasilkan metrik kunjungan. Event berusia delapan hari dipindah ke agregat secara atomik. Eksekusi retensi kedua mempertahankan hitungan satu. Skor tren fixture berubah menjadi satu. |
| `ad_flush` | Satu impresi menghasilkan satu baris harian untuk kampanye. Indeks unik disediakan lewat model dan migrasi bagi instalasi lama. Rekonsiliasi duplikat historis diperlukan jika migrasi menemukan konflik. |
| `subscription_lifecycle`, `activity_log_cleaner` | Paket berbayar melewati masa aktif masuk tenggang. Log aktivitas toko Free berusia 91 hari dihapus. |
| `moderation_escalator`, `moderation_media_cleanup` | Suspensi moderasi melewati tenggang berubah menjadi banned. Logo toko banned 91 hari dihapus dari penyimpanan dan referensi database dikosongkan, sedangkan baris toko tetap ada. |
| `email_queue` | Kegagalan SMTP lokal menghasilkan status pending dan tenggat retry. Server SMTP penampung menerima email contoh berikutnya dengan alamat yang benar dan antrean menyimpan status sent. |

**Halaman dan sandbox.** Backend menyediakan 25 identitas, termasuk alias, diagnostik manual, dan pekerjaan pantau-saja. Ketiga bundle memakai API status, log, pratinjau, dan pemicu yang sama. Mobile menampilkan kartu, tablet menyediakan pemilih pekerjaan dan panel detail, laptop serta desktop memakai tabel. Nol dan kegagalan pemuatan memiliki tampilan tersendiri. Eksekusi dari katalog memerlukan izin kelola dan konfirmasi. Kotak simulasi memakai dua baris sintetis dengan predikat retensi Go yang sama dengan proses sebenarnya. Pada umur 29, 30, 59, dan 60 hari, jumlah tiket contoh yang memenuhi syarat masing-masing 0, 1, 1, dan 2. Pengiriman panduan nyata memiliki kontrol tersendiri.

**Verifikasi perangkat.** Sebanyak 72 pemeriksaan Chromium lulus pada lebar 375, 390, 800, 960, 1280, dan 1600 px. Setiap ukuran menjalankan 12 pemeriksaan, termasuk render 25 entri dari API, nilai nol, HTTP 503, pesan error worker, hak lihat dan kelola, halaman log berikutnya, atribusi manual, Back, satu permintaan sesudah konfirmasi, serta hasil dan lebar panel simulasi. Build produksi mobile, tablet dan desktop berhasil. Browser menggunakan fixture API. Pengujian router Go dan efek bisnis PostgreSQL dijalankan di suite terpisah.

**Batas penerimaan rilis.** Uji lokal menjalankan fungsi siklus secara langsung atau melalui handler, serta beberapa antrean dan ticker singkat. Kalender harian di host, restart proses lintas replika, beban produksi, dan pengiriman email pihak ketiga belum diverifikasi. Simulasi interaktif saat ini mencakup retensi tiket. Pratinjau data kandidat per tenant untuk setiap aksi destruktif, identitas eksekusi lintas proses, pemulihan pekerjaan setelah proses mati, serta metrik untuk seluruh kegagalan parsial tetap menjadi pekerjaan fase 4 dan 6. Temuan isolasi pada dormansi 60 hari telah ditindaklanjuti sesuai keputusan pengelola pada bagian berikut.

**Regresi repositori.** Lima kelompok tes handler juga gagal pada salinan terpisah dari HEAD sebelum perubahan. Satu kelompok berkaitan dengan registrasi paket berkupon. Empat lainnya memeriksa akses staf ke tiket atau lampiran. Hasil identik diperoleh dalam suite backend setelah perubahan. Kelompok tersebut perlu ditangani terpisah sebelum menjadikan suite global sebagai syarat rilis hijau.

## Keputusan pengelola dan perubahan penghapusan

Pengelola menetapkan ID toko sebagai batas operasi katalog. Kebijakan ini berlaku juga ketika katalog tersebut adalah toko terakhir. Hanya permintaan penghapusan total akun yang terverifikasi dapat memilih semua toko berdasarkan ID pemilik.

| Peristiwa | Cakupan dan hasil |
|---|---|
| Login dan beralih toko | Aktivitas diperbarui untuk ID toko dalam konteks yang dipilih. Login ke satu katalog mempertahankan waktu aktivitas katalog saudara. |
| Dormansi hari ke-60 atau hapus satu katalog | Hapus data operasional dan media milik ID toko terpilih. Pemeriksaan dormansi memvalidasi ulang status, alasan penangguhan, pengecualian, dan batas waktu sambil mengunci baris. Akun pemilik tetap dapat digunakan setelah toko terakhir dihapus. |
| Helpdesk dan notifikasi | Notifikasi khusus toko dibersihkan. Tiket yang terkait toko dilepas dari katalog yang dihapus agar percakapan dan lampiran tetap mengikuti aturan helpdesk. Tiket toko saudara dan pesan bertarget akun tetap tersedia. |
| Moderasi otomatis | Pemeriksaan tiket menggunakan ID toko. Eskalasi sanksi suatu katalog memperbarui status katalog itu. Penelusuran media untuk penghapusan dibatasi pada direktori ID toko. |
| Penghapusan total akun | Endpoint memeriksa identitas dan konfirmasi serta menerapkan pemeriksaan kata sandi atau MFA sesuai konfigurasi akun. Transaksi mengunci pemilik dan daftar toko, menghapus katalog miliknya beserta tiket akun dan sesi, lalu menjalankan pembersihan berkas setelah commit. |
| Pengecualian menurut kebijakan platform | Snapshot invoice langganan dan iklan disimpan pada tabel arsip terpisah. Persetujuan kebijakan tetap tersimpan setelah relasinya dengan toko atau akun dilepas. [Ketentuan retensi platform](../../backend/internal/database/policy_defaults.go) |
| Gangguan pembersihan media | Pekerjaan pembersihan untuk ID toko atau akun direkam pada transaksi yang sama dengan penghapusan. Jika proses terputus setelah commit, sweeper penyimpanan dapat mencoba ulang. |

**Penerapan.** Migrasi N62 perlu tersedia sebelum backend baru melayani pemicu penghapusan. Migrasi membuat arsip transaksi dan antrean pembersihan media. Pengujian menggunakan PostgreSQL dan penyimpanan temporer. Backend dan migrasi belum diterapkan ke lingkungan produksi. [Migrasi N62](../../backend/internal/database/migrations/20261119_n62_retained_store_orders.sql) · [Penghapusan berdasarkan ID](../../backend/internal/services/store_deletion.go)

### Bukti QA atas keputusan pengelola

Fixture PostgreSQL menggunakan akun dengan dua katalog dan akun pembanding yang terpisah. Skenario memeriksa data sebelum dan sesudah melewati jalur login, pemicu dormansi, endpoint hapus satu toko, serta endpoint hapus akun.

- Login ke toko terpilih memperbarui waktu aktivitas toko itu. Waktu aktivitas toko saudara tetap pada nilai awal.
- Dua siklus dormansi atas data yang sama membersihkan satu katalog beserta produk dan berkasnya. Tiket terbuka tetap dapat ditemukan, termasuk tiket toko saudara. Sesi dan akun pemilik tetap tersedia. Penghapusan toko terakhir juga diuji.
- Permintaan hapus satu katalog melalui API mempertahankan dua toko lain milik akun yang sama. Rollback transaksi mempertahankan katalog dan membatalkan catatan antrean pembersihan berkas. Simulasi interupsi setelah commit meninggalkan pekerjaan yang kemudian diselesaikan sweeper.
- Frasa konfirmasi yang keliru ditolak. Penghapusan akun yang terverifikasi membersihkan dua katalog tersisa, sesi, tiket, notifikasi akun, dan lampiran privat. Katalog pemilik lain tetap tersedia. Nilai invoice langganan serta iklan dapat diperiksa dalam arsip, dan baris persetujuan kebijakan tetap tersimpan.
- Uji endpoint MFA pada PostgreSQL sementara yang terpisah mengembalikan HTTP 428 saat faktor kedua diperlukan. Penghapusan berhasil setelah kode cadangan yang sah diberikan. Ketiga build frontend berhasil. Uji berkas menggunakan driver lokal. Pengujian terhadap bucket S3/R2 produksi berada di luar cakupan verifikasi ini.

[Skenario isolasi toko dan akun](../../backend/internal/handlers/automation_runtime_test.go) · [Uji penghapusan dengan MFA](../../backend/internal/handlers/mfa_postgres_disposable_test.go)

### Menjalankan ulang

- Di direktori `backend`, jalankan `go test -tags automationqa ./internal/handlers -run "^TestAutomationRuntime$" -count=1 -timeout=8m -v`. Biner `initdb` dan `pg_ctl` harus tersedia pada PATH. Gunakan akun lokal yang diizinkan PostgreSQL untuk membuat cluster.
- Jalankan `npm run build` di masing-masing `frontend/mobile`, `frontend/tablet`, dan `frontend/desktop`. Sesudahnya jalankan `node --test tests/audit/automation-engine.test.cjs` di akar repositori dengan dependensi Playwright dan Chromium terpasang.
- Jalankan `go test ./...` di direktori `backend` untuk pemeriksaan global. [Fixture PostgreSQL](../../backend/internal/handlers/automation_runtime_test.go) · [Suite browser](../../tests/audit/automation-engine.test.cjs) · [Katalog backend](../../backend/internal/services/automation_catalog.go)

## Pilihan skill

Keduanya tersedia secara lokal di direktori skill proyek. Direktori tersebut diabaikan Git, sehingga checkout baru memerlukan pemasangan ulang.

Dua tambahan dipasang pada `.agents/skills` proyek. Modern Web Guidance dari Chrome menjadi rujukan platform web, dan webapp-testing dari Anthropic mendukung pengujian UI lokal melalui Playwright. Panduan estetika Catavor dan disiplin clean code yang sudah ada mencakup kebutuhan anti-slop serta penyederhanaan kode yang juga ditawarkan Ponytail. Untuk logika worker, pengujian Go dengan PostgreSQL dan bukti perubahan data lebih relevan daripada menambah paket pedoman generik. [Chrome](https://developer.chrome.com/docs/modern-web-guidance) · [Webapp testing](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) · [Ponytail](https://github.com/DietrichGebert/ponytail)
