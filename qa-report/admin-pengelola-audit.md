# Audit QA — Admin Pengelola (Platform Management Console)

**Scope:** modul Admin Pengelola Platform (`/admin?tab=…`) pada tiga form-factor.
**Golden reference:** `frontend/mobile` (fitur & alur benar; yang boleh berbeda hanya penyajian visual).
**Metode:** eksekusi nyata aplikasi di `http://localhost:8000` (bukan pembacaan kode saja) + verifikasi akar masalah di kode sumber.
**Tanggal:** 2026-10-25
**Akun uji:** `e2e-admin@catavor.test` (Superadmin, login `portal: "admin"`)

---

## 1. Ringkasan Eksekutif

| Aspek | Status |
|---|---|
| Tri-build (desktop / tablet / mobile) | **LULUS** — 3/3 `exit 0` |
| Console error saat memuat 30 halaman | **0 error** |
| Overflow horizontal pada 3 viewport | **0 kasus** |
| Kelengkapan modul (11 modul) | **Selaras** di 3 device |
| **Kontrak deep-link `?tab=`** | **TIDAK selaras** — P1 |
| **Target sentuh ≥44px (tablet)** | **TIDAK patuh** — P1 |
| **Label status di tablet** | **Bocor enum mentah** — P2 |
| **Emoji di UI** | **Ditemukan (mobile)** — P2 |
| Struktur heading semantik (mobile) | **Tidak ada h1/h2** — P2 |

Kesimpulan: **alur dan kelengkapan fitur sudah selaras**, tetapi ada **satu cacat arsitektural** yang membuat tautan antar-device salah mendarat (deep-link), plus pelanggaran aturan UI yang sistematis pada tablet.

---

## 2. Temuan Berprioritas

### P1-1 · Kontrak URL `?tab=` berbeda antar device → tautan bersama mendarat di modul salah

**Bukti runtime** (aplikasi live, akun superadmin, 3 viewport):

| `?tab=` | Desktop | Tablet | Mobile (acuan) |
|---|---|---|---|
| `rbac` | Staf & Role RBAC | **Dashboard** | Staf & RBAC |
| `staff` | **Dashboard** | Staf & Role RBAC | **Dashboard** |
| `helpdesk` | Pusat Bantuan & Helpdesk | **Dashboard** | Helpdesk Tiket |
| `bot` | Mesin Otomatisasi | **Dashboard** | Mesin Otomatisasi |
| `master_data` | Master Data | **Dashboard** | Data Master Platform |
| `master-data` | Master Data | Master Data | Data Master Platform |
| `domains` | Master Data | **Dashboard** | Master Domain Aman |
| `safe_domains` | Master Data | **Dashboard** | Master Domain Aman |

**Akar masalah** — tiga daftar izin yang berbeda untuk kontrak yang sama:

- `frontend/tablet/src/components/TabletPlatformConsole.tsx:210` — `validTabs` memakai `'staff'` dan `'master-data'`:
  ```ts
  const validTabs = ['dashboard', 'stores', 'reports', 'support', 'finance', 'staff', 'broadcast', 'automation', 'monetization', 'master-data', 'audit'];
  ```
- `frontend/tablet/src/components/TabletPlatformConsole.tsx:233` — tablet juga **menulis** URL dengan kunci `staff` (`url.searchParams.set('tab', newView)`), jadi URL yang dibagikan dari tablet tidak dikenali desktop & mobile.
- `frontend/desktop/src/components/PlatformRolePortal.tsx:2454` — allowlist desktop memakai `'rbac'` dan **tidak memuat** `automation`, `master_data`, `staff`, maupun alias `helpdesk`/`bot`/`domains`.
- `frontend/mobile/src/components/PlatformRolePortal.tsx:388` dan `:2561` — mobile adalah yang terlengkap: menerima `rbac`, `automation`, `master_data`, `master-data`, `domains`, `safe_domains`, `helpdesk`, `bot`.

**Dampak nyata:** merchant/staf membuka tautan `…/admin?tab=rbac` yang dikirim rekan dari desktop di tablet → **mendarat di Dashboard tanpa pesan apa pun**, dan mengira fitur RBAC tidak ada. Ini juga melanggar mandat §3 (URL state sync) dan §1 (navigasi tidak boleh bergantung pada jalur masuk).

**Catatan:** alias `tidak-ada-modul-ini` (kontrol) jatuh ke Dashboard di ketiga device secara konsisten — jadi perilaku *fallback* itu sendiri benar; yang rusak adalah **peta aliasnya**.

---

### P1-2 · Tablet: target sentuh konsol jauh di bawah 44px

Diukur pada 7 tab konsol, viewport 900×1180 (touch):

| Tab | Elemen < 44px | Contoh konkret |
|---|---|---|
| reports | 13 | pill "Semua 0" 81×25, "Menunggu 0" 101×25, "Investigasi 0" 102×25 |
| support | 11 | "Perlu Respon 0" 119×28, "Tunggu Merchant 0" 144×28 |
| audit | 14 | "SEMUA" 58×23, "KEAMANAN" 83×23, "KATALOG" 71×23 |
| stores | 12 | "Tabel" 84×38, "Kartu" 84×38, "Semua Paket" 139×42 |
| finance | 7 | "Verifikasi" 74×28, "Lunas" 55×28 |
| dashboard / rbac | 2 masing-masing | tombol "Segarkan" 106×32 |

Total **68 elemen** di bawah ambang pada tablet. Mandat §7.A.2: *"Touch Targets: Minimal 44x44px untuk seluruh area tombol, input, dan kontrol sentuh/stylus."* Untuk pembanding, mobile juga mencatat 80 elemen < 44px (mis. "Masuk" 54×25, pill filter 28px) — jadi ini pola bersama, bukan khusus tablet.

---

### P2-1 · Tablet menampilkan enum mentah ke pengguna

`?tab=finance` pada tablet menampilkan filter: **`Semua · Verifikasi · PENDING_PAYMENT · Lunas · REJECTED`**.
Mobile menampilkan padanan berbahasa Indonesia yang benar: **`Semua · Pending · Aktif · Ditolak`**.

**Akar masalah:** `frontend/tablet/src/components/TabletPlatformConsole.tsx:5760`

```tsx
{tab === 'all' ? 'Semua' : tab === 'pending_verification' ? 'Verifikasi' : tab === 'paid' ? 'Lunas' : tab.toUpperCase()}
```

Cabang `tab.toUpperCase()` adalah *fallback* yang membocorkan nilai database ke antarmuka. Nilai `pending_payment` dan `rejected` tidak punya pemetaan.

---

### P2-2 · Emoji pada antarmuka bisnis

Mandat §6 melarang emoji di judul card, tombol aksi, atau status badge.

Ditemukan di mobile (konsol pengelola):

| File | Baris | Teks |
|---|---|---|
| `frontend/mobile/src/components/PlatformRolePortal.tsx` | 6154 | `📥 Revisi Masuk` (label tab triage laporan) |
| sama | 6301 | `📥 Revisi Masuk` (badge status) |
| sama | 6303 | `🚫 Banned Permanen` (badge status) |

Desktop & tablet pada modul yang sama sudah bersih (`Revisi Masuk`, `Banned Permanen` tanpa emoji) — jadi di sini **mobile justru yang menyimpang dari standar**, dan karena mobile adalah golden reference, penyimpangan ini berisiko ditiru ke device lain.

Catatan pembeda: `⚡`, `💡`, `👑`, `🔒` yang muncul di halaman publik/admin merchant **di luar** scope audit ini; `✓` (U+2713) bukan emoji.

---

### P2-3 · Mobile kehilangan struktur heading semantik

Pada 10 dari 13 tampilan konsol yang diuji, mobile **tidak memiliki `h1`/`h2`** (judul dirender sebagai `div`), sementara desktop dan tablet punya:

| View | Desktop | Tablet | Mobile |
|---|---|---|---|
| rbac | `h*` "Staf & Role RBAC" | `h*` "Staf & Role RBAC" | **tidak ada heading** |
| stores | "Tata Kelola Merchant & Dormansi" | "Tata Kelola Profil Merchant" | **tidak ada** |
| reports / support / finance / audit / automation / master data | ada | ada | **tidak ada** |

Dampak: pembaca layar kehilangan judul halaman; navigasi heading (shortcut a11y) tidak berfungsi di mobile.

---

## 3. Yang Terbukti SEHAT (jangan "diperbaiki" tanpa alasan)

1. **Tri-build hijau** — `npm run build` desktop, tablet, mobile: `exit 0` (1958 / 1952 / 1954 modul, tanpa error TypeScript).
2. **Nol console error** pada 30 pemuatan halaman (3 device × 10 rute) — termasuk nol `pageerror`.
3. **Nol overflow horizontal** di 1440×900, 900×1180, dan 390×844.
4. **11 modul konsol lengkap di ketiga device**: Ringkasan, Kepatuhan & Laporan, Helpdesk, Keuangan, Tata Kelola Toko, Staf & RBAC, Siaran Broadcast, Mesin Otomatisasi, Monetisasi, Data Master, Audit Trail.
5. **Deep-link kanonik bekerja di desktop & mobile** untuk seluruh alias utama (kecuali `staff`).
6. **Penyajian memang berbeda secara sah** sesuai ergonomi: desktop memakai sidebar kelompok (UTAMA/OPERASIONAL/SISTEM), tablet memakai icon-rail + split view, mobile memakai 4 bottom-tab + grid modul — dan isi informasinya setara.

---

## 4. Yang BELUM Terverifikasi (jujur, bukan asumsi)

| Area | Alasan belum terverifikasi |
|---|---|
| **Penegakan izin RBAC per role** | Hanya 1 akun staf platform (superadmin) tersedia. Tidak ada staff ber-role terbatas untuk membuktikan modul yang disembunyikan sama di 3 device. |
| **Paginasi & filter pada data nyata** | Database hampir kosong: 5 toko, 5 produk, **0 tiket**, **0 laporan**. Bar paginasi ("Menampilkan X–Y dari Z") tidak dapat divalidasi karena tidak ada baris yang perlu dipaginasi. |
| **Alur detail** | Modal moderasi laporan, detail tiket + balasan, verifikasi bukti bayar, dan broadcast multi-step belum dieksekusi. |
| **Regresi CI tablet** | `.github/workflows/ci.yml` matrix frontend hanya `[desktop, mobile]` dan `tests/playwright.config.ts` hanya punya project `mobile` + `desktop` — **tablet tidak dijaga CI sama sekali**, sehingga temuan P1-1/P1-2 tidak akan tertangkap otomatis. |

---

## 5. Rekomendasi (pilih satu arah sebelum eksekusi)

**Akar masalah P1-1 bukan bug di satu baris, melainkan tidak adanya satu sumber kebenaran untuk kunci tab.** Tiga file mendefinisikan daftar yang sama secara terpisah.

- **Opsi 1 (rekomendasi senior) — Kontrak bersama + tes kontrak.**
  Buat satu konstanta bersama (`console-tab-contract`) berisi `id`, alias yang diterima, dan label; ketiga portal mengimpor daftar itu, bukan menulis ulang. Tambah satu tes Playwright yang membandingkan hasil deep-link tablet vs mobile vs desktop untuk setiap alias (persis seperti harness di `tests/audit/console-parity.cjs`). Biaya: menyentuh 3 codebase, termasuk `mobile` — perlu izin eksplisit karena *Mobile Codebase Freeze*.
- **Opsi 2 (jalan tengah, tanpa menyentuh mobile) — Normalisasi di tablet + desktop saja.**
  Tambahkan `'rbac'` sebagai alias yang dipetakan ke `staff` di tablet, dan lengkapi allowlist desktop (`automation`, `master_data`, `helpdesk`, `bot`, `domains`, `safe_domains`). Tablet tetap *menulis* URL dengan kunci kanonik `rbac`. Mobile tidak disentuh sama sekali. Biaya rendah, risiko rendah, tapi daftar tetap terduplikasi di 3 tempat.
- **Opsi 3 (paling murah) — Hanya dokumentasi kontrak.**
  Tetapkan `rbac`/`master_data` sebagai kunci resmi, dokumentasikan di `.agents/`, dan larang penulisan kunci baru. Tidak memperbaiki tautan yang sudah beredar.

Untuk P1-2 (target sentuh) dan P2-1 (enum bocor), perbaikannya terisolasi di tablet dan tidak menyentuh mobile.

---

## 6. Artefak

| Berkas | Isi |
|---|---|
| `qa-report/console-deeplink.md` | Matriks lengkap 19 alias × 3 device + kutipan isi tiap view |
| `qa-report/console-deeplink.json` | Data mentah hasil pengujian deep-link |
| `qa-report/summary.md` | Matriks 30 halaman × device (overflow, target sentuh, emoji, `<select>`, pola paginasi) |
| `tests/audit/parity-audit.cjs` | Harness: potret 3 viewport + probe kepatuhan aturan UI |
| `tests/audit/console-parity.cjs` | Harness: uji kontrak deep-link konsol |
| `tests/audit/summarize.cjs` | Pengubah `report.json` menjadi `summary.md` |
| `%TEMP%\catavor-qa\*.png` | 30 tangkapan layar per device × rute |

**Cara reproduksi**

```powershell
# prasyarat: server live di :8000 dengan fixture E2E
node tests/audit/console-parity.cjs    # matriks deep-link
node tests/audit/parity-audit.cjs      # matriks 30 halaman
node tests/audit/summarize.cjs         # ringkasan markdown
```

---

## 7. Catatan Lingkungan

1. **Sandbox Windows menolak semua tulisan di subfolder workspace** — hanya root yang bisa ditulis, karena entri akses sandbox tidak terwarisi ke folder lama (folder baru mewarisi normal). Perbaikan izin akar sudah dilakukan dan diverifikasi; build serta Playwright dijalankan dengan akses penuh.
2. **`public/desktop` ter-build ulang** saat verifikasi tri-build: `index-CgwQbZP6.js` → `index-B9pF6CIN.js`. Bundle kini memuat perubahan `PlatformAdminShell.tsx` dan `PlatformRolePortal.tsx` yang **sudah ada di working tree sebelum audit** (bukan perubahan saya). Kembalikan dengan `git checkout -- public/desktop` bila artifact lama yang diinginkan.
3. **Tidak ada kode sumber yang saya ubah.** Yang bertambah hanya 3 berkas harness di `tests/audit/` dan folder `qa-report/`.
