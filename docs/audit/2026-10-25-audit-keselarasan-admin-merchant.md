# Audit Keselarasan Fitur Admin Merchant — Mobile / Tablet / Desktop

**Tanggal:** 25 Oktober 2026
**Objek:** `catavor/frontend/{mobile,tablet,desktop}` + `catavor/backend` + instance live `http://localhost:8001`
**Sifat:** audit read-only. Tidak ada satu pun file kode yang diubah.
**Penyusun:** QA agent (deepseek-flash) + 4 sub-agen pemetaan paralel.

---

## 0. Cara membaca laporan ini

Setiap temuan punya label sumber:

| Label | Arti |
|---|---|
| **[V]** | Saya verifikasi sendiri: membaca kode langsung, dan/atau menguji runtime ke server 8001. |
| **[S]** | Dilaporkan audit sub-agen dengan bukti `file:baris`, **belum** saya cek ulang baris demi baris. |

Nomor baris pada label **[S]** tetap dicantumkan supaya Anda bisa memeriksa cepat. Temuan **[S]** yang bersifat "tidak ada" (absence, mis. "tidak ada input stok") sudah saya uji silang dengan ripgrep, jadi keyakinannya lebih tinggi daripada temuan absence biasa.

---

## 1. Ringkasan eksekutif

**Kesimpulan utama:** ketiga device **sudah berbagi kontrak backend yang sama** (endpoint dan tabel identik), tetapi **belum selaras pada lapisan flow, kelengkapan fitur, dan perilaku UX**.

Dari 14 modul admin merchant yang dipetakan:

| Status | Jumlah | Modul |
|---|---|---|
| Selaras (flow setara) | 5 | Daftar Item, Analitik, Langganan, Bantuan/Tiket, Legal & Kebijakan |
| Divergen (ada di semua, tapi alur/penempatan beda) | 6 | Kategori Etalase, Pengaturan, Profil, Notifikasi, Bagikan/QR, Log Aktivitas |
| Divergen jalur akses (hanya lewat Konsol Platform, tidak dari panel merchant) | 2 | Staf & Hak Akses (RBAC), Portal Staf |
| Tidak berfungsi / mati | 1 | Artikel (mobile: key terdaftar tanpa renderer) |

**Tiga hal yang paling mendesak** (detail di §8 dan §9):

1. **P0 — Data hilang saat arsip item dari mobile.** `PUT /api/products/:id` dari mobile mengirim payload parsial tanpa `max_order`; backend menimpa `MaxOrder` tanpa syarat (`product_handler.go:753`). Setiap "Arsipkan" di mobile **menghapus batas maksimal pembelian** produk tersebut. [V]
2. **P0 — Bypass RBAC platform lewat namespace merchant.** Rute tenant hanya dijaga `StoreOwnerRequired`, tanpa `RequirePermission`. Staf platform berperan apa pun (mis. `support`) bisa membuat/mengubah produk dan **menghapus permanen toko merchant** mana pun (`main.go:315`, `store_handler.go:2030-2063`). [V]
3. **P1 — Tablet tidak bisa mengisi stok dan satuan.** Form katalog tablet tidak memiliki input `stock` maupun `unit`; nilainya hanya dari state default (`TabletMerchantAdmin.tsx:1095,1578`). Merchant yang mengelola lewat tablet tidak dapat memperbarui stok. [V]

**Mulai dari mana (urutan kerja yang saya sarankan):**

1. Perbaiki P0 data-loss (1 baris backend) + P0 otorisasi (perlu keputusan desain, lihat §9.3).
2. Tambal bug fungsional murah: revoke staf 404 di mobile/tablet, input stok/unit tablet, field `portion_size`/`prep_time` desktop.
3. Satukan pola paginasi & navigasi sesuai standar AGENTS.md (§6 laporan ini) — ini yang paling mahal, kerjakan setelah P0 stabil.
4. Sisir kebocoran data publik (§9.2).

---

## 2. Metodologi & batasan

**Yang dikerjakan:**
- Pemetaan 3 codebase frontend (total ±174.000 baris TSX/TS) per device: navigasi, layar, form, endpoint.
- Pembacaan `cmd/server/main.go` (registrasi seluruh rute), `middleware/auth.go`, `middleware/rbac.go`, `handlers/product_handler.go`, `handlers/setting_handler.go`, `handlers/store_handler.go`, `services/subscription_service.go`.
- Uji runtime GET ke `http://localhost:8001`: `/healthz`, `/`, `/desktop|tablet|mobile`, `/api/settings`, `/api/u/adidas`.
- Audit backend terfokus area merchant oleh sub-agen, lalu saya verifikasi ulang temuan berperingkat tertinggi.

**Batasan yang harus Anda tahu:**
- **Tidak ada kredensial**, jadi **tidak ada uji login dan tidak ada uji otorisasi lintas-akun secara runtime**. Semua temuan IDOR/authz berbasis pembacaan kode, bukan pembuktian eksploitasi.
- Tidak ada browser interaktif; verifikasi visual/gesture tidak dilakukan. Temuan UX berasal dari kode (nilai px, pola komponen), bukan tangkapan layar.
- Server 8001 hidup, tetapi **dua instance juga hidup di 8000** (`uptime` berbeda). Audit tidak memastikan instance mana yang dipakai pengguna; ini sendiri layak dibereskan (lihat §10.3).
- Verifikasi tri-build **tidak dijalankan** karena sesi berjalan dengan token terbatas: perintah yang menulis di dalam `catavor` (termasuk `npm run build` → `dist`, `tsc -b` → `node_modules/.tmp`) ditolak OS. Penyebabnya bukan kode, melainkan direktori `catavor` tidak memiliki entri izin sandbox (`S-1-4-*`) yang dimiliki root workspace. Temuan ini di luar lingkup aplikasi tetapi memblokir QA build.

---

## 3. Inventaris fitur per device

### 3.1 Peta navigasi

| Modul | Mobile | Tablet | Desktop |
|---|---|---|---|
| Gerbang admin | bottom nav 4 tombol (`App.tsx:31282-31344`) [S] | route `/admin` + cek `isPlatformAdmin` (`App.tsx:418-431`, `:937`) [S] | sidebar `MerchantAdminShell` [V] |
| Daftar Item | tab "Inventaris" (`:31308`) [S] | rail `items` (`:2801`) [V] | sidebar `items` (`MerchantAdminShell.tsx:181`) [V] |
| Kategori Etalase | **di dalam Pengaturan → sub "master"** [S] | rail `categories` (`:2802`) [V] | sidebar `categories` (`:188`) [V] |
| Analitik | grid Menu → Analitik, 3 sub-tab [S] | rail `analytics` (`:2808`) [V] | sidebar `analytics` (`:199`) [V] |
| Langganan | grid Menu → Langganan, 4 sub-view [S] | rail `subscription` (`:2809`) [V] | sidebar `subscription` (`:213`) [V] |
| Pengaturan | bottom nav (`:31320`) [S] | rail `settings` (`:2816`) [V] | sidebar `settings` (`:208`) [V] |
| Profil / Akun | grid Menu → Profil Akun (`:24798`) [S] | rail `profile` (`:2817`) [V] | sidebar `profile` (`:221`) [V] |
| Notifikasi | **ikon lonceng di header**, bukan menu (`:22276`) [S] | rail `notifications` (`:2823`) [V] | sidebar `notifications` (`:239`) [V] |
| Bantuan / Tiket | grid Menu (`:24836`) [S] | rail `help` (`:2824`) [V] | sidebar `help` (`:231`) [V] |
| Legal & Kebijakan | grid Menu (`:24899`) [S] | rail `policies` (`:2825`) [V] | sidebar `policies` (`:247`) [V] |
| Bagikan / QR | sheet aksi header (`:11617`, `:31082`) [S] | rail `share` → layar penuh (`:2826`, `:9749-9781`) [S] | **modal QR, tanpa entri menu** (`App.tsx:10240-10241`) [S] |
| Log Aktivitas | grid Menu "Riwayat Log" (`:24937`) [S] | rail `audit_logs` → layar (`:2810`) [V] | **sub-tab di Profil** (`App.tsx:24058`, `:24121-24144`) [S] |
| Staf & RBAC | grid Menu, `isSuperAdmin` (`:24975`) [S] | **tidak ada di panel merchant** (0 kemunculan `rbac` di `TabletMerchantAdmin.tsx`); hanya di Konsol Platform (`TabletPlatformConsole.tsx:59`, `:3088`) [V] | sidebar kondisional `isSuperAdminUser` (`:257-265`) [V] |
| Portal Staf | grid Menu, `isPlatformAdmin` (`:25014`) [S] | **tidak ada di panel merchant**; direpresentasikan sebagai Konsol Platform terpisah (`App.tsx:418-427`) [V] | sidebar kondisional `isPlatformAdminUser` (`:266-272`) [V] |
| Artikel | key `articles` ada di parser URL, tanpa cabang render (`:11725`) [S] | tidak ada [V] | key ada (6 kemunculan), perlu ditelusuri [V] |

**Catatan struktural:** mobile **tidak** punya layar Kategori Etalase tersendiri (0 kemunculan `categories` sebagai tab di `App.tsx`) [V]; fungsinya menempel di Pengaturan → Master. Desktop & tablet menjadikannya menu tingkat satu. Ini divergensi arsitektur informasi, bukan sekadar styling.

### 3.2 Isi layar

Semua device melayani kebutuhan yang sama: daftar item, form item, kategori, analitik, langganan, pengaturan, profil, notifikasi, helpdesk, legal, log. Perbedaan penyajian:

| Aspek | Mobile | Tablet | Desktop |
|---|---|---|---|
| Daftar item | kartu 1 kolom (`:25403`) [S] | Master-Detail split 38/62 (`TabletMasterDetailView.tsx:55`) [S] | tabel 6 kolom (`App.tsx:22387-22465`) [S] |
| Aksi per item (daftar) | Detail, Arsip/Aktifkan (`:25483`) [S] | pilih kartu → detail; hapus di header form (`:4345-4367`) [S] | Detail, Arsip/Aktifkan — **tanpa Edit/Hapus** di baris (`:22681-22686`) [S] |
| Form item | sheet penuh (`:21308`) [S] | panel kanan (`:4043-4045`) [S] | modal tengah `max-width 940px` (`:29546-29563`) [S] |
| Notifikasi | tab all/unread/security/system + infinite scroll (`:27295`) [S] | master-detail + filter yang sama (`:8529`) [S] | filter + paginasi 20/hal (`:25584`) [S] |
| Helpdesk | daftar + chat (`:29222`) [S] | master-detail + chat (`:9346-9374`) [S] | daftar + thread, limit 15 (`:8084`) [S] |

---

## 4. Matriks keselarasan (inti laporan)

Legenda: **S** selaras · **D** divergen · **H** hilang · **M** mati/tidak berfungsi.

| # | Modul | M | T | D | Status | Catatan |
|---|---|---|---|---|---|---|
| 1 | Daftar Item + form | ok | ok | ok | **S** | kontrak payload seragam; beda penyajian wajar |
| 2 | Kategori Etalase | sub Pengaturan | menu | menu | **D** | mobile tidak punya layar sendiri |
| 3 | Analitik | ok | ok | ok | **S** | filter periode & tipe setara |
| 4 | Langganan | ok | ok | ok | **S** | mobile punya 4 sub-view, tablet/desktop modal |
| 5 | Pengaturan | general/contact/about/**theme**/**master**/domain/akun | general/contact/about/domain/**danger** | general/contact/about/**theme**/**master**/domain | **D** | tablet kehilangan theme & master; danger pindah ke Pengaturan |
| 6 | Profil / Akun | sub-tab di-set tapi tampak tidak dibaca (`:27197` vs `:17298`) [S] | info/devices/audit_logs/danger | info/security/logs/danger | **D** | tiga struktur sub-tab berbeda |
| 7 | Notifikasi | header bell | rail | rail | **D** | penempatan beda; isi setara |
| 8 | Bantuan / Tiket | ok | ok | ok | **S** | |
| 9 | Legal & Kebijakan | ok | ok | ok | **S** | |
| 10 | Bagikan / QR | sheet aksi | layar penuh | modal tanpa menu | **D** | tiga bentuk untuk satu fungsi |
| 11 | Log Aktivitas | grid Menu | rail layar sendiri | sub-tab Profil | **D** | lokasi beda + endpoint perlu disamakan |
| 12 | Staf & RBAC | ok | hanya Konsol Platform | ok | **D** | tablet tidak mengenal "staf" di panel merchant; seluruh urusan platform lewat konsol terpisah |
| 13 | Portal Staf | ok | hanya Konsol Platform | ok | **D** | idem — akses `/admin` oleh platform admin di tablet dialihkan ke konsol (`App.tsx:418-427`) |
| 14 | Artikel | key tanpa renderer | — | key ada | **M** | indikasi dead code di mobile |

**Arti praktis:** merchant yang sama akan **merasa memakai tiga aplikasi berbeda** saat berpindah device. Yang paling mencolok: mencari Kategori Etalase, mencari Log Aktivitas, dan mencari tombol Bagikan.

---

## 5. Keselarasan flow: yang sudah benar

Perlu dicatat secara adil — bagian ini **tidak** perlu diperbaiki, dan mengubahnya justru berisiko:

1. **Kontrak backend tunggal.** Ketiga device memakai endpoint dan model data yang sama (`/api/products`, `/api/stores/update`, `/api/subscription/*`, `/api/support/tickets`, `/api/notifications`). Tidak ada skema terpisah per device. [V]
2. **Aturan kondisional per tipe katalog konsisten.** Ketiganya memaksa: `min_order/max_order` diabaikan untuk `service`/`property`; `is_shipping_available = false` untuk service/digital/property; `enable_wa_rekber = false` untuk property; `warranty_info` dikosongkan untuk service. Tablet: `TabletMerchantAdmin.tsx:1564-1606` [S]; desktop: `App.tsx:13558-13561` [S]; mobile: selaras dengan acuan.
3. **Cakupan atribut domain 7 tipe nyaris penuh di ketiga device.** Dari 40 atribut domain yang saya uji, hanya `expired_info` (food) yang tidak ditemukan di tablet. [V]
4. **Pengaman aktivasi & kuota berjalan di backend**, bukan hanya UI: `CanEditOrReactivateProduct` (`product_handler.go:642`) dan batas item aktif di mobile (`App.tsx:9854-9859`) [V].

---

## 6. Penyimpangan pola UX (bukan sekadar visual)

### 6.1 Paginasi — tiga pola, dua melanggar standar

| Device | Pola aktual | Standar AGENTS.md §7.C | Status |
|---|---|---|---|
| Mobile (inventaris) | **client-side**, 10/hal dari satu fetch + pager angka (`App.tsx:7313`, `:7365`) [V] | load-more / infinite + counter | **Melanggar** |
| Mobile (notifikasi/log/analitik) | infinite scroll & server-side per_page (`:5666`, `:17817`, `AnalyticsPage.tsx:293`) [S] | sesuai | Sesuai |
| Tablet (inventaris) | server-side `page&limit=15` + segmented pill, paginasi terisolasi per panel (`:1172-1208`, `:4016-4032`) [S] | touch pager 44px + quick jumper | **Sebagian**: tanpa quick jump |
| Desktop (inventaris) | server-side; pilihan baris 10/25/50; hanya Prev/Next (`:22455-22459`, `:22927-22965`) [S] | 10/25/50/**100**, Awal/Sebelumnya/Selanjutnya/Akhir, ringkasan X–Y dari Z, quick jump | **Melanggar** (tanpa 100, tanpa Awal/Akhir, tanpa quick jump) |

Konsekuensi mobile bukan kosmetik: karena filter server (`?view=merchant`) mengembalikan satu batch lalu dipotong 10 per halaman di klien, store dengan katalog besar akan memuat seluruh isi katalog ke memori dan tidak pernah memakai paginasi server untuk daftar.

### 6.2 Navigasi kembali — pelanggaran aturan mandatori §1 AGENTS.md

Desktop masih meng-hardcode tujuan tombol kembali/keluar di tiga tempat:

```
App.tsx:29262-29266  onBack  SubscriptionPage  -> setAdminTab('items')
App.tsx:29277-29281  onClose AdminRBACManagement -> setAdminTab('items')
App.tsx:29297-29301  onClose PlatformRolePortal  -> setAdminTab('items')
```

Ini persis pola yang dilarang ("Never Hardcode Back Button Destinations"): merchant yang masuk ke Langganan dari notifikasi akan mendarat di Daftar Item, bukan ke asal. [V]

Metrik kepatuhan seluruh device:

| Device | `history.back()` | `useModalBackHandler`/`setupModalBackInterceptor` | `history.pushState` |
|---|---|---|---|
| Mobile | 6 | 38 | 111 |
| Tablet | 2 | 41 | 16 |
| Desktop | 6 | 26 | 95 |

[V] Bacaan: overlay sudah banyak memakai utilitas resmi, tetapi **sinkronisasi URL-state tablet paling lemah** (16 vs 111 mobile), sehingga tombol back browser di tablet lebih sering keluar dari konteks admin (§3 AGENTS.md).

### 6.3 Modal, bottom sheet, dan tombol tutup

| Aturan | Mobile | Tablet | Desktop |
|---|---|---|---|
| Bottom sheet untuk mobile | mayoritas ya, fisika drag sesuai standar (`transition:none` saat drag, pegas 0.28s, ambang 70px) (`:7059-7112`) [S] | n/a | n/a |
| Tanpa tombol "X" di header sheet mobile | **dilanggar**: modal rename master (`:32348`), preset (`:32415`), kebijakan (`:32323`), Edit Gambar (`:32154`) [S] | X diizinkan (centered panel) | n/a |
| Tanpa `<select>` native di mobile | **dilanggar** satu tempat (`:31211`) [S] | n/a | n/a |
| Semua overlay punya back interceptor | **6 overlay belum**: `crudDropdownPicker`, rename/preset/hapus master, Edit Gambar, kebijakan cepat (`:33642`, `:32338`, `:32405`, `:31197`, `:32151`) [S] | pushState 16 → perlu audit menyeluruh [V] | 26 pemakaian untuk banyak modal → perlu audit menyeluruh [V] |
| Konfirmasi destruktif memakai modal terdesain | ya | ya | **tidak**: `window.confirm` untuk hapus item (`App.tsx:13972`) [V] |

### 6.4 Touch target & ikonografi

- Tablet: beberapa kontrol di bawah 44px — pill status 30px (`:5995-6013`), tombol filter 34px (`:3501`), tombol kembali panel 38px (`TabletMasterDetailView.tsx:111`), tombol hapus 38px (`:4351`). [S]
- Mobile: tombol aksi kartu ±28px (`:25403`), pill filter ±24px (`:25131`), pager 32×32 (`:25535`). [S]
- **Emoji di antarmuka bisnis (dilarang §6 AGENTS.md)**: mobile masih memakai `💡` (`:20997`), `⚡` (`:24336`, `:21457`), `🔒` (`:25182`) [S]; desktop memakai `➕` pada opsi kategori (`:29945`) [S].
- Target sentuh 44px tablet **hanya sebagian** terpenuhi — ini yang paling terlihat oleh pengguna tablet karena kontrolnya kecil dan berdekatan.

---

## 7. Form katalog 7 tipe — matriks kelengkapan

Kolom "M/T/D" menandakan ada tidaknya input form (bukan ada tidaknya tampilan di tabel).

| Tipe | Field wajib domain | M | T | D |
|---|---|---|---|---|
| physical | condition, weight, brand, variant | ya | ya | ya |
| food | halal_status, variant, portion_size, prep_time, storage_temp, expired_info, delivery_condition | ya | **sebagian** (tanpa `expired_info`) | **sebagian** (`portion_size`, `prep_time` hanya tampil di tabel, `App.tsx:22734`) |
| digital | file_format, file_size, license_type, delivery_condition | ya | ya | ya |
| service | duration, service_location, service_area, purchase_links | ya | ya | ya |
| plant | scientific_name, sunlight, watering, planting_medium, plant_size, protection_status, delivery_condition, conservation_status | ya | ya | ya |
| fauna | scientific_name, habitat, diet, native_region, lifespan, weight, delivery_condition, conservation_status, warranty_info | ya | ya (`weight` text, bukan number — `:5106-5109`) | ya |
| property | transaction_type, certificate, land_area, building_area, bedrooms, bathrooms, floors, carport, electricity, water_source, furnishing, facing, property_location | ya | ya | ya |

**Field umum lintas tipe:**

| Field | Mobile | Tablet | Desktop |
|---|---|---|---|
| Nama | ya (`:19485`) | ya (`:4378`) | ya (`:29719`) |
| Harga Rupiah | ya (`:19497`) | ya (`:4414`) | ya (`:29968`) |
| **Stok** | ya | **TIDAK ADA** [V] | ya |
| **Satuan / unit** | ya | **TIDAK ADA input** — hanya default (`:1095`, `:1578`) [V] | ya |
| Kategori | bottom-sheet picker + buat baru (`:19551`) | `TabletCustomSelect` + buat baru (`:4592-4629`) | `DesktopCustomSelect` + buat baru (`:29929`) |
| Min/Maks order | ya | ya (kondisional) | ya |
| Foto 1–10 + badge sampul | ya (`:20595`) | ya (`:5313-5349`) | ya (`:30612`) |
| Video preview | `VideoPreviewInput` | `VideoPreviewInput` | `VideoPreviewInput` |
| Link marketplace | ya, disembunyikan untuk property | ya (`:5585`) | ya (`:30831-30934`) |
| Rekber / WA direct + pilih kontak | ya | ya (`:5734-5861`) | ya (`:30975`, `:31058`, `:31114`) |
| Syarat kirim & garansi | ya | ya (`:5870-5895`) | ya (`:31136-31166`) |
| Deskripsi | wajib kecuali food | wajib kecuali food (`:5901-5905`) | wajib kecuali food (`:31175`) |
| Publikasi/Arsip | radio (`:21247`) | radio (`:5919-5967`) | toggle (`:31194-31228`) |
| Field zombie | `attributes.facilities` di-hydrate & dikirim tanpa kontrol (`:1617`, `:13764`) [S] | — | — |

**Kesimpulan form:** kelengkapan atribut domain sudah baik; yang bolong justru **field operasional dasar** (stok & satuan di tablet) dan **field F&B opsional** (desktop, dan tablet untuk `expired_info`). Ini jenis gap yang tidak terlihat saat demo karena defaultnya masuk akal (`Pcs`, stok lama), tetapi mematikan pengelolaan inventori dari tablet.

---

## 8. Celah bug fungsional (bukan keamanan)

| ID | Bug | Device | Bukti | Dampak | Status |
|---|---|---|---|---|---|
| B-01 | **Arsip item menghapus `max_order`** — klien mengirim PUT parsial (nama, scientific_name, class, price, description, is_active) tanpa `max_order`; backend menetapkan `product.MaxOrder = req.MaxOrder` **tanpa syarat** | Mobile | `App.tsx:9863-9877` + `product_handler.go:753` | Batas maksimal pembelian hilang setiap kali item diarsipkan/diaktifkan ulang | **[V]** |
| B-02 | **`price` bisa ter-reset ke 0** — `if req.Price >= 0 { product.Price = req.Price }`; field absen = 0 = lolos kondisi | Semua klien yang mengirim PUT tanpa `price` | `product_handler.go:747-749` | Produk bisa terjual Rp 0 | **[V]** |
| B-03 | **Cabut staf 404 di 2 device** — endpoint `POST /api/admin/rbac/staff/{id}/revoke` tidak terdaftar; yang ada `POST /api/admin/rbac/staff/revoke` | Mobile, Tablet | `mobile/AdminRBACManagement.tsx:305`, `tablet/…:306` vs `main.go:482` | Tombol "Cabut wewenang staf" selalu gagal, pesannya menyamar sebagai error generik | **[V]** |
| B-04 | **Tablet tidak bisa set stok & satuan** | Tablet | `TabletMerchantAdmin.tsx:1095`, `:1578` (tanpa input) | Pengelolaan inventori tidak mungkin dari tablet | **[V]** |
| B-05 | **`portion_size` & `prep_time` tak bisa diisi** padahal dipakai kolom tabel | Desktop | tampil `App.tsx:22734`, tanpa input | Data F&B hanya bisa diisi dari mobile | **[S]** |
| B-06 | `expired_info` food tidak ada di form tablet | Tablet | 0 kemunculan | Data kedaluwarsa tidak bisa diisi | **[V]** |
| B-07 | `weight` fauna bertipe teks (bukan number) | Tablet | `:5106-5109` | Input "1kg"/"1000" tidak konsisten | **[S]** |
| B-08 | Validasi klien tipis: tablet hanya 3 cek (nama, tipe, foto) — `required` HTML mudah dilewati submit programatik | Tablet | `:1506-1519` | Data tidak lengkap bisa tersimpan | **[S]** |
| B-09 | `view === 'article-editor'` di-set tanpa cabang render | Mobile | `App.tsx:14232`, `:14250` | Kandidat dead code; item artikel tak bisa diedit | **[S]** |
| B-10 | Pencarian `LIKE` tanpa escape wildcard | Backend | `product_handler.go:140-143`, `activity_log_handler.go:81-85`, `analytics_handler.go:994-996` | `%` memperluas hasil, pola berawalan wildcard = full scan | **[S]** |

**Catatan pada B-01/B-02:** ini memperlihatkan desain `PUT` yang **merge parsial tanpa penanda field mana yang dikirim**. Solusi yang benar bukan menambal satu field, melainkan pointer/optional untuk semua field yang boleh dikosongkan (`*int`, `*string`) atau endpoint khusus `PATCH /products/:id/status`. Menambah `if req.MaxOrder != nil` saja akan memperbaiki gejalanya, bukan sebabnya.

---

## 9. Keamanan

### 9.1 Bukti runtime (saya jalankan langsung ke 8001)

**R-01 — `/api/settings` publik mengembalikan seluruh tabel settings.** [V]

```
GET /api/settings  ->  200, 29 key
```

Key yang ikut terkirim antara lain: `rekber_wa_number`, `rekber_partner_name`, seluruh `rekber_template_*`, `whatsapp_number`, `ads_client_id`, `ads_txt_content`. Handler melakukan `h.db.Find(&settings)` lalu memetakan **semua** key (`setting_handler.go:30-36`) — tidak ada allowlist.

Implikasinya lebih dari sekadar konfigurasi: `master_coupons` dibaca dari tabel yang sama (`subscription_service.go:590-609`), dan kupon bertipe `free` membuat `finalAmount = 0` → `payment_status = "paid"` → **paket langsung aktif tanpa approval admin** (`subscription_service.go:625-630`, `:670-675`). Pada instance lokal ini `master_coupons` belum ada, jadi belum bocor; begitu operator membuat kupon, **kode kupon otomatis menjadi publik**. [V untuk mekanisme, kondisi data]

**R-02 — `/api/u/:slug` membocorkan field internal.** [V]

```
GET /api/u/adidas  ->  200, memuat:
user_id, plan, plan_status, payment_status, storage_used_bytes,
dormancy_status, is_blacklisted, is_suspended, suspension_reason,
is_exempt_from_dormancy, registration_timezone
```

Model `Store` dikirim utuh. Untuk toko publik, `user_id` pemilik, paket langganan, status pembayaran, kuota terpakai, dan alasan penangguhan bukan informasi publik.

**R-03 — dua instance hidup bersamaan.** [V] `8000` dan `8001` sama-sama menjawab `/healthz` dengan `uptime` berbeda. Berisiko: build lama vs baru, dan audit/uji bisa mengenai instance yang salah.

### 9.2 Daftar temuan keamanan

| ID | Temuan | Tingkat | Bukti | Verifikasi |
|---|---|---|---|---|
| F-01 | Settings publik membocorkan seluruh konfigurasi, termasuk kupon yang bisa membuka paket gratis | **Kritis** | `main.go:233`, `setting_handler.go:30-36`, `subscription_service.go:590-630` | **[V]** + R-01 |
| F-02 | **Hapus toko permanen tanpa permission**: rute hanya `AuthRequired`; handler meloloskan **semua** staf platform (`IsPlatformStaff()`) dan **melewati verifikasi password** untuk staf | **Kritis/Tinggi** | `main.go:315-316`, `store_handler.go:2030-2036`, `:2055-2063` | **[V]** |
| F-03 | Bypass RBAC lewat namespace tenant: `guarded*` tidak memakai `RequirePermission` sama sekali; staf platform berperan apa pun bisa `POST/PUT/DELETE /api/products` untuk toko mana pun via header `X-Store-Slug`, dan `OperationalStoreRequired` **meloloskan semua staf** (`auth.go:505`) | **Tinggi** | `main.go:336-462`, `auth.go:385-419`, `:503-507`, `rbac.go:15-61` | **[V]** |
| F-04 | `/api/u/:slug` mengembalikan model internal + cache Redis 300s | Tinggi | `store_handler.go:274-286` | **[V]** + R-02 |
| F-05 | Audit log kebijakan platform terbuka untuk merchant (berisi `admin_email`, `admin_ip`) | Tinggi | `main.go:411`, `setting_handler.go:400-413` | **[S]** (registrasi rute **[V]**) |
| F-06 | Klaim JWT (`StoreID`/`StoreSlug`) dipercaya tanpa verifikasi kepemilikan DB → token lama masih membuka produk arsip & metrik inventori | Sedang | `store_handler.go:40-64`, `:534`, `:746` | **[S]** |
| F-07 | `category_id` lintas tenant diterima pada produk; hapus kategori melepas `category_id` lintas tenant | Sedang | `product_handler.go:684-709`, `category_handler.go:282` | **[S]** |
| F-08 | Lampiran tiket menerima `storage_key` arbitrer → bila kunci tenant lain diketahui, file privatnya bisa dilampirkan & diunduh | Sedang | `support_handler.go:2500-2535`, `:2337-2419` | **[S]** |
| F-09 | JWT dikembalikan di body JSON (`SwitchStore`, `CreateStore`) — meniadakan proteksi HttpOnly | Sedang | `store_handler.go:1854`, `:1922`, `:1968` | **[S]** |
| F-10 | `POST /api/policies/agree` publik menerima `store_id` sembarang → mencemari bukti persetujuan legal | Sedang | `main.go:235`, `setting_handler.go:417-443` | **[S]** |
| F-11 | RBAC tidak berlaku untuk merchant: tidak ada model staf toko; `/api/admin/rbac/*` butuh `RequireAdmin` → pembatasan peran hanya di frontend | Sedang | `main.go:474`, `models/rbac.go` (hanya `PlatformRole`) | **[V]** |
| F-12 | Upload: PDF diterima untuk semua kategori; namespace `support`/`articles` tidak di-scope tenant & tidak dihitung kuota | Rendah | `storage_handler.go:138-149`, `:257`, `:279-299` | **[S]** |
| F-13 | Sanitasi tidak konsisten (`store_theme`, `replacement_option`) | Rendah | `store_handler.go:1288`, `:1303`, `:1739` | **[S]** |
| F-14 | Type assertion tanpa `ok` → panic 500 pada rute tenant | Rendah | `store_handler.go:933`, `:1116`, `:1146` | **[S]** |
| F-15 | Rate limit hanya global 300/menit per IP, in-memory per instance, loopback dikecualikan | Rendah | `middleware/security.go:148-167` | **[S]** |
| F-16 | Dead handler `StoreHandler.UpgradePlan` menyetel `Plan`/`PaymentStatus` dari body (belum dirutekan) | Rendah (laten) | `store_handler.go:1109-1136` | **[S]** |

**Kontrol yang sudah baik** (jangan diutak-atik tanpa alasan): JWT HS256 pinned + `iss`/`aud` + `token_version` + blacklist `jti` (`middleware/auth.go:250-311`); cookie HttpOnly/SameSite=Strict (`session_cookie.go:31-46`); CSP berbasis hash tanpa `unsafe-inline` script (`csp.go:47-86`); CSRF Origin/Referer (`csrf.go:31-98`); magic-byte + re-encode EXIF pada upload; path guard anti-traversal (`services/path_guard.go:30-70`).

### 9.3 Rekomendasi keamanan (urut dampak)

1. **F-02/F-03 (satu akar masalah).** Pisahkan tegas: rute tenant hanya untuk pemilik toko (`store.UserID == user.ID`), dan bila staf platform butuh "oversight", buat grup terpisah yang mensyaratkan `RequirePermission` eksplisit (mis. `system:stores:manage`) — jangan meloloskan `IsPlatformStaff()` di rute tenant. Perbaiki `OperationalStoreRequired` (`auth.go:503-507`) dengan logika yang sama.
2. **F-01.** Ubah `/api/settings` menjadi **allowlist** key publik. Tanpa ini, setiap key baru yang ditambahkan operator otomatis menjadi publik.
3. **F-04.** Pisahkan DTO publik dari `models.Store`. Ini juga memperbaiki risiko cache Redis menyajikan data yang seharusnya privat.
4. **F-05.** Pindahkan `policy-audit-logs` ke `adminApi` dengan `audit:logs:read`.
5. **F-09.** Hentikan pengembalian JWT di body; cukup andalkan cookie HttpOnly + `Set-Cookie` bergilir.

---

## 10. Kualitas kode & arsitektur (akar dari divergensi)

### 10.1 Monolit komponen

| File | Baris |
|---|---|
| `frontend/mobile/src/App.tsx` | 33.161 |
| `frontend/desktop/src/App.tsx` | 32.448 |
| `frontend/mobile/src/components/PlatformRolePortal.tsx` | 15.337 |
| `frontend/desktop/src/components/PlatformRolePortal.tsx` | 15.456 |
| `frontend/tablet/src/components/TabletMerchantAdmin.tsx` | 9.860 |
| `frontend/tablet/src/components/TabletPlatformConsole.tsx` | 4.478 |
| `frontend/desktop/src/components/MerchantAdminShell.tsx` | 1.306 |

[V] Dua `App.tsx` ~33k baris adalah **penyebab struktural** dari divergensi yang dilaporkan di §4: setiap perubahan flow harus diterapkan manual di tiga tempat, dan tidak ada satu pun mekanisme yang memaksa ketiganya konsisten.

### 10.2 Duplikasi lintas device

Indikator duplikasi (jumlah kemunculan di seluruh `src`) [V]:

| Pola | Mobile | Tablet | Desktop |
|---|---|---|---|
| `attributes: {` | 34 | 7 | 34 |
| `purchase_links` | 17 | 19 | 17 |
| `enable_wa_rekber` | 29 | 17 | 29 |
| `max_order` | 39 | 16 | 35 |

Mobile dan desktop nyaris identik (turunan copy-paste), tablet ditulis ulang dengan pendekatan lebih data-driven (`catalogConfig.ts`, `TabletCustomSelect`, `TabletMasterDetailView`). Tidak ada paket bersama (`shared/` atau `packages/ui`) — jadi form produk ada dalam 3 implementasi independen.

### 10.3 Catatan operasional

- Dua instance (`8000`, `8001`) hidup bersamaan; hentikan salah satu sebelum uji agar hasil tidak ambigu.
- `.env` ada di root repo (tidak di-commit menurut `/.gitignore`) — pastikan tidak memuat kredensial produksi pada mesin kerja.
- Repo punya `catavor-server.exe` dan `catavor.db` di akar — artefak build/data lokal sebaiknya tidak berada di working tree.

---

## 11. Rekomendasi berprioritas

### P0 — sebelum menyentuh yang lain (risiko data & otorisasi)

| # | Aksi | Effort | Bukti acuan |
|---|---|---|---|
| 1 | Ubah `product_handler.go:747-753` agar hanya menimpa `price`/`max_order` bila field benar-benar dikirim (pointer) — atau klien mengirim payload penuh | S | B-01, B-02 |
| 2 | Pisahkan otorisasi tenant vs platform; hapus `IsPlatformStaff()` dari alur tenant (`auth.go:414-419`, `:503-507`, `store_handler.go:2030`) | M | F-02, F-03 |
| 3 | Allowlist `/api/settings` publik | S | F-01, R-01 |
| 4 | DTO publik untuk `/api/u/:slug` | S | F-04, R-02 |

### P1 — keselarasan fungsional yang dirasakan pengguna

| # | Aksi | Device | Effort |
|---|---|---|---|
| 5 | Tambah input stok & satuan pada form katalog | Tablet | M |
| 6 | Tambah input `portion_size`, `prep_time`; `expired_info` untuk tablet | Desktop, Tablet | S |
| 7 | Perbaiki endpoint cabut staf (`/rbac/staff/revoke`) | Mobile, Tablet | S |
| 8 | Satukan lokasi Log Aktivitas jadi satu menu bernama sama di tiga device | Semua | S |
| 9 | Satukan lokasi Kategori Etalase (rekomendasi: menu tingkat satu, seperti tablet/desktop) | Mobile | M |
| 10 | Satukan jalur akses RBAC & Portal Staf: mobile/desktop menampilkannya di panel admin, tablet memaksa pindah ke Konsol Platform | Semua | M |
| 11 | Ganti `window.confirm` hapus item dengan modal terdesain | Desktop | S |
| 12 | Hapus hardcode `setAdminTab('items')` → smart back (`history.back()` + fallback semantik) | Desktop | S |

### P2 — kepatuhan standar & pemeliharaan

| # | Aksi | Effort |
|---|---|---|
| 13 | Mobile: load-more untuk inventaris (bukan client-side 10/hal) | M |
| 14 | Desktop: tambah opsi 100 baris, tombol Awal/Akhir, ringkasan "Menampilkan X–Y dari Z", quick jump | M |
| 15 | Tablet: quick page jumper + touch target ≥44px | M |
| 16 | Bersihkan `✕` pada sheet mobile & `<select>` native; daftarkan 6 overlay ke `useModalBackHandler` | M |
| 17 | Ganti emoji (`💡 ⚡ 🔒 ➕`) dengan ikon Lucide; hapus `attributes.facilities` zombie | S |
| 18 | Pecah `App.tsx` 33k baris menjadi modul per fitur; pertimbangkan paket bersama untuk form katalog | L |
| 19 | Escape wildcard `LIKE`; konsistenkan sanitasi; perbaiki type assertion | S |

---

## 12. Apa yang saya butuhkan untuk menaikkan keyakinan laporan ini

1. **Dua akun uji** (merchant A, merchant B) + satu akun `support` → saya bisa membuktikan F-02/F-03/F-06/F-07/F-08 secara runtime, bukan hanya dari kode.
2. **Izin tulis di `catavor`** → saya bisa menjalankan `npm run build` ketiga frontend (mandat tri-build) dan Playwright untuk verifikasi perilaku (back stack, modal, 320px/ultra-wide).
3. **Konfirmasi instance mana yang resmi** (8000 atau 8001) agar audit berikutnya tidak ambigu.
4. **Browser/device uji** untuk memvalidasi gesture fisik dan tampilan tablet nyata — bagian yang memang tidak bisa saya gantikan.

---

## Lampiran A — Perintah reproduksi

```powershell
# 1. Bukti R-01: settings publik tanpa allowlist
curl.exe -s http://localhost:8001/api/settings

# 2. Bukti R-02: field internal pada endpoint publik
curl.exe -s http://localhost:8001/api/u/adidas

# 3. Bukti statis B-01: payload arsip parsial
#    frontend/mobile/src/App.tsx:9869-9876  (tanpa max_order)
#    backend/internal/handlers/product_handler.go:753  (MaxOrder ditimpa tanpa syarat)

# 4. Bukti B-03: rute yang tidak ada
#    frontend/mobile/src/components/AdminRBACManagement.tsx:305  -> /staff/{id}/revoke
#    backend/cmd/server/main.go:482                              -> /staff/revoke

# 5. Bukti B-04: tablet tanpa input stok/unit
#    ripgrep "stok|Satuan|unit" frontend/tablet/src/components/TabletMerchantAdmin.tsx
```

## Lampiran B — Ringkasan status verifikasi

| Kategori | Terverifikasi sendiri | Dilaporkan sub-agen |
|---|---|---|
| Navigasi & penempatan modul | 9 dari 14 baris matriks | 5 baris |
| Form katalog | stok/unit tablet, `portion_size`/`prep_time`, `expired_info` | sisanya |
| Bug fungsional | B-01, B-02, B-03, B-04, B-06 | B-05, B-07..B-10 |
| Keamanan | F-01, F-02, F-03, F-04, F-11 + R-01..R-03 | F-05..F-10, F-12..F-16 |

Bagian yang tidak dapat diverifikasi tanpa kredensial/browser sudah dicantumkan eksplisit di §12 dan pada kolom "Verifikasi" di tabel temuan.
