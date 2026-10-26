# Audit Konsistensi Siaran Broadcast — Desktop / Tablet / Mobile

**Target:** `http://localhost:8000` → Platform Admin Console → `?tab=broadcast`
**Akun:** `e2e-admin@catavor.test` (`platform_role=superadmin`)
**Tanggal:** 2026-10-26
**Patokan kebenaran:** bundle **mobile**
**Sifat pengujian:** read-only — `POST /api/admin/notifications/broadcast` di-*abort* di level network,
jadi tidak ada satu baris pun ditulis ke database.

---

## STATUS PERBAIKAN (diperbarui 2026-10-26, setelah eksekusi)

| ID | Temuan | Severity | Status |
|---|---|---|---|
| BC-1 | Tablet menjanjikan banner katalog yang tak ada di backend/DB | HIGH | **FIXED** |
| BC-2 | Tablet tak pernah kirim `link_mobile_settings_tab` (kolom DB nyata) | MEDIUM | **FIXED** |
| BC-3 | Tablet tanpa atribut `required` pada judul & pesan | LOW | **FIXED** |
| BC-4 | Label field tablet menyimpang dari mobile | LOW | **FIXED** |
| BC-5 | Tablet `limit=50` tanpa paginasi | MEDIUM | OPEN |
| BC-6 | Request daftar notifikasi ganda | LOW | OPEN |
| BC-7 | `target_id` mati di ketiga device | INFO | FIXED (struktural) |

### Bukti runtime perbaikan

Bundle tablet dibangun ulang (`vite build` → `public/tablet/assets/index-i2TWicJ9-t.js`)
lalu diuji di browser sungguhan dengan akun admin, bukan typecheck:

```
=== TABLET ===
form opened        : Buat Siaran Baru
banner words found : []        (harap [])
swatch buttons     : 0         (harap 0)
banner checkbox    : 0         (harap 0)
form labels present: ["Judul Pengumuman","Pesan Ringkas","Kategori","Urgensi","Masa Berlaku"]
form labels missing: []        (harap [])
required fields    : 2
console errors     : []        (tanpa route.abort)
API non-200        : tidak ada (semua 200)

tablet payload keys: [action_enabled, action_label, action_type, action_url, category,
  detail_content, expires_in_hours, link_mobile_settings_tab, link_sub_tab, message,
  notification_action_enabled, recipients, target_id, target_name, target_plan_code,
  target_recipients, target_type, title, type]

show_top_banner : ABSENT
banner_color    : ABSENT

=== DIFF TABLET vs MOBILE ===
hanya di tablet: []
hanya di mobile: []
beda nilai     : TIDAK ADA — identik
```

Verifikasi alur tak rusak: list → buka form → Batal → kembali ke list → buka form lagi,
state judul ter-reset (`titleValue: ""`), tidak ada error console, semua API 200.

Catatan: `console errors: net::ERR_FAILED` yang sempat muncul pada harness pertama adalah
artefak `route.abort()` milik harness itu sendiri (POST sengaja digagalkan agar tidak menulis DB).
Probe tanpa abort membuktikan **0 console error**.

---

## Ringkasan

Mobile dan desktop **sudah selaras** pada form input (field, atribut, opsi dropdown, payload).
Yang menyimpang adalah **tablet**: ia punya satu field yang tidak dimiliki mobile/desktop
(`show_top_banner` + `banner_color`) yang **tidak dibaca backend dan tidak ada kolomnya di database** —
jadi UI-nya berbohong. Tablet juga memakai strategi pengambilan data yang berbeda
(`limit=50` sekali tarik, tanpa paginasi) dan kehilangan dua tipe target yang dimiliki mobile.

| Aspek | Desktop | Tablet | Mobile (patokan) | Status |
|---|---|---|---|---|
| Endpoint daftar | `?page=1&limit=10` | `?page=1&limit=50` | `?page=1&limit=10` | **tablet beda** |
| Paginasi UI | ada (← Sebelumnya / Selanjutnya →) | **tidak ada** | ada | **tablet beda** |
| Baris dirender (dari 23) | 10 + paginasi | **23 sekaligus** | 10 + paginasi | **tablet beda** |
| Endpoint kirim | `POST /api/admin/notifications/broadcast` | sama | sama | selaras |
| Field judul | maxlen 100, `required` | maxlen 100, **tanpa `required`** | maxlen 100, `required` | **tablet beda** → FIXED |
| Field pesan | maxlen 250, `required` | maxlen 250, **tanpa `required`** | maxlen 250, `required` | **tablet beda** → FIXED |
| Tipe target | all / plan / specific / single_store / single_user | all / plan / specific | all / plan / specific / single_store / single_user | **tablet kurang 2** |
| Field banner | tidak ada | `show_top_banner`, `banner_color` | tidak ada | **tablet fiktif** → FIXED |

---

## Bukti terukur

### 1. Payload POST — field per field

Diambil dari network sesi nyata masing-masing device, form diisi identik (`title`/`message` sama).

| Field | Desktop | Tablet | Mobile |
|---|---|---|---|
| `action_enabled` | false | false | false |
| `action_label` | `""` | `""` | `""` |
| `action_type` | `none` | `none` | `none` |
| `action_url` | `""` | `""` | `""` |
| **`banner_color`** | **ABSENT** | **`"blue"`** | **ABSENT** |
| `category` | PENGUMUMAN | PENGUMUMAN | PENGUMUMAN |
| `detail_content` | `""` | `""` | `""` |
| `expires_in_hours` | 0 | 0 | 0 |
| **`link_mobile_settings_tab`** | `""` | **ABSENT** | `""` |
| `link_sub_tab` | `""` | `""` | `""` |
| `message` | (sama) | (sama) | (sama) |
| `notification_action_enabled` | false | false | false |
| `recipients` | `[]` | `[]` | `[]` |
| **`show_top_banner`** | **ABSENT** | **`false`** | **ABSENT** |
| **`target_id`** | `0` | **ABSENT** | `0` |
| `target_name` | `""` | `""` | `""` |
| `target_plan_code` | `pro` | `pro` | `pro` |
| `target_recipients` | `"[]"` | `"[]"` | `"[]"` |
| `target_type` | all | all | all |
| `title` | (sama) | (sama) | (sama) |
| `type` | info | info | info |

**Desktop = mobile, identik 100%.** Tablet beda di 4 field.

Catatan penting: `target_id` yang absen di tablet **tidak** mengubah perilaku — backend
mendeklarasikan `TargetID uint` sehingga JSON absen = `0`, sama dengan yang dikirim mobile.

### 2. Field banner tablet adalah fitur hantu

Backend `BroadcastReq` (`internal/handlers/notification_handler.go:671-690`) **tidak punya**
field `show_top_banner` / `banner_color`. Struct `models.Notification` juga tidak.

```
grep -n "show_top_banner\|banner_color" internal/handlers/notification_handler.go internal/models/notification.go
→ (tidak ada hasil)
```

```
select count(*) from information_schema.columns
  where table_name='notifications' and column_name like '%banner%';
→ 0
```

Konsekuensi: tablet menampilkan checkbox **"Sematkan Banner Strip di Katalog Merchant"**
beserta pilihan warna, merchant mencentangnya, mengirim siaran, dan **tidak ada apa pun
yang tersimpan atau tampil di katalog**. Ini bukan inkonsistensi visual — ini janji palsu ke pengguna.

### 3. Strategi pengambilan data & paginasi

Request nyata ke `GET /api/admin/notifications` per device; response dimock 23 baris deterministik:

| Device | Query | Dirender | Kontrol paginasi |
|---|---|---|---|
| Desktop | `?page=1&limit=10` | 10 dari 23 | ← Sebelumnya / Selanjutnya → |
| Tablet | `?page=1&limit=50` | **23 dari 23** | **tidak ada** |
| Mobile | `?page=1&limit=10` | 10 dari 23 | ← Sebelumnya / Selanjutnya → |

Tablet hardcode `limit=50` (`TabletPlatformConsole.tsx:1216`) dan tidak merender paginasi.
Kalau siaran menembus 50, riwayat lama **tidak bisa diakses sama sekali** dari tablet.

Temuan tambahan: desktop & mobile sama-sama menembak **dua** request daftar —
`/api/admin/notifications` (tanpa param, dari portal induk, `PlatformRolePortal.tsx:2267`)
plus `?page=1&limit=10`. Request tanpa param mengembalikan default 15 baris dan ikut
meng-overwrite state daftar. Bukan bug fatal, tapi duplikasi + race state.

### 4. Opsi dropdown — isi sama, hanya kata "toko"/"merchant" yang beda

Dibuka satu per satu lewat UI, opsi dibaca dari diff DOM:

| Panel | Desktop | Mobile | Tablet |
|---|---|---|---|
| Target | Global / Paket / Spesifik | Global / Paket / Spesifik | Semua / Paket / Spesifik |
| Kategori | PENGUMUMAN, SISTEM, PROMOSI, PEMELIHARAAN, PANDUAN, KEAMANAN | identik | identik |
| Urgensi | Info, Urgent, Sukses, Sistem | identik | identik |
| Masa berlaku | Permanen, 24 Jam, 3 Hari, 7 Hari, 30 Hari | identik | Permanen, 24 Jam, 3 Hari, 1 Minggu, 1 Bulan |

Perbedaan kata pada deskripsi target (`"...tier langganan merchant"` vs `"...toko"`) adalah
**kosmetik bahasa**, bukan perbedaan data. Yang substantif adalah tablet tidak punya
tipe `single_store` dan `single_user` (union type di `TabletPlatformConsole.tsx:1107`
hanya `'all' | 'plan' | 'specific'`, sedangkan desktop/mobile punya kelimanya).

### 5. Cara membuka form create — beda affordance, bukan beda data

| Device | Kontrol | Ukuran | Catatan |
|---|---|---|---|
| Desktop | tombol teks "Buat Siaran" | 122×36 | `title="Buat Siaran Baru"` |
| Tablet | tombol teks "Buat Siaran Baru" | 166×37 | |
| Mobile | **ikon `+` saja** | 34×34 | hanya `title="Buat Siaran"`, tidak ada teks |

Mobile: tombol berteks `+ Buat Siaran Baru` **hanya muncul di empty-state** (tidak ada siaran
sama sekali). Begitu ada ≥1 siaran, satu-satunya jalan membuat siaran baru adalah ikon `+`
tanpa label di app bar. Untuk QA otomatis maupun screen-reader ini rapuh — sebaiknya diberi
`aria-label` eksplisit.

### 6. Verifikasi klaim vision

Vision mengaku melihat panel dropdown dan tombol lebih lengkap daripada probe DOM awal.
Setelah probe diperbaiki (deteksi custom dropdown berbasis `cursor:pointer` + `svg`),
klaim itu **terkonfirmasi** — desktop memang punya 4 panel (Target, Kategori, Urgensi,
Masa Berlaku) yang di awal terbaca 0 karena memakai `<div>`/`<button>`, bukan `<select>`.
Ini kebalikan dari kasus landing page sebelumnya: di sini vision benar dan DOM-probe-ku yang salah.

---

## Yang sudah selaras (jangan diutak-atik)

- Endpoint kirim: sama persis di ketiga device (`POST /api/admin/notifications/broadcast`).
- Batas panjang: judul 100, pesan 250 — identik.
- Validasi wajib isi: sama (tablet beda hanya di atribut HTML `required`, JS-nya tetap memvalidasi).
- `category`, `type`, `expires_in_hours`, `target_plan_code`, `target_type` — nilai & default identik.
- Serialisasi `recipients` → `[]` dan `target_recipients` → `"[]"` identik.
- Nol console error, nol API failure di ketiga device.

---

## Rekomendasi, urut dampak

| # | Prioritas | Tindakan | File | Effort |
|---|---|---|---|---|
| 1 | **TINGGI** | Hapus UI banner tablet (`show_top_banner`, `banner_color`) **atau** implementasikan penuh: tambah field di `BroadcastReq`, kolom DB, dan render di halaman katalog publik. Sekarang = fitur hantu. | `TabletPlatformConsole.tsx:1106-1130`, `notification_handler.go:671` | 30 mnt (hapus) / 1–2 hari (implementasi) |
| 2 | **TINGGI** | Samakan paginasi tablet: `limit=10` + kontrol halaman seperti mobile, atau tambah penanganan "muat lebih" saat `has_more`. | `TabletPlatformConsole.tsx:1216` | 2–4 jam |
| 3 | **SEDANG** | Tambah tipe target `single_store` & `single_user` di tablet, atau hapus dari desktop/mobile kalau memang legacy yang tak dipakai. Pilih satu arah. | union type ketiga file | 3–4 jam |
| 4 | **SEDANG** | Hentikan request daftar ganda: portal induk tidak perlu `fetch('/api/admin/notifications')` saat halaman broadcast aktif. | `PlatformRolePortal.tsx:2267`, `TabletPlatformConsole.tsx` | 1 jam |
| 5 | **RENDAH** | Tambah `aria-label="Buat Siaran"` pada tombol ikon `+` mobile. | `PlatformRolePortal.tsx` (mobile) ~L3898 | 15 mnt |
| 6 | **RENDAH** | Seragamkan kata "merchant" vs "toko" pada deskripsi panel target. | ketiga file | 15 mnt |

---

## Belum diuji / tidak bisa diverifikasi

- **Submit sungguhan** — POST sengaja di-abort supaya tidak menulis data. Perilaku pasca-simpan
  (toast, redirect, refresh daftar, notifikasi SSE ke merchant) belum diverifikasi end-to-end.
  Perlu izin menulis satu siaran uji.
- **Target `specific` / `plan` dengan penerima nyata** — payload `recipients` hanya teruji dalam
  keadaan kosong. Perilaku autocomplete multi-penerima di ketiga device belum dibandingkan.
- **Aksi notifikasi aktif** (`action_type=detail/navigate/external_link`) — form bagian ini belum
  diisi; perbedaan payload antar device untuk jalur aksi belum terukur.
- **Dark mode** — semua pengukuran di atas dilakukan pada tema terang.

---

## Artefak

Harness & data mentah: `C:\Users\hwtor\AppData\Local\Temp\qa-bc\`

| File | Isi |
|---|---|
| `report.json` | pass 1 — login, list, network call |
| `report2.json` | pass 2 — inventaris kontrol awal |
| `report3.json` | pass 3 — payload pertama per device |
| `report4.json` | pass 4 — form ter-mount + opsi dropdown lengkap |
| `report5.json` | pass 5 — pemilihan opsi lewat UI |
| `report6.json` | pass 6 — mock 23 baris, paginasi |
| `p2-*.jpg`, `p3-*.jpg`, `p4-*.jpg`, `p6-*.jpg` | screenshot per device (viewport, bukan full-page) |
